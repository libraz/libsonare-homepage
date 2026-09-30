---
title: Effects Inserts
description: The creative-FX insert catalog for the libsonare mixing and realtime engine — reverb, modulation, and delay inserts with their parameter tables and build-flag gating, distinct from the named mastering processor registry.
---

# Effects Inserts

**Effects inserts** are the creative-FX processors you load into mixer channel-strip and bus slots (and realtime engine inserts): reverbs, modulation effects, and delays. They are built through the same insert factory that the [Mixing Engine](./mixing.md) uses for every channel-strip insert.

::: info Inserts are not mastering processors
This page catalogs **mixer/engine inserts**. The named [Mastering Processors](./mastering-processors.md) registry — compressors, EQ, saturation, stereo, repair, and the loudness/maximizer stages — is a separate topic with its own scope. The two overlap only where noted: a few FX inserts are *also* exposed as one-shot mastering processors. If you are looking for the mastering registry, start on that page instead.
:::

An insert sits *in* the channel path, so everything downstream — the fader, the sends, the bus — sees its output. That position is what separates an insert from a send, and it is the first thing to be sure of before reading the catalog below.

<SonareDemo id="pre-post-fader" />

## Discovering the insert set

Mixer scene inserts use the same processor factory as mastering inserts, but the valid insert set is slightly broader than `masteringProcessorNames()`. Six runtime APIs describe what is available and how to configure it:

| API | Returns |
|-----|---------|
| `masteringInsertNames()` | The full list of valid insert ids |
| `masteringInsertParamNames(name)` | The construction keys one insert accepts (band/sub-band processors list their indexed `band{i}.*` keys; an unknown name returns an empty array) |
| `masteringInsertParamInfo(name)` | A full descriptor for every construction key and realtime automation target — see [The parameter descriptor](#the-parameter-descriptor) |
| `masteringProcessorCatalog()` | Machine-readable entries (`kind`, `realtimeInsertable`, `stereoOnly`, `latencySamples`, `tailSamples`, `channelPolicy`, `params`, and slot metadata) for picker/filter UIs. The representative 48 kHz / 512-sample probe reports latency and audible decay tail (both 0 for offline processors); query the live processor for exact configuration-dependent latency. Hosts can filter capabilities without hard-coding processor IDs. |
| `masteringInsertTiming(name, params, sampleRate)` | The exact prepared latency and tail for one insert configuration; pass only finite numbers and booleans in `params` — see [Preset parameters and configured insert timing](./js-api-mastering.md#preset-parameters-and-configured-insert-timing) |
| `capabilityCatalog()` | The build-wide document: every processor with the same descriptors `masteringInsertParamInfo` returns, plus the preset lists, in one read — see [From the catalog to an insert control surface](#from-the-catalog-to-an-insert-control-surface) |

The Python equivalents are `mastering_insert_names()`, `mastering_insert_param_names(name)`, `mastering_insert_param_info(name)`, `mastering_processor_catalog()`, `mastering_insert_timing(name, params, sample_rate)`, and `capability_catalog()`.

Keys outside an insert's list are ignored by the processor and reported through [`Mixer.sceneWarnings()`](./mixing-scene-json.md) when a scene carrying them loads.

### The parameter descriptor

`masteringInsertParamInfo(name)` returns one descriptor for every construction key and every realtime automation target. Every descriptor carries all ten fields; none of them are optional.

| Field | Type | Meaning |
|-------|------|---------|
| `name` | `string` | The JSON key to use in scene insert params |
| `id` | `number` \| `null` | The integer parameter id for realtime automation and MIDI-CC binding, or `null` for a construction-only key |
| `rtSafe` | `boolean` | Whether the value can be changed from the audio thread while the insert runs |
| `type` | `'number'` \| `'boolean'` \| `'enum'` \| `'string'` \| `'array'` | How the config builder reads the key |
| `min` | `number` \| `null` | The smallest accepted value, or `null` when the catalog knows of no limit |
| `max` | `number` \| `null` | The largest accepted value, or `null` when the catalog knows of no limit |
| `default` | `number` \| `boolean` \| `null` | The value used when the key is absent |
| `unit` | `string` \| `null` | The recognized unit — `dB`, `Hz`, `ms`, `samples`, or `referenceSamples@29761Hz` for the plate and Dattorro `modDepthSamples` — or `null` when the catalog has no recognized unit; `null` does not prove the key is dimensionless |
| `choices` | `{ name: string; value: number }[]` \| `null` | A closed named numeric set, including discrete values with gaps, or `null` when no closed set is published |
| `slot` | `string` \| `null` | The processor slot group that owns the key, or `null` when the key belongs to no group |

`unit` is `string | null`, not an optional field: a key whose suffix has no recognized unit reports `null` rather than omitting the key. That includes physical quantities such as `decaySec` or `lengthM`; use the key name and processor documentation when the catalog has no unit. A host can read all ten fields without a presence check. `id: null` identifies a construction-only key; `rtSafe: false` means that live automation is not supported, whether or not an id is present. The recognized unit is read off the key's suffix (`…Db`, `…Hz`, `…Ms`, `…Samples`), so unlike the bounds it is declared rather than measured; the one spelled-out exception exists because that depth is counted at the reverb's internal reference rate, not the session rate. The same `min` / `max` / `default` values appear in `capabilityCatalog()`, and [Reading a catalog bound](./mastering-processors.md#reading-a-catalog-bound) explains where they come from and how far to trust them.

::: info The descriptor list includes construction keys and automation targets
`masteringInsertParamNames(name)` remains the construction-read key list. `masteringInsertParamInfo(name)` now covers that list plus any realtime automation targets. Construction-only rows have `id: null` and `rtSafe: false`; some automation targets can have `rtSafe: false` when the prepared processor cannot change them safely. Build a picker from the parameter names, and enable live controls only for descriptors whose `rtSafe` is true.
:::

## From the catalog to an insert control surface

[What the capability catalog reports](./api-surface.md#what-the-capability-catalog-reports) covers the document itself — which surfaces return it, the ten fields, slot metadata, and how a bound is measured. This section is the insert-specific part: how a host goes from a processor id to a laid-out control surface without keeping a table of its own.

The route is three lookups in the one document rather than a call per processor:

1. **Pick the insert set.** Filter `processors` on `realtimeInsertable`. That is 76 of the 91 entries, and it is the same set `masteringInsertNames()` returns; the other 15 — the 11 offline processors and the 4 pair processors — carry an empty `params` array. `category` groups the set the way a picker does (`effects` is the 18 creative-FX ids on this page; the other categories are the mastering families), and `channelPolicy` says how the mixer wraps the insert on a bus wider than stereo — every reverb, modulation and delay insert is `stereoPairOnly` except `effects.modulation.ringModulator`, which is `multichannel`.
2. **Read the descriptors.** An entry's `params` is exactly the list `masteringInsertParamInfo(id)` returns for that id, in the same order, so a host holding the catalog never needs the per-processor call. Entries with `id: null` are construction-only; non-null ids are the automation ids used by `Mixer.scheduleInsertAutomation(strip, insertIndex, paramId, samplePos, value)` on Node and WASM, `Mixer.schedule_insert_automation(...)` on Python, and `sonare_strip_schedule_insert_automation` on the C ABI. The realtime engine's setters take the `name` instead (`setTrackStripInsertParamByName` and its master and bus variants).
3. **Lay out each control** from `type`, `default`, `min`, `max`, `unit`, and `choices`. Construction-only keys now have descriptors too, so `stages` on the phaser, `attackMs` / `releaseMs` on the auto-wah, `stereoSpread` on the rotary, and room geometry can be represented as build-time fields. Use `slot` to identify a slot group, then read the processor's `slots` entry: `activation` (`anyKey` or `always`), the enclosing `parent`, and `minCrossoverCutoffs` determine whether that group is present.

```typescript
const catalog = capabilityCatalog();
const inserts = catalog.processors.filter((p) => p.realtimeInsertable);   // 76 of 91
const fx = inserts.filter((p) => p.category === 'effects');               // the 18 ids below
const chorus = fx.find((p) => p.id === 'effects.modulation.chorus')!;
for (const param of chorus.params) {
  // param.id is null for construction-only keys; param.name is the scene JSON key
  addControl(param.name, param.default, param.min, param.max, param.unit, param.rtSafe);
  if (param.id !== null && param.rtSafe) {
    bindAutomation(param.id, param.choices, param.slot);
  }
}
```

Four things the effects family reports that a general reading of the document would not lead you to expect:

- **`rtSafe: false` is a hard stop for automation, not a hint.** Scheduling automation on such a parameter returns `NotSupported` (code 6). Construction-only rows are marked with `id: null` and `rtSafe: false`; this page also contains id-bearing targets such as `modDepthSamples` whose prepared processor cannot change them safely. A UI that draws an automation lane per descriptor has to disable every row whose `rtSafe` is false.
- **The catalog has more than numeric toggles.** Effects descriptors include `number`, `boolean`, `enum`, `string`, and `array` types. `choices` can describe enum values or a closed numeric set with gaps. Do not infer a toggle from a name; use `type`, and use `choices` for discrete controls.
- **Latency and tail are per insert, and non-zero for the reverbs.** `effects.reverb.convolution`, `effects.reverb.room` and `effects.acoustic.roomMorph` report 256 samples of latency; the reverbs report tails from 51,217 samples (`room`, `roomMorph`) up to 264,000 (`fdn`), and the stereo delay 59,795, all at the representative 48 kHz probe. `realtimeCost` is `moderate` for every reverb except `velvet`, which is `high`, and `low` for every modulation and delay insert; it is `null` only on the 15 non-inserts.
- **The effects family is small in parameters.** Its 18 processors publish 136 descriptors between them; the per-band EQ processors account for most of the 5,352 (`multiband.dynamicEq` alone has 1,019). An insert UI that sizes itself by descriptor count should expect the two families to differ by an order of magnitude.

### Two things a null and a default do not tell you

**A `null` bound means construction did not refuse, not that any value is meaningful.** An absent bound is literally `null` in the JSON (`None` in Python): the schema types `min` and `max` as `number | null`, and every descriptor carries both keys. Construction-only descriptors can publish bounds when their validation exposes them, while string and array keys generally publish `null`. `effects.modulation.chorus` publishes no bound on `dryWet`, construction accepts `5`, and the processor then clamps its wet mix to `[0, 1]` internally, so `dryWet: 5` renders identically to `dryWet: 1`. The catalog measures what construction rejects; a processor that folds a value instead of rejecting it reports `null`, so a range check against `null` rules out only one kind of mistake. Read a `null` bound as "no validation to lean on", and take the sensible range from the parameter's meaning and unit.

**A default is the config struct's initializer, and a preset is under no obligation to hand it to you.** A construction-only descriptor can have `default: null` when there is no fallback, while a preset or scene can supply that key explicitly. A control surface that initialises from `default` alone can show the wrong value for a loaded scene. Initialise from the scene's own `params`, fall back to the catalog default only for keys the scene does not carry, and treat a `null` default as a value that still needs an explicit scene or user choice.

## Creative-FX insert catalog

In addition to the mastering [solo processors](./mastering-processors.md#solo-processors), builds with creative FX enabled expose reverb, modulation, vowel-filter, delay, and stereo insert IDs:

The `effects` category contains 18 entries; `stereo.binaural` is listed alongside them as a stereo-category insert.

| Insert ID | Meaning |
|-----------|---------|
| `effects.reverb.plate` | Alias for the Dattorro plate-style reverb |
| `effects.reverb.dattorro` | Dattorro reverb |
| `effects.reverb.fdn` | Feedback delay network reverb |
| `effects.reverb.velvet` | Velvet-noise style reverb |
| `effects.reverb.convolution` | Convolution reverb; takes an impulse response as `irF32Base64` in its params, or synthesizes one from `decaySec` and `seed` |
| `effects.reverb.room` | Geometric room reverb synthesized from room parameters |
| `effects.acoustic.roomMorph` | Room-character morph toward a target geometric room |
| `effects.filter.vowel` | Three-band resonant vowel filter with a direct path |
| `effects.modulation.ensemble` | Solina-style BBD string-machine ensemble |
| `effects.modulation.chorus` | Stereo chorus |
| `effects.modulation.flanger` | Flanger |
| `effects.modulation.phaser` | Phaser |
| `effects.modulation.wah` | Tempo-style swept wah filter |
| `effects.modulation.autoWah` | Envelope-following auto-wah filter |
| `effects.modulation.rotary` | Rotary-speaker style pitch/tremolo motion |
| `effects.modulation.ringModulator` | Ring modulator |
| `effects.modulation.pitchShifter` | Simple pitch shifter |
| `effects.delay.stereo` | Stereo delay |
| `stereo.binaural` | Measured-HRTF virtual-speaker renderer for a stereo pair |

::: warning Build-flag gating
These insert IDs are available only in builds configured with the CMake option `BUILD_FX` (which derives the internal `SONARE_HAVE_FX` define). The geometric room inserts (`effects.reverb.room`, `effects.acoustic.roomMorph`) also require `BUILD_ACOUSTIC_SIM`. In a build without an option, the corresponding IDs simply do not appear in `masteringInsertNames()`.
:::

The table below highlights representative keys and behavior; it is intentionally abbreviated. The complete, build-specific list — including newer keys such as chorus/flanger `preFilterHz` and `preFilterMode`, phaser `feedback` and `mixMode`, rotary drum controls, pitch-shifter `windowMs`, and stereo-delay `dampingHz` — is available through [`masteringInsertParamInfo(name)`](#the-parameter-descriptor) or `capabilityCatalog().processors[].params`.

### Vowel filter

<SonareDemo id="vowel-filter" />

`effects.filter.vowel` shapes an existing signal with three resonant bands and a direct path. It is a vowel-colored filter, not a full speech synthesizer, and it has no independent A/B matching stage; use its dry/wet control when you want to compare the filtered and direct paths.

There are a few practical details to know:

| Detail | Meaning |
|--------|---------|
| `effects.reverb.plate` and `effects.reverb.dattorro` | Two names for the same Dattorro processor |
| Reverb params | `decaySec`, `decay`, `damping` / `hfDamping`, `dryWet`, `preDelayMs`, `reverbTimeS`, `densityHz`, `enableShelf` (which apply depend on the algorithm). `effects.reverb.convolution` clamps `decaySec` to its synthesized-tail ceiling of 12 seconds at construction time. The Dattorro/plate insert also accepts `modRateHz` (figure-8 tank LFO — low-frequency oscillator — rate in Hz, default `0.5`) and `modDepthSamples` (modulation depth in samples at the reverb's reference rate, default `6.0`) for its chorused tail. |
| `effects.modulation.chorus` params | `rateHz`, `depthMs`, `centerDelayMs`, `dryWet` |
| `effects.modulation.flanger` params | `rateHz`, `depthMs`, `centerDelayMs`, `feedback`, `dryWet` |
| `effects.modulation.phaser` params | `rateHz`, `minHz`, `maxHz`, `stages`, `dryWet` |
| `effects.modulation.ensemble` params | `rateSlowHz`, `rateFastHz`, `depthSlowMs`, `depthFastMs`, `centerDelayMs`, `toneHz`, `dryWet` |
| `effects.modulation.wah` params | `rateHz`, `minHz`, `maxHz`, `resonance`, `dryWet` |
| `effects.modulation.autoWah` params | `sensitivity`, `minHz`, `maxHz`, `resonance`, `attackMs`, `releaseMs`, `dryWet` |
| `effects.modulation.rotary` params | `rateHz`, `depthMs`, `tremolo`, `stereoSpread`, `dryWet` |
| `effects.modulation.ringModulator` params | `carrierHz`, `dryWet` |
| `effects.modulation.pitchShifter` params | `semitones`, `dryWet` |
| `effects.delay.stereo` params | `delayTimeLMs`, `delayTimeRMs`, `feedback`, `pingPong`, `dryWet` |
| `effects.filter.vowel` params | `vowel`, `accelMs`, `drive`, `driveOn`, `dryWet` |
| `stereo.binaural` params | `azimuthDeg`, `autoTurn`, `turnRateHz`, `clockwise`, `output` (`0` = speakers, `1` = phones), `dryWet` |
| `effects.reverb.convolution` IR | An impulse response (IR — a recording of how a real space responds to a single short burst) is supplied as base64 float32 under the `irF32Base64` key of the insert params, in scene JSON as anywhere else |
| Convolution insert without an IR | Synthesizes a decaying-noise IR from `decaySec` (an RT60-style length, clamped to 12 s) and `seed` when prepared, so it produces a tail like its algorithmic siblings rather than passing the signal through |

::: warning The geometric room inserts validate `absorption`, they do not clamp it
`effects.reverb.room` and `effects.acoustic.roomMorph` take an `absorption` coefficient normalized to `[0, 1]`. A value outside that interval is **rejected**; the insert does not build with the nearest valid figure instead.

Clamping is the friendlier-looking option, and it is the wrong one here. A caller who passes a percentage, a reflection coefficient on another scale, or a dB figure into a normalized field gets a room they did not ask for, and the mistake surfaces only as a tail that is too short or too long. Every other way of supplying the same coefficient — the per-band absorption array on these inserts, and the offline room-impulse synthesis facade — already reports a parameter error, so the scalar path reports one too.
:::

Both geometric room inserts also take the atmospheric-absorption controls: `airAbsorptionEnabled` (off by default), `airTemperatureC`, and `airHumidityPercent`. They resolve the same option bag as the offline facade, so a room built as an insert and the same room built through `synthesizeRir(...)` agree — including the rule that `0` on either climate value selects the ISO reference climate rather than a literal zero. See [Room Acoustics](./acoustic-analysis.md#late-reverb-model-and-tail-controls).

::: details What are these reverb algorithms?
They are different ways to synthesize a reverb tail. Pick by the character you want, not by correctness — all are valid.

- **Plate / Dattorro** — a smooth, dense, classic-studio sound. The Dattorro topology is a widely used plate-style design; `plate` is an alias for it.
- **FDN (feedback delay network)** — a flexible algorithmic reverb built from interconnected delay lines, easy to tune from small rooms to large halls.
- **Velvet-noise** — uses sparse random impulses to build an efficient, natural-sounding tail at low CPU cost.
- **Convolution** — reproduces a *real* space by convolving the signal with a measured impulse response of that room.
:::

::: details What is `effects.modulation.ensemble`?
A Solina-style BBD string-machine ensemble — the lush, chorused tone of vintage string synths. It runs three delay taps per channel, swept simultaneously by a slow and a fast 3-phase LFO bank, so the modulation is dense rather than a single chorus wobble. A BBD bucket-bandwidth lowpass darkens the wet path, emulating the analog bucket-brigade delay lines. The right-channel LFO polarity is inverted, which spreads a mono source into a wide stereo image. It is exposed through the insert factory and its parameters are automatable through `set_parameter` on every binding.
:::

## Inserts that are also one-shot mastering processors

Use these in [Mixing Scene JSON](./mixing-scene-json.md) `insert.processor` fields. In the shipped FX-enabled WASM build, some of them are also one-shot mastering processors: `effects.reverb.plate`, `effects.reverb.dattorro`, `effects.reverb.fdn`, `effects.reverb.velvet`, `effects.reverb.convolution`, `effects.filter.vowel`, `effects.modulation.chorus`, `effects.modulation.flanger`, `effects.modulation.phaser`, `stereo.binaural`, and `effects.delay.stereo` are returned by `masteringProcessorNames()` and run through the one-shot apply path. The geometry-driven insert and the newer modulation inserts — `effects.reverb.room`, `effects.acoustic.roomMorph`, `effects.modulation.ensemble`, `effects.modulation.wah`, `effects.modulation.autoWah`, `effects.modulation.rotary`, `effects.modulation.ringModulator`, and `effects.modulation.pitchShifter` — are insert-only and do **not** appear in `masteringProcessorNames()`; reach them through `masteringInsertNames()` and scene inserts.

## Related

- [Mixing Engine](./mixing.md) — load these as channel-strip/bus inserts
- [Mixing Scene JSON](./mixing-scene-json.md) — the `insert.processor` field reference
- [Mastering Processors](./mastering-processors.md) — the named mastering processor/preset/analysis registry
