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
  // scannable() also strips the preset catalogues, whose example URLs can contain
  // a literal that looks like a lookup (Telegram's "https://t.me/…" reads as
  // "t.me") but is data, not a ui.json reference.
  for (const f of COMPONENTS) {
    for (const m of scannable(read(f)).matchAll(/\bt\.([a-zA-Z0-9_.]+)/g)) paths.add(m[1]);
  }
  const resolve = (p) => p.split('.').reduce((o, k) => (o == null ? o : o[k]), ui);
  for (const p of paths) {
    // t.dot[k] / t.field[x] style dynamic lookups resolve to the parent object
    const base = p.replace(/\.$/, '');
    assert.notEqual(resolve(base), undefined, `components reference t.${base} but ui.json has no such key`);
  }
});

// A key a locale DOES define must exist in English too — otherwise it is dead
// weight or, worse, a typo silently falling back to English forever. The
// opposite direction (English keys a locale is missing) is the test below.
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

// And every English key must exist in every bundle. scripts/i18n-merge.mjs does
// enforce this — but ONLY while merging a fresh .i18n-work/<locale>-ui-out.json.
// Nothing re-checked an existing bundle, so a key added to ui.json AFTER a
// locale landed fell back to English silently and forever. That is exactly what
// happened to all 13 field.ph.* placeholders: they shipped in ui.json, de and es
// never gained them, every test passed, and the generator quietly rendered
// "Order enquiry" and "Table for two tonight?" inside a German widget.
//
// A string that should stay English in a locale still has to be DECLARED there,
// carrying the English text. Silence is not a decision.
test('every locale bundle covers every English ui key', () => {
  const dir = root + 'content/i18n/';
  if (!existsSync(dir)) return;
  const leaves = (node, path, out) => {
    if (Array.isArray(node)) return node.forEach((v, i) => leaves(v, `${path}[${i}]`, out));
    if (node && typeof node === 'object') {
      // `_`-prefixed keys are editorial notes to translators, not shipped copy.
      for (const k of Object.keys(node)) if (!k.startsWith('_')) leaves(node[k], path ? `${path}.${k}` : k, out);
      return;
    }
    out.push(path);
  };
  const want = []; leaves(ui, '', want);
  const at = (o, p) => p.split('.').reduce((acc, seg) => {
    if (acc == null) return acc;
    const m = seg.match(/^(.*?)\[(\d+)\]$/);
    return m ? acc[m[1]]?.[Number(m[2])] : acc[seg];
  }, o);
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const bundle = JSON.parse(readFileSync(dir + f, 'utf8'));
    if (!bundle.ui) continue;
    const missing = want.filter((p) => typeof at(bundle.ui, p) !== 'string');
    assert.deepEqual(missing, [],
      `${f} is missing ${missing.length} ui key(s) — they will render in English: ${missing.slice(0, 12).join(', ')}`);
  }
});

// The industry/use-case preset cards read their labels from ui.json `preset`,
// keyed by the catalogue's `key`. Those catalogues are stripped by scannable()
// before the hardcoded-copy scan above, so nothing else can see them: without
// this test, adding a preset ships an English label to every locale unnoticed.
// Parsed from source because Generator.jsx is JSX and cannot be imported here.
test('every industry / use-case preset has a ui.json label', () => {
  const src = read('components/Generator.jsx');
  const found = new Set();
  for (const group of ['INDUSTRY', 'USECASE']) {
    const block = src.match(new RegExp(`const ${group} = \\[([\\s\\S]*?)\\n\\];`));
    assert.ok(block, `Generator.jsx no longer declares a ${group} catalogue — update this test`);
    const keys = [...block[1].matchAll(/\bkey:\s*'([^']+)'/g)].map((m) => m[1]);
    assert.ok(keys.length, `${group} presets have no \`key\` — their labels cannot be translated`);
    for (const k of keys) {
      found.add(k);
      assert.equal(typeof ui.preset[k], 'string', `${group} preset "${k}" has no ui.preset label`);
    }
  }
  const orphans = Object.keys(ui.preset).filter((k) => !k.startsWith('_') && !found.has(k));
  assert.deepEqual(orphans, [], `ui.preset has labels for presets that no longer exist: ${orphans.join(', ')}`);
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

// The demo CTA is seeded straight into the frame-text input, which caps at
// maxLength. A translation longer than that opens the widget already showing
// the amber over-limit counter, and the string can never be typed back once
// the visitor edits the field. DE shipped at 25/24 exactly this way.
test('every locale demo CTA fits the frame-text input', () => {
  const src = read('components/Generator.jsx');
  const m = src.match(/value=\{frameText\}\s+maxLength=\{(\d+)\}/);
  assert.ok(m, 'Generator.jsx no longer caps the frame-text input — update this test');
  const max = Number(m[1]);

  const check = (label, s) =>
    assert.ok(
      typeof s === 'string' && [...s].length <= max,
      `${label} demoCta is ${[...(s || '')].length} chars, over the ${max} the input allows: ${s}`,
    );

  check('ui.json', ui.gen.demoCta);
  const dir = root + 'content/i18n/';
  if (!existsSync(dir)) return;
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const cta = JSON.parse(readFileSync(dir + f, 'utf8')).ui?.gen?.demoCta;
    if (cta !== undefined) check(f, cta);
  }
});
