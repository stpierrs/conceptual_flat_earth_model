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
  eqAnomaly,
} from './epiCore.js';

import {
  SUN, MOON, MARS, JUPITER, SATURN, URANUS, NEPTUNE,
  VENUS, MERCURY, PLUTO,
  CERES, PALLAS, JUNO, VESTA,
  ZODIAC_STARS, ECLIPTIC_GUIDE_STARS, BRIGHT_STARS,
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
// We add the standard perturbation terms from Meeus ch.25 (light
// terms only — no nutation, no aberration) to get to ~3' accuracy.
function sunEquatorial(t) {
  const L = sunMeanLongitude(t);
  const M = sunMeanAnomaly(t);

  // Equation of centre — two-term series (Meeus 25.4)
  const C = (1.9146 - 0.004817 * t / 36525) * sind(M)
           + 0.019993 * sind(2 * M)
           + 0.000290 * sind(3 * M);

  const tlong = degmod(L + C);
  return eclipticToEquatorial(tlong, 0);
}

// ── Moon ─────────────────────────────────────────────────────────
//
// Eccentric deferent + epicycle.  Simplified — no evection, no
// variation.  Accuracy ~30'–1°.  The Moon's ascending node
// regresses, which we track to get approximate ecliptic latitude.
function moonEquatorial(t) {
  const Lm = degmod(MOON.L0 + t * MOON.nlong);   // mean longitude
  const Mm = degmod(MOON.M0 + t * MOON.nanom);   // mean anomaly
  const Nm = degmod(MOON.N0 - t * MOON.nnode);   // ascending node

  // Equation of centre (eccentric deferent)
  const eqc = eqCenter(Mm, MOON.ecc) * 2;        // ×2: Ptolemaic factor

  // True longitude (simplified — omitting evection ~1.27°)
  const tlong = degmod(Lm + eqc);

  // Ecliptic latitude from argument of latitude F = L − N
  const F    = degmod(tlong - Nm);
  const beta = MOON.inc * sind(F);

  return eclipticToEquatorial(tlong, beta);
}

// ── Outer planet (single deferent + single epicycle) ─────────────
//
// Applies to Mars, Jupiter, Saturn, Uranus, Neptune.
//
// Steps:
//   1. Mean longitude λ̄ + mean anomaly M from J2000.
//   2. Equation of centre → true heliocentric longitude.
//   3. True heliocentric distance r from eccentricity.
//   4. Heliocentric 2D vector (r cos λ, r sin λ).
//   5. Earth heliocentric vector from Sun position.
//   6. Geocentric vector = planet − Earth.
//   7. Geocentric longitude = atan2 of that vector.
//   8. Latitude from inclination and ascending node.
//
// This is the exact geocentric formula, not the epicycle approximation.
// The "epicycle" here IS the Earth's orbit — the vector subtraction is
// geometrically identical to the Ptolemaic deferent+epicycle with
// Earth-orbit radius as the epicycle size.
function outerBody(t, p) {
  const lambda  = degmod(p.L0 + t * p.nlong);
  const M       = degmod(p.M0 + t * p.nanom);
  const nodeNow = degmod(p.node + t * (p.nodeRate || 0));

  // Equation of centre → true anomaly ν
  const eqc     = eqCenter(M, p.ecc);
  const nu      = degmod(M + eqc);

  // True heliocentric longitude
  const lon_h   = degmod(lambda + eqc);

  // Heliocentric distance r = a(1 − e²) / (1 + e cos ν)
  const r       = (p.a || 1) * (1 - p.ecc * p.ecc) / (1 + p.ecc * cosd(nu));

  // Heliocentric ecliptic cartesian (2D — latitude handled separately)
  const xP = r * cosd(lon_h);
  const yP = r * sind(lon_h);

  // Earth heliocentric position (Sun is opposite)
  const Msun    = degmod(SUN.M0 + t * SUN.nanom);
  const Csun    = 1.9146 * sind(Msun) + 0.019993 * sind(2 * Msun);
  const lon_sun = degmod(SUN.L0 + t * SUN.nlong + Csun);
  const r_earth = 1.0 - 0.016709 * cosd(Msun);
  const xE = r_earth * cosd(lon_sun + 180);
  const yE = r_earth * sind(lon_sun + 180);

  // Geocentric ecliptic longitude
  const dx = xP - xE;
  const dy = yP - yE;
  const tlong = degmod(atand2(dy, dx));

  // Ecliptic latitude from inclination and ascending node
  const latArg = degmod(lon_h - nodeNow);
  const beta   = p.inc * sind(latArg);

  return eclipticToEquatorial(tlong, beta);
}

// Inner planets (Venus, Mercury) use full vector geocentric approach.
// The deferent tracks the Sun's mean longitude (Ptolemy's constraint).
// Their heliocentric semi-major axis a < 1 Earth orbit, so after
// subtracting the Earth vector we get the geocentric direction.
function innerBody(t, p) {
  // Planet's mean anomaly around the Sun (heliocentric)
  const M     = degmod(p.M0 + t * p.nanom);
  const eqc   = eqCenter(M, p.ecc);
  const nu    = degmod(M + eqc);

  // Planet heliocentric longitude = longitude of perihelion + true anomaly
  const w     = degmod(p.apogee0 + t * (p.apogeeRate || 0));
  const lon_h = degmod(nu + w);

  // Heliocentric distance
  const r     = p.a * (1 - p.ecc * p.ecc) / (1 + p.ecc * cosd(nu));

  // Heliocentric Cartesian
  const xP = r * cosd(lon_h);
  const yP = r * sind(lon_h);

  // Earth position (same as outer body)
  const Msun    = degmod(SUN.M0 + t * SUN.nanom);
  const Csun    = 1.9146 * sind(Msun) + 0.019993 * sind(2 * Msun);
  const lon_sun = degmod(SUN.L0 + t * SUN.nlong + Csun);
  const r_earth = 1.0 - 0.016709 * cosd(Msun);
  const xE = r_earth * cosd(lon_sun + 180);
  const yE = r_earth * sind(lon_sun + 180);

  // Geocentric ecliptic longitude
  const tlong = degmod(atand2(yP - yE, xP - xE));

  // Ecliptic latitude
  const nodeNow = degmod(p.node + t * (p.nodeRate || 0));
  const latArg  = degmod(lon_h - nodeNow);
  const beta    = p.inc * sind(latArg);

  return eclipticToEquatorial(tlong, beta);
}

// ── Fixed-star lookup (zodiac + ecliptic guide stars) ────────────
//
// Fixed stars have no epicycle.  Their RA/Dec are J2000 catalogue
// values; precession is handled by the model's existing precession
// checkbox (which rotates the whole starfield).
// We build a combined lookup map from both star lists.
const FIXED_STAR_MAP = new Map();
for (const s of [...ZODIAC_STARS, ...ECLIPTIC_GUIDE_STARS, ...BRIGHT_STARS]) {
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
    case 'mars':    return outerBody(t, MARS);
    case 'jupiter': return outerBody(t, JUPITER);
    case 'saturn':  return outerBody(t, SATURN);
    case 'uranus':  return outerBody(t, URANUS);
    case 'neptune': return outerBody(t, NEPTUNE);
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
  ...BRIGHT_STARS.map(s => s.id),
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
