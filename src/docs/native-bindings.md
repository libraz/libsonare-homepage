# Native Bindings

libsonare ships three bindings: browser **WASM**, **Python**, and a **Node.js native addon**. This page compares all three so you can pick one; the full Node native function reference lives on its own page. See the individual API pages for each language:

- **[Python API](/docs/python-api)** — ctypes-based bindings with wheels on PyPI
- **[Node.js Native API](/docs/node-api)** — Native addon for direct C++ performance

For beginners, the choice is usually simple: use Python for scripts and notebooks, use WASM for browser apps, and use Node native only when you specifically need native file decoding or native runtime performance from Node.js.

| You are building | Use | Package |
|------------------|-----|---------|
| A browser app | WASM | `@libraz/libsonare` |
| A Python script or notebook | Python | `pip install libsonare` |
| A Node.js app needing native decode or performance | Node native | `@libraz/libsonare-native` |

## What You Will Learn

By the end of this page you should be able to:

- choose between browser WASM, Python, and Node native without treating them as interchangeable packages;
- build and import the Node N-API addon when native decoding or performance is required;
- understand which examples use `@libraz/libsonare` and which use `@libraz/libsonare-native`;
- map native addon functions back to the broader JavaScript, Python, mastering, and mixing docs.

## Comparison

| | WebAssembly | Python | Node.js (N-API) |
|---|---|---|---|
| **Platform** | Browser | Desktop | Desktop |
| **Distribution** | npm (`@libraz/libsonare`) | PyPI (`pip install libsonare`) | Source (`bindings/node`) |
| **Build** | Emscripten | Pre-built wheels (or CMake + pip) | CMake + cmake-js |
| **Performance** | Near-native | Native | Native |
| **Streaming** | Yes | Yes | Yes |
| **File I/O** | Sample-based APIs; `Audio.fromMemory(...)` decodes WAV/MP3 bytes, and the browser decode path can read additional supported formats | WAV/MP3 by default; FFmpeg formats in FFmpeg builds | WAV/MP3 by default; FFmpeg formats in FFmpeg builds |
| **Effects** | Yes | Yes | Yes |
| **Feature Extraction** | Yes | Yes | Yes |
| **Inverse reconstruction** | Yes | Yes | Yes |
| **Unit Conversions** | Yes | Yes | Yes |
| **Mastering** | Yes | Yes | Yes |
| **Mixing** | Yes | Yes | Yes |

---

## Node.js (N-API)

The Node.js binding is a native addon built with **N-API**, providing direct C++ performance without WebAssembly overhead.

::: details What are N-API and a "native addon"?
A **native addon** is a compiled C/C++ module that Node loads like a normal package. It runs real machine code instead of JavaScript or WebAssembly.

**N-API** (Node-API) is the stable interface Node provides for building these addons. It shields the addon from V8 engine internals, so one compiled binary can keep working across Node versions without recompiling.

The practical upside is native speed and direct file decoding from Node. The cost is that the addon must be built or installed for your platform, instead of running everywhere like the WASM package.
:::

## Choosing A Node Package

| Package | Initialization | Use when |
|---------|----------------|----------|
| `@libraz/libsonare` | Call `await init()` before use | You want the browser-compatible WASM package or the exact browser-demo API |
| `@libraz/libsonare-native` | No WASM init; import and call functions directly | You need native file decoding, native runtime performance, or source-tree addon development |

Examples in [JavaScript API](./js-api.md) use the WASM package. Examples that use the native addon carry the `@libraz/libsonare-native` import path, and the full native reference is on the [Node.js Native API](./node-api.md) page.

### Requirements

- Node.js 22+
- CMake 3.16+
- C++17 compiler
- Yarn 4+

### Installation

```bash
git clone https://github.com/libraz/libsonare.git
cd libsonare/bindings/node
yarn install
yarn build
```

## Mastering API

Node users can choose between the WASM npm package and the native addon:

| Package | Use when |
|---------|----------|
| `@libraz/libsonare` | You want the same API as the browser demo or need Web-compatible WASM. |
| `@libraz/libsonare-native` | You need native file decoding or native runtime performance in Node.js. |

```typescript
import {
  masterAudioStereo,
  masteringChainStereo,
  masteringAssistantSuggest,
  masteringAudioProfile,
  masteringPresetNames,
  masteringPairAnalyze,
  masteringProcessorNames,
  masteringStreamingPreview,
} from '@libraz/libsonare-native'

console.log(masteringProcessorNames())
console.log(masteringPresetNames())

const mastered = masteringChainStereo(left, right, sampleRate, {
  dynamics: {
    compressor: {
      thresholdDb: -18,
      ratio: 2.2,
      autoMakeup: true,
    },
  },
  loudness: {
    targetLufs: -14,
    ceilingDb: -1,
    truePeakOversample: 4,
  },
})
console.log(mastered.outputLufs, mastered.stages)

const presetMaster = masterAudioStereo(left, right, sampleRate, 'pop', {
  'loudness.targetLufs': -14,
})
console.log(presetMaster.outputLufs, presetMaster.stages)

const matchReport = JSON.parse(
  masteringPairAnalyze('match.referenceLoudness', source, reference, sampleRate),
)

const masteredWithProgress = masteringChainStereo(left, right, sampleRate, {
  loudness: { targetLufs: -14, ceilingDb: -1, truePeakOversample: 4 },
}, (progress, stage) => {
  console.log(`render ${(progress * 100).toFixed(0)}%: ${stage}`)
})
console.log(masteredWithProgress.outputLufs)

const profile = JSON.parse(masteringAudioProfile(samples, sampleRate, {
  nFft: 2048,
  hopLength: 512,
  truePeakOversample: 4,
}))
const suggestions = JSON.parse(masteringAssistantSuggest(samples, sampleRate, {
  targetLufs: -14,
  ceilingDb: -1,
  preferStreamingSafe: true,
}))
const deliveryPreview = JSON.parse(masteringStreamingPreview(samples, sampleRate, [
  { name: 'Streaming', targetLufs: -14, ceilingDb: -1 },
]))
console.log(profile, suggestions, deliveryPreview)
```

The assistant/profile helpers accept the same option names as the WASM entry points. Profile params are `nFft`, `hopLength`, and `truePeakOversample`; assistant params are `targetLufs`, `ceilingDb`, `enableRepair`, `preferStreamingSafe`, and `speechMonoAmount`. The native parser also accepts snake_case aliases.

For long offline renders, pass the optional progress callback to `masteringChain(...)`, `masteringChainStereo(...)`, `masterAudio(...)`, or `masterAudioStereo(...)` and update your Node UI from that callback.

The WASM package exposes the same camelCase mastering API names as the browser demo. The main groups are:

| Group | API names |
|-------|-----------|
| Presets and quick entry points | `mastering()`, `masteringPresetNames()`, `masterAudio()`, `masterAudioStereo()`, `masterAudioWithProgress()`, `masterAudioStereoWithProgress()` |
| Full chains | `masteringChain()`, `masteringChainStereo()`, `masteringChainWithProgress()`, `masteringChainStereoWithProgress()` |
| Offline dynamics (one-shot) | `masteringDynamicsCompressor()`, `masteringDynamicsGate()`, `masteringDynamicsTransientShaper()` |
| Offline repair (one-shot) | `masteringRepairDeclick()`, `masteringRepairDeclip()`, `masteringRepairDecrackle()`, `masteringRepairDehum()`, `masteringRepairDenoiseClassical()`, `masteringRepairDereverbClassical()`, `masteringRepairTrimSilence()` |
| Assistant and profiling | `masteringAudioProfile()`, `masteringAssistantSuggest()`, `masteringStreamingPreview()` |
| Named processors | `masteringProcessorNames()`, `masteringProcessorCatalog()`, `masteringInsertNames()`, `masteringInsertParamNames(name)`, `masteringInsertParamInfo(name)`, `masteringProcess()`, `masteringProcessStereo()` |
| Pair and stereo analysis | `masteringPairProcessorNames()`, `masteringPairProcess()`, `masteringPairAnalysisNames()`, `masteringPairAnalyze()`, `masteringStereoAnalysisNames()`, `masteringStereoAnalyze()` |
| Streaming render | `StreamingMasteringChain` |

Node native uses the same base names but folds progress into an optional final callback argument instead of exporting separate `*WithProgress` helper functions.

## Mixing API

The native addon and the WASM package both expose the mixing API: `mixStereo(...)`, `mixingScenePresetNames()`, `mixingScenePresetJson()`, and the persistent `Mixer` class.

Use it for channel-strip processing, scene presets, sends, buses, automation, meters, and offline stem rendering. See [Mixing Engine](./mixing.md) for the cross-runtime guide.

For persistent mixers, Node native accepts a `StripRef` (`number | string`) for most strip control methods; WASM methods use numeric strip indexes and expose `stripById(id)` for lookup. Node `stripMeter(strip)` reads the post-fader meter; use `meterTap(strip, 'preFader' | 'postFader')` when you need an explicit tap. After loading scene JSON, `mixer.sceneWarnings()` lists insert params no processor consumed (typically typos) as non-fatal warnings.

## Projects, Instruments & Live MIDI

The Node native addon exposes the same headless-DAW API as WASM and Python: the `Project` class (tracks, clips, tempo, undo/redo, SMF/MIDI 2.0 interchange), instrument-bound bounces (`bounceWithSynthInstrument(s)`, SoundFont loading), the NativeSynth preset catalog (`synthPresetNames()` / `synthPresetPatch()` / `SynthPatch`), `chordFunctionalAnalysis(...)`, and the `RealtimeEngine` with live MIDI input. The engine carries the same lane mixer and MIDI clip schedule as the other bindings — `setTrackLanes` / `setTrackBuses`, strip JSON and insert controls for tracks, the master, and buses, insert automation-id resolvers, `setParamSmoothingMs`, wide/scope telemetry, `setMidiClips`, and `sampleAtPpq` — with the same camelCase names as WASM. It also exposes external-device routing through `setMidiDestinationExternal`, `setExternalMidiClockEnabled`, `drainExternalMidi`, and `externalMidiDroppedCount` (see [Realtime Engine](./realtime-engine.md#sending-a-track-to-external-midi-gear)). The browser-only helpers (`bindWebMidi`, `bindMicrophoneInput`) are WASM-specific and not part of the native addon.

The guides carry the depth: [Project Editing](./project-editing.md), [Bouncing Projects](./project-bounce.md), [Built-in Synthesizer](./native-synth.md), [SoundFont Player](./soundfont-player.md), and [MIDI Input](./midi-input.md).

## Error Handling

Like the WASM package, the native addon throws a structured `SonareError` on every native failure: an `Error` subclass with a numeric `code` and its canonical `codeName`, mirroring the C ABI error enum. Both packages export `ErrorCode`, `SonareError`, and the `isSonareError(value)` type guard, and the same failure reports the same numeric code on every binding. See [Error Handling](./js-api.md#error-handling) for the code table and a usage example.

## Audio Method Differences

The WASM `Audio` class offers method-style access to common one-shot helpers. Focused helpers remain standalone when they are less common or need a different calling shape.

| Available as `Audio` methods | Still standalone in WASM |
|------------------------------|--------------------------|
| Core BPM/key/beat/chord analysis | `analyzeSections(...)` |
| HPSS and editing helpers | `analyzeMelody(...)` |
| Mastering helpers | `analyzeDynamics(...)` |
| Feature extraction | `analyzeTimbre(...)` |
| Loudness and resampling | Room-acoustic helpers, section/melody/dynamics/timbre helpers |

Node native's `Audio` object has more methods because it can call into the native addon directly.

| Capability | Node native | WASM |
|------------|-------------|------|
| Extra `Audio` methods | More focused analysis and room-acoustic methods are available as instance methods | Use standalone focused helpers where available |
| File construction | `Audio.fromFile(...)`, `Audio.fromMemory(...)` | `Audio.fromBuffer(...)`, `Audio.fromMemory(...)`, `Audio.fromMemoryWithBrowserFallback(...)` |

Node native adds `analyzeBpm(...)`, `analyzeImpulseResponse(...)`, `detectAcoustic(...)`, `analyzeRhythm(...)`, `analyzeDynamics(...)`, `analyzeTimbre(...)`, and `detectChords(...)` to `Audio`. The room helpers `estimateRoom(...)`, `synthesizeRir(...)`, and `roomMorph(...)` remain standalone functions. The full method and function reference is on the [Node.js Native API](./node-api.md) page.

### StreamingMasteringChain

The native addon (and the WASM package) exposes a `StreamingMasteringChain`
class for incremental rendering — for example when bridging an Electron app,
worker, or audio capture pipeline. It accepts the same nested config as
`masteringChain()` and renders one block at a time.

```typescript
import { StreamingMasteringChain } from '@libraz/libsonare-native';

const chain = new StreamingMasteringChain({
  eq: { tilt: { tiltDb: 0.5 } },
  dynamics: { compressor: { thresholdDb: -20 } },
  maximizer: { truePeakLimiter: { ceilingDb: -1, oversampleFactor: 4 } },
});

chain.prepare(48000, /*maxBlockSize=*/512, /*numChannels=*/2);

const monoOut = chain.processMono(monoBlock);
const { left, right } = chain.processStereo(leftBlock, rightBlock);

console.log(chain.stageNames(), chain.latencySamples());
chain.reset();   // clear state without rebuilding
```

Stereo-only stages are skipped when `numChannels === 1`. The streaming chain
rejects offline-only repair stages and the whole-file `loudness` stage; use
`masteringChain*` or `masterAudio*` for those. The WASM build also exposes
`chain.delete()` to release the underlying handle; the native addon releases
its handle on GC.

Related mastering guides: [Browser local processing](./glossary/concepts/browser-local-processing.md), [Reference match](./glossary/mastering/reference-match.md), [Quality checklist](./glossary/mastering/quality-checklist.md).

### StreamingEqualizer

`StreamingEqualizer` is available in Node native, Python, and WASM.

It is useful when you need an EQ that keeps state across `processMono` / `processStereo` calls. It can also publish a spectrum snapshot and configure bands from a reference match.

Node native and WASM accept the same phase mode values; Python additionally supports context-manager usage:

| Runtime | Phase mode values |
|---------|-------------------|
| Node native | `'zero'`, `'natural'`, `'linear'`, or `1` / `2` / `3` |
| WASM | `'zero'`, `'natural'`, `'linear'`, or `1` / `2` / `3` (same as Node native) |
| Python | String or numeric modes; also supports `with StreamingEqualizer(...) as eq:` / `eq.close()` |

```typescript
import { StreamingEqualizer } from '@libraz/libsonare-native';

const eq = new StreamingEqualizer({ sampleRate: 48000, maxBlockSize: 512 });
eq.setBand(0, { type: 'HighShelf', frequencyHz: 8000, gainDb: 4, enabled: true });
eq.setPhaseMode('natural');
eq.setAutoGain(true);

const { left, right } = eq.processStereo(leftBlock, rightBlock);
console.log(eq.spectrum(), eq.latencySamples(), left, right);
```

`@libraz/libsonare-native` is currently intended to be built from
`bindings/node` in the source tree. To use it from another project, reference
the built local package through your workspace or a `file:` dependency.

The native build auto-detects FFmpeg development libraries via `pkg-config`.
Without FFmpeg it decodes WAV and MP3. To require or disable FFmpeg explicitly:

```bash
SONARE_FFMPEG=1 yarn build  # require FFmpeg-backed decoding
SONARE_FFMPEG=0 yarn build  # force WAV/MP3-only decoding
```

## Full Function Reference

The complete function-by-function Node native reference lives on its own page: [Node.js Native API](./node-api.md). It documents the analysis, effects, feature-extraction, inverse-reconstruction, librosa-compatible, conversion, metering, and scale-quantization functions, the streaming and realtime classes, and the exported TypeScript types.
