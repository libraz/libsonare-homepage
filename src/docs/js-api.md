---
title: JavaScript/TypeScript API Reference
description: The libsonare JavaScript/TypeScript package reference hub, covering installation, import, initialization, errors, and a map of the per-subject reference pages.
---

# JavaScript/TypeScript API Reference

The npm package `@libraz/libsonare` is the WebAssembly build of the engine: analysis, mastering, mixing, editing DSP, and a realtime engine, all running in the browser. This page covers install, `init()`, your first call, and the conventions every function shares (request objects, errors, default sample rates). Per-subject reference pages follow from the [list at the end](#reference-pages).

## Overview

Most functions take decoded PCM, not a file: a `Float32Array` of samples plus the `sampleRate` it was decoded at. To get from encoded bytes to samples, decode with the Web Audio API (`AudioContext.decodeAudioData`) or use the `Audio.fromMemory*` factories, which decode WAV/MP3 with the bundled WASM decoder and AAC/OGG/FLAC through the browser when needed. `decodeChannelsWithBrowserFallback(bytes, options?)` takes the same path but keeps every channel instead of folding to mono; see [Keeping Every Channel](./wasm.md#keeping-every-channel).

Start from the task, not from the function list:

| You need | Start with | Why |
|----------|------------|-----|
| One tempo, key, or beat value | `detectBpm`, `detectKey`, `detectBeats` | Direct answers without building the all-in-one analysis object |
| Metadata for a whole song | `analyze`, `analyzeWithProgress`, or a focused `analyze*` helper | `analyze` gives the common summary; the helpers expose more detail |
| Spectral features for ML or visualization | `melSpectrogram`, `chroma`, `mfcc` | Matrix outputs |
| A live visualizer or an updating BPM/key/chord UI | `StreamAnalyzer` | Processes small blocks; the UI reads the newest frames |
| Remixing, practice tools, region repair | `hpss`, `timeStretch`, `pitchShift`, `spectralEdit` | Audio effects |
| Vocal tuning, note edits, pitch or formant changes | `pitchCorrectToMidi`, `noteStretch`, `voiceChange`, `StreamingRetune`, `RealtimeVoiceChanger` | Editing DSP changes the signal rather than analyzing it |
| Loudness targets, true-peak limiting, delivery preview | `masterAudio*`, `masteringChain*`, `StreamingMasteringChain` | Presets first, named processors when you need control |
| Stem balance, sends, buses, or meters | `mixStereo` or `Mixer` | One-shot mix first; a persistent scene mixer when routing matters |
| Room decay, clarity, equivalent-room estimates, generated room character | `analyzeImpulseResponse`, `detectAcoustic`, `estimateRoom`, `synthesizeRir`, `roomMorph`, `roomMorphStereo` | These describe or apply the recording space, not the music |
| Loading files | `Audio.fromBuffer`, `Audio.fromMemory`, `Audio.fromMemoryWithBrowserFallback` | Decoding plus method-style access to common functions |

New to audio terms such as BPM, STFT, or chroma? See the [Glossary](/docs/glossary). For a cross-binding feature map, see [Feature Map](./api-surface.md); for the mastering processor registry and the mixing scene format, see [Mastering Processors](./mastering-processors.md) and [Mixing Scene JSON](./mixing-scene-json.md).

## Installation

::: code-group

```bash [npm]
npm install @libraz/libsonare
```

```bash [yarn]
yarn add @libraz/libsonare
```

```bash [pnpm]
pnpm add @libraz/libsonare
```

:::

## Import

The package has five entries. The main entry carries everything; the others are narrower bundles for specific realms.

| Entry | Import path | Contains | Use it when |
|-------|-------------|----------|-------------|
| Main | `@libraz/libsonare` | The full API: analysis, effects, mastering, mixing, projects, realtime engine | Almost always |
| Analysis | `@libraz/libsonare/analysis` | Analysis and features only: no mastering, mixing, realtime, or project APIs | You want the smallest download for analysis alone |
| Worklet | `@libraz/libsonare/worklet` | The AudioWorklet-side runtime, including `EXPECTED_ABI_VERSION`, `engineMixerMasterTarget`, `ENGINE_MIXER_PARAM_FADER_DB`, `ENGINE_MIXER_PARAM_PAN` and `SONARE_METER_RING_PROTOCOL_VERSION` | Code running inside an `AudioWorkletGlobalScope` |
| Worker | `@libraz/libsonare/worker` | The offline worker script behind `OfflineWorkerClient` | Running analysis off the main thread; see [Workers](./wasm-advanced.md#web-worker-usage) |
| Vocal-edit worker | `@libraz/libsonare/vocal-edit-worker` | The worker script behind `VocalEditWorkerClient` | Vocal-edit drafts and render jobs off the main thread |

See [Package Artifacts](./wasm.md#package-artifacts) for the files each entry ships. The bundles target ECMAScript 2020.

```typescript
import {
  init,
  Audio,
  detectBpm,
  detectKey,
  detectBeats,
  detectOnsets,
  analyze,
  analyzeWithProgress,
  version
} from '@libraz/libsonare';
```

## Initialization

### `init(options?)`

Initializes the WASM module. Call it once, before any other function that needs the module.

```typescript
async function init(options?: {
  locateFile?: (path: string, prefix: string) => string;
  wasmBinary?: ArrayBuffer | Uint8Array;
  moduleFactory?: (options?: {
    locateFile?: (path: string, prefix: string) => string;
    wasmBinary?: ArrayBuffer | Uint8Array;
  }) => Promise<SonareModule>;
}): Promise<void>
```

Options apply on the first call only. Calling `init()` again with no options, or with the same options (functions compared by reference), resolves immediately. A second call whose options differ throws `SonareError` with `InvalidState`, naming the option. Every function that needs the module throws `InvalidState` when called before `init()` resolves.

`init()` also compares the loaded module's ABI version with the one the package was built against and throws `AbiMismatch` (code 10) when the `.wasm` and the JavaScript come from different builds, which a stale cache or a custom `wasmBinary` / `locateFile` can produce. The expected version is exported as `EXPECTED_ABI_VERSION` from the package root and from `@libraz/libsonare/worklet`, so a test double passed as `moduleFactory` can report the version `init()` checks for.

### Your first call

```typescript
import { init, detectBpm } from '@libraz/libsonare';

await init();                                    // once, at app start

const bytes = await (await fetch('/song.mp3')).arrayBuffer();
const ctx = new AudioContext();
const decoded = await ctx.decodeAudioData(bytes);
const samples = decoded.getChannelData(0);       // Float32Array, first channel

const bpm = detectBpm({ samples, sampleRate: decoded.sampleRate });
console.log(`${bpm.toFixed(1)} BPM`);
```

Pass the `sampleRate` the samples were decoded at. To serve the `.wasm` from another path, pass `locateFile`:

```typescript
await init({
  locateFile: (path, prefix) => `/custom/wasm/path/${path}`
});
```

Once that works, move to `analyze`, mastering, mixing, or streaming.

### `isInitialized()`

Checks whether the module is initialized.

```typescript
function isInitialized(): boolean
```

### `version()`

Returns the library version.

```typescript
function version(): string  // e.g., "{{ wasmMeta.version }}"
```

## One-shot request objects

The top-level one-shot analysis, effects, mastering, metering, feature, mixer, and voice-changer APIs use a named **request object** as their canonical form. Every input is named, optional settings can grow without changing argument order, and TypeScript can guide you to the matching `*Request` type. Positional forms are compatibility overloads with identical defaults, validation, errors, results, and progress behavior. Every positional one-shot also takes a trailing `{ validate?: boolean }`: `{ validate: false }` skips the JavaScript-side scan for NaN and infinity on hot paths, and the native layer still rejects non-finite input.

```typescript
// Preferred request-object form
const bpm = detectBpm({ samples, sampleRate });
const mastered = masterAudio({
  samples,
  sampleRate,
  preset: 'pop',
  overrides: { loudness: { targetLufs: -14 } },
  onProgress: (progress, stage) => console.log(stage, progress),
});

// Positional form
const legacyBpm = detectBpm(samples, sampleRate);
```

A request object refuses a key its entry point does not declare: `detectBpm({ samples, sampleRate, bpmMin: 90 })` throws `TypeError: detectBpm: unknown request key 'bpmMin'`, and a key that belongs in a nested object says where (`'loudness' belongs under 'config'`). Nested options objects and the options bag of a positional form refuse unknown options the same way. Tempo range limits belong to `analyzeBpm` and `analyze`, not `detectBpm`.

The request fields use the same camelCase names on the Node and WASM packages. Python remains keyword-oriented (`detect_bpm(samples, sample_rate=...)`), rather than adopting a JavaScript-style options object.

### Canceling a long call

Requests that report progress also accept `cancel`, a predicate polled at the same native boundaries `onProgress` fires on. Return `true` and the call aborts.

```typescript
import { ErrorCode, isSonareError, masterAudio } from '@libraz/libsonare';

let abandoned = false;
cancelButton.onclick = () => { abandoned = true; };

try {
  const mastered = masterAudio({
    samples,
    sampleRate,
    preset: 'pop',
    onProgress: (progress, stage) => updateUi(progress, stage),
    cancel: () => abandoned,
  });
} catch (error) {
  if (!(isSonareError(error) && error.code === ErrorCode.Cancelled)) throw error;
}
```

A canceled call throws `SonareError` with code 8 (`Cancelled`) and leaves its outputs unallocated, so there is no partial result to inspect. Python takes the same predicate as `cancel=`.

### Default sample rates

When `sampleRate` is optional, the default depends on the function family. Pass the buffer's real rate whenever you know it.

| Family | Default |
|--------|---------|
| Analysis, features, loudness, pitch, and effects (`detectBpm`, `stft`, `melSpectrogram`, `hpss`, `timeStretch`, ...) | 22050 |
| `Audio.fromBuffer`, `voiceChangeRealtime`, `roomMorphStereo` | 48000 |
| `StreamAnalyzer` (`StreamConfig.sampleRate`) | 44100 |

## Error Handling

Failures arrive as one of three classes, depending on who refused the input:

| Class | Raised by | Matched by `isSonareError` |
|-------|-----------|----------------------------|
| `TypeError` | The JavaScript binding: a wrong type or a missing argument | No |
| `RangeError` | The JavaScript binding: a value outside its domain | No |
| `SonareError` | The library, or the state of an object | Yes |

`SonareError` is an `Error` subclass carrying a numeric `code` and its canonical `codeName`, mirroring the C ABI error enum. The same failure reports the same code on every binding (WASM, Node native, Python, C ABI), so branch on the code rather than the message. The package exports the `ErrorCode` enum, the `SonareError` class, and the `isSonareError(value)` type guard.

```typescript
import { ErrorCode, isSonareError, Mixer } from '@libraz/libsonare';

try {
  const mixer = Mixer.fromSceneJson(sceneJson, 48000, 512);
} catch (error) {
  if (error instanceof TypeError || error instanceof RangeError) {
    // The binding refused an argument; fix the call site.
    console.error(`bad argument: ${error.message}`);
  } else if (isSonareError(error) && error.code === ErrorCode.InvalidFormat) {
    console.error(`scene is not valid JSON: ${error.message}`);
  } else if (isSonareError(error) && error.code === ErrorCode.InvalidParameter) {
    // 'failed to build mixer from scene JSON: unknown insert processor: nope (strip a)'
    console.error(`scene field rejected: ${error.message}`);
  } else {
    throw error;
  }
}
```

### Which failure raises which error

| Failure | Raises |
|---------|--------|
| Calling a function before `init()` resolves | `SonareError` `InvalidState` (7) |
| A second `init()` with different options | `SonareError` `InvalidState` (7), naming the option |
| `.wasm` and JavaScript from different builds | `SonareError` `AbiMismatch` (10) |
| Any method on a released or destroyed handle | `SonareError` `InvalidState` (7) |
| A mixer scene that is not valid JSON (`Mixer.fromSceneJson`, `Project.fromJson`) | `SonareError` `InvalidFormat` (2) |
| A field the library rejects: an unknown preset or insert, a bad send timing | `SonareError` `InvalidParameter` (4) |
| A rejected stream or STFT configuration | `SonareError` with the code the core reports |
| A canceled call | `SonareError` `Cancelled` (8) |
| A `null` or wrongly typed argument, such as a `samples` that is not a `Float32Array` | `TypeError` |
| Empty or non-finite audio; a `sampleRate` that is not an integer in `[8000, 384000]`; a fractional integer argument; two buffers whose lengths must match; a binding-resolved name that is unknown (such as a `keyRoot`) | `RangeError` |
| A string with an embedded NUL passed to an entry point that checks for it (`mixingScenePresetJson`, `realtimeVoiceChangerPresetJson`, `validateRealtimeVoiceChangerPresetJson`, `realtimeVoiceChangerPresetConfig`, `noteToHz`, `Project.fromJson`) | `RangeError` naming the field |

`Mixer.fromSceneJson` reports `InvalidFormat` for a document that is not valid JSON and `InvalidParameter` for a field the mixer rejects; the field is named at the tail of the message, `failed to build mixer from scene JSON: <inner>`.

Every one-shot that takes samples and a sample rate checks them before the core is reached, so no raw embind `BindingError` reaches a caller. The argument checks the core makes on its own objects stay coded `SonareError`s. The facades reject non-finite numbers, invalid enum or index values, and oversized resources instead of clamping them; treat these as invalid input. The offline and vocal-edit worker clients rebuild `TypeError` and `RangeError` across the worker boundary.

### Error codes

| `ErrorCode` | Value |
|-------------|-------|
| `Ok` | `0` |
| `FileNotFound` | `1` |
| `InvalidFormat` | `2` |
| `DecodeFailed` | `3` |
| `InvalidParameter` | `4` |
| `OutOfMemory` | `5` |
| `NotSupported` | `6` |
| `InvalidState` | `7` |
| `Cancelled` | `8` |
| `EncodeFailed` | `9` |
| `AbiMismatch` | `10` |
| `Unknown` | `99` |

`AbiMismatch` is made by the bindings, never by the core: it reports a native module whose ABI version differs from the one the package expects (WASM in `init()`, Node when the addon is required, Python on first library use); [Installation](./installation.md#abimismatch-when-loading-the-library) lists the causes and fixes. The other codes match Python's `SonareError.code` and the C ABI `SonareError` enum, and the Python CLI maps them onto its [exit codes](./cli.md#exit-codes). For the same failures on Node, Python, the C ABI, and the CLI, see the [error contract](./binding-parity.md#error-contract).

## Build and Environment

### `capabilities()`

Describes the build that is actually loaded, the same report the CLIs print as `doctor`. Synchronous, and valid only after `init()`.

```typescript
function capabilities(): {
  version: string;
  abi: { project: number; engine: number };
  platform: string;
  features: {
    mastering: boolean;
    mixing: boolean;
    mixingAssistant: boolean;
    fx: boolean;
    ffmpeg: boolean;
    instrumentParamAutomation: boolean;
    arrangement: boolean;
    acousticSim: boolean;
    pitchEditor: boolean;
    vocalEdit: boolean;
    voiceChanger: boolean;
    playback: boolean;
  };
  decode: { builtin: string[]; ffmpeg: string[] };
  simd: string;
  hardwareConcurrency: number;
}
```

Branch on `features` instead of guessing. `decode.builtin` lists the formats the module can open before you ask the browser to fall back, and `simd` reads `"wasm-simd128"` for the shipped build.

| Flag | Guards |
|------|--------|
| `mastering` | `masterAudio*`, `masteringChain*`, `StreamingMasteringChain`, the named mastering processors |
| `mixing` | `Mixer`, `mixStereo`, and the mixing scene functions |
| `mixingAssistant` | `suggestMixScene` |
| `fx` | The effects subsystem |
| `ffmpeg` | FFmpeg decoding (`false` in the browser package) |
| `instrumentParamAutomation` | Instrument-parameter automation targets |
| `arrangement` | `Project`, clips, and the arrangement subsystem |
| `acousticSim` | `analyzeImpulseResponse`, `detectAcoustic`, `estimateRoom`, `synthesizeRir`, `roomMorph*` |
| `pitchEditor` | Note and pitch editing |
| `vocalEdit` | Vocal-edit drafts and render jobs |
| `voiceChanger` | `RealtimeVoiceChanger`, `voiceChange*` |
| `playback` | `PlaybackRenderer` (upmix, binaural, speaker output) |

`mixingAssistant` and `instrumentParamAutomation` are the two probes a host is most likely to need and least likely to reach for, because the entry points they guard stay registered whether or not the subsystem was built. `suggestMixScene` and the instrument-parameter automation targets exist as functions in every module and **throw** when the subsystem is absent, so `typeof fn === 'function'` is not a capability check. `instrumentParamAutomation` reports `false` in a build without the arrangement subsystem; `mixingAssistant` is compiled out of the analysis-only module, so that build reports `false` even though the symbol is there.

### `capabilityCatalog()`

Returns a machine-readable catalog of every processor, its parameter descriptors, and the built-in preset lists. It is the same canonical JSON the C ABI publishes and Python exposes as `capability_catalog`, validated against `schemas/capability-catalog.schema.json`.

```typescript
function capabilityCatalog(): {
  version: string;
  abi: { project: number; engine: number };
  processors: CapabilityCatalogProcessor[];   // id, kind, latency, tail, params, slots, ...
  chain: CapabilityCatalogChain;              // how every flat mastering chain key is described
  presets: {
    mastering: string[];
    synth: string[];
    mixingScene: string[];
    voiceChanger: string[];
    playbackRoom: string[];                   // always present; empty when playback is compiled out
  };
  masteringPresets: Array<{
    name: string;
    kind: 'mastering' | 'restoration';
    targetLufs: number | null;
    truePeakCeilingDb: number | null;
    maxLimiterGainReductionDb: number | null;
  }>;
}
```

This is what you build a generic parameter UI from: every slider's range, default, unit, and axis (`uiMin` / `uiMax`, `scale`) comes from the catalog instead of a table you maintain by hand. Each descriptor field is documented in [Insert Effects](./effects-inserts.md#the-parameter-descriptor). A `null` bound means the core knows of no limit on that side; treat it as "unbounded or unknown", not as zero.

::: warning A published bound is a hard constraint, not a recommended UI range
Bounds are measured with every other parameter of the processor at its default, so two parameters that constrain each other each report the other's default; a sample-rate-derived bound such as an EQ `band*.frequencyHz` ceiling reads as the un-prepared `24000`; and an exclusive bound is reported as the limit it excludes. [Reading a catalog bound](./mastering-processors.md#reading-a-catalog-bound) explains each case.
:::

### `abiVersion()`

Returns the aggregate native ABI version across the C POD surfaces (the value `EXPECTED_ABI_VERSION` holds). Persist or compare it when loading a prebuilt binary so an incompatible JS/native artifact pair fails early.

```typescript
function abiVersion(): number
```

### `projectAbiVersion()`

ABI version of the project/editing POD API used by `Project` serialization, bounce, and realtime-engine clip exchange.

```typescript
function projectAbiVersion(): number
```

### `voiceChangerAbiVersion()`

ABI version of the realtime voice-changer POD config used by native and FFI APIs. This is separate from preset JSON `schemaVersion`, currently `1`. Check user-authored presets with `validateRealtimeVoiceChangerPresetJson(...)` before accepting them.

```typescript
function voiceChangerAbiVersion(): number
```

### Voice Preset Accessors

Use these when you need the canonical voice-character preset ID or the resolved flat POD config without parsing preset JSON.

```typescript
function voiceCharacterPresetId(preset: VoicePresetId | number): VoicePresetId | null
function realtimeVoiceChangerPresetConfig(preset: VoicePresetId | number): RealtimeVoiceChangerPodConfig
```

`voiceCharacterPresetId(...)` returns `null` for an unknown numeric ordinal.
Unknown string IDs throw. `realtimeVoiceChangerPresetConfig(...)` throws for
an invalid ordinal or unknown ID because it must return a resolved POD config.

The resolved `RealtimeVoiceChangerPodConfig` uses camelCase keys on both JavaScript surfaces (`inputGainDb`, `wetMix`, `formantFactor`, `formantMode`, `limiterIspCeilingDbtp`, and so on). The equivalent C and Python POD fields remain snake_case. A POD config handed back to the engine must carry every field, `formantMode` (`'relative'` or `'absolute'`) included.

### Realtime environment helpers

These helpers describe the runtime capabilities used by [`RealtimeEngine`](./realtime-engine.md). Use them before wiring AudioWorklet/SharedArrayBuffer paths, especially when the page may run under different browser isolation policies.

```typescript
function engineAbiVersion(): number
function engineCapabilities(): {
  engineAbiVersion: number;
  expectedEngineAbiVersion: number;
  abiCompatible: boolean;
  sharedArrayBuffer: boolean;
  atomics: boolean;
  audioWorklet: boolean;
  mode: 'sab' | 'postMessage';
}
function hasFfmpegSupport(): boolean
```

`hasFfmpegSupport()` reports whether the loaded build can decode through FFmpeg. The browser/WASM npm package works on decoded PCM and normally returns `false`; Python/native builds are the intended place to decode files directly.

### Browser support and bundle size

The shipped module is built with WebAssembly SIMD, so SIMD support sets the browser minimums. [Browser Compatibility](./wasm.md#browser-compatibility) has the table and [Bundle Size](./wasm.md#bundle-size) has the file sizes.

## Releasing Native Handles

Every class that owns a native handle (`Mixer`, `StreamAnalyzer`, `Project`, `ProjectTimeline`, `RealtimeEngine`, `ClipPageProvider`, `ClipPageStreamer`, `StreamingEqualizer`, `StreamingMasteringChain`, `StreamingRetune`, `RealtimeVoiceChanger`, `PlaybackRenderer`, and the others) has an idempotent `destroy()` (with `delete()` as an alias) and implements `[Symbol.dispose]()`, so the `using` declaration releases it when the scope ends, even on an exception. `Audio` holds no native handle, so its `[Symbol.dispose]()` does nothing and `using` still works on it.

```typescript
import { init, Mixer, mixingScenePresetJson } from '@libraz/libsonare';

await init();
{
  using mixer = Mixer.fromSceneJson(mixingScenePresetJson('vocalReverbSend'), 48000, 512);
  // ... process blocks; the mixer is released at the closing brace.
}
```

The package installs `Symbol.dispose` when the host lacks it, so the methods exist everywhere. The `using` syntax itself needs TypeScript 5.2 or later (with `esnext.disposable` in `lib`), a bundler that lowers it, or a runtime with native support; otherwise call `destroy()` in a `finally` block. A method called on a released handle throws `SonareError` with `InvalidState`.

## Reference Pages

The reference is split by subject. Every page below assumes the installation, import, and initialization steps above.

- [Analysis](./js-api-analysis.md): song-level analysis, feature extraction, and Roman-numeral chord analysis.
- [Helpers and Conversions](./js-api-helpers.md): librosa-compatible helpers, scale quantization, unit conversion, resampling, and chord functions.
- [Effects](./js-api-effects.md): audio effects, editing DSP, and room-acoustics measurement.
- [Mastering](./js-api-mastering.md): the mastering chain, named processors, presets, and the one-shot dynamics and repair processors.
- [Streaming and Realtime](./js-api-streaming.md): block-by-block processors, the streaming mastering chain, and the incremental `StreamAnalyzer`.
- [Audio, Metering and Mixing](./js-api-audio.md): the `Audio` class, metering, take alignment, mixer strips, and the mixing API.
- [Types and Enumerations](./js-api-types.md): type definitions, enumerations, and the type export index.
- [Workers](./wasm-advanced.md#web-worker-usage): `OfflineWorkerClient` and `VocalEditWorkerClient` for running offline work off the main thread.

## Projects, instruments & live MIDI

The package also exposes the project, synthesis, and live-input APIs used to
turn MIDI/clip arrangements into audio. These are summarized here; each topic has
a dedicated guide.

| Goal | Use | Guide |
|------|-----|-------|
| Start an empty project | `Project.create()` (or `new Project()`) | [Project Editing](./project-editing.md) |
| Build/load a clip + MIDI arrangement and edit it | `Project` (`Project.fromJson`, `toSceneJson`, MIDI event helpers) | [Project Editing](./project-editing.md) |
| Preserve opaque analysis/assist metadata | `project.setAssistSidecar(...)`, `assistSidecars()` | [Project Editing](./project-editing.md) |
| Classify automation lanes | `ProjectAutomationTargetKind`, `targetKind` on `ProjectAutomationLaneDesc` | [Project Editing](./project-editing.md) |
| Render a project to audio | `project.bounceWithSynthInstrument(s)` | [Project Bounce](./project-bounce.md) |
| Pick a built-in synth voice | `synthPresetNames()`, `synthPresetPatch(name)`, `engine.setSynthInstrument(...)` | [Native Synth](./native-synth.md) |
| Play through a SoundFont | `project.loadSoundFont(bytes)` / `engine.loadSoundFont(bytes)` | [SoundFont Player](./soundfont-player.md) |
| Schedule MIDI clips into the live engine, sample-accurately | `engine.setMidiClips(...)`, `engine.sampleAtPpq(ppq)` | [Realtime Engine](./realtime-engine.md#midi-clip-scheduling-and-sampleatppq) |
| Set per-track cue monitoring (heard in live `process()` output; offline renders, bounces and freezes exclude it) | `engine.setTrackMonitorMode(laneIndex, 'off' | 'pfl' | 'afl')` | [Realtime Engine](./realtime-engine.md#track-lanes-buses-and-channel-strips) |
| Mix the engine's tracks live with lanes, buses, sends, and strips | `engine.setTrackLanes(...)`, `engine.setTrackBuses(...)`, strip JSON setters | [Realtime Engine](./realtime-engine.md#track-lanes-buses-and-channel-strips) |
| Send a track to external MIDI hardware and optionally forward clock/transport | `engine.setMidiDestinationExternal(...)`, `engine.setExternalMidiClockEnabled(...)`, `engine.drainExternalMidi(...)`; Worklet facade: `onMidiOut(...)` | [Realtime Engine](./project-editing-midi.md#sending-a-track-to-external-midi-gear) |
| Drive the engine from a hardware/Web MIDI device | `bindWebMidi(engine, ...)` <Badge type="info" text="Browser only" /> | [MIDI Input](./midi-input.md) |
| Feed a live microphone into the engine | `bindMicrophoneInput(context, engine, ...)` <Badge type="info" text="Browser only" /> | [Recording and Takes](./recording-and-takes.md) |

```typescript
import { Project, synthPresetNames } from '@libraz/libsonare';

const project = Project.fromJson(projectJson);
const audio = project.bounceWithSynthInstrument(synthPresetNames()[0]);
```

`bounceWithSynthInstrument(...)` accepts either one instrument or an array of
instruments, one per destination. Each entry may be a preset name (a `"va:"`
routing prefix is allowed), an explicit `SynthPatch`, or `null` for the init
patch.

`bindWebMidi(...)` and `bindMicrophoneInput(...)` are browser-only helpers that
wire Web MIDI / a `MediaStream` into a live `RealtimeEngine`. See
[Realtime Engine](./realtime-engine.md) for the engine itself.

## Performance Summary

| API | Load | Notes |
|-----|------|-------|
| `StreamAnalyzer` | <Badge type="tip" text="Real-time" /> | Per-chunk processing, ~2ms/frame, updating BPM/key/chord estimation |
| `Mixer` | <Badge type="tip" text="Real-time" /> | Scene-based block processing with automation and meters |
| `analyze` / `analyzeWithProgress` | <Badge type="warning" text="Heavy" /> | All-in-one analysis pipeline |
| `hpss` / `harmonic` / `percussive` | <Badge type="warning" text="Heavy" /> | STFT + median filtering |
| `timeStretch` | <Badge type="warning" text="Heavy" /> | Phase vocoder |
| `pitchShift` | <Badge type="warning" text="Heavy" /> | Time stretch + resample |
| `stft` / `stftDb` | <Badge type="info" text="Medium" /> | Multiple FFT operations |
| `melSpectrogram` / `mfcc` | <Badge type="info" text="Medium" /> | STFT + filterbank |
| `chroma` | <Badge type="info" text="Medium" /> | STFT + chroma filterbank |
| `pitchYin` / `pitchPyin` | <Badge type="info" text="Medium" /> | Per-frame pitch detection |
| `resample` | <Badge type="info" text="Medium" /> | High-quality resampling |
| `detectBpm` / `detectKey` | Light | Single result |
| `detectBeats` / `detectOnsets` | Light | Frame-based detection |
| Unit conversion functions | Light | Pure computation |
| `normalize` / `trim` | Light | Simple processing |
