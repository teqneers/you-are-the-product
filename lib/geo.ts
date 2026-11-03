// Country lookup for server IP addresses (webRequest `details.ip`).
// Data: DB-IP "IP to Country Lite", CC BY 4.0, built by scripts/build-geo.mjs into public/geo/.
// Attribution required wherever results are shown: "IP Geolocation by DB-IP" linking to https://db-ip.com

/** Files the lookup needs, relative to the extension root. */
export const GEO_FILES = { v4: '/geo/v4.bin.gz', v6: '/geo/v6.bin.gz', meta: '/geo/meta.json' } as const;

export const GEO_ATTRIBUTION = { text: 'IP Geolocation by DB-IP', url: 'https://db-ip.com' } as const;

export interface Geo {
  /** ISO 3166-1 alpha-2 code ("US", "DE"), or null for private, reserved and unknown addresses. */
  countryOf(ip: string): string | null;
}

/** A parsed table: sorted range starts and one 2-letter code per range ("ZZ" = unknown). */
export interface GeoTable<T extends number | bigint> {
  starts: ArrayLike<T>;
  codes: Uint8Array; // 2 ASCII bytes per range
}

const HEADER = 8;

/** Parses the uncompressed layout written by scripts/build-geo.mjs (little-endian). */
export function parseTable(buf: ArrayBuffer, width: 4): GeoTable<number>;
export function parseTable(buf: ArrayBuffer, width: 8): GeoTable<bigint>;
export function parseTable(buf: ArrayBuffer, width: 4 | 8): GeoTable<number> | GeoTable<bigint> {
  const view = new DataView(buf);
  const n = view.getUint32(0, true);
  if (buf.byteLength !== HEADER + n * (width + 2)) throw new Error('geo: table has the wrong size');
  const codes = new Uint8Array(buf, HEADER + n * width, n * 2);
  if (width === 4) {
    const starts = new Uint32Array(n);
    for (let i = 0; i < n; i++) starts[i] = view.getUint32(HEADER + i * 4, true);
    return { starts, codes };
  }
  const starts = new BigUint64Array(n);
  for (let i = 0; i < n; i++) starts[i] = view.getBigUint64(HEADER + i * 8, true);
  return { starts, codes };
}

/** Code of the last range whose start is <= key, or null. */
function lookup<T extends number | bigint>(table: GeoTable<T>, key: T): string | null {
  const { starts, codes } = table;
  let lo = 0;
  let hi = starts.length - 1;
  if (hi < 0 || key < starts[0]!) return null;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (starts[mid]! <= key) lo = mid;
    else hi = mid - 1;
  }
  const cc = String.fromCharCode(codes[lo * 2]!, codes[lo * 2 + 1]!);
  return cc === 'ZZ' ? null : cc;
}

/** "1.2.3.4" → 0x01020304, or null if malformed. */
export function parseIPv4(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p) || Number(p) > 255) return null;
    n = n * 256 + Number(p);
  }
  return n;
}

/** Full 128-bit value of an IPv6 address (handles "::" and a trailing dotted IPv4), or null. */
export function parseIPv6(ip: string): bigint | null {
  let s = ip.replace(/^\[|\]$/g, '').replace(/%.*$/, '');
  const dotted = s.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const v4 = parseIPv4(dotted[2]!);
    if (v4 === null) return null;
    s = `${dotted[1]}${(v4 >>> 16).toString(16)}:${(v4 & 0xffff).toString(16)}`;
  }
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  let groups: string[];
  if (halves.length === 2) {
    const fill = 8 - head.length - tail.length;
    if (fill < 1) return null;
    groups = [...head, ...Array<string>(fill).fill('0'), ...tail];
  } else groups = head;
  if (groups.length !== 8) return null;
  let n = 0n;
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/i.test(g)) return null;
    n = (n << 16n) | BigInt(parseInt(g, 16));
  }
  return n;
}

const cidr4 = (base: string, bits: number): [number, number] => [parseIPv4(base)!, bits];
// Not routed on the public internet: this network, private, CGNAT, loopback, link-local,
// IETF protocol assignments, documentation, benchmarking, multicast, reserved, broadcast.
const PRIVATE_V4 = [
  cidr4('0.0.0.0', 8),
  cidr4('10.0.0.0', 8),
  cidr4('100.64.0.0', 10),
  cidr4('127.0.0.0', 8),
  cidr4('169.254.0.0', 16),
  cidr4('172.16.0.0', 12),
  cidr4('192.0.0.0', 24),
  cidr4('192.0.2.0', 24),
  cidr4('192.168.0.0', 16),
  cidr4('198.18.0.0', 15),
  cidr4('198.51.100.0', 24),
  cidr4('203.0.113.0', 24),
  cidr4('224.0.0.0', 4),
  cidr4('240.0.0.0', 4),
];
const isPrivateV4 = (n: number) =>
  PRIVATE_V4.some(([base, bits]) => Math.floor(n / 2 ** (32 - bits)) === Math.floor(base / 2 ** (32 - bits)));

const cidr6 = (base: string, bits: number): [bigint, bigint] => [parseIPv6(base)!, BigInt(128 - bits)];
// Unspecified, loopback, unique local, link-local, multicast, documentation.
const PRIVATE_V6 = [
  cidr6('::', 128),
  cidr6('::1', 128),
  cidr6('fc00::', 7),
  cidr6('fe80::', 10),
  cidr6('ff00::', 8),
  cidr6('2001:db8::', 32),
];
const isPrivateV6 = (n: bigint) => PRIVATE_V6.some(([base, shift]) => n >> shift === base >> shift);

const MAPPED_V4 = 0xffffn << 32n; // ::ffff:0:0/96
const NAT64 = parseIPv6('64:ff9b::')!; // 64:ff9b::/96 carries an IPv4 address in its last 32 bits
const LOW32 = 0xffffffffn;

/** Lookup over parsed tables. */
export function createGeo(v4: GeoTable<number>, v6: GeoTable<bigint>): Geo {
  const ofV4 = (n: number) => (isPrivateV4(n) ? null : lookup(v4, n));
  return {
    countryOf(ip) {
      if (typeof ip !== 'string' || !ip) return null;
      if (!ip.includes(':')) {
        const n = parseIPv4(ip.trim());
        return n === null ? null : ofV4(n);
      }
      const n = parseIPv6(ip.trim());
      if (n === null) return null;
      if (n >> 32n === MAPPED_V4 >> 32n || n >> 32n === NAT64 >> 32n) return ofV4(Number(n & LOW32));
      if (isPrivateV6(n)) return null;
      return lookup(v6, n >> 64n);
    },
  };
}

async function gunzip(buf: ArrayBuffer): Promise<ArrayBuffer> {
  const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
}

/**
 * Loads the country tables. In the extension:
 * `loadGeo((p) => fetch(browser.runtime.getURL(p)).then((r) => r.arrayBuffer()))`
 */
export async function loadGeo(fetchFile: (path: string) => Promise<ArrayBuffer>): Promise<Geo> {
  const [v4, v6] = await Promise.all([
    fetchFile(GEO_FILES.v4).then(gunzip),
    fetchFile(GEO_FILES.v6).then(gunzip),
  ]);
  return createGeo(parseTable(v4, 4), parseTable(v6, 8));
}

/** EU member states (27) plus the EEA countries Iceland, Liechtenstein and Norway. */
export const EU_EEA: ReadonlySet<string> = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE',
  'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  'IS', 'LI', 'NO',
]);

/**
 * Regions that are part of an EU member state (GDPR applies) but have their own ISO code:
 * Åland (FI) and the French outermost regions. Combine with EU_EEA via isEuEea().
 */
export const EU_TERRITORIES: ReadonlySet<string> = new Set(['AX', 'GF', 'GP', 'MQ', 'RE', 'YT', 'MF']);

export const isEuEea = (cc: string | null): boolean => cc !== null && (EU_EEA.has(cc) || EU_TERRITORIES.has(cc));

/**
 * Countries with an EU adequacy decision (Art. 45 GDPR), as of 2026 (Brazil added January 2026).
 * Canada covers commercial organisations under PIPEDA only.
 * Source: https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/adequacy-decisions_en
 *
 * The United States is NOT in this set: the EU-US Data Privacy Framework only covers companies
 * certified under it (https://www.dataprivacyframework.gov/list). Whether a US company is certified
 * cannot be told from its IP address, so callers decide; see US_ADEQUATE_IF_DPF_CERTIFIED.
 */
export const GDPR_ADEQUATE: ReadonlySet<string> = new Set([
  'AD', 'AR', 'BR', 'CA', 'FO', 'GG', 'IL', 'IM', 'JP', 'JE', 'NZ', 'KR', 'CH', 'GB', 'UY',
]);

/** Partial adequacy: transfers to these countries are covered only for DPF-certified companies. */
export const US_ADEQUATE_IF_DPF_CERTIFIED: ReadonlySet<string> = new Set(['US']);
