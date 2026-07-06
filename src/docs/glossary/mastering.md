---
title: Mastering
description: What mastering does and how the libsonare browser demo approaches it.
---

# Mastering

Mastering is the final processing step before release. It prepares a mix for distribution by balancing perceived loudness, broad tonal shape, dynamics, stereo image, and peak safety.

In the libsonare demo, mastering runs locally in WebAssembly. The file is decoded in the browser, processed through a configurable chain, and exported as WAV without uploading audio to a server.

## What It Controls

| Area | Goal |
|------|------|
| Loudness | Match the selected target such as -14 LUFS or -16 LUFS. |
| Tone | Make broad corrections without remixing individual instruments. |
| Dynamics | Control peaks and density while preserving movement. |
| Stereo | Keep width useful without breaking mono compatibility. |
| Peaks | Avoid clipping after conversion or streaming playback. |

## In The Demo

Use Quick Master for preset-driven rendering. Use Studio to adjust module-level controls such as compressor threshold, air band amount, stereo width, limiter ceiling, and lookahead.

## Processing Chain

The browser demo presents the chain as a small number of musical decisions, but the render still follows a deterministic DSP path. Each stage only sees the audio after every earlier stage has run, so corrective work (repair, tone) always happens before the stages that depend on a clean, balanced signal (dynamics, stereo, limiting, loudness).

<FlowDiagram
  title="Mastering chain"
  :nodes="[
    { id: 'decode', label: 'Decoded source', col: 0, row: 0 },
    { id: 'repair', label: 'Repair + input', col: 1, row: 0 },
    { id: 'tone', label: 'Tone + air', col: 2, row: 0 },
    { id: 'dynamics', label: 'Dynamics', col: 3, row: 0 },
    { id: 'stereo', label: 'Stereo image', col: 4, row: 0 },
    { id: 'limiter', label: 'True-peak limiter', col: 5, row: 0 },
    { id: 'loudness', label: 'Loudness target', col: 6, row: 0 },
    { id: 'export', label: 'WAV + report', col: 7, row: 0, variant: 'success' }
  ]"
  :edges="[
    { from: 'decode', to: 'repair' },
    { from: 'repair', to: 'tone' },
    { from: 'tone', to: 'dynamics' },
    { from: 'dynamics', to: 'stereo' },
    { from: 'stereo', to: 'limiter' },
    { from: 'limiter', to: 'loudness' },
    { from: 'loudness', to: 'export' }
  ]"
  caption="Corrective stages run first; peak safety and loudness are locked in last."
/>

The grouped guides below explain the implementation details without splitting every parameter into a thin page:

- [Repair and Input Controls](./mastering/repair.md)
- [Tone and Air Controls](./mastering/tone-air.md)
- [Dynamics Controls](./mastering/dynamics.md)
- [Stereo, Limiter, and Loudness Controls](./mastering/stereo-limiter-loudness.md)
- [Reference Match](./mastering/reference-match.md)
- [Reading Mastering Meters](./mastering/meter-reading.md)

:::: details Implementation notes

The chain is intentionally ordered from corrective stages to final delivery stages.

| Stage area | Why it appears there |
|------------|----------------------|
| Repair and input gain | Clicks, noise, DC offset, or very low input level can mislead later detectors |
| Broad tone shaping | Dynamics should react to the tonal balance the listener will hear |
| Stereo processing | Widening can change peak relationships and mono compatibility, so limiter and meter stages need to see it |

The final loudness stage should not be treated as a simple gain knob.

Integrated LUFS is measured over the rendered material. True peak is checked on an oversampled path. The limiter ceiling remains a separate safety constraint.

When these stages disagree, peak safety wins over target loudness. Otherwise a master can pass a LUFS target while still clipping after codec conversion.

::::

Related: [LUFS](./lufs.md), [True Peak](./true-peak.md), [A/B comparison](./ab-comparison.md), [Browser Local Processing](./concepts/browser-local-processing.md), [Mastering Implementation](../mastering-implementation.md)
