# Realtime Voice Changer

`RealtimeVoiceChanger` is libsonare's preset-based live voice chain. Use it when you process microphone input, monitor voice in realtime, or pass audio in repeated blocks where DSP state must continue across calls.

For a one-shot offline pitch/formant edit, use [`voiceChange(...)`](./editing-dsp.md#offline-voicechange-vs-realtimevoicechanger). For a live or chunked preset chain, use this page.

::: info Blocks, sample rate, and DSP state
Realtime audio is processed in small **blocks** (groups of samples) one after another — in the browser an AudioWorklet hands you a fixed **render quantum** of 128 samples at a time. **Sample rate** (e.g. 48000) is how many samples make one second. **DSP state** is the memory an effect carries between blocks (a reverb tail, a compressor's current gain), which is why the voice changer is a reusable object rather than a one-shot function.
:::

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

*Interleaved* means the channels are stored alternately in one array (L, R, L, R…), whereas *mono* is a single channel; use `processInterleaved(...)` for the former and `processMono(...)` for the latter.

::: warning Do not mix up live processing and batch rendering
`RealtimeVoiceChanger` is the class for processing short blocks in sequence while preserving gate/compressor/reverb state. The Python and CLI examples apply the same preset chain to a whole file or array; they are not code you run inside a browser AudioWorklet callback.
:::

## Signal Chain

The realtime chain is more than a pitch shifter. Built-in presets combine these stages:

<SonareDemo id="pitch-shift" />

The demo above isolates just the **Retune** stage (pitch shift) so you can hear it on its own. In a full preset a cleanup high-pass and a noise gate run *before* the pitch shift, and EQ, dynamics, and ambience follow *after* it — the diagram shows the full order.

<FlowDiagram
  title="Preset signal chain"
  direction="TB"
  :nodes="[
    { id: 'hpf', label: 'High-pass', col: 0, row: 0, group: 'input' },
    { id: 'gate', label: 'Gate', col: 0, row: 1, group: 'input' },
    { id: 'retune', label: 'Retune', col: 0, row: 2, variant: 'accent', group: 'block' },
    { id: 'formant', label: 'Formant', col: 0, row: 3, group: 'block' },
    { id: 'eq', label: 'EQ', col: 0, row: 4, group: 'output' },
    { id: 'comp', label: 'Compressor', col: 0, row: 5, group: 'output' },
    { id: 'deesser', label: 'De-esser', col: 0, row: 6, group: 'output' },
    { id: 'reverb', label: 'Reverb', col: 0, row: 7, group: 'output' },
    { id: 'limiter', label: 'Limiter', col: 0, row: 8, variant: 'success', group: 'output' }
  ]"
  :edges="[
    { from: 'hpf', to: 'gate' },
    { from: 'gate', to: 'retune' },
    { from: 'retune', to: 'formant' },
    { from: 'formant', to: 'eq' },
    { from: 'eq', to: 'comp' },
    { from: 'comp', to: 'deesser' },
    { from: 'deesser', to: 'reverb' },
    { from: 'reverb', to: 'limiter' }
  ]"
  :groups="[
    { id: 'input', label: 'Input stage' },
    { id: 'block', label: 'Pitch & formant' },
    { id: 'output', label: 'Output stage' }
  ]"
  caption="Every block flows top to bottom in this order. The input stage (high-pass, gate) and the output stage (EQ through limiter) run sample by sample; retune and formant work on the whole block in between. A default-on true-peak limiter follows the dry/wet mix."
/>

| Stage | Purpose |
|-------|---------|
| High-pass | Removes sub-bass rumble and DC as a cleanup pre-filter (`eq.highpassHz`) |
| Gate | Reduces low-level room or mic noise between phrases |
| Retune | Shifts the note pitch up or down by the preset's semitone amount (e.g. for a higher or lower voice), and where the preset enables it, pulls held notes toward the nearest scale tone — the pitch-shift stage of the chain |
| Formant | Changes perceived vocal size or character independently of note pitch |
| EQ | Body, presence, and air tone shaping (`eq.bodyDb`/`presenceDb`/`airDb`) |
| Compressor | Keeps level stable across blocks |
| De-esser | Controls harsh sibilance |
| Reverb | Adds or shapes space |
| Limiter | Catches peaks; a 4×-oversampled true-peak limiter follows the dry/wet mix (on by default) |

::: tip
The `eq` block configures both ends of the chain: `highpassHz` is the cleanup high-pass at the very front, while `bodyDb`/`presenceDb`/`airDb` are the tonal shelves that sit after formant shaping.
:::

::: info Voice-chain terms in one place
- **High-pass** — a cleanup filter at the front that removes sub-bass rumble and DC before any other stage.
- **Gate** — mutes the signal when it drops below a threshold, removing low-level mic/room noise between phrases.
- **Retune** — moves the sung note up or down in pitch; separate from formant, which changes vocal character without moving the note.
- **Formant** — the resonances that make a voice sound large/small or male/female; shifting them changes vocal character without changing the note.
- **Compressor** — automatically evens out loud and quiet parts so the level stays steady.
- **De-esser** — tames harsh "s"/"sh" sounds (sibilance).
- **Limiter** — a safety catch that stops peaks from clipping at the very end of the chain.
:::

Factory preset IDs include `neutral-monitor`, `bright-idol`, `soft-whisper`, `deep-narrator`, `robot-mascot`, and `dark-villain`. Treat these as starting points, not genre or identity labels.

## One Flow, Every Binding

Every binding follows the same lifecycle: **construct** the changer, **prepare** it for the sample rate and block size, call **`processMono(...)`** for each block, swap presets live with **`setConfig(...)`**, and read **`latencySamples()`**. The tabs below show that one flow in each runtime — only the constructor shape and the cleanup call differ.

::: code-group

```typescript [Browser]
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
  changer.delete(); // WASM handle cleanup
}
```

```python [Python]
import libsonare as sonare

print(sonare.voice_character_preset_id(1))
preset_config = sonare.realtime_voice_changer_preset_config("bright-idol")

with sonare.RealtimeVoiceChanger(48000, preset="bright-idol", max_block_size=128) as changer:
    out = changer.process_mono(input_block)
    changer.set_config("soft-whisper")
    print(sonare.realtime_voice_changer_preset_names(), preset_config, changer.latency_samples())

# Whole-array render through the same preset chain:
processed = sonare.voice_change_realtime(vocal, sample_rate=48000, preset="soft-whisper")
```

```typescript [Node]
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

try {
  const blockOut = changer.processMono(inputBlock);
  changer.setConfig('soft-whisper');
  // Whole-array render through the same preset chain:
  const rendered = voiceChangeRealtime(vocal, 48000, 'soft-whisper');
  console.log(realtimeVoiceChangerPresetNames(), changer.latencySamples(), blockOut, rendered);
} finally {
  changer.destroy(); // native handle cleanup (WASM uses delete())
}
```

```bash [CLI]
# sonare voice-change renders a whole file through the preset chain;
# it is not a per-block realtime loop.
sonare voice-presets --json
sonare voice-change vocal.wav --preset soft-whisper -o rendered.wav
```

:::

::: warning Cleanup differs by binding
The construct/process flow is shared, but each runtime releases its native handle differently — release it exactly once.

- **Browser / WASM** — call `delete()` (in the `finally`, on component unmount, or when the worklet stops).
- **Node native** — call `destroy()`; `using` (Node 22+) can free it automatically.
- **Python** — the `with` block releases the handle; outside a `with`, call `close()`.
:::

For AudioWorklet-style loops, use the heap-backed realtime buffers documented in [Browser / WASM](./wasm.md#realtime-voice-changer). They avoid allocating a new output array on every render quantum, which the browser example's plain `processMono(...)` does.

## CLI Modes

The `sonare voice-change` command has two modes:

| Mode | Options |
|------|---------|
| Simple pitch/formant edit | `--pitch-semitones`, `--formant-factor` |
| Realtime preset-chain render | `--preset`, `--preset-json`, `--preset-pack`, `--set PATH=VALUE` |

If you pass realtime preset options, the command uses the preset chain and ignores the simple pitch/formant options. See [CLI Reference](./cli.md#realtime-voice-presets) for the full command table.

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
  throw new Error(validation.error);
}
```

Current built-in preset JSON uses schema version `1`. The native POD-config ABI is separate; check it with `voiceChangerAbiVersion()` when you are crossing FFI or native boundaries.

If you only need a canonical preset ID or the resolved flat native config, use `voiceCharacterPresetId(...)` and `realtimeVoiceChangerPresetConfig(...)` instead of round-tripping through JSON. Python exposes the same native-config path as `realtime_voice_changer_preset_config(...)`.

## Practical Notes

Realtime voice processing is stateful. Reuse the same changer across blocks, keep block sizes within the prepared maximum, and release handles when the component or stream stops.

Large pitch, formant, or ambience moves can be useful for sound design, but they will be less transparent. For natural monitoring, keep preset edits conservative and watch latency with `latencySamples()`.

::: info What "latency" means here
**Latency** is the delay between sound going in and processed sound coming out, caused by the analysis the chain has to do. `latencySamples()` reports it in samples; divide by the sample rate for seconds. Since v1.5.1 it follows the effective dry/wet mix: roughly `wetMix × retune grain`, plus the ISP limiter's fixed delay when that limiter is active. Here *grain* is the retune stage's pitch-shift analysis window measured in samples — a larger grain analyses more audio per step, so it adds more delay (see the [StreamingRetune](./js-api.md#streamingretune) `grainSize` field). Pure dry reports zero, while fully wet reports the full wet-path delay.
:::

## Related Pages

- [Editing DSP](./editing-dsp.md)
- [Browser / WASM](./wasm.md#realtime-voice-changer)
- [JavaScript API](./js-api.md#realtimevoicechanger)
- [Python API](./python-api.md#realtime-voice-changer)
- [Node.js Native API](./node-api.md#streaming-and-realtime-classes)
