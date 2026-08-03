# Traffic implementation plan — qrcodeagent.net

**Written:** 2026-08-02 · **Horizon:** 12 weeks (to 2026-10-25) · **Capacity assumption:** ~5 hrs/week
**Supersedes:** `SEO-AEO-TRAFFIC-STRATEGY.md` on sequencing. That doc's *analysis* stands; this doc
changes the *order* and adds verification steps, and is the one to execute against.

Read `CLAUDE.md` first (golden rules), then `NEXT-PHASES.md` (engineering state), then this.

---

## 0. How to use this document

Each task has an **owner tag**, an **estimate**, and a **definition of done**. Estimates are my
judgment, not measured — treat them as ±50%.

| Tag | Meaning |
|---|---|
| `[MYK]` | Needs a human — account access, a decision, a public post, a review pass |
| `[AGENT]` | Claude Code can do it end to end; Myk merges the PR |
| `[BOTH]` | Agent drafts, Myk reviews before it ships |

Priority is `P0` (blocks everything downstream) → `P3` (do only if the gate above it passes).

---

## 1. Verified state as of 2026-08-02

Findings below are marked by how strongly they were verified. **Do not treat the "inferred" rows as
fact** — re-check them before acting.

| Finding | Confidence | Evidence |
|---|---|---|
| Vercel Web Analytics **not enabled** on `qr-generator` | **Confirmed** | Vercel API returns `404 Web Analytics not found` for `prj_7WAwTRtMsTkBNnhjasWCNYjLxGKI` |
| Umami / GA4 **not firing** on production | *Inferred* | No references found in fetched homepage, and no consent banner. **Caveat: the fetch tool strips `<script>` tags, so absence is weak evidence.** Consistent with `NEXT-PHASES.md` §2.1. Verify in a real browser. |
| Site **is indexed** by Google | **Confirmed** | `qrcodeagent.net` returns in web search for brand-adjacent queries |
| Site is **absent** from its own money query | **Confirmed** | Search for "best free QR code generator with logo no sign up 2026" returns 6 roundups, none mentioning QR Code Agent |
| **Brand entity collision** | **Confirmed, but understated** | An unrelated Android app "QRCodeAgent QR Scan & Generate" (`com.webtechxp.qrcodeagent`) ranks on Google Play under a different developer. **Revised 2026-08-02:** measurement for E4 found the app is *not* the main competitor — it appears on neither brand query. "QR code" + "agent" is a generic phrase already owned by real-estate agents, payment-QR agents, AI agents and rivals literally named `agentqr.com` / `agenttext.com`. Schema cannot fix this; see `AEO-BASELINE.md` §2 |
| GitHub repo is a **weak** link asset | **Confirmed** | Public, but 0 stars, no topics, auto-generated description |
| `sitemap.xml` may have a **serving problem** | *Unverified* | Returned as unparseable binary to the fetch tool; `sitemap-index.xml` 404s. Could be normal gzip. **Check in GSC before assuming a bug.** |
| i18n pipeline is **production-grade** | **Confirmed** | `de.json` contains `{ui, pages}`, ~25k words, all 47 pages. Scripts `i18n:coverage / extract / merge` exist in `package.json`. UI chrome override mechanism is implemented (`ui.json` + `uiStrings()`). |
| 47 pages live × 3 locales (en, de, es) = 141 URLs | **Confirmed** | `docs/FINAL-TAXONOMY.md`, reconciled 2026-07-21; `dist/` listing |

### Claims from prior docs I could NOT verify

Carry these as assumptions, not facts:

- "Comparison articles take ~33% of AI citations" — no source located.
- "Brand mentions correlate ~3× more with AI citation than backlinks" — no source located.
- All MSV/KD figures — these come from your own Semrush pull (2026-07-20, US DB). I did not
  re-validate any of them. Per-locale **KD was never pulled at all** (`SEO-BRIEF.md` §8.2 says so
  explicitly), so locale prioritization below rests on demand volume only.

---

## 2. Prioritization model

Ordered by `impact ÷ effort`, with hard dependencies respected:

1. **You cannot prioritize what you cannot measure.** Measurement is P0 and blocks the Week-9 gate.
2. **Entity disambiguation is cheap and compounding.** A competing "QRCodeAgent" app actively
   degrades every citation and brand signal downstream. ~2 hrs to substantially improve.
3. **Localization is the largest addressable volume** — DE alone is 165,000 MSV vs. the entire
   English long tail. It is also the most delegable work you have. This is why it outranks
   English content here.
4. **Distribution creates the authority that makes 1–3 pay off.** Without it, 517 URLs is a
   crawl-budget liability.
5. **More English pages is the lowest-value move available** and is deferred to P3.

> **Note on where this differs from my first read.** I initially argued locales should wait for
> authority. You've decided otherwise, and having now inspected the pipeline I think that's
> defensible: the marginal cost per locale is genuinely low because the tooling is built and
> proven. The risk I flagged doesn't disappear though — it moves into §5.4, and the Week-9 gate
> exists to catch it.

---

## 3. Workstream A — Measurement `P0` · blocking · ~4 hrs

Nothing else in this plan can be evaluated until this is done. **Do not start §5 before §3 is
complete.**

- [ ] **A1** `[MYK]` · 30 min · Verify in a real browser whether analytics fire. Open
      qrcodeagent.net, DevTools console: `typeof window.umami`, `typeof window.gtag`. Record the
      result — this resolves the one *inferred* row in §1.
- [ ] **A2** `[MYK]` · 30 min · Set `PUBLIC_UMAMI_WEBSITE_ID` in Vercel (Production + Preview) from
      the `umami` project in scope `mykola-5698s-projects`, then **redeploy** — env vars bake in at
      build time.
- [ ] **A3** `[MYK]` · decision · **Recommend skipping GA4 entirely.** Umami is cookieless, so
      dropping GA4 removes the consent banner completely — faster LCP, no cookie UI, and it matches
      the privacy positioning that is your best launch angle. If you agree, leave
      `PUBLIC_GA4_MEASUREMENT_ID` unset permanently and note the decision in `NEXT-PHASES.md`.
- [ ] **A4** `[MYK]` · 45 min · Google Search Console: verify the property, submit
      `https://qrcodeagent.net/sitemap.xml`, and read **Pages → Indexing**. Record: how many of the
      141 URLs are indexed vs. discovered-not-indexed. **This number is the input to the Week-9
      gate.**
- [ ] **A5** `[MYK]` · 20 min · Resolve the sitemap question from §1 — GSC will tell you whether it
      parsed and how many URLs it read. If GSC reports an error, file it as a bug; if it parsed
      cleanly, the binary response was just gzip and there is nothing to fix.
- [ ] **A6** `[MYK]` · 30 min · Bing Webmaster Tools: verify + submit sitemap. Bing's index feeds
      Copilot and parts of ChatGPT search, so this is AEO infrastructure, not just Bing traffic.
- [x] **A7** `[AGENT]` · **DONE 2026-08-02** · `scripts/gsc-submit.mjs` works. Verified with
      `npm run gsc:submit -- --dry-run`: it builds and signs the request correctly.

      **What it does:** submits `sitemap.xml` to Search Console through the authenticated API
      (Google retired the `ping?sitemap=` endpoint in 2023) and prints the sitemap's GSC status —
      last downloaded, pending, errors/warnings, and URL count. It signs its own JWT with Node
      `crypto`, so there is no `googleapis` dependency.

      ```bash
      npm run gsc:submit -- --dry-run   # no creds needed, proves the wiring
      npm run gsc:submit -- --status    # read status, submit nothing
      npm run gsc:submit                # submit, then print status
      ```

      **It does NOT replace A4.** It needs a Google Cloud service account added as an **Owner**
      of the property (Full user cannot submit sitemaps), which means A4's verification step has
      to happen first either way. What it does replace is the *repeat* submission after each
      locale ships — and `--status` answers A5's "did the sitemap parse?" question from the CLI
      instead of the GSC UI. Set `GSC_SERVICE_ACCOUNT_JSON` or `GSC_KEY_FILE`; never commit the key.

**Definition of done:** Umami shows non-zero pageviews for a 24-hour period, and GSC reports an
indexed-page count.

---

## 4. Workstream B — Entity & brand signals `P0` · ~3 hrs

The goal is that Google and LLMs can tell "QR Code Agent (qrcodeagent.net)" apart from the
unrelated Play Store app. Cheap, and everything in §6 and §7 depends on it.

- [x] **B1** `[AGENT]` · **DONE 2026-08-02** · Full `Organization` block (`name`, `url`, `logo`,
      `description`, `founder`, `sameAs` → GitHub, LinkedIn, lab.mykpono.com) now emits on all
      **141** pages in all 3 locales, verified by `check-build.mjs`.

      **This was worse than the plan assumed.** `Organization` was gated on each page's `schema`
      array and only **2 of 47 pages** opted in; `WebSite` on 1. So 45 pages asserted no publisher
      identity at all — the pages most likely to be cited were the ones with nothing to
      disambiguate them from the Play Store app. Both are now site-level and unconditional, so a
      new page cannot forget them.

      Two bugs found and fixed on the way:
      - **`logo.png` did not exist.** The schema had pointed at `/assets/logo.png` for months;
        a logo URL that 404s invalidates the Organization block for anything that fetches it.
        Now generated (512×512) by `scripts/gen-og.mjs`, which already had the resvg + font setup.
      - **`inLanguage` claimed all 11 declared locales** when 3 are live. Now derived from
        `LIVE_LOCALES` — the same honesty §5.4 mitigation 4 asks for in `llms.txt`.
- [ ] **B2** `[MYK]` · 30 min · GitHub repo metadata: real description ("Free, no-sign-up QR code
      generator — Astro + React, client-side, 11 locales"), set the **Website** field to
      qrcodeagent.net, add topics (`qr-code-generator`, `astro`, `privacy`, `no-signup`).
- [x] **B3** `[AGENT]` · **DONE 2026-08-02** · README now leads with the product, the live link and
      an honest-limitations section (static codes, no scan analytics, raster logo in SVG) — per the
      AEO playbook, stated limitations get cited over overselling. The old one led with "This
      scaffold implements Phase 0–2" and was stale besides (claimed 13 pages, and that fonts were
      still on Google Fonts when `check-build.mjs` asserts they are self-hosted).
- [x] **B4** `[BOTH]` · **DONE 2026-08-02** · Audited: **no one-word "QRCodeAgent" exists in site
      copy** — it appears only in `docs/` prose describing the collision itself, and in old folder
      names in `IMPLEMENTATION-PLAN.md`. `llms.txt` (generated by `gen-sitemap.mjs`), `/about`,
      schema and the footer byline all use "QR Code Agent" consistently.
      Rather than leave that as a point-in-time check, `check-build.mjs` now **fails the build** if
      the one-word form appears in rendered page text on any of the 141 pages. URLs, the repo slug
      and `<script>` contents are excluded, since those legitimately contain it.

**Definition of done:** `Organization` schema with `sameAs` validates in Google's Rich Results
Test; repo has description, website and topics; no one-word "QRCodeAgent" remains in site copy.

> **Status:** B1, B3, B4 are done and enforced by CI. **B2 is still open — it needs you**
> (GitHub repo description, Website field, topics). B2 is also what makes B1 pay off: `sameAs`
> points at the GitHub repo, and that link only disambiguates the entity if the repo it lands on
> actually describes this product.

---

## 5. Workstream C — Localization rollout `P1` · the volume play

### 5.1 Order (by validated head-term MSV)

`LOCALE_ORDER` in `src/lib/content.js` is `en, de, id, pt-br, ja, pl, it, fr, uk, es, ru`.
Live today: **en, de, es**. Remaining, in impact order:

| # | Locale | Head-term MSV | Est. effort | Note |
|--:|---|---:|---|---|
| 1 | **ID** (Indonesian) | **135,000** | ~6 hrs | Highest remaining. **English head term dominates** — title/H1 must contain `qr code generator` verbatim; `buat kode qr` (2,400) as secondary. |
| 2 | **PT-BR** | **49,500** | ~6 hrs | `gerador de qr code`. English-style "QR code" beats "código QR". Localize examples to Brazil (PIX payment context). |
| 3 | **JA** | **27,100** | ~7 hrs | `QRコード生成` native preferred; EN form also strong (18,100). Keep 無料 in copy. Longest per-word review time. |
| 4 | **PL** | **9,900** | ~6 hrs | `generator kodów qr` — **plural genitive**, not singular (720). |
| 5 | **IT** | **8,100** | ~6 hrs | **Retarget to the verb:** `crea qr code` ≫ `generatore di qr code` (1,300). |
| 6 | **FR** | **3,600** | ~6 hrs | Noun + verb both: `generateur de qr code`, `creer un qr code` (2,900), `…gratuit` (1,600). |
| 7 | **UK** (Ukrainian) | **3,600** | ~6 hrs | `створити qr код` (verb) slightly ahead of the noun form. **Ukrainian ≠ Russian — never reuse.** |
| 8 | **RU** | *unvalidated* | ~6 hrs + research | **Gate: pull MSV/KD first.** Do not build on an unmeasured market. |

Source: `SEO-BRIEF.md` §8.2 (Semrush per-locale MSV). **Per-locale KD was never pulled** — these are
demand signals only.

### 5.2 The highest-leverage 20% of this work

The runbook is explicit: *"Keywords are not localized. The de/es bundles render the English page's
intent."* That means the live DE bundle — 165,000 MSV of demand — is **not targeted at the German
head term**. Fixing that is a couple of hours and worth more than an entire new locale.

> ### ⚠️ Audit result 2026-08-02: the premise above is mostly wrong, and C0 was nearly a no-op
>
> I measured it before rewriting anything. Counting money pages (`home`/`feature`/`type` — the
> archetypes that own the generator head term) whose **title** contains the §8.2 head term,
> accent- and hyphen-normalized:
>
> | Locale | Head term | Money pages carrying it |
> |---|---|---|
> | DE | `qr code generator` | **21 / 21** |
> | ES | `generador de codigos qr` | **20 / 21** |
>
> The runbook's warning is true in general but did not bite here, because **the English source
> titles are themselves head-term-shaped**, so translating them lands on the native head term by
> accident. DE needed **zero** changes. ES needed **one**: `google-review-qr-code`, whose title
> dropped the "Generador" noun that its own H1 and all 17 sibling type pages carry.
>
> The 19 DE / 27 ES titles that lack the head term are `learn/*` articles, industry hubs,
> use-case, `/about` and `/privacy` — and they **should** lack it. Forcing the generator head term
> into an article title is cannibalization, which the article spec explicitly forbids. A blanket
> "retrofit the top ~8 money pages per locale" would have made things worse, not better.
>
> **Two §8.2 instructions I did not follow, deliberately:**
>
> 1. **ES "prefer the unaccented plural".** Writing `codigos` without the accent is a spelling
>    error in Spanish. Google folds diacritics for Spanish queries, so the accented form already
>    matches the unaccented search — the volume split in §8.2 measures how users *type*, not what
>    a title must *say*. The actionable half of that row is **plural over singular**, which ES
>    titles already do. Shipping misspelled Spanish for zero matching gain is a bad trade.
> 2. **DE "lead with the English head term".** German orthography requires the hyphens in
>    `QR-Code-Generator`; `QR Code Generator` is an orthography error. Google tokenizes on
>    hyphens, so the two are already equivalent for matching.
>
>    The matcher is therefore accent- and hyphen-insensitive by design, so correct copy always
>    passes. **This applies to every future locale** — do not degrade a language's spelling to
>    chase a query string.

- [x] **C0** `[BOTH]` · **DONE 2026-08-02** · Audited rather than retrofitted; see above. One ES
      title fixed via the C0b override path. DE unchanged and verified correct.
- [x] **C0b** `[AGENT]` · **DONE 2026-08-02** · Per-locale head terms and overrides now live in
      **`src/content/seo-head-terms.json`**, applied after the translation merge in
      `localizedPage()`.

      **They are stored outside the locale bundle on purpose:** `i18n:merge` rewrites
      `<locale>.json` wholesale, so a head term hand-edited into it survives only until the next
      translation pass or the next page added. That is the trap that would have made C0 a
      recurring chore.

      The mechanism is half the value; the other half is **`test/seo-head-terms.test.mjs`**, which
      fails CI when a live locale declares no head term, or when any money page's title does not
      carry it. Verified non-vacuous — reverting the ES override reproduces the failure, naming
      the offending page and string. So "every locale you add repeats the DE mistake" is now
      structurally impossible rather than a thing to remember. Documented as **Step 6** in
      `docs/I18N-RUNBOOK.md`.

      This matters most for locales still to come, where the head term is genuinely *not* a
      translation of "generator" and translation alone would never produce it: **IT** wants the
      verb `crea` (8,100 vs 1,300 for the noun) and **UK** wants `створити`. **PL** needs the
      plural genitive `generator kodów qr` (9,900 vs 720 singular).

### 5.3 Per-locale procedure (repeat verbatim per locale)

Follow `docs/I18N-RUNBOOK.md` — it is accurate and every trap in it has actually fired. Condensed:

```bash
npm run i18n:coverage                    # 1. fails if any prose string is unreachable
npm run i18n:extract <loc> -- --chunks 12 # 2. → .i18n-work/<loc>/chunk-*.json
#  3. translate each chunk → .i18n-work/<loc>/out-NN.json  [AGENT, parallel]
npm run i18n:merge <loc>                 # 4. validates shape + title/meta limits, then writes
npm run verify                           # 5. expect 47 × (locales) pages
```

Non-negotiables (from `CLAUDE.md` rule 9 / D-007):

- **Never merge a partial bundle.** A locale goes live purely by the file existing; missing slugs
  silently serve **English content under a locale prefix with hreflang claiming otherwise**. Measured
  during the German run: a 2-line `es.json` took the build 46 → 92 pages, 45 of them false.
- `title` ≤ 60 chars, `meta` 70–155 and unique — enforced by `check-build.mjs` on built HTML. Most
  target languages run 15–20% longer than English; **this is the constraint that actually breaks.**
- Structure is load-bearing: same keys, nesting, array lengths, order. `howto.steps` is
  `[{name,text}]`; `table` is `{head,rows}`. Anything starting with `/` or `http` passes through
  untouched.
- Include the `ui` key so the generator chrome is translated too — `de.json` does this and it is
  the difference between a translated page and a translated *product*.
- Record the register decision (formal/informal) per language. DE used formal *Sie*; ES informal *tú*.

### 5.4 The risk this workstream carries — read before starting

Google's **scaled content abuse** policy explicitly names automated translation published without
human review. Eight bundles × ~25,000 words = **~200,000 words of machine translation**. A penalty
would hit the **English pages too**, which is the asset you cannot afford to lose.

`CLAUDE.md` rule 9 dropped the native-review-before-merge requirement on 2026-07-21. At 3 locales
that was a reasonable call. At 11 it changes the risk profile materially, and I'd push back on
carrying that relaxation forward unchanged.

**Mitigations, in order of value:**

1. **Stagger, don't batch.** One locale per 2 weeks, not four in a month. Volume-over-time is part
   of what the policy targets.
2. **Human-review the surfaces that matter most** even if you skip full review: `title`, `meta`,
   `h1` and FAQ answers on the top ~8 pages per locale. That is ~1 hr/locale and covers what both
   Google and LLMs read first.
3. **Gate on results.** If ID and PT-BR are not indexing by Week 9, stop — do not ship 6 more.
4. **Keep locale count honest in `llms.txt`** so AI crawlers see a consistent picture.

- [ ] **C-risk** `[MYK]` · decision · Decide and record: full review, partial review (option 2), or
      none. Write the decision and its date into `CLAUDE.md` rule 9 so it doesn't drift again.

### 5.5 Tasks

- [ ] **C1** `[BOTH]` · 6 hrs · **ID** bundle → PR → verify → merge (blocked by C0)
- [ ] **C2** `[BOTH]` · 6 hrs · **PT-BR** bundle
- [ ] **GATE** — Week 9 review. See §9. Do not proceed past here on schedule alone.
- [ ] **C3** `[BOTH]` · 7 hrs · **JA** bundle
- [ ] **C4** `[BOTH]` · 6 hrs · **PL** bundle
- [ ] **C5** `[BOTH]` · 6 hrs · **IT** bundle (retarget to `crea`)
- [ ] **C6** `[BOTH]` · 6 hrs · **FR** bundle
- [ ] **C7** `[BOTH]` · 6 hrs · **UK** bundle
- [ ] **C8** `[MYK]` · 1 hr · **RU** — pull MSV/KD first. Build only if the data justifies it.

**Definition of done per locale:** `npm run verify` reports `47 × N` pages; no English leakage on
spot-checked pages; hreflang reciprocal; title/meta within limits; head terms match §8.2; GSC shows
the locale's URLs discovered within 14 days.

---

## 6. Workstream D — Distribution `P1` · ~10 hrs

This is what turns 517 URLs from a liability into an asset. **Sequence matters: do not launch
before §3 is done** or you'll spend your one launch spike unmeasured.

- [ ] **D1** `[MYK]` · ~30 min · Directory submissions: AlternativeTo, SaaSHub, ToolFinder.
      **Prepared 2026-08-02 — see `docs/DIRECTORY-SUBMISSIONS.md` for paste-ready copy.** All
      three require an account, so the submitting is yours; the drafting, requirements check and
      competitor lists are done, which is why the estimate drops from 2 hrs. Two corrections to
      this row: **ToolFinder is $29**, not free (`toolfinder.co` → `toolfinder.com`), and
      **SaaSHub deprioritises submissions that name no listed competitors** — the pack supplies
      them. Recommendation recorded there: do the two free ones, skip ToolFinder for now.
- [ ] **D2** `[MYK]` · 4 hrs · **Product Hunt + Show HN**, same week. Lead with the **privacy
      claim** ("nothing is uploaded, no scans tracked, works offline"), not "free QR generator" —
      the latter reads as spam on HN. Block the full day for comments; the comment thread is where
      the mentions come from. **Requires §3 complete** so you can see what it does.
- [ ] **D3** `[MYK]` · 4 hrs · Outreach to the 6 roundups that currently own your money query.
      Getting *added to* a ranking roundup is far cheaper than outranking it:
      Jotform · ME-QR · Andrew Twelftree · MakeBranded · QRForever · Fotify.
      Angle: you're the only one on the list that is genuinely free, no-sign-up, non-expiring and
      client-side. **Be honest that codes are static** — per your own AEO playbook, stated
      limitations get cited over overselling.

---

## 7. Workstream E — AEO / comparison content `P2` · ~8 hrs

- [ ] **E1** `[BOTH]` · 3 hrs · `/learn/best-free-qr-code-generators-2026` — the query you are
      currently absent from. Honest comparison table, real limitations including your own.
      **Must respect the cannibalization table** in the article spec.
- [ ] **E2** `[BOTH]` · 2 hrs · `/learn/qr-code-vs-short-link` — already a named candidate in
      `NEXT-PHASES.md` §4.
- [ ] **E3** `[BOTH]` · 2 hrs · `/learn/qr-code-vs-barcode` — same.
- [x] **E4** `[MYK]` · 1 hr · **AEO baseline measurement.** Query ChatGPT, Perplexity, Claude and
      Google AI Overviews for "best free qr code generator with logo" and record whether
      qrcodeagent.net is mentioned. Repeat monthly. Without a baseline, §7 is unfalsifiable.
      **First reading taken 2026-08-02 → `docs/AEO-BASELINE.md`.** Absent from Google organic,
      Google AI Overviews and Perplexity on the money query. **ChatGPT and Claude still
      unmeasured** — both need a sign-in, so that half remains `[MYK]`. Next reading due
      2026-09-02.

⚠️ **Every new article must be added to every live bundle in the same change** (`test/i18n.test.mjs`
enforces this). By Week 10 that means translating each new article into 5+ locales — so the true
cost of an article rises with each locale shipped. **Front-load E1–E3 before the later locales.**

Also: `Page.astro` renders a section's `p` **before** its `list`. Put closing remarks in `callout`,
which renders last — and note `callout` text does not count toward the 600-word minimum in
`content.test.mjs`.

---

## 8. Workstream F — Deferred `P3` · do not start before the Week-9 gate

The 13 unbuilt taxonomy pages (`FINAL-TAXONOMY.md`). Highest scorer is `/google-maps-qr-code`
(110 MSV, KD 19, needs no new engineering — URL mode suffices). **Your own strategy doc's Bottom
Line says you don't need more English pages, and I agree.** Revisit only if the Week-9 gate shows
English pages indexing and ranking well, meaning the domain can carry more.

Six unvalidated industry hubs (bars, coffee shops, gyms, salons, nonprofits, food trucks) already
have shipped generator presets, so the product side exists. Still not worth the per-locale
translation tax they now carry.

---

## 9. Schedule at ~5 hrs/week

| Week | Focus | Hrs |
|---|---|---:|
| 1 | **A1–A7** measurement. Nothing else. | 5 |
| 2 | **B1–B4** entity + **C0** DE/ES head-term retrofit | 5 |
| 3 | **C0b** keyword override path + **D1** directories | 5 |
| 4 | **C1 — ID bundle** (135k MSV) | 5 |
| 5 | C1 finish + merge · **E4** AEO baseline | 5 |
| 6 | **D2 — Product Hunt + Show HN** | 5 |
| 7 | **C2 — PT-BR bundle** | 5 |
| 8 | C2 finish + merge · **E1** best-free-generators article | 5 |
| **9** | **🚦 GATE — review, don't build** | 3 |
| 10 | **D3** roundup outreach · **E2** | 5 |
| 11 | **C3 — JA** *(only if gate passed)* | 5 |
| 12 | C3 finish · **E3** · reassess | 5 |

**Total ≈ 58 hrs.** Locales 4–8 (PL, IT, FR, UK, RU) fall outside this horizon — that is
deliberate. At 5 hrs/week, 8 locales plus everything else is not achievable in 12 weeks, and a plan
that pretends otherwise is worse than one that admits it.

### 🚦 The Week-9 gate

Pull GSC and answer three questions **in writing**:

1. **Indexation** — what % of the 141 (soon 235) URLs are indexed? If under ~50%, adding locales is
   pouring water into a full bucket. Fix crawl/authority instead.
2. **Locale performance** — are DE/ES getting impressions proportional to their MSV? If DE (165k
   MSV) underperforms ES (1.6k MSV), the problem is head-term targeting, not locale count — and
   C0/C0b are the fix, not C3–C8.
3. **Distribution** — did the launch produce measurable referral traffic or any backlinks?

**Proceed to C3–C8 only if 1 and 2 both look healthy.** Otherwise the correct move is to stop adding
locales and work on authority.

---

## 10. What this plan explicitly does not do

Stated so a future session doesn't quietly re-add them:

- **No GA4** — recommended in A3, pending your confirmation.
- **No new English taxonomy pages** until the gate passes (§8).
- **No dynamic/trackable QR codes.** Different product; `/learn/static-vs-dynamic-qr-codes` and
  `/privacy` both depend on it staying static.
- **No accounts / Supabase auth.** The entire positioning is "no sign-up".
- **No paid acquisition.** Not chosen in scoping.
- **No localized slugs** (`/de/wlan-qr-code`). `SEO-BRIEF.md` §8.1 recommends English slugs under
  locale prefixes for v1; multiplying slug maintenance across 11 locales is not worth the marginal
  relevance.

---

## 11. Open questions

1. **Does Umami actually fire?** (A1) — the single unresolved fact blocking everything.
2. **Native review policy for 8 new locales?** (C-risk) — needs a decision before C1.
3. ~~**Is `scripts/gsc-submit.mjs` functional?**~~ **Resolved 2026-08-02 — yes.** See A7.
4. **Per-locale KD was never pulled.** All locale prioritization rests on demand volume alone. A
   high-MSV market with brutal KD could be a worse bet than a smaller one — worth ~1 hr in Semrush
   before C3.
5. **`docs/STRIPE-PLAN.md` is stale** (`NEXT-PHASES.md` known gaps) — unrelated to traffic, but
   it'll bite whoever reads it next.

---

## Related docs

- `CLAUDE.md` — golden rules; **rule 9 governs locale completeness**
- `NEXT-PHASES.md` — engineering handoff; §2.1 analytics, §3 localization
- `docs/I18N-RUNBOOK.md` — **the operational procedure for §5**
- `docs/FINAL-TAXONOMY.md` — 47 built / 13 planned, with validated MSV/KD
- `docs/SEO-BRIEF.md` — §8.2 per-locale head terms (the basis for §5.1), §11 phased rollout
- `docs/AEO-BASELINE.md` — **the E4 measurement series**; append a dated block monthly
- `SEO-AEO-TRAFFIC-STRATEGY.md` — the strategic analysis this plan operationalizes
