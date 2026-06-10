# Eclipse Predictor Overlay — Cold Implementation Guide

Drop-in implementation of the Prague Astronomical Clock eclipse predictor overlay,
including the left-side toggle button that sits below your existing HUD buttons.

All five source files are in the zip alongside this guide.

Current repo note: the eclipse overlay is part of the browser app and runs in
the JS runtime. Run the app with `python3 -m http.server 8000`, then open
`http://localhost:8000`. The Rust core in `src/` is a native library/CLI and is
not wired into this overlay yet.

---

## What You Get

- **ASTRO mode** — Prague Astronomical Clock astrolabium: rotating day/night disc,
  zodiac ring, Sun ☀ and Moon ☽ arms, node markers ☊☋, eclipse zone arcs
- **DIGI mode** — terminal/oscilloscope readout: angular positions, Moon latitude
  waveform with syzygy markers, countdown to next eclipse
- **Eclipse list** — upcoming solar & lunar events with type, date, magnitude bar
- **Draggable + resizable** panel with left/right grab handles
- **Zero external dependencies** — pure canvas, pure JS modules

---

## File List (all included in zip)

```
eclipse_overlay_kit/
  ECLIPSE_OVERLAY_IMPLEMENTATION.md   ← this file
  js/
    ui/
      eclipseOverlay.js               ← the full overlay (canvas panel + both modes)
    core/
      time.js                         ← dateTimeToDate() helper — adapt to your model
      epicycle_ephemeris/
        eclipsePredictor.js           ← prediction engine (syzygy finder + classifier)
        epiCore.js                    ← math primitives (trig, time, angle helpers)
        epiParams.js                  ← Sun + Moon angular parameters at J2000.0
```

Copy the entire `js/` tree into your project. Adapt `time.js` to your model's date format
(see Step 3).

---

## How It Works (30-second concept)

Three observable sky cycles drive every prediction:

| Cycle | Period | What it tracks |
|---|---|---|
| Synodic | ~29.530 d | Moon back to same phase (New/Full) |
| Draconic | ~27.212 d | Moon back to ascending node |
| Anomalistic | ~27.555 d | Moon back to closest angular approach |

An eclipse happens when a New or Full Moon falls within ~1.5° of the Moon's
ascending node. The engine steps through time finding those coincidences.
No distances, no masses, no gravitational constants — purely angular sky geometry.

---

## Step 1 — Copy the Files

```
your-project/
  js/
    ui/
      eclipseOverlay.js         ← copy from zip
    core/
      time.js                   ← copy from zip, then edit (see Step 3)
      epicycle_ephemeris/
        eclipsePredictor.js     ← copy as-is
        epiCore.js              ← copy as-is
        epiParams.js            ← copy as-is
```

If your project already has `epiCore.js` / `epiParams.js`, check that they export
at minimum: `sind`, `cosd`, `degmod`, `degmod180`, `j2000Day`, `solveKepler`,
`trueAnomaly` (epiCore) and `SUN`, `MOON` objects with the parameters listed in
Step 6 below. If so, you don't need to copy those two files.

---

## Step 2 — Add the Button to Your Left HUD

The button lives in your existing left-side HUD element — the same place as
"Live Moon Phases" and "Live Ephemeris Data". Add it **after** those buttons
in whatever function builds your HUD (typically `buildHud()` or equivalent):

```js
// Inside buildHud(hudEl, model) — after the moon-phase wrapper is appended:

const eclipseToggleBtn = document.createElement('button');
eclipseToggleBtn.id    = 'eclipse-predictor-btn';
eclipseToggleBtn.type  = 'button';
// Match whatever CSS class your other HUD buttons use:
eclipseToggleBtn.className = 'moon-phase-header';   // or your equivalent class
eclipseToggleBtn.innerHTML = '<span class="tri"></span> ◎ Eclipse Predictor';
hudEl.appendChild(eclipseToggleBtn);
```

**Or**, if you prefer to add it directly in HTML, insert it inside your HUD div
after the existing left-panel buttons:

```html
<!-- Inside your #hud or left-panel container, after existing buttons: -->
<button id="eclipse-predictor-btn" type="button" class="moon-phase-header">
  <span class="tri"></span> ◎ Eclipse Predictor
</button>
```

The exact class name doesn't matter — just match whatever styling your other
left-panel buttons use so it looks consistent.

---

## Step 3 — Adapt `time.js` to Your Model

Open `js/core/time.js` and edit `dateTimeToDate()` to match your model's date format:

```js
// time.js — edit this function to match your model's DateTime format

export function dateTimeToDate(dt) {
  // Option A — your model stores an ISO string:
  return new Date(dt);

  // Option B — your model stores a JS Date directly:
  // return dt instanceof Date ? dt : new Date(dt);

  // Option C — your model stores Unix ms timestamp:
  // return new Date(dt);

  // Option D — your model stores { year, month, day, hour, ... }:
  // return new Date(Date.UTC(dt.year, dt.month - 1, dt.day, dt.hour ?? 0));
}
```

The overlay calls `dateTimeToDate(model.state.DateTime)` on every animation frame.
Your model object must expose: `model.state.DateTime` — any value that changes
when the simulation clock ticks.

---

## Step 4 — Wire It Into Your Main Entry Point

In your main JS file (wherever you build the UI after model + view are ready):

```js
import { buildEclipseOverlay } from './js/ui/eclipseOverlay.js';

// --- Build the overlay ---
// viewEl = the DOM element the panel will be appended to (must be position:relative)
// model  = your model object (needs model.state.DateTime)
let eclipseWrap = null;
try {
  eclipseWrap = viewEl ? buildEclipseOverlay(viewEl, model) : null;
} catch (err) {
  console.error('Eclipse overlay failed to initialise:', err);
}

// --- Wire the toggle button ---
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
    // Visual feedback — match your button's active style:
    eclipseBtn.style.outline = showing ? '' : '2px solid rgba(200,168,75,0.8)';
  });
}
```

**Important:** `buildEclipseOverlay` must be called AFTER the DOM is ready and
after `viewEl` exists. Call it in the same place you call other overlay builders.

---

## Step 5 — The Critical Bug to Avoid

`lastModelDT` **must be declared before** the `applyModeStyle` function inside
`buildEclipseOverlay`. This is already correct in the provided file — do not
move it. If you refactor `eclipseOverlay.js`, keep this ordering:

```js
// CORRECT — declaration before the function that assigns to it
let lastModelDT = null;

function applyModeStyle() {
  // ...
  lastModelDT = null;   // force redraw on mode toggle
}
applyModeStyle();       // called immediately at build time
```

Moving `let lastModelDT` below `applyModeStyle` causes:
```
ReferenceError: Cannot access 'lastModelDT' before initialization
  at applyModeStyle (eclipseOverlay.js:738)
  at buildEclipseOverlay (eclipseOverlay.js:745)
```

---

## Step 6 — What the Overlay Imports (Module Map)

```
eclipseOverlay.js
  imports from:
    ../core/epicycle_ephemeris/eclipsePredictor.js
      → findEclipses, sunLon, moonEcliptic
    ../core/epicycle_ephemeris/epiParams.js
      → MOON  (needs: N0, nnode)
    ../core/epicycle_ephemeris/epiCore.js
      → j2000Day, degmod
    ../core/time.js
      → dateTimeToDate
```

Adjust import paths if your folder structure differs. The relative paths assume
`eclipseOverlay.js` lives in `js/ui/` and the ephemeris files live in
`js/core/epicycle_ephemeris/`.

If your paths differ, update the four import lines at the top of `eclipseOverlay.js`:

```js
// eclipseOverlay.js — top of file, adjust paths to match your layout:
import { findEclipses, sunLon, moonEcliptic } from '../core/epicycle_ephemeris/eclipsePredictor.js';
import { MOON }                                from '../core/epicycle_ephemeris/epiParams.js';
import { j2000Day, degmod }                    from '../core/epicycle_ephemeris/epiCore.js';
import { dateTimeToDate }                      from '../core/time.js';
```

---

## Step 7 — Required SUN and MOON Parameters

If you already have `epiParams.js`, confirm it exports `SUN` and `MOON` with
at minimum these fields (values must be degrees / degrees-per-day at J2000.0):

```js
export const SUN = {
  nlong:  0.9856474,   // mean longitude rate °/day
  nanom:  0.9856003,   // mean anomaly rate °/day
  L0:   280.46646,     // mean longitude at J2000.0 °
  M0:   357.52911,     // mean anomaly at J2000.0 °
  ecc:    0.016709,    // deferent eccentricity
};

export const MOON = {
  nlong:  13.1763966,  // mean longitude rate °/day
  nanom:  13.0649929,  // mean anomaly rate °/day
  nnode:   0.0529539,  // node regression rate °/day  ← required for node display
  L0:   218.3165,      // mean longitude at J2000.0 °
  M0:   134.9634,      // mean anomaly at J2000.0 °
  N0:   125.0443,      // ascending node longitude at J2000.0 °  ← required
  ecc:    0.054900,
  epi:    0.054900,
  inc:    5.1454,      // orbital inclination to ecliptic °  ← required for latitude
};
```

---

## Step 8 — The `viewEl` Must Be `position: relative`

The panel is `position: absolute` inside `viewEl`. Make sure your view container
has `position: relative` (or `absolute`/`fixed`) in CSS:

```css
#view {
  position: relative;   /* required — panel positions itself inside this */
  width: 100%;
  height: 100%;
}
```

---

## Step 9 — Initial Panel Position (Left Side)

By default the overlay opens centred at the top of `viewEl`. To make it open on
the **left side** (below the HUD buttons, matching the button position), edit
the initial position in `buildEclipseOverlay` inside `eclipseOverlay.js`:

Find this block near the top of `buildEclipseOverlay` (~line 677):

```js
Object.assign(wrap.style, {
  position:  'absolute',
  top:       '60px',
  left:      '50%',
  transform: 'translateX(-50%)',
  width:     '310px',
  // ...
});
```

Change it to open on the left:

```js
Object.assign(wrap.style, {
  position:  'absolute',
  top:       '80px',     // adjust to clear your HUD buttons
  left:      '8px',      // flush with left edge
  transform: 'none',     // remove the centring transform
  width:     '310px',
  // ...
});
```

Once the user drags the panel, it sets its own `left`/`top` and clears the
`transform`, so dragging works correctly regardless of the initial position.

---

## Step 10 — Styling the Left Button

Add CSS to match your existing left-panel buttons. Minimal example:

```css
/* Eclipse predictor button — sits below Live Moon Phases / Live Ephemeris */
#eclipse-predictor-btn {
  display: block;
  width: 100%;
  padding: 4px 10px;
  background: rgba(6, 8, 20, 0.88);
  color: #dfc87a;
  border: none;
  border-top: 1px solid rgba(200,168,75,0.18);
  text-align: left;
  font-size: 11px;
  cursor: pointer;
  letter-spacing: 0.06em;
}
#eclipse-predictor-btn:hover {
  background: rgba(20, 25, 60, 0.92);
}
```

Or simply give it the same class as your existing collapsible HUD headers
(`moon-phase-header` in the reference codebase) and it will inherit their styling.

---

## Accuracy Notes

- Solar eclipse dates: correct to **~1 day** (time of day to ~1–3 hours)
- Lunar eclipse dates: similar; penumbral events most sensitive to Moon latitude error
- Prediction window: 2 years forward from current model date (up to 12 events shown)
- The model is purely angular — it does not predict eclipse totality paths or contact times

---

## Quick Console Test

After wiring in, open the browser console and run:

```js
import('/js/core/epicycle_ephemeris/eclipsePredictor.js').then(m => {
  const eclipses = m.findEclipses(new Date('2024-01-01'), new Date('2026-01-01'));
  console.table(eclipses.map(e => ({
    date:    e.date.toISOString().slice(0,10),
    type:    e.type,
    subtype: e.subtype,
    beta:    e.beta.toFixed(2) + '°',
    mag:     e.magnitude.toFixed(2),
  })));
});
```

Cross-check dates against published eclipse lists. You should get all major
solar and lunar eclipses within a day or two.
