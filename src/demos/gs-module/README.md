# GS Sound Module

A GM/GS tone module you can drive from the page: pick a sound per part, mix
sixteen parts, choose an insertion effect, and drop a `.mid` to hear your own
file through it. No SoundFont is loaded, so every note plays the built-in
fallback voices and the page ships no sample data.

- Page: `/gs-module` — https://libsonare.libraz.net/gs-module
- Entry: `GsModuleDemo.vue`
- Engine: `Project.importSmf` and `Project.bounceWithSf2Instrument` for the
  render, `synthGsDrumKitName` and `synthGsDrumKitIsVoicedApart` for the
  rhythm-set list.

## Everything is offline, and it has to be

The live engine has no program change, so a patch browser cannot be driven by
it. SysEx only reaches a project through an imported file — `setMidiEvents`
drops every payload the clip held. So each audition assembles a Standard MIDI
File, imports it and bounces.

Imports append rather than replace, and tick-zero SysEx is realized before
tick-zero notes whatever track it arrived on. A dropped file is therefore
imported exactly as it came, with the panel settings carried on a separate
track beside it: a file that sets up its own GS state keeps it, and the demo
never parses a byte of it.

## `data/` is generated

`address-table.json`, `efx-tables.json` and `efx-audibility.json` are produced
by `yarn generate:gs-data` from the sibling engine checkout and committed, the
same way the WASM artifacts are. `yarn check:gs-data` compares the digests they
record. Nothing here holds a GS address literal: `gsAddress.ts` resolves an
address from a parameter name, and `gsState.ts` takes every power-on value from
the table, so a control starts where the engine starts.

The third file is measured rather than derived — it records which effect types
change the render at their power-on bytes, and which of their twenty parameter
slots the engine acts on, both found by bouncing. It follows the bundled engine
build, so refreshing the WASM turns that gate red.

## Files

| File | What it holds |
| --- | --- |
| `gsAddress.ts` | Address resolution, part-block mapping, DT1 framing |
| `gsState.ts` | Module state and the messages that produce it |
| `gsNames.ts` | Japanese labels, and the effect-type names |
| `useGsModule.ts` | The store: state, render, playback, engine queries |
| `GsModuleDemo.vue` | The entry, composing the five panels over one state |
| `GsPartMixer.vue` | The sixteen part strips |
| `GsPatchBrowser.vue` | Programs by family, and bank variations |
| `GsKitBrowser.vue` | Rhythm sets on the rhythm part |
| `GsEfxInspector.vue` | Effect type, its slots, and what each one does here |
| `GsSourcePanel.vue` | File drop, transport, and the bytes being sent |

## Names come from the engine wherever it has them

English instrument and family names are `Project.gmInstrumentName` and
`Project.gmFamilyName`; the rhythm sets are `synthGsDrumKitName`; which bank
variations are voiced apart is `synthGsVariationIsVoicedApart`. Only the
Japanese, and the insertion-effect type names, are written down here — a second
copy of anything the engine can answer is a copy that drifts.
