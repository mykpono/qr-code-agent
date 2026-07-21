# Release log

Newest first. The v1.0 record follows below.

---

# 2026-07-21 — v5 generator, generator modes, i18n foundation

Shipped to production on `main`. English-only in production; German and Spanish exist as
reviewable branches and are **not** merged (see *Held back* below).

## What ships

### The v5 / "1e" generator design
Rebuilt the flagship widget against `design_handoff_qr_generator/`:

- **Tabbed templates rail** — Social (default), Industry, Use case, Themes. Only the active
  category renders, replacing a four-group scroll.
- **Templates are full design presets**, not recolours: picking one applies `ecc`, logo on/off,
  logo shape and border alongside colour/dot/finder, plus the example URL and a group chip.
- Social presets bake the real brand PNG as the centre logo, so it lands in the PNG/SVG export
  rather than only the preview.
- Dynamic header subtitle; ECC as four option cards; logo controls greyed rather than hidden;
  flat-white preview column; 200ms redraw pulse honouring `prefers-reduced-motion`.
- Scannable pill now uses the v5 WCAG contrast rule (≥3.5) **and** keeps the logo-with-low-ECC
  warning.

### Five type pages now serve the right generator
`/whatsapp-qr-code`, `/crypto-qr-code`, `/phone-qr-code`, `/text-qr-code`, `/sms-qr-code` ranked
for a specific data type but rendered the generic URL box. Each page's own `tool.note` already
described the intended behaviour; the modes had never been built. WhatsApp was worse — the mode
was fully implemented and tested, and **no page enabled it**.

Encoding decisions that would have shipped silently broken:
- `tel`/`sms` keep a leading `+`. The obvious `replace(/\D/g,'')` turns `+1 415…` into a
  domestic-looking number that will not dial from abroad.
- `sms` uses `SMSTO:`, the ZXing convention scanners recognise. `sms:` is not portable — iOS wants
  `&body=`, Android `?body=`.
- `crypto` emits BIP-21 and never normalises address case; base58 and bech32 are both
  case-sensitive, so folding case yields a valid-*looking* address that sends funds nowhere.

`/event-qr-code` was **not** changed: its H1, subhead and intro all describe linking to a ticket
page, so it is intent-consistent on `url` mode already. The VEVENT builder written for it was
deleted rather than shipped unused.

### UTM
The URL field now shows the tagged link as parameters are entered. `fields.url` stays the
*untagged* base, so editing a UTM value recomposes rather than appending to an already-tagged
string; edits typed into the field are split back apart by `splitUtm()`.

Two pre-existing bugs fixed, both producing broken tracking links:
- A base with an existing query got a second `?` — `...promo?code=SAVE20?utm_source=nl` is
  malformed and `code` stops parsing. This hit the shipped **Promotion** preset.
- Params were appended *after* any `#fragment`, so no analytics tool ever saw them.

### Chrome and layout
- Theme switcher consolidated into the generator widget and **persisted** (`qra:theme`,
  re-applied before paint). Previously two controls existed whose indicators never synced, and
  neither persisted — the theme reset on every navigation, making the feature decorative.
- Mobile header overflow fixed (three stacked bugs: swatch overflow, a three-line title, and
  chips wrapping out of their fixed-height boxes).
- Preview canvas sized from the *card* via a container query, so collapsing the templates rail
  expands the preview area without resizing the QR.
- Contact email removed from the footer and `pages.json`.
- Nav 13px → 14px; header subtitle → "Free QR Code Generator".

### i18n foundation (infrastructure only — no locale is live)
- `npm run i18n:extract | i18n:merge | i18n:coverage` — extract → translate → merge, with
  validation that refuses to write an incomplete or malformed bundle.
- ~190 UI chrome strings moved out of components into `src/content/ui.json`, read via
  `uiStrings()`. Before this, a locale could translate its page copy and still render inside an
  English app.
- `localizedPage()` and `uiStrings()` now deep-merge: a bundle carries prose only, so a shallow
  spread dropped structural siblings (`directory` lost its `links`, and the template hit `.map()`
  on undefined).
- Footer language row, driven by `LIVE_LOCALES` so it can never link to a page that was not built.
- `llms.txt` lists the canonical English set plus a Languages section.
- **Decision D-007 / CLAUDE.md rule 9**: a locale ships only when every page is translated. This
  is architecturally enforced — a partial bundle does not skip pages, it publishes them in English
  under the locale prefix while hreflang claims otherwise.

## Verified before release

- **91 tests pass** (was 58). New: real jsQR decode of every new payload type at all four ECC
  levels, `buildPayload`/`splitUtm` round-trip, D-007 bundle completeness, and UI-string
  enforcement.
- `npm run verify` clean across **46 pages**; 138 when both locale branches are merged (tested).
- **Live production check, not assumed**: all 46 sitemap URLs fetched individually — every one
  carries the Umami tag. Sitemap is 46/46, matching the built page set.
- Generator driven in-browser on each changed page; URL-mode pages confirmed unchanged; no console
  errors.
- Every commit on `main` builds and tests standalone, so `git bisect` stays usable.

## Held back

- **German and Spanish** (~27,600 words each, plus UI chrome) are complete on `origin/i18n/de`
  and `origin/i18n/es` — each a single-file diff. **Neither is merged**: no native speaker has
  reviewed them, and Google's scaled-content-abuse policy explicitly names automated translation
  published without human review. A penalty would reach the English pages too.
- **Keywords are not localized.** The bundles render the English page's intent; they are not
  targeted at researched German or Spanish keywords. `primary`/`msv`/`kd` remain English-market
  figures. Per-locale keyword research is a separate job — and likely the higher-value one.
- **Register differs by language** — formal *Sie* in German, informal *tú* in Spanish. Both are
  normal for their language here, but it is a deliberate choice a reviewer should confirm.
- Preview deployments of the locale branches serve unreviewed machine translation. Confirm
  `X-Robots-Tag: noindex` on them before sharing the links.

## Known issues, unfixed

- **10px horizontal overflow in the 900–1120px range.** Pre-existing; reproduced against a clean
  checkout. No element overflows, so it is likely the `.tool-scroll` padding in that band.
- The design handoff is internally inconsistent on the preview canvas: it specifies 500px, but at
  its own stated 1120px minimum card width the preview column is only 388px. Sized fluidly instead.
- `docs/FINAL-TAXONOMY.md` is stale — 14 of its 48 planned pages are unbuilt, and two built pages
  (`/qr-codes-for-education`, `/qr-codes-for-marketing`) are absent from it.
- The design system folder `../QR code generator redesign/` that CLAUDE.md names as the source of
  truth for header/footer layouts is **not on disk**; the zip contains only the generator handoff.

---

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
