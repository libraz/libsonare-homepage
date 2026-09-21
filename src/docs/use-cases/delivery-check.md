---
title: Gate a Delivery in CI
description: Turn "does this master pass?" into a script that exits non-zero when it does not, and that runs on every commit.
---

# Gate a Delivery in CI

A master is about to go out the door. Somewhere between "sounds good to me" and the platform's own ingestion check, someone has to answer a boring question with a yes or no: does this file meet the spec. This page turns that question into a script — one that a person can run before hitting send, and that a CI job can run on every commit without anyone remembering to ask it.

The job is **not** to re-measure loudness from scratch. It is to read the numbers the mastering step already took, add the format and damage checks that step does not cover, and fail loudly the moment any of them misses the target.

## What You Will Learn

By the end of this page you should be able to:

- write a gate script that checks format, damage, loudness, and true peak against a delivery spec, and exits non-zero the moment one of them fails;
- pick a threshold for each check instead of guessing one;
- read loudness and true peak from the mastering report on a stereo file, and know why a separate `lufs` or `mastering-streaming` call would mislead the gate;
- wire the script into a CI job that runs on every commit.

## The gate script

This assumes the mastering step already ran and left both files behind: the master itself, and the `--report` it wrote alongside it. See [Mix and Master a Song in the CLI](./cli-mix-and-master.md) for that step.

```bash
#!/usr/bin/env bash
set -euo pipefail

MASTER="${1:-master.wav}"
REPORT="${2:-report.json}"

WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

# Delivery contract for this target. Change these, not the checks below.
export GATE_SAMPLE_RATE=48000
export GATE_TARGET_LUFS=-14.0
export GATE_LUFS_TOLERANCE=0.5
export GATE_CEILING_DBTP=-1.0

# 1. Format: the file that ships is the file you think it is.
sonare info "$MASTER" --json 2>/dev/null > "$WORKDIR/info.json"

# 2. Damage: --detect writes nothing, so it is free to run on every delivery.
sonare repair "$MASTER" --detect --json 2>/dev/null > "$WORKDIR/defects.json"

python3 - "$REPORT" "$WORKDIR/info.json" "$WORKDIR/defects.json" <<'PY'
import json
import os
import sys

report_path, info_path, defects_path = sys.argv[1], sys.argv[2], sys.argv[3]
target_lufs = float(os.environ["GATE_TARGET_LUFS"])
tolerance = float(os.environ["GATE_LUFS_TOLERANCE"])
ceiling_dbtp = float(os.environ["GATE_CEILING_DBTP"])
sample_rate = int(os.environ["GATE_SAMPLE_RATE"])

failures = []

info = json.load(open(info_path))
if info["channels"] != 2:
    failures.append(f"channels = {info['channels']} (expected 2)")
if info["sample_rate"] != sample_rate:
    failures.append(f"sample_rate = {info['sample_rate']} (expected {sample_rate})")
if info["duration"] < 1.0:
    failures.append(f"duration = {info['duration']:.3f}s, file looks truncated")

defects = json.load(open(defects_path))["defects"]
if defects["clip_sample_fraction"] > 0.0:
    failures.append(f"clipping: {defects['clip_sample_fraction'] * 100:.3f}% of samples")
if defects["click_per_second"] > 0.2:
    failures.append(f"clicks: {defects['click_per_second']:.2f}/s")
if defects["crackle_per_second"] > 1.0:
    failures.append(f"crackle: {defects['crackle_per_second']:.2f}/s")
if defects["hum_peak_found"] and defects["hum_fundamental_prominence"] > 6.0:
    failures.append(
        f"mains hum at {defects['hum_fundamental_hz']:.0f} Hz, "
        f"{defects['hum_fundamental_prominence']:.1f} dB prominence"
    )

# Loudness and true peak come from the mastering report -- the stereo
# measurement the chain itself took -- not from a separate `lufs` call.
after = json.load(open(report_path))["after"]
lufs_gap = after["integrated_lufs"] - target_lufs
if abs(lufs_gap) > tolerance:
    failures.append(
        f"integrated_lufs = {after['integrated_lufs']:.2f} "
        f"({lufs_gap:+.2f} LU from {target_lufs} target)"
    )
if after["true_peak_dbtp"] > ceiling_dbtp:
    failures.append(f"true_peak_dbtp = {after['true_peak_dbtp']:.2f} (ceiling {ceiling_dbtp})")

if failures:
    print("DELIVERY GATE: FAIL")
    for line in failures:
        print(f"  - {line}")
    sys.exit(1)

print("DELIVERY GATE: PASS")
print(
    f"  {info['sample_rate']} Hz, {info['channels']}ch, "
    f"{info['duration']:.2f}s, {after['integrated_lufs']:.2f} LUFS, "
    f"{after['true_peak_dbtp']:.2f} dBTP"
)
PY
```

Run it against the mastered take from the mixing walkthrough:

```bash
./gate.sh master.wav report.json
```

```text
DELIVERY GATE: FAIL
  - true_peak_dbtp = -0.95 (ceiling -1.0)
```

That is a real failure, not a rounding artifact: `-0.95` is *louder* than `-1.0`, and the gate treats the sign correctly even where eyeballing the two numbers tempts you not to. The fix belongs in the mastering step, not in this script — rerun it with a stricter `--ceiling-db`, or, if the actual delivery target tolerates more headroom loss, pick the `-2 dBTP` codec-safety ceiling from [Delivery Targets](../glossary/mastering/delivery-targets.md) and update `GATE_CEILING_DBTP` to match. What the gate must not do is have its ceiling loosened until this specific file happens to pass.

<FlowDiagram
  title="Gate a delivery"
  direction="LR"
  :nodes="[
    { id: 'master', label: 'master.wav', col: 0, row: 0, variant: 'muted' },
    { id: 'report', label: 'report.json', col: 0, row: 2, variant: 'muted' },
    { id: 'format', label: 'sonare info', col: 1, row: 0, variant: 'default' },
    { id: 'damage', label: 'repair --detect', col: 1, row: 1, variant: 'warning' },
    { id: 'loud', label: 'loudness + true peak', col: 1, row: 2, variant: 'default' },
    { id: 'gate', label: 'All checks pass?', col: 2, row: 1, variant: 'decision' },
    { id: 'pass', label: 'exit 0 -- ship it', col: 3, row: 0, variant: 'success' },
    { id: 'fail', label: 'exit 1, print failures', col: 3, row: 2, variant: 'error' }
  ]"
  :edges="[
    { from: 'master', to: 'format' },
    { from: 'master', to: 'damage' },
    { from: 'report', to: 'loud' },
    { from: 'format', to: 'gate' },
    { from: 'damage', to: 'gate' },
    { from: 'loud', to: 'gate' },
    { from: 'gate', to: 'pass', label: 'yes' },
    { from: 'gate', to: 'fail', label: 'no' }
  ]"
  caption="Format and damage come from the master file itself. Loudness and true peak come from the stereo mastering report, not from a separate lufs call."
/>

## What each check does, and how to set its threshold

### Format: `sonare info`

```bash
sonare info master.wav --json
```

```json
{"path": "master.wav", "duration": 10.303104166666667, "sample_rate": 48000,
 "channels": 2, "samples": 494549, "peak_db": -1.205, "rms_db": -18.57}
```

`channels` and `sample_rate` are the cheapest possible check: they catch a render that came off a broken pipeline stage before you spend any time on the numbers that actually describe the sound. `channels` is fixed at `2` because this whole page assumes a stereo delivery; `GATE_SAMPLE_RATE` is a variable because that part of the spec genuinely differs by project. `duration < 1.0` catches a truncated file — an empty or aborted render still exits 0 from most tools further up the pipeline, so this is often the only check that notices.

### Damage: `repair --detect`

```bash
sonare repair master.wav --detect --json
```

```json
{"mode": "detect", "defects": {
  "clip_sample_fraction": 0.0, "clip_run_count": 0,
  "click_count": 1, "click_per_second": 0.097,
  "crackle_per_second": 0.485, "noise_floor_dbfs": -94.97,
  "hum_peak_found": true, "hum_fundamental_hz": 60.0,
  "hum_fundamental_prominence": 2.19
}}
```

`--detect` only measures — it writes nothing, so it costs nothing to run on every commit. Set `clip_sample_fraction`'s threshold to `0.0`: a finished master should never clip, because the limiter's whole job was to prevent it. `click_per_second` and `crackle_per_second` need real headroom instead, because the detector reports a nonzero baseline on ordinary program material — this master's own clean take measured `0.097` and `0.485` per second respectively, so `0.2` and `1.0` catch a genuinely damaged file without failing on normal density.

`hum_peak_found` is a boolean by itself, and mains hum below the noise floor is common and inaudible — the gate should not fail on its mere presence. `hum_fundamental_prominence` is what turns it into a real check: this master's incidental 60 Hz peak sits at `2.19` dB of prominence, while a genuinely damaged take in the same session measured `18.6` dB at 50 Hz. `6.0` dB sits between the two — high enough to ignore an inaudible peak, low enough to catch an audible one.

### Loudness and true peak: the mastering report

```json
{"before": {"integrated_lufs": -19.61, "true_peak_dbtp": -6.13},
 "after":  {"integrated_lufs": -14.11, "true_peak_dbtp": -0.95}}
```

Both numbers come from `after` in the `--report` the mastering step wrote — the measurement the chain itself took on the full stereo pair. `GATE_LUFS_TOLERANCE` should match how tightly the platform enforces its target; `±0.5` LU is generous for a streaming target and tight for a broadcast one. `GATE_CEILING_DBTP` should be the ceiling the mastering step itself was told to hit — the assistant already treats that value as a hard constraint, so a report that exceeds it means something upstream did not respect its own setting, which is worth failing loudly on regardless of the platform.

If `report.json` also carries `loudness_target_limited: true` alongside a large `max_gain_reduction_db`, the mix ran out of headroom before the master reached its loudness target — that is a mix problem the gate cannot fix by adjusting a threshold. See "Believe the right number" in [Mix and Master a Song in the CLI](./cli-mix-and-master.md#step-6-—-believe-the-right-number).

::: danger Do not read loudness or true peak from `lufs` or `mastering-streaming` on a stereo file
Both commands downmix a stereo input to mono before measuring, and warn on stderr when they do. [ITU-R BS.1770](../glossary/lufs.md) sums channel power across the pair, so the fold reads roughly 3 dB below the stereo programme — enough to change a pass into a fail, or the reverse.

```bash
sonare lufs master.wav --json
# warning: 2-channel input is downmixed to mono by this CLI command
# {"integrated_lufs": -17.57, ...}          <- the mono fold
# report.json after.integrated_lufs = -14.11 <- the stereo master
```

The same fold distorts a Spotify-target preview:

```bash
sonare mastering-streaming master.wav --json
```

```json
{"platforms": [
  {"name": "Spotify", "integrated_lufs": -17.57, "normalization_gain_db": 3.57,
   "true_peak_db": -1.21, "ceiling_risk": true},
  /* Apple Music, YouTube -- same integrated_lufs, each platform's own gain and risk */
]}
```

Applying that gain to the fold's own peak reading projects to `+2.37` dBTP — 3.37 dB past the `-1.0` dBTP ceiling, which reads as an alarming failure. Redo the same arithmetic with the report's real stereo numbers (`-14.11` LUFS, `-0.95` dBTP) and the required gain drops to about `+0.1` dB, putting the projected peak at `-0.84` dBTP — still over the ceiling, but by `0.16` dB instead of `3.37`. The fold does not invent the risk here; it exaggerates a small, real overage into one that looks twenty times worse than it is. On a mono deliverable there is no fold to correct for, and `lufs` / `mastering-streaming` read the file directly — see `take-clean.wav` below.

```bash
sonare lufs take-clean.wav --json
# {"integrated_lufs": -6.0630, ...}
sonare mastering-profile take-clean.wav --json
# {"loudness": {"integrated_lufs": -6.0630, ...}, ...}
```

Reach for `mastering-streaming` directly when the deliverable is mono, or as a cross-check once you have applied this correction yourself. For stereo-accurate metering outside the mastering report, use the stereo entry points in the [Python API](../python-api.md) — `mastering_streaming_preview_stereo` and its siblings measure both channels instead of a downmix.
:::

`mastering-streaming` also takes your own delivery spec instead of the three built-in platforms. `platforms.json` here holds:

```json
[{"name": "Spotify", "targetLufs": -14, "ceilingDb": -1},
 {"name": "Apple Music", "targetLufs": -16, "ceilingDb": -1}]
```

```bash
sonare mastering-streaming master.wav --platforms-file platforms.json --json
```

```json
{"platforms": [
  {"name": "Spotify", "integrated_lufs": -17.57, "normalization_gain_db": 3.57, "true_peak_db": -1.21, "ceiling_risk": true},
  {"name": "Apple Music", "integrated_lufs": -17.57, "normalization_gain_db": 1.57, "true_peak_db": -1.21, "ceiling_risk": true}
]}
```

`--platforms` takes the same array inline for a one-off check instead of a file. Point either one at the actual numbers in your delivery contract, on a mono file or with the correction above applied, rather than trusting the three defaults to match the platform you are shipping to.

### If the delivery includes a project document

A stem or DAW-interchange delivery often ships a project file alongside the audio. `sonare project validate` catches a document that loads but carries diagnostics your target tooling would silently drop information over:

```bash
sonare project validate --in project.json --strict --json
```

```json
{"valid": true, "bytes": 518, "diagnostic_count": 1,
 "diagnostics": ["dropped_automation_lane_target_id: track 1 carried an automation lane with target id 0; lane dropped"]}
```

Without `--strict` this exits `0` — a diagnostic is not fatal on its own, because the loader recovers by dropping the offending piece rather than failing the whole document. `--strict` turns that same recovery into a delivery failure (exit `9`, invalid state), which is the right call when losing an automation lane silently is not acceptable for what you are shipping.

## Running it in CI

```yaml
name: delivery-gate
on: [push]
jobs:
  gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pip install libsonare
      - run: ./gate.sh master.wav report.json
```

Every command the script calls takes `--json`, and every failure exits with a [documented code](../cli.md#exit-codes) rather than a bare `1` — `set -euo pipefail` at the top is what turns that into "the job fails at the stage that actually broke." `SONARE_LEGACY_EXIT=1` is there if a caller further up your pipeline still hardcodes the old all-failures-are-`1` contract; the gate script above does not need it, since it checks its own thresholds rather than branching on a specific exit code.

## Where to go next

- The gate is failing because the master itself needs work, not the delivery contract — go back to [Mix and Master a Song in the CLI](./cli-mix-and-master.md).
- The damage check keeps tripping on the same recording — [Clean Up a Batch of Recordings](./recording-cleanup.md) covers fixing it at the source instead of the delivered file.
- You need this logic inside an application rather than a shell script — the same measurements are in the [Python API](../python-api.md), including the stereo entry points a CI script cannot reach through the CLI.
