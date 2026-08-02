import { test, expect } from '@playwright/test';

/*
  The core promise of the redesign is that switching WHAT you encode never
  throws away HOW it looks — pick Contact after styling a URL code and the
  colours, pattern, corners and logo all survive.

  The one exception is a content type that is also a brand. WhatsApp is both a
  payload type and one of the four social presets, so its tab restyles the code
  the same way its shortcut chip does. That lookup was missing once: the tab
  switched the payload to WhatsApp while the code stayed in whatever brand's
  colours were there before, so a WhatsApp code came out in YouTube red.
*/

const hex = (page, i) => page.locator('.gf-slot .hex').nth(i).innerText();
const summary = (page) => page.locator('.gf-secsum').first().innerText();
const markName = (page) => page.locator('.gf-drop .mark b').innerText();

// The icon tabs are, in order: WhatsApp (a content type), then the Telegram /
// Instagram / YouTube shortcuts.
const iconTab = (page, i) => page.locator('.gf-type.icon').nth(i);
const textTab = (page, name) => page.locator('.gf-type:not(.icon)', { hasText: name });

test.beforeEach(async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('.genflag')).toBeVisible();
});

test('the WhatsApp tab applies the WhatsApp look, even over another brand', async ({ page }) => {
  // Style the code as YouTube first, so a no-op would leave it red.
  await iconTab(page, 3).click();
  await expect.poll(() => hex(page, 0)).toBe('#E60000');
  await expect(page.locator('.gf-drop .mark b')).toHaveText(/YouTube/);

  await iconTab(page, 0).click();
  await expect.poll(() => hex(page, 0)).toBe('#0F8A6D');
  expect(await hex(page, 1)).toBe('#EAFAF0');
  expect(await hex(page, 2)).toBe('#0F8A6D');      // the frame follows the brand
  expect(await summary(page)).toBe('Rounded · Rounded · ECC Q');
  expect(await markName(page)).toMatch(/WhatsApp/);
  await expect(page.locator('.gf-chips .chip').nth(2)).toHaveText('WHATSAPP');
});

test('every other content type keeps the styling it was given', async ({ page }) => {
  await iconTab(page, 1).click();                   // Telegram blue
  await expect.poll(() => hex(page, 0)).toBe('#229ED9');
  const before = await summary(page);

  for (const name of ['Text', 'WiFi', 'Contact', 'Phone', 'SMS', 'Email']) {
    await textTab(page, name).click();
    expect(await hex(page, 0), `${name} must not restyle the code`).toBe('#229ED9');
    expect(await summary(page), `${name} must not restyle the code`).toBe(before);
  }
});

test('SMS and WhatsApp prompt with their own example message', async ({ page }) => {
  await textTab(page, 'SMS').click();
  await expect(page.locator('.gf-grid.pair input').nth(1)).toHaveAttribute('placeholder', 'Table for two tonight?');
  await iconTab(page, 0).click();
  await expect(page.locator('.gf-grid.pair input').nth(1)).toHaveAttribute('placeholder', "Hi! I'd like to order…");
});
