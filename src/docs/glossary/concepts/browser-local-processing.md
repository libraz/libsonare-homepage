---
title: Browser Local Processing
description: What it means when libsonare says audio stays in your browser.
---

# Browser Local Processing

Browser local processing means the audio file is decoded and processed on your device, inside the browser. The libsonare demos do not upload your source audio to a server for analysis, mixing, realtime FX, or mastering renders.

This is one of libsonare's main product differences: it demonstrates serious DSP (digital signal processing) while keeping user audio private by design.

## What Stays Local

Across the browser demos:

- File decoding happens through browser audio APIs or the WASM `Audio.fromMemory*` helpers.
- Analysis, rendering, mixing, or realtime FX processing runs in the page, a Web Worker (a background thread that keeps the UI responsive), or an AudioWorklet (the browser's realtime audio-callback thread), depending on the demo.
- DSP runs through libsonare WebAssembly.
- WAV export, JSON report generation, and visualization data are produced in the browser.
- Source audio, rendered output, reference audio, and settings are held as local objects.

## What Still Loads From The Network

The page, the JavaScript bundle, the WASM file, and the web fonts load from the web like the rest of the site. That is code and styling arriving; your audio is never part of it. Once the code has loaded, source audio, reference audio, analysis buffers, and rendered output are not uploaded for processing, so even sensitive material stays on the device.

To check this yourself, open the browser's Network panel while a demo renders. After the page, the WASM file, and the fonts have loaded, no request carries audio. Outside the browser there is no server component to check: the Node package, the Python package, and the CLI all run the engine in your own process on local files.

::: code-group

```typescript [Browser]
import { init, lufs } from '@libraz/libsonare';

await init();   // fetches the WASM file once

// From here on, calls are local function calls; nothing goes over the network.
const { integratedLufs } = lufs(samples, sampleRate);
```

```python [Python]
import libsonare as sonare

# The engine is a local shared library loaded into the Python process.
integrated = sonare.Audio.from_file("song.wav").lufs().integrated_lufs
```

```bash [CLI]
sonare lufs song.wav   # reads the file from disk and prints the result
```

:::

## Tradeoffs

Local processing has advantages:

- No upload wait.
- No server-side file retention.
- No credits or queue.
- Works with private material that should not leave the device.

It also has limits:

- Long files depend on your CPU and memory.
- Mobile browsers can be more constrained.
- Browser codec support differs by platform.
- There is no server fallback if the local device cannot render the job.

When a large file feels slow, the bottleneck is the device's CPU and memory rather than a busy server. Practical responses are testing a shorter excerpt first, trying another browser, or running the demo on a desktop machine.

:::: details Implementation notes

The demos create object URLs for local artifacts such as decoded source audio, rendered WAV output, JSON reports, reference audio, and exported settings.

These URLs point to local browser memory, not remote files. They are revoked when replaced or when the component unmounts.

Preview playback, WAV export, and report saving all sit on top of this mechanism, so there is no network round trip for the audio itself.

Rendering, reference matching, and heavier analysis tasks use module workers where appropriate. That keeps the UI responsive while libsonare WASM performs the heavier work.

Realtime FX paths use AudioWorklet-style execution for the audio callback.

When a worker raises an exception, the UI side rewrites it into a shape that is easier to display. A failure on a long file should report an error instead of freezing the page.

::::

Related: [Error Recovery](../mastering/error-recovery.md), [Quality Checklist](../mastering/quality-checklist.md), [WASM](../../wasm.md)
