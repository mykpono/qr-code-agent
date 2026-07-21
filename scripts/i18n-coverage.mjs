// Prove the extractor accounts for every field in pages.json.
//
// This exists because the first extraction pass silently missed `sections` —
// the entire body of the ten Learn articles — along with scenarios, tools,
// articles, featured, callout and table. A missed prose field does not fail the
// build: localizedPage() falls back to English, so the field just quietly ships
// in the wrong language inside an otherwise-translated page.
//
//   node scripts/i18n-coverage.mjs
//
// Fails if pages.json contains a key that is neither declared translatable nor
// declared structural, so adding a new content field forces a decision.

import { readFileSync } from 'node:fs';
import { TRANSLATABLE_KEYS, STRUCTURAL_FIELDS, extractPage } from './i18n-extract.mjs';

const { pages } = JSON.parse(readFileSync('src/content/pages.json', 'utf8'));

const unknown = new Map();
const walk = (node, path) => {
  if (Array.isArray(node)) return node.forEach((v) => walk(v, path));
  if (!node || typeof node !== 'object') return;
  for (const [k, v] of Object.entries(node)) {
    if (!TRANSLATABLE_KEYS.has(k) && !STRUCTURAL_FIELDS.has(k)) {
      unknown.set(k, [...(unknown.get(k) || []), path].slice(0, 3));
    }
    walk(v, path);
  }
};
pages.forEach((p) => walk(p, p.slug || 'home'));

// Stronger check: every prose STRING in the page must actually come back out of
// extractPage. Key-name classification alone is not enough — `howto.steps` was
// read with guessed sub-keys ({h,t} instead of {name,text}), which produced
// `{}` per step. Every key name involved was "classified", so the name-based
// check passed while 75 how-to steps were dropped. Comparing actual string
// payloads catches a wrong-shape read, not just an unclassified name.
const strings = (node, into, underStructural = false) => {
  if (typeof node === 'string') { if (!underStructural) into.push(node); return; }
  if (Array.isArray(node)) return node.forEach((v) => strings(v, into, underStructural));
  if (!node || typeof node !== 'object') return;
  for (const [k, v] of Object.entries(node)) strings(v, into, underStructural || STRUCTURAL_FIELDS.has(k));
};
const dropped = [];
for (const p of pages) {
  const want = []; strings(p, want);
  const got = new Set(); { const g = []; strings(extractPage(p), g); g.forEach((s) => got.add(s)); }
  for (const s of want) if (!got.has(s)) dropped.push([p.slug || 'home', s]);
}

// Word counts: what will be sent for translation vs what is held back.
const count = (o) => JSON.stringify(o).match(/[\p{L}\p{N}'’-]+/gu)?.length || 0;
let translatable = 0, total = 0;
for (const p of pages) { translatable += count(extractPage(p)); total += count(p); }

console.log(`pages:              ${pages.length}`);
console.log(`translatable words: ~${translatable}`);
console.log(`held back (struct): ~${total - translatable}`);

let failed = false;
if (unknown.size) {
  failed = true;
  console.log(`\n❌ ${unknown.size} unclassified key(s) — add to TRANSLATABLE_KEYS or STRUCTURAL_FIELDS in i18n-extract.mjs:`);
  for (const [k, where] of unknown) console.log(`   ${k}  (e.g. ${where.join(', ')})`);
}
if (dropped.length) {
  failed = true;
  console.log(`\n❌ ${dropped.length} prose string(s) never reach the translator — extractPage is reading the wrong shape:`);
  for (const [slug, s] of dropped.slice(0, 12)) console.log(`   ${slug}: "${s.slice(0, 70)}${s.length > 70 ? '…' : ''}"`);
  if (dropped.length > 12) console.log(`   … +${dropped.length - 12} more`);
}
if (failed) process.exit(1);
console.log('\n✅ every key classified and every prose string extracted');
