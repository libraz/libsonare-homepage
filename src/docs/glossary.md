# Glossary

Audio analysis terminology explained in plain language.

::: tip New to Audio Analysis?
Start with [Audio Basics](#audio-basics), then explore the sections relevant to your use case. Terms link to related concepts throughout.
:::

## Audio Basics

### Sample Rate

**What it is:** How many times per second the audio is measured. Think of it like frames in a video - more samples = more detail.

| Sample Rate | Quality | Common Use |
|-------------|---------|------------|
| 44,100 Hz | CD quality | Music playback |
| 48,000 Hz | Broadcast | Video, streaming |
| 22,050 Hz | Analysis | Sufficient for most tasks |

::: details Why does this matter?
Higher sample rates capture higher frequencies (up to half the sample rate). 44.1kHz can capture up to ~22kHz, which covers human hearing range.
:::

### Mono / Stereo

- **Mono**: Single audio channel - like listening through one ear
- **Stereo**: Two channels (left/right) - spatial sound

::: info
libsonare processes **mono audio**. Stereo is automatically converted by averaging left and right channels.
:::

### Amplitude

The "loudness" of an audio signal at any given moment.

- In libsonare: Normalized to **-1.0 to 1.0** range
- **0** = silence
- **±1.0** = maximum (clipping if exceeded)

### dB (Decibel)

A logarithmic scale for measuring audio levels. Each -6 dB halves the perceived volume.

| Level | Meaning |
|-------|---------|
| **0 dB** | Maximum (full scale) |
| **-6 dB** | Half loudness |
| **-20 dB** | Typical music RMS |
| **-60 dB** | Near silence |

::: tip
Use dB for display and comparison - humans perceive loudness logarithmically, not linearly.
:::

---

## Spectral Analysis

### STFT (Short-Time Fourier Transform)

**The foundation of audio analysis.** Breaks audio into small overlapping chunks (frames) and reveals what frequencies are present in each.

```
Audio → [Frame 1][Frame 2][Frame 3]... → Frequency content per frame
         ↓        ↓        ↓
      Spectrogram (2D: time × frequency)
```

::: details Key Parameters
| Parameter | Default | Effect |
|-----------|---------|--------|
| **n_fft** | 2048 | Window size. Larger = better frequency detail, worse time detail |
| **hop_length** | 512 | Gap between frames. Smaller = more frames, more computation |

Trade-off: You can't have perfect time AND frequency resolution simultaneously (Heisenberg uncertainty).
:::

### Spectrogram

A visual "heat map" of audio showing frequency content over time.

- **X-axis**: Time
- **Y-axis**: Frequency
- **Color/brightness**: Intensity (louder = brighter)

::: tip Visualization
Think of a spectrogram as a "fingerprint" of sound - each type of audio has a distinctive pattern.
:::

### Mel Spectrogram

A spectrogram adjusted to match **human hearing perception**. Low frequencies get more resolution because we're more sensitive to them.

::: info Why "Mel"?
Named after "melody" - the Mel scale was designed so that equal distances sound equally far apart to human ears.
:::

**Best for:**
- Machine learning input (genre classification, mood detection)
- Audio visualizations
- Speech analysis

### MFCC (Mel-Frequency Cepstral Coefficients)

A compact "summary" of audio timbre - typically just 13-20 numbers per frame, capturing the essential character of the sound.

::: tip Think of it as...
If a spectrogram is a high-resolution photo, MFCCs are a low-res thumbnail that still captures the essential features.
:::

**Used in:**
- Speech recognition (Siri, Alexa)
- Speaker identification
- Audio fingerprinting (Shazam-style)

### Chroma / Chromagram

Maps all frequencies to **12 pitch classes** (C, C#, D... B), ignoring which octave they're in.

```
All notes → 12 bins: | C | C# | D | D# | E | F | F# | G | G# | A | A# | B |
```

::: tip Think of it as...
A piano keyboard where all octaves are stacked on top of each other - you see which notes are playing, but not which octave.
:::

**Perfect for:**
- Chord detection
- Key detection
- Finding cover songs (same chords, different arrangement)

### CQT (Constant-Q Transform)

Alternative to STFT that uses **musical spacing** - each octave has the same number of bins (like piano keys).

::: details STFT vs CQT
| Feature | STFT | CQT |
|---------|------|-----|
| Frequency spacing | Linear (equal Hz) | Logarithmic (equal semitones) |
| Best for | General analysis | Music/pitch analysis |
| Speed | Faster | Slower |
:::

---

## Rhythm Analysis

### BPM (Beats Per Minute)

**The tempo of music** - how fast the beat pulses.

| BPM Range | Genre Examples |
|-----------|----------------|
| 60-80 | Ballads, ambient, chill |
| 90-110 | Hip-hop, R&B |
| 110-130 | Pop, rock, EDM |
| 130-150 | House, techno |
| 160-180 | Drum & bass, hardcore |

::: warning Common Pitfall
BPM detection can return half or double the actual tempo. A 120 BPM track might be detected as 60 or 240.
:::

### Beat

The rhythmic pulse you tap your foot to. Beat detection finds **exact timestamps** of each beat.

**Use cases:**
- Beat-synced visualizations
- DJ auto-mixing
- Rhythm games
- Video editing to the beat

### Onset

The **start of any sound event** - not just beats, but every note, drum hit, or transient.

::: tip Beat vs Onset
**Beats** are regular pulses (1-2-3-4). **Onsets** catch everything - even the off-beat hi-hats and syncopated notes.
:::

**Use cases:**
- Audio-to-MIDI conversion
- Drum transcription
- Sample slicing

### Time Signature

The rhythmic framework: **beats per measure / note value**

| Signature | Feel | Examples |
|-----------|------|----------|
| 4/4 | Standard, steady | Most pop/rock |
| 3/4 | Waltz, flowing | Classical waltz |
| 6/8 | Compound, swaying | Ballads, some rock |

---

## Harmony Analysis

### Key

The **tonal home base** of a piece of music.

- **Root**: The central pitch (C, D, E, F, G, A, B)
- **Mode**: Major (bright/happy) or Minor (dark/sad)

::: details Understanding Keys
"C major" means C is home base and the scale sounds bright. "A minor" means A is home base and the scale sounds darker.

Songs typically feel "resolved" when they return to their key's root chord.
:::

**Why it matters:**
- DJs use keys for harmonic mixing (songs in compatible keys blend smoothly)
- Transposition to match singer's range
- Music recommendation by compatible keys

### Chord

**Multiple notes played together** creating harmony.

| Type | Sound | Notes (in C) |
|------|-------|--------------|
| Major | Bright, happy | C-E-G |
| Minor | Dark, sad | C-Eb-G |
| 7th | Jazzy, tension | C-E-G-Bb |
| Diminished | Tense, unstable | C-Eb-Gb |

### Chord Progression

The sequence of chords through a song.

::: info Famous Progressions
| Name | Pattern | Songs |
|------|---------|-------|
| Pop progression | I-V-vi-IV | "Let It Be", "No Woman No Cry", thousands more |
| Jazz ii-V-I | ii-V-I | Standard jazz ending |
| 50s progression | I-vi-IV-V | "Stand By Me", doo-wop |
:::

---

## Audio Effects

### HPSS (Harmonic-Percussive Source Separation)

**Splits audio into two parts:**

| Component | Contains | Use for |
|-----------|----------|---------|
| **Harmonic** | Vocals, melody, sustained sounds | Cleaner chord detection |
| **Percussive** | Drums, transients, clicks | Rhythm analysis, drum extraction |

::: tip
Run chord detection on the **harmonic** component for much cleaner results - drums won't confuse the algorithm.
:::

### Time Stretch

**Change speed without changing pitch.**

| Rate | Result |
|------|--------|
| 0.5 | Half speed (twice as long) |
| 1.0 | Original |
| 2.0 | Double speed (half as long) |

**Use cases:** Slow down to learn difficult passages, match tempos for DJ mixing.

### Pitch Shift

**Change pitch without changing speed.** Measured in semitones.

| Semitones | Result |
|-----------|--------|
| +12 | One octave up |
| +7 | Perfect fifth up |
| -12 | One octave down |

**Use cases:** Key matching for mixing, vocal effects, transposition.

### Normalize

Adjust audio to a target loudness level.

- **Peak normalize**: Set loudest moment to target
- **RMS normalize**: Set average loudness to target

---

## Streaming Analysis

### Batch vs Streaming

::: tip When to Use Which
| Approach | Best For | Features |
|----------|----------|----------|
| **Batch** | Pre-recorded files | Full analysis (BPM, key, chords, sections) |
| **Streaming** | Live audio, real-time apps | Per-frame features, progressive estimates |
:::

### StreamAnalyzer

libsonare's real-time processor that analyzes audio **chunk by chunk** as it arrives, perfect for:
- Live visualizations
- Real-time feedback
- Progressive BPM/key/chord detection

### Frame

A single "slice" of analysis output, containing:
- Mel spectrogram values
- Chroma features (12 pitch classes)
- Onset strength
- Spectral features (brightness, noisiness, energy)

### Progressive Estimation

BPM, key, and chord estimates that **improve over time** as more audio is processed.

::: info How it works
After ~5 seconds: rough BPM estimate, low confidence
After ~15 seconds: stable BPM, key emerging
After ~30 seconds: high confidence estimates, chord progression detected
:::

---

## Pitch & Frequency

### Frequency (Hz)

**Vibrations per second** - higher frequency = higher pitch.

| Note | Frequency |
|------|-----------|
| A4 (standard tuning) | 440 Hz |
| C4 (middle C) | 261.63 Hz |
| A3 (octave below A4) | 220 Hz |

::: details Frequency Doubling
Each octave **doubles** the frequency. A3 = 220 Hz, A4 = 440 Hz, A5 = 880 Hz.
:::

### MIDI Note Number

Standard numerical representation for notes:

- **60** = Middle C (C4)
- **69** = A4 (440 Hz)
- Each semitone = +1

### Pitch Class

One of 12 notes, **ignoring octave**: C, C#, D, D#, E, F, F#, G, G#, A, A#, B

### YIN / pYIN

Algorithms for detecting the **fundamental pitch** of audio.

| Algorithm | Speed | Accuracy | Best For |
|-----------|-------|----------|----------|
| YIN | Fast | Good | Real-time |
| pYIN | Slower | Better | Offline analysis |

---

## Spectral Features

::: tip Quick Reference
| Feature | Measures | High Value Means |
|---------|----------|------------------|
| Spectral Centroid | Brightness | Bright, treble-heavy |
| Spectral Bandwidth | Frequency spread | Many frequencies present |
| Spectral Flatness | Noise vs tone | Noisy (1.0 = white noise) |
| Zero Crossing Rate | Signal activity | Percussive/noisy |
| RMS Energy | Loudness | Loud section |
:::

### Spectral Centroid

The **"center of gravity"** of frequencies - indicates brightness.

- Low centroid → Dark, bassy sound (bass guitar, kick drum)
- High centroid → Bright, crisp sound (hi-hats, cymbals)

### Spectral Flatness

How **noise-like** vs **tonal** the audio is.

- **0** = Pure tone (sine wave)
- **1** = White noise (all frequencies equal)

### RMS Energy

**Average loudness** over a window of time. Useful for detecting loud/quiet sections.

---

## Structure Analysis

### Section

A distinct part of a song:

| Section | Purpose | Typical Length |
|---------|---------|----------------|
| **Intro** | Set the mood | 4-16 bars |
| **Verse** | Tell the story | 8-16 bars |
| **Pre-chorus** | Build tension | 4-8 bars |
| **Chorus** | Main hook, memorable | 8-16 bars |
| **Bridge** | Contrast, break | 4-8 bars |
| **Outro** | Wind down | 4-16 bars |

### Form

The overall structure as a letter sequence.

::: details Common Forms
| Form | Structure | Genre |
|------|-----------|-------|
| ABABCB | Verse-Chorus-Verse-Chorus-Bridge-Chorus | Pop |
| AABA | Verse-Verse-Bridge-Verse | Jazz standards |
| AAA | Verse-Verse-Verse (strophic) | Folk, blues |
:::

---

## Timbre Analysis

### Timbre

The **"color" of sound** - what makes a piano sound different from a guitar playing the same note.

### Key Timbre Features

| Feature | Description | High = | Low = |
|---------|-------------|--------|-------|
| **Brightness** | High-frequency content | Crisp, sharp | Warm, mellow |
| **Warmth** | Low-mid presence | Full, rich | Thin, hollow |
| **Density** | Simultaneous sounds | Full arrangement | Minimal, sparse |

---

## See Also

- [JavaScript API Reference](/docs/js-api) - Full API documentation
- [Examples](/docs/examples) - Practical usage examples
- [Getting Started](/docs/getting-started) - Quick start guide
