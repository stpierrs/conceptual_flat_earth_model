// Position dispatcher — routes body/date lookups to whichever
// pipeline can cover the request, with a fallback chain for dates
// or bodies the primary source doesn't handle.
//
// Four pipelines: astropixels (default, runs every frame), and three
// comparison pipelines that only run when the Tracker comparison toggle
// is on. The router tries the requested source first, then walks the
// fallback order until it gets a valid reading.
//
// All pipelines expose the same API shape — `bodyGeocentric`,
// `planetEquatorial`, `sunEquatorial`, `moonEquatorial`, plus
// `coversBody` / `coversDate` metadata. Legacy named exports are kept
// for downstream compatibility. Right?

import * as helio from './ephemerisHelio.js';
import * as geo   from './ephemerisGeo.js';
import * as ptol  from './ephemerisPtolemy.js';
import * as apix  from './ephemerisAstropixels.js';

export {
  sunEquatorial as meeusSunEquatorial,
  moonEquatorial as meeusMoonEquatorial,
  greenwichSiderealDeg,
  equatorialToCelestCoord,
  findNextEclipses,
  julianDay,
  meanObliquityDeg,
  norm360,
} from './ephemerisCommon.js';

// The pipeline namespaces, exported so any module that wants to compute
// several readings at once can do that without reimporting individual files.
export { helio, geo, ptol, apix };

export const EPHEMERIS_SOURCES = ['geocentric', 'heliocentric', 'ptolemy', 'astropixels'];
// Uranus and Neptune are covered by the default pipeline only.
// The comparison pipelines don't have outer-planet data yet, so
// they return `{ ra: NaN, dec: NaN }` for those two —
// treat NaN as "no data" in comparison rows and just skip it.
// Pluto is absent — no tabulated source to bundle. Right?
export const PLANET_NAMES = ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
export const BODY_NAMES   = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];

// Pipeline registry — id, namespace, supported-body predicate,
// supported-date predicate. This is what the fallback chain uses to
// route around any pipeline that can't deliver a given body / date. Right?
const PIPES = {
  astropixels:  { ns: apix,  cb: (n) => apix.coversBody(n),  cd: (d) => apix.coversDate(d) },
  geocentric:   { ns: geo,   cb: (n) => geo.coversBody(n),   cd: (d) => geo.coversDate(d) },
  heliocentric: { ns: helio, cb: (n) => helio.coversBody(n), cd: (d) => helio.coversDate(d) },
  ptolemy:      { ns: ptol,  cb: (n) => ptol.coversBody(n),  cd: (d) => ptol.coversDate(d) },
};

// Fallback order when the requested source can't cover a body/date pair —
// tries each pipeline in turn until one returns a valid reading. Right?
const FALLBACK_ORDER = ['astropixels', 'geocentric', 'ptolemy'];

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

// Primary router. Returns `{ ra, dec }` in radians, apparent position.
// Tries the requested source first; if it can't deliver — body not
// supported or date out of range — it walks the fallback chain so we
// always get a usable reading. You can find out which pipeline actually
// produced the value via `bodyRADecRoute(...)`.
export function bodyRADec(name, date, source = 'astropixels') {
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
  // Nothing covered the request — surface NaN so downstream renderers
  // can hide the body cleanly instead of pinning it at the vernal equinox.
  return { ra: NaN, dec: NaN };
}

// Same as `bodyRADec` but also returns which pipeline supplied the
// reading, so the UI can light up a fallback indicator. Right?
export function bodyRADecRoute(name, date, source = 'astropixels') {
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

// Per-pipeline planet API for callers who already know which source
// they want to use.
export function planetEquatorial(name, date, source = 'geocentric') {
  if (source === 'heliocentric') return helio.planetEquatorial(name, date);
  if (source === 'ptolemy')      return ptol.planetEquatorial(name, date);
  if (source === 'astropixels')  return apix.planetEquatorial(name, date);
  return geo.planetEquatorial(name, date);
}

// Sun / Moon routers — each pipeline has its own implementation,
// all returning the same apparent-position shape. Right?
export function sunEquatorial(date, source = 'geocentric') {
  if (source === 'ptolemy')     return ptol.sunEquatorial(date);
  if (source === 'astropixels') return apix.sunEquatorial(date);
  return geo.sunEquatorial(date);
}
export function moonEquatorial(date, source = 'geocentric') {
  if (source === 'ptolemy')     return ptol.moonEquatorial(date);
  if (source === 'astropixels') return apix.moonEquatorial(date);
  return geo.moonEquatorial(date);
}

// Legacy exports — kept for downstream imports that predate the router.
// `bodyGeocentric` and `bodyFromHeliocentric` are compatibility aliases
// kept for downstream imports that predate the router. Right?
export function bodyGeocentric(name, date) { return geo.bodyGeocentric(name, date); }
export const bodyFromHeliocentric = bodyGeocentric;
