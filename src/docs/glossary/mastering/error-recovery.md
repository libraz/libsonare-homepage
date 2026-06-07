---
title: Error Recovery
description: What to do when a file cannot be decoded, rendering fails, or the result sounds wrong.
---

# Error Recovery

Most mastering failures fall into three groups: the browser cannot decode the file, the render is too heavy for the device, or the settings are technically valid but musically wrong.

The demo keeps error handling local. It does not send the file to a server for fallback processing.

## File Does Not Load

Try another browser-supported audio format: WAV, MP3, FLAC, or OGG. Browser decoding support can vary by operating system and browser build.

If the source is very long, test a shorter export first. This separates file-format problems from memory or processing-time problems.

## Render Fails

Rendering runs in a Web Worker, but it still uses your device's CPU and memory. Long files, high sample rates, and repair-heavy presets can take longer.

Try this order:

1. Use a shorter section to confirm the chain works.
2. Disable or reduce repair strength.
3. Use a lighter preset such as Pop or Acoustic.
4. Close other heavy tabs.
5. Export the report after a successful render so the settings are not lost.

## Result Sounds Wrong

If the master sounds worse, do not keep adding processing. Return to the smallest useful move.

::: warning When it sounds worse, subtract — don't add
The instinct to fix a bad master with *more* processing usually deepens the problem. Undo back to the last version that sounded right, then make one small change and re-check.
:::

| Symptom | First adjustment |
|---------|------------------|
| Harsh or hissy | Lower Air Band Amount or Exciter Amount. |
| Flat or lifeless | Raise Threshold, lower Ratio, or slow Attack. |
| Pumping | Slow Release or reduce compression. |
| Narrow or phasey | Lower Stereo Width and check correlation. |
| Distorted peaks | Lower the loudness target or ease off the limiter. |

## When To Revisit The Mix

Mastering cannot fix every mix issue. If the vocal is buried, the kick and bass fight, or the stereo image collapses before mastering, fix the mix first. A mastering chain can improve translation, but it should not become a rescue operation for problems that belong upstream.

:::: details Implementation notes

The UI separates local errors from worker errors:

| Work | Where it happens |
|------|------------------|
| File decoding | `AudioContext.decodeAudioData` in the browser. |
| Rendering and reference matching | A module worker. |
| Output, report, reference, and chain-setting downloads | Object URLs in local browser memory. |

Those object URLs are revoked when replaced, so repeated attempts do not leak browser memory. The same design keeps the residual footprint small if a long render is interrupted by closing the tab mid-process.

The validation script exercises the mastering presets with generated signals and checks that each preset produces finite loudness, bounded peaks, and expected stage names. That does not prove every user file will succeed, but it catches broken processor wiring before release.

::::

Related: [Repair and Input Controls](./repair.md), [Dynamics Controls](./dynamics.md), [Delivery Targets](./delivery-targets.md)
