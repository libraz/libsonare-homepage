# Realtime Voice Changer

`RealtimeVoiceChanger` is libsonare's preset-driven live voice chain. Use it when you process microphone input, monitor voice in realtime, or feed audio in repeated blocks where DSP state must continue across calls.

For a one-shot offline pitch/formant edit, use [`voiceChange(...)`](./editing-dsp.md#offline-voicechange-vs-realtimevoicechanger). For a live or chunked preset chain, use this page.

::: info Why this is a class, not just a function
Live voice processing has memory: gates, compressors, reverbs, and smooth pitch/formant changes all depend on previous blocks. `RealtimeVoiceChanger` keeps that state across calls. Recreating it for every block would sound worse and add unnecessary setup cost.
:::

## What You Will Learn

By the end of this page you should be able to:

- choose `RealtimeVoiceChanger` instead of the simpler offline `voiceChange(...)` helper;
- prepare the class for block processing and release the WASM handle correctly;
- inspect and validate built-in preset JSON before accepting user-authored presets;
- choose the right binding for browser, Python, Node native, or CLI workflows.

## When to Use It

| What you are building | Entry point | Input | Output |
|-----------------------|-------------|-------|--------|
| Live browser microphone processing | `RealtimeVoiceChanger` | Short `Float32Array` blocks from an `AudioWorklet` or similar loop | Processed blocks with the same length |
| One browser-side clip edit with only semitone and formant values | `voiceChange(...)` | A decoded mono `Float32Array` clip | Processed `Float32Array` |
| Python batch rendering through the preset chain | `voice_change_realtime(...)` | Mono samples plus `sample_rate` | Processed samples |
| Node native server or desktop batch processing | `voiceChangeRealtime(...)` | Mono samples plus sample rate | Processed samples |
| Terminal conversion from WAV/MP3 to a rendered file | `sonare voice-change --preset ...` | An audio file | An output file |
| Preset inspection, UI editing, or validation | `realtimeVoiceChangerPresetJson(...)` and validation APIs | Preset ID or JSON | Config JSON and validation result |

## Implementation Shape

For live browser processing, call `init()` and `prepare(sampleRate, maxBlockSize, channels)` before audio starts. Then call `processMono(...)` or `processMonoInto(...)` for each incoming block. `RealtimeVoiceChanger` keeps DSP state internally, so do not recreate it for every block; reuse one instance for the lifetime of the stream.

| Decision | Guideline |
|----------|-----------|
| `sampleRate` | Use `AudioContext.sampleRate` or the actual file sample rate. Do not guess a fixed 44100 / 48000 value. |
| `maxBlockSize` | The largest block you will pass to `processMono(...)`. For the standard AudioWorklet render quantum, `128` is a good starting point. |
| `channels` | The examples here are mono, so pass `1`. For interleaved input, use `processInterleaved(...)`. |
| Output buffer | Use `processMono(...)` for a simple implementation. In an AudioWorklet hot path, write into preallocated output with `processMonoInto(...)` or the heap-backed buffer path. |
| Cleanup | Call `delete()` exactly once when the component unmounts, the worklet stops, or recording ends. |

::: warning Do not mix up live processing and batch rendering
`RealtimeVoiceChanger` is the class for processing short blocks in sequence while preserving gate/compressor/reverb state. The Python and CLI examples apply the same preset chain to a whole file or array; they are not code you run inside a browser AudioWorklet callback.
:::

## Signal Chain

The realtime chain is more than a pitch shifter. Built-in presets combine these stages:

| Stage | Purpose |
|-------|---------|
| Retune | Nudges pitch toward the preset target behavior |
| Formant | Changes perceived vocal size or character independently of note pitch |
| EQ | Shapes tone before dynamics and ambience |
| Gate | Reduces low-level room or mic noise |
| Compressor | Keeps level stable across blocks |
| De-esser | Controls harsh sibilance |
| Reverb | Adds or shapes space |
| Limiter | Catches peaks at the end of the chain |

Factory preset IDs include `neutral-monitor`, `bright-idol`, `soft-whisper`, `deep-narrator`, `robot-mascot`, and `dark-villain`. Treat these as starting points, not genre or identity labels.

## Browser / WASM

```typescript
import {
  init,
  RealtimeVoiceChanger,
  realtimeVoiceChangerPresetNames,
} from '@libraz/libsonare';

await init();

const changer = new RealtimeVoiceChanger('bright-idol');
changer.prepare(48000, 128, 1);

try {
  const out = changer.processMono(inputBlock);
  changer.setConfig('soft-whisper');
  console.log(realtimeVoiceChangerPresetNames(), changer.latencySamples(), out);
} finally {
  changer.delete();
}
```

For AudioWorklet-style loops, use the heap-backed realtime buffers documented in [Browser / WASM](./wasm.md#realtime-voice-changer). They avoid allocating a new output array on every render quantum.

## Preset JSON

Use preset JSON when you need to inspect, store, or validate voice-chain settings.

```typescript
import {
  realtimeVoiceChangerPresetJson,
  validateRealtimeVoiceChangerPresetJson,
} from '@libraz/libsonare';

const json = realtimeVoiceChangerPresetJson('bright-idol');
const validation = validateRealtimeVoiceChangerPresetJson(json);

if (!validation.ok) {
  throw new Error(validation.errors.join('\n'));
}
```

Current built-in preset JSON uses schema version `1`. The native POD-config ABI is separate; check it with `voiceChangerAbiVersion()` when you are crossing FFI or native boundaries.

If you only need a canonical preset ID or the resolved flat native config, use `voiceCharacterPresetId(...)` and `realtimeVoiceChangerPresetConfig(...)` instead of round-tripping through JSON. Python exposes the same native-config path as `realtime_voice_changer_preset_pod(...)`.

## Python

```python
import libsonare as sonare

print(sonare.voice_character_preset_id(1))
preset_config = sonare.realtime_voice_changer_preset_pod("bright-idol")

with sonare.RealtimeVoiceChanger(48000, preset="bright-idol", max_block_size=128) as changer:
    out = changer.process_mono(input_block)
    changer.set_config("soft-whisper")
    print(sonare.realtime_voice_changer_preset_names(), preset_config, changer.latency_samples())

processed = sonare.voice_change_realtime(vocal, sample_rate=48000, preset="soft-whisper")
```

Use the context manager or call `close()` so the native handle is released.

## Node Native

```typescript
import {
  RealtimeVoiceChanger,
  realtimeVoiceChangerPresetNames,
  voiceChangeRealtime,
} from '@libraz/libsonare-native';

const changer = new RealtimeVoiceChanger({
  sampleRate: 48000,
  maxBlockSize: 128,
  channels: 1,
  preset: 'bright-idol',
});

const blockOut = changer.processMono(inputBlock);
const rendered = voiceChangeRealtime(vocal, 48000, 'soft-whisper');
console.log(realtimeVoiceChangerPresetNames(), blockOut, rendered);
```

Use Node native when you need native file decoding, server-side batch work, or desktop integration. Use browser/WASM when the microphone and UI live in the browser.

## CLI

The `sonare voice-change` command has two modes:

| Mode | Options |
|------|---------|
| Simple pitch/formant edit | `--pitch-semitones`, `--formant-factor` |
| Realtime preset-chain render | `--preset`, `--preset-json`, `--preset-pack`, `--set PATH=VALUE` |

```bash
sonare voice-presets --json
sonare voice-change vocal.wav --preset soft-whisper -o rendered.wav
```

If you pass realtime preset options, the command uses the preset chain and ignores the simple pitch/formant options. See [CLI Reference](./cli.md#realtime-voice-presets) for the full command table.

## Practical Notes

Realtime voice processing is stateful. Reuse the same changer across blocks, keep block sizes within the prepared maximum, and release handles when the component or stream stops.

Large pitch, formant, or ambience moves can be useful for sound design, but they will be less transparent. For natural monitoring, keep preset edits conservative and watch latency with `latencySamples()`.

## Related Pages

- [Editing DSP](./editing-dsp.md)
- [Browser / WASM](./wasm.md#realtime-voice-changer)
- [JavaScript API](./js-api.md#realtimevoicechanger)
- [Python API](./python-api.md#realtime-voice-changer)
- [Node.js Native](./native-bindings.md#streaming-and-realtime-classes)
