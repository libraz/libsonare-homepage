# Binding Parity

libsonare uses one C++ core and exposes it through C, Python, Node native, WASM, and CLI APIs. The feature set is intentionally close across runtimes, but naming and configuration shape differ by language.

Read this page after [Feature Map](./api-surface.md) when you already know the feature family and need to choose a runtime or port code between bindings.

::: info Parity does not mean identical syntax
This page compares whether the same capability exists across runtimes. It does not mean every function has the same name, argument order, return shape, or default value. When porting code, check both the feature row and the shape differences before assuming a direct copy will work.
:::

## What You Will Learn

By the end of this page you should be able to:

- translate naming conventions between JavaScript, Python, C++, C ABI, Node native, and CLI;
- identify which features are present in each binding and which are not available from the CLI;
- account for shape differences such as nested vs flat configs, row-major matrices, scene JSON, and streaming frame buffers;
- map one failure to the error class, code, and CLI exit status each runtime gives it;
- choose the authoritative source file to inspect when the docs and runtime need to be checked.

## Naming Conventions

| Concept | WASM / Node JS | Python | C / C++ |
|---------|----------------|--------|---------|
| Function style | camelCase, e.g. `detectBpm`, `masterAudioStereo` | snake_case, e.g. `detect_bpm`, `master_audio_stereo` | C ABI uses `sonare_*`; C++ uses namespaces/classes |
| Mastering chain config | WASM `masteringChain(...)` takes nested objects, and accepts dot-notation leaf keys in the same object | Flat dot-notation overrides and dict configs | C++ structs; C ABI structs/JSON helpers |
| Preset overrides | Flat dot notation for `masterAudio(...)` | Flat dot notation | Flat params or C++ config mutation |
| Mixer scenes | JSON strings and `Mixer` | JSON strings and `Mixer` | `mixing::api::Scene` plus JSON helpers |

## Feature Availability

One C++ core implements the DSP and every runtime calls it, so the same input gives the same result through Python and through WASM. What differs is the API surface around the core, which is written by hand for each binding.

The libsonare repository measures that surface instead of asserting it. `tools/parity/surface-coverage.md` is a generated matrix with one row per feature domain (the public C header a function is declared in) and one column per runtime: Python, Node, WASM, and the Python `sonare` CLI and native `sonare-cli` as separate columns, because their command sets differ. Each cell counts the domain's C ABI entry points the runtime reaches. The numbers are not copied here. `make surface-coverage` regenerates the file, and `make surface-coverage-check` fails CI when the tracked copy drifts from the headers.

Read a cell as reach, not quality. Both CLIs are curated subsets by design, and WASM exposes neither the host filesystem nor anything that needs threads. An entry point counts as reached when the checker finds it under the runtime's own naming (a class method, a handle-prefixed rename or a verified alias). A reviewed gap on the allowlist still counts as a gap. For one specific call, the per-domain row narrows the search and the [verification sources](#verification-sources) settle it.

The tables below are the reader-facing companion. **Yes** means WASM, Node, Python and the C ABI, unless the cell names fewer. The CLI column names the command, or says No or Partial. Naming differences follow the [naming conventions](#naming-conventions).

### Analysis, features and metering

| Feature family | Library bindings | CLI |
|----------------|------------------|-----|
| Batch analysis | Yes | Yes |
| Low-level features and librosa helpers | Yes | Common commands |
| Constant-Q chroma (`chromaCqt` / `chroma_cqt`) | Yes | No |
| Chord functions (`chordFunctions` / `chord_functions`; `chordFunctionalAnalysis` returns the same entries) | Yes (`sonare_chord_functions`) | No |
| Chord and key annotation conversion (`chordSymbolFromAnalysis` / `keyModeFromAnalysis`) | Yes (`sonare_chord_symbol_from_analysis`, `sonare_key_mode_from_analysis`) | No |
| Measured tuning (`tuning: 'auto'`, `referenceHz: 'auto'`, `tuningToReferenceHz` / `referenceHzToTuning`) | Yes | No |
| Transcription (`transcribe`, `transcribeToClip`), including the polyphonic tracker limits, `minNoteDivision` and `referenceHz: 'auto'` | Yes. The polyphonic limits (`maxPolyphony`, `minFramePeakRatio`, `minRidgePeakRatio`, `reattackRatio`) apply to the polyphonic path only; see [Audio to MIDI](./audio-to-notes.md#options-and-limits) | `transcribe` on both CLIs, with `--max-polyphony` and `--min-note-division` |
| NMF stem separation (`decomposeStems` / `decomposeStemsLinked`) | Yes | `decompose-stems`, mono input only |
| Mel/MFCC inverse reconstruction | Yes | Native CLI only: `mel-to-audio`, `mfcc-to-audio` |
| Streaming analyzer and processors (`StreamAnalyzer`, `StreamingEqualizer`, `StreamingMasteringChain`) | Yes | No |
| Metering (meters, clipping, dynamic range, stereo image, spectrum) | Yes | Native CLI only: `meter`, `clipping`, `dynamic-range` |
| Stereo crest factor (`meteringCrestFactorDbStereo`) | Yes (`sonare_metering_crest_factor_db_stereo`) | No |
| Scale quantization and scale masks (`scaleMaskForMode`) | Yes | `scale-quantize` on both CLIs; it and `pitch-correct-timevarying` take a mode name or a 12-bit mask. No scale-mask command |

### Editing, repair and mastering

| Feature family | Library bindings | CLI |
|----------------|------------------|-----|
| Editing DSP | Yes | Yes |
| Region-based spectral editing (`spectralEdit`) | Yes, see [Spectral Editing](./spectral-editing.md) | No |
| Automatic pitch correction to a detected or named key (`autoTune` / `auto_tune`) | Yes (`sonare_auto_tune`) | No |
| Offline vocal editing (`VocalEditSession`, and the vocal edits stored in a project) | `VocalEditSession` on WASM, Node and Python. The project-level vocal calls are Partial (5 of 10 entry points). See [Offline Monophonic Vocal Editing](./vocal-editing.md) | `vocal-notes` on both CLIs lists a session's notes; no editing or rendering |
| Repair in one call (`masteringRepairAnalyze` / `masteringRepairApply`) | Yes. Any channel count, fixed stage order, progress and cancel; see [Audio Repair Workflow](./audio-repair.md) | No (the native `repair` command is a separate path) |
| Mastering presets, chains and processors | Yes | Partial |
| Mastering assistant, profile and preview JSON | Yes | `mastering-suggest`, `mastering-profile`, `mastering-streaming` on both CLIs (mono or downmix) |
| Stereo assistant, profile and preview JSON (`masteringAudioProfileStereo`, `masteringAssistantSuggestStereo`, `masteringStreamingPreviewStereo`) | Yes. They measure the left/right pair; a downmix under-reports integrated loudness by about 6 dB on decorrelated material, see [Stereo sources](./mastering-assistant.md#stereo-sources) | No dedicated command |
| Streaming loudness gain (`streamingLoudnessGain` / `streamingLoudnessGainStereo`) | Yes (`sonare_streaming_loudness_gain[_stereo]`) | No |
| Reference at its own sample rate (`referenceSampleRate` on pair processors, pair analyses, A/B loudness match and EQ match) | Yes (`reference_sample_rate` argument; `sonare_eq_match_ex`) | `mastering-pair-analyze` and `mastering-pair-processor` read a reference file at any rate |
| Cooperative cancellation of long offline calls | Yes: `cancel?: () => boolean` on Node and WASM, `cancel=` on Python, `SonareCancelCallback` on the C ABI. A canceled call reports error code 8 and allocates no output | No |

### Mixing and realtime engine

| Feature family | Library bindings | CLI |
|----------------|------------------|-----|
| Mixing engine and scenes | Yes | `mix-strip` on both CLIs; the Python CLI also has the scene `mix`; see [CLI](./cli.md) |
| Mixing assistant (`suggestMixScene` / `suggest_mix_scene`) | Yes (`sonare_mixing_assistant_suggest`). A build without `BUILD_MIXING_ASSISTANT` (default ON; forced ON in the full Node addon, forced off by `SONARE_WASM_ANALYSIS_ONLY`) keeps the entry points and answers `NotSupported`, so probe the capability catalog instead of the symbol. See [Mixing Assistant](./mixing-assistant.md) | `suggest-mix` |
| Surround and multichannel mixing | Project graph, project bounce and the realtime engine support 5.1/7.1 output; engine lanes pan into 5.1/7.1 group buses from the strip's `surroundPan`. The standalone `Mixer.processStereo` is stereo-only, and an engine track lane takes a stereo source only (see [Channel Formats](./channel-formats.md#channel-handling-by-module)). See [Surround and multichannel](./mixing.md#surround-and-multichannel) | `project bounce` writes 1/2/6/8 channels |
| Realtime engine | Yes | No |
| Engine lane mixer (lanes, buses, sends, channel strips) and MIDI clip schedule | Yes, see [Realtime Engine](./realtime-engine.md#track-lanes-buses-and-channel-strips) | No |
| Scope and wide-meter telemetry | Yes, see [Realtime Engine](./realtime-engine.md#surround-group-buses-and-wide-meters) | No |
| Per-track PFL/AFL cue monitoring (pre-fader listen / after-fader listen) | Yes, see [Realtime Engine](./realtime-engine.md#track-monitor-taps-off-pfl-and-afl); reachable from the WASM AudioWorklet | No |
| Per-lane `setTrackSends` / `setTrackOutputBus` and offline `Mixer.setOutputBus` | Yes (`sonare_engine_set_track_sends`, `sonare_engine_set_track_output_bus`, `sonare_mixer_set_output_bus`) | No |
| Live MIDI input, and external MIDI output with clock and transport forwarding | Yes, see [MIDI Input](./midi-input.md). Browser worklets deliver lowered MIDI 1.0 messages through `onMidiOut` | No |
| Live program change (`pushMidiProgram`, `pushMidiInputProgram`) | Yes (`sonare_engine_push_midi_program`). The SoundFont player, a NativeSynth bound with GM programs and a drum-kit NativeSynth (as the GS drum-set select) follow it; the built-in synth and other NativeSynth patches ignore it | No |

### Projects, instruments and MIDI

| Feature family | Library bindings | CLI |
|----------------|------------------|-----|
| Project and arrangement editing (headless DAW) | Yes, see [Project Editing](./project-editing.md) | Yes |
| Typed automation targets (track fader and pan) | Yes, see [Project Editing](./project-editing.md#automation-lanes) | No |
| Audio-source owning metadata (`contentHash` / `externalStemRole`) | Yes, see [Project Editing](./project-save-load.md#reading-the-model-back-and-rebinding-audio-after-a-load) | No |
| Built-in instruments (NativeSynth presets and patches) | Yes, see [Built-in Instruments](./native-synth.md) | `project bounce --synth <preset>` pins a preset (`project synth-presets` lists them); a bare `--synth` follows GM programs |
| GM program following in a synth bounce | C ABI `use_gm_programs`, Python `auto_select_gm=`, WASM and Node `useGmPrograms`; an explicit patch remains the fallback | Bare `--synth` flag |
| Synth parameter descriptors (`synthEngineParamInfo` / `synthPatchParamInfo`) and patch `engineParams` | Yes (`sonare_synth_engine_param_info`, `sonare_synth_patch_param_info`, `SonareSynthPatch.engine_params`) | No |
| Sample bank (`SampleBank`, the `sample` engine's audio source) | Yes, see [Built-in Instruments](./native-synth.md) | Partial |
| Part rig (`setPartRig` / `getPartRig` / `clearPartRig`) | Yes, see [GM and GS](./gm-gs.md#part-rigs-and-efx-serial-routing) | No |
| Composition assist | C ABI and C++ only, by design | No |
| SoundFont 2 player | Yes, see [SoundFont 2 Player](./soundfont-player.md) | No (Project API only) |
| External-instrument bounce protocol (`ExternalInstrument`) | `bounceWithInstruments` / `bounceWithInstrument` on Node and WASM, `bounce_with_instruments` on Python, `sonare_project_bounce_with_instruments` on the C ABI; see [Project Bounce](./project-bounce.md) | No |
| Playback renderer (`PlaybackRenderer`, `renderPlayback` / `render_playback`) | Yes; mono, stereo, 5.1, 7.1 or binaural output, see [Playback](./playback.md) | `playback` on both CLIs |

### Rooms, files and browser-only

| Feature family | Library bindings | CLI |
|----------------|------------------|-----|
| Room acoustics (including `roomGeometryFromEstimate`, which turns an `estimateRoom` result into `synthesizeRir` input) | Yes (`sonare_room_geometry_from_estimate`) | `acoustic [--ir]`, `estimate-room`, `synthesize-rir`, `room-morph` |
| Stereo room morph (`roomMorphStereo` / `room_morph_stereo`) | Yes (`sonare_room_morph_stereo`) | `room-morph` on both CLIs for a two-channel file |
| Capability catalog and build diagnostics | `capabilityCatalog()` / `capability_catalog()` and `capabilities()` on every surface; canonical JSON through the C ABI | `doctor` |
| File decoding | Native: WAV/MP3 (FFmpeg builds add more). WASM: most APIs take decoded samples, `Audio.fromMemory(...)` decodes WAV/MP3 bytes, and browser decoding can read supported formats | Same as the native build |
| Multichannel decode and fold (`decodeChannels` / `decode_channels`, `downmix`) | Yes (`sonare_decode_channels`, `sonare_downmix`); the fold rules are in [Channel Formats](./channel-formats.md) | No |
| Web MIDI bridge (`bindWebMidi`) and microphone helper (`bindMicrophoneInput`) | WASM / browser only | No |
| OPFS clip write and import (`writeOpfsClip`, `importOpfsClip`) | WASM / browser only | No |
| Stream analyzer as an audio-graph node (`SonareStreamAnalyzerNode`) | WASM / browser only, in `@libraz/libsonare/worklet` | No |

## Known Shape Differences

The same capability can take different argument shapes, config layouts, or return values across bindings. When porting, the most common bugs come not from the math but from how matrices are flattened, whether options are passed as an object or as keyword arguments, and whether a returned field is named differently.

### Function and argument shapes

These functions exist across the library bindings but take their arguments differently. Naming follows the [naming conventions](#naming-conventions) (camelCase vs `snake_case`).

| Function | WASM | Node native | Python |
|----------|------|-------------|--------|
| `detectChords` / `detect_chords` | options object | options object or legacy positional params | positional / keyword params |
| `decomposeStemsLinked` / `decompose_stems_linked` | request object with planar `channels` | request object with planar `channels` | planar channel sequence or 2-D array, positional/keyword options |
| Streaming reads | `process`, `readFrames`, `stats` | float Structure-of-Arrays read is `readFramesSoa` | `process`, `read_frames`, `stats` |
| Quantized stream reads | `readFramesI16` / `readFramesU8` (legacy `StreamConfig.outputFormat` must be `0`) | same as WASM | `read_frames_i16` / `read_frames_u8` (legacy `output_format` must be `0`) |
| `Mixer` strip references | numeric index; `stripById(id)` for lookup | numeric index or strip-id string | numeric index or strip-id string |
| Stereo mix (`mixStereo` / `mix_stereo`) | separate `leftChannels` / `rightChannels` arrays plus a `MixOptions` object | same as WASM | `[(left, right), …]` strips plus keyword arrays (`fader_db`, `pan`, `width`, `input_trim_db`) |
| `timeStretch` / `pitchShift` | `(samples, sampleRate, rate/semitones)` | same as WASM | `(samples, sample_rate, rate/semitones)` |
| Metering taps (`meterTap` / `stripMeter`) | `meterTap(strip, tap)` for an explicit pre/post-fader tap; `stripMeter(strip)` is the post-fader convenience | same as WASM | `meter_tap(strip, tap)` / `strip_meter(strip)` |
| Peak/RMS normalizers | two functions, each selecting the statistic through `mode: 'peak' \| 'rms'`: `normalize(...)` (request object or positional) and `normalizeStereo(request)` (request only). The request takes `validate?`, and a mismatched channel pair is rejected in JavaScript with a `RangeError` before the call reaches the core | the same two functions and the same `mode`, but the stereo request carries no `validate` and no JavaScript-side length check — a mismatched pair comes back from the core as a `SonareError` with `ErrorCode.InvalidParameter` | four functions and no `mode` argument: `normalize` / `normalize_rms` for mono and `normalize_stereo` / `normalize_rms_stereo` for a pair, each taking `validate=` as a keyword |

### Config, return, and data shapes

| Topic | What differs |
|-------|--------------|
| Mastering chain config | `masteringChain(...)` and `StreamingMasteringChain` take nested config objects; `masterAudio(...)` overrides use flat dot-notation keys. Both spellings are typed and supported in `MasteringChainConfig` — a dotted leaf key such as `'loudness.targetLufs'` may sit beside or replace its nested equivalent, which is the convenient shape for overrides assembled dynamically and the form the C ABI carries. Prefer the nested spelling in hand-written code: it is checked field by field, where a dotted key is only checked at run time |
| Stereo assistant/metering request types | The stereo entry points added alongside the mono ones are **request-object only — no positional overload** on any JS surface. Their request-type names differ: WASM shares one `MasteringStereoParamsRequest` between profile and suggest, while Node splits it into `MasteringAssistantSuggestStereoRequest` and `MasteringAudioProfileStereoRequest` (the latter extends the former and adds nothing). Python takes plain positional/keyword arguments (`left, right, sample_rate=…`), and the C ABI takes `const float* left, const float* right, size_t length` |
| `StreamingMasteringChain` scope | Block-safe stages only. It rejects repair stages that need lookaround/file context. A `loudness` stage is supported when the caller supplies a precomputed static gain as `loudnessStaticGainDb` (JS) / `loudness_static_gain_db` (Python), with an optional source true-peak field; otherwise the constructor rejects it |
| `analyze(...)` return | Every binding — C ABI, Python, Node native, and WASM — returns the complete `analyze` result: chords, sections, timbre, dynamics, rhythm, melody, form, and per-beat strength. The dedicated functions (`detect_chords`, `analyze_sections`, …) stay useful when you need extra parameters or just one family without running the full pipeline |
| Normalizer defaults and results | Peak normalization defaults to `0.0` dBFS and RMS normalization to `-20.0` dBFS on WASM, Node, and Python, including the mono `normalize` and stereo `normalizeStereo` calls on Node and WASM. C ABI calls require an explicit target. A stereo call measures one level across the pair and applies one shared gain, preserving its balance. The result reports one `appliedGainDb` / `applied_gain_db`; a silent pair is unchanged with gain `0`. Python's `NormalizeStereoResult` also carries the shared `length` |
| `bounceOffline(...)` LUFS | Same LUFS-normalization default in C API and WASM (LUFS = Loudness Units relative to Full Scale, the broadcast loudness unit — see [LUFS](./glossary/lufs.md)); pass `normalizeLufs` / `normalize_lufs` explicitly when porting older code if the behavior matters |
| `mfcc` lifter | `mfcc(...)` / `mfcc` takes a trailing `lifter` / `lifter` argument (cepstral liftering, default `0` = no liftering) on every binding; the C-ABI explicit-range entry point is `sonare_mfcc_ex` |
| `trim` vs `trimSilence` | `trim(...)` uses a simple `thresholdDb` and returns audio only; `trimSilence(...)` / `trim_silence(...)` follow `librosa.effects.trim` with `topDb`, frame RMS, and original sample ranges |
| Automation curves | The mixing and engine APIs use separately named curve types. Mixing's `AutomationCurve` accepts `'linear'`, `'exponential'`, `'hold'`, `'s-curve'`. The engine/project API uses a distinct type — `EngineAutomationPointCurve` (Node) / `ProjectAutomationCurve` (WASM, which also accepts the ordinals `0`–`3`) — and spells the s-curve value `'scurve'` (no hyphen) rather than mixing's `'s-curve'`. Don't assume one shared name or spelling across the two surfaces |
| Automation target kind | A separate axis from the curve shape above: `SonareAutomationTargetKind` / `ProjectAutomationTargetKind` (WASM) classifies what a project automation lane drives — the legacy opaque host-defined target, or a typed track fader (`TRACK_FADER_DB`) / pan (`TRACK_PAN`) target. Node exposes it as `targetKind`, Python as the `target_kind` keyword (or ordinals `0`/`1`/`2`). Adding a typed lane bumps the project JSON to schema version `2`; a project with only opaque lanes keeps schema version `1` and its existing bytes — see [Project Editing](./project-editing.md#automation-lanes) |
| Scene JSON | Interchange format for persistent mixers; prefer `Mixer.toSceneJson()` (WASM/Node) or `Mixer.to_scene_json()` (Python) over hand-written JSON when preserving runtime edits |
| Clip loop crossfade | `setClipLoop` / `set_clip_loop` accepts `loopCrossfadePpq` / `loop_crossfade_ppq` on every binding, where ppq means pulses per quarter note. It is an equal-power seam crossfade, clamped by pre-roll and half the loop, ignored under warp, and serialized only when non-zero |
| Project bounce variants | The headless-DAW `Project` bounces to audio across bindings; instrument-bound bounce (`bounceWithBuiltinInstrument` / `bounceWithSynthInstrument` / `bounceWithSf2Instrument`) and the take/comp arrangement model are shared — see [Project Bounce](./project-bounce.md) and [Recording and Takes](./recording-and-takes.md). The `ExternalInstrument` bounce protocol is shared by Node, WASM, and Python |
| Mastering chain JSON | Chain JSON and named-processor parameter maps round-trip the same field set: `repair.declip` `lpcBlend`, multiband per-band parameters, compressor detector / sidechain-HPF / PDR settings, and realtime voice-changer ISP (inter-sample peak) limiter settings. The document also carries its own schema version: version `1` is the flat, fixed 3-band low/mid/high multiband compressor shape; version `2` is selected once the multiband compressor needs a different cutoff count, crossover slope/mode, or band count, and serializes `dynamics.multibandComp` as a structured object with strict field validation — see [Mastering Processors](./mastering-processors.md#the-chain-config-json-schema) |
| Mastering limiter options | `releaseMs` / `release_ms` and `applyGainAtInputRate` / `apply_gain_at_input_rate` are available on the mastering helper APIs. A zero release keeps the 50 ms library default on the simple one-shot helper; preset/chain override values are applied directly |
| Acoustic analysis | Measurement and blind-estimation entry points return `AcousticResult`; geometric room acoustics adds equivalent-room estimates, RIR synthesis, and creative room morphing (display blind estimates and equivalent-room estimates with confidence) |
| Engine lane mixer / MIDI clips | The compiled shapes are identical everywhere (`EngineTrackLane` / `EngineTrackSend` / `EngineBus`; MIDI events carry absolute-sample `renderFrame` UMP — Universal MIDI Packet — words). Python exposes `EngineMidiClipSchedule` / `EngineMidiEvent` dataclasses where JS/Node take plain objects. The raw engine's `setSoloMute` addresses a fixed lane index; the browser `SonareEngine` worklet API instead accepts a track id *or name*; both APIs accept strip EQ bands as `EqBand` objects or band JSON strings (`setTrackStripEqBand` / `setMasterStripEqBand`, with `…EqBandJson` variants for raw JSON) |
| Structural-similarity naming | Python drops the `segment_` prefix the JavaScript bindings use: `cross_similarity` / `recurrence_matrix` / `recurrence_to_lag` / `lag_to_recurrence` / `path_enhance` / `subsegment` / `agglomerative` against `segmentCrossSimilarity` and friends |
| `Audio` sample access | WASM's `audio.data`, Node's `audio.getData()`, and Python's `audio.data` all return copies; writing into a returned array does not edit the instance, and each access allocates |
| Distribution | The published artifacts are the WebAssembly npm package, the Python wheel, and the native CLI archives. The Node native binding is marked private and is consumed as a local dependency, so it is always built from source |
| ABI version checks | Every binding checks the loaded library's interface versions itself; see [ABI Versions](#abi-versions) |
| Parameters you do not give | In the JavaScript and Python bindings a parameter you leave out is absent (`undefined`, `None`, an omitted field), never a `-1` placeholder |
| Room band arrays | `bandAbsorption` / `bandScattering` in JavaScript, `band_absorption` / `band_scattering` in Python, `absorption_bands` / `scattering_bands` in the C ABI and in CLI `--json` output |
| Edit positions | Every edit request and the punch-in window accept seconds beside samples (`startSec` / `endSec`, `onsetSec` / `offsetSec`, `timeOffsetSec`, `paddingSec`; snake_case in Python). Giving both spellings is refused |
| Errors | One numeric code per failure on every binding. The class that carries it, and whether the binding refuses an argument before the library sees it, differ by runtime — see the [error contract](#error-contract) |
| WASM object returns | WASM arrays/objects returned by name-list helpers (`*Names()`), preset-name helpers, `synthPresetPatch`, section, and key-candidate helpers, plus mixer meter snapshots (`meterTap`, `stripMeter`, `busMeter`) and goniometer samples (`readGoniometerLatest`), are re-rooted into the caller's JavaScript realm, so they survive `structuredClone()` / `postMessage()` like ordinary objects. Handles with native methods, such as `Mixer` and `StreamAnalyzer`, remain non-cloneable; send their plain data results instead |
| CLI availability | Some commands depend on whether you installed the PyPI Python CLI or built the C++ CLI from source — see [CLI](./cli.md) |

::: info Rich analysis fields
On C ABI, Python, Node native, and WASM, the `analyze(...)` result carries chords, sections, timbre, dynamics, rhythm, melody, form, and per-beat strength.

When you only need one family — or you want to tune parameters the all-in-one call doesn't expose — the focused helpers stay available across runtimes:

| Family | Helper |
|--------|--------|
| Chords | `detectChords` / `detect_chords` |
| Sections | `analyzeSections` / `analyze_sections` |
| Timbre | `analyzeTimbre` / `analyze_timbre` |
| Dynamics | `analyzeDynamics` / `analyze_dynamics` |
| Rhythm | `analyzeRhythm` / `analyze_rhythm` |
:::

## ABI Versions

Every binding can read the loaded library's interface versions. Four of them are packed into one aggregate value.

| Interface | Version | Read with |
|-----------|---------|-----------|
| Feature (flat analysis and feature structs, the general C function contracts) | 7 | packed into `abiVersion()` |
| Project | 2 | packed; `projectAbiVersion()` |
| Voice changer | 3 | packed; `voiceChangerAbiVersion()` |
| Acoustic | 5 | packed |
| Aggregate | `0x05030207` | `abiVersion()`; `EXPECTED_ABI_VERSION` on WASM; `sonare_abi_version()` against the compile-time `SONARE_ABI_VERSION` in C |
| Engine | 3 | `engineAbiVersion()`; not part of the packed value, so each `RealtimeEngine` constructor checks it separately |

Node, WASM and Python compare the packed value themselves and refuse a mismatch with `AbiMismatch` (10); the [error contract](#error-contract) says where each one raises it. Node and WASM export `EXPECTED_PROJECT_ABI_VERSION`. WASM also exports `EXPECTED_ENGINE_ABI_VERSION`, and its `engineCapabilities().abiCompatible` reports the engine comparison; the Node addon checks the engine ABI when a `RealtimeEngine` is constructed. A mismatched Python CLI exits 13. See also [ABI Versions](./native-bindings.md#abi-versions).

## Error Contract

Every binding reports a failure with the same numeric code, the C ABI's `SonareError` value, so a handler can branch on the cause instead of the message text. Two things differ by runtime: the class that carries the code, and whether an argument is refused by the binding before the library sees it. The table lists each kind of failure once. In a coded row, WASM and Node throw a `SonareError` whose `codeName` is the name shown, and Python raises a `SonareError` whose `.code` is the `ErrorCode` member shown.

| Failure | Code | WASM and Node | Python | C ABI | CLI exit |
|---------|------|---------------|--------|-------|----------|
| An argument of the wrong type, or a missing one | — | `TypeError` | `SonareValueError`, code 4 | — | 2 |
| An argument the binding refuses: empty or non-finite audio, a fractional number where an integer is read (a sample rate included), a name the binding resolves itself (`keyRoot: 'H'`), lengths that must match, a string with an embedded NUL | — | `RangeError` | `SonareValueError`, code 4 | `SONARE_ERROR_INVALID_PARAMETER` | 2 or 3 |
| A sample rate outside 8000–384000 Hz | 4 | `RangeError` | `INVALID_PARAMETER` | `SONARE_ERROR_INVALID_PARAMETER` | 3 |
| A value the library refuses, such as `nFft` 0, an unknown preset name, or a scene that names an unknown insert | 4 | `InvalidParameter` | `INVALID_PARAMETER` | `SONARE_ERROR_INVALID_PARAMETER` | 3 |
| A file that does not exist | 1 | `FileNotFound` (Node; WASM has no file paths) | `FILE_NOT_FOUND` | `SONARE_ERROR_FILE_NOT_FOUND` | 4 |
| A malformed project, scene or preset document | 2 | `InvalidFormat` | `INVALID_FORMAT`; a project document raises it as `SonareValueError` | `SONARE_ERROR_INVALID_FORMAT` | 5 |
| Audio that will not decode | 3 | `DecodeFailed` | `DECODE_FAILED` | `SONARE_ERROR_DECODE_FAILED` | 6, or 5 in a build without FFmpeg |
| An allocation failure | 5 | `OutOfMemory` | `OUT_OF_MEMORY` | `SONARE_ERROR_OUT_OF_MEMORY` | 7 |
| A feature this build does not carry | 6 | `NotSupported` | `NOT_SUPPORTED` | `SONARE_ERROR_NOT_SUPPORTED` | 8 |
| A released, closed or uninitialised object, or a WASM call before `init()` | 7 | `InvalidState` | `INVALID_STATE` | `SONARE_ERROR_INVALID_STATE` | 9 |
| A run canceled from its progress callback | 8 | `Cancelled` | `CANCELLED` | `SONARE_ERROR_CANCELLED` | 11 |
| An output file that cannot be written | 9 | `EncodeFailed` | `ENCODE_FAILED` | `SONARE_ERROR_ENCODE_FAILED` | 12 |
| Native code from a different build than the binding | 10 | `AbiMismatch`: Node when the addon loads, WASM in `init()` | `ABI_MISMATCH` on first library use | never returned | 13 (Python CLI only) |
| Anything else | 99 | `Unknown` | `UNKNOWN` | `SONARE_ERROR_UNKNOWN` | 10 |

Reading the columns:

- **WASM and Node.** `TypeError` and `RangeError` are the binding's own refusals and carry no code, so `isSonareError` does not match them; a handler that validates user input catches both shapes. [Error Handling](./js-api.md#error-handling) has the `ErrorCode` enum and a worked example.
- **Python.** `SonareValueError` subclasses both `SonareError` and `ValueError`, so either `except` catches it, and its `.code` makes a branch on the code treat it like the library rejection it stands in for. Python passes an out-of-range sample rate on to the library, which is why that row is a coded `SonareError` there and a `RangeError` in JavaScript. See [Python Exceptions](./python-api-types.md#exceptions).
- **C ABI.** A function returning `SonareError` reports through its return value. A validation early return records no message, so `sonare_error_message(code)` is the readable text; a function returning a handle reports `NULL` and leaves the code in `sonare_last_error_code()` and the detail in `sonare_last_error_message()`. See [C++ Error Handling](./cpp-api.md#error-handling).
- **CLI.** Both CLIs use this mapping. Exit 2 is the argument parser's, so an argument it rejects exits 2 while one a command handler rejects exits 3. Exit 13 exists only in the Python CLI, because the native CLI links its library statically. `SONARE_LEGACY_EXIT=1` folds every failure to `1`. See [Exit Codes](./cli.md#exit-codes).

The detail text differs by runtime even when the code agrees: a malformed scene reads `failed to build mixer from scene JSON: …` on WASM and Node and `[2] failed to build mixer from scene JSON: …` in Python, where the message carries the code as a prefix.

## Porting Checklist

When moving a JavaScript example to Python, or Python verification code to C++, work through these checks in order:

1. Rename functions using the conventions table — `detectBpm` becomes `detect_bpm`, `melSpectrogram` becomes `mel_spectrogram`, and so on.
2. Match the input shape. Most APIs take a decoded, mono sample array plus `sampleRate`.
3. Check option names and defaults — especially `nFft` / `n_fft`, `hopLength` / `hop_length`, and `nMels` / `n_mels`, which directly affect the result.
4. Confirm matrix orientation. Returned `[rows x nFrames]` row-major arrays must not be read as column-major in another language.
5. Don't expect bit-exact numbers. Allow for small differences from floating-point, windowing, and decoder behavior; verify the tolerance fits your use case.

::: tip Row-major vs column-major
A row-major buffer stores each row's elements contiguously (one whole row after another); a column-major buffer stores each column contiguously instead. libsonare returns `[rows x nFrames]` matrices row-major — the entire first row, then the entire second row — so index an element as `row * nFrames + frame`.
:::

## Verification Sources

When checking parity, use the source files as the authoritative API sources:

- `bindings/wasm/src/index.ts`
- `bindings/python/src/libsonare/analyzer.pyi`
- `bindings/node/src/index.ts`
- `include/sonare/sonare_c.h`
- `include/sonare/sonare_c_acoustic.h`
- `src/sonare.h`
- `tools/sonare_cli.cpp`

The libsonare repository also includes `tools/parity`, which checks default values, constants/enums, and parameter names across C++, C ABI, Python, Node, and WASM, and generates the runtime capability matrix at `tools/parity/surface-coverage.md`.
