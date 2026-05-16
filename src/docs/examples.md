# Usage Examples

## By Use Case

### Show BPM and Key in a Browser App

Use the npm WebAssembly package when audio stays in the browser. Decode files
with Web Audio API first, then pass mono `Float32Array` samples to libsonare.

```typescript
import { init, detectBpm, detectKey } from '@libraz/libsonare';

await init();

const audioCtx = new AudioContext();
const decoded = await audioCtx.decodeAudioData(await file.arrayBuffer());
const samples = decoded.getChannelData(0);

const bpm = detectBpm(samples, decoded.sampleRate);
const key = detectKey(samples, decoded.sampleRate);
```

### Batch Analyze a Music Folder from the Terminal

Use the CLI when you want quick terminal output or JSON summaries for scripts.
The CLI is installed from PyPI, not npm.

```bash
pip install libsonare

for f in *.mp3; do
  sonare analyze "$f" --json > "${f%.mp3}.json"
done
```

### Extract Metadata in Python

Use Python when you want scripting, notebooks, or a librosa-like workflow with a
native C++ backend.

```python
from libsonare import Audio

with Audio.from_file("song.mp3") as audio:
    result = audio.analyze()

print(result.bpm, result.key, len(result.beat_times))
```

### Analyze Uploaded Files in Node.js

Use the native Node.js binding when you need server-side file loading and native
performance. It is currently source-build oriented.

```typescript
import { Audio } from '@libraz/libsonare-native';

const audio = Audio.fromFile('/tmp/upload.wav');
const result = audio.analyze();

console.log(result.bpm, result.key.name);
```

## JavaScript/TypeScript

### Basic BPM and Key Detection

```typescript
import { init, detectBpm, detectKey } from '@libraz/libsonare';

async function quickAnalysis(url: string) {
  await init();

  const audioCtx = new AudioContext();
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  const samples = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;

  const bpm = detectBpm(samples, sampleRate);
  const key = detectKey(samples, sampleRate);

  console.log(`BPM: ${bpm}`);
  console.log(`Key: ${key.name} (confidence: ${(key.confidence * 100).toFixed(1)}%)`);
}
```

### Full Music Analysis

```typescript
import { init, analyze } from '@libraz/libsonare';

const result = analyze(samples, sampleRate);

console.log('=== Music Analysis ===');
console.log(`BPM: ${result.bpm} (confidence: ${(result.bpmConfidence * 100).toFixed(0)}%)`);
console.log(`Key: ${result.key.name}`);
console.log(`Time Signature: ${result.timeSignature.numerator}/${result.timeSignature.denominator}`);

console.log('\nChords:');
for (const chord of result.chords) {
  console.log(`  ${chord.name} [${chord.start.toFixed(2)}s - ${chord.end.toFixed(2)}s]`);
}

console.log('\nSections:');
for (const section of result.sections) {
  console.log(`  ${section.name} [${section.start.toFixed(2)}s - ${section.end.toFixed(2)}s]`);
}

console.log(`\nForm: ${result.form}`);
```

### Harmonic-Percussive Separation

```typescript
import { init, hpss, detectKey } from '@libraz/libsonare';

await init();

const result = hpss(samples, sampleRate);

// result.harmonic - melodic content
// result.percussive - drums/percussion

// Use harmonic for key detection (cleaner)
const key = detectKey(result.harmonic, result.sampleRate);
```

### Audio Effects

```typescript
import { init, timeStretch, pitchShift, normalize, trim } from '@libraz/libsonare';

await init();

// Slow down to 80% speed
const slower = timeStretch(samples, sampleRate, 0.8);

// Transpose up 2 semitones
const higher = pitchShift(samples, sampleRate, 2);

// Normalize to -3dB
const normalized = normalize(samples, sampleRate, -3);

// Trim silence
const trimmed = trim(samples, sampleRate, -60);
```

### Feature Extraction

```typescript
import { init, melSpectrogram, mfcc, chroma } from '@libraz/libsonare';

await init();

// Mel spectrogram
const mel = melSpectrogram(samples, sampleRate, 2048, 512, 128);
console.log(`Mel shape: ${mel.nMels} x ${mel.nFrames}`);

// MFCC
const mfccResult = mfcc(samples, sampleRate, 2048, 512, 128, 13);
console.log(`MFCC shape: ${mfccResult.nMfcc} x ${mfccResult.nFrames}`);

// Chroma
const chromaResult = chroma(samples, sampleRate);
console.log('Pitch class distribution:', chromaResult.meanEnergy);
```

### Pitch Detection

```typescript
import { init, pitchPyin } from '@libraz/libsonare';

await init();

const pitch = pitchPyin(samples, sampleRate);

console.log(`Median F0: ${pitch.medianF0.toFixed(1)} Hz`);
console.log(`Mean F0: ${pitch.meanF0.toFixed(1)} Hz`);
console.log(`Voiced frames: ${pitch.voicedFlag.filter(v => v).length}/${pitch.nFrames}`);
```

### Streaming Analysis

Real-time audio analysis for visualizations and live monitoring.

```typescript
import { init, StreamAnalyzer } from '@libraz/libsonare';

await init();

// Create analyzer for 44.1kHz audio
const analyzer = new StreamAnalyzer({
  sampleRate: 44100,
  nFft: 2048,
  hopLength: 512,
  nMels: 128,
  computeMel: true,
  computeChroma: true,
  computeOnset: true,
  emitEveryNFrames: 4, // emit every 4 frames (~60fps)
});

// Process incoming audio chunks
function onAudioData(samples: Float32Array) {
  analyzer.process(samples);

  // Check for available frames
  const available = analyzer.availableFrames();
  if (available > 0) {
    const frames = analyzer.readFrames(available);

    // frames.nFrames        - number of frames
    // frames.timestamps     - [nFrames] Float32Array (stream time in seconds)
    // frames.mel            - [nFrames * nMels] Float32Array
    // frames.chroma         - [nFrames * 12] Float32Array
    // frames.onsetStrength  - [nFrames] Float32Array
    // frames.rmsEnergy      - [nFrames] Float32Array
    // frames.spectralCentroid / spectralFlatness / chordRoot / chordQuality / chordConfidence

    updateVisualization(frames);
  }
}

// Get progressive BPM/key estimates
function checkEstimates() {
  const stats = analyzer.stats();

  if (stats.estimate.bpm > 0) {
    console.log(`BPM: ${stats.estimate.bpm.toFixed(1)} (${(stats.estimate.bpmConfidence * 100).toFixed(0)}%)`);
  }

  if (stats.estimate.key >= 0) {
    const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const mode = stats.estimate.keyMinor ? 'minor' : 'major';
    console.log(`Key: ${keys[stats.estimate.key]} ${mode}`);
  }
}
```

### Streaming with AudioWorklet

```typescript
// analyzer-processor.ts (AudioWorklet)
class AnalyzerProcessor extends AudioWorkletProcessor {
  private analyzer: StreamAnalyzer;

  constructor() {
    super();
    this.analyzer = new StreamAnalyzer({
      sampleRate,
      nFft: 2048,
      hopLength: 512,
      nMels: 64,
      emitEveryNFrames: 4,
    });
  }

  process(inputs: Float32Array[][]): boolean {
    const input = inputs[0]?.[0];
    if (!input) return true;

    this.analyzer.process(input);

    const available = this.analyzer.availableFrames();
    if (available >= 4) {
      const frames = this.analyzer.readFrames(available);
      this.port.postMessage({ type: 'frames', data: frames }, [
        frames.timestamps.buffer,
        frames.mel.buffer
      ]);
    }

    return true;
  }
}

registerProcessor('analyzer-processor', AnalyzerProcessor);
```

```typescript
// main.ts
const audioCtx = new AudioContext();
await audioCtx.audioWorklet.addModule('analyzer-processor.js');

const worklet = new AudioWorkletNode(audioCtx, 'analyzer-processor');
worklet.port.onmessage = (e) => {
  if (e.data.type === 'frames') {
    renderSpectrogram(e.data.data);
  }
};

const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
audioCtx.createMediaStreamSource(stream).connect(worklet);
```

## C++

### Basic Usage

```cpp
#include <sonare/sonare.h>
#include <iostream>

int main() {
  auto audio = sonare::Audio::from_file("music.mp3");

  float bpm = sonare::quick::detect_bpm(
    audio.data(), audio.size(), audio.sample_rate()
  );

  std::cout << "BPM: " << bpm << std::endl;
  return 0;
}
```

### Full Analysis with MusicAnalyzer

```cpp
#include <sonare/sonare.h>
#include <iostream>

int main() {
  auto audio = sonare::Audio::from_file("music.mp3");
  sonare::MusicAnalyzer analyzer(audio);

  // Progress callback
  analyzer.set_progress_callback([](float progress, const char* stage) {
    std::cout << stage << ": " << (progress * 100) << "%\n";
  });

  auto result = analyzer.analyze();

  std::cout << "BPM: " << result.bpm << std::endl;
  std::cout << "Key: " << result.key.to_string() << std::endl;

  std::cout << "\nChords:" << std::endl;
  for (const auto& chord : result.chords) {
    std::cout << "  " << chord.to_string()
              << " [" << chord.start << "s - " << chord.end << "s]"
              << std::endl;
  }

  return 0;
}
```

### Feature Extraction

```cpp
#include <sonare/sonare.h>
#include <iostream>

int main() {
  auto audio = sonare::Audio::from_file("music.mp3");

  // Mel spectrogram
  sonare::MelConfig config;
  config.n_mels = 128;
  config.n_fft = 2048;
  config.hop_length = 512;

  auto mel = sonare::MelSpectrogram::compute(audio, config);
  std::cout << "Mel shape: " << mel.n_mels() << " x " << mel.n_frames() << std::endl;

  // MFCC
  auto mfcc = mel.mfcc(13);
  std::cout << "MFCC coefficients: " << mfcc.size() / mel.n_frames() << std::endl;

  return 0;
}
```

### Audio Effects

```cpp
#include <sonare/sonare.h>

int main() {
  auto audio = sonare::Audio::from_file("music.mp3");

  // HPSS
  auto hpss_result = sonare::hpss(audio);
  // hpss_result.harmonic
  // hpss_result.percussive

  // Time stretch (slow down to 50%)
  auto slow = sonare::time_stretch(audio, 0.5f);

  // Pitch shift (+2 semitones)
  auto higher = sonare::pitch_shift(audio, 2.0f);

  return 0;
}
```

### Zero-Copy Slicing

```cpp
#include <sonare/sonare.h>
#include <iostream>

int main() {
  auto full = sonare::Audio::from_file("song.mp3");
  std::cout << "Full duration: " << full.duration() << "s\n";

  // Zero-copy slices (share same underlying buffer)
  auto intro = full.slice(0.0f, 30.0f);
  auto chorus = full.slice(60.0f, 90.0f);

  // Analyze each section
  auto intro_key = sonare::quick::detect_key(
    intro.data(), intro.size(), intro.sample_rate()
  );
  auto chorus_key = sonare::quick::detect_key(
    chorus.data(), chorus.size(), chorus.sample_rate()
  );

  std::cout << "Intro key: " << intro_key.to_string() << "\n";
  std::cout << "Chorus key: " << chorus_key.to_string() << "\n";

  return 0;
}
```

## C API

```c
#include <sonare_c.h>
#include <stdio.h>

static const char* kPitchNames[] = {
    "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"};

int main() {
  SonareAudio* audio = NULL;
  SonareError err;

  // Load audio
  err = sonare_audio_from_file("music.mp3", &audio);
  if (err != SONARE_OK) {
    printf("Error: %s\n", sonare_error_message(err));
    return 1;
  }

  // Detect BPM (uses the audio handle directly, no extra data copy)
  float bpm;
  err = sonare_audio_detect_bpm(audio, &bpm);
  if (err == SONARE_OK) {
    printf("BPM: %.1f\n", bpm);
  }

  // Detect key (SonareKey holds root + mode + confidence)
  SonareKey key;
  err = sonare_audio_detect_key(audio, &key);
  if (err == SONARE_OK) {
    printf("Key: %s %s (confidence: %.0f%%)\n",
           kPitchNames[key.root],
           key.mode == SONARE_MODE_MAJOR ? "major" : "minor",
           key.confidence * 100);
  }

  // Detect beats
  float* beat_times = NULL;
  size_t beat_count = 0;
  err = sonare_audio_detect_beats(audio, &beat_times, &beat_count);
  if (err == SONARE_OK) {
    printf("Beats: %zu\n", beat_count);
    sonare_free_floats(beat_times);
  }

  sonare_audio_free(audio);
  return 0;
}
```

::: tip Sample-based variants
If you already hold raw samples (e.g., from another audio source), use the sample-based variants instead of constructing a `SonareAudio` handle:

```c
sonare_detect_bpm(samples, length, sample_rate, &out_bpm);
sonare_detect_key(samples, length, sample_rate, &out_key);
sonare_detect_beats(samples, length, sample_rate, &out_times, &out_count);
sonare_analyze(samples, length, sample_rate, &out_result);
```
:::

## CLI Examples

### Quick Analysis

```bash
# BPM detection
sonare bpm song.mp3

# Key detection
sonare key song.mp3

# Full analysis
sonare analyze song.mp3 --json > analysis.json
```

### Audio Processing (C++ CLI only)

::: info
`pitch-shift`, `time-stretch`, and the `hpss` export commands are provided by the C++ `sonare_cli` binary built from source. The Python CLI installed via `pip install libsonare` exposes the analysis and feature commands listed in the [CLI Reference](/docs/cli).
:::

```bash
# Transpose up 2 semitones
sonare pitch-shift --semitones 2 input.wav -o output.wav

# Slow down for practice
sonare time-stretch --rate 0.8 song.wav -o practice.wav

# Separate drums from melody
sonare hpss song.wav -o separated
```

### Batch Processing

```bash
# Analyze all MP3 files
for f in *.mp3; do
  echo "Processing: $f"
  sonare analyze "$f" --json > "${f%.mp3}.json"
done
```
