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
| Room acoustics | `sonare_analyze_impulse_response_ex`, `sonare_synthesize_rir`, `sonare_estimate_room`, `sonare_room_morph` |
| Conversions and resampling | `sonare_resample`; see `include/sonare/sonare_c.h` for the full list |

`sonare_chroma_cqt` computes a constant-Q chromagram (`librosa.feature.chroma_cqt` equivalent) alongside the note-activation `sonare_chroma`. The explicit-range MFCC entry point `sonare_mfcc_ex` (fmin/fmax/htk) also carries a trailing cepstral `lifter` argument (`0` disables liftering).

The extended C ABI effect calls expose the FFT settings used by the bindings:
`sonare_hpss_ex` accepts `n_fft`, `hop_length`, `use_soft_mask`, and a
residual-output flag; `sonare_time_stretch_ex` and `sonare_pitch_shift_ex`
accept `n_fft` and `hop_length`; and `sonare_trim_ex` accepts `frame_length`
and `hop_length`. `sonare_analyze_impulse_response_ex` adds `min_decay_db`,
while `sonare_nnls_chroma_ex2` adds the CQT `hop_length` to the NNLS options.

Project editing lives in `sonare_c_project.h`. `sonare_project_set_clip_loop(project, clip_id, loop_mode, loop_length_ppq, loop_crossfade_ppq)` accepts the optional equal-power seam crossfade as the final argument. It must be finite and non-negative; `0` keeps a hard loop. The engine clamps it to the available pre-roll and half the loop, and ignores it under warp.

`SonareSynthPatch` — the NativeSynth patch accepted by `sonare_project_bounce_with_synth_instruments` and `sonare_engine_set_synth_instrument` — is versioned through its leading `struct_version` field. Under the original layout every numeric field follows a "0 means keep the base preset's value" rule, so an explicit zero could not be expressed at all. `struct_version = 2` adds a trailing `present_fields` bitmask (`SONARE_SYNTH_FIELD_*`) naming the fields the caller set on purpose: a set bit overrides the base with that field's value even when the value is zero, and a clear bit keeps the earlier behaviour. The trailing word is read only when `struct_version` is 2 or higher, so a caller that fills the struct exactly the way it always did — including leaving `struct_version` at `0` or `1` — keeps its previous behaviour and needs no source change. Enum fields have no presence bits on purpose: zero is already their reserved keep-the-base value and every real value is non-zero. Setting `SONARE_SYNTH_FIELD_MOD_ROUTINGS` with `num_mod_routings == 0` clears the base mod matrix instead of keeping it; a non-empty table replaces it either way. The mask is one 32-bit word with 27 bits in use — a further extension appends a second word under a new `struct_version` rather than widening this one.

The librosa-parity helpers are also exposed through the C API:

| Category | Helpers |
|----------|---------|
| Emphasis and silence | `sonare_preemphasis`, `sonare_deemphasis`, `sonare_trim_silence`, `sonare_split_silence` |
| Framing and padding | `sonare_frame_signal`, `sonare_pad_center`, `sonare_fix_length`, `sonare_fix_frames` |
| Picking and normalization | `sonare_peak_pick`, `sonare_vector_normalize` |
| Feature utilities | `sonare_pcen`, `sonare_tonnetz`, `sonare_tempogram`, `sonare_plp` |
| dB conversions | `sonare_power_to_db`, `sonare_amplitude_to_db`, `sonare_db_to_power`, `sonare_db_to_amplitude` |
| Time/frame conversion | `sonare_frames_to_samples`, `sonare_samples_to_frames` |
| Decomposition / denoising | `sonare_decompose`, `sonare_decompose_with_init` (init `"random"`/`"nndsvd"`), `sonare_nn_filter` |

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
- `SonareEngineBus.channel_layout` sets a bus's speaker bed (the master bus carries the project output layout; defaults to stereo). `SonareEngineTrackLane.source_channel_layout` is serialized as source metadata but does not yet make a multichannel lane input discrete.
- The realtime lane mixer pans each mono/stereo lane into a 5.1/7.1 destination from the strip's `surroundPan` position, sums buses plane by plane, and publishes per-plane (wide) meters. `azimuth`, `divergence`, and `lfe` affect placement; `elevation` and `distance` are reserved. See [realtime engine surround group buses](./realtime-engine.md#surround-group-buses-and-wide-meters).

For realtime insert automation and external MIDI in the C ABI:

- Track, master, and bus strips each have insert-bypass and realtime-safe parameter setters. Parameter names are the JSON keys reported by `sonare_mastering_insert_param_info`; an unsupported or non-realtime-safe name returns `SONARE_ERROR_INVALID_PARAMETER`.
- `sonare_engine_resolve_{track,master,bus}_insert_automation_id` converts an insert parameter name into the numeric id accepted by `sonare_engine_set_automation_lane`, `sonare_engine_set_parameter`, and `sonare_engine_set_parameter_smoothed`. `sonare_engine_set_param_smoothing_ms` changes the shared ramp time (20 ms by default; `0` makes changes immediate).
- `sonare_engine_push_midi_sysex` copies one complete SysEx frame, including `0xF0` and `0xF7`; its size must be 1–512 bytes.
- `sonare_engine_set_midi_destination_external` moves a destination out of the internal instrument rack and into the host-drained output queue. Up to 16 destinations may be external. Clock/transport forwarding is opt-in through `sonare_engine_set_external_midi_clock_enabled`; those messages use destination `0xFFFFFFFF`.
- On the host/control thread, call `sonare_engine_drain_external_midi` repeatedly until it returns zero events, then deliver each 1–3-byte MIDI 1.0 message to the device. `max_events` must be at least 3 because one queued UMP (Universal MIDI Packet) record can expand to three messages. Monitor `sonare_engine_external_midi_dropped_count` to detect a host that is draining too slowly. SysEx/Data and other UMP messages that cannot be lowered to MIDI 1.0 are not emitted by this drain API.
- Each drained `SonareEngineTelemetry` record's `error` field is a `SonareEngineTelemetryError` ordinal (`sonare_c_types_engine.h`): `NONE = 0`, then queue/backlog/overflow conditions `1`–`18` (command queue, pending-command, boundary, telemetry, capture, automation-bind-target, insert-automation, MIDI-clock, and metronome overflow among them), and `MAX_CHANNELS_EXCEEDED = 20`.

To classify processors in the C ABI, `sonare_mastering_processor_catalog()` returns a JSON array string `[{"id","kind","realtimeInsertable","stereoOnly","latencySamples","tailSamples","realtimeCost","channelPolicy","category","params"}, ...]`. `kind` is `realtime`/`offline`/`pair`, and `realtimeInsertable` is true exactly for the ids in `sonare_mastering_insert_names()`. `latencySamples` and `tailSamples` are representative default-configuration probes (48 kHz / 512 samples); `tailSamples` is the audible decay length, and both are 0 for offline ids. `realtimeCost` is a coarse `low`/`moderate`/`high` algorithmic estimate for live inserts, not a hardware benchmark, and is `null` for non-insert ids. `channelPolicy` tells a surround host how the mixer wraps the processor, `category` is the stable UI grouping derived from the id namespace, and `params` contains the realtime-insert parameter descriptors (empty for non-insert processors). The id universe is the union of `sonare_mastering_processor_names()`, the insert set, and `sonare_mastering_pair_processor_names()`, so hosts can filter a processor picker without hardcoding ids. The pointer is thread-local (do not free it or cache it across threads), mirroring `sonare_mastering_processor_names()`.

Realtime voice presets are exposed in C as `sonare_realtime_voice_changer_preset_names()`, `sonare_realtime_voice_changer_preset_json()`, and `sonare_realtime_voice_changer_validate_preset_json()`. The typed preset selector is the `SonareVoiceCharacterPreset` enum (`SONARE_VC_PRESET_NEUTRAL_MONITOR` = 0 through `SONARE_VC_PRESET_DARK_VILLAIN` = 5); `sonare_voice_character_preset_id(preset)` returns its canonical id string (NULL for unknown values), and the `SONARE_REALTIME_VOICE_CHANGER_PRESET_IDS` macro provides the newline-separated id list for compile-time binding generation. The native POD config ABI is `SONARE_VOICE_CHANGER_ABI_VERSION`; it is separate from the preset JSON `schemaVersion`.

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

