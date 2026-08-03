import { test, expect } from '@playwright/test';

/*
  The widget boots as a branded demo: the CTA reads "Buy me a coffee" and the
  encoded link IS the owner's Stripe payment link, so the default card is a
  working donation code.

  It used to be dropped on the first DESIGN interaction. That put a trap in the
  middle of styling: move the logo Fit slider and the encoded content changed
  under you — the link emptied, the code became the single-space fallback, and
  Download went disabled. Nothing said why.

  Now only CONTENT interactions spend the demo — the field, a UTM value, a
  social shortcut, restoring a saved design. Styling leaves it alone, so the
  preview stays a real scannable code the whole time you are working on it.

  That moves the risk to the export: a user could restyle the demo and walk away
  with a QR pointing at someone else's Stripe page. So the first Download or
  Copy on an untouched demo spends it instead of writing a file.
*/

const DEMO_HOST = /buy\.stripe\.com/;
const url = (page) => page.locator('.gf-urlrow .gf-field');
const cta = (page) => page.locator('.gf-ctafield input');
const dl = (page) => page.locator('.gf-dl button.primary');

test.beforeEach(async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('.genflag')).toBeVisible();
  await expect(url(page)).toHaveValue(DEMO_HOST);
});

test.describe('styling never touches the content', () => {
  test('the encoded matrix is identical before and after a Fit change', async ({ page }) => {
    // Fit scales a DOM overlay. It has no business changing the code itself —
    // this is the exact confusion the old behaviour created.
    const shot = () => page.locator('.gf-mat canvas').evaluate((c) => c.toDataURL());
    const before = await shot();

    await page.locator('.gf-fit input[type=range]').evaluate((el) => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      set.call(el, '150');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await expect(page.locator('.gf-fit .val')).toHaveText('150%');
    expect(await shot()).toBe(before);
    await expect(url(page)).toHaveValue(DEMO_HOST);
    await expect(cta(page)).toHaveValue('Buy me a coffee');
  });

  test('a look-only template restyles without spending the demo', async ({ page }) => {
    // A template is a LOOK, not content (CLAUDE.md golden rule 4).
    await page.getByRole('button', { name: 'Classic', exact: true }).click();
    await expect(url(page)).toHaveValue(DEMO_HOST);
    await expect(cta(page)).toHaveValue('Buy me a coffee');
  });
});

test.describe('content spends the demo', () => {
  test('typing a link hands the widget over', async ({ page }) => {
    await url(page).fill('https://example.com/menu');
    await expect(cta(page)).toHaveValue('SCAN ME');
    await expect(url(page)).toHaveValue('https://example.com/menu');
  });

  test('a social shortcut writes its own link and spends the demo', async ({ page }) => {
    // The one "template" that is content: it sets an example URL.
    await page.getByRole('button', { name: 'Telegram', exact: true }).click();
    await expect(cta(page)).toHaveValue('SCAN ME');
    await expect(url(page)).not.toHaveValue(DEMO_HOST);
  });
});

test.describe('the export guard', () => {
  test('the first Download on an untouched demo spends it instead of saving a file', async ({ page }) => {
    let downloaded = false;
    page.on('download', () => { downloaded = true; });

    await dl(page).click();

    await expect(url(page)).toHaveValue('');
    await expect(cta(page)).toHaveValue('SCAN ME');
    await expect(dl(page)).toBeDisabled();                      // nothing to encode now
    await expect(url(page)).toBeFocused();                      // cursor is where you type
    await page.waitForTimeout(600);
    expect(downloaded, 'the owner\'s Stripe QR must never reach the disk').toBe(false);
  });

  test('once the demo is spent, Download works normally', async ({ page }) => {
    await dl(page).click();                                     // spends the demo
    await url(page).fill('https://example.com/menu');
    await expect(dl(page)).toBeEnabled();

    const save = page.waitForEvent('download');
    await dl(page).click();
    expect((await save).suggestedFilename()).toBe('qrcode.png');
  });
});
