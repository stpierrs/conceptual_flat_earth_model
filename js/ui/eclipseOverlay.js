// eclipseOverlay.js — upcoming eclipse forecast panel.
//
// Shows the next 10 solar + lunar eclipses from the current model time.
// Clicking a row jumps the model's DateTime to that eclipse.
// Toggle via the ☀☾ button added to the header info-box.

import { findEclipses } from '../core/epicycle_ephemeris/eclipsePredictor.js';
import { TIME_ORIGIN }  from '../core/constants.js';

// Convert a JS Date to the model's DateTime scalar (days since 2017-01-01 UTC).
function dateToDateTime(date) {
  return date.getTime() / TIME_ORIGIN.msPerDay - TIME_ORIGIN.ZeroDate;
}

// ── Palette (matches epicycleOverlay aetheric plasma theme) ──────────────────
const BG_PANEL   = 'rgba(8,4,18,0.96)';
const BORDER_COL = 'rgba(140,80,240,0.75)';
const HDR_BG     = 'rgba(18,8,40,0.88)';
const DIVIDER    = 'rgba(120,80,220,0.3)';
const LABEL_COL  = '#b8b0e0';
const DIM_COL    = 'rgba(160,140,220,0.5)';

const SOLAR_COL  = '#f5d060';
const SOLAR_GLOW = 'rgba(245,208,96,0.8)';
const LUNAR_COL  = '#9ab8e8';
const LUNAR_GLOW = 'rgba(154,184,232,0.7)';

const SUBTYPE_COL = {
  total:      '#ff8844',
  central:    '#ffbb44',
  partial:    '#88aacc',
  penumbral:  '#6688aa',
};

// ── Cache ─────────────────────────────────────────────────────────────────────
// Recompute only when the month changes — eclipses don't shift day-to-day.
let _cacheMonth = null;
let _cacheFrom  = null;
let _cached     = [];

function getEclipses(fromDate) {
  const key = fromDate.getUTCFullYear() * 12 + fromDate.getUTCMonth();
  if (key !== _cacheMonth || Math.abs(fromDate - _cacheFrom) > 86400000 * 32) {
    const to = new Date(+fromDate + 730 * 86400000);  // 2 years ahead
    _cached     = findEclipses(fromDate, to).slice(0, 12);
    _cacheMonth = key;
    _cacheFrom  = fromDate;
  }
  return _cached;
}

// ── Formatting helpers ────────────────────────────────────────────────────────
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtDate(d) {
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function fmtTime(d) {
  const h = String(d.getUTCHours()).padStart(2,'0');
  const m = String(d.getUTCMinutes()).padStart(2,'0');
  return `${h}:${m} UTC`;
}

function fmtCountdown(nowMs, eclMs) {
  const diff = eclMs - nowMs;
  if (Math.abs(diff) < 3600000) return '◉ NOW';
  if (diff < 0) {
    const d = Math.floor(-diff / 86400000);
    return d === 0 ? `${Math.floor(-diff / 3600000)}h ago` : `${d}d ago`;
  }
  const days  = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days >= 365) return `${(days / 365.25).toFixed(1)} yr`;
  if (days >= 30)  return `${Math.floor(days / 30)}mo ${days % 30}d`;
  return days > 0 ? `${days}d ${hours}h` : `${hours}h`;
}

// ── Public builder ────────────────────────────────────────────────────────────
export function buildEclipseOverlay(viewEl, model) {

  // ── Wrapper ────────────────────────────────────────────────────────────────
  const wrap = document.createElement('div');
  wrap.id = 'eclipse-overlay';
  Object.assign(wrap.style, {
    position:     'absolute',
    top:          '52px',
    left:         '12px',
    width:        '320px',
    background:   BG_PANEL,
    border:       `2px solid ${BORDER_COL}`,
    boxShadow:    `0 0 0 1px rgba(80,40,160,0.4),
                   0 0 18px 4px rgba(100,40,200,0.35),
                   0 0 40px 8px rgba(60,0,120,0.2),
                   inset 0 0 0 1px rgba(160,120,255,0.15)`,
    borderRadius: '8px',
    fontFamily:   'ui-monospace, Menlo, monospace',
    color:        LABEL_COL,
    zIndex:       '19',
    display:      'none',
    userSelect:   'none',
    overflow:     'hidden',
    zoom:         'var(--ui-zoom, 1)',
  });

  // ── Header ─────────────────────────────────────────────────────────────────
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
    fontSize: '14px', fontWeight: 'bold', letterSpacing: '0.04em',
    color: LABEL_COL, textShadow: '0 0 10px rgba(180,150,255,0.6)',
  });
  titleEl.textContent = '☀☾  Eclipse Forecast';

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  Object.assign(closeBtn.style, {
    background: 'none', border: 'none', color: DIM_COL,
    cursor: 'pointer', fontSize: '14px', padding: '0 0 0 8px', lineHeight: '1',
  });
  closeBtn.addEventListener('click', () => { wrap.style.display = 'none'; });

  header.appendChild(titleEl);
  header.appendChild(closeBtn);
  wrap.appendChild(header);

  // ── Body (scrollable list) ─────────────────────────────────────────────────
  const body = document.createElement('div');
  Object.assign(body.style, {
    maxHeight:  '420px',
    overflowY:  'auto',
    padding:    '4px 0',
    scrollbarWidth: 'thin',
    scrollbarColor: 'rgba(120,80,220,0.4) transparent',
  });
  wrap.appendChild(body);

  // ── Footer ─────────────────────────────────────────────────────────────────
  const footer = document.createElement('div');
  Object.assign(footer.style, {
    padding:     '5px 10px 7px',
    borderTop:   `1px solid ${DIVIDER}`,
    fontSize:    '9px',
    lineHeight:  '1.5',
    background:  'rgba(8,4,20,0.6)',
    color:       DIM_COL,
    textAlign:   'center',
  });
  footer.textContent = 'Click row to jump  ·  2-year window  ·  pure angular geometry';
  wrap.appendChild(footer);

  viewEl.appendChild(wrap);

  // ── Drag ──────────────────────────────────────────────────────────────────
  let dragging = false, dragOx = 0, dragOy = 0;
  header.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    dragging = true;
    const r = wrap.getBoundingClientRect(), vr = viewEl.getBoundingClientRect();
    wrap.style.left = 'auto';
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

  // ── Row builder ───────────────────────────────────────────────────────────
  function buildRow(ecl, nowMs) {
    const isSolar = ecl.type === 'solar';
    const bodyCol = isSolar ? SOLAR_COL  : LUNAR_COL;
    const bodyGlo = isSolar ? SOLAR_GLOW : LUNAR_GLOW;
    const eclMs   = +ecl.date;
    const past    = eclMs < nowMs;

    const row = document.createElement('div');
    Object.assign(row.style, {
      display:      'flex',
      alignItems:   'center',
      padding:      '6px 10px',
      gap:          '8px',
      borderBottom: `1px solid ${DIVIDER}`,
      cursor:       'pointer',
      opacity:      past ? '0.45' : '1',
      transition:   'background 0.15s',
    });
    row.addEventListener('mouseenter', () => { row.style.background = 'rgba(120,80,220,0.15)'; });
    row.addEventListener('mouseleave', () => { row.style.background = ''; });
    row.addEventListener('click', () => {
      model.setState({ DateTime: dateToDateTime(ecl.date) });
    });

    // Icon
    const icon = document.createElement('span');
    icon.textContent = isSolar ? '☀' : '☾';
    Object.assign(icon.style, {
      fontSize: '18px', color: bodyCol,
      textShadow: `0 0 8px ${bodyGlo}`,
      flexShrink: '0', width: '22px', textAlign: 'center',
    });

    // Info block
    const info = document.createElement('div');
    info.style.cssText = 'flex:1; min-width:0;';

    const dateLine = document.createElement('div');
    Object.assign(dateLine.style, {
      fontSize: '11px', fontWeight: 'bold', color: bodyCol,
      textShadow: `0 0 6px ${bodyGlo}`,
    });
    dateLine.textContent = `${fmtDate(ecl.date)}  ${fmtTime(ecl.date)}`;

    const subLine = document.createElement('div');
    subLine.style.cssText = 'display:flex; align-items:center; gap:6px; margin-top:2px;';

    const typeBadge = document.createElement('span');
    Object.assign(typeBadge.style, {
      fontSize: '8px', fontWeight: 'bold', letterSpacing: '0.08em',
      padding: '1px 5px', borderRadius: '3px',
      background: `${SUBTYPE_COL[ecl.subtype] || '#8899bb'}22`,
      color: SUBTYPE_COL[ecl.subtype] || '#8899bb',
      border: `1px solid ${SUBTYPE_COL[ecl.subtype] || '#8899bb'}55`,
      textTransform: 'uppercase', flexShrink: '0',
    });
    typeBadge.textContent = `${isSolar ? 'Solar' : 'Lunar'} ${ecl.subtype}`;

    // Magnitude bar
    const barWrap = document.createElement('div');
    Object.assign(barWrap.style, {
      flex: '1', height: '4px', borderRadius: '2px',
      background: 'rgba(120,80,220,0.2)', overflow: 'hidden',
    });
    const bar = document.createElement('div');
    Object.assign(bar.style, {
      width: `${Math.round(ecl.magnitude * 100)}%`,
      height: '100%', borderRadius: '2px',
      background: `linear-gradient(90deg, ${bodyCol}aa, ${bodyCol})`,
      boxShadow: `0 0 4px ${bodyGlo}`,
    });
    barWrap.appendChild(bar);

    subLine.appendChild(typeBadge);
    subLine.appendChild(barWrap);

    info.appendChild(dateLine);
    info.appendChild(subLine);

    // Countdown
    const cd = document.createElement('div');
    Object.assign(cd.style, {
      fontSize: '10px', color: past ? DIM_COL : LABEL_COL,
      flexShrink: '0', textAlign: 'right', minWidth: '56px',
    });
    cd.textContent = fmtCountdown(nowMs, eclMs);

    row.appendChild(icon);
    row.appendChild(info);
    row.appendChild(cd);
    return row;
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  let _lastRenderKey = null;

  function render() {
    if (wrap.style.display === 'none') return;

    const nowDate = new Date(model.state.DateTime);
    const lookbackMs = 30 * 86400000;  // show recent past 30 days too
    const fromDate = new Date(+nowDate - lookbackMs);
    const nowMs = +nowDate;

    // Re-render only when the hour changes (countdowns) or month changes (list)
    const renderKey = `${nowDate.getUTCFullYear()}-${nowDate.getUTCMonth()}-${nowDate.getUTCDate()}-${nowDate.getUTCHours()}`;
    if (renderKey === _lastRenderKey) return;
    _lastRenderKey = renderKey;

    const eclipses = getEclipses(fromDate);

    body.innerHTML = '';
    if (eclipses.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = `padding:16px; text-align:center; color:${DIM_COL}; font-size:11px;`;
      empty.textContent = 'No eclipses found in 2-year window.';
      body.appendChild(empty);
    } else {
      for (const ecl of eclipses) {
        body.appendChild(buildRow(ecl, nowMs));
      }
    }
  }

  model.addEventListener('update', render);

  // ── Toggle button ──────────────────────────────────────────────────────────
  // Injected into the existing .info-box in the header.
  const infoBox = document.querySelector('.info-box');
  if (infoBox) {
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'info-btn';
    toggleBtn.type = 'button';
    toggleBtn.setAttribute('aria-label', 'Eclipse forecast');
    toggleBtn.innerHTML = '🌘 <span>Eclipses</span>';
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const visible = wrap.style.display !== 'none';
      wrap.style.display = visible ? 'none' : '';
      if (!visible) render();
    });
    // Insert before the first child (About button)
    infoBox.insertBefore(toggleBtn, infoBox.firstChild);
  }

  return wrap;
}
