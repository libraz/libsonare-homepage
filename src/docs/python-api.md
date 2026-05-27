# Python API

libsonare provides Python bindings using **ctypes** over the native C API for
high-performance audio analysis on desktop platforms. PyPI wheels are available
for supported Linux and macOS targets.

::: details What is ctypes (and the C API)?
libsonare's core is compiled C/C++. **ctypes** is Python's built-in way to call functions in a compiled shared library (`.so`/`.dylib`) directly, with no extra C extension to build. The Python package is a thin wrapper that forwards your calls to the same native code the C++ library runs, so you get native speed from plain Python. ("C API" just means the flat set of C functions that wrapper targets.)
:::

Use this page when you want scripts, notebooks, batch analysis, or local tools that can read files directly. The Python package is usually the easiest route if you are not building a browser UI.

## Python Mental Model

| Step | What happens |
|------|--------------|
| 1. Load audio | `Audio.from_file(...)` reads supported file formats into samples |
| 2. Inspect or process | Call `detect_bpm`, `analyze`, feature functions, editing DSP, mastering, or mixing APIs |
| 3. Use results | Print values, save JSON, render audio, or feed features into your own pipeline |

Most Python APIs accept raw sample arrays plus `sample_rate`. The `Audio` wrapper is a convenience for file-based workflows.

## How To Read This Reference

Read this page in three passes:

1. If you are loading files, start with `Audio.from_file(...)`; if you already have samples, call the module-level functions directly.
2. Use [Pick The Smallest API That Solves The Job](#pick-the-smallest-api-that-solves-the-job) to choose a function family instead of scanning the full reference.
3. Return to [Types](#types) only when you need exact attribute names, row-major matrix shapes, or JS parity aliases.

Remember that Python `analyze(...)` is intentionally compact. For chords, sections, timbre, dynamics, rhythm, melody, or acoustics, use the focused functions listed below.

## Pick The Smallest API That Solves The Job

| You need | Start with | Why |
|----------|------------|-----|
| A script that reads files and prints metadata | `Audio.from_file(...)` + `detect_bpm` / `detect_key` / `analyze` | Python handles decoding and keeps the code short |
| Detailed music analysis | `analyze_bpm`, `detect_chords`, `analyze_sections`, `analyze_timbre`, `analyze_dynamics`, `analyze_rhythm` | These expose more detail than the compact `analyze(...)` summary |
| Feature arrays for notebooks or ML | `mel_spectrogram`, `mfcc`, `chroma`, `cqt`, `vqt`, `nnls_chroma` | Returns plain Python lists / result objects that can be converted to NumPy if desired |
| Editing a clip | `time_stretch`, `pitch_shift`, `pitch_correct_to_midi`, `note_stretch`, `voice_change` | These transform the signal itself |
| Mastering a file | `master_audio`, `mastering_chain`, `StreamingMasteringChain` | Presets first, explicit chain config when you need control |
| Live or chunked analysis | `StreamAnalyzer` | Feed audio blocks, drain feature frames, and read progressive BPM/key/chord estimates |
| Stem mixing | `mix_stereo` or `Mixer.from_scene_json(...)` | One-shot arrays first; scene mixer for sends, buses, automation, and meters |
| Room decay or clarity measurements | `analyze_impulse_response`, `detect_acoustic` | These describe the room, not the song |

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

::: details Pitch and feature terms: YIN/pYIN, zero-crossing rate, MIDI note
- **YIN / pYIN** — algorithms that estimate the *fundamental frequency* (the perceived pitch) of monophonic audio. YIN uses autocorrelation; pYIN adds probabilistic smoothing so the pitch line stays steadier over time. Both track one note at a time, not chords.
- **Zero-crossing rate (ZCR)** — how often the waveform crosses zero per frame. High ZCR means noisy or high-frequency content (cymbals, fricatives); low ZCR means smooth, tonal sound.
- **MIDI note number** — an integer naming a pitch: A4 = 69, middle C = 60, each semitone ±1. `hz_to_midi` / `midi_to_hz` (below) convert between Hz and this scale.
:::

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

The Python `Audio` object is broader than the WASM convenience wrapper.

It includes the common feature, editing, loudness, mastering, and resampling methods. It also adds focused analysis methods such as `analyze_bpm(...)`, `analyze_impulse_response(...)`, `detect_acoustic(...)`, `analyze_rhythm(...)`, `analyze_dynamics(...)`, `analyze_timbre(...)`, and positional `detect_chords(...)`.

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
| `detect_downbeats(samples, sample_rate)` | `list[float]` | Downbeat timestamps (seconds) |
| `detect_key_candidates(samples, sample_rate, ...)` | `list[KeyCandidate]` | Ranked key candidates with correlation |
| `detect_chords(samples, sample_rate, ...)` | `ChordAnalysisResult` | Chord segments over time |
| `analyze(samples, sample_rate)` | `AnalysisResult` | Core analysis: BPM, key, time signature, beats |
| `analyze_bpm(samples, sample_rate, ...)` | `BpmAnalysisResult` | BPM with top candidates |
| `analyze_rhythm(samples, sample_rate, ...)` | `RhythmResult` | Syncopation, groove type, regularity |
| `analyze_dynamics(samples, sample_rate, ...)` | `DynamicsResult` | Dynamic range, loudness range, crest factor |
| `analyze_timbre(samples, sample_rate, ...)` | `TimbreResult` | Brightness, warmth, density, roughness, complexity |
| `analyze_sections(samples, sample_rate, ...)` | `SectionResult` | Song-structure sections (intro/verse/chorus/...) |
| `analyze_melody(samples, sample_rate, ...)` | `MelodyResult` | Monophonic melody contour (YIN) |
| `analyze_impulse_response(samples, sample_rate, ...)` | `AcousticResult` | Room acoustics from an impulse response (RT60/EDT/C50/C80) |
| `detect_acoustic(samples, sample_rate, ...)` | `AcousticResult` | Blind room-acoustic estimation |
| `version()` | `str` | Library version |
| `has_ffmpeg_support()` | `bool` | Whether the loaded native library can decode via FFmpeg |

Most core analysis, effects, feature, loudness, and mastering helpers are also
available as `Audio` instance methods (e.g., `audio.detect_bpm()`). Some focused
helpers such as `analyze_sections(...)`, `analyze_melody(...)`, `cqt(...)`, and
`vqt(...)` remain standalone functions; pass `audio.data` and
`audio.sample_rate` to those.

Use the focused functions to avoid treating `analyze(...)` as a catch-all. In Python, `analyze(...)` returns the compact core summary: BPM, key, time signature, and beat times. Chords, sections, melody, timbre, dynamics, rhythm, and acoustic metrics are available through the dedicated functions listed above.

```python
keys = sonare.detect_key_candidates(
    audio.data,
    audio.sample_rate,
    modes=["major", "minor"],
    profile="krumhansl",
)

chords = sonare.detect_chords(
    audio.data,
    audio.sample_rate,
    use_hmm=True,
    use_key_context=True,
    key_root=keys[0].root,
    key_mode=keys[0].mode,
    chroma_method="nnls",
)

sections = sonare.analyze_sections(audio.data, audio.sample_rate)
```

## Room Acoustics

Use `analyze_impulse_response(...)` for a clean impulse response and `detect_acoustic(...)` for blind estimation from a normal recording. Both return `AcousticResult` with RT60, EDT, C50, C80, D50, per-band arrays, confidence, and `is_blind`. Their `sample_rate` default is `48000`, unlike most music-analysis helpers that default to `22050`.

```python
ir = sonare.analyze_impulse_response(ir_samples, sample_rate, n_octave_bands=6)
print(ir.rt60, ir.edt, ir.c50, ir.c80, ir.confidence)

blind = sonare.detect_acoustic(
    room_recording,
    sample_rate,
    n_octave_bands=6,
    n_third_octave_subbands=24,
    min_decay_db=30.0,
    noise_floor_margin_db=10.0,
)
print(blind.is_blind, blind.rt60_bands)
```

See [Room Acoustics](./acoustic-analysis.md) for interpretation notes and when a blind estimate is appropriate.

### Effects Functions

| Function | Return Type | Description |
|----------|-------------|-------------|
| `hpss(samples, sr, kernel_harmonic?, kernel_percussive?)` | `HpssResult` | Harmonic-Percussive Source Separation |
| `harmonic(samples, sr)` | `list[float]` | Extract harmonic component |
| `percussive(samples, sr)` | `list[float]` | Extract percussive component |
| `time_stretch(samples, sr, rate)` | `list[float]` | Time-stretch without pitch change |
| `pitch_shift(samples, sr, semitones)` | `list[float]` | Pitch-shift without tempo change |
| `pitch_correct_to_midi(samples, sr, current_midi?, target_midi?)` | `list[float]` | Pitch-correct toward a target MIDI note |
| `note_stretch(samples, sr, onset_sample?, offset_sample?, stretch_ratio?)` | `list[float]` | Stretch a single note region in place |
| `voice_change(samples, sr, pitch_semitones?, formant_factor?)` | `list[float]` | Independent pitch + formant shift |
| `normalize(samples, sr, target_db?)` | `list[float]` | Normalize to target dB (default: -3.0) |
| `trim(samples, sr, threshold_db?)` | `list[float]` | Trim silence (default: -60.0 dB) |
| `resample(samples, src_sr, target_sr)` | `list[float]` | Resample to target sample rate |

`trim(...)` is the simple threshold-based edit helper. The librosa-compatible
`trim_silence(...)` helper below uses frame RMS and `top_db`, and returns the
trimmed audio together with its original sample range.

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
| `cqt(samples, sr, hop_length?, fmin?, n_bins?, bins_per_octave?)` | `CqtResult` | Constant-Q Transform magnitude |
| `vqt(samples, sr, hop_length?, fmin?, n_bins?, bins_per_octave?, gamma?)` | `CqtResult` | Variable-Q Transform magnitude |
| `nnls_chroma(samples, sr)` | `tuple[int, list[float]]` | NNLS chromagram — returns `(n_frames, row-major 12 x n_frames data)` |
| `onset_envelope(samples, sr, n_fft?, hop_length?, n_mels?)` | `list[float]` | Onset strength envelope (input to the tempogram family) |
| `lufs(samples, sr)` | `LufsResult` | Integrated/momentary/short-term LUFS + loudness range (EBU R128) |
| `momentary_lufs(samples, sr)` | `list[float]` | Momentary LUFS per frame |
| `short_term_lufs(samples, sr)` | `list[float]` | Short-term LUFS per frame |

Default parameters: `n_fft=2048`, `hop_length=512`, `n_mels=128`, `n_mfcc=20`, pitch `fmin=65.0`, `fmax=2093.0`, `threshold=0.3`, `roll_percent=0.85`. CQT/VQT use `fmin=32.70319566` Hz (C1), `n_bins=84`, and `bins_per_octave=12`.

### librosa-Compatible Helpers

These mirror the corresponding `librosa` functions —
see [librosa Compatibility](./librosa-compatibility.md) for the function each
helper matches.

::: tip What each helper is for
- **`preemphasis` / `deemphasis`** — classic one-tap IIR pre-processing that boosts (or undoes) high frequencies.
- **`trim_silence` / `split_silence`** — trim leading/trailing silence or split on silent gaps.
- **`frame_signal` / `pad_center` / `fix_length` / `fix_frames`** — framing and size-alignment utilities for fixed-frame DSP.
- **`peak_pick` / `vector_normalize`** — peak detection on 1-D signals (e.g. onset envelopes) and vector-norm normalisation.
- **`pcen`** — dynamic range compression for mel spectrograms; features that are robust to gain and background noise.
- **`tonnetz`** — projects chroma into a 6-D harmonic space for chord-relation and modulation analysis.
- **`tempogram` / `plp`** — time-varying tempo representation from the onset envelope (autocorrelation or `mode="cosine"`), and the dominant local pulse on top.
- **`fourier_tempogram` / `cyclic_tempogram` / `tempogram_ratio`** — the FFT-based tempogram, an octave-folded cyclic tempogram, and tempo-ratio features.
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
| `tempogram(onset_envelope, sample_rate?, hop_length?, win_length?, center?, norm?, mode?)` | `tuple[int, list[float]]` | `librosa.feature.tempogram`. `mode`: `"autocorrelation"` (default) or `"cosine"` |
| `fourier_tempogram(onset_envelope, sample_rate?, hop_length?, win_length?, center?, norm?)` | `tuple[int, list[float]]` | FFT-based tempogram — STFT of the onset envelope |
| `cyclic_tempogram(onset_envelope, sample_rate?, hop_length?, win_length?, bpm_min?, n_bins?)` | `tuple[int, list[float]]` | Octave-folded cyclic tempogram |
| `tempogram_ratio(tempogram_data, win_length?, sample_rate?, hop_length?, factors?)` | `list[float]` | Tempo-ratio features from a tempogram |
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

Result objects are plain classes with attribute access; many also expose
camelCase property aliases (e.g. `bpm_confidence` / `bpmConfidence`) for
JS-parity. Shapes below show the data fields.

```python
class PitchClass(IntEnum):
    C, CS, D, DS, E, F, FS, G, GS, A, AS, B

class Mode(IntEnum):
    MAJOR = 0
    MINOR = 1
    DORIAN = 2
    PHRYGIAN = 3
    LYDIAN = 4
    MIXOLYDIAN = 5
    LOCRIAN = 6

class Key:
    root: PitchClass
    mode: Mode
    confidence: float
    name: str          # property -> "C major", "A minor"
    short_name: str    # property -> "C", "Am"

class TimeSignature:
    numerator: int
    denominator: int
    confidence: float

class AnalysisResult:
    bpm: float
    bpm_confidence: float
    key: Key
    time_signature: TimeSignature
    beat_times: list[float]
    beats: list[Beat]              # property: per-beat objects with strength
    # For chords, sections, timbre, dynamics, and rhythm, call the dedicated
    # detect_chords() / analyze_sections() / analyze_timbre() / ... functions.

class HpssResult:
    harmonic: list[float]
    percussive: list[float]
    length: int
    sample_rate: int

class StftResult:
    n_bins: int
    n_frames: int
    n_fft: int
    hop_length: int
    sample_rate: int
    magnitude: list[float]   # n_bins × n_frames, row-major
    power: list[float]       # n_bins × n_frames, row-major

class MelSpectrogramResult:
    n_mels: int
    n_frames: int
    sample_rate: int
    hop_length: int
    power: list[float]       # n_mels × n_frames, row-major
    db: list[float]          # n_mels × n_frames, row-major

class MfccResult:
    n_mfcc: int
    n_frames: int
    coefficients: list[float]  # n_mfcc × n_frames, row-major

class ChromaResult:
    n_chroma: int
    n_frames: int
    sample_rate: int
    hop_length: int
    features: list[float]    # n_chroma × n_frames, row-major
    mean_energy: list[float] # n_chroma values

class PitchResult:
    n_frames: int
    f0: list[float]          # Fundamental frequency per frame (Hz)
    voiced_prob: list[float] # Voicing probability per frame (0–1)
    voiced_flag: list[bool]  # Voiced/unvoiced decision per frame
    median_f0: float
    mean_f0: float

class StreamConfig:
    sample_rate: int = 44100
    n_fft: int = 2048
    hop_length: int = 512
    n_mels: int = 128
    fmin: float = 0.0
    fmax: float = 0.0
    tuning_ref_hz: float = 440.0
    compute_magnitude: bool = True
    compute_mel: bool = True
    compute_chroma: bool = True
    compute_onset: bool = True
    compute_spectral: bool = True
    emit_every_n_frames: int = 1
    magnitude_downsample: int = 1
    key_update_interval_sec: float = 5.0
    bpm_update_interval_sec: float = 10.0
    window: int = 0          # 0=Hann, 1=Hamming, 2=Blackman, 3=Rectangular
    output_format: int = 0  # 0=Float32, 1=Int16, 2=Uint8

class StreamFrames:
    n_frames: int
    n_mels: int
    timestamps: list[float]
    mel: list[float]        # n_frames × n_mels, row-major
    chroma: list[float]     # n_frames × 12, row-major
    onset_strength: list[float]
    rms_energy: list[float]
    spectral_centroid: list[float]
    spectral_flatness: list[float]
    chord_root: list[int]
    chord_quality: list[int]
    chord_confidence: list[float]

class StreamChordChange:
    root: int
    quality: int
    start_time: float
    confidence: float

class StreamBarChord:
    bar_index: int
    root: int
    quality: int
    start_time: float
    confidence: float

class StreamPatternScore:
    name: str
    score: float

class StreamStats:
    total_frames: int
    total_samples: int
    duration_seconds: float
    bpm: float
    bpm_confidence: float
    bpm_candidate_count: int
    key: int
    key_minor: bool
    key_confidence: float
    chord_root: int
    chord_quality: int
    chord_confidence: float
    chord_start_time: float
    current_bar: int
    bar_duration: float
    chord_progression: list[StreamChordChange]
    bar_chord_progression: list[StreamBarChord]
    voted_pattern: list[StreamBarChord]
    pattern_length: int
    detected_pattern_name: str
    detected_pattern_score: float
    all_pattern_scores: list[StreamPatternScore]
    accumulated_seconds: float
    used_frames: int
    updated: bool
```

## Streaming Analysis API

Use `StreamAnalyzer` when audio arrives in blocks: live capture, a callback loop, a long file you do not want to analyze all at once, or a visualization that needs frame-by-frame features. It keeps a small internal buffer, emits mel/chroma/onset/spectral frames, and periodically updates BPM, key, chord, bar, and pattern estimates.

```python
import libsonare as sonare

stream = sonare.StreamAnalyzer(
    sonare.StreamConfig(
        sample_rate=44100,
        n_mels=64,
        emit_every_n_frames=4,
        output_format=0,  # 0=Float32, 1=Int16, 2=Uint8
    )
)

for block in audio_blocks:
    stream.process(block)

    frames = stream.read_frames(stream.available_frames())
    # frames.mel is flattened [n_frames * n_mels]
    # frames.chroma is flattened [n_frames * 12]

    stats = stream.stats()
    if stats.bpm > 0:
        print(stats.bpm, stats.bpm_confidence)

stream.close()
```

For lower-bandwidth UI transfer, use a quantized read instead of `read_frames(max_frames)`:

| Method | What changes |
|--------|--------------|
| `read_frames_u8(max_frames)` | Feature arrays are quantized to unsigned 8-bit values. |
| `read_frames_i16(max_frames)` | Feature arrays are quantized to signed 16-bit values. |

Both return timestamps as floats. If you synchronize against an external audio clock, feed chunks with `process_with_offset(samples, sample_offset)` so returned timestamps follow that timeline.

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
# -> ['pop', 'edm', 'acoustic', 'hipHop', 'aiMusic', 'speech', 'streaming', 'youtube', 'broadcast', 'podcast', 'audiobook', 'cinema', 'jpop', 'ambient', 'lofi', 'classical', 'drumAndBass', 'techno', 'metal', 'trap', 'rnb', 'jazz', 'kpop', 'trance', 'gameOst']
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

profile = json.loads(sonare.mastering_audio_profile(samples, sample_rate=sample_rate, params={
    "n_fft": 2048,
    "hop_length": 512,
    "true_peak_oversample": 4,
}))
suggestions = json.loads(sonare.mastering_assistant_suggest(samples, sample_rate=sample_rate, params={
    "target_lufs": -14,
    "ceiling_db": -1,
    "prefer_streaming_safe": True,
}))
preview = json.loads(sonare.mastering_streaming_preview(samples, sample_rate=sample_rate, platforms=[
    {"name": "YouTube", "targetLufs": -14, "ceilingDb": -1},
    {"name": "Podcast", "targetLufs": -16, "ceilingDb": -1},
]))
```

`mastering_audio_profile()` accepts optional profile params: `n_fft`, `hop_length`, and `true_peak_oversample`. `mastering_assistant_suggest()` accepts `target_lufs`, `ceiling_db`, `enable_repair`, `prefer_streaming_safe`, and `speech_mono_amount`; camelCase aliases also work through the shared native parser.

Reference-track workflows use `mastering_pair_processor_names()`, `mastering_pair_process()`, `mastering_pair_analysis_names()`, and `mastering_pair_analyze()`. Pair inputs should use the same sample rate and comparable length.

### Progress callbacks

`mastering_chain()`, `mastering_chain_stereo()`, `master_audio()`, and
`master_audio_stereo()` accept an optional `on_progress=callable` keyword.

The callback receives `(progress: float, stage: str)` after each stage:

| Value | Meaning |
|-------|---------|
| `progress` | Overall progress from `0.0` to `1.0`. |
| `stage` | The named processor that just completed, such as `eq.tilt`, `dynamics.compressor`, or `loudness.targetLufs`. |

Use it to drive UI progress bars or to log per-stage timing.

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
| Generate an audio profile for mastering decisions | `mastering_audio_profile()` |
| Generate assistant suggestions from source analysis | `mastering_assistant_suggest()` |
| Preview delivery loudness by platform | `mastering_streaming_preview()` |
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

## Mixing API

Python also exposes the libsonare mixing engine. Use `mix_stereo(...)` for one-shot stem rendering, or keep a `Mixer` loaded from scene JSON when you need sends, buses, automation, meters, and scene serialization.

```python
import libsonare as sonare

scene_json = sonare.mixing_scene_preset_json("vocalReverbSend")

offline = sonare.mix_stereo(
    [(vocal_l, vocal_r), (music_l, music_r)],
    sample_rate=48000,
    input_trim_db=[3, 0],
    fader_db=[-3, -12],
    pan=[0, -0.2],
    width=[1, 0.9],
)

with sonare.Mixer.from_scene_json(scene_json, sample_rate=48000, block_size=512) as mixer:
    block = mixer.process_stereo([vocal_block_l, music_block_l], [vocal_block_r, music_block_r])
    meter = mixer.strip_meter(0, tap="postFader")
    mixer.schedule_fader_automation(0, 48000 * 8, -6, curve="s-curve")
```

See [Mixing Engine](./mixing.md) for routing concepts, scene presets, and real-time notes.
