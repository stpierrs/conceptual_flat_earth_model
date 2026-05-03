// Flat-earth disc + dome geometry, all in unitless FE_RADIUS coordinates.

import { ToRad, sqr } from '../math/utils.js';
import { coordToLatLong, localGlobeCoordToGlobalFeCoord } from './transforms.js';
import { latLongToCoord } from './transforms.js';

// We route (lat, lon) → disc xy through whatever map projection is active,
// so the observer and every above-disc anchor share the same coordinate
// framework as the FE grid lines. Right?
import { canonicalLatLongToDisc } from './canonical.js';
import { getProjection } from './projections.js';

export function pointOnFE(latDeg, longDeg, feRadius = 1) {
  const p = canonicalLatLongToDisc(latDeg, longDeg, feRadius);
  return [p[0], p[1], 0];
}

export function pointOnFeMap(latDeg, longDeg, feRadius = 1, projectionId = 'ae') {
  return getProjection(projectionId).project(latDeg, longDeg, feRadius);
}

export function feLatLongToGlobalFeCoord(latDeg, longDeg, feRadius = 1) {
  return pointOnFE(latDeg, longDeg, feRadius);
}

// Dome projection: puts a celestial direction (given by its celestial lat/long)
// onto the vault surface. Two flavours:
//
//   seasonalBand = 0  (default, geometric cap)
//       z = floor + sqrt(R² - r²) · (apex − floor) / R
//       → standard ellipsoidal lift. Not much elevation variation between
//         the tropics because most of the motion happens near r = 0.
//
//   seasonalBand > 0  (stylised sun / moon)
//       z is interpolated linearly across the declination band so the body
//       visibly climbs north (toward Cancer, z → apex) and drops south
//       (toward Capricorn, z → near floor) on its own band of the vault.
//       The radial x/y still comes from the AE projection so the body
//       stays directly above its ground point. You know, the way it should.
export function celestLatLongToVaultCoord(
  latDeg, longDeg, domeSize, domeHeight, feRadius = 1, floor = 0, seasonalBand = 0,
) {
  const domeRadius = domeSize * feRadius;
  const p = canonicalLatLongToDisc(latDeg, longDeg, feRadius);
  const x = p[0];
  const y = p[1];
  const r = Math.hypot(x, y);

  let z;
  if (seasonalBand > 0) {
    // Clamp declination to the body's band and map it linearly across
    // the height range — a little headroom on either end so neither
    // extreme sits exactly on the floor or apex.
    const clamped = Math.max(-seasonalBand, Math.min(seasonalBand, latDeg));
    const norm = 0.5 + 0.5 * (clamped / seasonalBand);   // 0 at south, 1 at north
    const headroom = 0.12;
    const mix = headroom + (1 - 2 * headroom) * norm;    // 0.12..0.88
    z = floor + (domeHeight - floor) * mix;
  } else {
    const zSq = sqr(domeRadius) - sqr(r);
    z = floor + (zSq > 0 ? Math.sqrt(zSq) : 0) * (domeHeight - floor) / domeRadius;
  }
  return [x, y, z];
}

// Direct vault placement: AE projection (x, y) at a fixed altitude z. We use
// this for the sun and moon — their height is set by declination alone and
// stays constant through the day, rather than riding a curved cap whose z
// shifts with the body's projected radius.
export function vaultCoordAt(latDeg, longDeg, z, feRadius = 1) {
  const p = canonicalLatLongToDisc(latDeg, longDeg, feRadius);
  return [p[0], p[1], z];
}

export function celestCoordToVaultCoord(celestVect, domeSize, domeHeight, feRadius = 1) {
  const { lat, lng } = coordToLatLong(celestVect);
  return celestLatLongToVaultCoord(lat, lng, domeSize, domeHeight, feRadius);
}

export function celestLatLongToGlobalFeSphereCoord(
  latDeg, longDeg, length, transMatCelestToGlobe, transMatLocalFeToGlobalFe,
) {
  // celest lat/long direction -> local globe at that length -> global fe frame
  const celestCoord = latLongToCoord(latDeg, longDeg, length);
  // M.Trans import kept local to avoid cycles
  const localGlobeCoord = _trans(transMatCelestToGlobe, celestCoord);
  return localGlobeCoordToGlobalFeCoord(localGlobeCoord, transMatLocalFeToGlobalFe);
}

// Helper: keeps us from importing M here and bloating the module.
function _trans(m, v) {
  const r = m.r, t = m.t;
  return [
    r[0][0]*v[0] + r[0][1]*v[1] + r[0][2]*v[2] + t[0],
    r[1][0]*v[0] + r[1][1]*v[1] + r[1][2]*v[2] + t[1],
    r[2][0]*v[0] + r[2][1]*v[1] + r[2][2]*v[2] + t[2],
  ];
}
