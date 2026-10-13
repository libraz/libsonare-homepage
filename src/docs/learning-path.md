# Learning Path

This page routes you through the libsonare docs by what you want to build. You do not need to understand DSP, MIR, WebAssembly, or mastering terminology before starting.

::: info Acronyms you will see early
**DSP** (digital signal processing) means measuring or changing audio as numbers. **MIR** (Music Information Retrieval) means reading musical information such as BPM, key, and chords from audio. **WASM / WebAssembly** is the browser runtime format. **API** means the functions and classes your app calls. **CLI** means a terminal command. At this stage, you only need enough vocabulary to choose the next page.
:::

The sidebar groups the guides into ten subject areas: Analysis, Instruments & MIDI, Mixing, Mastering, Editing, Repair, Arrangement & Projects, Realtime, Room Acoustics, and Playback. The headings below use the same names, so the area you find a goal under is also the sidebar group its guides sit in. The runtime references and the evidence pages follow the areas.

If you have not run anything yet, start with [Getting Started](./getting-started.md): one install line and one short program per runtime.

::: details Reading the docs front to back
1. [Introduction](./introduction.md) for vocabulary and the overall audio-analysis pipeline.
2. This page, to find the subject area your goal belongs to.
3. [Getting Started](./getting-started.md), [Installation](./installation.md), and [Examples](./examples.md) to run one small program.
4. [Feature Map](./api-surface.md) to find the right API family.
5. One walkthrough from [Use Cases](./use-cases.md) when what you want is a finished deliverable rather than an integration.
6. One guide from the subject area that matches your goal, below.
7. One runtime reference from **API By Runtime**.
8. The evidence pages only when you need implementation details, algorithm references, validation scope, or performance context.
:::

## Start With Your Goal

Find your goal under the area it belongs to. **Read first** is the page written for that goal; **Then read** is where the detail lives once the first page has made sense. Rows that start from a [use case](./use-cases.md) are complete walkthroughs with commands you can run.

### Analysis

Every result in this area (tempo, key, chords, sections) is read off the same first step. The audio is cut into short overlapping windows and each window is turned into a spectrum, so the whole recording becomes a picture of which frequencies are present at each moment. If you have never seen that picture, this is it:

<SonareDemo id="stft-basics" />

| I want to build... | Read first | Then read |
|--------------------|------------|-----------|
| A browser app that shows BPM, key, chords, or sections | [Getting Started](./getting-started.md) | [Music Analysis](./analysis.md), [WebAssembly Guide](./wasm.md) |
| A Python script or notebook for audio analysis | [Getting Started](./getting-started.md#first-result) | [Python API](./python-api.md), [Music Analysis](./analysis.md) |
| A terminal workflow for quick checks or batch analysis | [Getting Started](./getting-started.md#first-result) | [CLI Reference](./cli.md), [CLI Commands](./cli-commands.md) |
| Song structure, self-similarity, or note-segmentation analysis | [Music Analysis](./analysis.md) | [JavaScript API](./js-api-helpers.md#librosa-compatible-helpers), [Python API](./python-api-analysis.md#feature-extraction) |
| Bars and time signatures scored over a beat series you already have | [Music Analysis](./analysis.md#meter-estimatemeter) | [Meter and Grouping](./glossary/analysis/meter-and-grouping.md) |
| A migration from librosa | [librosa Compatibility](./librosa-compatibility.md) | [Music Analysis](./analysis.md#this-page-or-the-compatibility-layer) |
| A librosa figure (frame and sample conversion, decibels, peak picking) checked against the engine from a shell | [CLI Utilities](./cli-utilities.md) | [librosa Compatibility](./librosa-compatibility.md) |
| A source-separation view that keeps the harmonic and percussive paths available for editing | [Source Separation](./source-separation.md) | [Music Analysis](./analysis.md), [Editing DSP](./editing-dsp.md) |

### Instruments & MIDI

Nothing in this area plays back a recording: the engine ships no sample data, and every instrument is computed while the note sounds. [Sound Sources](./sound-sources.md) explains that decision and what follows from it. Read it before any page that assumes you have already chosen a synthesis method.

| I want to build... | Read first | Then read |
|--------------------|------------|-----------|
| A choice between a physical model, FM, subtractive synthesis, and a SoundFont you bring | [Sound Sources](./sound-sources.md) | [Built-in Synthesizer](./native-synth.md), [Physical Models](./physical-models.md) |
| A synth or instrument app that renders MIDI to audio | [Built-in Synthesizer](./native-synth.md) | [MIDI Input](./midi-input.md), [Realtime and Streaming](./realtime-streaming.md) |
| A MIDI clip editor or sequencer with MIDI 1.0 and MIDI 2.0 events | [MIDI Editing](./midi-editing.md) | [MIDI 2.0 & UMP](./midi2.md), [Project MIDI](./project-editing-midi.md) |
| The acoustic voices (piano, bowed string, reed, brass, flute) heard side by side or voiced from code | [Physical Models](./physical-models.md) | [Built-in Synthesizer](./native-synth.md#the-named-preset-catalog) |
| A lookup of which engine and voicing a General MIDI program falls back to when no SoundFont covers it | [GM Tone Map](./gm-tone-map.md) | [GM and GS](./gm-gs.md) |
| SoundFont (SF2) playback through a built-in player | [SoundFont 2 Player](./soundfont-player.md) | [GM and GS](./gm-gs.md), [MIDI Input](./midi-input.md) |
| A C++ app that needs the instruments only, without analysis or mastering | [Link targets](./cpp-api.md#link-targets) | [Built-in Synthesizer](./native-synth.md), [SoundFont 2 Player](./soundfont-player.md) |

### Mixing

| I want to build... | Read first | Then read |
|--------------------|------------|-----------|
| A browser or native mixer | [Mixing Engine](./mixing.md) | [Mixing Scene JSON](./mixing-scene-json.md) |
| A browser mixing app, read from a working demo's source | [Build a Browser Mixer](./use-cases/browser-mixer.md) | [Mixing Engine](./mixing.md), [Mixing Demo Project JSON](./mixing-demo-project-json.md) |
| A starting mix proposed from the tracks themselves, with a reason for every move | [Mixing Assistant](./mixing-assistant.md) | [Mixing Scene JSON](./mixing-scene-json.md), [Mixing Engine](./mixing.md) |
| Reverb, modulation, or delay on a strip or a bus | [Effects Inserts](./effects-inserts.md) | [Mixing Scene JSON](./mixing-scene-json.md) |
| Insert controls drawn from the engine's own parameter descriptors instead of a hand-kept table | [Build Controls from Parameter Descriptors](./use-cases/parameter-controls.md) | [Effects Inserts](./effects-inserts.md#the-parameter-descriptor), [Realtime Engine](./realtime-engine.md#parameter-automation) |
| A talk episode with the music ducked under the voices, delivered at a loudness target | [Produce a Spoken-Word Show](./use-cases/spoken-word-show.md) | [Mixing Engine](./mixing.md), [CLI Reference](./cli.md) |

### Mastering

| I want to build... | Read first | Then read |
|--------------------|------------|-----------|
| A mastering UI or automatic mastering workflow | [Mastering Assistant](./mastering-assistant.md) | [Mastering Processors](./mastering-processors.md) |
| A finished master from a folder of stems, in the terminal | [Mix and Master in the CLI](./use-cases/cli-mix-and-master.md) | [CLI Reference](./cli.md), [Mastering Processors](./mastering-processors.md) |
| A mix brought into the tonal and loudness range of a reference track | [Match a Reference Track](./use-cases/reference-master.md) | [Mastering Assistant](./mastering-assistant.md) |
| A pass/fail check on a master before delivery, run in CI | [Gate a Delivery in CI](./use-cases/delivery-check.md) | [CLI Reference](./cli.md#exit-codes) |
| A UI wired to the mastering chain's own controls, or a render report you have to explain | [Mastering Implementation](./mastering-implementation.md) | [Mastering Processors](./mastering-processors.md), [Build Controls from Parameter Descriptors](./use-cases/parameter-controls.md#lay-out-the-mastering-chain) |

### Editing

| I want to build... | Read first | Then read |
|--------------------|------------|-----------|
| Pitch, time, voice, or source-separation editing | [Editing DSP](./editing-dsp.md) | [JavaScript API](./js-api-effects.md#audio-effects) |
| Audio transcription, clip replacement, and tempo-aware MIDI placement | [Audio to MIDI](./audio-to-notes.md) | [MIDI Editing](./midi-editing.md), [Project MIDI](./project-editing-midi.md) |
| A piano recording turned into a MIDI file and checked against the score | [Turn a Piano Recording into MIDI](./use-cases/audio-to-midi.md) | [Audio to MIDI](./audio-to-notes.md) |
| Note-level edits that render back into an audio clip | [Note Editing in Audio](./note-editing.md) | [Editing DSP](./editing-dsp.md) |
| Region-based spectral edits (attenuate, mute, gain, or heal a time-frequency rectangle) | [Spectral Editing](./spectral-editing.md) | [Editing DSP](./editing-dsp.md) |
| Slowed, transposed, and separated practice tracks of a song | [Build Practice Tracks](./use-cases/practice-tracks.md) | [Editing DSP](./editing-dsp.md), [Source Separation](./source-separation.md) |
| A recorded take tuned to the melody in a MIDI file, from the shell | [CLI Utilities](./cli-utilities.md#tune-to-midi) | [Project MIDI](./project-editing-midi.md) |

### Repair

Measure the defect before choosing a repair stage. Broadband noise, mains hum, clipped peaks, impulsive clicks, crackle, and diffuse reverb need different evidence and different reconstruction limits.

| I want to build... | Read first | Then read |
|--------------------|------------|-----------|
| A repair workflow that chooses stages from measured defects | [Audio Repair Workflow](./audio-repair.md) | [Repairing Noise and Hum](./repair-noise.md), [Repairing Clipping, Clicks, and Crackle](./repair-transients.md), [Repairing Diffuse Reverb](./repair-reverb.md) |
| A batch of rough recordings cleaned up, with a record of what was wrong in each | [Clean Up a Batch of Recordings](./use-cases/recording-cleanup.md) | [Audio Repair Workflow](./audio-repair.md) |

### Arrangement & Projects

| I want to build... | Read first | Then read |
|--------------------|------------|-----------|
| A DAW, arrangement, or MIDI-sequencing tool | [Project Editing](./project-editing.md) | [Project MIDI](./project-editing-midi.md), [Bouncing Projects](./project-bounce.md) |
| A sung take corrected note by note (pitch, formant, level) with undo, and the result placed in a project | [Vocal Editing](./vocal-editing.md) | [Tune a Vocal Take](./use-cases/vocal-tuning.md) |
| A project saved to a file and opened again | [Project Save & Load](./project-save-load.md) | [Project Editing](./project-editing.md) |
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

### Playback

| I want to build... | Read first | Then read |
|--------------------|------------|-----------|
| Movie audio rendered to binaural headphones or to calibrated stereo, 5.1, or 7.1 speakers | [Playback Renderer](./playback.md) | [Channel Formats](./channel-formats.md) |
| A check of how each module treats mono, stereo, 5.1, and 7.1 input | [Channel Formats](./channel-formats.md) | [Playback Renderer](./playback.md) |

::: tip How to read the task guides
Each task guide starts with the decision criteria, then shows the smallest useful code path, then lists caveats and related pages. When the same workflow runs in Browser / WASM, Python, and CLI, the page shows all three in a `::: code-group`. Inherently WASM / C++ APIs, such as the realtime engine or the AudioWorklet bridge, point to the batch alternative instead of implying that Python and the CLI have the same live callback API.
:::

## Reference

### Implementation checklist

Before implementing from a task page, check these points.

| Check | Where to look | How to decide |
|-------|---------------|---------------|
| Whether your input is a file, encoded bytes, decoded samples, or live blocks | The page's "when to use" / "which API" section | Browser / WASM usually takes `Float32Array` plus `sampleRate`; use `Audio.fromMemory*` or browser codecs for encoded bytes. Python / CLI often read files directly. |
| Which runtime calls the workflow | The Browser / Python / CLI examples in `::: code-group` blocks | When all three are shown, compare API names, argument names, and result shapes before porting code. |
| Whether the terminology is clear enough for UI copy or implementation comments | Inline `::: tip` / `::: info` / `::: warning` / `::: details` blocks and the [Glossary](./glossary.md) | Terms that affect implementation decisions stay close to the code; longer background belongs in callouts or glossary pages. |
| Whether a runtime gap exists | [Binding Parity](./binding-parity.md) and the runtime references | If a task page does not show an example for a runtime, the API may be unavailable there or the runtime may be the wrong fit. |

### The four layers

| Layer | What it means | Pages |
|-------|---------------|-------|
| Concepts | What BPM, key, STFT, chroma, LUFS, true peak, and related terms mean | [Introduction](./introduction.md), [Glossary](./glossary.md) |
| Tasks | What you want to build, in the ten subject areas above | [Feature Map](./api-surface.md), the area guides from [Music Analysis](./analysis.md) to [Playback Renderer](./playback.md) |
| Runtime | Where the code runs: browser, Python, Node, CLI, C++ | [Getting Started](./getting-started.md), runtime references |
| Evidence | How the implementation is structured and validated | [DSP Implementation Notes](./dsp-implementation.md), [Algorithm References](./algorithm-references.md), [Implementation Validation](./implementation-validation.md) |

Most users need only the first three. Open the evidence pages when you need to expose DSP controls in a UI, explain a render report, check whether a processor is appropriate for realtime use, or cite the basis for an algorithm.
