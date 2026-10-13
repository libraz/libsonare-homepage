---
title: True Peak Safety
description: How true-peak margin prevents clipping after reconstruction, codec conversion, and streaming playback.
---

# True Peak Safety

True peak safety is the practice of leaving enough margin so a mastered file does not clip after reconstruction, codec conversion, or streaming playback.

Sample peaks only show the values stored in the digital file. Playback systems and encoders reconstruct a continuous waveform between those samples. That reconstructed waveform can rise above the stored sample peaks; the part that pokes above is called an **inter-sample peak** (ISP). A master that looks safe at sample level can still distort after conversion.

<SonareDemo id="inter-sample-peak" />

## Why Sample Peak Is Not Enough

A digital audio file is a series of points, not a complete curve. When a DAC (digital-to-analog converter) or encoder turns those points back into sound, it reconstructs the curve implied by the samples. The curve can rise above the points.

True-peak measurement estimates this by oversampling the signal before checking peaks. How far the two readings differ depends on the material:

| Signal | Sample peak (dBFS) | True peak (dBTP) |
|--------|--------------------|------------------|
| Sine at a quarter of the sample rate, 45° phase | -3.01 | -0.09 |
| Square wave, amplitude 0.5 | -6.02 | -4.11 |
| `mixed-stems.wav` | -1.1 | +0.2 |
| `drum.wav` | -0.7 | +1.4 |

The last two rows are files that sit below 0 at sample level and above 0 once reconstructed. `drum.wav` looks safe at -0.7 and reconstructs about 2 dB higher.

This matters most when:

| Situation | Risk |
|-----------|------|
| Lossy encoding | MP3, AAC, or Opus conversion can create new peaks. |
| Loud limiting | Dense masters leave less room for reconstruction overshoot. |
| Streaming normalization | Playback pipelines may transcode or process the file. |
| Consumer devices | Some playback chains handle near-0 dBFS material poorly. |

## Practical Ceiling

The **ceiling** is the highest level the limiter will let through. A common release ceiling is around `-1 dBTP` — decibels true peak, the same decibel scale as dBFS but measured on the reconstructed waveform. Some workflows use `-2 dBTP` for extra codec safety; others use a tighter ceiling when the destination is known and controlled. The engine's `club` and `cd` delivery targets use `-0.3 dBTP` together with -9 LUFS, which trades codec safety for density; streaming, broadcast, and podcast targets use `-1`.

The ceiling is not a loudness target. It is a safety margin. You can have a quiet file with unsafe peaks or a loud file that stays within true-peak limits.

<SonareDemo id="loudness-meter" />

## Limiter Lookahead

A true-peak limiter needs time to react before the peak arrives. Lookahead gives the limiter that time. Too little lookahead can miss fast peaks. Too much lookahead can increase latency and may change transient feel.

In offline mastering, a few milliseconds of lookahead is usually acceptable because playback latency does not matter. In live or interactive systems, latency matters more.

The limiter's defaults:

| Setting | Default |
|---------|---------|
| `ceilingDb` | -1 |
| `lookaheadMs` | 1.0 |
| `releaseMs` | 50 |
| `oversampleFactor` | 4 |

## Measure it in libsonare

The true-peak meter and the limiter both oversample 4x by default and accept 1, 2, 4, 8 or 16. Limiting to a ceiling is a chain stage, `maximizer.truePeakLimiter`.

::: code-group

```typescript [Browser]
import { init, meteringPeakDb, meteringTruePeakDb, masteringChain } from '@libraz/libsonare';

await init();

const samplePeak = meteringPeakDb(samples, sampleRate);
const truePeak = meteringTruePeakDb(samples, sampleRate);      // 4x oversampling
const finer = meteringTruePeakDb(samples, sampleRate, 8);      // 1, 2, 4, 8 or 16

const limited = masteringChain(samples, sampleRate, {
  maximizer: { truePeakLimiter: { ceilingDb: -1, lookaheadMs: 1, oversampleFactor: 4 } },
});
// limited.samples holds the result; limited.outputTruePeakDbtp reads -1.0 for drum.wav
```

```python [Python]
import libsonare as sonare

audio = sonare.Audio.from_file("song.wav")
sample_peak = audio.peak_db()
true_peak = audio.true_peak_db()                      # oversample_factor=4
finer = audio.true_peak_db(oversample_factor=8)

limited = sonare.mastering_chain(
    audio.data, audio.sample_rate,
    {"maximizer": {"truePeakLimiter": {"ceilingDb": -1, "lookaheadMs": 1, "oversampleFactor": 4}}},
)
```

```bash [CLI]
sonare meter song.wav   # native CLI only: sample peak and true peak (--oversample sets the factor)
sonare mastering-processor song.wav --processor maximizer.truePeakLimiter \
  --params ceilingDb=-1,lookaheadMs=1 -o limited.wav
```

:::

The mastering demo's Studio mode exposes the same ceiling and lookahead controls.

:::: details Implementation notes

The safety check uses the same principle as true-peak metering: estimate the reconstructed waveform by oversampling, then evaluate the highest sample on that denser grid. A limiter that only clamps original samples can still leave inter-sample overs, so the guard has to observe the oversampled path, not just the input buffer.

Lookahead and release are coupled.

Lookahead gives the limiter a chance to begin attenuation before the peak. Release determines how quickly it returns to unity gain.

Very short release can produce modulation. Very long release can dull transients and reduce loudness headroom. The practical setting is a compromise between codec safety, transient preservation, and audible gain movement.

::::

Related: [True Peak](../true-peak.md), [LUFS](../lufs.md), [Loudness Matching](./loudness-matching.md)
