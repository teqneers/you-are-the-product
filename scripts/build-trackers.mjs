// Builds data/trackers.json from the DuckDuckGo Tracker Blocklist (CC BY-NC-SA 4.0).
// Output: { domains: { [domain]: companyIndex }, companies: [{ name, home, categories }] }
// `home` is the company's main website, used to show its favicon.
import { readFileSync, writeFileSync } from 'node:fs';

const SOURCE = 'https://staticcdn.duckduckgo.com/trackerblocking/v6/current/extension-tds.json';

const tds = await (await fetch(SOURCE)).json();

const companies = [];
const companyIndex = new Map();
// "Google Ads (Google)" → "Google", so all of a parent company's products merge into one node.
const displayName = (entityName) => {
  const name = tds.entities[entityName]?.displayName ?? entityName;
  return name.match(/\(([^)]+)\)$/)?.[1] ?? name;
};
const indexFor = (entityName) => {
  const name = displayName(entityName);
  if (!companyIndex.has(name)) {
    companyIndex.set(name, companies.length);
    companies.push({ name, categories: new Set(), domains: new Set() });
  }
  const i = companyIndex.get(name);
  for (const d of tds.entities[entityName]?.domains ?? []) companies[i].domains.add(d);
  return i;
};

// "Google" → google.com, "Amazon.com" → amazon.com; otherwise the first known domain.
const homeOf = (company) => {
  const slug = company.name.toLowerCase().split(/[\s.,]/)[0].replace(/[^a-z0-9]/g, '');
  const domains = [...company.domains];
  const label = (d) => d.split('.')[0];
  return (
    domains.find((d) => label(d) === slug && d.endsWith('.com')) ??
    domains.find((d) => label(d) === slug) ??
    domains.find((d) => d.startsWith(slug)) ??
    domains[0]
  );
};

const domains = {};
for (const [domain, entityName] of Object.entries(tds.domains)) {
  domains[domain] = indexFor(entityName);
}
for (const [domain, tracker] of Object.entries(tds.trackers)) {
  if (!tracker.owner?.name) continue;
  const i = indexFor(tracker.owner.name);
  domains[domain] ??= i;
  for (const c of tracker.categories ?? []) companies[i].categories.add(c);
}

// Companies missing from the DuckDuckGo list (data/extra-trackers.json).
const extra = JSON.parse(readFileSync(new URL('../data/extra-trackers.json', import.meta.url)));
for (const c of extra.companies) {
  const i = companies.length;
  companies.push({ name: c.name, home: c.home, categories: new Set(c.categories), domains: new Set(c.domains) });
  for (const d of c.domains) domains[d] ??= i;
}

// One bucket per tracker domain (see lib/buckets.ts); the most invasive category wins.
const BUCKET_RULES = [
  ['session', ['Session Replay']],
  ['ads', ['Advertising', 'Ad Motivated Tracking', 'Action Pixels']],
  ['social', ['Social Network', 'Social - Share', 'Social - Comment', 'Badge', 'Federated Login', 'SSO']],
  ['analytics', ['Analytics', 'Audience Measurement', 'Third-Party Analytics Marketing', 'Tag Manager']],
  ['fraud', ['Ad Fraud']],
  ['embed', ['Embedded Content', 'Support Chat Widget', 'Online Payment']],
  ['cdn', ['Content Delivery']],
  ['consent', ['Consent Management']],
];
const bucketOf = (categories) => BUCKET_RULES.find(([, cats]) => cats.some((c) => categories.includes(c)))?.[0];
const buckets = {};
for (const [domain, tracker] of Object.entries(tds.trackers)) {
  // DuckDuckGo lists it as a tracker but without a category.
  buckets[domain] = bucketOf(tracker.categories ?? []) ?? 'tracker';
}
for (const c of extra.companies) for (const d of c.domains) buckets[d] ??= bucketOf(c.categories);
for (const d of extra.infrastructure.cdn) buckets[d] ??= 'cdn';
// Where "most invasive wins" picks the wrong group, e.g. Google Analytics also carries "Advertising".
Object.assign(buckets, extra.bucketOverrides);

const out = {
  source: SOURCE,
  license: 'CC BY-NC-SA 4.0, DuckDuckGo Tracker Blocklists',
  companies: companies.map((c) => ({ name: c.name, home: c.home ?? homeOf(c), categories: [...c.categories] })),
  domains,
  buckets,
  // First-party subdomains known to be CNAME aliases of trackers (e.g. metrics.site.com → adobedc.net).
  cnames: tds.cnames,
};
writeFileSync(new URL('../data/trackers.json', import.meta.url), JSON.stringify(out));
console.log(`${Object.keys(domains).length} domains, ${companies.length} companies`);
