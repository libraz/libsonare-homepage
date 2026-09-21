# Physical Model Tuner

Tunes libsonare's physical-model synth engines parameter by parameter, compares
the result against the libsonare original and an imported reference WAV, and
exports the tuned patch as JSON. It exists to feed tuning work back upstream,
not as a showcase.

- Page: `/tuner` — https://libsonare.libraz.net/tuner
- Entry: `PhysicalModelTuner.vue`
- Engine: `Project`, used to render the original voice for the A/B comparison.

`dsp/` is a TypeScript port of the C++ voice cores, verified against them by the
parity tests in `tests/demos/tuner/`. `worklet/` wraps that port in an
AudioWorklet processor, bundled to `src/public/tuner-worklet.js` by
`scripts/build-tuner-worklet.mjs` (run by `yarn dev` and `yarn build`), so the
tuner plays the port rather than the WASM build while you edit parameters.
