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
- Calibrated against observed positions (2019–2024) for the 7 classical planets

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
  phase3Calibrate.mjs         Calibration optimizer (Nelder-Mead)
  fetchsky-reference.mjs              Fetches reference data from sky-observations
  parsesky-reference.mjs              Parses cached reference HTML into JSON
  epiTest.mjs                 Smoke test: node epiTest.mjs
  epiValidate.mjs             Error comparison vs reference positions
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
| Mercury | epi1/epi2 | calibrated L0, M0, nanom |
| Venus | epi1/epi2 | calibrated |
| Mars | epi1/epi2 | calibrated; Epi-2 adds 2nd circle |
| Jupiter | epi1/epi2 | calibrated |
| Saturn | epi1/epi2 | calibrated |
| Uranus | epi1/epi2 | not yet calibrated |
| Neptune | epi1/epi2 | not yet calibrated |
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

## Accuracy (Calibrated, 2019–2024)

| Body | Epi-1 RMS | Epi-2 RMS | Notes |
|------|-----------|-----------|-------|
| Sun | 0.01° | 0.01° | Excellent |
| Saturn | 0.74° | 0.74° | Sub-degree |
| Venus | 0.69° | 0.69° | Sub-degree |
| Jupiter | 1.96° | 1.96° | Systematic offset |
| Mercury | 2.54° | 2.54° | Large eccentricity |
| Moon | ~15–20' | ~15–20' | Evection + variation + annual eq + 2nd anomaly |
| Mars | ~1–2°* | ~0.5–1°* | *Chunk 3: equation-of-centre + Jupiter terms; post-fix estimate |
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

3. **L₀ corrections baked into `epiParams.js`** (fitted):
   - Mars: +7.65°, Jupiter: −7.69°, Saturn: −5.12°, Venus: −4.26°, Mercury: −0.34°

4. **M₀ corrections**: Venus M₀ = 134.92°, Mercury M₀ = 171.29° (not standard J2000 orbital elements values)

5. **`eqCenter()` is NOT used for planets** — only for Moon (×2 kludge). All planets use
   `eqCenterSeries()` (Chunk 3). The arctan formula gives ~half the Keplerian equation of
   center; switching to equation-of-centre series gives the correct 2e sinM + ... expansion.

---

## Orbital Element Sources

| Body | Source | Calibrated? |
|------|--------|-------------|
| Sun, Moon | standard astronomical series | Yes |
| Mercury–Saturn | standard J2000 orbital elements | Yes |
| Uranus, Neptune | standard J2000 orbital elements | No |
| Pluto | approximate J2000 | No |
| Ceres, Pallas, Juno, Vesta | J2000 orbital elements | No |
| Fixed stars | HYG v4.1 catalogue | N/A |

---

## Session History

### Session 1 (2026-05-13) — Shane's local build
- Built epiCore.js, epiParams.js, ephemerisEpicycle.js, ephemerisEpicycle2.js
- Phase 3 calibration (2019–2024, 2192 rows/body)
- Fitted L0/M0/nanom corrections for Mercury, Venus, Mars, Jupiter, Saturn

### Session 2 (2026-05-16) — Wiring + Chunk 1 expansion
- Wired both pipelines into `js/core/ephemeris.js`
- Changed default BodySource from `'ptolemy'` to `'epicycle'`
- Added UI dropdown entries and info-bar labels for Epicycle-1/2
- **Added bodies:** Pluto, Ceres, Pallas, Juno, Vesta
- **Added 40 bright/navigation stars** (BRIGHT_STARS array in epiParams.js)
- Total star catalogue: 64 fixed stars
- Pushed to master, live at stpierrs.github.io

### Session 3 (2026-05-16) — Chunk 2 + Chunk 3
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

**Chunk 3 — equation-of-centre + Mars perturbation series (both pipelines)**
- **Root cause found:** `eqCenter()` (arctan approximation) gives ~half the Keplerian equation
  of center. For Mars (e=0.093) this was a ~5.3° peak error, explaining the 6.59° RMS.
  The arctan formula is Ptolemaic epicycle geometry; the Keplerian formula is `2e sinM + ...`
- **Fix:** Added `eqCenterSeries(M, e)` to `epiCore.js` — three-term equation-of-centre series:
  `((2e - e³/4) sinM + (5e²/4) sin2M + (13e³/12) sin3M) × DEG`
- **Applied** `eqCenterSeries` in `outerBody()`, `innerBody()` (epi1) and `outerBody2()`,
  `innerBody2()` (epi2). Moon still uses `eqCenter × 2` (equivalent, kept as-is).
- **Mars-Jupiter perturbation:** Added 6-term resonance series `marsLonCorr(t)`:
  main term 0.2726° at (5λ_J − 2λ_M − 2.83°) + 5 additional terms.
  Applied as `lonCorr` in `outerBody()` / `outerBody2()` for Mars.
- Expected accuracy after fix: Mars epi1 ~1–2°, Mars epi2 ~0.5–1° (vs. prior 6.59°/4.18°)
  Jupiter/Saturn should also improve significantly (same eqCenter bug affected them)
- **Calibration note:** Mars perturbation phases (terms 2–6) are approximate; run
  `phase3Calibrate.mjs` to optimise them.

**Language reframing + Chunk 4 + Chunk 5 (Session 3 continued)**
- Scrubbed all "heliocentric" language from outerBody/innerBody/outerBody2/innerBody2.
  `a` field = orbital size ratio (observer mean orbit = 1.0). Variables renamed:
  `r_earth`→`r_obs`, `xE/yE`→`xO/yO`, `lon_h`→`lon_orb`, `r`→`rho`.
- Chunk 4 (secular T²): added `nlong2` (°/century²) to Mars, Jupiter, Saturn, Uranus,
  Neptune in epiParams.js. Applied as `(p.nlong2||0) × T²` correction to mean longitude.
  Effect < 0.001° per 100 years; meaningful only at multi-century ranges.
- Chunk 5 (Uranus/Neptune): added `uranusLonCorr(t)` (4 terms, Saturn+Jupiter coupling)
  and `neptuneLonCorr(t)` (3 terms, Uranus+Saturn coupling) to both pipelines.
  Phases approximate — run phase3Calibrate.mjs to refine.

---

## Planned Future Work (Priority Order)

### ~~Chunk 2~~ — DONE (Session 3)
Moon perturbations + Jupiter-Saturn great inequality — both pipelines updated.

### ~~Chunk 3~~ — DONE (Session 3, continued)

### ~~Chunk 4~~ — DONE (Session 3 continued)
~~Accuracy: Mars perturbation series~~
~~Accuracy: Jupiter-Saturn great inequality~~
Secular T² corrections added to Mars, Jupiter, Saturn, Uranus, Neptune via `nlong2` field.

### ~~Chunk 5~~ — DONE (Session 3 continued)
~~Accuracy: Secular terms~~
Uranus/Neptune perturbation corrections added to both pipelines (`uranusLonCorr`, `neptuneLonCorr`).
Phases approximate — run `phase3Calibrate.mjs` to calibrate.

### Chunk 6 — Calibration for new bodies
- Run `fetchsky-reference.mjs` / `phase3Calibrate.mjs` for Uranus, Neptune
- Calibrate L0/M0 for Ceres, Vesta (Pluto/Pallas/Juno: not available from sky-observations)

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

- To add a new pipeline (e.g., epicycle-model wrapper): follow the API contract above and
  add to `PIPES` and `FALLBACK_ORDER` in `js/core/ephemeris.js`.
