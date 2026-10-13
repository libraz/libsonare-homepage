---
title: Use Cases
description: End-to-end walkthroughs of complete jobs, from stems to a delivered master to a piano recording turned into MIDI, as runnable CLI and Python sessions and JavaScript apps.
---

# Use Cases

Each page here carries one complete job from the material you have to the result you want. Most are CLI sessions you can paste into a terminal; the note and voice pages add a Python step, and the app pages are JavaScript built on the WASM package.

Every command on these pages was run against the current engine, and the numbers shown are the numbers it printed.

## Pick the job

**New to audio? Start with [Build Practice Tracks](./use-cases/practice-tracks.md).** It needs one song file, every step is a single command, and you can hear each result straight away. The table runs from easiest to hardest, and each page builds on vocabulary from the ones above it.

| Level | You have | You want | Runtime | Page |
|-------|----------|----------|---------|------|
| 1 | A song you are learning | Slowed, transposed, and separated practice tracks | CLI | [Build Practice Tracks](./use-cases/practice-tracks.md) |
| 1 | A WAV or MP3 of a piano piece | The notes as a MIDI file, checked against the score | CLI + Python | [Turn a Piano Recording into MIDI](./use-cases/audio-to-midi.md); try it first in [Piano Transcription](/transcribe) |
| 2 | A pile of rough recordings | Clean takes, with a record of what was wrong | CLI | [Clean Up a Batch of Recordings](./use-cases/recording-cleanup.md) |
| 2 | Host, guest, and a music bed | A ducked, loudness-compliant episode | CLI | [Produce a Spoken-Word Show](./use-cases/spoken-word-show.md) |
| 3 | A folder of stems | A finished, platform-ready master | CLI | [Mix and Master a Song in the CLI](./use-cases/cli-mix-and-master.md) |
| 3 | A mix and a commercial track you admire | Your mix sitting in the same tonal and loudness territory | CLI | [Match a Reference Track](./use-cases/reference-master.md) |
| 3 | A master about to be delivered | A pass/fail gate that runs in CI | CLI | [Gate a Delivery in CI](./use-cases/delivery-check.md) |
| 3 | A vocal take with a few flat or sharp notes | Those notes on pitch, the vibrato kept as sung | CLI + Python | [Tune a Vocal Take](./use-cases/vocal-tuning.md) |
| 4 | Local stems and a web app interface | Interactive mixing and a WAV download | JavaScript (WASM) | [Build a Browser Mixer](./use-cases/browser-mixer.md) |
| 4 | An app that hosts inserts or a mastering chain | Controls generated from the engine's own parameter descriptors | JavaScript (WASM) | [Build Controls from Parameter Descriptors](./use-cases/parameter-controls.md) |

Level 1 is one command per step. Level 2 adds a batch script or a preset you edit. Level 3 chains several stages and asks you to judge loudness and tone. Level 4 is application code. If a term on a page is new, [Audio Basics](./glossary/concepts/audio-basics.md) and [Mixing Basics](./glossary/concepts/mixing-basics.md) cover the vocabulary.

Every page opens with a **What you need** box: the files, their format, and the install line. Where a page's material is synthetic, the box carries a short script that writes equivalent test files, so you can run every step before you point it at your own audio.

## What the CLI pages assume

The CLI walkthroughs use the **Python CLI** (`pip install libsonare`). Two CLI properties shape them and are covered in full in the [CLI Reference](./cli.md):

- **Not every command is on both CLIs.** The scene mixer (`mix`), the preset-driven `master` and `mastering-chain`, and `declip` are Python-CLI only; the low-level metering commands (`meter`, `clipping`, `phase`, `stereo`, `dynamic-range`) are native-CLI only. See [Which CLI Are You Using?](./cli.md#which-cli-are-you-using).
- **Most commands are mono by nature.** Mixing and mastering keep a stereo pair end to end; most *measurement* commands downmix and say so on stderr. This is why these pages read loudness out of a mastering report rather than off a separate `lufs` call. See [Stereo and Mono Handling](./cli.md#stereo-and-mono-handling).

Every command takes `--json`, and every failure maps to a documented [exit code](./cli.md#exit-codes), so each walkthrough can run unattended in a script.

The CLI + Python pages run the same Python package (Python 3.11 or later). The Node tabs on the CLI pages and the JavaScript pages use the WebAssembly npm package, `npm install @libraz/libsonare` (Node.js 22.12 or later), as in [Getting Started](./getting-started.md#first-result). Each Node and Python tab shows how its audio is loaded, so every variable in it is defined.

::: tip Reaching for an API instead
A use case that ends in a UI, a plugin, or a realtime path belongs in an API, not a shell script. Start from [JavaScript API](./js-api.md), [Python API](./python-api.md), or [C++ API](./cpp-api.md); the concepts are the same and the pages here cross-link to the matching guide at each step.
:::
