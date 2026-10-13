---
title: Crossover Slope and Mode
description: How libsonare's multiband processors split a signal into bands — the slope in dB per octave, the Linkwitz-Riley, Butterworth, Bessel and linear-phase FIR modes, and what each costs in latency, phase and flatness.
---

# Crossover Slope and Mode

Every multiband processor starts by cutting the signal into frequency bands, processing each band, and adding the bands back together. The **crossover** does the cutting. Its settings decide two things a listener can hear even when every band is left untouched: whether the bands add back to the original level, and what happens to timing and phase on the way through.

## The cutoff and the slope

A **cutoff** is the frequency where one band hands over to the next. A filter cannot stop dead at a frequency, so each band fades out across the cutoff, and the **slope** says how fast: how many decibels the band loses per octave past it. A gentle slope lets the neighboring bands overlap widely, so a compressor on the low band still reacts to some of the mids. A steep slope keeps each band to its own range, at the cost of more filter sections.

libsonare names its slopes by filter order. `lr2`, `lr4` and `lr8` are second, fourth and eighth order: 12, 24 and 48 dB per octave. The `lr` prefix only names the order; the same three values set the order of the Butterworth and Bessel modes too. Measured on the low band of `multiband.compressor` with a 120 Hz cutoff, the band one octave above the cutoff sits at −14.0, −24.6 and −48.2 dB, and two octaves above at −24.6, −48.2 and −96.3 dB.

## Four modes

The **mode** picks the filter family. With the slope fixed, the families differ in where each band sits at the cutoff, and so in what the sum looks like. The figures below come from `multiband.compressor` at the default 120 Hz and 2 kHz cutoffs and the default `lr4` slope, with every band's ratio at 1, so the processor changes nothing except through its crossover.

| `mode` | Band level at the cutoff | Summed bands at `lr4` | Latency |
|---|---|---|---|
| `linkwitzRiley` (default) | −6.0 dB | Flat (0.00 dB), phase rotated | 0 |
| `butterworth` | −3.0 dB | +3.0 dB bump at each cutoff | 0 |
| `bessel` | −3.0 dB, gentler roll-off | +1.7 dB bump at each cutoff | 0 |
| `firLinearPhase` | −6.0 dB when the kernel is long enough | Exact (0 dB, 0°) after the delay | `(firKernelSize − 1) / 2` samples |

Only Linkwitz-Riley and the FIR mode sum flat at every slope. The other two peak at each cutoff, by an amount that depends on the slope:

| Sum at the 120 Hz and 2 kHz cutoffs | `lr2` | `lr4` | `lr8` |
|---|---|---|---|
| `butterworth` | +3.0 dB | +3.0 dB | +3.0 dB |
| `bessel` | +2.7 dB | +1.7 dB | +3.0 dB |

Both cutoffs read the same to within 0.05 dB. At some slopes the two bands sit more than a quarter cycle apart in phase at the cutoff, and added as they are they would cancel. libsonare inverts the high band of every such pair, so the sum rises at the cutoff instead of notching, and in a split of three or more bands it phase-compensates the lower bands. Linkwitz-Riley and the linear-phase FIR mode are unchanged by this.

<CrossoverSumFigure
  title="Summed bands around one cutoff"
  caption="The low and high band added back together around a single cutoff, from each mode's two-band filter response with the out-of-phase pair inverted. Linkwitz-Riley and the FIR mode sum flat, Butterworth at lr2 and lr4 peaks at +3 dB, and Bessel at lr4 peaks at +1.7 dB with shallow dips about an octave to either side. The measured three-band split above reads the same at the cutoff."
/>

**Linkwitz-Riley** is the default because two bands each 6 dB down at the cutoff add back to unity. The sum is flat in level at every slope, but not in phase: it behaves as an all-pass filter, delaying different frequencies by different amounts. At the `lr4` default the summed signal is rotated −67° at 1 kHz and about 180° near each cutoff. On sustained material this is inaudible; on a sharp transient it slightly smears the attack.

**Butterworth** gives each band its flattest possible passband, but two bands each 3 dB down add to +3 dB at every cutoff at every slope. **Bessel** keeps each band's own timing tidier, at the cost of the gentlest roll-off of the three (−13.4 dB one octave past the cutoff at `lr4`, where Linkwitz-Riley gives −24.6) and a sum that bumps by +1.7 to +3 dB at the cutoff and dips by about 1 dB an octave either side at `lr4`. Choose either when a band is going to be heavily processed anyway and the summed response is not the point.

**Linear-phase FIR** replaces the recursive filters with a symmetric windowed-sinc kernel per cutoff. The upper band is the delayed input minus the lower one, so the bands sum back to the input exactly, with no phase rotation at any frequency. The `slope` key is ignored in this mode (`lr2` and `lr8` render identical output); `firKernelSize` sets the steepness instead.

## What the FIR mode costs

The FIR mode buys exact reconstruction with three costs.

- **Latency.** Every band is delayed by half the kernel so the bands stay aligned: 256 samples at the default 513 taps (5.3 ms at 48 kHz), 1024 at 2049. The IIR modes add none. The insert reports the delay, and `masteringProcess` returns output already aligned with its input.
- **Resolution in hertz, not octaves.** A kernel's transition band has a fixed width in Hz, so the same kernel that splits cleanly at 1 kHz cannot resolve a low cutoff. At 120 Hz with 513 taps the low band is already −1.3 dB at 60 Hz and only −5.3 dB at the cutoff; 4097 taps restore the −6.0 dB crossing and 0.0 dB an octave below, at a latency of 2048 samples.
- **A floor and pre-ringing.** The Hann-windowed kernel's rejection bottoms out between about −43 and −52 dB rather than falling for ever, and a symmetric kernel rings before a transient as well as after it.

Leave the default Linkwitz-Riley in anything that runs live or tracks a performer. Reach for `firLinearPhase` in an offline master where the bands are processed differently enough that phase alignment between them matters, and size the kernel for the lowest cutoff, not the highest.

::: details How libsonare configures the crossover
The crossover is shared by every `multiband.*` processor (`compressor`, `expander`, `limiter`, `imager`, `saturation` and `dynamicEq`) wherever it is hosted: a solo `masteringProcess` call, a mixer strip, or a realtime engine insert. Its insert keys are `cutoff0Hz` … `cutoff7Hz` (up to 8 cutoffs, strictly ascending, positive, below Nyquist; defaults 120 and 2000 Hz), `slope` (`'lr2'` / `'lr4'` / `'lr8'`, default `'lr4'`), `mode` (`'linkwitzRiley'` / `'butterworth'` / `'bessel'` / `'firLinearPhase'`) and `firKernelSize` (default 513, odd and at least 3; an even size is refused). All four are construction parameters, not automatable controls. In the mastering chain the same settings live under `dynamics.multibandComp.crossover` as `{ cutoffsHz, slope, mode, firKernelSize }`, where `cutoffsHz` replaces the cutoff list and sets the band count; the chain takes up to 63 cutoffs and 64 bands (see [the chain-config schema](../../mastering-processors.md#the-chain-config-json-schema)). `masteringInsertTiming(name, params, sampleRate)` reports the latency for an exact configuration. In a multi-way Linkwitz-Riley split, each lower band passes through the all-pass sections of the splits above it so all bands carry the same phase rotation and still sum flat.
:::

Related: [Dynamics Controls](./dynamics.md), [Mastering Processors](../../mastering-processors.md#the-chain-config-json-schema), [Effects Inserts](../../effects-inserts.md), [Realtime Safety](../realtime/realtime-safety.md)
