---
title: Playback Renderer
description: PlaybackRenderer turns decoded mono/stereo/5.1/7.1 movie audio into binaural headphone output or calibrated speaker output — upmix, loudness alignment, night mode, dialogue level, bass management, head tracking and room modeling, with a fixed reportable latency for audio/video sync.
---

# Playback Renderer

`PlaybackRenderer` turns decoded movie audio into what a listener actually hears. It takes mono, stereo, 5.1 or 7.1 PCM — nothing else, no bitstream decoding, no container, no video — and renders it to headphones (binaural, head tracking, room model) or to stereo, 5.1 or 7.1 speakers (upmix, speaker calibration, bass management). Loudness alignment, a night-mode dynamics curve, and a static dialogue-level gain apply on every target.

Use it after your own decoder has produced PCM: a WebCodecs pipeline, a `<video>` element's `MediaElementAudioSourceNode`, a decoded file read from disk. For the input/output channel conventions this page assumes, see [Channel Formats](./channel-formats.md).

## Stage Pipeline

Processing runs through twelve named stages. The first six only depend on the *source* channel bed and run once regardless of target; the last two branch by target and converge on a shared output limiter.

<FlowDiagram
  title="Playback renderer stages"
  direction="TB"
  :nodes="[
    { id: 'reorder', label: 'Reorder', col: 0, row: 0, group: 'front' },
    { id: 'dialogue', label: 'Dialogue level', col: 0, row: 1, group: 'front' },
    { id: 'upmix', label: 'Upmix', col: 0, row: 2, group: 'front' },
    { id: 'loudness', label: 'Loudness', col: 0, row: 3, group: 'front' },
    { id: 'night', label: 'Night mode', col: 0, row: 4, group: 'front' },
    { id: 'convert', label: 'Layout convert', col: 0, row: 5, group: 'front' },
    { id: 'calibration', label: 'Speaker calibration', col: 0, row: 6, group: 'speakers' },
    { id: 'bass', label: 'Bass management', col: 0, row: 7, group: 'speakers' },
    { id: 'binaural', label: 'Binaural (HRTF)', col: 1, row: 6, group: 'headphones' },
    { id: 'early', label: 'Room, early reflections', col: 1, row: 7, group: 'headphones' },
    { id: 'late', label: 'Room, late reverberation', col: 1, row: 8, group: 'headphones' },
    { id: 'limiter', label: 'Output limiter', col: 0, row: 9, variant: 'success' }
  ]"
  :edges="[
    { from: 'reorder', to: 'dialogue' },
    { from: 'dialogue', to: 'upmix' },
    { from: 'upmix', to: 'loudness' },
    { from: 'loudness', to: 'night' },
    { from: 'night', to: 'convert' },
    { from: 'convert', to: 'calibration', label: 'speakers target' },
    { from: 'convert', to: 'binaural', label: 'headphones target' },
    { from: 'calibration', to: 'bass' },
    { from: 'binaural', to: 'early' },
    { from: 'early', to: 'late' },
    { from: 'bass', to: 'limiter' },
    { from: 'late', to: 'limiter' }
  ]"
  :groups="[
    { id: 'front', label: 'Source-dependent' },
    { id: 'speakers', label: 'Speakers only' },
    { id: 'headphones', label: 'Headphones only' }
  ]"
  caption="A stage the current configuration does not need is skipped and named in diagnostics().inactive_stages, along with its own reported latency contribution."
/>

Dialogue level acts on the discrete centre channel of a 5.1 or 7.1 source and is a no-op on mono or stereo input. Upmix runs only for stereo input with `upmix.enabled`; it separates direct and ambient content by inter-channel coherence and sends decorrelated ambience to the surrounds instead of discarding it, rather than panning a mono sum. Layout convert narrows or widens the source bed to the target's channel count — see [Channel Formats](./channel-formats.md) for the conversion rules. Which of the twelve stages a given configuration exercises — a speakers target skips `binaural`, `room_early` and `room_late`; a mono source skips `dialogue_level` and `upmix` — is always readable from `diagnostics()`, never left to be inferred from the configuration alone.

## Configuration

Configuration is one JSON document following `schemas/playback-renderer-config.schema.json`, passed to the constructor and to `setConfig`/`set_config`. Every key is either a **prepare** key, fixed at construction, or a **realtime** key, adopted at the next processed block. `setConfig` takes a complete document; a prepare key that differs from the current value is refused. Omitted keys take the defaults below.

### Prepare keys

| Key | Type / range | Default | Notes |
|---|---|---|---|
| `input.layout` | `"auto"` \| `"mono"` \| `"stereo"` \| `"5.1"` \| `"7.1"` | `"auto"` | `auto` follows each block's own channel count (1, 2, 6 or 8); see [Automatic Input-Layout Switching](#automatic-input-layout-switching) |
| `input.channel_map` | array of role names, or `null` | `null` | Requires a fixed `input.layout`; `null` means canonical order |
| `target.kind` | `"headphones"` \| `"speakers"` | `"headphones"` | |
| `target.layout` | `"stereo"` \| `"5.1"` \| `"7.1"` | — | Required for `speakers`, forbidden for `headphones` |
| `target.speakers.<role>.distance_m` | number, [0.1, 30], or `null` | `null` | Non-LFE roles of the output layout only; `null` disables distance compensation for that speaker |
| `target.speakers.<role>.size` | `"large"` \| `"small"` | `"large"` | A `"small"` speaker is high-passed at the crossover when bass management is enabled |
| `target.bass_management.enabled` | boolean | `false` | |
| `target.bass_management.crossover_hz` | number, [40, 200] | `80` | Linkwitz-Riley 4th-order crossover |
| `target.bass_management.subwoofer` | boolean | `true` | `false` folds the low band and the LFE channel into the large L/R pair instead |
| `room.preset` | `"none"` \| `"living_room"` \| `"home_theater"` \| `"screening_room"` | `"living_room"` | Headphones only; see [Room Presets](#room-presets) |

### Realtime keys

| Key | Type / range | Default | Notes |
|---|---|---|---|
| `target.speakers.<role>.trim_db` | number, [-20, 20] | `0` | |
| `target.bass_management.lfe_gain_db` | number, [-10, 15] | `10` | Gain applied to the LFE channel when feeding a subwoofer |
| `lfe_mix_db` | number, [-60, 10] | `0` | LFE level folded into L/R when the target has no LFE channel, or bass management has no subwoofer |
| `upmix.enabled` | boolean | `true` | Stereo input only; toggling it does not change the reported latency |
| `upmix.center_width` | number, [0.05, 1] | `0.2` | Width of the centre-extraction window on the panning index |
| `upmix.front_ambience` | number, [0, 1] | `0.5` | Power share of ambient content kept in the front pair rather than sent to the surrounds |
| `upmix.lfe_from_upmix` | boolean | `false` | Derive an LFE signal from the low-passed front sum |
| `dialogue_level_db` | number, [-12, 12] | `0` | Static gain on the discrete centre channel of 5.1 / 7.1 input; a no-op on mono or stereo |
| `loudness.program_lufs` | number, [-70, 0], or `null` | `null` | Measured program loudness; `null` applies no alignment gain |
| `loudness.target_lufs` | number, [-40, -5] | `-24` | |
| `night_mode.amount` | number, [0, 1] | `0` | `0` disables the dynamics curve entirely |
| `room.mix_db` | number, [-30, 6] | `-6` | Level of the early reflections and the late reverberation together |
| `room.enabled` | boolean | `true` | |
| `head_tracking.enabled` | boolean | `true` | `false` treats the head pose as zero |
| `output_limiter.enabled` | boolean | `true` | Toggling it does not change the reported latency |
| `output_limiter.ceiling_db` | number, [-12, 0] | `-1` | |

::: tip Measuring program loudness ahead of time
`loudness.program_lufs` is a value you supply, not something the renderer measures live — real-time loudness tracking would pump under scene changes. `PlaybackLoudnessMeter` (below) measures a whole program once, offline or ahead of playback, so the gain is fixed for the duration.
:::

## Latency

`latencySamples()` / `latency_samples()` depends only on the output target, the sample rate, and speaker distance compensation — never on a realtime key, and never on the active input layout.

| Target | 44.1 kHz | 48 kHz |
|---|---|---|
| Stereo speakers | 265 samples (6.0 ms) | 288 samples (6.0 ms) |
| 5.1 / 7.1 speakers, or headphones | 1289 samples (29.2 ms) | 1312 samples (27.3 ms) |

The wider figure holds for every target that can run the upmix stage, whether or not `upmix.enabled` is currently true: the analysis window it would need is reserved either way, so switching upmix on and off in a live session never moves the latency. Distance compensation on a speaker target adds its own delay in frames, rounded to the nearest sample, on top of these figures.

## Automatic Input-Layout Switching

With `input.layout: "auto"` (the default), the renderer follows the channel count of each processed block — 1, 2, 6 or 8 — and switches the active input layout at a block boundary with no dropped or duplicated audio and no change in latency. Internally, the six source-dependent stages of the previous layout keep draining into the output for as long as their own state takes to decay, while the new layout's stages start fresh; the two sum together so nothing is lost or repeated at the seam. `input_channels()` / `inputChannels()` reports the active layout's channel count (2 before the first call); an unsupported channel count on a fixed (non-`auto`) layout is refused without advancing any state.

`diagnostics()` reports `active_input_layout`, `layout_switches` (a running count), and `truncated_drains` — incremented when a layout switches back before the previous one finished draining, which fades the interrupted drain out over 2 ms rather than cutting it.

## Audio and Video Sync

The renderer does not know about video. What it gives a host toward keeping audio and video together is a fixed, reportable latency, a layout switch with no dropped or duplicated audio, and `reset()` for a seek — not a synchronization mechanism of its own.

- **Renderer delay**: `latencySamples() / sampleRate`.
- **Host output delay adds to it.** In a browser, `AudioContext.baseLatency + outputLatency` (treat a missing `outputLatency` as 0); re-read it on `devicechange` / `sinkchange`, since it changes with the output device. On native, use the device's own reported latency.
- **Renderer delay changes only when the renderer is rebuilt.** Host output delay can change with the output device or backend, so re-read it when the host reports a device change. A realtime key or an input-layout switch does not move the renderer's delay.
- **On a seek, call `reset()`** from the thread that calls `process*` (or stop the stream first), which discards whatever was still in the pipeline. In a worklet, send `{ type: 'reset' }` on the media element's `seeking` event — the port handler runs between render quanta, so it never races `process()`.
- **Two integration patterns.** Letting a `<video>` element drive playback and only routing its audio through `MediaElementAudioSourceNode` → the renderer gives you no timestamp for the presented frame, so you can only express a *relative* delay: the audio comes out the renderer's own latency (plus up to one render quantum) later than playing the element directly, and there is no way to hold the video back to compensate. A `WebCodecs`-based pipeline that owns its own playback clock can instead delay each video frame's presentation by the renderer latency plus the host output delay, achieving real alignment.
- For perspective: ITU-R BT.1359 puts the threshold at which viewers start noticing audio lagging video around 125 ms. The renderer's own contribution (27–29 ms) is a fraction of that; host output delay (commonly 10–50 ms, far more over a wireless audio link) is usually the larger term.
- A browser's own built-in decoder can hand back multichannel PCM for a format libsonare does not decode itself; once it is PCM, it enters the renderer the same way any other decoded channel bed does — any height or object information the original stream carried is already gone by that point.

## Head Tracking

`setHeadOrientation(yaw, pitch, roll)` — degrees, right-handed: positive yaw turns the head right, positive pitch looks up, positive roll lowers the right ear, applied in that order. It is ignored by a speakers target. The renderer has no sensor fusion of its own; an application reads its own IMU or device-orientation API and calls this on every update. `head_tracking.enabled: false` treats the pose as zero without needing to stop calling the setter.

## HRTF Sets

A headphones target convolves each virtual speaker direction through a head-related transfer function, held in an `HrtfSet` handle built from **SHRF v1** data — a small, self-contained format (minimum-phase impulse responses plus inter-aural time delay, on a regular azimuth/elevation grid) rather than the HDF5-based SOFA format HRTF measurements are usually published in.

Every surface but WASM can build the embedded default set — SADIE II subject D1 (a KU100 dummy-head measurement) reduced to 504 directions — with one call and no file. WASM ships no embedded HRTF data, to keep the module's download size down; fetch the package's own default asset and pass its bytes to `HrtfSet.fromBytes`:

```typescript
const bytes = new Uint8Array(await (await fetch(hrtfUrl)).arrayBuffer());
const hrtf = HrtfSet.fromBytes(bytes);
```

`tools/playback/sofa_to_shrf.py`, in the library's source tree, converts a SOFA HRIR measurement into a SHRF v1 file for a custom HRTF set. A renderer built from an `HrtfSet` keeps its own copy of the data, so the set can be released immediately after construction.

## Room Presets

A headphones target can add a synthesized room around the direct, HRTF-convolved sound: early reflections from a room-fixed horizontal ring plus a decaying late reverberation tail, both rendered through the same binaural path so they follow head rotation along with the direct sound. `room.preset` picks a fixed shoebox room (`none` disables it); `room.mix_db` sets the combined level of both parts, and `room.enabled` toggles it live without changing the reported latency. Room presets are not available for a speakers target — a speaker target renders into a real room already.

| Preset | Character |
|---|---|
| `none` | No added room; direct HRTF sound only |
| `living_room` | Small, moderately absorptive |
| `home_theater` | Larger, more absorptive |
| `screening_room` | Largest, most absorptive |

## Loudness Alignment and Metering

`loudness.program_lufs` and `loudness.target_lufs` apply a single static gain of `clamp(target_lufs - program_lufs, -40, +12)` dB, so the bounded gain can leave the program short of its target without live compression pumping under scene changes. `PlaybackLoudnessMeter` (1, 2, 6 or 8 channels, BS.1770 channel weights) measures a whole program's integrated loudness ahead of playback: feed it interleaved chunks with `pushInterleaved`/`push_interleaved` and read `integratedLufs()`/`integrated_lufs()` once the program has played through, then pass that value as `loudness.program_lufs`.

## One Flow, Every Binding

Every binding follows the same shape: build a renderer from a configuration document (and an `HrtfSet` for a headphones target), process blocks, and release the handle. The CLI instead renders a whole file in one call.

::: code-group

```c [C]
#include <sonare/sonare_c_playback.h>

SonareHrtfSet* hrtf = NULL;
sonare_hrtf_set_create_default(&hrtf);  // native builds only; WASM has none

SonarePlaybackRenderer* renderer = NULL;
SonareError err = sonare_playback_renderer_create_json(
    "{\"target\":{\"kind\":\"headphones\"}}", hrtf, 48000, 1024, &renderer);
if (err != SONARE_OK) return err;

err = sonare_playback_renderer_process_interleaved(renderer, in, in_channels, out, 2, frames);

int latency = 0;
sonare_playback_renderer_latency_samples(renderer, &latency);

sonare_playback_renderer_destroy(renderer);
sonare_hrtf_set_destroy(hrtf);
```

```python [Python]
import libsonare as sonare

with sonare.HrtfSet.default() as hrtf, sonare.PlaybackRenderer(
    {"target": {"kind": "headphones"}}, hrtf=hrtf, sample_rate=48000
) as renderer:
    out = renderer.process_interleaved(samples, in_channels=6)
    print(renderer.latency_samples(), renderer.diagnostics())

# Whole-buffer render through the same config:
rendered = sonare.render_playback(samples, channels=6, sample_rate=48000, config={"target": {"kind": "headphones"}})
```

```typescript [Node]
import { HrtfSet, PlaybackRenderer } from '@libraz/libsonare-native';

using hrtf = HrtfSet.default();
using renderer = new PlaybackRenderer({
  config: { target: { kind: 'headphones' } },
  hrtf,
  sampleRate: 48000,
});

const out = renderer.processInterleaved(samples, 6);
console.log(renderer.latencySamples(), renderer.diagnostics());
```

```typescript [WASM / Worklet]
// Realtime, in an AudioWorklet — the flagship use of this renderer: bind a
// video element's own multichannel decode straight into binaural headphones.
// 5.1 input from the browser's own decoder is spec-defined and matches
// libsonare's canonical channel order; 7.1 channel order is not yet
// confirmed across browsers (see Channel Formats), so keep worklet input at
// mono/stereo/5.1 until that is checked.
await context.audioWorklet.addModule(playbackWorkletUrl);
const hrtf = await (await fetch(hrtfUrl)).arrayBuffer();
const node = createSonarePlaybackNode(context, {
  config: { input: { layout: 'auto' }, target: { kind: 'headphones' } },
  hrtf,
});
context.createMediaElementSource(video).connect(node).connect(context.destination);
video.addEventListener('seeking', () => node.port.postMessage({ type: 'reset' }));
```

```bash [CLI]
# Renders a whole file in one call; --program-lufs measures the input itself
# when omitted.
sonare playback movie-5.1.wav -o headphones.wav --target headphones
sonare playback movie-5.1.wav -o out-7.1.wav --target 7.1 --room home_theater --night 0.5
```

:::

The one-shot form — `renderPlayback`/`render_playback`/`sonare_playback_render_interleaved`/`sonare playback` — builds a renderer internally, feeds a whole signal through it, and trims the renderer's own latency off the front of the result so the output lines up sample-for-sample with the input.

## Non-Goals

- Decoding any compressed surround format, containers, or video; the renderer accepts decoded PCM only.
- Passing compressed audio through untouched to an external receiver.
- Height channels or object-based audio; channel layouts are limited to mono, stereo, 5.1 and 7.1.
- Adaptive dialogue enhancement — voice-activity detection, dialogue-aware ducking, or an intelligibility model. Dialogue level is a static gain on a discrete centre channel only, and only when the source carries one.
- Automatic room correction from microphone measurements or test tones. Room presets are fixed models; speaker distance, trim and crossover are supplied by the caller.
- Real-time loudness tracking tied to program content or ambient noise. Loudness alignment is a static gain computed from a caller-supplied (or separately pre-measured) program loudness value.
- Crosstalk cancellation, HRTF personalization, or an arbitrary-shaped or arbitrarily-sized room.
- Loading a SOFA file directly; convert it to SHRF v1 offline first.
- Head-pose sensor fusion; the application supplies yaw/pitch/roll from its own sensor or device-orientation source.

## Related Pages

- [Channel Formats](./channel-formats.md)
- [Surround group buses and wide meters](./realtime-engine.md#surround-group-buses-and-wide-meters)
- [Acoustic Analysis](./acoustic-analysis.md)
- [CLI Reference](./cli.md)
- [JavaScript API](./js-api.md)
- [Python API](./python-api.md)
- [Node.js Native API](./node-api.md)
