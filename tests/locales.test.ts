import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { en, type Text } from '@/lib/locales/en';
import { de } from '@/lib/locales/de';
import { es } from '@/lib/locales/es';
import { fr } from '@/lib/locales/fr';
import { it as itMessages } from '@/lib/locales/it';
import { nl } from '@/lib/locales/nl';
import { pl } from '@/lib/locales/pl';
import { pt } from '@/lib/locales/pt';
import { cs } from '@/lib/locales/cs';
import { da } from '@/lib/locales/da';
import { fi } from '@/lib/locales/fi';
import { ja } from '@/lib/locales/ja';
import { ko } from '@/lib/locales/ko';
import { sv } from '@/lib/locales/sv';

const LOCALES = { de, es, fr, it: itMessages, nl, pl, pt, cs, da, sv, fi, ja, ko };
const forms = (text: Text): string[] => (typeof text === 'string' ? [text] : Object.values(text).filter((f) => f !== undefined));
const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const tags = (text: string) => [...text.matchAll(/<\/?\w+>/g)].map((m) => m[0]).sort();

describe.each(Object.entries(LOCALES))('%s', (_, messages) => {
  it('has exactly the English keys', () => {
    expect(Object.keys(messages).sort()).toEqual(Object.keys(en).sort());
  });

  it('keeps placeholders, tags and plural shape', () => {
    for (const [key, text] of Object.entries(en) as [keyof typeof en, Text][]) {
      const translated = messages[key];
      expect(typeof translated, key).toBe(typeof text);
      const expected = new Set(forms(text).flatMap(placeholders));
      for (const form of forms(translated)) {
        for (const name of placeholders(form)) expect(expected, `${key}: {${name}}`).toContain(name);
        expect(tags(form), key).toEqual(tags(forms(text)[0] ?? ''));
      }
      if (typeof translated !== 'string') expect(translated.other, key).toBeTruthy();
    }
  });
});

describe('store texts in public/_locales', () => {
  // Safari rejects the upload to App Store Connect when a description is longer (Chrome allows 132).
  it.each(readdirSync('public/_locales'))('%s: description has at most 112 characters', (locale) => {
    const messages = JSON.parse(readFileSync(`public/_locales/${locale}/messages.json`, 'utf8'));
    expect([...messages.extDescription.message].length).toBeLessThanOrEqual(112);
  });
});
