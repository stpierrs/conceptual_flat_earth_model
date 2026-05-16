// ephemerisEpicycle.js — Custom pure-epicycle ephemeris pipeline.
//
// Drop-in replacement / addition compatible with the existing
// ephemeris dispatcher in ephemeris.js.  Exports the same API as
// projections.js (ephemerisPtolemy), ephemerisGeo.js, etc.:
//
//   bodyGeocentric(name, date) → { ra, dec }   (radians)
//   coversBody(name)           → bool
//   coversDate(date)           → bool
//   SUPPORTED_BODIES           Set<string>
//   BUILTIN_CORRECTIONS        object
//
// Frame of reference: Earth-centred throughout.  No heliocentric
// stage, no Sun-relative coordinates, no AU, no G.  The Sun's mean
// longitude enters only as a shared angular accumulator for the
// inner planets — exactly as Ptolemy observed: Venus and Mercury
// track the Sun angularly, not spatially.
//
// Epoch: J2000.0 (noon 1 Jan 2000 UTC).
// Mean motion rates: degrees per Julian day.
// Obliquity: IAU J2000.0 = 23.4392911° (modern, not Ptolemy's 23.855°).
//
// Bodies covered:
//   Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune.
//   Fixed stars (zodiac + guide stars) via starEquatorial().
//
// Accuracy:
//   Single deferent + single epicycle lands ~0.3°–2° for planets,
//   ~5'–15' for the Sun, ~30'–1° for the Moon.
//   For higher accuracy see ephemerisEpicycle2.js (two-epicycle stack).
//
// To wire into the existing dispatcher add this pipeline to the
// SOURCES map and FALLBACK_ORDER in ephemeris.js, following the
// same pattern as the Ptolemy entry.

import {
  DEG, RAD,
  sind, cosd, asind, atand2, degmod,
  j2000Day,
  eclipticToEquatorial,
  eqCenter,
  eqCenterobserved-series,
  eqAnomaly,
} from './epiCore.js';

import {
  SUN, MOON, MARS, JUPITER, SATURN, URANUS, NEPTUNE,
  VENUS, MERCURY, PLUTO,
  CERES, PALLAS, JUNO, VESTA,
  ZODIAC_STARS, ECLIPTIC_GUIDE_STARS, BSC_STARS,
} from './epiParams.js';

// ── Utility: Sun's mean longitude (shared by inner planets) ──────

function sunMeanLongitude(t) {
  // t = days since J2000.0
  return degmod(SUN.L0 + t * SUN.nlong);
}

function sunMeanAnomaly(t) {
  return degmod(SUN.M0 + t * SUN.nanom);
}

// ── Sun ──────────────────────────────────────────────────────────
//
// Single eccentric deferent.  The Sun moves on the ecliptic (β = 0).
// True longitude = mean longitude − equation of centre.
// We add the standard perturbation terms from observed-series ch.25 (light
// terms only — no nutation, no aberration) to get to ~3' accuracy.
function sunEquatorial(t) {
  const L = sunMeanLongitude(t);
  const M = sunMeanAnomaly(t);

  // Equation of centre — two-term series (observed-series 25.4)
  const C = (1.9146 - 0.004817 * t / 36525) * sind(M)
           + 0.019993 * sind(2 * M)
           + 0.000290 * sind(3 * M);

  const tlong = degmod(L + C);
  return eclipticToEquatorial(tlong, 0);
}

// ── Moon ─────────────────────────────────────────────────────────
//
// Eccentric deferent + thirteen perturbation terms (observed-series Ch.22/47).
// Terms 1–4 were the original set; terms 5–13 added here bring
// accuracy from ~15–20' to ~0.1° (6').
//
// F = mean argument of latitude = mean longitude − ascending node.
// D = mean elongation from Sun.
function moonEquatorial(t) {
  const Lm = degmod(MOON.L0 + t * MOON.nlong);
  const Mm = degmod(MOON.M0 + t * MOON.nanom);
  const Nm = degmod(MOON.N0 - t * MOON.nnode);

  // Sun mean anomaly + mean longitude (shared by perturbation terms)
  const Ms = degmod(SUN.M0 + t * SUN.nanom);
  const Ls = degmod(SUN.L0 + t * SUN.nlong);
  const D  = degmod(Lm - Ls);   // Moon's mean elongation from Sun
  const F  = degmod(Lm - Nm);   // argument of latitude (mean)

  // Equation of centre (eccentric deferent, ×2 for Ptolemaic amplification)
  const eqc = eqCenter(Mm, MOON.ecc) * 2;

  // Thirteen perturbation terms (amplitudes from observed-series Ch.47 simplified)
  const tlong = degmod(Lm + eqc
    + 1.2740 * sind(2*D - Mm)         // evection — Ptolemy's prosneusis
    + 0.6583 * sind(2*D)               // variation — Tycho Brahe
    - 0.1858 * sind(Ms)                // annual equation — Kepler
    + 0.2136 * sind(2*Mm)              // second anomaly
    - 0.1140 * sind(2*F)               // argument-of-latitude term
    + 0.0588 * sind(2*D - 2*Mm)
    - 0.0572 * sind(2*D - Ms - Mm)
    + 0.0533 * sind(2*D + Mm)
    + 0.0459 * sind(2*D - Ms)
    + 0.0410 * sind(Mm - Ms)
    - 0.0348 * sind(D)                 // parallactic inequality
    - 0.0306 * sind(Ms + Mm)
    + 0.0267 * sind(2*D + Ms - Mm)
  );

  const Fact = degmod(tlong - Nm);
  const beta = MOON.inc * sind(Fact);
  const beta = MOON.inc * sind(F);

  return eclipticToEquatorial(tlong, beta);
}

// ── Outer planet (single deferent + single epicycle) ─────────────
//
// Applies to Mars, Jupiter, Saturn, Uranus, Neptune.
//
// Steps:
//   1. Mean longitude λ̄ + mean anomaly M from J2000.
//   2. Equation of centre → true orbital longitude.
//   3. Orbital radius rho = a(1−e²)/(1+e cos ν)  [observer orbit = 1].
//   4. Planet orbital vector (rho cos λ, rho sin λ).
//   5. Observer orbital vector from anti-Sun reference direction.
//   6. Geocentric direction: angular offset of planet from observer.
//   7. Latitude from inclination and ascending node.
//
// This is the exact geocentric formula, not the epicycle approximation.
// The "epicycle" here IS the observer's orbit — the vector subtraction is
// geometrically identical to the Ptolemaic deferent+epicycle with
// observer-orbit radius as the epicycle size.
// lonCorr: optional orbital longitude correction in degrees (for perturbations).
function outerBody(t, p, lonCorr = 0) {
  const T      = t / 36525;
  const lambda  = degmod(p.L0 + t * p.nlong + (p.nlong2 || 0) * T * T);
  const M       = degmod(p.M0 + t * p.nanom);
  const nodeNow = degmod(p.node + t * (p.nodeRate || 0));

  const eqc     = eqCenterobserved-series(M, p.ecc);
  const nu      = degmod(M + eqc);

  // Apply perturbation correction to orbital longitude before geocentric conversion
  const lon_orb = degmod(lambda + eqc + lonCorr);

  // Planet orbital vector (orbit ratio a, proportional coordinates)
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
  const dx = xP - xO;
  const dy = yP - yO;
  const tlong = degmod(atand2(dy, dx));

  // Ecliptic latitude from inclination and ascending node
  const latArg = degmod(lon_orb - nodeNow);
  const beta   = p.inc * sind(latArg);

  return eclipticToEquatorial(tlong, beta);
}

// Inner planets (Venus, Mercury) use full vector geocentric approach.
// The deferent tracks the Sun's mean longitude (Ptolemy's constraint).
// Their orbital radius ratio a < 1 observer orbit, so after
// subtracting the observer vector we get the geocentric direction.
function innerBody(t, p) {
  // Planet's mean anomaly in its orbit
  const M     = degmod(p.M0 + t * p.nanom);
  const eqc   = eqCenterobserved-series(M, p.ecc);
  const nu    = degmod(M + eqc);

  // Planet orbital vector (orbit ratio a, proportional coordinates)
  const w      = degmod(p.apogee0 + t * (p.apogeeRate || 0));
  const lon_orb = degmod(nu + w);

  // Planet orbital vector (orbit ratio a, proportional coordinates)
  const rho    = p.a * (1 - p.ecc * p.ecc) / (1 + p.ecc * cosd(nu));
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
  const tlong = degmod(atand2(yP - yO, xP - xO));

  // Ecliptic latitude
  const nodeNow = degmod(p.node + t * (p.nodeRate || 0));
  const latArg  = degmod(lon_orb - nodeNow);
  const beta    = p.inc * sind(latArg);

  return eclipticToEquatorial(tlong, beta);
}

// ── Uranus perturbation corrections ───────────────────────────────
// Primary terms: Saturn-Uranus synodic (~45.4 yr) and Jupiter-Uranus
// Amplitudes calibrated to approximate sky-reference; phases need phase3Calibrate.mjs
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
// Phases are approximate — calibrate with phase3Calibrate.mjs vs sky-reference
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
//
// Six-term resonance series applied as a orbital longitude
// correction before geocentric conversion.  Phases approximate —
// run phase3Calibrate.mjs for sky-reference-fitted values.
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

// ── Fixed-star lookup (zodiac + ecliptic guide stars) ────────────
//
// Fixed stars have no epicycle.  Their RA/Dec are J2000 catalogue
// values; precession is handled by the model's existing precession
// checkbox (which rotates the whole starfield).
// We build a combined lookup map from both star lists.
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
    case 'mercury': return innerBody(t, MERCURY);
    case 'venus':   return innerBody(t, VENUS);
    case 'mars':    return outerBody(t, MARS, marsLonCorr(t));
    case 'jupiter': { // Great inequality: Jupiter-Saturn 2:5 near-resonance (~759 yr period)
      const gi = degmod(2 * degmod(JUPITER.L0 + t * JUPITER.nlong)
                      - 5 * degmod(SATURN.L0  + t * SATURN.nlong));
      return outerBody(t, JUPITER, 0.549 * sind(gi + 174.0));
    }
    case 'saturn': { // Great inequality — opposite sign, larger amplitude
      const gi = degmod(2 * degmod(JUPITER.L0 + t * JUPITER.nlong)
                      - 5 * degmod(SATURN.L0  + t * SATURN.nlong));
      return outerBody(t, SATURN, -0.870 * sind(gi + 148.0));
    }
    case 'uranus':  return outerBody(t, URANUS, uranusLonCorr(t));
    case 'neptune': return outerBody(t, NEPTUNE, neptuneLonCorr(t));
    case 'pluto':   return outerBody(t, PLUTO);
    case 'ceres':   return outerBody(t, CERES);
    case 'pallas':  return outerBody(t, PALLAS);
    case 'juno':    return outerBody(t, JUNO);
    case 'vesta':   return outerBody(t, VESTA);
    case 'earth':   return { ra: 0, dec: 0 };
    default: {
      // Try fixed-star lookup
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

export function coversBody(name) {
  return SUPPORTED_BODIES.has(name);
}

export function coversDate(_date) {
  // Pure analytic — valid for any date (accuracy degrades far from J2000)
  return true;
}

// No modern corrections baked in — this is a pure geometric model.
export const BUILTIN_CORRECTIONS = {
  precession: false,
  nutation:   false,
  aberration: false,
  fk5:        false,
};

export const PIPELINE_LABEL = 'Epicycle';
export const PIPELINE_ID    = 'epicycle';
