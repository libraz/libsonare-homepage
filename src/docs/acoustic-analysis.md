---
title: Room Acoustics
description: How to use libsonare room-acoustic analysis APIs for impulse responses and blind recordings, including RT60, EDT, clarity, definition, and confidence fields.
---

# Room Acoustics

libsonare includes room-acoustic analysis for measuring or estimating how a space behaves. Use this page when your input is an impulse response, a clap/pop recording, or a normal recording where you want a rough acoustic profile.

This is different from music analysis. `detectBpm(...)` and `analyze(...)` describe a song; `analyzeImpulseResponse(...)` and `detectAcoustic(...)` describe the room or playback environment.

## What You Will Learn

By the end of this page you should be able to:

- choose impulse-response analysis or blind acoustic estimation based on the input recording;
- explain RT60, EDT, C50, C80, D50, octave bands, confidence, and `isBlind` at a practical level;
- avoid using blind acoustic estimates as certification-grade measurements;
- call the same acoustic workflow from JavaScript, Python, or the CLI.

## Choose the right function

| Input | Use | What to expect |
|-------|-----|----------------|
| A measured impulse response, starter pistol, balloon pop, sweep-derived IR, or clean clap capture | `analyzeImpulseResponse(...)` | Best accuracy. The algorithm assumes the decay belongs to the room. |
| A normal music/speech recording with no isolated impulse | `detectAcoustic(...)` | Blind estimate. Useful for ranking or UI hints, not certification. |

Both functions return `AcousticResult`, with full-band metrics plus octave-band arrays.

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
import { init, analyzeImpulseResponse, detectAcoustic } from '@libraz/libsonare';

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
```

```bash [CLI]
# blind estimate from a normal recording (uses default bands/thresholds)
sonare acoustic room-recording.wav

# impulse-response mode (clap / pop / sweep-derived IR)
sonare acoustic room-clap.wav --ir

# add --json for a machine-readable summary
sonare acoustic room-clap.wav --ir --json
```

:::

Python `Audio` exposes the same calls as instance methods:
`audio.analyze_impulse_response(...)` and `audio.detect_acoustic(...)`. In the
WASM wrapper, call the standalone `analyzeImpulseResponse(...)` and
`detectAcoustic(...)` functions with `audio.data` and `audio.sampleRate`.

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

For reliable numbers, record a clean impulse response: keep the room quiet, avoid clipping, leave enough silence after the impulse, and trim unrelated noise before analysis. A blind estimate is useful for comparing recordings or warning that a take sounds too reverberant, but it should not be treated as an architectural measurement.

If you need live visual frames or progressive BPM/key/chord estimates, use [Realtime and Streaming](./realtime-streaming.md). If you need song-level metadata, use [JavaScript API](./js-api.md#analysis-functions) or [Python API](./python-api.md#analysis-functions).
