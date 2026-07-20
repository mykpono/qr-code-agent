# BACKLOG — QR Code Agent

Prioritized remaining work for Claude Code. Each item has an acceptance check. Follow the
Golden Rules in `CLAUDE.md` (use folder layouts, real encoder, no invented QR designs).

## P0 — before first deploy

*Updated 2026-07-20. Remaining P0 items both need input from you.*
- [x] **Self-host fonts.** DONE — 20 woff2 files in `public/fonts/`, `unicode-range` preserved (incl. Cyrillic for uk/ru). No external font request remains. Replace the Google Fonts `@import` in `src/styles/tokens/fonts.css`
      with `@font-face` + files in `public/fonts/` (Space Grotesk, IBM Plex Mono). *Check: no
      render-blocking font request; Lighthouse Best-Practices/Perf unaffected.*
- [~] **Set real env vars.** Stripe Payment Link is set and wired to all four placements.
      Still to set in Vercel: `PUBLIC_UMAMI_WEBSITE_ID`, `PUBLIC_GA4_MEASUREMENT_ID`,
      `PUBLIC_STRIPE_SUPPORT_URL`. *Check: Support CTAs open real checkout.*
- [ ] **Wire GitHub → Vercel** (import repo, static build). Retire any old `vercel.json` SPA
      rewrite from `../qr-project`. *Check: push to a branch → preview URL builds.*
- [x] **Consent banner** DONE — `components/Consent.astro`. Verified: 0 GA scripts and 0 cookies pre-consent; decline persists across pages; allow loads GA. gating GA4 on EU locales; Umami runs cookieless without it. GA loader is
      already stubbed in `Base.astro` (`window.loadGA()` on consent). *Check: no GA cookies pre-consent.*

## P1 — complete the English site
- [x] **Remaining type/use-case/ICP pages** DONE for the brief-approved set (34 pages total). The 14 pages SEO-BRIEF §11 marks delay/demote were deliberately skipped. from `docs/FINAL-TAXONOMY.md` (data-weighted order in
      `docs/SEO-BRIEF.md` §11). Add each as an entry in `src/content/pages.json` with the right
      `archetype`; no new templates needed. *Check: page builds with unique title/meta + JSON-LD.*
- [x] **Learn hub** DONE — `learn` branch in `Page.astro` ported from `learn.html`. Article cards are unlinked (as in the folder) until the articles exist. (`/learn`) from `ui_kits/website/learn.html` — featured + article grid + tool
      CTA. Add a `learn` render branch in `Page.astro` and a content shape in `pages.json`.
- [x] **Saved-designs drawer** DONE — Save sits in the preview header exactly as `saved-designs.html` places it, so the download row stays two buttons. Save/rename/load/delete all verified. from `ui_kits/website/saved-designs.html`. The Save button already
      writes to `localStorage` (`qra:saved`); build the drawer to list/rename/delete (no login).
- [x] **Trust/about/privacy** pages DONE — new `trust` archetype (no generator). Privacy documents Umami, consent-gated GA4, Stripe, and both localStorage keys. (`/about`, `/privacy`) — describe exactly what Umami/GA/Stripe
      collect (privacy page matters for the "nothing uploaded" positioning).

## P2 — localization (11 locales)
- [x] Add locale routing DONE — `LIVE_LOCALES` is derived from bundles in `src/content/i18n/`; `<html lang>` per locale; internal links auto-prefix. (`astro.config.mjs` i18n is already configured; `LIVE_LOCALES` in
      `lib/content.js` currently `['en']`). Roll out in the validated order **DE → ID → PT-BR → JA
      → PL → IT → FR → UK → ES**, RU after its keyword pull.
- [ ] Translate `pages.json` copy per locale (titles lead with the English head term in DE/ID/JA —
      see `docs/SEO-BRIEF.md` §8.2). *Do not machine-translate keywords.*
- [x] Sitemap/hreflang DONE — the build emits live locales only, so the static 528-URL file is no longer needed. hreflang sitemap once locales are live;
      make hreflang tags list only live locales until then.
- [x] Localize the header language switcher DONE — `<details>` menu listing live locales (the folder draws the chip but never the menu). (currently static `◉ EN ▾`).

## P3 — polish & Phase-2
- [ ] **a11y pass** (WCAG AA): contrast on dark themes (Olive/Slate), 44px targets, focus states,
      keyboard-operable generator, canvas text alternative. Run the `design:accessibility-review`.
- [x] **Widen the QR quiet zone.** DONE — was `pad = out*0.04`, a fraction of output size, so
      the quiet zone shrank in module terms as codes got denser (~1.3 modules on a typical URL,
      spec requires 4). Now sized in modules: `cell = out/(n+8)`, `pad = 4*cell`. Verified with
      BarcodeDetector across 4 payload sizes, all 5 dot styles, all 5 finder styles, all 4 ECC
      levels, and with a baked-in logo — 100% decode, margin measured at exactly 4 modules.
- [ ] **Generate vs Download** — both currently trigger export since the preview is live. Split if
      a distinct "Generate" action is wanted.
- [ ] **Phase-2 accounts** (post-launch, optional): Supabase Auth + Google provider for cross-device
      saved codes. Design the login/account UI (deferred in `docs/HANDOFF.md` §4.1). Adds backend + DB.

## Known deviations from the folder (intentional, keep)
- Main preview/export uses the **real encoder**, not the folder's mock `qr-preview.js`.
- Page copy comes from `pages.json`, not the design's placeholder text.
- The generator loads on ICP/use-case pages (per product decision) even though those folder
  layouts link to the tool rather than embedding it.
