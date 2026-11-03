import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  EU_EEA,
  GDPR_ADEQUATE,
  GEO_FILES,
  createGeo,
  isEuEea,
  loadGeo,
  parseIPv4,
  parseIPv6,
  parseTable,
} from '@/lib/geo';

// Builds a table in the layout of scripts/build-geo.mjs.
function table(width: 4 | 8, rows: [number | bigint, string][]): ArrayBuffer {
  const buf = new ArrayBuffer(8 + rows.length * (width + 2));
  const view = new DataView(buf);
  view.setUint32(0, rows.length, true);
  rows.forEach(([start, cc], i) => {
    if (width === 4) view.setUint32(8 + i * 4, Number(start), true);
    else view.setBigUint64(8 + i * 8, BigInt(start), true);
    view.setUint8(8 + rows.length * width + i * 2, cc.charCodeAt(0));
    view.setUint8(8 + rows.length * width + i * 2 + 1, cc.charCodeAt(1));
  });
  return buf;
}

const v4 = parseTable(
  table(4, [
    [0, 'ZZ'],
    [parseIPv4('1.0.0.0')!, 'AU'],
    [parseIPv4('1.0.1.0')!, 'CN'],
    [parseIPv4('8.0.0.0')!, 'US'],
    [parseIPv4('10.0.0.0')!, 'ZZ'],
    [parseIPv4('80.0.0.0')!, 'DE'],
    [parseIPv4('255.0.0.0')!, 'FR'],
  ]),
  4,
);
const v6 = parseTable(
  table(8, [
    [0n, 'ZZ'],
    [parseIPv6('2001::')! >> 64n, 'US'],
    [parseIPv6('2003::')! >> 64n, 'DE'],
    [parseIPv6('2003:0:0:1::')! >> 64n, 'NL'],
    [parseIPv6('2004::')! >> 64n, 'ZZ'],
  ]),
  8,
);
const geo = createGeo(v4, v6);

describe('address parsing', () => {
  it('parses IPv4 and rejects malformed input', () => {
    expect(parseIPv4('1.2.3.4')).toBe(0x01020304);
    expect(parseIPv4('255.255.255.255')).toBe(0xffffffff);
    for (const bad of ['1.2.3', '1.2.3.256', '1.2.3.4.5', 'a.b.c.d', '']) expect(parseIPv4(bad)).toBeNull();
  });

  it('parses IPv6 in full, compressed and IPv4-embedded forms', () => {
    expect(parseIPv6('::')).toBe(0n);
    expect(parseIPv6('::1')).toBe(1n);
    expect(parseIPv6('2001:db8::1')).toBe((0x20010db8n << 96n) | 1n);
    expect(parseIPv6('2001:0db8:0000:0000:0000:0000:0000:0001')).toBe(parseIPv6('2001:db8::1'));
    expect(parseIPv6('::ffff:1.2.3.4')).toBe((0xffffn << 32n) | 0x01020304n);
    expect(parseIPv6('[fe80::1%en0]')).toBe(parseIPv6('fe80::1'));
    for (const bad of ['1::2::3', '1:2:3:4:5:6:7', '1:2:3:4:5:6:7:8:9', '12345::', 'g::', '::1.2.3'])
      expect(parseIPv6(bad)).toBeNull();
  });
});

describe('countryOf with a synthetic table', () => {
  it('finds the range an IPv4 address falls into', () => {
    expect(geo.countryOf('1.0.0.0')).toBe('AU');
    expect(geo.countryOf('1.0.0.255')).toBe('AU');
    expect(geo.countryOf('1.0.1.0')).toBe('CN');
    expect(geo.countryOf('8.8.8.8')).toBe('US');
    expect(geo.countryOf('80.1.2.3')).toBe('DE');
    expect(geo.countryOf('254.255.255.255')).toBeNull(); // reserved 240/4
    expect(geo.countryOf('0.1.2.3')).toBeNull();
  });

  it('finds IPv6 ranges by their upper 64 bits', () => {
    expect(geo.countryOf('2001:4860:4860::8888')).toBe('US');
    expect(geo.countryOf('2003::1')).toBe('DE');
    expect(geo.countryOf('2003:0:0:1:ffff::')).toBe('NL');
    expect(geo.countryOf('2005::1')).toBeNull();
  });

  it('looks up IPv4-mapped and NAT64 addresses in the IPv4 table', () => {
    expect(geo.countryOf('::ffff:80.1.2.3')).toBe('DE');
    expect(geo.countryOf('::ffff:5001:0203')).toBe('DE');
    expect(geo.countryOf('64:ff9b::808:808')).toBe('US');
    expect(geo.countryOf('::ffff:192.168.1.1')).toBeNull();
  });

  it('returns null for private, loopback, link-local and garbage', () => {
    for (const ip of [
      '10.1.2.3',
      '127.0.0.1',
      '169.254.1.1',
      '172.16.5.4',
      '192.168.0.1',
      '100.64.0.1',
      '::1',
      '::',
      'fe80::1',
      'fd12:3456::1',
      'ff02::1',
      'localhost',
      '',
    ])
      expect(geo.countryOf(ip)).toBeNull();
  });
});

describe('generated DB-IP data', async () => {
  const real = await loadGeo(async (path) => {
    const file = readFileSync(new URL(`../public${path}`, import.meta.url));
    return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
  });

  it('knows a few well-known addresses', () => {
    expect(real.countryOf('8.8.8.8')).toBe('US');
    expect(real.countryOf('194.25.0.1')).toBe('DE'); // Deutsche Telekom
    expect(real.countryOf('1.1.1.1')).toBe('AU');
    expect(real.countryOf('2003::1')).toBe('DE'); // Deutsche Telekom IPv6
    expect(real.countryOf('::ffff:194.25.0.1')).toBe('DE');
    expect(real.countryOf('192.168.1.1')).toBeNull();
  });

  it('ships the attribution metadata', () => {
    const meta = JSON.parse(readFileSync(new URL(`../public${GEO_FILES.meta}`, import.meta.url), 'utf8'));
    expect(meta.attribution).toBe('IP Geolocation by DB-IP');
    expect(meta.attributionUrl).toBe('https://db-ip.com');
    expect(meta.month).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe('country groups', () => {
  it('has 27 EU states plus 3 EEA states', () => {
    expect(EU_EEA.size).toBe(30);
    expect(isEuEea('DE')).toBe(true);
    expect(isEuEea('RE')).toBe(true);
    expect(isEuEea('US')).toBe(false);
    expect(isEuEea(null)).toBe(false);
  });

  it('keeps the US out of the adequacy list', () => {
    expect(GDPR_ADEQUATE.has('US')).toBe(false);
    expect(GDPR_ADEQUATE.has('CH')).toBe(true);
    for (const cc of GDPR_ADEQUATE) expect(EU_EEA.has(cc)).toBe(false);
  });
});
