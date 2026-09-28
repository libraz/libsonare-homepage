---
title: Inverse Room Estimation
description: Impulse-response vs blind estimation, and the confidence score — how libsonare recovers a room from a recording and how far to trust the result.
---

# Inverse Room Estimation

Recovering a room from a recording is an **inverse problem**: forward acoustics asks "given this room, what does it sound like?"; libsonare asks the reverse — "given this sound, what room produced it?" The estimation mode and the confidence score are the two controls that govern how that inversion is done and how much to trust it.

## Forward vs inverse

In the forward direction, a known room is captured by its **impulse response (IR)** — the sound of a perfect, instantaneous click in the space, containing the direct sound plus every reflection and the full reverberant tail. Everything else (RT60, clarity, geometry, absorption) is derived from that one signal.

Inverse estimation runs the chain backward: from a recording, recover the decay, and from the decay infer the room. How well that works depends entirely on how clearly the decay can be heard in the recording — which is what the two modes are about.

## Impulse-response mode

In **impulse-response mode**, you give the analyzer a recording that *is* (or closely approximates) an impulse response: a hand clap, a balloon pop, a starter pistol, or a deconvolved recording of a played-back sine sweep. The decay is right there in the signal, clear and uncontaminated, so the estimate is at its most accurate. A raw recorded sine sweep is the excitation convolved with the room response, not an IR; deconvolve it with the known sweep before analysis. This is the mode to use whenever you can make the recording yourself.

Turn on "Treat as impulse response" when the uploaded file is one of these clean excitations or a deconvolved sweep response. The analyzer then reads the tail directly instead of trying to dig it out.

## Blind mode

In **blind mode**, the input is ordinary material — music, speech, a field recording — that was never meant to measure the room. There is no clean click; the reverberation is tangled up with the source signal. The analyzer must *blindly* recover the decay from the gaps, note offsets, and pauses in the audio, where the tail is briefly audible on its own.

<BlindDecayFigure
  title="Recovering a decay from music"
  caption="The tail is only visible where the program gets out of the way. Each gap exposes a different, partial slice of the decay, and the fit has to reconcile fragments that do not quite agree — which is what the confidence score is reporting on. Dense, gapless material offers no fragments to fit."
/>

<SonareDemo id="room-decay" />

Blind estimation is genuinely useful for ranking and visualizing spaces — comparing two rooms, getting a feel for a recording's environment — but it is **not an architectural measurement**. It is an informed inference: it can only recover decay that is actually audible in the source signal, so dense, gapless material — a loud, continuous master with no quiet moments — yields a weaker estimate than music with clear note releases and pauses.

::: tip What blind mode returns, and what it does not
Blind estimation recovers decay and only decay: `rt60`, the per-band RT60s, and the room estimate built on top of them. Clarity is not computed — `c50`, `c80`, and `d50` come back `NaN`. The blind path has no direct-sound arrival for an independent 0-to-−10 dB fit, so `edt` is `NaN`, and `edtBands` keeps the requested band count with every entry set to `NaN`.
:::

## Confidence

The **confidence** score, a percentage, reports how strongly the input supports the fitted decay. It does not establish that the assumed room geometry, absorption prior, or source distance is true. A clean impulse response with a long, uninterrupted tail scores high; noisy, compressed, or reverb-light material scores low.

| Confidence | How to read the result |
|------------|------------------------|
| High (≳ 70%) | The decay fit is well supported; check the priors before trusting derived geometry. |
| Moderate (~35–70%) | Usable for comparison and visualization; treat fine detail with caution. |
| Low (≲ 35%) | No clean decay region — the estimate is rough. Try an impulse-response recording. |

When confidence is low, record a clean impulse (clap or pop), or record a sine sweep and deconvolve it with the known excitation before analyzing the resulting IR in impulse-response mode. Low confidence is not a failure of the algorithm so much as a signal that the recording did not contain enough readable reverberation to fit.

::: details How libsonare inverts the recording
libsonare builds an energy decay curve from the input. In impulse-response mode the curve comes straight from the supplied IR; in blind mode it is recovered by locating segments where the reverberant tail is briefly audible — note releases, transient gaps, or silences — and stitching an estimate of the decay from them. Blind mode fits the late-decay RT60 only: it has no direct-sound arrival for EDT or clarity, so `edt` is `NaN` and `edtBands` retains the requested band count with every entry set to `NaN`. The confidence score describes support for the decay fit. On an impulse response it is dominated by how closely RT60 and EDT agree — a decay that reads the same length from its full 60 dB extrapolation as from its first-10 dB slope is a decay the fit trusts — plus a smaller term that is a fixed function of the configured `minDecayDb`. In blind mode, confidence comes from the recovered decay fit itself: how well an exponential explains the frame energies, how far the decay starts above the noise floor, and how long the fitted window is relative to the recovered RT60. For `estimateRoom(...)`, band coverage and absorption plausibility under the configured priors can also affect the returned confidence. It does not show that the assumed geometry, absorption prior, or source distance is true. A studio-measured, deconvolved sweep IR can score high because a long, clean tail fits well; a loud, dense, heavily compressed master scores low because it exposes only short, noisy fragments of tail.
:::

Related: [Reverberation Time (RT60 and EDT)](./reverberation-time.md), [Room Geometry and Volume](./room-geometry.md), [Source Distance and DRR](./source-distance.md), [Acoustic Analysis](../../acoustic-analysis.md)
