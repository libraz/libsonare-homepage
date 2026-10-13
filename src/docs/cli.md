# CLI Reference

Complete reference for the `sonare` command-line interface.

Use the CLI when you want quick checks, batch jobs, or script-friendly JSON without writing application code. If you are building a UI, start with [WebAssembly Guide](./wasm.md), [Python API](./python-api.md), or [Mixing Engine](./mixing.md) instead.

This page is the index of the CLI reference: which CLI carries which command, the global options, exit codes and format notes. The per-command reference is on [CLI Commands](./cli-commands.md), the mastering and repair commands are on this page, and the shell walkthroughs are on [CLI Examples](./cli-examples.md). For whole jobs carried end to end in the shell — stems to a finished master, a reference match, a delivery gate in CI — see [Use Cases](./use-cases.md).

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
| Native CLI | `sonare-cli` | Release archive, or build from source with `BUILD_CLI=ON` | Lower-level utilities, synthesis, librosa-parity helpers, signal generators |

The native executable ships as `sonare-cli` in the FFmpeg-free Linux and macOS
release archives (each with a SHA-256 checksum), so it installs alongside the
Python `sonare` command instead of colliding with it. This page writes `sonare`
in examples; substitute `sonare-cli` when running a native-only command.

Corresponding commands in both CLIs use the same `snake_case` keys and payload
shapes, so a script can read either one. Do not depend on byte-identical output:
each front-end serializes independently. JSON values retain native precision;
some focused human-readable summaries may still round. The `--json` payloads
match across the two CLIs; the plain-text layouts do not (the native CLI prefixes
result lines with `> ` and prints `Saved:` where the Python CLI prints `Wrote:`),
and the samples in these pages show the Python CLI.

Unless a page explicitly says "native CLI", assume the command is available
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

## Command Availability

Most commands are on both CLIs and take the same options. `sonare-cli` adds the low-level utilities and signal generators the PyPI package does not carry; the Python CLI adds the scene mixer and the preset-driven mastering commands. Get the native binary from a release archive, or see [Building from Source](/docs/installation#building-from-source).

| Family | Both CLIs | Native CLI only | Python CLI only |
|--------|-----------|-----------------|-----------------|
| Analysis | `analyze`, `bpm`, `key`, `beats`, `downbeats`, `onsets`, `sections`, `chords`, `rhythm`, `dynamics`, `timbre`, `lufs` | `melody`, `boundaries`, `meter`, `clipping`, `dynamic-range`, `stereo`, `phase` | — |
| Features | `mel`, `chroma`, `spectral`, `pitch`, `onset-envelope`, `tempogram`, `plp`, `nnls-chroma` | `cqt`, `vqt`, `tonnetz`, `pcen`, `onset-env`, `fourier-tempogram`, `tempogram-ratio`, `mel-to-audio`, `mfcc-to-audio` | — |
| Separation | `hpss`, `decompose-stems` | — | — |
| Notes and transcription | `transcribe`, `polyphonic-notes`, `polyphonic-render`, `vocal-notes`, `tune-to-midi` | — | — |
| Editing | `pitch-correct`, `pitch-correct-timevarying`, `note-move`, `note-stretch`, `scale-quantize`, `voice-change`, `pitch-shift`, `time-stretch`, `normalize`, `trim-silence`, `split-silence`, `resample` | `gain`, `fade`, `filter`, `preemphasis`, `deemphasis` | — |
| Voice presets | `voice-presets`, `voice-preset`, `voice-preset-validate` | — | — |
| Room acoustics | `acoustic`, `estimate-room`, `synthesize-rir`, `room-morph` | — | — |
| Mastering and repair | `mastering`, `eq`, `repair`, `mastering-presets`, `mastering-profile`, `mastering-suggest`, `mastering-streaming`, `mastering-processors`, `mastering-processor`, `mastering-pair-processors`, `mastering-pair-processor`, `mastering-pair-analyses`, `mastering-pair-analyze`, `mastering-stereo-analyze` | `mastering-stereo-analyses` | `master`, `mastering-chain`, `declip` |
| Mixing | `mixing-presets`, `mixing-preset`, `suggest-mix`, `mix-strip` | — | `mix` (the scene mixer; see [Mixing Workflow](./cli-examples.md#mixing-workflow)) |
| Project and MIDI | `project` (`abi`, `new`, `validate`, `compile`, `synth-presets`, `bounce`, `export-smf`, `import-smf`, `export-midi2`, `import-midi2`, `align-takes`), `midi-render` | — | — |
| Playback | `playback` | — | — |
| Synthesis | — | `tone`, `chirp`, `clicks` | — |
| Numeric helpers ([CLI Utilities](./cli-utilities.md)) | — | `frames-to-samples`, `samples-to-frames`, `power-to-db`, `amplitude-to-db`, `db-to-power`, `db-to-amplitude`, `frame-signal`, `pad-center`, `fix-length`, `fix-frames`, `peak-pick`, `vector-normalize`, `system-info` | — |
| Utility | `info`, `version`, `doctor` | — | — |

`sections` is on both with a different option set: the native one adds `--threshold` beside the shared `--min-duration`.

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

Color is configured once at startup, so `NO_COLOR` in the environment — or
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
sonare --version
```

**Output:**
```
libsonare {{ wasmMeta.version }} (Python CLI)
```

### doctor

Report what this build can actually do — the first command to run when a feature
seems missing or a file will not decode. Both CLIs have it, and it prints the
build-diagnostics report the bindings expose as `capabilities`. The `--json`
fields match across the two CLIs; the native text layout differs (it starts with
`libsonare Doctor` and prints `Version:` and `ABI: project 2, engine 3`), and the
sample below is the Python CLI's.

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

## Mastering and Repair

Everything that writes a finished master or fixes a damaged take. Both CLIs carry the commands below unless a row says Python or native only; the availability table above has the full list. The options are listed per command below.

| I want to... | Command |
|--------------|---------|
| Reach a loudness target under a true-peak ceiling | `sonare mastering` |
| Use a named preset | `sonare mastering --preset NAME` (the Python CLI also has `master`) |
| Let the assistant pick the chain from the audio | `sonare mastering --assistant`, or [`mastering-suggest`](#assistant-commands) to see the chain first |
| Run my own chain | `sonare mastering --chain-config chain.json` (the Python CLI also has `mastering-chain`) |
| Shape the tone with one equalizer | `sonare eq` |
| Fix clipping, clicks, hum or noise | `sonare repair`, or `declip` for clipping alone (Python CLI) |
| Run one named processor | `sonare mastering-processor` |
| Compare a track with a reference | `sonare mastering-pair-analyze`, `mastering-pair-processor` |
| Preview platform normalization | `sonare mastering-streaming` |
| Check the mono compatibility of a stereo file | `sonare mastering-stereo-analyze` (list the analyses with `sonare mastering-stereo-analyses`, native CLI only) |
| List the processors that take a reference | `sonare mastering-pair-processors` |

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

# Apply the unified equalizer: one high-shelf band (--type 2)
sonare eq track.wav --type 2 --frequency-hz 12000 --gain-db 2.5 --q 0.7 -o eq.wav

# Apply a named mastering preset (the default preset is pop)
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

`master`, `mastering-chain` and `declip` are Python CLI only, and `mastering-stereo-analyses` is native only. `mastering-pair-analyze` and `mastering-pair-processor` read the reference at its own sample rate and resample it onto the source's; equal rates are processed exactly as they would be without the step. `mastering-stereo-analyze` is the exception: both files must already be at the input's rate, and a mismatch is an error. Use the Python API when you need finer control over resampling or trimming before comparison.

The `/mastering` browser demo uses the same mastering processor families. Use the exported report from the demo as a starting point for CLI automation.

### mastering

`mastering` normalizes loudness under a true-peak ceiling. Pick at most one way of choosing the chain: nothing (loudness normalization only), `--preset`, `--chain-config`, or `--assistant`.

| Option | Default | Description |
|--------|---------|-------------|
| `--target-lufs` | -14 | Integrated loudness target |
| `--ceiling-db` | -1 | True-peak ceiling in dBTP |
| `--true-peak-oversample` | 4 | Oversampling for the true-peak limiter: 1, 2, 4, 8 or 16 |
| `--bits` | 16 | Output bit depth, 16 or 24 |
| `--preset NAME` | — | Start from a named preset (`mastering-presets` lists them) |
| `--chain-config FILE` (alias `--config`) | — | Run a complete chain document. Cannot be combined with `--preset` or `--assistant` |
| `--params k=v,...` | — | Overrides on top of the chosen preset, document or suggestion; needs one of the three |
| `--assistant` | off | Master with the chain the [mastering assistant](./mastering-assistant.md) suggests; `--preset` names its base |
| `--target-platform` | `streaming` | With `--assistant`: `streaming`, `youtube`, `broadcast`, `podcast`, `audiobook`, `cinema`, `club` or `cd` |
| `--enable-repair` | off | With `--assistant`: let the suggestion enable measured repair stages |
| `--no-streaming-safe` | off | With `--assistant`: do not prefer the streaming-safe denoise estimator |
| `--speech-mono-amount` | 1 | With `--assistant`: how much the speech preset collapses side energy at low frequencies, 0 to 1 |
| `--explain` | off | With `--assistant`: report why each stage was chosen |
| `--report FILE` | — | Write a mastering report JSON file |

`--target-lufs`, `--ceiling-db` and `--true-peak-oversample` set the loudness stage on their own, so combining them with `--preset` or `--chain-config` is refused; use `--params` to override a preset or document. The five assistant options are refused without `--assistant`.

### eq

`eq` applies the unified equalizer. One call sets one band from `--type`, `--frequency-hz`, `--gain-db` and `--q`; pass `--params` for several bands. `--placement` and `--output-pan` act on the file's own channels, and a two-channel file is processed as a pair. `sonare eq --help` lists the dynamic, sidechain and phase options. The all-pass band (`--type 9`) changes phase only; linear-phase mode refuses it by name.

| `--type` | Band | `--type` | Band |
|----------|------|----------|------|
| 0 | peak | 5 | band-pass |
| 1 | low shelf | 6 | notch |
| 2 | high shelf | 7 | tilt shelf |
| 3 | low-pass | 8 | flat tilt |
| 4 | high-pass | 9 | all-pass |

### Assistant commands

The three assistant commands each take an audio file and print a JSON object to stdout. The result fields are described on [Mastering Assistant API](./mastering-assistant.md).

| Command | Key options | Output |
|---------|-------------|--------|
| `sonare mastering-profile track.wav` | `--params key=val,...` | Audio profile JSON (loudness, dynamics, spectral character) |
| `sonare mastering-suggest track.wav` | `--preset`, `--target-lufs`, `--ceiling-db`, `--target-platform`, `--enable-repair`, `--no-streaming-safe`, `--speech-mono-amount` (the same meanings as on `mastering --assistant`), `--params key=val,...`, `--config-out FILE` | Suggested mastering chain as JSON |
| `sonare mastering-streaming track.wav` | `--platforms '[...]'`, `--platforms-file f.json` | Per-platform normalization preview as JSON |

`mastering-suggest --config-out chain.json` also writes the suggested chain as a complete document. Edit it, then run it with `sonare mastering track.wav --chain-config chain.json -o out.wav` (or `master --chain-config` on the Python CLI). A setting given both as an option and in `--params` is refused. `--platforms` accepts a JSON array of `{name, targetLufs, ceilingDb}` objects. `--params` on `mastering-profile` takes comma-separated `key=value` float pairs for the underlying call.

### Preset, chain and declip commands

These take an audio file and write a WAV with `-o`, except `mastering-presets`, which only lists names.

| Command | Key options | Notes |
|---------|-------------|-------|
| `sonare master track.wav -o out.wav` (Python) | `--preset NAME` (default `pop`), `--config '{...}'`, `--config-file f.json`, `--chain-config f.json`, `--assistant`, `--params k=v,...`, `--report FILE` | Applies a named mastering preset; `--config`/`--config-file`/`--params` override preset values; `--chain-config` replaces the preset with a complete chain document; `--assistant` masters with the suggested chain; `--report` writes a mastering report JSON file |
| `sonare mastering-chain track.wav -o out.wav` (Python) | `--config '{...}'`, `--config-file f.json`, `--params k=v,...`, `--report FILE` | Runs a configurable mastering chain from a JSON config |
| `sonare mastering-presets` | honors the global `--json` flag | Lists the available mastering preset names |
| `sonare declip clipped.wav -o out.wav` (Python) | `--clip-threshold` (0.98), `--lpc-order` (36), `--iterations` (2), `--lpc-blend` (0.65) | Repairs clipped audio via LPC reconstruction |

On every CLI, a `--chain-config` (or `--config`) document and `--params` form one parameter list. Two spellings of one field across the document and `--params` are refused with both keys named, and a document's `<stage>.enabled: false` keeps the stage off when `--params` sets one of its fields. A multiband stage with one band is refused (`multiband stage needs at least two bands; one band is the compressor stage`); the band count is 2 to 64.

Enum-valued parameters accept their choice name beside the number:

| Key | Accepted names |
|-----|----------------|
| `repair.denoise.mode` | `logMmse`, `mmseStsa`, `spectralSubtraction` |
| `repair.denoise.noiseEstimator` | `mcra`, `imcra`, `spp` |
| `repair.dehum.mode` | `subtract`, `notch` |
| `repair.decrackle.mode` | `median`, `waveletShrinkage` |

`repair.decrackle.mode` refuses any other number than 0 (`median`) or 1 (`waveletShrinkage`), and a partial name such as `wavelet` is refused with the valid names.

### repair

`declip` fixes one defect. [`repair`](./audio-repair.md) measures the take and runs the defect-repair
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
| `--detect` | Measure and report only. No processing runs and no file is written. Both CLIs refuse `-o`; the Python CLI also refuses `--preset`, `--params` and `--bits` with it |
| `--preset NAME` | Take the repair stages from a named preset (`sonare mastering-presets` lists them) instead of the measure-and-choose path |
| `--params` | Stage overrides as `repair.<stage>.<field>=value,...` |
| `--explain` | Report why each stage was chosen |
| `--bits` | Output bit depth, 16 or 24 |

`-o` is required unless `--detect` is given, and `--detect` with `-o` is refused. `--explain` only describes a
decision that actually ran, so combining it with `--preset` or `--detect` is
rejected as an invalid parameter (exit 3). A file too short for the detectors
reports `"defects": {"measured": false}` and nothing else.

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
| `eq`, `room-morph` | A two-channel input is processed as a pair and written as a stereo file; `--placement` and `--output-pan` on `eq` act on the file's own channels. `room-morph` hears the target room at two receivers spaced `--receiver-spacing` metres apart (default 0.5, range above 0 up to 4). The JSON report carries `stereo` |
| `mastering-processor` | A two-channel input is processed as a pair, and the result is written as a stereo file. A processor with no mono form (`stereo.imager`, `eq.midSide`, the `multiband.*` family) takes the stereo path from any input: a mono file is fed to both channels, and the output is stereo |
| `mix` (Python), `mix-strip` | Processed as a pair. A mono file is carried on both sides; a stereo one keeps its own two channels |
| `suggest-mix` | Each `--input` keeps a stereo file as a pair instead of folding it, since the image analysis is the one part of the assistant that measures both channels. Each file is read at its own sample rate |
| `normalize` | Kept as a pair. One gain is measured across both channels and applied to both: in `--mode peak` the louder channel lands on `--target-db` and the other keeps its level relative to it, and `--mode rms` measures the pair the same way. Normalizing each channel on its own would lift the quieter side until the two matched, which is a balance change, not a level change |
| `playback` | Keeps its channels, including 5.1 and 7.1 input; the only command that does |
| `master`, `mastering-chain`, `declip` (Python CLI) | Kept as a pair; one gain is measured across both channels so the image does not collapse toward the centre |
| Everything else | Downmixed to mono, with a warning |

There is no option that selects the stereo path: the file's own channel count and the processor's own mono/stereo form decide it. `mastering-processor` refuses a `--stereo` flag as an unknown option (exit code 2) on both CLIs — drop the flag; a two-channel file takes the stereo path on its own. The JSON report says which path ran through its `stereo` field, and `normalize --json` reports `length` per channel.

Apart from `playback`, a source with more than two channels is always downmixed, because the offline
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
with the C ABI error classes. The [error contract](./binding-parity.md#error-contract)
shows the same failures as each library binding reports them.

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
| 11 | Canceled |
| 12 | Encode failed |
| 13 | ABI mismatch (Python CLI only) |

Usage/parse errors use exit code 2; semantic invalid parameters use 3, and a
canceled run uses 11. Exit 13 exists only in the Python CLI: the pip package loads its native library at run time, and a library whose ABI version differs from the one the package was built against is refused before any work starts. The native CLI links its library statically and cannot skew. [Installation](./installation.md#abimismatch-when-loading-the-library) covers the fix for 13. Exit 12 covers every stage of producing an output file, so
the commonest cause is a `-o` path that cannot be written — most often one that
resolves to a directory. Set `SONARE_LEGACY_EXIT=1` for either CLI to fold every
failure back to exit `1` for scripts that hardcode the old all-failures-are-1
contract.

Two details worth knowing before you branch on a specific code:

- **Treat 5 and 6 as one category.** For an input that will not decode, which of
  the two you get depends on whether the build has FFmpeg, not on the file: a
  build without it reports 5 where an FFmpeg build reports 6. A malformed
  project or preset document is always 5 on both CLIs, and so is a project
  whose `sample_rate` is not a whole number of hertz (`project bounce` does not
  round it).
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

## Where to go next

| Page | What it holds |
|------|---------------|
| [CLI Commands](./cli-commands.md) | Every analysis, feature, editing, room and synthesis command with its options and output |
| [CLI Examples](./cli-examples.md) | Shell walkthroughs: analysis, batch, mixing, projects and MIDI |
| [CLI Utilities](./cli-utilities.md) | The numeric helpers, `tune-to-midi` and `system-info` |
| [Use Cases](./use-cases.md) | Whole jobs in the shell, from stems to a finished master |
