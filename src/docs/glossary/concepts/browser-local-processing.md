---
title: Browser Local Processing
description: What it means when libsonare says audio stays in your browser.
---

# Browser Local Processing

Browser local processing means the audio file is decoded and processed on your device, inside the browser. The mastering demo does not upload the source or reference file to a server for rendering.

This is one of libsonare's main product differences: it demonstrates serious DSP while keeping user audio private by design.

## What Stays Local

In the mastering demo:

- File decoding happens through browser audio APIs.
- Rendering runs in a Web Worker.
- DSP runs through libsonare WebAssembly.
- WAV export and JSON report generation happen in the browser.
- Source, rendered output, reference audio, and settings are held as local objects.

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

Even when working with sensitive material, the page code and WASM still load from the network like any other site. The important property is that after loading, source audio, reference audio, and rendered output are never uploaded.

When a large file feels slow, the bottleneck is the device's CPU and memory rather than a busy server. Practical responses are testing a shorter excerpt first, trying another browser, or running the demo on a desktop machine.

:::: details Implementation notes

The demo creates object URLs for decoded source audio, rendered WAV output, JSON reports, reference audio, and exported chain settings. These URLs point to local browser memory, not remote files. They are revoked when replaced or when the component unmounts. Preview playback, WAV export, and report saving all sit on top of this mechanism, so there is no network round-trip path for the audio itself.

Rendering and reference matching use a module worker so the UI remains responsive while libsonare WASM performs the heavier work. When the worker raises an exception, the UI side rewrites it into a shape that is easier to display, so a failure on a long file does not freeze the page.

::::

Related: [Error Recovery](../mastering/error-recovery.md), [Quality Checklist](../mastering/quality-checklist.md)
