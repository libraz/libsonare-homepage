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

Mixer scene inserts use the same processor factory as mastering inserts, but the valid insert set is slightly broader than `masteringProcessorNames()`. Five runtime APIs describe what is available and how to configure it:

| API | Returns |
|-----|---------|
| `masteringInsertNames()` | The full list of valid insert ids |
| `masteringInsertParamNames(name)` | The construction keys one insert accepts (band/sub-band processors list their indexed `band{i}.*` keys; an unknown name returns an empty array) |
| `masteringInsertParamInfo(name)` | A full descriptor for each realtime-automatable parameter — see [The parameter descriptor](#the-parameter-descriptor) |
| `masteringProcessorCatalog()` | Machine-readable entries (`kind`, `realtimeInsertable`, `stereoOnly`, `latencySamples`, `tailSamples`, `channelPolicy`) for picker/filter UIs. The representative 48 kHz / 512-sample probe reports latency and audible decay tail (both 0 for offline processors); query the live processor for exact configuration-dependent latency. Hosts can filter capabilities without hard-coding processor IDs. |
| `capabilityCatalog()` | The build-wide document: every processor with the same descriptors `masteringInsertParamInfo` returns, plus the preset lists, in one read — see [From the catalog to an insert control surface](#from-the-catalog-to-an-insert-control-surface) |

The Python equivalents are `mastering_insert_names()`, `mastering_insert_param_names(name)`, `mastering_insert_param_info(name)`, `mastering_processor_catalog()`, and `capability_catalog()`.

Keys outside an insert's list are ignored by the processor and reported through [`Mixer.sceneWarnings()`](./mixing-scene-json.md) when a scene carrying them loads.

### The parameter descriptor

`masteringInsertParamInfo(name)` returns one descriptor per realtime-automatable parameter. Every descriptor carries all eight fields; none of them are optional.

| Field | Type | Meaning |
|-------|------|---------|
| `name` | `string` | The JSON key to use in scene insert params |
| `id` | `number` | The integer parameter id for realtime automation and MIDI-CC binding |
| `rtSafe` | `boolean` | Whether the value can be changed from the audio thread while the insert runs |
| `type` | `'number'` \| `'boolean'` | How the config builder reads the key |
| `min` | `number` \| `null` | The smallest accepted value, or `null` when the catalog knows of no limit |
| `max` | `number` \| `null` | The largest accepted value, or `null` when the catalog knows of no limit |
| `default` | `number` \| `boolean` \| `null` | The value used when the key is absent |
| `unit` | `string` \| `null` | The physical unit — `dB`, `Hz`, `ms`, `samples`, or `referenceSamples@29761Hz` for the plate and Dattorro `modDepthSamples` — or `null` when the parameter is unitless |

`unit` is `string | null`, not an optional field: a unitless parameter reports `null` rather than omitting the key, so a host can read all eight fields off every descriptor without a presence check. The unit is read off the key's suffix (`…Db`, `…Hz`, `…Ms`, `…Samples`), so unlike the bounds it is declared rather than measured; the one spelled-out exception exists because that depth is counted at the reverb's internal reference rate, not the session rate. The same `min` / `max` / `default` values appear in `capabilityCatalog()`, and [Reading a catalog bound](./mastering-processors.md#reading-a-catalog-bound) explains where they come from and how far to trust them.

::: info The descriptor list is narrower than the construction key list
`masteringInsertParamNames(name)` lists every key an insert accepts at construction. `masteringInsertParamInfo(name)` covers only the subset that can be automated afterwards, so a key that has to be fixed when the insert is built — a topology choice, a supplied impulse response, the rate that impulse response was captured at — has no descriptor at all. `saturation.ampSim` is the widest gap: most of its cabinet and microphone keys are construction-only. Build a picker from the param names and an automation surface from the descriptors; they are not the same list.
:::

## From the catalog to an insert control surface

[What the capability catalog reports](./api-surface.md#what-the-capability-catalog-reports) covers the document itself — which surfaces return it, the eight fields, and how a bound is measured. This section is the insert-specific part: how a host goes from a processor id to a laid-out control surface without keeping a table of its own.

The route is three lookups in the one document rather than a call per processor:

1. **Pick the insert set.** Filter `processors` on `realtimeInsertable`. That is 73 of the 88 entries, and it is the same set `masteringInsertNames()` returns; the other 15 — the 11 offline processors and the 4 pair processors — carry an empty `params` array, so every one of the catalog's 1,147 parameters belongs to an insert. `category` groups the set the way a picker does (`effects` is the 17 creative-FX ids on this page; the other categories are the mastering families), and `channelPolicy` says how the mixer wraps the insert on a bus wider than stereo — every reverb, modulation and delay insert is `stereoPairOnly`, meaning it processes the front pair and leaves further channels untouched.
2. **Read the descriptors.** An entry's `params` is exactly the list `masteringInsertParamInfo(id)` returns for that id, in the same order, so a host holding the catalog never needs the per-processor call. Ids run `0..n-1` in that order — `dryWet` is id 3 on `effects.modulation.chorus` and id 4 on `effects.delay.stereo` — and the integer is what the mixer's automation scheduler takes: `Mixer.scheduleInsertAutomation(strip, insertIndex, paramId, samplePos, value)` on Node and WASM, `Mixer.schedule_insert_automation(...)` on Python, `sonare_strip_schedule_insert_automation` on the C ABI. The realtime engine's setters take the `name` instead (`setTrackStripInsertParamByName` and its master and bus variants).
3. **Lay out each control** from `type`, `default`, `min`, `max` and `unit`. The construction-only keys that `masteringInsertParamNames(id)` lists and the catalog does not — `stages` on the phaser, `attackMs` / `releaseMs` on the auto-wah, `stereoSpread` on the rotary, the room geometry — get a build-time field rather than a live control, since there is no descriptor to size one from.

```typescript
const catalog = capabilityCatalog();
const inserts = catalog.processors.filter((p) => p.realtimeInsertable);   // 73 of 88
const fx = inserts.filter((p) => p.category === 'effects');               // the 17 ids below
const chorus = fx.find((p) => p.id === 'effects.modulation.chorus')!;
for (const param of chorus.params) {
  // param.id is the automation id; param.name is the scene JSON key
  addControl(param.name, param.default, param.min, param.max, param.unit, param.rtSafe);
}
```

Four things the effects family reports that a general reading of the document would not lead you to expect:

- **`rtSafe: false` is a hard stop for automation, not a hint.** Scheduling automation on such a parameter returns `NotSupported` (code 6); the value has to be set at construction. Of the 81 parameters that report it, five are on this page — `decay`, `reverbTimeS` and `densityHz` on `effects.reverb.velvet`, and `modDepthSamples` on `effects.reverb.plate` and `effects.reverb.dattorro` — and 72 of the rest are the bands of `eq.linearPhase`. A UI that draws an automation lane per descriptor has to disable those.
- **Only two parameters in the whole catalog are `boolean`**, both on `dynamics.compressor` (`autoMakeup`, `sidechainHpfEnabled`). The delay's `pingPong` is a `number` with default `0`, and the switches on this page that read like booleans — `enableShelf`, `airAbsorptionEnabled` — are construction keys with no descriptor at all. Do not infer a toggle from a name.
- **Latency and tail are per insert, and non-zero for the reverbs.** `effects.reverb.convolution`, `effects.reverb.room` and `effects.acoustic.roomMorph` report 256 samples of latency; the reverbs report tails from 51,217 samples (`room`, `roomMorph`) up to 264,000 (`fdn`), and the stereo delay 59,795, all at the representative 48 kHz probe. `realtimeCost` is `moderate` for every reverb except `velvet`, which is `high`, and `low` for every modulation and delay insert; it is `null` only on the 15 non-inserts.
- **The effects family is small in parameters.** Its 17 processors publish 64 descriptors between them; the per-band EQ processors account for most of the 1,147 (`multiband.dynamicEq` alone has 264). An insert UI that sizes itself by descriptor count should expect the two families to differ by an order of magnitude.

### Two things a null and a default do not tell you

**A `null` bound means construction did not refuse, not that any value is meaningful.** An absent bound is literally `null` in the JSON (`None` in Python): the schema types `min` and `max` as `number | null`, and every descriptor carries both keys. Across the 64 effects descriptors only `effects.acoustic.roomMorph` publishes a bound at all (`dryWet` and `sourceTailSuppression`, both `[0, 1]`); the other 62 publish `null` on both sides, and not because they accept anything. `effects.modulation.chorus` publishes no bound on `dryWet`, construction accepts `5`, and the processor then clamps its wet mix to `[0, 1]` internally, so `dryWet: 5` renders identically to `dryWet: 1`. The catalog measures what construction rejects; a processor that folds a value instead of rejecting it reports `null`, so a range check against `null` rules out only one kind of mistake. Read a `null` bound as "no validation to lean on", and take the sensible range from the parameter's meaning and unit.

**A default is the config struct's initializer, and a preset is under no obligation to hand it to you.** The built-in `vocalReverbSend` scene gives `effects.reverb.plate` `decaySec: 1.8` and `preDelayMs: 25` — two construction-only keys with no descriptor and therefore no catalog default at all — while `drumBusSubgroup` sets `dynamics.parallelComp` to `thresholdDb: -20` and `mix: 0.35` against catalog defaults of `-18` and `0.5`, and `saturation.tape` to `driveDb: 1.5` against `3`. A control surface that initialises from `default` shows the wrong value for a loaded scene. Initialise from the scene's own `params`, fall back to the catalog default only for keys the scene does not carry, and allow for a key the scene sets having no descriptor to fall back through.

## Creative-FX insert catalog

In addition to the mastering [solo processors](./mastering-processors.md#solo-processors), builds with creative FX enabled expose reverb, modulation, and delay insert IDs:

| Insert ID | Meaning |
|-----------|---------|
| `effects.reverb.plate` | Alias for the Dattorro plate-style reverb |
| `effects.reverb.dattorro` | Dattorro reverb |
| `effects.reverb.fdn` | Feedback delay network reverb |
| `effects.reverb.velvet` | Velvet-noise style reverb |
| `effects.reverb.convolution` | Convolution reverb; takes an impulse response as `irF32Base64` in its params, or synthesizes one from `decaySec` and `seed` |
| `effects.reverb.room` | Geometric room reverb synthesized from room parameters |
| `effects.acoustic.roomMorph` | Room-character morph toward a target geometric room |
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

::: warning Build-flag gating
These insert IDs are available only in builds configured with the CMake option `BUILD_FX` (which derives the internal `SONARE_HAVE_FX` define). The geometric room inserts (`effects.reverb.room`, `effects.acoustic.roomMorph`) also require `BUILD_ACOUSTIC_SIM`. In a build without an option, the corresponding IDs simply do not appear in `masteringInsertNames()`.
:::

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
| `effects.reverb.convolution` IR | An impulse response (IR — a recording of how a real space responds to a single short burst) is supplied as base64 float32 under the `irF32Base64` key of the insert params, in scene JSON as anywhere else; a native host can also inject one directly at construction |
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

Use these in [Mixing Scene JSON](./mixing-scene-json.md) `insert.processor` fields. In the shipped FX-enabled WASM build, some of them are also one-shot mastering processors: `effects.reverb.plate`, `effects.reverb.dattorro`, `effects.reverb.fdn`, `effects.reverb.velvet`, `effects.reverb.convolution`, `effects.modulation.chorus`, `effects.modulation.flanger`, `effects.modulation.phaser`, and `effects.delay.stereo` are returned by `masteringProcessorNames()` and run through the one-shot apply path. The geometry-driven inserts and the newer modulation inserts — `effects.reverb.room`, `effects.acoustic.roomMorph`, `effects.modulation.ensemble`, `effects.modulation.wah`, `effects.modulation.autoWah`, `effects.modulation.rotary`, `effects.modulation.ringModulator`, and `effects.modulation.pitchShifter` — are insert-only and do **not** appear in `masteringProcessorNames()`; reach them through `masteringInsertNames()` and scene inserts.

## Related

- [Mixing Engine](./mixing.md) — load these as channel-strip/bus inserts
- [Mixing Scene JSON](./mixing-scene-json.md) — the `insert.processor` field reference
- [Mastering Processors](./mastering-processors.md) — the named mastering processor/preset/analysis registry
