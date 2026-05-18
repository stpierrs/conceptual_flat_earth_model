#!/usr/bin/env node
// epiValidate.mjs — validation script for the custom epicycle ephemeris.
//
// Compares ephemerisEpicycle.js and ephemerisEpicycle2.js against
// reference positions.  Run from the epicycle_ephemeris/ directory:
//
//   node epiValidate.mjs
//
// The "reference" positions used here are computed from the closed-form
// epoch-2000.0 formulas, which are accurate to
// ~1'–5' for planets and ~1" for the Sun over 2000–2050.

// parent model directory.
//
// Output: one row per body showing mean angular error in degrees for
// each pipeline across a 10-year sample (2000–2010, monthly).

import { bodyGeocentric as epi1 }  from './ephemerisEpicycle.js';
import { bodyGeocentric as epi2 }  from './ephemerisEpicycle2.js';
import { RAD, DEG, j2000Day, degmod } from './epiCore.js';

// ── Reference positions: epoch-2000.0 Sun + simplified planet formulas ──
// Using fitted epoch-2000.0 orbital elements.
// Accurate enough to score the pipeline error.

function refSun(t) {
  // t in Julian days from J2000
  const T   = t / 36525;                     // Julian centuries
  const L0  = 280.46646 + 36000.76983 * T;
  const M   = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  const Mn  = degmod(M);
  const C   = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mn * RAD)
            + (0.019993 - 0.000101 * T) * Math.sin(2 * Mn * RAD)
            +  0.000289 * Math.sin(3 * Mn * RAD);
  const sun_lon = degmod(L0 + C);
  const obl     = 23.439291 - 0.013004 * T;
  const x = Math.cos(sun_lon * RAD);
  const y = Math.cos(obl * RAD) * Math.sin(sun_lon * RAD);
  const z = Math.sin(obl * RAD) * Math.sin(sun_lon * RAD);
  return {
    ra:  Math.atan2(y, x) * DEG,
    dec: Math.atan2(z, Math.sqrt(x*x + y*y)) * DEG,
  };
}

// Reference planet positions (simplified — L, a, e, i, Ω, ω elements)
// Returns { ra, dec } in degrees for a given body name and t (days from J2000).
function refPlanet(name, t) {
  const T = t / 36525;
  // Elements from epoch-2000.0 fitted orbital elements (degrees)
  const EL = {
    mercury: { L: 252.25084 + 149472.67411 * T, a: 0.38709893, e: 0.20563069, i: 7.00487,  Ω: 48.33167,  ω: 77.45645  },
    venus:   { L: 181.97909 +  58517.81538 * T, a: 0.72333199, e: 0.00677323, i: 3.39471,  Ω: 76.68069,  ω: 131.53298 },
    mars:    { L: 355.43300 +  19140.30268 * T, a: 1.52366231, e: 0.09341233, i: 1.85061,  Ω: 49.57854,  ω: 336.04084 },
    jupiter: { L:  34.35148 +   3034.90567 * T, a: 5.20336301, e: 0.04839266, i: 1.30530,  Ω: 100.55615, ω: 14.75385  },
    saturn:  { L:  50.07747 +   1222.11494 * T, a: 9.53707032, e: 0.05415060, i: 2.48446,  Ω: 113.71504, ω: 92.43194  },
    uranus:  { L: 314.05500 +    428.48202 * T, a: 19.1912180, e: 0.04716771, i: 0.76986,  Ω: 74.22988,  ω: 170.96424 },
    neptune: { L: 304.34866 +    218.45900 * T, a: 30.0689634, e: 0.00858587, i: 1.76917,  Ω: 131.72169, ω: 44.97135  },
  };
  const el = EL[name];
  if (!el) return null;

  const Mn = degmod(el.L - el.ω);   // mean anomaly
  // Solve Kepler (2 iterations sufficient for small e)
  let E = Mn * RAD + el.e * Math.sin(Mn * RAD);
  for (let i = 0; i < 5; i++) {
    E = Mn * RAD + el.e * Math.sin(E);
  }
  const nu = 2 * Math.atan2(
    Math.sqrt(1 + el.e) * Math.sin(E / 2),
    Math.sqrt(1 - el.e) * Math.cos(E / 2)
  ) * DEG;

  // Orbital ecliptic coordinates (for reference only — we just
  // need the observer-centered position, which requires the Sun's position too)
  const r = el.a * (1 - el.e * Math.cos(E));
  const lonH = degmod(nu + el.ω);                   // orbital longitude
  const latH = Math.asin(Math.sin((lonH - el.Ω) * RAD) * Math.sin(el.i * RAD)) * DEG;

  // Observer-centered position (approximate: ignore Sun's ecliptic latitude)
  const sun = refSun(t);
  // Use vector difference in ecliptic plane
  const xs_h = r * Math.cos(latH * RAD) * Math.cos(lonH * RAD);
  const ys_h = r * Math.cos(latH * RAD) * Math.sin(lonH * RAD);
  const zs_h = r * Math.sin(latH * RAD);
  // Sun offset vector (approx: R = 1 AU at longitude sun.ra + 180°)
  const sun_lon_ecl = degmod(sun.ra * DEG + (sun.dec > 0 ? 90 : -90));  // rough
  // Better: recompute sun ecliptic longitude directly
  const Mref = degmod(357.52911 + 35999.05029 * T);
  const Cref = 1.914602 * Math.sin(Mref * RAD) + 0.019993 * Math.sin(2 * Mref * RAD);
  const sun_ecl = degmod(280.46646 + 36000.76983 * T + Cref);
  const R = 1.00014 - 0.01671 * Math.cos(Mref * RAD) - 0.00014 * Math.cos(2 * Mref * RAD);

  const xe = xs_h - R * Math.cos(sun_ecl * RAD);
  const ye = ys_h - R * Math.sin(sun_ecl * RAD);
  const ze = zs_h;

  const ecl_lon = degmod(Math.atan2(ye, xe) * DEG);
  const ecl_lat = Math.atan2(ze, Math.sqrt(xe*xe + ye*ye)) * DEG;
  const obl = 23.439291 - 0.013004 * T;
  const x = Math.cos(ecl_lat * RAD) * Math.cos(ecl_lon * RAD);
  const y = Math.cos(obl * RAD) * Math.cos(ecl_lat * RAD) * Math.sin(ecl_lon * RAD)
          - Math.sin(obl * RAD) * Math.sin(ecl_lat * RAD);
  const z = Math.sin(obl * RAD) * Math.cos(ecl_lat * RAD) * Math.sin(ecl_lon * RAD)
          + Math.cos(obl * RAD) * Math.sin(ecl_lat * RAD);
  return {
    ra:  Math.atan2(y, x) * DEG,
    dec: Math.atan2(z, Math.sqrt(x*x + y*y)) * DEG,
  };
}

// Angular separation between two (ra,dec) in degrees
function angSep(a, b) {
  if (!a || !b) return NaN;
  const ra1  = (a.ra  || 0);
  const dec1 = (a.dec || 0);
  const ra2  = (b.ra  || 0);
  const dec2 = (b.dec || 0);
  const dra  = ra1 - ra2;
  const ddec = dec1 - dec2;
  return Math.sqrt(dra * dra + ddec * ddec);  // small-angle approx in rad
}

// ── Run comparison ───────────────────────────────────────────────

const BODIES = ['sun', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];

// Sample: monthly 2000–2010
const SAMPLES = [];
for (let y = 2000; y < 2010; y++) {
  for (let m = 0; m < 12; m++) {
    SAMPLES.push(new Date(Date.UTC(y, m, 15)));
  }
}

console.log('\nEpicycle ephemeris validation vs reference');
console.log('Sample: monthly 2000–2010 (' + SAMPLES.length + ' dates)\n');
console.log(
  'Body       '.padEnd(12) +
  'Epi-1 mean°'.padEnd(14) +
  'Epi-1 max° '.padEnd(14) +
  'Epi-2 mean°'.padEnd(14) +
  'Epi-2 max°'
);
console.log('─'.repeat(68));

for (const body of BODIES) {
  const errs1 = [], errs2 = [];

  for (const date of SAMPLES) {
    const t = j2000Day(date);

    // Reference
    const ref = (body === 'sun') ? refSun(t) : refPlanet(body, t);
    if (!ref) continue;

    // Pipeline 1
    const p1 = epi1(body, date);
    if (p1 && !isNaN(p1.ra)) {
      const sep = angSep(
        { ra: p1.ra * DEG,  dec: p1.dec * DEG  },
        { ra: ref.ra,        dec: ref.dec        }
      );
      errs1.push(Math.abs(sep) * DEG);
    }

    // Pipeline 2
    const p2 = epi2(body, date);
    if (p2 && !isNaN(p2.ra)) {
      const sep = angSep(
        { ra: p2.ra * DEG,  dec: p2.dec * DEG  },
        { ra: ref.ra,        dec: ref.dec        }
      );
      errs2.push(Math.abs(sep) * DEG);
    }
  }

  const mean1 = errs1.length ? (errs1.reduce((a,b)=>a+b,0)/errs1.length).toFixed(3) : '—';
  const max1  = errs1.length ? Math.max(...errs1).toFixed(3) : '—';
  const mean2 = errs2.length ? (errs2.reduce((a,b)=>a+b,0)/errs2.length).toFixed(3) : '—';
  const max2  = errs2.length ? Math.max(...errs2).toFixed(3) : '—';

  console.log(
    body.padEnd(12) +
    String(mean1).padEnd(14) +
    String(max1).padEnd(14) +
    String(mean2).padEnd(14) +
    String(max2)
  );
}

console.log('\nNote: errors in radians converted to degrees (small-angle approx).');
console.log('Uranus/Neptune from simplified elements — accuracy ~1°.\n');
