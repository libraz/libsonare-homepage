---
title: Inverse Features
description: libsonare inverse feature helpers — reconstruct an approximate STFT, mel spectrogram, or preview audio from mel/MFCC features via Griffin-Lim, with exact result shapes and the parameters you must keep.
---

# Inverse Features

Most of libsonare turns audio into features: a mel spectrogram, MFCCs, a chromagram.

The **inverse** helpers go the other way. They take those features and reconstruct an *approximate* spectrum or preview audio.

These helpers are useful when you need to debug a feature pipeline, build an audible preview of what a model "hears", test round trips, or port librosa-style notebooks to native or browser code.

::: tip New to analysis? This is not the first page
These helpers assume you already produce mel spectrograms or MFCCs. If you are just getting started, read [Getting Started](./getting-started.md) and the feature-extraction sections of the [JavaScript API](./js-api-features.md#feature-extraction) or [Python API](./python-api-analysis.md#feature-extraction) first, then come back when you need to invert what you computed.
:::

## What You Will Learn

By the end of this page you should be able to:

- explain why mel/MFCC inversion is approximate and why phase cannot be recovered from the feature alone;
- keep the `sampleRate`, `nFft`, `hopLength`, `nMels`, `nMfcc`, `fmin`, `fmax`, `htk`, and MFCC `lifter` values needed for a correct round trip, or hand the forward result back and let it carry them;
- choose `melToStft`, `melToAudio`, `mfccToMel`, `mfccToAudio`, `cqtToAudio`, or `vqtToAudio` based on the feature matrix and whether you need preview audio;
- compare JavaScript and Python return shapes without confusing row counts, frame counts, and flattened data.

## What "inverse" means here

An inverse does not undo a feature transform. It builds something that sounds plausible from the features. Think of keeping only the outline of a color photograph, then redrawing the photo from that outline: the shapes come back, but the fine detail and the colors do not.

A forward feature transform is **lossy on purpose**. Two kinds of information are thrown away, and no inverse can invent them back:

- **The mel filterbank is not square.** A mel spectrogram folds the frequency bins of the STFT (short-time Fourier transform) — ~1025 bins for `nFft = 2048`, i.e. `nFft/2 + 1` — down to, say, 128 mel bands. Inverting it spreads each mel band's energy back across the bins it came from — a least-squares best guess, not the original detail.
- **Phase is discarded entirely.** A magnitude or power spectrogram keeps *how much* energy sits at each frequency, but not *where in the waveform cycle* it sits. Audio reconstruction has to **invent a plausible phase**, which is what Griffin-Lim does.

MFCCs add a third loss on top: they keep only the first `nMfcc` cepstral coefficients (often 13–20), which hold the coarse spectral envelope and discard the fine structure inside it — the harmonic detail and the sharp edges of formants. Inverting MFCCs therefore reconstructs a *smoothed* mel spectrogram before any audio is recovered.

::: details What is a cepstral coefficient?
A cepstrum is a spectrum of a spectrum: take the log of a magnitude spectrum and transform it again. The classical cepstrum uses an inverse Fourier transform; MFCCs instead apply a DCT (discrete cosine transform) to the log *mel* band energies. Either way, the low coefficients describe the broad shape of the spectrum (timbre) and the high ones its fine detail. MFCCs keep only the first several of these coefficients, which is why they describe overall tonal color compactly but cannot reconstruct fine spectral detail.
:::

::: warning Reconstruction is an approximation, never a restoration
The output is meant for inspection and preview, not for getting your original recording back. Expect a recognizable but "phasey" or smeared result, especially from MFCCs or with few Griffin-Lim iterations. If you need the real audio, keep the real audio.
:::

## The four helpers

<FlowDiagram
  title="Mel/MFCC round trip"
  :nodes="[
    { id: 'audio', label: 'Audio', col: 0, row: 0 },
    { id: 'mel', label: 'Mel power', col: 1, row: 0 },
    { id: 'mfcc', label: 'MFCC coeffs', col: 1, row: 1 },
    { id: 'stft', label: 'STFT magnitude', col: 2, row: 0, variant: 'success' },
    { id: 'preview', label: 'Preview audio', col: 2, row: 1, variant: 'success' }
  ]"
  :edges="[
    { from: 'audio', to: 'mel', label: 'melSpectrogram', style: 'dashed' },
    { from: 'audio', to: 'mfcc', label: 'mfcc', style: 'dashed' },
    { from: 'mfcc', to: 'mel', label: 'mfccToMel' },
    { from: 'mel', to: 'stft', label: 'melToStft' },
    { from: 'mel', to: 'preview', label: 'melToAudio' },
    { from: 'mfcc', to: 'preview', label: 'mfccToAudio' }
  ]"
  caption="Dashed edges are the forward transforms this page assumes you already have; solid edges are the four inverse helpers below."
/>

The two forward transforms (dashed) produce the features you already know; the four inverse helpers (solid) undo them, either staying in the spectral domain (`melToStft`, `mfccToMel`) or reconstructing a preview waveform via Griffin-Lim (`melToAudio`, `mfccToAudio`).

| Intent | JavaScript | Python |
|--------|------------|--------|
| Mel power → STFT magnitude | `melToStft(...)` returns `{ nBins, nFrames, magnitude }` | `mel_to_stft(...)` returns `InverseResult(rows, n_frames, data)` |
| Mel power → audio | `melToAudio(...)` returns `Float32Array` | `mel_to_audio(...)` returns `list[float]` |
| MFCCs → mel power | `mfccToMel(...)` returns `{ nMels, nFrames, power }` | `mfcc_to_mel(...)` returns `InverseResult(rows, n_frames, data)` |
| MFCCs → audio | `mfccToAudio(...)` returns `Float32Array` | `mfcc_to_audio(...)` returns `list[float]` |
| Forward result → any of the above | `melToStft({ result })`, `melToAudio({ result })`, `mfccToMel({ result })`, `mfccToAudio({ result })` | `mel_result_to_stft`, `mel_result_to_audio`, `mfcc_result_to_mel`, `mfcc_result_to_audio` |
| CQT magnitude → audio | `cqtToAudio(...)` returns `Float32Array` | `cqt_to_audio(...)` returns `list[float]` |
| VQT magnitude → audio | `vqtToAudio(...)` returns `Float32Array` | `vqt_to_audio(...)` returns `list[float]` |

The two `*ToStft` / `*ToMel` helpers stay in the **spectral** domain and return a result object you can inspect or feed onward. The two `*ToAudio` helpers go all the way back to a waveform and run **Griffin-Lim** internally to supply the missing phase.

## Reconstruct a spectrum

`melToStft` maps a mel **power** spectrogram back to a linear-frequency STFT **magnitude** spectrogram. `mfccToMel` maps MFCCs back to a smoothed mel **power** spectrogram.

::: warning `melToStft` returns magnitude, not power
The helper solves the non-negative least-squares problem in the power domain and then takes the square root, matching `librosa.feature.inverse.mel_to_stft` with its default `power=2.0`. The values you get back are magnitudes, which is why the JavaScript field is `magnitude` (Python's `InverseResult` carries them as `data`). Convert them to dB with `20·log₁₀(x)`, not `10·log₁₀(x)`, and square them before handing them to anything that expects a power spectrum.
:::

If forward MFCC used a nonzero `lifter`, pass the same value to `mfccToMel` or `mfccToAudio`. The inverse then removes it.

::: warning The inverses refuse long inputs
`melToStft`, `melToAudio` and `mfccToAudio` throw `input exceeds the inverse resource limit` above 4096 frames or an `nFft` above 8192. That is about 95 s of audio at 22050 Hz with hop 512, and about 48 s at 44100 Hz. `mfccToMel` alone is not capped. To invert a full song, cut it into sections and invert one at a time.
:::

## Invert a result directly

A mel or MFCC result carries the parameters of the transform that made it: `nFft`, `hopLength`, `sampleRate`, `fmin` and `fmax` as applied, `htk`, and for MFCC also `nMels` and `lifter`. In JavaScript the inverse takes the result itself as a request, so nothing has to be repeated and nothing can drift:

```typescript
const mel = melSpectrogram({ samples, sampleRate, nFft: 2048, hopLength: 512, nMels: 128 });
const spectrum = melToStft({ result: mel });
const preview = melToAudio({ result: mel, nIter: 32 });

const coeffs = mfcc({ samples, sampleRate, nFft: 2048, hopLength: 512, nMels: 128, nMfcc: 20, lifter: 22 });
const reMel = mfccToMel({ result: coeffs });
const fromMfcc = mfccToAudio({ result: coeffs, nIter: 32 });
```

A field set beside `result` must agree with it, or the call throws `RangeError` naming both values, so an override can only restate what the forward transform used (`nIter` is free). A mel result already in dB (`isDb`) is refused with a message pointing to `dbToPower`; convert it first. The matrix-based request forms name the matrix `power` for mel and `coefficients` for MFCC (`melToStft({ power, nMels, nFrames, ... })`, `mfccToMel({ coefficients, nMfcc, nFrames, ... })`); any other field name for the matrix throws. A request with neither `result` nor the matrix field, or an argument that is not an object, throws a `TypeError` naming the missing field (`melToStft: power is required (or pass result)`).

In Python the same thing is `mel_result_to_stft(mel)`, `mel_result_to_audio(mel, n_iter=32)`, `mfcc_result_to_mel(coeffs)` and `mfcc_result_to_audio(coeffs, n_iter=32)`. The positional librosa-style functions below take the same inputs one by one.

Nothing here has gone back to a waveform yet: the result is a table of energy per frequency. When you are checking a model's intermediate output or a visualization, inspecting it at this stage often finds the cause faster than listening to a reconstruction.

::: code-group

```typescript [Browser]
import { init, melSpectrogram, melToStft, mfcc, mfccToMel } from '@libraz/libsonare';

await init();

// Mel power -> STFT magnitude
const mel = melSpectrogram(samples, sampleRate, 2048, 512, 128);
const stft = melToStft(mel.power, mel.nMels, mel.nFrames, sampleRate, 2048);
// stft: { nBins, nFrames, magnitude }   nBins = nFft/2 + 1 = 1025

// MFCCs -> mel power
const coeffs = mfcc(samples, sampleRate, 2048, 512, 128, 20);
const reMel = mfccToMel(coeffs.coefficients, coeffs.nMfcc, coeffs.nFrames, 128);
// reMel: { nMels, nFrames, power }
```

```python [Python]
import libsonare as sonare

# Mel power -> STFT magnitude
mel = sonare.mel_spectrogram(samples, sample_rate, n_fft=2048, hop_length=512, n_mels=128)
stft = sonare.mel_to_stft(mel.power, mel.n_mels, mel.n_frames, sample_rate=sample_rate, n_fft=2048)
# stft.rows = n_fft/2 + 1 = 1025; stft.data is row-major [rows x n_frames]

# MFCCs -> mel power
coeffs = sonare.mfcc(samples, sample_rate, n_fft=2048, hop_length=512, n_mels=128, n_mfcc=20)
re_mel = sonare.mfcc_to_mel(coeffs.coefficients, coeffs.n_mfcc, coeffs.n_frames, n_mels=128)
# re_mel.rows = n_mels; re_mel.data is row-major [rows x n_frames]
```

```bash [C++ CLI]
# Source-built C++ CLI audio-preview path for these same forward/inverse settings:
sonare mel-to-audio song.wav --n-fft 2048 --hop-length 512 --n-mels 128 -o mel-preview.wav
```

:::

Both inputs are **row-major** matrices: the mel `power` is `[nMels x nFrames]`, MFCC coefficients are `[nMfcc x nFrames]`. The `nMels`/`nMfcc`/`nFrames` arguments tell the helper how to read that flat array, so they must match the matrix you pass.

## Reconstruct audio

`melToAudio` and `mfccToAudio` produce a mono `Float32Array` you can play or write to a file. Because the features carry no phase, both run **Griffin-Lim**: start from the magnitude with a random phase, repeatedly inverse-STFT → STFT → keep the new phase → impose the known magnitude, until the phase settles into something self-consistent. The random start uses a fixed seed, so the same features and `nIter` always give the same preview.

Expect the preview to keep the outline and rhythm of the original while sounding smeared, metallic or grainy. That is the limit of estimating a discarded phase, not a bug in the wiring.

`cqtToAudio` and `vqtToAudio` use the same iterative idea for the row-major magnitude matrix returned by `cqt(...)` or `vqt(...)` — the constant-Q and variable-Q transforms, which space their frequency bins logarithmically instead of linearly. Keep the forward transform's `sampleRate`, `hopLength`, `fmin`, and `binsPerOctave` (plus `gamma` for VQT, omitted when the forward call omitted it) unchanged. As with mel/MFCC reconstruction, this is an approximate mono preview, not a restoration.

Pass the forward result when you have it. The positional form below is the librosa-style spelling for when you only hold the matrix and its settings.

::: code-group

```typescript [Browser]
import { init, melSpectrogram, melToAudio, mfcc, mfccToAudio } from '@libraz/libsonare';

await init();

const mel = melSpectrogram(samples, sampleRate, 2048, 512, 128);
const coeffs = mfcc(samples, sampleRate, 2048, 512, 128, 20);

// From the forward result: no settings to repeat.
const previewFromResult = melToAudio({ result: mel, nIter: 32 });
const fromMfccResult = mfccToAudio({ result: coeffs, nIter: 32 });

// Positional, librosa-style.
const preview = melToAudio(
  mel.power, mel.nMels, mel.nFrames, // the mel matrix and its shape
  sampleRate,
  2048, // nFft      (must match the forward transform)
  512,  // hopLength (must match the forward transform)
  0,    // fmin      (0 = default, full range)
  0,    // fmax      (0 = default, sampleRate / 2)
  32,   // nIter     (Griffin-Lim iterations)
);

const fromMfcc = mfccToAudio(
  coeffs.coefficients, coeffs.nMfcc, coeffs.nFrames,
  128,  // nMels — NOTE: this extra argument comes before sampleRate
  sampleRate,
  2048, // nFft
  512,  // hopLength
  0,    // fmin (default)
  0,    // fmax (default)
  32,   // nIter
);
```

```python [Python]
import libsonare as sonare

mel = sonare.mel_spectrogram(samples, sample_rate, n_fft=2048, hop_length=512, n_mels=128)
coeffs = sonare.mfcc(samples, sample_rate, n_fft=2048, hop_length=512, n_mels=128, n_mfcc=20)

# From the forward result: no settings to repeat.
preview_from_result = sonare.mel_result_to_audio(mel, n_iter=32)
from_mfcc_result = sonare.mfcc_result_to_audio(coeffs, n_iter=32)

# Positional, librosa-style.
preview = sonare.mel_to_audio(mel.power, mel.n_mels, mel.n_frames, sample_rate=sample_rate, n_iter=32)
# n_iter=32 (Griffin-Lim iterations)

from_mfcc = sonare.mfcc_to_audio(coeffs.coefficients, coeffs.n_mfcc, coeffs.n_frames, n_mels=128, sample_rate=sample_rate, n_iter=32)
# note the n_mels (128) argument before sample_rate
```

```bash [C++ CLI]
# Source-built C++ CLI equivalents for quick file previews:
sonare mel-to-audio song.wav -o mel-preview.wav
sonare mfcc-to-audio song.wav -o mfcc-preview.wav
```

:::

::: details How Griffin-Lim fills in the missing phase
Griffin-Lim is an iterative magnitude-only reconstruction. Given a target magnitude spectrogram `|S|` and an initial guess for phase `φ`:

1. Inverse-STFT `|S|·e^{iφ}` to a time-domain signal.
2. Forward-STFT that signal — its magnitude will drift away from `|S|`, but its **phase** is now more consistent with a real waveform.
3. Keep the new phase, force the magnitude back to `|S|`, and repeat.

Each pass nudges the phase toward something that an actual signal could have produced. libsonare runs the accelerated variant with a momentum of 0.99: each new phase estimate is pushed further along the direction the previous pass moved it, which converges in fewer passes than the plain loop. The initial phase is random from a fixed seed, so the result is repeatable. `nIter` controls how many passes run. More iterations converge closer (smoother, fewer artifacts) at linear cost; fewer iterations are faster but "phasier". 32 is a reasonable default; drop to 8–16 for fast UI previews, raise to 60+ when preview quality matters.
:::

`nIter` is the main quality/latency dial. Everything else (`nFft`, `hopLength`, `fmin`, `fmax`, `htk`) must match the **forward** transform — see below. The helper signatures default `fmin`/`fmax` to `0` (full range) and `htk` to `false` (Slaney); pass the same values you gave the forward transform, in the same positional slots.

<SonareDemo id="griffin-lim" />

The demo runs exactly the `melSpectrogram` → `melToAudio` round trip above on a short vowel: drag the iteration count and listen. Notice that the averaged spectrum hardly moves while the *sound* clears up — the magnitude was always there; iterations only recover a usable phase.

::: info Slaney vs HTK Mel scale
There are two common conventions for spacing the Mel bands: the **Slaney** formula (librosa's and libsonare's default) and the **HTK** formula. They place the band edges differently, so the forward and inverse transforms must use the *same* convention — pass `htk: true` (or `htk=True`) to the inverse only if the forward transform used it.
:::

## When the component has to stay audio

Everything above reconstructs from a magnitude, so everything above has to invent a phase. One route out of a spectral representation does not.

`decompose` factors a **magnitude** spectrogram into components and activations. Those factors carry no phase, so turning one component back into sound means multiplying it out and handing the result to Griffin-Lim — the same approximation as `melToAudio`, with the same smeared character. What comes back is a preview of what that component *is*. It is not a stem: play the components together and you do not get the input back.

`decomposeStems` takes the other route. It runs the same factorization, then builds a per-component **soft mask** — each component's share of the total magnitude at every time-frequency point — and applies that mask to the **original complex** spectrogram. No phase is estimated. Every component keeps the source's own phase, and because the masks divide each point rather than approximate it, the components **sum back to the input**.

For a multichannel recording, `decomposeStemsLinked` (Python `decompose_stems_linked`) fits one model and one set of masks for all channels, so interchannel level and phase stay in place. Its inputs, result layout and defaults are on [Source Separation](./source-separation.md#choose-a-method).

| | `decompose` + Griffin-Lim | `decomposeStems` |
|---|---------------------------|------------------|
| Phase | Invented, iteratively | The source's own |
| Cost | `nIter` STFT round trips per component | One masking pass |
| Components sum to the input | No | Yes |
| Use it for | Seeing and hearing what a component holds | Separated audio you intend to keep |

Reach for `decomposeStems` whenever a mono component will be listened to, mixed, or written to a file. Use `decomposeStemsLinked` when several channels must share one separation while keeping their relative level and phase. Keep the Griffin-Lim route for inspecting what a feature representation retained. The signatures and per-runtime spellings (`decomposeStems`, `decomposeStemsLinked`, `decompose_stems`, `decompose_stems_linked`) are in [JavaScript API](./js-api-features.md) and [Python API](./python-api-analysis.md).

## A round-trip sanity check

A common use is to confirm a feature pipeline is wired correctly: extract features, invert them, and listen to (or measure) the gap. The result will never be identical, but it should be *recognizable* — if it is silence or noise, a parameter or a matrix shape is wrong.

::: code-group

```typescript [Browser]
const mel = melSpectrogram(samples, sampleRate, 2048, 512, 128);
const preview = melToAudio(mel.power, mel.nMels, mel.nFrames, sampleRate, 2048, 512, 0, 0, 32);

// Same length? Recognizable envelope? Play it back or compare loudness.
console.log(samples.length, preview.length);
```

```python [Python]
mel = sonare.mel_spectrogram(samples, sample_rate, n_fft=2048, hop_length=512, n_mels=128)
preview = sonare.mel_to_audio(mel.power, mel.n_mels, mel.n_frames, sample_rate=sample_rate, n_iter=32)

# Same length? Recognizable envelope? Play it back or compare loudness.
print(len(samples), len(preview))
```

```bash [C++ CLI]
# Listen to the reconstructed preview and compare it with the source.
sonare mel-to-audio song.wav -o mel-preview.wav
```

:::

::: warning Keep the same parameters on both sides
Inverse helpers are only meaningful with the **same** `sampleRate`, `nFft`, `hopLength`, `nMels`, `fmin`, `fmax`, and `htk` used for the forward transform. A mismatch silently produces a wrong-but-plausible spectrum, which is the hardest kind of bug to spot. In particular, if the forward transform used `htk: true` or a custom `fmin`/`fmax`, the inverse **must** pass the same `htk`/`fmin`/`fmax` — otherwise the Mel filterbank is built differently and the reconstruction is silently wrong. Store these values alongside your features so the inverse call cannot drift, or invert the forward result itself, which already carries them. `mel_to_stft(...)` does not need `hop_length` because it stays in the frequency domain; the audio-producing helpers do.
:::

## Related

- [librosa Compatibility](./librosa-compatibility.md) — how these map to `librosa.feature.inverse.*`
- [JavaScript API](./js-api-features.md#feature-extraction) · [Python API](./python-api-analysis.md#feature-extraction) — the forward transforms
- [DSP Implementation Notes](./dsp-implementation.md) — how the mel filterbank and STFT are built
