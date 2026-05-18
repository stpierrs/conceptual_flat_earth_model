// eclipseOverlay.js — Prague Astronomical Clock styled eclipse predictor.
//
// Draggable/resizable geocentric astrolabium showing:
//   • Ecliptic zodiac ring with gold sign glyphs
//   • Moon ascending/descending node positions (☊ ☋) — Dragon's Head/Tail
//   • Eclipse-zone highlights near each node
//   • Live Sun arm and Moon arm at their ecliptic longitudes
//   • Upcoming eclipse table (ECLIPSES FUTURAE)
//
// All quantities are angular (degrees). No distances, no mass, no gravity.
// The Saros cycle emerges from three observable periods already in the model.

import { findEclipses, sunLon, moonEcliptic } from '../core/epicycle_ephemeris/eclipsePredictor.js';
import { MOON }                                from '../core/epicycle_ephemeris/epiParams.js';
import { j2000Day, degmod }                    from '../core/epicycle_ephemeris/epiCore.js';
import { dateTimeToDate }                      from '../core/time.js';

// ── Prague Clock palette ──────────────────────────────────────────────────────
const GOLD       = '#c8a84b';
const GOLD_LT    = '#e8d09a';
const GOLD_DIM   = 'rgba(200,168,75,0.30)';
const GOLD_GLOW  = 'rgba(200,168,75,0.50)';
const NAVY       = '#060914';
const NAVY_MID   = '#0c1230';
const SUN_COL    = '#f5d060';
const SUN_GLOW   = 'rgba(245,208,96,0.85)';
const MOON_COL   = '#c8c8e0';
const MOON_GLOW  = 'rgba(200,200,224,0.65)';
const NODE_COL   = '#e05858';
const NODE_GLOW  = 'rgba(224,88,88,0.60)';
const SOLAR_COL  = '#ff8830';
const LUNAR_COL  = '#b06090';
const TEXT_GOLD  = '#dfc87a';
const TEXT_DIM   = 'rgba(220,190,120,0.40)';
const BG_PANEL   = 'rgba(6,8,20,0.97)';
const HDR_BG     = 'rgba(8,12,32,0.96)';
const BORDER_COL = 'rgba(200,168,75,0.65)';
const DIVIDER    = 'rgba(200,168,75,0.18)';

const TAU = 2 * Math.PI;
const RAD = Math.PI / 180;

// Zodiac: λ=0° = Aries, each sign spans 30°.
const ZODIAC = [
  { glyph: '♈', name: 'Aries'       },
  { glyph: '♉', name: 'Taurus'      },
  { glyph: '♊', name: 'Gemini'      },
  { glyph: '♋', name: 'Cancer'      },
  { glyph: '♌', name: 'Leo'         },
  { glyph: '♍', name: 'Virgo'       },
  { glyph: '♎', name: 'Libra'       },
  { glyph: '♏', name: 'Scorpio'     },
  { glyph: '♐', name: 'Sagittarius' },
  { glyph: '♑', name: 'Capricorn'   },
  { glyph: '♒', name: 'Aquarius'    },
  { glyph: '♓', name: 'Pisces'      },
];

// λ=0 (Aries) → 3 o'clock (right); longitude increases counterclockwise on-screen.
// Formula: canvas_angle = −λ × (π/180)
const lonToAngle = λ => -λ * RAD;

function glowFn(ctx, color, blur, fn) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur  = blur;
  fn();
  ctx.shadowBlur = 0;
  ctx.restore();
}

function ringArc(ctx, cx, cy, rOuter, rInner, a0, a1) {
  // Annular sector: outer arc CCW (anticlockwise=true) from a0 to a1,
  // inner arc CW (anticlockwise=false) back from a1 to a0.
  ctx.beginPath();
  ctx.arc(cx, cy, rOuter, a0, a1, true);
  ctx.arc(cx, cy, rInner, a1, a0, false);
  ctx.closePath();
}

// Pointer arm from hub (r=rHub) out to r=rTip, with a glowing disc at the tip.
function drawArm(ctx, cx, cy, ang, rTip, rHub, lineCol, dotCol, dotGlow, dotR) {
  glowFn(ctx, lineCol + '80', 10, () => {
    ctx.beginPath();
    ctx.moveTo(cx + rHub * Math.cos(ang), cy + rHub * Math.sin(ang));
    ctx.lineTo(cx + rTip * Math.cos(ang), cy + rTip * Math.sin(ang));
    ctx.strokeStyle = lineCol;
    ctx.lineWidth   = 2;
    ctx.stroke();
  });
  const tx = cx + rTip * Math.cos(ang);
  const ty = cy + rTip * Math.sin(ang);
  glowFn(ctx, dotGlow, 16, () => {
    ctx.beginPath();
    ctx.arc(tx, ty, dotR, 0, TAU);
    ctx.fillStyle = dotCol;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth   = 1;
    ctx.stroke();
  });
}

// ── Eclipse prediction cache ──────────────────────────────────────────────────
// Recomputed only when the model date shifts by more than 30 days.
let _eclCache   = null;
let _eclCacheMs = null;

function getEclipses(date) {
  const ms = date.getTime();
  if (!_eclCache || Math.abs(ms - _eclCacheMs) > 30 * 86400000) {
    _eclCacheMs = ms;
    const end = new Date(ms + 730 * 86400000);
    _eclCache = findEclipses(date, end).slice(0, 12);
  }
  return _eclCache;
}

// ── Clock face ────────────────────────────────────────────────────────────────

function drawClock(ctx, date, W, CLOCK_H) {
  const t  = j2000Day(date);
  const cx = W / 2;
  const cy = CLOCK_H / 2;
  const R  = Math.min(cx, cy) * 0.86;

  // Concentric radius definitions
  const Ro   = R;           // outer edge of zodiac ring
  const Rzi  = R * 0.830;  // inner edge of zodiac ring
  const Rdi  = R * 0.750;  // outer edge of main disc (gap = Rdi..Rzi)
  const Rec  = R * 0.120;  // central Earth emblem radius

  // ── Sky background ─────────────────────────────────────────────────────────
  const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Ro);
  bg.addColorStop(0,   '#1a2460');
  bg.addColorStop(0.7, '#0c1230');
  bg.addColorStop(1,   '#060914');
  ctx.beginPath();
  ctx.arc(cx, cy, Ro, 0, TAU);
  ctx.fillStyle = bg;
  ctx.fill();

  // Subtle outer ambient glow
  const aura = ctx.createRadialGradient(cx, cy, Rdi, cx, cy, Ro + 8);
  aura.addColorStop(0, 'rgba(200,168,75,0)');
  aura.addColorStop(1, 'rgba(200,168,75,0.05)');
  ctx.beginPath();
  ctx.arc(cx, cy, Ro + 8, 0, TAU);
  ctx.fillStyle = aura;
  ctx.fill();

  // ── Zodiac ring sectors ────────────────────────────────────────────────────
  for (let i = 0; i < 12; i++) {
    const a0 = lonToAngle(i * 30);
    const a1 = lonToAngle((i + 1) * 30);
    // Fill alternating colours
    ringArc(ctx, cx, cy, Ro, Rzi, a0, a1);
    ctx.fillStyle = i % 2 === 0 ? '#0c1438' : '#080e2c';
    ctx.fill();

    // Gold radial divider at start of each sign
    glowFn(ctx, GOLD_GLOW, 3, () => {
      ctx.beginPath();
      ctx.moveTo(cx + Rzi * Math.cos(a0), cy + Rzi * Math.sin(a0));
      ctx.lineTo(cx + Ro  * Math.cos(a0), cy + Ro  * Math.sin(a0));
      ctx.strokeStyle = GOLD;
      ctx.lineWidth   = 1.1;
      ctx.stroke();
    });

    // Zodiac glyph at sector midpoint
    const midA = lonToAngle(i * 30 + 15);
    const gR   = (Rzi + Ro) / 2;
    ctx.fillStyle = GOLD_LT;
    ctx.font = `bold ${Math.round(R * 0.092)}px serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ZODIAC[i].glyph, cx + gR * Math.cos(midA), cy + gR * Math.sin(midA));
  }

  // Outer and inner borders of the zodiac ring
  glowFn(ctx, GOLD_GLOW, 6, () => {
    ctx.beginPath(); ctx.arc(cx, cy, Ro,  0, TAU);
    ctx.strokeStyle = GOLD; ctx.lineWidth = 1.8; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, Rzi, 0, TAU);
    ctx.strokeStyle = GOLD; ctx.lineWidth = 1.2; ctx.stroke();
  });

  // ── Degree tick marks on inner edge of zodiac ring ─────────────────────────
  for (let deg = 0; deg < 360; deg++) {
    if (deg % 30 === 0) continue;       // zodiac dividers already drawn
    const a       = lonToAngle(deg);
    const isMajor = deg % 10 === 0;
    const len     = isMajor ? R * 0.038 : R * 0.018;
    ctx.beginPath();
    ctx.moveTo(cx + (Rzi - len) * Math.cos(a), cy + (Rzi - len) * Math.sin(a));
    ctx.lineTo(cx + Rzi         * Math.cos(a), cy + Rzi         * Math.sin(a));
    ctx.strokeStyle = isMajor ? 'rgba(200,168,75,0.55)' : 'rgba(200,168,75,0.22)';
    ctx.lineWidth   = isMajor ? 1 : 0.5;
    ctx.stroke();
  }

  // ── Eclipse zone highlights in the gap (Rdi..Rzi) ─────────────────────────
  // Eclipse occurs when |Moon ecliptic latitude| < ~1.57°, which corresponds
  // to the Moon being within ≈15° of a node along the ecliptic.
  const NODE_HALF = 15;
  const Nm        = degmod(MOON.N0 - t * MOON.nnode); // ascending node longitude
  const gapMid    = (Rdi + Rzi) / 2;
  const gapW      = (Rzi - Rdi) * 0.78;

  for (const nodeLon of [Nm, degmod(Nm + 180)]) {
    // lonToAngle negates λ, so Nm+15 → more-negative angle, Nm-15 → less-negative.
    // arc(start, end, false) goes clockwise in canvas (angle increasing), giving the
    // short 30° arc when start < end.
    const arcStart = lonToAngle(nodeLon + NODE_HALF);
    const arcEnd   = lonToAngle(nodeLon - NODE_HALF);
    glowFn(ctx, NODE_GLOW, 10, () => {
      ctx.beginPath();
      ctx.arc(cx, cy, gapMid, arcStart, arcEnd, false);
      ctx.strokeStyle = 'rgba(224,88,88,0.45)';
      ctx.lineWidth   = gapW;
      ctx.stroke();
    });
  }

  // Gap border circles
  glowFn(ctx, GOLD_DIM, 2, () => {
    ctx.beginPath(); ctx.arc(cx, cy, Rdi, 0, TAU);
    ctx.strokeStyle = GOLD_DIM; ctx.lineWidth = 0.8; ctx.stroke();
  });

  // ── Inner disc decorative rings ────────────────────────────────────────────
  for (const fr of [0.68, 0.60, 0.52]) {
    ctx.beginPath(); ctx.arc(cx, cy, R * fr, 0, TAU);
    ctx.strokeStyle = GOLD_DIM; ctx.lineWidth = 0.5; ctx.stroke();
  }

  // ── Node markers — Dragon's Head ☊ and Tail ☋ ─────────────────────────────
  const nodes = [
    { lon: Nm,             sym: '☊' },
    { lon: degmod(Nm+180), sym: '☋' },
  ];
  for (const { lon, sym } of nodes) {
    const na = lonToAngle(lon);
    const nr = Rdi * 0.875;
    const nx = cx + nr * Math.cos(na);
    const ny = cy + nr * Math.sin(na);
    const nr2 = R * 0.034;
    glowFn(ctx, NODE_GLOW, 12, () => {
      ctx.beginPath(); ctx.arc(nx, ny, nr2, 0, TAU);
      ctx.fillStyle = '#1a0408'; ctx.fill();
      ctx.strokeStyle = NODE_COL; ctx.lineWidth = 1.4; ctx.stroke();
    });
    ctx.fillStyle    = NODE_COL;
    ctx.font         = `${Math.round(R * 0.052)}px serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(sym, nx, ny);
  }

  // ── Sun arm ────────────────────────────────────────────────────────────────
  const sunLonDeg = sunLon(t);
  const sunAng    = lonToAngle(sunLonDeg);
  drawArm(ctx, cx, cy, sunAng, Rdi * 0.820, Rec * 1.6, SUN_COL, SUN_COL, SUN_GLOW, R * 0.058);
  // Sun symbol beyond the disc tip
  glowFn(ctx, SUN_GLOW, 8, () => {
    ctx.fillStyle    = SUN_COL;
    ctx.font         = `${Math.round(R * 0.055)}px serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('☀', cx + (Rdi * 0.820 + R * 0.075) * Math.cos(sunAng),
                      cy + (Rdi * 0.820 + R * 0.075) * Math.sin(sunAng));
  });

  // ── Moon arm ───────────────────────────────────────────────────────────────
  const { lon: moonLonDeg, lat: moonLatDeg } = moonEcliptic(t);
  const moonAng = lonToAngle(moonLonDeg);
  drawArm(ctx, cx, cy, moonAng, Rdi * 0.630, Rec * 1.6, MOON_COL, MOON_COL, MOON_GLOW, R * 0.044);
  glowFn(ctx, MOON_GLOW, 6, () => {
    ctx.fillStyle    = MOON_COL;
    ctx.font         = `${Math.round(R * 0.046)}px serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('☽', cx + (Rdi * 0.630 + R * 0.062) * Math.cos(moonAng),
                      cy + (Rdi * 0.630 + R * 0.062) * Math.sin(moonAng));
  });

  // ── Central Earth emblem ⊕ ─────────────────────────────────────────────────
  glowFn(ctx, GOLD_GLOW, 14, () => {
    const eg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Rec);
    eg.addColorStop(0, '#243878');
    eg.addColorStop(1, '#101a44');
    ctx.beginPath(); ctx.arc(cx, cy, Rec, 0, TAU);
    ctx.fillStyle = eg; ctx.fill();
    ctx.strokeStyle = GOLD; ctx.lineWidth = 1.6; ctx.stroke();
  });
  ctx.strokeStyle = GOLD_LT; ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(cx - Rec, cy); ctx.lineTo(cx + Rec, cy);
  ctx.moveTo(cx, cy - Rec); ctx.lineTo(cx, cy + Rec);
  ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, Rec * 0.50, 0, TAU);
  ctx.strokeStyle = 'rgba(200,168,75,0.45)'; ctx.lineWidth = 0.7; ctx.stroke();

  // ── Equinox / solstice cardinal labels outside the zodiac ring ─────────────
  const CARDS = [
    { lon:   0, label: 'VER' },
    { lon:  90, label: 'AES' },
    { lon: 180, label: 'AUT' },
    { lon: 270, label: 'HIE' },
  ];
  for (const { lon, label } of CARDS) {
    const ca = lonToAngle(lon);
    const cr = Ro + R * 0.055;
    ctx.fillStyle    = TEXT_DIM;
    ctx.font         = `bold ${Math.round(R * 0.048)}px ui-monospace,monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cx + cr * Math.cos(ca), cy + cr * Math.sin(ca));
  }

  // ── Data readout in lower half of disc ─────────────────────────────────────
  const elongation = degmod(moonLonDeg - sunLonDeg);
  const readY = cy + R * 0.36;
  ctx.fillStyle    = TEXT_GOLD;
  ctx.font         = `${Math.round(R * 0.068)}px ui-monospace,monospace`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(`☀ ${sunLonDeg.toFixed(1)}°  ☽ ${moonLonDeg.toFixed(1)}°`, cx, readY);
  ctx.fillStyle = TEXT_DIM;
  ctx.font      = `${Math.round(R * 0.054)}px ui-monospace,monospace`;
  ctx.fillText(`β ${moonLatDeg >= 0 ? '+' : ''}${moonLatDeg.toFixed(2)}°  D ${elongation.toFixed(1)}°`,
               cx, readY + R * 0.088);
}

// ── Eclipse list (ECLIPSES FUTURAE) ──────────────────────────────────────────

const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

function drawEclipseList(ctx, eclipses, x0, y0, W, H, now) {
  // Section divider
  ctx.strokeStyle = DIVIDER;
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(x0 + 12, y0);
  ctx.lineTo(x0 + W - 12, y0);
  ctx.stroke();

  // Header
  const HDR_H = 24;
  glowFn(ctx, GOLD_GLOW, 4, () => {
    ctx.fillStyle    = GOLD_LT;
    ctx.font         = `bold ${Math.round(W * 0.040)}px ui-monospace,monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ECLIPSES · FUTURAE', x0 + W / 2, y0 + HDR_H / 2);
  });

  const listY0  = y0 + HDR_H;
  const upcoming = eclipses.filter(e => e.date >= now);
  const maxRows  = Math.floor((H - HDR_H) / 22);

  if (upcoming.length === 0) {
    ctx.fillStyle    = TEXT_DIM;
    ctx.font         = `${Math.round(W * 0.036)}px ui-monospace,monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No eclipses in search window', x0 + W / 2, listY0 + (H - HDR_H) / 2);
    return;
  }

  for (let i = 0; i < Math.min(upcoming.length, maxRows); i++) {
    const e   = upcoming[i];
    const ry  = listY0 + i * 22;
    const rcy = ry + 11;

    // Alternating row tint
    if (i % 2 === 0) {
      ctx.fillStyle = 'rgba(18,22,56,0.55)';
      ctx.fillRect(x0, ry, W, 22);
    }

    const isSolar  = e.type === 'solar';
    const typeCol  = isSolar ? SOLAR_COL : LUNAR_COL;
    const typeIcon = isSolar ? '☀' : '☽';
    const d        = e.date;
    const dateStr  = `${d.getUTCFullYear()} ${MONTHS[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2,'0')}`;
    const sub      = e.subtype.toUpperCase();
    const magBars  = Math.round(e.magnitude * 5);
    const magStr   = '█'.repeat(magBars) + '░'.repeat(5 - magBars);
    const PAD      = 9;
    const fsz      = Math.round(Math.min(W * 0.037, 13));

    ctx.font      = `${fsz}px ui-monospace,monospace`;
    ctx.textBaseline = 'middle';

    ctx.fillStyle = typeCol;
    ctx.textAlign = 'left';
    ctx.fillText(typeIcon, x0 + PAD, rcy);

    ctx.fillStyle = TEXT_GOLD;
    ctx.fillText(dateStr, x0 + PAD + fsz + 5, rcy);

    ctx.fillStyle = typeCol;
    ctx.textAlign = 'right';
    ctx.fillText(sub, x0 + W - PAD - fsz * 5.8, rcy);

    ctx.fillStyle = typeCol;
    ctx.fillText(magStr, x0 + W - PAD, rcy);
  }
}

// ── Panel shell ───────────────────────────────────────────────────────────────

export function buildEclipseOverlay(viewEl, model) {
  const wrap = document.createElement('div');
  wrap.id = 'eclipse-overlay';
  Object.assign(wrap.style, {
    position:     'absolute',
    top:          '52px',
    right:        '386px',   // sits to the left of the epicycle overlay (360 + 12 + 2*border)
    width:        '310px',
    minWidth:     '200px',
    background:   BG_PANEL,
    border:       `2px solid ${BORDER_COL}`,
    boxShadow:    `0 0 0 1px rgba(100,70,10,0.30),
                   0 0 18px 4px rgba(160,120,20,0.22),
                   0 0 42px 8px rgba(80,60,0,0.14),
                   inset 0 0 0 1px rgba(200,168,75,0.08)`,
    borderRadius: '8px',
    padding:      '0',
    fontFamily:   'ui-monospace, Menlo, monospace',
    color:        TEXT_GOLD,
    zIndex:       '20',
    userSelect:   'none',
    overflow:     'hidden',
    zoom:         'var(--ui-zoom, 1)',
  });

  // Header (draggable)
  const header = document.createElement('div');
  Object.assign(header.style, {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    padding:        '6px 10px 5px',
    borderBottom:   `1px solid ${DIVIDER}`,
    cursor:         'grab',
    background:     HDR_BG,
  });

  const titleEl = document.createElement('span');
  Object.assign(titleEl.style, {
    fontSize: '12px', fontWeight: 'bold', letterSpacing: '0.10em',
    color: GOLD_LT, textShadow: `0 0 8px ${GOLD}`,
  });
  titleEl.textContent = '◎ ECLIPSE PREDICTOR';

  const subtitleEl = document.createElement('span');
  Object.assign(subtitleEl.style, {
    fontSize: '9px', fontStyle: 'italic', color: TEXT_DIM,
  });
  subtitleEl.textContent = 'Saros · Draconic · Synodic';

  header.appendChild(titleEl);
  header.appendChild(subtitleEl);
  wrap.appendChild(header);

  // Canvas
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block; width:100%;';
  wrap.appendChild(canvas);

  // Footer
  const footer = document.createElement('div');
  Object.assign(footer.style, {
    padding: '3px 10px 4px', borderTop: `1px solid ${DIVIDER}`,
    fontSize: '8.5px', lineHeight: '1.4',
    background: 'rgba(6,8,20,0.7)', color: TEXT_DIM, textAlign: 'center',
  });
  footer.textContent = 'Eclipse when syzygy ≤15° from Moon\'s node  ·  no distances, no mass';
  wrap.appendChild(footer);

  // Resize handles
  function mkHandle(side) {
    const h = document.createElement('div');
    Object.assign(h.style, {
      position: 'absolute', bottom: '0', [side]: '0',
      width: '20px', height: '20px',
      cursor: side === 'left' ? 'nesw-resize' : 'nwse-resize', zIndex: '30',
    });
    const pts = side === 'left' ? '0,20 20,20 20,0' : '20,20 0,20 0,0';
    h.innerHTML = `<svg width="20" height="20" style="display:block;opacity:0.60">
      <polyline points="${pts}" fill="none" stroke="${GOLD}" stroke-width="2"/>
    </svg>`;
    wrap.appendChild(h);
    return h;
  }
  const handleL = mkHandle('left');
  const handleR = mkHandle('right');
  viewEl.appendChild(wrap);

  const ctx = canvas.getContext('2d');
  const LIST_H = 174;

  function syncCanvas() {
    const W = wrap.clientWidth;
    const H = W + LIST_H;
    canvas.width  = W;
    canvas.height = H;
    canvas.style.height = H + 'px';
  }

  // Drag
  let dragging = false, dragOx = 0, dragOy = 0;
  header.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    dragging = true;
    const r = wrap.getBoundingClientRect(), vr = viewEl.getBoundingClientRect();
    wrap.style.right = 'auto';
    wrap.style.left  = (r.left - vr.left) + 'px';
    wrap.style.top   = (r.top  - vr.top)  + 'px';
    dragOx = e.clientX - r.left;
    dragOy = e.clientY - r.top;
    header.style.cursor = 'grabbing';
    e.preventDefault();
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const vr = viewEl.getBoundingClientRect();
    wrap.style.left = (e.clientX - vr.left - dragOx) + 'px';
    wrap.style.top  = (e.clientY - vr.top  - dragOy) + 'px';
  });
  window.addEventListener('mouseup', () => {
    if (dragging) { dragging = false; header.style.cursor = 'grab'; }
  });

  // Resize
  function makeResizer(handle, getDeltas) {
    let resizing = false, startX = 0, startW = 0, startL = 0;
    handle.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      resizing = true; startX = e.clientX; startW = wrap.offsetWidth;
      const r = wrap.getBoundingClientRect(), vr = viewEl.getBoundingClientRect();
      startL = r.left - vr.left;
      wrap.style.right = 'auto'; wrap.style.left = startL + 'px';
      e.preventDefault(); e.stopPropagation();
    });
    window.addEventListener('mousemove', (e) => {
      if (!resizing) return;
      const { dW, dX } = getDeltas(e.clientX - startX);
      const nW = Math.max(200, startW + dW);
      wrap.style.width = nW + 'px';
      if (dX) wrap.style.left = (startL + startW - nW) + 'px';
      syncCanvas();
    });
    window.addEventListener('mouseup', () => { resizing = false; });
  }
  makeResizer(handleR, (dx) => ({ dW:  dx, dX: 0 }));
  makeResizer(handleL, (dx) => ({ dW: -dx, dX: 1 }));

  // Render loop — redraws only when the model time changes.
  let lastModelDT = null;

  function frame() {
    requestAnimationFrame(frame);
    const modelDT = model.state.DateTime;
    const needResize = canvas.width !== wrap.clientWidth;
    if (modelDT === lastModelDT && !needResize) return;
    lastModelDT = modelDT;
    if (needResize) syncCanvas();

    const date     = dateTimeToDate(modelDT);
    const W        = canvas.width;
    const CLOCK_H  = W;           // square clock face
    const H        = W + LIST_H;

    // Full background
    ctx.fillStyle = NAVY;
    ctx.fillRect(0, 0, W, H);

    drawClock(ctx, date, W, CLOCK_H);

    const eclipses = getEclipses(date);
    drawEclipseList(ctx, eclipses, 0, CLOCK_H, W, LIST_H, date);
  }

  syncCanvas();
  frame();
}
