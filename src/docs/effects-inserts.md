---
title: Effects Inserts
description: The creative-FX insert catalog for the libsonare mixing and realtime engine — reverb, modulation, delay, and saturation inserts with their parameter tables and build-flag gating, distinct from the named mastering processor registry.
---

# Effects Inserts

**Effects inserts** are the creative-FX processors you load into mixer channel-strip and bus slots (and realtime engine inserts): reverbs, modulation effects, delays, and saturation pedals. They are built through the same insert factory that the [Mixing Engine](./mixing.md) uses for every channel-strip insert.

::: info Inserts are not mastering processors
This page catalogs **mixer/engine inserts**. The named [Mastering Processors](./mastering-processors.md) registry — compressors, EQ, saturation, stereo, repair, and the loudness/maximizer stages — is a separate topic with its own scope. The two overlap: every FX insert is *also* a one-shot mastering processor. If you are looking for the mastering registry, start on that page instead.
:::

An insert sits *in* the channel path, so every later stage sees its output: for a pre-fader insert that is the fader, the sends, and the bus; for a post-fader insert it is the post-fader sends and the bus. That position is what separates an insert from a send (see [Inserts vs sends](./mixing.md#inserts-vs-sends)), and it is the first thing to be sure of before reading the catalog below.

The demo below makes the same tap-point distinction audible on sends: drag the fader and hear which paths follow it and which do not.

<SonareDemo id="pre-post-fader" />


The page starts with the catalog and what each family of effects does, then covers the descriptor API that lets a host build controls for any insert without a table of its own.

## Creative-FX insert catalog

In addition to the mastering [solo processors](./mastering-processors.md#solo-processors), builds with creative FX enabled expose reverb, modulation, vowel-filter, delay, and stereo insert IDs:

`stereo.binaural` is listed alongside the `effects` category as a stereo-category insert.

| Insert ID | Meaning |
|-----------|---------|
| `effects.reverb.plate` | Alias for the Dattorro plate-style reverb |
| `effects.reverb.dattorro` | Dattorro reverb |
| `effects.reverb.fdn` | Feedback delay network reverb |
| `effects.reverb.velvet` | Velvet-noise style reverb |
| `effects.reverb.convolution` | Convolution reverb; takes an impulse response as `irF32Base64` in its params, or synthesizes one from `decaySec` and `seed` |
| `effects.reverb.room` | Geometric room reverb synthesized from room parameters |
| `effects.acoustic.roomMorph` | Room-character morph toward a target geometric room |
| `effects.gsEfx` | GS insertion-effect unit with a selected type and 20 raw parameter bytes |
| `saturation.overdrive` | Overdrive pedal with gain, tone, and output level |
| `saturation.distortion` | Distortion pedal with gain, tone, and output level |
| `effects.filter.vowel` | Three-band resonant vowel filter with a direct path |
| `effects.modulation.ensemble` | BBD string-machine ensemble |
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

### Effect families and what their keys mean

Most of these effects are built from a few shared ideas, and the parameter names follow them.

**Reverbs** synthesize the tail a room adds after a sound. They differ in how they build it, so pick by character rather than by correctness:

- **Plate / Dattorro** — a smooth, dense, classic-studio sound. The Dattorro topology is a widely used plate-style design; `plate` is an alias for it.
- **FDN (feedback delay network)** — interconnected delay lines feeding back into each other, easy to tune from small rooms to large halls.
- **Velvet-noise** — builds the tail from sparse random impulses. The catalog rates this implementation's `realtimeCost` as `high`, the only reverb above `moderate`.
- **Convolution** — reproduces a *real* space by convolving the signal with a measured impulse response of that room.
- **Geometric room** — computes the response from a room's dimensions and the source and listener positions ([below](#geometric-room-inserts)).

Their common keys: `decaySec` (or a normalized `decay`) sets how long the tail lasts; `damping` / `hfDamping` makes high frequencies die away sooner, the way soft furnishings absorb treble; `preDelayMs` is the gap between the dry sound and the start of the tail, which keeps a vocal clear of its own reverb; `dryWet` is the share of the processed signal, set to `1` on a send-return strip.

<SonareDemo id="room-decay" />

**Modulated delays** (chorus, flanger, ensemble) mix the signal with a copy delayed by a few milliseconds and sweep that delay with a low-frequency oscillator (LFO). `centerDelayMs` is the average delay, `depthMs` how far the LFO swings it, and `rateHz` how fast. The delay range decides the effect. A chorus sits around 10–30 ms (the default here is 14 ms ± 6 ms), long enough to sound like a second, slightly detuned player. A flanger sits around 1–10 ms (default 3 ms ± 2 ms), where the copy combs the spectrum into a sweeping, jet-like notch pattern; its `feedback` routes part of the output back into the delay to sharpen those notches.

**Phaser** sweeps a chain of all-pass `stages` between `minHz` and `maxHz`, which produces a few broad notches rather than the flanger's dense comb. **Wah** and **auto-wah** sweep one resonant band-pass filter; the auto-wah follows the input level (`sensitivity`, `attackMs`, `releaseMs`) instead of an LFO.

**Delay** (`effects.delay.stereo`) repeats the signal after `delayTimeLMs` / `delayTimeRMs`. `feedback` is how much of each repeat comes back for another, so `0` gives one echo and values toward `1` give long trails; `pingPong` bounces the repeats between the channels.

**Ring modulator** multiplies the signal by a sine at `carrierHz`, which replaces each frequency with a pair of sum and difference tones: metallic, bell-like, or robotic. **Pitch shifter** moves the whole signal by `semitones`.

### Parameters by insert

This list is partial: it shows the common keys of each insert. [`masteringInsertParamInfo(name)`](#the-parameter-descriptor) and `capabilityCatalog().processors[].params` are complete and cover further keys such as chorus/flanger `preFilterHz` and `preFilterMode`, phaser `feedback` and `mixMode`, rotary drum controls, pitch-shifter `windowMs`, and stereo-delay `dampingHz`.

| Insert | Common keys |
|--------|-------------|
| Reverbs (which keys apply depends on the algorithm) | `decaySec`, `decay`, `damping` / `hfDamping`, `dryWet`, `preDelayMs`, `reverbTimeS`, `densityHz`, `enableShelf` |
| `effects.reverb.dattorro` / `plate` | the reverb keys, plus `modRateHz` (rate of the figure-8 tank low-frequency oscillator, default `0.5`) and `modDepthSamples` (modulation depth in samples at the reverb's internal reference rate, default `6.0`) for the chorused tail |
| `effects.reverb.convolution` | `irF32Base64` (an impulse response, a recording of how a real space responds to one short burst, as base64 float32, in scene JSON as anywhere else), `decaySec`, `seed`. Without an impulse response it synthesizes a decaying-noise one from `decaySec` (an RT60-style length, clamped to 12 s) and `seed` when prepared, so it produces a tail like its algorithmic siblings instead of passing the signal through |
| `effects.modulation.chorus` | `rateHz`, `depthMs`, `centerDelayMs`, `dryWet` |
| `effects.modulation.flanger` | `rateHz`, `depthMs`, `centerDelayMs`, `feedback`, `dryWet` |
| `effects.modulation.phaser` | `rateHz`, `minHz`, `maxHz`, `stages`, `dryWet` |
| `effects.modulation.ensemble` | `rateSlowHz`, `rateFastHz`, `depthSlowMs`, `depthFastMs`, `centerDelayMs`, `toneHz`, `dryWet` |
| `effects.modulation.wah` | `rateHz`, `minHz`, `maxHz`, `resonance`, `dryWet` |
| `effects.modulation.autoWah` | `sensitivity`, `minHz`, `maxHz`, `resonance`, `attackMs`, `releaseMs`, `dryWet` |
| `effects.modulation.rotary` | `rateHz`, `depthMs`, `tremolo`, `stereoSpread`, `dryWet` |
| `effects.modulation.ringModulator` | `carrierHz`, `dryWet` |
| `effects.modulation.pitchShifter` | `semitones`, `dryWet` |
| `effects.delay.stereo` | `delayTimeLMs`, `delayTimeRMs`, `feedback`, `pingPong`, `dryWet` |
| `effects.filter.vowel` | `vowel`, `accelMs`, `drive`, `driveOn`, `dryWet` |
| `stereo.binaural` | `azimuthDeg`, `autoTurn`, `turnRateHz`, `clockwise`, `output` (`0` = speakers, `1` = phones), `dryWet` |

`effects.reverb.convolution` clamps `decaySec` to its synthesized-tail ceiling of 12 seconds at construction time.

### GS EFX (`effects.gsEfx`)

`effects.gsEfx` is the standalone GS insertion-effect unit. It is included only when the library is built with `BUILD_FX`; otherwise the name is absent from `masteringInsertNames()` and cannot be passed to `masteringProcess()` or an insert slot.

The factory takes a flat numeric parameter object. If both `typeMsb` and `typeLsb` are omitted, the type is `0` (thru). To select another type, supply both selectors as integers in `0..127`; supplying only one is rejected, and the pair selects `(typeMsb << 8) | typeLsb`. A non-zero type must be known by the build. `realization` is optional and is `0` for modern (the default) or `1` for classic. `byte0` through `byte19` are optional raw GS parameter bytes, each in `0..127`; omitted bytes use the selected type's defaults, and values that the selected type does not accept are rejected.

```typescript
const processed = masteringProcess('effects.gsEfx', samples, sampleRate, {
  typeMsb: 0x01,
  typeLsb: 0x10,
  realization: 0,
  byte0: 64,
  byte19: 127,
});
```

The same parameter object is used when the processor is constructed as a mixer or realtime insert. Use `masteringInsertParamInfo('effects.gsEfx')` or the capability catalog for the descriptors published by the current build.

### Saturation pedals

`saturation.overdrive` and `saturation.distortion` are realtime-safe, multichannel inserts. They are also named solo processors, so a host can use the same parameter map with `masteringProcess(...)`. The bounds, defaults, and timing below are the values in the capability catalog.

| Insert | Parameter | Accepted range | Default | Unit |
|--------|-----------|----------------|---------|------|
| `saturation.overdrive` | `gainDb` | `0`–`41` | `20` | dB |
|  | `toneHz` | `500`–`8000` | `3000` | Hz |
|  | `levelDb` | no catalog minimum; maximum `770.636` | `0` | dB |
| `saturation.distortion` | `gainDb` | `0`–`60` | `30` | dB |
|  | `toneHz` | `475`–`20000` | `4000` | Hz |
|  | `levelDb` | no catalog minimum; maximum `770.636` | `0` | dB |

Each reports `48` samples of latency and a tail of 10,513 (overdrive) or 15,793 (distortion) samples at 48 kHz. All three parameters have realtime automation ids and are safe to change while the insert runs. The large `levelDb` maximum is the finite-gain limit, rounded inward; it is not a useful musical range.

### Vowel filter

<SonareDemo id="vowel-filter" />

`effects.filter.vowel` shapes an existing signal with three resonant bands and a direct path. It is a vowel-colored filter, not a full speech synthesizer, and it has no independent A/B matching stage; use its dry/wet control when you want to compare the filtered and direct paths.

### Dry/wet mix law

Nine catalog entries expose the enum `mixLaw`: `effects.delay.stereo`, `effects.modulation.chorus`, `effects.modulation.flanger`, `effects.modulation.ensemble`, `effects.modulation.pitchShifter`, `effects.modulation.ringModulator`, `effects.reverb.dattorro`, its alias `effects.reverb.plate`, and `saturation.bitcrusher`.

| Choice | Dry gain | Wet gain |
|---|---|---|
| `crossfade` (`0`) | `1 - w` | `w` |
| `twoRamps` (`1`) | `min(1, 2 * (1 - w))` | `min(1, 2 * w)` |

Here `w` is `dryWet` in `[0, 1]`. At `0.5`, crossfade gives each path half gain, while twoRamps gives both unity gain, so correlated paths can sound louder. The current catalog reports `crossfade` as the default for each of these nine entries. Read each processor's `mixLaw` descriptor for its `default`, `choices`, and automation id when building a control.

::: details What is `effects.modulation.ensemble`?
A bucket-brigade-delay string-machine ensemble, the lush chorused tone of vintage string synths. It runs three delay taps per channel, swept simultaneously by a slow and a fast 3-phase LFO bank, so the modulation is dense rather than a single chorus wobble. A BBD bucket-bandwidth lowpass darkens the wet path, emulating the analog bucket-brigade delay lines. The right-channel LFO polarity is inverted, which spreads a mono source into a wide stereo image. It is exposed through the insert factory and its parameters are automatable through `set_parameter` on every binding.
:::

### Geometric room inserts

`effects.reverb.room` and `effects.acoustic.roomMorph` are driven by room geometry rather than a decay time: a shoebox room, a source position and a listener position. The table lists the room insert's descriptors as the capability catalog publishes them; every geometry and air-absorption key is construction-only, and only `dryWet` has a realtime automation id.

| Parameter | Accepted range | Default | Unit |
|-----------|----------------|---------|------|
| `dryWet` | none published | `0.35` | none |
| `lengthM` | `5.15`–`10000` | `7` | m |
| `widthM` | `4.2`–`10000` | `5` | m |
| `heightM` | `1.7`–`10000` | `3` | m |
| `sourceX` / `sourceY` / `sourceZ` | `0` and up | `1` / `1` / `1.2` | m |
| `listenerX` / `listenerY` / `listenerZ` | `0.242391`–`6.88648` / `0.24567`–`4.81918` / `0` and up | `5` / `4` / `1.7` | m |
| `absorption` | `0`–`1`, validated | `0.2` | none |
| `ismOrder` | no catalog bounds (negative values are treated as `0`) | `3` | count |
| `maxSeconds` | `0`–`600`; `0` sizes the response from the RT60 | `0` | s |
| `seed` | no catalog bounds | `1` | none |
| `receiverSpacingM` | `0`–`2.5` in the catalog at the default geometry (see below); `0` selects 0.5 m | `0` | m |
| `airAbsorptionEnabled` | boolean | `false` | none |
| `airTemperatureC` / `airHumidityPercent` | no catalog bounds; `0` selects the ISO reference climate | `0` | degC / percent |

The `effects.acoustic.roomMorph` insert takes the same geometry, receiver and air keys, with `dryWet` defaulting to `0.5`, plus `sourceTailSuppression` (`0`–`1`, default `0.5`, realtime automation id `1`), `crossfadeMs` (`0`–`1000`), `mixingTimeMs` (`0`–`10000`), `preferEyring`, `materialPreset`, and the `bandAbsorption` / `bandScattering` arrays. Its `ismOrder` has a catalog minimum of `0`. The listener minimum and maximum above are measured at the default room and spacing, so they move with `lengthM`, `widthM` and `receiverSpacingM`.

::: warning The geometric room inserts validate `absorption`, they do not clamp it
`effects.reverb.room` and `effects.acoustic.roomMorph` take an `absorption` coefficient normalized to `[0, 1]`. A value outside that interval is **rejected**; the insert does not build with the nearest valid figure instead.

Clamping is the friendlier-looking option, and it is the wrong one here. A caller who passes a percentage, a reflection coefficient on another scale, or a dB figure into a normalized field gets a room they did not ask for, and the mistake surfaces only as a tail that is too short or too long. Every other way of supplying the same coefficient — the per-band absorption array on these inserts, and the offline room-impulse synthesis facade — already reports a parameter error, so the scalar path reports one too.
:::

Both geometric room inserts refuse, with InvalidParameter, a placement that puts either receiver of the stereo pair outside the room, so a listener closer to a side wall than half the receiver spacing is refused even on a mono strip. The catalog's measured bounds follow: `listenerX` and `listenerY` publish a minimum and maximum inside the walls, and the minimum `lengthM` and `widthM` are raised accordingly. The library refuses rather than moves such a listener, since a moved listener is a different room sound; a listener inside `[s/2, lengthM - s/2]` × `[s/2, widthM - s/2]`, with `s` the receiver spacing, always builds, so move a refused saved scene's listener into that range. On a stereo strip each channel is convolved with the target room heard at its own receiver of a spaced pair (`receiverSpacingM`, 0 or omitted for 0.5 m, up to 4 m if both receivers fit inside the room), so the added room is not centered and identical in both channels; the late tails follow the diffuse-field coherence of two points that far apart. A mono strip keeps the single-listener response. The offline mono `roomMorph` does not place the pair and accepts such a placement.

Both geometric room inserts also take the atmospheric-absorption controls: `airAbsorptionEnabled` (off by default), `airTemperatureC`, and `airHumidityPercent`. They resolve the same option bag as the offline facade, so a room built as an insert and the same room built through `synthesizeRir(...)` agree — including the rule that `0` on either climate value selects the ISO reference climate rather than a literal zero. See [Room Acoustics](./acoustic-analysis.md#late-reverb-model-and-tail-controls).

**The catalog's 2.5 m is the default room's limit.** The `receiverSpacingM` descriptor publishes a maximum of 2.5 m because, like the listener bounds, it is measured at the defaults: in the 7 × 5 m room with the source at (1, 1) and the listener at (5, 4), the pair sits across the source direction and one receiver reaches the side wall at 2.5 m. The range moves with the room and the placement, which `dependsOn` cannot express, so the descriptor names them in `coupledWith`: `receiverSpacingM` lists `lengthM`, `widthM`, `listenerX`, `listenerY`, `sourceX` and `sourceY`, and `listenerX` lists `listenerY`, `receiverSpacingM`, `sourceX` and `sourceY` beside its `dependsOn` entry on `lengthM`. When a control for one of these keys changes, re-read the descriptor for the bound that applies to the new values, or treat the published bound as the default setup's. What the engine enforces is the range the offline room functions share: a spacing in (0, 4] m whose two receivers both fit inside the room. In a 20 × 15 m room, 3 m and 4 m spacings build and render through `masteringProcess(...)`, and 4.5 m is refused with InvalidParameter.

For what the receiver spacing changes in the sound, see [Spaced Receivers and Coherence](./glossary/acoustics/spaced-receivers.md).

## Inserts that are also one-shot mastering processors

Use these ids in [Mixing Scene JSON](./mixing-scene-json.md) `insert.processor` fields. In the shipped FX-enabled WASM build every insert id, including the geometry-driven `effects.reverb.room` and `effects.acoustic.roomMorph` and the modulation inserts (`effects.modulation.ensemble`, `wah`, `autoWah`, `rotary`, `ringModulator`, and `pitchShifter`), is returned by `masteringProcessorNames()` and runs through the one-shot apply path, so one parameter map works in a mixer chain, a realtime engine, or `masteringProcess(...)`. A one-shot call reports the insert's latency in `latencySamples` (256 for the convolution and geometric room inserts).

## Discovering the insert set

Mixer scene inserts use the same processor factory as mastering inserts. Every insert id is also a name in `masteringProcessorNames()`; the reverse does not hold, because seven offline processors (`final.bitDepth`, `final.dither`, `final.outputChain`, `maximizer.loudnessOptimize`, `repair.declick`, `repair.declip`, and `repair.trimSilence`) run only as one-shot calls. Six runtime APIs describe what is available and how to configure it:

| API | Returns |
|-----|---------|
| `masteringInsertNames()` | The full list of valid insert ids |
| `masteringInsertParamNames(name)` | The construction keys one insert accepts (band/sub-band processors list their indexed `band{i}.*` keys; an unknown name returns an empty array) |
| `masteringInsertParamInfo(name, sampleRate?)` | A full descriptor for every construction key and realtime automation target — see [The parameter descriptor](#the-parameter-descriptor). Pass `sampleRate` to resolve a Nyquist-bounded ceiling for that processing rate |
| `masteringProcessorCatalog()` | Machine-readable entries (`kind`, `realtimeInsertable`, `stereoOnly`, `latencySamples`, `tailSamples`, `channelPolicy`, `params`, and slot metadata) for picker/filter UIs. The representative 48 kHz / 512-sample probe reports latency and audible decay tail (both 0 for offline processors); query the live processor for exact configuration-dependent latency. Hosts can filter capabilities without hard-coding processor IDs. |
| `masteringInsertTiming(name, params, sampleRate)` | The exact prepared latency and tail for one insert configuration; `params` takes every value type the insert's descriptor declares (numbers, booleans, enum names, strings, number arrays) — see [Preset parameters and configured insert timing](./js-api-mastering.md#preset-parameters-and-configured-insert-timing) |
| `capabilityCatalog()` | The build-wide document: every processor with the same descriptors `masteringInsertParamInfo` returns, plus the chain-key section and the preset lists, in one read — see [From the catalog to an insert control surface](#from-the-catalog-to-an-insert-control-surface) |

The Python equivalents are `mastering_insert_names()`, `mastering_insert_param_names(name)`, `mastering_insert_param_info(name, sample_rate=...)`, `mastering_processor_catalog()`, `mastering_insert_timing(name, params, sample_rate)`, and `capability_catalog()`.

Keys outside an insert's list are ignored by the processor and reported through [`Mixer.sceneWarnings()`](./mixing-scene-json.md) when a scene carrying them loads.

### The parameter descriptor

`masteringInsertParamInfo(name)` returns one descriptor for every construction key and every realtime automation target. Every descriptor carries all eighteen fields; none of them are optional.

| Field | Type | Meaning |
|-------|------|---------|
| `name` | `string` | The JSON key to use in scene insert params |
| `id` | `number` \| `null` | The integer parameter id for realtime automation and MIDI-CC binding, or `null` for a construction-only key |
| `rtSafe` | `boolean` | Whether the value can be changed from the audio thread while the insert runs |
| `type` | `'number'` \| `'boolean'` \| `'enum'` \| `'string'` \| `'array'` | How the config builder reads the key |
| `min` | `number` \| `null` | The smallest accepted value, or `null` when the catalog knows of no limit |
| `max` | `number` \| `null` | The largest accepted value, or `null` when the catalog knows of no limit |
| `minExclusive`, `maxExclusive` | `boolean` | Whether the bound itself is refused (`true`) or accepted |
| `maxRelativeTo` | `'nyquist'` \| `null` | `'nyquist'` marks a ceiling bounded by the processing rate; the effective ceiling is the lower of `max` and the Nyquist. Pass `sampleRate` to `masteringInsertParamInfo` to resolve it |
| `default` | `number` \| `boolean` \| `null` | The value used when the key is absent |
| `unit` | `string` \| `null` | The unit the processor reads the key in, from a closed set (below), or `null` for a boolean, enum, string, or array key |
| `scale` | `'linear'` \| `'log'` | The axis a slider should use |
| `uiMin`, `uiMax` | `number` \| `null` | An optional display range inside `[min, max]`; `null` when the library declares none. On a logarithmic axis (`scale: 'log'`), `uiMin ?? min` is always positive and `uiMax ?? max` always finite; a `null` side means the accepted bound already serves as the display end |
| `dependsOn` | `{ key: string; relation: 'lt' \| 'le' \| 'ge' \| 'gt'; factor: number }[]` | Sibling keys whose live value bounds this one, read as `this <relation> factor * sibling`; `factor` is 1 for a plain ordering such as `cutoff0Hz` below `cutoff1Hz` |
| `coupledWith` | `string[]` | Siblings, beyond the `dependsOn` entries, whose value moves this key's accepted range in a way `dependsOn` cannot state; `min` / `max` are measured with them at their defaults. Empty for an independent key |
| `choices` | `{ name: string; value: number }[]` \| `null` | A closed named numeric set, including discrete values with gaps, or `null` when no closed set is published. A mixer scene's `params` take the number (`value`), not the name |
| `slot` | `string` \| `null` | The processor slot group that owns the key, or `null` when the key belongs to no group |

`unit` is one of `dB`, `dBFS`, `LUFS`, `Hz`, `ms`, `s`, `samples`, `m`, `cm`, `mm`, `deg`, `percent`, `degC`, `V`, `inPerSec`, `dBPerOct`, `semitones`, `cents`, `ratio`, `bits`, `count`, or `none` (a dimensionless number). It is declared by the processor that consumes the key, not inferred from the key's spelling, so `decaySec` reports `s`, `lengthM` reports `m`, and the plate and Dattorro `modDepthSamples` reports `samples`. `null` appears only on non-numeric keys. A host can read all eighteen fields without a presence check. `id: null` identifies a construction-only key; `rtSafe: false` means that live automation is not supported, whether or not an id is present. The same fields appear in `capabilityCatalog()`, and [Reading a catalog bound](./mastering-processors.md#reading-a-catalog-bound) explains where `min` / `max` / `default` come from and how far to trust them. Bounds, display ranges, and `dependsOn` describe construction-time acceptance; the realtime parameter path clamps. Published bounds are rounded inward, so a published limit is always a value the insert accepts.

::: info The descriptor list includes construction keys and automation targets
`masteringInsertParamNames(name)` remains the construction-read key list. `masteringInsertParamInfo(name)` covers that list plus any realtime automation targets. Construction-only rows have `id: null` and `rtSafe: false`; some automation targets can have `rtSafe: false` when the prepared processor cannot change them safely. Build a picker from the parameter names, and enable live controls only for descriptors whose `rtSafe` is true.
:::

A frequency key bounded by the processing rate publishes `maxRelativeTo: 'nyquist'` together with a `max` that holds at the default rate. Pass the session rate to get the ceiling that applies there:

```typescript
const band = (rate?: number) =>
  masteringInsertParamInfo('eq.parametric', rate).find((p) => p.name === 'band0.frequencyHz')!;
band().max;       // 24000 (exclusive)
band(44100).max;  // 22050 (exclusive)
band(96000).max;  // 48000 (exclusive)
```

## From the catalog to an insert control surface

[Capability Catalog](./capability-catalog.md) covers the document itself — which surfaces return it, the descriptor fields, slot metadata, and how a bound is measured. This section is the insert-specific part: how a host goes from a processor id to a laid-out control surface without keeping a table of its own.

The route is three lookups in the one document rather than a call per processor:

1. **Pick the insert set.** Filter `processors` on `realtimeInsertable`; that is the same set `masteringInsertNames()` returns. The other entries are the seven offline processors and four pair processors. `category` groups the set the way a picker does: `effects` is the creative-FX ids on this page, `voice` holds the `voice.changer` insert, and the other categories are the mastering families. Three entry fields decide how a picker treats an insert:

   | Field | Reading |
   |---|---|
   | `causal` | `true` for every insert. `false` for the 11 non-inserts: the three offline repair processors (`repair.declick`, `repair.declip`, `repair.trimSilence`), `final.*`, `maximizer.loudnessOptimize`, and the pair processors. |
   | `channelPolicy` | How the mixer wraps the insert on a bus wider than stereo. Every reverb, modulation and delay insert is `stereoPairOnly` except `effects.modulation.ringModulator`, which is `multichannel`. |
   | `params` | Empty for the pair processors, `final.*`, and `maximizer.loudnessOptimize`. The three offline repair processors and the four realtime repair inserts (`repair.decrackle`, `repair.dehum`, `repair.denoiseClassical`, `repair.dereverbClassical`) publish construction-only rows. |

2. **Read the descriptors.** An insert's `params` is exactly the list `masteringInsertParamInfo(id)` returns for that id, in the same order, so a host holding the catalog never needs the per-processor call (the offline repair processors answer there too). Entries with `id: null` are construction-only; non-null ids are the automation ids used by `Mixer.scheduleInsertAutomation(strip, insertIndex, paramId, samplePos, value)` on Node and WASM, `Mixer.schedule_insert_automation(...)` on Python, and `sonare_strip_schedule_insert_automation` on the C ABI. The realtime engine's setters take the `name` instead (`setTrackStripInsertParamByName` and its master and bus variants).
3. **Lay out each control** from `type`, `default`, `min`, `max`, `unit`, and `choices`. Construction-only keys have descriptors too, so `stages` on the phaser, `attackMs` / `releaseMs` on the auto-wah, `stereoSpread` on the rotary, and room geometry can be represented as build-time fields. Use `slot` to identify a slot group, then read the processor's `slots` entry: `activation` (`anyKey` or `always`), the enclosing `parent`, and `minCrossoverCutoffs` determine whether that group is present.

The catalog also exposes `saturation.overdrive` and `saturation.distortion` in the `saturation` category. Both are multichannel realtime inserts and solo processors, so the same ids work in a mixer chain, a realtime engine, or the one-shot mastering apply path.

The same descriptor route covers the current insertable maximizer controls: `ceilingDb` on `maximizer.truePeakLimiter`, `maximizer.maximizer`, `maximizer.adaptiveRelease`, and `maximizer.softKneeMax`. GS-bound realtime controls are also published there: `windowMs`, `preDelayMs`, and `preDelay2Ms` on `effects.modulation.pitchShifter`; `stereoSpread`, `accelTauS`, `decelTauS`, `undershootHz`, and `drumUndershootHz` on `effects.modulation.rotary`; `preDelayMs` and `character` on `effects.reverb.dattorro`; and `typeLadder` on `saturation.bitcrusher`. Use the descriptor list instead of maintaining a second control table.

```typescript
const catalog = capabilityCatalog();
const inserts = catalog.processors.filter((p) => p.realtimeInsertable);
const fx = inserts.filter((p) => p.category === 'effects');               // the creative-FX ids on this page
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

- **`rtSafe: false` is a hard stop for automation, not a hint.** Scheduling automation on such a parameter returns `NotSupported` (code 6). Construction-only rows are marked with `id: null` and `rtSafe: false`; this page also contains id-bearing targets that remain unsafe, including every GS EFX raw byte and `modDepthSamples`. A UI that draws an automation lane per descriptor has to disable every row whose `rtSafe` is false, including an id-bearing row.
- **The catalog has more than numeric toggles.** Effects descriptors include `number`, `boolean`, `enum`, `string`, and `array` types. `choices` can describe enum values or a closed numeric set with gaps. Do not infer a toggle from a name; use `type`, and use `choices` for discrete controls.
- **Latency and tail are per insert, and non-zero for the reverbs.** `effects.reverb.convolution`, `effects.reverb.room` and `effects.acoustic.roomMorph` report 256 samples of latency. At 48 kHz with default parameters the reverb tails run from about 1 s (`room`, `roomMorph`) through 1.5 s (`convolution`) to about 7.5 s (`fdn`), and the stereo delay is about 2.5 s. A reported tail covers the output down to 1e-5 of full scale, so it is an upper bound for sizing a bounce. `realtimeCost` is `moderate` for every reverb except `velvet`, which is `high`, and `low` for every modulation and delay insert; it is `null` only on the 11 non-inserts.
- **The effects family is small in parameters.** The per-band EQ and multiband processors account for most of the descriptors in the full catalog, so an insert UI that sizes itself by descriptor count should expect the families to differ by an order of magnitude.

### Two things a null and a default do not tell you

**A `null` bound means construction did not refuse, not that any value is meaningful.** An absent bound is literally `null` in the JSON (`None` in Python): the schema types `min` and `max` as `number | null`, and every descriptor carries both keys. Construction-only descriptors can publish bounds when their validation exposes them, while string and array keys generally publish `null`. `effects.modulation.chorus` publishes no bound on `dryWet`, construction accepts `5`, and the processor then clamps its wet mix to `[0, 1]` internally, so `dryWet: 5` renders identically to `dryWet: 1`. The catalog measures what construction rejects; a processor that folds a value instead of rejecting it reports `null`, so a range check against `null` rules out only one kind of mistake. Read a `null` bound as "no validation to lean on", and take the sensible range from the parameter's meaning and unit.

The catalog's finite bounds are acceptance limits. For example, `saturation.bitcrusher.bitDepth` publishes `min: 2` and `max: 24`, and values outside that interval are rejected. Some gain fields also reject values whose dB-to-linear conversion is non-finite; a large measured upper bound is still an implementation limit, not a useful control range.

**A default is the config struct's initializer, and a preset is under no obligation to hand it to you.** A construction-only descriptor can have `default: null` when there is no fallback, while a preset or scene can supply that key explicitly. A control surface that initialises from `default` alone can show the wrong value for a loaded scene. Initialize from the scene's own `params`, fall back to the catalog default only for keys the scene does not carry, and treat a `null` default as a value that still needs an explicit scene or user choice.

A worked example that builds sliders, toggles and band slots from these descriptors, end to end, is [Build Controls from Parameter Descriptors](./use-cases/parameter-controls.md).

## Related

- [Mixing Engine](./mixing.md) — load these as channel-strip/bus inserts
- [Mixing Scene JSON](./mixing-scene-json.md) — the `insert.processor` field reference
- [Mastering Processors](./mastering-processors.md) — the named mastering processor/preset/analysis registry
