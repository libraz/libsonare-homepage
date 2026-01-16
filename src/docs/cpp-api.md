# C++ API Reference

Complete API reference for libsonare C++ interface.

## Overview

libsonare provides comprehensive audio analysis for C++ applications:

| Component | Purpose | Key Classes/Functions |
|-----------|---------|----------------------|
| **Core** | Audio I/O and signal processing | `Audio`, `Spectrogram` |
| **Quick API** | Simple one-line analysis | `detect_bpm()`, `detect_key()`, `analyze()` |
| **MusicAnalyzer** | Full analysis with callbacks | `MusicAnalyzer`, `AnalysisResult` |
| **Features** | Low-level feature extraction | `MelSpectrogram`, `Chroma`, spectral functions |
| **Effects** | Audio processing | `hpss()`, `time_stretch()`, `pitch_shift()` |

::: tip Terminology
New to audio analysis? See the [Glossary](/docs/glossary) for explanations of terms like BPM, STFT, Chroma, HPSS, and more.
:::

## Namespaces

All libsonare functionality is contained within the `sonare` namespace.

```cpp
#include <sonare/sonare.h>

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

// From file (WAV, MP3)
static Audio Audio::from_file(const std::string& path);
static Audio Audio::from_file(const std::string& path, const AudioLoadOptions& options);

// From memory buffer
static Audio Audio::from_memory(const uint8_t* data, size_t size);
static Audio Audio::from_memory(const uint8_t* data, size_t size, const AudioLoadOptions& options);
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

#### AudioLoadOptions

Configuration for loading audio files with resource limits.

```cpp
struct AudioLoadOptions {
  size_t max_file_size = 500 * 1024 * 1024;  // 500 MB default
  int target_sample_rate = 0;                 // 0 = keep original
  bool normalize = false;                     // Peak normalize on load
};
```

::: tip Large File Handling
For very large files, set `max_file_size` appropriately or process in segments using `slice()`.
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

## Quick API

Simple functions for common analysis tasks.

```cpp
namespace sonare::quick {
  // BPM detection (±2 BPM accuracy)
  float detect_bpm(const float* samples, size_t length, int sample_rate);

  // Key detection
  Key detect_key(const float* samples, size_t length, int sample_rate);

  // Beat times in seconds
  std::vector<float> detect_beats(const float* samples, size_t length, int sample_rate);

  // Onset times in seconds
  std::vector<float> detect_onsets(const float* samples, size_t length, int sample_rate);

  // Full analysis
  AnalysisResult analyze(const float* samples, size_t length, int sample_rate);
}
```

## MusicAnalyzer <Badge type="warning" text="Heavy" />

Facade class for comprehensive music analysis with lazy initialization.

::: tip Performance
Full analysis is computationally intensive. For long audio files (>3 minutes), consider using progress callbacks to show progress, or analyze only relevant segments.
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

// Full analysis
auto result = analyzer.analyze();
```

## StreamAnalyzer <Badge type="tip" text="Real-time" />

Real-time streaming audio analyzer for visualizations and live monitoring.

::: info Batch vs Streaming
Use `MusicAnalyzer` for full analysis of pre-recorded files. Use `StreamAnalyzer` for real-time processing with low latency.
:::

### Configuration

```cpp
struct StreamConfig {
  int sample_rate = 44100;
  int n_fft = 2048;
  int hop_length = 512;
  WindowType window = WindowType::Hann;

  // Feature flags
  bool compute_magnitude = true;
  bool compute_mel = true;
  bool compute_chroma = true;
  bool compute_onset = true;
  bool compute_spectral = true;

  // Mel configuration
  int n_mels = 128;
  float fmin = 0.0f;
  float fmax = 0.0f;  // 0 = sr/2

  // Output throttling
  int emit_every_n_frames = 1;  // 4 = ~60fps at 44100Hz

  // Progressive estimation intervals
  float key_update_interval_sec = 5.0f;
  float bpm_update_interval_sec = 10.0f;
};
```

### Basic Usage

```cpp
#include <sonare/streaming/stream_analyzer.h>

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
  std::vector<float> chroma;     // [12]

  // Scalar features
  float spectral_centroid;
  float spectral_flatness;
  float rms_energy;

  // Onset detection (1-frame lag)
  float onset_strength;
  bool onset_valid;  // false for first frame
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
// buffer.chroma - [n_frames * 12]
// buffer.onset_strength - [n_frames]
// buffer.rms_energy - [n_frames]
```

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

## Feature Extraction

### MelSpectrogram <Badge type="info" text="Medium" />

```cpp
MelConfig config;
config.n_mels = 128;
config.stft.n_fft = 2048;
config.stft.hop_length = 512;

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
std::vector<float> spectral_rolloff(const Spectrogram& spec, int sr, float percent = 0.85f);

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

::: danger Deprecated Functions
The inverse transform functions `icqt()` and `ivqt()` are **deprecated** and will be removed in a future version.

```cpp
// Deprecated - do not use
[[deprecated("Use Griffin-Lim reconstruction instead")]]
Audio icqt(const CqtResult& cqt);

[[deprecated("Use Griffin-Lim reconstruction instead")]]
Audio ivqt(const VqtResult& vqt);
```

**Migration:** For audio reconstruction from CQT/VQT, use the Griffin-Lim algorithm with STFT instead:
```cpp
// Recommended approach
auto spec = Spectrogram::compute(audio, stft_config);
// ... modify magnitude ...
auto reconstructed = griffin_lim(modified_magnitude, stft_config);
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

// Silence trimming
auto trimmed = trim(audio, -60.0f);            // Threshold in dB

// Level measurement
float peak = peak_db(audio);  // Peak amplitude in dB
float rms = rms_db(audio);    // RMS level in dB

// Gain application
auto louder = apply_gain(audio, 6.0f);   // +6 dB
auto quieter = apply_gain(audio, -3.0f); // -3 dB

// Fades
auto with_fade_in = fade_in(audio, 0.5f);   // 0.5 second fade in
auto with_fade_out = fade_out(audio, 1.0f); // 1.0 second fade out

// Find silence boundaries
auto [start, end] = detect_silence_boundaries(audio, -60.0f);
```

## Types

### Key

```cpp
struct Key {
  PitchClass root;      // C=0, Cs=1, ..., B=11
  Mode mode;            // Major, Minor
  float confidence;     // 0.0 - 1.0

  std::string to_string() const;  // "C major"
  std::string short_name() const; // "C", "Am"
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

  std::string to_string() const;
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
  std::string form;  // "IABABCO"
};
```

## Enums

```cpp
enum class PitchClass {
  C = 0, Cs, D, Ds, E, F, Fs, G, Gs, A, As, B
};

enum class Mode { Major, Minor };

enum class ChordQuality {
  Major, Minor, Diminished, Augmented,
  Dominant7, Major7, Minor7, Sus2, Sus4
};

enum class SectionType {
  Intro, Verse, PreChorus, Chorus, Bridge, Instrumental, Outro
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
```

## C API

For FFI integration.

```c
#include <sonare_c.h>

// Audio
SonareError sonare_audio_from_buffer(const float* data, size_t len, int sr, SonareAudio** out);
SonareError sonare_audio_from_file(const char* path, SonareAudio** out);
void sonare_audio_free(SonareAudio* audio);

// Analysis
SonareError sonare_detect_bpm(const SonareAudio* audio, float* out_bpm, float* out_confidence);
SonareError sonare_detect_key(const SonareAudio* audio, SonareKey* out_key);
SonareError sonare_detect_beats(const SonareAudio* audio, float** out_times, size_t* out_count);
SonareError sonare_analyze(const SonareAudio* audio, SonareAnalysisResult* out);

// Memory management
void sonare_free_floats(float* ptr);
void sonare_free_result(SonareAnalysisResult* result);

// Utility
const char* sonare_error_message(SonareError error);
const char* sonare_version(void);
```

## Error Handling

```cpp
class SonareException : public std::exception {
public:
  ErrorCode code() const;
  const char* what() const noexcept override;
};

try {
  auto audio = Audio::from_file("nonexistent.mp3");
} catch (const SonareException& e) {
  if (e.code() == ErrorCode::FileNotFound) {
    // Handle file not found
  }
}
```
