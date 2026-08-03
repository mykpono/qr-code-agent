# Keyword research brief — for API pulls

**Prepared 2026-08-03.** Owner decision, replacing plan open-question 4 ("per-locale KD was never
pulled"). Written to be executed against a keyword API (Semrush, Ahrefs, DataForSEO, Keyword
Planner) **separately from this repo**, then pasted back.

Read §1 first — it says what is already known, so you do not pay for data you have.

---

## 1. What already exists, and what is missing

| | Status |
|---|---|
| **English MSV + KD** | **Have it.** Semrush, 2026-07-20, US database. In `FINAL-TAXONOMY.md` and `SEO-BRIEF.md` §5. Do not re-pull unless refreshing. |
| **Per-locale head-term MSV** | **Have it.** `SEO-BRIEF.md` §8.2 — DE 165k, ID 135k, PT-BR 49.5k, JA 27.1k, PL 9.9k, IT 8.1k, FR 3.6k, UK 3.6k, ES 1.6k. |
| **Per-locale KD** | **MISSING — this is the gap.** Never batch-pulled. All locale prioritisation currently rests on demand alone. |
| **Per-locale CPC / SERP features** | **MISSING.** Needed to judge whether a free tool can win the SERP at all. |
| **RU** | **Not needed.** Locale dropped 2026-08-03. Do not pull. |

**The decision this data serves:** whether to build locales C3–C7 (JA, PL, IT, FR, UK) after the
Week-9 gate, or stop at ID and PT-BR and spend the hours on distribution instead. A high-MSV market
with brutal KD is a worse bet than a smaller, winnable one — and right now that comparison cannot
be made.

---

## 2. The pull

### 2.1 Locales and databases

Pull each head term in **its own country database**, not the US one. Using the wrong database is
the single most common way this data comes back meaningless.

| Locale | DB code | Language |
|---|---|---|
| DE | `de` | German |
| ID | `id` | Indonesian |
| PT-BR | `br` | Portuguese (Brazil) — **`br`, not `pt`** |
| JA | `jp` | Japanese |
| PL | `pl` | Polish |
| IT | `it` | Italian |
| FR | `fr` | French |
| UK | `ua` | Ukrainian — **`ua`, and Ukrainian ≠ Russian** |
| ES | `es` | Spanish (Spain). Optionally also `mx` for LatAm. |

### 2.2 Seed keywords per locale

These are the validated head terms from `SEO-BRIEF.md` §8.2 plus the modifier set. **Do not
machine-translate the English seeds** — search behaviour differs by market, and in several of these
the *English* form carries the volume.

```
DE     qr code generator · qr code erstellen · qr code generator kostenlos ·
       qr code mit logo · wlan qr code · vcard qr code
ID     qr code generator · buat kode qr · pembuat kode qr · qr code gratis ·
       qr code dengan logo · qr code wifi
PT-BR  gerador de qr code · criar qr code · gerador de qr code gratis ·
       qr code com logo · qr code wifi · qr code pix
JA     QRコード生成 · QRコード作成 · qr code generator · QRコード 無料 ·
       QRコード ロゴ · WiFi QRコード
PL     generator kodów qr · generator kodu qr · kod qr za darmo ·
       kod qr z logo · kod qr wifi
IT     crea qr code · generatore di qr code · qr code gratis ·
       qr code con logo · qr code wifi
FR     generateur de qr code · creer un qr code · qr code gratuit ·
       qr code avec logo · qr code wifi
UK     створити qr код · генератор qr кодів · qr код безкоштовно ·
       qr код з логотипом
ES     generador de codigos qr · generador de qr · crear codigo qr ·
       codigo qr gratis · codigo qr con logo
```

### 2.3 Metrics to request

Per keyword, per database:

- **`volume`** — monthly search volume
- **`keyword_difficulty`** — **the point of this pull**
- **`cpc`** and **`competition`** — commercial pressure; a high CPC on a free-tool term means paid
  players are bidding and organic real estate is squeezed
- **`serp_features`** — critical. If the SERP is owned by a free-tool box, a featured snippet or an
  AI Overview, ranking #1 organically may still yield little
- **`intent`** if available — informational vs transactional
- **`results`** — number of competing pages

### 2.4 Also worth pulling, cheaply

- **Top 10 ranking domains per head term, per locale.** This answers "is the first page all
  established SaaS, or is there an indie tool ranking?" more directly than KD does.
- **`qrcodeagent.net` current rankings** in each locale DB — expected to be near-empty, but it is
  the organic counterpart to the `AEO-BASELINE.md` series and worth a baseline row.

---

## 3. Output format to paste back

CSV or JSON, one row per keyword. Column names as below so it can be diffed against the existing
Semrush export in `docs/keyword-validation-semrush.csv`:

```
locale,db,keyword,volume,keyword_difficulty,cpc,competition,serp_features,results,pulled_on
```

Paste the result into `docs/keyword-validation-locales.csv` and add a short summary block to
`SEO-BRIEF.md` §8.2 — that section is the source of truth the plan's §5.1 rollout order reads from.

---

## 4. How to read it when it comes back

The question is **not** "which locale has the most volume" — that is already known and set the
current order. The question is **which of those markets a new, low-authority, free static tool
can actually place in.**

> **Note, 2026-08-03:** **ID is already built and live** (C1), so its KD is now retrospective
> rather than a build decision. PT-BR is next, and the roadmap was reordered by PR #44 — **PL is
> C3, JA is C4 and blocked.** Weight the pull toward **PL, IT, FR, UK**, the locales still
> genuinely undecided.

| Signal | Reading |
|---|---|
| **KD ≤ 30** on the head term | Genuinely winnable. Build the locale. |
| **KD 30–50** | Winnable on long-tail and type pages, unlikely on the head term for a year. Build only if MSV is large. |
| **KD > 50** | The head term is not the goal; target type/use-case pages in that language instead and expect the home page to lag. |
| **High CPC + high KD** | Paid players own it. Worst combination for a free tool with no ad budget. |
| **SERP has a free-tool box / AI Overview** | Organic clicks are being absorbed before the blue links. Weight this heavily — it is the same pattern `AEO-BASELINE.md` found in English. |
| **Top 10 is all established SaaS** | Expect a long climb regardless of what KD says. |

**Decision rule to apply once the data lands:** rank C3–C7 by `volume ÷ difficulty`, not by volume.
If none of them clears the bar that ID and PT-BR cleared, that is a real answer — stop the locale
rollout at two and put the hours into workstream D.

---

## 5. Scope notes

- **Skip RU entirely.** Locale dropped.
- **Skip English.** Already pulled 2026-07-20; re-pull only if refreshing the whole taxonomy.
- **Per-locale KD is the deliverable.** Everything else here is cheap to add in the same request
  and expensive to come back for.
- Rough size: **9 locales × ~6 seeds ≈ 55 keywords**, well inside a single API call on any provider.

---

*Companion docs: `SEO-BRIEF.md` §8.2 (the head terms this extends) · `FINAL-TAXONOMY.md` (English
MSV/KD) · `keyword-validation-semrush.csv` (the 2026-07-20 English export) ·
`TRAFFIC-IMPLEMENTATION-PLAN.md` §5.1 (the rollout order this data should revise).*
