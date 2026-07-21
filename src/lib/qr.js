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
function buildPayload(mode, f) {
  if (mode === 'wifi') {
    const esc = (s) => (s || '').replace(/([\\;,":])/g, '\\$1');
    return `WIFI:T:${f.enc || 'WPA'};S:${esc(f.ssid)};P:${esc(f.pass)};${f.hidden ? 'H:true;' : ''};`;
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
  // url mode + optional UTM
  let base = (f.url || '').trim(); const u = f.utm || {};
  const parts = []; const enc = (v) => encodeURIComponent(v.trim().replace(/\s+/g, '_'));
  ['source', 'medium', 'campaign', 'term', 'content'].forEach((k) => { if (u[k]) parts.push(`utm_${k}=${enc(u[k])}`); });
  return parts.length && base ? `${base}?${parts.join('&')}` : base;
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
function bakeLogo(ctx, out, grid, img, bg, fg, shape, border) {
  const cx = out / 2, cy = out / 2, frame = grid * 0.22, gap = border ? Math.round((out * 35) / 512) : 0;
  const stroke = border ? Math.max(2, frame * 0.04) : 0;
  const size = Math.max(frame - 2 * gap - 2 * stroke, frame * 0.55);
  const x = cx - size / 2, y = cy - size / 2, R = size / 2, corner = size * 0.12, clearR = R + gap + stroke / 2 + frame * 0.1;
  ctx.fillStyle = bg;
  if (shape === 'circle') { ctx.beginPath(); ctx.arc(cx, cy, clearR, 0, 7); ctx.fill(); }
  else rr(ctx, cx - clearR, cy - clearR, clearR * 2, clearR * 2, corner);
  ctx.save();
  if (shape === 'circle') { ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.clip(); }
  else { ctx.beginPath(); traceRR(ctx, x, y, size, size, corner * 0.7); ctx.clip(); }
  ctx.drawImage(img, x, y, size, size); ctx.restore();
  if (border) { ctx.strokeStyle = fg; ctx.lineWidth = stroke; if (shape === 'circle') { ctx.beginPath(); ctx.arc(cx, cy, R + gap + stroke / 2, 0, 7); ctx.stroke(); } else { ctx.beginPath(); traceRR(ctx, x - gap, y - gap, size + gap * 2, size + gap * 2, corner); ctx.stroke(); } }
}
// ISO/IEC 18004 requires a quiet zone of at least 4 modules on every side.
// This was previously `pad = out * 0.04` — a fraction of the output size, which
// made the quiet zone shrink in module terms as the code got denser: ~1.3
// modules on a typical URL code. Under-quieting is a leading cause of printed
// codes failing to scan against coloured or busy backgrounds. Size the pad in
// modules so it is correct at every version and every output size.
const QUIET_MODULES = 4;
function renderReal(canvas, matrix, out, fg, bg, dot, finder, logoImg, logoShape, logoBorder) {
  const n = matrix.length;
  const cell = out / (n + QUIET_MODULES * 2);
  const pad = QUIET_MODULES * cell, grid = out - pad * 2;
  canvas.width = out; canvas.height = out; const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, out, out);
  const fin = [[0, 0], [0, n - 7], [n - 7, 0]];
  for (const [fr, fc] of fin) drawFinderReal(ctx, pad + fc * cell, pad + fr * cell, cell, finder, fg, bg);
  const inFin = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) { if (inFin(r, c) || !matrix[r][c]) continue; drawMod(ctx, pad + c * cell + cell / 2, pad + r * cell + cell / 2, cell, dot, fg); }
  if (logoImg) bakeLogo(ctx, out, grid, logoImg, bg, fg, logoShape, logoBorder);
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
function buildSVG(matrix, out, fg, bg, dot, finder, logoDataUrl, logoShape, logoBorder) {
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
    const frame = grid * 0.22, gap = logoBorder ? Math.round((out * 35) / 512) : 0;
    const stroke = logoBorder ? Math.max(2, frame * 0.04) : 0;
    const size = Math.max(frame - 2 * gap - 2 * stroke, frame * 0.55);
    const cx = out / 2, cy = out / 2, x = cx - size / 2, y = cy - size / 2;
    const R = size / 2, corner = size * 0.12, clearR = R + gap + stroke / 2 + frame * 0.1;
    parts.push(logoShape === 'circle'
      ? `<circle cx="${cx}" cy="${cy}" r="${clearR}" fill="${bg}"/>`
      : `<rect x="${cx - clearR}" y="${cy - clearR}" width="${clearR * 2}" height="${clearR * 2}" rx="${corner}" fill="${bg}"/>`);
    const clip = logoShape === 'circle'
      ? `<clipPath id="lg"><circle cx="${cx}" cy="${cy}" r="${R}"/></clipPath>`
      : `<clipPath id="lg"><rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${corner * 0.7}"/></clipPath>`;
    parts.push(`<defs>${clip}</defs><image href="${logoDataUrl}" x="${x}" y="${y}" width="${size}" height="${size}" clip-path="url(#lg)"/>`);
    if (logoBorder) parts.push(logoShape === 'circle'
      ? `<circle cx="${cx}" cy="${cy}" r="${R + gap + stroke / 2}" fill="none" stroke="${fg}" stroke-width="${stroke}"/>`
      : `<rect x="${x - gap}" y="${y - gap}" width="${size + gap * 2}" height="${size + gap * 2}" rx="${corner}" fill="none" stroke="${fg}" stroke-width="${stroke}"/>`);
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
  return !!(f.url || '').trim();
}

export { buildPayload, getMatrix, buildSVG, renderReal, QUIET_MODULES, rrPathD, modSVG, finderSVG };
