import { describe, expect, it } from 'vitest';
import data from '@/data/site-categories.json';
import { categoryOf, guessCategory, SENSITIVE, SITE_CATEGORIES } from '@/lib/site-categories';

const lists = data as Record<string, string[]>;

describe('curated list', () => {
  it('uses only known categories and lists every category', () => {
    expect(Object.keys(lists).sort()).toEqual([...SITE_CATEGORIES].sort());
  });

  it('holds 600 to 1200 lowercase ASCII domains, each listed once', () => {
    const all = Object.values(lists).flat();
    expect(all.length).toBeGreaterThanOrEqual(600);
    expect(all.length).toBeLessThanOrEqual(1200);
    expect(new Set(all).size).toBe(all.length);
    for (const domain of all) {
      expect(domain).toMatch(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/);
      expect(domain.startsWith('www.')).toBe(false);
    }
  });

  it('wins over the keyword rules for every listed domain', () => {
    for (const [category, domains] of Object.entries(lists)) {
      for (const domain of domains) expect(categoryOf(domain), domain).toBe(category);
    }
  });
});

describe('categoryOf', () => {
  it('finds well-known sites', () => {
    expect(categoryOf('apotheken-umschau.de')).toBe('health');
    expect(categoryOf('stepstone.de')).toBe('jobs');
    expect(categoryOf('spiegel.de')).toBe('news');
    expect(categoryOf('zalando.de')).toBe('shopping');
    expect(categoryOf('parship.de')).toBe('dating');
    expect(categoryOf('check24.de')).toBe('finance');
    expect(categoryOf('chefkoch.de')).toBe('food');
    expect(categoryOf('immobilienscout24.de')).toBe('real-estate');
    expect(categoryOf('mobile.de')).toBe('cars');
    expect(categoryOf('derstandard.at')).toBe('news');
    expect(categoryOf('nzz.ch')).toBe('news');
    expect(categoryOf('bbc.co.uk')).toBe('news');
    expect(categoryOf('mercadolivre.com.br')).toBe('shopping');
  });

  it('strips subdomains, www, case and a trailing dot', () => {
    expect(categoryOf('www.spiegel.de')).toBe('news');
    expect(categoryOf('WWW.Spiegel.DE.')).toBe('news');
    expect(categoryOf('de.indeed.com')).toBe('jobs');
    expect(categoryOf('m.facebook.com')).toBe('social');
    expect(categoryOf('banking.sparkasse.de')).toBe('finance');
  });

  it('falls back to the keyword rules on the site name', () => {
    expect(categoryOf('online-apotheke-muster.de')).toBe('health');
    expect(categoryOf('zahnarzt-mueller.de')).toBe('health');
    expect(categoryOf('www.stadtapotheke-musterstadt.at')).toBe('health');
    expect(categoryOf('pharmacie-du-centre.fr')).toBe('health');
    expect(categoryOf('jobs-muenchen.de')).toBe('jobs');
    expect(categoryOf('volksbank-musterstadt.de')).toBe('finance');
    expect(categoryOf('pfarrei-st-anna.de')).toBe('religion');
    expect(categoryOf('beispiel-kliniken.co.uk')).toBe('health');
    expect(categoryOf('zahnärzte-am-markt.de')).toBe('health');
  });

  it('returns null for unknown names, IP addresses and bare hosts', () => {
    expect(categoryOf('example.com')).toBeNull();
    expect(categoryOf('teqneers.de')).toBeNull();
    expect(categoryOf('192.168.0.1')).toBeNull();
    expect(categoryOf('localhost')).toBeNull();
    expect(categoryOf('[::1]')).toBeNull();
    expect(categoryOf('')).toBeNull();
  });
});

describe('guessCategory', () => {
  it('recognises keywords in the supported languages', () => {
    const cases: [string, string][] = [
      ['versandapotheke', 'health'],
      ['farmacia-roma', 'health'],
      ['apteka-online', 'health'],
      ['kantonsspital-baden', 'health'],
      ['zdrowie-portal', 'health'],
      ['sante-plus', 'health'],
      ['karriere-portal', 'jobs'],
      ['stellenmarkt-nord', 'jobs'],
      ['offres-emploi', 'jobs'],
      ['portal-empleo', 'jobs'],
      ['praca', 'jobs'],
      ['autoversicherung-vergleich', 'finance'],
      ['banco-ejemplo', 'finance'],
      ['sparkasse-musterstadt', 'finance'],
      ['dating-club', 'dating'],
      ['flirtportal', 'dating'],
      ['singles-wien', 'dating'],
      ['ev-kirche-musterdorf', 'religion'],
      ['stadtkirche', 'religion'],
      ['bibelstudium', 'religion'],
      ['islam-portal', 'religion'],
      ['green-party', 'politics'],
      ['spd-partei-ortsverein', 'politics'],
      ['partito-democratico', 'politics'],
      ['kinderarzt-praxis', 'health'],
      ['kindergarten-sonnenschein', 'kids'],
      ['uni-musterstadt', 'education'],
      ['musikschule-muster', 'education'],
      ['hotel-zur-post', 'travel'],
      ['reisebuero-mueller', 'travel'],
      ['ferienwohnung-am-see', 'travel'],
      ['immobilien-mueller', 'real-estate'],
      ['autohaus-schmidt', 'cars'],
      ['motorsport-news', 'sports'],
      ['fc-musterstadt', 'sports'],
      ['tsv-1860', 'sports'],
      ['pizzeria-napoli', 'food'],
      ['partyservice-meier', 'food'],
      ['gratis-spiele', 'gaming'],
      ['kino-am-markt', 'entertainment'],
      ['schuhe-online', 'shopping'],
      ['pornoseite', 'adult'],
    ];
    for (const [name, category] of cases) expect(guessCategory(name), name).toBe(category);
  });

  it('keeps a radio keyword away from radiology', () => {
    expect(guessCategory('radiologie-zentrum')).not.toBe('entertainment');
    expect(guessCategory('radio-bremen')).toBe('entertainment');
  });

  it('does not fire on unrelated words that contain a keyword', () => {
    for (const name of [
      'bankett',
      'bankettsaal',
      'datenbank',
      'party-rent',
      'partyzelt',
      'partner',
      'gelsenkirchen',
      'neunkirchen',
      'schwarztee',
      'hospitality-group',
      'transport',
      'passport',
      'workshop',
      'photoshop',
      'preisvergleich',
      'landkreise',
      'backend',
      'hamburger-abendblatt',
      'augsburger-allgemeine',
      'essex',
      'middlesex',
      'churchill',
      'evangelion',
      'hindustantimes',
      'islamabad',
      'motorola',
      'autor',
      'automation',
      'oscars',
      'stellenbosch',
      'immortal',
      'investigativ',
      'sportwetten',
      'beispiele',
      'carsten',
      'wagenknecht',
      'blowjob',
      'arbeitsschutz',
      'example',
    ]) {
      expect(guessCategory(name), name).toBeNull();
    }
  });
});

describe('SENSITIVE', () => {
  it('marks the Art. 9-adjacent categories, and only those', () => {
    expect([...SENSITIVE].sort()).toEqual(['adult', 'dating', 'health', 'politics', 'religion']);
    for (const category of SENSITIVE) expect(SITE_CATEGORIES).toContain(category);
  });
});
