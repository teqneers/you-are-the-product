import { describe, expect, it } from 'vitest';
import { BROKER_SOURCES, brokerOf } from '@/lib/brokers';
import { companyNamed } from '@/lib/trackers';

describe('data broker registrations', () => {
  it('knows companies registered in California and Oregon', () => {
    expect(brokerOf('LiveRamp')).toEqual({ registries: ['CA'], registeredAs: 'LiveRamp Holdings, Inc.' });
    expect(brokerOf('Taboola')).toEqual({ registries: ['CA', 'OR'], registeredAs: 'Taboola, Inc.' });
    expect(brokerOf('Criteo')?.registries).toContain('CA');
    expect(brokerOf('Throtle')?.registries).toEqual(['OR']);
  });

  it('matches registrations under a different legal name', () => {
    expect(brokerOf('Adelphic')?.registeredAs).toBe('Viant US LLC');
    expect(brokerOf('RELX Group')?.registeredAs).toBe('RELX Inc.');
    expect(brokerOf('6 Sense Insights')?.registries).toEqual(['CA', 'OR']);
  });

  it('has no entry for companies that are not registered', () => {
    expect(brokerOf('Google')).toBeUndefined();
    expect(brokerOf('Oracle')).toBeUndefined();
    expect(brokerOf('No Such Company')).toBeUndefined();
    expect(brokerOf('toString')).toBeUndefined();
    expect(brokerOf(null)).toBeUndefined();
  });

  it('only lists our own companies, each with a known registry', () => {
    const registries = BROKER_SOURCES.map((s) => s.registry);
    expect(registries).toEqual(['CA', 'OR']);
    for (const s of BROKER_SOURCES) expect(s.fetched).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const name of ['LiveRamp', 'Criteo', 'TransUnion', 'Taboola']) {
      expect(companyNamed(name)).toBeDefined();
      for (const r of brokerOf(name)!.registries) expect(registries).toContain(r);
    }
  });
});
