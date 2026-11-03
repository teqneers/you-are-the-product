// Builds data/brokers.json: which of our tracker companies are officially registered data brokers,
// i.e. companies that buy and sell personal data and had to register with a US state.
//
// Sources (public government registries; factual public records):
// - California: CPPA (CalPrivacy) Data Broker Registry, CSV behind https://cppa.ca.gov/data_broker_registry/.
//   ca.gov conditions of use: information on state websites is in general considered public domain.
// - Oregon: DCBS Division of Financial Regulation, daily data broker download file
//   (https://dfr.oregon.gov/business/licensing/data-broker-registry/). Public record under ORS 192.
// Not used, because they cannot be downloaded reliably by a script:
// - Vermont Secretary of State (https://bizfilings.vermont.gov/online/DatabrokerInquire/): search-only web app,
//   the result list is protected by reCAPTCHA; no bulk file.
// - Texas Secretary of State (https://texas-sos.appianportalsgov.com/data-broker-registry): search-only
//   Appian portal, no bulk file.
//
// Matching favours precision over recall: a registered name (or DBA / assumed business name) matches one of
// our company names only when both are equal after normalisation, or the registered website is our company's
// home domain. OVERRIDES adds known registrations whose legal name differs; IGNORE drops wrong hits.
//
// Output: { sources: [{ registry, url, fetched }], companies: { [ourName]: { registries: ['CA', 'OR'], registeredAs } } }
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { getDomain } from 'tldts';

const CA_URL = 'https://cppa.ca.gov/data_broker_registry/registry.csv';
const OR_URL =
  'https://www4.cbs.state.or.us/exs/all/mylicsearch/index.cfm?fuseaction=search.download_dfcs_file&download_file=dfcs_db.txt';
const OR_FORM = { group_id: '20', profession_name: 'Data Broker', profession_id: '28', profession_sub_id: '28000' };

/** Normalised registered name → our company name, for registrations under a different legal name. */
// Each one checked against the registry entry (name, DBA, website). Oracle and Acxiom need none: Oracle is not
// registered (it closed its advertising business in 2024), and Acxiom is not one of our tracker companies.
const OVERRIDES = {
  '6sense insights': '6 Sense Insights', // 6sense Insights, Inc. (tracker domain 6sc.co)
  'id5 technology': 'ID5', // ID5 Technology Ltd, id5.io
  'connatix native exchange': 'Connatix', // Connatix Native Exchange Inc.
  'freewheel media': 'FreeWheel', // FreeWheel Media Inc, freewheel.com
  'valassis communications': 'Valassis Digital', // Valassis Communications, Inc. (parent of Valassis Digital)
  'relx': 'RELX Group', // RELX Inc., doing business as LexisNexis
};

/** Our company names that must never be matched (generic or ambiguous names). */
const IGNORE = new Set(['Near']);

const OUT = new URL('../data/brokers.json', import.meta.url);
const previous = existsSync(OUT) ? JSON.parse(readFileSync(OUT)) : { sources: [], companies: {} };
const { companies } = JSON.parse(readFileSync(new URL('../data/trackers.json', import.meta.url)));

async function get(url, init) {
  const res = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(60_000),
    headers: { 'user-agent': 'you-are-the-product broker list builder', ...init?.headers },
  });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.text();
}

/** Minimal RFC 4180 CSV parser (quoted fields may contain commas, quotes and line breaks). */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') (field += '"'), i++;
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') row.push(field), (field = '');
    else if (c === '\n') row.push(field), rows.push(row), (row = []), (field = '');
    else if (c !== '\r') field += c;
  }
  if (field || row.length) row.push(field), rows.push(row);
  return rows;
}

const SUFFIXES = new Set(
  'inc incorporated llc l l c ltd limited corp corporation co company gmbh sa s a sas sarl ag bv nv plc lp llp pte pty ulc oy ab as spa srl kk'.split(
    ' ',
  ),
);

/** "Oracle America, Inc." → "oracle america"; "The Trade Desk" → "trade desk". */
function normalise(name) {
  const words = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[.'’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  while (words.length > 1 && SUFFIXES.has(words.at(-1))) words.pop();
  if (words[0] === 'the' && words.length > 1) words.shift();
  return words.join(' ');
}

const domainOf = (url) => {
  const host = url.trim().replace(/^[a-z]+:\/\//i, '').split(/[/?#\s]/)[0];
  return host.includes('.') ? getDomain(host) : null;
};

/** "Adelphic LLC; Viant Technology LLC" → both names. Commas are not split: they are part of legal names. */
const names = (...fields) => fields.flatMap((f) => (f ?? '').split(';')).map((s) => s.trim()).filter(Boolean);

/** California CSV → [{ names, website }]. */
async function california() {
  const rows = parseCsv((await get(CA_URL)).replace(/^﻿/, ''));
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (prefix) => header.findIndex((h) => h.startsWith(prefix));
  const [name, dba, site] = [col('data broker name'), col('doing business as'), col('data broker primary website')];
  if (name < 0 || dba < 0 || site < 0) throw new Error('California registry: unexpected columns');
  const entries = rows.slice(1).filter((r) => r[name]?.trim());
  if (entries.length < 100) throw new Error(`California registry: only ${entries.length} rows`);
  return entries.map((r) => ({ names: names(r[name], r[dba]), website: r[site] ?? '' }));
}

/** Oregon tab-separated file (blank, license number, firm name, assumed business name, address…) → [{ names }]. */
async function oregon() {
  const text = await get(OR_URL, { method: 'POST', body: new URLSearchParams(OR_FORM) });
  const rows = text
    .split('\n')
    .map((l) => l.split('\t').map((s) => s.trim()))
    .filter((r) => /^DATA-/.test(r[1] ?? ''));
  if (rows.length < 50) throw new Error(`Oregon registry: only ${rows.length} rows`);
  return rows.map((r) => ({ names: names(r[2], r[3]), website: '' }));
}

for (const ours of Object.values(OVERRIDES)) {
  if (!companies.some((c) => c.name === ours)) throw new Error(`OVERRIDES: unknown company "${ours}"`);
}

const byName = new Map();
const byDomain = new Map();
for (const c of companies) {
  if (IGNORE.has(c.name)) continue;
  const n = normalise(c.name);
  // Very short names (e.g. "ID5", "AT") are too ambiguous to match by name; use OVERRIDES for them.
  if (n.length >= 4) byName.set(n, c.name);
  if (c.home) byDomain.set(c.home, c.name);
}

/** Our companies a registration stands for: by (overridden) name and by website domain. */
function matchesOf({ names, website }) {
  const found = new Map(); // company → matched by name?
  for (const k of names.map(normalise)) {
    const ours = OVERRIDES[k] ?? byName.get(k);
    if (ours) found.set(ours, true);
  }
  for (const site of website.split(/[;,\s]+/)) {
    const ours = byDomain.get(domainOf(site));
    if (ours && !found.has(ours)) found.set(ours, false);
  }
  return found;
}

const registries = [
  { registry: 'CA', url: 'https://cppa.ca.gov/data_broker_registry/', load: california },
  { registry: 'OR', url: 'https://dfr.oregon.gov/business/licensing/data-broker-registry/', load: oregon },
];

const fetched = new Date().toISOString().slice(0, 10);
const verbose = process.argv.includes('--verbose');
const result = {};
const byNameMatch = new Set();
const sources = [];
const add = (company, registry, registeredAs, exact) => {
  const entry = (result[company] ??= { registries: [], registeredAs });
  if (!entry.registries.includes(registry)) entry.registries.push(registry);
  // Show the registration that carries the company's own name rather than one of its subsidiaries.
  if (exact && !byNameMatch.has(company)) (entry.registeredAs = registeredAs), byNameMatch.add(company);
};

for (const { registry, url, load } of registries) {
  let entries;
  try {
    entries = await load();
  } catch (err) {
    // Keep what the last run found for this registry rather than dropping its companies.
    const old = previous.sources.find((s) => s.registry === registry);
    console.warn(`${registry}: ${err.message}; ${old ? 'keeping the previous data' : 'skipped'}`);
    if (!old) continue;
    sources.push(old);
    for (const [company, { registries, registeredAs }] of Object.entries(previous.companies)) {
      if (registries.includes(registry) && companies.some((c) => c.name === company)) add(company, registry, registeredAs, false);
    }
    continue;
  }
  sources.push({ registry, url, fetched });
  let hits = 0;
  for (const entry of entries) {
    for (const [company, exact] of matchesOf(entry)) {
      hits++;
      add(company, registry, entry.names[0], exact);
      if (verbose) console.log(`${registry}  ${company}  ←  ${entry.names.join(' / ')}  ${entry.website}${exact ? '' : '  (by website)'}`);
    }
  }
  console.log(`${registry}: ${entries.length} registered data brokers, ${hits} match our companies`);
}

if (!sources.length) throw new Error('No registry could be downloaded');
const order = (list) => registries.map((r) => r.registry).filter((r) => list.includes(r));
const sorted = Object.fromEntries(
  Object.entries(result)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([company, e]) => [company, { registries: order(e.registries), registeredAs: e.registeredAs }]),
);
writeFileSync(OUT, `${JSON.stringify({ sources, companies: sorted }, null, 2)}\n`);
console.log(`${Object.keys(sorted).length} companies → data/brokers.json`);
