# CLI Reference

Complete reference for the `sonare` command-line interface.

Use the CLI when you want quick checks, batch jobs, or script-friendly JSON without writing application code. If you are building a UI, start with [WebAssembly Guide](./wasm.md), [Python API](./python-api.md), or [Mixing Engine](./mixing.md) instead.

This page is the per-command reference. For whole jobs carried end to end in the shell — stems to a finished master, a reference match, a delivery gate in CI — see [Use Cases](./use-cases.md).

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

::: info Which commands each CLI carries
Most commands are on both CLIs and take the same options. `sonare-cli` adds the
low-level utilities and signal generators the PyPI package does not carry; the
Python CLI adds the scene mixer and the preset-driven mastering commands. Get the
native binary from a release archive, or see
[Building from Source](/docs/installation#building-from-source).

**Native CLI only**

- Analysis: `melody`, `boundaries`, `meter`, `clipping`, `dynamic-range`, `stereo`, `phase`, `system-info`
- Effects / transforms: `preemphasis`, `deemphasis`, `gain`, `fade`, `filter`
- Synthesis: `tone`, `chirp`, `clicks`
- Features: `cqt`, `vqt`, `mel-to-audio`, `mfcc-to-audio`, `tonnetz`, `pcen`, `onset-env` (onset-envelope summary: peak time, peak strength, mean), `fourier-tempogram`, `tempogram-ratio`
- librosa utilities: `frames-to-samples`, `samples-to-frames`, `power-to-db`, `amplitude-to-db`, `db-to-power`, `db-to-amplitude`, `frame-signal`, `pad-center`, `fix-length`, `fix-frames`, `peak-pick`, `vector-normalize`
- Mastering: `mastering-stereo-analyses`

**Python CLI only**

`master`, `mastering-chain`, `declip`, and `mix` — the scene mixer described under
[Mixing Workflow](#mixing-workflow).

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

## Analysis Commands

### analyze

Full music analysis including BPM, key, time signature, and beats.

```bash
sonare analyze music.mp3
sonare analyze music.mp3 --json
```

| Option | Default | Description |
|--------|---------|-------------|
| `--with-seventh` | off | Search the full chord template set instead of triads only |
| `--no-hpss` | off | Disable harmonic-percussive separation |
| `--chroma-highpass` | 80.0 | High-pass cutoff for chroma analysis in Hz |
| `--meter-candidates` | `3,4,6` | Comma-separated meter numerators to score |
| `--meter-denominator` | 4 | Beat unit reported for the detected meter |

Without `--with-seventh`, chord recognition matches against major, minor,
diminished, and augmented triads only. With it, all 24 qualities per root are in
play — the sevenths and ninths, the sixths, `7sus4`, the elevenths and
thirteenths, and the altered dominants.

The meter search only ever reports a numerator it was asked to score, and the
default set is `3,4,6` — so a 5/4, 7/8, or 11/8 piece comes back as one of those
three unless you widen the set with `--meter-candidates 3,4,5,7`. The list takes
1 to 16 entries, each between 2 and 32. `--meter-denominator` sets the beat unit
the result is reported in and does not affect the search. See
[Meter and grouping](./glossary/analysis/meter-and-grouping.md) for what the two
numbers mean.

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

Compute spectral features: centroid, bandwidth, rolloff, flatness, ZCR (zero-crossing rate), and RMS (root mean square level).

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

Track pitch over time with the YIN or pYIN fundamental-frequency estimator.

```bash
sonare pitch music.mp3
sonare pitch music.mp3 --algorithm yin
```

| Option | Default | Description |
|--------|---------|-------------|
| `--algorithm` | pyin | Pitch algorithm: "yin" or "pyin" |
| `--threshold` | 0.1 | YIN threshold (> 0 and <= 1) |
| `--fmin` | 65.0 | Minimum tracked frequency in Hz |
| `--fmax` | 2093.0 | Maximum tracked frequency in Hz |
| `--hop-length` | 512 | Hop length in samples (redeclared locally with domain checks, distinct from the global `--hop-length`) |

**Output:**
```
  Pitch Tracking (pyin):
    Frames:    8520
    Median F0: 285.5 Hz
    Mean F0:   302.8 Hz
```

### hpss

Harmonic-Percussive Source Separation (HPSS): splits a mix into its harmonic component (vocals, melody, sustained tones) and its percussive component (drums, transients).

```bash
sonare hpss music.mp3 -o separated
sonare hpss music.mp3 -o separated --json
```

| Option | Default | Description |
|--------|---------|-------------|
| `--kernel-harmonic <int>` | 31 | Harmonic median-filter kernel size |
| `--kernel-percussive <int>` | 31 | Percussive median-filter kernel size |
| `--harmonic-only` | off | Write only the harmonic component |
| `--percussive-only` | off | Write only the percussive component |
| `--with-residual` | off | Also separate and write a residual component |
| `--hard-mask` | off | Use a hard mask instead of the default soft mask |

`--harmonic-only`, `--percussive-only`, and `--with-residual` are mutually exclusive.

**Output:**
```
  HPSS: 3980000 samples
  Harmonic energy:   0.025000
  Percussive energy: 0.018000
  Wrote: separated_harmonic.wav, separated_percussive.wav
```

### decompose-stems

Split a mix into non-negative matrix factorization (NMF) components — a
data-driven separation that finds recurring spectral patterns instead of the
fixed harmonic/percussive split `hpss` applies.

```bash
sonare decompose-stems band.wav -o stems.wav
sonare decompose-stems band.wav -o stems.wav --n-components 6 --init nndsvd --json
```

| Option | Default | Description |
|--------|---------|-------------|
| `--n-components <int>` | 4 | Number of components to factor the mix into |
| `--n-iter <int>` | 100 | NMF update iterations |
| `--beta` | 2.0 | Beta divergence: 2 is Frobenius, 1 is Kullback-Leibler |
| `--init` | random | NMF initialization: `random` or `nndsvd` |
| `--mask-power` | 1.0 | Soft-mask exponent (>= 1); 2 gives the Wiener-style power ratio |

`-o` names the set rather than one file: both CLIs write
`<base>_component1.wav` … `<base>_componentN.wav`, stripping a trailing `.wav`
from the path you gave. Every component keeps the source's phase, so the
components sum back to the input and each one is listenable on its own. That is
the difference from the library's bare `decompose`, which returns the factors of
a magnitude spectrogram and leaves you needing a phase estimator to hear
anything.

**Output:**
```
  Stems: 4 components
     1. energy 0.031200  stems_component1.wav
     2. energy 0.018400  stems_component2.wav
     3. energy 0.009100  stems_component3.wav
     4. energy 0.004700  stems_component4.wav
```

## More Commands

The Python CLI ships many more subcommands than the core set above. Audio-file analysis and feature commands share the common options (`--json`, `--n-fft`, etc.) and take a file argument. Listing and preset-inspection commands have their own smaller option sets. Editing commands write a WAV when you pass `-o/--output`.

### More analysis

::: info Room-acoustic command terms
**Equivalent room** means a useful model inferred from audio, not exact measured geometry. **RIR** means room impulse response. **Room morphing** is a creative room effect, not dereverberation.

The metrics these commands report are decay and clarity descriptors: **RT60** is the reverberation time, **EDT** the early decay time, **C50** and **C80** clarity ratios, and **DRR** the direct-to-reverberant ratio. Each field is defined in [Room Acoustics](./acoustic-analysis.md).
:::

| Command | Description | Notable options |
|---------|-------------|-----------------|
| `sonare downbeats music.mp3` | Downbeat times (seconds) | — |
| `sonare chords music.mp3` | Chord progression | `--min-duration`, `--smoothing-window`, `--threshold`, `--triads-only`, `--nnls`, `--no-beat-sync`, `--use-hmm`, `--hmm-beam-width`, `--key-context`, `--key-root`, `--key-mode`, `--detect-inversions` |
| `sonare rhythm music.mp3` | Rhythm primitives (syncopation, groove, regularity) | `--start-bpm` (120.0), `--bpm-min` (60.0), `--bpm-max` (200.0) |
| `sonare dynamics music.mp3` | Dynamics / loudness summary | `--window-sec` (0.4) |
| `sonare timbre music.mp3` | Timbre / spectral-shape summary | — |
| `sonare lufs music.mp3` | EBU R128 loudness in LUFS (Loudness Units relative to Full Scale, the standard perceptual loudness unit — see [Delivery targets](./glossary/mastering/delivery-targets.md)) | `--series` (also emit momentary/short-term series) |
| `sonare acoustic room.wav` | Room-acoustic estimate (RT60/EDT/C50/C80) | `--ir` (treat input as an impulse response), `--n-bands` (6), `--min-decay-db` (30.0), `--noise-floor-margin-db` (10.0) |
| `sonare estimate-room room.wav` | Equivalent room estimate: volume, dimensions, absorption, DRR, confidence | `--json`, `--aspect-lw`, `--aspect-lh`, `--reference-absorption`, `--sabine`, `--n-octave-bands` |
| `sonare synthesize-rir --length 7 --width 5 --height 3 -o rir.wav` | Mono RIR from shoebox geometry | `--source-x`, `--source-y`, `--source-z`, `--listener-x`, `--listener-y`, `--listener-z`, `--absorption`, `--sample-rate`, `--ism-order`, `--seed`, `--max-seconds` |
| `sonare room-morph dry.wav --length 12 --width 9 --height 4 -o wet.wav` | Creative room-character morph toward a target room | `--wet`, `--suppression`, geometry and placement options, `--max-seconds` |
| `sonare boundaries music.mp3` | Structural transitions plus the novelty curve they were picked from | Native CLI only. `--threshold` (0.3), `--absolute-threshold` (0.005), `--kernel-size` (64), `--n-mfcc` (13), `--n-chroma` (12), `--peak-distance` (2.0), `--no-mfcc`, `--no-chroma`, `--n-fft` (2048), `--hop-length` (512) |
| `sonare meter music.wav` | Basic level meters: peak, RMS, crest, true peak, clipping ratio, silence ratio, DC offset | Native CLI only. `--clip-threshold`, `--oversample` |
| `sonare clipping music.wav` | Clipped sample and region detection | Native CLI only. `--threshold`, `--min-region` |
| `sonare dynamic-range music.wav` | Percentile RMS dynamic range | Native CLI only. `--window-sec`, `--hop-sec`, `--low-percentile`, `--high-percentile` |
| `sonare stereo left.wav --reference right.wav` | Stereo correlation and width from left/right files | Native CLI only |
| `sonare phase left.wav --reference right.wav` | Phase-scope summary from left/right files | Native CLI only |

`boundaries` exposes the whole detector, and its two thresholds do different jobs: `--threshold` is relative to the novelty curve's own maximum and so cannot ask whether anything changed at all, while `--absolute-threshold` is the floor that can. [`detectBoundaries(request)`](./js-api-analysis.md#detectboundaries-request) explains the pair and what lowering the floor will and will not recover. `--no-mfcc` and `--no-chroma` each drop one feature stream; giving both is refused, because the two are combined frame for frame and neither leaves nothing to combine.

### More features

| Command | Python CLI | Native CLI | Description |
|---------|------------|----------------------|-------------|
| `sonare onset-envelope music.mp3` | Yes | Yes | Onset strength envelope (how strongly notes attack over time); the native CLI's `--json` carries the full `values` array plus mean/std/min/max |
| `sonare onset-env music.mp3` | No | Yes | Same envelope, summary only: frame count, peak time, peak strength, mean — no array |
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

The Python CLI intentionally prints summaries for matrix features rather than dumping full arrays. For full feature matrices, use [Python API](./python-api.md) or [JavaScript API](./js-api-analysis.md).

### Editing

These transform audio and write a WAV with `-o`:

| Command | Description | Options |
|---------|-------------|---------|
| `sonare pitch-correct vocal.wav -o out.wav` | Pitch-correct toward a target MIDI note | `--current-midi` (69.0), `--target-midi` (69.0) |
| `sonare pitch-correct-timevarying vocal.wav -o out.wav` | Track a pYIN contour and correct it to one note or a scale | `--mode midi\|scale`, `--target-midi`, `--scale-root`, `--scale-mode-mask`, `--reference-midi`, `--hop-length` |
| `sonare note-move take.wav --target-onset 48000 -o out.wav` | Move one note region to a sample offset | `--onset`, `--offset`, `--target-onset` (sample indices) |
| `sonare note-stretch take.wav -o out.wav` | Time-stretch a single note region | `--onset`, `--offset` (sample indices), `--ratio` (1.0) |
| `sonare scale-quantize 68.7` | Quantize one MIDI value to a scale | `--root`, `--mode-mask`, `--reference-midi` |
| `sonare voice-change vocal.wav -o out.wav` | Voice change (pitch + formant) | `--pitch-semitones` (0.0), `--formant-factor` (1.0) |
| `sonare pitch-shift vocal.wav --semitones 3 -o out.wav` | Transpose without changing length | `--semitones` (**required**) |
| `sonare time-stretch take.wav --rate 1.2 -o out.wav` | Change length without changing pitch | `--rate` (**required**) |
| `sonare normalize mix.wav -o out.wav` | Peak or RMS normalization | `--mode peak\|rms`, `--target-db` |
| `sonare trim-silence take.wav -o out.wav` | Trim leading/trailing silence | `--top-db`, `--threshold-db` (-60) |
| `sonare resample music.wav --target-sr 44100 -o out.wav` | Resample | `--target-sr` |
| `sonare polyphonic-notes chord.wav` | List the notes a polyphonic analysis found | — |
| `sonare polyphonic-render chord.wav -o out.wav` | Re-render that analysis with per-note edits | `--edit NOTE.FIELD=VALUE` (repeatable) |

`--top-db` and `--threshold-db` are mutually exclusive, alternate silence
selectors: passing neither defaults `--threshold-db` to `-60`; passing
`--top-db` switches to a top-dB-relative-to-peak selector instead.

The Python CLI provides the file-writing edit commands above. `hpss` also
requires `-o` and writes `<base>_harmonic.wav` and `<base>_percussive.wav` while
printing its energy summary.

#### Per-note editing

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
| `filter` | `-o`, `--type hp\|lp\|bp\|notch`; use `--cutoff` for hp/lp or `--center` + `--bandwidth` for bp/notch; `--order` (2), `--zero-phase` |
| `preemphasis`, `deemphasis` | `-o` when writing a processed file; `--coef` (0.97) |

`filter --order` takes 2 or 4, and 4 is accepted for `hp`/`lp` only — a
fourth-order `bp` or `notch` is rejected. `--zero-phase` runs the filter forwards
and then backwards (filtfilt) so the result has no phase shift, at the cost of
doubling the effective slope and of needing the whole file in hand.

#### split-silence

`split-silence` finds where a take is quiet without altering it: it prints the
non-silent intervals as sample ranges, and only writes audio when you ask it to
slice by those intervals. Both front-ends carry it and take the same options.

```bash
sonare split-silence take1.wav
sonare split-silence take1.wav --json
```

**Output:**
```
Non-silent intervals: 3
  28160 - 116224
  153088 - 241152
  287232 - 394752
```

**JSON Output:**
```json
[{"start_sample": 28160, "end_sample": 116224}, {"start_sample": 153088, "end_sample": 241152}, {"start_sample": 287232, "end_sample": 394752}]
```

| Option | Default | Description |
|--------|---------|-------------|
| `--input WAV` | — | Another take of the same part, repeatable |
| `--top-db` | 60.0 | Silence threshold below the peak, in dB |
| `--write-takes PREFIX` | — | Write every take sliced at every interval |

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

`-o`/`--output` is still a usage error (exit code 2): the command's result is
the interval list or the sliced take files, never a single rendered output
file.

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

## Stereo and Mono Handling

Most CLI commands are mono by nature: the analysis they run, or the metering they
report, is defined on one channel. Both front-ends decode a multi-channel input
down to mono for those, and both print the same warning on stderr when they do,
so a stereo file never loses its channels silently.

The commands that would deliver a worse result for it keep the pair instead:

| Command | Stereo input |
|---------|--------------|
| `mastering` | Mastered as a pair; the stereo image is preserved end to end |
| `mastering-processor` | No `--stereo` flag needed: a two-channel input takes the stereo path on its own, and a processor with no mono form takes the stereo path regardless of input. Both channels are processed, and both are written |
| `mix` (Python), `mix-strip` | Processed as a pair. A mono file is carried on both sides; a stereo one keeps its own two channels |
| `suggest-mix` | Each `--input` keeps a stereo file as a pair instead of folding it, since the image analysis is the one part of the assistant that measures both channels |
| `normalize`, `master`, `mastering-chain`, `declip` (Python CLI) | Kept as a pair; one gain is measured across both channels so the image does not collapse toward the centre |
| Everything else | Downmixed to mono, with a warning |

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
