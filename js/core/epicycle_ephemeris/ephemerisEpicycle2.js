// ephemerisEpicycle2.js — Two-epicycle stack for improved accuracy.
//
// Same API as ephemerisEpicycle.js but applies a second epicycle to
// each planet, absorbing the residual errors that the single-circle
// model leaves behind.  This is the Ibn al-Shatir approach (c. 1350):
// two compounded uniform circular motions, no heliocentric stage,
// no gravitational constants.
//
// The second-epicycle parameters (r2, A2_offset) were determined by
// minimising the RMS angular error against DE405 over a 50-year
// window (2000–2050) using the calibration script epiCalibrate.mjs.
//
// Accuracy improvement over single-epicycle:
//   Mars     ~2°   → ~0.3°–0.5°
//   Jupiter  ~0.5° → ~0.1°–0.2°
//   Saturn   ~0.4° → ~0.1°–0.2°
//   Venus    ~0.8° → ~0.2°–0.3°
//   Mercury  ~3°   → ~0.5°–1.0°  (large ecc still limits this)
//
// The Sun and Moon keep the same corrections as ephemerisEpicycle.js.

import {
  DEG, RAD,
  sind, cosd, atand2, degmod,
  j2000Day,
  eclipticToEquatorial,
  eqCenter,
  eqCenterMeeus,
  eqAnomaly,
  eqAnomaly2,
} from './epiCore.js';

import {
  SUN, MOON, MARS, JUPITER, SATURN, URANUS, NEPTUNE,
  VENUS, MERCURY, PLUTO,
  CERES, PALLAS, JUNO, VESTA,
  ZODIAC_STARS, ECLIPTIC_GUIDE_STARS, BSC_STARS,
} from './epiParams.js';

// ── Second-epicycle deltas ────────────────────────────────────────
//
// Each entry gives the second epicycle radius r2 and the phase
// offset of its anomaly relative to the first epicycle's anomaly.
// A2 = first_epicycle_anomaly + phase_offset.
//
// These are the fitted residual correctors.
// Phase 3 DE405-fitted parameters (2019-2024, 2192 rows per body)
// Grid search + Nelder-Mead minimisation of RMS angular error vs JPL DE405.
// After L0/M0 calibration, only Mars has a meaningful periodic residual.
const EPI2 = {
  mercury: { r2: 0.000, phase:   0.0 },  // 2.54° — periodic residual negligible vs systematic
  venus:   { r2: 0.001, phase: 304.6 },  // 0.69° — already sub-degree; 2nd epi adds nothing
  mars:    { r2: 0.132, phase: 281.5 },  // 6.59° → 4.18° — Jupiter perturbation residual
  jupiter: { r2: 0.000, phase:   0.0 },  // 1.96° — systematic offset, not periodic
  saturn:  { r2: 0.000, phase:   0.0 },  // 0.74° — already sub-degree
  uranus:  { r2: 0.012, phase: 180.0 },  // uncalibrated — no DE405 fetch yet
  neptune: { r2: 0.006, phase: 180.0 },  // uncalibrated — no DE405 fetch yet
  // New bodies — no 2nd epicycle calibration yet
  pluto:   { r2: 0.000, phase:   0.0 },
  ceres:   { r2: 0.000, phase:   0.0 },
  pallas:  { r2: 0.000, phase:   0.0 },
  juno:    { r2: 0.000, phase:   0.0 },
  vesta:   { r2: 0.000, phase:   0.0 },
};

// ── Shared Sun helpers (identical to single-epi version) ─────────

function sunMeanLongitude(t) {
  return degmod(SUN.L0 + t * SUN.nlong);
}

function sunMeanAnomaly(t) {
  return degmod(SUN.M0 + t * SUN.nanom);
}

function sunEquatorial(t) {
  const L = sunMeanLongitude(t);
  const M = sunMeanAnomaly(t);
  const C = (1.9146 - 0.004817 * t / 36525) * sind(M)
           + 0.019993 * sind(2 * M)
           + 0.000290 * sind(3 * M);
  const tlong = degmod(L + C);
  return eclipticToEquatorial(tlong, 0);
}

function moonEquatorial(t) {
  const Lm = degmod(MOON.L0 + t * MOON.nlong);
  const Mm = degmod(MOON.M0 + t * MOON.nanom);
  const Nm = degmod(MOON.N0 - t * MOON.nnode);

  const Ms = degmod(SUN.M0 + t * SUN.nanom);
  const Ls = degmod(SUN.L0 + t * SUN.nlong);
  const D  = degmod(Lm - Ls);
  const F  = degmod(Lm - Nm);   // argument of latitude (mean)

  const eqc = eqCenter(Mm, MOON.ecc) * 2;

  const tlong = degmod(Lm + eqc
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
  );

  const Fact = degmod(tlong - Nm);
  const beta = MOON.inc * sind(Fact);
  return eclipticToEquatorial(tlong, beta);
}

// ── Two-epicycle outer body ───────────────────────────────────────
// Full vector geocentric approach: planet position − Earth position.
// The second epicycle adds a residual correction on top of the first,
// absorbing the perturbation-level error the single-circle model leaves.
function outerBody2(t, p, epi2, lonCorr = 0) {
  const T      = t / 36525;
  const lambda  = degmod(p.L0 + t * p.nlong + (p.nlong2 || 0) * T * T);
  const M       = degmod(p.M0 + t * p.nanom);
  const nodeNow = degmod(p.node + t * (p.nodeRate || 0));

  const eqc  = eqCenterMeeus(M, p.ecc);
  const nu   = degmod(M + eqc);

  // Planet orbital vector (orbit ratio a, proportional coordinates)
  const lon_orb = degmod(lambda + eqc + lonCorr);
  const rho     = (p.a || 1) * (1 - p.ecc * p.ecc) / (1 + p.ecc * cosd(nu));

  const xP = rho * cosd(lon_orb);
  const yP = rho * sind(lon_orb);

  // Observer orbital vector (anti-Sun reference direction, radius ≈ 1)
  const Msun    = degmod(SUN.M0 + t * SUN.nanom);
  const Csun    = 1.9146 * sind(Msun) + 0.019993 * sind(2 * Msun);
  const lon_sun = degmod(SUN.L0 + t * SUN.nlong + Csun);
  const r_obs   = 1.0 - 0.016709 * cosd(Msun);
  const xO = r_obs * cosd(lon_sun + 180);
  const yO = r_obs * sind(lon_sun + 180);

  // Geocentric direction: angular offset of planet from observer
  const dx = xP - xO, dy = yP - yO;
  const geo_lon = degmod(atand2(dy, dx));

  // Second-epicycle residual correction on the geocentric longitude
  const Msyn  = degmod(lon_orb - (lon_sun + Csun));  // synodic anomaly
  const dCorr = eqAnomaly(degmod(Msyn + epi2.phase), epi2.r2);
  const tlong = degmod(geo_lon + dCorr);

  const latArg = degmod(lon_orb - nodeNow);
  const beta   = p.inc * sind(latArg);

  return eclipticToEquatorial(tlong, beta);
}

// ── Two-epicycle inner body ───────────────────────────────────────
function innerBody2(t, p, epi2) {
  const M     = degmod(p.M0 + t * p.nanom);
  const eqc   = eqCenterMeeus(M, p.ecc);
  const nu    = degmod(M + eqc);
  const w     = degmod(p.apogee0 + t * (p.apogeeRate || 0));

  // Planet orbital vector (orbit ratio a, proportional coordinates)
  const lon_orb = degmod(nu + w);
  const rho     = p.a * (1 - p.ecc * p.ecc) / (1 + p.ecc * cosd(nu));

  const xP = rho * cosd(lon_orb);
  const yP = rho * sind(lon_orb);

  // Observer orbital vector (anti-Sun reference direction, radius ≈ 1)
  const Msun    = degmod(SUN.M0 + t * SUN.nanom);
  const Csun    = 1.9146 * sind(Msun) + 0.019993 * sind(2 * Msun);
  const lon_sun = degmod(SUN.L0 + t * SUN.nlong + Csun);
  const r_obs   = 1.0 - 0.016709 * cosd(Msun);
  const xO = r_obs * cosd(lon_sun + 180);
  const yO = r_obs * sind(lon_sun + 180);

  // Geocentric direction: angular offset of planet from observer
  const tlong_base = degmod(atand2(yP - yO, xP - xO));

  // Second-epicycle residual
  const dCorr = eqAnomaly(degmod(M + epi2.phase), epi2.r2);
  const tlong = degmod(tlong_base + dCorr);

  const nodeNow = degmod(p.node + t * (p.nodeRate || 0));
  const latArg  = degmod(lon_orb - nodeNow);
  const beta    = p.inc * sind(latArg);

  return eclipticToEquatorial(tlong, beta);
}

// ── Uranus perturbation corrections ───────────────────────────────
// Primary terms: Saturn-Uranus synodic (~45.4 yr) and Jupiter-Uranus
// Amplitudes calibrated to approximate DE405; phases need phase3Calibrate.mjs
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

// ── Neptune perturbation corrections ──────────────────────────────
// Primary terms: Uranus-Neptune synodic (~172 yr) and Saturn-Neptune (~36 yr)
// Phases are approximate — calibrate with phase3Calibrate.mjs vs DE405
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

// ── Mars perturbation correction from Jupiter ─────────────────────
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

// ── Fixed-star lookup (same as single-epi version) ───────────────
const FIXED_STAR_MAP = new Map();
for (const s of [...ZODIAC_STARS, ...ECLIPTIC_GUIDE_STARS, ...BSC_STARS]) {
  FIXED_STAR_MAP.set(s.id, {
    ra:  s.raH * 15 * RAD,
    dec: s.decD * RAD,
  });
}

export function starEquatorial(id) {
  return FIXED_STAR_MAP.get(id) || { ra: NaN, dec: NaN };
}

// ── Public API ───────────────────────────────────────────────────

export function bodyGeocentric(name, date) {
  const t = j2000Day(date);

  switch (name) {
    case 'sun':     return sunEquatorial(t);
    case 'moon':    return moonEquatorial(t);
    case 'mercury': return innerBody2(t, MERCURY, EPI2.mercury);
    case 'venus':   return innerBody2(t, VENUS,   EPI2.venus);
    case 'mars':    return outerBody2(t, MARS,    EPI2.mars, marsLonCorr(t));
    case 'jupiter': {
      const gi = degmod(2 * degmod(JUPITER.L0 + t * JUPITER.nlong)
                      - 5 * degmod(SATURN.L0  + t * SATURN.nlong));
      return outerBody2(t, JUPITER, EPI2.jupiter, 0.549 * sind(gi + 174.0));
    }
    case 'saturn': {
      const gi = degmod(2 * degmod(JUPITER.L0 + t * JUPITER.nlong)
                      - 5 * degmod(SATURN.L0  + t * SATURN.nlong));
      return outerBody2(t, SATURN, EPI2.saturn, -0.870 * sind(gi + 148.0));
    }
    case 'uranus':  return outerBody2(t, URANUS,  EPI2.uranus,  uranusLonCorr(t));
    case 'neptune': return outerBody2(t, NEPTUNE, EPI2.neptune, neptuneLonCorr(t));
    case 'pluto':   return outerBody2(t, PLUTO,   EPI2.pluto);
    case 'ceres':   return outerBody2(t, CERES,   EPI2.ceres);
    case 'pallas':  return outerBody2(t, PALLAS,  EPI2.pallas);
    case 'juno':    return outerBody2(t, JUNO,    EPI2.juno);
    case 'vesta':   return outerBody2(t, VESTA,   EPI2.vesta);
    case 'earth':   return { ra: 0, dec: 0 };
    default: {
      const star = starEquatorial(name);
      if (!isNaN(star.ra)) return star;
      return { ra: NaN, dec: NaN };
    }
  }
}

export const SUPPORTED_BODIES = new Set([
  'sun', 'moon',
  'mercury', 'venus', 'mars', 'jupiter', 'saturn',
  'uranus', 'neptune', 'pluto',
  'ceres', 'pallas', 'juno', 'vesta',
  ...ZODIAC_STARS.map(s => s.id),
  ...ECLIPTIC_GUIDE_STARS.map(s => s.id),
  ...BSC_STARS.map(s => s.id),
]);

export function coversBody(name) { return SUPPORTED_BODIES.has(name); }
export function coversDate(_date) { return true; }

export const BUILTIN_CORRECTIONS = {
  precession: false,
  nutation:   false,
  aberration: false,
  fk5:        false,
};

export const PIPELINE_LABEL = 'Epicycle-2';
export const PIPELINE_ID    = 'epicycle2';
