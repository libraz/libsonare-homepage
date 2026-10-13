# Synth Playground

Plays libsonare's built-in polyphonic synthesizer live — presets across every
synthesis engine, a computer keyboard and Web MIDI, rendered locally.

- Page: `/synth` — https://libsonare.libraz.net/synth
- Entry: `SynthDemo.vue`
- Engine: `synthPresetNames`, `synthPresetPatch`, `synthEnumTables`,
  `synthPatchParamInfo`, `synthEngineParamInfo`, `bindWebMidi` /
  `isWebMidiAvailable`; in the worklet, `setSynthInstrument`,
  `resolveInstrumentAutomationId` and `setParameterSmoothed`.

Voices render in a SharedArrayBuffer-free AudioWorklet (`useSynthEngine.ts` boots
the module there through the `sonare-worklet.js` bridge). The piano keyboard and
the computer-key mapping are shared components and live in
`src/components/keyboard/`.

Programs are listed under the engine that plays them, read from each preset's own
patch and ordered by `synthEnumTables().engineModes`. Each list opens with the
engine's base voice, a patch that names only `engineMode`: every mode sounds that
way except `sample`, which needs a sample bank and is left out. The base voice is
where the Model row works: it draws every field of the engine's own section from
`synthEngineParamInfo()` (a knob per closed-range field, a switch per boolean),
because a catalog preset does not publish its section's values. On the
percussion engine only the GM-kit switch reaches the voice, so the row says that
instead.

The filter, envelope and voice knobs move held notes in place through
`resolveInstrumentAutomationId` + `setParameterSmoothed`. Waveform, filter model,
program and model fields rebind the instrument, which fades the voices it
replaces, so held keys are struck again.

A control the current engine renders bit-identically without is dimmed
(`inertTweaks` in `synthPatchState.ts`): `waveform` everywhere but the
subtractive engine, and every per-voice control on the percussion engine.
`tests/demos/synth/synthEngineControls.test.ts` renders the whole catalog to hold
that table to the engine, in both directions; `synthEngineModes.test.ts` and
`synthLiveParams.test.ts` hold the base voices and the live knobs.
