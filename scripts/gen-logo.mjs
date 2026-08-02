// Generate the Organization logo asserted by the JSON-LD graph.
//
//   npm run build  →  public/assets/logo.png  (512x512)
//
// schemaGraph() in src/lib/content.js points Organization.logo at this path —
// it referenced the file for months while it did not exist, which silently
// invalidated the Organization block for every consumer that fetches the image.
// check-build.mjs now asserts dist/assets/logo.png is served.
//
// This cannot just be favicon.svg rasterized: favicon.svg sets font-family
// "system-ui", which resvg cannot resolve with loadSystemFonts:false, so the
// mark is re-emitted here with the real font name or the "QR" glyphs render as
// nothing.
//
// Fonts: resvg cannot read woff2, and the self-hosted files report family names
// "Space Grotesk Light" and "IBM Plex Mono SemiBold" rather than their CSS
// names. BOTH failures are silent — resvg drops glyphs it has no font for — so
// the woff2 are decompressed to ttf in .og-fonts/ and referenced by real name.
//
// Runs inside `npm run build`, so it must stay browser-free — Vercel's build
// container has no Chromium. The OG card (scripts/gen-og.mjs) does need one,
// which is why the two were split apart.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { decompress } from 'wawoff2';

const LOGO = 512;
const BRAND = '#7b5cff', BRAND_2 = '#a24dff', WHITE = '#ffffff';

const FONT_DIR = '.og-fonts';
const DISPLAY = 'Space Grotesk Light';
const FONTS = [['space-grotesk-700-latin.woff2', 'sg-700.ttf']];

async function ensureFonts() {
  mkdirSync(FONT_DIR, { recursive: true });
  for (const [src, out] of FONTS) {
    if (existsSync(`${FONT_DIR}/${out}`)) continue;
    writeFileSync(`${FONT_DIR}/${out}`, Buffer.from(await decompress(readFileSync(`public/fonts/${src}`))));
  }
}

/** The brand mark from public/favicon.svg, re-emitted at Organization-logo size. */
function composeLogo(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">
<defs><linearGradient id="lg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
  <stop stop-color="${BRAND}"/><stop offset="1" stop-color="${BRAND_2}"/></linearGradient></defs>
<rect width="32" height="32" rx="9" fill="url(#lg)"/>
<text x="16" y="21.5" text-anchor="middle" fill="${WHITE}" font-family="${DISPLAY}"
  font-weight="700" font-size="12.5">QR</text>
</svg>`;
}

await ensureFonts();
mkdirSync('public/assets', { recursive: true });

const png = new Resvg(composeLogo(LOGO), {
  fitTo: { mode: 'width', value: LOGO },
  font: { fontDirs: [FONT_DIR], loadSystemFonts: false, defaultFontFamily: DISPLAY },
}).render().asPng();

writeFileSync('public/assets/logo.png', png);
console.log(`wrote public/assets/logo.png (${LOGO}x${LOGO}, ${Math.round(png.length / 1024)} KB)`);
