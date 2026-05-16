// ephemeris_integration_patch.js
//
// HOW TO WIRE ephemerisEpicycle.js INTO THE EXISTING MODEL
// =========================================================
//
// The existing dispatcher lives in ephemeris.js (or galaxiesExtra.js
// in the single-Ptolemy variant).  The steps below apply to the
// version of the model that has the full five-pipeline system:
//   DE405 → GeoC → VSOP87 → Ptolemy
//
// ── Step 1: Import the new module ────────────────────────────────
//
// At the top of ephemeris.js, add:
//
//   import * as epi  from './epicycle_ephemeris/ephemerisEpicycle.js';
//   import * as epi2 from './epicycle_ephemeris/ephemerisEpicycle2.js';
//
// ── Step 2: Add to the SOURCES map ───────────────────────────────
//
// The dispatcher probably has something like:
//
//   const SOURCES = {
//     astropixels: apix,
//     geocentric:  geo,
//     vsop87:      vsop,
//     ptolemy:     ptol,
//   };
//
// Add:
//
//   const SOURCES = {
//     astropixels: apix,
//     geocentric:  geo,
//     vsop87:      vsop,
//     ptolemy:     ptol,
//     epicycle:    epi,    // ← add
//     epicycle2:   epi2,   // ← add
//   };
//
// ── Step 3: Add to the fallback chain ────────────────────────────
//
// The fallback order is used when the active source returns NaN
// (body out of range, date out of range, etc.).  The epicycle
// pipeline covers all bodies including Uranus and Neptune,
// so slot it in after VSOP87 but before Ptolemy:
//
//   const FALLBACK_ORDER = [
//     'astropixels',
//     'geocentric',
//     'vsop87',
//     'epicycle2',   // ← add (two-epi is more accurate, preferred)
//     'epicycle',    // ← add (fallback to single-epi)
//     'ptolemy',
//   ];
//
// ── Step 4: Add to the UI dropdown in controlPanel.js ────────────
//
// Find the BodySource / EphemerisSource select options array and add:
//
//   { value: 'epicycle',  label: 'Epicycle-1  (custom pure-circle)' },
//   { value: 'epicycle2', label: 'Epicycle-2  (two-circle stack)'   },
//
// ── Step 5: Add to the comparison HUD ────────────────────────────
//
// If the comparison panel iterates over pipeline keys, add
// 'epicycle' and 'epicycle2' to that list.  The HUD will then
// show Epi-1 and Epi-2 columns alongside DE405, VSOP87, and Ptolemy.
//
// ── Step 6: Add to app.js state defaults ─────────────────────────
//
// In app.js defaultState(), BodySource is set to 'astropixels'.
// No change needed — the new pipelines activate when the user
// selects them from the dropdown.
//
// ── Step 7: Add to about.md ──────────────────────────────────────
//
// In the Tracker > Ephemeris > Source section, add:
//
//   - **Epicycle-1** — Custom pure-epicycle model.  Single deferent +
//     single epicycle per body, J2000 epoch, modern period data.
//     Covers Sun through Neptune.  Accuracy ~0.5°–2° for planets.
//
//   - **Epicycle-2** — Two-epicycle stack (Ibn al-Shatir method).
//     Adds a second compounded circle per body to absorb the
//     residual from the first.  Accuracy ~0.1°–0.5° for most planets.
//     No heliocentric stage.  No gravitational constants.
//
// ── Zodiac stars ─────────────────────────────────────────────────
//
// The zodiac and ecliptic guide stars in epiParams.js are fixed-star
// entries with J2000 RA/Dec.  To make them available in the tracker:
//
//   import { ZODIAC_STARS, ECLIPTIC_GUIDE_STARS }
//     from './epicycle_ephemeris/epiParams.js';
//
// Then add their ids to the tracker category system alongside the
// existing cel-nav and named-star categories.  They render at their
// catalogue positions (precession applied by the existing toggle).
//
// ── Module resolution note ────────────────────────────────────────
//
// The epicycle_ephemeris/ folder sits alongside ephemeris.js in the
// js/core/ directory (or wherever the model keeps its core modules).
// The relative import paths in ephemerisEpicycle.js use './epiCore.js'
// and './epiParams.js' — both within the same subfolder.
// From outside (ephemeris.js), use:
//   './epicycle_ephemeris/ephemerisEpicycle.js'

export {};  // makes this a module so it can be imported without errors
