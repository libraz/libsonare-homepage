---
title: Spectral Editing
description: "Region-based STFT editing in libsonare: attenuate, mute, gain, or heal time-frequency rectangles from JavaScript/WASM and Python."
---

# Spectral Editing

`spectralEdit(...)` is libsonare's region-based STFT editor. Use it when you want to change a time and frequency rectangle inside a mono clip: attenuate a whistle, mute a short hum, boost a narrow band, or heal a small dropout from neighboring frames.

It is an offline transform. The output keeps the same sample rate and length as the input, and each region operation is applied in order to the same STFT buffer.

<SonareDemo id="spectral-edit" />

## When To Use It

| Goal | Mode |
|------|------|
| Turn a selected band up or down by an exact amount | `gain` |
| Reduce a selected band — same formula as `gain`, conventionally passed a negative `gainDb` | `attenuate` |
| Remove a selected rectangle completely | `mute` |
| Fill a small artifact from nearby frames | `heal` |

`gain` and `attenuate` run the identical math; they exist as two names so your code reads by intent. Use `gain` when you mean to boost and `attenuate` (with a negative `gainDb`) when you mean to cut.

Use [Editing DSP](./editing-dsp.md) for pitch, time, note, and voice edits. Use [Mastering Processors](./mastering-processors.md) for whole-track tone, dynamics, repair, and delivery processing.

## Usage

::: code-group

```typescript [Browser / WASM]
import { init, spectralEdit } from '@libraz/libsonare';

await init();

const repaired = spectralEdit(samples, sampleRate, [
  {
    startSample: Math.round(1.25 * sampleRate),
    endSample: Math.round(1.55 * sampleRate),
    lowHz: 7600,
    highHz: 8300,
    mode: 'attenuate',
    gainDb: -18,
  },
  {
    startSample: Math.round(2.1 * sampleRate),
    endSample: Math.round(2.18 * sampleRate),
    lowHz: 0,
    highHz: 400,
    mode: 'heal',
  },
], {
  nFft: 2048,
  hopLength: 512,
  window: 'hann',
  healRadiusFrames: 2,
});
```

```python [Python]
import libsonare as sonare

repaired = sonare.spectral_edit(
    samples,
    sample_rate,
    [
        sonare.SpectralRegionOp(
            start_sample=int(1.25 * sample_rate),
            end_sample=int(1.55 * sample_rate),
            low_hz=7600,
            high_hz=8300,
            gain_db=-18,
            mode="attenuate",
        ),
        sonare.SpectralRegionOp(
            start_sample=int(2.1 * sample_rate),
            end_sample=int(2.18 * sample_rate),
            low_hz=0,
            high_hz=400,
            mode="heal",
        ),
    ],
    n_fft=2048,
    hop_length=512,
    window="hann",
    heal_radius_frames=2,
)
```

:::

## Options

| Field | Meaning |
|-------|---------|
| `startSample` / `endSample` | Time rectangle in input samples. Omitting `endSample` (Python: leave `end_sample` at its default `-1` sentinel) spans to the end of the signal. In Python, `end_sample=0` is an empty region, not the full signal. |
| `lowHz` / `highHz` | Frequency rectangle in Hz. Values are clamped to `[0, Nyquist]`; `highHz <= 0` means Nyquist. |
| `gainDb` | Gain in dB. Applied identically by `gain` and `attenuate` as `magnitude *= 10^(gainDb/20)`; pass a negative value to reduce. Ignored by `mute`/`heal`. |
| `nFft` | Power-of-two FFT size, default `2048`. |
| `hopLength` | STFT hop, default `512`; must satisfy `0 < hopLength <= nFft / 2`. |
| `window` | `hann`, `hamming`, `blackman`, or `rectangular`. |
| `healRadiusFrames` | Neighbor frames on each side used by `heal`, default `2`; must be `>= 1`. |

Small regions usually work best. Broad, long, or repeatedly healed regions can sound phasey because the edit happens in an STFT representation rather than a source-separated model.
