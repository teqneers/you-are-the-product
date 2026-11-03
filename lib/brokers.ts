import data from '../data/brokers.json';

/** A company that is officially registered as a data broker: it buys and sells personal data. */
export interface Broker {
  /** US state registries the company is listed in, e.g. ['CA', 'OR']. */
  registries: string[];
  /** The legal name it registered under, e.g. "LiveRamp Holdings, Inc.". */
  registeredAs: string;
}

export interface BrokerSource {
  /** Two-letter state code, e.g. 'CA'. */
  registry: string;
  /** Public page of the registry. */
  url: string;
  /** Day the registry was downloaded, YYYY-MM-DD. */
  fetched: string;
}

const { sources, companies } = data as { sources: BrokerSource[]; companies: Record<string, Broker> };

/** The state data broker registries data/brokers.json was built from. */
export const BROKER_SOURCES: readonly BrokerSource[] = sources;

/** The data broker registration of one of our companies (by display name), if it has one. */
export const brokerOf = (company: string | null): Broker | undefined =>
  company !== null && Object.hasOwn(companies, company) ? companies[company] : undefined;
