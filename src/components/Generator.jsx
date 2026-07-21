import { useEffect, useMemo, useRef, useState } from 'react';
import { buildPayload, splitUtm, getMatrix, buildSVG, renderReal, drawMod, drawFinderReal, hasContent as hasContentFor } from '../lib/qr.js';
import { MOBILE_BREAKPOINT } from '../lib/mobile.js';

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
/* v5: Industry/Use-case templates are FULL design presets — they carry ecc, logo
   on/off, logo shape and border alongside colour/dot/finder, plus the `group`
   chip shown next to the URL. Verbatim from examplesData() in the v5 handoff. */
const INDUSTRY = [
  { name: 'Restaurant', group: 'Restaurants', content: 'https://your-restaurant.com/menu', fg: '#9a3412', bg: '#fdf3ec', dot: 'square', finder: 'rounded', seed: 61, ecc: 'M', logo: false },
  { name: 'Bar', group: 'Bars', content: 'https://your-bar.com/drinks', fg: '#8b5cf6', bg: '#0b0b12', dot: 'star', finder: 'circle', seed: 62, ecc: 'Q', logo: true, shape: 'circle', border: 'border' },
  { name: 'Coffee shop', group: 'Coffee shops', content: 'https://your-cafe.com/order', fg: '#6f4e37', bg: '#f3e9dd', dot: 'square', finder: 'rounded', seed: 63, ecc: 'M', logo: true, shape: 'circle', border: 'none' },
  { name: 'Small business', group: 'Small business', content: 'https://your-business.com', fg: '#111111', bg: '#f5f4f1', dot: 'star', finder: 'rounded', seed: 64, ecc: 'H', logo: true, shape: 'square', border: 'border' },
  { name: 'Hotel', group: 'Hotels', content: 'https://your-hotel.com/guest-wifi', fg: '#0e7490', bg: '#ecfeff', dot: 'dot', finder: 'circle', seed: 66, ecc: 'Q', logo: false },
  { name: 'Real estate', group: 'Real estate', content: 'https://listings.com/123-main-st', fg: '#14532d', bg: '#f6faf4', dot: 'rounded', finder: 'square', seed: 67, ecc: 'M', logo: true, shape: 'square', border: 'none' },
  { name: 'Gym', group: 'Gyms', content: 'https://your-gym.com/join', fg: '#2563eb', bg: '#eef4ff', dot: 'dot', finder: 'circle', seed: 68, ecc: 'Q', logo: true, shape: 'circle', border: 'border' },
  { name: 'Salon & spa', group: 'Salons & spas', content: 'https://your-salon.com/book', fg: '#9d174d', bg: '#fdf2f8', dot: 'rounded', finder: 'rounded', seed: 69, ecc: 'H', logo: true, shape: 'circle', border: 'none' },
  { name: 'Nonprofit', group: 'Nonprofits', content: 'https://donate.org/give', fg: '#2f7d32', bg: '#eff7ef', dot: 'rounded', finder: 'rounded', seed: 70, ecc: 'M', logo: false },
  { name: 'Food truck', group: 'Food trucks', content: 'https://find-our-truck.com', fg: '#ea580c', bg: '#fff3e2', dot: 'circle', finder: 'rounded', seed: 71, ecc: 'Q', logo: true, shape: 'circle', border: 'border' },
  { name: 'Event', group: 'Events', content: 'https://your-event.com/tickets', fg: '#8b5cf6', bg: '#0b0b12', dot: 'diamond', finder: 'circle', seed: 72, ecc: 'H', logo: false },
];
const USECASE = [
  { name: 'Menu', group: 'Menus', content: 'https://your-restaurant.com/menu', fg: '#9a3412', bg: '#fdf3ec', dot: 'square', finder: 'rounded', seed: 81, ecc: 'M', logo: false },
  { name: 'Promotion', group: 'Promotions', content: 'https://shop.com/promo?code=SAVE20', fg: '#ea580c', bg: '#fff3e2', dot: 'circle', finder: 'rounded', seed: 82, ecc: 'Q', logo: true, shape: 'circle', border: 'border' },
  { name: 'Business card', group: 'Business cards', content: 'https://your-name.com/contact', fg: '#1c1c1c', bg: '#ffffff', dot: 'rounded', finder: 'rounded', seed: 83, ecc: 'M', logo: true, shape: 'square', border: 'none' },
  // Not in the v5 preset list, but shipped since launch and counted in the
  // "36 presets" label — kept, with no ecc/logo keys so it leaves those as-is.
  { name: 'Reviews', group: 'Reviews', content: 'https://g.page/r/your-place/review', fg: '#2f7d32', bg: '#eff7ef', dot: 'rounded', finder: 'rounded', seed: 84 },
  { name: 'Feedback', group: 'Feedback', content: 'https://forms.gle/your-feedback', fg: '#0e7490', bg: '#ecfeff', dot: 'dot', finder: 'circle', seed: 85, ecc: 'Q', logo: false },
  { name: 'Flyer', group: 'Flyers', content: 'https://your-event.com/info', fg: '#9d174d', bg: '#fdf2f8', dot: 'diamond', finder: 'rounded', seed: 86, ecc: 'H', logo: true, shape: 'circle', border: 'none' },
  { name: 'Packaging', group: 'Packaging', content: 'https://brand.com/product/setup', fg: '#6f4e37', bg: '#f3e9dd', dot: 'square', finder: 'rounded', seed: 87, ecc: 'H', logo: true, shape: 'square', border: 'border' },
  { name: 'Table tent', group: 'Table tents', content: 'https://your-restaurant.com/menu', fg: '#9a3412', bg: '#fdf3ec', dot: 'square', finder: 'rounded', seed: 88, ecc: 'M', logo: false },
  { name: 'Social', group: 'Social media', content: 'https://instagram.com/yourhandle', fg: '#c1358a', bg: '#fdeef6', dot: 'circle', finder: 'rounded', seed: 89, ecc: 'Q', logo: true, shape: 'circle', border: 'none' },
];
const PRESET_COUNT = CREATIVE.length + SOCIAL.length + INDUSTRY.length + USECASE.length;
const FG_PRESETS = ['#2563eb', '#1c1c1c', '#6d4dff', '#0e7490', '#e11d74', '#2f7d32'];
const BG_PRESETS = ['#ffffff', '#eef4ff', '#f3e9dd', '#fdf2f8', '#ecfeff', '#141414'];
const ECC_DATA = {
  L: { n: 'Low', p: '7%', r: '7% recovery', f: '25%' },
  M: { n: 'Medium', p: '15%', r: '15% recovery', f: '50%' },
  Q: { n: 'Quartile', p: '25%', r: '25% recovery · best with a logo', f: '75%' },
  H: { n: 'High', p: '30%', r: '30% recovery', f: '100%' },
};
/* v5: the rail is tabbed and Social is the default tab. */
const TABS = [{ k: 'social', l: 'Social' }, { k: 'industry', l: 'Industry' }, { k: 'usecase', l: 'Use case' }, { k: 'themes', l: 'Themes' }];
const DOT_NAMES = { star: 'Plus', realstar: 'Star', diamond: 'Diamond', circle: 'Circle', square: 'Square', dot: 'Dot', rounded: 'Rounded' };
const FINDER_NAMES = { circle: 'Circle', rounded: 'Rounded', square: 'Square', leaf: 'Leaf', cushion: 'Cushion' };

/* WCAG relative-luminance contrast ratio. v5 warns below 3.5 — scanners need a
   real light/dark split between modules and background, not just "different". */
function contrastRatio(a, b) {
  const lum = (h) => {
    const m = (h || '#000').replace('#', '');
    const n = m.length === 3 ? m.split('').map((x) => x + x).join('') : m;
    const ch = (i) => { const v = parseInt(n.slice(i, i + 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * ch(0) + 0.7152 * ch(2) + 0.0722 * ch(4);
  };
  const l1 = lum(a), l2 = lum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/* ---------------- component ---------------- */
export default function Generator({ mode = 'url', supportUrl = '', thanks = '' }) {
  const mainRef = useRef(null);
  const rootRef = useRef(null);
  const bodyRef = useRef(null);
  const cfgScrollRef = useRef(null);
  const cfgFooterRef = useRef(null);
  const pulseRef = useRef(false);
  const [fields, setFields] = useState({ url: 'https://qrcodeagent.net', enc: 'WPA', utm: {} });
  const [dot, setDot] = useState('star');
  const [finder, setFinder] = useState('circle');
  const [fg, setFg] = useState('#2563eb');
  const [bg, setBg] = useState('#eef4ff');
  const [size, setSize] = useState(512);
  const [ecc, setEcc] = useState('Q');
  const [logoImg, setLogoImg] = useState(null);
  const [useLogo, setUseLogo] = useState(true);
  const [logoShape, setLogoShape] = useState('circle');
  const [logoBorder, setLogoBorder] = useState('none');
  const [fgOpen, setFgOpen] = useState(false);
  const [bgOpen, setBgOpen] = useState(false);
  const [utmOpen, setUtmOpen] = useState(false);
  const [eccTip, setEccTip] = useState(false);
  // Must match the server render exactly. Reading window.innerWidth here made the
  // first client render disagree with the SSR HTML on any viewport <= 900px, which
  // is most phones: React threw a hydration error and re-rendered the whole island
  // from scratch. The effect below collapses the rail on mobile after mount, which
  // is the SSR-safe way to do the same thing.
  const [railOpen, setRailOpen] = useState(true);
  const [templateTab, setTemplateTab] = useState('social');
  const [exampleTag, setExampleTag] = useState('');
  const [sel, setSel] = useState('Rain');
  const [scannable, setScannable] = useState(true);
  const [saved, setSaved] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerTriggerRef = useRef(null);
  const drawerRef = useRef(null);
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState(false);

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

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const onChange = (e) => { if (e.matches) setRailOpen(false); };
    if (mq.matches) setRailOpen(false);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const payload = useMemo(() => buildPayload(mode, fields), [mode, fields]);
  // buildPayload always returns the structural scaffolding for vCard and WiFi
  // (BEGIN:VCARD.../WIFI:T:...), so `payload` is truthy even when every field is
  // blank — you could export a code encoding an empty contact card. Gate the
  // export on real user content instead.
  const hasContent = useMemo(() => hasContentFor(mode, fields), [mode, fields]);
  // Typing your own URL means you are no longer on a template's example content,
  // so the example-tag chip goes away.
  const setF = (k, v) => { if (k === 'url') setExampleTag(''); setFields((f) => ({ ...f, [k]: v })); };
  /* The URL field shows the TAGGED link, so what the user sees is what the QR
     encodes and what they can copy. `fields.url` stays the untagged base, so
     editing a UTM value recomposes from the base instead of appending to an
     already-tagged string. Edits typed into the field are split back apart. */
  const onUrlInput = (v) => { setExampleTag(''); const { base, utm } = splitUtm(v); setFields((f) => ({ ...f, url: base, utm })); };
  const setUtm = (k, v) => setFields((f) => ({ ...f, utm: { ...f.utm, [k]: v } }));

  // main preview (real)
  useEffect(() => {
    const c = mainRef.current; if (!c) return;
    if (!payload) { setScannable(false); return; }
    let m, ok = true; try { m = getMatrix(payload, ecc); } catch { try { m = getMatrix(payload, 'H'); } catch { ok = false; } }
    if (!ok) { setScannable(false); return; }
    renderReal(c, m, size, fg, bg, dot, finder, (useLogo && logoImg) ? logoImg : null, logoShape, logoBorder);
    // v5 redraw pulse — a 200ms fade+scale so a style change reads as a redraw
    // rather than a silent swap. Only fires for style changes, never for typing.
    if (pulseRef.current) {
      pulseRef.current = false;
      if (c.animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        c.animate([{ opacity: .35, transform: 'scale(.98)' }, { opacity: 1, transform: 'scale(1)' }],
          { duration: 200, easing: 'cubic-bezier(.2,.7,.3,1)' });
      }
    }
  }, [payload, dot, finder, fg, bg, size, ecc, logoImg, useLogo, logoShape, logoBorder]);

  // v5 scannability: WCAG contrast between modules and background must clear 3.5,
  // AND a baked-in logo still needs Q/H error correction to survive the occlusion.
  const contrast = useMemo(() => contrastRatio(fg, bg), [fg, bg]);
  useEffect(() => {
    const logoRisk = useLogo && logoImg && ecc !== 'Q' && ecc !== 'H';
    setScannable(contrast >= 3.5 && !logoRisk);
  }, [contrast, useLogo, logoImg, ecc]);

  // decorative swatches + thumbnails
  useEffect(() => {
    const root = rootRef.current; if (!root) return;
    root.querySelectorAll('canvas.swx').forEach(drawSwatch);
    root.querySelectorAll('canvas.thumb').forEach(drawThumb);
  });

  // close popovers on outside click, and on Escape for keyboard users
  useEffect(() => {
    const h = (e) => { if (!e.target.closest('[data-pop]')) { setFgOpen(false); setBgOpen(false); } };
    // Escape closes whatever transient surface is open — expected keyboard
    // behaviour, and without it there is no way out of the drawer or a colour
    // popover except by clicking elsewhere.
    const esc = (e) => {
      if (e.key !== 'Escape') return;
      if (fgOpen || bgOpen) { setFgOpen(false); setBgOpen(false); }
      else if (drawerOpen) { setDrawerOpen(false); drawerTriggerRef.current?.focus(); }
    };
    document.addEventListener('mousedown', h);
    window.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', h); window.removeEventListener('keydown', esc); };
  }, [fgOpen, bgOpen, drawerOpen]);

  // move focus into the drawer when it opens so keyboard users land inside it
  useEffect(() => { if (drawerOpen) drawerRef.current?.focus(); }, [drawerOpen]);

  function onLogo(e) { const file = e.target.files?.[0]; if (!file) return; const rd = new FileReader(); rd.onload = (ev) => { const i = new Image(); i.onload = () => { setLogoImg(i); setUseLogo(true); }; i.src = ev.target.result; }; rd.readAsDataURL(file); }
  /* v5: templates are complete looks, not recolours. A template applies colour,
     dot, finder AND error correction, logo on/off, logo shape and border, plus
     its example URL and the group chip. Keys the preset omits are left as-is. */
  function pickTemplate(t) {
    pulseRef.current = true;
    setSel(t.name); setFg(t.fg); setBg(t.bg); setDot(t.dot); setFinder(t.finder);
    if (t.ecc) setEcc(t.ecc);
    if (t.shape) setLogoShape(t.shape);
    if (t.border) setLogoBorder(t.border);
    if (t.content) { setFields((f) => ({ ...f, url: t.content })); setExampleTag(t.group || ''); }
    if (t.img) {
      // Social presets ship a real brand mark; load it as the actual centre logo
      // so it is baked into the PNG/SVG export, not just drawn over the preview.
      const i = new Image(); i.onload = () => { setLogoImg(i); setUseLogo(true); }; i.src = t.img;
      setFields((f) => ({ ...f, utm: { ...f.utm, source: t.name.toLowerCase(), medium: 'social' } }));
    } else if (t.logo !== undefined) {
      setUseLogo(t.logo);
    }
    track('template_selected', { name: t.name });
  }
  // Style controls pulse the canvas; typing does not.
  const pickDot = (k) => { pulseRef.current = true; setDot(k); };
  const pickFinder = (k) => { pulseRef.current = true; setFinder(k); };
  const pickFg = (c) => { pulseRef.current = true; setFg(c); };
  const pickBg = (c) => { pulseRef.current = true; setBg(c); };

  function downloadPNG() { const a = document.createElement('a'); a.download = 'qrcode.png'; a.href = mainRef.current.toDataURL('image/png'); a.click(); track('download_png', { mode }); }
  function downloadSVG() {
    if (!hasContent) return;
    let m; try { m = getMatrix(payload, ecc); } catch { try { m = getMatrix(payload, 'H'); } catch { return; } }
    const svg = buildSVG(m, size, fg, bg, dot, finder, logoImg && useLogo ? logoImg.src : null, logoShape, logoBorder === 'border');
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const a = document.createElement('a'); a.download = 'qrcode.svg'; a.href = url; a.click();
    URL.revokeObjectURL(url); track('download_svg', { mode });
  }

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

  // The QR canvas is the core feature and was previously invisible to assistive
  // tech — a bare <canvas> exposes nothing. Describe what the code encodes and
  // whether it is scannable, and announce changes politely.
  const describe = () => {
    if (!hasContent) return 'QR code preview. Nothing encoded yet — fill in the fields above.';
    const what = mode === 'wifi' ? `WiFi network ${fields.ssid || '(no name yet)'}`
      : mode === 'vcard' ? `contact card for ${[fields.first, fields.last].filter(Boolean).join(' ') || '(no name yet)'}`
      : mode === 'whatsapp' ? `WhatsApp message to ${fields.number || '(no number yet)'}`
      : `link to ${payload}`;
    return `QR code for ${what}. ${size} by ${size} pixels, error correction ${ecc}, ${scannable ? 'scannable' : 'may not scan reliably'}.`;
  };
  const qrDescription = describe();

  const ecd = ECC_DATA[ecc];
  const dotBtn = (on) => `dotbtn${on ? ' on' : ''}`;
  // v5 dynamic subtitle — reflects the current selection.
  const headerSub = `${DOT_NAMES[dot] || 'Custom'} dots · ${FINDER_NAMES[finder] || 'Custom'} finders · ${useLogo ? 'Logo on' : 'No logo'}`;
  const TAB_ITEMS = { social: SOCIAL, industry: INDUSTRY, usecase: USECASE, themes: CREATIVE };
  const TAB_TITLES = { social: 'Social', industry: 'By industry', usecase: 'By use case', themes: 'Creative themes' };

  return (
    <div className="genflag" ref={rootRef}>
      {/* top bar */}
      <div className="gf-top">
        <div className="gf-brand"><span className="gf-tile">QR</span><span><b>Custom QR Codes</b><i>{headerSub}</i></span></div>
        {/* The app-theme swatches live in the site header only. Having a second
            set here meant two controls for one global setting whose "selected"
            dots drifted apart, and the widget is absent from learn/trust/article
            pages, so the header is the copy that works everywhere. */}
      </div>

      {/* content row */}
      <div className="gf-content">
        <div className="gf-crow">
          <ModeFields mode={mode} fields={fields} setF={setF} urlValue={payload} onUrlInput={onUrlInput} />
          {exampleTag && <span className="gf-exampletag">{exampleTag}</span>}
          {mode === 'url' && <button className="gf-utm" onClick={() => setUtmOpen((v) => !v)}>UTM TRACKING <span>{utmOpen ? '▴' : '▾'}</span></button>}
        </div>
        {mode === 'url' && utmOpen && (
          <div className="gf-utmpanel">
            <div className="g3">{['source', 'medium', 'campaign'].map((k) => (<label key={k}><span>utm_{k} *</span><input value={fields.utm[k] || ''} aria-label={`UTM ${k}`} onChange={(e) => setUtm(k, e.target.value)} placeholder={k === 'source' ? 'newsletter' : k === 'medium' ? 'social' : 'spring_launch'} /></label>))}</div>
            <div className="g2">{['term', 'content'].map((k) => (<label key={k}><span>utm_{k}</span><input value={fields.utm[k] || ''} aria-label={`UTM ${k}`} onChange={(e) => setUtm(k, e.target.value)} placeholder="optional" aria-label="optional" /></label>))}</div>
            <div className="gf-encoded"><span className="k">ENCODED</span><span className="v">{payload}</span></div>
          </div>
        )}
      </div>

      {/* body */}
      {/* rail-closed reserves the rail's width in the preview column so the QR
          never resizes when the rail is toggled — see .gf-preview in app.css */}
      <div className={`gf-body${railOpen ? '' : ' rail-closed'}`} ref={bodyRef}>
        {/* config */}
        <div className="gf-config">
          <div className="gf-cfg-scroll" ref={cfgScrollRef}>
            <div>
              <div className="lab">Dot style</div>
              <div className="gf-grid5">{DOTS.map((d) => <button key={d.k} type="button" aria-pressed={dot === d.k} className={dotBtn(dot === d.k)} onClick={() => pickDot(d.k)}><canvas aria-hidden="true" className="swx" data-px="28" data-kind="dot" data-style={d.k} style={{ width: 28, height: 28 }} />{d.l}</button>)}</div>
            </div>
            <div>
              <div className="lab">Finder pattern</div>
              <div className="gf-grid5">{FINDERS.map((f) => <button key={f.k} type="button" aria-pressed={finder === f.k} className={dotBtn(finder === f.k)} onClick={() => pickFinder(f.k)}><canvas aria-hidden="true" className="swx" data-px="28" data-kind="finder" data-style={f.k} style={{ width: 28, height: 28 }} />{f.l}</button>)}</div>
            </div>
            <div className="g2">
              <ColorField label="Foreground" val={fg} open={fgOpen} setOpen={(v) => { setFgOpen(v); setBgOpen(false); }} onPick={pickFg} presets={FG_PRESETS} align="left" />
              <ColorField label="Background" val={bg} open={bgOpen} setOpen={(v) => { setBgOpen(v); setFgOpen(false); }} onPick={pickBg} presets={BG_PRESETS} align="right" />
            </div>
            <div>
              <div className="lab spread"><span>Output size</span><span className="accent">{size} px</span></div>
              <div className="gf-slider">
                <span className="track" /><span className="fill" style={{ width: `${((size - 200) / 1800) * 100}%` }} /><span className="knob" style={{ left: `${((size - 200) / 1800) * 100}%` }} />
                <input type="range" min="200" max="2000" step="8" value={size} aria-label="Output size in pixels" aria-valuetext={`${size} pixels`} onChange={(e) => setSize(+e.target.value)} />
              </div>
            </div>
            <div>
              <div className="lab tiprow"><span>Error correction</span><button className="gf-i" onMouseEnter={() => setEccTip(true)} onMouseLeave={() => setEccTip(false)}>i</button>{eccTip && <span className="gf-tip">Error correction bakes in redundant data so the code still scans when part of it is covered. Higher levels recover more but pack denser dots — pick Q or H when you add a center logo.</span>}</div>
              {/* v5: four explicit option cards — letter + recovery % + name — so the
                  trade-off is legible without hovering the info tip. */}
              <div className="gf-eccgrid">{['L', 'M', 'Q', 'H'].map((l) => (
                <button key={l} type="button" aria-pressed={ecc === l} aria-label={`Error correction ${l} — ${ECC_DATA[l].n}, ${ECC_DATA[l].r}`} className={`gf-ecc${ecc === l ? ' on' : ''}`} onClick={() => setEcc(l)}>
                  <span className="e-l">{l}</span><span className="e-p">{ECC_DATA[l].p}</span><span className="e-n">{ECC_DATA[l].n}</span>
                </button>
              ))}</div>
              <div className="gf-bar"><span style={{ width: ecd.f }} /></div>
              <div className="gf-cap">{ecc} — {ecd.n} · {ecd.r}</div>
            </div>
            <div>
              <div className="lab spread"><span>Center logo</span><button type="button" role="switch" aria-checked={useLogo} aria-label="Center logo" className={`gf-toggle${useLogo ? ' on' : ''}`} onClick={() => setUseLogo((v) => !v)}><span /></button></div>
              {/* v5: the logo controls stay visible when the toggle is off — greyed
                  out rather than hidden, so the column height never jumps and you
                  can see what turning it on would give you. `inert` (with the CSS
                  pointer-events fallback) also keeps them out of the tab order. */}
              <div className={`gf-logo${useLogo ? '' : ' off'}`} inert={useLogo ? undefined : ''}>
                <label className="gf-drop">Drop image or click to upload<i>PNG with transparency</i><input type="file" accept="image/*" hidden onChange={onLogo} /></label>
                <div className="g2">
                  <div><div className="micro">SHAPE</div><div className="gf-seg sm">{['circle', 'square'].map((s) => <button key={s} type="button" aria-pressed={logoShape === s} aria-label={`Logo shape ${s}`} className={logoShape === s ? 'on' : ''} onClick={() => setLogoShape(s)}>{s === 'circle' ? '◉' : '▣'} {s.toUpperCase()}</button>)}</div></div>
                  <div><div className="micro">BORDER</div><div className="gf-seg sm">{['none', 'border'].map((b) => <button key={b} type="button" aria-pressed={logoBorder === b} aria-label={`Logo border ${b}`} className={logoBorder === b ? 'on' : ''} onClick={() => setLogoBorder(b)}>{b === 'none' ? '◼' : '▢'} {b.toUpperCase()}</button>)}</div></div>
                </div>
              </div>
            </div>
          </div>
          {/* The preview is live, so there is nothing to "generate" — this button
              previously called downloadSVG, duplicating the SVG button exactly.
              It is the primary CTA, so it now does the most likely thing: download
              the PNG. The two format buttons stay for an explicit choice. Disabled
              while there is no payload rather than exporting an empty code. */}
          <div className="gf-cfg-footer" ref={cfgFooterRef}>
            <button type="button" className="gf-generate" onClick={downloadPNG} disabled={!hasContent}
              aria-label={hasContent ? 'Download QR code as PNG' : 'Enter content first'}>
              {hasContent ? 'GENERATE QR CODE' : 'ENTER CONTENT FIRST'}
            </button>
          </div>
        </div>

        {/* preview */}
        <div className="gf-preview">
          <div className="gf-plabel">
            <span className="lab">Live preview</span>
            <div className="gf-savebtns">
              <button className="save" onClick={saveDesign} title="Save this design to this browser">♥ SAVE DESIGN</button>
              {saved.length > 0 && <button type="button" ref={drawerTriggerRef} aria-expanded={drawerOpen} className="open" onClick={() => setDrawerOpen(true)}>SAVED · {saved.length} ›</button>}
              {!railOpen && <button className="gf-railtoggle" onClick={() => setRailOpen(true)}>TEMPLATES ‹</button>}
            </div>
          </div>
          {toast && <div className="gf-toast">✓ Saved to this browser</div>}
          <div className="gf-stage"><div className="gf-mat">
            <canvas ref={mainRef} role="img" aria-label={qrDescription} />
          </div></div>
          <p className="sr-only" role="status" aria-live="polite">{qrDescription}</p>
          <div className="gf-chips">
            <span className="chip">{size} × {size} px</span><span className="chip">ECC · {ecc}</span><span className="chip">{finder} finders</span>
            <span className={`chip ${scannable ? 'ok' : 'warn'}`}>
              {scannable ? '✓ Scannable' : contrast < 3.5 ? '⚠ Low contrast — may not scan' : '⚠ Logo needs ECC Q or H'}
            </span>
          </div>
          <div className="gf-dl"><button type="button" className="dl" onClick={downloadPNG} disabled={!hasContent}>↓ DOWNLOAD PNG</button><button type="button" className="dl primary" onClick={downloadSVG} disabled={!hasContent}>↓ DOWNLOAD SVG</button></div>
        </div>

        {/* saved-designs drawer — ported from ui_kits/website/saved-designs.html */}
        {drawerOpen && (
          <div className="gf-drawer" ref={drawerRef} role="dialog" aria-label="Saved designs" tabIndex={-1}>
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
                      <input className="nm-input" aria-label="Rename saved design" defaultValue={s.name} autoFocus
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
        <div className={`gf-rail${railOpen ? ' open' : ''}`} style={{ flexBasis: railOpen ? 268 : 0, width: railOpen ? 268 : 0 }}>
          <div className="gf-railinner">
            <div className="gf-railhead"><div><b>Templates</b> <i>{PRESET_COUNT} presets</i></div><button onClick={() => setRailOpen(false)} aria-label="Minimize templates">›</button></div>
            {/* v5: category tabs replace the old four-group scroll — only the active
                category's grid renders, so Social (the default) is reachable without
                scrolling past 30 other presets. */}
            <div className="gf-tabs" role="tablist" aria-label="Template categories">
              {TABS.map((t) => (
                <button key={t.k} role="tab" id={`gf-tab-${t.k}`} aria-selected={templateTab === t.k} aria-controls={`gf-tabpanel-${t.k}`}
                  className={`gf-tab${templateTab === t.k ? ' on' : ''}`} onClick={() => setTemplateTab(t.k)}>{t.l}</button>
              ))}
            </div>
            <div className="gf-railscroll" role="tabpanel" id={`gf-tabpanel-${templateTab}`} aria-labelledby={`gf-tab-${templateTab}`}>
              <RailGroup title={TAB_TITLES[templateTab]} items={TAB_ITEMS[templateTab]} sel={sel} onPick={pickTemplate} social={templateTab === 'social'} />
            </div>
          </div>
        </div>
      </div>
      {supportUrl && (
        <div className="gf-support-footer">
          <p>{thanks}</p>
          <a href={supportUrl} target="_blank" rel="noopener" data-support="widget_footer"
             onClick={() => track('support_click', { placement: 'widget_footer', mode })}>☕ BUY ME A COFFEE</a>
        </div>
      )}
    </div>
  );
}

function ColorField({ label, val, open, setOpen, onPick, presets, align }) {
  return (
    <div>
      <div className="lab">{label}</div>
      <div className="gf-colorpop" data-pop>
        <button type="button" aria-expanded={open} aria-label={`${label} colour, currently ${val.toUpperCase()}`} className="gf-colorbtn" onClick={() => setOpen(!open)}><span className="sw" style={{ background: val }} /><span className="hex">{val.toUpperCase()}</span><span className="chev">{open ? '▴' : '▾'}</span></button>
        {open && (
          <div className={`gf-popover ${align}`}>
            <div className="gf-pophead"><span className="big" style={{ background: val }} /><div><b>{val.toUpperCase()}</b><i>Drag the bar to pick any color</i></div></div>
            <label className="gf-bar-input"><span className="rainbow" /><input type="color" aria-label={`${label} colour picker`} value={val} onChange={(e) => onPick(e.target.value)} /></label>
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
              <canvas aria-hidden="true" className="thumb" data-px="110" data-fg={t.fg} data-bg={t.bg} data-dot={t.dot} data-finder={t.finder} data-seed={t.seed} />
              {social && t.img && <span className="thumblogo"><img src={t.img} alt={t.name} /></span>}
            </span>
            <span className="tname">{t.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ModeFields({ mode, fields, setF, urlValue, onUrlInput }) {
  if (mode === 'wifi') return (
    <div className="gf-modefields">
      <span className="lab flat">WiFi</span>
      <input value={fields.ssid || ''} onChange={(e) => setF('ssid', e.target.value)} placeholder="Network name (SSID)" aria-label="Network name (SSID)" />
      <div className="gf-seg sm inline">{['WPA', 'WEP', 'nopass'].map((v) => <button key={v} type="button" aria-pressed={(fields.enc || 'WPA') === v} aria-label={`Encryption ${v === 'nopass' ? 'none' : v}`} className={(fields.enc || 'WPA') === v ? 'on' : ''} onClick={() => setF('enc', v)}>{v === 'nopass' ? 'NONE' : v}</button>)}</div>
      <input type="password" value={fields.pass || ''} onChange={(e) => setF('pass', e.target.value)} placeholder="Password" aria-label="Password" />
    </div>
  );
  if (mode === 'vcard') return (
    <div className="gf-modefields grid">
      <input value={fields.first || ''} onChange={(e) => setF('first', e.target.value)} placeholder="First name" aria-label="First name" />
      <input value={fields.last || ''} onChange={(e) => setF('last', e.target.value)} placeholder="Last name" aria-label="Last name" />
      <input value={fields.phone || ''} onChange={(e) => setF('phone', e.target.value)} placeholder="Phone" aria-label="Phone" />
      <input value={fields.email || ''} onChange={(e) => setF('email', e.target.value)} placeholder="Email" aria-label="Email" />
      <input value={fields.company || ''} onChange={(e) => setF('company', e.target.value)} placeholder="Company" aria-label="Company" />
      <input value={fields.website || ''} onChange={(e) => setF('website', e.target.value)} placeholder="Website" aria-label="Website" />
    </div>
  );
  if (mode === 'whatsapp') return (
    <div className="gf-modefields">
      <input value={fields.number || ''} onChange={(e) => setF('number', e.target.value)} placeholder="WhatsApp number (with country code)" aria-label="WhatsApp number (with country code)" />
      <input value={fields.message || ''} onChange={(e) => setF('message', e.target.value)} placeholder="Pre-filled message (optional)" aria-label="Pre-filled message (optional)" />
    </div>
  );
  return (<><span className="gf-clabel">Content / URL</span><input className="gf-cinput" value={urlValue ?? (fields.url || '')} onChange={(e) => onUrlInput(e.target.value)} placeholder="https://your-link.com" aria-label="Content or URL" /></>);
}
