# Architecture

This document describes the internal architecture of libsonare.

Read this page once you are comfortable with the [Getting Started guide](./getting-started.md) and your language's runtime page. It is an internal map for people extending libsonare or wiring it into a larger system, not a tutorial — if you only need to call an API, start with [Getting Started](./getting-started.md). It shows how public APIs connect to the C++ core.

::: info How to read the layers
The outer API layers are what apps call. The core and feature layers are where reusable signal-processing work happens. Bindings should stay thin: they translate language shapes into the same C++ behavior rather than reimplementing DSP.
:::

## What You Will Learn

By the end of this page you should be able to:

- trace a public call from WASM, C, quick API, or `sonare.h` into analysis, streaming, effects, mastering, mixing, and engine modules;
- identify which source directories own each subsystem;
- understand where shared DSP, feature extraction, realtime processing, and language bindings meet;
- decide whether a change belongs in a core module, a language binding, a demo component, or documentation.

## Module Overview

The layers below run top to bottom: the API layer is what apps call, and every
call eventually funnels down into the shared `Spectrogram`/`FFT` core so no
analyzer, effect, or mastering processor recomputes the same transform twice.
Groups mirror the `src/` subdirectories from the Directory Structure section
below; nodes inside a group are representative members, not an exhaustive
class list — see the Page Map for where each subsystem's full API is documented.

<FlowDiagram
  title="Module Overview"
  direction="TB"
  :nodes="[
    { id: 'wasm', label: 'WASM Bindings (Embind)', col: 0, row: 0, group: 'api', variant: 'accent' },
    { id: 'capi', label: 'C API (sonare_c*.h)', col: 1, row: 0, group: 'api' },
    { id: 'quick', label: 'Quick API (quick.h)', col: 2, row: 0, group: 'api' },
    { id: 'unified', label: 'sonare.h (Unified Header)', col: 3, row: 0, group: 'api' },
    { id: 'stream', label: 'StreamAnalyzer', col: 0, row: 1, group: 'streaming', variant: 'accent' },
    { id: 'frameBuf', label: 'StreamFrame / FrameBuffer', col: 1, row: 1, group: 'streaming' },
    { id: 'music', label: 'MusicAnalyzer', col: 0, row: 2, group: 'analysis', variant: 'accent' },
    { id: 'coreAnalyzers', label: 'BPM · Key · Beat · Chord · Section · Boundary', col: 1, row: 2, group: 'analysis' },
    { id: 'moreAnalyzers', label: 'Timbre · Dynamics · Rhythm · Melody', col: 2, row: 2, group: 'analysis' },
    { id: 'acousticAnalysis', label: 'AcousticAnalyzer / RoomEstimator', col: 3, row: 2, group: 'analysis' },
    { id: 'spectralFx', label: 'HPSS · Time Stretch · Pitch Shift', col: 0, row: 3, group: 'effects', variant: 'accent' },
    { id: 'editFx', label: 'Normalize · Silence Trim · Pre/De-emphasis', col: 1, row: 3, group: 'effects' },
    { id: 'creativeFx', label: 'Decompose · Reverbs · Creative FX', col: 2, row: 3, group: 'effects' },
    { id: 'roomFx', label: 'Room Morph · Voice Change', col: 3, row: 3, group: 'effects' },
    { id: 'nativeSynth', label: 'NativeSynth (15 engines)', col: 0, row: 4, group: 'instruments', variant: 'accent' },
    { id: 'soundfont', label: 'SoundFont Player (SF2)', col: 1, row: 4, group: 'instruments' },
    { id: 'midiSeq', label: 'MIDI · Sequencer · SMF/UMP', col: 2, row: 4, group: 'instruments' },
    { id: 'instrumentRack', label: 'Instrument Rack', col: 3, row: 4, group: 'instruments' },
    { id: 'masterChain', label: 'MasteringChain', col: 0, row: 5, group: 'mastering', variant: 'accent' },
    { id: 'streamMaster', label: 'StreamingMasteringChain / EQ', col: 1, row: 5, group: 'mastering' },
    { id: 'mixerEngine', label: 'Mixer (strips/buses/sends)', col: 2, row: 5, group: 'mastering' },
    { id: 'rtEngine', label: 'RealtimeEngine', col: 3, row: 5, group: 'mastering' },
    { id: 'metering', label: 'Metering (LUFS/true-peak)', col: 4, row: 5, group: 'mastering' },
    { id: 'specFeatures', label: 'Mel · Chroma · CQT/VQT', col: 0, row: 6, group: 'feature', variant: 'accent' },
    { id: 'otherFeatures', label: 'Spectral · Onset · Pitch', col: 1, row: 6, group: 'feature' },
    { id: 'inverseFeatures', label: 'Inverse Features (reconstruction)', col: 2, row: 6, group: 'feature' },
    { id: 'audio', label: 'Audio', col: 0, row: 7, group: 'core' },
    { id: 'spectrum', label: 'Spectrogram (STFT/iSTFT)', col: 1, row: 7, group: 'core', variant: 'accent' },
    { id: 'primitives', label: 'FFT · Window · Resample · I-O', col: 2, row: 7, group: 'core' },
    { id: 'roomModel', label: 'Room Model', col: 0, row: 8, group: 'acoustic-sim' },
    { id: 'rir', label: 'RIR Synthesizer', col: 1, row: 8, group: 'acoustic-sim' },
    { id: 'materials', label: 'Material Presets', col: 2, row: 8, group: 'acoustic-sim' }
  ]"
  :edges="[
    { from: 'wasm', to: 'stream' },
    { from: 'capi', to: 'stream' },
    { from: 'unified', to: 'music' },
    { from: 'quick', to: 'music' },
    { from: 'quick', to: 'acousticAnalysis' },
    { from: 'stream', to: 'frameBuf' },
    { from: 'stream', to: 'primitives' },
    { from: 'music', to: 'coreAnalyzers' },
    { from: 'music', to: 'moreAnalyzers' },
    { from: 'coreAnalyzers', to: 'specFeatures' },
    { from: 'moreAnalyzers', to: 'otherFeatures' },
    { from: 'acousticAnalysis', to: 'spectrum' },
    { from: 'acousticAnalysis', to: 'rir' },
    { from: 'spectralFx', to: 'spectrum' },
    { from: 'spectralFx', to: 'primitives' },
    { from: 'creativeFx', to: 'rir' },
    { from: 'roomFx', to: 'spectralFx' },
    { from: 'roomFx', to: 'rir' },
    { from: 'midiSeq', to: 'nativeSynth' },
    { from: 'nativeSynth', to: 'instrumentRack' },
    { from: 'soundfont', to: 'instrumentRack' },
    { from: 'instrumentRack', to: 'mixerEngine' },
    { from: 'streamMaster', to: 'masterChain' },
    { from: 'masterChain', to: 'spectrum' },
    { from: 'mixerEngine', to: 'metering' },
    { from: 'rtEngine', to: 'mixerEngine' },
    { from: 'specFeatures', to: 'spectrum' },
    { from: 'specFeatures', to: 'primitives' },
    { from: 'otherFeatures', to: 'spectrum' },
    { from: 'otherFeatures', to: 'specFeatures' },
    { from: 'inverseFeatures', to: 'spectrum' },
    { from: 'spectrum', to: 'primitives' },
    { from: 'audio', to: 'spectrum' },
    { from: 'rir', to: 'roomModel' },
    { from: 'roomModel', to: 'materials' }
  ]"
  :groups="[
    { id: 'api', label: 'API Layer' },
    { id: 'streaming', label: 'Streaming Layer' },
    { id: 'analysis', label: 'Analysis Layer' },
    { id: 'effects', label: 'Effects Layer' },
    { id: 'instruments', label: 'Instruments & MIDI' },
    { id: 'mastering', label: 'Mastering & Mixing' },
    { id: 'feature', label: 'Feature Layer' },
    { id: 'core', label: 'Core Layer' },
    { id: 'acoustic-sim', label: 'Acoustic Simulation' }
  ]"
  caption="Bindings stay thin: WASM/C/Quick/sonare.h all reduce to the same C++ core, they never reimplement DSP per binding."
/>

## Page Map

| If you are looking at... | Read... |
|--------------------------|---------|
| `analysis/` and `feature/` | [JavaScript API](./js-api.md), [Python API](./python-api.md), [librosa Compatibility](./librosa-compatibility.md) |
| `analysis/acoustic_analyzer.*`, `analysis/room_estimator.*`, `src/acoustic/`, or `effects/acoustic/` | [Room Acoustics](./acoustic-analysis.md), [Algorithm References](./algorithm-references.md#scope-boundaries) |
| `streaming/` | [Realtime and Streaming](./realtime-streaming.md) |
| `mastering/` | [Mastering Processors](./mastering-processors.md), [DSP Implementation Notes](./dsp-implementation.md), [Mastering Assistant](./mastering-assistant.md) |
| `mixing/` | [Mixing Engine](./mixing.md), [Mixing Scene JSON](./mixing-scene-json.md) |
| `engine/`, `transport/`, `automation/`, `graph/`, `rt/` | [Realtime and Streaming](./realtime-streaming.md), especially `RealtimeEngine` |
| `midi/` and `midi/synth/` | [Native Synth](./native-synth.md), [SoundFont Player](./soundfont-player.md), [MIDI Input](./midi-input.md) |
| `arrangement/` (edit model) | [Project Editing](./project-editing.md), [Recording and Takes](./recording-and-takes.md), [Project Bounce](./project-bounce.md) |
| `mir/` (warp, grid snap, key context) | [Warp and Tempo](./glossary/arrangement/warp-and-tempo.md), [Realtime and Streaming](./realtime-streaming.md) |
| `editing/` and `effects/` | [Editing DSP](./editing-dsp.md), [DSP Implementation Notes](./dsp-implementation.md#effects-and-editing-dsp) |
| `sonare_c*.h` and binding folders | [Binding Parity](./binding-parity.md), [Native Bindings](./native-bindings.md), [C++ API](./cpp-api.md) |

## Directory Structure

```
src/
├── util/               # Level 0: Basic utilities
│   ├── types.h         # MatrixView, ErrorCode, enums
│   ├── exception.h     # SonareException
│   └── math_utils.h    # mean, variance, argmax, etc.
│
├── core/               # Level 1-3: Core DSP
│   ├── convert.h       # Hz/Mel/MIDI conversion
│   ├── window.h        # Hann, Hamming, Blackman
│   ├── fft.h           # KissFFT adapter
│   ├── spectrum.h      # STFT/iSTFT
│   ├── audio.h         # Audio buffer
│   ├── audio_io.h      # WAV/MP3 loading, optional FFmpeg-backed formats
│   └── resample.h      # r8brain resampling
│
├── filters/            # Level 4: Filterbanks
│   ├── mel.h           # Mel filterbank
│   ├── chroma.h        # Chroma filterbank
│   ├── dct.h           # DCT for MFCC
│   └── iir.h           # IIR filters
│
├── feature/            # Level 4: Feature extraction
│   ├── mel_spectrogram.h
│   ├── chroma.h
│   ├── cqt.h
│   ├── vqt.h
│   ├── inverse.h
│   ├── spectral.h
│   ├── onset.h
│   └── pitch.h
│
├── effects/            # Level 5: Audio effects
│   ├── hpss.h
│   ├── phase_vocoder.h
│   ├── time_stretch.h
│   ├── pitch_shift.h
│   ├── normalize.h
│   ├── preemphasis.h
│   ├── silence.h
│   ├── decompose.h
│   ├── remix.h
│   ├── delay/ modulation/ reverb/
│   ├── acoustic/       # room_morph
│   └── common/
│
├── acoustic/           # Geometric room acoustics
│   ├── room_model.* room_types.* material.*
│   ├── image_source.*  # early reflections
│   ├── late_reverb.*   # deterministic late tail
│   └── rir_synthesizer.*
│
├── analysis/           # Level 6: Music analysis
│   ├── music_analyzer.h
│   ├── bpm_analyzer.h
│   ├── key_analyzer.h
│   ├── beat_analyzer.h
│   ├── downbeat_analyzer.h
│   ├── meter_analyzer.h
│   ├── chord_analyzer.h
│   ├── section_analyzer.h
│   ├── boundary_detector.h
│   ├── melody_analyzer.h
│   ├── rhythm_analyzer.h
│   ├── timbre_analyzer.h
│   ├── dynamics_analyzer.h
│   ├── acoustic_analyzer.h
│   ├── room_estimator.h
│   └── ...
│
├── streaming/          # Level 6: Real-time streaming
│   ├── stream_analyzer.h   # Main streaming analyzer
│   ├── stream_config.h     # Configuration options
│   └── stream_frame.h      # Frame and buffer types
│
├── mastering/          # Mastering engine
│   ├── api/            # Chain, registry, 25 presets, 76 solo processors + pair/stereo registries
│   ├── eq/ dynamics/ spectral/ stereo/ final/
│   ├── maximizer/ multiband/ saturation/ repair/
│   ├── match/ assistant/                 # Reference match + assistant/profile
│   └── common/        # Shared biquad/loudness helpers
│
├── mixing/             # Mixing engine
│   ├── channel_strip.* # Strip: trim/insert/pan/width/sends
│   ├── bus.* sends.* vca_group.* panner.*
│   └── api/            # Scene JSON + scene presets
│
├── midi/               # MIDI I-O and the built-in instruments
│   ├── synth/          # NativeSynth voices + SoundFont player
│   │   ├── native_synth.*      # 12 physical models + subtractive/FM/additive
│   │   ├── ks_/piano_/pipe_organ_/bowed_string_/reed_/brass_/flute_/... voice.*
│   │   ├── sf2_player.* sf2_file.* sf2_voice.*   # SoundFont (SF2) playback
│   │   └── synth_presets.* gm_fallback_map.* gs_layer.* gs_effects.*
│   ├── sequencer.* smf.* smf2.* ump.*   # Sequencer, SMF and MIDI 2.0 (UMP)
│   └── program_map.* cc_map.* midi_fx.* routing.*
│
├── arrangement/        # Non-destructive edit model, edit compiler, edit history
├── engine/             # Realtime engine: transport, clips, instrument rack, track mixer, metronome, telemetry
├── automation/         # Automation lanes + curve shapes
├── metering/           # LUFS, true-peak, phase scope/goniometer
├── mir/                # Warp, grid snap, key context, tempo estimator bridge
├── graph/  rt/  transport/   # DSP graph, RT-safe primitives, transport
├── editing/            # Pitch editor, voice changer, note stretch
├── serialize/          # Project (de)serialization
├── host/               # Audio-device / MIDI-I-O / plugin-host backends (native only)
│
├── quick.h             # Simple function API
├── sonare.h            # Unified include header
├── c_api/              # C API implementation (public headers in include/sonare/sonare_c*.h)
└── wasm/
    └── bindings.cpp    # Embind bindings
```

## Data Flow

### Audio Analysis Pipeline

Every analyzer branches off the same STFT/Spectrogram output instead of
recomputing it: onset strength drives BPM and beat tracking, while the
chromagram drives key and chord recognition, and `MusicAnalyzer.analyze()`
just collects whichever of these were touched into one `AnalysisResult`.

<FlowDiagram
  title="Audio Analysis Pipeline"
  :nodes="[
    { id: 'file', label: 'Audio File (WAV/MP3)', col: 0, row: 0, group: 'input' },
    { id: 'buffer', label: 'Raw Buffer (float*)', col: 0, row: 1, group: 'input' },
    { id: 'audio', label: 'Audio', col: 1, row: 0, group: 'core' },
    { id: 'stft', label: 'STFT', col: 2, row: 0, group: 'core' },
    { id: 'spec', label: 'Spectrogram', col: 3, row: 0, group: 'core', variant: 'accent' },
    { id: 'mel', label: 'Mel Spectrogram', col: 4, row: 0, group: 'features' },
    { id: 'chroma', label: 'Chromagram', col: 4, row: 1, group: 'features' },
    { id: 'onset', label: 'Onset Strength', col: 4, row: 2, group: 'features' },
    { id: 'bpm', label: 'BPM Detection', col: 5, row: 0, group: 'analysis' },
    { id: 'key', label: 'Key Detection', col: 5, row: 1, group: 'analysis' },
    { id: 'beat', label: 'Beat Tracking', col: 5, row: 2, group: 'analysis' },
    { id: 'chord', label: 'Chord Recognition', col: 5, row: 3, group: 'analysis' },
    { id: 'result', label: 'AnalysisResult', col: 6, row: 1, group: 'output', variant: 'success' }
  ]"
  :edges="[
    { from: 'file', to: 'audio' },
    { from: 'buffer', to: 'audio' },
    { from: 'audio', to: 'stft' },
    { from: 'stft', to: 'spec' },
    { from: 'spec', to: 'mel' },
    { from: 'spec', to: 'chroma' },
    { from: 'mel', to: 'onset' },
    { from: 'onset', to: 'bpm' },
    { from: 'onset', to: 'beat' },
    { from: 'chroma', to: 'key' },
    { from: 'chroma', to: 'chord' },
    { from: 'bpm', to: 'result' },
    { from: 'key', to: 'result' },
    { from: 'beat', to: 'result' },
    { from: 'chord', to: 'result' }
  ]"
  :groups="[
    { id: 'input', label: 'Input' },
    { id: 'core', label: 'Core' },
    { id: 'features', label: 'Features' },
    { id: 'analysis', label: 'Analysis' },
    { id: 'output', label: 'Output' }
  ]"
  caption="File and in-memory buffer paths converge on Audio; from there every feature and analyzer shares the same Spectrogram."
/>

### Audio Effects Pipeline

HPSS and the phase vocoder both run on the same complex STFT and reconstruct
through a shared iSTFT, so they never diverge on transform parameters. Time
stretch and pitch shift instead take a separate path straight from `Audio`,
since pitch shift layers a resampler on top of the same time-stretch core.

<FlowDiagram
  title="Audio Effects Pipeline"
  direction="TB"
  :nodes="[
    { id: 'audio', label: 'Audio', col: 1, row: 0, group: 'input' },
    { id: 'stft', label: 'STFT', col: 1, row: 1, group: 'shared' },
    { id: 'ts', label: 'Time Stretch', col: 2, row: 1, group: 'pitch' },
    { id: 'spec', label: 'Complex Spectrogram', col: 1, row: 2, group: 'shared' },
    { id: 'resample', label: 'Resample', col: 2, row: 2, group: 'pitch' },
    { id: 'hpss', label: 'HPSS', col: 0, row: 3, group: 'spectral' },
    { id: 'pv', label: 'Phase Vocoder', col: 1, row: 3, group: 'spectral' },
    { id: 'istft', label: 'iSTFT', col: 1, row: 4 },
    { id: 'out', label: 'Processed Audio', col: 1, row: 5, group: 'output', variant: 'success' }
  ]"
  :edges="[
    { from: 'audio', to: 'stft' },
    { from: 'audio', to: 'ts' },
    { from: 'stft', to: 'spec' },
    { from: 'spec', to: 'hpss' },
    { from: 'spec', to: 'pv' },
    { from: 'ts', to: 'resample' },
    { from: 'hpss', to: 'istft' },
    { from: 'pv', to: 'istft' },
    { from: 'istft', to: 'out' },
    { from: 'resample', to: 'out' }
  ]"
  :groups="[
    { id: 'input', label: 'Input' },
    { id: 'shared', label: 'Shared Transform' },
    { id: 'pitch', label: 'Pitch Shift' },
    { id: 'spectral', label: 'Spectral Effects' },
    { id: 'output', label: 'Output' }
  ]"
/>

::: details What is a phase vocoder?
A phase vocoder is the standard way to time-stretch audio (or, combined with resampling, pitch-shift it) without obvious artifacts. It takes the STFT and *advances the phase* of each frequency bin to fit the new timeline before reconstructing, so a sound can be made longer or shorter while its pitch and spectral character stay intact. libsonare uses it for `timeStretch` / `pitchShift` and the editing-DSP voice tools.
:::

<SonareDemo id="time-stretch" />

### Streaming Pipeline

The streaming pipeline processes audio in real time, maintaining overlap state between chunks. Once a full frame's features land in the ring buffer, quantization is an opt-in trade: the default keeps full `Float32` precision, while 8-bit/16-bit packing shrinks the buffer for transfer at the cost of precision.

<FlowDiagram
  title="Streaming Pipeline"
  :nodes="[
    { id: 'chunk', label: 'Audio Chunk (128–512 samples)', col: 0, row: 1, group: 'input' },
    { id: 'overlap', label: 'Overlap Buffer', col: 1, row: 1, group: 'buffering' },
    { id: 'frame', label: 'Full Frame (n_fft)', col: 2, row: 1, group: 'buffering' },
    { id: 'fft', label: 'FFT', col: 3, row: 1, group: 'processing' },
    { id: 'mag', label: 'Magnitude', col: 4, row: 1, group: 'processing' },
    { id: 'mel', label: 'Mel Filterbank', col: 5, row: 0, group: 'processing' },
    { id: 'chroma', label: 'Chroma Filterbank', col: 5, row: 1, group: 'processing' },
    { id: 'spectral', label: 'Spectral Features', col: 5, row: 2, group: 'processing' },
    { id: 'streamframe', label: 'StreamFrame', col: 6, row: 1, group: 'output' },
    { id: 'ring', label: 'Ring Buffer', col: 7, row: 1, group: 'output' },
    { id: 'quant', label: 'Quantize?', col: 8, row: 1, group: 'output', variant: 'decision' },
    { id: 'soa', label: 'FrameBuffer (Float32)', col: 9, row: 0, group: 'output' },
    { id: 'u8', label: 'QuantizedU8', col: 9, row: 1, group: 'output' },
    { id: 'i16', label: 'QuantizedI16', col: 9, row: 2, group: 'output' }
  ]"
  :edges="[
    { from: 'chunk', to: 'overlap' },
    { from: 'overlap', to: 'frame' },
    { from: 'frame', to: 'fft' },
    { from: 'fft', to: 'mag' },
    { from: 'mag', to: 'mel' },
    { from: 'mag', to: 'chroma' },
    { from: 'mag', to: 'spectral' },
    { from: 'mel', to: 'streamframe' },
    { from: 'chroma', to: 'streamframe' },
    { from: 'spectral', to: 'streamframe' },
    { from: 'streamframe', to: 'ring' },
    { from: 'ring', to: 'quant' },
    { from: 'quant', to: 'soa', label: 'No' },
    { from: 'quant', to: 'u8', label: '8-bit', style: 'dashed' },
    { from: 'quant', to: 'i16', label: '16-bit', style: 'dashed' }
  ]"
  :groups="[
    { id: 'input', label: 'Input' },
    { id: 'buffering', label: 'Buffering' },
    { id: 'processing', label: 'Processing' },
    { id: 'output', label: 'Output' }
  ]"
/>

::: info Progressive Estimation
As more audio streams in, the pipeline accumulates chroma and onset data, so its BPM/key estimates have more evidence to work from. Estimates are refreshed periodically (default: BPM every 10s, key every 5s) and grow more confident the longer the stream runs.
:::

## Key Design Decisions

### Lazy Initialization

MusicAnalyzer initializes sub-analyzers on demand. Each intermediate (STFT, chroma, onset envelope, etc.) is computed the first time it's needed and reused afterwards.

```cpp
// BPM only (computes onset envelope)
float bpm = analyzer.bpm();

// Key detection triggers chroma computation
Key key = analyzer.key();

// All-in-one analysis fills in what's left
AnalysisResult result = analyzer.analyze();
```

::: tip Why this matters
Asking just for the key does **not** force chord recognition or section detection to run. Conversely, calling `analyze()` once reuses any intermediates already computed — no redundant FFTs.
:::

### Zero-Copy Audio Slicing

Audio uses `shared_ptr` with offset/size for zero-copy slicing:

```cpp
auto full = Audio::from_file("song.mp3");

// Both share same underlying buffer
auto intro = full.slice(0, 30);     // 0-30 sec
auto chorus = full.slice(60, 90);   // 60-90 sec
```

### WASM Compatibility

"Decoded samples" means raw audio amplitude values (a `Float32Array`), not the
bytes of a `.mp3` or `.wav` file — decoding is the step that turns the compressed
file into those values. Most WASM calls expect samples that are already decoded.

The npm/WebAssembly package exposes mostly sample-based APIs. Most calls expect
decoded mono `Float32Array` samples. For encoded bytes, `Audio.fromMemory(...)`
decodes WAV/MP3 in memory, while `Audio.fromMemoryWithBrowserFallback(...)`
can switch to the Web Audio API or another browser codec path before calling
the same sample-based methods.

WASM builds avoid native file I/O and FFmpeg-backed decoding. Runtime behavior is
single-threaded unless a future build explicitly enables browser threading.

### librosa Compatibility

Many DSP defaults intentionally mirror common librosa values, but libsonare is
not a drop-in replacement. In particular, libsonare usually requires the caller
to provide the sample rate; it does not implicitly resample to 22050 Hz the way
`librosa.load()` does by default.

| Parameter | Default |
|-----------|---------|
| sample_rate | User-provided |
| n_fft | 2048 |
| hop_length | 512 |
| n_mels | 128 |
| fmin | 0 |
| fmax | sr/2 |

## Third-Party Libraries

| Library | Purpose | License |
|---------|---------|---------|
| KissFFT | FFT | BSD-3-Clause |
| Eigen3 | Matrix ops | MPL-2.0 |
| dr_libs | WAV decode | Public Domain |
| minimp3 | MP3 decode | CC0-1.0 |
| FFmpeg | Optional extended file decoding | LGPL/GPL depending on linked build |
| r8brain | Resampling | MIT |

## WASM Compilation

```
Output: ~{{ wasmMeta.wasm.sizeKB }} KB WASM (~{{ wasmMeta.wasm.gzipKB }} KB gzipped) plus the JS binding code;
        ~{{ wasmMeta.total.sizeKB }} KB total (~{{ wasmMeta.total.gzipKB }} KB gzipped) — see src/wasm/meta.json
Build:  Emscripten with Embind
Flags:  -sWASM=1 -sMODULARIZE=1 -sEXPORT_ES6=1
```

The full mastering + mixing + analysis API set accounts for the bundle size; an analysis-only build would be smaller.
