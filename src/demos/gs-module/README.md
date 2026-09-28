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

## Why this demo renders offline

The live engine exposes raw MIDI UMP injection, which can carry Program Change,
but has no dedicated patch selector. SysEx only reaches a project through an
imported file — `setMidiEvents` drops every payload the clip held. So each
audition assembles a Standard MIDI File, imports it and bounces.

Imports append rather than replace, and tick-zero SysEx is realized before
tick-zero notes whatever track it arrived on. A dropped file is therefore
imported exactly as it came, with the panel settings carried on a separate
track beside it: a file that sets up its own GS state keeps it, and the demo
never parses a byte of it.

## `data/` is generated

`address-table.json`, `efx-tables.json`, `efx-bindings.json` and
`efx-audibility.json` are produced by `yarn generate:gs-data` from the sibling
engine checkout and committed, the same way the WASM artifacts are.
`yarn check:gs-data` compares the digests they record. Nothing here holds a GS
address literal: `gsAddress.ts` resolves an address from a parameter name, and
`gsState.ts` takes every power-on value from the table, so a control starts
where the engine starts.

The last one is measured rather than derived — it records which effect types
change the render at their power-on bytes, and which of their twenty parameter
slots the engine acts on, both found by bouncing. It follows the bundled engine
build, so refreshing the WASM turns that gate red.

## A parameter slot is named, not numbered

A slot number says nothing, so the inspector does not print one on its own.
`efx-bindings.json` adjudicates every parameter the machine prints: either the
byte reaches a named control on a named insert — `Chorus · Rate` — or it
carries a reason it reaches nothing. The unit beside the name is asked of the
engine at runtime through `capabilityCatalog()`, because a stage in that file
is a processor id and a key is a parameter name, so the two join directly.

The three sources disagree, and the panel shows the disagreement rather than
resolving it. A slot can be named, have a measured conversion behind it, and
still not move this build's render — which means the byte has a meaning the
bundled engine does not carry yet. It is drawn as a named slot this build does
not act on, and refreshing the WASM is what turns it into a working control.

## Files

| File | What it holds |
| --- | --- |
| `gsAddress.ts` | Address resolution, part-block mapping, DT1 framing |
| `gsState.ts` | Module state and the messages that produce it |
| `gsNames.ts` | Japanese labels, the effect-type names, and the binding vocabulary |
| `gsEfx.ts` | The three sources joined per effect type and slot |
| `gsBindingText.ts` | A binding as a reader sees it, in either language |
| `gsParamMeta.ts` | Unit and range per control, asked of the engine |
| `useGsModule.ts` | The store: state, render, playback, scope, engine queries |
| `GsModuleDemo.vue` | The entry, composing the panels over one state |
| `GsDisplay.vue` | The module's display: part, sound, effect |
| `GsPartMixer.vue` | The sixteen part strips |
| `GsPatchBrowser.vue` | Programs by family, and bank variations |
| `GsKitBrowser.vue` | Rhythm sets on the rhythm part |
| `GsEfxInspector.vue` | Effect type, its named slots, and what each one does here |
| `GsSourcePanel.vue` | File drop, the scope, and the bytes being sent |

The fader and the knobs are the shared `ChannelStrip` and `RotaryKnob` from
`src/components/ui`, and the chassis is the shared `.demo-deck` face, so this
module and the studio deck are built from one vocabulary rather than two.

## Names come from the engine wherever it has them

English instrument and family names are `Project.gmInstrumentName` and
`Project.gmFamilyName`; the rhythm sets are `synthGsDrumKitName`; which bank
variations are voiced apart is `synthGsVariationIsVoicedApart`. Only the
Japanese, and the insertion-effect type names, are written down here — a second
copy of anything the engine can answer is a copy that drifts.

One substitution stands between the engine and the screen. A handful of rhythm
sets carry the model number of the drum machine they imitate, and this site
prints no hardware model designations, so `rhythmSetLabel` shows the kind of
machine instead — and the program number, which is what a file actually
selects, is displayed unchanged beside it. The guard is a structural pattern
rather than a list of names: a set added upstream whose name matches and whose
kind is unknown falls back to its slot number, so nothing can slip through by
being new. It lives in `src/utils/modelNames.ts` because the inline kit
audition offers the same sets as static copy and has to call them the same
thing. The generated data under `data/` is guarded the same way, at generation
time, by `scripts/generate-gs-data.mjs`.
