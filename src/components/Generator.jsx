import { useEffect, useMemo, useRef, useState } from 'react';
import qrcode from 'qrcode-generator';

/*
  Generator island — visually matches the flagship design (QR Generator.dc.html):
  three-region card (config 404 · preview · templates rail), canvas swatches,
  color popovers, UTM panel, size slider, ECC segmented, logo + templates.
  The MAIN preview + export use the REAL qrcode-generator encoder (scannable).
  The rail thumbnails + control swatches use the design's decorative canvas draw.
*/

function track(event, props = {}) {
  try { if (window.umami) window.umami.track(event, props); } catch {}
  try { if (window.gtag) window.gtag('event', event, props); } catch {}
}

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
function renderReal(canvas, matrix, out, fg, bg, dot, finder, logoImg, logoShape, logoBorder) {
  const n = matrix.length, pad = out * 0.04, grid = out - pad * 2, cell = grid / n;
  canvas.width = out; canvas.height = out; const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, out, out);
  const fin = [[0, 0], [0, n - 7], [n - 7, 0]];
  for (const [fr, fc] of fin) drawFinderReal(ctx, pad + fc * cell, pad + fr * cell, cell, finder, fg, bg);
  const inFin = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) { if (inFin(r, c) || !matrix[r][c]) continue; drawMod(ctx, pad + c * cell + cell / 2, pad + r * cell + cell / 2, cell, dot, fg); }
  if (logoImg) bakeLogo(ctx, out, grid, logoImg, bg, fg, logoShape, logoBorder);
}

/* ---------------- decorative draws (swatches + rail thumbnails) ---------------- */
function drawSwatch(c) {
  const px = +c.dataset.px || 28, dpr = 2; c.width = px * dpr; c.height = px * dpr;
  const ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, px, px);
  ctx.fillStyle = '#6d4dff'; ctx.strokeStyle = '#6d4dff';
  const kind = c.dataset.kind, style = c.dataset.style;
  const rrf = (x, y, w, h, r, fill) => { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); fill ? ctx.fill() : ctx.stroke(); };
  if (kind === 'finder') {
    const cx = px / 2;
    if (style === 'circle') { ctx.lineWidth = px * 0.14; ctx.beginPath(); ctx.arc(cx, cx, px * 0.32, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cx, px * 0.13, 0, 7); ctx.fill(); }
    else { const s = px * 0.66, o = (px - s) / 2; const R = (v) => style === 'leaf' ? [v, 0, v, 0] : style === 'cushion' ? v * 1.55 : style === 'rounded' ? v : 0; ctx.lineWidth = px * 0.12; rrf(o, o, s, s, R(s * 0.3), false); const cs = px * 0.26, co = (px - cs) / 2; rrf(co, co, cs, cs, R(cs * 0.3), true); }
    return;
  }
  const n = 3, cell = px / n, g = cell * 0.72;
  for (let r = 0; r < n; r++) for (let cc = 0; cc < n; cc++) {
    const mx = (cc + 0.5) * cell, my = (r + 0.5) * cell;
    if (style === 'circle') { ctx.beginPath(); ctx.arc(mx, my, g / 2, 0, 7); ctx.fill(); }
    else if (style === 'dot') { ctx.beginPath(); ctx.arc(mx, my, g * 0.4, 0, 7); ctx.fill(); }
    else if (style === 'diamond') { ctx.save(); ctx.translate(mx, my); ctx.rotate(Math.PI / 4); ctx.fillRect(-g * 0.36, -g * 0.36, g * 0.72, g * 0.72); ctx.restore(); }
    else if (style === 'rounded') { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(mx - g / 2, my - g / 2, g, g, g * 0.3) : ctx.rect(mx - g / 2, my - g / 2, g, g); ctx.fill(); }
    else if (style === 'star') { const t = g * 0.32; ctx.fillRect(mx - t / 2, my - g / 2, t, g); ctx.fillRect(mx - g / 2, my - t / 2, g, t); }
    else if (style === 'realstar') { const R = g * 0.58, ri = R * 0.42; ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? ri : R, sx = mx + Math.cos(a) * rad, sy = my + Math.sin(a) * rad; i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); } ctx.closePath(); ctx.fill(); }
    else ctx.fillRect(mx - g / 2, my - g / 2, g, g);
  }
}
function drawThumb(c) {
  const px = +c.dataset.px || 110, dpr = 2; c.width = px * dpr; c.height = px * dpr;
  const ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const fg = c.dataset.fg || '#000', bg = c.dataset.bg || '#fff', dot = c.dataset.dot || 'square', finder = c.dataset.finder || 'square';
  let s = (+c.dataset.seed || 1) >>> 0; const rng = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const N = 29, quiet = 2, total = N + quiet * 2, cell = px / total; ctx.fillStyle = bg; ctx.fillRect(0, 0, px, px);
  const inF = (r, cc) => (r < 8 && cc < 8) || (r < 8 && cc >= N - 8) || (r >= N - 8 && cc < 8);
  for (let r = 0; r < N; r++) for (let cc = 0; cc < N; cc++) { if (inF(r, cc)) continue; if (rng() > 0.52) drawMod(ctx, (quiet + cc + 0.5) * cell, (quiet + r + 0.5) * cell, cell, dot, fg); }
  for (const [mr, mc] of [[0, 0], [0, N - 7], [N - 7, 0]]) drawFinderReal(ctx, (quiet + mc) * cell, (quiet + mr) * cell, cell, finder, fg, bg);
}

/* ---------------- data (from the flagship) ---------------- */
const DOTS = [{ k: 'star', l: 'PLUS' }, { k: 'realstar', l: 'STAR' }, { k: 'diamond', l: 'DIAMOND' }, { k: 'circle', l: 'CIRCLE' }, { k: 'square', l: 'SQUARE' }];
const FINDERS = [{ k: 'circle', l: 'CIRCLE' }, { k: 'rounded', l: 'ROUNDED' }, { k: 'square', l: 'SQUARE' }, { k: 'leaf', l: 'LEAF' }, { k: 'cushion', l: 'CUSHION' }];
/* Full preset catalog — verbatim from QR Generator.dc.html (do not trim). */
const CREATIVE = [
  { name: 'Classic', fg: '#1c1c1c', bg: '#ffffff', dot: 'square', finder: 'square', seed: 5 },
  { name: 'Rain', fg: '#2563eb', bg: '#eef4ff', dot: 'dot', finder: 'circle', seed: 6 },
  { name: 'Jungle', fg: '#2f7d32', bg: '#eff7ef', dot: 'rounded', finder: 'rounded', seed: 7 },
  { name: 'Coffee', fg: '#6f4e37', bg: '#f3e9dd', dot: 'square', finder: 'rounded', seed: 8 },
  { name: 'Ninja', fg: '#e11d74', bg: '#141414', dot: 'diamond', finder: 'circle', seed: 9 },
  { name: 'Mosaic', fg: '#9a3412', bg: '#fdf3ec', dot: 'square', finder: 'square', seed: 10 },
  { name: 'Sunset', fg: '#ea580c', bg: '#fff3e2', dot: 'circle', finder: 'rounded', seed: 11 },
  { name: 'Ocean', fg: '#0e7490', bg: '#ecfeff', dot: 'dot', finder: 'circle', seed: 12 },
  { name: 'Neon', fg: '#8b5cf6', bg: '#0b0b12', dot: 'star', finder: 'circle', seed: 13 },
  { name: 'Mono', fg: '#111111', bg: '#f5f4f1', dot: 'star', finder: 'rounded', seed: 14 },
  { name: 'Berry', fg: '#9d174d', bg: '#fdf2f8', dot: 'diamond', finder: 'rounded', seed: 15 },
  { name: 'Forest', fg: '#14532d', bg: '#f6faf4', dot: 'rounded', finder: 'square', seed: 16 },
];
const SOCIAL = [
  { name: 'Telegram', fg: '#229ED9', bg: '#eaf6fc', dot: 'dot', finder: 'circle', seed: 41, img: '/assets/logos/telegram.png' },
  { name: 'WhatsApp', fg: '#0f8a6d', bg: '#eafaf0', dot: 'rounded', finder: 'rounded', seed: 42, img: '/assets/logos/whatsapp.png' },
  { name: 'Instagram', fg: '#c1358a', bg: '#fdeef6', dot: 'circle', finder: 'rounded', seed: 43, img: '/assets/logos/instagram.png' },
  { name: 'YouTube', fg: '#e60000', bg: '#fff0f0', dot: 'square', finder: 'rounded', seed: 44, img: '/assets/logos/youtube.png' },
];
const INDUSTRY = [
  { name: 'Restaurant', content: 'https://your-restaurant.com/menu', fg: '#9a3412', bg: '#fdf3ec', dot: 'square', finder: 'rounded', seed: 61 },
  { name: 'Bar', content: 'https://your-bar.com/drinks', fg: '#8b5cf6', bg: '#0b0b12', dot: 'star', finder: 'circle', seed: 62 },
  { name: 'Coffee shop', content: 'https://your-cafe.com/order', fg: '#6f4e37', bg: '#f3e9dd', dot: 'square', finder: 'rounded', seed: 63 },
  { name: 'Small business', content: 'https://your-business.com', fg: '#111111', bg: '#f5f4f1', dot: 'star', finder: 'rounded', seed: 64 },
  { name: 'Hotel', content: 'https://your-hotel.com/guest-wifi', fg: '#0e7490', bg: '#ecfeff', dot: 'dot', finder: 'circle', seed: 66 },
  { name: 'Real estate', content: 'https://listings.com/123-main-st', fg: '#14532d', bg: '#f6faf4', dot: 'rounded', finder: 'square', seed: 67 },
  { name: 'Gym', content: 'https://your-gym.com/join', fg: '#2563eb', bg: '#eef4ff', dot: 'dot', finder: 'circle', seed: 68 },
  { name: 'Salon & spa', content: 'https://your-salon.com/book', fg: '#9d174d', bg: '#fdf2f8', dot: 'rounded', finder: 'rounded', seed: 69 },
  { name: 'Nonprofit', content: 'https://donate.org/give', fg: '#2f7d32', bg: '#eff7ef', dot: 'rounded', finder: 'rounded', seed: 70 },
  { name: 'Food truck', content: 'https://find-our-truck.com', fg: '#ea580c', bg: '#fff3e2', dot: 'circle', finder: 'rounded', seed: 71 },
  { name: 'Event', content: 'https://your-event.com/tickets', fg: '#8b5cf6', bg: '#0b0b12', dot: 'diamond', finder: 'circle', seed: 72 },
];
const USECASE = [
  { name: 'Menu', content: 'https://your-restaurant.com/menu', fg: '#9a3412', bg: '#fdf3ec', dot: 'square', finder: 'rounded', seed: 81 },
  { name: 'Promotion', content: 'https://shop.com/promo?code=SAVE20', fg: '#ea580c', bg: '#fff3e2', dot: 'circle', finder: 'rounded', seed: 82 },
  { name: 'Business card', content: 'https://your-name.com/contact', fg: '#1c1c1c', bg: '#ffffff', dot: 'rounded', finder: 'rounded', seed: 83 },
  { name: 'Reviews', content: 'https://g.page/r/your-place/review', fg: '#2f7d32', bg: '#eff7ef', dot: 'rounded', finder: 'rounded', seed: 84 },
  { name: 'Feedback', content: 'https://forms.gle/your-feedback', fg: '#0e7490', bg: '#ecfeff', dot: 'dot', finder: 'circle', seed: 85 },
  { name: 'Flyer', content: 'https://your-event.com/info', fg: '#9d174d', bg: '#fdf2f8', dot: 'diamond', finder: 'rounded', seed: 86 },
  { name: 'Packaging', content: 'https://brand.com/product/setup', fg: '#6f4e37', bg: '#f3e9dd', dot: 'square', finder: 'rounded', seed: 87 },
  { name: 'Table tent', content: 'https://your-restaurant.com/menu', fg: '#9a3412', bg: '#fdf3ec', dot: 'square', finder: 'rounded', seed: 88 },
  { name: 'Social', content: 'https://instagram.com/yourhandle', fg: '#c1358a', bg: '#fdeef6', dot: 'circle', finder: 'rounded', seed: 89 },
];
const PRESET_COUNT = CREATIVE.length + SOCIAL.length + INDUSTRY.length + USECASE.length;
const FG_PRESETS = ['#2563eb', '#1c1c1c', '#6d4dff', '#0e7490', '#e11d74', '#2f7d32'];
const BG_PRESETS = ['#ffffff', '#eef4ff', '#f3e9dd', '#fdf2f8', '#ecfeff', '#141414'];
const ECC_DATA = { L: { n: 'Low', r: '7% recovery', f: '25%' }, M: { n: 'Medium', r: '15% recovery', f: '50%' }, Q: { n: 'Quartile', r: '25% recovery · best with a logo', f: '75%' }, H: { n: 'High', r: '30% recovery', f: '100%' } };
const THEMES = [{ n: 'cream', c: '#faf6ec' }, { n: 'sand', c: '#e7dcc4' }, { n: 'olive', c: '#59603c' }, { n: 'slate', c: '#302c3b' }];

/* ---------------- component ---------------- */
export default function Generator({ mode = 'url', supportUrl = '', thanks = '' }) {
  const mainRef = useRef(null);
  const rootRef = useRef(null);
  const bodyRef = useRef(null);
  const cfgScrollRef = useRef(null);
  const cfgFooterRef = useRef(null);
  const [fields, setFields] = useState({ url: 'https://qrcodeagent.net', enc: 'WPA', utm: {} });
  const [dot, setDot] = useState('star');
  const [finder, setFinder] = useState('circle');
  const [fg, setFg] = useState('#2563eb');
  const [bg, setBg] = useState('#eef4ff');
  const [size, setSize] = useState(512);
  const [ecc, setEcc] = useState('Q');
  const [logoImg, setLogoImg] = useState(null);
  const [useLogo, setUseLogo] = useState(false);
  const [logoShape, setLogoShape] = useState('circle');
  const [logoBorder, setLogoBorder] = useState('none');
  const [fgOpen, setFgOpen] = useState(false);
  const [bgOpen, setBgOpen] = useState(false);
  const [utmOpen, setUtmOpen] = useState(false);
  const [eccTip, setEccTip] = useState(false);
  const [railOpen, setRailOpen] = useState(true);
  const [sel, setSel] = useState('Rain');
  const [theme, setTheme] = useState('cream');
  const [scannable, setScannable] = useState(true);
  const [saved, setSaved] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState(false);
  const [askSupport, setAskSupport] = useState(false);

  // fitHeight — the config column never scrolls; the body row grows to fit it
  // (ported from QR Generator.dc.html). Below 1120px the media query stacks the
  // columns and height is auto, so we leave the inline value off.
  useEffect(() => {
    const body = bodyRef.current, scroll = cfgScrollRef.current, footer = cfgFooterRef.current;
    if (!body || !scroll || !footer) return;
    const fit = () => {
      if (window.innerWidth <= 1120) { body.style.height = ''; return; }
      body.style.height = scroll.scrollHeight + footer.offsetHeight + 20 + 'px';
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(scroll); ro.observe(footer);
    window.addEventListener('resize', fit);
    return () => { ro.disconnect(); window.removeEventListener('resize', fit); };
  }, []);

  const payload = useMemo(() => buildPayload(mode, fields), [mode, fields]);
  const setF = (k, v) => setFields((f) => ({ ...f, [k]: v }));
  const setUtm = (k, v) => setFields((f) => ({ ...f, utm: { ...f.utm, [k]: v } }));

  // main preview (real)
  useEffect(() => {
    const c = mainRef.current; if (!c) return;
    if (!payload) { setScannable(false); return; }
    let m, ok = true; try { m = getMatrix(payload, ecc); } catch { try { m = getMatrix(payload, 'H'); } catch { ok = false; } }
    if (!ok) { setScannable(false); return; }
    setScannable(!(useLogo && logoImg) || ecc === 'Q' || ecc === 'H');
    renderReal(c, m, size, fg, bg, dot, finder, (useLogo && logoImg) ? logoImg : null, logoShape, logoBorder);
  }, [payload, dot, finder, fg, bg, size, ecc, logoImg, useLogo, logoShape, logoBorder]);

  // decorative swatches + thumbnails
  useEffect(() => {
    const root = rootRef.current; if (!root) return;
    root.querySelectorAll('canvas.swx').forEach(drawSwatch);
    root.querySelectorAll('canvas.thumb').forEach(drawThumb);
  });

  // close popovers on outside click
  useEffect(() => {
    const h = (e) => { if (!e.target.closest('[data-pop]')) { setFgOpen(false); setBgOpen(false); } };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, []);

  function applyTheme(t) { setTheme(t); try { document.documentElement.setAttribute('data-theme', t === 'cream' ? '' : t); } catch {} track('theme_switch', { theme: t }); }
  function onLogo(e) { const file = e.target.files?.[0]; if (!file) return; const rd = new FileReader(); rd.onload = (ev) => { const i = new Image(); i.onload = () => { setLogoImg(i); setUseLogo(true); }; i.src = ev.target.result; }; rd.readAsDataURL(file); }
  function pickTemplate(t) { setSel(t.name); setFg(t.fg); setBg(t.bg); setDot(t.dot); setFinder(t.finder); if (t.content) setF('url', t.content); track('template_selected', { name: t.name }); }
  // Post-download support ask (site.support.placements). Shown inline under the
  // download row only AFTER a successful download, never as a modal, and never
  // blocking the file. Dismissal is remembered so it asks once, not every time.
  const SUPPORT_KEY = 'qra:supportAsked';
  function offerSupport() {
    if (!supportUrl) return;
    try { if (localStorage.getItem(SUPPORT_KEY)) return; } catch {}
    setAskSupport(true);
  }
  function dismissSupport() {
    try { localStorage.setItem(SUPPORT_KEY, '1'); } catch {}
    setAskSupport(false);
  }

  function downloadPNG() { const a = document.createElement('a'); a.download = 'qrcode.png'; a.href = mainRef.current.toDataURL('image/png'); a.click(); track('download_png', { mode }); offerSupport(); }
  function downloadSVG() { const c = mainRef.current, s = c.width, d = c.toDataURL('image/png'); const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}"><image href="${d}" width="${s}" height="${s}"/></svg>`; const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })); const a = document.createElement('a'); a.download = 'qrcode.svg'; a.href = url; a.click(); URL.revokeObjectURL(url); track('download_svg', { mode }); offerSupport(); }

  // ---- saved designs (BACKLOG P1, ported from ui_kits/website/saved-designs.html).
  // Local to this browser only — no account, nothing uploaded. Stored under
  // `qra:saved`, which the privacy page documents.
  const SAVED_KEY = 'qra:saved';
  const readSaved = () => { try { return JSON.parse(localStorage.getItem(SAVED_KEY) || '[]'); } catch { return []; } };
  const writeSaved = (list) => { try { localStorage.setItem(SAVED_KEY, JSON.stringify(list.slice(0, 50))); } catch {} setSaved(list.slice(0, 50)); };

  useEffect(() => { setSaved(readSaved()); }, []);

  function saveDesign() {
    const name = sel ? `${sel} · ${mode}` : `${mode} design`;
    const entry = { id: `${Date.now()}-${saved.length}`, name, mode, fields, dot, finder, fg, bg, size, ecc, ts: Date.now() };
    writeSaved([entry, ...readSaved()]);
    setToast(true); clearTimeout(saveDesign._t); saveDesign._t = setTimeout(() => setToast(false), 2000);
    track('save_design', { mode });
  }
  function deleteSaved(id) { writeSaved(readSaved().filter((s) => s.id !== id)); }
  function renameSaved(id, name) {
    writeSaved(readSaved().map((s) => (s.id === id ? { ...s, name: name.trim() || s.name } : s)));
    setEditing(null);
  }
  // `mode` is fixed by the page (page.tool.mode), so loading a design restores its
  // styling and field values but never switches the page's input mode. Fields not
  // relevant to this page's mode are simply unused.
  function applySaved(s) {
    setFields(s.fields); setDot(s.dot); setFinder(s.finder);
    setFg(s.fg); setBg(s.bg); setSize(s.size); setEcc(s.ecc);
    setDrawerOpen(false); track('saved_applied', { mode: s.mode });
  }
  const savedDate = (ts) => {
    const d = new Date(ts), now = new Date();
    return d.toDateString() === now.toDateString()
      ? 'today'
      : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const ecd = ECC_DATA[ecc];
  const dotBtn = (on) => `dotbtn${on ? ' on' : ''}`;

  return (
    <div className="genflag" ref={rootRef}>
      {/* top bar */}
      <div className="gf-top">
        <div className="gf-brand"><span className="gf-tile">QR</span><span><b>Custom QR Codes</b><i>Styled dots · Circular finders · Logo overlay</i></span></div>
        <div className="gf-themes">{THEMES.map((t) => <button key={t.n} className={theme === t.n ? 'on' : ''} style={{ background: t.c }} title={t.n} onClick={() => applyTheme(t.n)} />)}</div>
      </div>

      {/* content row */}
      <div className="gf-content">
        <div className="gf-crow">
          <ModeFields mode={mode} fields={fields} setF={setF} />
          {mode === 'url' && <button className="gf-utm" onClick={() => setUtmOpen((v) => !v)}>UTM TRACKING <span>{utmOpen ? '▴' : '▾'}</span></button>}
        </div>
        {mode === 'url' && utmOpen && (
          <div className="gf-utmpanel">
            <div className="g3">{['source', 'medium', 'campaign'].map((k) => (<label key={k}><span>utm_{k} *</span><input value={fields.utm[k] || ''} onChange={(e) => setUtm(k, e.target.value)} placeholder={k === 'source' ? 'newsletter' : k === 'medium' ? 'social' : 'spring_launch'} /></label>))}</div>
            <div className="g2">{['term', 'content'].map((k) => (<label key={k}><span>utm_{k}</span><input value={fields.utm[k] || ''} onChange={(e) => setUtm(k, e.target.value)} placeholder="optional" /></label>))}</div>
            <div className="gf-encoded"><span className="k">ENCODED</span><span className="v">{payload}</span></div>
          </div>
        )}
      </div>

      {/* body */}
      <div className="gf-body" ref={bodyRef}>
        {/* config */}
        <div className="gf-config">
          <div className="gf-cfg-scroll" ref={cfgScrollRef}>
            <div>
              <div className="lab">Dot style</div>
              <div className="gf-grid5">{DOTS.map((d) => <button key={d.k} className={dotBtn(dot === d.k)} onClick={() => setDot(d.k)}><canvas className="swx" data-px="28" data-kind="dot" data-style={d.k} style={{ width: 28, height: 28 }} />{d.l}</button>)}</div>
            </div>
            <div>
              <div className="lab">Finder pattern</div>
              <div className="gf-grid5">{FINDERS.map((f) => <button key={f.k} className={dotBtn(finder === f.k)} onClick={() => setFinder(f.k)}><canvas className="swx" data-px="28" data-kind="finder" data-style={f.k} style={{ width: 28, height: 28 }} />{f.l}</button>)}</div>
            </div>
            <div className="g2">
              <ColorField label="Foreground" val={fg} open={fgOpen} setOpen={(v) => { setFgOpen(v); setBgOpen(false); }} onPick={setFg} presets={FG_PRESETS} align="left" />
              <ColorField label="Background" val={bg} open={bgOpen} setOpen={(v) => { setBgOpen(v); setFgOpen(false); }} onPick={setBg} presets={BG_PRESETS} align="right" />
            </div>
            <div>
              <div className="lab spread"><span>Output size</span><span className="accent">{size} px</span></div>
              <div className="gf-slider">
                <span className="track" /><span className="fill" style={{ width: `${((size - 200) / 1800) * 100}%` }} /><span className="knob" style={{ left: `${((size - 200) / 1800) * 100}%` }} />
                <input type="range" min="200" max="2000" step="8" value={size} onChange={(e) => setSize(+e.target.value)} />
              </div>
            </div>
            <div>
              <div className="lab tiprow"><span>Error correction</span><button className="gf-i" onMouseEnter={() => setEccTip(true)} onMouseLeave={() => setEccTip(false)}>i</button>{eccTip && <span className="gf-tip">Error correction bakes in redundant data so the code still scans when part of it is covered. Higher levels recover more but pack denser dots — pick Q or H when you add a center logo.</span>}</div>
              <div className="gf-seg">{['L', 'M', 'Q', 'H'].map((l) => <button key={l} className={ecc === l ? 'on' : ''} onClick={() => setEcc(l)}>{l}</button>)}</div>
              <div className="gf-bar"><span style={{ width: ecd.f }} /></div>
              <div className="gf-cap">{ecc} — {ecd.n} · {ecd.r}</div>
            </div>
            <div>
              <div className="lab spread"><span>Center logo</span><button className={`gf-toggle${useLogo ? ' on' : ''}`} onClick={() => setUseLogo((v) => !v)}><span /></button></div>
              {useLogo && (
                <div className="gf-logo">
                  <label className="gf-drop">Drop image or click to upload<i>PNG with transparency</i><input type="file" accept="image/*" hidden onChange={onLogo} /></label>
                  <div className="g2">
                    <div><div className="micro">SHAPE</div><div className="gf-seg sm">{['circle', 'square'].map((s) => <button key={s} className={logoShape === s ? 'on' : ''} onClick={() => setLogoShape(s)}>{s === 'circle' ? '◉' : '▣'} {s.toUpperCase()}</button>)}</div></div>
                    <div><div className="micro">BORDER</div><div className="gf-seg sm">{['none', 'border'].map((b) => <button key={b} className={logoBorder === b ? 'on' : ''} onClick={() => setLogoBorder(b)}>{b === 'none' ? '◼' : '▢'} {b.toUpperCase()}</button>)}</div></div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="gf-cfg-footer" ref={cfgFooterRef}><button className="gf-generate" onClick={downloadSVG}>GENERATE QR CODE</button></div>
        </div>

        {/* preview */}
        <div className="gf-preview">
          <div className="gf-plabel">
            <span className="lab">Live preview</span>
            <div className="gf-savebtns">
              <button className="save" onClick={saveDesign} title="Save this design to this browser">♥ SAVE DESIGN</button>
              {saved.length > 0 && <button className="open" onClick={() => setDrawerOpen(true)}>SAVED · {saved.length} ›</button>}
              {!railOpen && <button className="gf-railtoggle" onClick={() => setRailOpen(true)}>TEMPLATES ‹</button>}
            </div>
          </div>
          {toast && <div className="gf-toast">✓ Saved to this browser</div>}
          <div className="gf-stage"><div className="gf-mat"><canvas ref={mainRef} /></div></div>
          <div className="gf-chips">
            <span className="chip">{size} × {size} px</span><span className="chip">ECC · {ecc}</span><span className="chip">{finder} finders</span>
            <span className={`chip ${scannable ? 'ok' : 'warn'}`}>{scannable ? '✓ Scannable' : '⚠ At risk'}</span>
          </div>
          <div className="gf-dl"><button className="dl" onClick={downloadPNG}>↓ DOWNLOAD PNG</button><button className="dl primary" onClick={downloadSVG}>↓ DOWNLOAD SVG</button></div>
          {askSupport && (
            <div className="gf-support">
              <p>{thanks}</p>
              <div className="gf-support-acts">
                <a href={supportUrl} target="_blank" rel="noopener" data-support="post_download"
                   onClick={() => { track('support_click', { placement: 'post_download', mode }); dismissSupport(); }}>☕ BUY ME A COFFEE</a>
                <button onClick={dismissSupport} aria-label="Dismiss">✕</button>
              </div>
            </div>
          )}
        </div>

        {/* saved-designs drawer — ported from ui_kits/website/saved-designs.html */}
        {drawerOpen && (
          <div className="gf-drawer">
            <div className="dhead">
              <div className="l"><b>Saved designs</b><span>{saved.length} of ∞</span></div>
              <button className="x" onClick={() => setDrawerOpen(false)} aria-label="Close saved designs">✕</button>
            </div>
            <div className="dlist">
              {saved.map((s) => (
                <div className={`ditem${editing === s.id ? ' edit' : ''}`} key={s.id}>
                  <button className="th" onClick={() => applySaved(s)} title="Load this design" style={{ background: s.bg }}>
                    <span style={{ background: s.fg }} />
                  </button>
                  {editing === s.id ? (
                    <div className="dmeta">
                      <input className="nm-input" defaultValue={s.name} autoFocus
                        onKeyDown={(e) => { if (e.key === 'Enter') renameSaved(s.id, e.target.value); if (e.key === 'Escape') setEditing(null); }} />
                    </div>
                  ) : (
                    <button className="dmeta" onClick={() => applySaved(s)} title="Load this design">
                      <span className="nm">{s.name}</span>
                      <span className="sub">{s.mode} · {s.size}px · {savedDate(s.ts)}</span>
                    </button>
                  )}
                  <div className="dacts">
                    {editing === s.id ? (
                      <>
                        <button className="ok" title="Save name" onClick={(e) => renameSaved(s.id, e.target.closest('.ditem').querySelector('.nm-input').value)}>✓</button>
                        <button title="Cancel" onClick={() => setEditing(null)}>↺</button>
                      </>
                    ) : (
                      <>
                        <button title="Rename" onClick={() => setEditing(s.id)}>✎</button>
                        <button title="Delete" onClick={() => deleteSaved(s.id)}>✕</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="dfoot"><p><b>Saved on this device only</b> — no account needed. Clearing your browser data removes them.</p></div>
          </div>
        )}

        {/* templates rail */}
        <div className="gf-rail" style={{ flexBasis: railOpen ? 306 : 0, width: railOpen ? 306 : 0 }}>
          <div className="gf-railinner">
            <div className="gf-railhead"><div><b>Templates</b> <i>{PRESET_COUNT} presets</i></div><button onClick={() => setRailOpen(false)}>›</button></div>
            <div className="gf-railscroll">
              <RailGroup title="By industry" items={INDUSTRY} sel={sel} onPick={pickTemplate} />
              <RailGroup title="By use case" items={USECASE} sel={sel} onPick={pickTemplate} />
              <RailGroup title="Social" items={SOCIAL} sel={sel} onPick={pickTemplate} social />
              <RailGroup title="Creative themes" items={CREATIVE} sel={sel} onPick={pickTemplate} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ColorField({ label, val, open, setOpen, onPick, presets, align }) {
  return (
    <div>
      <div className="lab">{label}</div>
      <div className="gf-colorpop" data-pop>
        <button className="gf-colorbtn" onClick={() => setOpen(!open)}><span className="sw" style={{ background: val }} /><span className="hex">{val.toUpperCase()}</span><span className="chev">{open ? '▴' : '▾'}</span></button>
        {open && (
          <div className={`gf-popover ${align}`}>
            <div className="gf-pophead"><span className="big" style={{ background: val }} /><div><b>{val.toUpperCase()}</b><i>Drag the bar to pick any color</i></div></div>
            <label className="gf-bar-input"><span className="rainbow" /><input type="color" value={val} onChange={(e) => onPick(e.target.value)} /></label>
            <div className="gf-presets"><div className="micro">Presets</div><div className="g6">{presets.map((c) => <button key={c} className={c === val.toLowerCase() ? 'on' : ''} style={{ background: c }} onClick={() => onPick(c)} />)}</div></div>
          </div>
        )}
      </div>
    </div>
  );
}

function RailGroup({ title, items, sel, onPick, social }) {
  return (
    <div className="gf-railgroup">
      <div className="micro">{title}</div>
      <div className="g2">
        {items.map((t) => (
          <button key={t.name} className={`gf-card${sel === t.name ? ' on' : ''}`} onClick={() => onPick(t)} title={t.content || t.name}>
            <span className="thumbwrap">
              <canvas className="thumb" data-px="110" data-fg={t.fg} data-bg={t.bg} data-dot={t.dot} data-finder={t.finder} data-seed={t.seed} />
              {social && t.img && <span className="thumblogo"><img src={t.img} alt={t.name} /></span>}
            </span>
            <span className="tname">{t.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ModeFields({ mode, fields, setF }) {
  if (mode === 'wifi') return (
    <div className="gf-modefields">
      <span className="lab flat">WiFi</span>
      <input value={fields.ssid || ''} onChange={(e) => setF('ssid', e.target.value)} placeholder="Network name (SSID)" />
      <div className="gf-seg sm inline">{['WPA', 'WEP', 'nopass'].map((v) => <button key={v} className={(fields.enc || 'WPA') === v ? 'on' : ''} onClick={() => setF('enc', v)}>{v === 'nopass' ? 'NONE' : v}</button>)}</div>
      <input value={fields.pass || ''} onChange={(e) => setF('pass', e.target.value)} placeholder="Password" />
    </div>
  );
  if (mode === 'vcard') return (
    <div className="gf-modefields grid">
      <input value={fields.first || ''} onChange={(e) => setF('first', e.target.value)} placeholder="First name" />
      <input value={fields.last || ''} onChange={(e) => setF('last', e.target.value)} placeholder="Last name" />
      <input value={fields.phone || ''} onChange={(e) => setF('phone', e.target.value)} placeholder="Phone" />
      <input value={fields.email || ''} onChange={(e) => setF('email', e.target.value)} placeholder="Email" />
      <input value={fields.company || ''} onChange={(e) => setF('company', e.target.value)} placeholder="Company" />
      <input value={fields.website || ''} onChange={(e) => setF('website', e.target.value)} placeholder="Website" />
    </div>
  );
  if (mode === 'whatsapp') return (
    <div className="gf-modefields">
      <input value={fields.number || ''} onChange={(e) => setF('number', e.target.value)} placeholder="WhatsApp number (with country code)" />
      <input value={fields.message || ''} onChange={(e) => setF('message', e.target.value)} placeholder="Pre-filled message (optional)" />
    </div>
  );
  return (<><span className="gf-clabel">Content / URL</span><input className="gf-cinput" value={fields.url || ''} onChange={(e) => setF('url', e.target.value)} placeholder="https://your-link.com" /></>);
}
