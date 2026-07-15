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
| Constant-Q chroma (`chromaCqt` / `chroma_cqt`) | Yes — WASM, Node, Python, C ABI | No |
| Streaming analyzer and processors (`StreamAnalyzer`, `StreamingEqualizer`, `StreamingMasteringChain`) | Yes | No |
| Mel/MFCC inverse reconstruction | Yes | No |
| Realtime engine | Yes | No |
| Engine lane mixer (lanes, buses, sends, channel strips) and MIDI clip schedule | Yes — see [Realtime Engine](./realtime-engine.md#track-lanes-buses-and-channel-strips) | No |
| Realtime scope and wide meter telemetry | Yes — see [Realtime Engine](./realtime-engine.md#surround-group-buses-and-wide-meters) | No |
| Mastering presets/chains/processors | Yes | Partial |
| Mastering assistant/profile/preview JSON | Yes | No dedicated command |
| Mixing engine and scenes | Yes | `mix` (C++ CLI also exports scene presets) |
| Surround and multichannel mixing | Realtime engine lanes are panned into 5.1/7.1 group buses from the strip's `surroundPan` position and expose wide-meter telemetry. The standalone offline `Mixer` remains stereo; `sourceChannelLayout` is stored but does not yet preserve a multichannel lane source. See [Surround and multichannel](./mixing.md#surround-and-multichannel). | No |
| Project and arrangement editing (headless DAW) | Yes — see [Project Editing](./project-editing.md) | Yes |
| Built-in instruments (NativeSynth presets/patches) | Yes — see [Built-in Instruments](./native-synth.md) | Partial — `project bounce --synth` exposes the simple built-in synth waveform path, not the NativeSynth preset/patch catalog |
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
| `detectChords` / `detect_chords` | options object | positional / keyword params | positional / keyword params |
| Streaming reads | `process`, `readFrames`, `stats` | float Structure-of-Arrays read is `readFramesSoa` | `process`, `read_frames`, `stats` |
| Quantized stream reads | `readFramesI16` / `readFramesU8`, `StreamConfig.outputFormat` | same as WASM | `read_frames_i16` / `read_frames_u8`, `output_format` |
| `Mixer` strip references | numeric index; `stripById(id)` for lookup | numeric index or strip-id string | numeric index or strip-id string |
| Stereo mix (`mixStereo` / `mix_stereo`) | separate `leftChannels` / `rightChannels` arrays plus a `MixOptions` object | same as WASM | `[(left, right), …]` strips plus keyword arrays (`fader_db`, `pan`, `width`, `input_trim_db`) |
| `timeStretch` / `pitchShift` | `(samples, sampleRate, rate/semitones)` | same as WASM | `(samples, sample_rate, rate/semitones)` |
| Metering taps (`meterTap` / `stripMeter`) | `meterTap(strip, tap)` for an explicit pre/post-fader tap; `stripMeter(strip)` is the post-fader convenience | same as WASM | `meter_tap(strip, tap)` / `strip_meter(strip)` |

### Config, return, and data shapes

| Topic | What differs |
|-------|--------------|
| Mastering chain config | `masteringChain(...)` and `StreamingMasteringChain` use nested config objects; `masterAudio(...)` overrides use flat dot-notation keys |
| `StreamingMasteringChain` scope | Block-safe stages only — it rejects repair stages that need lookaround/file context and the whole-file `loudness` stage; use one-shot mastering APIs for those |
| `analyze(...)` return | Every binding — C ABI, Python, Node native, and WASM — returns the complete `analyze` result: chords, sections, timbre, dynamics, rhythm, melody, form, and per-beat strength. The dedicated functions (`detect_chords`, `analyze_sections`, …) stay useful when you need extra parameters or just one family without running the full pipeline |
| `normalize(...)` defaults | Module-level `normalize(...)` (Python, WASM, Node native) defaults to `0.0` dBFS — that is, normalize the peak to full scale, not a gain of zero; the Python `Audio.normalize()` convenience method still defaults to `target_db=-3.0` |
| `bounceOffline(...)` LUFS | Same LUFS-normalization default in C API and WASM; pass `normalizeLufs` / `normalize_lufs` explicitly when porting older code if the behavior matters |
| `mfcc` lifter | `mfcc(...)` / `mfcc` takes a trailing `lifter` / `lifter` argument (cepstral liftering, default `0` = no liftering) on every binding; the C-ABI explicit-range entry point is `sonare_mfcc_ex` |
| `trim` vs `trimSilence` | `trim(...)` uses a simple `thresholdDb` and returns audio only; `trimSilence(...)` / `trim_silence(...)` follow `librosa.effects.trim` with `topDb`, frame RMS, and original sample ranges |
| Automation curves | The mixing and engine APIs use separately named curve types. Mixing's `AutomationCurve` accepts `'linear'`, `'exponential'`, `'hold'`, `'s-curve'`. The engine/project API uses a distinct type — `EngineAutomationPointCurve` (Node) / `ProjectAutomationCurve` (WASM, which also accepts the ordinals `0`–`3`) — and spells the s-curve value `'scurve'` (no hyphen) rather than mixing's `'s-curve'`. Don't assume one shared name or spelling across the two surfaces |
| Scene JSON | Interchange format for persistent mixers; prefer `Mixer.toSceneJson()` (WASM/Node) or `Mixer.to_scene_json()` (Python) over hand-written JSON when preserving runtime edits |
| Clip loop crossfade | `setClipLoop` / `set_clip_loop` accepts `loopCrossfadePpq` / `loop_crossfade_ppq` on every binding. It is an equal-power seam crossfade, clamped by pre-roll and half the loop, ignored under warp, and serialized only when non-zero |
| Project bounce variants | The headless-DAW `Project` bounces to audio across bindings; instrument-bound bounce (`bounceWithBuiltinInstrument` / `bounceWithSynthInstrument` / `bounceWithSf2Instrument`) and the take/comp arrangement model are shared — see [Project Bounce](./project-bounce.md) and [Recording and Takes](./recording-and-takes.md). The `ExternalInstrument` bounce protocol is Python-only |
| Mastering chain JSON | Chain JSON and named-processor parameter maps round-trip the same field set: `repair.declip` `lpcBlend`, multiband per-band parameters, compressor detector / sidechain-HPF / PDR settings, and realtime voice-changer ISP limiter settings |
| Mastering limiter options | `releaseMs` / `release_ms` and `applyGainAtInputRate` / `apply_gain_at_input_rate` are available on the mastering helper APIs. A zero release keeps the 50 ms library default on the simple one-shot helper; preset/chain override values are applied directly |
| Acoustic analysis | Measurement and blind-estimation entry points return `AcousticResult`; geometric room acoustics adds equivalent-room estimates, RIR synthesis, and creative room morphing (display blind estimates and equivalent-room estimates with confidence) |
| Engine lane mixer / MIDI clips | The compiled shapes are identical everywhere (`EngineTrackLane` / `EngineTrackSend` / `EngineBus`; MIDI events carry absolute-sample `renderFrame` UMP words). Python exposes `EngineMidiClipSchedule` / `EngineMidiEvent` dataclasses where JS/Node take plain objects. The raw engine's `setSoloMute` addresses a fixed lane index; the browser `SonareEngine` worklet API instead accepts a track id *or name*; both APIs accept strip EQ bands as `EqBand` objects or band JSON strings (`setTrackStripEqBand` / `setMasterStripEqBand`, with `…EqBandJson` variants for raw JSON) |
| Errors | Every binding raises a structured `SonareError` with the same C-ABI numeric code: WASM and Node throw an `Error` subclass with `code` + `codeName` (exported `ErrorCode` enum and `isSonareError` guard); Python raises a `RuntimeError` subclass with `.code`; the Python CLI maps the codes to exit codes (the C++ CLI keeps plain `0`/`1`) |
| WASM object returns | WASM arrays/objects returned by name-list helpers (`*Names()`), preset-name helpers, `synthPresetPatch`, section, and key-candidate helpers are re-rooted into the caller's JavaScript realm, so they survive `structuredClone()` / `postMessage()` like ordinary objects |
| CLI availability | Some commands depend on whether you installed the PyPI Python CLI or built the C++ CLI from source — see [CLI](./cli.md) |

::: info Rich analysis fields
On C ABI, Python, Node native, and WASM, the `analyze(...)` result carries chords, sections, timbre, dynamics, rhythm, melody, form, and per-beat strength. When you only need one family — or you want to tune parameters the all-in-one call doesn't expose — the focused helpers stay available across runtimes: `detectChords` / `detect_chords`, `analyzeSections` / `analyze_sections`, `analyzeTimbre` / `analyze_timbre`, `analyzeDynamics` / `analyze_dynamics`, and `analyzeRhythm` / `analyze_rhythm`.
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
- `src/sonare_c.h`
- `src/sonare_c_acoustic.h`
- `src/sonare.h`
- `tools/sonare_cli.cpp`

The libsonare repository also includes `tools/parity`, which checks default values, constants/enums, and parameter names across C++, C ABI, Python, Node, and WASM.
