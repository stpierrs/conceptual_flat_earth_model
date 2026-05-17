// Ptolemaic epicycle geometry overlay — aetheric plasma aesthetic.
// Horizontal apsidal axis; Galilean moon strip for Jupiter.
// RAF loop reads model.state.DateTime every frame → motion tracks time speed exactly.

import { ptolemyGeometry } from '../core/ephemerisPtolemy.js';
import { dateTimeToDate }  from '../core/time.js';

const RAD = Math.PI / 180;
const PTOLEMY_NAMES = new Set(['sun','moon','mercury','venus','mars','jupiter','saturn']);

// ── Aetheric plasma colour palette ───────────────────────────────────────────
const BG_PANEL     = 'rgba(8,4,18,0.96)';
const BORDER_COL   = 'rgba(140,80,240,0.75)';
const HDR_BG       = 'rgba(18,8,40,0.88)';
const DEFERENT_COL = '#3a9ae0';          // electric blue
const DEF_GLOW     = 'rgba(60,154,224,0.6)';
const EPICYCLE_COL = '#c040c0';          // plasma magenta
const EPI_GLOW     = 'rgba(192,64,192,0.55)';
const EARTH_COL    = '#d8d0ff';          // pale violet-white
const EARTH_GLOW   = 'rgba(160,120,255,0.7)';
const APSIS_COL    = '#28d8b0';          // teal-cyan
const APSIS_GLOW   = 'rgba(40,216,176,0.5)';
const ARM_COL      = 'rgba(130,200,255,0.45)';
const UNIFORM_COL  = 'rgba(160,220,255,0.8)';
const DOT_COL      = 'rgba(180,150,255,0.7)';
const LABEL_COL    = '#b8b0e0';
const STATS_COL    = 'rgba(160,140,220,0.55)';
const DIVIDER      = 'rgba(120,80,220,0.3)';

// Per-body colour + plasma glow
const BODY_STYLE = {
  sun:     { col: '#f5d060', glow: 'rgba(245,208,96,0.7)'  },
  moon:    { col: '#c8c8e0', glow: 'rgba(200,200,224,0.5)' },
  mercury: { col: '#b0a880', glow: 'rgba(176,168,128,0.5)' },
  venus:   { col: '#e8d878', glow: 'rgba(232,216,120,0.6)' },
  mars:    { col: '#e05030', glow: 'rgba(224,80,48,0.65)'  },
  jupiter: { col: '#d89858', glow: 'rgba(216,152,88,0.65)' },
  saturn:  { col: '#c8b870', glow: 'rgba(200,184,112,0.55)'},
};

// ── Galilean moon parameters (J2000.0 reference) ──────────────────────────────
// rate in °/day; rRel relative to Io = 1; L0 = epoch phase at J2000.0
const J2000_JD = 2451545.0;
const GALILEAN = [
  { name: 'Io',       col: '#e8c848', glow: 'rgba(232,200,72,0.7)',  L0:   0, rate: 203.4890, rRel: 1.000 },
  { name: 'Europa',   col: '#90c0e8', glow: 'rgba(144,192,232,0.6)', L0: 120, rate: 101.3747, rRel: 1.591 },
  { name: 'Ganymede', col: '#c8a870', glow: 'rgba(200,168,112,0.6)', L0: 240, rate:  50.3176, rRel: 2.541 },
  { name: 'Callisto', col: '#8a7868', glow: 'rgba(138,120,104,0.5)', L0:  60, rate:  21.5711, rRel: 4.468 },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function pickBody(model) {
  const follow = model.state.FollowTarget;
  if (follow) {
    const n = (typeof follow === 'string' ? follow : '').toLowerCase();
    if (PTOLEMY_NAMES.has(n)) return n;
  }
  const targets = Array.isArray(model.state.TrackerTargets) ? model.state.TrackerTargets : [];
  for (const t of targets) {
    const n = (typeof t === 'string' ? t : (t && t.id) || '').toLowerCase();
    if (PTOLEMY_NAMES.has(n)) return n;
  }
  return null;
}

function glow(ctx, color, blur, fn) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur  = blur;
  fn();
  ctx.shadowBlur  = 0;
  ctx.restore();
}

function glowCircle(ctx, x, y, r, fillCol, glowCol, blurR, stroke, strokeW) {
  glow(ctx, glowCol, blurR, () => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    if (fillCol) { ctx.fillStyle = fillCol; ctx.fill(); }
    if (stroke)  { ctx.strokeStyle = stroke; ctx.lineWidth = strokeW || 1.5; ctx.stroke(); }
  });
}

function labelCircle(ctx, x, y, r, fillCol, glowCol, letter) {
  glowCircle(ctx, x, y, r, fillCol, glowCol, 10);
  ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.max(9, Math.round(r))}px ui-monospace,monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(letter, x, y);
}

// ── Main deferent+epicycle diagram ────────────────────────────────────────────
function drawDiagram(ctx, geom, W, H, bodyName) {
  ctx.clearRect(0, 0, W, H);

  const { ecc, epi, meccanom, tepianom, pros } = geom;
  const teccanom = meccanom + pros;

  const cx = W * 0.5, cy = H * 0.50;
  const margin = 30;
  const R   = Math.min(cx - margin, cy - margin) / (1 + epi + 0.10);
  const eccPx = ecc * R, epiPx = epi * R;

  // Key points — apogee LEFT, perigee RIGHT
  const Dx = cx, Dy = cy;
  const Zx = Dx - eccPx, Zy = Dy;
  const Qx = Dx + eccPx, Qy = Dy;
  const Ax = Dx - R,     Ay = Dy;
  const Gx = Dx + R,     Gy = Dy;

  const tecRad  = teccanom * RAD;
  const Tx = Dx - R * Math.cos(tecRad);
  const Ty = Dy - R * Math.sin(tecRad);

  const baseAngle = Math.atan2(Ty - Dy, Tx - Dx);
  const tepRad    = tepianom * RAD;
  const Px = Tx + epiPx * Math.cos(baseAngle + tepRad);
  const Py = Ty + epiPx * Math.sin(baseAngle + tepRad);

  const bs = BODY_STYLE[bodyName] || { col: '#c8b0f0', glow: 'rgba(200,176,240,0.6)' };

  // Apsidal axis
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = DIVIDER; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(Ax, Ay); ctx.lineTo(Gx, Gy); ctx.stroke();
  ctx.setLineDash([]);

  // Deferent circle
  glowCircle(ctx, Dx, Dy, R, null, DEF_GLOW, 12, DEFERENT_COL, 1.8);

  // Epicycle circle
  if (epiPx > 3)
    glowCircle(ctx, Tx, Ty, epiPx, null, EPI_GLOW, 10, EPICYCLE_COL, 1.5);

  // Z → Θ arm (equation of centre)
  glow(ctx, ARM_COL, 6, () => {
    ctx.strokeStyle = ARM_COL; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(Zx, Zy); ctx.lineTo(Tx, Ty); ctx.stroke();
  });

  // Q → Θ arm (equant / uniform motion)
  if (epiPx > 4) {
    glow(ctx, UNIFORM_COL, 8, () => {
      ctx.strokeStyle = UNIFORM_COL; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(Qx, Qy); ctx.lineTo(Tx, Ty); ctx.stroke();
    });
    const mx = (Qx + Tx) / 2, my = (Qy + Ty) / 2;
    const ang = Math.atan2(Ty - Qy, Tx - Qx);
    ctx.save();
    ctx.translate(mx, my); ctx.rotate(ang);
    ctx.fillStyle = UNIFORM_COL;
    ctx.font = '8px ui-monospace,monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText('uniform motion', 0, -3);
    ctx.restore();
  }

  // Θ → planet arm
  if (epiPx > 2) {
    ctx.strokeStyle = 'rgba(200,160,255,0.35)'; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(Tx, Ty); ctx.lineTo(Px, Py); ctx.stroke();
  }

  // A and G apsidal circles
  const aR = Math.max(10, R * 0.12);
  labelCircle(ctx, Ax, Ay, aR, APSIS_COL, APSIS_GLOW, 'A');
  labelCircle(ctx, Gx, Gy, aR, APSIS_COL, APSIS_GLOW, 'G');
  ctx.fillStyle = APSIS_COL; ctx.font = '8px ui-monospace,monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText('Apogee',  Ax, Ay + aR + 2);
  ctx.fillText('Perigee', Gx, Gy + aR + 2);

  // Earth Z
  const zR = Math.max(9, R * 0.10);
  labelCircle(ctx, Zx, Zy, zR, EARTH_COL, EARTH_GLOW, 'Z');

  // D dot
  glow(ctx, DOT_COL, 6, () => {
    ctx.beginPath(); ctx.arc(Dx, Dy, 3, 0, 2 * Math.PI);
    ctx.fillStyle = DOT_COL; ctx.fill();
  });
  ctx.fillStyle = LABEL_COL; ctx.font = '9px ui-monospace,monospace';
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText('D', Dx + 4, Dy + 1);

  // Q dot
  glow(ctx, DOT_COL, 5, () => {
    ctx.beginPath(); ctx.arc(Qx, Qy, 3, 0, 2 * Math.PI);
    ctx.fillStyle = DOT_COL; ctx.fill();
  });
  ctx.fillStyle = LABEL_COL; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText('Q', Qx + 4, Qy + 1);

  // Θ dot
  if (epiPx > 2) {
    glow(ctx, EPI_GLOW, 5, () => {
      ctx.beginPath(); ctx.arc(Tx, Ty, 2.5, 0, 2 * Math.PI);
      ctx.fillStyle = EPICYCLE_COL; ctx.fill();
    });
    ctx.fillStyle = LABEL_COL; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('Θ', Tx + 4, Ty + 1);
  }

  // Planet
  const pR = Math.max(11, R * 0.14);
  const planetX = epiPx > 2 ? Px : Tx;
  const planetY = epiPx > 2 ? Py : Ty;
  // Outer plasma halo
  const halo = ctx.createRadialGradient(planetX, planetY, pR, planetX, planetY, pR * 2.2);
  halo.addColorStop(0, bs.glow); halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.beginPath(); ctx.arc(planetX, planetY, pR * 2.2, 0, 2 * Math.PI);
  ctx.fillStyle = halo; ctx.fill();
  // Core
  glowCircle(ctx, planetX, planetY, pR, bs.col, bs.glow, 14,
             'rgba(255,255,255,0.25)', 1);
  // Label
  ctx.fillStyle = '#fff';
  ctx.font = `bold 11px ui-monospace,monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = planetY < Dy ? 'bottom' : 'top';
  ctx.fillText(geom.bodyName, planetX,
    planetY + (planetY < Dy ? -pR - 3 : pR + 3));

  // Stats
  ctx.fillStyle = STATS_COL; ctx.font = '8px ui-monospace,monospace';
  ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
  ctx.fillText(
    `rα/c = ${(epi * 100).toFixed(1)}%  ·  e = ${(ecc * 100).toFixed(1)}%`,
    6, H - 3);
}

// ── Galilean moon telescope strip ─────────────────────────────────────────────
function drawMoons(ctx, date, W, yTop) {
  const H = 110;
  const jd   = date.getTime() / 86400000 + 2440587.5;
  const t    = jd - J2000_JD;                   // days since J2000
  const cx   = W / 2;
  const jy   = yTop + H / 2 - 12;              // Jupiter y centre
  const maxR = cx - 16;                          // Callisto at maxR
  const scale = maxR / GALILEAN[3].rRel;         // px per rRel unit

  // Section divider
  glow(ctx, DIVIDER, 4, () => {
    ctx.strokeStyle = DIVIDER; ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(8, yTop); ctx.lineTo(W - 8, yTop); ctx.stroke();
    ctx.setLineDash([]);
  });

  // Section label
  ctx.fillStyle = LABEL_COL; ctx.font = '9px ui-monospace,monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText('Galilean Moons — Telescope View', cx, yTop + 3);

  // Orbital radius rings (faint ellipses — nearly edge-on)
  for (const m of GALILEAN) {
    const r = m.rRel * scale;
    glow(ctx, m.glow, 3, () => {
      ctx.strokeStyle = m.col.replace(')', ',0.18)').replace('#', 'rgba(') || 'rgba(200,200,100,0.15)';
      // Just draw a horizontal line showing the max swing
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(cx - r, jy); ctx.lineTo(cx + r, jy);
      ctx.stroke();
      // End ticks
      ctx.beginPath();
      ctx.moveTo(cx - r, jy - 3); ctx.lineTo(cx - r, jy + 3);
      ctx.moveTo(cx + r, jy - 3); ctx.lineTo(cx + r, jy + 3);
      ctx.stroke();
    });
  }

  // Jupiter
  const jR = 10;
  const jHalo = ctx.createRadialGradient(cx, jy, jR, cx, jy, jR * 2.5);
  jHalo.addColorStop(0, 'rgba(216,152,88,0.5)'); jHalo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.beginPath(); ctx.arc(cx, jy, jR * 2.5, 0, 2 * Math.PI);
  ctx.fillStyle = jHalo; ctx.fill();
  glowCircle(ctx, cx, jy, jR, '#d89858', 'rgba(216,152,88,0.7)', 12,
             'rgba(255,200,100,0.3)', 1);
  ctx.fillStyle = '#d89858'; ctx.font = 'bold 9px ui-monospace,monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText('♃', cx, jy + jR + 2);

  // Each moon
  for (const m of GALILEAN) {
    const angle = ((m.L0 + m.rate * t) % 360 + 360) % 360;
    const x     = cx + m.rRel * scale * Math.sin(angle * RAD);
    const yInc  = -m.rRel * scale * 0.06 * Math.cos(angle * RAD); // slight inclination
    const my    = jy + yInc;
    const mr    = Math.max(3, 5 - GALILEAN.indexOf(m) * 0.3);

    // Halo
    const mHalo = ctx.createRadialGradient(x, my, mr, x, my, mr * 3);
    mHalo.addColorStop(0, m.glow); mHalo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.arc(x, my, mr * 3, 0, 2 * Math.PI);
    ctx.fillStyle = mHalo; ctx.fill();

    glowCircle(ctx, x, my, mr, m.col, m.glow, 8);

    // Label below
    ctx.fillStyle = m.col; ctx.font = '8px ui-monospace,monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(m.name, x, my + mr + 2);
  }

  // Period labels
  ctx.fillStyle = STATS_COL; ctx.font = '8px ui-monospace,monospace';
  ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
  ctx.fillText('Io 1.77d · Europa 3.55d · Ganymede 7.15d · Callisto 16.7d',
    6, yTop + H - 2);
}

// ── Panel ─────────────────────────────────────────────────────────────────────
export function buildEpicycleOverlay(viewEl, model) {
  const wrap = document.createElement('div');
  wrap.id = 'epicycle-overlay';
  Object.assign(wrap.style, {
    position:     'absolute',
    top:          '52px',
    right:        '12px',
    width:        '360px',
    minWidth:     '200px',
    background:   BG_PANEL,
    border:       `2px solid ${BORDER_COL}`,
    boxShadow:    `0 0 0 1px rgba(80,40,160,0.4),
                   0 0 18px 4px rgba(100,40,200,0.35),
                   0 0 40px 8px rgba(60,0,120,0.2),
                   inset 0 0 0 1px rgba(160,120,255,0.15)`,
    borderRadius: '8px',
    padding:      '0',
    fontFamily:   'ui-monospace, Menlo, monospace',
    color:        LABEL_COL,
    zIndex:       '20',
    display:      'none',
    userSelect:   'none',
    overflow:     'hidden',
    zoom:         'var(--ui-zoom, 1)',
  });

  // Header
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
    fontSize: '15px', fontWeight: 'bold', letterSpacing: '0.05em',
    textShadow: '0 0 10px currentColor',
  });

  const subtitleEl = document.createElement('span');
  Object.assign(subtitleEl.style, {
    fontSize: '9px', fontStyle: 'italic', opacity: '0.6', marginLeft: '8px',
  });
  subtitleEl.textContent = 'Déférent + Epicycle + Equant';

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
    padding: '5px 10px 7px',
    borderTop: `1px solid ${DIVIDER}`,
    fontSize: '10px', lineHeight: '1.5',
    background: 'rgba(8,4,20,0.6)',
  });
  footer.innerHTML =
    `<span style="color:#a080e8">λ = <i>L̄</i> + eq.centre(<i>D</i>,<i>Q</i>) + eq.anomaly(<i>Θ</i>)</span><br>` +
    `<span style="opacity:0.45">Uniform motion as seen from Q (equant) · no physical distances</span>`;
  wrap.appendChild(footer);

  // Resize handles
  function mkHandle(side) {
    const h = document.createElement('div');
    Object.assign(h.style, {
      position: 'absolute', bottom: '0', [side]: '0',
      width: '22px', height: '22px',
      cursor: side === 'left' ? 'nesw-resize' : 'nwse-resize', zIndex: '30',
    });
    const pts = side === 'left' ? '0,22 22,22 22,0' : '22,22 0,22 0,0';
    h.innerHTML = `<svg width="22" height="22" style="display:block;opacity:0.75">
      <polyline points="${pts}" fill="none" stroke="${BORDER_COL}" stroke-width="2.5"/>
    </svg>`;
    wrap.appendChild(h);
    return h;
  }
  const handleL = mkHandle('left'), handleR = mkHandle('right');

  viewEl.appendChild(wrap);

  const ctx = canvas.getContext('2d');

  function canvasH(bodyName, W) {
    const base = Math.max(160, W * 0.80);
    return bodyName === 'jupiter' ? base + 110 : base;
  }

  function syncCanvas(bodyName) {
    const W = wrap.clientWidth;
    const H = canvasH(bodyName || 'sun', W);
    canvas.width = W; canvas.height = H;
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
    dragOx = e.clientX - r.left; dragOy = e.clientY - r.top;
    header.style.cursor = 'grabbing';
    e.preventDefault();
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const vr = viewEl.getBoundingClientRect();
    wrap.style.left = (e.clientX - vr.left - dragOx) + 'px';
    wrap.style.top  = (e.clientY - vr.top  - dragOy) + 'px';
  });
  window.addEventListener('mouseup', () => { if (dragging) { dragging = false; header.style.cursor = 'grab'; } });

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
      syncCanvas(lastBody);
    });
    window.addEventListener('mouseup', () => { resizing = false; });
  }
  makeResizer(handleR, (dx) => ({ dW:  dx, dX: 0 }));
  makeResizer(handleL, (dx) => ({ dW: -dx, dX: 1 }));

  // RAF render loop.
  // visualDT advances at VISUAL_RATE (days/second real time) so motion is always
  // perceptible — even at slow model speeds where physical rates are < 0.1°/s.
  // The visual clock freezes when the model is paused, matching user expectation.
  const VISUAL_RATE = 60; // visual days per real second

  let prevModelDT = null, lastBody = null;
  let visualDT    = null; // the time shown in the diagram
  let lastRealMs  = null;

  function frame() {
    requestAnimationFrame(frame);

    const bodyName = pickBody(model);
    if (!bodyName) { wrap.style.display = 'none'; return; }

    const modelDT = model.state.DateTime;
    const nowMs   = performance.now();

    // First frame or body changed — seed visual time to model time.
    if (visualDT === null || bodyName !== lastBody) {
      visualDT   = modelDT;
      lastRealMs = nowMs;
      prevModelDT = modelDT;
    }

    const paused = prevModelDT !== null && modelDT === prevModelDT;

    if (!paused) {
      // Advance visual time at the fixed visual rate.
      const realSec = Math.min((nowMs - lastRealMs) / 1000, 0.1); // cap at 100 ms
      visualDT += realSec * VISUAL_RATE;
    }
    prevModelDT = modelDT;
    lastRealMs  = nowMs;

    const date = dateTimeToDate(visualDT);
    const geom = ptolemyGeometry(bodyName, date);
    if (!geom) { wrap.style.display = 'none'; return; }

    wrap.style.display = '';

    const bs = BODY_STYLE[bodyName] || { col: '#c0b0e8' };
    titleEl.textContent = geom.bodyName + (paused ? '  ⏸' : '');
    titleEl.style.color = bs.col;

    if (canvas.width === 0 || bodyName !== lastBody) { syncCanvas(bodyName); }
    lastBody = bodyName;
    canvas.style.opacity = paused ? '0.6' : '1';

    const W = canvas.width;
    const diagH = canvasH(bodyName, W) - (bodyName === 'jupiter' ? 110 : 0);
    drawDiagram(ctx, geom, W, diagH, bodyName);
    if (bodyName === 'jupiter') drawMoons(ctx, date, W, diagH);
  }

  model.addEventListener('update', () => {
    if (wrap.clientWidth !== canvas.width) syncCanvas(lastBody);
  });

  syncCanvas('sun');
  frame();
}
