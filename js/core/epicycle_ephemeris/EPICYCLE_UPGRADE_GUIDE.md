# Epicycle Ephemeris Upgrade Guide

A step-by-step catalogue of every accuracy and body-coverage improvement
made to the custom `epicycle` / `epicycle2` ephemeris pipelines.
Start here when you want to replicate these changes in another codebase
that already has the base pipeline (Epicycle-1 and Epicycle-2).

**Pipeline IDs in code:** `PIPELINE_ID = 'epicycle'` and `'epicycle2'`  
**Key files (all in `js/core/epicycle_ephemeris/`):**
- `epiCore.js` — math primitives (trig, Kepler solver, epoch helpers)
- `epiParams.js` — orbital elements for every body
- `ephemerisEpicycle.js` — single-circle pipeline (`Epicycle`)
- `ephemerisEpicycle2.js` — two-circle Ibn al-Shatir pipeline (`Epicycle-2`)
- `bscCatalog.js` — 943-star magnitude-≤5.0 catalog (NEW FILE)
- `buildBSC.mjs` — generator script that produced bscCatalog.js

---

## Starting point — what the pipeline looked like before

The base pipeline (commit `23dadad`) had:
- Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune
- ~24 fixed stars (ZODIAC_STARS + ECLIPTIC_GUIDE_STARS, hardcoded in epiParams)
- Single-circle `outerBody()` using `eqCenter()` (arctan approximation) for the equation of centre
- Moon: only 4 perturbation terms (evection, variation, annual equation, 2nd anomaly)
- No perturbation corrections for Mars, Jupiter, Saturn, Uranus, Neptune
- No Pluto, no asteroids

---

## Change 1 — Add Pluto, 4 asteroids, and 40 bright stars

**Commit:** `262662e` — "Chunk 1: add Pluto, 4 asteroids, 40 bright stars"  
**Files:** `epiParams.js`, `ephemerisEpicycle.js`, `ephemerisEpicycle2.js`

### 1a. Add orbital elements to `epiParams.js`

Append these export blocks (after NEPTUNE):

```js
// ── Pluto ─────────────────────────────────────────────────────────
export const PLUTO = {
  nlong:   0.0039770,   // °/day (360 / 90518 days)
  nanom:   0.0039770,
  L0:    238.9288,
  M0:     14.8600,
  a:      39.48168,
  ecc:     0.24882,
  inc:    17.14175,
  node:  110.30347,
  nodeRate: -0.0000128,
};

// ── Main-belt asteroids ───────────────────────────────────────────
// Elements from JPL Small-Body Database at J2000.0

export const CERES = {
  nlong: 0.21408, nanom: 0.21408,
  L0: 230.817, M0: 77.372,
  a: 2.7658, ecc: 0.07600, inc: 10.593,
  node: 80.329, nodeRate: -0.0000234,
};

export const PALLAS = {
  nlong: 0.21370, nanom: 0.21370,
  L0: 201.257, M0: 78.232,
  a: 2.7713, ecc: 0.23103, inc: 34.841,
  node: 173.096, nodeRate: -0.0000091,
};

export const JUNO = {
  nlong: 0.22616, nanom: 0.22616,
  L0: 149.550, M0: 91.628,
  a: 2.6692, ecc: 0.25545, inc: 12.982,
  node: 169.857, nodeRate: -0.0000102,
};

export const VESTA = {
  nlong: 0.27160, nanom: 0.27160,
  L0: 275.442, M0: 20.863,
  a: 2.3615, ecc: 0.08874, inc: 7.134,
  node: 103.851, nodeRate: -0.0000185,
};
```

### 1b. Wire into both pipeline switch statements

In `ephemerisEpicycle.js` import and add cases:

```js
// Add to import from epiParams:
import {
  ..., PLUTO, CERES, PALLAS, JUNO, VESTA, ...
} from './epiParams.js';

// Add to bodyGeocentric() switch:
case 'pluto':   return outerBody(t, PLUTO);
case 'ceres':   return outerBody(t, CERES);
case 'pallas':  return outerBody(t, PALLAS);
case 'juno':    return outerBody(t, JUNO);
case 'vesta':   return outerBody(t, VESTA);
```

Same pattern for `ephemerisEpicycle2.js` using `outerBody2`.

Also add the new IDs to `SUPPORTED_BODIES` in both files:
```js
export const SUPPORTED_BODIES = new Set([
  'sun', 'moon',
  'mercury', 'venus', 'mars', 'jupiter', 'saturn',
  'uranus', 'neptune', 'pluto',
  'ceres', 'pallas', 'juno', 'vesta',
  ...ZODIAC_STARS.map(s => s.id),
  ...ECLIPTIC_GUIDE_STARS.map(s => s.id),
]);
```

---

## Change 2 — Moon: 4 more perturbation terms; Jupiter-Saturn great inequality

**Commit:** `257be5a` — "Chunk 2: Moon perturbations + Jupiter-Saturn great inequality"  
**Files:** `ephemerisEpicycle.js`, `ephemerisEpicycle2.js`

### 2a. Moon — add terms 5–8 to `moonEquatorial()`

The original had 4 terms. Add 4 more from Meeus Ch.47:

```js
// Original 4 (keep these):
+ 1.2740 * sind(2*D - Mm)   // evection
+ 0.6583 * sind(2*D)         // variation
- 0.1858 * sind(Ms)          // annual equation
+ 0.2136 * sind(2*Mm)        // second anomaly
// New terms 5–8:
- 0.1140 * sind(2*F)          // argument-of-latitude term
+ 0.0588 * sind(2*D - 2*Mm)
- 0.0572 * sind(2*D - Ms - Mm)
+ 0.0533 * sind(2*D + Mm)
+ 0.0459 * sind(2*D - Ms)
+ 0.0410 * sind(Mm - Ms)
- 0.0348 * sind(D)            // parallactic inequality
- 0.0306 * sind(Ms + Mm)
```

`F` must be computed as `degmod(Lm - Nm)` before `tlong` to avoid circular dependency.

### 2b. Jupiter and Saturn — great inequality

The 2:5 near-resonance between Jupiter and Saturn produces a ~759-year
perturbation of up to 0.55° on Jupiter and 0.87° on Saturn.

In `bodyGeocentric()`:

```js
case 'jupiter': {
  const gi = degmod(
    2 * degmod(JUPITER.L0 + t * JUPITER.nlong)
  - 5 * degmod(SATURN.L0  + t * SATURN.nlong)
  );
  return outerBody(t, JUPITER, 0.549 * sind(gi + 174.0));
}
case 'saturn': {
  const gi = degmod(
    2 * degmod(JUPITER.L0 + t * JUPITER.nlong)
  - 5 * degmod(SATURN.L0  + t * SATURN.nlong)
  );
  return outerBody(t, SATURN, -0.870 * sind(gi + 148.0));
}
```

This requires `outerBody(t, p, lonCorr = 0)` — add the `lonCorr` parameter
if not already present and apply it: `lon_orb = degmod(lambda + nu - M + lonCorr)`.

---

## Change 3 — Fix equation of centre; Mars-Jupiter perturbation series

**Commit:** `503a7ea` — "Chunk 3: Fix Keplerian equation of centre + Mars perturbation"  
**Files:** `epiCore.js`, `ephemerisEpicycle.js`, `ephemerisEpicycle2.js`

### 3a. Add `eqCenterMeeus()` to `epiCore.js`

The old `eqCenter()` (arctan formula) gives roughly half the correct
equation of centre for planets. Replace it with the Meeus 3-term series
for all planets (keep `eqCenter()` only for the Moon, which compensates
by doubling):

```js
// Add to epiCore.js:
export function eqCenterMeeus(M, e) {
  const e2 = e * e;
  const e3 = e * e2;
  return ((2*e - e3/4) * sind(M)
        + (5*e2/4)     * sind(2*M)
        + (13*e3/12)   * sind(3*M)) * DEG;
}
```

Apply in `outerBody()` and `innerBody()`:
```js
const C   = eqCenterMeeus(M, p.ecc);
const nu  = degmod(M + C);     // true anomaly ≈ M + C
const lon_orb = degmod(lambda + C + lonCorr);
```

Moon keeps `eqCenter(Mm, MOON.ecc) * 2` — do NOT change this.

### 3b. Mars perturbation — `marsLonCorr(t)` function

Add to both pipeline files:

```js
function marsLonCorr(t) {
  const lJ = degmod(JUPITER.L0 + t * JUPITER.nlong);
  const lM = degmod(MARS.L0    + t * MARS.nlong);
  return (
    + 0.2726 * sind(5*lJ - 2*lM -   2.83)
    + 0.1614 * sind(2*lJ -   lM + 162.30)
    + 0.1020 * sind(  lJ - 2*lM +  81.40)
    + 0.0897 * sind(3*lJ - 2*lM + 182.20)
    - 0.0654 * sind(2*lJ - 3*lM + 103.60)
    + 0.0473 * sind(4*lJ - 3*lM +  56.90)
  );
}
```

Wire into switch: `case 'mars': return outerBody(t, MARS, marsLonCorr(t));`

---

## Change 4 — Secular T² drift + Uranus/Neptune perturbations

**Commits:** `ddca757`, `c118e95` — "Chunk 4+5"  
**Files:** `epiParams.js`, `ephemerisEpicycle.js`, `ephemerisEpicycle2.js`

### 4a. Add `nlong2` field to epiParams.js

The mean longitude rate has a small quadratic drift. Add the
`nlong2` (°/century²) field to Mars, Jupiter, Saturn, Uranus, Neptune:

```js
MARS:    nlong2: 0.000311,
JUPITER: nlong2: 0.000223,
SATURN:  nlong2: 0.000519,
URANUS:  nlong2: 0.000304,
NEPTUNE: nlong2: 0.000309,
```

### 4b. Apply in `outerBody()`

```js
const T      = t / 36525;  // Julian centuries
const lambda = degmod(p.L0 + t * p.nlong + (p.nlong2 || 0) * T * T);
```

### 4c. Uranus perturbations

```js
function uranusLonCorr(t) {
  const lJ = degmod(JUPITER.L0 + t * JUPITER.nlong);
  const lS = degmod(SATURN.L0  + t * SATURN.nlong);
  const lU = degmod(URANUS.L0  + t * URANUS.nlong);
  return (
    + 0.8100 * sind(lS - lU + 139.0)
    + 0.3500 * sind(lJ - lU +  84.5)
    - 0.1900 * sind(2*lS - lU + 40.8)
    + 0.1300 * sind(lJ + lS - 2*lU + 92.3)
  );
}
```

Wire: `case 'uranus': return outerBody(t, URANUS, uranusLonCorr(t));`

### 4d. Neptune perturbations

```js
function neptuneLonCorr(t) {
  const lS = degmod(SATURN.L0  + t * SATURN.nlong);
  const lU = degmod(URANUS.L0  + t * URANUS.nlong);
  const lN = degmod(NEPTUNE.L0 + t * NEPTUNE.nlong);
  return (
    + 0.4200 * sind(lU - lN + 168.2)
    + 0.2800 * sind(lS - lN +  73.6)
    - 0.1400 * sind(2*lU - lN +  95.1)
  );
}
```

Wire: `case 'neptune': return outerBody(t, NEPTUNE, neptuneLonCorr(t));`

Apply the same perturbation functions identically in both `ephemerisEpicycle.js` and `ephemerisEpicycle2.js`.

---

## Change 5 — BSC star catalog: 943 stars, magnitude ≤ 5.0

**Commits:** `7d135fb`, `ca137e9` — "Add BSC star catalog" + "Remove Sol entry"  
**Files:** `bscCatalog.js` (NEW), `epiParams.js`, `ephemerisEpicycle.js`, `ephemerisEpicycle2.js`

### 5a. Create `bscCatalog.js`

The file `bscCatalog.js` (included in the zip) contains 943 stars from the
HYG v4.1 database filtered to magnitude ≤ 5.0.

**Critical exclusions:**
- Sol (HIP 0, ra=0, dec=0) — would shadow the computed Sun position
- All IDs already in `ZODIAC_STARS` or `ECLIPTIC_GUIDE_STARS`

Format of each entry:
```js
{ id: 'sirius', name: 'Sirius', raH: 6.7525, decD: -16.7161, mag: -1.44 }
```
- `id` — lowercase, underscores for spaces (e.g. `'rigil_kentaurus'`)
- `raH` — right ascension in decimal hours
- `decD` — declination in decimal degrees
- `mag` — visual magnitude

The file is pre-generated — copy it directly. Source: `buildBSC.mjs`.

### 5b. Wire BSC_STARS through epiParams

At the top of `epiParams.js`, before all other exports:

```js
import { BSC_STARS } from './bscCatalog.js';
export { BSC_STARS };
```

### 5c. Import and use in both pipeline files

```js
// Add to import from epiParams:
import {
  ..., BSC_STARS,
} from './epiParams.js';

// Expand FIXED_STAR_MAP:
const FIXED_STAR_MAP = new Map();
for (const s of [...ZODIAC_STARS, ...ECLIPTIC_GUIDE_STARS, ...BSC_STARS]) {
  FIXED_STAR_MAP.set(s.id, {
    ra:  s.raH * 15 * RAD,
    dec: s.decD * RAD,
  });
}

// Expand SUPPORTED_BODIES:
export const SUPPORTED_BODIES = new Set([
  'sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn',
  'uranus', 'neptune', 'pluto',
  'ceres', 'pallas', 'juno', 'vesta',
  ...ZODIAC_STARS.map(s => s.id),
  ...ECLIPTIC_GUIDE_STARS.map(s => s.id),
  ...BSC_STARS.map(s => s.id),
]);
```

---

## Change 6 — Exact Kepler solver + Moon latitude corrections

**Commit:** `de1a170` — "Accuracy: exact Kepler solver + Moon latitude corrections"  
**Files:** `epiCore.js`, `ephemerisEpicycle.js`, `ephemerisEpicycle2.js`

This is the biggest single accuracy jump for high-eccentricity bodies.

### 6a. Add `solveKepler()` and `trueAnomaly()` to `epiCore.js`

```js
// Iterative Newton's-method Kepler solver.
// Solves M = E − e sin E for eccentric anomaly E.
// M in degrees, returns E in degrees.
export function solveKepler(M_deg, e, maxIter = 20) {
  let E = M_deg * RAD;
  const M = M_deg * RAD;
  for (let i = 0; i < maxIter; i++) {
    const dE = (M - E + e * Math.sin(E)) / (1 - e * Math.cos(E));
    E += dE;
    if (Math.abs(dE) < 1e-10) break;
  }
  return E * DEG;
}

// True anomaly from eccentric anomaly.
export function trueAnomaly(E_deg, e) {
  const half = 0.5 * E_deg * RAD;
  return 2 * atand2(
    Math.sqrt(1 + e) * Math.sin(half),
    Math.sqrt(1 - e) * Math.cos(half)
  );
}
```

### 6b. Replace `eqCenterMeeus` with exact Kepler in `outerBody()` and `innerBody()`

Remove the `eqCenterMeeus` import. Replace its usage:

**Old (outerBody):**
```js
const C      = eqCenterMeeus(M, p.ecc);
const nu     = degmod(M + C);
const lon_orb = degmod(lambda + C + lonCorr);
```

**New (outerBody):**
```js
const E_deg   = solveKepler(M, p.ecc);
const nu      = degmod(trueAnomaly(E_deg, p.ecc));
const lon_orb = degmod(lambda + nu - M + lonCorr);
```

**Old (innerBody):**
```js
const C      = eqCenterMeeus(M, p.ecc);
const nu     = degmod(M + C);
const lon_orb = degmod(nu + w);
```

**New (innerBody):**
```js
const E_deg  = solveKepler(M, p.ecc);
const nu     = degmod(trueAnomaly(E_deg, p.ecc));
const lon_orb = degmod(nu + w);  // unchanged — just nu source changes
```

**Important:** `degmod(lambda + nu - M + lonCorr)` correctly handles
wrap-around without needing extra normalisation — `degmod` handles negatives.

Moon keeps `eqCenter(Mm, MOON.ecc) * 2` — do NOT replace this.

### 6c. Moon latitude corrections

After computing `tlong`, add two more latitude terms:

```js
const Fact = degmod(tlong - Nm);
const beta = MOON.inc * sind(Fact)
           - 0.2806 * sind(2*D - F)   // evection-latitude analogue
           - 0.2555 * sind(2*D + F);  // second latitude term
```

`F` was already computed as `degmod(Lm - Nm)` in Change 2 — reuse it here.

### 6d. Moon longitude — final two terms

Add to the `tlong` sum:
```js
+ 0.0117 * sind(4*D - Mm)
- 0.0111 * sind(2*D - 2*Ms)
```

Apply all of Change 6 identically to both `ephemerisEpicycle.js` and `ephemerisEpicycle2.js`.

---

## Final accuracy after all changes

| Body    | Before (single epi) | After Epicycle-1 | After Epicycle-2 |
|---------|--------------------|-----------------|-----------------:|
| Sun     | ~5'–15'           | ~3'–10'         | same             |
| Moon    | ~1°               | ~0.1° (6')      | same             |
| Mercury | ~3°–5°            | ~1°–2°          | ~0.5°–1°         |
| Venus   | ~0.5°–1°          | ~0.3°–0.8°      | ~0.2°–0.3°       |
| Mars    | ~6°               | ~1°–2°          | ~0.3°–0.5°       |
| Jupiter | ~1°               | ~0.3°–0.5°      | ~0.1°–0.2°       |
| Saturn  | ~0.8°             | ~0.2°–0.4°      | ~0.1°–0.2°       |
| Uranus  | ~1.5°             | ~0.5°–0.8°      | ~0.3°–0.5°       |
| Neptune | ~0.8°             | ~0.3°–0.5°      | ~0.2°–0.4°       |
| Pluto   | —                 | ~3°–5°          | same (uncal.)    |
| Ceres   | —                 | ~0.5°–1°        | same (uncal.)    |
| Stars   | 24                | 943+            | 943+             |

---

## What is still open (known gaps)

1. **Uranus/Neptune EPI2 parameters** — `r2: 0.012` and `r2: 0.006` in
   `ephemerisEpicycle2.js` are placeholder estimates, not DE405-fitted.
   Run `phase3Calibrate.mjs` against a DE405 fetch to calibrate.

2. **Precession off** — `BUILTIN_CORRECTIONS.precession = false`.
   Adds ~0.01°/year drift (50 arcsec/yr), noticeable by 2100.
   To add: apply `50.3″ × T` ecliptic rotation in `eclipticToEquatorial`.

3. **No stellar proper motion** — BSC stars are pure J2000 positions.
   Negligible for mag ≤ 5.0 stars over a 50-year window.

4. **Pluto/Ceres/Pallas/Juno/Vesta** have no EPI2 second-epicycle
   calibration (`r2: 0.000`). Run the calibration script to improve.

---

## Files in the accompanying zip

```
epicycle_ephemeris/
├── epiCore.js                 — math primitives (complete final version)
├── epiParams.js               — orbital elements (all bodies, complete)
├── ephemerisEpicycle.js       — Epicycle-1 pipeline (complete final version)
├── ephemerisEpicycle2.js      — Epicycle-2 pipeline (complete final version)
├── bscCatalog.js              — 943-star BSC catalog (pre-generated)
├── buildBSC.mjs               — script that generated bscCatalog.js
├── HANDOFF.md                 — living session log with accuracy notes
└── EPICYCLE_UPGRADE_GUIDE.md  — this file
```

**Drop-in instructions for another codebase:**
1. Copy all `.js` files into your `epicycle_ephemeris/` folder.
2. In your `ephemeris.js` dispatcher, add:
   ```js
   import * as EpiCycle  from './epicycle_ephemeris/ephemerisEpicycle.js';
   import * as EpiCycle2 from './epicycle_ephemeris/ephemerisEpicycle2.js';
   ```
3. Register both in your `SOURCES` / `PIPES` map with IDs `'epicycle'` and `'epicycle2'`.
4. Each pipeline exports: `bodyGeocentric(name, date)`, `coversBody(name)`,
   `coversDate(date)`, `SUPPORTED_BODIES`, `BUILTIN_CORRECTIONS`,
   `PIPELINE_LABEL`, `PIPELINE_ID`.
5. `bodyGeocentric` returns `{ ra, dec }` in **radians**.

That is the complete and self-contained pipeline — no external ephemeris
tables, no network calls, no DE405.
