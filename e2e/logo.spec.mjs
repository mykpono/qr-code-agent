import { test, expect } from '@playwright/test';

/*
  The widget opens as a branded demo, and mutate() drops that demo on the FIRST
  design interaction — the CTA falls back to SCAN ME, the demo URL empties, and
  the default mark goes. Its own comment carves out the exception: not when the
  interaction itself set that very thing.

  The plate row IS that exception. Fit, plate shape and the border checkbox all
  act on the mark, so dropping it there deletes the thing the user is adjusting,
  mid-adjustment: reach for Fit on a fresh page and the QR mark vanishes from
  the preview, replaced by the dashed LOGO placeholder, with no way to get the
  default mark back. So is the on/off switch — turning the logo off is not the
  same as discarding the mark, and dropping it there made the switch one-way.
  Each case below is the FIRST touch on a freshly loaded page — that is the only
  moment the bug exists, so every test reloads.
*/

const plateState = (page) => page.locator('.gf-logoplate').evaluate((el) => ({
  img: !!el.querySelector('img'),
  hatch: !!el.querySelector('.hatch'),
}));

test.describe('the default mark survives the plate controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.locator('.genflag')).toBeVisible();
    // The mark is rasterised in an effect, so it lands a tick after hydration.
    await expect.poll(() => plateState(page)).toEqual({ img: true, hatch: false });
  });

  test('dragging Fit keeps the mark and scales it', async ({ page }) => {
    const slider = page.locator('.gf-fit input[type=range]');
    await slider.evaluate((el) => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      set.call(el, '160');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await expect(page.locator('.gf-fit .val')).toHaveText('160%');
    expect(await plateState(page)).toEqual({ img: true, hatch: false });
    expect(await page.locator('.gf-logoplate img').evaluate((el) => el.style.transform)).toBe('scale(1.6)');
  });

  test('switching the plate shape keeps the mark', async ({ page }) => {
    await page.locator('.gf-platesw').nth(1).click();          // square
    expect(await plateState(page)).toEqual({ img: true, hatch: false });
  });

  test('ticking Border keeps the mark', async ({ page }) => {
    await page.locator('.gf-platerow .gf-check').click();
    expect(await plateState(page)).toEqual({ img: true, hatch: false });
  });

  test('the on/off switch is a round trip, not a one-way door', async ({ page }) => {
    const toggle = page.locator('.gf-toggle');
    await toggle.click();                                      // off — the plate goes
    await expect(page.locator('.gf-logoplate')).toHaveCount(0);

    await toggle.click();                                      // on — the mark comes back
    expect(await plateState(page)).toEqual({ img: true, hatch: false });
  });

  test('styling the plate leaves the rest of the demo alone too', async ({ page }) => {
    // The demo is dropped by CONTENT edits, not design ones — see demo.spec.mjs.
    // A plate control is design, so nothing about the demo may move: not the
    // mark, not the CTA, not the encoded link.
    await page.locator('.gf-platesw').nth(1).click();
    await expect(page.locator('.gf-ctafield input')).toHaveValue('Buy me a coffee');
    await expect(page.locator('.gf-urlrow .gf-field')).toHaveValue(/buy\.stripe\.com/);
  });

  test('REMOVE still clears the mark', async ({ page }) => {
    await page.locator('.gf-drop .mark .rm').click();
    expect(await plateState(page)).toEqual({ img: false, hatch: true });
  });
});
