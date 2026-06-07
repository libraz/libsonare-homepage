---
title: Inverse Room Estimation
description: Impulse-response vs blind estimation, and the confidence score — how libsonare recovers a room from a recording and how far to trust the result.
---

# Inverse Room Estimation

Recovering a room from a recording is an **inverse problem**: forward acoustics asks "given this room, what does it sound like?"; libsonare asks the reverse — "given this sound, what room produced it?" The estimation mode and the confidence score are the two controls that govern how that inversion is done and how much to trust it.

## Forward vs inverse

In the forward direction, a known room is captured by its **impulse response (IR)** — the sound of a perfect, instantaneous click in the space, containing the direct sound plus every reflection and the full reverberant tail. Everything else (RT60, clarity, geometry, absorption) is derived from that one signal.

Inverse estimation runs the chain backward: from a recording, recover the decay, and from the decay infer the room. How well that works depends entirely on how clearly the recording exposes the decay — which is what the two modes are about.

## Impulse-response mode

In **impulse-response mode**, you give the analyzer a recording that *is* (or closely approximates) an impulse response: a hand clap, a balloon pop, a starter pistol, or a played-back sine sweep. The decay is right there in the signal, exposed and uncontaminated, so the estimate is at its most accurate. This is the mode to use whenever you can make the recording yourself.

Turn on "Treat as impulse response" when the uploaded file is one of these clean excitations. The analyzer then reads the tail directly instead of trying to dig it out.

## Blind mode

In **blind mode**, the input is ordinary material — music, speech, a field recording — that was never meant to expose the room. There is no clean click; the reverberation is tangled up with the source signal. The analyzer must *blindly* recover the decay from the gaps, note offsets, and pauses in the audio, where the tail is briefly audible on its own.

Blind estimation is genuinely useful for ranking and visualizing spaces — comparing two rooms, getting a feel for a recording's environment — but it is **not an architectural measurement**. It is an informed inference, and it inherits whatever the source signal happened to reveal.

## Confidence

The **confidence** score, a percentage, reports how reliable the estimate is, based on the quality of the decay region the analyzer found. A clean impulse response with a long, uninterrupted tail scores high; noisy, compressed, or reverb-light material scores low.

| Confidence | How to read the result |
|------------|------------------------|
| High (≳ 70%) | A clean decay was found; the numbers are trustworthy. |
| Moderate (~35–70%) | Usable for comparison and visualization; treat fine detail with caution. |
| Low (≲ 35%) | No clean decay region — the estimate is rough. Try an impulse-response recording. |

When confidence is low, the fix is almost always the same: record a clean impulse (clap, pop, sweep) and analyze that in impulse-response mode. Low confidence is not a failure of the algorithm so much as a signal that the recording did not contain enough exposed reverberation to invert.

::: details How libsonare inverts the recording
libsonare builds an energy decay curve from the input and fits room parameters (RT60, clarity, per-band absorption, volume, DRR) to it. In impulse-response mode the decay curve comes straight from the supplied IR; in blind mode it is recovered by locating segments where the reverberant tail is briefly exposed — note releases, transient gaps, silences — and stitching an estimate of the decay from them. The confidence score combines how much clean decay was found, how linear it was, and how far the fit had to extrapolate, so it scales naturally from high on a studio-measured sweep to low on a loud, dense, heavily compressed master.
:::

Related: [Reverberation Time (RT60 and EDT)](./reverberation-time.md), [Room Geometry and Volume](./room-geometry.md), [Source Distance and DRR](./source-distance.md), [Acoustic Analysis](../../acoustic-analysis.md)
