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
- choose time stretch, pitch shift, pitch correction, note stretch, or voice change by musical intent;
- choose the offline `voiceChange(...)` helper versus the block-safe realtime voice changer;
- convert between seconds, samples, semitones, and MIDI notes without guessing;
- understand why large pitch/formant moves create artifacts and how to keep edits conservative.

## Which Edit Do You Need?

| Goal | Use | Beginner note |
|------|-----|---------------|
| Make a clip longer or shorter without changing the note | Time stretch | A `rate` above `1.0` makes the result shorter; below `1.0` makes it longer |
| Move the whole clip up or down in pitch | Pitch shift | `semitones=12` means one octave up; `-12` means one octave down |
| Nudge a vocal note toward a target note | Pitch correction | You must know or estimate the current pitch first |
| Hold or shorten one note region | Note stretch | Region positions are sample offsets, not seconds; `stretchRatio > 1` lengthens the region |
| Change vocal character | Voice change | Pitch changes the note; formant changes the perceived body or character of the voice |
| Process live voice blocks with presets | Realtime voice changer | Use this for AudioWorklet, monitoring, or chunked processing where DSP state must continue across blocks |

::: details What is a formant?
A formant is a peak of acoustic energy at a particular frequency range, created by the resonances of the vocal tract. Formants shape the vowel sound and the perceived size or character of a voice, *independent* of the pitch (the note being sung). That is why `voiceChange` separates the two: lowering the formant factor makes a voice sound larger and darker, raising it makes it smaller and brighter, while the pitch stays where you set it.
:::

## Functions

| Task | JavaScript | Python |
|------|------------|--------|
| Shift the whole signal without changing duration | `pitchShift(samples, sampleRate, semitones)` | `pitch_shift(samples, sample_rate, semitones)` |
| Time-stretch the whole signal without changing pitch | `timeStretch(samples, sampleRate, rate)` | `time_stretch(samples, sample_rate, rate)` |
| Correct from one MIDI note to another | `pitchCorrectToMidi(samples, sampleRate, currentMidi, targetMidi)` | `pitch_correct_to_midi(samples, sample_rate, current_midi, target_midi)` |
| Stretch only a note region | `noteStretch(samples, sampleRate, onsetSample, offsetSample, stretchRatio)` | `note_stretch(samples, sample_rate, onset_sample, offset_sample, stretch_ratio)` |
| Shift pitch and formants independently | `voiceChange(samples, sampleRate, pitchSemitones, formantFactor)` | `voice_change(samples, sample_rate, pitch_semitones, formant_factor)` |
| Stateful realtime voice preset chain | `RealtimeVoiceChanger` | `RealtimeVoiceChanger` |
| One-shot realtime voice preset render | Node native: `voiceChangeRealtime(samples, sampleRate, preset)` | `voice_change_realtime(samples, sample_rate, preset)` |

## Usage

::: code-group

```typescript [Browser]
import { init, noteStretch, pitchCorrectToMidi, voiceChange } from '@libraz/libsonare';

await init();

const tuned = pitchCorrectToMidi(vocal, sampleRate, 68.7, 69);
const heldNote = noteStretch(vocal, sampleRate, 12000, 24000, 1.25);
const character = voiceChange(vocal, sampleRate, 5, 1.1);
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
const heldNote = noteStretch(vocal, sampleRate, onsetSample, offsetSample, 1.25);
```

`stretchRatio` is the length multiplier for the selected region.

| `stretchRatio` | Result |
|----------------|--------|
| `1.25` | Make the region 25% longer |
| `1.0` | Keep the same length |
| `0.8` | Make the region 20% shorter |

### Offline `voiceChange(...)` vs `RealtimeVoiceChanger`

`voiceChange(...)` is the simple offline helper for a decoded mono clip: pass semitone and formant values, get a processed buffer back.

`RealtimeVoiceChanger` is the stateful preset chain used for live or chunked voice processing. It combines retune, formant, EQ, gate, compressor, de-esser, reverb, and limiter stages. Factory preset IDs include `neutral-monitor`, `bright-idol`, `soft-whisper`, `deep-narrator`, `robot-mascot`, and `dark-villain`.

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

### Using the `Audio` wrapper

The `Audio` wrapper exposes the same operations as instance methods. In file-based Python workflows, you can load the file once and then apply edits to the same `Audio` object.

## Practical Notes

These APIs are intentionally lightweight editing tools, not a full non-destructive pitch editor. For transparent vocals, keep pitch correction intervals small and avoid extreme formant factors. For sound design, larger `pitchSemitones` and `formantFactor` moves are valid, but expect stronger artifacts.
