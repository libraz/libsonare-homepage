---
title: JavaScript/TypeScript Effects API
description: Audio effects, editing DSP, and room-acoustics measurement and synthesis in the libsonare JavaScript/TypeScript package.
---

# JavaScript/TypeScript Effects API

## Audio Effects

### `hpss(samples, sampleRate, kernelHarmonic?, kernelPercussive?, nFft?, hopLength?, hardMask?)` <Badge type="warning" text="Heavy" />

Harmonic-Percussive Source Separation. Splits audio into tonal (vocals, synths) and transient (drums) components.

<SonareDemo id="hpss-separation" />

`nFft` must be an even integer of at least 4; mixed-radix FFT sizes are accepted. `hopLength` must be an integer in `(0, nFft / 2]`. Both median kernels must be positive odd integers at most 524287. The underlying STFT window and `winLength` must provide overlap-add coverage without gaps; these JavaScript helpers use the default window geometry. Invalid geometry is refused instead of returning periodic dropouts.

::: tip Performance
HPSS requires STFT (short-time Fourier transform) computation and median filtering. Processing time scales with audio duration.
:::

```typescript
function hpss(
  samples: Float32Array,
  sampleRate?: number,        // default: 22050
  kernelHarmonic?: number,    // default: 31
  kernelPercussive?: number,   // default: 31
  nFft?: number,               // default: 2048
  hopLength?: number,          // default: 512
  hardMask?: boolean           // default: false
): HpssResult

interface HpssResult {
  harmonic: Float32Array;
  percussive: Float32Array;
  sampleRate: number;
}
```

`hpssWithResidual(...)` accepts the same kernel, STFT, and mask options and
also returns the residual component that is not classified as harmonic or
percussive.

```typescript
function hpssWithResidual(
  samples: Float32Array,
  sampleRate?: number,
  kernelHarmonic?: number,
  kernelPercussive?: number,
  nFft?: number,               // default: 2048
  hopLength?: number,          // default: 512
  hardMask?: boolean           // default: false
): HpssWithResidualResult
```

### `harmonic(samples, sampleRate)` <Badge type="warning" text="Heavy" />

Extract harmonic component from audio.

```typescript
function harmonic(samples: Float32Array, sampleRate?: number): Float32Array  // sampleRate default: 22050
```

### `percussive(samples, sampleRate)` <Badge type="warning" text="Heavy" />

Extract percussive component from audio.

```typescript
function percussive(samples: Float32Array, sampleRate?: number): Float32Array  // sampleRate default: 22050
```

### `timeStretch(samples, sampleRate, rate, nFft?, hopLength?)` <Badge type="warning" text="Heavy" />

Time-stretch audio without changing pitch. Rate < 1.0 = slower, > 1.0 = faster. See [Phase vocoder and time stretching](./glossary/editing/phase-vocoder-stretch.md).

<SonareDemo id="time-stretch" />

::: tip Performance
Uses phase vocoder algorithm. Processing time increases with audio duration.
:::

```typescript
function timeStretch(
  samples: Float32Array,
  sampleRate: number,
  rate: number,      // 0.5 = half speed, 2.0 = double speed
  nFft?: number,     // default: 2048
  hopLength?: number // default: 512
): Float32Array
```

### `pitchShift(samples, sampleRate, semitones, nFft?, hopLength?)` <Badge type="warning" text="Heavy" />

Pitch-shift audio without changing duration. Measured in semitones (+12 = one octave up). See [Phase vocoder and time stretching](./glossary/editing/phase-vocoder-stretch.md).

::: tip Performance
Combines time stretching and resampling. Processing time increases with audio duration.
:::

```typescript
function pitchShift(
  samples: Float32Array,
  sampleRate: number,
  semitones: number,   // +12 = one octave up
  nFft?: number,        // default: 2048
  hopLength?: number    // default: 512
): Float32Array
```

### Editing DSP

These functions change the signal itself rather than only analyzing it. They are
also available as `Audio` instance methods, where the stored `sampleRate` is
used automatically. Background: [Pitch correction](./glossary/editing/pitch-correction.md) and [Voice and formants](./glossary/editing/voice-formant.md). Like the other one-shot functions, each also takes a request object and, after its last positional argument, `{ validate?: boolean }`.

```typescript
function pitchCorrectToMidi(
  samples: Float32Array,
  sampleRate?: number,       // default 22050
  currentMidi?: number,
  targetMidi?: number,
): Float32Array

// Retune a tracked pitch contour to a fixed target note, frame by frame.
// f0Hz is a per-frame f0 track (e.g. from pitchYin/pitchPyin), aligned to
// hopLength. Pass the matching voiced flags to skip unvoiced frames; unvoiced
// or NaN frames are left untouched. voicedProb is only a fallback source of
// that same decision and is ignored whenever voiced is supplied.
function pitchCorrectToMidiTimevarying(
  samples: Float32Array,
  f0Hz: Float32Array,
  targetMidi: number,
  sampleRate?: number,       // default 22050
  hopLength?: number,        // default 512
  voiced?: VoicedFlags | null,
  voicedProb?: Float32Array | null,
): Float32Array

// Snap a tracked pitch contour to a musical scale or a fixed note.
// mode 'scale' pulls every voiced frame to the nearest enabled scale tone;
// mode 'midi' (the default) behaves like pitchCorrectToMidiTimevarying.
function pitchCorrectTimevarying(
  samples: Float32Array,
  f0Hz: Float32Array,       // per-frame f0 track aligned to hopLength
  sampleRate?: number,      // default 22050
  hopLength?: number,       // default 512
  options?: PitchCorrectOptions,
): Float32Array

interface PitchCorrectOptions {
  mode?: 'midi' | 'scale';         // default 'midi'
  targetMidi?: number;             // fixed note for 'midi' mode; default 69 (A4)
  scaleRoot?: number;              // scale root pitch class 0-11; default 0 (C)
  scaleModeMask?: number;          // 12-bit degree mask; default C major
  referenceMidi?: number;          // scale-grid anchor; default 69 (A4)
  retuneAmount?: number;           // 0 = bypass, 1 = full snap; default 1
  maxCorrectionSemitones?: number; // per-frame clamp in semitones; default 12
  retuneSpeedMs?: number;          // glide time constant; default 50
  vibratoThresholdCents?: number;  // corrections below this are bypassed; default 20
  voiced?: VoicedFlags;            // per-frame voiced flags (truthy / non-zero = voiced)
  voicedProb?: Float32Array;       // fallback voicing source; ignored when voiced is set
}

// Per-frame voicing decision, one entry per f0Hz frame.
type VoicedFlags =
  | Int32Array
  | Uint8Array
  | Float32Array
  | readonly number[]
  | readonly boolean[];
```

`VoicedFlags` is the accepted shape of the `voiced` argument and of
`PitchCorrectOptions.voiced`. It covers what the analysis side hands back:
`PitchResult.voicedFlag` is a `boolean[]`, so a pitch track goes straight into
pitch correction with no conversion step.

```typescript
const pitch = pitchPyin(samples, sampleRate);
const tuned = pitchCorrectToMidiTimevarying(
  samples,
  pitch.f0,
  69,
  sampleRate,
  512,
  pitch.voicedFlag,   // boolean[] accepted as-is
);
```

`voiced` must be the same length as `f0Hz`; when it is omitted, `voicedProb` must
also be the same length. A mismatch throws a `RangeError` (for example,
`'pitchCorrectToMidiTimevarying: voiced must have the same length as f0Hz'`), not
a `SonareError`, so `isSonareError` does not catch it. Every frame treated as
voiced must have an `f0Hz` that is finite, strictly positive, and no higher than
the Nyquist frequency (`sampleRate / 2`); violating this rejects the call. An
unvoiced frame may use `NaN` (a finite value from `0` through Nyquist is also
accepted), but `NaN` is never valid for a voiced frame.

A track with an unvoiced (`NaN`) frame needs a voicing source. Calling `pitchCorrectTimevarying(samples, f0Hz)` with such a track and neither `voiced` nor `voicedProb` throws `SonareError` `InvalidParameter` with the generic message `Invalid parameter`, which names no field. Pass `voiced` (for example `{ voiced: pitch.voicedFlag }`).

::: warning `voicedProb` decides voicing, and nothing else
`voicedProb` exists for one purpose: to derive a per-frame voiced/unvoiced
decision when `voiced` is not supplied. When `voiced` is supplied, `voicedProb`
is ignored entirely — passing both is a no-op, which is why the example above
passes only the flags.

In particular it does **not** scale the per-frame correction amount. If you were
passing `voicedProb` expecting a soft, probability-weighted retune, you are not
getting one, and the correction you hear will be **stronger in the low register**
than that reading predicts — `voicedProb` rises with F0, so the frames it would
have attenuated most are the low ones. Use `retuneAmount` and
`vibratoThresholdCents` to soften a correction.
:::

```typescript
function noteStretch(
  samples: Float32Array,
  sampleRate: number,
  options?: {
    onsetSample?: number,    // note onset position in samples; >= 0
    offsetSample?: number,   // note offset position in samples
    stretchRatio?: number,   // >1 lengthens the region, <1 shortens it
  },
): Float32Array

// Move a note region to a new onset without changing its duration
// (complements noteStretch, which changes duration but not onset).
function noteMove(
  samples: Float32Array,
  sampleRate?: number,
  options?: {
    onsetSample?: number,        // note onset position in samples
    offsetSample?: number,       // note offset position in samples; defaults to the input length
    targetOnsetSample?: number,  // where the region's onset moves to
  },
): Float32Array
```

`Audio.noteStretch(options?)` and `Audio.noteMove(options?)` are the equivalent instance methods on an `Audio` wrapper (sample rate taken from the instance). Negative sample positions (`onsetSample`, `offsetSample`, `targetOnsetSample`) are refused with a `RangeError` naming the field.

```typescript
function spectralEdit(
  samples: Float32Array,
  sampleRate: number,
  ops?: Array<{
    startSample?: number;
    endSample?: number;
    lowHz?: number;
    highHz?: number;
    gainDb?: number;
    mode?: 'gain' | 'attenuate' | 'mute' | 'heal';
  }>,
  options?: {
    nFft?: number;
    hopLength?: number;
    window?: 'hann' | 'hamming' | 'blackman' | 'rectangular';
    healRadiusFrames?: number;
  },
): Float32Array

function voiceChange(
  samples: Float32Array,
  sampleRate?: number,        // default: 22050
  options?: {
    pitchSemitones?: number,  // negative shifts down; default 0
    formantFactor?: number,   // >1 brightens, <1 darkens; default 1.0
    formantMode?: 'relative' | 'absolute', // default 'relative'
  },
): Float32Array
```

CLI equivalents:

```bash
sonare pitch-correct vocal.wav --current-midi 68.7 --target-midi 69 -o corrected.wav
sonare note-stretch take.wav --onset 12000 --offset 24000 --ratio 1.25 -o held.wav
sonare voice-change vocal.wav --pitch-semitones 3 --formant-factor 1.05 -o voice.wav
```

`formantMode` sets what `formantFactor` is measured against. In `'relative'` (the default) the factor is a warp applied after the pitch shift, so the formants follow the pitch by `formantFactor * 2^(pitchSemitones / 12)`. In `'absolute'` the factor is the formant shift relative to the input whatever the pitch shift (`1` keeps the formants where they were), and the warp actually applied is `formantFactor / 2^(pitchSemitones / 12)`. An absolute request whose warp leaves [0.55, 1.65] throws a `RangeError` naming the reachable `formantFactor` range for that `pitchSemitones`; it is never clamped. Any other mode string is a `RangeError`. The CLI takes the same choice as `--formant-mode relative|absolute`.

```typescript
// Up four semitones, formants left where they were
const out = voiceChange(vocal, 48000, { pitchSemitones: 4, formantFactor: 1, formantMode: 'absolute' });
```

`spectralEdit` requires `nFft` to be a power of two in `[4, 262144]`; any other value throws `SonareError` `InvalidParameter` (`SpectralEditConfig: nFft must be a power of two in [4, 262144]`), and a negative region sample position is a `RangeError`. See [Spectral Editing](./spectral-editing.md) for region examples and option notes.

`pitchCorrectTimevarying(...)` is the scale-snap pitch correction path; see [Editing DSP](./editing-dsp.md) for the scale masks, `mode`, and retune-feel options in full.

### `normalize(samples, sampleRate, targetDb?, mode?)`

Normalize audio to the requested target level. `mode` is `'peak'` by default;
use `'rms'` to target RMS level instead.

```typescript
function normalize(
  samples: Float32Array,
  sampleRate: number,
  targetDb?: number,        // default: 0 for peak, -20 for rms
  mode?: 'peak' | 'rms'     // default: 'peak'
): Float32Array
```

### `normalizeStereo(request)`

Normalize a stereo pair with **one shared gain**, so the stereo image survives.

```typescript
function normalizeStereo(request: NormalizeStereoRequest): NormalizeStereoResult

interface NormalizeStereoRequest {
  left: Float32Array;
  right: Float32Array;       // must be the same length as left
  sampleRate?: number;       // default 22050
  targetDb?: number;         // default depends on mode; see below
  mode?: 'peak' | 'rms';     // default 'peak'
  validate?: boolean;        // default true
}

interface NormalizeStereoResult {
  left: Float32Array;
  right: Float32Array;
  appliedGainDb: number;     // one figure, not a pair
}
```

The level is read from the pair and the resulting gain goes to **both** channels
unchanged. That is the whole point: normalizing each channel to its own target
would change the balance rather than the level, turning a deliberate pan into a
centered mix. Because the decision is shared, `appliedGainDb` is a single figure
and not a per-channel pair. In `'peak'` mode the louder channel reaches
`targetDb` and the quieter one keeps its distance below it. In `'rms'` mode the
quantity driven to `targetDb` is the RMS over both channels' samples together —
the quadratic mean of the per-channel figures, not their average — and the output
is hard-clipped to `[-1, 1]`.

::: warning Choose an RMS target with peak headroom
Both `normalize` and `normalizeStereo` default `targetDb` to **`0`** for `mode: 'peak'` and **`-20`** for `mode: 'rms'`. An explicit RMS target of 0 dBFS can drive peaks beyond full scale; the output is hard-clipped to `[-1, 1]`. Leave the target omitted or choose an explicit RMS target with enough headroom for the signal's peaks.
:::

A pair whose channels differ in length throws a `RangeError`
(`'Stereo channel lengths must match.'`) before any processing. **Silence is not
an error**: a pair with nothing in it comes back untouched with `appliedGainDb`
exactly `0`, rather than throwing or applying an unbounded boost.

`validate` only controls the JavaScript-side pre-scan, which is what produces a
`RangeError` naming the offending sample index; the native layer re-validates
either way, so `validate: false` trades a precise message for speed, not safety.
Only an explicit `false` disables it.

### `trim(samples, sampleRate, thresholdDb?, frameLength?, hopLength?)`

Trim silence from beginning and end of audio.

```typescript
function trim(
  samples: Float32Array,
  sampleRate: number,
  thresholdDb?: number,   // default: -60.0
  frameLength?: number,   // default: 2048
  hopLength?: number      // default: 512
): Float32Array
```

This is the simple `Audio`-level threshold trim. For librosa-compatible
frame/RMS silence detection that also returns the original start/end sample
range, use `trimSilence(...)` below.

## Room Acoustics

These functions describe or apply the recording space rather than the song itself. Background: [Reverberation time](./glossary/acoustics/reverberation-time.md), [Room geometry](./glossary/acoustics/room-geometry.md) and [Spaced receivers](./glossary/acoustics/spaced-receivers.md).

| Goal | Use |
|------|-----|
| Measure a clean impulse response | `analyzeImpulseResponse(...)` |
| Estimate room decay from ordinary audio | `detectAcoustic(...)` |
| Fit a practical room model from audio | `estimateRoom(...)` |
| Turn that estimate into `synthesizeRir` input | `roomGeometryFromEstimate(...)` |
| Create a mono room impulse response from dimensions | `synthesizeRir(...)` |
| Add a target-room character as an effect | `roomMorph(...)` |
| Add the same character to a stereo recording, heard at two spaced receivers | `roomMorphStereo({ left, right, sampleRate, ... })` |

::: info RIR and room morphing
**RIR** means room impulse response: samples that describe how a room reacts to a short sound. `roomMorph(...)` is a creative effect, not dereverberation.
:::

```typescript
const ir = analyzeImpulseResponse(impulseResponseSamples, sampleRate, 6, 30);
console.log(ir.rt60, ir.edt, ir.c50, ir.c80, ir.confidence);

const blind = detectAcoustic(roomRecording, sampleRate, {
  nOctaveBands: 6,
  nThirdOctaveSubbands: 24,
  minDecayDb: 30,
  noiseFloorMarginDb: 10,
});
console.log(blind.isBlind, blind.rt60Bands);

const estimate = estimateRoom(roomRecording, sampleRate, {
  referenceAbsorption: 0.15,
  nOctaveBands: 6,
});
console.log(estimate.volume, estimate.lengthM, estimate.widthM, estimate.heightM);
console.log(estimate.drrDb, estimate.confidence, estimate.bandAbsorption);

// Throws a coded SonareError (e.g. acoustic.source_outside_room) for unusable geometry.
const rir = synthesizeRir({ lengthM: 7, widthM: 5, heightM: 3, absorption: 0.2, materialPreset: 'none' });
console.log(rir.sampleRate, rir.rir.length, rir.diagnostics);

// An estimate already uses synthesizeRir's names; the helper adds a placement scaled into the estimated room; source and listener override it.
const geometry = roomGeometryFromEstimate(estimate, {
  source: { x: 1, y: 1, z: 1.2 },
  listener: { x: 2, y: 1.5, z: 1.5 },
});
const resynth = synthesizeRir({ ...geometry, sampleRate });

const morphed = roomMorph(samples, sampleRate, { lengthM: 12, widthM: 9, heightM: 4, wet: 0.6 });
```

`analyzeImpulseResponse(samples, sampleRate?, nOctaveBands?, minDecayDb?)`
uses `minDecayDb` to set the decay-fit threshold (default `30`).

`materialPreset` (`'none' | 'concrete' | 'wood' | 'curtain' | 'carpet' | 'glass'`, type `MaterialPresetName`) and the `estimateRoom` `mode` option (`'auto' | 'blind' | 'impulse_response'`, type `AcousticModeName`) take names only: a number is a `TypeError`, an unknown name a `RangeError`. `roomGeometryFromEstimate(estimate, { source?, listener? })` takes `RoomPlacement` (`{ x, y, z }` in meters) positions and returns `RoomGeometryOptions`, with the default placement scaled into the estimated room (each position given replaces it) and `absorption` as the mean of the finite bands; it throws a `RangeError` for an estimate with no measurable dimensions.

See [Room Acoustics](./acoustic-analysis.md) for how to interpret RT60, EDT, C50, C80, D50, band arrays, room estimates, generated RIRs, and confidence.
