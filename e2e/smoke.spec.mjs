import { test, expect } from '@playwright/test';

// The generator is a `client:load` React island (src/components/Generator.jsx).
// It renders fine at build time (Astro never evaluates the island then) and its
// pure logic is unit-tested (src/lib/qr.js), so a crash *during hydration* slips
// past `npm test`, `npm run build` and `check-build.mjs` alike. That is exactly
// what happened when `drawMod` was left unexported: the island threw a
// ReferenceError while hydrating, React unmounted it, and the generator vanished
// from every page for 18 minutes with all of CI green (see NEXT-PHASES.md).
//
// These tests boot the built site in a real browser and prove the island both
// mounts AND stays mounted AND responds to input — the three things a hydration
// crash breaks. The zero-error assertion is the primary catch; the interactivity
// assertion proves React actually took over, not just that SSR markup is present.

// Every archetype that carries the generator (CLAUDE.md §5). The outage hit all
// of them at once, but they compose the island through different Page.astro
// branches, so a per-archetype wrapper regression would only show on some.
const TOOL_PAGES = [
  { url: '/', name: 'home (money page)' },
  { url: '/wifi-qr-code', name: 'type page' },
  { url: '/qr-codes-for-restaurants', name: 'industry page' },
];

// Console noise that is not an app fault. Keep this list SHORT and specific —
// every entry is a blind spot. A blanket "ignore 404s" would have hidden nothing
// about the real bug, so nothing that broad belongs here.
const IGNORED_ERRORS = [
  /favicon/i,
];

function collectErrors(page) {
  const errors = [];
  // Uncaught exceptions — the hydration ReferenceError surfaces here.
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  // console.error — React also logs hydration failures through this channel.
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (IGNORED_ERRORS.some((re) => re.test(text))) return;
    errors.push(`console.error: ${text}`);
  });
  return errors;
}

for (const { url, name } of TOOL_PAGES) {
  test(`generator hydrates and works on ${name} (${url})`, async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto(url, { waitUntil: 'networkidle' });

    // 1. The island mounted and — crucially — is still in the DOM. React removes
    //    this node when a hydration error unmounts the component, so its presence
    //    after networkidle is the direct inverse of the outage.
    const island = page.locator('.genflag');
    await expect(island).toBeVisible();

    // 2. The real encoder's output canvas is present with its JS-computed label.
    const canvas = island.locator('canvas[role="img"]');
    await expect(canvas).toHaveCount(1);

    // 3. React is genuinely live, not just server markup. The first content input
    //    drives `hasContent` in every mode (a URL on the money page, the SSID on
    //    /wifi-qr-code), which gates the download buttons. Toggling it and watching
    //    the button's disabled state flip can only work if state + effects are
    //    running — i.e. hydration actually took over from the SSR markup.
    const input = island.locator('input').first();
    const download = island.getByRole('button', { name: /download png/i });

    await expect(input).toBeVisible();

    await input.fill('');
    await expect(download).toBeDisabled();

    await input.fill('example');
    await expect(download).toBeEnabled();

    // 4. Nothing threw or errored the whole time.
    expect(errors, `runtime errors on ${url}:\n${errors.join('\n')}`).toEqual([]);
  });
}

// Guards CLAUDE.md §5: the Learn hub is a content index and must NOT ship the
// generator. If this ever mounts one, an editor wired flagship on the wrong
// archetype.
test('the Learn hub does not mount the generator', async ({ page }) => {
  await page.goto('/learn', { waitUntil: 'networkidle' });
  await expect(page.locator('.genflag')).toHaveCount(0);
});
