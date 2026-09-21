---
title: CLI Commands
description: Per-command reference for the sonare CLI, covering the analysis, feature, and extended command groups with their options and output.
---

# CLI Commands

The analysis, feature, and extended command groups of the `sonare` CLI, split out from the [CLI Reference](./cli.md) index, which keeps the global options, the mastering walkthrough, exit codes, and format notes.

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
| `sonare melody music.mp3` | Melody contour summary: whether a melody was found, pitch range in octaves, mean frequency, pitch stability, vibrato rate, and the pitch-point count | Native CLI only. `--threshold` (0.1), `--hop-length` (512), `--fmin` (80.0), `--fmax` (1000.0) |
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
| `sonare project align-takes --in project.json --reference-source 1 -o aligned.json` | Align every take in a project to one reference source and write the project back with a warp map per take; reads the source files, so a take whose rate differs from the reference is refused by name (see [Recording and Takes](./recording-and-takes.md)) | `--in`, `--reference-source` (**required**), `--audio SOURCE_ID=WAV` (repeatable), `--resolve-audio`, `--hop-length`, `--bins-per-octave` |

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

The native CLI can generate simple test signals, and both CLIs can render a MIDI project through the built-in synth:

| Command | Required or notable option |
|---------|----------------------------|
| `sonare tone -o tone.wav` | `--frequency`; optional `--sr` (22050), `--duration` (1.0), `--phase` (0.0), `--amplitude` (1.0) |
| `sonare chirp -o sweep.wav` | `--fmax`; optional `--fmin`, `--exponential`, `--sr` (22050), `--duration` (1.0) |
| `sonare clicks -o clicks.wav` | `--times` comma-separated seconds; optional `--sr` (22050), `--length`, `--frequency` (1000.0), `--click-duration` (0.1) |
| `sonare midi-render --in project.json -o render.wav` | `--in`, `-o`; `--synth PRESET` (omitted, it follows the GM programs), `--sample-rate`, `--frames`, `--block-size`, `--channels` (2), `--instrument-latency`. Both CLIs: a `project bounce` with the synth always on, so it takes neither `--audio` nor `--resolve-audio` |

