# SEO + GEO audit — 2026-07-20

Internal Mode. Audited the **built output** (`dist/`, 31 pages), not a live URL — the site
is not deployed yet. No fetch-based metrics (Core Web Vitals, backlinks, GSC impressions)
are reported, because none were measured.

## Scope note

No `/100` Health Score is given. That requires live-site data from a minimum of five
fetch-based checks; only static analysis was possible here. Everything below is measured
from the built HTML.

## Passed

| Check | Result |
|---|---|
| Duplicate titles | none across 31 pages |
| Duplicate meta descriptions | none |
| H1 count | exactly 1 on every page |
| Canonical tag | present on every page, self-referencing |
| Thin content | none — min 406 words, median 506, max 692 |
| JSON-LD | valid graph on every page; `HowTo` correctly omitted where no procedure exists |
| Server-side rendering | all copy is in the raw HTML. Critical for GEO — AI crawlers do not execute JS, and the generator being a React island does not hide the content |
| Primary-keyword uniqueness | no two pages share a primary (enforced by the merge validator) |

## Fixed in this pass

**1. Home page title exceeded the 60-char limit — CONFIRMED**
- Evidence: `<title>` was 61 chars (`Free QR Code Generator with Logo — No Sign-Up | QR Code Agent`).
- Impact: Google truncates; violates CLAUDE.md golden rule #6.
- Fix: dropped the `| QR Code Agent` suffix → 45 chars. Brand is already in the H1 and Organization schema.

**2. Ten orphan pages — CONFIRMED**
- Evidence: `/app-download-qr-code`, `/crypto-qr-code`, `/qr-codes-for-events`,
  `/qr-codes-for-feedback`, `/qr-codes-for-hotels`, `/qr-codes-for-packaging`,
  `/qr-codes-for-real-estate`, `/qr-codes-for-retail`, `/sms-qr-code`, `/text-qr-code`
  had **zero** inbound internal links.
- Impact: breaks the hub-and-spoke model in SEO-BRIEF §7. Orphan pages get little crawl
  budget and almost no internal PageRank; new pages would have stayed effectively invisible.
- Fix: the home directory is now generated from the page set by archetype (type / industry /
  use case / features) instead of a hand-maintained list of 12. Every page now has at least
  one inbound link, and the list cannot drift as pages are added.

**3. Two keyword collisions — CONFIRMED**
- `/` listed `qr code generator with logo` as a secondary, which is the **primary** of
  `/qr-code-with-logo` (a Phase-1 money page). Removed from home.
- `/event-qr-code` listed `qr code for events` as a secondary, which is the **primary** of
  `/qr-codes-for-events`. Removed from the type page.
- Impact: self-competition on exactly the terms SEO-BRIEF §5.6 warns about.

**4. No `/llms.txt` — CONFIRMED**
- Impact: low. The standard is proposed, not adopted, and has no proven citation impact.
- Fix: generated at build time in `scripts/gen-sitemap.mjs` so it always matches the live
  page set. Treated as hygiene, not a priority.

## Open — needs your decision

**robots.txt: no explicit AI-crawler directives — LIKELY**
- Evidence: current file is `User-agent: * / Allow: /`, which *implicitly* permits GPTBot,
  OAI-SearchBot, PerplexityBot and ClaudeBot.
- Impact: low. Wildcard-allow already works. Named directives are belt-and-braces and make
  the intent explicit and auditable.
- Fix (not applied — robots.txt is a high-risk file, confirm first): add named
  `Allow: /` blocks for `GPTBot`, `OAI-SearchBot`, `ChatGPT-User`, `PerplexityBot`, `ClaudeBot`.
- Note: this only matters if you *want* AI training and citation. Given the product is free
  and the goal is reach, allowing them is the right call — but it is your call.

## GEO assessment (qualitative)

Genuinely strong for this content type:
- **Citability** — every page has an FAQ with `FAQPage` schema, and a 3-step `HowTo`. Q&A
  format is the single most extractable structure for AI answers.
- **Structural readability** — clean H1→H2, short paragraphs, step lists.
- **Technical accessibility** — server-rendered, crawlers allowed, sitemap declared.
- **Multi-modal** — the interactive generator on every page is the highest-value signal in
  this dimension; an interactive tool is more citable than an article about one.

Weakest dimension is **Authority & Brand Signals**, which no amount of on-page work fixes.
Brand mentions correlate with AI citation roughly 3× more strongly than backlinks. For a
brand-new domain that means off-site work — the brief's Phase 4 — not more pages.

## Not done

- **Content depth per page is deliberately uniform** (~500 words). That is correct for a
  programmatic tool site and should *not* be padded. Padding would dilute, not help.
- **No comparison content exists.** Comparison articles take ~33% of all AI citations — the
  largest single share of any content type. A "static vs dynamic QR codes" comparison is
  the highest-leverage single piece of content this site could add, and it is already in the
  brief's Phase 2 `/learn` plan.
