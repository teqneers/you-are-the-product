// Background only: downloads favicons. Kept apart from icons.ts so the pages don't bundle tldts.
import { parse } from 'tldts';

const SIZE = 32;

/**
 * Downloads a favicon without cookies and shrinks it to a small PNG, so the icon cache stays small
 * and the graph never contacts these domains itself.
 */
export async function fetchIcon(urls: string[], domain?: string): Promise<string> {
  const icon = await firstDecodable(urls);
  if (icon || !domain) return icon;
  // Many sites keep their icon elsewhere and only declare it in the page's <link rel="icon">.
  for (const page of [`https://${domain}/`, `https://www.${domain}/`].filter(isPublicHttps)) {
    const declared = await declaredIcons(page);
    if (declared.length) return firstDecodable(declared);
  }
  return '';
}

async function declaredIcons(page: string): Promise<string[]> {
  try {
    const res = await fetch(page, FETCH_OPTIONS());
    if (!res.ok) return [];
    const html = (await res.text()).slice(0, 200_000);
    return [...html.matchAll(/<link\b[^>]*>/gi)]
      .map((m) => m[0])
      .filter((tag) => /rel=["']?[^"'>]*icon/i.test(tag))
      .map((tag) => tag.match(/href=["']?([^"'\s>]+)/i)?.[1])
      .filter((href): href is string => !!href && !href.endsWith('.svg'))
      .map((href) => new URL(href.replaceAll('&amp;', '&'), res.url).href);
  } catch {
    return [];
  }
}

/**
 * The extension may fetch without the page's restrictions, so icon URLs (some taken from page HTML)
 * must be https on a public domain: no IPs, localhost or intranet names such as router.local.
 */
function isPublicHttps(url: string) {
  try {
    const u = new URL(url);
    const host = parse(u.hostname);
    return u.protocol === 'https:' && host.isIcann === true && !host.isIp && !!host.domain;
  } catch {
    return false;
  }
}

/**
 * Redirects are not followed: a public URL could otherwise redirect into the local network.
 * Both example.com and www.example.com are tried, which covers the usual favicon redirect.
 * (DNS rebinding remains possible, but the request has no cookies and the answer only becomes a local image.)
 */
const FETCH_OPTIONS = (): RequestInit => ({
  credentials: 'omit',
  redirect: 'manual',
  signal: AbortSignal.timeout(5000),
});

async function firstDecodable(urls: string[]): Promise<string> {
  for (const url of urls.filter(isPublicHttps)) {
    try {
      const res = await fetch(url, FETCH_OPTIONS());
      if (!res.ok) continue;
      const bitmap = await createImageBitmap(await res.blob(), {
        resizeWidth: SIZE,
        resizeHeight: SIZE,
        resizeQuality: 'high',
      });
      const canvas = new OffscreenCanvas(SIZE, SIZE);
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
      const png = await canvas.convertToBlob({ type: 'image/png' });
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(png);
      });
    } catch {
      // Not found, not an image, or a format the browser cannot decode: try the next URL.
    }
  }
  return '';
}

/** Default favicon locations of a domain. */
export const faviconUrls = (domain: string) => [`https://${domain}/favicon.ico`, `https://www.${domain}/favicon.ico`];
