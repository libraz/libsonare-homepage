# Synth Playground

Plays libsonare's built-in polyphonic synthesizer live — presets across every
synthesis engine, a computer keyboard and Web MIDI, rendered locally.

- Page: `/synth` — https://libsonare.libraz.net/synth
- Entry: `SynthDemo.vue`
- Engine: `synthPresetNames`, `synthPresetPatch`, `synthEnumTables`,
  `bindWebMidi` / `isWebMidiAvailable`.

Voices render in a SharedArrayBuffer-free AudioWorklet (`useSynthEngine.ts` boots
the module there through the `sonare-worklet.js` bridge). The piano keyboard and
the computer-key mapping are shared components and live in
`src/components/keyboard/`.

Presets are listed under the engine that plays them, read from each preset's own
patch and ordered by `synthEnumTables().engineModes`. There is no free
`engineMode` control: selecting a mode blanks every engine section but its own,
and four modes render silence without the section a preset carries.

A control the current engine renders bit-identically without is dimmed
(`inertTweaks` in `synthPatchState.ts`): `waveform` everywhere but the
subtractive engine, and every per-voice control on the percussion engine.
`tests/demos/synth/synthEngineControls.test.ts` renders the whole catalog to hold
that table to the engine, in both directions.
