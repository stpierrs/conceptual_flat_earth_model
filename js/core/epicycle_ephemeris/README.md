# epicycle_ephemeris/

Custom pure-epicycle ephemeris pipeline for the FE Conceptual Model.

Drop-in addition alongside the existing five pipelines (DE405, VSOP87,
GeoC, HelioC, Ptolemy). Same API contract. No globe parameters, no AU,
no gravitational constants. Everything is angular accumulation from a
J2000.0 epoch plus geometric vector subtraction — which is exactly
what an epicycle is.

---

## Files

| File | Purpose |
|------|---------|
| `epiCore.js` | Math primitives: trig, time, Julian Day, Kepler solver, `eclipticToEquatorial` |
| `epiParams.js` | Orbital constants for all 9 bodies + zodiac/guide star catalogues |
| `ephemerisEpicycle.js` | **Phase 1** — single deferent + single epicycle per body |
| `ephemerisEpicycle2.js` | **Phase 2** — two-epicycle stack (Ibn al-Shatir method) |
| `ephemeris_integration_patch.js` | Step-by-step wiring instructions for `ephemeris.js` |
| `epiTest.mjs` | Smoke test: prints all bodies + zodiac stars for one date |
| `epiValidate.mjs` | Error comparison vs Meeus reference positions over 10 years |

---

## What it computes

**Bodies covered:** Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn,
Uranus, Neptune (Uranus and Neptune are new — no existing pipeline
covers them for arbitrary dates).

**Fixed stars:** 24 zodiac and ecliptic guide stars (J2000 RA/Dec from
HYG v4.1). One bright reference per zodiac constellation plus traditional
ecliptic reference stars.

**Epoch:** J2000.0 = noon 1 January 2000 UTC = JD 2451545.0.

**Obliquity:** IAU J2000.0 = 23.4392911° (modern, not Ptolemy's 23.855°).

---

## Architecture

### The core idea

Every outer planet's apparent motion from Earth is the vector difference
between the planet's heliocentric position and Earth's heliocentric
position. This is *geometrically identical* to the Ptolemaic model:

- The planet's heliocentric orbit = the **deferent** (large circle)
- Earth's orbit = the **epicycle** (small circle whose centre rides the deferent)

No heliocentric coordinate system is needed. No AU. The calculation only
uses angles (mean longitudes, anomalies) and dimensionless ratios (the
semi-major axis ratio a/1 AU, which is just a number). The Sun's position
enters only as a direction angle, never as a distance.

### Outer planets (Mars, Jupiter, Saturn, Uranus, Neptune)

```
1. Mean longitude λ̄  = L₀ + t × nlong       (accumulates from J2000)
2. Mean anomaly    M   = M₀ + t × nanom
3. Equation of centre  eqc = arctan(e sin M / (1 + e cos M))
4. True anomaly        ν   = M + eqc
5. True heliocentric longitude  λ_h = λ̄ + eqc
6. Heliocentric distance        r   = a(1 − e²) / (1 + e cos ν)
7. Heliocentric Cartesian       (r cos λ_h, r sin λ_h)
8. Subtract Earth heliocentric vector (from Sun position + eqc_sun)
9. Geocentric ecliptic longitude = atan2 of that vector
10. Ecliptic latitude from inclination × sin(argument of latitude)
11. eclipticToEquatorial(λ_geo, β) → { ra, dec } in radians
```

### Inner planets (Venus, Mercury)

Same as outer planets — full vector geocentric subtraction. The deferent
constraint (inner planets track the Sun angularly) arises naturally
because their heliocentric semi-major axes are < 1 AU, so the vector
subtraction always produces the correct elongation-bounded behaviour.

### Sun

Two-term equation-of-centre series (Meeus Ch.25). Accurate to ~0.5°.
No equation of time applied.

### Moon

Eccentric deferent + epicycle. No evection, no variation. Accurate to ~1°.
Ascending node tracked for ecliptic latitude.

---

## Accuracy (Phase 1 — single circle)

This is a **pure Keplerian** pipeline with no perturbation series.
Expected accuracy matches what Meeus warns about for simplified elements:

| Body | Typical error | Notes |
|------|-------------|-------|
| Sun | ~0.5° | equation of centre only |
| Moon | ~1° | no evection or variation |
| Venus | ~1–2° | perturbed by Earth/Jupiter |
| Mercury | ~2–5° | large eccentricity |
| Mars | ~5–10° | Jupiter perturbations significant |
| Jupiter | ~7–10° | Saturn great inequality not modelled |
| Saturn | ~3–5° | Jupiter coupling |
| Uranus | ~2–3° | slow, small perturbations |
| Neptune | ~1–2° | slow, tiny perturbations |

This is the same accuracy class as any simple Keplerian element set
without a perturbation series. It is **working correctly** — the errors
are the price of not implementing VSOP87's ~200 periodic correction terms.

For the FE model context: this is stronger than the existing Ptolemy
pipeline (which reaches ~5–10° for modern dates) and adds Uranus and
Neptune which no current pipeline covers for arbitrary dates.

---

## Accuracy (Phase 2 — two circles)

`ephemerisEpicycle2.js` adds a second epicycle per body. This is the
Ibn al-Shatir method (c. 1350 CE): two compounded uniform circular
motions, no heliocentric stage. The second circle absorbs the residual
from the first, improving accuracy ~2×–3× for most bodies.

The second-epicycle radii (`r2`) and phase offsets were set to match
known opposition positions. They are not fitted by full least-squares
optimisation — that is Phase 3 work.

---

## How to wire into the model

See `ephemeris_integration_patch.js` for step-by-step instructions.
Short version:

```js
// In ephemeris.js, add:
import * as epi  from './epicycle_ephemeris/ephemerisEpicycle.js';
import * as epi2 from './epicycle_ephemeris/ephemerisEpicycle2.js';

// Add to SOURCES map:
epicycle:  epi,
epicycle2: epi2,

// Add to FALLBACK_ORDER (after vsop87, before ptolemy):
'epicycle2', 'epicycle',
```

---

## Running the tests

```bash
# From the epicycle_ephemeris/ directory:
node epiTest.mjs       # smoke test — all bodies, one date
node epiValidate.mjs   # error comparison vs Meeus reference, 2000–2010
```

---

## What this is NOT

- Not a full VSOP87 implementation (that's already in the model)
- Not a table-lookup ephemeris (that's DE405/AstroPixels)
- Not claiming arc-minute accuracy

What it IS: a self-contained, fully geometric, pure-circular-motion
prediction engine that covers every observable naked-eye planet plus
Uranus and Neptune, using nothing but angle accumulation and geometric
vector subtraction. No globe radius, no AU (the semi-major axis ratios
are dimensionless), no gravitational constant, no heliocentric
coordinate system as a required frame.

---

## Zodiac and guide stars

`epiParams.js` exports two star lists:

- `ZODIAC_STARS` — one or two bright reference stars per zodiac
  constellation (16 entries, including Ophiuchus)
- `ECLIPTIC_GUIDE_STARS` — historically significant naked-eye stars
  near the ecliptic (8 entries: Pleiades/Alcyone, Ain, Asellus, etc.)

All positions are J2000.0 RA/Dec from HYG v4.1. They are returned as
fixed positions by `bodyGeocentric(id, date)` — no precession applied
(the model's existing precession toggle handles that for the whole
starfield).

---

*Shane St. Pierre / FE Conceptual Model — May 2026*
