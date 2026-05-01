// Ephemeris — Ptolemy only.
//
// This whole model runs off ONE pipeline: the Ptolemaic deferent +
// epicycle math in `ephemerisPtolemy.js`, ported from R.H. van Gent's
// "Almagest Ephemeris Calculator". Every sun, moon, and planet
// position you see on screen — every chip in the tracker HUD, every
// trace, every eclipse refinement — comes from that one source.
//
// There used to be four pipelines plugged in here (DE405 / GeoC /
// HelioC / Ptolemy) with a fallback chain and a comparison HUD. They
// got cut. The point of the model is to show the kinematics, and
// once you commit to a single classical pipeline the comparison
// stops being the lesson — the predictions are.
//
// Coverage is whatever Ptolemy covers: sun, moon, mercury, venus,
// mars, jupiter, saturn. Uranus, Neptune, Pluto aren't in the
// Almagest, so they aren't here. Date range is unbounded in both
// directions; precision degrades far from epoch the way you'd expect
// from a 2nd-century model.
//
// Ptolemy port credit:
//   R.H. van Gent, "Almagest Ephemeris Calculator"
//   https://webspace.science.uu.nl/~gent0113/astro/almagestephemeris.htm

import * as ptol from './ephemerisPtolemy.js';
import {
  findNextEclipses as _findNextEclipses,
} from './ephemerisCommon.js';

export {
  greenwichSiderealDeg,
  equatorialToCelestCoord,
  julianDay,
  meanObliquityDeg,
  norm360,
} from './ephemerisCommon.js';

// Re-export Ptolemy's sun and moon under the legacy "Meeus" names that
// downstream callers still import. The Meeus implementations are gone;
// these names now point at the Almagest sun/moon. Same shape, same
// units, same callers.
export const meeusSunEquatorial  = ptol.sunEquatorial;
export const meeusMoonEquatorial = ptol.moonEquatorial;

// Single pipeline, exported as `ptol` so any code that used to grab
// `{ helio, geo, ptol, apix }` can keep grabbing `{ ptol }` cleanly.
export { ptol };

// What this model thinks of as "a body". Pluto / Uranus / Neptune
// aren't in here — Ptolemy didn't know about them, so we don't either.
export const PLANET_NAMES = ['mercury', 'venus', 'mars', 'jupiter', 'saturn'];
export const BODY_NAMES   = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'];

// Legacy name kept around so nothing else has to change. Used to list
// four sources; now there's only the one.
export const EPHEMERIS_SOURCES = ['ptolemy'];

// Routers. They take a `source` argument for backward compatibility,
// but it's ignored — every call lands in Ptolemy.
export function bodyRADec(name, date, _source) {
  if (name === 'earth') return { ra: 0, dec: 0 };
  const r = ptol.bodyGeocentric(name, date);
  if (r && Number.isFinite(r.ra) && Number.isFinite(r.dec)) return r;
  return { ra: NaN, dec: NaN };
}

export function bodyRADecRoute(name, date, _source) {
  if (name === 'earth') return { reading: { ra: 0, dec: 0 }, used: 'ptolemy' };
  return { reading: bodyRADec(name, date), used: 'ptolemy' };
}

export function planetEquatorial(name, date, _source) { return ptol.planetEquatorial(name, date); }
export function sunEquatorial   (date, _source)       { return ptol.sunEquatorial(date); }
export function moonEquatorial  (date, _source)       { return ptol.moonEquatorial(date); }

// Legacy alias. Used to dispatch to the geocentric Kepler pipeline;
// now goes straight through Ptolemy.
export function bodyGeocentric(name, date) { return ptol.bodyGeocentric(name, date); }
export const bodyFromHeliocentric = bodyGeocentric;

// Eclipse finder. The shared finder lives in `ephemerisCommon.js`
// and takes injected sun/moon functions — we hand it Ptolemy's so
// the search runs end-to-end on the same pipeline as everything else.
export function findNextEclipses(startDate, windowDays = 400) {
  return _findNextEclipses(startDate, windowDays, ptol.sunEquatorial, ptol.moonEquatorial);
}
