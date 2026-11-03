// Builds data/vendor-names.json: TCF vendor id → company name, from IAB Europe's Global Vendor List.
// Only ids and names are kept (about 40 KB), so the extension never has to download the list itself.
// Older lists are merged in as well, because consent strings may still name vendors that have left the list;
// the newest name of each id wins.
import { writeFileSync } from 'node:fs';

const CURRENT = [
  'https://vendor-list.consensu.org/v3/vendor-list.json',
  // IAB Tech Lab's own mirror (iabgpp.com), updated weekly.
  'https://raw.githubusercontent.com/IABTechLab/iabgpp-site/main/docs/vendorlist/v3/vendor-list.json',
];
const OLDER = [
  'https://raw.githubusercontent.com/IABTechLab/iabgpp-site/main/docs/vendorlist/v2/vendor-list.json',
];
// Snapshots of older list versions in IAB Tech Lab's reference library iabtcf-es (Apache-2.0).
const TREE = 'https://api.github.com/repos/InteractiveAdvertisingBureau/iabtcf-es/git/trees/master?recursive=1';
const RAW = 'https://raw.githubusercontent.com/InteractiveAdvertisingBureau/iabtcf-es/master/';

async function json(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

async function firstOf(urls) {
  for (const url of urls) {
    try {
      return { url, gvl: await json(url) };
    } catch (e) {
      console.warn(`skipped ${e.message}`);
    }
  }
  throw new Error('no current vendor list could be downloaded');
}

const lists = [];
try {
  const tree = await json(TREE);
  const paths = tree.tree.map((t) => t.path).filter((p) => /vendorlist\/v2(\.\d)?\/vendor-list(-v\d+)?\.json$/.test(p));
  for (const path of paths) {
    try {
      lists.push(await json(RAW + path));
    } catch (e) {
      console.warn(`skipped ${e.message}`);
    }
  }
} catch (e) {
  console.warn(`skipped older snapshots: ${e.message}`);
}
for (const url of OLDER) {
  try {
    lists.push(await json(url));
  } catch (e) {
    console.warn(`skipped ${e.message}`);
  }
}
const current = await firstOf(CURRENT);
lists.push(current.gvl);

// Oldest first, so newer names overwrite older ones.
const updated = (gvl) => Date.parse(gvl.lastUpdated ?? '') || 0;
lists.sort((a, b) => updated(a) - updated(b) || (a.vendorListVersion ?? 0) - (b.vendorListVersion ?? 0));

const vendors = {};
for (const gvl of lists) {
  for (const v of Object.values(gvl.vendors ?? {})) {
    if (Number.isInteger(v?.id) && v.id > 0 && typeof v.name === 'string' && v.name.trim() && v.name.length <= 200) {
      // Some entries start with stray punctuation, e.g. ": Tappx".
      vendors[v.id] = v.name.trim().replace(/^[^\p{L}\p{N}]+/u, '');
    }
  }
}

const sorted = Object.fromEntries(Object.entries(vendors).sort(([a], [b]) => Number(a) - Number(b)));
const out = {
  source: current.url,
  vendorListVersion: current.gvl.vendorListVersion,
  lastUpdated: current.gvl.lastUpdated,
  note: 'Vendor ids and names from IAB Europe Global Vendor Lists, merged with older versions.',
  vendors: sorted,
};
writeFileSync('data/vendor-names.json', JSON.stringify(out) + '\n');
console.log(`${Object.keys(sorted).length} vendors from ${lists.length} lists, current version ${out.vendorListVersion}`);
