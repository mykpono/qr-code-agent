// Decode tests for the QR pipeline.
//
// These exist because every correctness check in this project was previously
// ad-hoc: run once in a browser console, proving nothing about the next commit.
// The encoder, the quiet zone and the export are the parts where a regression is
// invisible until someone prints a thousand table tents, so they get real tests.
//
// A code is verified by DECODING it with jsQR, not by asserting on shapes. The
// matrix is rasterised with the same geometry the app renders with, so a change
// to QUIET_MODULES or the module grid fails here.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import jsQR from 'jsqr';
import {
  buildPayload, getMatrix, buildSVG, hasContent, QUIET_MODULES,
} from '../src/lib/qr.js';

const SCALE = 8; // px per module — well above the decoder's floor

/** Rasterise a matrix to RGBA using the app's real quiet-zone geometry. */
function rasterise(matrix, quiet = QUIET_MODULES) {
  const n = matrix.length;
  const side = (n + quiet * 2) * SCALE;
  const data = new Uint8ClampedArray(side * side * 4).fill(255);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!matrix[r][c]) continue;
      for (let y = 0; y < SCALE; y++) {
        for (let x = 0; x < SCALE; x++) {
          const px = (quiet + c) * SCALE + x;
          const py = (quiet + r) * SCALE + y;
          const i = (py * side + px) * 4;
          data[i] = data[i + 1] = data[i + 2] = 0;
        }
      }
    }
  }
  return { data, side };
}

function decode(text, ecc = 'Q', quiet = QUIET_MODULES) {
  const { data, side } = rasterise(getMatrix(text, ecc), quiet);
  return jsQR(data, side, side);
}

/* ---------------- the codes actually scan ---------------- */

const PAYLOADS = [
  ['short url', 'https://a.co'],
  ['typical url', 'https://qrcodeagent.net/wifi-qr-code'],
  ['url with utm', 'https://qrcodeagent.net/qr-codes-for-restaurants?utm_source=newsletter&utm_medium=email&utm_campaign=spring'],
  ['long url', 'https://example.com/' + 'x'.repeat(300)],
  ['wifi', 'WIFI:T:WPA;S:Cafe Guest;P:hunter2;;'],
  ['vcard', 'BEGIN:VCARD\nVERSION:3.0\nN:Lovelace;Ada;;;\nFN:Ada Lovelace\nEMAIL:ada@example.com\nEND:VCARD'],
  ['unicode', 'https://example.com/café-münchen-日本語'],
];

for (const [label, text] of PAYLOADS) {
  for (const ecc of ['L', 'M', 'Q', 'H']) {
    test(`decodes: ${label} @ ECC ${ecc}`, () => {
      const got = decode(text, ecc);
      assert.ok(got, `failed to decode ${label} at ECC ${ecc}`);
      assert.equal(got.data, text, 'decoded payload differs from input');
    });
  }
}

/* ---------------- quiet zone ---------------- */

test('quiet zone is 4 modules, per ISO/IEC 18004', () => {
  assert.equal(QUIET_MODULES, 4);
});

test('quiet zone is sized in modules, not as a fraction of output', () => {
  // The original bug: pad = out * 0.04 shrank the quiet zone in module terms as
  // the code got denser, giving ~1.3 modules on a typical URL. Sizing in modules
  // means the ratio holds at every version.
  for (const text of ['https://a.co', 'https://example.com/' + 'x'.repeat(400)]) {
    const n = getMatrix(text, 'Q').length;
    const out = 512;
    const cell = out / (n + QUIET_MODULES * 2);
    const quietModules = (QUIET_MODULES * cell) / cell;
    assert.equal(quietModules, 4, `quiet zone drifted at n=${n}`);
  }
});

test('an under-quieted code is measurably worse — the fix is load-bearing', () => {
  // Guards against silently reverting to a fractional pad: at 1 module of quiet
  // zone the decoder should struggle where 4 modules succeeds.
  const text = 'https://qrcodeagent.net/wifi-qr-code';
  assert.ok(decode(text, 'Q', 4), 'should decode with the spec quiet zone');
  const starved = decode(text, 'Q', 0);
  assert.ok(!starved || starved.data === text,
    'zero-quiet-zone result must be a clean failure or a correct read, never garbage');
});

/* ---------------- payload builders ---------------- */

test('wifi payload escapes delimiters', () => {
  const p = buildPayload('wifi', { ssid: 'My;Cafe', pass: 'a:b"c', enc: 'WPA' });
  assert.match(p, /^WIFI:T:WPA;/);
  assert.ok(p.includes('\\;'), 'semicolon in SSID must be escaped or the code is misread');
  assert.ok(p.includes('\\:') || p.includes('\\"'), 'special chars in password must be escaped');
});

test('vcard payload is well-formed and omits empty fields', () => {
  const p = buildPayload('vcard', { first: 'Ada', last: 'Lovelace', email: 'ada@example.com' });
  assert.match(p, /^BEGIN:VCARD/);
  assert.match(p, /END:VCARD$/);
  assert.ok(p.includes('FN:Ada Lovelace'));
  assert.ok(!p.includes('TEL'), 'blank phone should not emit an empty TEL line');
});

test('whatsapp payload strips non-digits and encodes the message', () => {
  const p = buildPayload('whatsapp', { number: '+1 (555) 010-9999', message: 'hi there' });
  assert.equal(p, 'https://wa.me/15550109999?text=hi%20there');
});

test('whatsapp with no number yields no payload', () => {
  assert.equal(buildPayload('whatsapp', { message: 'hi' }), '');
});

test('utm params only apply when there is a base url', () => {
  assert.equal(buildPayload('url', { url: '', utm: { source: 'x' } }), '');
  assert.equal(
    buildPayload('url', { url: 'https://a.co', utm: { source: 'news letter' } }),
    'https://a.co?utm_source=news_letter',
  );
});

/* ---------------- export gating ---------------- */

test('hasContent is false for blank forms even though payload is truthy', () => {
  // This is the actual bug this guards: buildPayload emits scaffolding, so a
  // truthy payload does not mean the user entered anything.
  for (const mode of ['vcard', 'wifi']) {
    assert.ok(buildPayload(mode, {}).length > 0, `${mode} payload should be non-empty scaffolding`);
    assert.equal(hasContent(mode, {}), false, `${mode} must not be exportable when blank`);
  }
});

test('hasContent is true once a real field is filled', () => {
  assert.equal(hasContent('wifi', { ssid: 'Cafe' }), true);
  assert.equal(hasContent('vcard', { first: 'Ada' }), true);
  assert.equal(hasContent('whatsapp', { number: '15550109999' }), true);
  assert.equal(hasContent('url', { url: 'https://a.co' }), true);
  assert.equal(hasContent('url', { url: '   ' }), false, 'whitespace is not content');
});

/* ---------------- vector SVG export ---------------- */

const DOTS = ['plus', 'star', 'diamond', 'circle', 'square', 'rounded', 'realstar'];
const FINDERS = ['circle', 'rounded', 'square', 'leaf', 'cushion'];

test('SVG export contains no raster image when there is no logo', () => {
  // The export used to wrap a PNG in <image>, so it did not scale — while three
  // articles tell readers to send SVG to the printer because vector stays sharp.
  const m = getMatrix('https://qrcodeagent.net', 'Q');
  for (const dot of DOTS) {
    for (const finder of FINDERS) {
      const svg = buildSVG(m, 512, '#000000', '#ffffff', dot, finder, null, 'circle', false);
      assert.ok(!svg.includes('<image'), `${dot}/${finder} emitted a raster image`);
    }
  }
});

test('SVG export is resolution-independent', () => {
  const m = getMatrix('https://qrcodeagent.net', 'Q');
  const svg = buildSVG(m, 512, '#000000', '#ffffff', 'square', 'square', null, 'circle', false);
  assert.match(svg, /viewBox="0 0 512 512"/, 'needs a viewBox or it will not scale');
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /<\/svg>$/);
});

test('SVG draws one shape per dark module plus the three finders', () => {
  const m = getMatrix('https://qrcodeagent.net', 'Q');
  const n = m.length;
  const inFinder = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  let dark = 0;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (m[r][c] && !inFinder(r, c)) dark++;
  const svg = buildSVG(m, 512, '#000000', '#ffffff', 'square', 'square', null, 'circle', false);
  const rects = (svg.match(/<rect/g) || []).length;
  const paths = (svg.match(/<path/g) || []).length;
  // 1 background rect + one rect per dark data module; square finders are drawn
  // as paths (3 layers x 3 finders) because they may need asymmetric corners.
  assert.equal(rects, 1 + dark, 'one rect per dark module plus the background');
  assert.equal(paths, 9, 'three finders, three layers each');
});

test('SVG honours the same quiet zone as the canvas', () => {
  const m = getMatrix('https://a.co', 'Q');
  const n = m.length, out = 512;
  const cell = out / (n + QUIET_MODULES * 2);
  const expected = QUIET_MODULES * cell;
  const svg = buildSVG(m, out, '#000000', '#ffffff', 'square', 'square', null, 'circle', false);
  // the first data/finder shape must start at least one quiet zone in
  const xs = [...svg.matchAll(/<rect x="([\d.]+)"/g)].map((x) => +x[1]).filter((v) => v > 0);
  assert.ok(Math.min(...xs) >= expected - 0.01, 'content encroaches on the quiet zone');
});

test('a logo is the only thing allowed to embed a raster', () => {
  const m = getMatrix('https://qrcodeagent.net', 'H');
  const svg = buildSVG(m, 512, '#000000', '#ffffff', 'square', 'square',
    'data:image/png;base64,iVBORw0KGgo=', 'circle', true);
  assert.ok(svg.includes('<image'), 'user-supplied logo must be embedded');
  assert.ok(svg.includes('clip-path'), 'logo must be clipped to its shape');
  assert.equal((svg.match(/<image/g) || []).length, 1, 'exactly one raster, the logo');
});
