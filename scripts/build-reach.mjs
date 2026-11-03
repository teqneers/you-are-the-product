// Downloads the latest monthly WhoTracks.me dataset (by Ghostery, CC BY 4.0) and writes data/reach.json:
// for each company and third-party domain, the share of popular websites it appears on.
//
// Metric: WhoTracks.me's `site_reach_top10k` (number of the 10,000 most visited sites in the month that
// load the tracker on more than 1 % of their page loads) divided by 10,000.
//
// WhoTracks.me names companies by its own ids (e.g. "google"). They are matched to the company names in
// data/trackers.json (DuckDuckGo's list) through their tracker domains, taken from Ghostery's TrackerDB.
// When several WhoTracks.me companies map to one name, the highest reach wins (no summing, as the same
// site would be counted twice).
import { readFileSync, writeFileSync } from 'node:fs';

const BUCKET = 'https://s3.amazonaws.com/data.whotracks.me';
const TRACKERDB = 'https://github.com/ghostery/trackerdb/releases/latest/download/trackerdb.json';
const TOP_SITES = 10_000;
const MIN_REACH = 0.001;
const OUT = new URL('../data/reach.json', import.meta.url);

const { companies, domains: ddgDomains } = JSON.parse(readFileSync(new URL('../data/trackers.json', import.meta.url)));

async function get(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res;
}

/** Most recent month (YYYY-MM) that has a global dataset in the bucket. */
async function latestMonth() {
  const xml = await (await get(`${BUCKET}?list-type=2&delimiter=/`)).text();
  const months = [...xml.matchAll(/<Prefix>(\d{4}-\d{2})\/<\/Prefix>/g)].map((m) => m[1]).sort().reverse();
  for (const month of months) {
    const res = await fetch(`${BUCKET}/${month}/global/companies.csv`, { method: 'HEAD' });
    if (res.ok) return month;
  }
  throw new Error('No WhoTracks.me month found');
}

/** Minimal CSV parser (the files have no quoted fields with commas, but handle quotes anyway). */
function parseCsv(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line) continue;
    const cells = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (quoted) {
        if (ch === '"' && line[i + 1] === '"') (cell += '"'), i++;
        else if (ch === '"') quoted = false;
        else cell += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ',') cells.push(cell), (cell = '');
      else cell += ch;
    }
    cells.push(cell);
    rows.push(cells);
  }
  const [header, ...body] = rows;
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

const csv = async (month, file) => parseCsv(await (await get(`${BUCKET}/${month}/global/${file}.csv`)).text());

const siteReach = (row) => Number(row.site_reach_top10k) / TOP_SITES;
const round = (x) => Math.round(x * 1000) / 1000;

/** Company name in data/trackers.json for a hostname, walking up its labels. */
function ddgCompany(hostname) {
  let host = hostname;
  while (host.includes('.')) {
    const i = ddgDomains[host];
    if (i !== undefined) return companies[i]?.name;
    host = host.slice(host.indexOf('.') + 1);
  }
  return undefined;
}

const month = await latestMonth();
const [wtmCompanies, wtmDomains, trackerdb] = await Promise.all([
  csv(month, 'companies'),
  csv(month, 'domains'),
  get(TRACKERDB).then((r) => r.json()),
]);

// WhoTracks.me company id → tracker domains. A company id is a TrackerDB organization, or a tracker
// (pattern) without an organization.
const domainsOf = new Map();
for (const [id, pattern] of Object.entries(trackerdb.patterns)) {
  const owner = pattern.organization ?? id;
  for (const key of new Set([owner, id])) {
    if (!domainsOf.has(key)) domainsOf.set(key, []);
    domainsOf.get(key).push(...(pattern.domains ?? []));
  }
}

const companyReach = {};
let unmatched = 0;
for (const row of wtmCompanies) {
  const reach = siteReach(row);
  if (!(reach >= MIN_REACH)) continue;
  // The DuckDuckGo company most of this company's domains belong to.
  const votes = new Map();
  for (const domain of domainsOf.get(row.company) ?? []) {
    const name = ddgCompany(domain);
    if (name) votes.set(name, (votes.get(name) ?? 0) + 1);
  }
  const [name] = [...votes].sort((a, b) => b[1] - a[1])[0] ?? [];
  if (!name) {
    unmatched++;
    continue;
  }
  companyReach[name] = Math.max(companyReach[name] ?? 0, round(reach));
}

const domainReach = {};
for (const row of wtmDomains) {
  const reach = round(siteReach(row));
  if (reach >= MIN_REACH) domainReach[row.host_tld] = Math.max(domainReach[row.host_tld] ?? 0, reach);
}

const sortByValue = (o) => Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]));
const out = {
  source: `${BUCKET}/${month}/global/`,
  license: 'CC BY 4.0, WhoTracks.me by Ghostery (https://www.ghostery.com/whotracksme)',
  month,
  metric: `site_reach_top10k / ${TOP_SITES}: share of the ${TOP_SITES} most visited sites that load it on more than 1 % of page loads`,
  companies: sortByValue(companyReach),
  domains: sortByValue(domainReach),
};
writeFileSync(OUT, `${JSON.stringify(out)}\n`);
console.log(
  `${month}: ${Object.keys(companyReach).length} companies (${unmatched} unmatched), ` +
    `${Object.keys(domainReach).length} domains, ${readFileSync(OUT).length} bytes`,
);
