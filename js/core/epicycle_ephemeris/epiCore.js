// epiCore.js — shared math primitives for the custom epicycle ephemeris.
//
// This module owns:
//   • Degree-mode trig wrappers
//   • Julian Day and J2000 epoch helper
//   • degmod (angle normalisation)
//   • eqCenter  — equation of centre (eccentric geometry)
//   • eqAnomaly — equation of anomaly (epicycle geometry)
//   • eclipticToEquatorial — (λ, β) → { ra, dec } in radians
//   • solveKepler — iterative Kepler-equation solver used when
//     fitting eccentricity from known true-anomaly observations
//
// Frame of reference: Earth-centred throughout.  The Sun's mean
// longitude is the only shared quantity between pipelines, and it
// enters only as an angle, not a distance.  No AU, no km, no G.
//
// Epoch: J2000.0 = JD 2451545.0 = noon 1 Jan 2000 UTC.
// All mean-motion rates are degrees per Julian day.

export const RAD = Math.PI / 180;   // multiply deg → rad
export const DEG = 1 / RAD;         // multiply rad → deg

// Modern IAU obliquity at J2000.0 (degrees).
// Using 23°26'21.448" = 23.4392911°.
export const OBLIQUITY_J2000 = 23.4392911;

// J2000.0 Julian Day number.
export const JD_J2000 = 2451545.0;

// ── Trig helpers (all angles in degrees) ─────────────────────────
export const sind   = x => Math.sin(x * RAD);
export const cosd   = x => Math.cos(x * RAD);
export const tand   = x => Math.tan(x * RAD);
export const asind  = x => Math.asin(Math.max(-1, Math.min(1, x))) * DEG;
export const acosd  = x => Math.acos(Math.max(-1, Math.min(1, x))) * DEG;
export const atand  = x => Math.atan(x) * DEG;
export const atand2 = (y, x) => Math.atan2(y, x) * DEG;

// Normalise angle to [0, 360).
export const degmod = x => ((x % 360) + 360) % 360;

// Normalise angle to (−180, 180].
export const degmod180 = x => { const m = degmod(x); return m > 180 ? m - 360 : m; };

// ── Time ─────────────────────────────────────────────────────────

// Date → Julian Day Number (fractional).
export function julianDay(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

// Date → days elapsed since J2000.0 (signed; fractional).
export function j2000Day(date) {
  return julianDay(date) - JD_J2000;
}

// ── Ecliptic → Equatorial conversion ─────────────────────────────
//
// Standard rotation through the obliquity of the ecliptic.
// λ = ecliptic longitude (deg), β = ecliptic latitude (deg).
// Returns { ra, dec } both in RADIANS to match the existing
// ephemeris pipeline API (projections.js / ephemerisGeo.js).
export function eclipticToEquatorial(lambdaDeg, betaDeg, oblDeg = OBLIQUITY_J2000) {
  const x =  cosd(betaDeg) * cosd(lambdaDeg);
  const y =  cosd(betaDeg) * sind(lambdaDeg) * cosd(oblDeg)
           -  sind(betaDeg) * sind(oblDeg);
  const z =  cosd(betaDeg) * sind(lambdaDeg) * sind(oblDeg)
           +  sind(betaDeg) * cosd(oblDeg);
  const raDeg  = degmod(atand2(y, x));
  const decDeg = atand2(z, Math.sqrt(x * x + y * y));
  return { ra: raDeg * RAD, dec: decDeg * RAD };
}

// ── Equation of centre (eccentric deferent geometry) ─────────────
//
// arctan approximation — used ONLY for the Moon (which compensates
// by multiplying the result by 2).  Do NOT use for planets; the
// arctan formula represents epicycle-deferent geometry and gives
// roughly half the correct Keplerian equation of centre.
export function eqCenter(M, e) {
  return atand(e * sind(M) / (1 + e * cosd(M)));
}

// Keplerian equation of centre — observed-series three-term series.
// Valid to ~0.001° for e ≤ 0.15 (all planets except Mercury).
// For Mercury (e = 0.206) error is ~0.05° — acceptable for our pipeline.
// Returns degrees.  Replaces eqCenter() for all planets except Moon.
export function eqCenterobserved-series(M, e) {
  const e2 = e * e;
  const e3 = e * e2;
  return ((2*e - e3/4) * sind(M) + (5*e2/4) * sind(2*M) + (13*e3/12) * sind(3*M)) * DEG;
}

// ── Equation of anomaly (epicycle geometry) ───────────────────────
//
// Given true epicycle anomaly α (deg) and epicycle radius r
// (fraction of deferent radius), returns the equation of anomaly
// in degrees as seen from Earth.
//
//   eq_a = arctan( r sin α / (1 + r cos α) )
//
// This is the standard single-epicycle correction.  For a
// two-epicycle stack, call this twice with the residual.
export function eqAnomaly(alpha, r) {
  return atand(r * sind(alpha) / (1 + r * cosd(alpha)));
}

// ── Two-epicycle stack ────────────────────────────────────────────
//
// First epicycle (radius r1, mean anomaly A1) corrects the deferent
// position; second epicycle (radius r2, mean anomaly A2 measured
// from the first epicycle's correction) adds the fine residual.
// Returns total equation of anomaly in degrees.
//
// This is the Ibn al-Shatir approach: two compounded circles, no
// heliocentric stage, accuracy comparable to Kepler for most bodies.
export function eqAnomaly2(A1, r1, A2, r2) {
  const eq1   = eqAnomaly(A1, r1);
  const alpha2 = degmod(A2 - eq1);
  const eq2   = eqAnomaly(alpha2, r2);
  return eq1 + eq2;
}

// ── Iterative Kepler solver ───────────────────────────────────────
//
// Solves M = E − e sin E for eccentric anomaly E given mean anomaly
// M (deg) and eccentricity e.  Returns E in degrees.
// Used in calibration scripts, not in the hot render path.
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

// ── True anomaly from eccentric anomaly ───────────────────────────
export function trueAnomaly(E_deg, e) {
  const half = 0.5 * E_deg * RAD;
  return 2 * atand2(Math.sqrt(1 + e) * Math.sin(half),
                    Math.sqrt(1 - e) * Math.cos(half));
}
