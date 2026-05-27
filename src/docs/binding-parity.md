# Binding Parity

libsonare uses one C++ core and exposes it through C, Python, Node native, WASM, and CLI surfaces. The feature set is intentionally close across bindings, but naming and configuration shape differ by language.

Read this page after [Feature Map](./api-surface.md) when you already know the feature family and need to choose a runtime or port code between bindings.

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

| Feature family | WASM | Python | Node native | C++ | C ABI | CLI |
|----------------|------|--------|-------------|-----|-------|-----|
| Batch analysis | Yes | Yes | Yes | Yes | Yes | Yes |
| Low-level features and librosa helpers | Yes | Yes | Yes | Yes | Yes | Yes for common commands |
| Streaming analyzer | Yes | Yes | Yes | Yes | Yes | No |
| Mel/MFCC inverse reconstruction | Yes | Yes | Yes | Yes | Yes | No |
| Realtime engine | Yes | Yes | Yes | Yes | Yes | No |
| Mastering presets/chains/processors | Yes | Yes | Yes | Yes | Yes | Partial command surface |
| Mastering assistant/profile/preview JSON | Yes | Yes | Yes | Yes | Yes | No dedicated CLI command |
| Mixing engine and scenes | Yes | Yes | Yes | Yes | Yes | `mix`; C++ CLI also scene preset export |
| Editing DSP | Yes | Yes | Yes | Yes | Yes | Yes |
| Room acoustics | `analyzeImpulseResponse`, `detectAcoustic` | `analyze_impulse_response`, `detect_acoustic`, `Audio.detect_acoustic()` | Yes | `quick::analyze_impulse_response`, `quick::detect_acoustic` | `sonare_analyze_impulse_response`, `sonare_detect_acoustic` | `sonare acoustic [--ir]` |
| File decoding | Browser: no, pass decoded samples | WAV/MP3 by default, FFmpeg builds add more formats | WAV/MP3 by default, FFmpeg builds add more formats | Same as build | Same as build | Same as Python/C++ executable build |

## Known Shape Differences

- WASM `masteringChain(...)` and `StreamingMasteringChain` use nested config objects; `masterAudio(...)` overrides use flat dot-notation keys.
- `StreamingMasteringChain` is for block-safe stages only. It rejects repair stages that need lookaround/file context and the whole-file `loudness` stage; use one-shot mastering APIs for those.
- `analyze(...)` is not identical across bindings. WASM returns the full `quick::analyze` shape with chords, sections, timbre, dynamics, rhythm, and form. Python, Node native, and the C ABI expose the compact C result (`bpm`, key, time signature, and beat times); call `detect_chords`/`detectChords`, `analyze_sections`/`analyzeSections`, `analyze_timbre`/`analyzeTimbre`, `analyze_dynamics`/`analyzeDynamics`, and `analyze_rhythm`/`analyzeRhythm` for the richer fields there.
- WASM `detectChords(...)` takes an options object, while Node native and Python expose the same controls as positional/keyword parameters.
- `mfccToAudio(...)` argument order differs between JavaScript runtimes: WASM uses `(mfcc, nMfcc, nFrames, nMels, sampleRate, ...)`, while Node native uses `(mfcc, nMfcc, nFrames, sampleRate, nFft, hopLength, nMels, ...)`. Python mirrors the C API shape with `n_mels` before `sample_rate`.
- Python `mix_stereo(...)` accepts `[(left, right), ...]` strips plus keyword arrays such as `fader_db`, `pan`, `width`, and `input_trim_db`.
- WASM `mixStereo(...)` accepts separate `leftChannels` and `rightChannels` arrays plus a `MixOptions` object.
- Persistent `Mixer` strip references differ slightly: WASM mixer methods take numeric strip indexes and provide `stripById(id)` for lookup; Node native and Python accept either a numeric index or a strip id string for most mixer control methods. For metering, use `meterTap(strip, tap)` when you need an explicit pre/post-fader tap; Node's `stripMeter(strip)` is the post-fader convenience path.
- The streaming analyzer ships in every non-CLI binding. WASM exposes `StreamAnalyzer.process(...)`, `readFrames(...)`, and `stats()`; Node native names the float Structure-of-Arrays read `readFramesSoa(...)`; Python uses `process(...)`, `read_frames(...)`, and `stats()`. All three add quantized `readFramesI16`/`readFramesU8` (`read_frames_i16`/`read_frames_u8` in Python) and a `StreamConfig.outputFormat`/`output_format` field.
- `normalize(...)` defaults differ: Python module functions and `Audio.normalize()` default to `target_db=-3.0`, while WASM and Node native default to `targetDb=0.0`.
- `trim(...)` and `trimSilence(...)` are different helpers. `trim(...)` uses a simple `thresholdDb` and returns audio only; `trimSilence(...)` / Python `trim_silence(...)` follow `librosa.effects.trim` with `topDb`, frame RMS, and original sample ranges.
- Scene JSON is the interchange format for persistent mixers. Prefer `Mixer.toSceneJson()` in WASM/Node or `Mixer.to_scene_json()` in Python over hand-written JSON when preserving runtime edits.
- Acoustic analysis has two entry points across bindings: impulse-response analysis for measured IR files and blind estimation from ordinary audio. Blind estimates should be displayed with their confidence value.
- Some CLI availability depends on whether the command is the PyPI Python CLI or the source-built C++ CLI. See [CLI](./cli.md).

## Verification Sources

When checking parity, use the source files as the authoritative surface: `bindings/wasm/src/index.ts`, `bindings/python/src/libsonare/analyzer.pyi`, `bindings/node/src/index.ts`, `src/sonare_c.h`, `src/sonare.h`, and `tools/sonare_cli.cpp`.
