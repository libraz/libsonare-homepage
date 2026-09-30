---
title: Source Separation
description: Separate harmonic and percussive structure, inspect NMF components, and preserve multichannel balance with linked masks.
---

# Source Separation

Source separation produces several audio signals from one recording. Choose HPSS when you want sustained and transient structures, NMF when you want learned spectral components, and linked NMF when several channels must share the same masks. These algorithms do not assign instrument names or guarantee isolated vocals.

## Choose a method

There are three routes, and they answer different questions.

<SonareDemo id="stem-decompose" />

The demo above is the harmonic/percussive split: a pad bed with broadband hits on every beat, and the B side is the percussive component alone. Sustained spectral lines are pushed out while the hits survive as short vertical events. That is one half of a two-way split, not a multi-instrument separation.

```typescript
import { hpss, hpssWithResidual, decomposeStems } from '@libraz/libsonare';

// Two-way split on a fixed axis: sustained vs transient.
const { harmonic, percussive } = hpss({ samples, sampleRate });

// The same split with the leftovers exposed.
const hard = hpssWithResidual({ samples, sampleRate, hardMask: true });

// Unsupervised components, each one listenable.
const { components, w, h } = decomposeStems({
  samples,
  sampleRate,
  nComponents: 4,
  maskPower: 2, // Wiener-style; separates harder, more artefacts on shared partials
});
```

| | HPSS | `decomposeStems(...)` |
|---|-------------|------------------------|
| What decides the split | A fixed axis: median-filtering along time keeps sustained content, along frequency keeps transients | Non-negative factorisation learns `nComponents` recurring spectral shapes from the material itself |
| What comes back | `hpss` returns harmonic and percussive signals; `hpssWithResidual` also returns a residual | One signal per component, plus the `w` component and `h` activation matrices |
| Labels | Known in advance | None — you inspect `w` and `h` to work out which component is which |
| Reconstruction | Default soft-mask harmonic and percussive outputs sum back to the input; hard masks may leave a residual | The masks sum to one where the model has energy, so the components sum back to the input |
| Phase | Original | Original — the mask is applied to the complex spectrogram, which is what makes each component listenable |

The NMF demo below lets you audition each of four components. It uses 30 iterations for interactive processing; components have no instrument labels.

<SonareDemo id="nmf-stems" />

Defaults worth knowing: both median kernels are 31, and under the default soft mask `hpssWithResidual(...)` returns a silent residual because the two masks already sum to one — pass `hardMask: true` for a residual that actually carries the band neither component claimed. `decomposeStems(...)` and `decomposeStemsLinked(...)` use the same NMF defaults: 4 components, `nFft: 2048`, `hopLength: 512`, 100 iterations, `beta: 2` (Frobenius; pass `1` for Kullback-Leibler), `init: 'random'`, and `maskPower: 1` keeping the magnitude ratio. `decomposeStemsLinked(...)` defaults an omitted `sampleRate` to `22050`.

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

None of these routes is a trained instrument separator, and none will hand you a clean isolated vocal from a dense mix. They are useful for making a downstream estimator's job easier: beat tracking on the percussive part, chroma and key on the harmonic part, pitch tracking on a component that isolated the lead, or multichannel processing that must keep the stereo image.

## Related

[Music Analysis](./analysis.md), [Audio to Notes](./audio-to-notes.md), [Melody and Pitch](./glossary/analysis/melody-pitch.md)
