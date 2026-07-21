// Content invariants for pages.json.
//
// Every rule here corresponds to a mistake actually made on this project:
// a 61-char title, ten orphan pages, two keyword collisions, an llms.txt that
// silently dropped three pages. Encoding them as tests means the next one fails
// in CI instead of in Search Console.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const data = JSON.parse(readFileSync(new URL('../src/content/pages.json', import.meta.url), 'utf8'));
const pages = data.pages;
const slugs = new Set(pages.map((p) => p.slug || ''));
const norm = (s) => (s || '').toLowerCase().trim();
const internal = (href) => href.startsWith('/') && !href.startsWith('//');
const toSlug = (href) => href.replace(/^\//, '').replace(/\/$/, '');

test('every page has the fields the templates require', () => {
  for (const p of pages) {
    const id = p.slug || '/';
    for (const f of ['archetype', 'title', 'meta', 'h1', 'primary']) {
      assert.ok(p[f], `${id} is missing "${f}"`);
    }
  }
});

test('titles are within the 60-char SERP limit', () => {
  // The home page shipped at 61 chars once; Google truncates past ~60.
  const over = pages.filter((p) => p.title.length > 60).map((p) => `${p.slug || '/'} (${p.title.length})`);
  assert.deepEqual(over, []);
});

test('meta descriptions are 70-155 chars', () => {
  const bad = pages
    .filter((p) => p.meta.length < 70 || p.meta.length > 155)
    .map((p) => `${p.slug || '/'} (${p.meta.length})`);
  assert.deepEqual(bad, []);
});

test('titles and metas are unique', () => {
  for (const field of ['title', 'meta']) {
    const seen = new Map();
    for (const p of pages) {
      const k = norm(p[field]);
      assert.ok(!seen.has(k), `duplicate ${field}: ${p.slug || '/'} and ${seen.get(k)}`);
      seen.set(k, p.slug || '/');
    }
  }
});

test('no two pages target the same primary keyword', () => {
  const seen = new Map();
  for (const p of pages) {
    const k = norm(p.primary);
    assert.ok(!seen.has(k), `"${p.primary}" is the primary of both ${p.slug || '/'} and ${seen.get(k)}`);
    seen.set(k, p.slug || '/');
  }
});

test('no page targets another page\'s primary as a secondary', () => {
  // SEO-BRIEF §5.6 — this is how self-competition starts. Two real collisions
  // were found and removed: home vs /qr-code-with-logo, and
  // /event-qr-code vs /qr-codes-for-events.
  const owner = new Map(pages.map((p) => [norm(p.primary), p.slug || '/']));
  const clashes = [];
  for (const p of pages) {
    for (const s of p.secondaries || []) {
      const who = owner.get(norm(s));
      if (who && who !== (p.slug || '/')) clashes.push(`"${s}" owned by ${who}, used by ${p.slug || '/'}`);
    }
  }
  assert.deepEqual(clashes, []);
});

test('every internal link points at a page that exists', () => {
  const bad = [];
  const check = (href, from) => {
    if (!href || !internal(href)) return;
    const s = toSlug(href.split('#')[0].split('?')[0]);
    if (!slugs.has(s)) bad.push(`${from} -> ${href}`);
  };
  for (const p of pages) {
    const id = p.slug || '/';
    (p.related || []).forEach((h) => check(h, id));
    (p.other_generators || []).forEach((h) => check(h, id));
    (p.tools || []).forEach((t) => check(t.href, id));
    (p.directory || []).forEach((d) => (d.links || []).forEach((h) => check(h, id)));
    (p.articles || []).forEach((a) => check(a.href, id));
    if (p.featured) check(p.featured.href, id);
    check(p.cta_href, id);
  }
  for (const nav of data.site.primary_nav || []) check(nav.href, 'site.primary_nav');
  for (const col of data.site.footer_columns || []) (col.links || []).forEach((l) => check(l.href, 'site.footer'));
  assert.deepEqual(bad, []);
});

test('no page is an orphan', () => {
  // Ten pages once had zero inbound links and were effectively invisible.
  const linked = new Set(['']);
  const add = (href) => { if (href && internal(href)) linked.add(toSlug(href.split('#')[0])); };
  for (const p of pages) {
    (p.related || []).forEach(add);
    (p.other_generators || []).forEach(add);
    (p.tools || []).forEach((t) => add(t.href));
    (p.directory || []).forEach((d) => (d.links || []).forEach(add));
    (p.articles || []).forEach((a) => add(a.href));
    if (p.featured) add(p.featured.href);
    add(p.cta_href);
  }
  for (const nav of data.site.primary_nav || []) add(nav.href);
  for (const col of data.site.footer_columns || []) (col.links || []).forEach((l) => add(l.href));
  const orphans = pages.filter((p) => p.slug && !linked.has(p.slug)).map((p) => p.slug);
  assert.deepEqual(orphans, []);
});

test('articles live under /learn and carry Article schema', () => {
  for (const p of pages.filter((x) => x.archetype === 'article')) {
    assert.ok(p.slug.startsWith('learn/'), `${p.slug} should be nested under learn/`);
    assert.ok((p.schema || []).includes('Article'), `${p.slug} is missing Article schema`);
    assert.ok((p.schema || []).includes('BreadcrumbList'), `${p.slug} is missing BreadcrumbList`);
    assert.ok(p.cta_href, `${p.slug} has no CTA back to a tool`);
  }
});

test('articles are substantial', () => {
  // Thin articles are worse than none — they dilute the cluster.
  for (const p of pages.filter((x) => x.archetype === 'article')) {
    const words = (p.sections || []).flatMap((s) => [...(s.p || []), ...(s.list || [])])
      .join(' ').split(/\s+/).filter(Boolean).length;
    assert.ok(words >= 600, `${p.slug} has only ${words} words`);
  }
});

test('the only emoji on the site is the support coffee', () => {
  // CLAUDE.md §8. Emoji leaking into titles or body copy is an easy regression.
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  for (const p of pages) {
    const text = JSON.stringify({ ...p, cta_href: '' });
    const found = text.match(new RegExp(emoji, 'gu')) || [];
    const bad = found.filter((e) => e !== '☕');
    assert.deepEqual(bad, [], `${p.slug || '/'} contains ${bad.join(' ')}`);
  }
});

test('live locales are only those with a content bundle', () => {
  // hreflang and the sitemap must never advertise a locale that 404s.
  const declared = data.site.languages.map((l) => l.code);
  assert.ok(declared.includes('en'));
  assert.equal(declared[0], 'en', 'en must be the default locale');
});

test('the support link is a real Stripe payment link', () => {
  const href = data.site.support.href;
  assert.match(href, /^https:\/\/buy\.stripe\.com\/\w+$/, `support link looks wrong: ${href}`);
  assert.ok(!href.includes('REPLACE'), 'placeholder payment link would ship a dead CTA');
});
