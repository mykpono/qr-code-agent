// Post-build: emit a sitemap of the pages actually built, across the locales
// that actually have a translation bundle. Locales go live by dropping a file
// into src/content/i18n/ — the same rule lib/content.js uses — so this can
// never list a URL that 404s. (The handoff kit's full 528-URL sitemap assumes
// all 11 locales are published; don't ship that one until they are.)
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';

const BASE = 'https://qrcodeagent.net';
const data = JSON.parse(readFileSync(new URL('../src/content/pages.json', import.meta.url)));
const today = new Date().toISOString().slice(0, 10);

// Must mirror LOCALE_ORDER / HREFLANG in src/lib/content.js.
const LOCALE_ORDER = ['en', 'de', 'id', 'pt-br', 'ja', 'pl', 'it', 'fr', 'uk', 'es', 'ru'];
const HREFLANG = {
  en: 'en', es: 'es', 'pt-br': 'pt-BR', de: 'de', fr: 'fr', it: 'it',
  ja: 'ja', id: 'id', uk: 'uk', pl: 'pl', ru: 'ru',
};

const i18nDir = new URL('../src/content/i18n/', import.meta.url);
const bundled = existsSync(i18nDir)
  ? readdirSync(i18nDir).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''))
  : [];
const LIVE = LOCALE_ORDER.filter((l) => l === 'en' || bundled.includes(l));

const urlFor = (slug, locale) => {
  const prefix = locale === 'en' ? '' : `/${locale}`;
  return BASE + (slug ? `${prefix}/${slug}` : prefix || '/');
};

const urls = LIVE.flatMap((locale) =>
  data.pages.map((p) => {
    const loc = urlFor(p.slug, locale);
    // EN home is the site's most important URL; other locales' homes rank just
    // under it, and inner pages below that.
    const pr = !p.slug ? (locale === 'en' ? '1.0' : '0.9') : locale === 'en' ? '0.8' : '0.7';
    const alts = [
      ...LIVE.map((l) => `    <xhtml:link rel="alternate" hreflang="${HREFLANG[l]}" href="${urlFor(p.slug, l)}"/>`),
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${urlFor(p.slug, 'en')}"/>`,
    ].join('\n');
    return `  <url>
    <loc>${loc}</loc>
${alts}
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${pr}</priority>
  </url>`;
  }),
).join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`;
writeFileSync(new URL('../dist/sitemap.xml', import.meta.url), xml);

// llms.txt — proposed standard, no proven citation impact yet, but it is
// zero-cost hygiene and is generated here so it can never drift from the
// actual page set.
const group = (archetype, heading) => {
  const list = data.pages
    .filter((p) => p.archetype === archetype && p.slug)
    .map((p) => `- [${p.h1}](${BASE}/${p.slug}): ${p.subhead || p.intro?.slice(0, 110) || ''}`)
    .join('\n');
  return list ? `\n## ${heading}\n${list}\n` : '';
};
const llms = `# ${'QR Code Agent'}
> Free QR code generator with logo. No sign-up, no watermark, no expiry. Codes are
> generated entirely in your browser — nothing is uploaded and no scans are tracked.
> Static codes only: the destination is baked into the image and cannot be edited later.

## Key Pages
- [Home](${BASE}/): Free QR code generator — all types, styling, and logo support.
${group('feature', 'Features')}${group('type', 'By QR type')}${group('usecase', 'By use case')}${group('industry', 'By industry')}
## About
- Created by Myk Pono — https://www.linkedin.com/in/mykolaponomarenko/
- All generation is client-side. No account, no tracking of generated codes.
`;
writeFileSync(new URL('../dist/llms.txt', import.meta.url), llms);

console.log(
  `sitemap.xml written (${data.pages.length} pages x ${LIVE.length} locale(s) = ${data.pages.length * LIVE.length} URLs; live: ${LIVE.join(', ')})`,
);
