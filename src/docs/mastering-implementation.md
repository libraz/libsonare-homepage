---
title: Mastering Implementation
description: How the browser mastering demo maps UI decisions to libsonare WASM processing — an offline repair step, a fixed insert chain on the realtime engine, and a three-lane A/B.
---

# Mastering Implementation

This page explains how the `/mastering` demo turns a small set of user decisions into a deterministic libsonare mastering render. It is not a generated parameter dump. Use it as the implementation map that connects the UI, worker, realtime engine, WASM exports, and the grouped glossary guides.

The browser demo keeps long-form explanation in VitePress docs. The application UI only shows short labels and links into these pages.

::: info Worker, transferable buffer, and object URL
A **worker** runs JavaScript off the main UI thread. A **transferable buffer** lets the app hand audio memory to that worker without copying it. An **object URL** is a temporary browser-local URL for playback or download of generated audio/report data.
:::

## What You Will Learn

By the end of this page you should be able to:

- trace the browser mastering demo from file input through the repair preprocess, the live insert chain, metering, export, and report generation;
- understand why explanatory text lives in docs while the app UI stays compact;
- map UI controls to insert slots and glossary pages;
- know how the After, Before, and Reference lanes make a gapless, loudness-matched A/B/R;
- know which docs check keeps the mastering API documentation aligned with the WASM declarations.

## Render Path

<FlowDiagram
  title="Render path"
  :nodes="[
    { id: 'file', label: 'Audio file', col: 0, row: 0 },
    { id: 'decode', label: 'Web Audio decode', col: 1, row: 0 },
    { id: 'buffers', label: 'Float32 buffers', col: 2, row: 0 },
    { id: 'worker', label: 'Repair preprocess (worker)', col: 3, row: 0, variant: 'accent' },
    { id: 'lanes', label: 'Realtime engine: After / Before / Reference lanes', col: 4, row: 0, variant: 'accent' },
    { id: 'meters', label: 'Live meters and A/B/R', col: 5, row: 0 },
    { id: 'export', label: 'Export render (worker, same operations)', col: 5, row: 1, variant: 'accent' },
    { id: 'wav', label: 'WAV with dither', col: 6, row: 1, variant: 'success' },
    { id: 'json', label: 'JSON report', col: 7, row: 1, variant: 'success' }
  ]"
  :edges="[
    { from: 'file', to: 'decode' },
    { from: 'decode', to: 'buffers' },
    { from: 'buffers', to: 'worker' },
    { from: 'worker', to: 'lanes' },
    { from: 'lanes', to: 'meters' },
    { from: 'worker', to: 'export' },
    { from: 'export', to: 'wav' },
    { from: 'export', to: 'json' }
  ]"
  caption="Repair runs once offline. Listening and export use the same engine operations, so the file contains what the lane played."
/>

Decoding uses browser APIs. The repair stages (declip, declick, decrackle, dehum, denoise, dereverb) are offline-only, so they run first in a worker and produce the program clip the engine plays; they rerun only when a repair setting changes. Everything after that is the realtime engine: the page plays it through the `SonareEngine` AudioWorklet facade in postMessage mode, which keeps the site free of SharedArrayBuffer.

The engine holds three lanes. **After** carries the program through the insert chain and an 8-band strip EQ. **Before** is the same program with no processing, and **Reference** is the optional reference file. The A/B/R switch moves lane faders, so all three lanes keep running and the switch has no gap. Each lane is loudness-matched on the way out: the louder lanes are turned down to the quietest one, and nothing is turned up. Turning matching off leaves every lane at unity.

Export renders lane 1 on a plain `RealtimeEngine` in a worker with the same operations the live engine received. Preview and export render bit-exact from the same state, and the worker hands the PCM back for WAV encoding at 16-bit, 24-bit, or 32-bit float, with optional dither. The 32-bit float format is never dithered.

## The Insert Chain

Lane 1 has a fixed column of 13 insert slots. Turning a module on or off is a bypass, so slot indices and automation ids never move.

| Slot | Processor |
|------|-----------|
| Input | `utility.gain` |
| Tone | `eq.tilt` |
| De-esser | `dynamics.deesser` |
| Transient | `dynamics.transientShaper` |
| Compressor | `dynamics.compressor` |
| Multiband | `multiband.compressor` |
| Tape | `saturation.tape` |
| Exciter | `saturation.exciter` |
| Air | `spectral.airBand` |
| Stereo | `stereo.imager` |
| Mono bass | `stereo.monoMaker` |
| Drive | `utility.gain`, just before the limiter |
| Limiter | `maximizer.truePeakLimiter` |

Continuous controls go to the engine as parameter setters, so a knob keeps the processor's state. A few construction-only parameters, such as a multiband knee or the limiter's lookahead, rebuild the strip's inserts; the UI applies those when the control is released.

The loudness fit moves only the Drive gain in front of the limiter, so the level feeding the dynamics stages never changes. It renders at most three times, and it reports a result as limited when the limiter cannot reach the target at the chosen ceiling.

The meter bridge shows peak, true peak (held since playback started), momentary, short-term and integrated loudness, peak-to-loudness ratio, the deepest gain reduction in the chain, correlation, a goniometer, and a spectrum for the lane being heard, plus the loudness range of the last export render. Every edit is one history entry, so undo and redo reach the engine like any other edit.

## Data Ownership

Audio stays on the user's device. The source file, optional reference file, rendered WAV, JSON report, and exported settings are represented as local browser objects. They are not uploaded for rendering.

This matters for implementation because the UI cannot depend on server retries, remote queues, or account state. Errors must be recoverable locally: try another browser-supported format, reduce the source length, lower an aggressive setting, or export again after a worker failure.

## UI To Chain Mapping

Quick Master exposes musical choices. Studio exposes grouped controls. Both routes edit the same project state, which maps onto the insert chain above.

| UI area | Chain area | Main docs |
|---------|------------|-----------|
| Repair stages, input gain | Offline repair and the Input slot | [Repair and Input Controls](./glossary/mastering/repair.md) |
| Tone, exciter, air | Tone and air | [Tone and Air Controls](./glossary/mastering/tone-air.md) |
| Threshold, ratio, attack, release | Dynamics | [Dynamics Controls](./glossary/mastering/dynamics.md) |
| Width, ceiling, target LUFS | Stereo, Drive, and Limiter slots | [Stereo, Limiter, and Loudness Controls](./glossary/mastering/stereo-limiter-loudness.md) |
| Source/reference comparison | Pair analysis | [Reference Match](./glossary/mastering/reference-match.md) |
| LUFS, true peak, crest, correlation | Metering | [Reading Mastering Meters](./glossary/mastering/meter-reading.md) |

::: info Reading correlation
Correlation (phase correlation, roughly −1 to +1) measures how similar the left and right channels are. Near +1 is mono-safe; near 0 is wide; negative values warn that the mix may partly cancel when folded to mono.
:::

The grouped pages are intentionally broad. A compressor page can explain threshold, ratio, attack, release, knee, detector behavior, and gain-reduction reading together; splitting those into one page per parameter would hide the actual decision.

::: info Compressor vocabulary
*Threshold* is the level where compression starts; *ratio* sets the slope above it (for example, 4:1 maps 4 dB above threshold to 1 dB of output rise); *attack*/*release* set how fast the gain follows and recovers; *knee* sets the transition width around threshold; *gain reduction* is how many dB the processor is currently turning the signal down.
:::

## Algorithm Boundaries

The demo does not reimplement the mastering algorithms in Vue. Vue owns interaction, validation, local playback state, and display. libsonare owns DSP.

:::: details Implementation notes
The state is one plain, serializable object: no audio, only the settings. Each edit is a pure mutator that produces the next state, and the difference between two states becomes the smallest list of engine operations. `src/utils/engineApply.ts` interprets that list for the live facade and for the export worker's raw engine, which is why the two cannot drift apart.

The exported result is treated as immutable. The loudness match only changes monitor lane gains; it never enters the exported WAV. When the loudness fit is out of date, export refits first and writes the fitted drive back to the state, so the file and the preview stay the same. Reports record rendered metrics, preset names, target values, and tuning values from the actual render rather than from UI defaults.
::::

## WASM API Surface

The docs track the public mastering API exported by `src/wasm/index.d.ts`. The verification script extracts current `mastering*` and `masterAudio*` functions from that declaration file and requires the JavaScript and native binding docs to mention them.

Run `yarn check:mastering-docs` after changing the mastering worker, WASM declarations, processor docs, or this implementation map. The check keeps this page, the JavaScript API page, and the native binding page aligned with the current exported API.

Use these entry points by intent:

| Intent | API family |
|--------|------------|
| Use a preset | `masterAudio()`, `masterAudioStereo()`, `masteringPresetNames()` |
| Run a full chain | `masteringChain()`, `masteringChainStereo()` |
| Show progress | `masteringChainWithProgress()`, `masteringChainStereoWithProgress()` |
| Render block-by-block | `StreamingMasteringChain` (`prepare` / `processMono` / `processStereo` / `flushMono` / `flushStereo` / `setParameter` / `reset` / `latencySamples` / `stageNames`) |
| Run one named processor | `masteringProcessorNames()`, `masteringProcess()`, `masteringProcessStereo()` |
| Compare source and reference | `masteringPairProcessorNames()`, `masteringPairProcess()`, `masteringPairAnalysisNames()`, `masteringPairAnalyze()` |
| Analyze stereo output | `masteringStereoAnalysisNames()`, `masteringStereoAnalyze()` |
| Profile, suggest, and preview | `masteringAudioProfile()`, `masteringAssistantSuggest()`, `masteringStreamingPreview()` |

After the last input block, call `flushMono()` or `flushStereo()` until it returns an empty buffer. Skipping the flush drops the chain's delayed samples and finite processor tails from the rendered output.

::: info What the progress callback counts
`masteringChainWithProgress()` and `masteringChainStereoWithProgress()` report the fraction of **enabled DSP stages** completed so far, along with the name of the stage that just finished. Disabled stages are not counted, so the denominator is the chain you actually configured, not the full stage list.

The fraction reaches 1.0 as the last DSP stage returns. The trailing work — output measurement, spectrum, and the band deltas that go into the returned report — happens after that and reports nothing, so the call keeps running for a moment once the bar is full. Drive a progress bar from the callback, but hold the UI in its working state until the call itself resolves rather than until the fraction hits 1.0.
:::

Related: [Browser Local Processing](./glossary/concepts/browser-local-processing.md), [Mastering](./glossary/mastering.md), [JavaScript API](./js-api-mastering.md), [WASM](./wasm.md)

For the complete named processor, preset, pair-analysis, and stereo-analysis lists, see [Mastering Processors](./mastering-processors.md). For assistant suggestions and profile construction, see [Mastering Assistant](./mastering-assistant.md).
