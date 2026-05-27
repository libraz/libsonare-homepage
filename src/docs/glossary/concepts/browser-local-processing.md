---
title: Browser Local Processing
description: What it means when libsonare says audio stays in your browser.
---

# Browser Local Processing

Browser local processing means the audio file is decoded and processed on your device, inside the browser. The libsonare demos do not upload your source audio to a server for analysis, mixing, realtime FX, or mastering renders.

This is one of libsonare's main product differences: it demonstrates serious DSP while keeping user audio private by design.

## What Stays Local

Across the browser demos:

- File decoding happens through browser audio APIs.
- Analysis, rendering, mixing, or realtime FX processing runs in the page, a Web Worker, or an AudioWorklet depending on the demo.
- DSP runs through libsonare WebAssembly.
- WAV export, JSON report generation, and visualization data are produced in the browser.
- Source audio, rendered output, reference audio, and settings are held as local objects.

## What Still Loads From The Network

The page, JavaScript bundle, WASM file, fonts, and site analytics script may load from the web like the rest of the site. That is different from uploading your audio for processing.

Once the code is loaded, the audio processing path itself is local.

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

## Worth Keeping In Mind

Even when working with sensitive material, the page code and WASM still load from the network like any other site. The important property is that after loading, source audio, reference audio, analysis buffers, and rendered output are not uploaded for processing.

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
