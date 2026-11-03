/**
 * Decodes the events that ad and analytics "pixels" report: what you did on the page (viewed a product, added it
 * to the cart, searched for something, bought something), with the product, price and search terms, and which
 * personal fields were attached for "advanced matching" (usually hashed).
 */

export type PixelPlatform = 'Meta' | 'Google' | 'TikTok' | 'Pinterest' | 'Snapchat' | 'LinkedIn' | 'X';

/** Normalised kinds of events; anything else is shown by its raw name. */
export type PixelAction = 'view' | 'product' | 'search' | 'cart' | 'checkout' | 'purchase' | 'lead' | 'signup';
export const PIXEL_ACTIONS: PixelAction[] = ['purchase', 'checkout', 'cart', 'search', 'product', 'lead', 'signup', 'view'];

/** Personal data sent for "advanced matching", hashed or not. */
export type MatchField = 'email' | 'phone' | 'name' | 'address' | 'birthdate' | 'gender' | 'externalId';

export interface PixelEvent {
  platform: PixelPlatform;
  /** Raw event name as sent, e.g. "AddToCart" or "add_to_cart". */
  event: string;
  action?: PixelAction;
  /** Product name, ids or search terms. */
  detail?: string;
  /** Price, e.g. "89.90 EUR". */
  value?: string;
  matching?: MatchField[];
  /** Sent while Google Consent Mode said "denied": no cookies, but the visit is still reported. */
  cookieless?: boolean;
}

const ACTIONS: [RegExp, PixelAction][] = [
  [/^(purchase|complete_?payment|checkout_?completed?|conversion)$/i, 'purchase'],
  [/^(initiate_?checkout|begin_?checkout|add_?payment_?info|add_?shipping_?info|checkout)$/i, 'checkout'],
  [/^(add_?to_?cart|add_?to_?wishlist)$/i, 'cart'],
  [/^(search|view_?search_?results)$/i, 'search'],
  [/^(view_?content|view_?item|page_?visit|product_?view)$/i, 'product'],
  [/^(lead|generate_?lead|contact|submit_?form|subscribe)$/i, 'lead'],
  [/^(complete_?registration|sign_?up|login)$/i, 'signup'],
  [/^(page_?view|pageview|page)$/i, 'view'],
];

export const actionOf = (event: string) => ACTIONS.find(([re]) => re.test(event))?.[1];

const MATCH_KEYS: [RegExp, MatchField][] = [
  [/^(em|email|sha256_email_address|hashed_email|email_address)$/i, 'email'],
  [/^(ph|phone|phone_number|sha256_phone_number|hashed_phone)$/i, 'phone'],
  [/^(fn|ln|first_?name|last_?name)$/i, 'name'],
  [/^(ct|st|zp|country|city|zip|postal_code|street)$/i, 'address'],
  [/^(db|dob|birthdate)$/i, 'birthdate'],
  [/^(ge|gender)$/i, 'gender'],
  [/^(external_id|ext_?id)$/i, 'externalId'],
];

const matchField = (key: string) => MATCH_KEYS.find(([re]) => re.test(key))?.[1];

const short = (text: string, max = 80) => (text.length > max ? `${text.slice(0, max)}…` : text);

const money = (value: string | undefined, currency: string | undefined) => {
  if (!value || !/^\d+(\.\d+)?$/.test(value.trim())) return undefined;
  return currency && /^[A-Z]{3}$/i.test(currency) ? `${value.trim()} ${currency.toUpperCase()}` : value.trim();
};

function paramsOf(url: URL, body: string | undefined): URLSearchParams {
  const params = new URLSearchParams(url.search);
  if (body && !body.trim().startsWith('{')) {
    try {
      for (const [k, v] of new URLSearchParams(body)) params.append(k, v);
    } catch {}
  }
  return params;
}

function jsonOf(body: string | undefined): any {
  if (!body?.trim().startsWith('{')) return undefined;
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

function event(platform: PixelPlatform, name: string | null | undefined, rest: Omit<PixelEvent, 'platform' | 'event'>) {
  if (!name) return null;
  const e: PixelEvent = { platform, event: short(name, 40), action: actionOf(name) };
  if (rest.detail) e.detail = short(rest.detail);
  if (rest.value) e.value = rest.value;
  if (rest.matching?.length) e.matching = [...new Set(rest.matching)];
  if (rest.cookieless) e.cookieless = true;
  return e;
}

/** Meta pixel: facebook.com/tr?ev=AddToCart&cd[value]=…&ud[em]=<sha256>. */
function meta(params: URLSearchParams) {
  const cd = (k: string) => params.get(`cd[${k}]`) ?? undefined;
  const matching = [...params.keys()]
    .map((k) => k.match(/^ud\[(\w+)\]$/)?.[1])
    .filter((k): k is string => !!k)
    .map(matchField)
    .filter((f): f is MatchField => !!f);
  return event('Meta', params.get('ev'), {
    detail: cd('search_string') ?? cd('content_name') ?? cd('content_ids'),
    value: money(cd('value'), cd('currency')),
    matching,
  });
}

/** Google Consent Mode state "gcs=G1<ad_storage><analytics_storage>", 1 = granted, 0 = denied. */
const denied = (params: URLSearchParams, position: 2 | 3) => /^G1[01]{2}$/.test(params.get('gcs') ?? '') && params.get('gcs')![position] === '0';

/** Google Analytics 4: …/g/collect?en=add_to_cart&epn.value=…&cu=EUR&pr1=id…~nm<name>. */
function ga4(params: URLSearchParams) {
  const product = params.get('pr1')?.split('~').find((part) => part.startsWith('nm'))?.slice(2);
  const em = params.get('em');
  return event('Google', params.get('en'), {
    detail: params.get('ep.search_term') ?? product ?? undefined,
    value: money(params.get('epn.value') ?? undefined, params.get('cu') ?? undefined),
    // "tv.1~em.<hash>~ph.<hash>": field name before the dot, "tv" is the format version.
    matching: (em ?? '')
      .split('~')
      .map((part) => part.split('.')[0] ?? '')
      .filter((key) => key && key !== 'tv')
      .map((key) => matchField(key) ?? 'email'),
    cookieless: denied(params, 3),
  });
}

/** Google Ads conversion: googleads…/pagead/conversion/<id>/?value=…&currency_code=…&em=… */
function googleAds(params: URLSearchParams) {
  return event('Google', params.get('label') ? 'conversion' : 'remarketing', {
    value: money(params.get('value') ?? undefined, params.get('currency_code') ?? undefined),
    matching: params.get('em') ? ['email'] : [],
    cookieless: denied(params, 2),
  });
}

/** TikTok pixel: JSON body { event, properties: { value, currency, contents }, context: { user: { email } } }. */
function tiktok(json: any) {
  if (!json || typeof json !== 'object') return null;
  const props = json.properties ?? {};
  const user = json.context?.user ?? {};
  const contents = Array.isArray(props.contents) ? props.contents : [];
  return event('TikTok', typeof json.event === 'string' ? json.event : undefined, {
    detail: typeof props.query === 'string' ? props.query : contents.map((c: any) => c?.content_name).filter(Boolean).join(', '),
    value: money(props.value === undefined ? undefined : String(props.value), props.currency),
    matching: Object.keys(user)
      .map(matchField)
      .filter((f): f is MatchField => !!f),
  });
}

/** Pinterest tag: ct.pinterest.com/v3/?event=checkout&ed={"value":…,"currency":…}&pd={"em":…} */
function pinterest(params: URLSearchParams) {
  let ed: any = {};
  let pd: any = {};
  try {
    ed = JSON.parse(params.get('ed') ?? '{}');
  } catch {}
  try {
    pd = JSON.parse(params.get('pd') ?? '{}');
  } catch {}
  return event('Pinterest', params.get('event'), {
    detail: typeof ed.search_query === 'string' ? ed.search_query : undefined,
    value: money(ed.value === undefined ? undefined : String(ed.value), ed.currency),
    matching: Object.keys(pd ?? {})
      .map(matchField)
      .filter((f): f is MatchField => !!f),
  });
}

/** Snap pixel: tr.snapchat.com/p with ev=PAGE_VIEW&u_hem=<hashed email>. */
function snap(params: URLSearchParams) {
  return event('Snapchat', params.get('ev'), {
    value: money(params.get('price') ?? undefined, params.get('currency') ?? undefined),
    matching: [params.get('u_hem') && 'email', params.get('u_hpn') && 'phone'].filter((f): f is MatchField => !!f),
  });
}

/** Returns the event a pixel request reports, or null if the request is not a known pixel. */
export function decodePixel(rawUrl: string, body?: string): PixelEvent | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  const host = url.hostname;
  const path = url.pathname;
  const params = () => paramsOf(url, body);
  if (/(^|\.)facebook\.com$/.test(host) && /^\/tr\/?$/.test(path)) return meta(params());
  if (/(^|\.)google-analytics\.com$|(^|\.)analytics\.google\.com$/.test(host) && /\/g\/collect$/.test(path)) return ga4(params());
  if (/(^|\.)(googleadservices\.com|googleads\.g\.doubleclick\.net)$/.test(host) && /\/pagead\/(viewthrough)?conversion\//.test(path))
    return googleAds(params());
  if (/(^|\.)analytics\.tiktok\.com$/.test(host) && /\/api\/v2\/pixel/.test(path)) return tiktok(jsonOf(body));
  if (/(^|\.)ct\.pinterest\.com$/.test(host)) return pinterest(params());
  if (/(^|\.)tr\.snapchat\.com$/.test(host)) return snap(params());
  if (/(^|\.)px\.ads\.linkedin\.com$/.test(host) && /\/collect/.test(path)) {
    return event('LinkedIn', url.searchParams.get('conversionId') ? 'conversion' : 'page_view', {});
  }
  if (/(^|\.)analytics\.twitter\.com$|(^|\.)t\.co$/.test(host) && /\/i\/adsct/.test(path)) {
    return event('X', url.searchParams.get('events') ? 'conversion' : 'page_view', {});
  }
  return null;
}
