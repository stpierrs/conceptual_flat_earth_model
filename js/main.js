// App bootstrap — wires everything together for the flat earth model.

import { FeModel } from './core/app.js';
import { Renderer } from './render/index.js';
import { attachMouseHandler } from './ui/mouseHandler.js';
import { attachKeyboardHandler } from './ui/keyboardHandler.js';
import { buildControlPanel, buildHud, buildTrackerHud } from './ui/controlPanel.js';
import { buildTrackingInfoPopup } from './ui/trackingInfoPopup.js';
import { buildEpicycleOverlay } from './ui/epicycleOverlay.js';
import { buildEclipseOverlay }  from './ui/eclipseOverlay.js';
import { Demos } from './demos/index.js';
import { attachUrlState } from './ui/urlState.js';
import { setActiveProjection } from './core/canonical.js';
import { t, onLangChange, isRtl } from './ui/i18n.js';

const model = new FeModel();
const canvas = document.getElementById('feCanvas');

// Build the UI first — controls stay visible even if WebGL fails.
const demos = new Demos(model);
const viewEl_panel = document.getElementById('view');
buildControlPanel(viewEl_panel, model, demos);
const hudEl = document.getElementById('hud');
buildHud(hudEl, model);
const trackerHudEl = document.getElementById('tracker-hud');
if (trackerHudEl) buildTrackerHud(trackerHudEl, model);
const trackingInfoEl = document.getElementById('tracking-info-popup');
if (trackingInfoEl) buildTrackingInfoPopup(trackingInfoEl, model);
if (viewEl_panel) buildEpicycleOverlay(viewEl_panel, model);
const eclipseWrap = viewEl_panel ? buildEclipseOverlay(viewEl_panel, model) : null;
const eclipseBtn  = document.getElementById('eclipse-predictor-btn');
if (eclipseBtn && eclipseWrap) {
  eclipseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    eclipseWrap.style.display = eclipseWrap.style.display === 'none' ? '' : 'none';
  });
}

// First load only — pick the browser's language if nothing is in the URL hash yet.
const _hashHasLang = window.location.hash.includes('Language=');
if (!_hashHasLang) {
  const SUPPORTED = new Set(['en','cs','es','fr','de','it','pt','pl','nl','sk','ru','ar','he','zh','ja','ko','th','hi']);
  const prefs = (navigator.languages && navigator.languages.length)
    ? navigator.languages
    : [navigator.language || 'en'];
  for (const p of prefs) {
    const id = (p || '').toLowerCase().split('-')[0];
    if (SUPPORTED.has(id)) {
      model.setState({ Language: id });
      break;
    }
  }
}

// Keep the grid projection consistent with whatever map the user picked.
// Dual-pole mode always uses the dp grid. Otherwise, if the selected
// projection has useProjectionGrid: true, the grid follows it so the
// disc, observer, sun/moon ground points, and graticule all line up.
// Registered before the Renderer so the grid rebuilds first.
import { getProjection } from './core/projections.js';
const refreshActiveProjection = () => {
  if (model.state.WorldModel === 'dp') {
    setActiveProjection('dp');
    return;
  }
  const id = model.state.MapProjection;
  const proj = id ? getProjection(id) : null;
  setActiveProjection((proj && proj.useProjectionGrid) ? id : null);
};
model.addEventListener('update', refreshActiveProjection);
refreshActiveProjection();

let renderer = null;
try {
  renderer = new Renderer(canvas, model);
  renderer.loadLand().catch((err) => {
    console.warn('Failed to load land data:', err);
  });
  attachMouseHandler(canvas, model, renderer);
  attachKeyboardHandler(model);
} catch (err) {
  console.error('WebGL unavailable — 3D view disabled:', err);
  const warn = document.createElement('div');
  warn.style.cssText = 'position:absolute; inset:0; display:flex; align-items:center; justify-content:center; color:#fff; padding:24px; text-align:center;';
  warn.textContent = 'WebGL could not be initialised. The controls still work; the 3D view is disabled.';
  canvas.parentElement.appendChild(warn);
}

try {
  model.update();
  model.dispatchEvent(new CustomEvent('update'));
} catch (err) {
  // Catch first-paint errors — controls still show, status line reports it.
  console.error('First-frame update() threw:', err);
  const _desc = document.querySelector('#desc .desc-dynamic');
  if (_desc) {
    _desc.style.color = '#ff6b6b';
    _desc.textContent =
      'First-frame error: ' + (err && err.message ? err.message : String(err))
      + '  (open DevTools \u2192 Console for the full stack)';
  }
}

const descDynamicEl = document.querySelector('#desc .desc-dynamic');

// Status line — where is the sun and what does that mean for the observer.
function defaultStatus(s, c) {
  const lat = s.ObserverLat;
  const dec = (c.SunDec || 0) * 180 / Math.PI;
  const elev = c.SunAnglesGlobe ? c.SunAnglesGlobe.elevation : 0;
  const latStr = `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'}`;

  let sun;
  if (elev > 0)        sun = `${t('within_vault')} — ${t('daylight')}`;
  else if (elev > -6)  sun = `${t('beyond_vault')} — ${t('twilight_civil')}`;
  else if (elev > -12) sun = `${t('beyond_vault')} — ${t('twilight_nautical')}`;
  else if (elev > -18) sun = `${t('beyond_vault')} — ${t('twilight_astronomical')}`;
  else                 sun = `${t('beyond_vault')} — ${t('night')}`;

  if (Math.abs(lat + dec) > 90) return `${latStr} — ${sun} ${t('sun_never_leaves')}.`;
  if (Math.abs(lat - dec) > 90) return `${latStr} — ${sun} ${t('sun_never_enters')}.`;
  return `${latStr} — ${sun}.`;
}

model.addEventListener('update', () => {
  descDynamicEl.textContent =
    model.state.Description || defaultStatus(model.state, model.computed);
});

const logoEl = document.getElementById('logo');
if (logoEl) {
  const syncLogo = () => { logoEl.style.display = model.state.ShowLogo === false ? 'none' : ''; };
  model.addEventListener('update', syncLogo);
  syncLogo();
}

// Snap camera on Optical mode entry so 45° elevation sits near viewport top.
const OPTICAL_ENTRY_ZOOM  = 1.0;
const OPTICAL_ENTRY_PITCH = 7.5;
// Leaving Optical while tracking — snap to bird's-eye so the disc is
// visible with the tracked body's ground point near center.
const HEAVENLY_TRACK_PITCH = 80.3;
const HEAVENLY_TRACK_DIST  = 10;
const HEAVENLY_TRACK_ZOOM  = 4.67;
let _prevInsideVault = !!model.state.InsideVault;
model.addEventListener('update', () => {
  const now = !!model.state.InsideVault;
  if (now && !_prevInsideVault) {
    if (model.state.FollowTarget) {
      // Tracking while entering Optical — keep zoom, skip pitch snap.
      // mouseHandler re-aims at the target on the next tick.
      model.setState({
        OpticalZoom: OPTICAL_ENTRY_ZOOM,
        FreeCamActive: false,
      });
    } else {
      model.setState({
        OpticalZoom:  OPTICAL_ENTRY_ZOOM,
        CameraHeight: OPTICAL_ENTRY_PITCH,
      });
    }
  } else if (!now && _prevInsideVault && model.state.FollowTarget) {
    model.setState({
      CameraHeight:   HEAVENLY_TRACK_PITCH,
      CameraDistance: HEAVENLY_TRACK_DIST,
      Zoom:           HEAVENLY_TRACK_ZOOM,
      FreeCamActive:  true,
    });
  }
  _prevInsideVault = now;
});

// Cadence chip — step size, FOV, and heading when in Optical mode.
// When you're looking up at the dome you need to know where you're pointed.
const cadenceChip = document.createElement('div');
cadenceChip.id = 'cadence-chip';
cadenceChip.style.cssText = `
  position: absolute;
  top: 8px;
  right: 12px;
  pointer-events: none;
  font: 12px/1.4 ui-monospace, Menlo, monospace;
  color: #f4a640;
  background: rgba(10, 14, 22, 0.78);
  border: 1px solid rgba(244, 166, 64, 0.4);
  border-radius: 6px;
  padding: 4px 10px;
  z-index: 10;
  display: none;
  zoom: var(--ui-zoom);
`;
const viewEl = document.getElementById('view');
if (viewEl) viewEl.appendChild(cadenceChip);

// Must stay in sync with refinedAzCadenceForFov (worldObjects.js)
// and opticalCadenceStepDeg (mouseHandler.js).
function activeCadenceLabel(fovDeg) {
  if (fovDeg >= 30) return '15°';
  if (fovDeg >= 8)  return '5°';
  return '1°';
}

model.addEventListener('update', () => {
  if (!cadenceChip) return;
  const s = model.state;
  if (!s.InsideVault) {
    cadenceChip.style.display = 'none';
    return;
  }
  const zoom = Math.max(0.2, s.OpticalZoom || 5.09);
  const fov  = Math.max(1, Math.min(75, 75 / zoom));
  const heading = ((s.ObserverHeading || 0) % 360 + 360) % 360;
  cadenceChip.textContent =
    `Step: ${activeCadenceLabel(fov)}  ·  FOV ${fov.toFixed(1)}°  ·  `
    + `Facing ${heading.toFixed(1)}°`;
  cadenceChip.style.display = '';
});


const aboutBtn    = document.getElementById('about-btn');
const aboutPopup  = document.getElementById('about-popup');
const legendBtn   = document.getElementById('legend-btn');
const legendPopup = document.getElementById('legend-popup');
const infoBoxBtns = [aboutBtn, legendBtn].filter(Boolean);
const infoBoxPopups = [aboutPopup, legendPopup].filter(Boolean);

function openInfoPopup(popup) {
  for (const p of infoBoxPopups) p.hidden = (p !== popup) ? true : !p.hidden;
}

if (aboutBtn && aboutPopup) {
  aboutBtn.addEventListener('click', (e) => { e.stopPropagation(); openInfoPopup(aboutPopup); });
}
if (legendBtn && legendPopup) {
  // Try the translated about_<lang>.md first, fall back to English.
  let legendLoadedLang = null;
  let legendLoading = null;
  const loadLegend = async () => {
    const lang = model.state.Language || 'en';
    if (legendLoadedLang === lang) return;
    if (legendLoading) await legendLoading;
    legendLoading = (async () => {
      let md = null;
      if (lang !== 'en') {
        try {
          const res = await fetch(`about_${lang}.md`);
          if (res.ok) md = await res.text();
        } catch (_) {}
      }
      if (md == null) {
        try {
          const res = await fetch('about.md');
          if (res.ok) md = await res.text();
        } catch (_) {}
      }
      if (md != null) {
        legendPopup.innerHTML = renderMarkdown(md);
        legendLoadedLang = lang;
      } else {
        legendPopup.textContent = 'Legend unavailable.';
      }
    })();
    await legendLoading;
    legendLoading = null;
  };
  legendBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await loadLegend();
    openInfoPopup(legendPopup);
  });
  // Language changed — bust the cache so the next open pulls fresh content.
  onLangChange(() => {
    legendLoadedLang = null;
    if (!legendPopup.hidden) loadLegend();
  });
}
document.addEventListener('click', (e) => {
  for (const popup of infoBoxPopups) {
    if (popup.hidden) continue;
    if (popup.contains(e.target)) continue;
    if (infoBoxBtns.some((b) => b && b.contains(e.target))) continue;
    popup.hidden = true;
  }
});

// Minimal markdown renderer for the Legend popup — headings, paragraphs,
// bullet lists, GFM tables, code spans, bold, italic. Nothing more needed.
function renderMarkdown(src) {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0;
  const inline = (s) => s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/&lt;kbd&gt;([^&]+)&lt;\/kbd&gt;/g, '<kbd>$1</kbd>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  while (i < lines.length) {
    const ln = lines[i];
    if (/^---+\s*$/.test(ln)) { out.push('<hr>'); i++; continue; }
    const h = ln.match(/^(#{1,6})\s+(.*)$/);
    if (h) { out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); i++; continue; }
    if (ln.startsWith('| ')) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) { rows.push(lines[i]); i++; }
      if (rows.length >= 2) {
        const split = (r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        const headers = split(rows[0]);
        const body = rows.slice(2).map(split);
        out.push('<table>');
        out.push('<thead><tr>' + headers.map((h) => `<th>${inline(h)}</th>`).join('') + '</tr></thead>');
        out.push('<tbody>' + body.map((r) => '<tr>' + r.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</tbody>');
        out.push('</table>');
        continue;
      }
    }
    if (/^[-*]\s+/.test(ln)) {
      const items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^[-*]\s+/, ''))}</li>`);
        i++;
      }
      out.push('<ul>' + items.join('') + '</ul>');
      continue;
    }
    if (ln.trim() === '') { i++; continue; }
    const p = [ln];
    i++;
    while (i < lines.length && lines[i].trim() && !/^(#|---|\||[-*]\s)/.test(lines[i])) {
      p.push(lines[i]); i++;
    }
    out.push(`<p>${inline(p.join(' '))}</p>`);
  }
  return out.join('\n');
}

// Translate all data-i18n nodes in the DOM — About popup text and so on.
function refreshI18nNodes() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const k = el.getAttribute('data-i18n');
    el.textContent = t(k);
  });
}
onLangChange(refreshI18nNodes);
refreshI18nNodes();

attachUrlState(model, demos);

// Keep the app title and subtitle translated as language changes.
const _titleEl = document.getElementById('app-title');
const _subEl   = document.getElementById('app-subtitle');
const refreshTitle = () => {
  if (_titleEl) _titleEl.textContent = t('app_title');
  if (_subEl)   _subEl.textContent   = t('app_subtitle');
  document.documentElement.setAttribute('dir', isRtl() ? 'rtl' : 'ltr');
};
onLangChange(refreshTitle);
refreshTitle();

window.model = model;
window.renderer = renderer;
window.demos = demos;

// Service-worker kept registered so old cached workers pick up the kill-switch
// on their next load and clear themselves out.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
