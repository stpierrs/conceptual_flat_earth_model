// Jupiter moon ephemeris — pure Ptolemaic epicycles.
//
// Galileo pointed a telescope at Jupiter in 1610 and watched four moons
// go around it. He wrote down the periods. That's the whole model right
// there — you observed it, you wrote it down, and the sky kept doing the
// same thing. Every parameter here comes from watching, not from a theory
// about what gravity is or how far away the sun is.
//
//   period    — how long each moon takes to go around Jupiter, measured
//               by observation. Negative = retrograde apparent motion.
//   maxElong  — how far from Jupiter the moon gets at its widest, in
//               degrees of arc, as seen from Earth. Observed.
//   incl      — tilt of the orbit plane to the ecliptic. Observed.
//               Drives the north-south wobble you see in the sky.
//   l0        — where the moon was in its orbit at J2000.0, from
//               Lieske (1979) — a purely observational fit, no
//               heliocentric stage anywhere in it.
//
// No AU, no gravitational constant, no heliocentric distances.
// The Galilean moons are scaled 5× their real apparent separations so
// you can actually see them at the model's rendering scale. The ratios
// between the four are preserved exactly as observed.

const DEG = Math.PI / 180;

const degmod = (x) => ((x % 360) + 360) % 360;

// JD of J2000.0 — a calendar reference point, not heliocentric.
const JD_J2000 = 2451545.0;

function julianDay(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

// Moon definitions.
//   period    : sidereal orbital period relative to Jupiter in days.
//               Negative = retrograde apparent motion.
//   maxElong  : model orbital radius in degrees (apparent angular
//               separation from Jupiter at maximum elongation).
//   incl      : inclination of orbit plane to ecliptic, degrees.
//               Drives the Dec oscillation; >90° = retrograde.
//   l0        : mean longitude at J2000.0, degrees.
export const JUPITER_MOON_DEFS = [
  // ----- Inner group — orbit inside Io --------------------------------
  // Tiny angular separations even at 5× scale; most useful via the HUD.
  { id: 'metis',    name: 'Metis',    period:    0.2948, maxElong:  0.22, incl:  2.0, l0:   0.0 },
  { id: 'adrastea', name: 'Adrastea', period:    0.2983, maxElong:  0.23, incl:  2.0, l0:  45.0 },
  { id: 'amalthea', name: 'Amalthea', period:    0.4982, maxElong:  0.37, incl:  2.5, l0: 268.0 },
  { id: 'thebe',    name: 'Thebe',    period:    0.6745, maxElong:  0.47, incl:  2.5, l0: 229.0 },

  // ----- Galilean moons -----------------------------------------------
  // l0 from Lieske (1979) observational tables (degrees at J2000.0).
  // maxElong = 5× mean observed elongation; ratios 1 : 1.60 : 2.54 : 4.46
  // preserved from classical measurement.
  { id: 'io',       name: 'Io',       period:    1.7691, maxElong:  0.57, incl:  2.2, l0: 106.08 },
  { id: 'europa',   name: 'Europa',   period:    3.5512, maxElong:  0.91, incl:  3.1, l0: 175.73 },
  { id: 'ganymede', name: 'Ganymede', period:    7.1546, maxElong:  1.45, incl:  2.8, l0: 120.55 },
  { id: 'callisto', name: 'Callisto', period:   16.6890, maxElong:  2.54, incl:  2.0, l0:  84.18 },

  // ----- Himalia group — prograde, ~28–30° inclination ---------------
  { id: 'leda',     name: 'Leda',     period:  240.92,   maxElong:  5.7,  incl: 28.0, l0:   0.0 },
  { id: 'himalia',  name: 'Himalia',  period:  250.23,   maxElong:  6.0,  incl: 28.0, l0:  60.0 },
  { id: 'lysithea', name: 'Lysithea', period:  259.20,   maxElong:  6.1,  incl: 28.0, l0: 120.0 },
  { id: 'elara',    name: 'Elara',    period:  259.64,   maxElong:  6.1,  incl: 28.0, l0: 180.0 },

  // ----- Retrograde outer moons — negative period = westward motion --
  { id: 'ananke',   name: 'Ananke',   period: -629.77,   maxElong: 14.5,  incl: 147,  l0:   0.0 },
  { id: 'carme',    name: 'Carme',    period: -734.17,   maxElong: 16.5,  incl: 163,  l0:  90.0 },
  { id: 'pasiphae', name: 'Pasiphae', period: -743.63,   maxElong: 17.0,  incl: 148,  l0: 180.0 },
  { id: 'sinope',   name: 'Sinope',   period: -758.90,   maxElong: 17.5,  incl: 153,  l0: 270.0 },
];

export const GALILEAN_MOON_IDS = ['io', 'europa', 'ganymede', 'callisto'];
export const JUPITER_MOON_IDS  = JUPITER_MOON_DEFS.map((m) => m.id);

// Colour palette for the HUD / GP tracers.
// Galilean moons get distinct warm tones; inner and outer moons share
// neutral grey/blue so the HUD doesn't get overwhelming.
export const JUPITER_MOON_COLORS = {
  // inner
  metis:    0x888888,
  adrastea: 0x888888,
  amalthea: 0xaa8866,
  thebe:    0xaa8866,
  // Galilean
  io:       0xffe060,   // warm yellow — sulphur surface
  europa:   0xb8ddf0,   // icy blue
  ganymede: 0xc8b890,   // warm tan
  callisto: 0x8899aa,   // cool grey-blue
  // Himalia group
  leda:     0x778899,
  himalia:  0x778899,
  lysithea: 0x778899,
  elara:    0x778899,
  // Retrograde outer moons
  ananke:   0x99667f,
  carme:    0x99667f,
  pasiphae: 0x99667f,
  sinope:   0x99667f,
};

// Where is this moon right now?
//
// Take Jupiter's position in the sky (RA, Dec). Put the moon on a
// circular orbit around it. Advance the orbit by how many days have
// passed since J2000.0. Project onto the celestial sphere. Done.
// That's a Ptolemaic epicycle — a circle on a circle, derived entirely
// from what you can watch with your eyes (or a telescope).
//
//   M   = mean anomaly: how far around its orbit the moon has gone
//   r   = orbit radius in radians (from observed max elongation)
//   ΔRA = east-west offset, corrected for the convergence of hour circles
//         near the poles so the angular math stays clean
//   ΔDec = north-south offset, scaled by the orbital inclination
//
// Retrograde moons have a negative period, so M runs backwards —
// they drift westward relative to Jupiter, exactly as observed.
export function jupiterMoonRADec(moonDef, jupRA, jupDec, date) {
  const ddays = julianDay(date) - JD_J2000;
  const n     = 360 / moonDef.period;                      // deg/day
  const M     = degmod(moonDef.l0 + n * ddays) * DEG;      // radians
  const r     = moonDef.maxElong * DEG;                    // radians
  const incl  = moonDef.incl * DEG;                        // radians

  const cosJupDec = Math.cos(jupDec);
  const deltaRA   = cosJupDec > 0.01 ? r * Math.cos(M) / cosJupDec : 0;
  const deltaDec  = r * Math.sin(incl) * Math.sin(M);

  return { ra: jupRA + deltaRA, dec: jupDec + deltaDec };
}
