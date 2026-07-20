import data from '../content/pages.json';

export const SITE = data.site;
export const PAGES = data.pages;
export const BASE = SITE.base || 'https://qrcodeagent.net';

// Support link is deploy-time config, not content: the Vercel env var wins so it
// can be changed without a commit, with pages.json as the fallback.
export const SUPPORT_URL =
  import.meta.env.PUBLIC_STRIPE_SUPPORT_URL || SITE.support.href;

// hreflang code mapping (folder prefix -> hreflang attribute)
const HREFLANG = {
  en: 'en', es: 'es', 'pt-br': 'pt-BR', de: 'de', fr: 'fr', it: 'it',
  ja: 'ja', id: 'id', uk: 'uk', pl: 'pl', ru: 'ru',
};

// Rollout order from SEO-BRIEF §11 Phase 3 (by validated head-term opportunity).
const LOCALE_ORDER = ['en', 'de', 'id', 'pt-br', 'ja', 'pl', 'it', 'fr', 'uk', 'es', 'ru'];

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

// Merge a locale's overrides over the EN page. Untranslated fields fall back to
// EN; structural fields (slug, archetype, tool, related, schema, msv/kd) are
// never translated and always come from the EN source of truth.
export function localizedPage(page, locale = 'en') {
  if (locale === 'en') return page;
  const t = TRANSLATIONS[locale]?.pages?.[page.slug || 'home'];
  return t ? { ...page, ...t, locale } : { ...page, locale };
}

// Generator/UI strings for a locale, falling back to EN for any missing key.
export function uiStrings(locale = 'en') {
  return { ...(TRANSLATIONS.en?.ui || {}), ...(TRANSLATIONS[locale]?.ui || {}) };
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
  if (want.has('Organization')) {
    graph.push({
      '@type': 'Organization', '@id': `${BASE}/#organization`,
      name: SITE.name, url: `${BASE}/`,
      logo: { '@type': 'ImageObject', url: `${BASE}/assets/logo.png` },
    });
  }
  if (want.has('WebSite')) {
    graph.push({
      '@type': 'WebSite', '@id': `${BASE}/#website`, url: `${BASE}/`,
      name: SITE.name, publisher: { '@id': `${BASE}/#organization` },
      inLanguage: Object.values(HREFLANG),
    });
  }
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
    graph.push({
      '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: urlFor('', locale) },
        { '@type': 'ListItem', position: 2, name: page.h1, item: canonical },
      ],
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
