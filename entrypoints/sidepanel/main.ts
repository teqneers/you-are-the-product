import '@/lib/theme.css';
import './style.css';
import { createGraph } from '@/lib/graph';
import { initLanguage, languageSelect, reloadOnLanguageChange, t, translatePage } from '@/lib/i18n';
import { watchIcons, type Icons } from '@/lib/icons';
import { mountLiveView } from '@/lib/live';
import { isVisible, watchSettings, type Settings } from '@/lib/settings';
import { ownerOf, watchState, type State } from '@/lib/state';

await initLanguage();
translatePage();
reloadOnLanguageChange();
document.getElementById('language')!.replaceChildren(languageSelect());

type View = 'list' | 'graph';

const VIEW_KEY = 'sidepanel-view';
const live = mountLiveView(document.getElementById('live')!);
const graph = createGraph(document.querySelector<SVGSVGElement>('#graph')!);

let view: View = 'list';
let tabId = -1;
let latest: State | undefined;
let icons: Icons = {};
let settings: Settings = { hideInfrastructure: true };
let graphTimer: ReturnType<typeof setTimeout> | undefined;

function renderGraph() {
  if (view !== 'graph' || !latest) return;
  const visible = Object.entries(latest.parties).filter(([, p]) => isVisible(p.bucket, settings));
  const owners = new Set(visible.map(([d, p]) => ownerOf(d, p.company)));
  // One sentence per count, so each gets its own singular or plural.
  document.getElementById('graph-summary')!.textContent = [
    t('panel.summarySites', { n: Object.keys(latest.sites).length }),
    t('panel.summaryCompanies', { n: owners.size }),
    t('panel.summaryDomains', { n: visible.length }),
  ].join(' ');
  graph.render(latest, 'company', icons, settings, latest.tabs[tabId]?.site);
}

/** Graph layout is expensive, so live updates are batched to once per second. */
function scheduleGraph() {
  graphTimer ??= setTimeout(() => {
    graphTimer = undefined;
    renderGraph();
  }, 1000);
}

function setView(next: View) {
  view = next;
  document.querySelectorAll<HTMLButtonElement>('.switch button[data-view]').forEach((b) =>
    b.classList.toggle('active', b.dataset.view === next),
  );
  document.getElementById('list-view')!.hidden = next !== 'list';
  document.getElementById('graph-view')!.hidden = next !== 'graph';
  try {
    localStorage.setItem(VIEW_KEY, next);
  } catch {}
  renderGraph();
}

// The side panel stays open while browsing, so it follows whichever tab is active.
async function followActiveTab() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  tabId = tab?.id ?? -1;
  live.show(tabId);
  renderGraph();
}

watchState((state) => {
  latest = state;
  scheduleGraph();
});
watchSettings((next) => {
  settings = next;
  scheduleGraph();
});
watchIcons((next) => {
  icons = next;
  scheduleGraph();
});
followActiveTab();
browser.tabs.onActivated.addListener(followActiveTab);
browser.windows.onFocusChanged.addListener(followActiveTab);
addEventListener('resize', renderGraph);

document.querySelectorAll<HTMLButtonElement>('.switch button[data-view]').forEach((b) =>
  b.addEventListener('click', () => setView(b.dataset.view as View)),
);
try {
  if (localStorage.getItem(VIEW_KEY) === 'graph') setView('graph');
} catch {}

document.getElementById('reset')!.addEventListener('click', async () => {
  if (!confirm(t('common.confirmDelete'))) return;
  await browser.runtime.sendMessage({ type: 'reset' });
});

document.getElementById('open')!.addEventListener('click', () => {
  browser.tabs.create({ url: browser.runtime.getURL('/dashboard.html') });
});
