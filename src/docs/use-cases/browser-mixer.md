---
title: Build a Browser Mixer
description: Build a mixing-only web app from the Mixing Studio demo, with one project state driving both a live engine and an export render, stereo decoding, project files, and a source map.
---

# Build a Browser Mixer

A mixing-only web app needs file loading, synchronized playback, track controls, and a rendered download. libsonare supplies the DSP and routing; the app owns the interface, audio storage, and WAV encoding. MIDI editing, instruments, and recording can be left out.

The [Mixing Studio](/mixing) is a working example: load local stems, place and fade clips, adjust trim, a six-band EQ, gate, compressor, de-esser, ducking, pan, width, sends to a plate reverb and a delay, and a master glue compressor and limiter, then bounce and download a stereo WAV. Start with **Load demo**, listen with **Play**, change a fader, and use **Bounce WAV**. The app processes audio locally.

## Choose the playback and rendering API

| App behavior | Entry point | Host responsibilities |
|---|---|---|
| Mix supplied stereo arrays once | [`mixStereo`](../mixing.md#one-shot-mixing-mixstereo) | Decode, align and pad inputs, then encode the result |
| Run a focused stem mixer with a custom playback bridge | [`Mixer`](../mixing.md#scene-based-mixing-mixer) | Feed blocks, manage transport, communicate UI changes, and render the same graph offline |
| Keep timeline playback, controls, automation, and offline rendering together | [`SonareEngine`](../realtime-streaming.md#audioworklet-notes) from `@libraz/libsonare/worklet` | Load clips, declare lanes and routing, connect the output, and provide the UI and persistence |

For a new app with interactive playback and export, start from the existing [SonareEngine setup and control table](../realtime-streaming.md#mastering-preview-in-the-render-realm). The facade mirrors controls to an AudioWorklet engine and an offline engine. Its `renderOffline` result is PCM, and `bounceOffline` returns an interleaved buffer with the raw engine's options (see [Offline render, bounce, and freeze](../realtime-streaming.md#offline-render-bounce-and-freeze)); encoding and downloading a WAV remain app work. Long offline jobs need a worker strategy: an async method alone does not move computation off the main thread.

Mixing Studio uses the third row. The facade plays the project live, and a worker bounces the same project on a plain `RealtimeEngine`. Continuous controls reach the engine through setters, so a fader move during playback keeps processor state such as reverb history. The few construction-only parameters, such as a gate's hold time, rebuild the strip's inserts, so the page applies them when the control is released.

## Keep audio, project state, and engine operations separate

1. Decode all files with one `AudioContext`. A mono input is copied to both sides, and inputs with more than two channels use only the first two, so a surround app needs an explicit channel mapping instead. The demo keeps both channels at the context's sample rate: a mono analysis buffer cannot replace stereo playback audio.
2. Keep PCM arrays in an audio registry keyed by track id, outside the project state. A clip has a start position, a trim into the source, a length, and fades. Imported stems start together at zero; moving a clip is an explicit timeline edit.
3. Keep the project as one plain, serializable object: tracks, buses, master, VCA gains, and loop. Every edit is a pure function from one state to the next, the difference between two states becomes a list of engine operations, and undo and redo take the same path. The [mixer scene](../mixing-scene-json.md) format describes a standalone `Mixer` graph; the demo drives the realtime engine directly and does not use it.
4. Save the [project JSON](../mixing-demo-project-json.md) separately. It holds the state without audio; a reopened project lists its tracks as waiting for audio, and each file added attaches to the track with the same name, otherwise to the next one in order.
5. Render PCM and encode a WAV for download. The demo writes 16-bit, 24-bit, or 32-bit float WAV, with TPDF or noise-shaped dither for the integer formats. Check peak and true peak after bouncing. If levels need lowering, adjust them and bounce again before downloading.

An app that reopens complete sessions needs its own audio persistence, such as stored files plus stable source identifiers. Neither mixer scene JSON nor the demo's project file is a complete audio project archive.

## Read the reference implementation

The [homepage source directory](https://github.com/libraz/libsonare-homepage/tree/main/src/demos/mixing) contains the demo. Read these files in order:

| File | Responsibility |
|---|---|
| [`useMixingStudio.ts`](https://github.com/libraz/libsonare-homepage/blob/main/src/demos/mixing/useMixingStudio.ts) | File loading and the audio budget, history, engine sync, auto-mix A/B, Worker jobs, and project files |
| [`mixingState.ts`](https://github.com/libraz/libsonare-homepage/blob/main/src/demos/mixing/mixingState.ts) | The project state, its defaults, the mutators, and v2 parsing |
| [`mixingEngine.ts`](https://github.com/libraz/libsonare-homepage/blob/main/src/demos/mixing/mixingEngine.ts) | State to engine operations: a full build, a diff, and the export length |
| [`engineApply.ts`](https://github.com/libraz/libsonare-homepage/blob/main/src/utils/engineApply.ts) | The operation set and the two adapters, one over the live facade and one over the raw engine |
| [`useSonareEngine.ts`](https://github.com/libraz/libsonare-homepage/blob/main/src/composables/useSonareEngine.ts) | Booting the `SonareEngine` worklet facade, transport position, meters, and teardown |
| [`mixingBounce.ts`](https://github.com/libraz/libsonare-homepage/blob/main/src/demos/mixing/mixingBounce.ts) | Worker lifecycle, request routing, and PCM buffer transfers |
| [`mixing.worker.ts`](https://github.com/libraz/libsonare-homepage/blob/main/src/demos/mixing/mixing.worker.ts) | The bounce, auto-mix analysis, and the loudness measurement behind the A/B |
| [`mixAssistantMap.ts`](https://github.com/libraz/libsonare-homepage/blob/main/src/demos/mixing/mixAssistantMap.ts) | Mapping a mix suggestion onto the fixed strip layout |
| [`mixingProjectV1.ts`](https://github.com/libraz/libsonare-homepage/blob/main/src/demos/mixing/mixingProjectV1.ts) | Converting a v1 project file |
| [`audio.ts`](https://github.com/libraz/libsonare-homepage/blob/main/src/utils/audio.ts) | Decoding helpers, waveform summaries, and WAV encoding with format and dither |
| [`MixingStudio.vue`](https://github.com/libraz/libsonare-homepage/blob/main/src/demos/mixing/MixingStudio.vue) | Arrangement, console, and master section |

The demo imports copied engine assets through `@/wasm`. In a separate app, use the full `@libraz/libsonare` package; the smaller analysis entry excludes mixing. Package loading is covered by the [WebAssembly guide](../wasm.md), and custom worklet initialization by [WASM Streaming and Realtime](../wasm-streaming.md).

## Understand what the preview verifies

| Behavior | Mixing Studio |
|---|---|
| Track controls, EQ, dynamics, sends, VCA | Applied live through setters while playing |
| Clip moves, trims, fades, and automation lanes | Play live and in the bounce |
| Strip, bus, and master meters | Live; the loudness range is read from the last bounce |
| Channel delay | Applied only while stopped; an edit made during playback waits for the transport to stop |
| Auto-mix A/B | Switches the live mix between yours and the suggestion, loudness-matched at the monitor stage only; the louder side is turned down, and the match never reaches the bounce or the project |
| Preview and bounce | Render bit-exact from the same state |
| Effect tails and graph latency | The bounce extends past the last clip by the longest bus tail and path latency |
| Project file | v2 holds the state without audio; a v1 file is converted when opened |

The worker receives the track PCM transferred from the registry, so while a bounce, an analysis, or a loudness measurement runs the arrays are detached and editing is locked; they return to the registry when the job ends. Each source is held in the page, in the engine, and in the bounce worker, which raises peak memory use.

The eight-track, five-minute, and twenty-minute-in-total limits are demo budgets, not engine limits. Raising them requires measuring memory and audio-thread load on target devices. For longer sessions, see [paged clip audio streaming](../wasm-streaming.md#paged-clip-audio-streaming); OPFS paging into the worklet engine works with or without SharedArrayBuffer and cross-origin isolation, and the demo's playback runs without them.

## Verify an app before using it for a mix

- Load stems exported from one session and confirm their start positions remain aligned.
- Bounce the same state you auditioned and compare it with the live preview, including automation and the reverb tail.
- Test mono and stereo inputs, differing file sample rates, mute/solo, clip offsets, fades, and a reverb tail at the end.
- Save the project, reopen the matching audio, and open the project file. Confirm that each track takes its audio and the controls are restored.
- Stop playback and unmount the app while loading or bouncing. Release the engine, workers, audio contexts, and download URLs.

## Related

- [Mixing Engine](../mixing.md) — DSP controls, scene processing, automation, and meters
- [Realtime Engine](../realtime-engine.md) — timeline, routing, and offline rendering
- [Mixing Demo Project JSON](../mixing-demo-project-json.md) — the project file used by this demo
- [Mixing Scene JSON](../mixing-scene-json.md) — the engine graph format
