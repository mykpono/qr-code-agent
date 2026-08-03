// Title and meta-description length limits, per locale.
//
// ── Why this is not one global rule ────────────────────────────────────────
// Google truncates by PIXEL WIDTH, not by character count: roughly a 600px
// container for titles and ~920px for description snippets. The Latin defaults
// below express that budget as characters, which works because Latin glyphs are
// roughly uniform in width.
//
// Full-width CJK glyphs are about twice as wide, so the SAME pixel budget holds
// about HALF as many characters. Applying the Latin 70–155 meta rule to Japanese
// therefore demands roughly three times the visible snippet — which is not a
// stylistic quibble: it would force ~50 pages of keyword padding purely to
// satisfy a linter, on the locale where padding reads worst.
//
// This blocked C4 (the JA bundle) in TRAFFIC-IMPLEMENTATION-PLAN.md §5.5. The
// limits were enforced with no per-locale exception in three places at once
// (i18n-merge.mjs, test/i18n.test.mjs, check-build.mjs), so all three now read
// from here rather than each carrying its own copy of the numbers.
//
// ── On the numbers ─────────────────────────────────────────────────────────
// The Latin figures are the site's existing, shipped rule and are unchanged.
// The full-width figures are the same PIXEL budget halved, then rounded to
// round numbers — they are a derivation, not a published Google constant, and
// no per-locale SERP measurement has been done to confirm them. Treat them as a
// sane default that stops the padding problem, and revise if real JA SERP data
// ever contradicts them.

/** Latin-script default — the site's original rule, unchanged. */
export const DEFAULT_LIMITS = Object.freeze({ titleMax: 60, metaMin: 70, metaMax: 155 });

/**
 * Full-width scripts (CJK). Same pixel budget, ~half the characters.
 * metaMin drops furthest on purpose: the old floor of 70 was what forced padding.
 */
export const FULL_WIDTH_LIMITS = Object.freeze({ titleMax: 30, metaMin: 35, metaMax: 90 });

/** Locales that render in full-width glyphs. Add zh / ko here if they ever ship. */
export const FULL_WIDTH_LOCALES = Object.freeze(['ja']);

/** Limits for a locale. Unknown locales get the Latin default. */
export function limitsFor(locale = 'en') {
  return FULL_WIDTH_LOCALES.includes(locale) ? FULL_WIDTH_LIMITS : DEFAULT_LIMITS;
}

/**
 * Locale prefix of a built URL path, given the locales actually live.
 *
 * `knownLocales` is passed in rather than imported because the callers differ:
 * lib/content.js derives live locales from bundle files via Astro's
 * import.meta.glob, which does not resolve under plain Node — and two of the
 * three callers here ARE plain Node scripts.
 *
 *   localeFromUrl('/ja/wifi-qr-code', ['de','ja']) -> 'ja'
 *   localeFromUrl('/wifi-qr-code',    ['de','ja']) -> 'en'
 */
export function localeFromUrl(url, knownLocales = []) {
  const seg = String(url).replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '').split('/')[0];
  return knownLocales.includes(seg) ? seg : 'en';
}

/**
 * Validate one page's title/meta against its locale's limits.
 * Returns an array of human-readable problems — empty means valid.
 * Shared so all three call sites word failures identically.
 */
export function checkLengths({ title, meta, locale = 'en', label = '' }) {
  const { titleMax, metaMin, metaMax } = limitsFor(locale);
  const where = label ? `${label}: ` : '';
  const out = [];
  if (typeof title === 'string' && title.length > titleMax) {
    out.push(`${where}title ${title.length} chars (max ${titleMax} for ${locale})`);
  }
  if (typeof meta === 'string' && (meta.length < metaMin || meta.length > metaMax)) {
    out.push(`${where}meta ${meta.length} chars (need ${metaMin}-${metaMax} for ${locale})`);
  }
  return out;
}
