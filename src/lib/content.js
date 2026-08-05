import data from '../content/pages.json';
import UI_EN from '../content/ui.json';
import SEO from '../content/seo-head-terms.json';

export const SITE = data.site;
export const PAGES = data.pages;
export const BASE = SITE.base || 'https://qrcodeagent.net';

// Support link is deploy-time config, not content: the Vercel env var wins so it
// can be changed without a commit, with pages.json as the fallback.
export const SUPPORT_URL =
  import.meta.env.PUBLIC_STRIPE_SUPPORT_URL || SITE.support.href;

// hreflang code mapping (folder prefix -> hreflang attribute)
//
// zh-tw maps to the SCRIPT subtag 'zh-Hant', not to 'zh-TW'. The folder is named
// for the market the copy is written for (Taiwan), but the hreflang claim is
// about the writing system, so Hong Kong and Macau readers — who read the same
// Traditional script — are served this locale instead of falling through to
// x-default English. Simplified is a different bundle if it ever ships; do NOT
// widen this to a bare 'zh', which would claim both scripts.
const HREFLANG = {
  en: 'en', es: 'es', 'pt-br': 'pt-BR', de: 'de', fr: 'fr', it: 'it',
  ja: 'ja', id: 'id', uk: 'uk', pl: 'pl', ru: 'ru', 'zh-tw': 'zh-Hant',
};

// Rollout order from SEO-BRIEF §11 Phase 3 (by validated head-term opportunity).
// zh-tw sits beside ja because it is the other full-width locale, NOT because
// its demand was measured — SEO-BRIEF §8.2 has no Chinese entry and no Semrush
// pull has been done. Re-sort it once that data exists; the order only drives
// the language switcher and the hreflang emission order.
const LOCALE_ORDER = ['en', 'de', 'id', 'pt-br', 'ja', 'zh-tw', 'pl', 'it', 'fr', 'uk', 'es', 'ru'];

// Translation bundles: src/content/i18n/<locale>.json. A locale goes live purely
// by having a bundle here — nothing else needs editing.
const BUNDLES = import.meta.glob('../content/i18n/*.json', { eager: true, import: 'default' });
export const TRANSLATIONS = Object.fromEntries(
  Object.entries(BUNDLES).map(([path, mod]) => [path.match(/([^/]+)\.json$/)[1], mod]),
);

// Locales with published content, in rollout order. EN is always live.
export const LIVE_LOCALES = LOCALE_ORDER.filter(
  (loc) => loc === 'en' || TRANSLATIONS[loc],
);

export function isLive(locale) {
  return LIVE_LOCALES.includes(locale);
}

// Deep merge of a translation over the English page.
//
// This has to recurse. A translation bundle carries PROSE ONLY, so a nested
// object contributes just its text keys: `directory` arrives as [{heading}]
// while English has [{heading, anchor, links}]. A shallow {...page, ...t}
// replaced the whole array and dropped `links`, and the template then called
// .map() on undefined — a hard build failure on the first localized page.
// Recursing keeps every structural sibling (links, anchor, href, colors, seed)
// from English while taking the translated strings.
function mergeTranslation(en, tr) {
  if (tr === undefined) return en;
  if (Array.isArray(en) && Array.isArray(tr)) {
    // Index-aligned: the merge script already guarantees equal lengths.
    return en.map((v, i) => (i < tr.length ? mergeTranslation(v, tr[i]) : v));
  }
  if (en && typeof en === 'object' && !Array.isArray(en)
      && tr && typeof tr === 'object' && !Array.isArray(tr)) {
    const out = { ...en };
    for (const k of Object.keys(tr)) out[k] = mergeTranslation(en[k], tr[k]);
    return out;
  }
  return tr;
}

// Merge a locale's overrides over the EN page. Untranslated fields fall back to
// EN; structural fields (slug, archetype, tool, related, schema, msv/kd) are
// never translated and always come from the EN source of truth.
export function localizedPage(page, locale = 'en') {
  if (locale === 'en') return page;
  const slug = page.slug || 'home';
  const t = TRANSLATIONS[locale]?.pages?.[slug];
  const merged = t ? { ...mergeTranslation(page, t), locale } : { ...page, locale };

  // SEO head-term overrides win over the translation, and are applied LAST.
  //
  // They live in src/content/seo-head-terms.json rather than inside the locale
  // bundle because `npm run i18n:merge <loc>` rewrites that bundle wholesale —
  // a head term hand-edited into it survives only until the next translation
  // pass or the next page added. These are keyword decisions (SEO-BRIEF 8.2),
  // not translations, so they outlive any re-translation.
  //
  // Shallow by design: an override names a specific scalar field (title, meta,
  // h1). It is not a second translation layer and must not become one.
  const over = SEO.overrides?.[locale]?.[slug];
  return over ? { ...merged, ...over } : merged;
}

// UI chrome for a locale. English lives in src/content/ui.json; a locale bundle
// overrides any subset under its `ui` key. Deep-merged for the same reason page
// content is — `trust` is an array of objects and `gen` is nested, so a shallow
// spread would drop every sibling key a locale did not happen to translate.
export function uiStrings(locale = 'en') {
  if (locale === 'en') return UI_EN;
  return mergeTranslation(UI_EN, TRANSLATIONS[locale]?.ui);
}

export function urlFor(slug, locale = 'en') {
  const prefix = locale === 'en' ? '' : '/' + locale;
  const path = slug ? `${prefix}/${slug}` : prefix || '/';
  return BASE + (path === '' ? '/' : path);
}

// Alternate links for a page across LIVE locales + x-default → EN.
export function alternates(slug) {
  const links = LIVE_LOCALES.map((loc) => ({
    hreflang: HREFLANG[loc],
    href: urlFor(slug, loc),
  }));
  links.push({ hreflang: 'x-default', href: urlFor(slug, 'en') });
  return links;
}

// Prefix an internal href with the active locale. Anchors, external URLs and
// EN all pass through untouched.
export function localHref(href, locale = 'en') {
  if (locale === 'en' || !href || !href.startsWith('/')) return href;
  return href === '/' ? `/${locale}` : `/${locale}${href}`;
}

export function getPage(slug) {
  return PAGES.find((p) => p.slug === slug);
}

// Build the JSON-LD @graph for a page based on its `schema` list.
export function schemaGraph(page, locale = 'en') {
  const canonical = urlFor(page.slug, locale);
  const want = new Set(page.schema || []);
  const graph = [];

  // Organization and WebSite are SITE-level entities and are emitted on every
  // page in every locale, unconditionally — they are deliberately not gated on
  // the page's `schema` list the way the page-level types below are.
  //
  // They used to be gated, and only 2 of 47 pages opted in. That left 45 pages
  // asserting no publisher identity at all, which is the entity problem: an
  // unrelated Play Store app called "QRCodeAgent" competes for the same name,
  // and a page that never names its publisher gives Google and LLM crawlers
  // nothing to disambiguate with. `sameAs` is what does the disambiguating, so
  // it has to be on the pages that actually get cited, not just the home page.
  //
  // Consequence: listing "Organization"/"WebSite" in a page's `schema` array is
  // now a no-op. Existing entries are left in place as documentation of intent.
  const sameAs = [
    SITE.creator?.github,
    SITE.creator?.linkedin,
    SITE.creator?.site,
  ].filter(Boolean);
  graph.push({
    '@type': 'Organization', '@id': `${BASE}/#organization`,
    name: SITE.name,
    url: `${BASE}/`,
    logo: { '@type': 'ImageObject', url: `${BASE}/assets/logo.png`, width: 512, height: 512 },
    description: SITE.tagline,
    ...(SITE.creator?.name
      ? {
        founder: {
          '@type': 'Person',
          name: SITE.creator.name,
          ...(SITE.creator.linkedin ? { url: SITE.creator.linkedin } : {}),
        },
      }
      : {}),
    ...(sameAs.length ? { sameAs } : {}),
  });
  graph.push({
    '@type': 'WebSite', '@id': `${BASE}/#website`, url: `${BASE}/`,
    name: SITE.name, publisher: { '@id': `${BASE}/#organization` },
    inLanguage: LIVE_LOCALES.map((loc) => HREFLANG[loc]),
  });
  if (want.has('SoftwareApplication')) {
    graph.push({
      '@type': ['SoftwareApplication', 'WebApplication'],
      name: page.title, url: canonical,
      applicationCategory: 'DesignApplication', operatingSystem: 'Web browser',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      isPartOf: { '@id': `${BASE}/#website` },
    });
  }
  if (want.has('BreadcrumbList') && page.slug) {
    // Nested pages (/learn/<slug>) get their hub as an intermediate crumb so the
    // trail matches the on-page breadcrumb.
    const parts = page.slug.split('/');
    const trail = [{ '@type': 'ListItem', position: 1, name: 'Home', item: urlFor('', locale) }];
    if (parts.length > 1) {
      const hub = getPage(parts[0]);
      trail.push({
        '@type': 'ListItem', position: 2,
        name: hub ? hub.h1 : parts[0], item: urlFor(parts[0], locale),
      });
    }
    trail.push({ '@type': 'ListItem', position: trail.length + 1, name: page.h1, item: canonical });
    graph.push({ '@type': 'BreadcrumbList', itemListElement: trail });
  }
  if (want.has('Article')) {
    graph.push({
      '@type': 'Article',
      headline: page.h1,
      description: page.meta,
      url: canonical,
      mainEntityOfPage: canonical,
      author: {
        '@type': 'Person',
        name: SITE.creator?.name || 'Myk Pono',
        url: SITE.creator?.linkedin,
      },
      publisher: { '@id': `${BASE}/#organization` },
      isPartOf: { '@id': `${BASE}/#website` },
      ...(page.published ? { datePublished: page.published } : {}),
      ...(page.updated_iso ? { dateModified: page.updated_iso } : {}),
    });
  }
  if (want.has('HowTo') && page.howto) {
    graph.push({
      '@type': 'HowTo', name: page.howto.title,
      step: page.howto.steps.map((s, i) => ({
        '@type': 'HowToStep', position: i + 1, name: s.name, text: s.text,
      })),
    });
  }
  if (want.has('FAQPage') && page.faq) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: page.faq.map((q) => ({
        '@type': 'Question', name: q.q,
        acceptedAnswer: { '@type': 'Answer', text: q.a },
      })),
    });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}

// Resolve an href in pages.json to the human label of its target page.
export function labelFor(href, locale = 'en') {
  const slug = href.replace(/^\//, '');
  const p = getPage(slug);
  if (p) return localizedPage(p, locale).h1;
  return href.replace('/qr-codes-for-', '').replace(/^\//, '').replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
