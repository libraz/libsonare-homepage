---
title: C ABI Reference
description: The libsonare C ABI for FFI integration, covering handles, analysis, effects, header index, engine, mastering, and mixing entry points.
---

# C ABI Reference

The C ABI is the stable boundary every language binding and plugin host builds on; see [C++ API Reference](./cpp-api.md) for the C++ surface and [C ABI versions](./cpp-api.md#c-abi-versions) for struct versioning. The room-acoustics calls are covered under [Geometric Room Acoustics](./cpp-api-effects.md#geometric-room-acoustics).

## Handles, analysis and utilities

For FFI integration. Two parallel entry-point styles are provided: handle-based (takes a `SonareAudio*`) and sample-based (takes a raw `float*` buffer).

```c
#include <sonare/sonare_c.h>

// Audio handle
SonareError sonare_audio_from_buffer(const float* data, size_t length, int sample_rate,
                                     SonareAudio** out);
SonareError sonare_audio_from_memory(const uint8_t* data, size_t length, SonareAudio** out);
SonareError sonare_audio_from_file(const char* path, SonareAudio** out);  // Not available in WASM
SonareError sonare_audio_file_channel_count(const char* path, int* out_channels);  // Not available in WASM
SonareError sonare_audio_from_file_channel(const char* path, int channel_index,
                                           SonareAudio** out);  // one source channel, no downmix; not available in WASM
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
SonareError sonare_last_error_code(void);       // code recorded beside the last message; why a handle-returning call returned NULL
const char* sonare_last_warning_message(void);  // thread-local non-fatal warnings (e.g. scene-insert params no processor read)
const char* sonare_version(void);
uint32_t    sonare_abi_version(void);            // packed aggregate ABI version; compare against compile-time SONARE_ABI_VERSION to detect a struct-layout/contract mismatch before exchanging POD across the boundary
uint32_t    sonare_engine_abi_version(void);     // realtime command-queue ABI, not part of sonare_abi_version()
int         sonare_has_ffmpeg_support(void);     // 1 if the loaded build can decode FFmpeg-only formats (M4A/AAC/FLAC/OGG), 0 otherwise
```

Every C ABI call that returns `SonareError` clears the thread-local detail on entry, preventing a stale message from leaking into a later result. Diagnostic accessors and void cleanup helpers deliberately do not clear it, so callers may release partial output before reading `sonare_last_error_message()`.

`SonareKey` carries only `root`, `mode`, and `confidence`. There is no `name` field on the struct — format the human-readable name yourself from the enum values.

`sonare_audio_file_channel_count(path, out_channels)` probes a file's source channel count without decoding it, distinct from `sonare_audio_from_file`, which always produces a mono `SonareAudio`. Load one channel with `sonare_audio_from_file_channel(path, channel_index, &out)`. Neither is available in WASM.

`SonareAnalysisResult` is the compact C ABI result: BPM, BPM confidence, key,
time signature, and beat times. For the all-in-one analysis (chords, sections, timbre,
dynamics, rhythm, melody, and form, with per-beat strength), call
`sonare_analyze_json` (or `sonare_analyze_json_with_progress` for per-stage
progress), which returns a camelCase JSON string you free with
`sonare_free_string`.

## Helper families

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

## Project and synth patch notes

A project or engine sample rate must be a whole number of hertz within its supported range (`sonare_project_set_sample_rate` takes `[8000, 384000]`); a fractional rate returns `SONARE_ERROR_INVALID_PARAMETER`, and project JSON with a fractional `sample_rate` fails to load with `SONARE_ERROR_INVALID_FORMAT` and the diagnostic `invalid_sample_rate`.

Project editing lives in `sonare_c_project.h`. `sonare_project_set_clip_loop(project, clip_id, loop_mode, loop_length_ppq, loop_crossfade_ppq)` accepts the optional equal-power seam crossfade as the final argument. It must be finite and non-negative; `0` keeps a hard loop. The engine clamps it to the available pre-roll and half the loop, and ignores it under warp.

### Synth patch versions

`SonareSynthPatch` is the NativeSynth patch accepted by `sonare_project_bounce_with_synth_instruments` and `sonare_engine_set_synth_instrument`. It currently uses `SONARE_SYNTH_PATCH_STRUCT_VERSION` 9, so C callers rebuild; every earlier version is still read. Each version appends to the layout (declared in `sonare_c_types_analysis.h`):

| `struct_version` | Adds |
|------------------|------|
| 0, 1 | The original layout |
| 2 | The trailing `present_fields` bitmask |
| 3 | The sample-engine block |
| 4 | Series highpass |
| 5 | Converter block |
| 6 | `pitch_offset_cents` |
| 7 | `retrigger` |
| 8 | `engine_params` / `engine_param_count` |
| 9 | The second presence word `present_fields2` (bits `SONARE_SYNTH_FIELD2_*`) with `drift_rate_hz`, `amp_delay_ms`, `amp_hold_ms`, `filter_delay_ms`, `filter_hold_ms` and `one_shot` |

`retrigger` is `SONARE_SYNTH_RETRIGGER_BASE` (0), `SONARE_SYNTH_RETRIGGER_FREE` (1), or `SONARE_SYNTH_RETRIGGER_NOTE` (2). `FREE` varies oscillator phases, unison jitter, drift, and engine-noise streams per note; `NOTE` derives them from the note number, so the same note after its tail ends renders the same samples. Neither mode resets state outside the voice, such as controllers, shared instrument resonances, or effect tails.

The `present_fields` mask has 31 bits in use and `present_fields2` is the second word; a further extension appends another under a new `struct_version` rather than widening either. Enum fields have no presence bits because zero keeps the base, while every real enum value is non-zero. Setting `SONARE_SYNTH_FIELD_MOD_ROUTINGS` with `num_mod_routings == 0` clears the base mod matrix; a non-empty table replaces it.

`engine_params` is a borrowed list of `SonareSynthEngineParam {key, value}` that sets the selected engine's own model fields by key (bow force, breath pressure, lip tension, strike position, FM operator levels, the FM `algorithm`, mode ratios). Keys are the engine section's fields in lowerCamelCase (`bowForce`, `ranks2.level`); an unknown key, another engine's key, a key given twice, a non-finite value or a value outside the field's range fails the call with `SONARE_ERROR_INVALID_PARAMETER` naming the key, rather than being clamped. `sonare_synth_engine_param_info(engine_mode)` returns a thread-local JSON array of descriptors for an engine's section fields (valid until the next call on that thread), and `sonare_synth_patch_param_info()` a static one for every numeric patch field plus `one_shot`; free neither, and the default, subtractive and sample modes answer `[]`. Each descriptor is `{name, type, integer, min, max, default, unit}` plus, for a field that only reaches the voice under conditions on other fields, `activeWhen`: an array of alternatives, each a list of `{key, scope, relation, value}` that must all hold. The field reaches the voice when every condition of at least one alternative holds, which is what a UI needs to gray out an inactive control. A patch that sets only an engine mode voices that engine's base preset.

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

## Header index

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
| `sonare_c_transcribe.h` | Audio to MIDI notes on a musical grid: `SonareTranscribeConfig`, `sonare_transcribe`, `sonare_transcribe_config_default` |
| `sonare_c_polyphony.h` | Editing one note of a chord: `SonarePolyphonicConfig`, `sonare_polyphonic_analyze`, and a render back to audio |
| `sonare_c_vocal_edit.h`, `sonare_c_vocal_project.h` | Offline, non-destructive editing of monophonic vocal notes, and binding the rendered result back to a project clip |
| `sonare_c_playback.h` | Playback renderer: decoded movie audio to headphones (binaural) or stereo / 5.1 / 7.1 speakers |
| `sonare_c_sample_bank.h` | Host-supplied PCM and keymaps for the sample synthesis engine |
| `sonare_c_assist.h` | Composition assist: the built-in rule-based generative modules, previewed or applied over a project |
| `sonare_c_types_*.h`, `sonare_c_project_*.h` | Split-outs pulled in by `sonare_c_types.h` and `sonare_c_project.h` (analysis, engine and enum types; annotate, core, edit, external-stems, instruments, MIDI, part-rig and timeline project calls). Include the umbrella header rather than these |

## Room acoustics, surround and realtime engine notes

For room acoustics in the C ABI:

- `SonareRirSynthConfig` covers geometry, absorption, `material_preset`, `absorption_bands` / `scattering_bands`, `ism_order`, `seed`, `max_seconds`, `mixing_time_ms`, `crossfade_ms`, `late_model`, and the air-absorption group (see [Air absorption in large rooms](./cpp-api-effects.md#air-absorption-in-large-rooms)).
- Wall material is resolved in order: a non-zero `material_preset` (`SONARE_MATERIAL_PRESET_*`) wins, then a non-NULL `absorption_bands`, then scalar `absorption`.
- `SonareRoomEstimateConfig` covers aspect/absorption priors, `reference_absorption`, `min_decay_db`, `noise_floor_margin_db`, `prefer_eyring`, `n_octave_bands`, and analyzer `mode`. `reference_absorption` of 0 selects the library default (0.15); any other value is clamped into [0.01, 0.99] rather than refused, and the estimated volume scales with its cube.
- Analyzer mode is one of `SONARE_ACOUSTIC_MODE_AUTO`, `SONARE_ACOUSTIC_MODE_BLIND`, or `SONARE_ACOUSTIC_MODE_IMPULSE_RESPONSE`.

For surround/multichannel engine buses in the C ABI:

- `SonareChannelLayout` enumerates the speaker bed: `SONARE_CHANNEL_LAYOUT_MONO` (0), `SONARE_CHANNEL_LAYOUT_STEREO` (1), `SONARE_CHANNEL_LAYOUT_5_1` (2), and `SONARE_CHANNEL_LAYOUT_7_1` (3). Values match `sonare::ChannelLayout` and are part of the ABI/JSON wire format.
- `SonareEngineBus.channel_layout` sets a bus's speaker bed (the master bus carries the project output layout; defaults to stereo). `SonareEngineTrackLane.source_channel_layout` must be `SONARE_CHANNEL_LAYOUT_STEREO`: `sonare_engine_set_track_lanes` returns `SONARE_ERROR_INVALID_PARAMETER` for a mono, 5.1 or 7.1 lane because multichannel lane input is not implemented. A zero-initialized lane reads as mono (`SONARE_CHANNEL_LAYOUT_MONO` is 0), so set `STEREO` explicitly on every lane.
- The realtime lane mixer pans each mono/stereo lane into a 5.1/7.1 destination from the strip's `surroundPan` position, sums buses plane by plane, and publishes per-plane (wide) meters. `azimuth`, `divergence`, and `lfe` affect placement; `elevation` and `distance` are reserved. See [realtime engine surround group buses](./realtime-engine.md#surround-group-buses-and-wide-meters).

For realtime insert automation and external MIDI in the C ABI:

- Track, master, and bus strips each have insert-bypass and realtime-safe parameter setters. Parameter names are the JSON keys reported by `sonare_mastering_insert_param_info`; an unsupported or non-realtime-safe name returns `SONARE_ERROR_INVALID_PARAMETER`.
- `sonare_engine_resolve_{track,master,bus}_insert_automation_id` converts an insert parameter name into the numeric id accepted by `sonare_engine_set_automation_lane`, `sonare_engine_set_parameter`, and `sonare_engine_set_parameter_smoothed`. `sonare_engine_set_param_smoothing_ms` changes the shared ramp time (20 ms by default; `0` makes changes immediate).
- `sonare_engine_push_midi_program(engine, destination_id, group, channel, program, bank_valid, bank_msb, bank_lsb, render_frame)` and `sonare_engine_push_midi_input_program(engine, group, channel, program, bank_valid, bank_msb, bank_lsb, offset_in_block_samples)` push a live program change with an optional bank, packed as one MIDI 2.0 Program Change so the receiver's own gates apply. A non-zero bank with `bank_valid` zero is `SONARE_ERROR_INVALID_PARAMETER`. What the receiver does with it:

  | Receiver | Follows the program change? |
  |----------|-----------------------------|
  | SoundFont player | Yes, selects bank and program under its own gates |
  | NativeSynth bound with `use_gm_programs` | Yes, resolves each channel's voice from them |
  | NativeSynth whose patch plays the GM kit (the `drum-kit` preset, or a percussion patch with `gm_kit` on) | Yes, as the GS drum-set select on every channel |
  | Every other receiver (the built-in synth, any other NativeSynth patch, a part with RX PROGRAM CHANGE off, an MPE member channel) | Accepted and ignored |

- Every live MIDI push (`sonare_engine_push_midi_note_on`, `_note_off`, `_cc`, `_pitch_bend`, `_channel_pressure`, `_poly_pressure`, `_program`, `_ump` and the `sonare_engine_push_midi_input_*` forms) refuses a value outside its MIDI range with `SONARE_ERROR_INVALID_PARAMETER` and a message naming the argument and the range (`channel must be in [0, 15]`). Pushing to a disabled input source is `SONARE_ERROR_INVALID_STATE`, and a full input queue is `SONARE_ERROR_OUT_OF_MEMORY`.
- `sonare_engine_set_parameter`, `sonare_engine_set_parameter_smoothed` and `sonare_engine_set_automation_lane` refuse a parameter id in the reserved mixer namespace (`0x4D58xxxx`) that is not a master id, with `SONARE_ERROR_INVALID_PARAMETER`.
- `sonare_engine_set_track_sends(engine, track_id, sends, send_count)` and `sonare_engine_set_track_output_bus(engine, track_id, output_bus_id)` change one track lane's sends or output bus (`0` is the master mix) without restating the lane list; `sonare_engine_set_track_lanes` still replaces every lane.
- `sonare_engine_push_midi_sysex` copies one complete SysEx frame, including `0xF0` and `0xF7`; its size must be 1–512 bytes.
- `sonare_engine_set_midi_destination_external` moves a destination out of the internal instrument rack and into the host-drained output queue. Up to 16 destinations may be external. Clock/transport forwarding is opt-in through `sonare_engine_set_external_midi_clock_enabled`; those messages use destination `0xFFFFFFFF`.
- On the host/control thread, call `sonare_engine_drain_external_midi` repeatedly until it returns zero events, then deliver each 1–3-byte MIDI 1.0 message to the device. `max_events` must be at least 4 because one queued UMP (Universal MIDI Packet) record can expand to four messages. Monitor `sonare_engine_external_midi_dropped_count` to detect a host that is draining too slowly. SysEx/Data and other UMP messages that cannot be lowered to MIDI 1.0 are not emitted by this drain API.
- Each drained `SonareEngineTelemetry` record's `error` field is a `SonareEngineTelemetryError` ordinal (`sonare_c_types_engine.h`): `NONE = 0`; `1`–`18` cover queue and capacity overflows (command queue, pending-command, boundary, telemetry, capture, automation-bind-target, insert-automation, MIDI-clock, metronome), a non-realtime-safe or unprepared command, stale automation lanes and clip-page underrun; `20` is `MAX_CHANNELS_EXCEEDED` and `21` is `PARAMETER_BASE_OVERFLOW`.

## Canonical C ABI contracts

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

To classify processors in the C ABI, `sonare_mastering_processor_catalog()` returns a JSON array string `[{"id","kind","realtimeInsertable","stereoOnly","latencySamples","tailSamples","realtimeCost","channelPolicy","category","params","slots"}, ...]`. `kind` is `realtime`/`offline`/`pair`, and `realtimeInsertable` is true exactly for the ids in `sonare_mastering_insert_names()`. `latencySamples` and `tailSamples` are representative default-configuration probes (48 kHz / 512 samples); configuration-dependent values should come from `sonare_mastering_insert_timing`. `realtimeCost` is a coarse `low`/`moderate`/`high` algorithmic estimate for live inserts, not a hardware benchmark, and is `null` for non-insert ids. `channelPolicy` tells a surround host how the mixer wraps the processor, `category` is the stable UI grouping derived from the id namespace, and `params` contains descriptors for realtime and construction keys (empty for non-insert processors). Each descriptor includes `name`, `id`, `rtSafe`, `type`, `min`, `max`, `minExclusive`, `maxExclusive`, `maxRelativeTo`, `default`, `unit`, `scale`, `uiMin`, `uiMax`, `dependsOn`, `choices`, and `slot`. `slots` lists conditional key groups as `{name,parent,activation,minCrossoverCutoffs}`. The id universe is the union of `sonare_mastering_processor_names()`, the insert set, and `sonare_mastering_pair_processor_names()`, so hosts can filter a processor picker without hardcoding ids. The pointer is thread-local (do not free it or cache it across threads), mirroring `sonare_mastering_processor_names()`.

The focused C ABI queries are:

```c
const char* sonare_mastering_insert_param_info(const char* name);
SonareError sonare_mastering_insert_timing(const char* name, const char* params,
                                           int sample_rate, int* out_latency_samples,
                                           int* out_tail_samples);
SonareError sonare_mastering_preset_params_json(const char* preset, char** json_out);
```

`minExclusive` and `maxExclusive` specify whether the corresponding bound itself is refused. See [Insert parameter descriptors](./effects-inserts.md) for the shared descriptor fields.

`sonare_mastering_insert_param_info` returns a thread-local JSON descriptor array; do not free it. Besides `name`, `id`, `rtSafe`, `type`, `min`, `max`, `default`, `choices` and `slot`, a descriptor declares what a control needs beyond the accepted range: `unit` (read from the processor that consumes the key, from a closed set: `dB`, `dBFS`, `LUFS`, `Hz`, `ms`, `s`, `samples`, `m`, `cm`, `mm`, `deg`, `percent`, `degC`, `V`, `inPerSec`, `dBPerOct`, `semitones`, `cents`, `ratio`, `bits`, `count`, `none`), `scale` (`linear` or `log`), an optional display range `uiMin` / `uiMax` inside `[min, max]`, and `dependsOn`, the sibling keys whose live value bounds this one, each as `this <relation> factor * sibling`, and `coupledWith`, the other sibling keys that move the accepted range (`min` / `max` are measured with them at their defaults). `sonare_mastering_insert_param_info_at_rate(name, sample_rate)` returns the same array with every key whose `maxRelativeTo` is `"nyquist"` resolved to the bound accepted at that host rate (the lower of the host's Nyquist and any cap fixed when the insert is built); it returns `NULL` with `SONARE_ERROR_INVALID_PARAMETER` for a rate out of range, and the rate-less query is unchanged. `sonare_mastering_insert_timing` rejects unknown keys and reports the configured latency and tail. `sonare_mastering_preset_params_json` returns `{"version":1,"params":{...}}`; release its heap-owned string with `sonare_free_string`. The catalog's `repair.*` entries publish their parameters through the same descriptor, carry no automation `id`, and are never `rtSafe`; every entry also carries `causal` (false for `repair.declick`, `repair.declip` and `repair.trimSilence`, true for the other repair stages and every insert). `repair.decrackle`, `repair.dehum`, `repair.denoiseClassical` and `repair.dereverbClassical` are realtime inserts under their ids; declick and declip stay offline. Enum-valued parameters accept their `choices` name beside the number; `sonare_mastering_enum_value(processor, key, name, &is_enum, &value)` resolves a name. `sonare_capability_catalog_json()` combines the processor catalog, built-in mastering, synth, mixing-scene, and voice-changer preset lists, and detailed `masteringPresets` entries.

Realtime voice presets are exposed in C as `sonare_realtime_voice_changer_preset_names()`, `sonare_realtime_voice_changer_preset_json()`, and `sonare_realtime_voice_changer_validate_preset_json()`. The typed preset selector is the `SonareVoiceCharacterPreset` enum (`SONARE_VC_PRESET_NEUTRAL_MONITOR` = 0 through `SONARE_VC_PRESET_DARK_VILLAIN` = 5); `sonare_voice_character_preset_id(preset)` returns its canonical id string (NULL for unknown values), and the `SONARE_REALTIME_VOICE_CHANGER_PRESET_IDS` macro provides the newline-separated id list for compile-time binding generation. The native POD config ABI is `SONARE_VOICE_CHANGER_ABI_VERSION`; it is separate from the preset JSON `schemaVersion`.

## Additional C ABI entry points

Pitch, voice and repair (`sonare_c_effects.h`, `sonare_c_mastering.h`):

| Function | Purpose |
|----------|---------|
| `sonare_auto_tune(samples, length, sample_rate, key, config, &out, &out_length, &out_key)` | Offline automatic pitch correction of a monophonic recording to the scale of a key. `key` is a `SonareKey` or `NULL` to detect it (a named key is taken as certain, so `out_key` reports confidence 1); `config` may be `NULL`, and only `scale_reference_midi`, `retune_amount`, `max_correction_semitones`, `retune_speed_ms` and `vibrato_threshold_cents` are read. The output has the input's length; release it with `sonare_free_floats` |
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
| `sonare_engine_resolve_master_automation_id(engine, "faderDb", "pan" or "width", &id)` | The same for the master strip, which always exists, so the id never goes stale. Any other name is `SONARE_ERROR_INVALID_PARAMETER` and sets `id` to 0 |

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
