// Per-locale title/meta limits — the C4 (JA) blocker from the traffic plan.
//
// The regression these guard against is subtle: the Latin 70-155 meta rule was
// enforced identically in three places, so a Japanese bundle could only satisfy
// it by padding every description to ~3x its visible length. These tests pin
// both halves — Latin locales keep the original rule, JA gets the halved one.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  limitsFor, localeFromUrl, checkLengths,
  DEFAULT_LIMITS, FULL_WIDTH_LIMITS,
} from './seo-limits.js';

test('latin locales keep the original shipped rule', () => {
  for (const loc of ['en', 'de', 'es', 'id', 'pt-br', 'pl', 'it', 'fr', 'uk']) {
    assert.deepEqual(limitsFor(loc), DEFAULT_LIMITS, `${loc} should use the Latin default`);
  }
  assert.equal(DEFAULT_LIMITS.titleMax, 60);
  assert.equal(DEFAULT_LIMITS.metaMin, 70);
  assert.equal(DEFAULT_LIMITS.metaMax, 155);
});

test('japanese gets the full-width budget', () => {
  assert.deepEqual(limitsFor('ja'), FULL_WIDTH_LIMITS);
  assert.ok(FULL_WIDTH_LIMITS.titleMax < DEFAULT_LIMITS.titleMax);
  assert.ok(FULL_WIDTH_LIMITS.metaMin < DEFAULT_LIMITS.metaMin);
});

test('unknown locales fall back to the Latin default rather than throwing', () => {
  assert.deepEqual(limitsFor('zz'), DEFAULT_LIMITS);
  assert.deepEqual(limitsFor(undefined), DEFAULT_LIMITS);
});

test('localeFromUrl reads the prefix, and only for locales that are live', () => {
  const live = ['de', 'es', 'ja'];
  assert.equal(localeFromUrl('/ja/wifi-qr-code', live), 'ja');
  assert.equal(localeFromUrl('/de/', live), 'de');
  assert.equal(localeFromUrl('/wifi-qr-code', live), 'en');
  assert.equal(localeFromUrl('/', live), 'en');
  assert.equal(localeFromUrl('https://qrcodeagent.net/ja/vcard-qr-code', live), 'ja');
  // a locale that is NOT live must not be inferred from a URL that looks like one
  assert.equal(localeFromUrl('/fr/wifi-qr-code', live), 'en');
});

test('the JA meta that the old global rule made impossible now passes', () => {
  // A natural Japanese description of this page, ~55 full-width chars. It sits
  // BELOW the old 70-char floor, so the single global rule rejected it and the
  // only way to comply was padding. This is the exact case that blocked C4.
  const meta = 'ロゴ入りの無料QRコードジェネレーター。登録不要、ウォーターマークなし。ブラウザ内で生成でき、PNGとSVGで保存できます。';
  assert.ok(meta.length < DEFAULT_LIMITS.metaMin,
    `fixture must be under the Latin floor to be meaningful — it is ${meta.length}`);
  assert.deepEqual(checkLengths({ meta, locale: 'ja' }), [], 'should be valid Japanese');
  // The same string must still be rejected for a Latin locale — proving the fix
  // is per-locale and did not simply loosen the rule for everyone.
  assert.equal(checkLengths({ meta, locale: 'de' }).length, 1, 'should be too short for German');
});

test('checkLengths reports the locale and the limit it applied', () => {
  const [msg] = checkLengths({ title: 'あ'.repeat(40), locale: 'ja', label: 'ja/home' });
  assert.match(msg, /ja\/home/);
  assert.match(msg, /40 chars/);
  assert.match(msg, /max 30 for ja/);
});

test('valid input produces no problems, and absent fields are skipped', () => {
  assert.deepEqual(checkLengths({ title: 'A fine English title', locale: 'en' }), []);
  assert.deepEqual(checkLengths({ locale: 'en' }), []); // nothing supplied, nothing to check
  assert.deepEqual(checkLengths({ title: undefined, meta: undefined, locale: 'ja' }), []);
});
