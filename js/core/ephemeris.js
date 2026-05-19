// Position router — ask for a planet, get back (RA, Dec).
//
// Ptolemy is the runtime engine. Astropixels (sky-reference daily table) is
// kept live for the eclipse demos only — it's the most accurate
// sun/moon position for finding the exact eclipse minute, so that
// one consumer stays wired. Everything else runs through Ptolemy.

import * as ptol  from './ephemerisPtolemy.js';
import * as epi1  from './epicycle_ephemeris/ephemerisEpicycle.js';
import * as epi2  from './epicycle_ephemeris/ephemerisEpicycle2.js';

export {
  greenwichSiderealDeg,
  equatorialToCelestCoord,
  julianDay,
  meanObliquityDeg,
  norm360,
} from './ephemerisCommon.js';

// Pipeline namespaces, exported for callers that need several readings at once.
export { ptol };

export const EPHEMERIS_SOURCES = ['epicycle', 'epicycle2', 'ptolemy'];
// Uranus and Neptune: no Ptolemaic parameters (he never saw them).
// Pluto: no tabulated source at all. NaN = no data, skip the row.
export const PLANET_NAMES = ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
export const BODY_NAMES   = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];

// Pipeline registry.
const PIPES = {
  ptolemy:      { ns: ptol,  cb: (n) => ptol.coversBody(n),  cd: (d) => ptol.coversDate(d) },
  epicycle:     { ns: epi1,  cb: (n) => epi1.coversBody(n),  cd: (d) => epi1.coversDate(d) },
  epicycle2:    { ns: epi2,  cb: (n) => epi2.coversBody(n),  cd: (d) => epi2.coversDate(d) },
};

// Fallback chain: epicycle covers all 9 bodies for any date; ptolemy is last resort.
const FALLBACK_ORDER = ['epicycle', 'ptolemy'];

function _readingValid(r) {
  return r && Number.isFinite(r.ra) && Number.isFinite(r.dec);
}

function _tryPipeline(id, name, date) {
  const p = PIPES[id];
  if (!p) return null;
  if (!p.cb(name) || !p.cd(date)) return null;
  const r = p.ns.bodyGeocentric(name, date);
  return _readingValid(r) ? r : null;
}

// Ask for any body by name, get back { ra, dec } in radians.
// Tries the requested source; if it can't deliver, falls back along the chain.
// Use bodyRADecRoute() if you need to know which pipeline actually answered.
export function bodyRADec(name, date, source = 'epicycle') {
  if (name === 'earth') return { ra: 0, dec: 0 };
  const tried = new Set();
  if (source) {
    const r = _tryPipeline(source, name, date);
    if (r) return r;
    tried.add(source);
  }
  for (const id of FALLBACK_ORDER) {
    if (tried.has(id)) continue;
    const r = _tryPipeline(id, name, date);
    if (r) return r;
    tried.add(id);
  }
  // Nothing covered this — NaN signals "no data" so renderers hide the body.
  return { ra: NaN, dec: NaN };
}

// Same as bodyRADec but tells you which pipeline answered — useful for
// showing a fallback indicator in the UI.
export function bodyRADecRoute(name, date, source = 'epicycle') {
  if (name === 'earth') return { reading: { ra: 0, dec: 0 }, used: source };
  const tried = new Set();
  if (source) {
    const r = _tryPipeline(source, name, date);
    if (r) return { reading: r, used: source };
    tried.add(source);
  }
  for (const id of FALLBACK_ORDER) {
    if (tried.has(id)) continue;
    const r = _tryPipeline(id, name, date);
    if (r) return { reading: r, used: id };
    tried.add(id);
  }
  return { reading: { ra: NaN, dec: NaN }, used: null };
}

// Direct per-pipeline access for callers that know exactly what they want.
export function planetEquatorial(name, date, source = 'epicycle') {
  if (source === 'ptolemy')     return ptol.planetEquatorial(name, date);
  return bodyRADec(name, date, source);
}

// Sun and Moon — epicycle by default.
export function sunEquatorial(date, source = 'epicycle') {
  if (source === 'ptolemy')     return ptol.sunEquatorial(date);
  return bodyRADec('sun', date, source);
}
export function moonEquatorial(date, source = 'epicycle') {
  if (source === 'ptolemy')     return ptol.moonEquatorial(date);
  return bodyRADec('moon', date, source);
}

// Legacy export — uses the primary pipeline.
export function bodyGeocentric(name, date) { return bodyRADec(name, date, 'epicycle'); }
