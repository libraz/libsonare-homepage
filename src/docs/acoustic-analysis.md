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
An impulse response (IR) records how a room rings and decays after a short excitation such as a clap, balloon pop, or sweep. Because it captures the room reaction rather than the song, it is a cleaner input for RT60, clarity, and other room-acoustic metrics.
:::

::: info First-time terms
- **Equivalent room** means a simple room model that matches the measured sound well enough for analysis or UI feedback. It is not a scan of the exact real room.
- **RIR** means room impulse response: audio samples that represent how a room would respond to a short sound.
- **Shoebox room** means a rectangular room model with length, width, and height.
- **DRR** means direct-to-reverberant ratio: how much direct sound there is compared with reflected room sound.
- **Room morphing** means adding a target room character as an effect. It is not dereverberation, which tries to remove reverb.
:::

::: tip Try it in the browser
The [Spatial Room Scanner](/spatial) demo runs this whole pipeline locally: drop a recording (or pick a sample room) and it reconstructs the estimated geometry, RT60, clarity, and source distance as an interactive 3D scene.
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

`analyzeImpulseResponse(...)` and `detectAcoustic(...)` return `AcousticResult`: full-band metrics plus octave-band arrays. `estimateRoom(...)` returns `RoomEstimateResult`, `synthesizeRir(...)` returns `RirResult`, and `roomMorph(...)` returns processed samples.

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

const measured = analyzeImpulseResponse(irSamples, sampleRate, 6);
console.log(measured.rt60, measured.edt, measured.c50, measured.c80);

const blind = detectAcoustic(
  roomRecording,
  sampleRate,
  6,     // octave bands
  24,    // third-octave subbands used by blind estimation
  30,    // minimum usable decay in dB
  10,    // noise-floor margin in dB
);
console.log(blind.confidence, blind.isBlind);

const estimate = estimateRoom(roomRecording, sampleRate, {
  referenceAbsorption: 0.15,
  nOctaveBands: 6,
});
console.log(estimate.volume, estimate.length, estimate.width, estimate.height);
console.log(estimate.drrDb, estimate.confidence, estimate.absorptionBands);

const { rir, hasError } = synthesizeRir({
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

const morphed = roomMorph(dryVoice, sampleRate, {
  lengthM: 12,
  widthM: 9,
  heightM: 4,
  wet: 0.6,
});
```

```python [Python]
import libsonare as sonare

audio = sonare.Audio.from_file("room-clap.wav")

measured = sonare.analyze_impulse_response(audio.data, audio.sample_rate, n_octave_bands=6)
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
print(estimate.volume, estimate.length, estimate.width, estimate.height)
print(estimate.drr_db, estimate.confidence, estimate.absorption_bands)

rir = sonare.synthesize_rir(7.0, 5.0, 3.0, absorption=0.2, sample_rate=audio.sample_rate)
print(rir.sample_rate, len(rir.rir), rir.has_error)

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

Python `Audio` exposes the same calls as instance methods: `audio.analyze_impulse_response(...)` and `audio.detect_acoustic(...)`. The new geometric room-acoustics helpers are module-level calls in Python and standalone functions in the WASM wrapper.

## Geometric room acoustics

Use this section when you are not only measuring a recording, but also creating or applying a room model.

`synthesizeRir(...)` builds a mono RIR from a rectangular room. You provide dimensions in metres, one wall-absorption value, and source/listener coordinates inside the room. If the geometry is invalid, JavaScript returns `hasError: true` and an empty `rir`; Python exposes the same state as `has_error`.

`estimateRoom(...)` estimates an equivalent room from a recording. Treat it as a practical model, not exact geometry. Always check `confidence`, because ordinary recordings may not contain enough clear room decay.

`roomMorph(...)` is an offline creative effect. It adds a synthesized target-room character and may soften part of the existing tail. It should not be documented or sold as dereverberation.

### Wall absorption and materials

Both `synthesizeRir(...)` and `roomMorph(...)` accept the shared shoebox geometry, so they take the same wall-treatment fields. You can describe the walls at three levels of detail, from coarsest to finest:

| Field | Type | Meaning |
|-------|------|---------|
| `absorption` | number | Uniform wall absorption for every band, clamped to `[0, 0.999]`. The simplest, backward-compatible control. |
| `bandAbsorption` | `Float32Array` / `number[]` | Per-octave-band wall absorption (125 / 250 / 500 / 1k / 2k / 4k… Hz). When provided it overrides `absorption`, unless `materialPreset` is set. |
| `bandScattering` | `Float32Array` / `number[]` | Per-band wall scattering. Missing bands default to `0`. |
| `materialPreset` | number | A named wall-material preset. A non-zero preset wins over both `bandAbsorption` and `absorption`. |

The material presets map to integer codes: `0` none, `1` concrete, `2` wood, `3` curtain, `4` carpet, `5` glass. Concrete and glass are reflective and keep more high-frequency tail; curtain and carpet are absorptive and shorten it. Because a non-zero `materialPreset` wins over the explicit band arrays, set `materialPreset: 0` when you want your own `bandAbsorption`/`bandScattering` to take effect.

```typescript
// A concrete shoebox: bright, long tail
const concrete = synthesizeRir({
  lengthM: 7, widthM: 5, heightM: 3,
  materialPreset: 1, // concrete
  sampleRate,
});

// Custom per-band walls (six octave bands), with scattering
const custom = synthesizeRir({
  lengthM: 7, widthM: 5, heightM: 3,
  materialPreset: 0, // let the band arrays apply
  bandAbsorption: [0.1, 0.15, 0.2, 0.3, 0.4, 0.5],
  bandScattering: [0.1, 0.1, 0.2, 0.2, 0.3, 0.3],
  sampleRate,
});
```

### Late-reverb model and tail controls

The shared geometry also exposes the late-tail behaviour. `RirSynthOptions` and `RoomMorphOptions` both carry:

| Field | Meaning |
|-------|---------|
| `preferEyring` | Selects the statistical late-reverb model: `true` (default) uses Eyring, `false` uses Sabine. |
| `mixingTimeMs` | Early/late crossover in milliseconds. `0` auto-selects roughly `sqrt(volume)` ms. |
| `crossfadeMs` | Equal-power crossfade width around the mixing time, in milliseconds. `0` uses the default. |
| `ismOrder` | Image-source reflection order for the early part. |
| `seed`, `maxSeconds` | Late-tail random seed and the maximum RIR length to generate. |

The **mixing time** is where the response transitions from discrete image-source early reflections to the deterministic statistical late tail; the **crossfade** blends the two so the seam is inaudible. Sabine and Eyring are the two classical RT60 estimators behind the late tail; Eyring tends to be more accurate in more absorptive rooms.

::: tip Sabine vs Eyring (you can usually ignore this)
Both are classic formulas that predict a room's RT60 from its size and how absorptive its surfaces are. Eyring is generally more accurate in very absorptive (well-treated) rooms; Sabine is the older, simpler one. Leave the default unless you are matching a specific reference.
:::

::: details What are image-source reflections?
When sound bounces off walls, each reflection can be modeled as if it came from a mirror-image copy of the source behind the wall. `ismOrder` sets how many bounces are computed this way: higher orders add more (but progressively weaker) early echoes at higher CPU cost. The diffuse late tail is generated separately.
:::

::: details Implementation notes for room synthesis
`synthesizeRir(...)` uses image-source early reflections plus a deterministic late tail. `acoustic::RirSynthConfig` exposes the reflection order, Sabine/Eyring late-tail model, seed, maximum RIR length, mixing time, and crossfade width.
:::

## Reading the result

| Field | Meaning |
|-------|---------|
| `rt60` | Estimated time for reverberation to decay by 60 dB. Larger values mean a more reverberant room. |
| `edt` | Early decay time. Often tracks perceived reverberance more closely than full RT60. |
| `c50` | Clarity for speech. Higher values usually mean consonants and dialog are easier to understand. |
| `c80` | Clarity for music. Higher values indicate more direct/early energy relative to late reverberation. |
| `d50` | Definition, the fraction of early energy in the first 50 ms. |
| `rt60Bands`, `edtBands`, `c50Bands`, `c80Bands` | Per-band versions of the same measurements. Python uses snake_case names with camelCase aliases. |
| `confidence` | Heuristic confidence from `0` to `1`. Low values mean the recording did not contain a clean enough decay. |
| `isBlind` / `is_blind` | Whether the result came from blind estimation rather than an impulse-response assumption. |

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

If you need live visual frames or progressive BPM/key/chord estimates, use [Realtime and Streaming](./realtime-streaming.md). If you need song-level metadata, use [JavaScript API](./js-api.md#analysis-functions) or [Python API](./python-api.md#analysis-functions).
