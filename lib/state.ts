import { browser } from 'wxt/browser';
import type { LinkParam } from './link-decoration';
import type { Bucket } from './buckets';
import type { Leaks } from './leaks';
import type { Consent } from './tcf';
import type { Choice } from './consent-verdict';
import type { LeakEncoding } from './form-leaks';
import type { PixelEvent } from './pixels';

/** A third-party domain seen while the user was on some site. */
export interface Party {
  company: string | null;
  /** Domain whose favicon stands for this party: the company's website, or the domain itself. */
  icon: string;
  /** What kind of third party this is (advertising, statistics, CDN, …). Missing in old data. */
  bucket?: Bucket;
  categories: string[];
  /** Site (registrable domain) → number of requests made from it. */
  sites: Record<string, number>;
  requests: number;
}

export interface Visit {
  visits: number;
  lastSeen: number;
  /** Most companies that tracked you on one visit after "Accept" and after "Reject" on the cookie banner. */
  tracking?: Partial<Record<Choice, number>>;
}

export type FingerprintTechnique = 'canvas' | 'webgl' | 'audio' | 'fonts' | 'hardware';
export const FINGERPRINT_TECHNIQUES: FingerprintTechnique[] = ['canvas', 'webgl', 'audio', 'fonts', 'hardware'];

/** One Prebid ad auction for ad slots on the page. CPM = price per 1000 ad views. */
export interface Auction {
  adUnits: number;
  bidders: string[];
  bids: { bidder: string; cpm: number; currency: string }[];
  won?: { bidder: string; cpm: number; currency: string };
}

/** What happened in one tab since its current page started loading. */
export interface TabSession {
  site: string;
  /** Hostname of the page, e.g. www.spiegel.de, to recognise it inside tracker requests. */
  host?: string;
  startedAt: number;
  /** Pages of this site opened in this tab during the visit (1 when missing). */
  pages?: number;
  /** ms after page start of the user's first click, usually on the cookie banner. */
  firstClick?: number;
  /** Prebid auction id → auction. */
  auctions?: Record<string, Auction>;
  /** What the cookie banner recorded as your consent (decoded TCF string). */
  consent?: Consent;
  /** "Accept" or "Reject" on the cookie banner, and ms after page start it was clicked. */
  choice?: { kind: Choice; at: number; source?: 'click' | 'page' };
  /** Script domain → fingerprinting techniques it used on this page, with what some of them returned. */
  fingerprints?: Record<
    string,
    { company: string | null; techniques: FingerprintTechnique[]; samples?: Partial<Record<FingerprintTechnique, string>> }
  >;
  /** Events that ad and analytics pixels reported (viewed product, added to cart, searched …). */
  pixels?: PixelEvent[];
  /** Third-party domain → how it received an email address typed into a form on this page. */
  formLeaks?: Record<string, { company: string | null; encoding: LeakEncoding; beforeSubmit: boolean }>;
  /** How many email addresses were typed on this page (the addresses themselves stay in memory only). */
  typedEmails?: number;
  /** Tracking parameters in the page address (names only, not their values). */
  linkParams?: LinkParam[];
  /** Domains the click was forwarded through before this page, e.g. t.co, bit.ly. */
  redirects?: string[];
  /**
   * Longest cookie lifetime in seconds: third-party domain → its Set-Cookie headers, or "cookie:<name>" → a
   * tracking script's cookie on the site itself.
   */
  cookies?: Record<string, { company: string | null; name?: string; seconds: number }>;
  /** Third-party domain → requests and ms after page start it first appeared. */
  parties: Record<
    string,
    {
      requests: number;
      firstSeen: number;
      /** ms after page start of the latest request. */
      lastSeen?: number;
      company: string | null;
      icon: string;
      bucket?: Bucket;
      leaks?: Leaks;
      /** Person IDs sent to this domain. */
      ids?: string[];
      /** Subdomains of the visited site that turned out to be this tracker in disguise. */
      cloakedAs?: string[];
      /** Country code of the server that answered (from its IP address). */
      country?: string;
    }
  >;
}

export interface State {
  sites: Record<string, Visit>;
  parties: Record<string, Party>;
  tabs: Record<number, TabSession>;
}

export const STATE_KEY = 'state';

export const emptyState = (): State => ({ sites: {}, parties: {}, tabs: {} });

export async function loadState(): Promise<State> {
  const stored = await browser.storage.local.get(STATE_KEY);
  return { ...emptyState(), ...(stored[STATE_KEY] as State | undefined) };
}

export function saveState(state: State) {
  return browser.storage.local.set({ [STATE_KEY]: state });
}

/** Calls `onChange` with the current state now and whenever it changes. */
export function watchState(onChange: (state: State) => void) {
  loadState().then(onChange);
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[STATE_KEY]) {
      onChange({ ...emptyState(), ...(changes[STATE_KEY].newValue as State | undefined) });
    }
  });
}

/** Display name for a party: its company if known, otherwise the domain itself. */
export const ownerOf = (domain: string, company: string | null) => company ?? domain;
