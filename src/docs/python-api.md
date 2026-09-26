# Python API

libsonare provides Python bindings for scripts, notebooks, batch jobs, and local desktop tools. The package calls the native libsonare library through **ctypes**, so Python code can use the compiled C/C++ engine without building a custom extension. PyPI wheels are available for supported Linux and macOS targets.

::: details What is ctypes (and the C API)?
libsonare's core is compiled C/C++. **ctypes** is Python's built-in way to call functions in a compiled shared library (`.so`/`.dylib`) directly, with no extra C extension to build. The Python package forwards your calls to the same native code the C++ library runs, so you get native speed from plain Python. ("C API" means the flat set of C functions Python calls under the hood.)
:::

Use this page when you want scripts, notebooks, batch analysis, or local tools that can read files directly. The Python package is usually the easiest route if you are not building a browser UI. The reference continues on three sibling pages: [Python Analysis API](./python-api-analysis.md) for the analysis and feature-extraction functions, [Python Effects API](./python-api-effects.md) for audio effects, room acoustics, and the realtime voice changer, and [Python Types](./python-api-types.md) for the result and option types.

## Python Mental Model

| Step | What happens |
|------|--------------|
| 1. Load audio | `Audio.from_file(...)` reads supported file formats into samples |
| 2. Inspect or process | Call `detect_bpm`, `analyze`, feature functions, editing DSP, mastering, or mixing APIs |
| 3. Use results | Print values, save JSON, render audio, or feed features into your own pipeline |

Most Python APIs accept raw sample arrays plus `sample_rate`. Raw samples are the decoded audio values, not an MP3 or WAV filename. The `Audio` object is a convenience for file-based workflows: load once, then call analysis or processing methods on the same object.

For a first script, keep it this small:

1. `audio = sonare.Audio.from_file("song.mp3")`;
2. call `sonare.detect_bpm(audio.data, audio.sample_rate)` or `sonare.analyze(audio.data, audio.sample_rate)`;
3. print the result or save it as JSON.

::: tip Start with `Audio` or call functions directly
If your workflow begins with an audio file, start with `Audio.from_file(...)`. If you already have samples from NumPy or another loader, call module-level functions such as `detect_bpm(samples, sample_rate)` directly.
:::

## How To Read This Reference

Read this page in three passes:

1. If you are loading files, start with `Audio.from_file(...)`; if you already have samples, call the module-level functions directly.
2. Use [Pick The Smallest API That Solves The Job](#pick-the-smallest-api-that-solves-the-job) to choose a function family instead of scanning the full reference.
3. Return to [Types](./python-api-types.md#types) only when you need exact attribute names, row-major matrix shapes, or JS parity aliases.

A single `analyze(...)` call returns the all-in-one analysis result — chords, sections, timbre, dynamics, rhythm, melody, form, and per-beat strength — matching the other bindings. Reach for the focused functions below when you only need one field or want per-call options.

::: info Default sample rate varies by family
Music-analysis and metering helpers default to `sample_rate=22050`; room-acoustic helpers (`analyze_impulse_response`, `detect_acoustic`, `estimate_room`) default to `48000`. When you load with `Audio.from_file(...)`, always pass `audio.sample_rate` so the per-family default never silently applies to audio recorded at a different rate. An impulse response (IR) here is a recording of how a space responds to one short burst of sound.
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

Default PyPI wheels decode WAV and MP3. Use `libsonare.has_ffmpeg_support()` to check the loaded build. If you need direct M4A/AAC/FLAC/OGG/Opus decoding, clone the repository, build an FFmpeg-enabled wheel, and install that wheel:

```bash
git clone https://github.com/libraz/libsonare.git
cd libsonare
SONARE_FFMPEG=1 bash bindings/python/build_wheel.sh
python3 -m pip install bindings/python/dist/*.whl
```

FFmpeg-enabled builds require FFmpeg development libraries. On macOS, install them with `brew install ffmpeg`. On Debian/Ubuntu, install `libavformat-dev libavcodec-dev libavutil-dev libswresample-dev`.

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

Two exception classes cover every failure:

| Raised when | Class | Message |
|-------------|-------|---------|
| The native library returns a non-OK code | `SonareError`, a `RuntimeError` subclass | Carries a `[4] ` numeric prefix |
| Python-side argument or buffer validation rejects a call before it reaches the C ABI | `SonareValueError` | Plain validation text, no numeric prefix |

`SonareValueError` subclasses **both** `SonareError` and `ValueError`, so `except ValueError:` and `except sonare.SonareError:` each catch it and neither style of handler has to know which class a given entry point picks. Its `.code` is `ErrorCode.INVALID_PARAMETER`, so code that branches on the code treats it exactly like the C-ABI rejection it stands in for. `SonareError.code` holds the same C-ABI values the JS bindings expose as `ErrorCode` (see [Error Handling](./js-api-types.md#error-handling)), `.code_name` gives the cross-binding spelling, and the CLI maps the codes onto its [exit codes](./cli.md#exit-codes).

```python
try:
    result = sonare.master_audio_stereo(left, right, sample_rate=48000, preset_name="pop")
except sonare.SonareError as e:
    print(e.code, e.code_name, e)
```

#### Arguments are checked before the call

Buffer-taking entry points preflight their arguments, so an empty, mis-sized, or non-finite buffer is reported against the function you called rather than against an internal helper or a bare C symbol:

```text
master_audio_stereo: right must not be empty
spectral_centroid: samples contains NaN or Inf at index 0
```

The names in the message are the ones in your call: `cross_similarity` reports `x` and `x_rows`, not the internal `data` / `rows` spelling, and the scalar and stereo meters name the facade function (`metering_peak_db`) rather than the `sonare_`-prefixed C symbol. On entry points that expose `validate`, passing `validate=False` still skips the O(n) NaN/Inf scan, but not the emptiness check.

::: warning If you match on message text
Handlers that catch `SonareError` or `ValueError`, or that branch on `.code`, need no change. Code that matches the *text* of a validation message does: the wording names the entry point and the argument.
:::

#### Input some entry points refuse

- `trim_silence`, `split_silence` and `fix_frames` raise on an empty buffer instead of returning an empty result.
- `tempogram_ratio` rejects a `factors` entry that is not finite and positive. A NaN reaches an undefined float-to-int cast in the core, and an infinity degenerates silently to the DC lag.
- `mix_stereo` refuses a scene it cannot mix — strips that are all empty, or a strip carrying NaN or Inf, named by strip index and channel (`mix_stereo: strips[1] right contains NaN or Inf at index 0`). A zero-frame block stays a valid no-op at the C ABI, where it means "process this block" rather than "mix these strips".

#### What is not checked

The element-wise conversions keep their empty-in / empty-out contract: `power_to_db`, `amplitude_to_db`, `db_to_power`, `db_to_amplitude`, `preemphasis`, `deemphasis`, `vector_normalize`, `frame_signal`, `pad_center` and `fix_length` accept an empty sequence and return one. Among the tempo helpers only `tempogram_ratio` guards its input matrix; `tempogram`, `fourier_tempogram`, `cyclic_tempogram` and `plp` do not.

`f0_hz` is never scanned for non-finite values. pYIN marks an unvoiced frame with `nan`, and that track representation has to pass straight into pitch correction, so `note_segments`, `extract_notes`, `decompose_note_pitch`, `split_note` and `merge_notes` check its shape but not its values.

CLI **usage** errors raise a plain `ValueError`, not `SonareValueError`, because they report a command-line mistake rather than an API argument. Both exit with code `3`.

### What this build can do

`capabilities()` returns the build-diagnostics report `sonare doctor` prints, and
`capability_catalog()` returns the machine-readable processor/parameter/preset
catalog validated against `schemas/capability-catalog.schema.json`.

```python
import libsonare as sonare

caps = sonare.capabilities()
if not caps["features"]["ffmpeg"]:
    print("This wheel decodes:", caps["decode"]["builtin"])

catalog = sonare.capability_catalog()
for processor in catalog["processors"]:
    for param in processor["params"]:
        # min / max / default are None when the core does not declare a bound.
        build_slider(processor["id"], param)
```

Branch on the catalog rather than on a hand-maintained table: a parameter's
range, default, unit, and realtime-safety all come from the loaded build. The
same data is `capabilities()` / `capabilityCatalog()` on Node and WASM.

`catalog["masteringPresets"]` lists built-in mastering and restoration presets. Each entry has `name`, `kind`, `targetLufs`, `truePeakCeilingDb`, and `maxLimiterGainReductionDb`; restoration entries set the three numeric fields to `None`. Processor entries also expose conditional parameter groups in `slots`, with `name`, `parent`, `activation`, and `minCrossoverCutoffs` fields.

### Cancelling a long call

Analysis and mastering calls that report progress also take `cancel`, a
predicate polled at the same native boundaries. Return `True` and the call
aborts with `SonareError` code `8` (`SONARE_ERROR_CANCELLED`), leaving no
partial output.

```python
import threading

stop = threading.Event()

try:
    result = sonare.master_audio(
        samples,
        sample_rate,
        preset_name="pop",
        on_progress=lambda p, stage: print(stage, p),
        cancel=stop.is_set,
    )
except sonare.SonareError as e:
    if e.code == 8:
        print("cancelled")
    else:
        raise
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
    )
)

for block in audio_blocks:
    stream.process(block)

    frames = stream.read_frames(stream.available_frames())
    # frames.mel is flattened [n_frames * n_mels]
    # check frames.feature_flags before optional arrays; chroma uses [n_frames * n_chroma]

    stats = stream.stats()
    if stats.bpm > 0:
        print(stats.bpm, stats.bpm_confidence)

stream.close()
```

For lower-bandwidth UI transfer, use a quantized read instead of `read_frames(max_frames)`. `output_format` is retained for source compatibility only; omit it or keep it at `0` and choose the desired read method explicitly:

| Method | What changes |
|--------|--------------|
| `read_frames_u8(max_frames, quantize_config?)` | Feature arrays are quantized to unsigned 8-bit values. |
| `read_frames_i16(max_frames, quantize_config?)` | Feature arrays are quantized to signed 16-bit values. |

`quantize_config` is an optional `QuantizeConfig` (exported from `libsonare`) that widens the quantization ranges for streams much louder or quieter than the defaults; omit it to use the defaults. Its fields and defaults are `mel_db_min=-80.0`, `mel_db_max=0.0`, `onset_max=50.0`, `rms_max=1.0`, `centroid_max=11025.0`. The quantizers clamp normalized values to `[0, 1]`, so a signal outside these ranges otherwise saturates silently to the endpoints. This mirrors `StreamQuantizeConfig` in the JS/WASM streaming docs.

Both return timestamps as floats. If you synchronize against an external audio clock, feed chunks with `process_with_offset(samples, sample_offset)` so returned timestamps follow that timeline.

`process_with_offset` accepts only contiguous offsets. After a gap, seek, or switching from `process(...)`, call `reset(base_sample_offset)` before feeding the next block. `StreamConfig.max_progression_entries` (default `4096`) bounds each retained chord and bar progression; `stats()` exposes `dropped_chord_progression_entries` and `dropped_bar_progression_entries` when the oldest history is discarded.

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

Python exposes the same named mastering processors as the browser demo. Use the name-list helpers to inspect the active build, then call mono, stereo, pair, or analysis APIs with explicit parameters. A full chain runs its stages in a fixed order:

<FlowDiagram
  title="Mastering chain order"
  :nodes="[
    { id: 'repair', label: 'Repair', col: 0, row: 0, variant: 'accent' },
    { id: 'eq', label: 'EQ', col: 1, row: 0 },
    { id: 'dynamics', label: 'Dynamics', col: 2, row: 0 },
    { id: 'saturation', label: 'Saturation', col: 3, row: 0 },
    { id: 'spectral', label: 'Spectral', col: 4, row: 0 },
    { id: 'stereo', label: 'Stereo', col: 5, row: 0 },
    { id: 'maximizer', label: 'Maximizer', col: 6, row: 0 },
    { id: 'loudness', label: 'Loudness', col: 7, row: 0, variant: 'success' }
  ]"
  :edges="[
    { from: 'repair', to: 'eq' },
    { from: 'eq', to: 'dynamics' },
    { from: 'dynamics', to: 'saturation' },
    { from: 'saturation', to: 'spectral' },
    { from: 'spectral', to: 'stereo' },
    { from: 'stereo', to: 'maximizer' },
    { from: 'maximizer', to: 'loudness' }
  ]"
  caption="Only the stages you configure are activated, but whichever are enabled run in this order."
/>

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
# -> ['pop', 'edm', 'acoustic', 'hipHop', 'aiMusic', 'speech', 'streaming', 'youtube', 'broadcast', 'podcast', 'audiobook', 'cinema', 'jpop', 'ambient', 'lofi', 'classical', 'drumAndBass', 'techno', 'metal', 'trap', 'rnb', 'jazz', 'kpop', 'trance', 'gameOst', 'vinyl', 'tapeHiss', 'fieldRecording', 'voiceMemo', 'shellac78']
preset_params = sonare.mastering_preset_params("aiMusic")
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
print(chain_result.output_lufs, chain_result.output_true_peak_dbtp, chain_result.output_lra)
print(chain_result.stage_gain_reductions)
if chain_result.report is not None:
    print(chain_result.report.before, chain_result.report.after)
    print(chain_result.report.band_energy_delta_db)

# Block-by-block streaming variant
with sonare.StreamingMasteringChain({
    "eq.tilt.tiltDb": 0.5,
    "dynamics.compressor.thresholdDb": -20.0,
}) as chain:
    chain.prepare(sample_rate=48000, max_block_size=512, num_channels=1)
    print(chain.stage_names(), chain.latency_samples)  # latency_samples is a property
    output = chain.process_mono([0.0] * 512)
    while True:
        tail = chain.flush_mono()
        if not tail:
            break
        output.extend(tail)

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

# Stereo entry points: same params, same JSON, measured from both channels.
stereo_profile = json.loads(sonare.mastering_audio_profile_stereo(left, right, sample_rate=sample_rate, params={
    "n_fft": 2048,
    "hop_length": 512,
    "true_peak_oversample": 4,
}))
stereo_suggestions = json.loads(sonare.mastering_assistant_suggest_stereo(left, right, sample_rate=sample_rate, params={
    "target_lufs": -14,
    "ceiling_db": -1,
    "prefer_streaming_safe": True,
}))
# Omitting platforms uses the built-in Spotify / Apple Music / YouTube set.
stereo_preview = json.loads(sonare.mastering_streaming_preview_stereo(left, right, sample_rate=sample_rate))
```

Each of the three JSON helpers has a `_stereo` sibling that takes `left` and `right` instead of one buffer, accepts the same `params` / `platforms`, and returns the same JSON string. Reach for it whenever you actually have two channels. The mono entry points measure a `0.5 * (left + right)` downmix, and on decorrelated stereo material that downmix reads about 6 dB low — which drags down integrated loudness, the normalization gain derived from it, and the ceiling-risk judgement by the same amount. On a decorrelated pink-noise pair (48 kHz, 4 s) the downmix path reports -22.55 LUFS against -16.44 LUFS from the stereo path, a 6.11 dB gap that turns a Spotify `normalizationGainDb` of +2.44 into +8.55. A correlated pair differs by only 3.01 dB, the plain downmix halving; the remaining ~3 dB is the decorrelation.

Only the `loudness` block of the stereo profile is measured from both channels: integrated LUFS and LRA come from the channel-summed program, and true peak is the larger of the two. The spectral, dynamics, and tempo fields describe shape and timing rather than absolute level, so they stay on the downmix and remain directly comparable with the mono call.

`mastering_audio_profile()` accepts optional profile params: `n_fft`, `hop_length`, and `true_peak_oversample`. `mastering_assistant_suggest()` accepts `target_lufs`, `ceiling_db`, `enable_repair`, `prefer_streaming_safe`, and `speech_mono_amount`; camelCase aliases also work through the shared native parser.

Mastering helpers also accept limiter-release and static-gain staging controls. The simple `mastering()` helper uses `release_ms` (`0` keeps the 50 ms library default) and `apply_gain_at_input_rate`. Preset/chain overrides use the flat keys `"maximizer.truePeakLimiter.releaseMs"` and `"maximizer.truePeakLimiter.applyGainAtInputRate"`; supplied override values are applied directly.

Offline chain and preset results also report `output_true_peak_dbtp` at the configured loudness oversample factor, `output_lra` (EBU R128 loudness range in LU), and `stage_gain_reductions`. Each reduction identifies the reporting dynamics/maximizer stage and its most recent gain reduction in dB (zero or negative).

When `result.report` is present, its `before` and `after` summaries each contain `integrated_lufs`, `max_momentary_lufs`, `max_short_term_lufs`, `true_peak_dbtp`, and `loudness_range`. The report also contains applied gain, maximum gain reduction, whether peak headroom limited the loudness target, and `band_energy_delta_db`, a 32-band logarithmic spectral-energy change from before to after.

After the final streaming input block, call `flush_mono()` until it returns an empty list; for stereo, call `flush_stereo()` until it returns two empty lists.

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

`mastering_insert_param_info(name)` returns descriptors for the insert's construction keys and realtime automation targets, including their type, bounds, default, choices, and conditional `slot`. `mastering_insert_timing(name, params, sample_rate)` builds that configured insert and returns its `latencySamples` and `tailSamples`; keys the insert does not read are rejected. `mastering_preset_params(preset)` returns the preset's flat override map, which can be passed to `master_audio(..., overrides=...)` unchanged.

| Purpose | Function |
|---------|----------|
| Apply simple loudness mastering | `mastering()` |
| List built-in mastering presets | `mastering_preset_names()` |
| Get a built-in preset's flat chain parameters | `mastering_preset_params(preset)` |
| Apply a preset to mono audio | `master_audio()` |
| Apply a preset to stereo audio | `master_audio_stereo()` |
| Run a full mono chain | `mastering_chain()` |
| Run a full stereo chain | `mastering_chain_stereo()` |
| Run a streaming chain (block-by-block) | `StreamingMasteringChain` |
| Generate an audio profile for mastering decisions | `mastering_audio_profile()` |
| Generate an audio profile from both stereo channels | `mastering_audio_profile_stereo()` |
| Generate assistant suggestions from source analysis | `mastering_assistant_suggest()` |
| Generate assistant suggestions from both stereo channels | `mastering_assistant_suggest_stereo()` |
| Preview delivery loudness by platform | `mastering_streaming_preview()` |
| Preview delivery loudness from both stereo channels | `mastering_streaming_preview_stereo()` |
| List mono/stereo processors | `mastering_processor_names()` |
| Get machine-readable processor classifications | `mastering_processor_catalog()` |
| List chain insert processors | `mastering_insert_names()` |
| List the parameter keys an insert accepts | `mastering_insert_param_names(name)` |
| Describe insert construction keys and automation targets | `mastering_insert_param_info(name)` |
| Get configured insert latency and tail | `mastering_insert_timing(name, params, sample_rate)` |
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
    print(mixer.latency_samples())  # compiled graph latency for dry/wet alignment
    block = mixer.process_stereo([vocal_block_l, music_block_l], [vocal_block_r, music_block_r])
    meter = mixer.strip_meter(0, tap="postFader")
    mixer.schedule_fader_automation(0, 48000 * 8, -6, curve="s-curve")
finally:
    mixer.close()
```

`mixer.process_stereo(...)` returns a `MixerStereoResult` named tuple with `.left` and `.right` (`list[float]`) and `.sample_rate` (`int`), mirroring the Node/WASM `{left, right, sampleRate}` shape.

`Mixer.set_pan_law(...)` and `RealtimeEngine.set_track_strip_pan_law(...)`
accept a `PanLaw` enum, an integer ordinal, or a case-insensitive string alias.
Accepted spellings include `const3db`, `const-3db`, `-3db`, `const4.5db`,
`const-4.5db`, `-4.5db`, `const6db`, `const-6db`, `-6db`, `linear0db`,
`linear-0db`, `linear`, and `0db`; underscores are treated like hyphens.

See [Mixing Engine](./mixing.md) for routing concepts, scene presets, and real-time notes.

## Projects, Instruments & Live MIDI

The headless-DAW API is available in Python as well: author arrangements with `Project`, render them through the built-in instruments, and drive the realtime engine with live MIDI. The dedicated guides carry the depth — this is the Python entry-point map.

| Task | API | Guide |
|------|-----|-------|
| Author tracks, clips, tempo, markers, undo/redo | `Project` (a context manager — use `with`) | [Project Editing](./project-editing.md) |
| Render MIDI through the built-in synthesizer | `Project.bounce_with_synth_instrument(...)`, `synth_preset_names()`, `synth_preset_patch(name)`, `SynthPatch` | [Built-in Synthesizer](./native-synth.md), [Bouncing Projects](./project-bounce.md) |
| Render MIDI through a SoundFont | `Project.load_soundfont(data)`, `Project.bounce_with_sf2_instrument(...)` | [SoundFont Player](./soundfont-player.md) |
| Host your own instrument during a bounce | `Project.bounce_with_instruments(...)` with the `ExternalInstrument` protocol — a `render(channels, num_frames)` callback plus optional `prepare`/`on_event` hooks and `latency_samples`. **Python-only.** | [Bouncing Projects](./project-bounce.md) |
| Play instruments live from MIDI events and replace destination MIDI FX | `RealtimeEngine.set_synth_instrument(...)`, `RealtimeEngine.load_soundfont(...)`, `RealtimeEngine.set_midi_fx(...)`, plus the engine's MIDI input queue | [MIDI Input](./midi-input.md) |
| Schedule MIDI clips into the live engine, sample-accurately | `RealtimeEngine.set_midi_clips([...])` with `EngineMidiClipSchedule` / `EngineMidiEvent`, `RealtimeEngine.sample_at_ppq(ppq)` — ppq is pulses per quarter note, the musical-time unit | [Realtime Engine](./realtime-engine.md#midi-clip-scheduling-and-sampleatppq) |
| Set per-track cue monitoring | `RealtimeEngine.set_track_monitor_mode(lane_index, mode, render_frame=-1)` with `EngineTrackMonitorMode` (`off`/`pfl`/`afl` — PFL listens pre-fader, AFL post-fader) | [Realtime Engine](./realtime-engine.md#track-lanes-buses-and-channel-strips) |
| Send a destination to external MIDI hardware | `set_midi_destination_external(...)`, `set_external_midi_clock_enabled(...)`, `drain_external_midi(...)`, `external_midi_dropped_count()` | [Realtime Engine](./realtime-engine.md#sending-a-track-to-external-midi-gear) |
| Mix and automate the engine's tracks live | Lane/strip methods plus `set_bus_strip_insert_param_by_name(...)`, `set_bus_strip_insert_bypassed(...)`, `resolve_track_insert_automation_id(...)`, `resolve_master_insert_automation_id(...)`, `resolve_bus_insert_automation_id(...)`, and `set_param_smoothing_ms(...)` | [Realtime Engine](./realtime-engine.md#track-lanes-buses-and-channel-strips) |
| Read wide meters and scopes | `drain_meter_telemetry_wide(...)`, `configure_scope_telemetry(...)`, `drain_scope_telemetry(...)` | [Realtime Engine](./realtime-engine.md#surround-group-buses-and-wide-meters) |

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

Every numeric `SynthPatch` field defaults to `None`, meaning "keep the base preset's value". A field you never set therefore reads back as `None`, not `0.0`, and any value you do supply is a real override — including an explicit `0`, so `SynthPatch(preset="warm-pad", amp_sustain=0)` genuinely zeroes the amp sustain instead of being indistinguishable from leaving it unset. A patch obtained from `synth_preset_patch(name)` comes back fully populated with the preset's concrete values, so its numeric fields are never `None`. Enum fields (`engine_mode`, `waveform`, `filter_model`, `filter_output`, `body`, `retrigger`) keep `0` / `"default"` as their keep-the-base value. `mod_routings=None` keeps the base mod matrix, an empty tuple clears it, and a non-empty tuple replaces it.

### Opaque assist sidecars

`Project` can carry per-project, undoable, module-owned opaque byte blobs (assist sidecars), scoped by module ID, target track, and a region. Set one with `project.set_assist_sidecar(module_id, payload, *, schema_version=0, target_track_id=0, region_start_ppq=0.0, region_end_ppq=0.0)`; read them back with `project.assist_sidecar_count()`, `project.get_assist_sidecar(index) -> AssistSidecar`, and `project.assist_sidecars()`. See [Project Editing](./project-editing-midi.md#assist-sidecars) for the cross-binding details.

## Where the sections went

| Section | Now on |
|---------|--------|
| Audio Effects | [Python Effects API](./python-api-effects.md#audio-effects) |
| Feature Extraction | [Python Analysis API](./python-api-analysis.md#feature-extraction) |
| Unit Conversions | [Python Analysis API](./python-api-analysis.md#unit-conversions) |
| API Reference (Audio, Analysis Functions) | [Python Analysis API](./python-api-analysis.md#api-reference) |
| Room Acoustics | [Python Effects API](./python-api-effects.md#room-acoustics) |
| Effects Functions | [Python Effects API](./python-api-effects.md#effects-functions) |
| Realtime voice changer | [Python Effects API](./python-api-effects.md#realtime-voice-changer) |
| Feature Extraction Functions | [Python Analysis API](./python-api-analysis.md#feature-extraction-functions) |
| Inverse Reconstruction Functions | [Python Analysis API](./python-api-analysis.md#inverse-reconstruction-functions) |
| Metering Functions | [Python Analysis API](./python-api-analysis.md#metering-functions) |
| Scale Quantization | [Python Analysis API](./python-api-analysis.md#scale-quantization) |
| librosa-Compatible Helpers | [Python Effects API](./python-api-effects.md#librosa-compatible-helpers) |
| Conversion Functions | [Python Analysis API](./python-api-analysis.md#conversion-functions) |
| Types | [Python Types](./python-api-types.md#types) |
