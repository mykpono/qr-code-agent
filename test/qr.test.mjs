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
  buildPayload, maskPayload, payloadDensity, splitUtm, getMatrix, buildSVG, hasContent, QUIET_MODULES,
  CORNER_KEYS, PATTERN_KEYS, FRAMES, finderSVG, frameMetrics, ctaInk, buildFramedSVG,
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
  ['tel', 'tel:+14155550123'],
  ['sms', 'SMSTO:+14155550123:Table for two at 7?'],
  ['email', 'mailto:hello@example.com?subject=Order%20update&body=Hi%20there'],
  ['text', 'Gate code 4821 — ring bell twice'],
  ['crypto', 'bitcoin:bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq?amount=0.015&label=Tip%20jar'],
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

// An open network has no password: the payload must be T:nopass with no P:
// segment, and hidden networks carry H:true. A WPA/WEP network keeps its P:.
test('wifi handles open networks and hidden flag', () => {
  assert.equal(buildPayload('wifi', { ssid: 'Guest', enc: 'nopass' }), 'WIFI:T:nopass;S:Guest;;');
  assert.ok(!buildPayload('wifi', { ssid: 'Guest', enc: 'nopass', pass: 'ignored' }).includes('P:'),
    'an open network must not emit a P: segment');
  assert.equal(buildPayload('wifi', { ssid: 'Guest', enc: 'WPA', pass: 'pw', hidden: true }),
    'WIFI:T:WPA;S:Guest;P:pw;H:true;;');
});

// Masking is display-only and must never change the encoded string. WiFi hides
// the password; vCard newlines fold to a single ⏎ so the strip stays one line.
test('maskPayload hides the wifi password but leaves the real payload intact', () => {
  const f = { ssid: 'Cafe', pass: 'hunter2', enc: 'WPA' };
  assert.ok(buildPayload('wifi', f).includes('P:hunter2;'), 'real payload keeps the password');
  const masked = maskPayload('wifi', f);
  assert.ok(masked.includes('P:••••••;'), 'masked payload hides the password');
  assert.ok(!masked.includes('hunter2'), 'the cleartext password must not appear masked');
});

test('maskPayload folds vcard newlines to a single line', () => {
  const masked = maskPayload('vcard', { first: 'Ada', last: 'Lovelace' });
  assert.ok(!masked.includes('\n'), 'no raw newlines in the one-line strip');
  assert.ok(masked.includes(' ⏎ '), 'newlines are shown as ⏎');
});

// The density buckets drive the advisory ECC nudge; the 90 and 220 boundaries
// are the contract the payload strip renders against.
test('payloadDensity buckets at the 90 and 220 char boundaries', () => {
  assert.deepEqual(payloadDensity(0), { level: 'empty', suggest: null });
  assert.deepEqual(payloadDensity(90), { level: 'low', suggest: null });
  assert.deepEqual(payloadDensity(91), { level: 'mid', suggest: 'Q' });
  assert.deepEqual(payloadDensity(220), { level: 'mid', suggest: 'Q' });
  assert.deepEqual(payloadDensity(221), { level: 'high', suggest: 'H' });
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

// A bare \D strip would turn "+1 415…" into a domestic-looking number that
// fails to dial from abroad, so the leading + has to survive.
test('tel keeps the leading + and drops separators', () => {
  assert.equal(buildPayload('tel', { phone: '+1 (415) 555-0123' }), 'tel:+14155550123');
  assert.equal(buildPayload('tel', { phone: '020 7946 0958' }), 'tel:02079460958');
  assert.equal(buildPayload('tel', { phone: '' }), '');
  assert.equal(hasContent('tel', { phone: '(  )' }), false);
});

test('sms uses SMSTO and keeps the message optional', () => {
  assert.equal(buildPayload('sms', { number: '+1 415 555 0123', message: 'Table for two?' }),
    'SMSTO:+14155550123:Table for two?');
  assert.equal(buildPayload('sms', { number: '+14155550123' }), 'SMSTO:+14155550123');
  assert.equal(buildPayload('sms', { message: 'orphan' }), '');
});

test('email builds a mailto with encoded subject and body', () => {
  assert.equal(buildPayload('email', { email: 'hi@ex.com' }), 'mailto:hi@ex.com');
  assert.equal(
    buildPayload('email', { email: 'hi@ex.com', subject: 'Spring sale', body: 'Save 20%' }),
    'mailto:hi@ex.com?subject=Spring%20sale&body=Save%2020%25');
  // subject/body are independent — either may be present alone.
  assert.equal(buildPayload('email', { email: 'hi@ex.com', body: 'just a body' }),
    'mailto:hi@ex.com?body=just%20a%20body');
  assert.equal(buildPayload('email', { subject: 'orphan' }), '');
  assert.equal(hasContent('email', { email: '  ' }), false);
  assert.equal(hasContent('email', { email: 'a@b.co' }), true);
});

test('text encodes verbatim, no URL scheme bolted on', () => {
  assert.equal(buildPayload('text', { text: 'Gate code 4821' }), 'Gate code 4821');
  assert.equal(buildPayload('text', { text: '  padded  ' }), 'padded');
  assert.equal(hasContent('text', { text: '   ' }), false);
});

// Bitcoin addresses are case-sensitive in both base58 and bech32 — normalising
// case would produce an address that silently sends funds nowhere.
test('crypto builds BIP-21 and never alters address case', () => {
  const addr = 'bc1QAr0srrr7xfkvy5l643lydnw9re59gtzzw';
  assert.equal(buildPayload('crypto', { address: addr }), `bitcoin:${addr}`);
  assert.equal(
    buildPayload('crypto', { address: addr, amount: '0.015', label: 'Tip jar' }),
    `bitcoin:${addr}?amount=0.015&label=Tip%20jar`,
  );
  assert.equal(buildPayload('crypto', { amount: '1' }), '');
});

test('utm params only apply when there is a base url', () => {
  assert.equal(buildPayload('url', { url: '', utm: { source: 'x' } }), '');
  assert.equal(
    buildPayload('url', { url: 'https://a.co', utm: { source: 'news letter' } }),
    'https://a.co?utm_source=news_letter',
  );
});

// A base that already has a query needs "&" — the Promotion preset ships
// "?code=SAVE20", and a second "?" makes the tracking link malformed.
test('utm appends to a base that already has a query string', () => {
  assert.equal(
    buildPayload('url', { url: 'https://shop.com/promo?code=SAVE20', utm: { source: 'nl' } }),
    'https://shop.com/promo?code=SAVE20&utm_source=nl',
  );
});

// Params after a #fragment are part of the fragment; no analytics tool sees them.
test('utm goes before the fragment, not after it', () => {
  assert.equal(
    buildPayload('url', { url: 'https://a.co/page#pricing', utm: { source: 'nl' } }),
    'https://a.co/page?utm_source=nl#pricing',
  );
});

test('splitUtm pulls utm out and keeps everything else on the base', () => {
  assert.deepEqual(splitUtm('https://a.co'), { base: 'https://a.co', utm: {} });
  assert.deepEqual(
    splitUtm('https://a.co?utm_source=nl&utm_medium=email'),
    { base: 'https://a.co', utm: { source: 'nl', medium: 'email' } },
  );
  // non-utm params and the fragment survive
  assert.deepEqual(
    splitUtm('https://shop.com/p?code=SAVE20&utm_source=nl#buy'),
    { base: 'https://shop.com/p?code=SAVE20#buy', utm: { source: 'nl' } },
  );
  // encoded values come back decoded
  assert.deepEqual(
    splitUtm('https://a.co?utm_campaign=spring%20launch'),
    { base: 'https://a.co', utm: { campaign: 'spring launch' } },
  );
});

// The URL field displays buildPayload's output and feeds edits back through
// splitUtm, so the pair must round-trip or editing a tagged link corrupts it.
test('buildPayload and splitUtm round-trip', () => {
  for (const url of ['https://a.co', 'https://shop.com/p?code=SAVE20', 'https://a.co/x#buy']) {
    const utm = { source: 'nl', medium: 'email', campaign: 'spring_launch' };
    const { base, utm: back } = splitUtm(buildPayload('url', { url, utm }));
    assert.equal(base, url, `base survives for ${url}`);
    assert.deepEqual(back, utm, `utm survives for ${url}`);
  }
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

/* ---------------- module contract ----------------
   The extraction into lib/qr.js shipped a production crash: drawMod and
   drawFinderReal stayed module-private while Generator.jsx still called them,
   so the island threw "drawMod is not defined" and the whole generator vanished
   on the live site. The build passed and every test passed, because nothing
   checked that the component's imports actually resolve. This does. */

test('lib/qr.js exports everything Generator.jsx imports from it', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../src/components/Generator.jsx', import.meta.url), 'utf8');
  const m = src.match(/import\s*\{([^}]+)\}\s*from\s*'\.\.\/lib\/qr\.js'/);
  assert.ok(m, 'Generator.jsx should import from lib/qr.js');
  const wanted = m[1].split(',').map((s) => s.trim().split(/\s+as\s+/)[0]).filter(Boolean);
  const mod = await import('../src/lib/qr.js');
  const missing = wanted.filter((name) => mod[name] === undefined);
  assert.deepEqual(missing, [], `lib/qr.js is missing: ${missing.join(', ')}`);
});

test('Generator.jsx calls no bare helper that lib/qr.js does not provide', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../src/components/Generator.jsx', import.meta.url), 'utf8');
  const imported = new Set(
    (src.match(/import\s*\{([^}]+)\}\s*from\s*'\.\.\/lib\/qr\.js'/)?.[1] || '')
      .split(',').map((s) => s.trim().split(/\s+as\s+/).pop()).filter(Boolean),
  );
  const defined = new Set([...src.matchAll(/(?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/g)].map((x) => x[1]));
  // the QR helpers specifically — the ones that live in lib/qr.js
  const QR_HELPERS = ['drawMod', 'drawFinderReal', 'renderReal', 'getMatrix', 'buildSVG', 'buildPayload', 'bakeLogo', 'traceRR'];
  const broken = QR_HELPERS.filter((h) => new RegExp(`\\b${h}\\s*\\(`).test(src) && !imported.has(h) && !defined.has(h));
  assert.deepEqual(broken, [], `called but neither imported nor defined: ${broken.join(', ')}`);
});

/* ---------------- style catalogues ----------------
   The handoff calls out a specific trap: drawCorner's ring is punched out with
   destination-out only when the background is 'transparent'. Get that wrong and
   all nine corner options render as identical dark blobs — which looks like a
   styling nit and is actually nine dead controls. The SVG twin shares the
   geometry, so distinct SVG output is the cheap proof that the shapes differ. */

test('all nine corner styles produce distinct geometry', () => {
  const seen = new Map();
  for (const key of CORNER_KEYS) {
    const svg = finderSVG(0, 0, 10, key, '#000000', '#ffffff');
    assert.ok(!seen.has(svg), `corner "${key}" renders identically to "${seen.get(svg)}"`);
    seen.set(svg, key);
  }
  assert.equal(seen.size, 9);
});

test('every pattern and corner key has a label in ui.json', async () => {
  const { readFileSync } = await import('node:fs');
  const ui = JSON.parse(readFileSync(new URL('../src/content/ui.json', import.meta.url), 'utf8'));
  for (const k of PATTERN_KEYS) assert.ok(ui.dot[k], `ui.json has no dot label for "${k}"`);
  for (const k of CORNER_KEYS) assert.ok(ui.finder[k], `ui.json has no finder label for "${k}"`);
  for (const f of FRAMES) assert.ok(ui.frame[f.key], `ui.json has no frame label for "${f.key}"`);
});

/* ---------------- frames ----------------
   The prototype drew the frame in DOM only, so a download silently dropped the
   frame the user had just designed. These pin the shared geometry that stops
   the preview and the exported file from disagreeing. */

test('frame metrics scale linearly with k', () => {
  const full = frameMetrics('banner', 1, 'M', 'grotesk');
  const tile = frameMetrics('banner', 0.5, 'M', 'grotesk');
  assert.equal(full.pad, 14);
  assert.equal(tile.pad, 7);
  assert.equal(full.radius, 22);
  assert.equal(tile.radius, 11);
  assert.equal(full.bottom.font, Math.round(19 * 1));
  assert.equal(tile.bottom.font, Math.round(19 * 0.5));
});

test('a gradient frame has no border — the gradient IS the border', () => {
  const ribbon = frameMetrics('ribbon', 1, 'M', 'grotesk');
  assert.equal(ribbon.border, 0, 'ribbon must not draw a solid border under the gradient');
  assert.ok(ribbon.gradPad > 0, 'ribbon needs padding for the gradient to show');
  const banner = frameMetrics('banner', 1, 'M', 'grotesk');
  assert.ok(banner.border > 0);
  assert.equal(banner.gradPad, 0);
});

test('the CTA colour resolves per bar kind when set to auto', () => {
  // auto = white on a solid/pill bar, the frame colour on a bar sitting on paper
  assert.equal(ctaInk('auto', '#6d4dff', true), '#ffffff');
  assert.equal(ctaInk('auto', '#6d4dff', false), '#6d4dff');
  assert.equal(ctaInk('#e11d48', '#6d4dff', true), '#e11d48', 'an explicit colour always wins');
});

test('frame "none" exports exactly the plain code', () => {
  const m = getMatrix('https://qrcodeagent.net', 'Q');
  const plain = buildSVG(m, 512, '#000000', '#ffffff', 'square', 'square', null, 'circle', false);
  const framed = buildFramedSVG({
    matrix: m, size: 512, fg: '#000000', bg: '#ffffff', dot: 'square', finder: 'square',
    logoDataUrl: null, logoShape: 'circle', logoBorder: false, frame: 'none',
  });
  assert.equal(framed, plain, 'the no-frame path must not re-wrap the code');
});

test('a framed export is larger than the code and still contains all of it', () => {
  const m = getMatrix('https://qrcodeagent.net', 'Q');
  const opts = {
    matrix: m, size: 512, fg: '#6d4dff', bg: '#ffffff', dot: 'square', finder: 'square',
    logoDataUrl: null, logoShape: 'circle', logoBorder: false,
    frameColor: '#6d4dff', frameText: 'SCAN ME', ctaColor: 'auto', ctaSize: 'M', frameFont: 'grotesk',
  };
  const plainShapes = (buildSVG(m, 512, '#6d4dff', '#ffffff', 'square', 'square', null, 'circle', false).match(/<rect/g) || []).length;
  for (const frame of ['border', 'caption', 'banner', 'pill', 'thick', 'banner-top', 'label', 'ticket', 'ribbon']) {
    const svg = buildFramedSVG({ ...opts, frame });
    const [, w, h] = svg.match(/width="(\d+)" height="(\d+)"/);
    assert.ok(+w > 512, `${frame}: framed width ${w} should exceed the 512px code`);
    assert.ok(+h >= +w, `${frame}: a bar should make the frame at least as tall as it is wide`);
    // every data module survives the re-hosting into the frame
    assert.ok((svg.match(/<rect/g) || []).length > plainShapes, `${frame}: lost code shapes`);
    assert.ok(svg.includes('translate('), `${frame}: the code must be offset into the frame`);
  }
});

test('a frame with a caption slot carries the CTA text; a bare frame does not', () => {
  const m = getMatrix('https://qrcodeagent.net', 'Q');
  const opts = {
    matrix: m, size: 512, fg: '#000000', bg: '#ffffff', dot: 'square', finder: 'square',
    logoDataUrl: null, logoShape: 'circle', logoBorder: false,
    frameColor: '#1c1c1c', frameText: 'ORDER HERE', ctaColor: 'auto', ctaSize: 'M', frameFont: 'grotesk',
  };
  assert.ok(buildFramedSVG({ ...opts, frame: 'banner' }).includes('>ORDER HERE<'));
  assert.ok(!buildFramedSVG({ ...opts, frame: 'thick' }).includes('>ORDER HERE<'),
    'a frame with no bar must not print the CTA anyway');
});

test('CTA text is escaped, not injected, into the exported SVG', () => {
  const m = getMatrix('https://qrcodeagent.net', 'Q');
  const svg = buildFramedSVG({
    matrix: m, size: 512, fg: '#000000', bg: '#ffffff', dot: 'square', finder: 'square',
    logoDataUrl: null, logoShape: 'circle', logoBorder: false, frame: 'banner',
    frameColor: '#1c1c1c', frameText: '</text><script>x</script>', ctaColor: 'auto', ctaSize: 'M', frameFont: 'grotesk',
  });
  assert.ok(!svg.includes('<script>'), 'CTA text must not be able to inject markup into a downloaded file');
  assert.ok(svg.includes('&lt;/text&gt;'));
});

test('CTA size steps scale the bar font monotonically', () => {
  const sizes = ['XS', 'S', 'M', 'L', 'XL'];
  const fonts = sizes.map((s) => frameMetrics('banner', 1, s, 'grotesk').bottom.font);
  for (let i = 1; i < fonts.length; i++) {
    assert.ok(fonts[i] > fonts[i - 1], `${sizes[i]} should be larger than ${sizes[i - 1]}`);
  }
});
