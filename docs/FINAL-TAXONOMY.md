# QR Code Agent — Taxonomy (built vs planned)

Single reference for the URL set. **Reconciled against the build on 2026-07-21.**

**Validated** MSV/KD are Semrush, US, 2026-07-20. Blanks (`—`) are *not measured* — lower-priority
long-tail that was never individually validated, or pages added after that pull. Do not treat a
blank as zero; it means nobody checked. `priority` = sitemap `<priority>`.

Axes: **type** (QR data type) · **feature** (differentiator) · **industry** (ICP hub) ·
**usecase** (use-case guide) · **article** (Learn editorial) · plus home, learn hub, trust.

## Where things stand

| | Count |
|---|---:|
| **Built and live** | **46** |
| Planned, not built | 14 |
| Total if everything ships | 60 |

Production is English-only. German and Spanish bundles are complete on `origin/i18n/de` and
`origin/i18n/es`, pending native review (decision D-007) — merging either takes the build to 92
pages, both to 138.

---

## Built — 46 pages ✅

### Home, feature, type (20)

| URL | Archetype | Validated primary | MSV | KD | Priority |
|---|---|---|---:|---:|:-:|
| `/` | home | qr code generator | 1000000 | 96 | 1.0 |
| `/qr-code-with-logo` | feature | qr code generator with logo | 2400 | 70 | 0.9 |
| `/custom-qr-code-generator` | feature | custom qr code generator | 5400 | 94 | 0.7 |
| `/wifi-qr-code` | type | wifi qr code | 2900 | 42 | 0.9 |
| `/instagram-qr-code` | type | instagram qr code | 2900 | 31 | 0.9 |
| `/google-review-qr-code` | type | google review qr code | 1900 | 40 | 0.9 |
| `/facebook-qr-code` | type | facebook qr code | 1900 | 42 | 0.8 |
| `/youtube-qr-code` | type | youtube qr code | 1600 | 35 | 0.8 |
| `/spotify-qr-code` | type | spotify qr code | 1600 | 48 | 0.8 |
| `/vcard-qr-code` | type | vcard qr code | 1300 | 33 | 0.9 |
| `/whatsapp-qr-code` | type | whatsapp qr code | 1300 | 42 | 0.8 |
| `/menu-qr-code` | type | qr code menu | 1000 | 25 | 0.9 |
| `/crypto-qr-code` | type | bitcoin qr code | 1000 | 56 | 0.7 |
| `/pdf-qr-code` | type | pdf qr code | 390 | 23 | 0.8 |
| `/url-qr-code` | type | url qr code generator | 390 | 90 | 0.7 |
| `/phone-qr-code` | type | phone number qr code | 320 | 18 | 0.5 |
| `/text-qr-code` | type | text qr code | 320 | 72 | 0.4 |
| `/sms-qr-code` | type | sms qr code | 260 | 24 | 0.4 |
| `/app-download-qr-code` | type | app store qr code | 170 | 34 | 0.5 |
| `/event-qr-code` | type | event qr code | 140 | 15 | 0.5 |

### Industry / ICP (8)

| URL | Validated primary | MSV | KD | Priority |
|---|---|---:|---:|:-:|
| `/qr-codes-for-restaurants` | restaurant qr code | 390 | — | 0.7 |
| `/qr-codes-for-small-business` | qr code for business | 390 | — | 0.7 |
| `/qr-codes-for-retail` | qr code for retail | 70 | 16 | 0.5 |
| `/qr-codes-for-events` | qr code for events | 70 | 24 | 0.5 |
| `/qr-codes-for-real-estate` | qr code for real estate | 50 | 16 | 0.5 |
| `/qr-codes-for-hotels` | qr code for hotels | 10 | 0 | 0.4 |
| `/qr-codes-for-marketing` | — | — | — | 0.4 |
| `/qr-codes-for-education` | — | — | — | 0.4 |

`/qr-codes-for-marketing` and `/qr-codes-for-education` were built after the Semrush pull and were
absent from this document until this revision. **Neither has validated demand data** — worth
running through Semrush before investing further in them.

### Use case (5)

| URL | Validated primary | MSV | KD | Priority |
|---|---|---:|---:|:-:|
| `/qr-codes-for-business-cards` | qr code business card | 5400 | 37 | 0.9 |
| `/qr-codes-for-menus` | qr code menu | 1000 | 25 | 0.6 |
| `/qr-codes-for-social-media` | qr code for social media | 170 | 27 | 0.6 |
| `/qr-codes-for-packaging` | qr code on packaging | 140 | 22 | 0.5 |
| `/qr-codes-for-feedback` | qr code for feedback | 40 | 36 | 0.4 |

### Learn hub, articles, trust (13)

The ten articles were never listed in this document. They are the site's deepest content
(1,300–2,300 words each, vs ~600 on a money page) and carry its editorial E-E-A-T.

| URL | Archetype | Category | Length |
|---|---|---|---|
| `/learn` | learn | — | hub |
| `/learn/restaurant-qr-code-guide` | article | By industry | 12 min |
| `/learn/qr-code-not-working` | article | Basics | 8 min |
| `/learn/static-vs-dynamic-qr-codes` | article | Basics | 7 min |
| `/learn/qr-code-vs-nfc` | article | Basics | 7 min |
| `/learn/are-qr-codes-safe` | article | Basics | 7 min |
| `/learn/qr-code-print-size` | article | Printing | 6 min |
| `/learn/wifi-qr-codes-cafes-hotels` | article | By industry | 6 min |
| `/learn/add-logo-without-breaking-qr-code` | article | Design | 5 min |
| `/learn/qr-code-colors-that-scan` | article | Design | 5 min |
| `/learn/png-or-svg-qr-code` | article | Basics | 4 min |
| `/about` | trust | — | 0.3 |
| `/privacy` | trust | — | 0.3 |

---

## Planned, not built — 14 pages

Ranked by **Opportunity Score = MSV ÷ KD**. Rows without validated data cannot be scored and are
listed after; that is a gap in the research, not evidence of low value.

| URL | Archetype | Validated primary | MSV | KD | Score | Note |
|---|---|---|---:|---:|---:|---|
| `/email-qr-code` | type | email qr code | 170 | 23 | **7.4** | needs a `mailto:` generator mode |
| `/google-maps-qr-code` | type | google maps qr code | 110 | 19 | **5.8** | URL mode is sufficient |
| `/svg-qr-code-generator` | feature | svg qr code generator | 260 | 71 | 3.7 | SVG export already ships |
| `/qr-codes-for-reviews` | usecase | qr code for reviews | 110 | 50 | 2.2 | overlaps `/google-review-qr-code` — check cannibalization first |
| `/colored-qr-code-generator` | feature | colored qr code | 170 | 82 | 2.1 | high KD |
| `/qr-codes-for-flyers-posters` | usecase | qr code for flyers | 20 | 0 | — | KD 0 |
| `/qr-codes-for-table-tents` | usecase | qr code table tent | 10 | 0 | — | KD 0 |
| `/qr-codes-for-bars` | industry | qr code for bars | 0 | 0 | — | no measured volume |
| `/qr-codes-for-promotions` | usecase | qr code for promotions | 0 | — | — | no measured volume |
| `/qr-codes-for-coffee-shops` | industry | — | — | — | — | not validated |
| `/qr-codes-for-gyms` | industry | — | — | — | — | not validated |
| `/qr-codes-for-salons-spas` | industry | — | — | — | — | not validated |
| `/qr-codes-for-nonprofits` | industry | — | — | — | — | not validated |
| `/qr-codes-for-food-trucks` | industry | — | — | — | — | not validated |

The six unvalidated industry hubs all have matching **generator presets already shipped** (Bar,
Coffee shop, Gym, Salon & spa, Nonprofit, Food truck in the Industry template rail), so the
product side exists; only the page does not.

`/email-qr-code` is the highest-scoring gap and the only one needing engineering: a `mailto:`
payload builder. The `tel`/`sms`/`text`/`crypto` modes shipped 2026-07-21 and are the pattern to
follow.

---

## Localization

**46 built pages × 11 locales = 506 URLs** at full rollout (the older "48 × 11 = 528" figure
counted pages that were never built and omitted the ten articles).

A locale is all-or-nothing: `getStaticPaths` emits every page under a live locale's prefix and
falls back to English for any slug the bundle omits, so a partial bundle publishes English content
under a locale prefix while hreflang claims otherwise. See D-007 / CLAUDE.md rule 9 and
`docs/I18N-RUNBOOK.md`.

Rollout order (`LOCALE_ORDER` in `src/lib/content.js`, by validated head-term opportunity):
`en, de, id, pt-br, ja, pl, it, fr, uk, es, ru`.

**Keywords are not localized.** The de/es bundles render the English page's intent; `primary`,
`secondaries`, `msv` and `kd` above are English-market figures and are deliberately not
translated. Per-locale keyword research is a separate and probably higher-value job than adding
more locales.

---

## Maintaining this file

It drifted for a while: 14 planned pages unbuilt, two built pages missing, and all ten articles
absent. To regenerate the built half from the source of truth:

```bash
node -e "const p=require('./src/content/pages.json');
p.pages.forEach(x=>console.log(('/'+(x.slug||'')).padEnd(42), x.archetype.padEnd(9), x.msv??'—', x.kd??'—'))"
```

`src/content/pages.json` is authoritative for what exists. This document is authoritative for what
was *planned* and why — keep the unbuilt table and the validated MSV/KD, since that research is
not recoverable from the codebase.
