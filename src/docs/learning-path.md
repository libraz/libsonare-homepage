# Learning Path

This page routes you through the libsonare docs by what you want to build. You do not need to understand DSP, MIR, WebAssembly, or mastering terminology before starting.

::: info Acronyms you will see early
**DSP** (digital signal processing) means measuring or changing audio as numbers. **MIR** (Music Information Retrieval) means reading musical information such as BPM, key, and chords from audio. **WASM / WebAssembly** is the browser runtime format. **API** means the functions and classes your app calls. **CLI** means a terminal command. At this stage, you only need enough vocabulary to choose the next page.
:::

The sidebar groups the guides into eight subject areas — Analysis, Instruments & MIDI, Mixing, Mastering, Editing, Arrangement & Projects, Realtime, and Room Acoustics — followed by the runtime references and the evidence pages. The routes below follow the same order, so a row you pick here is also a place in the sidebar.

If you want to read the docs linearly, use this order:

1. [Introduction](./introduction.md) for vocabulary and the overall audio-analysis pipeline.
2. [Learning Path](./learning-path.md), this page, to find the subject area your goal belongs to.
3. [Getting Started](./getting-started.md), [Installation](./installation.md), and [Examples](./examples.md) to run one small program.
4. [Feature Map](./api-surface.md) to find the right API family.
5. One walkthrough from **[Use Cases](./use-cases.md)** when what you want is a finished deliverable rather than an integration.
6. One guide from the subject area that matches your goal, below.
7. One runtime reference from **API By Runtime**.
8. The evidence pages only when you need implementation details, algorithm references, validation scope, or performance context.

## Start With Your Goal

Find your goal under the area it belongs to. **Read first** is the page written for that goal; **Then read** is where the detail lives once the first page has made sense.

### Analysis

Every result in this area — tempo, key, chords, sections — is read off the same first step. The audio is cut into short overlapping windows and each window is turned into a spectrum, so the whole recording becomes a picture of which frequencies are present at each moment. If you have never seen that picture, this is it:

<SonareDemo id="stft-basics" />

| I want to build... | Read first | Then read |
|--------------------|------------|-----------|
| A browser app that shows BPM, key, chords, or sections | [Getting Started](./getting-started.md) | [Music Analysis](./analysis.md), [WebAssembly Guide](./wasm.md) |
| A Python script or notebook for audio analysis | [Getting Started](./getting-started.md#python) | [Python API](./python-api.md), [Music Analysis](./analysis.md) |
| A terminal workflow for quick checks or batch analysis | [Getting Started](./getting-started.md#cli) | [CLI Reference](./cli.md), [CLI Commands](./cli-commands.md) |
| Song structure, self-similarity, or note-segmentation analysis | [Music Analysis](./analysis.md) | [JavaScript API](./js-api-helpers.md#librosa-compatible-helpers), [Python API](./python-api-analysis.md#feature-extraction) |
| Bars and time signatures scored over a beat series you already have | [Music Analysis](./analysis.md#meter-estimatemeter) | [Meter and Grouping](./glossary/analysis/meter-and-grouping.md) |
| A migration from librosa | [librosa Compatibility](./librosa-compatibility.md) | [Music Analysis](./analysis.md#this-page-or-the-compatibility-layer) |
| A librosa figure — frame and sample conversion, decibels, peak picking — checked against the engine from a shell | [CLI Utilities](./cli-utilities.md) | [librosa Compatibility](./librosa-compatibility.md) |

### Instruments & MIDI

Nothing in this area plays back a recording: the engine ships no sample data, and every instrument is computed while the note sounds. [Sound Sources](./sound-sources.md) explains that decision and what follows from it. Read it before any page that assumes you have already chosen a synthesis method.

| I want to build... | Read first | Then read |
|--------------------|------------|-----------|
| A choice between a physical model, FM, subtractive synthesis, and a SoundFont you bring | [Sound Sources](./sound-sources.md) | [Built-in Synthesizer](./native-synth.md), [Physical Models](./physical-models.md) |
| A synth or instrument app that renders MIDI to audio | [Built-in Synthesizer](./native-synth.md) | [MIDI Input](./midi-input.md), [Realtime and Streaming](./realtime-streaming.md) |
| The acoustic voices — piano, bowed string, reed, brass, flute — heard side by side or voiced from code | [Physical Models](./physical-models.md) | [Built-in Synthesizer](./native-synth.md#the-named-preset-catalog) |
| A lookup of which engine and voicing a General MIDI program falls back to when no SoundFont covers it | [GM Tone Map](./gm-tone-map.md) | [GM and GS](./gm-gs.md) |
| SoundFont (SF2) playback through a built-in player | [SoundFont 2 Player](./soundfont-player.md) | [GM and GS](./gm-gs.md#nativesynth-and-the-soundfont-fallback), [MIDI Input](./midi-input.md) |
| A C++ app that needs the instruments only, without analysis or mastering | [Link targets](./cpp-api.md#link-targets) | [Built-in Synthesizer](./native-synth.md), [SoundFont 2 Player](./soundfont-player.md) |

### Mixing

| I want to build... | Read first | Then read |
|--------------------|------------|-----------|
| A browser or native mixer | [Mixing Engine](./mixing.md) | [Mixing Scene JSON](./mixing-scene-json.md) |
| A starting mix proposed from the tracks themselves, with a reason for every move | [Mixing Assistant](./mixing-assistant.md) | [Mixing Scene JSON](./mixing-scene-json.md), [Mixing Engine](./mixing.md) |
| Reverb, modulation, or delay on a strip or a bus | [Effects Inserts](./effects-inserts.md) | [Mixing Scene JSON](./mixing-scene-json.md) |

### Mastering

| I want to build... | Read first | Then read |
|--------------------|------------|-----------|
| A mastering UI or automatic mastering workflow | [Mastering Assistant](./mastering-assistant.md) | [Mastering Processors](./mastering-processors.md) |
| A whole production job — stems to master, or a delivery gate — done in the terminal | [Use Cases](./use-cases.md) | [Mix and Master in the CLI](./use-cases/cli-mix-and-master.md), [CLI Reference](./cli.md) |
| A UI wired to the mastering chain's own controls, or a render report you have to explain | [Mastering Implementation](./mastering-implementation.md) | [Mastering Processors](./mastering-processors.md) |

### Editing

| I want to build... | Read first | Then read |
|--------------------|------------|-----------|
| Pitch, time, voice, or source-separation editing | [Editing DSP](./editing-dsp.md) | [JavaScript API](./js-api-effects.md#audio-effects) |
| Region-based spectral edits (attenuate, mute, gain, or heal a time-frequency rectangle) | [Spectral Editing](./spectral-editing.md) | [Editing DSP](./editing-dsp.md) |
| A recorded take tuned to the melody in a MIDI file, from the shell | [CLI Utilities](./cli-utilities.md#tune-to-midi) | [Project MIDI](./project-editing-midi.md) |

### Arrangement & Projects

| I want to build... | Read first | Then read |
|--------------------|------------|-----------|
| A DAW, arrangement, or MIDI-sequencing tool | [Project Editing](./project-editing.md) | [Project MIDI](./project-editing-midi.md), [Bouncing Projects](./project-bounce.md) |
| Microphone capture, loop takes, and comping into a clip | [Recording & Takes](./recording-and-takes.md) | [Project Editing](./project-editing.md) |
| A project rendered to audio, with or without the built-in synth | [Bouncing Projects](./project-bounce.md) | [Built-in Synthesizer](./native-synth.md), [SoundFont 2 Player](./soundfont-player.md) |

### Realtime

| I want to build... | Read first | Then read |
|--------------------|------------|-----------|
| A live visualizer, rhythm game helper, or AudioWorklet tool | [Realtime and Streaming](./realtime-streaming.md) | [WebAssembly Guide](./wasm-streaming.md#streaming-analysis) |
| Transport, track lanes, live MIDI, and automation in a playback engine | [Realtime Engine](./realtime-engine.md) | [Realtime and Streaming](./realtime-streaming.md) |
| A realtime microphone voice changer | [Realtime Voice Changer](./realtime-voice-changer.md) | [WebAssembly Guide](./wasm-streaming.md#realtime-voice-changer) |

### Room Acoustics

| I want to build... | Read first | Then read |
|--------------------|------------|-----------|
| Room sound, estimates, or generated room character | [Room Acoustics](./acoustic-analysis.md) | [JavaScript API](./js-api-effects.md#room-acoustics), [Python API](./python-api-effects.md#room-acoustics) |
| Inverting mel/MFCC features for previews or debugging | [Inverse Features](./inverse-features.md) | [librosa Compatibility](./librosa-compatibility.md) |

::: tip How to read the task guides
The task guides in each area follow the same order:

1. start with the decision criteria;
2. show the smallest useful code path;
3. call out practical caveats and related pages.

When the same workflow can be shown safely in Browser / WASM, Python, and CLI, the page uses a `::: code-group` to show all three.

For APIs that are inherently WASM / C++ oriented, such as the realtime engine or AudioWorklet bridge, the docs point to the batch alternative or runtime reference instead of implying that Python / CLI have the same live callback API.

Room acoustics includes room decay, clarity, blind estimates, equivalent-room estimates, RIR (room impulse response) synthesis, and room morphing.
:::

## Implementation Checklist

Before implementing from a task page, check these points.

| Check | Where to look | How to decide |
|-------|---------------|---------------|
| Whether your input is a file, encoded bytes, decoded samples, or live blocks | The page's "when to use" / "which API" section | Browser / WASM usually takes `Float32Array` plus `sampleRate`; use `Audio.fromMemory*` or browser codecs for encoded bytes. Python / CLI often read files directly. |
| Which runtime calls the workflow | The Browser / Python / CLI examples in `::: code-group` blocks | When all three are shown, compare API names, argument names, and result shapes before porting code. |
| Whether the terminology is clear enough for UI copy or implementation comments | Inline `::: tip` / `::: info` / `::: warning` / `::: details` blocks and the [Glossary](./glossary.md) | Terms that affect implementation decisions stay close to the code; longer background belongs in callouts or glossary pages. |
| Whether a runtime gap exists | [Binding Parity](./binding-parity.md) and the runtime references | If a task page does not show an example for a runtime, the API may be unavailable there or the runtime may be the wrong fit. |

## The Four Layers

libsonare is easier to understand if you separate it into four layers.

| Layer | What it means | Pages |
|-------|---------------|-------|
| Concepts | What BPM, key, STFT, chroma, LUFS, true peak, and related terms mean | [Introduction](./introduction.md), [Glossary](./glossary.md) |
| Tasks | What you want to build, in the eight subject areas above | [Feature Map](./api-surface.md), the area guides from [Music Analysis](./analysis.md) to [Room Acoustics](./acoustic-analysis.md) |
| Runtime | Where the code runs: browser, Python, Node, CLI, C++ | [Getting Started](./getting-started.md), runtime references |
| Evidence | How the implementation is structured and validated | [DSP Implementation Notes](./dsp-implementation.md), [Algorithm References](./algorithm-references.md), [Implementation Validation](./implementation-validation.md) |

Most users should read the first three layers before opening the evidence pages.

## Minimum Path For A First Project

1. Read [Introduction](./introduction.md) for the basic vocabulary.
2. Open [Getting Started](./getting-started.md) and choose your runtime.
3. Build one small example from [Examples](./examples.md).
4. Use [Feature Map](./api-surface.md) when you need to find the right API family.
5. Use [Binding Parity](./binding-parity.md) only when moving code between runtimes.

## When To Read The Deep Dives

Open the implementation pages when you need to expose DSP controls in a UI, explain a render report, check whether a processor is appropriate for realtime use, or cite the basis for an algorithm. They are not required for a first integration.
