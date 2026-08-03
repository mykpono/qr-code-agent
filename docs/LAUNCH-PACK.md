# Launch pack — Product Hunt + Show HN

**Task D2** of `TRAFFIC-IMPLEMENTATION-PLAN.md` §6. Prepared 2026-08-03.

Both platforms need accounts, so **posting is yours**. Copy is drafted, the site is pre-flighted,
and §6 holds prepared answers to the questions that will actually decide how this goes.

**D2's gate is now met.** It required §3 so a launch spike would be measured — Umami has been live
on all 150 URLs since 2026-08-03 (A1–A3). You will see this launch.

---

## 1. Pre-flight — verified 2026-08-03, production

The one thing that would waste a launch is a spike landing on a broken generator. Checked in a real
browser against the live site:

| Check | Result |
|---|---|
| Generator island hydrates | **yes** — 940×940 preview canvas, `role="img"` |
| Typing a URL regenerates the code | **yes** — aria-label updated to the new URL |
| Self-reported state | *"512 by 512 px, error correction Q, scannable"* |
| Console errors | **zero**, before and after interaction |
| Analytics | Umami firing, `POST /stats/api/send` → 200 |
| All 150 URLs | 200, canonical + hreflang clean (A4 pre-flight) |

**Re-run this the morning of launch**, not just now. `CLAUDE.md` is emphatic about it and a
generator outage has shipped before — it was invisible to the build, the tests and `check-build`.

---

## 2. Timing

- **Product Hunt: 12:01 AM PT**, Tuesday, Wednesday or Thursday. PH days run midnight-to-midnight
  Pacific, so launching later burns hours of your 24-hour window. The **first ~6 hours** set the
  ranking.
- **Show HN: the same week, but not the same hour.** Both threads need you present, and the plan is
  right that the comment thread is where the mentions come from. Splitting them across two days
  means you can actually answer.
- **Block the day.** On PH the expectation is replying within minutes; on HN the first hour decides
  whether the thread lives.

---

## 3. Show HN

Show HN fits this product unusually well: the official bar is that people can *try* it with no
signup or email gate, and that is literally the product's positioning.

**Title** — Show HN titles are plain. No superlatives, no exclamation marks, no "revolutionary".

```
Show HN: Free QR code generator that runs entirely in your browser
```

Alternative if you want the limitation in the title, which HN tends to reward:

```
Show HN: A QR code generator with no server, no signup, and no tracking
```

**Body** (first comment, posted immediately after submitting)

```
I built this because every free QR generator I tried either wanted an account, watermarked
the output, or quietly made the code dynamic so it stopped working when a trial ended.

It runs entirely client-side. The QR is encoded in your browser with qrcode-generator; nothing
you type is sent anywhere, there is no account, and there is no analytics on what you encode.
That matters more than it sounds for the non-URL types — WiFi passwords, vCard contact details,
a private document link.

Codes are static by design. That means they never expire and nobody, including me, can switch
them off. It also means I cannot offer editable destinations or scan analytics, which is the
honest tradeoff and the reason to use something else if you need those.

It does URL, WiFi, vCard, WhatsApp, menus, PDF, review links and a few more, with a logo in the
centre (error correction is raised automatically so it still scans) and PNG or true-vector SVG
export. The site is static Astro; the generator is a React island. Source is on GitHub.

Happy to answer anything about the encoding, the error-correction handling, or why the SVG
logo stays raster.
```

**Why this shape:** it opens with the itch rather than the product, states the limitation before
anyone finds it, and ends by inviting the technical question. HN punishes marketing register far
more than it punishes a modest project.

**Do not:** use the phrase "free QR code generator" as the pitch (the plan flags this as reading
like spam), add emoji, ask for upvotes, or post the same text on both platforms verbatim.

---

## 4. Product Hunt

**Name:** `QR Code Agent`

**Tagline** (max 60 chars — lead with the benefit, not the tech):

```
Free QR codes with your logo. Nothing leaves your browser.
```

*(57 chars.)* Alternatives: `QR codes with your logo — no account, nothing uploaded` (54) ·
`Make a QR code with your logo without signing up` (47).

**Description**

```
QR Code Agent makes styled QR codes with your logo, free and without an account.

Every code is generated in your browser. Nothing you type is uploaded, no account is created,
and no scans are tracked — so it is safe for WiFi passwords and contact details, not just
marketing links.

Codes are static, which means they never expire and cannot be deactivated by anyone. Add a logo
and error correction is raised automatically so the code still scans. Export PNG for screens or
true-vector SVG for print. URL, WiFi, vCard, WhatsApp, menus, PDF, reviews and more, in English,
German and Spanish.

The tradeoff, stated up front: because codes are static you cannot change the destination after
printing or count scans. If you need either, you want a dynamic QR provider.
```

**Topics:** Design Tools · Developer Tools · Privacy · Marketing · Productivity

**Maker comment** — post within a minute of going live; it frames the thread.

```
Hi Product Hunt.

I kept needing a QR code and kept hitting the same wall: sign up, or accept a watermark, or
discover weeks later that the code was dynamic and had stopped working when a trial lapsed. The
last one is the worst, because you find out from a customer standing in front of a poster.

So this does the opposite. It runs entirely in your browser — nothing you type is uploaded and
there is no account. The codes are static, so they never expire and nobody can switch them off,
including me. That is also the honest limitation: I cannot give you editable destinations or
scan analytics, and if you need those you should pay someone who does them properly.

It handles URLs, WiFi, contact cards, WhatsApp, menus, PDFs and review links, with your logo in
the middle and error correction raised automatically so it still scans. PNG or true-vector SVG.

I would genuinely like feedback on the generator UI and on which QR types are missing. Ask me
anything.
```

**Gallery:** the generator with a styled code visible, a logo-embedded code, and the export step.
Whatever you shoot, **make the QR in the screenshot actually scan** — someone will try it.

---

## 5. Before you post

- [ ] Re-run the §1 pre-flight against production
- [ ] Confirm Umami is recording (`POST /stats/api/send` → 200) so the spike lands
- [ ] Skim `/learn/best-free-qr-code-generators-2026` — you will be asked how you compare, and it
      already answers that honestly, including naming QRCode Monkey as an equal
- [ ] Have `/privacy` and `/learn/static-vs-dynamic-qr-codes` open; both come up every time
- [ ] Decide in advance what you will say about monetisation (§6)

---

## 6. The questions that will actually come up

The plan says the comment thread is where the mentions come from. These are the ones worth having
an answer ready for, rather than improvising at 2am.

**"How is this different from QRCode Monkey?"**
> Honestly, not hugely — it is a good tool and also free with no signup. The differences are that
> this runs client-side so nothing you encode is transmitted, and it is open source. If you are
> encoding a marketing URL, either is fine. If you are encoding a WiFi password, the client-side
> part matters.

*Do not disparage it. `/learn/best-free-qr-code-generators-2026` already credits it, and being
caught contradicting your own comparison page is worse than the comparison.*

**"How do you make money / what's the catch?"**
> There is no revenue. There is a tip link. Costs are a domain and static hosting, which is
> affordable precisely because there is no server doing the encoding.

*Answer this plainly and early. Unanswered, it reads as a hidden catch.*

**"Is it really client-side?"**
> Yes, and you can check — open devtools, make a code, and watch the network tab. The source is on
> GitHub. The only outbound request is cookieless analytics on the page itself.

*This is the strongest possible answer because it is verifiable. Invite them to check.*

**"Aren't QR codes patented?"**
> The QR specification is patent-free for use. Denso Wave holds the trademark on the term but has
> not enforced patent rights on the format, which is why it became universal.

**"Why can't I track scans?"**
> Because the code is static — the destination is in the pattern, so there is no server in the
> path to count anything. That is the same property that stops it ever expiring. You cannot have
> one without the other unless you add a redirect, which is what dynamic QR products sell.

**"Why is the logo raster in the SVG?"**
> Because you upload a PNG. The QR pattern itself is true vector and scales cleanly; the logo is
> only as sharp as the file you gave it. Supplying an SVG logo is on the list.

**"What about [type] codes?"** — genuinely useful signal. Write these down; it is the cheapest
roadmap research you will get.

---

## 7. After

- Read Umami the next morning: referrers, top pages, and whether anyone reached `/learn/*`.
- Record the numbers in `AEO-BASELINE.md` as a dated block — a launch is exactly the kind of event
  the Week-9 gate's question 3 ("did distribution produce measurable referral traffic or backlinks?")
  is asking about.
- Re-run `npm run indexnow:submit` if anything shipped during launch week.

---

*Pre-flight verified against production 2026-08-03. Platform mechanics (PH 12:01 AM PT, 60-char
tagline; Show HN title and try-it-without-signup requirement) verified the same day and do change —
re-check before posting.*
