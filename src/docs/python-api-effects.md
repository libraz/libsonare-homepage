---
title: Python Effects API
description: Audio effects, room acoustics, the realtime voice changer, and librosa-compatible helpers of the libsonare Python package.
---

# Python Effects API

Audio effects, room acoustics, the realtime voice changer, and librosa-compatible helpers of the libsonare Python package; installation, quick start, and the other API families are on the [Python API](./python-api.md) index.

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
`analyze_impulse_response(...)` and `detect_acoustic(...)` return `AcousticResult` with RT60, EDT, C50, C80, D50, per-band arrays, confidence, and `is_blind`. Their `sample_rate` default is `48000`, unlike most music-analysis helpers that default to `22050`. RIR means room impulse response. RT60 is the reverberation time — how long a tail takes to decay by 60 dB — while C50 and C80 are clarity ratios between early and late energy.
:::

```python
ir = sonare.analyze_impulse_response(ir_samples, sample_rate, n_octave_bands=6, min_decay_db=30.0)
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

## Effects Functions

| Function | Return Type | Description |
|----------|-------------|-------------|
| `hpss(samples, sample_rate, kernel_harmonic?, kernel_percussive?, n_fft?, hop_length?, hard_mask?)` | `HpssResult` | Harmonic-Percussive Source Separation; defaults: `kernel_harmonic=31`, `kernel_percussive=31`, `n_fft=2048`, `hop_length=512`, `hard_mask=False` |
| `hpss_with_residual(samples, sample_rate, kernel_harmonic?, kernel_percussive?, n_fft?, hop_length?, hard_mask?)` | `dict[str, object]` | HPSS with harmonic, percussive, and residual outputs |
| `harmonic(samples, sample_rate)` | `list[float]` | Extract harmonic component |
| `percussive(samples, sample_rate)` | `list[float]` | Extract percussive component |
| `time_stretch(samples, sample_rate, rate, n_fft?, hop_length?)` | `list[float]` | Time-stretch without pitch change; defaults: `n_fft=2048`, `hop_length=512` |
| `pitch_shift(samples, sample_rate, semitones, n_fft?, hop_length?)` | `list[float]` | Pitch-shift without tempo change; defaults: `n_fft=2048`, `hop_length=512` |
| `pitch_correct_to_midi(samples, sample_rate, current_midi?, target_midi?)` | `list[float]` | Pitch-correct toward a target MIDI note |
| `pitch_correct_to_midi_timevarying(samples, f0_hz, target_midi, sample_rate?, hop_length?, voiced?, voiced_prob?)` | `list[float]` | Contour-following pitch correction: retunes every voiced frame toward `target_midi` along a per-frame `f0_hz` contour, preserving vibrato/drift instead of flattening it |
| `note_stretch(samples, sample_rate, onset_sample?, offset_sample?, stretch_ratio?)` | `list[float]` | Stretch a single note region in place |
| `note_move(samples, sample_rate, onset_sample?, offset_sample?, target_onset_sample?)` | `list[float]` | Move a note region to a new onset without changing its duration |
| `voice_change(samples, sample_rate, pitch_semitones?, formant_factor?)` | `list[float]` | Independent pitch + formant shift |
| `voice_change_realtime(samples, sample_rate?, preset?, channels?)` | `np.ndarray` | One-shot render through the realtime voice preset chain |
| `normalize(samples, sample_rate, target_db?)` | `list[float]` | Normalize peak level to target dB (default: 0.0) |
| `normalize_rms(samples, sample_rate, target_db?)` | `list[float]` | Normalize RMS level to target dB (default: -20.0) |
| `normalize_stereo(left, right, sample_rate?, target_db?, *, validate?)` | `NormalizeStereoResult` | Peak-normalize a pair on one shared gain (`target_db` default `0.0`) |
| `normalize_rms_stereo(left, right, sample_rate?, target_db?, *, validate?)` | `NormalizeStereoResult` | RMS-normalize a pair on one shared gain (`target_db` default `-20.0`) |
| `remix(samples, intervals, sample_rate?, align_zeros?)` | `np.ndarray` | Reorder/concatenate by interval slices; `align_zeros` default `False` |
| `remix_aligned_intervals(samples, intervals, sample_rate?, align_zeros?)` | `list[int]` | Resolve the cut points `remix` would use, without cutting; `align_zeros` default `True` |
| `trim(samples, sample_rate, threshold_db?, frame_length?, hop_length?)` | `list[float]` | Trim silence (defaults: `-60.0` dB, `frame_length=2048`, `hop_length=512`) |
| `resample(samples, src_sr, target_sr)` | `list[float]` | Resample to target sample rate |

`trim(...)` is the simple threshold-based edit helper. The librosa-compatible `trim_silence(...)` helper below uses frame RMS and `top_db`, and returns the trimmed audio together with its original sample range.

### Normalizing a stereo pair

Python keeps two separate stereo normalizers — `normalize_stereo` for peak and `normalize_rms_stereo` for RMS — where the JavaScript surfaces take one function and a `mode` argument. Both measure the level across the pair and apply **one shared gain to both channels**, which is what keeps the stereo image intact: normalizing each channel on its own gain would lift the quieter side until the two peaks matched, changing the balance rather than the level. Because the gain is shared, `NormalizeStereoResult.applied_gain_db` is a single figure and not a pair, and an already-silent pair comes back untouched with the gain at exactly `0`. Alongside `left` and `right` the result carries `length`, the pair's shared sample count.

Either channel empty, or the two channels unequal in length, is refused. The C entry takes one sample rate for the pair, so the two channels cannot disagree on it.

```python
result = sonare.normalize_stereo(left, right, 48000, target_db=-3.0)
print(result.length, result.applied_gain_db)
```

### Cutting a multichannel take on one frame set

`remix(..., align_zeros=True)` snaps slice boundaries to the signal's zero-crossings, which is a per-signal decision: calling `remix` channel by channel snaps each channel to a different frame and drifts a stereo take apart. `remix_aligned_intervals(...)` resolves one cut set from one channel — a flat list of clamped `(start, end)` pairs — so you can slice every channel with the same frames. Note the deliberate asymmetry in defaults: `remix` has `align_zeros=False`, `remix_aligned_intervals` has it `True`.

Two guards stop a slice from vanishing under snapping: a signal with no sign change at all (silence, a DC offset, any constant) is not snapped, and a slice that had content but would collapse to empty keeps its unsnapped boundaries.

```python
cuts = sonare.remix_aligned_intervals(left, [0, 48000, 96000, 144000], sample_rate=48000)
left_out = sonare.remix(left, cuts, sample_rate=48000)
right_out = sonare.remix(right, cuts, sample_rate=48000)
```

## Realtime voice changer

`RealtimeVoiceChanger` wraps the same preset-based live voice chain exposed by WASM and Node native. It keeps high-pass, gate, retune, formant, EQ, compressor, de-esser, reverb, and limiter state across blocks. Use it instead of `voice_change(...)` when processing microphone or stream blocks.

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

Built-in IDs are the strict canonical strings shown above. A custom mapping
must pass the preset JSON validator and contain either a `dsp` object or a
`macros` object, not both; malformed preset shapes are rejected.

Use `realtime_voice_changer_preset_config(preset)` when you want the resolved POD config rather than the JSON form. It returns the canonical, normalized `RealtimeVoiceChangerConfig` for a built-in preset by ID or index.

`realtime_voice_changer_preset_pod(preset)` remains as a compatibility alias.

## librosa-Compatible Helpers

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
| `split_silence_common(signals, top_db?, frame_length?, hop_length?)` | `list[tuple[int, int]]` | The cut points several takes of one part agree are silent. `signals` is one sequence of sequences, so the signal count and per-signal lengths cannot disagree |
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
