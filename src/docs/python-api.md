# Python API

libsonare provides Python bindings for scripts, notebooks, batch jobs, and local desktop tools. The package calls the native libsonare library through **ctypes**, so Python code can use the compiled C/C++ engine without building a custom extension. PyPI wheels are available for supported Linux and macOS targets.

::: details What is ctypes (and the C API)?
libsonare's core is compiled C/C++. **ctypes** is Python's built-in way to call functions in a compiled shared library (`.so`/`.dylib`) directly, with no extra C extension to build. The Python package forwards your calls to the same native code the C++ library runs, so you get native speed from plain Python. ("C API" means the flat set of C functions Python calls under the hood.)
:::

Use this page when you want scripts, notebooks, batch analysis, or local tools that can read files directly. The Python package is usually the easiest route if you are not building a browser UI.

## Python Mental Model

| Step | What happens |
|------|--------------|
| 1. Load audio | `Audio.from_file(...)` reads supported file formats into samples |
| 2. Inspect or process | Call `detect_bpm`, `analyze`, feature functions, editing DSP, mastering, or mixing APIs |
| 3. Use results | Print values, save JSON, render audio, or feed features into your own pipeline |

Most Python APIs accept raw sample arrays plus `sample_rate`. Raw samples are the decoded audio values, not an MP3 or WAV filename. The `Audio` object is a convenience for file-based workflows: load once, then call analysis or processing methods on the same object.

For a first script, keep it this small:

1. `audio = sonare.Audio.from_file("song.mp3")`;
2. call `sonare.detect_bpm(audio.samples, audio.sample_rate)` or `sonare.analyze(audio.samples, audio.sample_rate)`;
3. print the result or save it as JSON.

::: tip Start with `Audio` or call functions directly
If your workflow begins with an audio file, start with `Audio.from_file(...)`. If you already have samples from NumPy or another loader, call module-level functions such as `detect_bpm(samples, sample_rate)` directly.
:::

## How To Read This Reference

Read this page in three passes:

1. If you are loading files, start with `Audio.from_file(...)`; if you already have samples, call the module-level functions directly.
2. Use [Pick The Smallest API That Solves The Job](#pick-the-smallest-api-that-solves-the-job) to choose a function family instead of scanning the full reference.
3. Return to [Types](#types) only when you need exact attribute names, row-major matrix shapes, or JS parity aliases.

A single `analyze(...)` call returns the all-in-one analysis result — chords, sections, timbre, dynamics, rhythm, melody, form, and per-beat strength — matching the other bindings. Reach for the focused functions below when you only need one field or want per-call options.

::: info Default sample rate varies by family
Music-analysis and metering helpers default to `sample_rate=22050`; room-acoustic helpers (`analyze_impulse_response`, `detect_acoustic`, `estimate_room`) default to `48000`. When you load with `Audio.from_file(...)`, always pass `audio.sample_rate` so the per-family default never silently applies to audio recorded at a different rate.
:::

## Pick The Smallest API That Solves The Job

| You need | Start with | Why |
|----------|------------|-----|
| A script that reads files and prints metadata | `Audio.from_file(...)` + `detect_bpm` / `detect_key` / `analyze` | Python handles decoding and keeps the code short |
| Detailed music analysis | `analyze_bpm`, `detect_chords`, `analyze_sections`, `analyze_timbre`, `analyze_dynamics`, `analyze_rhythm` | These run a single facet of analysis with extra parameters; `analyze(...)` already returns all of these fields in one `AnalysisResult` |
| Feature arrays for notebooks or ML | `mel_spectrogram`, `mfcc`, `chroma`, `cqt`, `vqt`, `chroma_cqt`, `nnls_chroma` | Returns plain Python lists / result objects that can be converted to NumPy if desired |
| Editing a clip | `time_stretch`, `pitch_shift`, `pitch_correct_to_midi`, `note_stretch`, `voice_change`, `RealtimeVoiceChanger` | These transform the signal itself |
| Mastering a file | `master_audio`, `mastering_chain`, `StreamingMasteringChain` | Presets first, explicit chain config when you need control |
| Live or chunked analysis | `StreamAnalyzer` | Feed audio blocks, drain feature frames, and read BPM/key/chord estimates that update as more audio arrives |
| Stem mixing | `mix_stereo` or `Mixer.from_scene_json(...)` | One-shot arrays first; scene mixer for sends, buses, automation, and meters |
| Room decay, clarity, equivalent-room estimates, or generated room character | `analyze_impulse_response`, `detect_acoustic`, `estimate_room`, `synthesize_rir`, `room_morph` | These describe or apply the room, not the song |

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

# All-in-one analysis
result = analyze(audio.data, audio.sample_rate)
print(f"BPM: {result.bpm} ({result.bpm_confidence:.0%})")
print(f"Key: {result.key}")
print(f"Time Signature: {result.time_signature}")
print(f"Beats: {len(result.beat_times)} detected")
```

### Error handling

Errors raise `SonareError`, a `RuntimeError` subclass carrying the native error code in its `.code` attribute, so `except RuntimeError:` continues to work while `except sonare.SonareError as e:` gives you the code. The codes are the same C-ABI values the JS bindings expose as `ErrorCode` (see [Error Handling](./js-api.md#error-handling)), and the CLI maps them onto its [exit codes](./cli.md#exit-codes).

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

For region-based time/frequency edits, use `spectral_edit(samples, sample_rate, [SpectralRegionOp(...)])`; see [Spectral Editing](./spectral-editing.md).

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

<SonareDemo id="mel-spectrogram" />

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

The Python `Audio` object has more built-in methods than the WASM `Audio` object.

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
| `analyze(samples, sample_rate)` | `AnalysisResult` | All-in-one analysis: BPM, key, time signature, beats, chords, sections, timbre, dynamics, rhythm, melody, form |
| `analyze_with_progress(samples, sample_rate, on_progress?)` | `AnalysisResult` | Same result as `analyze`, with an optional `(progress, stage)` callback |
| `analyze_bpm(samples, sample_rate, ...)` | `BpmAnalysisResult` | BPM with top candidates |
| `chord_functional_analysis(samples, key_root, key_mode?, ...)` | `list[str]` | Roman-numeral labels (`"I"`, `"IV"`, `"V"`, `"vi"`, ...) for detected chords, relative to a key |
| `analyze_rhythm(samples, sample_rate, ...)` | `RhythmResult` | Syncopation, groove type, regularity |
| `analyze_dynamics(samples, sample_rate, ...)` | `DynamicsResult` | Dynamic range, loudness range, crest factor |
| `analyze_timbre(samples, sample_rate, ...)` | `TimbreResult` | Brightness, warmth, density, roughness, complexity, plus per-window `timbre_over_time` (`timbreOverTime` alias) |
| `analyze_sections(samples, sample_rate, ...)` | `SectionResult` | Song-structure sections (intro/verse/chorus/...) |
| `analyze_melody(samples, sample_rate, ...)` | `MelodyResult` | Monophonic melody contour (YIN) |
| `analyze_impulse_response(samples, sample_rate, ...)` | `AcousticResult` | Room acoustics from an impulse response (RT60/EDT/C50/C80) |
| `detect_acoustic(samples, sample_rate, ...)` | `AcousticResult` | Blind room-acoustic estimation |
| `estimate_room(samples, sample_rate, ...)` | `RoomEstimate` | Equivalent-room estimate with volume, dimensions, DRR, absorption bands, RT60 bands, and confidence |
| `synthesize_rir(length_m, width_m, height_m, ...)` | `RirResult` | Mono room impulse response from shoebox geometry |
| `room_morph(samples, sample_rate, length_m, width_m, height_m, ...)` | `list[float]` | Offline creative morph toward a target room |
| `version()` | `str` | Library version |
| `voice_changer_abi_version()` | `int` | ABI version of the realtime voice-changer POD config; separate from preset JSON `schemaVersion` |
| `voice_character_preset_id(preset)` | `str \| None` | Canonical voice-character preset ID for an integer ordinal |
| `realtime_voice_changer_preset_config(preset)` | `RealtimeVoiceChangerConfig` | Resolved flat POD config for a built-in voice preset, without JSON parsing |
| `engine_abi_version()` | `int` | ABI version of the realtime engine interface |
| `project_abi_version()` | `int` | ABI version of the project/editing API used by `Project` serialization, bounce, and realtime clip exchange |
| `has_ffmpeg_support()` | `bool` | Whether the loaded native library can decode via FFmpeg |

Most core analysis, effects, feature, loudness, and mastering helpers are also
available as `Audio` instance methods (e.g., `audio.detect_bpm()`). Some focused
helpers such as `analyze_sections(...)`, `analyze_melody(...)`, `cqt(...)`, and
`vqt(...)` remain standalone functions; pass `audio.data` and
`audio.sample_rate` to those.

In Python, `analyze(...)` calls `sonare_analyze_json` and returns the all-in-one `AnalysisResult`: BPM (with confidence), key, time signature, beat times and per-beat strengths, chords, sections, timbre, dynamics, rhythm, melody, and form. The focused functions above remain useful when you want a single facet, parameterized/targeted analysis, or to avoid recomputing the whole result. (Acoustic/room metrics are separate — see `estimate_room` and the room helpers; they are not part of `AnalysisResult`.)

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
    key_root=keys[0].key.root,
    key_mode=keys[0].key.mode,
    chroma_method="nnls",
)

sections = sonare.analyze_sections(audio.data, audio.sample_rate)
```

For long files, `analyze_with_progress(...)` returns the same `AnalysisResult` as `analyze(...)` but accepts an `on_progress=(progress, stage)` callback, mirroring the mastering progress callbacks below:

```python
def on_step(progress: float, stage: str) -> None:
    print(f"{progress:5.1%}  {stage}")

result = sonare.analyze_with_progress(audio.data, audio.sample_rate, on_progress=on_step)
```

To label chords with Roman numerals relative to a key, use `chord_functional_analysis(...)`. It detects chords with the same algorithm as `detect_chords(...)`, then returns one label per detected chord, in chord order:

```python
labels = sonare.chord_functional_analysis(
    audio.data,
    key_root=keys[0].key.root,
    key_mode=keys[0].key.mode,
    sample_rate=audio.sample_rate,
    use_key_context=True,
)
print(labels)  # e.g. ['I', 'V', 'vi', 'IV']
```

## Room Acoustics

Use these functions for the room or playback space, not for song structure.

| Goal | Use |
|------|-----|
| Measure a clean impulse response | `analyze_impulse_response(...)` |
| Estimate room decay from ordinary audio | `detect_acoustic(...)` |
| Fit a practical room model from audio | `estimate_room(...)` |
| Create a mono room impulse response from dimensions | `synthesize_rir(...)` |
| Add a target-room character as an effect | `room_morph(...)` |

::: info Defaults and terms
`analyze_impulse_response(...)` and `detect_acoustic(...)` return `AcousticResult` with RT60, EDT, C50, C80, D50, per-band arrays, confidence, and `is_blind`. Their `sample_rate` default is `48000`, unlike most music-analysis helpers that default to `22050`. RIR means room impulse response.
:::

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

estimate = sonare.estimate_room(room_recording, sample_rate, n_octave_bands=6)
print(estimate.volume, estimate.length, estimate.width, estimate.height)
print(estimate.drr_db, estimate.confidence, estimate.absorption_bands)

rir = sonare.synthesize_rir(7.0, 5.0, 3.0, absorption=0.2, sample_rate=sample_rate)
print(rir.sample_rate, len(rir.rir), rir.has_error)

morphed = sonare.room_morph(room_recording, sample_rate, 12.0, 9.0, 4.0, wet=0.6)
```

Keep three cautions in mind:

- `estimate_room(...)` returns an equivalent room, not guaranteed real geometry; inspect `confidence`.
- `synthesize_rir(...)` reports invalid source/listener placement through `has_error`.
- `room_morph(...)` is a creative effect, not dereverberation.

See [Room Acoustics](./acoustic-analysis.md) for interpretation notes and when a blind estimate is appropriate.

### Effects Functions

| Function | Return Type | Description |
|----------|-------------|-------------|
| `hpss(samples, sample_rate, kernel_harmonic?, kernel_percussive?)` | `HpssResult` | Harmonic-Percussive Source Separation |
| `harmonic(samples, sample_rate)` | `list[float]` | Extract harmonic component |
| `percussive(samples, sample_rate)` | `list[float]` | Extract percussive component |
| `time_stretch(samples, sample_rate, rate)` | `list[float]` | Time-stretch without pitch change |
| `pitch_shift(samples, sample_rate, semitones)` | `list[float]` | Pitch-shift without tempo change |
| `pitch_correct_to_midi(samples, sample_rate, current_midi?, target_midi?)` | `list[float]` | Pitch-correct toward a target MIDI note |
| `pitch_correct_to_midi_timevarying(samples, f0_hz, target_midi, sample_rate?, hop_length?, voiced?, voiced_prob?)` | `list[float]` | Contour-following pitch correction: retunes every voiced frame toward `target_midi` along a per-frame `f0_hz` contour, preserving vibrato/drift instead of flattening it |
| `note_stretch(samples, sample_rate, onset_sample?, offset_sample?, stretch_ratio?)` | `list[float]` | Stretch a single note region in place |
| `voice_change(samples, sample_rate, pitch_semitones?, formant_factor?)` | `list[float]` | Independent pitch + formant shift |
| `voice_change_realtime(samples, sample_rate?, preset?, channels?)` | `np.ndarray` | One-shot render through the realtime voice preset chain |
| `normalize(samples, sample_rate, target_db?)` | `list[float]` | Normalize to target dB (default: 0.0) |
| `trim(samples, sample_rate, threshold_db?)` | `list[float]` | Trim silence (default: -60.0 dB) |
| `resample(samples, src_sr, target_sr)` | `list[float]` | Resample to target sample rate |

`trim(...)` is the simple threshold-based edit helper. The librosa-compatible `trim_silence(...)` helper below uses frame RMS and `top_db`, and returns the trimmed audio together with its original sample range.

### Realtime voice changer

`RealtimeVoiceChanger` wraps the same preset-based live voice chain exposed by WASM and Node native. It keeps retune, formant, EQ, gate, compressor, de-esser, reverb, and limiter state across blocks. Use it instead of `voice_change(...)` when processing microphone or stream blocks.

```python
import json
import libsonare as sonare

print(sonare.realtime_voice_changer_preset_names())
print(sonare.voice_changer_abi_version())  # native POD-config ABI version
print(sonare.voice_character_preset_id(1))  # "bright-idol"
preset_json = sonare.realtime_voice_changer_preset_json("bright-idol")
print(sonare.validate_realtime_voice_changer_preset_json(preset_json)["ok"])
preset_config = sonare.realtime_voice_changer_preset_config("bright-idol")  # canonical RealtimeVoiceChangerConfig

with sonare.RealtimeVoiceChanger(48000, preset="bright-idol", max_block_size=128) as changer:
    out = changer.process_mono(input_block)
    changer.set_config(json.loads(preset_json))
    print(changer.latency_samples(), changer.config_json(), out.shape)

# Convenience one-shot render through the same realtime chain.
processed = sonare.voice_change_realtime(vocal, sample_rate=48000, preset="soft-whisper")
```

Preset IDs currently include `neutral-monitor`, `bright-idol`, `soft-whisper`, `deep-narrator`, `robot-mascot`, and `dark-villain`.

Use `realtime_voice_changer_preset_config(preset)` when you want the resolved POD config rather than the JSON form. It returns the canonical, normalized `RealtimeVoiceChangerConfig` for a built-in preset by ID or index.

`realtime_voice_changer_preset_pod(preset)` remains as a compatibility alias.

### Feature Extraction Functions

| Function | Return Type | Description |
|----------|-------------|-------------|
| `stft(samples, sample_rate, n_fft?, hop_length?)` | `StftResult` | Short-Time Fourier Transform |
| `stft_db(samples, sample_rate, n_fft?, hop_length?)` | `tuple` | STFT in decibels |
| `mel_spectrogram(samples, sample_rate, n_fft?, hop_length?, n_mels?, fmin?, fmax?, htk?)` | `MelSpectrogramResult` | Mel spectrogram; `fmin`/`fmax` bound the band edges, `htk=True` uses the HTK Mel formula |
| `mfcc(samples, sample_rate, n_fft?, hop_length?, n_mels?, n_mfcc?, fmin?, fmax?, htk?, lifter?)` | `MfccResult` | Mel-Frequency Cepstral Coefficients (`lifter=0.0` disables cepstral liftering) |
| `chroma(samples, sample_rate, n_fft?, hop_length?)` | `ChromaResult` | Chroma features (pitch class distribution) |
| `spectral_centroid(samples, sample_rate, n_fft?, hop_length?)` | `list[float]` | Spectral centroid per frame |
| `spectral_bandwidth(samples, sample_rate, n_fft?, hop_length?)` | `list[float]` | Spectral bandwidth per frame |
| `spectral_rolloff(samples, sample_rate, n_fft?, hop_length?, roll_percent?)` | `list[float]` | Spectral rolloff per frame |
| `spectral_flatness(samples, sample_rate, n_fft?, hop_length?)` | `list[float]` | Spectral flatness per frame |
| `spectral_contrast(samples, sample_rate?, n_fft?, hop_length?, n_bands?, fmin?, quantile?)` | `np.ndarray` | Spectral contrast, shape `(n_bands + 1, n_frames)` |
| `poly_features(samples, sample_rate?, n_fft?, hop_length?, order?)` | `np.ndarray` | Per-frame polynomial spectral coefficients |
| `zero_crossing_rate(samples, sample_rate, frame_length?, hop_length?)` | `list[float]` | Zero-crossing rate per frame |
| `zero_crossings(samples, threshold?, ref_magnitude?, pad?, zero_pos?)` | `np.ndarray` | Sample indices where the waveform crosses zero |
| `waveform_peaks(samples, channels, *, samples_per_bucket=512, validate=True)` | `WaveformPeaksReport` | Reduce interleaved multichannel audio (length a multiple of `channels`) to per-channel min/max buckets for waveform drawing; `min`/`max` are channel-major (`channel * bucket_count + bucket`) |
| `waveform_peak_pyramid(samples, channels, *, samples_per_bucket_levels=(512, 1024, 2048, 4096), validate=True)` | `list[WaveformPeaksReport]` | One peaks report per zoom level (one entry per bucket width) |
| `rms_energy(samples, sample_rate, frame_length?, hop_length?)` | `list[float]` | RMS energy per frame |
| `pitch_yin(samples, sample_rate, frame_length?, hop_length?, fmin?, fmax?, threshold?, fill_na?)` | `PitchResult` | YIN pitch estimation; unvoiced `f0` stays `nan` unless `fill_na=True` |
| `pitch_pyin(samples, sample_rate, frame_length?, hop_length?, fmin?, fmax?, threshold?, fill_na?)` | `PitchResult` | pYIN pitch estimation; unvoiced `f0` stays `nan` unless `fill_na=True` |
| `pitch_tuning(frequencies, resolution?, bins_per_octave?)` | `float` | Global tuning offset from detected frequencies, in fractions of a bin |
| `estimate_tuning(samples, sample_rate?, n_fft?, hop_length?, resolution?, bins_per_octave?)` | `float` | Estimate tuning offset directly from audio |
| `cqt(samples, sample_rate, hop_length?, fmin?, n_bins?, bins_per_octave?)` | `CqtResult` | Constant-Q Transform magnitude |
| `vqt(samples, sample_rate, hop_length?, fmin?, n_bins?, bins_per_octave?, gamma?)` | `CqtResult` | Variable-Q Transform magnitude |
| `hybrid_cqt(samples, sample_rate?, hop_length?, fmin?, n_bins?, bins_per_octave?)` | `CqtResult` | Hybrid CQT magnitude (CQT/pseudo-CQT blend across bins) |
| `pseudo_cqt(samples, sample_rate?, hop_length?, fmin?, n_bins?, bins_per_octave?)` | `CqtResult` | Approximate (pseudo) CQT magnitude |
| `bass_chroma(samples, sample_rate?, hop_length?, n_chroma?)` | `ChromaResult` | Bass-focused chroma (low-register pitch-class distribution) |
| `chroma_cens(samples, sample_rate?, hop_length?, n_chroma?)` | `ChromaResult` | CENS energy-normalized/smoothed chroma |
| `chroma_cqt(samples, sample_rate?, hop_length?, n_chroma?)` | `tuple[int, list[float]]` | Constant-Q chromagram (`librosa.feature.chroma_cqt` equivalent) — returns `(n_frames, row-major 12 x n_frames data)` |
| `nnls_chroma(samples, sample_rate)` | `tuple[int, list[float]]` | NNLS chromagram — returns `(n_frames, row-major 12 x n_frames data)` |
| `decompose(s, n_features, n_frames, n_components, n_iter?, beta?)` | `tuple` | NMF decomposition factors `(w, h)` from a row-major spectrogram |
| `decompose_with_init(s, n_features, n_frames, n_components, n_iter?, beta?, init?)` | `tuple` | NMF decomposition `(w, h)` with a selectable initialiser; `init` defaults to `'random'`, also accepts `'nndsvd'` (SVD warm start) |
| `nn_filter(s, n_features, n_frames, aggregate?, k?, width?)` | `np.ndarray` | Nearest-neighbor filtering of a row-major spectrogram |
| `onset_envelope(samples, sample_rate, n_fft?, hop_length?, n_mels?)` | `list[float]` | Onset strength envelope (input to the tempogram family) |
| `onset_strength_multi(samples, sample_rate?, n_fft?, hop_length?, n_mels?, n_bands?)` | `tuple[int, list[float]]` | Multi-band onset strength; returns `(n_frames, [n_bands x n_frames])` row-major (`n_bands` default 3) |
| `lufs(samples, sample_rate)` | `LufsResult` | Integrated/momentary/short-term LUFS + loudness range (EBU R128) |
| `lufs_interleaved(samples, channels, sample_rate?)` | `LufsResult` | Channel-weighted multichannel loudness from interleaved samples |
| `ebur128_loudness_range(samples, sample_rate?)` | `float` | EBU R128 loudness range (LRA) in LU |
| `momentary_lufs(samples, sample_rate)` | `list[float]` | Momentary LUFS per frame |
| `short_term_lufs(samples, sample_rate)` | `list[float]` | Short-term LUFS per frame |

Default parameters: `n_fft=2048`, `hop_length=512`, `n_mels=128`, `n_mfcc=20`, pitch `fmin=65.0`, `fmax=2093.0`, `threshold=0.3`, `roll_percent=0.85`. CQT/VQT use `fmin=32.70319566` Hz (C1), `n_bins=84`, and `bins_per_octave=12`.

Additional effect helpers include `remix(samples, intervals, sample_rate?, align_zeros?)`, `phase_vocoder(samples, sample_rate?, rate?)`, and `hpss_with_residual(samples, sample_rate?, kernel_harmonic?, kernel_percussive?)`. Use them when you need librosa-style interval remixing, direct phase-vocoder time scaling, or HPSS with the residual signal preserved.

### Inverse Reconstruction Functions

Reconstruct a spectrum or audio from a mel spectrogram or MFCC matrix. Phase is estimated with Griffin-Lim, so the round-trip is lossy — see [Inverse Features](./inverse-features.md). Matrix inputs are row-major.

| Function | Return Type | Description |
|----------|-------------|-------------|
| `mel_to_stft(mel, n_mels, n_frames, sample_rate?, n_fft?, fmin?, fmax?, htk?)` | `InverseResult` | Linear STFT power from a mel spectrogram |
| `mel_to_audio(mel, n_mels, n_frames, sample_rate?, n_fft?, hop_length?, fmin?, fmax?, n_iter?, htk?)` | `list[float]` | Audio from a mel spectrogram (Griffin-Lim) |
| `mfcc_to_mel(mfcc_coeffs, n_mfcc, n_frames, n_mels?)` | `InverseResult` | Mel spectrogram (dB) from MFCC coefficients |
| `mfcc_to_audio(mfcc_coeffs, n_mfcc, n_frames, n_mels?, sample_rate?, n_fft?, hop_length?, fmin?, fmax?, n_iter?, htk?)` | `list[float]` | Audio from MFCC coefficients |

Pass `0.0` for `fmin`/`fmax` to use the full-band defaults; `n_iter` defaults to `32`. Keep `fmin`/`fmax`/`htk` identical to the values used by the forward transform so the round-trip stays consistent.

### Metering Functions

Standalone level, dynamics, and stereo-image meters. Each accepts a keyword-only `validate` flag (default `True`); pass `validate=False` to skip NaN/Inf input checks on hot paths. The stereo meters require `left` and `right` to be equal length. `sample_rate` defaults to `22050`.

| Function | Return Type | Description |
|----------|-------------|-------------|
| `metering_peak_db(samples, sample_rate?, *, validate?)` | `float` | Sample peak (dBFS) |
| `metering_rms_db(samples, sample_rate?, *, validate?)` | `float` | RMS level (dBFS) |
| `metering_crest_factor_db(samples, sample_rate?, *, validate?)` | `float` | Crest factor, peak − RMS (dB) |
| `metering_dc_offset(samples, sample_rate?, *, validate?)` | `float` | Mean (DC) offset, linear amplitude |
| `metering_true_peak_db(samples, sample_rate?, oversample_factor?, *, validate?)` | `float` | Inter-sample (true) peak (dBFS); `oversample_factor` is a power of two in 1..16 (0 = default 4) |
| `metering_detect_clipping(samples, sample_rate?, threshold?, min_region_samples?, *, validate?)` | `ClippingReport` | Clipped-sample runs; `threshold` default `0.999`, `min_region_samples` default `1` |
| `metering_dynamic_range(samples, sample_rate?, window_sec?, hop_sec?, low_percentile?, high_percentile?, *, validate?)` | `DynamicRangeReport` | Sliding-window dynamic range; pass `0.0` for `window_sec`/`hop_sec` defaults (3 s / 1 s); pass a negative value (the default `-1.0`) for `low_percentile`/`high_percentile` defaults (0.10 / 0.95) — `0.0` requests the 0th percentile, not the default |
| `metering_stereo_correlation(left, right, sample_rate?, *, validate?)` | `float` | Pearson correlation, −1..1 |
| `metering_stereo_width(left, right, sample_rate?, *, validate?)` | `float` | Mid/side stereo width |
| `metering_vectorscope(left, right, sample_rate?, *, validate?)` | `VectorscopeReport` | Per-sample mid/side point series |
| `metering_vectorscope_decimated(left, right, sample_rate?, max_points?, *, validate?)` | `VectorscopeReport` | Display-sized mid/side vectorscope; `max_points` upper-bounds the point count (`0` or a value ≥ buffer length = one point per sample, identical to `metering_vectorscope`); otherwise deterministically decimated, keeping the largest-radius sample per bucket |
| `metering_phase_scope(left, right, sample_rate?, *, validate?)` | `PhaseScopeReport` | Phase-scope point series plus summary stats |
| `metering_phase_scope_decimated(left, right, sample_rate?, max_points?, *, validate?)` | `PhaseScopeReport` | Display-sized phase-scope (Lissajous + summary stats); `max_points` upper-bounds the point cloud the same way; summary stats are always computed over the full-resolution signal |
| `metering_spectrum(samples, sample_rate?, n_fft?, apply_octave_smoothing?, octave_fraction?, db_ref?, db_amin?, *, validate?)` | `SpectrumReport` | Welch-averaged magnitude/power/dB spectrum over the whole buffer (Hann-windowed, 50%-overlapping `n_fft` frames; not a single-frame snapshot); pass `0` for `n_fft`/`octave_fraction`/`db_ref`/`db_amin` defaults (2048 / 3 / 1.0 / floor) |
| `metering_spectrum_frame(samples, sample_rate?, frame_offset?, n_fft?, apply_octave_smoothing?, octave_fraction?, db_ref?, db_amin?, *, validate?)` | `SpectrumReport` | True single-frame spectrum (one Hann-windowed FFT) spanning `[frame_offset, frame_offset + n_fft)`, zero-padded past the end; pass `0` for `frame_offset`/`n_fft`/`octave_fraction`/`db_ref`/`db_amin` defaults |

### Scale Quantization

12-TET scale helpers for building pitch-correction targets. `mode_mask` is a 12-bit mask where bit *i* enables the *i*-th pitch class relative to `root` (`PitchClass`, C = 0); natural major is `0b101010110101`. `reference_midi` is the tuning anchor (pass `0.0` for A4 = 69). Pair with `pitch_correct_to_midi(...)` to retune to the nearest scale degree.

| Function | Return Type | Description |
|----------|-------------|-------------|
| `scale_quantize_midi(root, mode_mask, midi, reference_midi?)` | `float` | Snap a (fractional) MIDI number to the nearest enabled pitch class |
| `scale_correction_semitones(root, mode_mask, midi, reference_midi?)` | `float` | Correction (quantized − input), in semitones |
| `scale_pitch_class_enabled(root, mode_mask, pitch_class)` | `bool` | Whether `pitch_class` (0..11) is enabled relative to `root` |

### librosa-Compatible Helpers

These mirror the corresponding `librosa` functions —
see [librosa Compatibility](./librosa-compatibility.md) for the function each
helper matches.

::: tip What each helper is for
- **`preemphasis` / `deemphasis`** — classic one-tap IIR pre-processing that boosts (or undoes) high frequencies.
- **`trim_silence` / `split_silence`** — trim leading/trailing silence or split on silent gaps.
- **`frame_signal` / `pad_center` / `fix_length` / `fix_frames`** — framing and size-alignment utilities for fixed-frame DSP.
- **`peak_pick` / `vector_normalize`** — peak detection on 1-D signals (e.g. onset envelopes) and vector-norm normalization.
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

class KeyProfile(IntEnum):
    KRUMHANSL_SCHMUCKLER = 0
    TEMPERLEY = 1
    SHAATH = 2
    FARALDO_EDMT = 3
    FARALDO_EDMA = 4
    FARALDO_EDMM = 5
    BELLMAN_BUDGE = 6

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
    beat_strengths: list[float]    # per-beat strength
    beats: list[Beat]              # property: per-beat objects with strength
    chords: list[Chord]
    sections: list[Section]
    timbre: AnalysisTimbre | None
    dynamics: AnalysisDynamics | None
    rhythm: AnalysisRhythm | None
    melody: AnalysisMelody | None
    form: str
    # The focused detect_chords() / analyze_sections() / analyze_timbre() / ...
    # functions remain useful for a single facet or per-call options.

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

class WaveformPeaksReport:
    min: NDArray[np.float32]   # channel-major: channel * bucket_count + bucket
    max: NDArray[np.float32]   # channel-major
    channels: int
    bucket_count: int
    samples_per_bucket: int

class StreamConfig:
    sample_rate: int = 44100
    n_fft: int = 2048
    hop_length: int = 512
    n_mels: int = 128
    fmin: float = 0.0
    fmax: float = 0.0
    tuning_ref_hz: float = 440.0
    compute_magnitude: bool = False
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

Additional Python result classes used by focused APIs:

| Area | Classes |
|------|---------|
| Metering | `ClippingRegion`, `StreamFramesU8`, `StreamFramesI16`, `WaveformPeaksReport` |
| Mastering | `MasteringResult`, `MasteringStereoResult` |
| Mixing | `MixerStereoResult` |
| Projects | `AssistSidecar` (return type of `project.get_assist_sidecar(index)` / `project.assist_sidecars()` — see [Project Editing](./project-editing.md#assist-sidecars)), `NotePairValidation` |
| Realtime engine telemetry | `MeterTelemetryRecord` |

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
| `read_frames_u8(max_frames, quantize_config?)` | Feature arrays are quantized to unsigned 8-bit values. |
| `read_frames_i16(max_frames, quantize_config?)` | Feature arrays are quantized to signed 16-bit values. |

`quantize_config` is an optional `QuantizeConfig` (exported from `libsonare`) that widens the quantization ranges for streams much louder or quieter than the defaults; omit it to use the defaults. Its fields and defaults are `mel_db_min=-80.0`, `mel_db_max=0.0`, `onset_max=50.0`, `rms_max=1.0`, `centroid_max=11025.0`. The quantizers clamp normalized values to `[0, 1]`, so a signal outside these ranges otherwise saturates silently to the endpoints. This mirrors `StreamQuantizeConfig` in the JS/WASM streaming docs.

Both return timestamps as floats. If you synchronize against an external audio clock, feed chunks with `process_with_offset(samples, sample_offset)` so returned timestamps follow that timeline.

## Streaming Equalizer API

`StreamingEqualizer` wraps the native block-by-block EQ engine. Use it for live preview, processor UIs, or matching a source tone to a reference without assembling a mastering chain.

```python
with sonare.StreamingEqualizer(sample_rate=48000, max_block_size=512) as eq:
    eq.set_band(0, {"type": "bell", "frequencyHz": 2500, "gainDb": 2.5, "q": 1.0})
    eq.set_phase_mode("natural")
    eq.set_auto_gain(True)
    eq.match(source_samples, reference_samples, max_bands=8)
    out = eq.process_mono(input_block)
    snapshot = eq.spectrum()
```

Bands can be Python dictionaries or JSON strings. `set_phase_mode(...)` accepts `zero` / `natural` / `linear` names or numeric values. The object also exposes output gain/pan, sidechain input for dynamic bands, `process_stereo(...)`, `spectrum()`, `latency_samples`, and `last_auto_gain_db`.

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

catalog = sonare.mastering_processor_catalog()
insert_params = sonare.mastering_insert_param_info("eq.parametric")

# Preset-driven chain (one-shot)
sonare.mastering_preset_names()
# -> ['pop', 'edm', 'acoustic', 'hipHop', 'aiMusic', 'speech', 'streaming', 'youtube', 'broadcast', 'podcast', 'audiobook', 'cinema', 'jpop', 'ambient', 'lofi', 'classical', 'drumAndBass', 'techno', 'metal', 'trap', 'rnb', 'jazz', 'kpop', 'trance', 'gameOst']
chain_result = sonare.master_audio(
    samples,
    sample_rate=sample_rate,
    preset_name="aiMusic",
    overrides={
        "loudness.targetLufs": -13,
        "maximizer.truePeakLimiter.releaseMs": 50,
        "maximizer.truePeakLimiter.applyGainAtInputRate": False,
    },
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

Mastering helpers also accept limiter-release and static-gain staging controls. The simple `mastering()` helper uses `release_ms` (`0` keeps the 50 ms library default) and `apply_gain_at_input_rate`. Preset/chain overrides use the flat keys `"maximizer.truePeakLimiter.releaseMs"` and `"maximizer.truePeakLimiter.applyGainAtInputRate"`; supplied override values are applied directly.

Reference-track workflows use `mastering_pair_processor_names()`, `mastering_pair_process()`, `mastering_pair_analysis_names()`, and `mastering_pair_analyze()`. Pair inputs should use the same sample rate and comparable length.

### Standalone dynamics and repair

Every named stage is also a one-shot module-level function, so you can run a single processor without assembling a chain. Parameters are keyword-only and mirror the corresponding `MasteringChainConfig` keys in snake_case. The dynamics processors return `(processed_samples, latency_samples)`, where `latency_samples` is an `int`; the repair processors return processed samples (`np.ndarray`).

| Function | Returns | Key parameters |
|----------|---------|----------------|
| `mastering_dynamics_compressor(samples, sample_rate?, *, ...)` | `tuple[np.ndarray, int]` | `threshold_db=-18.0`, `ratio=2.0`, `attack_ms=10.0`, `release_ms=100.0`, `knee_db`, `makeup_gain_db`, `auto_makeup`, `detector='rms'`, `sidechain_hpf_enabled`, `sidechain_hpf_hz`, `pdr_time_ms`, `pdr_release_scale` |
| `mastering_dynamics_gate(samples, sample_rate?, *, ...)` | `tuple[np.ndarray, int]` | `threshold_db=-50.0`, `attack_ms=2.0`, `release_ms=80.0`, `range_db=-80.0`, `hold_ms`, `close_threshold_db`, `key_hpf_hz` |
| `mastering_dynamics_transient_shaper(samples, sample_rate?, *, ...)` | `tuple[np.ndarray, int]` | `attack_gain_db=3.0`, `sustain_gain_db`, `fast_attack_ms`, `fast_release_ms=20.0`, `slow_attack_ms=15.0`, `slow_release_ms=200.0`, `sensitivity=1.0`, `max_gain_db=12.0`, `gain_smoothing_ms`, `lookahead_ms` |
| `mastering_repair_declick(samples, sample_rate?, *, ...)` | `np.ndarray` | `threshold=0.8`, `neighbor_ratio=4.0`, `max_click_samples=8`, `lpc_order=20`, `residual_ratio=8.0` |
| `mastering_repair_declip(samples, sample_rate?, *, ...)` | `np.ndarray` | `clip_threshold=0.98`, `lpc_order=36`, `iterations=2`, `lpc_blend=0.65` |
| `mastering_repair_decrackle(samples, sample_rate?, *, ...)` | `np.ndarray` | `threshold=0.4`, `mode='median'`, `levels=4` |
| `mastering_repair_dehum(samples, sample_rate?, *, ...)` | `np.ndarray` | `fundamental_hz=50.0`, `harmonics=4`, `q=20.0`, `adaptive`, `search_range_hz`, `adaptation`, `frame_size`, `pll_bandwidth` |
| `mastering_repair_denoise_classical(samples, sample_rate?, *, ...)` | `np.ndarray` | `mode='logMmse'`, `noise_estimator='quantile'`, `n_fft=1024`, `hop_length=256`, `dd_alpha=0.98`, `gain_floor=0.05`, `over_subtraction=2.0`, `spectral_floor=0.05`, `noise_estimation_quantile=0.1`, `speech_presence_gain`, `gain_smoothing` |
| `mastering_repair_dereverb_classical(samples, sample_rate?, *, ...)` | `np.ndarray` | `threshold=0.05`, `attenuation=0.5`, `n_fft=1024`, `hop_length=256`, `t60_sec=0.4`, `late_delay_ms=50.0`, `over_subtraction`, `spectral_floor`, `wpe_enabled`, `wpe_iterations`, `wpe_taps`, `wpe_strength` |
| `mastering_repair_trim_silence(samples, sample_rate?, *, ...)` | `np.ndarray` | `threshold=0.001`, `padding_samples=0`, `mode='peak'`, `gate_lufs=-60.0`, `window_ms=400.0` |

The repair stages are offline-only and are rejected by `StreamingMasteringChain` — run them with these one-shot helpers or inside `mastering_chain*` / `master_audio*`. See [Dynamics](./glossary/mastering/dynamics.md) and [Repair](./glossary/mastering/repair.md).

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
| Get machine-readable processor classifications | `mastering_processor_catalog()` |
| List chain insert processors | `mastering_insert_names()` |
| List the parameter keys an insert accepts | `mastering_insert_param_names(name)` |
| List realtime-automatable insert parameters | `mastering_insert_param_info(name)` |
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

Python also exposes the libsonare mixing engine. Use `mix_stereo(...)` for one-shot stem rendering, or keep a `Mixer` loaded from scene JSON when you need sends, buses, automation, meters, and scene serialization. List the built-in scene presets with `mixing_scene_preset_names()`.

```python
import libsonare as sonare

print(sonare.mixing_scene_preset_names())
scene_json = sonare.mixing_scene_preset_json("vocalReverbSend")

offline = sonare.mix_stereo(
    [(vocal_l, vocal_r), (music_l, music_r)],
    sample_rate=48000,
    input_trim_db=[3, 0],
    fader_db=[-3, -12],
    pan=[0, -0.2],
    width=[1, 0.9],
)

# Mixer is not a context manager — call close() when done.
mixer = sonare.Mixer.from_scene_json(scene_json, sample_rate=48000, block_size=512)
try:
    print(mixer.scene_warnings())  # non-fatal: insert params no processor reads (typos)
    block = mixer.process_stereo([vocal_block_l, music_block_l], [vocal_block_r, music_block_r])
    meter = mixer.strip_meter(0, tap="postFader")
    mixer.schedule_fader_automation(0, 48000 * 8, -6, curve="s-curve")
finally:
    mixer.close()
```

`mixer.process_stereo(...)` returns a `MixerStereoResult` named tuple with `.left` and `.right` (`list[float]`) and `.sample_rate` (`int`), mirroring the Node/WASM `{left, right, sampleRate}` shape.

See [Mixing Engine](./mixing.md) for routing concepts, scene presets, and real-time notes.

## Projects, Instruments & Live MIDI

The headless-DAW API is available in Python as well: author arrangements with `Project`, render them through the built-in instruments, and drive the realtime engine with live MIDI. The dedicated guides carry the depth — this is the Python entry-point map.

| Task | API | Guide |
|------|-----|-------|
| Author tracks, clips, tempo, markers, undo/redo | `Project` (a context manager — use `with`) | [Project Editing](./project-editing.md) |
| Render MIDI through the built-in synthesizer | `Project.bounce_with_synth_instrument(...)`, `synth_preset_names()`, `synth_preset_patch(name)`, `SynthPatch` | [Built-in Synthesizer](./native-synth.md), [Bouncing Projects](./project-bounce.md) |
| Render MIDI through a SoundFont | `Project.load_soundfont(data)`, `Project.bounce_with_sf2_instrument(...)` | [SoundFont Player](./soundfont-player.md) |
| Host your own instrument during a bounce | `Project.bounce_with_instruments(...)` with the `ExternalInstrument` protocol — a `render(channels, num_frames)` callback plus optional `prepare`/`on_event` hooks and `latency_samples`. **Python-only.** | [Bouncing Projects](./project-bounce.md) |
| Play instruments live from MIDI events | `RealtimeEngine.set_synth_instrument(...)`, `RealtimeEngine.load_soundfont(...)`, plus the engine's MIDI input queue | [MIDI Input](./midi-input.md) |
| Schedule MIDI clips into the live engine, sample-accurately | `RealtimeEngine.set_midi_clips([...])` with `EngineMidiClipSchedule` / `EngineMidiEvent`, `RealtimeEngine.sample_at_ppq(ppq)` | [Realtime and Streaming](./realtime-streaming.md#midi-clip-scheduling-and-sampleatppq) |
| Mix the engine's tracks live with lanes, buses, sends, and strips | `RealtimeEngine.set_track_lanes(...)`, `set_track_buses(...)`, `set_track_strip_json(...)`, `set_master_strip_json(...)`, `set_bus_strip_json(...)`, `set_solo_mute(...)`, `set_track_strip_pan(...)`, `set_track_strip_pan_law(...)`, `set_track_strip_pan_mode(...)`, `set_track_strip_dual_pan(...)`, `set_track_strip_channel_delay_samples(...)`, `set_track_strip_insert_param_by_name(...)`, `set_master_strip_insert_param_by_name(...)`, `drain_meter_telemetry_wide(...)`, `configure_scope_telemetry(...)`, `drain_scope_telemetry(...)` | [Realtime and Streaming](./realtime-streaming.md#track-lanes-buses-and-channel-strips) |

```python
import libsonare as sonare

with sonare.Project() as project:
    project.set_sample_rate(48000)
    track = project.add_track(kind="midi")
    # ... add clips and MIDI events (see the Project Editing guide) ...
    audio = project.bounce_with_synth_instrument("e-piano", num_channels=2)
```

Note that `Project` supports `with` for automatic cleanup, while `Mixer` does not (call `mixer.close()` explicitly).

For synth preset introspection, `synth_preset_patch(name)` returns a named catalog preset as a `SynthPatch` (it raises `SonareError` for unknown names and accepts a `'va:'` routing prefix) so you can inspect and tweak fields before binding it. `synth_enum_tables()` returns the runtime enum-name tables (`dict[str, tuple[str, ...]]`) for validating `SynthModRouting` source/destination names against the loaded build.

### Opaque assist sidecars

`Project` can carry per-project, undoable, module-owned opaque byte blobs (assist sidecars), scoped by module ID, target track, and a region. Set one with `project.set_assist_sidecar(module_id, payload, *, schema_version=0, target_track_id=0, region_start_ppq=0.0, region_end_ppq=0.0)`; read them back with `project.assist_sidecar_count()`, `project.get_assist_sidecar(index) -> AssistSidecar`, and `project.assist_sidecars()`. See [Project Editing](./project-editing.md#assist-sidecars) for the cross-binding details.
