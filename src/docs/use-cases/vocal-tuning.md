---
title: Tune a Vocal Take
description: Find which notes of a sung take are off and by how much, snap the whole take to a key from the CLI, see which notes that breaks, and retune note by note while keeping the vibrato.
---

# Tune a Vocal Take

You have a vocal take that is mostly right. A few notes sit flat or sharp, and you want them on pitch without the stepped, flattened sound of hard correction. You also want to know which notes moved and by how much. This page measures the take, tries the one-command fix from the CLI, shows the notes that fix breaks, and then retunes the take note by note.

The short version: `sonare pitch-correct-timevarying --mode scale` picks a target for every analysis frame on its own. Most notes come out close to pitch. A note sung near the halfway point between two notes of the key, with vibrato, gets pulled toward both of them. The vocal edit session in the Python binding moves each note as a whole, so the vibrato goes along with it unchanged.

## What You Will Learn

By the end of this page you should be able to:

- list the notes of a sung take with the pitch each was sung at, from the CLI;
- snap a whole take to a key in one command, and recognize the notes that this breaks;
- retune a take note by note with a vocal edit session, keeping the vibrato as sung;
- explain why the nearest semitone is a guess, and when to give the intended note instead.

## The material

Every number on this page comes from one file, `take.wav`: about 6 s of a sung "ah", 44.1 kHz mono. The phrase is C D E F G A G E D C, with a 60 ms glide into each note and a 5.5 Hz vibrato of ±25 cents that builds up over each note's first 200 ms. Each note was sung off pitch by a known amount:

| Note | C | D | E | F | G | A | G | E | D | C |
|------|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| Sung (cents) | 0 | −35 | +10 | −45 | +20 | −15 | +38 | −25 | +5 | −30 |

The take is synthesized, a sawtooth through three vowel formants, so that every result can be checked against what was actually sung. The "measured" columns below come from an independent check outside libsonare: the average instantaneous frequency of each note's fundamental over one whole vibrato cycle. It reads the original take to within 0.1 cent of the table. A real voice adds consonants, breath and less regular vibrato, so treat these numbers as the best case.

## The whole job

```bash
#!/usr/bin/env bash
set -euo pipefail

# 1. Which notes are off, and by how much.
sonare vocal-notes take.wav --segmentation-threshold-cents 40

# 2. The one-command fix: snap every frame to C major.
sonare pitch-correct-timevarying take.wav --mode scale --scale-root 0 \
  -o take-scale.wav --json
sonare vocal-notes take-scale.wav

# 3. Note by note instead, keeping the vibrato (script below).
python tune.py take.wav take-tuned.wav
sonare vocal-notes take-tuned.wav --segmentation-threshold-cents 40
```

## Step 1 — Measure the take

`sonare vocal-notes` splits a take into notes the way a vocal edit session does, and prints each note's pitch as the nearest note name plus an offset in cents. It only reads; nothing is written.

```bash
sonare vocal-notes take.wav
```

```text
Vocal notes: 10
  [0] 0.151-0.650 s  C4     +0.3 cents  midi 60.00  261.67 Hz  stability 0.777
  [1] 0.650-1.149 s  D4    -35.3 cents  midi 61.65  287.73 Hz  stability 0.664
  [2] 1.149-1.846 s  E4    +18.6 cents  midi 64.19  333.19 Hz  stability 0.550
  [3] 1.846-2.136 s  F4    -41.7 cents  midi 64.58  340.91 Hz  stability 0.725
  [4] 2.136-2.902 s  G4    +20.1 cents  midi 67.20  396.56 Hz  stability 0.621
  [5] 2.902-3.390 s  A4    -15.4 cents  midi 68.85  436.10 Hz  stability 0.672
  [6] 3.390-3.889 s  G4    +38.4 cents  midi 67.38  400.78 Hz  stability 0.676
  [7] 3.889-4.389 s  E4    -24.1 cents  midi 63.76  325.06 Hz  stability 0.432
  [8] 4.389-4.876 s  D4     +5.3 cents  midi 62.05  294.56 Hz  stability 0.663
  [9] 4.876-5.921 s  C4    -29.5 cents  midi 59.70  257.20 Hz  stability 0.615
```

Ten sung notes, ten notes found. The glides and the vibrato do not split a note, and eight of the readings are within 1 cent of what was sung.

E and F are the exception. E reads +18.6 instead of +10, and F starts at 1.846 s instead of 1.65 s. A new note starts when the pitch moves by more than the segmentation threshold, 50 cents by default. E sung at +10 and F sung at −45 are only 45 cents apart, so the boundary between them is found late, and the start of F is read as the end of E. When two neighboring notes were sung close together, lower the threshold:

```bash
sonare vocal-notes take.wav --segmentation-threshold-cents 40
```

```text
Vocal notes: 10
  [0] 0.151-0.650 s  C4     +0.3 cents  midi 60.00  261.67 Hz  stability 0.722
  [1] 0.650-1.149 s  D4    -35.3 cents  midi 61.65  287.73 Hz  stability 0.580
  [2] 1.149-1.683 s  E4    +10.1 cents  midi 64.10  331.55 Hz  stability 0.553
  [3] 1.683-2.136 s  F4    -44.8 cents  midi 64.55  340.30 Hz  stability 0.699
  [4] 2.136-2.891 s  G4    +20.1 cents  midi 67.20  396.56 Hz  stability 0.536
  [5] 2.891-3.379 s  A4    -15.4 cents  midi 68.85  436.10 Hz  stability 0.547
  [6] 3.379-3.878 s  G4    +38.4 cents  midi 67.38  400.78 Hz  stability 0.563
  [7] 3.878-4.377 s  E4    -24.1 cents  midi 63.76  325.06 Hz  stability 0.129
  [8] 4.377-4.876 s  D4     +5.3 cents  midi 62.05  294.56 Hz  stability 0.515
  [9] 4.876-5.921 s  C4    -29.5 cents  midi 59.70  257.20 Hz  stability 0.519
```

Now every reading is within 1 cent of the table. F is the worst note, 45 cents flat. The second G is 38 cents sharp, and D and the last C are about 30 cents flat. `--json` gives the same notes with start and end samples, ready for a script, and each note's entry also carries its per-frame `amplitude` array, so the output is large. `--frame-length-samples`, `--hop-length-samples`, `--yin-threshold`, `--voiced-threshold` and `--no-centered` set the pitch analysis the notes are cut from; `sonare pitch --json --frames` gives the raw per-frame pitch contour if you want to plot it.

## Step 2 — Snap the whole take to the key

```bash
sonare pitch-correct-timevarying take.wav --mode scale --scale-root 0 \
  -o take-scale.wav --json
```

```json
{"length": 266805, "sample_rate": 44100, "duration": 6.05, "output": "take-scale.wav"}
```

`--scale-root 0` is C, and the default scale is major. `--scale-mode-mask` takes a mode name for other scales: A minor is `--scale-root 9 --scale-mode-mask minor`. The output is the same length as the input; only pitch changes.

Eight of the ten notes land within 4.4 cents of pitch. Two do not:

| Note | Sung (cents) | After `--mode scale` | Vibrato after (sung ±25) |
|------|-----:|-----:|-----:|
| F | −45 | −49.8 | ±41.8 |
| last C | −30 | −23.1 | ±40.2 |
| the other eight | −35 to +38 | −3.9 to +4.4 | ±19.4 to ±22.7 |

Neither note was corrected, and both now wobble almost twice as wide as they were sung. `vocal-notes` on the output shows the two uncorrected notes:

```text
  [3] 1.695-2.136 s  F4    -49.4 cents  midi 64.51  339.40 Hz  stability 0.527
  [9] 4.888-5.921 s  C4    -25.1 cents  midi 59.75  257.86 Hz  stability 0.587
```

The reason is that the command works frame by frame, which its `--help` also says. For each analysis frame it takes the note of the key nearest that frame's pitch, leaves the frame alone when it is within 20 cents of it (`--vibrato-threshold-cents`), and otherwise pulls it there with a 50 ms time constant (`--retune-speed-ms`). The F was sung 45 cents flat with ±25 cents of vibrato, so it swings between 70 and 20 cents under F, which is 30 to 80 cents above E. At the bottom of each cycle the nearest note of the key is E, and at the top it is F. The correction pulls the troughs toward E and the peaks toward F, and the vibrato widens. The last C does the same between C and B: its troughs reach 55 cents under C, which is nearer B. On the notes it does correct, the 20-cent dead band also trims the vibrato from ±25 to about ±21 cents.

The two retune options change how much of this you get, not whether you get it:

| Options | F | last C | Mean distance from pitch, all ten |
|---------|-----:|-----:|-----:|
| defaults | −49.8, ±41.8 | −23.1, ±40.2 | 9.5 |
| `--vibrato-threshold-cents 0` | −49.7, ±41.8 | −19.8, ±41.6 | 7.7 |
| `--vibrato-threshold-cents 60` | −44.8, ±25.2 | −29.9, ±25.3 | 21.7 |
| `--retune-speed-ms 200` | −48.5, ±27.9 | −19.2, ±29.2 | 14.7 |
| `--retune-speed-ms 500` | −44.9, ±26.3 | −23.5, ±25.9 | 19.8 |

A wide dead band or a slow retune keeps the vibrato by not correcting: at 60 cents almost nothing moves, and the mean is back near the uncorrected 22.3. A note sung well off pitch, with vibrato, is exactly the note you wanted fixed, so this is a limit of correcting frame by frame, not a setting to find.

The demo below puts the same two controls, retune strength and retune speed, on a deliberately off-key melody. Compare the raw take with the tuned one.

<SonareDemo id="pitch-correct" />

## Step 3 — Retune note by note

A vocal edit session corrects a note as one unit. With a `center` target it moves the whole note by the distance from its measured center to the target, and the drift and vibrato inside the note stay as they were sung. The script finds the notes as Step 1 did, with the same 40-cent threshold, and retunes each one to its nearest semitone:

```python
"""Pull every sung note to the nearest semitone as a whole, keeping its vibrato."""
import sys, wave
import numpy as np
from dataclasses import replace
from libsonare import VocalCreateOptions, VocalSetNoteEdit, VocalTargetMode, create_vocal_edit_session

def load(path):
    with wave.open(path, "rb") as w:
        pcm = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2")
        return (pcm / 32768.0).astype(np.float32), w.getframerate()

def save(path, samples, sr):
    pcm = (np.clip(samples, -1.0, 1.0) * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes(pcm.tobytes())

samples, sr = load(sys.argv[1])
options = VocalCreateOptions(segmentation_threshold_cents=40.0)
with create_vocal_edit_session(samples, sr, options=options) as session:
    notes, _ = session.notes()
    edits = [
        VocalSetNoteEdit(n.id, replace(n.edit, target_mode=VocalTargetMode.CENTER,
                                       target_midi=float(round(n.center_midi)), amount=1.0))
        for n in notes if n.has_pitch
    ]
    draft = session.begin_edit()
    draft.apply(edits, draft.token().generation)
    draft.commit()
    print(f"retuned {len(edits)} of {len(notes)} notes")
    save(sys.argv[2], session.render().samples, sr)
```

```bash
python tune.py take.wav take-tuned.wav
sonare vocal-notes take-tuned.wav --segmentation-threshold-cents 40
```

```text
retuned 10 of 10 notes
Vocal notes: 10
  [0] 0.151-0.650 s  C4     +0.1 cents  midi 60.00  261.64 Hz  stability 0.710
  [1] 0.650-1.149 s  D4     +0.8 cents  midi 62.01  293.80 Hz  stability 0.577
  [2] 1.149-1.672 s  E4     -0.3 cents  midi 64.00  329.56 Hz  stability 0.579
  [3] 1.672-2.148 s  F4     -0.1 cents  midi 65.00  349.20 Hz  stability 0.679
  [4] 2.148-2.891 s  G4     +0.2 cents  midi 67.00  392.04 Hz  stability 0.599
  [5] 2.891-3.379 s  A4     -0.0 cents  midi 69.00  440.00 Hz  stability 0.517
  [6] 3.379-3.889 s  G4     +0.1 cents  midi 67.00  392.01 Hz  stability 0.547
  [7] 3.889-4.377 s  E4     -0.1 cents  midi 64.00  329.61 Hz  stability 0.316
  [8] 4.377-4.888 s  D4     -0.1 cents  midi 62.00  293.65 Hz  stability 0.511
  [9] 4.888-5.921 s  C4     +0.1 cents  midi 60.00  261.64 Hz  stability 0.572
```

The independent check agrees:

| Note | Sung | `--mode scale` | Note by note | Vibrato note by note |
|------|-----:|-----:|-----:|-----:|
| C | 0 | +3.9 | −0.3 | ±25.2 |
| D | −35 | −2.5 | +1.0 | ±25.3 |
| E | +10 | +2.8 | 0.0 | ±25.3 |
| F | −45 | −49.8 | −0.3 | ±25.4 |
| G | +20 | +4.4 | +0.3 | ±24.8 |
| A | −15 | −0.4 | +0.6 | ±25.0 |
| G | +38 | +3.4 | −0.4 | ±25.6 |
| E | −25 | −3.9 | −1.0 | ±25.1 |
| D | +5 | +0.4 | −0.1 | ±25.2 |
| C | −30 | −23.1 | −0.8 | ±25.4 |
| Mean distance from pitch | 22.3 | 9.5 | 0.5 | |

Every note is within 1 cent, and every vibrato is still ±25 cents. The threshold matters here as much as in Step 1: with the default 50 cents the same script leaves E at −8.8, because its note is the E+F span that Step 1 read at +18.6, and the mean is 1.6 cents. The session can only move the notes it was given, so check `vocal-notes` before retuning.

## Step 4 — Decide which note each note should be

Both paths above assume the singer meant the nearest note. A note sung more than 50 cents off reads as its neighbor, and both paths pull it there. The CLI knows only the key, and `tune.py` only rounds. When you know the melody, give the session the intended note instead of the rounded one. For example, if the take should be C D E F G A G E D C:

```python
melody = [60, 62, 64, 65, 67, 69, 67, 64, 62, 60]
sung = [n for n in notes if n.has_pitch]
edits = [
    VocalSetNoteEdit(n.id, replace(n.edit, target_mode=VocalTargetMode.CENTER,
                                   target_midi=float(midi), amount=1.0))
    for n, midi in zip(sung, melody, strict=True)
]
```

`strict=True` raises an error when the number of notes found is not the number in the melody, which is the cue to look at `vocal-notes` again rather than retune the wrong notes. The same edit takes an `amount` below 1 to move a note only part of the way, and a `speed_ms` above 0 to ease into the correction instead of applying it from the note's first frame. [Offline Monophonic Vocal Editing](../vocal-editing.md) covers both, along with undo, saving the session, and attaching the result to a project.

## Where to go next

- [Offline Monophonic Vocal Editing](../vocal-editing.md) describes the whole session API: splitting and merging notes, timing and formant edits, undo/redo, and the same calls from JavaScript.
- [CLI commands](../cli-commands.md#editing) lists `vocal-notes`, `pitch-correct-timevarying`, `pitch-correct` and `scale-quantize` with their options.
- [Build Practice Tracks](./practice-tracks.md) transposes a whole recording, for when the key is wrong rather than the notes.
- [Pitch Correction and Note Editing](../glossary/editing/pitch-correction.md) explains correction toward a target note and how a measured correction is limited.
- [Audio to MIDI](../audio-to-notes.md) turns a sung line into MIDI notes with the monophonic transcription path.
