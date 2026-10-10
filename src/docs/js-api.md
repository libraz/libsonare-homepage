---
title: JavaScript/TypeScript API Reference
description: The libsonare JavaScript/TypeScript package reference hub — installation, import, initialization, and a map of the per-subject reference pages.
---

# JavaScript/TypeScript API Reference

API reference for the libsonare JavaScript/TypeScript package.

## Overview

libsonare provides audio analysis, mastering, mixing, and editing DSP capabilities for web applications. The npm package is the WebAssembly build. In practice, most functions expect decoded `Float32Array` PCM: the raw sample values after an MP3, WAV, or other file has already been decoded. For loading, the `Audio.fromMemory*` factories can decode encoded bytes in memory (a native WASM decoder for WAV/MP3, plus an optional browser decoder for AAC/OGG/FLAC).

For a first browser integration, keep the path narrow:

1. call `await init()` once when your app starts;
2. decode the user file into samples and keep its `sampleRate`;
3. call one small function such as `detectBpm(samples, sampleRate)`;
4. only then move to `analyze`, mastering, mixing, or streaming APIs.

| Category | Functions | Use Cases |
|----------|-----------|-----------|
| **Quick Analysis** | `detectBpm`, `detectKey`, `detectBeats` | DJ apps, music players, beat sync |
| **All-In-One Analysis** | `analyze`, `analyzeWithProgress` | Music production, song metadata |
| **Audio Effects** | `hpss`, `timeStretch`, `pitchShift`, `spectralEdit` | Remixing, practice tools, region repair |
| **Features** | `melSpectrogram`, `chroma`, `mfcc` | ML input, visualization |
| **Mastering** | `masterAudio`, `masteringChain`, `StreamingMasteringChain` | LUFS (Loudness Units relative to Full Scale) targets, true-peak limiting, presets, streaming chains |
| **Mixing** | `mixStereo`, `Mixer`, `mixingScenePresetNames` | Stem mixing, routing, automation, meters |
| **Editing DSP** | `pitchCorrectToMidi`, `noteStretch`, `spectralEdit`, `voiceChange`, `StreamingRetune`, `RealtimeVoiceChanger` | Vocal tuning, note edits, pitch/formant changes |
| **Audio Class** | `Audio.fromBuffer`, `Audio.fromMemory`, `Audio.fromMemoryWithBrowserFallback`, `decodeChannelsWithBrowserFallback` | File-loading helpers and method-style access for common functions |

::: tip Terminology
New to audio analysis? See the [Glossary](/docs/glossary) for explanations of terms like BPM, STFT, Chroma, and more.
:::

::: info Most functions take decoded PCM, not a file path
Most browser functions do not take an MP3 or WAV path; they take decoded PCM samples plus `sampleRate`. To go from encoded bytes to samples, either decode with the Web Audio API (`AudioContext.decodeAudioData`) yourself, or use the `Audio.fromMemory` / `Audio.fromMemoryWithBrowserFallback` factories below. They decode encoded bytes in memory: WAV/MP3 with the bundled WASM decoder, and AAC/OGG/FLAC through browser decoding when needed. `decodeChannelsWithBrowserFallback(bytes, options?)` takes the same path but keeps every channel instead of folding to mono.
:::

For a cross-binding feature map, see [Feature Map](./api-surface.md). For the mastering processor registry and mixing scene format, see [Mastering Processors](./mastering-processors.md) and [Mixing Scene JSON](./mixing-scene-json.md).

## How To Read This Reference

Read this page in three passes:

1. Start with [Pick The Smallest API That Solves The Job](#pick-the-smallest-api-that-solves-the-job) and choose one function family.
2. Read only the section for that family, then run one recipe from [Examples](./examples.md).
3. Come back to the full type definitions when you need exact return shapes, optional parameters, or runtime parity.

For browser apps, keep the core rule in mind: initialize WASM with `await init()`, decode files to PCM first, then pass `Float32Array` samples plus the original `sampleRate`.

## One-shot request objects

The top-level one-shot analysis, effects, mastering, metering, feature, mixer, and voice-changer APIs use a named **request object** as their canonical form. Every input is named, optional settings can grow without changing argument order, and TypeScript can guide you to the matching `*Request` type. Positional forms are compatibility overloads with identical defaults, validation, errors, results, and progress behavior.

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

// Still supported for existing callers
const legacyBpm = detectBpm(samples, sampleRate);
```

The request fields use the same camelCase names on the Node and WASM packages. Python remains keyword-oriented (`detect_bpm(samples, sample_rate=...)`), rather than adopting a JavaScript-style options object.

### Cancelling a long call

Requests that report progress also accept `cancel`, a predicate polled at the
same native boundaries `onProgress` fires on. Return `true` and the call aborts.

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

A cancelled call throws `SONARE_ERROR_CANCELLED` (error code 8) and leaves its
outputs unallocated, so there is no partial result to inspect. Python takes the
same predicate as `cancel=`.

### Inputs are validated, not coerced

Node and WASM reject values instead of quietly reshaping them: wrong-typed repair and
dynamics options, an unknown track kind, capture source, or pitch-correction
mode, a negative spectrum setting, a fractional number where an integer is read,
enum spellings and ordinals that are not declared, and mastering override values
that are neither number nor boolean. Instance methods also throw after
`destroy()` instead of touching a freed handle. A bad value surfaces as an error
at the call site rather than as a surprising default.

Which error class you get depends on who refused the value:

| Refused by | Class | Examples |
|------------|-------|----------|
| The JavaScript binding, wrong type or missing | `TypeError` | a string where samples are expected, a `samples` that is not a `Float32Array`, a `sampleRate` that is not a number, a request object that is `null`, a number or an array, a missing required field |
| The JavaScript binding, outside the domain | `RangeError` | an unknown name, a fractional integer, two buffers whose lengths must match, a string carrying an embedded NUL, empty or non-finite audio, a `sampleRate` outside the supported range or not an integer |
| The library or an object's state | `SonareError` with a code | a rejected stream configuration, a malformed project or scene document (`InvalidFormat`), an unknown insert in a scene (`InvalidParameter`) |
| A released, destroyed, or uninitialised handle | `SonareError` with `InvalidState` | calling an analysis function before `init()`, any method after `destroy()` |

`isSonareError` matches only the third and fourth rows, so validate user input with a catch that handles all three classes. Every one-shot that takes samples and a sample rate checks them before the core is reached: empty or non-finite audio and an out-of-range or non-integer `sampleRate` are a `RangeError`, a wrong-typed argument a `TypeError` naming it, and no raw embind `BindingError` reaches a caller. The argument checks the core makes itself on its own objects (a rejected STFT or stream configuration) stay a coded `SonareError`. See [Error Handling](./js-api.md#error-handling) for the code table.

## Pick The Smallest API That Solves The Job

The package is broad, so start from the task rather than the function list:

| You need | Start with | Why |
|----------|------------|-----|
| One tempo/key/beat value for a track | `detectBpm`, `detectKey`, `detectBeats` | Fast, direct answers without building the all-in-one analysis object |
| Metadata for a whole song | `analyze` or the focused `analyze*` helpers | `analyze` gives the common summary; focused helpers expose more detail |
| A live visualizer or updating BPM/key/chord UI | `StreamAnalyzer` | Processes small audio blocks and lets the UI read the newest frames |
| Browser mastering or delivery preview | `masterAudio*`, `masteringChain*`, `StreamingMasteringChain` | Use presets first, then move to named processors when you need control |
| Stem balance, sends, buses, or meters | `mixStereo` or `Mixer` | One-shot mix first; persistent scene mixer when routing matters |
| Vocal/note/spectral edits | `pitchCorrectToMidi`, `noteStretch`, `spectralEdit`, `voiceChange`, `StreamingRetune`, `RealtimeVoiceChanger` | Editing DSP changes the signal rather than analyzing it |
| Room decay, clarity, equivalent-room estimates, or generated room character | `analyzeImpulseResponse`, `detectAcoustic`, `estimateRoom`, `synthesizeRir`, `roomMorph` | These describe or apply the recording space, not the music |

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

Initialize the WASM module. Must be called before any analysis functions.

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

**Example:**

```typescript
import { init, detectBpm } from '@libraz/libsonare';

// Basic initialization
await init();

// With custom file location
await init({
  locateFile: (path, prefix) => `/custom/wasm/path/${path}`
});
```

Options apply on the first call only. Calling `init()` again with no options, or
with the same options (functions compared by reference), resolves immediately; a
second call whose options differ throws `SonareError` with `InvalidState` naming
the option. `init()` also compares the loaded module's ABI version with the one
the package was built against and throws `AbiMismatch` (code 10) when the `.wasm`
and the JavaScript come from different builds, which a stale cache or a custom
`wasmBinary` / `locateFile` can produce. The expected version is exported as `EXPECTED_ABI_VERSION` from the package root and from `@libraz/libsonare/worklet`, so a test double passed as `moduleFactory` can report the version `init()` checks for. Every function called before `init()` resolves and needs the module throws `InvalidState`.

### `isInitialized()`

Check if the module is initialized.

```typescript
function isInitialized(): boolean
```

### `version()`

Get the library version.

```typescript
function version(): string  // e.g., "{{ wasmMeta.version }}"
```

### `capabilities()`

Describe the build that is actually loaded — the same report the CLIs print as
`doctor`. Synchronous, and only valid after `init()`.

```typescript
function capabilities(): {
  version: string;
  abi: { project: number; engine: number };
  platform: string;
  features: {
    mastering: boolean;
    mixing: boolean;
    fx: boolean;
    ffmpeg: boolean;
    mixingAssistant: boolean;
    instrumentParamAutomation: boolean;
  };
  decode: { builtin: string[]; ffmpeg: string[] };
  simd: string;
  hardwareConcurrency: number;
}
```

Branch on `features` instead of guessing: a build without `mixing` has no
`Mixer`, and `decode.builtin` tells you which formats the module can open before
you ask the browser to fall back.

`mixingAssistant` and `instrumentParamAutomation` are the two probes a host is
most likely to need and least likely to reach for, because the entry points they
guard stay registered whether or not the subsystem was built: `suggestMixScene`
and the instrument-parameter automation targets exist as functions in every
module and **throw** when the subsystem is absent. Probing for the function
therefore tells you nothing, and `typeof fn === 'function'` is not a capability
check. `instrumentParamAutomation` reports `false` in a build without the
arrangement subsystem; `mixingAssistant` is compiled out of the analysis-only
module, so that build reports `false` even though the symbol is there.

### `capabilityCatalog()`

Return a machine-readable catalog of every processor, its parameter descriptors,
and the built-in preset lists. It is the same canonical JSON the C ABI publishes
and Python exposes as `capability_catalog`, validated against
`schemas/capability-catalog.schema.json`.

The catalog carries real values: the current build publishes 95 processors (84
of them realtime-insertable) and 5,579 parameter descriptors. Defaults can be `null` when a construction key has
no fallback. Bounds are measured with the processor's other parameters at their
defaults; a `null` bound means the catalog knows of no limit on that side, not
that bounds are unavailable in general.

::: warning Bounds are measured, and a measured bound has caveats
A published bound is **a hard constraint on what may be sent, not a recommended
UI range**, and it was measured with every other parameter of the processor
sitting at its default. Three consequences are worth knowing before you wire a
slider straight to one:

- **Two parameters that constrain each other each report the other's default.**
  `maximizer.adaptiveRelease` reports `minReleaseMs <= 250` and
  `maxReleaseMs >= 20` for exactly that reason; move one and the other's real
  limit moves with it.
- **A bound derived from the sample rate reflects the un-prepared processor.**
  Every EQ `band*.frequencyHz` ceiling reads as `24000` in the catalog; an
  equalizer built at a known rate accepts band frequencies up to that rate's
  Nyquist frequency (30000 Hz at 96 kHz).
- **An exclusive bound is reported as the limit it excludes.**
  `dynamics.compressor.sidechainHpfHz` reports `min` `0` and still rejects `0`.
:::

```typescript
function capabilityCatalog(): {
  version: string;
  abi: { project: number; engine: number };
  processors: Array<{
    id: string;
    kind: 'realtime' | 'offline' | 'pair';
    realtimeInsertable: boolean;
    stereoOnly: boolean;
    latencySamples: number;
    tailSamples: number;
    /** Coarse realtime work estimate; null exactly when the processor is not insertable. */
    realtimeCost: 'low' | 'moderate' | 'high' | null;
    channelPolicy: 'multichannel' | 'stereoPairOnly' | 'perChannel' | 'passthrough';
    category: string;
    /** False for repair.declick, repair.declip and repair.trimSilence. */
    causal: boolean;
    params: Array<{
      name: string;
      id: number | null;
      rtSafe: boolean;
      type: 'boolean' | 'number' | 'enum' | 'string' | 'array';
      min: number | null;
      max: number | null;
      minExclusive: boolean;
      maxExclusive: boolean;
      maxRelativeTo: 'nyquist' | null;
      default: boolean | number | null;
      /** One of a closed set ('dB', 'Hz', 'ms', 's', 'samples', ...); null for non-numeric keys. */
      unit: MasteringInsertParamUnit | null;
      /** Display range a control should draw, inside [min, max]; null when it equals the accepted range. */
      uiMin: number | null;
      uiMax: number | null;
      scale: 'linear' | 'log';
      choices: Array<{ name: string; value: number }> | null;
      slot: string | null;
      /** Siblings whose live value bounds this key, read as `this <relation> factor * sibling`. */
      dependsOn: Array<{ key: string; relation: 'lt' | 'le' | 'gt' | 'ge'; factor: number }>;
    }>;
    slots: Array<{
      name: string;
      parent: string | null;
      activation: 'anyKey' | 'always';
      minCrossoverCutoffs: number;
    }>;
  }>;
  /** How every flat mastering chain key is described. */
  chain: CapabilityCatalogChain;
  presets: {
    mastering: string[];
    synth: string[];
    mixingScene: string[];
    voiceChanger: string[];
    playbackRoom: string[];
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

This is what you build a generic parameter UI from: every slider's range, default,
unit, and axis (`uiMin` / `uiMax`, `scale`) comes from the catalog rather than from
a table you maintain by hand. [Insert Effects](./effects-inserts.md#the-parameter-descriptor)
documents each descriptor field. A
bound the core does not know is reported as an explicit `null` — treat that as
"unbounded/unknown", not as zero.

`chain` describes the flat keys of a mastering chain config: each stage's key prefix, the processor whose parameters its keys are and its `enabled` key (`CapabilityCatalogChainStage`); the indexed lists such as the multiband stage's `cutoffsHz` and `bands`, with their item counts (`CapabilityCatalogChainList`); descriptors for the keys no processor carries (`params`); and every alias spelling of a key (`CapabilityCatalogChainAlias`). `presets.playbackRoom` is always present, and empty when playback is compiled out.

The per-band EQ surfaces publish a descriptor for every indexed band field, so a
generic UI can lay out the bands without a hand-written table. These descriptors
include construction keys as well as automation targets; use `id !== null`
to select automation targets, and use `slot` plus the processor's `slots` array
for conditional band groups. Publishing descriptors does not change which keys
count as *read*, though — a band you supply incompletely still reports its stray
keys as ignored, exactly as before.

### `abiVersion()`

Returns the aggregate native ABI version across the C POD surfaces (`0x05030207` for this build, the value `EXPECTED_ABI_VERSION` holds). Persist or compare it when loading a prebuilt binary so an incompatible JS/native artifact pair fails early.

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

- [Analysis](./js-api-analysis.md) — song-level analysis, feature extraction, and Roman-numeral chord analysis.
- [Helpers and Conversions](./js-api-helpers.md) — librosa-compatible helpers, scale quantization, unit conversion, resampling, and chord functions.
- [Effects](./js-api-effects.md) — audio effects, editing DSP, and room-acoustics measurement.
- [Mastering](./js-api-mastering.md) — the mastering chain, named processors, presets, and the one-shot dynamics and repair processors.
- [Streaming and Realtime](./js-api-streaming.md) — block-by-block processors, the streaming mastering chain, and the incremental `StreamAnalyzer`.
- [Audio, Metering and Mixing](./js-api-audio.md) — the `Audio` class, metering, take alignment, mixer strips, and the mixing API.
- [Types and Enumerations](./js-api-types.md) — type definitions, enumerations, and the type export index. Error handling is [on this page](#error-handling).

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
| Set per-track cue monitoring | `engine.setTrackMonitorMode(laneIndex, 'off' | 'pfl' | 'afl')` | [Realtime Engine](./realtime-engine.md#track-lanes-buses-and-channel-strips) |
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

## Bundle Size

| File | Size | Gzipped |
|------|------|---------|
| `sonare.js` | ~{{ wasmMeta.sonareJs.sizeKB }} KB | ~{{ wasmMeta.sonareJs.gzipKB }} KB |
| `index.js` | ~{{ wasmMeta.indexJs.sizeKB }} KB | ~{{ wasmMeta.indexJs.gzipKB }} KB |
| `sonare.wasm` | ~{{ wasmMeta.wasm.sizeKB }} KB | ~{{ wasmMeta.wasm.gzipKB }} KB |
| **Total** | ~{{ wasmMeta.total.sizeKB }} KB | ~{{ wasmMeta.total.gzipKB }} KB |

## Browser Support

| Browser | Minimum Version |
|---------|-----------------|
| Chrome | 57+ |
| Firefox | 52+ |
| Safari | 11+ |
| Edge | 16+ |

Requirements: WebAssembly, ES2017+ (async/await), Web Audio API

## Error Handling

A function called before the module is initialized throws a `SonareError` with code `InvalidState` — call `await init()` first. A second `init()` with different options also throws `InvalidState`, naming the option; repeating the same options is fine.

Native (C++) failures throw a structured **`SonareError`**: an `Error` subclass carrying a numeric `code` and its canonical `codeName`, mirroring the C ABI error enum. The same failure reports the same numeric code on every binding (WASM, Node native, Python, C ABI), so you can branch on the cause instead of matching message text. The package exports the `ErrorCode` enum, the `SonareError` class, and an `isSonareError(value)` type guard.

The facades consistently reject non-finite numbers, invalid enum/index values, and oversized resources before they reach DSP or serialization. Treat these failures as invalid input; do not rely on a binding silently clamping or accepting malformed values.

An argument the binding refuses itself is a plain `TypeError` (wrong type or missing) or `RangeError` (out of domain, unknown name, empty or non-finite samples, a `sampleRate` that is not a positive integer in range), which `isSonareError` does not match. The offline and vocal-edit worker clients rebuild `TypeError` and `RangeError` across the worker boundary, and accept a `node:worker_threads` Worker or a `workerFactory` returning one. Failures made by the engine carry a code, such as `InvalidParameter` from `synthesizeRir(...)` for a source outside the room. Released or destroyed handles throw `SonareError` `InvalidState`.

```typescript
import { ErrorCode, isSonareError, Mixer } from '@libraz/libsonare';

try {
  const mixer = Mixer.fromSceneJson(sceneJson, 48000, 512);
} catch (error) {
  if (isSonareError(error) && error.code === ErrorCode.InvalidState) {
    // 'failed to build mixer from scene JSON: send timing must be a string ("pre" or "post")'
    console.error(`scene rejected: ${error.codeName}: ${error.message}`);
  } else {
    throw error;
  }
}
```

`Mixer.fromSceneJson` reports **`InvalidState`**, not `InvalidParameter`, for
every way a scene can fail to build — a rejected field value and malformed JSON
alike. The construction is wrapped, so the underlying complaint arrives as the
tail of a `failed to build mixer from scene JSON: <inner>` message rather than as
its own code; branch on `InvalidState` and show the message to locate the field.

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

`AbiMismatch` is made by the bindings, never by the core: it reports a native module whose ABI version differs from the one the package expects (WASM in `init()`, Node when the addon is required, Python on first library use). The other codes match Python's `SonareError.code` and the C ABI `SonareError` enum, and the Python CLI maps them onto its [exit codes](./cli.md#exit-codes).

