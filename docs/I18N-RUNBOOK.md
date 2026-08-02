# i18n runbook — adding a locale

How to take a locale from nothing to review-ready. Written from the German and
Spanish runs; every trap below is one that actually fired.

**Governing rule: [D-007 / CLAUDE.md rule 9](../CLAUDE.md).** A locale ships only
when *every* page is translated. Never merge a partial bundle.

---

## Why partial bundles are forbidden

A locale goes live purely by having a file at `src/content/i18n/<locale>.json`.
From that moment `getStaticPaths` emits **every** page under that prefix, and
`localizedPage()` falls back to the **English** fields for any slug the bundle
omits.

So a partial bundle does not skip pages — it publishes them in English under a
locale prefix, with `<html lang="es">` and hreflang asserting otherwise. Measured
during the German run: a two-line `es.json` containing one page took the build
from 46 to 92 pages, and 45 of those served English content while claiming to be
Spanish.

That is worse than not shipping the locale.

---

## The pipeline

```bash
npm run i18n:coverage            # 1. prove the extractor sees every prose string
npm run i18n:extract es -- --chunks 12   # 2. → .i18n-work/es/chunk-*.json
#    3. translate each chunk → .i18n-work/es/out-NN.json (same filename number)
npm run i18n:merge es            # 4. validate + write src/content/i18n/es.json
npm run verify                   # 5. build all locales + full check suite
```

`.i18n-work/` is gitignored. Only the finished bundle is committed.

### Step 1 — coverage

Run this **first**, and again any time `pages.json` gains a field. It fails if a
key is unclassified, and — more importantly — if any prose string in `pages.json`
never reaches the extractor's output.

The string-level check exists because key-name classification was not enough.
`howto.steps` was read with a guessed `{h,t}` shape when the real one is
`{name,text}`; every key name involved was "classified", so a name-only check
passed while 25 how-to blocks and 75 steps were silently dropped.

### Step 2 — extract

Chunks are bin-packed by word count, not sliced sequentially: page sizes vary
~20x (a Learn article is ~2,300 words, a type page ~250), so equal-sized slices
hand one translator ten times the work of another.

~2,000–2,400 words per chunk works well. 46 pages ≈ 27,600 words ≈ 12 chunks.

### Step 3 — translate

One translator per chunk, in parallel. The brief must state:

- **Structure is load-bearing.** Same keys, nesting, array lengths and order.
  Translate values only, never keys. Top-level keys are page slugs.
- `howto.steps` is `[{name, text}]` — every step keeps both keys.
- `table` is `{head, rows}` — translate every cell, keep row/column counts.
- Anything starting with `/` or `http` is left exactly as-is.
- **`title` ≤ 60 chars; `meta` 70–155 and unique.** `check-build.mjs` enforces
  both on the built HTML. Most target languages run 15–20% longer than English,
  so this is the constraint that actually breaks.
- Watch the `meta` collision: inside `articles` cards, `meta` means "6 min read"
  and has no length rule. Only a page-level `meta` is a meta description.
- Numbers, units, ratios (`10:1`) and hex colors pass through unchanged; keep
  metric *and* imperial where both appear; use the locale's decimal separator.
- Register (formal vs informal) is a **per-language** decision — German used
  formal *Sie*, Spanish informal *tú*. Record the choice for the reviewer.

### Step 4 — merge

Writes nothing unless all 46 pages are present, the shape matches English
exactly, and every title/meta is in range and unique. Failures name the exact
field path (`about.sections[2].p[1]`).

`--dry-run` validates without writing. Merging is field-level, so a follow-up
pass can fill in fields an earlier pass missed.

### Step 5 — verify

Expect `46 × (locales) = N pages`. Then spot-check rendered pages for English
leakage — grep the built HTML for common English function words.

### Step 6 — declare the locale's head term (required; CI enforces it)

A translated bundle renders the *English page's* intent. Targeting the market's
actual demand is a separate, deliberate step, and `npm test` fails until it is
done: every live locale must declare its head term in
**`src/content/seo-head-terms.json`**, and every money page (`home`, `feature`,
`type`) must carry that term in its title.

```jsonc
"headTerms": {
  "it": { "term": "crea qr code", "msv": 8100,
          "note": "verb ≫ noun (generatore di qr code, 1,300)",
          "source": "SEO-BRIEF 8.2" }
},
"overrides": {
  "it": { "home": { "title": "Crea QR code gratis con logo — senza registrazione" } }
}
```

Take the term from `SEO-BRIEF.md` §8.2 — it is Semrush-validated per locale. Do
**not** translate the English keyword; several markets search the English form
(ID, JA, DE, PT-BR) and two want a **verb** rather than a noun (IT `crea`, UK
`створити`), which no translation of "generator" will ever produce.

Overrides live outside the locale bundle **on purpose**: `i18n:merge` rewrites
that bundle wholesale, so a head term edited into it survives only until the
next translation pass. They are applied after the merge in `localizedPage()`.

Matching is accent- and hyphen-insensitive, so correct orthography always wins:
German `QR-Code-Generator` satisfies `qr code generator`, and Spanish `códigos`
satisfies `codigos`. **Never write incorrect German or misspelled Spanish to
match a query string** — Google folds diacritics and tokenizes on hyphens, so
there is nothing to gain and a credibility cost to pay.

Most titles pass without an override, because the English source title is itself
head-term-shaped. When DE and ES were audited (2026-08-02) their money pages
scored 21/21 and 20/21 — only one page needed a fix. Add an override for the
outliers the test names; do not rewrite titles that already pass.

---

## Known gaps

**UI chrome is translated.** *(rewritten 2026-08-02 — this gap used to claim the
chrome was untranslated and `uiStrings()` unused. Both were false, and the three
holes that did exist are now closed.)* `uiStrings(locale)` in `src/lib/content.js` is wired in
`Header.astro`, `Footer.astro`, `Page.astro` and `Consent.astro`; English lives
in `src/content/ui.json` and a locale overrides any subset under its `ui` key.
The **generator widget is included**: `Page.astro:144` passes the merged strings
down as `ui={t}`, and `Generator.jsx:314` reads `const t = ui || EN_UI` — its
direct `ui.json` import is only the standalone fallback, not what the site
renders. `test/ui-strings.test.mjs` fails CI on any new hardcoded label. The
5-column-grid worry is handled too: `LIMITS` in `scripts/i18n-merge.mjs` caps
`dot`/`finder`/`logoShape`/`logoBorder` at 10 chars, `ecc` at 12 and the tab
chips at 14, and refuses to write the bundle if a translation overflows.

Three holes were found and closed on 2026-08-02. They are recorded here because
the *shape* of each one will recur, not because they are still open:

- **The 13 `field.ph.*` placeholders** — the example text inside the WiFi,
  vCard, SMS/WhatsApp and email inputs — were the only English left in DE and
  ES (345 of 358 keys translated). `Order enquiry`, `Table for two tonight?` and
  `Hi! I'd like to order…` were rendering inside a German widget. Now
  translated. Note the convention they follow: `field.phoneIntl` keeps the
  canonical `+1 415 555 0123` in every locale, so `field.ph.phone` matches it
  rather than using a local dialling format — one example number per locale.
- **The `INDUSTRY` and `USECASE` preset card labels** were hardcoded English in
  the `Generator.jsx` catalogues. They now carry a `key` that resolves against
  `ui.json` `preset`; the English `name` stays the preset's identity, so `sel`
  and the `template_selected` analytics event are unchanged in every locale.
  `CREATIVE` and `SOCIAL` names stay English on purpose — they are proper names
  of designs and brands. This one was invisible to `ui-strings.test.mjs` because
  its `scannable()` strips all four catalogue constants before scanning, so
  `test('every industry / use-case preset has a ui.json label')` now parses the
  catalogues out of the source directly.
- **Nothing checked EN → locale `ui` completeness**, which is *why* the first
  hole survived. `i18n-merge.mjs` enforces the full shape, but only while
  merging a fresh `.i18n-work/<locale>-ui-out.json`; the standing test only
  checked the reverse direction, and `i18n-coverage.mjs` covers `pages.json`
  only. So a key added to `ui.json` after a bundle landed fell back to English
  silently and forever. `test('every locale bundle covers every English ui key')`
  now fails CI on exactly that. A string that should *stay* English in a locale
  must be declared there carrying the English text — silence is not a decision.

Both new tests were confirmed to fail on real drift before being accepted, not
just to pass on the fixed tree.

**Keywords are only partly localized.** *(updated 2026-08-02 — this gap used to
be total.)* Head terms for money pages are now declared per locale in
`src/content/seo-head-terms.json` and enforced by `test/seo-head-terms.test.mjs`
(Step 6). What is still **not** localized: `primary`, `secondaries`, `msv` and
`kd` in `pages.json` remain English-market figures, article and industry-page
targeting is untouched, and **per-locale KD was never pulled at all** — SEO-BRIEF
§8.2 is demand volume only. A high-MSV market with brutal KD can still be a worse
bet than a small one; confirm KD before committing to a market.

**Machine translation needs human review before it ships.** Google's
scaled-content-abuse policy explicitly names automated translation published
without human review, and a penalty would hit the English pages too. Treat a
generated bundle as a reviewable first draft.

---

## Adding a page later

A new page must be added to **every** live bundle in the same change that ships
it, or it renders in English under every locale prefix. `test/i18n.test.mjs`
fails the build if a bundle is missing a page, so this cannot slip through.
