---
title: Mastering Processors
description: The named mastering API of libsonare — presets, solo processors, and pair/stereo analyses — with a goal-to-processor guide, kept in sync with the runtime registry.
---

# Mastering Processors

This page is the **registry** for the named mastering API in libsonare. It answers *"what can I call?"*, not *"how does it work internally?"*

If *dBFS*, *headroom*, or *mastering chain* are unfamiliar, read [Audio Basics](./glossary/concepts/audio-basics.md) and [What Is Mastering?](./glossary/concepts/what-is-mastering.md) first — this page assumes that vocabulary and focuses on the processor names.

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
The dynamics family includes `dynamics.duckingProcessor` (sidechain ducking), `maximizer.loudnessOptimize` (maximizing toward a [LUFS](./glossary/lufs.md) target — LUFS is Loudness Units relative to Full Scale, the broadcast loudness scale), and a bandpass `Q` control on `dynamics.deesser` (with stereo preservation), alongside `dynamics.transientShaper`, `dynamics.upwardCompressor`, `dynamics.upwardExpander`, `dynamics.vocalRider`, and `dynamics.sidechainRouter`.
:::

## Presets

Presets are named chain configurations, not separate algorithms. Apply one with `masterAudio(samples, sr, preset, overrides?)`.

`pop`, `edm`, `acoustic`, `hipHop`, `aiMusic`, `speech`, `streaming`, `youtube`, `broadcast`, `podcast`, `audiobook`, `cinema`, `jpop`, `ambient`, `lofi`, `classical`, `drumAndBass`, `techno`, `metal`, `trap`, `rnb`, `jazz`, `kpop`, `trance`, `gameOst`, `vinyl`, `tapeHiss`, `fieldRecording`, `voiceMemo`, `shellac78`

`masteringPresetNames()` returns this compact name list. The capability catalog's `masteringPresets` array adds `kind`, `targetLufs`, `truePeakCeilingDb`, and `maxLimiterGainReductionDb` for each name; restoration entries have `null` for the three numeric fields. Use `masteringPresetParams(preset)` to expand a selected name into the flat numeric/boolean map accepted by `masterAudio` overrides.

See [Choosing a Mastering Preset](./glossary/mastering/preset-selection.md) for how to pick one without treating a preset as a finished master.

### Restoration presets

The last five names are restoration presets. They enable repair stages only, with no separate loudness normalization: no loudness target, no ceiling, no tone or dynamics stage. Each one turns on the subset of the [repair chain](#the-repair-stages) its source material needs, and every stage it does not mention stays off.

| Preset | For | Stages it enables |
|--------|-----|-------------------|
| `vinyl` | An LP transfer: clicks and pops from groove damage, crackle from the surface, a noise floor under everything | `declick`, `decrackle`, `denoise`, all at their defaults |
| `tapeHiss` | A tape transfer whose whole defect is broadband hiss; machine hum is not universal enough across tape sources to turn `dehum` on by default | `denoise` |
| `fieldRecording` | Location audio: a mic floor, mains hum from whatever circuit the gear ran off, and the space it was captured in | `denoise`, `dehum` with `adaptive` on so it follows a grid frequency that drifts within tolerance rather than sitting on the configured 50 Hz, `dereverb` |
| `voiceMemo` | Phone or laptop capture: clipped against its own AGC, a high mic floor, recorded in whatever room the speaker was in | `declip`, `denoise`, `dereverb` |
| `shellac78` | A 78 rpm shellac transfer, whose coarser groove wears into wider pops and denser surface noise than an LP, over a higher noise floor | `declick` with `maxClickSamples` raised to 16, because a run longer than that cap is counted as `rejected` and left unrepaired, and the wider 78 rpm clicks would otherwise be skipped; `decrackle` with `threshold` lowered to 0.25 so more of the surface counts as crackle; `denoise` with `reductionDb` deepened to 32 |

Hear what one repair stage does on the kind of material these presets exist for. The clip is a piano turnaround carrying mains hum, surface noise, and sparse clicks; the stage applied is the classical dereverberator. It can change the tail and timbre, but this demo does not run the declick or dehum stages:

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

Drag the threshold and ratio to watch the transfer curve bend and hear a `dynamics.compressor` work on a live signal ([Dynamics Controls](./glossary/mastering/dynamics.md) explains threshold, ratio, attack, release and knee with a worked table):

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

- Integrated LUFS measurement supports surround layouts up to 8 channels, applying the [BS.1770](./algorithm-references.md) channel weights by loudspeaker position: +1.5 dB (a power weight of 1.41) for a channel between 60° and 120° azimuth at ear level, unity elsewhere, and the LFE channel left out. The 5.1 surrounds at ±110° take +1.5 dB; in 7.1 the side pair (`Lss`/`Rss`, ±90°) takes +1.5 dB and the back pair (`Ls`/`Rs`, ±135°) takes unity. The quad surrounds at ±135° are unity as well. The same weights apply to the live mixer meter, the playback loudness meter and night-mode dynamic range control.
- The internal oversampler and true-peak stages accept power-of-two oversampling factors from 1 to 16 (1, 2, 4, 8, 16; the live meter accepts the same factors), trading CPU for inter-sample-peak accuracy.
- The loudness stage is not a gain trim followed by a separate limiter. It applies one static gain, then drives its own post-gain true-peak limiter to take back whatever that gain pushed over the ceiling. The gain is solved for the gated target by remeasuring the signal at the candidate gain, so it equals `target - current` only when the gain moves no blocks across the absolute gate. The same solve backs A/B loudness match, reference matching, LUFS normalize, and `maximizer.loudnessOptimize`, and every one of those paths shares the default below, so the chain, the standalone helper and the named processor normalize alike.
- `loudness.maxLimiterGainReductionDb` (`maximizer.loudnessOptimize` reads the same key as `maxLimiterGainReductionDb`; finite and at least 0) bounds how far the stage drives that limiter: the static gain may exceed the peak headroom toward the ceiling by at most this much. It decides how peaky an input the stage will still try to normalize, not how loud a master can get, because the allowance never permits more gain than the solved target gain asks for and the ceiling is never exceeded.

  | Value | Behavior |
  |---|---|
  | `12` (default) | The limiter may take back up to 12 dB of the gain that exceeds the peak headroom |
  | `0` | A strict headroom clamp; on peaky material the loudest targets fall short |

  *Peak headroom* here is the distance from the input's true peak up to the ceiling ([Clipping and Headroom](./glossary/concepts/audio-basics.md#clipping-and-headroom)). Take a mix at −18 LUFS whose true peak already sits at −1 dBTP, normalized toward −14 LUFS under a −1 dBTP ceiling: the target asks for +4 dB, the headroom is 0 dB, so all 4 dB of that gain lands above the ceiling and the limiter has to take it back. That is within the default 12 dB allowance; with `0` the gain stops at 0 dB and the mix stays at −18 LUFS.

  A 6 s kick loop at -16.78 LUFS with a -14 LUFS target and -1 dBTP ceiling lands at -17.32 LUFS with `0` against -16.14 LUFS at the default. Whatever shortfall remains is the limiter's own gain reduction, which one non-iterating pass does not re-measure, and is reported through `loudnessTargetLimited`.
- `maximizer.truePeakLimiter` enforces its ceiling sample by sample, never as a whole-block rescale, and every stage inside it carries its state across calls. Its output guard rechecks every earlier position a correction can raise, so a short burst cannot overshoot the true-peak ceiling, and lowering the ceiling live re-evaluates output already queued. `maximizer.truePeakLimiter` and `maximizer.adaptiveRelease` each report 129 samples of latency at their defaults.
- The limiter's output does not depend on how the caller chunks the stream: the same material rendered in one block, in uniform blocks from 256 to 16384 samples, or in a ragged split that lands mid-transient comes out identical, so a streaming render and an offline render agree. What is left is a small inter-sample residue that is a property of measuring finer than the limiter runs, not of the block size: a meter at 8x or 16x oversampling reads the output of the default 4x limiter slightly above its ceiling. With a −1 dBTP ceiling at 48 kHz, a near-quarter-rate sine read −0.95 dBTP at 16x and broadband noise driven 24 dB into the limiter read −0.92 dBTP, so leave about 0.1 dB of margin when a finer meter checks the delivery. Meter at the limiter's own oversampling to see the ceiling held exactly, or raise its `oversampleFactor` to 8, which brought the same material to within 0.01 dB of the ceiling.
- For UI metering, pass `maxPoints` to `meteringVectorscope(...)` and `meteringPhaseScope(...)`: they thin the point series down to at most `maxPoints` points, so a busy scope stays cheap to draw. (Without `maxPoints` they emit one point per input sample. The older `meteringVectorscopeDecimated(...)` / `meteringPhaseScopeDecimated(...)` aliases are deprecated and just delegate.) `meteringSpectrumFrame(...)` reads a single, non-time-averaged spectrum frame for spectrum-analyzer snapshots.
- Every `multiband.*` solo processor (`compressor`, `dynamicEq`, `expander`, `imager`, `limiter`, and `saturation`) shares the same crossover mechanism and accepts a custom number of crossover cutoffs, so you can split into the band count your material needs instead of a fixed three. The solo and insert entry points expose up to 8 `cutoffNHz` slots (`cutoff0Hz` … `cutoff7Hz`), so a single `multiband.*` call addresses up to 9 bands; the mastering chain goes further, to 63 cutoffs and 64 bands (see [The chain-config JSON schema](#the-chain-config-json-schema)).
:::

::: info Anti-aliasing on the distortion stages
Five processors shape the waveform hard enough to fold energy back down the spectrum, and each takes an `aliasing` parameter selecting how that is handled: `0` none, `1` first-order antiderivative anti-aliasing (ADAA1), `2` second-order (ADAA2), `3` a 4x oversampled path.

| Processor | Modes it implements |
|---|---|
| `saturation.hardClipper` | none, ADAA1, ADAA2, 4x oversample |
| `saturation.softClipper`, `saturation.waveshaper` | none, ADAA1, 4x oversample |
| `spectral.presenceEnhancer` | none, ADAA1, 4x oversample |
| `saturation.exciter` | none, 4x oversample |

A mode a processor does not implement is refused rather than silently ignored, and the message names the set that would have worked — `soft clipper ADAA2 anti-aliasing is not supported; use None, Adaa1, or Oversample4x`. Asking a processor outside this set of five for the parameter at all is refused by key: `unknown --params key for saturation.tube: aliasing`.

The oversampled path aligns its dry signal and reports the delay it introduces: the up-and-down round trip through the polyphase filter costs 48 samples at the base rate, so the latency is `48` on the 4x path where `None` and `ADAA1` report `0` (ADAA1's half-sample delay is tracked in Q8 and the dry path of a blend is delayed to match) and `saturation.hardClipper`'s ADAA2 reports `1`. It reaches you wherever the processor's result does — `latencySamples` on the `MasteringResult` that `masteringProcess()` returns in the browser and in Node, `latency_samples` on the Python `MasteringResult` and on the C `SonareMasteringResult`, and `latency_samples()` on the processor itself when it is hosted as an insert. Compensate for it the same way you would for any other latency the chain reports.
:::

::: info What is a crossover?
A crossover splits the signal into frequency bands (e.g. lows / mids / highs) so each band can be processed separately. The "crossover cutoffs" are the frequencies where one band ends and the next begins; more cutoffs means more bands and finer control.

Slope, the four crossover modes and what the linear-phase mode costs are on [Crossover Slope and Mode](./glossary/mastering/crossover.md).
:::

## Chain order

A full chain — `masterAudio`, `masteringChain`, and every preset — runs its slots in one fixed order: repair → eq → dynamics → saturation → spectral → stereo (on the stereo path only) → maximizer → loudness. A configuration chooses which slots run, never where. The figure shows every slot the engine has, in run order, with the ones the `pop` preset enables filled in; the empty ones are still there in place, waiting for a configuration that turns them on.

<MasteringChainFigure
  title="Every chain slot, in the order the engine runs them"
  :enabled="['eq.tilt', 'dynamics.compressor', 'dynamics.transientShaper', 'saturation.exciter', 'stereo.imager', 'loudness.optimize']"
/>

### The repair stages

For detection and processing workflows, start with [Audio Repair](./audio-repair.md), [Noise and Hum Removal](./repair-noise.md), [Clicks, Crackle, and Clipping](./repair-transients.md), or [Dereverberation](./repair-reverb.md).

Six repair stages share one slot, and their order matters. The chain runs them offline; `decrackle`, `dehum`, `denoise` and `dereverb` are also available as causal realtime inserts under the registry ids `repair.decrackle`, `repair.dehum`, `repair.denoiseClassical` and `repair.dereverbClassical` (see [Audio Repair](./audio-repair.md#realtime-inserts)). `declick`, `declip` and `repair.trimSilence` are not causal and stay offline-only. Whatever subset a configuration enables runs widest-damage-first, so each stage sees material the previous one has already made well-formed:

1. `declip` — before `declick`, because a flat-topped region has no transient for a click detector to measure.
2. `declick`
3. `decrackle`
4. `dehum`
5. `denoise`
6. `dereverb` — last, because a broadband noise floor reads as a stationary late tail and would bias the reverb estimate toward it.

::: details `repair.denoise.reductionDb` — depth, not floor
The denoise stage's depth is `repair.denoise.reductionDb`: the deepest attenuation the gain mask may apply to any bin, in dB. It must be finite and lie in `[0, 120]`; the default is `26`. A larger value permits deeper attenuation, but does not guarantee that amount of noise reduction. At 26 dB the mask gain cannot fall below about 0.0501; actual attenuation depends on the estimated noise and signal. This gain floor reduces abrupt gating but does not eliminate artifacts. The report from the stereo, linked and `masteringRepairApply` entry points (the mono call returns only samples) says how often that floor bound: `maxReductionDb` saturating at `reductionDb` means the floor, not the estimator, set the depth, and `floorLimitedFraction` is the share of mask cells sitting on it.

The same knob is also accepted as a linear floor. A `repair.denoise.gainFloor` key is converted on read, `reductionDb = -20 * log10(gainFloor)`, and the conversion carries the old validity range with it: a floor above 1 becomes a negative depth and is refused, and a floor below `1e-6` becomes a depth above 120 dB and is refused too. The shorthand keys `repair.reductionDb` and `repair.gainFloor` map to the same denoise slot. Flat overrides, the JSON chain document, and the nested `MasteringChainConfig` types in the browser and Node bindings all accept `gainFloor` this way, and the TypeScript types mark it deprecated in favor of `reductionDb`.
:::

## Solo processors

| Family | Processor names |
|--------|-----------------|
| Dynamics | `dynamics.brickwallLimiter`, `dynamics.compressor`, `dynamics.deesser`, `dynamics.expander`, `dynamics.gate`, `dynamics.limiter`, `dynamics.parallelComp`, `dynamics.sidechainRouter`, `dynamics.duckingProcessor`, `dynamics.transientShaper`, `dynamics.upwardCompressor`, `dynamics.upwardExpander`, `dynamics.vocalRider` |
| Effects | `effects.acoustic.roomMorph`, `effects.delay.stereo`, `effects.filter.vowel`, `effects.gsEfx`, `effects.modulation.autoWah`, `effects.modulation.chorus`, `effects.modulation.ensemble`, `effects.modulation.flanger`, `effects.modulation.phaser`, `effects.modulation.pitchShifter`, `effects.modulation.ringModulator`, `effects.modulation.rotary`, `effects.modulation.wah`, `effects.reverb.convolution`, `effects.reverb.dattorro`, `effects.reverb.fdn`, `effects.reverb.plate`, `effects.reverb.room`, `effects.reverb.velvet` (FX builds; see [Effects Inserts](./effects-inserts.md)) |
| EQ | `eq.bandPass`, `eq.cutFilter`, `eq.dynamic`, `eq.equalizer`, `eq.graphic`, `eq.linearPhase`, `eq.midSide`, `eq.minimumPhase`, `eq.parametric`, `eq.passiveTube`, `eq.shelving`, `eq.steppedProportionalQ`, `eq.tilt` |
| Final | `final.bitDepth`, `final.dither`, `final.outputChain` |
| Maximizer | `maximizer.adaptiveRelease`, `maximizer.loudnessOptimize`, `maximizer.maximizer`, `maximizer.softKneeMax`, `maximizer.truePeakLimiter` |
| Multiband | `multiband.compressor`, `multiband.dynamicEq`, `multiband.expander`, `multiband.imager`, `multiband.limiter`, `multiband.saturation` |
| Repair | `repair.declick`, `repair.declip`, `repair.decrackle`, `repair.dehum`, `repair.denoiseClassical`, `repair.dereverbClassical`, `repair.trimSilence` (`decrackle`, `dehum`, `denoiseClassical` and `dereverbClassical` are also realtime inserts) |
| Saturation | `saturation.ampSim`, `saturation.bitcrusher`, `saturation.distortion`, `saturation.exciter`, `saturation.hardClipper`, `saturation.multibandExciter`, `saturation.overdrive`, `saturation.softClipper`, `saturation.tape`, `saturation.transformer`, `saturation.tube`, `saturation.waveshaper` |
| Spectral | `spectral.airBand`, `spectral.lowEndFocus`, `spectral.presenceEnhancer`, `spectral.spectralShaper` |
| Stereo | `stereo.autoPan`, `stereo.binaural`, `stereo.haasEnhancer`, `stereo.imager`, `stereo.monoMaker`, `stereo.phaseAlign`, `stereo.stereoBalance` |
| Utility | `utility.gain` |
| Voice | `voice.changer` (see [Realtime Voice Changer](./realtime-voice-changer.md)) |

::: warning Stereo-family processors use a different entry point
Most processors run through the single-array `masteringProcess()` (mono, or interleaved). The stereo-family processors (`stereo.imager`, `stereo.monoMaker`, `stereo.autoPan`, `stereo.binaural`, `stereo.haasEnhancer`, `stereo.phaseAlign`, `stereo.stereoBalance`) operate on true left/right channels, so call them through the separate stereo entry point `masteringProcessStereo()` / `mastering_process_stereo()`, which takes distinct `left` and `right` arrays. `stereo.monoMaker` uses `frequencyHz` as the crossover below which it collapses the signal toward mono; `amount` controls how strongly it does so. The same is true of `eq.midSide` and the `multiband.*` processors. Passing these to `masteringProcess()` cannot express independent channels — see [How to call them](#how-to-call-them) for the exact signatures.
:::

::: details What is dither?
When you reduce bit depth (e.g. 24-bit down to 16-bit for CD/streaming), rounding each sample to the nearest step leaves an error that follows the signal, which is heard as grainy distortion on quiet tails and fades. Dither adds a tiny random noise before the rounding, so the error no longer follows the signal: the distortion turns into a steady, very low hiss. `final.dither` uses TPDF (triangular) dither by default, the standard choice, which keeps both the average and the loudness of the error independent of the signal; RPDF (rectangular) and a noise-shaped option, which moves the hiss toward frequencies the ear is less sensitive to, are also available. Apply it once, last, at the final bit-depth reduction.
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

::: details Classical denoise: spectral subtraction vs MMSE gain
These are classical denoising methods. All of them work on short-time spectrum frames and need an estimate of the noise in each frequency bin first.

1. **Noise estimation.** The `quantile` estimator (the offline default) averages the quietest 10% of frames into one fixed noise spectrum. `mcra`, `imcra` and `spp` instead track the noise frame by frame, so they follow a floor that changes and can run in a stream; `spp` is what the realtime insert and the repair recommendation use.
2. **Spectral subtraction** subtracts that estimated noise power from each frame, with an over-subtraction factor and a floor.
3. **MMSE-STSA** and **LogMMSE** (the default) subtract nothing. From the estimated signal-to-noise ratio of each bin they compute a gain between the floor and 1 and multiply the bin by it.

The SNR they use is smoothed from frame to frame (the decision-directed estimate, `ddAlpha`), which is what keeps them from leaving the warbly "musical noise" that plain subtraction tends to. None of these methods separate instruments; they only attenuate noise.
:::

::: details `saturation.overdrive` and `saturation.distortion`
These two realtime-safe, multichannel processors model drive pedals. They are also usable as mixer or realtime inserts. The capability catalog reports the following construction bounds and defaults:

| Processor | Parameter | Accepted range | Default | Unit |
|-----------|-----------|----------------|---------|------|
| `saturation.overdrive` | `gainDb` | `0`–`41` | `20` | dB |
|  | `toneHz` | `500`–`8000` | `3000` | Hz |
|  | `levelDb` | no catalog minimum; maximum `770.636` | `0` | dB |
| `saturation.distortion` | `gainDb` | `0`–`60` | `30` | dB |
|  | `toneHz` | `475`–`20000` | `4000` | Hz |
|  | `levelDb` | no catalog minimum; maximum `770.636` | `0` | dB |

Both report `48` samples of latency; the catalog tail at 48 kHz is 10,513 samples for overdrive and 15,793 for distortion. All three parameters are realtime-safe automation targets. The `levelDb` maximum is the finite-gain acceptance limit, not a recommended operating range.
:::

::: details What is `saturation.ampSim`?
A guitar/bass-amp-style coloration stage in the form preamp drive → tone stack → power amp → cabinet. An oversampled twin-triode drive stage sits behind a single `[0, 1]` drive knob, with a drive-scaled pre-emphasis shelf so the gain character shifts as you push it. After the drive comes a bass/mid/treble tone stack, then an optional power-amp section and a data-free cab voicing. The live automation targets are `drive` (0-1), `bassDb`, `midDb`, `trebleDb`, `presenceDb`, `levelDb`, `power`, `sag`, `transformer`, `nfb`, `micAxis`, `micBAxis`, `micBlend`, `cone`, `crossover`, `biasShift`, and `inputDb`; all are automatable through `set_parameter` on every binding. `power` adds a class-AB push-pull soft-saturation stage; `sag` models supply droop and bloom after hard hits; `transformer` adds low-frequency output-transformer saturation; `nfb` adds a negative-feedback loop around the active power stage. `cab` (boolean) and `cabModel` are also live targets. `cabModel` takes `0` = 4x12 guitar stack, `1` = 8x10 bass stack, `2` = 1x12 combo, or `3` = 2x12 open-back. `ampModel` is a construction-time choice: `0` = crunch, `1` = bright clean, `2` = modern high-gain, `3` = low-gain with touch-sensitive breakup, `4` = chime-voiced clean with a top-end lift, `5` = heavy high-gain.

The cabinet and microphone keys are included in `masteringInsertParamInfo('saturation.ampSim')` with nullable ids. Most are construction-only (`id: null`, `rtSafe: false`), including `ampModel`, `micModel`, `micBModel`, `micBInvert`, `powerTube`, `topology`, `preampStages`, `doppler`, and the mic distances. `micAxis`, `micBAxis`, `micBlend`, and `cone` have live automation ids, as do `crossover`, `biasShift`, `inputDb`, `cab`, and `cabModel`. Read each descriptor before deciding whether a cabinet or microphone control can be changed after preparation:

| Key | Meaning |
|-----|---------|
| `preset` | Named amp rig, resolved before any numeric key applies |
| `cabIrF32Base64` | A captured cabinet impulse response, base64-encoded 32-bit float samples |
| `cabIrSampleRate` | The rate that capture was made at; `0` means it is already at the processor's rate |
| `cabIrGenerate` | Synthesize a cabinet impulse response from `cabModel` instead of using the analytic cab voicing |
| `cabIrDrivers` | Whether the cabinet's other drivers are summed into a generated impulse response |
| `micModel`, `micAxis`, `micDistanceCm`, `micBlend` | The first microphone: type (`0` none, `1` dynamic, `2` ribbon, `3` condenser), on-axis position, distance, and blend |
| `micBModel`, `micBAxis`, `micBDistanceCm`, `micBInvert` | The second microphone of a pair, with a polarity flip |
| `ampModel`, `powerTube`, `topology`, `preampStages`, `presetIndex` | Further construction-time choices: amp voicing, power-tube type, `topology` (`voiced` or `circuit`), the preamp stage count, and a preset index |
| `cone`, `doppler` | Cone breakup and cone-motion Doppler; `doppler` moves the reported latency |

The second microphone's path-length delay is aligned and counted in the reported latency, so the latency (48 samples at 48 kHz without Doppler) does not move with `micBlend` or with the power setting.
:::

::: warning Drain the tail of an offline `saturation.ampSim` render
The tail this processor reports includes the cabinet impulse response, not just the second microphone's path-length delay. The default rig reports a tail of 8,939 samples at 48 kHz (4,419 with a generated cabinet response, 2,500 with `cab: false`), so an offline bounce that stops pulling output at the last input sample loses that much cabinet decay — the render simply ends early and a little dry, with nothing to indicate it happened. Keep reading output until the reported tail is drained.
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

A pair processor or analysis takes the reference at its own rate through `referenceSampleRate` (Python `reference_sample_rate`), as do `EqMatchOptions` and `StreamingEqualizer.match`: the reference is resampled onto the source's rate, and a delay estimate comes back in source-rate samples. The request shapes are in [A reference at its own sample rate](./js-api-mastering.md#a-reference-at-its-own-sample-rate). `mastering-pair-analyze` and `mastering-pair-processor` on both CLIs read a reference file at any rate.

The stereo pair entry point `masteringPairProcessStereo()` accepts only `match.abCrossfade`. Each source pair and each reference pair must have equal left/right lengths, while the source pair and reference pair may have different durations. `masteringAbMatchLoudnessStereo()` takes a request object, measures one shared gain for the stereo program, and returns matched `left` and `right` results without a ceiling clamp.

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

Each band's correlation covers that band's whole `[lowHz, highHz)` interval rather than a single probe at its logarithmic center, and the difference decides whether the read-out can be trusted. Two components inside one band, one in phase and one anti-phase, cancel when the mix is folded down; a center-frequency probe would see only whichever of them happened to sit nearer the center and call the band correlated. Measuring the interval reports the canceling pair for what it is.

Band count does not drive cost the way it looks like it should: the bands share one set of transforms instead of each taking its own full-length pass, so a thirty-band split over a long buffer is nowhere near ten times the work of a three-band one. Choose the resolution the material needs.
:::

## Mixer and engine inserts

The creative-FX insert catalog — reverb, modulation, delay, and GS insert IDs, their parameter tables, the `masteringInsertNames()` discovery APIs, and `SONARE_HAVE_FX` / `BUILD_ACOUSTIC_SIM` build gating — lives on its own page: [Effects Inserts](./effects-inserts.md). The standalone `effects.gsEfx` processor uses the same `BUILD_FX` gate and GS type/raw-byte options described there.

## How to call them

Use `capabilityCatalog()` / `capability_catalog()` when a host needs one build-aware picker across solo, pair, and creative-insert processors. It lists each processor's parameter descriptors — name, nullable id, type, `unit`, realtime-safety, `min` / `max` / nullable `default`, `scale`, display range, sibling `dependsOn` bounds, `coupledWith` siblings, `choices`, and slot membership — plus the processor `slots` metadata, a `chain` section describing the flat chain keys (see [Describing the chain keys](#describing-the-chain-keys)), built-in preset lists (`presets.playbackRoom` is always present, empty when playback is compiled out), and mastering-preset metadata. `masteringProcessorCatalog()` is the narrower mastering registry classification used for mastering-specific pickers.

### Reading a catalog bound

Every descriptor carries the same eighteen fields (`name`, `id`, `rtSafe`, `type`, `min`, `max`, `minExclusive`, `maxExclusive`, `maxRelativeTo`, `default`, `unit`, `scale`, `uiMin`, `uiMax`, `dependsOn`, `coupledWith`, `choices`, `slot`; see [The parameter descriptor](./effects-inserts.md#the-parameter-descriptor)), so a host can size a control straight from the catalog instead of transcribing the per-processor tables on this page. Construction-only keys appear with `id: null` and `rtSafe: false`; an id-bearing descriptor with `rtSafe: false` is also unavailable for live automation. `default` may be `null` when there is no fallback. `choices` describes a closed named numeric set, including discrete values with gaps, and `slot` links a key to a slot group. The group's `activation`, `parent`, and `minCrossoverCutoffs` in the processor `slots` metadata determine whether that group is present. A `null` bound is not missing data — it states that the catalog knows of no limit on that side.

The values come from different places, and that decides how far a host can trust them:

| Field | Where it comes from | Reading it |
|---|---|---|
| `default` | The processor config struct's own field initializer, recorded as each builder falls back to it | A changed initializer cannot leave a stale number behind. |
| `min`, `max`, `minExclusive`, `maxExclusive` | Measured: candidate values go through the same construction path a caller uses, and the catalog reports the accepted interval, rounded inward | Each bound is measured with the other keys at their defaults. |
| `coupledWith` | Measured: the siblings, beyond `dependsOn`, that move a key's accepted range (the room reverb's `receiverSpacingM` against the room size and placement) | A control for such a key re-reads its bound when one of them changes. |
| `unit`, `scale`, `uiMin`, `uiMax`, `dependsOn` | Declared by the library; a `dependsOn` entry reads `this <relation> factor * sibling` | On a logarithmic axis `uiMin ?? min` is positive and `uiMax ?? max` finite (a `null` display end means the accepted bound is already usable). A bound that only restates a `dependsOn` entry at the sibling's default is left `null` for the dependency to carry. |

Every `repair.*` entry publishes its settings the same way, measured through the stage's own validation; those rows carry no automation `id` and are never `rtSafe`, even on the four realtime repair inserts. `denoiseClassical` and `dereverbClassical` publish `nFft` as `choices` (the powers of two from 4 to 524288) and `hopLength` as any whole number from 1 with a `dependsOn` of at most half of `nFft`. `masteringInsertParamInfo` answers for every catalog id, offline repair stages included.

::: warning A bound is a hard constraint, not a recommended range
`min` and `max` describe what the processor will *accept*. They are not a musically sensible range to sweep a control over: a value inside the interval can still be a bad setting, and a value outside it is rejected rather than clamped.
:::

Because the range is measured rather than declared, three properties follow that a host has to allow for:

- **Each bound is measured with the other parameters at their defaults.** Two controls that constrain each other therefore each report the *other's default* as their limit. `maximizer.adaptiveRelease` publishes `minReleaseMs` with a ceiling of 250 and `maxReleaseMs` with a floor of 20 for exactly that reason — those are the sibling's default values, not a limit on the pair as a whole.
- **A sample-rate-derived bound is marked, not resolved, until you give a rate.** Without a rate, every EQ `band*.frequencyHz` ceiling reads as 24000 with `maxRelativeTo: 'nyquist'`. `masteringInsertParamInfo(name, sampleRate)` resolves it to that rate's Nyquist frequency: `eq.parametric` reports 11025 at 22050 Hz, 22050 at 44100 Hz and 96000 at 192 kHz. An equalizer built at a known rate (one-shot processing, an engine or mixer strip) accepts band frequencies up to the same ceiling and names it in the refusal (`EQ band frequency must be below 48000 Hz (Nyquist at 96000 Hz)`); a build with no rate keeps 24000 Hz.
- **An exclusive bound is reported as the limit it excludes, and flagged.** `dynamics.compressor` publishes a `sidechainHpfHz` `min` of 0 and still rejects 0; `minExclusive` / `maxExclusive` say so.

The per-band EQ surface is the bulk of the flat parameter set: `eq.parametric`, `eq.midSide`, and `multiband.dynamicEq` publish descriptors for every indexed `band*` field, including construction keys. Publishing them does not widen which keys count as *read* — a band supplied incompletely still has its remaining keys reported as ignored.

::: code-group

```typescript [Browser]
const build = capabilityCatalog();
console.log(build.processors.length, build.presets.mastering);

masteringProcessorNames();   // discover solo processor ids at runtime
masteringProcessorCatalog(); // classify processors for picker/filter UIs
masteringInsertParamInfo('eq.parametric', sampleRate); // construction and automation metadata, Nyquist ceilings resolved for this rate
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

# apply one solo processor (--params are k=v,k=v: numbers, or the choices name of an enum key)
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
| [Mastering Assistant](./mastering-assistant.md) `chainConfig.params` | Flat form, ready for `masterAudio`. `params["dynamics.multibandComp"]` can also carry the nested, arbitrary-band v2 object — see [The chain-config JSON schema](#the-chain-config-json-schema) |

`MasteringChainConfig` accepts both spellings. A dot-notation leaf such as `'loudness.targetLufs': -20` can sit beside — or replace — the nested `loudness: { targetLufs: -20 }`, and the core validates the key and rejects an unknown one. Dot notation is the form the C ABI carries parameters in, which is what makes it the convenient shape when you are assembling overrides dynamically rather than writing them out.

The nested spelling is the canonical one, so prefer it in hand-written code: TypeScript checks a nested config field by field, while a dotted key is only checked at run time.

Repair chain keys follow the chain slots, not the one-shot registry names: use `repair.denoise.*` / `repair.dereverb.*` in flat overrides or the nested `repair: { denoise: ..., dereverb: ... }` shape in `masteringChain(...)`.

An enum-valued chain key takes its `choices` name beside the number: `repair.denoise.mode`, `repair.denoise.noiseEstimator`, `repair.decrackle.mode`, `repair.dehum.mode`, `dynamics.compressor.detector`, and the multiband slope, mode and per-band detector keys. The same holds for the params of `masteringProcess`, `masteringProcessStereo` and `masteringInsertTiming`, and for `--params` and `--chain-config` on both CLIs. An unknown name is refused with the key and the valid names, and `repair.decrackle.mode` accepts only 0 (median) or 1 (wavelet shrinkage). Mixer scene `params` take the choice's number (`choices[].value`), not its name.
::::

## The chain-config JSON schema

The flat `chainConfig.params` map (the shape `chainConfig.params` uses in the table above, and the shape `masterAudio` overrides accept) has a JSON-document serialization used by the CLI and the [Mastering Assistant](./mastering-assistant.md): `sonare mastering --config <file>` reads it, and `masteringAssistantSuggest`'s `chainConfig` is expressed in it. That serialization auto-selects one of two schema versions.

::: details Version 1 vs. version 2
- **Version 1** — the flat, fixed **3-band** low/mid/high multiband compressor shape: `dynamics.multibandComp.lowCutoffHz`, `.highCutoffHz`, and per-band `lowThresholdDb`/`midThresholdDb`/`highThresholdDb` and their ratio/attack/release siblings. This is what every flat-override entry point sends, and what the Mastering Assistant emits for the shipped presets, whose multiband stage is the default 3-band shape.
- **Version 2** — selected automatically once the multiband compressor configuration can no longer be represented as the fixed 3-band shape (a different cutoff count, non-default crossover slope/mode, or a non-default FIR kernel size). In that case `params["dynamics.multibandComp"]` becomes a structured object instead of the flat `low`/`mid`/`high` keys:
  - `crossover.cutoffsHz[]`, `crossover.slope`, `crossover.mode`, `crossover.firKernelSize`
  - `bands[]` — up to **64 bands**, each with `thresholdDb`, `ratio`, `attackMs`, `releaseMs`, `kneeDb`, `makeupGainDb`, `autoMakeup`, `detector`, `sidechainHpfEnabled`, `sidechainHpfHz`, `pdrTimeMs`, `pdrReleaseScale`

  Field validation is strict: unknown keys anywhere in the version-2 `dynamics.multibandComp` object are rejected, and the band count must equal the cutoff count plus one.
:::

The structured form is reachable from every chain call, not only the JSON document. On the Node and WASM `MasteringChainConfig` and in Python config dicts, `dynamics.multibandComp` accepts `crossover` (`cutoffsHz`, `slope`, `mode`, `firKernelSize`) and `bands` (`MultibandCompressorBand`), and flat keys `dynamics.multibandComp.crossover.cutoffsHz.<i>` and `dynamics.multibandComp.bands.<i>.<field>` beside the in-place `cutoff<i>Hz` / `band<i>.<field>` and the low/mid/high shorthand. `cutoffsHz` replaces the cutoff list and sets the band count to its length plus one, and key order does not matter. Two spellings of one field in one call are refused, so do not combine `cutoffsHz` with `lowCutoffHz` / `highCutoffHz`.

```typescript
masteringChain(samples, sampleRate, {
  dynamics: {
    multibandComp: {
      crossover: { cutoffsHz: [200, 2000, 8000], slope: 'lr4', mode: 'linkwitzRiley' },
      bands: [{ thresholdDb: -24 }, { ratio: 3 }, {}, { detector: 'peak' }],
    },
  },
})
```

The band count is checked as 2 to 64 on every surface and both CLIs: a stage with one band is refused (`multiband stage needs at least two bands; one band is the compressor stage`), and a structurally invalid multiband stage is refused even when the stage is disabled. Preset and assistant chain params return a version 2 multiband stage as flat keys.

### Describing the chain keys

`capabilityCatalog().chain` (`CapabilityCatalogChain`) describes the flat chain keys the way `processors` describes processor parameters:

| Field | Content |
|-------|---------|
| `stages` | Each stage's key `prefix`, the catalog `processor` whose parameters its `<prefix>.<leaf>` keys are (`null` when every key is chain-only), and its `enabledKey` |
| `lists` | The indexed lists `dynamics.multibandComp.crossover.cutoffsHz` (1 to 63 items) and `dynamics.multibandComp.bands` (2 to 64 items, each item the `dynamics.compressor` fields), with `minItems` / `maxItems` |
| `params` | Descriptors for keys no processor carries: the `enabled` switches, `loudness.*`, `repair.denoise.gainFloor`, the crossover FIR kernel size and cutoff list, with bounds measured through the chain's own validator |
| `aliases` | Every other spelling of a canonical key; `<i>` stands for a list index |

Chain enum names resolve on every stage's keys.

Building a stage panel from `catalog.chain` is walked through in [Build Controls from Parameter Descriptors](./use-cases/parameter-controls.md).

## Related

- [Mastering Assistant](./mastering-assistant.md) — profile/suggest/preview JSON and the suggestion→render path
- [Mastering Implementation](./mastering-implementation.md) — the chain that renders in the browser demo
- [DSP Implementation Notes](./dsp-implementation.md) — how each family behaves
- [Mixing Engine](./mixing.md) — load these processors as channel-strip/bus inserts
