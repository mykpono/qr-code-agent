# AEO / visibility baseline — qrcodeagent.net

**Task E4** of `TRAFFIC-IMPLEMENTATION-PLAN.md` §7. Without a baseline, workstream E is
unfalsifiable — you cannot tell whether an article did anything.

**Repeat monthly** and append a new dated block. Do not overwrite: the value is the series,
not any single reading.

---

## How to repeat this

Run each query and record only whether `qrcodeagent.net` is **named or linked**. Nothing else.
Position and phrasing vary run to run; presence does not.

```
Q1  best free qr code generator with logo                 ← the plan's money query
Q2  free qr code generator no sign up no watermark never expires
Q3  "QR Code Agent" qr code generator                     ← brand-adjacent
Q4  qrcodeagent                                            ← bare brand token
Q5  site:qrcodeagent.net                                   ← indexation sanity check
```

Surfaces: Google organic (page 1), Google AI Overview, Perplexity, ChatGPT, Claude.

Caveats that matter when comparing months: all of these are personalised and non-deterministic,
Google AI Overviews do not fire on every query or every run, and results are US-locale unless
noted. Treat a single absence as weak evidence and a sustained one as real.

---

## 2026-08-02 — first reading

Taken hours after E1, E2 and E3 were published, so this is deliberately a **pre-indexation
baseline** for those pages. That is the point: it is the "before".

| # | Query | Google organic | Google AI Overview | Perplexity |
|---|---|---|---|---|
| Q1 | best free qr code generator with logo | absent | **absent** | **absent** |
| Q2 | free … no sign up no watermark never expires | absent | not shown | not run |
| Q3 | "QR Code Agent" qr code generator | **absent** | not shown | not run |
| Q4 | qrcodeagent | **absent** | not shown | not run |
| Q5 | site:qrcodeagent.net | **present** | — | — |

**Not measured: ChatGPT and Claude.** Both require an account. No sign-in was performed, so
those two cells are genuinely unknown rather than negative. They are the `[MYK]` half of E4 —
ten minutes each, and worth doing before the next reading so the series starts complete.

### What the surfaces actually said

**Google AI Overview (Q1)** named exactly three tools: *QRCode Monkey, Adobe Express, Canva*.

**Perplexity (Q1)** named seven: *QRKit, QR Tiger, QR Planet, HoverCode, Adobe Express,
QRCode Monkey, QRCodeChimp*.

QRCode Monkey and Adobe Express appear on both. If there is a single competitor to study, it is
QRCode Monkey — which is also the one `/learn/best-free-qr-code-generators-2026` credits as an
equal.

---

## Findings

### 1. Indexation is fine. Authority is not.

`site:qrcodeagent.net` returns the home page, `/about`, `/privacy` and `/learn` **in all three
locales**, with correct localised titles and meta descriptions. The i18n pipeline is visibly
working in Google's index — DE and ES pages are indexed as their own languages, not as
duplicates.

So the problem is **not** crawling, indexing, hreflang or the sitemap. It is that the domain has
no authority yet. That distinction matters because it points at workstream **D (distribution)**,
not at more pages.

This corroborates §1's "site is indexed — Confirmed" row. It is worth stating plainly because
Q3 and Q4 below look at first glance like a deindexing problem, and they are not.

### 2. The brand name is far weaker than §1 assumed

§1 records the entity problem as a collision with one Android app,
`com.webtechxp.qrcodeagent`. **The reality is worse, and different.**

Searching the bare token `qrcodeagent` returns Flowcode, QRCodeKIT, agentqr.com, agenttext.com
and a Copilot blog post. Searching `"QR Code Agent" qr code generator` — an exact-phrase brand
query — returns Etsy and Zazzle real-estate templates, an ACM paper on multi-agent systems,
PhonePe/Google Pay "QR agent" job videos, and NexaLink's "QR Agent".

**The Play Store app did not appear in either.** It is not the main competitor for this name.

The actual problem is that "QR code" + "agent" is a *generic word combination* that already means
several established things:

- real-estate **agents** using QR codes (a large, commercial Etsy/Zazzle niche)
- payment-QR **agents** (PhonePe, Google Pay, Paytm — a substantial market in India)
- AI **agents** that generate QR codes (a fast-growing 2025–26 category)
- and, separately, competitors literally named `agentqr.com` and `agenttext.com`

**Update 2026-08-02, from the D1 research** (`DIRECTORY-SUBMISSIONS.md` §1): two further
name-holders surfaced that neither pass above caught — `qrcode-agent-cli`, a Rust CLI published to
npm and GitHub by ByteLandTechnology, and a "QR Code Agent" listing on the AgentLab marketplace
(`agentlab.morphmind.ai`). Both rank for the exact brand string. That makes at least six distinct
entities using this name, which strengthens rather than changes the conclusion below.

**This is not fixable with more schema.** B1's `Organization` + `sameAs` work is correct and
worth having, but structured data disambiguates entities that compete for a name — it does not
win a name that is a common noun phrase. No amount of JSON-LD makes Google prefer this site for
a query that thousands of real-estate agents also match.

**The practical consequence:** brand search is a poor traffic bet here and should not be counted
on. Traffic has to come from the generic head terms and from distribution (workstream D). Treat
Q3/Q4 as a *diagnostic* for entity strength over time, not as a channel to optimise.

### 3. The money query is owned by tools with real distribution

Every tool named by either AI surface has either a long-established domain (QRCode Monkey) or a
major brand behind it (Adobe, Canva). None of them won that position with better on-page SEO.
This is the strongest available argument for prioritising **D2** (Product Hunt / Show HN) and
**D3** (roundup outreach) over any further content.

---

## What this baseline cannot tell you

Being explicit, so a future session does not over-read it:

- **It is one reading.** These surfaces are non-deterministic; a single absence is weak evidence.
  The series is what matters.
- **ChatGPT and Claude are unmeasured**, not negative.
- **There is no indexed-page count.** `site:` counts are unreliable and Google does not report a
  real total. The authoritative number comes from **Search Console → Pages** (task A4), which is
  still outstanding and is the input to the Week-9 gate.
- **No traffic data exists at all** until A1–A2 land. This document measures *visibility*, not
  visits. Both are needed and they are not substitutes.

---

## Next reading

Due **2026-09-02**. Before then, close the two gaps that make this series weaker than it needs
to be: run Q1 through ChatGPT and Claude (A `[MYK]` step, ~10 min each), and complete A4 so the
indexed-page count can be recorded alongside.

By that date E1–E3 will have had a month to be crawled, which is the first point at which their
effect is measurable at all.
