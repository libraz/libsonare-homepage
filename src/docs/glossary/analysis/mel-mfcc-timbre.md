---
title: Mel, MFCC, and Timbre
description: The mel scale, mel spectrograms, MFCCs, spectral centroid, and flatness — the features that describe what audio sounds like rather than which notes it plays.
---

# Mel, MFCC, and Timbre

Some questions are not about *which notes* but about *what the sound is like* — bright or dark, smooth or noisy, a flute or a distorted guitar. That is **timbre**, and the features here describe it. They build on the spectrogram from [Spectrogram and STFT](./spectrogram-stft.md).

## Timbre: the "color" of a sound

**Timbre** (pronounced "TAM-ber") is what makes a piano and a guitar sound different even on the same note at the same loudness. It comes from the relative strengths of a sound's overtones and how they evolve. Pitch tells you the note; timbre tells you the voice.

## The mel scale: frequency the way we hear it

Humans do not hear frequency linearly. The jump from 100 Hz to 200 Hz feels large, while 5000 Hz to 5100 Hz feels like almost nothing.

The **mel scale** is a perceptual frequency scale that matches this behavior: fine resolution in the low range, coarser resolution in the high range.

A **mel spectrogram** re-maps the STFT onto that scale. Its detail is concentrated where our ears can actually discriminate, which is why it is the default front-end for many audio machine-learning systems.

Put another way, a mel spectrogram is a map of the sound drawn closer to how the ear reads it, in a form machines handle easily. A plain spectrogram spaces frequency evenly; mel keeps fine steps in the low range, where hearing discriminates, and groups the high range, where it does not.

<MelBankFigure
  title="Even spacing on one scale, uneven on the other"
  caption="The filters are laid out at equal steps along the mel scale. Viewed back in hertz that same layout is narrow and tightly packed at the bottom and wide and sparse at the top — so the low range, where hearing discriminates finely, gets many filters and the top gets few."
/>

<SonareDemo id="mel-spectrogram" />

## MFCC: a compact timbre fingerprint

**MFCCs (Mel-Frequency Cepstral Coefficients)** compress a mel spectrogram into a small set of numbers.

They are designed to capture the *spectral envelope*: the overall shape of the spectrum, while ignoring fine pitch detail.

The calculation has three main steps:

1. Build a mel spectrogram.
2. Take the log of the mel energies.
3. Apply a DCT (discrete cosine transform), a cosine-basis transform that concentrates information into the first few coefficients.

The result is a compact timbre "fingerprint" used to classify instruments, voices, and sound types.

MFCCs are a summary for classification and comparison, not data you play back. They answer questions like "is this closer to a voice or a drum?" or "did the timbre change between the first and second half?"; to know *which note* is sounding, use chroma or pitch detection instead.

<SonareDemo id="mfcc-map" />

## Single-number brightness: centroid and flatness

Two scalars summarize spectral shape per frame:

| Feature | Measures | High value means |
|---------|----------|------------------|
| Spectral **centroid** | The "center of mass" of the spectrum (Hz) | Brighter, more high-frequency energy |
| Spectral **flatness** | How noise-like vs. tonal (0–1) | Closer to noise (1) rather than a clear pitch (0) |

These are cheap brightness/noisiness proxies — useful for UI meters, thresholds, and quick descriptors when a full MFCC vector is more than you need.

::: warning Silence reads as flatness 1.0, not 0
Flatness is the geometric mean of the power spectrum divided by its arithmetic mean, with every bin floored at `amin` (1e-10) before the means are taken. A digitally silent frame therefore has a perfectly constant floored spectrum, and the ratio comes back as `1.0` — "maximally noise-like", the opposite of what the silence suggests. libsonare matches `librosa.feature.spectral_flatness` here and deliberately does not special-case silence.

Gate on level first: check RMS or peak for the frame and ignore the flatness reading below your noise floor. A UI meter or noise gate driven straight off flatness will light up during the quiet parts.
:::

::: details How libsonare computes these
`MelSpectrogram` applies a mel filterbank to STFT power to build the mel spectrogram, then derives MFCCs through log compression and a DCT-style step.

| Item | Detail |
|------|--------|
| Mel layout | `n_mels = 128`, `fmin` / `fmax` (0 = sr/2) |
| Analysis window | `n_fft = 2048` / `hop_length = 512`, Hann window |
| Mel scale formula | `htk = false` selects the Slaney formula, `true` the HTK formula (the choice of scale equation itself) |
| Normalization | `norm = MelNorm::Slaney` (area-normalizes each filter). Independent of the scale formula, so HTK scale with Slaney normalization is a valid combination |
| Liftering | The trailing `lifter` parameter of `mfcc` (cepstral liftering, default 0 = none) matches librosa's `lifter` argument |
| Scalar descriptors | Spectral centroid and flatness are computed directly from the per-frame magnitude spectrum |

These follow librosa conventions closely enough for reference comparison. The spectral descriptors are reused by higher-level descriptors such as `TimbreAnalyzer`; mel and MFCC can also be inverted to approximate audio for previews (see Inverse Features).
:::

Related: [MIR Overview](../concepts/mir-overview.md), [Spectrogram and STFT](./spectrogram-stft.md), [Section and Structure](./section-structure.md), [Chroma Features](./chroma-features.md)
