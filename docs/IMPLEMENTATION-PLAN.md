# QR Code Agent — Implementation Plan

**Target:** turn three separate work streams into one shippable, SEO-ready, 11-language site.
**Architecture (decided):** **Astro (static output) + React islands, deployed on Vercel.**
**Date:** 2026-07-20 · **Domain:** qrcodeagent.net

---

## 1. What we're merging

Three inputs exist on disk today. This plan unifies them.

| Input | Location | What it gives us | What it lacks |
|---|---|---|---|
| **Shipped app** | `qr-project/index.html` (+ `vercel.json`) | The **real, working generator** — `qrcode-generator` encoder, styled `drawQR`/`drawSwatch`, logo overlay, PNG/SVG export, ECC retry-at-H. The git repo (`github.com/mykpono/qr-code-agent`). | Single page; SPA catch-all routing (all URLs serve one file); no per-page SEO; old visual style. |
| **SEO kit** | `qrcodeagent-handoff-kit/` | Taxonomy (48 pages), `sitemap.xml` (528 URLs, 11 locales), JSON-LD schema, `pages.json` (content source of truth for 13 Phase-1 pages), validated keywords. | No visual system; wireframes are neutral scaffolding. |
| **Design system** | `QR code generator redesign/` | Tokens (`styles.css` + `tokens/*`), 4 themes, **React components** (`components/**/*.jsx` + `.d.ts`), static HTML archetype kits (`ui_kits/website/*`), brand logos, `QR Generator.dc.html` (flagship spec). | Not wired to content or routing; `qr-preview.js` is a **mock** renderer (see §2). |

**The job:** a component-based Astro site where the **design system** renders the **SEO content model**, with the **real generator** embedded as an interactive island, output as 528 static pages.

---

## 2. Critical correctness flags (read first)

1. **`ui_kits/website/qr-preview.js` is a MOCK.** It fills the QR with a pseudo-random pattern (`rng()`, fixed 29×29) — it is **not a real QR encoder** and its output will not scan. It exists to make design mockups look right. The production island **must** use the real encoder from `qr-project/index.html` (the `qrcode-generator` CDN library + the real `drawQR`). Borrow the *visual* dot/finder drawing style from either file, but never ship the mock as the generator.
2. **Routing is the launch blocker.** `vercel.json`'s `"/(.*)" → "/index.html"` rewrite means every URL currently returns identical HTML. Astro's static output replaces this entirely (one real HTML file per route). Do **not** carry the old rewrite over.
3. **Fonts are render-blocking.** Both the app and `tokens/fonts.css` pull Space Grotesk + IBM Plex Mono from Google Fonts via `@import`. Self-host them (see §8) before launch — it's a Core Web Vitals win called out in `SEO-BRIEF.md` §10.
4. **Recommendation caveats:** Astro i18n routing, Supabase Auth, and Stripe Payment Links should each be confirmed against their current official docs at implementation time — APIs move. Effort sizing below is directional, not a commitment.

---

## 3. Target architecture

### 3.1 Stack

- **Astro** — static site generation; one HTML file per route (fixes the SEO blocker); first-class **i18n routing** for the 11 locales.
- **React islands** — the design's `.jsx` components render server-side; only the **generator** (and the theme/lang/save controls) hydrate on the client (`client:load` / `client:idle`). Marketing content ships as zero-JS HTML.
- **Design tokens** — `styles.css` imported once globally; `[data-theme]` on `<html>` drives Cream/Sand/Olive/Slate.
- **Content** — `pages.json` becomes typed **content collections**; per-locale strings layered on top.
- **Deploy** — Vercel, static output (`@astrojs/vercel` static adapter or plain static). No server needed for Phase 1.

### 3.2 Repo structure (proposed)

```
qrcodeagent/                      # new Astro app (can live in the existing repo)
├─ astro.config.mjs               # i18n: defaultLocale 'en', 11 locales, prefixDefaultLocale:false
├─ src/
│  ├─ styles/                     # ← copy design tokens here
│  │  ├─ styles.css               #   (import-only entry, from the design system)
│  │  └─ tokens/                  #   colors, themes, typography, layout, fonts(self-hosted)
│  ├─ components/                 # ← the design system's React components, as-is
│  │  ├─ primitives/  navigation/  marketing/  status/
│  │  └─ Generator/               #   NEW island: real encoder ported from qr-project
│  ├─ layouts/
│  │  └─ Base.astro               # <head>: title/meta/canonical/hreflang/OG + JSON-LD + styles
│  ├─ lib/
│  │  ├─ pages.ts                 # loads content collection + resolves per-locale strings
│  │  ├─ schema.ts                # builds JSON-LD graph per archetype (from schema/*.jsonld)
│  │  └─ hreflang.ts              # emits the 11 alternates + x-default per route
│  ├─ content/
│  │  ├─ pages/                   # one entry per page (from pages.json), archetype-tagged
│  │  └─ i18n/                    # locale string bundles (en, es, pt-br, de, …)
│  └─ pages/
│     ├─ [...slug].astro          # EN routes (root)  → renders archetype by page.archetype
│     └─ [locale]/[...slug].astro # localized routes  → same, with locale strings
├─ public/
│  ├─ robots.txt                  # from the SEO kit
│  ├─ sitemap.xml                 # generated at build (see §8) — do not hand-maintain
│  ├─ assets/logos/               # brand PNGs from the design system
│  └─ fonts/                      # self-hosted Space Grotesk + IBM Plex Mono
└─ package.json
```

### 3.3 Archetype → template mapping

Each archetype from `FINAL-TAXONOMY.md` becomes one Astro template that composes the design components in the SEO-fixed order (`SEO-BRIEF.md` §6):

| Archetype | Astro template | Design source | Generator? |
|---|---|---|---|
| home | `Home.astro` | `QR Code Agent Home.dc.html` | full (island) |
| feature | `Feature.astro` | `ui_kits/website/feature.html` | full, logo panel emphasized |
| type | `Type.astro` | `ui_kits/website/index.html` | mode-specific (url/wifi/vcard) |
| industry | `Industry.astro` | `ui_kits/website/industry.html` | none (links down to tools) |
| usecase | `Usecase.astro` | `ui_kits/website/usecase.html` | reused tool + canonical link |
| learn-index | `Learn.astro` | `ui_kits/website/learn.html` | none |

Composition order (fixed): `Header → Hero(+Generator) → TrustBar → HowToSteps → BenefitCard[] → DirectoryGrid/related → FaqAccordion → Footer`, with `SaveControl` and `SupportCTA` placed per `HANDOFF.md` §4.1–4.2.

---

## 4. The generator island (highest-risk work — plan carefully)

This is the one piece that must be *ported*, not redesigned. Deliverable: `src/components/Generator/`.

1. **Extract the real logic** from `qr-project/index.html`: the `qrcode-generator` encoding, matrix build, `drawQR` (real dot/finder rendering), logo compositing, PNG export (canvas → dataURL), SVG export (the "PNG-embedded-in-SVG wrapper" per the project's decision notes), and the **retry-at-level-H on failure** behavior.
2. **Wrap as a React island** `<Generator mode="url|wifi|vcard|whatsapp" client:load />`. Marketing pages stay static; only this hydrates.
3. **Re-skin with tokens** so it matches the design system (three-region layout: config `346px` · preview `1fr` · templates rail `306px`; radii/shadows/themes from `tokens/`). Use the design's `Button`, `Chip`, `Segmented`, `StatusChip` primitives.
4. **Payload builders** for the type-specific modes: `WIFI:` (SSID/enc/pass/hidden), vCard/MECARD (contact fields), `wa.me` (WhatsApp number + prefilled message). URL mode is the default single field.
5. **Status + validity:** wire the real "Scannable" check to the `StatusChip variant="success|warn"` and the ECC nudge when a logo is added (Q/H). This must reflect the *actual* encoder state, not a static badge.
6. **Templates rail (16 presets):** apply colors + dot/finder + sample logo on select; use the real brand PNGs in `assets/logos/`.
7. **Save + Support:** `SaveControl` persists the current design to `localStorage`/IndexedDB (no login); `SupportCTA` renders the Stripe link in its three placements. Post-download is the moment to surface the ☕ line.

**Acceptance:** codes generated by the island **scan on iOS + Android**, PNG and SVG both download, logo + Q/H keeps them scannable, and all four themes render correctly. (This is the gate for everything else — validate it before mass-producing pages.)

---

## 5. Content & i18n model

- **Source of truth:** `pages.json` (site config + 13 Phase-1 pages) → migrate into Astro content collections; extend to the full 48 archetypes over time. Every string a page needs already lives here.
- **Locales (11):** EN at root, others under `/es/`, `/pt-br/`, `/de/`, `/fr/`, `/it/`, `/ja/`, `/id/`, `/uk/`, `/pl/`, `/ru/`. Astro i18n config: `defaultLocale: 'en'`, `routing.prefixDefaultLocale: false`.
- **Translation workflow:** English copy is done; the 10 other locales need translation using `pages.json` as the string source. Titles must **lead with the English head term** in DE/ID/JA per `SEO-BRIEF.md` §8.2 — this is content work, not code. Localize examples/imagery, not just strings.
- **Rollout order** (validated): DE → ID → PT-BR → JA → PL → IT → FR → UK → ES, RU after its keyword pull. Ship EN fully first; add locales in that order.

---

## 6. Phased delivery

Each phase has a clear gate. Don't start a phase until the previous gate passes.

**Phase 0 — Scaffold & foundations (blocking).**
Stand up the Astro app; **connect the GitHub repo to Vercel** (auto-build on push, PR previews); copy in `styles.css` + `tokens/` (self-host fonts); import the design's React components; build `Base.astro` with the full `<head>` (title/meta/canonical/hreflang/OG) + JSON-LD wiring from `schema/` + the **Umami/GA4** snippets behind a consent gate; configure i18n and Vercel env vars. *Gate: an empty EN page renders with correct head, tokens, one theme switch, and analytics firing a test event; the push auto-deploys to a Vercel preview.*

**Phase 1 — The generator island.**
Port the real generator per §4; re-skin; add the 4 modes, save, support, templates rail. *Gate: generated codes scan on real phones; PNG+SVG export; all 4 themes OK.* (§4 acceptance.)

**Phase 2 — EN money pages (the validated Phase-1 set).**
Build the 4 archetypes (home, feature, type, usecase) and render the 13 validated pages from `pages.json` (WiFi, vCard, business-cards, Google-review, Instagram, menu, facebook, youtube, whatsapp, spotify, pdf, qr-code-with-logo, home). Generate `sitemap.xml` at build. *Gate: 13 pages live, each with unique title/meta/canonical/hreflang + valid schema; Lighthouse SEO ~100; deployed to a Vercel preview.*

**Phase 3 — Complete EN + industry/learn.**
Remaining viable type/use-case pages, the 2 industry hubs, `/learn` + cornerstone articles, `/about`, `/privacy`, and the local **Saved-designs** drawer. *Gate: full EN sitemap crawlable; internal-link hub-and-spoke wired.*

**Phase 4 — Localize (11 locales, in order).**
Add locale routing + translated content bundles, top markets first (DE → ID → PT-BR …). *Gate: hreflang reciprocal across all live locales; per-locale titles use validated head terms.*

**Phase 5 — Launch SEO.**
Swap DNS/routing to the Astro build (retire the SPA rewrite); **verify the domain in GSC and submit `sitemap.xml`** (+ Bing); confirm the Stripe Payment Link is live in `SupportCTA`; verify indexation (real per-page HTML, no duplicates) via GSC Coverage and hreflang via International Targeting; watch Core Web Vitals and the `download_*` conversion events in Umami/GA4. *Gate: pages indexing individually; no soft-404s; conversions tracking.*

**Phase 6 (post-launch, optional) — Accounts.**
Supabase Auth + Google provider for cross-device saved codes; design the login/account UI (deferred in `HANDOFF.md` §4.1). Adds a backend + DB. Only if cross-device sync proves worth it.

---

## 7. Cutover strategy (protect existing rankings/links)

- Build the Astro site alongside the current app on a **Vercel preview** first; don't touch production until Phase 2's gate passes.
- Keep the **same URLs** the app already uses where they exist; the new IA is additive, so there are few redirects — but map any changed path with a 301.
- Decide apex vs `www` and enforce one canonical (see `SEO-BRIEF.md` §10).
- Cut over by pointing the domain at the Astro deployment; retire the SPA rewrite.

---

## 8. SEO / technical parity checklist

Carry every item from `SEO-BRIEF.md` §10 into the build:

- [ ] One static HTML file per route (Astro handles this) — **the** blocker, resolved by architecture.
- [ ] Per-page unique `<title>` ≤60 / meta ≤155 (already in `pages.json`).
- [ ] Self-referencing canonical on every page.
- [ ] hreflang (11 + x-default), reciprocal, in `<head>` **and** sitemap.
- [ ] `<html lang>` + `data-theme` set per render.
- [ ] Open Graph + Twitter tags.
- [ ] **Generate `sitemap.xml` at build** from the content collection (replace the hand-run `gen_sitemap.py`; `@astrojs/sitemap` can do this, but confirm it emits the hreflang alternates — else keep a small build step from the existing generator).
- [ ] `robots.txt` from the kit → `public/`.
- [ ] **Self-host fonts** (Space Grotesk, IBM Plex Mono) → `public/fonts/`, swap the `@import` in `tokens/fonts.css` for `@font-face`.
- [ ] Preconnect/self-host the QR library; keep the generator's JS out of the marketing critical path (island only).
- [ ] JSON-LD per archetype (WebSite+Organization+SoftwareApplication on home/tool; +Breadcrumb+HowTo+FAQ on type/usecase) — validate with Rich Results Test.
- [ ] Mobile: the three-region generator collapses to one column (`ui_kits/website/mobile.html` is the reference).
- [ ] a11y: WCAG AA contrast (esp. dark themes), 44px targets, focus states, keyboard-operable generator (`HANDOFF.md` §8 — not yet audited; run the `design:accessibility-review`).
- [ ] Analytics (Umami + GA4) firing the conversion events in §11; GA4 gated behind consent on EU locales.

---

## 9. Testing & QA

- **Generator:** scan tests on iOS + Android for each mode; PNG/SVG integrity; logo + ECC retry; all 4 themes.
- **SEO:** build-time check that every page has unique title/meta/canonical and 12 hreflang links (reuse the validators from the handoff kit); Lighthouse SEO + performance budgets per template.
- **Schema:** Rich Results Test on one page per archetype.
- **i18n:** hreflang reciprocity check across locales (the kit already has this script); spot-check that DE/ID/JA titles use the English head term.
- **Visual:** the four themes on each archetype; mobile stacking.

---

## 10. Risks & mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Shipping the **mock** `qr-preview.js` as the generator | Codes don't scan — catastrophic | §2/§4: port the real encoder from `qr-project/index.html`; scan-test as the Phase-1 gate. |
| Framework introduces a build step vs. the old "no-build" ethos | Team friction | Astro is low-ceremony; the payoff (528 SSG pages + i18n + component reuse) is unattainable with a single static file. |
| Thin/duplicate localized pages | SEO penalty (doorway pages) | Localize real copy + examples, not machine strings; keep the per-page benefit/FAQ blocks distinct (`SEO-BRIEF.md` §6). |
| hreflang errors at 11×48 scale | Lost international ranking | Generate alternates programmatically; run the reciprocity validator in CI. |
| Fonts/QR lib render-blocking | Poor CWV | Self-host fonts; island-scope the generator JS. |
| Scope creep into Phase-2 accounts | Delays launch | Accounts are explicitly post-launch; local save covers Phase 1. |

---

## 11. Stack & integrations

The confirmed toolchain and where each piece wires in.

| Tool | Role | Wired in | Setup notes |
|---|---|---|---|
| **GitHub** | Source + CI trigger | Phase 0 | Astro app lives in the repo (recommend inside existing `qr-project`, keeps history). Every push builds; each PR gets a preview. |
| **Vercel** | Build + hosting + CDN | Phase 0 | Connect the GitHub repo → Vercel auto-detects Astro, builds static output, prod on `main`, preview per PR. Set env vars (below). **Retire the old `vercel.json` SPA rewrite.** |
| **Google Search Console** | Search monitoring | Phase 5 | Verify the domain (DNS TXT via your Cloudflare/Vercel DNS, or the GA linking method); submit `sitemap.xml`; watch **Coverage** (confirm per-page indexation, not dedup) and the **International Targeting** report for hreflang errors. Also add Bing Webmaster Tools. |
| **Umami** | Privacy-first analytics (primary) | Phase 0/2 | Cookieless and GDPR-friendly — aligns with the "nothing leaves your browser" positioning, so it can run without a consent banner in most readings. Self-host (Vercel + a Postgres) or use Umami Cloud. Add the script in `Base.astro`; fire custom events. |
| **Google Analytics (GA4)** | Broad analytics (secondary) | Phase 0/2 | Cookie-based → **needs consent** in your EU locales (DE/FR/IT/ES/PL + UK/UA). Load GA4 only after consent (see below). Redundant with Umami by design; keep it for the wider reporting/integrations you're used to. |
| **Stripe** | Support / donate | Phase 1 | **Payment Link** (customer-chosen amount) — no backend. Create it in the dashboard, live link set in `pages.json → site.support.href`, overridable via `PUBLIC_STRIPE_SUPPORT_URL`. `SupportCTA` renders it in its three placements. |

### Analytics event plan (fire to **both** Umami + GA4)

Wrap both in a single `track(event, props)` helper (which respects GA consent). Instrument:

- `qr_generated` (mode) — engagement
- `download_png` / `download_svg` — **primary conversion**
- `save_design` — repeat-visit intent
- `support_click` (placement) — measures the donate CTA's ROI by position
- `template_selected` (name), `theme_switch`, `language_switch` — UX signal

This lets you tie downloads back to page + locale, complementing GSC's impressions/clicks.

### Consent & privacy (flag)

The whole positioning is "generated in your browser — nothing is uploaded." Running **GA4 (cookies)** is in tension with that and with EU consent law across your DE/FR/IT/ES/PL/UK/UA locales. Recommended posture: **Umami as the default** (cookieless, no banner needed in most reads), **GA4 loaded only after consent** via a lightweight banner shown on EU locales (Google Consent Mode v2). Keep `/privacy` describing exactly what each tool collects. *I'm not a lawyer and this isn't legal advice — confirm current GDPR/ePrivacy + Consent Mode guidance before launch.*

### Config / secrets

Vercel env vars (all client-safe, so use Astro's `PUBLIC_` prefix): `PUBLIC_UMAMI_WEBSITE_ID`, `PUBLIC_GA4_MEASUREMENT_ID`, `PUBLIC_STRIPE_SUPPORT_URL`. **No secret keys are needed for Phase 1** — Payment Links and analytics IDs are public. Secret Stripe/Supabase keys only enter the picture at the optional Phase 6 accounts work.

---

## 12. Immediate next steps

1. **Confirm the repo strategy:** new Astro app inside the existing `qr-project` repo (recommended, keeps history) vs. a fresh repo.
2. **Phase 0 scaffold** — I can generate the Astro project skeleton (config, `Base.astro`, token import, i18n, one archetype wired to `pages.json`) as the starting commit.
3. **Phase 1 generator port** — extract the real logic from `qr-project/index.html` into the `Generator/` island and re-skin. This is the critical path; everything else is templating.

Suggested order: **scaffold (0) → generator island (1) → prove 13 EN pages (2)** before investing in localization.

---

*Source files referenced: `qr-project/index.html`, `qr-project/vercel.json`, `qrcodeagent-handoff-kit/{FINAL-TAXONOMY,HANDOFF,SEO-BRIEF}.md`, `.../build/pages.json`, `.../schema/*`, `QR code generator redesign/{readme.md,styles.css,tokens/*,components/**,ui_kits/website/*}`.*
