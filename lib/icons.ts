import { browser } from 'wxt/browser';

/** Domain → favicon as a 32px PNG data URL, or '' if the domain has none. */
export type Icons = Record<string, string>;

export const ICONS_KEY = 'icons';

export async function loadIcons(): Promise<Icons> {
  return ((await browser.storage.local.get(ICONS_KEY))[ICONS_KEY] as Icons | undefined) ?? {};
}

/** Calls `onChange` with the icons now and whenever new ones arrive. */
export function watchIcons(onChange: (icons: Icons) => void) {
  loadIcons().then(onChange);
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[ICONS_KEY]) onChange((changes[ICONS_KEY].newValue as Icons) ?? {});
  });
}
