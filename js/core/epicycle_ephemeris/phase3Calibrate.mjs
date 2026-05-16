#!/usr/bin/env node
// phase3Calibrate.mjs — Phase 3: fit second-epicycle parameters to DE405.
//
// For each outer body, find (r2, phase) that minimise RMS angular error
// vs the DE405 reference data over 2019–2024.
//
// Method: grid search over r2 ∈ [0, 0.20] × phase ∈ [0°, 360°],
// then Nelder-Mead refinement from the best grid point.
// The second-epicycle correction is purely additive to the geocentric
// longitude — no heliocentric stage, no distance computation.
//
// Output: updated EPI2 table for ephemerisEpicycle2.js.

import { readFileSync } from 'node:fs';
import { bodyGeocentric as epi1 } from './ephemerisEpicycle.js';
import { DEG, RAD, degmod, j2000Day, eclipticToEquatorial,
         eqCenter, eqAnomaly, atand2, cosd, sind } from './epiCore.js';
import { SUN, MARS, JUPITER, SATURN, VENUS, MERCURY, NEPTUNE, URANUS } from './epiParams.js';

// ── Load DE405 reference ────────────────────────────────────────────
const REF = JSON.parse(readFileSync('/home/claude/epicycle_ephemeris/de405_reference.json','utf8'));

// ── Angular separation (radians) between two (ra,dec) in radians ───
function angSep(r1, r2) {
  // Full great-circle formula
  const dra  = r1.ra - r2.ra;
  const sinD = Math.sqrt(
    (Math.cos(r2.dec)*Math.sin(dra))**2 +
    (Math.cos(r1.dec)*Math.sin(r2.dec) - Math.sin(r1.dec)*Math.cos(r2.dec)*Math.cos(dra))**2
  );
  const cosD = Math.sin(r1.dec)*Math.sin(r2.dec) +
               Math.cos(r1.dec)*Math.cos(r2.dec)*Math.cos(dra);
  return Math.atan2(sinD, cosD);  // radians
}

// ── Epi-1 position (re-implemented inline for speed) ───────────────
// Returns { ra, dec } in radians given body params and t (days from J2000)
function sunPos(t) {
  const Ms = degmod(SUN.M0 + t*SUN.nanom);
  const Cs = 1.9146*sind(Ms) + 0.019993*sind(2*Ms);
  return {
    lon: degmod(SUN.L0 + t*SUN.nlong + Cs),
    r:   1.0 - 0.016709*cosd(Ms),
    Ms,  Cs,
  };
}

function outerPos1(t, p) {
  const lambda = degmod(p.L0 + t*p.nlong);
  const M      = degmod(p.M0 + t*p.nanom);
  const eqc    = eqCenter(M, p.ecc);
  const nu     = degmod(M + eqc);
  const lon_h  = degmod(lambda + eqc);
  const r      = p.a*(1-p.ecc*p.ecc)/(1+p.ecc*cosd(nu));
  const sun    = sunPos(t);
  const dx = r*cosd(lon_h) - sun.r*cosd(sun.lon+180);
  const dy = r*sind(lon_h) - sun.r*sind(sun.lon+180);
  const nodeNow = degmod(p.node + t*(p.nodeRate||0));
  const latArg  = degmod(lon_h - nodeNow);
  const beta    = p.inc * sind(latArg);
  return { geo_lon: degmod(atand2(dy,dx)), beta };
}

function innerPos1(t, p) {
  const M      = degmod(p.M0 + t*p.nanom);
  const eqc    = eqCenter(M, p.ecc);
  const nu     = degmod(M + eqc);
  const w      = degmod(p.apogee0 + t*(p.apogeeRate||0));
  const lon_h  = degmod(nu + w);
  const r      = p.a*(1-p.ecc*p.ecc)/(1+p.ecc*cosd(nu));
  const sun    = sunPos(t);
  const dx = r*cosd(lon_h) - sun.r*cosd(sun.lon+180);
  const dy = r*sind(lon_h) - sun.r*sind(sun.lon+180);
  const nodeNow = degmod(p.node + t*(p.nodeRate||0));
  const latArg  = degmod(lon_h - nodeNow);
  const beta    = p.inc * sind(latArg);
  return { geo_lon: degmod(atand2(dy,dx)), beta };
}

// Apply second epicycle correction (additive delta on geocentric longitude)
function applyEpi2(geo_lon, t, p, r2, phase) {
  // Second epicycle anomaly: synodic anomaly + phase offset
  const sun = sunPos(t);
  const lambda = degmod(p.L0 + t*p.nlong);
  const M      = degmod(p.M0 + t*p.nanom);
  const eqc    = eqCenter(M, p.ecc);
  const lon_h  = degmod(lambda + eqc);
  const Msyn   = degmod(lon_h - (sun.lon + sun.Cs));
  const A2     = degmod(Msyn + phase);
  const delta  = eqAnomaly(A2, r2);
  return degmod(geo_lon + delta);
}

function applyInnerEpi2(geo_lon, t, p, r2, phase) {
  const M      = degmod(p.M0 + t*p.nanom);
  const A2     = degmod(M + phase);
  const delta  = eqAnomaly(A2, r2);
  return degmod(geo_lon + delta);
}

// ── RMS error function for one body ────────────────────────────────
function rmsError(body, p, r2, phase, isInner) {
  const rows = REF[body];
  if (!rows || rows.length === 0) return Infinity;
  let sumSq = 0, n = 0;
  for (const row of rows) {
    const date = new Date(row.ts);
    const t    = j2000Day(date);
    let pos1, tlong;
    if (isInner) {
      pos1  = innerPos1(t, p);
      tlong = applyInnerEpi2(pos1.geo_lon, t, p, r2, phase);
    } else {
      pos1  = outerPos1(t, p);
      tlong = applyEpi2(pos1.geo_lon, t, p, r2, phase);
    }
    const result = eclipticToEquatorial(tlong, pos1.beta);
    const sep    = angSep(result, { ra: row.ra, dec: row.dec });
    sumSq += sep * sep;
    n++;
  }
  return Math.sqrt(sumSq / n) * DEG;  // degrees RMS
}

// ── Grid search then Nelder-Mead refinement ─────────────────────────
function gridSearch(body, p, isInner, R2_STEPS=20, PHASE_STEPS=36) {
  let bestR2 = 0, bestPhase = 0, bestRMS = Infinity;
  const r2Max = isInner ? 0.30 : 0.15;
  for (let ir = 0; ir <= R2_STEPS; ir++) {
    const r2 = ir/R2_STEPS * r2Max;
    for (let ip = 0; ip < PHASE_STEPS; ip++) {
      const phase = ip/PHASE_STEPS * 360;
      const rms = rmsError(body, p, r2, phase, isInner);
      if (rms < bestRMS) { bestRMS = rms; bestR2 = r2; bestPhase = phase; }
    }
    process.stdout.write(`    grid ${body}: r2=${r2.toFixed(3)} best=${bestRMS.toFixed(3)}°   \r`);
  }
  return { r2: bestR2, phase: bestPhase, rms: bestRMS };
}

// Nelder-Mead simplex minimiser (2D: r2, phase)
function nelderMead(body, p, isInner, r2_0, phase_0, maxIter=500) {
  const f = ([r2, phase]) => rmsError(body, p, Math.max(0,r2), degmod(phase), isInner);
  const step = 0.02;
  let simplex = [
    [r2_0,        phase_0      ],
    [r2_0+step,   phase_0      ],
    [r2_0,        phase_0+15   ],
  ];
  let fvals = simplex.map(f);

  const α=1, β=0.5, γ=2, σ=0.5;
  for (let iter=0; iter<maxIter; iter++) {
    // Sort
    const order = [0,1,2].sort((a,b)=>fvals[a]-fvals[b]);
    simplex = order.map(i=>simplex[i]);
    fvals   = order.map(i=>fvals[i]);

    if (fvals[2]-fvals[0] < 1e-6) break;

    // Centroid of best 2
    const xo = [(simplex[0][0]+simplex[1][0])/2, (simplex[0][1]+simplex[1][1])/2];
    // Reflect
    const xr = [xo[0]+α*(xo[0]-simplex[2][0]), xo[1]+α*(xo[1]-simplex[2][1])];
    const fr = f(xr);
    if (fr < fvals[0]) {
      // Expand
      const xe = [xo[0]+γ*(xr[0]-xo[0]), xo[1]+γ*(xr[1]-xo[1])];
      const fe = f(xe);
      if (fe < fr) { simplex[2]=xe; fvals[2]=fe; }
      else         { simplex[2]=xr; fvals[2]=fr; }
    } else if (fr < fvals[1]) {
      simplex[2]=xr; fvals[2]=fr;
    } else {
      // Contract
      const xc = [xo[0]+β*(simplex[2][0]-xo[0]), xo[1]+β*(simplex[2][1]-xo[1])];
      const fc = f(xc);
      if (fc < fvals[2]) { simplex[2]=xc; fvals[2]=fc; }
      else {
        // Shrink
        for (let i=1;i<3;i++) {
          simplex[i] = [simplex[0][0]+σ*(simplex[i][0]-simplex[0][0]),
                        simplex[0][1]+σ*(simplex[i][1]-simplex[0][1])];
          fvals[i] = f(simplex[i]);
        }
      }
    }
  }
  const best = simplex[[0,1,2].sort((a,b)=>fvals[a]-fvals[b])[0]];
  return { r2: Math.max(0,best[0]), phase: degmod(best[1]), rms: fvals[0] };
}

// ── Run calibration ─────────────────────────────────────────────────
console.log('\nPhase 3 calibration — fitting second epicycle to DE405\n');

// Also measure baseline (no second epicycle)
function baseline(body, p, isInner) {
  const rows = REF[body];
  if (!rows || rows.length === 0) return Infinity;
  let sumSq = 0;
  for (const row of rows) {
    const date = new Date(row.ts);
    const t    = j2000Day(date);
    const pos  = isInner ? innerPos1(t,p) : outerPos1(t,p);
    const result = eclipticToEquatorial(pos.geo_lon, pos.beta);
    const sep    = angSep(result, { ra: row.ra, dec: row.dec });
    sumSq += sep*sep;
  }
  return Math.sqrt(sumSq/rows.length)*DEG;
}

const PLANETS = [
  { name:'mars',    p:MARS,    inner:false },
  { name:'jupiter', p:JUPITER, inner:false },
  { name:'saturn',  p:SATURN,  inner:false },
  { name:'venus',   p:VENUS,   inner:true  },
  { name:'mercury', p:MERCURY, inner:true  },
];

const results = {};

for (const { name, p, inner } of PLANETS) {
  const base = baseline(name, p, inner);
  console.log(`\n${name.toUpperCase()}  baseline RMS: ${base.toFixed(3)}°`);

  console.log(`  grid search...`);
  const grid = gridSearch(name, p, inner);
  console.log(`  grid best: r2=${grid.r2.toFixed(4)} phase=${grid.phase.toFixed(1)}° RMS=${grid.rms.toFixed(3)}°`);

  console.log(`  Nelder-Mead refinement...`);
  const nm = nelderMead(name, p, inner, grid.r2, grid.phase);
  console.log(`  refined:   r2=${nm.r2.toFixed(4)} phase=${nm.phase.toFixed(1)}° RMS=${nm.rms.toFixed(3)}°`);

  const improvement = ((base - nm.rms)/base*100).toFixed(0);
  console.log(`  improvement: ${base.toFixed(3)}° → ${nm.rms.toFixed(3)}°  (${improvement}% reduction)`);

  results[name] = { r2: nm.r2, phase: nm.phase, baseRMS: base, finalRMS: nm.rms };
}

// ── Print updated EPI2 table ────────────────────────────────────────
console.log('\n\n// ── Updated EPI2 table for ephemerisEpicycle2.js ──────────────────');
console.log('const EPI2 = {');
for (const [name, r] of Object.entries(results)) {
  console.log(`  ${name.padEnd(8)}: { r2: ${r.r2.toFixed(5)}, phase: ${r.phase.toFixed(1)} },  // ${r.baseRMS.toFixed(2)}° → ${r.finalRMS.toFixed(2)}° RMS`);
}
// Keep uranus/neptune unchanged (no DE405 reference fetched yet)
console.log(`  uranus  : { r2: 0.012,   phase: 180.0 },  // from epi2 defaults`);
console.log(`  neptune : { r2: 0.006,   phase: 180.0 },  // from epi2 defaults`);
console.log('};');

// Write results JSON for the next step
import { writeFileSync } from 'node:fs';
writeFileSync('/home/claude/epicycle_ephemeris/phase3_results.json', JSON.stringify(results, null, 2));
console.log('\nWrote phase3_results.json');
