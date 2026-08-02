# QR Code Agent

**A free QR code generator with logo support — no sign-up, no watermark, no expiry.**

### → [qrcodeagent.net](https://qrcodeagent.net)

Every code is generated **entirely in your browser**. Nothing you type is uploaded, no
account is created, and no scans are tracked. Download a PNG for screens or a true-vector
SVG for print.

## What it makes

URL · WiFi · vCard contact · WhatsApp · restaurant menu · PDF · Google review · Instagram ·
Facebook · YouTube · Spotify · app download · event · phone · SMS · plain text · Bitcoin

Style the dots and finder patterns, set your own colours, and drop a logo in the middle —
with error correction raised automatically so the code still scans.

## Honest limitations

- **The codes are static.** The destination is encoded into the pattern itself, so it
  cannot be edited after you download it — and it also cannot stop working when some
  service shuts down or starts charging. That is the trade.
- **No scan analytics**, for the same reason. Tracking would require routing every scan
  through a server, which is exactly what this tool avoids.
- A logo in an SVG export stays raster (you supply a PNG); the QR pattern itself is
  true vector.

If you need editable destinations or scan counts, you need a *dynamic* QR product — this
is not one, and [`/learn/static-vs-dynamic-qr-codes`](https://qrcodeagent.net/learn/static-vs-dynamic-qr-codes)
explains the difference.

---

## For developers

Astro (static output) + React islands, deployed on Vercel. The site is 47 pages rendered
as unique static HTML, currently live in **3 of 11 declared locales** (en, de, es) for 141
URLs. Encoding uses [`qrcode-generator`](https://www.npmjs.com/package/qrcode-generator).

```bash
npm install
npm run dev        # http://localhost:4321
npm run verify     # tests + build + dist checks — run before every push
npm run test:e2e   # Playwright: boots dist/ and proves the generator hydrates
```

### Layout

| Path | What it is |
|---|---|
| `src/content/pages.json` | Content source of truth — site config + all 47 pages |
| `src/content/i18n/<loc>.json` | Per-locale translation bundles (a locale goes live by existing) |
| `src/lib/qr.js` | Pure QR logic — encoder, styling, SVG export. Testable, never forked into the component |
| `src/lib/content.js` | hreflang alternates, JSON-LD graph, `LIVE_LOCALES` |
| `src/components/Generator.jsx` | The widget (React island) |
| `src/pages/[...slug].astro` | One static route per page |
| `scripts/check-build.mjs` | Post-build verification of `dist/` |

### Two rules that have bitten before

1. **After changing `Generator.jsx` or `lib/qr.js`, load a page in a real browser.** A
   green build and a green unit suite once shipped a hydration crash that took the
   generator off every page — Astro never evaluates the island at build time.
2. **Never merge a partial locale bundle.** Missing slugs silently serve English content
   under a locale prefix while hreflang claims otherwise. `npm run i18n:merge` enforces
   this; do not bypass it.

More detail in `CLAUDE.md` (golden rules), `NEXT-PHASES.md` (engineering state) and
`docs/`.

Created by [Myk Pono](https://www.linkedin.com/in/mykolaponomarenko).
