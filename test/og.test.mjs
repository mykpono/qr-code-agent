// The single OG preview card.
//
// One image, /assets/og.png, shared by every page and locale (Base.astro), so a
// Slack/iMessage/social unfurl shows what the product is. The QR inside it is
// built with the app's own encoder, so the code in the card must actually scan.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import jsQR from 'jsqr';
import { Resvg } from '@resvg/resvg-js';
import { getMatrix, buildSVG } from '../src/lib/qr.js';

const root = fileURLToPath(new URL('../', import.meta.url));

// Mirrors the main-preview QR in scripts/gen-og.mjs.
const OG_QR = { size: 196, fg: '#2563eb', bg: '#eef4ff', dot: 'star', finder: 'circle', ecc: 'Q' };
const SITE = 'https://qrcodeagent.net';

test('the QR in the OG card decodes to the site', () => {
  // jsQR reads square modules reliably at any size but not styled ones, so the
  // decode is checked against the same MATRIX the card draws, rasterised as
  // squares. This proves the encoding (version, ECC, data), which is what could
  // silently break; the plus-dot RENDER is verified by eye and by
  // BarcodeDetector in the app itself.
  const n = getMatrix(SITE, OG_QR.ecc).length;
  const svg = buildSVG(getMatrix(SITE, OG_QR.ecc), 512, '#000', '#fff', 'square', 'square', null, 'circle', false);
  const { width, height, pixels } = new Resvg(svg, { fitTo: { mode: 'width', value: 512 } }).render();
  const got = jsQR(new Uint8ClampedArray(pixels), width, height);
  assert.ok(got, 'OG card QR failed to decode');
  assert.equal(got.data, SITE, 'OG card QR points somewhere other than the site');
  assert.ok(n >= 21, 'sanity: got a real matrix');
});

test('the OG QR colours clear the scannability threshold', () => {
  const lum = (h) => {
    const s = h.replace('#', '');
    const ch = (i) => { const v = parseInt(s.slice(i, i + 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * ch(0) + 0.7152 * ch(2) + 0.0722 * ch(4);
  };
  const a = lum(OG_QR.fg), b = lum(OG_QR.bg);
  const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  assert.ok(ratio >= 3.5, `OG QR contrast ${ratio.toFixed(2)}:1 is below 3.5`);
});

test('Base.astro points og:image and twitter:image at the shared card', () => {
  const base = readFileSync(root + 'src/layouts/Base.astro', 'utf8');
  assert.match(base, /ogImg = 'https:\/\/qrcodeagent\.net\/assets\/og\.png'/,
    'Base.astro should use the single /assets/og.png');
  // Both meta tags must use ogImg, not a per-page path.
  assert.ok(/property="og:image" content=\{ogImg\}/.test(base), 'og:image should be ogImg');
  assert.ok(/name="twitter:image" content=\{ogImg\}/.test(base), 'twitter:image should be ogImg');
});

test('the OG card exists after a build', () => {
  const f = root + 'public/assets/og.png';
  if (!existsSync(f)) return; // gitignored artifact; only present post-build
  const b = readFileSync(f);
  assert.equal(b.slice(1, 4).toString(), 'PNG', 'not a PNG');
  assert.equal(b.readUInt32BE(16), 1200, 'width must be 1200');
  assert.equal(b.readUInt32BE(20), 630, 'height must be 630');
});
