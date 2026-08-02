// Generate the Open Graph / Twitter preview card.
//
//   npm run build && npm run og   →  public/assets/og.png   (1200x630)
//
// ONE image, shared by every page and every locale: a picture of the generator
// itself. Base.astro points every og:image and twitter:image at it.
//
// Why one and not per page: the card's job in a Telegram or Slack unfurl is to
// show what the product IS. The title and description already render beside it
// as text, so a per-page headline in the image mostly repeats them — and
// per-page art multiplies into per-locale art the moment a translation ships.
// A single product shot says more and never drifts out of sync.
//
// WHY A REAL SCREENSHOT AND NOT A DRAWING
// This script used to hand-draw the widget as SVG so resvg could rasterize it
// during the Vercel build, with no browser needed. That worked exactly until
// the widget changed. The card kept advertising the retired three-column
// layout through both the multi-type redesign (#15) and the 2026-08 handoff
// rebuild (#20): the shipped image showed a UI the site no longer had, on every
// page, in every language, for months. Nothing caught it, because a drawing
// cannot go stale loudly. So the art is now a screenshot of the real widget in
// a real browser — it cannot depict a layout that does not exist.
//
// THE TRADE, AND WHAT IT COSTS YOU
// Vercel's build container has no Chromium, so this can no longer run there.
// It is out of `npm run build`, and public/assets/og.png is COMMITTED rather
// than generated. After any visible change to the generator widget, run
//
//     npm run build && npm run og
//
// and commit the new public/assets/og.png. check-build.mjs asserts the file is
// served (an earlier version of this card 404'd on every page for weeks), but
// nothing can assert it is CURRENT — that part is on you.
//
// The Organization logo used to ride along in this file to share the font
// plumbing; it stayed browser-free and moved to scripts/gen-logo.mjs, which is
// what `npm run build` still calls.
//
// It shoots the built dist/ via `astro preview`, not the dev server, so the
// card is a picture of what production actually serves.

import { spawn } from 'node:child_process';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { Resvg } from '@resvg/resvg-js';

const W = 1200, H = 630;          // the OG card
const SITE = 'https://qrcodeagent.net';
const PORT = Number(process.env.OG_PORT) || 4398;
const TOP = 18;                   // cream showing above the shot
const PAGE_BG = '#e8e0cf';        // --page, cream theme (src/styles/tokens/themes.css)
const SURFACE = '#faf6ec';        // --surface, behind the shot while it rasterizes

// fileURLToPath, not .pathname — the project path contains a space, which
// .pathname leaves percent-encoded and fs then fails to find.
const ROOT = fileURLToPath(new URL('../', import.meta.url));

if (!existsSync(`${ROOT}dist/index.html`)) {
  console.error('dist/ not found — run `npm run build` first, then `npm run og`.');
  process.exit(1);
}

/** Boot `astro preview` on PORT and resolve once it answers. */
async function serve() {
  const child = spawn('npm', ['run', 'preview', '--', '--port', String(PORT)], {
    cwd: ROOT, stdio: 'ignore',
  });
  const url = `http://localhost:${PORT}/`;
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(url)).ok) return child;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  child.kill();
  throw new Error(`astro preview did not answer on ${url} within 60s`);
}

/**
 * Screenshot the generator widget from the home page.
 *
 * Returns the raw PNG plus the CSS-pixel geometry it was taken at, so compose()
 * can scale it without hardcoding the widget's size — the card is capped at
 * 1280 wide today (#22) and that cap has already moved once.
 */
async function shootWidget() {
  const browser = await chromium.launch();
  try {
    // Wide enough that the widget lays out side-by-side (it stacks below
    // 1200px — see the breakpoint in app.css) and tall enough that nothing
    // waits below the fold while the QR renders.
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1600 },
      deviceScaleFactor: 2,
      colorScheme: 'light',
    });
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });

    const widget = page.locator('.genflag');
    await widget.waitFor({ state: 'visible' });
    // The real encoder's output canvas. Waiting on it is what proves the island
    // hydrated — a card shot before hydration is a picture of dead SSR markup,
    // which is the exact failure e2e/smoke.spec.mjs exists to catch.
    await widget.locator('canvas[role="img"]').first().waitFor();

    // Put the site's own URL in the field so the code in the card actually
    // scans to the site, the way the hand-drawn version did.
    await widget.locator('input').first().fill(SITE);
    // fill() focuses the field, and .genflag input:focus paints a violet ring
    // plus a 3px glow. In a still image that reads as an error state, not as a
    // cursor, so hand focus back to the body before shooting.
    await page.evaluate(() => document.activeElement?.blur());
    await page.waitForTimeout(700);   // debounce + canvas redraw

    const geom = await page.evaluate(() => {
      const root = document.querySelector('.genflag');
      const r = root.getBoundingClientRect();
      const mat = root.querySelector('.gf-mat')?.getBoundingClientRect();
      return {
        x: r.left + scrollX,
        y: r.top + scrollY,
        width: r.width,
        // Crop just below the QR itself. The widget is taller than it is wide
        // (~1280x1320) and a 1.9:1 card cannot hold that at a readable size —
        // but everything that says what the product IS lives above the code:
        // the brand bar, the type tabs, the content field, the templates, the
        // style controls. What gets cut is the frame picker and the download
        // row. If .gf-mat is ever renamed, this falls back to a 1.55:1 crop
        // rather than silently shooting the whole 1320px column.
        //
        // The margin is deliberately tight. The card bleeds off its bottom edge
        // (see compose()), and the frame's "SCAN ME" banner sits immediately
        // under the matrix — a looser crop cuts that banner through the middle
        // of its text, which reads as a broken image rather than as a bleed.
        // Ending inside the frame's white gutter keeps the cut clean.
        height: mat ? mat.bottom - r.top + 12 : r.width * 0.65,
        radius: parseFloat(getComputedStyle(root).borderTopLeftRadius) || 24,
      };
    });

    const png = await page.screenshot({
      clip: { x: geom.x, y: geom.y, width: geom.width, height: geom.height },
    });
    return { png, geom };
  } finally {
    await browser.close();
  }
}

/** Lay the shot on the cream page background, clipped to the widget's radius. */
function compose({ png, geom }) {
  const scale = (H - TOP) / geom.height;
  const w = geom.width * scale;
  const x = (W - w) / 2;
  const r = geom.radius * scale;
  const href = `data:image/png;base64,${png.toString('base64')}`;

  // The shot runs off the bottom edge of the card rather than stopping short of
  // it: the widget continues past the frame, which reads as "there is more
  // here" instead of as a crop. Hence the clip rect overshooting by r — only
  // the top two corners should round.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <clipPath id="card"><rect x="${x}" y="${TOP}" width="${w}" height="${H - TOP + r}" rx="${r}"/></clipPath>
    <filter id="lift" x="-25%" y="-25%" width="150%" height="150%">
      <feDropShadow dx="0" dy="16" stdDeviation="20" flood-color="#3c2850" flood-opacity="0.20"/>
    </filter>
  </defs>
  <rect width="${W}" height="${H}" fill="${PAGE_BG}"/>
  <rect x="${x}" y="${TOP}" width="${w}" height="${H - TOP}" rx="${r}" fill="${SURFACE}" filter="url(#lift)"/>
  <image href="${href}" x="${x}" y="${TOP}" width="${w}" height="${H - TOP}"
         preserveAspectRatio="xMidYMin slice" clip-path="url(#card)"/>
</svg>`;
}

const server = await serve();
try {
  const shot = await shootWidget();
  mkdirSync(`${ROOT}public/assets`, { recursive: true });
  const png = new Resvg(compose(shot), { fitTo: { mode: 'width', value: W } }).render().asPng();
  writeFileSync(`${ROOT}public/assets/og.png`, png);
  console.log(`wrote public/assets/og.png (${W}x${H}, ${Math.round(png.length / 1024)} KB)`);
  console.log(`  from a ${Math.round(shot.geom.width)}x${Math.round(shot.geom.height)} shot of the live widget`);
  console.log('  COMMIT IT — this does not run on Vercel.');
} finally {
  server.kill();
}
