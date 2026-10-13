---
title: Build Practice Tracks
description: Turn one recording into a slowed copy, a transposed copy, a harmonic/percussive split, and a chord-beat-section chart — a full practice kit from the CLI.
---

# Build Practice Tracks

You are learning a song off a recording. You do not need the multitrack; you need a slow copy that keeps the pitch, a copy transposed into your instrument's or your voice's range, a version with just the groove or just the harmony to play against, and something to read while you play. This page builds all four from one file with `sonare`. Steps 1 to 3 also have Node and Python tabs: the library calls take mono sample arrays and return arrays, so they write no files and skip the stereo warning below. Step 1's tabs load `song.wav`; Steps 2 and 3 reuse its `samples`, `sampleRate` and `harmonic`.

Nothing here separates instruments — that needs actual stems or a source-separation model. Harmonic/percussive splitting divides a single mix into a pitched layer and a rhythmic layer; it will not hand you an isolated bass line out of a full band. What it gives you is enough to loop the groove alone or the chords alone, which is most of what practising against a recording needs.

::: info What you need
- **Install:** `pip install libsonare` (Python 3.11 or later) gives you the `sonare` command. The Node tabs need `npm install @libraz/libsonare` (Node.js 22.12 or later).
- **One recording, `song.wav`:** any WAV or MP3 of the song, mono or stereo, at any common sample rate. Every command folds stereo to mono (see below), so the practice files come out mono.
- **The numbers on this page** come from the 11.5-second (553053-frame), 48 kHz stereo `mix.wav` that [Mix and Master a Song in the CLI](./cli-mix-and-master.md) renders from its four 6-second test stems, copied to `song.wav`. The stems stop at 6 s; the rest is reverb and delay tail. Your own song will print different numbers.
:::

## What You Will Learn

By the end of this page you should be able to:

- build a slowed, pitch-preserving copy and a transposed copy of a recording from the CLI;
- split a mix into a harmonic layer and a percussive layer to practise against just one of them;
- generate a chord, beat, downbeat, and section reading from the same file, and know which numbers in it to trust;
- separate before you stretch, and explain why the reverse order quietly degrades the split.

## The whole job

Everything below is this script, run against `song.wav` — the recording you are learning. Run it, then read on for what each stage is doing and why it runs in this order.

```bash
#!/usr/bin/env bash
set -euo pipefail

# 1. Split into a harmonic (pitched) layer and a percussive (rhythmic) layer
#    before anything else touches the file — see Step 1 for why.
sonare hpss song.wav -o kit --json

# 2. Slow copies that keep pitch: the full mix, the harmony alone, the groove alone.
sonare time-stretch song.wav --rate 0.75 -o kit_full_slow.wav --json
sonare time-stretch kit_harmonic.wav --rate 0.75 -o kit_harmonic_slow.wav --json
sonare time-stretch kit_percussive.wav --rate 0.75 -o kit_percussive_slow.wav --json

# 3. A transposed copy, for an instrument or voice pitched differently from the recording.
sonare pitch-shift song.wav --semitones -2 -o kit_down2.wav --json

# 4. The chart: key, a triad-only chord reading, beats, downbeats, sections.
sonare key song.wav --json > kit_key.json
sonare chords song.wav --triads-only --json > kit_chords.json
sonare beats song.wav --json > kit_beats.json
sonare downbeats song.wav --json > kit_downbeats.json
sonare sections song.wav --json > kit_sections.json
```

<FlowDiagram
  title="One recording to a practice kit"
  direction="LR"
  :nodes="[
    { id: 'song', label: 'Recording (song.wav)', col: 0, row: 2, variant: 'muted' },
    { id: 'hpss', label: 'hpss', col: 1, row: 0, variant: 'accent' },
    { id: 'harmonic', label: 'harmonic layer', col: 2, row: 0 },
    { id: 'percussive', label: 'percussive layer', col: 2, row: 1 },
    { id: 'stretchH', label: 'time-stretch', col: 3, row: 0, variant: 'accent' },
    { id: 'stretchP', label: 'time-stretch', col: 3, row: 1, variant: 'accent' },
    { id: 'slowH', label: 'harmonic, slow', col: 4, row: 0, variant: 'success' },
    { id: 'slowP', label: 'percussive, slow', col: 4, row: 1, variant: 'success' },
    { id: 'stretchFull', label: 'time-stretch', col: 1, row: 2, variant: 'accent' },
    { id: 'slowFull', label: 'full mix, slow', col: 2, row: 2, variant: 'success' },
    { id: 'shift', label: 'pitch-shift', col: 1, row: 3, variant: 'accent' },
    { id: 'transposed', label: 'transposed mix', col: 2, row: 3, variant: 'success' },
    { id: 'chart', label: 'key, chords, beats, sections', col: 1, row: 4, variant: 'accent' },
    { id: 'chartOut', label: 'practice chart', col: 2, row: 4, variant: 'success' }
  ]"
  :edges="[
    { from: 'song', to: 'hpss' },
    { from: 'hpss', to: 'harmonic' },
    { from: 'hpss', to: 'percussive' },
    { from: 'harmonic', to: 'stretchH' },
    { from: 'percussive', to: 'stretchP' },
    { from: 'stretchH', to: 'slowH' },
    { from: 'stretchP', to: 'slowP' },
    { from: 'song', to: 'stretchFull' },
    { from: 'stretchFull', to: 'slowFull' },
    { from: 'song', to: 'shift' },
    { from: 'shift', to: 'transposed' },
    { from: 'song', to: 'chart' },
    { from: 'chart', to: 'chartOut' }
  ]"
  caption="hpss runs on the untouched recording; only its output is stretched, so the split stays clean."
/>

Every command in this script prints `warning: 2-channel input is downmixed to mono by this CLI command` on stderr, because `hpss`, `time-stretch`, `pitch-shift`, `key`, `chords`, `beats`, `downbeats`, and `sections` all analyze or resynthesize on a single channel. For a practice kit that's the right trade — you're learning the song, not delivering a mix — so treat the warning as confirmation, not a problem to fix. If you do need channel-preserving output, [Stereo and Mono Handling](../cli.md#stereo-and-mono-handling) lists which commands keep the pair.

## Step 1 — Split before you stretch

`hpss` divides the signal into a harmonic component (pitched material — chords, bass, melody) and a percussive component (transient material — drums, plucks, attacks):

::: code-group

```bash [CLI]
sonare hpss song.wav -o kit --json
```

```typescript [Node]
import { readFileSync } from 'node:fs';
import { Audio, hpss, init } from '@libraz/libsonare';

await init();
// Audio.fromMemory decodes WAV or MP3 and folds stereo to mono, as the CLI does.
const song = Audio.fromMemory(new Uint8Array(readFileSync('song.wav')));
const samples = song.data;
const sampleRate = song.sampleRate;
const { harmonic, percussive } = hpss(samples, sampleRate);
```

```python [Python]
import libsonare as sonare
from libsonare import Audio

# Audio.from_file decodes WAV or MP3 and folds stereo to mono, as the CLI does.
with Audio.from_file("song.wav") as song:
    samples, sample_rate = song.data, song.sample_rate
split = sonare.hpss(samples, sample_rate)
harmonic, percussive = split.harmonic, split.percussive
```

:::

```json
{"length": 553053, "sample_rate": 48000,
 "harmonic_mean_abs": 0.026357, "percussive_mean_abs": 0.006618,
 "harmonic": "kit_harmonic.wav", "percussive": "kit_percussive.wav"}
```

`harmonic_mean_abs` and `percussive_mean_abs` are each layer's mean absolute sample value, a level averaged over the whole file. They tell you how the mix divided between the two layers, not how good the split sounds.

::: tip `-o` is a prefix, not a filename
`-o kit` writes two files, `kit_harmonic.wav` and `kit_percussive.wav` — the value is a prefix that both output names are built from, not the name of either file. Passing `-o kit.wav` gives you `kit.wav_harmonic.wav`, which is legal but not what most people want.
:::

The demo below runs the same split on a band phrase: the harmonic layer keeps the sustained lines, the percussive layer keeps the hits.

<SonareDemo id="hpss-separation" />

The defaults (`--n-fft 2048`, `--hop-length 512`, a soft mask blended between the two components) are a reasonable starting point. Two options are worth turning by ear if the split has too much bleed for what you're practising against: `--hard-mask` assigns each time-frequency cell fully to whichever component dominates it, instead of blending — on this file it moved level from `harmonic_mean_abs: 0.026357, percussive_mean_abs: 0.006618` to `harmonic_mean_abs: 0.028465, percussive_mean_abs: 0.005901`. Listen to both: the hard mask leaves less bleed between the layers but makes the percussive layer sound more artificial. `--kernel-harmonic` and `--kernel-percussive` widen the median-filter kernels the split is built on, which can sharpen the separation on material with longer sustained notes.

Now the order. Running `hpss` on `song.wav` — the recording exactly as it was recorded, before any stretching or shifting — is not a stylistic choice. Time-stretching works by re-spacing short overlapping analysis frames, which smears transients across the frames next to them. `hpss`'s percussive detector looks for exactly the kind of short, sharp energy that smearing destroys. A hit that has already been spread across neighboring frames looks partly like a sustained sound, so part of it lands in the harmonic layer. Compare the two orders by ear:

```bash
sonare hpss song.wav -o order_a --json
sonare time-stretch song.wav --rate 0.75 -o order_b_slow.wav --json
sonare hpss order_b_slow.wav -o order_b --json
```

Play `order_a_percussive.wav` (stretched afterwards, if you like) against `order_b_percussive.wav`. Listen to the drum attacks, and listen for drum snap left behind in `order_b_harmonic.wav`. That is where a smeared attack goes when the split no longer recognizes it as a hit. The harmonic layer survives either order, because sustained pitched material is what a [phase vocoder](../glossary/editing/phase-vocoder-stretch.md) is designed to preserve.

::: tip Why the JSON levels cannot settle this
Stretching first gives `percussive_mean_abs: 0.005323` against `0.006618`. That drop is not evidence of smearing. A 0.75 stretch spreads the same hits over a third more time, so a mean taken over the whole file falls even when every transient survives intact. Judge the order by listening to the attacks.
:::

::: warning Split first, always
Once you've stretched or shifted a file, running `hpss` on it gives you a percussive layer that has already lost some of what made it percussive. Always separate the untouched recording, then stretch or shift the two output files independently — which is what the script above does.
:::

## Step 2 — Slow copies that keep pitch

::: code-group

```bash [CLI]
sonare time-stretch song.wav --rate 0.75 -o kit_full_slow.wav --json
```

```typescript [Node]
import { timeStretch } from '@libraz/libsonare';

// samples, sampleRate, harmonic: from Step 1
const slowFull = timeStretch(samples, sampleRate, 0.75);
const slowHarmonic = timeStretch(harmonic, sampleRate, 0.75); // harmonic from Step 1
```

```python [Python]
# samples, sample_rate, harmonic: from Step 1
slow_full = sonare.time_stretch(samples, sample_rate, rate=0.75)
slow_harmonic = sonare.time_stretch(harmonic, sample_rate, rate=0.75)  # harmonic from Step 1
```

:::

```json
{"length": 737404, "sample_rate": 48000, "duration": 15.362583333333333, "rate": 0.75, "output": "kit_full_slow.wav"}
```

`--rate` is a playback-speed multiplier, confirmed by what it measured here: the input is 11.522 s, and `--rate 0.75` produced a 15.363 s output — slower and longer, at three-quarters of the original speed. `--rate` above 1 speeds up and shortens; below 1 slows down and lengthens. Pitch is untouched either way, which is the entire point of using this instead of just playing the file back slower.

Hear the same trade on a short clip below: slow it, and listen for what happens to timing and attack clarity.

<SonareDemo id="time-stretch" />

Running the same command against `kit_harmonic.wav` and `kit_percussive.wav` gives you a slowed harmony-only track and a slowed groove-only track — the same operation, just pointed at Step 1's output instead of the original mix, so you can drop the tempo on only the half you're currently practising.

A stretch is not free at any rate, and it gets less free the further `--rate` sits from 1.0: the phase vocoder has more distance to invent material across, which is the same short-overlapping-frame mechanism behind the pitch-shift artifacts described in [Editing DSP](../editing-dsp.md#practical-notes). Practising at `--rate 0.75` costs little; dropping to `--rate 0.5` asks the engine to fill twice the gap and will sound noticeably softer and less defined on transient-heavy material. Start at the mildest rate that lets you play the passage, and only go slower if you still can't.

## Step 3 — A transposed copy

::: code-group

```bash [CLI]
sonare pitch-shift song.wav --semitones -2 -o kit_down2.wav --json
```

```typescript [Node]
import { pitchShift } from '@libraz/libsonare';

// samples, sampleRate: from Step 1
const down2 = pitchShift(samples, sampleRate, -2);
```

```python [Python]
# samples, sample_rate: from Step 1
down2 = sonare.pitch_shift(samples, sample_rate, semitones=-2)
```

:::

```json
{"length": 553053, "sample_rate": 48000, "duration": 11.5219375, "semitones": -2.0, "output": "kit_down2.wav"}
```

Length is preserved — 11.522 s in, 11.522 s out, 553053 samples both ways — only the pitch moves, down two semitones here. This is what you want when the recording sits outside a singer's range or a fixed-tuning instrument's key.

The same mechanism that makes a large `--rate` cost more applies to `--semitones`, and it compounds differently on a full mix than on one instrument: [Editing DSP](../editing-dsp.md#practical-notes) shows this for a single voice, where a big shift produces a "watery" or robotic quality once the shift outruns what the analysis frames can represent cleanly. On a full mix, every simultaneous harmonic source is being re-pitched by the same amount at once, so their individual smearing and beating stack instead of averaging out. A shift you'd barely notice on an isolated guitar can be obvious on the whole band. Keep `--semitones` modest on a full mix, and reach for a bigger shift only on the split-out harmonic layer or a single stem if you have one.

::: warning A transposed voice changes character
`pitch-shift` stretches the audio and then resamples it, so the [formants](../glossary/editing/voice-formant.md) (the resonances that make a voice sound like that singer) move with the pitch. A vocal shifted down sounds larger and darker; shifted up, smaller and thinner. For a practice track that is usually fine, because you only need the notes. When the voice has to keep its character, see the formant controls in [Editing DSP](../editing-dsp.md).
:::

## Step 4 — Read the chart

The analysis commands below all run on `song.wav` untouched — none of them need the split or the stretched copies, so this step can run in parallel with Steps 1–3.

```bash
sonare key song.wav --json
```

```json
{"root": 7, "mode": 0, "confidence": 0.946937084197998, "name": "G major"}
```

G major, at 0.947 confidence — and still not the key the test stems were written in. The chords are A, F, C and G, and there is no F♯ among the notes played. The vocal stem is a buzzy tone with strong upper harmonics: the third harmonic of its B is an F♯, and the fifth harmonic of its A is a C♯. Key detection weighs the pitch classes present in the sound, not the notes written, so those harmonics tip the mix toward G major. Run on its own, `stems/gtr.wav` reads C major (0.954). Confidence says how clearly one key profile beats the others, not whether the answer is musically right; on a real recording, check it against the chords before you trust it. See [Key Detection](../glossary/analysis/key-detection.md) for what `root` and `mode` encode.

```bash
sonare chords song.wav --triads-only --json
```

```json
{"progression": "A - Am - C - Em - G - D# - Em - G - Em - G - N.C.", "count": 11,
 "chords": [
   {"name": "A", "start": 0.0, "end": 1.525, "confidence": 0.823},
   {"name": "Am", "start": 1.525, "end": 3.019, "confidence": 0.784},
   {"name": "C", "start": 3.019, "end": 3.520, "confidence": 0.731},
   {"name": "Em", "start": 3.520, "end": 4.523, "confidence": 0.779},
   {"name": "G", "start": 4.523, "end": 6.027, "confidence": 0.815},
   {"name": "D#", "start": 6.027, "end": 7.029, "confidence": 0.655},
   {"name": "Em", "start": 7.029, "end": 7.531, "confidence": 0.643},
   {"name": "G", "start": 7.531, "end": 8.032, "confidence": 0.858},
   {"name": "Em", "start": 8.032, "end": 8.533, "confidence": 0.704},
   {"name": "G", "start": 8.533, "end": 9.035, "confidence": 0.861},
   {"name": "N.C.", "start": 9.035, "end": 11.522, "confidence": 0.0}
 ]}
```

`--triads-only` is the flag worth defaulting to for a chart you'll actually read while playing. Without it, the first 6 seconds come back as `A - A7b9 - Amaj7 - Am - Cmaj7 - Gmaj9 - G7b9` — seven harmonically precise chords where `--triads-only` gives `A - Am - C - Em - G`, five you can read at tempo. `--min-duration` is worth reaching for separately if a detector flickers between two chords for a fraction of a second; it merges anything shorter than the value you give it into its neighbor.

Beats and downbeats mark where the bars fall:

```bash
sonare beats song.wav --json
sonare downbeats song.wav --json
```

```json
[0.534, 1.022, 1.533, 2.020, 2.531, 3.042, 3.529, 4.040, 4.528, 5.039, 5.526, 6.037, 6.548]
[1.533, 3.529, 5.526]
```

Pull the detector's bar lines out of the beat pulse in the demo below; the downbeats are the subset of beats it keeps.

<SonareDemo id="downbeat-tracking" />

The three downbeats are 1.997 s apart — four beats at the 120 BPM this recording measures at (`sonare bpm song.wav --json` reports `{"bpm": 120.04}`), which lines up with the ~0.5 s beat spacing above. The gap before the first downbeat is a partial bar; playing along, the first downbeat you feel lands at 1.533 s, not 0.0 s.

That arithmetic is the grid below: set it to 120 BPM in 4/4 and the readout gives 0.5 s per beat and 2.0 s per bar, the spacing the beat and downbeat lists just reported. Drag it to 60 and the same six seconds hold half as many bars — the half-time reading the tip that follows warns about, and the click you would be practising against if you took that figure.

<SonareDemo id="tempo-grid" />

::: tip Check the metrical level before you set the metronome
A tempo estimate is a choice of *which* pulse to call the beat, and a steady eighth-note pattern gives a tracker more than one defensible answer — half, double, or a dotted reading of the same groove. On this clip `sonare mastering-profile song.wav --json` reads the same audio at 119.9 BPM, so there is no level ambiguity here, but on other material the two commands can land on different levels. Count a bar against the reported beat times before committing: if the number feels like it is fighting you, you are on the wrong level rather than out of time.
:::

```bash
sonare sections song.wav --json
```

```json
{"count": 2, "sections": [
  {"type": "unknown", "start": 0.0, "end": 6.060, "energy": 1.0, "confidence": 0.0},
  {"type": "outro", "start": 6.060, "end": 11.522, "energy": 0.0, "confidence": 0.900}
]}
```

The native CLI's JSON also carries a `form` key. `--min-duration` (default 4.0 s) sets the shortest section the detector will report; on a clip this short it doesn't change anything here, but on a full song it's what keeps a four-bar bridge from being merged into the verse around it. See [Section Structure](../glossary/analysis/section-structure.md) for what the section types mean — `unknown` here just means the detector found no stronger label than "not the ending," which given an eleven-second clip made mostly of one groove is a fair result.

Put together, the chart reads: G major, four beats to the bar at 120 BPM, and the bars starting at the downbeats 1.533 s, 3.529 s and 5.526 s. The test stems move through four chords at 1.5 s each, and the chord boundaries at 1.525, 3.019, 4.523 and 6.027 s land on those changes, though the label for the second one reads `Am` rather than the `F` the bass plays. The playing stops at 6 s, so the last two beats in the list, 6.037 s and 6.548 s, and everything after them are the reverb and delay tail of this mix: the `D#` from 6.03 s, the `Em` and `G` after it, and the `outro` section from 6.06 s are read off a ringing tail rather than off played notes, and `N.C.` (no chord, confidence 0.0) from 9.03 s is the detector giving up on it. On any recording, treat chords and sections reported after the playing stops with the same suspicion.

::: info A chord chart is a reading aid, not ground truth
Every chord object carries `confidence` for exactly this reason. `Em` at 0.643 (from 7.03 s) is the lowest-confidence chord in this progression, and `D#` at 0.655 just before it; both sit in the tail, where there is no clear harmony to read, and a detector has to commit to one reading anyway. Read a low-confidence chord as "listen here," not as an error to file a bug against.
:::

## Where to go next

- You're building the mix this practice kit will come from, not just learning one already recorded — [Mix and Master a Song in the CLI](./cli-mix-and-master.md) is the same shell-script approach applied to stems.
- You want the harmonic/percussive split or the chart data in an app instead of a script — the [CLI reference](../cli.md) and [Editing DSP](../editing-dsp.md) cover the same operations through the Python and JavaScript APIs.
- The chord, beat, and key numbers in the chart come from the same detectors covered in [Chord Recognition](../glossary/analysis/chord-recognition.md), [Beats and Downbeats](../glossary/analysis/beats-downbeats.md), and [Key Detection](../glossary/analysis/key-detection.md).
