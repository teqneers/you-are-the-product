import { browser } from 'wxt/browser';

/**
 * A quiet "rate or share" hint in the overview. It waits until the extension has been used for a while, and a
 * closed hint comes back later, because people close things by accident, for example while presenting. After the
 * third close, or once someone rated or shared, it stays away for good.
 */
export interface Nudge {
  /** When the overview was first opened. */
  firstSeen: number;
  /** Not shown before this time. */
  snoozedUntil?: number;
  /** How often the hint was closed. */
  closed?: number;
  /** Rated or shared: no more hints. */
  done?: boolean;
}

const DAY = 24 * 60 * 60 * 1000;
/** Days of use and visited sites before the first hint: by then the extension has shown something. */
export const MIN_DAYS = 3;
export const MIN_SITES = 20;
/** Days until a closed hint comes back, by the number of times it was closed. */
const COMEBACK_DAYS = [14, 60];

export const shouldShow = (nudge: Nudge, sites: number, now: number) =>
  !nudge.done &&
  sites >= MIN_SITES &&
  now >= nudge.firstSeen + MIN_DAYS * DAY &&
  now >= (nudge.snoozedUntil ?? 0);

/** The state after closing the hint: back in 14 days, then in 60 days, then never. */
export function close(nudge: Nudge, now: number): Nudge {
  const closed = (nudge.closed ?? 0) + 1;
  const days = COMEBACK_DAYS[closed - 1];
  return days === undefined ? { ...nudge, closed, done: true } : { ...nudge, closed, snoozedUntil: now + days * DAY };
}

const NUDGE_KEY = 'nudge';

export async function loadNudge(now = Date.now()): Promise<Nudge> {
  const stored = (await browser.storage.local.get(NUDGE_KEY))[NUDGE_KEY] as Nudge | undefined;
  if (stored) return stored;
  const nudge = { firstSeen: now };
  await saveNudge(nudge);
  return nudge;
}

export const saveNudge = (nudge: Nudge) => browser.storage.local.set({ [NUDGE_KEY]: nudge });

export const WEBSITE = 'https://teqneers.github.io/you-are-the-product/';

/** Where to leave a rating in the store this build comes from. */
export function reviewUrl(): string {
  if (import.meta.env.BROWSER === 'firefox') return 'https://addons.mozilla.org/firefox/addon/you-are-the-product/reviews/';
  if (import.meta.env.BROWSER === 'safari') return 'https://apps.apple.com/app/id6830843567?action=write-review';
  return 'https://chromewebstore.google.com/detail/you-are-the-product/abjemhhjkaelkbiabifhfccpcdmmbiag/reviews';
}
