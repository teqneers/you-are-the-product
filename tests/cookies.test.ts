import { describe, expect, it } from 'vitest';
import { companyOfCookie, cookieLifetime, cookieName, lifetimeParts } from '@/lib/cookies';

describe('cookieLifetime', () => {
  const now = Date.parse('2026-11-03T12:00:00Z');

  it('prefers Max-Age over Expires', () => {
    expect(cookieLifetime('id=1; Max-Age=7776000; Expires=Wed, 01 Jan 2031 00:00:00 GMT', now)).toBe(7_776_000);
  });

  it('reads Expires dates', () => {
    expect(cookieLifetime('IDE=AHWq; expires=Fri, 03-Nov-2028 12:00:00 GMT; path=/; domain=.doubleclick.net', now)).toBe(
      2 * 366 * 86_400 - 86_400,
    );
  });

  it('returns null for session and expired cookies', () => {
    expect(cookieLifetime('sid=abc; Path=/; HttpOnly', now)).toBeNull();
    expect(cookieLifetime('x=1; Max-Age=0', now)).toBeNull();
    expect(cookieLifetime('x=1; Expires=Thu, 01 Jan 1970 00:00:00 GMT', now)).toBeNull();
  });
});

describe('known first-party tracking cookies', () => {
  it('maps names to companies', () => {
    expect(cookieName('_ga=GA1.1.123; max-age=63072000')).toBe('_ga');
    expect(companyOfCookie('_ga')).toBe('Google');
    expect(companyOfCookie('_ga_ABC123')).toBe('Google');
    expect(companyOfCookie('_fbp')).toBe('Facebook');
    expect(companyOfCookie('session')).toBeNull();
  });
});

describe('lifetimeParts', () => {
  it('picks a readable unit', () => {
    expect(lifetimeParts(2 * 365 * 86_400)).toEqual({ n: 2, unit: 'years' });
    expect(lifetimeParts(90 * 86_400)).toEqual({ n: 3, unit: 'months' });
    expect(lifetimeParts(86_400 / 2)).toEqual({ n: 1, unit: 'days' });
  });
});
