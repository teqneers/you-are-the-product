import { browser } from 'wxt/browser';
import { TRACKING } from './buckets';
import { bucketFor, companyFor, knownCname } from './trackers';

/** Hostname → canonical name from DNS (Firefox only), or null if it has none. */
const resolved = new Map<string, string | null>();

type DnsApi = { resolve(host: string, flags: string[]): Promise<{ canonicalName?: string }> };
const dns = (browser as unknown as { dns?: DnsApi }).dns;

function resolveLater(hostname: string) {
  if (!dns || resolved.has(hostname)) return;
  resolved.set(hostname, null);
  dns
    .resolve(hostname, ['canonical_name'])
    .then((r) => resolved.set(hostname, r.canonicalName && r.canonicalName !== hostname ? r.canonicalName : null))
    .catch(() => {});
}

/**
 * The tracker behind a subdomain of the visited site, if it is one: "CNAME cloaking" makes a tracker
 * look like part of the site (metrics.site.com) so that blockers and browsers treat it as first party.
 * Known aliases come from the tracker list; Firefox can also ask DNS, whose answer is used from the
 * next request on. Only targets that track count, not CDNs.
 */
export function cloakedTracker(hostname: string): string | null {
  const target = knownCname(hostname) ?? resolved.get(hostname) ?? null;
  if (!target) resolveLater(hostname);
  if (!target || !companyFor(target)) return null;
  return TRACKING.includes(bucketFor(target)) ? target : null;
}
