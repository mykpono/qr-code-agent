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

---

## Known gaps

**The application chrome is not translated.** Page content is, but the generator
widget (`DOT STYLE`, `LIVE PREVIEW`, `DOWNLOAD PNG`, `Network name (SSID)`), the
header, trust pills and support/footer lines are hardcoded English in the
components. `uiStrings()` in `lib/content.js` exists for this and is currently
unused. Until it is wired, a locale renders translated copy inside an English UI.

Note the likely layout consequence: the dot/finder pickers are fixed 5-column
grids sized for English labels.

**Keywords are not localized.** Translations render the English page's intent;
they are not targeted at researched keywords in the target language. `primary`,
`secondaries`, `msv` and `kd` in `pages.json` are English-market figures and are
deliberately not translated. Real per-locale keyword research is a separate job.

**Machine translation needs human review before it ships.** Google's
scaled-content-abuse policy explicitly names automated translation published
without human review, and a penalty would hit the English pages too. Treat a
generated bundle as a reviewable first draft.

---

## Adding a page later

A new page must be added to **every** live bundle in the same change that ships
it, or it renders in English under every locale prefix. `test/i18n.test.mjs`
fails the build if a bundle is missing a page, so this cannot slip through.
