// This is the ephemeris engine. Every planet you see moving across the sky
// in this model gets its position from here, every single frame.
//
// The whole thing is Ptolemy — deferent circle carrying an epicycle, Earth
// sitting in the middle. That's the Almagest (c. 150 CE). Ptolemy watched
// the planets for decades, measured where they were, built tables from
// those measurements, and the sky kept matching the tables. That's what
// this code runs.
//
// It lands about 1°–2° off for the classical planets compared to where
// they are today. Ptolemy knew that — his own tables have the same offset.
// That's not a bug; that's the historical model doing exactly what the
// historical model does.
//
// Earth-centred throughout. No Sun-relative stage. No coordinate
// subtraction. No heliocentric anything. Each planet's longitude comes
// straight from adding up the deferent equation of centre and the epicycle
// equation of anomaly on top of its mean longitude. That's it.
//
// The obliquity is Ptolemy's own measured value (23°51'20"), not the
// modern number. Same observation, different observer, different century.
//
// Constants are from R.H. van Gent's Almagest Ephemeris Calculator —
// a careful transcription of Ptolemy's sexagesimal tables. The sexagesimal
// literals are preserved exactly so you can check them against the Almagest
// yourself.

import { DEG } from './ephemerisCommon.js';

// ------------------------------------------------------------------
// Epoch and time
// ------------------------------------------------------------------
//
// Ptolemy pinned his tables to 1 Thoth of Nabonassar year 1 — about
// noon in Alexandria, 26 February 747 BCE. Everything in the Almagest
// is measured from that day. The small time offset bakes in Alexandria's
// longitude (30° E) so the tables stay consistent with Ptolemy's own
// observations.
const JD_EPOCH = 1448637 + (22 - (17 + 34 / 60) / 60) / 24;

function julianDay(date) { return date.getTime() / 86400000 + 2440587.5; }
function ptolemyDay(date) { return julianDay(date) - JD_EPOCH; }

// ------------------------------------------------------------------
// Sexagesimal → decimal (preserves van Gent's source literals)
// ------------------------------------------------------------------
function sex(...parts) {
  let value = 0;
  let factor = 1;
  for (const p of parts) { value += p * factor; factor /= 60; }
  return value;
}

// Degree-trig helpers (Almagest math is all in degrees).
const sind   = x => Math.sin(x * DEG);
const cosd   = x => Math.cos(x * DEG);
const asind  = x => Math.asin(x) / DEG;
const atand  = x => Math.atan(x) / DEG;
const atand2 = (y, x) => Math.atan2(y, x) / DEG;
const degmod = x => ((x % 360) + 360) % 360;
const sgn    = x => x < 0 ? -1 : x > 0 ? 1 : 0;

// ------------------------------------------------------------------
// Ptolemaic orbital constants — straight from the Almagest tables
// ------------------------------------------------------------------
//
// Angles in degrees, mean-motion rates in degrees per day. These
// numbers come from centuries of observation — Ptolemy and the
// Babylonian astronomers before him watching the same sky and writing
// down what they saw. Sexagesimal notation preserved verbatim so
// you can cross-check against the Almagest directly.

// Sun
const nsunlong    = sex(  0,59, 8,17,13,12,31);  // mean longitude / day
const mlongsun0   = sex(330,45, 0);              // mean longitude at epoch
const apogeesun   = sex( 65,30, 0);              // solar apogee (tropical)
const eccsun      = sex(  0, 2,30);              // eccentricity (Ptolemy: 2;30 = 1/24)
const obliquity   = sex( 23,51,20);              // Ptolemy's obliquity

// Moon
const nlongmoon   = sex( 13,10,34,58,33,30,30);
const nanommoon   = sex( 13, 3,53,56,17,51,59);
const nlatargmoon = sex( 13,13,45,39,48,56,37);
const nelongmoon  = sex( 12,11,26,41,20,17,59);
const mlongmoon0  = sex( 41,22, 0);
const manommoon0  = sex(268,49, 0);
const latargmoon0 = sex(354,15, 0);
const melongmoon0 = sex( 70,37, 0);
const epimoon     = sex(  0, 6,20);   // epicycle radius (deferent = 60)
const eccmoon     = sex(  0,12,29);   // deferent eccentricity
const incmoon     = sex(  5, 0, 0);   // lunar-orbit inclination

// Saturn
const nlongsat    = sex(  0, 2, 0,33,31,28,51);
const nepianomsat = sex(  0,57, 7,43,41,43,40);
const apogeesat0  = sex(224,10, 0);
const episat      = sex(  0, 6,30);
const eccsat      = sex(  0, 3,25);
const incsat0     = sex(  2,30, 0);
const incsat1     = sex(  4,30, 0);
const nodesat     = sex( 50, 0, 0);
const mepisat_epoch     = 296 + 43 / 60;   // from van Gent almagestpos()
const mepianomsat_epoch = 34 + 2 / 60;

// Jupiter
const nlongjup    = sex(  0, 4,59,14,26,46,31);
const nepianomjup = sex(  0,54, 9, 2,46,26, 0);
const apogeejup0  = sex(152, 9, 0);
const epijup      = sex(  0,11,30);
const eccjup      = sex(  0, 2,45);
const incjup0     = sex(  1,30, 0);
const incjup1     = sex(  2,30, 0);
const nodejup     = sex(340, 0, 0);
const mepijup_epoch     = 184 + 41 / 60;
const mepianomjup_epoch = 146 + 4 / 60;

// Mars
const nlongmar    = sex(  0,31,26,36,53,51,33);
const nepianommar = sex(  0,27,41,40,19,20,58);
const apogeemar0  = sex(106,40, 0);
const epimar      = sex(  0,39,30);
const eccmar      = sex(  0, 6, 0);
const incmar0     = sex(  1, 0, 0);
const incmar1     = sex(  2,15, 0);
const nodemar     = 0;
const mepimar_epoch     = 3 + 32 / 60;
const mepianommar_epoch = 327 + 13 / 60;

// Venus
const nepianomven = sex(  0,36,59,25,53,11,28);
const apogeeven0  = sex( 46,10, 0);
const epiven      = sex(  0,43,10);
const eccven      = sex(  0, 1,15);
const incven0     = sex(  0,10, 0);
const incven1_raw = sex(  2,30, 0);   // van Gent negates: incve1 = −sex2dec(incven1)
const incven2     = sex(  3,30, 0);
const mepianomven_epoch = 71 + 7 / 60;

// Mercury
const nepianommer = sex(  3, 6,24, 6,59,35,50);
const apogeemer0  = sex(181,10, 0);
const epimer      = sex(  0,22,30);
const eccmer      = sex(  0, 3, 0);
const incmer0_raw = sex(  0,45, 0);   // negated by van Gent
const incmer1     = sex(  6,15, 0);
const incmer2_raw = sex(  7, 0, 0);   // negated by van Gent
const mepianommer_epoch = 21 + 55 / 60;

// ------------------------------------------------------------------
// Core deferent+epicycle math
// ------------------------------------------------------------------
//
// `eqplan` — the engine for Venus, Mars, Jupiter, Saturn. Big circle
// (deferent) carrying a smaller circle (epicycle) carrying the planet.
// You give it where the planet is on each circle, it gives back how
// far the geometry pushes the planet from its mean position.
//   n=1 → equation of centre (deferent correction)
//   n=2 → equation of anomaly (epicycle correction)
//   n=3 → distance (deferent-radius units)
function eqplan(n, ecc, epi, meccanom, mepianom) {
  const esin = ecc * sind(meccanom);
  const ecos = ecc * cosd(meccanom);
  const a    = ecos + Math.sqrt(1 - esin * esin);
  const pros = -atand(2 * esin / a);
  const b    = Math.sqrt(a * a + 4 * esin * esin);
  const fsin = epi * sind(mepianom - pros);
  const fcos = epi * cosd(mepianom - pros);
  const eq   = atand(fsin / (b + fcos));
  const eps  = asind(esin);
  const px   = epi * cosd(mepianom) + ecc * cosd(meccanom) + cosd(eps);
  const py   = epi * sind(mepianom) - 2 * ecc * sind(meccanom);
  const dist = Math.sqrt(px * px + py * py);
  if (n === 1) return pros;
  if (n === 2) return eq;
  return dist;
}

// `eqme` — Mercury gets its own version. Mercury is the weird one:
// Ptolemy had to add a moving deferent centre (a "crank") to match what
// he actually saw. Same idea, extra mechanism, because Mercury demanded it.
function eqme(n, ecc, epi, meccanom, mepianom) {
  const ecos    = ecc * cosd(meccanom);
  const esin    = ecc * sind(meccanom);
  const ecoscos = 2 * ecc * cosd(meccanom / 2) * cosd(3 * meccanom / 2);
  const ecossin = 2 * ecc * cosd(meccanom / 2) * sind(3 * meccanom / 2);
  const a       = ecos + ecoscos + Math.sqrt(1 - ecossin * ecossin);
  const pros    = -atand(esin / a);
  const b       = Math.sqrt(a * a + esin * esin);
  const fcos    = epi * cosd(mepianom - pros);
  const fsin    = epi * sind(mepianom - pros);
  const eq      = atand(fsin / (b + fcos));
  const gcos    = ecc * (cosd(meccanom) + cosd(2 * meccanom));
  const gsin    = ecc * (sind(meccanom) + sind(2 * meccanom));
  const pp      = Math.sqrt(1 - gsin * gsin) + gcos;
  const qq      = Math.sqrt(pp * pp + ecc * ecc + 2 * ecc * pp * cosd(meccanom));
  const px      = qq + fcos;
  const py      = fsin;
  const dist    = Math.sqrt(px * px + py * py);
  if (n === 1) return pros;
  if (n === 2) return eq;
  return dist;
}

// `latout` — ecliptic latitude for Mars, Jupiter, Saturn.
function latout(epi, ecc, inc0, inc1, node, latarg, tepianom) {
  const rho1      = epi * cosd(tepianom);
  const rho2      = epi * sind(tepianom);
  const rhoLatMax = 1 + ecc * cosd(node);
  const rhoLatMin = 1 - ecc * cosd(node);
  const rho3      = Math.sqrt((rhoLatMax + rho1) ** 2 + rho2 * rho2);
  const rho4      = Math.sqrt((rhoLatMin + rho1) ** 2 + rho2 * rho2);
  const latMax    = (inc0 * (rho1 + rhoLatMax) - inc1 * rho1) / rho3;
  const latMin    = (inc0 * (rho1 + rhoLatMin) - inc1 * rho1) / rho4;
  const carg      = cosd(latarg);
  return carg * ((latMax + latMin) + sgn(carg) * (latMax - latMin)) / 2;
}

// ------------------------------------------------------------------
// Ecliptic → equatorial using Ptolemy's own obliquity
// ------------------------------------------------------------------
function eclipticToEquatorial(tlong, lat) {
  const x = cosd(lat) * cosd(tlong);
  const y = cosd(lat) * sind(tlong) * cosd(obliquity) - sind(lat) * sind(obliquity);
  const z = cosd(lat) * sind(tlong) * sind(obliquity) + sind(lat) * cosd(obliquity);
  const raDeg  = degmod(atand2(y, x));
  const decDeg = atand(z / Math.sqrt(x * x + y * y));
  return { ra: raDeg * DEG, dec: decDeg * DEG };
}

// ------------------------------------------------------------------
// Sun — eccentric circle, no epicycle needed
// ------------------------------------------------------------------
//
// Ptolemy's Sun runs on an eccentric deferent — one circle, slightly
// off-centre from Earth. No epicycle. Simple, and it works.
// Venus and Mercury borrow the Sun's mean longitude because in this
// model their deferents track the Sun — that's why they always appear
// near it in the sky.
function sunLongitude(ddays) {
  const mlongsu = degmod(mlongsun0 + ddays * nsunlong);
  const manomsu = degmod(mlongsu - apogeesun);
  const eqsu    = atand(eccsun * sind(manomsu) / (1 + eccsun * cosd(manomsu)));
  const tlongsu = degmod(mlongsu - eqsu);
  return { mlongsu, tlongsu };
}

export function sunEquatorial(date) {
  const { tlongsu } = sunLongitude(ptolemyDay(date));
  return eclipticToEquatorial(tlongsu, 0);
}

// ------------------------------------------------------------------
// Moon — eccentric deferent with a crank, plus epicycle
// ------------------------------------------------------------------
export function moonEquatorial(date) {
  const ddays = ptolemyDay(date);
  const mlongmo   = degmod(mlongmoon0  + ddays * nlongmoon);
  const anommo    = degmod(manommoon0  + ddays * nanommoon);
  const latargmo0 = degmod(latargmoon0 + ddays * nlatargmoon);
  const melongmo  = degmod(melongmoon0 + ddays * nelongmoon);

  const esin  = eccmoon * sind(2 * melongmo);
  const ecos  = eccmoon * cosd(2 * melongmo);
  const oc    = ecos + Math.sqrt(1 - esin * esin);
  const prosmo  = atand(esin / (oc + ecos));
  const tanommo = degmod(anommo + prosmo);
  const fsin    = epimoon * sind(tanommo);
  const fcos    = epimoon * cosd(tanommo);
  const eqmo    = atand(fsin / (oc + fcos));

  const tlongmo = degmod(mlongmo - eqmo);
  const latarg  = degmod(latargmo0 - eqmo);
  const latmo   = incmoon * cosd(latarg);

  return eclipticToEquatorial(tlongmo, latmo);
}

// ------------------------------------------------------------------
// Outer planets — Mars, Jupiter, Saturn
// All three use the same deferent+epicycle structure. Plug in the
// constants, get back (RA, Dec). Same mechanism, different numbers.
// ------------------------------------------------------------------
function outerPlanet(ddays, params) {
  const {
    apogee0, nlong, nepianom,
    mepi_epoch, mepianom_epoch,
    ecc, epi, inc0, inc1, node,
  } = params;
  const prectab = ddays / 36525;   // Ptolemy's precession: 1°/century

  const apogee    = degmod(apogee0 + prectab);
  const mepi      = degmod(mepi_epoch      + ddays * nlong);
  const mepianom  = degmod(mepianom_epoch  + ddays * nepianom);
  const meccanom  = degmod(mepi - apogee);

  const pros      = eqplan(1, ecc, epi, meccanom, mepianom);
  const teccanom  = degmod(meccanom  + pros);
  const tepianom  = degmod(mepianom  - pros);
  const eqa       = eqplan(2, ecc, epi, meccanom, mepianom);
  const tlong     = degmod(mepi + pros + eqa);

  const latarg    = degmod(teccanom + node);
  const lat       = latout(epi, ecc, inc0, inc1, node, latarg, tepianom);

  return eclipticToEquatorial(tlong, lat);
}

// ------------------------------------------------------------------
// Inner planets — Venus and Mercury
// ------------------------------------------------------------------
//
// Venus and Mercury are always near the Sun in the sky. In Ptolemy's
// model that's because their deferent centres literally track the Sun's
// mean longitude — they're locked to it. Their latitude math is more
// involved than the outer planets: three separate components each,
// all derived from observation.
function venusPosition(ddays) {
  const { mlongsu } = sunLongitude(ddays);
  const prectab    = ddays / 36525;
  const apogeeve   = degmod(apogeeven0 + prectab);
  const mepive     = mlongsu;
  const mepianomve = degmod(mepianomven_epoch + ddays * nepianomven);
  const meccanomve = degmod(mepive - apogeeve);

  const prosve      = eqplan(1, eccven, epiven, meccanomve, mepianomve);
  const teccanomve  = degmod(meccanomve + prosve);
  const tepianomve  = degmod(mepianomve - prosve);
  const eqave       = eqplan(2, eccven, epiven, meccanomve, mepianomve);
  const tlongve     = degmod(mepive + prosve + eqave);

  // Venus latitude — three components, all from observation.
  const incve1      = -incven1_raw;
  const etave       = Math.abs(tepianomve - 180);
  const pprime      = Math.abs(epiven * cosd(etave) * sind(incve1));
  const xprime      = 0.999782 - epiven * cosd(etave) * cosd(incve1);
  const yprime      = epiven * sind(etave);
  const oprime      = Math.sqrt(xprime * xprime + yprime * yprime);
  const c3ve        = atand2(pprime, oprime);
  const c6ve        = Math.abs(atand2(epiven * sind(tepianomve),
                                      1 + epiven * cosd(tepianomve)));
  const c4ve        = 3.25 * c6ve / 60;
  const xkappa0p    = degmod(teccanomve + 90);
  const latve1      = -sgn(cosd(tepianomve)) * c3ve * cosd(xkappa0p);
  const latve2      = sgn(sind(tepianomve)) * c4ve * cosd(teccanomve);
  const latve3      = incven0 * cosd(teccanomve) * cosd(teccanomve);
  const latve       = latve1 + latve2 + latve3;

  return eclipticToEquatorial(tlongve, latve);
}

function mercuryPosition(ddays) {
  const { mlongsu } = sunLongitude(ddays);
  const prectab    = ddays / 36525;
  const apogeeme   = degmod(apogeemer0 + prectab);
  const mepime     = mlongsu;
  const mepianomme = degmod(mepianommer_epoch + ddays * nepianommer);
  const meccanomme = degmod(mepime - apogeeme);

  const prosme      = eqme(1, eccmer, epimer, meccanomme, mepianomme);
  const teccanomme  = degmod(meccanomme + prosme);
  const tepianomme  = degmod(mepianomme - prosme);
  const eqame       = eqme(2, eccmer, epimer, meccanomme, mepianomme);
  const tlongme     = degmod(mepime + prosme + eqame);

  // Mercury latitude — three components, same pattern as Venus.
  const incme0 = -incmer0_raw;
  const incme1 =  incmer1;
  const etame  = Math.abs(tepianomme - 180);
  const pprime = Math.abs(epimer * cosd(etame) * sind(incme1));
  const xprime = 0.94444 - epimer * cosd(etame) * cosd(incme1);
  const yprime = epimer * sind(etame);
  const oprime = Math.sqrt(xprime * xprime + yprime * yprime);
  const c3me   = atand2(pprime, oprime);
  const c6me   = Math.abs(atand2(epimer * sind(tepianomme),
                                 1 + epimer * cosd(tepianomme)));
  const c4me   = 6.8 * c6me / 60;
  const xkappa0p  = degmod(teccanomme + 270);
  const latme1    = -sgn(cosd(tepianomme)) * c3me * cosd(xkappa0p);
  const xkappa0pp = degmod(teccanomme + 180);
  const latme2    = (cosd(teccanomme) > 0 ? 0.9 : 1.1)
                     * sgn(sind(tepianomme)) * c4me * cosd(xkappa0pp);
  const latme3    = incme0 * cosd(teccanomme) * cosd(teccanomme);
  const latme     = latme1 + latme2 + latme3;

  return eclipticToEquatorial(tlongme, latme);
}

// ------------------------------------------------------------------
// Public API
// ------------------------------------------------------------------
export function planetEquatorial(name, date) {
  const ddays = ptolemyDay(date);
  if (name === 'saturn') return outerPlanet(ddays, {
    apogee0: apogeesat0, nlong: nlongsat, nepianom: nepianomsat,
    mepi_epoch: mepisat_epoch, mepianom_epoch: mepianomsat_epoch,
    ecc: eccsat, epi: episat, inc0: incsat0, inc1: incsat1, node: nodesat,
  });
  if (name === 'jupiter') return outerPlanet(ddays, {
    apogee0: apogeejup0, nlong: nlongjup, nepianom: nepianomjup,
    mepi_epoch: mepijup_epoch, mepianom_epoch: mepianomjup_epoch,
    ecc: eccjup, epi: epijup, inc0: incjup0, inc1: incjup1, node: nodejup,
  });
  if (name === 'mars') return outerPlanet(ddays, {
    apogee0: apogeemar0, nlong: nlongmar, nepianom: nepianommar,
    mepi_epoch: mepimar_epoch, mepianom_epoch: mepianommar_epoch,
    ecc: eccmar, epi: epimar, inc0: incmar0, inc1: incmar1, node: nodemar,
  });
  if (name === 'venus')   return venusPosition(ddays);
  if (name === 'mercury') return mercuryPosition(ddays);
  // Ptolemy never saw Uranus, Neptune, or Pluto — they weren't discovered
  // until centuries after the Almagest. No parameters, no output.
  return { ra: NaN, dec: NaN };
}

// Venus phases — straight out of the epicycle geometry, no heliocentric
// stage required.
//
// Venus rides an epicycle. When it's at the far end of that epicycle
// (tepianomve = 0°) it's near superior conjunction — fully lit from our
// perspective, like a full moon. When it's at the near end (180°) it's
// at inferior conjunction — dark side facing us, new moon equivalent.
// Every point in between gives you the crescent or gibbous you'd actually
// see in the sky. Ptolemy's geometry gives you this for free.
//
// Illuminated fraction: f = (1 + cos(tepianomve)) / 2
//   0° → f = 1.0 (full)    180° → f = 0.0 (new)
//
// All parameters — apogee longitude, epicycle radius, mean anomaly rate —
// come from Almagest tables built by watching Venus over centuries.
// Not a single AU or solar distance constant anywhere in this function.
export function venusPhaseAngle(date) {
  const ddays     = ptolemyDay(date);
  const { mlongsu } = sunLongitude(ddays);
  const prectab   = ddays / 36525;
  const apogeeve  = degmod(apogeeven0 + prectab);
  const mepive    = mlongsu;
  const mepianomve = degmod(mepianomven_epoch + ddays * nepianomven);
  const meccanomve = degmod(mepive - apogeeve);
  const prosve    = eqplan(1, eccven, epiven, meccanomve, mepianomve);
  return degmod(mepianomve - prosve); // degrees, 0-360
}

export function bodyGeocentric(name, date) {
  if (name === 'sun')   return sunEquatorial(date);
  if (name === 'moon')  return moonEquatorial(date);
  if (name === 'earth') return { ra: 0, dec: 0 };
  return planetEquatorial(name, date);
}

// Sun, Moon, and the five classical planets — that's what Ptolemy had.
// No precession, nutation, or aberration corrections: those came later
// and aren't part of the original Almagest model.
export const SUPPORTED_BODIES = new Set(['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn']);
export function coversBody(name) { return SUPPORTED_BODIES.has(name); }
export function coversDate(_date) { return true; }
export const BUILTIN_CORRECTIONS = { precession: false, nutation: false, aberration: false, fk5: false };
