---
title: Spectral Editing
description: "Region-based STFT editing in libsonare: attenuate, mute, gain, or heal time-frequency rectangles from JavaScript/WASM and Python."
---

# Spectral Editing

`spectralEdit(...)` is libsonare's region-based STFT editor. Use it to change a time and frequency rectangle inside a mono clip: attenuate a whistle, mute a short hum, boost a narrow band, or heal a small dropout from neighboring frames.

STFT (short-time Fourier transform) is the time-frequency grid a signal is cut into so it can be edited by frequency; the [glossary](./glossary/analysis/spectrogram-stft.md) explains it.

It is an offline transform. The output keeps the same sample rate and length as the input, and each region operation is applied in order to the same STFT buffer.

<SonareDemo id="spectral-edit" />

## When To Use It

| Goal | Mode |
|------|------|
| Turn a selected band up or down by an exact amount | `gain` |
| Reduce a selected band — same formula as `gain`, conventionally passed a negative `gainDb` | `attenuate` |
| Zero every bin inside the rectangle | `mute` |
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

A region given in seconds:

```typescript
const muted = spectralEdit(samples, sampleRate, [
  { startSec: 0.5, endSec: 1.5, lowHz: 0, highHz: 0, mode: 'mute' },
]);
```

## Options

<SonareDemo id="stft-basics" />

You give the region in samples and hertz, but the edit lands on the STFT grid those two options build:

<StftFramingFigure
  title="What nFft and hopLength build"
  caption="nFft is the length of one analysis window and hopLength is how far the next one starts after it, so at the defaults every window overlaps the previous one by three quarters. Each window becomes one spectrogram column — the vertical strips your time range is applied to, sliced into frequency bins your lowHz/highHz range picks from."
/>

| Field | Meaning |
|-------|---------|
| `startSample` / `endSample` | Time rectangle in input samples; the start defaults to `0`. Omit `endSample` (Python: leave `end_sample` as `None`) to span to the end of the signal. `endSample: 0` is an empty region, not the full signal, on every surface. A negative position is refused (`RangeError` in JavaScript, `SonareValueError` in Python); `-1` is not a "to the end" sentinel. |
| `startSec` / `endSec` | The same bounds in seconds (Python `start_sec` / `end_sec`), rounded to the nearest sample at the call's sample rate. Give one spelling per bound; both `startSample` and `startSec` (or both end spellings) is refused. |
| `lowHz` / `highHz` | Frequency rectangle in Hz. Values are clamped to `[0, Nyquist]`; `highHz <= 0` means Nyquist. |
| `gainDb` | Gain in dB. Applied identically by `gain` and `attenuate` as `magnitude *= 10^(gainDb/20)`; pass a negative value to reduce. Ignored by `mute`/`heal`. |
| `nFft` | Power-of-two FFT size in `[4, 262144]`, default `2048`. Any other positive value is refused with an error naming `nFft` and the rule. In JavaScript, `0` or omission keeps the default; Python refuses `0`. |
| `hopLength` | STFT hop, default `512`; must satisfy `0 < hopLength <= nFft / 2` (JavaScript reads `0` as the default). |
| `window` | `hann`, `hamming`, `blackman`, or `rectangular` (Python also accepts `rect`). |
| `healRadiusFrames` | Neighbor frames on each side used by `heal`, default `2`; `1` or more (`0` keeps the default, negatives are refused). |

## Resolution and edges

The rectangle is applied to whole STFT cells, so its sharpness is set by `nFft`:

| `nFft` at 48 kHz | Bin spacing | Window length | Good for |
|------------------|-------------|---------------|----------|
| `1024` | 46.9 Hz | 21 ms | Short clicks and fast events |
| `2048` (default) | 23.4 Hz | 43 ms | General use |
| `4096` | 11.7 Hz | 85 ms | A steady narrow tone, such as a whistle or hum |

- **Frequency edges.** The bins between `lowHz` and `highHz` change and the bins outside do not, with no taper between them. A tone sitting right at an edge spreads over neighboring bins (window leakage), so part of it can survive a `mute`. Leave a margin of a few bins around the band you want to remove.
- **Time edges.** The frames edited are those whose centers fall in the time range, rounded down to the `hopLength` grid, but each frame covers `nFft` samples. After resynthesis the change therefore fades in and out over about half a window on each side (about 21 ms at the defaults) instead of starting on the exact sample.
- **What `heal` does.** For each bin in the rectangle, `heal` averages the magnitude of up to `healRadiusFrames` unedited frames on each side, ramps between those two levels across the gap, and continues the phase from the last frame before the gap at the rate that bin's phase was already advancing (from the first frame after it when the gap starts the signal). A steady tone runs through the gap; anything that was only inside the gap, such as a click, is gone.

Small regions usually work best. Broad, long, or repeatedly healed regions can sound phasey because the edit happens in an STFT representation rather than a source-separated model.
