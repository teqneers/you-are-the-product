import './live.css';
import { watchIcons, type Icons } from './icons';
import { bidderName } from './bidders';
import { BUCKET_LABELS, BUCKET_ORDER, type Bucket } from './buckets';
import { PURPOSES, type Consent } from './tcf';
import { LEAK_LABELS, LEAK_ORDER, LEAK_SHORT, type LeakKind, type Leaks } from './leaks';
import { infrastructureToggle, isVisible, watchSettings, type Settings } from './settings';
import { locale, t } from './i18n';
import { ownerOf, watchState, type State, type TabSession } from './state';
import { vendorName } from './vendor-list';
import { browser } from 'wxt/browser';
import { consentVerdict } from './consent-verdict';
import { identifyingBits, mirrorOf } from './mirror';
import { PIXEL_ACTIONS, type PixelEvent } from './pixels';
import { playReplay, type ReplayTrace } from './replay';
import { cleanLink } from './link-decoration';
import { reachOf, REACH_SOURCE } from './reach';
import { GEO_ATTRIBUTION, isEuEea } from './geo';
import { brokerOf } from './brokers';
import { lifetimeParts } from './cookies';

interface Owner {
  name: string;
  domains: number;
  requests: number;
  /** Domains whose favicon could stand for this owner, best first. */
  icons: string[];
  /** ms after page start this owner first appeared. */
  firstSeen: number;
  /** Personal data found in this owner's requests. */
  leaks: Leaks;
  /** Most invasive group among this owner's domains. */
  bucket: Bucket;
  /** Subdomains of the site this owner hid behind (CNAME cloaking). */
  cloakedAs: string[];
  /** Share of popular websites this owner appears on (WhoTracks.me). */
  reach?: number;
  /** Countries of the servers that answered this owner's requests. */
  countries: string[];
}

const rank = (b: Bucket) => BUCKET_ORDER.indexOf(b);

function ownersOf(session: TabSession, settings: Settings): Owner[] {
  const owners = new Map<string, Owner>();
  for (const [domain, p] of Object.entries(session.parties)) {
    if (!isVisible(p.bucket, settings)) continue;
    const name = ownerOf(domain, p.company);
    const owner =
      owners.get(name) ??
      ({ name, domains: 0, requests: 0, icons: [], firstSeen: Infinity, leaks: {}, bucket: 'cdn', cloakedAs: [], countries: [] } as Owner);
    const bucket = p.bucket ?? 'unknown';
    if (rank(bucket) < rank(owner.bucket)) owner.bucket = bucket;
    owner.icons.unshift(p.icon ?? domain);
    owner.icons.push(domain);
    owner.domains++;
    owner.requests += p.requests;
    owner.firstSeen = Math.min(owner.firstSeen, p.firstSeen);
    owner.leaks = { ...p.leaks, ...owner.leaks };
    owner.cloakedAs.push(...(p.cloakedAs ?? []));
    const reach = reachOf(p.company, domain);
    if (reach !== undefined) owner.reach = Math.max(owner.reach ?? 0, reach);
    if (p.country && !owner.countries.includes(p.country)) owner.countries.push(p.country);
    owners.set(name, owner);
  }
  return [...owners.values()];
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/** Step chart of companies over time since page start, with a marker at the first click. */
function timeline(owners: Owner[], session: TabSession): SVGSVGElement {
  const W = 300;
  const H = 70;
  const elapsed = Math.max(Date.now() - session.startedAt, 5000);
  const times = owners.map((o) => o.firstSeen).sort((a, b) => a - b);
  const x = (ms: number) => (Math.min(ms, elapsed) / elapsed) * W;
  const y = (n: number) => H - (times.length ? (n / times.length) * (H - 6) : 0);

  let d = `M0,${H}`;
  times.forEach((t, i) => (d += ` H${x(t).toFixed(1)} V${y(i + 1).toFixed(1)}`));
  d += ` H${W}`;

  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H + 14}`);
  svg.classList.add('timeline');
  const add = (tag: string, attrs: Record<string, string | number>, text?: string) => {
    const node = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
    if (text) node.textContent = text;
    svg.append(node);
  };
  add('path', { d, class: 'line' });
  if (session.firstClick !== undefined) {
    const cx = x(session.firstClick);
    add('line', { x1: cx, x2: cx, y1: 0, y2: H, class: 'click' });
    const nearEnd = cx > W - 60;
    add(
      'text',
      { x: nearEnd ? cx - 3 : cx + 3, y: 10, class: 'click-label', 'text-anchor': nearEnd ? 'end' : 'start' },
      t('live.yourClick'),
    );
  }
  add('text', { x: 0, y: H + 12 }, '0 s');
  add('text', { x: W, y: H + 12, 'text-anchor': 'end' }, `${Math.round(elapsed / 1000)} s`);
  return svg;
}

const FLASH_MS = 3000;

/** Data that says who you are or what you read; highlighted in red. */
const SENSITIVE: LeakKind[] = ['page', 'id', 'geo', 'referrer'];


const money = (amount: number, currency: string) =>
  amount.toLocaleString(locale(), { style: 'currency', currency: currency || 'EUR', maximumFractionDigits: 4 });

/** The ID of the person handed to the most companies, if more than one got it. */
function sharedId(session: TabSession): { id: string; companies: string[] } | null {
  const owners = new Map<string, Set<string>>();
  for (const [domain, p] of Object.entries(session.parties)) {
    for (const id of p.ids ?? []) {
      const set = owners.get(id) ?? new Set();
      set.add(ownerOf(domain, p.company));
      owners.set(id, set);
    }
  }
  const [id, companies] = [...owners.entries()].sort((a, b) => b[1].size - a[1].size)[0] ?? [];
  return id && companies && companies.size > 1 ? { id, companies: [...companies].sort() } : null;
}

/** Number tile: a big value with a short label underneath. */
function tile(value: string, label: string, className = '') {
  const t = el('div', `tile ${className}`);
  t.append(el('div', 'value', value), el('div', 'tile-label', label));
  return t;
}

/** Horizontal bar split by group, with a legend of counts below. */
function bucketBar(owners: Owner[]) {
  const wrap = el('div', 'bucket-bar');
  const bar = el('div', 'bar');
  const legend = el('div', 'bar-legend');
  for (const b of BUCKET_ORDER) {
    const n = owners.filter((o) => o.bucket === b).length;
    if (!n) continue;
    const seg = el('span', `seg bucket-${b}`);
    seg.style.flexGrow = String(n);
    bar.append(seg);
    const item = el('span', `legend-item bucket-${b}`);
    item.append(el('i'), `${BUCKET_LABELS[b]} ${n}`);
    legend.append(item);
  }
  wrap.append(bar, legend);
  return wrap;
}

/** Details of the Prebid auctions in which this page view was offered to advertisers. */
function soldDetails(session: TabSession) {
  const auctions = Object.values(session.auctions ?? {});
  const bidders = [...new Set(auctions.flatMap((a) => a.bidders).map(bidderName))].sort();
  const top = auctions
    .flatMap((a) => a.bids)
    .filter((b) => b.cpm > 0)
    .sort((a, b) => b.cpm - a.cpm)[0];
  const won = auctions.filter((a) => a.won);

  const body = el('div');
  body.append(el('p', '', t('live.soldText')));
  const facts = el('dl', 'facts');
  facts.append(el('dt', '', t('live.topBid')));
  facts.append(
    el(
      'dd',
      '',
      top
        ? t('live.topBidValue', {
            price: money(top.cpm / 1000, top.currency),
            bidder: bidderName(top.bidder),
            cpm: money(top.cpm, top.currency),
          })
        : t('live.noBids'),
    ),
  );
  if (won.length) {
    facts.append(el('dt', '', t('live.won')));
    facts.append(el('dd', '', won.map((a) => `${bidderName(a.won!.bidder)} (${money(a.won!.cpm / 1000, a.won!.currency)})`).join(', ')));
  }
  const chips = el('div', 'chips');
  for (const b of bidders) chips.append(el('span', 'chip', b));
  body.append(facts, chips);
  return body;
}


/** What the cookie banner recorded: consents, and vendors that claim legitimate interest instead. */
function consentDetails(consent: Consent) {
  const body = el('div');
  body.append(
    el('p', '', t('live.consentText')),
  );
  const facts = el('dl', 'facts');
  facts.append(
    el('dt', '', t('live.consentYes')),
    el('dd', '', t('live.companies', { n: consent.vendors.length })),
    el('dt', '', t('live.consentLi')),
    el('dd', '', t('live.companies', { n: consent.vendorsLegitimateInterest.length })),
  );
  body.append(facts);
  if (consent.purposes.length) {
    body.append(el('p', 'muted', t('live.allowed')));
    const list = el('ul', 'purposes');
    for (const p of consent.purposes) list.append(el('li', '', PURPOSES[p]));
    body.append(list);
  }

  // Company names from IAB's vendor list, shipped with the extension.
  for (const [key, ids] of [
    ['live.yesList', consent.vendors],
    ['live.liList', consent.vendorsLegitimateInterest],
  ] as const) {
    const names = ids.map((id) => vendorName(id)).filter((n): n is string => !!n);
    if (!names.length) continue;
    body.append(el('p', 'muted', t(key)));
    const chips = el('div', 'chips');
    for (const n of names.sort((a, b) => a.localeCompare(b, locale())).slice(0, 40)) chips.append(el('span', 'chip', n));
    if (names.length > 40) chips.append(el('span', 'chip', t('live.more', { n: names.length - 40 })));
    body.append(chips);
  }
  return body;
}

/** Scripts that measured the browser to build a fingerprint, with the techniques they used. */
function fingerprintDetails(session: TabSession) {
  const body = el('div');
  body.append(el('p', '', t('live.fpText')));
  const list = el('dl', 'facts');
  for (const [domain, f] of Object.entries(session.fingerprints ?? {})) {
    list.append(el('dt', '', ownerOf(domain, f.company)), el('dd', '', f.techniques.map((x) => t(`fp.${x}`)).join(', ')));
  }
  body.append(list);

  // The mirror: what these scripts could read about this very browser.
  const entries = Object.values(session.fingerprints ?? {});
  const techniques = new Set(entries.flatMap((f) => f.techniques));
  const gpu = entries.map((f) => f.samples?.webgl).find(Boolean);
  const canvas = entries.map((f) => f.samples?.canvas).find(Boolean);
  const rows = mirrorOf(techniques, gpu);
  body.append(el('h5', '', t('live.fpMirror')));
  const mirror = el('dl', 'facts mirror');
  for (const [key, value] of rows) {
    const shown = key === 'canvas' ? t('mirror.canvasValue') : key === 'fonts' ? t('mirror.fontsValue') : value;
    mirror.append(el('dt', '', t(`mirror.${key}`)), el('dd', '', shown));
  }
  body.append(mirror);
  if (canvas) {
    const figure = el('figure', 'fp-sample');
    figure.append(Object.assign(el('img'), { src: canvas, alt: '' }), el('figcaption', 'muted', t('live.fpCanvas')));
    body.append(figure);
  }
  const { bits, people } = identifyingBits(rows.map(([key]) => key));
  body.append(el('p', 'muted', t('live.fpBits', { bits, people: people.toLocaleString(locale(), { notation: 'compact' }) })));
  return body;
}

/** One line per reported pixel event: platform, what you did, product or search, price, attached personal data. */
function pixelDetails(events: PixelEvent[]) {
  const body = el('div');
  body.append(el('p', '', t('live.pixelsText')));
  const order = (e: PixelEvent) => (e.action ? PIXEL_ACTIONS.indexOf(e.action) : PIXEL_ACTIONS.length);
  const list = el('ul', 'pixel-list');
  for (const e of [...events].sort((a, b) => order(a) - order(b))) {
    const item = el('li');
    item.append(el('strong', '', e.platform), ' ', e.action ? t(`pixel.${e.action}`) : e.event);
    if (e.detail) item.append(' · ', el('q', '', e.detail));
    if (e.value) item.append(' · ', e.value);
    if (e.cookieless) item.append(el('div', 'muted', t('live.pixelCookieless')));
    if (e.matching?.length) {
      item.append(el('div', 'tag sensitive', t('live.pixelMatching', { fields: e.matching.map((m) => t(`match.${m}`)).join(', ') })));
    }
    list.append(item);
  }
  body.append(list);
  return body;
}

/** The companies on this page ranked by how many popular websites they are on. */
function reachDetails(owners: Owner[]) {
  const body = el('div');
  body.append(el('p', '', t('live.reachText')));
  const percent = new Intl.NumberFormat(locale(), { style: 'percent', maximumFractionDigits: 0 });
  for (const o of owners.filter((o) => o.reach !== undefined).sort((a, b) => b.reach! - a.reach!).slice(0, 12)) {
    const row = el('div', 'compare-row');
    const track = el('div', 'compare-track');
    const bar = el('div', 'compare-bar');
    bar.style.width = `${Math.max(2, o.reach! * 100)}%`;
    track.append(bar);
    row.append(el('span', 'compare-label', o.name), track, el('strong', '', percent.format(o.reach!)));
    body.append(row);
  }
  body.append(sourceNote(t('live.reachSource', { month: REACH_SOURCE.month }), REACH_SOURCE.url, `${REACH_SOURCE.name}, CC BY 4.0`));
  return body;
}

/** Countries whose servers received requests, outside the EU/EEA first. */
function countryDetails(owners: Owner[]) {
  const body = el('div');
  body.append(el('p', '', t('live.countryText')));
  const byCountry = new Map<string, string[]>();
  for (const o of owners) for (const c of o.countries) byCountry.set(c, [...(byCountry.get(c) ?? []), o.name]);
  let names: Intl.DisplayNames | undefined;
  try {
    names = new Intl.DisplayNames(locale(), { type: 'region' });
  } catch {}
  const list = el('dl', 'facts countries');
  const sorted = [...byCountry].sort(([a, x], [b, y]) => Number(isEuEea(a)) - Number(isEuEea(b)) || y.length - x.length);
  for (const [code, companies] of sorted) {
    const flag = String.fromCodePoint(...[...code].map((ch) => 0x1f1a5 + ch.charCodeAt(0)));
    const dt = el('dt', isEuEea(code) ? '' : 'outside', `${flag} ${names?.of(code) ?? code}`);
    list.append(dt, el('dd', '', companies.join(', ')));
  }
  body.append(list, el('p', 'muted', t('live.countryNote')));
  body.append(sourceNote('', GEO_ATTRIBUTION.url, GEO_ATTRIBUTION.text));
  return body;
}

/** Small attribution line with a link, as the data licences require. */
function sourceNote(text: string, url: string, label: string) {
  const note = el('p', 'muted source');
  if (text) note.append(`${text} `);
  const link = Object.assign(el('a', '', label), { href: url, target: '_blank', rel: 'noopener' });
  note.append(link);
  return note;
}

/** "3 years", "4 months", "90 days" in the current language. */
function duration(seconds: number) {
  const { n, unit } = lifetimeParts(seconds);
  return t(`time.${unit}`, { count: n, n: new Intl.NumberFormat(locale()).format(n) });
}

/** How many companies tracked you on this site after "Accept" and after "Reject", from earlier visits too. */
function comparison(tracking?: Partial<Record<'accept' | 'reject', number>>) {
  const box = el('div', 'comparison');
  const accept = tracking?.accept;
  const reject = tracking?.reject;
  if (accept === undefined || reject === undefined) {
    box.append(el('p', 'muted', t('live.compareHint')));
    return box;
  }
  box.append(el('p', '', t('live.compareTitle')));
  const max = Math.max(accept, reject, 1);
  for (const [label, n, cls] of [
    [t('live.compareAccept'), accept, 'accept'],
    [t('live.compareReject'), reject, 'reject'],
  ] as const) {
    const row = el('div', `compare-row ${cls}`);
    const bar = el('div', 'compare-bar');
    bar.style.width = `${Math.max(2, (n / max) * 100)}%`;
    row.append(el('span', 'compare-label', label), el('div', 'compare-track'), el('strong', '', String(n)));
    row.children[1]!.append(bar);
    box.append(row);
  }
  return box;
}

/** Tracking parameters in the address and the domains the click was forwarded through. */
function linkDetails(params: NonNullable<TabSession['linkParams']>, hops: string[], copyBox: HTMLElement | null) {
  const body = el('div');
  if (params.length) {
    body.append(el('p', '', t('live.linkText')));
    const list = el('dl', 'facts');
    for (const p of params) {
      const dt = el('dt');
      dt.append(el('code', '', p.name));
      list.append(dt, el('dd', '', t(p.kind === 'click' ? 'live.linkClick' : 'live.linkCampaign', { company: p.company })));
    }
    body.append(list);
  }
  if (hops.length) {
    body.append(el('p', '', t('live.redirectText', { n: hops.length })));
    const chips = el('div', 'chips');
    for (const d of hops) chips.append(el('span', 'chip', d));
    body.append(chips);
  }
  if (copyBox) body.append(copyBox);
  return body;
}

/** The longest-lived tracking cookies on this page. */
function cookieDetails(cookies: [string, NonNullable<TabSession['cookies']>[string]][]) {
  const body = el('div');
  body.append(el('p', '', t('live.cookieText')));
  const list = el('ul', 'cookie-list');
  const date = new Intl.DateTimeFormat(locale(), { month: 'short', year: 'numeric' });
  for (const [key, c] of cookies.slice(0, 15)) {
    const item = el('li');
    item.append(el('strong', '', c.company ?? key));
    if (c.name) item.append(' ', el('code', 'muted', c.name.length > 20 ? `${c.name.slice(0, 19)}…` : c.name));
    item.append(el('div', '', t('live.cookieUntil', { time: duration(c.seconds), date: date.format(Date.now() + c.seconds * 1000) })));
    list.append(item);
  }
  body.append(list, el('p', 'muted', t('live.cookieNote')));
  return body;
}

/** Invites to type an email into a form; once one was typed, says that it is being watched. */
function tryForm(typedEmails: number) {
  const box = el('div', typedEmails ? 'try-form watching' : 'try-form');
  box.append(
    el('strong', '', typedEmails ? t('live.typedTitle') : t('live.tryTitle')),
    el('p', '', typedEmails ? t('live.typedText') : t('live.tryText')),
  );
  return box;
}

/** Companies that received an email typed into a form, and how it was encoded. */
function formDetails(leaks: NonNullable<TabSession['formLeaks']>) {
  const body = el('div');
  body.append(el('p', '', t('live.formText')));
  const list = el('dl', 'facts');
  for (const [domain, leak] of Object.entries(leaks)) {
    const when = leak.beforeSubmit ? t('live.formBeforeSubmit') : t('live.formAfterSubmit');
    list.append(el('dt', '', ownerOf(domain, leak.company)), el('dd', '', `${t(`encoding.${leak.encoding}`)}, ${when}`));
  }
  body.append(list);
  return body;
}

/** Tracking before the cookie banner choice and after "Reject". */
function verdictDetails(verdict: NonNullable<ReturnType<typeof consentVerdict>>, tracking?: Partial<Record<'accept' | 'reject', number>>) {
  const body = el('div');
  const names = (list: string[]) => {
    const chips = el('div', 'chips');
    for (const n of list.slice(0, 40)) chips.append(el('span', 'chip', n));
    if (list.length > 40) chips.append(el('span', 'chip', t('live.more', { n: list.length - 40 })));
    return chips;
  };
  if (verdict.afterReject.length) {
    body.append(el('p', 'verdict', t('live.verdictAfter', { n: verdict.afterReject.length })), names(verdict.afterReject));
  }
  if (verdict.beforeChoice.length) {
    body.append(el('p', 'verdict', t('live.verdictBefore', { n: verdict.beforeChoice.length })), names(verdict.beforeChoice));
  }
  if (!verdict.afterReject.length && !verdict.beforeChoice.length) body.append(el('p', '', t('live.verdictClean')));
  body.append(comparison(tracking));
  body.append(el('p', 'muted', t('live.verdictNote')));
  return body;
}

function sharedIdDetails(shared: { id: string; companies: string[] }) {
  const body = el('div');
  body.append(
    el('p', '', t('live.sharedText')),
    el('code', '', shared.id.length > 40 ? `${shared.id.slice(0, 40)}…` : shared.id),
  );
  const chips = el('div', 'chips');
  for (const c of shared.companies) chips.append(el('span', 'chip', c));
  body.append(chips);
  return body;
}

/** The element that scrolls this view: the side panel's main area, or the popup document. */
function scrollParent(node: HTMLElement): HTMLElement | null {
  for (let n = node.parentElement; n; n = n.parentElement) {
    const overflow = getComputedStyle(n).overflowY;
    if ((overflow === 'auto' || overflow === 'scroll') && n.scrollHeight > n.clientHeight) return n;
  }
  return document.scrollingElement as HTMLElement | null;
}

/** Live counter for one tab, shared by the popup and the side panel. */
export function mountLiveView(root: HTMLElement) {
  let tabId = -1;
  let state: State | undefined;
  let icons: Icons = {};
  let settings: Settings = { hideInfrastructure: true };
  // The content re-renders several times a second; the checkbox lives outside it so clicks are not lost.
  const toggleHost = el('div');
  const content = el('div');
  root.replaceChildren(toggleHost, content);
  let sessionKey = '';
  /** Owner → when this view first showed it; owners present on first render are not highlighted. */
  let appearedAt = new Map<string, number>();
  /** Expanded rows and sections ("owner:Google", "sold", …). */
  const open = new Set<string>();
  // The replay keeps running across re-renders, so its elements are created once and moved into each render.
  const replayBox = el('div', 'replay');
  const replayButton = el('button', 'replay-button');
  const replayCanvas = el('canvas');
  const replayInfo = el('p', 'muted');
  let stopReplay = () => {};
  replayButton.addEventListener('click', async () => {
    stopReplay();
    replayInfo.textContent = '';
    try {
      const trace = (await browser.tabs.sendMessage(tabId, { type: 'replay-trace' })) as ReplayTrace | undefined;
      if (!trace?.points.length) {
        replayInfo.textContent = t('live.replayEmpty');
        return;
      }
      const tab = await browser.tabs.get(tabId);
      let screenshot: HTMLImageElement | null = null;
      try {
        const src = await browser.tabs.captureVisibleTab(tab.windowId!, { format: 'jpeg', quality: 60 });
        screenshot = Object.assign(new Image(), { src });
        await screenshot.decode();
      } catch {
        screenshot = null;
      }
      replayInfo.textContent = t('live.replayKeys', { n: trace.keys });
      replayBox.classList.add('playing');
      stopReplay = playReplay(replayCanvas, trace, screenshot);
    } catch {
      replayInfo.textContent = t('live.replayUnavailable');
    }
  });
  replayBox.append(replayButton, replayCanvas, replayInfo);
  // "Copy clean link" also survives re-renders.
  const copyBox = el('div', 'copy-link');
  const copyButton = el('button');
  const copyInfo = el('span', 'muted');
  copyButton.addEventListener('click', async () => {
    try {
      const tab = await browser.tabs.get(tabId);
      await navigator.clipboard.writeText(cleanLink(tab.url!));
      copyInfo.textContent = t('live.linkCopied');
    } catch {
      copyInfo.textContent = t('live.linkCopyFailed');
    }
  });
  copyBox.append(copyButton, copyInfo);

  function render() {
    // Until the stored state is read, "no data" would be wrong; Safari takes a moment to read it.
    if (!state) return;
    const session = state.tabs[tabId];
    if (!session) {
      content.replaceChildren(el('p', 'muted', t('live.noData')));
      return;
    }

    const owners = ownersOf(session, settings);
    const key = `${tabId}:${session.startedAt}`;
    const now = Date.now();
    if (key !== sessionKey) {
      stopReplay();
      replayBox.classList.remove('playing');
      replayInfo.textContent = '';
      copyInfo.textContent = '';
      sessionKey = key;
      appearedAt = new Map(owners.map((o) => [o.name, 0]));
    }
    for (const o of owners) if (!appearedAt.has(o.name)) appearedAt.set(o.name, now);

    const requests = owners.reduce((sum, o) => sum + o.requests, 0);
    const domains = owners.reduce((sum, o) => sum + o.domains, 0);
    const afterClick =
      session.firstClick === undefined ? null : owners.filter((o) => o.firstSeen > session.firstClick!).length;
    const knowsPage = owners.filter((o) => o.leaks.page).length;
    const withId = owners.filter((o) => o.leaks.id).length;
    const auctions = Object.values(session.auctions ?? {});
    const bidders = new Set(auctions.flatMap((a) => a.bidders).map(bidderName)).size;
    const shared = sharedId(session);

    const stats = el('div', 'stats');
    const main = tile(String(owners.length), t('live.watching', { count: owners.length }), 'main');
    main.append(el('div', 'tile-sub', `${t('live.domains', { n: domains })} · ${t('live.requests', { n: requests })}`));
    stats.append(
      main,
      afterClick === null ? tile('–', t('live.clickPrompt'), 'muted') : tile(`+${afterClick}`, t('live.afterClick', { count: afterClick })),
      tile(String(knowsPage), t('live.knowsPage', { count: knowsPage })),
      tile(String(withId), t('live.haveId', { count: withId })),
    );
    if (auctions.length) stats.append(tile(String(bidders), t('live.bidders', { n: auctions.length })));
    if (shared) stats.append(tile(String(shared.companies.length), t('live.sharedId')));
    const fingerprinters = Object.entries(session.fingerprints ?? {});
    if (fingerprinters.length) stats.append(tile(String(fingerprinters.length), t('live.fingerprinting', { count: fingerprinters.length })));
    const cloaked = owners.filter((o) => o.cloakedAs.length).length;
    if (cloaked) stats.append(tile(String(cloaked), t('live.cloaked', { count: cloaked })));
    const fingerprintOwners = new Set(fingerprinters.map(([domain, f]) => ownerOf(domain, f.company)));
    const pixels = session.pixels ?? [];
    if (pixels.length) stats.append(tile(String(pixels.length), t('live.pixels', { count: pixels.length })));
    const formLeaks = Object.entries(session.formLeaks ?? {});
    if (formLeaks.length) stats.append(tile(String(formLeaks.length), t('live.formLeak', { count: formLeaks.length }), 'alarm'));
    const verdict = consentVerdict(session, ownerOf);
    if (verdict?.afterReject.length) stats.append(tile(String(verdict.afterReject.length), t('live.afterReject', { count: verdict.afterReject.length }), 'alarm'));
    if (verdict?.beforeChoice.length) stats.append(tile(String(verdict.beforeChoice.length), t('live.beforeChoice', { count: verdict.beforeChoice.length })));
    if (owners.some((o) => (o.reach ?? 0) >= 0.5)) {
      const n = owners.filter((o) => (o.reach ?? 0) >= 0.5).length;
      stats.append(tile(String(n), t('live.reachTile', { count: n })));
    }
    const brokers = owners.filter((o) => brokerOf(o.name)).length;
    if (brokers) stats.append(tile(String(brokers), t('live.brokerTile', { count: brokers }), 'alarm'));
    const outsideEu = owners.filter((o) => o.countries.some((c) => !isEuEea(c))).length;
    if (outsideEu) stats.append(tile(String(outsideEu), t('live.countryTile', { count: outsideEu })));
    const recorders = owners.filter((o) => o.bucket === 'session').map((o) => o.name);
    const consent = session.consent;
    if (consent) {
      stats.append(
        tile(String(consent.vendors.length), t('live.consented', { count: consent.vendors.length })),
        tile(String(consent.vendorsLegitimateInterest.length), t('live.legitimate', { count: consent.vendorsLegitimateInterest.length })),
      );
    }

    const sections = el('div', 'sections');
    if (formLeaks.length) {
      sections.append(section('form', t('live.formTitle'), t('live.formSummary', { n: formLeaks.length }), () => formDetails(session.formLeaks!)));
    }
    if (verdict) {
      const summary =
        verdict.choice === 'reject' ? t('live.verdictSummaryReject') : verdict.choice === 'accept' ? t('live.verdictSummaryAccept') : t('live.verdictSummaryNone');
      const tracking = Object.hasOwn(state!.sites, session.site) ? state!.sites[session.site]!.tracking : undefined;
      const box = section('verdict', t('live.verdictTitle'), summary, () => verdictDetails(verdict, tracking));
      box.classList.toggle('clean', !verdict.beforeChoice.length && !verdict.afterReject.length);
      sections.append(box);
    }
    if (recorders.length) {
      sections.append(
        section('replay', t('live.replayTitle'), t('live.replaySummary', { n: recorders.length }), () => {
          const body = el('div');
          const chips = el('div', 'chips');
          for (const name of recorders) chips.append(el('span', 'chip', name));
          replayButton.textContent = t('live.replayButton');
          body.append(el('p', '', t('live.replayText')), chips, replayBox);
          return body;
        }),
      );
    }
    if (pixels.length) {
      sections.append(section('pixels', t('live.pixelsTitle'), t('live.pixelsSummary', { n: pixels.length }), () => pixelDetails(pixels)));
    }
    const linkParams = session.linkParams ?? [];
    const hops = session.redirects ?? [];
    if (linkParams.length || hops.length) {
      copyButton.textContent = t('live.linkCopy');
      sections.append(
        section('links', t('live.linkTitle'), t('live.linkSummary', { n: linkParams.length + hops.length }), () =>
          linkDetails(linkParams, hops, linkParams.length ? copyBox : null),
        ),
      );
    }
    const cookies = Object.entries(session.cookies ?? {}).sort(([, a], [, b]) => b.seconds - a.seconds);
    if (cookies.length) {
      sections.append(
        section('cookies', t('live.cookieTitle'), t('live.cookieSummary', { time: duration(cookies[0]![1].seconds) }), () =>
          cookieDetails(cookies),
        ),
      );
    }
    const farReaching = owners.filter((o) => (o.reach ?? 0) >= 0.5);
    if (farReaching.length) {
      sections.append(
        section('reach', t('live.reachTitle'), t('live.reachSummary', { n: farReaching.length }), () => reachDetails(owners)),
      );
    }
    const located = owners.filter((o) => o.countries.length);
    const abroad = located.filter((o) => o.countries.some((c) => !isEuEea(c)));
    if (located.length) {
      sections.append(
        section('countries', t('live.countryTitle'), t('live.countrySummary', { n: abroad.length }), () => countryDetails(located)),
      );
    }
    if (auctions.length) {
      sections.append(section('sold', 'Sold.', t('live.soldSummary', { n: auctions.length, bidders }), () => soldDetails(session)));
    }
    if (fingerprinters.length) {
      sections.append(
        section('fp', t('live.fpTitle'), t('live.fpSummary', { n: fingerprinters.length }), () => fingerprintDetails(session)),
      );
    }
    if (consent) {
      sections.append(
        section(
          'consent',
          t('live.consentTitle'),
          t('live.consentSummary', { yes: consent.vendors.length, li: consent.vendorsLegitimateInterest.length }),
          () => consentDetails(consent),
        ),
      );
    }
    if (shared) {
      sections.append(section('shared', t('live.sharedTitle'), t('live.sharedSummary', { n: shared.companies.length }), () => sharedIdDetails(shared)));
    }

    const table = el('div', 'owner-table');
    const head = el('div', 'owner-row head');
    head.append(el('span'), el('span', '', t('live.colCompany')), el('span', '', t('live.colGets')), el('span', 'num', t('live.colRequests')));
    table.append(head);
    for (const o of owners.sort((a, b) => b.requests - a.requests)) {
      const kinds = LEAK_ORDER.filter((k) => o.leaks[k]);
      const broker = brokerOf(o.name);
      const expandable = kinds.length > 0 || o.cloakedAs.length > 0 || !!broker;
      const row = el('div', expandable ? 'owner-row clickable' : 'owner-row');
      const age = now - appearedAt.get(o.name)!;
      if (age < FLASH_MS) row.style.background = `rgb(255 77 94 / ${0.6 * (1 - age / FLASH_MS)})`;
      // An empty placeholder keeps the names aligned when a logo is missing.
      const src = o.icons.map((d) => icons[d]).find(Boolean);
      const logo = src ? Object.assign(el('img', 'logo'), { src }) : el('span', 'logo');
      const name = el('div', 'name');
      name.append(el('div', '', o.name), el('div', `category bucket-${o.bucket}`, BUCKET_LABELS[o.bucket]));
      const data = el('div', 'data');
      if (broker) data.append(el('span', 'tag sensitive', t('live.brokerTag')));
      if (o.cloakedAs.length) data.append(el('span', 'tag sensitive', t('leakShort.cloaked')));
      if (fingerprintOwners.has(o.name)) data.append(el('span', 'tag sensitive', t('leakShort.fp')));
      for (const k of kinds) data.append(el('span', SENSITIVE.includes(k) ? 'tag sensitive' : 'tag', LEAK_SHORT[k]));
      row.append(logo, name, data, el('span', 'num', String(o.requests)));
      table.append(row);

      if (expandable) {
        // The view re-renders several times a second, so a click (down + up on the same node)
        // would often get lost; toggling on pointerdown is reliable.
        makeToggle(row, `owner:${o.name}`);
        if (open.has(`owner:${o.name}`)) {
          const details = el('dl', 'leaks');
          if (broker) {
            const registries = broker.registries.map((r) => t(`registry.${r}` as Parameters<typeof t>[0])).join(', ');
            details.append(el('dt', '', t('live.brokerTag')), el('dd', '', t('live.brokerText', { name: broker.registeredAs, registries })));
          }
          if (o.cloakedAs.length) details.append(el('dt', '', t('live.cloakedAs')), el('dd', '', o.cloakedAs.join(', ')));
          for (const k of kinds) details.append(el('dt', '', LEAK_LABELS[k]), el('dd', '', o.leaks[k]!));
          table.append(details);
        }
      }
    }

    // Re-rendering replaces every node; keep the reader's scroll position wherever they scrolled.
    const scroller = scrollParent(root);
    const scrollTop = scroller?.scrollTop ?? 0;
    const focused = (document.activeElement as HTMLElement | null)?.dataset.toggle;
    content.replaceChildren(
      el('p', 'site muted', (session.pages ?? 1) > 1 ? `${session.site} · ${t('live.pages', { n: session.pages! })}` : session.site),
      stats,
      bucketBar(owners),
      el('h4', '', t('live.timeline')),
      timeline(owners, session),
      sections,
      el('h4', '', t('live.whoWatches')),
      el('p', 'hint muted', t('live.tapHint')),
      table,
      ...(formLeaks.length ? [] : [tryForm(session.typedEmails ?? 0)]),
    );
    if (scroller && scroller.scrollTop !== scrollTop) scroller.scrollTop = scrollTop;
    // The re-render replaced the focused element; move focus to its replacement.
    if (focused) content.querySelector<HTMLElement>(`[data-toggle="${CSS.escape(focused)}"]`)?.focus({ preventScroll: true });
  }

  /** Expands/collapses on pointer down (clicks get lost in re-renders) and on Enter/Space. */
  function makeToggle(element: HTMLElement, key: string) {
    element.dataset.toggle = key;
    element.tabIndex = 0;
    element.setAttribute('role', 'button');
    element.setAttribute('aria-expanded', String(open.has(key)));
    element.addEventListener('pointerdown', () => toggle(key));
    element.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      toggle(key);
    });
  }

  function toggle(key: string) {
    if (open.has(key)) open.delete(key);
    else open.add(key);
    render();
  }

  /** Collapsible block with a one-line summary; collapsed by default. */
  function section(key: string, title: string, summary: string, body: () => HTMLElement) {
    const box = el('section', `fold fold-${key}`);
    const header = el('div', 'fold-header');
    header.append(el('span', 'fold-arrow', open.has(key) ? '▾' : '▸'), el('strong', '', title), el('span', 'muted', summary));
    makeToggle(header, key);
    box.append(header);
    if (open.has(key)) box.append(body());
    return box;
  }

  watchState((s) => {
    state = s;
    render();
  });
  watchIcons((i) => {
    icons = i;
    render();
  });
  watchSettings((next) => {
    settings = next;
    toggleHost.replaceChildren(infrastructureToggle(settings));
    render();
  });
  // Keeps the time axis moving and fades the highlight of new owners.
  setInterval(render, 250);

  return {
    show(id: number) {
      tabId = id;
      render();
    },
  };
}
