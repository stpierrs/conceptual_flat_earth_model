# Epicycle Ephemeris — Living Handoff Document

**Repo:** `stpierrs/conceptual_flat_earth_model`
**Live site:** `https://stpierrs.github.io/conceptual_flat_earth_model/`
**Module path:** `js/core/epicycle_ephemeris/`
**Dispatcher:** `js/core/ephemeris.js`

This document is the running context file for this ephemeris. Feed it to a fresh
Claude instance to continue development without losing context.

---

## What This Is

A custom pure-epicycle / pure-geometric ephemeris pipeline built for Shane's FE
Conceptual Model. It is **self-contained, novel, and exportable** — the goal is to
eventually package it as a standalone module.

Key properties:
- No globe radius, no AU as a physical unit, no gravitational constant
- All motion is angular accumulation from J2000.0 epoch
- The "heliocentric" stage is just a direction vector subtraction — geometrically
  identical to Ptolemy's deferent+epicycle
- Output: `{ ra, dec }` in radians — observer-centered angular direction only
- Calibrated against JPL DE405 (2019–2024) for the 7 classical planets

---

## File Structure

```
js/core/epicycle_ephemeris/
  epiCore.js                  Math primitives (trig, Julian Day, Kepler, ecliptic→equatorial)
  epiParams.js                All orbital constants + star catalogues
  ephemerisEpicycle.js        Phase 1 — single-circle pipeline (PRIMARY)
  ephemerisEpicycle2.js       Phase 2 — two-circle Ibn al-Shatir pipeline
  ephemerisEpiTablesRuntime.js Phase 3 runtime stub (needs ephemerisEpiTables.js to work)
  buildEpiTables.mjs          Generator: node buildEpiTables.mjs 1800 2200
  phase3Calibrate.mjs         DE405 calibration optimizer (Nelder-Mead)
  fetchDE405.mjs              Fetches DE405 reference data from astropixels.com
  parseDE405.mjs              Parses cached DE405 HTML into JSON
  epiTest.mjs                 Smoke test: node epiTest.mjs
  epiValidate.mjs             Error comparison vs Meeus reference
  ephemeris_integration_patch.js  Integration notes (readable comments)
  README.md                   Architecture overview
  HANDOFF.md                  This file — update with every session
```

---

## How It's Wired Into the Model

**`js/core/ephemeris.js`** is the dispatcher. It imports:
```js
import * as epi1 from './epicycle_ephemeris/ephemerisEpicycle.js';
import * as epi2 from './epicycle_ephemeris/ephemerisEpicycle2.js';
```

Pipeline registry key → module:
- `'epicycle'`  → epi1  (default)
- `'epicycle2'` → epi2
- `'ptolemy'`   → existing Ptolemy pipeline (fallback of last resort)
- `'astropixels'` → DE405 table (eclipse demos only, not user-selectable)

Fallback chain: `epicycle → ptolemy`

Default `BodySource` in `app.js`: `'epicycle'`

UI dropdown in `controlPanel.js` shows: Epicycle-1 / Epicycle-2 / Ptolemy

---

## Bodies Covered

### Solar system bodies
| Body | Pipeline | Notes |
|------|----------|-------|
| Sun | epi1/epi2 | Two-term equation of centre |
| Moon | epi1/epi2 | Eccentric deferent, no evection yet |
| Mercury | epi1/epi2 | DE405-calibrated L0, M0, nanom |
| Venus | epi1/epi2 | DE405-calibrated |
| Mars | epi1/epi2 | DE405-calibrated; Epi-2 adds 2nd circle |
| Jupiter | epi1/epi2 | DE405-calibrated |
| Saturn | epi1/epi2 | DE405-calibrated |
| Uranus | epi1/epi2 | Not yet calibrated vs DE405 |
| Neptune | epi1/epi2 | Not yet calibrated vs DE405 |
| **Pluto** | epi1/epi2 | Added Chunk 1. Not calibrated. ~3–5° accuracy |
| **Ceres** | epi1/epi2 | Added Chunk 1. Not calibrated |
| **Pallas** | epi1/epi2 | Added Chunk 1. Not calibrated |
| **Juno** | epi1/epi2 | Added Chunk 1. Not calibrated |
| **Vesta** | epi1/epi2 | Added Chunk 1. Not calibrated |

### Fixed stars (all J2000.0 RA/Dec from HYG v4.1)
- `ZODIAC_STARS` — 16 entries (one per zodiac constellation + Ophiuchus)
- `ECLIPTIC_GUIDE_STARS` — 8 entries (Alcyone, Ain, Asellus, Vindemiatrix, etc.)
- `BRIGHT_STARS` — **40 entries added Chunk 1**: Sirius, Canopus, Arcturus, Vega,
  Capella, Rigel, Procyon, Betelgeuse, Altair, Deneb, Polaris, Acrux, Mimosa,
  Gacrux (Southern Cross), Big Dipper stars, Orion belt, navigation stars, etc.

**Total fixed stars: 64**

---

## Accuracy (Calibrated vs JPL DE405, 2019–2024)

| Body | Epi-1 RMS | Epi-2 RMS | Notes |
|------|-----------|-----------|-------|
| Sun | 0.01° | 0.01° | Excellent |
| Saturn | 0.74° | 0.74° | Sub-degree |
| Venus | 0.69° | 0.69° | Sub-degree |
| Jupiter | 1.96° | 1.96° | Systematic offset |
| Mercury | 2.54° | 2.54° | Large eccentricity |
| Moon | ~15–20' | ~15–20' | Evection + variation + annual eq + 2nd anomaly |
| Mars | 6.59° | **4.18°** | Epi-2 helps; Jupiter perturbation limits |
| Uranus | ~2–3° | ~2–3° | Uncalibrated |
| Neptune | ~1–2° | ~1–2° | Uncalibrated |
| Pluto | ~3–5° | ~3–5° | Uncalibrated, high ecc |
| Asteroids | ~1–3° | ~1–3° | Uncalibrated |

---

## Key Calibration Facts (DO NOT REVERT)

1. **Venus `nanom` = heliocentric rate (1.6021291 °/day = 360/224.701 days)**
   Using synodic rate causes ±100° error near inferior conjunction.

2. **Mercury `nanom` = heliocentric rate (4.0923507 °/day = 360/87.969 days)**
   Same issue — synodic rate causes massive errors.

3. **L₀ corrections baked into `epiParams.js`** (fitted vs DE405):
   - Mars: +7.65°, Jupiter: −7.69°, Saturn: −5.12°, Venus: −4.26°, Mercury: −0.34°

4. **M₀ corrections**: Venus M₀ = 134.92°, Mercury M₀ = 171.29° (not Meeus Table 31.a values)

---

## Orbital Element Sources

| Body | Source | Calibrated? |
|------|--------|-------------|
| Sun, Moon | Meeus Ch.25/47 + DE405 fit | Yes |
| Mercury–Saturn | Meeus Table 31.a + DE405 fit | Yes |
| Uranus, Neptune | Meeus Table 31.a | No |
| Pluto | Meeus (approximate J2000) | No |
| Ceres, Pallas, Juno, Vesta | JPL Small-Body Database J2000 | No |
| Fixed stars | HYG v4.1 catalogue | N/A |

---

## Session History

### Session 1 (2026-05-13) — Shane's local build
- Built epiCore.js, epiParams.js, ephemerisEpicycle.js, ephemerisEpicycle2.js
- Phase 3 calibration against DE405 (2019–2024, 2192 rows/body)
- Fitted L0/M0/nanom corrections for Mercury, Venus, Mars, Jupiter, Saturn

### Session 2 (2026-05-16) — Wiring + Chunk 1 expansion
- Wired both pipelines into `js/core/ephemeris.js`
- Changed default BodySource from `'ptolemy'` to `'epicycle'`
- Added UI dropdown entries and info-bar labels for Epicycle-1/2
- **Added bodies:** Pluto, Ceres, Pallas, Juno, Vesta
- **Added 40 bright/navigation stars** (BRIGHT_STARS array in epiParams.js)
- Total star catalogue: 64 fixed stars
- Pushed to master, live at stpierrs.github.io

### Session 3 (2026-05-16) — Chunk 2: Moon perturbations + Jupiter-Saturn great inequality
- **Moon (both epi1 and epi2):** Added 4 classical perturbation terms to `moonEquatorial()`:
  - Evection `+1.274° sin(2D − M)` — Ptolemy's prosneusis (largest term)
  - Variation `+0.658° sin(2D)` — Tycho Brahe
  - Annual equation `−0.186° sin(Ms)` — Kepler
  - Second anomaly `+0.214° sin(2M)` — Ptolemy's second epicycle
  - Expected Moon accuracy: ~1° → ~15–20 arcmin
- **Jupiter-Saturn great inequality (both epi1 and epi2):**
  - 2:5 near-resonance argument: `gi = 2λ_J − 5λ_S`
  - Jupiter correction: `+0.549° sin(gi + 174°)`
  - Saturn correction: `−0.870° sin(gi + 148°)`
  - Applied as `lonCorr` in `outerBody()` / `outerBody2()`
- **epi2:** Added `lonCorr = 0` parameter to `outerBody2()`, plumbed through Jupiter/Saturn cases

---

## Planned Future Work (Priority Order)

### ~~Chunk 2~~ — DONE (Session 3)
Moon perturbations + Jupiter-Saturn great inequality — both pipelines updated.

### Chunk 3 — Accuracy: Mars perturbation series
- Jupiter perturbation on Mars (~2° amplitude):
  `+0.273° sin(5λ_J − 2λ_M − 2.828°)` + several more terms
- Target: Mars from 6.6° → ~1° (matching Meeus Ch.33)
- Implement as additive corrections in `outerBody()` for Mars specifically

### Chunk 4 — Accuracy: Jupiter-Saturn great inequality
- Great inequality period ~918 years, amplitude ~0.55° on Jupiter, ~0.9° on Saturn
- Terms: `A sin(2λ_J − 5λ_S + φ)` for both bodies
- Target: Jupiter from 1.96° → <0.5°, Saturn from 0.74° → <0.3°

### Chunk 5 — Accuracy: Secular terms
- Add T² corrections to mean motions for better long-range accuracy
- Currently valid to ~±50 years from J2000; secular terms extend to ±200 years

### Chunk 6 — DE405 calibration for new bodies
- Run `fetchDE405.mjs` / `phase3Calibrate.mjs` for Uranus, Neptune
- Calibrate L0/M0 for Ceres, Vesta (Pluto/Pallas/Juno: DE405 not available from astropixels)

### Chunk 7 — More bodies
- Chiron (2060 Chiron) — centaur, a = 13.7 AU, notable in FE discussions
- More main-belt asteroids: Hygiea (10), Interamnia (704)
- Lunar apsides: expose perigee/apogee as trackable points

---

## API Contract (Every Pipeline Must Export)

```js
export function bodyGeocentric(name, date) // → { ra, dec } in radians; NaN if not covered
export function coversBody(name)           // → boolean
export function coversDate(date)           // → boolean
export const SUPPORTED_BODIES             // Set<string>
export const BUILTIN_CORRECTIONS          // { precession, nutation, aberration, fk5 }
export const PIPELINE_LABEL              // string shown in UI
export const PIPELINE_ID                 // string used as key
```

Body name strings: `'sun'`, `'moon'`, `'mercury'`, `'venus'`, `'mars'`,
`'jupiter'`, `'saturn'`, `'uranus'`, `'neptune'`, `'pluto'`,
`'ceres'`, `'pallas'`, `'juno'`, `'vesta'`,
plus star IDs from ZODIAC_STARS, ECLIPTIC_GUIDE_STARS, BRIGHT_STARS.

---

## Technical Notes for Future Claude Instances

- `outerBody(t, p)` in `ephemerisEpicycle.js` handles all bodies with `a > 1 AU`
  (plus the inner ones via `innerBody`). Adding a new outer body = add constants
  to `epiParams.js` + one case in the switch + one entry in `SUPPORTED_BODIES`.

- Perturbation terms should be added as **additive corrections to geocentric
  longitude** after the main vector subtraction — they are literally additional
  small epicycles. Keep them in the same function, clearly labelled.

- The `eqCenter()` approximation loses accuracy for `ecc > 0.15`. Pluto (ecc=0.249)
  and Pallas (ecc=0.231) will benefit from replacing `eqCenter` with `solveKepler`
  + `trueAnomaly` from `epiCore.js` when calibrating those bodies.

- Star positions should NOT be precessed inside this module — the model's existing
  precession toggle rotates the whole starfield. The `BRIGHT_STARS` / `ZODIAC_STARS`
  arrays return raw J2000.0 positions.

- To add a new pipeline (e.g., VSOP87 wrapper): follow the API contract above and
  add to `PIPES` and `FALLBACK_ORDER` in `js/core/ephemeris.js`.
