/** Prebid bidder codes → the company behind them. Unknown codes are shown as they are. */
const BIDDERS: Record<string, string> = {
  adf: 'Adform',
  adform: 'Adform',
  aduptech: 'Ad Up Technology',
  adnami: 'Adnami',
  amx: 'AMX',
  appnexus: 'Xandr (Microsoft)',
  aps: 'Amazon',
  amazon: 'Amazon',
  criteo: 'Criteo',
  gumgum: 'GumGum',
  improvedigital: 'Improve Digital',
  ix: 'Index Exchange',
  medianet: 'Media.net',
  openx: 'OpenX',
  orbidder: 'Orbidder (Otto Group)',
  outbrain: 'Outbrain',
  pubmatic: 'PubMatic',
  rubicon: 'Magnite',
  sharethrough: 'Sharethrough',
  smartadserver: 'Equativ',
  sovrn: 'Sovrn',
  taboola: 'Taboola',
  teads: 'Teads',
  triplelift: 'TripleLift',
  ttd: 'The Trade Desk',
  yieldlab: 'Yieldlab',
};

/** "pubmatic_s2s" → "PubMatic"; server-side variants count as the same bidder. */
export const bidderName = (code: string) => {
  const base = code.replace(/_s2s$/, '');
  return BIDDERS[base] ?? base;
};
