# CLI Reference

Complete reference for the `sonare` command-line interface.

Use the CLI when you want quick checks, batch jobs, or script-friendly JSON without writing application code. If you are building a UI, start with [WebAssembly Guide](./wasm.md), [Python API](./python-api.md), or [Mixing Engine](./mixing.md) instead.

This page is the index of the CLI reference: the per-command reference is on [CLI Commands](./cli-commands.md), and the shell walkthroughs are on [CLI Examples](./cli-examples.md). For whole jobs carried end to end in the shell — stems to a finished master, a reference match, a delivery gate in CI — see [Use Cases](./use-cases.md).

## What You Will Learn

By the end of this page you should be able to:

- install the PyPI `sonare` command and understand how it differs from the native CLI;
- choose the right command for quick analysis, feature summaries, editing, mastering, acoustic checks, or simple mixing;
- decide when to use human-readable output and when to use `--json` for scripts;
- recognize which workflows should move from CLI commands to Python, WASM, or native APIs.

## First Commands To Try

| Goal | Command |
|------|---------|
| Show the main summary | [`sonare analyze music.mp3`](./cli-commands.md#analyze) |
| Get only tempo | [`sonare bpm music.mp3`](./cli-commands.md#bpm) |
| Get only key | [`sonare key music.mp3`](./cli-commands.md#key) |
| Produce script-friendly output | [`sonare analyze music.mp3 --json`](./cli-commands.md#analyze) |

These four commands work from the pip-installed CLI. Later sections mark commands that need the native CLI — if a command turns up missing, check that label before assuming you typed it wrong.

::: info What is a CLI?
CLI means Command Line Interface: a tool you run from a terminal. It is good for quick checks before integration, batch processing many files, and piping JSON into another script. If you are building a visual UI or live audio path, a WASM, Python, or C++ API is usually the better entry point.
:::

## Which CLI Are You Using?

There are two command-line entry points:

| CLI | Command name | How you get it | Best for |
|-----|--------------|----------------|----------|
| Python CLI | `sonare` | `pip install libsonare` | Most users: batch analysis, feature summaries, editing, mastering, simple mixing |
| Native CLI | `sonare-cli` | Release archive, or build from source with `BUILD_CLI=ON` | Lower-level utilities, synthesis, librosa-parity helpers, extra scene/export commands |

The native executable ships as `sonare-cli` in the FFmpeg-free Linux and macOS
release archives (each with a SHA-256 checksum), so it installs alongside the
Python `sonare` command instead of colliding with it. This page writes `sonare`
in examples; substitute `sonare-cli` when running a native-only command.

Corresponding commands in both CLIs use the same `snake_case` keys and payload
shapes, so a script can read either one. Do not depend on byte-identical output:
each frontend serializes independently. JSON values retain native precision;
some focused human-readable summaries may still round.

Unless this page explicitly says "native CLI", assume the command is available
from the PyPI Python CLI.

::: tip Install via pip
The `sonare` CLI is installed from PyPI with the Python package:
```bash
pip install libsonare
sonare analyze music.mp3
```
It is not installed by the npm WebAssembly package `@libraz/libsonare`.

The default PyPI wheels decode WAV and MP3. Rebuild with FFmpeg enabled for
direct M4A/AAC/FLAC/OGG/Opus decoding.
:::

::: info Which commands each CLI carries
Most commands are on both CLIs and take the same options. `sonare-cli` adds the
low-level utilities and signal generators the PyPI package does not carry; the
Python CLI adds the scene mixer and the preset-driven mastering commands. Get the
native binary from a release archive, or see
[Building from Source](/docs/installation#building-from-source).

**Native CLI only**

- Analysis: `melody`, `boundaries`, `meter`, `clipping`, `dynamic-range`, `stereo`, `phase`
- Effects / transforms: `preemphasis`, `deemphasis`, `gain`, `fade`, `filter`
- Synthesis: `tone`, `chirp`, `clicks`
- Features: `cqt`, `vqt`, `mel-to-audio`, `mfcc-to-audio`, `tonnetz`, `pcen`, `onset-env` (onset-envelope summary: peak time, peak strength, mean), `fourier-tempogram`, `tempogram-ratio`
- Low-level helpers: the fourteen numeric, frame, and conversion utilities the native CLI carries for librosa parity — frame/sample conversion, the four decibel conversions, framing and padding, peak picking, `tune-to-midi`, and `system-info` — have their own page, [CLI Utilities](./cli-utilities.md). Most of them take numbers or value sequences rather than an audio file, which is why they are grouped apart from the commands above; `tune-to-midi` and `system-info` are the exceptions
- Mastering: `mastering-stereo-analyses`

**Python CLI only**

`master`, `mastering-chain`, `declip`, and `mix` — the scene mixer described under
[Mixing Workflow](./cli-examples.md#mixing-workflow).

`sections` is on both, with a different option set: the native one adds
`--threshold` alongside the shared `--min-duration`.
:::

## Overview

The `sonare` CLI is for terminal workflows: quick BPM/key checks, batch
analysis, and JSON summaries for scripts. The heavy analysis runs in native C++
through the Python package, avoiding Python implementations of the DSP pipeline.

```bash
sonare <command> [options] <audio_file>
```

## Global Options

| Option | Description |
|--------|-------------|
| `--json` | Output results in JSON format |
| `--help`, `-h` | Show help for command |
| `-o`, `--output` | Output WAV path. Editing, mastering, `eq`, and `mix` commands write a WAV here; analysis/feature commands print to stdout and reject this option |
| `--n-fft <int>` | FFT size (default: 2048) |
| `--hop-length <int>` | Hop length (default: 512) |
| `--n-mels <int>` | Number of Mel bands (default: 128) |
| `--quiet`, `-q` | Native CLI only. Suppress progress output |

`sonare <command> --help` lists only the options that command actually accepts,
so the help is the authority for any one command. The DSP options above
(`--n-fft`, `--hop-length`, `--n-mels`) are accepted only by the commands that
consume them: passing one to a command that ignores it is a usage error (exit
code 2), rather than being silently dropped.

Colour is configured once at startup, so `NO_COLOR` in the environment — or
sending stdout to a file or pipe instead of a terminal — disables ANSI escapes
for the whole run.

`--json` outputs compact, script-friendly summaries. Feature commands such as
`mel` and `chroma` do not dump full matrix data from the Python CLI; they print
dimensions and summary values.

## Utility Commands

### info

Display audio file information.

```bash
sonare info music.mp3
sonare info music.wav --json
```

**Output:**
```
  Duration:    3:00 (180.5s)
  Sample Rate: 22050 Hz
  Samples:     3980000
```

### version

Display version information.

```bash
sonare version
sonare version --json
```

**Output:**
```
libsonare {{ wasmMeta.version }} (Python CLI)
```

### doctor

Report what this build can actually do — the first command to run when a feature
seems missing or a file will not decode. Both CLIs have it, and it prints the
same build-diagnostics report the bindings expose as `capabilities`.

```bash
sonare doctor
sonare doctor --json
```

**Output:**
```
libsonare {{ wasmMeta.version }}
  Library:              /path/to/libsonare.so
  Platform:             linux-x86_64
  ABI:                  project=…, engine=…
  Features:             mastering=true, mixing=true, fx=true, ffmpeg=false
  Decode (built-in):    wav, mp3
  Decode (FFmpeg):      none
  SIMD:                 …
  Hardware concurrency: 8
```

An `ffmpeg=false` build explains an M4A/AAC/FLAC/OGG decode failure, and
`mastering`/`mixing`/`fx` tell you which command groups were compiled in.

## Examples

The mastering walkthrough stays on this page; the basic analysis, feature summary export, batch processing, mixing, and project/MIDI walkthroughs are on [CLI Examples](./cli-examples.md).

### Mastering Workflow

::: info Command availability
Nearly every mastering command is on both CLIs, including `mastering`, `eq`,
`repair`, the processor and pair-analysis families, `mastering-pair-processor`,
`mastering-stereo-analyze`, and the three assistant commands. `master`,
`mastering-chain`, and `declip` are Python CLI only; `mastering-stereo-analyses`
is native only. See [Building from Source](/docs/installation#building-from-source).
:::

```bash
# Loudness-normalize to a target with a true-peak ceiling, write a WAV
sonare mastering track.wav --target-lufs -14 --ceiling-db -1 -o master.wav

# Inspect processors compiled into this libsonare build
sonare mastering-processors

# Run a named mastering processor and write a mastered WAV
sonare mastering-processor track.wav \
  --processor spectral.airBand \
  --params amount=0.4,shelfFrequencyHz=14000 \
  -o libsonare-master.wav

# Apply the unified equalizer (one band per call, or --params for several)
sonare eq track.wav --type 2 --frequency-hz 12000 --gain-db 2.5 --q 0.7 -o eq.wav

# Apply a named mastering preset (default preset: pop)
sonare master track.wav --preset pop -o mastered.wav

# Run a configurable mastering chain from a JSON config
sonare mastering-chain track.wav --config-file chain.json -o chained.wav

# List the available mastering preset names
sonare mastering-presets

# Repair clipped audio via LPC reconstruction
sonare declip clipped.wav -o fixed.wav

# Reference-based loudness / tonal analysis
sonare mastering-pair-analyses
sonare mastering-pair-analyze track.wav \
  --reference reference.wav \
  --analysis match.referenceLoudness \
  --json > mastering-report.json
```

For pair analysis, the reference must already be at the source's sample rate: a
mismatch is an error rather than a quiet resample, so a comparison never runs
against silently rewritten audio. Resample the reference first (`sonare resample
reference.wav --target-sr <sr> -o reference-matched.wav`), or use the Python API
when you need finer control over resampling or trimming before comparison.

The `/mastering` browser demo uses the same mastering processor families. Use the exported report from the demo as a starting point for CLI automation.

Named mastering commands:

| Purpose | Command | Available on |
|---------|---------|--------------|
| Loudness-normalize with a true-peak ceiling | `sonare mastering` | both |
| Apply the unified equalizer | `sonare eq` | both |
| Measure and repair defects | `sonare repair` | both |
| List mono/stereo processors | `sonare mastering-processors` | both |
| Apply a named processor | `sonare mastering-processor` | both |
| List pair processors | `sonare mastering-pair-processors` | both |
| Apply a named pair processor | `sonare mastering-pair-processor` | both |
| List pair analyses | `sonare mastering-pair-analyses` | both |
| Analyze a source/reference pair | `sonare mastering-pair-analyze` | both |
| Analyze a stereo pair | `sonare mastering-stereo-analyze` | both |
| List mastering preset names | `sonare mastering-presets` | both |
| Audio profile analysis (prints JSON) | `sonare mastering-profile` | both |
| Chain suggestion from assistant (prints JSON) | `sonare mastering-suggest` | both |
| Streaming-platform normalization preview (prints JSON) | `sonare mastering-streaming` | both |
| Apply a named mastering preset | `sonare master` | Python |
| Run a configurable mastering chain | `sonare mastering-chain` | Python |
| Repair clipped audio (reconstruction by linear predictive coding, LPC) | `sonare declip` | Python |
| List stereo analyses | `sonare mastering-stereo-analyses` | native |

The three assistant commands each take an audio file and print a JSON object to stdout:

| Command | Key options | Output |
|---------|------------|--------|
| `sonare mastering-profile track.wav` | `--params key=val,...` | Audio profile JSON (loudness, dynamics, spectral character) |
| `sonare mastering-suggest track.wav` | `--params key=val,...` | Suggested mastering chain as JSON |
| `sonare mastering-streaming track.wav` | `--platforms '[...]'`, `--platforms-file f.json` | Per-platform normalization preview as JSON |

`--platforms` accepts a JSON array of `{name, targetLufs, ceilingDb}` objects. `--params` accepts comma-separated `key=value` float pairs passed to the underlying assistant call.

The preset, chain, and repair commands take an audio file and write a WAV with `-o`, except `mastering-presets`, which only lists names:

| Command | Key options | Notes |
|---------|------------|-------|
| `sonare master track.wav -o out.wav` | `--preset NAME` (default `pop`), `--config '{...}'`, `--config-file f.json`, `--params k=v,...`, `--report FILE` | Applies a named mastering preset; `--config`/`--config-file`/`--params` override preset values; `--report` writes a mastering report JSON file |
| `sonare mastering-chain track.wav -o out.wav` | `--config '{...}'`, `--config-file f.json`, `--params k=v,...`, `--report FILE` | Runs a configurable mastering chain from JSON config |
| `sonare mastering-presets` | honors the global `--json` flag | Lists the available mastering preset names |
| `sonare declip clipped.wav -o out.wav` | `--clip-threshold` (0.98), `--lpc-order` (36), `--iterations` (2), `--lpc-blend` (0.65) | Repairs clipped audio via LPC reconstruction |

#### repair

`declip` fixes one defect. `repair` measures the take and runs the defect-repair
stages it needs — declip, declick, decrackle, dehum, denoise, dereverb, in that
order — so it is the command to reach for when you do not already know what is
wrong with the recording.

```bash
# Measure and report only; writes nothing
sonare repair noisy.wav --detect --json

# Measure, choose the stages, repair, and say why each was chosen
sonare repair noisy.wav -o clean.wav --explain

# Take the repair settings from a named preset instead of letting it choose
sonare repair noisy.wav --preset broadcast -o clean.wav
```

| Option | Description |
|--------|-------------|
| `--detect` | Measure and report only. No processing runs, and `-o` is not required |
| `--preset NAME` | Take the repair stages from a named preset (`sonare mastering-presets` lists them) instead of the measure-and-choose path |
| `--params` | Stage overrides as `repair.<stage>.<field>=value,...` |
| `--explain` | Report why each stage was chosen |
| `--bits` | Output bit depth, 16 or 24 |

`-o` is required unless `--detect` is given. `--explain` only describes a
decision that actually ran, so combining it with `--preset` or `--detect` is
rejected as an invalid parameter.

`repair` runs no limiter on purpose, and declipping rebuilds the peaks a clipper
cut off, so the result routinely exceeds full scale. The whole file is fitted
with a single gain rather than clamped sample by sample — clamping would pin the
very samples the repair had just rescued back onto the ceiling they came from.
The gain applied is reported as `output_gain_db`, always present and `0` when the
peak already fit.

Related mastering guides: [Delivery targets](./glossary/mastering/delivery-targets.md), [Meter reading](./glossary/mastering/meter-reading.md), [Error recovery](./glossary/mastering/error-recovery.md).

Room-acoustic fields such as RT60, EDT, C50, C80, D50, volume, dimensions, absorption bands, DRR, generated RIR error state, and confidence are explained in [Room Acoustics](./acoustic-analysis.md).

## Stereo and Mono Handling

Most CLI commands are mono by nature: the analysis they run, or the metering they
report, is defined on one channel. Both front-ends decode a multi-channel input
down to mono for those, and both print the same warning on stderr when they do,
so a stereo file never loses its channels silently.

The commands that would deliver a worse result for it keep the pair instead:

| Command | Stereo input |
|---------|--------------|
| `mastering` | Mastered as a pair; the stereo image is preserved end to end |
| `mastering-processor` | A two-channel input is processed as a pair, and the result is written as a stereo file. A processor with no mono form (`stereo.imager`, `eq.midSide`, the `multiband.*` family) takes the stereo path from any input: a mono file is fed to both channels, and the output is stereo |
| `mix` (Python), `mix-strip` | Processed as a pair. A mono file is carried on both sides; a stereo one keeps its own two channels |
| `suggest-mix` | Each `--input` keeps a stereo file as a pair instead of folding it, since the image analysis is the one part of the assistant that measures both channels |
| `normalize` | Kept as a pair. One gain is measured across both channels and applied to both: in `--mode peak` the louder channel lands on `--target-db` and the other keeps its level relative to it, and `--mode rms` measures the pair the same way. Normalizing each channel on its own would lift the quieter side until the two matched, which is a balance change, not a level change |
| `master`, `mastering-chain`, `declip` (Python CLI) | Kept as a pair; one gain is measured across both channels so the image does not collapse toward the centre |
| Everything else | Downmixed to mono, with a warning |

There is no option that selects the stereo path: the file's own channel count and the processor's own mono/stereo form decide it. `mastering-processor` refuses a `--stereo` flag as an unknown option (exit code 2) on both CLIs — drop the flag; a two-channel file already goes the way that flag used to request. The JSON report says which path ran through its `stereo` field, and `normalize --json` reports `length` per channel.

A source with more than two channels is always downmixed, because the offline
operations come in a mono and a stereo form and nothing wider. Keeping channel 0
of a surround file and calling it the record would be worse than saying so.

When you need channel-preserving processing that the CLI does not offer, use the
stereo entry points in the [Python API](./python-api.md) or
[JavaScript API](./js-api.md).

## Supported Audio Formats

| Format | Extension | Notes |
|--------|-----------|-------|
| WAV | `.wav` | Uncompressed PCM |
| MP3 | `.mp3` | Decoded using minimp3 |
| M4A / AAC / FLAC / OGG / Opus | varies | Supported only when libsonare is built with FFmpeg |

Check the active build from Python with `libsonare.has_ffmpeg_support()`.

## Exit Codes

Both the Python and native CLIs use the following process-exit mapping, aligned
with the C ABI error classes:

| Code | Description |
|------|-------------|
| 0 | Success |
| 2 | Usage error (bad arguments) |
| 3 | Invalid parameter |
| 4 | File not found |
| 5 | Invalid format |
| 6 | Decode failed |
| 7 | Out of memory |
| 8 | Not supported |
| 9 | Invalid state |
| 10 | Other error |
| 11 | Cancelled |
| 12 | Encode failed |

Usage/parse errors use exit code 2; semantic invalid parameters use 3, and a
cancelled run uses 11. Exit 12 covers every stage of producing an output file, so
the commonest cause is a `-o` path that cannot be written — most often one that
resolves to a directory. Set `SONARE_LEGACY_EXIT=1` for either CLI to fold every
failure back to exit `1` for scripts that hardcode the old all-failures-are-1
contract.

Two details worth knowing before you branch on a specific code:

- **Treat 5 and 6 as one category.** For an input that will not decode, which of
  the two you get depends on whether the build has FFmpeg, not on the file: a
  build without it reports 5 where an FFmpeg build reports 6. A malformed
  project or preset document is always 5.
- **A Python-side usage mistake can surface as 3, not 2.** Exit 2 is argparse's,
  so it covers what the parser rejects. A mistake the handler catches — `mix
  --output` with no `--input`, an `--init` the factorization does not know —
  raises a plain `ValueError` and exits 3, even though what you got wrong was the
  command line. Run `sonare doctor` if you are not sure whether the command is
  even compiled into the build in front of you.

## Performance Tips

1. **Large files**: For files over 10 minutes, consider analyzing segments:
   ```bash
   # Analyze only first 60 seconds (using ffmpeg)
   ffmpeg -i long_song.mp3 -t 60 sample.wav
   sonare analyze sample.wav
   ```

2. **FFT size**: A smaller FFT size (`--n-fft 1024`) is faster but gives less frequency resolution.

3. **Hop length**: A larger hop length (`--hop-length 1024`) is faster but gives less time resolution.

## Where the sections went

| Section | Now on |
|---------|--------|
| Analysis Commands | [CLI Commands](./cli-commands.md#analysis-commands) |
| Feature Commands | [CLI Commands](./cli-commands.md#feature-commands) |
| More Commands | [CLI Commands](./cli-commands.md#more-commands) |
| Basic Analysis Workflow | [CLI Examples](./cli-examples.md#basic-analysis-workflow) |
| Feature Summary Export | [CLI Examples](./cli-examples.md#feature-summary-export) |
| Batch Processing | [CLI Examples](./cli-examples.md#batch-processing) |
| Mixing Workflow | [CLI Examples](./cli-examples.md#mixing-workflow) |
| Project & MIDI Workflow | [CLI Examples](./cli-examples.md#project-midi-workflow) |
