# Design Brief — Multi-Type QR Generator Widget

**For:** Design (Claude Design, Figma, or in-house)
**Product:** QR Code Agent — homepage + type landing pages (`qrcodeagent.net`)
**Deliverable:** Redesigned generator widget that supports all primary QR content types in one surface, while preserving the existing visual language and styling controls.
**Status:** Ready for design · Created 2026-07-31
**Related:** `docs/FINAL-TAXONOMY.md`, `docs/HANDOFF.md`, `design_handoff_qr_generator/README.md`, competitor ref [high-qr-code-generator.com](https://high-qr-code-generator.com/)

---

## 1. Context & problem

### What we have today

The live widget (`Generator.jsx`) is a **styled QR generator** with best-in-class customization: dot shapes, finder patterns, colors, ECC, logo overlay, 36 design presets, UTM builder, save design, PNG/SVG export. It encodes and renders correctly in the browser — nothing is sent to a server.

The **input layer is URL-only.** A single "CONTENT / URL" field sits above the three-column card. Users who want WiFi, contact card, phone, SMS, email, WhatsApp, plain text, or Bitcoin must discover separate landing pages (`/wifi-qr-code`, `/vcard-qr-code`, etc.) where the same widget mounts with a different `mode` prop.

### What's wrong with that

1. **Discovery** — Most competitors ([High QR](https://high-qr-code-generator.com/), brownie.tools, GenQRCode) expose content types in the widget itself. Our styling advantage is hidden behind a URL-only front door.
2. **Cognitive mismatch** — Templates in the right rail (Telegram, Restaurant, Business card) imply use cases, but selecting one only changes style + example URL; it does not switch the input form.
3. **Duplicated journeys** — Nine payload builders already exist in `lib/qr.js` and `ModeFields` in `Generator.jsx`. The product is built; the homepage UX is not.

### Goal

Redesign the **content/input region** of the widget so users can:

1. **Pick a QR content type** (URL, Text, WiFi, Contact, Phone, SMS, Email, WhatsApp).
2. **Fill type-specific fields** that swap in place below the selector.
3. **Apply the same styling, preview, templates, and export** they already have.

**Success looks like:** A user on the homepage can make a WiFi code for their café, a vCard for a business card, or a Google-review link — without leaving the widget or losing their design work.

### Non-goals (this brief)

- Dynamic QR / redirect / scan analytics (contradicts privacy positioning; see D-003).
- Re-skinning the styling panel, templates rail, or app themes (visual language is fixed).
- New payload types not yet in the encoder (Calendar, Geo — see §8 backlog).
- Chrome extension popup (separate brief: `qr-extension/DESIGN-BRIEF.md`).

---

## 2. Product principles (carry forward)

| Principle | Implication for this redesign |
|-----------|-------------------------------|
| **Static, client-side only** | Every type encodes directly into the QR pattern. No "create account to track scans." |
| **Scannable first** | Dense payloads (vCard, long text, WiFi) need density warnings and ECC guidance — design must surface these, not hide them. |
| **Styled, not generic** | Type selector should feel native to the existing card — not a bolt-on toolbar from a commodity generator. |
| **Privacy-forward** | WiFi passwords and contact details stay in-browser. Copy should remind users that static codes embed data visibly (especially WiFi). |
| **SEO pages stay** | Dedicated `/wifi-qr-code` etc. pages remain; they deep-link into the widget with the type pre-selected. |

---

## 3. Content types — scope for v1

### 3.1 Primary types (must design — 8 tabs)

These modes are **fully implemented** in code today. Design conditional forms for each.

| Type | User intent | Encoded payload | Required field(s) | Optional fields |
|------|-------------|-----------------|-------------------|-----------------|
| **URL** | Open a link | `https://…` (+ UTM) | URL | UTM source/medium/campaign/term/content |
| **Text** | Show text on scan | Plain UTF-8 string | Text body | — |
| **WiFi** | Join a network | `WIFI:T:…;S:…;P:…;` | Network name (SSID) | Encryption (WPA/WEP/None), password, hidden network |
| **Contact** | Save to phone contacts | vCard 3.0 | First or last name | Phone, email, company, job title, website |
| **Phone** | Open dialer | `tel:+…` | Phone number | — |
| **SMS** | Open text message | `SMSTO:+…:body` | Phone number | Prefilled message |
| **Email** | Open mail draft | `mailto:…?subject&body` | Email address | Subject, body |
| **WhatsApp** | Open WA chat | `https://wa.me/…?text=` | Phone (with country code) | Prefilled message |

### 3.2 Secondary type (implement in v1 if cheap — already coded)

| Type | Notes |
|------|-------|
| **Bitcoin** | Address + optional amount + label. Lives in `crypto` mode. Can be a "More" item or 9th tab. |

### 3.3 Not separate tabs — keep as URL helpers or template presets

These are **guided URLs**, not new encoders. The template rail or URL-mode helper copy covers them:

Instagram · Facebook · YouTube · Spotify · Google Review · Menu/PDF · App download · Event link · PayPal · Telegram · Zoom

### 3.4 Explicitly out of v1

Calendar (iCal) · Geolocation (`geo:`) · UPI · SEPA payment · Skype · Dynamic QR

---

## 4. User stories

### Core

1. **As a restaurant owner**, I want to switch from URL to WiFi in the same widget so I can print matching menu and guest-network codes without re-styling.
2. **As someone at a conference**, I want a Contact QR with my name, phone, and company so people save me with one scan.
3. **As a marketer**, I want URL mode with UTM fields unchanged so campaign tracking still works.
4. **As any user**, I want to see what my QR will encode (e.g. `tel:+14155550123`) so I trust the output before downloading.
5. **As a mobile user**, I want to pick a type and fill fields without horizontal scrolling or a broken three-column layout.

### Edge / quality

6. **As a user with a long vCard**, I want a warning that the code is dense and ECC should be High — before I print a unscannable code.
7. **As a WiFi host**, I want a clear note that the password is embedded in the QR and readable by anyone who scans it.
8. **As a returning user**, I want "Save design" to remember my **type + fields + style** so I can reload a WiFi preset later.

---

## 5. Information architecture

### 5.1 Desktop (≥ 1120px) — evolve current 3-column card

Keep the existing regions. **Only the top "content row" and its expansion panel change materially.**

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  [QR] Custom QR Codes                                    [cream sand olive slate] │
├──────────────────────────────────────────────────────────────────────────────┤
│  TYPE SELECTOR (new)                                                           │
│  [URL] [Text] [WiFi] [Contact] [Phone] [SMS] [Email] [WhatsApp]  [More ▾]   │
├──────────────────────────────────────────────────────────────────────────────┤
│  CONDITIONAL FIELDS (swaps per type)                    [example tag chip]   │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │  URL:     [ https://qrcodeagent.net                    ] [UTM TRACKING ▾]│  │
│  │  WiFi:    SSID | WPA/WEP/None | password | ☐ hidden                   │  │
│  │  Contact: first | last | phone | email | company | website (grid)      │  │
│  │  … etc                                                                 │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│  Encodes as: tel:+14155550123                              (payload preview)   │
│  [UTM panel — URL only, unchanged]                                           │
├──────────────┬───────────────────────────────┬───────────────────────────────┤
│   CONFIG     │         PREVIEW               │      TEMPLATES RAIL           │
│   (unchanged)│         (unchanged)           │      (unchanged)              │
│   dots       │   live QR + chips             │   Social / Industry / …       │
│   finders    │   PNG / SVG                   │                               │
│   colors     │   Save design                 │                               │
│   size/ECC   │                               │                               │
│   logo       │                               │                               │
│   [GENERATE] │                               │                               │
├──────────────┴───────────────────────────────┴───────────────────────────────┤
│  Support footer (unchanged)                                                  │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Type selector — design decisions to resolve

| Pattern | Example | Pros | Cons |
|---------|---------|------|------|
| **Labeled tabs** | brownie.tools | Clear, accessible | 8 items may wrap on narrow desktop |
| **Icon + label chips** | [High QR](https://high-qr-code-generator.com/) | Scannable, compact | Icons need tooltips for learnability |
| **Segmented + overflow** | Primary 5 visible, rest in "More" | Fits width | Hides types |

**Recommendation:** Icon + short label chips in a single horizontal row; scroll on overflow. Active type uses existing accent (`--accent-ink` / `--accent-soft`). Match uppercase mono label style of current `CONTENT / URL` label — repurpose as `CONTENT TYPE` or per-type field label.

### 5.3 Mobile (≤ 900px)

Follow existing stack order (preview first, controls below) per `app.css` mobile block. **Add:**

1. Type selector: horizontal scroll chips, full width, sticky below header OR above preview.
2. Conditional fields: full-width, single column (vCard grid collapses to 1-col).
3. UTM panel: URL mode only; collapsible as today.
4. Payload preview: single line, truncates with expand.

Reference: resize live site < 900px; do not invent a new mobile paradigm.

---

## 6. Per-type field spec (design + copy)

### URL
- Single line input; placeholder `https://…`
- Auto-prepend `https://` on blur if user omitted scheme
- **UTM TRACKING** toggle + panel — **unchanged**, visible only in URL mode
- Optional: character count not needed

### Text
- **Multiline textarea** (3–4 rows), not single line
- Placeholder: "Any text — shown on the scanner screen"
- Show **character count**; soft warning > 300 chars ("Longer text = denser QR — use High ECC")

### WiFi
- SSID (text)
- Encryption: segmented **WPA · WEP · None** (maps to `nopass`)
- Password (password input; disabled or hidden when None)
- Hidden network: checkbox
- Inline security note (muted caption): "Password is embedded in the code — use a guest network"

### Contact (vCard)
- Grid: First name · Last name · Phone · Email · Company · Website
- v1 keeps 6 fields (matches code). v1.1 may add address, note, multi-phone — **leave vertical space or "add field" pattern for future**
- At least one of first name, last name, phone, or email required to enable export

### Phone
- `type="tel"` input
- Placeholder: international format hint `+1 415 555 0123`
- v1.1: country-code prefix dropdown — **optional in design if timeboxed**

### SMS
- Phone (`tel`) + message (single line or short textarea)
- Phone required

### Email
- To (email) · Subject · Body (short textarea for body)
- To required

### WhatsApp
- Phone (with country code) + prefilled message
- Subtle WhatsApp affordance OK (brand green only in preset thumb, not chrome)

### Bitcoin (if in v1)
- Address · Amount (BTC) · Label
- Warning caption: "Test with your wallet before sharing"

---

## 7. Shared behaviors (all types)

### Payload preview strip
- Below conditional fields, above UTM panel
- Format: `Encodes as:` + monospace truncated string
- Updates live as user types
- For WiFi, mask password in preview (`P:••••••;`) but full password still encodes

### Export gating
- Download PNG / SVG / Generate button **disabled** when `hasContent` is false (already implemented)
- Empty vCard/WiFi scaffolding must not export — design should show disabled state clearly

### Templates rail interaction
- Applying a template updates **style** (colors, dots, finders, ECC, logo) — unchanged
- If template carries `content` + `group` (Industry/Use case presets):
  - **Option A (recommended):** Switch to URL mode and fill URL field
  - **Option B:** Only apply style; leave content — document choice in design spec
- Social presets (Telegram, etc.): apply style + logo; URL mode with example URL unless user overwrites

### Save design
- Must persist: `{ mode, fields, dot, finder, fg, bg, size, ecc, logo… }` — mode already in save entry
- Drawer list should show type badge (e.g. `WiFi · Rain`)

### ECC guidance (new UI element — small)
| Payload density | Suggested default | UI hint |
|-----------------|-------------------|---------|
| Short URL | M | — |
| URL + UTM | Q | Optional chip: "Dense — Q recommended" |
| vCard / WiFi / long text | H | Banner or chip when auto-bumped |

Do not remove manual ECC control — only suggest/auto-select with override.

### Accessibility
- Type chips: `aria-pressed`, keyboard navigable
- Conditional fields: announce type change (`aria-live` polite on preview strip)
- Keep existing `sr-only` live region for QR description

---

## 8. Visual constraints (non-negotiable)

Reuse existing tokens and components — **this is an IA/UX redesign, not a rebrand.**

| Asset | Location |
|-------|----------|
| Color tokens | `src/styles/tokens/colors.css` |
| Theme variants | `src/styles/tokens/themes.css` |
| Widget styles | `src/styles/app.css` |
| Controls | dot/finder swatches, color popovers, ECC cards, logo toggle, segmented buttons — all in `Generator.jsx` |

- Card: max-width 1320px, min-width 1120px desktop, `border-radius: 28px`
- Typography: Space Grotesk (headings), IBM Plex Mono (labels/chips/buttons, UPPERCASE)
- Accent purple: `#6d4dff` / `--accent-ink`
- Preview column: flat white `#ffffff` — unchanged
- Do **not** introduce new fonts, radii, or a second accent color

---

## 9. Competitor references

| Reference | What to borrow | What to avoid |
|-----------|----------------|---------------|
| [high-qr-code-generator.com](https://high-qr-code-generator.com/) | Icon strip for types above input; social logo picker | Cluttered logo wall; dated layout |
| brownie.tools | Tab per type; rich vCard (multi-value); ghost preview | Generic styling |
| GenQRCode | Type list in sidebar | Dynamic QR upsell; account funnels |
| **QR Code Agent (current)** | Styling depth, templates, UTM, themes, save | URL-only input |

**Differentiator to preserve in every mock:** The redesigned input area must still feel like the same product as the screenshot in `design_handoff_qr_generator/` — not a downgrade to a commodity generator with a type dropdown bolted on.

---

## 10. Landing-page integration

Each type page in `pages.json` sets `tool.mode`. Design should show **one widget component** with:

- Homepage: default type **URL**
- `/wifi-qr-code`: type **WiFi** pre-selected, fields empty
- `/vcard-qr-code`: type **Contact** pre-selected
- etc.

Optional query param for marketing: `?type=wifi` — design does not need a separate layout; note for engineering.

Type-specific helper copy (from `pages.json` `tool.note`) appears as muted text under fields or in the example tag chip — not a second headline.

---

## 11. Engineering notes for design handoff

*(Inform layout constraints; not design deliverables.)*

- Payload builders: `src/lib/qr.js` → `buildPayload(mode, fields)`
- Field UI: `ModeFields()` in `Generator.jsx` (lines ~618–672) — extend, don't fork
- Modes today: `url | wifi | vcard | whatsapp | tel | sms | email | text | crypto`
- UTM: `splitUtm` / URL mode only
- i18n: all new strings go in `src/content/ui.json` + locale bundles (D-007)
- Tests: `test/qr.test.mjs` covers all payload formats

---

## 12. Deliverables checklist

### Required mocks

- [ ] Desktop — URL mode (with UTM expanded + collapsed)
- [ ] Desktop — each primary type (8): conditional fields + payload preview
- [ ] Desktop — disabled export state (empty form)
- [ ] Desktop — density warning state (long text or full vCard)
- [ ] Mobile — URL + WiFi + Contact (representative stack)
- [ ] All 4 app themes applied to at least one desktop + one mobile screen

### Spec annotations

- [ ] Type selector component: dimensions, active/inactive states, overflow behavior
- [ ] Field grid breakpoints (Contact 3-col → 1-col)
- [ ] Payload preview: typography, truncation, password masking
- [ ] Interaction note: template apply vs type switch
- [ ] Redlines only where deviating from existing tokens (aim for zero)

### Optional (v1.1)

- [ ] Bitcoin / "More" menu expanded
- [ ] Country-code picker for Phone / SMS / WhatsApp
- [ ] Rich vCard (address, note, +phone)

---

## 13. Acceptance criteria (for design sign-off)

1. A user can identify and select all 8 primary content types without leaving the widget.
2. Only fields relevant to the active type are visible; UTM appears **only** for URL.
3. Styling panel, preview, templates rail, save, and export match current fidelity — no regressions.
4. Mobile layout remains usable at 375px width; no horizontal page scroll.
5. WiFi security note and dense-payload ECC hint are present in mocks.
6. Visual language matches existing Cream-theme card (tokens, type, radii, purple accent).
7. Dedicated landing pages are explainable as "same widget, type pre-selected" — no second component.

---

## 14. Phased rollout (suggested)

| Phase | Design scope | Engineering |
|-------|--------------|-------------|
| **v1** | 8 primary types + payload preview + mobile reflow | Wire `ModeFields` to homepage; type selector component |
| **v1.1** | Bitcoin, country picker, richer vCard | Extend `buildPayload` + fields |
| **v2** | Calendar, Geo (if validated demand) | New modes |

---

## 15. Open questions (resolve in design review)

1. **Template + content:** When user picks "Restaurant" template, switch to URL with example menu link, or style-only?
2. **Type selector labels:** Full words ("Contact") vs abbreviations ("vCard") — SEO pages say "vCard"; users say "contact card."
3. **Text mode textarea:** Fixed height vs auto-grow — cap before preview column jumps.
4. **Bitcoin:** 9th tab vs under "More" — competitor visibility vs clutter.
5. **Default type on homepage:** Stay URL, or remember last-used type in `localStorage`?

---

## 16. Reference files

| Thing | Path |
|-------|------|
| Widget component | `src/components/Generator.jsx` |
| Payload encoding | `src/lib/qr.js` |
| Widget CSS + mobile | `src/styles/app.css` |
| UI strings | `src/content/ui.json` |
| Page modes | `src/content/pages.json` → `tool.mode` |
| v5 visual spec | `design_handoff_qr_generator/README.md` |
| Type taxonomy + SEO | `docs/FINAL-TAXONOMY.md` |
| Live site | https://qrcodeagent.net |
| Competitor | https://high-qr-code-generator.com/ |
