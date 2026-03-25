# CLI Reference

Complete reference for the `sonare` command-line interface.

::: tip Install via pip
The easiest way to get the `sonare` CLI is via pip:
```bash
pip install libsonare
sonare analyze music.mp3
```
Pre-built wheels are available for Linux (x86_64, aarch64) and macOS (Apple Silicon).
:::

::: info C++ CLI
Building from source provides the C++ CLI with additional commands: `chords`, `sections`, `timbre`, `dynamics`, `rhythm`, `melody`, `boundaries`, `pitch-shift`, `time-stretch`, `onset-env`, `cqt`, `system-info`. See [Building from Source](/docs/installation#building-from-source).
:::

## Overview

The sonare CLI provides music analysis and feature extraction capabilities from the command line. Parallel analysis across all available CPU cores delivers performance tens of times faster than Python alternatives.

```bash
sonare <command> [options] <audio_file>
```

## Global Options

| Option | Description |
|--------|-------------|
| `--json` | Output results in JSON format |
| `--help`, `-h` | Show help for command |
| `-o`, `--output` | Output file path |
| `--n-fft <int>` | FFT size (default: 2048) |
| `--hop-length <int>` | Hop length (default: 512) |
| `--n-mels <int>` | Number of Mel bands (default: 128) |

## Analysis Commands

### analyze

Full music analysis including BPM, key, time signature, and beats.

```bash
sonare analyze music.mp3
sonare analyze music.mp3 --json
```

**Output:**
```
  > Estimated BPM : 120.50 BPM  (conf 95.0%)
  > Estimated Key : C major  (conf 85.0%)
  > Time Signature: 4/4
  > Beats: 240
```

**JSON Output:**
```json
{
  "bpm": 120.5,
  "bpm_confidence": 0.95,
  "key": {
    "root": 0,
    "mode": 0,
    "confidence": 0.85,
    "name": "C major"
  },
  "time_signature": {
    "numerator": 4,
    "denominator": 4
  },
  "beats": 240
}
```

### bpm

Detect tempo (BPM) only.

```bash
sonare bpm music.mp3
sonare bpm music.wav --json
```

**Output:**
```
  BPM: 128.00
```

### key

Detect musical key.

```bash
sonare key music.mp3
sonare key music.mp3 --json
```

**Output:**
```
  Key: A minor (confidence: 82.0%)
```

**JSON Output:**
```json
{"root": 9, "mode": 1, "confidence": 0.82, "name": "A minor"}
```

### beats

Detect beat times.

```bash
sonare beats music.mp3
sonare beats music.mp3 --json
```

**Output:**
```
  Beat times (240 beats):
    1. 0.520s
    2. 1.020s
    3. 1.520s
    ... (237 more)
```

### onsets

Detect onset times (note attacks).

```bash
sonare onsets music.mp3
sonare onsets music.mp3 --json
```

## Feature Commands

### mel

Compute Mel spectrogram statistics.

```bash
sonare mel music.mp3
sonare mel music.mp3 --n-mels 80
```

**Output:**
```
  Mel Spectrogram:
    Shape: 128 mels x 8520 frames
```

### chroma

Compute chromagram (pitch class distribution).

```bash
sonare chroma music.mp3
sonare chroma music.mp3 --json
```

**Output:**
```
  Chromagram: 12 bins x 8520 frames
  Mean energy per pitch class:
    C  0.1250 #############
    C# 0.0450 #####
    D  0.0820 ########
    ...
```

### spectral

Compute spectral features (centroid, bandwidth, rolloff, flatness, ZCR, RMS).

```bash
sonare spectral music.mp3
sonare spectral music.mp3 --json
```

**Output:**
```
  Spectral Features:
  Feature          Mean       Std        Min        Max
  centroid         2150.5     850.2      120.5      8500.0
  bandwidth        1850.2     520.8       50.2      4200.5
  rolloff          4520.8    1200.5      200.0     10000.0
  flatness         0.0250     0.0180     0.0010     0.1520
  zcr              0.0850     0.0420     0.0020     0.2500
  rms              0.0520     0.0280     0.0001     0.1850
```

### pitch

Track pitch using YIN or pYIN algorithm.

```bash
sonare pitch music.mp3
sonare pitch music.mp3 --algorithm yin
```

| Option | Default | Description |
|--------|---------|-------------|
| `--algorithm` | pyin | Pitch algorithm: "yin" or "pyin" |

**Output:**
```
  Pitch Tracking (pyin):
    Frames:    8520
    Median F0: 285.5 Hz
    Mean F0:   302.8 Hz
```

### hpss

Harmonic-Percussive Source Separation.

```bash
sonare hpss music.mp3
sonare hpss music.mp3 --json
```

**Output:**
```
  HPSS: 3980000 samples
  Harmonic energy:   0.025000
  Percussive energy: 0.018000
```

## Utility Commands

### info

Display audio file information.

```bash
sonare info music.mp3
sonare info music.wav --json
```

**Output:**
```
  Duration:    3:00 (180.5s)
  Sample Rate: 22050 Hz
  Samples:     3980000
```

### version

Display version information.

```bash
sonare version
sonare version --json
```

**Output:**
```
libsonare 1.0.1 (Python CLI)
```

## Examples

### Basic Analysis Workflow

```bash
# Quick BPM and key check
sonare bpm song.mp3
sonare key song.mp3

# Full analysis with JSON output for scripting
sonare analyze song.mp3 --json > analysis.json
```

### Feature Extraction for ML

```bash
# Extract features for machine learning
sonare mel song.mp3 --json > mel_features.json
sonare spectral song.mp3 --json > spectral_features.json
sonare chroma song.mp3 --json > chroma_features.json
```

### Batch Processing

```bash
# Analyze all MP3 files in directory
for f in *.mp3; do
  echo "Processing: $f"
  sonare analyze "$f" --json > "${f%.mp3}.json"
done

# Extract BPM from all files
for f in *.wav; do
  bpm=$(sonare bpm "$f" --json | jq -r '.bpm')
  echo "$f: $bpm BPM"
done
```

## Supported Audio Formats

| Format | Extension | Notes |
|--------|-----------|-------|
| WAV | `.wav` | Uncompressed PCM |
| MP3 | `.mp3` | Decoded using minimp3 |

## Exit Codes

| Code | Description |
|------|-------------|
| 0 | Success |
| 1 | Error (invalid arguments, file not found, processing error) |

## Performance Tips

1. **Large files**: For files over 10 minutes, consider analyzing segments:
   ```bash
   # Analyze only first 60 seconds (using ffmpeg)
   ffmpeg -i long_song.mp3 -t 60 sample.wav
   sonare analyze sample.wav
   ```

2. **FFT size**: Smaller FFT size (`--n-fft 1024`) is faster but less frequency resolution.

3. **Hop length**: Larger hop length (`--hop-length 1024`) is faster but less time resolution.
