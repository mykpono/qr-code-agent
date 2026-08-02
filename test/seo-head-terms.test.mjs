// Per-locale head-term invariants (Workstream C0/C0b).
//
// The failure this exists to prevent, in the runbook's own words: "Keywords are
// not localized. The de/es bundles render the English page's intent." A locale
// can therefore ship 47 fluent pages that target nothing, and the loss is
// invisible — the build passes, the pages read correctly, and only Search
// Console eventually shows a high-demand market getting no impressions.
//
// So the head term for each locale is declared as DATA in
// src/content/seo-head-terms.json, and asserted here against every money page.
// A new locale cannot repeat the mistake without failing CI.
//
// Scope is deliberate: only home/feature/type — the generator money pages.
// Articles, industry hubs and use-case pages take question/comparison and
// vertical intent and link down; forcing the generator head term into their
// titles would be cannibalization, not optimization.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const SEO = read('../src/content/seo-head-terms.json');
const data = read('../src/content/pages.json');

const i18nDir = fileURLToPath(new URL('../src/content/i18n/', import.meta.url));
const bundles = existsSync(i18nDir)
  ? readdirSync(i18nDir).filter((f) => f.endsWith('.json'))
    .map((f) => [f.replace(/\.json$/, ''), JSON.parse(readFileSync(i18nDir + f, 'utf8'))])
  : [];

const ARCHETYPE = Object.fromEntries(data.pages.map((p) => [p.slug || 'home', p.archetype]));
const SLUGS = new Set(Object.keys(ARCHETYPE));
const MONEY = new Set(['home', 'feature', 'type']);

// Accent- and hyphen-insensitive, because the alternative is writing bad copy.
// German compounds REQUIRE hyphens ("QR-Code-Generator"), and Spanish requires
// the accent ("códigos"); Google tokenizes on hyphens and folds diacritics, so
// both already match their head term. Matching loosely here is what stops
// someone "fixing" a title into misspelled Spanish to chase a query string.
const norm = (s) => (s || '').toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/[-–—]/g, ' ');
const hasTerm = (title, term) => norm(term).split(/\s+/).every((t) => norm(title).includes(t));

test('every declared head term names a real, live locale', () => {
  const live = new Set(bundles.map(([loc]) => loc));
  for (const loc of Object.keys(SEO.headTerms)) {
    assert.ok(live.has(loc), `headTerms.${loc} has no bundle in src/content/i18n/`);
    assert.ok(SEO.headTerms[loc].term, `headTerms.${loc} has no term`);
    assert.ok(SEO.headTerms[loc].source, `headTerms.${loc} must cite its source`);
  }
});

test('every live locale declares a head term', () => {
  // Without this, a locale can ship untargeted simply by not being listed —
  // which is exactly how the DE bundle went live against English intent.
  for (const [loc] of bundles) {
    assert.ok(SEO.headTerms[loc],
      `locale "${loc}" is live but declares no head term in seo-head-terms.json`);
  }
});

test('money-page titles carry their locale head term', () => {
  const misses = [];
  for (const [loc, bundle] of bundles) {
    const term = SEO.headTerms[loc]?.term;
    if (!term) continue;
    for (const [slug, page] of Object.entries(bundle.pages || {})) {
      if (!MONEY.has(ARCHETYPE[slug]) || !page.title) continue;
      const title = SEO.overrides?.[loc]?.[slug]?.title ?? page.title;
      if (!hasTerm(title, term)) misses.push(`${loc}/${slug}: "${title}" lacks "${term}"`);
    }
  }
  assert.deepEqual(misses, [], `\n  ${misses.join('\n  ')}\n`);
});

test('overrides target real locales, real slugs and real fields', () => {
  const FIELDS = new Set(['title', 'meta', 'h1', 'subhead']);
  for (const [loc, pages] of Object.entries(SEO.overrides || {})) {
    assert.ok(SEO.headTerms[loc], `override for unknown locale "${loc}"`);
    for (const [slug, fields] of Object.entries(pages)) {
      // A typo'd slug is the dangerous case: it fails silently and the page
      // keeps shipping the untargeted title.
      assert.ok(SLUGS.has(slug), `override "${loc}.${slug}" is not a page in pages.json`);
      for (const [f, v] of Object.entries(fields)) {
        assert.ok(FIELDS.has(f), `override "${loc}.${slug}.${f}" is not an overridable field`);
        assert.equal(typeof v, 'string', `override "${loc}.${slug}.${f}" must be a string`);
      }
    }
  }
});

test('overridden titles and metas stay within SERP limits', () => {
  // check-build.mjs catches this on built HTML; catching it here names the
  // offending string instead of a URL.
  for (const [loc, pages] of Object.entries(SEO.overrides || {})) {
    for (const [slug, f] of Object.entries(pages)) {
      if (f.title) {
        assert.ok(f.title.length <= 60,
          `${loc}.${slug}.title is ${f.title.length} chars (max 60): ${f.title}`);
      }
      if (f.meta) {
        assert.ok(f.meta.length >= 70 && f.meta.length <= 155,
          `${loc}.${slug}.meta is ${f.meta.length} chars (need 70-155)`);
      }
    }
  }
});
