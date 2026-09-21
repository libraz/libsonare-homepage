---
title: C++ Streaming API
description: Real-time, block-by-block audio analysis with StreamAnalyzer in the libsonare C++ interface.
---

# C++ Streaming API

Real-time streaming analysis for the libsonare C++ interface; see [C++ API Reference](./cpp-api.md) for the rest of the C++ surface.

## StreamAnalyzer <Badge type="tip" text="Real-time" />

Real-time streaming audio analyzer for visualizations and live monitoring.

::: info Batch vs Streaming
Use `MusicAnalyzer` for all-in-one analysis of pre-recorded files. Use `StreamAnalyzer` for real-time processing with low latency.
:::

For cross-runtime examples and bounded-window clip streaming, see [Realtime Streaming](./realtime-streaming.md).

Frames flow from the audio callback into a bounded internal queue, and you read them out in whichever representation matches your transport budget. All three read methods drain the same queue — pick one per consumer.

<FlowDiagram
  title="StreamAnalyzer read path"
  :nodes="[
    { id: 'callback', label: 'Audio-callback thread', col: 0, row: 1, variant: 'accent' },
    { id: 'process', label: 'analyzer.process()', col: 1, row: 1, variant: 'accent' },
    { id: 'queue', label: 'Bounded frame queue', col: 2, row: 1 },
    { id: 'aos', label: 'read_frames() — AoS StreamFrame', col: 3, row: 0, group: 'read' },
    { id: 'soa', label: 'read_frames_soa() — SoA FrameBuffer', col: 3, row: 1, group: 'read' },
    { id: 'quant', label: 'read_frames_quantized_u8 / _i16', col: 3, row: 2, variant: 'muted', group: 'read' },
    { id: 'consumer', label: 'Consumer / worker / UI thread', col: 4, row: 1, variant: 'success' }
  ]"
  :edges="[
    { from: 'callback', to: 'process' },
    { from: 'process', to: 'queue', label: 'available_frames()' },
    { from: 'queue', to: 'aos', label: 'full float' },
    { from: 'queue', to: 'soa', label: 'full float, contiguous' },
    { from: 'queue', to: 'quant', label: 'optional 8-/16-bit', style: 'dashed' },
    { from: 'aos', to: 'consumer', label: 'per-frame structs' },
    { from: 'soa', to: 'consumer', label: 'cache-friendly, cheap to hand off' },
    { from: 'quant', to: 'consumer', label: '4x / 2x less bandwidth' }
  ]"
  :groups="[
    { id: 'read', label: 'Read format (pick one per consumer)' }
  ]"
  caption="Full-float reads keep every bit of precision; SoA packs the same floats contiguously for cheap transfer; the optional 8-/16-bit quantized reads trade precision for 4x / 2x smaller buffers when handing frames to a worker or UI thread."
/>

### Configuration

```cpp
struct StreamConfig {
  int sample_rate = 44100;
  int n_fft = 2048;
  int hop_length = 512;
  WindowType window = WindowType::Hann;

  // Feature flags
  bool compute_magnitude = false;
  bool compute_mel = true;
  bool compute_chroma = true;
  bool compute_onset = true;
  bool compute_spectral = true;

  // Mel configuration
  int n_mels = 128;
  float fmin = 0.0f;
  float fmax = 0.0f;  // 0 = sr/2

  // Tuning configuration
  float tuning_ref_hz = 440.0f;  // Reference frequency for A4

  // Output configuration
  OutputFormat output_format = OutputFormat::Float32; // legacy; must remain Float32
  int emit_every_n_frames = 1;   // 4 = ~60fps at 44100Hz
  int magnitude_downsample = 1;  // Downsample factor for magnitude
  size_t max_pending_frames = 4096; // unread cap; overflow drops newly produced frames
  size_t max_progression_entries = 4096; // per-progression cap; overflow drops the oldest entry

  // Progressive estimation intervals
  float key_update_interval_sec = 5.0f;
  float bpm_update_interval_sec = 10.0f;
};
```

`output_format` is retained for source compatibility and must remain `OutputFormat::Float32`. Use the explicit quantized read methods below to produce `Int16` or `Uint8` payloads without changing the analyzer configuration.

`analyzer.stats()` reports `pending_frames` and cumulative `dropped_output_frames` alongside the existing totals and progressive estimate. This lets a native host distinguish a healthy bounded queue from a consumer that is repeatedly falling behind.

### Basic Usage

```cpp
#include <streaming/stream_analyzer.h>

using namespace sonare;

StreamConfig config;
config.sample_rate = 44100;
config.n_mels = 64;
config.emit_every_n_frames = 4;

StreamAnalyzer analyzer(config);

// Process audio chunks (e.g., from audio callback)
void audio_callback(const float* samples, size_t n_samples) {
  analyzer.process(samples, n_samples);

  // Read available frames
  size_t available = analyzer.available_frames();
  if (available > 0) {
    auto frames = analyzer.read_frames(available);
    for (const auto& frame : frames) {
      // frame.timestamp - time in seconds
      // frame.mel - [n_mels] mel spectrogram
      // frame.chroma - [12] chromagram
      // frame.onset_strength - onset value
      // frame.rms_energy - RMS energy
      visualize(frame);
    }
  }
}
```

### StreamFrame

```cpp
struct StreamFrame {
  float timestamp;          // Stream time in seconds
  int frame_index;          // Cumulative frame count

  // Frequency features (sizes depend on config)
  std::vector<float> magnitude;  // [n_bins] or downsampled
  std::vector<float> mel;        // [n_mels]
  std::vector<float> chroma;     // [12] when enabled; empty otherwise

  // Scalar features
  float spectral_centroid;
  float spectral_flatness;
  float rms_energy;

  // Onset detection (1-frame lag)
  float onset_strength;
  bool onset_valid;  // false for first frame

  // Chord detection (per-frame)
  int chord_root;          // 0-11 for C-B, -1 = unknown
  int chord_quality;       // 0=Maj, 1=Min, 2=Dim, etc.
  float chord_confidence;  // 0-1
};
```

### SOA Format (Efficient Transfer)

For efficient inter-thread transfer, use Structure-of-Arrays format:

```cpp
FrameBuffer buffer;
analyzer.read_frames_soa(max_frames, buffer);

// buffer.n_frames
// buffer.timestamps - [n_frames]
// buffer.mel - [n_frames * n_mels]
// buffer.n_chroma / buffer.feature_flags - stride and MEL=1, CHROMA=2, ONSET=4, SPECTRAL=8
// buffer.chroma - [n_frames * n_chroma], or empty when CHROMA is disabled
// buffer.onset_strength - [n_frames]
// buffer.rms_energy - [n_frames]
// buffer.spectral_centroid - [n_frames]
// buffer.spectral_flatness - [n_frames]
// buffer.chord_root / chord_quality / chord_confidence - [n_frames]
```

::: details Layout terms: Structure-of-Arrays, row-major, quantization
- **Structure-of-Arrays (SoA)** — each field is its own contiguous array (`timestamps`, `mel`, `chroma`, …) rather than an array of per-frame structs. This is cache-friendly, SIMD-friendly, and cheap to hand to another thread.
- **Row-major** — 2-D data such as `mel` (`[n_frames * n_mels]`) is stored one full row after another: all of frame 0's mel bins, then all of frame 1's. Index element `(f, m)` as `f * n_mels + m`.
- **Quantization** (next section) — packs each 32-bit float into an 8- or 16-bit integer over a fixed min/max range, trading precision for ~4x / 2x smaller buffers; ideal for handing frames to a UI thread.
:::

### Quantized Formats (Bandwidth Reduction)

```cpp
// 8-bit quantized (4x bandwidth reduction)
QuantizedFrameBufferU8 u8_buffer;
QuantizeConfig qconfig;
qconfig.mel_db_min = -80.0f;
qconfig.mel_db_max = 0.0f;

analyzer.read_frames_quantized_u8(max_frames, u8_buffer, qconfig);

// 16-bit quantized (2x bandwidth reduction)
QuantizedFrameBufferI16 i16_buffer;
analyzer.read_frames_quantized_i16(max_frames, i16_buffer, qconfig);
```

### ChordChange

```cpp
struct ChordChange {
  int root;           // 0-11 (C-B)
  int quality;        // 0=Maj, 1=Min, 2=Dim, etc.
  float start_time;   // seconds
  float confidence;   // 0-1
};
```

### BarChord

Chord detected at bar boundary (beat-synchronized).

```cpp
struct BarChord {
  int bar_index;
  int root;           // 0-11 (C-B)
  int quality;        // 0=Maj, 1=Min, 2=Dim, etc.
  float start_time;   // seconds
  float confidence;   // 0-1
};
```

### AnalyzerStats

```cpp
struct AnalyzerStats {
  int total_frames;
  size_t total_samples;
  float duration_seconds;
  size_t pending_frames;                        // unread output frames currently retained
  size_t dropped_output_frames;                 // output frames dropped at the pending-frame limit
  size_t dropped_chord_progression_entries;     // chord changes dropped at the history cap
  size_t dropped_bar_progression_entries;       // bar chords dropped at the history cap
  ProgressiveEstimate estimate;
};
```

### ProgressiveEstimate

BPM, key, chord, and pattern estimates that improve over time.

```cpp
struct ProgressiveEstimate {
  // BPM estimation
  float bpm;                // 0 if not yet estimated
  float bpm_confidence;     // 0-1, increases over time
  int bpm_candidate_count;

  // Key estimation
  int key;                  // 0-11 (C-B), -1 = unknown
  bool key_minor;
  float key_confidence;     // 0-1, increases over time

  // Chord estimation (current)
  int chord_root;           // 0-11, -1 = unknown
  int chord_quality;        // 0=Maj, 1=Min, etc.
  float chord_confidence;
  float chord_start_time;

  // Chord progression (accumulated over time)
  std::vector<ChordChange> chord_progression;

  // Bar-synchronized chord progression (requires stable BPM)
  std::vector<BarChord> bar_chord_progression;
  int current_bar;          // -1 if BPM not stable
  float bar_duration;       // 0 if BPM not stable

  // Pattern detection
  int pattern_length;                     // repeating pattern length (default: 4 bars)
  std::vector<BarChord> voted_pattern;    // voted chord per pattern position
  std::string detected_pattern_name;      // best matching pattern (e.g., "royalRoad")
  float detected_pattern_score;           // match score (0-1)
  std::vector<std::pair<std::string, float>> all_pattern_scores;

  // Statistics
  float accumulated_seconds;
  int used_frames;
  bool updated;             // true if estimate changed this frame
};
```

### Progressive Estimation

Get BPM and key estimates that improve over time:

```cpp
AnalyzerStats stats = analyzer.stats();

// BPM (available after ~10 seconds)
if (stats.estimate.bpm > 0) {
  std::cout << "BPM: " << stats.estimate.bpm
            << " (confidence: " << stats.estimate.bpm_confidence << ")\n";
}

// Key (available after ~5 seconds)
if (stats.estimate.key >= 0) {
  const char* keys[] = {"C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"};
  std::cout << "Key: " << keys[stats.estimate.key]
            << (stats.estimate.key_minor ? " minor" : " major") << "\n";
}

// Chord progression pattern
if (!stats.estimate.detected_pattern_name.empty()) {
  std::cout << "Pattern: " << stats.estimate.detected_pattern_name
            << " (score: " << stats.estimate.detected_pattern_score << ")\n";
}
```

### External Synchronization

For precise timing with external timeline:

```cpp
// Track cumulative sample offset externally
size_t sample_offset = 0;

void audio_callback(const float* samples, size_t n_samples) {
  analyzer.process(samples, n_samples, sample_offset);
  sample_offset += n_samples;
}
```

### Reset

```cpp
// Reset for new stream
analyzer.reset();

// Reset with base offset
analyzer.reset(initial_sample_offset);
```

### Configuration Methods

```cpp
// Set expected total duration for optimal pattern lock timing
analyzer.set_expected_duration(180.0f);  // 3 minutes

// Set normalization gain for loud/compressed audio
analyzer.set_normalization_gain(0.5f);   // -6dB reduction

// Set tuning reference frequency (default: 440 Hz)
// Use when audio has non-standard tuning
analyzer.set_tuning_ref_hz(466.16f);     // 1 semitone sharp
```

### Query Methods

```cpp
// Total frames processed
int count = analyzer.frame_count();

// Current time position (seconds)
float time = analyzer.current_time();

// Get sample rate
int sr = analyzer.config().sample_rate;
```

