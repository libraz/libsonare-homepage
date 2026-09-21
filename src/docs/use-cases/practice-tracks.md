---
title: Build Practice Tracks
description: Turn one recording into a slowed copy, a transposed copy, a harmonic/percussive split, and a chord-beat-section chart — a full practice kit from the CLI.
---

# Build Practice Tracks

You are learning a song off a recording. You do not need the multitrack; you need a slow copy that keeps the pitch, a copy transposed into your instrument's or your voice's range, a version with just the groove or just the harmony to play against, and something to read while you play. This page builds all four from one file with `sonare`.

Nothing here separates instruments — that needs actual stems or a source-separation model. Harmonic/percussive splitting divides a single mix into a pitched layer and a rhythmic layer; it will not hand you an isolated bass line out of a full band. What it gives you is enough to loop the groove alone or the chords alone, which is most of what practising against a recording needs.

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

```bash
sonare hpss song.wav -o kit --json
```

```json
{"length": 494549, "sample_rate": 48000,
 "harmonic_energy": 0.03774, "percussive_energy": 0.004027,
 "harmonic": "kit_harmonic.wav", "percussive": "kit_percussive.wav"}
```

::: tip `-o` is a prefix, not a filename
`-o kit` writes two files, `kit_harmonic.wav` and `kit_percussive.wav` — the value is a prefix that both output names are built from, not the name of either file. Passing `-o kit.wav` gives you `kit.wav_harmonic.wav`, which is legal but not what most people want.
:::

The defaults (`--n-fft 2048`, `--hop-length 512`, a soft mask blended between the two components) are a reasonable starting point. Two options are worth turning by ear if the split has too much bleed for what you're practising against: `--hard-mask` assigns each time-frequency cell fully to whichever component dominates it, instead of blending — on this file it moved energy from `harmonic_energy: 0.03774, percussive_energy: 0.004027` to `harmonic_energy: 0.039008, percussive_energy: 0.002892`, a cleaner separation with less cross-bleed but a more artificial-sounding percussive layer. `--kernel-harmonic` and `--kernel-percussive` widen the median-filter kernels the split is built on, which can sharpen the separation on material with longer sustained notes.

Now the order. Running `hpss` on `song.wav` — the recording exactly as it was recorded, before any stretching or shifting — is not a stylistic choice. Time-stretching works by re-spacing short overlapping analysis frames, which smears transients across the frames next to them. `hpss`'s percussive detector looks for exactly the kind of short, sharp energy that smearing destroys. Run the two operations in the wrong order and you can measure the loss directly:

```bash
sonare hpss song.wav -o order_a --json
sonare time-stretch song.wav --rate 0.75 -o order_b_slow.wav --json
sonare hpss order_b_slow.wav -o order_b --json
```

Separating first: `percussive_energy: 0.004027`. Stretching first, then separating: `percussive_energy: 0.003373` — about 16% lower, while `harmonic_energy` barely moved (`0.03774` versus `0.037546`). The harmonic layer survives either order because sustained pitched material is exactly what a phase vocoder is designed to preserve; the percussive layer does not, because its energy lives in the transients the phase vocoder is smearing.

::: warning Split first, always
Once you've stretched or shifted a file, running `hpss` on it gives you a percussive layer that has already lost some of what made it percussive. Always separate the untouched recording, then stretch or shift the two output files independently — which is what the script above does.
:::

## Step 2 — Slow copies that keep pitch

```bash
sonare time-stretch song.wav --rate 0.75 -o kit_full_slow.wav --json
```

```json
{"length": 659399, "sample_rate": 48000, "duration": 13.737479166666667, "rate": 0.75, "output": "kit_full_slow.wav"}
```

`--rate` is a playback-speed multiplier, confirmed by what it measured here: the input is 10.303 s, and `--rate 0.75` produced a 13.737 s output — slower and longer, at three-quarters of the original speed. `--rate` above 1 speeds up and shortens; below 1 slows down and lengthens. Pitch is untouched either way, which is the entire point of using this instead of just playing the file back slower.

Running the same command against `kit_harmonic.wav` and `kit_percussive.wav` gives you a slowed harmony-only track and a slowed groove-only track — the same operation, just pointed at Step 1's output instead of the original mix, so you can drop the tempo on only the half you're currently practising.

A stretch is not free at any rate, and it gets less free the further `--rate` sits from 1.0: the phase vocoder has more distance to invent material across, which is the same short-overlapping-frame mechanism behind the pitch-shift artifacts described in [Editing DSP](../editing-dsp.md#practical-notes). Practising at `--rate 0.75` costs little; dropping to `--rate 0.5` asks the engine to fill twice the gap and will sound noticeably softer and less defined on transient-heavy material. Start at the mildest rate that lets you play the passage, and only go slower if you still can't.

## Step 3 — A transposed copy

```bash
sonare pitch-shift song.wav --semitones -2 -o kit_down2.wav --json
```

```json
{"length": 494552, "sample_rate": 48000, "duration": 10.303166666666666, "semitones": -2.0, "output": "kit_down2.wav"}
```

Length is preserved — 10.303 s in, 10.303 s out (to within a few samples of resynthesis rounding) — only the pitch moves, down two semitones here. This is what you want when the recording sits outside a singer's range or a fixed-tuning instrument's key.

The same mechanism that makes a large `--rate` cost more applies to `--semitones`, and it compounds differently on a full mix than on one instrument: [Editing DSP](../editing-dsp.md#practical-notes) shows this for a single voice, where a big shift produces a "watery" or robotic quality once the shift outruns what the analysis frames can represent cleanly. On a full mix, every simultaneous harmonic source is being re-pitched by the same amount at once, so their individual smearing and beating stack instead of averaging out. A shift you'd barely notice on an isolated guitar can be obvious on the whole band. Keep `--semitones` modest on a full mix, and reach for a bigger shift only on the split-out harmonic layer or a single stem if you have one.

## Step 4 — Read the chart

The analysis commands below all run on `song.wav` untouched — none of them need the split or the stretched copies, so this step can run in parallel with Steps 1–3.

```bash
sonare key song.wav --json
```

```json
{"root": 9, "mode": 1, "confidence": 0.9829027056694031, "name": "A minor"}
```

A minor, at 0.983 confidence — high enough to take at face value. See [Key Detection](../glossary/analysis/key-detection.md) for what `root` and `mode` encode.

```bash
sonare chords song.wav --triads-only --json
```

```json
{"progression": "Am - F#dim - Am - F - Am", "count": 5,
 "chords": [
   {"name": "Am", "start": 0.0, "end": 1.899, "confidence": 0.651},
   {"name": "F#dim", "start": 1.899, "end": 3.627, "confidence": 0.613},
   {"name": "Am", "start": 3.627, "end": 6.112, "confidence": 0.690},
   {"name": "F", "start": 6.112, "end": 9.333, "confidence": 0.768},
   {"name": "Am", "start": 9.333, "end": 10.304, "confidence": 0.803}
 ]}
```

`--triads-only` is the flag worth defaulting to for a chart you'll actually read while playing. Without it, the same passage comes back as `Amadd9 - Gmaj9 - Amadd9 - Am - F - Am - AmM7` — seven harmonically precise but denser chords, where `--triads-only` gives five you can read at tempo. `--min-duration` is worth reaching for separately if a detector flickers between two chords for a fraction of a second; it merges anything shorter than the value you give it into its neighbour.

Beats and downbeats mark where the bars fall:

```bash
sonare beats song.wav --json
sonare downbeats song.wav --json
```

```json
[0.279, 1.022, 1.788, 2.531, 3.274, 4.017, 4.783, 5.526]
[1.022, 4.017]
```

The two downbeats are 2.996 s apart — four beats at the 80 BPM this recording measures at (`sonare bpm song.wav --json` reports `{"bpm": 80.0}`), which lines up with the ~0.75 s beat spacing above. The gap before the first downbeat is a partial bar; playing along, the first downbeat you feel lands at 1.022 s, not 0.0 s.

That arithmetic is the grid below: set it to 80 BPM in 4/4 and the readout gives 0.75 s per beat and 3.0 s per bar, the spacing the beat and downbeat lists just reported. Drag it to 120 and the same six seconds hold half again as many bars — the other metrical level the tip that follows warns about, and the click you would be practising against if you took that figure.

<SonareDemo id="tempo-grid" />

::: tip Check the metrical level before you set the metronome
A tempo estimate is a choice of *which* pulse to call the beat, and a steady eighth-note pattern gives a tracker more than one defensible answer — half, double, or a dotted reading of the same groove. On this clip `sonare mastering-profile song.wav --json` reads the same audio at 119.9 BPM, a different metrical level, not a different tempo. Count a bar against the reported beat times before committing: if the number feels like it is fighting you, you are on the wrong level rather than out of time.
:::

```bash
sonare sections song.wav --json
```

```json
{"count": 2, "sections": [
  {"type": "unknown", "start": 0.0, "end": 6.223, "energy": 1.0, "confidence": 0.0},
  {"type": "outro", "start": 6.223, "end": 10.303, "energy": 0.018, "confidence": 0.895}
]}
```

`--min-duration` (default 4.0 s) sets the shortest section the detector will report; on a clip this short it doesn't change anything here, but on a full song it's what keeps a four-bar bridge from being merged into the verse around it. See [Section Structure](../glossary/analysis/section-structure.md) for what the section types mean — `unknown` here just means the detector found no stronger label than "not the ending," which given a ten-second clip made mostly of one groove is a fair result.

Put together, the chart reads: A minor, four beats to the bar at 80 BPM, `Am — F#dim — Am` under the first two bars, `F` starting on the downbeat at 6.11 s (just before the section detector's own boundary at 6.22 s — the two detectors work independently and won't always agree to the sample), then `Am` again to the end.

::: info A chord chart is a reading aid, not ground truth
Every chord object carries `confidence` for exactly this reason. `F#dim` at 0.613 is the lowest-confidence chord in this progression — a passing diminished harmony is genuinely ambiguous between a few reasonable readings, and a detector has to commit to one. Read a low-confidence chord as "listen here," not as an error to file a bug against.
:::

::: warning A C major / A minor split is the relative-key ambiguity, not a broken detector
`sonare analyze song.wav --json` also carries a `key` field, and on this file it reports `{"root": 0, "mode": 0, "confidence": 0.995, "name": "C major"}` while the dedicated `sonare key` reports `A minor` at 0.983. Those two are relatives: they share all seven notes, so a chroma profile is choosing a rotation rather than a pitch set, and either can win on weighting alone. [Key Detection](../glossary/analysis/key-detection.md) covers why, and why a relative swap moves the tonic while a parallel one (C major against C minor) only moves the mode.

The chart settles it, not the confidence figure. This progression opens and closes on `Am` and the bass lands on A, so A minor is the tonic to practise against. When the two readings are relatives, trust the chords and the bass; when they are not relatives, that is the disagreement worth a second listen.
:::

## Where to go next

- You're building the mix this practice kit will come from, not just learning one already recorded — [Mix and Master a Song in the CLI](./cli-mix-and-master.md) is the same shell-script approach applied to stems.
- You want the harmonic/percussive split or the chart data in an app instead of a script — the [CLI reference](../cli.md) and [Editing DSP](../editing-dsp.md) cover the same operations through the Python and JavaScript APIs.
- The chord, beat, and key numbers in the chart come from the same detectors covered in [Chord Recognition](../glossary/analysis/chord-recognition.md), [Beats and Downbeats](../glossary/analysis/beats-downbeats.md), and [Key Detection](../glossary/analysis/key-detection.md).
