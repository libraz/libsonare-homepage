# Python API

libsonare provides Python bindings using **ctypes** over the native C API for
high-performance audio analysis on desktop platforms. PyPI wheels are available
for supported Linux and macOS targets.

## Installation

Requires Python 3.11 or later (3.11, 3.12, 3.13).

```bash
pip install libsonare
```

This also installs the `sonare` CLI command. See [CLI Reference](/docs/cli) for details.

Default PyPI wheels decode WAV and MP3. Use `libsonare.has_ffmpeg_support()` to
check the loaded build. If you need direct M4A/AAC/FLAC/OGG/Opus decoding,
install from source with FFmpeg enabled:

```bash
SONARE_FFMPEG=1 pip install libsonare --no-binary libsonare
```

FFmpeg-enabled builds require FFmpeg development libraries. On macOS, install
them with `brew install ffmpeg`. On Debian/Ubuntu, install `libavformat-dev
libavcodec-dev libavutil-dev libswresample-dev`.

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
- C++17 compiler (GCC or Clang on the supported Linux/macOS targets)
- Optional FFmpeg development libraries when building with `SONARE_FFMPEG=1`

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
| `Audio.from_file(path)` | Load WAV/MP3 from disk; also FFmpeg-supported formats when the library is built with FFmpeg |
| `Audio.from_buffer(data, sample_rate)` | Create from float samples |
| `Audio.from_memory(data)` | Decode encoded audio bytes with the same format support as `from_file` |
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
| `detect_chords(samples, sample_rate, ...)` | `ChordAnalysisResult` | Chord segments with templates |
| `analyze(samples, sample_rate)` | `AnalysisResult` | Full analysis (BPM, key, chords, sections, timbre, ...) |
| `analyze_bpm(samples, sample_rate, ...)` | `BpmAnalysisResult` | BPM with top candidates |
| `analyze_rhythm(samples, sample_rate)` | `RhythmResult` | Syncopation, groove type, regularity |
| `analyze_dynamics(samples, sample_rate)` | `DynamicsResult` | Dynamic range, loudness range, crest factor |
| `analyze_timbre(samples, sample_rate)` | `TimbreResult` | Brightness, warmth, density, roughness, complexity |
| `version()` | `str` | Library version |
| `has_ffmpeg_support()` | `bool` | Whether the loaded native library can decode via FFmpeg |

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

### librosa-Compatible Helpers

Added in libsonare 1.1.0. These mirror the corresponding `librosa` functions —
see [librosa Compatibility](./librosa-compatibility.md) for the function each
helper matches.

::: tip What each helper is for
- **`preemphasis` / `deemphasis`** — classic one-tap IIR pre-processing that boosts (or undoes) high frequencies.
- **`trim_silence` / `split_silence`** — trim leading/trailing silence or split on silent gaps.
- **`frame_signal` / `pad_center` / `fix_length` / `fix_frames`** — framing and size-alignment utilities for fixed-frame DSP.
- **`peak_pick` / `vector_normalize`** — peak detection on 1-D signals (e.g. onset envelopes) and vector-norm normalisation.
- **`pcen`** — dynamic range compression for mel spectrograms; features that are robust to gain and background noise.
- **`tonnetz`** — projects chroma into a 6-D harmonic space for chord-relation and modulation analysis.
- **`tempogram` / `plp`** — time-varying tempo representation from the onset envelope, and the dominant local pulse on top.
:::

| Function | Return Type | Description |
|----------|-------------|-------------|
| `preemphasis(samples, coef?, zi?)` | `list[float]` | Pre-emphasis filter (librosa.effects.preemphasis) |
| `deemphasis(samples, coef?, zi?)` | `list[float]` | Inverse pre-emphasis (librosa.effects.deemphasis) |
| `trim_silence(samples, top_db?, frame_length?, hop_length?)` | `tuple[list[float], int, int]` | `librosa.effects.trim` — returns `(audio, start_sample, end_sample)` |
| `split_silence(samples, top_db?, frame_length?, hop_length?)` | `list[tuple[int, int]]` | `librosa.effects.split` — non-silent intervals as sample pairs |
| `frame_signal(samples, frame_length, hop_length)` | `tuple[int, list[float]]` | `librosa.util.frame` — returns `(n_frames, row-major frames)` |
| `pad_center(values, size, pad_value?)` | `list[float]` | `librosa.util.pad_center` |
| `fix_length(values, size, pad_value?)` | `list[float]` | `librosa.util.fix_length` |
| `fix_frames(frames, x_min?, x_max?, pad?)` | `list[int]` | `librosa.util.fix_frames` |
| `peak_pick(values, pre_max, post_max, pre_avg, post_avg, delta, wait)` | `list[int]` | `librosa.util.peak_pick` — returns peak indices |
| `vector_normalize(values, norm_type?, threshold?)` | `list[float]` | `librosa.util.normalize`. `norm_type`: 0=inf, 1=L1, 2=L2, 3=power |
| `pcen(values, n_bins, n_frames, sample_rate?, hop_length?, time_constant?, gain?, bias?, power?, eps?)` | `list[float]` | `librosa.pcen` — input is row-major `[n_bins x n_frames]` mel |
| `tonnetz(chromagram, n_chroma, n_frames)` | `list[float]` | `librosa.feature.tonnetz` — returns row-major `[6 x n_frames]` |
| `tempogram(onset_envelope, sample_rate?, hop_length?, win_length?, center?, norm?)` | `tuple[int, list[float]]` | `librosa.feature.tempogram` (autocorrelation) |
| `plp(onset_envelope, sample_rate?, hop_length?, tempo_min?, tempo_max?, win_length?)` | `list[float]` | `librosa.beat.plp` — predominant local pulse |

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
| `frames_to_samples(frames, hop_length?, n_fft?)` | Frame index → sample index (librosa.frames_to_samples) |
| `samples_to_frames(samples, hop_length?, n_fft?)` | Sample index → frame index (librosa.samples_to_frames) |
| `power_to_db(values, ref?, amin?, top_db?)` | Power → dB (librosa.power_to_db) |
| `amplitude_to_db(values, ref?, amin?, top_db?)` | Amplitude → dB (librosa.amplitude_to_db) |
| `db_to_power(values, ref?)` | dB → power |
| `db_to_amplitude(values, ref?)` | dB → amplitude |

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
    name: str          # "C major", "A minor"
    short_name: str    # "C", "Am"

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
    beats: list[Beat]              # per-beat strength
    chords: list[Chord]            # detected chord segments
    sections: list[Section]        # Intro / Verse / Chorus / ...
    timbre: TimbreResult
    dynamics: DynamicsResult
    rhythm: RhythmResult
    form: str                      # e.g. "IABABCO"

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

## Mastering API

Python exposes the same named mastering processors as the browser demo. Use the name-list helpers to inspect the active build, then call mono, stereo, pair, or analysis APIs with explicit parameters.

```python
import json
import libsonare as sonare

print(sonare.mastering_processor_names())
# e.g. ['dynamics.compressor', 'eq.parametric', 'spectral.airBand', 'stereo.imager', ...]

result = sonare.mastering_process(
    "spectral.airBand",
    samples,
    sample_rate=sample_rate,
    params={
        "amount": 0.4,
        "shelfFrequencyHz": 14000,
    },
)

report = sonare.mastering_stereo_analyze(
    "stereo.monoCompatCheck",
    left,
    right,
    sample_rate=sample_rate,
)
print(json.loads(report))

# Preset-driven chain (one-shot)
sonare.mastering_preset_names()
# -> ['pop', 'edm', 'acoustic', 'hipHop', 'aiMusic', 'speech']
chain_result = sonare.master_audio(
    samples,
    sample_rate=sample_rate,
    preset="aiMusic",
    overrides={"loudness.targetLufs": -13},
)
print(chain_result.output_lufs, chain_result.applied_gain_db)

# Block-by-block streaming variant
with sonare.StreamingMasteringChain({
    "eq.tilt.tiltDb": 0.5,
    "dynamics.compressor.thresholdDb": -20.0,
}) as chain:
    chain.prepare(sample_rate=48000, max_block_size=512, num_channels=1)
    out_block = chain.process_mono([0.0] * 512)
```

Reference-track workflows use `mastering_pair_processor_names()`, `mastering_pair_process()`, `mastering_pair_analysis_names()`, and `mastering_pair_analyze()`. Pair inputs should use the same sample rate and comparable length.

### Progress callbacks

`mastering_chain()`, `mastering_chain_stereo()`, `master_audio()`, and
`master_audio_stereo()` accept an optional `on_progress=callable` keyword that
receives `(progress: float, stage: str)` after each stage. `progress` runs
from `0.0` to `1.0`; `stage` is the named processor that just completed
(`eq.tilt`, `dynamics.compressor`, `loudness.targetLufs`, etc.). Use it to
drive UI progress bars or to log per-stage timing.

```python
def on_step(progress: float, stage: str) -> None:
    print(f"{progress:5.1%}  {stage}")

result = sonare.mastering_chain(
    samples,
    sample_rate=sample_rate,
    config={"loudness": {"targetLufs": -14, "ceilingDb": -1}},
    on_progress=on_step,
)
```

The named mastering API families are:

| Purpose | Function |
|---------|----------|
| Apply simple loudness mastering | `mastering()` |
| List built-in mastering presets | `mastering_preset_names()` |
| Apply a preset to mono audio | `master_audio()` |
| Apply a preset to stereo audio | `master_audio_stereo()` |
| Run a full mono chain | `mastering_chain()` |
| Run a full stereo chain | `mastering_chain_stereo()` |
| Run a streaming chain (block-by-block) | `StreamingMasteringChain` |
| List mono/stereo processors | `mastering_processor_names()` |
| Process mono audio | `mastering_process()` |
| Process stereo audio | `mastering_process_stereo()` |
| List pair processors | `mastering_pair_processor_names()` |
| Process source/reference pair | `mastering_pair_process()` |
| List pair analyses | `mastering_pair_analysis_names()` |
| Analyze source/reference pair | `mastering_pair_analyze()` |
| List stereo analyses | `mastering_stereo_analysis_names()` |
| Analyze stereo channels | `mastering_stereo_analyze()` |

Related mastering guides: [Preset selection](./glossary/mastering/preset-selection.md), [Delivery targets](./glossary/mastering/delivery-targets.md), [Meter reading](./glossary/mastering/meter-reading.md), [Quality checklist](./glossary/mastering/quality-checklist.md).
