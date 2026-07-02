---
title: Glossary
description: A curated index for libsonare audio analysis, MIR, and browser mastering terms.
---

# Glossary

This glossary is an editorial index, not a generated term dump. Start with the grouped guides below, then follow the related links inside each page when you need implementation detail.

::: tip New to audio analysis?
Read [Audio Basics](./glossary/concepts/audio-basics.md) first, then [MIR Overview](./glossary/concepts/mir-overview.md). If you are here for the mastering demo, start with [What Is Mastering?](./glossary/concepts/what-is-mastering.md).
:::

## Foundations

These pages cover the signal and analysis concepts that recur across the API, CLI, WASM, and browser demos.

| Guide | Covers |
|-------|--------|
| [Audio Basics](./glossary/concepts/audio-basics.md) | Sample rate, bit depth, mono/stereo, amplitude, dB, clipping, headroom, and latency. |
| [MIR Overview](./glossary/concepts/mir-overview.md) | BPM, beats, onsets, key, chords, chroma, FFT, STFT, spectrograms, MFCC, CQT, VQT, HPSS, pitch, and sections. |
| [Mixing Basics](./glossary/concepts/mixing-basics.md) | Tracks, stems, trim, fader, pan, stereo width, mute, solo, polarity, headroom, and bouncing. |
| [Editing Basics](./glossary/concepts/editing-basics.md) | Pitch vs time, semitones and cents, MIDI note numbers, formant, and samples vs seconds. |
| [Browser Local Processing](./glossary/concepts/browser-local-processing.md) | What stays local in the browser mastering demo, what still loads from the network, and the tradeoffs of local WASM processing. |

## Analysis Guides

These pages expand the MIR terms used by the analyzer, realtime views, and feature-extraction APIs.

| Guide | Covers |
|-------|--------|
| [Spectrogram and STFT](./glossary/analysis/spectrogram-stft.md) | FFT, STFT windows, `nFft`, `hopLength`, spectrograms, CQT, and VQT. |
| [Onset Detection](./glossary/analysis/onset-detection.md) | Onsets, transients, onset-strength envelopes, and why tempo starts there. |
| [Tempo and BPM](./glossary/analysis/tempo-bpm.md) | BPM estimation, tempograms, autocorrelation, confidence, and half/double-tempo ambiguity. |
| [Beats and Downbeats](./glossary/analysis/beats-downbeats.md) | Beat tracking, dynamic programming, meter phase, and downbeat estimation. |
| [Chroma Features](./glossary/analysis/chroma-features.md) | Pitch classes, chromagrams, and why chroma powers key/chord analysis. |
| [Key Detection](./glossary/analysis/key-detection.md) | Chroma-profile key estimation, candidate keys, profile families, and confidence. |
| [Chord Recognition](./glossary/analysis/chord-recognition.md) | Chord templates, beat-synchronous chroma, smoothing, HMM options, and segment confidence. |
| [Mel, MFCC, and Timbre](./glossary/analysis/mel-mfcc-timbre.md) | Mel scaling, MFCCs, spectral centroid, flatness, and timbre descriptors. |
| [Melody and Pitch](./glossary/analysis/melody-pitch.md) | F0, YIN, pYIN, monophonic pitch tracking, voicing, and melody contours. |
| [Section and Structure](./glossary/analysis/section-structure.md) | Boundary detection, self-similarity, repetition, energy, and section labels. |

## Mixing Guides

These pages expand the mixing-engine terms — the channel strip, routing, image, and metering — used by the [Mixing Engine](./mixing.md) guide.

| Guide | Covers |
|-------|--------|
| [Channel Strip](./glossary/mixing/channel-strip.md) | The fixed strip signal order and why it decides what each control does. |
| [Buses and Sends](./glossary/mixing/buses-sends.md) | Master/aux/submix roles, pre/post-fader sends, FX buses, and VCA groups. |
| [Pan and Stereo Width](./glossary/mixing/pan-width.md) | Pan modes, pan law, and stereo width vs mono compatibility. |
| [Automation and Metering](./glossary/mixing/automation-metering.md) | Automation curves, goniometer, correlation, and true-peak metering. |

## Editing Guides

These pages expand the editing-DSP terms behind the [Editing DSP](./editing-dsp.md) guide.

| Guide | Covers |
|-------|--------|
| [Time Stretch and Pitch Shift](./glossary/editing/phase-vocoder-stretch.md) | Phase vocoder, resampling, the time/pitch trade, and artifacts. |
| [Pitch Correction and Note Editing](./glossary/editing/pitch-correction.md) | MIDI-targeted correction, note regions, and sample-accurate edits. |
| [Voice and Formant](./glossary/editing/voice-formant.md) | Formants, the vocal tract, and pitch vs formant independence. |

## Instruments and MIDI

These pages explain how libsonare turns MIDI into sound — the built-in [NativeSynth](./native-synth.md), the [SoundFont player](./soundfont-player.md), and the MIDI vocabulary they share.

| Guide | Covers |
|-------|--------|
| [Synthesis Basics](./glossary/instruments/synthesis-basics.md) | Oscillators, filters, and the synthesis families NativeSynth uses: subtractive, FM, physical modeling, modal, and additive. |
| [Envelopes and Modulation](./glossary/instruments/envelopes-modulation.md) | ADSR envelopes, LFOs, velocity, key tracking, and the mod matrix. |
| [MIDI Basics](./glossary/instruments/midi-basics.md) | Notes, velocity, channels, CC, program change, banks, General MIDI, pitch bend, and MIDI 2.0. |
| [SoundFont and Sampled Instruments](./glossary/instruments/soundfont.md) | Sampled vs synthesized sound, SF2 banks and programs, and the General MIDI fallback. |

## Arrangement and Projects

These pages expand the headless-DAW terms used by [Project Editing](./project-editing.md), [Recording and Takes](./recording-and-takes.md), and [Project Bounce](./project-bounce.md).

| Guide | Covers |
|-------|--------|
| [Clips and Tracks](./glossary/arrangement/clips-and-tracks.md) | The project model: tracks, clips, the timeline, MIDI destinations, and clip edits. |
| [Takes and Comping](./glossary/arrangement/takes-and-comping.md) | Multiple recorded takes in a clip, the active take, comp segments, and loop recording. |
| [Warp and Tempo Sync](./glossary/arrangement/warp-and-tempo.md) | Warp modes, anchors, tempo maps, time signatures, and pitch-preserving stretch. |
| [Bounce and Rendering](./glossary/arrangement/bounce-and-rendering.md) | Rendering an arrangement to audio, the mixer scene, instrument bounces, and latency compensation. |

## Realtime Guides

These pages expand the realtime/streaming terms used by `StreamAnalyzer`, the `RealtimeEngine`, and the AudioWorklet path.

| Guide | Covers |
|-------|--------|
| [Streaming Analysis](./glossary/realtime/streaming-analysis.md) | Blocks, frames, hops, updating estimates, and compact frame reads. |
| [Realtime Engine](./glossary/realtime/realtime-engine.md) | Transport, clip scheduling, the metronome, and telemetry. |
| [Realtime Safety](./glossary/realtime/realtime-safety.md) | The audio-callback deadline, no-allocation/lock-free rules, and the AudioWorklet. |

## Room Acoustics

These pages expand the room-acoustic terms used by the [Spatial Room Scanner](/spatial) and the [Acoustic Analysis](./acoustic-analysis.md) guide — what a room's decay reveals about its size, surfaces, and the distance to a source.

| Guide | Covers |
|-------|--------|
| [Reverberation Time (RT60 and EDT)](./glossary/acoustics/reverberation-time.md) | RT60, early decay time, the T20/T30 extrapolation, and why the two measures disagree. |
| [Clarity and Definition (C50, C80, D50)](./glossary/acoustics/clarity-definition.md) | Early-to-late energy ratios for speech and music, and definition as a percentage. |
| [Source Distance and DRR](./glossary/acoustics/source-distance.md) | Direct-to-reverberant ratio, critical distance, and why one channel resolves distance but not direction. |
| [Room Geometry and Volume](./glossary/acoustics/room-geometry.md) | The equivalent shoebox, volume, and Sabine's volume/absorption trade-off. |
| [Per-Band Decay and Absorption](./glossary/acoustics/absorption-bands.md) | Per-band RT60, absorption coefficients, and the high-frequency rolloff. |
| [Inverse Room Estimation](./glossary/acoustics/inverse-estimation.md) | Impulse-response vs blind estimation and how to read the confidence score. |

## Mastering Concepts

These guides explain the listening and measurement ideas behind the mastering demo.

| Guide | Covers |
|-------|--------|
| [Mastering](./glossary/mastering.md) | The role of mastering and how loudness, tone, dynamics, stereo image, and peak safety work together. |
| [What Is Mastering?](./glossary/concepts/what-is-mastering.md) | A fuller introduction to mastering as a final delivery process. |
| [LUFS](./glossary/lufs.md) | Integrated loudness and common delivery targets. |
| [True Peak](./glossary/true-peak.md) | Inter-sample peak safety and why `dBTP` differs from sample peak. |
| [A/B Comparison](./glossary/ab-comparison.md) | Loudness-matched before/after listening. |
| [Loudness Matching](./glossary/concepts/loudness-matching.md) | How to compare processing decisions without louder-is-better bias. |
| [Reference Track](./glossary/concepts/reference-track.md) | Using a finished release as a tonal and loudness anchor. |
| [True Peak Safety](./glossary/concepts/true-peak-safety.md) | Choosing ceilings that survive encoding and playback conversion. |
| [Dynamic Range](./glossary/concepts/dynamic-range.md) | Reading movement and density beyond loudness alone. |
| [Crest Factor](./glossary/concepts/crest-factor.md) | Peak-to-average contrast and what it says about punch. |
| [Mono Compatibility](./glossary/concepts/mono-compatibility.md) | Checking whether stereo width survives mono playback. |
| [Gain Staging](./glossary/concepts/gain-staging.md) | Keeping levels sensible before, during, and after processing. |
| [Air Band](./glossary/air-band.md) | High-frequency openness and why it needs restraint. |

## Mastering Feature Guides

These pages group controls by how they are used in the chain. Individual parameters are intentionally not split into thin generated pages.

| Guide | Covers |
|-------|--------|
| [Repair and Input Controls](./glossary/mastering/repair.md) | Input gain, denoise, source clipping, and preparation before the main chain. |
| [Dynamics Controls](./glossary/mastering/dynamics.md) | Threshold, ratio, attack, release, knee, gain reduction, and punch. |
| [Tone and Air Controls](./glossary/mastering/tone-air.md) | Tilt EQ, exciter amount, air-band amount, and brightness decisions. |
| [Stereo, Limiter, and Loudness Controls](./glossary/mastering/stereo-limiter-loudness.md) | Stereo width, limiter ceiling, loudness target, and final rendering. |
| [Reference Match](./glossary/mastering/reference-match.md) | Reference import, level matching, spectral comparison, and match strength. |
| [Delivery Targets](./glossary/mastering/delivery-targets.md) | Choosing LUFS and true-peak targets for streaming, podcast, club, and archive use. |
| [Reading Mastering Meters](./glossary/mastering/meter-reading.md) | LUFS, peak, crest factor, correlation, phase, and stereo image together. |
| [Choosing a Mastering Preset](./glossary/mastering/preset-selection.md) | Selecting a starting point without treating presets as finished masters. |
| [Mastering Quality Checklist](./glossary/mastering/quality-checklist.md) | A final review path before trusting an export. |
| [Error Recovery](./glossary/mastering/error-recovery.md) | What to do when decoding, rendering, reference matching, or playback checks fail. |

## Related Docs

- [Introduction](./introduction.md)
- [Mastering Implementation](./mastering-implementation.md)
- [JavaScript API](./js-api.md)
- [Python API](./python-api.md)
- [CLI](./cli.md)
- [WASM](./wasm.md)
