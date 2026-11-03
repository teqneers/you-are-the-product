// Downloads the logos listed in data/logo-sources.json into data/logos.json (company → data URL),
// so the most common trackers show their logo even when their website is blocked or unreachable.
// A source is either a domain (its favicon is used) or a full image URL.
// Every logo is shrunk to a 32px PNG. Logos that cannot be downloaded this time (blocked network)
// are kept from the previous run.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import decodeIco from 'decode-ico';
import sharp from 'sharp';

const MAX_BYTES = 1_000_000;
const SIZE = 32;
const OUT = new URL('../data/logos.json', import.meta.url);
const previous = existsSync(OUT) ? JSON.parse(readFileSync(OUT)) : {};
const sources = JSON.parse(readFileSync(new URL('../data/logo-sources.json', import.meta.url)));
const { companies } = JSON.parse(readFileSync(new URL('../data/trackers.json', import.meta.url)));
const known = new Set(companies.map((c) => c.name));

async function get(url) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(8000),
    headers: { 'user-agent': 'you-are-the-product logo builder' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

/** Image type from the file's first bytes; servers often send a wrong or missing content-type. */
function sniff(bytes) {
  const hex = bytes.subarray(0, 4).toString('hex');
  if (hex === '89504e47') return 'image/png';
  if (hex === '00000100') return 'image/x-icon';
  if (hex.startsWith('474946')) return 'image/gif';
  if (hex.startsWith('ffd8ff')) return 'image/jpeg';
  if (bytes.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  if (/^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg/i.test(bytes.subarray(0, 500).toString())) return 'image/svg+xml';
  return null;
}

/** Shrinks any supported image (ICO, PNG, JPEG, GIF, WebP, SVG) to a small 32px PNG data URL. */
async function shrink(bytes, type) {
  let input = sharp(bytes);
  if (type === 'image/x-icon') {
    // Pick the frame closest to the target size; ICO frames are either PNGs or raw bitmaps.
    const frames = decodeIco(bytes).sort((a, b) => Math.abs(a.width - SIZE) - Math.abs(b.width - SIZE));
    const f = frames.find((x) => x.width >= SIZE) ?? frames[0];
    input =
      f.type === 'png'
        ? sharp(Buffer.from(f.data))
        : sharp(Buffer.from(f.data), { raw: { width: f.width, height: f.height, channels: 4 } });
  }
  const png = await input
    .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9, palette: true })
    .toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
}

/** Icon URLs declared in the page's <link rel="icon">, sizes near 48px first. */
async function declaredIcons(page) {
  const res = await get(page);
  const html = (await res.text()).slice(0, 300_000);
  return [...html.matchAll(/<link\b[^>]*>/gi)]
    .map((m) => m[0])
    .filter((tag) => /rel=["']?[^"'>]*icon/i.test(tag))
    .map((tag) => ({ href: tag.match(/href=["']?([^"'\s>]+)/i)?.[1], sizes: tag.match(/sizes=["']?(\d+)/i)?.[1] }))
    .filter((i) => i.href)
    .sort((a, b) => Math.abs((a.sizes ?? 32) - 48) - Math.abs((b.sizes ?? 32) - 48))
    .map((i) => new URL(i.href.replaceAll('&amp;', '&'), res.url).href);
}

/** Returns { logo } or { reason } explaining why every candidate failed. */
async function logoFor(source) {
  const reasons = [];
  const candidates = [];
  if (source.startsWith('https://')) {
    candidates.push(source);
  } else {
    candidates.push(`https://www.${source}/favicon.ico`, `https://${source}/favicon.ico`);
    for (const page of [`https://www.${source}/`, `https://${source}/`]) {
      try {
        candidates.push(...(await declaredIcons(page)));
        break;
      } catch (e) {
        reasons.push(`page ${e.cause?.code ?? e.message}`);
      }
    }
  }
  for (const url of candidates) {
    try {
      const bytes = Buffer.from(await (await get(url)).arrayBuffer());
      const type = sniff(bytes);
      if (!type) reasons.push('not an image');
      else if (bytes.length > MAX_BYTES) reasons.push(`too big (${Math.round(bytes.length / 1024)} KB)`);
      else return { logo: await shrink(bytes, type) };
    } catch (e) {
      reasons.push(e.cause?.code ?? e.message);
    }
  }
  return { reason: [...new Set(reasons)].join(', ') };
}

const logos = {};
const failed = [];
const kept = [];
await Promise.all(
  Object.entries(sources)
    .filter(([name]) => !name.startsWith('_'))
    .map(async ([name, source]) => {
      if (!known.has(name)) console.warn(`unknown company in logo-sources.json: ${name}`);
      const { logo, reason } = await logoFor(source);
      if (logo) logos[name] = logo;
      else if (previous[name]) {
        const [, type, b64] = previous[name].match(/^data:([^;]+);base64,(.*)$/);
        logos[name] = await shrink(Buffer.from(b64, 'base64'), type);
        kept.push(name);
      } else failed.push(`  ${name} (${source}): ${reason}`);
    }),
);
writeFileSync(OUT, JSON.stringify(logos));
console.log(`${Object.keys(logos).length} logos, ${Math.round(JSON.stringify(logos).length / 1024)} KB`);
if (kept.length) console.log(`kept from previous run (download failed now): ${kept.sort().join(', ')}`);
if (failed.length) console.log(`no logo:\n${failed.sort().join('\n')}`);
