# QR Code Agent — Astro app

Production build of qrcodeagent.net: a free, no-sign-up QR generator + its programmatic
11-language SEO site. Astro (static output) + React islands, deployed on Vercel.

This scaffold implements **Phase 0–2** of `IMPLEMENTATION-PLAN.md`:
- Astro app with 11-locale i18n config, design tokens, and the full `<head>` (title/meta/canonical/hreflang/OG + JSON-LD + Umami/GA4).
- The **real generator** ported into a React island (`src/components/Generator.jsx`) — the actual `qrcode-generator` encoder, styled dots/finders, logo overlay, PNG/SVG export, ECC retry. **Not** the mock `qr-preview.js`. Verified to produce scannable codes.
- The **13 validated Phase-1 English pages** rendered as unique static HTML (one file per route — the old SPA duplicate-HTML blocker is gone).

## Run locally
```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # → dist/ (static) + dist/sitemap.xml
npm run preview
```

## Structure
- `src/content/pages.json` — content source of truth (site config + 13 pages). Add pages here.
- `src/lib/content.js` — loads pages, builds hreflang alternates + JSON-LD graph.
- `src/layouts/Base.astro` — `<head>` (SEO + schema + analytics).
- `src/components/` — `Header`, `Footer`, `Page` (composes blocks in the fixed SEO order), `Generator.jsx` (island).
- `src/pages/[...slug].astro` — static route (one HTML per page).
- `src/styles/` — the design system tokens (`styles.css` + `tokens/*`) + `app.css`.
- `scripts/gen-sitemap.mjs` — emits an EN-only sitemap of built pages (full 528-URL sitemap ships with locales).

## Deploy (GitHub → Vercel)
1. Push this folder to the repo.
2. Import the repo in Vercel — it auto-detects Astro (static). Prod on `main`, preview per PR.
3. Set env vars (see `.env.example`): `PUBLIC_UMAMI_WEBSITE_ID`, `PUBLIC_GA4_MEASUREMENT_ID`, `PUBLIC_STRIPE_SUPPORT_URL`.
4. Point the domain at the deployment; **retire the old `vercel.json` SPA rewrite**.
5. Verify in Google Search Console; submit `sitemap.xml`.

## What's next (see IMPLEMENTATION-PLAN.md)
- Self-host the two fonts (currently Google Fonts `@import` in `tokens/fonts.css`) — CWV win.
- Templates rail (16 presets) + saved-designs drawer UI (Save logic already writes to localStorage).
- Industry + learn archetypes; remaining EN pages.
- Consent banner gating GA4 on EU locales; then localize (DE → ID → PT-BR → …).
- Styled QR + logo reduce scan margin — keep the Q/H default; consider widening the quiet zone before launch.
