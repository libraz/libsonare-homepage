# Python API

libsonare provides Python bindings using **cffi** for high-performance audio analysis on desktop platforms. Pre-built wheels are available on PyPI for Linux (x86_64, aarch64) and macOS (Apple Silicon).

## Installation

Requires Python 3.11 or later (3.11, 3.12, 3.13).

```bash
pip install libsonare
```

This also installs the `sonare` CLI command. See [CLI Reference](/docs/cli) for details.

### Building from Source (alternative)

If pre-built wheels are not available for your platform, you can build from source:

```bash
git clone https://github.com/libraz/libsonare.git
cd libsonare
cmake -B build -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED=ON
cmake --build build -j

cd bindings/python
pip install -e .
```

**Requirements for building from source:**

- Python 3.11+
- CMake 3.16+
- C++17 compiler (GCC 9+, Clang 10+, MSVC 2019+)

## Quick Start

```python
from libsonare import Audio, analyze, detect_bpm, detect_key, detect_beats

# Load audio from file
audio = Audio.from_file("music.mp3")

# Individual analysis
bpm = detect_bpm(audio.data, audio.sample_rate)
key = detect_key(audio.data, audio.sample_rate)
beats = detect_beats(audio.data, audio.sample_rate)

# Full analysis
result = analyze(audio.data, audio.sample_rate)
print(f"BPM: {result.bpm} ({result.bpm_confidence:.0%})")
print(f"Key: {result.key}")
print(f"Time Signature: {result.time_signature}")
print(f"Beats: {len(result.beat_times)} detected")
```

## Audio Effects

```python
from libsonare import Audio

audio = Audio.from_file("music.mp3")

# Harmonic-Percussive Source Separation
hpss_result = audio.hpss()
harmonic = audio.harmonic()
percussive = audio.percussive()

# Time stretch / pitch shift
stretched = audio.time_stretch(rate=1.5)       # 1.5x speed
shifted = audio.pitch_shift(semitones=2.0)     # Up 2 semitones

# Normalize and trim silence
normalized = audio.normalize(target_db=-3.0)
trimmed = audio.trim(threshold_db=-60.0)

# Resample
resampled = audio.resample(target_sr=44100)
```

## Feature Extraction

```python
from libsonare import Audio

audio = Audio.from_file("music.mp3")

# Spectrogram features
stft_result = audio.stft(n_fft=2048, hop_length=512)
mel = audio.mel_spectrogram(n_fft=2048, hop_length=512, n_mels=128)
mfcc = audio.mfcc(n_fft=2048, hop_length=512, n_mels=128, n_mfcc=20)
chroma = audio.chroma(n_fft=2048, hop_length=512)

# Spectral features
centroid = audio.spectral_centroid()
bandwidth = audio.spectral_bandwidth()
rolloff = audio.spectral_rolloff(roll_percent=0.85)
flatness = audio.spectral_flatness()
zcr = audio.zero_crossing_rate()
rms = audio.rms_energy()

# Pitch detection
pitch_yin = audio.pitch_yin(fmin=65.0, fmax=2093.0)
pitch_pyin = audio.pitch_pyin(fmin=65.0, fmax=2093.0)
print(f"Median F0: {pitch_pyin.median_f0:.1f} Hz")
```

## Unit Conversions

```python
from libsonare import hz_to_mel, mel_to_hz, hz_to_midi, midi_to_hz
from libsonare import hz_to_note, note_to_hz, frames_to_time, time_to_frames

hz_to_mel(440.0)       # → Mel scale value
mel_to_hz(549.64)      # → Hz
hz_to_midi(440.0)      # → 69.0
midi_to_hz(69.0)       # → 440.0
hz_to_note(440.0)      # → "A4"
note_to_hz("A4")       # → 440.0

frames_to_time(100, sr=22050, hop_length=512)  # → seconds
time_to_frames(2.32, sr=22050, hop_length=512) # → frame index
```

## API Reference

### Audio

| Method | Description |
|--------|-------------|
| `Audio.from_file(path)` | Load WAV/MP3 from disk |
| `Audio.from_buffer(data, sample_rate)` | Create from float samples |
| `Audio.from_memory(data)` | Decode from binary WAV/MP3 in memory |
| `audio.data` | Raw float samples |
| `audio.sample_rate` | Sample rate (Hz) |
| `audio.duration` | Duration (seconds) |
| `audio.length` | Number of samples |
| `audio.close()` | Free native memory |

Supports context manager for automatic cleanup:

```python
with Audio.from_file("music.mp3") as audio:
    result = audio.analyze()
```

### Analysis Functions

| Function | Return Type | Description |
|----------|-------------|-------------|
| `detect_bpm(samples, sample_rate)` | `float` | Tempo in BPM |
| `detect_key(samples, sample_rate)` | `Key` | Root, mode, confidence |
| `detect_beats(samples, sample_rate)` | `list[float]` | Beat timestamps (seconds) |
| `detect_onsets(samples, sample_rate)` | `list[float]` | Onset timestamps (seconds) |
| `analyze(samples, sample_rate)` | `AnalysisResult` | Full analysis |
| `version()` | `str` | Library version |

All functions also available as `Audio` instance methods (e.g., `audio.detect_bpm()`).

### Effects Functions

| Function | Return Type | Description |
|----------|-------------|-------------|
| `hpss(samples, sr, kernel_harmonic?, kernel_percussive?)` | `HpssResult` | Harmonic-Percussive Source Separation |
| `harmonic(samples, sr)` | `list[float]` | Extract harmonic component |
| `percussive(samples, sr)` | `list[float]` | Extract percussive component |
| `time_stretch(samples, sr, rate)` | `list[float]` | Time-stretch without pitch change |
| `pitch_shift(samples, sr, semitones)` | `list[float]` | Pitch-shift without tempo change |
| `normalize(samples, sr, target_db?)` | `list[float]` | Normalize to target dB (default: -3.0) |
| `trim(samples, sr, threshold_db?)` | `list[float]` | Trim silence (default: -60.0 dB) |
| `resample(samples, src_sr, target_sr)` | `list[float]` | Resample to target sample rate |

### Feature Extraction Functions

| Function | Return Type | Description |
|----------|-------------|-------------|
| `stft(samples, sr, n_fft?, hop_length?)` | `StftResult` | Short-Time Fourier Transform |
| `stft_db(samples, sr, n_fft?, hop_length?)` | `tuple` | STFT in decibels |
| `mel_spectrogram(samples, sr, n_fft?, hop_length?, n_mels?)` | `MelSpectrogramResult` | Mel spectrogram |
| `mfcc(samples, sr, n_fft?, hop_length?, n_mels?, n_mfcc?)` | `MfccResult` | Mel-Frequency Cepstral Coefficients |
| `chroma(samples, sr, n_fft?, hop_length?)` | `ChromaResult` | Chroma features (pitch class distribution) |
| `spectral_centroid(samples, sr, n_fft?, hop_length?)` | `list[float]` | Spectral centroid per frame |
| `spectral_bandwidth(samples, sr, n_fft?, hop_length?)` | `list[float]` | Spectral bandwidth per frame |
| `spectral_rolloff(samples, sr, n_fft?, hop_length?, roll_percent?)` | `list[float]` | Spectral rolloff per frame |
| `spectral_flatness(samples, sr, n_fft?, hop_length?)` | `list[float]` | Spectral flatness per frame |
| `zero_crossing_rate(samples, sr, frame_length?, hop_length?)` | `list[float]` | Zero-crossing rate per frame |
| `rms_energy(samples, sr, frame_length?, hop_length?)` | `list[float]` | RMS energy per frame |
| `pitch_yin(samples, sr, frame_length?, hop_length?, fmin?, fmax?, threshold?)` | `PitchResult` | YIN pitch estimation |
| `pitch_pyin(samples, sr, frame_length?, hop_length?, fmin?, fmax?, threshold?)` | `PitchResult` | pYIN pitch estimation |

Default parameters: `n_fft=2048`, `hop_length=512`, `n_mels=128`, `n_mfcc=20`, `fmin=65.0`, `fmax=2093.0`, `threshold=0.3`, `roll_percent=0.85`.

### Conversion Functions

| Function | Description |
|----------|-------------|
| `hz_to_mel(hz)` | Hertz → Mel scale |
| `mel_to_hz(mel)` | Mel scale → Hertz |
| `hz_to_midi(hz)` | Hertz → MIDI note number |
| `midi_to_hz(midi)` | MIDI note number → Hertz |
| `hz_to_note(hz)` | Hertz → note name (e.g., "A4") |
| `note_to_hz(note)` | Note name → Hertz |
| `frames_to_time(frames, sr, hop_length)` | Frame index → seconds |
| `time_to_frames(time, sr, hop_length)` | Seconds → frame index |

### Types

```python
class PitchClass(IntEnum):
    C, Cs, D, Ds, E, F, Fs, G, Gs, A, As, B

class Mode(IntEnum):
    MAJOR = 0
    MINOR = 1

@dataclass(frozen=True)
class Key:
    root: PitchClass
    mode: Mode
    confidence: float

@dataclass(frozen=True)
class TimeSignature:
    numerator: int
    denominator: int
    confidence: float

@dataclass(frozen=True)
class AnalysisResult:
    bpm: float
    bpm_confidence: float
    key: Key
    time_signature: TimeSignature
    beat_times: list[float]

@dataclass(frozen=True)
class HpssResult:
    harmonic: list[float]
    percussive: list[float]
    length: int
    sample_rate: int

@dataclass(frozen=True)
class StftResult:
    n_bins: int
    n_frames: int
    n_fft: int
    hop_length: int
    sample_rate: int
    magnitude: list[float]   # n_bins × n_frames, row-major
    power: list[float]       # n_bins × n_frames, row-major

@dataclass(frozen=True)
class MelSpectrogramResult:
    n_mels: int
    n_frames: int
    sample_rate: int
    hop_length: int
    power: list[float]       # n_mels × n_frames, row-major
    db: list[float]          # n_mels × n_frames, row-major

@dataclass(frozen=True)
class MfccResult:
    n_mfcc: int
    n_frames: int
    coefficients: list[float]  # n_mfcc × n_frames, row-major

@dataclass(frozen=True)
class ChromaResult:
    n_chroma: int
    n_frames: int
    sample_rate: int
    hop_length: int
    features: list[float]    # n_chroma × n_frames, row-major
    mean_energy: list[float] # n_chroma values

@dataclass(frozen=True)
class PitchResult:
    n_frames: int
    f0: list[float]          # Fundamental frequency per frame (Hz)
    voiced_prob: list[float] # Voicing probability per frame (0–1)
    voiced_flag: list[bool]  # Voiced/unvoiced decision per frame
    median_f0: float
    mean_f0: float
```
