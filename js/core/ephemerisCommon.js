// Shared coordinate utilities used by the Ptolemy pipeline and eclipse demos.
//
// RA, Dec, obliquity, sidereal time — these are coordinate labels, not
// a cosmology. The Almanac compilers measured these values by watching the
// sky for centuries. We use the same numbers; we just don't attach a story
// about why the sky behaves that way.

export const DEG = Math.PI / 180;

export function norm360(x) { return ((x % 360) + 360) % 360; }

// Julian Day number from a JS Date (UTC).
export function julianDay(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

// The obliquity — the tilt of the sun's annual track against the celestial
// equator. About 23.4°. You can measure it yourself: watch where the sun
// rises and sets over a full year, that angle is it.
export function meanObliquityDeg(T) {
  return 23 + 26 / 60 + 21.448 / 3600
       - (46.8150 * T + 0.00059 * T * T - 0.001813 * T * T * T) / 3600;
}

// Where the moon's path crosses the sun's track. Drifts around every 18.6
// years — you can watch it shift over time. Drives the nutation wobble.
export function moonNodeOmegaDeg(T) {
  return norm360(125.04452 - 1934.136261 * T + 0.0020708 * T * T + T * T * T / 450000);
}

// Where is the sun right now? RA and Dec in radians, apparent-of-date.
export function sunEquatorial(date) {
  const jd = julianDay(date);
  const T  = (jd - 2451545.0) / 36525;

  const L0 = norm360(280.46646 + 36000.76983 * T + 0.0003032 * T * T);
  const M  = norm360(357.52911 + 35999.05029 * T - 0.0001537 * T * T);
  const MR = M * DEG;
  const e  = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T;
  const C  = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(MR)
           + (0.019993 - 0.000101 * T) * Math.sin(2 * MR)
           +  0.000289                  * Math.sin(3 * MR);
  const lambdaTrue = L0 + C;
  const omegaDeg = moonNodeOmegaDeg(T);
  const omega    = omegaDeg * DEG;
  const lambda   = lambdaTrue - 0.00569 - 0.00478 * Math.sin(omega);
  const epsDeg   = meanObliquityDeg(T) + 0.00256 * Math.cos(omega);
  const lamR = lambda * DEG;
  const epsR = epsDeg * DEG;
  const ra   = Math.atan2(Math.cos(epsR) * Math.sin(lamR), Math.cos(lamR));
  const dec  = Math.asin(Math.sin(epsR) * Math.sin(lamR));
  return { ra, dec };
}

// Where is the moon right now? RA and Dec in radians, apparent-of-date.
// 27 longitude terms and 18 latitude terms — the moon wanders enough
// that you need that many to nail its position to ~10 arcseconds.
export function moonEquatorial(date) {
  const jd = julianDay(date);
  const d = jd - 2451545.0;
  const T = d / 36525;

  const L0 = norm360(218.3164477 + 481267.88123421 * T - 0.0015786 * T * T);
  const D  = norm360(297.8501921 + 445267.1114034  * T - 0.0018819 * T * T);
  const M  = norm360(357.5291092 +  35999.0502909  * T - 0.0001536 * T * T);
  const Mp = norm360(134.9633964 + 477198.8675055  * T + 0.0087414 * T * T);
  const F  = norm360(93.2720950  + 483202.0175233  * T - 0.0036539 * T * T);

  const DR = D * DEG, MR = M * DEG, MpR = Mp * DEG, FR = F * DEG;

  const dLam =
      6.288774 * Math.sin(MpR)
   + -1.274027 * Math.sin(2 * DR - MpR)
   +  0.658314 * Math.sin(2 * DR)
   +  0.213618 * Math.sin(2 * MpR)
   + -0.185116 * Math.sin(MR)
   + -0.114332 * Math.sin(2 * FR)
   +  0.058793 * Math.sin(2 * DR - 2 * MpR)
   +  0.057066 * Math.sin(2 * DR - MR - MpR)
   +  0.053322 * Math.sin(2 * DR + MpR)
   +  0.045758 * Math.sin(2 * DR - MR)
   + -0.040923 * Math.sin(MR - MpR)
   + -0.034720 * Math.sin(DR)
   + -0.030383 * Math.sin(MR + MpR)
   +  0.015327 * Math.sin(2 * DR - 2 * FR)
   + -0.012528 * Math.sin(MpR + 2 * FR)
   +  0.010980 * Math.sin(MpR - 2 * FR)
   +  0.010675 * Math.sin(4 * DR - MpR)
   +  0.010034 * Math.sin(3 * MpR)
   +  0.008548 * Math.sin(4 * DR - 2 * MpR)
   + -0.007888 * Math.sin(2 * DR + MR - MpR)
   + -0.006766 * Math.sin(2 * DR + MR)
   + -0.005163 * Math.sin(DR - MpR)
   +  0.004987 * Math.sin(DR + MR)
   +  0.004036 * Math.sin(2 * DR - MR + MpR)
   +  0.003994 * Math.sin(2 * DR + 2 * MpR)
   +  0.003861 * Math.sin(4 * DR)
   +  0.003665 * Math.sin(2 * DR - 3 * MpR);

  const beta =
      5.128122 * Math.sin(FR)
   +  0.280602 * Math.sin(MpR + FR)
   +  0.277693 * Math.sin(MpR - FR)
   +  0.173237 * Math.sin(2 * DR - FR)
   +  0.055413 * Math.sin(2 * DR - MpR + FR)
   +  0.046271 * Math.sin(2 * DR - MpR - FR)
   +  0.032573 * Math.sin(2 * DR + FR)
   +  0.017198 * Math.sin(2 * MpR + FR)
   +  0.009266 * Math.sin(2 * DR + MpR - FR)
   +  0.008822 * Math.sin(2 * MpR - FR)
   +  0.008216 * Math.sin(2 * DR - MR - FR)
   +  0.004324 * Math.sin(2 * DR - 2 * MpR - FR)
   +  0.004200 * Math.sin(2 * DR + MpR + FR)
   + -0.003359 * Math.sin(2 * DR + MR - FR)
   +  0.002463 * Math.sin(2 * DR - MR - MpR + FR)
   +  0.002211 * Math.sin(2 * DR - MR + FR)
   +  0.002065 * Math.sin(2 * DR - MR - MpR - FR)
   + -0.001870 * Math.sin(MR - MpR - FR);

  const omegaDeg = moonNodeOmegaDeg(T);
  const omega    = omegaDeg * DEG;
  const lambda   = norm360(L0 + dLam) - 0.00478 * Math.sin(omega);
  const epsDeg   = meanObliquityDeg(T) + 0.00256 * Math.cos(omega);

  const lamR = lambda * DEG;
  const betR = beta * DEG;
  const epsR = epsDeg * DEG;
  const ra = Math.atan2(
    Math.sin(lamR) * Math.cos(epsR) - Math.tan(betR) * Math.sin(epsR),
    Math.cos(lamR),
  );
  const dec = Math.asin(
    Math.sin(betR) * Math.cos(epsR)
      + Math.cos(betR) * Math.sin(epsR) * Math.sin(lamR),
  );
  return { ra, dec };
}

// How far has the sky rotated since midnight at Greenwich? That's all
// sidereal time is — clock arithmetic telling you where the sky is now.
export function greenwichSiderealDeg(date) {
  const jd = julianDay(date);
  const T = (jd - 2451545.0) / 36525;
  const gst = 280.46061837
            + 360.98564736629 * (jd - 2451545.0)
            + 0.000387933 * T * T
            - (T * T * T) / 38710000;
  return norm360(gst);
}

// Turns (RA, Dec) into a direction vector pointing at that spot in the sky.
export function equatorialToCelestCoord({ ra, dec }) {
  const cd = Math.cos(dec);
  return [cd * Math.cos(ra), cd * Math.sin(ra), Math.sin(dec)];
}

// Star catalogs record where a star was at J2000.0. This nudges those
// coordinates to where the star actually appears tonight — three small
// observed corrections you can toggle independently:
//
//   precession: the slow drift of the pole (~20' over decades — you
//               can watch Polaris drift off-axis over a lifetime)
//   nutation:   the small ±9" wobble riding on top of that
//   aberration: the ±20" annual sway every star makes as the observer
//               moves — measured by Bradley in 1725, pure observation
//
// All three default on. Pass { precession, nutation, aberration } bools
// to toggle any of them. The "Trepidation" UI switch just flips all
// three at once.
export function apparentStarPosition(raJ2000, decJ2000, date, opts) {
  const {
    precession = true,
    nutation   = true,
    aberration = true,
  } = opts || {};
  const jd = julianDay(date);
  const T  = (jd - 2451545.0) / 36525;
  const AS = Math.PI / (180 * 3600);

  let ra  = raJ2000;
  let dec = decJ2000;

  // Shared across nutation + aberration branches. Computing once even
  // if only one is active costs a handful of ops — trivial.
  const omega = moonNodeOmegaDeg(T) * DEG;
  const eps   = meanObliquityDeg(T) * DEG;

  // --- Precession (IAU standard rotation angles) ---
  if (precession) {
    const zeta  = (2306.2181 * T + 0.30188 * T * T + 0.017998 * T * T * T) * AS;
    const z     = (2306.2181 * T + 1.09468 * T * T + 0.018203 * T * T * T) * AS;
    const theta = (2004.3109 * T - 0.42665 * T * T - 0.041833 * T * T * T) * AS;
    const raZ      = ra + zeta;
    const cosDec0  = Math.cos(dec);
    const sinDec0  = Math.sin(dec);
    const cosRaZ   = Math.cos(raZ);
    const sinRaZ   = Math.sin(raZ);
    const cosTheta = Math.cos(theta);
    const sinTheta = Math.sin(theta);
    const A = cosDec0 * sinRaZ;
    const B = cosTheta * cosDec0 * cosRaZ - sinTheta * sinDec0;
    const C = sinTheta * cosDec0 * cosRaZ + cosTheta * sinDec0;
    ra  = Math.atan2(A, B) + z;
    dec = Math.asin(Math.max(-1, Math.min(1, C)));
  }

  // --- Nutation (two-term low-accuracy model) ---
  if (nutation) {
    const dPsi = -17.20 * Math.sin(omega) * AS;
    const dEps =   9.20 * Math.cos(omega) * AS;
    const dRa = (Math.cos(eps) + Math.sin(eps) * Math.sin(ra) * Math.tan(dec)) * dPsi
              - Math.cos(ra) * Math.tan(dec) * dEps;
    const dDec = Math.sin(eps) * Math.cos(ra) * dPsi
               + Math.sin(ra) * dEps;
    ra  += dRa;
    dec += dDec;
  }

  // --- Annual aberration (first-order) ---
  if (aberration) {
    const K_AB = 20.49552 * AS;
    const L0s  = norm360(280.46646 + 36000.76983 * T + 0.0003032 * T * T);
    const Ms   = norm360(357.52911 + 35999.05029 * T - 0.0001537 * T * T);
    const MRs  = Ms * DEG;
    const Cs   = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(MRs)
               + (0.019993 - 0.000101 * T) * Math.sin(2 * MRs)
               +  0.000289                  * Math.sin(3 * MRs);
    const lambdaSun = (L0s + Cs - 0.00569 - 0.00478 * Math.sin(omega)) * DEG;

    const cosL = Math.cos(lambdaSun);
    const sinL = Math.sin(lambdaSun);
    const cosA = Math.cos(ra);
    const sinA = Math.sin(ra);
    const cosD = Math.cos(dec);
    const sinD = Math.sin(dec);
    const cosE = Math.cos(eps);
    const sinE = Math.sin(eps);
    const tanE = sinE / cosE;

    const dRaAb  = -K_AB * (cosA * cosL * cosE + sinA * sinL) / cosD;
    const dDecAb = -K_AB * (cosL * cosE * (tanE * cosD - sinA * sinD)
                          + cosA * sinD * sinL);
    ra  += dRaAb;
    dec += dDecAb;
  }

  ra = ((ra % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return { ra, dec };
}

// Eclipse finder — steps through time looking for the sun and moon to
// get close. When they line up within ~1.5°, that's your eclipse.
// Accurate enough to find the right day for any date 1900–2100.
const ECLIPSE_ANG_THRESHOLD = 1.5 * DEG;

function sepAngle(a, b) {
  const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return Math.acos(Math.max(-1, Math.min(1, d)));
}

// Accepts optional sunFn / moonFn so each ephemeris pipeline can scan
// using its own positions — each one finds the eclipse it predicts.
export function findNextEclipses(startDate, windowDays = 400, sunFn = sunEquatorial, moonFn = moonEquatorial) {
  const stepMs = 3600 * 1000;
  const start = startDate.getTime();
  let nextSolar = null;
  let nextLunar = null;

  let prevSolar = null, prevPrevSolar = null;
  let prevLunar = null, prevPrevLunar = null;

  const totalSteps = windowDays * 24;
  for (let i = 0; i <= totalSteps; i++) {
    const t = new Date(start + i * stepMs);
    const sunVec  = equatorialToCelestCoord(sunFn(t));
    const moonVec = equatorialToCelestCoord(moonFn(t));
    const antiMoon = [-moonVec[0], -moonVec[1], -moonVec[2]];
    const solarSep = sepAngle(sunVec, moonVec);
    const lunarSep = sepAngle(sunVec, antiMoon);

    if (!nextSolar && prevPrevSolar !== null
        && prevSolar <= prevPrevSolar && prevSolar <= solarSep
        && prevSolar < ECLIPSE_ANG_THRESHOLD) {
      nextSolar = new Date(start + (i - 1) * stepMs);
    }
    if (!nextLunar && prevPrevLunar !== null
        && prevLunar <= prevPrevLunar && prevLunar <= lunarSep
        && prevLunar < ECLIPSE_ANG_THRESHOLD) {
      nextLunar = new Date(start + (i - 1) * stepMs);
    }
    if (nextSolar && nextLunar) break;

    prevPrevSolar = prevSolar; prevSolar = solarSep;
    prevPrevLunar = prevLunar; prevLunar = lunarSep;
  }

  return { nextSolar, nextLunar };
}

// Zoom in on a candidate eclipse time — scan ±2 hours in 1-minute steps,
// find the moment of closest approach. Each pipeline finds its own answer,
// which is the whole point of having multiple pipelines to compare.
export function refineEclipseByMinSeparation(approxDate, sunFn, moonFn, { kind = 'solar', halfWindowMinutes = 120 } = {}) {
  const stepMs = 60 * 1000;
  let bestT = approxDate.getTime();
  let bestSep = Infinity;
  for (let k = -halfWindowMinutes; k <= halfWindowMinutes; k++) {
    const t = approxDate.getTime() + k * stepMs;
    const d = new Date(t);
    const sun  = sunFn(d);
    const moon = moonFn(d);
    let ra2 = moon.ra, dec2 = moon.dec;
    if (kind === 'lunar') { ra2 += Math.PI; dec2 = -dec2; }  // anti-moon
    const dot = Math.cos(sun.dec) * Math.cos(dec2) * Math.cos(sun.ra - ra2)
              + Math.sin(sun.dec) * Math.sin(dec2);
    const sep = Math.acos(Math.max(-1, Math.min(1, dot)));
    if (sep < bestSep) { bestSep = sep; bestT = t; }
  }
  return { date: new Date(bestT), minSeparationRad: bestSep };
}
