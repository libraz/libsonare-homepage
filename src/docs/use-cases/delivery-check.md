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

::: info What you need
- **Install:** `pip install libsonare` (Python 3.11 or later). The script's last check imports the Python package, so it is needed even if you call the native `sonare-cli` for the first two commands (replace `sonare` with `sonare-cli` there).
- **`master.wav` and `report.json`:** the stereo master and the `--report` the mastering step wrote for it. [Mix and Master a Song in the CLI](./cli-mix-and-master.md) produces both; every number on this page comes from that page's script run exactly as written on the stems it writes.
- **The script:** save the block below as `gate.sh` and make it executable with `chmod +x gate.sh`.
:::

This assumes the mastering step already ran and left both files behind: the master itself, and the `--report` it wrote alongside it. See [Mix and Master a Song in the CLI](./cli-mix-and-master.md) for that step.

```bash
#!/usr/bin/env bash
set -euo pipefail

MASTER="${1:-master.wav}"
REPORT="${2:-report.json}"

WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

# Delivery contract for this target. Change these, not the checks below.
# Each one can also be set in the environment for a one-off run.
export GATE_SAMPLE_RATE="${GATE_SAMPLE_RATE:-48000}"
export GATE_TARGET_LUFS="${GATE_TARGET_LUFS:--14.0}"
export GATE_LUFS_TOLERANCE="${GATE_LUFS_TOLERANCE:-0.5}"
export GATE_CEILING_DBTP="${GATE_CEILING_DBTP:--1.0}"
export GATE_MAX_CLICKS_PER_S="${GATE_MAX_CLICKS_PER_S:-0.2}"
export GATE_MAX_CRACKLE_PER_S="${GATE_MAX_CRACKLE_PER_S:-1.0}"

# 1. Format: the file that ships is the file you think it is.
sonare info "$MASTER" --json 2>/dev/null > "$WORKDIR/info.json"

# 2. Damage: --detect writes nothing, so it is free to run on every delivery.
sonare repair "$MASTER" --detect --json 2>/dev/null > "$WORKDIR/defects.json"

python3 - "$MASTER" "$REPORT" "$WORKDIR/info.json" "$WORKDIR/defects.json" <<'PY'
import json
import os
import sys

from libsonare import Audio, mastering_streaming_preview_stereo

master_path, report_path, info_path, defects_path = sys.argv[1:5]
target_lufs = float(os.environ["GATE_TARGET_LUFS"])
tolerance = float(os.environ["GATE_LUFS_TOLERANCE"])
ceiling_dbtp = float(os.environ["GATE_CEILING_DBTP"])
sample_rate = int(os.environ["GATE_SAMPLE_RATE"])
max_clicks = float(os.environ["GATE_MAX_CLICKS_PER_S"])
max_crackle = float(os.environ["GATE_MAX_CRACKLE_PER_S"])

failures = []

info = json.load(open(info_path))
if info["channels"] != 2:
    failures.append(f"channels = {info['channels']} (expected 2)")
if info["sample_rate"] != sample_rate:
    failures.append(f"sample_rate = {info['sample_rate']} (expected {sample_rate})")
if info["duration"] < 1.0:
    failures.append(f"duration = {info['duration']:.3f}s, file looks truncated")

defects = json.load(open(defects_path))["defects"]
if not defects.get("measured"):
    # Too short for the detectors: the output carries no other field.
    failures.append("damage not measured (file too short for the detectors)")
else:
    if defects["clip_sample_fraction"] > 0.0:
        failures.append(f"clipping: {defects['clip_sample_fraction'] * 100:.3f}% of samples")
    if defects["click_per_second"] > max_clicks:
        failures.append(f"clicks: {defects['click_per_second']:.2f}/s")
    if defects["crackle_per_second"] > max_crackle:
        failures.append(f"crackle: {defects['crackle_per_second']:.2f}/s")
    if defects["hum_peak_found"] and defects["hum_fundamental_prominence"] > 6.0:
        failures.append(
            f"mains hum at {defects['hum_fundamental_hz']:.0f} Hz, "
            f"prominence {defects['hum_fundamental_prominence']:.1f}"
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

# The report must describe this file. Re-measure the shipped stereo pair; a
# mismatch means report.json came from another render, or the file changed after it.
if info["channels"] == 2:
    pair = []
    for i in range(2):
        with Audio.from_file_channel(master_path, i) as audio:
            pair.append(audio.data)
    spec = [{"name": "spec", "targetLufs": target_lufs, "ceilingDb": ceiling_dbtp}]
    shipped = json.loads(mastering_streaming_preview_stereo(*pair, sample_rate, spec))["platforms"][0]
    if (abs(shipped["integratedLufs"] - after["integrated_lufs"]) > 0.1
            or abs(shipped["truePeakDb"] - after["true_peak_dbtp"]) > 0.1):
        failures.append(
            f"report does not match the file: file measures {shipped['integratedLufs']:.2f} LUFS, "
            f"{shipped['truePeakDb']:.2f} dBTP"
        )

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
  - clicks: 2.43/s
```

Loudness, true peak and crackle are not on that list; the click check is. It is about the test material, not the master's level. The test bass is a plain square wave, built with `np.sign`, so each of its edges is a true one-sample jump. On the bass stem alone the detector sets those edges aside as part of a regular waveform, and it reads 0 clicks. With the vocal summed on top, some edges no longer look regular and pass the click test: 24 clicks (2.08 per second) in the mixdown, 28 (2.43 per second) in the master. Summing only the bass and vocal stems reproduces it: 25 clicks, and each one the declicker repairs sits on a bass edge. On a real recording a click reading deserves a listen; here it is the stems script's shortcut showing through. The default of `0.2` is for program material (see below), so override it for this one run instead of editing the script:

```bash
GATE_MAX_CLICKS_PER_S=3 ./gate.sh master.wav report.json
```

```text
DELIVERY GATE: PASS
  48000 Hz, 2ch, 11.52s, -14.05 LUFS, -1.00 dBTP
```

The `-1.00` is not luck. The mastering report measures true peak on the limiter's own 4x (BS.1770) detector, and the limiter holds the master at the ceiling on that measure: this report reads `-1.0000004`, so the master sits on the `-1.0` ceiling rather than under it. A miss therefore never shows in the report itself; it shows when the number is compared with a ceiling below the one the master was made for, or when another meter reads the file. Run the same master against a ceiling of `-1.2`:

```bash
GATE_MAX_CLICKS_PER_S=3 GATE_CEILING_DBTP=-1.2 ./gate.sh master.wav report.json
```

```text
DELIVERY GATE: FAIL
  - true_peak_dbtp = -1.00 (ceiling -1.2)
```

`-1.00` is *louder* than `-1.2`, and the gate treats the sign correctly even where eyeballing the two numbers tempts you not to. The fix belongs in the mastering step, not in this script: rerun it with `--ceiling-db -1.2` and the same gate passes at `-1.20 dBTP` (`-14.06` LUFS).

Why master under the spec at all, when the report is exact? Because the spec is met on the limiter's measure and the file is read by other meters. This table measures the same mix mastered at three ceilings, each read by the report, by a 16x meter on the shipped file, and by the 16x meter after a round trip through a lossy encoder (all in dBTP, worst channel):

| Mastered with `--ceiling-db` | Report (4x) | File, 16x | AAC 256 kbit/s, 16x | MP3 320 kbit/s, 16x |
| --- | --- | --- | --- | --- |
| -1.0 (default) | -1.000 | -0.997 | -0.672 | -0.391 |
| -1.2 | -1.200 | -1.197 | -0.785 | -0.655 |
| -2.0 | -2.000 | -1.997 | -1.315 | -1.374 |

Read it against a `-1.0` spec. A finer meter reads this file 0.003 dB higher, so a default-ceiling master that a 16x checker measures fails by `-0.997 > -1.0`; the `-1.2` master clears it with room. A lossy encode moves the peak much further, by about 0.3 dB (AAC) and 0.6 dB (MP3) on the default master, and `-1.2` is still not enough: both decodes land above `-1.0`. Only the `-2 dBTP` codec-safety ceiling from [Delivery Targets](../glossary/mastering/delivery-targets.md) keeps both decodes under it (`-1.315` and `-1.374`), so master to that when the file will be encoded after delivery, and set `GATE_CEILING_DBTP` to match. These are one program and ffmpeg's built-in AAC and LAME encoders; another encoder reads differently, so measure your own delivery path. The table's commands:

```bash
ffmpeg -i master.wav -c:a aac -b:a 256k master.m4a && ffmpeg -i master.m4a master-aac.wav
ffmpeg -i master.wav -c:a libmp3lame -b:a 320k master.mp3 && ffmpeg -i master.mp3 master-mp3.wav
```

```python
import libsonare as sonare
from libsonare import Audio


def true_peak_db(path, oversample):
    peaks = []
    for i in range(Audio.file_channel_count(path)):
        with Audio.from_file_channel(path, i) as audio:
            peaks.append(sonare.metering_true_peak_db(audio.data, audio.sample_rate, oversample))
    return max(peaks)


print(true_peak_db("master.wav", 16))  # -0.9967
```

What the gate must not do is have its ceiling loosened until this specific file happens to pass.

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
{"path": "master.wav", "duration": 11.5219375, "sample_rate": 48000,
 "channels": 2, "samples": 553053, "peak_db": -1.071, "rms_db": -19.44}
```

`channels` and `sample_rate` are the cheapest possible check: they catch a render that came off a broken pipeline stage before you spend any time on the numbers that actually describe the sound. `channels` is fixed at `2` because this whole page assumes a stereo delivery; `GATE_SAMPLE_RATE` is a variable because that part of the spec genuinely differs by project. `duration < 1.0` catches a truncated file — an empty or aborted render still exits 0 from most tools further up the pipeline, so this is often the only check that notices.

### Damage: `repair --detect`

::: code-group

```bash [CLI]
sonare repair master.wav --detect --json
```

```typescript [Node]
import { readFileSync } from 'node:fs';
import { decodeChannels, init, masteringRepairAnalyze } from '@libraz/libsonare';

await init();
// Every channel of the master, measured separately rather than folded.
const { sampleRate, channels } = decodeChannels(new Uint8Array(readFileSync('master.wav')));
const { defects } = masteringRepairAnalyze({ channels, sampleRate });
if (!defects.measured) throw new Error('damage not measured');
console.log(defects.clipSampleFraction, defects.clickPerSecond, defects.cracklePerSecond, defects.humFundamentalProminence);
```

```python [Python]
import libsonare as sonare
from libsonare import Audio

# Every channel of the master, measured separately rather than folded.
channels = []
for i in range(Audio.file_channel_count("master.wav")):
    with Audio.from_file_channel("master.wav", i) as audio:
        channels.append(audio.data)
        sample_rate = audio.sample_rate

defects = sonare.mastering_repair_analyze(channels, sample_rate)["defects"]
if not defects["measured"]:
    raise SystemExit("damage not measured")
print(defects["clipSampleFraction"], defects["clickPerSecond"], defects["cracklePerSecond"], defects["humFundamentalProminence"])
```

:::

```json
{"mode": "detect", "defects": {
  "measured": true,
  "clip_sample_fraction": 0.0, "clip_run_count": 0,
  "click_count": 28, "click_per_second": 2.43,
  "crackle_per_second": 0.0, "noise_floor_dbfs": -120.0,
  "hum_peak_found": false, "hum_fundamental_hz": 51.75,
  "hum_fundamental_prominence": 1.0
}}
```

`--detect` only measures. It writes nothing, so it costs nothing to run on every commit. A file too short for the detectors returns `{"measured": false}` and no other field; the gate treats that as a failure, not as a clean result. The library calls return the same measurements under camelCase names (`clipSampleFraction`, `clickPerSecond`); `hum_peak_found` exists only in the CLI output and means a prominence above 1.0. Set `clip_sample_fraction`'s threshold to `0.0`: a finished master should never clip, because the limiter's whole job was to prevent it. `click_per_second` and `crackle_per_second` need headroom instead, because the detectors can report a nonzero baseline on dense material. The defaults of `0.2` and `1.0` are starting points for ordinary program material, not measurements of a clean master: the four synthetic stems summed measure `2.43` clicks per second on a master with no damage in it, though none of them clicks alone, which is why the walkthrough above raises the click limit for that one run. Crackle reads `0.00` and needs no override. Calibrate both on a few known-good masters of your own genre, and keep them in the contract block so a change is visible in review.

`hum_peak_found` is a boolean by itself, and mains hum below the noise floor is common and inaudible — the gate should not fail on its mere presence. `hum_fundamental_prominence` is what turns it into a real check. It is a plain ratio, not decibels: the energy of the strongest hum candidate over the median of all the candidates tried, so `1.0` means no peak at all. This master reads `hum_peak_found: false` with a prominence of `1.0`: the kick's low-frequency energy is not stationary, so it is not offered as a hum candidate, while the damaged take in [Clean Up a Batch of Recordings](./recording-cleanup.md) measured `24.0` at 50 Hz. A bare stem can still report a candidate with no hum in it (the test bass reads `2.18`, the test guitar `2.15`). `6.0` sits between those and a real hum, high enough to ignore a weak candidate and low enough to catch an audible one. It is stricter than the repair assistant, which only runs dehum above `10` (see [Clean Up a Batch of Recordings](./recording-cleanup.md#step-2-—-let-the-assistant-choose)): a take with a prominence between `6` and `10` fails this gate and would not be touched by the assistant.

::: warning `repair --detect` measures the mono fold of a stereo master
The CLI folds `master.wav` to mono before the damage check, and says so on stderr. A click or clip in one channel only can shrink or cancel in that fold, so a clean CLI report does not prove clean channels. To check each channel, run the library call from the Node or Python tab above on both channels; `masteringRepairAnalyze` and `mastering_repair_analyze` measure every channel they are given.
:::

### Loudness and true peak: the mastering report

```json
{"before": {"integrated_lufs": -20.49, "true_peak_dbtp": -2.10},
 "after":  {"integrated_lufs": -14.05, "true_peak_dbtp": -1.00}}
```

Both numbers come from `after` in the `--report` the mastering step wrote — the measurement the chain itself took on the full stereo pair. `GATE_LUFS_TOLERANCE` should match how tightly the delivery spec states its target. `±0.5` LU is the tolerance EBU R128 allows for file-based broadcast programmes (live programmes get ±1 LU). Streaming platforms publish no tolerance at all: they normalize playback, turning a louder master down, so for a streaming target the tolerance is your own consistency rule, and the ceiling matters more. `GATE_CEILING_DBTP` should be the ceiling the mastering step itself was told to hit — the assistant already treats that value as a hard constraint, so a report that exceeds it means something upstream did not respect its own setting, which is worth failing loudly on regardless of the platform.

The last check makes sure the report belongs to the file. A gate that only reads `report.json` passes a stale report from an earlier render, or a master that was resampled, dithered or trimmed after mastering. The script re-measures the shipped stereo pair with `mastering_streaming_preview_stereo` and fails when its loudness or true peak differs from the report by more than 0.1 dB; a fresh 16-bit render agrees with its own report far more closely than that.

`sonare info` reported `peak_db: -1.071` on this same file (it downmixes to mono first and warns). The loudest stored sample of the right channel is `-1.048`, while that channel's true peak is `-1.000`: the waveform a converter rebuilds between the stored samples rises above every one of them, which is what the demo below draws. That is why the gate reads `true_peak_dbtp` from the report and not `peak_db` from `info`.

<SonareDemo id="inter-sample-peak" />

If `report.json` also carries `loudness_target_limited: true` alongside a large `max_gain_reduction_db`, the mix ran out of headroom before the master reached its loudness target — that is a mix problem the gate cannot fix by adjusting a threshold. See "Believe the right number" in [Mix and Master a Song in the CLI](./cli-mix-and-master.md#step-6-—-believe-the-right-number).

::: danger Do not read loudness or true peak from `lufs` or `mastering-streaming` on a stereo file
Both commands downmix a stereo input to mono before measuring, and warn on stderr when they do. There is no universal fold offset. With `m = (L + R) / 2`, identical channels put the mono fold 3.01 LU below the stereo channel-power reading, uncorrelated equal-power channels put it 6.02 LU below, and opposite polarity can cancel. These are signal-dependent examples; compare the actual stereo programme through the report or stereo APIs. [ITU-R BS.1770](../glossary/lufs.md) sums channel power across the pair, so a fold can change a pass into a fail, or the reverse.

```bash
sonare lufs master.wav --json
# warning: 2-channel input is downmixed to mono by this CLI command
# {"integrated_lufs": -17.36, ...}          <- the mono fold
# report.json after.integrated_lufs = -14.05 <- the stereo master
```

The same fold distorts a Spotify-target preview:

```bash
sonare mastering-streaming master.wav --json
```

```json
{"platforms": [
  {"name": "Spotify", "integrated_lufs": -17.36, "normalization_gain_db": 3.36,
   "true_peak_db": -1.07, "ceiling_risk": true},
  /* Apple Music, YouTube -- same integrated_lufs, each platform's own gain and risk */
]}
```

The sample numbers above are one program, not a correction factor. Applying that gain to the fold's own peak reading projects to `+2.29` dBTP (-1.07 + 3.36) — 3.29 dB past the `-1.0` dBTP ceiling, which reads as an alarming failure. Redo the same arithmetic with the report's real stereo numbers (`-14.05` LUFS, `-1.00` dBTP) and the required gain drops to about `+0.05` dB, putting the projected peak at `-0.95` dBTP — still over the ceiling, but by `0.05` dB instead of `3.29`. The fold does not invent the risk here; it exaggerates a small, real overage into one that looks about seventy times worse than it is. On a mono deliverable there is no fold to correct for, and `lufs` / `mastering-streaming` read the file directly — see `take-clean.wav` below, the mono repaired take from [Clean Up a Batch of Recordings](./recording-cleanup.md).

```bash
sonare lufs take-clean.wav --json
# {"integrated_lufs": -13.6113, ...}
sonare mastering-profile take-clean.wav --json
# {"loudness": {"integrated_lufs": -13.6113, ...}, ...}
```

Reach for `mastering-streaming` directly when the deliverable is mono, or as a cross-check. For stereo-accurate metering outside the mastering report, use the stereo entry points in the [Python API](../python-api.md) — `mastering_streaming_preview_stereo` and its siblings measure both channels instead of a downmix.
:::

How much a fold loses depends on how alike the two channels are. In the demo, two copies of one sine wave at a growing phase offset average to a quieter signal and cancel at 180°.

<SonareDemo id="mono-fold" />

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
  {"name": "Spotify", "integrated_lufs": -17.36, "normalization_gain_db": 3.36, "true_peak_db": -1.07, "ceiling_risk": true},
  {"name": "Apple Music", "integrated_lufs": -17.36, "normalization_gain_db": 1.36, "true_peak_db": -1.07, "ceiling_risk": true}
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
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - run: pip install libsonare
      - run: ./gate.sh master.wav report.json
```

The job checks out the repository, so `gate.sh`, `master.wav` and `report.json` must be committed to it, `gate.sh` with its executable bit (`chmod +x gate.sh` before `git add`). `actions/setup-python` gives the job a Python that `pip install` can write to; the runner's system Python may refuse a global install.

Every command the script calls takes `--json`, and every failure exits with a [documented code](../cli.md#exit-codes) rather than a bare `1` — `set -euo pipefail` at the top is what turns that into "the job fails at the stage that actually broke." `SONARE_LEGACY_EXIT=1` is there if a caller further up your pipeline still hardcodes the old all-failures-are-`1` contract; the gate script above does not need it, since it checks its own thresholds rather than branching on a specific exit code.

## Where to go next

- The gate is failing because the master itself needs work, not the delivery contract — go back to [Mix and Master a Song in the CLI](./cli-mix-and-master.md).
- The damage check keeps tripping on the same recording — [Clean Up a Batch of Recordings](./recording-cleanup.md) covers fixing it at the source instead of the delivered file.
- You need this logic inside an application rather than a shell script — the same measurements are in the [Python API](../python-api.md), including the stereo entry points a CI script cannot reach through the CLI.
