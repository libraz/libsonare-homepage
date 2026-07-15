# Feature Map

This page is the top-level map of libsonare. Start here when you know the task you want to solve but do not yet know which runtime, API page, or implementation note to open.

If this is your first time using libsonare, read [Learning Path](./learning-path.md) first. This page is a map of the full API area, so it is broader than a first tutorial.

## What You Will Learn

By the end of this page you should be able to:

- locate a feature family without scanning every API reference;
- choose the runtime page that matches browser, Python, Node native, CLI, C++, or C ABI work;
- tell whether a topic belongs in task guides, API references, or implementation/evidence pages;
- use the source files listed here as the final authority when the public API needs verification.

## How To Use This Map

This page is not a list to memorize. Choose one task, then follow that row to the right runtime and guide.

If you are unsure, use this order:

1. decide **what you want to do**: detect BPM, draw a browser visualizer, export a master, and so on;
2. decide **where it runs**: browser, Python script, C++ app, or CLI;
3. pick the closest feature family below, then open the matching runtime page.

You do not need to know every acronym before starting.

- A **feature** is a numeric summary extracted from audio, not the audio itself.
- **MIR** means Music Information Retrieval: reading information such as BPM, key, chords, and beats from music.
- **DSP** means Digital Signal Processing: measuring or transforming audio signals.

::: info Runtime, API, and binding
**Runtime** means where the code runs: browser, Python, CLI, Node, or C++. **API** means the functions and classes you call. **Binding** means the layer that lets another language call the same C++ core. If you are unsure, choose one runtime first and read only that runtime's API page.
:::

| If you need to... | Read... |
|-------------------|---------|
| Find whether a feature exists | [Feature Families](#feature-families) |
| Choose an API | [Runtime Entry Points](#runtime-entry-points) and [Binding Parity](./binding-parity.md) |
| Understand DSP behavior and limits | [DSP Implementation Notes](./dsp-implementation.md) |
| Check algorithm or paper basis | [Algorithm References](./algorithm-references.md) |
| Check test coverage and validation status | [Implementation Validation](./implementation-validation.md) |

## Runtime Entry Points

Runtime means "which environment calls libsonare." The core math lives in C++, but browsers use it through WASM, Python uses a Python package, and terminal workflows use the CLI. If you are new, pick the runtime that matches where your app runs and read only that API page first.

| Runtime | Package or headers | Main docs |
|---------|--------------------|-----------|
| Browser / Node WASM | `@libraz/libsonare` plus worklet subpaths | [WASM](./wasm.md), [JavaScript API](./js-api.md) |
| Python / CLI | `pip install libsonare` | [Python API](./python-api.md), [CLI](./cli.md) |
| Node native | `@libraz/libsonare-native` source build | [Native Bindings](./native-bindings.md) |
| C++ | `sonare.h`, module headers | [C++ API](./cpp-api.md) |
| C ABI | `sonare_c.h` plus module headers such as `sonare_c_acoustic.h` | [C++ API](./cpp-api.md#c-api), [Binding Parity](./binding-parity.md) |

## Feature Families

Feature families group APIs by the job they do. If you do not know an exact function name yet, start here.

::: details Acronyms in the feature table
- **STFT** — short-time Fourier transform, the basis of spectrograms.
- **MFCC** — compact timbre features often used for ML and classification.
- **CQT / VQT** — frequency transforms aligned with musical pitch spacing.
- **NNLS / NMF** — matrix-factorization methods that split audio features into non-negative parts.
- **PLP** — a feature that estimates the main rhythmic pulse.
- **LUFS / LRA** — loudness and loudness-range metrics.
- **VCA** — a group control that moves several strip levels together.
- **RIR** — room impulse response.
- **Equivalent-room estimation** — fitting a practical room model from audio.
- **Room morphing** — applying a target-room character as an effect.
:::

| Family | What is covered | Main pages |
|--------|-----------------|------------|
| Analysis | BPM, key, key candidates, beats, downbeats, onsets, chords, sections, melody, timbre, dynamics, rhythm, acoustic analysis | [JavaScript API](./js-api.md), [Python API](./python-api.md), [C++ API](./cpp-api.md) |
| Features | STFT, mel, MFCC, chroma, constant-Q chroma (`chromaCqt`), spectral contrast/poly features, zero crossings, pitch and tuning, CQT/VQT, NNLS chroma, NMF decomposition, nearest-neighbor filtering, tempogram, Fourier tempogram, cyclic tempogram, PLP, LUFS/LRA | [JavaScript API](./js-api.md#feature-extraction), [librosa Compatibility](./librosa-compatibility.md) |
| Metering | Offline level, loudness, crest-factor, true-peak and DC-offset meters; clipping and dynamic-range reports; stereo correlation/width; vectorscope, phase-scope, and spectrum snapshots | [JavaScript API](./js-api.md#metering), [Python API](./python-api.md), [Native Bindings](./native-bindings.md) |
| Scale quantization | Snap MIDI notes to a scale, measure the correction in semitones, and test pitch-class membership | [JavaScript API](./js-api.md#scale-quantization), [Python API](./python-api.md) |
| Effects and editing | HPSS, HPSS with residual, harmonic/percussive extraction, normalize, trim, remix, phase vocoder, time stretch, pitch shift, pitch correction, note stretch, region-based spectral editing, voice pitch/formant change, realtime voice presets | [Editing DSP](./editing-dsp.md), [Spectral Editing](./spectral-editing.md), [JavaScript API](./js-api.md#audio-effects) |
| Room acoustics | Impulse-response reverberation time (RT60 / EDT), clarity (C50 / C80), definition (D50), blind acoustic estimation, equivalent-room estimation, geometric RIR synthesis, and creative room morphing | [Room Acoustics](./acoustic-analysis.md), [JavaScript API](./js-api.md#room-acoustics), [Python API](./python-api.md#room-acoustics) |
| Mixing | Channel strips, buses, sends, VCA groups, scene presets, automation, stereo/dual pan, realtime-engine 5.1/7.1 surround pan, meters, goniometer, offline rendering | [Mixing Engine](./mixing.md), [Mixing Scene JSON](./mixing-scene-json.md) |
| Mastering assistant | Source audio profile, chain suggestion JSON, streaming-platform preview JSON | [Mastering Assistant](./mastering-assistant.md) |
| Mastering | Presets, full chains, named processors, processor catalog metadata, insert parameter metadata, pair processors, pair analyses, stereo analyses, streaming mastering chain | [Mastering Processors](./mastering-processors.md), [DSP Implementation Notes](./dsp-implementation.md), [Algorithm References](./algorithm-references.md), [Mastering Implementation](./mastering-implementation.md) |
| Streaming MIR | Live mel/chroma/onset frames, BPM/key/chord estimates that update over time, chord progression and pattern scores | [Realtime and Streaming](./realtime-streaming.md), [WASM](./wasm.md#streaming-analysis) |
| Realtime engine | Transport, tempo, structured markers, metronome, automation lanes, graph topology, clips, MIDI clip schedule, per-track lane mixer (lanes, buses, sends, channel strips, surround pan, insert parameters), external MIDI output/clock, capture, monitor bus, stereo/wide meter telemetry, scope telemetry and Worklet scope rings, bounce/freeze | [Realtime and Streaming](./realtime-streaming.md) |
| Projects & arrangement | Audio/MIDI tracks and clips, undo/redo, takes/comping, warp, MIDI sequencing, SMF and MIDI 2.0 Clip File (`SMF2CLIP`) import/export, JSON save/load, and offline bounce | [Project Editing](./project-editing.md), [Project Bounce](./project-bounce.md), [Recording and Takes](./recording-and-takes.md), [Realtime and Streaming](./realtime-streaming.md) |
| Instruments & MIDI | Multi-engine synth with a GM fallback bank, GS-compatible SoundFont 2 player, and live MIDI playback | [Built-in Instruments](./native-synth.md), [SoundFont 2 Player](./soundfont-player.md), [MIDI Input](./midi-input.md) |
| Inverse features | Mel to STFT/audio, MFCC to mel/audio | [Inverse Features](./inverse-features.md) |
| Utility / librosa parity | Frame/sample/time conversions, dB conversion, pre/de-emphasis, silence trim/split, frame/pad/fix helpers, peak pick, vector normalize, PCEN, tonnetz | [librosa Compatibility](./librosa-compatibility.md) |

## Implementation And Evidence Pages

| Page | Role |
|------|------|
| [Mastering Processors](./mastering-processors.md) | Public registry of preset names, processor IDs, pair processors, pair analyses, and stereo analyses |
| [DSP Implementation Notes](./dsp-implementation.md) | What each DSP family does internally, including real-time boundaries and shared building blocks |
| [Algorithm References](./algorithm-references.md) | Standards, papers, algorithm families, and compatibility references that are visible in source, tests, or README |
| [Implementation Validation](./implementation-validation.md) | Test and validation map for feature groups, including librosa reference checks and real-time safety notes |

## WASM Export Families

This section is for readers who need to verify implementation details or exact public exports. If you only want to get a browser app running, it is enough to import what you need from `@libraz/libsonare` and call `init()` before using it.

The main `@libraz/libsonare` TypeScript package exports several groups:

| Group | Examples |
|-------|----------|
| Initialization and ABI checks | `init`, `isInitialized`, `version`, `abiVersion`, `engineAbiVersion`, `projectAbiVersion`, `voiceChangerAbiVersion` |
| Engine capabilities | `engineCapabilities` |
| Audio work | High-level analysis, effects/editing, mastering, mixing, feature extraction, inverse features, conversion helpers |
| Object APIs | `Audio`, `StreamAnalyzer`, `StreamingMasteringChain`, `StreamingEqualizer`, `StreamingRetune`, `RealtimeVoiceChanger`, `Mixer`, `RealtimeEngine` |

The same npm package also exports `@libraz/libsonare/worklet` for the AudioWorklet bridge and `@libraz/libsonare/wasm` for bundlers or custom loaders that need the raw WASM asset.

The function list is maintained in `bindings/wasm/src/index.ts` in the libsonare repository and mirrored in [JavaScript API](./js-api.md). When in doubt, use that TypeScript entry point as the most specific reference for WASM exports.

## CLI Command Families

The CLI is the entry point when you want to point libsonare at files without writing a program. It is useful for automation and validation, but JavaScript / Python / C++ APIs are better for realtime UI or fine interactive control.

The Python CLI covers the common user-facing commands:

- version/info and core analysis;
- feature summaries and LUFS;
- file-writing editing commands such as `pitch-correct`, `note-stretch`, and `voice-change`;
- acoustic/rhythm/dynamics/timbre summaries;
- equivalent-room estimation, RIR synthesis, and room morphing;
- mastering processor entry points and simple mixing.

The source-built C++ CLI exposes a broader lower-level command set. Use it for section/melody/boundary utilities, CQT/tonnetz/PCEN/Fourier tempogram helpers, extra time/pitch file-processing commands, mastering pair/stereo lists, and mixing scene preset export.

See [CLI](./cli.md) for command examples and [Binding Parity](./binding-parity.md) for runtime differences.
