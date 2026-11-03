// Renders assets/icon.svg to the PNG sizes the browsers need (public/icon/<size>.png) and to the macOS app icons of
// the Safari wrapper app (with the margin macOS icons have around the rounded square).
import sharp from 'sharp';

const SVG = 'assets/icon.svg';
const render = (size) => sharp(SVG, { density: Math.max(72, (72 * size) / 128) * 2 }).resize(size, size).png();

for (const size of [16, 32, 48, 96, 128]) await render(size).toFile(`public/icon/${size}.png`);

const MAC = 'safari/You Are The Product/You Are The Product/Assets.xcassets/AppIcon.appiconset';
for (const base of [16, 32, 128, 256, 512]) {
  for (const scale of [1, 2]) {
    const size = base * scale;
    const inner = Math.round(size * 0.8);
    const tile = await render(inner).toBuffer();
    const pad = Math.round((size - inner) / 2);
    await sharp(tile)
      .extend({ top: pad, bottom: size - inner - pad, left: pad, right: size - inner - pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(`${MAC}/mac-icon-${base}@${scale}x.png`);
  }
}
await render(128).toFile('safari/You Are The Product/You Are The Product/Resources/Icon.png');
