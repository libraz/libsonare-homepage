---
title: Gain Staging
description: Keeping signal levels sensible before, during, and after mastering.
---

# Gain Staging

Gain staging means keeping signal levels in a useful range as audio moves through a chain. In mastering, it prevents the [compressor](../mastering/dynamics.md), exciter (a processor that adds harmonic brightness), stereo stage, [limiter](./true-peak-safety.md), and [loudness stage](../mastering/stereo-limiter-loudness.md) from reacting to a misleading level.

Good gain staging is not about making everything quiet. It is about leaving enough room for processing decisions to remain meaningful.

<GainLadderFigure
  title="One scale, every stage on it"
  caption="Each bar spans a stage's average level up to its peak level. Read this way the three separate decisions stop overlapping: the space above the peaks is headroom, the compressor threshold is a level the incoming signal is compared against, and the ceiling is a peak-safety limit — not a loudness target, which is set later and measured in LUFS instead."
/>

## Reference Levels

The figure uses these levels. The first row is the figure's example source; the rest are controls and their defaults.

| Point in the chain | Level |
|--------------------|-------|
| Source in the figure | Peak about -6 dBFS, average about -20 dBFS |
| Input Gain (demo control) | 0 dB by default, adjustable from -12 to +12 dB |
| Compressor threshold | -18 dB by default (ratio 2:1, attack 10 ms, release 100 ms) |
| True-peak ceiling | -1 dBTP by default |
| Delivery loudness | Set by `loudness.targetLufs`, separately from the ceiling |

On a mixer strip the same idea is the input trim: `inputTrimDb` in `mixStereo`, ahead of the fader. See [Mixing Basics](./mixing-basics.md).

## Why It Matters

If the source is too hot (its level is too high), every processor may behave as if the track needs heavy control. Compression can become too dense, saturation can get harsh, and the limiter can work harder than needed.

If the source is too quiet, processors may barely react. You may then overcompensate later with loudness or limiting, which hides the real issue.

## Practical Mastering Checks

1. Check whether the source is clipped before doing anything.
2. Leave Input Gain at `0 dB` unless the source is clearly too quiet or too hot.
3. Adjust dynamics by listening to gain reduction and punch, not by chasing a fixed threshold number.
4. Let the loudness optimizer handle final delivery gain.
5. Keep true-peak ceiling separate from loudness ambition.

## Common Misjudgments

A quiet source does not need a large initial lift. Compressors and limiters downstream will react harder than they should, and the result tends to be a dense, fatiguing master. The opposite — keeping the input quiet and chasing loudness only at the very end — hides which stage is doing what to the signal.

Input Gain is not the place to set "how loud the listener hears it." It is the place to set the level entering the chain. Final delivery loudness belongs to the loudness stage, and peak safety belongs to the True Peak limiter.

## Gain Staging vs Loudness Target

Gain staging is about how processors react inside the chain. Loudness target is about where the final rendered file lands. Do not solve one with the other.

If the master is too dense, lowering the loudness target may help, but you should also check threshold, ratio, attack, release, and input level.

## Measure it in libsonare

Run the loudness stage and read what it did. `appliedGainDb` is the static gain the stage added, before any limiter gain reduction. `loudnessTargetLimited` is `true` when the ceiling stopped the stage short, so `outputLufs` is the level actually reached rather than the target.

::: code-group

```typescript [Browser]
import { init, masteringChain } from '@libraz/libsonare';

await init();

const r = masteringChain(samples, sampleRate, {
  loudness: { targetLufs: -14, ceilingDb: -1 },
});

console.log(r.inputLufs, r.appliedGainDb, r.outputLufs, r.loudnessTargetLimited);
// For the site's mix.wav: -18.6, 4.6, -14.8, true (the ceiling stopped it 0.8 LU short)
```

```python [Python]
import libsonare as sonare

r = sonare.mastering_chain(
    samples, sample_rate,
    {"loudness": {"targetLufs": -14, "ceilingDb": -1}},
)

print(r.input_lufs, r.applied_gain_db, r.output_lufs, r.loudness_target_limited)
```

```bash [CLI]
sonare mastering track.wav --target-lufs -14 --ceiling-db -1 -o master.wav
# prints input LUFS, output LUFS and the applied gain
```

:::

In the request-object form, `masteringChain({ samples, sampleRate, config })`, the stage settings go under `config`.

:::: details Implementation notes

The demo exposes Input Gain as a narrow control and keeps final gain inside the loudness stage. This avoids making compressor threshold decisions depend on large arbitrary input moves. The exported report records both source and rendered metrics so gain decisions can be audited after rendering.

Moving Input Gain changes the signal level reaching every downstream detector.

That affects several later stages:

| Stage | What changes when input gain moves |
|-------|------------------------------------|
| Compressor | The same threshold can react more or less strongly |
| Saturation | The same drive setting can distort more or less |
| Limiter | Gain reduction can increase or decrease |

After a large Input Gain move, re-check the dynamics and limiter settings. After changing presets, reset Input Gain to its default unless you intentionally want to carry the old offset forward.

::::

Related: [Repair and Input Controls](../mastering/repair.md), [Dynamics Controls](../mastering/dynamics.md), [Delivery Targets](../mastering/delivery-targets.md)
