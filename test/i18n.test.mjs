// Locale bundle invariants — enforcement for decision D-007 (CLAUDE.md rule 9).
//
// A locale goes live purely by having a bundle in src/content/i18n/. From that
// moment getStaticPaths emits EVERY page under its prefix, and localizedPage()
// falls back to the ENGLISH fields for any slug the bundle omits. So an
// incomplete bundle does not quietly skip pages — it publishes English content
// at /de/… while alternates() emits hreflang asserting the page is German.
//
// That failure is invisible in review (the build passes, the pages render) and
// expensive in Search Console, which is exactly the kind of thing this suite
// exists to catch. These tests are inert until the first bundle lands.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { checkLengths } from '../src/lib/seo-limits.js';

const dir = fileURLToPath(new URL('../src/content/i18n/', import.meta.url));
const data = JSON.parse(readFileSync(new URL('../src/content/pages.json', import.meta.url), 'utf8'));
const enSlugs = data.pages.map((p) => p.slug || 'home');

const bundles = existsSync(dir)
  ? readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => [f.replace(/\.json$/, ''), JSON.parse(readFileSync(dir + f, 'utf8'))])
  : [];

test('every locale bundle covers every page (D-007)', () => {
  for (const [locale, bundle] of bundles) {
    const have = new Set(Object.keys(bundle.pages || {}));
    const missing = enSlugs.filter((s) => !have.has(s));
    assert.deepEqual(missing, [],
      `${locale}.json is missing ${missing.length} page(s) — they would ship as English under /${locale}/ `
      + `with hreflang claiming ${locale}: ${missing.slice(0, 8).join(', ')}`);
  }
});

test('no locale bundle references an unknown page', () => {
  const known = new Set(enSlugs);
  for (const [locale, bundle] of bundles) {
    const unknown = Object.keys(bundle.pages || {}).filter((s) => !known.has(s));
    assert.deepEqual(unknown, [], `${locale}.json has pages not in pages.json: ${unknown.join(', ')}`);
  }
});

// Same limits check-build.mjs asserts on built HTML. Catching them here names
// the offending string instead of just the URL, and fails before a 46-page
// locale is generated.
// Limits are PER-LOCALE (src/lib/seo-limits.js). Google truncates by pixel
// width, and full-width CJK glyphs are ~2x Latin, so a single global rule would
// force keyword padding across a whole Japanese bundle. Latin locales keep the
// original 60 / 70-155.
test('translated titles stay within their locale limit', () => {
  for (const [locale, bundle] of bundles) {
    for (const [slug, p] of Object.entries(bundle.pages || {})) {
      const problems = checkLengths({ title: p.title, locale, label: `${locale}/${slug}` });
      assert.deepEqual(problems, [], problems.join('; '));
    }
  }
});

test('translated meta descriptions are within their locale limit and unique', () => {
  for (const [locale, bundle] of bundles) {
    const seen = new Map();
    for (const [slug, p] of Object.entries(bundle.pages || {})) {
      if (typeof p.meta !== 'string') continue;
      const problems = checkLengths({ meta: p.meta, locale, label: `${locale}/${slug}` });
      assert.deepEqual(problems, [], problems.join('; '));
      assert.ok(!seen.has(p.meta), `${locale}/${slug}: meta duplicates ${seen.get(p.meta)}`);
      seen.set(p.meta, slug);
    }
  }
});
