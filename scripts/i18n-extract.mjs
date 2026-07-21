// Extract the translatable fields of every page into flat chunks.
//
// Translation is all-or-nothing per locale (CLAUDE.md rule 9 / D-007), so the
// job is large enough that it needs a real extract → translate → merge pipeline
// rather than hand-editing a 237KB JSON. This produces the "extract" half, and
// i18n-merge.mjs consumes the translated chunks back into a locale bundle.
//
//   node scripts/i18n-extract.mjs de            → .i18n-work/de/chunk-*.json
//   node scripts/i18n-extract.mjs de --chunks 6
//
// Structural fields are deliberately excluded: slug, archetype, tool, related,
// other_generators, schema, msv/kd/phase/build/primary/secondaries. Those are
// routing and config, never prose, and lib/content.js always reads them from the
// English source of truth.

import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'src/content/pages.json';
const OUT = '.i18n-work';

// Prose fields only. Anything not listed here is never sent for translation.
//
// Keep this list exhaustive: a prose field omitted here is NOT skipped at build
// time — localizedPage() falls back to the English value, so the field ships as
// English inside an otherwise-German page. `sections` in particular carries the
// entire body of the ten Learn articles and was missed on the first pass.
// `npm run i18n:coverage` fails if pages.json grows a field absent from both
// lists, so this cannot silently drift again.
const STRING_FIELDS = ['title', 'meta', 'h1', 'subhead', 'intro', 'badge', 'cat',
  'scenarios_title', 'articles_title', 'updated', 'reading'];
const LIST_FIELDS = ['whereToUse', 'tips', 'categories'];
const OBJ_LIST_FIELDS = {
  benefits: ['h', 't'],
  faq: ['q', 'a'],
  scenarios: ['h', 't'],
  tools: ['name', 'tag', 'text', 'cta'],       // href/colors stay English
  articles: ['cat', 'title', 'text', 'meta'],  // href stays English
  directory: ['heading'],                      // anchor/links stay English
};

// Fields that are routing, config, dates or design tokens — never translated.
export const STRUCTURAL_FIELDS = new Set(['slug', 'archetype', 'phase', 'build', 'primary',
  'msv', 'kd', 'secondaries', 'tool', 'related', 'other_generators', 'schema', 'priority',
  'published', 'updated_iso', 'cta_href', 'href', 'anchor', 'links', 'fg', 'bg', 'icon',
  'date', 'author', 'cover', 'readingTime', 'locale',
  'mode', 'note',            // tool.* — generator config and internal build notes
  'dot', 'finder', 'seed']); // tools[].* — QR style tokens for the thumbnail

export function extractPage(page) {
  const out = {};
  for (const f of STRING_FIELDS) if (typeof page[f] === 'string') out[f] = page[f];
  for (const f of LIST_FIELDS) if (Array.isArray(page[f])) out[f] = [...page[f]];
  for (const [f, keys] of Object.entries(OBJ_LIST_FIELDS)) {
    if (Array.isArray(page[f])) {
      out[f] = page[f].map((o) => Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k]])));
    }
  }
  // howto is { title, steps: [{ name, text }] } — 25 pages, 75 steps. This was
  // first written against a guessed {h,t} shape, which produced steps of
  // `{h: undefined, t: undefined}`; those serialise to `{}`, so the whole
  // how-to block was handed to translators empty and came back empty. Read the
  // real keys, and emit a key only when it is actually a string so the shape
  // sent for translation is exactly the shape validated on the way back.
  if (page.howto && typeof page.howto === 'object') {
    const h = {};
    if (typeof page.howto.title === 'string') h.title = page.howto.title;
    if (Array.isArray(page.howto.steps)) {
      h.steps = page.howto.steps.map((s) => {
        const o = {};
        if (typeof s.name === 'string') o.name = s.name;
        if (typeof s.text === 'string') o.text = s.text;
        return o;
      });
    }
    if (Object.keys(h).length) out.howto = h;
  }
  // featured: { kicker, title, text, meta, href } — href stays English
  if (page.featured && typeof page.featured === 'object') {
    const keys = ['kicker', 'title', 'text', 'meta'].filter((k) => typeof page.featured[k] === 'string');
    if (keys.length) out.featured = Object.fromEntries(keys.map((k) => [k, page.featured[k]]));
  }
  // sections: [{ h, p: [paragraphs], list?: [items] }] — the body copy of the
  // Learn articles and the About/Privacy pages. The bulk of the site's words.
  if (Array.isArray(page.sections)) {
    out.sections = page.sections.map((s) => {
      const o = {};
      if (typeof s.h === 'string') o.h = s.h;
      if (Array.isArray(s.p)) o.p = [...s.p];
      if (Array.isArray(s.list)) o.list = [...s.list];
      if (typeof s.callout === 'string') o.callout = s.callout;
      // table: { head: [col…], rows: [[cell…]…] } — headers and every cell are
      // prose (they carry units and verdicts like "Safe — the benchmark").
      if (s.table && typeof s.table === 'object') {
        o.table = {};
        if (Array.isArray(s.table.head)) o.table.head = [...s.table.head];
        if (Array.isArray(s.table.rows)) o.table.rows = s.table.rows.map((r) => [...r]);
      }
      return o;
    });
  }
  return out;
}

// Every prose key this module knows how to extract, at any nesting depth. Used
// by the coverage guard to prove nothing in pages.json is unaccounted for.
export const TRANSLATABLE_KEYS = new Set([
  ...STRING_FIELDS, ...LIST_FIELDS, ...Object.keys(OBJ_LIST_FIELDS),
  ...Object.values(OBJ_LIST_FIELDS).flat(),
  'howto', 'steps', 'featured', 'kicker', 'sections', 'h', 't', 'p', 'q', 'a',
  'list', 'callout', 'table', 'head', 'rows', 'name', 'text', 'cta', 'heading',
]);

// Everything below is the CLI. Guarded so i18n-merge.mjs and i18n-coverage.mjs
// can import extractPage without triggering an extraction run.
const invokedDirectly = process.argv[1] && process.argv[1].endsWith('i18n-extract.mjs');
if (!invokedDirectly) { /* imported as a module */ } else {

const locale = process.argv[2];
if (!locale) { console.error('usage: node scripts/i18n-extract.mjs <locale> [--chunks N]'); process.exit(1); }
const nChunks = Number((process.argv.find((a) => a.startsWith('--chunks=')) || '').split('=')[1])
  || (process.argv.includes('--chunks') ? Number(process.argv[process.argv.indexOf('--chunks') + 1]) : 0)
  || 6;

const { pages } = JSON.parse(readFileSync(SRC, 'utf8'));
const entries = pages.map((p) => [p.slug || 'home', extractPage(p)]);

const dir = join(OUT, locale);
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });

// Bin-pack by word count rather than slicing sequentially. Page sizes vary ~20x
// (a Learn article is ~2,300 words, a type page ~250), so equal-sized slices
// hand one translator ten times the work of another and the whole run waits on
// it. Largest-first into the first bin with room keeps chunks even.
const count = (o) => JSON.stringify(o).match(/[\p{L}\p{N}'’-]+/gu)?.length || 0;
const sized = entries.map(([slug, obj]) => ({ slug, obj, n: count(obj) }))
  .sort((a, b) => b.n - a.n);
const total = sized.reduce((a, b) => a + b.n, 0);
const target = Math.ceil(total / nChunks);
const bins = [];
for (const item of sized) {
  let bin = bins.find((b) => b.n + item.n <= target);
  if (!bin && bins.length < nChunks) { bin = { n: 0, items: [] }; bins.push(bin); }
  if (!bin) bin = bins.reduce((a, b) => (a.n <= b.n ? a : b)); // oversized page: least-full bin
  bin.n += item.n;
  bin.items.push(item);
}
bins.forEach((b, i) => {
  const name = `chunk-${String(i + 1).padStart(2, '0')}.json`;
  writeFileSync(join(dir, name), JSON.stringify(Object.fromEntries(b.items.map((x) => [x.slug, x.obj])), null, 2));
  console.log(`  ${name}  ${String(b.n).padStart(5)} words  ${b.items.length} pages`);
});
console.log(`extracted ${entries.length} pages → ${dir}/ (${bins.length} chunks, ~${total} words, target ~${target}/chunk)`);

}
