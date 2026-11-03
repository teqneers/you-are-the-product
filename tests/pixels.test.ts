import { describe, expect, it } from 'vitest';
import { decodePixel } from '@/lib/pixels';

describe('decodePixel', () => {
  it('decodes a Meta add-to-cart with product, price and hashed email', () => {
    const e = decodePixel(
      'https://www.facebook.com/tr/?id=1&ev=AddToCart&cd[content_name]=Sneaker%20X&cd[value]=89.90&cd[currency]=EUR&ud[em]=abc123',
    );
    expect(e).toEqual({ platform: 'Meta', event: 'AddToCart', action: 'cart', detail: 'Sneaker X', value: '89.90 EUR', matching: ['email'] });
  });

  it('decodes a GA4 search with its search term', () => {
    const e = decodePixel('https://region1.google-analytics.com/g/collect?v=2&en=search&ep.search_term=Schwangerschaftstest');
    expect(e).toMatchObject({ platform: 'Google', action: 'search', detail: 'Schwangerschaftstest' });
  });

  it('reads GA4 user-provided data without counting the format version', () => {
    const e = decodePixel('https://www.google-analytics.com/g/collect?en=purchase&em=tv.1~em.abc~ph.def');
    expect(e?.matching).toEqual(['email', 'phone']);
  });

  it('decodes a TikTok JSON body', () => {
    const body = JSON.stringify({ event: 'CompletePayment', properties: { value: 20, currency: 'EUR' }, context: { user: { email: 'x' } } });
    expect(decodePixel('https://analytics.tiktok.com/api/v2/pixel', body)).toMatchObject({
      platform: 'TikTok',
      action: 'purchase',
      value: '20 EUR',
      matching: ['email'],
    });
  });

  it('ignores other requests', () => {
    expect(decodePixel('https://www.facebook.com/plugins/like.php')).toBeNull();
    expect(decodePixel('not a url')).toBeNull();
  });

  it('notes Google Consent Mode "denied"', () => {
    const denied = decodePixel('https://region1.google-analytics.com/g/collect?v=2&en=page_view&gcs=G100', undefined);
    expect(denied).toMatchObject({ platform: 'Google', cookieless: true });
    const granted = decodePixel('https://region1.google-analytics.com/g/collect?v=2&en=page_view&gcs=G111', undefined);
    expect(granted?.cookieless).toBeUndefined();
  });
});
