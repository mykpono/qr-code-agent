import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildPayload, maskPayload, payloadDensity, splitUtm, getMatrix, renderReal,
  drawMod, drawFinderReal, drawCorner, hasContent as hasContentFor,
  PATTERN_KEYS, CORNER_KEYS, FRAMES, frameDef, FONTS, fontDef,
  frameMetrics, ctaInk, renderFramed, buildFramedSVG, buildPDF, flattenToRGB,
} from '../lib/qr.js';
import { STACK_BREAKPOINT } from '../lib/mobile.js';
import { buildFeedbackPayload, sendFeedback } from '../lib/feedback.js';
import EN_UI from '../content/ui.json';

/*
  Generator island — the redesigned flagship widget (design_handoff_qr_generator/
  QR Generator.dc.html). Five bands stacked in one card: header · type tabs ·
  content fields · setup|preview split · coffee footer.

  The MAIN preview and every export use the REAL qrcode-generator encoder, so
  what downloads is what scans. The template thumbnails and the pattern/corner
  swatches use the design's decorative seeded draw — they are illustrations of a
  style, never wired to the downloadable output.

  Frame geometry lives in lib/qr.js (frameMetrics) and is shared: this file
  composes inline styles from it, and renderFramed()/buildFramedSVG() composite
  the identical numbers into the exported file.
*/

function track(event, props = {}) {
  try { if (window.umami) window.umami.track(event, props); } catch {}
  try { if (window.gtag) window.gtag('event', event, props); } catch {}
}

/* The Apps Script relay's /exec URL (scripts/feedback-relay.gs). Inlined at
   build time, so it is identical on the server and the first client render —
   the feedback strip can key its existence off it without risking the hydration
   mismatch that would throw away the whole island. Unset (local dev, or before
   the URL is added in Vercel) means the strip does not render at all: a form
   that silently drops what you typed is worse than no form. */
const FEEDBACK_ENDPOINT = import.meta.env.PUBLIC_FEEDBACK_ENDPOINT || '';

/* ---------------- decorative draws ---------------- */

// Pattern + corner swatches, drawn in the LIVE foreground colour so the row
// previews the real result. Corners pass bg 'transparent' — drawCorner punches
// the ring out rather than filling it (see lib/qr.js).
function drawSwatch(c, fg) {
  const px = +c.dataset.px || 22, dpr = 2;
  c.width = px * dpr; c.height = px * dpr;
  const ctx = c.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, px, px);
  const style = c.dataset.style;
  if (c.dataset.kind === 'finder') { drawCorner(ctx, style, 1, 1, px - 2, fg, 'transparent'); return; }
  ctx.fillStyle = fg;
  const n = 3, cell = px / n, g = cell * 0.74;
  for (let r = 0; r < n; r++) for (let cc = 0; cc < n; cc++) {
    const mx = (cc + 0.5) * cell, my = (r + 0.5) * cell;
    if (style === 'circle') { ctx.beginPath(); ctx.arc(mx, my, g / 2, 0, 7); ctx.fill(); }
    else if (style === 'dot') { ctx.beginPath(); ctx.arc(mx, my, g * 0.38, 0, 7); ctx.fill(); }
    else if (style === 'rounded') { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(mx - g / 2, my - g / 2, g, g, g * 0.32) : ctx.rect(mx - g / 2, my - g / 2, g, g); ctx.fill(); }
    else if (style === 'diamond') { ctx.save(); ctx.translate(mx, my); ctx.rotate(Math.PI / 4); ctx.fillRect(-g * 0.36, -g * 0.36, g * 0.72, g * 0.72); ctx.restore(); }
    else if (style === 'star') { const t = g * 0.32; ctx.fillRect(mx - t / 2, my - g / 2, t, g); ctx.fillRect(mx - g / 2, my - t / 2, g, t); }
    else if (style === 'realstar') { const R = g * 0.58, ri = R * 0.42; ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? ri : R, sx = mx + Math.cos(a) * rad, sy = my + Math.sin(a) * rad; i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); } ctx.closePath(); ctx.fill(); }
    else ctx.fillRect(mx - g / 2, my - g / 2, g, g);
  }
}

// Template card thumbnails. A deterministic xorshift32 matrix per preset seed
// keeps every thumbnail stable across renders; the real finder shapes are still
// drawn so the corner style reads correctly at 52px.
function drawThumb(c) {
  const px = +c.dataset.px || 52, dpr = 2;
  c.width = px * dpr; c.height = px * dpr;
  const ctx = c.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const fg = c.dataset.fg || '#000', bg = c.dataset.bg || '#fff';
  const dot = c.dataset.dot || 'square', finder = c.dataset.finder || 'square';
  let s = (+c.dataset.seed || 1) >>> 0;
  const rng = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const N = 29, quiet = 2, total = N + quiet * 2, cell = px / total;
  ctx.fillStyle = bg; ctx.fillRect(0, 0, px, px);
  const inF = (r, cc) => (r < 8 && cc < 8) || (r < 8 && cc >= N - 8) || (r >= N - 8 && cc < 8);
  for (let r = 0; r < N; r++) for (let cc = 0; cc < N; cc++) {
    if (inF(r, cc)) continue;
    if (rng() > 0.52) drawMod(ctx, (quiet + cc + 0.5) * cell, (quiet + r + 0.5) * cell, cell, dot, fg);
  }
  for (const [mr, mc] of [[0, 0], [0, N - 7], [N - 7, 0]]) {
    drawFinderReal(ctx, (quiet + mc) * cell, (quiet + mr) * cell, cell, finder, fg, bg);
  }
}

// The default centre mark is drawn, not an image file: a violet gradient tile
// with the letters QR. Rasterising it once means the plate, the preview overlay
// and the export all consume the same thing — an image.
function brandMarkDataUrl(font = "'Space Grotesk',system-ui,sans-serif") {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 256, 256);
  g.addColorStop(0, '#7b5cff'); g.addColorStop(1, '#a24dff');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = '#fff';
  ctx.font = `700 118px ${font}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('QR', 128, 138);
  return c.toDataURL('image/png');
}

/* ---------------- catalogues ---------------- */

const BRAND = '#6d4dff';
const RIBBON_CSS = 'linear-gradient(135deg,#7b5cff,#e0409a,#ffb020)';
const DEMO_URL = 'https://buy.stripe.com/cNi9AU4zI3w31Fw2KudUY01';

const TYPES = [
  { key: 'url' }, { key: 'text' }, { key: 'wifi' }, { key: 'vcard' },
  { key: 'tel' }, { key: 'sms' }, { key: 'email' },
];
const WHATSAPP_TYPE = { key: 'whatsapp', img: '/assets/logos/whatsapp.png' };
const TYPE_KEYS = [...TYPES.map((x) => x.key), 'whatsapp'];

/* Social presets are guided URLs: picking one switches to URL mode, drops in an
   example link, and bakes the brand mark. Values verbatim from socialDefs(). */
const SOCIAL = [
  { key: 'telegram', name: 'Telegram', url: 'https://t.me/yourchannel', fg: '#229ED9', bg: '#eaf6fc', dot: 'dot', finder: 'circle', seed: 41, img: '/assets/logos/telegram.png', ecc: 'Q', shape: 'circle', border: 'none' },
  { key: 'whatsapp-link', name: 'WhatsApp', url: 'https://wa.me/14155550123', fg: '#0f8a6d', bg: '#eafaf0', dot: 'rounded', finder: 'rounded', seed: 42, img: '/assets/logos/whatsapp.png', ecc: 'Q', shape: 'circle', border: 'none' },
  { key: 'instagram', name: 'Instagram', url: 'https://instagram.com/yourhandle', fg: '#c1358a', bg: '#fdeef6', dot: 'dot', finder: 'dot', seed: 43, img: '/assets/logos/instagram.png', ecc: 'H', shape: 'square', border: 'none' },
  { key: 'youtube', name: 'YouTube', url: 'https://youtube.com/@yourchannel', fg: '#e60000', bg: '#fff0f0', dot: 'square', finder: 'rounded', seed: 44, img: '/assets/logos/youtube.png', ecc: 'H', shape: 'circle', border: 'border' },
];
// WhatsApp is a first-class content type, so it does not repeat as a shortcut.
const SOCIAL_CHIPS = SOCIAL.filter((s) => s.key !== 'whatsapp-link');

/* The full preset catalogue (CLAUDE.md §4 — do not trim). Where the redesign
   restates a preset, its fg/bg/pattern/corner win: it now has nine corner
   styles to choose from, so Coffee is a leaf and Ninja a diamond. */
const CREATIVE = [
  { name: 'Classic', fg: '#1c1c1c', bg: '#ffffff', dot: 'square', finder: 'square', seed: 5 },
  { name: 'Rain', fg: '#2563eb', bg: '#eef4ff', dot: 'dot', finder: 'circle', seed: 6 },
  { name: 'Jungle', fg: '#2f7d32', bg: '#eff7ef', dot: 'rounded', finder: 'rounded', seed: 7 },
  { name: 'Coffee', fg: '#6f4e37', bg: '#f3e9dd', dot: 'square', finder: 'leaf', seed: 8 },
  { name: 'Ninja', fg: '#e11d74', bg: '#141414', dot: 'diamond', finder: 'diamond', seed: 9 },
  { name: 'Neon', fg: '#8b5cf6', bg: '#0b0b12', dot: 'star', finder: 'dot', seed: 13 },
  { name: 'Mosaic', fg: '#9a3412', bg: '#fdf3ec', dot: 'square', finder: 'square', seed: 10 },
  { name: 'Sunset', fg: '#ea580c', bg: '#fff3e2', dot: 'circle', finder: 'cushion', seed: 11 },
  { name: 'Ocean', fg: '#0e7490', bg: '#ecfeff', dot: 'dot', finder: 'circle', seed: 12 },
  { name: 'Mono', fg: '#111111', bg: '#f5f4f1', dot: 'star', finder: 'bold', seed: 14 },
  { name: 'Berry', fg: '#9d174d', bg: '#fdf2f8', dot: 'diamond', finder: 'leafAlt', seed: 15 },
  { name: 'Forest', fg: '#14532d', bg: '#f6faf4', dot: 'rounded', finder: 'square', seed: 16 },
];
/* Industry and use-case labels are CATEGORY NOUNS, not proper names, so unlike
   CREATIVE and SOCIAL they translate: `key` looks the card label up in
   ui.json `preset`. `name` stays the identity — it is what `sel` compares and
   what analytics records — so a locale never forks the selection state. */
const INDUSTRY = [
  { key: 'restaurant', name: 'Restaurant', fg: '#9a3412', bg: '#fdf3ec', dot: 'square', finder: 'rounded', seed: 61 },
  { key: 'coffeeShop', name: 'Coffee shop', fg: '#6f4e37', bg: '#f3e9dd', dot: 'square', finder: 'leaf', seed: 63 },
  { key: 'hotel', name: 'Hotel', fg: '#0e7490', bg: '#ecfeff', dot: 'dot', finder: 'circle', seed: 66 },
  { key: 'realEstate', name: 'Real estate', fg: '#14532d', bg: '#f6faf4', dot: 'rounded', finder: 'square', seed: 67 },
  { key: 'gym', name: 'Gym', fg: '#2563eb', bg: '#eef4ff', dot: 'dot', finder: 'bold', seed: 68 },
  { key: 'salonSpa', name: 'Salon & spa', fg: '#9d174d', bg: '#fdf2f8', dot: 'rounded', finder: 'cushion', seed: 69 },
  { key: 'bar', name: 'Bar', fg: '#8b5cf6', bg: '#0b0b12', dot: 'star', finder: 'circle', seed: 62 },
  { key: 'smallBusiness', name: 'Small business', fg: '#111111', bg: '#f5f4f1', dot: 'star', finder: 'rounded', seed: 64 },
  { key: 'nonprofit', name: 'Nonprofit', fg: '#2f7d32', bg: '#eff7ef', dot: 'rounded', finder: 'rounded', seed: 70 },
  { key: 'foodTruck', name: 'Food truck', fg: '#ea580c', bg: '#fff3e2', dot: 'circle', finder: 'rounded', seed: 71 },
  { key: 'event', name: 'Event', fg: '#8b5cf6', bg: '#0b0b12', dot: 'diamond', finder: 'circle', seed: 72 },
];
const USECASE = [
  { key: 'menu', name: 'Menu', fg: '#9a3412', bg: '#fdf3ec', dot: 'square', finder: 'rounded', seed: 81 },
  { key: 'promotion', name: 'Promotion', fg: '#ea580c', bg: '#fff3e2', dot: 'dot', finder: 'cushion', seed: 82 },
  { key: 'businessCard', name: 'Business card', fg: '#1c1c1c', bg: '#ffffff', dot: 'rounded', finder: 'rounded', seed: 83 },
  { key: 'feedback', name: 'Feedback', fg: '#0e7490', bg: '#ecfeff', dot: 'dot', finder: 'circle', seed: 85 },
  { key: 'flyer', name: 'Flyer', fg: '#9d174d', bg: '#fdf2f8', dot: 'diamond', finder: 'leaf', seed: 86 },
  { key: 'guestWifi', name: 'Guest WiFi', fg: '#0f8a6d', bg: '#eafaf0', dot: 'rounded', finder: 'dot', seed: 90 },
  { key: 'reviews', name: 'Reviews', fg: '#2f7d32', bg: '#eff7ef', dot: 'rounded', finder: 'rounded', seed: 84 },
  { key: 'packaging', name: 'Packaging', fg: '#6f4e37', bg: '#f3e9dd', dot: 'square', finder: 'leafAlt', seed: 87 },
  { key: 'tableTent', name: 'Table tent', fg: '#9a3412', bg: '#fdf3ec', dot: 'square', finder: 'square', seed: 88 },
  { key: 'social', name: 'Social', fg: '#c1358a', bg: '#fdeef6', dot: 'circle', finder: 'dot', seed: 89 },
];
const NONE_CARD = { name: 'None', none: true, fg: BRAND, bg: '#ffffff', dot: 'square', finder: 'square', seed: 3 };

const TEMPLATE_TABS = ['all', 'social', 'industry', 'usecase', 'themes'];
const TAB_SETS = { social: SOCIAL, industry: INDUSTRY, usecase: USECASE, themes: CREATIVE };

const INK_PRESETS = [['#6d4dff', 'violet'], ['#1c1c1c', 'ink'], ['#2563eb', 'blue'], ['#0e7490', 'teal'], ['#e11d48', 'red'], ['#2f7d32', 'green']];
const PAPER_PRESETS = [['#ffffff', 'white'], ['#eef4ff', 'ice'], ['#f3e9dd', 'sand'], ['#fdf2f8', 'blush'], ['#ecfeff', 'mint'], ['#141414', 'black']];
const FRAME_PRESETS = [['#1c1c1c', 'ink'], ['#6d4dff', 'violet'], ['#2563eb', 'blue'], ['#0e7490', 'teal'], ['#e11d48', 'red'], ['#b45309', 'amber']];
const CTA_PRESETS = [['#ffffff', 'white'], ['#1c1c1c', 'ink'], ['#6d4dff', 'violet'], ['#0e7490', 'teal'], ['#e11d48', 'red'], ['#2f7d32', 'green']];

const ECC_LEVELS = ['L', 'M', 'Q', 'H'];
const ECC_PCT = { L: '7%', M: '15%', Q: '25%', H: '30%' };
const ECC_RECOVERY = { L: 7, M: 15, Q: 25, H: 30 };
const PLATE_COVER = 22;
const FORMATS = ['PNG', 'SVG', 'PDF'];
const CTA_SIZES = ['XS', 'S', 'M', 'L', 'XL'];
const THEMES = [['cream', '#faf6ec'], ['sand', '#e7dcc4'], ['olive', '#59603c'], ['slate', '#302c3b']];
const THEME_KEY = 'qra:theme';
const SAVED_KEY = 'qra:saved';

/* WCAG relative-luminance contrast ratio. Below 3.5 a scanner has no reliable
   light/dark split between the modules and the paper. */
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

/* ---------------- the frame, in DOM ----------------
   Built from the same frameMetrics() the export uses, so the preview and the
   downloaded file are the same composition at two scales. */
function FrameBox({ frame, k, frameColor, paper, text, ctaColor, ctaSize, frameFont, tile, children }) {
  const m = frameMetrics(frame, k, ctaSize, frameFont);
  const def = m.def;
  const grad = !!def.grad;
  const fd = m.font;
  const outer = {
    display: 'flex', flexDirection: 'column', alignItems: 'stretch',
    /* The frame COLOUR, not the paper, backs this box — and that is load-bearing.
       `overflow: hidden` clips the bars against the border's inner curve, and the
       clip curve and the painted border edge disagree by a sub-pixel, so a
       hairline of whatever is underneath shows at the two corners. Backing it
       with the paper drew a visible white arc across the bottom corners of every
       solid-bar frame. Every child that should read as paper — the code box, a
       plain bar, the band around a pill — paints its own paper background, so
       nothing but the frame colour can ever leak through that seam.
       The canvas exporter is built the same way and measures pixel-clean. */
    background: def.key === 'none' ? 'transparent' : (grad ? RIBBON_CSS : frameColor),
    borderRadius: m.radius, overflow: 'hidden',
    ...(grad ? { padding: m.gradPad } : null),
    ...(m.border ? { border: `${m.border}px solid ${frameColor}` } : null),
    ...(def.key === 'none' ? null : { boxShadow: '0 18px 40px -24px rgba(40,30,60,.5)' }),
  };
  const inner = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: paper,
    // In a picker tile the hatched square IS the inner box, at a fixed size — the
    // tiles must not change size as the frame changes, or the grid reflows.
    padding: tile ? 0 : m.pad,
    ...(grad ? { borderRadius: m.innerRadius } : null),
  };
  const typo = (px) => ({ fontFamily: fd.css, fontWeight: fd.w, fontSize: px, letterSpacing: fd.ls });
  // Long CTA copy must not be able to stretch a tile.
  const clampTile = tile ? { maxWidth: 58, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', display: 'block' } : null;
  const bar = (b) => {
    const solid = b.kind === 'solid' || b.kind === 'pill';
    const base = { display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: ctaInk(ctaColor, frameColor, solid), ...typo(b.font) };
    // Three values, not two: a solid bar's top and bottom padding differ, to
    // re-centre the text against the border it visually merges with. A
    // `${padTop}px ${padX}px` shorthand would silently mirror the top.
    if (b.kind === 'solid') return { ...base, background: grad ? 'transparent' : frameColor, padding: `${b.padTop}px ${b.padX}px ${b.padBottom}px`, ...clampTile };
    if (b.kind === 'plain') return { ...base, background: paper, padding: `${b.padTop}px ${b.padX}px ${b.padBottom}px`, ...clampTile };
    return { ...base, borderRadius: 999, background: frameColor, padding: `${b.padTop}px ${b.padX}px`, ...clampTile };
  };
  // A pill is a centred chip on the paper, so it needs a full-width paper band of
  // its own — it cannot borrow the box's background any more (see `outer`).
  const barNode = (b) => (b.kind === 'pill'
    ? (
      <div style={{ display: 'flex', justifyContent: 'center', background: paper, padding: `${b.marginTop}px 0 ${b.marginBottom}px` }}>
        <div style={bar(b)}>{text}</div>
      </div>
    )
    : <div style={bar(b)}>{text}</div>);
  return (
    <div style={outer}>
      {m.top && barNode(m.top)}
      <div style={inner}>{children}</div>
      {m.bottom && barNode(m.bottom)}
    </div>
  );
}

/* ---------------- colour popover ---------------- */
function ColorPopover({ value, hex, onHex, onInput, onAuto, isAuto, presets, align, t }) {
  // `draft` holds what is being typed, which may be partial or invalid, so the
  // field never fights your keystrokes. Only a complete hex commits upward.
  const [draft, setDraft] = useState(hex);
  useEffect(() => { setDraft(hex); }, [hex]);
  const commit = (raw) => {
    setDraft(raw);
    const v = raw.trim();
    if (/^#?[0-9a-f]{6}$/i.test(v)) onHex(v[0] === '#' ? v.toLowerCase() : `#${v.toLowerCase()}`);
  };
  return (
    <div className={`gf-pop${align === 'right' ? ' right' : ''}`}>
      <div className="gf-pophead">
        <span className="big" style={{ background: value }} />
        <div>
          <input value={draft} onChange={(e) => commit(e.target.value)} spellCheck="false"
            autoCapitalize="none" maxLength={7} aria-label={t.a11y.hexInput} />
          <div className="cap">{t.gen.pasteHex}</div>
        </div>
      </div>
      <label className="gf-rainbow">
        <span />
        <input type="color" value={value} aria-label={t.a11y.colourPicker} onChange={(e) => onInput(e.target.value)} />
      </label>
      {onAuto && (
        <button type="button" className={`gf-auto${isAuto ? ' on' : ''}`} onClick={onAuto}>{t.gen.autoMatchFrame}</button>
      )}
      <div className="gf-presets">
        <div className="micro">{t.gen.presets}</div>
        <div className="g6">
          {presets.map(([c, name]) => (
            <button key={c} type="button" title={t.color[name]} aria-label={t.color[name]}
              className={c === (hex || '').toLowerCase() ? 'on' : ''} style={{ background: c }}
              onClick={() => onHex(c)} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- component ---------------- */
export default function Generator({ mode: initialMode = 'url', supportUrl = '', thanks = '', ui = null }) {
  const t = ui || EN_UI;

  const rootRef = useRef(null);
  const mainRef = useRef(null);
  const pulseRef = useRef(false);
  const typeTabsRef = useRef([]);
  const urlRef = useRef(null);
  const drawerTriggerRef = useRef(null);
  const drawerRef = useRef(null);

  const [mode, setMode] = useState(initialMode);
  const [social, setSocial] = useState('');
  const [fields, setFields] = useState({ url: DEMO_URL, enc: 'WPA', utm: {} });
  const [utmOpen, setUtmOpen] = useState(false);
  const [sel, setSel] = useState('');
  // True until the first design interaction. The widget opens on a branded demo;
  // touching anything hands it over to the user (see mutate()).
  const [pristine, setPristine] = useState(true);

  const [dot, setDot] = useState('star');
  const [finder, setFinder] = useState('dot');
  const [fg, setFg] = useState(BRAND);
  const [bg, setBg] = useState('#ffffff');
  const [ecc, setEcc] = useState('Q');
  const [size, setSize] = useState(512);
  const [format, setFormat] = useState('PNG');

  const [frame, setFrame] = useState('banner');
  // The branded demo's CTA. Derived from `t`, which is a prop, so the server and
  // the first client render agree.
  const [frameText, setFrameText] = useState(t.gen.demoCta);
  const [frameColor, setFrameColor] = useState(BRAND);
  const [frameFont, setFrameFont] = useState('verdana');
  const [ctaSize, setCtaSize] = useState('XL');
  const [ctaColor, setCtaColor] = useState('auto');

  const [useLogo, setUseLogo] = useState(true);
  const [logoMark, setLogoMark] = useState({ brand: true });
  const [logoShape, setLogoShape] = useState('circle');
  const [logoBorder, setLogoBorder] = useState('none');
  const [logoZoom, setLogoZoom] = useState(100);
  const [markImg, setMarkImg] = useState(null);

  const [templatesOpen, setTemplatesOpen] = useState(true);
  const [styleOpen, setStyleOpen] = useState(true);
  const [frameOpen, setFrameOpen] = useState(true);
  const [logoOpen, setLogoOpen] = useState(true);
  const [frameMore, setFrameMore] = useState(true);
  const [templateTab, setTemplateTab] = useState('all');
  const [openPop, setOpenPop] = useState('');
  const [eccTip, setEccTip] = useState(false);

  // Must match the server render exactly — reading localStorage or innerWidth
  // during render made the first client pass disagree with the SSR HTML and
  // React threw away the whole island. The effects below sync after mount.
  const [theme, setTheme] = useState('cream');
  const [scannable, setScannable] = useState(true);
  const [saved, setSaved] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState(false);
  const [copied, setCopied] = useState(false);
  // False on the server and on the first client render, so hydration matches;
  // the effect below corrects it. Drives where the feedback strip renders.
  const [stacked, setStacked] = useState(false);

  // ask → form → (sending) → done | error. `error` keeps everything the user
  // typed so "try again" resumes the same message.
  const [fbState, setFbState] = useState('ask');
  const [fbMood, setFbMood] = useState('');
  const [fbTopic, setFbTopic] = useState('');
  const [fbText, setFbText] = useState('');
  const [fbEmail, setFbEmail] = useState('');
  const [fbSnap, setFbSnap] = useState(true);
  const [fbSending, setFbSending] = useState(false);
  const fbTrap = useRef(null);

  /* DESIGN interactions route through this: colours, patterns, corners, ECC,
     size, frames, CTA styling, templates, every logo control. They restyle the
     card and nothing else, so the branded demo SURVIVES them — the preview stays
     a real, scannable code the whole time you are styling it. Chrome that is not
     part of the design (carets, tabs, popovers, theme, feedback) uses the plain
     setters and does not even pulse. */
  function mutate(apply, opts = {}) {
    pulseRef.current = opts.pulse !== false;
    apply();
  }

  /* CONTENT interactions route through this instead: editing a field, a UTM
     value, or picking a social shortcut that writes an example link. Those hand
     the widget over to the user, so the branded demo is dropped in the same
     update — the CTA falls back to SCAN ME, the default mark goes, and the demo
     URL empties — except where the interaction itself set that very thing. */
  function mutateContent(apply, opts = {}) {
    mutate(apply, opts);
    dropDemo(opts);
  }

  function dropDemo(opts = {}) {
    if (!pristine) return;
    setPristine(false);
    if (!opts.keepText) setFrameText(t.gen.ctaPlaceholder);
    if (!opts.keepMark) setLogoMark(null);
    if (!opts.keepUrl) setFields((f) => ({ ...f, url: '' }));
  }

  /* ---------------- content ---------------- */
  const payload = useMemo(() => buildPayload(mode, fields), [mode, fields]);
  const hasContent = useMemo(() => hasContentFor(mode, fields), [mode, fields]);
  const masked = useMemo(() => (hasContent ? maskPayload(mode, fields) : ''), [hasContent, mode, fields]);
  const density = useMemo(() => payloadDensity(hasContent ? payload.length : 0), [hasContent, payload]);
  const densityLabel = density.level === 'empty'
    ? t.gen.nothingToEncode
    : (t.density[density.level] || '').replace('{n}', payload.length);
  const suggestEcc = density.suggest && density.suggest !== ecc ? density.suggest : '';

  const setF = (k, v) => mutateContent(() => setFields((f) => ({ ...f, [k]: v })), { keepUrl: k === 'url' });
  // The URL field shows the TAGGED link, so what you see is what the code
  // encodes. `fields.url` stays the untagged base so editing a UTM value
  // recomposes rather than appending to an already-tagged string.
  const onUrlInput = (v) => mutateContent(() => { const { base, utm } = splitUtm(v); setFields((f) => ({ ...f, url: base, utm })); }, { keepUrl: true });
  const setUtm = (k, v) => mutateContent(() => setFields((f) => ({ ...f, utm: { ...f.utm, [k]: v } })), { keepUrl: true });

  function changeType(m) {
    if (m === mode && !social) return;
    pulseRef.current = true;
    setMode(m); setSocial('');
    // The UTM panel belongs to URL mode; leave it as the user left it there.
    if (m !== 'url') setUtmOpen(false);
    /* A content type that is ALSO a brand carries that brand's look — WhatsApp
       is both a payload type and one of the social presets, so picking its tab
       restyles the code exactly as its shortcut chip does. Every other type
       keeps the current styling, which is the point of the redesign: switching
       what you encode never throws away how it looks. */
    const brand = SOCIAL.find((s) => s.key === m || s.key === `${m}-link`);
    if (brand) {
      setSel(brand.name);
      setFg(brand.fg); setBg(brand.bg); setDot(brand.dot); setFinder(brand.finder); setEcc(brand.ecc);
      setFrameColor(brand.fg); setCtaColor('auto');
      setUseLogo(true); setLogoMark({ img: brand.img, name: brand.name });
      setLogoShape(brand.shape); setLogoBorder(brand.border);
    }
    try {
      const u = new URL(window.location.href);
      if (m === initialMode) u.searchParams.delete('type'); else u.searchParams.set('type', m);
      window.history.replaceState(null, '', u);
    } catch {}
    track('type_switch', { type: m });
  }

  // A social shortcut is the one "template" that IS content — it writes an
  // example link into the URL field — so it hands the widget over.
  function pickSocial(s) {
    mutateContent(() => {
      setMode('url'); setSocial(s.key); setSel(s.name); setUtmOpen(false);
      setFields((f) => ({ ...f, url: s.url, utm: {} }));
      setFg(s.fg); setBg(s.bg); setDot(s.dot); setFinder(s.finder); setEcc(s.ecc);
      setFrameColor(s.fg); setCtaColor('auto');
      setUseLogo(true); setLogoMark({ img: s.img, name: s.name });
      setLogoShape(s.shape); setLogoBorder(s.border);
    }, { keepUrl: true, keepMark: true });
    track('social_selected', { name: s.name });
  }

  // Templates are complete looks, never content: they set colour, pattern,
  // corner and the frame colour, and hand the CTA colour back to auto.
  function pickPreset(p) {
    mutate(() => {
      setSel(p.name); setSocial('');
      setFg(p.fg); setBg(p.bg); setDot(p.dot); setFinder(p.finder);
      setFrameColor(p.fg); setCtaColor('auto');
    });
    track('template_selected', { name: p.name });
  }
  function clearPreset() {
    mutate(() => {
      setSel(''); setSocial('');
      setFg(BRAND); setBg('#ffffff'); setDot('square'); setFinder('square');
      setFrameColor('#1c1c1c'); setCtaColor('auto'); setLogoMark(null);
    });
  }

  /* ---------------- the mark ---------------- */
  // Everything downstream — the preview plate and both exporters — consumes an
  // Image, so the CSS-drawn default mark is rasterised to one here.
  useEffect(() => {
    if (!logoMark) { setMarkImg(null); return; }
    let live = true;
    const img = new Image();
    img.onload = () => { if (live) setMarkImg(img); };
    img.onerror = () => { if (live) setMarkImg(null); };
    try { img.src = logoMark.brand ? brandMarkDataUrl() : (logoMark.src || logoMark.img); } catch { setMarkImg(null); }
    return () => { live = false; };
  }, [logoMark]);

  function onLogoFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const rd = new FileReader();
    rd.onload = (ev) => mutate(() => { setLogoMark({ src: ev.target.result, name: file.name.replace(/\.[^.]+$/, ''), upload: true }); setUseLogo(true); });
    rd.readAsDataURL(file);
    e.target.value = '';
  }

  /* ---------------- preview ---------------- */
  const matrix = useMemo(() => {
    // An empty payload still encodes a single space, so the stage always shows a
    // valid code rather than an empty box.
    const text = payload || ' ';
    try { return getMatrix(text, ecc); } catch { try { return getMatrix(text, 'H'); } catch { return null; } }
  }, [payload, ecc]);

  useEffect(() => {
    const c = mainRef.current;
    if (!c || !matrix) return;
    // The mark is NOT baked into the preview canvas — the plate is a DOM overlay
    // (design, Band 4b). Export bakes the identical geometry into the file.
    renderReal(c, matrix, 940, fg, bg, dot, finder, null, logoShape, logoBorder === 'border', 1);
    if (pulseRef.current) {
      pulseRef.current = false;
      if (c.animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        c.animate([{ opacity: .4, transform: 'scale(.99)' }, { opacity: 1, transform: 'scale(1)' }],
          { duration: 190, easing: 'cubic-bezier(.2,.7,.3,1)' });
      }
    }
  }, [matrix, fg, bg, dot, finder, logoShape, logoBorder]);

  const contrast = useMemo(() => contrastRatio(fg, bg), [fg, bg]);
  const plateOver = useLogo && PLATE_COVER > (ECC_RECOVERY[ecc] || 0);
  useEffect(() => { setScannable(contrast >= 3.5 && !plateOver); }, [contrast, plateOver]);

  // Swatches and thumbnails are canvas, so they redraw on every render that can
  // change them — the swatch row previews the LIVE foreground colour.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.querySelectorAll('canvas.swx').forEach((c) => drawSwatch(c, fg));
    root.querySelectorAll('canvas.thumb').forEach(drawThumb);
  });

  /* ---------------- chrome effects ---------------- */
  useEffect(() => {
    const down = (e) => { if (!e.target.closest('[data-colorpop]')) setOpenPop(''); };
    const esc = (e) => {
      if (e.key !== 'Escape') return;
      if (openPop) setOpenPop('');
      else if (drawerOpen) { setDrawerOpen(false); drawerTriggerRef.current?.focus(); }
    };
    document.addEventListener('mousedown', down);
    window.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', down); window.removeEventListener('keydown', esc); };
  }, [openPop, drawerOpen]);

  useEffect(() => { if (drawerOpen) drawerRef.current?.focus(); }, [drawerOpen]);
  useEffect(() => { try { const s = localStorage.getItem(THEME_KEY); if (s) setTheme(s); } catch {} }, []);
  useEffect(() => { setSaved(readSaved()); }, []);
  // Track the breakpoint where the two columns stack. Below it the preview sits
  // FIRST, which would leave the feedback strip stranded in the middle of the
  // widget, so it moves to the end instead.
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${STACK_BREAKPOINT}px)`);
    const sync = () => setStacked(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  // Deep link: /wifi-qr-code?type=vcard opens the vCard tab. After mount only,
  // so it never disagrees with the SSR HTML.
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search).get('type');
      if (p && TYPE_KEYS.includes(p) && p !== initialMode) { setMode(p); pulseRef.current = true; }
    } catch {}
  }, []);

  function applyTheme(name) {
    setTheme(name);
    try { document.documentElement.setAttribute('data-theme', name === 'cream' ? '' : name); } catch {}
    try { localStorage.setItem(THEME_KEY, name); } catch {}
    track('theme_switch', { theme: name });
  }

  /* ---------------- export ---------------- */
  // One options object for both writers, so a PNG and an SVG of the same design
  // can never disagree about the frame.
  const exportOpts = () => ({
    matrix, size, fg, bg, dot, finder,
    logoShape, logoBorder: logoBorder === 'border', logoScale: logoZoom / 100,
    frame, frameColor, frameText, ctaColor, ctaSize, frameFont,
  });

  function renderExportCanvas() {
    const c = document.createElement('canvas');
    renderFramed(c, { ...exportOpts(), logoImg: useLogo && markImg ? markImg : null });
    return c;
  }

  function download(href, name) {
    const a = document.createElement('a');
    a.download = name; a.href = href; a.click();
  }

  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    download(url, name);
    // Revoking synchronously can race the click on some browsers; one turn of
    // the event loop is enough for the download to have been handed off.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  /* Styling no longer clears the demo, so the export path is the last place the
     owner's own coffee link could slip out as if it were the user's code. The
     first Download or Copy on an UNTOUCHED demo spends it instead of writing a
     file: the field empties, the CTA falls back, and the widget lands in its
     ordinary "nothing to encode" state with the cursor in the URL box. One
     click, no new copy to translate, and the second click exports normally. */
  const demoIntact = pristine && mode === 'url' && !social && fields.url === DEMO_URL;
  function claimDemo() {
    dropDemo();
    urlRef.current?.focus();
  }

  async function onDownload() {
    if (demoIntact) { claimDemo(); return; }
    if (!hasContent || !matrix) return;
    if (format === 'SVG') {
      const svg = buildFramedSVG({ ...exportOpts(), logoDataUrl: useLogo && markImg ? markImg.src : null });
      downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), 'qrcode.svg');
    } else if (format === 'PDF') {
      const c = renderExportCanvas();
      const rgba = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      const pdf = await buildPDF({ rgb: flattenToRGB(rgba), width: c.width, height: c.height });
      downloadBlob(new Blob([pdf], { type: 'application/pdf' }), 'qrcode.pdf');
    } else {
      download(renderExportCanvas().toDataURL('image/png'), 'qrcode.png');
    }
    track(`download_${format.toLowerCase()}`, { mode, frame });
  }

  async function onCopy() {
    if (demoIntact) { claimDemo(); return; }
    if (!hasContent || !matrix) return;
    try {
      const blob = await new Promise((res) => renderExportCanvas().toBlob(res, 'image/png'));
      await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]);
      setCopied(true); clearTimeout(onCopy._t); onCopy._t = setTimeout(() => setCopied(false), 1800);
      track('copy_image', { mode });
    } catch {
      // Clipboard images need a secure context and a user gesture; when the
      // browser refuses there is nothing useful to say, so fall back to a file.
      download(renderExportCanvas().toDataURL('image/png'), 'qrcode.png');
    }
  }

  /* ---------------- saved designs (local to this browser) ---------------- */
  function readSaved() { try { return JSON.parse(localStorage.getItem(SAVED_KEY) || '[]'); } catch { return []; } }
  function writeSaved(list) { try { localStorage.setItem(SAVED_KEY, JSON.stringify(list.slice(0, 50))); } catch {} setSaved(list.slice(0, 50)); }
  function saveDesign() {
    const typeName = social ? socialName(social) : (t.type[mode] || mode);
    const entry = {
      id: `${Date.now()}-${saved.length}`, name: sel ? `${typeName} · ${sel}` : typeName,
      mode, fields, dot, finder, fg, bg, size, ecc, useLogo, logoShape, logoBorder, logoZoom,
      frame, frameText, frameColor, frameFont, ctaSize, ctaColor, ts: Date.now(),
    };
    writeSaved([entry, ...readSaved()]);
    setToast(true); clearTimeout(saveDesign._t); saveDesign._t = setTimeout(() => setToast(false), 2000);
    track('save_design', { mode });
  }
  function deleteSaved(id) { writeSaved(readSaved().filter((s) => s.id !== id)); }
  function renameSaved(id, name) {
    writeSaved(readSaved().map((s) => (s.id === id ? { ...s, name: name.trim() || s.name } : s)));
    setEditing(null);
  }
  function applySaved(s) {
    // Entries predate several fields, so each is guarded before it is applied.
    // Content, not design: the entry replaces the payload outright, so the demo
    // is spent even though every keep* flag leaves this particular one intact.
    mutateContent(() => {
      if (s.mode) { setMode(s.mode); setSocial(''); }
      setFields(s.fields); setDot(s.dot); setFinder(s.finder);
      setFg(s.fg); setBg(s.bg); setSize(s.size); setEcc(s.ecc);
      if (typeof s.useLogo === 'boolean') setUseLogo(s.useLogo);
      if (s.logoShape) setLogoShape(s.logoShape);
      if (s.logoBorder) setLogoBorder(s.logoBorder);
      if (s.logoZoom) setLogoZoom(s.logoZoom);
      if (s.frame) setFrame(s.frame);
      if (typeof s.frameText === 'string') setFrameText(s.frameText);
      if (s.frameColor) setFrameColor(s.frameColor);
      if (s.frameFont) setFrameFont(s.frameFont);
      if (s.ctaSize) setCtaSize(s.ctaSize);
      if (s.ctaColor) setCtaColor(s.ctaColor);
    }, { keepUrl: true, keepText: true, keepMark: true });
    setDrawerOpen(false);
    track('saved_applied', { mode: s.mode });
  }
  const savedDate = (ts) => {
    const d = new Date(ts), now = new Date();
    return d.toDateString() === now.toDateString() ? t.a11y.today : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  /* ---------------- derived labels ---------------- */
  const socialName = (key) => (SOCIAL.find((s) => s.key === key) || {}).name || '';
  const fdef = frameDef(frame);
  const typeBadge = (social ? socialName(social) : (t.type[mode] || mode)).toUpperCase();
  const fieldsLabel = social ? t.gen.contentSocial.replace('{name}', socialName(social)) : (t.fieldsLabel[mode] || t.fieldsLabel.url);
  const modeNote = social ? t.gen.socialGuided : t.modeNote[mode];
  const styleSummary = `${t.dot[dot] || dot} · ${t.finder[finder] || finder} · ECC ${ecc}`;
  const logoSummary = !useLogo ? t.gen.logoOff : (logoMark ? (logoMark.name || t.gen.title) : t.gen.logoPlaceholder);
  const eccIndex = ECC_LEVELS.indexOf(ecc);
  const eccPct = `${(eccIndex / 3) * 100}%`;
  const railPresets = [NONE_CARD, ...(templateTab === 'all'
    ? [...SOCIAL, ...CREATIVE, ...INDUSTRY, ...USECASE]
    : TAB_SETS[templateTab] || [])];
  const shownFrames = FRAMES.filter((x) => frameMore || !x.more || frame === x.key);
  const fbTopics = fbMood === 'no' ? t.fb.topicsNo : t.fb.topicsYes;
  const fbSnapshot = `${typeBadge} · ${t.dot[dot]} · ${t.frame[frame]} · ECC ${ecc} ${t.fb.noContents}`;

  // The canvas is the core feature and a bare <canvas> exposes nothing to
  // assistive tech, so it carries a written description of what it encodes.
  const qrDescription = (() => {
    if (!hasContent) return t.a11y.qrEmpty;
    const what = mode === 'wifi' ? `${t.a11y.wifiNetwork} ${fields.ssid || t.a11y.noNameYet}`
      : mode === 'vcard' ? `${t.a11y.contactCard} ${[fields.first, fields.last].filter(Boolean).join(' ') || t.a11y.noNameYet}`
      : mode === 'whatsapp' ? `${t.a11y.whatsappTo} ${fields.number || t.a11y.noNumberYet}`
      : mode === 'tel' ? `${t.a11y.phoneNumberIs} ${fields.phone || t.a11y.noneYet}`
      : mode === 'sms' ? `${t.a11y.smsTo} ${fields.number || t.a11y.noNumberYet}`
      : mode === 'email' ? `${t.a11y.emailTo} ${fields.email || t.a11y.noAddressYet}`
      : mode === 'text' ? `${t.a11y.theText} "${fields.text || ''}"`
      : mode === 'crypto' ? `${t.a11y.bitcoinTo} ${fields.address || t.a11y.noAddressYet}`
      : `${t.a11y.linkTo} ${payload}`;
    return `${t.a11y.qrFor} ${what}. ${size} ${t.a11y.pixels} ${size} px, ${t.a11y.errorCorrection} ${ecc}, ${scannable ? t.a11y.scannableWord : t.a11y.mayNotScan}.`;
  })();

  /* ---------------- colour slots ---------------- */
  const slot = (key, label, value, presets, apply, align) => ({
    key, label, value, presets, align,
    hex: value.toUpperCase(), open: openPop === key,
    toggle: () => setOpenPop(openPop === key ? '' : key),
    apply: (c) => mutate(() => apply(c)),
  });
  const colorSlots = [
    slot('fg', t.gen.foreground, fg, INK_PRESETS, setFg),
    slot('bg', t.gen.background, bg, PAPER_PRESETS, setBg),
    slot('frame', t.gen.frameColor, frameColor, FRAME_PRESETS, setFrameColor),
  ];
  const ctaAuto = ctaColor === 'auto';
  const ctaShown = ctaAuto ? frameColor : ctaColor;

  const sectionCaret = (open) => (
    <span className="gf-caret" style={{ transform: `rotate(${open ? 90 : 0}deg)` }} aria-hidden="true">›</span>
  );

  /* Rendered in one of two places — inside the preview column on desktop, and
     as the widget's last band once the columns stack (see `stacked`). It is one
     element either way, and all of its state lives up here, so moving it across
     the breakpoint keeps whatever the user had already typed. */
  /* The only thing on this strip that leaves the browser. Everything typed is
     held until the relay confirms delivery, so a failed send lands on `error`
     with the message intact instead of on the thank-you — which claims, in
     writing, that it reached a person. */
  async function submitFeedback() {
    if (fbSending) return;
    setFbSending(true);
    const delivered = await sendFeedback(FEEDBACK_ENDPOINT, buildFeedbackPayload({
      mood: fbMood,
      topic: fbTopic,
      text: fbText,
      email: fbEmail,
      snapshot: fbSnapshot,
      attachSnapshot: fbSnap,
      pageUrl: typeof window !== 'undefined' ? window.location.href : '',
      locale: typeof document !== 'undefined' ? document.documentElement.lang : '',
      botcheck: fbTrap.current ? fbTrap.current.value : '',
    }));
    setFbSending(false);
    if (!delivered) { setFbState('error'); return; }
    track('feedback_sent', { mood: fbMood || 'yes', topic: fbTopic || 'none' });
    setFbState('done');
    setFbText('');
    setFbTopic('');
    setFbEmail('');
  }

  const feedbackStrip = !FEEDBACK_ENDPOINT ? null : (
    <div className="gf-fb">
      {fbState === 'ask' && (
        <div className="ask">
          <span className="q">{t.fb.ask}</span>
          <div className="acts">
            <button type="button" aria-label={t.a11y.feedbackYes} onClick={() => { setFbState('form'); setFbMood('yes'); setFbTopic(''); }}>{t.fb.yes}</button>
            <button type="button" aria-label={t.a11y.feedbackNo} onClick={() => { setFbState('form'); setFbMood('no'); setFbTopic(''); }}>{t.fb.no}</button>
          </div>
        </div>
      )}
      {fbState === 'form' && (
        <div className="form">
          <div className="head">
            <b>{fbMood === 'no' ? t.fb.titleNo : t.fb.titleYes}</b>
            <i>{fbMood === 'no' ? t.fb.subtitleNo : t.fb.subtitleYes}</i>
            <button type="button" className="x" aria-label={t.a11y.closeFeedback} onClick={() => setFbState('ask')}>×</button>
          </div>
          <div className="topics">
            {fbTopics.map((x) => (
              <button key={x} type="button" className={fbTopic === x ? 'on' : ''}
                onClick={() => setFbTopic(fbTopic === x ? '' : x)}>{x}</button>
            ))}
          </div>
          <textarea rows={3} value={fbText} onChange={(e) => setFbText(e.target.value)}
            placeholder={fbMood === 'no' ? t.fb.placeholderNo : t.fb.placeholderYes} />
          <div className="send">
            <input value={fbEmail} onChange={(e) => setFbEmail(e.target.value)}
              placeholder={t.fb.emailPlaceholder} aria-label={t.fb.emailPlaceholder} />
            <button type="button" disabled={fbSending || (!fbText.trim() && !fbTopic)}
              onClick={submitFeedback}>{fbSending ? t.fb.sending : t.fb.send}</button>
          </div>
          {/* Honeypot — off-screen rather than display:none, which some bots skip.
              Hidden from assistive tech and from the tab order, so nobody who is
              actually using the form can reach it. */}
          <input ref={fbTrap} className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" />
          {/* The payload itself is never attached — only the configuration. */}
          <button type="button" className="snap" role="checkbox" aria-checked={fbSnap} onClick={() => setFbSnap((v) => !v)}>
            <span className="box">{fbSnap ? '✓' : ''}</span>{t.fb.attach} {fbSnapshot}
          </button>
        </div>
      )}
      {fbState === 'done' && <div className="done">{t.fb.done}</div>}
      {fbState === 'error' && (
        <div className="fail" role="alert">
          <span>{t.fb.failed}</span>
          <button type="button" onClick={() => setFbState('form')}>{t.fb.retry}</button>
        </div>
      )}
    </div>
  );

  return (
    <div className="genflag" ref={rootRef}>

      {/* ── Band 1 · header ───────────────────────────── */}
      <div className="gf-top">
        <div className="gf-brand">
          <span className="gf-tile">QR</span>
          <span><b>{t.gen.title}</b><i>{t.gen.subtitle}</i></span>
        </div>
        {/* The only app-theme control on the site; the choice is persisted so it
            still applies on pages that carry no widget. */}
        <div className="gf-themes">
          {THEMES.map(([n, c]) => (
            <button key={n} type="button" aria-pressed={theme === n} className={theme === n ? 'on' : ''}
              style={{ background: c }} title={n} aria-label={n} onClick={() => applyTheme(n)} />
          ))}
        </div>
      </div>

      {/* ── Band 2 · type tabs ────────────────────────── */}
      <TypeTabs mode={mode} social={social} onType={changeType} onSocial={pickSocial} tabsRef={typeTabsRef} t={t} />

      {/* ── Band 3 · content fields ───────────────────── */}
      <div className="gf-content">
        <div className="gf-labelrow">
          <span className="gf-flabel">{fieldsLabel}</span>
          <span className="gf-fnote">{modeNote}</span>
        </div>

        <div className="gf-fieldstack">
          <ContentFields
            mode={mode} social={social} fields={fields} setF={setF}
            urlValue={payload} onUrlInput={onUrlInput} urlRef={urlRef}
            utmOpen={utmOpen} toggleUtm={() => setUtmOpen((v) => !v)} setUtm={setUtm} t={t}
          />

          <div className="gf-encode">
            <span className="pay" aria-live="polite" title={masked}>{masked || t.gen.nothingEncoded}</span>
            <span className={`gf-density ${density.level}`}>{densityLabel}</span>
            {suggestEcc && (
              <button type="button" className="gf-use" onClick={() => mutate(() => setEcc(suggestEcc))}>
                {t.gen.use} {suggestEcc}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Band 4 · setup | preview ──────────────────── */}
      <div className="gf-body">

        {/* 4a · setup */}
        <div className="gf-setup">

          {/* Templates */}
          <div className="gf-sec">
            <div className="gf-sechead spread">
              <button type="button" className="gf-sectoggle" aria-expanded={templatesOpen} onClick={() => setTemplatesOpen((v) => !v)}>
                {sectionCaret(templatesOpen)}<span className="gf-sectitle">{t.gen.templates}</span>
              </button>
              <div className="gf-tabs" role="tablist" aria-label={t.a11y.templateCategory}>
                {TEMPLATE_TABS.map((k) => (
                  <button key={k} type="button" role="tab" aria-selected={templateTab === k}
                    className={`gf-tab${templateTab === k ? ' on' : ''}`} onClick={() => setTemplateTab(k)}>{t.tab[k]}</button>
                ))}
              </div>
            </div>
            {/* Fixed height and fixed card size are deliberate: switching category
                tabs must never shift the page. */}
            {templatesOpen && (
              <div className="gf-strip">
                {railPresets.map((p) => {
                  const isSocial = !!p.img;
                  const on = p.none ? (!social && !sel) : isSocial ? social === p.key : sel === p.name;
                  // Industry/use-case cards carry a translatable label; Creative
                  // and Social keep their proper names in every locale.
                  const label = p.none ? t.a11y.none : (p.key && t.preset[p.key]) || p.name;
                  return (
                    <button key={p.key || p.name} type="button" className={`gf-card${on ? ' on' : ''}`}
                      title={p.none ? t.a11y.clearTemplate : label} aria-label={label}
                      onClick={() => (p.none ? clearPreset() : isSocial ? pickSocial(p) : pickPreset(p))}>
                      <span className="thumbwrap">
                        <canvas aria-hidden="true" className="thumb" data-px="52" data-fg={p.fg} data-bg={p.bg}
                          data-dot={p.dot} data-finder={p.finder} data-seed={p.seed} />
                        {isSocial && <span className="cardicon"><img src={p.img} alt="" /></span>}
                      </span>
                      <span className="cardname">{label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Code style */}
          <div className="gf-sec">
            <button type="button" className="gf-sechead gf-sectoggle full" aria-expanded={styleOpen} onClick={() => setStyleOpen((v) => !v)}>
              {sectionCaret(styleOpen)}<span className="gf-sectitle">{t.gen.codeStyle}</span>
              <span className="gf-secsum">{styleSummary}</span>
            </button>
            {styleOpen && (
              <div className="gf-secbody">
                <div className="gf-row">
                  <div className="gf-rowlab">{t.gen.patterns}</div>
                  <div className="gf-swatches p7">
                    {PATTERN_KEYS.map((k) => (
                      <button key={k} type="button" aria-pressed={dot === k} title={t.dot[k]} aria-label={t.dot[k]}
                        className={`gf-sw${dot === k ? ' on' : ''}`} onClick={() => mutate(() => setDot(k))}>
                        <canvas aria-hidden="true" className="swx" data-px="22" data-kind="dot" data-style={k} />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="gf-row">
                  <div className="gf-rowlab">{t.gen.corners}</div>
                  <div className="gf-swatches c9">
                    {CORNER_KEYS.map((k) => (
                      <button key={k} type="button" aria-pressed={finder === k} title={t.finder[k]} aria-label={t.finder[k]}
                        className={`gf-sw${finder === k ? ' on' : ''}`} onClick={() => mutate(() => setFinder(k))}>
                        <canvas aria-hidden="true" className="swx" data-px="22" data-kind="finder" data-style={k} />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="gf-row">
                  <div className="gf-rowlab">{t.gen.colors}</div>
                  <div className="gf-colors">
                    {colorSlots.map((s) => (
                      <div key={s.key} data-colorpop="1" className="gf-slotwrap">
                        <button type="button" className="gf-slot" aria-expanded={s.open} title={s.label} onClick={s.toggle}>
                          <span className="chip" style={{ background: s.value }} />
                          <span className="meta"><span className="lab">{s.label}</span><span className="hex">{s.hex}</span></span>
                        </button>
                        {s.open && (
                          <ColorPopover value={s.value} hex={s.hex} presets={s.presets} t={t}
                            onHex={s.apply} onInput={s.apply} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="gf-row top">
                  <div className="gf-rowlab tip">
                    {t.gen.recovery}
                    <button type="button" className={`gf-i${eccTip ? ' on' : ''}`} aria-label={t.a11y.eccQuestion}
                      onMouseEnter={() => setEccTip(true)} onMouseLeave={() => setEccTip(false)}
                      onFocus={() => setEccTip(true)} onBlur={() => setEccTip(false)}>i</button>
                    <span className={`gf-tip${eccTip ? ' on' : ''}`} role="tooltip">{t.gen.eccTip}</span>
                  </div>
                  <div className="gf-eccwrap">
                    <div className="gf-track">
                      <span className="rail" />
                      <span className="fill" style={{ width: eccPct }} />
                      {ECC_LEVELS.map((k, i) => (
                        <span key={k} className={`tick${i <= eccIndex ? ' on' : ''}`} style={{ left: `${(i / 3) * 100}%` }} />
                      ))}
                      <span className="knob" style={{ left: eccPct }} />
                      <input type="range" min="0" max="3" step="1" value={eccIndex} aria-label={t.a11y.eccLevel}
                        aria-valuetext={`${ecc} — ${t.ecc[ecc]}`}
                        onChange={(e) => mutate(() => setEcc(ECC_LEVELS[+e.target.value]))} />
                    </div>
                    {/* Absolutely positioned at the same 0/33.3/66.7/100% offsets
                        as the ticks — a 4-column grid's centres do not line up. */}
                    <div className="gf-eccmarks">
                      {ECC_LEVELS.map((k, i) => (
                        <button key={k} type="button" title={t.ecc[k]} style={{ left: `${(i / 3) * 100}%` }}
                          className={ecc === k ? 'on' : ''} onClick={() => mutate(() => setEcc(k))}>{ECC_PCT[k]}</button>
                      ))}
                    </div>
                  </div>
                  {density.suggest && <span className="gf-suggest">{t.gen.suggested} · {density.suggest}</span>}
                </div>
              </div>
            )}
          </div>

          {/* Frame */}
          <div className="gf-sec">
            <button type="button" className="gf-sechead gf-sectoggle full" aria-expanded={frameOpen} onClick={() => setFrameOpen((v) => !v)}>
              {sectionCaret(frameOpen)}<span className="gf-sectitle">{t.gen.frameSection}</span>
              <span className="gf-secsum">{t.frame[frame]}</span>
            </button>
            {frameOpen && (
              <div className="gf-secbody">
                <div className="gf-frames">
                  {shownFrames.map((x) => (
                    <button key={x.key} type="button" aria-pressed={frame === x.key} title={t.frame[x.key]} aria-label={t.frame[x.key]}
                      className={`gf-frametile${frame === x.key ? ' on' : ''}`} onClick={() => mutate(() => setFrame(x.key))}>
                      <FrameBox frame={x.key} k={0.22} frameColor={frameColor} paper={bg} tile
                        text={frameText.slice(0, 8)} ctaColor={ctaColor} ctaSize={ctaSize} frameFont={frameFont}>
                        <span className="gf-framehatch" />
                      </FrameBox>
                    </button>
                  ))}
                </div>
                <button type="button" className="gf-more" onClick={() => setFrameMore((v) => !v)}>
                  {frameMore ? t.gen.lessFrames : t.gen.moreFrames}
                </button>

                {(fdef.top || fdef.bottom) && (
                  <div className="gf-cta">
                    <label className="gf-ctafield">
                      <span className="lab">{t.gen.callToAction}
                        <span className={`count${frameText.length > 18 ? ' warn' : ''}`}>{frameText.length}/24</span>
                      </span>
                      <input value={frameText} maxLength={24} size={24} placeholder={t.gen.ctaPlaceholder}
                        aria-label={t.gen.callToAction}
                        onChange={(e) => mutate(() => setFrameText(e.target.value))} />
                    </label>

                    <label className="gf-fontfield">
                      <span className="lab">{t.gen.font}</span>
                      {/* Rendered in the selected face, so the list previews itself */}
                      <select value={frameFont} aria-label={t.a11y.frameFont}
                        style={{ fontFamily: fontDef(frameFont).css }}
                        onChange={(e) => mutate(() => setFrameFont(e.target.value))}>
                        {FONTS.map((f) => <option key={f.key} value={f.key} style={{ fontFamily: f.css }}>{f.label}</option>)}
                      </select>
                    </label>

                    <div className="gf-ctasize">
                      <span className="lab">{t.gen.sizeLabel}</span>
                      <div className="gf-seg">
                        {CTA_SIZES.map((s) => (
                          <button key={s} type="button" aria-pressed={ctaSize === s} title={t.ctaSize[s]}
                            className={ctaSize === s ? 'on' : ''} onClick={() => mutate(() => setCtaSize(s))}>{s}</button>
                        ))}
                      </div>
                    </div>

                    <div className="gf-ctacolor" data-colorpop="1">
                      <span className="lab">{t.gen.colorLabel}</span>
                      <button type="button" className={`swatch${openPop === 'cta' ? ' open' : ''}`} title={ctaAuto ? t.gen.auto : ctaColor.toUpperCase()}
                        aria-label={t.a11y.ctaColor} style={{ background: ctaShown, color: ctaAuto ? '#fff' : 'transparent' }}
                        onClick={() => setOpenPop(openPop === 'cta' ? '' : 'cta')}>A</button>
                      {openPop === 'cta' && (
                        <ColorPopover align="right" value={ctaShown} hex={ctaAuto ? t.gen.auto : ctaColor.toUpperCase()}
                          presets={CTA_PRESETS} isAuto={ctaAuto} t={t}
                          onAuto={() => mutate(() => setCtaColor('auto'))}
                          onHex={(c) => mutate(() => setCtaColor(c))}
                          onInput={(c) => mutate(() => setCtaColor(c))} />
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Center logo */}
          <div className="gf-sec">
            <div className="gf-sechead spread">
              <button type="button" className="gf-sectoggle full" aria-expanded={logoOpen} onClick={() => setLogoOpen((v) => !v)}>
                {sectionCaret(logoOpen)}<span className="gf-sectitle">{t.gen.centerLogo}</span>
                <span className="gf-secsum">{logoSummary}</span>
              </button>
              <button type="button" role="switch" aria-checked={useLogo} aria-label={t.a11y.toggleLogo}
                className={`gf-toggle${useLogo ? ' on' : ''}`} onClick={() => mutate(() => setUseLogo(!useLogo))}><span /></button>
            </div>
            {logoOpen && (
              <div className={`gf-logo${useLogo ? '' : ' off'}`} inert={useLogo ? undefined : ''}>
                <label className="gf-drop">
                  {logoMark ? (
                    <span className="mark">
                      <span className="thumb">{markImg ? <img src={markImg.src} alt="" /> : null}</span>
                      <span className="meta">
                        <b>{logoMark.name || t.gen.title} {t.gen.markSuffix}</b>
                        <i>{logoMark.brand ? t.gen.defaultMark : t.gen.fromTemplate}</i>
                      </span>
                      <span className="rm" role="button" tabIndex={0} aria-label={t.gen.removeMark}
                        onClick={(e) => { e.preventDefault(); setLogoMark(null); }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setLogoMark(null); } }}>{t.gen.removeMark}</span>
                    </span>
                  ) : (
                    <span className="empty"><b>{t.gen.dropImage}</b><i>{t.gen.dropHintLong}</i></span>
                  )}
                  <input type="file" accept="image/*" hidden onChange={onLogoFile} aria-label={t.gen.dropImage} />
                </label>

                <div className="gf-platerow">
                  <span className="micro">{t.gen.plate}</span>
                  <div className="gf-plateswatches">
                    {['circle', 'square'].map((s) => (
                      <button key={s} type="button" aria-pressed={logoShape === s} title={t.logoShape[s]} aria-label={t.logoShape[s]}
                        className={`gf-platesw${logoShape === s ? ' on' : ''}`} onClick={() => mutate(() => setLogoShape(s))}>
                        <span className={`glyph ${s}`} />
                      </button>
                    ))}
                  </div>
                  <button type="button" role="checkbox" aria-checked={logoBorder === 'border'} className="gf-check"
                    onClick={() => mutate(() => setLogoBorder(logoBorder === 'border' ? 'none' : 'border'))}>
                    <span className="box">{logoBorder === 'border' ? '✓' : ''}</span>{t.gen.borderCheck}
                  </button>
                  <div className="gf-fit">
                    <span className="micro">{t.gen.fit}</span>
                    <div className="gf-track sm">
                      <span className="rail" />
                      <span className="fill" style={{ width: `${((logoZoom - 60) / 160) * 100}%` }} />
                      <span className="knob" style={{ left: `${((logoZoom - 60) / 160) * 100}%` }} />
                      <input type="range" min="60" max="220" step="5" value={logoZoom} aria-label={t.a11y.logoFitRange}
                        aria-valuetext={`${logoZoom}%`} onChange={(e) => mutate(() => setLogoZoom(+e.target.value))} />
                    </div>
                    <span className="val">{logoZoom}%</span>
                  </div>
                </div>

                {plateOver && (
                  <div className="gf-warn">
                    {t.gen.plateWarn.replace('{cover}', PLATE_COVER).replace('{ecc}', ecc).replace('{rec}', ECC_RECOVERY[ecc])}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 4b · preview — always white, whatever the app theme */}
        <div className="gf-preview">
          <div className="gf-plabel">
            <span className="lab">{t.gen.livePreview}</span>
            <div className="gf-savebtns">
              <button type="button" className="save" onClick={saveDesign} title={t.gen.saveDesignTitle}>{t.gen.savePrefix} · {typeBadge}</button>
              {saved.length > 0 && (
                <button type="button" ref={drawerTriggerRef} aria-expanded={drawerOpen} className="open"
                  onClick={() => setDrawerOpen(true)}>{t.gen.savedCount} · {saved.length} ›</button>
              )}
            </div>
          </div>
          {toast && <div className="gf-toast">{t.gen.savedToast}</div>}

          <div className="gf-stage">
            <FrameBox frame={frame} k={1} frameColor={frameColor} paper={bg} text={frameText}
              ctaColor={ctaColor} ctaSize={ctaSize} frameFont={frameFont}>
              <div className="gf-mat">
                <canvas ref={mainRef} role="img" aria-label={qrDescription} />
                {useLogo && (
                  <div className="gf-logoplate" aria-hidden="true"
                    style={{ borderRadius: logoShape === 'circle' ? '50%' : 20, border: `3px solid ${logoBorder === 'border' ? fg : 'transparent'}` }}>
                    {markImg
                      ? <img src={markImg.src} alt="" style={{ transform: `scale(${logoZoom / 100})`, borderRadius: logoShape === 'circle' ? '50%' : 10 }} />
                      : <span className="hatch" style={{ borderRadius: logoShape === 'circle' ? '50%' : 10 }}>{t.gen.logoOverlay}</span>}
                  </div>
                )}
              </div>
            </FrameBox>
          </div>
          <p className="sr-only" role="status" aria-live="polite">{qrDescription}</p>

          <div className="gf-chips">
            <span className="chip">{size} × {size} px</span>
            <span className="chip">{t.gen.eccChip} · {ecc}</span>
            <span className="chip">{typeBadge}</span>
            <span className="chip">{frame === 'none' ? t.gen.noFrame : `${t.gen.frameChip} · ${t.frame[frame].toUpperCase()}`}</span>
            <span className={`chip ${scannable ? 'ok' : 'warn'}`}>
              {scannable ? t.gen.scannable : contrast < 3.5 ? t.gen.lowContrast : t.gen.logoPlateWarn.replace('{ecc}', ecc)}
            </span>
          </div>

          <div className="gf-sizerow">
            <span className="lab">{t.gen.sizeLabel}</span>
            <div className="gf-track">
              <span className="rail" />
              <span className="fill" style={{ width: `${((size - 200) / 1800) * 100}%` }} />
              <span className="knob" style={{ left: `${((size - 200) / 1800) * 100}%` }} />
              <input type="range" min="200" max="2000" step="8" value={size} aria-label={t.a11y.outputSize}
                aria-valuetext={`${size} px`} onChange={(e) => mutate(() => setSize(+e.target.value))} />
            </div>
            <span className="val">{size} px</span>
          </div>

          <div className="gf-formatrow">
            <div className="gf-seg">
              {FORMATS.map((f) => (
                <button key={f} type="button" aria-pressed={format === f} title={t.gen[`formatHint${f}`]}
                  className={format === f ? 'on' : ''} onClick={() => setFormat(f)}>{f}</button>
              ))}
            </div>
            <span className="hint">{t.gen[`formatHint${format}`]}</span>
          </div>

          <div className="gf-dl">
            <button type="button" className="primary" onClick={onDownload} disabled={!hasContent}>{t.gen.download} {format}</button>
            <button type="button" className="secondary" onClick={onCopy} disabled={!hasContent}>{copied ? t.gen.copied : t.gen.copyImage}</button>
          </div>

          {!stacked && feedbackStrip}
        </div>

        {/* Stacked layout only: the strip is asking about the code you just
            made, so it belongs after the whole widget rather than halfway up
            it — the preview column sits FIRST on a phone. */}
        {stacked && feedbackStrip}

        {/* saved-designs drawer */}
        {drawerOpen && (
          <div className="gf-drawer" ref={drawerRef} role="dialog" aria-label={t.gen.savedDrawer} tabIndex={-1}>
            <div className="dhead">
              <div className="l"><b>{t.gen.savedDrawer}</b><span>{saved.length} of ∞</span></div>
              <button className="x" onClick={() => setDrawerOpen(false)} aria-label={t.a11y.closeSaved}>✕</button>
            </div>
            <div className="dlist">
              {saved.map((s) => (
                <div className={`ditem${editing === s.id ? ' edit' : ''}`} key={s.id}>
                  <button className="th" onClick={() => applySaved(s)} title={t.a11y.loadDesign} style={{ background: s.bg }}>
                    <span style={{ background: s.fg }} />
                  </button>
                  {editing === s.id ? (
                    <div className="dmeta">
                      <input className="nm-input" aria-label={t.a11y.renameSaved} defaultValue={s.name} autoFocus
                        onKeyDown={(e) => { if (e.key === 'Enter') renameSaved(s.id, e.target.value); if (e.key === 'Escape') setEditing(null); }} />
                    </div>
                  ) : (
                    <button className="dmeta" onClick={() => applySaved(s)} title={t.a11y.loadDesign}>
                      <span className="nm">{s.name}</span>
                      <span className="sub">{s.mode} · {s.size}px · {savedDate(s.ts)}</span>
                    </button>
                  )}
                  <div className="dacts">
                    {editing === s.id ? (
                      <>
                        <button className="ok" title={t.a11y.saveName} onClick={(e) => renameSaved(s.id, e.target.closest('.ditem').querySelector('.nm-input').value)}>✓</button>
                        <button title={t.a11y.cancel} onClick={() => setEditing(null)}>↺</button>
                      </>
                    ) : (
                      <>
                        <button title={t.a11y.rename} onClick={() => setEditing(s.id)}>✎</button>
                        <button title={t.a11y.delete} onClick={() => deleteSaved(s.id)}>✕</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="dfoot"><p><b>{t.gen.savedFoot}</b>{t.gen.savedFootRest}</p></div>
          </div>
        )}
      </div>

      {/* ── Band 5 · footer ───────────────────────────── */}
      {supportUrl && (
        <div className="gf-support-footer">
          <p>{thanks}</p>
          <a href={supportUrl} target="_blank" rel="noopener" data-support="widget_footer"
            onClick={() => track('support_click', { placement: 'widget_footer', mode })}>{t.gen.buyCoffee}</a>
        </div>
      )}
    </div>
  );
}

/* ---------------- band 2 ---------------- */
function TypeTabs({ mode, social, onType, onSocial, tabsRef, t }) {
  // One flat, ordered list of focusable tabs: the seven text types, WhatsApp,
  // then the social shortcuts. Arrow keys roam it; only the selected tab is in
  // the tab order.
  const items = [
    ...TYPES.map((x) => ({ kind: 'type', key: x.key })),
    { kind: 'type', key: WHATSAPP_TYPE.key, img: WHATSAPP_TYPE.img },
    ...SOCIAL_CHIPS.map((s) => ({ kind: 'social', key: s.key, data: s })),
  ];
  const firstIcon = TYPES.length;
  const activeIndex = social
    ? items.findIndex((i) => i.kind === 'social' && i.key === social)
    : items.findIndex((i) => i.kind === 'type' && i.key === mode);
  const activate = (i) => (i.kind === 'type' ? onType(i.key) : onSocial(i.data));
  const onKeyDown = (e) => {
    const n = items.length;
    let cur = tabsRef.current.indexOf(document.activeElement);
    if (cur < 0) cur = activeIndex < 0 ? 0 : activeIndex;
    let next = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (cur + 1) % n;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (cur - 1 + n) % n;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = n - 1;
    else return;
    e.preventDefault();
    tabsRef.current[next]?.focus();
    activate(items[next]);
  };
  return (
    <div className="gf-types" role="tablist" aria-label={t.a11y.contentType} onKeyDown={onKeyDown}>
      {items.map((it, i) => {
        const selected = i === activeIndex;
        const icon = it.kind === 'social' || !!it.img;
        const label = it.kind === 'type' ? t.type[it.key] : it.data.name;
        const title = it.kind === 'type' ? t.typeHint[it.key] : it.data.name;
        const src = it.kind === 'type' ? it.img : it.data.img;
        return (
          <span key={`${it.kind}-${it.key}`} className={i === firstIcon ? 'gf-iconlead' : undefined}>
            <button ref={(el) => { tabsRef.current[i] = el; }} type="button" role="tab" aria-selected={selected}
              tabIndex={selected ? 0 : -1} aria-label={label} title={title}
              className={`gf-type${icon ? ' icon' : ''}${selected ? ' on' : ''}`} onClick={() => activate(it)}>
              {icon ? <img src={src} alt="" /> : label}
            </button>
          </span>
        );
      })}
    </div>
  );
}

/* ---------------- band 3 ---------------- */
const UTM_FIELDS = [
  ['source', 'newsletter'], ['medium', 'social'], ['campaign', 'spring_launch'],
  ['term', ''], ['content', ''],
];

function ContentFields({ mode, social, fields, setF, urlValue, onUrlInput, urlRef, utmOpen, toggleUtm, setUtm, t }) {
  const F = (k) => fields[k] || '';
  if (mode === 'url' || social) {
    const ph = social ? (SOCIAL.find((s) => s.key === social) || {}).url : t.gen.contentPlaceholder;
    return (
      <>
        <div className="gf-urlrow">
          <input ref={urlRef} className="gf-field" value={urlValue ?? F('url')} onChange={(e) => onUrlInput(e.target.value)}
            placeholder={ph} aria-label={t.gen.contentAria} />
          <button type="button" className="gf-utmbtn" onClick={toggleUtm} aria-expanded={utmOpen}>
            {t.gen.utmToggle} <span>{utmOpen ? '▴' : '▾'}</span>
          </button>
        </div>
        {utmOpen && (
          <div className="gf-utmpanel">
            {UTM_FIELDS.map(([k, ph2]) => (
              <label key={k}>
                <span>utm_{k}{ph2 ? ' *' : ''}</span>
                <input value={(fields.utm || {})[k] || ''} placeholder={ph2 || t.gen.utmOptional}
                  aria-label={`utm_${k}`} onChange={(e) => setUtm(k, e.target.value)} />
              </label>
            ))}
          </div>
        )}
      </>
    );
  }
  if (mode === 'text') return (
    <div className="gf-textwrap">
      <textarea className="gf-field" rows={3} value={F('text')} onChange={(e) => setF('text', e.target.value)}
        placeholder={t.field.textPlaceholder} aria-label={t.field.textAria} />
      <div className="gf-count">{t.gen.textChars.replace('{n}', F('text').length)}{F('text').length > 300 ? t.gen.textDense : ''}</div>
    </div>
  );
  if (mode === 'wifi') {
    const enc = fields.enc || 'WPA';
    return (
      <div className="gf-grid wifi">
        <label><span className="micro">{t.field.ssid}</span>
          <input className="gf-field sm" value={F('ssid')} onChange={(e) => setF('ssid', e.target.value)}
            placeholder={t.field.ph.ssid} aria-label={t.field.ssid} /></label>
        <div><span className="micro">{t.field.encryption}</span>
          <div className="gf-seg">
            {['WPA', 'WEP', 'nopass'].map((v) => (
              <button key={v} type="button" aria-pressed={enc === v} className={enc === v ? 'on' : ''}
                onClick={() => setF('enc', v)}>{v === 'nopass' ? t.field.encNone : v}</button>
            ))}
          </div>
        </div>
        {/* An open network has no password to type, so the block dims out. */}
        <label className={enc === 'nopass' ? 'dim' : ''}><span className="micro">{t.field.password}</span>
          <input className="gf-field sm mono" type="password" value={F('pass')} onChange={(e) => setF('pass', e.target.value)}
            placeholder={t.field.ph.pass} aria-label={t.field.password} /></label>
        <button type="button" role="checkbox" aria-checked={!!fields.hidden} className="gf-check bottom"
          onClick={() => setF('hidden', !fields.hidden)}>
          <span className="box">{fields.hidden ? '✓' : ''}</span>{t.gen.hiddenNetwork}
        </button>
      </div>
    );
  }
  if (mode === 'vcard') return (
    <div className="gf-grid vcard">
      {[['first', t.field.firstName, t.field.ph.first], ['last', t.field.lastName, t.field.ph.last],
        ['phone', t.field.phone, t.field.ph.phone], ['email', t.field.email, t.field.ph.email],
        ['company', t.field.company, t.field.ph.company], ['website', t.field.website, t.field.ph.website]].map(([k, lab, ph]) => (
        <label key={k}><span className="micro">{lab}</span>
          <input className="gf-field sm" value={F(k)} onChange={(e) => setF(k, e.target.value)} placeholder={ph} aria-label={lab} /></label>
      ))}
    </div>
  );
  if (mode === 'tel') return (
    <label className="gf-single"><span className="micro">{t.field.phone}</span>
      <input className="gf-field sm mono" type="tel" value={F('phone')} onChange={(e) => setF('phone', e.target.value)}
        placeholder={t.field.phoneIntl} aria-label={t.field.phoneAria} /></label>
  );
  if (mode === 'sms' || mode === 'whatsapp') return (
    <div className="gf-grid pair">
      <label><span className="micro">{mode === 'whatsapp' ? t.field.whatsappNumber : t.field.phoneNumber}</span>
        <input className="gf-field sm mono" type="tel" value={F('number')} onChange={(e) => setF('number', e.target.value)}
          placeholder={t.field.phoneIntl} aria-label={t.field.phoneAria} /></label>
      <label><span className="micro">{t.field.prefilledMessage}</span>
        <input className="gf-field sm" value={F('message')} onChange={(e) => setF('message', e.target.value)}
          placeholder={mode === 'whatsapp' ? t.field.ph.waMessage : t.field.ph.message}
          aria-label={t.field.prefilledMessage} /></label>
    </div>
  );
  if (mode === 'email') return (
    <div className="gf-grid email">
      {[['email', t.field.emailAddress, t.field.ph.to], ['subject', t.field.emailSubject, t.field.ph.subject],
        ['body', t.field.emailBody, t.field.ph.body]].map(([k, lab, ph]) => (
        <label key={k}><span className="micro">{lab}</span>
          <input className="gf-field sm" value={F(k)} onChange={(e) => setF(k, e.target.value)} placeholder={ph} aria-label={lab} /></label>
      ))}
    </div>
  );
  if (mode === 'crypto') return (
    <div className="gf-grid email">
      {[['address', t.field.bitcoinAddress], ['amount', t.field.amountBtc], ['label', t.field.label]].map(([k, lab]) => (
        <label key={k}><span className="micro">{lab}</span>
          <input className="gf-field sm" value={F(k)} onChange={(e) => setF(k, e.target.value)} placeholder={lab} aria-label={lab} /></label>
      ))}
    </div>
  );
  return null;
}
