// Position dispatcher — Ptolemy's deferent + epicycle (Almagest) is
// the only runtime ephemeris. Astropixels (sky-reference daily lookup) is
// reserved for the eclipse demos in `eclipseRegistry.js` via the
// `apix` namespace export below — the daily lookup is the most
// accurate sun/moon position for eclipse refinement, so that one
// consumer stays wired up. Right?
//
// The router still exposes `bodyRADec` / `bodyRADecRoute` for
// downstream compatibility; with a single live pipeline they just
// always route through Ptolemy.

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

// The pipeline namespaces, exported so any module that wants to compute
// several readings at once can do that without reimporting individual files.
export { ptol, apix };

// User-selectable pipelines. Astropixels is intentionally absent — it's
// reachable only via the `apix` namespace export for the eclipse demos.
export const EPHEMERIS_SOURCES = ['ptolemy'];
// Uranus and Neptune are covered by the default pipeline only.
// The comparison pipelines don't have outer-planet data yet, so
// they return `{ ra: NaN, dec: NaN }` for those two —
// treat NaN as "no data" in comparison rows and just skip it.
// Pluto is absent — no tabulated source to bundle. Right?
export const PLANET_NAMES = ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
export const BODY_NAMES   = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];

// Pipeline registry — id, namespace, supported-body predicate,
// supported-date predicate. `sky-observations` stays registered (not in
// EPHEMERIS_SOURCES) so eclipse demos that explicitly set
// `BodySource: 'sky-observations'` still resolve through the router. Right?
const PIPES = {
  sky-observations:  { ns: apix,  cb: (n) => apix.coversBody(n),  cd: (d) => apix.coversDate(d) },
  ptolemy:      { ns: ptol,  cb: (n) => ptol.coversBody(n),  cd: (d) => ptol.coversDate(d) },
};

// Fallback order — Ptolemy is the runtime engine and covers all bodies
// the model handles. Astropixels is omitted on purpose: it's a
// 2019–2030 daily table and shouldn't catch out-of-range requests by
// accident.
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

// Primary router. Returns `{ ra, dec }` in radians, apparent position.
// Tries the requested source first; if it can't deliver — body not
// supported or date out of range — it walks the fallback chain so we
// always get a usable reading. You can find out which pipeline actually
// produced the value via `bodyRADecRoute(...)`.
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
  // Nothing covered the request — surface NaN so downstream renderers
  // can hide the body cleanly instead of pinning it at the vernal equinox.
  return { ra: NaN, dec: NaN };
}

// Same as `bodyRADec` but also returns which pipeline supplied the
// reading, so the UI can light up a fallback indicator. Right?
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

// Per-pipeline planet API for callers who already know which source
// they want to use. Astropixels stays callable for eclipse-demo paths.
export function planetEquatorial(name, date, source = 'ptolemy') {
  if (source === 'sky-observations')  return apix.planetEquatorial(name, date);
  return ptol.planetEquatorial(name, date);
}

// Sun / Moon routers — Ptolemy + sky-observations (eclipse-demo only).
export function sunEquatorial(date, source = 'ptolemy') {
  if (source === 'sky-observations') return apix.sunEquatorial(date);
  return ptol.sunEquatorial(date);
}
export function moonEquatorial(date, source = 'ptolemy') {
  if (source === 'sky-observations') return apix.moonEquatorial(date);
  return ptol.moonEquatorial(date);
}

// Legacy export — kept for downstream imports that predate the router.
export function bodyGeocentric(name, date) { return ptol.bodyGeocentric(name, date); }
