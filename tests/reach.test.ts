import { describe, expect, it } from 'vitest';
import data from '@/data/reach.json';
import { REACH_SOURCE, reachOf } from '@/lib/reach';

describe('reach lookup', () => {
  it('knows the big companies by name', () => {
    expect(reachOf('Google', 'www.google-analytics.com')).toBeGreaterThan(0.8);
    expect(reachOf('Facebook', 'connect.facebook.net')).toBeGreaterThan(0.1);
    expect(reachOf('Google', 'x.example.org')).toBe(data.companies.Google);
  });

  it('prefers the company figure over the domain figure', () => {
    expect(reachOf('Facebook', 'facebook.net')).toBe(data.companies.Facebook);
    expect(data.domains['facebook.net']).not.toBe(data.companies.Facebook);
  });

  it('falls back to the domain, walking up its labels', () => {
    expect(reachOf(null, 'jquery.com')).toBe(data.domains['jquery.com']);
    expect(reachOf(null, 'code.jquery.com')).toBe(data.domains['jquery.com']);
    expect(reachOf('Unknown Company Ltd', 'a.b.kaspersky-labs.com')).toBe(data.domains['kaspersky-labs.com']);
  });

  it('returns undefined for unknown companies and domains', () => {
    expect(reachOf(null, 'www.example.org')).toBeUndefined();
    expect(reachOf('Unknown Company Ltd', 'localhost')).toBeUndefined();
  });

  it('keeps every figure between 0 and 1', () => {
    for (const r of [...Object.values(data.companies), ...Object.values(data.domains)]) {
      expect(r).toBeGreaterThanOrEqual(0.001);
      expect(r).toBeLessThanOrEqual(1);
    }
  });

  it('names its source for attribution', () => {
    expect(REACH_SOURCE.license).toContain('CC BY 4.0');
    expect(REACH_SOURCE.month).toMatch(/^\d{4}-\d{2}$/);
  });
});
