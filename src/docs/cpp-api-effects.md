---
title: C++ Effects API
description: Audio effects, the mixing engine, editing helpers, and the C ABI for FFI integration in the libsonare C++ interface.
---

# C++ Effects API

Audio effects, the mixing engine, editing helpers, and the C ABI for FFI integration in the libsonare C++ interface; see [C++ API Reference](./cpp-api.md) for the rest of the C++ surface.

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

For FFI integration. Two parallel entry-point styles are provided: handle-based (takes a `SonareAudio*`) and sample-based (takes a raw `float*` buffer).

```c
#include <sonare/sonare_c.h>

// Audio handle
SonareError sonare_audio_from_buffer(const float* data, size_t length, int sample_rate,
                                     SonareAudio** out);
SonareError sonare_audio_from_memory(const uint8_t* data, size_t length, SonareAudio** out);
SonareError sonare_audio_from_file(const char* path, SonareAudio** out);  // Not available in WASM
SonareError sonare_audio_file_channel_count(const char* path, int* out_channels);  // Not available in WASM
void        sonare_audio_free(SonareAudio* audio);
const float* sonare_audio_data(const SonareAudio* audio);
size_t      sonare_audio_length(const SonareAudio* audio);
int         sonare_audio_sample_rate(const SonareAudio* audio);
float       sonare_audio_duration(const SonareAudio* audio);

// Handle-based analysis (avoids copying samples across the FFI boundary)
SonareError sonare_audio_detect_bpm(const SonareAudio* audio, float* out_bpm);
SonareError sonare_audio_detect_key(const SonareAudio* audio, SonareKey* out_key);
SonareError sonare_audio_detect_beats(const SonareAudio* audio,
                                      float** out_times, size_t* out_count);
SonareError sonare_audio_detect_downbeats(const SonareAudio* audio,
                                          float** out_times, size_t* out_count);
SonareError sonare_audio_detect_onsets(const SonareAudio* audio,
                                       float** out_times, size_t* out_count);
SonareError sonare_audio_analyze(const SonareAudio* audio, SonareAnalysisResult* out);

// Sample-based analysis (use when you already have a raw float buffer)
SonareError sonare_detect_bpm(const float* samples, size_t length, int sample_rate,
                              float* out_bpm);
SonareError sonare_detect_key(const float* samples, size_t length, int sample_rate,
                              SonareKey* out_key);
SonareError sonare_detect_beats(const float* samples, size_t length, int sample_rate,
                                float** out_times, size_t* out_count);
SonareError sonare_detect_downbeats(const float* samples, size_t length, int sample_rate,
                                    float** out_times, size_t* out_count);
SonareError sonare_detect_onsets(const float* samples, size_t length, int sample_rate,
                                 float** out_times, size_t* out_count);
SonareError sonare_analyze(const float* samples, size_t length, int sample_rate,
                           SonareAnalysisResult* out);

// Full-result analysis serialized to a camelCase JSON object (chords, sections,
// timbre, dynamics, rhythm, melody, form, per-beat strength). *out_json is
// heap-allocated; release it with sonare_free_string.
SonareError sonare_analyze_json(const float* samples, size_t length, int sample_rate,
                                char** out_json);
SonareError sonare_analyze_json_with_progress(const float* samples, size_t length, int sample_rate,
                                              SonareAnalyzeProgressCallback callback,
                                              void* user_data, char** out_json);

// Memory management
void sonare_free_floats(float* ptr);
void sonare_free_ints(int* ptr);
void sonare_free_bytes(uint8_t* ptr);
void sonare_free_string(char* ptr);             // heap char* from *_json and other string-returning C ABI calls
void sonare_free_key_candidates(SonareKeyCandidate* ptr);  // arrays from sonare_detect_key_candidates*
void sonare_free_result(SonareAnalysisResult* result);
// Every result struct has its own matching releaser named after the struct,
// e.g. sonare_free_stft_result / _mel_result / _mfcc_result / _chroma_result /
// _pitch_result / _hpss_result. Release a struct only with its own function.

// Resampling and the 12-TET scale quantizer (both declared in sonare_c.h itself)
SonareError sonare_resample(const float* samples, size_t length, int src_sr, int target_sr,
                            float** out, size_t* out_length);   // free *out with sonare_free_floats
SonareError sonare_scale_quantize_midi(int root, uint16_t mode_mask, float reference_midi,
                                       float midi, float* out_quantized_midi);
SonareError sonare_scale_correction_semitones(int root, uint16_t mode_mask, float reference_midi,
                                              float midi, float* out_semitones);
SonareError sonare_scale_pitch_class_enabled(int root, uint16_t mode_mask, int pitch_class,
                                             int* out_enabled);

// Utility
const char* sonare_error_message(SonareError error);
const char* sonare_last_error_message(void);    // thread-local detail for the last failure
const char* sonare_last_warning_message(void);  // thread-local non-fatal warnings (e.g. scene-insert params no processor read)
const char* sonare_version(void);
uint32_t    sonare_abi_version(void);            // packed aggregate ABI version; compare against compile-time SONARE_ABI_VERSION to detect a struct-layout/contract mismatch before exchanging POD across the boundary
int         sonare_has_ffmpeg_support(void);     // 1 if the loaded build can decode FFmpeg-only formats (M4A/AAC/FLAC/OGG), 0 otherwise
```

Every C ABI call that returns `SonareError` clears the thread-local detail on entry, preventing a stale message from leaking into a later result. Diagnostic accessors and void cleanup helpers deliberately do not clear it, so callers may release partial output before reading `sonare_last_error_message()`.

`SonareKey` carries only `root`, `mode`, and `confidence`. There is no `name` field on the struct — format the human-readable name yourself from the enum values.

`sonare_audio_file_channel_count(path, out_channels)` probes a file's source channel count without decoding it, distinct from `sonare_audio_from_file`, which always produces a mono `SonareAudio`. It is not available in WASM.

`SonareAnalysisResult` is the compact C ABI result: BPM, BPM confidence, key,
time signature, and beat times. For the all-in-one analysis (chords, sections, timbre,
dynamics, rhythm, melody, and form, with per-beat strength), call
`sonare_analyze_json` (or `sonare_analyze_json_with_progress` for per-stage
progress), which returns a camelCase JSON string you free with
`sonare_free_string`.

Several helper families also have sample-based C ABI entry points:

| Family | Examples |
|--------|----------|
| Effects | `sonare_hpss`, `sonare_hpss_ex`, `sonare_hpss_with_residual`, `sonare_time_stretch_ex`, `sonare_phase_vocoder`, `sonare_pitch_shift_ex`, `sonare_spectral_edit`, `sonare_normalize`, `sonare_normalize_rms`, `sonare_trim_ex` |
| Features | `sonare_stft`, `sonare_mel_spectrogram`, `sonare_mfcc`, `sonare_mfcc_ex`, `sonare_chroma`, `sonare_chroma_cqt`, `sonare_nnls_chroma_ex2`, `sonare_spectral_*`, `sonare_pitch_yin`, `sonare_pitch_pyin` |
| Room acoustics | `sonare_analyze_impulse_response_ex`, `sonare_synthesize_rir`, `sonare_estimate_room`, `sonare_room_morph`, `sonare_room_morph_stereo` |
| Conversions and resampling | `sonare_resample`; see `include/sonare/sonare_c.h` for the full list |

`sonare_chroma_cqt` computes a constant-Q chromagram (`librosa.feature.chroma_cqt` equivalent) alongside the note-activation `sonare_chroma`. The explicit-range MFCC entry point `sonare_mfcc_ex` (fmin/fmax/htk) also carries a trailing cepstral `lifter` argument (`0` disables liftering).

The extended C ABI effect calls expose the FFT settings used by the bindings:
`sonare_hpss_ex` accepts `n_fft`, `hop_length`, `use_soft_mask`, and a
residual-output flag; `sonare_time_stretch_ex` and `sonare_pitch_shift_ex`
accept `n_fft` and `hop_length`; and `sonare_trim_ex` accepts `frame_length`
and `hop_length`. `sonare_analyze_impulse_response_ex` adds `min_decay_db`,
while `sonare_nnls_chroma_ex2` adds the CQT `hop_length` to the NNLS options.

A project or engine sample rate must be a whole number of hertz within its supported range (`sonare_project_set_sample_rate` takes `[8000, 384000]`); a fractional rate returns `SONARE_ERROR_INVALID_PARAMETER`, and project JSON with a fractional `sample_rate` fails to load with `SONARE_ERROR_INVALID_FORMAT` and the diagnostic `invalid_sample_rate`.

Project editing lives in `sonare_c_project.h`. `sonare_project_set_clip_loop(project, clip_id, loop_mode, loop_length_ppq, loop_crossfade_ppq)` accepts the optional equal-power seam crossfade as the final argument. It must be finite and non-negative; `0` keeps a hard loop. The engine clamps it to the available pre-roll and half the loop, and ignores it under warp.

`SonareSynthPatch` — the NativeSynth patch accepted by `sonare_project_bounce_with_synth_instruments` and `sonare_engine_set_synth_instrument` — currently uses `SONARE_SYNTH_PATCH_STRUCT_VERSION` 9, so C callers rebuild. `struct_version` 0 or 1 selects the original layout, 2 enables the trailing `present_fields` bitmask, 3 through 6 append the sample-engine, highpass, converter, and pitch-offset fields, 7 reads the trailing `retrigger` field, 8 appends `engine_params` / `engine_param_count`, and 9 appends the second presence word `present_fields2` (bits `SONARE_SYNTH_FIELD2_*`) with `drift_rate_hz`, `amp_delay_ms`, `amp_hold_ms`, `filter_delay_ms`, `filter_hold_ms` and `one_shot`. Versions up to 9 are read. `retrigger` is `SONARE_SYNTH_RETRIGGER_BASE` (0), `SONARE_SYNTH_RETRIGGER_FREE` (1), or `SONARE_SYNTH_RETRIGGER_NOTE` (2). `FREE` varies oscillator phases, unison jitter, drift, and engine-noise streams per note; `NOTE` derives them from the note number, so the same note after its tail ends renders the same samples. Neither mode resets state outside the voice, such as controllers, shared instrument resonances, or effect tails. The `present_fields` mask has 31 bits in use; `present_fields2` is the second word, and a further extension appends another under a new `struct_version` rather than widening either. Enum fields have no presence bits because zero keeps the base, while every real enum value is non-zero. Setting `SONARE_SYNTH_FIELD_MOD_ROUTINGS` with `num_mod_routings == 0` clears the base mod matrix; a non-empty table replaces it.

`engine_params` is a borrowed list of `SonareSynthEngineParam {key, value}` that sets the selected engine's own model fields by key (bow force, breath pressure, lip tension, strike position, FM operator levels, the FM `algorithm`, mode ratios). Keys are the engine section's fields in lowerCamelCase (`bowForce`, `ranks2.level`); an unknown key, another engine's key, a key given twice, a non-finite value or a value outside the field's range fails the call with `SONARE_ERROR_INVALID_PARAMETER` naming the key, rather than being clamped. `sonare_synth_engine_param_info(engine_mode)` and `sonare_synth_patch_param_info()` return thread-local JSON arrays (do not free them) of `{name, type, integer, min, max, default, unit}` descriptors for an engine's section fields and for every numeric patch field plus `one_shot`; the default, subtractive and sample modes answer `[]`. A patch that sets only an engine mode voices that engine's base preset.

The librosa-parity helpers are also exposed through the C API:

| Category | Helpers |
|----------|---------|
| Emphasis and silence | `sonare_preemphasis`, `sonare_deemphasis`, `sonare_trim_silence`, `sonare_split_silence` |
| Framing and padding | `sonare_frame_signal`, `sonare_pad_center`, `sonare_fix_length`, `sonare_fix_frames` |
| Picking and normalization | `sonare_peak_pick`, `sonare_vector_normalize` |
| Feature utilities | `sonare_pcen`, `sonare_tonnetz`, `sonare_tempogram`, `sonare_plp` |
| dB conversions | `sonare_power_to_db`, `sonare_amplitude_to_db`, `sonare_db_to_power`, `sonare_db_to_amplitude` |
| Time/frame conversion | `sonare_frames_to_samples`, `sonare_samples_to_frames` |
| Decomposition / denoising | `sonare_decompose`, `sonare_decompose_with_init` (init `"random"`/`"nndsvd"`), `sonare_decompose_stems`, `sonare_decompose_stems_linked`, `sonare_nn_filter` |

The linked stem entry point fits one shared NMF model from the channel-averaged magnitude, then applies the same soft mask to each channel's complex spectrum so interchannel phase and level stay aligned. Its flat output is indexed as `(component, channel, sample)`; `out_w` and `out_h` use the same factor shapes as `sonare_decompose_stems`.

```c
SonareError sonare_decompose_stems_linked(const float* const* channels, size_t channel_count,
                                          size_t length, int sample_rate,
                                          const SonareDecomposeStemsConfig* config, float** out,
                                          size_t* out_component_count, size_t* out_channel_count,
                                          size_t* out_component_length, float** out_w,
                                          size_t* out_w_length, float** out_h,
                                          size_t* out_h_length);
```

The current C ABI is split across focused headers. Use this index when a symbol is not in the compact examples above:

| Header | Surface |
|--------|---------|
| `sonare_c.h` | Umbrella header. Transitively pulls in every other public header (the engine and voice-changer surfaces arrive through `sonare_c_effects.h`), and itself declares the aggregate `SONARE_ABI_VERSION` / `sonare_abi_version()`, `sonare_resample`, the 12-TET scale quantizer, and the per-result releasers |
| `sonare_c_types.h` | Audio handles, compact analysis, key candidates, downbeats, engine lane/bus/send structs (`SonareEngineTrackLane`, `SonareEngineBus`, `SonareEngineTrackSend`) and the `SonareChannelLayout` enum, error/version/FFmpeg helpers |
| `sonare_c_project.h` | Headless project/arrangement lifecycle, track/clip counts and editing (`sonare_project_clip_count`), MIDI events and MIDI-FX (`sonare_project_set_midi_events`, `set_midi_fx`, `bake_midi_fx`), compile/bounce (incl. `bounce_with_builtin_instruments`/`bounce_with_synth_instruments`), warp maps, loop-recording takes and comp segments, NativeSynth and SoundFont/SF2 instrument bindings, assist sidecar, chord/key annotations, `SONARE_PROJECT_ABI_VERSION` |
| `sonare_c_features.h` | Focused analysis, STFT/mel/MFCC/chroma, inverse features, CQT/VQT, pitch, tempogram/PLP, LUFS |
| `sonare_c_effects.h` | HPSS/editing DSP, region-based spectral editing (`sonare_spectral_edit`, modes GAIN/ATTENUATE/MUTE/HEAL), decomposition/remix helpers |
| `sonare_c_engine.h` | `RealtimeEngine` C ABI: transport (play/stop/seek/loop/tempo/time-signature), live parameter and automation-lane control, MIDI push/drain (CC, panic, SysEx, external MIDI destinations), capture, and telemetry (`SonareEngineTelemetry`, meter telemetry drain, `SonareEngineTelemetryError`) |
| `sonare_c_voice_changer.h` | Realtime voice changer: create/destroy, config (POD and JSON, live-safe hand-off), per-block process (mono/interleaved/planar-stereo), built-in preset lookup, latency |
| `sonare_c_acoustic.h` | RIR synthesis from room geometry, equivalent-room estimation, offline room-character morphing, `SONARE_ACOUSTIC_ABI_VERSION` |
| `sonare_c_metering.h` | Peak/RMS/crest/DC/true peak (plus the both-channel `sonare_metering_crest_factor_db_stereo`), clipping, dynamic range, stereo correlation/width, vectorscope, phase scope, spectrum, multi-channel interleaved LUFS (`sonare_lufs_interleaved`) and EBU R128 loudness range (`sonare_ebur128_loudness_range`) |
| `sonare_c_mastering.h` | Presets, full chains, progress callbacks, named processors and the machine-readable processor catalog, assistant/profile/preview JSON and their `*_stereo` entry points, streaming mastering chain with latency and realized-stage inspection (`sonare_streaming_mastering_chain_stage_names`), streaming EQ, repair/dynamics one-shot helpers |
| `sonare_c_mixing.h` | Channel strip controls, sends, buses, VCA groups, automation, meters, goniometer, scene presets |
| `sonare_c_streaming.h` | `StreamAnalyzer`, bounded unread output (`max_pending_frames`), compact frame reads, pending/drop-aware updating stats, tuning/normalization controls |

For room acoustics in the C ABI:

- `SonareRirSynthConfig` covers geometry, absorption, `ism_order`, `seed`, `max_seconds`, `mixing_time_ms`, `crossfade_ms`, and `late_model`.
- `SonareRoomEstimateConfig` covers aspect/absorption priors, `min_decay_db`, `noise_floor_margin_db`, and analyzer `mode`.
- Analyzer mode is one of `SONARE_ACOUSTIC_MODE_AUTO`, `SONARE_ACOUSTIC_MODE_BLIND`, or `SONARE_ACOUSTIC_MODE_IMPULSE_RESPONSE`.

For surround/multichannel engine buses in the C ABI:

- `SonareChannelLayout` enumerates the speaker bed: `SONARE_CHANNEL_LAYOUT_MONO` (0), `SONARE_CHANNEL_LAYOUT_STEREO` (1), `SONARE_CHANNEL_LAYOUT_5_1` (2), and `SONARE_CHANNEL_LAYOUT_7_1` (3). Values match `sonare::ChannelLayout` and are part of the ABI/JSON wire format.
- `SonareEngineBus.channel_layout` sets a bus's speaker bed (the master bus carries the project output layout; defaults to stereo). `SonareEngineTrackLane.source_channel_layout` must be `SONARE_CHANNEL_LAYOUT_STEREO`: `sonare_engine_set_track_lanes` returns `SONARE_ERROR_INVALID_PARAMETER` for a mono, 5.1 or 7.1 lane because multichannel lane input is not implemented. A zero-initialised lane reads as mono (`SONARE_CHANNEL_LAYOUT_MONO` is 0), so set `STEREO` explicitly on every lane.
- The realtime lane mixer pans each mono/stereo lane into a 5.1/7.1 destination from the strip's `surroundPan` position, sums buses plane by plane, and publishes per-plane (wide) meters. `azimuth`, `divergence`, and `lfe` affect placement; `elevation` and `distance` are reserved. See [realtime engine surround group buses](./realtime-engine.md#surround-group-buses-and-wide-meters).

For realtime insert automation and external MIDI in the C ABI:

- Track, master, and bus strips each have insert-bypass and realtime-safe parameter setters. Parameter names are the JSON keys reported by `sonare_mastering_insert_param_info`; an unsupported or non-realtime-safe name returns `SONARE_ERROR_INVALID_PARAMETER`.
- `sonare_engine_resolve_{track,master,bus}_insert_automation_id` converts an insert parameter name into the numeric id accepted by `sonare_engine_set_automation_lane`, `sonare_engine_set_parameter`, and `sonare_engine_set_parameter_smoothed`. `sonare_engine_set_param_smoothing_ms` changes the shared ramp time (20 ms by default; `0` makes changes immediate).
- `sonare_engine_push_midi_program(engine, destination_id, group, channel, program, bank_valid, bank_msb, bank_lsb, render_frame)` and `sonare_engine_push_midi_input_program(engine, group, channel, program, bank_valid, bank_msb, bank_lsb, port_time_samples)` push a live program change with an optional bank, packed as one MIDI 2.0 Program Change so the receiver's own gates apply; a receiver that selects nothing (the built-in synth, a part with RX PROGRAM CHANGE off) accepts it and ignores it. A non-zero bank with `bank_valid` zero is `SONARE_ERROR_INVALID_PARAMETER`.
- Every live MIDI push (`sonare_engine_push_midi_note_on`, `_note_off`, `_cc`, `_pitch_bend`, `_channel_pressure`, `_poly_pressure`, `_program`, `_ump` and the `sonare_engine_push_midi_input_*` forms) refuses a value outside its MIDI range with `SONARE_ERROR_INVALID_PARAMETER` and a message naming the argument and the range (`channel must be in [0, 15]`). Pushing to a disabled input source is `SONARE_ERROR_INVALID_STATE`, and a full input queue is `SONARE_ERROR_OUT_OF_MEMORY`.
- `sonare_engine_set_parameter`, `sonare_engine_set_parameter_smoothed` and `sonare_engine_set_automation_lane` refuse a parameter id in the reserved mixer namespace (`0x4D58xxxx`) that is not a master id, with `SONARE_ERROR_INVALID_PARAMETER`.
- `sonare_engine_set_track_sends(engine, track_id, sends, send_count)` and `sonare_engine_set_track_output_bus(engine, track_id, output_bus_id)` change one track lane's sends or output bus (`0` is the master mix) without restating the lane list; `sonare_engine_set_track_lanes` still replaces every lane.
- `sonare_engine_push_midi_sysex` copies one complete SysEx frame, including `0xF0` and `0xF7`; its size must be 1–512 bytes.
- `sonare_engine_set_midi_destination_external` moves a destination out of the internal instrument rack and into the host-drained output queue. Up to 16 destinations may be external. Clock/transport forwarding is opt-in through `sonare_engine_set_external_midi_clock_enabled`; those messages use destination `0xFFFFFFFF`.
- On the host/control thread, call `sonare_engine_drain_external_midi` repeatedly until it returns zero events, then deliver each 1–3-byte MIDI 1.0 message to the device. `max_events` must be at least 4 because one queued UMP (Universal MIDI Packet) record can expand to four messages. Monitor `sonare_engine_external_midi_dropped_count` to detect a host that is draining too slowly. SysEx/Data and other UMP messages that cannot be lowered to MIDI 1.0 are not emitted by this drain API.
- Each drained `SonareEngineTelemetry` record's `error` field is a `SonareEngineTelemetryError` ordinal (`sonare_c_types_engine.h`): `NONE = 0`, then queue/backlog/overflow conditions `1`–`18` (command queue, pending-command, boundary, telemetry, capture, automation-bind-target, insert-automation, MIDI-clock, and metronome overflow among them), and `MAX_CHANNELS_EXCEEDED = 20`.

### Canonical C ABI contracts

The stereo pair and note-editing entry points keep their contracts in the C ABI names and signatures below:

```c
SonareError sonare_mastering_apply_pair_processor_stereo(
    const char* processor_name, const float* source_left, const float* source_right,
    const float* reference_left, const float* reference_right, size_t length,
    int sample_rate, const SonareMasteringParam* params, size_t param_count,
    SonareMasteringStereoResult* out);
SonareError sonare_mastering_apply_pair_processor_stereo_ex(
    const char* processor_name, const float* source_left, const float* source_right,
    size_t source_length, const float* reference_left, const float* reference_right,
    size_t reference_length, int reference_sample_rate, int sample_rate,
    const SonareMasteringParam* params, size_t param_count, SonareMasteringStereoResult* out);
SonareError sonare_mastering_ab_match_loudness_stereo(
    const float* source_left, const float* source_right, size_t source_length,
    const float* reference_left, const float* reference_right, size_t reference_length,
    int reference_sample_rate, int sample_rate, SonareMasteringStereoResult* out,
    SonareLoudnessMatch* out_match);
```

Both stereo pair processor functions support only `match.abCrossfade`. The source left/right channels and the reference left/right channels must each have equal lengths. The non-`_ex` form uses one common length; `_ex` permits different source and reference lengths and returns the shorter pair length. `sonare_mastering_ab_match_loudness_stereo` applies one shared gain to both source channels, preserves the source length and stereo image, and applies no ceiling. Pass `NULL` for `out_match` when the match details are not needed.

Every two-buffer entry takes the reference's own rate: `sonare_mastering_apply_pair_processor_ex`, `sonare_mastering_apply_pair_processor_stereo_ex`, `sonare_mastering_analyze_pair_ex`, `sonare_mastering_ab_match_loudness` and `sonare_mastering_ab_match_loudness_stereo` have an `int reference_sample_rate` after `reference_length`, and `sonare_eq_match_ex(eq, source, source_length, sample_rate, reference, reference_length, reference_sample_rate, max_bands)` is the EQ-match counterpart (`sonare_eq_match` delegates to it with one length and one rate). A reference at another rate is resampled onto `sample_rate` first and equal rates take no resample pass, so the output and any delay estimate are in source-rate samples; a rate of 0 or below is `SONARE_ERROR_INVALID_PARAMETER`. `sonare_mixing_assistant_suggest` and `sonare_mixing_assistant_suggest_scene_json` take `const int* track_sample_rates` after `track_lengths` (`NULL`: every track at `sample_rate`), and each track is resampled onto the call's rate.

```c
SonareError sonare_streaming_mastering_chain_set_parameter(
    SonareStreamingMasteringChain* handle, const char* key, double value);
SonareError sonare_render_notes(
    const float* samples, size_t length, int sample_rate,
    const SonareNoteObject* notes, size_t note_count,
    const float* envelopes, size_t envelope_count, const float* f0_hz,
    const int32_t* voiced, size_t n_frames, float frame_rate,
    const SonareNoteRenderConfig* config, float** out, size_t* out_length);
SonareError sonare_decompose_note_pitch(
    const float* f0_hz, const int32_t* voiced, size_t n_frames,
    float frame_rate, float median_hz, float vibrato_cutoff_hz,
    SonarePitchDecompositionResult* out);
```

`sonare_streaming_mastering_chain_set_parameter` takes a full dotted key for an enabled, prepared stage. The key must be realtime-safe; structural, disabled-stage, and unknown keys are rejected before mutation. Serialize it with processing, flushing, reset, and prepare at a block boundary; existing DSP instances, audio history, and latency remain in place.

For `sonare_render_notes`, `f0_hz` may be `NULL` when no pitch-curve edit needs it, and `voiced` is optional. A non-`NULL` `voiced` array requires `f0_hz`; a `NULL` array infers voicing from usable positive finite F0, while a zero flag suppresses an otherwise usable F0. `sonare_decompose_note_pitch` requires a non-`NULL` F0 track with `n_frames > 0`, but its `voiced` flags are optional and use the same usable-F0 rule. A non-positive or non-finite F0 frame contributes no pitch measurement.

To classify processors in the C ABI, `sonare_mastering_processor_catalog()` returns a JSON array string `[{"id","kind","realtimeInsertable","stereoOnly","latencySamples","tailSamples","realtimeCost","channelPolicy","category","params","slots"}, ...]`. `kind` is `realtime`/`offline`/`pair`, and `realtimeInsertable` is true exactly for the ids in `sonare_mastering_insert_names()`. `latencySamples` and `tailSamples` are representative default-configuration probes (48 kHz / 512 samples); configuration-dependent values should come from `sonare_mastering_insert_timing`. `realtimeCost` is a coarse `low`/`moderate`/`high` algorithmic estimate for live inserts, not a hardware benchmark, and is `null` for non-insert ids. `channelPolicy` tells a surround host how the mixer wraps the processor, `category` is the stable UI grouping derived from the id namespace, and `params` contains descriptors for realtime and construction keys (empty for non-insert processors). Each descriptor includes `name`, `id`, `rtSafe`, `type`, `min`, `max`, `default`, `unit`, `choices`, and `slot`. `slots` lists conditional key groups as `{name,parent,activation,minCrossoverCutoffs}`. The id universe is the union of `sonare_mastering_processor_names()`, the insert set, and `sonare_mastering_pair_processor_names()`, so hosts can filter a processor picker without hardcoding ids. The pointer is thread-local (do not free it or cache it across threads), mirroring `sonare_mastering_processor_names()`.

The focused C ABI queries are:

```c
const char* sonare_mastering_insert_param_info(const char* name);
SonareError sonare_mastering_insert_timing(const char* name, const char* params,
                                           int sample_rate, int* out_latency_samples,
                                           int* out_tail_samples);
SonareError sonare_mastering_preset_params_json(const char* preset, char** json_out);
```

`sonare_mastering_insert_param_info` returns a thread-local JSON descriptor array; do not free it. Besides `name`, `id`, `rtSafe`, `type`, `min`, `max`, `default`, `choices` and `slot`, a descriptor declares what a control needs beyond the accepted range: `unit` (read from the processor that consumes the key, from a closed set: `dB`, `dBFS`, `LUFS`, `Hz`, `ms`, `s`, `samples`, `m`, `cm`, `deg`, `percent`, `degC`, `V`, `inPerSec`, `dBPerOct`, `semitones`, `cents`, `ratio`, `bits`, `count`, `none`), `scale` (`linear` or `log`), an optional display range `uiMin` / `uiMax` inside `[min, max]`, and `dependsOn`, the sibling keys whose live value bounds this one, each as `this <relation> factor * sibling`. `sonare_mastering_insert_param_info_at_rate(name, sample_rate)` returns the same array with every key whose `maxRelativeTo` is `"nyquist"` resolved to the bound accepted at that host rate (the lower of the host's Nyquist and any cap fixed when the insert is built); it returns `NULL` with `SONARE_ERROR_INVALID_PARAMETER` for a rate out of range, and the rate-less query is unchanged. `sonare_mastering_insert_timing` rejects unknown keys and reports the configured latency and tail. `sonare_mastering_preset_params_json` returns `{"version":1,"params":{...}}`; release its heap-owned string with `sonare_free_string`. The catalog's `repair.*` entries publish their parameters through the same descriptor, carry no automation `id`, and are never `rtSafe`; every entry also carries `causal` (false for `repair.declick`, `repair.declip` and `repair.trimSilence`, true for the other repair stages and every insert). `repair.decrackle`, `repair.dehum`, `repair.denoiseClassical` and `repair.dereverbClassical` are realtime inserts under their ids; declick and declip stay offline. Enum-valued parameters accept their `choices` name beside the number; `sonare_mastering_enum_value(processor, key, name, &is_enum, &value)` resolves a name. `sonare_capability_catalog_json()` combines the processor catalog, built-in mastering, synth, mixing-scene, and voice-changer preset lists, and detailed `masteringPresets` entries.

Realtime voice presets are exposed in C as `sonare_realtime_voice_changer_preset_names()`, `sonare_realtime_voice_changer_preset_json()`, and `sonare_realtime_voice_changer_validate_preset_json()`. The typed preset selector is the `SonareVoiceCharacterPreset` enum (`SONARE_VC_PRESET_NEUTRAL_MONITOR` = 0 through `SONARE_VC_PRESET_DARK_VILLAIN` = 5); `sonare_voice_character_preset_id(preset)` returns its canonical id string (NULL for unknown values), and the `SONARE_REALTIME_VOICE_CHANGER_PRESET_IDS` macro provides the newline-separated id list for compile-time binding generation. The native POD config ABI is `SONARE_VOICE_CHANGER_ABI_VERSION`; it is separate from the preset JSON `schemaVersion`.

### Additional C ABI entry points

Pitch, voice and repair (`sonare_c_effects.h`, `sonare_c_mastering.h`):

| Function | Purpose |
|----------|---------|
| `sonare_auto_tune(samples, length, sample_rate, key, config, &out, &out_length, &out_key)` | Offline auto-tune of a monophonic recording to the scale of a key. `key` is a `SonareKey` or `NULL` to detect it (a named key is taken as certain, so `out_key` reports confidence 1); `config` may be `NULL`, and only `scale_reference_midi`, `retune_amount`, `max_correction_semitones`, `retune_speed_ms` and `vibrato_threshold_cents` are read. The output has the input's length; release it with `sonare_free_floats` |
| `sonare_voice_change_ex(samples, length, sample_rate, &config, &out, &out_length)` | `sonare_voice_change` with a `SonareVoiceChangeConfig` (`struct_version` 0 or 1, `pitch_semitones`, `formant_factor`, `formant_mode`). `SONARE_FORMANT_MODE_RELATIVE` (0) is the warp applied after the pitch shift, so the formants follow the pitch; `SONARE_FORMANT_MODE_ABSOLUTE` (1) is the formant shift relative to the input, so `1` keeps the formants in place. An absolute request whose warp `formant_factor / 2^(semitones / 12)` leaves [0.55, 1.65] is refused with `SONARE_ERROR_INVALID_PARAMETER`, and the last error message names the reachable factor range |
| `sonare_mastering_repair_analyze(channels, channel_count, length, sample_rate, request_json, &json)` | Per-channel repair defects plus the stages the assistant recommends, as JSON (`defects`, `channels`, `declipThresholdSafe`, `integratedLufs`, `recommended`, `explanation`). `request_json` is `NULL` or `{"preferStreamingSafe": true}`; dereverb is never recommended. Release the string with `sonare_free_string` |
| `sonare_mastering_repair_apply(channels, channel_count, length, sample_rate, stages_json, progress, user_data, out_channels, &reports_json, cancel, cancel_user_data)` | Applies `[{"stage": ..., ...settings}]` to every channel in the fixed order declip, declick, decrackle, dehum, denoise, dereverb whatever order the array gives; a repeated stage, an unknown stage and an unknown setting are `SONARE_ERROR_INVALID_PARAMETER`. `out_channels` are caller-owned planes (they may alias the input) written only on success; the reports are `[{stage, scope, reports}]`, `scope` being `"channel"` (one report per channel) or `"linked"` (one for the set). Either callback may be `NULL`; a nonzero `cancel` result returns `SONARE_ERROR_CANCELLED` |
| `sonare_streaming_loudness_gain(samples, length, sample_rate, params, param_count, &out)` and `_stereo(left, right, ...)` | Measures a `SonareStreamingLoudnessGain` (`loudness_static_gain_db`, `true_peak_db`, `integrated_lufs`) at the loudness stage's input, for `sonare_streaming_mastering_chain_create_ex`. The gain equals what the offline chain applies, ceiling clamp included; `params` takes the keys `sonare_mastering_chain` does |

Realtime engine (`sonare_c_engine.h`; `render_frame` here stays an `int64_t` where a negative value means "next block head"):

| Function | Purpose |
|----------|---------|
| `sonare_engine_upsert_clip(engine, &clip)`, `sonare_engine_remove_clip(engine, clip_id)` | Replace or add one clip, or remove one, leaving the rest of the published set as it was. A refused clip leaves the set unchanged; removing an unknown id is `SONARE_ERROR_INVALID_PARAMETER`. Control thread only |
| `sonare_engine_reset_processor_state(engine, render_frame)` | Queues a reset of every mixer and effect processor to its prepared state, so playback queued after it starts from the state an offline bounce starts from. Instruments keep their state; while playing, it cuts running tails like a seek |
| `sonare_engine_prime_offline_parameters(engine, num_channels, block_size)` | The offline pre-roll that bounce and freeze run, without rendering. A host driving `sonare_engine_render_offline` calls it once before the first chunk. A channel count or block size above the prepared maximum is `SONARE_ERROR_INVALID_PARAMETER`; an unprepared engine is `SONARE_ERROR_INVALID_STATE` |
| `sonare_engine_tail_samples(engine, &samples)` | Upper bound of the longest audible tail after the last input, in samples (`2147483647` means unbounded) |
| `sonare_engine_graph_latency_samples_q8(engine, &latency_q8)` | Processing latency in 1/256 samples, the value telemetry records carry |
| `sonare_engine_can_set_lane_sidechain`, `sonare_engine_can_set_bus_sidechain`, `sonare_engine_can_set_master_sidechain` | Report, without changing anything, whether the matching `set_*_sidechain` would accept a binding. `out_refusal` receives a `SonareSidechainRefusal`: `NONE` (0), `INVALID_TARGET`, `INSERT_OUT_OF_RANGE`, `UNDECLARED_SOURCE`, `INVALID_SOURCE_KIND`, `SELF_KEY`, `CYCLE`, `TABLE_FULL`, `PLAN_REFUSED` (1 through 8) |
| `sonare_engine_resolve_track_lane_automation_id(engine, track_id, "faderDb" or "pan", &id)`, `sonare_engine_resolve_bus_automation_id(engine, bus_id, "faderDb", &id)` | Reserved automation ids that name the track or bus rather than its position, so they keep driving it across `sonare_engine_set_track_lanes` and `sonare_engine_set_track_buses` reorders and fail as an unknown target once it is removed |

An offline render, bounce, freeze or pre-roll with a block size larger than the one the engine was prepared with is refused with `SONARE_ERROR_INVALID_PARAMETER`. `sonare_engine_set_track_strip_json`, `sonare_engine_set_bus_strip_json` and `sonare_engine_set_master_strip_json` refuse a key the scene reader does not consume, naming it (`unknown strip key 'strips[0].faderDB'`); keys starting with `$` or `x-` and the snake_case aliases are still accepted.

Mixer and project (`sonare_c_mixing.h`, `sonare_c_project_core.h`, `sonare_c_project_edit.h`):

| Function | Purpose |
|----------|---------|
| `sonare_mixer_set_output_bus(mixer, source_id, bus_id)` | Routes an offline mixer strip or bus into a submix after construction. It replaces the source's main connection and refuses, before changing anything, an unknown id, a non-bus destination, the master as source, a self-route, or a cycle through connections or sends; an added submix reaches the master only once it is routed there too |
| `sonare_mixer_flush_meters(mixer)` | Marks the end of the signal for every strip and bus meter, folding the true-peak reading's pending group delay into the published snapshot. Call it after the last block of an offline or one-shot run; a later process call starts a new signal |
| `sonare_project_unresolved_audio_source_by_index(project, index, &source)` | Reads an unresolved audio source descriptor by zero-based index, in the order of `sonare_project_unresolved_audio_source_id_by_index`. `name_or_uri` is truncated to 127 bytes |
| `sonare_chord_symbol_from_analysis(root, quality, bass, &root_pc, &quality, extensions, capacity, &extension_count, &slash_bass_pc)`, `sonare_key_mode_from_analysis(mode, &out_mode)` | Convert a detected chord or key into the fields of an arrangement annotation (`SonareProjectChordSymbol`, `SonareProjectKeySegment`) through the library's own reduction table, instead of mapping the two differently numbered vocabularies by hand. `extensions` are scale degrees, up to 32 |
| `sonare_align_take_to_reference_ex(reference, reference_len, reference_sample_rate, take, take_len, take_sample_rate, config, &anchors, &count, &alignment)` | `sonare_align_take_to_reference` for a take recorded at another rate: the take is resampled onto the reference's grid and both anchor axes come back in reference-rate samples, to be scaled by the project rate over the reference rate before setting a warp map |
| `sonare_project_get_audio_source_uri(project, source_id, &uri)` | The full, untruncated URI of an audio source id, as a heap copy released with `sonare_free_string` |

`sonare_project_add_loop_recording_takes` takes a `SonareProjectLoopRecordingDesc` whose `flags` word is `0` (keep a partial last take) or `SONARE_PROJECT_LOOP_RECORDING_DROP_PARTIAL_TAIL` (do not create it); any other bit is `SONARE_ERROR_INVALID_PARAMETER`. A partial last take is kept but not made active when an earlier complete take exists, and is marked `"partial": true` in the project JSON; a remainder of one frame or less creates no take.

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
- **RT60** is the reverberation time: how long a tail takes to decay by 60 dB.
- **DRR (direct-to-reverberant ratio)** compares the level of the direct sound against the reverberant tail, in dB. Higher means a drier, closer-sounding source.
- **Room morphing** is a creative room-character effect, not dereverberation.
:::

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

`sonare_room_geometry_from_estimate(&estimate, &config)` turns a `sonare_estimate_room` result into the geometry of a `SonareRirSynthConfig`: it sets the three dimensions and borrows the per-band absorption from the estimate, which therefore has to outlive the config. Source and listener stay zero because an estimate carries no placement, so set both before calling `sonare_synthesize_rir`. Non-finite absorption bands are left unset, and an estimate with no measurable decay (non-finite dimensions) is refused with `SONARE_ERROR_INVALID_PARAMETER`.

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

`AirAbsorption` defaults to 20 °C and 50% relative humidity. This lower-level C++ calculation is not part of the C ABI, Node, Python, or WASM shoebox helpers; those public helpers continue to use the geometry-only model.

