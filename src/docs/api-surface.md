# Feature Map

This page is the top-level map of libsonare. Start here when you know the task but not yet which runtime, API page or implementation note to open. For a first tutorial, read [Learning Path](./learning-path.md) instead; this page covers the whole API area.

Choose one task, then follow its row to the right runtime and guide.

| If you need to... | Read... |
|-------------------|---------|
| Find whether a feature exists | [Feature Families](#feature-families) |
| Find a call's name in each binding | [Names by Binding](#names-by-binding) |
| Choose a runtime | [Runtime Entry Points](#runtime-entry-points) and [Binding Parity](./binding-parity.md) |
| Understand DSP behavior and limits | [DSP Implementation Notes](./dsp-implementation.md) |
| Check algorithm or paper basis | [Algorithm References](./algorithm-references.md) |
| Check test coverage and validation status | [Implementation Validation](./implementation-validation.md) |

::: details Terms used on this page
- **Runtime** is where the code runs: browser, Python, CLI, Node or C++. **API** is the functions and classes you call. **Binding** is the layer that lets another language call the same C++ core. Choose one runtime first and read only its API page.
- A **feature** is a numeric summary extracted from audio, not the audio itself. **MIR** (Music Information Retrieval) is reading BPM, key, chords and beats from music. **DSP** (Digital Signal Processing) is measuring or transforming audio signals.
:::

## Runtime Entry Points

The core math lives in C++. Browsers reach it through WASM, Python through a package, and terminal workflows through the CLI. Pick the runtime that matches where your app runs and read only that API page first.

| Runtime | Package or headers | Main docs |
|---------|--------------------|-----------|
| Browser / Node WASM | `@libraz/libsonare` plus worklet subpaths | [WASM](./wasm.md), [JavaScript API](./js-api.md) |
| Python / CLI | `pip install libsonare` | [Python API](./python-api.md), [CLI](./cli.md) |
| Node native | `@libraz/libsonare-native` source build | [Native Bindings](./native-bindings.md) |
| C++ | `sonare.h`, module headers | [C++ API](./cpp-api.md) |
| C ABI | `sonare_c.h` plus module headers such as `sonare_c_acoustic.h` | [C ABI](./cpp-api-c-abi.md), [Binding Parity](./binding-parity.md) |

## Feature Families

Feature families group APIs by the job they do, ordered by task. If you do not know an exact function name yet, start here.

::: details Acronyms in the tables
- **STFT**: short-time Fourier transform, the basis of spectrograms. See [Spectrogram and STFT](./glossary/analysis/spectrogram-stft.md).
- **MFCC**: compact timbre features often used for ML and classification. See [Mel, MFCC, and Timbre](./glossary/analysis/mel-mfcc-timbre.md).
- **CQT / VQT**: frequency transforms aligned with musical pitch spacing. See [Chroma Features](./glossary/analysis/chroma-features.md).
- **NNLS / NMF**: matrix-factorization methods that split audio features into non-negative parts. See [Chroma Features](./glossary/analysis/chroma-features.md).
- **PLP**: a feature that estimates the main rhythmic pulse.
- **LUFS / LRA**: loudness and loudness-range metrics. See [LUFS](./glossary/lufs.md).
- **VCA**: a group control that moves several strip levels together. See [Buses and Sends](./glossary/mixing/buses-sends.md).
- **PFL / AFL**: pre-fader listen and after-fader listen, the two cue taps for auditioning a single track without changing the main output.
- **RIR**: room impulse response. See [Room Geometry and Volume](./glossary/acoustics/room-geometry.md).
- **Equivalent-room estimation**: fitting a practical room model from audio. See [Inverse Room Estimation](./glossary/acoustics/inverse-estimation.md).
- **Room morphing**: applying a target-room character as an effect.
:::

### Analyze

| Family | What is covered | Main pages |
|--------|-----------------|------------|
| Analysis | BPM, key and key candidates, beats, downbeats, onsets, chords and chord functions, sections, melody, timbre, dynamics, rhythm, measured tuning | [JavaScript API](./js-api-analysis.md), [Python API](./python-api.md), [C++ API](./cpp-api.md) |
| Meter estimation | Time signature, downbeat phase and accent grouping scored over a beat series you already hold; takes no audio | [Meter and Grouping](./glossary/analysis/meter-and-grouping.md) |
| Features | STFT, mel, MFCC, chroma, CQT/VQT, tempograms, PLP, spectral and pitch features, NNLS chroma, NMF decomposition, LUFS/LRA | [JavaScript API](./js-api-features.md#feature-extraction), [librosa Compatibility](./librosa-compatibility.md) |
| Metering | Level, loudness, crest-factor, true-peak and DC-offset meters; clipping and dynamic-range reports; stereo correlation and width; vectorscope, phase-scope and spectrum snapshots | [JavaScript API](./js-api-audio.md#metering), [Python API](./python-api.md), [Native Bindings](./native-bindings.md) |
| Structure and segmentation | Cross-similarity, recurrence and lag matrices, path enhancement, sub-segmentation, agglomerative clustering, note segmentation from an F0 track | [JavaScript API](./js-api-helpers.md#librosa-compatible-helpers), [Python API](./python-api-analysis.md#feature-extraction) |
| Streaming MIR | Live mel, chroma and onset frames; BPM, key and chord estimates that update over time; chord progression and pattern scores | [Realtime and Streaming](./realtime-streaming.md), [WASM](./wasm-streaming.md#streaming-analysis) |
| Audio to notes | Monophonic and polyphonic transcription to a MIDI clip, the polyphonic tracker's limits, the shortest note as a note value, a measured reference pitch | [Audio to MIDI](./audio-to-notes.md) |
| Room acoustics | Reverberation time and clarity from an impulse response, blind and equivalent-room estimation, geometric RIR synthesis, room morphing (including a stereo morph) | [Room Acoustics](./acoustic-analysis.md), [JavaScript API](./js-api-effects.md#room-acoustics), [Python API](./python-api-effects.md#room-acoustics) |

### Edit and repair

| Family | What is covered | Main pages |
|--------|-----------------|------------|
| Effects and editing | HPSS, normalize, trim, remix, time stretch, pitch shift, pitch correction (including automatic correction to a key), note editing, region-based spectral editing, voice pitch and formant change | [Editing DSP](./editing-dsp.md), [Note Editing in Audio](./note-editing.md), [Spectral Editing](./spectral-editing.md), [JavaScript API](./js-api-effects.md#audio-effects) |
| Stem decomposition | Soft-mask separation whose components keep the source's phase and sum back to the input; a linked variant for multichannel sources | [Source Separation](./source-separation.md), [Inverse Features](./inverse-features.md), [Linked stems](./js-api-features.md#decomposestemslinked-request) |
| Repair | Detectors and repair stages for broadband noise, hum, clipping, clicks, crackle and diffuse reverb, run in one call for any channel count; decrackle, dehum and the classical denoise and dereverb stages are also realtime inserts | [Audio Repair Workflow](./audio-repair.md), [Repairing Noise and Hum](./repair-noise.md), [Repairing Clipping, Clicks, and Crackle](./repair-transients.md), [Repairing Diffuse Reverb](./repair-reverb.md) |
| Aligned remix intervals | Cut points resolved once, snapped to zero crossings, so every channel of a take is sliced on the same frames. API only, no CLI | [JavaScript API](./js-api-analysis.md), [Python API](./python-api.md) |
| Stereo normalization | Peak or RMS normalization of a left/right pair | [JavaScript API](./js-api-effects.md), [Python API](./python-api.md) |
| Scale quantization | Snap MIDI notes to a scale, measure the correction in semitones, test pitch-class membership | [JavaScript API](./js-api-helpers.md#scale-quantization), [Python API](./python-api.md) |
| Inverse features | Mel to STFT or audio, MFCC to mel or audio, CQT/VQT magnitude to audio | [Inverse Features](./inverse-features.md) |

### Master and mix

| Family | What is covered | Main pages |
|--------|-----------------|------------|
| Mastering | Presets, full chains, named processors and their metadata, pair processors and analyses, A/B loudness and EQ match, stereo analyses, a streaming chain, a structured multiband compressor | [Mastering Processors](./mastering-processors.md), [DSP Implementation Notes](./dsp-implementation.md), [Algorithm References](./algorithm-references.md), [Mastering Implementation](./mastering-implementation.md) |
| Mastering assistant | Source audio profile, chain suggestion JSON and streaming-platform preview JSON, with stereo counterparts that measure a left/right pair | [Mastering Assistant](./mastering-assistant.md) |
| Mixing | Channel strips, buses, sends, VCA groups, scene presets, automation, stereo and surround pan, meters, goniometer, offline rendering | [Mixing Engine](./mixing.md), [Mixing Scene JSON](./mixing-scene-json.md) |
| Mixing assistant | Measures a set of tracks and returns a mixer scene with a written reason for every decision; it never applies the scene | [Mixing Assistant](./mixing-assistant.md) |

### Projects and instruments

| Family | What is covered | Main pages |
|--------|-----------------|------------|
| Projects and arrangement | Audio and MIDI tracks and clips, undo/redo, takes and comping, warp, MIDI sequencing, SMF and MIDI 2.0 Clip File import/export, JSON save/load, offline bounce | [Project Editing](./project-editing.md), [Project MIDI](./project-editing-midi.md), [Project Save & Load](./project-save-load.md), [Project Bounce](./project-bounce.md), [Recording and Takes](./recording-and-takes.md) |
| Instruments and MIDI | Multi-engine synth with a GM fallback bank, parameter descriptors, live program change, GS-compatible SoundFont 2 player, live MIDI playback, GS insertion effects (EFX) | [Built-in Instruments](./native-synth.md), [SoundFont 2 Player](./soundfont-player.md), [MIDI Input](./midi-input.md#queueing-live-events), [MIDI Editing](./midi-editing.md), [MIDI 2.0 & UMP](./midi2.md) |

### Play and render

| Family | What is covered | Main pages |
|--------|-----------------|------------|
| Realtime engine | Transport, tempo, markers, metronome, automation lanes, clips and the MIDI clip schedule, a per-track lane mixer, external MIDI output and clock, capture, PFL/AFL cue monitoring, meter and scope telemetry, offline render, bounce and freeze | [Realtime Engine](./realtime-engine.md), [Parameter automation](./realtime-engine.md#parameter-automation), [Voice budget](./realtime-engine.md#the-time-stretch-voice-budget), [Realtime and Streaming](./realtime-streaming.md) |
| Audio loading | Decoded-sample entry points and `Audio.fromMemory*`; every source channel kept and folded by the ITU-R BS.775 rule; on WASM, browser decoding and Origin Private File System clips | [JavaScript API](./js-api-audio.md), [Channel Formats](./channel-formats.md), [WASM](./wasm.md#file-input) |

### Reference and introspection

| Family | What is covered | Main pages |
|--------|-----------------|------------|
| Utility / librosa parity | Frame, sample and time conversions, dB conversion, pre/de-emphasis, silence trim and split, peak pick, PCEN, tonnetz, test-signal generation | [librosa Compatibility](./librosa-compatibility.md) |
| Build introspection | Machine-readable capability catalog (processors, parameter bounds and defaults, preset lists) and a build-diagnostics report | [JavaScript API](./js-api.md#capabilitycatalog), [Python API](./python-api.md#what-this-build-can-do), [CLI](./cli.md#doctor) |

This page says what exists, not how evenly each runtime exposes it. [Binding Parity](./binding-parity.md) has the per-domain breakdown.

## Names by Binding

The same call is spelled differently in each runtime. The rows below are the calls whose spelling is not a plain camelCase to snake_case rename, or that have a C name worth knowing. A CLI cell says `no` when no command carries the call.

### Analysis and editing

| Area | JavaScript | Python | C | CLI |
|------|------------|--------|---|-----|
| Chord functions on chords you hold | `chordFunctions` (adds `roman` and `function`) | `chord_functions` | `sonare_chord_functions` | no |
| Chord or key to an arrangement annotation | `chordSymbolFromAnalysis`, `keyModeFromAnalysis` | `chord_symbol_from_analysis`, `key_mode_from_analysis` | `sonare_chord_symbol_from_analysis`, `sonare_key_mode_from_analysis` | no |
| Meter over a beat series | `estimateMeter` | `estimate_meter` | `sonare_estimate_meter_json` | no |
| Measured tuning | `tuning: 'auto'`, `estimateTuning` | `tuning="auto"`, `estimate_tuning` | `sonare_estimate_tuning` | no |
| Stem decomposition | `decomposeStems`, `decomposeStemsLinked` | `decompose_stems`, `decompose_stems_linked` | `sonare_decompose_stems`, `sonare_decompose_stems_linked` | `decompose-stems` on both |
| Aligned remix intervals | `remixAlignedIntervals` | `remix_aligned_intervals` | `sonare_remix_aligned_intervals` | no |
| Stereo normalization | `normalizeStereo` with a `mode` | `normalize_stereo`, `normalize_rms_stereo` | `sonare_normalize_stereo`, `sonare_normalize_rms_stereo` | no |
| Automatic pitch correction to a key | `autoTune` | `auto_tune` | `sonare_auto_tune` | no |

### Mastering, mixing and rooms

| Area | JavaScript | Python | C | CLI |
|------|------------|--------|---|-----|
| Repair in one call | `masteringRepairAnalyze`, `masteringRepairApply` | `mastering_repair_analyze`, `mastering_repair_apply` | `sonare_mastering_repair_analyze`, `sonare_mastering_repair_apply` | no |
| Static gain of a streaming chain | `streamingLoudnessGain` | `streaming_loudness_gain` | `sonare_streaming_loudness_gain` | no |
| Reference at its own sample rate | `referenceSampleRate` | `reference_sample_rate` | `reference_sample_rate` argument | `mastering-pair-*` read any rate |
| Mixing assistant | `suggestMixScene` | `suggest_mix_scene` | `sonare_mixing_assistant_suggest_scene_json` | `suggest-mix` |
| Per-track sample rate in the assistant | `sampleRate` on `MixAssistantTrack` | `sample_rate` on `MixTrackInput` | `track_sample_rates` | no |
| Route a strip or bus into a submix | `Mixer.setOutputBus` | `set_output_bus` | `sonare_mixer_set_output_bus` | no |
| Estimate to synthesis input | `roomGeometryFromEstimate` | `room_geometry_from_estimate` | `sonare_room_geometry_from_estimate` | no |
| Stereo room morph | `roomMorphStereo` | `room_morph_stereo` | `sonare_room_morph_stereo` | `room-morph` on both |

### Realtime engine and instruments

| Area | JavaScript | Python | C | CLI |
|------|------------|--------|---|-----|
| Edit one lane's sends or output bus | `setTrackSends`, `setTrackOutputBus` | `set_track_sends`, `set_track_output_bus` | `sonare_engine_set_track_sends`, `sonare_engine_set_track_output_bus` | no |
| Automation ids for hosted instruments, lanes and buses | `resolveInstrumentAutomationId`, `resolveTrackLaneAutomationId`, `resolveBusAutomationId` | `resolve_instrument_automation_id`, `resolve_track_lane_automation_id`, `resolve_bus_automation_id` | `sonare_engine_resolve_instrument_automation_id`, `sonare_engine_resolve_track_lane_automation_id`, `sonare_engine_resolve_bus_automation_id` | no |
| Check a sidechain binding without applying it | `canSetLaneSidechain`, `canSetBusSidechain`, `canSetMasterSidechain` | `can_set_lane_sidechain`, `can_set_bus_sidechain`, `can_set_master_sidechain` | `sonare_engine_can_set_lane_sidechain` and siblings | no |
| Offline render and tail | `renderOffline`, `finishOfflineRender`, `bounceOffline`, `freezeOffline`, `tailSamples`, `graphLatencySamplesQ8` | `finish_offline_render`, `tail_samples`, `graph_latency_samples_q8` | `sonare_engine_tail_samples` | no |
| Clip edits on a running engine | `upsertClip`, `removeClip` | `upsert_clip`, `remove_clip` | `sonare_engine_upsert_clip`, `sonare_engine_remove_clip` | no |
| Reserved parameter metadata | `parameterInfo`, `parameterInfoByIndex` | `parameter_info`, `parameter_info_by_index` | `sonare_engine_parameter_info`, `sonare_engine_parameter_info_by_index` | no |
| Time-stretch voice pool, clip-page lookahead | `setWarpVoiceCapacity`, `setClipPagePrefetchFrames` | `set_warp_voice_capacity`, `set_clip_page_prefetch_frames` | `sonare_engine_set_warp_voice_capacity`, `sonare_engine_set_clip_page_prefetch_frames` | no |
| Engine model fields of a synth patch | `engineParams`, `synthEngineParamInfo`, `synthPatchParamInfo` | `engine_params`, `synth_engine_param_info`, `synth_patch_param_info` | `SonareSynthPatch.engine_params`, `sonare_synth_engine_param_info` | no |
| Live program change with an optional bank | `pushMidiProgram`, `pushMidiInputProgram` | `push_midi_program`, `push_midi_input_program` | `sonare_engine_push_midi_program` | no |

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
`abiVersion`, `engineAbiVersion`, `projectAbiVersion`, and `voiceChangerAbiVersion` report the binary interface version each subsystem was built against. Compare them against the version your code expects to catch a mismatched or stale WASM build before you rely on its objects. Every binding also checks the loaded native module's aggregate ABI version itself when it loads (`0x05030207`, exported as `EXPECTED_ABI_VERSION` on WASM) and refuses a mismatch with the error code `AbiMismatch` (10): Node when the addon is required, WASM in `init()`, Python on first library use.
:::

The same npm package also exports `@libraz/libsonare/worklet` for the AudioWorklet bridge, `@libraz/libsonare/wasm` (and `@libraz/libsonare/wasm/analysis` for the analysis-only module) for bundlers or custom loaders that need the raw WASM asset. [Installation](./installation.md#wasm-package-subpaths) lists every subpath.

## CLI Command Families

The CLI is the entry point when you want to point libsonare at files without writing a program. It is useful for automation and validation, but JavaScript / Python / C++ APIs are better for realtime UI or fine interactive control.

Two CLIs exist: the Python CLI covers the common user-facing commands (analysis, feature summaries, file-writing edits, acoustic/room work, and basic mastering/mixing), while the source-built C++ CLI adds a broader lower-level set (section/melody utilities, extra feature helpers, and mastering pair/stereo and mixing-scene export). The full, current command list with examples lives in [CLI](./cli.md); see [Binding Parity](./binding-parity.md) for the runtime differences.

## What The Capability Catalog Reports

The build can describe its own processor surface. `capabilityCatalog()` on Node and WASM, `capability_catalog()` on Python, and `sonare_capability_catalog_json` on the C ABI return the same JSON document: the build's version and ABI numbers, every named processor with its parameters and slot metadata, the built-in preset name lists, and mastering-preset metadata. Neither CLI exposes it; `doctor` prints the separate build-diagnostics report.

The current build publishes **95 processors and 5,579 parameter descriptors**; 84 of the processors are realtime-insertable, and every processor reports a `category`. All of these numbers can be recounted rather than taken on trust: the libsonare repository tracks the generated document as `tools/capability-catalog.json`, `make capability-catalog-check` fails when that file drifts from what the shared library actually answers, and `schemas/capability-catalog.schema.json` fixes the shape.

Every parameter descriptor carries the same eighteen fields:

| Field | What it holds |
|-------|---------------|
| `name` | The key construction reads, such as `releaseMs` or `band0.frequencyHz` |
| `id` | The integer id used by Mixer insert automation and MIDI-CC binding, or `null` for a construction-only key; realtime insert setters resolve the parameter by `name`, and non-null ids run `0..n-1` in automation order |
| `rtSafe` | Whether the value can be changed live from the audio thread |
| `type` | `number`, `boolean`, `enum`, `string`, or `array`, taken from the value the config builder reads |
| `default` | The config struct's field initializer when the builder has one; `null` means there is no fallback value |
| `min`, `max` | The interval construction accepted when probed, or `null` when the catalog knows of no limit on that side |
| `minExclusive`, `maxExclusive` | Whether the bound itself is rejected; `false` when that bound is `null` |
| `maxRelativeTo` | `'nyquist'` when the effective ceiling is the lower of `max` and the host's Nyquist, otherwise `null` |
| `unit` | The unit the processor declares for the key, from a closed set: `dB`, `dBFS`, `LUFS`, `Hz`, `ms`, `s`, `samples`, `m`, `cm`, `deg`, `percent`, `degC`, `V`, `inPerSec`, `dBPerOct`, `semitones`, `cents`, `ratio`, `bits`, `count`, `none`. It is `null` for the boolean, enum, string, and array keys, which have no unit |
| `uiMin`, `uiMax` | The range a control should draw, inside `min` / `max`, or `null` when the accepted range is also the display range |
| `scale` | The axis a control draws the value on: `linear` or `log` |
| `choices` | A closed set of named numeric choices, including discrete numeric values with gaps, or `null` when no closed set is published |
| `slot` | The processor slot group that owns the key, or `null` when the key belongs to no group |
| `dependsOn` | The sibling keys whose live value bounds this one, each as `{ key, relation, factor }` with `relation` one of `lt`, `le`, `gt`, `ge` read as `this <relation> factor * sibling` (`factor` is 1 for a plain ordering); empty for an independent key |
| `coupledWith` | The other sibling keys, beyond `dependsOn`, that move this key's accepted range in a way a single relation cannot state (for `effects.reverb.room`, `receiverSpacingM` is coupled to `lengthM`, `widthM`, `listenerX`, `listenerY`, `sourceX` and `sourceY`); empty for an independent key. `min` / `max` are measured with these siblings at their defaults |

Each processor entry also carries `causal`, which is `true` for every realtime-insertable processor and for the four causal repair stages (`repair.decrackle`, `repair.dehum`, `repair.denoiseClassical`, `repair.dereverbClassical`). It is `false` for `repair.declick`, `repair.declip` and `repair.trimSilence`, which have no configuration whose output at a sample depends only on earlier input, and for the offline-only processors that are not inserts (`final.*`, `match.*`, `maximizer.loudnessOptimize`). Entries also carry a `category`: `dynamics`, `effects`, `eq`, `final`, `reference` (the `match.*` processors), `maximizer`, `multiband`, `repair`, `saturation`, `spectral`, `stereo`, `utility` or `voice`.

Entries with a non-null `id` are automation targets; construction-only entries have `id: null` and `rtSafe: false`. An `rtSafe: false` entry must not be scheduled for live automation even when it has an id. `choices` describes a closed named numeric set, including discrete numeric values with gaps. `slot` identifies the slot group a key belongs to; `null` means that it belongs to no slot. A non-null slot is not necessarily conditional: each processor's `slots` array supplies the group's `activation` (`anyKey` or `always`), its `parent` slot when nested, and any `minCrossoverCutoffs` requirement that determines when the group is present.

Defaults are read from the code, not written down, and can be `null` when a construction key has no fallback. `uiMin` / `uiMax`, `dependsOn` and `coupledWith` describe how to draw and order a control; the accepted range stays `min` / `max`. Bounds are measured: candidate values go through the same construction path a caller uses, with the processor's other parameters at their defaults, and the catalog reports the interval validation accepted. A `null` bound means the processor takes any value on that side, or that construction never validates the key — not that a limit exists and went unmeasured. Two properties of a measured bound matter before you wire a slider to it: a control that constrains another reports the other's default, and an exclusive bound is reported as the value it excludes. [JavaScript API](./js-api.md#capabilitycatalog) walks through the concrete cases, and [Insert Effects](./effects-inserts.md#the-parameter-descriptor) documents each field.

A top-level `chain` section describes the flat keys of a mastering chain config. `stages` lists each stage's key prefix, the processor whose parameters its keys are (or `null`) and its `enabled` key; `lists` names the indexed lists (the multiband stage's `cutoffsHz` and `bands`) with their item counts; `params` holds descriptors, measured through the chain's own validator, for the keys no processor carries (the `enabled` switches, `loudness.*`, `repair.denoise.gainFloor`, the crossover FIR kernel size and cutoff list); and `aliases` gives every alternative spelling of a key. Node, WASM and Python declare it as `CapabilityCatalogChain`. `presets` also carries `playbackRoom`, always present and empty when playback is compiled out.

The `presets.mastering` array remains the compact list of mastering preset names. The top-level `masteringPresets` array adds one object per name with `kind`, `targetLufs`, `truePeakCeilingDb`, and `maxLimiterGainReductionDb`; restoration entries set those three numeric fields to `null`. Use `masteringPresetParams` on the binding when you need the flat numeric/boolean parameter map for a selected preset.

Two things the descriptor is good for:

- **A control surface without a hand-maintained table.** Lay out each parameter from its `type`, `default`, `min`, `max`, `uiMin`, `uiMax`, `scale`, and `unit`, and a new processor or a renumbered band shows up in the UI when the build changes, not when someone edits a spreadsheet.
- **Checking a value before it crosses the boundary.** A number outside a published bound is rejected at construction. Testing it against the catalog first turns that runtime error into a validation message at the point the user typed the value.

```typescript
const catalog = capabilityCatalog();
const limiter = catalog.processors.find((p) => p.id === 'dynamics.brickwallLimiter');
const release = limiter?.params.find((p) => p.name === 'releaseMs');

function accepts(value: number): boolean {
  if (!release) return false;
  return (release.min === null || value >= release.min)
      && (release.max === null || value <= release.max); // max is null: no upper bound is published
}
```

The catalog describes the surface from the outside: which processors exist and what each accepts. Why a processor has the same id in every runtime is the layering described in [Architecture](./architecture.md).
