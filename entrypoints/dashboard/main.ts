import '@/lib/theme.css';
import './style.css';
import { createGraph, type GroupBy } from '@/lib/graph';
import { initLanguage, languageSelect, reloadOnLanguageChange, richText, t, translatePage } from '@/lib/i18n';
import { watchIcons, type Icons } from '@/lib/icons';
import { infrastructureToggle, isVisible, watchSettings, type Settings } from '@/lib/settings';
import { ownerOf, watchState, type State } from '@/lib/state';
import { categoryOf, SENSITIVE, type SiteCategory } from '@/lib/site-categories';
import { brokerOf } from '@/lib/brokers';

await initLanguage();
translatePage();
reloadOnLanguageChange();
document.getElementById('language')!.replaceChildren(languageSelect());

let groupBy: GroupBy = 'company';
let latest: State | undefined;
let icons: Icons = {};
let settings: Settings = { hideInfrastructure: true };

let selected: { label: string; kind: 'site' | 'party' } | undefined;
const graph = createGraph(document.querySelector<SVGSVGElement>('#graph')!, {
  onSelect: (label, kind) => {
    selected = { label, kind };
    if (latest) renderProfile(latest);
  },
});

/** "What Google knows about you": the sites a company saw you on, or the companies on a site. */
function renderProfile(state: State) {
  const box = document.getElementById('profile')!;
  if (!selected) {
    box.hidden = true;
    return;
  }
  const { label, kind } = selected;
  const rows = new Map<string, number>();
  for (const [domain, party] of Object.entries(state.parties)) {
    if (!isVisible(party.bucket, settings)) continue;
    const name = groupBy === 'company' ? ownerOf(domain, party.company) : domain;
    for (const [site, requests] of Object.entries(party.sites)) {
      if (kind === 'party' && name === label) rows.set(site, (rows.get(site) ?? 0) + requests);
      if (kind === 'site' && site === label) rows.set(name, (rows.get(name) ?? 0) + requests);
    }
  }
  document.getElementById('profile-title')!.textContent = t(kind === 'party' ? 'profile.party' : 'profile.site', { name: label });
  document.getElementById('profile-text')!.textContent = t(kind === 'party' ? 'profile.partyText' : 'profile.siteText', {
    n: rows.size,
  });
  document.getElementById('profile-list')!.replaceChildren(
    ...[...rows.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, requests]) => {
        const li = document.createElement('li');
        li.textContent = name;
        const count = Object.assign(document.createElement('span'), { className: 'muted', textContent: ` ${t('live.requests', { n: requests })}` });
        li.append(count);
        return li;
      }),
  );
  document.getElementById('profile-week')!.replaceChildren(...(kind === 'party' ? weekProfile(state, label, [...rows.keys()]) : []));
  box.hidden = false;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** "This week Google saw you on 3 health sites and 2 job sites", plus a data broker note. */
function weekProfile(state: State, company: string, sites: string[]): HTMLElement[] {
  const parts: HTMLElement[] = [];
  const broker = brokerOf(company);
  if (broker) {
    parts.push(
      Object.assign(document.createElement('p'), {
        className: 'broker',
        textContent: t('profile.broker', {
          name: broker.registeredAs,
          registries: broker.registries.map((r) => t(`registry.${r}` as Parameters<typeof t>[0])).join(', '),
        }),
      }),
    );
  }
  const since = Date.now() - WEEK_MS;
  const counts = new Map<SiteCategory, number>();
  for (const site of sites) {
    const category = (state.sites[site]?.lastSeen ?? 0) >= since ? categoryOf(site) : null;
    if (category) counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  if (!counts.size) return parts;
  parts.push(Object.assign(document.createElement('p'), { className: 'small', textContent: t('profile.week', { name: company }) }));
  const chips = document.createElement('div');
  chips.className = 'chips';
  for (const [category, n] of [...counts].sort((a, b) => Number(SENSITIVE.has(b[0])) - Number(SENSITIVE.has(a[0])) || b[1] - a[1])) {
    chips.append(
      Object.assign(document.createElement('span'), {
        className: SENSITIVE.has(category) ? 'chip sensitive' : 'chip',
        textContent: t('profile.categoryCount', { count: n, n, category: t(`category.${category}`) }),
      }),
    );
  }
  parts.push(chips);
  if ([...counts.keys()].some((c) => SENSITIVE.has(c))) {
    parts.push(Object.assign(document.createElement('p'), { className: 'muted small', textContent: t('profile.sensitiveNote') }));
  }
  return parts;
}

document.getElementById('profile-close')!.addEventListener('click', () => {
  selected = undefined;
  if (latest) renderProfile(latest);
});
const renderGraph = (state: State) => graph.render(state, groupBy, icons, settings);

watchSettings((next) => {
  settings = next;
  document.getElementById('infra')!.replaceChildren(infrastructureToggle(settings));
  if (latest) {
    renderGraph(latest);
    renderSidebar(latest);
  }
});

watchIcons((next) => {
  icons = next;
  render();
});

function renderSidebar(state: State) {
  const siteCount = Object.keys(state.sites).length;
  const owners = new Map<string, Set<string>>();
  let domains = 0;
  for (const [domain, party] of Object.entries(state.parties)) {
    if (!isVisible(party.bucket, settings)) continue;
    domains++;
    const owner = ownerOf(domain, party.company);
    const sites = owners.get(owner) ?? new Set();
    for (const site of Object.keys(party.sites)) sites.add(site);
    owners.set(owner, sites);
  }

  const headline = document.getElementById('headline')!;
  if (siteCount) {
    const parts = () => [
      ...richText(`${t('dash.headlineSites', { n: siteCount })} ${t('dash.headlineCompanies', { n: owners.size })} `),
      Object.assign(document.createElement('small'), { textContent: t('panel.summaryDomains', { n: domains }) }),
    ];
    headline.replaceChildren(...parts());
    document.getElementById('present-headline')!.replaceChildren(...parts());
  }

  const top = [...owners.entries()].sort((a, b) => b[1].size - a[1].size).slice(0, 10);
  document.getElementById('top')!.replaceChildren(
    ...top.map(([owner, sites]) => {
      const li = document.createElement('li');
      const share = siteCount ? sites.size / siteCount : 0;
      const name = document.createElement('div');
      name.textContent = owner;
      const meta = document.createElement('span');
      meta.className = 'muted';
      meta.textContent = t('dash.onSites', { n: sites.size, total: siteCount, count: siteCount });
      const bar = document.createElement('div');
      bar.className = 'bar';
      bar.style.width = `${Math.round(share * 100)}%`;
      li.append(name, meta, bar);
      li.className = 'selectable';
      li.addEventListener('click', () => {
        selected = { label: owner, kind: 'party' };
        renderProfile(state);
      });
      return li;
    }),
  );
}

let scheduled = false;
function render() {
  if (scheduled || !latest) return;
  scheduled = true;
  setTimeout(() => {
    scheduled = false;
    renderGraph(latest!);
    renderSidebar(latest!);
    renderProfile(latest!);
  }, 1000);
}

watchState((state) => {
  const first = !latest;
  latest = state;
  if (first) {
    renderGraph(state);
    renderSidebar(state);
  } else render();
});

document.querySelectorAll<HTMLInputElement>('input[name=group]').forEach((input) =>
  input.addEventListener('change', () => {
    groupBy = input.value as GroupBy;
    if (latest) renderGraph(latest);
  }),
);

document.getElementById('export')!.addEventListener('click', async () => {
  const caption = `You Are The Product · ${document.getElementById('headline')!.textContent}`;
  const blob = await graph.snapshot(caption);
  const link = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: `you-are-the-product-${new Date().toISOString().slice(0, 10)}.png`,
  });
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
});

// Presentation: the graph alone in full screen with a big headline, for a projector.
document.getElementById('present')!.addEventListener('click', () => {
  document.body.classList.add('presenting');
  document.documentElement.requestFullscreen?.().catch(() => {});
  if (latest) renderGraph(latest);
});
document.addEventListener('fullscreenchange', () => {
  if (document.fullscreenElement) return;
  document.body.classList.remove('presenting');
  if (latest) renderGraph(latest);
});
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.body.classList.contains('presenting')) {
    document.body.classList.remove('presenting');
    if (latest) renderGraph(latest);
  }
});
addEventListener('resize', () => latest && renderGraph(latest));

document.getElementById('reset')!.addEventListener('click', async () => {
  if (!confirm(t('common.confirmDelete'))) return;
  await browser.runtime.sendMessage({ type: 'reset' });
});
