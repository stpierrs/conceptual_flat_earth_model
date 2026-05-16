// Ptolemaic epicycle geometry overlay panel — draggable, resizable.
//
// Horizontal apsidal axis: A (apogee, left) — Z (Earth) — D — Q — G (perigee, right)
// The planet rides the epicycle rim; Θ is the epicycle centre on the deferent rim.

import { ptolemyGeometry } from '../core/ephemerisPtolemy.js';
import { dateTimeToDate } from '../core/time.js';

const RAD = Math.PI / 180;
const PTOLEMY_NAMES = new Set(['sun','moon','mercury','venus','mars','jupiter','saturn']);

// Colour palette (matched to reference image)
const DEFERENT_COL = '#c8a020';       // gold deferent circle
const EPICYCLE_COL = '#c83018';       // red epicycle circle
const PLANET_COL   = '#e04828';       // planet fill
const EARTH_COL    = '#20a8b8';       // teal Earth (Z)
const APSIS_COL    = '#38b038';       // green apsidal circles (A, G)
const AMBER        = '#f0c040';
const AMBER_DIM    = 'rgba(240,192,64,0.45)';
const LABEL_COL    = '#e8d898';       // light warm label text
const BG_PANEL     = 'rgba(14,12,4,0.94)';

// Per-body planet colour
const BODY_COLORS = {
  sun: '#f5c842', moon: '#c0c0b8', mercury: '#a09070',
  venus: '#e8c870', mars: '#d04820', jupiter: '#c89050',
  saturn: '#b8a060',
};

function pickBody(model) {
  // Prefer the actively followed body (drives "Tracking: X" in the info bar).
  const follow = model.state.FollowTarget;
  if (follow) {
    const name = (typeof follow === 'string' ? follow : '').toLowerCase();
    if (PTOLEMY_NAMES.has(name)) return name;
  }
  // Fall back to the first Ptolemaic body in the tracker list.
  const targets = Array.isArray(model.state.TrackerTargets) ? model.state.TrackerTargets : [];
  for (const t of targets) {
    const name = (typeof t === 'string' ? t : (t && t.id) || '').toLowerCase();
    if (PTOLEMY_NAMES.has(name)) return name;
  }
  return null;
}

// ── Drawing ──────────────────────────────────────────────────────────────────

function labelledCircle(ctx, x, y, r, fillCol, letter, textCol) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 2 * Math.PI);
  ctx.fillStyle = fillCol;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = textCol || '#fff';
  ctx.font = `bold ${Math.round(r * 1.1)}px ui-monospace, Menlo, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, x, y);
}

function dot(ctx, x, y, r, col) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 2 * Math.PI);
  ctx.fillStyle = col;
  ctx.fill();
}

function drawDiagram(ctx, geom, W, H, bodyName) {
  ctx.clearRect(0, 0, W, H);

  const { ecc, epi, meccanom, tepianom, pros } = geom;
  const teccanom = meccanom + pros; // true eccentric anomaly from apogee

  // Centre diagram with D at (cx, cy).  Apogee = LEFT, Perigee = RIGHT.
  const cx = W * 0.5;
  const cy = H * 0.52;

  // Scale so even Mars (max extent = R + epi×R) fits with label headroom.
  const margin = 32;
  const R = Math.min(cx - margin, cy - margin) / (1 + epi + 0.08);

  const eccPx = ecc * R;
  const epiPx = epi * R;

  // Key points  (canvas y-down; apogee at LEFT → right is perigee)
  const Dx = cx, Dy = cy;
  const Zx = Dx - eccPx, Zy = Dy;     // Earth (Z) left of D
  const Qx = Dx + eccPx, Qy = Dy;     // Equant right of D
  const Ax = Dx - R,     Ay = Dy;     // Apogee circle centre
  const Gx = Dx + R,     Gy = Dy;     // Perigee circle centre

  // Epicycle centre Θ on deferent rim.
  // teccanom = 0 → at apogee (A, left).  Positive → counterclockwise → upward first.
  const tecRad = teccanom * RAD;
  const Tx = Dx - R * Math.cos(tecRad);  // left when tecRad=0
  const Ty = Dy - R * Math.sin(tecRad);

  // Planet on epicycle.  Epicycle apside points outward from D through Θ.
  // tepianom = 0 → far end of epicycle (away from Earth).
  const baseAngle = Math.atan2(Ty - Dy, Tx - Dx);       // direction D→Θ
  const tepRad   = tepianom * RAD;
  const Px = Tx + epiPx * Math.cos(baseAngle + tepRad);
  const Py = Ty + epiPx * Math.sin(baseAngle + tepRad);

  // ── Apsidal axis dashed line ─────────────────────────────────────────────
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(Ax, Ay);
  ctx.lineTo(Gx, Gy);
  ctx.strokeStyle = AMBER_DIM;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.setLineDash([]);

  // ── Deferent circle ──────────────────────────────────────────────────────
  ctx.beginPath();
  ctx.arc(Dx, Dy, R, 0, 2 * Math.PI);
  ctx.strokeStyle = DEFERENT_COL;
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // ── Epicycle circle ──────────────────────────────────────────────────────
  if (epiPx > 2) {
    ctx.beginPath();
    ctx.arc(Tx, Ty, epiPx, 0, 2 * Math.PI);
    ctx.strokeStyle = EPICYCLE_COL;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // ── Z → Θ line (equation of centre arm) ──────────────────────────────────
  ctx.beginPath();
  ctx.moveTo(Zx, Zy);
  ctx.lineTo(Tx, Ty);
  ctx.strokeStyle = AMBER_DIM;
  ctx.lineWidth = 0.9;
  ctx.stroke();

  // ── Q → Θ line with "uniform motion" annotation ──────────────────────────
  if (epiPx > 4) {
    ctx.beginPath();
    ctx.moveTo(Qx, Qy);
    ctx.lineTo(Tx, Ty);
    ctx.strokeStyle = 'rgba(200,220,255,0.35)';
    ctx.lineWidth = 0.9;
    ctx.stroke();

    // Label along the line
    const midX = (Qx + Tx) / 2;
    const midY = (Qy + Ty) / 2;
    const angle = Math.atan2(Ty - Qy, Tx - Qx);
    ctx.save();
    ctx.translate(midX, midY);
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(190,210,255,0.7)';
    ctx.font = '9px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('uniform motion', 0, -3);
    ctx.restore();
  }

  // ── Θ → Planet line ───────────────────────────────────────────────────────
  if (epiPx > 2) {
    ctx.beginPath();
    ctx.moveTo(Tx, Ty);
    ctx.lineTo(Px, Py);
    ctx.strokeStyle = AMBER_DIM;
    ctx.lineWidth = 0.9;
    ctx.stroke();
  }

  // ── Apsidal labelled circles (A and G) ───────────────────────────────────
  const aR = Math.max(10, R * 0.13);
  labelledCircle(ctx, Ax, Ay, aR, APSIS_COL, 'A', '#fff');
  labelledCircle(ctx, Gx, Gy, aR, APSIS_COL, 'G', '#fff');

  // ── Earth (Z) ─────────────────────────────────────────────────────────────
  const zR = Math.max(9, R * 0.11);
  labelledCircle(ctx, Zx, Zy, zR, EARTH_COL, 'Z', '#fff');

  // ── D dot ────────────────────────────────────────────────────────────────
  dot(ctx, Dx, Dy, 3, AMBER);
  ctx.fillStyle = AMBER_DIM;
  ctx.font = '10px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('D', Dx + 4, Dy + 2);

  // ── Q dot ────────────────────────────────────────────────────────────────
  dot(ctx, Qx, Qy, 3, AMBER_DIM);
  ctx.fillStyle = AMBER_DIM;
  ctx.font = '10px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('Q', Qx + 4, Qy + 2);

  // ── Θ dot ────────────────────────────────────────────────────────────────
  if (epiPx > 2) {
    dot(ctx, Tx, Ty, 2.5, AMBER_DIM);
    ctx.fillStyle = AMBER_DIM;
    ctx.font = '10px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('Θ', Tx + 4, Ty + 2);
  }

  // ── Apogee / Perigee labels ───────────────────────────────────────────────
  ctx.font = '9px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = APSIS_COL;
  ctx.fillText('Apogee', Ax, Ay + aR + 3);
  ctx.fillText('Perigee', Gx, Gy + aR + 3);

  // ── Planet circle + label ────────────────────────────────────────────────
  const planetR = Math.max(12, R * 0.15);
  const pCol = BODY_COLORS[bodyName] || PLANET_COL;
  ctx.beginPath();
  ctx.arc(Px, Py, planetR, 0, 2 * Math.PI);
  ctx.fillStyle = pCol;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Glow ring
  const grad = ctx.createRadialGradient(Px, Py, planetR * 0.5, Px, Py, planetR * 1.6);
  grad.addColorStop(0, pCol.replace(')', ',0.25)').replace('rgb(', 'rgba(') || 'rgba(200,80,40,0.25)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.beginPath();
  ctx.arc(Px, Py, planetR * 1.6, 0, 2 * Math.PI);
  ctx.fillStyle = grad;
  ctx.fill();

  // Planet name label
  const label = geom.bodyName;
  ctx.font = `bold 11px ui-monospace, Menlo, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = Py < Dy ? 'bottom' : 'top';
  ctx.fillStyle = '#fff';
  ctx.fillText(label, Px, Py + (Py < Dy ? -planetR - 2 : planetR + 2));

  // ── Stats overlay (bottom-left of diagram) ────────────────────────────────
  ctx.font = '9px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = AMBER_DIM;
  const epiPct  = (epi * 100).toFixed(1);
  const eccPct  = (ecc * 100).toFixed(1);
  ctx.fillText(`rα/c = ${epiPct}%  ·  e = ${eccPct}%`, 8, H - 4);
}

// ── Panel construction ───────────────────────────────────────────────────────

export function buildEpicycleOverlay(viewEl, model) {
  const wrap = document.createElement('div');
  wrap.id = 'epicycle-overlay';
  Object.assign(wrap.style, {
    position:      'absolute',
    top:           '52px',
    right:         '12px',
    width:         '360px',
    minWidth:      '200px',
    minHeight:     '200px',
    background:    BG_PANEL,
    border:        `2px solid ${DEFERENT_COL}`,
    boxShadow:     `0 0 0 4px rgba(14,12,4,0.8), 0 0 0 6px ${AMBER_DIM}, inset 0 0 0 1px rgba(200,160,32,0.25)`,
    borderRadius:  '6px',
    padding:       '0',
    fontFamily:    'ui-monospace, Menlo, monospace',
    color:         AMBER,
    zIndex:        '20',
    display:       'none',
    userSelect:    'none',
    overflow:      'hidden',
    zoom:          'var(--ui-zoom, 1)',
  });

  // ── Header (drag handle) ──────────────────────────────────────────────────
  const header = document.createElement('div');
  Object.assign(header.style, {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    padding:        '6px 10px 5px',
    borderBottom:   `1px solid ${AMBER_DIM}`,
    cursor:         'grab',
    background:     'rgba(28,22,4,0.6)',
  });

  const titleEl = document.createElement('span');
  Object.assign(titleEl.style, {
    fontSize:    '16px',
    fontWeight:  'bold',
    letterSpacing: '0.04em',
  });

  const subtitleEl = document.createElement('span');
  Object.assign(subtitleEl.style, {
    fontSize:   '10px',
    fontStyle:  'italic',
    opacity:    '0.7',
    marginLeft: '8px',
  });
  subtitleEl.textContent = 'Déférent + Epicycle + Equant';

  header.appendChild(titleEl);
  header.appendChild(subtitleEl);
  wrap.appendChild(header);

  // ── Canvas ────────────────────────────────────────────────────────────────
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block; width:100%;';
  wrap.appendChild(canvas);

  // ── Formula footer ────────────────────────────────────────────────────────
  const footer = document.createElement('div');
  Object.assign(footer.style, {
    padding:       '6px 10px 8px',
    borderTop:     `1px solid ${AMBER_DIM}`,
    fontSize:      '10px',
    lineHeight:    '1.55',
    background:    'rgba(14,12,4,0.5)',
  });
  footer.innerHTML =
    `<span style="color:${AMBER}">λ = <i>L̄</i> + eq.centre(<i>D</i>,<i>Q</i>) + eq.anomaly(<i>Θ</i>)</span><br>` +
    `<span style="opacity:0.55">Uniform motion as seen from Q (equant)</span>`;
  wrap.appendChild(footer);

  // ── Resize handle ─────────────────────────────────────────────────────────
  const resizeHandle = document.createElement('div');
  Object.assign(resizeHandle.style, {
    position:   'absolute',
    bottom:     '0',
    left:       '0',
    width:      '14px',
    height:     '14px',
    cursor:     'nesw-resize',
    zIndex:     '30',
  });
  // Draw corner triangle via CSS
  resizeHandle.innerHTML = `<svg width="14" height="14" style="display:block;opacity:0.45">
    <polyline points="0,14 14,14 14,0" fill="none" stroke="${AMBER}" stroke-width="1.5"/>
  </svg>`;
  // right-side resize handle
  const resizeHandleR = document.createElement('div');
  Object.assign(resizeHandleR.style, {
    position:   'absolute',
    bottom:     '0',
    right:      '0',
    width:      '14px',
    height:     '14px',
    cursor:     'nwse-resize',
    zIndex:     '30',
  });
  resizeHandleR.innerHTML = `<svg width="14" height="14" style="display:block;opacity:0.45">
    <polyline points="14,14 0,14 0,0" fill="none" stroke="${AMBER}" stroke-width="1.5"/>
  </svg>`;
  wrap.appendChild(resizeHandle);
  wrap.appendChild(resizeHandleR);

  viewEl.appendChild(wrap);

  const ctx = canvas.getContext('2d');
  let lastBodyName = null;

  function syncCanvas() {
    const W = wrap.clientWidth;
    const H = Math.max(160, W * 0.82);
    canvas.width  = W;
    canvas.height = H;
    canvas.style.height = H + 'px';
  }

  // ── Drag ─────────────────────────────────────────────────────────────────
  let dragging = false, dragOx = 0, dragOy = 0;
  header.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    dragging = true;
    // Convert wrap position to left/top if currently using right:
    const r  = wrap.getBoundingClientRect();
    const vr = viewEl.getBoundingClientRect();
    wrap.style.right  = 'auto';
    wrap.style.left   = (r.left - vr.left) + 'px';
    wrap.style.top    = (r.top  - vr.top)  + 'px';
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
    if (!dragging) return;
    dragging = false;
    header.style.cursor = 'grab';
  });

  // ── Resize (left-bottom corner) ───────────────────────────────────────────
  function makeResizer(handle, getDeltas) {
    let resizing = false, startX = 0, startY = 0, startW = 0, startH = 0, startL = 0;
    handle.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      resizing = true;
      startX = e.clientX; startY = e.clientY;
      startW = wrap.offsetWidth;
      startH = wrap.offsetHeight;
      const r  = wrap.getBoundingClientRect();
      const vr = viewEl.getBoundingClientRect();
      startL = r.left - vr.left;
      wrap.style.right = 'auto';
      wrap.style.left  = startL + 'px';
      e.preventDefault(); e.stopPropagation();
    });
    window.addEventListener('mousemove', (e) => {
      if (!resizing) return;
      const { dW, dX } = getDeltas(e.clientX - startX);
      const newW = Math.max(200, startW + dW);
      wrap.style.width = newW + 'px';
      if (dX !== 0) wrap.style.left = (startL + startW - newW) + 'px';
      syncCanvas(); refresh();
    });
    window.addEventListener('mouseup', () => { resizing = false; });
  }

  // Right handle: drag right → wider, no left shift
  makeResizer(resizeHandleR, (dx) => ({ dW:  dx, dX: 0 }));
  // Left handle: drag left → wider, shift left
  makeResizer(resizeHandle,  (dx) => ({ dW: -dx, dX: 1 }));

  // ── Render ────────────────────────────────────────────────────────────────
  function refresh() {
    const bodyName = pickBody(model);
    if (!bodyName) { wrap.style.display = 'none'; return; }

    const date = dateTimeToDate(model.state.DateTime);
    const geom = ptolemyGeometry(bodyName, date);
    if (!geom) { wrap.style.display = 'none'; return; }

    wrap.style.display = '';

    // Title colour matches body
    const bCol = BODY_COLORS[bodyName] || AMBER;
    if (lastBodyName !== bodyName) {
      titleEl.textContent = geom.bodyName;
      titleEl.style.color = bCol;
      lastBodyName = bodyName;
    }

    if (canvas.width === 0) syncCanvas();
    drawDiagram(ctx, geom, canvas.width, canvas.height, bodyName);
  }

  model.addEventListener('update', refresh);
  syncCanvas();
  refresh();
}
