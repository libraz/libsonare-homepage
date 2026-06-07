# Binding Parity

libsonare uses one C++ core and exposes it through C, Python, Node native, WASM, and CLI surfaces. The feature set is intentionally close across bindings, but naming and configuration shape differ by language.

Read this page after [Feature Map](./api-surface.md) when you already know the feature family and need to choose a runtime or port code between bindings.

::: info Parity does not mean identical syntax
This page compares whether the same capability exists across runtimes. It does not mean every function has the same name, argument order, return shape, or default value. When porting code, check both the feature row and the shape differences before assuming a direct copy will work.
:::

## What You Will Learn

By the end of this page you should be able to:

- translate naming conventions between JavaScript, Python, C++, C ABI, Node native, and CLI;
- identify which features are present in each binding and which are not available from the CLI;
- account for shape differences such as nested vs flat configs, row-major matrices, scene JSON, and streaming frame buffers;
- choose the authoritative source file to inspect when the docs and runtime need to be checked.

## Naming Conventions

| Concept | WASM / Node JS | Python | C / C++ |
|---------|----------------|--------|---------|
| Function style | camelCase, e.g. `detectBpm`, `masterAudioStereo` | snake_case, e.g. `detect_bpm`, `master_audio_stereo` | C ABI uses `sonare_*`; C++ uses namespaces/classes |
| Mastering chain config | WASM `masteringChain(...)` uses nested objects | Flat dot-notation overrides and dict configs | C++ structs; C ABI structs/JSON helpers |
| Preset overrides | Flat dot notation for `masterAudio(...)` | Flat dot notation | Flat params or C++ config mutation |
| Mixer scenes | JSON strings and `Mixer` | JSON strings and `Mixer` | `mixing::api::Scene` plus JSON helpers |

## Feature Availability

Every library binding exposes the same feature families: WASM, Python, Node native, C++, and the C ABI.

Most meaningful gaps are in the CLI. The table lists each feature family with library-binding status and CLI coverage. Unless a row says otherwise, assume the feature exists in all library bindings. Naming differences follow the [naming conventions](#naming-conventions) above.

| Feature family | Library bindings | CLI |
|----------------|------------------|-----|
| Batch analysis | Yes | Yes |
| Low-level features and librosa helpers | Yes | Common commands |
| Streaming analyzer | Yes | No |
| Mel/MFCC inverse reconstruction | Yes | No |
| Realtime engine | Yes | No |
| Mastering presets/chains/processors | Yes | Partial |
| Mastering assistant/profile/preview JSON | Yes | No dedicated command |
| Mixing engine and scenes | Yes | `mix` (C++ CLI also exports scene presets) |
| Project and arrangement editing (headless DAW) | Yes — see [Project Editing](./project-editing.md) | Yes |
| Built-in instruments (NativeSynth presets/patches) | Yes — see [Built-in Instruments](./native-synth.md) | Yes |
| SoundFont 2 player | Yes — see [SoundFont 2 Player](./soundfont-player.md) | No (Project API only) |
| Realtime engine live MIDI input | Yes — see [MIDI Input](./midi-input.md) | No |
| Web MIDI bridge (`bindWebMidi`) and microphone glue (`bindMicrophoneInput`) | WASM / browser only | No |
| External-instrument bounce protocol (`ExternalInstrument`) | Python only — see [Project Bounce](./project-bounce.md) | No |
| Editing DSP | Yes | Yes |
| Metering (meters, clipping/dynamic-range, stereo image, spectrum) | Yes | C++ CLI only (`meter`, `clipping`, `dynamic-range`) |
| Scale quantization | Yes | No |
| Room acoustics | Yes | `sonare acoustic [--ir]`, `estimate-room`, `synthesize-rir`, `room-morph` |
| File decoding | Native: WAV/MP3 (FFmpeg builds add more); WASM: pass decoded samples | Same as the native build |

## Known Shape Differences

The same capability can take different argument shapes, config layouts, or return values across bindings. When porting, the most common bugs come not from the math but from how matrices are flattened, whether options are passed as an object or as keyword arguments, and whether a returned field is named differently.

### Function and argument shapes

These functions exist across the library bindings but take their arguments differently. Naming follows the [naming conventions](#naming-conventions) (camelCase vs `snake_case`).

| Function | WASM | Node native | Python |
|----------|------|-------------|--------|
| `mfccToAudio` / `mfcc_to_audio` | `(mfcc, nMfcc, nFrames, nMels, sampleRate, …)` | `(mfcc, nMfcc, nFrames, sampleRate, nFft, hopLength, nMels, …)` | C-API order: `n_mels` before `sample_rate` |
| `detectChords` / `detect_chords` | options object | positional / keyword params | positional / keyword params |
| Streaming reads | `process`, `readFrames`, `stats` | float Structure-of-Arrays read is `readFramesSoa` | `process`, `read_frames`, `stats` |
| Quantized stream reads | `readFramesI16` / `readFramesU8`, `StreamConfig.outputFormat` | same as WASM | `read_frames_i16` / `read_frames_u8`, `output_format` |
| `Mixer` strip references | numeric index; `stripById(id)` for lookup | numeric index or strip-id string | numeric index or strip-id string |

A few signatures don't line up across all three bindings:

- **Stereo mix:** WASM `mixStereo(...)` takes separate `leftChannels` / `rightChannels` arrays plus a `MixOptions` object; Python `mix_stereo(...)` takes `[(left, right), …]` strips plus keyword arrays such as `fader_db`, `pan`, `width`, and `input_trim_db`.
- **`timeStretch(...)` / `pitchShift(...)`:** WASM uses `samples, sampleRate, rateOrSemitones`; Node native uses `samples, rateOrSemitones, sampleRate?`. Pass all numeric arguments explicitly when porting between the two.
- **Metering taps:** use `meterTap(strip, tap)` for an explicit pre/post-fader tap; Node's `stripMeter(strip)` is the post-fader convenience path.

### Config, return, and data shapes

| Topic | What differs |
|-------|--------------|
| Mastering chain config | `masteringChain(...)` and `StreamingMasteringChain` use nested config objects; `masterAudio(...)` overrides use flat dot-notation keys |
| `StreamingMasteringChain` scope | Block-safe stages only — it rejects repair stages that need lookaround/file context and the whole-file `loudness` stage; use one-shot mastering APIs for those |
| `analyze(...)` return | C ABI, Node native, and WASM return the complete `analyze` result — chords, sections, timbre, dynamics, rhythm, melody, form, and per-beat strength. Python is the exception: its `AnalysisResult` carries only BPM, BPM confidence, key, time signature, and beat times; reach for the dedicated functions (`detect_chords`, `analyze_sections`, …) for the other families |
| `normalize(...)` defaults | Module-level `normalize(...)` (Python, WASM, Node native) defaults to `0.0` (full scale); the Python `Audio.normalize()` convenience method still defaults to `target_db=-3.0` |
| `bounceOffline(...)` LUFS | Same LUFS-normalization default in C API and WASM; pass `normalizeLufs` / `normalize_lufs` explicitly when porting older code if the behavior matters |
| `trim` vs `trimSilence` | `trim(...)` uses a simple `thresholdDb` and returns audio only; `trimSilence(...)` / `trim_silence(...)` follow `librosa.effects.trim` with `topDb`, frame RMS, and original sample ranges |
| Automation curves | Shared `AutomationCurve` across engine and mixing APIs (`linear`, `exponential`, `hold`, `s-curve`); update older per-module curve enum names to this shared name |
| Scene JSON | Interchange format for persistent mixers; prefer `Mixer.toSceneJson()` (WASM/Node) or `Mixer.to_scene_json()` (Python) over hand-written JSON when preserving runtime edits |
| Project bounce variants | The headless-DAW `Project` bounces to audio across bindings; instrument-bound bounce (`bounceWithBuiltinInstrument` / `bounceWithSynthInstrument` / `bounceWithSf2Instrument`) and the take/comp arrangement model are shared — see [Project Bounce](./project-bounce.md) and [Recording and Takes](./recording-and-takes.md). The `ExternalInstrument` bounce protocol is Python-only |
| Mastering chain JSON | Chain JSON and named-processor parameter maps round-trip the same field set: `repair.declip` `lpcBlend`, multiband per-band parameters, compressor detector / sidechain-HPF / PDR settings, and realtime voice-changer ISP limiter settings |
| Acoustic analysis | Measurement and blind-estimation entry points return `AcousticResult`; geometric room acoustics adds equivalent-room estimates, RIR synthesis, and creative room morphing (display blind estimates and equivalent-room estimates with confidence) |
| CLI surface | Some availability depends on whether the command is the PyPI Python CLI or the source-built C++ CLI — see [CLI](./cli.md) |

::: info Rich analysis fields
On C ABI, Node native, and WASM, the `analyze(...)` result carries chords, sections, timbre, dynamics, rhythm, melody, form, and per-beat strength. Python is the exception: its `analyze(...)` returns only BPM, BPM confidence, key, time signature, and beat times. When you only need one family — or you are on Python and need anything beyond the core summary — the focused helpers stay available across runtimes: `detectChords` / `detect_chords`, `analyzeSections` / `analyze_sections`, `analyzeTimbre` / `analyze_timbre`, `analyzeDynamics` / `analyze_dynamics`, and `analyzeRhythm` / `analyze_rhythm`.
:::

## Verification Sources

When checking parity, use the source files as the authoritative surface:

- `bindings/wasm/src/index.ts`
- `bindings/python/src/libsonare/analyzer.pyi`
- `bindings/node/src/index.ts`
- `src/sonare_c.h`
- `src/sonare_c_acoustic.h`
- `src/sonare.h`
- `tools/sonare_cli.cpp`

The libsonare repository also includes `tools/parity`, which checks default values, constants/enums, and parameter names across C++, C ABI, Python, Node, and WASM.
