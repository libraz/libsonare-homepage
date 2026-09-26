---
title: Mastering Processors
description: The named mastering API of libsonare — presets, solo processors, and pair/stereo analyses — with a goal-to-processor guide, kept in sync with the runtime registry.
---

# Mastering Processors

This page is the **registry** for the named mastering API in libsonare. It answers *"what can I call?"*, not *"how does it work internally?"*

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
The dynamics family includes `dynamics.duckingProcessor` (sidechain ducking), `maximizer.loudnessOptimize` (maximizing toward a [LUFS](./glossary/lufs.md) target — LUFS is Loudness Units relative to Full Scale, the broadcast loudness scale), and a de-esser bandpass `Q` control on `dynamics.deesser` with stereo preservation, alongside `dynamics.transientShaper`, `dynamics.upwardCompressor`, `dynamics.upwardExpander`, `dynamics.vocalRider`, and `dynamics.sidechainRouter`.
:::

## Presets

Presets are named chain configurations, not separate algorithms. Apply one with `masterAudio(samples, sr, preset, overrides?)`.

`pop`, `edm`, `acoustic`, `hipHop`, `aiMusic`, `speech`, `streaming`, `youtube`, `broadcast`, `podcast`, `audiobook`, `cinema`, `jpop`, `ambient`, `lofi`, `classical`, `drumAndBass`, `techno`, `metal`, `trap`, `rnb`, `jazz`, `kpop`, `trance`, `gameOst`, `vinyl`, `tapeHiss`, `fieldRecording`, `voiceMemo`, `shellac78`

`masteringPresetNames()` returns this compact name list. The capability catalog's `masteringPresets` array adds `kind`, `targetLufs`, `truePeakCeilingDb`, and `maxLimiterGainReductionDb` for each name; restoration entries have `null` for the three numeric fields. Use `masteringPresetParams(preset)` to expand a selected name into the flat numeric/boolean map accepted by `masterAudio` overrides.

See [Choosing a Mastering Preset](./glossary/mastering/preset-selection.md) for how to pick one without treating a preset as a finished master.

### Restoration presets

The last five names are restoration presets. They enable repair stages only and leave level alone: no loudness target, no ceiling, no tone or dynamics stage. Each one turns on the subset of the [repair chain](#the-repair-stages) its source material needs, and every stage it does not mention stays off.

| Preset | For | Stages it enables |
|--------|-----|-------------------|
| `vinyl` | An LP transfer: clicks and pops from groove damage, crackle from the surface, a noise floor under everything | `declick`, `decrackle`, `denoise`, all at their defaults |
| `tapeHiss` | A tape transfer whose whole defect is broadband hiss; machine hum is not universal enough across tape sources to turn `dehum` on by default | `denoise` |
| `fieldRecording` | Location audio: a mic floor, mains hum from whatever circuit the gear ran off, and the space it was captured in | `denoise`, `dehum` with `adaptive` on so it follows a grid frequency that drifts within tolerance rather than sitting on the configured 50 Hz, `dereverb` |
| `voiceMemo` | Phone or laptop capture: clipped against its own AGC, a high mic floor, recorded in whatever room the speaker was in | `declip`, `denoise`, `dereverb` |
| `shellac78` | A 78 rpm shellac transfer, whose coarser groove wears into wider pops and denser surface noise than an LP, over a higher noise floor | `declick` with `maxClickSamples` raised to 16 so a 78-length click still reaches the LPC reconstruction instead of the interpolation fallback; `decrackle` with `threshold` lowered to 0.25 so more of the surface counts as crackle; `denoise` with `reductionDb` deepened to 32 |

Hear what one repair stage does on the kind of material these presets exist for. The clip is a piano turnaround carrying mains hum, surface noise, and sparse clicks; the stage applied is the classical dereverberator, so what comes out is the noise bed and the smeared tails, while the clicks and the hum stay for the declick and dehum stages to handle:

<SonareDemo id="mastering-restoration" />

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

::: details What is sidechaining / ducking?
Sidechaining lets one signal control a processor applied to another. The most common use is **ducking**: a music bed is automatically turned down whenever a voice is present, then comes back up in the gaps — the way background music drops under a narrator.
:::

::: details What is parallel compression?
A normal compressor turns the loud parts down.

**Parallel compression** mixes the *original* signal with a *heavily compressed* copy. The compressed copy lifts quiet detail, while the original keeps the natural peaks.

Use it when you want density and "glue" without flattening transients. It is also called New York compression. `dynamics.transientShaper` is the related tool for the opposite goal: exaggerating or softening the attack of each hit.
:::

Drag the threshold and ratio to watch the transfer curve bend and hear a `dynamics.compressor` work on a live signal:

<SonareDemo id="compressor-curve" />

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
A few capabilities sit underneath the maximizer/final and analysis APIs:

- Integrated LUFS measurement supports surround layouts up to 8 channels, applying the [BS.1770](./algorithm-references.md) channel weights. BS.1770-4 itself normatively defines layouts only up to 5.1 (6 channels); the 7.1/8-channel weighting (treating the side-surround pair like the rear surrounds, +1.5 dB) is a non-normative extrapolation, not part of the standard.
- The internal oversampler and true-peak stages accept power-of-two oversampling factors from 1 to 16 (1, 2, 4, 8, 16; the live meter accepts the same factors), trading CPU for inter-sample-peak accuracy.
- The loudness stage is not a gain trim followed by a separate limiter: it applies one static gain of `target - current` and then drives its own post-gain true-peak limiter to take back whatever that gain pushed over the ceiling. `loudness.maxLimiterGainReductionDb` (12 dB; must be finite and at least 0) bounds how far it will drive that limiter — the static gain may exceed the peak headroom toward the ceiling by at most this much. It decides how peaky an input the stage will still try to normalize, not how loud a master can get: the allowance never permits more gain than `target - current` asks for, and the ceiling itself is never exceeded. Every loudness path shares the same default, so the chain, the standalone helper and the named processor (`maximizer.loudnessOptimize` reads the same key as `maxLimiterGainReductionDb`) normalize alike. Setting it to `0` restores a strict headroom clamp, which on peak-normalized material leaves the loudest targets short — `sonare mastering song.wav --preset pop --params "loudness.maxLimiterGainReductionDb=0"` lands at -16.19 LUFS against -14.06 at the default. Whatever shortfall remains is the limiter's own gain reduction, which one non-iterating pass does not re-measure, and is reported through `loudnessTargetLimited`.
- `maximizer.truePeakLimiter` enforces its ceiling sample by sample, never as a whole-block rescale, and every stage inside it carries its state across calls. Its output therefore does not depend on how the caller chunks the stream: the same material rendered in one block, in uniform blocks from 256 to 16384 samples, or in a ragged split that lands mid-transient comes out identical, so a streaming render and an offline render agree. What is left is a small inter-sample residue that is a property of measuring finer than the limiter runs, not of the block size — a meter at 8x oversampling reads about +0.02 dB above the ceiling set by the default 4x limiter, flat from 0 to +36 dB of drive. Meter at the limiter's own oversampling to see the ceiling held exactly, or raise its `oversampleFactor` to push the residue down.
- For UI metering, pass `maxPoints` to `meteringVectorscope(...)` and `meteringPhaseScope(...)`: they thin the point series down to at most `maxPoints` points, so a busy scope stays cheap to draw. (Without `maxPoints` they emit one point per input sample. The older `meteringVectorscopeDecimated(...)` / `meteringPhaseScopeDecimated(...)` aliases are deprecated and just delegate.) `meteringSpectrumFrame(...)` reads a single, non-time-averaged spectrum frame for spectrum-analyzer snapshots.
- Every `multiband.*` solo processor — `compressor`, `dynamicEq`, `expander`, `imager`, `limiter`, and `saturation` — shares the same crossover mechanism and accepts a custom number of crossover cutoffs, so you can split into the band count your material needs instead of a fixed three. This entry point exposes up to 8 `cutoffNHz` slots (`cutoff0Hz` … `cutoff7Hz`), so a single `multiband.*` call can address up to 9 bands.
:::

::: info Anti-aliasing on the distortion stages
Five processors shape the waveform hard enough to fold energy back down the spectrum, and each takes an `aliasing` parameter selecting how that is handled: `0` none, `1` first-order antiderivative anti-aliasing (ADAA1), `2` second-order (ADAA2), `3` a 4x oversampled path.

| Processor | Modes it implements |
|---|---|
| `saturation.hardClipper` | none, ADAA1, ADAA2, 4x oversample |
| `saturation.softClipper`, `saturation.waveshaper` | none, ADAA1, 4x oversample |
| `saturation.exciter`, `spectral.presenceEnhancer` | none, 4x oversample |

A mode a processor does not implement is refused rather than silently ignored, and the message names the set that would have worked — `soft clipper ADAA2 anti-aliasing is not supported; use None, Adaa1, or Oversample4x`. Asking a processor outside this set of five for the parameter at all is refused by key: `unknown --params key for saturation.tube: aliasing`.

The oversampled path aligns its dry signal and reports the delay it introduces: the up-and-down round trip through a 24-tap-per-phase polyphase filter costs 24 samples at the base rate, so the latency is `24` on the 4x path where the other modes report `0`. It reaches you wherever the processor's result does — `latencySamples` on the `MasteringResult` that `masteringProcess()` returns in the browser and in Node, `latency_samples` on the Python `MasteringResult` and on the C `SonareMasteringResult`, and `latency_samples()` on the processor itself when it is hosted as an insert. Compensate for it the same way you would for any other latency the chain reports.
:::

::: info What is a crossover?
A crossover splits the signal into frequency bands (e.g. lows / mids / highs) so each band can be processed separately. The "crossover cutoffs" are the frequencies where one band ends and the next begins; more cutoffs means more bands and finer control.
:::

## Chain order

A full chain — `masterAudio`, `masteringChain`, and every preset — runs its slots in one fixed order: repair → eq → dynamics → saturation → spectral → stereo (on the stereo path only) → maximizer → loudness. A configuration chooses which slots run, never where. The figure shows every slot the engine has, in run order, with the ones the `pop` preset enables filled in; the empty ones are still there in place, waiting for a configuration that turns them on.

<MasteringChainFigure
  title="Every chain slot, in the order the engine runs them"
  :enabled="['eq.tilt', 'dynamics.compressor', 'dynamics.transientShaper', 'saturation.exciter', 'stereo.imager', 'loudness.optimize']"
/>

### The repair stages

The repair family is the one people ask about, because six stages share one slot and their order matters. Whatever subset a configuration enables runs widest-damage-first, so each stage sees material the previous one has already made well-formed:

1. `declip` — before `declick`, because a flat-topped region has no transient for a click detector to measure.
2. `declick`
3. `decrackle`
4. `dehum`
5. `denoise`
6. `dereverb` — last, because a broadband noise floor reads as a stationary late tail and would bias the reverb estimate toward it.

::: details `repair.denoise.reductionDb` — depth, not floor
The denoise stage's depth is `repair.denoise.reductionDb`: the deepest attenuation the gain mask may apply to any bin, in dB. It must be finite and non-negative and has no upper bound; the default is `26`, and a larger number removes more. It acts as a residual-noise floor rather than a gate — at 26 dB the noise is left 26 dB down instead of removed, which is what keeps a denoised result from sounding gated. The report the standalone `masteringRepairDenoiseClassical` entry point returns says how often that floor bound: `maxReductionDb` saturating at `reductionDb` means the floor, not the estimator, set the depth, and `floorLimitedFraction` is the share of mask cells sitting on it.

The same knob is also accepted as a linear floor. A `repair.denoise.gainFloor` key is converted on read, `reductionDb = -20 * log10(gainFloor)`, and the conversion carries the old validity range with it: a floor above 1 becomes a negative depth and is refused. The shorthand keys `repair.reductionDb` and `repair.gainFloor` map to the same denoise slot. Flat overrides, the JSON chain document, and the nested `MasteringChainConfig` types in the browser and Node bindings all accept `gainFloor` this way, and the TypeScript types mark it deprecated in favour of `reductionDb`.
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

::: warning Stereo-family processors use a different entry point
Most processors run through the single-array `masteringProcess()` (mono, or interleaved). The stereo-family processors (`stereo.imager`, `stereo.monoMaker`, `stereo.autoPan`, `stereo.haasEnhancer`, `stereo.phaseAlign`, `stereo.stereoBalance`) operate on true left/right channels, so call them through the separate stereo entry point `masteringProcessStereo()` / `mastering_process_stereo()`, which takes distinct `left` and `right` arrays. `stereo.monoMaker` uses `frequencyHz` as the crossover below which it collapses the signal toward mono; `amount` controls how strongly it does so. The same is true of `eq.midSide` and the `multiband.*` processors. Passing these to `masteringProcess()` cannot express independent channels — see [How to call them](#how-to-call-them) for the exact signatures.
:::

::: details What is dither?
When you reduce bit depth (e.g. 24-bit down to 16-bit for CD/streaming), rounding creates a faint distortion on quiet tails. Dither adds a tiny, carefully shaped noise that masks that distortion so fades sound smooth instead of grainy. Apply it once, last, at the final bit-depth reduction.
:::

::: warning Repair is classical DSP, by design
`repair.denoiseClassical`, `repair.dereverbClassical`, and related processors use spectral subtraction / MMSE-STSA / LogMMSE with explicit noise estimation.

They are **not** DNN source separation or neural spectral repair.

- Good for: noise, hum, clicks, clipping, and mild room smear.
- Not for: unmixing finished tracks or rebuilding missing sources.
- Design reason: the repair path stays deterministic and dependency-free.
:::

<SonareDemo id="repair-denoise" />

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
A guitar/bass-amp-style coloration stage in the form preamp drive → tone stack → power amp → cabinet. An oversampled 12AX7 triode drive stage sits behind a single `[0, 1]` drive knob, with a drive-scaled pre-emphasis shelf so the gain character shifts as you push it. After the drive comes a bass/mid/treble tone stack, then an optional power-amp section and a data-free cab voicing. The live automation targets are `drive` (0-1), `bassDb`, `midDb`, `trebleDb`, `presenceDb`, `levelDb`, `power`, `sag`, `transformer`, `nfb`, `micAxis`, `micBAxis`, `micBlend`, `cone`, `crossover`, `biasShift`, and `inputDb`; all are automatable through `set_parameter` on every binding. `power` adds a class-AB push-pull soft-saturation stage; `sag` models supply droop and bloom after hard hits; `transformer` adds low-frequency output-transformer saturation; `nfb` adds a negative-feedback loop around the active power stage. `cab` (boolean), `cabModel` (`0` = guitar 4x12, `1` = bass 8x10), and `ampModel` (`0` = classic crunch, `1` = Fender-style clean, `2` = modern high-gain, `3` = tweed, `4` = Vox-style chime, `5` = rectifier) are discrete topology choices, so set them at construction time rather than automating them.

The cabinet and microphone keys are included in `masteringInsertParamInfo('saturation.ampSim')` with nullable ids. Most are construction-only (`id: null`, `rtSafe: false`), while `micAxis`, `micBAxis`, `micBlend`, and `cone` have live automation ids; the other live targets are `crossover`, `biasShift`, and `inputDb`. Read each descriptor before deciding whether a cabinet or microphone control can be changed after preparation:

| Key | Meaning |
|-----|---------|
| `preset` | Named amp rig, resolved before any numeric key applies |
| `cabIrF32Base64` | A captured cabinet impulse response, base64-encoded 32-bit float samples |
| `cabIrSampleRate` | The rate that capture was made at; `0` means it is already at the processor's rate |
| `cabIrGenerate` | Synthesize a cabinet impulse response from `cabModel` instead of using the analytic cab voicing |
| `cabIrDrivers` | Whether the cabinet's other drivers are summed into a generated impulse response |
| `micModel`, `micAxis`, `micDistanceCm`, `micBlend` | The first microphone: type (`0` none, `1` dynamic, `2` ribbon, `3` condenser), on-axis position, distance, and blend |
| `micBModel`, `micBAxis`, `micBDistanceCm`, `micBInvert` | The second microphone of a pair, with a polarity flip |
| `cone`, `doppler` | Cone breakup and cone-motion Doppler; `doppler` moves the reported latency |
:::

::: warning Drain the tail of an offline `saturation.ampSim` render
The tail this processor reports includes the cabinet impulse response, not just the second microphone's path-length delay. A loaded or generated cabinet response runs to roughly 21 ms at 48 kHz at its longest, so an offline bounce that stops pulling output at the last input sample loses that much cabinet decay — the render simply ends early and a little dry, with nothing to indicate it happened. Keep reading output until the reported tail is drained.
:::

::: info Prepare it for the channel count you will actually render
`saturation.ampSim` allocates per channel: each one owns a cabinet-IR ring, a Doppler line, and two microphone delay lines. That makes it far and away the heaviest member of the saturation family to prepare — preparing the realtime maximum channel count for a mono bounce reserves around 84 MB where the equivalent `saturation.tube` render uses 2.6 MB, which is enough to fail an allocation inside a large WebAssembly mixing graph.

The channel-aware `prepare` overload reserves state only for the channels it will process, so use it for an offline mono or stereo render. A realtime caller using the two-argument `prepare` is unaffected either way.
:::

## Pair processors and analyses

Pair processors consume a source **and** a reference. Pair/stereo *analyses* return measurement JSON and do not render audio by themselves.

| Type | Names |
|------|-------|
| Pair processors | `match.applyMatchEq`, `match.alignReferenceToSource`, `match.abSwitch`, `match.abCrossfade` |
| Pair analyses | `match.referenceLoudness`, `match.tonalBalance`, `match.tonalBalanceLogBands`, `match.matchEqCurve`, `match.estimateReferenceDelaySamples` |
| Stereo analyses | `stereo.monoCompatCheck`, `stereo.monoCompatCheckLogBands` |

These are registry names you pass to `masteringPairAnalyze(...)` / `masteringStereoAnalyze(...)`. Separately from the registry, the assistant helpers have their own stereo entry points that take a left/right pair directly — `masteringAudioProfileStereo`, `masteringAssistantSuggestStereo`, and `masteringStreamingPreviewStereo`. Use them instead of profiling a downmix, which under-reports integrated loudness by about 6 dB on decorrelated material; see [Stereo sources](./mastering-assistant.md#stereo-sources).

::: details What do "tonal balance" and "mono compatibility" measure?
- **Tonal balance** (`match.tonalBalance`) describes how a track's energy is spread across frequency bands — how much sub, bass, mid, presence, and air it has. Comparing your tonal balance to a reference track shows where you are darker or brighter, which is what `match.applyMatchEq` then corrects.
- **Mono compatibility** (`stereo.monoCompatCheck`) predicts what happens when your stereo mix is summed to mono (phone speakers, club PAs, some broadcast paths). If the left and right channels are out of phase, parts can cancel out and lose level when folded down. The check flags that risk before it surprises a listener. See [Mono Compatibility](./glossary/concepts/mono-compatibility.md) for a deeper walk-through.
:::

::: warning A match curve is defined only inside its frequency limits
`match.applyMatchEq` and the `match.matchEqCurve` analysis fit the correction over `[minFrequencyHz, maxFrequencyHz]` — 40 Hz to 18 kHz by default — using at most `maxBands` bands (default 8) of at most `maxGainDb` (default 12). Nothing outside that interval is matched.

Both realizations of the curve say so, which is what lets you swap between them. The parametric realization places no band outside the limits. The FIR realization tapers its gain back to unity over one octave beyond each edge, narrowed on the high side when Nyquist is closer than an octave so the weight reaches zero exactly at Nyquist.

The taper is load-bearing, not a cosmetic smoothing. Carrying the fitted gain all the way down to DC instead would let a thin source matched against a bass-heavy reference reach the full `maxGainDb` below the low limit — a broadband offset plus subsonic energy that eats the headroom of every stage after it — while the parametric realization of the very same match left that region untouched. Lower `minFrequencyHz` if you actually want the sub region matched; do not expect the default fit to reach it.
:::

::: details Match EQ construction keys
`match.applyMatchEq` and `match.matchEqCurve` read the same curve-fitting keys. The remainder configure the FIR realization only.

| Key | Default | Meaning |
|-----|---------|---------|
| `minFrequencyHz` | `40` | Low edge of the matched band; must be greater than 0 |
| `maxFrequencyHz` | `18000` | High edge of the matched band; must be greater than `minFrequencyHz` |
| `maxBands` | `8` | Most bands the fit may use |
| `maxGainDb` | `12` | Largest correction any one band may apply |
| `q` | `1.0` | Q of each fitted band |
| `smoothingBins` | `2` | Spectral smoothing applied before fitting |
| `fftSize` | `2048` | Analysis FFT size for the FIR realization |
| `kernelSize` | `513` | FIR kernel length |
| `phase` | `0` | `0` = linear phase, `1` = minimum phase |
| `partitionSize` | `0` | Convolution partition size; `0` selects it automatically |
:::

::: details Reading `stereo.monoCompatCheck` and `stereo.monoCompatCheckLogBands`
`stereo.monoCompatCheck` returns one whole-signal verdict: `correlation`, `width`, `monoPeak`, `sideRms`, and a `likelyMonoCompatible` flag decided against its single `correlationThreshold` parameter (default `0`).

`stereo.monoCompatCheckLogBands` spreads the same measurement across a logarithmic band set — `bandsPerOctave` (default `3`) between `lowHz` (default `20`) and `highHz` (default `20000`) — and returns a `bands` array whose entries each carry `lowHz`, `highHz`, `correlation`, and `sideRms`.

Each band's correlation covers that band's whole `[lowHz, highHz)` interval rather than a single probe at its logarithmic centre, and the difference decides whether the read-out can be trusted. Two components inside one band, one in phase and one anti-phase, cancel when the mix is folded down; a centre-frequency probe would see only whichever of them happened to sit nearer the centre and call the band correlated. Measuring the interval reports the cancelling pair for what it is.

Band count does not drive cost the way it looks like it should: the bands share one set of transforms instead of each taking its own full-length pass, so a thirty-band split over a long buffer is nowhere near ten times the work of a three-band one. Choose the resolution the material needs.
:::

## Mixer and engine inserts

The creative-FX insert catalog — reverb, modulation, and delay insert IDs, their parameter tables, the `masteringInsertNames()` discovery APIs, and `SONARE_HAVE_FX` / `BUILD_ACOUSTIC_SIM` build gating — lives on its own page: [Effects Inserts](./effects-inserts.md).

## How to call them

Use `capabilityCatalog()` / `capability_catalog()` when a host needs one build-aware picker across solo, pair, and creative-insert processors. It lists each processor's parameter descriptors — name, nullable id, type, unit, realtime-safety, `min` / `max` / nullable `default`, `choices`, and slot membership — plus the processor `slots` metadata, built-in preset lists, and mastering-preset metadata. `masteringProcessorCatalog()` is the narrower mastering registry classification used for mastering-specific pickers.

### Reading a catalog bound

Every descriptor carries the ten fields, so a host can size a control straight from the catalog instead of transcribing the per-processor tables on this page. Construction-only keys appear with `id: null` and `rtSafe: false`; an id-bearing descriptor with `rtSafe: false` is also unavailable for live automation. `default` may be `null` when there is no fallback. `choices` describes a closed named numeric set, including discrete values with gaps, and `slot` links a key to a slot group. The group's `activation`, `parent`, and `minCrossoverCutoffs` in the processor `slots` metadata determine whether that group is present. A `null` bound is not missing data — it states that the catalog knows of no limit on that side.

The two kinds of value come from different places, and that decides how far a host can trust them:

- The **default** is the processor config struct's own field initializer, recorded as each builder falls back to it. A field whose initializer changes therefore cannot leave a stale number behind in the catalog.
- The **range is measured**, not declared. Candidate values go through the same construction path a caller uses, and the catalog reports the interval validation accepted.

::: warning A bound is a hard constraint, not a recommended range
`min` and `max` describe what the processor will *accept*. They are not a musically sensible range to sweep a control over: a value inside the interval can still be a bad setting, and a value outside it is rejected rather than clamped.
:::

Because the range is measured rather than declared, three properties follow that a host has to allow for:

- **Each bound is measured with the other parameters at their defaults.** Two controls that constrain each other therefore each report the *other's default* as their limit. `maximizer.adaptiveRelease` publishes `minReleaseMs` with a ceiling of 250 and `maxReleaseMs` with a floor of 20 for exactly that reason — those are the sibling's default values, not a limit on the pair as a whole.
- **A sample-rate-derived bound reflects the un-prepared processor.** Every EQ `band*.frequencyHz` ceiling reads as 24000, and rises once the insert is prepared at a higher rate.
- **An exclusive bound is reported as the limit it excludes.** `dynamics.compressor` publishes a `sidechainHpfHz` `min` of 0 and still rejects 0.

The per-band EQ surface is the bulk of the flat parameter set: `eq.parametric`, `eq.midSide`, and `multiband.dynamicEq` publish descriptors for every indexed `band*` field, including construction keys. Publishing them does not widen which keys count as *read* — a band supplied incompletely still has its remaining keys reported as ignored.

::: code-group

```typescript [Browser]
const build = capabilityCatalog();
console.log(build.processors.length, build.presets.mastering);

masteringProcessorNames();   // discover solo processor ids at runtime
masteringProcessorCatalog(); // classify processors for picker/filter UIs
masteringInsertParamInfo('eq.parametric'); // construction and automation metadata
masteringInsertTiming('eq.parametric', { 'band0.frequencyHz': 1000 }, sampleRate);
masteringPresetParams('pop'); // flat overrides for masterAudio

const out = masteringProcess('dynamics.compressor', samples, sampleRate, {
  thresholdDb: -24,
  ratio: 1.5,
});

const stereo = masteringProcessStereo('stereo.imager', left, right, sampleRate, { width: 1.1 });

// Analyses return JSON strings — parse them
const report = JSON.parse(masteringPairAnalyze('match.referenceLoudness', source, reference, sampleRate));
const mono   = JSON.parse(masteringStereoAnalyze('stereo.monoCompatCheck', left, right, sampleRate));
```

```typescript [Node]
import {
  capabilityCatalog,
  masteringInsertParamInfo,
  masteringInsertTiming,
  masteringPairAnalyze,
  masteringProcess,
  masteringProcessStereo,
  masteringProcessorCatalog,
  masteringProcessorNames,
  masteringPresetParams,
  masteringStereoAnalyze,
} from '@libraz/libsonare-native';

const build = capabilityCatalog();
console.log(build.processors.length, build.presets.mastering);

masteringProcessorNames();
masteringProcessorCatalog();
masteringInsertParamInfo('eq.parametric');
masteringInsertTiming('eq.parametric', { 'band0.frequencyHz': 1000 }, sampleRate);
masteringPresetParams('pop');

const out = masteringProcess('dynamics.compressor', samples, sampleRate, {
  thresholdDb: -24,
  ratio: 1.5,
});
const stereo = masteringProcessStereo('stereo.imager', left, right, sampleRate, { width: 1.1 });
const report = JSON.parse(masteringPairAnalyze('match.referenceLoudness', source, reference, sampleRate));
const mono = JSON.parse(masteringStereoAnalyze('stereo.monoCompatCheck', left, right, sampleRate));
```

```python [Python]
import json
import libsonare as sonare

build = sonare.capability_catalog()
print(len(build["processors"]), build["presets"]["mastering"])

sonare.mastering_processor_names()   # discover solo processor ids at runtime
sonare.mastering_insert_param_info('eq.parametric')
sonare.mastering_insert_timing('eq.parametric', {'band0.frequencyHz': 1000}, sr)
sonare.mastering_preset_params('pop')

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
# inspect this build and its capability-catalog summary
sonare doctor --json

# discover solo processor ids
sonare mastering-processors

# The CLI lists and applies presets, but does not expose the API-only timing or
# flat-preset-parameter queries.
sonare mastering-presets

# apply one solo processor (--params are floats: k=v,k=v)
sonare mastering-processor song.wav --processor dynamics.compressor \
  --params "thresholdDb=-24,ratio=1.5" -o out.wav

# two-input (pair) analysis prints JSON
sonare mastering-pair-analyze song.wav --reference ref.wav --analysis match.referenceLoudness

# The Python CLI has no dedicated mastering-stereo-analyze subcommand; only
# source-built C++ CLI builds expose the two-channel stereo analyses.
# (The Python `mastering-processor` command does run stereo-only processors,
#  but previews them by duplicating the mono input across left/right.)
```

:::

Native C callers use `sonare_mastering_insert_timing` with the same flat JSON parameter map and sample-rate query, and `sonare_mastering_preset_params_json` to obtain `{"version":1,"params":{...}}` for a named preset; free the returned JSON with the C ABI's string-free function. `sonare_capability_catalog_json` carries the `masteringPresets` metadata. The CLI exposes preset names and application, but not these timing or parameter-map queries.

:::: details Config style differs between chain entry points
The registry is string-based so C, Python, Node, WASM, and CLI callers share processor identifiers.

When you assemble a *chain* rather than a single processor, the config style depends on the entry point:

| Entry point | Config style |
|-------------|--------------|
| WASM `masteringChain(...)` | Nested config objects; dot-notation leaf keys are also accepted in the same object |
| `masterAudio(...)` and Python/Node equivalents | Flat dot-notation overrides such as `'loudness.targetLufs'` |
| [Mastering Assistant](./mastering-assistant.md) `chainConfig.params` | Flat form, ready for `masterAudio`. `params["dynamics.multibandComp"]` can also carry the nested, arbitrary-band v2 object described below — see [The chain-config JSON schema](#the-chain-config-json-schema) |

`MasteringChainConfig` accepts both spellings. A dot-notation leaf such as `'loudness.targetLufs': -20` can sit beside — or replace — the nested `loudness: { targetLufs: -20 }`, and the core validates the key and rejects an unknown one. Dot notation is the form the C ABI carries parameters in, which is what makes it the convenient shape when you are assembling overrides dynamically rather than writing them out.

The nested spelling is the canonical one, so prefer it in hand-written code: TypeScript checks a nested config field by field, while a dotted key is only checked at run time.

Repair chain keys follow the chain slots, not the one-shot registry names: use `repair.denoise.*` / `repair.dereverb.*` in flat overrides or the nested `repair: { denoise: ..., dereverb: ... }` shape in `masteringChain(...)`.
::::

## The chain-config JSON schema

The flat `chainConfig.params` map (the shape `chainConfig.params` uses in the table above, and the shape `masterAudio` overrides accept) has a JSON-document serialization used by the CLI and the [Mastering Assistant](./mastering-assistant.md): `sonare mastering --config <file>` reads it, and `masteringAssistantSuggest`'s `chainConfig` is expressed in it. That serialization auto-selects one of two schema versions.

::: details Version 1 vs. version 2
- **Version 1** — the flat, fixed **3-band** low/mid/high multiband compressor shape: `dynamics.multibandComp.lowCutoffHz`, `.highCutoffHz`, and per-band `lowThresholdDb`/`midThresholdDb`/`highThresholdDb` and their ratio/attack/release siblings. This is what every flat-override entry point sends, and what the Mastering Assistant always emits in practice — it never customizes the multiband compressor beyond the default 3-band shape, so its `chainConfig` stays version 1.
- **Version 2** — selected automatically once the multiband compressor configuration can no longer be represented as the fixed 3-band shape (a different cutoff count, non-default crossover slope/mode, or a non-default FIR kernel size). In that case `params["dynamics.multibandComp"]` becomes a structured object instead of the flat `low`/`mid`/`high` keys:
  - `crossover.cutoffsHz[]`, `crossover.slope`, `crossover.mode`, `crossover.firKernelSize`
  - `bands[]` — up to **64 bands**, each with `thresholdDb`, `ratio`, `attackMs`, `releaseMs`, `kneeDb`, `makeupGainDb`, `autoMakeup`, `detector`, `sidechainHpfEnabled`, `sidechainHpfHz`, `pdrTimeMs`, `pdrReleaseScale`

  Field validation is strict: unknown keys anywhere in the version-2 `dynamics.multibandComp` object are rejected, and the band count must equal the cutoff count plus one.
:::

::: warning Reachability: JSON-document feature, not a JS-object feature
The version-2 structured form is reachable through the JSON document — the CLI's `sonare mastering --config <file>`, or any code that reads/writes chain config as JSON. The WASM `masteringChain()` TypeScript `MasteringChainConfig.dynamics.multibandComp` interface still only exposes the fixed low/mid/high shorthand, so the arbitrary-band form cannot be reached by building a `MasteringChainConfig` object directly in JavaScript — only by writing the JSON document yourself or generating one with the wider crossover count (for example through the [named processor](#solo-processors) `multiband.compressor` and its up-to-9-band `cutoffNHz` slots) and passing it through the JSON path.
:::

## Related

- [Mastering Assistant](./mastering-assistant.md) — profile/suggest/preview JSON and the suggestion→render path
- [Mastering Implementation](./mastering-implementation.md) — the chain that renders in the browser demo
- [DSP Implementation Notes](./dsp-implementation.md) — how each family behaves
- [Mixing Engine](./mixing.md) — load these processors as channel-strip/bus inserts
