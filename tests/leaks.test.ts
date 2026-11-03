import { describe, expect, it } from 'vitest';
import { findLeaks } from '@/lib/leaks';

describe('findLeaks', () => {
  it('finds the page being read and screen data in URL parameters', () => {
    const { leaks } = findLeaks('https://t.example.com/p?url=https%3A%2F%2Fwww.welt.de%2Fartikel&sr=1920x1080&ul=de-DE', undefined, 'www.welt.de');
    expect(leaks.page).toContain('www.welt.de/artikel');
    expect(leaks.screen).toBe('sr=1920x1080');
    expect(leaks.lang).toBe('ul=de-DE');
  });

  it('finds person IDs in OpenRTB bodies and collects their values', () => {
    const body = JSON.stringify({
      id: '9f0c8a2e-1111-2222-3333-444455556666',
      site: { page: 'https://www.welt.de/' },
      user: { ext: { eids: [{ source: 'id5-sync.com', uids: [{ id: 'ID5-abcdef1234567890' }] }] } },
    });
    const { leaks, ids } = findLeaks('https://bid.example.com/openrtb', body, 'www.welt.de');
    expect(leaks.page).toBe('site.page=https://www.welt.de/');
    expect(leaks.id).toContain('ID5-abcdef1234567890');
    expect(ids).toEqual(['ID5-abcdef1234567890']);
  });

  it('does not count IDs of an auction or request as person IDs', () => {
    const { leaks } = findLeaks(
      'https://x.example.com/b?auctionId=9f0c8a2e-1111-2222-3333-444455556666&transactionId=a1b2c3d4e5f6a7b8c9d0&id=9f0c8a2e-1111-2222-3333-444455556666',
      undefined,
      'www.welt.de',
    );
    expect(leaks.id).toBeUndefined();
  });

  it('recognises the consent string', () => {
    const { leaks } = findLeaks('https://x.example.com/b?gdpr_consent=CQtDjkAQtDjkAFZABCENC3FgAP_gAAAAAAYgMupR_C7VbGFD6TJ3', undefined, 'www.welt.de');
    expect(leaks.consent).toMatch(/^gdpr_consent=CQ/);
  });
});
