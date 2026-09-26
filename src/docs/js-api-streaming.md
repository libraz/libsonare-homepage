---
title: JavaScript/TypeScript Streaming and Realtime API
description: Block-by-block EQ, pitch retune, the realtime voice changer, and the streaming mastering chain of the libsonare JavaScript/TypeScript package.
---

# JavaScript/TypeScript Streaming and Realtime API

Block-by-block processors for the libsonare JavaScript/TypeScript package: `StreamingEqualizer`, `StreamingRetune`, `RealtimeVoiceChanger` with its `voiceChangeRealtime(...)` convenience call, and `StreamingMasteringChain`; see [Mastering API](./js-api-mastering.md) for the offline chain, presets, and one-shot processors.

## StreamingEqualizer

`StreamingEqualizer` is the block-by-block EQ object used for realtime-safe processing: up to 24 bands, zero-latency/natural/linear phase modes, dynamic EQ, mid/side processing, external sidechain input, spectrum snapshots, and offline reference matching. In the WASM package, call `init()` first and `delete()` when done.

```typescript
import { init, StreamingEqualizer } from '@libraz/libsonare';
await init();

const eq = new StreamingEqualizer({ sampleRate: 48000, maxBlockSize: 512 });
try {
  eq.setBand(0, {
    type: 'HighShelf',
    frequencyHz: 8000,
    gainDb: 4,
    q: 0.7,
    enabled: true,
  });
  eq.setPhaseMode(1); // 1 = zero-latency, 2 = natural, 3 = linear
  eq.setAutoGain(true);

  const { left, right } = eq.processStereo(leftBlock, rightBlock);
  console.log(eq.spectrum(), eq.latencySamples(), left, right);
} finally {
  eq.delete();
}
```

For a first-order low or high shelf, set the band's `slopeDbOct` to `6`. Its `frequencyHz` is then where the shelf reaches half its gain change in dB, and `q` has no effect. Leaving `slopeDbOct` unset uses the regular shelf design shown above.

Source-built C++ CLI equivalents for file-based EQ and filtering:

```bash [C++ CLI]
sonare eq track.wav --type 2 --frequency-hz 8000 --gain-db 4 --q 0.7 -o eq.wav
sonare filter track.wav --type hp --cutoff 80 -o filtered.wav
```

## StreamingRetune

`StreamingRetune` is the block-by-block mono pitch retune object. It maintains grain and delay state across calls, so use `prepare()` before the first block and `delete()` when done.

```typescript
import { init, StreamingRetune } from '@libraz/libsonare';
await init();

const retune = new StreamingRetune({ semitones: 3, mix: 1, grainSize: 0 });
retune.prepare(48000, 512);

try {
  const out = retune.processMono(inputBlock);
  retune.setConfig({ semitones: -2, mix: 0.75 });
  console.log(out, retune.config(), retune.grainSize());
} finally {
  retune.delete();
}
```

Closest CLI equivalents for offline files from the source-built C++ CLI:

```bash [C++ CLI]
sonare pitch-shift vocal.wav --semitones 3 -o shifted.wav
sonare voice-change vocal.wav --pitch-semitones 3 --formant-factor 1.0 -o voice.wav
```

## RealtimeVoiceChanger

`RealtimeVoiceChanger` is the preset-based live voice chain (high-pass, gate, retune, formant, EQ, compressor, de-esser, reverb, and limiter stages) that keeps state across audio blocks. Use it for monitoring, AudioWorklet-style processing, or chunked voice rendering where `voiceChange(...)` is too simple. Factory preset IDs come from `realtimeVoiceChangerPresetNames()`; preset JSON is fetched with `realtimeVoiceChangerPresetJson(...)` and checked with `validateRealtimeVoiceChangerPresetJson(...)` (schema version `1`). `RealtimeVoiceChangerConfigInput` is strict: use one of the six `VoicePresetId` strings or a preset object with either a `dsp` object or a `macros` object, never both.

```typescript
import { init, RealtimeVoiceChanger, realtimeVoiceChangerPresetNames } from '@libraz/libsonare';
await init();

const changer = new RealtimeVoiceChanger(realtimeVoiceChangerPresetNames()[1]); // e.g. "bright-idol"
changer.prepare(48000, /*maxBlockSize=*/128, /*channels=*/1);
try {
  const out = changer.processMono(inputBlock);
  const realtime = changer.createRealtimeMonoBuffer(128); // zero-copy WASM heap view
  realtime.input.set(inputBlock.subarray(0, 128));
  realtime.process();
  console.log(out, realtime.output, changer.latencySamples());
} finally {
  changer.delete();
}
```

The zero-copy buffer helpers (`createRealtimeMonoBuffer`, `createRealtimeInterleavedBuffer`, `createRealtimePlanarBuffer`) return changer-owned WASM heap views; reuse them inside a realtime loop and discard after `delete()`. See [Realtime Voice Changer](./realtime-voice-changer.md) for the preset list and chain stages.

## `voiceChangeRealtime(samples, sampleRate?, preset?, options?)`

`voiceChangeRealtime(...)` is the offline whole-buffer convenience function around `RealtimeVoiceChanger`. It internally constructs and prepares a changer, runs the per-block render loop for you, then disposes it — matching the Python `voice_change_realtime` and Node equivalents — so callers do not manage the stateful object themselves.

```typescript
function voiceChangeRealtime(
  samples: Float32Array,
  sampleRate?: number, // default 48000
  preset?: RealtimeVoiceChangerConfigInput,
  options?: {
    channels?: 1 | 2;   // default 1 (mono); 2 = interleaved stereo (L0,R0,L1,R1,...)
    /** @deprecated Ignored — the shared C-ABI renderer uses a fixed block size. */
    blockSize?: number;
  },
): Float32Array  // same layout/length as the input
```

Use this when you already have the full buffer. Reach for [`RealtimeVoiceChanger`](#realtimevoicechanger) for manual block-by-block live use, and `voiceChange(...)` when you only need a one-shot pitch/formant change without the full preset chain.

## StreamingMasteringChain

For real-time or memory-constrained use cases, such as processing audio block-by-block from `AudioWorklet` or a stream, the WASM module exposes `StreamingMasteringChain`. It accepts a `StreamingMasteringChainConfig`, which extends `masteringChain()`'s `MasteringChainConfig` with two optional streaming-only fields:

- `loudnessStaticGainDb` — a precomputed static loudness gain in dB (e.g. `targetLufs - measuredIntegratedLufs`), applied per block so a preset's streaming preview matches its offline render with a `loudness` stage enabled.
- `loudnessStaticGainPeakDb` — the offline-measured source true-peak in dBFS. When set, the static gain is clamped to `loudness.ceilingDb - loudnessStaticGainPeakDb` so the streaming limiter does not receive a hotter input than the offline chain.

It otherwise prepares processor state for a fixed block size and applies the chain incrementally.

```typescript
import { init, StreamingMasteringChain } from '@libraz/libsonare';
await init();

const chain = new StreamingMasteringChain({
  eq: { tilt: { tiltDb: 0.5 } },
  dynamics: { compressor: { thresholdDb: -20 } },
  maximizer: { truePeakLimiter: { ceilingDb: -1, oversampleFactor: 4 } },
});

chain.prepare(48000, /*maxBlockSize=*/512, /*numChannels=*/2);

// Use the path that matches the prepared channel count: processMono() /
// flushMono() after prepare(..., 1), processStereo() / flushStereo() after
// prepare(..., 2). Mixing them throws a num_channels mismatch.
const { left, right } = chain.processStereo(leftBlock, rightBlock);

console.log(chain.stageNames());      // ['eq.tilt', 'dynamics.compressor', ...]
console.log(chain.latencySamples());  // total latency reported by active stages

// After the last input block, drain the chain latency and the finite tails.
let tail: { left: Float32Array; right: Float32Array };
while ((tail = chain.flushStereo()).left.length > 0) {
  write(tail.left, tail.right);
}

chain.reset();   // clear processor state without re-preparing
chain.delete();  // release the WASM handle (call when done)
```

`flushMono()` / `flushStereo()` emit the delayed audio plus finite processor
tails once you have no more input. Call until an empty result comes back.
Without the flush, a bounce built from a streaming chain loses its last
`latencySamples()` samples and any reverb or limiter tail. The first
`latencySamples()` samples of the concatenated stream are the chain's delay and
should be dropped for a time-aligned result.

Stereo-only stages are skipped when `numChannels === 1`. The chain-config repair stages (`repair.declick`, `repair.dereverb`, `repair.denoise`, `repair.declip`, `repair.decrackle`, `repair.dehum`) are offline-only and throw if enabled on the streaming constructor — run them through `masteringChain*` / `masterAudio*`, or the one-shot `masteringRepair*` helpers. The `loudness` stage also throws unless you supply `loudnessStaticGainDb` (optionally with `loudnessStaticGainPeakDb`), since the streaming chain cannot measure whole-signal integrated LUFS. Call `reset()` between independent songs and `delete()` to free the handle.
