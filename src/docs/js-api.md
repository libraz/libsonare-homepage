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
| **Audio Class** | `Audio.fromBuffer`, `Audio.fromMemory`, `Audio.fromMemoryWithBrowserFallback` | File-loading helper and method-style access for common functions |

::: tip Terminology
New to audio analysis? See the [Glossary](/docs/glossary) for explanations of terms like BPM, STFT, Chroma, and more.
:::

::: info Most functions take decoded PCM, not a file path
Most browser functions do not take an MP3 or WAV path; they take decoded PCM samples plus `sampleRate`. To go from encoded bytes to samples, either decode with the Web Audio API (`AudioContext.decodeAudioData`) yourself, or use the `Audio.fromMemory` / `Audio.fromMemoryWithBrowserFallback` factories below. They decode encoded bytes in memory: WAV/MP3 with the bundled WASM decoder, and AAC/OGG/FLAC through browser decoding when needed.
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

Node and WASM reject values they used to quietly reshape: wrong-typed repair and
dynamics options, an unknown track kind, capture source, or pitch-correction
mode, a negative spectrum setting, enum spellings and ordinals that are not
declared, and mastering override values that are neither number nor boolean.
Instance methods also throw after `destroy()` instead of touching a freed
handle. Where you previously got a surprising default, you now get a
`SonareError` at the call site.

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

The catalog carries real values: across the 88 processors it publishes, every one
of the 1147 parameters reports a non-null `default`; 316 report a non-null `min`
and 193 a non-null `max`. The remaining 802 report `null` on both bounds — a
`null` means the catalog knows of no limit for that parameter, not that bounds
are unavailable in general.

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
  Every EQ `band*.frequencyHz` ceiling reads as `24000` in the catalog and rises
  once the insert is prepared at a higher rate.
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
    params: Array<{
      name: string;
      id: number;
      rtSafe: boolean;
      type: 'boolean' | 'number';
      min: number | null;
      max: number | null;
      default: boolean | number | null;
      unit: string | null;
    }>;
  }>;
  presets: {
    mastering: string[];
    synth: string[];
    mixingScene: string[];
    voiceChanger: string[];
  };
}
```

This is what you build a generic parameter UI from: every slider's range and
default comes from the catalog rather than from a table you maintain by hand. A
bound the core does not know is reported as an explicit `null` — treat that as
"unbounded/unknown", not as zero.

The per-band EQ surfaces publish a `type` and a `default` for every band field,
so a generic UI can lay out the bands without a hand-written table:
`eq.parametric` publishes 72 parameters, `eq.midSide` 144 and
`multiband.dynamicEq` 264. Publishing those defaults does not change which keys
count as *read*, though — a band you supply incompletely still reports its stray
keys as ignored, exactly as before.

### `abiVersion()`

Returns the aggregate native ABI version across the C POD surfaces. Persist or compare it when loading a prebuilt binary so an incompatible JS/native artifact pair fails early.

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

The resolved `RealtimeVoiceChangerPodConfig` uses camelCase keys on both JavaScript surfaces (`inputGainDb`, `wetMix`, `formantFactor`, `limiterIspCeilingDbtp`, and so on). The equivalent C and Python POD fields remain snake_case.

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

## Reference Pages

The reference is split by subject. Every page below assumes the installation, import, and initialization steps above.

- [Analysis](./js-api-analysis.md) — song-level analysis, feature extraction, scale quantization, unit conversion, librosa-compatible helpers, and resampling.
- [Effects](./js-api-effects.md) — audio effects, editing DSP, and room-acoustics measurement.
- [Mastering](./js-api-mastering.md) — the mastering chain, named processors, presets, streaming mastering, and the mixing API.
- [Audio and Streaming](./js-api-audio.md) — the `Audio` class, metering, and the incremental streaming API.
- [Types and Errors](./js-api-types.md) — type definitions, enumerations, error handling, and the type export index.

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
| Send a track to external MIDI hardware and optionally forward clock/transport | `engine.setMidiDestinationExternal(...)`, `engine.setExternalMidiClockEnabled(...)`, `engine.drainExternalMidi(...)`; Worklet facade: `onMidiOut(...)` | [Realtime Engine](./realtime-engine.md#sending-a-track-to-external-midi-gear) |
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
