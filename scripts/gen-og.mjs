// Generate the Open Graph / Twitter preview images.
//
//   npm run og            → public/assets/og/<slug>.png  (one per page)
//   npm run og -- --one   → just home.png, for a quick look
//
// Base.astro has always pointed og:image at /assets/og/<slug>.png. The files
// were never generated, so every page advertised a 404 — which unfurls worse in
// Slack, iMessage and social than declaring no image at all.
//
// The QR in the artwork is built with the SAME encoder the app ships
// (lib/qr.js), not a decorative mock, so the code in the preview actually scans
// and points at the page it illustrates.
//
// Fonts: resvg cannot read woff2, and Space Grotesk is not a system font, so the
// self-hosted woff2 are decompressed to ttf into .og-fonts/ (gitignored) first.
// Without this the text silently renders blank — resvg drops glyphs it has no
// font for rather than erroring.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { decompress } from 'wawoff2';
import { getMatrix, buildSVG } from '../src/lib/qr.js';

const W = 1200, H = 630;
const C = {
  page: '#e8e0cf', surface: '#faf6ec', surface2: '#f2ecdd', border: '#e6dfce',
  border2: '#d9d0bb', ink: '#2b2140', muted: '#6b6152', label: '#a2977f',
  brand: '#6d4dff', brand2: '#a24dff', white: '#ffffff',
};

/* ---------- fonts: woff2 → ttf ---------- */
const FONT_DIR = '.og-fonts';
// The subsetted webfonts report family names "Space Grotesk Light" and "IBM Plex
// Mono SemiBold" — NOT the CSS names. resvg silently falls back when a family
// does not match, which is how the first render came out entirely in mono.
// Only one weight per family is loaded: both Space Grotesk files report the same
// family name, so loading both makes weight selection ambiguous.
const DISPLAY = 'Space Grotesk Light';
const MONO = 'IBM Plex Mono SemiBold';
const FONTS = [
  ['space-grotesk-700-latin.woff2', 'sg-700.ttf'],
  ['ibm-plex-mono-600-latin.woff2', 'pm-600.ttf'],
];
async function ensureFonts() {
  mkdirSync(FONT_DIR, { recursive: true });
  for (const [src, out] of FONTS) {
    const dest = `${FONT_DIR}/${out}`;
    if (existsSync(dest)) continue;
    writeFileSync(dest, Buffer.from(await decompress(readFileSync(`public/fonts/${src}`))));
  }
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// resvg has no text-measurement API, so wrapping is done on an estimated
// advance width. 0.56em is Space Grotesk Bold's rough average for this copy;
// the first attempt wrapped on character COUNT and ran the headline straight
// under the card. Font size steps down until three lines fit the column.
const AVG_ADVANCE = 0.56;
const textWidth = (s, size) => s.length * size * AVG_ADVANCE;

function wrapToWidth(text, size, maxW) {
  const words = String(text).split(/\s+/), lines = [];
  let line = '';
  for (const w of words) {
    const next = (line + ' ' + w).trim();
    if (textWidth(next, size) > maxW && line) { lines.push(line); line = w; }
    else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Largest size (within range) whose wrap fits `maxLines` in `maxW`. */
function fitHeadline(text, maxW, maxLines = 3) {
  for (let size = 54; size >= 30; size -= 2) {
    const lines = wrapToWidth(text, size, maxW);
    if (lines.length <= maxLines) return { size, lines };
  }
  return { size: 30, lines: wrapToWidth(text, 30, maxW).slice(0, maxLines) };
}

/** A real, scannable QR for `url`, as inline SVG sized to `size`.
 *
 *  Square modules, not the app's default "plus" style. The app's styled dots do
 *  scan — BarcodeDetector reads the live plus-dot canvas without trouble — but
 *  jsQR, the decoder available in CI, cannot read any non-square module shape at
 *  any resolution. Square is the one style test/og.test.mjs can actually prove
 *  decodes, and an OG image gets re-compressed by every platform that unfurls
 *  it, so the most robust encoding is the right default here. Brand identity is
 *  carried by the purple, the circle finders and the card chrome.
 */
function qrSVG(url, size) {
  const svg = buildSVG(getMatrix(url, 'Q'), size, C.brand, C.white, 'square', 'circle', null, 'circle', false);
  return svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
}

function compose({ headline, kicker, url }) {
  const cardX = 640, cardY = 96, cardW = 496, cardH = 438;
  const qr = 246, qrX = cardX + (cardW - qr) / 2, qrY = cardY + 118;
  const COL = 536;                      // 64 -> 600, clear of the card at 640
  const { size: hSize, lines } = fitHeadline(headline, COL);
  const lead = Math.round(hSize * 1.16);
  const trustY = 214 + lines.length * lead + 38;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
  <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#7b5cff"/><stop offset="1" stop-color="${C.brand2}"/>
  </linearGradient>
</defs>
<rect width="${W}" height="${H}" fill="${C.page}"/>

<!-- brand lockup -->
<rect x="64" y="72" width="56" height="56" rx="17" fill="url(#g)"/>
<text x="92" y="109" font-family="${DISPLAY}" font-weight="700" font-size="24"
      fill="${C.white}" text-anchor="middle">QR</text>
<text x="136" y="99" font-family="${DISPLAY}" font-weight="700" font-size="25"
      fill="${C.ink}">QR Code Agent</text>
<text x="136" y="121" font-family="${MONO}" font-weight="600" font-size="13"
      fill="${C.label}" letter-spacing="1.6">${esc(kicker)}</text>

<!-- headline -->
${lines.map((l, i) => `<text x="64" y="${214 + (i + 1) * lead}" font-family="${DISPLAY}" font-weight="700"
      font-size="${hSize}" fill="${C.ink}">${esc(l)}</text>`).join('\n')}

<!-- trust row -->
${[['Free forever', 0], ['No watermark', 176], ['Never expires', 360]].map(([t, dx]) => `
<rect x="${64 + dx}" y="${trustY}" width="${t.length * 9.2 + 34}" height="40" rx="20"
      fill="${C.surface}" stroke="${C.border}"/>
<circle cx="${64 + dx + 21}" cy="${trustY + 20}" r="7" fill="${C.brand}"/>
<text x="${64 + dx + 36}" y="${trustY + 25}" font-family="${DISPLAY}"
      font-weight="500" font-size="16" fill="${C.muted}">${t}</text>`).join('')}

<!-- the generator card -->
<rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="26"
      fill="${C.surface}" stroke="${C.border}"/>
<rect x="${cardX}" y="${cardY}" width="${cardW}" height="62" rx="26" fill="${C.surface}"/>
<rect x="${cardX}" y="${cardY + 36}" width="${cardW}" height="26" fill="${C.surface}"/>
<line x1="${cardX}" y1="${cardY + 62}" x2="${cardX + cardW}" y2="${cardY + 62}" stroke="${C.border}"/>
<rect x="${cardX + 20}" y="${cardY + 16}" width="30" height="30" rx="9" fill="url(#g)"/>
<text x="${cardX + 35}" y="${cardY + 37}" font-family="${DISPLAY}" font-weight="700"
      font-size="13" fill="${C.white}" text-anchor="middle">QR</text>
<text x="${cardX + 60}" y="${cardY + 37}" font-family="${DISPLAY}" font-weight="700"
      font-size="16" fill="${C.ink}">Custom QR Codes</text>
${[0, 1, 2, 3].map((i) => `<rect x="${cardX + cardW - 40 - i * 26}" y="${cardY + 22}" width="18" height="18" rx="6"
      fill="${['#302c3b', '#59603c', '#e7dcc4', C.surface2][i]}" stroke="${C.border2}"/>`).join('')}

<!-- white preview area + a real, scannable code -->
<rect x="${cardX + 18}" y="${cardY + 80}" width="${cardW - 36}" height="${cardH - 100}" rx="16" fill="${C.white}"/>
<text x="${cardX + 38}" y="${cardY + 108}" font-family="${MONO}" font-weight="600"
      font-size="11" fill="${C.label}" letter-spacing="1.8">LIVE PREVIEW</text>
<g transform="translate(${qrX} ${qrY})">${qrSVG(url, qr)}</g>
${['512 x 512 px', 'ECC · Q', 'Scannable'].map((t, i) => {
    const bw = t.length * 6.6 + 22, gap = [0, 108, 190][i];
    const x = cardX + 38 + gap, y = cardY + cardH - 58;
    const tick = i === 2
      ? `<path d="M${x + 11} ${y + 13.5} l3 3.2 l5.6 -6.6" fill="none" stroke="#22a06b"
           stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>`
      : '';
    return `<rect x="${x}" y="${y}" width="${bw + (i === 2 ? 14 : 0)}" height="26" rx="13"
      fill="${i === 2 ? '#eafaf1' : C.surface}" stroke="${i === 2 ? '#c5ecd6' : C.border}"/>${tick}
<text x="${x + (i === 2 ? 25 : 11)}" y="${y + 18}" font-family="${MONO}" font-weight="600"
      font-size="10" fill="${i === 2 ? '#22a06b' : C.muted}">${esc(t)}</text>`;
  }).join('')}
</svg>`;
}

/* ---------- run ---------- */
const BASE = 'https://qrcodeagent.net';
const { pages } = JSON.parse(readFileSync('src/content/pages.json', 'utf8'));
const only = process.argv.includes('--one');

await ensureFonts();
mkdirSync('public/assets/og', { recursive: true });

const targets = only ? pages.filter((p) => !p.slug) : pages;
let n = 0, bytes = 0;
for (const page of targets) {
  const slug = page.slug || 'home';
  const url = `${BASE}/${page.slug || ''}`;
  const svg = compose({
    headline: page.h1,
    kicker: page.archetype === 'article' ? 'GUIDE' : 'FREE · NO SIGN-UP · NEVER EXPIRES',
    url,
  });
  const png = new Resvg(svg, {
    fitTo: { mode: 'width', value: W },
    font: { fontDirs: [FONT_DIR], loadSystemFonts: false, defaultFontFamily: DISPLAY },
  }).render().asPng();
  writeFileSync(`public/assets/og/${slug.replace(/\//g, '-')}.png`, png);
  n += 1; bytes += png.length;
}
console.log(`wrote ${n} OG image(s) → public/assets/og/ (${(bytes / 1024 / 1024).toFixed(2)} MB total, avg ${Math.round(bytes / n / 1024)} KB)`);
