/**
 * Recognises an email address the user typed into a form when it shows up in a third-party request, as text,
 * URL-encoded, Base64 or as an MD5/SHA-1/SHA-256 hash. Trackers hash emails to match people across sites.
 */

export type LeakEncoding = 'plain' | 'base64' | 'md5' | 'sha1' | 'sha256';

export interface TypedValue {
  /** Lowercase strings to search for, each with the encoding it stands for. */
  needles: [string, LeakEncoding][];
}

export const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,253}\.[a-z]{2,24}$/i;

const hex = (buffer: ArrayBuffer) => [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function digest(algorithm: 'SHA-1' | 'SHA-256', text: string) {
  return hex(await crypto.subtle.digest(algorithm, new TextEncoder().encode(text)));
}

/** MD5 (not in WebCrypto); still common for hashed emails. */
export function md5(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const words: number[] = [];
  for (let i = 0; i < bytes.length; i++) words[i >> 2] = (words[i >> 2] ?? 0) | (bytes[i]! << ((i % 4) * 8));
  const bitLength = bytes.length * 8;
  words[bitLength >> 5] = (words[bitLength >> 5] ?? 0) | (0x80 << bitLength % 32);
  words[(((bitLength + 64) >>> 9) << 4) + 14] = bitLength;
  const S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
  const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) | 0);
  let [a0, b0, c0, d0] = [0x67452301, 0xefcdab89 | 0, 0x98badcfe | 0, 0x10325476];
  for (let block = 0; block < words.length; block += 16) {
    let [a, b, c, d] = [a0, b0, c0, d0];
    for (let i = 0; i < 64; i++) {
      const round = i >> 4;
      const f = [(b & c) | (~b & d), (d & b) | (~d & c), b ^ c ^ d, c ^ (b | ~d)][round]!;
      const g = [i, (5 * i + 1) % 16, (3 * i + 5) % 16, (7 * i) % 16][round]!;
      const s = S[round * 4 + (i % 4)]!;
      const sum = (a + f + K[i]! + (words[block + g] ?? 0)) | 0;
      [a, d, c] = [d, c, b];
      b = (b + ((sum << s) | (sum >>> (32 - s)))) | 0;
    }
    [a0, b0, c0, d0] = [(a0 + a) | 0, (b0 + b) | 0, (c0 + c) | 0, (d0 + d) | 0];
  }
  return [a0, b0, c0, d0]
    .map((w) => [0, 8, 16, 24].map((shift) => ((w >>> shift) & 0xff).toString(16).padStart(2, '0')).join(''))
    .join('');
}

/** Everything to look for once the user typed `email`. */
export async function needlesFor(email: string): Promise<TypedValue> {
  const normalised = email.trim().toLowerCase();
  const needles: [string, LeakEncoding][] = [
    [normalised, 'plain'],
    [encodeURIComponent(normalised), 'plain'],
    [btoa(normalised).replace(/=+$/, '').toLowerCase(), 'base64'],
    [md5(normalised), 'md5'],
    [await digest('SHA-1', normalised), 'sha1'],
    [await digest('SHA-256', normalised), 'sha256'],
  ];
  return { needles };
}

/** The encoding under which a typed value appears in the request, if it does. */
export function findTyped(typed: TypedValue[], url: string, body: string | undefined): LeakEncoding | null {
  const haystack = `${url}\n${body ?? ''}`.toLowerCase();
  for (const value of typed) {
    for (const [needle, encoding] of value.needles) if (haystack.includes(needle)) return encoding;
  }
  return null;
}
