---
title: Python Analysis API
description: Analysis functions, feature extraction, inverse reconstruction, metering, scale quantization, and conversion functions of the libsonare Python package.
---

# Python Analysis API

Analysis and feature-extraction functions of the libsonare Python package; installation, quick start, and the other API families are on the [Python API](./python-api.md) index.

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

### Test signals, reconstruction, and structure

```python
import libsonare as sonare

# Deterministic test signals — no asset files needed.
sine = sonare.tone(frequency=440.0, sample_rate=48000, duration=1.0)
sweep = sonare.chirp(fmin=100.0, fmax=8000.0, sample_rate=48000, duration=2.0)
track = sonare.clicks(times=[0.0, 0.5, 1.0], sample_rate=48000)

# Reconstruction and per-bin pitch candidates.
audio_again = sonare.griffin_lim(magnitude, n_bins, n_frames, sample_rate=48000)
reassigned = sonare.reassigned_spectrogram(samples, sample_rate=48000)
peaks = sonare.piptrack(samples, sample_rate=48000)
delta = sonare.mel_delta(features, n_features, n_frames)
flux = sonare.spectral_flux(samples, sample_rate=48000)
backtracked = sonare.onset_backtrack(onset_frames, energy)

# Note segmentation from a monophonic F0 track.
pitch = sonare.pitch_pyin(samples, sample_rate=48000)
segments = sonare.note_segments(
    pitch.f0,
    [1.0 if v else 0.0 for v in pitch.voiced_flag],
    frame_rate=48000 / 512,
    min_note_ms=60.0,
)
```

::: warning Pass `voiced_flag`, not `voiced_prob`
`note_segments` delimits notes where the voicing value falls below `voiced_threshold` (default `0.5`), so feed it `pitch_pyin`'s `voiced_flag` as `0.0`/`1.0`. `voiced_prob` is the frame's voiced observation *mass*: it depends on how many periods fit in the analysis window, so it rises with F0 rather than tracking confidence. At `frame_length=2048` and 48 kHz a steady three-harmonic tone averages well under 0.1 at C2 and around 0.5 at C5 — so a bass or low-male-vocal track run against a fixed threshold returns an **empty list and raises nothing**. `voiced_threshold` is the other lever if you do want to segment on a continuous voicing value.
:::

The structural-similarity family is spelled without a `segment_` prefix in
Python, unlike the JavaScript `segment*` names:

| Python | JavaScript |
|--------|------------|
| `cross_similarity(...)` | `segmentCrossSimilarity(...)` |
| `recurrence_matrix(...)` | `segmentRecurrenceMatrix(...)` |
| `recurrence_to_lag(...)` | `segmentRecurrenceToLag(...)` |
| `lag_to_recurrence(...)` | `segmentLagToRecurrence(...)` |
| `path_enhance(...)` | `segmentPathEnhance(...)` |
| `subsegment(...)` | `segmentSubsegment(...)` |
| `agglomerative(...)` | `segmentAgglomerative(...)` |

::: details Pitch and feature terms: YIN/pYIN, zero-crossing rate, MIDI note
- **YIN / pYIN** — algorithms that estimate the *fundamental frequency* (the perceived pitch) of monophonic audio. YIN uses autocorrelation; pYIN adds probabilistic smoothing so the pitch line stays steadier over time. Both track one note at a time, not chords.
- **Zero-crossing rate (ZCR)** — how often the waveform crosses zero per frame. High ZCR means noisy or high-frequency content (cymbals, fricatives); low ZCR means smooth, tonal sound.
- **MIDI note number** — an integer naming a pitch: A4 = 69, middle C = 60, each semitone ±1. `hz_to_midi` / `midi_to_hz` (below) convert between Hz and this scale.
:::

## API Reference

### Audio

| Method | Description |
|--------|-------------|
| `Audio.from_file(path)` | Load WAV/MP3 from disk; also FFmpeg-supported formats when the library is built with FFmpeg |
| `Audio.from_buffer(data, sample_rate)` | Create from float samples |
| `Audio.from_memory(data)` | Decode encoded audio bytes with the same format support as `from_file` |
| `Audio.file_channel_count(path)` | Probe the source channel count encoded in an audio file, without decoding; unlike `from_file`, it never downmixes to mono |
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
| `detect_chords(samples, sample_rate, ...)` | `ChordAnalysisResult` | Chord segments over time; frames below the detection threshold are explicit `N.C.` intervals |
| `analyze(samples, sample_rate)` | `AnalysisResult` | All-in-one analysis: BPM and its candidates, key, time signature and its candidates, beats, chords (each with `roman_numeral` relative to the detected key), sections, timbre, dynamics, rhythm, melody, form |
| `analyze_with_progress(samples, sample_rate, on_progress?)` | `AnalysisResult` | Same result and analysis keyword options as `analyze`, with an optional `(progress, stage)` callback and keyword-only `cancel` callback |
| `analyze_bpm(samples, sample_rate, ...)` | `BpmAnalysisResult` | BPM with top candidates |
| `estimate_meter(beat_times, beat_strengths, ...)` | `MeterEstimate` | Meter and accent grouping scored over a beat series you already have — no audio, no re-analysis |
| `chord_functional_analysis(samples, key_root, key_mode?, ...)` | `list[str]` | Roman-numeral labels (`"I"`, `"IV"`, `"V"`, `"vi"`, ...) for detected chords, relative to a key |
| `analyze_rhythm(samples, sample_rate, ...)` | `RhythmResult` | Syncopation, groove type, regularity |
| `analyze_dynamics(samples, sample_rate, ...)` | `DynamicsResult` | Dynamic range, loudness range, crest factor |
| `analyze_timbre(samples, sample_rate, ...)` | `TimbreResult` | Brightness, warmth, density, roughness, complexity, plus per-window `timbre_over_time` (`timbreOverTime` alias) |
| `analyze_sections(samples, sample_rate, ...)` | `SectionResult` | Song-structure sections (intro/verse/chorus/...) |
| `detect_boundaries(samples, sample_rate=22050, *, n_fft=2048, hop_length=512, kernel_size=64, threshold=0.3, absolute_threshold=0.005, n_mfcc=13, n_chroma=12, peak_distance=2.0, use_mfcc=True, use_chroma=True)` | `BoundaryResult` | Structural transitions plus the `novelty_curve` they were picked from, and the grid both live on. Reach for it when you want to apply your own threshold rather than take `analyze_sections`' labelled spans |
| `analyze_melody(samples, sample_rate, ...)` | `MelodyResult` | Monophonic melody contour (YIN) |
| `analyze_impulse_response(samples, sample_rate=48000, n_octave_bands=6, min_decay_db=30.0)` | `AcousticResult` | Room acoustics from an impulse response (RT60/EDT/C50/C80); `min_decay_db` controls the decay-fit threshold |
| `detect_acoustic(samples, sample_rate, ...)` | `AcousticResult` | Blind room-acoustic estimation |
| `estimate_room(samples, sample_rate, ...)` | `RoomEstimate` | Equivalent-room estimate with volume, dimensions, DRR, absorption bands, RT60 bands, and confidence |
| `synthesize_rir(length_m, width_m, height_m, ...)` | `RirResult` | Mono room impulse response from shoebox geometry |
| `room_morph(samples, sample_rate, length_m, width_m, height_m, ...)` | `list[float]` | Offline creative morph toward a target room |
| `version()` | `str` | Library version |
| `voice_changer_abi_version()` | `int` | ABI version of the realtime voice-changer POD config; separate from preset JSON `schemaVersion` |
| `voice_character_preset_id(preset)` | `str \| None` | Canonical voice-character preset ID for an integer ordinal; unknown ordinals return `None` |
| `realtime_voice_changer_preset_config(preset)` | `RealtimeVoiceChangerConfig` | Resolved flat POD config for a built-in voice preset, without JSON parsing |
| `engine_abi_version()` | `int` | ABI version of the realtime engine interface |
| `project_abi_version()` | `int` | ABI version of the project/editing API used by `Project` serialization, bounce, and realtime clip exchange |
| `has_ffmpeg_support()` | `bool` | Whether the loaded native library can decode via FFmpeg |

Most core analysis, effects, feature, loudness, and mastering helpers are also
available as `Audio` instance methods (e.g., `audio.detect_bpm()`). Some focused
helpers such as `analyze_sections(...)`, `analyze_melody(...)`, `cqt(...)`, and
`vqt(...)` remain standalone functions; pass `audio.data` and
`audio.sample_rate` to those.

In Python, `analyze(...)` calls `sonare_analyze_json_ex` on the current build and returns the all-in-one `AnalysisResult`: BPM and ranked BPM hypotheses, key, time signature and its candidates, beat times and per-beat strengths, chords with `roman_numeral` labels relative to the detected key, sections, timbre, dynamics, rhythm, melody, and form. The focused functions above remain useful when you want a single facet, parameterized/targeted analysis, or to avoid recomputing the whole result. (Acoustic/room metrics are separate — see `estimate_room` and the room helpers; they are not part of `AnalysisResult`.)

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

#### `analyze()` options

`analyze(...)` takes the whole `MusicAnalyzerConfig` as keyword arguments: `n_fft=2048`, `hop_length=512`, `bpm_min=60.0`, `bpm_max=200.0`, `start_bpm=120.0`, `use_triads_only=True`, `use_hpss=True`, `chroma_highpass_hz=80.0`, `use_bass_weighted=True`, `chroma_hop_multiplier=4`, `use_chord_hmm=False`, `use_chord_key_context=False`, `chord_hmm_beam_width=24`, `detect_chord_inversions=False`, `adaptive_tempo=False`, `tempo_update_interval_beats=8`, `compute_tempo_curve=False`, `meter_candidate_numerators=None`, `meter_denominator=4`, and `tuning=0.0`.

`tuning` is a recording offset in fractions of a semitone, using the unit returned by `estimate_tuning(...)`. It must be in `[-0.5, 0.5)`; the default `0.0` is concert A440. The same keyword is available on `analyze_with_progress(...)`, and shifts the chroma used for key, chords, and sections.

::: warning `use_triads_only` defaults to **True** here
The unified `analyze(...)` path searches triads alone until you say otherwise, while the standalone `detect_chords(...)` API defaults the same flag to `False`. If you expect sevenths and extensions from `analyze(...)`, pass `use_triads_only=False`.
:::

Three of these are worth singling out:

- `meter_candidate_numerators` defaults to `(3, 4, 6)`, the native candidate set. An odd meter is reported only if its numerator was among the candidates. At most 16 entries, each in `[2, 32]`; widening the set does not force a wider meter.
- `meter_denominator` (a power of two in `[1, 32]`) is the beat unit reported for the detected meter. `analyze(...)` has the audio, so it still reports `8` on its own when it resolves a compound meter.
- `compute_tempo_curve=True` fills `beat_local_bpm`; it is off by default because it adds an output rather than improving the analysis. Beat tracking holds one fixed tempo prior unless `adaptive_tempo=True` is also set, so measuring a tempo that actually moves needs both.

#### Reading the result

- `key.confidence` is a softmax over the profile correlations of every candidate that was scored: it lies in `[0, 1)` and the candidates' confidences sum to 1, so a share of 24 candidates cannot reach 1, and a relative major and minor that split the evidence each report about half. It says how decisively the chroma picked one candidate out of the set — **not how often that pick is right**. Nothing here is calibrated against annotated recordings, so a pipeline that branches on it has to choose its own threshold against its own material.
- `downbeat_indices` indexes `beat_times`, so `beat_times[downbeat_indices[k]]` is the k-th downbeat. It is shorter than `beat_times`: testing a beat for downbeat status is a membership check, not a comparison against a separate time series. `downbeat_phase` is the meter estimator's own phase and can disagree with `downbeat_indices[0]` once downbeats are refined from chord and low-frequency evidence.
- `beat_strengths` and `beat_observations.onset_strength` are not the same measurement. `beat_strengths` is a single raw, unbounded onset-envelope frame sampled at the beat's own frame — not normalized, scaled by the material, and sensitive to beat-position jitter. `beat_observations.onset_strength` is the windowed value the library's own downbeat pass scores, and is the accent source to use. `beat_observations` also carries `low_frequency_energy` and `chord_change`.
- `beat_local_bpm` is the smoothed local tempo at each beat, parallel to `beat_times`. It is empty unless `compute_tempo_curve` was set, and empty regardless when fewer than two beats were detected, since a tempo is a property of the interval between two beats. The final entry repeats the tempo of the interval leading into the last beat. Do not read a single number out of it as the global tempo — on material whose tempo moves it departs from `bpm` by design.

#### Scoring a meter over beats you already have

`estimate_meter(...)` scores a meter over a caller-supplied beat series. It reads only per-beat times and accent values, so an existing analysis can be re-scored — over a different candidate set, or over an arbitrary span of its beats — without running the pipeline again. See [Meter and grouping](./glossary/analysis/meter-and-grouping.md) for the concept.

```python
result = sonare.analyze(audio.data, audio.sample_rate)
obs = result.beat_observations

meter = sonare.estimate_meter(
    result.beat_times,
    obs.onset_strength if obs else result.beat_strengths,
    candidate_numerators=(3, 4, 5, 6, 7),
)
if meter.searched:
    print(meter.time_signature.numerator, meter.grouping)  # e.g. 7 [3, 2, 2]
```

Keyword options are `candidate_numerators` (default `(3, 4, 6)`), `denominator=4`, `downbeat_weight=1.0`, `measure_weight=0.5`, `subdivision_weight=0.15`, and `compound_subdivision_threshold=0.85`. Two things decide whether the answer means anything:

- The default candidate set is `{3, 4, 6}`, so an odd meter comes back only if you asked for its numerator.
- `searched` is `False` when the beat series was shorter than eight beats. Every other field then carries a fixed fallback rather than a result — **including the confidence**, so a short span's answer must not be read as a detection.

`grouping` reports how the bar divides into accent groups of two and three beats and always sums to the reported numerator, so a seven comes back as `[3, 2, 2]`. Read the grouping, not the denominator, to tell a compound bar from a simple one: whether a beat divides into three is measured from energy *between* the beats, which per-beat accents do not carry, so this path reports `denominator` as requested. `candidate_scores` is parallel to the numerators you requested while `candidates` is ordered by descending support — pair a score with a numerator through your request list, never through `candidates`. Scores are standardized and signed, grow with the square root of the number of beats scored, and are comparable only within one result.

#### Chord qualities

`Chord.quality` is one of the strings listed under [Types](./python-api-types.md#types). Some of them are anagrams of each other and no chromagram can separate the pair: a `major6` spells the `minor7` a minor third below, a `minor6` the `halfDim7` below it, and a `dominant7Sus4` the `sus2Add4` a fourth below. The established reading stays the default in each pair, and only bass evidence promotes the sixth.

For long files, `analyze_with_progress(...)` returns the same `AnalysisResult` as `analyze(...)`, accepts the same analysis keyword options including `tuning`, and accepts an `on_progress=(progress, stage)` callback plus keyword-only `cancel`. It mirrors the mastering progress callbacks below:

```python
def on_step(progress: float, stage: str) -> None:
    print(f"{progress:5.1%}  {stage}")

result = sonare.analyze_with_progress(audio.data, audio.sample_rate, on_progress=on_step)
```

`detect_chords(...)` and `chord_functional_analysis(...)` accept `tuning` in the same fractions-of-a-semitone unit as `analyze(...)`. To label chords with Roman numerals relative to a key, use `chord_functional_analysis(...)`. It detects chords with the same algorithm as `detect_chords(...)`, then returns one label per detected chord, in chord order. The labels line up with a `detect_chords(...)` result only when both calls get the same options:

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
| `pitch_yin(samples, sample_rate, frame_length?, hop_length?, fmin?, fmax?, threshold?, fill_na?)` | `PitchResult` | YIN pitch estimation; every frame has a finite `f0`, while `voiced_flag` reports voicing |
| `pitch_pyin(samples, sample_rate, frame_length?, hop_length?, fmin?, fmax?, threshold?, fill_na?)` | `PitchResult` | pYIN pitch estimation; unvoiced `f0` stays `nan` unless `fill_na=True` |
| `pitch_tuning(frequencies, resolution?, bins_per_octave?)` | `float` | Global tuning offset from detected frequencies, in fractions of a bin |
| `estimate_tuning(samples, sample_rate?, n_fft?, hop_length?, resolution?, bins_per_octave?)` | `float` | Estimate tuning offset directly from audio |
| `cqt(samples, sample_rate, hop_length?, fmin?, n_bins?, bins_per_octave?)` | `CqtResult` | Constant-Q Transform magnitude |
| `vqt(samples, sample_rate, hop_length?, fmin?, n_bins?, bins_per_octave?, gamma?)` | `CqtResult` | Variable-Q Transform magnitude |
| `hybrid_cqt(samples, sample_rate?, hop_length?, fmin?, n_bins?, bins_per_octave?)` | `CqtResult` | Hybrid CQT magnitude (CQT/pseudo-CQT blend across bins) |
| `pseudo_cqt(samples, sample_rate?, hop_length?, fmin?, n_bins?, bins_per_octave?)` | `CqtResult` | Approximate (pseudo) CQT magnitude |
| `bass_chroma(samples, sample_rate?, hop_length?, n_chroma?)` | `ChromaResult` | Bass-focused chroma (low-register pitch-class distribution) |
| `chroma_cens(samples, sample_rate?, hop_length?, n_chroma?, bins_per_octave?)` | `ChromaResult` | CENS energy-normalized/smoothed chroma |
| `chroma_cqt(samples, sample_rate?, hop_length?, n_chroma?, bins_per_octave?)` | `ChromaResult` | Constant-Q chromagram (`librosa.feature.chroma_cqt` equivalent) — `features` is row-major `[n_chroma x n_frames]` |
| `nnls_chroma(samples, sample_rate, *, enable_stft_blend?, stft_blend_weight?, stft_blend_n_fft?, hop_length?)` | `tuple[int, list[float]]` | NNLS chromagram — returns `(n_frames, row-major 12 x n_frames data)`; `hop_length` defaults to `512` |
| `decompose(s, n_features, n_frames, n_components, n_iter?, beta?)` | `tuple` | NMF decomposition factors `(w, h)` from a row-major spectrogram |
| `decompose_with_init(s, n_features, n_frames, n_components, n_iter?, beta?, init?)` | `tuple` | NMF decomposition `(w, h)` with a selectable initialiser; `init` defaults to `'random'`, also accepts `'nndsvd'` (SVD warm start) |
| `decompose_stems(samples, sample_rate?, n_components?, n_fft?, hop_length?, n_iter?, beta?, init?, mask_power?, *, validate?)` | `dict[str, object]` | NMF separation that masks the original complex spectrogram, so the components keep the source's phase and sum back to the input; defaults `n_components=4`, `n_iter=100`, `beta=2.0`, `init='random'`, `mask_power=1.0` |
| `decompose_stems_linked(channels, sample_rate?, n_components?, n_fft?, hop_length?, n_iter?, beta?, init?, mask_power?, *, validate?)` | `dict[str, object]` | Shared NMF separation for one or more same-length channels (maximum 64); preserves interchannel level and phase, and returns `components[k][c]` planes. Defaults match `decompose_stems`; one channel is bit-identical |
| `nn_filter(s, n_features, n_frames, aggregate?, k?, width?)` | `np.ndarray` | Nearest-neighbor filtering of a row-major spectrogram |
| `onset_envelope(samples, sample_rate, n_fft?, hop_length?, n_mels?)` | `list[float]` | Onset strength envelope (input to the tempogram family) |
| `onset_strength_multi(samples, sample_rate?, n_fft?, hop_length?, n_mels?, n_bands?)` | `tuple[int, list[float]]` | Multi-band onset strength; returns `(n_frames, [n_bands x n_frames])` row-major (`n_bands` default 3) |
| `lufs(samples, sample_rate)` | `LufsResult` | Integrated/final-window [LUFS](./glossary/lufs.md) (Loudness Units relative to Full Scale), Max-M / Max-S, and loudness range (EBU R128) |
| `lufs_interleaved(samples, channels, sample_rate?)` | `LufsResult` | Channel-weighted multichannel loudness from interleaved samples |
| `ebur128_loudness_range(samples, sample_rate?)` | `float` | EBU R128 loudness range (LRA) in LU |
| `momentary_lufs(samples, sample_rate)` | `list[float]` | Momentary LUFS per frame |
| `short_term_lufs(samples, sample_rate)` | `list[float]` | Short-term LUFS per frame |

Common defaults: `n_fft=2048`, `hop_length=512`, `n_mels=128`, `n_mfcc=20`, pitch `fmin=65.0`, `fmax=2093.0`, `threshold=0.1`, and `roll_percent=0.85`.

CQT/VQT use `fmin=32.70319566` Hz (C1), `n_bins=84`, and `bins_per_octave=12`. VQT's default `gamma=-1` selects automatic ERB-derived bandwidth. `chroma_cqt` and `chroma_cens` default to `n_chroma=12` and `bins_per_octave=36`. `hpss(...)` and `hpss_with_residual(...)` default to `kernel_harmonic=31`, `kernel_percussive=31`, `n_fft=2048`, `hop_length=512`, and `hard_mask=False`.

Additional effect helpers include `phase_vocoder(samples, sample_rate?, rate?)` and `hpss_with_residual(samples, sample_rate?, kernel_harmonic?, kernel_percussive?, n_fft?, hop_length?, hard_mask?)`. Use them when you need direct phase-vocoder time scaling, or HPSS with the residual signal preserved.

#### NMF factors versus listenable stems

`decompose` and `decompose_with_init` return the W / H factors of a **magnitude** spectrogram. Those factors carry no phase, so reconstructing audio from them needs a phase estimator, and an estimated phase does not hold up as a stem. `decompose_stems` builds a per-component soft mask from the same factorisation and applies it to the **original complex** spectrogram instead, so every component keeps the source's phase. The masks sum to one wherever the model has energy and the inverse STFT is linear, so the components sum back to the input.

`mask_power` is the soft-mask exponent: `1` (the default) keeps the magnitude ratio, `2` is the Wiener-style power ratio, which separates harder at the cost of more artefacts on overlapping partials. Values below 1 are refused. `init` is `'random'` by default, or `'nndsvd'` for the SVD warm start; `beta` is the divergence (`2` = Frobenius, `1` = Kullback-Leibler).

```python
stems = sonare.decompose_stems(audio.data, audio.sample_rate, n_components=4, mask_power=2.0)
for component in stems["components"]:
    ...  # each is a 1-D float32 array the length of the input
print(stems["w"].shape, stems["h"].shape, stems["sample_rate"])
```

For multichannel input, use `decompose_stems_linked(...)`. It fits one NMF
model and one soft-mask set from the channels' averaged magnitudes, then applies
each mask unchanged to each channel's original complex spectrum. This preserves
interchannel level and phase. Pass one or more same-length channels, with no
more than 64 channels. Each `components[k]` is a two-dimensional float32 array
whose rows are channels, so `components[k][c]` is component `k` on channel `c`.
The `w` and `h` arrays are shared across channels, and all defaults match
`decompose_stems`; one channel is bit-identical to `decompose_stems(...)`.

```python
linked = sonare.decompose_stems_linked(
    [left_channel, right_channel], sample_rate=sample_rate
)
first_left = linked["components"][0][0]
first_right = linked["components"][0][1]
print(linked["w"].shape, linked["h"].shape)
```

`n_components`, `n_fft`, `hop_length` and `n_iter` carry real defaults on this entry point, so `0` is refused as a caller mistake rather than read as the "use the default" sentinel the same field means on the C ABI and the JavaScript surfaces.

::: warning NNDSVD seeding is solved in double precision
This makes the factors **reproducible**, not more accurate — and it means `decompose` and `decompose_stems` return different factors for the same input than a build that seeded in single precision did. A magnitude spectrogram's trailing singular vectors sit at single precision's noise floor, so a float seed depended on summation order and different targets answered with different components. Shapes, non-negativity and reconstruction quality are unaffected. If you hold stored factors, or compare a stem render against an older one, expect them to differ.
:::

### Inverse Reconstruction Functions

Reconstruct a spectrum or audio from a mel spectrogram or MFCC matrix. Phase is estimated with Griffin-Lim, so the round-trip is lossy — see [Inverse Features](./inverse-features.md). Matrix inputs are row-major.

| Function | Return Type | Description |
|----------|-------------|-------------|
| `mel_to_stft(mel, n_mels, n_frames, sample_rate?, n_fft?, fmin?, fmax?, htk?)` | `InverseResult` | Linear STFT power from a mel spectrogram |
| `mel_to_audio(mel, n_mels, n_frames, sample_rate?, n_fft?, hop_length?, fmin?, fmax?, n_iter?, htk?)` | `list[float]` | Audio from a mel spectrogram (Griffin-Lim) |
| `mfcc_to_mel(mfcc_coeffs, n_mfcc, n_frames, n_mels?, lifter?)` | `InverseResult` | Mel spectrogram (dB) from MFCC coefficients (`lifter` must match the forward `mfcc(...)` call) |
| `mfcc_to_audio(mfcc_coeffs, n_mfcc, n_frames, n_mels?, sample_rate?, n_fft?, hop_length?, fmin?, fmax?, n_iter?, htk?)` | `list[float]` | Audio from MFCC coefficients |
| `cqt_to_audio(magnitude, n_bins, n_frames, sample_rate?, hop_length?, fmin?, bins_per_octave?, n_iter?)` | `list[float]` | Audio from a row-major CQT magnitude matrix (Griffin-Lim) |
| `vqt_to_audio(magnitude, n_bins, n_frames, sample_rate?, hop_length?, fmin?, bins_per_octave?, gamma?, n_iter?)` | `list[float]` | Audio from a row-major VQT magnitude matrix (Griffin-Lim) |

Pass `0.0` for `fmin`/`fmax` to use the full-band defaults; `n_iter` defaults to `32`. Keep `fmin`/`fmax`/`htk` identical to the values used by the forward transform so the round-trip stays consistent.

### Metering Functions

Standalone level, dynamics, and stereo-image meters. Each accepts a keyword-only `validate` flag (default `True`); pass `validate=False` to skip NaN/Inf input checks on hot paths. The stereo meters require `left` and `right` to be equal length. `sample_rate` defaults to `22050`.

| Function | Return Type | Description |
|----------|-------------|-------------|
| `metering_peak_db(samples, sample_rate?, *, validate?)` | `float` | Sample peak (dBFS) |
| `metering_rms_db(samples, sample_rate?, *, validate?)` | `float` | RMS level (dBFS) |
| `metering_crest_factor_db(samples, sample_rate?, *, validate?)` | `float` | Crest factor, peak − RMS (dB) |
| `metering_crest_factor_db_stereo(left, right, sample_rate?, *, validate?)` | `float` | Crest factor measured across both channels — peak is the larger of the two, RMS is taken over both together |
| `metering_dc_offset(samples, sample_rate?, *, validate?)` | `float` | Mean (DC) offset, linear amplitude |
| `metering_silence_ratio(samples, sample_rate?, threshold_db?, frame_length?, hop_length?, *, validate?)` | `float` | Fraction of analysis frames whose RMS is below `threshold_db` (defaults: `threshold_db=-45.0`, `frame_length=1024`, `hop_length=256`) |
| `metering_true_peak_db(samples, sample_rate?, oversample_factor?, *, validate?)` | `float` | Inter-sample (true) peak (dBFS); `oversample_factor` is a power of two in 1..16 (0 = default 4) |
| `metering_detect_clipping(samples, sample_rate?, threshold?, min_region_samples?, *, validate?)` | `ClippingReport` | Clipped-sample runs; `threshold` default `0.999`, `min_region_samples` default `1` |
| `metering_dynamic_range(samples, sample_rate?, window_sec?, hop_sec?, low_percentile?, high_percentile?, *, validate?)` | `DynamicRangeReport` | Sliding-window dynamic range; pass `0.0` for `window_sec`/`hop_sec` defaults (3 s / 1 s); pass a negative value (the default `-1.0`) for `low_percentile`/`high_percentile` defaults (0.10 / 0.95) — `0.0` requests the 0th percentile, not the default |
| `metering_stereo_correlation(left, right, sample_rate?, *, validate?)` | `float` | Uncentered correlation (cosine similarity), −1..1 |
| `metering_stereo_width(left, right, sample_rate?, *, validate?)` | `float` | Mid/side stereo width |
| `metering_vectorscope(left, right, sample_rate?, max_points?, *, validate?)` | `VectorscopeReport` | Mid/side point series; one point per sample unless `max_points` bounds it |
| `metering_vectorscope_decimated(left, right, sample_rate?, max_points?, *, validate?)` | `VectorscopeReport` | Display-sized mid/side vectorscope; `max_points` upper-bounds the point count (`0` or a value ≥ buffer length = one point per sample, identical to `metering_vectorscope`); otherwise deterministically decimated, keeping the largest-radius sample per bucket |
| `metering_phase_scope(left, right, sample_rate?, max_points?, *, validate?)` | `PhaseScopeReport` | Phase-scope point series plus summary stats; one point per sample unless `max_points` bounds it |
| `metering_phase_scope_decimated(left, right, sample_rate?, max_points?, *, validate?)` | `PhaseScopeReport` | Display-sized phase-scope (Lissajous + summary stats); `max_points` upper-bounds the point cloud the same way; summary stats are always computed over the full-resolution signal |
| `metering_spectrum(samples, sample_rate?, n_fft?, apply_octave_smoothing?, octave_fraction?, db_ref?, db_amin?, *, validate?)` | `SpectrumReport` | Welch-averaged magnitude/power/dB spectrum over the whole buffer (Hann-windowed, 50%-overlapping `n_fft` frames; not a single-frame snapshot); pass `0` for `n_fft`/`octave_fraction`/`db_ref`/`db_amin` defaults (2048 / 3 / 1.0 / floor) |
| `metering_spectrum_frame(samples, sample_rate?, frame_offset?, n_fft?, apply_octave_smoothing?, octave_fraction?, db_ref?, db_amin?, *, validate?)` | `SpectrumReport` | True single-frame spectrum (one Hann-windowed FFT) spanning `[frame_offset, frame_offset + n_fft)`, zero-padded past the end; pass `0` for `frame_offset`/`n_fft`/`octave_fraction`/`db_ref`/`db_amin` defaults |

Prefer `metering_crest_factor_db_stereo(...)` over feeding a downmix to `metering_crest_factor_db(...)`. A `0.5 * (left + right)` downmix cancels an out-of-phase pair, which understates RMS and therefore overstates crest factor. An inverted pair reads `11.64` dB through the stereo meter and `0.00` dB through the downmix. Unequal channel lengths raise `ValueError("left and right channel lengths must match")`.

### Scale Quantization

12-TET scale helpers for building pitch-correction targets. `mode_mask` is a 12-bit mask where bit *i* enables the *i*-th pitch class relative to `root` (`PitchClass`, C = 0); natural major is `0b101010110101`. `reference_midi` is the tuning anchor (pass `0.0` for A4 = 69). Pair with `pitch_correct_to_midi(...)` to retune to the nearest scale degree.

| Function | Return Type | Description |
|----------|-------------|-------------|
| `scale_quantize_midi(root, mode_mask, midi, reference_midi?)` | `float` | Snap a (fractional) MIDI number to the nearest enabled pitch class |
| `scale_correction_semitones(root, mode_mask, midi, reference_midi?)` | `float` | Correction (quantized − input), in semitones |
| `scale_pitch_class_enabled(root, mode_mask, pitch_class)` | `bool` | Whether `pitch_class` (0..11) is enabled relative to `root` |

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

### Unit Conversions

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
