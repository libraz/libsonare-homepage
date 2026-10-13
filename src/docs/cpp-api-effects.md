---
title: C++ Effects API
description: Audio effects, the mixing engine, editing helpers, and geometric room acoustics in the libsonare C++ interface.
---

# C++ Effects API

Audio effects, the mixing engine, editing helpers, and geometric room acoustics in the libsonare C++ interface; see [C++ API Reference](./cpp-api.md) for the rest of the C++ surface and [C ABI Reference](./cpp-api-c-abi.md) for the C ABI.

## Effects

### HPSS <Badge type="warning" text="Heavy" />

::: tip Performance
HPSS requires STFT computation and median filtering. Processing time scales with audio duration.
:::

```cpp
HpssConfig config;
config.kernel_size_harmonic = 31;
config.kernel_size_percussive = 31;
config.use_soft_mask = false;  // hard mask; true is the default

StftConfig stft_config;
stft_config.n_fft = 2048;
stft_config.hop_length = 512;

auto result = hpss(audio, config, stft_config);
// result.harmonic
// result.percussive

auto with_residual = hpss_with_residual(audio, config, stft_config);
// with_residual.harmonic / .percussive / .residual

// Convenience functions
auto harm = harmonic(audio);
auto perc = percussive(audio);
```

<SonareDemo id="hpss-separation" />

### Time Stretch <Badge type="warning" text="Heavy" />

::: tip Performance
Uses phase vocoder algorithm. Processing time increases with audio duration.
:::

```cpp
TimeStretchConfig stretch_config;
stretch_config.n_fft = 2048;
stretch_config.hop_length = 512;

// 0.5 = half speed, 2.0 = double speed
auto slow = time_stretch(audio, 0.5f, stretch_config);
auto fast = time_stretch(audio, 1.5f, stretch_config);
```

### Pitch Shift <Badge type="warning" text="Heavy" />

::: tip Performance
Combines time stretching and resampling. Processing time increases with audio duration.
:::

```cpp
PitchShiftConfig shift_config;
shift_config.n_fft = 2048;
shift_config.hop_length = 512;

// Semitones: +12 = one octave up
auto higher = pitch_shift(audio, 2.0f, shift_config);
auto lower = pitch_shift(audio, -3.0f, shift_config);
```

### Normalize & Audio Utilities

```cpp
// Peak normalization
auto normalized = normalize(audio, 0.0f);      // Target peak level in dB

// RMS normalization
auto rms_norm = normalize_rms(audio, -20.0f);  // Target RMS level in dB

// Silence trimming (absolute dBFS threshold)
auto trimmed = trim_absolute(audio, -60.0f);   // Threshold in dBFS

// Frame/RMS silence trimming (needs #include <effects/silence.h>; not in <sonare.h>).
// Defaults are frame_length=2048, hop_length=512.
std::vector<float> samples(audio.begin(), audio.end());
auto framed_trim = trim(samples, /*top_db=*/60.0f, /*frame_length=*/2048,
                        /*hop_length=*/512);

// Level measurement (metering/basic.h, namespace sonare::metering)
float peak = sonare::metering::peak_db(audio);  // Peak amplitude in dB
float rms = sonare::metering::rms_db(audio);    // RMS level in dB

// Gain application
auto louder = apply_gain(audio, 6.0f);   // +6 dB
auto quieter = apply_gain(audio, -3.0f); // -3 dB

// Fades
auto with_fade_in = fade_in(audio, 0.5f);   // 0.5 second fade in
auto with_fade_out = fade_out(audio, 1.0f); // 1.0 second fade out

// Find silence boundaries
auto [start, end] = detect_silence_boundaries(audio, -60.0f);
```

### librosa-Compatible Helpers

Each helper mirrors the corresponding `librosa`
function — see [librosa Compatibility](./librosa-compatibility.md) for the
full mapping.

::: tip What each helper is for
- **`preemphasis` / `deemphasis`** — classic one-tap IIR pre-processing for the waveform.
- **`trim` / `split`** — trim leading/trailing silence or split on silent gaps.
- **`frame` / `pad_center` / `fix_length` / `fix_frames`** — framing and size-alignment utilities for fixed-frame DSP.
- **`peak_pick` / `vector_normalize`** — peak detection on 1-D signals and vector-norm normalization.
- **`pcen`** — dynamic range compression for mel spectrograms.
- **`tonnetz`** — projects chroma into a 6-D harmonic space.
- **`tempogram` / `plp`** — time-varying tempo representation and dominant local pulse.
:::

These helpers live in focused headers and are **not** pulled in by `<sonare.h>`;
include the header for each one you use. They take raw sample buffers
(`std::vector<float>` or `const float*` + length), not `Audio`.

```cpp
#include <core/pcen.h>
#include <effects/preemphasis.h>
#include <effects/silence.h>
#include <feature/rhythm.h>
#include <feature/tonnetz.h>
#include <util/frame.h>
#include <util/padding.h>
#include <util/peak.h>
#include <util/vector_normalize.h>

using namespace sonare;

// Pre-emphasis / de-emphasis (librosa.effects.preemphasis / deemphasis)
// Buffer in, buffer out — pass audio samples, not an Audio object.
auto pre   = preemphasis(samples, /*coef=*/0.97f);
auto deemp = deemphasis(samples, /*coef=*/0.97f);

// Silence trim / split (librosa.effects.trim / split) — buffer in, sample-index ranges out
TrimResult trimmed = trim(samples, /*top_db=*/60.0f);  // {audio, start_sample, end_sample}
auto intervals = split(samples, /*top_db=*/60.0f);     // std::vector<std::pair<int,int>>

// Frame / pad / length helpers (librosa.util.*)
auto frames = frame(samples, /*frame_length=*/2048, /*hop_length=*/512);
auto padded = pad_center(values, /*size=*/4096);
auto fixed  = fix_length(values, /*size=*/4096);
auto bounds = fix_frames(frame_indices, /*x_min=*/0, /*x_max=*/-1);

// Peak picking and vector normalize (librosa.util.peak_pick / normalize).
// The C++ name is normalize(); vector_normalize is the header/C-ABI name.
// Overload resolution keeps it distinct from normalize(const Audio&, float).
auto peaks  = peak_pick(onset_envelope, pre_max, post_max, pre_avg, post_avg, delta, wait);
auto normed = normalize(values, NormType::L2);  // Inf, L1, L2, Power

// PCEN (librosa.pcen) — input is row-major [n_bins x n_frames].
// Sample rate and hop length are PcenConfig fields, not positional arguments.
PcenConfig pcen_config;
pcen_config.sr = sample_rate;
pcen_config.hop_length = hop_length;
auto pcen_out = pcen(mel, n_bins, n_frames, pcen_config);

// Tonnetz / tempogram / PLP
auto tonnetz_out = tonnetz(chromagram.data(), n_chroma, n_frames);
auto tempo_out   = tempogram(onset_env, sample_rate);
PlpConfig plp_config;
plp_config.sr = sample_rate;
auto plp_out     = plp(onset_env, plp_config);
```

## C API

The C ABI for FFI integration (handle-based and sample-based entry points, the header index, the realtime engine, mastering, mixing and project calls) is documented on [C ABI Reference](./cpp-api-c-abi.md). The room-acoustics calls sit in this page under [Room morph through the C ABI](#room-morph-through-the-c-abi).

## Mixing Engine

The C++ core includes the mixing engine used by the C, Python, Node, and WASM bindings. The main building blocks are channel strips, buses, sends, FX buses, VCA groups, automation lanes, meter snapshots, goniometer buffers, scene presets, and offline stereo rendering.

```cpp
#include <mixing/channel_strip.h>
#include <mixing/api/presets.h>

auto scene = sonare::mixing::api::scene_preset(
  sonare::mixing::api::scene_preset_from_string("vocalReverbSend")
);
auto json = sonare::mixing::api::scene_to_json(scene);

sonare::mixing::ChannelStrip strip;
strip.set_input_trim_db(3.0f);
strip.set_fader_db(-6.0f);
strip.set_pan(-0.15f);
strip.set_width(1.1f);
strip.prepare(48000.0, 512);
```

For cross-runtime examples and scene-level guidance, see [Mixing Engine](./mixing.md).

## Geometric Room Acoustics

These APIs estimate, synthesize, or apply a room model. They live in focused module headers and require builds with `BUILD_ACOUSTIC_SIM=ON` (the default source-build setting).

::: info Terms in this section
- **Equivalent room** is a practical room model inferred from audio. It is not exact measured geometry.
- **RIR** means room impulse response: samples that describe how a room reacts to a short sound.
- **RT60** is the reverberation time: how long a tail takes to decay by 60 dB (see [Acoustic Analysis](./acoustic-analysis.md)).
- **DRR (direct-to-reverberant ratio)** compares the level of the direct sound against the reverberant tail, in dB. Higher means a drier, closer-sounding source.
- **Room morphing** is a creative room-character effect, not dereverberation.
:::

<SonareDemo id="room-decay" />

```cpp
#include <acoustic/rir_synthesizer.h>
#include <analysis/room_estimator.h>
#include <effects/acoustic/room_morph.h>

using namespace sonare;

acoustic::ShoeboxRoom room = acoustic::uniform_shoebox({7.0f, 5.0f, 3.0f}, 0.2f);
acoustic::SourceListener placement{{1.0f, 1.0f, 1.2f}, {5.0f, 4.0f, 1.7f}};
auto rir = acoustic::synthesize_rir(room, placement, 48000);
if (!rir.rir.empty()) {
  RoomEstimate estimate = estimate_room(rir.rir);
}

effects::acoustic::RoomMorphConfig morph_config;
morph_config.target = room;
morph_config.placement = placement;
morph_config.wet = 0.6f;
effects::acoustic::RoomMorphResult morphed = effects::acoustic::room_morph(recording, morph_config);
// morphed.audio is the render; morphed.diagnostics lists what the target-RIR synthesis clamped.
```

The three calls cover different parts of the workflow:

- `estimate_room(...)` returns volume, representative dimensions, absorption bands, RT60 bands, DRR, and confidence.
- `synthesize_rir(...)` reports geometry problems through diagnostics. It returns an empty RIR when the source or listener placement is invalid.
- `room_morph_stereo(left, right, config)` morphs a stereo pair: the target room is heard at two omnidirectional receivers `config.receiver_spacing_m` apart (default 0.5 m, in (0, 4]) across the listener, each channel is convolved with its own receiver's response, and one linked suppressor gain applies to both. It returns a `RoomMorphStereoResult` with `left`, `right` and the deduplicated `diagnostics`, and throws `ErrorCode::InvalidParameter` for channels of different length or a receiver pair outside the room.
- `room_morph(...)` renders the input with the target room character and returns a `RoomMorphResult`: the audio plus the same diagnostics `synthesize_rir(...)` raises, since the target RIR is built by the same code. An unusable configuration throws `ErrorCode::InvalidParameter` instead of reporting an error entry.

::: details Configuration details
`acoustic::RirSynthConfig` controls RIR generation:

- image-source order;
- Sabine/Eyring late-tail model;
- deterministic seed;
- maximum RIR length;
- early/late mixing time;
- crossfade width.

`RoomEstimateConfig` forwards analyzer settings through `AcousticConfig`. These include mode, octave-band count, minimum decay span, and noise-floor margin.

Aspect hints and `reference_absorption` define the equivalent-room prior.
:::

### Names and estimate-to-geometry helpers in the C ABI

`sonare_material_preset_name(preset)` and `sonare_acoustic_mode_name(mode)` return the name of a `SONARE_MATERIAL_PRESET_*` or `SONARE_ACOUSTIC_MODE_*` value (`"none"`, `"concrete"`, `"wood"`, `"curtain"`, `"carpet"`, `"glass"`; `"auto"`, `"blind"`, `"impulse_response"`), or `NULL` past the last one. The values are contiguous from 0, so counting up to `NULL` lists the valid names. The returned strings are static; do not free them.

`sonare_room_geometry_from_estimate(&estimate, &config)` turns a `sonare_estimate_room` result into the geometry of a `SonareRirSynthConfig`: it sets the three dimensions and borrows the per-band absorption from the estimate, which therefore has to outlive the config. Source and listener are the default placement (source (1, 1, 1.2), listener (5, 4, 1.7)) scaled per axis by the estimated dimension over the default 7 x 5 x 3 one, so they lie inside any estimated room, and the scalar `absorption` is the mean of the finite bands (it stays zero with none); overwrite any field before calling `sonare_synthesize_rir`. Non-finite absorption bands are not borrowed, and an estimate with no measurable decay (non-finite dimensions) is refused with `SONARE_ERROR_INVALID_PARAMETER`.

### Room morph through the C ABI

`sonare_room_morph` in `sonare_c_acoustic.h` takes the input samples, their sample rate and a `SonareRoomMorphConfig`, and hands back the morphed mono signal through an out-pointer pair. The diagnostics the target-room synthesis raised are not in the result: they travel on the thread-local structured channel, read after the call returns. Ownership and lifetime follow the code:

```c
float* out = NULL;
size_t out_length = 0;
SonareError err = sonare_room_morph(samples, length, sample_rate, &config, &out, &out_length);
if (err != SONARE_OK) return err;  // nothing was allocated; sonare_last_error_message() has the detail
for (size_t i = 0; i < sonare_last_diagnostic_count(); ++i) {
  const char* code = sonare_last_diagnostic_code(i);  // e.g. "acoustic.rir_length_clamped"
  // sonare_last_diagnostic_message(i) and sonare_last_diagnostic_severity(i) sit beside it
}
sonare_free_floats(out);
```

- `*out` is allocated by the library and released with `sonare_free_floats`. It holds `length` samples plus the target room's tail, at the input sample rate. An empty input yields `NULL` / `0`, which is safe to free; on a non-`SONARE_OK` return nothing was allocated.
- The diagnostic strings are owned by the library, never `NULL`, and valid until the next C ABI call on the same thread that records or clears a diagnostic — `sonare_room_morph` and `sonare_synthesize_rir` both clear the channel on entry, and the count reads `0` after any other call. Reading does not consume an entry, and there is nothing to free; copy the strings you keep.
- An index at or past the count returns `""` and `SONARE_DIAGNOSTIC_INFO`, so bound the loop by the count rather than by severity. Every entry a morph publishes is a recoverable clamp at `SONARE_DIAGNOSTIC_WARNING`; an unusable configuration is an error return, not an entry.
- `sonare_room_morph_stereo(left, right, length, sample_rate, &config, &out)` is the stereo form. It fills a `SonareRoomMorphStereoResult` (`left`, `right`, `length`, `sample_rate`) that is released with `sonare_free_room_morph_stereo_result`; `config->receiver_spacing_m` is the receiver spacing in metres, in (0, 4], and `0` selects the 0.5 m default. `sonare_room_morph` does not read the field. Diagnostics travel on the same thread-local channel.
- `sonare_last_warning_message()` carries the same entries flattened into one `code: message; code: message` string. It is kept for callers written against it — the structured accessors are the form to branch on, because a message containing the separator cannot be split back out and the severity is not in the text.

### Air absorption in large rooms

For a large hall, the geometry-only RT60 estimate can overstate the high-frequency tail because it does not account for air loss over a long path. The C++ acoustic core can add the ISO 9613-1 atmospheric-absorption term to the Sabine/Eyring calculation. It is opt-in: omitting the last argument keeps the earlier geometry-only result exactly.

```cpp
#include <acoustic/late_reverb.h>

acoustic::AirAbsorption air;
air.temperature_c = 20.0f;
air.humidity_percent = 50.0f;

const auto rt60 = acoustic::shoebox_reverb_time(
    room, acoustic::ReverbModel::Eyring, &air);
// rt60.rt60_bands: air loss shortens the high bands most.
```

`AirAbsorption` defaults to 20 °C and 50% relative humidity. The same term is opt-in on every RIR synthesis and room-morph surface: `air_absorption_enabled` / `air_temperature_c` / `air_humidity_percent` on `SonareRirSynthConfig` and `SonareRoomMorphConfig` (a 0 climate field selects the ISO reference climate, so request 0.01 for 0 °C), `airAbsorptionEnabled` on Node and WASM, and `air_absorption_enabled` in Python. Left off, every surface keeps the geometry-only result.

