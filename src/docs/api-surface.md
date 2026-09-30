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
| C ABI | `sonare_c.h` plus module headers such as `sonare_c_acoustic.h` | [C++ API](./cpp-api-effects.md#c-api), [Binding Parity](./binding-parity.md) |

## Feature Families

Feature families group APIs by the job they do. If you do not know an exact function name yet, start here.

::: details Acronyms in the feature table
Each line is a one-line gloss; follow the link for the authoritative explanation in the glossary.

- **STFT** — short-time Fourier transform, the basis of spectrograms. See [Spectrogram and STFT](./glossary/analysis/spectrogram-stft.md).
- **MFCC** — compact timbre features often used for ML and classification. See [Mel, MFCC, and Timbre](./glossary/analysis/mel-mfcc-timbre.md).
- **CQT / VQT** — frequency transforms aligned with musical pitch spacing. See [Chroma Features](./glossary/analysis/chroma-features.md).
- **NNLS / NMF** — matrix-factorization methods that split audio features into non-negative parts. See [Chroma Features](./glossary/analysis/chroma-features.md).
- **PLP** — a feature that estimates the main rhythmic pulse.
- **LUFS / LRA** — loudness and loudness-range metrics. See [LUFS](./glossary/lufs.md).
- **VCA** — a group control that moves several strip levels together. See [Buses and Sends](./glossary/mixing/buses-sends.md).
- **PFL / AFL** — pre-fader listen and after-fader listen, the two cue taps for auditioning a single track without changing the main output.
- **RIR** — room impulse response. See [Room Geometry and Volume](./glossary/acoustics/room-geometry.md).
- **Equivalent-room estimation** — fitting a practical room model from audio. See [Inverse Room Estimation](./glossary/acoustics/inverse-estimation.md).
- **Room morphing** — applying a target-room character as an effect.
:::

| Family | What is covered | Main pages |
|--------|-----------------|------------|
| Analysis | BPM, key, key candidates, beats, downbeats, onsets, chords, sections, melody, timbre, dynamics, rhythm, acoustic analysis | [JavaScript API](./js-api-analysis.md), [Python API](./python-api.md), [C++ API](./cpp-api.md) |
| Meter estimation | Time signature, downbeat phase, and accent grouping scored over a beat series you already hold: `estimateMeter` / `estimate_meter` / `sonare_estimate_meter_json`. Takes no audio, and has no subcommand of its own on either CLI | [Meter and Grouping](./glossary/analysis/meter-and-grouping.md) |
| Features | STFT, mel, MFCC, chroma, constant-Q chroma (`chromaCqt`), spectral contrast/poly features, zero crossings, pitch and tuning, CQT/VQT, NNLS chroma, NMF decomposition, nearest-neighbor filtering, tempogram, Fourier tempogram, cyclic tempogram, PLP, LUFS/LRA | [JavaScript API](./js-api-features.md#feature-extraction), [librosa Compatibility](./librosa-compatibility.md) |
| Metering | Offline level, loudness, crest-factor (mono and stereo-pair), true-peak and DC-offset meters; clipping and dynamic-range reports; stereo correlation/width; vectorscope, phase-scope, and spectrum snapshots | [JavaScript API](./js-api-audio.md#metering), [Python API](./python-api.md), [Native Bindings](./native-bindings.md) |
| Scale quantization | Snap MIDI notes to a scale, measure the correction in semitones, and test pitch-class membership | [JavaScript API](./js-api-analysis.md#scale-quantization), [Python API](./python-api.md) |
| Effects and editing | HPSS, HPSS with residual, harmonic/percussive extraction, normalize, trim, remix, phase vocoder, time stretch, pitch shift, pitch correction, note stretch, note extraction and rendering, region-based spectral editing, voice pitch/formant change, realtime voice presets | [Editing DSP](./editing-dsp.md), [Note Editing in Audio](./note-editing.md), [Spectral Editing](./spectral-editing.md), [JavaScript API](./js-api-effects.md#audio-effects) |
| Stem decomposition | Soft-mask separation whose components keep the source's phase and sum back to the input: `decomposeStems` / `decompose_stems` / `sonare_decompose_stems`; linked multichannel separation is available as `decomposeStemsLinked` / `decompose_stems_linked` / `sonare_decompose_stems_linked`, plus `decompose-stems` on both CLIs | [Source Separation](./source-separation.md), [Inverse Features](./inverse-features.md), [Linked stems](./js-api-features.md#decomposestemslinked-request), [Python API](./python-api.md) |
| Repair | Defect detectors and offline repair stages for broadband noise, hum, clipping, clicks, crackle, and diffuse reverb | [Audio Repair Workflow](./audio-repair.md), [Repairing Noise and Hum](./repair-noise.md), [Repairing Clipping, Clicks, and Crackle](./repair-transients.md), [Repairing Diffuse Reverb](./repair-reverb.md) |
| Aligned remix intervals | Resolve a set of cut points once, snapped to zero crossings, so every channel of a take can be sliced on the same frames: `remixAlignedIntervals` / `remix_aligned_intervals` / `sonare_remix_aligned_intervals`. API only — neither CLI carries it | [JavaScript API](./js-api-analysis.md), [Python API](./python-api.md) |
| Stereo normalization | Peak or RMS normalization of a left/right pair. The JavaScript surfaces expose one `normalizeStereo` with a `mode`; Python keeps two functions, `normalize_stereo` and `normalize_rms_stereo` | [JavaScript API](./js-api-effects.md), [Python API](./python-api.md) |
| Room acoustics | Impulse-response reverberation time (RT60 / EDT), clarity (C50 / C80), definition (D50), blind acoustic estimation, equivalent-room estimation, geometric RIR synthesis, and creative room morphing | [Room Acoustics](./acoustic-analysis.md), [JavaScript API](./js-api-effects.md#room-acoustics), [Python API](./python-api-effects.md#room-acoustics) |
| Mixing | Channel strips, buses, sends, VCA groups, scene presets, automation, stereo/dual pan, realtime-engine 5.1/7.1 surround pan, meters, goniometer, offline rendering | [Mixing Engine](./mixing.md), [Mixing Scene JSON](./mixing-scene-json.md) |
| Mixing assistant | Measures a set of tracks and returns a mixer scene with a written reason for every decision, and never applies it: `suggestMixScene` / `suggest_mix_scene` / `sonare_mixing_assistant_suggest_scene_json`, and `suggest-mix` on both CLIs | [Mixing Assistant](./mixing-assistant.md) |
| Mastering assistant | Source audio profile, chain suggestion JSON, streaming-platform preview JSON, and the stereo counterparts of all three that measure a left/right pair instead of a downmix | [Mastering Assistant](./mastering-assistant.md) |
| Mastering | Presets, full chains, named processors, processor catalog metadata, insert parameter metadata, pair processors, pair analyses, stereo analyses, streaming mastering chain, a structured multiband compressor with an arbitrary band count (chain-config schema version 2) | [Mastering Processors](./mastering-processors.md), [DSP Implementation Notes](./dsp-implementation.md), [Algorithm References](./algorithm-references.md), [Mastering Implementation](./mastering-implementation.md) |
| Streaming MIR | Live mel/chroma/onset frames, BPM/key/chord estimates that update over time, chord progression and pattern scores | [Realtime and Streaming](./realtime-streaming.md), [WASM](./wasm-streaming.md#streaming-analysis) |
| Realtime engine | Transport, tempo, structured markers, metronome, automation lanes (including hosted-instrument parameter targets resolved through `resolveInstrumentAutomationId` / `sonare_engine_resolve_instrument_automation_id`), reserved parameter metadata via `parameterInfo` / `parameterInfoByIndex`, a configurable time-stretch voice pool via `setWarpVoiceCapacity` / `warpVoiceCapacity`, graph topology, clips with a configurable clip-page look-ahead window (`setClipPagePrefetchFrames` / `clipPagePrefetchFrames`), MIDI clip schedule, per-track lane mixer (lanes, buses, sends, channel strips, surround pan, insert parameters), external MIDI output/clock, capture, per-track PFL/AFL cue monitoring, stereo/wide meter telemetry with named telemetry-error ordinals, scope telemetry and Worklet scope rings, bounce/freeze | [Realtime Engine](./realtime-engine.md#parameter-automation), [Voice budget](./realtime-engine.md#the-time-stretch-voice-budget), [Realtime and Streaming](./realtime-streaming.md) |
| Projects & arrangement | Audio/MIDI tracks and clips, in-memory project creation, undo/redo with a bounded history-memory cap, takes/comping, warp (clip modes `off`, `repitch`, `tempo-sync`, `time-stretch`), MIDI sequencing, SMF and MIDI 2.0 Clip File (`SMF2CLIP`) import/export, JSON save/load, assist sidecars, and offline bounce | [Project Editing](./project-editing.md), [Audio to MIDI](./audio-to-notes.md), [Project MIDI](./project-editing-midi.md), [Project Save & Load](./project-save-load.md), [Project Bounce](./project-bounce.md), [Recording and Takes](./recording-and-takes.md), [Realtime and Streaming](./realtime-streaming.md) |
| Instruments & MIDI | Multi-engine synth with a GM fallback bank, GS-compatible SoundFont 2 player, live MIDI playback, and GS insertion effects (EFX) selected over live SysEx | [Built-in Instruments](./native-synth.md), [SoundFont 2 Player](./soundfont-player.md), [MIDI Input](./midi-input.md#queueing-live-events), [MIDI Editing](./midi-editing.md), [MIDI 2.0 & UMP](./midi2.md) |
| Inverse features | Mel to STFT/audio, MFCC to mel/audio, CQT/VQT magnitude to audio | [Inverse Features](./inverse-features.md) |
| Utility / librosa parity | Frame/sample/time conversions, dB conversion, pre/de-emphasis, silence trim/split, frame/pad/fix helpers, peak pick, vector normalize, PCEN, tonnetz, test-signal generation (tone / chirp / clicks) | [librosa Compatibility](./librosa-compatibility.md) |
| Structure and segmentation | Cross-similarity, recurrence and lag matrices, path enhancement, sub-segmentation, agglomerative clustering, and note segmentation from an F0 track | [JavaScript API](./js-api-helpers.md#librosa-compatible-helpers), [Python API](./python-api-analysis.md#feature-extraction) |
| Build introspection | Machine-readable capability catalog (processors, parameter bounds and defaults, preset lists) plus a build-diagnostics report | [JavaScript API](./js-api.md#capabilitycatalog), [Python API](./python-api.md#what-this-build-can-do), [CLI](./cli.md#doctor) |

This table says what exists, not how evenly each runtime exposes it. For a measured per-domain breakdown of how much of the surface every runtime actually reaches, see [Binding Parity](./binding-parity.md).

## What The Capability Catalog Reports

The build can describe its own processor surface. `capabilityCatalog()` on Node and WASM, `capability_catalog()` on Python, and `sonare_capability_catalog_json` on the C ABI return the same JSON document: the build's version and ABI numbers, every named processor with its parameters and slot metadata, the built-in preset name lists, and mastering-preset metadata. Neither CLI exposes it; `doctor` prints the separate build-diagnostics report.

The current build publishes **89 processors and 5,352 parameter descriptors**. Both numbers can be recounted rather than taken on trust: the libsonare repository tracks the generated document as `tools/capability-catalog.json`, `make capability-catalog-check` fails when that file drifts from what the shared library actually answers, and `schemas/capability-catalog.schema.json` fixes the shape.

Every parameter descriptor carries the same ten fields:

| Field | What it holds |
|-------|---------------|
| `name` | The key construction reads, such as `releaseMs` or `band0.frequencyHz` |
| `id` | The integer id used by Mixer insert automation and MIDI-CC binding, or `null` for a construction-only key; realtime insert setters resolve the parameter by `name`, and non-null ids run `0..n-1` in automation order |
| `rtSafe` | Whether the value can be changed live from the audio thread |
| `type` | `number`, `boolean`, `enum`, `string`, or `array`, taken from the value the config builder reads |
| `default` | The config struct's field initializer when the builder has one; `null` means there is no fallback value |
| `min`, `max` | The interval construction accepted when probed, or `null` when the catalog knows of no limit on that side |
| `unit` | `dB`, `Hz`, `ms`, `samples`, `referenceSamples@29761Hz`, or `null` when the catalog has no recognized unit for the key; `null` does not prove the value is dimensionless |
| `choices` | A closed set of named numeric choices, including discrete numeric values with gaps, or `null` when no closed set is published |
| `slot` | The processor slot group that owns the key, or `null` when the key belongs to no group |

Entries with a non-null `id` are automation targets; construction-only entries have `id: null` and `rtSafe: false`. An `rtSafe: false` entry must not be scheduled for live automation even when it has an id. `choices` describes a closed named numeric set, including discrete numeric values with gaps. `slot` identifies the slot group a key belongs to; `null` means that it belongs to no slot. A non-null slot is not necessarily conditional: each processor's `slots` array supplies the group's `activation` (`anyKey` or `always`), its `parent` slot when nested, and any `minCrossoverCutoffs` requirement that determines when the group is present.

Defaults are read from the code, not written down, and can be `null` when a construction key has no fallback. Bounds are measured: candidate values go through the same construction path a caller uses, with the processor's other parameters at their defaults, and the catalog reports the interval validation accepted. A `null` bound means the processor takes any value on that side, or that construction never validates the key — not that a limit exists and went unmeasured. Two properties of a measured bound matter before you wire a slider to it: a control that constrains another reports the other's default, and an exclusive bound is reported as the value it excludes. [JavaScript API](./js-api.md#capabilitycatalog) walks through the concrete cases.

The `presets.mastering` array remains the compact list of mastering preset names. The top-level `masteringPresets` array adds one object per name with `kind`, `targetLufs`, `truePeakCeilingDb`, and `maxLimiterGainReductionDb`; restoration entries set those three numeric fields to `null`. Use `masteringPresetParams` on the binding when you need the flat numeric/boolean parameter map for a selected preset.

Two things the descriptor is good for:

- **A control surface without a hand-maintained table.** Lay out each parameter from its `type`, `default`, `min`, `max`, and `unit`, and a new processor or a renumbered band shows up in the UI when the build changes, not when someone edits a spreadsheet.
- **Checking a value before it crosses the boundary.** A number outside a published bound is rejected at construction. Testing it against the catalog first turns that runtime error into a validation message at the point the user typed the value.

```typescript
const catalog = capabilityCatalog();
const limiter = catalog.processors.find((p) => p.id === 'dynamics.brickwallLimiter');
const release = limiter?.params.find((p) => p.name === 'releaseMs');

function accepts(value: number): boolean {
  if (!release) return false;
  return (release.min === null || value >= release.min)
      && (release.max === null || value <= release.max);
}
```

The catalog describes the surface from the outside: which processors exist and what each accepts. It says nothing about why a processor is reachable from every runtime with the same id, or where the config builder that produced those defaults sits relative to the bindings that call it. That is the layering [Architecture](./architecture.md) lays out — the C++ core, the feature modules above it, and the thin bindings that translate language shapes into the same calls — and a reader who has just seen the catalog is the reader it was written for.

## Implementation And Evidence Pages

| Page | Role |
|------|------|
| [Mastering Processors](./mastering-processors.md) | Public registry of preset names, processor IDs, pair processors, pair analyses, and stereo analyses |
| [DSP Implementation Notes](./dsp-implementation.md) | What each DSP family does internally, including real-time boundaries and shared building blocks |
| [Algorithm References](./algorithm-references.md) | Standards, papers, algorithm families, and compatibility references that are visible in source, tests, or README |
| [Implementation Validation](./implementation-validation.md) | Test and validation map for feature groups, including librosa reference checks and real-time safety notes |

## WASM Export Families

This section is for readers who need to verify implementation details or exact public exports. If you only want to get a browser app running, it is enough to import what you need from `@libraz/libsonare` and call `init()` before using it.

The main `@libraz/libsonare` TypeScript package exports fall into a few groups: initialization and ABI checks, an `engineCapabilities` query, the audio-processing functions (analysis, effects/editing, mastering, mixing, feature extraction, inverse features, conversion helpers), and the stateful object APIs (`Audio`, `StreamAnalyzer`, `Mixer`, `RealtimeEngine`, and the streaming/voice-changer classes). The full, current export list is mirrored in [JavaScript API](./js-api.md), generated from `bindings/wasm/src/index.ts` in the libsonare repository — treat that TypeScript entry point as the authoritative reference.

::: tip What the ABI-version functions are for
`abiVersion`, `engineAbiVersion`, `projectAbiVersion`, and `voiceChangerAbiVersion` report the binary interface version each subsystem was built against. Compare them against the version your code expects to catch a mismatched or stale WASM build before you rely on its objects.
:::

The same npm package also exports `@libraz/libsonare/worklet` for the AudioWorklet bridge and `@libraz/libsonare/wasm` for bundlers or custom loaders that need the raw WASM asset.

## CLI Command Families

The CLI is the entry point when you want to point libsonare at files without writing a program. It is useful for automation and validation, but JavaScript / Python / C++ APIs are better for realtime UI or fine interactive control.

Two CLIs exist: the Python CLI covers the common user-facing commands (analysis, feature summaries, file-writing edits, acoustic/room work, and basic mastering/mixing), while the source-built C++ CLI adds a broader lower-level set (section/melody utilities, extra feature helpers, and mastering pair/stereo and mixing-scene export). The full, current command list with examples lives in [CLI](./cli.md); see [Binding Parity](./binding-parity.md) for the runtime differences.
