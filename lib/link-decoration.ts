/**
 * Tracking parameters that links carry ("link decoration"): click IDs tie the visit to one particular click on an
 * ad or a shared post, campaign tags only say where the visitor came from.
 */

export type LinkParamKind = 'click' | 'campaign';

export interface LinkParam {
  /** Parameter name as found in the address, e.g. "fbclid". */
  name: string;
  company: string;
  kind: LinkParamKind;
}

const CLICK_IDS: [RegExp, string][] = [
  [/^fbclid$/, 'Facebook'],
  [/^(gclid|gclsrc|dclid|gbraid|wbraid|_gl)$/, 'Google'],
  [/^msclkid$/, 'Microsoft'],
  [/^ttclid$/, 'TikTok'],
  [/^twclid$/, 'X'],
  [/^li_fat_id$/, 'LinkedIn'],
  [/^(igshid|igsh)$/, 'Instagram'],
  [/^epik$/, 'Pinterest'],
  [/^(sccid|ScCid)$/, 'Snapchat'],
  [/^yclid$/, 'Yandex'],
  [/^(mc_eid|mc_cid)$/, 'Mailchimp'],
  [/^(_hsenc|_hsmi|__hssc|__hstc|__hsfp|hsCtaTracking)$/, 'HubSpot'],
  [/^mkt_tok$/, 'Marketo'],
  [/^_kx$/, 'Klaviyo'],
  [/^(irclickid|irgwc)$/, 'Impact'],
  [/^awc$/, 'Awin'],
  [/^s_cid$/, 'Adobe'],
  [/^(oly_enc_id|oly_anon_id)$/, 'Omeda'],
  [/^vero_id$/, 'Vero'],
  [/^rb_clickid$/, 'Rakuten'],
];

const CAMPAIGN = /^(utm_[a-z_]+|mtm_[a-z_]+|pk_[a-z_]+)$/;

/** Tracking parameters in a page address, in the order they appear. */
export function linkParams(url: string): LinkParam[] {
  let params: URLSearchParams;
  try {
    params = new URL(url).searchParams;
  } catch {
    return [];
  }
  const found: LinkParam[] = [];
  for (const name of new Set(params.keys())) {
    const click = CLICK_IDS.find(([re]) => re.test(name));
    if (click) found.push({ name, company: click[1], kind: 'click' });
    else if (CAMPAIGN.test(name)) found.push({ name, company: name.startsWith('utm_') ? 'Google Analytics' : 'Matomo', kind: 'campaign' });
  }
  return found;
}

/** The address without the tracking parameters, for sharing. */
export function cleanLink(url: string): string {
  const parsed = new URL(url);
  for (const { name } of linkParams(url)) parsed.searchParams.delete(name);
  return parsed.href;
}
