---
title: CLI Examples
description: Shell walkthroughs for the sonare CLI, covering basic analysis, feature summary export, batch processing, mixing, and project and MIDI workflows.
---

# CLI Examples

End-to-end shell walkthroughs for the `sonare` CLI, split out from the [CLI Reference](./cli.md) index, which keeps the mastering walkthrough alongside the global options and exit codes.

### Basic Analysis Workflow

```bash
# Quick BPM and key check
sonare bpm song.mp3
sonare key song.mp3

# All-in-one analysis with JSON output for scripting
sonare analyze song.mp3 --json > analysis.json
```

### Feature Summary Export

```bash
# Export compact feature summaries
sonare mel song.mp3 --json > mel_features.json
sonare spectral song.mp3 --json > spectral_features.json
sonare chroma song.mp3 --json > chroma_features.json
```

### Batch Processing

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

### Mixing Workflow

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

`--scene` and `--preset` are a required, mutually exclusive pair: give exactly
one. Passing both is a usage error, and passing neither exits 2 as well rather
than falling back to a default scene.

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

#### suggest-mix

`suggest-mix` goes the other way: hand it the individual tracks and it proposes a
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
| `--input [ID=]WAV` | — | One per track, repeatable. A stereo file keeps both channels, so the assistant can read its image; more than two are downmixed. Resampled to `--sample-rate`; `ID` defaults to the file's base name |
| `--sample-rate` | 48000 | Shared analysis sample rate |
| `--tempo-bpm BPM\|auto` | — | Tempo the suggested delay times are voiced against. `auto` detects it from the first `--input`; omitted, the transport's fallback tempo is used |
| `--params k=v,...` | — | Assistant parameter overrides |
| `--scene-out FILE` | — | Also write just the suggested scene, in the form `mix --scene` reads |

The full suggestion goes to stdout as JSON; `--scene-out` is what you feed back
into `mix`.

#### The channel strip

The single-input channel strip is a different command with a different job, and
it is called `mix-strip`. Both front-ends carry it and write byte-identical
output across the option space:

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

::: warning `sonare-cli mix` no longer exists
The native CLI has no `mix` command at all: the strip command answers to
`mix-strip` and nothing else, so a script that still calls `sonare-cli mix` fails
as an unknown command rather than as a bad option. Update the command name — the
options carry over unchanged.

The name went because one spelling was naming two different things: the channel
strip here, and the scene mixer on the Python CLI. `sonare mix` on the Python CLI
is still the scene mixer and is unaffected.
:::

Related: [Mixing Engine](./mixing.md).

### Project & MIDI Workflow

The `sonare project` command group runs headless project and Standard MIDI File
(SMF) / MIDI 2.0 workflows from JSON project files. `project bounce --synth`
routes the project's MIDI tracks through the built-in synth instead of clip
audio, and the flag reads two ways:

- **Bare `--synth`** follows the project's General MIDI program changes per
  channel, with channel 10 routed through the GM drum-kit map. This is the
  option to use when the project carries real GM programs.
- **`--synth <preset>`** pins every destination to one fixed NativeSynth preset.
  Run `sonare project synth-presets` to list the names.

`project bounce` writes the channel count you ask for with `--channels`.

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
| `sonare project bounce` | Render a project to a WAV at the requested channel count | `--in`, `--sample-rate`, `--frames`, `--block-size`, `--channels`, `--instrument-latency`, `--synth`, `--audio`, `--resolve-audio`, `-o` |
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
takes the synth path — omit `--synth` there and it follows GM programs. The full
option set is listed in the `sonare project` table earlier in this section.

#### transcribe

`transcribe` is the reverse direction: audio in, a Standard MIDI File out. It is
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
| `--fmin`, `--fmax` | Pitch range the monophonic tracker looks in, in Hz (defaults 65 and 2093) |
| `--min-note-ms` | Shortest span kept as a note, in ms (default 30) |
| `--segmentation-threshold-cents` | Pitch movement that ends one note and starts the next (default 50) |
| `--velocity-floor-db` | Level mapped to velocity 1; must be negative (default -48) |
| `--fixed-velocity N` | Give every note velocity N (1-127) and skip the level measurement |
| `--group`, `--channel` | UMP group and MIDI channel the events are emitted on (default 0) |

The notes land on a project's tempo map, so an explicit `--tempo-bpm` is
installed as that map rather than handed to the transcriber. `-o` is required.

SoundFont (SF2) and per-destination synth JSON are not wired through these CLI
commands; use the Project API for SoundFont-backed bounces.

Related: [Project Editing](./project-editing.md), [Project Bounce](./project-bounce.md),
[Native Synth](./native-synth.md), [SoundFont Player](./soundfont-player.md).

