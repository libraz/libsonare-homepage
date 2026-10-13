---
title: CLI Examples
description: Shell walkthroughs for the sonare CLI, covering basic analysis, feature summary export, batch processing, mixing, and project and MIDI workflows.
---

# CLI Examples

End-to-end shell walkthroughs for the `sonare` CLI, split out from the [CLI Reference](./cli.md) index. The mastering and repair walkthrough is on the CLI Reference, under [Mastering and Repair](./cli.md#mastering-and-repair).

## Basic Analysis Workflow

```bash
# Quick BPM and key check
sonare bpm song.mp3
sonare key song.mp3

# All-in-one analysis with JSON output for scripting
sonare analyze song.mp3 --json > analysis.json
```

### The analyze JSON

```json
{
  "bpm": 120.5,
  "bpm_confidence": 0.95,
  "key": {
    "root": 0,
    "mode": 0,
    "confidence": 0.85,
    "name": "C major"
  },
  "time_signature": {
    "numerator": 4,
    "denominator": 4,
    "confidence": 0.91
  },
  "beats": [
    {"time": 0.52, "strength": 0.84},
    {"time": 1.02, "strength": 0.78}
  ],
  "downbeat_indices": [0, 4, 8],
  "downbeat_phase": 0,
  "chords": [
    {"name": "C", "start": 0.0, "end": 2.0, "confidence": 0.88}
  ],
  "sections": [
    {"type": "intro", "start": 0.0, "end": 8.0}
  ],
  "timbre": {
    "brightness": 0.61,
    "warmth": 0.47,
    "density": 0.72,
    "roughness": 0.18,
    "complexity": 0.56
  },
  "dynamics": {
    "dynamic_range_db": 9.4,
    "loudness_range_db": 6.8,
    "crest_factor": 7.2,
    "is_compressed": false
  },
  "rhythm": {
    "syncopation": 0.32,
    "groove_type": "straight",
    "pattern_regularity": 0.89
  },
  "form": "IAB"
}
```

The arrays above are abbreviated. In particular, `beats` contains one
`{"time", "strength"}` object per detected beat; it is not a beat count.

`downbeat_indices` indexes into `beats` rather than carrying times of its own, so
finding the downbeats is a membership test against that array — `beats[i]` is a
downbeat when `i` appears in `downbeat_indices`. `downbeat_phase` is the beat
index the first downbeat falls on, which is how many beats of the first bar the
take starts partway through.

## Feature Summary Export

```bash
# Export compact feature summaries
sonare mel song.mp3 --json > mel_features.json
sonare spectral song.mp3 --json > spectral_features.json
sonare chroma song.mp3 --json > chroma_features.json
```

## Batch Processing

```bash
# Analyze all MP3 files in directory
for f in *.mp3; do
  echo "Processing: $f"
  sonare analyze "$f" --json > "${f%.mp3}.json"
done

# Extract BPM from all files
for f in *.wav; do
  bpm=$(sonare bpm "$f" --json | jq -r '.bpm')
  echo "$f: $bpm BPM"
done
```

## Mixing Workflow

::: info Command availability
`mix` — which loads a mixer scene from a JSON file or a built-in preset and
optionally renders per-strip input WAVs — is Python CLI only. `mixing-presets`,
`mixing-preset`, `suggest-mix`, and `mix-strip` are on both CLIs; they list
scenes, print scene JSON loadable by the WASM, Python, Node, or C++ mixer APIs,
suggest a scene from a set of tracks, and run the single-input channel strip.
:::

```bash
# List the built-in mixer scene presets
sonare mixing-presets

# Print one preset's scene as JSON
# (--preset is one of: vocalReverbSend, drumBusSubgroup, commentaryDucking;
#  it defaults to vocalReverbSend when omitted)
sonare mixing-preset --preset vocalReverbSend > scene.json

# Load a built-in scene preset and render per-strip inputs to a stereo WAV
sonare mix \
  --preset vocalReverbSend \
  --input vocal.wav \
  --input music.wav \
  --sample-rate 48000 \
  -o mixed.wav

# Or load a scene from JSON (e.g. exported from `mixing-preset`)
sonare mix --scene scene.json --input vocal.wav --input music.wav -o mixed.wav
```

| Option | Default | Description |
|--------|---------|-------------|
| `--scene FILE` | — | Mixer scene JSON. Give exactly one of `--scene` and `--preset` |
| `--preset NAME` | — | Built-in scene preset (`mixing-presets` lists them) |
| `--input [ID=]WAV` | — | One input per strip, repeatable; see below |
| `-o`, `--output` | — | Rendered stereo WAV |
| `--sample-rate` | 48000 | Mixer sample rate; inputs are resampled to it |
| `--block-size` | 512 | Maximum mixer block size in frames |

`--scene` and `--preset` are mutually exclusive: passing both is a usage error, and passing neither exits 2 as well rather
than falling back to a default scene. The Python CLI prints a `warning:` line on stderr for every scene key the reader does not consume (a misspelled `faderDB`, say) and still renders; keys starting with `$` or `x-` are exempt.

`--input` takes `[ID=]WAV` and repeats. An `ID=` prefix names the strip the file
feeds; a bare path uses the file's base name as the id. A strip that no entry
names is fed silence rather than dropped, which is what lets an
assistant-suggested scene — whose effect returns are fed by sends, not by files —
render without a silent WAV per return. Entries that name no strip at all are
taken positionally instead, one per strip in scene order, and the two spellings
cannot be mixed in one invocation. Inputs shorter than the longest are padded
rather than the set being truncated.

`--input` and `-o/--output` go together — either both or neither, and without
them `mix` just loads the scene and reports its strip count.

### suggest-mix

`suggest-mix` goes the other way: hand it the individual tracks and the [mixing assistant](./mixing-assistant.md) proposes a
mixer scene, which `mix --scene` then renders.

```bash
sonare suggest-mix \
  --input vocal=vocal.wav \
  --input drums=drums.wav \
  --tempo-bpm auto \
  --scene-out scene.json
```

| Option | Default | Description |
|--------|---------|-------------|
| `--input [ID=]WAV` | — | One per track, repeatable. A stereo file keeps both channels, so the assistant can read its image; more than two are downmixed. Each file is read at its own rate and resampled onto `--sample-rate`; `ID` defaults to the file's base name |
| `--sample-rate` | 48000 | Shared analysis sample rate |
| `--tempo-bpm BPM\|auto` | — | Tempo the suggested delay times are voiced against. `auto` detects it from the first `--input`; omitted, the transport's fallback tempo is used |
| `--params k=v,...` | — | Assistant parameter overrides |
| `--scene-out FILE` | — | Also write just the suggested scene, in the form `mix --scene` reads |

The full suggestion goes to stdout as JSON; `--scene-out` is what you feed back
into `mix`.

### The channel strip

The single-input channel strip is a different command with a different job, and
it is called `mix-strip`. Both front-ends carry it and take the same options:

```bash
sonare-cli mix-strip vocal.wav -o strip.wav \
  --input-trim-db -2 --fader-db 1.5 --pan 0.2 --pan-mode balance --width 1.4
```

| Option | Default | Description |
|--------|---------|-------------|
| `--input-trim-db` | 0.0 | Gain applied before the strip |
| `--fader-db` | 0.0 | Fader gain |
| `--pan` | 0.0 | Pan position, -1 to 1 |
| `--pan-mode` | balance | `balance`, `stereo-pan`, or `dual-pan`, matched case-insensitively |
| `--width` | 1.0 | Stereo width; 0 collapses to mono, above 1 widens |

The strip reads and writes true stereo, so a stereo source keeps its image.
`--width` has nothing to act on for a mono source, so any value other than 1.0
against a mono input is rejected instead of quietly doing nothing.

::: warning `sonare-cli mix` does not exist
The native CLI has no `mix` command at all: the strip command answers to
`mix-strip` and nothing else, so a script that calls `sonare-cli mix` fails as an
unknown command rather than as a bad option. Use `mix-strip` for the channel
strip.

The name is not shared because one spelling would name two different things: the
channel strip on the native CLI, and the scene mixer on the Python CLI. `sonare mix` on the Python CLI is the scene mixer.
:::

Related: [Mixing Engine](./mixing.md).

## Project & MIDI Workflow

The `sonare project` command group runs headless project and Standard MIDI File
(SMF) / MIDI 2.0 workflows from JSON project files. `project bounce --synth`
routes the project's MIDI tracks through the built-in synth instead of clip
audio, and the flag reads two ways:

- **Bare `--synth`** follows the project's General MIDI program changes per
  channel, with channel 10 routed through the GM drum-kit map. This is the
  option to use when the project carries real GM programs.
- **`--synth <preset>`** pins every destination to one fixed NativeSynth preset.
  Run `sonare project synth-presets` to list the names.

`project bounce` writes the channel count you ask for with `--channels`. Its
positive output widths are `1`, `2`, `6`, or `8`; omitting the option or passing
`0` or a negative value selects the default two channels. A `"5.1"` master
allows up to six channels and a `"7.1"` master up to eight. Mono and stereo
masters, and scenes without a master, allow up to two.

```bash
# Print the project ABI version
sonare project abi

# Create an empty project JSON at a given sample rate
sonare project new --sample-rate 48000 -o project.json

# Validate a project JSON (prints diagnostics; optionally writes canonicalized JSON with -o)
sonare project validate --in project.json
sonare project validate --in project.json -o canonical.json

# Treat any repair diagnostic as a failure — for CI
sonare project validate --in project.json --strict

# Compile-check a project JSON (prints diagnostics; exits non-zero on errors; does not write a file)
sonare project compile --in project.json

# List the NativeSynth presets --synth accepts
sonare project synth-presets

# Render a project to a WAV at the requested channel count
sonare project bounce --in project.json --sample-rate 48000 --channels 2 -o bounce.wav

# Render a 5.1 master to a six-channel WAV
sonare project bounce --in project-51.json --sample-rate 48000 --channels 6 -o bounce-51.wav

# Render the MIDI tracks through the built-in synth, following GM programs
sonare project bounce --in project.json --synth -o gm-bounce.wav

# …or pin every destination to one preset
sonare project bounce --in project.json --synth saw-lead -o synth-bounce.wav
```

| Command | Description | Notable options |
|---------|-------------|-----------------|
| `sonare project abi` | Print the project ABI version | — |
| `sonare project new` | Create an empty project JSON | `--sample-rate`, `-o` |
| `sonare project validate` | Validate a project JSON; optionally write canonicalized JSON | `--in`, `-o`, `--strict` (any diagnostic fails) |
| `sonare project compile` | Compile-check a project JSON; prints diagnostics, exits non-zero on errors (writes no file) | `--in`, `--json` |
| `sonare project synth-presets` | List the NativeSynth preset names `--synth` accepts | `--json` |
| `sonare project bounce` | Render a project to a WAV (a project whose `sample_rate` is not a whole number of hertz exits 5); positive `--channels` widths are `1`, `2`, `6`, or `8` (default `2`), capped by the master layout (mono, stereo, or no master allows up to two) | `--in`, `--sample-rate`, `--frames`, `--block-size`, `--channels`, `--instrument-latency`, `--synth`, `--audio`, `--resolve-audio`, `-o` |
| `sonare project export-smf` | Export the project to a Standard MIDI File | `--in`, `-o` |
| `sonare project import-smf` | Build a project from a Standard MIDI File | `--smf`, `-o` |
| `sonare project export-midi2` | Export the project to a MIDI 2.0 Clip File | `--in`, `-o` |
| `sonare project import-midi2` | Build a project from a MIDI 2.0 Clip File | `--midi2`, `-o` |

A project document carries only a URI reference for an audio clip's source —
never decoded PCM — so a document with audio clips renders silence until those
sources are bound. `project bounce` has two ways to bind them: `--audio
SOURCE_ID=WAV` binds one source per occurrence and repeats once per source;
`--resolve-audio` instead opens the `file://` URIs the document's own
unresolved sources already carry, and refuses any other scheme by name. A
source still unresolved once both are applied is named with its id, its URI,
and the option that would have supplied it. Both front-ends take both options.

```bash
# Bind two audio sources by id, then render
sonare project bounce --in project.json \
  --audio 1=vocal-take.wav --audio 2=harmony-take.wav \
  -o bounce.wav

# Or resolve the document's own file:// URIs instead of naming each source
sonare project bounce --in project.json --resolve-audio -o bounce.wav
```

```bash
# Round-trip a project through Standard MIDI File format
sonare project export-smf --in project.json -o project.mid
sonare project import-smf --smf project.mid -o roundtrip.json

# Round-trip through MIDI 2.0 Clip File format
sonare project export-midi2 --in project.json -o project.midi2
sonare project import-midi2 --midi2 project.midi2 -o roundtrip2.json

# Render a project's MIDI tracks through the built-in synth
sonare project bounce --in project.json --synth --sample-rate 48000 -o render.wav
```

Both CLIs also have `midi-render`, a shorthand for `project bounce` that always
takes the synth path — omit `--synth` there and it follows GM programs. It uses
the same `--channels` values and scene-master cap. The full option set is listed
in the `sonare project` table earlier in this section.

### transcribe

`transcribe` is the reverse direction: audio in, a Standard MIDI File out (see [Audio to MIDI](./audio-to-notes.md)). It is
on both CLIs.

```bash
sonare transcribe solo.wav -o solo.mid
sonare transcribe chords.wav -o chords.mid --polyphonic --tempo-bpm 120
```

| Option | Description |
|--------|-------------|
| `--tempo-bpm` | Tempo the PPQ grid is built on. Omitted, it is detected from the take |
| `--polyphonic` | Use the multi-F0 chain, which finds overlapping notes |
| `--reference-hz` | Tuning reference the MIDI note numbers are measured against (default 440) |
| `--fmin`, `--fmax` | F0 range in Hz for either chain; omitted endpoints use 65/2093 for monophonic and 55/1760 for polyphonic, while explicit endpoints override the selected chain's defaults |
| `--max-polyphony` | Polyphonic only: voices kept per frame, 1 to 64 (default 10) |
| `--min-frame-peak-ratio` | Polyphonic only: the per-frame search stops below this share of the frame's first peak (default 0.20); finite and at least 0, and `0` is a real zero |
| `--min-ridge-peak-ratio` | Polyphonic only: a fade below this share of a ridge's own peak breaks the ridge (default 0.10); same domain |
| `--reattack-ratio` | Polyphonic only: a pitch struck again while it still sounds becomes a new note when its salience climbs past this multiple of the level before (default 2.0); `0` turns the split off, otherwise it must be greater than 1 |
| `--min-note-division N` | Shortest note as a note value, 1 to 128: `32` keeps notes from a thirty-second note up at the transcription tempo. Applies to both chains; refused together with `--min-note-ms` |
| `--min-note-ms` | Shortest span kept as a note, in ms (default 30 monophonic, 60 polyphonic); refused together with `--min-note-division` |
| `--segmentation-threshold-cents` | Monophonic split threshold in cents (default 50); the polyphonic path uses it only for reported F0 stability and never to split a ridge |
| `--velocity-floor-db` | Level mapped to velocity 1; does not drop notes (a note more than 36 dB under the take's loudest notes, or under -80 dBFS, is dropped regardless). Must be negative (default -48) |
| `--fixed-velocity N` | Give every note velocity N (1-127); the level gate still drops tails and ghosts |
| `--group`, `--channel` | UMP group and MIDI channel the events are emitted on (default 0) |

The options marked "Polyphonic only" are refused without `--polyphonic` (exit 3).

The notes land on a project's tempo map, so an explicit `--tempo-bpm` is
installed as that map rather than handed to the transcriber. `-o` is required.

SoundFont (SF2) and per-destination synth JSON are not wired through these CLI
commands; use the Project API for SoundFont-backed bounces.

Related: [Project Editing](./project-editing.md), [Project Bounce](./project-bounce.md),
[Native Synth](./native-synth.md), [SoundFont Player](./soundfont-player.md).

## Note Editing Workflow

### Per-note editing

`polyphonic-notes` and `polyphonic-render` are a pair: the first prints the notes
a polyphonic analysis found, numbered from 0, and the second re-renders the take
with edits addressed by those numbers. Both run the analysis at its own defaults
and neither takes a framing option, so the index you read from one is the index
the other acts on.

```bash
sonare polyphonic-notes chord.wav --json
sonare polyphonic-render chord.wav -o out.wav \
  --edit 0.pitch_shift_semitones=2 --edit 3.muted=1
```

One `--edit` is one `NOTE.FIELD=VALUE` assignment, and the option repeats. The
fields are `pitch_shift_semitones`, `gain_db`, `time_offset_samples`,
`time_stretch_ratio`, `formant_shift_semitones`, `vibrato_depth_change`,
`drift_change`, and `muted`; an unknown field is rejected rather than ignored.
`polyphonic-render` requires `-o`; `polyphonic-notes` prints to stdout and takes
no output file.

### Scale correction and vocal notes

`pitch-correct-timevarying --mode scale` picks its target for each analysis frame:
the scale note nearest that frame's pitch. A frame within
`--vibrato-threshold-cents` of its target is left as it is, and any other frame
is pulled toward it with a time constant of `--retune-speed-ms`. A note sung near
the midpoint between two scale notes, with vibrato, is therefore pulled toward
both of them, and its vibrato widens instead of settling.

`vocal-notes` reads a take the way a vocal edit session does and writes nothing.
Each note has its start and end (seconds and samples), its center as a MIDI value,
its median frequency, an `f0_stability` score, and the nearest note name with the
offset in cents. The options are the session's analysis settings; an option left
out keeps the library default. With `--json`, each note's entry also carries its
per-frame `amplitude` array, so the output is large for a long take. Lower `--segmentation-threshold-cents` when two
neighboring notes were sung less than 50 cents apart, or the boundary between
them is found late. Editing and rendering a session stay in the bindings; see
[Offline Monophonic Vocal Editing](./vocal-editing.md) and
[Tune a Vocal Take](./use-cases/vocal-tuning.md).

## Splitting Takes at Silence

With more than one take, the intervals become the union of each take's own,
merged where they touch, so a cut falls only where every take is quiet:

```bash
sonare split-silence take1.wav --input take2.wav --input take3.wav
```
```
Non-silent intervals: 3
  23040 - 121344
  147968 - 246272
  282624 - 399872
```

`--write-takes PREFIX` writes every take sliced at every interval as
`PREFIX{take:02d}_{interval:03d}.wav`, both indices 1-based — three takes and
three intervals write nine files:

```bash
sonare split-silence take1.wav --input take2.wav --input take3.wav \
  --write-takes cut_
```
```
Wrote 9 take files with prefix cut_
```

A take that ends earlier than the others is padded rather than shortened, so
one interval's files come out the same length across every take and stay
directly comparable. A take whose sample rate differs from the first is
refused by name instead of resampled:

```
Error: take sample rate differs: t3_44.wav is 44100 Hz, the first take is 48000 Hz
```

## Synthesis

The native CLI can generate simple test signals, and both CLIs can render a MIDI project through the built-in synth:

| Command | Required or notable option |
|---------|----------------------------|
| `sonare tone -o tone.wav` | `--frequency`; optional `--sr` (22050), `--duration` (1.0), `--phase` (0.0), `--amplitude` (1.0) |
| `sonare chirp -o sweep.wav` | `--fmax`; optional `--fmin`, `--exponential`, `--sr` (22050), `--duration` (1.0) |
| `sonare clicks -o clicks.wav` | `--times` comma-separated seconds; optional `--sr` (22050), `--length`, `--frequency` (1000.0), `--click-duration` (0.1) |
| `sonare midi-render --in project.json -o render.wav` | `--in`, `-o`; `--synth PRESET` (omitted, it follows the GM programs), `--sample-rate`, `--frames`, `--block-size`, `--channels` (positive output widths `1`, `2`, `6`, or `8`; default `2`), `--instrument-latency`. Both CLIs: a `project bounce` with the synth always on, so it takes neither `--audio` nor `--resolve-audio` |

`project bounce` and its `midi-render` shorthand support positive output widths
of `1`, `2`, `6`, or `8`. Omit `--channels` or pass `0` or a negative value to
select the default two channels. The requested output width cannot exceed the
scene master's layout, except that mono and stereo masters (and scenes without
a master) allow up to two channels. A `"5.1"` master permits six channels and a
`"7.1"` master permits eight.
