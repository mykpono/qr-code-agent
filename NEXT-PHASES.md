# Next phases — qrcodeagent.net

Handoff for the next session. Written 2026-07-20, after Phase 1 shipped.

Read `CLAUDE.md` first (golden rules), then this. `BACKLOG.md` is the older
per-item list; where the two disagree, **this file is current**.

---

## Where things stand

**The site is live at https://qrcodeagent.net and deploys automatically.**

| | |
|---|---|
| Repo | `github.com/mykpono/qr-code-agent`, branch `main` |
| Vercel project | `qr-generator` in scope **`mykola-5698s-projects`** (not `balloonbay-project`) |
| Deploy trigger | **every push to `main` goes straight to production** |
| Live pages | 44 (34 of the 48-page taxonomy + 10 `/learn` articles) |
| Tests | 58, `npm test` |
| Backup of the old prototype | branch `pre-astro-backup` (`358e000`) |

Verified live: generator renders, codes decode, 4-module quiet zone, vector SVG
export, `role="img"` canvas, zero console errors.

### Start-of-session sanity check

```bash
cd qrcodeagent-app
npm ci
npm run verify        # 58 tests + build + 17 dist checks
npm run dev           # then OPEN THE GENERATOR IN A BROWSER (see the warning below)
```

---

## Read this before touching the generator

On 2026-07-20 a refactor took the generator off **every page of the live site**
for ~18 minutes. `lib/qr.js` was extracted from `Generator.jsx` but two helpers
(`drawMod`, `drawFinderReal`) were left unexported, so the island threw
`ReferenceError` during hydration and React unmounted it.

**Everything green-lit it:** `npm run build` passed (Astro never evaluates the
island at build time), all tests passed (they import `lib/qr.js` directly and
never load the component), and `check-build.mjs` passed (it reads static HTML;
the SSR markup was fine — the crash is client-side).

Two rules follow, and they are not optional:

1. **After any change to `Generator.jsx` or `lib/qr.js`, load a tool page in a
   browser and confirm the generator renders with no console errors.** Use a
   *fresh tab* — the console buffer persists across navigations and will show
   you stale errors, or stale silence.
2. **A green test suite is not evidence the app runs.** It is evidence the code
   it imports behaves. Nothing in CI currently boots the app.

There is now a guard test (`lib/qr.js exports everything Generator.jsx imports`)
that fails on exactly this bug. It does not cover the general case.

---

## Phase 2 — do these first

### 2.1 Set the environment variables (blocking, 10 minutes, needs you)

**The site has recorded zero analytics since launch.** Confirmed live:
`typeof window.umami === 'undefined'`, `typeof window.gtag === 'undefined'`.
The project has only two stale Supabase vars from the 2026-03 prototype.

Vercel → `qr-generator` → Settings → Environment Variables, for **Production and
Preview**:

```
PUBLIC_STRIPE_SUPPORT_URL=https://buy.stripe.com/7sYfZid6e4A7bg670KdUY00
PUBLIC_UMAMI_WEBSITE_ID=<from the `umami` project in the same Vercel scope>
PUBLIC_GA4_MEASUREMENT_ID=<from GA4>
```

Then redeploy — env vars are baked in at build time, so an existing deployment
will not pick them up.

Notes:
- The Stripe CTA already works via the `pages.json` fallback; setting the var
  just moves control to Vercel so the link can change without a commit.
- **The consent banner stays hidden until `PUBLIC_GA4_MEASUREMENT_ID` exists.**
  That is deliberate — with no GA id there is nothing to consent to. Do not
  "fix" its absence.
- Umami is cookieless and ungated; GA4 loads only after explicit accept.

### 2.2 Print and scan the test sheet (blocking, 20 minutes, needs you)

```bash
npm run scan-sheet     # -> dist/scan-test.html
```

Print **at 100% scale** (turn off "fit to page") and scan all ten codes.

This is the only check software cannot do: ink spread, laminate glare, room
lighting and old phone cameras are all outside the test suite. Two codes are
deliberate traps — **#10 is 12 mm** (below the 15 mm minimum; if it scans
instantly everywhere your conditions are too favourable) and **#7 contains
accented characters** (if it decodes to an empty string, the UTF-8 fix has
regressed — see below).

### 2.3 Decide whether push-to-prod is what you want

Right now `git push` → production, with nothing in between. The CI workflow
(`.github/workflows/ci.yml`) runs on push but **does not gate the deploy** —
Vercel ships regardless of whether tests pass. That is how a broken commit
reached users within a minute.

Options, cheapest first:
- Turn on **"Only deploy on CI success"** / required status checks on `main`.
- Protect `main` and deploy from PRs, using Vercel preview URLs to verify.
- Leave as-is and accept the risk, given rollback is instant.

---

## Phase 3 — localization (the biggest growth lever)

The infrastructure is **built and proven**; this is a content job, not an
engineering one.

- 11 locales are declared in `pages.json → site.languages`:
  en (default), es, pt-BR, de, fr, it, ja, id, uk, pl, ru.
- `src/content/i18n/` is **empty** — EN only today.
- `LIVE_LOCALES` in `lib/content.js` is derived from the bundles actually
  present, so **hreflang and the sitemap can never advertise a locale that
  404s.** Dropping a bundle in is all it takes to go live.

**Rollout order (validated demand, SEO-BRIEF §8): DE → ID → PT-BR → JA → PL →
IT → FR → UK → ES, then RU after its keyword pull.**

Rules that matter:
- **Do not machine-translate keywords.** Per §8.2, titles in DE/ID/JA should
  lead with the English head term, because that is what people search.
- Translate `pages.json` copy per locale into `src/content/i18n/<code>.json`.
- Do **one locale first (DE)** and review it before scaling — this is the most
  token-expensive work remaining.
- After the first locale ships, switch to `docs/sitemap-528-full.xml` only if
  the generated sitemap proves insufficient (it currently scales correctly on
  its own, so this is probably dead weight).

---

## Phase 4 — remaining content

### 14 taxonomy pages deliberately not built

SEO-BRIEF §11 marks these delay/demote. Build only with a reason:

```
/svg-qr-code-generator      /colored-qr-code-generator   /email-qr-code
/google-maps-qr-code        /qr-codes-for-bars           /qr-codes-for-coffee-shops
/qr-codes-for-gyms          /qr-codes-for-salons-spas    /qr-codes-for-nonprofits
/qr-codes-for-food-trucks   /qr-codes-for-promotions     /qr-codes-for-reviews
/qr-codes-for-flyers-posters /qr-codes-for-table-tents
```

`/qr-codes-for-reviews` is the notable one: demand lives on
`/google-review-qr-code` (1,900 MSV), so merge or keep it thin — never let it
target the review head term.

### More `/learn` articles

Ten exist. Three were added 2026-07-20 — `/learn/qr-code-vs-nfc`,
`/learn/qr-code-not-working` and `/learn/are-qr-codes-safe` — chosen because the
comparison and question formats earn the largest share of AI citations. Their
keywords are **reasoned, not measured**: no Semrush pull was run for them, so
`msv`/`kd` are null as with the original seven.

Remaining candidates: QR vs barcode, QR vs short-link.

Note for anyone writing more: `Page.astro` renders a section's `p` **before** its
`list`, so a paragraph written as a follow-up to a list will appear above it.
Put closing remarks in `callout` (which renders last) — and remember `callout`
text does not count toward the 600-word minimum in `content.test.mjs`.

**Every new article must respect the cannibalization table** in the article spec
— money pages own their head terms; articles take question/comparison intent and
link down.

---

## Phase 5 — product (post-launch, optional)

- **Accounts** (`BACKLOG` P3): Supabase Auth + Google for cross-device saved
  codes. Needs a backend and a Stripe secret key. Deliberately out of scope so
  far; the entire positioning is "no sign-up".
- **Dynamic codes** would be a different product. `/learn/static-vs-dynamic-qr-codes`
  states plainly that this tool makes static codes only and cannot track scans.
  If that ever changes, that article and `/privacy` must change with it.

---

## Known gaps — unresolved, be honest about them

| Gap | Status |
|---|---|
| **No screen-reader pass** | Names, roles, focus and contrast are verified programmatically. Nobody has run VoiceOver/NVDA, so whether the QR announcement is *useful* is unproven. ~20 min to close. |
| **Nothing boots the app in CI** | Tests cover `lib/qr.js` and `pages.json`; `check-build.mjs` covers static HTML. A hydration crash passes all of them. A smoke test (Playwright: load a page, assert `.genflag` exists, assert zero console errors) would close the exact hole that caused the outage. |
| **No analytics data at all** | Until 2.1 is done, there is no traffic baseline and no way to measure anything, including the outage's impact. |
| **Logo in SVG is raster** | Unavoidable — the user supplies a PNG. The QR pattern itself is true vector. |
| **`docs/STRIPE-PLAN.md` slightly stale** | PR #8 removed `offerSupport()` from the SVG download path, so the post-download prompt now fires on PNG only. The doc still says "after a successful download". |

---

## Bugs found this cycle — do not reintroduce

Each has a test. If one of these tests fails, read this list before "fixing" it.

1. **Quiet zone as a fraction of output** (`pad = out * 0.04`) gave ~1.3 modules
   on a typical URL where the spec requires 4. Now `cell = out/(n+8)`,
   `pad = 4*cell`.
2. **Non-ASCII silently broke every code.** `qrcode-generator`'s default byte
   encoder truncates to 8 bits, so "café" decoded to an *empty string*. Fixed by
   selecting `stringToBytesFuncs['UTF-8']` in `lib/qr.js`. Critical for the
   11-language plan — nine of those locales use non-ASCII characters.
3. **SVG export was a PNG in a wrapper**, so it did not scale — while three
   articles tell readers to send SVG to the printer because vector stays sharp.
4. **Empty codes were exportable.** `buildPayload` returns vCard/WiFi
   scaffolding even when blank, so a truthy payload is not proof of content.
   Gate on `hasContent`.
5. **Hydration mismatch on every phone.** `railOpen` read `window.innerWidth` in
   its `useState` initialiser. Never read browser APIs during the first render.
6. **`drawMod` not exported** — the outage described above.

---

## Quick reference

```bash
npm run dev          # localhost:4321
npm test             # 58 tests
npm run verify       # test + build + dist checks — run before every push
npm run scan-sheet   # printable phone-scan test
npm run build

vercel ls qr-generator --scope mykola-5698s-projects     # deploy history
vercel env ls --scope mykola-5698s-projects              # env vars
```

Key files: `src/content/pages.json` (all copy), `src/lib/qr.js` (pure QR logic —
never fork it back into the component), `src/lib/content.js` (hreflang, JSON-LD,
`LIVE_LOCALES`), `src/components/Page.astro` (archetype layouts),
`scripts/check-build.mjs`, `RELEASE.md`.
