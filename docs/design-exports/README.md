# Generator design exports — Claude Design handoff

Captured from **production** (`https://qrcodeagent.net`) on 2026-07-31.

## Files to attach

| File | What it shows | Size |
|------|---------------|------|
| `generator-current-desktop-cream-2x.png` | **Primary reference** — full widget, 3-column layout, Cream theme, URL mode | 2380×2104 px |
| `generator-current-mobile-cream-2x.png` | Mobile stack (preview first, controls below) | 716×3428 px |
| `generator-current-wifi-mode-desktop-2x.png` | Type-specific fields example (WiFi mode on `/wifi-qr-code`) | — |
| `generator-current-hero-context-2x.png` | Same as desktop (clip export; use desktop file instead) | — |

## Prompt starter for Claude Design

```
Redesign the CONTENT / URL input region of this QR generator to support
8 content types (URL, Text, WiFi, Contact, Phone, SMS, Email, WhatsApp).

ATTACH: generator-current-desktop-cream-2x.png (current design)
ATTACH: generator-current-mobile-cream-2x.png (mobile)
ATTACH: generator-current-wifi-mode-desktop-2x.png (existing type-specific fields)

KEEP UNCHANGED: styling panel, live preview, templates rail, themes, footer.
READ BRIEF: docs/DESIGN-BRIEF-multi-type-widget.md
```

## Re-capture

```bash
cd qrcodeagent-app
node --input-type=module -e "
import { chromium } from '@playwright/test';
const out = 'docs/design-exports';
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 2 });
const p = await c.newPage();
await p.goto('https://qrcodeagent.net/', { waitUntil: 'networkidle' });
await p.locator('.genflag').screenshot({ path: out + '/generator-current-desktop-cream-2x.png' });
await c.close(); await b.close();
"
```
