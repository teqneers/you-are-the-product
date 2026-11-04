import '@/lib/theme.css';
import './style.css';
import { initLanguage, translatePage } from '@/lib/i18n';
import { mountLiveView } from '@/lib/live';

document.documentElement.classList.toggle('safari', import.meta.env.BROWSER === 'safari');

await initLanguage();
translatePage();

const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
mountLiveView(document.getElementById('live')!).show(activeTab?.id ?? -1);

// Opening a side panel must happen synchronously inside the click, so no awaits before it.
const firefoxSidebar = (browser as unknown as { sidebarAction?: { open(): Promise<void> } }).sidebarAction;
const chromeSidePanel = (browser as { sidePanel?: typeof browser.sidePanel }).sidePanel;
const panelButton = document.getElementById('panel')!;
// Safari has neither a side panel nor a sidebar for extensions.
panelButton.hidden = !firefoxSidebar && !chromeSidePanel;
panelButton.addEventListener('click', () => {
  if (firefoxSidebar) firefoxSidebar.open();
  else if (chromeSidePanel && activeTab?.windowId !== undefined) chromeSidePanel.open({ windowId: activeTab.windowId });
  window.close();
});

document.getElementById('open')!.addEventListener('click', () => {
  browser.tabs.create({ url: browser.runtime.getURL('/dashboard.html') });
});
