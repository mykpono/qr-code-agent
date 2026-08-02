# CONTENT-ROADMAP — QR Code Agent

Editorial / SEO content ideas and their status. This file is the home for **content planning**
(article ideas, briefs, angles). It is deliberately separate from:

- `docs/FINAL-TAXONOMY.md` — the authoritative **page/URL set** with validated Semrush MSV/KD.
  Once a content idea here becomes a committed page with validated demand, record it there.
- `BACKLOG.md` / `NEXT-PHASES.md` — engineering tasks.

**Discipline (same as FINAL-TAXONOMY):** a blank MSV/KD means *not measured*, not zero. Do not
invent volume figures. Validate a `primary` keyword in Semrush (US) before committing to write.

Last updated 2026-07-21.

---

## In progress

### #1 — "Why [vertical] should use QR codes" (Learn article template)
**Status: brief written** → `docs/BRIEF-vertical-qr-guide.md`
Intent: informational / top-of-funnel. Reusable `article` template that pairs an editorial
guide with each ICP hub — replicating the proven `/qr-codes-for-restaurants` +
`/learn/restaurant-qr-code-guide` pairing for verticals that have a preset/hub but no guide
(coffee shops, salons & spas, gyms, food trucks, nonprofits, retail, real estate, hotels).
SEO purpose: topical authority + internal links into money pages + AI-citation surface — **not**
a head-term play (the restaurant guide carries `msv: null`). First three to validate & write:
coffee shops, salons & spas, gyms. See the brief for the full section skeleton, JSON shape,
internal-linking map, and voice checklist.

---

## Parked — validate demand, then promote

Ordered as pitched. None have validated MSV/KD yet; the note on each says what to check.

### #2 — "Do QR codes expire? Are QR codes free?" (differentiator-defense article)
Archetype: `article` (Basics). Intent: informational, high-consideration.
Weaponizes the core positioning (free / no-sign-up / never-expires) against paid dynamic-QR
services that charge subscriptions and expire. Strong AI-answer-engine (GEO) surface — exactly
the kind of question ChatGPT/Perplexity field and cite. Pairs with the existing
`/learn/static-vs-dynamic-qr-codes` article; must not duplicate it (that one is the mechanism;
this one is the money/expiry question from the buyer's POV).
**Validate:** "do qr codes expire", "are qr codes free", "do qr codes expire if not paid".
Suspected meaningful volume — unconfirmed.

### #3 — "QR code marketing ideas / campaigns that work" (top-of-funnel hub listicle)
Archetype: `article` (or a Learn hub node). Intent: informational, broad top-funnel.
A 20–30-idea listicle that distributes internal links across a large share of the type +
usecase money pages (menu, packaging, business cards, feedback, social, events). Listicles pull
top-funnel traffic and are strong internal-link hubs.
**Validate:** "qr code marketing ideas", "qr code campaign ideas". Likely a higher-volume head
term → **check KD, may be competitive.**

### #4 — "How QR codes work" (foundational explainer, GEO play)
Archetype: `article` (Basics). Intent: informational, evergreen.
Definitive explainer of the mechanics (encoding, error correction, static vs. dynamic redirect,
scanning). "How X works" pages are disproportionately cited by AI assistants and anchor the
domain's topical authority; gives every other article an authoritative internal target.
**Validate:** "how do qr codes work", "how does a qr code work".

### #5 — "QR code statistics [2026]" (link-earning / citation asset)
Archetype: `article` (Basics/Reference). Intent: reference; **primary goal is backlinks**, not
ranking traffic. Curated, sourced roundup of adoption/scan statistics; stats pages are reliable
link magnets, which builds the backlink authority the programmatic money pages need.
**Hard requirement:** every figure must cite a real, verifiable primary source (with the link).
A stats page with unverifiable numbers backfires — **do not fabricate any figure.** Needs a
genuine sourcing pass before it can be written; revisit annually (dated title).

---

## Explicitly considered and declined (for now)

- **"Best free QR code generators" listicle** — self-serving, hard to rank objectively, awkward
  to write with the site itself as a contender. Skip.
- **More type/industry money pages** — the site is already deep here (46 built). Marginal SEO
  gain now is editorial/E-E-A-T content that links *into* the existing money pages, which is
  what #1–#5 do. (Genuine page gaps are tracked in FINAL-TAXONOMY's "Planned, not built.")

---

## How to promote an idea from here

1. Validate the `primary` keyword in Semrush (US); record MSV/KD.
2. Write a brief (see `docs/BRIEF-vertical-qr-guide.md` as the format) — section skeleton,
   internal links, meta, schema, voice.
3. Add the `article` object to `src/content/pages.json` + link its `/learn` hub card.
4. If it becomes a durable committed page, add the row to `docs/FINAL-TAXONOMY.md`.
5. `npm run verify`; if any locale is live, add to every bundle (CLAUDE.md rule 9).
