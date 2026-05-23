---
title: What Is Mastering?
description: A practical explanation of mastering, what it can fix, and what it should not be expected to fix.
---

# What Is Mastering?

Mastering is the final quality-control and delivery step after mixing. It prepares a finished mix so it translates across streaming platforms, phones, headphones, speakers, cars, and codec conversion.

The key point is that mastering works on the finished stereo mix. It can adjust broad tone, loudness, density, stereo behavior, and peak safety, but it cannot independently rebalance the vocal, kick, guitar, or snare once those sounds are already combined.

## What Mastering Does

Mastering usually answers five practical questions:

| Question | Mastering task |
|----------|----------------|
| Is the track too quiet or too loud compared with its destination? | Loudness measurement and normalization |
| Is the tonal balance broadly too dark, harsh, thin, or boomy? | Wide EQ, tilt EQ, and tonal shaping |
| Does the mix feel too jumpy or too flat? | Gentle dynamics control and limiting |
| Is the stereo image useful and mono-compatible? | Stereo width, mid/side checks, phase correlation |
| Will the file survive encoding and playback without clipping? | True-peak limiting and ceiling management |

Good mastering is often subtle. A useful master may only be 1-2 dB of EQ, a small amount of compression, and a limiter catching peaks. Heavy processing is sometimes appropriate, but it should solve a real problem rather than make every track louder by default.

## What Mastering Cannot Fix

Mastering is not a replacement for mixing. If the lead vocal is buried, the snare is too loud, or the bass note balance is uneven, the cleanest fix is usually in the mix session.

Mastering can make broad changes:

- It can make the whole low end tighter.
- It can make the whole track brighter or warmer.
- It can reduce excessive peaks.
- It can make playback loudness more predictable.

Mastering cannot cleanly isolate and change one instrument after the mix is printed. Extreme mastering moves often reveal that the source mix needs revision.

## In The libsonare Demo

The libsonare mastering demo runs the entire chain in the browser through WebAssembly. Your audio file is decoded locally, processed locally, and exported locally as WAV. There is no upload step.

Quick Master is designed for a practical first pass:

1. Load a source file.
2. Choose what kind of material it is.
3. Choose the destination loudness target.
4. Render and compare before/after with loudness matching.

Studio mode exposes the same idea as modules: repair, EQ, dynamics, air band, stereo image, limiter, loudness target, and output.

## How To Judge A Master

Use loudness-matched A/B comparison when judging whether processing helped. Louder usually sounds better for a few seconds, even when it is not actually better.

Then check three things:

- **Translation:** Does it still work on small speakers and headphones?
- **Peak safety:** Does the true-peak ceiling leave enough margin for conversion?
- **Intent:** Does the result fit the source, or did the chain force it into the wrong style?

The best master is not always the loudest or brightest one. It is the version that preserves the musical intent while making the file reliable for release.

:::: details Implementation notes

The browser demo maps the general mastering idea into a fixed chain configuration: optional repair, broad tone shaping, dynamics, air-band or exciter stages, stereo imaging, true-peak limiting, and loudness optimization.

Quick Master selects sensible starting values for that chain. Studio exposes the same chain as editable modules. Both paths end in the same render flow, so the difference is interface depth rather than a separate processing engine.

::::

Related: [LUFS](../lufs.md), [True Peak](../true-peak.md), [A/B comparison](../ab-comparison.md)
