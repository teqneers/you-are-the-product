import { describe, expect, it } from 'vitest';
import { choiceOf, consentVerdict } from '@/lib/consent-verdict';
import type { TabSession } from '@/lib/state';

describe('choiceOf', () => {
  it('recognises banner buttons in several languages', () => {
    expect(choiceOf('Alle akzeptieren')).toBe('accept');
    expect(choiceOf('Accept all')).toBe('accept');
    expect(choiceOf('Tout refuser')).toBe('reject');
    expect(choiceOf('Continuer sans accepter')).toBe('reject');
    expect(choiceOf('Nur notwendige Cookies')).toBe('reject');
    expect(choiceOf('Ablehnen')).toBe('reject');
    expect(choiceOf('Odmítnout vše')).toBe('reject');
    expect(choiceOf('Nesouhlasím')).toBe('reject');
    expect(choiceOf('Souhlasím')).toBe('accept');
    expect(choiceOf('同意しない')).toBe('reject');
    expect(choiceOf('すべて同意する')).toBe('accept');
    expect(choiceOf('모두 거부')).toBe('reject');
    expect(choiceOf('Hyväksy kaikki')).toBe('accept');
    // Labels seen on real German sites (2026-11).
    expect(choiceOf('Allen Zwecken zustimmen')).toBe('accept');
    expect(choiceOf('Consent and continue')).toBe('accept');
    expect(choiceOf('Einwilligen')).toBe('accept');
    expect(choiceOf('Alle Cookies zulassen')).toBe('accept');
    expect(choiceOf('Mit Werbung weiterlesen')).toBe('accept');
    expect(choiceOf('Weiter ohne Einwilligung')).toBe('reject');
    expect(choiceOf('Nicht einwilligen')).toBe('reject');
    expect(choiceOf('Do not consent')).toBe('reject');
    expect(choiceOf('Weiterlesen')).toBeNull();
    expect(choiceOf('Manage consent')).toBeNull();
    expect(choiceOf('Einwilligungen verwalten')).toBeNull();
    expect(choiceOf('Auswahl speichern')).toBeNull();
  });
});

describe('consentVerdict', () => {
  const party = (bucket: string, firstSeen: number, lastSeen = firstSeen) =>
    ({ requests: 1, firstSeen, lastSeen, company: null, icon: '', bucket }) as TabSession['parties'][string];
  const session = (choice?: TabSession['choice']): TabSession => ({
    site: 'news.example',
    startedAt: 0,
    choice,
    parties: {
      'cmp.example': party('consent', 100),
      'ads.example': party('ads', 200),
      'late.example': party('analytics', 9000),
      'cdn.example': party('cdn', 9000),
      'ongoing.example': party('tracker', 300, 9500),
    },
  });
  const owner = (domain: string) => domain;

  it('lists tracking before the choice and after "Reject"', () => {
    const v = consentVerdict(session({ kind: 'reject', at: 5000 }), owner)!;
    expect(v.beforeChoice).toEqual(['ads.example', 'ongoing.example']);
    expect(v.afterReject).toEqual(['late.example', 'ongoing.example']);
  });

  it('counts everything as before the choice while the banner is unanswered', () => {
    expect(consentVerdict(session(), owner)!.beforeChoice).toEqual(['ads.example', 'late.example', 'ongoing.example']);
  });
});
