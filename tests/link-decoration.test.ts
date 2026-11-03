import { describe, expect, it } from 'vitest';
import { cleanLink, linkParams } from '@/lib/link-decoration';

describe('linkParams', () => {
  it('finds click IDs and campaign tags', () => {
    const url = 'https://shop.example/p?id=7&fbclid=IwAR0abc&utm_source=facebook&utm_medium=social';
    expect(linkParams(url)).toEqual([
      { name: 'fbclid', company: 'Facebook', kind: 'click' },
      { name: 'utm_source', company: 'Google Analytics', kind: 'campaign' },
      { name: 'utm_medium', company: 'Google Analytics', kind: 'campaign' },
    ]);
  });

  it('ignores ordinary parameters and broken addresses', () => {
    expect(linkParams('https://example.com/search?q=shoes&page=2')).toEqual([]);
    expect(linkParams('not a url')).toEqual([]);
  });
});

describe('cleanLink', () => {
  it('keeps the parameters the page needs', () => {
    expect(cleanLink('https://shop.example/p?id=7&gclid=Cj0K&utm_campaign=x#top')).toBe('https://shop.example/p?id=7#top');
  });
});
