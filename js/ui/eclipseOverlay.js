// eclipseOverlay.js — geocentric eclipse predictor overlay.
//
// Two visual modes toggled by the header button:
//   ASTRO — Prague Astronomical Clock astrolabium (gold/navy)
//   DIGI  — terminal oscilloscope / mission-control readout (green/black)
//
// Both modes share the same underlying data:
//   sunLon(t)      — Sun ecliptic longitude (°)
//   moonEcliptic(t)— Moon ecliptic longitude + latitude (°)
//   MOON.N0/nnode  — ascending node longitude
//   findEclipses() — eclipse predictions from syzygy+node alignment
//
// All quantities are angular (degrees). No distances, no mass, no gravity.

import { findEclipses, sunLon, moonEcliptic } from '../core/epicycle_ephemeris/eclipsePredictor.js';
import { MOON }                                from '../core/epicycle_ephemeris/epiParams.js';
import { j2000Day, degmod }                    from '../core/epicycle_ephemeris/epiCore.js';
import { dateTimeToDate }                      from '../core/time.js';

const TAU = 2 * Math.PI;
const RAD = Math.PI / 180;
const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

// ── Shared helpers ────────────────────────────────────────────────────────────

function nodeAscending(t) { return degmod(MOON.N0 - t * MOON.nnode); }

function glowFn(ctx, color, blur, fn) {
  ctx.save();
  ctx.shadowColor = color; ctx.shadowBlur = blur;
  fn();
  ctx.shadowBlur = 0;
  ctx.restore();
}

// ── Eclipse cache (recomputed when date shifts > 30 days) ─────────────────────
let _eclCache   = null;
let _eclCacheMs = null;
function getEclipses(date) {
  const ms = date.getTime();
  if (!_eclCache || Math.abs(ms - _eclCacheMs) > 30 * 86400000) {
    _eclCacheMs = ms;
    _eclCache = findEclipses(date, new Date(ms + 730 * 86400000)).slice(0, 12);
  }
  return _eclCache;
}

// ── Waveform cache (Moon latitude over a ±40 day window, recomputed every ~6 h)
let _waveCache  = null;
let _waveCacheT = null;
const WAVE_SPAN  = 40;   // days each side of now
const WAVE_N     = 100;  // sample count
function getWave(t) {
  if (!_waveCache || Math.abs(t - _waveCacheT) > 0.25) {
    _waveCacheT = t;
    _waveCache  = [];
    for (let i = 0; i <= WAVE_N; i++) {
      const ti = t - WAVE_SPAN + i * (2 * WAVE_SPAN / WAVE_N);
      const { lat, lon } = moonEcliptic(ti);
      const d = degmod(lon - sunLon(ti));
      _waveCache.push({ dt: ti - t, lat, d });
    }
  }
  return _waveCache;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ASTRO MODE — Prague Astronomical Clock astrolabium
// ═══════════════════════════════════════════════════════════════════════════════

const A_GOLD      = '#c8a84b';
const A_GOLD_LT   = '#e8d09a';
const A_GOLD_DIM  = 'rgba(200,168,75,0.28)';
const A_GOLD_GLOW = 'rgba(200,168,75,0.50)';
const A_NAVY      = '#060914';
const A_SUN_COL   = '#f5d060';
const A_SUN_GLOW  = 'rgba(245,208,96,0.85)';
const A_MOON_COL  = '#c8c8e0';
const A_MOON_GLOW = 'rgba(200,200,224,0.65)';
const A_NODE_COL  = '#e05858';
const A_NODE_GLOW = 'rgba(224,88,88,0.60)';
const A_TEXT      = '#dfc87a';
const A_TEXT_DIM  = 'rgba(220,190,120,0.38)';

const ZODIAC = [
  { glyph: '♈' }, { glyph: '♉' }, { glyph: '♊' }, { glyph: '♋' },
  { glyph: '♌' }, { glyph: '♍' }, { glyph: '♎' }, { glyph: '♏' },
  { glyph: '♐' }, { glyph: '♑' }, { glyph: '♒' }, { glyph: '♓' },
];

// λ=0 (Aries) → right (3 o'clock); longitude increases counter-clockwise on-screen.
const lonToAngle = λ => -λ * RAD;

function drawArm(ctx, cx, cy, ang, rTip, rHub, lineCol, dotCol, dotGlow, dotR) {
  glowFn(ctx, lineCol + '80', 10, () => {
    ctx.beginPath();
    ctx.moveTo(cx + rHub * Math.cos(ang), cy + rHub * Math.sin(ang));
    ctx.lineTo(cx + rTip * Math.cos(ang), cy + rTip * Math.sin(ang));
    ctx.strokeStyle = lineCol; ctx.lineWidth = 2; ctx.stroke();
  });
  const tx = cx + rTip * Math.cos(ang), ty = cy + rTip * Math.sin(ang);
  glowFn(ctx, dotGlow, 16, () => {
    ctx.beginPath(); ctx.arc(tx, ty, dotR, 0, TAU);
    ctx.fillStyle = dotCol; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1; ctx.stroke();
  });
}

function drawAstro(ctx, date, W, CLOCK_H) {
  const t  = j2000Day(date);
  const cx = W / 2, cy = CLOCK_H / 2;
  const R  = Math.min(cx, cy) * 0.86;
  const Ro  = R,         Rzi = R * 0.830, Rdi = R * 0.750, Rec = R * 0.120;
  const gapMid = (Rdi + Rzi) / 2, gapW = (Rzi - Rdi) * 0.78;

  // Sky background
  const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Ro);
  bg.addColorStop(0, '#1a2460'); bg.addColorStop(0.7, '#0c1230'); bg.addColorStop(1, '#060914');
  ctx.beginPath(); ctx.arc(cx, cy, Ro, 0, TAU); ctx.fillStyle = bg; ctx.fill();

  // Zodiac ring sectors
  for (let i = 0; i < 12; i++) {
    const a0 = lonToAngle(i * 30), a1 = lonToAngle((i + 1) * 30);
    ctx.beginPath();
    ctx.arc(cx, cy, Ro,  a0, a1, true);
    ctx.arc(cx, cy, Rzi, a1, a0, false);
    ctx.closePath();
    ctx.fillStyle = i % 2 === 0 ? '#0c1438' : '#080e2c'; ctx.fill();

    glowFn(ctx, A_GOLD_GLOW, 3, () => {
      ctx.beginPath();
      ctx.moveTo(cx + Rzi * Math.cos(a0), cy + Rzi * Math.sin(a0));
      ctx.lineTo(cx + Ro  * Math.cos(a0), cy + Ro  * Math.sin(a0));
      ctx.strokeStyle = A_GOLD; ctx.lineWidth = 1.1; ctx.stroke();
    });

    const midA = lonToAngle(i * 30 + 15), gR = (Rzi + Ro) / 2;
    ctx.fillStyle = A_GOLD_LT;
    ctx.font = `bold ${Math.round(R * 0.092)}px serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(ZODIAC[i].glyph, cx + gR * Math.cos(midA), cy + gR * Math.sin(midA));
  }

  glowFn(ctx, A_GOLD_GLOW, 6, () => {
    ctx.beginPath(); ctx.arc(cx, cy, Ro,  0, TAU);
    ctx.strokeStyle = A_GOLD; ctx.lineWidth = 1.8; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, Rzi, 0, TAU);
    ctx.strokeStyle = A_GOLD; ctx.lineWidth = 1.2; ctx.stroke();
  });

  // Degree ticks
  for (let deg = 0; deg < 360; deg++) {
    if (deg % 30 === 0) continue;
    const a = lonToAngle(deg), isMaj = deg % 10 === 0, len = isMaj ? R * 0.038 : R * 0.018;
    ctx.beginPath();
    ctx.moveTo(cx + (Rzi - len) * Math.cos(a), cy + (Rzi - len) * Math.sin(a));
    ctx.lineTo(cx + Rzi * Math.cos(a), cy + Rzi * Math.sin(a));
    ctx.strokeStyle = isMaj ? 'rgba(200,168,75,0.55)' : 'rgba(200,168,75,0.22)';
    ctx.lineWidth = isMaj ? 1 : 0.5; ctx.stroke();
  }

  // Eclipse zone arcs near nodes (in gap between disc and zodiac ring)
  const Nm = nodeAscending(t);
  for (const nLon of [Nm, degmod(Nm + 180)]) {
    const arcStart = lonToAngle(nLon + 15), arcEnd = lonToAngle(nLon - 15);
    glowFn(ctx, A_NODE_GLOW, 10, () => {
      ctx.beginPath(); ctx.arc(cx, cy, gapMid, arcStart, arcEnd, false);
      ctx.strokeStyle = 'rgba(224,88,88,0.45)'; ctx.lineWidth = gapW; ctx.stroke();
    });
  }

  glowFn(ctx, A_GOLD_DIM, 2, () => {
    ctx.beginPath(); ctx.arc(cx, cy, Rdi, 0, TAU);
    ctx.strokeStyle = A_GOLD_DIM; ctx.lineWidth = 0.8; ctx.stroke();
  });

  for (const fr of [0.68, 0.60, 0.52]) {
    ctx.beginPath(); ctx.arc(cx, cy, R * fr, 0, TAU);
    ctx.strokeStyle = A_GOLD_DIM; ctx.lineWidth = 0.5; ctx.stroke();
  }

  // Node markers ☊ ☋
  for (const [nLon, sym] of [[Nm, '☊'], [degmod(Nm + 180), '☋']]) {
    const na = lonToAngle(nLon), nr = Rdi * 0.875, nr2 = R * 0.034;
    const nx = cx + nr * Math.cos(na), ny = cy + nr * Math.sin(na);
    glowFn(ctx, A_NODE_GLOW, 12, () => {
      ctx.beginPath(); ctx.arc(nx, ny, nr2, 0, TAU);
      ctx.fillStyle = '#1a0408'; ctx.fill();
      ctx.strokeStyle = A_NODE_COL; ctx.lineWidth = 1.4; ctx.stroke();
    });
    ctx.fillStyle = A_NODE_COL; ctx.font = `${Math.round(R * 0.052)}px serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(sym, nx, ny);
  }

  // Sun arm
  const sLon = sunLon(t), sAng = lonToAngle(sLon);
  drawArm(ctx, cx, cy, sAng, Rdi * 0.82, Rec * 1.6, A_SUN_COL, A_SUN_COL, A_SUN_GLOW, R * 0.058);
  glowFn(ctx, A_SUN_GLOW, 8, () => {
    ctx.fillStyle = A_SUN_COL; ctx.font = `${Math.round(R * 0.055)}px serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('☀', cx + (Rdi * 0.82 + R * 0.075) * Math.cos(sAng),
                      cy + (Rdi * 0.82 + R * 0.075) * Math.sin(sAng));
  });

  // Moon arm
  const { lon: mLon, lat: mLat } = moonEcliptic(t);
  const mAng = lonToAngle(mLon);
  drawArm(ctx, cx, cy, mAng, Rdi * 0.63, Rec * 1.6, A_MOON_COL, A_MOON_COL, A_MOON_GLOW, R * 0.044);
  glowFn(ctx, A_MOON_GLOW, 6, () => {
    ctx.fillStyle = A_MOON_COL; ctx.font = `${Math.round(R * 0.046)}px serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('☽', cx + (Rdi * 0.63 + R * 0.062) * Math.cos(mAng),
                      cy + (Rdi * 0.63 + R * 0.062) * Math.sin(mAng));
  });

  // Central Earth emblem ⊕
  glowFn(ctx, A_GOLD_GLOW, 14, () => {
    const eg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Rec);
    eg.addColorStop(0, '#243878'); eg.addColorStop(1, '#101a44');
    ctx.beginPath(); ctx.arc(cx, cy, Rec, 0, TAU);
    ctx.fillStyle = eg; ctx.fill();
    ctx.strokeStyle = A_GOLD; ctx.lineWidth = 1.6; ctx.stroke();
  });
  ctx.strokeStyle = A_GOLD_LT; ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(cx - Rec, cy); ctx.lineTo(cx + Rec, cy);
  ctx.moveTo(cx, cy - Rec); ctx.lineTo(cx, cy + Rec);
  ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, Rec * 0.50, 0, TAU);
  ctx.strokeStyle = 'rgba(200,168,75,0.45)'; ctx.lineWidth = 0.7; ctx.stroke();

  // Cardinal labels
  for (const [lon, lbl] of [[0,'VER'],[90,'AES'],[180,'AUT'],[270,'HIE']]) {
    const ca = lonToAngle(lon), cr = Ro + R * 0.055;
    ctx.fillStyle = A_TEXT_DIM; ctx.font = `bold ${Math.round(R * 0.048)}px ui-monospace,monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(lbl, cx + cr * Math.cos(ca), cy + cr * Math.sin(ca));
  }

  // Data readout
  const elon = degmod(mLon - sLon);
  const readY = cy + R * 0.36;
  ctx.fillStyle = A_TEXT; ctx.font = `${Math.round(R * 0.068)}px ui-monospace,monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText(`☀ ${sLon.toFixed(1)}°  ☽ ${mLon.toFixed(1)}°`, cx, readY);
  ctx.fillStyle = A_TEXT_DIM; ctx.font = `${Math.round(R * 0.054)}px ui-monospace,monospace`;
  ctx.fillText(`β ${mLat >= 0 ? '+' : ''}${mLat.toFixed(2)}°  D ${elon.toFixed(1)}°`, cx, readY + R * 0.088);
}

// ═══════════════════════════════════════════════════════════════════════════════
// DIGI MODE — terminal / oscilloscope aesthetic
// ═══════════════════════════════════════════════════════════════════════════════

const D_BG      = '#000508';
const D_GREEN   = '#00e8a0';
const D_GREEN2  = '#00ff66';
const D_DIM     = 'rgba(0,220,150,0.30)';
const D_DIMMER  = 'rgba(0,180,120,0.18)';
const D_BLUE    = '#18a8ff';
const D_AMBER   = '#ffb030';
const D_RED     = '#ff3838';
const D_SOLAR   = '#ff8030';
const D_LUNAR   = '#b060c0';
const D_GRID    = 'rgba(0,160,100,0.14)';
const D_BORDER  = 'rgba(0,220,150,0.45)';

function digiLabel(ctx, x, y, label, value, valCol, fsz) {
  ctx.fillStyle = D_DIM; ctx.font = `${fsz}px ui-monospace,monospace`;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y);
  ctx.fillStyle = valCol; ctx.font = `bold ${fsz}px ui-monospace,monospace`;
  ctx.textAlign = 'right';
  ctx.fillText(value, x + 260, y);  // right-align within ~260px
}

function drawDigi(ctx, date, eclipses, W, H) {
  const t  = j2000Day(date);
  const PAD = 14;
  const fsz = Math.round(Math.min(W * 0.040, 14));
  let y = PAD;

  // ── Section: angular positions ────────────────────────────────────────────
  const sLon           = sunLon(t);
  const { lon: mLon, lat: mLat } = moonEcliptic(t);
  const Nm             = nodeAscending(t);
  const elon           = degmod(mLon - sLon);

  const sectionW = W - PAD * 2;

  // Title bar
  glowFn(ctx, D_GREEN + '60', 4, () => {
    ctx.fillStyle = 'rgba(0,40,25,0.8)';
    ctx.fillRect(PAD, y, sectionW, fsz + 8);
    ctx.fillStyle = D_GREEN;
    ctx.font = `bold ${fsz}px ui-monospace,monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('ANGULAR POSITIONS', PAD + sectionW / 2, y + (fsz + 8) / 2);
  });
  y += fsz + 12;

  const rows = [
    ['  ☀  SUN  λ', `${sLon.toFixed(2)}°`, D_AMBER],
    ['  ☽  MOON λ', `${mLon.toFixed(2)}°`, D_BLUE],
    ['     MOON β', `${mLat >= 0 ? '+' : ''}${mLat.toFixed(3)}°`, Math.abs(mLat) < 1.57 ? D_RED : D_BLUE],
    ['  ☊  NODE Ω', `${Nm.toFixed(2)}°`, D_GREEN],
    ['  ◯  ELON D', `${elon.toFixed(2)}°`, D_GREEN2],
  ];

  for (const [lbl, val, col] of rows) {
    ctx.fillStyle = D_DIM; ctx.font = `${fsz}px ui-monospace,monospace`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(lbl, PAD, y + fsz / 2);
    glowFn(ctx, col + '80', 6, () => {
      ctx.fillStyle = col; ctx.font = `bold ${Math.round(fsz * 1.05)}px ui-monospace,monospace`;
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(val, PAD + sectionW, y + fsz / 2);
    });
    y += fsz + 5;
  }
  y += 6;

  // Elongation arc bar (0° → 360°)
  const barH = Math.round(fsz * 0.65);
  const barW = sectionW;
  ctx.fillStyle = D_DIMMER; ctx.fillRect(PAD, y, barW, barH);
  const elonFrac = elon / 360;
  const barFill = ctx.createLinearGradient(PAD, 0, PAD + barW, 0);
  barFill.addColorStop(0,    D_GREEN + 'aa');
  barFill.addColorStop(0.49, D_AMBER + 'cc');
  barFill.addColorStop(0.51, D_BLUE  + 'cc');
  barFill.addColorStop(1,    D_GREEN + 'aa');
  ctx.fillStyle = barFill;
  ctx.fillRect(PAD, y, barW * elonFrac, barH);
  ctx.strokeStyle = D_BORDER; ctx.lineWidth = 1;
  ctx.strokeRect(PAD, y, barW, barH);
  // NM/FM tick labels
  ctx.fillStyle = D_DIM; ctx.font = `${Math.round(fsz * 0.75)}px ui-monospace,monospace`;
  ctx.textAlign = 'left';  ctx.textBaseline = 'bottom'; ctx.fillText('NM', PAD + 2,          y - 1);
  ctx.textAlign = 'center'; ctx.fillText('FM', PAD + barW * 0.5, y - 1);
  ctx.textAlign = 'right';  ctx.fillText('NM', PAD + barW - 2,   y - 1);
  y += barH + 10;

  // ── Section: Moon latitude waveform ──────────────────────────────────────
  const WAVE_H = Math.round(Math.min(W * 0.28, 90));
  const waveY0 = y;
  const waveY1 = y + WAVE_H;
  const waveX0 = PAD, waveX1 = PAD + sectionW;

  // Frame
  ctx.fillStyle = 'rgba(0,20,12,0.85)';
  ctx.fillRect(waveX0, waveY0, sectionW, WAVE_H);
  ctx.strokeStyle = D_BORDER; ctx.lineWidth = 1;
  ctx.strokeRect(waveX0, waveY0, sectionW, WAVE_H);

  // Title
  ctx.fillStyle = D_DIM; ctx.font = `${Math.round(fsz * 0.82)}px ui-monospace,monospace`;
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText(`MOON β  ±${WAVE_SPAN}d`, waveX0 + 4, waveY0 + 3);

  const LAT_SCALE = 5.15;  // Moon max latitude ≈ 5.15°
  const LAT_MID   = waveY0 + WAVE_H / 2;

  function latToY(lat) { return LAT_MID - (lat / LAT_SCALE) * (WAVE_H / 2 - 6); }
  function tToX(dt)    { return waveX0 + ((dt + WAVE_SPAN) / (2 * WAVE_SPAN)) * sectionW; }

  // Grid lines at ±1.57° (penumbral) and ±0.45° (total)
  for (const [lim, col, lbl] of [
    [1.57, 'rgba(224,88,88,0.40)', ''],
    [0.45, 'rgba(255,180,40,0.35)', ''],
    [0,    'rgba(0,180,120,0.22)',  ''],
  ]) {
    for (const sign of [1, -1]) {
      const gy = latToY(sign * lim);
      ctx.setLineDash([3, 4]); ctx.strokeStyle = col; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(waveX0, gy); ctx.lineTo(waveX1, gy); ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  // Eclipse zone shading (|β| < 1.57°)
  const shadY0 = latToY(1.57), shadY1 = latToY(-1.57);
  ctx.fillStyle = 'rgba(224,40,40,0.06)';
  ctx.fillRect(waveX0, shadY0, sectionW, shadY1 - shadY0);

  // Now-line
  const nowX = tToX(0);
  ctx.strokeStyle = 'rgba(0,255,150,0.55)'; ctx.lineWidth = 1.2;
  ctx.setLineDash([2, 3]); ctx.beginPath();
  ctx.moveTo(nowX, waveY0); ctx.lineTo(nowX, waveY1); ctx.stroke();
  ctx.setLineDash([]);

  // Waveform
  const wave = getWave(t);
  ctx.beginPath();
  let started = false;
  for (const pt of wave) {
    const wx = tToX(pt.dt), wy = latToY(pt.lat);
    if (!started) { ctx.moveTo(wx, wy); started = true; }
    else          { ctx.lineTo(wx, wy); }
  }
  glowFn(ctx, D_BLUE + '90', 6, () => {
    ctx.strokeStyle = D_BLUE; ctx.lineWidth = 1.5; ctx.stroke();
  });

  // Syzygy markers (NM ▼, FM ▲) where D ≈ 0 or 180 — detect zero-crossings
  let prevD = wave[0]?.d ?? 0;
  for (let i = 1; i < wave.length; i++) {
    const { dt, lat, d } = wave[i];
    const isNM = prevD > 270 && d < 90;    // elongation wraps through 0
    const isFM = prevD < 180 && d >= 180 && prevD > 90;
    if (isNM || isFM) {
      const mx = tToX(dt), my = latToY(lat);
      const col = Math.abs(lat) < 1.57 ? D_RED : D_DIM;
      ctx.fillStyle = col;
      ctx.beginPath();
      if (isNM) { ctx.moveTo(mx, my - 6); ctx.lineTo(mx - 4, my - 11); ctx.lineTo(mx + 4, my - 11); }
      else      { ctx.moveTo(mx, my + 6); ctx.lineTo(mx - 4, my + 11); ctx.lineTo(mx + 4, my + 11); }
      ctx.closePath(); ctx.fill();
    }
    prevD = d;
  }

  y += WAVE_H + 10;

  // ── Section: next eclipse countdown ──────────────────────────────────────
  const upcoming = eclipses.filter(e => e.date >= date);
  if (upcoming.length > 0) {
    const next   = upcoming[0];
    const msLeft = next.date - date;
    const dLeft  = Math.floor(msLeft / 86400000);
    const hLeft  = Math.floor((msLeft % 86400000) / 3600000);
    const mLeft  = Math.floor((msLeft % 3600000) / 60000);
    const isSolar  = next.type === 'solar';
    const typeCol  = isSolar ? D_SOLAR : D_LUNAR;
    const typeIcon = isSolar ? '☀' : '☽';

    glowFn(ctx, D_RED + '50', 5, () => {
      ctx.fillStyle = 'rgba(0,40,25,0.8)';
      ctx.fillRect(PAD, y, sectionW, fsz + 8);
      ctx.fillStyle = D_RED;
      ctx.font = `bold ${fsz}px ui-monospace,monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('NEXT ECLIPSE', PAD + sectionW / 2, y + (fsz + 8) / 2);
    });
    y += fsz + 12;

    // Countdown digits
    const cntStr = `${dLeft}d ${String(hLeft).padStart(2,'0')}h ${String(mLeft).padStart(2,'0')}m`;
    glowFn(ctx, typeCol + 'aa', 12, () => {
      ctx.fillStyle = typeCol;
      ctx.font = `bold ${Math.round(fsz * 1.45)}px ui-monospace,monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(cntStr, W / 2, y);
    });
    y += Math.round(fsz * 1.45) + 6;

    // Eclipse info card
    const d2 = next.date;
    const dateStr = `${d2.getUTCFullYear()} ${MONTHS[d2.getUTCMonth()]} ${String(d2.getUTCDate()).padStart(2,'0')}`;
    const magBars = Math.round(next.magnitude * 8);
    const magStr  = '█'.repeat(magBars) + '░'.repeat(8 - magBars);
    const cardH   = fsz * 2 + 14;

    ctx.fillStyle = 'rgba(0,18,10,0.9)';
    ctx.fillRect(PAD, y, sectionW, cardH);
    ctx.strokeStyle = typeCol + '80'; ctx.lineWidth = 1;
    ctx.strokeRect(PAD, y, sectionW, cardH);

    const cy2 = y + cardH / 2;
    ctx.fillStyle = typeCol; ctx.font = `bold ${fsz}px ui-monospace,monospace`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(`${typeIcon} ${next.type.toUpperCase()} · ${next.subtype.toUpperCase()}`, PAD + 8, cy2 - fsz * 0.55);

    ctx.fillStyle = D_DIM;
    ctx.font = `${Math.round(fsz * 0.88)}px ui-monospace,monospace`;
    ctx.fillText(`${dateStr}  β=${next.beta.toFixed(2)}°  mag=${next.magnitude.toFixed(2)}`, PAD + 8, cy2 + fsz * 0.55);

    glowFn(ctx, typeCol + '60', 4, () => {
      ctx.fillStyle = typeCol; ctx.font = `${Math.round(fsz * 0.95)}px ui-monospace,monospace`;
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(magStr, PAD + sectionW - 8, cy2);
    });
    y += cardH + 10;
  }

  return y;   // return how much vertical space was used so caller can size correctly
}

// ═══════════════════════════════════════════════════════════════════════════════
// Shared eclipse list (rendered below both modes)
// ═══════════════════════════════════════════════════════════════════════════════

function drawList(ctx, eclipses, x0, y0, W, H, now, digi) {
  const fgDiv  = digi ? 'rgba(0,220,150,0.22)' : 'rgba(200,168,75,0.22)';
  const fgHdr  = digi ? '#00e8a0'              : '#e8d09a';
  const fgText = digi ? 'rgba(0,220,150,0.75)' : '#dfc87a';
  const fgDim  = digi ? 'rgba(0,180,120,0.32)' : 'rgba(220,190,120,0.35)';
  const solarC = digi ? '#ff8030' : '#ff8830';
  const lunarC = digi ? '#b060c0' : '#b06090';

  ctx.strokeStyle = fgDiv; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x0 + 12, y0); ctx.lineTo(x0 + W - 12, y0); ctx.stroke();

  const HDR_H = 22;
  glowFn(ctx, fgHdr + '60', 4, () => {
    ctx.fillStyle = fgHdr;
    ctx.font = `bold ${Math.round(W * 0.038)}px ui-monospace,monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('ECLIPSES · FUTURAE', x0 + W / 2, y0 + HDR_H / 2);
  });

  const listY   = y0 + HDR_H;
  const upcoming = eclipses.filter(e => e.date >= now);
  const ROW_H   = 20;
  const maxRows = Math.floor((H - HDR_H) / ROW_H);

  if (upcoming.length === 0) {
    ctx.fillStyle = fgDim; ctx.font = `${Math.round(W * 0.035)}px ui-monospace,monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('No eclipses in search window', x0 + W / 2, listY + (H - HDR_H) / 2);
    return;
  }

  for (let i = 0; i < Math.min(upcoming.length, maxRows); i++) {
    const e = upcoming[i], ry = listY + i * ROW_H;
    if (i % 2 === 0) {
      ctx.fillStyle = digi ? 'rgba(0,20,12,0.55)' : 'rgba(18,22,56,0.55)';
      ctx.fillRect(x0, ry, W, ROW_H);
    }
    const isSolar = e.type === 'solar';
    const col = isSolar ? solarC : lunarC;
    const d   = e.date;
    const ds  = `${d.getUTCFullYear()} ${MONTHS[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2,'0')}`;
    const mag = '█'.repeat(Math.round(e.magnitude * 5)) + '░'.repeat(5 - Math.round(e.magnitude * 5));
    const fsz = Math.round(Math.min(W * 0.036, 12));
    const rcy = ry + ROW_H / 2;
    ctx.font = `${fsz}px ui-monospace,monospace`; ctx.textBaseline = 'middle';
    ctx.fillStyle = col;  ctx.textAlign = 'left';  ctx.fillText(isSolar ? '☀' : '☽', x0 + 8, rcy);
    ctx.fillStyle = fgText; ctx.fillText(ds, x0 + 8 + fsz + 4, rcy);
    ctx.fillStyle = col;  ctx.textAlign = 'right';
    ctx.fillText(e.subtype.toUpperCase().padEnd(9), x0 + W - 8 - fsz * 5.5, rcy);
    ctx.fillText(mag, x0 + W - 8, rcy);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Panel shell
// ═══════════════════════════════════════════════════════════════════════════════

export function buildEclipseOverlay(viewEl, model) {
  let mode = 'astro';   // 'astro' | 'digi'

  // ── Wrapper ────────────────────────────────────────────────────────────────
  const wrap = document.createElement('div');
  wrap.id = 'eclipse-overlay';
  Object.assign(wrap.style, {
    position:     'absolute',
    top:          '52px',
    left:         '12px',         // always on-screen; user can drag it
    width:        '310px',
    minWidth:     '200px',
    background:   'rgba(6,8,20,0.97)',
    border:       '2px solid rgba(200,168,75,0.65)',
    boxShadow:    '0 0 0 1px rgba(100,70,10,0.28), 0 0 22px 5px rgba(140,100,10,0.20)',
    borderRadius: '8px',
    padding:      '0',
    fontFamily:   'ui-monospace, Menlo, monospace',
    color:        '#dfc87a',
    zIndex:       '19',
    userSelect:   'none',
    overflow:     'hidden',
    zoom:         'var(--ui-zoom, 1)',
  });

  // ── Header ─────────────────────────────────────────────────────────────────
  const header = document.createElement('div');
  Object.assign(header.style, {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '5px 8px 4px',
    borderBottom: '1px solid rgba(200,168,75,0.18)',
    cursor: 'grab', background: 'rgba(8,12,32,0.96)',
  });

  const titleEl = document.createElement('span');
  Object.assign(titleEl.style, {
    fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.10em',
    color: '#e8d09a', textShadow: '0 0 8px #c8a84b', flexShrink: '0',
  });
  titleEl.textContent = '◎ ECLIPSE PREDICTOR';

  const modeBtn = document.createElement('button');
  Object.assign(modeBtn.style, {
    marginLeft: '8px', padding: '2px 7px',
    fontSize: '9px', fontWeight: 'bold', letterSpacing: '0.08em',
    cursor: 'pointer', borderRadius: '3px', border: '1px solid',
    fontFamily: 'inherit', flexShrink: '0',
  });

  function applyModeStyle() {
    if (mode === 'astro') {
      modeBtn.textContent = 'ASTRO';
      modeBtn.style.color = '#c8a84b';
      modeBtn.style.borderColor = 'rgba(200,168,75,0.6)';
      modeBtn.style.background = 'rgba(30,20,5,0.8)';
      wrap.style.border = '2px solid rgba(200,168,75,0.65)';
      wrap.style.boxShadow = '0 0 0 1px rgba(100,70,10,0.28), 0 0 22px 5px rgba(140,100,10,0.20)';
    } else {
      modeBtn.textContent = 'DIGI';
      modeBtn.style.color = '#00e8a0';
      modeBtn.style.borderColor = 'rgba(0,220,150,0.55)';
      modeBtn.style.background = 'rgba(0,20,12,0.8)';
      wrap.style.border = '2px solid rgba(0,220,150,0.55)';
      wrap.style.boxShadow = '0 0 0 1px rgba(0,120,70,0.28), 0 0 22px 5px rgba(0,100,50,0.20)';
    }
    lastModelDT = null;   // force redraw
  }
  modeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    mode = mode === 'astro' ? 'digi' : 'astro';
    applyModeStyle();
  });
  applyModeStyle();

  const subtitleEl = document.createElement('span');
  Object.assign(subtitleEl.style, {
    fontSize: '8px', fontStyle: 'italic', color: 'rgba(220,190,120,0.38)',
    marginLeft: '6px',
  });
  subtitleEl.textContent = 'Saros · Draconic · Synodic';

  header.appendChild(titleEl);
  header.appendChild(modeBtn);
  header.appendChild(subtitleEl);
  wrap.appendChild(header);

  // ── Canvas ─────────────────────────────────────────────────────────────────
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block; width:100%;';
  wrap.appendChild(canvas);

  // ── Footer ─────────────────────────────────────────────────────────────────
  const footer = document.createElement('div');
  Object.assign(footer.style, {
    padding: '3px 10px 4px', borderTop: '1px solid rgba(200,168,75,0.18)',
    fontSize: '8px', lineHeight: '1.4', color: 'rgba(220,190,120,0.35)',
    textAlign: 'center', background: 'rgba(4,6,16,0.8)',
  });
  footer.textContent = 'Eclipse when syzygy ≤15° from Moon\'s ascending node · no distances, no mass';
  wrap.appendChild(footer);

  // ── Resize handles ─────────────────────────────────────────────────────────
  function mkHandle(side) {
    const h = document.createElement('div');
    Object.assign(h.style, {
      position: 'absolute', bottom: '0', [side]: '0',
      width: '20px', height: '20px',
      cursor: side === 'left' ? 'nesw-resize' : 'nwse-resize', zIndex: '30',
    });
    h.innerHTML = `<svg width="20" height="20" style="display:block;opacity:0.55">
      <polyline points="${side === 'left' ? '0,20 20,20 20,0' : '20,20 0,20 0,0'}"
        fill="none" stroke="#c8a84b" stroke-width="2"/>
    </svg>`;
    wrap.appendChild(h);
    return h;
  }
  const handleL = mkHandle('left'), handleR = mkHandle('right');
  viewEl.appendChild(wrap);

  const ctx = canvas.getContext('2d');

  // Heights
  const ASTRO_LIST_H = 170;
  const DIGI_LIST_H  = 120;

  function syncCanvas(digiContentH) {
    const W = Math.max(wrap.clientWidth, 200);
    const H = mode === 'astro'
      ? W + ASTRO_LIST_H
      : (digiContentH || 440) + DIGI_LIST_H + 10;
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width  = W;
      canvas.height = H;
      canvas.style.height = H + 'px';
    }
  }

  // ── Drag ───────────────────────────────────────────────────────────────────
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
  window.addEventListener('mouseup', () => {
    if (dragging) { dragging = false; header.style.cursor = 'grab'; }
  });

  // ── Resize ─────────────────────────────────────────────────────────────────
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
      lastModelDT = null;
    });
    window.addEventListener('mouseup', () => { resizing = false; });
  }
  makeResizer(handleR, (dx) => ({ dW:  dx, dX: 0 }));
  makeResizer(handleL, (dx) => ({ dW: -dx, dX: 1 }));

  // ── Render loop ────────────────────────────────────────────────────────────
  let lastModelDT = null;

  function frame() {
    requestAnimationFrame(frame);
    const modelDT = model.state.DateTime;
    if (modelDT === lastModelDT && canvas.width === Math.max(wrap.clientWidth, 200)) return;
    lastModelDT = modelDT;

    const date     = dateTimeToDate(modelDT);
    const eclipses = getEclipses(date);
    const W        = Math.max(wrap.clientWidth, 200);

    if (mode === 'astro') {
      syncCanvas();
      const H = canvas.height;
      ctx.fillStyle = '#060914'; ctx.fillRect(0, 0, W, H);
      drawAstro(ctx, date, W, W);
      drawList(ctx, eclipses, 0, W, W, ASTRO_LIST_H, date, false);
    } else {
      // Digi mode: measure content height first by drawing to an offscreen canvas,
      // then draw for real.  Simpler: draw, read y returned, resize if needed.
      // We do a two-pass approach using a minimum height estimate first.
      const estimatedH = 480 + DIGI_LIST_H;
      if (canvas.width !== W || canvas.height < estimatedH) {
        canvas.width = W; canvas.height = estimatedH;
        canvas.style.height = estimatedH + 'px';
      }
      ctx.fillStyle = D_BG; ctx.fillRect(0, 0, W, canvas.height);
      const contentH = drawDigi(ctx, date, eclipses, W, canvas.height);
      // Resize canvas to fit actual content + list
      const targetH = contentH + DIGI_LIST_H + 6;
      if (canvas.height !== targetH) {
        canvas.width = W; canvas.height = targetH;
        canvas.style.height = targetH + 'px';
        ctx.fillStyle = D_BG; ctx.fillRect(0, 0, W, targetH);
        drawDigi(ctx, date, eclipses, W, targetH);
      }
      drawList(ctx, eclipses, 0, contentH + 6, W, DIGI_LIST_H, date, true);
    }
  }

  syncCanvas();
  frame();
}
