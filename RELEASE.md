# Release — qrcodeagent.net v1.0 (Phase 1)

Prepared 2026-07-20. Scope: **Phase 1 + Phase 1b**, English only.

---

## What ships

**41 static pages**, one HTML file per route, no SPA rewrite.

| Group | Count | Notes |
|---|---:|---|
| Home | 1 | primary `qr code generator` |
| Feature | 2 | `qr-code-with-logo`, `custom-qr-code-generator` |
| Type | 17 | WiFi, vCard, menu, Instagram, Google review, PDF, WhatsApp, Facebook, YouTube, Spotify, URL, crypto, phone, app-download, event, email, SMS… |
| Use case | 5 | business cards, menus, social, packaging, reviews |
| Industry / ICP | 6 | restaurants, small business, retail, real estate, events, hotels |
| Learn hub | 1 | `/learn` |
| Articles | 7 | `/learn/*` — 1,307–2,266 words each |
| Trust | 2 | `/about`, `/privacy` |

The 14 pages SEO-BRIEF §11 marks *delay/demote* are deliberately **not** built.

**The generator** — real `qrcode-generator` encoder, 36 presets, 4 themes, URL/WiFi/vCard/WhatsApp
modes, UTM builder, PNG + SVG export, centre logo, local saved-designs drawer. Loads on every page
type except `/learn` and the two trust pages.

---

## Verified before release

Everything below was measured against the built output or the running app, not assumed.

### Correctness
- **QR codes decode.** Verified with the browser's `BarcodeDetector` across 4 payload sizes
  (QR versions 2–19), all 5 dot styles, all 5 finder styles, all 4 ECC levels, and with a
  baked-in centre logo at ECC H. 100% decode, exact payload match.
- **Quiet zone = 4 modules** on every side, at every version and output size (ISO/IEC 18004).
  Measured at 55px on a 512px canvas with a 13.84px cell.
- **No empty exports.** vCard/WiFi payload builders emit scaffolding even when blank, so export
  is gated on real user content; the CTA disables and relabels instead.
- **SVG export is true vector.** Verified across all 5 dot styles and all 5 finder styles: zero
  `<image>` elements, and every variant still decodes after rasterising at 1024px. The flagship
  URL code decodes at 256 / 512 / 1024 / 2048px — sizes it was never rendered at — which is what
  the print advice on `/learn/png-or-svg-qr-code` depends on being true.

### SEO
- 41/41 unique `<title>` ≤60 chars and meta descriptions within 70–155.
- 41/41 self-referencing canonical, OG tags, hreflang, valid JSON-LD (all parse).
- Exactly one `<h1>` per page. No duplicate titles or metas.
- **No orphan pages** — every page has an inbound internal link.
- **No dead internal references** — all 47 distinct `href`/`src` targets resolve.
- No keyword cannibalization: no duplicate primaries, and no page's primary appears as another
  page's secondary. §5.6 pairs resolved.
- Sitemap (41 URLs) matches the built page set exactly. `llms.txt` covers 41/41, guarded by a
  build-time check that throws if any page is missing.
- Minimum 389 words per page; articles 1,307–2,266.

### Accessibility (WCAG 2.1 AA)
- **Contrast: 0 failures across 147 text nodes in all 4 themes**, measured with alpha
  compositing. Was 20+ failures, worst 2.12:1.
- **0 of 61 focusable elements without an accessible name.**
- Visible focus ring on every interactive element, inverted on brand-gradient surfaces.
- QR canvas is `role="img"` with a description of what is encoded, plus a polite live region.
  All 46 decorative canvases `aria-hidden`.
- Escape closes the drawer and colour popovers; drawer is `role="dialog"` and returns focus.
- Icon buttons have a 44px hit area; verified no control steals a neighbour's centre.
- `prefers-reduced-motion` respected.

### Automated (`npm run verify` — 56 tests, runs in CI)
- **Decode tests**: 7 payload shapes x 4 ECC levels, decoded with jsQR and compared to the input.
  Covers short/typical/UTM/long URLs, WiFi, vCard and non-ASCII.
- **Quiet zone**: asserts 4 modules and that it is sized in modules, not as a fraction of output.
- **Export gating**: proves `hasContent` is false for a blank vCard/WiFi form even though the
  payload builder returns truthy scaffolding.
- **Vector SVG**: no `<image>` across all 7 dot x 5 finder combinations, correct viewBox, one shape
  per dark module, quiet zone respected, and a logo as the only permitted raster.
- **Content invariants**: title/meta length and uniqueness, no duplicate primaries, no page
  targeting another's primary, no dead internal links, no orphans, article word floor, emoji rule.
- **Built output** (`scripts/check-build.mjs`): 17 checks over `dist/` — dead refs, head hygiene,
  JSON-LD parsing, sitemap and llms.txt matching the page set, no placeholders, no SPA rewrite.

### Runtime
- **Zero console errors** on a clean load, desktop and mobile.
- **No hydration mismatch.** (`railOpen` previously read `window.innerWidth` during the first
  client render, so every viewport ≤900px — most phones — threw a hydration error and
  re-rendered the whole island. Fixed.)
- No horizontal overflow at 375px.
- Fonts fully self-hosted — no third-party font request. Only external hosts referenced anywhere
  in the output are `buy.stripe.com` (support link) and `linkedin.com` (byline).

---

## Deploy steps

1. **Import the repo in Vercel.** Framework preset **Astro**, output directory **`dist`**,
   build command `npm run build`. The old Vercel project was configured for a single static
   file — a fresh project is cleaner than repairing it.
2. **Set environment variables** (Production **and** Preview):
   ```
   PUBLIC_STRIPE_SUPPORT_URL=https://buy.stripe.com/7sYfZid6e4A7bg670KdUY00
   PUBLIC_UMAMI_WEBSITE_ID=<from Umami>
   PUBLIC_GA4_MEASUREMENT_ID=<from GA4>
   ```
3. **Point the domain** `qrcodeagent.net` at the project. Canonicals, hreflang, OG URLs and the
   sitemap are all hardcoded to `https://qrcodeagent.net` via `site.base` in `pages.json`.
4. **Submit `https://qrcodeagent.net/sitemap.xml`** in Google Search Console and Bing Webmaster.
5. **Smoke test production**: generate a code, download PNG and SVG, scan both with a real phone.

### Expected behaviour that is not a bug
- **The consent banner does not appear until `PUBLIC_GA4_MEASUREMENT_ID` is set.** With no GA id
  there is nothing to consent to, so asking would be theatre. Umami is cookieless and ungated.
- **`/learn` has no generator.** It is a content index; the two trust pages likewise.

---

## Known limitations (deliberate, documented)

- **Static codes only.** The destination is encoded in the pattern: codes never expire and need no
  server, but they cannot be edited after download and cannot report scan counts. This is the
  product's positioning, stated plainly on `/learn/static-vs-dynamic-qr-codes` and `/privacy`.
- **English only.** i18n infrastructure is built and proven — `LIVE_LOCALES` is derived from the
  bundles present in `src/content/i18n/`, so hreflang and the sitemap can never advertise a locale
  that 404s. Adding a locale is a content task, not an engineering one.
- **An uploaded centre logo is embedded in the SVG as a raster image.** Unavoidable — the user
  supplies a PNG. The QR pattern itself is true vector.
- **Screen readers not manually tested.** Accessible names, roles, focus behaviour and contrast are
  verified programmatically, but no VoiceOver/NVDA pass was run, so the *usefulness* of the
  announcements is unproven.
- **Printed codes not yet scanned by a phone.** The suite decodes codes in software, which cannot
  model ink spread, laminate glare, room lighting or an old camera. Run `npm run scan-sheet`,
  print `dist/scan-test.html` at 100% scale and scan all ten. This is the last unverified step
  before launch.

---

## Rollback

`git revert` the release commit and redeploy, or use Vercel's instant rollback to the previous
production deployment. The site is fully static with no database and no server state, so rollback
carries no data risk. The pre-Astro prototype remains on the `pre-astro-backup` branch.
