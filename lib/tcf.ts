/**
 * Decoder for IAB TCF v2 consent strings ("TC strings"), which cookie banners create when you click
 * "Accept". Spec: https://github.com/InteractiveAdvertisingBureau/GDPR-Transparency-and-Consent-Framework
 */

import { labels } from './i18n';

export interface Consent {
  cmpId: number;
  vendorListVersion: number;
  /** Purpose ids (1–11) you consented to. */
  purposes: number[];
  /** Purpose ids for which legitimate interest was disclosed and not objected to. */
  purposesLegitimateInterest: number[];
  /** IAB vendor ids you consented to. */
  vendors: number[];
  /** IAB vendor ids that rely on legitimate interest, i.e. process data without your consent. */
  vendorsLegitimateInterest: number[];
}

/** Short names of the TCF purposes 1–11. */
export const PURPOSES = labels<number>('purpose');

class Bits {
  private pos = 0;
  constructor(private readonly bits: string) {}
  int(n: number) {
    if (this.pos + n > this.bits.length) throw new Error('TC string too short');
    const v = parseInt(this.bits.slice(this.pos, this.pos + n), 2);
    this.pos += n;
    return v;
  }
  bool() {
    return this.int(1) === 1;
  }
  /** Ids (1-based) whose bit is set in a field of n bits. */
  field(n: number) {
    const ids: number[] = [];
    for (let i = 1; i <= n; i++) if (this.bool()) ids.push(i);
    return ids;
  }
  skip(n: number) {
    this.pos += n;
  }
}

function toBits(base64url: string) {
  const b64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  let bits = '';
  for (let i = 0; i < bin.length; i++) bits += bin.charCodeAt(i).toString(2).padStart(8, '0');
  return bits;
}

/** Vendor section: either a bit field or a list of id ranges. Capped, since the input is untrusted. */
function vendorSection(r: Bits) {
  const maxVendorId = r.int(16);
  if (!r.bool()) return r.field(maxVendorId);
  const ids: number[] = [];
  const entries = r.int(12);
  for (let i = 0; i < entries; i++) {
    const isRange = r.bool();
    const start = r.int(16);
    const end = isRange ? r.int(16) : start;
    for (let id = start; id <= end && ids.length < 5000; id++) ids.push(id);
  }
  return ids;
}

/** Decodes the core segment of a TCF v2 string; returns null for anything else. */
export function decodeTcString(tc: string): Consent | null {
  try {
    const core = tc.split('.')[0]!;
    if (!/^[A-Za-z0-9_-]{20,}$/.test(core)) return null;
    const r = new Bits(toBits(core));
    if (r.int(6) !== 2) return null;
    r.skip(36 + 36); // created, last updated
    const cmpId = r.int(12);
    r.skip(12 + 6 + 12); // CMP version, consent screen, language
    const vendorListVersion = r.int(12);
    r.skip(6 + 1 + 1 + 12); // policy version, service specific, non-standard texts, special features
    const purposes = r.field(24).filter((p) => p <= 11);
    const purposesLegitimateInterest = r.field(24).filter((p) => p <= 11);
    r.skip(1 + 12); // purpose one treatment, publisher country
    const vendors = vendorSection(r);
    const vendorsLegitimateInterest = vendorSection(r);
    return { cmpId, vendorListVersion, purposes, purposesLegitimateInterest, vendors, vendorsLegitimateInterest };
  } catch {
    return null;
  }
}
