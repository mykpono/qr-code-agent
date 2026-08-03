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
import { checkLengths, localeFromUrl } from '../src/lib/seo-limits.js';

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
// Live locales, taken from the bundles that exist — the same rule lib/content.js
// uses to decide what ships. Needed here so a /ja/ URL can be told apart from an
// English slug that merely starts with those two letters.
const I18N_DIR = fileURLToPath(new URL('../src/content/i18n/', import.meta.url));
const LIVE_LOCALES = existsSync(I18N_DIR)
  ? readdirSync(I18N_DIR).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''))
  : [];

for (const [url, html] of pages) {
  const locale = localeFromUrl(url, LIVE_LOCALES);
  const t = html.match(/<title>(.*?)<\/title>/s)?.[1] ?? '';
  if (titles.has(t)) badMeta.push(`duplicate title: ${url} == ${titles.get(t)}`);
  titles.set(t, url);
  const d = html.match(/<meta name="description" content="(.*?)"/s)?.[1] ?? '';
  // Per-locale limits (src/lib/seo-limits.js) — full-width CJK gets ~half the
  // character budget for the same pixel width.
  const problems = checkLengths({ title: t, meta: d, locale, label: url });
  for (const p of problems) (p.includes('title') ? longTitles : badMeta).push(p);
  if (!html.includes('rel="canonical"')) noCanonical.push(url);
  const h1s = (html.match(/<h1/g) || []).length;
  if (h1s !== 1) badH1.push(`${url} has ${h1s}`);
}
check('titles within their locale limit', longTitles.length === 0, longTitles.join(', '));
check('meta descriptions within locale limit and unique', badMeta.length === 0, badMeta.slice(0, 5).join(', '));
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

// --- entity signals (Workstream B) -----------------------------------------
// An unrelated Play Store app, "QRCodeAgent QR Scan & Generate", competes for
// this brand name. Organization + sameAs on EVERY page in EVERY locale is what
// lets Google and LLM crawlers tell the two apart, so a page that ships without
// it is a page that cannot be disambiguated. These used to be opt-in per page
// and only 2 of 47 pages opted in.
const graphOf = (html) => {
  for (const m of html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)) {
    let parsed;
    try { parsed = JSON.parse(m[1]); } catch { continue; }
    if (parsed['@graph']) return parsed['@graph'];
  }
  return [];
};
const noOrg = [];
const weakOrg = [];
const noWebsite = [];
for (const [url, html] of pages) {
  const graph = graphOf(html);
  const org = graph.find((n) => n['@type'] === 'Organization');
  if (!org) { noOrg.push(url); continue; }
  if (!org.sameAs?.length || !org.logo?.url || !org.founder || org.name !== 'QR Code Agent') {
    weakOrg.push(url);
  }
  if (!graph.some((n) => n['@type'] === 'WebSite')) noWebsite.push(url);
}
check('Organization schema on every page', noOrg.length === 0,
  `${noOrg.length} missing: ${noOrg.slice(0, 5).join(', ')}`);
check('Organization carries name, logo, founder and sameAs', weakOrg.length === 0,
  `${weakOrg.length} incomplete: ${weakOrg.slice(0, 5).join(', ')}`);
check('WebSite schema on every page', noWebsite.length === 0,
  `${noWebsite.length} missing: ${noWebsite.slice(0, 5).join(', ')}`);

// The logo URL is asserted in schema on every page; if the file is not actually
// served, the Organization block is invalid for anything that fetches it. It
// was referenced for months while the file did not exist.
check('Organization logo asset is served', existsSync(join(DIST, 'assets', 'logo.png')),
  'dist/assets/logo.png');

// IndexNow proves domain ownership by this file being fetchable — if it 404s,
// every submission is rejected with a 403 and nothing else reports it. Same
// failure shape as logo.png above: an asset referenced by an external consumer,
// invisible to every other gate. The key inside must match the one the script
// sends, or the file is worse than useless.
const inKey = '8a8056c4eb1dddf9fff1af976d2ae99f';
const inPath = join(DIST, `${inKey}.txt`);
check('IndexNow key file is served and matches the script',
  existsSync(inPath) && readFileSync(inPath, 'utf8').trim() === inKey,
  `dist/${inKey}.txt — must exist and contain exactly the key used in scripts/indexnow-submit.mjs`);

// The one-word form is the COLLIDING app's name — exactly what a model would
// conflate. Rendered text only; URLs and the repo slug legitimately contain it.
const oneWord = [];
for (const [url, html] of pages) {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<(?:a|link|meta|img|image)\b[^>]*>/gi, '')
    .replace(/<[^>]+>/g, ' ');
  if (/QRCodeAgent/i.test(text)) oneWord.push(url);
}
check('no one-word "QRCodeAgent" in page copy', oneWord.length === 0,
  oneWord.slice(0, 5).join(', '));

// og:image is an absolute URL, so the dead-internal-reference check above
// cannot see it, and every page in every locale points at this one file. It
// shipped 404ing once already. It is not generated by the build either — it is
// a committed Chromium screenshot (see scripts/gen-og.mjs) — so a bad merge or
// a stray clean can delete it and no other gate would notice.
check('OG preview card is served', existsSync(join(DIST, 'assets', 'og.png')),
  'dist/assets/og.png — run `npm run og` and commit it');

// --- generated files match the page set ------------------------------------
const sitemap = readFileSync(join(DIST, 'sitemap.xml'), 'utf8');
const smUrls = new Set([...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)]
  .map((m) => (m[1].replace(/^https:\/\/qrcodeagent\.net/, '').replace(/\/$/, '') || '/')));
const missing = [...pages.keys()].filter((u) => !smUrls.has(u));
const extra = [...smUrls].filter((u) => !pages.has(u));
check('sitemap matches built pages', missing.length === 0 && extra.length === 0,
  `missing ${missing.join(',')} extra ${extra.join(',')}`);

// llms.txt lists the CANONICAL (English) page set plus a Languages section,
// rather than every locale's copy of every page. Repeating all 46 pages once
// per locale would pad the file with near-duplicate entries that say nothing a
// locale prefix does not already convey. So this counts English pages, and
// separately asserts every live locale is named.
const llms = readFileSync(join(DIST, 'llms.txt'), 'utf8');
const enPages = [...pages.keys()].filter((u) => !/^\/[a-z]{2}(-[a-z]{2})?\//.test(u) && !/^\/[a-z]{2}(-[a-z]{2})?$/.test(u));
const llmsLinks = new Set([...llms.matchAll(/\(https:\/\/qrcodeagent\.net(\/[^)]*)?\)/g)]
  .map((m) => (m[1] || '/').replace(/\/$/, '') || '/'));
const llmsMissing = enPages.filter((u) => !llmsLinks.has(u));
check('llms.txt lists every English page', llmsMissing.length === 0,
  `missing ${llmsMissing.slice(0, 5).join(',')}`);

const liveLocales = [...new Set([...pages.keys()]
  .map((u) => (u.match(/^\/([a-z]{2}(?:-[a-z]{2})?)(?:\/|$)/) || [])[1]).filter(Boolean))];
const localesMissing = liveLocales.filter((l) => !llmsLinks.has(`/${l}`));
check('llms.txt names every live locale', localesMissing.length === 0,
  `missing ${localesMissing.join(',')}`);

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
