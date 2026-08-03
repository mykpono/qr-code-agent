# Content Brief — "Why [Vertical] Should Use QR Codes" (Learn article template)

Status: **ready to write** · Owner: content · Created 2026-07-21
Archetype: `article` (Learn hub) · Section-order and JSON shape mirror `/learn/restaurant-qr-code-guide`.

---

## 1. What this is and why it exists

A **reusable Learn-article template** that pairs an editorial guide with each industry
(ICP) hub — exactly the pattern already proven by `/qr-codes-for-restaurants` (money page)
+ `/learn/restaurant-qr-code-guide` (editorial). The idea is to replicate that pairing for
the verticals that already have a **generator preset and/or an ICP hub but no editorial
guide**.

**SEO purpose (be honest about what this does and does not do):**

- This is a **topical-authority + internal-link play, not a head-term play.** The restaurant
  guide itself carries `msv: null` — these are long-tail/informational pages. Do not expect
  big standalone volume; expect them to (a) rank for a spread of long-tail "how to use qr
  codes in a [vertical]" queries, (b) feed internal links down into the type/usecase/ICP
  money pages that *do* have volume, and (c) give AI answer engines (ChatGPT/Perplexity/
  Google AI Overviews) a citable, well-structured source — the GEO surface.
- Each guide is deep editorial content (target **1,300–1,800 words**, the 8–12 min band your
  deepest articles sit in) which is where the site's E-E-A-T lives.

**What this template must NOT do:** duplicate the restaurant guide, or cannibalize the ICP
hub. The guide is *informational* ("how / why / where"); the hub is the *tool page*. Keep the
guide pointing readers to the hub and the type pages, not competing with them for the same
query.

---

## 2. URL, slug, and where it goes

- Slug pattern: **`learn/[vertical]-qr-code-guide`** (matches `learn/restaurant-qr-code-guide`).
- Add as an `article` object in **`src/content/pages.json`** — no new template needed
  (`Page.astro` already has the `article` branch). Per CLAUDE.md rule 7, copy lives in
  `pages.json`, not templates.
- Add the card to the `/learn` hub grid (category `By industry`) so it is linked — the hub
  must have no orphaned or "coming soon" entries (BACKLOG P1 convention).
- **Localization gate (CLAUDE.md rule 9 / D-007):** production is EN-only today, so a new
  EN article is fine. But once DE/ES (or any locale) merge, this article must be added to
  **every** live locale bundle in the same change, or it publishes English under the locale
  prefix with false hreflang. Do not ship a partial bundle.

---

## 3. The JSON object to fill (per-field guidance)

Drop this shape into `pages.json` `pages[]`. Fields mirror the restaurant guide exactly.

```jsonc
{
  "slug": "learn/[vertical]-qr-code-guide",
  "archetype": "article",
  "phase": "2",
  "primary": "how to use qr codes in a [vertical]",   // VALIDATE in Semrush first (see §6)
  "msv": null,                                          // fill from Semrush; null = long-tail, unvalidated
  "kd": null,
  "secondaries": [ /* 3–5 long-tail variants — the questions this vertical actually asks */ ],
  "cat": "By industry",
  "reading": "8–10 min read",
  "updated": "July 2026",
  "published": "YYYY-MM-DD",
  "updated_iso": "YYYY-MM-DD",
  "title": "…",        // ≤60 chars, unique (CLAUDE.md rule 6)
  "meta": "…",         // ≤155 chars, concrete, no hype
  "h1": "…",           // sentence case, Space Grotesk
  "subhead": "…",      // one line: the promise of the piece
  "sections": [ /* see §4 skeleton */ ],
  "related": [ /* the type/usecase/ICP money pages this vertical links to — see §5 */ ],
  "cta_href": "/[the single most relevant type page]",
  "faq": [ /* 5 Q&A, drives FAQPage schema */ ],
  "schema": ["Article", "BreadcrumbList", "FAQPage"]
}
```

---

## 4. Reusable section skeleton

Nine sections, generalized from the restaurant guide. Keep the *structure*; swap the
vertical-specific specifics. Each section is `{ "h": ..., "p": [...], "list"?: [...],
"callout"?: ..., "table"?: {head, rows} }`.

1. **The [N] codes worth having** — name the 2–4 codes this vertical actually needs and the
   moment each one serves. Resist listing every possible code; the restaurant guide's power
   is that it says "exactly three." Include a `list` of code → where it goes.
2. **Point the [primary] code at a link you control** — the static / never-expires / no-
   subscription argument. Encode an address the owner controls; change the content behind it,
   never the filename. Include the `callout` hammering "encode an address you control." This
   section is the differentiator defense (ties to idea #2 in the roadmap).
3. **Where each code belongs** — placement as a function of scan distance, with the
   **placement × scan-distance × minimum-size `table`**. Reuse the restaurant guide's size
   rule of thumb (code ≈ 1/10 the scan distance; 2.5 cm floor for hand-held).
4. **Print size, quiet zone and durability** — 2.5 cm floor, 4-module quiet zone, matte-not-
   gloss laminate, SVG to the printer, ECC Q/H if there's a logo. This section is near-
   identical across verticals — reuse it and adjust surfaces (table tent vs. gym wall vs.
   salon mirror station).
5. **[Vertical's highest-value code], done right** — the deep dive on the one code that
   matters most for this vertical (WiFi for cafes, booking link for salons/gyms, donation
   link for nonprofits, order-ahead for food trucks). Include its honest caveat (e.g. WiFi
   password is plain text → guest network only).
6. **Reviews: ask at the right moment** — timing is everything; where the review code belongs
   for this vertical's customer journey. Include the Google no-incentivized-reviews caveat.
7. **Test from a real [seat/station] before you print a run** — test the laminated proof not
   the screen, two phones (one 3+ yrs old), in real lighting, check the destination on mobile
   data. Include the `list` checklist.
8. **Keep a non-QR fallback** — accessibility + legal (digital-only menus/forms have been
   challenged under US/EU/UK accessibility rules). A QR code is the convenient option, never
   the only one.
9. **What a static code cannot do** — honest trade-off: can't be edited after download, can't
   count scans; why neither hurts if set up per §2 above; and the payoff — no subscription,
   nothing to expire. Closes the differentiator loop.

FAQ: 5 questions, each answerable in 2–3 sentences, drawn from the section content (this is
what powers the FAQPage rich result). Mirror the restaurant guide's FAQ style.

---

## 5. Internal-linking map (the real SEO value)

Each guide should link **down** to the money pages relevant to that vertical. Suggested
`related[]` + inline links per vertical (all are already-built pages — verify slugs against
`pages.json` before linking):

| Vertical | ICP hub | Primary type pages to link | cta_href |
|---|---|---|---|
| Coffee shops | (build `/qr-codes-for-coffee-shops`; preset exists) | `/menu-qr-code`, `/wifi-qr-code`, `/google-review-qr-code`, `/instagram-qr-code` | `/menu-qr-code` |
| Gyms | (build `/qr-codes-for-gyms`; preset exists) | `/vcard-qr-code`, `/instagram-qr-code`, `/google-review-qr-code`, `/pdf-qr-code` (waivers) | `/instagram-qr-code` |
| Salons & spas | (build `/qr-codes-for-salons-spas`; preset exists) | `/instagram-qr-code`, `/google-review-qr-code`, `/whatsapp-qr-code`, `/url-qr-code` (booking) | `/google-review-qr-code` |
| Food trucks | (build `/qr-codes-for-food-trucks`; preset exists) | `/menu-qr-code`, `/instagram-qr-code`, `/url-qr-code` (order-ahead), `/google-review-qr-code` | `/menu-qr-code` |
| Nonprofits | (build `/qr-codes-for-nonprofits`; preset exists) | `/url-qr-code` (donate), `/crypto-qr-code`, `/event-qr-code`, `/vcard-qr-code` | `/url-qr-code` |
| Retail | `/qr-codes-for-retail` ✅ | `/qr-codes-for-packaging`, `/google-review-qr-code`, `/instagram-qr-code`, `/app-download-qr-code` | `/qr-codes-for-packaging` |
| Real estate | `/qr-codes-for-real-estate` ✅ | `/vcard-qr-code`, `/url-qr-code` (listing), `/pdf-qr-code` (brochure) | `/vcard-qr-code` |
| Hotels | `/qr-codes-for-hotels` ✅ | `/wifi-qr-code`, `/menu-qr-code`, `/google-review-qr-code` | `/wifi-qr-code` |

Note: the six verticals whose ICP hub is not yet built (coffee shops, gyms, salons, food
trucks, nonprofits + bars) already have **generator presets shipped** per FINAL-TAXONOMY.
Ideally build the hub and the guide together so the guide has a hub to link to; if sequencing
forces a choice, the guide can link to the type pages alone and add the hub link later.

---

## 6. Which vertical to write first (validate before committing)

I have **no validated demand** for the "how to use qr codes in a [vertical]" keyword for any
of these — treat every `primary`/`secondaries` above as a hypothesis to check in Semrush (US)
before writing, the same way FINAL-TAXONOMY treats its unbuilt rows. The restaurant guide
targets `how to use qr codes in a restaurant` with `msv: null`, so expect these to be
low-but-real long-tail.

Recommended first three, by strength of internal-link fit and adjacency to your strongest
existing content (menu/WiFi/review), **pending validation**:

1. **Coffee shops** — nearest neighbour to the restaurant/menu content; `menu qr code` (MSV
   1000) and the existing `/learn/wifi-qr-codes-cafes-hotels` article give it a strong link
   neighbourhood. Highest confidence.
2. **Salons & spas** — booking + reviews + Instagram is a clean, distinct use-case story.
3. **Gyms** — schedules, waivers (PDF), membership; distinct enough to avoid overlap.

Do NOT write a second "restaurant" angle — that query is already served; a near-duplicate
would risk cannibalization (the same risk FINAL-TAXONOMY flags for `/qr-codes-for-reviews`
vs `/google-review-qr-code`).

---

## 7. Voice & mechanics checklist (CLAUDE.md rule 8 + observed house style)

- Sentence-case headings in Space Grotesk; UPPERCASE monospace only for labels/buttons/chips.
- Lead with **free / no-sign-up / never-expires**; `☕` is the only emoji.
- British spelling is the house style in existing articles (colour, laminate, centre) — match it.
- Concrete over abstract: real distances, sizes, surfaces. State honest trade-offs (the
  "What a static code cannot do" section is a feature, not a hedge).
- No invented statistics. If a claim needs a number, it must be verifiable or cut.
- Title ≤60, meta ≤155, self-referencing canonical, JSON-LD `["Article","BreadcrumbList","FAQPage"]`.
- Before it ships: `npm run verify`, and confirm the `/learn` card links correctly.

---

## 8. Worked example — Coffee shops (fill-ready draft spec)

```jsonc
{
  "slug": "learn/coffee-shop-qr-code-guide",
  "archetype": "article",
  "phase": "2",
  "primary": "how to use qr codes in a coffee shop",   // VALIDATE (Semrush US) before writing
  "msv": null,
  "kd": null,
  "secondaries": [
    "qr code for coffee shop menu",
    "cafe wifi qr code",
    "loyalty qr code coffee shop",
    "where to put qr code on a coffee cup"
  ],
  "cat": "By industry",
  "reading": "8 min read",
  "title": "How to Use QR Codes in a Coffee Shop",           // 34 chars
  "meta": "The three QR codes a cafe actually needs — menu, WiFi and loyalty — where to place each on the counter or cup, and how to keep them scanning.",
  "h1": "How to use QR codes in a coffee shop",
  "subhead": "Three codes, a counter, and a paper cup: where each one goes and the print details that decide whether a customer scans before their coffee's ready.",
  "sections": [
    /* 1 */ "The three codes worth having — menu, guest WiFi, loyalty. (Reviews optional as a 4th.)",
    /* 2 */ "Point the menu code at a link you control — static, never expires, no subscription.",
    /* 3 */ "Where each code belongs — counter card, cup sleeve, window; placement×distance×size table.",
    /* 4 */ "Print size, quiet zone, durability — 2.5 cm floor, matte laminate, cup vs. card surfaces.",
    /* 5 */ "Guest WiFi, done right — the highest-value cafe code; plain-text password → guest network only.",
    /* 6 */ "Loyalty without an app — point at a simple web loyalty/reorder page you control.",
    /* 7 */ "Reviews: ask on the sleeve or receipt, not the door.",
    /* 8 */ "Test from the counter before you print a run — two phones, real lighting, mobile data.",
    /* 9 */ "What a static code cannot do — no edits after download, no scan counts; the trade for no subscription."
  ],
  "related": ["/menu-qr-code", "/wifi-qr-code", "/google-review-qr-code", "/instagram-qr-code"],
  "cta_href": "/menu-qr-code",
  "faq": [
    "How many QR codes does a coffee shop need? — Two or three: menu and guest WiFi always; loyalty/review if you run one.",
    "What size QR code fits on a coffee cup or sleeve? — 2.5 cm minimum; a cup curves, so 3 cm and a flat printed area scan more reliably.",
    "Can I change my menu without reprinting the cups? — Yes, if the code points to an address you control; change the page, not the URL.",
    "Is a WiFi QR code safe for a cafe? — Use it for a guest network only; the password is stored as readable text in the pattern.",
    "Do QR codes on cups expire? — A static code never expires and has no subscription; it works as long as the page it points to exists."
  ],
  "schema": ["Article", "BreadcrumbList", "FAQPage"]
}
```

(The `sections`/`faq` above are one-line specs; expand each to full `{h,p[],list?,callout?,
table?}` prose at the depth of the restaurant guide before shipping.)

---

## 9. Acceptance checklist

- [ ] `primary` keyword validated in Semrush (US); `msv`/`kd` filled or consciously left null.
- [ ] 1,300–1,800 words, 9 sections + 5-item FAQ, all in `pages.json`.
- [ ] Unique title ≤60, meta ≤155, canonical + hreflang correct, schema graph emits Article+FAQPage.
- [ ] `related[]` and inline links point only to existing pages (verified against `pages.json`).
- [ ] `/learn` hub card added, `By industry` category, no orphan/"coming soon".
- [ ] No duplication of the restaurant guide's query; no cannibalization of the ICP hub.
- [ ] `npm run verify` clean; article renders, links resolve.
- [ ] If any locale is live at ship time: added to every live bundle (rule 9) — no partial bundle.
