import { browser } from 'wxt/browser';
import { INFRASTRUCTURE, type Bucket } from './buckets';
import { t } from './i18n';

export interface Settings {
  /** Hide CDNs, embedded content and cookie banners, so only actual tracking is counted. */
  hideInfrastructure: boolean;
}

const SETTINGS_KEY = 'settings';
const DEFAULTS: Settings = { hideInfrastructure: true };

export async function loadSettings(): Promise<Settings> {
  return { ...DEFAULTS, ...((await browser.storage.local.get(SETTINGS_KEY))[SETTINGS_KEY] as Partial<Settings>) };
}

export async function saveSettings(change: Partial<Settings>) {
  await browser.storage.local.set({ [SETTINGS_KEY]: { ...(await loadSettings()), ...change } });
}

/** Calls `onChange` with the settings now and whenever they change. */
export function watchSettings(onChange: (settings: Settings) => void) {
  loadSettings().then(onChange);
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[SETTINGS_KEY]) onChange({ ...DEFAULTS, ...(changes[SETTINGS_KEY].newValue as Partial<Settings>) });
  });
}

/** Whether a party in this group is shown and counted. Old data without a group counts as unknown. */
export const isVisible = (bucket: Bucket | undefined, settings: Settings) =>
  !(settings.hideInfrastructure && INFRASTRUCTURE.includes(bucket ?? 'unknown'));

/** Checkbox that toggles hideInfrastructure. */
export function infrastructureToggle(settings: Settings) {
  const label = document.createElement('label');
  label.className = 'infra-toggle';
  const box = Object.assign(document.createElement('input'), { type: 'checkbox', checked: settings.hideInfrastructure });
  box.addEventListener('change', () => saveSettings({ hideInfrastructure: box.checked }));
  label.append(box, ` ${t('settings.hideInfra')}`);
  return label;
}
