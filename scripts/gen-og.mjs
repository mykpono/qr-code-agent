// Generate the Open Graph / Twitter preview card.
//
//   npm run og   →  public/assets/og.png   (1200x630)
//
// ONE image, shared by every page and every locale: a picture of the generator
// itself. Base.astro points every og:image and twitter:image at it.
//
// Why one and not per page: the card's job in a Slack or iMessage unfurl is to
// show what the product IS. The title and description already render beside it
// as text, so a per-page headline in the image mostly repeats them — and
// per-page art multiplies into per-locale art the moment a translation ships.
// A single product shot says more and never drifts out of sync.
//
// The QR inside is built with the app's own encoder (lib/qr.js), not a
// decorative mock, so the code in the card actually scans to the site.
//
// Fonts: resvg cannot read woff2, and the self-hosted files report family names
// "Space Grotesk Light" and "IBM Plex Mono SemiBold" rather than their CSS
// names. BOTH failures are silent — resvg drops glyphs it has no font for — so
// the woff2 are decompressed to ttf in .og-fonts/ and referenced by real name.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { decompress } from 'wawoff2';
import { getMatrix, buildSVG } from '../src/lib/qr.js';

const W = 1200, H = 630;
const SITE = 'https://qrcodeagent.net';

// Cream theme tokens, mirroring src/styles/tokens/themes.css.
const C = {
  page: '#e8e0cf', surface: '#faf6ec', surface2: '#f2ecdd', surface3: '#f7f2e6',
  border: '#e6dfce', borderSoft: '#efe8d8', border2: '#d9d0bb', border3: '#d4cbb4',
  ink: '#2b2140', ink2: '#4a4030', muted: '#6b6152', muted2: '#9a8f7c',
  label: '#a2977f', label2: '#b3a892', accentSoft: '#ece7ff', accentBorder: '#c9beff',
  brand: '#6d4dff', brand2: '#a24dff', white: '#ffffff',
  okInk: '#22a06b', okBg: '#eafaf1', okBorder: '#c5ecd6',
};

const FONT_DIR = '.og-fonts';
const DISPLAY = 'Space Grotesk Light';
const MONO = 'IBM Plex Mono SemiBold';
const FONTS = [
  ['space-grotesk-700-latin.woff2', 'sg-700.ttf'],
  ['ibm-plex-mono-600-latin.woff2', 'pm-600.ttf'],
];
async function ensureFonts() {
  mkdirSync(FONT_DIR, { recursive: true });
  for (const [src, out] of FONTS) {
    if (existsSync(`${FONT_DIR}/${out}`)) continue;
    writeFileSync(`${FONT_DIR}/${out}`, Buffer.from(await decompress(readFileSync(`public/fonts/${src}`))));
  }
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const dataUri = (p) => `data:image/png;base64,${readFileSync(p).toString('base64')}`;

const mono = (x, y, t, size = 11, fill = C.label, ls = 1.7, anchor = 'start') =>
  `<text x="${x}" y="${y}" font-family="${MONO}" font-size="${size}" fill="${fill}"
     letter-spacing="${ls}" text-anchor="${anchor}">${esc(t)}</text>`;
const disp = (x, y, t, size = 16, fill = C.ink, weight = 700, anchor = 'start') =>
  `<text x="${x}" y="${y}" font-family="${DISPLAY}" font-weight="${weight}" font-size="${size}"
     fill="${fill}" text-anchor="${anchor}">${esc(t)}</text>`;

/** A dot-style / finder-style swatch button, selected or not. */
function styleButton(x, y, w, h, label, selected, glyph) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10"
      fill="${selected ? C.accentSoft : C.surface2}"
      stroke="${selected ? C.brand : C.border}" stroke-width="${selected ? 1.5 : 1}"/>
    ${glyph(x + w / 2, y + h / 2 - 5)}
    ${mono(x + w / 2, y + h - 8, label, 6.5, selected ? C.brand : C.muted, 0.2, 'middle')}`;
}

/** 3x3 mini pattern shown inside a dot-style swatch. */
function dotGlyph(kind, colour) {
  return (cx, cy) => {
    const s = 4.4, out = [];
    for (let r = -1; r <= 1; r++) for (let c = -1; c <= 1; c++) {
      const x = cx + c * s * 1.5, y = cy + r * s * 1.5;
      if (kind === 'plus') out.push(`<path d="M${x} ${y - 2.6}V${y + 2.6}M${x - 2.6} ${y}H${x + 2.6}" stroke="${colour}" stroke-width="1.4" stroke-linecap="round"/>`);
      else if (kind === 'star') out.push(`<circle cx="${x}" cy="${y}" r="1.5" fill="${colour}"/><path d="M${x} ${y - 2.8}V${y + 2.8}M${x - 2.4} ${y - 1.4}L${x + 2.4} ${y + 1.4}M${x - 2.4} ${y + 1.4}L${x + 2.4} ${y - 1.4}" stroke="${colour}" stroke-width="0.9"/>`);
      else if (kind === 'diamond') out.push(`<rect x="${x - 1.7}" y="${y - 1.7}" width="3.4" height="3.4" transform="rotate(45 ${x} ${y})" fill="${colour}"/>`);
      else if (kind === 'circle') out.push(`<circle cx="${x}" cy="${y}" r="2" fill="${colour}"/>`);
      else out.push(`<rect x="${x - 2}" y="${y - 2}" width="4" height="4" fill="${colour}"/>`);
    }
    return out.join('');
  };
}

function finderGlyph(kind, colour) {
  return (cx, cy) => {
    if (kind === 'circle') {
      return `<circle cx="${cx}" cy="${cy}" r="7.5" fill="none" stroke="${colour}" stroke-width="2.4"/>
              <circle cx="${cx}" cy="${cy}" r="3" fill="${colour}"/>`;
    }
    const r = kind === 'rounded' ? 3.5 : kind === 'cushion' ? 6.5 : 0;
    const outer = kind === 'leaf'
      ? `<path d="M${cx - 7.5} ${cy - 1}a6.5 6.5 0 0 1 6.5 -6.5h8.5v9a6.5 6.5 0 0 1 -6.5 6.5h-8.5Z" fill="none" stroke="${colour}" stroke-width="2.2"/>`
      : `<rect x="${cx - 7.5}" y="${cy - 7.5}" width="15" height="15" rx="${r}" fill="none" stroke="${colour}" stroke-width="2.2"/>`;
    return `${outer}<rect x="${cx - 2.8}" y="${cy - 2.8}" width="5.6" height="5.6" rx="${r ? 1.4 : 0}" fill="${colour}"/>`;
  };
}

/** Decorative-looking but real QR thumbnail for a template card, plus its logo. */
function templateThumb(id, x, y, size, fg, bg, logo) {
  const svg = buildSVG(getMatrix(SITE, 'M'), size, fg, bg, 'square', 'rounded', null, 'circle', false)
    .replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  const chip = size * 0.36;
  return `<g transform="translate(${x} ${y})">
    <clipPath id="clip${id}"><rect width="${size}" height="${size}" rx="6"/></clipPath>
    <g clip-path="url(#clip${id})">${svg}</g>
    <rect x="${(size - chip) / 2}" y="${(size - chip) / 2}" width="${chip}" height="${chip}" rx="6" fill="#fff"/>
    <image href="${logo}" x="${(size - chip) / 2 + 3}" y="${(size - chip) / 2 + 3}"
           width="${chip - 6}" height="${chip - 6}"/>
  </g>`;
}

function compose() {
  const cx = 36, cy = 22, cw = W - 72, ch = H - 44;
  const topH = 58, rowH = 56;
  const bodyY = cy + topH + rowH;
  const cfgW = 360, railW = 228;
  const cfgX = cx, prevX = cx + cfgW, railX = cx + cw - railW;
  const prevW = railX - prevX;
  const qr = 196, qrX = prevX + (prevW - qr) / 2, qrY = bodyY + 60;

  const DOTS = [['PLUS', 'plus', true], ['STAR', 'star', false], ['DIAMOND', 'diamond', false],
    ['CIRCLE', 'circle', false], ['SQUARE', 'square', false]];
  const FINDERS = [['CIRCLE', 'circle', true], ['ROUNDED', 'rounded', false], ['SQUARE', 'square', false],
    ['LEAF', 'leaf', false], ['CUSHION', 'cushion', false]];
  const ECC = [['L', '7%', 'LOW', false], ['M', '15%', 'MEDIUM', false],
    ['Q', '25%', 'QUARTILE', true], ['H', '30%', 'HIGH', false]];
  const TEMPLATES = [
    ['Telegram', '#229ED9', '#eaf6fc', 'telegram'], ['WhatsApp', '#0f8a6d', '#eafaf0', 'whatsapp'],
    ['Instagram', '#c1358a', '#fdeef6', 'instagram'], ['YouTube', '#e60000', '#fff0f0', 'youtube'],
  ];
  const swW = (cfgW - 44 - 4 * 6) / 5;
  const mainQr = buildSVG(getMatrix(SITE, 'Q'), qr, '#2563eb', '#eef4ff', 'star', 'circle', null, 'circle', false)
    .replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#7b5cff"/><stop offset="1" stop-color="${C.brand2}"/></linearGradient></defs>
<rect width="${W}" height="${H}" fill="${C.page}"/>
<rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" rx="22" fill="${C.surface}" stroke="${C.border}"/>

<rect x="${cx + 20}" y="${cy + 13}" width="32" height="32" rx="10" fill="url(#g)"/>
${disp(cx + 36, cy + 35, 'QR', 14, C.white, 700, 'middle')}
${disp(cx + 62, cy + 29, 'Custom QR Codes', 16)}
${mono(cx + 62, cy + 44, 'PLUS dots · CIRCLE finders · Logo on', 9, C.muted2, 0.4)}
${['#faf6ec', '#e7dcc4', '#59603c', '#302c3b'].map((f, i) => `<rect x="${cx + cw - 122 + i * 26}" y="${cy + 20}"
   width="19" height="19" rx="6" fill="${f}" stroke="${C.border2}"/>`).join('')}
<line x1="${cx}" y1="${cy + topH}" x2="${cx + cw}" y2="${cy + topH}" stroke="${C.borderSoft}"/>

${mono(cx + 20, cy + topH + 34, 'CONTENT / URL', 9.5, C.label, 1.5)}
<rect x="${cx + 122}" y="${cy + topH + 14}" width="${cw - 288}" height="32" rx="10"
  fill="${C.surface2}" stroke="${C.border}"/>
${disp(cx + 136, cy + topH + 35, SITE, 13, C.ink, 500)}
<rect x="${cx + cw - 152}" y="${cy + topH + 14}" width="132" height="32" rx="10"
  fill="${C.accentSoft}" stroke="${C.accentBorder}"/>
${mono(cx + cw - 138, cy + topH + 34, 'UTM TRACKING', 9, C.brand, 0.7)}
<path d="M${cx + cw - 42} ${cy + topH + 27} l4 4 l4 -4" fill="none" stroke="${C.brand}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
<line x1="${cx}" y1="${bodyY}" x2="${cx + cw}" y2="${bodyY}" stroke="${C.borderSoft}"/>

<line x1="${prevX}" y1="${bodyY}" x2="${prevX}" y2="${cy + ch}" stroke="${C.borderSoft}"/>
${mono(cfgX + 22, bodyY + 24, 'DOT STYLE', 9, C.label, 1.5)}
${DOTS.map(([l, k, sel], i) => styleButton(cfgX + 22 + i * (swW + 6), bodyY + 32, swW, 42, l, sel,
    dotGlyph(k, sel ? C.brand : C.muted))).join('')}
${mono(cfgX + 22, bodyY + 98, 'FINDER PATTERN', 9, C.label, 1.5)}
${FINDERS.map(([l, k, sel], i) => styleButton(cfgX + 22 + i * (swW + 6), bodyY + 106, swW, 42, l, sel,
    finderGlyph(k, sel ? C.brand : C.muted))).join('')}

${mono(cfgX + 22, bodyY + 174, 'FOREGROUND', 9, C.label, 1.5)}
${mono(cfgX + 22 + (cfgW - 44) / 2 + 6, bodyY + 174, 'BACKGROUND', 9, C.label, 1.5)}
${[['#2563EB', '#2563eb', 0], ['#EEF4FF', '#eef4ff', (cfgW - 44) / 2 + 6]].map(([hex, sw, dx]) => `
<rect x="${cfgX + 22 + dx}" y="${bodyY + 182}" width="${(cfgW - 44) / 2 - 6}" height="30" rx="9"
  fill="${C.surface2}" stroke="${C.border}"/>
<rect x="${cfgX + 30 + dx}" y="${bodyY + 189}" width="15" height="15" rx="4.5" fill="${sw}" stroke="${C.border2}"/>
${mono(cfgX + 52 + dx, bodyY + 201, hex, 9, C.ink2, 0.3)}`).join('')}

${mono(cfgX + 22, bodyY + 240, 'OUTPUT SIZE', 9, C.label, 1.5)}
${mono(cfgX + cfgW - 22, bodyY + 240, '512 PX', 9.5, C.brand, 0.3, 'end')}
<rect x="${cfgX + 22}" y="${bodyY + 249}" width="${cfgW - 44}" height="5" rx="2.5" fill="${C.border}"/>
<rect x="${cfgX + 22}" y="${bodyY + 249}" width="${(cfgW - 44) * 0.18}" height="5" rx="2.5" fill="${C.brand}"/>
<circle cx="${cfgX + 22 + (cfgW - 44) * 0.18}" cy="${bodyY + 251.5}" r="7" fill="${C.brand}"/>

${mono(cfgX + 22, bodyY + 284, 'ERROR CORRECTION', 9, C.label, 1.5)}
${ECC.map(([l, p, n, sel], i) => {
    const w = (cfgW - 44 - 3 * 6) / 4, x = cfgX + 22 + i * (w + 6);
    return `<rect x="${x}" y="${bodyY + 292}" width="${w}" height="44" rx="9"
      fill="${sel ? C.accentSoft : C.surface2}" stroke="${sel ? C.brand : C.border}" stroke-width="${sel ? 1.5 : 1}"/>
    ${disp(x + w / 2, bodyY + 310, l, 14, sel ? C.brand : C.muted, 700, 'middle')}
    ${mono(x + w / 2, bodyY + 321, p, 8, sel ? C.brand : C.muted, 0.2, 'middle')}
    ${mono(x + w / 2, bodyY + 331, n, 6, sel ? C.brand : C.muted2, 0.3, 'middle')}`;
  }).join('')}

${mono(cfgX + 22, bodyY + 366, 'CENTER LOGO', 9, C.label, 1.5)}
<rect x="${cfgX + cfgW - 60}" y="${bodyY + 356}" width="38" height="21" rx="10.5" fill="${C.brand}"/>
<circle cx="${cfgX + cfgW - 32}" cy="${bodyY + 366.5}" r="8" fill="${C.white}"/>
<rect x="${cfgX + 22}" y="${bodyY + 378}" width="${cfgW - 44}" height="44" rx="11"
  fill="${C.surface3}" stroke="${C.border3}" stroke-dasharray="4 3"/>
${disp(cfgX + cfgW / 2, bodyY + 398, 'Drop image or click to upload', 10.5, C.muted, 500, 'middle')}
${mono(cfgX + cfgW / 2, bodyY + 412, 'PNG with transparency', 7.5, C.label, 0.2, 'middle')}
<rect x="${cfgX + 22}" y="${bodyY + 434}" width="${cfgW - 44}" height="40" rx="12" fill="url(#g)"/>
${mono(cfgX + cfgW / 2, bodyY + 459, 'GENERATE QR CODE', 10.5, C.white, 1.3, 'middle')}

<rect x="${prevX}" y="${bodyY}" width="${prevW}" height="${cy + ch - bodyY}" fill="${C.white}"/>
${mono(prevX + 24, bodyY + 28, 'LIVE PREVIEW', 9.5, C.label, 1.6)}
<rect x="${prevX + prevW - 176}" y="${bodyY + 13}" width="92" height="25" rx="8"
  fill="${C.surface}" stroke="${C.border2}"/>
${disp(prevX + prevW - 168, bodyY + 30, '♥', 9, C.ink2, 400)}
${mono(prevX + prevW - 124, bodyY + 29, 'SAVE DESIGN', 8, C.ink2, 0.4, 'middle')}
<rect x="${prevX + prevW - 78}" y="${bodyY + 13}" width="58" height="25" rx="8"
  fill="${C.accentSoft}" stroke="${C.accentBorder}"/>
${mono(prevX + prevW - 49, bodyY + 29, 'SAVED ›', 8, C.brand, 0.4, 'middle')}
<g transform="translate(${qrX} ${qrY})">${mainQr}</g>
${[['512 × 512 px', 0, false], ['ECC · Q', 88, false], ['CIRCLE finders', 146, false], ['Scannable', 246, true]]
    .map(([t, dx, ok]) => {
      const w = String(t).length * 5.4 + (ok ? 30 : 17), x = prevX + 24 + dx, y = qrY + qr + 20;
      return `<rect x="${x}" y="${y}" width="${w}" height="23" rx="11.5"
        fill="${ok ? C.okBg : C.surface}" stroke="${ok ? C.okBorder : C.border}"/>
      ${ok ? `<path d="M${x + 10} ${y + 11.8} l2.5 2.7 l4.8 -5.6" fill="none" stroke="${C.okInk}"
        stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
      ${mono(x + (ok ? 21 : 8.5), y + 15.5, t, 8, ok ? C.okInk : C.muted, 0.25)}`;
    }).join('')}
${[['↓ DOWNLOAD PNG', 0, false], ['↓ DOWNLOAD SVG', 146, true]].map(([t, dx, primary]) => {
    const x = prevX + 24 + dx, y = qrY + qr + 54;
    return `<rect x="${x}" y="${y}" width="134" height="36" rx="11"
      fill="${primary ? 'url(#g)' : C.surface}" ${primary ? '' : `stroke="${C.border2}"`}/>
    ${mono(x + 67, y + 23, t, 9, primary ? C.white : C.ink2, 0.6, 'middle')}`;
  }).join('')}

<line x1="${railX}" y1="${bodyY}" x2="${railX}" y2="${cy + ch}" stroke="${C.borderSoft}"/>
<rect x="${railX}" y="${bodyY}" width="${railW}" height="${cy + ch - bodyY}" fill="${C.surface3}"/>
${disp(railX + 18, bodyY + 28, 'Templates', 13)}
${mono(railX + 88, bodyY + 28, '36 presets', 8.5, C.label, 0.2)}
${['Social', 'Industry', 'Use case', 'Themes'].map((t, i) => {
    const w = t.length * 5.2 + 16;
    const pos = [[0, 0], [50, 0], [108, 0], [0, 25]][i];
    const x = railX + 18 + pos[0], y = bodyY + 40 + pos[1];
    return `<rect x="${x}" y="${y}" width="${w}" height="21" rx="7"
      fill="${i === 0 ? C.brand : C.surface}" stroke="${i === 0 ? C.brand : C.border}"/>
    ${mono(x + w / 2, y + 14.5, t, 8, i === 0 ? C.white : C.muted, 0.2, 'middle')}`;
  }).join('')}
${mono(railX + 18, bodyY + 100, 'SOCIAL', 7.5, C.label2, 1.3)}
${TEMPLATES.map(([name, fg, bg, logo], i) => {
    const cwd = (railW - 48) / 2;
    const x = railX + 18 + (i % 2) * (cwd + 12), y = bodyY + 110 + Math.floor(i / 2) * (cwd + 34);
    return `<rect x="${x}" y="${y}" width="${cwd}" height="${cwd + 26}" rx="11"
      fill="${C.surface}" stroke="${C.border}"/>
    ${templateThumb(i, x + 7, y + 7, cwd - 14, fg, bg, dataUri(`public/assets/logos/${logo}.png`))}
    ${disp(x + cwd / 2, y + cwd + 16, name, 10, C.ink, 600, 'middle')}`;
  }).join('')}
</svg>`;
}

await ensureFonts();
mkdirSync('public/assets', { recursive: true });
const png = new Resvg(compose(), {
  fitTo: { mode: 'width', value: W },
  font: { fontDirs: [FONT_DIR], loadSystemFonts: false, defaultFontFamily: DISPLAY },
}).render().asPng();
writeFileSync('public/assets/og.png', png);
console.log(`wrote public/assets/og.png (${W}x${H}, ${Math.round(png.length / 1024)} KB)`);
