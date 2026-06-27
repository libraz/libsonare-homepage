# Implementation Validation

This page summarizes how libsonare's implementation is checked. It is not a benchmark claim; it is a map from feature area to test evidence in the repository.

For standards, algorithms, and compatibility references behind those implementation areas, see [Algorithm References](./algorithm-references.md).

::: info Validation is evidence, not a blanket guarantee
Passing tests means the covered behavior is checked against references, invariants, or regression outputs. It does not mean every possible input, room, song, codec, or host environment will produce a perfect answer. Use this page to understand what is covered and where estimates still need confidence values or listening checks.
:::

## What You Will Learn

By the end of this page you should be able to:

- locate the test evidence for analysis, features, mastering, mixing, realtime, bindings, CLI, and performance;
- understand the difference between reference tests, golden hashes, property checks, and no-allocation checks;
- explain which parts are designed for realtime use and which remain offline helpers;
- state accuracy boundaries clearly instead of overclaiming compatibility.

## How To Read This Page

| Question | Section |
|----------|---------|
| Which repository tests cover a feature area? | [Validation Matrix](#validation-matrix) |
| Which parts are designed for realtime use? | [Realtime Safety](#realtime-safety) |
| What does compatibility or accuracy mean here? | [Accuracy Boundaries](#accuracy-boundaries) |

## Validation Matrix

| Area | Evidence in the repository |
|------|----------------------------|
| librosa-compatible features | `tests/librosa/*_test.cpp` and JSON references in `tests/librosa/reference/` cover STFT, mel, MFCC, chroma/CQT, onset, beat/tempo, PCEN, tonnetz, silence, frame/pad/fix, peak pick, and conversion helpers |
| Core DSP primitives | `tests/core/*_test.cpp`, `tests/util/*_test.cpp`, `tests/filters/*_test.cpp`, `tests/rt/*_test.cpp` cover FFT, windowing, resampling, padding, sequence, filters, oversampling, true-peak filters, queues, and realtime primitives |
| Analysis | `tests/analysis/*_test.cpp`, optional music fixture manifests in `tests/fixtures/music_eval/`, and synthetic key/chord matrices cover BPM, key, chord, beat, downbeat, meter, melody, timbre, rhythm, section, boundary, long-form boundary pooling, and acoustic analysis |
| Geometric room acoustics | `tests/acoustic/*_test.cpp`, `tests/effects/room_morph_test.cpp`, `tests/api/sonare_c_acoustic_test.cpp`, optional acoustic fixtures in `tests/fixtures/acoustic/`, and binding tests cover room models/materials, image-source reflections, late reverb, RIR synthesis, equivalent-room estimation, room morphing, and C ABI behavior |
| Mastering | `tests/mastering/*_test.cpp` covers chain config, latency, EQ, dynamics, multiband, saturation, repair, spectral, stereo, match, maximizer, EBU R128, loudness ceiling, presets, golden hashes, property checks, and assistant output |
| Mixing | `tests/mixing/*_test.cpp`, `bindings/node/tests/mixing.test.ts`, `bindings/python/tests/test_mixing.py`, and WASM tests cover routing, insert automation, no-allocation process checks, scene presets, meters, goniometer, and binding smoke tests |
| Realtime engine | `tests/engine/*_test.cpp`, `bindings/python/tests/test_engine.py`, and WASM worklet tests cover transport, tempo sync, metronome, capture, graph runtime, monitor runtime, mono monitor/bounce parity, telemetry, offline bounce, concurrency, and AudioWorklet runtime behavior |
| Bindings | `bindings/wasm/tests/*.test.ts`, `bindings/node/tests/*.test.ts`, `bindings/python/tests/*.py`, and typing smoke tests cover exported API shape, structured-clone-safe WASM returns, input-validation guards, and cross-binding behavior |
| Cross-binding parity | `tools/parity` checks default values, constants/enums, and parameter names across C++, C ABI, Python, Node, and WASM so facade drift is caught before release |
| CLI | `tests/cli/cli_test.cpp` and Python CLI parser coverage exercise terminal entry points |
| Performance | `benchmarks/*.cpp`, `benchmarks/results.json`, and `benchmarks/results_cpp.json` cover spectrum, streaming mel/chroma, mastering support, ISP, stereo, mixing, EQ, and resampling-related hot paths |

::: details What do "golden hashes", "property checks", and "no-allocation checks" mean?
These are the kinds of automated test used above.

- **Reference / regression tests** — compare current output against saved known-good values. If the numbers drift unexpectedly, the test fails, catching an accidental change.
- **Golden hashes** — a compact checksum of a known-good render. Re-processing the same input with the same settings must reproduce the same hash, so any change to the audio output is caught immediately.
- **Property checks** — assert an invariant that must hold for *any* input (e.g. "output never exceeds the ceiling", "a mono-summed imager doesn't flip polarity"), tested across many random inputs rather than one fixed case.
- **No-allocation process checks** — verify that real-time code never allocates memory (no `new`/`malloc`) inside the audio callback, since an allocation could stall and cause a dropout.
:::

## Realtime Safety

Realtime-oriented code is tested in several ways:

| Check | What it protects |
|-------|------------------|
| No-allocation process checks | The audio callback should not allocate memory. |
| Lock-free command/telemetry queues | Control messages should not block the audio thread. |
| Graph runtime, AudioWorklet smoke, block parity, and voice-changer quality gates | Realtime paths should behave like the offline reference where they are meant to match. |

libsonare still separates realtime-safe block processing from offline helpers. Full repair or loudness optimization over an entire file is intentionally offline work.

## Accuracy Boundaries

librosa parity means the implementation is compared against generated reference values for the covered helper. It does not mean that every high-level music-analysis result is identical to librosa.

Mastering validation checks DSP invariants, loudness/true-peak behavior, golden hashes, and published-algorithm assumptions where applicable.

Room-acoustic blind estimates and music-structure analysis are heuristic features. Treat them as estimates with confidence values.
