---
title: Mastering Processors
description: The named mastering surface of libsonare — presets, solo processors, and pair/stereo analyses — with a goal-to-processor guide, kept in sync with the runtime registry.
---

# Mastering Processors

This page is the **registry** for the named mastering surface in libsonare. It answers *"what can I call?"*, not *"how does it work internally?"*

The authoritative runtime source is the name-list API: `masteringProcessorNames()`, `masteringPairProcessorNames()`, `masteringPairAnalysisNames()`, `masteringStereoAnalysisNames()`, and `masteringPresetNames()`. This page mirrors those lists.

::: tip New to mastering? Don't start here
Calling individual processors one by one is the hard way. Start with a **preset** (`masterAudio`) or the **[Mastering Assistant](./mastering-assistant.md)**, which profiles your audio and proposes a whole chain. Reach for solo processors only when you need surgical control over one stage.
:::

For *behavior*, processing boundaries, and real-time notes by DSP family, see [DSP Implementation Notes](./dsp-implementation.md). For standards and paper citations, see [Algorithm References](./algorithm-references.md). For test coverage, see [Implementation Validation](./implementation-validation.md).

## What You Will Learn

By the end of this page you should be able to:

- distinguish presets, solo processors, pair processors, and JSON-returning analyses;
- start from a goal such as "control dynamics" or "match a reference" rather than scanning IDs alphabetically;
- know when a preset or assistant flow is more appropriate than directly calling a processor;
- find the exact registry name to pass to JavaScript, Python, Node native, or the C ABI.

## What the names mean

| Name type | Meaning | Example |
|-----------|---------|---------|
| Preset | A named chain configuration for a style or delivery target | `streaming`, `podcast`, `jpop` |
| Solo processor | One processor applied to a mono or stereo signal | `dynamics.compressor`, `eq.tilt` |
| Pair processor | A processor that uses a source **and** a reference signal | `match.applyMatchEq` |
| Analysis | A measurement that returns **JSON** instead of audio | `match.referenceLoudness`, `stereo.monoCompatCheck` |

::: info Sidechain and loudness processors
The dynamics family includes `dynamics.duckingProcessor` (sidechain ducking), `maximizer.loudnessOptimize` (LUFS-target maximizing), and a de-esser bandpass `Q` control on `dynamics.deesser` with stereo preservation, alongside `dynamics.transientShaper`, `dynamics.upwardCompressor`, `dynamics.upwardExpander`, `dynamics.vocalRider`, and `dynamics.sidechainRouter`.
:::

## Presets

Presets are named chain configurations, not separate algorithms. Apply one with `masterAudio(samples, sr, preset, overrides?)`.

`pop`, `edm`, `acoustic`, `hipHop`, `aiMusic`, `speech`, `streaming`, `youtube`, `broadcast`, `podcast`, `audiobook`, `cinema`, `jpop`, `ambient`, `lofi`, `classical`, `drumAndBass`, `techno`, `metal`, `trap`, `rnb`, `jazz`, `kpop`, `trance`, `gameOst`

See [Choosing a Mastering Preset](./glossary/mastering/preset-selection.md) for how to pick one without treating a preset as a finished master.

## Which processor for which job

A goal-first index into the registry below. This is a starting point, not a rule — read the linked guides before committing.

| You want to… | Reach for | Learn the concept |
|--------------|-----------|-------------------|
| Even out level / control dynamics | `dynamics.compressor`, `dynamics.limiter`, `multiband.compressor` | [Dynamics](./glossary/mastering/dynamics.md) |
| Add punch without squashing | `dynamics.transientShaper`, `dynamics.parallelComp` | [Dynamics](./glossary/mastering/dynamics.md) |
| Tame harsh "ess" sounds | `dynamics.deesser` | [Dynamics](./glossary/mastering/dynamics.md) |
| Duck a music bed under voice | `dynamics.duckingProcessor`, `dynamics.sidechainRouter` | [Mixing Engine](./mixing.md) |
| Shape overall tone / brightness | `eq.tilt`, `eq.parametric`, `spectral.airBand` | [Tone and Air](./glossary/mastering/tone-air.md) |
| Add warmth / harmonics | `saturation.tape`, `saturation.tube`, `saturation.exciter` | [Tone and Air](./glossary/mastering/tone-air.md) |
| Widen / narrow / check stereo | `stereo.imager`, `stereo.monoMaker`, `stereo.monoCompatCheck` | [Stereo, Limiter, Loudness](./glossary/mastering/stereo-limiter-loudness.md) |
| Hit a loudness target safely | `loudness` stage, `maximizer.loudnessOptimize`, `maximizer.truePeakLimiter` | [Delivery Targets](./glossary/mastering/delivery-targets.md) |
| Clean up noise / clicks / clipping | `repair.denoiseClassical`, `repair.declick`, `repair.declip` | [Repair and Input](./glossary/mastering/repair.md) |
| Match a reference track | `match.applyMatchEq`, `match.referenceLoudness` | [Reference Match](./glossary/mastering/reference-match.md) |

::: details What is parallel compression?
A normal compressor turns the loud parts down.

**Parallel compression** mixes the *original* signal with a *heavily compressed* copy. The compressed copy lifts quiet detail, while the original keeps the natural peaks.

Use it when you want density and "glue" without flattening transients. It is also called New York compression. `dynamics.transientShaper` is the related tool for the opposite goal: exaggerating or softening the attack of each hit.
:::

## Processor Families In Plain English

The exact IDs matter for code, but users usually choose by *role*:

| Family | Use it when | Avoid it when |
|--------|-------------|---------------|
| Dynamics | The level envelope is the problem: peaks jump out, vocals are uneven, transients need shaping, or a bed must duck under speech | The problem is tonal balance; EQ or spectral processors are clearer |
| EQ | The frequency balance is wrong: too dark, too harsh, too boomy, or needs a surgical cut | You are trying to increase loudness; use dynamics/maximizer stages |
| Multiband | Different frequency ranges need different dynamics or width treatment | A broad single-band processor already solves it; multiband can overfit quickly |
| Saturation | You want harmonic density, edge, warmth, or controlled clipping character | You need clean correction; saturation adds coloration by design |
| Spectral | The issue is perceptual tone shaping: air, presence, low-end focus, broad spectral contour | You need exact filter moves; use EQ |
| Stereo | Width, mono compatibility, phase, or left/right balance is the problem | The mix is already phase-sensitive or mono delivery is primary |
| Maximizer / final | You are at the delivery stage: loudness, ceiling, bit depth, or final output polish | You are still fixing balance or arrangement problems |
| Repair | The input has defects: clicks, crackle, hum, clipping, noise, excessive tail | You expect source separation or neural restoration |

Most full chains use only a small subset: repair if needed, one tone stage, one dynamics stage, optional saturation/stereo, then maximizer/loudness. Stacking many processors from the registry is rarely better than starting from a preset and overriding one or two values.

::: info Loudness, oversampling, and metering details
A few capabilities sit underneath the maximizer/final and analysis surfaces:

- Integrated LUFS measurement supports surround layouts up to 8 channels, applying the BS.1770 channel weights.
- The internal oversampler and true-peak stages accept oversampling factors of 1 and 16 (the live meter accepts the same factors), trading CPU for inter-sample-peak accuracy.
- For UI consumption there are display-decimated metering variants — `meteringVectorscopeDecimated(...)` and `meteringPhaseScopeDecimated(...)` thin the point series to at most `maxPoints` points — plus `meteringSpectrumFrame(...)`, a single-frame (non-time-averaged) spectrum reader for spectrum-analyzer snapshots.
- A **stereo imager** (widens or narrows the stereo field per band) and a **dynamic EQ** (an EQ whose boost/cut reacts to level, like a frequency-targeted compressor) are available in multiband form: `multiband.imager` and `multiband.dynamicEq` expose per-band parameters and accept a custom number of crossover cutoffs, so you can split into the band count your material needs instead of a fixed three.
:::

## Solo processors

| Family | Processor names |
|--------|-----------------|
| Dynamics | `dynamics.brickwallLimiter`, `dynamics.compressor`, `dynamics.deesser`, `dynamics.expander`, `dynamics.gate`, `dynamics.limiter`, `dynamics.parallelComp`, `dynamics.sidechainRouter`, `dynamics.duckingProcessor`, `dynamics.transientShaper`, `dynamics.upwardCompressor`, `dynamics.upwardExpander`, `dynamics.vocalRider` |
| EQ | `eq.apiStyle`, `eq.bandPass`, `eq.cutFilter`, `eq.dynamic`, `eq.equalizer`, `eq.graphic`, `eq.linearPhase`, `eq.midSide`, `eq.minimumPhase`, `eq.parametric`, `eq.pultec`, `eq.shelving`, `eq.tilt` |
| Final | `final.bitDepth`, `final.dither`, `final.outputChain` |
| Maximizer | `maximizer.adaptiveRelease`, `maximizer.loudnessOptimize`, `maximizer.maximizer`, `maximizer.softKneeMax`, `maximizer.truePeakLimiter` |
| Multiband | `multiband.compressor`, `multiband.dynamicEq`, `multiband.expander`, `multiband.imager`, `multiband.limiter`, `multiband.saturation` |
| Repair | `repair.declick`, `repair.declip`, `repair.decrackle`, `repair.dehum`, `repair.denoiseClassical`, `repair.dereverbClassical`, `repair.trimSilence` |
| Saturation | `saturation.ampSim`, `saturation.bitcrusher`, `saturation.exciter`, `saturation.hardClipper`, `saturation.multibandExciter`, `saturation.softClipper`, `saturation.tape`, `saturation.transformer`, `saturation.tube`, `saturation.waveshaper` |
| Spectral | `spectral.airBand`, `spectral.lowEndFocus`, `spectral.presenceEnhancer`, `spectral.spectralShaper` |
| Stereo | `stereo.autoPan`, `stereo.haasEnhancer`, `stereo.imager`, `stereo.monoMaker`, `stereo.phaseAlign`, `stereo.stereoBalance` |

::: warning Repair is classical DSP, by design
`repair.denoiseClassical`, `repair.dereverbClassical`, and related processors use spectral subtraction / MMSE-STSA / LogMMSE with explicit noise estimation.

They are **not** DNN source separation or neural spectral repair.

- Good for: noise, hum, clicks, clipping, and mild room smear.
- Not for: unmixing finished tracks or rebuilding missing sources.
- Design reason: the repair path stays deterministic and dependency-free.
:::

::: tip Registry names and chain keys differ
The named processor registry exposes one-shot repair processors as `repair.denoiseClassical` and `repair.dereverbClassical`.

Full-chain configs use shorter stage keys: `repair.denoise.*` and `repair.dereverb.*`. Those keys address the repair slots inside `MasteringChainConfig`.

Both naming styles point to the same classical denoise/dereverb implementations.
:::

::: details What is spectral subtraction (MMSE-STSA / LogMMSE)?
These are classical denoising methods.

1. The algorithm estimates a **noise profile** from quiet passages, such as steady hiss or hum.
2. **Spectral subtraction** subtracts that estimated noise from each short-time spectrum frame.
3. **MMSE-STSA** and **LogMMSE** are statistical versions that estimate how much of each frequency bin is signal versus noise before subtracting.

This reduces the warbly "musical noise" that naive subtraction can leave. These methods do not separate instruments; they only attenuate noise.
:::

::: details What is `saturation.ampSim`?
A guitar-amp-style coloration stage in the form drive → tone stack → cab. An oversampled 12AX7 triode drive stage sits behind a single `[0, 1]` drive knob, with a drive-scaled pre-emphasis shelf so the gain character shifts as you push it. After the drive comes a bass/mid/treble tone stack, then a fixed, data-free cab voicing (low cut, body bump, presence peak, and a steep roll-off around 4.8 kHz) that can be bypassed for a clean DI tone. The drive, tone, presence, and level controls are automatable through `set_parameter` on every binding.
:::

## Pair processors and analyses

Pair processors consume a source **and** a reference. Pair/stereo *analyses* return measurement JSON and do not render audio by themselves.

| Type | Names |
|------|-------|
| Pair processors | `match.applyMatchEq`, `match.alignReferenceToSource`, `match.abSwitch`, `match.abCrossfade` |
| Pair analyses | `match.referenceLoudness`, `match.tonalBalance`, `match.tonalBalanceLogBands`, `match.matchEqCurve`, `match.estimateReferenceDelaySamples` |
| Stereo analyses | `stereo.monoCompatCheck`, `stereo.monoCompatCheckLogBands` |

::: details What do "tonal balance" and "mono compatibility" measure?
- **Tonal balance** (`match.tonalBalance`) describes how a track's energy is spread across frequency bands — how much sub, bass, mid, presence, and air it has. Comparing your tonal balance to a reference track shows where you are darker or brighter, which is what `match.applyMatchEq` then corrects.
- **Mono compatibility** (`stereo.monoCompatCheck`) predicts what happens when your stereo mix is summed to mono (phone speakers, club PAs, some broadcast paths). If the left and right channels are out of phase, parts can cancel out and lose level when folded down. The check flags that risk before it surprises a listener. See [Mono Compatibility](./glossary/concepts/mono-compatibility.md) for a deeper walk-through.
:::

## Mixer Insert Names

Mixer scene inserts use the same processor factory as mastering inserts, but the valid insert set is slightly broader than `masteringProcessorNames()`. The full insert list is enumerable at runtime with `masteringInsertNames()`. In addition to the solo processors above, builds with creative FX enabled expose reverb and modulation insert IDs:

| Insert ID | Meaning |
|-----------|---------|
| `effects.reverb.plate` | Alias for the Dattorro plate-style reverb |
| `effects.reverb.dattorro` | Dattorro reverb |
| `effects.reverb.fdn` | Feedback delay network reverb |
| `effects.reverb.velvet` | Velvet-noise style reverb |
| `effects.reverb.convolution` | Convolution reverb; can use an impulse response in native insert creation paths |
| `effects.reverb.room` | Geometric room reverb synthesized from room parameters |
| `effects.acoustic.roomMorph` | Room-character morph toward a target geometric room |
| `effects.modulation.ensemble` | Solina-style BBD string-machine ensemble |

These insert IDs are available only in builds with `SONARE_HAVE_FX`. The geometric room inserts also require `BUILD_ACOUSTIC_SIM`.

There are a few practical details to know:

| Detail | Meaning |
|--------|---------|
| `effects.reverb.plate` and `effects.reverb.dattorro` | Two names for the same Dattorro processor |
| JSON scene params | Can tune scalar controls such as `decaySec`, `decay`, `damping` / `hfDamping`, `dryWet`, `preDelayMs`, `reverbTimeS`, `densityHz`, and `enableShelf`, depending on the algorithm |
| `effects.reverb.convolution` | Needs an impulse response supplied through native insert construction |
| Convolution insert without an IR | Effectively behaves as a passthrough |

::: details What are these reverb algorithms?
They are different ways to synthesize a reverb tail. Pick by the character you want, not by correctness — all are valid.

- **Plate / Dattorro** — a smooth, dense, classic-studio sound. The Dattorro topology is a widely used plate-style design; `plate` is an alias for it.
- **FDN (feedback delay network)** — a flexible algorithmic reverb built from interconnected delay lines, easy to tune from small rooms to large halls.
- **Velvet-noise** — uses sparse random impulses to build an efficient, natural-sounding tail at low CPU cost.
- **Convolution** — reproduces a *real* space by convolving the signal with a measured impulse response of that room.
:::

::: details What is `effects.modulation.ensemble`?
A Solina-style BBD string-machine ensemble — the lush, chorused tone of vintage string synths. It runs three delay taps per channel, swept simultaneously by a slow and a fast 3-phase LFO bank, so the modulation is dense rather than a single chorus wobble. A BBD bucket-bandwidth lowpass darkens the wet path, emulating the analog bucket-brigade delay lines. The right-channel LFO polarity is inverted, which spreads a mono source into a wide stereo image. It is exposed through the insert factory and its parameters are automatable through `set_parameter` on every binding.
:::

Use these in [Mixing Scene JSON](./mixing-scene-json.md) `insert.processor` fields. They are not returned by `masteringProcessorNames()` because they are mixer insert processors, not one-shot mastering processors.

## How to call them

::: code-group

```typescript [Browser]
masteringProcessorNames();   // discover solo processor ids at runtime

const out = masteringProcess('dynamics.compressor', samples, sampleRate, {
  thresholdDb: -24,
  ratio: 1.5,
});

const stereo = masteringProcessStereo('stereo.imager', left, right, sampleRate, { width: 1.1 });

// Analyses return JSON strings — parse them
const report = JSON.parse(masteringPairAnalyze('match.referenceLoudness', source, reference, sampleRate));
const mono   = JSON.parse(masteringStereoAnalyze('stereo.monoCompatCheck', left, right, sampleRate));
```

```python [Python]
import json
import libsonare as sonare

sonare.mastering_processor_names()   # discover solo processor ids at runtime

out = sonare.mastering_process('dynamics.compressor', samples, sample_rate=sr, params={
    'thresholdDb': -24,
    'ratio': 1.5,
})

stereo = sonare.mastering_process_stereo('stereo.imager', left, right, sample_rate=sr, params={'width': 1.1})

# Analyses return JSON strings — parse them
report = json.loads(sonare.mastering_pair_analyze('match.referenceLoudness', source, reference, sample_rate=sr))
mono   = json.loads(sonare.mastering_stereo_analyze('stereo.monoCompatCheck', left, right, sample_rate=sr))
```

```bash [CLI]
# discover solo processor ids
sonare mastering-processors

# apply one solo processor (--params are floats: k=v,k=v)
sonare mastering-processor song.wav --processor dynamics.compressor \
  --params "thresholdDb=-24,ratio=1.5" -o out.wav

# two-input (pair) analysis prints JSON
sonare mastering-pair-analyze song.wav --reference ref.wav --analysis match.referenceLoudness

# stereo processors (stereo.imager) have no Python CLI subcommand.
# Source-built C++ CLI builds also expose mastering-stereo-analyze / analyses.
```

:::

:::: details Config style differs between chain entry points
The registry is string-based so C, Python, Node, WASM, and CLI callers share processor identifiers.

When you assemble a *chain* rather than a single processor, the config style depends on the entry point:

| Entry point | Config style |
|-------------|--------------|
| WASM `masteringChain(...)` | Nested config objects |
| `masterAudio(...)` and Python/Node equivalents | Flat dot-notation overrides such as `'loudness.targetLufs'` |
| [Mastering Assistant](./mastering-assistant.md) `chainConfig.params` | Flat form, ready for `masterAudio` |

Repair chain keys follow the chain slots, not the one-shot registry names: use `repair.denoise.*` / `repair.dereverb.*` in flat overrides or the nested `repair: { denoise: ..., dereverb: ... }` shape in `masteringChain(...)`.
::::

## Related

- [Mastering Assistant](./mastering-assistant.md) — profile/suggest/preview JSON and the suggestion→render path
- [Mastering Implementation](./mastering-implementation.md) — the chain that renders in the browser demo
- [DSP Implementation Notes](./dsp-implementation.md) — how each family behaves
- [Mixing Engine](./mixing.md) — load these processors as channel-strip/bus inserts
