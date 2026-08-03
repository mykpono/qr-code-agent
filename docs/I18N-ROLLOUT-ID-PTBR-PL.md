# Implementation plan — three new locales: ID, PT-BR, PL

Takes the site from **3 live locales (en/de/es, 150 URLs)** to **6 (300 URLs)**.

Operational procedure is `docs/I18N-RUNBOOK.md` — this plan does not restate it. What is
here is what the runbook does not cover: the locale-specific decisions, the one deviation
from the runbook's step order, the staggering, and the gate.

| | |
|---|---|
| **Locales** | `id` → `pt-br` → `pl`, in that order, one at a time |
| **Governing rules** | D-007 / CLAUDE.md rule 9 (no partial bundles), D-013 (PR to protected main), D-010 (head terms live outside the bundle) |
| **Effort** | ~23 hrs human + 3 large translation passes; ~6 weeks calendar at the stagger below |
| **Code changes** | **None.** See §2 |
| **Deliverable per locale** | one PR: `src/content/i18n/<loc>.json` + a `headTerms` entry |

---

## 1. Decisions taken (2026-08-03)

**Locale set: ID + PT-BR + PL, not the documented ID → PT-BR → JA.**
SEO-BRIEF §11 and TRAFFIC-PLAN C1–C3 order the rollout ID → PT-BR → JA. The first two are
kept; **JA is deferred** because it is the only one of the four that is not a content-only
job:

- **No CJK font is self-hosted.** `public/fonts/` carries Space Grotesk and IBM Plex Mono
  in latin, latin-ext and cyrillic subsets only — neither family has kana or kanji glyphs
  at all. Japanese would render every heading and every mono label in an arbitrary system
  fallback, on a site whose golden rule 1 is "never invent UI".
- **The 70–155-char meta rule is wrong for Japanese.** It is enforced in three places
  (`scripts/i18n-merge.mjs:79`, `test/i18n.test.mjs:57`, `scripts/check-build.mjs:74`)
  with no per-locale exception. Google truncates Japanese snippets around 50 full-width
  characters, so a compliant JA meta is roughly 3× the visible limit — the rule would
  force 50 pages of keyword padding to satisfy a linter.

Both are fixable (~5–7 hrs: a subset Noto Sans JP, plus per-locale limits threaded through
those three call sites), but they are engineering, and mixing them into a content rollout
is what turns a 6-hr locale into a 13-hr one. **JA gets its own ticket after this plan.**
PL replaces it: 9,900 MSV, latin-ext, zero code.

Note this reorders C4 (PL) ahead of C3 (JA) in `docs/TRAFFIC-IMPLEMENTATION-PLAN.md` §5.5.
Update that list when this plan is accepted.

**Review policy: partial review** — mitigation #2 in TRAFFIC-PLAN §5.4. Human-review
`title`, `meta`, `h1` and the FAQ answers on the top ~8 money pages per locale, ~1 hr each.
This closes open question #2 ("native review policy for 8 new locales — needs a decision
before C1"). **Record it in `CLAUDE.md` rule 9 with its date** as part of Track A; the plan
doc explicitly asks for that so the decision does not drift again.

---

## 2. What does *not* change — verify this before writing any code

The locale machinery is fully derived. Every one of these was checked against source, not
assumed:

| Thing you might expect to edit | Why you don't |
|---|---|
| `astro.config.mjs` `LOCALES` | already lists all 11 incl. id/pt-br/pl |
| `HREFLANG` map, `src/lib/content.js:15` | already maps all 11 |
| `LOCALE_ORDER`, `content.js:21` | already lists all 11; new locales slot in at positions 3, 4, 6 |
| `LIVE_LOCALES` | derived from `import.meta.glob` over `src/content/i18n/*.json` |
| `pages.json` → `site.languages` | already carries all 11 with labels (`Bahasa Indonesia`, `Português (BR)`, `Polski`) |
| `scripts/gen-sitemap.mjs` | derives its own live set the same way; emits alternates automatically |
| `Header.astro` / `Footer.astro` language switchers | both map over `LIVE_LOCALES`; both flex-wrap, so six entries need no CSS |
| `llms.txt`, `check-build.mjs` locale assertions | generated from the live set |
| `public/assets/og.png` | the widget's **look** does not change, so D-009 does not fire. Do **not** run `npm run og` |
| `public/fonts/` | id/pt-br/pl are covered by the latin + latin-ext subsets already shipped |

**Dropping a bundle into `src/content/i18n/` is the entire code change.** If a step in your
execution requires editing a file in that table, stop — something has been misunderstood.

---

## 3. Track A — one-time prep (do once, before locale 1) · ~2 hrs

**A1. Declare all three head terms up front — this inverts runbook step 6.**

The runbook puts head-term declaration *after* the translation merge. That order worked for
DE and ES only by luck: German keeps the English form (`QR-Code-Generator`) and Spanish's
natural translation is the head term, so their money pages scored 21/21 and 20/21 without
anyone aiming at them.

**ID breaks that.** Its validated head term is the *English* string `qr code generator`
(135,000 MSV — SEO-BRIEF §8.2 records that English dominates the Indonesian market), while
a translator working from an English source will naturally produce `pembuat kode QR`. Every
one of the **21 money pages** (1 home + 2 feature + 18 type) would then fail
`test/seo-head-terms.test.mjs` at merge time, after the whole bundle is paid for.

So: write `src/content/seo-head-terms.json` **first**, and put the term in the translator
brief. Add to `headTerms`:

```jsonc
"id": {
  "term": "qr code generator",
  "msv": 135000,
  "note": "ENGLISH form dominates the market. Titles and H1 must keep 'QR code generator' untranslated. Native secondaries: buat kode qr 2,400 / pembuat kode qr 720 — use them in meta and body, never instead of the head term in the title.",
  "source": "SEO-BRIEF 8.2"
},
"pt-br": {
  "term": "gerador de qr code",
  "msv": 49500,
  "note": "Top locale by volume. English-style 'QR code' beats 'código QR' — never translate the noun phrase to 'gerador de código QR'. '...gratis' 1,000 carries the free modifier.",
  "source": "SEO-BRIEF 8.2"
},
"pl": {
  "term": "generator kodów qr",
  "msv": 9900,
  "note": "PLURAL GENITIVE wins: 'kodów' 9,900 vs singular 'generator kodu qr' 720. Matching is accent-insensitive so correct 'kodów' satisfies the unaccented term.",
  "source": "SEO-BRIEF 8.2"
}
```

Note `test/seo-head-terms.test.mjs:46` asserts every declared head term names a **live**
locale — a locale with no bundle. So these three entries **cannot be committed before their
bundles**; stage them in the working tree during A1, and commit each one **in its own
locale's PR**. Keep the drafted block in this doc until then.

**A2. Confirm the extractor still sees everything.** `npm run i18n:coverage`. Run it before
locale 1 and again if `pages.json` changes mid-rollout. It fails if any prose string never
reaches the extractor — the check that exists because 25 how-to blocks and 75 steps were
once silently dropped.

**A3. Write the translator brief** (once, parameterized per locale). Runbook step 3 lists
the structural rules; add these four, which are what actually broke DE/ES:

1. **The head term is fixed copy, not a translation.** Reproduce it verbatim in the `title`
   and `h1` of every money page. For ID that means the English words `QR code generator`
   stay English inside Indonesian sentences. This is deliberate and is not an error.
2. **`title` ≤ 60 chars is the binding constraint**, not `meta`. ID, PT-BR and PL all run
   15–20% longer than English, and the head term eats 18–19 of the 60 before the page's own
   subject gets any.
3. **`meta` 70–155 chars and unique across all 50 pages.** Watch the collision: inside
   `articles` cards `meta` means "6 min read" and has no length rule; only a page-level
   `meta` is a meta description.
4. **Register is a per-language decision, recorded for the reviewer.** DE used formal *Sie*,
   ES informal *tú*. Suggested: **ID** formal-neutral *Anda*; **PT-BR** informal *você*
   (Brazilian norm); **PL** formal impersonal, avoiding *ty*/*Pan* by using verb-noun
   constructions ("Utwórz kod QR"), which is standard for Polish software UI.

**A4. Record the review decision in `CLAUDE.md` rule 9**, dated — per the C-risk task.

---

## 4. Track B — the per-locale pipeline, run three times

Identical for each locale; `<loc>` ∈ `id`, `pt-br`, `pl`. Measured scale, from the current
`pages.json`:

- **50 pages**, **2,077 translatable string fields**, **31,308 words** per locale
- → `npm run i18n:extract <loc> -- --chunks 14` (~2,200 words/chunk, bin-packed by word
  count; the six `learn/*` articles run 1,300–2,141 words each and would otherwise sit in
  one chunk)
- **416 UI leaf strings** in `ui.json`, translated separately

**B1. Branch.** `git checkout -b i18n-<loc>` off `origin/main`. Never work on `main`
(D-013). If another session holds the working tree — this repo is routinely worked by two
at once — use the throwaway-worktree pattern from the project memory rather than fighting
their uncommitted edits.

**B2. Extract.** `npm run i18n:extract <loc> -- --chunks 14` → `.i18n-work/<loc>/chunk-*.json`.
`.i18n-work/` is gitignored; only the finished bundle is committed.

**B3. Translate the page chunks.** One translator per chunk, in parallel, each carrying the
A3 brief plus the A1 head term. Output `.i18n-work/<loc>/out-NN.json` — **same filename
number as its chunk**, same keys, same nesting, same array lengths and order. Translate
values only; top-level keys are page slugs.

**B4. Translate the UI chrome.** There is **no extractor for `ui.json`** — `i18n-merge.mjs`
looks for a hand-produced `.i18n-work/<loc>-ui-out.json` and validates it against the full
English shape. Copy `src/content/ui.json` to that path and translate in place, keeping all
416 leaves (`_`-prefixed keys are translator notes, not shipped copy — drop them). Four
constraints the merge enforces and that a translator will otherwise miss:

- `ui.dot.*` ≤ 10 · `ui.finder.*` ≤ 18 · `ui.logoShape/logoBorder.*` ≤ 10 · `ui.ecc.L/M/Q/H`
  ≤ 12 · `ui.tab.{social,industry,usecase,themes}` ≤ 14 · `ui.preset.*` ≤ 18.
- **The `dot` + `finder` pair budget is 24 chars combined**, because the longest of each can
  meet in the one-line style summary `${dot} · ${finder} · ECC ${x}`. This is the constraint
  that bites: German already sits at 23 (`Quadrat` meeting `Blatt gespiegelt`), and a
  literal Polish rendering of "Leaf mirrored" blows it on its own. Shorten deliberately at
  translation time, not after the merge rejects it.
- `ui.gen.demoCta` ≤ **24 chars** — it is seeded straight into the frame-text input, whose
  `maxLength` is 24. DE shipped at 25 once and opened the widget already showing the amber
  over-limit counter, with a string the visitor could never retype.
- `ui.nav` must stay 5 entries and `ui.footerCols` 4, with matching per-column link counts —
  they index positionally against `pages.json`.
- Follow the placeholder convention: `field.phoneIntl` keeps the canonical `+1 415 555 0123`
  in every locale, so `field.ph.phone` matches it rather than using a local dialling format.

**B5. Merge.** `npm run i18n:merge <loc> -- --dry-run`, fix what it names (it reports exact
field paths like `about.sections[2].p[1]`), then merge for real. It writes nothing unless
all 50 pages are present, the shape matches English exactly, and every title/meta is in
range and unique. Merging is field-level, so a follow-up pass can fill gaps.

**B6. Add the head term.** Move this locale's `headTerms` block from A1 into
`src/content/seo-head-terms.json`. Then `npm test` and read
`test/seo-head-terms.test.mjs`'s output: it names each money page whose title omits the
term. Add a **narrow** `overrides.<loc>.<slug>.title` for each — do not rewrite titles that
already pass. DE needed zero overrides, ES needed one.

**B7. Partial human review** (~1 hr) — `title`, `meta`, `h1` and FAQ answers on the top 8
money pages. Per the A4 policy.

**B8. Verify.** In order:

```bash
npm test                       # i18n shape, ui coverage, head terms, QR decode
npm run verify                 # test + build + 24 check-build assertions
npm run build && PREVIEW_PORT=4399 npm run test:e2e
```

- `npm run verify` must report **50 × N pages** (200 after ID, 250 after PT-BR, 300 after PL)
  and `check-build` must pass all 24 assertions, including "llms.txt names every live locale".
- **Use an explicit `PREVIEW_PORT`.** Playwright's config reuses an existing server on the
  default port, so a dev server another session left running captures the whole e2e suite and
  produces ~10 phantom failures that reproduce identically on a clean tree.
- **English-leak spot check** — grep the built locale HTML for English function words:
  `grep -ric ' the \| and \| your ' dist/<loc>/wifi-qr-code/index.html` and two more deep
  pages. A partial bundle does not skip pages, it publishes them in English under a locale
  prefix with hreflang asserting otherwise.
- **Load a tool page in a fresh browser tab** at `/<loc>/wifi-qr-code` and confirm the
  generator renders with no console errors. Nothing in CI boots the app; a refactor that
  passed the build and every test once took the generator off the entire live site for 18
  minutes.
- Confirm the `<html lang>` and the hreflang set on a deep page, and that the language
  switcher shows all live locales.

**B9. Ship.** PR → wait for the green `verify` check (CI runs e2e; local `verify` does not) →
squash-merge → Vercel deploys. Never push to `main`.

**B10. Post-deploy, against production** — the build passing proves the markup parses
locally, not that the deploy served it:

```bash
curl -s https://qrcodeagent.net/<loc>/wifi-qr-code | grep -o '"founder"'
curl -s https://qrcodeagent.net/sitemap.xml | grep -c '<url>'
npm run indexnow:submit && npm run gsc:submit
```

Then check GSC discovers the locale's URLs within 14 days.

---

## 5. Stagger and the gate

**One locale per two weeks — not one PR, not one month.** Volume-over-time is part of what
Google's scaled-content-abuse policy targets, and a penalty would hit the English pages too.
Three bundles landing together is exactly the pattern the policy describes.

```
Week 1–2   ID       (135,000 MSV)  → PR → merge → 200 URLs
Week 3–4   PT-BR    ( 49,500 MSV)  → PR → merge → 250 URLs
  🚦 GATE — review, do not build
Week 5–6   PL       (  9,900 MSV)  → PR → merge → 300 URLs
```

**The gate sits between PT-BR and PL**, and is TRAFFIC-PLAN §9's Week-9 gate applied to this
rollout. Pull GSC and answer in writing:

1. **Indexation** — what % of the 250 URLs are indexed? Under ~50% and adding a sixth locale
   is pouring water into a full bucket; fix crawl and authority instead.
2. **Locale performance** — are DE/ES/ID/PT-BR getting impressions proportional to their MSV?
   If DE (165k) still underperforms ES (1.6k), the problem is head-term targeting, not locale
   count — and no new locale fixes it.
3. **Distribution** — any measurable referral traffic or backlinks since the last check?

**Ship PL only if 1 and 2 both look healthy.** Otherwise stop and work on authority. That is
a real possible outcome of this plan, not a formality.

---

## 6. Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | **ID titles miss the English head term** — the highest-probability failure here, and it lands after the bundle is paid for | A1 declares the term before translation; the brief states it; `test/seo-head-terms.test.mjs` names every offender |
| R2 | **Scaled-content-abuse exposure** across six locales, reaching the English pages | Stagger (§5), partial review (A4), honest locale count in `llms.txt` |
| R3 | **`title` ≤ 60 overflow.** All three languages run 15–20% longer than English and the head term eats 18–19 chars | Named as constraint #2 in the brief; `i18n-merge` refuses to write the bundle |
| R4 | **PL `dot`+`finder` pair over the 24-char summary budget** — DE already sits at 23 | B4 states the budget; checked at merge *and* by a standing test, so a hand-edit cannot slip past |
| R5 | **Phantom e2e failures** from another session's dev server | Explicit `PREVIEW_PORT` (B8); confirm against CI before believing a local failure |
| R6 | **Working-tree contention** — two Claude sessions on this repo | Throwaway worktree off `origin/main`; never quote a test count measured in a dirty tree |
| R7 | **300 URLs on a domain with limited authority may simply not index** | This is exactly what the §5 gate measures; it is why the gate precedes PL |
| R8 | **Every future page now costs 6 translations, not 3** (D-007) | Accept it explicitly. `test/i18n.test.mjs` fails the build if a bundle misses a page, so it cannot slip — but it doubles the cost of Phase 4's 14 planned pages. Factor this in before approving |

---

## 7. Definition of done

Per locale: `npm run verify` reports 50 × N pages · no English leakage on three spot-checked
deep pages · hreflang reciprocal and `<html lang>` correct · every title ≤ 60 and every meta
70–155 and unique · head term present on all 21 money pages · generator hydrates with no
console errors at `/<loc>/…` · CI `verify` green · GSC discovers the locale within 14 days.

Overall: 6 live locales, 300 URLs, sitemap and `llms.txt` agreeing, `seo-head-terms.json`
declaring a term for each of the six, and the JA ticket written up with its font and
per-locale-limit work costed.

## 8. Rollback

A locale goes live purely by bundle presence, so **rollback is deleting one file**: remove
`src/content/i18n/<loc>.json` and its `headTerms` entry, and the locale's routes, hreflang
alternates and sitemap URLs all disappear on the next build. Retain the `.i18n-work/` output
so the bundle can be restored without re-translating. Note that URLs already indexed will
404 until Google recrawls — rolling back a locale is cheap in the repo and not free in the
index, so prefer fixing forward once a locale has been discovered.
