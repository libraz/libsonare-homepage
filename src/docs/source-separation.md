---
title: Source Separation
description: Separate harmonic and percussive structure, inspect NMF components, and preserve multichannel balance with linked masks.
---

# Source Separation

Source separation produces several audio signals from one recording. Choose HPSS when you want sustained and transient structures, NMF when you want a few unlabeled spectral components factored out of the recording, and linked NMF when several channels must share the same masks. These algorithms do not assign instrument names or guarantee isolated vocals.

## Signal processing versus learned models

Two families of methods split a recording into parts, and they are good at different things. libsonare implements only the first.

- **Signal-processing separation** works from rules about the signal itself. In a spectrogram, sustained notes form horizontal lines and hits form vertical ones (HPSS), or the spectrogram factors into a few non-negative spectral shapes and their activations (NMF). Nothing is trained, so the result does not depend on what music a model saw before.
- **Learned separation models** are neural networks trained on many mixes paired with their isolated stems. They learn what a voice, a drum kit or a bass sounds like and return named stems. For pulling vocals, drums or bass out of a finished mix, they generally produce much cleaner stems than any signal-processing method, including the ones on this page.

| | Signal processing (this page) | Learned separation model |
|---|---|---|
| What comes out | Structural parts: harmonic and percussive, or unlabeled components | Named stems such as vocals, drums, bass and the rest |
| Overlapping instruments in a dense mix | Stay mixed together; no route isolates a vocal | Usually the stronger choice |
| Repeatability | The same input and options give the same output, with no randomness | Depends on the model weights and the inference runtime; a new model version can change the result |
| What it needs | Nothing beyond the engine; runs on the CPU, in the browser too | Model weights, often tens to hundreds of MB, and an inference runtime; often a GPU for speed |
| Why a result looks the way it does | Readable from the mask or the `w` and `h` matrices | Learned from the training data, so failure cases are harder to predict |

Which to reach for:

- **An isolated vocal or drum stem from a mix**: use a learned separation model. libsonare does not include one.
- **A cue for analysis, a reproducible split, or processing in the browser without a model download**: the routes on this page fit. Beats from the percussive part and key from the harmonic part are typical uses.
- **Both**: separate with a learned model, then pass the stems to libsonare for analysis, transcription, editing or mixing. Every call takes plain sample arrays, so stems from any separator work. [Audio to MIDI](./use-cases/audio-to-midi.md#step-4-—-a-band-mix-needs-a-stem-first) shows why transcription of a band mix needs a stem first.

## Choose a method

There are three routes, and they answer different questions.

| Route | Input | Output | Sums to the input | Use it for |
|-------|-------|--------|-------------------|------------|
| `hpss(...)` | One mono signal | Harmonic and percussive signals | Yes with the default soft mask | Sustained versus transient content, for example beats from the percussive part |
| `decomposeStems(...)` | One mono signal | `nComponents` signals plus the `w` and `h` matrices | Yes | Unlabeled components you audition one by one |
| `decomposeStemsLinked(...)` | Several equal-length channels | Each component on each channel | Yes | Components that keep the channel balance and phase of a multichannel recording |

<SonareDemo id="stem-decompose" />

The demo is the harmonic/percussive split: a pad bed with broadband hits on every beat, and the B side is the percussive component alone. Sustained spectral lines are pushed out while the hits survive as short vertical events. That is one half of a two-way split, not a multi-instrument separation.

::: code-group

```typescript [Browser]
import { init, hpss, hpssWithResidual, decomposeStems } from '@libraz/libsonare';

await init();

// Two-way split on a fixed axis: sustained vs transient.
const { harmonic, percussive } = hpss({ samples, sampleRate });

// The same split with the leftovers exposed.
const hard = hpssWithResidual({ samples, sampleRate, hardMask: true });

// Unsupervised components, each one listenable.
const { components, w, h } = decomposeStems({
  samples,
  sampleRate,
  nComponents: 4,
  maskPower: 2, // Wiener-style; separates harder, more artifacts on shared partials
});
```

```typescript [Node]
import { hpss, hpssWithResidual, decomposeStems } from '@libraz/libsonare-native';

const { harmonic, percussive } = hpss({ samples, sampleRate });
const hard = hpssWithResidual({ samples, sampleRate, hardMask: true });
const { components, w, h } = decomposeStems({ samples, sampleRate, nComponents: 4, maskPower: 2 });
```

```python [Python]
import libsonare as sonare

split = sonare.hpss(samples, sample_rate=sample_rate)
harmonic, percussive = split.harmonic, split.percussive
hard = sonare.hpss_with_residual(samples, sample_rate=sample_rate, hard_mask=True)
stems = sonare.decompose_stems(samples, sample_rate=sample_rate, n_components=4, mask_power=2)
components, w, h = stems["components"], stems["w"], stems["h"]
```

```bash [CLI]
sonare hpss recording.wav -o separated.wav
sonare hpss recording.wav --hard-mask --with-residual -o hard.wav
sonare decompose-stems recording.wav --n-components 4 --mask-power 2 -o stems.wav
```

:::

HPSS accepts an even `nFft` of at least 4 (mixed-radix FFT, so powers of two are not required), and an integer `hopLength` in `(0, nFft / 2]`. Both median kernels must be positive odd integers at most 524287. When supplying a custom STFT configuration in C++, its `winLength` and window must also leave no overlap-add gaps; invalid geometry is refused instead of producing periodic dropouts.

| | HPSS | `decomposeStems(...)` |
|---|-------------|------------------------|
| What decides the split | A fixed axis: median-filtering along time keeps sustained content, along frequency keeps transients | Non-negative factorization learns `nComponents` recurring spectral shapes from the material itself |
| What comes back | `hpss` returns harmonic and percussive signals; `hpssWithResidual` also returns a residual | One signal per component, plus the `w` component and `h` activation matrices |
| Labels | Known in advance | None — you inspect `w` and `h` to work out which component is which |
| Reconstruction | Default soft-mask harmonic and percussive outputs sum back to the input; hard masks may leave a residual | The masks sum to one where the model has energy, so the components sum back to the input |
| Phase | Original | Original — the mask is applied to the complex spectrogram, which is what makes each component listenable |

The NMF demo below lets you audition each of four components. It uses 30 iterations for interactive processing; components have no instrument labels.

<SonareDemo id="nmf-stems" />

Defaults worth knowing: both median kernels are 31, and under the default soft mask `hpssWithResidual(...)` returns a silent residual because the two masks already sum to one — pass `hardMask: true` for a residual that actually carries the band neither component claimed. `decomposeStems(...)` and `decomposeStemsLinked(...)` use the same NMF defaults: 4 components, `nFft: 2048`, `hopLength: 512`, 100 iterations, `beta: 2` (Frobenius; pass `1` for Kullback-Leibler), `init: 'random'`, and `maskPower: 1` keeping the magnitude ratio. Both stem functions default an omitted `sampleRate` to `22050`; pass the recording’s actual rate.

For a multichannel recording, use `decomposeStemsLinked(...)`. It averages the channels' magnitude spectrograms to fit one NMF model and one set of component masks. It then applies each mask unchanged to every channel's original complex spectrogram. This preserves interchannel level and phase relationships within each time-frequency bin and avoids independently chosen masks for the channels. A separated component can still have a different stereo image from the full mix because it retains different content.

Pass at least one `Float32Array` channel, make every channel the same length, and keep the channel count at 64 or below. The result uses `components[k][c]` for component `k` on channel `c`; `w`, `h`, and `sampleRate` have the same meaning as in `decomposeStems(...)`. A one-channel call is bit-identical to `decomposeStems(...)` with the same options.

::: code-group

```typescript [Browser]
import { init, decomposeStemsLinked } from '@libraz/libsonare';

await init();

const linked = decomposeStemsLinked({
  channels: [leftChannel, rightChannel], // equal-length Float32Array planes
  sampleRate,
  nComponents: 4,
});
const firstLeft = linked.components[0][0];
const firstRight = linked.components[0][1];
console.log(linked.w.length, linked.h.length);
```

```typescript [Node]
import { decomposeStemsLinked } from '@libraz/libsonare-native';

const linked = decomposeStemsLinked({
  channels: [leftChannel, rightChannel], // equal-length Float32Array planes
  sampleRate,
});
const firstLeft = linked.components[0][0];
const firstRight = linked.components[0][1];
```

```python [Python]
import libsonare as sonare

linked = sonare.decompose_stems_linked(
    [left_channel, right_channel], sample_rate=sample_rate, n_components=4
)
first_left = linked["components"][0][0]
first_right = linked["components"][0][1]
print(linked["w"].shape, linked["h"].shape)
```

```bash [CLI]
# The CLI exposes mono `decompose-stems` only.
# Use a library binding when one NMF model must serve several channels.
```

:::

None of these routes isolates a vocal from a dense mix (see [Signal processing versus learned models](#signal-processing-versus-learned-models)). They are useful for making a downstream estimator's job easier: beat tracking on the percussive part, chroma and key on the harmonic part, pitch tracking on a component that isolated the lead, or multichannel processing that must keep the stereo image.

## Related

[Music Analysis](./analysis.md), [Audio to Notes](./audio-to-notes.md), [Melody and Pitch](./glossary/analysis/melody-pitch.md)
