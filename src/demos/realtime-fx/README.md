# Realtime Voice Changer

Runs the microphone through libsonare's voice-changer chain live: pitch,
formant, brightness and character presets, with speaker-safety controls.

- Page: `/realtime-fx` — https://libsonare.libraz.net/realtime-fx
- Entry: `RealtimeFxLab.vue`

The DSP runs inside an AudioWorklet rather than on this page: `useRealtimeFx.ts`
builds the processor module, which imports the WASM factory itself, and then
only sends parameter updates, so no audio crosses the thread boundary. The
preset macros mirror the engine's preset configs so the sliders are right before
the WASM loads; `tests/demos/realtime-fx/fxPresets.test.ts` pins the mirror.
The formant mode is fixed once a changer is prepared, so switching it builds a
new changer in the worklet.
