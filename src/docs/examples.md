# Usage Examples

::: warning Package Not Published
The npm package `@libraz/sonare` is currently in beta. See [Installation](/docs/installation) for alternative options.
:::

## JavaScript/TypeScript

### Basic BPM and Key Detection

```typescript
import { init, detectBpm, detectKey } from '@libraz/sonare';

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
import { init, analyze } from '@libraz/sonare';

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
import { init, hpss } from '@libraz/sonare';

await init();

const result = hpss(samples, sampleRate);

// result.harmonic - melodic content
// result.percussive - drums/percussion

// Use harmonic for key detection (cleaner)
const key = detectKey(result.harmonic, result.sampleRate);
```

### Audio Effects

```typescript
import { init, timeStretch, pitchShift, normalize, trim } from '@libraz/sonare';

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
import { init, melSpectrogram, mfcc, chroma } from '@libraz/sonare';

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
import { init, pitchPyin } from '@libraz/sonare';

await init();

const pitch = pitchPyin(samples, sampleRate);

console.log(`Median F0: ${pitch.medianF0.toFixed(1)} Hz`);
console.log(`Mean F0: ${pitch.meanF0.toFixed(1)} Hz`);
console.log(`Voiced frames: ${pitch.voicedFlag.filter(v => v).length}/${pitch.nFrames}`);
```

### Streaming Analysis

Real-time audio analysis for visualizations and live monitoring.

```typescript
import { init, StreamAnalyzer } from '@libraz/sonare';

await init();

// Create analyzer for 44.1kHz audio
const analyzer = new StreamAnalyzer(
  44100,  // sampleRate
  2048,   // nFft
  512,    // hopLength
  128,    // nMels
  true,   // computeMel
  true,   // computeChroma
  true,   // computeOnset
  4       // emit every 4 frames (~60fps)
);

// Process incoming audio chunks
function onAudioData(samples: Float32Array) {
  analyzer.process(samples);

  // Check for available frames
  const available = analyzer.availableFrames();
  if (available > 0) {
    // Use quantized format for efficient transfer
    const frames = analyzer.readFramesU8(available);

    // frames.nFrames - number of frames
    // frames.mel - [nFrames * nMels] Uint8Array
    // frames.chroma - [nFrames * 12] Uint8Array
    // frames.onsetStrength - [nFrames] Uint8Array
    // frames.rmsEnergy - [nFrames] Uint8Array

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
    this.analyzer = new StreamAnalyzer(sampleRate, 2048, 512, 64, true, true, true, 4);
  }

  process(inputs: Float32Array[][]): boolean {
    const input = inputs[0]?.[0];
    if (!input) return true;

    this.analyzer.process(input);

    const available = this.analyzer.availableFrames();
    if (available >= 4) {
      const frames = this.analyzer.readFramesU8(available);
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
  config.stft.n_fft = 2048;
  config.stft.hop_length = 512;

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

int main() {
  SonareAudio* audio = NULL;
  SonareError err;

  // Load audio
  err = sonare_audio_from_file("music.mp3", &audio);
  if (err != SONARE_OK) {
    printf("Error: %s\n", sonare_error_message(err));
    return 1;
  }

  // Detect BPM
  float bpm, confidence;
  err = sonare_detect_bpm(audio, &bpm, &confidence);
  if (err == SONARE_OK) {
    printf("BPM: %.1f (confidence: %.0f%%)\n", bpm, confidence * 100);
  }

  // Detect key
  SonareKey key;
  err = sonare_detect_key(audio, &key);
  if (err == SONARE_OK) {
    printf("Key: %s\n", key.name);
  }

  // Detect beats
  float* beat_times = NULL;
  size_t beat_count = 0;
  err = sonare_detect_beats(audio, &beat_times, &beat_count);
  if (err == SONARE_OK) {
    printf("Beats: %zu\n", beat_count);
    sonare_free_floats(beat_times);
  }

  sonare_audio_free(audio);
  return 0;
}
```

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

### Audio Processing

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
