import data from '../data/vendor-names.json';

/**
 * Names of the companies in IAB Europe's Global Vendor List, so the consent string's vendor ids can be shown as
 * names. Only ids and names ship with the extension (`npm run vendors` rebuilds them); it never downloads the list.
 */
const { vendors, vendorListVersion, lastUpdated } = data as {
  vendors: Record<string, string>;
  vendorListVersion: number;
  lastUpdated: string;
};

/** Version and date of the newest list the names come from. */
export const VENDOR_LIST = { version: vendorListVersion, updated: lastUpdated } as const;

/** Company name of a TCF vendor id, if it is in the bundled list. */
export const vendorName = (id: number | string): string | undefined =>
  Object.hasOwn(vendors, String(id)) ? vendors[String(id)] : undefined;
