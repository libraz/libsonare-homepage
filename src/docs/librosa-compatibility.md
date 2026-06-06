# librosa Compatibility

This document describes how libsonare functions correspond to Python's librosa library.

::: tip How to read this page
- **New to librosa**: start with [Introduction](/docs/introduction) and [MIR Overview](/docs/glossary/concepts/mir-overview), then come back.
- **Migrating from librosa**: jump to the [Migration Guide](#migration-guide) and [Known Differences](#known-differences) at the bottom.
- **Just need a mapping**: scan the [Feature Comparison](#feature-comparison) tables.
:::

## Overview

libsonare provides many of the same MIR building blocks as
[librosa](https://librosa.org/), but targets C++, Python bindings, Node.js
native bindings, and WebAssembly.

It is not a drop-in replacement for librosa. APIs, defaults, and numerical
details can differ.

The libsonare test suite contains reference checks against librosa 0.11 for
selected features.

## Task-Oriented Map

Use this table before scanning the long compatibility matrix:

| If your librosa code does... | Use in libsonare | Watch out for |
|------------------------------|------------------|---------------|
| Load files and run one-off analysis | `Audio.from_file(...)`, then `detect_bpm`, `detect_key`, `analyze` | Browser/WASM does not decode files; decode with Web Audio first |
| Build spectrogram features for ML | `stft`, `melSpectrogram` / `mel_spectrogram`, `mfcc`, `pcen` | Pass `n_fft`, `hop_length`, `n_mels`, and `n_mfcc` explicitly when comparing |
| Compute chroma or harmonic features | `chroma`, `nnlsChroma` / `nnls_chroma`, `tonnetz` | `nnlsChroma` is not a strict `librosa.feature.chroma_cqt` clone |
| Track tempo, beats, onsets, or pulse | `onsetEnvelope`, `detectOnsets`, `detectBeats`, `detectBpm`, `tempogram`, `plp` | libsonare returns beat/onset times in seconds for high-level detectors |
| Edit or transform audio | `hpss`, `hpssWithResidual` / `hpss_with_residual`, `timeStretch` / `time_stretch`, `phaseVocoder` / `phase_vocoder`, `pitchShift` / `pitch_shift`, `remix`, `trimSilence` / `trim_silence` | Phase-vocoder, HPSS, and resampling details differ from librosa |
| Convert units or reshape feature arrays | `framesToSamples`, `samplesToFrames`, `frameSignal`, `padCenter`, `fixLength`, `vectorNormalize` | JS names are camelCase, Python names are snake_case |
| Reconstruct approximate audio from features | `melToAudio`, `mfccToAudio` | Griffin-Lim reconstruction is lossy and phase-estimated |

## Validation Coverage

Compatibility here means "checked against reference behavior", not "the APIs are identical".

The libsonare repository has librosa comparison tests for STFT, mel/MFCC, chroma, CQT, pitch, tuning, onset/beat/tempo, tempogram/PLP, PCEN, spectral contrast/poly features/zero crossings, dB conversion, framing/sequence helpers, silence trim/split, HPSS, harmonic/decompose/NN filtering/remix/phase vocoder, tonnetz, and related utilities.

Use the tolerances below as migration guidance. They are not exact numerical guarantees for every input.

## Feature Comparison

### Supported Features

#### Core / IO

| librosa | libsonare | Notes |
|---------|-----------|-------|
| `librosa.load()` | `Audio::from_file()` | WAV/MP3 by default; FFmpeg-supported formats in FFmpeg builds |
| `librosa.resample()` | `resample()` | librosa 0.11 defaults to soxr; libsonare uses r8brain |
| `librosa.stft()` | `Spectrogram::compute()` / `stft()` | Compatible defaults; small numerical differences are expected |
| `librosa.istft()` | `Spectrogram::to_audio()` | OLA reconstruction |
| `librosa.power_to_db()` | `powerToDb()` / `power_to_db()` | `ref`, `amin`, `top_db` all supported |
| `librosa.amplitude_to_db()` | `amplitudeToDb()` / `amplitude_to_db()` | Same parameters |
| `librosa.db_to_power()` | `dbToPower()` / `db_to_power()` | Inverse of `power_to_db` |
| `librosa.db_to_amplitude()` | `dbToAmplitude()` / `db_to_amplitude()` | Inverse of `amplitude_to_db` |

#### Effects

| librosa | libsonare | Notes |
|---------|-----------|-------|
| `librosa.effects.hpss()` | `hpss()` | Median filtering |
| `librosa.effects.hpss()` with residual handling | `hpssWithResidual()` / `hpss_with_residual()` | Returns harmonic, percussive, and residual signals |
| `librosa.effects.harmonic()` | `harmonic()` | Harmonic component only |
| `librosa.effects.percussive()` | `percussive()` | Percussive component only |
| `librosa.effects.time_stretch()` | `time_stretch()` / `timeStretch()` | Phase vocoder |
| `librosa.phase_vocoder()` | `phaseVocoder()` / `phase_vocoder()` | Direct phase-vocoder time scaling |
| `librosa.effects.pitch_shift()` | `pitch_shift()` / `pitchShift()` | Time stretch plus resampling |
| `librosa.effects.remix()` | `remix()` | Reorder or concatenate interval slices; interval units are samples |
| `librosa.effects.preemphasis()` | `preemphasis()` | `coef`, optional `zi` |
| `librosa.effects.deemphasis()` | `deemphasis()` | Inverse pre-emphasis |
| `librosa.effects.trim()` | `trimSilence()` / `trim_silence()` | WASM/Node return `{ audio, startSample, endSample }`; Python returns `(audio, start_sample, end_sample)` |
| `librosa.effects.split()` | `splitSilence()` / `split_silence()` | WASM/Node return a flat `Int32Array`; Python returns `list[tuple[int, int]]` |

#### Features (spectral / pitch / chroma)

| librosa | libsonare | Notes |
|---------|-----------|-------|
| `librosa.feature.melspectrogram()` | `MelSpectrogram::compute()` / `melSpectrogram()` | Slaney normalization |
| `librosa.feature.mfcc()` | `MelSpectrogram::mfcc()` / `mfcc()` | DCT-II; specify `n_mfcc` explicitly when matching librosa |
| `librosa.feature.chroma_stft()` | `Chroma::compute()` / `chroma()` | STFT-based |
| `librosa.feature.spectral_centroid()` | `spectralCentroid()` / `spectral_centroid()` | Per-frame |
| `librosa.feature.spectral_bandwidth()` | `spectralBandwidth()` / `spectral_bandwidth()` | Per-frame |
| `librosa.feature.spectral_rolloff()` | `spectralRolloff()` / `spectral_rolloff()` | `roll_percent` supported |
| `librosa.feature.spectral_flatness()` | `spectralFlatness()` / `spectral_flatness()` | Per-frame |
| `librosa.feature.spectral_contrast()` | `spectralContrast()` / `spectral_contrast()` | Matrix shape `(n_bands + 1) x n_frames` |
| `librosa.feature.poly_features()` | `polyFeatures()` / `poly_features()` | Matrix shape `(order + 1) x n_frames` |
| `librosa.feature.zero_crossing_rate()` | `zeroCrossingRate()` / `zero_crossing_rate()` | Per-frame |
| `librosa.zero_crossings()` | `zeroCrossings()` / `zero_crossings()` | Zero-crossing sample indices |
| `librosa.feature.rms()` | `rmsEnergy()` / `rms_energy()` | Per-frame |
| `librosa.feature.tonnetz()` | `tonnetz()` | Input: row-major chromagram |
| `librosa.cqt()` | `cqt()` | Constant-Q transform magnitude |
| `librosa.vqt()` | `vqt()` | Variable-Q transform; `gamma` controls Q |
| `librosa.feature.chroma_cqt()` (closest) | `nnlsChroma()` / `nnls_chroma()` | NNLS note-activation chroma; no exact librosa equivalent |
| `librosa.feature.tempogram()` | `tempogram()` | Autocorrelation (default) or `mode='cosine'` window-local cosine similarity |
| `librosa.feature.fourier_tempogram()` | `fourierTempogram()` / `fourier_tempogram()` | Complex Fourier tempogram |
| _(tempo-octave-invariant variant)_ | `cyclicTempogram()` / `cyclic_tempogram()` | Cyclic tempogram; no exact librosa equivalent |
| `librosa.feature.tempogram_ratio()` | `tempogramRatio()` / `tempogram_ratio()` | Tempogram ratio features |
| `librosa.pcen()` | `pcen()` | `time_constant`, `gain`, `bias`, `power`, `eps` |
| `librosa.pyin()` | `pitchPyin()` / `pitch_pyin()` | Probabilistic YIN; `fillNa` / `fill_na` controls whether unvoiced `f0` is `NaN` or `0` |
| `librosa.yin()` | `pitchYin()` / `pitch_yin()` | YIN; `fillNa` / `fill_na` controls whether unvoiced `f0` is `NaN` or `0` |
| `librosa.pitch_tuning()` | `pitchTuning()` / `pitch_tuning()` | Tuning offset from frequencies |
| `librosa.estimate_tuning()` | `estimateTuning()` / `estimate_tuning()` | Tuning offset from audio |

#### Decomposition and loudness

| librosa / standard | libsonare | Notes |
|--------------------|-----------|-------|
| `librosa.decompose.decompose()` | `decompose()` | NMF factor matrices from a row-major spectrogram |
| `librosa.decompose.nn_filter()` | `nnFilter()` / `nn_filter()` | Nearest-neighbour filtering |
| ITU-R BS.1770 / EBU R128 | `lufsInterleaved()` / `lufs_interleaved()` | Multichannel integrated loudness from interleaved samples |
| EBU Tech 3342 LRA | `ebur128LoudnessRange()` / `ebur128_loudness_range()` | Loudness range in LU |

#### Inverse reconstruction

These mirror `librosa.feature.inverse.*` and use Griffin-Lim for phase, so round-trips are approximate. See [Inverse Features](./inverse-features.md).

| librosa | libsonare | Notes |
|---------|-----------|-------|
| `librosa.feature.inverse.mel_to_stft()` | `melToStft()` / `mel_to_stft()` | Mel power → linear STFT power; custom Mel ranges / HTK round-trip via `fmin`/`fmax`/`htk` |
| _(mel_to_stft + `librosa.griffinlim`)_ | `melToAudio()` / `mel_to_audio()` | Mel power → audio (Griffin-Lim) |
| `librosa.feature.inverse.mfcc_to_mel()` | `mfccToMel()` / `mfcc_to_mel()` | MFCC → mel power |
| `librosa.feature.inverse.mfcc_to_audio()` | `mfccToAudio()` / `mfcc_to_audio()` | MFCC → audio (Griffin-Lim) |

#### Onset / Beat / Tempo

| librosa | libsonare | Notes |
|---------|-----------|-------|
| `librosa.onset.onset_strength()` | `onsetEnvelope()` / `onset_envelope()` | Spectral flux (C++ free function is `compute_onset_strength()`) |
| `librosa.onset.onset_detect()` | `detectOnsets()` / `detect_onsets()` | Returns onset times |
| `librosa.beat.beat_track()` | `BeatAnalyzer` / `detectBeats()` | DP-based |
| `librosa.beat.tempo()` | `BpmAnalyzer` / `detectBpm()` | Tempogram |
| `librosa.beat.plp()` | `plp()` | Predominant local pulse |
| `librosa.util.peak_pick()` | `peakPick()` / `peak_pick()` | Returns peak indices |

#### Utilities

| librosa | libsonare | Notes |
|---------|-----------|-------|
| `librosa.util.frame()` | `frameSignal()` / `frame_signal()` | Row-major frames |
| `librosa.util.pad_center()` | `padCenter()` / `pad_center()` | Pad to size, centered |
| `librosa.util.fix_length()` | `fixLength()` / `fix_length()` | Crop or pad |
| `librosa.util.fix_frames()` | `fixFrames()` / `fix_frames()` | Bound frame indices |
| `librosa.util.normalize()` | `vectorNormalize()` / `vector_normalize()` | `norm_type`: 0=inf, 1=L1, 2=L2, 3=power |
| `librosa.frames_to_samples()` | `framesToSamples()` / `frames_to_samples()` | Frame → sample index |
| `librosa.samples_to_frames()` | `samplesToFrames()` / `samples_to_frames()` | Sample → frame index |
| `librosa.frames_to_time()` | `framesToTime()` / `frames_to_time()` | Frame → seconds |
| `librosa.time_to_frames()` | `timeToFrames()` / `time_to_frames()` | Seconds → frame |

### Higher-level analyzers not in librosa

librosa's strength is low-level DSP — higher-level music understanding is typically delegated to separate tools. libsonare bundles those higher-level tasks in one library.

| libsonare | Description |
|-----------|-------------|
| `KeyAnalyzer` | Musical key detection (Krumhansl-Schmuckler profiles) |
| `ChordAnalyzer` | Chord recognition (108 chord-type templates) |
| `SectionAnalyzer` | Song structure analysis (intro / verse / chorus, etc.) |
| `TimbreAnalyzer` | Timbre characteristics (brightness, warmth, density, …) |
| `DynamicsAnalyzer` | Loudness, dynamic range, crest factor |
| `RhythmAnalyzer` | Time signature, groove, syncopation, regularity |

::: info Streaming
`StreamAnalyzer` — progressive real-time BPM / key / chord estimates — is also libsonare-specific. librosa has no streaming API.
:::

## Function Mapping

The libsonare snippets below assume `import libsonare as sonare` (Python) or the
named imports from `@libraz/libsonare` (Browser).

### STFT

**librosa:**
```python
S = librosa.stft(
    y,
    n_fft=2048,
    hop_length=512,
    win_length=None,
    window='hann',
    center=True
)
```

**libsonare:**
::: code-group
```typescript [Browser]
const result = stft(samples, sampleRate, 2048, 512);
```
```python [Python]
result = sonare.stft(samples, sample_rate, n_fft=2048, hop_length=512)
```
```cpp [C++]
sonare::StftConfig config;
config.n_fft = 2048;
config.hop_length = 512;
config.window = sonare::WindowType::Hann;
config.center = true;

auto spec = sonare::Spectrogram::compute(audio, config);
```
```bash [CLI]
# No CLI command dumps the full STFT matrix; use spectral summaries from the CLI.
sonare spectral song.wav --n-fft 2048 --hop-length 512 --json
```
:::

### Mel Spectrogram

**librosa:**
```python
mel = librosa.feature.melspectrogram(
    y=y, sr=sr,
    n_fft=2048, hop_length=512,
    n_mels=128, fmin=0.0, fmax=None,
    htk=False, norm='slaney'
)
mel_db = librosa.power_to_db(mel, ref=np.max)
```

**libsonare:**
::: code-group
```typescript [Browser]
const mel = melSpectrogram(samples, sampleRate, 2048, 512, 128);
// mel.power - power spectrum
// mel.db - dB scale
```
```python [Python]
mel = sonare.mel_spectrogram(samples, sample_rate, n_fft=2048, hop_length=512, n_mels=128)
# mel.power - power spectrum
# mel.db - dB scale
```
```bash [CLI]
sonare mel song.wav --n-fft 2048 --hop-length 512 --n-mels 128 --json
```
:::

### MFCC

**librosa:**
```python
mfcc = librosa.feature.mfcc(
    y=y, sr=sr, n_mfcc=13,
    n_fft=2048, hop_length=512, n_mels=128
)
```

**libsonare:**
::: code-group
```typescript [Browser]
const result = mfcc(samples, sampleRate, 2048, 512, 128, 13);
// result.coefficients - [nMfcc x nFrames]
```
```python [Python]
result = sonare.mfcc(samples, sample_rate, n_fft=2048, hop_length=512, n_mels=128, n_mfcc=13)
# result.coefficients - [n_mfcc x n_frames]
```
```bash [C++ CLI]
# No CLI command dumps MFCC coefficients; use inverse MFCC preview from the source-built C++ CLI.
sonare mfcc-to-audio song.wav --n-fft 2048 --hop-length 512 --n-mels 128 --n-mfcc 13 -o mfcc-preview.wav
```
:::

::: details What is DCT-II, and why does MFCC use it?
MFCC stands for *Mel-Frequency Cepstral Coefficients*. After building a mel spectrogram and taking its log, libsonare applies a **DCT-II** (type-II Discrete Cosine Transform) along the frequency axis. The DCT is like an FFT that produces only real numbers and packs most of the energy into the first few coefficients, so keeping just `n_mfcc` of them gives a compact summary of the spectral *shape* (the "cepstrum") while discarding fine detail. That is why MFCCs are a small, ML-friendly timbre descriptor rather than a full spectrum.
:::

### HPSS

**librosa:**
```python
y_harm, y_perc = librosa.effects.hpss(y, kernel_size=31)
```

**libsonare:**
::: code-group
```typescript [Browser]
const result = hpss(samples, sampleRate, 31, 31);
// result.harmonic
// result.percussive
```
```python [Python]
result = sonare.hpss(samples, sample_rate, kernel_harmonic=31, kernel_percussive=31)
# result.harmonic
# result.percussive
```
```bash [CLI]
sonare hpss song.wav --json
```
:::

### Beat Tracking

**librosa:**
```python
tempo, beats = librosa.beat.beat_track(y=y, sr=sr, start_bpm=120)
beat_times = librosa.frames_to_time(beats, sr=sr, hop_length=512)
```

**libsonare:**
::: code-group
```typescript [Browser]
const bpm = detectBpm(samples, sampleRate);
const beats = detectBeats(samples, sampleRate);  // Already in seconds
```
```python [Python]
bpm = sonare.detect_bpm(samples, sample_rate)
beats = sonare.detect_beats(samples, sample_rate)  # Already in seconds
```
```bash [CLI]
sonare bpm song.wav --json
sonare beats song.wav --json
```
:::

## Default Parameters

| Parameter | librosa | libsonare |
|-----------|---------|-----------|
| `sr` | 22050 | User-provided |
| `n_fft` | 2048 | 2048 |
| `hop_length` | 512 | 512 |
| `win_length` | n_fft | n_fft |
| `window` | 'hann' | Hann |
| `center` | True | true |
| `n_mels` | 128 | 128 |
| `fmin` | 0.0 | 0.0 for mel/inverse helpers; pitch helpers default to 65.0 Hz; CQT/VQT default to C1 (32.70319566 Hz) |
| `fmax` | sr/2 | sr/2 |
| `n_mfcc` | 20 | 20 for the standalone `mfcc()` / `Audio.mfcc()` across all bindings; the analyzer/timbre extraction path uses 13 |
| `n_chroma` | 12 | 12 |

When matching librosa output, pass parameters explicitly instead of relying on
wrapper defaults.

## Mel Scale Formulas

### Slaney (librosa default, libsonare default)

```
For f < 1000 Hz:  mel = 3 * f / 200
For f >= 1000 Hz: mel = 15 + 27 * log10(f / 1000) / log10(6.4)
```

### HTK

```
mel = 2595 * log10(1 + f / 700)
```

libsonare provides Slaney conversion helpers publicly and supports HTK Mel
filterbank generation through Mel configuration in the C++ core:
::: code-group
```typescript [Browser]
const melSlaney = hzToMel(hz);     // Slaney (default)
```
```python [Python]
mel_slaney = sonare.hz_to_mel(hz)  # Slaney (default)
```
```bash [CLI]
# No direct Hz/Mel conversion CLI; this conversion is exposed through the APIs above.
```
:::

## Reference Tolerance Guidelines

These are practical comparison thresholds seen in libsonare's reference tests
against librosa 0.11. They are regression-test guidance, not guaranteed
accuracy bounds for arbitrary audio.

| Feature | Tolerance | Notes |
|---------|-----------|-------|
| STFT magnitude | ~0.1% for aggregate values; individual bins can differ more | Float32 vs float64, windowing, and near-zero bins |
| Mel filterbank | ~0.1% for sums/max values in reference tests | Filterbank generation |
| MFCC | ~10-15% for mean/std reference checks | DCT and log-Mel details |
| Chroma | < 5% | Pitch mapping |
| BPM | within a few percent; half/double-tempo cases can occur | Tempo-candidate differences |
| Beat times | tens of ms to ~80 ms in impulse-train tests | Phase alignment |

## Known Differences

### 1. Resampling

- **librosa 0.11**: Defaults to `soxr_hq` and supports multiple resamplers
- **libsonare**: Uses `r8brain-free` (24-bit quality)

This can slightly change downstream features after resampling.

### 2. CQT

- **librosa**: CQT/VQT APIs with librosa-specific parameterization
- **libsonare**: CQT and VQT implementations with libsonare-specific APIs

### 3. Window Normalization

- **librosa**: Normalizes window for COLA
- **libsonare**: Uses raw window values

Expect small amplitude differences in iSTFT-style reconstruction. Apply
normalization after reconstruction if your workflow depends on level matching.

::: details What is COLA?
**COLA** stands for *Constant Overlap-Add*. When you reconstruct audio from an STFT, the overlapping windowed frames are added back together. If those overlapping windows sum to a constant value at every sample position, the reconstruction has even gain everywhere — that is the COLA condition. librosa normalizes the window so this holds exactly; libsonare uses the raw window, so the summed level can differ slightly. It only matters if you depend on the absolute output level after an inverse STFT.
:::

## Migration Guide

### Python to TypeScript

`librosa.load()` defaults to mono audio at 22050 Hz. In the browser, decode the
file first, downmix to mono if needed, and resample explicitly if you want to
match that behavior.

**Before (Python):**
```python
import librosa

y, sr = librosa.load('audio.mp3', sr=22050)
tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
print(f"BPM: {tempo}")
```

**After (TypeScript):**
```typescript
import { init, detectBpm, resample } from '@libraz/libsonare';

await init();

// Get audio from AudioContext
// Downmix stereo to mono before analysis if needed.
const samples = audioBuffer.getChannelData(0);

// Optionally resample to 22050
const resampled = resample(samples, audioBuffer.sampleRate, 22050);

const bpm = detectBpm(resampled, 22050);
console.log(`BPM: ${bpm}`);
```

### Python to C++

`Audio::from_file()` keeps the decoded file sample rate. Resample explicitly if
you want to match `librosa.load(..., sr=22050)`.

**Before (Python):**
```python
import librosa

y, sr = librosa.load('audio.mp3')
chroma = librosa.feature.chroma_stft(y=y, sr=sr)
```

**After (C++):**
```cpp
#include <sonare.h>

auto audio = sonare::Audio::from_file("audio.mp3");
auto chroma = sonare::Chroma::compute(audio);
auto energy = chroma.mean_energy();
```

## Performance Comparison

| Operation | librosa (Python) | libsonare (C++) | Speedup |
|-----------|------------------|-----------------|---------|
| STFT | 13ms | 14ms | tied |
| Mel spectrogram | 20ms | 23ms | tied |
| MFCC | 22ms | 24ms | tied |
| Beat tracking | 36ms | 24ms | 1.5x |
| Chroma | 45ms | 15ms | 2.9x |
| HPSS | 1,762ms | 89ms | **19.7x** |
| pYIN | 5,825ms | 474ms | **12.3x** |
| Full analysis | 36.4s | 0.67s | **~54x** |

*Benchmarked on Apple M5 Max (16 cores, 128GB), 73-second WAV at 44100 Hz stereo, all per-feature calls measured standalone from raw audio. See [Benchmarks](/docs/benchmarks) for full methodology and reproduction steps.*

WebAssembly is generally slower than native C++; exact performance depends on
the feature, browser, input length, and build settings. See
[Benchmarks](/docs/benchmarks) for measured results.
