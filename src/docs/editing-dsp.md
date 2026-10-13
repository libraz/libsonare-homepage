# Editing DSP

libsonare exposes editing-oriented DSP alongside the analysis and mastering APIs. These functions work on decoded mono `Float32Array` or Python sample sequences and are useful for simple vocal correction, note edits, and voice design.

Use this page when you already have audio samples and want to change the sound itself. If you only want to measure BPM, key, chords, or features, start with [Getting Started](./getting-started.md) instead.

If *semitone*, *MIDI note number*, or *formant* are unfamiliar, read [Editing Basics](./glossary/concepts/editing-basics.md) first — this page assumes that vocabulary and focuses on which function to call.

::: info DSP vs editing
DSP means Digital Signal Processing: measuring or transforming audio as a signal. The editing DSP on this page does more than measure BPM or key; it rewrites the sound itself, changing pitch, duration, or vocal character.
:::

## What You Will Learn

Pick the edit from the table below, then read its section. The decisions the table does not make for you:

- the offline `voiceChange(...)` helper versus the block-safe realtime voice changer;
- seconds, samples, semitones, and MIDI notes, and how to convert between them;
- why large pitch/formant moves create artifacts and how to keep edits conservative.

## Which Edit Do You Need?

| Goal | Use | Beginner note |
|------|-----|---------------|
| Make a clip longer or shorter without changing the note | Time stretch | `rate` is a playback-speed multiplier: `rate=2.0` plays twice as fast, so the clip is half as long; `rate=0.5` is half speed and twice as long. The pitch does not change. (Note: `noteStretch`'s `stretchRatio` is a length multiplier, so it works the opposite way.) |
| Move the whole clip up or down in pitch | Pitch shift | `semitones=12` means one octave up; `-12` means one octave down |
| Nudge a vocal note toward a target note | Pitch correction | You must know or estimate the current pitch first |
| Hold or shorten one note region | Note stretch | Region positions are samples or seconds (`onsetSec` / `offsetSec`), never negative; `stretchRatio > 1` lengthens the replacement region, and the whole-clip shift follows that region-length change |
| Attenuate or heal a time-frequency region | Spectral edit | Draw a rectangle in samples and Hz, then apply `gain`, `attenuate`, `mute`, or `heal` |
| Change vocal character | Voice change | Pitch changes the note; formant changes the perceived body or character of the voice |
| Process live voice blocks with presets | Realtime voice changer | Use this for AudioWorklet, monitoring, or chunked processing where DSP state must continue across blocks |

::: details What is a formant?
A formant is a peak of acoustic energy in a particular frequency range. It is created by resonances of the vocal tract.

Formants shape the vowel sound and the perceived size or character of a voice, *independent* of the pitch (the note being sung).

That is why `voiceChange` separates the two controls. Lowering the formant factor makes a voice sound larger and darker. Raising it makes the voice sound smaller and brighter. The note stays where `pitchSemitones` puts it, because the formant stage moves only the spectral envelope.
:::

<SonareDemo id="formant-shift" />

<SonareDemo id="pitch-shift" />

<SonareDemo id="time-stretch" />

## Units: notes, samples, and seconds

Every call below takes pitch as a MIDI note number or a semitone count, and positions as samples or seconds. These two tables are the conversions the examples rely on.

### MIDI note numbers

A MIDI note number represents pitch as a semitone index. Each whole number is one semitone, and fractional values are allowed.

Two anchors are worth memorizing:

| Note | MIDI note number | Frequency |
|------|------------------|-----------|
| C4 (middle C) | `60` | about 261.63 Hz |
| A4 | `69` | 440 Hz |

Every octave adds 12. For example, C4 is `60`, so C5 is `72`.

For the full mapping table and the `freq ↔ midi` formula, see [Editing Basics](./glossary/concepts/editing-basics.md#midi-note-numbers).

### Samples and seconds

Every edit position can be given in samples or in seconds. Give one spelling per bound; supplying both is refused.

| Call | Samples | Seconds | Python (seconds) |
|------|---------|---------|------------------|
| `spectralEdit` region | `startSample` / `endSample` | `startSec` / `endSec` | `start_sec` / `end_sec` |
| `noteStretch`, `noteMove` | `onsetSample` / `offsetSample`; `noteMove` also `targetOnsetSample` | `onsetSec` / `offsetSec`; `targetOnsetSec` | `onset_sec` / `offset_sec`; `target_onset_sec` |
| `renderNotes`, `renderPercussiveEvents` | `onsetSample` / `offsetSample`; edit `timeOffsetSamples` | `onsetSec` / `offsetSec`; `timeOffsetSec` | `onset_sec` / `offset_sec`; `time_offset_sec` |
| Vocal `setSourceSpan` | `sourceStartSample`, `sourceEndSample`, `destinationStartSample`, `destinationLengthSamples` | the same names ending `Sec` | `source_start_sec` and the matching fields |
| Vocal `split` | `sourceSample` | `sourceSec` | `cut_source_sample` / `cut_source_sec` |
| Vocal render `range` | `startSample` / `endSample` | `startSec` / `endSec` | `start_sec` / `end_sec` keywords |

- Seconds are rounded to the nearest sample at the call's sample rate (a vocal session's own rate for the vocal rows).
- A negative position is refused: `RangeError` on WASM and Node, `SonareValueError` in Python.
- `-1` is not a "to the end" sentinel. Omit an end bound to take the input's edge (Python: `None`).

If a position comes from analysis, keep the sample value; it avoids a second rounding.

## Functions

Parameters like `f0Hz` (a per-frame pitch contour), `hopLength`, and `voiced` are defined under [Time-varying pitch correction](#time-varying-pitch-correction) below.

| Task | WASM / browser JavaScript | Python |
|------|---------------------------|--------|
| Shift the whole signal without changing duration | `pitchShift(samples, sampleRate, semitones)` | `pitch_shift(samples, sample_rate, semitones)` |
| Time-stretch the whole signal without changing pitch | `timeStretch(samples, sampleRate, rate)` | `time_stretch(samples, sample_rate, rate)` |
| Correct from one MIDI note to another | `pitchCorrectToMidi(samples, sampleRate, currentMidi, targetMidi)` | `pitch_correct_to_midi(samples, sample_rate, current_midi, target_midi)` |
| Follow a per-frame pitch contour toward a note | `pitchCorrectToMidiTimevarying(samples, f0Hz, targetMidi, sampleRate, hopLength, voiced?, voicedProb?)` | `pitch_correct_to_midi_timevarying(samples, f0_hz, target_midi, sample_rate, hop_length, voiced?, voiced_prob?)` |
| Snap a contour to a musical scale (automatic pitch correction) | `pitchCorrectTimevarying(samples, f0Hz, sampleRate, hopLength, options)` | `pitch_correct_timevarying(samples, f0_hz, sample_rate, hop_length, *, mode=..., scale_root=..., ...)` |
| Snap a whole recording to a detected or named key | `autoTune({ samples, sampleRate, key, strength })` | `auto_tune(samples, sample_rate, key, strength=...)` |
| Stretch only a note region | `noteStretch(samples, sampleRate, { onsetSample, offsetSample, stretchRatio })` | `note_stretch(samples, sample_rate, onset_sample, offset_sample, stretch_ratio)` |
| Edit a time-frequency region | `spectralEdit(samples, sampleRate, ops, options?)` | `spectral_edit(samples, sample_rate, ops, ...)` |
| Shift pitch and formants independently | `voiceChange(samples, sampleRate, { pitchSemitones, formantFactor, formantMode? })` | `voice_change(samples, sample_rate, pitch_semitones, formant_factor, formant_mode="relative")` |
| Stateful realtime voice preset chain | `RealtimeVoiceChanger` | `RealtimeVoiceChanger` |
| One-shot realtime voice preset render | `voiceChangeRealtime(samples, sampleRate, preset, options?)` | `voice_change_realtime(samples, sample_rate, preset)` |

::: tip Positional or request object
WASM and Node accept either positional arguments (samples first, then sample rate, then the edit amount or preset) or a single request object with the same names; pick one style per file.
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

::: warning `formantFactor` is applied *after* the pitch shift
`voiceChange` transposes first, and a transpose already drags the formants with it. The formant stage then runs on that shifted signal, so `formantFactor` multiplies a displacement that is already there. `formantFactor: 1.0` means "no extra formant move", not "formants preserved" — `{ pitchSemitones: 5, formantFactor: 1.1 }` above lands the formants at roughly 2<sup>5/12</sup> × 1.1 ≈ 1.47×, which is a deliberate character change rather than a transparent transpose.

For a natural-sounding transpose, cancel the pitch-induced move by passing the reciprocal of the pitch ratio:

```typescript
const pitchSemitones = 5;
const transposed = voiceChange(vocal, sampleRate, {
  pitchSemitones,
  formantFactor: 2 ** (-pitchSemitones / 12), // 0.749 — keeps the vocal tract where it was
});
```

`formantMode: 'absolute'` does that bookkeeping for you. `formantFactor` is then the formant shift relative to the *input*, whatever the pitch shift, and `1` keeps the formants where they were; the warp actually applied is `formantFactor / 2^(pitchSemitones / 12)`. The default, `'relative'`, is the behavior described above.

```typescript
const natural = voiceChange(vocal, sampleRate, {
  pitchSemitones: 5,
  formantFactor: 1,       // formants stay at the input's position
  formantMode: 'absolute',
});
```

The formant warp covers 0.55 to 1.65, so an absolute request is only reachable when `formantFactor / 2^(pitchSemitones / 12)` falls in that range. Outside it the call throws a `RangeError` naming the reachable `formantFactor` range for that pitch shift (at +12 semitones, `[1.1, 3.3]`); it is never clamped. Python and the `voice-change` CLI (`--formant-mode`) refuse it the same way.
:::

For rectangular time/frequency edits such as whistle attenuation or short artifact repair, see [Spectral Editing](./spectral-editing.md).

### How `pitchCorrectToMidi(...)` works

`pitchCorrectToMidi(...)` takes two MIDI note numbers: the pitch the audio currently has, and the pitch you want it to move toward. It does not detect the current pitch by itself. The caller provides `currentMidi` / `current_midi`.

The usual workflow is:

1. Estimate the current pitch with [`pitchYin(...)` or `pitchPyin(...)`](./js-api-features.md#pitch-detection), or your own detector.
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

`pitchCorrectToMidi(...)` applies the requested transpose immediately and preserves the input length. It does not follow a changing pitch contour.

::: warning Contour-following correction defaults to ±12 semitones
`pitchCorrectToMidiTimevarying(...)` uses the corrector's default ±12-semitone bound for each measured frame. `pitchCorrectToMidi(...)` applies the caller-stated `targetMidi - currentMidi` interval in full after validating the MIDI endpoints, so `pitchCorrectToMidi(vocal, sampleRate, 48, 72)` moves by +24 semitones.

When you need a wider contour correction, call `pitchCorrectTimevarying(...)` with an explicit `maxCorrectionSemitones`. For a plain transpose, use `pitchShift(...)`.
:::

Use `pitchCorrectToMidiTimevarying(...)` when correction should change from frame to frame. It follows a caller-supplied **per-frame F0 contour** and retunes each voiced frame toward `targetMidi`.

```typescript
import { init, pitchPyin, pitchCorrectToMidiTimevarying } from '@libraz/libsonare';

await init();

const hopLength = 512;

// 1. Measure a per-frame F0 contour (any detector that emits one F0 per hop).
const pitch = pitchPyin({ samples: vocal, sampleRate, hopLength });

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

`voiced` and `voicedProb` are optional. Omit them to treat every frame as voiced. Use the same `hopLength` that produced the F0 contour, so frame `i` lines up with sample `i * hopLength`.

`voiced` is typed `VoicedFlags` — `Int32Array`, `Uint8Array`, `Float32Array`, `readonly number[]`, or `readonly boolean[]`. Each entry is read as a flag, not a magnitude: any truthy value means voiced. That is why `pitch.voicedFlag`, which `pitchPyin` returns as a `boolean[]`, goes straight in with no conversion step.

`voiced` must match the length of `f0Hz`; if you leave `voiced` out, `voicedProb` must. A mismatch throws a `RangeError` rather than a `SonareError`, so an `isSonareError` guard will not catch it.

A voiced frame must have a finite, positive `f0Hz` no higher than Nyquist (`sampleRate / 2`); zero, negative, or non-finite voiced F0 is rejected. An unvoiced frame may carry `NaN` or a finite F0 between zero and Nyquist. Pass `voiced` flags from the pitch analysis when its unvoiced frames contain `NaN`.

::: tip Constant vs contour-following correction
Use `pitchCorrectToMidi(...)` for a steady held note where one transpose is enough. Reach for `pitchCorrectToMidiTimevarying(...)` when the take has vibrato, slides, or drift you want to preserve while nudging it onto pitch.
:::

### Scale-snap correction

The two functions above pull toward a single note. When a whole vocal line should follow a **key**, with each note snapped to the nearest tone of, say, C major, use `pitchCorrectTimevarying(...)`. It takes the same per-frame F0 contour but reads its target and correction feel from an options object. `mode: 'scale'` is automatic pitch correction in the usual sense: every voiced frame is pulled to the closest scale tone rather than one fixed pitch.

<SonareDemo id="pitch-correct" />

::: code-group

```typescript [Browser]
import { init, pitchPyin, pitchCorrectTimevarying } from '@libraz/libsonare';

await init();

const hopLength = 256;
const pitch = pitchPyin({ samples: vocal, sampleRate, hopLength });

// Snap every voiced frame to C major at 80% strength.
const tuned = pitchCorrectTimevarying({
  samples: vocal,
  f0Hz: pitch.f0,
  sampleRate,
  hopLength,
  mode: 'scale',
  scaleRoot: 0,              // 0 = C .. 11 = B
  scaleModeMask: 0xab5,      // 12-bit degree mask: C major = {0,2,4,5,7,9,11}
  retuneAmount: 0.8,         // 0 = bypass, 1 = full snap
  retuneSpeedMs: 15,         // larger = slower glide onto pitch
  maxCorrectionSemitones: 2, // clamp any single frame's jump (default 12)
  voiced: pitch.voicedFlag,  // the boolean[] from pitchPyin, passed as-is
});
```

```python [Python]
import libsonare as sonare

hop_length = 256
pitch = sonare.pitch_pyin(vocal, sample_rate, hop_length=hop_length)
tuned = sonare.pitch_correct_timevarying(
    vocal,
    pitch.f0,
    sample_rate,
    hop_length,
    mode="scale",
    scale_root=0,
    scale_mode_mask=0xAB5,
    retune_amount=0.8,
    retune_speed_ms=15,
    max_correction_semitones=2,
    voiced=pitch.voiced_flag,
)
```

```bash [CLI]
# The CLI measures the pYIN contour itself
sonare pitch-correct-timevarying vocal.wav --mode scale --scale-root 0 --scale-mode-mask major --retune-amount 0.8 -o tuned.wav
```

:::

Node takes the same calls as the browser. Python passes the options as keyword-only arguments instead of an options dictionary. The CLI covers `pitchCorrectTimevarying`, but has no command for `autoTune` or `spectralEdit`.

| Option | Python | CLI flag | Range | Default | Effect |
|--------|--------|----------|-------|---------|--------|
| `mode` | `mode` | `--mode` | `'midi'`, `'scale'` | `'midi'` | `'midi'` retunes toward `targetMidi`; `'scale'` snaps to the key |
| `targetMidi` | `target_midi` | `--target-midi` | `[0, 127]` | `69` | Fixed target note in `'midi'` mode |
| `scaleRoot` | `scale_root` | `--scale-root` | `0` (C) to `11` (B) | `0` | Root pitch class of the scale |
| `scaleModeMask` | `scale_mode_mask` | `--scale-mode-mask` | 12-bit mask or a mode name | C major (`0xab5`) | Enabled scale degrees; bit `i` is the semitone `i` above `scaleRoot` |
| `referenceMidi` | `reference_midi` | `--reference-midi` | finite | `69` | Anchors the scale grid; every degree is measured from this note |
| `retuneAmount` | `retune_amount` | `--retune-amount` | `[0, 1]` | `1` | `0` bypasses, `1` snaps fully; lower values leave a natural wobble |
| `retuneSpeedMs` | `retune_speed_ms` | `--retune-speed-ms` | `>= 0` | `50` | Retune time constant; larger glides onto pitch more slowly |
| `vibratoThresholdCents` | `vibrato_threshold_cents` | `--vibrato-threshold-cents` | `>= 0` | `20` | Frames this close to the target count as in tune and are left alone |
| `maxCorrectionSemitones` | `max_correction_semitones` | `--max-correction-semitones` | `>= 0` | `12` | Hard clamp on one frame's jump |
| `voiced` / `voicedProb` | `voiced` / `voiced_prob` | (measured by the CLI) | flags / `[0, 1]` | all frames voiced | Which frames to retune; `voiced` wins over `voicedProb` |

A cent is 1/100 of a semitone, so the default `vibratoThresholdCents` of `20` leaves any frame within a fifth of a semitone of its target alone: it is already in tune. Sung vibrato swings much wider than that, typically ±50 to ±100 cents at 5 to 7 Hz, so the threshold does not protect it. What keeps vibrato alive is a slower `retuneSpeedMs` (or a `retuneAmount` below `1`): the smoothed correction then follows the note's average pitch rather than every swing, while a very short time constant chases each swing and flattens it. `retuneAmount: 1` with a short `retuneSpeedMs` is the hard, robotic effect; `maxCorrectionSemitones` bounds an octave-off detector glitch on one frame instead of yanking that frame a full octave, so lower it when the detector is noisy.

C natural minor `{0,2,3,5,7,8,10}` is `0x5ad`. With `mode: 'midi'` the same function behaves like `pitchCorrectToMidiTimevarying(...)`. The [pitch correction glossary page](./glossary/editing/pitch-correction.md) explains the options conceptually.

### Tune a whole recording to a key: `autoTune(...)`

The functions above need an F0 contour you measured yourself. `autoTune(...)` runs the whole offline chain on a monophonic recording. It analyzes with a fixed 2048-sample frame and 512-sample hop. The output has the input's length; unvoiced stretches and notes the corrector cannot repitch pass through unchanged.

<FlowDiagram
  title="What autoTune runs"
  :nodes="[
    { id: 'audio', label: 'Mono audio', col: 0, row: 0 },
    { id: 'key', label: 'Detect key', col: 1, row: 0 },
    { id: 'mask', label: 'Scale mask', col: 2, row: 0 },
    { id: 'f0', label: 'pYIN F0', col: 3, row: 0 },
    { id: 'corr', label: 'Scale corrector', col: 4, row: 0, variant: 'accent' },
    { id: 'out', label: 'Tuned audio', col: 5, row: 0, variant: 'success' }
  ]"
  :edges="[
    { from: 'audio', to: 'key' },
    { from: 'key', to: 'mask' },
    { from: 'mask', to: 'f0' },
    { from: 'f0', to: 'corr' },
    { from: 'corr', to: 'out' }
  ]"
  caption="Key detection is skipped when you name the key. The corrector takes the options of pitchCorrectTimevarying, with strength as retuneAmount."
/>

::: code-group

```typescript [Browser]
import { autoTune, init } from '@libraz/libsonare';

await init();

// Detect the key, then tune toward it.
const { samples: tuned, key } = autoTune({ samples: vocal, sampleRate, key: 'detect', strength: 0.8 });
console.log(key.name, key.confidence); // the key actually used

// Or name the key: confidence is 1, and no detection runs.
const inD = autoTune({ samples: vocal, sampleRate, key: { root: 2, mode: 'dorian' } });
```

```python [Python]
import libsonare as sonare

# Detect the key, then tune toward it.
result = sonare.auto_tune(vocal, sample_rate, key="detect", strength=0.8)
print(result.key.name, result.key.confidence)  # the key actually used

# Or name the key.
in_d = sonare.auto_tune(vocal, sample_rate, key=(2, "dorian"))
```

:::

`key` is `'detect'` (the default) or `{ root, mode }`, where `root` is a pitch class (0 = C .. 11 = B) and `mode` is a name such as `'major'`, `'minor'`, `'dorian'` or a `Mode` ordinal. The result is `{ samples, key }`; `key.mode` is a name, as [`detectKey`](./js-api-analysis.md#detectkey-samples-samplerate) reports it, and detection reads the chroma at concert A440. `strength` (default `1`), `retuneSpeedMs`, `vibratoThresholdCents`, `maxCorrectionSemitones` and `referenceMidi` mean what they do in `pitchCorrectTimevarying(...)`, with `strength` playing the part of `retuneAmount`. Python takes the key as a string, a `Key`, a mapping, or a `(root, mode)` tuple and returns an `AutoTuneResult` with `samples` and `key`.

To snap a contour you measured yourself, build the mask with `scaleMaskForMode(root, mode)` and pass it as `scaleModeMask`. It returns the 12-bit mask of a church mode (`scaleMaskForMode(0, 'major')` is `0b101010110101`), and `pitchCorrectTimevarying(...)` also accepts the mode name directly as `scaleModeMask`.

### Region selection for `noteStretch(...)`

`noteStretch(...)` takes the region in samples (`onsetSample`, `offsetSample`) or in seconds (`onsetSec`, `offsetSec`); see [Samples and seconds](#samples-and-seconds). `onsetSample` defaults to the start of the input and `offsetSample` to its end, so omit a boundary when the region already reaches that edge.

```typescript
const heldNote = noteStretch(vocal, sampleRate, { onsetSec: 0.25, offsetSec: 0.5, stretchRatio: 1.25 });
```

`noteMove(...)` takes the same bounds plus `targetOnsetSample` / `targetOnsetSec`, the position the note's onset moves to, under the same rules.

`stretchRatio` is the nominal length multiplier for the selected region. `noteStretch` blends the source samples at the replacement region's start and end with equal-power crossfades. Those crossfades stay inside the replacement region and do not consume neighboring samples. The output clip length and the shift of audio after the region therefore follow the replacement region's length change. `stretchRatio: 1.0` keeps the whole clip length neutral; for other ratios, the time-stretch backend can round the replacement length by a few samples. A clip edge has no neighboring audio on that side, so it has no crossfade there.

An equal-power crossfade holds the level of two unrelated signals, but here the stretched region and the source it blends with are closely related, so the level inside a seam moves. On a steady 440 Hz tone stretched by `1.25`, the head seam peaks about 2.8 dB above the tone, and the tail seam, where the two have drifted out of phase, dips about 4.3 dB below it. Sustained tones show this most; [Fade curves and crossfades](./glossary/arrangement/clips-and-tracks.md#fade-curves-and-crossfades) explains the correlation rule.

| `stretchRatio` | Result |
|----------------|--------|
| `1.25` | Make the replacement region 25% longer; following audio shifts later by that region-length increase, subject to sample rounding |
| `1.0` | Keep the replacement region and whole clip at the same length |
| `0.8` | Make the replacement region 20% shorter; following audio shifts earlier by that region-length decrease, subject to sample rounding |

### Offline `voiceChange(...)` vs `RealtimeVoiceChanger`

`voiceChange(...)` is the simple offline helper for a decoded mono clip: pass semitone and formant values, get a processed buffer back.

`RealtimeVoiceChanger` is the stateful preset chain used for live or chunked voice processing. It combines high-pass, gate, retune, formant, EQ, compressor, de-esser, reverb, and limiter stages. Factory preset IDs include `neutral-monitor`, `bright-idol`, `soft-whisper`, `deep-narrator`, `robot-mascot`, and `dark-villain`.

Use the realtime class when you process repeated blocks and need continuity across calls. The same chain is also a `voice.changer` insert on mono and stereo mixer strips; see [Realtime Voice Changer](./realtime-voice-changer.md#as-a-mixer-insert). In WASM, call `prepare(...)` and `delete()` yourself. In Python, use the context manager or `close()`.

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

For a preset applied to a whole buffer in one call — without managing the class yourself — use `voiceChangeRealtime(samples, sampleRate, preset, options?)`. By default it treats `samples` as mono; pass `{ channels: 2 }` to feed an **interleaved** stereo buffer (`L0, R0, L1, R1, ...`) for a stereo source. The internal render block size is fixed by the shared C-ABI renderer, so WASM, Node, and Python produce the same result; the legacy `blockSize` option is deprecated and ignored. The returned buffer keeps the same layout and length as the input.

### Using `Audio` methods

The `Audio` object exposes the same operations as methods. In file-based Python workflows, you can load the file once and then apply edits to the same `Audio` object without passing samples and `sample_rate` every time.

### Creative effect inserts

Beyond pitch and time transforms, two of the mixer/mastering insert processors are go-to voice and instrument color tools:

- `effects.modulation.ensemble` — a BBD-style (an analog bucket-brigade delay chorus) string-machine ensemble that thickens a thin source into a wide, chorused pad.
- `saturation.ampSim` — a guitar/bass amp color insert with preamp drive, tone stack, optional power-amp sag/transformer/NFB (negative feedback) behavior, and guitar 4x12 or bass 8x10 cab voicing.

Load them as inserts on a strip (see [Mixing Engine](./mixing.md)) rather than as standalone functions on a raw buffer.

::: info Offline transforms vs arrange-time warp
The functions on this page are **offline** transforms: you hand them a buffer and get a new buffer back. They are different from **arrange-time warp** — clip repitch and tempo-sync inside a project, where a clip follows the timeline rather than being baked once. For that project-level workflow, see [Project Editing](./project-editing.md).
:::

For note-by-note edits that are rendered back into audio, see [Note Editing in Audio](./note-editing.md). For edits that change a project MIDI clip, see [MIDI Editing](./midi-editing.md).

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

Two resynthesis engines sit behind these calls, and they fail differently: `pitchShift`, `pitchCorrectToMidi` and `voiceChange` stretch and resample (formants move with the pitch), while the contour-following correctors and the vocal session repitch grain by grain (formants stay roughly in place). [Two resynthesis engines](./glossary/editing/pitch-correction.md#two-resynthesis-engines) lists which call uses which.
:::
