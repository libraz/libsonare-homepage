# Usage Examples

Use this page after [Getting Started](./getting-started.md). The examples are intentionally task-first: pick the workflow closest to what you are building, then follow the linked runtime reference for full API details. This page covers quick task-first patterns; deeper per-feature walkthroughs for every runtime live on [Feature Recipes](./examples-recipes.md).

## What You Will Learn

By the end of this page you should be able to:

- run a batch or server-side analysis in the runtime you use;
- see how the same task changes across runtimes;
- distinguish "load/decode audio" from "call libsonare";
- move from a recipe to the matching API reference when you need options and return types.

## By Use Case

The single-file first program for each runtime is on [Getting Started](./getting-started.md#first-result). The patterns below are the next step. For a whole production job carried from raw files to a deliverable (stems to a finished master, a delivery gate that runs in CI, a batch of takes cleaned up), see [Use Cases](./use-cases.md).

### Batch Analyze a Music Folder

Each version prints one line per file: name, BPM, and key. The CLI version writes a JSON summary per file instead.

::: code-group

```bash [CLI]
pip install libsonare

for f in *.mp3; do
  sonare analyze "$f" --json > "${f%.mp3}.json"
done
```

```python [Python]
from pathlib import Path
from libsonare import Audio

for path in sorted(Path(".").glob("*.mp3")) + sorted(Path(".").glob("*.wav")):
    with Audio.from_file(str(path)) as audio:
        result = audio.analyze()
    print(f"{path.name}\t{result.bpm:.1f}\t{result.key.name}")
```

```js [Node.js (WASM)]
import { readdirSync, readFileSync } from 'node:fs';
import { init, Audio } from '@libraz/libsonare';

await init();
for (const name of readdirSync('.').filter((f) => /\.(mp3|wav)$/i.test(f))) {
  const result = Audio.fromMemory(new Uint8Array(readFileSync(name))).analyze();
  console.log(`${name}\t${result.bpm.toFixed(1)}\t${result.key.name}`);
}
```

:::

### Analyze Uploaded Files on a Server

The WASM package decodes the uploaded bytes in memory, so nothing touches the disk. The native addon reads from a path and is built from source ([Native Bindings](./native-bindings.md)).

::: code-group

```js [Node.js (WASM)]
import { init, Audio } from '@libraz/libsonare';

await init();

// `body` is the uploaded WAV or MP3 file as a Buffer or Uint8Array.
export function analyzeUpload(body) {
  const result = Audio.fromMemory(new Uint8Array(body)).analyze();
  return { bpm: result.bpm, key: result.key.name, chords: result.chords.length };
}
```

```typescript [Node.js (native)]
import { Audio } from '@libraz/libsonare-native';

const result = Audio.fromFile('/tmp/upload.wav').analyze();
console.log(result.bpm, result.key.name);
```

:::

## C++

These programs include `<sonare.h>`, which resolves both in a source tree and after `cmake --install`: the installed `sonare::` targets put `include/sonare/cpp` on the include path. `<sonare/cpp/sonare.h>` is the same header through the namespaced path ([Installing the C++ Library](./installation.md#installing-the-c-library)).

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
#include <sonare/sonare_c.h>
#include <stdio.h>

static const char* kPitchNames[] = {
    "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"};
// Indexed by SonareMode: SONARE_MODE_MAJOR (0) through SONARE_MODE_LOCRIAN (6).
static const char* kModeNames[] = {
    "major", "minor", "dorian", "phrygian", "lydian", "mixolydian", "locrian"};

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
           kModeNames[key.mode],
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

### Audio Processing

::: info
The Python CLI installed by `pip install libsonare` provides `pitch-shift`, `time-stretch`, and file-writing `hpss`. The native executable is named `sonare-cli`; substitute that name when using a release archive or source-built native CLI.
:::

```bash [Python CLI]
# Transpose up 2 semitones
sonare pitch-shift --semitones 2 input.wav -o output.wav

# Slow down for practice
sonare time-stretch --rate 0.8 song.wav -o practice.wav

# Separate sustained (harmonic) from percussive content such as drums
sonare hpss song.wav -o separated
```
