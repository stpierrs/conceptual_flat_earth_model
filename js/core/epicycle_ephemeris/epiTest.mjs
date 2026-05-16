#!/usr/bin/env node
// epiTest.mjs — quick smoke test.
//
// Tests every body at a known date and prints RA/Dec in degrees.
// Cross-check the Sun and Mars positions manually against
// any online ephemeris calculator (e.g. JPL Horizons, Stellarium).
//
// Run:  node epiTest.mjs
//
// Expected (approx) for 2024-03-20 00:00 UTC (near vernal equinox):
//   Sun      RA ~0h  Dec ~0°      (at vernal equinox point)
//   Moon     RA ~varies
//   Mars     RA ~22h Dec ~-13°    (in Aquarius region)
//   Jupiter  RA ~3h  Dec ~15°     (in Taurus)
//   Saturn   RA ~22h Dec ~-13°    (near Mars in Aquarius)
//   Venus    RA ~2h  Dec ~12°     (in Aries)

import { bodyGeocentric } from './ephemerisEpicycle.js';
import { bodyGeocentric as bodyGeocentric2 } from './ephemerisEpicycle2.js';
import { RAD, DEG } from './epiCore.js';

const TEST_DATE = new Date('2024-03-20T00:00:00Z');
const BODIES = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];

function raToHMS(raDeg) {
  const h = raDeg / 15;
  const hInt = Math.floor(h);
  const m = (h - hInt) * 60;
  const mInt = Math.floor(m);
  const s = (m - mInt) * 60;
  return `${String(hInt).padStart(2,'0')}h ${String(mInt).padStart(2,'0')}m ${s.toFixed(1).padStart(4,'0')}s`;
}

function decToDMS(decDeg) {
  const sign = decDeg < 0 ? '-' : '+';
  const abs  = Math.abs(decDeg);
  const d = Math.floor(abs);
  const m = Math.floor((abs - d) * 60);
  const s = ((abs - d) * 60 - m) * 60;
  return `${sign}${String(d).padStart(2,'0')}° ${String(m).padStart(2,'0')}' ${s.toFixed(1).padStart(4,'0')}"`;
}

console.log('\n── Epicycle-1 pipeline ─────────────────────────────');
console.log(`Date: ${TEST_DATE.toISOString()}\n`);
console.log('Body       RA (HMS)                  Dec (DMS)');
console.log('─'.repeat(60));

for (const body of BODIES) {
  const r = bodyGeocentric(body, TEST_DATE);
  if (!r || isNaN(r.ra)) {
    console.log(body.padEnd(12) + 'NaN');
    continue;
  }
  const raDeg  = r.ra  * DEG;
  const decDeg = r.dec * DEG;
  console.log(
    body.padEnd(12) +
    raToHMS(((raDeg % 360) + 360) % 360).padEnd(28) +
    decToDMS(decDeg)
  );
}

console.log('\n── Epicycle-2 pipeline (two-circle stack) ──────────');
console.log('Body       RA (HMS)                  Dec (DMS)');
console.log('─'.repeat(60));

for (const body of BODIES) {
  const r = bodyGeocentric2(body, TEST_DATE);
  if (!r || isNaN(r.ra)) {
    console.log(body.padEnd(12) + 'NaN');
    continue;
  }
  const raDeg  = r.ra  * DEG;
  const decDeg = r.dec * DEG;
  console.log(
    body.padEnd(12) +
    raToHMS(((raDeg % 360) + 360) % 360).padEnd(28) +
    decToDMS(decDeg)
  );
}

console.log('\n── Zodiac stars (fixed, J2000) ──────────────────────');
import { ZODIAC_STARS } from './epiParams.js';
for (const s of ZODIAC_STARS) {
  const r = bodyGeocentric(s.id, TEST_DATE);
  if (!r || isNaN(r.ra)) continue;
  const raDeg  = r.ra  * DEG;
  const decDeg = r.dec * DEG;
  console.log(
    `${s.name} (${s.constellation})`.padEnd(30) +
    raToHMS(((raDeg % 360) + 360) % 360).padEnd(28) +
    decToDMS(decDeg)
  );
}

console.log('\n── Done ─────────────────────────────────────────────\n');
