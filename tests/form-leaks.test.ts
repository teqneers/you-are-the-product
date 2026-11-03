import { describe, expect, it } from 'vitest';
import { findTyped, md5, needlesFor } from '@/lib/form-leaks';

describe('md5', () => {
  it('matches known digests', () => {
    expect(md5('')).toBe('d41d8cd98f00b204e9800998ecf8427e');
    expect(md5('abc')).toBe('900150983cd24fb0d6963f7d28e17f72');
    expect(md5('The quick brown fox jumps over the lazy dog')).toBe('9e107d9d372bb6826bd81d3542a419d6');
  });
});

describe('findTyped', () => {
  it('finds a typed email as text, Base64 or hash', async () => {
    const typed = [await needlesFor(' Max@Example.org ')];
    expect(findTyped(typed, 'https://t.example/c?e=max%40example.org', undefined)).toBe('plain');
    expect(findTyped(typed, 'https://t.example/c', `{"u":"${btoa('max@example.org')}"}`)).toBe('base64');
    expect(findTyped(typed, `https://t.example/c?h=${md5('max@example.org')}`, undefined)).toBe('md5');
    const sha = '8c9e5d6c9d4d3b0e3a1f2ce2d3e4f9f8b7f0a0b6b2a3c4d5e6f7a8b9c0d1e2f3';
    expect(findTyped(typed, `https://t.example/c?h=${sha}`, undefined)).toBeNull();
  });

  it('finds the SHA-256 hash trackers use for matching', async () => {
    const typed = [await needlesFor('max@example.org')];
    const sha256 = typed[0]!.needles.find(([, e]) => e === 'sha256')![0];
    expect(sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(findTyped(typed, 'https://t.example/c', `ud[em]=${sha256}`)).toBe('sha256');
  });
});
