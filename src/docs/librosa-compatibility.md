# librosa Compatibility

This document describes how libsonare functions correspond to Python's librosa library.

## Overview

libsonare aims to provide functionality similar to [librosa](https://librosa.org/) while being optimized for C++ and WebAssembly environments. Most core features use the same algorithms with compatible default parameters.

## Feature Comparison

### Supported Features

| librosa | libsonare | Notes |
|---------|-----------|-------|
| `librosa.load()` | `Audio::from_file()` | WAV, MP3 support |
| `librosa.resample()` | `resample()` | Uses r8brain |
| `librosa.stft()` | `Spectrogram::compute()` | Full compatibility |
| `librosa.istft()` | `Spectrogram::to_audio()` | OLA reconstruction |
| `librosa.feature.melspectrogram()` | `MelSpectrogram::compute()` | Slaney normalization |
| `librosa.feature.mfcc()` | `MelSpectrogram::mfcc()` | DCT-II, liftering |
| `librosa.feature.chroma_stft()` | `Chroma::compute()` | STFT-based |
| `librosa.onset.onset_strength()` | `compute_onset_strength()` | Spectral flux |
| `librosa.beat.beat_track()` | `BeatAnalyzer` | DP-based |
| `librosa.beat.tempo()` | `BpmAnalyzer` | Tempogram |
| `librosa.effects.hpss()` | `hpss()` | Median filtering |
| `librosa.effects.time_stretch()` | `time_stretch()` | Phase vocoder |
| `librosa.effects.pitch_shift()` | `pitch_shift()` | WSOLA-like |

### Features Not in librosa

| libsonare | Description |
|-----------|-------------|
| `KeyAnalyzer` | Musical key detection (Krumhansl-Schmuckler) |
| `ChordAnalyzer` | Chord recognition (template matching) |
| `SectionAnalyzer` | Song structure analysis |
| `TimbreAnalyzer` | Timbre characteristics |
| `DynamicsAnalyzer` | Loudness and dynamics |
| `RhythmAnalyzer` | Time signature, groove |

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
| `n_mfcc` | 20 | 13 |
| `n_chroma` | 12 | 12 |

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

libsonare provides both:
```typescript
const melSlaney = hzToMel(hz);     // Slaney (default)
// HTK available in C++ API
```

## Tolerance Guidelines

| Feature | Tolerance | Notes |
|---------|-----------|-------|
| STFT magnitude | < 1e-6 | Floating point precision |
| Mel spectrogram | < 1% | Filterbank differences |
| MFCC | < 2% | DCT normalization |
| Chroma | < 5% | Pitch mapping |
| BPM | ±2 BPM | Algorithm differences |
| Beat times | ±50ms | Phase alignment |

## Known Differences

### 1. Resampling

- **librosa**: Uses `resampy` (Kaiser best)
- **libsonare**: Uses `r8brain-free` (24-bit quality)

Minimal impact on downstream features.

### 2. CQT

- **librosa**: Full CQT implementation
- **libsonare**: STFT-based chroma only

### 3. Window Normalization

- **librosa**: Normalizes window for COLA
- **libsonare**: Uses raw window values

Use `normalize()` to correct amplitude differences in iSTFT.

## Migration Guide

### Python to TypeScript

**Before (Python):**
```python
import librosa

y, sr = librosa.load('audio.mp3', sr=22050)
tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
print(f"BPM: {tempo}")
```

**After (TypeScript):**
```typescript
import { init, detectBpm, resample } from '@libraz/sonare';

await init();

// Get audio from AudioContext
const samples = audioBuffer.getChannelData(0);

// Optionally resample to 22050
const resampled = resample(samples, audioBuffer.sampleRate, 22050);

const bpm = detectBpm(resampled, 22050);
console.log(`BPM: ${bpm}`);
```

### Python to C++

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
| STFT (3min) | ~500ms | ~50ms | ~10x |
| Mel spectrogram | ~600ms | ~60ms | ~10x |
| MFCC | ~700ms | ~70ms | ~10x |
| Beat tracking | ~2s | ~200ms | ~10x |
| Full analysis | ~5s | ~500ms | ~10x |

*Benchmarked on Intel Core i7, 3-minute audio at 22050 Hz*

WebAssembly is ~2-3x slower than native C++, but still faster than Python.
