import { labels } from './i18n';

/** Kinds of personal data that can be recognised in a tracker request. */
export type LeakKind = 'page' | 'referrer' | 'id' | 'consent' | 'screen' | 'lang' | 'tz' | 'ua' | 'geo';

/** Kind → one example value, as it was sent. */
export type Leaks = Partial<Record<LeakKind, string>>;

export const LEAK_LABELS = labels<LeakKind>('leak');

/** Short labels for the tags in the company list. */
export const LEAK_SHORT = labels<LeakKind>('leakShort');

/** Order in which kinds are shown, most revealing first. */
export const LEAK_ORDER: LeakKind[] = ['page', 'id', 'referrer', 'geo', 'ua', 'screen', 'lang', 'tz', 'consent'];

const UUID = /^[a-z]?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** IDs of a single auction, ad slot or request: random, but they do not identify the person. */
const NOT_A_PERSON =
  /auction|transaction|request|pagesession|(^|\.)tid$|(^|\.)imp(\.|$)|impression|bid.?id|(^|\.)key$|license|slot|placement|adunit|creative|source$|^id$/;
/** Keys that clearly hold an ID of the person; their values are the best examples to show. */
const PERSON_ID = /user|uid|visitor|cookie|fpid|ppid|id5|tdid|eids|_ga|client.?id/;

function classify(key: string, value: string, pageHost: string): LeakKind | null {
  const k = key.toLowerCase();
  if (pageHost && value.includes(pageHost)) return /ref/.test(k) ? 'referrer' : 'page';
  if (/ref/.test(k) && /^https?:/.test(value)) return 'referrer';
  if (/gdpr|consent|tcf|us_privacy|gpp/.test(k) && value.length > 20) return 'consent';
  if (/(^|[^a-z])(lat|lon|lng|geo)([^a-z]|$)/.test(k) && /\d/.test(value)) return 'geo';
  if (value.includes('Mozilla/5.0') || /(^ua$|user.?agent)/.test(k)) return 'ua';
  if (/^\d{3,4}\s*[x×*]\s*\d{3,4}$/.test(value) || (/^(sr|res|screen|sw|sh|vp|viewport)/.test(k) && /^\d/.test(value)))
    return 'screen';
  if (/^[a-z]{2}[-_][A-Za-z]{2}$/.test(value) || (/^(ul|lang|language|hl)$/.test(k) && value.length <= 10)) return 'lang';
  if (/^(Europe|America|Asia|Africa|Australia)\/[A-Za-z_]+$/.test(value) || /^(tz|timezone)$/.test(k)) return 'tz';
  if (NOT_A_PERSON.test(k) || /^[\d.]+$/.test(value)) return null;
  if (UUID.test(value)) return 'id';
  if (
    value.length >= 8 &&
    /(^|[_.\-])(uid|cid|id5|tdid|fpid|ppid|buyeruid|eids?|user.?id|visitor|client.?id|_ga|guid|uuid|cookie)/.test(k)
  )
    return 'id';
  if (/id$/.test(k) && /^[A-Za-z0-9_\-.]{16,}$/.test(value) && /\d/.test(value) && /[a-z]/i.test(value)) return 'id';
  return null;
}

/** Flattens JSON into [path, value] pairs, e.g. { site: { page: "…" } } → ["site.page", "…"]. */
function flatten(value: unknown, path: string, out: [string, string][]) {
  if (out.length > 400) return;
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) flatten(v, Array.isArray(value) ? path : path ? `${path}.${k}` : k, out);
  } else if (value !== null && value !== undefined) {
    out.push([path, String(value)]);
  }
}

function pairsOf(text: string): [string, string][] {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const out: [string, string][] = [];
      flatten(JSON.parse(trimmed), '', out);
      return out;
    } catch {}
  }
  try {
    return [...new URLSearchParams(trimmed)];
  } catch {
    return [];
  }
}

/**
 * Finds personal data in a request's URL parameters and body. `ids` are the raw values of person IDs,
 * to spot the same ID being handed to several companies.
 */
export function findLeaks(url: string, body: string | undefined, pageHost: string): { leaks: Leaks; ids: string[] } {
  const leaks: Leaks = {};
  const ids = new Set<string>();
  let pairs: [string, string][] = [];
  try {
    pairs = [...new URL(url).searchParams];
  } catch {}
  if (body) pairs.push(...pairsOf(body.slice(0, 50_000)));
  for (const [key, raw] of pairs) {
    let value = raw;
    try {
      value = decodeURIComponent(raw);
    } catch {}
    const kind = classify(key, value, pageHost);
    if (!kind) continue;
    const example = `${key}=${value.length > 90 ? `${value.slice(0, 90)}…` : value}`;
    const personKey = PERSON_ID.test(key.toLowerCase());
    if (kind === 'id' && personKey && value.length >= 16) ids.add(value);
    const better = kind === 'id' && personKey && !PERSON_ID.test((leaks.id ?? '').split('=')[0]!.toLowerCase());
    if (!leaks[kind] || better) leaks[kind] = example;
  }
  return { leaks, ids: [...ids].slice(0, 10) };
}

/** Request body as text, from the webRequest requestBody details. */
export function bodyText(body: { formData?: Record<string, unknown[]>; raw?: { bytes?: unknown }[] } | undefined) {
  if (!body) return undefined;
  if (body.formData) {
    const pairs = Object.entries(body.formData).flatMap(([k, vs]) =>
      vs.filter((v): v is string => typeof v === 'string').map((v) => [k, v]),
    );
    return new URLSearchParams(pairs).toString();
  }
  const bytes = body.raw?.[0]?.bytes;
  return bytes instanceof ArrayBuffer && bytes.byteLength < 100_000 ? new TextDecoder().decode(bytes) : undefined;
}
