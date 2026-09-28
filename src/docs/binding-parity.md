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
- choose the authoritative source file to inspect when the docs and runtime need to be checked.

## Naming Conventions

| Concept | WASM / Node JS | Python | C / C++ |
|---------|----------------|--------|---------|
| Function style | camelCase, e.g. `detectBpm`, `masterAudioStereo` | snake_case, e.g. `detect_bpm`, `master_audio_stereo` | C ABI uses `sonare_*`; C++ uses namespaces/classes |
| Mastering chain config | WASM `masteringChain(...)` takes nested objects, and accepts dot-notation leaf keys in the same object | Flat dot-notation overrides and dict configs | C++ structs; C ABI structs/JSON helpers |
| Preset overrides | Flat dot notation for `masterAudio(...)` | Flat dot notation | Flat params or C++ config mutation |
| Mixer scenes | JSON strings and `Mixer` | JSON strings and `Mixer` | `mixing::api::Scene` plus JSON helpers |

## Feature Availability

One DSP core, several hand-written runtimes. The core is a single implementation and every runtime calls into it, so a result computed through Python and the same result computed through WASM come from the same code. The API surface wrapped around that core is a different matter: it is written by hand per binding, and it is not identical.

The repository measures that surface rather than asserting it. `tools/parity/surface-coverage.md` is a generated matrix with one row per feature domain — a domain is the public C header a function is declared in, so a new header adds a row on its own — and one column per runtime: Python, Node, WASM, and the two command-line front-ends as separate columns, because the Python `sonare` CLI and the native `sonare-cli` are two binaries whose command sets differ. Each cell is how many of that domain's C ABI entry points the runtime reaches, and a final row totals every domain. The numbers are not repeated here on purpose: the matrix is regenerated from the parity checker's extractors by `make surface-coverage`, and `make surface-coverage-check` fails in CI when the tracked copy drifts from the headers, so the file is the only copy that cannot go stale.

Read a cell there as a statement about reach, not quality. Both CLIs are a curated subset by design, and WASM can expose neither the host filesystem nor anything that needs threads, so a shortfall in those columns is expected shape rather than a defect. An entry point counts as reached when the parity checker finds it under the runtime's own naming — a class method, a handle-prefixed rename, or a verified alias all count, and the lifecycle helpers that a facade answers with a constructor or RAII count by construction. An allowlisted divergence still counts as a gap: an allowlist entry records that an absence was reviewed, not that it was filled. When you need to know whether one specific call is reachable from one runtime, the per-domain row narrows the search and the [verification sources](#verification-sources) below settle it.

The table below is the reader-facing companion to that matrix: each feature family with its library-binding status and CLI coverage. Unless a row says otherwise, the feature is present in every library binding. Naming differences follow the [naming conventions](#naming-conventions) above.

| Feature family | Library bindings | CLI |
|----------------|------------------|-----|
| Batch analysis | Yes | Yes |
| Low-level features and librosa helpers | Yes | Common commands |
| NMF stem separation (`decomposeStems` / `decomposeStemsLinked`, `decompose_stems` / `decompose_stems_linked`) | Yes — WASM, Node, Python, C ABI | `decompose-stems` for mono input only |
| Constant-Q chroma (`chromaCqt` / `chroma_cqt`) | Yes — WASM, Node, Python, C ABI | No |
| Streaming analyzer and processors (`StreamAnalyzer`, `StreamingEqualizer`, `StreamingMasteringChain`) | Yes | No |
| Mel/MFCC inverse reconstruction | Yes | No |
| Realtime engine | Yes | No |
| Engine lane mixer (lanes, buses, sends, channel strips) and MIDI clip schedule | Yes — see [Realtime Engine](./realtime-engine.md#track-lanes-buses-and-channel-strips) | No |
| Realtime scope and wide meter telemetry | Yes — see [Realtime Engine](./realtime-engine.md#surround-group-buses-and-wide-meters) | No |
| Per-track PFL/AFL cue monitoring (pre-fader listen / after-fader listen) | Yes — see [Realtime Engine](./realtime-engine.md#track-monitor-taps-off-pfl-and-afl); reachable from the WASM AudioWorklet | No |
| Mastering presets/chains/processors | Yes | Partial |
| Mastering assistant/profile/preview JSON | Yes | No dedicated command |
| Stereo assistant/profile/preview JSON (`masteringAudioProfileStereo`, `masteringAssistantSuggestStereo`, `masteringStreamingPreviewStereo`) | Yes — WASM, Node, Python (`mastering_audio_profile_stereo`, …), C ABI (`sonare_mastering_audio_profile_stereo`, …). They measure the left/right pair instead of a downmix, which under-reports integrated loudness by about 6 dB on decorrelated material — see [Stereo sources](./mastering-assistant.md#stereo-sources) | No dedicated command |
| Stereo crest factor (`meteringCrestFactorDbStereo` / `metering_crest_factor_db_stereo`) | Yes — WASM, Node, Python, C ABI (`sonare_metering_crest_factor_db_stereo`) | No |
| Mixing engine and scenes | Yes | `mix` (C++ CLI also exports scene presets) |
| Mixing assistant (`suggestMixScene` / `suggest_mix_scene`) | Yes — WASM, Node, Python, C ABI (`sonare_mixing_assistant_suggest`). General CMake builds can toggle `BUILD_MIXING_ASSISTANT` (default ON); the full Node native addon forces it ON regardless of the cache, while `SONARE_WASM_ANALYSIS_ONLY` forces it off. The entry points stay exported in a build without it and answer `NotSupported` rather than disappearing, so probe the capability catalog instead of probing for the symbol — see [Mixing Assistant](./mixing-assistant.md) | Yes — `suggest-mix` |
| Surround and multichannel mixing | Project graph/bounce and the realtime engine support 5.1/7.1 output. Realtime engine lanes are panned into 5.1/7.1 group buses from the strip's `surroundPan` position and expose wide-meter telemetry. The standalone offline `Mixer.processStereo` remains stereo-only; its `sourceChannelLayout` is stored as metadata and does not preserve a multichannel lane source. See [Surround and multichannel](./mixing.md#surround-and-multichannel). | Yes — `project bounce` supports 1/2/6/8-channel output |
| Project and arrangement editing (headless DAW) | Yes — see [Project Editing](./project-editing.md) | Yes |
| Typed automation targets (track fader/pan) | Yes — see [Project Editing](./project-editing.md#automation-lanes) | No |
| Audio-source owning metadata (`contentHash` / `externalStemRole`) | Yes — see [Project Editing](./project-editing-midi.md#reading-the-model-back-and-rebinding-audio-after-a-load) | No |
| Built-in instruments (NativeSynth presets/patches) | Yes — see [Built-in Instruments](./native-synth.md) | Yes — `project bounce --synth <preset>` pins a NativeSynth preset (`project synth-presets` lists them), and a bare `--synth` follows GM programs |
| GM program following in a synth bounce | C ABI (`use_gm_programs`), Python (`auto_select_gm=`), and the WASM/Node synth-bounce bindings (`useGmPrograms`) can follow incoming GM bank/program changes; an explicit patch remains the fallback | Yes — the bare `--synth` flag |
| Capability catalog and build diagnostics | Yes — `capabilityCatalog()` / `capability_catalog()` and `capabilities()` on every surface, canonical JSON through the C ABI | Yes — `doctor` |
| Cooperative cancellation of long offline calls | Yes — `cancel?: () => boolean` on Node and WASM, `cancel=` on Python, `SonareCancelCallback` on the C ABI; a cancelled call reports error code 8 and allocates no output | No |
| SoundFont 2 player | Yes — see [SoundFont 2 Player](./soundfont-player.md) | No (Project API only) |
| Realtime engine live MIDI input | Yes — see [MIDI Input](./midi-input.md) | No |
| External MIDI output and clock/transport forwarding | Yes — WASM, Node, Python, C ABI; browser worklets deliver lowered MIDI 1.0 messages through `onMidiOut` | No |
| Web MIDI bridge (`bindWebMidi`) and microphone helper (`bindMicrophoneInput`) | WASM / browser only | No |
| External-instrument bounce protocol (`ExternalInstrument`) | Python only — see [Project Bounce](./project-bounce.md) | No |
| Editing DSP | Yes | Yes |
| Region-based spectral editing (`spectralEdit`) | Yes — see [Spectral Editing](./spectral-editing.md) | No |
| Metering (meters, clipping/dynamic-range, stereo image, spectrum) | Yes | C++ CLI only (`meter`, `clipping`, `dynamic-range`) |
| Scale quantization | Yes | No |
| Room acoustics | Yes | `sonare acoustic [--ir]`, `estimate-room`, `synthesize-rir`, `room-morph` |
| File decoding | Native: WAV/MP3 (FFmpeg builds add more); WASM: most APIs take decoded samples, while `Audio.fromMemory(...)` decodes WAV/MP3 bytes and browser decoding can read supported formats | Same as the native build |

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
| Normalizer defaults and results | Mono peak normalization defaults to `0.0` dBFS everywhere — module-level `normalize(...)` and the `Audio.normalize()` convenience methods on Python, WASM, and Node native. That means normalize the peak to full scale, not apply a gain of zero. RMS defaults to `-20.0` dBFS (Python's `normalize_rms` / `normalize_rms_stereo`, and the library default the CLI follows). The two JS surfaces diverge from their own mono call here: `normalizeStereo`'s `targetDb` defaults **by mode** — `0` for `'peak'` and `-20` for `'rms'` — where `normalize` defaults to `0` in both modes, because a `0` dBFS RMS target drives effectively every peak past full scale. All four stereo entry points measure one level across the pair and apply one shared gain to both channels, so the stereo balance is preserved; the result reports that single `appliedGainDb` / `applied_gain_db` rather than a pair, and a silent pair comes back untouched at `0`. Python's `NormalizeStereoResult` carries a fourth field the JS results do not: the shared `length` |
| `bounceOffline(...)` LUFS | Same LUFS-normalization default in C API and WASM (LUFS = Loudness Units relative to Full Scale, the broadcast loudness unit — see [LUFS](./glossary/lufs.md)); pass `normalizeLufs` / `normalize_lufs` explicitly when porting older code if the behavior matters |
| `mfcc` lifter | `mfcc(...)` / `mfcc` takes a trailing `lifter` / `lifter` argument (cepstral liftering, default `0` = no liftering) on every binding; the C-ABI explicit-range entry point is `sonare_mfcc_ex` |
| `trim` vs `trimSilence` | `trim(...)` uses a simple `thresholdDb` and returns audio only; `trimSilence(...)` / `trim_silence(...)` follow `librosa.effects.trim` with `topDb`, frame RMS, and original sample ranges |
| Automation curves | The mixing and engine APIs use separately named curve types. Mixing's `AutomationCurve` accepts `'linear'`, `'exponential'`, `'hold'`, `'s-curve'`. The engine/project API uses a distinct type — `EngineAutomationPointCurve` (Node) / `ProjectAutomationCurve` (WASM, which also accepts the ordinals `0`–`3`) — and spells the s-curve value `'scurve'` (no hyphen) rather than mixing's `'s-curve'`. Don't assume one shared name or spelling across the two surfaces |
| Automation target kind | A separate axis from the curve shape above: `SonareAutomationTargetKind` / `ProjectAutomationTargetKind` (WASM) classifies what a project automation lane drives — the legacy opaque host-defined target, or a typed track fader (`TRACK_FADER_DB`) / pan (`TRACK_PAN`) target. Node exposes it as `targetKind`, Python as the `target_kind` keyword (or ordinals `0`/`1`/`2`). Adding a typed lane bumps the project JSON to schema version `2`; a project with only opaque lanes keeps schema version `1` and its existing bytes — see [Project Editing](./project-editing.md#automation-lanes) |
| Scene JSON | Interchange format for persistent mixers; prefer `Mixer.toSceneJson()` (WASM/Node) or `Mixer.to_scene_json()` (Python) over hand-written JSON when preserving runtime edits |
| Clip loop crossfade | `setClipLoop` / `set_clip_loop` accepts `loopCrossfadePpq` / `loop_crossfade_ppq` on every binding, where ppq means pulses per quarter note. It is an equal-power seam crossfade, clamped by pre-roll and half the loop, ignored under warp, and serialized only when non-zero |
| Project bounce variants | The headless-DAW `Project` bounces to audio across bindings; instrument-bound bounce (`bounceWithBuiltinInstrument` / `bounceWithSynthInstrument` / `bounceWithSf2Instrument`) and the take/comp arrangement model are shared — see [Project Bounce](./project-bounce.md) and [Recording and Takes](./recording-and-takes.md). The `ExternalInstrument` bounce protocol is Python-only |
| Mastering chain JSON | Chain JSON and named-processor parameter maps round-trip the same field set: `repair.declip` `lpcBlend`, multiband per-band parameters, compressor detector / sidechain-HPF / PDR settings, and realtime voice-changer ISP (inter-sample peak) limiter settings. The document also carries its own schema version: version `1` is the flat, fixed 3-band low/mid/high multiband compressor shape; version `2` is selected once the multiband compressor needs a different cutoff count, crossover slope/mode, or band count, and serializes `dynamics.multibandComp` as a structured object with strict field validation — see [Mastering Processors](./mastering-processors.md#the-chain-config-json-schema) |
| Mastering limiter options | `releaseMs` / `release_ms` and `applyGainAtInputRate` / `apply_gain_at_input_rate` are available on the mastering helper APIs. A zero release keeps the 50 ms library default on the simple one-shot helper; preset/chain override values are applied directly |
| Acoustic analysis | Measurement and blind-estimation entry points return `AcousticResult`; geometric room acoustics adds equivalent-room estimates, RIR synthesis, and creative room morphing (display blind estimates and equivalent-room estimates with confidence) |
| Engine lane mixer / MIDI clips | The compiled shapes are identical everywhere (`EngineTrackLane` / `EngineTrackSend` / `EngineBus`; MIDI events carry absolute-sample `renderFrame` UMP — Universal MIDI Packet — words). Python exposes `EngineMidiClipSchedule` / `EngineMidiEvent` dataclasses where JS/Node take plain objects. The raw engine's `setSoloMute` addresses a fixed lane index; the browser `SonareEngine` worklet API instead accepts a track id *or name*; both APIs accept strip EQ bands as `EqBand` objects or band JSON strings (`setTrackStripEqBand` / `setMasterStripEqBand`, with `…EqBandJson` variants for raw JSON) |
| Structural-similarity naming | Python drops the `segment_` prefix the JavaScript bindings use: `cross_similarity` / `recurrence_matrix` / `recurrence_to_lag` / `lag_to_recurrence` / `path_enhance` / `subsegment` / `agglomerative` against `segmentCrossSimilarity` and friends |
| `Audio` sample access | WASM's `audio.data`, Node's `audio.getData()`, and Python's `audio.data` all return copies; writing into a returned array does not edit the instance, and each access allocates |
| Distribution | The published artifacts are the WebAssembly npm package, the Python wheel, and the native CLI archives. The Node native binding is marked private and is consumed as a local dependency, so it is always built from source |
| ABI version checks | Every binding can read the loaded library's interface versions — feature 5, project 2, voice changer 2, acoustic 4, and engine 3 — but only Python turns a mismatch into a failure on its own: it compares the packed `sonare_abi_version()` value at import and raises `RuntimeError`. Node and WASM export `EXPECTED_PROJECT_ABI_VERSION` / `EXPECTED_ENGINE_ABI_VERSION` beside `projectAbiVersion()` / `engineAbiVersion()` and leave the comparison to you (WASM's `engineCapabilities().abiCompatible` makes it for the engine); a C caller compares `sonare_abi_version()` with its compile-time `SONARE_ABI_VERSION`. See [ABI Versions](./native-bindings.md#abi-versions) |
| Error types | Every binding raises a structured `SonareError` carrying the same C-ABI numeric code: WASM and Node throw an `Error` subclass with `code` + `codeName`, both packages exporting the `ErrorCode` enum and the `isSonareError(value)` guard; Python raises a `RuntimeError` subclass with `.code`; both CLIs map failures to stable exit codes (`2` usage, `3` invalid parameter, `11` cancelled; see [CLI](./cli.md)). Two binding-specific additions: Python also has `SonareValueError`, which subclasses `SonareError` **and** `ValueError` so an argument-validation failure is caught by either `except` style, and carries `ErrorCode.INVALID_PARAMETER` even though it never reached the C ABI; and Node's `SonareError` is a runtime class whose `instanceof` is brand-based, so it narrows an error the addon raised without constructing the class, and one that lost its prototype crossing a worker boundary. `isSonareError` is the same duck-typed check and the two never disagree |
| How the same failure surfaces | The row above describes the type a binding raises on its own behalf; a failure raised below the binding layer can still reach you differently per runtime. Handing `Mixer.fromSceneJson` a scene that names an unknown insert is the clearest example: WASM raises `InvalidState` with the facade's wrapped message, Node raises an untyped `Napi::Error` (a plain `Error` with no `code`, so `isSonareError` returns false), Python raises a bare `RuntimeError` **with the inner reason dropped**, and the C ABI returns `nullptr` and leaves the detail in `sonare_last_error_message()`. Don't build control flow on the error type across bindings without checking the specific call |
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
