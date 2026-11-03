import { describe, expect, it } from 'vitest';
import { bucketFor, companyFor } from '@/lib/trackers';

describe('tracker lookup', () => {
  it('finds the company behind a subdomain', () => {
    expect(companyFor('stats.g.doubleclick.net')?.name).toBe('Google');
    expect(companyFor('connect.facebook.net')?.name).toBe('Facebook');
    expect(companyFor('www.example.org')).toBeNull();
  });

  it('groups domains by what they do', () => {
    expect(bucketFor('securepubads.g.doubleclick.net')).toBe('ads');
    expect(bucketFor('www.google-analytics.com')).toBe('analytics');
    expect(bucketFor('static.hotjar.com')).toBe('session');
    expect(bucketFor('app.usercentrics.eu')).toBe('consent');
  });

  it('guesses CDNs for unlisted domains by name', () => {
    expect(bucketFor('img.chefkoch-cdn.de')).toBe('cdn');
    expect(bucketFor('static.example.org')).toBe('cdn');
    expect(bucketFor('tracking.example.org')).toBe('unknown');
  });
});

describe('CNAME cloaking', () => {
  it('recognises known tracker aliases on first-party subdomains', async () => {
    const { cloakedTracker } = await import('@/lib/cloaking');
    expect(cloakedTracker('trackp.flylax.com')).toBe('a1.adform.net');
    expect(cloakedTracker('www.example.org')).toBeNull();
  });
});
