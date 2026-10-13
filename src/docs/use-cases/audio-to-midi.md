---
title: Turn a Piano Recording into MIDI
description: Transcribe a WAV or MP3 of a piano piece into a Standard MIDI File from the CLI, check the result against the score, tune it, and know why a band mix needs stem separation first.
---

# Turn a Piano Recording into MIDI

You have a recording of a piano piece, as a WAV or an MP3, and you want the notes as a MIDI file: to load into a sequencer, to read as a piano roll, or to practise from. This page does that with `sonare transcribe`, then measures how close the result is to the score, tunes it, and shows what happens when the piano is not alone in the recording.

The short version of the last part: transcription reads every pitched sound in the file. On a solo piano recording that is the piano. On a band mix it is also the bass, the pad and the voice, and libsonare does not separate instruments. Run a source-separation model first and transcribe the piano stem it gives you.

## What You Will Learn

By the end of this page you should be able to:

- turn a WAV or MP3 of a piano piece into a Standard MIDI File in one command;
- score a transcription against a reference MIDI file, and read precision, recall and F1;
- trade recall for precision with two options, and know which errors remain;
- explain why a full mix needs an instrument stem before transcription, and why a harmonic/percussive split is not that stem.

## The material

Every number on this page comes from one file: the first 16 bars of the Aria from the Goldberg Variations (223 notes, 70 BPM, about 42 s), rendered through the engine's built-in piano and encoded as a 128 kbps MP3, `aria.mp3`. The score it was rendered from, `aria-score.mid`, is the answer key. A second file, `aria-band.mp3`, is the same piano with a bass line, a string pad holding each bar's chord and a drum kit mixed in at about the piano's level.

::: tip Making your own test pair
Rendering a MIDI file you already have is the quickest way to get a recording with a known answer: `sonare project import-smf --smf score.mid -o score.json`, then `sonare midi-render --in score.json -o score.wav`. A rendered piano is cleaner than a microphone in a room, so treat the numbers it gives as an upper bound for real recordings.
:::

## The whole job

```bash
#!/usr/bin/env bash
set -euo pipefail

# 1. Transcribe. MP3 and WAV are both read directly.
sonare transcribe aria.mp3 --polyphonic -o aria.mid --json

# 2. With a score to compare against, measure the result (script below).
python score.py aria-score.mid aria.mid

# 3. Fewer extra notes: a higher per-frame floor and a longer shortest note.
sonare transcribe aria.mp3 --polyphonic \
  --min-frame-peak-ratio 0.4 --min-note-ms 90 -o aria-tuned.mid --json
python score.py aria-score.mid aria-tuned.mid
```

<FlowDiagram
  title="From a recording to a MIDI file"
  direction="LR"
  :nodes="[
    { id: 'solo', label: 'Solo piano (WAV / MP3)', col: 0, row: 0, variant: 'muted' },
    { id: 'band', label: 'Band mix', col: 0, row: 1, variant: 'muted' },
    { id: 'sep', label: 'source-separation model', col: 1, row: 1 },
    { id: 'stem', label: 'piano stem', col: 2, row: 1 },
    { id: 'tr', label: 'transcribe --polyphonic', col: 3, row: 0, variant: 'accent' },
    { id: 'mid', label: 'MIDI file', col: 4, row: 0, variant: 'success' },
    { id: 'score', label: 'score.py against a reference', col: 4, row: 1 }
  ]"
  :edges="[
    { from: 'solo', to: 'tr' },
    { from: 'band', to: 'sep' },
    { from: 'sep', to: 'stem' },
    { from: 'stem', to: 'tr' },
    { from: 'tr', to: 'mid' },
    { from: 'mid', to: 'score' }
  ]"
  caption="A solo recording goes straight to the transcriber; a mix goes through an instrument separator first, which libsonare does not provide."
/>

## Step 1 — Transcribe

::: code-group

```bash [CLI]
sonare transcribe aria.mp3 --polyphonic -o aria.mid --json
```

```typescript [Node]
import { transcribe } from '@libraz/libsonare-native';

// samples: mono Float32Array of aria.mp3, decoded by your app
const { events, noteCount, tempoBpm } = transcribe({ samples, sampleRate, polyphonic: true });
```

```python [Python]
import libsonare as sonare

# samples: mono samples of aria.mp3, decoded by your app
result = sonare.transcribe(samples, sample_rate, polyphonic=True)
print(result.note_count, result.tempo_bpm)
```

:::

```json
{"output": "aria.mid", "note_count": 282, "tempo_bpm": 142.3509979248047, "bytes": 3513}
```

The library call returns the note events (`events`, `noteCount`, `tempoBpm`) rather than a file; the `.mid` file is the CLI's output, and the same options are accepted as `minFramePeakRatio`, `minNoteMs` and `maxPolyphony` (Python `min_frame_peak_ratio`, `min_note_ms`, `max_polyphony`). `--polyphonic` matters for piano: the default path follows one pitch at a time, which suits a voice or a single melody line, and a piano piece has a melody and a bass at once. The command also prints `warning: 2-channel input is downmixed to mono` on stderr; transcription reads one channel, so that is expected.

The file decodes directly; there is no conversion step for MP3. Transcribing the WAV the MP3 was encoded from gives 286 notes instead of 282 and an F1 of 0.74 against the MP3's 0.75, so at 128 kbps the encoding is not what limits the result.

The demo shows the same idea on a short phrase: audio goes in, and a list of timed notes comes out.

<SonareDemo id="audio-to-notes" />

`tempo_bpm` is the tempo the MIDI file's bars are built on. It reports 142.35 here for a piece at 70 BPM: the detector chose the eighth-note level, so a sequencer shows twice as many bars as the score has. The notes are in the right places either way — passing `--tempo-bpm 70` writes the same 282 notes at the same times — so the tempo only decides how the file reads in a sequencer. Pass it when you know it.

## Step 2 — Check it against the score

When you have a reference MIDI file for the piece, a few lines of Python with the libsonare binding score the transcription. A transcribed note counts as correct when it has the same MIDI note number as a score note and starts within 50 ms of it; each score note can be matched once.

```python
"""Compare a transcribed SMF against the score: onset within 50 ms, same MIDI note."""
import sys
from libsonare import note_targets_from_smf

def notes(path):
    with open(path, "rb") as f:
        return [(n.start_sec, round(n.target_midi)) for n in note_targets_from_smf(f.read())]

score, found = notes(sys.argv[1]), notes(sys.argv[2])
unused = list(found)
hits = 0
for onset, midi in score:
    near = [n for n in unused if n[1] == midi and abs(n[0] - onset) <= 0.05]
    if near:
        unused.remove(min(near, key=lambda n: abs(n[0] - onset)))
        hits += 1
precision, recall = hits / len(found), hits / len(score)
f1 = 2 * precision * recall / (precision + recall) if hits else 0.0
print(f"score {len(score)}  found {len(found)}  matched {hits}  "
      f"precision {precision:.2f}  recall {recall:.2f}  F1 {f1:.2f}")
```

```bash
python score.py aria-score.mid aria.mid
```

```text
score 223  found 282  matched 189  precision 0.67  recall 0.85  F1 0.75
```

Recall says how much of the score was found: 189 of 223 notes, 0.85. Precision says how much of what was found is in the score: 189 of 282, 0.67. The transcription heard most of the piece, and about a third of what it wrote is not in the score. F1 combines the two. `note_targets_from_smf` reads each file through its own tempo map, so the comparison is in seconds and the transcription's 142 BPM grid does not matter.

## Step 3 — Tune for fewer extra notes

The default polyphonic settings keep dense material: up to ten voices per frame, notes from 60 ms, and a same-pitch re-strike as a new note. For a piano piece with two or three voices, that is generous. Two options trim it:

```bash
sonare transcribe aria.mp3 --polyphonic \
  --min-frame-peak-ratio 0.4 --min-note-ms 90 -o aria-tuned.mid --json
python score.py aria-score.mid aria-tuned.mid
```

```text
score 223  found 221  matched 174  precision 0.79  recall 0.78  F1 0.78
```

| Run | Notes found | Precision | Recall | F1 |
|-----|------------:|----------:|-------:|---:|
| Defaults | 282 | 0.67 | 0.85 | 0.75 |
| `--max-polyphony 4` | 275 | 0.69 | 0.85 | 0.76 |
| `--min-note-ms 90` | 254 | 0.73 | 0.83 | 0.78 |
| `--min-frame-peak-ratio 0.4` | 232 | 0.77 | 0.80 | 0.78 |
| `--min-frame-peak-ratio 0.4 --min-note-ms 90` | 221 | 0.79 | 0.78 | 0.78 |

`--min-frame-peak-ratio` stops each frame's search for further pitches once the next peak is below that share of the frame's first peak (default 0.20), which removes the weak candidates that sit under the strong ones. `--min-note-ms` drops anything shorter. Both trade recall for precision, and F1 moves only from 0.75 to 0.78, so neither run is clearly better. Pick by the editing you would rather do afterwards: the defaults leave more extra notes to delete, the tuned run more missing notes to add. `--max-polyphony` changes little because the extra notes are not extra simultaneous voices; most of them are the same pitch found again.

What is left after tuning, sorted by cause. A note at the right pitch counts as found when it starts within 50 ms of the score note; the rest are sorted as follows:

- **33 of the 47 extra notes repeat a held note**: the same pitch again, while the score note is still sounding.
- **9 notes are found at the right pitch but 50–150 ms off the score's onset**, so they count once as a miss and once as an extra.
- **5 extra notes are overtones**, an octave, a twelfth or two octaves above a sounding score note.
- **40 score notes are not found at all** at their pitch. 6 of those were found an octave away, and 15 are shorter than 150 ms.

So the realistic result for a clean piano recording is a MIDI file that has the piece's pitches and most of its rhythm, and that still needs a pass in a piano-roll editor: deleting repeats of held notes and adding the short notes it missed. The [Piano Transcription](/transcribe) demo runs the same detector in the browser and shows which notes each option adds or removes.

## Step 4 — A band mix needs a stem first

Run the same commands on the band version:

```bash
sonare transcribe aria-band.mp3 --polyphonic -o band.mid --json
python score.py aria-score.mid band.mid
```

```text
score 223  found 542  matched 165  precision 0.30  recall 0.74  F1 0.43
```

The piano's notes are still found (recall 0.74), but they are buried among 377 others: the bass line, the pad's chord tones and partials of the drums, each transcribed as faithfully as the piano. The tuned settings bring it to F1 0.55 (316 notes found), still well under the 0.78 the same options give on the piano alone.

A harmonic/percussive split helps only a little:

```bash
sonare hpss aria-band.mp3 -o band --json
sonare transcribe band_harmonic.wav --polyphonic -o band-harmonic.mid --json
python score.py aria-score.mid band-harmonic.mid
```

```text
score 223  found 492  matched 172  precision 0.35  recall 0.77  F1 0.48
```

The demo shows what the split leaves on each side: sustained lines in the harmonic layer, hits in the percussive one.

<SonareDemo id="hpss-separation" />

HPSS removes the drums and gains 0.05 of F1, but the drums were not the main problem. The bass and the pad are sustained and pitched, so they land on the harmonic side together with the piano. That is the difference between [source separation](../source-separation.md) in libsonare (harmonic/percussive, or unlabeled NMF components) and an instrument separator: neither of libsonare's methods knows what a piano is.

::: warning Separate first, then transcribe
For a song with other instruments, run a source-separation model that outputs a piano (or "other") stem, and give `sonare transcribe` that stem. libsonare does not include such a model. How close you get depends on how clean the stem is: a perfect stem is the solo case above (F1 0.75 at defaults, 0.78 tuned), and every bit of bass or pad left in the stem pulls the result toward the band numbers.
:::

## Where to go next

- [Audio to MIDI](../audio-to-notes.md) lists every transcription option, the monophonic path for a single voice or instrument, and the same call from JavaScript and Python.
- [Piano Transcription](/transcribe) runs the polyphonic path in the browser on a piano piece or your own file and plays the result back.
- [Source Separation](../source-separation.md) explains what HPSS and NMF separate, and what they do not.
- [Build Practice Tracks](./practice-tracks.md) uses the same recording-in, kit-out approach for slowed and transposed practice copies.
