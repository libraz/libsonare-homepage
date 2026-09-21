# Node.js Native API

For the conceptual overview and when to choose the Node native binding, see [Node.js Native](./native-bindings.md).

This page is the function-by-function reference for the `@libraz/libsonare-native` addon. Examples use the native package unless an import path is explicitly `@libraz/libsonare`.

## Usage

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

// All-in-one analysis
const result = analyze(samples, sampleRate);
console.log(`BPM: ${result.bpm}`);
console.log(`Key: ${result.key.name}`);     // "C major"
console.log(`Beats: ${result.beatTimes.length}`);
```

Every analyzer above reads from the same shared spectrogram — the transform this demo walks through, and the reason asking for BPM and key together costs barely more than asking for one.

<SonareDemo id="stft-basics" />

### Audio Effects

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

### Feature Extraction

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

### Unit Conversions

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

## API Reference

This reference is split across three pages. This page covers one-shot request objects, errors, the `Audio` class, cleanup, inverse reconstruction, librosa-compatible helpers, conversions, metering, mastering analysis, scale quantization, and the streaming/realtime classes. Analysis, effects, and feature-extraction functions live on [Node.js Native Analysis and Effects](./node-api-analysis.md); type definitions live on [Node.js Native Types](./node-api-types.md).

### One-shot request objects

Top-level one-shot analysis, effects, mastering, metering, feature, mixer, and voice-changer functions use a named request object as their canonical Node call form. Positional overloads remain compatible and normalize to the same validation, defaults, results, errors, and progress behavior.

```ts
const bpm = detectBpm({ samples, sampleRate });
const result = masterAudio({ samples, sampleRate, preset: 'pop' });
```

The corresponding `*Request` TypeScript types are exported from the package.

### Errors

Library failures arrive as `SonareError` — a standard `Error` whose `name` is
`'SonareError'`, augmented with a numeric `code` (an `ErrorCode` value) and its
canonical `codeName`, for example `'InvalidParameter'`.

`SonareError` is a runtime class, not a type-only declaration, so importing the
name by value gives a real binding on this package and on the WASM one alike: a
shared TypeScript module can import it from either surface and get the same kind
of thing at run time.

`instanceof SonareError` is brand-based rather than prototype-based — it checks
the shape. That means it narrows an error raised by the addon, which carries the
shape but never constructs the class, and one that lost its prototype crossing a
worker or `structuredClone` boundary. `isSonareError(value)` is the same check
written as a type guard, and the two are wired to each other so they never
disagree; either one is fine.

```typescript
import { Audio, ErrorCode, isSonareError } from '@libraz/libsonare-native';

try {
  const audio = Audio.fromFile('missing.wav');
  audio.destroy();
} catch (err) {
  if (isSonareError(err)) {
    console.error(err.codeName, err.code === ErrorCode.FileNotFound);
  }
}
```

Argument-shape problems caught before the call reaches the library — two arrays
of unequal length, a `mode` that is not one of the accepted strings — are raised
as plain `RangeError` or `TypeError`, which `isSonareError` does not match.

### Audio

| Method | Description |
|--------|-------------|
| `Audio.fromFile(path)` | Load WAV/MP3 from disk; also FFmpeg-supported formats when built with FFmpeg |
| `Audio.fileChannelCount(path)` | Channel count of the source file, read without decoding; distinct from `fromFile`, which downmixes to mono |
| `Audio.fromBuffer(samples, sampleRate?)` | Create from `Float32Array`; `sampleRate` defaults to `48000` |
| `Audio.fromMemory(data)` | Decode encoded audio bytes with the same format support as `fromFile` |
| `audio.getData()` | Copy of the samples as a `Float32Array` |
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

::: warning `getData()` hands back a copy
Each call allocates a fresh `Float32Array`, so writing into the returned array
does not edit the audio the instance holds — a later `audio.detectBpm()` or
`audio.masteringChain(...)` still reads the original samples. To process edited
samples, build a new instance with `Audio.fromBuffer(edited, sampleRate)`. Cache
the array yourself if you read it in a loop. The same applies on WASM.
:::

### Cleanup with `using` (Node 22+)

Every native handle class — `Audio`, `RealtimeEngine`, `Project`, `Mixer`, and
`ClipPageProvider` — implements `[Symbol.dispose]`, so on Node 22+ you can use
the `using` keyword for automatic, throw-safe cleanup at scope exit:

```typescript
import { RealtimeEngine } from '@libraz/libsonare-native';

function render() {
  using engine = new RealtimeEngine(48000, 128);
  engine.setTempo(120);
  // ... the handle is released when this scope ends, even on an exception.
}
```

On Node versions below 22, keep the explicit-release pattern in a `try/finally`.
`destroy()` is the canonical native release method on every handle class;
`Project` and `Mixer` also expose `delete()` as a WASM-compatible alias. GC also
reclaims handles eventually, but `using`/explicit release gives deterministic
cleanup that long-lived processes should prefer.

`RealtimeVoiceChanger` also implements `[Symbol.dispose]` alongside an explicit
`destroy()`, so it supports `using` as well. `StreamingMasteringChain`,
`StreamingEqualizer`, and `StreamAnalyzer` likewise expose idempotent
`destroy()` and `[Symbol.dispose]` for deterministic release.

### Inverse Reconstruction Functions

Reconstruct a spectrum or audio from a mel spectrogram or MFCC matrix. Phase is estimated with Griffin-Lim, so the round-trip is lossy — see [Inverse Features](./inverse-features.md).

| Function | Return Type | Description |
|----------|-------------|-------------|
| `melToStft(mel, nMels, nFrames, sampleRate?, nFft?, fmin?, fmax?, htk?)` | `InverseStftResult` | Linear STFT power from a mel spectrogram |
| `melToAudio(mel, nMels, nFrames, sr?, nFft?, hopLength?, fmin?, fmax?, nIter?, htk?)` | `Float32Array` | Audio from a mel spectrogram (Griffin-Lim) |
| `mfccToMel(mfcc, nMfcc, nFrames, nMels?, lifter?)` | `InverseMelResult` | Mel spectrogram from MFCC coefficients |
| `mfccToAudio(mfcc, nMfcc, nFrames, nMels?, sampleRate?, nFft?, hopLength?, fmin?, fmax?, nIter?, htk?)` | `Float32Array` | Audio from MFCC coefficients |
| `cqtToAudio(magnitude, nBins, nFrames, sampleRate?, hopLength?, fmin?, binsPerOctave?, nIter?)` | `Float32Array` | Audio from a row-major CQT magnitude matrix (Griffin-Lim) |
| `vqtToAudio(magnitude, nBins, nFrames, sampleRate?, hopLength?, fmin?, binsPerOctave?, gamma?, nIter?)` | `Float32Array` | Audio from a row-major VQT magnitude matrix (Griffin-Lim) |

### librosa-Compatible Helpers

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
| `splitSilenceCommon(request)` | `Int32Array` | The cut points several takes of one part agree are silent. `request`: `signals`, `topDb`, `frameLength`, `hopLength`. Same flat layout; takes of unequal length need no padding |
| `frameSignal(samples, frameLength, hopLength)` | `{ nFrames: number; frames: Float32Array }` | `librosa.util.frame` (row-major) |
| `padCenter(values, targetSize, padValue?)` | `Float32Array` | `librosa.util.pad_center` |
| `fixLength(values, targetSize, padValue?)` | `Float32Array` | `librosa.util.fix_length` |
| `fixFrames(frames, xMin?, xMax?, pad?)` | `Int32Array` | `librosa.util.fix_frames` |
| `peakPick(values, preMax, postMax, preAvg, postAvg, delta, wait)` | `Int32Array` | `librosa.util.peak_pick` |
| `vectorNormalize(values, normType?, threshold?)` | `Float32Array` | `librosa.util.normalize`. `normType`: 0=inf, 1=L1, 2=L2, 3=power. Node native defaults `threshold` to `0.0`; WASM defaults it to `1e-12` |
| `pcen(values, nBins, nFrames, options?)` | `Float32Array` | `librosa.pcen` (row-major mel input) |
| `tonnetz(chromagram, nChroma, nFrames)` | `Float32Array` | `librosa.feature.tonnetz` (`[6 x nFrames]`) |
| `tempogram(onsetEnvelope, sr?, hopLength?, winLength?, mode?)` | `{ nFrames: number; winLength: number; data: Float32Array }` | `librosa.feature.tempogram`; `mode` is `'autocorrelation'` (default) or `'cosine'` |
| `fourierTempogram(onsetEnvelope, sr?, hopLength?, winLength?)` | `{ nBins: number; nFrames: number; data: Float32Array }` | `librosa.feature.fourier_tempogram` |
| `cyclicTempogram(onsetEnvelope, sr?, hopLength?, winLength?, center?, norm?, bpmMin?, nBins?)` | `{ nFrames: number; nBins: number; data: Float32Array }` | Cyclic (tempo-octave-invariant) tempogram |
| `tempogramRatio(tempogramData, winLength?, sr?, hopLength?, factors?)` | `Float32Array` | `librosa.feature.tempogram_ratio`; factors default to `[0.5, 1, 2, 3, 4]` |
| `plp(onsetEnvelope, sr?, hopLength?, tempoMin?, tempoMax?, winLength?)` | `Float32Array` | `librosa.beat.plp` |

### Conversion Functions

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

### Metering Functions

Standalone level, dynamics, and stereo-image meters. Each accepts an optional `options` object with a `validate` flag (default `true`); pass `{ validate: false }` to skip NaN/Inf input checks on hot paths. The stereo meters require `left` and `right` to be equal length.

| Function | Return Type | Description |
|----------|-------------|-------------|
| `meteringPeakDb(samples, sr?, options?)` | `number` | Sample peak (dBFS) |
| `meteringRmsDb(samples, sr?, options?)` | `number` | RMS level (dBFS) |
| `meteringCrestFactorDb(samples, sr?, options?)` | `number` | Crest factor, peak − RMS (dB). A high value means peaks stand far above the average level, so the signal is uncompressed |
| `meteringCrestFactorDbStereo(request)` | `number` | Crest factor over a channel pair (dB): peak across both channels, RMS over the two together. Request-only — takes `MeteringStereoRequest` (`{ left, right, sampleRate?, validate? }`) and has no positional overload |
| `meteringDcOffset(samples, sr?, options?)` | `number` | Mean (DC) offset, linear amplitude |
| `meteringTruePeakDb(samples, sr?, oversampleFactor?, options?)` | `number` | Inter-sample peak, ISP — the highest level the waveform reaches *between* samples, also called true peak (dBFS); `oversampleFactor` is a power of two in 1..16 (default 4) |
| `meteringDetectClipping(samples, sr?, options?)` | `ClippingReport` | Clipped-sample runs; `options` adds `threshold` (default `0.999`) and `minRegionSamples` (default `1`) |
| `meteringDynamicRange(samples, sr?, options?)` | `DynamicRangeReport` | Sliding-window dynamic range; `options` adds `windowSec`, `hopSec`, `lowPercentile`, `highPercentile` (omit for defaults: window 3 s, hop 1 s, low 0.10, high 0.95) |
| `meteringStereoCorrelation(left, right, sr?, options?)` | `number` | Uncentered correlation (cosine similarity), −1..1 |
| `meteringStereoWidth(left, right, sr?, options?)` | `number` | Side/mid energy ratio: 0 = mono, ~1 = wide stereo; unbounded (`Infinity` when mid is silent) |
| `meteringVectorscope(left, right, sr?, options?)` | `VectorscopeReport` | Per-sample mid/side point series |
| `meteringPhaseScope(left, right, sr?, options?)` | `PhaseScopeReport` | Phase-scope point series plus summary stats |
| `meteringSpectrum(samples, sr?, options?)` | `SpectrumReport` | Welch-averaged magnitude/power/dB spectrum over the whole signal (50%-overlapping Hann frames, averaged); `options` adds `nFft`, `applyOctaveSmoothing`, `octaveFraction`, `dbRef`, `dbAmin` |
| `meteringSpectrumFrame(samples, sr?, frameOffset?, options?)` | `SpectrumReport` | True single-frame magnitude/power/dB spectrum (one Hann-windowed FFT), not time-averaged like `meteringSpectrum`; `frameOffset` selects where the analysis frame starts |
| `meteringSilenceRatio(samples, sr?, thresholdDb?, frameLength?, hopLength?, options?)` | `number` | Fraction of analysis frames whose RMS is below `thresholdDb` (defaults: `-45` dBFS, `frameLength=1024`, `hopLength=256`) |
| `waveformPeaks(samples, channels, options?)` | `WaveformPeaksReport` | Per-channel min/max waveform buckets from interleaved audio; `options.samplesPerBucket` defaults to `512` |
| `waveformPeakPyramid(samples, channels, options?)` | `WaveformPeaksReport[]` | Waveform peak buckets at several zoom levels; `options.samplesPerBucketLevels` defaults to `[512, 1024, 2048, 4096]` |

Reach for `meteringCrestFactorDbStereo(...)` whenever the two channels may be out of phase. An inverted pair cancels in the `0.5 * (left + right)` downmix `meteringCrestFactorDb(...)` would need, which understates RMS and so overstates crest factor: on a fully inverted pair the stereo meter reads 11.64 dB while the downmix path reads 0.00 dB.

### Mastering Analysis Functions

The explainable-mastering helpers return JSON strings; see [Mastering Assistant](./mastering-assistant.md) for their exact shapes. Each stereo entry point below is request-only — it takes a single request object and has no positional overload, so a positional call throws.

| Function | Return Type | Description |
|----------|-------------|-------------|
| `masteringAudioProfileStereo(request)` | `string` | Mastering-assistant profile of a channel pair, as JSON. Takes `MasteringAudioProfileStereoRequest` |
| `masteringAssistantSuggestStereo(request)` | `string` | Suggested mastering moves for a channel pair, as JSON. Takes `MasteringAssistantSuggestStereoRequest` |
| `masteringStreamingPreviewStereo(request)` | `string` | Delivery-platform loudness preview for a channel pair, as JSON. Takes `MasteringStreamingPreviewStereoRequest`; omitting `platforms` or passing an empty array falls back to the built-in Spotify / Apple Music / YouTube set (three rows) rather than throwing |

```typescript
import { masteringAudioProfileStereo, masteringStreamingPreviewStereo } from '@libraz/libsonare-native';

const profile = JSON.parse(masteringAudioProfileStereo({ left, right, sampleRate }));
const preview = JSON.parse(
  masteringStreamingPreviewStereo({
    left,
    right,
    sampleRate,
    platforms: [{ name: 'Spotify', targetLufs: -14, ceilingDb: -1 }],
  }),
);
```

Use the stereo entry points for anything stereo. The mono helpers measure a `0.5 * (left + right)` downmix, and on decorrelated material that reads about 6 dB low, so the integrated loudness, the normalization gain derived from it, and the ceiling-risk judgement are all under-reported by the same amount. Measured on a decorrelated pink-noise pair (48 kHz, 4 s), the downmix path reported -22.55 LUFS against the stereo path's -16.44 LUFS — a 6.11 dB gap — and Spotify `normalizationGainDb` came out at +8.55 through the downmix versus +2.44 through the stereo path.

Only the `loudness` block of the stereo profile is measured from both channels: integrated LUFS and LRA come from the channel-summed program, and the true peak is the larger of the two. The spectral, dynamics, and tempo fields stay measured on the downmix, so they remain comparable with `masteringAudioProfile`.

::: warning Request-type names differ between the bindings
Node declares two names for the profile and suggest requests — `MasteringAudioProfileStereoRequest` extends `MasteringAssistantSuggestStereoRequest` and adds no fields. The WASM package uses one shared `MasteringStereoParamsRequest` for both. The field set is identical, so only the type name has to change when porting code between the two surfaces.
:::

### Scale Quantization

12-TET (twelve-tone equal temperament) scale helpers for building pitch-correction targets. `modeMask` is a 12-bit mask where bit *i* enables the *i*-th pitch class relative to `root` (`PitchClass`, C = 0); natural major is `0b101010110101`. `referenceMidi` is the tuning anchor (pass `0` for A4 = 69). Pair with `pitchCorrectToMidi(...)` to retune to the nearest scale degree.

| Function | Return Type | Description |
|----------|-------------|-------------|
| `scaleQuantizeMidi(root, modeMask, midi, referenceMidi?)` | `number` | Snap a (fractional) MIDI number to the nearest enabled pitch class |
| `scaleCorrectionSemitones(root, modeMask, midi, referenceMidi?)` | `number` | Correction (quantized − input), in semitones |
| `scalePitchClassEnabled(root, modeMask, pitchClass)` | `boolean` | Whether `pitchClass` (0..11) is enabled relative to `root` |

### Streaming and Realtime Classes

Beyond the one-shot functions, the native addon exposes the same streaming and realtime classes as the WASM build:

| Class | Purpose |
|-------|---------|
| `StreamAnalyzer` | Block-by-block analysis with BPM/key estimates that update over time and `readFramesSoa`/`readFramesI16`/`readFramesU8`. See [Realtime Streaming](./realtime-streaming.md). |
| `StreamingEqualizer` | Real-time-safe block EQ. |
| `StreamingMasteringChain` | Incremental mastering render (documented in [Node.js Native](./native-bindings.md#streamingmasteringchain)). |
| `RealtimeVoiceChanger` | Preset-based live voice chain for block processing. |
| `Mixer` | Persistent multi-strip mixer from a JSON scene. See [Mixing Engine](./mixing.md). |
| `RealtimeEngine` | Transport/clip/automation engine for DAW-style hosting. |

```typescript
import { StreamAnalyzer } from '@libraz/libsonare-native';

const analyzer = new StreamAnalyzer({ sampleRate: 48000, computeMel: true, computeOnset: true });
analyzer.process(block);                 // pass a Float32Array block
const frames = analyzer.readFramesSoa(analyzer.availableFrames());
const stats = analyzer.stats();          // stats.estimate.bpm / .key (PitchClass int)
```

Node native's canonical name for the float Structure-of-Arrays read is `readFramesSoa(...)`; it also exposes `readFrames(...)` as an alias, for naming consistency with the WASM package, which uses `readFrames(...)` for the same operation.

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

`RealtimeEngine` is shared at the class level, but a few runtime details differ.

| Detail | WASM | Node native |
|--------|------|-------------|
| Capability check | Adds `engineCapabilities()` and checks ABI compatibility before construction | Exposes `engineAbiVersion()` but not the browser capability helper |
| Capture buffer setup | `setCaptureBuffer(numChannels, capacityFrames)` — the canonical cross-binding form | Same canonical `setCaptureBuffer(numChannels, capacityFrames)`, plus a `@deprecated` `setCaptureBuffer(channels: Float32Array[])` overload retained for backward compatibility |

`Project.create()` constructs an empty project. Its `setAssistSidecar(...)`
and `assistSidecars()` methods preserve opaque module metadata, while
`ProjectAutomationTargetKind` and `targetKind` classify automation lanes.
`RealtimeEngine.setTrackMonitorMode(laneIndex, mode, renderFrame?)` accepts
`'off'`, `'pfl'` (pre-fader listen), or `'afl'` (after-fader listen), and their
numeric ordinals. Track and mixer pan
law setters accept the `PanLawInput` aliases described below.

## Where the sections went

| Section | Page |
|---------|------|
| Analysis Functions | [Node.js Native Analysis and Effects](./node-api-analysis.md) |
| Effects Functions | [Node.js Native Analysis and Effects](./node-api-analysis.md) |
| Feature Extraction Functions | [Node.js Native Analysis and Effects](./node-api-analysis.md) |
| Types | [Node.js Native Types](./node-api-types.md) |
