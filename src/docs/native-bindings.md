# Native Bindings

libsonare provides native bindings for desktop platforms. See the individual API pages for each language:

- **[Python API](/docs/python-api)** — ctypes-based bindings with wheels on PyPI
- **Node.js (N-API)** — Native addon for direct C++ performance (documented below)

For beginners, the choice is usually simple: use Python for scripts and notebooks, use WASM for browser apps, and use Node native only when you specifically need native file decoding or native runtime performance from Node.js.

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
| **File I/O** | No; pass decoded samples | WAV/MP3 by default; FFmpeg formats in FFmpeg builds | WAV/MP3 by default; FFmpeg formats in FFmpeg builds |
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

Examples in [JavaScript API](./js-api.md) use the WASM package. Examples below use the native addon unless the import path is explicitly `@libraz/libsonare`.

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
| Named processors | `masteringProcessorNames()`, `masteringInsertNames()`, `masteringInsertParamNames(name)`, `masteringProcess()`, `masteringProcessStereo()` |
| Pair and stereo analysis | `masteringPairProcessorNames()`, `masteringPairProcess()`, `masteringPairAnalysisNames()`, `masteringPairAnalyze()`, `masteringStereoAnalysisNames()`, `masteringStereoAnalyze()` |
| Streaming render | `StreamingMasteringChain` |

Node native uses the same base names but folds progress into an optional final callback argument instead of exporting separate `*WithProgress` wrapper functions.

## Mixing API

The native addon and the WASM package both expose the mixing surface: `mixStereo(...)`, `mixingScenePresetNames()`, `mixingScenePresetJson()`, and the persistent `Mixer` class.

Use it for channel-strip processing, scene presets, sends, buses, automation, meters, and offline stem rendering. See [Mixing Engine](./mixing.md) for the cross-runtime guide.

For persistent mixers, Node native accepts a `StripRef` (`number | string`) for most strip control methods; WASM methods use numeric strip indexes and expose `stripById(id)` for lookup. Node `stripMeter(strip)` reads the post-fader meter; use `meterTap(strip, 'preFader' | 'postFader')` when you need an explicit tap. After loading scene JSON, `mixer.sceneWarnings()` lists insert params no processor consumed (typically typos) as non-fatal warnings.

## Projects, Instruments & Live MIDI

The Node native addon exposes the same headless-DAW surface as WASM and Python: the `Project` class (tracks, clips, tempo, undo/redo, SMF/MIDI 2.0 interchange), instrument-bound bounces (`bounceWithSynthInstrument(s)`, SoundFont loading), the NativeSynth preset catalog (`synthPresetNames()` / `synthPresetPatch()` / `SynthPatch`), `chordFunctionalAnalysis(...)`, and the `RealtimeEngine` with live MIDI input. The browser-only glue (`bindWebMidi`, `bindMicrophoneInput`) is WASM-specific and not part of the native addon.

The guides carry the depth: [Project Editing](./project-editing.md), [Bouncing Projects](./project-bounce.md), [Built-in Synthesizer](./native-synth.md), [SoundFont Player](./soundfont-player.md), and [MIDI Input](./midi-input.md).

## Error Handling

Like the WASM package, the native addon throws a structured `SonareError` on every native failure: an `Error` subclass with a numeric `code` and its canonical `codeName`, mirroring the C ABI error enum. Both packages export `ErrorCode`, `SonareError`, and the `isSonareError(value)` type guard, and the same failure reports the same numeric code on every binding. See [Error Handling](./js-api.md#error-handling) for the code table and a usage example.

## Audio Wrapper Differences

The WASM `Audio` class is a convenience wrapper for common one-shot helpers. Focused helpers remain standalone when they are less common or need a different calling shape.

| Available as `Audio` methods | Still standalone in WASM |
|------------------------------|--------------------------|
| Core BPM/key/beat/chord analysis | `analyzeSections(...)` |
| HPSS and editing helpers | `analyzeMelody(...)` |
| Mastering helpers | `analyzeDynamics(...)` |
| Feature extraction | `analyzeTimbre(...)` |
| Loudness and resampling | Room-acoustic helpers, section/melody/dynamics/timbre helpers |

Node native's `Audio` wrapper is broader because it can call into the native addon directly.

| Capability | Node native | WASM |
|------------|-------------|------|
| Extra `Audio` methods | More focused analysis and room-acoustic methods are available as instance methods | Use standalone focused helpers where available |
| File construction | `Audio.fromFile(...)`, `Audio.fromMemory(...)` | `Audio.fromBuffer(...)` only |

Node native adds `analyzeBpm(...)`, `analyzeImpulseResponse(...)`, `detectAcoustic(...)`, `analyzeRhythm(...)`, `analyzeDynamics(...)`, `analyzeTimbre(...)`, and `detectChords(...)` to `Audio`. The room helpers `estimateRoom(...)`, `synthesizeRir(...)`, and `roomMorph(...)` remain standalone functions.

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

Phase mode support differs slightly by runtime:

| Runtime | Phase mode values |
|---------|-------------------|
| Node native | `'zero'`, `'natural'`, `'linear'`, or `1` / `2` / `3` |
| WASM | Numeric modes |
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

### Usage

```typescript
import {
  Audio, analyze, detectBpm, detectKey, detectBeats, version
} from '@libraz/libsonare-native';

// Load audio
const audio = Audio.fromFile('music.mp3');
const samples = audio.getData();
const sampleRate = audio.getSampleRate();

// Individual analysis
const bpm = detectBpm(samples, sampleRate);
const key = detectKey(samples, sampleRate);
const beats = detectBeats(samples, sampleRate);

// Full analysis
const result = analyze(samples, sampleRate);
console.log(`BPM: ${result.bpm}`);
console.log(`Key: ${result.key.name}`);     // "C major"
console.log(`Beats: ${result.beatTimes.length}`);
```

#### Audio Effects

```typescript
import { Audio } from '@libraz/libsonare-native';

const audio = Audio.fromFile('music.mp3');

// Harmonic-Percussive Source Separation
const hpssResult = audio.hpss();
const harmonic = audio.harmonic();
const percussive = audio.percussive();

// Time stretch / pitch shift
const stretched = audio.timeStretch(1.5);      // 1.5x speed
const shifted = audio.pitchShift(2.0);         // Up 2 semitones

// Normalize and trim silence
const normalized = audio.normalize(0.0);        // 0 dB
const trimmed = audio.trim(-60.0);
```

#### Feature Extraction

```typescript
import { Audio } from '@libraz/libsonare-native';

const audio = Audio.fromFile('music.mp3');

// Spectrogram features
const stftResult = audio.stft(2048, 512);
const mel = audio.melSpectrogram(2048, 512, 128);
const mfcc = audio.mfcc(2048, 512, 128, 13);
const chroma = audio.chroma(2048, 512);

// Spectral features
const centroid = audio.spectralCentroid();
const bandwidth = audio.spectralBandwidth();
const rolloff = audio.spectralRolloff();
const flatness = audio.spectralFlatness();
const zcr = audio.zeroCrossingRate();
const rms = audio.rmsEnergy();

// Pitch detection
const pitchYin = audio.pitchYin();
const pitchPyin = audio.pitchPyin();
console.log(`Median F0: ${pitchPyin.medianF0.toFixed(1)} Hz`);
```

#### Unit Conversions

```typescript
import {
  hzToMel, melToHz, hzToMidi, midiToHz,
  hzToNote, noteToHz, framesToTime, timeToFrames
} from '@libraz/libsonare-native';

hzToMel(440);        // → Mel scale value
melToHz(549.64);     // → Hz
hzToMidi(440);       // → 69
midiToHz(69);        // → 440
hzToNote(440);       // → "A4"
noteToHz('A4');      // → 440

framesToTime(100, 22050, 512);  // → seconds
timeToFrames(2.32, 22050, 512); // → frame index
```

### API Reference

#### Audio

| Method | Description |
|--------|-------------|
| `Audio.fromFile(path)` | Load WAV/MP3 from disk; also FFmpeg-supported formats when built with FFmpeg |
| `Audio.fromBuffer(samples, sampleRate?)` | Create from `Float32Array`; `sampleRate` defaults to `48000` |
| `Audio.fromMemory(data)` | Decode encoded audio bytes with the same format support as `fromFile` |
| `audio.getData()` | `Float32Array` of samples |
| `audio.getSampleRate()` | Sample rate (Hz) |
| `audio.getDuration()` | Duration (seconds) |
| `audio.getLength()` | Number of samples |
| `audio.destroy()` | Release the native handle. Optional — the addon also cleans up on GC, but call this for deterministic cleanup of long-lived processes |

The `Audio` instance also exposes the common analysis, effects, feature,
loudness, and mastering helpers as methods. For example, use
`audio.detectBpm()` or `audio.masteringChain(config)` when you already have an
`Audio` object.

A few focused helpers remain standalone functions, including
`analyzeSections(...)`, `analyzeMelody(...)`, `cqt(...)`, and `vqt(...)`. For
those, pass `audio.getData()` and `audio.getSampleRate()` explicitly.

#### Analysis Functions

| Function | Return Type | Description |
|----------|-------------|-------------|
| `detectBpm(samples, sampleRate?)` | `number` | Tempo in BPM |
| `detectKey(samples, sampleRate?)` | `Key` | Root, mode, confidence |
| `detectBeats(samples, sampleRate?)` | `Float32Array` | Beat timestamps |
| `detectOnsets(samples, sampleRate?)` | `Float32Array` | Onset timestamps |
| `detectChords(samples, sampleRate?, minDuration?, smoothingWindow?, threshold?, useTriadsOnly?, nFft?, hopLength?, useBeatSync?, useHmm?, hmmBeamWidth?, useKeyContext?, keyRoot?, keyMode?, detectInversions?, chromaMethod?)` | `ChordAnalysisResult` | Chord progression with timings. Trailing options enable HMM smoothing, key context, inversions, and the chroma method (`'stft'` default) |
| `detectDownbeats(samples, sampleRate?)` | `Float32Array` | Downbeat (bar-start) timestamps |
| `detectKeyCandidates(samples, sampleRate?, options?)` | `KeyCandidate[]` | Ranked key candidates with correlation scores |
| `analyze(samples, sampleRate?)` | `AnalysisResult` | Full analysis in one call: `bpm`, `bpmConfidence`, `key`, `timeSignature`, `beatTimes`, `beats`, plus `chords`, `sections`, `timbre`, `dynamics`, `rhythm`, `melody`, and `form`. The dedicated `detect*`/`analyze*` functions below remain available for targeted or parameterized analysis |
| `analyzeWithProgress(samples, sampleRate?, onProgress?)` | `AnalysisResult` | Same as `analyze` with a `(progress, stage)` callback for long inputs |
| `analyzeBpm(samples, sampleRate?, options?)` | `BpmAnalysisResult` | Tempo with confidence and alternate candidates. `options`: `bpmMin`, `bpmMax`, `startBpm`, `nFft`, `hopLength`, `maxCandidates` |
| `analyzeRhythm(samples, sampleRate?, options?)` | `RhythmResult` | Time signature, groove, syncopation. `options`: `bpmMin`, `bpmMax`, `startBpm`, `nFft`, `hopLength` |
| `analyzeDynamics(samples, sampleRate?, options?)` | `DynamicsResult` | Dynamic range, loudness range, crest factor. `options`: `windowSec`, `hopLength`, `compressionThreshold` |
| `analyzeTimbre(samples, sampleRate?, options?)` | `TimbreResult` | Brightness, warmth, density, roughness, complexity, plus per-window `timbreOverTime`. `options`: `nFft`, `hopLength`, `nMels`, `nMfcc`, `windowSec` |
| `analyzeSections(samples, sampleRate?, options?)` | `Section[]` | Structural sections (intro/verse/chorus…) with timings. `options`: `nFft`, `hopLength`, `minSectionSec` |
| `analyzeMelody(samples, sampleRate?, options?)` | `MelodyResult` | Lead-melody contour (F0 per frame). `options`: `fmin`, `fmax`, `frameLength`, `hopLength`, `threshold`, `usePyin`, `center` |
| `detectAcoustic(samples, sampleRate?, options?)` | `AcousticResult` | Room acoustics from a recording (RT60, etc.). `options`: `nOctaveBands`, `nThirdOctaveSubbands`, `minDecayDb`, `noiseFloorMarginDb` |
| `analyzeImpulseResponse(samples, sampleRate?, nOctaveBands?)` | `AcousticResult` | Room acoustics from a measured impulse response |
| `estimateRoom(samples, sampleRate?, options?)` | `RoomEstimateResult` | Equivalent-room estimate with volume, dimensions, DRR, absorption bands, RT60 bands, and confidence |
| `synthesizeRir(options?)` | `RirResult` | Mono room impulse response from shoebox geometry |
| `roomMorph(samples, sampleRate, options?)` | `Float32Array` | Offline creative morph toward a target room |
| `lufs(samples, sampleRate?)` | `LufsResult` | Integrated, momentary, short-term loudness and loudness range (ITU-R BS.1770) |
| `lufsInterleaved(samples, channels, sampleRate?)` | `LufsResult` | Channel-weighted multichannel loudness from interleaved samples |
| `ebur128LoudnessRange(samples, sampleRate?)` | `number` | Standards-compliant EBU R128 loudness range (LRA) in LU |
| `momentaryLufs(samples, sampleRate?)` | `Float32Array` | Momentary loudness (400 ms) per step |
| `shortTermLufs(samples, sampleRate?)` | `Float32Array` | Short-term loudness (3 s) per step |
| `version()` | `string` | Library version |
| `voiceChangerAbiVersion()` | `number` | ABI version of the realtime voice-changer POD config; separate from preset JSON `schemaVersion` |
| `voiceCharacterPresetId(preset)` | `VoicePresetId \| null` | Canonical voice-character preset ID for an ordinal or ID |
| `realtimeVoiceChangerPresetConfig(preset)` | `RealtimeVoiceChangerConfig \| null` | Resolved flat POD config for a built-in voice preset, without JSON parsing |
| `hasFfmpegSupport()` | `boolean` | Whether the loaded native addon can decode via FFmpeg |

Default sample rates differ by helper family:

| Helper family | Default `sampleRate` |
|---------------|----------------------|
| Music analysis, effects, feature, and loudness helpers | `22050` |
| `analyzeImpulseResponse`, `detectAcoustic`, `estimateRoom`, and `synthesizeRir` in the native wrapper | `48000` |

Common helpers are also available as `Audio` instance methods, as noted in the `Audio` section.

The tables below document the Node native wrapper. The WASM package uses the same camelCase names, but functions with a required argument after `sampleRate` require that `sampleRate` position to be supplied. See [JavaScript API](./js-api.md) for the browser signatures.

##### Asynchronous variants (Node only)

The Node addon also exposes Promise-returning variants. They run the DSP pipeline on a libuv worker thread, so the JS event loop is not blocked.

These functions resolve with the same shape as their synchronous counterparts. They are Node-native-only; the WASM build has no worker-thread equivalent.

Progress callbacks are not available on the async path. If you need progress updates, use the synchronous call with `onProgress`. If you only need concurrency, run several async calls in parallel.

| Function | Return Type | Description |
|----------|-------------|-------------|
| `analyzeAsync(samples, sampleRate?)` | `Promise<AnalysisResult>` | Async variant of `analyze(...)` |
| `masterAudioAsync(samples, sampleRate?, presetName?, overrides?)` | `Promise<MasteringChainResult>` | Async variant of `masterAudio(...)` |
| `masterAudioStereoAsync(left, right, sampleRate?, presetName?, overrides?)` | `Promise<MasteringChainStereoResult>` | Async variant of `masterAudioStereo(...)` |

#### Effects Functions

| Function | Return Type | Description |
|----------|-------------|-------------|
| `hpss(samples, sr?, kernelHarmonic?, kernelPercussive?)` | `HpssResult` | Harmonic-Percussive Source Separation |
| `hpssWithResidual(samples, sr?, kernelHarmonic?, kernelPercussive?)` | `HpssWithResidualResult` | HPSS with harmonic, percussive, and residual outputs |
| `harmonic(samples, sr?)` | `Float32Array` | Extract harmonic component |
| `percussive(samples, sr?)` | `Float32Array` | Extract percussive component |
| `timeStretch(samples, rate, sr?)` | `Float32Array` | Time-stretch without pitch change |
| `phaseVocoder(samples, rate, sr?, nFft?, hopLength?)` | `Float32Array` | Direct phase-vocoder time scaling |
| `pitchShift(samples, semitones, sr?)` | `Float32Array` | Pitch-shift without tempo change |
| `remix(samples, intervals, sr?, alignZeros?)` | `Float32Array` | Reorder or concatenate sample intervals |
| `normalize(samples, sr?, targetDb?)` | `Float32Array` | Normalize to target dB (default: 0.0) |
| `trim(samples, sr?, thresholdDb?)` | `Float32Array` | Trim silence (default: -60.0 dB) |
| `resample(samples, srcSr, targetSr)` | `Float32Array` | Resample to target sample rate |
| `pitchCorrectToMidi(samples, sr, currentMidi, targetMidi)` | `Float32Array` | Retune a held note from one MIDI pitch to another |
| `noteStretch(samples, sr?, options?)` | `Float32Array` | Time-stretch a single note span in place; `options` is `{ onsetSample, offsetSample, stretchRatio }` |
| `voiceChange(samples, sr?, options?)` | `Float32Array` | Pitch + formant shift for voice transformation; `options` is `{ pitchSemitones, formantFactor }` |

`trim(...)` is the simple threshold edit helper. `trimSilence(...)` below is
the librosa-compatible frame/RMS helper that returns the original sample range.

#### Feature Extraction Functions

| Function | Return Type | Description |
|----------|-------------|-------------|
| `stft(samples, sr?, nFft?, hopLength?)` | `StftResult` | Short-Time Fourier Transform |
| `stftDb(samples, sr?, nFft?, hopLength?)` | `StftDbResult` | STFT in decibels |
| `melSpectrogram(samples, sr?, nFft?, hopLength?, nMels?)` | `MelSpectrogramResult` | Mel spectrogram |
| `mfcc(samples, sr?, nFft?, hopLength?, nMels?, nMfcc?)` | `MfccResult` | Mel-Frequency Cepstral Coefficients |
| `chroma(samples, sr?, nFft?, hopLength?)` | `ChromaResult` | Chroma features |
| `spectralCentroid(samples, sr?, nFft?, hopLength?)` | `Float32Array` | Spectral centroid per frame |
| `spectralBandwidth(samples, sr?, nFft?, hopLength?)` | `Float32Array` | Spectral bandwidth per frame |
| `spectralRolloff(samples, sr?, nFft?, hopLength?, rollPercent?)` | `Float32Array` | Spectral rolloff per frame |
| `spectralFlatness(samples, sr?, nFft?, hopLength?)` | `Float32Array` | Spectral flatness per frame |
| `spectralContrast(samples, sr?, nFft?, hopLength?, nBands?, fmin?, quantile?)` | `Matrix2dResult` | Spectral contrast, shape `(nBands + 1) x nFrames` |
| `polyFeatures(samples, sr?, nFft?, hopLength?, order?)` | `Matrix2dResult` | Per-frame polynomial spectral coefficients |
| `zeroCrossingRate(samples, sr?, frameLength?, hopLength?)` | `Float32Array` | Zero-crossing rate per frame |
| `zeroCrossings(samples, threshold?, refMagnitude?, pad?, zeroPos?)` | `Int32Array` | Zero-crossing sample indices |
| `rmsEnergy(samples, sr?, frameLength?, hopLength?)` | `Float32Array` | RMS energy per frame |
| `pitchYin(samples, sr?, frameLength?, hopLength?, fmin?, fmax?, threshold?, fillNa?)` | `PitchResult` | YIN pitch estimation; unvoiced `f0` stays `NaN` unless `fillNa` is true |
| `pitchPyin(samples, sr?, frameLength?, hopLength?, fmin?, fmax?, threshold?, fillNa?)` | `PitchResult` | pYIN pitch estimation; unvoiced `f0` stays `NaN` unless `fillNa` is true |
| `pitchTuning(frequencies, resolution?, binsPerOctave?)` | `number` | Tuning offset from frequencies |
| `estimateTuning(samples, sr?, nFft?, hopLength?, resolution?, binsPerOctave?)` | `number` | Tuning offset from audio |
| `cqt(samples, sr?, hopLength?, fmin?, nBins?, binsPerOctave?)` | `CqtResult` | Constant-Q transform magnitude |
| `vqt(samples, sr?, hopLength?, fmin?, nBins?, binsPerOctave?, gamma?)` | `CqtResult` | Variable-Q transform magnitude (`gamma` controls Q) |
| `nnlsChroma(samples, sr?)` | `{ nChroma, nFrames, data }` | NNLS chromagram (note-activation chroma) |
| `decompose(s, nFeatures, nFrames, nComponents, nIter?, beta?)` | `DecomposeResult` | NMF factor matrices from a row-major spectrogram |
| `nnFilter(s, nFeatures, nFrames, aggregate?, k?, width?)` | `Matrix2dResult` | Nearest-neighbor filtering |
| `onsetEnvelope(samples, sr?, nFft?, hopLength?, nMels?)` | `Float32Array` | Onset strength envelope (the input to the tempogram family) |

Default parameters: `nFft=2048`, `hopLength=512`, `nMels=128`, `nMfcc=20`, pitch `fmin=65.0`, `fmax=2093.0`, `threshold=0.3`, `rollPercent=0.85`. CQT/VQT use `fmin=32.70319566` Hz (C1), `nBins=84`, and `binsPerOctave=12`.

#### Inverse Reconstruction Functions

Reconstruct a spectrum or audio from a mel spectrogram or MFCC matrix. Phase is estimated with Griffin-Lim, so the round-trip is lossy — see [Inverse Features](./inverse-features.md).

| Function | Return Type | Description |
|----------|-------------|-------------|
| `melToStft(mel, nMels, nFrames, sampleRate?, nFft?, fmin?, fmax?, htk?)` | `InverseStftResult` | Linear STFT power from a mel spectrogram |
| `melToAudio(mel, nMels, nFrames, sr?, nFft?, hopLength?, nIter?, fmin?, fmax?)` | `Float32Array` | Audio from a mel spectrogram (Griffin-Lim) |
| `mfccToMel(mfcc, nMfcc, nFrames, nMels?)` | `InverseMelResult` | Mel spectrogram from MFCC coefficients |
| `mfccToAudio(mfcc, nMfcc, nFrames, nMels?, sampleRate?, nFft?, hopLength?, fmin?, fmax?, nIter?, htk?)` | `Float32Array` | Audio from MFCC coefficients |

#### librosa-Compatible Helpers

These mirror the corresponding `librosa` functions —
see [librosa Compatibility](./librosa-compatibility.md) for the full mapping.

::: tip What each helper is for
- **`preemphasis` / `deemphasis`** — classic one-tap IIR pre-processing on the waveform.
- **`trimSilence` / `splitSilence`** — trim leading/trailing silence or split on silent gaps.
- **`frameSignal` / `padCenter` / `fixLength` / `fixFrames`** — framing and size-alignment utilities for fixed-frame DSP.
- **`peakPick` / `vectorNormalize`** — peak detection on 1-D signals and vector-norm normalization.
- **`pcen`** — dynamic range compression for mel spectrograms.
- **`tonnetz`** — projects chroma into a 6-D harmonic space.
- **`tempogram` / `plp`** — time-varying tempo representation and dominant local pulse.
:::

| Function | Return Type | Description |
|----------|-------------|-------------|
| `preemphasis(samples, coef?, zi?)` | `Float32Array` | Pre-emphasis filter |
| `deemphasis(samples, coef?, zi?)` | `Float32Array` | Inverse pre-emphasis |
| `trimSilence(samples, topDb?, frameLength?, hopLength?)` | `{ audio: Float32Array; startSample: number; endSample: number }` | `librosa.effects.trim`, distinct from threshold `trim(...)` |
| `splitSilence(samples, topDb?, frameLength?, hopLength?)` | `Int32Array` | `librosa.effects.split` — flat `[start0, end0, start1, end1, ...]` |
| `frameSignal(samples, frameLength, hopLength)` | `{ nFrames: number; frames: Float32Array }` | `librosa.util.frame` (row-major) |
| `padCenter(values, targetSize, padValue?)` | `Float32Array` | `librosa.util.pad_center` |
| `fixLength(values, targetSize, padValue?)` | `Float32Array` | `librosa.util.fix_length` |
| `fixFrames(frames, xMin?, xMax?, pad?)` | `Int32Array` | `librosa.util.fix_frames` |
| `peakPick(values, preMax, postMax, preAvg, postAvg, delta, wait)` | `Int32Array` | `librosa.util.peak_pick` |
| `vectorNormalize(values, normType?, threshold?)` | `Float32Array` | `librosa.util.normalize`. `normType`: 0=inf, 1=L1, 2=L2, 3=power. The Node wrapper defaults `threshold` to `0.0`; WASM defaults it to `1e-12` |
| `pcen(values, nBins, nFrames, options?)` | `Float32Array` | `librosa.pcen` (row-major mel input) |
| `tonnetz(chromagram, nChroma, nFrames)` | `Float32Array` | `librosa.feature.tonnetz` (`[6 x nFrames]`) |
| `tempogram(onsetEnvelope, sr?, hopLength?, winLength?, mode?)` | `{ nFrames: number; winLength: number; data: Float32Array }` | `librosa.feature.tempogram`; `mode` is `'autocorrelation'` (default) or `'cosine'` |
| `fourierTempogram(onsetEnvelope, sr?, hopLength?, winLength?)` | `{ nBins: number; nFrames: number; data: Float32Array }` | `librosa.feature.fourier_tempogram` |
| `cyclicTempogram(onsetEnvelope, sr, hopLength?, winLength?, bpmMin?, nBins?)` | `{ nFrames: number; nBins: number; data: Float32Array }` | Cyclic (tempo-octave-invariant) tempogram |
| `tempogramRatio(tempogramData, winLength?, sr?, hopLength?)` | `Float32Array` | `librosa.feature.tempogram_ratio` |
| `plp(onsetEnvelope, sr?, hopLength?, tempoMin?, tempoMax?, winLength?)` | `Float32Array` | `librosa.beat.plp` |

#### Conversion Functions

| Function | Description |
|----------|-------------|
| `hzToMel(hz)` | Hertz → Mel scale |
| `melToHz(mel)` | Mel scale → Hertz |
| `hzToMidi(hz)` | Hertz → MIDI note number |
| `midiToHz(midi)` | MIDI note number → Hertz |
| `hzToNote(hz)` | Hertz → note name (e.g., "A4") |
| `noteToHz(note)` | Note name → Hertz |
| `framesToTime(frames, sr?, hopLength?)` | Frame index → seconds (`sr` default `22050`, `hopLength` default `512`) |
| `timeToFrames(time, sr?, hopLength?)` | Seconds → frame index (`sr` default `22050`, `hopLength` default `512`) |
| `framesToSamples(frames, hopLength?, nFft?)` | Frame index → sample index (`librosa.frames_to_samples`) |
| `samplesToFrames(samples, hopLength?, nFft?)` | Sample index → frame index (`librosa.samples_to_frames`) |
| `powerToDb(values, ref?, amin?, topDb?)` | Power → dB (`librosa.power_to_db`) |
| `amplitudeToDb(values, ref?, amin?, topDb?)` | Amplitude → dB (`librosa.amplitude_to_db`) |
| `dbToPower(values, ref?)` | dB → power |
| `dbToAmplitude(values, ref?)` | dB → amplitude |

#### Metering Functions

Standalone level, dynamics, and stereo-image meters. Each accepts an optional `options` object with a `validate` flag (default `true`); pass `{ validate: false }` to skip NaN/Inf input checks on hot paths. The stereo meters require `left` and `right` to be equal length.

| Function | Return Type | Description |
|----------|-------------|-------------|
| `meteringPeakDb(samples, sr?, options?)` | `number` | Sample peak (dBFS) |
| `meteringRmsDb(samples, sr?, options?)` | `number` | RMS level (dBFS) |
| `meteringCrestFactorDb(samples, sr?, options?)` | `number` | Crest factor, peak − RMS (dB) |
| `meteringDcOffset(samples, sr?, options?)` | `number` | Mean (DC) offset, linear amplitude |
| `meteringTruePeakDb(samples, sr?, oversampleFactor?, options?)` | `number` | Inter-sample (true) peak (dBFS); `oversampleFactor` is a power of two in 1..16 (default 4) |
| `meteringDetectClipping(samples, sr?, options?)` | `ClippingReport` | Clipped-sample runs; `options` adds `threshold` (default `0.999`) and `minRegionSamples` (default `1`) |
| `meteringDynamicRange(samples, sr?, options?)` | `DynamicRangeReport` | Sliding-window dynamic range; `options` adds `windowSec`, `hopSec`, `lowPercentile`, `highPercentile` (omit for defaults: window 3 s, hop 1 s, low 0.10, high 0.95) |
| `meteringStereoCorrelation(left, right, sr?, options?)` | `number` | Pearson correlation, −1..1 |
| `meteringStereoWidth(left, right, sr?, options?)` | `number` | Mid/side stereo width |
| `meteringVectorscope(left, right, sr?, options?)` | `VectorscopeReport` | Per-sample mid/side point series |
| `meteringPhaseScope(left, right, sr?, options?)` | `PhaseScopeReport` | Phase-scope point series plus summary stats |
| `meteringSpectrum(samples, sr?, options?)` | `SpectrumReport` | Single-frame magnitude/power/dB spectrum; `options` adds `nFft`, `applyOctaveSmoothing`, `octaveFraction`, `dbRef`, `dbAmin` |

#### Scale Quantization

12-TET scale helpers for building pitch-correction targets. `modeMask` is a 12-bit mask where bit *i* enables the *i*-th pitch class relative to `root` (`PitchClass`, C = 0); natural major is `0b101010110101`. `referenceMidi` is the tuning anchor (pass `0` for A4 = 69). Pair with `pitchCorrectToMidi(...)` to retune to the nearest scale degree.

| Function | Return Type | Description |
|----------|-------------|-------------|
| `scaleQuantizeMidi(root, modeMask, midi, referenceMidi?)` | `number` | Snap a (fractional) MIDI number to the nearest enabled pitch class |
| `scaleCorrectionSemitones(root, modeMask, midi, referenceMidi?)` | `number` | Correction (quantized − input), in semitones |
| `scalePitchClassEnabled(root, modeMask, pitchClass)` | `boolean` | Whether `pitchClass` (0..11) is enabled relative to `root` |

#### Streaming and Realtime Classes

Beyond the one-shot functions, the native addon exposes the same streaming and realtime classes as the WASM build:

| Class | Purpose |
|-------|---------|
| `StreamAnalyzer` | Block-by-block analysis with progressive BPM/key estimates and `readFramesSoa`/`readFramesI16`/`readFramesU8`. See [Realtime Streaming](./realtime-streaming.md). |
| `StreamingEqualizer` | Real-time-safe block EQ. |
| `StreamingMasteringChain` | Incremental mastering render (documented above). |
| `RealtimeVoiceChanger` | Preset-driven live voice chain for block processing. |
| `Mixer` | Persistent multi-strip mixer from a JSON scene. See [Mixing Engine](./mixing.md). |
| `RealtimeEngine` | Transport/clip/automation engine for DAW-style hosting. |

```typescript
import { StreamAnalyzer } from '@libraz/libsonare-native';

const analyzer = new StreamAnalyzer({ sampleRate: 48000, computeMel: true, computeOnset: true });
analyzer.process(block);                 // feed a Float32Array block
const frames = analyzer.readFramesSoa(analyzer.availableFrames());
const stats = analyzer.stats();          // stats.estimate.bpm / .key (PitchClass int)
```

Node native names the float Structure-of-Arrays read `readFramesSoa(...)`. The WASM wrapper exposes the same operation as `readFrames(...)` for browser examples.

`RealtimeVoiceChanger` in Node native is constructed with `{ sampleRate, maxBlockSize, channels, preset }`, then used with `processMono(...)`, `processMonoInto(...)`, `processInterleaved(...)`, or `processPlanarStereo(...)`. For offline convenience, `voiceChangeRealtime(...)` runs a whole mono buffer through the same preset chain in 512-sample blocks.

```typescript
import {
  RealtimeVoiceChanger,
  realtimeVoiceChangerPresetConfig,
  realtimeVoiceChangerPresetNames,
  voiceCharacterPresetId,
  voiceChangeRealtime,
} from '@libraz/libsonare-native';

const changer = new RealtimeVoiceChanger({
  sampleRate: 48000,
  maxBlockSize: 128,
  channels: 1,
  preset: 'bright-idol',
});

const blockOut = changer.processMono(inputBlock);
const rendered = voiceChangeRealtime(vocal, 48000, 'soft-whisper');
const presetConfig = realtimeVoiceChangerPresetConfig('bright-idol');
console.log(
  voiceCharacterPresetId(1),
  realtimeVoiceChangerPresetNames(),
  presetConfig,
  changer.latencySamples(),
  blockOut,
  rendered,
);
changer.destroy();
```

`RealtimeEngine` is shared at the class level, but a few wrapper details differ.

| Detail | WASM | Node native |
|--------|------|-------------|
| Capability check | Adds `engineCapabilities()` and checks ABI compatibility before construction | Exposes `engineAbiVersion()` but not the browser capability helper |
| Capture buffer setup | `setCaptureBuffer(numChannels, capacityFrames)` | `setCaptureBuffer(channels)` with preallocated channel buffers |

#### Types

```typescript
interface Key {
  root: string;        // Pitch-class name, e.g. "C", "C#", "A"
  mode: string;        // Mode name, e.g. "major", "minor"
  confidence: number;
  name: string;        // "C major", "A minor"
  shortName: string;   // "C", "Am"
}

interface TimeSignature {
  numerator: number;
  denominator: number;
  confidence: number;
}

interface AnalysisResult {
  bpm: number;
  bpmConfidence: number;
  key: Key;
  timeSignature: TimeSignature;
  beatTimes: Float32Array;                       // Derived from beats[].time
  beats: Array<{ time: number; strength: number }>;
  chords: AnalysisChord[];                       // Detected chord progression
  sections: AnalysisSection[];                   // Song-structure sections
  timbre: AnalysisTimbre;                        // Aggregate timbre summary
  dynamics: AnalysisDynamics;                    // Aggregate dynamics summary
  rhythm: AnalysisRhythm;                        // Aggregate rhythm summary
  melody: AnalysisMelody;                        // Melody-contour summary
  form: string;                                  // Musical form label, e.g. "AABA"
}
// analyze() returns the full result above. The dedicated detect*/analyze*
// functions remain available for targeted or parameterized analysis.

interface HpssResult {
  harmonic: Float32Array;
  percussive: Float32Array;
  sampleRate: number;
}

interface StftResult {
  nBins: number;
  nFrames: number;
  nFft: number;
  hopLength: number;
  sampleRate: number;
  magnitude: Float32Array;  // nBins × nFrames, row-major
  power: Float32Array;      // nBins × nFrames, row-major
}

interface StftDbResult {
  nBins: number;
  nFrames: number;
  db: Float32Array;         // Power in decibels
}

interface MelSpectrogramResult {
  nMels: number;
  nFrames: number;
  sampleRate: number;
  hopLength: number;
  power: Float32Array;      // nMels × nFrames, row-major
  db: Float32Array;         // nMels × nFrames, row-major
}

interface MfccResult {
  nMfcc: number;
  nFrames: number;
  coefficients: Float32Array;  // nMfcc × nFrames, row-major
}

interface ChromaResult {
  nChroma: number;
  nFrames: number;
  sampleRate: number;
  hopLength: number;
  features: Float32Array;   // nChroma × nFrames, row-major
  meanEnergy: number[];     // nChroma values
}

interface PitchResult {
  f0: Float32Array;         // Fundamental frequency per frame (Hz)
  voicedProb: Float32Array; // Voicing probability per frame (0–1)
  voicedFlag: boolean[];    // Voiced/unvoiced decision per frame
  nFrames: number;
  medianF0: number;
  meanF0: number;
}
```

The native package also exports TypeScript helper types for option objects, callbacks, streaming snapshots, and realtime engine messages. Use these names when annotating application code instead of re-declaring the shapes locally.

| Area | Exported types |
|------|----------------|
| Analysis options/results | `AnalysisProgressCallback`, `BpmCandidate`, `ChordChromaMethod`, `KeyMode`, `KeyProfile`, `MelodyPoint`, `SectionTypeOrdinal`, `TempogramMode`, `TrimSilenceMode` |
| Streaming analysis | `StreamAnalyzerConfig`, `StreamAnalyzerStats`, `StreamFramesSoa`, `StreamProgressiveEstimate`, `StreamChordChange`, `StreamBarChord`, `StreamPatternScore` |
| Mastering and metering | `MasteringPreset`, `SoloProcessor`, `StreamingPlatform`, `DynamicsProcessorResult`, `CompressorDetector`, `DecrackleMode`, `DenoiseClassicalMode`, `DenoiseClassicalNoiseEstimator`, `EqBandInput`, `EqPhaseMode`, `EqSpectrumSnapshot` |
| Mixing | `AutomationCurve`, `GoniometerPoint`, `MeterTap`, `MixMeterSnapshot`, `MixResult`, `MixerProcessResult`, `PanLaw`, `PanMode`, `SendTiming` |
| Realtime voice | `VoicePresetId`, `RealtimeVoiceChangerConfigInput`, `RealtimeVoiceChangerConfig`, `RealtimeVoiceChangerOptions` |
| Realtime engine graph | `EngineGraphSpec`, `EngineGraphNode`, `EngineGraphNodeType`, `EngineGraphConnection`, `EngineGraphMix`, `EngineGraphParameterBinding`, `EngineParameterInfo` |
| Realtime engine transport | `EngineTransportState`, `EngineMarker`, `EngineClip`, `EngineAutomationPoint`, `EngineAutomationPointCurve`, `EngineMetronomeConfig` |
| Realtime engine jobs/telemetry | `EngineBounceOptions`, `EngineBounceResult`, `EngineFreezeOptions`, `EngineFreezeResult`, `EngineCaptureStatus`, `EngineTelemetry`, `EngineTelemetryType`, `EngineTelemetryError`, `EngineMeterTelemetry` |
