---
title: Mix and Master a Song in the CLI
description: A folder of stems to a platform-ready master without leaving the shell — suggest a scene, edit it, render it, check it, master it, and verify the result.
---

# Mix and Master a Song in the CLI

You have four stems and no DAW open. This page takes them to a finished master in one shell script, and then explains what each step decided and how to tell whether it decided well.

The job is **not** "run one magic command". It is a chain of four honest stages — measure, propose, render, master — with a human checkpoint in the middle, because the mix is the part a machine cannot finish for you.

## What You Will Learn

By the end of this page you should be able to:

- turn a set of stems into a mixer scene and read the reason the assistant gives for every number in it;
- edit that scene as plain JSON and render it to a stereo mixdown;
- master the mixdown to a named delivery target and read the before/after report;
- tell which of the loudness numbers on your screen is the one you should believe.

## The whole job

Everything below is this script. Run it, then read on for what each stage is doing.

```bash
#!/usr/bin/env bash
set -euo pipefail

# 1. Propose a mix from the stems. Nothing is processed here — this only measures.
sonare suggest-mix \
  --input drums=stems/drums.wav \
  --input bass=stems/bass.wav \
  --input gtr=stems/gtr.wav \
  --input vox=stems/vox.wav \
  --sample-rate 48000 \
  --tempo-bpm auto \
  --scene-out scene.json \
  --json > suggestion.json

# 2. Read the reasons, then edit scene.json by hand. This is the checkpoint.
python3 -c 'import json;[print(l) for l in json.load(open("suggestion.json"))["explanation"]]'

# 3. Render the scene to a stereo mixdown.
sonare mix --scene scene.json \
  --input drums=stems/drums.wav \
  --input bass=stems/bass.wav \
  --input gtr=stems/gtr.wav \
  --input vox=stems/vox.wav \
  -o mix.wav --json

# 4. Look for damage before committing to a master.
sonare repair mix.wav --detect --json > defects.json

# 5. Master for the delivery target, keeping the report.
sonare mastering mix.wav \
  --assistant --preset edm --explain \
  --target-platform streaming \
  -o master.wav --report report.json --json
```

<FlowDiagram
  title="Stems to master"
  direction="LR"
  :nodes="[
    { id: 'stems', label: 'Stems (WAV)', col: 0, row: 0, variant: 'muted' },
    { id: 'suggest', label: 'suggest-mix', col: 1, row: 0, variant: 'accent' },
    { id: 'scene', label: 'scene.json', col: 2, row: 0 },
    { id: 'edit', label: 'Your edit', col: 3, row: 0, variant: 'decision' },
    { id: 'mix', label: 'mix', col: 4, row: 0, variant: 'accent' },
    { id: 'mixdown', label: 'mix.wav', col: 5, row: 0 },
    { id: 'detect', label: 'repair --detect', col: 5, row: 1, variant: 'warning' },
    { id: 'master', label: 'mastering --assistant', col: 6, row: 0, variant: 'accent' },
    { id: 'out', label: 'master.wav', col: 7, row: 0, variant: 'success' },
    { id: 'report', label: 'report.json', col: 7, row: 1, variant: 'muted' }
  ]"
  :edges="[
    { from: 'stems', to: 'suggest' },
    { from: 'suggest', to: 'scene' },
    { from: 'scene', to: 'edit' },
    { from: 'edit', to: 'mix' },
    { from: 'stems', to: 'mix', label: 'audio', style: 'dashed' },
    { from: 'mix', to: 'mixdown' },
    { from: 'mixdown', to: 'detect', style: 'dashed' },
    { from: 'mixdown', to: 'master' },
    { from: 'master', to: 'out' },
    { from: 'master', to: 'report', style: 'dashed' }
  ]"
  caption="The assistant measures and proposes; the mixer and the mastering chain are the only stages that touch audio."
/>

## Step 1 — Propose a mix

`suggest-mix` measures every stem, measures what happens between them, and writes a mixer scene. It **never touches the audio**: `--scene-out` is a document, not a render. The full option set and the rules behind it are in [Mixing Assistant](../mixing-assistant.md).

```bash
sonare suggest-mix \
  --input drums=stems/drums.wav --input bass=stems/bass.wav \
  --input gtr=stems/gtr.wav --input vox=stems/vox.wav \
  --sample-rate 48000 --tempo-bpm auto \
  --scene-out scene.json --json
```

Three parts of the output matter, and they answer different questions.

**`explanation` — why each number is what it is.** One line per decision, emitted by the rule that made it:

```text
staged vox with -7.2 dB of input trim towards the -18.0 LUFS target
balanced vox at +2.7 dB relative to its staged level as a vocal part,
  scaled down from +5.0 dB by a 0.53 classification confidence
compressed vox at 3.3:1 above -22.2 dB, with the 5.3 ms attack and 200.0 ms
  release its 5.2 dB crest factor and 1.00 sustain ratio call for
sent vox to the plate reverb at -10.5 dB as a vocal part
pulled the master bus down to leave the summed mix its headroom
```

Read this before you read the scene. A decision you disagree with is almost always a *classification* you disagree with, and the line says so — `scaled down from +5.0 dB by a 0.53 classification confidence` is the assistant telling you it was only half sure that stem was a vocal.

**`tracks` — what it measured.** Per stem: `integratedLufs`, `crestFactorDb`, `sustainRatio`, `spectralCentroidHz`, `bandOccupancy`, `channelCount`, and the classification it landed on (`source`, `sourceConfidence`). This is the evidence behind the explanation.

**`mix` — what happens between the stems.** `bandDominance` ranks masker/maskee pairs per frequency band, `crowdedBands` scores how contested each band is, and `monoRisks` flags material that will collapse in mono. Nothing in the scene acts on these directly; they are there so you can decide whether the problem is a fader or an arrangement.

::: tip `--tempo-bpm auto`
Delay times in the proposed scene are voiced against the tempo — `auto` detects it from the first `--input`. Omit the flag entirely and you get the transport's fallback tempo, which is almost never your song's.
:::

## Step 2 — Edit the scene

`scene.json` is a plain document, specified field by field in [Mixing Scene JSON](../mixing-scene-json.md). Open it, change what you disagree with, save it. This is the point of the two-step design: there is deliberately no command that goes from stems to a mixdown without giving you this file.

The scene the run above produced has six strips — the four stems plus a `reverbReturn` and a `delayReturn` fed by aux buses — and each insert carries its parameters as a JSON string:

```json
{
  "id": "vox",
  "faderDb": 2.652244806289673,
  "inputTrimDb": -7.215085029602051,
  "inserts": [
    { "processor": "dynamics.compressor", "slot": "pre",
      "params": "{\"attackMs\":5.26,\"ratio\":3.34,\"thresholdDb\":-22.2,\"autoMakeup\":true}" },
    { "processor": "dynamics.vocalRider", "slot": "pre",
      "params": "{\"targetDb\":-18,\"maxBoostDb\":3,\"maxCutDb\":3}" }
  ],
  "sends": [
    { "id": "vox-to-reverbBus", "destinationBusId": "reverbBus", "sendDb": -10.5, "timing": "post" },
    { "id": "vox-to-delayBus", "destinationBusId": "delayBus", "sendDb": -14, "timing": "post" }
  ]
}
```

Changing `sendDb`, `faderDb`, or a threshold is a text edit. Removing a processor is deleting an object from `inserts`. The mixer validates the document when it loads it, so a typo surfaces as a load error rather than as a strange mix.

A `faderDb` you type into a strip is the same fader the mixer exposes as a live control once the scene loads — the lanes below are three strips inside the engine, and moving a fader or mute changes that lane's output alone. That is the edit you are making blind in `scene.json`; the render in Step 3 is where you get to hear it.

<SonareDemo id="engine-lane-mixer" />

## Step 3 — Render

```bash
sonare mix --scene scene.json \
  --input drums=stems/drums.wav --input bass=stems/bass.wav \
  --input gtr=stems/gtr.wav --input vox=stems/vox.wav \
  -o mix.wav --json
```

```json
{"strip_count": 6, "sample_rate": 48000, "block_size": 512,
 "rendered_samples": 494549, "output": "mix.wav"}
```

Three things about that output are worth knowing before they surprise you.

**The `--input` ID names a strip.** `drums=stems/drums.wav` feeds the strip whose `id` is `drums`. A strip no entry names is fed silence — which is exactly what you want for the two return strips, and exactly what you do *not* want when you fat-finger a name. `strip_count` is the scene's strip count, not the number you fed; compare it against your `--input` count plus the returns.

**The render is longer than the stems.** The stems here are 6 seconds; `rendered_samples` is 494549 frames, or 10.3 seconds. That tail is the plate reverb and the stereo delay ringing out after the last note. Render the same scene with the effect returns removed and you get exactly 288000 frames back — the input length, to the sample.

**Stereo survives.** A mono stem is carried on both sides, a stereo stem keeps its own two channels, and the output is always a stereo pair. Anything wider than two channels is downmixed with a warning.

## Step 4 — Check the mixdown before mastering

Mastering will make quiet damage loud. Look for it first:

```bash
sonare repair mix.wav --detect --json
```

`--detect` measures and reports without writing anything, so it is free to run on every render. It returns clip runs and their fraction of the file, click and crackle counts, the noise floor, and whether a mains-frequency harmonic series is sitting in the signal. Anything it finds is cheaper to fix in the stem than in the master — see [Clean Up a Batch of Recordings](./recording-cleanup.md) for the repair side of this.

::: warning `--explain` and `--detect` do not combine
`--detect` runs no repair stage, so there is no choice to explain; passing both is a usage error. Drop `--detect` to see why the assistant would pick each stage.
:::

## Step 5 — Master to a delivery target

```bash
sonare mastering mix.wav \
  --assistant --preset edm --explain \
  --target-platform streaming \
  -o master.wav --report report.json --json
```

```json
{"mode": "assistant",
 "input_lufs": -19.61, "output_lufs": -14.11, "applied_gain_db": 7.53,
 "stages": ["eq.tilt", "dynamics.compressor", "saturation.exciter",
            "stereo.imager", "loudness.optimize"],
 "explanation": ["base preset: edm",
                 "target loudness and ceiling applied from AssistantConfig"],
 "latency_samples": 0}
```

`--assistant` profiles the mixdown and starts from the preset named with `--preset`; when the option is omitted, it starts from `streaming`. The assistant does not infer a genre from the audio. `--explain` reports the selected base preset and any repair or speech-specific decisions. `--target-platform` accepts `streaming`, `youtube`, `broadcast`, `podcast`, `audiobook`, `cinema`, `club`, or `cd`; `broadcast`, `podcast`, `club`, and `cd` supply their own loudness and ceiling when the corresponding values were not explicit, while the other accepted names leave the current values unchanged. The processors themselves are catalogued in [Mastering Processors](../mastering-processors.md), and the assistant contract is in [Mastering Assistant](../mastering-assistant.md).

::: warning `--target-platform` requires `--assistant`
The platform target is an assistant input, not a global. Passing it to a preset run exits with code 3 and says so. To master with a fixed preset, use `--preset <name>` with that preset's built-in target. If you need a different target or ceiling, use `--assistant --preset <name>` with `--target-lufs` / `--ceiling-db`, or write the suggested chain with `mastering-suggest` and render it with `--chain-config`.
:::

Choose the base preset explicitly when the material has a known role: `sonare mastering-presets --json` lists all thirty, from `pop` and `jpop` through `speech` and `fieldRecording` to `vinyl` and `shellac78`. The same name works with `--assistant --preset <name>`; restoration presets such as `vinyl` are rejected by the assistant because they do not provide a mastering loudness target.

## Step 6 — Believe the right number

`--report` writes the before/after measurement the chain itself took:

```json
{
  "before": { "integrated_lufs": -19.61, "true_peak_dbtp": -6.13, "loudness_range": 6.22 },
  "after":  { "integrated_lufs": -14.11, "true_peak_dbtp": -0.95, "loudness_range": 6.50 },
  "applied_gain_db": 7.53,
  "max_gain_reduction_db": -2.30,
  "loudness_target_limited": false,
  "band_energy_delta_db": [ /* 32 bands */ ]
}
```

Two fields decide whether the master is finished. `loudness_target_limited` says whether the chain hit its ceiling before it reached the loudness target — `false` means the target was met honestly. `max_gain_reduction_db` says how hard the limiter worked to get there; a large figure with `loudness_target_limited: true` means you are asking for more loudness than the mix has headroom to give, and the fix is in the mix, not the master.

::: danger The report's numbers are the stereo ones. A separate `lufs` call's are not.
On the Python CLI, `mastering` keeps the stereo pair end to end, but `lufs` and the other measurement commands downmix to mono first and warn on stderr. The two therefore disagree on the same file:

```bash
sonare lufs master.wav --json
# warning: 2-channel input is downmixed to mono by this CLI command
# {"integrated_lufs": -17.57, ...}   ← the mono fold
# report.json after.integrated_lufs   = -14.11   ← the stereo master
```

The gap is not an error in either one. [ITU-R BS.1770](../glossary/lufs.md) sums channel powers, so a two-channel programme measures about 3 dB above the same material folded to mono, plus whatever the side signal loses in the fold. On a mono file the two agree exactly.

For a stereo deliverable, take the loudness and true peak from the mastering report. Reach for `lufs` when the deliverable is mono, or use the stereo entry points in the [Python API](../python-api.md).
:::

## Running it as a script

Every command here takes `--json`, and every failure exits with a [documented code](../cli.md#exit-codes) — 2 for a usage error, 3 for an invalid parameter, 4 for a missing file, 12 for an output path that cannot be written. `set -euo pipefail` at the top of the script is therefore enough to stop the chain at the stage that actually broke, rather than mastering a file that was never rendered.

For turning the last step into a pass/fail check that runs on every commit, continue to [Gate a Delivery in CI](./delivery-check.md).

## Where to go next

- The mix is close but the tonal balance is not where you want it — [Match a Reference Track](./reference-master.md).
- The stems themselves are rough — [Clean Up a Batch of Recordings](./recording-cleanup.md).
- You want this in an app rather than a script — [Mixing Engine](../mixing.md) and [Mastering Assistant](../mastering-assistant.md) show the same pipeline through the APIs.
