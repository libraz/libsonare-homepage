# C++ API Reference

API reference for the libsonare C++ interface.

## Overview

libsonare provides audio analysis, metering, feature extraction, editing DSP, realtime streaming, mastering, and mixing components for C++ applications. `sonare.h` is the broad analysis/feature umbrella; mastering, mixing, engine, graph, and editing modules also have focused headers when you want to include only one subsystem.

## What You Will Learn

By the end of this page you should be able to:

- choose between quick helpers, `MusicAnalyzer`, `StreamAnalyzer`, module headers, and the C ABI;
- understand which C++ entry points back each language binding;
- find the right struct or class for audio loading, analysis, streaming frames, mastering, mixing, and FFI;
- use this page as a reference after reading the higher-level task guide for your feature.

| Component | Purpose | Key Classes/Functions |
|-----------|---------|----------------------|
| **Core** | Audio I/O and signal processing | `Audio`, `Spectrogram` |
| **Quick API** | Simple one-line analysis and room-acoustic entry points | `quick::detect_bpm()`, `quick::detect_key()`, `quick::detect_beats()`, `quick::detect_acoustic()` |
| **Geometric room acoustics** | Equivalent-room estimation, RIR synthesis, and room-character morphing | `estimate_room()`, `acoustic::synthesize_rir()`, `effects::acoustic::room_morph()` |
| **MusicAnalyzer** | Full music analysis with callbacks | `MusicAnalyzer`, `AnalysisResult` |
| **Streaming** | Block-by-block MIR frames and estimates that update over time | `StreamAnalyzer`, `StreamConfig`, `FrameBuffer` |
| **Features** | Low-level feature extraction and inverse feature reconstruction | `MelSpectrogram`, `Chroma`, `cqt()`, `vqt()`, `mel_to_audio()` |
| **Effects / editing** | Audio processing and small editing building blocks | `hpss()`, `time_stretch()`, `pitch_shift()`, pitch editor / voice changer modules |
| **Mastering** | Presets, chains, named processors, assistant/profile JSON | `mastering::MasteringChain`, `mastering::api::*` |
| **Mixing / engine** | Scene-based mixer and DAW-style realtime transport | `mixing::api::Scene`, `mixing::MixerController`, `RealtimeEngine` |
| **C ABI** | Stable FFI API for bindings | `sonare_c.h` |

## Pick The Right C++ Surface

| Goal | Include / API |
|------|---------------|
| One-off BPM/key/beat/onset/acoustic checks | `#include <sonare.h>` and `sonare::quick::*` |
| Geometric room estimation, RIR synthesis, or room morphing | `#include <analysis/room_estimator.h>`, `#include <acoustic/rir_synthesizer.h>`, `#include <effects/acoustic/room_morph.h>` |
| Several music-analysis results from the same audio | `MusicAnalyzer`, so shared intermediates are reused |
| Live visualizer or estimates that update over time | `#include <streaming/stream_analyzer.h>` |
| Mastering presets or named processors | `src/mastering/api/*` headers; see [Mastering Processors](./mastering-processors.md) |
| Stem mixer / scene JSON | `src/mixing/api/scene.h`, `src/mixing/api/scene_json.cpp` concepts; see [Mixing Engine](./mixing.md) |
| Language binding or plugin boundary | `sonare_c.h` rather than C++ classes |

::: tip Terminology
New to audio analysis? See the [Glossary](/docs/glossary) for explanations of terms like BPM, STFT, Chroma, HPSS, and more.
:::

## Namespaces

All libsonare functionality is contained within the `sonare` namespace.

```cpp
#include <sonare.h>

using namespace sonare;
```

## Core Classes

### Audio

Audio buffer with shared ownership and zero-copy slicing.

#### Factory Methods

```cpp
// From raw sample buffer (copied)
static Audio Audio::from_buffer(const float* samples, size_t size, int sample_rate);

// From vector (moved)
static Audio Audio::from_vector(std::vector<float> samples, int sample_rate);

// From file (WAV/MP3 by default; FFmpeg formats when built with SONARE_WITH_FFMPEG)
// Throws SonareException on decode error
static Audio Audio::from_file(const std::string& path);

// From in-memory encoded audio bytes with the same format support as from_file()
// Throws SonareException on decode error
static Audio Audio::from_memory(const uint8_t* data, size_t size);
```

#### Properties

```cpp
const float* data() const;        // Pointer to samples
size_t size() const;              // Number of samples
int sample_rate() const;          // Sample rate in Hz
float duration() const;           // Duration in seconds
int channels() const;             // Always 1 (mono)
bool empty() const;               // True if no samples
```

#### Operations

```cpp
// Zero-copy slice by time
Audio slice(float start_time, float end_time = -1.0f) const;

// Zero-copy slice by sample index
Audio slice_samples(size_t start_sample, size_t end_sample = -1) const;

// Access sample
float operator[](size_t index) const;

// Iterator support
const float* begin() const;
const float* end() const;
```

::: tip Large File Handling
For very large files, prefer streaming or process in segments using `slice()` after loading.
:::

#### Example

```cpp
auto audio = sonare::Audio::from_file("song.mp3");
std::cout << "Duration: " << audio.duration() << "s\n";

// Zero-copy slicing
auto intro = audio.slice(0.0f, 30.0f);
auto chorus = audio.slice(60.0f, 90.0f);
```

### Spectrogram

Short-Time Fourier Transform (STFT) of audio signal.

```cpp
struct StftConfig {
  int n_fft = 2048;
  int hop_length = 512;
  int win_length = 0;  // 0 = n_fft
  WindowType window = WindowType::Hann;
  bool center = true;
  PadMode pad_mode = PadMode::Constant;
};

// Compute STFT
auto spec = Spectrogram::compute(audio, config);

// Properties
spec.n_bins();      // Frequency bins (n_fft/2 + 1)
spec.n_frames();    // Time frames
spec.n_fft();
spec.hop_length();
spec.sample_rate();

// Data access
spec.complex_view();  // [n_bins x n_frames]
spec.magnitude();     // Cached
spec.power();         // Cached
spec.to_db();         // Convert to dB

// Reconstruction
auto reconstructed = spec.to_audio();
```

::: warning Thread Safety
`Spectrogram` objects are **not thread-safe**. The cached `magnitude()` and `power()` results use lazy initialization. If you need to access the same `Spectrogram` from multiple threads, create separate copies or synchronize access externally.
:::

<SonareDemo id="stft-basics" />

## Quick API

Simple, single-shot functions for common analysis tasks. Use these when you want exactly one result (BPM, key, beats, downbeats, onsets, or room acoustics).

::: info When to use Quick API vs MusicAnalyzer
- **Quick API (`sonare::quick::...`)** — When you only need one result. Only the necessary stages run.
- **MusicAnalyzer** — When you need several results from the same audio (BPM + key + chords + sections). Intermediates (STFT, chroma, onset envelope) are shared so nothing is computed twice.
:::

```cpp
namespace sonare::quick {
  // BPM detection
  float detect_bpm(const float* samples, size_t length, int sample_rate);

  // Key detection
  Key detect_key(const float* samples, size_t length, int sample_rate);
  Key detect_key(const float* samples, size_t length, int sample_rate, const KeyConfig& config);
  std::vector<KeyCandidate> detect_key_candidates(const float* samples, size_t length, int sample_rate,
                                                  const KeyConfig& config = KeyConfig());

  // Beat times in seconds
  std::vector<float> detect_beats(const float* samples, size_t length, int sample_rate);

  // Downbeat times in seconds
  std::vector<float> detect_downbeats(const float* samples, size_t length, int sample_rate);

  // Onset times in seconds
  std::vector<float> detect_onsets(const float* samples, size_t length, int sample_rate);

  // All-in-one analysis
  AnalysisResult analyze(const float* samples, size_t length, int sample_rate);

  // Room acoustics
  AcousticParameters detect_acoustic(const float* samples, size_t length, int sample_rate);
  AcousticParameters analyze_impulse_response(const float* samples, size_t length, int sample_rate);
}
```

## Geometric Room Acoustics

These APIs estimate, synthesize, or apply a room model. They live in focused module headers and require builds with `BUILD_ACOUSTIC_SIM=ON` (the default source-build setting).

::: info Terms in this section
- **Equivalent room** is a practical room model inferred from audio. It is not exact measured geometry.
- **RIR** means room impulse response: samples that describe how a room reacts to a short sound.
- **DRR (direct-to-reverberant ratio)** compares the level of the direct sound against the reverberant tail, in dB. Higher means a drier, closer-sounding source.
- **Room morphing** is a creative room-character effect, not dereverberation.
:::

```cpp
#include <acoustic/rir_synthesizer.h>
#include <analysis/room_estimator.h>
#include <effects/acoustic/room_morph.h>

using namespace sonare;

acoustic::ShoeboxRoom room = acoustic::uniform_shoebox({7.0f, 5.0f, 3.0f}, 0.2f);
acoustic::SourceListener placement{{1.0f, 1.0f, 1.2f}, {5.0f, 4.0f, 1.7f}};
auto rir = acoustic::synthesize_rir(room, placement, 48000);
if (!rir.rir.empty()) {
  RoomEstimate estimate = estimate_room(rir.rir);
}

effects::acoustic::RoomMorphConfig morph_config;
morph_config.target = room;
morph_config.placement = placement;
morph_config.wet = 0.6f;
Audio morphed = effects::acoustic::room_morph(recording, morph_config);
```

The three calls cover different parts of the workflow:

- `estimate_room(...)` returns volume, representative dimensions, absorption bands, RT60 bands, DRR, and confidence.
- `synthesize_rir(...)` reports geometry problems through diagnostics. It returns an empty RIR when the source or listener placement is invalid.
- `room_morph(...)` renders the input with the target room character.

::: details Configuration details
`acoustic::RirSynthConfig` controls RIR generation:

- image-source order;
- Sabine/Eyring late-tail model;
- deterministic seed;
- maximum RIR length;
- early/late mixing time;
- crossfade width.

`RoomEstimateConfig` forwards analyzer settings through `AcousticConfig`. These include mode, octave-band count, minimum decay span, and noise-floor margin.

Aspect hints and `reference_absorption` define the equivalent-room prior.
:::

## MusicAnalyzer <Badge type="warning" text="Heavy" />

Facade class for comprehensive music analysis with lazy initialization.

::: tip Performance
All-in-one analysis is computationally intensive. For long audio files (>3 minutes), consider using progress callbacks to show progress, or analyze only relevant segments.
:::

```cpp
MusicAnalyzerConfig config;
config.bpm_min = 80.0f;
config.bpm_max = 180.0f;

MusicAnalyzer analyzer(audio, config);

// Set progress callback
analyzer.set_progress_callback([](float progress, const char* stage) {
  std::cout << stage << ": " << (progress * 100) << "%\n";
});

// Individual results
float bpm = analyzer.bpm();
Key key = analyzer.key();
auto beats = analyzer.beat_times();
auto chords = analyzer.chords();

// All-in-one analysis
auto result = analyzer.analyze();
```

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

## Feature Extraction

### MelSpectrogram <Badge type="info" text="Medium" />

```cpp
MelConfig config;
config.n_mels = 128;
config.n_fft = 2048;
config.hop_length = 512;

auto mel = MelSpectrogram::compute(audio, config);

// Power spectrum [n_mels x n_frames]
auto power = mel.power();

// Convert to dB
auto db = mel.to_db();

// MFCC
auto mfcc = mel.mfcc(13);  // 13 coefficients
```

### Chroma <Badge type="info" text="Medium" />

```cpp
ChromaConfig config;
config.n_chroma = 12;

auto chroma = Chroma::compute(audio, config);

// Features [12 x n_frames]
auto features = chroma.features();

// Mean energy per pitch class
auto energy = chroma.mean_energy();
```

### Spectral Features

```cpp
// Per-frame spectral centroid (Hz)
std::vector<float> spectral_centroid(const Spectrogram& spec, int sr);

// Per-frame spectral bandwidth (Hz)
std::vector<float> spectral_bandwidth(const Spectrogram& spec, int sr);

// Per-frame spectral rolloff (Hz)
std::vector<float> spectral_rolloff(const Spectrogram& spec, int sr, float roll_percent = 0.85f);

// Per-frame spectral flatness
std::vector<float> spectral_flatness(const Spectrogram& spec);

// Zero crossing rate
std::vector<float> zero_crossing_rate(const Audio& audio, int frame_length, int hop_length);

// RMS energy
std::vector<float> rms_energy(const Audio& audio, int frame_length, int hop_length);

// Spectral contrast (difference between peaks and valleys in frequency bands)
std::vector<float> spectral_contrast(const Spectrogram& spec, int sr, int n_bands = 6,
                                     float fmin = 200.0f, float quantile = 0.02f);
```

### Pitch Tracking <Badge type="info" text="Medium" />

```cpp
PitchConfig config;
config.frame_length = 2048;
config.hop_length = 512;
config.fmin = 65.0f;    // C2
config.fmax = 2093.0f;  // C7
config.threshold = 0.3f;

// YIN algorithm
PitchResult yin = yin_track(audio, config);

// pYIN algorithm (probabilistic YIN with HMM smoothing)
PitchResult pyin = pyin(audio, config);

// Access results
float median = pyin.median_f0();
float mean = pyin.mean_f0();
const std::vector<float>& f0 = pyin.f0;
const std::vector<bool>& voiced = pyin.voiced_flag;
```

### CQT / VQT <Badge type="info" text="Medium" />

Constant-Q Transform and Variable-Q Transform for music analysis.

```cpp
CqtConfig config;
config.fmin = 32.7f;         // C1
config.n_bins = 84;          // 7 octaves
config.bins_per_octave = 12; // Semitone resolution

auto cqt_result = cqt(audio, config);

// Access magnitude [n_bins x n_frames]
auto mag = cqt_result.magnitude();
auto power = cqt_result.power();

// Variable-Q Transform (with variable Q factor)
VqtConfig vqt_config;
vqt_config.gamma = 0.0f;  // 0 = CQT behavior
auto vqt_result = vqt(audio, vqt_config);
```

::: warning Thread Safety
`CqtResult` and `VqtResult` objects use lazy initialization for cached results. They are **not thread-safe** for concurrent access. Create separate copies for multi-threaded use.
:::

::: tip Griffin-Lim
Griffin-Lim is an iterative phase-reconstruction algorithm: it recovers a plausible waveform from a magnitude-only spectrum (which stores no phase) by transforming to the time domain and back over successive passes, refining the phase estimate each time. A phase vocoder instead tracks and manipulates the STFT phase directly.
:::

::: danger Deprecated Functions
The inverse transform functions `icqt()` and `ivqt()` are **deprecated** in the
current C++ headers. Prefer Griffin-Lim or phase-vocoder based reconstruction
paths for new code.

```cpp
// Deprecated - do not use in new code
[[deprecated("Use Griffin-Lim or phase vocoder for better reconstruction quality")]]
Audio icqt(const CqtResult& cqt_result, int length = 0);

[[deprecated("Use griffinlim_vqt or phase vocoder for better reconstruction quality")]]
Audio ivqt(const VqtResult& vqt_result, int length = 0);
```

**Migration:** `griffinlim_cqt` and `griffinlim_vqt` are declared in the same
`<feature/cqt.h>` / `<feature/vqt.h>` headers as `cqt()` and `vqt()`, so no extra
include is needed. For preview audio reconstruction, use these Griffin-Lim paths,
or keep phase information in your own STFT-domain pipeline when quality matters.

```cpp
const auto& cqt_magnitude = cqt_result.magnitude();
auto reconstructed = griffinlim_cqt(cqt_magnitude.data(), cqt_result.n_bins(),
                                    cqt_result.n_frames(), config,
                                    cqt_result.sample_rate());
auto reconstructed_vqt = griffinlim_vqt(vqt_result, vqt_result.sample_rate());
```
:::

## Effects

### HPSS <Badge type="warning" text="Heavy" />

::: tip Performance
HPSS requires STFT computation and median filtering. Processing time scales with audio duration.
:::

```cpp
HpssConfig config;
config.kernel_size_harmonic = 31;
config.kernel_size_percussive = 31;

auto result = hpss(audio, config);
// result.harmonic
// result.percussive

// Convenience functions
auto harm = harmonic(audio);
auto perc = percussive(audio);
```

### Time Stretch <Badge type="warning" text="Heavy" />

::: tip Performance
Uses phase vocoder algorithm. Processing time increases with audio duration.
:::

```cpp
// 0.5 = half speed, 2.0 = double speed
auto slow = time_stretch(audio, 0.5f);
auto fast = time_stretch(audio, 1.5f);
```

### Pitch Shift <Badge type="warning" text="Heavy" />

::: tip Performance
Combines time stretching and resampling. Processing time increases with audio duration.
:::

```cpp
// Semitones: +12 = one octave up
auto higher = pitch_shift(audio, 2.0f);
auto lower = pitch_shift(audio, -3.0f);
```

### Normalize & Audio Utilities

```cpp
// Peak normalization
auto normalized = normalize(audio, 0.0f);      // Target peak level in dB

// RMS normalization
auto rms_norm = normalize_rms(audio, -20.0f);  // Target RMS level in dB

// Silence trimming (absolute dBFS threshold)
auto trimmed = trim_absolute(audio, -60.0f);   // Threshold in dBFS

// Level measurement (metering/basic.h, namespace sonare::metering)
float peak = sonare::metering::peak_db(audio);  // Peak amplitude in dB
float rms = sonare::metering::rms_db(audio);    // RMS level in dB

// Gain application
auto louder = apply_gain(audio, 6.0f);   // +6 dB
auto quieter = apply_gain(audio, -3.0f); // -3 dB

// Fades
auto with_fade_in = fade_in(audio, 0.5f);   // 0.5 second fade in
auto with_fade_out = fade_out(audio, 1.0f); // 1.0 second fade out

// Find silence boundaries
auto [start, end] = detect_silence_boundaries(audio, -60.0f);
```

### librosa-Compatible Helpers

Each helper mirrors the corresponding `librosa`
function — see [librosa Compatibility](./librosa-compatibility.md) for the
full mapping.

::: tip What each helper is for
- **`preemphasis` / `deemphasis`** — classic one-tap IIR pre-processing for the waveform.
- **`trim` / `split`** — trim leading/trailing silence or split on silent gaps.
- **`frame` / `pad_center` / `fix_length` / `fix_frames`** — framing and size-alignment utilities for fixed-frame DSP.
- **`peak_pick` / `vector_normalize`** — peak detection on 1-D signals and vector-norm normalization.
- **`pcen`** — dynamic range compression for mel spectrograms.
- **`tonnetz`** — projects chroma into a 6-D harmonic space.
- **`tempogram` / `plp`** — time-varying tempo representation and dominant local pulse.
:::

```cpp
// Pre-emphasis / de-emphasis (librosa.effects.preemphasis / deemphasis)
auto pre   = preemphasis(audio, /*coef=*/0.97f);
auto deemp = deemphasis(audio, /*coef=*/0.97f);

// Silence trim / split (librosa.effects.trim / split) — buffer in, sample-index ranges out
TrimResult trimmed = trim(samples, /*top_db=*/60.0f);  // {audio, start_sample, end_sample}
auto intervals = split(samples, /*top_db=*/60.0f);     // std::vector<std::pair<int,int>>

// Frame / pad / length helpers (librosa.util.*)
auto frames = frame(samples, /*frame_length=*/2048, /*hop_length=*/512);
auto padded = pad_center(values, /*size=*/4096);
auto fixed  = fix_length(values, /*size=*/4096);
auto bounds = fix_frames(frame_indices, /*x_min=*/0, /*x_max=*/-1);

// Peak picking and vector normalize (librosa.util.peak_pick / normalize)
auto peaks  = peak_pick(onset_envelope, pre_max, post_max, pre_avg, post_avg, delta, wait);
auto normed = vector_normalize(values, /*norm_type=*/2);  // 0=inf, 1=L1, 2=L2, 3=power

// PCEN (librosa.pcen) — input is row-major [n_bins x n_frames]
auto pcen_out = pcen(mel, n_bins, n_frames, sample_rate, hop_length);

// Tonnetz / tempogram / PLP
auto tonnetz_out = tonnetz(chromagram, n_chroma, n_frames);
auto tempo_out   = tempogram(onset_env, sample_rate);
auto plp_out     = plp(onset_env, sample_rate);
```

## Types

### Key

```cpp
struct Key {
  PitchClass root;      // C=0, Cs=1, ..., B=11
  Mode mode;            // Major, Minor, Dorian, Phrygian, Lydian, Mixolydian, Locrian
  float confidence;     // 0.0 - 1.0

  std::string to_string() const;  // "C major"
  std::string to_short_string() const; // "C", "Am"
};
```

### Chord

```cpp
struct Chord {
  PitchClass root;
  ChordQuality quality;  // Major, Minor, Dim, Aug, 7th, etc.
  float start;           // seconds
  float end;             // seconds
  float confidence;
  PitchClass bass;        // Bass pitch class for inversion notation

  std::string to_string() const;  // "C", "Am", "G7"
};
```

### Section

```cpp
struct Section {
  SectionType type;    // Intro, Verse, Chorus, etc.
  float start;
  float end;
  float energy_level;
  float confidence;

  std::string type_string() const;
  float duration() const;
};
```

### AnalysisResult

```cpp
struct AnalysisResult {
  float bpm;
  float bpm_confidence;
  Key key;
  TimeSignature time_signature;
  std::vector<Beat> beats;
  std::vector<Chord> chords;
  std::vector<Section> sections;
  Timbre timbre;
  Dynamics dynamics;
  RhythmFeatures rhythm;
  MelodyContour melody;
  std::string form;  // "IABABCO"
};
```

The two perceptual sub-structs are expanded below; `RhythmFeatures` and
`MelodyContour` follow the same by-value pattern.

### Timbre

Perceptual sound-color descriptors, each normalized to `[0, 1]`.

```cpp
struct Timbre {
  float brightness;  // high = bright / harsh
  float warmth;      // high = warm / full
  float density;     // high = rich / complex
  float roughness;   // high = rough / harsh
  float complexity;  // high = harmonically complex
};
```

### Dynamics

Loudness and dynamic-range descriptors (levels in dB).

```cpp
struct Dynamics {
  float dynamic_range_db;   // dynamic range (dB)
  float peak_db;            // peak level (dB)
  float rms_db;             // RMS level (dB)
  float crest_factor;       // peak-to-RMS ratio
  float loudness_range_db;  // loudness range / LRA (dB)
  bool  is_compressed;      // true if the audio appears heavily compressed
};
```

## Enums

```cpp
enum class PitchClass {
  C = 0, Cs, D, Ds, E, F, Fs, G, Gs, A, As, B
};

enum class Mode {
  Major, Minor, Dorian, Phrygian, Lydian, Mixolydian, Locrian
};

enum class ChordQuality {
  Major, Minor, Diminished, Augmented,
  Dominant7, Major7, Minor7, Sus2, Sus4, Unknown,
  Add9, MinorAdd9, Dim7, HalfDim7, Major9, Dominant9, Sus2Add4
};

enum class SectionType {
  Intro, Verse, PreChorus, Chorus, Bridge, Instrumental, Outro, Unknown
};

enum class WindowType {
  Hann, Hamming, Blackman, Rectangular
};
```

## Unit Conversion

```cpp
// Hz <-> Mel (Slaney formula)
float hz_to_mel(float hz);
float mel_to_hz(float mel);

// Hz <-> MIDI note number
float hz_to_midi(float hz);      // A4 = 440Hz = 69
float midi_to_hz(float midi);

// Hz <-> Note name
std::string hz_to_note(float hz);    // "A4", "C#5"
float note_to_hz(const std::string& note);

// Time <-> Frames
float frames_to_time(int frames, int sr, int hop_length);
int time_to_frames(float time, int sr, int hop_length);

// Frames <-> Samples (librosa.frames_to_samples / samples_to_frames)
int frames_to_samples(int frames, int hop_length, int n_fft = 0);
int samples_to_frames(int samples, int hop_length, int n_fft = 0);

// dB conversions (librosa.power_to_db / amplitude_to_db / inverses)
std::vector<float> power_to_db(const std::vector<float>& values,
                               float ref = 1.0f, float amin = 1e-10f, float top_db = 80.0f);
std::vector<float> amplitude_to_db(const std::vector<float>& values,
                                   float ref = 1.0f, float amin = 1e-5f, float top_db = 80.0f);
std::vector<float> db_to_power(const std::vector<float>& values, float ref = 1.0f);
std::vector<float> db_to_amplitude(const std::vector<float>& values, float ref = 1.0f);
```

## Mixing Engine

The C++ core includes the mixing engine used by the C, Python, Node, and WASM bindings. The main building blocks are channel strips, buses, sends, FX buses, VCA groups, automation lanes, meter snapshots, goniometer buffers, scene presets, and offline stereo rendering.

```cpp
#include <mixing/channel_strip.h>
#include <mixing/api/presets.h>

auto scene = sonare::mixing::api::scene_preset(
  sonare::mixing::api::scene_preset_from_string("vocalReverbSend")
);
auto json = sonare::mixing::api::scene_to_json(scene);

sonare::mixing::ChannelStrip strip;
strip.set_input_trim_db(3.0f);
strip.set_fader_db(-6.0f);
strip.set_pan(-0.15f);
strip.set_width(1.1f);
strip.prepare(48000.0, 512);
```

For cross-runtime examples and scene-level guidance, see [Mixing Engine](./mixing.md).

## Mastering

The high-level mastering API lives in `sonare::mastering::api`. `master_audio_mono` / `master_audio_stereo` apply a built-in `Preset` (optionally with flat dot-notation overrides) and return a chain result; the `preset_*` helpers enumerate and resolve preset identifiers.

```cpp
#include <mastering/api/presets.h>

namespace api = sonare::mastering::api;

// 25 built-in presets: Pop, EDM, Acoustic, HipHop, AIMusic, Speech, Streaming,
// YouTube, Broadcast, Podcast, Audiobook, Cinema, JPop, Ambient, Lofi, Classical,
// DrumAndBass, Techno, Metal, Trap, RnB, Jazz, KPop, Trance, GameOst.
std::vector<std::string> names = api::preset_names();
api::Preset preset = api::preset_from_string("aiMusic");

// Optional flat overrides (same dot-notation as the chain config params)
api::Param overrides[] = {{"loudness.targetLufs", -13.0f}};
// The limiter also accepts "maximizer.truePeakLimiter.releaseMs" and
// "maximizer.truePeakLimiter.applyGainAtInputRate" as direct overrides.

api::MonoChainResult result = api::master_audio_mono(
  preset, samples.data(), samples.size(), sample_rate, overrides, 1);
// result carries the rendered samples plus per-stage metrics.

// Stereo equivalent:
// api::master_audio_stereo(preset, left, right, length, sample_rate, overrides, 1);
```

Two helper calls are useful when working with mastering presets:

| Helper | Use it for |
|--------|------------|
| `preset_to_string(Preset)` | Getting the canonical preset identifier. It does not throw; invalid values return `"unknown"`. |
| `preset_config(Preset)` | Getting a mutable `MasteringChainConfig` that you can inspect or tweak before running a chain. |

For the named processor registry and the assistant/profile JSON helpers, see [Mastering Processors](./mastering-processors.md) and [Mastering Assistant](./mastering-assistant.md).

At the C ABI level, `SonareMasteringConfig` exposes the same limiter controls as appended fields: `release_ms` and `apply_gain_at_input_rate`. Callers should still pass real `target_lufs` and `ceiling_db` values; leaving the appended limiter fields at zero preserves prior behavior (`release_ms == 0` keeps the 50 ms default and `apply_gain_at_input_rate == 0` keeps input-rate staging off).

## C API

For FFI integration. Two parallel entry-point styles are provided: handle-based (takes a `SonareAudio*`) and sample-based (takes a raw `float*` buffer).

```c
#include <sonare_c.h>

// Audio handle
SonareError sonare_audio_from_buffer(const float* data, size_t length, int sample_rate,
                                     SonareAudio** out);
SonareError sonare_audio_from_memory(const uint8_t* data, size_t length, SonareAudio** out);
SonareError sonare_audio_from_file(const char* path, SonareAudio** out);  // Not available in WASM
void        sonare_audio_free(SonareAudio* audio);
const float* sonare_audio_data(const SonareAudio* audio);
size_t      sonare_audio_length(const SonareAudio* audio);
int         sonare_audio_sample_rate(const SonareAudio* audio);
float       sonare_audio_duration(const SonareAudio* audio);

// Handle-based analysis (avoids copying samples across the FFI boundary)
SonareError sonare_audio_detect_bpm(const SonareAudio* audio, float* out_bpm);
SonareError sonare_audio_detect_key(const SonareAudio* audio, SonareKey* out_key);
SonareError sonare_audio_detect_beats(const SonareAudio* audio,
                                      float** out_times, size_t* out_count);
SonareError sonare_audio_detect_downbeats(const SonareAudio* audio,
                                          float** out_times, size_t* out_count);
SonareError sonare_audio_detect_onsets(const SonareAudio* audio,
                                       float** out_times, size_t* out_count);
SonareError sonare_audio_analyze(const SonareAudio* audio, SonareAnalysisResult* out);

// Sample-based analysis (use when you already have a raw float buffer)
SonareError sonare_detect_bpm(const float* samples, size_t length, int sample_rate,
                              float* out_bpm);
SonareError sonare_detect_key(const float* samples, size_t length, int sample_rate,
                              SonareKey* out_key);
SonareError sonare_detect_beats(const float* samples, size_t length, int sample_rate,
                                float** out_times, size_t* out_count);
SonareError sonare_detect_downbeats(const float* samples, size_t length, int sample_rate,
                                    float** out_times, size_t* out_count);
SonareError sonare_detect_onsets(const float* samples, size_t length, int sample_rate,
                                 float** out_times, size_t* out_count);
SonareError sonare_analyze(const float* samples, size_t length, int sample_rate,
                           SonareAnalysisResult* out);

// Full-result analysis serialized to a camelCase JSON object (chords, sections,
// timbre, dynamics, rhythm, melody, form, per-beat strength). *out_json is
// heap-allocated; release it with sonare_free_string.
SonareError sonare_analyze_json(const float* samples, size_t length, int sample_rate,
                                char** out_json);
SonareError sonare_analyze_json_with_progress(const float* samples, size_t length, int sample_rate,
                                              SonareAnalyzeProgressCallback callback,
                                              void* user_data, char** out_json);

// Memory management
void sonare_free_floats(float* ptr);
void sonare_free_ints(int* ptr);
void sonare_free_string(char* ptr);             // heap char* from *_json and other string-returning C ABI calls
void sonare_free_key_candidates(SonareKeyCandidate* ptr);  // arrays from sonare_detect_key_candidates*
void sonare_free_result(SonareAnalysisResult* result);

// Utility
const char* sonare_error_message(SonareError error);
const char* sonare_last_error_message(void);    // thread-local detail for the last failure
const char* sonare_last_warning_message(void);  // thread-local non-fatal warnings (e.g. scene-insert params no processor read)
const char* sonare_version(void);
uint32_t    sonare_abi_version(void);            // packed aggregate ABI version; compare against compile-time SONARE_ABI_VERSION to detect a struct-layout/contract mismatch before exchanging POD across the boundary
int         sonare_has_ffmpeg_support(void);     // 1 if the loaded build can decode FFmpeg-only formats (M4A/AAC/FLAC/OGG), 0 otherwise
```

Every C ABI call that returns `SonareError` clears the thread-local detail on entry, preventing a stale message from leaking into a later result. Diagnostic accessors and void cleanup helpers deliberately do not clear it, so callers may release partial output before reading `sonare_last_error_message()`.

`SonareKey` carries only `root`, `mode`, and `confidence`. There is no `name` field on the struct — format the human-readable name yourself from the enum values.

`SonareAnalysisResult` is the compact C ABI result: BPM, BPM confidence, key,
time signature, and beat times. For the all-in-one analysis (chords, sections, timbre,
dynamics, rhythm, melody, and form, with per-beat strength), call
`sonare_analyze_json` (or `sonare_analyze_json_with_progress` for per-stage
progress), which returns a camelCase JSON string you free with
`sonare_free_string`.

Several helper families also have sample-based C ABI entry points:

| Family | Examples |
|--------|----------|
| Effects | `sonare_hpss`, `sonare_time_stretch`, `sonare_phase_vocoder`, `sonare_pitch_shift`, `sonare_spectral_edit`, `sonare_normalize`, `sonare_trim` |
| Features | `sonare_stft`, `sonare_mel_spectrogram`, `sonare_mfcc`, `sonare_mfcc_ex`, `sonare_chroma`, `sonare_chroma_cqt`, `sonare_spectral_*`, `sonare_pitch_yin`, `sonare_pitch_pyin` |
| Geometric room acoustics | `sonare_synthesize_rir`, `sonare_estimate_room`, `sonare_room_morph` |
| Conversions and resampling | See `src/sonare_c.h` for the full list |

`sonare_chroma_cqt` computes a constant-Q chromagram (`librosa.feature.chroma_cqt` equivalent) alongside the note-activation `sonare_chroma`. The explicit-range MFCC entry point `sonare_mfcc_ex` (fmin/fmax/htk) also carries a trailing cepstral `lifter` argument (`0` disables liftering).

Project editing lives in `sonare_c_project.h`. `sonare_project_set_clip_loop(project, clip_id, loop_mode, loop_length_ppq, loop_crossfade_ppq)` accepts the optional equal-power seam crossfade as the final argument. It must be finite and non-negative; `0` keeps a hard loop. The engine clamps it to the available pre-roll and half the loop, and ignores it under warp.

The librosa-parity helpers are also exposed through the C API:

| Category | Helpers |
|----------|---------|
| Emphasis and silence | `sonare_preemphasis`, `sonare_deemphasis`, `sonare_trim_silence`, `sonare_split_silence` |
| Framing and padding | `sonare_frame_signal`, `sonare_pad_center`, `sonare_fix_length`, `sonare_fix_frames` |
| Picking and normalization | `sonare_peak_pick`, `sonare_vector_normalize` |
| Feature utilities | `sonare_pcen`, `sonare_tonnetz`, `sonare_tempogram`, `sonare_plp` |
| dB conversions | `sonare_power_to_db`, `sonare_amplitude_to_db`, `sonare_db_to_power`, `sonare_db_to_amplitude` |
| Time/frame conversion | `sonare_frames_to_samples`, `sonare_samples_to_frames` |
| Decomposition / denoising | `sonare_decompose`, `sonare_decompose_with_init` (init `"random"`/`"nndsvd"`), `sonare_nn_filter` |

The current C ABI is split across focused headers. Use this index when a symbol is not in the compact examples above:

| Header | Surface |
|--------|---------|
| `sonare_c_types.h` | Audio handles, compact analysis, key candidates, downbeats, engine lane/bus/send structs (`SonareEngineTrackLane`, `SonareEngineBus`, `SonareEngineTrackSend`) and the `SonareChannelLayout` enum, error/version/FFmpeg helpers |
| `sonare_c_project.h` | Headless project/arrangement lifecycle, track/clip counts and editing (`sonare_project_clip_count`), MIDI events and MIDI-FX (`sonare_project_set_midi_events`, `set_midi_fx`, `bake_midi_fx`), compile/bounce (incl. `bounce_with_builtin_instruments`/`bounce_with_synth_instruments`), warp maps, loop-recording takes and comp segments, NativeSynth and SoundFont/SF2 instrument bindings, assist sidecar, chord/key annotations, `SONARE_PROJECT_ABI_VERSION` |
| `sonare_c_features.h` | Focused analysis, STFT/mel/MFCC/chroma, inverse features, CQT/VQT, pitch, tempogram/PLP, LUFS |
| `sonare_c_effects.h` | HPSS/editing DSP, region-based spectral editing (`sonare_spectral_edit`, modes GAIN/ATTENUATE/MUTE/HEAL), realtime voice changer, realtime engine, decomposition/remix helpers |
| `sonare_c_acoustic.h` | RIR synthesis from room geometry, equivalent-room estimation, offline room-character morphing, `SONARE_ACOUSTIC_ABI_VERSION` |
| `sonare_c_metering.h` | Peak/RMS/crest/DC/true peak, clipping, dynamic range, stereo correlation/width, vectorscope, phase scope, spectrum, multi-channel interleaved LUFS (`sonare_lufs_interleaved`) and EBU R128 loudness range (`sonare_ebur128_loudness_range`) |
| `sonare_c_mastering.h` | Presets, full chains, progress callbacks, named processors and the machine-readable processor catalog, assistant/profile/preview JSON, streaming mastering chain with latency and realized-stage inspection (`sonare_streaming_mastering_chain_stage_names`), streaming EQ, repair/dynamics one-shot helpers |
| `sonare_c_mixing.h` | Channel strip controls, sends, buses, VCA groups, automation, meters, goniometer, scene presets |
| `sonare_c_streaming.h` | `StreamAnalyzer`, bounded unread output (`max_pending_frames`), compact frame reads, pending/drop-aware updating stats, tuning/normalization controls |

For room acoustics in the C ABI:

- `SonareRirSynthConfig` covers geometry, absorption, `ism_order`, `seed`, `max_seconds`, `mixing_time_ms`, `crossfade_ms`, and `late_model`.
- `SonareRoomEstimateConfig` covers aspect/absorption priors, `min_decay_db`, `noise_floor_margin_db`, and analyzer `mode`.
- Analyzer mode is one of `SONARE_ACOUSTIC_MODE_AUTO`, `SONARE_ACOUSTIC_MODE_BLIND`, or `SONARE_ACOUSTIC_MODE_IMPULSE_RESPONSE`.

For surround/multichannel engine buses in the C ABI:

- `SonareChannelLayout` enumerates the speaker bed: `SONARE_CHANNEL_LAYOUT_MONO` (0), `SONARE_CHANNEL_LAYOUT_STEREO` (1), `SONARE_CHANNEL_LAYOUT_5_1` (2), and `SONARE_CHANNEL_LAYOUT_7_1` (3). Values match `sonare::ChannelLayout` and are part of the ABI/JSON wire format.
- `SonareEngineBus.channel_layout` sets a bus's speaker bed (the master bus carries the project output layout; defaults to stereo). `SonareEngineTrackLane.source_channel_layout` is serialized as source metadata but does not yet make a multichannel lane input discrete.
- The realtime lane mixer pans each mono/stereo lane into a 5.1/7.1 destination from the strip's `surroundPan` position, sums buses plane by plane, and publishes per-plane (wide) meters. `azimuth`, `divergence`, and `lfe` affect placement; `elevation` and `distance` are reserved. See [realtime engine surround group buses](./realtime-engine.md#surround-group-buses-and-wide-meters).

For realtime insert automation and external MIDI in the C ABI:

- Track, master, and bus strips each have insert-bypass and realtime-safe parameter setters. Parameter names are the JSON keys reported by `sonare_mastering_insert_param_info`; an unsupported or non-realtime-safe name returns `SONARE_ERROR_INVALID_PARAMETER`.
- `sonare_engine_resolve_{track,master,bus}_insert_automation_id` converts an insert parameter name into the numeric id accepted by `sonare_engine_set_automation_lane`, `sonare_engine_set_parameter`, and `sonare_engine_set_parameter_smoothed`. `sonare_engine_set_param_smoothing_ms` changes the shared ramp time (20 ms by default; `0` makes changes immediate).
- `sonare_engine_push_midi_sysex` copies one complete SysEx frame, including `0xF0` and `0xF7`; its size must be 1–512 bytes.
- `sonare_engine_set_midi_destination_external` moves a destination out of the internal instrument rack and into the host-drained output queue. Up to 16 destinations may be external. Clock/transport forwarding is opt-in through `sonare_engine_set_external_midi_clock_enabled`; those messages use destination `0xFFFFFFFF`.
- On the host/control thread, call `sonare_engine_drain_external_midi` repeatedly until it returns zero events, then deliver each 1–3-byte MIDI 1.0 message to the device. `max_events` must be at least 3 because one queued UMP record can expand to three messages. Monitor `sonare_engine_external_midi_dropped_count` to detect a host that is draining too slowly. SysEx/Data and other UMP messages that cannot be lowered to MIDI 1.0 are not emitted by this drain API.

To classify processors in the C ABI, `sonare_mastering_processor_catalog()` returns a JSON array string `[{"id","kind","realtimeInsertable","stereoOnly","latencySamples","tailSamples","channelPolicy"}, ...]`, where `kind` is `realtime`/`offline`/`pair` and `realtimeInsertable` is true exactly for the ids in `sonare_mastering_insert_names()`. `latencySamples` and `tailSamples` are representative default-configuration probes (48 kHz / 512 samples); `tailSamples` is the audible decay length, and both are 0 for offline ids. `channelPolicy` tells a surround host how the mixer wraps the processor. The id universe is the union of `sonare_mastering_processor_names()`, the insert set, and `sonare_mastering_pair_processor_names()`, so hosts can filter a processor picker without hardcoding ids. The pointer is thread-local (do not free it or cache it across threads), mirroring `sonare_mastering_processor_names()`.

Realtime voice presets are exposed in C as `sonare_realtime_voice_changer_preset_names()`, `sonare_realtime_voice_changer_preset_json()`, and `sonare_realtime_voice_changer_validate_preset_json()`. The typed preset selector is the `SonareVoiceCharacterPreset` enum (`SONARE_VC_PRESET_NEUTRAL_MONITOR` = 0 through `SONARE_VC_PRESET_DARK_VILLAIN` = 5); `sonare_voice_character_preset_id(preset)` returns its canonical id string (NULL for unknown values), and the `SONARE_REALTIME_VOICE_CHANGER_PRESET_IDS` macro provides the newline-separated id list for compile-time binding generation. The native POD config ABI is `SONARE_VOICE_CHANGER_ABI_VERSION`; it is separate from the preset JSON `schemaVersion`.

## Error Handling

```cpp
class SonareException : public std::runtime_error {
public:
  explicit SonareException(ErrorCode code);
  SonareException(ErrorCode code, const std::string& message);
  ErrorCode code() const;
};

try {
  auto audio = Audio::from_file("nonexistent.mp3");
} catch (const SonareException& e) {
  if (e.code() == ErrorCode::FileNotFound) {
    // Handle file not found
  }
}
```
