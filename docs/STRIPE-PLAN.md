# Stripe integration plan — support / "buy me a coffee"

Scope: the optional donate flow only. **No accounts, no paywall, no backend.** Phase-2
accounts are out of scope here; nothing below needs a Stripe secret key or a server.

## Current state (updated 2026-07-20 — steps 1-5 done)

| Thing | State |
|---|---|
| `site.support.href` in `pages.json` | `https://buy.stripe.com/7sYfZid6e4A7bg670KdUY00` — **live** |
| Header pill | Wired — reads `SUPPORT_URL` |
| Footer line | Wired — reads `SUPPORT_URL` |
| Post-download thank-you | **Built.** Inline, dismissible, fires only after a successful download |
| `PUBLIC_STRIPE_SUPPORT_URL` | **Wired.** `SUPPORT_URL` in `lib/content.js` reads it, falling back to `pages.json` |
| Support click tracking | **Wired.** `support_click` with `placement` = header / footer / faq / post_download |

All four placements are live and tracked.

## Where the link lives

The env var wins; `pages.json` is the fallback. The link is deploy-time config, not
content, so it can be changed in Vercel without a commit:

```js
// lib/content.js
export const SUPPORT_URL =
  import.meta.env.PUBLIC_STRIPE_SUPPORT_URL || SITE.support.href;
```

## Steps — 1-5 done, 6 optional

1. **~~Create the Payment Link~~** — done. Verify these settings in the Stripe dashboard
   if you have not already:
   - Product: one-off, "Support QR Code Agent".
   - Enable **"Let customers choose what they pay"** with a suggested amount (e.g. $5) and
     a minimum (e.g. $1). This is what `site.support.mechanism` already specifies.
   - Turn **off** shipping/address collection — nothing is being shipped.
   - Set the post-payment redirect to a thank-you URL on the site (see step 4).
2. **Set `PUBLIC_STRIPE_SUPPORT_URL`** in Vercel → Environment Variables, Production **and**
   Preview. **← still to do.** Until then the link comes from `pages.json`, which works but
   requires a commit to change.
3. **~~Wire `SUPPORT_URL`~~** — done.
4. **~~Post-download placement~~** — done. Inline under the download row, appears only after
   a successful download, dismissible, and dismissal persists in `qra:supportAsked` so it
   asks once. Never a modal, never blocks the file.
5. **~~Tracking~~** — done. `support_click` fires with `placement` = `header` | `footer` |
   `faq` | `post_download`, to both Umami and (if consented) GA4.
6. **Optional thank-you page.** A `/thank-you` route (noindex) as the Stripe redirect
   target closes the loop and lets you fire a conversion event. Not in the taxonomy, so
   keep it out of the sitemap and add `<meta name="robots" content="noindex">`.

## Constraints to respect

- **Never gate the generator.** The entire positioning is free / no sign-up / never
  expires. A donate prompt that blocks or delays a download contradicts the product and
  the brief's differentiators.
- **`☕` stays the only emoji on the site** (CLAUDE.md §8).
- **Stripe's own page handles all payment data.** The site never sees or collects card
  details — it only links out. Keep it that way; do not embed Stripe Elements for this.
- **Privacy copy.** `/privacy` should mention that following the support link hands you
  off to Stripe, who process the payment under their own policy.

## What this does not cover

Recurring/membership billing, receipts, refunds, or any Phase-2 account system. Those need
a backend and a Stripe secret key, and should be planned separately if the product moves
that way.
