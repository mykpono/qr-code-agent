// The CJK webfonts are COMMITTED, not built (scripts/build-cjk-subset.sh needs
// Python tooling Vercel does not have). That makes them the one asset that can
// silently fall out of sync with content: edit a zh-tw FAQ answer, introduce a
// character the subset does not carry, and the build stays green while that one
// glyph renders in a system fallback mid-sentence — against golden rule 1, and
// invisible to every other check because the HTML is perfectly valid.
//
// So this asserts the direction that actually rots: every han character the
// shipped bundle uses must exist in the committed font. It does NOT assert the
// reverse (the font carries ~2,700 CLDR hanzi our copy never uses — that is
// deliberate, so a visitor typing their own text into the generator still gets
// real glyphs).
//
// Non-han symbols are excluded on purpose: ☕ and ✕ are absent from Noto Sans TC
// and from the Latin families too, so they fall back on EVERY locale including
// English. That is pre-existing, not a zh-tw regression.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const isHan = (c) => (c >= '一' && c <= '鿿') || (c >= '㐀' && c <= '䶿');

function charsIn(value, acc = new Set()) {
  if (typeof value === 'string') for (const c of value) acc.add(c);
  else if (Array.isArray(value)) for (const v of value) charsIn(v, acc);
  else if (value && typeof value === 'object') for (const v of Object.values(value)) charsIn(v, acc);
  return acc;
}

// Minimal woff2 cmap reader would need a font library; instead the subset's
// character list is re-derived from the same inputs the build script used and
// compared against a committed manifest of what the font actually contains.
// The manifest is produced by the build script run, so a stale font means a
// stale manifest and this test fails either way.
const MANIFEST = 'public/fonts/noto-sans-tc.coverage.json';

test('the committed Traditional Chinese font covers every han character in the zh-tw bundle', () => {
  const bundle = root('src/content/i18n/zh-tw.json');
  if (!existsSync(bundle)) return; // locale not live yet — nothing to guard

  assert.ok(existsSync(root(MANIFEST)),
    `${MANIFEST} is missing — run \`bash scripts/build-cjk-subset.sh zh-tw\` and commit its output`);

  const covered = new Set(JSON.parse(readFileSync(root(MANIFEST), 'utf8')).han);
  const used = charsIn(JSON.parse(readFileSync(bundle, 'utf8')));
  charsIn(JSON.parse(readFileSync(root('src/content/ui.json'), 'utf8')), used);

  const missing = [...used].filter((c) => isHan(c) && !covered.has(c)).sort();
  assert.deepEqual(missing, [],
    `zh-tw copy uses ${missing.length} han character(s) the committed font does not carry: `
    + `${missing.join('')} — rerun \`bash scripts/build-cjk-subset.sh zh-tw\` and commit the .woff2 files`);
});
