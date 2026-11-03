import data from '../data/reach.json';

const { source, license, month, companies, domains } = data as {
  source: string;
  license: string;
  month: string;
  metric: string;
  companies: Record<string, number>;
  domains: Record<string, number>;
};

/** Where the reach figures come from, for the attribution the CC BY 4.0 licence requires. */
export const REACH_SOURCE = {
  name: 'WhoTracks.me by Ghostery',
  url: 'https://www.ghostery.com/whotracksme',
  license,
  /** Month of the dataset, e.g. 2026-09. */
  month,
  /** The raw dataset that was downloaded. */
  dataset: source,
} as const;

/**
 * Share (0–1) of popular websites a company or third-party domain appears on, e.g. 0.98 for Google.
 * The company figure comes first; otherwise the hostname is looked up, walking up its labels.
 */
export function reachOf(company: string | null, domain: string): number | undefined {
  if (company && Object.hasOwn(companies, company)) return companies[company];
  let host = domain.toLowerCase();
  while (host.includes('.')) {
    if (Object.hasOwn(domains, host)) return domains[host];
    host = host.slice(host.indexOf('.') + 1);
  }
  return undefined;
}
