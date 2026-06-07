# Introduction

If you are new to libsonare, read this page for the vocabulary, then follow the [Learning Path](./learning-path.md) to choose the shortest route for your project. The short explainers here are deliberately brief; the [Glossary](./glossary.md) and [MIR Overview](./glossary/concepts/mir-overview.md) go deeper on each term when you want it.

## What You Will Learn

By the end of this page you should be able to:

- explain what libsonare is and which kinds of music/audio tools it supports;
- understand the basic MIR pipeline from waveform to spectrogram, features, and higher-level music analysis;
- distinguish between analysis, editing, mixing, mastering, realtime streaming, room acoustics, built-in instruments, the headless-DAW runtime, and inverse features;
- choose the next page from the [Learning Path](./learning-path.md) without needing DSP background.

## What is libsonare?

libsonare is a dependency-free audio engine for browser-native and native music tools, covering everything from analysis to arrangement.

It covers several related jobs:

| Area | What libsonare can do |
|------|-----------------------|
| Music Information Retrieval (MIR) | Extract tempo, key, chords, beats, downbeats, time signature, structure, melody, timbre, and dynamics |
| Room acoustics | Measure, estimate, synthesize, or morph room character |
| Mastering | Run broadcast-grade mastering processors and loudness/true-peak handling |
| Mixing | Build a real-time-safe mixer with routing, buses, sends, and meters |
| Editing and creative FX | Change pitch, timing, voice character, reverb, and modulation-style effects |
| Built-in instruments and MIDI | Render MIDI through a multi-engine synth with a GM fallback bank or a SoundFont 2 player ([Built-in Instruments](./native-synth.md), [SoundFont 2 Player](./soundfont-player.md), [MIDI Input](./midi-input.md)) |
| Headless-DAW runtime | Author projects with audio/MIDI tracks, sequence MIDI, and bounce or play back in realtime ([Project Editing](./project-editing.md), [Project Bounce](./project-bounce.md), [Realtime and Streaming](./realtime-streaming.md)) |

::: info Loudness, LUFS, and true peak
LUFS (Loudness Units Full Scale) is the streaming/broadcast standard for perceived loudness, so two tracks at the same LUFS sound equally loud. True peak measures the highest level including peaks that occur between samples, which ordinary peak meters miss — important for avoiding distortion on playback.
:::

It is written in C++17 for performance and can be compiled to **WebAssembly**, making it possible to run the same processors directly in web browsers — no server required.

::: details What is WebAssembly?
WebAssembly (WASM) is a binary instruction format that runs in web browsers at near-native speed. It lets code written in languages like C++ be compiled and run in the browser, with no server and nothing to install. libsonare uses this to bring C++-level audio analysis performance directly to web applications.
:::

## What is Music Information Retrieval?

Music Information Retrieval (MIR) is a field of research that deals with extracting meaningful information from music. When you listen to a song, your brain effortlessly recognizes the tempo, identifies chord changes, and feels the song structure. MIR aims to do the same computationally.

Common MIR tasks include:

| Task | Question it answers |
|------|-------------------|
| **Tempo estimation** | How fast is this song? (e.g., 120 BPM) |
| **Key detection** | What key is this song in? (e.g., C major) |
| **Beat tracking** | Where exactly are the beats? |
| **Chord recognition** | What chords are being played and when? |
| **Structural analysis** | Where are the verse, chorus, and bridge? |
| **Pitch tracking** | What notes are being sung or played? |

::: info What is BPM?
BPM stands for beats per minute — the speed of a song's pulse. 60 BPM is one beat per second; most pop songs sit around 90–130 BPM.
:::

libsonare provides all of these capabilities in a single library.

## Who is it for?

libsonare is designed for developers building music-related applications:

- **Web app developers** — Add audio analysis to your app without a backend. Detect BPM for a DJ tool, visualize chords for a practice app, or build an automatic song structure viewer, all running client-side in the browser via WebAssembly.

- **Music tool creators** — Build DAW plugins, chord detectors, auto-transcription tools, browser mixers, mastering workflows, or music education software. libsonare provides the analysis, mixing, and mastering engine so you can focus on the user experience.

::: details What is a DAW?
A DAW (Digital Audio Workstation) is software for recording, editing, and producing audio. Examples include Ableton Live, Logic Pro, FL Studio, and GarageBand. DAW plugins extend these applications with additional functionality like effects, instruments, or analysis tools.
:::

- **Audio researchers** — If you use [librosa](https://librosa.org/) in Python, libsonare provides a familiar API with compatible parameters and algorithms, but runs the heavy pipeline in native C++ and also works in the browser.

- **Game / interactive media developers** — Analyze music in real time for rhythm games, music visualizers, or adaptive audio systems using the streaming API.

::: tip Try it in the browser
Open [Demos](/demos) for the browser-local tools. Use [Music Analysis Studio](/music-analysis) for MIR features, or open the [Mastering Studio](/mastering) to render a local-only WAV master with no upload.
:::

## How Audio Analysis Works

Audio analysis is not a single step — it's a **pipeline** where each stage builds on the previous one. Understanding this flow helps you see what libsonare is doing under the hood and why certain features depend on others.

::: tip This section is the overview; the [MIR Overview](./glossary/concepts/mir-overview.md) is the map
What follows is a quick tour of the pipeline. For a deeper, cross-linked map of how every feature relates — plus a "which question, which feature" table — see [MIR Overview](./glossary/concepts/mir-overview.md).
:::

```
Audio Waveform
  ↓
Spectral Analysis (STFT)
  ↓
Feature Extraction (chroma, onset envelope, mel spectrogram, ...)
  ↓
Musical Analysis (key, chords, BPM, beats, sections, ...)
```

### Stage 1: Spectral Analysis

Raw audio is a sequence of amplitude values over time: a waveform.

To extract musical meaning, the first step is to convert this into a **spectrogram** using the Short-Time Fourier Transform (STFT).

The STFT breaks the audio into short overlapping windows and computes the frequency content of each. The result is a 2D map of "which frequencies are present at each moment."

::: details What is a Fourier Transform?
A Fourier Transform decomposes a signal into its constituent frequencies, like splitting white light through a prism into a rainbow.

Audio is a sum of many frequencies at different amplitudes. The Fourier Transform reveals which frequencies are present and how strong they are.

The **Short-Time** variant (STFT) applies this repeatedly to overlapping windows of the audio. That lets you see how the frequency content changes over time.
:::

This spectrogram is the foundation for everything that follows.

<SonareDemo id="stft-basics" />

### Stage 2: Feature Extraction

From the spectrogram, libsonare computes various **features** — each designed to capture a specific aspect of the audio:

- **Chroma** — Folds all frequencies into 12 pitch classes (C, C#, D, ..., B), showing which notes are prominent at each moment. This is the basis for key and chord analysis.

::: details What are pitch classes?
In music, a pitch class groups all octaves of the same note together. For example, every C note (C2, C3, C4, ...) belongs to the pitch class "C." There are 12 pitch classes in Western music: C, C#, D, D#, E, F, F#, G, G#, A, A#, B. A chroma feature represents audio as the energy distribution across these 12 classes at each moment, ignoring which octave the notes are in.
:::

- **Onset Envelope** — Measures how much the spectral energy changes between frames, highlighting moments where new notes or hits begin. This drives beat and rhythm analysis.

::: details What is an onset?
An onset is the beginning of a musical event — the moment a note is struck, a drum is hit, or a new sound begins. The onset envelope is a continuous curve that peaks at these moments. By finding the peaks, we can detect individual note attacks, which in turn helps estimate tempo and find beat positions.
:::

- **Mel Spectrogram** — Re-maps the spectrogram to the mel scale, which matches human perception of pitch (we hear the difference between 200 Hz and 400 Hz as the same "distance" as 2000 Hz and 4000 Hz). Widely used in audio ML.

::: details What is the mel scale?
The mel scale is a perceptual scale of pitch. Humans don't perceive frequency linearly — the jump from 100 Hz to 200 Hz sounds like a big change, but 5000 Hz to 5100 Hz sounds almost the same. The mel scale compresses higher frequencies to match this perception. A mel spectrogram uses this scale for its frequency axis, making it better suited for tasks that relate to how we actually hear sound.
:::

- **MFCC** (Mel-Frequency Cepstral Coefficients) — A compact representation of spectral shape derived from the mel spectrogram. Useful for classifying timbre and musical texture.

::: details What is timbre?
Timbre (pronounced "TAM-ber") is what makes a piano and a guitar sound different even when playing the same note at the same volume. It's the "color" or "texture" of a sound, determined by the relative strengths of its harmonic frequencies. MFCC features capture this spectral shape in a compact form, making them useful for distinguishing between different instruments, voices, or sound types.
:::

<SonareDemo id="waveform-harmonics" />

- **CQT / VQT** — Transforms with frequency resolution that matches musical pitch, unlike the standard FFT where resolution is uniform across frequencies.

::: details Why does musical pitch need special frequency resolution?
Musical notes are spaced logarithmically: the frequency doubles with each octave (A3 = 220 Hz, A4 = 440 Hz, A5 = 880 Hz).

A standard FFT uses evenly spaced frequency bins. That makes low notes harder to distinguish, while spending more resolution than needed on high notes.

The Constant-Q Transform (CQT) spaces bins logarithmically to match musical pitch. The Variable-Q Transform (VQT) extends this idea with adjustable resolution.
:::

These features are useful on their own (e.g., feeding a mel spectrogram to a machine learning model), but they also serve as input to higher-level analysis.

### Stage 3: Musical Analysis

The high-level results that most users care about are built **on top of** the features from Stage 2:

| Analysis | Built from | What it does |
|----------|-----------|-------------|
| **Key Detection** | Chroma → Krumhansl-Schmuckler algorithm | Determines the musical key (e.g., "A minor") by comparing chroma profiles against key templates |
| **Chord Recognition** | Chroma → template matching | Identifies chords over time by matching chroma frames against 108 chord type templates |
| **BPM Detection** | Onset envelope → tempogram + autocorrelation | Estimates tempo by finding periodic patterns in onset strength |
| **Beat Tracking** | Onset envelope → dynamic programming | Finds exact beat timestamps by optimizing for rhythmic regularity |
| **Section Detection** | Chroma + spectral features → self-similarity | Segments the song into Intro, Verse, Chorus, etc. by detecting boundaries where musical character changes |
| **Pitch Tracking** | Waveform → YIN / pYIN algorithm | Estimates the fundamental frequency (F0) of monophonic audio for melody extraction |

::: details What is a tempogram?
A tempogram is a time-tempo representation — it shows the strength of different tempo candidates at each moment. It is computed by analyzing the onset envelope for periodic patterns using autocorrelation (measuring how similar a signal is to a time-shifted version of itself). Peaks in the tempogram reveal the dominant tempo.
:::

::: details What is self-similarity analysis?
Self-similarity analysis compares every part of a song against every other part, building a matrix that shows how similar any two moments are. In a pop song, choruses tend to sound similar to each other but different from verses. By finding block-like patterns in this matrix, libsonare can identify section boundaries — where the music transitions from one structural part to another.
:::

::: details What is the fundamental frequency (F0)?
The fundamental frequency (F0) is the lowest frequency of a periodic sound — the frequency that determines the perceived pitch. When a singer sings an A4 note, the F0 is 440 Hz, even though many higher harmonics (880 Hz, 1320 Hz, ...) are also present. Pitch tracking algorithms like YIN and pYIN estimate this F0 over time to extract the melody line from audio.
:::

This layered design means libsonare doesn't just give you answers — it exposes each stage, so you can use low-level features for your own analysis or plug them into ML pipelines.

### Room Acoustics and Inverse Features

Some analysis is about the recording space rather than the song.

::: info New room-acoustic terms
An **equivalent room** is a practical model inferred from audio. A **shoebox geometry** is a rectangular room described by length, width, and height. **Room morphing** applies a target room sound as an effect; it is not dereverberation.
:::

| Entry point | Input | Result |
|-------------|-------|--------|
| `analyzeImpulseResponse` / `analyze_impulse_response` | A clean impulse response | Direct RT60, EDT, clarity, and definition measurements. |
| `detectAcoustic` / `detect_acoustic` | Ordinary audio | Estimated room cues with a confidence value. |
| `estimateRoom` / `estimate_room` | Ordinary audio or an impulse response | Equivalent-room volume, dimensions, absorption, DRR, and confidence. |
| `synthesizeRir` / `synthesize_rir` | Shoebox geometry | A deterministic mono room impulse response. |
| `roomMorph` / `room_morph` | Audio plus target-room geometry | Creative room-character morphing, not dereverberation. |

::: info Room-acoustic abbreviations
**RT60** is the time for reverberation to fall by 60 dB. **EDT** is early decay time, often closer to perceived reverberance. **C50 / C80** are speech/music clarity metrics, and **D50** is the fraction of energy arriving in the first 50 ms. For now, read them as numbers that describe how a room rings; [Room Acoustics](./acoustic-analysis.md) explains how to interpret them.
:::

See [Room Acoustics](./acoustic-analysis.md) for when to use each mode.

libsonare also exposes inverse helpers for debugging and ML workflows: mel spectrograms and MFCCs can be mapped back to approximate spectra or preview audio. These are not restoration tools; they are lossy previews. See [Inverse Features](./inverse-features.md).

### Audio Effects

libsonare also provides audio processing capabilities that operate on the spectral representation:

- **HPSS** (Harmonic-Percussive Source Separation) — Separates audio into harmonic (tonal) and percussive (rhythmic) components using median filtering on the spectrogram. Often used as a preprocessing step to improve analysis accuracy.

::: details What are harmonic and percussive components?
In a spectrogram, harmonic sounds such as vocals, strings, and sustained notes appear as horizontal lines. They maintain a stable frequency over time.

Percussive sounds such as drums, clicks, and transients appear as vertical lines. They contain many frequencies, but only for a brief moment.

HPSS exploits this difference with median filters: a horizontal median filter extracts the harmonic part, and a vertical median filter extracts the percussive part.
:::
- **Time Stretch / Pitch Shift** — Changes tempo or transposes pitch by combining phase-vocoder processing and resampling.
- **Editing DSP** — Pitch correction to a target MIDI note, note-region stretch, and voice-change pitch/formant controls.
- **Creative FX / inserts** — Sound-design DSP such as reverb inserts, chorus, flanger, phaser, and stereo delay.

::: details Creative FX availability
Reverb insert processors (`effects.reverb.*`) are available through mixer/mastering insert factories when creative FX is enabled.

Chorus, flanger, phaser, and stereo-delay DSP modules exist in the source tree. They are not exposed as standalone top-level JS/Python helpers today.

Ducking is exposed as `dynamics.duckingProcessor` / mixer routing rather than a one-shot editing helper.
:::

### Real-Time Streaming

The `StreamAnalyzer` runs the same pipeline on audio **chunk by chunk** with low latency.

It produces per-frame features for real-time visualization or live analysis. Its progressive estimate includes BPM, key, current chord, chord progression, bar-level chord voting, and pattern scores.

In the browser, it integrates with the Web Audio API's AudioWorklet for real-time processing.

### Mixing and Routing

The libsonare mixing engine provides channel strips, pan modes, stereo width controls, sends, FX buses, VCA groups, scene presets, automation lanes, goniometer/true-peak metering, and offline stereo rendering. Use the [Mixing Engine](./mixing.md) guide when you need a persistent mixer scene rather than a one-shot analysis or mastering render.

::: details Mixer terms in one place
A **send** taps a copy of a channel to a shared effect; a **bus** is a sub-mix several channels feed into; a **VCA group** is one fader that controls the level of many channels at once. A **goniometer** visualizes the stereo image, and **true-peak** metering catches peaks that appear only between samples.
:::

## Platform Support

| Platform | Interface | Use case |
|----------|-----------|----------|
| **Browser** | JavaScript/TypeScript (WebAssembly) | Web apps, client-side analysis |
| **Node.js** | JavaScript/TypeScript (WebAssembly) | Server-side processing |
| **Node.js** | JavaScript/TypeScript (N-API native addon) | High-performance server-side processing |
| **Python** | Python (`ctypes` over the native C API) | Data science, scripting, librosa migration |
| **Linux / macOS** | C++ | Native applications, CLI tools |
| **Any (via C API)** | C | FFI integration with other languages |

The current site bundle includes about ~1.7 MB of WebAssembly/JavaScript assets before compression. See the [WebAssembly Guide](/docs/wasm#bundle-size) for the current breakdown.

## Relationship with librosa

[librosa](https://librosa.org/) is the de facto standard Python library for audio analysis in the MIR community. libsonare provides similar MIR building blocks for environments where Python is not available, where native integration is useful, or where a single C++ core is preferred:

::: details What are sample rate, FFT size, and hop length?
These are the fundamental parameters of audio analysis.

| Parameter | Meaning | Tradeoff |
|-----------|---------|----------|
| Sample rate | How many amplitude measurements the audio contains per second, such as 44,100 Hz for CD quality | Higher rates carry higher frequencies but use more data |
| FFT size (`n_fft`) | How many samples each analysis window contains | Larger windows improve frequency resolution but blur time |
| Hop length | How many samples the window moves between frames | Smaller hops give more time detail but cost more computation |

libsonare generally asks you to pass the sample rate explicitly. Common DSP defaults such as `n_fft=2048` and `hop_length=512` mirror typical librosa usage.
:::

- Common DSP parameters and APIs are intentionally close to librosa where practical
- Core features such as STFT, Mel spectrogram, MFCC, and chroma are covered by reference tests against librosa
- Function names and API patterns are intentionally similar for easy migration

libsonare also goes beyond librosa's scope with features like **chord recognition**, **section detection**, **timbre analysis**, and **real-time streaming** — capabilities that are typically separate tools in the Python ecosystem.

See [librosa Compatibility](/docs/librosa-compatibility) for detailed comparison and migration guides.

## Next Steps

- [Learning Path](/docs/learning-path) — Choose the right route for your first project
- [Glossary](/docs/glossary) — Plain-language deep dives on every term used here
- [Installation](/docs/installation) — Set up libsonare in your project
- [Getting Started](/docs/getting-started) — Your first analysis in 5 minutes
- [Feature Map](/docs/api-surface) — See which features are exposed in each binding
- [Examples](/docs/examples) — Common use cases with code
- [Mixing Engine](/docs/mixing) — Channel strips, routing, automation, scenes, and metering
- [Implementation Validation](/docs/implementation-validation) — Understand what is covered by tests and reference checks
- [Demos](/demos) — Try the browser-local tools
