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
| Is "one engine, every runtime" measured or asserted? | [Surface Coverage](#surface-coverage) |
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
| NativeSynth voice calibration | `tools/voicematch/` renders the provisional GM fallback voices against a dry FluidSynth/SoundFont oracle and reports timbre metrics; `autofit.py` can tune selected numeric constants in an isolated build directory. This is a calibration harness, not proof that the physical models are finished |
| Bindings | `bindings/wasm/tests/*.test.ts`, `bindings/node/tests/*.test.ts`, `bindings/python/tests/*.py`, and typing smoke tests cover exported API shape, structured-clone-safe WASM returns, input-validation guards, and cross-binding behavior |
| Cross-binding parity | `tools/parity` checks default values, constants/enums, and parameter names across C++, C ABI, Python, Node, and WASM so API drift is caught before release, and renders the per-runtime capability matrix described under [Surface Coverage](#surface-coverage) |
| CLI | `tests/cli/cli_test.cpp` and Python CLI parser coverage exercise terminal entry points |
| Performance | `benchmarks/*.cpp`, `benchmarks/results.json`, and `benchmarks/results_cpp.json` cover spectrum, streaming mel/chroma, mastering support, ISP (inter-sample peak) detection, stereo, mixing, EQ, and resampling-related hot paths |

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

## Surface Coverage

The claim that one C++ core is reachable from every runtime is true of the DSP and false if read as "every C entry point exists everywhere", so the repository publishes the actual reach instead of leaving it to inference. `tools/parity/surface-coverage.md` is that evidence: a generated table with a row per public C header (the domain) and a column per runtime — Python, Node, WASM, and the two command-line front-ends separately — where each cell counts the domain's C ABI entry points that runtime reaches.

Three properties make it evidence rather than a claim:

- **It is derived, not written.** `tools/parity/surface_coverage.py` reuses the parity checker's own extractors and reachability rules — class methods, handle-prefix renames, and verified aliases all resolve — so there is no second definition of "exposed" to drift from the first. `make surface-coverage` rewrites the file.
- **CI fails on a stale copy.** `make surface-coverage-check` regenerates the table and compares it with the tracked one, so a header added without the table catching up is a failing build rather than a silently optimistic number.
- **Reviewed absences stay visible.** The allowlist that lets a reviewed divergence pass the parity check does not put the capability back: an allowlisted gap is still counted as a gap, so the table cannot be made to look complete by review alone.

A gap in the table is therefore a measured absence. Whether it is a defect is a separate question that [Binding Parity](./binding-parity.md#feature-availability) answers per runtime — both CLIs are a curated subset by design, and WASM cannot reach the host filesystem or threads.

## Voice Calibration Harness

The NativeSynth physical voices are intentionally documented as **provisional** while their voicing is being tuned. The repository includes `tools/voicematch/` for that work:

- `voicematch.py` renders the libsonare GM fallback side and an oracle side, then compares harmonic balance, intonation error, tonal-to-noise ratio, and envelope-related measurements.
- `autofit.py` reads a JSON spec of numeric constants to try, rebuilds an isolated shared library, re-renders the comparison, and searches for lower mismatch. It restores source text on interruption and can run in `--dry-run` mode.

Use these tools to guide calibration changes. Do not read their existence as a claim that violin, brass, reed, flute, piano, guitar, or bass models are already final production-grade instrument simulations.

## Accuracy Boundaries

librosa parity means the implementation is compared against generated reference values for the covered helper. It does not mean that every high-level music-analysis result is identical to librosa.

Mastering validation checks DSP invariants, loudness/true-peak behavior, golden hashes, and published-algorithm assumptions where applicable.

Room-acoustic blind estimates and music-structure analysis are heuristic features. Treat them as estimates with confidence values.

::: tip Measuring music-analysis accuracy against your own material
"Estimate" above is qualitative. The repository ships a fixture-driven accuracy report — `tools/eval/summarize_accuracy.py`, run end to end with `make accuracy-report` — that rolls a corpus run into key accuracy and MIREX weighted score, BPM accuracy at the conventional 4% tolerance, beat and downbeat F-measure, meter accuracy, and chord recall in both a major/minor and an exact-quality vocabulary, broken down by dataset with the fixture count beside every figure.

The datasets it measures against are licensed for research use and are not redistributable, so the manifests ship empty and the report runs against a corpus you hold.

Two behaviors are worth knowing before reading or automating around the output. A dimension with no observations is reported as `unmeasured`, never as a score — a metric that silently skips unusable data points and averages the rest would score an empty set as perfect, and the fixture runner deliberately skips a row whose audio is missing. And `--require <dimension>` fails the run when a dimension expected to produce figures produced none, catching a typo'd fixture path that would otherwise look exactly like a pass.

See [FAQ: How do I measure accuracy on my own material?](/docs/faq#how-do-i-measure-accuracy-on-my-own-material) for the walkthrough.
:::
