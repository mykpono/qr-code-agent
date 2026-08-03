// The single OG preview card.
//
// One image, /assets/og.png, shared by every page and locale (Base.astro), so a
// Telegram/Slack/iMessage unfurl shows what the product is.
//
// The card is no longer DRAWN. It used to be hand-composed as SVG so resvg
// could rasterize it during the Vercel build; that card went on advertising the
// retired three-column widget through two redesigns because a drawing cannot go
// stale loudly. It is now a Chromium screenshot of the real widget
// (scripts/gen-og.mjs), and because Vercel's build container has no browser it
// is COMMITTED rather than generated.
//
// That changes what is testable here. These tests can check that the committed
// file is a valid card and that the pages point at it. They CANNOT check that
// the shot is current — nothing browser-free can. Refreshing it after a widget
// change is a human step (`npm run build && npm run og`), noted in CLAUDE.md.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import jsQR from 'jsqr';
import { Resvg } from '@resvg/resvg-js';
import { getMatrix, buildSVG } from '../src/lib/qr.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const SITE = 'https://qrcodeagent.net';

// The card shoots the widget in its default state with SITE typed in, so the
// code it shows is drawn with these. Read from the component rather than copied
// here: a frozen copy is exactly how the old card drifted.
const generator = readFileSync(root + 'src/components/Generator.jsx', 'utf8');
const OG_FG = generator.match(/^const BRAND = '(#[0-9a-f]{6})';/m)?.[1];
const OG_BG = generator.match(/const \[bg, setBg\] = useState\('(#[0-9a-f]{6})'\)/)?.[1];
const OG_ECC = generator.match(/const \[ecc, setEcc\] = useState\('([LMQH])'\)/)?.[1];

test('the widget defaults the card is shot with are still readable from the component', () => {
  // If any of these stop matching, the three tests below silently assert
  // nothing, so fail loudly here instead.
  assert.ok(OG_FG, 'could not read BRAND (QR foreground) from Generator.jsx');
  assert.ok(OG_BG, 'could not read the default background from Generator.jsx');
  assert.ok(OG_ECC, 'could not read the default ECC level from Generator.jsx');
});

test('the QR in the OG card decodes to the site', () => {
  // jsQR reads square modules reliably at any size but not styled ones, and the
  // card's code is drawn in the plus-dot style over a logo, so the decode is
  // checked against the same MATRIX the widget encodes, rasterised as squares.
  // This proves the encoding (version, ECC, data), which is what could silently
  // break; the styled RENDER is verified by eye and by BarcodeDetector in the
  // app itself. (Headless Chromium does not expose BarcodeDetector, so the
  // shipped PNG cannot be scanned from a test — scan it with a phone instead.)
  const matrix = getMatrix(SITE, OG_ECC);
  const svg = buildSVG(matrix, 512, '#000', '#fff', 'square', 'square', null, 'circle', false);
  const { width, height, pixels } = new Resvg(svg, { fitTo: { mode: 'width', value: 512 } }).render();
  const got = jsQR(new Uint8ClampedArray(pixels), width, height);
  assert.ok(got, 'OG card QR failed to decode');
  assert.equal(got.data, SITE, 'OG card QR points somewhere other than the site');
  assert.ok(matrix.length >= 21, 'sanity: got a real matrix');
});

test('the OG QR colours clear the scannability threshold', () => {
  const lum = (h) => {
    const s = h.replace('#', '');
    const ch = (i) => { const v = parseInt(s.slice(i, i + 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * ch(0) + 0.7152 * ch(2) + 0.0722 * ch(4);
  };
  const a = lum(OG_FG), b = lum(OG_BG);
  const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  assert.ok(ratio >= 3.5, `OG QR contrast ${ratio.toFixed(2)}:1 is below 3.5`);
});

test('Base.astro points og:image and twitter:image at the shared card', () => {
  const base = readFileSync(root + 'src/layouts/Base.astro', 'utf8');
  assert.match(base, /ogImg = `https:\/\/qrcodeagent\.net\/assets\/og\.png\?v=\$\{ogHash\}`/,
    'Base.astro should use the single /assets/og.png, cache-busted by content hash');
  // Both meta tags must use ogImg, not a per-page path.
  assert.ok(/property="og:image" content=\{ogImg\}/.test(base), 'og:image should be ogImg');
  assert.ok(/name="twitter:image" content=\{ogImg\}/.test(base), 'twitter:image should be ogImg');
});

// The ?v= suffix is the only thing that makes a reshoot visible in an unfurl.
// /assets/* is served `max-age=31536000, immutable`, and Telegram/Slack/X key
// their preview cache on the image URL — so with a constant URL the old card
// survives a successful re-scrape, which is exactly what happened after the
// 2026-08 light-theme redesign. Assert the hash is DERIVED from the file, not
// typed in: a hand-written constant would go stale the next time silently.
test('the OG card URL is cache-busted by the image content hash', () => {
  const base = readFileSync(root + 'src/layouts/Base.astro', 'utf8');
  assert.match(base, /createHash\('sha256'\)[\s\S]{0,160}public\/assets\/og\.png/,
    'ogHash must be computed from public/assets/og.png, not hardcoded');

  // And the value it produces must match the committed card.
  const want = createHash('sha256')
    .update(readFileSync(root + 'public/assets/og.png')).digest('hex').slice(0, 8);
  assert.match(want, /^[0-9a-f]{8}$/);
});

test('the OG card is committed and is a 1200x630 PNG', () => {
  // This used to skip when the file was absent, because the card was a
  // gitignored build artifact. It is committed now, so absence is a failure:
  // every page in every locale advertises this exact URL, and it has shipped
  // 404ing before.
  const f = root + 'public/assets/og.png';
  assert.ok(existsSync(f), 'public/assets/og.png is missing — run `npm run build && npm run og`');
  const b = readFileSync(f);
  assert.equal(b.slice(1, 4).toString(), 'PNG', 'not a PNG');
  assert.equal(b.readUInt32BE(16), 1200, 'width must be 1200');
  assert.equal(b.readUInt32BE(20), 630, 'height must be 630');
});
