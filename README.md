# Conceptual Flat Earth Model

An interactive, browser-based conceptual model of the flat-earth cosmology built
with three.js. The scene draws the stationary disc, the observer's optical
vault (a flattened cap onto which stars, sun, moon, and planets project), and
the heavenly vault above it. All geometry is unit-less — every distance is a
ratio of the flat-earth disc radius.

## Live demo

Hosted on GitHub Pages — see the "Pages" link on this repo.

## Run Locally

The browser app is a static site. Browsers block ES-module imports over
`file://`, so serve the repo with any local HTTP server:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Rust core

The Rust rewrite lives in `src/` as a dependency-free crate. It currently ports
the computational core: scalar/vector/matrix math, projections, disc/dome
geometry, frame transforms, compact sun/moon ephemeris, and the model compute
snapshot.

The Rust core is a native library and CLI. The GitHub Pages app still runs the
static browser frontend in `index.html` and `js/`.

Run the Rust tests:

```sh
cargo test
```

Print a computed model snapshot:

```sh
cargo run -- --date-time 2024-01-01T00:00:00Z --lat 32 --lon -100.8387 --json
```

See [DEVELOPMENT.md](DEVELOPMENT.md) for CLI flags, library usage, Capacitor
commands, and publishing notes.

## Controls

* **View tab** — observer lat/long, camera, heavenly vault, optical vault,
  per-body vault heights, ray shape.
* **Time tab** — day of year, time, date-time.
* **Show tab** — visibility toggles for land, grid, shadow terminator,
  starfield, rays, declination circles, etc.
* **Demos tab** — scripted camera/time animations illustrating key points
  of the conceptual model.

The "ⓘ About" button in the header explains the model's stance on the
lat/long graticule and the fictitious center-of-earth observer.

## Special Thanks

This project is built on ideas and groundwork from people whose work
pointed the way:

* **Shane St. Pierre** — for the conceptual framing and the push to actually
  build a working, interactive demonstration of the model.
* **Walter Bislin** — for the visual style and layout inspiration that shaped
  the look and feel of this interactive model.
* **Roohif** — for the flight-path KMZ data behind the
  Flight Routes demo group. The `Southern Non-Stop` city / leg list
  and the QF27/28 actual-flight-track waypoints (lat / lon /
  altitude / per-point air speed / ground speed / heading / wind)
  bundled in `js/data/flightRoutes.js` and
  `js/data/flightTracks.js` are parsed straight from his KMZ
  archive. The Equal Arc demos and the QF27/28 actual-flight
  playbacks lean entirely on that dataset.

Additional credits baked into the ephemeris machinery:

* **R.H. van Gent** (Utrecht University) — Almagest Ephemeris
  Calculator, the source for the Ptolemaic deferent + epicycle code
  the sim runs on.

Without their inspiration, their published theory, and their public
data tables, this wouldn't exist.
