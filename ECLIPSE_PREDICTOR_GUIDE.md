# Eclipse Predictor — Complete Implementation Guide

Everything you need to add a working geocentric eclipse predictor overlay to a similar sky model.
No external libraries. No distances. No mass. Pure angular sky geometry.

---

## How It Works (the concept)

Three observable angular cycles drive every eclipse:

| Cycle | Period | What it measures |
|---|---|---|
| Synodic | ~29.530 days | Moon returns to same elongation from Sun (New/Full Moon) |
| Draconic | ~27.212 days | Moon returns to ascending node (node crossing) |
| Anomalistic | ~27.555 days | Moon returns to closest angular approach (speed variation) |

An eclipse happens when a syzygy (New or Full Moon) falls close enough to the Moon's orbital node that the Sun and Moon discs overlap in the sky. The Saros cycle (18 years 11 days = 223 synodic ≈ 242 draconic ≈ 239 anomalistic) emerges from these three numbers with nothing else added.

Eclipse limits are empirical angular thresholds — how close to a node a syzygy must be. No orbital radii needed:

```
Solar partial:    |β| < 1.54°   (any solar eclipse)
Solar central:    |β| < 0.68°   (total or annular)
Lunar penumbral:  |β| < 1.57°
Lunar partial:    |β| < 1.07°
Lunar total:      |β| < 0.45°
```

β = Moon's ecliptic latitude at the moment of syzygy.

---

## File Structure

```
js/
  core/
    epicycle_ephemeris/
      epiCore.js            ← math primitives (trig, time, angles)
      epiParams.js          ← Sun + Moon orbital parameters at J2000.0
      eclipsePredictor.js   ← the prediction engine (public API)
  ui/
    eclipseOverlay.js       ← canvas overlay: ASTRO mode + DIGI mode + eclipse list
  main.js                   ← wire it up (3 lines)
index.html                  ← add the Eclipses button
```

---

## Step 1 — Math Primitives (`epiCore.js`)

This file is shared with the rest of the ephemeris. The eclipse predictor only needs these exports:

```js
// Degree-mode trig
export const sind   = x => Math.sin(x * Math.PI / 180);
export const cosd   = x => Math.cos(x * Math.PI / 180);

// Angle normalisation
export const degmod    = x => ((x % 360) + 360) % 360;
export const degmod180 = x => { const m = degmod(x); return m > 180 ? m - 360 : m; };

// Time: Date → days elapsed since J2000.0 (noon 1 Jan 2000 UTC)
export function j2000Day(date) {
  return date.getTime() / 86400000 + 2440587.5 - 2451545.0;
}

// Kepler equation solver — used for Moon eccentricity correction
export function solveKepler(M, e, tol = 1e-8) {
  // M in degrees, e dimensionless
  let E = M * Math.PI / 180;
  for (let i = 0; i < 50; i++) {
    const dE = (M * Math.PI / 180 - E + e * Math.sin(E)) / (1 - e * Math.cos(E));
    E += dE;
    if (Math.abs(dE) < tol) break;
  }
  return E * 180 / Math.PI;  // degrees
}

// True anomaly from eccentric anomaly
export function trueAnomaly(E_deg, e) {
  const E = E_deg * Math.PI / 180;
  const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2),
                            Math.sqrt(1 - e) * Math.cos(E / 2));
  return nu * 180 / Math.PI;  // degrees
}
```

---

## Step 2 — Sun & Moon Parameters (`epiParams.js`)

The predictor only uses `SUN` and `MOON`. All angles in degrees. All rates in degrees/day. Epoch = J2000.0.

```js
export const SUN = {
  nlong:  0.9856474,   // mean longitude rate °/day
  nanom:  0.9856003,   // mean anomaly rate °/day
  L0:   280.46646,     // mean longitude at J2000.0
  M0:   357.52911,     // mean anomaly at J2000.0
  ecc:    0.016709,    // eccentricity
};

export const MOON = {
  nlong:  13.1763966,  // mean longitude rate °/day  (sidereal: 360/27.321661)
  nanom:  13.0649929,  // mean anomaly rate °/day    (anomalistic: 360/27.554550)
  nnode:   0.0529539,  // node regression rate °/day (draconic: 360/18.6 yr)
  L0:   218.3165,      // mean longitude at J2000.0
  M0:   134.9634,      // mean anomaly at J2000.0
  N0:   125.0443,      // ascending node longitude at J2000.0 (regressing)
  ecc:    0.054900,    // deferent eccentricity
  epi:    0.054900,    // epicycle radius (≈ ecc for Moon)
  inc:    5.1454,      // orbital inclination to ecliptic °
};
```

**Why these numbers:** Mean motions come from observed periods (sidereal, anomalistic, draconic). L0/M0/N0 are the epoch positions fitted to sky observations at J2000.0.

---

## Step 3 — The Prediction Engine (`eclipsePredictor.js`)

Full source below. This is a self-contained module — copy it as-is.

```js
// eclipsePredictor.js
import { sind, cosd, degmod, degmod180, j2000Day, solveKepler, trueAnomaly } from './epiCore.js';
import { SUN, MOON } from './epiParams.js';

// Empirical eclipse limits (degrees of Moon ecliptic latitude at syzygy)
const SOLAR_PARTIAL_LIMIT   = 1.54;
const SOLAR_CENTRAL_LIMIT   = 0.68;
const LUNAR_PENUMBRAL_LIMIT = 1.57;
const LUNAR_PARTIAL_LIMIT   = 1.07;
const LUNAR_TOTAL_LIMIT     = 0.45;
const SYNODIC_MONTH         = 29.53059;

// Sun apparent ecliptic longitude — 3-term equation of centre
export function sunLon(t) {
  const L = degmod(SUN.L0 + t * SUN.nlong);
  const M = degmod(SUN.M0 + t * SUN.nanom);
  const C = (1.9146 - 0.004817 * t / 36525) * sind(M)
           + 0.019993 * sind(2 * M)
           + 0.000290 * sind(3 * M);
  return degmod(L + C);
}

// Moon ecliptic longitude + latitude — 25-term lon, 6-term lat series
export function moonEcliptic(t) {
  const Lm = degmod(MOON.L0 + t * MOON.nlong);
  const Mm = degmod(MOON.M0 + t * MOON.nanom);
  const Nm = degmod(MOON.N0 - t * MOON.nnode);
  const Ms = degmod(SUN.M0  + t * SUN.nanom);
  const Ls = degmod(SUN.L0  + t * SUN.nlong);
  const D  = degmod(Lm - Ls);
  const F  = degmod(Lm - Nm);

  const E_deg = solveKepler(Mm, MOON.ecc);
  const nu    = trueAnomaly(E_deg, MOON.ecc);
  const eqc   = degmod180(nu - Mm);

  const lon = degmod(Lm + eqc
    + 1.2740 * sind(2*D - Mm)   + 0.6583 * sind(2*D)
    - 0.1858 * sind(Ms)          + 0.2136 * sind(2*Mm)
    - 0.1140 * sind(2*F)         + 0.0588 * sind(2*D - 2*Mm)
    - 0.0572 * sind(2*D - Ms - Mm) + 0.0533 * sind(2*D + Mm)
    + 0.0459 * sind(2*D - Ms)   + 0.0410 * sind(Mm - Ms)
    - 0.0348 * sind(D)           - 0.0306 * sind(Ms + Mm)
    + 0.0267 * sind(2*D + Ms - Mm) + 0.0117 * sind(4*D - Mm)
    - 0.0111 * sind(2*D - 2*Ms) + 0.0153 * sind(2*D - 2*F)
    - 0.0125 * sind(Mm + 2*F)   + 0.0110 * sind(Mm - 2*F)
    + 0.0100 * sind(3*Mm)        + 0.0086 * sind(4*D - 2*Mm)
    - 0.0077 * sind(2*D + Ms)   - 0.0052 * sind(D - Mm)
    + 0.0050 * sind(Ms + D)      + 0.0040 * sind(2*D + 2*Mm)
    + 0.0039 * sind(4*D)
  );

  const Fact = degmod(lon - Nm);
  const lat = MOON.inc * sind(Fact)
            - 0.2806 * sind(2*D - F)   - 0.2555 * sind(2*D + F)
            + 0.0557 * sind(Mm + F)    - 0.0467 * sind(2*D - Mm - F)
            + 0.0464 * sind(2*D + Mm - F);

  return { lon, lat };
}

// Mean elongation (fast, no perturbations) — used to step toward syzygies
function elongationMean(t) {
  return degmod(MOON.L0 + t * MOON.nlong - SUN.L0 - t * SUN.nlong);
}

// Full elongation with perturbation series
function elongationFull(t) {
  return degmod(moonEcliptic(t).lon - sunLon(t));
}

// Bisection — finds zero crossing to 1-minute precision
function bisect(t0, t1, fn, tol = 1 / 1440) {
  let f0 = fn(t0);
  for (let i = 0; i < 60 && (t1 - t0) > tol; i++) {
    const tm = (t0 + t1) / 2;
    const fm = fn(tm);
    if (f0 * fm <= 0) { t1 = tm; } else { t0 = tm; f0 = fm; }
  }
  return (t0 + t1) / 2;
}

// Find next New Moon (type='new') or Full Moon (type='full') after t_start
function findNextSyzygy(t_start, type) {
  const target = type === 'new' ? 0 : 180;
  const pMean  = t => degmod180(elongationMean(t) - target);
  const pFull  = t => degmod180(elongationFull(t)  - target);
  let t = t_start, p = pMean(t);
  for (let i = 0; i < 33; i++) {
    const t1 = t + 1, p1 = pMean(t1);
    if (p < 0 && p1 >= 0 && Math.abs(p1 - p) < 90) return bisect(t, t1, pFull);
    t = t1; p = p1;
  }
  return null;
}

// Classify eclipse from Moon latitude β at syzygy
function classifyEclipse(beta, syzType) {
  const b = Math.abs(beta);
  if (syzType === 'new') {
    if (b >= SOLAR_PARTIAL_LIMIT) return null;
    return { type: 'solar',
             subtype: b < SOLAR_CENTRAL_LIMIT ? 'central' : 'partial',
             magnitude: (SOLAR_PARTIAL_LIMIT - b) / SOLAR_PARTIAL_LIMIT };
  }
  if (b >= LUNAR_PENUMBRAL_LIMIT) return null;
  return { type: 'lunar',
           subtype: b < LUNAR_TOTAL_LIMIT ? 'total' : b < LUNAR_PARTIAL_LIMIT ? 'partial' : 'penumbral',
           magnitude: (LUNAR_PENUMBRAL_LIMIT - b) / LUNAR_PENUMBRAL_LIMIT };
}

function tToDate(t) {
  return new Date((t + 2451545.0 - 2440587.5) * 86400000);
}

// PUBLIC API

// Find all eclipses between two dates. Returns Eclipse[] sorted by date.
// Eclipse: { date, type, subtype, beta, magnitude }
export function findEclipses(startDate, endDate) {
  const t0 = j2000Day(startDate), t1 = j2000Day(endDate);
  const eclipses = [];
  for (const syzType of ['new', 'full']) {
    let t = t0;
    while (t < t1) {
      const ts = findNextSyzygy(t, syzType);
      if (ts === null || ts > t1) break;
      const { lat: beta } = moonEcliptic(ts);
      const info = classifyEclipse(beta, syzType);
      if (info) eclipses.push({ date: tToDate(ts), beta, ...info });
      t = ts + SYNODIC_MONTH * 0.9;
    }
  }
  return eclipses.sort((a, b) => a.date - b.date);
}

// Find the next eclipse after startDate (searches 2 years ahead).
export function nextEclipse(startDate, type) {
  const end = new Date(+startDate + 730 * 86400000);
  const all = findEclipses(startDate, end);
  return type ? (all.find(e => e.type === type) ?? null) : (all[0] ?? null);
}
```

---

## Step 4 — The Overlay (`eclipseOverlay.js`)

The overlay is a draggable, resizable floating panel built from a `<canvas>`. It reads from your model's current date/time and draws either ASTRO mode (Prague Clock astrolabium) or DIGI mode (terminal readout).

**What it needs from your model:**

```js
// Your model must expose:
model.state.DateTime   // a string or value that changes when the time changes
                       // (the overlay uses it to detect when to redraw)
```

**And a helper to convert that to a `Date`:**

```js
// In time.js (or inline in eclipseOverlay.js)
export function dateTimeToDate(dt) {
  return new Date(dt);   // adapt to whatever format your model uses
}
```

**The export signature:**

```js
export function buildEclipseOverlay(viewEl, model)
// viewEl  — the DOM element the panel is appended to (position:relative)
// model   — your model object with model.state.DateTime
// returns — the wrapper <div> (so you can toggle its display)
```

Copy `eclipseOverlay.js` as-is. The file is self-contained — it imports only from `eclipsePredictor.js`, `epiParams.js`, `epiCore.js`, and `time.js`.

---

## Step 5 — Wire It Into Your App (`main.js`)

```js
import { buildEclipseOverlay } from './ui/eclipseOverlay.js';

// After your model and view element exist:
let eclipseWrap = null;
try {
  eclipseWrap = viewEl ? buildEclipseOverlay(viewEl, model) : null;
} catch (err) {
  console.error('Eclipse overlay failed to initialise:', err);
}

// Button to show/hide the panel
const eclipseBtn = document.getElementById('eclipse-predictor-btn');
if (eclipseBtn) {
  eclipseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const panel = document.getElementById('eclipse-overlay');
    if (!panel) {
      eclipseBtn.style.background = '#c00';
      return;
    }
    const showing = panel.style.display !== 'none';
    panel.style.display = showing ? 'none' : '';
    eclipseBtn.style.outline = showing ? '' : '3px solid orange';
  });
}
```

---

## Step 6 — HTML Button

Add this wherever you keep your toolbar buttons:

```html
<button id="eclipse-predictor-btn"
  style="background:#1a0010; color:#ff6060; border:1px solid #c05050;
         padding:2px 8px; font-size:11px; cursor:pointer; border-radius:3px;">
  ◎ Eclipses
</button>
```

The button id must be `eclipse-predictor-btn`. The panel id (`eclipse-overlay`) is assigned inside `buildEclipseOverlay` automatically.

---

## The Critical Bug to Avoid

**Temporal dead zone in `buildEclipseOverlay`.**

Inside `buildEclipseOverlay`, `lastModelDT` is used by `applyModeStyle()` (called at build time), so it **must be declared before `applyModeStyle` is defined**:

```js
// CORRECT — declare before the function that uses it
let lastModelDT = null;

function applyModeStyle() {
  // ...
  lastModelDT = null;   // force redraw on mode toggle
}
applyModeStyle();       // called immediately — would throw if lastModelDT not yet declared
```

```js
// BROKEN — let has temporal dead zone; accessing before declaration throws ReferenceError
function applyModeStyle() {
  lastModelDT = null;   // ReferenceError: Cannot access 'lastModelDT' before initialization
}
applyModeStyle();

let lastModelDT = null;  // too late — TDZ error already thrown above
```

JavaScript `let`/`const` are hoisted but not initialised. Any access before the declaration line executes throws `ReferenceError`. `var` does not have this problem (but don't use `var`). The fix is simply to declare `lastModelDT` above any function that touches it.

---

## Module Dependencies

```
eclipseOverlay.js
  ├── eclipsePredictor.js
  │     ├── epiCore.js        (sind, cosd, degmod, degmod180, j2000Day, solveKepler, trueAnomaly)
  │     └── epiParams.js      (SUN, MOON)
  ├── epiParams.js            (MOON.N0, MOON.nnode — for node position display)
  ├── epiCore.js              (j2000Day, degmod)
  └── time.js                 (dateTimeToDate)
```

All five files are in the zip archive. The rest of your app (renderer, projections, controls) is not needed by the eclipse predictor.

---

## Accuracy Notes

- **Solar eclipses**: dates accurate to ~1 day; time of day to ~1–3 hours. Good enough to identify the correct event.
- **Lunar eclipses**: similar accuracy. Penumbral eclipses are the most sensitive to Moon latitude errors.
- **False positives**: rare but possible near the partial-limit boundary (~1.54° solar, ~1.57° lunar).
- **Improving accuracy**: the Moon's equation of centre has two major missing terms — evection (1.274°) and variation (0.658°). Both are included as perturbation terms in `moonEcliptic()`. Further improvement would require the full Brown/ELP2000 series.
- **The model does not predict eclipse times to the minute.** That requires light-time correction and the observer's actual shadow geometry, which requires knowing physical sizes. This model is intentionally distance-free.

---

## Quick Test

After wiring everything in, open the browser console and run:

```js
import { findEclipses } from './js/core/epicycle_ephemeris/eclipsePredictor.js';
const eclipses = findEclipses(new Date('2024-01-01'), new Date('2026-01-01'));
console.table(eclipses.map(e => ({
  date: e.date.toISOString().slice(0,10),
  type: e.type, subtype: e.subtype,
  beta: e.beta.toFixed(2), mag: e.magnitude.toFixed(2)
})));
```

Cross-check the dates against NASA eclipse lists. You should get all major solar and lunar eclipses within a day or two.
