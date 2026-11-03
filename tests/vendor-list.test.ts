import { describe, expect, it } from 'vitest';
import { VENDOR_LIST, vendorName } from '@/lib/vendor-list';

describe('bundled vendor names', () => {
  it('maps TCF vendor ids to names', () => {
    expect(vendorName(755)).toMatch(/Google/);
    expect(vendorName('91')).toMatch(/Criteo/);
    expect(VENDOR_LIST.version).toBeGreaterThan(150);
  });

  it('returns nothing for unknown ids and object keys', () => {
    expect(vendorName(999_999)).toBeUndefined();
    expect(vendorName('__proto__')).toBeUndefined();
    expect(vendorName('toString')).toBeUndefined();
  });
});
