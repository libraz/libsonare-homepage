# C++ API Reference

API reference for the libsonare C++ interface.

## Overview

libsonare provides audio analysis, metering, feature extraction, editing DSP, realtime streaming, mastering, and mixing components for C++ applications. `sonare.h` is the broad analysis/feature umbrella; mastering, mixing, engine, graph, and editing modules also have focused headers when you want to include only one subsystem. Block-by-block streaming is covered in [C++ Streaming API](./cpp-api-streaming.md); feature extraction, pitch tracking, and the core result types are covered in [C++ Analysis API](./cpp-api-analysis.md); audio effects, the mixing engine, editing helpers, and the C ABI are covered in [C++ Effects API](./cpp-api-effects.md).

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
| **Streaming** | Block-by-block MIR (music information retrieval) frames and estimates that update over time | `StreamAnalyzer`, `StreamConfig`, `FrameBuffer` |
| **Features** | Low-level feature extraction and inverse feature reconstruction | `MelSpectrogram`, `Chroma`, `cqt()`, `vqt()`, `mel_to_audio()` |
| **Effects / editing** | Audio processing and small editing building blocks | `hpss()`, `time_stretch()`, `pitch_shift()`, pitch editor / voice changer modules |
| **Mastering** | Presets, chains, named processors, assistant/profile JSON | `mastering::MasteringChain`, `mastering::api::*` |
| **Mixing / engine** | Scene-based mixer and DAW-style realtime transport | `mixing::api::Scene`, `mixing::ChannelStrip`, `mixing::FxBus`, `RealtimeEngine` |
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

### Build flags that gate part of this surface

Analysis, features, effects, and metering are always built. The subsystems below
are separate CMake options — all default to `ON` in a source build, but a trimmed
build can drop them, and every symbol they own disappears with them.

| Option | Gates |
|--------|-------|
| `BUILD_MASTERING` | `sonare::mastering::*`, the mastering C ABI |
| `BUILD_MIXING` | `sonare::mixing::*`, the mixer C ABI |
| `BUILD_MIXING_ASSISTANT` | the offline mixing assistant |
| `BUILD_GRAPH` | the routing-graph library |
| `BUILD_FX` | creative realtime FX processors, and the GS system effects the SoundFont player sends to |
| `BUILD_ACOUSTIC_SIM` | geometric room acoustics (RIR synthesis, room estimation, room morph) |
| `BUILD_VOICE_CHANGER` | realtime voice changer |
| `BUILD_PITCH_EDITOR` | scale quantization and note segmentation |
| `BUILD_ARRANGEMENT` | the MIDI and instrument subsystem (NativeSynth, the GM fallback bank, the SoundFont player) and the headless arrangement / DAW project (`sonare_c_project.h`) |
| `BUILD_ASSIST` | composition-assist seam (control/offline only) |

Some options are not independent, and the configure step resolves the conflict rather than failing. Each of these prints a status line, so a trim that did not take is visible in the configure output:

- `BUILD_MIXING_ASSISTANT` turns `BUILD_MIXING` back on.
- `BUILD_MIXING` turns `BUILD_MASTERING` and `BUILD_GRAPH` back on.
- `BUILD_VOICE_CHANGER` turns *itself* off when `BUILD_MASTERING` is off.
- `SONARE_WASM_ANALYSIS_ONLY` turns `BUILD_MIXING_ASSISTANT` off, so the analysis-only WebAssembly module does not carry the assistant.

The first two chain, and they are the ones that quietly defeat a trim: leaving `BUILD_MIXING_ASSISTANT` at its default `ON` pulls the mixer, the mastering library and the routing graph back in however many `OFF` flags you passed for them.

The C ABI always *exports* the project symbols; without `BUILD_ARRANGEMENT` they
return `SONARE_ERROR_NOT_SUPPORTED` and `sonare_project_abi_version()` returns 0.

`BUILD_PITCH_EDITOR` behaves the same way. With `-DBUILD_PITCH_EDITOR=OFF`,
`sonare_scale_quantize_midi`, `sonare_scale_correction_semitones`,
`sonare_scale_pitch_class_enabled` and `sonare_note_segments` are still exported
and answer `SONARE_ERROR_NOT_SUPPORTED`; their out-parameters are zeroed before
the check, so freeing a returned pointer is safe on that path. The library
configures and builds with the option off — the native CLI does not, because five
of its commands reach the pitch editor directly.

### C ABI versions

Every C-ABI header that declares flat POD structs owns a version macro guarding their exact size and member offsets: `SONARE_FEATURE_ABI_VERSION` (5, in `sonare_c_types.h`), `SONARE_PROJECT_ABI_VERSION` (2, `sonare_c_project.h`), `SONARE_VOICE_CHANGER_ABI_VERSION` (2, `sonare_c_voice_changer.h`) and `SONARE_ACOUSTIC_ABI_VERSION` (4, `sonare_c_acoustic.h`). `sonare_c.h` packs the four into `SONARE_ABI_VERSION` — feature in bits 0-7, project in 8-15, voice changer in 16-23, acoustic in 24-31 — and `sonare_abi_version()` returns the value the loaded library was compiled with. The realtime command queue is versioned apart from these through `sonare_engine_abi_version()` (currently 3), because it describes a SharedArrayBuffer record layout rather than a POD. A consumer that passes PODs across the boundary compares `sonare_abi_version()` against its own compile-time `SONARE_ABI_VERSION` once, before the first call, and refuses to continue on a mismatch: unequal values mean the two sides disagree on a struct layout, and the POD path would corrupt memory rather than fail. The JSON entry points tolerate layout drift and need no such gate. A version moves on any layout change to the structs it guards — the project version once per release that changes the layout — so equal numbers mean identical layout, and a field appended to a guarded struct is a bump, not an additive change. Which value each binding checks on load is on [Native Bindings](./native-bindings.md#abi-versions).

### Link targets

An installed libsonare exports one CMake target per subsystem plus an aggregate that links whatever the installation contains:

```cmake
find_package(sonare REQUIRED)
target_link_libraries(app PRIVATE sonare::sonare)
```

`sonare::sonare` is the safe default: an aggregate over every **static archive** the installation was built with, so you do not have to work out which archives your calls need or what order they go in. It deliberately excludes `sonare::shared`, the C-ABI shared artifact the FFI bindings load — that one already links every static archive itself, so pulling both into one link line would define each symbol twice.

For a narrower link line, name the archives directly — `sonare::core`, `sonare::rt`, `sonare::mastering`, `sonare::mixing`, `sonare::midi`, `sonare::engine`, and the rest of the subsystems above. Which of them exist depends on how the installation was configured, so guard on `if(TARGET sonare::mixing)` or on the `SONARE_WITH_*` variables the package config sets. Naming a subsystem as a component turns a missing one into a configure-time error instead of an undefined symbol at link time:

```cmake
find_package(sonare REQUIRED COMPONENTS midi)
```

::: warning A component is a target name, not an option name
Components map one-to-one onto the exported target names, which are the internal target names with the `sonare_` prefix stripped — not the `BUILD_*` options that gate them. `BUILD_ACOUSTIC_SIM` produces `sonare::acoustic`, so the component is `acoustic`; likewise `mixing_assistant`, `pitch_editor` and `voice_changer`. Asking for a component that does not exist under any spelling fails with "libsonare was installed without the '…' component", which reads the same as a genuinely absent subsystem.
:::

The alias names are identical in an `add_subdirectory()` build, so a link line does not encode how libsonare was obtained.

Two further properties of an installed build are worth knowing before you plan around it:

- **Eigen is not a usage requirement.** No installed header includes it, so a consumer needs nothing but a C++17 compiler and a resolvable threads library. The package config declares `Threads` — and FFmpeg, when the installation was built with it — and nothing else.
- **The vendored FFT archives install under prefixed file names**, `libsonare_kissfft.a` and `libsonare_pffft.a`, rather than claiming the generic names in your library directory. Their CMake target names are unchanged.

A `sonare.pc` is installed for the shared build, which is the configuration pkg-config can describe honestly; a static-only install does not get one.

Every exported target is exercised by a consumer gate that installs to a prefix, then configures and builds a separate consumer project against it, force-loading each archive whole against its own declared link interface. That is what catches a missing install rule or an incomplete link interface — neither is visible from inside the source tree, where every target links the whole set.

#### Linking only the built-in instruments

The synthesizer, the GM fallback bank, and the SoundFont player all live in `sonare::midi`. An application that renders MIDI to audio and never analyzes or masters — a player, a game, a MIDI-driven tool — can drop the production subsystems and link that one archive. `BUILD_TESTING` and `BUILD_CLI` both default to `ON`, so a trim that leaves them alone still compiles the test tree and the command-line tool:

```bash
cmake -B build -DCMAKE_BUILD_TYPE=Release \
  -DBUILD_ARRANGEMENT=ON \
  -DBUILD_TESTING=OFF -DBUILD_CLI=OFF \
  -DBUILD_MASTERING=OFF -DBUILD_MIXING=OFF -DBUILD_MIXING_ASSISTANT=OFF \
  -DBUILD_GRAPH=OFF -DBUILD_ACOUSTIC_SIM=OFF \
  -DBUILD_VOICE_CHANGER=OFF -DBUILD_ASSIST=OFF
cmake --build build --parallel
cmake --install build --prefix /your/prefix
```

```cmake
find_package(sonare REQUIRED COMPONENTS midi)
target_link_libraries(app PRIVATE sonare::midi)
```

```cpp
#include <midi/synth/native_synth.h>
#include <midi/synth/synth_presets.h>
#include <midi/ump.h>

using namespace sonare::midi;

const synth::SynthPreset* preset = synth::find_synth_preset("acoustic-piano");
synth::NativeSynth instrument(preset->config);
instrument.prepare(48000.0, 512);

MidiEvent note_on{};
note_on.ump = make_midi1_note_on(/*group=*/0, /*channel=*/0, /*note=*/60, /*velocity=*/100);
instrument.on_event(/*destination_id=*/0, note_on);

float* channels[2] = {left, right};
instrument.process(channels, 2, 512);
```

Installed headers resolve under two spellings: the bare in-tree path shown above, and `<sonare/cpp/midi/synth/native_synth.h>` through the include root.

Three limits are worth knowing before you plan around this:

- **Analysis is not optional.** Analysis, features, effects, and metering have no build flag, and `sonare::midi` links `sonare::core`, so that code is in the binary whether or not you call it. What a trim removes is mastering, mixing, room acoustics, and the voice changer.
- **`BUILD_ARRANGEMENT` is one switch for two things.** Turning it on for the instruments also builds the arrangement, MIR, and serialization archives. You do not have to link them, but they are compiled.
- **`BUILD_FX=OFF` makes the SoundFont player render dry.** The GS system effects — its reverb, chorus, and delay sends — are compiled out and the sends become no-ops. Keep `BUILD_FX=ON` unless you want that.

This trim is a C++ source-build option only. The npm package publishes an analysis-only bundle (see [Installation](./installation.md#wasm-package-subpaths)) but no instruments-only one, and the Python wheel is a single full build.

For what the instruments themselves can do, see [Built-in Instruments](./native-synth.md) and [SoundFont 2 Player](./soundfont-player.md).

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
For very large files, prefer streaming or process in segments using `slice()` after loading — `audio.slice(0.0f, 30.0f)` and `audio.slice(60.0f, 90.0f)` share the decoded buffer rather than copying it.
:::

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
- **RT60** is the reverberation time: how long a tail takes to decay by 60 dB.
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
effects::acoustic::RoomMorphResult morphed = effects::acoustic::room_morph(recording, morph_config);
// morphed.audio is the render; morphed.diagnostics lists what the target-RIR synthesis clamped.
```

The three calls cover different parts of the workflow:

- `estimate_room(...)` returns volume, representative dimensions, absorption bands, RT60 bands, DRR, and confidence.
- `synthesize_rir(...)` reports geometry problems through diagnostics. It returns an empty RIR when the source or listener placement is invalid.
- `room_morph(...)` renders the input with the target room character and returns a `RoomMorphResult`: the audio plus the same diagnostics `synthesize_rir(...)` raises, since the target RIR is built by the same code. An unusable configuration throws `ErrorCode::InvalidParameter` instead of reporting an error entry.

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

### Room morph through the C ABI

`sonare_room_morph` in `sonare_c_acoustic.h` takes the input samples, their sample rate and a `SonareRoomMorphConfig`, and hands back the morphed mono signal through an out-pointer pair. The diagnostics the target-room synthesis raised are not in the result: they travel on the thread-local structured channel, read after the call returns. Ownership and lifetime follow the code:

```c
float* out = NULL;
size_t out_length = 0;
SonareError err = sonare_room_morph(samples, length, sample_rate, &config, &out, &out_length);
if (err != SONARE_OK) return err;  // nothing was allocated; sonare_last_error_message() has the detail
for (size_t i = 0; i < sonare_last_diagnostic_count(); ++i) {
  const char* code = sonare_last_diagnostic_code(i);  // e.g. "acoustic.rir_length_clamped"
  // sonare_last_diagnostic_message(i) and sonare_last_diagnostic_severity(i) sit beside it
}
sonare_free_floats(out);
```

- `*out` is allocated by the library and released with `sonare_free_floats`. It holds `length` samples plus the target room's tail, at the input sample rate. An empty input yields `NULL` / `0`, which is safe to free; on a non-`SONARE_OK` return nothing was allocated.
- The diagnostic strings are owned by the library, never `NULL`, and valid until the next C ABI call on the same thread that records or clears a diagnostic — `sonare_room_morph` and `sonare_synthesize_rir` both clear the channel on entry, and the count reads `0` after any other call. Reading does not consume an entry, and there is nothing to free; copy the strings you keep.
- An index at or past the count returns `""` and `SONARE_DIAGNOSTIC_INFO`, so bound the loop by the count rather than by severity. Every entry a morph publishes is a recoverable clamp at `SONARE_DIAGNOSTIC_WARNING`; an unusable configuration is an error return, not an entry.
- `sonare_last_warning_message()` carries the same entries flattened into one `code: message; code: message` string. It is kept for callers written against it — the structured accessors are the form to branch on, because a message containing the separator cannot be split back out and the severity is not in the text.

### Air absorption in large rooms

For a large hall, the geometry-only RT60 estimate can overstate the high-frequency tail because it does not account for air loss over a long path. The C++ acoustic core can add the ISO 9613-1 atmospheric-absorption term to the Sabine/Eyring calculation. It is opt-in: omitting the last argument keeps the earlier geometry-only result exactly.

```cpp
#include <acoustic/late_reverb.h>

acoustic::AirAbsorption air;
air.temperature_c = 20.0f;
air.humidity_percent = 50.0f;

const auto rt60 = acoustic::shoebox_reverb_time(
    room, acoustic::ReverbModel::Eyring, &air);
// rt60.rt60_bands: air loss shortens the high bands most.
```

`AirAbsorption` defaults to 20 °C and 50% relative humidity. This lower-level C++ calculation is not part of the C ABI, Node, Python, or WASM shoebox helpers; those public helpers continue to use the geometry-only model.

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

// dB conversions (librosa.power_to_db / amplitude_to_db / inverses).
// Declared in <core/db_convert.h>, which <sonare.h> does not include.
std::vector<float> power_to_db(const std::vector<float>& values,
                               float ref = 1.0f, float amin = 1e-10f, float top_db = 80.0f);
std::vector<float> amplitude_to_db(const std::vector<float>& values,
                                   float ref = 1.0f, float amin = 1e-5f, float top_db = 80.0f);
std::vector<float> db_to_power(const std::vector<float>& values, float ref = 1.0f);
std::vector<float> db_to_amplitude(const std::vector<float>& values, float ref = 1.0f);
```

## Mastering

The high-level mastering API lives in `sonare::mastering::api`. `master_audio_mono` / `master_audio_stereo` apply a built-in `Preset` (optionally with flat dot-notation overrides) and return a chain result; the `preset_*` helpers enumerate and resolve preset identifiers.

```cpp
#include <mastering/api/presets.h>

namespace api = sonare::mastering::api;

// 30 built-in presets: Pop, EDM, Acoustic, HipHop, AIMusic, Speech, Streaming,
// YouTube, Broadcast, Podcast, Audiobook, Cinema, JPop, Ambient, Lofi, Classical,
// DrumAndBass, Techno, Metal, Trap, RnB, Jazz, KPop, Trance, GameOst, and the
// restoration set Vinyl, TapeHiss, FieldRecording, VoiceMemo, Shellac78.
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

### Stereo profiling, assistant, and preview

The profiling, assistant, and delivery-preview JSON helpers each have a stereo entry point that reads both channels, alongside a stereo crest-factor meter:

```c
#include <sonare/sonare_c_mastering.h>
#include <sonare/sonare_c_metering.h>

SonareError sonare_mastering_audio_profile_stereo(const float* left, const float* right,
                                                  size_t length, int sample_rate,
                                                  const SonareMasteringParam* params,
                                                  size_t param_count, char** json_out);
SonareError sonare_mastering_assistant_suggest_stereo(const float* left, const float* right,
                                                      size_t length, int sample_rate,
                                                      const SonareMasteringParam* params,
                                                      size_t param_count, char** json_out);
SonareError sonare_mastering_streaming_preview_stereo(const float* left, const float* right,
                                                      size_t length, int sample_rate,
                                                      const SonareStreamingPlatform* platforms,
                                                      size_t platform_count, char** json_out);
SonareError sonare_metering_crest_factor_db_stereo(const float* left, const float* right,
                                                   size_t length, int sample_rate, float* out_db);
```

`*json_out` is heap-allocated; release it with `sonare_free_string`, the same contract as the mono entry points. Pass `NULL` / `0` for `platforms` to use the built-in Spotify / Apple Music / YouTube list rather than an error.

Use the stereo forms whenever you have two channels. The mono entry points measure a `0.5 * (left + right)` downmix, which on decorrelated stereo material reads about 6 dB low — dragging integrated loudness, the normalization gain derived from it, and the ceiling-risk judgement down by the same amount. On a decorrelated pink-noise pair (48 kHz, 4 s) the downmix path reports -22.55 LUFS against -16.44 LUFS from the stereo path, a 6.11 dB gap that turns a Spotify `normalizationGainDb` of +2.44 into +8.55; a correlated pair differs by only the 3.01 dB downmix halving. Only the `loudness` block of the stereo profile is measured from both channels (integrated LUFS and LRA from the channel-summed program, true peak as the larger of the two); the spectral, dynamics, and tempo fields describe shape and timing rather than level, so they stay on the downmix and remain comparable with the mono call.

`sonare_metering_crest_factor_db_stereo` fixes the opposite error — it takes the peak across both channels and the RMS over both together, where a downmix cancels an out-of-phase pair, understates RMS, and so overstates crest factor. An inverted pair reads `11.64` dB through the stereo meter and `0.00` dB through the downmix.

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

## Where the sections went

| Section | Now on |
|---|---|
| StreamAnalyzer | [C++ Streaming API](./cpp-api-streaming.md) |
| Feature Extraction, Types | [C++ Analysis API](./cpp-api-analysis.md) |
| Effects, Mixing Engine, C API | [C++ Effects API](./cpp-api-effects.md) |
