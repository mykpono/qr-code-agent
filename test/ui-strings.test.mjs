// UI chrome must come from src/content/ui.json, not from the components.
//
// Before this existed, every label in the generator, header, footer and page
// templates was a literal in JSX. Page copy translated fine, so /de/ and /es/
// looked done — while the whole frame around the copy (DOT STYLE, LIVE PREVIEW,
// DOWNLOAD PNG, Network name (SSID), the trust pills, the consent banner) stayed
// English. Nothing failed; it just quietly shipped a half-translated page.
//
// These tests make that regression loud: a new hardcoded label fails CI.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../src/', import.meta.url));
const ui = JSON.parse(readFileSync(root + 'content/ui.json', 'utf8'));

const COMPONENTS = [
  'components/Generator.jsx', 'components/Page.astro', 'components/Header.astro',
  'components/Footer.astro', 'components/Consent.astro',
];
const read = (f) => readFileSync(root + f, 'utf8');

// Strip the frontmatter/comments and the preset catalogue, whose `name` fields
// are proper names of designs (Classic, Neon, Telegram) and stay English.
function scannable(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\n)\s*\/\/[^\n]*/g, '')
    .replace(/const (CREATIVE|SOCIAL|INDUSTRY|USECASE) = \[[\s\S]*?\n\];/g, '');
}

test('no hardcoded placeholder / aria-label / title attributes in components', () => {
  for (const f of COMPONENTS) {
    const literal = [...scannable(read(f)).matchAll(/\b(placeholder|aria-label|title)="([^"{][^"]*)"/g)]
      .map((m) => `${m[1]}="${m[2]}"`);
    assert.deepEqual(literal, [], `${f} has hardcoded attribute text — move it to ui.json: ${literal.join(', ')}`);
  }
});

// A sentence of visible prose between tags. Short/symbol-only text (QR, ›, ×) is
// markup furniture, not copy.
test('no hardcoded sentences in component markup', () => {
  for (const f of COMPONENTS) {
    const bad = [...scannable(read(f)).matchAll(/>\s*([A-Z][A-Za-z][^<>{}]{14,})</g)]
      .map((m) => m[1].trim())
      .filter((s) => /[a-z]/.test(s));
    assert.deepEqual(bad, [], `${f} has hardcoded copy — move it to ui.json: ${bad.slice(0, 4).join(' | ')}`);
  }
});

test('every ui.json key a component references actually exists', () => {
  const paths = new Set();
  for (const f of COMPONENTS) {
    for (const m of read(f).matchAll(/\bt\.([a-zA-Z0-9_.]+)/g)) paths.add(m[1]);
  }
  const resolve = (p) => p.split('.').reduce((o, k) => (o == null ? o : o[k]), ui);
  for (const p of paths) {
    // t.dot[k] / t.field[x] style dynamic lookups resolve to the parent object
    const base = p.replace(/\.$/, '');
    assert.notEqual(resolve(base), undefined, `components reference t.${base} but ui.json has no such key`);
  }
});

// A locale bundle may translate any subset, but a key it DOES define must exist
// in English too — otherwise it is dead weight or, worse, a typo silently
// falling back to English forever.
test('locale ui overrides only use keys that exist in English', () => {
  const dir = root + 'content/i18n/';
  if (!existsSync(dir)) return;
  const walk = (en, tr, path, out) => {
    for (const k of Object.keys(tr || {})) {
      if (en == null || !(k in en)) { out.push(`${path}${k}`); continue; }
      if (tr[k] && typeof tr[k] === 'object' && !Array.isArray(tr[k])) walk(en[k], tr[k], `${path}${k}.`, out);
    }
  };
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const bundle = JSON.parse(readFileSync(dir + f, 'utf8'));
    if (!bundle.ui) continue;
    const unknown = [];
    walk(ui, bundle.ui, '', unknown);
    assert.deepEqual(unknown, [], `${f} ui has keys absent from ui.json: ${unknown.join(', ')}`);
  }
});

// nav / footerCols are label arrays indexed positionally against pages.json, so
// a length mismatch silently drops or misaligns a link label.
test('ui label arrays line up with pages.json structure', () => {
  const site = JSON.parse(readFileSync(root + 'content/pages.json', 'utf8')).site;
  assert.equal(ui.nav.length, site.primary_nav.length, 'ui.nav length != site.primary_nav');
  assert.equal(ui.footerCols.length, site.footer_columns.length, 'ui.footerCols length != site.footer_columns');
  site.footer_columns.forEach((c, i) => {
    assert.equal(ui.footerCols[i].links.length, c.links.length, `ui.footerCols[${i}].links length mismatch`);
  });
  const dir = root + 'content/i18n/';
  if (!existsSync(dir)) return;
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const b = JSON.parse(readFileSync(dir + f, 'utf8'));
    if (!b.ui?.nav) continue;
    assert.equal(b.ui.nav.length, ui.nav.length, `${f}: ui.nav length mismatch`);
    b.ui.footerCols?.forEach((c, i) => {
      assert.equal(c.links.length, ui.footerCols[i].links.length, `${f}: footerCols[${i}] mismatch`);
    });
  }
});
