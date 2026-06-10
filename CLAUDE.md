# Project Notes

This is the Conceptual Flat Earth Model project.

## Runtime Surfaces

- Browser app: static `index.html` plus ES modules under `js/`.
- Rust core: dependency-free crate under `src/`, with the `fe-model` CLI.

The Rust core is not wired into the GitHub Pages browser app yet. GitHub Pages
serves the static JS frontend.

## Common Commands

Run the browser app locally:

```sh
python3 -m http.server 8000
```

Run Rust tests:

```sh
cargo test
```

Run the Rust CLI:

```sh
cargo run -- --date-time 2024-01-01T00:00:00Z --lat 32 --lon -100.8387 --json
```

Mobile packaging uses Capacitor:

```sh
npm install
npm run sync
```

See `DEVELOPMENT.md` for full run, use, and publish notes.
