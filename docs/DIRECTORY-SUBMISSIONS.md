# Directory submissions — paste-ready pack

**Task D1** of `TRAFFIC-IMPLEMENTATION-PLAN.md` §6. Prepared 2026-08-02.

Every one of these gates submission behind an account, so **the submitting is yours** — an agent
cannot create accounts or authenticate. Everything else is done: requirements verified, existing
listings checked, copy written to each platform's field lengths. Budget ~15 minutes per site
rather than the plan's 30, because the drafting is already finished.

Work top to bottom. AlternativeTo first — it is free, fastest to approve, and the most cited.

---

## 0. Two corrections to the plan's D1 row

The plan says *"AlternativeTo, SaaSHub, ToolFinder. ~30 min each"* and implies all three are free.

| | Finding |
|---|---|
| **ToolFinder charges $29** | `toolfinder.co` 301-redirects to `toolfinder.com`; submission is a **one-time $29**, human-reviewed, up to 72 hours. Not free, and therefore **a purchase decision, not a task.** See §4. |
| **SaaSHub deprioritises lone submissions** | Its guidance says a submission is *"slowed down and put to the bottom of the queue if there are not listed competitors."* Naming competitors is not optional politeness, it is queue position. Verified they exist — §3 has the list. |

Neither is a reason to skip D1. Both change how you spend the two hours.

---

## 1. Current listing status

Checked 2026-08-02: **not listed on AlternativeTo or SaaSHub.** Both are clean first submissions.

Searching the brand also turned up a fourth and fifth entity collision beyond the Play Store app
already recorded in `AEO-BASELINE.md`:

- `qrcode-agent-cli` — a Rust CLI on npm and GitHub (ByteLandTechnology)
- "QR Code Agent" — a listing on the AgentLab marketplace (`agentlab.morphmind.ai`)
- plus Microsoft Copilot content using "QR Code Agent" generically

This reinforces the baseline's conclusion: the collision is not one rival app, it is that
"QR code" + "agent" is a **generic phrase**. A directory listing helps here in a way schema
cannot — it puts the exact string "QR Code Agent" next to `qrcodeagent.net` on a
high-authority third-party domain, which is precisely the association that is currently missing.

---

## 2. AlternativeTo — free, ~10 min, do this first

**How:** sign up, then User icon (top right) → *Suggest new application*. Free; no paid tier.
Approval is fast and human-moderated.

**Fields**

- **Name:** `QR Code Agent`
- **URL:** `https://qrcodeagent.net`
- **Platforms:** Web (Self-Hosted is also true — the code is on GitHub — but Web is the primary)
- **License:** Free
- **Open source:** Yes — `https://github.com/mykpono/qr-code-agent`

**Short description** (one line)

```
Free QR code generator with logo support. No sign-up, and nothing you type is uploaded.
```

**Full description** (paste as-is)

```
QR Code Agent is a free QR code generator that runs entirely in your browser. Nothing you type is
uploaded to a server, no account is created, and no scans are tracked — which makes it suited to
WiFi passwords, contact details and private links, not just marketing URLs.

Codes are static, so they never expire and cannot be deactivated by anyone, including us. Add a
logo in the centre and error correction is raised automatically so the code still scans. Export a
PNG for screens or a true-vector SVG for print.

Supports URL, WiFi, vCard contacts, WhatsApp, restaurant menus, PDF, Google review links,
Instagram, Facebook, YouTube, Spotify, app downloads, events, phone, SMS, plain text and Bitcoin.
Available in English, German and Spanish.

Honest limitation: because codes are static, you cannot change the destination after printing and
you cannot count scans. If you need either, you want a dynamic QR provider and should expect to
pay for one.
```

**Tags:** `qr-code`, `qr-code-generator`, `privacy`, `no-registration`, `open-source`, `offline`, `svg`

**Mark as an alternative to:** QRCode Monkey · QR Tiger · QR Code Generator (qr-code-generator.com) ·
QRCodeChimp · Canva · Adobe Express · QRStuff · Uniqode

> That last field is the one that earns the traffic. People search "QRCode Monkey alternatives"
> far more than they search this brand — being *on* that page is the entire point of the listing.

---

## 3. SaaSHub — free, ~15 min

**How:** `saashub.com/services/submit`. Free; optional paid promotion you do not need.
Live typically in 1–3 days.

**Fields**

- **Name:** `QR Code Agent`
- **URL:** `https://qrcodeagent.net`
- **Tagline (~60 chars):**

```
Free QR codes with your logo. No sign-up, nothing uploaded.
```

- **Description (~400 chars):**

```
A free QR code generator that runs entirely in your browser — nothing you type is uploaded, no
account, no tracking. Codes are static, so they never expire and nobody can switch them off. Add a
logo with error correction raised automatically, then export PNG or true-vector SVG. Supports URL,
WiFi, vCard, WhatsApp, menus, PDF, reviews and more, in English, German and Spanish.
```

**Categories:** QR Code Tools · Design Tools · Developer Tools · Privacy · Marketing Tools

**Competitors to name — required for queue position.** All verified present on SaaSHub:

```
QRcode-monkey.com · The QR Code Generator · QRCodeChimp · QRStuff · Uniqode · QRCodeLab QR Generator
```

---

## 4. ToolFinder — $29, your call

`toolfinder.co` → `toolfinder.com`. **One-time $29**, no subscription, human review within 72
hours. They reject low-quality and low-security tools; this is neither, so it should pass.

**I have not purchased this and will not.** Spending money is your decision. The prepared copy in
§3 fits their form if you go ahead.

**My honest read: skip it for now.** The plan's rationale for D1 is that directories are *"durable
and themselves cited by LLMs."* AlternativeTo and SaaSHub have that property demonstrably —
they surfaced repeatedly in the AEO research behind `AEO-BASELINE.md`. ToolFinder did not surface
once. Paying $29 for a listing on a site that did not appear in any answer-engine result is a
worse use of the budget than the free options, and it is reversible in the sense that you can
always buy it later once the free listings show whether directory traffic converts at all.

**If you want a third free listing instead,** these are worth checking — flagged as *not verified
in depth*, unlike the two above:

- **OpenAlternative** — indexes open-source alternatives to commercial tools. Strong fit: the repo
  is public and the product is a genuine free alternative to paid QR SaaS.
- **Slant.co** — question-led ("What are the best QR code generators?"), which is the exact
  comparison format the AEO playbook says earns citations.
- **G2 / Capterra** — free vendor listings. Heavier process and review-driven, so slower payoff,
  but both are heavily cited by answer engines.

---

## 5. Rules for every listing

Consistency across these is the entity signal. Get it wrong and you have added a sixth collision
rather than fixed anything.

- **Always "QR Code Agent"** — three words. Never `QRCodeAgent`, which is the colliding Play Store
  app's name. `check-build.mjs` enforces this on the site; nothing enforces it on a form.
- **Always link `https://qrcodeagent.net`** (no trailing path) and, where there is a field for it,
  `https://github.com/mykpono/qr-code-agent`. Those two URLs are what `sameAs` asserts on all 150
  pages — a directory repeating the same pair is exactly the corroboration entity resolution wants.
- **Always state the static-only limitation.** Per the AEO playbook, stated limitations get cited
  over overselling, and a reviewer who finds the caveat already there is far less likely to reject.
- **Never claim scan tracking, dynamic codes, or editable destinations.** The product does not do
  them, and `/learn/static-vs-dynamic-qr-codes` says so publicly.

---

## 6. After submitting

- Record the date and the resulting URL for each listing below. These become the referral sources
  you will look for once A1–A6 make analytics work.
- Re-run the `AEO-BASELINE.md` measurement about a month after the listings go live. Directory
  citations are one of the few levers whose effect on answer engines shows up quickly.

| Directory | Submitted | Live URL | Approved |
|---|---|---|---|
| AlternativeTo | | | |
| SaaSHub | | | |
| ToolFinder ($29) | | | |

---

*Prepared by Claude Code. Requirements and pricing verified 2026-08-02 and change without notice —
re-check the cost line on ToolFinder before paying.*
