# Development And Usage

This repository has two runnable surfaces:

- The browser app in `index.html` and `js/`, served as a static site.
- The Rust core in `src/`, exposed as a library and the `fe-model` CLI.

The Rust core does not replace the GitHub Pages app yet. GitHub Pages serves the
static browser app. The Rust code is the native model foundation for tests, CLI
inspection, and future integration work.

## Requirements

- Any local HTTP server for the browser app. Python 3 is enough.
- Rust and Cargo for the Rust core.
- Node and npm only for Capacitor mobile packaging.

## Run The Browser App

Browsers block ES module imports over `file://`, so serve the repo directory:

```sh
python3 -m http.server 8000
```

Open:

```text
http://localhost:8000
```

There is no web build step for the browser app.

## Run The Rust Core

Run all Rust tests:

```sh
cargo test
```

Print a human-readable model snapshot:

```sh
cargo run -- --date-time 2024-01-01T00:00:00Z --lat 32 --lon -100.8387
```

Print JSON:

```sh
cargo run -- --date-time 2024-01-01T00:00:00Z --lat 32 --lon -100.8387 --json
```

Useful CLI flags:

- `--date-time DAYS|YYYY-MM-DDTHH:MM:SSZ`
- `--lat DEG`
- `--lon DEG`
- `--projection ID`
- `--world fe|ge|dp`
- `--inside-vault`
- `--json`

## Use The Rust Library

The public Rust entry points are re-exported from `src/lib.rs`.

```rust
use conceptual_flat_earth_model::{FeModel, FeState};

let mut state = FeState::default();
state.observer_lat = 32.0;
state.observer_long = -100.8387;
state.date_time = 2556.0;

let computed = FeModel::with_state(state).compute();
println!("{}", computed.sun.angles_globe.elevation);
```

The current Rust port covers scalar/vector/matrix math, projections, disc and
dome geometry, coordinate transforms, compact sun/moon ephemeris, and a model
snapshot for sun/moon observer angles and vault coordinates. The full browser UI,
Three.js renderer, catalogs, demos, and planet epicycle renderer still run in JS.

## Mobile Packaging

Install dependencies before using Capacitor:

```sh
npm install
```

Sync native projects:

```sh
npm run sync
```

Open native projects:

```sh
npm run open:android
npm run open:ios
```

## Publish

Commit changes, then push the branch used by GitHub Pages:

```sh
git push origin master
```

Because the browser app is static, the pushed `index.html`, `js/`, `css/`, and
assets are what GitHub Pages serves. Cargo build output in `target/` is ignored
and is not published.
