// epiParams.js — orbital parameters for the custom epicycle ephemeris.
//
// Epoch: J2000.0 (JD 2451545.0 = noon 1 Jan 2000 UTC).
// All angles in degrees.  All rates in degrees per Julian day.
// All eccentricities and epicycle radii dimensionless (deferent = 1).
//
// ── Parameter sources ────────────────────────────────────────────
//
// Mean motion rates derived from IAU/JPL sidereal periods and
// synodic periods (USNO / Meeus "Astronomical Algorithms" 2nd ed.).
// Eccentricities and apogee positions from Meeus Table 33.a (J2000
// orbital elements) and cross-checked against JPL Horizons.
// Orbital size ratios (field `a`) express each body's mean orbital radius
// as a multiple of the observer's (Earth's) mean orbital radius = 1.0.
// All motion is purely angular — no physical distance scale is assumed.
// Mean longitudes at J2000 from Meeus Table 31.a (L₀ values).
//
// Inner-planet mean motions on the DEFERENT follow the Sun's mean
// motion exactly (as Ptolemy observed) because Venus and Mercury
// orbit interior to Earth — their deferent centre tracks the Sun.
// Their own motion around the epicycle carries the fast anomaly.
//
// ── Accuracy expectation ─────────────────────────────────────────
//
// Single deferent + single epicycle:
//   Sun      ~3'–10'   (equation of time not applied)
//   Moon     ~30'–1°   (no evection or variation)
//   Mercury  ~1°–4°    (no crank mechanism)
//   Venus    ~0.3°–1°
//   Mars     ~0.5°–2°
//   Jupiter  ~0.2°–0.5°
//   Saturn   ~0.2°–0.5°
//   Uranus   ~0.5°–1.5°
//   Neptune  ~0.3°–0.8°
//
// Two-epicycle stack adds roughly one order of magnitude of
// improvement — see epiParams2.js for the second-epicycle deltas.

// ── Sun ──────────────────────────────────────────────────────────
// The Sun has only an eccentric deferent (no epicycle needed for
// a single-anomaly body).  We model it as a degenerate epicycle
// with r = 0, so the same outerBody() function handles it.
//
// Tropical year = 365.25636 days → nlong = 360 / 365.25636
// Apogee (perihelion of Earth's orbit from geocentric view):
//   longitude ~102.9372° at J2000, advancing ~1.72°/century.
// Eccentricity of Earth's orbit: e = 0.016709 at J2000.
export const SUN = {
  nlong:          0.9856474,    // mean longitude rate °/day (tropical)
  nanom:          0.9856003,    // mean anomaly rate °/day (anomalistic)
  L0:           280.46646,      // mean longitude at J2000.0 °
  M0:           357.52911,      // mean anomaly at J2000.0 °
  apogee0:      102.9372,       // longitude of apogee at J2000 °
  ecc:            0.016709,     // eccentricity (deferent offset)
  epi:            0.0,          // no epicycle
  inc:            0.0,          // ecliptic latitude always 0
  node:           0.0,
};

// ── Moon ─────────────────────────────────────────────────────────
// The Moon is the most complex body: eccentric deferent + epicycle.
// We use a simplified model without the Ptolemaic crank (evection).
// Adding evection is a future second-epicycle improvement.
//
// Sidereal period: 27.321661 days → nlong = 360 / 27.321661
// Anomalistic period: 27.554550 days → nanom = 360 / 27.554550
// Mean values from Meeus ch.47.
export const MOON = {
  nlong:         13.1763966,   // mean longitude rate °/day
  nanom:         13.0649929,   // mean anomaly (epicycle) rate °/day
  nnode:          0.0529539,   // ascending node regression rate °/day
  L0:           218.3165,      // mean longitude at J2000 °
  M0:           134.9634,      // mean anomaly at J2000 °
  N0:           125.0443,      // ascending node at J2000 ° (regressing)
  ecc:            0.054900,    // deferent eccentricity
  epi:            0.054900,    // epicycle radius ≈ ecc for Moon
  inc:            5.1454,      // orbital inclination to ecliptic °
};

// ── Mars ─────────────────────────────────────────────────────────
// Sidereal period: 686.971 days
// Synodic period:  779.94 days
// Epicycle radius from retrograde arc width: ~41.5° → r ≈ 0.656
export const MARS = {
  nlong:          0.5240207,
  nanom:          0.5240207,
  nlong2:         0.000311,    // secular T² coefficient °/century² (Meeus)
  nsyn:           0.4615195,
  L0:           359.4830,    // calibrated    // empirically corrected at J2000
  M0:           319.7274,
  apogee0:       336.0602,
  apogeeRate:     0.0001817,
  a:              1.52366231,
  ecc:            0.093405,
  epi:            0.656000,
  inc:            1.8497,
  node:          49.5574,
  nodeRate:      -0.0000295,
};

// ── Jupiter ───────────────────────────────────────────────────────
// Sidereal period: 4332.59 days (11.862 yr)
// Synodic period:  398.88 days
// Retrograde arc ~10° → r ≈ 0.192
export const JUPITER = {
  nlong:          0.0830853,
  nanom:          0.0830853,
  nlong2:         0.000223,    // secular T² coefficient °/century² (Meeus)
  nsyn:           0.9025862,
  L0:           33.6615,    // calibrated    // empirically corrected at J2000
  M0:            20.9240,
  apogee0:        14.3312,
  apogeeRate:     0.0000830,
  a:              5.20336301,
  ecc:            0.048775,
  epi:            0.192000,
  inc:            1.3053,
  node:          100.4542,
  nodeRate:       0.0000135,
};

// ── Saturn ────────────────────────────────────────────────────────
// Sidereal period: 10759.22 days (29.46 yr)
// Synodic period:  378.09 days
// Retrograde arc ~6.5° → r ≈ 0.108
export const SATURN = {
  nlong:          0.0334597,   // °/day (360 / 10759.22)
  nanom:          0.0334597,
  nlong2:         0.000519,    // secular T² coefficient °/century² (Meeus)
  nsyn:           0.9517044,   // °/day (360 / 378.09)
  L0:           48.4574,    // calibrated    // empirically corrected at J2000
  M0:            317.0207,     // °
  apogee0:        93.0572,     // °
  apogeeRate:     0.0000319,
  a:              9.53707032,
  ecc:            0.055723,
  epi:            0.108000,    // retrograde arc ~6.5° ✓
  inc:            2.4886,
  node:          113.6634,
  nodeRate:       0.0000839,
};

// ── Uranus ────────────────────────────────────────────────────────
// Sidereal period: 30688.5 days (84.01 yr)
// Synodic period:  369.66 days
// Retrograde arc ~4° → r ≈ 0.072
export const URANUS = {
  nlong:          0.0117307,   // °/day
  nanom:          0.0117307,
  nlong2:         0.000304,    // secular T² coefficient °/century² (Meeus)
  nsyn:           0.9741635,   // °/day
  L0:           310.0550,    // empirically corrected at J2000      // °  (Meeus J2000 mean long)
  M0:           142.2386,      // °
  apogee0:       173.0053,     // °
  apogeeRate:     0.0000097,
  a:             19.19126393,
  ecc:            0.047318,
  epi:            0.072000,    // retrograde arc ~4° ✓
  inc:            0.7733,
  node:          74.0005,
  nodeRate:       0.0000749,
};

// ── Neptune ───────────────────────────────────────────────────────
// Sidereal period: 60195 days (164.8 yr)
// Synodic period:  367.49 days
// Retrograde arc ~1.2° → r ≈ 0.035
export const NEPTUNE = {
  nlong:          0.0059802,   // °/day
  nanom:          0.0059802,
  nlong2:         0.000309,    // secular T² coefficient °/century² (Meeus)
  nsyn:           0.9797636,   // °/day
  L0:           306.3487,    // empirically corrected at J2000      // °
  M0:           256.2284,      // °
  apogee0:        48.1202,     // °
  apogeeRate:     0.0000048,
  a:             30.06896348,
  ecc:            0.008606,
  epi:            0.035000,    // retrograde arc ~1.2° ✓
  inc:            1.7700,
  node:          131.7841,
  nodeRate:       0.0000118,
};

// ── Venus ─────────────────────────────────────────────────────────
// Synodic period: 583.92 days → nanom = 360 / 583.92
// Venus's deferent tracks the Sun (nlong = Sun's nlong).
// Epicycle radius from max elongation: ~46° → r ≈ tan(46°) = 0.716
export const VENUS = {
  nlong:          0.9856474,   // deferent = Sun's mean motion
  nanom:          1.6021291,   // orbital anomaly rate °/day (360/224.701 days)
  L0:           191.7198,    // calibrated    // empirically corrected at J2000      // mean longitude at J2000 °
  M0:           134.9200,    // calibrated mean anomaly at J2000
  apogee0:        46.1008,     // apogee of deferent °
  apogeeRate:     0.0001636,
  a:              0.72333199,
  ecc:            0.006773,    // very small eccentricity
  epi:            0.716000,    // max elongation ~46° ✓
  inc:            3.3947,
  node:          76.6799,
  nodeRate:       0.0002465,
};

// ── Mercury ───────────────────────────────────────────────────────
// Synodic period: 115.88 days → nanom = 360 / 115.88
// Deferent tracks Sun.  Max elongation ~23° → r ≈ tan(23°) ≈ 0.424
// (Mercury is trickier because its eccentricity is large — 0.206)
export const MERCURY = {
  nlong:          0.9856474,   // deferent = Sun
  nanom:          4.0923507,   // orbital anomaly rate °/day (360/87.969 days)
  L0:           251.9104,    // calibrated      // °
  M0:           171.2900,    // calibrated mean anomaly at J2000
  apogee0:        77.4561,     // °
  apogeeRate:     0.0004592,
  a:              0.38709893,
  ecc:            0.205635,    // large — needs crank for best accuracy
  epi:            0.380000,    // adjusted for large ecc
  inc:            7.0047,
  node:          48.3313,
  nodeRate:       0.0003246,
};

// ── Pluto ─────────────────────────────────────────────────────────
// Orbital period: 247.94 yr = 90,518 days
// High eccentricity (0.249) and inclination (17°) limit accuracy to ~3–5°
// without perturbation series. Uncalibrated vs DE405.
export const PLUTO = {
  nlong:          0.0039770,    // °/day (360 / 90518)
  nanom:          0.0039770,
  L0:           238.9288,       // mean longitude at J2000 (Meeus)
  M0:            14.8600,       // mean anomaly at J2000
  a:             39.48168,
  ecc:            0.24882,
  inc:           17.14175,
  node:         110.30347,
  nodeRate:      -0.0000128,
};

// ── Main-belt asteroids ───────────────────────────────────────────
// Elements from JPL Small-Body Database at J2000.0 epoch.
// All use outerBody() — same vector geocentric approach as outer planets.
// L0 = M0 + long_peri (long_peri = Ω + ω). Uncalibrated vs DE405.

// 1 Ceres — largest asteroid / dwarf planet, period 4.60 yr
export const CERES = {
  nlong:          0.21408,      // °/day (360 / 1681.6 days)
  nanom:          0.21408,
  L0:           230.817,
  M0:            77.372,
  a:              2.7658,
  ecc:            0.07600,
  inc:           10.593,
  node:          80.329,
  nodeRate:      -0.0000234,
};

// 2 Pallas — 2nd largest asteroid, highly inclined (35°), period 4.62 yr
export const PALLAS = {
  nlong:          0.21370,
  nanom:          0.21370,
  L0:           201.257,
  M0:            78.232,
  a:              2.7713,
  ecc:            0.23103,
  inc:           34.841,
  node:         173.096,
  nodeRate:      -0.0000091,
};

// 3 Juno — period 4.36 yr
export const JUNO = {
  nlong:          0.22616,
  nanom:          0.22616,
  L0:           149.550,
  M0:            91.628,
  a:              2.6692,
  ecc:            0.25545,
  inc:           12.982,
  node:         169.857,
  nodeRate:      -0.0000102,
};

// 4 Vesta — brightest asteroid (naked-eye at opposition), period 3.63 yr
export const VESTA = {
  nlong:          0.27160,
  nanom:          0.27160,
  L0:           275.442,
  M0:            20.863,
  a:              2.3615,
  ecc:            0.08874,
  inc:            7.134,
  node:         103.851,
  nodeRate:      -0.0000185,
};

// ── Zodiac constellation marker stars ────────────────────────────
//
// One bright reference star per zodiac constellation, chosen for
// visibility and historical significance.  Positions J2000.0 from
// the HYG v4.1 database.  Fixed stars have no epicycle — their
// ra/dec come straight from the catalogue.
//
// Format: { id, name, constellation, raH, decD, mag }
//   raH  — right ascension in decimal hours
//   decD — declination in decimal degrees
export const ZODIAC_STARS = [
  // Aries — Hamal (α Ari)
  { id: 'hamal',       name: 'Hamal',       constellation: 'Aries',       raH:  2.1196, decD:  23.4625, mag: 2.00 },
  // Taurus — Aldebaran (α Tau)
  { id: 'aldebaran',   name: 'Aldebaran',   constellation: 'Taurus',      raH:  4.5987, decD:  16.5093, mag: 0.85 },
  // Gemini — Pollux (β Gem) + Castor (α Gem)
  { id: 'pollux',      name: 'Pollux',      constellation: 'Gemini',      raH:  7.7553, decD:  28.0262, mag: 1.14 },
  { id: 'castor',      name: 'Castor',      constellation: 'Gemini',      raH:  7.5767, decD:  31.8883, mag: 1.58 },
  // Cancer — Acubens (α Cnc) — faint but traditional
  { id: 'acubens',     name: 'Acubens',     constellation: 'Cancer',      raH:  8.9748, decD:  11.8577, mag: 4.26 },
  // Leo — Regulus (α Leo)
  { id: 'regulus',     name: 'Regulus',     constellation: 'Leo',         raH: 10.1395, decD:  11.9672, mag: 1.35 },
  // Leo — Denebola (β Leo)
  { id: 'denebola',    name: 'Denebola',    constellation: 'Leo',         raH: 11.8177, decD:  14.5720, mag: 2.13 },
  // Virgo — Spica (α Vir)
  { id: 'spica',       name: 'Spica',       constellation: 'Virgo',       raH: 13.4199, decD: -11.1613, mag: 1.04 },
  // Libra — Zubenelgenubi (α Lib)
  { id: 'zubenelgenubi', name: "Zuben'ubi", constellation: 'Libra',       raH: 14.8479, decD: -16.0418, mag: 2.75 },
  // Libra — Zubeneschamali (β Lib)
  { id: 'zubeneschamali', name: "Zuben'esch", constellation: 'Libra',     raH: 15.2839, decD:  -9.3832, mag: 2.61 },
  // Scorpius — Antares (α Sco)
  { id: 'antares',     name: 'Antares',     constellation: 'Scorpius',    raH: 16.4901, decD: -26.4320, mag: 1.09 },
  // Ophiuchus (traditional 13th zodiac sign) — Rasalhague (α Oph)
  { id: 'rasalhague',  name: 'Rasalhague',  constellation: 'Ophiuchus',   raH: 17.5823, decD:  12.5601, mag: 2.08 },
  // Sagittarius — Kaus Australis (ε Sgr)
  { id: 'kausaust',    name: 'Kaus Aust.',  constellation: 'Sagittarius', raH: 18.4029, decD: -34.3846, mag: 1.85 },
  // Capricornus — Deneb Algedi (δ Cap)
  { id: 'deneb_algedi', name: 'Deneb Algedi', constellation: 'Capricornus', raH: 21.7870, decD: -16.1274, mag: 2.85 },
  // Aquarius — Sadalsuud (β Aqr)
  { id: 'sadalsuud',   name: 'Sadalsuud',   constellation: 'Aquarius',    raH: 21.5258, decD:  -5.5711, mag: 2.91 },
  // Pisces — Eta Piscium (η Psc) — brightest in Pisces
  { id: 'eta_psc',     name: 'η Piscium',   constellation: 'Pisces',      raH:  1.5249, decD:  15.3457, mag: 3.62 },
];

// ── Extra observable stars: planets' traditional reference stars ──
//
// These are the Behenian stars and other historically significant
// naked-eye stars that appear near the ecliptic and are useful
// reference points for tracking planetary positions.
export const ECLIPTIC_GUIDE_STARS = [
  // Pleiades cluster representative (η Tau / Alcyone)
  { id: 'alcyone',     name: 'Alcyone',     raH:  3.7913, decD:  24.1053, mag: 2.87 },
  // Hyades cluster centre (θ¹ Tau / near Aldebaran)
  { id: 'ain',         name: 'Ain (ε Tau)', raH:  4.4769, decD:  19.1807, mag: 3.53 },
  // Praesepe (M44) vicinity — δ Cnc (Asellus Australis)
  { id: 'asellus_aus', name: 'Asellus Aus.', raH:  8.7449, decD:  18.1540, mag: 3.94 },
  // Vindemiatrix (ε Vir) — traditional zodiac reference
  { id: 'vindemiatrix', name: 'Vindemiatrix', raH: 13.0362, decD:  10.9592, mag: 2.83 },
  // Graffias (β Sco) — at Scorpius head
  { id: 'graffias',    name: 'Graffias',    raH: 16.0906, decD: -19.8054, mag: 2.62 },
  // Nunki (σ Sgr) — Sagittarius
  { id: 'nunki',       name: 'Nunki',       raH: 18.9211, decD: -26.2967, mag: 2.02 },
  // Fomalhaut — southern reference
  { id: 'fomalhaut',   name: 'Fomalhaut',   raH: 22.9609, decD: -29.6222, mag: 1.16 },
  // Markab (α Peg) — near ecliptic in Pisces sector
  { id: 'markab',      name: 'Markab',      raH: 23.0793, decD:  15.2053, mag: 2.49 },
];

// ── Bright navigation and reference stars ─────────────────────────
//
// Top 40 brightest/most significant stars not already in the zodiac
// or ecliptic guide lists above. Covers all major navigation stars
// (Bowditch list), the Southern Cross, Orion, Ursa Major, etc.
// All positions J2000.0 from HYG v4.1. Sorted roughly by magnitude.
export const BRIGHT_STARS = [
  // The 10 brightest (not already listed)
  { id: 'sirius',       name: 'Sirius',        raH:  6.7525, decD: -16.7161, mag: -1.46 },
  { id: 'canopus',      name: 'Canopus',       raH:  6.3992, decD: -52.6957, mag: -0.74 },
  { id: 'rigil_kent',   name: 'Rigil Kent.',   raH: 14.6601, decD: -60.8339, mag: -0.27 },
  { id: 'arcturus',     name: 'Arcturus',      raH: 14.2611, decD:  19.1822, mag: -0.05 },
  { id: 'vega',         name: 'Vega',          raH: 18.6156, decD:  38.7836, mag:  0.03 },
  { id: 'capella',      name: 'Capella',       raH:  5.2782, decD:  45.9980, mag:  0.08 },
  { id: 'rigel',        name: 'Rigel',         raH:  5.2423, decD:  -8.2016, mag:  0.12 },
  { id: 'procyon',      name: 'Procyon',       raH:  7.6550, decD:   5.2250, mag:  0.38 },
  { id: 'achernar',     name: 'Achernar',      raH:  1.6286, decD: -57.2367, mag:  0.46 },
  { id: 'betelgeuse',   name: 'Betelgeuse',    raH:  5.9195, decD:   7.4071, mag:  0.50 },
  // Southern hemisphere reference
  { id: 'hadar',        name: 'Hadar',         raH: 14.0637, decD: -60.3731, mag:  0.61 },
  { id: 'acrux',        name: 'Acrux',         raH: 12.4433, decD: -63.0990, mag:  0.87 },
  { id: 'mimosa',       name: 'Mimosa',        raH: 12.7954, decD: -59.6886, mag:  1.25 },
  { id: 'gacrux',       name: 'Gacrux',        raH: 12.5194, decD: -57.1132, mag:  1.59 },
  { id: 'miaplacidus',  name: 'Miaplacidus',   raH:  9.2200, decD: -69.7172, mag:  1.68 },
  { id: 'avior',        name: 'Avior',         raH:  8.3752, decD: -59.5094, mag:  1.86 },
  { id: 'atria',        name: 'Atria',         raH: 16.8111, decD: -69.0278, mag:  1.92 },
  { id: 'peacock',      name: 'Peacock',       raH: 20.4275, decD: -56.7350, mag:  1.94 },
  // Northern navigation stars
  { id: 'polaris',      name: 'Polaris',       raH:  2.5303, decD:  89.2642, mag:  1.97 },
  { id: 'deneb',        name: 'Deneb',         raH: 20.6905, decD:  45.2803, mag:  1.25 },
  { id: 'altair',       name: 'Altair',        raH: 19.8464, decD:   8.8683, mag:  0.77 },
  { id: 'mirfak',       name: 'Mirfak',        raH:  3.4054, decD:  49.8611, mag:  1.79 },
  { id: 'menkalinan',   name: 'Menkalinan',    raH:  5.9921, decD:  44.9475, mag:  1.90 },
  // Ursa Major (Big Dipper)
  { id: 'alioth',       name: 'Alioth',        raH: 12.9005, decD:  55.9597, mag:  1.77 },
  { id: 'dubhe',        name: 'Dubhe',         raH: 11.0621, decD:  61.7508, mag:  1.79 },
  { id: 'alkaid',       name: 'Alkaid',        raH: 13.7923, decD:  49.3133, mag:  1.86 },
  // Orion
  { id: 'bellatrix',    name: 'Bellatrix',     raH:  5.4189, decD:   6.3497, mag:  1.64 },
  { id: 'alnilam',      name: 'Alnilam',       raH:  5.6035, decD:  -1.2019, mag:  1.70 },
  { id: 'alnitak',      name: 'Alnitak',       raH:  5.6793, decD:  -1.9431, mag:  1.74 },
  { id: 'mintaka',      name: 'Mintaka',       raH:  5.5334, decD:  -0.2992, mag:  2.23 },
  // Taurus / Auriga
  { id: 'elnath',       name: 'Elnath',        raH:  5.4382, decD:  28.6075, mag:  1.65 },
  // Canis Major / Minor
  { id: 'adhara',       name: 'Adhara',        raH:  6.9771, decD: -28.9722, mag:  1.50 },
  { id: 'wezen',        name: 'Wezen',         raH:  7.1399, decD: -26.3933, mag:  1.83 },
  { id: 'mirzam',       name: 'Mirzam',        raH:  6.3783, decD: -17.9561, mag:  1.98 },
  // Gemini
  { id: 'alhena',       name: 'Alhena',        raH:  6.6285, decD:  16.3994, mag:  1.93 },
  // Scorpius extra
  { id: 'shaula',       name: 'Shaula',        raH: 17.5601, decD: -37.1039, mag:  1.63 },
  { id: 'sargas',       name: 'Sargas',        raH: 17.6220, decD: -42.9978, mag:  1.87 },
  // Hydra / Cetus / Perseus
  { id: 'alphard',      name: 'Alphard',       raH:  9.4598, decD:  -8.6586, mag:  1.98 },
  { id: 'diphda',       name: 'Diphda',        raH:  0.7265, decD: -17.9867, mag:  2.04 },
  // Leo extra
  { id: 'algieba',      name: 'Algieba',       raH: 10.3329, decD:  19.8414, mag:  2.01 },

  // ── Completing the 57 navigational stars ─────────────────────────
  { id: 'acamar',      name: 'Acamar',      raH:  2.9710, decD: -40.305, mag: 3.24 }, // θ Eri
  { id: 'alnair',      name: 'Al Na\'ir',   raH: 22.1372, decD: -46.961, mag: 1.74 }, // α Gru
  { id: 'alphecca',    name: 'Alphecca',    raH: 15.5781, decD: +26.714, mag: 2.23 }, // α CrB
  { id: 'alpheratz',   name: 'Alpheratz',   raH:  0.1398, decD: +29.091, mag: 2.06 }, // α And
  { id: 'ankaa',       name: 'Ankaa',       raH:  0.4381, decD: -42.306, mag: 2.40 }, // α Phe
  { id: 'eltanin',     name: 'Eltanin',     raH: 17.9434, decD: +51.489, mag: 2.24 }, // γ Dra
  { id: 'enif',        name: 'Enif',        raH: 21.7364, decD:  +9.875, mag: 2.38 }, // ε Peg
  { id: 'gienah',      name: 'Gienah',      raH: 12.2634, decD: -17.542, mag: 2.58 }, // γ Crv
  { id: 'kochab',      name: 'Kochab',      raH: 14.8451, decD: +74.156, mag: 2.08 }, // β UMi
  { id: 'menkar',      name: 'Menkar',      raH:  3.0380, decD:  +4.090, mag: 2.54 }, // α Cet
  { id: 'menkent',     name: 'Menkent',     raH: 14.1114, decD: -36.370, mag: 2.06 }, // θ Cen
  { id: 'sabik',       name: 'Sabik',       raH: 17.1730, decD: -15.725, mag: 2.43 }, // η Oph
  { id: 'schedar',     name: 'Schedar',     raH:  0.6751, decD: +56.537, mag: 2.24 }, // α Cas
  { id: 'suhail',      name: 'Suhail',      raH:  9.1333, decD: -43.432, mag: 2.23 }, // λ Vel

  // ── Ursa Major (Big Dipper) ───────────────────────────────────────
  { id: 'merak',       name: 'Merak',       raH: 11.0307, decD: +56.382, mag: 2.37 }, // β UMa
  { id: 'phecda',      name: 'Phecda',      raH: 11.8972, decD: +53.694, mag: 2.44 }, // γ UMa
  { id: 'megrez',      name: 'Megrez',      raH: 12.2571, decD: +57.029, mag: 3.31 }, // δ UMa
  { id: 'mizar',       name: 'Mizar',       raH: 13.3988, decD: +54.925, mag: 2.23 }, // ζ UMa

  // ── Cassiopeia ────────────────────────────────────────────────────
  { id: 'caph',        name: 'Caph',        raH:  0.1530, decD: +59.150, mag: 2.28 }, // β Cas
  { id: 'navi',        name: 'Navi',        raH:  0.9451, decD: +60.717, mag: 2.47 }, // γ Cas
  { id: 'ruchbah',     name: 'Ruchbah',     raH:  1.4303, decD: +60.236, mag: 2.68 }, // δ Cas

  // ── Perseus ───────────────────────────────────────────────────────
  { id: 'algol',       name: 'Algol',       raH:  3.1361, decD: +40.956, mag: 2.12 }, // β Per

  // ── Cygnus ────────────────────────────────────────────────────────
  { id: 'sadr',        name: 'Sadr',        raH: 20.3704, decD: +40.257, mag: 2.23 }, // γ Cyg
  { id: 'albireo',     name: 'Albireo',     raH: 19.5120, decD: +27.960, mag: 3.08 }, // β Cyg

  // ── Lyra ──────────────────────────────────────────────────────────
  { id: 'sulafat',     name: 'Sulafat',     raH: 18.9824, decD: +32.690, mag: 3.25 }, // γ Lyr

  // ── Aquila ────────────────────────────────────────────────────────
  { id: 'tarazed',     name: 'Tarazed',     raH: 19.7710, decD: +10.613, mag: 2.72 }, // γ Aql

  // ── Hercules ──────────────────────────────────────────────────────
  { id: 'kornephoros', name: 'Kornephoros', raH: 16.5037, decD: +21.490, mag: 2.78 }, // β Her
  { id: 'rasalgethi',  name: 'Rasalgethi',  raH: 17.2441, decD: +14.390, mag: 3.35 }, // α Her

  // ── Boötes ────────────────────────────────────────────────────────
  { id: 'izar',        name: 'Izar',        raH: 14.7498, decD: +27.074, mag: 2.37 }, // ε Boo
  { id: 'muphrid',     name: 'Muphrid',     raH: 13.9114, decD: +18.397, mag: 2.68 }, // η Boo

  // ── Draco ─────────────────────────────────────────────────────────
  { id: 'rastaban',    name: 'Rastaban',    raH: 17.5072, decD: +52.301, mag: 2.79 }, // β Dra
  { id: 'thuban',      name: 'Thuban',      raH: 14.0731, decD: +64.376, mag: 3.67 }, // α Dra (former pole star)

  // ── Serpens / Ophiuchus ───────────────────────────────────────────
  { id: 'unukalhai',   name: 'Unukalhai',   raH: 15.7378, decD:  +6.426, mag: 2.65 }, // α Ser
  { id: 'yed_prior',   name: 'Yed Prior',   raH: 16.2391, decD:  -3.694, mag: 2.74 }, // δ Oph

  // ── Andromeda ─────────────────────────────────────────────────────
  { id: 'mirach',      name: 'Mirach',      raH:  1.1622, decD: +35.621, mag: 2.07 }, // β And
  { id: 'almach',      name: 'Almach',      raH:  2.0650, decD: +42.330, mag: 2.26 }, // γ And

  // ── Pegasus ───────────────────────────────────────────────────────
  { id: 'scheat',      name: 'Scheat',      raH: 23.0629, decD: +28.083, mag: 2.44 }, // β Peg
  { id: 'algenib',     name: 'Algenib',     raH:  0.2206, decD: +15.184, mag: 2.83 }, // γ Peg

  // ── Aries ─────────────────────────────────────────────────────────
  { id: 'sheratan',    name: 'Sheratan',    raH:  1.9107, decD: +20.808, mag: 2.64 }, // β Ari

  // ── Gemini ────────────────────────────────────────────────────────
  { id: 'mebsuta',     name: 'Mebsuta',     raH:  6.7322, decD: +25.131, mag: 2.98 }, // ε Gem
  { id: 'tejat',       name: 'Tejat',       raH:  6.3827, decD: +22.514, mag: 2.87 }, // μ Gem

  // ── Leo ───────────────────────────────────────────────────────────
  { id: 'zosma',       name: 'Zosma',       raH: 11.2352, decD: +20.524, mag: 2.56 }, // δ Leo

  // ── Virgo ─────────────────────────────────────────────────────────
  { id: 'porrima',     name: 'Porrima',     raH: 12.6943, decD:  -1.449, mag: 2.74 }, // γ Vir

  // ── Scorpius ──────────────────────────────────────────────────────
  { id: 'dschubba',    name: 'Dschubba',    raH: 16.0056, decD: -22.622, mag: 2.29 }, // δ Sco
  { id: 'lesath',      name: 'Lesath',      raH: 17.5127, decD: -37.296, mag: 2.69 }, // υ Sco

  // ── Sagittarius ───────────────────────────────────────────────────
  { id: 'ascella',     name: 'Ascella',     raH: 19.0435, decD: -29.880, mag: 2.60 }, // ζ Sgr

  // ── Canis Major ───────────────────────────────────────────────────
  { id: 'aludra',      name: 'Aludra',      raH:  7.4016, decD: -29.303, mag: 2.45 }, // η CMa

  // ── Puppis / Carina / Vela ────────────────────────────────────────
  { id: 'naos',        name: 'Naos',        raH:  8.0598, decD: -40.003, mag: 2.25 }, // ζ Pup
  { id: 'aspidiske',   name: 'Aspidiske',   raH:  9.2848, decD: -59.275, mag: 2.25 }, // ι Car
  { id: 'regor',       name: 'Regor',       raH:  8.1588, decD: -47.337, mag: 1.78 }, // γ Vel
  { id: 'alsephina',   name: 'Alsephina',   raH:  8.7451, decD: -54.709, mag: 1.93 }, // δ Vel

  // ── Canis Minor / Columba / Lepus ─────────────────────────────────
  { id: 'gomeisa',     name: 'Gomeisa',     raH:  7.4525, decD:  +8.290, mag: 2.90 }, // β CMi
  { id: 'phact',       name: 'Phact',       raH:  5.6608, decD: -34.074, mag: 2.65 }, // α Col
  { id: 'arneb',       name: 'Arneb',       raH:  5.5455, decD: -17.822, mag: 2.58 }, // α Lep
  { id: 'nihal',       name: 'Nihal',       raH:  5.4706, decD: -20.759, mag: 2.84 }, // β Lep

  // ── Orion (additional) ────────────────────────────────────────────
  { id: 'saiph',       name: 'Saiph',       raH:  5.7960, decD:  -9.670, mag: 2.07 }, // κ Ori

  // ── Aquarius / Capricornus ────────────────────────────────────────
  { id: 'sadalmelik',  name: 'Sadalmelik',  raH: 22.0964, decD:  -0.320, mag: 2.96 }, // α Aqr
  { id: 'dabih',       name: 'Dabih',       raH: 20.3502, decD: -14.782, mag: 3.05 }, // β Cap

  // ── Cepheus ───────────────────────────────────────────────────────
  { id: 'alderamin',   name: 'Alderamin',   raH: 21.3097, decD: +62.586, mag: 2.45 }, // α Cep

  // ── Southern Cross (additional) ───────────────────────────────────
  { id: 'imai',        name: 'Imai',        raH: 12.2524, decD: -58.749, mag: 2.79 }, // δ Cru

  // ── Pleiades (individual members) ────────────────────────────────
  { id: 'atlas',       name: 'Atlas',       raH:  3.8194, decD: +24.053, mag: 3.63 }, // 27 Tau
  { id: 'electra',     name: 'Electra',     raH:  3.7480, decD: +24.113, mag: 3.70 }, // 17 Tau
  { id: 'maia',        name: 'Maia',        raH:  3.7638, decD: +24.368, mag: 3.87 }, // 20 Tau
  { id: 'merope',      name: 'Merope',      raH:  3.7722, decD: +23.948, mag: 4.14 }, // 23 Tau
  { id: 'taygeta',     name: 'Taygeta',     raH:  3.7534, decD: +24.468, mag: 4.30 }, // 19 Tau
];
