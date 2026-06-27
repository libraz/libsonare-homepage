# DSP Implementation Notes

This page explains what each DSP family does internally.

It complements three reference pages:

| Page | Role |
|------|------|
| [Mastering Processors](./mastering-processors.md) | Public processor registry |
| [Algorithm References](./algorithm-references.md) | Standards, algorithm names, and compatibility references |
| [Implementation Validation](./implementation-validation.md) | Feature groups mapped to tests |

Use this page when you need implementation context before exposing a processor in a UI, choosing real-time settings, or explaining a render report.

The source of truth is the C++ implementation in the libsonare repository.

| Area | Source |
|------|--------|
| DSP implementation | `src/analysis`, `src/feature`, `src/mastering`, `src/effects`, `src/mixing`, `src/engine` |
| Public mastering processor names | `src/mastering/api/named_processor_registry.cpp` |
| Analysis and feature helpers | Quick APIs and binding wrappers |

## What You Will Learn

By the end of this page you should be able to:

- identify the shared DSP building blocks behind analysis, effects, mastering, mixing, and realtime processing;
- explain the difference between public processor names and the lower-level implementation pieces that realize them;
- spot realtime-sensitive implementation details such as lookahead, allocation, FIR rebuilds, smoothing, and latency;
- know which source directories to inspect when behavior needs to be verified.

## Reading Path

| Need | Page |
|------|------|
| Public processor IDs and preset names | [Mastering Processors](./mastering-processors.md) |
| DSP behavior, shared building blocks, and real-time boundaries | This page |
| Standards, papers, and compatibility references | [Algorithm References](./algorithm-references.md) |
| Test coverage and validation status | [Implementation Validation](./implementation-validation.md) |

## Grounding

This page is source-grounded rather than generated from marketing names. It uses these kinds of evidence:

| Evidence | Examples |
|----------|----------|
| Registry | `src/mastering/api/named_processor_registry.cpp` for public processor names |
| Header comments | `compressor.h` describes a feed-forward compressor with soft knee and makeup gain; `linear_phase.h` describes an FFT-domain linear-phase FIR equalizer |
| Config fields | `TruePeakLimiterConfig` exposes `lookahead_ms`, `release_ms`, `oversample_factor`, and `apply_gain_at_input_rate`; `DenoiseClassicalConfig` exposes three gain functions (LogMMSE, MMSE-STSA, spectral subtraction) and three noise estimators (Quantile, MCRA, IMCRA) |
| Runtime contracts | Several processors mark which parameters are real-time safe, and which changes resize buffers or rebuild FIR kernels |
| Implementation includes | Repair code includes LPC helpers for declick/declip; denoise uses `NoiseTracker`; convolution reverb and linear-phase EQ use partitioned convolution |

Where this page says "main use", it describes the public intent implied by the processor name, config, and header comment. It does not claim hidden model behavior beyond the source.

## Shared Building Blocks

| Building block | Implementation role | Used by |
|----------------|---------------------|---------|
| Biquad and filter design | Low-latency IIR EQ, shelves, cuts, presence/air shaping, detector filtering | EQ, dynamics sidechains, spectral enhancers, stereo filters |
| Envelope follower | Attack/release smoothing for level detectors and gain changes | Compressors, expanders, gates, de-esser, vocal rider, limiters |
| Parameter smoother | Click-free parameter transitions in block processing | Mastering processors, mixer strip controls, automation |
| Lookahead and sliding maximum | Future-aware peak control without overshoot | Brickwall limiter, true-peak limiter, maximizers |
| Oversampling and true-peak filter | Inter-sample peak estimation and anti-aliasing headroom | Limiters, clippers, saturation, final output |
| Delay lines | Time alignment, Haas widening, modulation delay, ducking alignment | Stereo, delay, modulation, mixing alignment |
| Mid/side transform | Independent mono center and stereo side processing | Mid/side EQ, imager, mono maker, stereo balance |
| Partitioned convolution | Efficient block convolution for long kernels or impulse responses | Convolution reverb, linear-phase EQ, match EQ |
| Noise tracker and LPC helpers | Classical noise profile tracking and LPC residual/reconstruction helpers | Denoise uses `NoiseTracker`; declick/declip use LPC helpers |

::: details Plain-language gloss of the building blocks
- **Lookahead** — the processor delays the audio slightly so it can "see" a peak a few milliseconds before it plays, and turn the gain down smoothly instead of clamping it. The cost is a little latency.
- **Oversampling & true-peak filter** — temporarily runs the audio at a higher sample rate to catch *inter-sample peaks* (peaks that fall between two samples and that a DAC will actually reconstruct), and to keep distortion from folding back into the audible range (aliasing).
- **Mid/side (M/S)** — re-expresses a stereo signal as a *mid* (mono center) channel and a *side* (left-minus-right difference) channel, so you can process the center and the width independently, then convert back.
- **Partitioned convolution** — convolution applies one signal's "fingerprint" to another (e.g. a room impulse response, or a linear-phase EQ). Partitioning splits a long filter into blocks so it can run efficiently in real time.
- **Haas widening** — a very short delay (under ~40 ms) on one channel that the ear hears as extra stereo width rather than an echo.
- **LPC (linear predictive coding)** — models a sample as a prediction from the samples before it; repair uses it to reconstruct what a clicked or clipped peak *should* have been.
:::

## Analysis And Feature DSP

The analysis side — music information retrieval (MIR): extracting tempo, key, chords, and similar musical facts from audio — is built from reusable feature stages rather than one monolithic analyzer. STFT and frame utilities feed mel/MFCC, chroma, onset envelopes, tempograms, pitch trackers, and section features. Higher-level analyzers then reuse those representations where possible.

| Family | Implementation role | Main use |
|--------|---------------------|----------|
| STFT and framing | Windowed FFT over overlapping frames, with shared frame/hop conventions | Foundation for spectral, chroma, onset, mel, and MFCC features |
| Mel / MFCC | Mel filterbank plus DCT-style cepstral compression | ML features, timbre summaries, librosa-compatible workflows |
| Chroma / CQT / VQT / NNLS chroma | Pitch-class and log-frequency representations | Key, chord, harmonic similarity, and pitch-aware features |
| Onset / tempogram / PLP | Onset envelope and local periodicity representations | BPM, beat, rhythm, and pulse analysis |
| Pitch tracking | YIN and pYIN style F0 estimation | Melody extraction and monophonic pitch analysis |
| Inverse features | Pseudo-inverse mel/MFCC paths and Griffin-Lim audio synthesis | Debug previews and feature round-trip checks |
| Room acoustics | Energy decay curve metrics for IRs, blind free-decay fitting, equivalent-room estimation, image-source RIR synthesis, and creative room morphing | RT60, EDT, C50, C80, D50, band decay, volume, dimensions, absorption, DRR, generated RIRs, and confidence |

Feature inversion, blind acoustic estimation, and equivalent-room estimation are useful, but they are estimates. Inverse helpers cannot restore discarded phase or mel/MFCC detail; blind acoustic and room-estimation modes report confidence because ordinary recordings may not contain a clean free-decay region.

## Mastering Chain

`masteringChain(...)` builds a fixed processor chain from a structured configuration: the same configuration and input always produce the same stage order and the same output, with no run-to-run variation. That is what "deterministic" means here.

The streaming variant, `StreamingMasteringChain`, runs the same stages in the same order, but it keeps each processor's state between audio blocks so it can run live.

Offline-only processors can still appear in high-level workflows. Real-time render paths are limited by each processor's contract; changes that resize buffers or rebuild FIR kernels are not audio-thread safe.

Presets are not separate DSP algorithms. They are named configurations that combine repair, EQ, dynamics, stereo processing, true-peak limiting, and loudness optimization with genre/platform defaults.

## Dynamics

| Processor | Implementation | Main use | Real-time notes |
|-----------|----------------|----------|-----------------|
| `dynamics.brickwallLimiter` | Lookahead peak detector with fast gain reduction and ceiling enforcement | Prevent sample peaks from exceeding a ceiling | Adds lookahead latency; safe when prepared before streaming |
| `dynamics.compressor` | Feed-forward level detector, attack/release envelope, ratio/knee gain computer, makeup gain | Control macro dynamics and glue a master | Smooth parameter changes to avoid gain zipper noise |
| `dynamics.deesser` | Split-band de-esser with band-pass filters, threshold, ratio, attack/release, range, and bandpass Q | Attenuate sibilant high-frequency energy | Listed parameters are automatable without allocation or state reset |
| `dynamics.expander` | Downward expansion below a threshold using envelope detection | Increase contrast and reduce low-level spill | Release time dominates audibility |
| `dynamics.gate` | Threshold gate with hysteresis-style open/close behavior | Suppress background noise between events | Hold/release settings avoid chatter |
| `dynamics.limiter` | Peak-oriented compressor with high ratio and short timing | Catch short transients before final output | Lower latency than lookahead brickwall limiting, less absolute |
| `dynamics.parallelComp` | Compressed path blended with dry path | Add density while preserving transients | Blend and latency compensation must stay aligned |
| `dynamics.sidechainRouter` | Routes an external or derived control signal into a dynamics detector | Sidechain-dependent compression or ducking | Primarily an internal routing helper exposed for advanced graphs |
| `dynamics.duckingProcessor` | Sidechain envelope lowers the program path when the key signal is active | Voice-over music ducking and broadcast-style mixes | Attack/release shape determines speech intelligibility |
| `dynamics.transientShaper` | Separates attack and sustain envelopes and applies independent gain | Emphasize or soften hits | Fast detector path is sensitive to block size |
| `dynamics.upwardCompressor` | Raises material below a threshold instead of pushing loud material down | Increase detail and perceived density | Can raise noise floor; pair with denoise or gating when needed |
| `dynamics.upwardExpander` | Lifts material above a lower threshold while leaving the quietest portions untouched | Restore articulation without hard gating | More musical than a gate for ambience-heavy sources |
| `dynamics.vocalRider` | Slow envelope follower adjusts vocal level toward a target range | Automatic level riding for vocals or speech | Designed as gradual gain automation, not a peak limiter |

::: details Dynamics terms: knee, makeup gain, sidechain, ducking
- **Knee** — how abruptly a compressor engages around its threshold. A *hard knee* clamps suddenly at the threshold; a *soft knee* eases in over a range, sounding gentler.
- **Makeup gain** — after a compressor lowers the loud parts, the whole signal is quieter, so makeup gain raises it back up to a comparable level — now more even than before.
- **Sidechain** — feeding a *different* signal into a processor's level detector so it reacts to that signal instead of itself.
- **Ducking** — the classic sidechain use: a music bed automatically dips whenever a voice (the key signal) is present, then comes back up when the voice stops.
- **Brickwall limiter** — a limiter with such a high ratio and fast response that nothing is allowed past the ceiling at all, as if hitting a wall.
:::

## EQ

| Processor | Implementation | Main use | Real-time notes |
|-----------|----------------|----------|-----------------|
| `eq.apiStyle` | API-facing EQ wrapper for common band definitions | Stable public entry point for UI-friendly EQ | Delegates to the underlying EQ design |
| `eq.bandPass` | Biquad band-pass filter | Isolate a frequency region | Low latency |
| `eq.cutFilter` | High-pass/low-pass cut filters with slope control | Remove rumble, hiss, or band-limit a signal | Low latency IIR path |
| `eq.dynamic` | EQ band controlled by an envelope detector | Frequency-selective compression/expansion | Detector timing must be smoothed |
| `eq.equalizer` | Multi-band EQ engine with validation, routing, and spectrum helpers | General corrective and tonal EQ | IIR path is live-friendly |
| `eq.graphic` | Fixed-band graphic EQ | Broad tonal shaping with predictable bands | Low latency |
| `eq.linearPhase` | FIR/linear-phase style EQ path | Phase-preserving mastering moves | Adds latency and is better suited to offline or latency-aware streaming |
| `eq.midSide` | Converts L/R to M/S, applies EQ independently, converts back | Shape center and width bands separately | Needs stereo input and careful mono compatibility checks |
| `eq.minimumPhase` | Minimum-phase EQ topology | Mastering EQ where low latency matters | Preferred for live paths |
| `eq.parametric` | Parametric peak/shelf/cut bands | Precise corrective EQ | Low latency |
| `eq.pultec` | Passive-style program equalizer with low boost, low attenuation, high boost, high attenuation, component model, and output drive controls | Low/high program EQ shaping | Most controls are marked automatable; component model is not automatable |
| `eq.shelving` | Low/high shelf filters | Tilt lows or highs around a corner frequency | Low latency |
| `eq.tilt` | Complementary low/high shelving around a pivot | Quick bright/dark tonal balance | Useful in presets and assistant suggestions |

## Final Stage and Maximizers

| Processor | Implementation | Main use | Real-time notes |
|-----------|----------------|----------|-----------------|
| `final.bitDepth` | Quantizes samples to a target bit depth | Preview or export bit-depth reduction | Usually last or near-last |
| `final.dither` | Adds shaped or unshaped low-level noise before quantization | Reduce quantization distortion | Export-stage processor |
| `final.outputChain` | Groups output gain, ceiling, bit depth, dither, and final checks | Last-stage export preparation | Keep after tonal/dynamics stages |
| `maximizer.adaptiveRelease` | Limiter release time adapts to signal behavior | Cleaner loudness increase with fewer pumping artifacts | Adds detector state |
| `maximizer.loudnessOptimize` | Measures loudness and applies gain strategy toward a target | Hit LUFS targets for streaming/broadcast | Full-file optimization is offline by nature |
| `maximizer.maximizer` | Loudness-oriented limiting with ceiling management | Raise perceived loudness | Use true-peak stage after aggressive settings |
| `maximizer.softKneeMax` | Soft-knee limiting curve before hard ceiling | Less abrupt limiting | Useful before final true-peak protection |
| `maximizer.truePeakLimiter` | Oversampled true-peak estimation and ceiling control | Avoid inter-sample overs | Adds oversampling cost and lookahead-style latency |

<SonareDemo id="loudness-meter" />

## Multiband

| Processor | Implementation | Main use | Real-time notes |
|-----------|----------------|----------|-----------------|
| `multiband.compressor` | Crossover splits bands, each band runs compression, bands sum back | Frequency-dependent dynamics control | Crossover design and latency compensation matter |
| `multiband.dynamicEq` | Dynamic EQ behavior applied across band regions | Control resonant or harsh ranges only when active | Detector smoothing is essential |
| `multiband.expander` | Per-band expansion below thresholds | Clean low-level noise or restore contrast by band | Can change tonal balance if overused |
| `multiband.imager` | Per-band stereo width/mid-side processing | Keep lows mono while widening upper bands | Always check mono compatibility |
| `multiband.limiter` | Per-band limiting before recombination | Catch band-specific peaks | Avoid excessive crossover artifacts |
| `multiband.saturation` | Per-band nonlinear drive and blend | Add harmonic color by range | Oversampling or conservative drive reduces aliasing |

## Repair

| Processor | Implementation | Main use | Real-time notes |
|-----------|----------------|----------|-----------------|
| `repair.declick` | Detects isolated impulse-like discontinuities and interpolates or attenuates them | Remove clicks and small digital defects | Detection window introduces local lookaround |
| `repair.declip` | Estimates clipped regions and reconstructs peaks | Repair hard-clipped audio | Offline-friendly because reconstruction uses context |
| `repair.decrackle` | Tracks dense small impulses and smooths them | Reduce vinyl-like crackle | More expensive than single-click removal |
| `repair.dehum` | Notch-style suppression of hum fundamentals and harmonics | Remove mains hum | Low latency when configured frequencies are known |
| `repair.denoiseClassical` | Noise tracking and spectral attenuation | Reduce stationary background noise | Profile estimation is context-dependent |
| `repair.dereverbClassical` | STFT-domain dereverb configuration with `t60_sec`, `late_delay_ms`, over-subtraction, spectral floor, and optional WPE settings | Reduce room tail and smear | File-level API returns a new `Audio` object |
| `repair.trimSilence` | Threshold-based leading/trailing silence removal | Clean exports and batch assets | File-level utility, not a live insert |

## Saturation

| Processor | Implementation | Main use | Real-time notes |
|-----------|----------------|----------|-----------------|
| `saturation.bitcrusher` | Bit-depth and/or sample-rate style degradation | Lo-fi texture | Keep output gain controlled |
| `saturation.exciter` | High-frequency harmonic generation and blend | Add brightness and perceived detail | Can become harsh quickly |
| `saturation.hardClipper` | Hard nonlinear transfer curve | Aggressive peak shaving and distortion | Use oversampling or conservative drive |
| `saturation.multibandExciter` | Band-split exciter with per-band drive/blend | Add sparkle without overloading lows | Crossover and drive balance matter |
| `saturation.softClipper` | Smooth nonlinear curve | Gentle peak rounding | Common before maximizers |
| `saturation.tape` | Nonlinear saturation with tone/soft compression behavior | Tape-like density | Drive changes loudness and tone together |
| `saturation.transformer` | Low-order harmonic coloration and subtle saturation | Analog-style thickness | Usually subtle mastering color |
| `saturation.tube` | Asymmetric nonlinear transfer emphasizing musical harmonics | Warmth and vocal/instrument color | Watch DC and low-frequency buildup |
| `saturation.waveshaper` | Configurable nonlinear transfer curve | General distortion and coloration | Parameter smoothing prevents clicks |

## Spectral and Stereo

| Processor | Implementation | Main use | Real-time notes |
|-----------|----------------|----------|-----------------|
| `spectral.airBand` | High-frequency shelf/exciter style enhancement | Add air above the main presence range | Pair with de-esser if sibilance increases |
| `spectral.lowEndFocus` | Low-band shaping and focus control | Tighten bass and reduce muddiness | Mono compatibility is important |
| `spectral.presenceEnhancer` | Presence-band shaping with controlled harmonic/detail emphasis | Improve vocal or lead audibility | Avoid masking-sensitive overuse |
| `spectral.spectralShaper` | Broad spectral tilt/shape correction | Match tonal contour or smooth harsh ranges | More transparent with moderate settings |
| `stereo.autoPan` | LFO-driven pan movement | Creative movement | More creative than mastering-neutral |
| `stereo.haasEnhancer` | Short inter-channel delay for width | Perceived width increase | Can reduce mono compatibility |
| `stereo.imager` | Mid/side width gain and optional band awareness | Widen or narrow stereo image | Check correlation and mono sum |
| `stereo.monoMaker` | Low-frequency mono summing below a crossover | Stabilize bass in the center | Common before final limiting |
| `stereo.phaseAlign` | Delay/polarity style alignment correction | Improve stereo phase relationship | Requires careful listening or measurement |
| `stereo.stereoBalance` | L/R or M/S balance adjustment | Correct image lean | Low latency |

## Reference Matching and Analysis

| Name | Implementation | Main use |
|------|----------------|----------|
| `match.applyMatchEq` | Applies an EQ curve derived from source/reference spectral difference | Move source tonal balance toward a reference |
| `match.alignReferenceToSource` | Estimates and compensates reference delay relative to source | Make A/B comparisons and match curves more reliable |
| `match.abSwitch` | Switches between source and reference paths | Audition comparison |
| `match.abCrossfade` | Crossfades between source and reference paths | Smooth comparison without clicks |
| `match.referenceLoudness` | Measures reference loudness metrics | Level-match comparisons |
| `match.tonalBalance` | Compares band energy distribution | Broad tonal comparison |
| `match.tonalBalanceLogBands` | Tonal balance on logarithmic bands | Perceptually useful reference comparison |
| `match.matchEqCurve` | Estimates a corrective EQ curve | Build match EQ settings |
| `match.estimateReferenceDelaySamples` | Estimates reference delay in samples | Align files before comparison |
| `stereo.monoCompatCheck` | Computes mono compatibility metrics | Catch phase and cancellation problems |
| `stereo.monoCompatCheckLogBands` | Mono compatibility by logarithmic bands | Find frequency ranges with stereo problems |

## Effects and Editing DSP

| DSP | Implementation | Main use | Real-time notes |
|-----|----------------|----------|-----------------|
| HPSS / harmonic / percussive | Median filtering on spectral representation separates horizontal harmonic energy and vertical percussive energy | Remixing, preprocessing, analysis cleanup | Offline-oriented for full files |
| Time stretch | Phase-vocoder style processing | Change duration without changing pitch | Streaming requires overlap/state discipline |
| Pitch shift | Resampling combined with time stretching | Transpose pitch while preserving approximate duration | Formants are not preserved unless using the voice-change path |
| Pitch correction | Pitch estimation and correction toward a target MIDI note | Vocal or monophonic note tuning | Best on monophonic material |
| Note stretch | Region-based stretch around a note span | Edit note duration | Offline editing operation |
| Voice change | Pitch and formant controls | Voice transformation | More expensive than simple pitch shift |
| Normalize | Peak or target-level gain adjustment | Utility level matching | File-level operation unless gain is known ahead |
| Trim/split silence | Threshold segmentation | Batch cleanup and asset prep | File-level utility |
| Reverb inserts | Plate/Dattorro, FDN, velvet, convolution, geometric room, and room-morph inserts | Space, ambience, and room-character morphing in mixer/mastering insert graphs | Build flags and IR requirements vary |
| Modulation/delay modules | Chorus, flanger, phaser, and stereo delay DSP live in source modules | Building blocks for creative FX | Not exposed as standalone top-level JS/Python helpers in the current public bindings |

::: info Reverb insert availability
`effects.reverb.plate` / `effects.reverb.dattorro`, `effects.reverb.fdn`, `effects.reverb.velvet`, and `effects.reverb.convolution` require `SONARE_HAVE_FX`. `effects.reverb.room` and `effects.acoustic.roomMorph` also require `BUILD_ACOUSTIC_SIM`.

Algorithmic and geometric room reverb are streamable. Convolution needs an IR supplied through native insert creation paths.
:::

## Mixing DSP

The mixer is DSP as well as routing.

Channel strips apply input trim, polarity, delay alignment, pan law, stereo width, insert processing, fader, mute/solo logic, sends, and metering.

Buses sum routed signals, VCA groups apply control gain, and meters compute peak/RMS/LUFS-like values, true peak, gain reduction, correlation, and goniometer buffers.

Automation lanes are sample-positioned and support `linear`, `exponential`, `hold`, and `s-curve` interpolation. Topology changes compile a routing graph; the audio processing path uses the compiled graph and preallocated state.

## Real-Time Engine DSP Boundary

`RealtimeEngine` owns transport, tempo synchronization, graph runtime, clip playback, metronome, capture, monitor runtime, offline bounce, and telemetry. It is not a replacement for the mastering processor registry; it is the scheduler and graph runtime that can host real-time-safe DSP blocks. File-wide analysis, full repair, and loudness optimization remain offline or latency-tolerant operations.
