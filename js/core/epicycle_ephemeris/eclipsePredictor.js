// eclipsePredictor.js — Geocentric eclipse prediction from epicycle positions.
//
// Determines when syzygies (new and full moons) fall near the Moon's
// ascending node, producing solar and lunar eclipses.  All quantities
// are angular (degrees) — no physical distances, no mass, no gravity.
//
// Three observable angular cycles already in the model drive every eclipse:
//   Synodic period    (~29.530 days) — Moon returns to same elongation from Sun
//   Draconic period   (~27.212 days) — Moon returns to its ascending node
//   Anomalistic period (~27.555 days) — Moon returns to its closest angular approach
//
// The Saros cycle (18 yr 11 days = 223 synodic ≈ 242 draconic ≈ 239 anomalistic)
// emerges purely from these three periods with no additional input.
//
// Eclipse limits below are empirical angular thresholds derived from long-term
// sky observation — they encode how close to a node a syzygy must occur for
// the Sun and Moon to overlap in the sky.  No distances involved.
//
// API:
//   findEclipses(startDate, endDate)  → Eclipse[]
//   nextEclipse(startDate, type?)     → Eclipse | null
//
// Eclipse object:
//   {
//     date:      Date,              UTC moment of syzygy
//     type:      'solar'|'lunar',
//     subtype:   'central'|'partial'           (solar)
//                'total'|'partial'|'penumbral' (lunar)
//     beta:      Number,            Moon ecliptic latitude at syzygy (°)
//     magnitude: Number,            0 = grazing, 1 = deepest
//   }

import {
  sind, cosd, degmod, degmod180,
  j2000Day, solveKepler, trueAnomaly,
} from './epiCore.js';

import { SUN, MOON } from './epiParams.js';

// ── Empirical eclipse limits (degrees) ───────────────────────────
//
// Angular miss-distance thresholds observed and catalogued over millennia.
// Each limit is the maximum |β| at which that class of eclipse can occur.
// Purely geometric sky-angle criteria — no orbital radii needed.

const SOLAR_PARTIAL_LIMIT   = 1.54;   // any solar eclipse
const SOLAR_CENTRAL_LIMIT   = 0.68;   // central solar eclipse (axis crosses Earth's disc)
const LUNAR_PENUMBRAL_LIMIT = 1.57;   // penumbral lunar eclipse (outer shadow)
const LUNAR_PARTIAL_LIMIT   = 1.07;   // partial umbral lunar eclipse
const LUNAR_TOTAL_LIMIT     = 0.45;   // total lunar eclipse (full shadow immersion)

const SYNODIC_MONTH = 29.53059;       // days — mean time between same-phase moons

// ── Internal helpers ──────────────────────────────────────────────

// Sun's apparent ecliptic longitude (degrees), three-term equation of centre.
function sunLon(t) {
  const L = degmod(SUN.L0 + t * SUN.nlong);
  const M = degmod(SUN.M0 + t * SUN.nanom);
  const C = (1.9146 - 0.004817 * t / 36525) * sind(M)
           + 0.019993 * sind(2 * M)
           + 0.000290 * sind(3 * M);
  return degmod(L + C);
}

// Moon's mean elongation from Sun — fast, no perturbations, used for stepping.
function elongationMean(t) {
  return degmod(MOON.L0 + t * MOON.nlong - SUN.L0 - t * SUN.nlong);
}

// Moon's full ecliptic longitude and latitude (degrees).
// Uses the same 25-term longitude + 6-term latitude series as moonEquatorial.
function moonEcliptic(t) {
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
    + 1.2740 * sind(2*D - Mm)
    + 0.6583 * sind(2*D)
    - 0.1858 * sind(Ms)
    + 0.2136 * sind(2*Mm)
    - 0.1140 * sind(2*F)
    + 0.0588 * sind(2*D - 2*Mm)
    - 0.0572 * sind(2*D - Ms - Mm)
    + 0.0533 * sind(2*D + Mm)
    + 0.0459 * sind(2*D - Ms)
    + 0.0410 * sind(Mm - Ms)
    - 0.0348 * sind(D)
    - 0.0306 * sind(Ms + Mm)
    + 0.0267 * sind(2*D + Ms - Mm)
    + 0.0117 * sind(4*D - Mm)
    - 0.0111 * sind(2*D - 2*Ms)
    + 0.0153 * sind(2*D - 2*F)
    - 0.0125 * sind(Mm + 2*F)
    + 0.0110 * sind(Mm - 2*F)
    + 0.0100 * sind(3*Mm)
    + 0.0086 * sind(4*D - 2*Mm)
    - 0.0077 * sind(2*D + Ms)
    - 0.0052 * sind(D - Mm)
    + 0.0050 * sind(Ms + D)
    + 0.0040 * sind(2*D + 2*Mm)
    + 0.0039 * sind(4*D)
  );

  const Fact = degmod(lon - Nm);
  const lat = MOON.inc * sind(Fact)
            - 0.2806 * sind(2*D - F)
            - 0.2555 * sind(2*D + F)
            + 0.0557 * sind(Mm + F)
            - 0.0467 * sind(2*D - Mm - F)
            + 0.0464 * sind(2*D + Mm - F);

  return { lon, lat };
}

// Moon's full elongation from Sun (uses perturbation series).
function elongationFull(t) {
  return degmod(moonEcliptic(t).lon - sunLon(t));
}

// ── Bisection ─────────────────────────────────────────────────────
// Finds t in [t0, t1] where fn(t) = 0. Requires fn(t0)*fn(t1) <= 0.
// Converges to 1-minute precision.
function bisect(t0, t1, fn, tol = 1 / 1440) {
  let f0 = fn(t0);
  for (let i = 0; i < 60 && (t1 - t0) > tol; i++) {
    const tm = (t0 + t1) / 2;
    const fm = fn(tm);
    if (f0 * fm <= 0) { t1 = tm; }
    else              { t0 = tm; f0 = fm; }
  }
  return (t0 + t1) / 2;
}

// ── Syzygy finder ─────────────────────────────────────────────────
//
// Finds the next new moon (type='new') or full moon (type='full')
// strictly after t_start (days since J2000.0).
//
// Strategy: step 1 day at a time using mean elongation (fast) to
// bracket the crossing, then refine with the full perturbation series.
//
// Phase function: degmod180(D - target) crosses zero from negative
// to positive at each syzygy.  The ±180° discontinuity at the
// opposite phase is excluded by the |Δp| < 90 guard.
function findNextSyzygy(t_start, type) {
  const target  = type === 'new' ? 0 : 180;
  const pMean   = t => degmod180(elongationMean(t) - target);
  const pFull   = t => degmod180(elongationFull(t)  - target);

  let t = t_start;
  let p = pMean(t);

  for (let i = 0; i < 33; i++) {
    const t1 = t + 1;
    const p1 = pMean(t1);
    if (p < 0 && p1 >= 0 && Math.abs(p1 - p) < 90) {
      return bisect(t, t1, pFull);
    }
    t = t1;
    p = p1;
  }
  return null;
}

// ── Eclipse classifier ────────────────────────────────────────────
//
// Given Moon's ecliptic latitude β (°) at a syzygy, returns an eclipse
// descriptor or null (no eclipse).  Limits are purely observational.
//
// Solar: Moon crosses in front of the Sun's disc (new moon near node).
// Lunar: Moon enters the sky's shadow region opposite the Sun (full moon near node).
function classifyEclipse(beta, syzType) {
  const b = Math.abs(beta);

  if (syzType === 'new') {
    if (b >= SOLAR_PARTIAL_LIMIT) return null;
    const subtype   = b < SOLAR_CENTRAL_LIMIT ? 'central' : 'partial';
    const magnitude = (SOLAR_PARTIAL_LIMIT - b) / SOLAR_PARTIAL_LIMIT;
    return { type: 'solar', subtype, beta, magnitude };
  }

  // full moon
  if (b >= LUNAR_PENUMBRAL_LIMIT) return null;
  const subtype   = b < LUNAR_TOTAL_LIMIT   ? 'total'
                  : b < LUNAR_PARTIAL_LIMIT  ? 'partial'
                  :                            'penumbral';
  const magnitude = (LUNAR_PENUMBRAL_LIMIT - b) / LUNAR_PENUMBRAL_LIMIT;
  return { type: 'lunar', subtype, beta, magnitude };
}

// ── t ↔ Date ──────────────────────────────────────────────────────
function tToDate(t) {
  return new Date((t + 2451545.0 - 2440587.5) * 86400000);
}

// ── Public API ────────────────────────────────────────────────────

/**
 * Find all solar and lunar eclipses between startDate and endDate.
 * Returns an array sorted by date.
 */
export function findEclipses(startDate, endDate) {
  const t0 = j2000Day(startDate);
  const t1 = j2000Day(endDate);
  const eclipses = [];

  for (const syzType of ['new', 'full']) {
    let t = t0;
    while (t < t1) {
      const ts = findNextSyzygy(t, syzType);
      if (ts === null || ts > t1) break;

      const { lat: beta } = moonEcliptic(ts);
      const info = classifyEclipse(beta, syzType);
      if (info) eclipses.push({ date: tToDate(ts), ...info });

      t = ts + SYNODIC_MONTH * 0.9;  // advance past this lunation
    }
  }

  eclipses.sort((a, b) => a.date - b.date);
  return eclipses;
}

/**
 * Find the next eclipse after startDate.
 * type: 'solar' | 'lunar' | undefined (returns whichever comes first).
 * Searches up to 2 years ahead.  Returns null if none found.
 */
export function nextEclipse(startDate, type) {
  const end = new Date(+startDate + 730 * 86400000);
  const all = findEclipses(startDate, end);
  return type ? (all.find(e => e.type === type) ?? null) : (all[0] ?? null);
}
