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
/* The nine finder (corner) styles, ported verbatim from QR Generator.dc.html.
   Each finder is a 7x7-module square of side `s`; `u = s/7` is one module (x1.45
   for the `bold` variant, giving a heavier ring). Three concentric fills: outer
   square in fg at radius `o*s`, a hole in bg, then the eye in fg at radius
   `i*is`. `leaf` swaps the uniform radius for a two-corner one. */
const CORNERS = [
  { key: 'square', o: 0, i: 0 },
  { key: 'bold', o: 0, i: 0, thick: 1 },
  { key: 'dot', o: .26, i: .5 },
  { key: 'rounded', o: .26, i: .26 },
  { key: 'leaf', o: .5, i: .5, leaf: 1 },
  { key: 'leafAlt', o: .5, i: .5, leaf: 2 },
  { key: 'cushion', o: .42, i: .42 },
  { key: 'circle', o: .5, i: .5 },
  { key: 'diamond', o: .12, i: 'diamond' },
];
const CORNER_KEYS = CORNERS.map((c) => c.key);
const cornerDef = (key) => CORNERS.find((c) => c.key === key) || CORNERS[0];

/* The swatch previews pass bg = 'transparent'. Filling with a transparent colour
   is a no-op under source-over, so the ring would never appear and all nine
   options would read as identical dark blobs — punch the hole out instead. */
function drawCorner(ctx, key, x, y, s, fg, bg) {
  const d = cornerDef(key);
  const u = (s / 7) * (d.thick ? 1.45 : 1);
  const rad = (frac, size) => {
    const v = (typeof frac === 'number' ? frac : 0) * size;
    if (d.leaf === 1) return [v, 0, v, 0];
    if (d.leaf === 2) return [0, v, 0, v];
    return v;
  };
  const clear = bg === 'transparent';
  const fill = (X, Y, W, H, R, color, cut) => {
    ctx.save();
    if (cut && clear) ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = cut && clear ? '#000' : color;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(X, Y, W, H, R); else ctx.rect(X, Y, W, H);
    ctx.fill();
    ctx.restore();
  };
  fill(x, y, s, s, rad(d.o, s), fg);
  fill(x + u, y + u, s - 2 * u, s - 2 * u, rad(d.o, s - 2 * u), bg, true);
  const is = s - 4 * u, ix = x + 2 * u, iy = y + 2 * u;
  if (d.i === 'diamond') {
    ctx.save(); ctx.fillStyle = fg;
    ctx.translate(ix + is / 2, iy + is / 2); ctx.rotate(Math.PI / 4);
    const h = is * 0.66; ctx.fillRect(-h / 2, -h / 2, h, h); ctx.restore();
  } else fill(ix, iy, is, is, rad(d.i, is), fg);
}

function drawFinderReal(ctx, x, y, cell, finder, fg, bg) {
  drawCorner(ctx, finder, x, y, 7 * cell, fg, bg);
}
function traceRR(ctx, x, y, w, h, r) { ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath(); }
// Add a rounded rect to the CURRENT path (for clip/stroke). roundRect draws true
// arcs; traceRR's quadratic corners are a visible ellipse at radius = w/2, which
// is exactly the circular-plate case, so prefer the native path when present.
function tracePath(ctx, x, y, w, h, r) {
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, Math.max(0, r));
  else traceRR(ctx, x, y, w, h, Math.max(0, r));
}
/* The centre mark's plate, in the redesign's proportions: a 110px white tile on
   a 470px code, 14px of padding inside a 3px border, radius 50% (circle) or 20px
   (square). Everything below is expressed as a fraction of the plate so the
   export at any output size is the preview scaled.

   The plate is ALWAYS white, not the code's background — that is what keeps a
   dark-background design readable behind a logo.

   LOGO FIT (`scale`) zooms the mark WITHIN the padding box; the plate, its
   border and the clip all stay put. */
const PLATE_RATIO = 110 / 470;
const PLATE_PAD = 14 / 110;
const PLATE_BORDER = 3 / 110;
const PLATE_RADIUS = 20 / 110;
const MARK_RADIUS = 10 / 110;
const PLATE_WHITE = '#ffffff';

// Geometry shared by the canvas and SVG writers so they cannot drift apart.
function plateGeometry(out, shape, border, scale = 1) {
  const plate = out * PLATE_RATIO;
  const bw = border ? plate * PLATE_BORDER : 0;
  const pad = plate * PLATE_PAD;
  const box = plate - 2 * (bw + pad);
  return {
    plate, half: plate / 2, cx: out / 2, cy: out / 2, bw, pad, box,
    radius: shape === 'circle' ? plate / 2 : plate * PLATE_RADIUS,
    clipRadius: shape === 'circle' ? plate / 2 - bw : Math.max(0, plate * PLATE_RADIUS - bw),
    // The mark itself is rounded — a circular plate holds a circular mark, not a
    // square one floating in it. LOGO FIT scales that shape with the mark, then
    // the plate's overflow clips whatever spills.
    markSize: box * scale,
    markRadius: (shape === 'circle' ? box / 2 : plate * MARK_RADIUS) * scale,
  };
}

// object-fit: contain — the mark keeps its aspect ratio inside the padding box.
function containBox(img, box, scale) {
  const w = img.naturalWidth || img.width || 1;
  const h = img.naturalHeight || img.height || 1;
  const f = (box / Math.max(w, h)) * scale;
  return { w: w * f, h: h * f };
}

function bakeLogo(ctx, out, img, shape, border, scale = 1, fg = '#000') {
  const g = plateGeometry(out, shape, border, scale);
  ctx.save();
  ctx.fillStyle = PLATE_WHITE;
  rr(ctx, g.cx - g.half, g.cy - g.half, g.plate, g.plate, g.radius);
  // overflow:hidden clips at the padding box, i.e. inside the border
  ctx.beginPath();
  tracePath(ctx, g.cx - g.half + g.bw, g.cy - g.half + g.bw, g.plate - 2 * g.bw, g.plate - 2 * g.bw, g.clipRadius);
  ctx.clip();
  // …and the mark's own rounded shape clips inside that
  ctx.beginPath();
  tracePath(ctx, g.cx - g.markSize / 2, g.cy - g.markSize / 2, g.markSize, g.markSize, g.markRadius);
  ctx.clip();
  const d = containBox(img, g.box, scale);
  ctx.drawImage(img, g.cx - d.w / 2, g.cy - d.h / 2, d.w, d.h);
  ctx.restore();
  if (border) {
    ctx.strokeStyle = fg; ctx.lineWidth = g.bw;
    ctx.beginPath();
    tracePath(ctx, g.cx - g.half + g.bw / 2, g.cy - g.half + g.bw / 2, g.plate - g.bw, g.plate - g.bw, Math.max(0, g.radius - g.bw / 2));
    ctx.stroke();
  }
}
// ISO/IEC 18004 requires a quiet zone of at least 4 modules on every side.
// This was previously `pad = out * 0.04` — a fraction of the output size, which
// made the quiet zone shrink in module terms as the code got denser: ~1.3
// modules on a typical URL code. Under-quieting is a leading cause of printed
// codes failing to scan against coloured or busy backgrounds. Size the pad in
// modules so it is correct at every version and every output size.
const QUIET_MODULES = 4;
/* Paint the code itself into an existing context at (ox, oy). Split out of
   renderReal so the framed export can composite the same pixels inside a frame
   without a second copy of the geometry. */
function paintCode(ctx, matrix, ox, oy, out, fg, bg, dot, finder, logoImg, logoShape, logoBorder, logoScale = 1) {
  const n = matrix.length;
  const cell = out / (n + QUIET_MODULES * 2);
  const pad = QUIET_MODULES * cell;
  ctx.save();
  ctx.translate(ox, oy);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, out, out);
  const fin = [[0, 0], [0, n - 7], [n - 7, 0]];
  for (const [fr, fc] of fin) drawFinderReal(ctx, pad + fc * cell, pad + fr * cell, cell, finder, fg, bg);
  const inFin = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) { if (inFin(r, c) || !matrix[r][c]) continue; drawMod(ctx, pad + c * cell + cell / 2, pad + r * cell + cell / 2, cell, dot, fg); }
  if (logoImg) bakeLogo(ctx, out, logoImg, logoShape, logoBorder, logoScale, fg);
  ctx.restore();
}
function renderReal(canvas, matrix, out, fg, bg, dot, finder, logoImg, logoShape, logoBorder, logoScale = 1) {
  canvas.width = out; canvas.height = out;
  paintCode(canvas.getContext('2d'), matrix, 0, 0, out, fg, bg, dot, finder, logoImg, logoShape, logoBorder, logoScale);
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
/* Vector twin of drawCorner — identical geometry, so a downloaded SVG and the
   rendered canvas show the same corner style. */
function finderSVG(x, y, cell, finder, fg, bg) {
  const s = 7 * cell;
  const d = cornerDef(finder);
  const u = (s / 7) * (d.thick ? 1.45 : 1);
  const rad = (frac, size) => {
    const v = (typeof frac === 'number' ? frac : 0) * size;
    if (d.leaf === 1) return [v, 0, v, 0];
    if (d.leaf === 2) return [0, v, 0, v];
    return v;
  };
  const is = s - 4 * u, ix = x + 2 * u, iy = y + 2 * u;
  const eye = d.i === 'diamond'
    ? `<path d="${rrPathD(-is * 0.33, -is * 0.33, is * 0.66, is * 0.66, 0)}" transform="translate(${ix + is / 2} ${iy + is / 2}) rotate(45)" fill="${fg}"/>`
    : `<path d="${rrPathD(ix, iy, is, is, rad(d.i, is))}" fill="${fg}"/>`;
  return `<path d="${rrPathD(x, y, s, s, rad(d.o, s))}" fill="${fg}"/>`
    + `<path d="${rrPathD(x + u, y + u, s - 2 * u, s - 2 * u, rad(d.o, s - 2 * u))}" fill="${bg}"/>`
    + eye;
}
function buildSVG(matrix, out, fg, bg, dot, finder, logoDataUrl, logoShape, logoBorder, logoScale = 1) {
  const n = matrix.length;
  const cell = out / (n + QUIET_MODULES * 2);
  const pad = QUIET_MODULES * cell;
  const parts = [`<rect width="${out}" height="${out}" fill="${bg}"/>`];
  for (const [fr, fc] of [[0, 0], [0, n - 7], [n - 7, 0]]) parts.push(finderSVG(pad + fc * cell, pad + fr * cell, cell, finder, fg, bg));
  const inFin = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (inFin(r, c) || !matrix[r][c]) continue;
    parts.push(modSVG(pad + c * cell + cell / 2, pad + r * cell + cell / 2, cell, dot, fg));
  }
  if (logoDataUrl) {
    // Geometry mirrors bakeLogo exactly — same plate ratio, same padding box,
    // same clip — so the SVG and the PNG show the same mark at the same size.
    const g = plateGeometry(out, logoShape, logoBorder, logoScale);
    const inner = g.plate - 2 * g.bw;
    parts.push(`<rect x="${g.cx - g.half}" y="${g.cy - g.half}" width="${g.plate}" height="${g.plate}" rx="${g.radius}" fill="${PLATE_WHITE}"/>`);
    // Two nested clips, mirroring bakeLogo: the plate's overflow, then the
    // mark's own rounded shape.
    parts.push(`<defs>`
      + `<clipPath id="lg-plate"><rect x="${g.cx - g.half + g.bw}" y="${g.cy - g.half + g.bw}" width="${inner}" height="${inner}" rx="${g.clipRadius}"/></clipPath>`
      + `<clipPath id="lg"><rect x="${g.cx - g.markSize / 2}" y="${g.cy - g.markSize / 2}" width="${g.markSize}" height="${g.markSize}" rx="${g.markRadius}"/></clipPath>`
      + `</defs>`);
    // The mark is contained (aspect preserved) inside the padding box, then
    // zoomed by LOGO FIT about the centre.
    const dz = g.box * logoScale, dx = g.cx - dz / 2, dy = g.cy - dz / 2;
    parts.push(`<g clip-path="url(#lg-plate)"><image href="${logoDataUrl}" x="${dx}" y="${dy}" width="${dz}" height="${dz}" clip-path="url(#lg)" preserveAspectRatio="xMidYMid meet"/></g>`);
    if (logoBorder) {
      parts.push(`<rect x="${g.cx - g.half + g.bw / 2}" y="${g.cy - g.half + g.bw / 2}" width="${g.plate - g.bw}" height="${g.plate - g.bw}" rx="${Math.max(0, g.radius - g.bw / 2)}" fill="none" stroke="${fg}" stroke-width="${g.bw}"/>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${out}" height="${out}" viewBox="0 0 ${out} ${out}" shape-rendering="crispEdges">${parts.join('')}</svg>`;
}


/* ---------------- frame system ----------------
   A frame is a column: an optional top bar, the code, an optional bottom bar.
   The same definition renders at full size in the preview and at scale 0.22 in
   the picker tiles, so every measurement is expressed as a multiple of `k`.

   The prototype drew the frame in DOM only, which meant a download silently
   dropped the frame the user had just designed. frameMetrics() is the single
   source of truth for both: Generator.jsx composes inline styles from it, and
   renderFramed()/buildFramedSVG() composite the identical geometry into the
   exported file. */

// The preview canvas is 470px wide, which is the scale every frame constant
// below was authored against. Exports scale the whole composition by size/470.
const FRAME_BASE_PX = 470;
const CTA_SCALE = { XS: .7, S: .84, M: 1, L: 1.22, XL: 1.46 };
const RIBBON_GRADIENT = ['#7b5cff', '#e0409a', '#ffb020'];

const FRAMES = [
  { key: 'none', pad: 0 },
  { key: 'border', pad: 14, bw: 3, r: 18 },
  { key: 'caption', pad: 14, bw: 3, r: 18, bottom: 'plain' },
  { key: 'banner', pad: 14, bw: 9, r: 22, bottom: 'solid' },
  { key: 'pill', pad: 16, bw: 3, r: 26, bottom: 'pill' },
  { key: 'thick', pad: 16, bw: 9, r: 26, more: 1 },
  { key: 'banner-top', pad: 14, bw: 9, r: 22, top: 'solid', more: 1 },
  { key: 'label', pad: 14, bw: 3, r: 18, top: 'plain', more: 1 },
  { key: 'ticket', pad: 16, bw: 3, r: 30, bottom: 'pill', top: 'plain', more: 1 },
  { key: 'ribbon', pad: 14, bw: 9, r: 22, bottom: 'solid', grad: 1, more: 1 },
];
const FRAME_KEYS = FRAMES.map((f) => f.key);
const frameDef = (key) => FRAMES.find((f) => f.key === key) || FRAMES[0];

/* CTA display faces. `label` is a typeface name, not translatable copy, so it
   lives here with the stack rather than in ui.json. `scale` corrects faces whose
   cap height runs small or large against the others at the same px size. */
const FONTS = [
  { key: 'grotesk', label: 'Space Grotesk', css: "'Space Grotesk',sans-serif", w: 700, ls: '.14em' },
  { key: 'mono', label: 'IBM Plex Mono', css: "'IBM Plex Mono',monospace", w: 600, ls: '.12em' },
  { key: 'helvetica', label: 'Helvetica', css: 'Helvetica,Arial,sans-serif', w: 700, ls: '.1em' },
  { key: 'georgia', label: 'Georgia', css: 'Georgia,serif', w: 700, ls: '.06em' },
  { key: 'arial', label: 'Arial', css: 'Arial,Helvetica,sans-serif', w: 700, ls: '.09em' },
  { key: 'verdana', label: 'Verdana', css: 'Verdana,Geneva,sans-serif', w: 700, ls: '.08em', scale: .94 },
  { key: 'tahoma', label: 'Tahoma', css: 'Tahoma,Verdana,sans-serif', w: 700, ls: '.09em' },
  { key: 'trebuchet', label: 'Trebuchet', css: "'Trebuchet MS',sans-serif", w: 700, ls: '.08em' },
  { key: 'times', label: 'Times', css: "'Times New Roman',Times,serif", w: 700, ls: '.05em' },
  { key: 'garamond', label: 'Garamond', css: "Garamond,'Times New Roman',serif", w: 700, ls: '.06em', scale: 1.06 },
  { key: 'courier', label: 'Courier', css: "'Courier New',Courier,monospace", w: 700, ls: '.1em', scale: .96 },
  { key: 'impact', label: 'Impact', css: "Impact,'Arial Narrow',sans-serif", w: 400, ls: '.1em', scale: 1.08 },
  { key: 'playfair', label: 'Playfair', css: "'Playfair Display',serif", w: 700, ls: '.05em' },
  { key: 'bebas', label: 'Bebas', css: "'Bebas Neue',sans-serif", w: 400, ls: '.16em', scale: 1.15 },
  { key: 'caveat', label: 'Caveat', css: "'Caveat',cursive", w: 600, ls: '0', scale: 1.5 },
];
const fontDef = (key) => FONTS.find((f) => f.key === key) || FONTS[0];

/* Resolved geometry for one frame at one scale. Every number is already rounded
   to whole pixels, matching what the browser lays out from the same values. */
function frameMetrics(frameKey, k, ctaSize, frameFont) {
  const def = frameDef(frameKey);
  const fd = fontDef(frameFont);
  const sz = CTA_SCALE[ctaSize] || 1;
  const R = (n) => Math.round(n * k);
  const fsz = (n) => Math.max(4, Math.round(n * k * sz * (fd.scale || 1)));
  const bar = (place) => {
    const kind = place === 'top' ? def.top : def.bottom;
    if (kind === 'solid') return { kind, padTop: R(11), padBottom: R(11), padX: R(14), font: fsz(19) };
    // `plain` sits on the paper, so its padding is asymmetric — it has to close
    // the gap the code's own padding already opened on the other side.
    if (kind === 'plain') return { kind, padTop: R(place === 'top' ? 12 : 9), padBottom: R(place === 'top' ? 4 : 13), padX: R(14), font: fsz(18) };
    if (kind === 'pill') return { kind, marginTop: R(3), marginBottom: R(13), padTop: R(8), padBottom: R(8), padX: R(22), font: fsz(15) };
    return null;
  };
  return {
    def, font: fd,
    // A gradient frame has no border — the gradient IS the border, painted as
    // padding under a smaller-radius inner box.
    border: def.bw ? (def.grad ? 0 : Math.max(1, R(def.bw))) : 0,
    gradPad: def.grad ? Math.max(2, R(def.bw)) : 0,
    pad: R(def.pad || 0),
    radius: R(def.r || 0),
    innerRadius: def.grad ? Math.max(0, R((def.r || 0) - 4)) : 0,
    top: bar('top'), bottom: bar('bottom'),
  };
}

// auto → white on a solid/pill bar, the frame colour on a bar that sits on paper.
function ctaInk(ctaColor, frameColor, onSolid) {
  return ctaColor === 'auto' ? (onSolid ? '#ffffff' : frameColor) : ctaColor;
}
const fontShorthand = (fd, px) => `${fd.w} ${px}px ${fd.css}`;
const trackingPx = (fd, px) => (parseFloat(fd.ls) || 0) * px;

/* The height of one line at a given font size. `normal` line-height is the
   font's own ascent + descent, which measureText reports directly — matching it
   is what keeps an exported bar the same height as the one on screen. */
function makeLineMeasurer() {
  let ctx = null;
  try { ctx = document.createElement('canvas').getContext('2d'); } catch { ctx = null; }
  return (fd, px) => {
    if (ctx) {
      ctx.font = fontShorthand(fd, px);
      const m = ctx.measureText('Hg');
      if (m.fontBoundingBoxAscent != null && m.fontBoundingBoxDescent != null) {
        return { ascent: m.fontBoundingBoxAscent, height: m.fontBoundingBoxAscent + m.fontBoundingBoxDescent };
      }
    }
    return { ascent: px * 0.8, height: px * 1.0 };
  };
}

/* Lay the column out top to bottom. Returns the outer size plus the box of every
   part, so the canvas and SVG writers only have to fill rectangles. */
function frameLayout(m, size, text, measureLine) {
  const has = !!(text || '').length;
  const barBox = (bar) => {
    if (!bar) return null;
    const lb = has ? measureLine(m.font, bar.font) : { ascent: 0, height: 0 };
    const lineH = Math.round(lb.height);
    const inner = bar.padTop + bar.padBottom + lineH;
    return {
      ...bar, lineH, ascent: lb.ascent,
      // pill is a centred chip with margins; the others are full-width bars.
      height: inner + (bar.marginTop || 0) + (bar.marginBottom || 0),
      chipHeight: inner,
    };
  };
  const top = barBox(m.top), bottom = barBox(m.bottom);
  const inset = m.border + m.gradPad;
  const contentW = size + m.pad * 2;
  const codeBoxH = size + m.pad * 2;
  const outerW = contentW + inset * 2;
  const outerH = (top ? top.height : 0) + codeBoxH + (bottom ? bottom.height : 0) + inset * 2;
  return {
    inset, contentW, codeBoxH, outerW, outerH, top, bottom,
    topY: inset,
    codeBoxY: inset + (top ? top.height : 0),
    codeX: inset + m.pad,
    codeY: inset + (top ? top.height : 0) + m.pad,
    bottomY: inset + (top ? top.height : 0) + codeBoxH,
  };
}

// Draw text with CSS-style letter-spacing, centred. Per-character placement so
// the result is identical in every browser regardless of ctx.letterSpacing.
function drawTracked(ctx, text, cx, baseline, ls, color) {
  const chars = [...text];
  let total = 0;
  for (const ch of chars) total += ctx.measureText(ch).width + ls;
  if (chars.length) total -= ls;
  ctx.fillStyle = color;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  let x = cx - total / 2;
  for (const ch of chars) { ctx.fillText(ch, x, baseline); x += ctx.measureText(ch).width + ls; }
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, Math.max(0, r)); else ctx.rect(x, y, w, h);
}

/* Render the code INSIDE its frame onto `canvas`, at export resolution.
   `size` is the code's own edge length — the canvas comes out larger by the
   frame's padding, border and bars, exactly as the preview does. */
function renderFramed(canvas, o) {
  const {
    matrix, size, fg, bg, dot, finder, logoImg, logoShape, logoBorder, logoScale = 1,
    frame = 'none', frameColor = '#1c1c1c', frameText = '', ctaColor = 'auto',
    ctaSize = 'M', frameFont = 'grotesk',
  } = o;
  const k = size / FRAME_BASE_PX;
  const m = frameMetrics(frame, k, ctaSize, frameFont);
  const L = frameLayout(m, size, frameText, makeLineMeasurer());
  canvas.width = Math.round(L.outerW); canvas.height = Math.round(L.outerH);
  const ctx = canvas.getContext('2d');
  const grad = !!m.def.grad;

  // 1. the outer shell: gradient, border colour, or bare paper
  if (grad) {
    const g = ctx.createLinearGradient(0, 0, L.outerW, L.outerH);
    RIBBON_GRADIENT.forEach((c, i) => g.addColorStop(i / (RIBBON_GRADIENT.length - 1), c));
    ctx.fillStyle = g;
  } else ctx.fillStyle = m.border ? frameColor : bg;
  if (m.def.key !== 'none') { roundRectPath(ctx, 0, 0, L.outerW, L.outerH, m.radius); ctx.fill(); }

  ctx.save();
  roundRectPath(ctx, L.inset, L.inset, L.contentW, L.outerH - L.inset * 2, Math.max(0, m.radius - L.inset));
  ctx.clip();

  // 2. the paper. A gradient frame paints paper only behind the code, so the
  //    bars show the gradient through; every other frame papers the whole box.
  ctx.fillStyle = bg;
  if (grad) { roundRectPath(ctx, L.inset, L.codeBoxY, L.contentW, L.codeBoxH, m.innerRadius); ctx.fill(); }
  else if (m.def.key !== 'none') { ctx.fillRect(L.inset, L.inset, L.contentW, L.outerH - L.inset * 2); }

  // 3. the bars
  const paintBar = (bar, y) => {
    if (!bar) return;
    const solid = bar.kind === 'solid' || bar.kind === 'pill';
    const ink = ctaInk(ctaColor, frameColor, solid);
    if (bar.kind === 'solid' && !grad) {
      ctx.fillStyle = frameColor;
      ctx.fillRect(L.inset, y, L.contentW, bar.height);
    }
    if (!frameText) return;
    ctx.font = fontShorthand(m.font, bar.font);
    const ls = trackingPx(m.font, bar.font);
    let textTop = y + bar.padTop;
    if (bar.kind === 'pill') {
      let w = 0; for (const ch of [...frameText]) w += ctx.measureText(ch).width + ls;
      if (frameText.length) w -= ls;
      const chipW = Math.round(w) + bar.padX * 2;
      const chipX = L.inset + (L.contentW - chipW) / 2;
      const chipY = y + bar.marginTop;
      ctx.fillStyle = frameColor;
      roundRectPath(ctx, chipX, chipY, chipW, bar.chipHeight, bar.chipHeight / 2);
      ctx.fill();
      textTop = chipY + bar.padTop;
    }
    drawTracked(ctx, frameText, L.inset + L.contentW / 2, textTop + bar.ascent, ls, ink);
  };
  paintBar(L.top, L.topY);
  paintBar(L.bottom, L.bottomY);

  // 4. the code itself
  paintCode(ctx, matrix, L.codeX, L.codeY, size, fg, bg, dot, finder, logoImg, logoShape, logoBorder, logoScale);
  ctx.restore();
  return { width: canvas.width, height: canvas.height };
}

const xmlEscape = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));

/* Vector twin of renderFramed. Falls back to the plain code SVG when the frame
   is `none`, so the existing export path and its tests are untouched. */
function buildFramedSVG(o) {
  const {
    matrix, size, fg, bg, dot, finder, logoDataUrl = null, logoShape, logoBorder, logoScale = 1,
    frame = 'none', frameColor = '#1c1c1c', frameText = '', ctaColor = 'auto',
    ctaSize = 'M', frameFont = 'grotesk',
  } = o;
  const codeSVG = buildSVG(matrix, size, fg, bg, dot, finder, logoDataUrl, logoShape, logoBorder, logoScale);
  if (frame === 'none') return codeSVG;

  const k = size / FRAME_BASE_PX;
  const m = frameMetrics(frame, k, ctaSize, frameFont);
  const L = frameLayout(m, size, frameText, makeLineMeasurer());
  const grad = !!m.def.grad;
  const W = Math.round(L.outerW), H = Math.round(L.outerH);
  const defs = [];
  const parts = [];

  if (grad) {
    defs.push(`<linearGradient id="fr-g" x1="0" y1="0" x2="1" y2="1">`
      + RIBBON_GRADIENT.map((c, i) => `<stop offset="${i / (RIBBON_GRADIENT.length - 1)}" stop-color="${c}"/>`).join('')
      + `</linearGradient>`);
  }
  const shell = grad ? 'url(#fr-g)' : (m.border ? frameColor : bg);
  parts.push(`<rect x="0" y="0" width="${W}" height="${H}" rx="${m.radius}" fill="${shell}"/>`);

  const innerH = H - L.inset * 2;
  defs.push(`<clipPath id="fr-clip"><rect x="${L.inset}" y="${L.inset}" width="${L.contentW}" height="${innerH}" rx="${Math.max(0, m.radius - L.inset)}"/></clipPath>`);
  const clipped = [];
  if (grad) clipped.push(`<rect x="${L.inset}" y="${L.codeBoxY}" width="${L.contentW}" height="${L.codeBoxH}" rx="${m.innerRadius}" fill="${bg}"/>`);
  else clipped.push(`<rect x="${L.inset}" y="${L.inset}" width="${L.contentW}" height="${innerH}" fill="${bg}"/>`);

  const measure = makeLineMeasurer();
  const barSVG = (bar, y) => {
    if (!bar) return;
    const solid = bar.kind === 'solid' || bar.kind === 'pill';
    const ink = ctaInk(ctaColor, frameColor, solid);
    if (bar.kind === 'solid' && !grad) clipped.push(`<rect x="${L.inset}" y="${y}" width="${L.contentW}" height="${bar.height}" fill="${frameColor}"/>`);
    if (!frameText) return;
    let textTop = y + bar.padTop;
    if (bar.kind === 'pill') {
      // Approximate the chip from the font's average advance — the SVG has no
      // text metrics of its own, and the chip only has to hug the label.
      const approx = bar.font * 0.62 * [...frameText].length + trackingPx(m.font, bar.font) * ([...frameText].length - 1);
      const chipW = Math.round(approx) + bar.padX * 2;
      const chipX = L.inset + (L.contentW - chipW) / 2;
      const chipY = y + bar.marginTop;
      clipped.push(`<rect x="${chipX}" y="${chipY}" width="${chipW}" height="${bar.chipHeight}" rx="${bar.chipHeight / 2}" fill="${frameColor}"/>`);
      textTop = chipY + bar.padTop;
    }
    const lb = measure(m.font, bar.font);
    clipped.push(`<text x="${L.inset + L.contentW / 2}" y="${textTop + lb.ascent}" text-anchor="middle"`
      + ` font-family="${xmlEscape(m.font.css)}" font-size="${bar.font}" font-weight="${m.font.w}"`
      + ` letter-spacing="${trackingPx(m.font, bar.font)}" fill="${ink}">${xmlEscape(frameText)}</text>`);
  };
  barSVG(L.top, L.topY);
  barSVG(L.bottom, L.bottomY);

  // Re-host the code SVG's own body inside the frame at the right offset.
  const body = codeSVG.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  clipped.push(`<g transform="translate(${L.codeX} ${L.codeY})">${body}</g>`);

  parts.push(`<g clip-path="url(#fr-clip)">${clipped.join('')}</g>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`
    + `<defs>${defs.join('')}</defs>${parts.join('')}</svg>`;
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
// The seven module patterns, in the order the swatch row shows them.
const PATTERN_KEYS = ['star', 'realstar', 'diamond', 'circle', 'dot', 'rounded', 'square'];

export {
  buildPayload, maskPayload, payloadDensity, splitUtm, UTM_KEYS, getMatrix, buildSVG,
  renderReal, QUIET_MODULES, rrPathD, modSVG, finderSVG, drawMod, drawFinderReal,
  // style catalogues + the frame system (see "frame system" above)
  PATTERN_KEYS, CORNERS, CORNER_KEYS, drawCorner, paintCode,
  FRAMES, FRAME_KEYS, FRAME_BASE_PX, frameDef, FONTS, fontDef, CTA_SCALE,
  frameMetrics, frameLayout, makeLineMeasurer, ctaInk, fontShorthand, trackingPx,
  renderFramed, buildFramedSVG,
};
