# CLAUDE.md — QR Code Agent

Context for Claude Code. Read this first, then `docs/` for depth. This is the production
build of **qrcodeagent.net** — a free, no-sign-up QR code generator plus its programmatic,
11-language SEO site. **Astro (static output) + React islands, deployed on Vercel.**

---

## Golden rules (do not violate)

1. **Use ONLY the design folder's layouts and tokens — never invent UI.** The source of truth
   for every layout, color, radius, shadow, and motif is the design system at
   `../QR code generator redesign/` (a sibling folder on disk). Money-page layouts come from
   `ui_kits/website/*.html`; tokens from `tokens/*.css` (already copied to `src/styles/`).
   If a new page/section is needed, port the closest existing folder layout — do not design
   a new one.
1b. **The GENERATOR WIDGET is governed by the newer handoff**, `../design_handoff_qr_generator/`
   (`README.md` + `QR Generator.dc.html`), which supersedes the widget in
   `../QR code generator redesign/QR Generator.dc.html`. It is the five-band card shipped in
   2026-08: header · type tabs · content fields · setup|preview split · coffee footer, with the
   frame system, the CTA controls and the feedback strip. `QR Generator (standalone).html` in
   that folder runs in any browser — open it side by side when changing the widget.
2. **Never redraw QR motifs or brand logos by hand.** Reuse the `drawQR`/`drawSwatch` logic and
   the PNGs in `public/assets/logos/`. New social presets → add the real PNG, don't recreate marks.
3. **The MAIN preview and export MUST use the real encoder** (`qrcode-generator` in
   `src/components/Generator.jsx`). The folder's `qr-preview.js` is a **mock** (pseudo-random,
   won't scan) — it is only for decorative thumbnails/swatches. Never wire the mock to the
   downloadable output.
4. **All presets are verbatim from the design** — 37 across four groups (Social 4 · Creative
   themes 12 · By industry 11 · By use case 10), plus the leading **None** card that resets to
   plain violet. Do not trim or invent presets. The 2026-08 handoff restates a subset of them;
   where it does, its fg/bg/pattern/corner win (it has nine corner styles to choose from, so
   Coffee is a leaf and Ninja a diamond). **A template is a LOOK, not content:** it sets
   colour, pattern, corner and the frame colour and returns the CTA colour to auto — it never
   writes into the user's fields. Only the four social presets also set an example URL, the
   ECC level and the brand mark, because they are guided links.
5. **The generator widget loads on every page type** — QR types, use cases, ICP/industry, feature,
   home. Only the Learn hub omits it (content index). See `src/components/Page.astro` `flagship`.
6. **SEO is non-negotiable:** one static HTML file per route; unique `<title>` ≤60 and meta ≤155;
   self-referencing canonical; hreflang set; JSON-LD per archetype. Never reintroduce a catch-all
   SPA rewrite (that was the original blocker — see `docs/SEO-BRIEF.md` §1).
7. **Content source of truth = `src/content/pages.json`.** Page copy lives there, not in templates.
7b. **Pure QR logic lives in `src/lib/qr.js`**, not in the component — that is what makes it
   testable. `Generator.jsx` imports it. Never fork this logic back into the component.
8. **Voice & casing** (`docs/HANDOFF.md`, design readme): UPPERCASE monospace for labels/buttons/
   chips; sentence-case headings in Space Grotesk; lead with free / no-sign-up / never-expires;
   `☕` is the only emoji (support/donate CTA) — **and it does not appear inside the generator
   widget**, which the 2026-08 handoff makes emoji-free: every glyph in it is a text character
   (`› ▴ ▾ ✓ ✕ ↓ ♥ ⚠ ⏎ ×`). Keep it that way.
9. **No page ships until it is translated into every live language** (decision D-007). A locale
   bundle `src/content/i18n/<locale>.json` must cover **all** pages before it is added, and a new
   page must be added to **every** live bundle in the same change that ships it. **Never merge a
   partial bundle.** This is enforced by the architecture, not just editorial policy: a locale goes
   live purely by having a bundle, `getStaticPaths` then emits every page under that prefix, and
   `localizedPage()` falls back to the **English** fields for any missing slug. A partial bundle
   therefore publishes English content at `/es/…` while `alternates()` emits hreflang claiming it is
   Spanish — duplicate content plus false hreflang, worse than not shipping the locale.
9b. **Review policy: PARTIAL review, decided 2026-08-03** (D-015, TRAFFIC-IMPLEMENTATION-PLAN
   §5.4 mitigation 2). Before a locale bundle lands, a human reads `title`, `meta`, `h1` and the
   FAQ answers on the **top ~8 money pages** — roughly 1 hr per locale, covering what Google and
   the answer engines read first. Full native review of all 50 pages is *not* required; shipping
   with **no** human pass is no longer acceptable either. The reason is Google's
   scaled-content-abuse policy, which explicitly names automated translation published without
   human review — and a penalty would hit the English pages too, so this is not only the new
   locale's risk. Pair it with the stagger: one locale per two weeks, never a batch.

---

## Stack

- **Astro** static SSG + **@astrojs/react** islands. **qrcode-generator** for encoding.
- Deploy: **GitHub → Vercel** (auto-build on push, PR previews, prod on `main`). Static output; no adapter.
- Analytics: **Umami** (cookieless, primary, ungated, live on all 150 URLs) proxied via the
  `/stats/` rewrite in `vercel.json`, **plus GA4 `G-71ZTRB01CK` (secondary, consent-gated)** since
  2026-08-03. GA loads **only after explicit consent** and sets `anonymize_ip` — never paste
  Google's raw gtag snippet in, it fires on page load with no consent and this site serves DE/ES
  traffic. **The cookie banner is expected and correct**; `Base.astro` gates it on the GA id
  existing. See plan task A3. **Stripe Payment Link** for support.
- Node ≥ 18. Package manager: npm.

## Commands

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # → dist/ (static) + dist/sitemap.xml (EN-only, built pages)
npm run preview
npm test           # unit: real QR decode (jsQR) + content invariants
npm run verify     # test + build + check-build.mjs — run before every push
npm run test:e2e   # Playwright smoke — boots dist/ and proves the generator hydrates
                   #   (run `npm run build` first; `npx playwright install chromium` once)
npm run scan-sheet # → dist/scan-test.html, print at 100% and scan with a phone
npm run indexnow:submit   # push every built URL to IndexNow (Bing/Yandex/Seznam/Naver)
                          #   --dry-run builds the payload; --check verifies the key file.
                          #   public/<key>.txt is PUBLIC by design — it proves domain
                          #   ownership, is not a secret, and must stay committed.
```

## Env vars (Vercel → Project → Environment Variables; all client-safe `PUBLIC_`)

```
PUBLIC_UMAMI_WEBSITE_ID=
PUBLIC_GA4_MEASUREMENT_ID=
PUBLIC_STRIPE_SUPPORT_URL=https://buy.stripe.com/cNi9AU4zI3w31Fw2KudUY01
```
(No secret keys needed until Phase-2 accounts.) The live Payment Link is set. `SUPPORT_URL` in
`lib/content.js` resolves the env var first and falls back to `site.support.href` in `pages.json`,
so the link can be changed in Vercel without a commit.

---

## File map

```
src/
  content/pages.json      SOURCE OF TRUTH — site config + all page content (15 pages today)
  lib/content.js          loads pages; builds hreflang alternates + JSON-LD graph per page
  layouts/Base.astro      <head>: title/meta/canonical/hreflang/OG + JSON-LD + Umami/GA4 (consent-gated)
  components/
    Header.astro          ported from ui_kits/website header (brand, nav, support, lang, theme swatches)
    Footer.astro          ported footer (4-col grid + "Created by Myk Pono" byline)
    Page.astro            per-archetype composition (home/type/feature/usecase/industry/learn)
    Generator.jsx         THE WIDGET — real encoder + flagship 3-region card + 36 presets (React island)
  pages/[...slug].astro   getStaticPaths over pages.json → one static route per page
  styles/
    styles.css tokens/*   design tokens copied from the folder (colors/themes/typography/layout/fonts)
    app.css               marketing CSS ported verbatim from ui_kits/website + flagship .genflag styles
public/
  assets/logos/*.png      real brand logos (Telegram/WhatsApp/Instagram/YouTube)
  robots.txt              points to sitemap
scripts/gen-sitemap.mjs   post-build EN-only sitemap of built pages
docs/                     strategy + reference (see below)
```

## docs/ (reference — read when relevant)

- `IMPLEMENTATION-PLAN.md` — architecture + phased plan (Phase 0–6) + stack integrations (§11).
- `HANDOFF.md` — component inventory, generator spec, archetypes, a11y, localization.
- `SEO-BRIEF.md` — positioning, on-page template order, schema, phased rollout, §1 the routing blocker.
- `FINAL-TAXONOMY.md` — the full 48-page URL set × 11 locales with validated MSV/KD + priority.
- `keyword-validation-*` — the Semrush data behind primaries and demand tiers.
- `sitemap-528-full.xml` — the full 11-locale sitemap (enable once localized content ships).
- `*.jsonld` — standalone schema templates (also embedded per page by `lib/content.js`).

**Design system (on disk, sibling folder):** `../QR code generator redesign/` — `readme.md`,
`ui_kits/website/*.html` (archetype layouts), `QR Generator.dc.html` (flagship generator + presets),
`tokens/`, `components/`, `assets/logos/`. Treat it as read-only reference.

---

## Archetypes (which layout each page uses)

| Archetype | Layout source | Generator widget? |
|---|---|---|
| home / type | `ui_kits/website/index.html` (money page) | yes |
| feature | `ui_kits/website/feature.html` (logo panel emphasized) | yes |
| usecase | `ui_kits/website/usecase.html` (breadcrumb, narrow hero, canonical callout) | yes |
| industry (ICP) | `ui_kits/website/industry.html` (hub: tools cards + scenarios) | yes |
| learn | `ui_kits/website/learn.html` (article grid + tool CTA) | no (content index) |

Section order on money pages is fixed (SEO-BRIEF §6): hero → generator → trust → how-to →
benefits → directory/related → FAQ → footer.

---

## Current status (built & verified)

- 15 static pages: home, `qr-code-with-logo` (feature), 10 type pages, `qr-codes-for-business-cards`
  (usecase), `qr-codes-for-restaurants` + `qr-codes-for-small-business` (ICP).
- Generator widget (real encoder, 36 presets, 4 themes, WiFi/vCard/WhatsApp/URL modes, local Save,
  UTM, PNG/SVG export) loads on all page types except Learn. Verified scannable (square style decodes).
- Per-page head: unique title/meta, canonical, hreflang (EN + x-default today), OG, JSON-LD graph.
- Analytics + Stripe wiring in place (env-driven). EN-only sitemap emitted at build.
- Build is clean, no console errors.

See **`NEXT-PHASES.md`** for what to do next — it is the current handoff and
supersedes `BACKLOG.md` where they disagree. `RELEASE.md` records what shipped
and how it was verified.

**Before finishing any change to `Generator.jsx` or `lib/qr.js`, load a tool page
in a browser and confirm the generator renders with no console errors.** A
refactor that passed the build and all 58 tests once took the generator off every
page of the live site — nothing in CI boots the app. See NEXT-PHASES.md.

**If that change altered how the widget LOOKS, also run `npm run build && npm run og`
and commit `public/assets/og.png`.** That file is the link-preview card every page
and every locale advertises, and it is a Chromium screenshot of the real widget —
Vercel has no browser, so it cannot regenerate itself. Skip this and the site keeps
unfurling a picture of the widget you just replaced, which is exactly what happened
across the #15 and #20 redesigns. No test can catch it; only this line can.
