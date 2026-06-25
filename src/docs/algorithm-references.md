# Algorithm References

This page records algorithm, paper, standard, and compatibility references that are visible in current libsonare source, tests, or README. It is not a general DSP bibliography; every entry is tied to local evidence in the project.

## What You Will Learn

By the end of this page you should be able to:

- distinguish source-backed references, reference-tested compatibility claims, and algorithm-family names;
- find the standard or paper basis for loudness, true peak, denoise, EQ, pitch, room acoustics, sequence helpers, and reverb families;
- avoid treating this page as a promise that every high-level estimate is identical to another library;
- know when to pair this page with [Implementation Validation](./implementation-validation.md) for test coverage.

## Evidence Levels

| Level | Meaning |
|-------|---------|
| Source-backed | Current source, header comments, tests, or README explicitly name the standard, algorithm, author, or paper |
| Reference-tested | The implementation is checked against generated reference values, mainly librosa 0.11.0 |
| Algorithm-named | Current source names an algorithm family, but does not embed a full paper citation |

## Source-Backed References

::: info Room-acoustic terms used below
**RIR** means room impulse response. **Equivalent-room estimation** fits a useful room model from audio rather than recovering exact geometry. **Room morphing** is a creative room effect, not dereverberation.
:::

| Area | Reference basis | Evidence |
|------|-----------------|----------|
| Loudness and true peak | ITU-R BS.1770-4/5, EBU R128, EBU Tech 3342 loudness range | `README.md`, `src/rt/biquad_design.h`, `src/rt/true_peak_filter.h`, `src/metering/lufs.cpp`, `tests/rt/true_peak_filter_test.cpp` |
| K-weighting | BS.1770 K-weighting biquads: reference coefficients at 48 kHz and analytic design for other rates | `src/rt/biquad_design.h`, `src/rt/biquad_design.cpp` |
| True-peak interpolation | Self-designed 2x/4x/8x/16x polyphase FIRs matching the BS.1770 target frequency response. Use 4x or higher for standards-compliant measurement; the 2x path is a deliberately non-compliant fast approximation, below BS.1770's 4x minimum. | `src/rt/true_peak_filter.h`, `src/rt/true_peak_filter.cpp` |
| Classical denoise | Ephraim-Malah MMSE-STSA (1984), Ephraim-Malah LogMMSE (1985), Berouti spectral subtraction with over-subtraction (1979), MCRA, IMCRA | `src/mastering/repair/denoise_classical.h` |
| Tape hysteresis | Jiles-Atherton hysteresis; Chowdhury, "Real-time Physical Modelling for Analog Tape Machines", DAFx-19 2019, equations 6-10 | `src/mastering/common/hysteresis_ja.cpp`, `src/mastering/saturation/tape.h` |
| EQ filters | RBJ biquads, Vicanek matched-Z IIR, Butterworth Q, Linkwitz-Riley crossovers with all-pass phase compensation | `README.md`, `src/rt/biquad_design.h`, `src/rt/biquad_design.cpp`, EQ routing and cut-filter sources |
| Anti-aliased nonlinearities | ADAA / antiderivative anti-aliasing | `README.md`, `src/rt/adaa.h`, `src/rt/aliasing_control.h` |
| Sliding maximum | Lemire sliding max | `README.md`, limiter and true-peak helper usage |
| Tonnetz | Harte et al. 2006 via `librosa.feature.tonnetz` behavior | `src/feature/tonnetz.h`, `src/feature/tonnetz.cpp`, `tests/librosa/tonnetz_test.cpp` |
| Pitch tracking | YIN and pYIN; pYIN uses probabilistic pitch candidates and Viterbi decoding | `src/feature/pitch.h`, `tests/librosa/pitch_test.cpp` |
| Room acoustics | Energy-decay metrics, blind decay fitting, RIR synthesis, room estimation, and room morphing | `src/analysis/acoustic_analyzer.*`, `src/acoustic/*`, `src/analysis/room_estimator.*`, `src/effects/acoustic/room_morph.*`, `tests/acoustic/*`, `tests/effects/room_morph_test.cpp` |
| Sequence helpers | DTW, Viterbi, discriminative Viterbi, recurrence quantification analysis, mirroring `librosa.sequence` | `src/util/sequence.h`, `src/feature/segment.*`, librosa sequence references |
| Time stretch and pitch shift | Native spectral stretch, phase-vocoder fallback, pitch shift by time stretch followed by resampling | `src/effects/time_stretch.h`, `src/effects/pitch_shift.h` |
| Reverb families | Convolution, Dattorro plate, FDN, velvet-noise, and geometric room reverb engines | `README.md`, `src/effects/reverb/*`, `src/effects/acoustic/*`, `tests/effects/*` |

::: info What is Tonnetz?
Tonnetz ("tone network") is a feature that maps harmony onto a geometric space where musically related chords sit close together. It is derived from chroma and is useful for measuring harmonic change and chord relationships.
:::

::: details Plain-language gloss of the named algorithms
This page cites algorithms by name; here is what the less-obvious ones do.

- **Viterbi decoding** — picks the most likely *sequence* of states (e.g. pitch candidates over time) rather than the best guess at each isolated frame, so pYIN produces a smooth note line.
- **DTW (dynamic time warping)** — aligns two sequences that may run at different speeds by stretching/compressing time, used to compare performances or feature sequences.
- **MMSE-STSA / LogMMSE** — statistical denoisers that estimate, per frequency bin, how much is signal vs. noise before subtracting (see [Mastering Processors](./mastering-processors.md) for the plain version). **Over-subtraction** removes a bit extra to kill residue, at the cost of some signal.
- **Spectral subtraction / MCRA / IMCRA** — spectral subtraction estimates the noise spectrum and subtracts it from each frame; MCRA and IMCRA track that noise floor over time even while speech or music is present, so the subtraction adapts instead of using a fixed guess.
- **Jiles-Atherton hysteresis** — a physics model of how magnetic tape "remembers" its recent signal, giving tape saturation its nonlinear, history-dependent character.
- **ADAA (antiderivative anti-aliasing)** — a trick that runs a distortion curve through its mathematical integral to suppress the aliasing that nonlinear processing would otherwise create.
- **Schroeder energy-decay curve** — integrates a room impulse response backward in time to get a smooth decay curve, which is what RT60/EDT are measured from.
- **RBJ biquads / Linkwitz-Riley crossovers** — standard recipes for EQ filters and for splitting audio into frequency bands with correct phase behavior.
:::

## librosa Reference Compatibility

The reference fixtures under `tests/librosa/reference/` are generated with librosa 0.11.0.

`tests/librosa/reference/NOTICE.md` states that the values are generated by `tests/librosa/generate_librosa_reference.py` to verify numerical compatibility between libsonare and librosa.

This is a compatibility target, not copied implementation code.

| Feature family | Reference coverage |
|----------------|--------------------|
| Spectral features | STFT, reassigned spectrogram, mel filterbank, mel spectrogram, MFCC, chroma, CQT/iCQT, VQT/wavelet filters, spectral centroid/bandwidth/rolloff/flatness/contrast, zero crossing, RMS |
| Rhythm and onset | onset strength, beat, tempo, tempogram, Fourier tempogram, PLP |
| Pitch and tonal features | YIN, pYIN, piptrack-like helpers, pitch utilities, tonnetz |
| Decomposition and transforms | HPSS, harmonic/percussive, decompose, remix, inverse mel/MFCC helpers, Griffin-Lim-related synthesis tests |
| Sequence and structure | segment helpers, cross-similarity, recurrence matrix, DTW/Viterbi-style sequence helpers |
| Utilities | frame/sample/time conversion, dB conversion, pre/de-emphasis, padding, fix length/frames, peak pick, vector normalize, trim/split silence, weighting |
| NNLS | NNLS tests compare against SciPy/librosa reference data and support NNLS chroma behavior |

## Scope Boundaries

The source explicitly frames repair as classical DSP.

That means these paths are not DNN restoration, source separation, or interactive spectral repair:

| Repair path | How to read it |
|-------------|----------------|
| `repair.denoiseClassical`, `repair.declick`, `repair.declip`, `repair.decrackle`, `repair.dehum`, `repair.dereverbClassical`, `repair.trimSilence` | Classical or deterministic DSP in the current implementation. |

Room acoustics has five different entry points:

| Entry point | Input | What it does | How to treat the result |
|-------------|-------|--------------|--------------------------|
| `analyze_impulse_response` / `analyzeImpulseResponse` | A clap, pop, sweep-derived IR, or other recording where the room response is isolated | Measures the decay curve directly after the impulse | Easier to treat as a measurement |
| `detect_acoustic` / `detectAcoustic` | Normal music, speech, or environmental audio | Searches for regions where room decay appears to fall naturally, then estimates from them | Treat as a hint and always inspect `confidence` |
| `estimate_room` / `estimateRoom` | A recording or impulse response | Estimates an equivalent room with volume, dimensions, DRR, absorption bands, RT60 bands, and confidence | Treat as a model fit, not exact geometry |
| `synthesize_rir` / `synthesizeRir` | Shoebox dimensions plus source/listener placement | Synthesizes a mono RIR | Check `hasError` / `has_error` for invalid geometry |
| `room_morph` / `roomMorph` | Source recording plus target room geometry | Adds a target-room character after gentle source-tail suppression | Creative effect, not dereverberation |

A **decay curve** shows how quickly energy falls after the sound stops. In impulse-response analysis, that curve is measured directly and RT60/EDT are read from it.

Blind estimation is different because the input is ordinary audio. The algorithm has to decide whether an apparent decay is really room reverberation. Instrument tails, sustained speech, compression, and background noise can all look like decay.

`synthesize_rir` / `synthesizeRir` uses image-source early reflections and a deterministic late tail. That implementation detail matters when you compare generated RIRs, but users can usually think of it as "make a repeatable room response from dimensions."

For that reason, `detect_acoustic` / `detectAcoustic` and `estimate_room` / `estimateRoom` intentionally return `confidence`. If the input does not expose a clear free-decay region, the result may be unavailable or low confidence.

Read low `confidence` as "this recording does not reveal the room clearly enough," not as a firm room measurement.
