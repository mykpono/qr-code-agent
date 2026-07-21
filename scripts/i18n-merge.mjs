// Merge translated chunks back into a locale bundle, then validate hard.
//
//   node scripts/i18n-merge.mjs de            → src/content/i18n/de.json
//   node scripts/i18n-merge.mjs de --dry-run  → validate only, write nothing
//
// Validation is the point of this script. A locale bundle going live publishes
// 46 URLs (CLAUDE.md rule 9 / D-007), so a malformed or partial bundle is not a
// cosmetic problem — it ships pages that lie about their language. Nothing is
// written unless every check passes.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { extractPage } from './i18n-extract.mjs';

const locale = process.argv[2];
const dryRun = process.argv.includes('--dry-run');
if (!locale) { console.error('usage: node scripts/i18n-merge.mjs <locale> [--dry-run]'); process.exit(1); }

const WORK = join('.i18n-work', locale);
const { pages } = JSON.parse(readFileSync('src/content/pages.json', 'utf8'));
const EN = Object.fromEntries(pages.map((p) => [p.slug || 'home', extractPage(p)]));

// ---- merge ----
// Two passes land here: out-*.json from the initial extraction, and dout-*.json
// from any delta pass (fields the extractor missed the first time round). A slug
// legitimately appears in both, contributing different FIELDS — so merge at the
// field level and only reject a genuine collision on the same field.
const outFiles = existsSync(WORK)
  ? readdirSync(WORK).filter((f) => /^(d|h)?out-\d+\.json$/.test(f)).sort()
  : [];
if (!outFiles.length) { console.error(`no out-*.json / dout-*.json in ${WORK}`); process.exit(1); }
const merged = {};
for (const f of outFiles) {
  const obj = JSON.parse(readFileSync(join(WORK, f), 'utf8'));
  for (const [slug, val] of Object.entries(obj)) {
    merged[slug] = merged[slug] || {};
    for (const [field, v] of Object.entries(val)) {
      if (field in merged[slug]) { console.error(`duplicate field "${slug}.${field}" in ${f}`); process.exit(1); }
      merged[slug][field] = v;
    }
  }
}

// ---- validate ----
const errors = [];
const warnings = [];

// 1. every English page must be present — a partial bundle serves English under
//    the locale prefix while hreflang claims otherwise.
for (const slug of Object.keys(EN)) if (!merged[slug]) errors.push(`MISSING page: ${slug}`);
for (const slug of Object.keys(merged)) if (!EN[slug]) errors.push(`UNKNOWN page (not in pages.json): ${slug}`);

// 2. shape must match the English source exactly
const sameShape = (en, tr, path) => {
  if (Array.isArray(en)) {
    if (!Array.isArray(tr)) return errors.push(`${path}: expected array`);
    if (en.length !== tr.length) return errors.push(`${path}: array length ${tr.length} != EN ${en.length}`);
    en.forEach((v, i) => sameShape(v, tr[i], `${path}[${i}]`));
    return;
  }
  if (en && typeof en === 'object') {
    if (!tr || typeof tr !== 'object') return errors.push(`${path}: expected object`);
    for (const k of Object.keys(en)) {
      if (!(k in tr)) return errors.push(`${path}.${k}: missing`);
      sameShape(en[k], tr[k], `${path}.${k}`);
    }
    return;
  }
  if (typeof tr !== 'string') errors.push(`${path}: expected string`);
};
for (const [slug, en] of Object.entries(EN)) if (merged[slug]) sameShape(en, merged[slug], slug);

// 3. the same length rules check-build.mjs enforces on the built HTML — caught
//    here instead, where the offending string is identifiable.
const metas = new Map();
for (const [slug, t] of Object.entries(merged)) {
  if (typeof t.title === 'string' && t.title.length > 60) errors.push(`${slug}.title ${t.title.length} chars (max 60): ${t.title}`);
  if (typeof t.meta === 'string') {
    if (t.meta.length < 70 || t.meta.length > 155) errors.push(`${slug}.meta ${t.meta.length} chars (need 70-155)`);
    if (metas.has(t.meta)) errors.push(`${slug}.meta duplicates ${metas.get(t.meta)}`);
    metas.set(t.meta, slug);
  }
}

// 4. real links must survive translation. Illustrative URLs inside prose
//    ("facebook.com/yourpage") are fair game to localize, but a value that is
//    ENTIRELY a path or URL is a link — translating it silently 404s the page.
const linkLike = (s) => typeof s === 'string' && /^(\/|https?:\/\/)\S*$/.test(s.trim());
const checkLinks = (en, tr, path) => {
  if (typeof en === 'string') {
    if (linkLike(en) && tr !== en) errors.push(`${path}: link altered — EN "${en}" vs "${tr}"`);
    return;
  }
  if (Array.isArray(en)) return en.forEach((v, i) => checkLinks(v, tr?.[i], `${path}[${i}]`));
  if (en && typeof en === 'object') {
    for (const k of Object.keys(en)) checkLinks(en[k], tr?.[k], `${path}.${k}`);
  }
};
for (const [slug, en] of Object.entries(EN)) if (merged[slug]) checkLinks(en, merged[slug], slug);

// 5. untranslated leakage — identical to English is usually a miss, though some
//    strings legitimately match (brand names, "PNG"). Warn, do not block.
let identical = 0;
for (const [slug, t] of Object.entries(merged)) {
  for (const f of ['title', 'meta', 'h1', 'subhead', 'intro']) {
    if (typeof t[f] === 'string' && t[f] === EN[slug]?.[f] && t[f].split(/\s+/).length > 3) {
      identical++; warnings.push(`${slug}.${f} identical to English`);
    }
  }
}

console.log(`merged ${Object.keys(merged).length} pages from ${outFiles.length} chunks`);
if (warnings.length) {
  console.log(`\n${warnings.length} warning(s):`);
  warnings.slice(0, 15).forEach((w) => console.log('  ⚠️  ' + w));
  if (warnings.length > 15) console.log(`  … +${warnings.length - 15} more`);
}
if (errors.length) {
  console.log(`\n${errors.length} ERROR(s) — nothing written:`);
  errors.slice(0, 40).forEach((e) => console.log('  ❌ ' + e));
  if (errors.length > 40) console.log(`  … +${errors.length - 40} more`);
  process.exit(1);
}
console.log('\n✅ all checks passed');

// ---- optional UI chrome (.i18n-work/<locale>-ui-out.json) ----
// These labels sit in fixed-width controls — the dot/finder pickers are 5-column
// grids sized for English. An over-long translation does not fail the build, it
// just overflows its button, so the limits are enforced here instead.
// Per KEY, not per group: only some members of a group sit in a narrow control.
// `ecc.L/M/Q/H` are grid cells but `ecc.recovery`/`bestWithLogo` are part of a
// full-width caption; `tab.social` is a chip but `tab.themesTitle` is a rail
// heading. A group-wide limit flagged those false positives on the first run.
const LIMITS = {
  dot: { _all: 10 }, finder: { _all: 10 },
  logoShape: { _all: 10 }, logoBorder: { _all: 10 },
  ecc: { L: 12, M: 12, Q: 12, H: 12 },
  tab: { social: 14, industry: 14, usecase: 14, themes: 14 },
};
let ui = null;
const uiPath = join('.i18n-work', `${locale}-ui-out.json`);
if (existsSync(uiPath)) {
  const UI_EN = JSON.parse(readFileSync('src/content/ui.json', 'utf8'));
  ui = JSON.parse(readFileSync(uiPath, 'utf8'));
  delete ui._comment;
  const uiErrors = [];
  const shape = (en, tr, path) => {
    if (Array.isArray(en)) {
      if (!Array.isArray(tr) || tr.length !== en.length) return uiErrors.push(`ui.${path}: array shape`);
      return en.forEach((v, i) => shape(v, tr[i], `${path}[${i}]`));
    }
    if (en && typeof en === 'object') {
      if (!tr || typeof tr !== 'object') return uiErrors.push(`ui.${path}: expected object`);
      for (const k of Object.keys(en)) {
        if (k === '_comment') continue;
        if (!(k in tr)) { uiErrors.push(`ui.${path}${path ? '.' : ''}${k}: missing`); continue; }
        shape(en[k], tr[k], `${path}${path ? '.' : ''}${k}`);
      }
      return;
    }
    if (typeof tr !== 'string') uiErrors.push(`ui.${path}: expected string`);
  };
  shape({ ...UI_EN, _comment: undefined }, ui, '');
  for (const [group, rules] of Object.entries(LIMITS)) {
    for (const [k, v] of Object.entries(ui[group] || {})) {
      const max = rules._all ?? rules[k];
      if (max && typeof v === 'string' && v.length > max) {
        uiErrors.push(`ui.${group}.${k} is ${v.length} chars (max ${max} — it sits in a fixed-width control): "${v}"`);
      }
    }
  }
  if (uiErrors.length) {
    console.log(`\n${uiErrors.length} UI ERROR(s) — nothing written:`);
    uiErrors.slice(0, 20).forEach((e) => console.log('  ❌ ' + e));
    process.exit(1);
  }
  console.log(`ui chrome: ok (${uiPath})`);
} else {
  console.log(`ui chrome: none at ${uiPath} — locale will use English chrome`);
}

if (dryRun) { console.log('(dry run — not written)'); process.exit(0); }
mkdirSync('src/content/i18n', { recursive: true });
const dest = `src/content/i18n/${locale}.json`;
writeFileSync(dest, JSON.stringify(ui ? { ui, pages: merged } : { pages: merged }, null, 2) + '\n');
console.log(`wrote ${dest}`);
