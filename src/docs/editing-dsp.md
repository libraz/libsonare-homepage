# Editing DSP

libsonare exposes editing-oriented DSP alongside the analysis and mastering APIs. These functions work on decoded mono `Float32Array` or Python sample sequences and are useful for simple vocal correction, note edits, and voice design.

Use this page when you already have audio samples and want to change the sound itself. If you only want to measure BPM, key, chords, or features, start with [Getting Started](./getting-started.md) instead.

If *semitone*, *MIDI note number*, or *formant* are unfamiliar, read [Editing Basics](./glossary/concepts/editing-basics.md) first — this page assumes that vocabulary and focuses on which function to call.

::: info DSP vs editing
DSP means Digital Signal Processing: measuring or transforming audio as a signal. The editing DSP on this page does more than measure BPM or key; it rewrites the sound itself, changing pitch, duration, or vocal character.
:::

## What You Will Learn

By the end of this page you should be able to:

- distinguish analysis APIs from editing APIs that actually rewrite the signal;
- choose time stretch, pitch shift, pitch correction, note stretch, spectral edit, or voice change by musical intent;
- choose the offline `voiceChange(...)` helper versus the block-safe realtime voice changer;
- convert between seconds, samples, semitones, and MIDI notes without guessing;
- understand why large pitch/formant moves create artifacts and how to keep edits conservative.

## Which Edit Do You Need?

| Goal | Use | Beginner note |
|------|-----|---------------|
| Make a clip longer or shorter without changing the note | Time stretch | `rate` is a playback-speed multiplier: `rate=2.0` plays twice as fast, so the clip is half as long; `rate=0.5` is half speed and twice as long. The pitch does not change. (Note: `noteStretch`'s `stretchRatio` is a length multiplier, so it works the opposite way.) |
| Move the whole clip up or down in pitch | Pitch shift | `semitones=12` means one octave up; `-12` means one octave down |
| Nudge a vocal note toward a target note | Pitch correction | You must know or estimate the current pitch first |
| Hold or shorten one note region | Note stretch | Region positions are sample offsets, not seconds; `stretchRatio > 1` lengthens the region |
| Attenuate or heal a time-frequency region | Spectral edit | Draw a rectangle in samples and Hz, then apply `gain`, `attenuate`, `mute`, or `heal` |
| Change vocal character | Voice change | Pitch changes the note; formant changes the perceived body or character of the voice |
| Process live voice blocks with presets | Realtime voice changer | Use this for AudioWorklet, monitoring, or chunked processing where DSP state must continue across blocks |

::: details What is a formant?
A formant is a peak of acoustic energy in a particular frequency range. It is created by resonances of the vocal tract.

Formants shape the vowel sound and the perceived size or character of a voice, *independent* of the pitch (the note being sung).

That is why `voiceChange` separates the two controls. Lowering the formant factor makes a voice sound larger and darker. Raising it makes the voice sound smaller and brighter. The pitch stays where you set it.
:::

<SonareDemo id="pitch-shift" />

<SonareDemo id="time-stretch" />

## Functions

Parameters like `f0Hz` (a per-frame pitch contour), `hopLength`, and `voiced` are defined under [Time-varying pitch correction](#time-varying-pitch-correction) below.

| Task | WASM / browser JavaScript | Python |
|------|---------------------------|--------|
| Shift the whole signal without changing duration | `pitchShift(samples, sampleRate, semitones)` | `pitch_shift(samples, sample_rate, semitones)` |
| Time-stretch the whole signal without changing pitch | `timeStretch(samples, sampleRate, rate)` | `time_stretch(samples, sample_rate, rate)` |
| Correct from one MIDI note to another | `pitchCorrectToMidi(samples, sampleRate, currentMidi, targetMidi)` | `pitch_correct_to_midi(samples, sample_rate, current_midi, target_midi)` |
| Follow a per-frame pitch contour toward a note | `pitchCorrectToMidiTimevarying(samples, f0Hz, targetMidi, sampleRate, hopLength, voiced?, voicedProb?)` | `pitch_correct_to_midi_timevarying(samples, f0_hz, target_midi, sample_rate, hop_length, voiced?, voiced_prob?)` |
| Snap a contour to a musical scale (auto-tune) | `pitchCorrectTimevarying(samples, f0Hz, sampleRate, hopLength, options)` | `pitch_correct_timevarying(samples, f0_hz, sample_rate, hop_length, *, mode=..., scale_root=..., ...)` |
| Stretch only a note region | `noteStretch(samples, sampleRate, { onsetSample, offsetSample, stretchRatio })` | `note_stretch(samples, sample_rate, onset_sample, offset_sample, stretch_ratio)` |
| Edit a time-frequency region | `spectralEdit(samples, sampleRate, ops, options?)` | `spectral_edit(samples, sample_rate, ops, ...)` |
| Shift pitch and formants independently | `voiceChange(samples, sampleRate, { pitchSemitones, formantFactor })` | `voice_change(samples, sample_rate, pitch_semitones, formant_factor)` |
| Stateful realtime voice preset chain | `RealtimeVoiceChanger` | `RealtimeVoiceChanger` |
| One-shot realtime voice preset render | `voiceChangeRealtime(samples, sampleRate, preset, options?)` | `voice_change_realtime(samples, sample_rate, preset)` |

::: tip Shared positional order
Since v1.5.1, WASM and Node native use the same positional order for `timeStretch`, `pitchShift`, and `voiceChangeRealtime`: samples first, then sample rate, then the edit amount or preset.
:::

## Usage

::: code-group

```typescript [Browser]
import { init, noteStretch, pitchCorrectToMidi, voiceChange } from '@libraz/libsonare';

await init();

const tuned = pitchCorrectToMidi(vocal, sampleRate, 68.7, 69);
const heldNote = noteStretch(vocal, sampleRate, { onsetSample: 12000, offsetSample: 24000, stretchRatio: 1.25 });
const character = voiceChange(vocal, sampleRate, { pitchSemitones: 5, formantFactor: 1.1 });
```

```python [Python]
import libsonare as sonare

tuned = sonare.pitch_correct_to_midi(vocal, sample_rate, current_midi=68.7, target_midi=69)
held_note = sonare.note_stretch(vocal, sample_rate, onset_sample=12000, offset_sample=24000, stretch_ratio=1.25)
character = sonare.voice_change(vocal, sample_rate, pitch_semitones=5, formant_factor=1.1)
```

```bash [CLI]
# The sonare CLI loads and writes WAV/MP3 directly
sonare pitch-correct vocal.wav --current-midi 68.7 --target-midi 69 -o tuned.wav
sonare note-stretch vocal.wav --onset 12000 --offset 24000 --ratio 1.25 -o held.wav
sonare voice-change vocal.wav --pitch-semitones 5 --formant-factor 1.1 -o character.wav
```

:::

For rectangular time/frequency edits such as whistle attenuation or short artifact repair, see [Spectral Editing](./spectral-editing.md).

### How `pitchCorrectToMidi(...)` works

`pitchCorrectToMidi(...)` takes two MIDI note numbers: the pitch the audio currently has, and the pitch you want it to move toward. It does not detect the current pitch by itself. The caller provides `currentMidi` / `current_midi`.

The usual workflow is:

1. Estimate the current pitch with `pitchYin(...)`, `pitchPyin(...)`, or your own detector.
2. Pass the measured pitch as `currentMidi`.
3. Pass the target note as `targetMidi`.

```typescript
const currentMidi = 68.7; // slightly below A4
const targetMidi = 69;    // A4
const tuned = pitchCorrectToMidi(vocal, sampleRate, currentMidi, targetMidi);
```

### Time-varying pitch correction

::: info F0, frames, and "voiced"
**F0** is the fundamental frequency — the pitch — measured in Hz. A pitch detector reports one F0 per short time slice (a **frame**, here one `hopLength` of samples), giving an F0 **contour** that traces how the pitch moves. A frame is **voiced** when the singer is actually producing pitched sound (a sung vowel) rather than a breath or silence; only voiced frames are worth retuning.
:::

`pitchCorrectToMidi(...)` applies a single constant transpose, which flattens any vibrato or drift in the take. When you want to keep that expression while still pulling the note toward a target, use `pitchCorrectToMidiTimevarying(...)`. Instead of one current-pitch number, it follows a caller-supplied **per-frame F0 contour** and retunes every voiced frame toward `targetMidi`, so the natural pitch movement is tracked rather than ironed out.

```typescript
import { init, pitchPyin, pitchCorrectToMidiTimevarying } from '@libraz/libsonare';

await init();

const frameLength = 512;
const hopLength = 512;

// 1. Measure a per-frame F0 contour (any detector that emits one F0 per hop).
const pitch = pitchPyin(vocal, sampleRate, frameLength, hopLength, 65, 1000, 0.3);

// 2. Retune every voiced frame toward A3 (MIDI 57) while keeping the contour.
const tuned = pitchCorrectToMidiTimevarying(
  vocal,
  pitch.f0,          // Float32Array, one F0 (Hz) per analysis frame
  57,                // target MIDI note
  sampleRate,
  hopLength,         // frame i covers sample i * hopLength
  pitch.voicedFlag,  // optional: only retune voiced frames
  pitch.voicedProb,  // optional: voicing probability in [0, 1]
);
```

`voiced` (non-zero = voiced) and `voicedProb` are optional; omit them to treat every frame as voiced. Use the same `hopLength` that produced the F0 contour, so frame `i` lines up with sample `i * hopLength`.

::: tip Constant vs contour-following correction
Use `pitchCorrectToMidi(...)` for a steady held note where one transpose is enough. Reach for `pitchCorrectToMidiTimevarying(...)` when the take has vibrato, slides, or drift you want to preserve while nudging it onto pitch.
:::

### Scale-snap correction (auto-tune)

The two functions above pull toward a single note. When a whole vocal line should follow a **key** — each note snapped to the nearest tone of, say, C major — use `pitchCorrectTimevarying(...)`. It takes the same per-frame F0 contour but reads its target and correction feel from an options object, and `mode: 'scale'` is the classic auto-tune behavior: every voiced frame is pulled to the closest scale tone rather than one fixed pitch.

<SonareDemo id="pitch-correct" />

```typescript
import { init, pitchPyin, pitchCorrectTimevarying } from '@libraz/libsonare';

await init();

const hopLength = 256;
const pitch = pitchPyin(vocal, sampleRate, 2048, hopLength, 65, 1000, 0.1, true);

// Snap every voiced frame to C major, gently, keeping vibrato.
const voiced = Int32Array.from(pitch.voicedFlag, (v) => (v ? 1 : 0));
const tuned = pitchCorrectTimevarying(vocal, pitch.f0, sampleRate, hopLength, {
  mode: 'scale',
  scaleRoot: 0,             // 0 = C .. 11 = B
  scaleModeMask: 0xab5,     // 12-bit degree mask: C major = {0,2,4,5,7,9,11}
  referenceMidi: 69,        // anchors the scale grid; 69 = A4 (default)
  retuneAmount: 0.8,        // 0 = bypass, 1 = full snap
  retuneSpeedMs: 15,        // larger = slower glide onto pitch
  vibratoThresholdCents: 20, // corrections under this are skipped to keep vibrato
  maxCorrectionSemitones: 2, // safety valve: clamp any single frame's jump (default 12)
  voiced,
});
```

Python exposes the same controls as keyword-only arguments rather than an options dictionary:

```python
import libsonare as sonare

hop_length = 256
pitch = sonare.pitch_pyin(vocal, sample_rate, 2048, hop_length, 65, 1000, 0.1, True)
tuned = sonare.pitch_correct_timevarying(
    vocal,
    pitch.f0,
    sample_rate,
    hop_length,
    mode="scale",
    scale_root=0,
    scale_mode_mask=0xAB5,
    reference_midi=69,
    retune_amount=0.8,
    retune_speed_ms=15,
    vibrato_threshold_cents=20,
    max_correction_semitones=2,
    voiced=pitch.voiced_flag,
)
```

`scaleModeMask` is a 12-bit mask where bit `i` enables the semitone `i` above `scaleRoot`, so any scale is expressible (C natural minor `{0,2,3,5,7,8,10}` is `0x5ad`). With `mode: 'midi'` (the default) the same function behaves like `pitchCorrectToMidiTimevarying(...)`, retuning toward `targetMidi` instead of a scale. `retuneAmount` controls how hard the snap is — lower values leave a natural, human wobble; `retuneAmount: 1` with a short `retuneSpeedMs` is the hard, robotic effect. See the interactive [pitch-correction demo](./glossary/editing/pitch-correction.md) for this in action.

`referenceMidi` (default `69` = A4) anchors where the scale grid sits, so every degree is measured from a fixed reference note. `maxCorrectionSemitones` (default `12`) is the safety valve behind the "keep correction intervals small" advice below: it hard-clamps how far a single frame can jump, so an octave-off detector glitch on one frame is bounded instead of yanking that frame a full octave. Lower it when the detector is noisy or the take should stay close to the original.

### MIDI note numbers

A MIDI note number represents pitch as a semitone index. Each whole number is one semitone, and fractional values are allowed.

Two anchors are worth memorizing:

| Note | MIDI note number | Frequency |
|------|------------------|-----------|
| C4 (middle C) | `60` | about 261.63 Hz |
| A4 | `69` | 440 Hz |

Every octave adds 12. For example, C4 is `60`, so C5 is `72`.

For the full mapping table and the `freq ↔ midi` formula, see [Editing Basics](./glossary/concepts/editing-basics.md#midi-note-numbers).

### Region selection for `noteStretch(...)`

`noteStretch(...)` takes the region in **sample offsets**, not seconds.

If your UI works in seconds, convert like this:

```typescript
const onsetSample = Math.round(onsetSeconds * sampleRate);
const offsetSample = Math.round(offsetSeconds * sampleRate);
const heldNote = noteStretch(vocal, sampleRate, { onsetSample, offsetSample, stretchRatio: 1.25 });
```

`stretchRatio` is the length multiplier for the selected region.

| `stretchRatio` | Result |
|----------------|--------|
| `1.25` | Make the region 25% longer |
| `1.0` | Keep the same length |
| `0.8` | Make the region 20% shorter |

### Offline `voiceChange(...)` vs `RealtimeVoiceChanger`

`voiceChange(...)` is the simple offline helper for a decoded mono clip: pass semitone and formant values, get a processed buffer back.

`RealtimeVoiceChanger` is the stateful preset chain used for live or chunked voice processing. It combines high-pass, gate, retune, formant, EQ, compressor, de-esser, reverb, and limiter stages. Factory preset IDs include `neutral-monitor`, `bright-idol`, `soft-whisper`, `deep-narrator`, `robot-mascot`, and `dark-villain`.

Use the realtime class when you process repeated blocks and need continuity across calls. In WASM, call `prepare(...)` and `delete()` yourself. In Python, use the context manager or `close()`.

::: code-group

```typescript [Browser]
import { init, RealtimeVoiceChanger, realtimeVoiceChangerPresetNames } from '@libraz/libsonare';

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

```python [Python]
import libsonare as sonare

with sonare.RealtimeVoiceChanger(48000, preset="bright-idol", max_block_size=128) as changer:
    out = changer.process_mono(input_block)
    changer.set_config("soft-whisper")
    print(sonare.realtime_voice_changer_preset_names(), changer.latency_samples())
```

```bash [CLI]
sonare voice-presets --json
sonare voice-change vocal.wav --preset soft-whisper -o rendered.wav
```

:::

For a preset applied to a whole buffer in one call — without managing the class yourself — use `voiceChangeRealtime(samples, sampleRate, preset, options?)`. By default it treats `samples` as mono; pass `{ channels: 2 }` to feed an **interleaved** stereo buffer (`L0, R0, L1, R1, ...`) for a stereo source, and `{ blockSize }` to set the internal render block size (default 512). The returned buffer keeps the same layout and length as the input.

### Using `Audio` methods

The `Audio` object exposes the same operations as methods. In file-based Python workflows, you can load the file once and then apply edits to the same `Audio` object without passing samples and `sample_rate` every time.

### Creative effect inserts

Beyond pitch and time transforms, two of the mixer/mastering insert processors are go-to voice and instrument color tools:

- `effects.modulation.ensemble` — a BBD-style (an analog bucket-brigade delay chorus) string-machine ensemble that thickens a thin source into a wide, chorused pad.
- `saturation.ampSim` — a guitar/bass amp color insert with preamp drive, tone stack, optional power-amp sag/transformer/NFB behavior, and guitar 4x12 or bass 8x10 cab voicing.

Load them as inserts on a strip (see [Mixing Engine](./mixing.md)) rather than as standalone functions on a raw buffer.

::: info Offline transforms vs arrange-time warp
The functions on this page are **offline** transforms: you hand them a buffer and get a new buffer back. They are different from **arrange-time warp** — clip repitch and tempo-sync inside a project, where a clip follows the timeline rather than being baked once. For that project-level workflow, see [Project Editing](./project-editing.md).
:::

The same offline-versus-realtime split shows up in the [`voiceChange(...)` versus `RealtimeVoiceChanger`](#offline-voicechange-vs-realtimevoicechanger) distinction above. It comes down to two processing shapes:

<FlowDiagram
  title="Offline buffer transform vs realtime block loop"
  :nodes="[
    { id: 'off-in', label: 'Whole buffer in', col: 0, row: 0, group: 'offline' },
    { id: 'off-fn', label: 'voiceChange() / pitchShift()', col: 1, row: 0, group: 'offline' },
    { id: 'off-out', label: 'New buffer out', col: 2, row: 0, variant: 'success', group: 'offline' },
    { id: 'rt-in', label: 'Audio block in', col: 0, row: 1, group: 'realtime' },
    { id: 'rt-fn', label: 'prepare() → processMono() loop', col: 1, row: 1, variant: 'accent', group: 'realtime' },
    { id: 'rt-out', label: 'Block out', col: 2, row: 1, variant: 'success', group: 'realtime' }
  ]"
  :edges="[
    { from: 'off-in', to: 'off-fn', label: 'all at once' },
    { from: 'off-fn', to: 'off-out' },
    { from: 'rt-in', to: 'rt-fn', label: 'per block' },
    { from: 'rt-fn', to: 'rt-out' },
    { from: 'rt-out', to: 'rt-fn', label: 'state persists', style: 'dashed' }
  ]"
  :groups="[
    { id: 'offline', label: 'Offline (stateless)' },
    { id: 'realtime', label: 'Realtime / arrange-time (stateful)' }
  ]"
  caption="Offline hands the whole signal to a function and gets one buffer back. The realtime path loops over blocks and keeps DSP state between them, so the tail of one block carries into the next."
/>

## Practical Notes

These APIs are intentionally lightweight editing tools, not a full non-destructive pitch editor. For transparent vocals, keep pitch correction intervals small and avoid extreme formant factors. For sound design, larger `pitchSemitones` and `formantFactor` moves are valid, but expect stronger artifacts.

::: info Why big moves sound worse
These transforms work by analyzing the sound into short overlapping frames and re-spacing or re-pitching them. Small shifts stay close to the original frames and sound clean; large shifts force the engine to invent material that was never recorded, so you hear smearing, a "watery" or robotic quality, and a less natural voice. That is why the advice is to keep correction intervals small for transparent results.
:::
