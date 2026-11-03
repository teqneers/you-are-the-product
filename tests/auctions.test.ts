import { describe, expect, it } from 'vitest';
import { parseReport } from '@/lib/auctions';

describe('parseReport', () => {
  it('accepts a well-formed auction and drops malformed bids', () => {
    const report = parseReport({
      kind: 'auction',
      id: 'a1',
      adUnits: 3,
      bidders: ['criteo', 42, 'ix'],
      bids: [
        { bidder: 'criteo', cpm: 0.42, currency: 'EUR' },
        { bidder: 'ix', cpm: Infinity, currency: 'EUR' },
        { bidder: 'x', cpm: 1, currency: 'euro' },
      ],
    });
    expect(report).toEqual({
      kind: 'auction',
      id: 'a1',
      adUnits: 3,
      bidders: ['criteo', 'ix'],
      bids: [{ bidder: 'criteo', cpm: 0.42, currency: 'EUR' }],
    });
  });

  it('rejects ids that would pollute object prototypes', () => {
    for (const id of ['__proto__', 'constructor', 'prototype']) {
      expect(parseReport({ kind: 'won', id, bidder: 'x', cpm: 1, currency: 'EUR' })).toBeNull();
    }
  });

  it('rejects unknown kinds and missing fields', () => {
    expect(parseReport({ kind: 'other', id: 'a' })).toBeNull();
    expect(parseReport({ kind: 'auction', id: 'a' })).toBeNull();
    expect(parseReport(null)).toBeNull();
  });
});
