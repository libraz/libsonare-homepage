---
title: Mono Compatibility
description: Why stereo width should still survive mono playback and phase cancellation.
---

# Mono Compatibility

Mono compatibility describes how well a stereo master survives when the left and right channels are summed to mono.

Many playback situations still collapse stereo partially or completely: phones, smart speakers, club systems, broadcast paths, public spaces, and accessibility devices. A master can sound wide and impressive in headphones but lose vocals, bass, or important effects when summed.

## Why Width Can Break

Width comes from differences between left and right. Panned instruments, room reflections, and natural stereo recording are healthy differences. Phase cancellation is the harmful kind: when the channels are summed, out-of-phase content (opposite polarity, negative correlation, or a delay that puts some frequencies out of phase) subtracts instead of adding. Being merely decorrelated does not guarantee cancellation.

Summed to mono, the canceled content disappears. The result can be:

- Vocals become weaker.
- Bass loses focus.
- Reverb or effects disappear.
- High frequencies feel hollow.
- The whole master becomes smaller than expected.

## Correlation

Correlation is a single number, from +1 to -1, that estimates how similar the left and right channels are. Meters display it so you can watch it while you work.

| Correlation | Practical reading |
|-------------|-------------------|
| Near +1 | Very similar channels; mono-safe but possibly narrow. |
| Around 0 | Wide or decorrelated material; check mono carefully. |
| Below 0 | Strong phase opposition; mono cancellation risk. |

Correlation is not a full answer. Some wide mixes are safe, and some narrow mixes still have local phase problems. Always listen in mono when width decisions matter.

<SonareDemo id="mono-fold" />

## Mastering Tradeoff

Stereo widening can make a master feel larger, but it should not weaken the center. Kick, bass, lead vocal, and snare usually need a stable mono foundation. Low frequencies are especially sensitive; widening the low end can make playback inconsistent.

Use width as a finishing move, not a way to fix arrangement problems.

## Verification Order

A/B in stereo first to verify that the added width is musically useful. Then switch to mono and check that lead vocal, kick, bass, and snare are still anchored. Look at correlation last: even when the meter looks safe, back off if the central elements weaken in mono.

Widening tends to flatter on first listen, so it is important to compare short, [loudness-matched](./loudness-matching.md) phrases. If the side energy increased while the center merely feels smaller, that is a balance shift in disguise — not an actual mastering improvement.

## Measure it in libsonare

`meteringStereoCorrelation` returns +1 for identical channels and -1 for inverted ones. `meteringStereoWidth` is the side-to-mid amplitude ratio: 0 for identical channels (pure mono), about 1 for wide stereo, and larger as the channels drift out of phase (infinite when the mid signal cancels completely).

::: code-group

```typescript [Browser]
import { init, meteringStereoCorrelation, meteringStereoWidth } from '@libraz/libsonare';

await init();

// left, right: equal-length Float32Array channels
const correlation = meteringStereoCorrelation({ left, right, sampleRate });
const width = meteringStereoWidth({ left, right, sampleRate });
```

```python [Python]
import libsonare as sonare

correlation = sonare.metering_stereo_correlation(left, right, sample_rate)
width = sonare.metering_stereo_width(left, right, sample_rate)
```

```bash [CLI]
sonare stereo left.wav --reference right.wav   # native CLI only: correlation and width from two mono files
```

:::

The mastering demo shows phase and correlation information and exposes stereo width in Quick and Studio modes. Use the width control conservatively, then compare against the reference and check the correlation reading.

:::: details Implementation notes

Correlation is a practical indicator computed from a short range of the left and right channels. Values near `+1` mean the channels are very similar, values around `0` mean more independent side material, and negative values mean stronger opposite-polarity content.

The demo's stereo width control is meant for finishing adjustments that preserve the center. Widening that weakens low end or the main center elements is likely to fail mono playback, so the control should be used conservatively.

::::

Related: [Reference Track](./reference-track.md), [Dynamic Range](./dynamic-range.md), [Mastering](../mastering.md)
