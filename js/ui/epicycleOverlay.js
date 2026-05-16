// Ptolemaic epicycle geometry overlay panel.
// Draws a live deferent+epicycle diagram for the currently tracked body
// (or the first tracked body supported by the Ptolemy pipeline).
//
// Geometry (apogee fixed at top, angles clockwise):
//   D  = deferent centre (canvas centre)
//   E  = Earth/observer = D shifted down by ecc × R  (anti-apogee)
//   Q  = equant         = D shifted up   by ecc × R  (toward apogee)
//   Θ  = epicycle centre on deferent rim, at true eccentric anomaly from D
//   ●  = planet on epicycle rim at tepianom from the outward direction

import { ptolemyGeometry, SUPPORTED_BODIES } from '../core/ephemerisPtolemy.js';
import { dateTimeToDate } from '../core/time.js';

const RAD = Math.PI / 180;
const PTOLEMY_NAMES = new Set(['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn']);

const AMBER       = '#f4a640';
const AMBER_DIM   = 'rgba(244,166,64,0.45)';
const AMBER_FAINT = 'rgba(244,166,64,0.18)';
const GREEN       = '#7ec87e';
const BLUE        = '#6ac0e8';
const BG          = 'rgba(10,14,22,0.88)';
const BORDER      = 'rgba(244,166,64,0.50)';

function pickBody(model) {
  const targets = Array.isArray(model.state.TrackerTargets) ? model.state.TrackerTargets : [];
  for (const t of targets) {
    const name = (typeof t === 'string' ? t : t.id || '').toLowerCase();
    if (PTOLEMY_NAMES.has(name)) return name;
  }
  return null;
}

function drawDiagram(ctx, geom, W, H) {
  const cx = W / 2;
  const cy = H / 2 + 4;

  // Scale so the diagram fits with room for labels.
  // Biggest body by epicycle is Mars (epi ≈ 0.658), so max radius ≈ 1 + epi ≈ 1.66
  const maxR = 1 + geom.epi + 0.08;
  const R = Math.min(cx, cy) / maxR * 0.88;

  const eccPx = geom.ecc * R;
  const epiPx = geom.epi * R;

  // Key angles (all clockwise from top, in radians)
  const meccanomRad = ((geom.meccanom + geom.pros) * RAD); // true eccentric anomaly
  const tepianomRad = geom.tepianom * RAD;

  // Canvas positions (y-down, apogee at top of diagram)
  const Dx = cx, Dy = cy;
  const Ex = cx,         Ey = cy + eccPx;   // Earth below D
  const Qx = cx,         Qy = cy - eccPx;   // Equant above D

  const Tx = Dx + R    * Math.sin(meccanomRad);
  const Ty = Dy - R    * Math.cos(meccanomRad);

  const Px = Tx + epiPx * Math.sin(meccanomRad + tepianomRad);
  const Py = Ty - epiPx * Math.cos(meccanomRad + tepianomRad);

  const ApogX = Dx, ApogY = Dy - R;
  const PeriX = Dx, PeriY = Dy + R;

  ctx.clearRect(0, 0, W, H);

  // Deferent circle
  ctx.beginPath();
  ctx.arc(Dx, Dy, R, 0, 2 * Math.PI);
  ctx.strokeStyle = AMBER_DIM;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Epicycle circle (only if epi > 0)
  if (epiPx > 1) {
    ctx.beginPath();
    ctx.arc(Tx, Ty, epiPx, 0, 2 * Math.PI);
    ctx.strokeStyle = AMBER_FAINT;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Dashed line E → D → Q (eccentre line)
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(PeriX, PeriY);
  ctx.lineTo(ApogX, ApogY);
  ctx.strokeStyle = AMBER_DIM;
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.setLineDash([]);

  // Line E → Θ
  ctx.beginPath();
  ctx.moveTo(Ex, Ey);
  ctx.lineTo(Tx, Ty);
  ctx.strokeStyle = AMBER_DIM;
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Line Θ → planet
  if (epiPx > 1) {
    ctx.beginPath();
    ctx.moveTo(Tx, Ty);
    ctx.lineTo(Px, Py);
    ctx.strokeStyle = AMBER_DIM;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  // Apogee label "A"
  ctx.fillStyle = AMBER;
  ctx.font = 'bold 10px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('A', ApogX, ApogY - 5);

  // Perigee label "Peri"
  ctx.font = '9px ui-monospace, Menlo, monospace';
  ctx.fillStyle = GREEN;
  ctx.fillText('Peri', PeriX, PeriY + 11);

  // D dot (small)
  ctx.beginPath();
  ctx.arc(Dx, Dy, 2.5, 0, 2 * Math.PI);
  ctx.fillStyle = AMBER_DIM;
  ctx.fill();
  ctx.fillStyle = AMBER_DIM;
  ctx.font = '9px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'left';
  ctx.fillText('D', Dx + 4, Dy + 4);

  // Q dot (equant)
  ctx.beginPath();
  ctx.arc(Qx, Qy, 2.5, 0, 2 * Math.PI);
  ctx.fillStyle = AMBER_DIM;
  ctx.fill();
  ctx.fillText('Q', Qx + 4, Qy + 4);

  // E dot (Earth — blue)
  ctx.beginPath();
  ctx.arc(Ex, Ey, 4, 0, 2 * Math.PI);
  ctx.fillStyle = BLUE;
  ctx.fill();
  ctx.fillStyle = BLUE;
  ctx.font = 'bold 9px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'left';
  ctx.fillText('E', Ex + 5, Ey + 4);

  // Θ dot (epicycle centre)
  if (epiPx > 1) {
    ctx.beginPath();
    ctx.arc(Tx, Ty, 2.5, 0, 2 * Math.PI);
    ctx.fillStyle = AMBER_DIM;
    ctx.fill();
    ctx.fillStyle = AMBER_DIM;
    ctx.font = '9px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('Θ', Tx + 4, Ty + 4);
  }

  // Planet dot (amber/orange)
  const planetX = epiPx > 1 ? Px : Tx;
  const planetY = epiPx > 1 ? Py : Ty;
  ctx.beginPath();
  ctx.arc(planetX, planetY, 5, 0, 2 * Math.PI);
  ctx.fillStyle = AMBER;
  ctx.fill();
  ctx.strokeStyle = 'rgba(244,166,64,0.6)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

export function buildEpicycleOverlay(viewEl, model) {
  const wrap = document.createElement('div');
  wrap.id = 'epicycle-overlay';
  wrap.style.cssText = `
    position: absolute;
    top: 52px;
    right: 12px;
    width: 196px;
    background: ${BG};
    border: 1px solid ${BORDER};
    border-radius: 8px;
    padding: 8px 10px 10px;
    font: 11px/1.4 ui-monospace, Menlo, monospace;
    color: ${AMBER};
    z-index: 20;
    pointer-events: none;
    display: none;
    zoom: var(--ui-zoom, 1);
  `;

  const titleEl = document.createElement('div');
  titleEl.style.cssText = `
    font-size: 12px;
    font-weight: bold;
    letter-spacing: 0.06em;
    margin-bottom: 6px;
    color: ${AMBER};
  `;
  wrap.appendChild(titleEl);

  const canvas = document.createElement('canvas');
  const CW = 176, CH = 170;
  canvas.width  = CW;
  canvas.height = CH;
  canvas.style.cssText = `display:block; width:${CW}px; height:${CH}px;`;
  wrap.appendChild(canvas);

  const formulaEl = document.createElement('div');
  formulaEl.style.cssText = `
    margin-top: 7px;
    font-size: 9.5px;
    color: ${AMBER};
    opacity: 0.85;
    line-height: 1.5;
  `;
  formulaEl.innerHTML =
    'λ = <i>L̄</i> + eq.centre(<i>D</i>,<i>Q</i>) + eq.anomaly(<i>Θ</i>)<br>' +
    '<span style="opacity:0.6">Uniform motion as seen from Q (equant)</span>';
  wrap.appendChild(formulaEl);

  viewEl.appendChild(wrap);

  const ctx = canvas.getContext('2d');

  function refresh() {
    const bodyName = pickBody(model);
    if (!bodyName) {
      wrap.style.display = 'none';
      return;
    }
    const date = dateTimeToDate(model.state.DateTime);
    const geom = ptolemyGeometry(bodyName, date);
    if (!geom) {
      wrap.style.display = 'none';
      return;
    }
    wrap.style.display = '';
    titleEl.textContent = geom.bodyName;
    drawDiagram(ctx, geom, CW, CH);
  }

  model.addEventListener('update', refresh);
  refresh();
}
