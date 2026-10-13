---
title: What Is Mastering?
description: A practical explanation of mastering, what it can fix, and what it should not be expected to fix.
---

# What Is Mastering?

Mastering is the final quality-control and delivery step after mixing. It prepares a finished mix so it *translates* — sounds the way you intended — across streaming platforms, phones, headphones, speakers, cars, and codec conversion.

The key point is that mastering works on the finished stereo mix. It can adjust broad tone, loudness, density, stereo behavior, and peak safety, but it cannot independently rebalance the vocal, kick, guitar, or snare once those sounds are already combined.

## What Mastering Does

Mastering usually answers five practical questions:

| Question | Mastering task | In libsonare |
|----------|----------------|--------------|
| Is the track too quiet or too loud compared with its destination? | [Loudness](../lufs.md) measurement and normalization | `lufs`, `loudness.targetLufs` |
| Is the tonal balance broadly too dark, harsh, thin, or boomy? | Wide EQ, tilt EQ, and tonal shaping | `eq.tilt` |
| Does the mix feel too jumpy or too flat? | Gentle dynamics control and limiting | `dynamics.compressor`, `maximizer.truePeakLimiter` |
| Is the stereo image useful and [mono-compatible](./mono-compatibility.md)? | Stereo width, mid/side (center versus sides) checks, phase correlation | `stereo.imager`, `meteringStereoCorrelation` |
| Will the file survive encoding and playback without clipping? | [True-peak](../true-peak.md) limiting and ceiling management | `maximizer.truePeakLimiter`, `meteringTruePeakDb` |

Good mastering is often subtle. A useful master may only be 1-2 dB of EQ, a small amount of compression, and a limiter catching peaks. Heavy processing is sometimes appropriate, but it should solve a real problem rather than make every track louder by default.

## What Mastering Cannot Fix

Mastering is not a replacement for mixing. If the lead vocal is buried, the snare is too loud, or the bass note balance is uneven, the cleanest fix is usually in the mix session.

Mastering can make broad changes:

- It can make the whole low end tighter.
- It can make the whole track brighter or warmer.
- It can reduce excessive peaks.
- It can make playback loudness more predictable.

Mastering cannot cleanly isolate and change one instrument after the mix is printed. Extreme mastering moves often reveal that the source mix needs revision.

## In libsonare

The libsonare [mastering demo](/mastering) runs the entire chain in the browser through WebAssembly. Your audio file is decoded locally, processed locally, and exported locally as WAV. There is no upload step.

Quick Master is designed for a practical first pass:

1. Load a source file.
2. Choose what kind of material it is.
3. Choose the destination loudness target.
4. Render and compare before/after with loudness matching.

Studio mode exposes the same chain stage by stage. The stages always run in the order below; a preset or a Studio setting decides which ones are on, never where they sit.

<MasteringChainFigure
  title="The chain, in the order the engine runs it"
/>

The same chain is available from code. A preset is a starting point, and the delivery target sets the loudness and ceiling.

::: code-group

```typescript [Browser]
import { init, masterAudio, masteringPresetNames, masteringPlatformNames } from '@libraz/libsonare';

await init();

const presets = masteringPresetNames();       // 'pop', 'edm', 'acoustic', ...
const targets = masteringPlatformNames();     // 'streaming', 'broadcast', 'club', ...

const master = masterAudio(samples, sampleRate, 'pop');
console.log(master.inputLufs, master.outputLufs, master.outputTruePeakDbtp);
```

```python [Python]
import libsonare as sonare

presets = sonare.mastering_preset_names()
targets = sonare.mastering_platform_names()

master = sonare.master_audio(samples, sample_rate, "pop")
print(master.input_lufs, master.output_lufs, master.output_true_peak_dbtp)
```

```bash [CLI]
sonare mastering track.wav --preset pop -o master.wav
```

:::

## How To Judge A Master

Use [loudness-matched](./loudness-matching.md) A/B comparison when judging whether processing helped. Louder usually sounds better for a few seconds, even when it is not actually better.

Then check three things:

- **Translation:** Does it still work on small speakers and headphones?
- **Peak safety:** Does the true-peak ceiling leave enough margin for conversion?
- **Intent:** Does the result fit the source, or did the chain force it into the wrong style?

The best master is not always the loudest or brightest one. It is the version that preserves the musical intent while making the file reliable for release.

:::: details Implementation notes

The browser demo maps the general mastering idea into a fixed chain configuration: optional repair, broad tone shaping, dynamics, air-band or exciter stages, stereo imaging, true-peak limiting, and loudness optimization.

Quick Master selects sensible starting values for that chain. Studio exposes the same chain as editable modules. Both paths end in the same render flow, so the difference is interface depth rather than a separate processing engine.

::::

Related: [LUFS](../lufs.md), [True Peak](../true-peak.md), [Loudness Matching and A/B Comparison](./loudness-matching.md)
