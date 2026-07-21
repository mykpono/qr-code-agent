# QR Code Agent — SEO Taxonomy, Schema & Keyword Brief

**Domain:** `qrcodeagent.net`
**Product:** Free, no-sign-up QR code generator with logo overlay, custom colors, styled dots (star / diamond / circle / square), configurable finder patterns, error-correction control, and PNG/SVG export. Runs entirely client-side (static HTML).
**Prepared:** 2026-07-20
**Goal:** Rank on page one of Google for high-intent "QR code generator" queries across three demand axes (QR *types*, *industries/ICPs*, *use cases*) in 11 languages, using a programmatic hub-and-spoke architecture.

---

## 0. How to read this brief

This document is the plan; the accompanying files are the ready-to-use assets:

- `sitemap.xml` — 48 pages × 11 languages = 528 URLs, each with full hreflang alternates. Validated well-formed and reciprocal.
- `robots.txt` — allows all, points to the sitemap.
- `schema/*.jsonld` — 7 ready-to-adapt JSON-LD blocks (Organization, WebSite, SoftwareApplication, BreadcrumbList, FAQPage, HowTo, BlogPosting).

Where numbers matter (search volume, difficulty), I have **not invented figures**. The keyword tables use qualitative demand tiers (High / Med / Low) as directional priorities only. Section 4 explains exactly how to run the real keyword analysis to replace them with verified MSV/KD data before you commit engineering effort.

> **Honesty note on this brief:** demand tiers, difficulty estimates, and the localized seed keywords in Section 8 are my best directional judgment based on the visible competitive landscape and general market knowledge — they are *not* pulled from a keyword tool and should be validated (see Section 4) before you treat any single page as a guaranteed win.

> **✅ Validation status (updated 2026-07-20):** Section 4's keyword analysis has now been **run in Semrush** (US database unless a locale is noted). Sections 5, 8.2, and 11 below have been rewritten with **verified MSV and KD** — the directional tiers are replaced. The taxonomy/IA held; what changed is **priority, primaries, and rollout order**. Volumes are Semrush estimates, not traffic guarantees, and per-locale KD (only US KD was batch-pulled) plus SERP-overlap clustering remain optional follow-ups (see Section 5.6).

---

## 1. Critical technical finding (read before building pages)

Your current `vercel.json` rewrites **every** path to a single file:

```json
{ "routes": [ { "src": "/(.*)", "dest": "/index.html" } ] }
```

That is correct for a one-page app, but it is **incompatible with programmatic SEO**. Every URL in this taxonomy would return the *same* HTML shell — same `<title>` ("Styled QR Code Generator"), same `<h1>`, same body copy, hardcoded `lang="en"`. Google would see hundreds of duplicate pages and rank essentially none of them.

For this plan to work, **each URL must be served as its own pre-rendered HTML document** with a unique title, meta description, H1, on-page copy, canonical, hreflang, and JSON-LD. Practical options, in order of effort:

1. **Static site generator (recommended):** move the tool into a template and generate one static HTML file per route with Astro / Eleventy / Next.js SSG. The QR generator itself stays client-side JS; only the surrounding page content is templated per route. Keeps the "no backend, deploy to Vercel" model.
2. **Build-time page generation from a data file:** keep vanilla HTML but generate the pages from a script driven by the taxonomy in this brief (the same slug list used to build `sitemap.xml`).
3. **Minimum viable:** hand-author the ~15 highest-priority pages as standalone HTML first, prove rankings, then automate the long tail.

Until routing serves distinct HTML per URL, do not submit the full sitemap — you would be asking Google to index duplicates.

Secondary technical fixes from the current `index.html`:
- `<html lang="en">` is hardcoded — must be set per locale (`es`, `pt-BR`, `de`, …).
- `<title>` and meta description are generic — must be page- and locale-specific.
- No canonical tag, no hreflang tags, no Open Graph / structured data present today.

---

## 2. Positioning & differentiators (what the copy should lean on)

These are the product's *real, in-app* advantages. Every page's value proposition should be built from this list rather than generic claims:

- **Free, no sign-up, no expiry.** The strongest converting angle in this category — many "free" competitors gate download or expire "dynamic" codes behind a paywall. Say it explicitly and often.
- **Logo in the center** with circle/square shape and optional border.
- **Styled dots** (star, diamond, circle, square) and **styled finder patterns** (circle, rounded, square) — visually distinctive vs. plain black-square generators.
- **Full color control** (foreground + background).
- **Error-correction control (L/M/Q/H)** with guidance that Q/H is needed when a logo is present.
- **PNG and SVG export** — SVG (vector) is a genuine differentiator for print/large-format use and a keyword cluster of its own.

**Honest caveat that shapes the taxonomy:** the app today encodes whatever text/URL you type — the QR is **static** (data lives in the image; it never expires, but it also can't be edited after printing or tracked). It does *not* currently offer dynamic/editable/trackable codes or type-specific input forms (WiFi SSID fields, vCard fields, etc.). This affects Section 3 — see "build vs. content-only" flags.

**Save, accounts & monetization (decided — see `HANDOFF.md` §4.1–4.2):** a **local "Save design"** (browser storage, no login) is being added; it must stay additive so the generator is never gated — this protects the validated *no sign-up* demand (`free qr code generator no sign up` 4,400 MSV). **Google accounts** (Supabase Auth) are a documented **Phase-2**, not a launch dependency. Monetization is a **"Buy me a coffee" Stripe Payment Link** (no backend), placed as a secondary CTA — it does not affect the SEO IA. If a `/support` page is added, treat it as a low-priority, `noindex`-optional trust page.

---

## 2.1 Competitor landscape (watchlist — analysis pending)

Sites ranking on **page 1 of Google (US) for `free qr code generator`**. Captured 2026-07-21 as a
watchlist; the analysis columns are **not yet filled in** — this is the input for a later
competitor pass (the `ultimate-seo-geo` skill has a `competitor-analyzer` that can read this).

**Analyze, don't imitate.** These are here to find gaps we can exploit (what they gate, where their
UX is worse, keywords they under-serve), not patterns to copy. Our positioning above is the anchor.

| # | Competitor | URL | Type | Analyzed? | Notes to verify |
|---|---|---|---|:-:|---|
| 1 | QRCode Monkey | `qrcode-monkey.com` | pure-play | ☐ | Long-standing free/no-signup incumbent — the closest positioning rival |
| 2 | Canva | `canva.com/qr-code-generator/` | platform feature | ☐ | Huge domain authority; QR is one feature of a design suite |
| 3 | Adobe Express | `adobe.com/express/feature/image/qr-code-generator/` | platform feature | ☐ | Same pattern as Canva — DA-driven, not a specialist |
| 4 | qr-code-generator.com | `qr-code-generator.com` | pure-play (freemium) | ☐ | Exact-match domain; likely gates dynamic/tracking behind paywall |
| 5 | High QR Code Generator | `high-qr-code-generator.com/paypal-qrcode/` | pure-play | ☐ | Ranking via a **type page** (`/paypal-qrcode/`) — validates our type-cluster strategy |

**First read of the set (hypotheses to confirm in the analysis pass):**
- Two of five are **platform features** (Canva, Adobe) winning on domain authority, not QR specialism
  — a specialist with better free UX and no gating can out-convert them even from a lower rank.
- The pure-plays (#1, #4) are the real positioning rivals; #4's exact-match domain and #1's
  incumbency are the moats to probe.
- #5 ranking on a **`/paypal-qrcode/` type page** is direct evidence the type-cluster approach in
  §3 works — a possible `/paypal-qr-code` gap for us to check for validated demand.

**When the analysis runs, capture per competitor:** what's gated vs free (download, resolution,
dynamic, tracking), sign-up requirement, styling depth (logo/dots/colors/SVG), the keywords they
rank for that we don't, and any schema/EEAT signals. Fill the "Analyzed?" box and move findings into
§11 prioritization.

---

## 3. Site architecture & URL taxonomy

A flat, keyword-bearing URL scheme (best for a new site's topical clarity) organized as a **hub-and-spoke** across four page collections plus a learn hub. Logical hierarchy is expressed via `BreadcrumbList` schema and internal links, not deep folders.

### 3.1 Collections

| Collection | URL pattern | Search intent | Notes |
|---|---|---|---|
| **Home / core tool** | `/` | "qr code generator", "free qr code", "qr code with logo" | Highest-volume head term; the tool itself. |
| **Feature pages** | `/{feature}` | differentiator queries | e.g. `qr-code-with-logo`, `svg-qr-code-generator`. Map directly to real features. |
| **Type pages** | `/{type}-qr-code` | "wifi qr code", "vcard qr code generator" | The largest, most durable cluster. Some need a build (input forms); some are content-only today. |
| **Industry / ICP pages** | `/qr-codes-for-{industry}` | "qr code for restaurants" | Your requested ICPs: restaurants, bars, coffee shops, small business, retail… |
| **Use-case pages** | `/qr-codes-for-{use-case}` | "qr code for menu", "qr code for promotions" | menu, promos, business cards, reviews, feedback… |
| **Learn hub** | `/learn/` + `/learn/{slug}` | informational ("how to", "best size to print") | Top-of-funnel, earns links, feeds internal links to money pages. |
| **Trust** | `/about`, `/privacy` | — | E-E-A-T signals; privacy matters because generation is client-side (a selling point). |

### 3.2 Full page list

**Feature pages (4)**
`qr-code-with-logo` · `custom-qr-code-generator` · `svg-qr-code-generator` · `colored-qr-code-generator`

**Type pages (19)** — pattern `/{type}-qr-code`
url · wifi · vcard · menu · pdf · email · sms · text · phone · whatsapp · instagram · facebook · youtube · spotify · google-review · app-download · event · crypto · google-maps

**Industry / ICP pages (12)** — pattern `/qr-codes-for-{x}`
restaurants · bars · coffee-shops · small-business · retail · hotels · real-estate · gyms · salons-spas · nonprofits · food-trucks · events

**Use-case pages (9)** — pattern `/qr-codes-for-{x}`
menus · promotions · business-cards · reviews · feedback · flyers-posters · packaging · table-tents · social-media

**Learn hub + trust:** `learn` (index), `about`, `privacy` — plus long-form articles added over time.

> **Namespace note:** industry and use-case pages share the `/qr-codes-for-` prefix. That is intentional and fine — both answer "QR codes for [X]". Keep the two lists deduplicated (e.g. "events" is treated as an industry page; "menus" as a use case even though "menu" is also a type — the *type* page targets the tool query, the *use-case* page targets the contextual/how-to query and links to the type page).

### 3.3 Build-vs-content flags for type pages

Because the tool is currently a single text/URL field, type pages fall into two groups:

- **Ships today, content-only (page ranks, tool already works):** url, menu (link to hosted menu/PDF), pdf (link to hosted PDF), google-review, google-maps, app-download, youtube, spotify, instagram, facebook, whatsapp, event (link), crypto (address string), email/sms/phone/text (as `mailto:` / `sms:` / `tel:` / plain strings the user pastes).
- **Needs a small build to be truly competitive (type-specific input form):** wifi (SSID/encryption/password → `WIFI:` payload), vcard (structured contact → `MECARD:`/`vCard` payload), email/sms/phone (helper fields instead of asking users to hand-write the URI). These pages will still rank on content alone, but conversion and "it just works" quality jump a lot with the payload builder. Prioritize the WiFi and vCard builders — both are high-demand, high-intent clusters.

---

## 4. How to run the keyword analysis (do this before scaling)

The taxonomy above is demand-informed and has now been **validated in Semrush** (results folded into Sections 5, 8.2 and 11). This section documents the method used so it can be re-run as the market shifts or the product adds features:

1. **Seed list:** use the slug list in Section 3 as seeds (e.g. "wifi qr code", "qr code for restaurants", "qr code with logo"). Add modifiers: `free`, `generator`, `online`, `no sign up`, `with logo`, `svg`, `bulk`.
2. **Pull metrics** in a keyword tool (Google Keyword Planner is free; Ahrefs / Semrush / Mangools give better KD). Capture, per keyword: monthly search volume (MSV), keyword difficulty (KD), and SERP features (does a free-tool box, PAA, or featured snippet own the top?).
3. **Cluster by SERP overlap**, not just by string. If two keywords return largely the same top-10 URLs, they are one page. (The `searchfit-seo:keyword-clustering` skill available in this workspace can do this once you have a keyword export — paste the list and it groups them into page-level clusters.)
4. **Map one primary keyword + a handful of secondaries to each URL** and fill the real MSV/KD into the Section 5 table.
5. **Prioritize** = high MSV × achievable KD × strong intent match to a *free* tool. New domains should attack lower-KD type/industry/use-case terms first and let the home page chase the head term over time.
6. **Repeat per language** with localized seeds (Section 8) — never machine-translate keywords; search behavior differs by market.

---

## 5. Page-level keyword & on-page brief (English) — VALIDATED

Verified **MSV** and **KD** from Semrush (US database, 2026-07-20). Priority proxy = `MSV × (100 − KD) / 100` on the best primary for that URL — higher = better near-term opportunity for a new domain. Title tags ≤ 60 chars, meta descriptions ≤ 155 chars; every title leads with the keyword and the free / no-sign-up angle.

### 5.1 Core & feature pages

| URL | Validated primary | MSV | KD | Tier | Notes |
|---|---|---:|---:|---|---|
| `/` | qr code generator | 1,000,000 | 96 | Long-term | Home also targets *free qr code generator* (135k/KD94), *create qr code* (40.5k/90), *make qr code* (12.1k/91). Won't win the head term early — see secondaries below. |
| `/` (secondaries) | free qr code generator **no sign up** / **no expiration** | 4,400 / 2,900 | — | **High-intent** | On-brand for static, client-side codes. Put these in title/meta/H2 — verified demand that matches the product exactly. |
| `/qr-code-with-logo` | qr code generator with logo | 2,400 | 70 | **High** | Phase 1. Realistic KD vs. head term. |
| `/custom-qr-code-generator` | custom qr code generator | 5,400 | 94 | High vol / **High KD** | Phase 1b — volume justifies the page, but KD ≈ head-term; don't expect early rank. |
| `/svg-qr-code-generator` | svg qr code generator | 260 | 71 | **Low (demote)** | Was Med in v1 — over-tiered. Keep as a supporting/feature page, not Phase-1 money. |
| `/colored-qr-code-generator` | colored qr code | 170 | 82 | **Low (demote)** | Generator-form variant only ~90 MSV. Support page only. |

### 5.2 Type pages (money cluster)

| URL | Validated primary | MSV | KD | Tier | Build? | Change vs v1 |
|---|---|---:|---:|---|---|---|
| `/wifi-qr-code` | wifi qr code | 2,900 | 42 | **High** | **Build** (SSID form) | Confirmed. Secondary *wifi qr code generator* 1,900/KD34. Highest-confidence type page. |
| `/instagram-qr-code` | instagram qr code | 2,900 | 31 | **High** | Content | **Upgraded** from Med — low KD, high volume. |
| `/google-review-qr-code` | google review qr code | 1,900 | 40 | **High** | Content | Confirmed. Related *qr code for google reviews* 880. |
| `/facebook-qr-code` | facebook qr code | 1,900 | 42 | **High–Med** | Content | **Upgraded** from Med. |
| `/youtube-qr-code` | youtube qr code | 1,600 | 35 | **High–Med** | Content | **Upgraded** from Med. |
| `/spotify-qr-code` | spotify qr code | 1,600 | 48 | **Med–High** | Content | **Upgraded** from Low — real volume. |
| `/vcard-qr-code` | vcard qr code | 1,300 | 33 | **High** | **Build** (contact form) | Confirmed. Secondary *…generator* 880/KD30. Pair with business-card use case. |
| `/whatsapp-qr-code` | whatsapp qr code | 1,300 | 42 | **Med–High** | Content | *whatsapp qr code generator* 210/KD**13** — easy-win secondary. |
| `/crypto-qr-code` | bitcoin qr code | 1,000 | 56 | **Med** | Content | **Upgraded** from Low. *crypto qr code* KD20 (low-vol companion). |
| `/menu-qr-code` | **qr code menu** | 1,000 | 25 | **High** | Content | **RETARGET** — old primary *menu qr code generator* was only 40 MSV. See cannibalization fix (5.6). |
| `/pdf-qr-code` | pdf qr code | 390 | 23 | **Med** | Content | Good KD — Phase 1b. |
| `/url-qr-code` | url qr code generator | 390 | 90 | Med-vol / **High KD** | Content | Intent real but SERP owned by generic generators. Keep as a thin **spoke**, not a hero. |
| `/phone-qr-code` | phone number qr code | 320 | 18 | Low–Med | Build (helper) | Easy KD, small volume. |
| `/sms-qr-code` | sms qr code | 260 | 24 | Low | Build (helper) | OK helper. |
| `/text-qr-code` | text qr code | 320 | 72 | **Low** | Content | High KD for tiny volume — deprioritize. |
| `/email-qr-code` | email qr code | 170 | 23 | **Low (demote)** | Build (helper) | Was Med. |
| `/app-download-qr-code` | app store qr code | 170 | 34 | Low–Med | Content | Later. |
| `/event-qr-code` | event qr code | 140 | 15 | Low–Med | Content | Low vol, easy KD, high CPC ($5.25, B2B). |
| `/google-maps-qr-code` | **google maps qr code** | 110 | 19 | **Low (demote)** | Content | *location qr code* only 40 — retarget primary to *google maps qr code*. |

### 5.3 Industry / ICP pages

Exact `qr code for {industry}` phrases are **mostly thin**. Treat these as **ICP landing / internal-link hubs** that convert visitors who already know the use case — not as primary MSV drivers. Pull traffic in via type/use-case pages, then route it here.

| URL | Retargeted primary | MSV | KD | Tier | Recommendation |
|---|---|---:|---:|---|---|
| `/qr-codes-for-restaurants` | **restaurant qr code** | 390 | — | **Med** | **Retarget** (exact "for restaurants" = 40–110). Hub → menu/wifi/review. |
| `/qr-codes-for-small-business` | **qr code for business** | 390 | — | **Med** | **Retarget** — "small business" exact = 20. Broader business framing. |
| `/qr-codes-for-retail` | qr code for retail | 70 | 16 | Low | Keep as long-tail hub. |
| `/qr-codes-for-events` | qr code for events | 70 | 24 | Low | Prefer the `/event-qr-code` type page. |
| `/qr-codes-for-real-estate` | qr code for real estate | 50 | 16 | Low | Long-tail. |
| `/qr-codes-for-hotels` | qr code for hotels | 10 | 0 | **Very low** | Deprioritize. |
| `/qr-codes-for-bars` | qr code for bars | 0 | — | **No exact demand** | Ship only by reusing restaurant/menu content; not a keyword play. |
| `/qr-codes-for-coffee-shops` | — | n/a | — | Unproven | Same as bars. |
| `/qr-codes-for-food-trucks` · `-gyms` · `-salons-spas` · `-nonprofits` | — | ~0 | — | Low | Skip in early phases. |

### 5.4 Use-case pages

| URL | Validated primary | MSV | KD | Tier | Notes |
|---|---|---:|---:|---|---|
| `/qr-codes-for-business-cards` | **qr code business card** | **5,400** | 37 | **High — Phase 1 HERO** | Big cluster (*business card with qr code* 2,900, etc.). Promote alongside WiFi/vCard. |
| `/qr-codes-for-menus` | qr code menu | 1,000 | 25 | **High** | Competes with `/menu-qr-code` for the same term — resolve (5.6). |
| `/qr-codes-for-social-media` | qr code for social media | 170 | 27 | Low–Med | **Hub only** → IG/FB/YT/Spotify type pages carry the volume. |
| `/qr-codes-for-packaging` | qr code on packaging | 140 | 22 | Low | OK long-tail. |
| `/qr-codes-for-reviews` | qr code for reviews | 110 | 50 | **Low–Med (demote)** | Demand lives on `/google-review-qr-code` (1,900). Make thin hub or merge. |
| `/qr-codes-for-feedback` | qr code for feedback | 40 | 36 | Low | Later. |
| `/qr-codes-for-flyers-posters` | qr code for flyers | 20 | 0 | **Low (demote)** | — |
| `/qr-codes-for-table-tents` | qr code table tent | 10 | 0 | **Very low** | Optional / content-only. |
| `/qr-codes-for-promotions` | qr code for promotions | ~0 | — | **Unproven (delay)** | No solid exact MSV; keep only if the content angle is strong. |

### 5.5 Concrete primary-keyword swaps

| Page | Old primary | New primary | Title angle |
|---|---|---|---|
| `/menu-qr-code` | menu qr code generator | **qr code menu** / menu qr code | "Free QR Code Menu Generator…" |
| `/qr-codes-for-restaurants` | qr code for restaurants | **restaurant qr code** | "Restaurant QR Codes — Menu, WiFi, Reviews" |
| `/qr-codes-for-small-business` | qr code for small business | **qr code for business** | "QR Codes for Business — Free Generator" |
| `/google-maps-qr-code` | location qr code | **google maps qr code** | Keep "maps" in the title |
| `/qr-codes-for-reviews` | qr code for reviews | support only | Merge intent into Google Review type + industry pages |

### 5.6 Cannibalization fixes (resolve before building)

| Risk | Pages | Fix |
|---|---|---|
| **Menu intent** | `/menu-qr-code` vs `/qr-codes-for-menus` vs `/qr-codes-for-restaurants` | **One owner of `qr code menu`.** Recommended: `/menu-qr-code` = the *tool* owner (primary `qr code menu`); `/qr-codes-for-menus` = restaurant-focused how-to guide that links to the tool (do **not** target the identical head term); restaurants = ICP angle + secondary. |
| **Review intent** | `/google-review-qr-code` vs `/qr-codes-for-reviews` | Type page owns the keyword; use-case page becomes a short hub or is delayed. |
| **Business card / vCard** | `/vcard-qr-code` vs `/qr-codes-for-business-cards` | Distinct intents (format tool vs. use-case guide) — keep both, different titles, cross-link heavily. |
| **URL vs home** | `/url-qr-code` vs `/` | Home already fits generic generate/link intent; keep the URL page thin + tool-focused. |
| **Social hub vs types** | `/qr-codes-for-social-media` vs IG/FB/YT/Spotify | Hub is fine; never target a type head term on the hub. |

## 6. On-page template (every money page must contain)

A consistent template makes the pages programmable and gives Google the same strong signals every time:

1. **H1** matching intent + the free-tool value prop in the first sentence.
2. **The working generator, above the fold** (the actual tool — not a screenshot). For a *free QR generator*, the tool being immediately usable is the #1 ranking and conversion factor; Google rewards pages that satisfy the "generate a QR now" intent instantly.
3. **Short intro** (40–80 words) with the primary + 1–2 secondary keywords, naturally.
4. **"How to make a [X] QR code" — 3 steps** (drives the `HowTo` schema and the "how to" long tail).
5. **Why-use / benefits** block tuned to the page (industry pain points, use-case scenarios).
6. **FAQ (3–6 Q&As)** feeding `FAQPage` schema — always answer "is it free?", "do they expire?", "can I add a logo?", plus page-specific questions.
7. **Internal links:** every page links up to its hub and across to 3–6 related pages (Section 7).
8. **Unique meta:** title, description, canonical (self), hreflang set, Open Graph.
9. **Trust footer:** "generated in your browser, nothing uploaded" (real privacy advantage), link to `/about` and `/privacy`.

Thin, near-duplicate pages are the main failure mode of programmatic SEO. Each page needs genuinely page-specific copy in blocks 5–6, or Google will treat the set as doorway pages. Budget real writing (or high-quality generation + human edit) per page.

---

## 7. Internal linking model (hub-and-spoke)

- **Home** links to the top feature pages, the 6–8 highest-priority type pages, and the industry hub.
- **Industry pages are hubs**: each links *down* to the specific type/use-case pages relevant to it (restaurants → menu, wifi, review, feedback). This is the highest-value internal linking in the plan — it routes authority to money pages and matches how buyers actually think ("I run a restaurant, what can I do?").
- **Type pages** link *across* to the industries where that type is common (wifi → restaurants, hotels, coffee-shops) and *up* to any relevant use case.
- **Use-case pages** link to the matching type page (the tool) and to industries.
- **Learn articles** link down into the money pages with descriptive anchors; money pages link to 1–2 supporting articles.
- Keep a consistent footer with the full type/industry lists so every page is ≤ 2 clicks from home (also helps crawl depth).

---

## 8. Localization & hreflang plan (11 languages)

**Languages:** English (root), Spanish, Brazilian Portuguese, German, French, Italian, Japanese, Indonesian, Ukrainian, Polish, Russian.

### 8.1 URL & hreflang strategy

- **Subdirectories on the one domain:** English at root (`/…`), others under a locale prefix (`/es/`, `/pt-br/`, `/de/`, `/fr/`, `/it/`, `/ja/`, `/id/`, `/uk/`, `/pl/`, `/ru/`). Best choice for a new site — consolidates all authority on `qrcodeagent.net` (vs. splitting across ccTLDs or subdomains).
- **hreflang on every page**, listing all 11 locales **plus `x-default` → English root.** Already built into `sitemap.xml`; also add the same `<link rel="alternate" hreflang="…">` tags in each page's `<head>` (Google accepts either, but in-head tags are more robust).
- **Reciprocity is mandatory:** every locale of a page must reference every other locale (the generated sitemap does this correctly).
- **Set `<html lang="…">` per locale** (currently hardcoded to `en` — must be fixed).
- Localized slugs are optional. This plan keeps English slugs under locale prefixes (e.g. `/de/wifi-qr-code`) for simplicity and easier maintenance; fully translated slugs (`/de/wlan-qr-code`) can add marginal relevance but multiply maintenance. Recommend English slugs for v1.

### 8.2 Localized head terms — VALIDATED (Semrush, per-locale MSV)

Head-term MSV confirmed per locale. Where the English "QR code" form outranks the native word, titles should **lead with the English head term** and keep the native phrase as secondary (notably ID, JA, DE). Per-locale KD was not batch-pulled — treat these as demand signals and confirm KD before committing a market.

| Locale | Best validated head term(s) | MSV | Verdict / title guidance |
|---|---|---:|---|
| **PT-BR** | gerador de qr code | **49,500** | Top locale. English-style "QR code" beats "código QR"; *…gratis* 1,000. |
| **DE** | qr code generator | **165,000** | English form dominates; *…kostenlos* 9,900 (own the free modifier); *qr-code erstellen* 1,600 (verb intent). |
| **JA** | QRコード生成 | **27,100** | Native 生成 preferred; EN *qr code generator* also strong (18,100). Keep 無料 (free) in copy. Re-check *作成* (0 this pull — likely tool/encoding quirk). |
| **ID** | qr code generator (EN) | **135,000** | **English dominates.** Localize UI, but title/H1 must include the EN head term; *buat kode qr* 2,400 / *pembuat kode qr* 720 as native secondaries. |
| **PL** | generator kodów qr | **9,900** | **Plural genitive wins** (singular *generator kodu qr* 720). |
| **IT** | crea qr code | **8,100** | **Retarget:** verb *crea* ≫ noun *generatore di qr code* (1,300). Lead with *crea*. |
| **FR** | generateur de qr code | **3,600** | Include noun + verb (*creer un qr code* 2,900, *…gratuit* 1,600). |
| **UK** | створити qr код | **3,600** | Verb form slightly ahead of *генератор qr кодів* (2,900). |
| **ES** | generador de codigos qr | **1,600** | Prefer **unaccented plural** in titles (*…codigo qr* 1,300; accented *código* 480). `es` DB used — pull MX separately if targeting LatAm. |
| **RU** | генератор qr-кода / создать qr-код | — | Not in this pull — validate MSV/KD before committing; keep copy geo-neutral, separate from UK. |

Notes that affect copy, not just translation:
- **Do not machine-translate keywords** — the EN "qr code" form carries real volume in several non-English markets (ID, JA, DE, PT-BR); target it *alongside* the native term where data confirms it.
- Localize the **examples and industries**, not only UI strings (an Italian restaurant page should reference Italian dining norms; PT-BR should reflect Brazil, e.g. PIX payment context).
- **Ukrainian ≠ Russian** — separate locales/pages; never reuse one for the other.### 8.3 What to localize per page

For each of the 11 locales, translate/localize: `<title>`, meta description, H1, the 3-step "how to", benefits, FAQ, and image alt text. The **tool UI strings** (buttons: Generate, Download PNG/SVG, Error Correction labels) should also be localized. Keep one source-of-truth strings file keyed by locale so the pages stay in sync.

---

## 9. Structured data (schema) plan

JSON-LD only (Google's preferred format). Files are in `schema/`. Map to templates as follows:

| Page type | Schema types to include |
|---|---|
| **Site-wide (every page `<head>`)** | `Organization` (`01`), `WebSite` (`02`) |
| **Home + every generator/type/feature page** | `SoftwareApplication`/`WebApplication` (`03`) with `offers.price = "0"`, plus `BreadcrumbList` (`04`) |
| **Type / industry / use-case pages** | `BreadcrumbList` (`04`) + `FAQPage` (`05`) + `HowTo` (`06`) |
| **Learn articles** | `BlogPosting` (`07`) + `BreadcrumbList` |

Implementation notes:
- Templates use `@id` references (e.g. `#organization`) so the graph links together — keep those IDs stable.
- **`aggregateRating` in `03` is set to `ratingCount: 0` on purpose.** Do **not** publish fake ratings — Google penalizes invented review markup, and it violates the "no invented numbers" principle. Only populate ratings once you have a real, on-page review mechanism; otherwise **delete the `aggregateRating` block**.
- `FAQPage` rich results are now shown by Google mainly for authoritative/government/health sites, but the markup is still valid and useful for AI/answer engines — keep it, just don't count on the star-style SERP treatment.
- `HowTo` visual rich results were deprecated in Google Search, but the markup still communicates structure to crawlers and LLM answer engines; low cost to include.
- Localize the *text* inside `FAQPage`/`HowTo` per locale, and set each app/article block's `inLanguage`.
- Validate every page with Google's Rich Results Test and the Schema.org validator before rollout.

---

## 10. Technical SEO checklist

- [ ] **Serve unique static HTML per URL** (Section 1) — the single most important item.
- [ ] Per-page unique `<title>` (≤ 60 chars) and meta description (≤ 155 chars).
- [ ] Self-referencing `<link rel="canonical">` on every page.
- [ ] hreflang tags in `<head>` for all 11 locales + `x-default`, reciprocal.
- [ ] `<html lang>` correct per locale.
- [ ] Open Graph + Twitter card tags (title, description, image) — helps social/link CTR.
- [ ] `sitemap.xml` submitted in Google Search Console (and Bing Webmaster Tools); `robots.txt` references it.
- [ ] Fast LCP: the tool is light, but preconnect the two external scripts (`qrcode-generator` CDN, Google Fonts) or self-host fonts to cut render-blocking. Consider self-hosting the QR library too.
- [ ] Mobile: the workspace grid is `420px 1fr` — confirm it collapses cleanly on phones (most QR-tool traffic is mobile).
- [ ] Image alt text with the page keyword on the sample/preview images.
- [ ] Accessible color contrast on the light "cream" theme (matters for Core Web Vitals-adjacent UX and a11y).
- [ ] 404 handling that doesn't soft-404 to the SPA shell once per-page HTML exists.
- [ ] HTTPS + `www`→apex (or apex→`www`) canonical redirect decided and enforced.

---

## 11. Phased rollout & prioritization — RECALIBRATED (data-weighted)

Rebuilt from the validated MSV/KD. The IA is unchanged; the *order* is now driven by real opportunity (volume × achievable KD × product fit).

**Phase 0 — Foundation (blocking).** Fix routing to serve per-page HTML; add canonical/hreflang/meta framework; wire site-wide schema; submit sitemap + Search Console. Nothing below ranks until this is done (Section 1).

**Phase 1 — Ship first (highest ROI).** ~13 English pages:

1. `/` — lead with **free + no sign-up + no expiry + logo** (verified-demand modifiers)
2. `/qr-code-with-logo`
3. `/wifi-qr-code` **(build the SSID form)**
4. `/vcard-qr-code` **(build the contact form)**
5. `/qr-codes-for-business-cards` — **hero** (5,400 MSV, KD37)
6. `/google-review-qr-code`
7. `/instagram-qr-code`
8. `/menu-qr-code` — owner of *qr code menu* (resolve cannibalization, 5.6)
9. `/facebook-qr-code`
10. `/youtube-qr-code`
11. `/whatsapp-qr-code`
12. `/spotify-qr-code`
13. `/pdf-qr-code`

**Phase 1b — still worth it.** `/custom-qr-code-generator` (volume yes, KD brutal) · `/crypto-qr-code` (bitcoin) · `/url-qr-code` (thin spoke) · `/qr-codes-for-restaurants` (retargeted → *restaurant qr code*) · `/qr-codes-for-small-business` (retargeted → *qr code for business*).

**Phase 2 — long tail + content.** Remaining viable type/use-case pages; launch `/learn/` with cornerstone articles (restaurant guide, best print size, static vs dynamic, adding a logo without breaking scanning).

**Phase 3 — Localization, in validated order** (by head-term opportunity):
**DE → ID → PT-BR → JA → PL → IT → FR → UK → ES**, with **RU** slotted once its MSV/KD is pulled. Roll the Phase-1 page set into the top 2–3 markets first, then expand.

**Phase 4 — Authority & links.** Learn content + digital PR on the "free, private, in-browser" angle; tool-directory placements. Long-tail modifiers first; head terms follow domain authority.

**Delay / demote** (verified weak or product-gap): SVG & colored feature pages (footnotes, not money); email / google-maps / table-tents / flyers / promotions; bars / coffee-shops / gyms / salons / nonprofits / food-trucks as *keyword* plays; `/qr-codes-for-reviews` as a standalone money URL.

**Explicit non-goal until the product changes:** the **dynamic / trackable** cluster (*dynamic qr code generator* = 2,400 MSV) — real demand, but don't target it until the tool supports editable/trackable codes.

## 12. Measurement

Track in Google Search Console + GA4 (or a privacy-friendly analytics tool, on-brand with the "nothing leaves your browser" positioning):

- Impressions & average position per cluster (types / industries / use cases) and per locale.
- Clicks and CTR on money pages; watch title/meta CTR and A/B the "Free / No sign-up" framing.
- Primary conversion = QR generated + downloaded (fire a client-side event on Download PNG/SVG).
- Indexation coverage (are the per-page HTML docs actually indexed, not deduped?).
- Core Web Vitals per template.

---

## 13. Assumptions & open items

- **Domain `qrcodeagent.net`** and the **11-language set** (global top-8 + Ukrainian, Polish, and Russian) were confirmed by you. If the domain or `www`/apex choice changes, regenerate `sitemap.xml` (the generator script `gen_sitemap.py` accompanies these files — edit `BASE` and re-run).
- Demand tiers and localized head terms are **now Semrush-validated** (US DB; per-locale MSV where noted) and folded into Sections 5, 8.2 and 11. Remaining optional pulls: per-locale **KD**, SERP-overlap clustering for the menu/restaurant group, RU MSV/KD, and a MX database check for LatAm Spanish (Section 5.6 / report §10).
- The **static-only** nature of the current tool shapes which pages ship as content vs. need a small build (Section 3.3). If you later add dynamic/trackable codes, add a `/features/dynamic-qr-codes` page and a comparison page — that's a separate, high-value cluster ("dynamic qr code", "trackable qr code") not covered here because the product doesn't do it yet.
- `aggregateRating` markup intentionally left empty — populate only with real reviews.

---

*Files delivered alongside this brief: `sitemap.xml`, `robots.txt`, `schema/01–07*.jsonld`, `gen_sitemap.py`.*
