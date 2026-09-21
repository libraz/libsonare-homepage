# Realtime Voice Changer

Runs the microphone through libsonare's voice-changer chain live: pitch,
formant, brightness and character presets, with speaker-safety controls.

- Page: `/realtime-fx` — https://libsonare.libraz.net/realtime-fx
- Entry: `RealtimeFxLab.vue`

The DSP runs inside an AudioWorklet rather than on this page: `useRealtimeFx.ts`
boots the WASM module in the worklet through the `sonare-worklet.js` bridge and
then only sends parameter updates, so no audio crosses the thread boundary. The
preset macros mirror the published preset JSON.
