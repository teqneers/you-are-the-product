import { getDomain } from 'tldts';
import { bucketFor, companyFor, companyNamed } from '@/lib/trackers';
import { BUCKET_ORDER, type Bucket } from '@/lib/buckets';
import bundledLogos from '@/data/logos.json';
import {
  emptyState,
  FINGERPRINT_TECHNIQUES,
  loadState,
  ownerOf,
  saveState,
  type FingerprintTechnique,
  type State,
  type TabSession,
} from '@/lib/state';
import { isVisible, watchSettings, type Settings } from '@/lib/settings';
import { bodyText, findLeaks } from '@/lib/leaks';
import { decodeTcString } from '@/lib/tcf';
import { decodePixel } from '@/lib/pixels';
import { linkParams } from '@/lib/link-decoration';
import { companyOfCookie, cookieLifetime, cookieName } from '@/lib/cookies';
import { loadGeo, type Geo } from '@/lib/geo';
import { findTyped, needlesFor, type TypedValue } from '@/lib/form-leaks';
import { NEEDS_CONSENT, type Choice } from '@/lib/consent-verdict';
import { parseReport } from '@/lib/auctions';
import { cloakedTracker } from '@/lib/cloaking';
import { faviconUrls, fetchIcon } from '@/lib/fetch-icon';
import { ICONS_KEY, loadIcons, type Icons } from '@/lib/icons';

const MAX_AUCTIONS_PER_TAB = 50;
const MAX_PIXEL_EVENTS_PER_TAB = 50;
/** Pages of the same site opened within this time after the last tracker request count as one visit. */
const SAME_VISIT_MS = 30 * 60 * 1000;
/** Requests are kept this long, so an email typed just before can still be found in them. */
const RECENT_MS = 15_000;

/** A domain can serve both a CDN and a tracker (cdn.x.com, track.x.com); the more invasive use wins. */
const moreInvasive = (a: Bucket | undefined, b: Bucket) =>
  a && BUCKET_ORDER.indexOf(a) <= BUCKET_ORDER.indexOf(b) ? a : b;

export default defineBackground(() => {
  let state: State = emptyState();
  const ready = loadState().then((s) => (state = s));
  // Earlier versions downloaded IAB's vendor list and kept the names here; they now ship with the extension.
  void browser.storage.local.remove('vendorList');

  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  const scheduleSave = () => {
    saveTimer ??= setTimeout(() => {
      saveTimer = undefined;
      saveState(state);
    }, 500);
  };

  // Badge on the toolbar icon: number of companies watching in this tab.
  const action = browser.action ?? (browser as unknown as { browserAction: typeof browser.action }).browserAction;
  // Dark red with explicit white text: on lighter reds the browser picks dark text, which is hard to read.
  action.setBadgeBackgroundColor({ color: '#b00020' });
  action.setBadgeTextColor?.({ color: '#ffffff' });
  let settings: Settings = { hideInfrastructure: true };
  const dirtyBadges = new Set<number>();
  let badgeTimer: ReturnType<typeof setTimeout> | undefined;
  const flushBadges = () => {
    badgeTimer = undefined;
    for (const tabId of dirtyBadges) {
      const tab = state.tabs[tabId];
      const owners = new Set(
        Object.entries(tab?.parties ?? {})
          .filter(([, p]) => isVisible(p.bucket, settings))
          .map(([domain, p]) => ownerOf(domain, p.company)),
      );
      action.setBadgeText({ tabId, text: owners.size ? String(owners.size) : '' }).catch(() => {});
    }
    dirtyBadges.clear();
  };
  const markBadge = (tabId: number) => {
    dirtyBadges.add(tabId);
    badgeTimer ??= setTimeout(flushBadges, 300);
  };
  watchSettings(async (next) => {
    settings = next;
    await ready;
    for (const id of Object.keys(state.tabs)) markBadge(Number(id));
  });

  // Domains a navigation was forwarded through, until the request to the final page starts: tab → domains.
  const redirects = new Map<number, string[]>();
  // Tab → site whose visit the latest page load counted, so a page that only forwards elsewhere can be uncounted.
  const newVisit = new Map<number, string>();
  // Emails typed on a page are only kept here, in memory, never stored: tab → values to look for.
  const typed = new Map<number, { values: TypedValue[]; submitted: boolean }>();
  // Recent third-party requests per tab, to check them when an email is reported after it was already sent.
  const recent = new Map<number, { domain: string; url: string; body?: string; at: number }[]>();

  const recordFormLeak = (tabId: number, domain: string, url: string, body: string | undefined) => {
    const t = typed.get(tabId);
    const tab = state.tabs[tabId];
    if (!t || !tab) return;
    const encoding = findTyped(t.values, url, body);
    if (!encoding) return;
    const leaks = (tab.formLeaks ??= {});
    if (Object.hasOwn(leaks, domain) || Object.keys(leaks).length >= 50) return;
    leaks[domain] = { company: tab.parties[domain]?.company ?? null, encoding, beforeSubmit: !t.submitted };
    scheduleSave();
  };

  let icons: Icons = {};
  // Bundled logos of the biggest trackers win over fetched favicons; they also work when the
  // company's website is blocked.
  const iconsReady = loadIcons().then((i) => {
    icons = i;
    for (const [name, logo] of Object.entries(bundledLogos as Record<string, string>)) {
      const home = companyNamed(name)?.home;
      if (home) icons[home] = logo;
    }
    return browser.storage.local.set({ [ICONS_KEY]: icons });
  });
  const pendingIcons = new Map<string, string[]>();
  let iconWorkers = 0;
  let iconSaveTimer: ReturnType<typeof setTimeout> | undefined;

  /** Fetches a domain's favicon once, at most four at a time. */
  const queueIcon = async (domain: string, urls = faviconUrls(domain)) => {
    await iconsReady;
    if (icons[domain] || pendingIcons.has(domain)) return;
    pendingIcons.set(domain, urls);
    while (iconWorkers < 4 && pendingIcons.size) {
      iconWorkers++;
      void (async () => {
        for (const [next, nextUrls] of pendingIcons) {
          pendingIcons.delete(next);
          icons[next] = await fetchIcon(nextUrls, next);
          iconSaveTimer ??= setTimeout(() => {
            iconSaveTimer = undefined;
            browser.storage.local.set({ [ICONS_KEY]: icons });
          }, 500);
          if (!pendingIcons.size) break;
        }
        iconWorkers--;
      })();
    }
  };

  // Safari does not report page loads (main_frame) to webRequest; until one arrives, the tab's new address
  // starts the page instead (tabs.onUpdated below).
  let mainFrameEvents = false;

  /** A page load in a tab: a new session, or one more page of the same site. Call after `ready`. */
  const startPage = (tabId: number, url: string) => {
    const hostname = new URL(url).hostname;
    const domain = getDomain(hostname);
    if (!domain) return;
    const previous = state.tabs[tabId];
    const params = linkParams(url);
    // Clicking around on the same site extends the session instead of starting over, unless the tab was idle.
    const lastActivity = previous ? previous.startedAt + Math.max(0, ...Object.values(previous.parties).map((p) => p.lastSeen ?? p.firstSeen)) : 0;
    if (previous?.site === domain && Date.now() - lastActivity < SAME_VISIT_MS) {
      previous.host = hostname;
      previous.pages = (previous.pages ?? 1) + 1;
      for (const p of params) if (!previous.linkParams?.some((known) => known.name === p.name)) (previous.linkParams ??= []).push(p);
      redirects.delete(tabId);
      newVisit.delete(tabId);
      scheduleSave();
      return;
    }
    const session: TabSession = { site: domain, host: hostname, startedAt: Date.now(), parties: {} };
    if (params.length) session.linkParams = params;
    const hops = (redirects.get(tabId) ?? []).filter((d) => d !== domain);
    if (hops.length) session.redirects = [...new Set(hops)].slice(0, 10);
    redirects.delete(tabId);
    state.tabs[tabId] = session;
    typed.delete(tabId);
    recent.delete(tabId);
    const visit = (state.sites[domain] ??= { visits: 0, lastSeen: 0 });
    visit.visits++;
    visit.lastSeen = Date.now();
    newVisit.set(tabId, domain);
    markBadge(tabId);
    void queueIcon(domain);
    scheduleSave();
  };

  const onRequest = async (details: {
    url: string;
    tabId: number;
    type: string;
    requestBody?: Parameters<typeof bodyText>[0];
  }) => {
    if (details.tabId < 0 || !details.url.startsWith('http')) return;
    if (details.type === 'main_frame') mainFrameEvents = true;
    await ready;

    const hostname = new URL(details.url).hostname;
    // Only registrable domains: this skips IPs and localhost, and keys such as "__proto__"
    // (http://__proto__/ is a valid URL) that would pollute the state objects.
    let domain = getDomain(hostname);
    if (!domain) return;

    if (details.type === 'main_frame') {
      startPage(details.tabId, details.url);
      return;
    }

    const tab = state.tabs[details.tabId];
    if (!tab) return;

    // A subdomain of the site itself can be a disguised tracker; it then counts as that tracker.
    let trackerHost = hostname;
    let cloakedAs: string | undefined;
    if (domain === tab.site) {
      const target = hostname === domain ? null : cloakedTracker(hostname);
      const targetDomain = target ? getDomain(target) : null;
      if (!target || !targetDomain || targetDomain === tab.site) return;
      trackerHost = target;
      cloakedAs = hostname;
      domain = targetDomain;
    }

    const company = companyFor(trackerHost);
    // A site's own CDNs and sister domains (bild.de → bildstatic.de) are not third parties.
    if (!cloakedAs && company && company === companyFor(tab.site)) return;
    if (!state.parties[domain]) {
      // The tracker domain's own favicon is the fallback when the company website has none.
      void queueIcon(domain);
      if (company && company.home !== domain) void queueIcon(company.home);
    }
    const bucket = bucketFor(trackerHost);
    const party = (state.parties[domain] ??= {
      company: company?.name ?? null,
      icon: company?.home ?? domain,
      bucket,
      categories: company?.categories ?? [],
      sites: {},
      requests: 0,
    });
    party.requests++;
    party.bucket = moreInvasive(party.bucket, bucket);
    party.sites[tab.site] = (party.sites[tab.site] ?? 0) + 1;

    const isNew = !Object.hasOwn(tab.parties, domain);
    const seen = (tab.parties[domain] ??= {
      requests: 0,
      firstSeen: Date.now() - tab.startedAt,
      company: party.company,
      icon: party.icon,
      bucket,
    });
    seen.requests++;
    seen.lastSeen = Date.now() - tab.startedAt;
    seen.bucket = moreInvasive(seen.bucket, bucket);
    if (isNew) noteTracking(tab);
    if (cloakedAs && !seen.cloakedAs?.includes(cloakedAs)) seen.cloakedAs = [...(seen.cloakedAs ?? []), cloakedAs].slice(0, 5);
    markBadge(details.tabId);
    const body = bodyText(details.requestBody);
    const { leaks, ids } = findLeaks(details.url, body, tab.host ?? tab.site);
    const pixel = decodePixel(details.url, body);
    if (pixel) {
      const pixels = (tab.pixels ??= []);
      const same = (p: typeof pixel) => p.platform === pixel.platform && p.event === pixel.event && p.detail === pixel.detail && p.cookieless === pixel.cookieless;
      if (!pixels.some(same) && pixels.length < MAX_PIXEL_EVENTS_PER_TAB) pixels.push(pixel);
    }
    recordFormLeak(details.tabId, domain, details.url, body);
    const list = recent.get(details.tabId) ?? [];
    const now = Date.now();
    list.push({ domain, url: details.url.slice(0, 20_000), body: body?.slice(0, 10_000), at: now });
    while (list.length && (now - list[0]!.at > RECENT_MS || list.length > 200)) list.shift();
    recent.set(details.tabId, list);
    if (Object.keys(leaks).length) seen.leaks = { ...leaks, ...seen.leaks };
    if (ids.length) seen.ids = [...new Set([...(seen.ids ?? []), ...ids])].slice(0, 20);
    scheduleSave();
  };

  browser.webRequest.onBeforeRequest.addListener(
    (details) => {
      void onRequest(details);
      return undefined;
    },
    { urls: ['<all_urls>'] },
    ['requestBody'],
  );

  // A page that only forwards elsewhere (nyt.com → nytimes.com, http → https) is not a visit: the
  // request to the target starts the real session.
  const onRedirect = async (details: { url: string; redirectUrl: string; tabId: number }) => {
    if (details.tabId < 0) return;
    await ready;
    const from = getDomain(new URL(details.url).hostname);
    const to = details.redirectUrl.startsWith('http') ? getDomain(new URL(details.redirectUrl).hostname) : null;
    // Domains the click passed through before arriving (t.co → bit.ly → shop), shown on the new page.
    if (from && from !== to) redirects.set(details.tabId, [...(redirects.get(details.tabId) ?? []), from]);
    const visit = from ? state.sites[from] : undefined;
    if (!from || !visit || from === to || newVisit.get(details.tabId) !== from) return;
    newVisit.delete(details.tabId);
    if (Object.keys(state.tabs[details.tabId]?.parties ?? {}).length) return;
    visit.visits--;
    if (visit.visits <= 0) delete state.sites[from];
    scheduleSave();
  };
  // Remembers per site how many companies tracked you after each choice, for the Accept/Reject comparison.
  const noteTracking = (tab: TabSession) => {
    const visit = tab.choice && Object.hasOwn(state.sites, tab.site) ? state.sites[tab.site] : undefined;
    if (!visit || !tab.choice) return;
    const owners = new Set(
      Object.entries(tab.parties)
        .filter(([, p]) => p.bucket && NEEDS_CONSENT.includes(p.bucket))
        .map(([domain, p]) => p.company ?? domain),
    );
    const tracking = (visit.tracking ??= {});
    tracking[tab.choice.kind] = Math.max(tracking[tab.choice.kind] ?? 0, owners.size);
  };

  // Server countries: the IP-to-country table (1.5 MB) is only loaded once a third party answered.
  let geo: Promise<Geo | null> | undefined;
  const geoTable = () =>
    (geo ??= loadGeo((path) => fetch(browser.runtime.getURL(path as Parameters<typeof browser.runtime.getURL>[0])).then((r) => r.arrayBuffer())).catch(() => null));
  browser.webRequest.onResponseStarted.addListener(
    (details) => {
      void (async () => {
        if (details.tabId < 0 || !details.ip) return;
        await ready;
        const tab = state.tabs[details.tabId];
        const domain = getDomain(new URL(details.url).hostname);
        const party = tab && domain && Object.hasOwn(tab.parties, domain) ? tab.parties[domain] : undefined;
        if (!party || party.country) return;
        const country = (await geoTable())?.countryOf(details.ip);
        if (country) {
          party.country = country;
          scheduleSave();
        }
      })();
      return undefined;
    },
    { urls: ['<all_urls>'] },
  );

  const recordCookie = (tab: TabSession, key: string, company: string | null, seconds: number, name?: string) => {
    const cookies = (tab.cookies ??= {});
    const known = Object.hasOwn(cookies, key) ? cookies[key] : undefined;
    if (known && known.seconds >= seconds) return;
    if (!known && Object.keys(cookies).length >= 60) return;
    cookies[key] = name ? { company, name, seconds } : { company, seconds };
    scheduleSave();
  };

  // Cookie lifetimes of third parties. Chrome only shows Set-Cookie headers with "extraHeaders".
  const headerOptions = ['responseHeaders'];
  if ((browser.webRequest as { OnHeadersReceivedOptions?: { EXTRA_HEADERS?: string } }).OnHeadersReceivedOptions?.EXTRA_HEADERS) {
    headerOptions.push('extraHeaders');
  }
  browser.webRequest.onHeadersReceived.addListener(
    (details) => {
      void (async () => {
        if (details.tabId < 0) return;
        const setCookies = (details.responseHeaders ?? []).filter((h) => h.name.toLowerCase() === 'set-cookie' && h.value);
        if (!setCookies.length) return;
        await ready;
        const tab = state.tabs[details.tabId];
        const domain = getDomain(new URL(details.url).hostname);
        if (!tab || !domain || !Object.hasOwn(tab.parties, domain)) return;
        // Firefox joins several Set-Cookie headers with line breaks.
        const lifetimes = setCookies.flatMap((h) => h.value!.split('\n')).map((c) => cookieLifetime(c) ?? 0);
        const seconds = Math.max(...lifetimes);
        if (seconds > 0) recordCookie(tab, domain, tab.parties[domain]!.company, seconds);
      })();
      return undefined;
    },
    { urls: ['<all_urls>'] },
    headerOptions as Parameters<typeof browser.webRequest.onHeadersReceived.addListener>[2],
  );

  browser.webRequest.onBeforeRedirect?.addListener(
    (details) => {
      void onRedirect(details);
      return undefined;
    },
    { urls: ['<all_urls>'], types: ['main_frame'] },
  );

  browser.tabs.onUpdated.addListener((tabId, change) => {
    if (mainFrameEvents || !change.url?.startsWith('http')) return;
    const url = change.url;
    void ready.then(() => startPage(tabId, url));
  });

  // The browser already knows the site's real favicon, which is often not at /favicon.ico.
  browser.tabs.onUpdated.addListener(async (tabId, change) => {
    if (!change.favIconUrl?.startsWith('https:')) return;
    await Promise.all([ready, iconsReady]);
    const site = state.tabs[tabId]?.site;
    if (site && !icons[site]) {
      delete icons[site];
      void queueIcon(site, [change.favIconUrl, ...faviconUrls(site)]);
    }
  });

  browser.tabs.onRemoved.addListener(async (tabId) => {
    typed.delete(tabId);
    redirects.delete(tabId);
    newVisit.delete(tabId);
    recent.delete(tabId);
    await ready;
    delete state.tabs[tabId];
    scheduleSave();
  });

  browser.runtime.onMessage.addListener(async (message: { type: string }, sender) => {
    if (message.type === 'click') {
      await ready;
      const tab = sender.tab?.id !== undefined ? state.tabs[sender.tab.id] : undefined;
      if (tab && tab.firstClick === undefined) {
        tab.firstClick = Date.now() - tab.startedAt;
        scheduleSave();
      }
    } else if (message.type === 'choice') {
      await ready;
      const tab = sender.tab?.id !== undefined ? state.tabs[sender.tab.id] : undefined;
      const choice = (message as { choice?: unknown }).choice;
      // A real click on a banner button wins over what the page reported (which the page could fake).
      if (tab && tab.choice?.source !== 'click' && (choice === 'accept' || choice === 'reject')) {
        tab.choice = { kind: choice as Choice, at: Date.now() - tab.startedAt, source: 'click' };
        noteTracking(tab);
        scheduleSave();
      }
    } else if (message.type === 'typed') {
      const tabId = sender.tab?.id;
      const email = (message as { email?: unknown }).email;
      if (tabId === undefined || typeof email !== 'string' || email.length > 320) return;
      await ready;
      const entry = typed.get(tabId) ?? { values: [], submitted: false };
      if (entry.values.length >= 5) return;
      entry.values.push(await needlesFor(email));
      typed.set(tabId, entry);
      const tab = state.tabs[tabId];
      if (tab) {
        tab.typedEmails = entry.values.length;
        scheduleSave();
      }
      for (const r of recent.get(tabId) ?? []) recordFormLeak(tabId, r.domain, r.url, r.body);
    } else if (message.type === 'submitted') {
      const entry = sender.tab?.id !== undefined ? typed.get(sender.tab.id) : undefined;
      if (entry) entry.submitted = true;
    } else if (message.type === 'page') {
      await ready;
      const tab = sender.tab?.id !== undefined ? state.tabs[sender.tab.id] : undefined;
      if (!tab) return;
      const raw = (
        message as { report?: { kind?: unknown; tcString?: unknown; justChosen?: unknown; technique?: unknown; host?: unknown; sample?: unknown } }
      ).report;
      if (raw?.kind === 'fingerprint') {
        const technique = raw.technique as FingerprintTechnique;
        const domain = typeof raw.host === 'string' && raw.host.length < 254 ? getDomain(raw.host) : null;
        if (!domain || !FINGERPRINT_TECHNIQUES.includes(technique)) return;
        const fingerprints = (tab.fingerprints ??= {});
        if (!Object.hasOwn(fingerprints, domain) && Object.keys(fingerprints).length >= 50) return;
        const entry = (fingerprints[domain] ??= { company: companyFor(raw.host as string)?.name ?? null, techniques: [] });
        if (!entry.techniques.includes(technique)) entry.techniques.push(technique);
        // One example per technique and tab is enough; canvas images are large.
        const sample = raw.sample;
        const hasSample = Object.values(fingerprints).some((f) => f.samples?.[technique]);
        const valid =
          typeof sample === 'string' &&
          (technique === 'canvas' ? /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(sample) && sample.length <= 20_000 : sample.length <= 200);
        if (valid && !hasSample) entry.samples = { ...entry.samples, [technique]: sample };
        scheduleSave();
        return;
      }
      if (raw?.kind === 'cookie') {
        const cookie = (raw as { cookie?: unknown }).cookie;
        if (typeof cookie !== 'string' || cookie.length > 300) return;
        const name = cookieName(cookie);
        const company = companyOfCookie(name);
        const seconds = cookieLifetime(cookie);
        if (company && seconds) recordCookie(tab, `cookie:${name}`, company, seconds, name);
        return;
      }
      if (raw?.kind === 'tcf') {
        // Decoding validates the string; anything that is not a TCF v2 string is dropped.
        const consent = typeof raw.tcString === 'string' && raw.tcString.length < 10_000 ? decodeTcString(raw.tcString) : null;
        if (consent) {
          tab.consent = consent;
          // The banner reports the choice made just now; nothing allowed means "Reject". The report comes from
          // the page, so it may confirm or add a "Reject" but never turn a recorded "Reject" into "Accept".
          if (raw.justChosen === true) {
            const reported: Choice = consent.vendors.length || consent.purposes.length ? 'accept' : 'reject';
            const kind: Choice = tab.choice?.kind === 'reject' ? 'reject' : reported;
            tab.choice = { kind, at: tab.choice?.at ?? Date.now() - tab.startedAt, source: tab.choice?.source ?? 'page' };
            noteTracking(tab);
          }
          scheduleSave();
        }
        return;
      }
      const report = parseReport(raw);
      if (!report) return;
      const auctions = (tab.auctions ??= {});
      const existing = Object.hasOwn(auctions, report.id) ? auctions[report.id] : undefined;
      if (!existing && Object.keys(auctions).length >= MAX_AUCTIONS_PER_TAB) return;
      if (report.kind === 'auction') {
        auctions[report.id] = { ...existing, adUnits: report.adUnits, bidders: report.bidders, bids: report.bids };
      } else {
        auctions[report.id] = {
          ...(existing ?? { adUnits: 0, bidders: [], bids: [] }),
          won: { bidder: report.bidder, cpm: report.cpm, currency: report.currency },
        };
      }
      scheduleSave();
    } else if (message.type === 'reset') {
      await ready;
      state = emptyState();
      await saveState(state);
    }
  });
});
