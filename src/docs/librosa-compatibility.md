# librosa Compatibility

This document describes how libsonare functions correspond to Python's librosa library.

::: tip How to read this page
- **New to librosa**: start with [Introduction](/docs/introduction) and [MIR Overview](/docs/glossary/concepts/mir-overview), then come back.
- **Migrating from librosa**: jump to the [Migration Guide](#migration-guide) and [Known Differences](#known-differences) at the bottom.
- **Just need a mapping**: scan the [Feature Comparison](#feature-comparison) tables.
:::

## Overview

libsonare provides many of the same MIR building blocks as
[librosa](https://librosa.org/) while targeting C++, Python bindings, Node.js
native bindings, and WebAssembly. It is not a drop-in replacement for librosa:
APIs, defaults, and numerical details can differ. The libsonare test suite
contains reference checks against librosa 0.11 for selected features.

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
| `librosa.effects.harmonic()` | `harmonic()` | Harmonic component only |
| `librosa.effects.percussive()` | `percussive()` | Percussive component only |
| `librosa.effects.time_stretch()` | `time_stretch()` / `timeStretch()` | Phase vocoder |
| `librosa.effects.pitch_shift()` | `pitch_shift()` / `pitchShift()` | Time stretch plus resampling |
| `librosa.effects.preemphasis()` | `preemphasis()` | `coef`, optional `zi` |
| `librosa.effects.deemphasis()` | `deemphasis()` | Inverse pre-emphasis |
| `librosa.effects.trim()` | `trimSilence()` / `trim_silence()` | Returns `(audio, startSample, endSample)` |
| `librosa.effects.split()` | `splitSilence()` / `split_silence()` | Non-silent intervals |

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
| `librosa.feature.zero_crossing_rate()` | `zeroCrossingRate()` / `zero_crossing_rate()` | Per-frame |
| `librosa.feature.rms()` | `rmsEnergy()` / `rms_energy()` | Per-frame |
| `librosa.feature.tonnetz()` | `tonnetz()` | Input: row-major chromagram |
| `librosa.feature.tempogram()` | `tempogram()` | Autocorrelation tempogram |
| `librosa.pcen()` | `pcen()` | `time_constant`, `gain`, `bias`, `power`, `eps` |
| `librosa.pyin()` | `pitchPyin()` / `pitch_pyin()` | Probabilistic YIN |
| `librosa.yin()` | `pitchYin()` / `pitch_yin()` | YIN |

#### Onset / Beat / Tempo

| librosa | libsonare | Notes |
|---------|-----------|-------|
| `librosa.onset.onset_strength()` | `compute_onset_strength()` | Spectral flux |
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

**libsonare (C++):**
```cpp
sonare::StftConfig config;
config.n_fft = 2048;
config.hop_length = 512;
config.window = sonare::WindowType::Hann;
config.center = true;

auto spec = sonare::Spectrogram::compute(audio, config);
```

**libsonare (JS):**
```typescript
const result = stft(samples, sampleRate, 2048, 512);
```

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
```typescript
const mel = melSpectrogram(samples, sampleRate, 2048, 512, 128);
// mel.power - power spectrum
// mel.db - dB scale
```

### MFCC

**librosa:**
```python
mfcc = librosa.feature.mfcc(
    y=y, sr=sr, n_mfcc=13,
    n_fft=2048, hop_length=512, n_mels=128
)
```

**libsonare:**
```typescript
const result = mfcc(samples, sampleRate, 2048, 512, 128, 13);
// result.coefficients - [nMfcc x nFrames]
```

### HPSS

**librosa:**
```python
y_harm, y_perc = librosa.effects.hpss(y, kernel_size=31)
```

**libsonare:**
```typescript
const result = hpss(samples, sampleRate, 31, 31);
// result.harmonic
// result.percussive
```

### Beat Tracking

**librosa:**
```python
tempo, beats = librosa.beat.beat_track(y=y, sr=sr, start_bpm=120)
beat_times = librosa.frames_to_time(beats, sr=sr, hop_length=512)
```

**libsonare:**
```typescript
const bpm = detectBpm(samples, sampleRate);
const beats = detectBeats(samples, sampleRate);  // Already in seconds
```

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
| `fmin` | 0.0 | 0.0 |
| `fmax` | sr/2 | sr/2 |
| `n_mfcc` | 20 | 13 in JS/top-level helpers; some wrapper methods default to 20 |
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
```typescript
const melSlaney = hzToMel(hz);     // Slaney (default)
```

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
#include <sonare/sonare.h>

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
