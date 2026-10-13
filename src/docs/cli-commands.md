---
title: CLI Commands
description: Per-command reference for the sonare CLI, covering analysis, features, editing, mastering and repair, rooms, and synthesis, with a task-to-command table and each command's options and output.
---

# CLI Commands

The per-command reference for the `sonare` CLI: what each command does, its options and defaults, and what it prints. Global options, exit codes, stereo handling and the list of which CLI carries which command are on the [CLI Reference](./cli.md). Whole shell workflows are on [CLI Examples](./cli-examples.md).

## Which command for which task

| I want to... | Command | Where |
|--------------|---------|-------|
| Get tempo, key and a full summary | `analyze`, `bpm`, `key`, `beats` | [Analysis Commands](#analysis-commands) |
| Find verses, choruses and other sections | `sections`, `boundaries` | [sections](#sections), [boundaries](#boundaries) |
| Read the chord progression | `chords` | [chords](#chords) |
| Measure loudness | `lufs`, `dynamics`; `meter` (native only) | [More analysis](#more-analysis) |
| Summarize spectral features | `mel`, `chroma`, `spectral` | [Feature Commands](#feature-commands) |
| Track a melody or list a singer's notes | `pitch`, `vocal-notes` | [pitch](#pitch), [Scale correction and vocal notes](./cli-examples.md#scale-correction-and-vocal-notes) |
| Split a mix into parts | `hpss`, `decompose-stems` | [hpss](#hpss), [decompose-stems](#decompose-stems) |
| Turn audio into a MIDI file | `transcribe` | [CLI Examples](./cli-examples.md#transcribe) |
| Fix a damaged recording | `repair`, `declip` | [repair](./cli.md#repair) |
| Master a track for delivery | `mastering`, `master`, `eq` | [Mastering and Repair](./cli.md#mastering-and-repair) |
| Change pitch, tempo or level of a file | `pitch-shift`, `time-stretch`, `normalize`, `trim-silence` | [Editing](#editing) |
| Cut a take at its silences | `split-silence` | [split-silence](#split-silence) |
| Estimate or simulate a room | `acoustic`, `estimate-room`, `synthesize-rir`, `room-morph` | [Room commands](#acoustic-and-estimate-room) |
| Mix stems into a scene | `suggest-mix`, `mix`, `mix-strip` | [Mixing Workflow](./cli-examples.md#mixing-workflow) |
| Render a project or MIDI through the synth | `project bounce`, `midi-render` | [Synthesis](./cli-examples.md#synthesis) |
| Render movie audio to speakers or headphones | `playback` | [Playback Renderer](./playback.md#one-flow-every-binding) |
| Check a number or a conversion | `power-to-db`, `frames-to-samples`, ... | [CLI Utilities](./cli-utilities.md) |

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

With `--json`, `analyze` prints one object holding every result above plus timbre, dynamics, rhythm and form; its fields are walked through under [The analyze JSON](./cli-examples.md#the-analyze-json).

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

### sections

Split a song into sections (intro, verse, chorus and so on) and name its overall form. See [Section structure](./glossary/analysis/section-structure.md) for what the labels mean.

```bash
sonare sections music.mp3
sonare sections music.mp3 --json
```

| Option | Default | Description |
|--------|---------|-------------|
| `--min-duration` | 4.0 | Shortest section to keep, in seconds |
| `--threshold` | 0.3 | Native CLI only. Boundary detection threshold |
| `--n-fft`, `--hop-length` | 2048, 512 | Analysis framing |

**JSON Output:**
```json
{"form": "?", "count": 1, "sections": [{"type": "unknown", "start": 0, "end": 6, "energy": 1, "confidence": 0}]}
```

`form` is the overall pattern as letters, or `?` when no repeated structure was found. `count` is the number of entries in `sections`, each with its `type`, `start` and `end` in seconds, `energy` and `confidence`.

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
| `--frames` | off | With `--json`, add the per-frame `times`, `f0`, `voiced_flag` and `voiced_prob` arrays to the summary |

**Output:**
```
  Pitch Tracking (pyin):
    Frames:    8520
    Median F0: 285.5 Hz
    Mean F0:   302.8 Hz
```

### hpss

Harmonic-Percussive Source Separation (HPSS, see [Source Separation](./source-separation.md)): splits a mix into its harmonic component (vocals, melody, sustained tones) and its percussive component (drums, transients).

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

Split a mix into non-negative matrix factorization (NMF) components (see [Source Separation](./source-separation.md)) — a
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

Beyond the core set above, both CLIs carry many more subcommands; the ones marked "native CLI only" need `sonare-cli`. Audio-file analysis and feature commands share the common options (`--json`, `--n-fft`, etc.) and take a file argument. Listing and preset-inspection commands have their own smaller option sets. Editing commands write a WAV when you pass `-o/--output`.

### More analysis

::: info Room-acoustic command terms
**Equivalent room** means a useful model inferred from audio, not exact measured geometry. **RIR** means room impulse response. **Room morphing** is a creative room effect, not dereverberation.

The metrics these commands report are decay and clarity descriptors: **RT60** is the reverberation time, **EDT** the early decay time, **C50** and **C80** clarity ratios, and **DRR** the direct-to-reverberant ratio. Each field is defined in [Room Acoustics](./acoustic-analysis.md).
:::

| Command | Description | Notable options |
|---------|-------------|-----------------|
| `sonare downbeats music.mp3` | Downbeat times (seconds) | — |
| `sonare chords music.mp3` | Chord progression | See [chords](#chords) |
| `sonare rhythm music.mp3` | Rhythm primitives (syncopation, groove, regularity) | `--start-bpm` (120.0), `--bpm-min` (60.0), `--bpm-max` (200.0) |
| `sonare dynamics music.mp3` | Dynamics / loudness summary | `--window-sec` (0.4) |
| `sonare timbre music.mp3` | Timbre / spectral-shape summary | — |
| `sonare lufs music.mp3` | EBU R128 loudness in LUFS (Loudness Units relative to Full Scale, the standard perceptual loudness unit — see [Delivery targets](./glossary/mastering/delivery-targets.md)) | `--series` (also emit momentary/short-term series) |
| `sonare acoustic room.wav` | Room-acoustic estimate (RT60/EDT/C50/C80) | See [acoustic and estimate-room](#acoustic-and-estimate-room) |
| `sonare estimate-room room.wav` | Equivalent room estimate: volume, dimensions, absorption, DRR, confidence | See [acoustic and estimate-room](#acoustic-and-estimate-room) |
| `sonare synthesize-rir --length 7 --width 5 --height 3 -o rir.wav` | Mono RIR from shoebox geometry | See [synthesize-rir and room-morph](#synthesize-rir-and-room-morph) |
| `sonare room-morph dry.wav --length 12 --width 9 --height 4 -o wet.wav` | Creative room-character morph toward a target room | See [synthesize-rir and room-morph](#synthesize-rir-and-room-morph) |
| `sonare boundaries music.mp3` | Structural transitions plus the novelty curve they were picked from | Native CLI only. See [boundaries](#boundaries) |
| `sonare melody music.mp3` | Melody contour summary: whether a melody was found, pitch range in octaves, mean frequency, pitch stability, vibrato rate, and the pitch-point count | Native CLI only. `--threshold` (0.1), `--hop-length` (512), `--fmin` (80.0), `--fmax` (1000.0) |
| `sonare meter music.wav` | Basic level meters: peak, RMS, crest, true peak, clipping ratio, silence ratio, DC offset | Native CLI only. `--clip-threshold`, `--oversample` |
| `sonare clipping music.wav` | Clipped sample and region detection | Native CLI only. `--threshold`, `--min-region` |
| `sonare dynamic-range music.wav` | Percentile RMS dynamic range | Native CLI only. `--window-sec`, `--hop-sec`, `--low-percentile`, `--high-percentile` |
| `sonare stereo left.wav --reference right.wav` | Stereo correlation and width from left/right files | Native CLI only |
| `sonare phase left.wav --reference right.wav` | Phase-scope summary from left/right files | Native CLI only |

#### chords

Chord progression as timed chord symbols. The defaults suit most pop and rock material; reach for the HMM and key-context options when a progression flickers between neighboring chords.

```bash
sonare chords music.mp3 --json
sonare chords music.mp3 --use-hmm --key-context --key-root C --key-mode major
```

| Option | Default | Description |
|--------|---------|-------------|
| `--min-duration` | 0.3 | Shortest chord kept, in seconds |
| `--smoothing-window` | 2.0 | Chroma smoothing window, in seconds (above 0) |
| `--threshold` | 0.5 | Chord detection confidence threshold |
| `--triads-only` | off | Restrict output to triad qualities |
| `--nnls` | off | Use NNLS chroma instead of the STFT chroma |
| `--no-beat-sync` | off | Disable beat-synchronous chroma pooling |
| `--use-hmm` | off | Decode the chord sequence with a hidden Markov model |
| `--hmm-beam-width` | 24 | HMM decoder beam width; `0` keeps the full search |
| `--key-context` | off | Bias detection with a key context |
| `--key-root` | C | Root pitch class for `--key-context` (for example `F#`) |
| `--key-mode` | major | Mode for `--key-context` (for example `minor`) |
| `--detect-inversions` | off | Report inversions (bass note) |

#### boundaries

Native CLI only. `boundaries` exposes the whole structural-boundary detector, so it reports the novelty curve along with the boundaries picked from it.

| Option | Default | Description |
|--------|---------|-------------|
| `--threshold` | 0.3 | Relative threshold: share of the largest novelty event within `--reference-window` |
| `--absolute-threshold` | 0.005 | Absolute floor on novelty |
| `--kernel-size` | 64 | Novelty kernel size in frames |
| `--n-mfcc` | 13 | MFCC coefficients in the feature stream |
| `--n-chroma` | 12 | Chroma bins in the feature stream |
| `--peak-distance` | 2.0 | Minimum spacing between boundaries, in seconds |
| `--reference-window` | 60 | One-sided span for the relative threshold, in seconds; `0` disables the relative threshold |
| `--no-mfcc`, `--no-chroma` | off | Drop one feature stream |
| `--n-fft`, `--hop-length` | 2048, 512 | Analysis framing |

The two thresholds do different jobs. `--threshold` is relative, so it cannot ask whether anything changed at all; `--absolute-threshold` is the floor that can. [`detectBoundaries(request)`](./js-api-analysis.md#detectboundaries-request) explains the pair and what lowering the floor will and will not recover. Giving both `--no-mfcc` and `--no-chroma` is refused, because the two streams are combined frame for frame and neither leaves nothing to combine.

#### acoustic and estimate-room

`acoustic` measures decay and clarity from a recording. `estimate-room` goes one step further and infers an equivalent room.

| Option | Default | Description |
|--------|---------|-------------|
| `--ir` | off | `acoustic`: treat the input as an impulse response |
| `--n-bands` | 6 | `acoustic`: number of octave bands reported |
| `--min-decay-db` | 30.0 | `acoustic`: minimum decay depth, in dB |
| `--noise-floor-margin-db` | 10.0 | `acoustic`: margin above the noise floor, in dB |
| `--aspect-lw` | 1.0 | `estimate-room`: length-to-width prior |
| `--aspect-lh` | 1.0 | `estimate-room`: length-to-height prior |
| `--reference-absorption` | 0.15 | `estimate-room`: absorption prior |
| `--sabine` | off | `estimate-room`: use the Sabine model instead of the default Eyring model |
| `--n-octave-bands` (alias `--n-bands`) | library default | `estimate-room`: analyzer octave-band count; `0` is the library default |

#### synthesize-rir and room-morph

`synthesize-rir` builds a mono room impulse response from shoebox geometry. `room-morph` moves a dry recording toward a target room as a creative effect. Both take the same room options.

| Option | Default | Description |
|--------|---------|-------------|
| `--length`, `--width`, `--height` | 7.0, 5.0, 3.0 | Room dimensions in metres |
| `--absorption` | 0.2 | Uniform wall absorption, 0 to 1 |
| `--source-x`, `--source-y`, `--source-z` | 1.0, 1.0, 1.2 | Source position in metres |
| `--listener-x`, `--listener-y`, `--listener-z` | 5.0, 4.0, 1.7 | Listener position in metres |
| `--ism-order` | 3 | Image-source reflection order |
| `--seed` | 1 | Seed for the late tail, so a render repeats exactly |
| `--max-seconds` | 0 | Cap on the RIR or tail length in seconds; `0` is the natural length |
| `--sabine` | off | Use the Sabine late-reverb model instead of the default Eyring model |
| `--sample-rate` | 48000 | `synthesize-rir` only: output sample rate |
| `--wet` | 0.5 | `room-morph` only: target-room mix, 0 to 1 |
| `--suppression` | 0.5 | `room-morph` only: how strongly the source room's tail is suppressed, 0 to 1 |
| `--receiver-spacing` | 0.5 | `room-morph` only: metres between the two receivers (above 0 up to 4). Used for a two-channel file, which is morphed as a stereo pair and written as a stereo file |

### More features

| Command | Python CLI | Native CLI | Description |
|---------|------------|----------------------|-------------|
| `sonare onset-envelope music.mp3` | Yes | Yes | Onset strength envelope (how strongly notes attack over time); the native CLI's `--json` carries the full `values` array plus mean/std/min/max |
| `sonare onset-env music.mp3` | No | Yes | Same envelope, summary only: frame count, peak time, peak strength, mean — no array |
| `sonare tempogram music.mp3` | Yes | Yes | Autocorrelation tempogram |
| `sonare plp music.mp3` | Yes | Yes | Predominant local pulse |
| `sonare nnls-chroma music.mp3` | Yes | Yes | NNLS chromagram |
| `sonare cqt music.mp3` | No | Yes | Constant-Q transform summary. `--n-bins`, `--bins-per-octave`, `--hop-length`, `--fmin` |
| `sonare vqt music.mp3` | No | Yes | Variable-Q transform summary. `--n-bins`, `--bins-per-octave`, `--gamma`, `--filter-scale`, `--hop-length`, `--fmin` |
| `sonare mel-to-audio music.mp3 -o recon.wav` | No | Yes | Reconstruct audio from a computed Mel spectrogram with Griffin-Lim. `--n-iter`, `--n-mels`, `--fmin`, `--fmax` |
| `sonare mfcc-to-audio music.mp3 -o recon.wav` | No | Yes | Reconstruct audio from computed MFCCs via Mel + Griffin-Lim. `--n-mfcc`, `--n-iter`, `--n-mels`, `--fmin`, `--fmax` |
| `sonare tonnetz music.mp3` | No | Yes | Tonal centroid features. `--n-fft`, `--hop-length` |
| `sonare pcen --values ... --n-bins 128 --n-frames 10` | No | Yes | Per-channel energy normalization over a flattened matrix. Takes `--values` like the [numeric helpers](./cli-utilities.md), plus `--n-bins`, `--n-frames`, `--sample-rate`, `--time-constant`, `--gain`, `--bias`, `--power`, `--eps`, `--hop-length` |
| `sonare fourier-tempogram music.mp3` | No | Yes | Fourier tempogram |
| `sonare tempogram-ratio music.mp3` | No | Yes | Tempo-ratio features |

The Python CLI intentionally prints summaries for matrix features rather than dumping full arrays. For full feature matrices, use [Python API](./python-api.md) or [JavaScript API](./js-api-analysis.md).

### Editing

These transform audio and write a WAV with `-o`. Per-note editing and scale correction are walked through in [CLI Examples](./cli-examples.md#note-editing-workflow).

| Command | Description | Options |
|---------|-------------|---------|
| `sonare pitch-correct vocal.wav -o out.wav` | Pitch-correct toward a target MIDI note | `--current-midi` (69.0), `--target-midi` (69.0) |
| `sonare pitch-correct-timevarying vocal.wav -o out.wav` | Track a pYIN contour and correct it to one note or a scale | `--mode midi\|scale`, `--target-midi`, `--scale-root`, `--scale-mode-mask` (a 12-bit mask or a mode name such as `minor`), `--reference-midi`, `--hop-length`, `--retune-amount` (1.0), `--max-correction-semitones` (12), `--retune-speed-ms` (50), `--vibrato-threshold-cents` (20) |
| `sonare note-move take.wav --target-onset 48000 -o out.wav` | Move one note region to a sample offset | `--onset`, `--offset`, `--target-onset` (sample indices) |
| `sonare note-stretch take.wav -o out.wav` | Time-stretch a single note region | `--onset`, `--offset` (sample indices), `--ratio` (1.0) |
| `sonare scale-quantize 68.7` | Quantize one MIDI value to a scale | `--root`, `--mode-mask` (a 12-bit mask or a mode name), `--reference-midi` |
| `sonare voice-change vocal.wav -o out.wav` | Voice change (pitch + formant) | `--pitch-semitones` (0.0), `--formant-factor` (1.0), `--formant-mode relative\|absolute` (relative) |
| `sonare pitch-shift vocal.wav --semitones 3 -o out.wav` | Transpose without changing length | `--semitones` (**required**) |
| `sonare time-stretch take.wav --rate 1.2 -o out.wav` | Change length without changing pitch | `--rate` (**required**) |
| `sonare normalize mix.wav -o out.wav` | Peak or RMS normalization | `--mode peak\|rms`, `--target-db` |
| `sonare trim-silence take.wav -o out.wav` | Trim leading/trailing silence. By default it cuts below an absolute `-60` dBFS, like the library's `trim`; `--top-db` switches to the peak-relative rule of `trimSilence` | `--top-db`, `--threshold-db` (-60) |
| `sonare resample music.wav --target-sr 44100 -o out.wav` | Resample | `--target-sr` |
| `sonare polyphonic-notes chord.wav` | List the notes a polyphonic analysis found | — |
| `sonare vocal-notes vocal.wav` | List the notes a vocal edit session finds in a monophonic take, with each note's pitch in cents from the nearest note | `--segmentation-threshold-cents` (50), `--min-note-ms` (30), `--fmin-hz` (65), `--fmax-hz` (2093), `--reference-hz` (440), `--frame-length-samples`, `--hop-length-samples`, `--yin-threshold`, `--voiced-threshold`, `--no-centered` |
| `sonare polyphonic-render chord.wav -o out.wav` | Re-render that analysis with per-note edits | `--edit NOTE.FIELD=VALUE` (repeatable) |
| `sonare project align-takes --in project.json --reference-source 1 -o aligned.json` | Align every take in a project to one reference source and write the project back with a warp map per take; reads the source files; a take recorded at another rate is resampled onto the reference's grid and the anchors are written at the project rate (see [Recording and Takes](./recording-and-takes.md)) | `--in`, `--reference-source` (**required**), `--audio SOURCE_ID=WAV` (repeatable), `--resolve-audio`, `--hop-length`, `--bins-per-octave` |

`--top-db` and `--threshold-db` are mutually exclusive, alternate silence
selectors: passing neither defaults `--threshold-db` to `-60`; passing
`--top-db` switches to a top-dB-relative-to-peak selector instead.

Both CLIs provide the file-writing edit commands above. `hpss` also
requires `-o` and writes `<base>_harmonic.wav` and `<base>_percussive.wav` while
printing its energy summary.

::: warning No inert defaults
`--semitones` and `--rate` have no default, because any default would make the
command a silent no-op. Leaving either out exits 3. The same rule holds for
`pitch-correct-timevarying --mode`, which accepts only `midi` or `scale`; anything
else is a usage error (exit 2) instead of a fallback.
:::

The native CLI includes the shared edit commands and adds lower-level processing commands:

| Native command | Required or notable option |
|----------------|----------------------------|
| `sonare gain music.wav -o out.wav` | `-o`, `--gain-db` (**required**) |
| `sonare fade music.wav -o out.wav` | `-o`, `--fade-in` and/or `--fade-out` (seconds) |
| `sonare filter music.wav -o out.wav` | `-o`, `--type hp\|lp\|bp\|notch`; use `--cutoff` for hp/lp or `--center` + `--bandwidth` for bp/notch; `--order` (2), `--zero-phase` |
| `sonare preemphasis speech.wav -o out.wav`, `sonare deemphasis speech.wav -o out.wav` | `-o`; `--coef` (0.97) |

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

With `--report`, the JSON becomes an object, `{"intervals": [...], "report": {...}}`.

| Option | Default | Description |
|--------|---------|-------------|
| `--input WAV` | — | Another take of the same part, repeatable |
| `--top-db` | 60.0 | Silence threshold below the peak, in dB |
| `--write-takes PREFIX` | — | Write every take sliced at every interval |
| `--report` | off | With `--json`, add a `report` object: `silence_ceiling_db` (the largest `--top-db` at which any silence still shows; with several takes, the least headroom among them), plus `max_signal_intervals` and `min_signal_intervals` (the interval counts of the most and least fragmented single take) |
| `--n-fft`, `--hop-length` | 2048, 512 | Analysis framing |

With more than one take, a cut falls only where every take is quiet. The multi-take form, `--write-takes` and the errors are walked through under [Splitting Takes at Silence](./cli-examples.md#splitting-takes-at-silence).

`-o`/`--output` is a usage error (exit code 2): the command's result is the interval list or the sliced take files, never a single rendered output file.

### Realtime voice presets

These commands inspect, validate, or render the realtime voice-changer preset chain:

| Command | Description | Options |
|---------|-------------|---------|
| `sonare voice-change vocal.wav -o out.wav` | Render through the realtime voice preset chain when `--preset`, `--preset-json`, `--preset-pack`, or `--set` is supplied | `--preset`, `--preset-json`, `--preset-pack`, `--set PATH=VALUE` |
| `sonare voice-presets` | List realtime voice changer preset ids | `--json` |
| `sonare voice-preset` | Print one preset's config as JSON | `--preset` (`neutral-monitor`), `--json` |
| `sonare voice-preset-validate preset.json` | Validate and normalize a preset JSON file or preset pack | `--preset` when validating a pack, `--set PATH=VALUE`, `--json` |

Without realtime preset options, `voice-change` uses the simple pitch/formant helper controlled by `--pitch-semitones`, `--formant-factor` and `--formant-mode`. With `relative` (the default) the formant factor is a warp applied after the pitch shift, so the formants follow the pitch; with `absolute` it is the formant shift relative to the input whatever the pitch shift (`1.0` keeps the formants where they were), and a request the formant warp cannot reach is refused with the reachable range. With preset options, it uses the realtime voice chain; combining preset options with any of the three simple controls is rejected as an invalid-parameter error.

Preset selection is explicit: choose a built-in `--preset ID`, a
`--preset-json FILE`, or the pair `--preset-pack FILE --preset ID`. The pack file
and entry ID form one selector; `--preset-pack` without `--preset` is rejected
(there is no first-entry fallback). `--preset-json` cannot be combined with a
pack, and `--set PATH=VALUE` requires a preset selector.

### Playback

`playback` renders movie audio (mono, stereo, 5.1 or 7.1) to speaker layouts or binaural headphones, and is the only command that keeps 5.1 and 7.1 channels. Options: `--target` (`headphones`, `stereo`, `5.1`, `7.1`), `--input-layout` (`auto`, `mono`, `stereo`, `5.1`, `7.1`), `--config FILE`, `--no-upmix`, `--night` (0 to 1), `--dialogue-db` (-12 to 12), `--program-lufs` (-70 to 0; measured from the input when omitted), `--target-lufs` (-40 to -5), `--room` (`none`, `living_room`, `home_theater`, `screening_room`) and `--hrtf FILE`. The stages, config keys and examples are on [Playback Renderer](./playback.md#one-flow-every-binding).
