// Builds public/geo/{v4.bin.gz,v6.bin.gz,meta.json} from DB-IP "IP to Country Lite" (CC BY 4.0).
// https://db-ip.com/db/download/ip-to-country-lite
//
// Binary layout (all little-endian, gzip-compressed on disk), read by lib/geo.ts:
//   v4.bin: uint32 count, uint32 0, count × uint32 range start, count × 2 ASCII bytes country code
//   v6.bin: uint32 count, uint32 0, count × uint64 range start (upper 64 bits of the address),
//           count × 2 ASCII bytes country code
// A range runs from its start up to the next start. "ZZ" marks unassigned/reserved space.
// Adjacent ranges with the same country are merged; gaps in the source become "ZZ" ranges.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';

const PAGE = 'https://db-ip.com/db/download/ip-to-country-lite';
const OUT = new URL('../public/geo/', import.meta.url);

// The page links the current monthly file; fall back to this and last month's name.
const findSource = async () => {
  const html = await (await fetch(PAGE)).text();
  const linked = html.match(/https:\/\/download\.db-ip\.com\/free\/dbip-country-lite-\d{4}-\d{2}\.csv\.gz/)?.[0];
  if (linked) return [linked];
  const d = new Date();
  const month = (offset) => {
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - offset, 1));
    return m.toISOString().slice(0, 7);
  };
  return [0, 1].map((o) => `https://download.db-ip.com/free/dbip-country-lite-${month(o)}.csv.gz`);
};

let source, gz;
for (const url of await findSource()) {
  const res = await fetch(url);
  if (res.ok) {
    source = url;
    gz = Buffer.from(await res.arrayBuffer());
    break;
  }
}
if (!source) throw new Error('Could not download the DB-IP country lite CSV');
const month = source.match(/(\d{4}-\d{2})\.csv\.gz$/)[1];

const v4ToInt = (s) => s.split('.').reduce((n, p) => n * 256 + Number(p), 0);
const v6ToBigInt = (s) => {
  let [head, tail] = s.includes('::') ? s.split('::') : [s, null];
  const h = head ? head.split(':') : [];
  const t = tail ? tail.split(':') : [];
  const groups = tail === null ? h : [...h, ...Array(8 - h.length - t.length).fill('0'), ...t];
  if (groups.length !== 8) throw new Error(`Bad IPv6 address ${s}`);
  return groups.reduce((n, g) => (n << 16n) | BigInt(parseInt(g, 16)), 0n);
};

const v4 = []; // [start, end, cc] as numbers
const v6 = []; // [start64, end64, cc] as bigints
for (const line of gunzipSync(gz).toString('utf8').split('\n')) {
  if (!line) continue;
  const [a, b, cc] = line.split(',');
  if (!/^[A-Z]{2}$/.test(cc)) throw new Error(`Bad country code in line: ${line}`);
  if (a.includes(':')) v6.push([v6ToBigInt(a) >> 64n, v6ToBigInt(b) >> 64n, cc]);
  else v4.push([v4ToInt(a), v4ToInt(b), cc]);
}

// Turns [start, end, cc] rows into merged range starts, filling gaps with ZZ.
// For IPv6 several rows can share one 64-bit start; the first one wins.
const compact = (rows, zero, one) => {
  rows.sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0));
  const starts = [];
  const codes = [];
  const push = (start, cc) => {
    if (starts.length && starts.at(-1) === start) return;
    if (codes.at(-1) === cc) return;
    starts.push(start);
    codes.push(cc);
  };
  let next = zero; // first address not yet covered
  for (const [start, end, cc] of rows) {
    if (end < next) continue;
    if (start > next) push(next, 'ZZ');
    push(start > next ? start : next, cc);
    next = end + one;
  }
  return { starts, codes };
};

const encode = (table, width) => {
  const n = table.starts.length;
  const buf = Buffer.alloc(8 + n * width + n * 2);
  buf.writeUInt32LE(n, 0);
  table.starts.forEach((s, i) =>
    width === 4 ? buf.writeUInt32LE(s, 8 + i * 4) : buf.writeBigUInt64LE(s, 8 + i * 8),
  );
  buf.write(table.codes.join(''), 8 + n * width, 'ascii');
  return buf;
};

const t4 = compact(v4, 0, 1);
const t6 = compact(v6, 0n, 1n);
// Raw tables are ~6 MB; gzip brings them to ~1.5 MB. lib/geo.ts unpacks with DecompressionStream.
const b4 = gzipSync(encode(t4, 4), { level: 9 });
const b6 = gzipSync(encode(t6, 8), { level: 9 });

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
writeFileSync(new URL('v4.bin.gz', OUT), b4);
writeFileSync(new URL('v6.bin.gz', OUT), b6);
writeFileSync(
  new URL('meta.json', OUT),
  JSON.stringify(
    {
      source: 'DB-IP IP to Country Lite',
      sourceUrl: PAGE,
      file: source,
      month,
      licence: 'Creative Commons Attribution 4.0 International (CC BY 4.0)',
      licenceUrl: 'https://creativecommons.org/licenses/by/4.0/',
      attribution: 'IP Geolocation by DB-IP',
      attributionUrl: 'https://db-ip.com',
      attributionHtml: "<a href='https://db-ip.com'>IP Geolocation by DB-IP</a>",
      v4Ranges: t4.starts.length,
      v6Ranges: t6.starts.length,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  `DB-IP ${month}: ${v4.length} IPv4 rows → ${t4.starts.length} ranges (${b4.length} bytes gz), ` +
    `${v6.length} IPv6 rows → ${t6.starts.length} ranges (${b6.length} bytes gz)`,
);
