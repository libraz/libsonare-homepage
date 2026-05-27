# Learning Path

This page is the beginner-friendly route through the libsonare docs. You do not need to understand DSP, MIR, WebAssembly, or mastering terminology before starting.

If you want to read the docs linearly, use this order:

1. [Introduction](./introduction.md) for vocabulary and the overall audio-analysis pipeline.
2. [Learning Path](./learning-path.md) to choose whether you are building analysis, streaming, editing, mixing, mastering, or research tooling.
3. [Getting Started](./getting-started.md), [Installation](./installation.md), and [Examples](./examples.md) to run one small program.
4. [Feature Map](./api-surface.md) to find the right API family.
5. One task guide from **Build By Task**.
6. One runtime reference from **API By Runtime**.
7. The evidence pages only when you need implementation details, algorithm references, validation scope, or performance context.

## Start With Your Goal

| I want to build... | Read first | Then read |
|--------------------|------------|-----------|
| A browser app that shows BPM, key, chords, or sections | [Getting Started](./getting-started.md) | [WebAssembly Guide](./wasm.md), [JavaScript API](./js-api.md) |
| A Python script or notebook for audio analysis | [Getting Started](./getting-started.md#python) | [Python API](./python-api.md) |
| A terminal workflow for quick checks or batch analysis | [Getting Started](./getting-started.md#cli) | [CLI Reference](./cli.md) |
| A live visualizer, rhythm game helper, or AudioWorklet tool | [Realtime and Streaming](./realtime-streaming.md) | [WebAssembly Guide](./wasm.md#streaming-analysis) |
| A browser or native mixer | [Mixing Engine](./mixing.md) | [Mixing Scene JSON](./mixing-scene-json.md) |
| A mastering UI or automatic mastering workflow | [Mastering Assistant](./mastering-assistant.md) | [Mastering Processors](./mastering-processors.md) |
| Pitch, time, voice, or source-separation editing | [Editing DSP](./editing-dsp.md) | [JavaScript API](./js-api.md#audio-effects) |
| Room decay, clarity, or blind acoustic estimates | [Room Acoustics](./acoustic-analysis.md) | [JavaScript API](./js-api.md#room-acoustics), [Python API](./python-api.md#room-acoustics) |
| Inverting mel/MFCC features for previews or debugging | [Inverse Features](./inverse-features.md) | [librosa Compatibility](./librosa-compatibility.md) |
| A migration from librosa | [librosa Compatibility](./librosa-compatibility.md) | [Feature Map](./api-surface.md) |

## The Four Layers

libsonare is easier to understand if you separate it into four layers.

| Layer | What it means | Pages |
|-------|---------------|-------|
| Concepts | What BPM, key, STFT, chroma, LUFS, true peak, and related terms mean | [Introduction](./introduction.md), [Glossary](./glossary.md) |
| Tasks | What you want to build: analysis, streaming, editing, mixing, mastering | [Feature Map](./api-surface.md), feature guides |
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
