/**
 * How long tracking cookies are meant to live. Third parties set them with a Set-Cookie header; many tracking
 * scripts also store their ID in the visited site's own cookies (Google's _ga, Facebook's _fbp), recognised by name.
 */

const DAY = 86_400;

/** Lifetime in seconds requested by a Set-Cookie header or document.cookie string; null for a session cookie. */
export function cookieLifetime(cookie: string, now = Date.now()): number | null {
  const attributes = cookie.split(';').slice(1).map((part) => part.trim());
  for (const attribute of attributes) {
    const [key = '', value = ''] = attribute.split('=', 2);
    if (key.toLowerCase() === 'max-age') {
      const seconds = Number(value);
      return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
    }
  }
  for (const attribute of attributes) {
    const [key = '', ...rest] = attribute.split('=');
    if (key.toLowerCase() !== 'expires') continue;
    const at = Date.parse(rest.join('='));
    return Number.isFinite(at) && at > now ? Math.round((at - now) / 1000) : null;
  }
  return null;
}

/** Name of the cookie in a Set-Cookie header or document.cookie string. */
export const cookieName = (cookie: string) => cookie.slice(0, cookie.indexOf('=')).trim();

/** Cookies that tracking scripts set on the visited site itself, by name. */
const KNOWN: [RegExp, string][] = [
  [/^(_ga|_ga_[A-Z0-9]+|_gid|_gcl_au|_gcl_aw|__gads|__gpi|__eoi)$/, 'Google'],
  [/^(_fbp|_fbc)$/, 'Facebook'],
  [/^(_ttp|_tt_enable_cookie|ttcsid.*)$/, 'TikTok'],
  [/^(_pin_unauth|_pinterest_ct_ua|_epik)$/, 'Pinterest'],
  [/^(_uetsid|_uetvid|_clck|_clsk|MUID)$/, 'Microsoft'],
  [/^(_hjSessionUser_\d+|_hjid|_hjFirstSeen)$/, 'Hotjar'],
  [/^(_scid|_sctr|_scid_r)$/, 'Snapchat'],
  [/^(li_fat_id|_li_dcdm_c|li_gc)$/, 'LinkedIn'],
  [/^cto_bundle$/, 'Criteo'],
  [/^_parsely_visitor$/, 'Parse.ly'],
  [/^ajs_anonymous_id$/, 'Segment'],
  [/^(mp_.+_mixpanel)$/, 'Mixpanel'],
  [/^(AMP_[0-9a-f]+|amplitude_id.*)$/, 'Amplitude'],
  [/^(_pk_id\..+)$/, 'Matomo'],
  [/^(_cs_id|_cs_c)$/, 'Contentsquare'],
];

/** Company whose tracking script uses this first-party cookie name. */
export function companyOfCookie(name: string): string | null {
  return KNOWN.find(([re]) => re.test(name))?.[1] ?? null;
}

/** Rough human unit: { n, unit } in years (≥ 1 year), months (≥ 2 months) or days. */
export function lifetimeParts(seconds: number): { n: number; unit: 'years' | 'months' | 'days' } {
  const days = seconds / DAY;
  if (days >= 365) return { n: Math.round((days / 365) * 10) / 10, unit: 'years' };
  if (days >= 60) return { n: Math.round(days / 30), unit: 'months' };
  return { n: Math.max(1, Math.round(days)), unit: 'days' };
}
