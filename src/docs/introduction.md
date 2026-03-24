# Introduction

## What is libsonare?

libsonare is an audio analysis library for **Music Information Retrieval (MIR)**. Given an audio file or stream, it can automatically extract musical information such as tempo (BPM), key, chords, beats, song structure, and more.

It is written in C++17 for performance and can be compiled to **WebAssembly**, making it possible to run the same analysis directly in web browsers — no server required.

::: details What is WebAssembly?
WebAssembly (WASM) is a binary instruction format that runs in web browsers at near-native speed. It allows code written in languages like C++ to be compiled and executed in the browser, without needing a server or installing anything. libsonare uses this to bring C++-level audio analysis performance directly to web applications.
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

libsonare provides all of these capabilities in a single library.

## Who is it for?

libsonare is designed for developers building music-related applications:

- **Web app developers** — Add audio analysis to your app without a backend. Detect BPM for a DJ tool, visualize chords for a practice app, or build an automatic song structure viewer, all running client-side in the browser via WebAssembly.

- **Music tool creators** — Build DAW plugins, chord detectors, auto-transcription tools, or music education software. libsonare provides the analysis engine so you can focus on the user experience.

::: details What is a DAW?
A DAW (Digital Audio Workstation) is software for recording, editing, and producing audio. Examples include Ableton Live, Logic Pro, FL Studio, and GarageBand. DAW plugins extend these applications with additional functionality like effects, instruments, or analysis tools.
:::

- **Audio researchers** — If you use [librosa](https://librosa.org/) in Python, libsonare provides a familiar API with compatible parameters and algorithms, but runs at native C++ speed (~10x faster) and works in the browser.

- **Game / interactive media developers** — Analyze music in real-time for rhythm games, music visualizers, or adaptive audio systems using the streaming API.

## How Audio Analysis Works

Audio analysis is not a single step — it's a **pipeline** where each stage builds on the previous one. Understanding this flow helps you see what libsonare is doing under the hood and why certain features depend on others.

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

Raw audio is a sequence of amplitude values over time — a waveform. To extract musical meaning, the first step is to convert this into a **spectrogram** using the Short-Time Fourier Transform (STFT). The STFT breaks the audio into short overlapping windows and computes the frequency content of each, producing a 2D map of "which frequencies are present at each moment."

::: details What is a Fourier Transform?
A Fourier Transform decomposes a signal into its constituent frequencies — like splitting white light through a prism into a rainbow. Audio is a sum of many frequencies (sine waves) at different amplitudes. The Fourier Transform reveals which frequencies are present and how strong they are. The **Short-Time** variant (STFT) applies this repeatedly to overlapping windows of the audio, so you can see how the frequency content changes over time.
:::

This spectrogram is the foundation for everything that follows.

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

- **CQT / VQT** — Transforms with frequency resolution that matches musical pitch, unlike the standard FFT where resolution is uniform across frequencies.

::: details Why does musical pitch need special frequency resolution?
Musical notes are spaced logarithmically — the frequency doubles with each octave (A3 = 220 Hz, A4 = 440 Hz, A5 = 880 Hz). A standard FFT uses evenly spaced frequency bins, so it can't distinguish low notes well while wasting resolution on high notes. The Constant-Q Transform (CQT) spaces its bins logarithmically to match musical pitch, giving equal resolution per octave. The Variable-Q Transform (VQT) extends this with adjustable resolution.
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

### Audio Effects

libsonare also provides audio processing capabilities that operate on the spectral representation:

- **HPSS** (Harmonic-Percussive Source Separation) — Separates audio into harmonic (tonal) and percussive (rhythmic) components using median filtering on the spectrogram. Often used as a preprocessing step to improve analysis accuracy.

::: details What are harmonic and percussive components?
In a spectrogram, harmonic sounds (vocals, strings, sustained notes) appear as horizontal lines — they maintain a stable frequency over time. Percussive sounds (drums, clicks, transients) appear as vertical lines — they contain many frequencies but only for a brief moment. HPSS exploits this difference using median filters: a horizontal median filter extracts the harmonic part, and a vertical median filter extracts the percussive part.
:::
- **Time Stretch** — Changes tempo without affecting pitch by manipulating the STFT phase.
- **Pitch Shift** — Transposes pitch without affecting tempo.

### Real-Time Streaming

The `StreamAnalyzer` runs the same pipeline on audio **chunk-by-chunk** with low latency, producing per-frame features suitable for real-time visualization or live analysis. It integrates with the Web Audio API's AudioWorklet for in-browser real-time processing.

## Platform Support

| Platform | Interface | Use case |
|----------|-----------|----------|
| **Browser** | JavaScript/TypeScript (WebAssembly) | Web apps, client-side analysis |
| **Node.js** | JavaScript/TypeScript (WebAssembly) | Server-side processing |
| **Linux / macOS** | C++ | Native applications, CLI tools |
| **Any (via C API)** | C | FFI integration with other languages |

The WebAssembly build is ~262 KB (~92 KB gzipped) with no external dependencies.

## Relationship with librosa

[librosa](https://librosa.org/) is the de facto standard Python library for audio analysis in the MIR community. libsonare is designed as a **compatible alternative** for environments where Python isn't available or performance is critical:

::: details What are sample rate, FFT size, and hop length?
These are the fundamental parameters of audio analysis. **Sample rate** is how many amplitude measurements per second the audio contains (e.g., 44,100 Hz for CD quality). **FFT size** (n_fft) is the number of samples in each analysis window — larger windows give better frequency resolution but worse time resolution. **Hop length** is how many samples the window moves between frames — smaller hops give more time detail but more computation. libsonare defaults to 22,050 Hz sample rate, 2,048 FFT size, and 512 hop length, matching librosa.
:::

- Default parameters (sample rate, FFT size, hop length, etc.) match librosa exactly
- Core algorithms (STFT, mel spectrogram, MFCC, chroma) produce numerically compatible results
- Function names and API patterns are intentionally similar for easy migration

libsonare also goes beyond librosa's scope with features like **chord recognition**, **section detection**, **timbre analysis**, and **real-time streaming** — capabilities that are typically separate tools in the Python ecosystem.

See [librosa Compatibility](/docs/librosa-compatibility) for detailed comparison and migration guides.

## Next Steps

- [Installation](/docs/installation) — Set up libsonare in your project
- [Getting Started](/docs/getting-started) — Your first analysis in 5 minutes
- [Examples](/docs/examples) — Common use cases with code
- [Demo](/) — Try it in your browser right now
