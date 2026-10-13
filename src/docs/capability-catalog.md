# Capability Catalog

This page documents the JSON document a build returns about its own processors: which surfaces return it, what each parameter descriptor holds, and what a host can build from it. For where it sits among the other API families, see [Feature Map](./api-surface.md).

The build can describe its own processor surface. `capabilityCatalog()` on Node and WASM, `capability_catalog()` on Python, and `sonare_capability_catalog_json` on the C ABI return the same JSON document: the build's version and ABI numbers, every named processor with its parameters and slot metadata, the built-in preset name lists, and mastering-preset metadata. Neither CLI exposes it; `doctor` prints the separate build-diagnostics report.

The current build publishes **95 processors and 5,579 parameter descriptors**; 84 of the processors are realtime-insertable, and every processor reports a `category`. All of these numbers can be recounted rather than taken on trust: the libsonare repository tracks the generated document as `tools/capability-catalog.json`, `make capability-catalog-check` fails when that file drifts from what the shared library actually answers, and `schemas/capability-catalog.schema.json` fixes the shape.

## Parameter Descriptor Fields

Every parameter descriptor carries the same eighteen fields:

| Field | What it holds |
|-------|---------------|
| `name` | The key construction reads, such as `releaseMs` or `band0.frequencyHz` |
| `id` | The integer id used by Mixer insert automation and MIDI-CC binding, or `null` for a construction-only key; realtime insert setters resolve the parameter by `name`, and non-null ids run `0..n-1` in automation order |
| `rtSafe` | Whether the value can be changed live from the audio thread |
| `type` | `number`, `boolean`, `enum`, `string`, or `array`, taken from the value the config builder reads |
| `default` | The config struct's field initializer when the builder has one; `null` means there is no fallback value |
| `min`, `max` | The interval construction accepted when probed, or `null` when the catalog knows of no limit on that side |
| `minExclusive`, `maxExclusive` | Whether the bound itself is rejected; `false` when that bound is `null` |
| `maxRelativeTo` | `'nyquist'` when the effective ceiling is the lower of `max` and the host's Nyquist, otherwise `null` |
| `unit` | The unit the processor declares for the key, from a closed set: `dB`, `dBFS`, `LUFS`, `Hz`, `ms`, `s`, `samples`, `m`, `cm`, `deg`, `percent`, `degC`, `V`, `inPerSec`, `dBPerOct`, `semitones`, `cents`, `ratio`, `bits`, `count`, `none`. It is `null` for the boolean, enum, string, and array keys, which have no unit |
| `uiMin`, `uiMax` | The range a control should draw, inside `min` / `max`, or `null` when the accepted range is also the display range |
| `scale` | The axis a control draws the value on: `linear` or `log` |
| `choices` | A closed set of named numeric choices, including discrete numeric values with gaps, or `null` when no closed set is published |
| `slot` | The processor slot group that owns the key, or `null` when the key belongs to no group |
| `dependsOn` | The sibling keys whose live value bounds this one, each as `{ key, relation, factor }` with `relation` one of `lt`, `le`, `gt`, `ge` read as `this <relation> factor * sibling` (`factor` is 1 for a plain ordering); empty for an independent key |
| `coupledWith` | The other sibling keys, beyond `dependsOn`, that move this key's accepted range in a way a single relation cannot state (for `effects.reverb.room`, `receiverSpacingM` is coupled to `lengthM`, `widthM`, `listenerX`, `listenerY`, `sourceX` and `sourceY`); empty for an independent key. `min` / `max` are measured with these siblings at their defaults |

Each processor entry also carries `causal`, which is `true` for every realtime-insertable processor and for the four causal repair stages (`repair.decrackle`, `repair.dehum`, `repair.denoiseClassical`, `repair.dereverbClassical`). It is `false` for `repair.declick`, `repair.declip` and `repair.trimSilence`, which have no configuration whose output at a sample depends only on earlier input, and for the offline-only processors that are not inserts (`final.*`, `match.*`, `maximizer.loudnessOptimize`). Entries also carry a `category`: `dynamics`, `effects`, `eq`, `final`, `reference` (the `match.*` processors), `maximizer`, `multiband`, `repair`, `saturation`, `spectral`, `stereo`, `utility` or `voice`.

Entries with a non-null `id` are automation targets; construction-only entries have `id: null` and `rtSafe: false`. An `rtSafe: false` entry must not be scheduled for live automation even when it has an id. `choices` describes a closed named numeric set, including discrete numeric values with gaps. `slot` identifies the slot group a key belongs to; `null` means that it belongs to no slot. A non-null slot is not necessarily conditional: each processor's `slots` array supplies the group's `activation` (`anyKey` or `always`), its `parent` slot when nested, and any `minCrossoverCutoffs` requirement that determines when the group is present.

Defaults are read from the code, not written down, and can be `null` when a construction key has no fallback. `uiMin` / `uiMax`, `dependsOn` and `coupledWith` describe how to draw and order a control; the accepted range stays `min` / `max`. Bounds are measured: candidate values go through the same construction path a caller uses, with the processor's other parameters at their defaults, and the catalog reports the interval validation accepted. A `null` bound means the processor takes any value on that side, or that construction never validates the key — not that a limit exists and went unmeasured. Two properties of a measured bound matter before you wire a slider to it: a control that constrains another reports the other's default, and an exclusive bound is reported as the value it excludes. [JavaScript API](./js-api.md#capabilitycatalog) walks through the concrete cases, and [Insert Effects](./effects-inserts.md#the-parameter-descriptor) documents each field.

## Chain And Preset Sections

A top-level `chain` section describes the flat keys of a mastering chain config. `stages` lists each stage's key prefix, the processor whose parameters its keys are (or `null`) and its `enabled` key; `lists` names the indexed lists (the multiband stage's `cutoffsHz` and `bands`) with their item counts; `params` holds descriptors, measured through the chain's own validator, for the keys no processor carries (the `enabled` switches, `loudness.*`, `repair.denoise.gainFloor`, the crossover FIR kernel size and cutoff list); and `aliases` gives every alternative spelling of a key. Node, WASM and Python declare it as `CapabilityCatalogChain`. `presets` also carries `playbackRoom`, always present and empty when playback is compiled out.

The `presets.mastering` array remains the compact list of mastering preset names. The top-level `masteringPresets` array adds one object per name with `kind`, `targetLufs`, `truePeakCeilingDb`, and `maxLimiterGainReductionDb`; restoration entries set those three numeric fields to `null`. Use `masteringPresetParams` on the binding when you need the flat numeric/boolean parameter map for a selected preset.

## What To Use It For

Two things the descriptor is good for:

- **A control surface without a hand-maintained table.** Lay out each parameter from its `type`, `default`, `min`, `max`, `uiMin`, `uiMax`, `scale`, and `unit`, and a new processor or a renumbered band shows up in the UI when the build changes, not when someone edits a spreadsheet.
- **Checking a value before it crosses the boundary.** A number outside a published bound is rejected at construction. Testing it against the catalog first turns that runtime error into a validation message at the point the user typed the value.

```typescript
const catalog = capabilityCatalog();
const limiter = catalog.processors.find((p) => p.id === 'dynamics.brickwallLimiter');
const release = limiter?.params.find((p) => p.name === 'releaseMs');

function accepts(value: number): boolean {
  if (!release) return false;
  return (release.min === null || value >= release.min)
      && (release.max === null || value <= release.max); // max is null: no upper bound is published
}
```

The catalog describes the surface from the outside: which processors exist and what each accepts. Why a processor has the same id in every runtime is the layering described in [Architecture](./architecture.md).
