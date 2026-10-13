---
title: Room Acoustics
description: How to use libsonare room-acoustic analysis, room estimation, RIR synthesis, and room-morph APIs.
---

# Room Acoustics

libsonare includes room-acoustic tools for describing how a space sounds.

Use this page when you want to:

- measure a clap or impulse-response recording;
- estimate a rough room profile from ordinary audio;
- create a room impulse response from simple room dimensions;
- apply a target room character as an offline effect.

This is different from music analysis. `detectBpm(...)` and `analyze(...)` describe a song. The room-acoustic APIs describe, synthesize, or apply the recording space.

::: info What is an impulse response?
An impulse response (IR) records how a room rings and decays after a short excitation such as a clap or balloon pop. A sine-sweep recording must be deconvolved with the known sweep to obtain an IR before analysis. Because an IR captures the room reaction rather than the song or the excitation, it is a cleaner input for RT60, clarity, and other room-acoustic metrics.
:::

<SonareDemo id="room-decay" />

::: info First-time terms
- **Equivalent room** means a simple room model that matches the measured sound well enough for analysis or UI feedback. It is not a scan of the exact real room.
- **RIR** means room impulse response: audio samples that represent how a room would respond to a short sound.
- **Shoebox room** means a rectangular room model with length, width, and height.
- **DRR** means direct-to-reverberant ratio: how much direct sound there is compared with reflected room sound.
- **Room morphing** means adding a target room character as an effect. It is not dereverberation, which tries to remove reverb.

For fuller explanations of every metric below, see the [Room Acoustics glossary](./glossary.md#room-acoustics).
:::

::: tip Try it in the browser
The [Spatial Room Scanner](/spatial) demo runs this whole pipeline locally: drop a recording (or pick a sample room) and it reconstructs the estimated geometry, RT60, clarity, and source distance as an interactive 3D scene. The reconstructed room can be saved as a convolution impulse response, and its numbers as a JSON estimate.
:::

## What You Will Learn

By the end of this page you should be able to:

- choose impulse-response analysis or blind acoustic estimation based on the input recording;
- synthesize a mono room impulse response from shoebox dimensions;
- estimate an equivalent room from a recording, including volume, dimensions, absorption, DRR, and confidence;
- apply a creative room-character morph without treating it as dereverberation;
- explain RT60, EDT, C50, C80, D50, octave bands, confidence, and `isBlind` at a practical level;
- avoid using blind acoustic estimates as certification-grade measurements;
- call the same acoustic workflow from JavaScript, Python, or the CLI.

## Choose the right function

| Input | Use | What to expect |
|-------|-----|----------------|
| A measured impulse response, starter pistol, balloon pop, sweep-derived IR, or clean clap capture | `analyzeImpulseResponse(...)` | Best accuracy. The algorithm assumes the decay belongs to the room. |
| A normal music/speech recording with no isolated impulse | `detectAcoustic(...)` | Blind estimate. Useful for ranking or UI hints, not certification. |
| A recording or impulse response where you need a practical equivalent-room model | `estimateRoom(...)` | Volume, representative dimensions, DRR, per-band absorption/RT60, and confidence. |
| Shoebox room dimensions and source/listener placement | `synthesizeRir(...)` | A reproducible mono RIR for the specified room and positions. |
| A dry or existing recording you want to push toward a target room | `roomMorph(...)` | Creative offline room effect. It does not remove existing reverb. |

`analyzeImpulseResponse(...)` and `detectAcoustic(...)` return `AcousticResult`: full-band metrics plus octave-band arrays. `estimateRoom(...)` returns `RoomEstimateResult`, `synthesizeRir(...)` returns `RirResult`, and `roomMorph(...)` returns `RoomMorphResult` — the morphed samples on `audio`, plus the diagnostics its target-room synthesis reported.

::: info Why per-band (octave bands)?
A room does not absorb all frequencies equally — bass often rings longer than treble. Splitting the analysis into octave bands (each band roughly doubling in frequency: 125, 250, 500, 1k, 2k, 4k Hz) reports RT60 and clarity separately per band instead of as one average. Third-octave subbands are a finer split used internally during blind estimation.
:::

## Direct measurement vs blind estimation

`analyzeImpulseResponse(...)` looks directly at the decay after a short excitation. It is the right choice for a clap, pop, sweep-derived IR, or any recording where the initial sound and the following room decay are easy to separate.

`detectAcoustic(...)` estimates room behavior from ordinary music or speech. Because there is no isolated impulse, it searches the recording for regions where the source appears to stop and the remaining energy falls like room reverberation.

That difference changes how you should treat the result.

| Question | `analyzeImpulseResponse(...)` | `detectAcoustic(...)` |
|----------|-------------------------------|-----------------------|
| Input assumption | The room response is easy to isolate | Music or speech is mixed with the room |
| Best use | Measurement, comparison, validation | UI hints, tagging, warnings |
| Confidence | Easier to trust when the IR is clean | Essential to inspect because the input controls reliability |
| Low confidence usually means | The IR is noisy, too short, clipped, or poorly isolated | No clear free-decay region was found, or non-room material looked like decay |

A **free-decay region** is a span where the source is no longer producing new sound and the room tail is naturally fading. Blind estimation cannot produce a trustworthy value when that region is not visible.

## Usage

These calls default `sampleRate` to 48000; always pass the recording's rate.

::: code-group

```typescript [Browser]
import {
  init,
  analyzeImpulseResponse,
  detectAcoustic,
  estimateRoom,
  synthesizeRir,
  roomMorph,
} from '@libraz/libsonare';

await init();

const measured = analyzeImpulseResponse(irSamples, sampleRate, 6, 30); // bands, fit span in dB
console.log(measured.rt60, measured.edt, measured.c50, measured.c80);

const blind = detectAcoustic(roomRecording, sampleRate, {
  nOctaveBands: 6,            // octave bands
  nThirdOctaveSubbands: 24,   // third-octave subbands used by blind estimation
  minDecayDb: 30,             // minimum usable decay in dB
  noiseFloorMarginDb: 10,     // noise-floor margin in dB
});
console.log(blind.confidence, blind.isBlind);

const estimate = estimateRoom(roomRecording, sampleRate, {
  referenceAbsorption: 0.15,
  nOctaveBands: 6,
});
console.log(estimate.volume, estimate.lengthM, estimate.widthM, estimate.heightM);
console.log(estimate.drrDb, estimate.confidence, estimate.bandAbsorption, estimate.rt60Bands);

// Throws a coded SonareError (e.g. acoustic.source_outside_room) for unusable geometry.
const { rir, diagnostics: rirWarnings } = synthesizeRir({
  lengthM: 7,
  widthM: 5,
  heightM: 3,
  sourceX: 1,
  sourceY: 1,
  sourceZ: 1.2,
  listenerX: 5,
  listenerY: 4,
  listenerZ: 1.7,
  absorption: 0.2,
  sampleRate,
});

const { audio: morphed, diagnostics } = roomMorph(dryVoice, sampleRate, {
  lengthM: 12,
  widthM: 9,
  heightM: 4,
  wet: 0.6,
});
```

```typescript [Node]
import {
  analyzeImpulseResponse,
  detectAcoustic,
  estimateRoom,
  synthesizeRir,
  roomMorph,
} from '@libraz/libsonare-native';

const measured = analyzeImpulseResponse(irSamples, sampleRate, 6, 30); // bands, fit span in dB
console.log(measured.rt60, measured.edt, measured.c50, measured.c80);

const blind = detectAcoustic(roomRecording, sampleRate, {
  nOctaveBands: 6,            // octave bands
  nThirdOctaveSubbands: 24,   // third-octave subbands used by blind estimation
  minDecayDb: 30,             // minimum usable decay in dB
  noiseFloorMarginDb: 10,     // noise-floor margin in dB
});
console.log(blind.confidence, blind.isBlind);

const estimate = estimateRoom(roomRecording, sampleRate, {
  referenceAbsorption: 0.15,
  nOctaveBands: 6,
});
console.log(estimate.volume, estimate.lengthM, estimate.widthM, estimate.heightM);
console.log(estimate.drrDb, estimate.confidence, estimate.bandAbsorption, estimate.rt60Bands);

// Throws a coded SonareError (e.g. acoustic.source_outside_room) for unusable geometry.
const { rir, diagnostics: rirWarnings } = synthesizeRir({
  lengthM: 7,
  widthM: 5,
  heightM: 3,
  sourceX: 1,
  sourceY: 1,
  sourceZ: 1.2,
  listenerX: 5,
  listenerY: 4,
  listenerZ: 1.7,
  absorption: 0.2,
  sampleRate,
});

const { audio: morphed, diagnostics } = roomMorph(dryVoice, sampleRate, {
  lengthM: 12,
  widthM: 9,
  heightM: 4,
  wet: 0.6,
});
```

```python [Python]
import libsonare as sonare

audio = sonare.Audio.from_file("room-clap.wav")

measured = sonare.analyze_impulse_response(audio.data, audio.sample_rate, n_octave_bands=6, min_decay_db=30.0)
print(measured.rt60, measured.edt, measured.c50, measured.c80)

blind = sonare.detect_acoustic(
    audio.data,
    audio.sample_rate,
    n_octave_bands=6,
    n_third_octave_subbands=24,
    min_decay_db=30.0,
    noise_floor_margin_db=10.0,
)
print(blind.confidence, blind.is_blind)

estimate = sonare.estimate_room(audio.data, audio.sample_rate, n_octave_bands=6)
print(estimate.volume, estimate.length_m, estimate.width_m, estimate.height_m)
print(estimate.drr_db, estimate.confidence, estimate.band_absorption, estimate.rt60_bands)

rir = sonare.synthesize_rir(7.0, 5.0, 3.0, absorption=0.2, sample_rate=audio.sample_rate)
print(rir.sample_rate, len(rir.rir), rir.diagnostics)

morphed = sonare.room_morph(
    audio.data,
    audio.sample_rate,
    12.0,
    9.0,
    4.0,
    wet=0.6,
)
```

```bash [CLI]
# blind estimate from a normal recording (uses default bands/thresholds)
sonare acoustic room-recording.wav

# impulse-response mode (clap / pop / sweep-derived IR)
sonare acoustic room-clap.wav --ir

# add --json for a machine-readable summary
sonare acoustic room-clap.wav --ir --json

# estimate an equivalent room from a recording
sonare estimate-room room-recording.wav --json

# synthesize a mono room impulse response from geometry
sonare synthesize-rir --length 7 --width 5 --height 3 -o room-ir.wav

# morph a recording toward a target room
sonare room-morph dry.wav --length 12 --width 9 --height 4 --wet 0.6 -o morphed.wav
```

:::

Python `Audio` exposes the measurement calls as instance methods: `audio.analyze_impulse_response(...)` and `audio.detect_acoustic(...)`. `synthesizeRir`, `estimateRoom` and `roomMorph` are module-level calls in Python and standalone functions in the WASM package.

## Estimating an equivalent room

`estimateRoom(...)` estimates an equivalent room from a recording. Treat it as a practical model, not exact geometry. Always check `confidence`, because ordinary recordings may not contain enough clear room decay. The result carries `volume`, `lengthM`, `widthM`, `heightM`, `drrDb`, `confidence`, `bandAbsorption` and `rt60Bands`; Python uses the snake_case spellings.

| Option | Default | Meaning |
|--------|---------|---------|
| `mode` | `'auto'` | `'auto'` sends impulse-like input to impulse-response analysis and everything else to the blind path; `'blind'` and `'impulse_response'` force a path. Names only: a number is a `TypeError`. |
| `aspectHintLw` / `aspectHintLh` | `1` / `1` | Length : width and length : height ratios, so `widthM = lengthM / aspectHintLw` and `heightM = lengthM / aspectHintLh`. |
| `referenceAbsorption` | `0.15` | Mean wall absorption that fixes the room scale (see below). Clamped into `[0.01, 0.99]`. |
| `preferEyring` | `true` | Invert the decay with Eyring (`true`) or Sabine (`false`). |
| `nOctaveBands`, `minDecayDb`, `noiseFloorMarginDb` | `6`, `30`, `10` | The same as for `detectAcoustic(...)`; `0` selects the default. |

::: warning What `estimateRoom(...)` actually solves
It solves a *scale* only under the supplied shape and absorption priors; it does not recover the shape itself.

- Without `aspectHintLw` / `aspectHintLh` the three dimensions come back identical (a cube), so do not present `lengthM`, `widthM` and `heightM` as recovered proportions unless you passed hints.
- A single decay constrains the ratio `V / A`, where `A` is equivalent absorption area, rather than determining volume and absorption separately. With a fixed shape, surface area grows with the square of linear scale while volume grows with its cube, so a larger room needs a higher mean absorption to keep the same RT60. `referenceAbsorption` supplies the missing prior that pins the volume down. Under Sabine, the reported volume scales approximately with the cube of that prior; the default Eyring model uses the corresponding `-ln(1 − α)` term, so treat the cube rule as a Sabine approximation. Keep it fixed when comparing recordings.

The prior is clamped rather than refused, so an out-of-range value still returns a successful estimate, computed from the clamped number. At the low end that is worth three orders of magnitude in the reported volume.
:::

::: warning An explicit `referenceAbsorption: 0` is not "default" everywhere
Python and C read an explicit `0` as "use the default" (`0.15`); Node and WASM clamp it to `0.01`, which reports a normal room as a fraction of a cubic meter, with full confidence. Omit the option for the default, and write `0.01` when you want the floor.
:::

## Reading the result

| Field | Meaning |
|-------|---------|
| `rt60` | Estimated time for reverberation to decay by 60 dB. Larger values mean a more reverberant room. |
| `edt` | Early decay time, fitted over the first 10 dB. Often tracks perceived reverberance more closely than full RT60. Independently fitted only in impulse-response mode. |
| `c50` | Clarity for speech. Higher values usually mean consonants and dialog are easier to understand. Impulse-response mode only. |
| `c80` | Clarity for music. Higher values indicate more direct/early energy relative to late reverberation. Impulse-response mode only. |
| `d50` | Definition, the fraction (`0`–`1`) of early energy in the first 50 ms. Impulse-response mode only. |
| `rt60Bands`, `edtBands`, `c50Bands`, `c80Bands` | Per-band versions of the same measurements. Python uses snake_case names with camelCase aliases. |
| `confidence` | Heuristic confidence from `0` to `1`. Low values mean the recording did not contain a clean enough decay. |
| `isBlind` / `is_blind` | Whether the result came from blind estimation rather than an impulse-response assumption. |

::: warning Blind analysis returns decay only
`detectAcoustic(...)` always runs the blind path, and the blind path recovers a late-decay rate and nothing else. `c50`, `c80`, and `d50` come back `NaN`; `c50Bands` and `c80Bands` come back empty; `edt` is `NaN` because the blind path has no direct-sound arrival for an independent 0-to-−10 dB fit, and `edtBands` keeps the requested band count but every entry is `NaN`. Call `analyzeImpulseResponse(...)` on a clap, pop, or deconvolved sweep-derived IR whenever you need clarity numbers or a real EDT, and guard for `NaN` before formatting these fields in a UI.
:::

::: details What do RT60, EDT, C50/C80, and D50 measure?
These are standard room-acoustic numbers derived from how sound decays in a space after it stops.

- **RT60** — seconds for the reverberation to fall by 60 dB; the headline "how reverberant" figure. A small room might be ~0.3 s, a cathedral several seconds.
- **EDT (early decay time)** — the decay rate measured from the first part of the tail, scaled to a 60 dB drop. It usually tracks the *perceived* liveliness of a room better than full RT60.
- **C50 / C80 (clarity)** — the ratio, in dB, of early energy (the first 50 ms or 80 ms) to the later reverberation. Higher means clearer and more direct. C50 is the reference for speech, C80 for music.
- **D50 (definition)** — the fraction (0–1) of total energy that arrives in the first 50 ms. Higher means a more direct, less washy sound.
:::

## Practical guidance

For reliable numbers, record a clean impulse response:

- keep the room quiet;
- avoid clipping;
- leave enough silence after the impulse;
- trim unrelated noise before analysis.

A blind estimate is useful for comparing recordings or warning that a take sounds too reverberant. Do not treat it as an architectural measurement.

## Geometric room acoustics

Use this section when you are not only measuring a recording, but also creating or applying a room model.

<FlowDiagram
  title="From a recording to a synthesized room"
  :nodes="[
    { id: 'rec', label: 'Recording', col: 0, row: 1 },
    { id: 'est', label: 'Room estimate', col: 1, row: 1 },
    { id: 'geo', label: 'Room geometry', col: 2, row: 1 },
    { id: 'own', label: 'Your own geometry', col: 2, row: 0, variant: 'muted' },
    { id: 'rir', label: 'Room impulse response', col: 3, row: 1, variant: 'success' },
    { id: 'out', label: 'Morphed audio', col: 3, row: 2, variant: 'success' }
  ]"
  :edges="[
    { from: 'rec', to: 'est', label: 'estimateRoom' },
    { from: 'est', to: 'geo', label: 'roomGeometryFromEstimate' },
    { from: 'geo', to: 'rir', label: 'synthesizeRir' },
    { from: 'own', to: 'rir', label: 'synthesizeRir', style: 'dashed' },
    { from: 'geo', to: 'out', label: 'roomMorph / roomMorphStereo' }
  ]"
  caption="Geometry can come from an estimate or be written by hand; either one feeds the synthesizer and the morph."
/>

`synthesizeRir(...)` builds a mono RIR from a rectangular room. You provide dimensions in meters, one wall-absorption value, and source/listener coordinates inside the room. Unusable geometry, such as a source or listener outside the room, throws a coded `SonareError` whose message leads with the diagnostic code (for example `acoustic.source_outside_room`); Python raises `SonareValueError`. A call that returns carries only warnings on `diagnostics`.

`roomMorph(...)` is an offline creative effect. It adds a synthesized target-room character and may soften part of the existing tail. Do not treat or present its output as dereverberation: it adds room character, it does not remove existing reverb.

### Reading the room-morph result

`roomMorph(...)` returns `RoomMorphResult`: the morphed samples on `audio` (the input length plus the target room's reverb tail, so the added reverberation is never cut off), the `sampleRate` they are at, and `diagnostics`, the list of what the target-room synthesis had to change to produce them. The morph builds its target room with the same code as `synthesizeRir(...)`, so it can report the same warnings, and every one of them means the morph went through a room other than the one you described. The audio does not tell you that; the list does.

| `code` | What happened | What to do |
|--------|---------------|------------|
| `acoustic.ism_order_clamped` | `ismOrder` was above the safe maximum of `12` and was reduced to it. | Request `12` or less so the render matches the request. |
| `acoustic.rir_length_clamped` | The room's natural response was longer than the cap, so the tail was cut. The message says which cap: `maxSeconds`, or the shared RIR resource limit when `maxSeconds` was `0`. | Raise `maxSeconds` if you set it. Otherwise the room decays for longer than the budget allows, so make it smaller or more absorptive. |
| `acoustic.rir_length_floored` | `maxSeconds` ended before the direct sound could arrive, so it was extended to fit it. The result is longer than you asked for. | Raise `maxSeconds`, or move the listener closer to the source. |
| `acoustic.rir_tail_truncated` | `maxSeconds` cuts the longest-decaying band before its RT60, so a 60 dB decay cannot be measured from the RIR. | Set `maxSeconds` at least as long as that band's RT60, or use `0` for the natural length subject to the resource limit. |
| `acoustic.no_late_tail` | No usable diffuse tail existed at the mixing time, so the target room is early reflections only. Either the walls are fully rigid (absorption `0` in every band) or so absorptive that the tail ends before the crossover. | Move the absorption away from the extremes, or lower `mixingTimeMs`. |

Neither `RoomMorphResult` nor `RirResult` has an error flag: a morph that cannot be produced — invalid geometry, a listener outside the room, a climate outside the physical range — throws `InvalidParameter` instead (`synthesizeRir(...)` throws the same way), so every entry in `diagnostics` is a warning about a result you did get. Branch on `code`; the `message` text is for humans, and the `severity` of every entry on a returned morph is `'warning'`.

The shape is the same on every surface. Node and the browser return the `RoomMorphResult` described on [JavaScript API Types](./js-api-types.md#roommorphresult). Python returns a `RoomMorphResult` dataclass whose `diagnostics` is a list of `RirDiagnostic`. The C ABI leaves the entries in `sonare_last_diagnostic_count()` / `sonare_last_diagnostic_code(i)` after a successful `sonare_room_morph`, as shown on [C++ API](./cpp-api-effects.md#room-morph-through-the-c-abi). The `sonare room-morph` command prints each warning to stderr as `warning: <code>: <message>`, while the output file and any `--json` summary stay on stdout.

### Stereo room morph

`roomMorphStereo({ left, right, sampleRate, ...options })` (Python `room_morph_stereo(left, right, sample_rate, length_m, width_m, height_m, ...)`, C `sonare_room_morph_stereo`, and `sonare room-morph` on a two-channel file) morphs a stereo recording instead of a mono one. It takes every `roomMorph` option plus `receiverSpacingM` (Python `receiver_spacing_m`, CLI `--receiver-spacing`): the target room is heard at two omnidirectional receivers that distance apart across the listener, `0.5` m by default. A spacing outside (0, 4] m, or channels of different length, is refused with a `RangeError` (`SonareValueError` in Python).

Each channel is convolved with its own receiver's response. The early reflections differ per receiver, and the late tails follow the diffuse-field coherence of two points that far apart, so the bass stays correlated between the channels and the highs do not. The result is `{ left, right, sampleRate, diagnostics }`: both channels are the input length plus the target room's reverb tail, and `diagnostics` carries the codes of the table above. The source-tail suppressor applies one gain, taken from the louder channel, to both channels, so suppression does not shift the stereo image.

```typescript
const { left: wetL, right: wetR } = roomMorphStereo({
  left, right, sampleRate,
  lengthM: 12, widthM: 9, heightM: 4, wet: 0.6,
  receiverSpacingM: 0.5,
});
```

Summed to mono, the added room is about 3 dB lower above roughly 300 Hz than a response shared by both channels would be, because the two tails do not add coherently. The offline mono `roomMorph(...)` is the single-listener response and does not place a receiver pair. The `effects.reverb.room` and `effects.acoustic.roomMorph` inserts use the pair on a stereo strip, and refuse (`InvalidParameter`) a placement that puts either receiver outside the room, so a listener closer to a side wall than half the spacing (0.25 m by default) is refused even on a mono strip. The capability catalog publishes the matching bounds: `listenerX` and `listenerY` carry a minimum and maximum inside the walls, and the minimum `lengthM` and `widthM` are raised accordingly.

What the spacing does to the two tails, band by band, is measured on [Spaced Receivers and Coherence](./glossary/acoustics/spaced-receivers.md).

### From an estimate to a synthesized RIR

An `estimateRoom(...)` result already uses the names `synthesizeRir(...)` takes (`lengthM`, `widthM`, `heightM`, `bandAbsorption`), so `roomGeometryFromEstimate(...)` returns geometry you can pass straight on. An estimate carries no source or listener position, so the result places them itself: the synthesizer's default source and listener, scaled per axis from the default 7 × 5 × 3 m room into the estimated dimensions (at 7 × 5 × 3 m the placement is the default one), which keeps both inside a small estimated room. Give `source` / `listener` as `{ x, y, z }` in meters to override it. The result also carries a scalar `absorption`, the mean of the finite bands, and leaves bands that did not converge out of `bandAbsorption`. An estimate with no measurable dimensions (`NaN`, `confidence` `0`) throws a `RangeError` (`SonareValueError` in Python).

::: code-group

```typescript [JavaScript]
const estimate = estimateRoom(roomRecording, sampleRate, { nOctaveBands: 6 });
const geometry = roomGeometryFromEstimate(estimate, {
  source: { x: 1, y: 1, z: 1.2 },
  listener: { x: 2, y: 1.5, z: 1.5 },
});
const { rir } = synthesizeRir({ ...geometry, sampleRate });
```

```python [Python]
estimate = sonare.estimate_room(audio.data, audio.sample_rate, n_octave_bands=6)
geometry = sonare.room_geometry_from_estimate(
    estimate, source=(1, 1, 1.2), listener=(2, 1.5, 1.5)
)
rir = sonare.synthesize_rir(**geometry, sample_rate=audio.sample_rate)
```

:::

### Wall absorption and materials

Both `synthesizeRir(...)` and `roomMorph(...)` accept the shared shoebox geometry, so they take the same wall-treatment fields. You can describe the walls at three levels of detail, from coarsest to finest:

| Field | Type | Meaning |
|-------|------|---------|
| `absorption` | number | Uniform wall absorption for every band. Must be within `[0, 1]`; an accepted value is then clamped to `[0, 0.999]`. The simplest control. |
| `bandAbsorption` | `Float32Array` / `number[]` | Per-octave-band wall absorption (125 / 250 / 500 / 1k / 2k / 4k… Hz). When provided it overrides `absorption`, unless `materialPreset` is set. Python: `band_absorption`. |
| `bandScattering` | `Float32Array` / `number[]` | Per-band wall scattering. Missing bands default to `0`. Applied to whichever wall material the absorption fields selected. Python: `band_scattering`. |
| `materialPreset` | name | A named wall-material preset: `'concrete'`, `'wood'`, `'curtain'`, `'carpet'` or `'glass'` (`'none'` selects no preset). Python: `material_preset`. One material covers every surface, so the rooms it makes are extreme: an all-carpet room absorbs almost nothing at 125 Hz. Any preset but `'none'` wins over both `bandAbsorption` and `absorption`. It does not compete with `bandScattering`. |

Precedence decides the **absorption** only, highest first: a `materialPreset` other than `'none'` wins over everything; otherwise `bandAbsorption` (per band) wins over `absorption` (uniform). So to use your own per-band absorption, leave `materialPreset` at `'none'` (the default).

`bandScattering` sits outside that contest. It applies to whichever wall material the absorption precedence selected, so a preset *plus* a scattering array is a well-formed request: you get the preset's absorption with your roughness on top of it.

::: warning A scattering array always reaches the walls
`bandScattering` is never dropped, including alongside a `materialPreset`. Scattering diffuses energy out of the specular early reflections, which moves the mixing time and the early/late balance, so passing one changes the render. If some existing code hands `synthesizeRir(...)` or `roomMorph(...)` a scattering array it does not actually want applied, remove the array rather than relying on a preset to suppress it.
:::

::: warning Out-of-range absorption is refused, not pulled into range
A scalar `absorption` that is non-finite or outside `[0, 1]` fails with `InvalidParameter`. An accepted value is clamped to `[0, 0.999]` so the perfectly absorbing endpoint does not make the Eyring term `-ln(1 - absorption)` singular. `bandAbsorption` and `bandScattering` are validated the same way, so every wall-treatment field answers a bad value identically instead of one of them quietly building a different room than you asked for.
:::

`materialPreset` takes names only: a number is a `TypeError` and an unknown name a `RangeError` (`SonareValueError` in Python), both listing the valid names. Concrete and glass are reflective and keep more high-frequency tail; curtain and carpet are absorptive and shorten it.

```typescript
// A concrete shoebox: bright, long tail
const concrete = synthesizeRir({
  lengthM: 7, widthM: 5, heightM: 3,
  materialPreset: 'concrete',
  sampleRate,
});

// Custom per-band walls (six octave bands), with scattering
const custom = synthesizeRir({
  lengthM: 7, widthM: 5, heightM: 3,
  materialPreset: 'none', // no preset, so bandAbsorption decides the absorption
  bandAbsorption: [0.1, 0.15, 0.2, 0.3, 0.4, 0.5],
  bandScattering: [0.1, 0.1, 0.2, 0.2, 0.3, 0.3],
  sampleRate,
});
```

### Late-reverb model and tail controls

The shared geometry also exposes the late-tail behavior. `RirSynthOptions` and `RoomMorphOptions` both carry:

| Field | Meaning |
|-------|---------|
| `preferEyring` | Selects the statistical late-reverb model: `true` (default) uses Eyring, `false` uses Sabine. |
| `mixingTimeMs` | Early/late crossover in milliseconds. `0` auto-selects roughly `sqrt(volume)` ms. |
| `crossfadeMs` | Equal-power crossfade width around the mixing time, in milliseconds. `0` uses the default. |
| `ismOrder` | Image-source reflection order for the early part. |
| `seed`, `maxSeconds` | Late-tail random seed and the maximum RIR length to generate. |
| `airAbsorptionEnabled`, `airTemperatureC`, `airHumidityPercent` | Atmospheric absorption along the reflection path, added to the late tail's per-band RT60. Off by default; see [Air absorption](#air-absorption). |

The **mixing time** is where the response transitions from discrete image-source early reflections to the deterministic statistical late tail; the **crossfade** blends the two so the seam is inaudible. Sabine and Eyring are the two classical RT60 estimators behind the late tail; Eyring tends to be more accurate in highly absorptive rooms.

::: tip Sabine vs Eyring (you can usually ignore this)
Both are classic formulas that predict a room's RT60 from its size and how absorptive its surfaces are. Eyring is generally more accurate in very absorptive (well-treated) rooms; Sabine is the older, simpler one. Leave the default unless you are matching a specific reference.
:::

::: details What are image-source reflections?
When sound bounces off walls, each reflection can be modeled as if it came from a mirror-image copy of the source behind the wall. `ismOrder` sets how many bounces are computed this way: higher orders add more (but progressively weaker) early echoes at higher CPU cost. The diffuse late tail is generated separately.
:::

::: details Implementation notes for room synthesis
`synthesizeRir(...)` uses image-source early reflections plus a deterministic late tail. `acoustic::RirSynthConfig` exposes the reflection order, Sabine/Eyring late-tail model, seed, maximum RIR length, mixing time, crossfade width, and the optional air-absorption climate.
:::

### Air absorption

Air itself absorbs sound, far more at high frequencies than at low, and the loss accumulates with the distance a reflection travels. The three options below add that loss, computed with the ISO 9613-1 atmospheric-absorption model, to the late tail's per-band RT60. They are read by `synthesizeRir(...)`, `roomMorph(...)` and the geometry-driven `effects.reverb.room` insert. The inverse direction, `estimateRoom(...)`, does not take them, and the CLI's `synthesize-rir` / `room-morph` commands do not expose them.

| Option | Default | Accepted | Meaning |
|--------|---------|----------|---------|
| `airAbsorptionEnabled` | `false` | boolean | Adds the air term. Off, the RIR is identical to one rendered without the feature, so a room described the same way keeps rendering the same way. |
| `airTemperatureC` | `20` | above −273.15 °C | Air temperature. `0` or omitted selects the ISO reference 20 °C, so a literal 0 °C is not distinguishable from unset — ask for a freezing room with `0.01`, which absorbs identically. |
| `airHumidityPercent` | `50` | `0`–`100` | Relative humidity. `0` or omitted selects the ISO reference 50 %. |

The climate pair is read only while `airAbsorptionEnabled` is set. A non-finite or out-of-range value is refused the way the surrounding geometry checks are, not pulled into range: `synthesizeRir(...)` throws a `SonareError` with code `acoustic.invalid_air_absorption`, and `roomMorph(...)` throws `InvalidParameter`. Pressure is not an input; the model is evaluated at sea-level pressure.

```typescript
const hall = synthesizeRir({
  lengthM: 30, widthM: 20, heightM: 12,
  absorption: 0.2,
  airAbsorptionEnabled: true,
  airTemperatureC: 20,        // 0 would also mean 20
  airHumidityPercent: 30,     // drier than the reference: the high bands decay sooner
  sampleRate,
});
```

Turning it on mainly shortens the high bands of a large room and leaves a small one close to where it was, because the term grows with the room's volume as well as with frequency. Drier or colder air absorbs the highs more. Which way each band moves, and by how much, is worked through on [Per-Band Decay and Absorption](./glossary/acoustics/absorption-bands.md#air-absorption-along-the-path).

::: warning It is not wall absorption
Air absorption models the loss along the propagation path, inside the air. It is not a substitute for `absorption`, `bandAbsorption` or `materialPreset`, which model the loss at the boundaries, and it does not touch the image-source early reflections at all — only the statistical tail's decay rates. A room whose highs ring too long because its walls are reflective needs a more absorptive wall material; humidity will not fix it, and it will never move the low bands, where the air term is negligible.
:::

If you need live visual frames or BPM/key/chord estimates that update as audio arrives, use [Realtime and Streaming](./realtime-streaming.md). If you need song-level metadata, use [JavaScript API](./js-api-analysis.md#analysis-functions) or [Python API](./python-api-analysis.md#analysis-functions).

## Related

- [Reverberation Time (RT60 and EDT)](./glossary/acoustics/reverberation-time.md) · [Clarity and Definition (C50, C80, D50)](./glossary/acoustics/clarity-definition.md) — what the headline decay and clarity numbers mean
- [Source Distance and DRR](./glossary/acoustics/source-distance.md) · [Room Geometry and Volume](./glossary/acoustics/room-geometry.md) — distance, the equivalent shoebox, and Sabine's volume/absorption trade
- [Per-Band Decay and Absorption](./glossary/acoustics/absorption-bands.md) · [Inverse Room Estimation](./glossary/acoustics/inverse-estimation.md) — octave-band decay, and impulse-response vs blind estimation with the confidence score
- [Spatial Room Scanner](/spatial) — run this whole pipeline locally as an interactive 3D scene
- API reference: [JavaScript](./js-api-effects.md#room-acoustics) · [Node.js](./node-api-analysis.md) · [Python](./python-api-effects.md#room-acoustics)
