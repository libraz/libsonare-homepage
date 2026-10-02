---
title: Use Cases
description: End-to-end guides to production tasks and browser app development, with runnable CLI workflows and a mixing app reference implementation.
---

# Use Cases

These guides follow a complete task: producing an audio deliverable or building an app. The production walkthroughs provide CLI scripts; the browser mixer guide explains the working demo and the APIs needed to build a mixing interface.

Every command on these pages was run against the current engine, and the numbers shown are the numbers it printed.

## Pick the job

| You have | You want | Page |
|----------|----------|------|
| Local stems and a web app interface | Interactive mixing and a WAV download | [Build a Browser Mixer](./use-cases/browser-mixer.md) |
| A folder of stems | A finished, platform-ready master | [Mix and Master a Song in the CLI](./use-cases/cli-mix-and-master.md) |
| A mix and a commercial track you admire | Your mix sitting in the same tonal and loudness territory | [Match a Reference Track](./use-cases/reference-master.md) |
| A master about to be delivered | A pass/fail gate that runs in CI | [Gate a Delivery in CI](./use-cases/delivery-check.md) |
| A pile of rough recordings | Clean takes, with a record of what was wrong | [Clean Up a Batch of Recordings](./use-cases/recording-cleanup.md) |
| Host, guest, and a music bed | A ducked, loudness-compliant episode | [Produce a Spoken-Word Show](./use-cases/spoken-word-show.md) |
| A song you are learning | Slowed, transposed, and separated practice tracks | [Build Practice Tracks](./use-cases/practice-tracks.md) |

## What these pages assume

The browser mixer guide uses the WASM/JavaScript APIs. The production walkthroughs use the **Python CLI** (`pip install libsonare`). Two CLI properties shape those workflows and are covered in full in the [CLI Reference](./cli.md):

- **Not every command is on both CLIs.** The scene mixer (`mix`), the preset-driven `master` and `mastering-chain`, and `declip` are Python-CLI only; the low-level metering commands (`meter`, `clipping`, `phase`, `stereo`, `dynamic-range`) are native-CLI only. See [Which CLI Are You Using?](./cli.md#which-cli-are-you-using).
- **Most commands are mono by nature.** Mixing and mastering keep a stereo pair end to end; most *measurement* commands downmix and say so on stderr. This is why these pages read loudness out of a mastering report rather than off a separate `lufs` call. See [Stereo and Mono Handling](./cli.md#stereo-and-mono-handling).

Every command takes `--json`, and every failure maps to a documented [exit code](./cli.md#exit-codes) — which is what makes these workflows scriptable rather than merely typeable.

::: tip Reaching for an API instead
A use case that ends in a UI, a plugin, or a realtime path belongs in an API, not a shell script. Start from [JavaScript API](./js-api.md), [Python API](./python-api.md), or [C++ API](./cpp-api.md); the concepts are the same and the pages here cross-link to the matching guide at each step.
:::
