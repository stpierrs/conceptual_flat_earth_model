// Position router — ask for a planet, get back (RA, Dec).
//
// Ptolemy is the runtime engine. Astropixels (DE405 daily table) is
// kept live for the eclipse demos only — it's the most accurate
// sun/moon position for finding the exact eclipse minute, so that
// one consumer stays wired. Everything else runs through Ptolemy.

import * as ptol  from './ephemerisPtolemy.js';
import * as apix  from './ephemerisAstropixels.js';

export {
  greenwichSiderealDeg,
  equatorialToCelestCoord,
  findNextEclipses,
  julianDay,
  meanObliquityDeg,
  norm360,
} from './ephemerisCommon.js';

// Pipeline namespaces, exported for callers that need several readings at once.
export { ptol, apix };

// Ptolemy is the only selectable source. Astropixels is eclipse-demo only.
export const EPHEMERIS_SOURCES = ['ptolemy'];
// Uranus and Neptune: no Ptolemaic parameters (he never saw them).
// Pluto: no tabulated source at all. NaN = no data, skip the row.
export const PLANET_NAMES = ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
export const BODY_NAMES   = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];

// Pipeline registry. Astropixels stays wired so eclipse demos that set
// BodySource: 'astropixels' still resolve — it just isn't user-selectable.
const PIPES = {
  astropixels:  { ns: apix,  cb: (n) => apix.coversBody(n),  cd: (d) => apix.coversDate(d) },
  ptolemy:      { ns: ptol,  cb: (n) => ptol.coversBody(n),  cd: (d) => ptol.coversDate(d) },
};

// Fallback chain — Ptolemy covers everything. Astropixels is intentionally
// excluded: it's a 2019–2030 daily table and shouldn't catch strays.
const FALLBACK_ORDER = ['ptolemy'];

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
// Tries the requested source; if it can't deliver, falls back to Ptolemy.
// Use bodyRADecRoute() if you need to know which pipeline actually answered.
export function bodyRADec(name, date, source = 'ptolemy') {
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
export function bodyRADecRoute(name, date, source = 'ptolemy') {
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
export function planetEquatorial(name, date, source = 'ptolemy') {
  if (source === 'astropixels')  return apix.planetEquatorial(name, date);
  return ptol.planetEquatorial(name, date);
}

// Sun and Moon — Ptolemy by default, astropixels only for eclipse demos.
export function sunEquatorial(date, source = 'ptolemy') {
  if (source === 'astropixels') return apix.sunEquatorial(date);
  return ptol.sunEquatorial(date);
}
export function moonEquatorial(date, source = 'ptolemy') {
  if (source === 'astropixels') return apix.moonEquatorial(date);
  return ptol.moonEquatorial(date);
}

// Legacy export for older imports.
export function bodyGeocentric(name, date) { return ptol.bodyGeocentric(name, date); }
