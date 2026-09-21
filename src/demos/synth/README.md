# Synth Playground

Plays libsonare's built-in polyphonic synthesizer live — presets across every
synthesis engine, a computer keyboard and Web MIDI, rendered locally.

- Page: `/synth` — https://libsonare.libraz.net/synth
- Entry: `SynthDemo.vue`
- Engine: `synthPresetNames`, `synthPresetPatch`, `synthEnumTables`,
  `bindWebMidi` / `isWebMidiAvailable`.

Voices render in a SharedArrayBuffer-free AudioWorklet (`useSynthEngine.ts` boots
the module there through the `sonare-worklet.js` bridge). The piano keyboard and
the computer-key mapping are shared with the tuner and live in
`src/components/keyboard/`.
