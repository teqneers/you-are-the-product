import type { FingerprintTechnique } from './state';

export type MirrorKey = 'ua' | 'screen' | 'tz' | 'lang' | 'cores' | 'memory' | 'gpu' | 'canvas' | 'fonts';

/**
 * Rough identifying information per attribute in bits, from the Panopticlick (Eckersley 2010) and AmIUnique
 * (Laperdrix et al. 2016) studies. Attributes are not independent, so the sum overestimates; it is meant as an
 * order of magnitude.
 */
const BITS: Record<MirrorKey, number> = {
  ua: 10,
  screen: 4.8,
  tz: 3,
  lang: 5.9,
  cores: 1.5,
  memory: 1,
  gpu: 3.4,
  canvas: 8.3,
  fonts: 13.9,
};

/** Techniques that reveal something beyond what every page can read anyway. */
const BY_TECHNIQUE: Partial<Record<FingerprintTechnique, MirrorKey>> = { canvas: 'canvas', webgl: 'gpu', fonts: 'fonts' };

/**
 * What a script on any page can read about this browser without asking (the extension page sees the same values),
 * plus what the fingerprinting techniques used on the page revealed.
 */
export function mirrorOf(techniques: Set<FingerprintTechnique>, gpu?: string): [MirrorKey, string][] {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const rows: [MirrorKey, string][] = [
    ['ua', nav.userAgent],
    ['screen', `${screen.width} × ${screen.height}, ${devicePixelRatio}×`],
    ['tz', Intl.DateTimeFormat().resolvedOptions().timeZone],
    ['lang', [...nav.languages].join(', ')],
    ['cores', String(nav.hardwareConcurrency ?? '?')],
  ];
  if (nav.deviceMemory) rows.push(['memory', `${nav.deviceMemory} GB`]);
  for (const technique of techniques) {
    const key = BY_TECHNIQUE[technique];
    if (key === 'gpu') rows.push(['gpu', gpu ?? '?']);
    else if (key) rows.push([key, '']);
  }
  return rows;
}

/** Sum of the rough bits of the shown attributes, and how many browsers that would tell apart (capped). */
export function identifyingBits(keys: MirrorKey[]): { bits: number; people: number } {
  const bits = Math.round(keys.reduce((sum, k) => sum + BITS[k], 0));
  return { bits, people: Math.min(2 ** bits, 8_000_000_000) };
}
