// Pure QR logic — no React, no DOM beyond an optional canvas argument.
// Extracted from Generator.jsx so the encoder, the quiet zone and the vector SVG
// export can be tested in Node without a browser. Generator.jsx re-exports these.
import qrcode from 'qrcode-generator';

// qrcode-generator's default byte encoder walks charCodeAt and truncates to 8
// bits, so any non-ASCII character is mangled: a code containing "café" decodes
// to an empty string on a real scanner. That silently breaks accented URLs,
// WiFi SSIDs and passwords, and vCard names — and this site ships in 11
// languages. UTF-8 must be selected explicitly; the library ships it but does
// not use it by default.
qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];

/* ---------------- payload builders ---------------- */
const UTM_KEYS = ['source', 'medium', 'campaign', 'term', 'content'];

// Keep a leading "+" (it is what makes a number dialable internationally) and
// drop every other separator. A bare /\D/ strip would silently turn "+1 415…"
// into a domestic-looking number.
function telDigits(v) {
  const raw = (v || '').trim();
  const digits = raw.replace(/\D/g, '');
  return digits ? `${raw.startsWith('+') ? '+' : ''}${digits}` : '';
}


function buildPayload(mode, f) {
  if (mode === 'wifi') {
    const esc = (s) => (s || '').replace(/([\\;,":])/g, '\\$1');
    const enc = f.enc || 'WPA';
    // An open network encodes as T:nopass with NO P: segment — emitting an empty
    // P: makes some scanners prompt for a password on a network that has none.
    const noPass = enc === 'nopass' || enc === 'None';
    const t = noPass ? 'nopass' : enc;
    return `WIFI:T:${t};S:${esc(f.ssid)};`
      + (noPass ? '' : `P:${esc(f.pass)};`)
      + (f.hidden ? 'H:true;' : '') + ';';
  }
  if (mode === 'vcard') {
    return ['BEGIN:VCARD', 'VERSION:3.0', `N:${f.last || ''};${f.first || ''};;;`,
      `FN:${[f.first, f.last].filter(Boolean).join(' ')}`, f.company ? `ORG:${f.company}` : '',
      f.title ? `TITLE:${f.title}` : '', f.phone ? `TEL;TYPE=CELL:${f.phone}` : '',
      f.email ? `EMAIL:${f.email}` : '', f.website ? `URL:${f.website}` : '', 'END:VCARD']
      .filter(Boolean).join('\n');
  }
  if (mode === 'whatsapp') {
    const num = (f.number || '').replace(/[^\d]/g, '');
    const q = f.message ? `?text=${encodeURIComponent(f.message)}` : '';
    return num ? `https://wa.me/${num}${q}` : '';
  }
  if (mode === 'tel') {
    const n = telDigits(f.phone);
    return n ? `tel:${n}` : '';
  }
  if (mode === 'sms') {
    // SMSTO: is the ZXing convention and the format QR scanner apps recognise
    // most widely. `sms:` is not portable — iOS wants `&body=`, Android `?body=`.
    const n = telDigits(f.number);
    if (!n) return '';
    return f.message ? `SMSTO:${n}:${f.message}` : `SMSTO:${n}`;
  }
  if (mode === 'email') {
    // mailto: — one scan opens a new draft. subject and body are optional and
    // must be percent-encoded (a raw "&" or space in either would truncate the
    // link or split it into a bogus second header).
    const addr = (f.email || '').trim();
    if (!addr) return '';
    const q = [];
    if ((f.subject || '').trim()) q.push(`subject=${encodeURIComponent(f.subject.trim())}`);
    if ((f.body || '').trim()) q.push(`body=${encodeURIComponent(f.body.trim())}`);
    return `mailto:${addr}${q.length ? `?${q.join('&')}` : ''}`;
  }
  if (mode === 'text') return (f.text || '').trim();
  if (mode === 'crypto') {
    // BIP-21. The address is case-sensitive (bech32 and base58 both), so it is
    // trimmed but never normalised.
    const addr = (f.address || '').trim();
    if (!addr) return '';
    const q = [];
    if (String(f.amount || '').trim()) q.push(`amount=${encodeURIComponent(String(f.amount).trim())}`);
    if ((f.label || '').trim()) q.push(`label=${encodeURIComponent(f.label.trim())}`);
    return `bitcoin:${addr}${q.length ? `?${q.join('&')}` : ''}`;
  }
  // url mode + optional UTM
  const raw = (f.url || '').trim(); const u = f.utm || {};
  const parts = []; const enc = (v) => encodeURIComponent(v.trim().replace(/\s+/g, '_'));
  UTM_KEYS.forEach((k) => { if (u[k]) parts.push(`utm_${k}=${enc(u[k])}`); });
  if (!parts.length || !raw) return raw;
  // Two things this must not get wrong. A base that already carries a query
  // ("...?code=SAVE20" — the Promotion preset) needs "&", not a second "?", or
  // the link is malformed. And params must go BEFORE any #fragment, otherwise
  // they are part of the fragment and no analytics tool ever sees them.
  const hashAt = raw.indexOf('#');
  const head = hashAt >= 0 ? raw.slice(0, hashAt) : raw;
  const hash = hashAt >= 0 ? raw.slice(hashAt) : '';
  return head + (head.includes('?') ? '&' : '?') + parts.join('&') + hash;
}

/* Display-only masking of the encoded payload for the "ENCODES AS" strip — it
   must never feed the encoder. Hides the WiFi password (which is embedded in the
   real code but should not sit in plain sight on screen) and folds the vCard's
   newlines into a one-line ⏎ so the strip does not wrap. */
function maskPayload(mode, f = {}) {
  const p = buildPayload(mode, f);
  if (mode === 'wifi' && (f.pass || '')) {
    const esc = (s) => (s || '').replace(/([\\;,":])/g, '\\$1');
    return p.replace(`P:${esc(f.pass)};`, 'P:••••••;');
  }
  return p.replace(/\n/g, ' ⏎ ');
}

/* Encoded-length buckets that drive the density chip and the advisory ECC nudge.
   The suggestion is advisory only — the caller never auto-applies it. Boundaries:
   ≤90 comfortable, 91–220 → suggest Q, >220 → suggest H. */
function payloadDensity(n) {
  if (!n) return { level: 'empty', suggest: null };
  if (n > 220) return { level: 'high', suggest: 'H' };
  if (n > 90) return { level: 'mid', suggest: 'Q' };
  return { level: 'low', suggest: null };
}

/* Inverse of the UTM composition above: pull utm_* out of a full URL, returning
   the untagged base plus the structured params. Lets the URL field display the
   tagged link while the UTM panel keeps editing discrete values. Non-utm query
   params and any fragment are preserved on the base. */
function splitUtm(full) {
  const s = (full || '').trim();
  const utm = {};
  const hashAt = s.indexOf('#');
  const head = hashAt >= 0 ? s.slice(0, hashAt) : s;
  const hash = hashAt >= 0 ? s.slice(hashAt) : '';
  const qAt = head.indexOf('?');
  if (qAt < 0) return { base: head + hash, utm };
  const path = head.slice(0, qAt);
  const kept = [];
  head.slice(qAt + 1).split('&').forEach((pair) => {
    if (!pair) return;
    const eq = pair.indexOf('=');
    const k = eq >= 0 ? pair.slice(0, eq) : pair;
    const v = eq >= 0 ? pair.slice(eq + 1) : '';
    const m = /^utm_(source|medium|campaign|term|content)$/.exec(k);
    if (!m) { kept.push(pair); return; }
    try { utm[m[1]] = decodeURIComponent(v); } catch { utm[m[1]] = v; }
  });
  return { base: path + (kept.length ? `?${kept.join('&')}` : '') + hash, utm };
}

/* ---------------- REAL encoder + styled render ---------------- */
function getMatrix(text, level) {
  const qr = qrcode(0, level); qr.addData(text); qr.make();
  const n = qr.getModuleCount(); const m = [];
  for (let r = 0; r < n; r++) { m[r] = []; for (let c = 0; c < n; c++) m[r][c] = qr.isDark(r, c); }
  return m;
}
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); ctx.fill(); }
function drawMod(ctx, cx, cy, cell, dot, color) {
  ctx.fillStyle = color; const g = cell * 0.84, x = cx - g / 2, y = cy - g / 2;
  if (dot === 'circle') { ctx.beginPath(); ctx.arc(cx, cy, g / 2, 0, 7); ctx.fill(); }
  else if (dot === 'dot') { ctx.beginPath(); ctx.arc(cx, cy, g * 0.4, 0, 7); ctx.fill(); }
  else if (dot === 'diamond') { ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI / 4); ctx.fillRect(-g * 0.36, -g * 0.36, g * 0.72, g * 0.72); ctx.restore(); }
  else if (dot === 'rounded') { rr(ctx, x, y, g, g, g * 0.32); }
  else if (dot === 'star') { const t = g * 0.3; ctx.fillRect(cx - t / 2, cy - g / 2, t, g); ctx.fillRect(cx - g / 2, cy - t / 2, g, t); }
  else if (dot === 'realstar') { const R = g * 0.6, ri = R * 0.42; ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? ri : R; const sx = cx + Math.cos(a) * rad, sy = cy + Math.sin(a) * rad; i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); } ctx.closePath(); ctx.fill(); }
  else ctx.fillRect(x, y, g, g);
}
function drawFinderReal(ctx, x, y, cell, finder, fg, bg) {
  const s7 = 7 * cell, ccx = x + s7 / 2, ccy = y + s7 / 2;
  if (finder === 'circle') {
    ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(ccx, ccy, s7 / 2, 0, 7); ctx.fill();
    ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(ccx, ccy, s7 * 0.335, 0, 7); ctx.fill();
    ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(ccx, ccy, s7 * 0.2, 0, 7); ctx.fill();
  } else {
    const leaf = finder === 'leaf';
    const base = finder === 'cushion' ? s7 * 0.46 : finder === 'rounded' ? s7 * 0.28 : leaf ? s7 * 0.46 : 0;
    const rad = (d) => { const v = Math.max(0, base - d); return leaf ? [v, 0, v, 0] : v; };
    ctx.fillStyle = fg; rr(ctx, x, y, s7, s7, rad(0));
    ctx.fillStyle = bg; rr(ctx, x + cell, y + cell, s7 - 2 * cell, s7 - 2 * cell, rad(cell));
    ctx.fillStyle = fg; rr(ctx, x + 2 * cell, y + 2 * cell, s7 - 4 * cell, s7 - 4 * cell, rad(2 * cell));
  }
}
function traceRR(ctx, x, y, w, h, r) { ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath(); }
// The logo SPACE — the white plate and its border — is FIXED at 22% of the code.
// LOGO FIT (`scale`) only zooms the mark WITHIN that space: >100% crops the mark
// to fill more of the plate, <100% shrinks it with padding. The mark's viewport
// (clip) and the border both stay put; only the drawn mark changes size.
function bakeLogo(ctx, out, grid, img, bg, fg, shape, border, scale = 1) {
  const cx = out / 2, cy = out / 2;
  const plate = grid * 0.22, half = plate / 2;
  const stroke = border ? Math.max(2, plate * 0.05) : 0;
  const inset = plate * 0.10;
  const clip = plate - 2 * (stroke + inset);
  const corner = plate * 0.22;
  ctx.fillStyle = bg;
  if (shape === 'circle') { ctx.beginPath(); ctx.arc(cx, cy, half, 0, 7); ctx.fill(); }
  else rr(ctx, cx - half, cy - half, plate, plate, corner);
  ctx.save();
  if (shape === 'circle') { ctx.beginPath(); ctx.arc(cx, cy, clip / 2, 0, 7); ctx.clip(); }
  else { ctx.beginPath(); traceRR(ctx, cx - clip / 2, cy - clip / 2, clip, clip, corner * 0.6); ctx.clip(); }
  const dz = clip * scale, dx = cx - dz / 2, dy = cy - dz / 2;
  ctx.drawImage(img, dx, dy, dz, dz); ctx.restore();
  if (border) {
    ctx.strokeStyle = fg; ctx.lineWidth = stroke;
    const br = half - stroke / 2;
    if (shape === 'circle') { ctx.beginPath(); ctx.arc(cx, cy, br, 0, 7); ctx.stroke(); }
    else { ctx.beginPath(); traceRR(ctx, cx - br, cy - br, br * 2, br * 2, corner); ctx.stroke(); }
  }
}
// ISO/IEC 18004 requires a quiet zone of at least 4 modules on every side.
// This was previously `pad = out * 0.04` — a fraction of the output size, which
// made the quiet zone shrink in module terms as the code got denser: ~1.3
// modules on a typical URL code. Under-quieting is a leading cause of printed
// codes failing to scan against coloured or busy backgrounds. Size the pad in
// modules so it is correct at every version and every output size.
const QUIET_MODULES = 4;
function renderReal(canvas, matrix, out, fg, bg, dot, finder, logoImg, logoShape, logoBorder, logoScale = 1) {
  const n = matrix.length;
  const cell = out / (n + QUIET_MODULES * 2);
  const pad = QUIET_MODULES * cell, grid = out - pad * 2;
  canvas.width = out; canvas.height = out; const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, out, out);
  const fin = [[0, 0], [0, n - 7], [n - 7, 0]];
  for (const [fr, fc] of fin) drawFinderReal(ctx, pad + fc * cell, pad + fr * cell, cell, finder, fg, bg);
  const inFin = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) { if (inFin(r, c) || !matrix[r][c]) continue; drawMod(ctx, pad + c * cell + cell / 2, pad + r * cell + cell / 2, cell, dot, fg); }
  if (logoImg) bakeLogo(ctx, out, grid, logoImg, bg, fg, logoShape, logoBorder, logoScale);
}

/* ---------------- true-vector SVG export ----------------
   The SVG export used to wrap a PNG in an <image>, so it did not scale — while
   /learn/png-or-svg-qr-code and /learn/qr-code-print-size both tell readers to
   send SVG to the printer precisely because vector stays sharp at any size.
   This emits real shapes so that advice is true. Geometry mirrors renderReal
   exactly, including the 4-module quiet zone. An uploaded logo is still a raster
   image (it has to be) but the code itself is vector. */
function rrPathD(x, y, w, h, r) {
  const [tl, tr, br, bl] = Array.isArray(r) ? r : [r, r, r, r];
  return `M${x + tl},${y}H${x + w - tr}${tr ? `A${tr},${tr} 0 0 1 ${x + w},${y + tr}` : `L${x + w},${y}`}` +
    `V${y + h - br}${br ? `A${br},${br} 0 0 1 ${x + w - br},${y + h}` : `L${x + w},${y + h}`}` +
    `H${x + bl}${bl ? `A${bl},${bl} 0 0 1 ${x},${y + h - bl}` : `L${x},${y + h}`}` +
    `V${y + tl}${tl ? `A${tl},${tl} 0 0 1 ${x + tl},${y}` : `L${x},${y}`}Z`;
}
function modSVG(cx, cy, cell, dot, fill) {
  const g = cell * 0.84, x = cx - g / 2, y = cy - g / 2, f = ` fill="${fill}"`;
  if (dot === 'circle') return `<circle cx="${cx}" cy="${cy}" r="${g / 2}"${f}/>`;
  if (dot === 'dot') return `<circle cx="${cx}" cy="${cy}" r="${g * 0.4}"${f}/>`;
  if (dot === 'diamond') return `<rect x="${-g * 0.36}" y="${-g * 0.36}" width="${g * 0.72}" height="${g * 0.72}" transform="translate(${cx} ${cy}) rotate(45)"${f}/>`;
  if (dot === 'rounded') return `<rect x="${x}" y="${y}" width="${g}" height="${g}" rx="${g * 0.32}"${f}/>`;
  if (dot === 'star') { const t = g * 0.3; return `<rect x="${cx - t / 2}" y="${cy - g / 2}" width="${t}" height="${g}"${f}/><rect x="${cx - g / 2}" y="${cy - t / 2}" width="${g}" height="${t}"${f}/>`; }
  if (dot === 'realstar') {
    const R = g * 0.6, ri = R * 0.42, pts = [];
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? ri : R;
      pts.push(`${(cx + Math.cos(a) * rad).toFixed(2)},${(cy + Math.sin(a) * rad).toFixed(2)}`); }
    return `<polygon points="${pts.join(' ')}"${f}/>`;
  }
  return `<rect x="${x}" y="${y}" width="${g}" height="${g}"${f}/>`;
}
function finderSVG(x, y, cell, finder, fg, bg) {
  const s7 = 7 * cell, ccx = x + s7 / 2, ccy = y + s7 / 2;
  if (finder === 'circle') {
    return `<circle cx="${ccx}" cy="${ccy}" r="${s7 / 2}" fill="${fg}"/>` +
      `<circle cx="${ccx}" cy="${ccy}" r="${s7 * 0.335}" fill="${bg}"/>` +
      `<circle cx="${ccx}" cy="${ccy}" r="${s7 * 0.2}" fill="${fg}"/>`;
  }
  const leaf = finder === 'leaf';
  const base = finder === 'cushion' ? s7 * 0.46 : finder === 'rounded' ? s7 * 0.28 : leaf ? s7 * 0.46 : 0;
  const rad = (d) => { const v = Math.max(0, base - d); return leaf ? [v, 0, v, 0] : v; };
  return `<path d="${rrPathD(x, y, s7, s7, rad(0))}" fill="${fg}"/>` +
    `<path d="${rrPathD(x + cell, y + cell, s7 - 2 * cell, s7 - 2 * cell, rad(cell))}" fill="${bg}"/>` +
    `<path d="${rrPathD(x + 2 * cell, y + 2 * cell, s7 - 4 * cell, s7 - 4 * cell, rad(2 * cell))}" fill="${fg}"/>`;
}
function buildSVG(matrix, out, fg, bg, dot, finder, logoDataUrl, logoShape, logoBorder, logoScale = 1) {
  const n = matrix.length;
  const cell = out / (n + QUIET_MODULES * 2);
  const pad = QUIET_MODULES * cell, grid = out - pad * 2;
  const parts = [`<rect width="${out}" height="${out}" fill="${bg}"/>`];
  for (const [fr, fc] of [[0, 0], [0, n - 7], [n - 7, 0]]) parts.push(finderSVG(pad + fc * cell, pad + fr * cell, cell, finder, fg, bg));
  const inFin = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (inFin(r, c) || !matrix[r][c]) continue;
    parts.push(modSVG(pad + c * cell + cell / 2, pad + r * cell + cell / 2, cell, dot, fg));
  }
  if (logoDataUrl) {
    // Geometry mirrors bakeLogo exactly: the plate + border are FIXED at 22% and
    // LOGO FIT only zooms the mark within the fixed clip.
    const cx = out / 2, cy = out / 2;
    const plate = grid * 0.22, half = plate / 2;
    const stroke = logoBorder ? Math.max(2, plate * 0.05) : 0;
    const inset = plate * 0.10;
    const clip = plate - 2 * (stroke + inset);
    const corner = plate * 0.22;
    parts.push(logoShape === 'circle'
      ? `<circle cx="${cx}" cy="${cy}" r="${half}" fill="${bg}"/>`
      : `<rect x="${cx - half}" y="${cy - half}" width="${plate}" height="${plate}" rx="${corner}" fill="${bg}"/>`);
    const clipDef = logoShape === 'circle'
      ? `<clipPath id="lg"><circle cx="${cx}" cy="${cy}" r="${clip / 2}"/></clipPath>`
      : `<clipPath id="lg"><rect x="${cx - clip / 2}" y="${cy - clip / 2}" width="${clip}" height="${clip}" rx="${corner * 0.6}"/></clipPath>`;
    const dz = clip * logoScale, dx = cx - dz / 2, dy = cy - dz / 2;
    parts.push(`<defs>${clipDef}</defs><image href="${logoDataUrl}" x="${dx}" y="${dy}" width="${dz}" height="${dz}" clip-path="url(#lg)" preserveAspectRatio="xMidYMid slice"/>`);
    if (logoBorder) {
      const br = half - stroke / 2;
      parts.push(logoShape === 'circle'
        ? `<circle cx="${cx}" cy="${cy}" r="${br}" fill="none" stroke="${fg}" stroke-width="${stroke}"/>`
        : `<rect x="${cx - br}" y="${cy - br}" width="${br * 2}" height="${br * 2}" rx="${corner}" fill="none" stroke="${fg}" stroke-width="${stroke}"/>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${out}" height="${out}" viewBox="0 0 ${out} ${out}" shape-rendering="crispEdges">${parts.join('')}</svg>`;
}


// Whether the user has actually entered something. buildPayload returns the
// structural scaffolding for vCard and WiFi even when every field is blank, so a
// truthy payload is NOT proof of content — without this you can export a QR
// encoding an empty contact card.
export function hasContent(mode, f = {}) {
  if (mode === 'wifi') return !!(f.ssid || '').trim();
  if (mode === 'vcard') return !!(f.first || f.last || f.phone || f.email || f.company || f.website || '');
  if (mode === 'whatsapp') return (f.number || '').replace(/[^\d]/g, '').length > 0;
  if (mode === 'tel') return !!telDigits(f.phone);
  if (mode === 'sms') return !!telDigits(f.number);
  if (mode === 'email') return !!(f.email || '').trim();
  if (mode === 'text') return !!(f.text || '').trim();
  if (mode === 'crypto') return !!(f.address || '').trim();
  return !!(f.url || '').trim();
}

// drawMod and drawFinderReal are also used by the decorative rail-thumbnail
// drawer in Generator.jsx, so they must be exported, not module-private.
export {
  buildPayload, maskPayload, payloadDensity, splitUtm, UTM_KEYS, getMatrix, buildSVG,
  renderReal, QUIET_MODULES, rrPathD, modSVG, finderSVG, drawMod, drawFinderReal,
};
