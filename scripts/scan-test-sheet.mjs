// Generates a printable scan-test sheet.
//
// Decoding in a headless browser proves the encoder is correct. It does not
// prove a printed code scans: paper, ink spread, laminate glare, room lighting
// and a real phone camera are all outside the test suite. That one check has to
// be done by a human, so this makes it fast and systematic instead of vague.
//
// Codes are emitted at their true physical sizes using the app's own vector
// export, so what you print is what users get.
//
//   node scripts/scan-test-sheet.mjs        -> dist/scan-test.html
//   open it, print at 100% scale (NO "fit to page"), then scan every code.

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getMatrix, buildSVG } from '../src/lib/qr.js';

const BASE = 'https://qrcodeagent.net';

// mm sizes drawn from the guidance in /learn/qr-code-print-size, so the sheet
// tests exactly what the site tells people to do.
const CASES = [
  { mm: 15, label: 'Business card', dist: '10-15 cm', payload: `${BASE}/qr-codes-for-business-cards`, ecc: 'M', dot: 'square', finder: 'square' },
  { mm: 20, label: 'Product label', dist: '20-30 cm', payload: `${BASE}/qr-codes-for-packaging`, ecc: 'Q', dot: 'square', finder: 'square' },
  { mm: 25, label: 'Flyer / receipt', dist: '25-40 cm', payload: `${BASE}/pdf-qr-code`, ecc: 'Q', dot: 'rounded', finder: 'rounded' },
  { mm: 30, label: 'Table tent (menu)', dist: '30-50 cm', payload: `${BASE}/menu-qr-code`, ecc: 'Q', dot: 'circle', finder: 'circle' },
  { mm: 30, label: 'Table tent (WiFi)', dist: '30-50 cm', payload: 'WIFI:T:WPA;S:Cafe Guest;P:hunter2;;', ecc: 'Q', dot: 'square', finder: 'square' },
  { mm: 40, label: 'Menu, dense URL', dist: '30-50 cm', payload: `${BASE}/qr-codes-for-restaurants?utm_source=tabletent&utm_medium=print&utm_campaign=spring_2026`, ecc: 'H', dot: 'square', finder: 'square' },
  { mm: 25, label: 'Accented URL', dist: '25-40 cm', payload: `${BASE}/café-münchen`, ecc: 'Q', dot: 'square', finder: 'square' },
  { mm: 25, label: 'vCard', dist: '25-40 cm', payload: 'BEGIN:VCARD\nVERSION:3.0\nN:Lovelace;Ada;;;\nFN:Ada Lovelace\nTEL;TYPE=CELL:+15550109999\nEMAIL:ada@example.com\nEND:VCARD', ecc: 'Q', dot: 'square', finder: 'square' },
  { mm: 25, label: 'Low contrast (navy)', dist: '25-40 cm', payload: `${BASE}/custom-qr-code-generator`, ecc: 'Q', dot: 'square', finder: 'square', fg: '#0B1F3B', bg: '#FAF5EC' },
  { mm: 12, label: 'Below minimum', dist: 'should be hard', payload: `${BASE}/url-qr-code`, ecc: 'M', dot: 'square', finder: 'square' },
];

const mm2px = (mm) => (mm / 25.4) * 96; // CSS px at 96dpi; print scales from mm

const cards = CASES.map((c, i) => {
  const m = getMatrix(c.payload, c.ecc);
  const svg = buildSVG(m, 1000, c.fg || '#000000', c.bg || '#ffffff', c.dot, c.finder, null, 'circle', false)
    .replace('width="1000" height="1000"', `width="${mm2px(c.mm)}" height="${mm2px(c.mm)}"`);
  const preview = c.payload.length > 46 ? c.payload.slice(0, 46).replace(/\n/g, ' ') + '…' : c.payload.replace(/\n/g, ' ');
  return `<div class="c">
    <div class="n">${i + 1}</div>
    <div class="q">${svg}</div>
    <div class="m">
      <b>${c.label}</b>
      <span>${c.mm} mm · scan from ${c.dist} · ECC ${c.ecc} · v${(m.length - 17) / 4}</span>
      <code>${preview.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</code>
      <div class="box"><span>iOS</span><span>Android</span><span>in-app</span></div>
    </div>
  </div>`;
}).join('\n');

const html = `<!doctype html>
<meta charset="utf-8">
<title>QR scan test sheet — qrcodeagent.net</title>
<style>
  @page { size: A4; margin: 12mm; }
  body { font: 12px/1.45 -apple-system, system-ui, sans-serif; color: #111; margin: 0; }
  h1 { font-size: 17px; margin: 0 0 4px; }
  .lede { color: #555; margin: 0 0 4px; max-width: 62em; }
  .warn { color: #a00; font-weight: 600; margin: 0 0 14px; }
  .c { display: flex; gap: 14px; align-items: center; padding: 9px 0; border-bottom: 1px solid #e5e5e5; break-inside: avoid; }
  .n { width: 20px; font-weight: 700; color: #888; }
  .q { width: 44mm; display: flex; justify-content: center; }
  .m { flex: 1; display: flex; flex-direction: column; gap: 2px; }
  .m b { font-size: 13px; }
  .m span { color: #666; font-size: 11px; }
  .m code { font: 10px ui-monospace, monospace; color: #444; word-break: break-all; }
  .box { display: flex; gap: 7px; margin-top: 4px; }
  .box span { border: 1px solid #999; border-radius: 3px; padding: 2px 9px; font-size: 10px; color: #666; }
  footer { margin-top: 16px; color: #555; font-size: 11px; }
  footer li { margin-bottom: 3px; }
</style>
<h1>QR scan test sheet — qrcodeagent.net</h1>
<p class="lede">Every code below is produced by the app's own vector export, at the physical size the
site recommends for that use. Tick each box after a successful scan.</p>
<p class="warn">Print at 100% scale. If your print dialog says "Fit to page" or "Shrink to fit", turn it
off — otherwise the sizes are wrong and the test proves nothing.</p>
${cards}
<footer>
  <ul>
    <li><b>Scan each code from the stated distance</b>, not with the phone up against the paper.</li>
    <li><b>Use one recent phone and one that is 3+ years old.</b> Old camera stacks are the real test.</li>
    <li><b>Try one in-app scanner</b> (banking, social). These are stricter than the native camera.</li>
    <li><b>Test in the target lighting</b> — dim restaurant, sunlit window — not just at a desk.</li>
    <li><b>#10 is expected to be difficult.</b> It is 12 mm, below the 15 mm minimum, and is here as a
      control: if it scans instantly on every device, your test conditions are too favourable.</li>
    <li><b>#7 contains accented characters.</b> If it decodes to an empty string or mojibake, the UTF-8
      byte encoding has regressed.</li>
    <li><b>#9 is a low-contrast pairing</b> that should still pass; if it fails, the palette is too tight.</li>
  </ul>
</footer>`;

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
if (!existsSync(dist)) mkdirSync(dist, { recursive: true });
const out = new URL('../dist/scan-test.html', import.meta.url);
writeFileSync(out, html);
console.log(`Wrote ${fileURLToPath(out)}`);
console.log(`${CASES.length} codes. Open it, print at 100% scale, and scan every one.`);
