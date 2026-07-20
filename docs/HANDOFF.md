# QR Code Agent — Design Handoff

**For:** Design (layout & visual system) → then Engineering (build)
**Domain:** qrcodeagent.net · **Date:** 2026-07-20
**Goal of this handoff:** everything Design needs to create layouts for a programmatic, 11-language SEO site — without having to re-derive structure, content, or SEO constraints.

---

## 1. What's in the kit

| File / folder | What it is | Consumed by |
|---|---|---|
| `FINAL-TAXONOMY.md` | The full 48-page URL set × 11 languages, with archetype, validated primary keyword, MSV/KD, and sitemap priority. | Design + Dev + SEO |
| `build/pages.json` | **Source of truth.** Site config (nav, footer, languages) + full content for the 13 Phase-1 pages, keyed by archetype. Every string on the page lives here. | Dev (renders pages) + Design (content) |
| `build/render.py` | Turns `pages.json` into per-route HTML. Demonstrates the programmatic model and fixes the Phase-0 "duplicate HTML" blocker. | Dev |
| `build/site/*.html` | **13 rendered wireframes** (Phase-1 pages) — semantic structure + real copy + full `<head>` (title/meta/canonical/hreflang/OG) + embedded JSON-LD. Neutral styling on purpose. | **Design (lay out these)** |
| `build/site/wireframe.css` | The neutral wireframe styling. Replace entirely with the real design system. | Design |
| `build/site/_gallery.html` | Index that links all 13 wireframes for quick review. | Everyone |
| `schema/*.jsonld` | Standalone JSON-LD templates (also embedded in each page). | Dev |
| `sitemap.xml`, `robots.txt` | 528-URL sitemap with hreflang; robots. | Dev/SEO |
| `SEO-BRIEF.md`, `keyword-validation-*` | The strategy + the Semrush validation behind every number. | SEO/PM |

**How to view:** open `build/site/_gallery.html` in a browser, or any of the 13 page files. Each page shows an orange banner (archetype, target keyword, phase) and every content block is labeled — those annotations are for the team and get removed in the real build.

---

## 2. Page archetypes (6 layouts to design)

The 48 pages collapse into **six repeatable layouts**. Design each archetype once; content varies per page but structure does not.

| Archetype | Pages using it | Purpose | Distinct layout needs |
|---|---|---|---|
| **home** | `/` | Head-term landing + full tool + directory of all types/industries | Biggest hero; the tool; a scannable directory grid; SEO intro/FAQ below |
| **feature** | `qr-code-with-logo`, `custom-…`, `svg-…`, `colored-…` | Differentiator landing | Tool with one control emphasized (e.g. logo panel); benefit cards |
| **type** | 19 pages (`wifi`, `vcard`, `menu`, `instagram`, …) | One QR data type + its tool | Tool with **type-specific inputs**; how-to; FAQ. The workhorse layout. |
| **industry** | 12 pages (`…-for-restaurants`, `…-small-business`, …) | ICP hub | Scenario copy + **links down** to the type tools relevant to that industry; usually no unique tool |
| **usecase** | 9 pages (`…-business-cards`, `…-menus`, …) | Use-case guide | Context + a **reused** tool component + links to the canonical type page |
| **learn-index** | `/learn` (+ articles) | Content hub | Article cards; minimal/no tool |

Phase-1 wireframes cover **home, feature, type, and usecase** (industry pages are Phase-1b; learn is Phase-2). Design these four first.

---

## 3. Component inventory (design-system parts)

Build these as reusable components; every page is an assembly of them.

1. **Header / nav** — brand, primary nav (QR types, By industry, With logo, Learn), and a **language switcher** (11 locales — see §7).
2. **Hero** — badge, H1, subhead, trust bar, and the generator (below).
3. **Generator tool** ⭐ *the most important component* — see §4. Three input modes.
4. **Trust bar** — the three product promises (free / never expires / in-browser). Appears in hero and footer.
5. **How-to steps** — a 3-step numbered row (feeds `HowTo` schema).
6. **Benefit cards** — 2×2 grid of short value props, page-specific.
7. **Link chips / directory** — pill links for internal linking; on `home` this becomes a full directory grid grouped by type/industry.
8. **FAQ accordion** — 3–6 Q&As (feeds `FAQPage` schema).
9. **Footer** — 4 link columns + trust line + support link.
10. **Theme switcher** — the 3–4 preview themes in the header (Cream / Olive / Black / dark default), per the reference UI.
11. **Templates panel** — the right-rail preset gallery (16 designs, grouped Social / Creative themes). Selecting a preset sets colors + dot/finder style + sample logo.
12. **Save control** — a "Save design" button by the download CTAs. Phase 1 = local (browser storage), no login. See §4.1.
13. **Support / Donate CTA** — "Buy me a coffee" → Stripe. Header pill, post-download line, footer link. See §4.2.

---

## 4. The generator component (spec — design carefully)

This is the page's reason to exist. For a free QR tool, the tool being **immediately usable above the fold** is the #1 ranking and conversion factor, so it must render server-side (not lazy-load) and be usable without scrolling on mobile.

**Three input modes** (driven by `tool.mode` in `pages.json`):

- **`url`** — single content field (home, feature, most type pages, use cases). Helper text varies per page ("paste your instagram.com link", "paste your Google review link", etc.).
- **`wifi`** — fields: Network name (SSID), Encryption (WPA/WPA2 · WEP · None), Password, Hidden-network toggle. Encodes a `WIFI:` payload.
- **`vcard`** — fields: first/last name, phone, email, company, job title, website, address. Encodes a vCard/MECARD payload.

**Shared controls (all modes):** dot style (star / diamond / circle / square), finder pattern (circle / rounded / square), foreground + background color, output size (256–1024), error correction (L/M/Q/H), logo upload (shape circle/square, optional border), live preview, **Download PNG** + **Download SVG**.

**Matches the reference UI** (from the current build): the tool is a three-region layout — **controls (left) · live preview (center) · templates gallery (right rail)**. The preview carries **status chips** (size, ECC level, finder style, and a live **"✓ Scannable"** validation badge). Design should preserve all of this.

- **Templates gallery (16 presets)** — grouped (Social, Creative themes). Selecting one applies colors + dot/finder style. Design the card, category headers, selected state, and scroll/expand affordance.
- **Theme switcher** — 3–4 header swatches that restyle the whole app (Cream / Olive / Black / default).
- **"Scannable" badge** — real-time validity indicator; design a valid state and an at-risk state (e.g. logo too big / contrast too low).

**States Design must cover:**
- *Empty* (no content yet) — preview shows a prompt, downloads disabled.
- *Live* — preview updates as inputs change; status chips + Scannable badge update too.
- *Logo added* — nudge/notice to raise error correction to Q or H (a logo needs it to stay scannable).
- *Generation retry* — if encoding fails at the chosen level, it retries at H; surface this gracefully.
- *Error / at-risk* — invalid/empty input messaging; "not scannable" badge state.
- *Mobile* — controls, preview, and templates stack; keep Download + Save reachable.

### 4.1 Save & accounts (decided)

- **Phase 1 — local save, no login.** The "Save design" button stores the current design (content + style + logo reference) in **browser storage** (localStorage / IndexedDB) on that device. Zero backend. This **preserves the validated "no sign-up" positioning** (`free qr code generator no sign up` = 4,400 MSV) — the generator must never be gated behind save or login. Design: a Save button, a lightweight "saved designs" list/drawer, and rename/delete. No auth UI this phase.
- **Phase 2 — Google accounts (documented, not built now).** When cross-device sync is worth it, add **Supabase Auth with the Google provider** (OpenID Connect) — the project already has Supabase connected. **Do not hand-roll OAuth** (security anti-pattern). This is where a login button + account menu get designed. Until then, don't design account UI.

### 4.2 Support / donate CTA (decided)

- **Mechanism: Stripe Payment Link** (customer-chosen amount) — a hosted link, **no backend required** for a static site. Config lives in `pages.json → site.support.href` (live link set; `SUPPORT_URL` in `lib/content.js` prefers the `PUBLIC_STRIPE_SUPPORT_URL` env var). *Confirm the current Payment Links setup in Stripe's docs before launch.*
- **Placements (all in the wireframes):** a subtle **header pill** ("☕ Support"), a **post-download "thank you" line** (highest-intent moment — they just got value), and a **footer link**. Keep it friendly and optional; it must not compete with the primary Download CTA or look like an ad.
- **Optional:** a small on-site `/support` (or `/donate`) page can host the link plus a thank-you note — useful for AI/answer-engine citation and as a link target. Not required; the Payment Link works directly.

---

## 5. Block order & content budgets (per money page)

The on-page order is fixed (it's what earns the rankings). Design within these character budgets so real content never breaks the layout:

| Block | Budget / shape | Notes |
|---|---|---|
| H1 | ~30–55 chars | Matches search intent; not the same as `<title>`. |
| Subhead | ~90–140 chars | Value prop + free angle. |
| Generator | — | Above the fold. |
| Trust bar | 3 items | free / never expires / in-browser. |
| Intro | 40–80 words | Contains primary + 1–2 secondary keywords. |
| How-to | exactly 3 steps | Each step = short imperative sentence. |
| Benefits | 4 cards | Heading ≤ 24 chars + 1 sentence. |
| Related / directory | 3–6 chips (home: full grid) | Internal linking — do not omit. |
| FAQ | 3–6 items | Always answer free / expiry / logo. |
| Footer | 4 columns | Full type/industry lists for crawl depth. |

`<title>` ≤ 60 chars and meta description ≤ 155 chars are already written per page in `pages.json` (they affect SERP CTR, not layout).

---

## 6. Interaction & edge cases

- **Text expansion:** German and Russian run ~30% longer than English; Japanese wraps differently. Design H1/subhead/nav/buttons to flex, not truncate.
- **Long titles:** some type names ("Google Review", "App Download") are long — nav and cards must wrap cleanly.
- **The existing app has a dark theme + a light "cream" theme.** You're free to redesign; if you keep a light theme, check contrast on muted text (an existing a11y risk).
- **Above-the-fold tool on mobile:** the current app uses a `420px 1fr` two-column grid — that must collapse to a single usable column on phones (most QR traffic is mobile).
- **RTL:** not in this language set, but if Arabic is added later the layout should be logical-property-based to flip cleanly.

---

## 7. Localization for design (11 languages)

Languages: EN (root) + ES, PT-BR, DE, FR, IT, JA, ID, UK, PL, RU. URL model = subdirectory per locale (`/de/…`).

- **Language switcher** is a required header component (11 entries; labels in `pages.json → site.languages`).
- **Titles lead with the English "QR code" head term in several markets** where it out-searches the native word (ID, JA, DE) — so the H1/title component must accept a locale-specific string, not a machine translation. (Rationale + per-locale terms: `SEO-BRIEF.md` §8.2.)
- Localize **examples and imagery**, not just strings (a Brazilian menu page, an Italian restaurant, etc.).
- Rollout order (so Design can prioritize locale QA): **DE → ID → PT-BR → JA → PL → IT → FR → UK → ES**, RU after its data pull.

---

## 8. Accessibility (bake in, don't retrofit)

- Color contrast ≥ WCAG AA (4.5:1 body, 3:1 large) — the light theme's muted greys are the main risk.
- Tap targets ≥ 44×44 px (mobile tool controls).
- Visible focus states on all inputs, the color pickers, and Download buttons.
- The generator must be keyboard-operable; the preview needs a text alternative describing what the QR encodes.
- Don't rely on color alone to signal the error-correction warning.

---

## 9. How the templates map to the rest

- **Taxonomy → pages:** `FINAL-TAXONOMY.md` lists every URL and its archetype. New pages = new rows in `pages.json`, same archetype, no new layout.
- **Schema → head:** each rendered page embeds the right JSON-LD graph for its archetype (home gets WebSite+Organization+SoftwareApplication; type/usecase get SoftwareApplication+Breadcrumb+HowTo+FAQ). Design doesn't touch this, but the FAQ and How-to **content** you see on screen *is* the schema source — keep them in sync.
- **Sitemap → priority:** `<priority>` in `sitemap.xml` mirrors the phase weighting, so build/design order can follow it top-down.

---

## 10. Design handoff checklist

- [ ] Design the 4 Phase-1 archetypes: **home, feature, type, usecase** (industry + learn next).
- [ ] Design the **generator component** with all three modes, the **templates gallery**, **theme switcher**, **status chips + Scannable badge**, and every state in §4.
- [ ] Design the **Save button + saved-designs drawer** (local, no login — §4.1). No account UI this phase.
- [ ] Design the **Support/Donate CTA** in all three placements (§4.2) — friendly, secondary to Download.
- [ ] Build the **language switcher** and confirm text-expansion behavior (§6–7).
- [ ] Respect the block order and content budgets in §5 (don't drop internal-link blocks).
- [ ] Keep FAQ/How-to visible content aligned with the schema.
- [ ] Meet the a11y bar in §8.
- [ ] Deliver responsive specs (mobile-first; the tool must be usable above the fold on a phone).

**Open items owned elsewhere (not blocking design):** the routing/SSR fix (Eng, `SEO-BRIEF.md` §1), per-locale KD + RU keyword pull (SEO), and translated copy for the 10 non-English locales (content, using `pages.json` as the string source).
