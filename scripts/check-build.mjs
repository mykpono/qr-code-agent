// Post-build verification of dist/.
//
// The content tests check pages.json; this checks what actually shipped. Both
// are needed — the sitemap, llms.txt and the rendered <head> are generated, so
// they can drift from the source even when the source is correct.
//
// Run: node scripts/check-build.mjs   (also runs in CI after the build)

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath, not .pathname — the project path contains a space, which
// .pathname leaves percent-encoded and fs then fails to find.

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
if (!existsSync(DIST)) {
  console.error('dist/ not found — run `npm run build` first.');
  process.exit(1);
}

const walk = (dir, out = []) => {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    statSync(p).isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
};

const files = walk(DIST);
const served = new Set();
for (const f of files) {
  const rel = '/' + relative(DIST, f);
  served.add(rel.endsWith('/index.html') ? (rel.slice(0, -11) || '/') : rel);
}

const pages = new Map();
for (const f of files.filter((f) => f.endsWith('index.html'))) {
  const url = '/' + relative(DIST, f).replace(/index\.html$/, '').replace(/\/$/, '');
  pages.set(url || '/', readFileSync(f, 'utf8'));
}

const failures = [];
const check = (name, ok, detail = '') => {
  if (!ok) failures.push(`${name}${detail ? ` -> ${detail}` : ''}`);
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}`);
};

console.log(`Checking ${pages.size} built pages\n`);

// --- every internal href/src resolves -------------------------------------
const refs = new Map();
for (const [url, html] of pages) {
  for (const m of html.matchAll(/(?:href|src)="(\/[^"#?]*)"/g)) {
    const k = m[1].replace(/\/$/, '') || '/';
    if (!refs.has(k)) refs.set(k, url);
  }
}
const dead = [...refs.keys()].filter((k) => !served.has(k) && !served.has(k + '/'));
check('no dead internal references', dead.length === 0, dead.slice(0, 5).join(', '));

// --- head hygiene ----------------------------------------------------------
const titles = new Map();
const longTitles = [];
const badMeta = [];
const noCanonical = [];
const badH1 = [];
for (const [url, html] of pages) {
  const t = html.match(/<title>(.*?)<\/title>/s)?.[1] ?? '';
  if (t.length > 60) longTitles.push(`${url} (${t.length})`);
  if (titles.has(t)) badMeta.push(`duplicate title: ${url} == ${titles.get(t)}`);
  titles.set(t, url);
  const d = html.match(/<meta name="description" content="(.*?)"/s)?.[1] ?? '';
  if (d.length < 70 || d.length > 155) badMeta.push(`${url} meta ${d.length}`);
  if (!html.includes('rel="canonical"')) noCanonical.push(url);
  const h1s = (html.match(/<h1/g) || []).length;
  if (h1s !== 1) badH1.push(`${url} has ${h1s}`);
}
check('titles within 60 chars', longTitles.length === 0, longTitles.join(', '));
check('meta descriptions 70-155 and unique', badMeta.length === 0, badMeta.slice(0, 5).join(', '));
check('canonical on every page', noCanonical.length === 0, noCanonical.join(', '));
check('exactly one h1 per page', badH1.length === 0, badH1.join(', '));

// --- structured data parses ------------------------------------------------
const badLd = [];
for (const [url, html] of pages) {
  for (const m of html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)) {
    try { JSON.parse(m[1]); } catch (e) { badLd.push(`${url}: ${e.message}`); }
  }
}
check('all JSON-LD parses', badLd.length === 0, badLd.join(', '));

// --- generated files match the page set ------------------------------------
const sitemap = readFileSync(join(DIST, 'sitemap.xml'), 'utf8');
const smUrls = new Set([...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)]
  .map((m) => (m[1].replace(/^https:\/\/qrcodeagent\.net/, '').replace(/\/$/, '') || '/')));
const missing = [...pages.keys()].filter((u) => !smUrls.has(u));
const extra = [...smUrls].filter((u) => !pages.has(u));
check('sitemap matches built pages', missing.length === 0 && extra.length === 0,
  `missing ${missing.join(',')} extra ${extra.join(',')}`);

const llms = readFileSync(join(DIST, 'llms.txt'), 'utf8');
const llmsCount = (llms.match(/qrcodeagent\.net\//g) || []).length;
check('llms.txt lists every page', llmsCount === pages.size, `${llmsCount} of ${pages.size}`);

// --- nothing embarrassing shipped ------------------------------------------
for (const [pattern, label] of [
  [/REPLACE_WITH/i, 'no placeholder tokens'],
  [/Coming soon/i, 'no "coming soon" copy'],
  [/localhost:\d+/, 'no localhost URLs'],
  [/lorem ipsum/i, 'no lorem ipsum'],
]) {
  const hits = [...pages].filter(([, h]) => pattern.test(h)).map(([u]) => u);
  check(label, hits.length === 0, hits.join(', '));
}

// --- launch-critical config ------------------------------------------------
const vercelPath = fileURLToPath(new URL('../vercel.json', import.meta.url));
if (existsSync(vercelPath)) {
  const vercel = JSON.parse(readFileSync(vercelPath, 'utf8'));
  const rewrites = vercel.rewrites ?? [];
  const onlyUmamiProxy = rewrites.length > 0 && rewrites.every((r) =>
    r.source === '/stats/:match*' && typeof r.destination === 'string' && r.destination.includes('umami'));
  check('vercel.json is Umami proxy only (no SPA rewrite)', onlyUmamiProxy);
} else {
  check('no SPA rewrite config', true);
}
check('fonts are self-hosted', ![...pages.values()].some((h) => /fonts\.(googleapis|gstatic)/.test(h)));
check('favicon present', existsSync(join(DIST, 'favicon.svg')));
const robots = readFileSync(join(DIST, 'robots.txt'), 'utf8');
check('robots names AI crawlers', ['GPTBot', 'PerplexityBot', 'ClaudeBot'].every((b) => robots.includes(b)));
check('robots points at the sitemap', robots.includes('Sitemap: https://qrcodeagent.net/sitemap.xml'));

console.log();
if (failures.length) {
  console.error(`${failures.length} check(s) failed:\n` + failures.map((f) => '  - ' + f).join('\n'));
  process.exit(1);
}
console.log(`All checks passed across ${pages.size} pages.`);
