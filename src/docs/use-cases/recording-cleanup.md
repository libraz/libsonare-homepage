---
title: Clean Up a Batch of Recordings
description: A folder of rough takes — clipped, hummy, clicky, padded with dead air — measured, repaired only where the evidence says to, and trimmed, with a JSON record of what was found and what was done to each one.
---

# Clean Up a Batch of Recordings

A folder of rough takes lands on your drive: some clipped because the gain was too hot, some carrying 50 or 60 Hz mains hum from a bad ground, most with a second or two of dead air at both ends. You do not know, file by file, which problem which take actually has. This page measures that first, repairs only the stages the measurement justifies, and writes a record of both.

The job is **not** "run declip on everything". A repair stage that runs when nothing was wrong costs quality for nothing — declip resynthesizes samples that were never clipped, dehum notches out real musical content sitting at the mains frequency. The point of the repair assistant is that it declines a stage the evidence does not call for, and `--explain` is how you check that it actually did.

## What You Will Learn

By the end of this page you should be able to:

- measure exactly what is wrong with a take before touching it, and read the reason behind every repair stage the assistant chooses — or declines to run;
- script `repair`, `trim-silence`, and `declip` into a per-file batch that writes both a clean take and a JSON record of what was found and what was done;
- tell apart three ways of driving `repair` — measure-and-choose, a named preset, a field override — and know which situation each one is for;
- treat a repair as the lossy trade it is, and recognize when chasing a measurement to zero costs more than it is worth.

## The whole job

Everything below is this script. Run it against a folder of takes, then read on for what each stage is doing and why.

```bash
#!/usr/bin/env bash
set -euo pipefail

mkdir -p clean reports

for raw in raw/*.wav; do
  name="$(basename "${raw%.wav}")"

  # 1. Measure the damage. Writes nothing -- safe to run on every take.
  sonare repair "$raw" --detect --json > "reports/${name}.before.json"

  # 2. Let the assistant choose only the stages step 1's evidence calls for.
  sonare repair "$raw" -o "clean/${name}.wav" --explain --json > "reports/${name}.repair.json"

  # 3. Trim the dead air every take was padded with.
  sonare trim-silence "clean/${name}.wav" -o "clean/${name}.trimmed.wav" --json \
    > "reports/${name}.trim.json"

  # 4. Measure again. This is the verification step, not a separate audit.
  sonare repair "clean/${name}.trimmed.wav" --detect --json > "reports/${name}.after.json"

  # 5. Fold the four records into one per-file report.
  python3 - "$name" <<'PY'
import json
import sys

name = sys.argv[1]
before = json.load(open(f"reports/{name}.before.json"))["defects"]
repair = json.load(open(f"reports/{name}.repair.json"))
trim = json.load(open(f"reports/{name}.trim.json"))
after = json.load(open(f"reports/{name}.after.json"))["defects"]

record = {
    "file": name,
    "detect_before": before,
    "stages_chosen": repair["stages"],
    "reasons": repair.get("explanation", []),
    "output_gain_db": repair["output_gain_db"],
    "trimmed_duration": trim["duration"],
    "detect_after": after,
}
with open(f"reports/{name}.json", "w") as f:
    json.dump(record, f, indent=2)
PY

  rm -f "reports/${name}.before.json" "reports/${name}.repair.json" \
        "reports/${name}.trim.json" "reports/${name}.after.json"
done
```

Run against two takes — one hard-clipped with mains hum, one only hummy and clicky — this prints:

```text
reports/take-01.json  ->  repair.declip, repair.declick, repair.decrackle, repair.dehum
reports/take-02.json  ->  repair.declick, repair.decrackle, repair.dehum
```

`take-02` has no clipping, and `declip` is absent from its stage list. That single line is the entire argument for measuring first: the assistant looked at two different takes and repaired two different things.

<FlowDiagram
  title="Batch cleanup pipeline"
  direction="LR"
  :nodes="[
    { id: 'raw', label: 'Raw takes (WAV)', col: 0, row: 0, variant: 'muted' },
    { id: 'detect1', label: 'repair --detect', col: 1, row: 0, variant: 'accent' },
    { id: 'choose', label: 'Assistant picks stages', col: 2, row: 0, variant: 'decision' },
    { id: 'repair', label: 'repair --explain', col: 3, row: 0, variant: 'accent' },
    { id: 'clean', label: 'Repaired take', col: 4, row: 0 },
    { id: 'trim', label: 'trim-silence', col: 5, row: 0, variant: 'accent' },
    { id: 'trimmed', label: 'Clean take', col: 6, row: 0, variant: 'success' },
    { id: 'detect2', label: 'repair --detect (verify)', col: 6, row: 1, variant: 'warning' },
    { id: 'record', label: 'Per-file record.json', col: 7, row: 1, variant: 'muted' }
  ]"
  :edges="[
    { from: 'raw', to: 'detect1' },
    { from: 'detect1', to: 'choose' },
    { from: 'raw', to: 'repair', label: 'audio', style: 'dashed' },
    { from: 'choose', to: 'repair' },
    { from: 'repair', to: 'clean' },
    { from: 'clean', to: 'trim' },
    { from: 'trim', to: 'trimmed' },
    { from: 'trimmed', to: 'detect2', style: 'dashed' },
    { from: 'detect1', to: 'record', style: 'dashed' },
    { from: 'detect2', to: 'record', style: 'dashed' }
  ]"
  caption="The detector runs twice on every take: once to decide what needs fixing, once to prove the fix worked."
/>

## Step 1 — Measure before touching anything

```bash
sonare repair take-raw.wav --detect --json
```

`--detect` measures and reports; it writes no file, and `-o` is not even accepted alongside it. That makes it free to run on every take in a folder before you decide anything. The full option set is in [CLI Reference — repair](../cli.md#repair).

```json
{
  "mode": "detect",
  "defects": {
    "click_count": 1,
    "click_rejected": 4989,
    "crackle_per_second": 0.759,
    "clip_sample_fraction": 0.1139,
    "clip_run_count": 3137,
    "clip_longest_run_samples": 45,
    "clip_flat_level": 0.99997,
    "noise_floor_dbfs": -120.0,
    "hum_peak_found": true,
    "hum_fundamental_hz": 50.0,
    "hum_fundamental_prominence": 18.62,
    "hum_harmonics": 2,
    "late_decay_ratio_db": -4.86
  }
}
```

Four numbers already tell most of the story on this take: `clip_sample_fraction` says 11.4% of the samples are clipped, `clip_flat_level` near 1.0 says they are pinned flat rather than merely loud, a mains harmonic sits at exactly 50 Hz with 18.6 dB of prominence, and `crackle_per_second` says the noise floor is not just quiet hiss but broadband crackle. `click_count` is only 1 — `click_rejected` (4989) is how many impulsive-looking events the detector looked at and decided were not clicks, which is worth knowing before you conclude the detector missed something.

## Step 2 — Let the assistant choose

```bash
sonare repair take-raw.wav -o take-clean.wav --explain --json
```

```json
{
  "mode": "assistant",
  "stages": ["repair.declip", "repair.declick", "repair.decrackle", "repair.dehum"],
  "explanation": [
    "declip: runs of samples sit pinned at one level",
    "declick: impulsive runs stand out from their neighbours",
    "decrackle: samples depart from the local median",
    "dehum: a prominent harmonic series sits on a mains frequency"
  ],
  "output": "take-clean.wav",
  "output_gain_db": -1.87
}
```

Every stage names the exact evidence that triggered it, in the same vocabulary the detector used. `denoise` and `dereverb` are absent — this take's `noise_floor_dbfs` and `late_decay_ratio_db` did not call for them, so they never ran. `output_gain_db` is not a repair stage; declip rebuilds the peaks a clipper cut off, which routinely pushes the reconstructed waveform past full scale, so the whole file is fitted with one gain afterwards rather than clamped sample by sample.

::: tip `--explain` and `--detect` do not combine
`--detect` runs no repair stage, so there is nothing to explain; passing both is rejected as an invalid parameter. Drop `--detect` to see the reasoning, or drop `--explain` to just get the numbers.
:::

## Step 3 — Trim the dead air

```bash
sonare trim-silence take-clean.wav -o take-trimmed.wav --json
```

```json
{"length": 350528, "duration": 7.303, "threshold_db": -60.0, "n_fft": 2048, "hop_length": 512}
```

The take was 7.9 seconds with padding on both ends; the trimmed file is 7.303 seconds, so roughly 0.6 seconds of dead air came off. `--threshold-db` (default −60 dB) is the level below which a frame counts as silence; `--top-db` is also accepted if you would rather express the same cut relative to the file's own peak. Trimming has nothing to do with repair and runs whether or not the take needed one — it is listed here in pipeline order, after repair, so it trims quiet padding rather than a padding-shaped clipped edge.

## Step 4 — Cut several takes at the silence they share

Sometimes the problem is not one bad take but several decent ones: three attempts at the same phrase, each entering and trailing off at a slightly different point, and you want to compare them slice by slice. Running `trim-silence` from Step 3 on each take separately does not help here — every take gets its own cut points, so the boundaries land in a different place on each file, and the "same" slice from three takes is really three different slices.

[`split-silence`](../cli-commands.md#split-silence) takes more than one file at once for exactly this job. The first take is the positional argument; every other take of the same part is added with a repeatable `--input`:

```bash
sonare split-silence take1.wav --json
```

```json
[{"start_sample": 28160, "end_sample": 116224}, {"start_sample": 153088, "end_sample": 241152}, {"start_sample": 287232, "end_sample": 394752}]
```

One take alone reports three non-silent stretches, one per phrase — the same shape `trim-silence` finds, expressed as sample ranges rather than a single trimmed length. Add the other two takes of the same part:

```bash
sonare split-silence take1.wav --input take2.wav --input take3.wav --json
```

```json
[{"start_sample": 23040, "end_sample": 121344}, {"start_sample": 147968, "end_sample": 246272}, {"start_sample": 282624, "end_sample": 399872}]
```

The first interval widens from 28160–116224 to 23040–121344. That widening is the point of the feature: the reported intervals are the **union** of each take's own non-silent stretches, merged where they touch, so a cut lands only where *every* take is quiet — and mid-phrase in none of them. Cut each take to its own intervals and one take's early entrance becomes a clipped attack in another take's slice; cut all three to the union instead and every take loses exactly the silence they all share, nothing more.

`split-silence` never accepts `-o`; it only reports intervals, and passing `--output` exits with a usage error. `--write-takes PREFIX` is how the shared intervals become audio, one file per take per interval, named `PREFIX{take:02d}_{interval:03d}.wav` with both counters 1-based:

```bash
sonare split-silence take1.wav --input take2.wav --input take3.wav --write-takes comp --json
```

Three takes and three shared intervals write nine files, `comp01_001.wav` through `comp03_003.wav`. Within one interval the files come out the same length across takes — 98304 samples for interval 1, on every take — even though the takes themselves do not line up sample-for-sample. A take that ends before the union's boundary is padded with silence for the rest of that stretch rather than sliced shorter, which is exactly what lets `comp01_001.wav`, `comp02_001.wav`, and `comp03_001.wav` sit side by side: same start, same length, three different performances of the same phrase.

What this does **not** do: it does not choose the best take, it does not crossfade between them, and it does not correct timing drift inside a phrase — a take that rushes or drags in the middle still rushes or drags after slicing. It hands you aligned slices to judge, not a finished comp.

Every take must share a sample rate; the check runs before anything else:

```bash
sonare split-silence take1.wav --input take2.wav --input t3_44.wav --json
# Error: take sample rate differs: t3_44.wav is 44100 Hz, the first take is 48000 Hz
```

That is a usage-level mismatch (exit code 3), the same class as an unrecognized `--params` key elsewhere on this page.

::: warning `--top-db` is measured from each take's own peak, not an absolute level
A noisier take finds less silence than a clean one at the same `--top-db`, because the threshold sits relative to that take's own peak rather than a fixed dBFS floor. On `take1.wav`, a clean noise floor of about −99.9 dBFS (from `repair --detect`) leaves the three phrases with clear gaps between them. Raising that floor to about −69.1 dBFS — the file otherwise unchanged — collapsed the same take's result to a single interval spanning nearly the whole file: the threshold no longer found anywhere quiet enough to call silence. There is no fixed dB of headroom that guarantees a clean split; check `noise_floor_dbfs` first, and send a hot take through [Step 2](#step-2-—-let-the-assistant-choose)'s repair assistant before comping rather than lowering `--top-db` to compensate.
:::

## Step 5 — Verify: run `--detect` again

The detector is also the acceptance test. Re-run it on the result and compare:

```bash
sonare repair take-clean.wav --detect --json
```

| Field | Before | After |
|---|---|---|
| `clip_sample_fraction` | 0.1139 | 0.000227 |
| `click_count` | 1 | 0 |
| `crackle_per_second` | 0.759 | 0 |
| `hum_fundamental_prominence` | 18.62 | 7.94 |
| `hum_harmonics` | 2 | 1 |
| `noise_floor_dbfs` | −120.0 | −101.5 |

Clipping, clicks, and crackle all clear to (near) zero. Hum prominence drops by more than half but does not reach zero, and `noise_floor_dbfs` actually rises — declip's LPC reconstruction and the two impulsive-repair stages leave a small broadband footprint of their own on samples they touched. Neither number is a bug in the run; they are what an honest repair looks like. The next section shows why chasing the hum number further is usually the wrong move.

::: info The detector is the point
There is no separate "did it work" command. The same `--detect` that decided what to fix is what proves whether fixing it worked, on the same numbers, in the same units.
:::

## Step 6 — When you already know what you want

Two escapes exist for when you do not want the assistant deciding.

**A named preset** skips measurement and takes the repair stages straight from a mastering preset's own configuration — `sonare mastering-presets --json` lists all thirty names, including several tuned for damaged, non-musical sources: `voiceMemo`, `fieldRecording`, `broadcast`, `podcast`. `--preset` and `--explain` do not combine either, for the same reason as `--detect`: a preset's stages are named directly, not chosen by measurement, so there is nothing for `--explain` to report.

```bash
sonare repair take-raw.wav --preset voiceMemo -o take-voicememo.wav --json
```

```json
{"mode": "preset", "preset": "voiceMemo", "stages": ["repair.declip", "repair.denoise", "repair.dereverb"]}
```

`voiceMemo` runs declip, denoise, and dereverb on this take — never dehum, because that is simply not a stage the preset carries, regardless of what the file measures. Re-detecting the result confirms it: `hum_fundamental_prominence` comes back at 20.5, essentially unchanged from the original 18.6. A preset is the right tool when you already know the source (a phone voice memo, a field recording) and want the same fixed treatment every time; it is the wrong tool when you want the file's own evidence to decide, which is what `--explain` on the measure-and-choose path is for.

**A field override** changes one parameter of whichever path you took, via `--params repair.<stage>.<field>=value,...`. Pushing the assistant's own dehum stage harder illustrates the trade-off from Step 5 directly:

```bash
sonare repair take-raw.wav -o take-clean-harm.wav --params repair.dehum.harmonics=6 --json
```

Raising the harmonic count the notch chases from the assistant's own 2 to 6 barely moves the residual: `hum_fundamental_prominence` comes back at 7.88 against 7.94 for the default run, a difference smaller than run-to-run measurement noise. What it does move is `output_gain_db`, which drops to −3.4 dB against −1.87 dB — nearly twice the gain reduction, meaning nearly twice as much of the waveform was reshaped to get essentially the same result. This is the shape every "chase it to zero" instinct takes with `dehum`: diminishing residual, real and measurable cost. The [Repair and Input Controls](../glossary/mastering/repair.md) glossary page makes the same point about denoise — a little noise left in beats smeared drums and watery artifacts, and the same restraint applies to a notch filter eating into the fundamental it shares with real musical content.

## Step 7 — The single-purpose escape hatch: `declip`

`repair`'s own declip stage is not independently tunable beyond `--params`. When it is too conservative or too aggressive for a specific take, `declip` is the standalone command with its own explicit controls:

```bash
sonare declip take-raw.wav -o take-declip-only.wav --clip-threshold 0.95 --json
```

```json
{"clip_threshold": 0.95, "lpc_order": 36, "iterations": 2, "lpc_blend": 0.65, "output": "take-declip-only.wav"}
```

`--clip-threshold` is how close to full scale a sample must sit before it counts as clipped (the repair assistant reaches for a more conservative default); `--lpc-order`, `--iterations`, and `--lpc-blend` control how aggressively the linear-predictive reconstruction rebuilds the missing waveform versus how much of the raw (clipped) signal it blends back in. Reach for this only after `--detect` shows declip is the one stage worth hand-tuning — it repairs nothing else.

## Step 8 — Stereo takes

Everything above ran on a mono take. `repair --detect` (and the repair chain itself) downmixes a stereo file to mono and says so on stderr:

```text
warning: 2-channel input is downmixed to mono by this CLI command; use the stereo library API for channel-preserving processing
```

::: warning A stereo damage report is still a valid damage report
The downmix warning means the *numbers* describe the summed signal, not that they are wrong to act on — clipping, clicks, hum, and crackle detected on the downmix are real defects in the stereo file too. What changes is the *repair*: fixing a stereo deliverable in place, channel by channel, needs the stereo entry points in the [Python API](../python-api.md) rather than this CLI path, which only ever writes a mono result.
:::

## Running it in a script

Every command on this page takes `--json`, and every failure exits with a [documented code](../cli.md#exit-codes): 3 for an invalid combination of flags (`--detect` with `--explain`, a missing `-o`) or an unrecognized parameter key, 4 for a file that does not exist. `set -euo pipefail` at the top of the batch script is therefore enough to stop the run on the take that actually broke, rather than silently skipping it and reporting a clean batch.

## Where to go next

- The takes are clean and you are ready to build a mix from them — [Mix and Master a Song in the CLI](./cli-mix-and-master.md).
- You want the repair stages and their fields cataloged in one place — [Mastering Processors](../mastering-processors.md).
- You are repairing a stereo deliverable rather than a mono take — the stereo entry points in the [Python API](../python-api.md).
