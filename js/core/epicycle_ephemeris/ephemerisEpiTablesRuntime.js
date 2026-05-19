// ephemerisEpiTablesRuntime.js — table-lookup runtime for ephemerisEpiTables.js.
//
// API: bodyGeocentric(name, date) → { ra, dec } in radians.
// Interpolation: linear between adjacent midnight values.
//
// Coverage: whatever years were built into ephemerisEpiTables.js.
// Default build: 1800–2200.  The analytic fallback (ephemerisEpicycle.js)
// handles any date outside that window if wired into the fallback chain.

import { EPITABLES } from './ephemerisEpiTables.js';
import { DEG, RAD }  from './epiCore.js';

const MS_PER_DAY = 86_400_000;
const { yearMin, yearMax } = EPITABLES.meta;

// Convert [raSec, decArcsec] → { ra (rad), dec (rad) }
function decode(raSec, decArcsec) {
  return {
    ra:  (raSec  / 240)  * RAD,   // seconds of time → degrees → radians
    dec: (decArcsec / 3600) * RAD, // arcseconds → degrees → radians
  };
}

// Is year covered by the table?
function coversYear(y) { return y >= yearMin && y <= yearMax; }

// Get the flat pair array for (body, year). Returns null if not available.
function getYearArray(body, year) {
  const bd = EPITABLES[body];
  if (!bd) return null;
  return bd[year] ?? null;
}

// Linear interpolation between day D and D+1 within a year's array.
// frac is the fractional part of the day (0 = midnight, 0.5 = noon).
function interpolateYear(arr, doy, frac) {
  const n = arr.length / 2;          // number of days in this year
  const i = Math.max(0, Math.min(doy, n - 1));
  const j = Math.min(i + 1, n - 1);

  const ra0  = arr[i * 2],     dec0  = arr[i * 2 + 1];
  const ra1  = arr[j * 2],     dec1  = arr[j * 2 + 1];

  // Handle RA wraparound (0/86400 boundary)
  let dRa = ra1 - ra0;
  if (dRa >  43200) dRa -= 86400;
  if (dRa < -43200) dRa += 86400;

  const raSec    = ra0  + dRa            * frac;
  const decArcs  = dec0 + (dec1 - dec0)  * frac;

  return decode(raSec, decArcs);
}

// Main lookup: geocentric apparent { ra, dec } for a body at a JS Date.
export function bodyGeocentric(name, date) {
  const ms   = date.getTime();
  const year = date.getUTCFullYear();

  if (!coversYear(year)) return { ra: NaN, dec: NaN };

  const arr = getYearArray(name, year);
  if (!arr) return { ra: NaN, dec: NaN };

  // Day-of-year (0-based) and fractional hour
  const jan1Ms = Date.UTC(year, 0, 1, 0, 0, 0);
  const dayF   = (ms - jan1Ms) / MS_PER_DAY;   // e.g. 5.5 = June 5, noon
  const doy    = Math.floor(dayF);
  const frac   = dayF - doy;

  // For dates spanning Dec 31 → Jan 1 (frac interpolation crosses year boundary):
  // If doy is the last day of the year and frac > 0, interpolate into next year.
  const daysThisYear = arr.length / 2;
  if (doy >= daysThisYear - 1 && frac > 0 && coversYear(year + 1)) {
    const arrNext = getYearArray(name, year + 1);
    if (arrNext) {
      const ra0  = arr[(daysThisYear - 1) * 2],     dec0  = arr[(daysThisYear - 1) * 2 + 1];
      const ra1  = arrNext[0],                       dec1  = arrNext[1];
      let dRa = ra1 - ra0;
      if (dRa >  43200) dRa -= 86400;
      if (dRa < -43200) dRa += 86400;
      return decode(ra0 + dRa * frac, dec0 + (dec1 - dec0) * frac);
    }
  }

  return interpolateYear(arr, doy, frac);
}

// Coverage checks
export const SUPPORTED_BODIES = new Set(EPITABLES.meta.bodies);
export function coversBody(name) { return SUPPORTED_BODIES.has(name); }
export function coversDate(date) {
  const y = date.getUTCFullYear();
  return y >= yearMin && y <= yearMax;
}

export const BUILTIN_CORRECTIONS = {
  precession: false,
  nutation:   false,
  aberration: false,
  fk5:        false,
};

export const PIPELINE_LABEL = 'EpiTable';
export const PIPELINE_ID    = 'epitables';
