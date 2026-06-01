# Feature Map

This page is the top-level map of libsonare. Start here when you know the task you want to solve but do not yet know which runtime, API page, or implementation note to open.

If this is your first time using libsonare, read [Learning Path](./learning-path.md) first. This page is a map of the full surface area, so it is broader than a first tutorial.

## What You Will Learn

By the end of this page you should be able to:

- locate a feature family without scanning every API reference;
- choose the runtime page that matches browser, Python, Node native, CLI, C++, or C ABI work;
- tell whether a topic belongs in task guides, API references, or implementation/evidence pages;
- use the source files listed here as the final authority when the public surface needs verification.

## How To Use This Map

| If you need to... | Read... |
|-------------------|---------|
| Find whether a feature exists | [Feature Families](#feature-families) |
| Choose an API surface | [Runtime Entry Points](#runtime-entry-points) and [Binding Parity](./binding-parity.md) |
| Understand DSP behavior and limits | [DSP Implementation Notes](./dsp-implementation.md) |
| Check algorithm or paper basis | [Algorithm References](./algorithm-references.md) |
| Check test coverage and validation status | [Implementation Validation](./implementation-validation.md) |

## Runtime Entry Points

| Runtime | Package or headers | Main docs |
|---------|--------------------|-----------|
| Browser / Node WASM | `@libraz/libsonare` plus worklet subpaths | [WASM](./wasm.md), [JavaScript API](./js-api.md) |
| Python / CLI | `pip install libsonare` | [Python API](./python-api.md), [CLI](./cli.md) |
| Node native | `@libraz/libsonare-native` source build | [Native Bindings](./native-bindings.md) |
| C++ | `sonare.h`, module headers | [C++ API](./cpp-api.md) |
| C ABI | `sonare_c.h` | [C++ API](./cpp-api.md#c-api), [Binding Parity](./binding-parity.md) |

## Feature Families

| Family | What is covered | Main pages |
|--------|-----------------|------------|
| Analysis | BPM, key, key candidates, beats, downbeats, onsets, chords, sections, melody, timbre, dynamics, rhythm, acoustic analysis | [JavaScript API](./js-api.md), [Python API](./python-api.md), [C++ API](./cpp-api.md) |
| Features | STFT, mel, MFCC, chroma, spectral contrast/poly features, zero crossings, pitch and tuning, CQT/VQT, NNLS chroma, NMF decomposition, nearest-neighbour filtering, tempogram, Fourier tempogram, cyclic tempogram, PLP, LUFS/LRA | [JavaScript API](./js-api.md#feature-extraction), [librosa Compatibility](./librosa-compatibility.md) |
| Metering | Offline level, loudness, crest-factor, true-peak and DC-offset meters; clipping and dynamic-range reports; stereo correlation/width; vectorscope, phase-scope, and spectrum snapshots | [JavaScript API](./js-api.md#metering), [Python API](./python-api.md), [Native Bindings](./native-bindings.md) |
| Scale quantization | Snap MIDI notes to a scale, measure the correction in semitones, and test pitch-class membership | [JavaScript API](./js-api.md#scale-quantization), [Python API](./python-api.md) |
| Effects and editing | HPSS, HPSS with residual, harmonic/percussive extraction, normalize, trim, remix, phase vocoder, time stretch, pitch shift, pitch correction, note stretch, voice pitch/formant change, realtime voice presets | [Editing DSP](./editing-dsp.md), [JavaScript API](./js-api.md#audio-effects) |
| Room acoustics | Impulse-response RT60/EDT/C50/C80/D50 analysis and blind acoustic estimation from normal recordings | [Room Acoustics](./acoustic-analysis.md), [JavaScript API](./js-api.md#room-acoustics), [Python API](./python-api.md#room-acoustics) |
| Mixing | Channel strips, buses, sends, VCA groups, scene presets, automation, meters, goniometer, offline rendering | [Mixing Engine](./mixing.md), [Mixing Scene JSON](./mixing-scene-json.md) |
| Mastering assistant | Source audio profile, chain suggestion JSON, streaming-platform preview JSON | [Mastering Assistant](./mastering-assistant.md) |
| Mastering | Presets, full chains, named processors, pair processors, pair analyses, stereo analyses, streaming mastering chain | [Mastering Processors](./mastering-processors.md), [DSP Implementation Notes](./dsp-implementation.md), [Algorithm References](./algorithm-references.md), [Mastering Implementation](./mastering-implementation.md) |
| Streaming MIR | Live mel/chroma/onset frames, progressive BPM/key/chord estimates, chord progression and pattern scores | [Realtime and Streaming](./realtime-streaming.md), [WASM](./wasm.md#streaming-analysis) |
| Realtime engine | Transport, tempo, markers, metronome, automation lanes, graph topology, clips, capture, monitor bus, telemetry, bounce/freeze | [Realtime and Streaming](./realtime-streaming.md) |
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

The main `@libraz/libsonare` TypeScript wrapper exports several groups:

| Group | Examples |
|-------|----------|
| Initialization | `init`, `isInitialized`, `version` |
| Engine capabilities | `engineAbiVersion`, `voiceChangerAbiVersion`, `engineCapabilities` |
| Audio work | High-level analysis, effects/editing, mastering, mixing, feature extraction, inverse features, conversion helpers |
| Object APIs | `Audio`, `StreamAnalyzer`, `StreamingMasteringChain`, `StreamingEqualizer`, `StreamingRetune`, `RealtimeVoiceChanger`, `Mixer`, `RealtimeEngine` |

The same npm package also exports `@libraz/libsonare/worklet` for the AudioWorklet bridge, `@libraz/libsonare/rt` for the reduced `sonare-rt` realtime module factory, and raw WASM asset subpaths (`@libraz/libsonare/wasm`, `@libraz/libsonare/rt-wasm`) for bundlers or custom loaders.

The complete function list is maintained in `bindings/wasm/src/index.ts` in the libsonare repository and mirrored in [JavaScript API](./js-api.md). When in doubt, use the wrapper source as the most specific reference for the WASM export surface.

## CLI Command Families

The Python CLI covers version/info, core analysis, common feature summaries, newer file-writing editing commands (`pitch-correct`, `note-stretch`, `voice-change`), acoustic/rhythm/dynamics/timbre summaries, LUFS, mastering processor entry points, and simple mixing. The source-built C++ CLI exposes a broader lower-level command set, including section/melody/boundary utilities, CQT/tonnetz/PCEN/Fourier tempogram and tempogram-ratio helpers, additional time/pitch file-processing commands (`time-stretch`, `pitch-shift`), mastering pair/stereo lists, and mixing scene preset export. See [CLI](./cli.md) for command examples and [Binding Parity](./binding-parity.md) for runtime differences.
