import { test, expect } from '@playwright/test';

/*
  The frame box is `background` + `border: Npx solid frameColor` + border-radius
  + overflow:hidden. The rounded clip cuts the bars against the border's inner
  curve, and the clip curve and the painted border edge disagree by a sub-pixel:
  whatever backs the box shows through at the two corners as a hairline arc.

  Backing it with the PAPER drew a visible white line across the bottom corners
  of every solid-bar frame (Banner below / Banner above / Brand ribbon). Backing
  it with the FRAME COLOUR makes that seam the same colour as the border, so it
  cannot be seen — and every part that should read as paper (the code box, a
  plain bar, the band around a pill chip) paints its own paper background.

  This is a rendering detail no unit test can see, so it is asserted here on the
  real DOM. lib/qr.js has the geometry tests; this has the one invariant that
  stops the white line coming back.
*/

const FRAME_LABELS = [
  'No frame', 'Thin border', 'Caption below', 'Banner below', 'Pill below',
  'Bold border', 'Banner above', 'Label above', 'Ticket', 'Brand ribbon',
];

const rgb = (s) => (s.match(/\d+/g) || []).slice(0, 3).map(Number);
const hexToRgb = (h) => {
  const v = h.trim().replace('#', '');
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));
};
const same = (a, b) => a.length === 3 && b.length === 3 && a.every((v, i) => Math.abs(v - b[i]) <= 1);

test.describe('frame preview', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.locator('.genflag')).toBeVisible();
  });

  test('the frame box is backed by the frame colour, never the paper', async ({ page }) => {
    // The frame colour is whatever the FRAME slot reports.
    const frameHex = await page.locator('.gf-slot .hex').nth(2).innerText();
    const paperHex = await page.locator('.gf-slot .hex').nth(1).innerText();
    expect(frameHex).not.toBe(paperHex);

    const tiles = page.locator('.gf-frametile');
    await expect(tiles).toHaveCount(FRAME_LABELS.length);

    for (let i = 1; i < FRAME_LABELS.length; i++) {   // skip "No frame" — it has no box
      await tiles.nth(i).click();
      const box = page.locator('.gf-stage > div');
      const bg = await box.evaluate((el) => getComputedStyle(el).backgroundColor);
      const bgImg = await box.evaluate((el) => getComputedStyle(el).backgroundImage);
      const border = await box.evaluate((el) => getComputedStyle(el).borderTopColor);
      const gradient = bgImg !== 'none';

      if (gradient) {
        // Brand ribbon: the gradient IS the border, so it backs the box instead.
        expect(await box.evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe('0px');
      } else {
        expect(same(rgb(bg), rgb(border)),
          `${FRAME_LABELS[i]}: box background ${bg} must equal the border ${border}, or a hairline of it shows at the clipped corners`).toBe(true);
      }
    }
  });

  test('a pill bar carries its own paper band', async ({ page }) => {
    // The pill is a centred chip. It used to borrow the box background for the
    // band around it, which broke when the box became frame-coloured.
    await page.locator('.gf-frametile').nth(4).click();     // Pill below
    // The paper is the code's own background — the BACKGROUND colour slot.
    const paper = hexToRgb(await page.locator('.gf-slot .hex').nth(1).innerText());
    const frame = hexToRgb(await page.locator('.gf-slot .hex').nth(2).innerText());

    const band = page.locator('.gf-stage > div > div').last();
    const bandBg = rgb(await band.evaluate((el) => getComputedStyle(el).backgroundColor));
    expect(same(bandBg, paper), `pill band is ${bandBg}, expected the paper ${paper}`).toBe(true);

    const chipBg = rgb(await band.locator('> div').evaluate((el) => getComputedStyle(el).backgroundColor));
    expect(same(chipBg, frame), `pill chip is ${chipBg}, expected the frame colour ${frame}`).toBe(true);
  });

  test('the preview frame measures exactly what the exporter will draw', async ({ page }) => {
    // Preview and download must not disagree about the frame; this is the check
    // that would have caught the pill bar's margin becoming wrapper padding.
    for (const i of [3, 4, 8, 9]) {                          // banner, pill, ticket, ribbon
      await page.locator('.gf-frametile').nth(i).click();
      const box = await page.locator('.gf-stage > div').boundingBox();
      const code = await page.locator('.gf-mat').boundingBox();
      expect(box.width).toBeGreaterThan(code.width);
      expect(box.height).toBeGreaterThanOrEqual(box.width);
    }
  });
});
