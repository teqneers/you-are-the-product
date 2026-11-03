import { labels } from './i18n';

/** Simple groups for the many DuckDuckGo tracker categories. */
export type Bucket =
  | 'session'
  | 'ads'
  | 'social'
  | 'analytics'
  | 'fraud'
  | 'tracker'
  | 'embed'
  | 'cdn'
  | 'consent'
  | 'unknown';

export const BUCKET_LABELS = labels<Bucket>('bucket');

/** Groups that collect data about the person; the others mostly deliver content. */
export const TRACKING: Bucket[] = ['session', 'ads', 'social', 'analytics', 'fraud', 'tracker'];
/** Groups that can be hidden as "infrastructure". */
export const INFRASTRUCTURE: Bucket[] = ['embed', 'cdn', 'consent'];

/** Display order, most invasive first. */
export const BUCKET_ORDER: Bucket[] = [...TRACKING, 'unknown', ...INFRASTRUCTURE];
