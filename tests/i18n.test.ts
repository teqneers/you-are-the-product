import { describe, expect, it } from 'vitest';
import { t } from '@/lib/i18n';

describe('t', () => {
  it('fills placeholders and picks the plural form', () => {
    expect(t('live.requests', { n: 1 })).toMatch(/^1 \w+$/);
    expect(t('live.requests', { n: 1 })).not.toBe(t('live.requests', { n: 2 }).replace('2', '1'));
  });

  it('can pluralise by a different value than n', () => {
    const one = t('dash.onSites', { n: 1, total: 1, count: 1 });
    const many = t('dash.onSites', { n: 1, total: 7, count: 7 });
    expect(one).not.toBe(many.replace('7', '1'));
  });
});
