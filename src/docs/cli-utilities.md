---
title: CLI Utilities
description: The low-level numeric, frame, and conversion helpers the native sonare CLI carries for librosa parity, with tune-to-midi and system-info.
---

# CLI Utilities

The native `sonare-cli` carries a set of low-level helpers that mirror `librosa.util` and the librosa conversion functions: frame/sample conversion, the four decibel conversions, framing, padding, length fixing, peak picking, and vector normalization. They exist so a script ported from librosa can check a number against the engine without writing a binding call, and their reader is different from the one [CLI Commands](./cli-commands.md) serves: someone reproducing a calculation, not someone analysing a song. Examples on this page write `sonare`; substitute `sonare-cli` for every command marked native only.

The twelve numeric helpers take no audio file. Two take a single integer, `frames-to-samples --frames N` and `samples-to-frames --samples N`; the other ten take a comma-separated list through `--values`, which is required and refuses an empty list or an element that does not parse (`invalid float value in --values: x`). Plain output is the result as one comma-separated line, and `--json` prints a bare JSON array, except where a table below says otherwise. The two commands at the end of the page are different again: `tune-to-midi` takes an audio file and is on both CLIs, and `system-info` takes nothing at all.

## Frame and sample conversion

| Command | Result | Options |
|---------|--------|---------|
| `sonare frames-to-samples --frames 10` | Sample index of frame `N`: `N * hop + n_fft / 2` | `--frames` (0 when absent), `--n-fft` (2048), `--hop-length` (512) |
| `sonare samples-to-frames --samples 6144` | Frame index holding sample `N`: `floor((N - n_fft / 2) / hop)` | `--samples` (0 when absent), `--n-fft` (2048), `--hop-length` (512) |

The centring offset is on by default, because the CLI's `--n-fft` defaults to 2048 where librosa's `n_fft` argument defaults to none. Pass `--n-fft 0` for the plain `N * hop` conversion. `--json` wraps the number as `{"samples": N}` or `{"frames": N}` rather than printing a bare array.

```bash
sonare frames-to-samples --frames 10              # 6144
sonare frames-to-samples --frames 10 --n-fft 0    # 5120
sonare samples-to-frames --samples 6144 --json    # {"frames": 10}
```

## Decibel conversion

| Command | Result | Options |
|---------|--------|---------|
| `sonare power-to-db --values 1,0.1` | `10 * log10(max(v, amin)) - 10 * log10(max(ref, amin))`, then floored at `max - top_db` | `--ref` (1.0), `--amin` (1e-10), `--top-db` (80.0) |
| `sonare amplitude-to-db --values 1,0.1` | The same on squared input, so `20 * log10` of the amplitude | `--ref` (1.0), `--amin` (1e-5), `--top-db` (80.0) |
| `sonare db-to-power --values 0,-10` | `ref * 10^(v / 10)` | `--ref` (1.0) |
| `sonare db-to-amplitude --values 0,-20` | `ref * 10^(v / 20)` | `--ref` (1.0) |

A zero or negative `--ref` uses the largest magnitude in the list as the reference, so the loudest entry comes out as 0 dB. A negative `--top-db` turns the floor off, and `--amin` must be positive. The two `--amin` defaults differ on purpose: the amplitude floor is the square root of the power floor, which is what makes `amplitude-to-db` agree with `power-to-db` on squared values.

```bash
sonare amplitude-to-db --values 1,0.1          # 0,-20
sonare db-to-amplitude --values 0,-20 --json   # [1, 0.1]
```

## Framing, padding, and length

| Command | Result | Options |
|---------|--------|---------|
| `sonare frame-signal --values ... --frame-length 4 --hop-length 2` | Overlapping frames of the list, flattened row by row: frame `i` is entries `[i * L, (i + 1) * L)` | `--frame-length` (the `--n-fft` value, 2048), `--hop-length` (512) |
| `sonare pad-center --values 1,2,3 --size 7` | The list centred in `size` entries, with `(size - n) / 2` of padding on the left | `--size` (**required**, at least the list length), `--pad-value` (0.0) |
| `sonare fix-length --values 1,2,3 --size 5` | Exactly `size` entries: cropped from the right, or padded on the right | `--size` (**required**), `--pad-value` (0.0) |
| `sonare fix-frames --values 0,3,3,7 --x-max 6` | Integer frame indices with entries outside `[x-min, x-max]` dropped, the bounds inserted, and duplicates removed | `--x-min` (0), `--x-max` (-1, no upper bound), `--no-pad` (do not insert the bounds) |

`frame-signal` follows `librosa.util.frame`: the frame count is `floor((n - L) / hop) + 1`, and a list shorter than the frame length yields nothing. Its `--json` is an object, `{"n_frames": N, "frames": [...]}`, rather than the bare array the other helpers print. The default frame length is the CLI's `--n-fft`, so on a short hand-typed list you will always be passing `--frame-length`.

`fix-frames` is the one helper that reads integers, and the one place this CLI departs from librosa: the list must be non-decreasing, a negative entry is refused whenever `--x-min` is not negative, and an empty list is an error rather than being padded to `[x-min]`, because a frame at 0 that no detector produced is indistinguishable from a real one.

```bash
sonare frame-signal --values 1,2,3,4,5,6 --frame-length 4 --hop-length 2 --json
# {"n_frames": 2, "frames": [1, 2, 3, 4, 3, 4, 5, 6]}
sonare pad-center --values 1,2,3 --size 7        # 0,0,1,2,3,0,0
sonare fix-length --values 1,2,3 --size 5        # 1,2,3,0,0
sonare fix-frames --values 0,3,3,7 --x-max 6     # 0,3,6
```

## Peak picking and normalization

| Command | Result | Options |
|---------|--------|---------|
| `sonare peak-pick --values ...` | Indices of local maxima, as `librosa.util.peak_pick`: `x[i]` is the maximum over `[i - pre_max, i + post_max)`, is at least the mean over `[i - pre_avg, i + post_avg)` plus `delta`, and lies at least `wait` entries after the previous peak | `--pre-max` (1), `--post-max` (1), `--pre-avg` (1), `--post-avg` (1), `--delta` (0.0), `--wait` (0) |
| `sonare vector-normalize --values 3,4 --norm-type 2` | The list divided by its norm | `--norm-type` (0): 0 max-abs, 1 L1, 2 L2, 3 power (sum of squares); `--threshold` (1e-12) |

`peak-pick` prints integer indices, so its `--json` is an integer array. A `--norm-type` outside 0 to 3 is refused as an invalid parameter rather than falling back to the max-abs norm. `--threshold` is the norm below which the list comes back unchanged instead of being divided by something near zero, which is librosa's `fill=None` behaviour.

```bash
sonare vector-normalize --values 3,4 --norm-type 2   # 0.6,0.8
```

## tune-to-midi

`tune-to-midi` corrects a recorded take against the melody a Standard MIDI File carries. It tracks the take's pitch with pYIN at the library defaults, segments it into notes, gives each note the pitch shift of the reference note it overlaps longest, and renders the result. The rule that lines notes up with targets is the one [`noteTargetsFromSmf` and `assignNoteTargets`](./project-editing-midi.md#an-smf-as-a-reference-melody-note-targets) follow; this command is that pair from a shell. It is on both CLIs and takes the take as its file argument.

```bash
sonare tune-to-midi take.wav --reference-smf melody.mid -o tuned.wav
sonare tune-to-midi take.wav --reference-smf song.mid --track 2 --unmatched-policy mute -o tuned.wav --json
```

| Option | Default | Description |
|--------|---------|-------------|
| `--reference-smf FILE` | **required** | The SMF carrying the reference melody |
| `--track N` | 0 | Which MIDI-bearing track of the file is the melody; an index with no such track is refused before any analysis runs |
| `--unmatched-policy` | `leave` | A note no target reaches: `leave` renders it as recorded, `mute` silences its span, `nearest` takes the target nearest in time, however far away |
| `--min-overlap-ratio` | 0.5 | Fraction of a note that must overlap a target for the target to count, 0 to 1 |
| `--max-correction-semitones` | 12 | The assigned shift saturates here rather than being refused |
| `-o` | **required** | The corrected WAV |

`--json` reports `output`, `assigned_count`, `note_count`, `length`, `sample_rate`, and `duration`. An `assigned_count` of zero is a result rather than an error: it means the reference did not line up with the take, which is worth checking before trusting the file.

## system-info

`system-info` prints what the machine offers and what this build's parallel scheduler will do with it: the logical and physical core counts, total and available memory, and whether parallel execution is enabled, with the worker count and strategy it derived from the core count. Native CLI only, and it takes no arguments.

```bash
sonare system-info
sonare system-info --json
```

**Output:**
```
System Information
  CPU Cores: 8 logical, 4 physical
  Memory: 16.0 GB total, 9.3 GB available

Parallel Configuration
  Parallel Enabled: yes
  Workers: 6
  Strategy: aggressive_parallel
```

The strategy is one of `sequential_only`, `conservative_parallel`, `balanced_parallel`, and `aggressive_parallel`, picked at 1, 2, 4, and 8 logical cores. The `--json` form nests the same values under `cpu`, `memory`, and `parallel`. Run it when a batch is slower than expected, or before deciding how many `sonare` processes to run side by side; [`doctor`](./cli.md#doctor) is the command for what the build can decode and which feature groups were compiled in.
