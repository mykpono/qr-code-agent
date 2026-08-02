import { test, expect } from '@playwright/test';

/*
  Where the feedback strip lives depends on the breakpoint.

  On desktop it sits inside the preview column, under the download row, as the
  design draws it. Below the stacking breakpoint the preview column moves FIRST
  (URL + QR before the long style column), which would strand the strip halfway
  up the widget — so Generator.jsx re-parents it to .gf-body and it becomes the
  widget's last band, just above the coffee footer.

  That switch is driven by a matchMedia listener, and a listener that never
  fires is invisible in every other kind of test: the page would simply be laid
  out for the wrong breakpoint until the next reload. Only a real browser being
  really resized proves it works, which is why this lives here.
*/

const DESKTOP = { width: 1440, height: 1000 };
const MOBILE = { width: 390, height: 844 };

const parentClass = (page) => page.locator('.gf-fb').evaluate((el) => el.parentElement.className);

test('the feedback strip sits inside the preview column on desktop', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('.genflag')).toBeVisible();
  expect(await parentClass(page)).toContain('gf-preview');
});

test('the feedback strip is the last band once the columns stack', async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('.genflag')).toBeVisible();
  expect(await parentClass(page)).toBe('gf-body');

  // …and it really is last: below the setup column, above the coffee footer.
  const fb = await page.locator('.gf-fb').boundingBox();
  const setup = await page.locator('.gf-setup').boundingBox();
  const footer = await page.locator('.gf-support-footer').boundingBox();
  expect(fb.y).toBeGreaterThan(setup.y + setup.height - 1);
  expect(fb.y + fb.height).toBeLessThanOrEqual(footer.y + 1);
});

test('crossing the breakpoint live moves it, without losing what was typed', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('.genflag')).toBeVisible();

  // Open the form and type, so the move is proven to preserve state — the strip
  // is one element rendered in two places, not two copies.
  await page.locator('.gf-fb .ask button').first().click();
  await page.locator('.gf-fb textarea').fill('the corner had a white line');
  expect(await parentClass(page)).toContain('gf-preview');

  await page.setViewportSize(MOBILE);
  await expect.poll(() => parentClass(page)).toBe('gf-body');
  await expect(page.locator('.gf-fb textarea')).toHaveValue('the corner had a white line');

  await page.setViewportSize(DESKTOP);
  await expect.poll(() => parentClass(page)).toContain('gf-preview');
  await expect(page.locator('.gf-fb textarea')).toHaveValue('the corner had a white line');
});

/*
  The columns stack at 1200px, but the compact PHONE treatment stays at 900px.
  Between the two there is a band that is stacked and full-size, and it exists
  because at 1200px the side-by-side setup column is only ~640px — its swatch
  rows, template cards and frame tiles are all squeezed. Collapsing both
  breakpoints into one number would drag phone padding onto a 1000px window.
*/
const BETWEEN = { width: 1100, height: 1000 };

test('between 900 and 1200 the columns stack at full size, not phone size', async ({ page }) => {
  await page.setViewportSize(BETWEEN);
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('.genflag')).toBeVisible();

  const setup = await page.locator('.gf-setup').boundingBox();
  const preview = await page.locator('.gf-preview').boundingBox();
  expect(Math.abs(setup.y - preview.y), 'the columns must be stacked here').toBeGreaterThan(5);
  expect(preview.y, 'the preview column comes first once stacked').toBeLessThan(setup.y);
  expect(await parentClass(page)).toBe('gf-body');

  // …but still at desktop padding, NOT the 16px phone padding.
  const padX = await page.locator('.gf-setup').evaluate((el) => getComputedStyle(el).paddingLeft);
  expect(padX, 'phone padding must not reach a 1100px window').toBe('26px');

  // and the type tabs still wrap rather than turning into a scroller
  const wrap = await page.locator('.gf-types').evaluate((el) => getComputedStyle(el).flexWrap);
  expect(wrap).toBe('wrap');
});

test('the frame tiles stop being squeezed once the columns stack', async ({ page }) => {
  // The squeeze that prompted this: at 1400px the tiles are ~112px in a 644px
  // column. Stacked, the same tiles get the full width.
  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.goto('/', { waitUntil: 'networkidle' });
  const narrow = await page.locator('.gf-setup').evaluate((el) => el.getBoundingClientRect().width);

  await page.setViewportSize(BETWEEN);
  await expect.poll(() => page.locator('.gf-setup').evaluate((el) => el.getBoundingClientRect().width))
    .toBeGreaterThan(narrow);
});
