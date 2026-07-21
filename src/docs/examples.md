# Usage Examples

Use this page after [Getting Started](./getting-started.md). The examples are intentionally task-first: pick the workflow closest to what you are building, then follow the linked runtime reference for full API details.

## What You Will Learn

By the end of this page you should be able to:

- copy one small working pattern for browser, Python, CLI, or Node native use;
- see how the same task changes across runtimes;
- distinguish "load/decode audio" from "call libsonare";
- move from a recipe to the matching API reference when you need options and return types.

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

## Feature Recipes

Each recipe shows the same task across runtimes — pick the tab for where you run
libsonare. Browser examples pass decoded mono `Float32Array` samples; use Web
Audio, another JavaScript decoder, or `Audio.fromMemory*` before that step when
your input is encoded bytes. The Python package and `sonare` CLI load WAV/MP3
files directly. C++ programs are collected separately in the C++ section below.

### Basic BPM and Key Detection

::: code-group

```typescript [Browser]
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

```python [Python]
from libsonare import Audio

with Audio.from_file("song.mp3") as audio:
    bpm = audio.detect_bpm()
    key = audio.detect_key()

print(f"BPM: {bpm}")
print(f"Key: {key.name} (confidence: {key.confidence * 100:.1f}%)")
```

```bash [CLI]
sonare bpm song.mp3
sonare key song.mp3
```

:::

### All-In-One Music Analysis

In both the browser and Python, `analyze()` returns chords, sections, and form
(plus timbre, dynamics, rhythm, and melody) in one call. `detect_chords()` and
`analyze_sections()` stay available as standalone calls for when you want only
that one element without running the all-in-one analysis.

::: tip Python: function vs. method
The module-level `analyze(samples, sample_rate)` returns the all-in-one analysis result.
The `Audio.analyze()` method returns only the core summary (BPM, key, time
signature, beats), so pass the samples to the function when you need chords,
sections, and form together.
:::

::: code-group

```typescript [Browser]
import { init, analyze } from '@libraz/libsonare';

await init();

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

```python [Python]
from libsonare import Audio, analyze

with Audio.from_file("song.mp3") as audio:
    result = analyze(audio.data, audio.sample_rate)

print("=== Music Analysis ===")
print(f"BPM: {result.bpm} (confidence: {result.bpm_confidence * 100:.0f}%)")
print(f"Key: {result.key.name}")
print(f"Time Signature: {result.time_signature}")

print("\nChords:")
for chord in result.chords:
    print(f"  {chord.name} [{chord.start:.2f}s - {chord.end:.2f}s]")

print("\nSections:")
for section in result.sections:
    print(f"  {section.name} [{section.start:.2f}s - {section.end:.2f}s]")

print(f"\nForm: {result.form}")

# Want only one element? Call it standalone instead of the all-in-one analysis:
#   chords = audio.detect_chords().chords
#   sections = analyze_sections(audio.data, audio.sample_rate).sections
```

```bash [CLI]
sonare analyze song.mp3 --json > analysis.json
```

:::

::: details What are "sections" and "form"?
**Sections** are the structural parts of a song — intro, verse, chorus, bridge, outro — found from where the music's character changes. **Form** is the whole arrangement expressed as a compact pattern of those sections (for example `intro–verse–chorus–verse–chorus–outro`, sometimes written with letters such as `ABABCB`). Together they answer "how is this song laid out over time?"
:::

### Room Acoustic Metrics

Start from the input you have:

| Input or goal | Use |
|---------------|-----|
| Measured impulse response | `analyzeImpulseResponse()` |
| Ordinary music or speech recording | `detectAcoustic()` |
| Practical room model inferred from audio | `estimateRoom()` |
| Room dimensions you want to turn into an impulse response | `synthesizeRir()` |
| Creative effect that pushes audio toward a target room | `roomMorph()` |

::: info RIR and equivalent room
**RIR** means room impulse response: audio samples that describe how a room reacts to a short sound. An **equivalent room** is a useful inferred model, not a scan of the exact physical room.
:::

Blind estimates and equivalent-room estimates are useful for tagging or monitoring. Use `confidence` to decide how strongly your UI should present them.

::: code-group

```typescript [Browser]
import { init, analyzeImpulseResponse, detectAcoustic, estimateRoom, synthesizeRir, roomMorph } from '@libraz/libsonare';

await init();

const measured = analyzeImpulseResponse(irSamples, sampleRate);
console.log(`RT60: ${measured.rt60.toFixed(2)} s`);
console.log(`C80: ${measured.c80.toFixed(1)} dB`);

const blind = detectAcoustic(samples, sampleRate);
console.log(`Blind RT60: ${blind.rt60.toFixed(2)} s`);
console.log(`Confidence: ${(blind.confidence * 100).toFixed(0)}%`);

const estimate = estimateRoom(samples, sampleRate);
console.log(`Estimated room: ${estimate.length.toFixed(1)} x ${estimate.width.toFixed(1)} x ${estimate.height.toFixed(1)} m`);

const rir = synthesizeRir({ lengthM: 7, widthM: 5, heightM: 3, absorption: 0.2 });
const morphed = roomMorph(samples, sampleRate, { lengthM: 12, widthM: 9, heightM: 4, wet: 0.6 });
```

```python [Python]
from libsonare import Audio, analyze_impulse_response, estimate_room, synthesize_rir, room_morph

with Audio.from_file("room-ir.wav") as ir:
    measured = analyze_impulse_response(ir.data, sample_rate=ir.sample_rate)

print(f"RT60: {measured.rt60:.2f} s")
print(f"C80: {measured.c80:.1f} dB")

with Audio.from_file("recording.wav") as audio:
    blind = audio.detect_acoustic()
    estimate = estimate_room(audio.data, audio.sample_rate)
    rir = synthesize_rir(7.0, 5.0, 3.0, absorption=0.2, sample_rate=audio.sample_rate)
    morphed = room_morph(audio.data, audio.sample_rate, 12.0, 9.0, 4.0, wet=0.6)

print(f"Blind RT60: {blind.rt60:.2f} s")
print(f"Confidence: {blind.confidence * 100:.0f}%")
print(f"Estimated room: {estimate.length:.1f} x {estimate.width:.1f} x {estimate.height:.1f} m")
```

```bash [CLI]
# Treat the file as a measured impulse response:
sonare acoustic room-ir.wav --ir --json

# Estimate acoustic parameters from ordinary audio:
sonare acoustic recording.wav --json

# Estimate, synthesize, or morph a geometric room:
sonare estimate-room recording.wav --json
sonare synthesize-rir --length 7 --width 5 --height 3 -o room-ir.wav
sonare room-morph recording.wav --length 12 --width 9 --height 4 --wet 0.6 -o morphed.wav
```

:::

### Harmonic-Percussive Separation

::: code-group

```typescript [Browser]
import { init, hpss, detectKey } from '@libraz/libsonare';

await init();

const result = hpss(samples, sampleRate);

// result.harmonic - melodic content
// result.percussive - drums/percussion

// Drums and transients smear the chroma estimate; running key
// detection on just the harmonic part gives a cleaner result.
const key = detectKey(result.harmonic, result.sampleRate);
```

```python [Python]
from libsonare import Audio, detect_key

with Audio.from_file("song.mp3") as audio:
    result = audio.hpss()
    # result.harmonic - melodic content
    # result.percussive - drums/percussion

# Drums and transients smear the chroma estimate, so running key
# detection on just the harmonic component gives a cleaner result.
key = detect_key(result.harmonic, result.sample_rate)
```

```bash [CLI]
# The Python CLI reports harmonic/percussive energies:
sonare hpss song.mp3 --json

# Writing harmonic/percussive WAV stems is available in the C++ sonare_cli build:
#   sonare hpss song.wav -o separated
```

:::

### Audio Effects

::: code-group

```typescript [Browser]
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

```python [Python]
from libsonare import Audio

with Audio.from_file("song.mp3") as audio:
    slower = audio.time_stretch(0.8)        # slow down to 80% speed
    higher = audio.pitch_shift(2)           # transpose up 2 semitones
    normalized = audio.normalize(-3)        # normalize to -3 dB
    trimmed = audio.trim(-60)               # trim silence below -60 dB
```

```bash [C++ CLI]
# Source-built C++ CLI
sonare time-stretch song.wav --rate 0.8 -o slower.wav
sonare pitch-shift song.wav --semitones 2 -o higher.wav
sonare normalize song.wav --target-db -3 -o normalized.wav
sonare trim-silence song.wav -o trimmed.wav
```

:::

### Feature Extraction

::: code-group

```typescript [Browser]
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

```python [Python]
from libsonare import Audio

with Audio.from_file("song.mp3") as audio:
    # Mel spectrogram
    mel = audio.mel_spectrogram(n_fft=2048, hop_length=512, n_mels=128)
    print(f"Mel shape: {mel.n_mels} x {mel.n_frames}")

    # MFCC
    mfcc_result = audio.mfcc(n_fft=2048, hop_length=512, n_mels=128, n_mfcc=13)
    print(f"MFCC shape: {mfcc_result.n_mfcc} x {mfcc_result.n_frames}")

    # Chroma
    chroma_result = audio.chroma()
    print("Pitch class distribution:", chroma_result.mean_energy)
```

```bash [CLI]
sonare mel song.mp3 --json
sonare chroma song.mp3 --json
# MFCC has no dedicated CLI command; use the browser or Python API.
```

:::

### Pitch Detection

::: code-group

```typescript [Browser]
import { init, pitchPyin } from '@libraz/libsonare';

await init();

const pitch = pitchPyin(samples, sampleRate);

console.log(`Median F0: ${pitch.medianF0.toFixed(1)} Hz`);
console.log(`Mean F0: ${pitch.meanF0.toFixed(1)} Hz`);
console.log(`Voiced frames: ${pitch.voicedFlag.filter(v => v).length}/${pitch.nFrames}`);
```

```python [Python]
from libsonare import Audio

with Audio.from_file("song.mp3") as audio:
    pitch = audio.pitch_pyin()

voiced = sum(1 for v in pitch.voiced_flag if v)
print(f"Median F0: {pitch.median_f0:.1f} Hz")
print(f"Mean F0: {pitch.mean_f0:.1f} Hz")
print(f"Voiced frames: {voiced}/{pitch.n_frames}")
```

```bash [CLI]
sonare pitch song.mp3 --algorithm pyin --json
```

:::

::: details What do "voiced" frames mean?
Pitch trackers label each frame as **voiced** or **unvoiced**. *Voiced* means a clear periodic pitch was found (a sung vowel, a held note); *unvoiced* means there is no definite pitch (silence, breaths, consonants like "s"/"t", or noisy/percussive sound). `voicedFlag` / `voiced_flag` is that per-frame boolean, so counting the `true` values tells you how much of the clip actually carried a trackable melody.
:::

<SonareDemo id="melody-contour" />

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
    // frames.chroma         - [nFrames * nChroma] Float32Array (empty when CHROMA is disabled)
    // frames.featureFlags   - MEL=1, CHROMA=2, ONSET=4, SPECTRAL=8
    // frames.onsetStrength  - [nFrames] Float32Array
    // frames.rmsEnergy      - [nFrames] Float32Array
    // frames.spectralCentroid / spectralFlatness / chordRoot / chordQuality / chordConfidence

    updateVisualization(frames);
  }
}

// Get BPM/key estimates that update as audio arrives
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
import { init, StreamAnalyzer } from '@libraz/libsonare';

class AnalyzerProcessor extends AudioWorkletProcessor {
  private analyzer?: StreamAnalyzer;

  constructor() {
    super();
    void init().then(() => {
      this.analyzer = new StreamAnalyzer({
        sampleRate,
        nFft: 2048,
        hopLength: 512,
        nMels: 64,
        emitEveryNFrames: 4,
      });
    });
  }

  process(inputs: Float32Array[][]): boolean {
    const input = inputs[0]?.[0];
    if (!input || !this.analyzer) return true;

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
#include <sonare.h>
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

### All-In-One Analysis with MusicAnalyzer

```cpp
#include <sonare.h>
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
#include <sonare.h>
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
#include <sonare.h>

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
#include <sonare.h>
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

# All-in-one analysis
sonare analyze song.mp3 --json > analysis.json
```

### Audio Processing (C++ CLI only)

::: info
`pitch-shift`, `time-stretch`, and the `hpss` export commands are provided by the C++ `sonare_cli` binary built from source. The Python CLI installed via `pip install libsonare` exposes the analysis and feature commands listed in the [CLI Reference](/docs/cli).
:::

```bash [C++ CLI]
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
