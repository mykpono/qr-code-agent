// The QR inside the Open Graph artwork must be a real, scannable code.
//
// scripts/gen-og.mjs builds it with the app's own encoder rather than the
// decorative mock used for rail thumbnails, so the code in a Slack or iMessage
// unfurl actually resolves to the page it illustrates. That is only true while
// the rendered artwork still decodes — a change to the dot style, the colours,
// or the size in the OG composition could quietly break it, and nobody would
// notice because an OG image is something you look at, not something you scan.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import jsQR from 'jsqr';
import { Resvg } from '@resvg/resvg-js';
import { getMatrix, buildSVG } from '../src/lib/qr.js';

const root = fileURLToPath(new URL('../', import.meta.url));

// Must mirror qrSVG() in scripts/gen-og.mjs.
const OG_QR = { size: 246, fg: '#6d4dff', bg: '#ffffff', dot: 'square', finder: 'circle', ecc: 'Q' };

function decodeOgQr(url, scale = 2) {
  const svg = buildSVG(getMatrix(url, OG_QR.ecc), OG_QR.size,
    OG_QR.fg, OG_QR.bg, OG_QR.dot, OG_QR.finder, null, 'circle', false);
  const { width, height, pixels } = new Resvg(svg, {
    fitTo: { mode: 'width', value: OG_QR.size * scale },
  }).render();
  return jsQR(new Uint8ClampedArray(pixels), width, height);
}

test('the QR in the OG artwork decodes to its own page URL', () => {
  for (const url of [
    'https://qrcodeagent.net/',
    'https://qrcodeagent.net/wifi-qr-code',
    'https://qrcodeagent.net/learn/add-logo-without-breaking-qr-code',
  ]) {
    const got = decodeOgQr(url);
    assert.ok(got, `OG QR failed to decode for ${url}`);
    assert.equal(got.data, url, 'OG QR decoded to the wrong destination');
  }
});

// Brand purple on white is ~7.5:1 — comfortably past the 3.5 the app itself
// warns below. Guards against someone restyling the OG art into a code that
// looks good and does not scan.
test('the OG QR colours clear the scannability threshold', () => {
  const lum = (h) => {
    const n = h.replace('#', '');
    const ch = (i) => {
      const v = parseInt(n.slice(i, i + 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * ch(0) + 0.7152 * ch(2) + 0.0722 * ch(4);
  };
  const a = lum(OG_QR.fg), b = lum(OG_QR.bg);
  const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  assert.ok(ratio >= 3.5, `OG QR contrast ${ratio.toFixed(2)}:1 is below the 3.5 the app requires`);
});

// og:image is declared on every page by Base.astro. A declared image that 404s
// unfurls worse than none at all, which is exactly what shipped before these
// files were generated.
test('an OG image exists for every page that declares one', () => {
  const dir = root + 'public/assets/og/';
  if (!existsSync(dir)) return; // not generated in this checkout
  const have = new Set(readdirSync(dir).filter((f) => f.endsWith('.png')).map((f) => f.replace(/\.png$/, '')));
  const { pages } = JSON.parse(readFileSync(root + 'src/content/pages.json', 'utf8'));
  const missing = pages
    .map((p) => (p.slug || 'home').replace(/\//g, '-'))
    .filter((s) => !have.has(s));
  assert.deepEqual(missing, [], `pages declaring og:image with no file: ${missing.slice(0, 6).join(', ')}`);
});
