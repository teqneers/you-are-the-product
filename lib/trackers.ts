import data from '../data/trackers.json';
import type { Bucket } from './buckets';

export interface Company {
  name: string;
  /** The company's main website, e.g. google.com. */
  home: string;
  categories: string[];
}

const { companies, domains, buckets, cnames } = data as {
  companies: Company[];
  domains: Record<string, number>;
  buckets: Record<string, Bucket>;
  cnames: Record<string, string>;
};

/** Known CNAME target of a hostname from the tracker list, e.g. smetrics.site.com → x.data.adobedc.net. */
export const knownCname = (hostname: string): string | undefined =>
  Object.hasOwn(cnames, hostname) ? cnames[hostname] : undefined;

/** Finds the company behind a hostname by walking up its subdomains. */
export function companyFor(hostname: string): Company | null {
  let host = hostname;
  while (host.includes('.')) {
    const i = domains[host];
    if (i !== undefined) return companies[i] ?? null;
    host = host.slice(host.indexOf('.') + 1);
  }
  return null;
}

const byName = new Map(companies.map((c) => [c.name, c]));

/** Looks up a company by its display name. */
export const companyNamed = (name: string) => byName.get(name);

/** Unlisted hostnames that look like a content delivery network, e.g. chefkoch-cdn.de or static.example.com. */
const LOOKS_LIKE_CDN = /(^|[.-])(cdn|static|assets?|img|images|media|fonts?)([.-]|\d|$)/;

/** The group (advertising, statistics, CDN, …) a request to this hostname belongs to. */
export function bucketFor(hostname: string): Bucket {
  let host = hostname;
  while (host.includes('.')) {
    const b = buckets[host];
    if (b) return b;
    host = host.slice(host.indexOf('.') + 1);
  }
  return LOOKS_LIKE_CDN.test(hostname) ? 'cdn' : 'unknown';
}
