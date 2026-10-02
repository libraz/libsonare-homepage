---
title: Build a Browser Mixer
description: Build a mixing-only web app from the Mixing Studio demo, with separate playback and export paths, stereo decoding, project settings, and a source map.
---

# Build a Browser Mixer

A mixing-only web app needs file loading, synchronized playback, track controls, and a rendered download. libsonare supplies the DSP and routing; the app owns the interface, audio storage, and WAV encoding. MIDI editing, instruments, and recording can be left out.

The [Mixing Studio](/mixing) is a working example: load local stems, adjust faders, pan, tone EQ, and a shared reverb send, then bounce and download a stereo WAV. Start with **Load demo**, listen with **Play**, change a fader, and use **Bounce Mix** followed by **Download WAV**. The app processes audio locally.

## Choose the playback and rendering API

| App behavior | Entry point | Host responsibilities |
|---|---|---|
| Mix supplied stereo arrays once | [`mixStereo`](../mixing.md#one-shot-mixing-mixstereo) | Decode, align and pad inputs, then encode the result |
| Run a focused stem mixer with a custom playback bridge | [`Mixer`](../mixing.md#scene-based-mixing-mixer) | Feed blocks, manage transport, communicate UI changes, and render the same graph offline |
| Keep timeline playback, controls, automation, and offline rendering together | [`SonareEngine`](../realtime-streaming.md#audioworklet-notes) from `@libraz/libsonare/worklet` | Load clips, declare lanes and routing, connect the output, and provide the UI and persistence |

For a new app with interactive playback and export, start from the existing [SonareEngine setup and control table](../realtime-streaming.md#mastering-preview-in-the-render-realm). The facade mirrors controls to an AudioWorklet engine and an offline engine. Its `renderOffline` result is PCM; encoding and downloading a WAV remain app work. Long offline jobs need a worker strategy: an async method alone does not move computation off the main thread.

Mixing Studio uses the second row. Its smaller custom bridge makes the data flow visible, but it rebuilds the mixer scene when controls change during playback. That resets processor state, including reverb history. For frequent control changes, keep processors alive and use incremental setters rather than copying that rebuild strategy.

## Keep audio, mixer scenes, and project settings separate

1. Decode all files with one `AudioContext`. The demo's `decodeAudioFile` retains left and right channels at that context's sample rate; a mono input is copied to both sides. Inputs with more than two channels use only the first two, so a surround app needs an explicit channel mapping instead.
2. Store PCM arrays and clip offsets in app-owned track state. Imported stems start together at zero; moving a clip is an explicit timeline edit. Keep both channels: a mono analysis buffer cannot replace stereo playback audio.
3. Build the [mixer scene](../mixing-scene-json.md) from the controls. It describes strips, buses, inserts, sends, and connections, but contains no source audio or clip arrangement.
4. Save [demo project settings](../mixing-demo-project-json.md) separately. They retain track names, offsets, automation, and controls. They also exclude audio; reopen the matching audio files before importing the settings.
5. Render PCM and encode a WAV for download. The demo's `wavBlob` writes PCM16 and clips samples outside the representable range. Check peak and true peak after bouncing. If levels need lowering, adjust them and bounce again before downloading.

An app that reopens complete sessions needs its own audio persistence, such as stored files plus stable source identifiers. Neither mixer scene JSON nor the demo settings file is a complete audio project archive.

## Read the reference implementation

The [homepage source directory](https://github.com/libraz/libsonare-homepage/tree/main/src/demos/mixing) contains the demo. Read these files in order:

| File | Responsibility |
|---|---|
| [`useMixingStudio.ts`](https://github.com/libraz/libsonare-homepage/blob/main/src/demos/mixing/useMixingStudio.ts) | File loading, track state, transport, settings import/export, and bounce orchestration |
| [`mixingTrackState.ts`](https://github.com/libraz/libsonare-homepage/blob/main/src/demos/mixing/mixingTrackState.ts) | Defaults and conversion from UI tracks to scene inputs and render requests |
| [`mixingScene.ts`](https://github.com/libraz/libsonare-homepage/blob/main/src/demos/mixing/mixingScene.ts) | Engine scene construction, tone inserts, reverb bus, sends, and VCA groups |
| [`useRealtimeMixer.ts`](https://github.com/libraz/libsonare-homepage/blob/main/src/demos/mixing/useRealtimeMixer.ts) | Custom AudioWorklet, a separate WASM heap, prepared 128-frame buffers, and playback position |
| [`mixingBounce.ts`](https://github.com/libraz/libsonare-homepage/blob/main/src/demos/mixing/mixingBounce.ts) | Worker lifecycle, request routing, and PCM buffer transfers |
| [`mixing.worker.ts`](https://github.com/libraz/libsonare-homepage/blob/main/src/demos/mixing/mixing.worker.ts) | Offline 512-frame processing, offset padding, automation, effect tails, and final metering |
| [`audio.ts`](https://github.com/libraz/libsonare-homepage/blob/main/src/utils/audio.ts) | Stereo decoding, waveform summaries, and WAV encoding |
| [`MixingStudio.vue`](https://github.com/libraz/libsonare-homepage/blob/main/src/demos/mixing/MixingStudio.vue) | Console and timeline controls |

The demo imports copied engine assets through `@/wasm`. In a separate app, use the full `@libraz/libsonare` package; the smaller analysis entry excludes mixing. Package loading is covered by the [WebAssembly guide](../wasm.md), and custom worklet initialization by [WASM Streaming and Realtime](../wasm-streaming.md).

## Understand what the preview verifies

| Behavior | Mixing Studio |
|---|---|
| Track controls, tone EQ, reverb, and VCA | Applied by the custom WASM mixer preview when available |
| Fader, pan, and width automation | Applied during bounce; Play uses current static controls |
| Track and master meter readouts | Taken from the latest bounce, not continuous live metering |
| Preview fallback | Uses browser nodes for trim, level, and pan; displays a warning because the full DSP chain is absent |
| Effect tails and graph latency | Extend playback and bounce beyond the dry timeline |
| Project settings import/export | Restores settings onto matching loaded tracks; excludes audio |

The worker receives copies of the track PCM, transferred from the bounce request so the UI's original arrays remain usable. It renders the dry timeline plus the graph's reported tail and latency. Retaining all decoded inputs, worker copies, padded channels, and output arrays increases peak memory use.

The eight-track and five-minute limits are demo budgets, not engine limits. Raising them requires measuring memory and audio-thread load on target devices. For longer sessions, see [paged clip audio streaming](../realtime-streaming.md#paged-clip-audio-streaming); the realtime OPFS path requires SharedArrayBuffer support and cross-origin isolation, while the demo's custom playback bridge works without them.

## Verify an app before using it for a mix

- Load stems exported from one session and confirm their start positions remain aligned.
- Compare a static preview with a bounce using the same controls. In this demo, check automation on the bounce separately.
- Test mono and stereo inputs, differing file sample rates, mute/solo, clip offsets, and a reverb tail at the end.
- Export settings, reopen the matching audio, and import them. Confirm that audio is still present and controls are restored.
- Stop playback and unmount the app while loading or bouncing. Release native mixer handles, workers, audio contexts, and download URLs.

## Related

- [Mixing Engine](../mixing.md) — DSP controls, scene processing, automation, and meters
- [Realtime Engine](../realtime-engine.md) — timeline, routing, and offline rendering
- [Mixing Demo Project JSON](../mixing-demo-project-json.md) — the settings file used by this demo
- [Mixing Scene JSON](../mixing-scene-json.md) — the engine graph format
