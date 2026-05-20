# epicycle_ephemeris/

Custom pure-epicycle ephemeris pipeline for the FE Conceptual Model.

Same API contract as the Ptolemy pipeline. No globe parameters, no AU,
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
| `epiTest.mjs` | Smoke test: prints all bodies + zodiac stars for one date |
| `epiValidate.mjs` | Error comparison vs reference positions over 10 years |

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

Angular accumulation from a J2000.0 epoch. The calculation only
uses angles (mean longitudes, anomalies) and dimensionless ratios.
The Sun's position enters only as a direction angle.

### Outer planets (Mars, Jupiter, Saturn, Uranus, Neptune)

```
1. Mean longitude λ̄  = L₀ + t × nlong       (accumulates from J2000)
2. Mean anomaly    M   = M₀ + t × nanom
3. Equation of centre  eqc = arctan(e sin M / (1 + e cos M))
4. True anomaly        ν   = M + eqc
5. True longitude  λ_h = λ̄ + eqc
6. Orbital distance  r = a(1 − e²) / (1 + e cos ν)
7. Orbital vector  (r cos λ_h, r sin λ_h)
8. Subtract Earth orbital vector (from Sun position + eqc_sun)
9. Geocentric ecliptic longitude = atan2 of that vector
10. Ecliptic latitude from inclination × sin(argument of latitude)
11. eclipticToEquatorial(λ_geo, β) → { ra, dec } in radians
```

### Inner planets (Venus, Mercury)

Same as outer planets — full vector geocentric subtraction. The deferent
constraint (inner planets track the Sun angularly) arises naturally
because their deferent size ratio a < 1 (smaller than the Sun's deferent),
so the vector subtraction always produces the correct elongation-bounded behaviour.

### Sun

Three-term equation-of-centre series. Accurate to ~0.5°.
No equation of time applied.

### Moon

Eccentric deferent + epicycle. No evection, no variation. Accurate to ~1°.
Ascending node tracked for ecliptic latitude.

---

## Accuracy (Phase 1 — single circle)

This is a **pure geometric** pipeline with no perturbation series.
Expected accuracy for simplified elements:

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

This is the same accuracy class as any single-epicycle geometric model
without a perturbation series. It is **working correctly** — the errors
are inherent in the single-term equation of centre.

For the FE model context: this is stronger than the existing Ptolemy
pipeline (which reaches ~5–10° for modern dates) and adds Uranus and
Neptune which no current pipeline covers for arbitrary dates.

---

## Accuracy (Phase 2 — two circles)

`ephemerisEpicycle2.js` adds a second epicycle per body. This is the
Ibn al-Shatir method (c. 1350 CE): two compounded uniform circular
motions. The second circle absorbs the residual
from the first, improving accuracy ~2×–3× for most bodies.

The second-epicycle radii (`r2`) and phase offsets were set to match
known opposition positions. They are not fitted by full least-squares
optimisation — that is Phase 3 work.

---


## Running the tests

```bash
# From the epicycle_ephemeris/ directory:
node epiTest.mjs       # smoke test — all bodies, one date
node epiValidate.mjs   # error comparison vs reference positions, 2000–2010
```

---

## What this is NOT

- Not a table-lookup ephemeris
- Not claiming arc-minute accuracy

What it IS: a self-contained, fully geometric, pure-circular-motion
prediction engine that covers every observable naked-eye planet plus
Uranus and Neptune, using nothing but angle accumulation and geometric
vector subtraction. No globe radius, no AU (the semi-major axis ratios
are dimensionless), no gravitational constant.

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
