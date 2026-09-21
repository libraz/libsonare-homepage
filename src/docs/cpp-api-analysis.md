---
title: C++ Analysis API
description: Feature extraction, pitch tracking, CQT/VQT, and the core analysis result types in the libsonare C++ interface.
---

# C++ Analysis API

Feature extraction functions and analysis result types for the libsonare C++ interface; see [C++ API Reference](./cpp-api.md) for the rest of the C++ surface.

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
config.threshold = 0.1f;

// YIN algorithm
PitchResult yin = yin_track(audio, config);

// pYIN algorithm (probabilistic YIN with HMM smoothing)
PitchResult pyin_result = pyin(audio, config);

// Access results
float median = pyin_result.median_f0();
float mean = pyin_result.mean_f0();
const std::vector<float>& f0 = pyin_result.f0;
const std::vector<bool>& voiced = pyin_result.voiced_flag;
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

### NNLS Chroma

NNLS chroma uses a configurable CQT hop length. The default is `512` samples;
set it on `NnlsChromaConfig::cqt` when matching another frame grid.

```cpp
NnlsChromaConfig nnls_config;
nnls_config.cqt.hop_length = 512;
nnls_config.enable_stft_blend = true;
auto nnls_result = nnls_chroma(audio, nnls_config);
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
  std::vector<BpmCandidateHypothesis> bpm_candidates;
  Key key;
  TimeSignature time_signature;
  std::vector<TimeSignature> time_signature_candidates;
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

