# libsonare Homepage

Documentation and demos for [libsonare](https://libsonare.libraz.net), a
dependency-free C++ audio engine: analysis, mastering, mixing, editing, room
acoustics, built-in instruments and a headless-DAW runtime.

Built with VitePress. **Every demo runs the engine in your browser** — over
WebAssembly, on your own audio, with nothing uploaded and no server to call.
Bilingual throughout: English under `src/docs/`, Japanese mirrored under
`src/ja/docs/`.

## The demos

| Demo | What it does |
| --- | --- |
| [Visual Player](https://libsonare.libraz.net/analyzer) | Audio player with real-time chroma and spectrum visualization |
| [Mastering Studio](https://libsonare.libraz.net/mastering) | Hit streaming loudness targets with presets, and export a WAV |
| [Music Analysis Studio](https://libsonare.libraz.net/music-analysis) | Structure, harmony, melody, loudness and spectral views |
| [Mixing Studio](https://libsonare.libraz.net/mixing) | Up to eight stem tracks, a scene as JSON, and a WAV bounce |
| [Realtime Voice Changer](https://libsonare.libraz.net/realtime-fx) | Local microphone voice changer with character presets |
| [Spatial Room Scanner](https://libsonare.libraz.net/spatial) | Estimate room geometry, reverb and source distance from a recording |
| [Synth Playground](https://libsonare.libraz.net/synth) | Play the built-in polyphonic synth from a keyboard or a USB MIDI device |
| [Studio Mini](https://libsonare.libraz.net/studio) | Step-sequence three tracks, mix them, bounce the loop |
| [Piano Practice](https://libsonare.libraz.net/practice) | Falling notes, a lit keyboard and MIDI-input scoring |
| [GS Sound Module](https://libsonare.libraz.net/gs-module) | Sixteen parts, one insertion effect, and your own `.mid` through them |
| [Classic Synth](https://libsonare.libraz.net/classic-synth) | One voice taken apart a chapter at a time, with every comparison rendered |

`src/demos/manifest.ts` is the one table binding a demo's id to its route and
its directory; `tests/readme.test.ts` fails if this list drifts from it.

## Development

```bash
yarn install
yarn dev                 # dev server
yarn build               # production build
yarn preview             # serve the production build
yarn copy:wasm           # copy WASM from ../libsonare/bindings/wasm/dist
```

## Checks

```bash
yarn check               # every gate below
yarn verify              # pre-release: check + test + build + built-route check

yarn check:docs          # doc link and anchor integrity
yarn check:glossary      # glossary coverage
yarn check:i18n          # en/ja parity
yarn check:demos         # inline demo ids, archetypes and their clips
yarn check:mastering-docs
yarn check:mastering     # mastering presets render to their stated targets
yarn check:sweep         # symbols named in the docs exist in the engine
yarn check:terms         # terminology consistency
yarn check:gs-data       # generated GS data still matches the engine it came from
yarn check:built-routes  # built route artifacts, after a build
```

## License

Apache-2.0 — see [LICENSE](LICENSE).
