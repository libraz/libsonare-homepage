# CLI Reference

Complete reference for the `sonare` command-line interface.

Use the CLI when you want quick checks, batch jobs, or script-friendly JSON without writing application code. If you are building a UI, start with [WebAssembly Guide](./wasm.md), [Python API](./python-api.md), or [Mixing Engine](./mixing.md) instead.

## What You Will Learn

By the end of this page you should be able to:

- install the PyPI `sonare` command and understand how it differs from the native CLI;
- choose the right command for quick analysis, feature summaries, editing, mastering, acoustic checks, or simple mixing;
- decide when to use human-readable output and when to use `--json` for scripts;
- recognize which workflows should move from CLI commands to Python, WASM, or native APIs.

## First Commands To Try

| Goal | Command |
|------|---------|
| Show the main summary | `sonare analyze music.mp3` |
| Get only tempo | `sonare bpm music.mp3` |
| Get only key | `sonare key music.mp3` |
| Produce script-friendly output | `sonare analyze music.mp3 --json` |

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

::: info The native CLI carries extra commands
The Python CLI already covers analysis, features, editing, mastering, and `mix`
(see [More Commands](#more-commands) below). `sonare-cli` adds commands the PyPI
package does not have. Get it from a release archive, or see
[Building from Source](/docs/installation#building-from-source).

- Analysis: `sections`, `melody`, `boundaries`, `meter`, `clipping`, `dynamic-range`, `stereo`, `phase`, `system-info`
- Effects / transforms: `preemphasis`, `deemphasis`, `split-silence`, `gain`, `fade`, `filter`
- Synthesis: `tone`, `chirp`, `clicks`
- Features: `cqt`, `vqt`, `mel-to-audio`, `mfcc-to-audio`, `tonnetz`, `pcen`, `onset-env` (short alias for `onset-envelope`), `fourier-tempogram`, `tempogram-ratio`
- librosa utilities: `frames-to-samples`, `samples-to-frames`, `power-to-db`, `amplitude-to-db`, `db-to-power`, `db-to-amplitude`, `frame-signal`, `pad-center`, `fix-length`, `fix-frames`, `peak-pick`, `vector-normalize`
- Mixing: `mix-strip` (single-input channel strip; `mix` is kept as a deprecated alias)
- Mastering: `mastering-pair-processor` (process a source/reference pair), `mastering-stereo-analyses`, `mastering-stereo-analyze`

Going the other way, the Python CLI has commands the native CLI does not:
`pitch-correct-timevarying`, `note-move`, `scale-quantize`, `master`,
`mastering-chain`, `mastering-streaming`, `mastering-suggest`,
`mastering-profile`, `mastering-presets`, `declip`, `midi-render`, and the
scene-based `mix`.
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

## Analysis Commands

### analyze

Full music analysis including BPM, key, time signature, and beats.

```bash
sonare analyze music.mp3
sonare analyze music.mp3 --json
```

**Output:**
```
  > Estimated BPM : 120.50 BPM  (conf 95.0%)
  > Estimated Key : C major  (conf 85.0%)
  > Time Signature: 4/4
  > Beats: 240
```

**JSON Output:**
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

### bpm

Detect tempo (BPM) only.

```bash
sonare bpm music.mp3
sonare bpm music.wav --json
```

**Output:**
```
  BPM: 128.00
```

### key

Detect musical key.

```bash
sonare key music.mp3
sonare key music.mp3 --json
sonare key music.mp3 --candidates 5 --profile temperley --modes major-minor
```

**Output:**
```
  Key: A minor (confidence: 82.0%)
```

**JSON Output:**
```json
{"root": 9, "mode": 1, "confidence": 0.82, "name": "A minor"}
```

Useful options:

| Option | Use |
|--------|-----|
| `--candidates N` | Show the top `N` ranked key candidates, not only the winner |
| `--use-hpss` | Analyze harmonic content for cleaner key detection on drum-heavy material |
| `--loudness-weighted` | Weight chroma frames by RMS so quieter passages contribute less |
| `--high-pass-hz FREQ` | Ignore low-frequency energy before key analysis |
| `--modes NAME` | Limit candidate modes |
| `--profile NAME` | Choose the key-profile family |
| `--genre-hint HINT` | Let the CLI choose a profile from a genre hint |

::: details What are key profiles, genre hints, and `--high-pass-hz`?
- **Key profile** — a template of how prominent each of the 12 pitch classes tends to be in a given key. The detector compares your song's chroma against these templates and picks the best match. Different families (`ks` / `krumhansl`, `temperley`, `shaath` / `keyfinder`, the Faraldo EDM profiles, `bellman` / `bellman-budge`) were tuned on different material, so one may fit your genre better than another.
- **Genre hint** — instead of naming a profile directly, you tell the CLI the rough style and it picks a matching profile for you (e.g. an EDM hint selects an EDM-tuned profile).
- **`--high-pass-hz`** — a high-pass filter removes energy below the given frequency before key analysis, so bass rumble or sub kick doesn't skew the chroma. A value like 80–120 Hz is typical.
:::

### beats

Detect beat times.

```bash
sonare beats music.mp3
sonare beats music.mp3 --json
```

**Output:**
```
  Beat times (240 beats):
    1. 0.520s
    2. 1.020s
    3. 1.520s
    ... (237 more)
```

### onsets

Detect onset times (note attacks).

```bash
sonare onsets music.mp3
sonare onsets music.mp3 --json
```

## Feature Commands

### mel

Compute a Mel spectrogram and print its dimensions.

```bash
sonare mel music.mp3
sonare mel music.mp3 --n-mels 80
sonare mel music.mp3 --fmin 40 --fmax 16000 --htk
```

| Option | Default | Description |
|--------|---------|-------------|
| `--fmin FREQ` | 0 | Lowest Mel-band frequency in Hz |
| `--fmax FREQ` | 0 | Highest Mel-band frequency in Hz; 0 uses the Nyquist frequency |
| `--htk` | off | Use the HTK Mel scale instead of the Slaney scale |

**Output:**
```
  Mel Spectrogram:
    Shape: 128 mels x 8520 frames
```

### chroma

Compute chromagram (pitch class distribution).

```bash
sonare chroma music.mp3
sonare chroma music.mp3 --json
```

**Output:**
```
  Chromagram: 12 bins x 8520 frames
  Mean energy per pitch class:
    C  0.1250 #############
    C# 0.0450 #####
    D  0.0820 ########
    ...
```

### spectral

Compute spectral features (centroid, bandwidth, rolloff, flatness, ZCR, RMS).

```bash
sonare spectral music.mp3
sonare spectral music.mp3 --json
```

**Output:**
```
  Spectral Features:
  Feature          Mean       Std        Min        Max
  centroid         2150.5     850.2      120.5      8500.0
  bandwidth        1850.2     520.8       50.2      4200.5
  rolloff          4520.8    1200.5      200.0     10000.0
  flatness         0.0250     0.0180     0.0010     0.1520
  zcr              0.0850     0.0420     0.0020     0.2500
  rms              0.0520     0.0280     0.0001     0.1850
```

### pitch

Track pitch using YIN or pYIN algorithm.

```bash
sonare pitch music.mp3
sonare pitch music.mp3 --algorithm yin
```

| Option | Default | Description |
|--------|---------|-------------|
| `--algorithm` | pyin | Pitch algorithm: "yin" or "pyin" |

**Output:**
```
  Pitch Tracking (pyin):
    Frames:    8520
    Median F0: 285.5 Hz
    Mean F0:   302.8 Hz
```

### hpss

Harmonic-Percussive Source Separation.

```bash
sonare hpss music.mp3 -o separated
sonare hpss music.mp3 -o separated --json
```

**Output:**
```
  HPSS: 3980000 samples
  Harmonic energy:   0.025000
  Percussive energy: 0.018000
  Wrote: separated_harmonic.wav, separated_percussive.wav
```

## More Commands

The Python CLI ships many more subcommands than the core set above. Audio-file analysis and feature commands share the common options (`--json`, `--n-fft`, etc.) and take a file argument. Listing and preset-inspection commands have their own smaller option sets. Editing commands write a WAV when you pass `-o/--output`.

### More analysis

::: info Room-acoustic command terms
**Equivalent room** means a useful model inferred from audio, not exact measured geometry. **RIR** means room impulse response. **Room morphing** is a creative room effect, not dereverberation.
:::

| Command | Description | Notable options |
|---------|-------------|-----------------|
| `sonare downbeats music.mp3` | Downbeat times (seconds) | — |
| `sonare chords music.mp3` | Chord progression | `--min-duration`, `--smoothing-window`, `--threshold`, `--triads-only`, `--nnls`, `--no-beat-sync`, `--use-hmm`, `--hmm-beam-width`, `--key-context`, `--key-root`, `--key-mode`, `--detect-inversions` |
| `sonare rhythm music.mp3` | Rhythm primitives (syncopation, groove, regularity) | — |
| `sonare dynamics music.mp3` | Dynamics / loudness summary | — |
| `sonare timbre music.mp3` | Timbre / spectral-shape summary | — |
| `sonare lufs music.mp3` | EBU R128 loudness | `--series` (also emit momentary/short-term series) |
| `sonare acoustic room.wav` | Room-acoustic estimate (RT60/EDT/C50/C80) | `--ir` (treat input as an impulse response) |
| `sonare estimate-room room.wav` | Equivalent room estimate: volume, dimensions, absorption, DRR, confidence | `--json`, `--aspect-lw`, `--aspect-lh`, `--reference-absorption`, `--sabine`, `--n-octave-bands` |
| `sonare synthesize-rir --length 7 --width 5 --height 3 -o rir.wav` | Mono RIR from shoebox geometry | `--source-x`, `--source-y`, `--source-z`, `--listener-x`, `--listener-y`, `--listener-z`, `--absorption`, `--sample-rate`, `--ism-order`, `--seed`, `--max-seconds` |
| `sonare room-morph dry.wav --length 12 --width 9 --height 4 -o wet.wav` | Creative room-character morph toward a target room | `--wet`, `--suppression`, geometry and placement options, `--max-seconds` |
| `sonare meter music.wav` | Basic level meters: peak, RMS, crest, true peak, clipping ratio, silence ratio, DC offset | Native CLI only. `--clip-threshold`, `--oversample` |
| `sonare clipping music.wav` | Clipped sample and region detection | Native CLI only. `--threshold`, `--min-region` |
| `sonare dynamic-range music.wav` | Percentile RMS dynamic range | Native CLI only. `--window-sec`, `--hop-sec`, `--low-percentile`, `--high-percentile` |
| `sonare stereo left.wav --reference right.wav` | Stereo correlation and width from left/right files | Native CLI only |
| `sonare phase left.wav --reference right.wav` | Phase-scope summary from left/right files | Native CLI only |

### More features

| Command | Python CLI | Native CLI | Description |
|---------|------------|----------------------|-------------|
| `sonare onset-envelope music.mp3` | Yes | Yes | Onset strength envelope |
| `sonare onset-env music.mp3` | No | Yes | Short alias for onset strength envelope |
| `sonare tempogram music.mp3` | Yes | Yes | Autocorrelation tempogram |
| `sonare plp music.mp3` | Yes | Yes | Predominant local pulse |
| `sonare nnls-chroma music.mp3` | Yes | Yes | NNLS chromagram |
| `sonare cqt music.mp3` | No | Yes | Constant-Q transform summary |
| `sonare vqt music.mp3` | No | Yes | Variable-Q transform summary |
| `sonare mel-to-audio music.mp3 -o recon.wav` | No | Yes | Reconstruct audio from a computed Mel spectrogram with Griffin-Lim |
| `sonare mfcc-to-audio music.mp3 -o recon.wav` | No | Yes | Reconstruct audio from computed MFCCs via Mel + Griffin-Lim |
| `sonare tonnetz music.mp3` | No | Yes | Tonal centroid features |
| `sonare pcen --values ... --n-bins 128 --n-frames 10` | No | Yes | Per-channel energy normalization over a flattened matrix |
| `sonare fourier-tempogram music.mp3` | No | Yes | Fourier tempogram |
| `sonare tempogram-ratio music.mp3` | No | Yes | Tempo-ratio features |

The Python CLI intentionally prints summaries for matrix features rather than dumping full arrays. For full feature matrices, use [Python API](./python-api.md) or [JavaScript API](./js-api.md).

### Editing

These transform audio and write a WAV with `-o`:

| Command | Description | Options |
|---------|-------------|---------|
| `sonare pitch-correct vocal.wav -o out.wav` | Pitch-correct toward a target MIDI note | `--current-midi` (69.0), `--target-midi` (69.0) |
| `sonare pitch-correct-timevarying vocal.wav -o out.wav` | Track a pYIN contour and correct it to one note or a scale | `--mode midi\|scale`, `--target-midi`, `--scale-root`, `--scale-mode-mask`, `--retune-amount`, `--retune-speed-ms` |
| `sonare note-move take.wav --target-onset 48000 -o out.wav` | Move one note region to a sample offset | `--onset`, `--offset`, `--target-onset` (sample indices) |
| `sonare note-stretch take.wav -o out.wav` | Time-stretch a single note region | `--onset`, `--offset` (sample indices), `--ratio` (1.0) |
| `sonare scale-quantize 68.7` | Quantize one MIDI value to a scale | `--root`, `--mode-mask`, `--reference-midi` |
| `sonare voice-change vocal.wav -o out.wav` | Voice change (pitch + formant) | `--pitch-semitones` (0.0), `--formant-factor` (1.0) |
| `sonare pitch-shift vocal.wav --semitones 3 -o out.wav` | Transpose without changing length | `--semitones` (**required**) |
| `sonare time-stretch take.wav --rate 1.2 -o out.wav` | Change length without changing pitch | `--rate` (**required**) |
| `sonare normalize mix.wav -o out.wav` | Peak or RMS normalization | `--mode peak\|rms`, `--target-db` |
| `sonare trim-silence take.wav -o out.wav` | Trim leading/trailing silence | `--top-db` |
| `sonare resample music.wav --target-sr 44100 -o out.wav` | Resample | `--target-sr` |

The Python CLI provides the file-writing edit commands above. `hpss` also
requires `-o` and writes `<base>_harmonic.wav` and `<base>_percussive.wav` while
printing its energy summary.

::: warning Inert defaults are now errors
`--semitones` and `--rate` used to default to values that made the command a
silent no-op. They are required, and an unknown `--algorithm` for pitch shift or
an unknown `--mode` for pitch correction is rejected instead of falling back.
:::

The native CLI includes the shared edit commands and adds lower-level processing commands:

| Native command | Required or notable option |
|----------------|----------------------------|
| `gain` | `-o`, `--gain-db` |
| `fade` | `-o`, `--fade-in` and/or `--fade-out` |
| `filter` | `-o`, `--type hp\|lp\|bp\|notch`; use `--cutoff` for hp/lp or `--center` + `--bandwidth` for bp/notch |
| `preemphasis`, `deemphasis`, `split-silence` | `-o` when writing a processed file |

### Realtime voice presets

These commands inspect, validate, or render the realtime voice-changer preset chain:

| Command | Description | Options |
|---------|-------------|---------|
| `sonare voice-change vocal.wav -o out.wav` | Render through the realtime voice preset chain when `--preset`, `--preset-json`, `--preset-pack`, or `--set` is supplied | `--preset`, `--preset-json`, `--preset-pack`, `--set PATH=VALUE` |
| `sonare voice-presets` | List realtime voice changer preset ids | `--json` |
| `sonare voice-preset` | Print one preset's config as JSON | `--preset` (`neutral-monitor`), `--json` |
| `sonare voice-preset-validate preset.json` | Validate and normalize a preset JSON file or preset pack | `--preset` when validating a pack, `--set PATH=VALUE`, `--json` |

Without realtime preset options, `voice-change` uses the simple pitch/formant helper controlled by `--pitch-semitones` and `--formant-factor`. With preset options, it uses the realtime voice chain; combining preset options with either simple control is rejected as an invalid-parameter error.

Preset selection is explicit: choose a built-in `--preset ID`, a
`--preset-json FILE`, or the pair `--preset-pack FILE --preset ID`. The pack file
and entry ID form one selector; `--preset-pack` without `--preset` is rejected
(there is no first-entry fallback). `--preset-json` cannot be combined with a
pack, and `--set PATH=VALUE` requires a preset selector.

### Synthesis

The native CLI can generate simple test signals:

| Native command | Required or notable option |
|----------------|----------------------------|
| `tone -o tone.wav` | `--frequency`; optional `--sr`, `--duration`, `--phase`, `--amplitude` |
| `chirp -o sweep.wav` | `--fmax`; optional `--fmin`, `--exponential`, `--sr`, `--duration` |
| `clicks -o clicks.wav` | `--times` comma-separated seconds; optional `--sr`, `--length`, `--frequency`, `--click-duration` |

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

### Mastering Workflow

::: info Command availability
The PyPI Python CLI includes `mastering`, `master`, `mastering-processor`, `mastering-processors`, `mastering-chain`, `mastering-presets`, `eq`, `declip`, and the pair-analysis commands shown below. The native CLI exposes additional mastering commands: `mastering-pair-processor` for source/reference processing, plus stereo-analysis lists and runners. See [Building from Source](/docs/installation#building-from-source).
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

Named mastering commands in the Python CLI:

| Purpose | Command |
|---------|---------|
| Loudness-normalize with a true-peak ceiling | `sonare mastering` |
| Apply a named mastering preset | `sonare master` |
| Run a configurable mastering chain | `sonare mastering-chain` |
| List mastering preset names | `sonare mastering-presets` |
| Repair clipped audio (LPC reconstruction) | `sonare declip` |
| Apply the unified equalizer | `sonare eq` |
| List mono/stereo processors | `sonare mastering-processors` |
| Apply a named processor | `sonare mastering-processor` |
| List pair processors | `sonare mastering-pair-processors` |
| List pair analyses | `sonare mastering-pair-analyses` |
| Analyze a source/reference pair | `sonare mastering-pair-analyze` |
| Audio profile analysis (prints JSON) | `sonare mastering-profile` |
| Chain suggestion from assistant (prints JSON) | `sonare mastering-suggest` |
| Streaming-platform normalization preview (prints JSON) | `sonare mastering-streaming` |

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
| `sonare master track.wav -o out.wav` | `--preset NAME` (default `pop`), `--config '{...}'`, `--config-file f.json`, `--params k=v,...` | Applies a named mastering preset; `--config`/`--config-file`/`--params` override preset values |
| `sonare mastering-chain track.wav -o out.wav` | `--config '{...}'`, `--config-file f.json`, `--params k=v,...` | Runs a configurable mastering chain from JSON config |
| `sonare mastering-presets` | honors the global `--json` flag | Lists the available mastering preset names |
| `sonare declip clipped.wav -o out.wav` | `--clip-threshold` (0.98), `--lpc-order` (36), `--iterations` (2), `--lpc-blend` (0.65) | Repairs clipped audio via LPC reconstruction |

Native CLI only: `sonare mastering-pair-processor`, `sonare mastering-stereo-analyses`, and `sonare mastering-stereo-analyze`.

Related mastering guides: [Delivery targets](./glossary/mastering/delivery-targets.md), [Meter reading](./glossary/mastering/meter-reading.md), [Error recovery](./glossary/mastering/error-recovery.md).

Room-acoustic fields such as RT60, EDT, C50, C80, D50, volume, dimensions, absorption bands, DRR, generated RIR error state, and confidence are explained in [Room Acoustics](./acoustic-analysis.md).

### Mixing Workflow

::: info Command availability
The PyPI Python CLI includes `mix`, which loads a mixer scene from a JSON file or
a built-in preset and optionally renders per-strip input WAVs. It also includes
`mixing-presets` and `mixing-preset` for listing scenes and printing scene JSON
loadable by the WASM, Python, Node, or C++ mixer APIs.
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

`mix` requires exactly one of `--scene` or `--preset`. Pass one `--input` per
strip; rendering to a file needs `-o/--output`.

The native CLI's single-input channel strip is a different command with a
different job, and it is now called `mix-strip`:

```bash
sonare-cli mix-strip vocal.wav -o strip.wav \
  --input-trim-db -2 --fader-db 1.5 --pan 0.2 --width 1.4
```

::: info `mix` → `mix-strip` on the native CLI
The strip command was renamed to stop it reading as the scene mixer. The old
`mix` name still works as a deprecated alias. It also loads and writes true
stereo now, so `--width` actually changes the image — it was a no-op while the
command was mono. The fourth-order filter path runs through filtfilt only under
`--zero-phase`.
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
| `sonare project bounce` | Render a project to a WAV at the requested channel count | `--in`, `--sample-rate`, `--frames`, `--block-size`, `--channels`, `--synth`, `-o` |
| `sonare project export-smf` | Export the project to a Standard MIDI File | `--in`, `-o` |
| `sonare project import-smf` | Build a project from a Standard MIDI File | `--smf`, `-o` |
| `sonare project export-midi2` | Export the project to a MIDI 2.0 Clip File | `--in`, `-o` |
| `sonare project import-midi2` | Build a project from a MIDI 2.0 Clip File | `--midi2`, `-o` |

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

The Python CLI also has `midi-render`, a shorthand for `project bounce` that
always takes the synth path — omit `--synth` there and it follows GM programs.
The full option set is listed in the `sonare project` table earlier in this
section.

SoundFont (SF2) and per-destination synth JSON are not wired through these CLI
commands; use the Project API for SoundFont-backed bounces.

Related: [Project Editing](./project-editing.md), [Project Bounce](./project-bounce.md),
[Native Synth](./native-synth.md), [SoundFont Player](./soundfont-player.md).

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

Usage/parse errors use exit code 2; semantic invalid parameters use 3, and a
cancelled run uses 11. Set `SONARE_LEGACY_EXIT=1` for either CLI to fold every
failure back to exit `1` for scripts that hardcode the old all-failures-are-1
contract.

## Performance Tips

1. **Large files**: For files over 10 minutes, consider analyzing segments:
   ```bash
   # Analyze only first 60 seconds (using ffmpeg)
   ffmpeg -i long_song.mp3 -t 60 sample.wav
   sonare analyze sample.wav
   ```

2. **FFT size**: A smaller FFT size (`--n-fft 1024`) is faster but gives less frequency resolution.

3. **Hop length**: A larger hop length (`--hop-length 1024`) is faster but gives less time resolution.
