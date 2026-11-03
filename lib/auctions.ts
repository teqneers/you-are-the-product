import type { Auction } from './state';

const isText = (v: unknown, max = 100): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;
const isPrice = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 10_000;
const isCurrency = (v: unknown): v is string => typeof v === 'string' && /^[A-Z]{3}$/.test(v);

/** Prebid reports come from the page, which can send anything: accept only well-formed ones. */
export function parseReport(r: any): PrebidReport | null {
  if (!r || !isText(r.id) || ['__proto__', 'constructor', 'prototype'].includes(r.id)) return null;
  if (r.kind === 'won') {
    if (!isText(r.bidder) || !isPrice(r.cpm) || !isCurrency(r.currency)) return null;
    return { kind: 'won', id: r.id, bidder: r.bidder, cpm: r.cpm, currency: r.currency };
  }
  if (r.kind !== 'auction' || !Array.isArray(r.bidders) || !Array.isArray(r.bids)) return null;
  return {
    kind: 'auction',
    id: r.id,
    adUnits: Number.isInteger(r.adUnits) ? Math.min(r.adUnits, 1000) : 0,
    bidders: r.bidders.filter((b: unknown) => isText(b)).slice(0, 200),
    bids: r.bids
      .filter((b: any) => b && isText(b.bidder) && isPrice(b.cpm) && isCurrency(b.currency))
      .slice(0, 500)
      .map((b: any) => ({ bidder: b.bidder, cpm: b.cpm, currency: b.currency })),
  };
}

export type PrebidReport =
  | ({ kind: 'auction'; id: string } & Omit<Auction, 'won'>)
  | { kind: 'won'; id: string; bidder: string; cpm: number; currency: string };
