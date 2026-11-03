import { describe, expect, it } from 'vitest';
import { decodeTcString } from '@/lib/tcf';

/** Builds a TCF v2 core string from fields, so tests do not depend on one CMP's output. */
function encode(opts: {
  cmpId: number;
  vendorListVersion: number;
  purposes: number[];
  purposesLi: number[];
  vendors: number[];
  vendorsLi: number[];
  rangeVendors?: boolean;
}) {
  let bits = '';
  const int = (v: number, n: number) => (bits += v.toString(2).padStart(n, '0'));
  const field = (ids: number[], n: number) => {
    for (let i = 1; i <= n; i++) bits += ids.includes(i) ? '1' : '0';
  };
  const vendorSection = (ids: number[], range: boolean) => {
    const max = Math.max(0, ...ids);
    int(max, 16);
    if (!range) {
      bits += '0';
      field(ids, max);
      return;
    }
    bits += '1';
    int(1, 12); // one entry: a range from min to max
    bits += '1';
    int(Math.min(...ids), 16);
    int(max, 16);
  };
  int(2, 6); // version
  int(0, 36);
  int(0, 36);
  int(opts.cmpId, 12);
  int(1, 12);
  int(1, 6);
  int(0, 12);
  int(opts.vendorListVersion, 12);
  int(4, 6);
  bits += '00';
  int(0, 12);
  field(opts.purposes, 24);
  field(opts.purposesLi, 24);
  bits += '0';
  int(0, 12);
  vendorSection(opts.vendors, false);
  vendorSection(opts.vendorsLi, opts.rangeVendors ?? false);
  while (bits.length % 8) bits += '0';
  const bytes = bits.match(/.{8}/g)!.map((b) => String.fromCharCode(parseInt(b, 2)));
  return btoa(bytes.join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

describe('decodeTcString', () => {
  it('decodes purposes and vendors from a bit field', () => {
    const tc = encode({ cmpId: 6, vendorListVersion: 183, purposes: [1, 2, 7], purposesLi: [7, 9], vendors: [1, 5, 755], vendorsLi: [10] });
    expect(decodeTcString(tc)).toEqual({
      cmpId: 6,
      vendorListVersion: 183,
      purposes: [1, 2, 7],
      purposesLegitimateInterest: [7, 9],
      vendors: [1, 5, 755],
      vendorsLegitimateInterest: [10],
    });
  });

  it('decodes range-encoded vendors', () => {
    const tc = encode({ cmpId: 1, vendorListVersion: 2, purposes: [], purposesLi: [], vendors: [], vendorsLi: [3, 4, 5], rangeVendors: true });
    expect(decodeTcString(tc)?.vendorsLegitimateInterest).toEqual([3, 4, 5]);
  });

  it('ignores the segments after the core string', () => {
    const tc = encode({ cmpId: 1, vendorListVersion: 2, purposes: [1], purposesLi: [], vendors: [2], vendorsLi: [] });
    expect(decodeTcString(`${tc}.IGLtV_T9fb2v`)?.vendors).toEqual([2]);
  });

  it('rejects anything that is not a TCF v2 string', () => {
    expect(decodeTcString('COw4XqLOw4XqLAAAAAENAXCAAP-gAAAAAAAAAngAQAQgAAAA')).toBeNull(); // v1
    expect(decodeTcString('hello')).toBeNull();
    expect(decodeTcString('<script>alert(1)</script>')).toBeNull();
    expect(decodeTcString('CQtDjkAQ')).toBeNull(); // truncated
  });
});
