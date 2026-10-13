---
title: Mix and Master a Song in the CLI
description: A folder of stems to a platform-ready master without leaving the shell — suggest a scene, edit it, render it, check it, master it, and verify the result.
---

# Mix and Master a Song in the CLI

You have four stems and no DAW open. This page takes them to a finished master in one shell script, and then explains what each step decided and how to tell whether it decided well.

The job is **not** "run one magic command". It is a chain of four honest stages — measure, propose, render, master — with a human checkpoint in the middle, because the mix is the part a machine cannot finish for you.

::: info Which CLI
This page uses the Python CLI (`pip install libsonare`, command `sonare`). `mix` and `declip` are not in the native `sonare-cli`; see [Which CLI Are You Using?](../cli.md#which-cli-are-you-using). Steps with a Node or Python tab run in either binding without a CLI.
:::

::: info What you need
- **Install:** `pip install libsonare` (Python 3.11 or later). The Node tabs need `npm install @libraz/libsonare` (Node.js 22.12 or later).
- **Four stems in `stems/`:** `drums.wav`, `bass.wav`, `gtr.wav` and `vox.wav`, exported from one session so they start together and have the same length and sample rate. Mono or stereo both work; this page runs at 48 kHz.
- **Test material:** every number on this page comes from the four 6-second stems the script below writes, run exactly as shown, so you can reproduce each one. With stems of your own the commands are the same and the numbers will be yours.
- **Vocabulary:** [Mixing Basics](../glossary/concepts/mixing-basics.md), [Gain Staging](../glossary/concepts/gain-staging.md) and [Buses and Sends](../glossary/mixing/buses-sends.md) cover the terms the assistant's explanation uses.
:::

::: details A script that writes four test stems
Save as `make_stems.py` and run `python make_stems.py` (NumPy comes with `pip install libsonare`). It writes a kick and snare, a square-wave bass, a chord pad and a vowel-like melody over a four-chord loop at 120 BPM.

```python
"""Write four 6-second test stems to stems/: drums, bass, gtr and vox, 48 kHz mono."""
import os
import wave

import numpy as np

SR = 48000
t = np.arange(6 * SR) / SR
rng = np.random.default_rng(3)
beat = 0.5  # 120 BPM


def save(name, x):
    with wave.open(f"stems/{name}.wav", "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(x, -1.0, 1.0) * 32767).astype("<i2").tobytes())


def hits(times, length, make):
    x = np.zeros_like(t)
    for start in times:
        i = int(start * SR)
        n = min(length, len(t) - i)
        x[i : i + n] += make(np.arange(n) / SR)
    return x


kick = hits(np.arange(0, 6, beat), 9000, lambda u: np.sin(2 * np.pi * (50 + 80 * np.exp(-u * 30)) * u) * np.exp(-u * 12))
snare = hits(np.arange(beat, 6, 2 * beat), 6000, lambda u: rng.standard_normal(len(u)) * np.exp(-u * 25) * 0.5)
roots = np.repeat([110.0, 87.3, 130.8, 98.0], 3 * SR // 2)[: len(t)]  # A, F, C, G: 1.5 s each
bass = 0.5 * np.sign(np.sin(2 * np.pi * np.cumsum(roots) / SR)) * (0.6 + 0.4 * np.cos(2 * np.pi * t / beat))
gtr = 0.15 * sum(np.sin(2 * np.pi * np.cumsum(roots * r) / SR) for r in (2.0, 2.52, 3.0))
melody = np.repeat([440.0, 523.3, 493.9, 392.0], 3 * SR // 2)[: len(t)]
vox = 0.3 * sum(np.sin(k * 2 * np.pi * np.cumsum(melody * (1 + 0.003 * np.sin(2 * np.pi * 5.5 * t))) / SR) / k for k in range(1, 12))

os.makedirs("stems", exist_ok=True)
save("drums", 0.6 * (kick + snare))
save("bass", bass)
save("gtr", gtr)
save("vox", vox)
```
:::

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

::: code-group

```bash [CLI]
sonare suggest-mix \
  --input drums=stems/drums.wav --input bass=stems/bass.wav \
  --input gtr=stems/gtr.wav --input vox=stems/vox.wav \
  --sample-rate 48000 --tempo-bpm auto \
  --scene-out scene.json --json
```

```typescript [Node]
import { readFileSync, writeFileSync } from 'node:fs';
import { decodeChannels, init, suggestMixScene } from '@libraz/libsonare';

await init();
// The first channel of each stem; pass `right` as well for a stereo stem.
const load = (name: string) => decodeChannels(new Uint8Array(readFileSync(`stems/${name}.wav`))).channels[0];
const [drums, bass, gtr, vox] = ['drums', 'bass', 'gtr', 'vox'].map(load);
const result = suggestMixScene({
  sampleRate: 48000,
  tracks: [
    { id: 'drums', name: 'Drums', left: drums },
    { id: 'bass', name: 'Bass', left: bass },
    { id: 'gtr', name: 'Gtr', left: gtr },
    { id: 'vox', name: 'Vox', left: vox },
  ],
  options: { tempoBpm: 120 },
});
for (const line of result.explanation) console.log(line);
writeFileSync('scene.json', JSON.stringify(result.scene, null, 2));
```

```python [Python]
import json
from pathlib import Path

import libsonare as sonare
from libsonare import Audio


def load(name):
    # The first channel of each stem; MixTrackInput also takes a right channel.
    with Audio.from_file_channel(f"stems/{name}.wav", 0) as audio:
        return audio.data


drums, bass, gtr, vox = (load(n) for n in ("drums", "bass", "gtr", "vox"))
result = sonare.suggest_mix_scene(
    [
        sonare.MixTrackInput("drums", drums, name="Drums"),
        sonare.MixTrackInput("bass", bass, name="Bass"),
        sonare.MixTrackInput("gtr", gtr, name="Gtr"),
        sonare.MixTrackInput("vox", vox, name="Vox"),
    ],
    sample_rate=48000,
    tempo_bpm=120.0,
)
print("\n".join(result["explanation"]))
Path("scene.json").write_text(json.dumps(result["scene"], indent=2))
```

:::

The library calls do not detect a tempo: pass `tempoBpm` (`tempo_bpm`) yourself, or leave it out for the transport's fallback tempo. `--tempo-bpm auto` is a CLI convenience.

Three parts of the output matter, and they answer different questions.

**`explanation` — why each number is what it is.** One line per decision, emitted by the rule that made it. These are the `vox` lines of the 24 the run prints:

```text
staged vox with -6.6 dB of input trim towards the -18.0 LUFS target
balanced vox at +2.8 dB relative to its staged level as a vocal part,
  scaled down from +5.0 dB by a 0.55 classification confidence
compressed vox at 3.3:1 above -29.1 dB, with the 5.5 ms attack and 200.0 ms
  release its 5.8 dB crest factor and 1.00 sustain ratio call for
sent vox to the plate reverb at -10.5 dB as a vocal part
pulled the master bus down to leave the summed mix its headroom
```

Read this before you read the scene. A decision you disagree with is almost always a *classification* you disagree with, and the line says so — `scaled down from +5.0 dB by a 0.55 classification confidence` is the assistant telling you it was only half sure that stem was a vocal.

**`tracks` — what it measured.** Per stem: `integratedLufs`, `crestFactorDb`, `sustainRatio`, `spectralCentroidHz`, `bandOccupancy`, `channelCount`, and the classification it landed on (`source`, `sourceConfidence`). This is the evidence behind the explanation.

::: tip Reading the explanation's vocabulary
- **Input trim toward -18 LUFS** brings every stem to a similar working level before the faders, so faders start near 0 dB and plugins see sensible levels ([Gain Staging](../glossary/concepts/gain-staging.md), [LUFS](../glossary/lufs.md)).
- **Crest factor** is the peak-to-average ratio in dB: a drum hit is high, a held pad is low ([Crest Factor](../glossary/concepts/crest-factor.md)). **Sustain ratio** says how much of the stem is held sound rather than attack. The assistant sets compressor attack and release from these two.
- **Sent to the plate reverb** means a copy of the vocal goes to a shared reverb on an aux bus; **post** means the send follows the fader ([Buses and Sends](../glossary/mixing/buses-sends.md)).
- **Masker / maskee:** in a crowded frequency band, the louder stem (masker) hides the quieter one (maskee).
:::

**`mix` — what happens between the stems.** `bandDominance` ranks masker/maskee pairs per frequency band, `crowdedBands` scores how contested each band is, and `monoRisks` flags material that will collapse in mono. Nothing in the scene acts on these directly; they are there so you can decide whether the problem is a fader or an arrangement.

::: tip `--tempo-bpm auto`
Delay times in the proposed scene are voiced against the tempo. `auto` detects it from the first `--input`. Omit the flag entirely and you get the transport's fallback tempo, which is almost never your song's.
:::

## Step 2 — Edit the scene

`scene.json` is a plain document, specified field by field in [Mixing Scene JSON](../mixing-scene-json.md). Open it, change what you disagree with, save it. This is the point of the two-step design: there is deliberately no command that goes from stems to a mixdown without giving you this file.

The scene the run above produced has six strips — the four stems plus a `reverbReturn` and a `delayReturn` fed by aux buses — and each insert carries its parameters as an object keyed by parameter name:

```json
{
  "id": "vox",
  "faderDb": 2.75,
  "inputTrimDb": -6.614171028137207,
  "inserts": [
    { "processor": "dynamics.compressor", "slot": "pre",
      "params": { "attackMs": 5.52, "ratio": 3.31, "thresholdDb": -29.1, "autoMakeup": true } },
    { "processor": "dynamics.vocalRider", "slot": "pre",
      "params": { "targetDb": -18, "maxBoostDb": 3, "maxCutDb": 3 } }
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

`mix` is a Python CLI command. In code, `Mixer.fromSceneJson` loads the same scene and `processStereo` renders it block by block; see [Mixing Engine](../mixing.md#scene-based-mixing-mixer).

```bash
sonare mix --scene scene.json \
  --input drums=stems/drums.wav --input bass=stems/bass.wav \
  --input gtr=stems/gtr.wav --input vox=stems/vox.wav \
  -o mix.wav --json
```

```json
{"strip_count": 6, "sample_rate": 48000, "block_size": 512,
 "rendered_samples": 553053, "output": "mix.wav"}
```

Three things about that output are worth knowing before they surprise you.

**The `--input` ID names a strip.** `drums=stems/drums.wav` feeds the strip whose `id` is `drums`. A strip no entry names is fed silence — which is exactly what you want for the two return strips, and exactly what you do *not* want when you fat-finger a name. `strip_count` is the scene's strip count, not the number you fed; compare it against your `--input` count plus the returns.

**The render is longer than the stems.** The stems here are 6 seconds; `rendered_samples` is 553053 frames, or 11.5 seconds. That tail is the plate reverb and the stereo delay ringing out after the last note. Render the same scene with the effect returns and their sends removed and you get 288574 frames back, 574 more than the 288000-frame input.

**Stereo survives.** A mono stem is carried on both sides, a stereo stem keeps its own two channels, and the output is always a stereo pair. Anything wider than two channels is downmixed with a warning.

## Step 4 — Check the mixdown before mastering

Mastering will make quiet damage loud. Look for it first:

::: code-group

```bash [CLI]
sonare repair mix.wav --detect --json
```

```typescript [Node]
import { readFileSync } from 'node:fs';
import { decodeChannels, init, masteringRepairAnalyze } from '@libraz/libsonare';

await init();
// Both channels of the stereo mixdown, measured separately.
const { sampleRate, channels } = decodeChannels(new Uint8Array(readFileSync('mix.wav')));
const { defects, recommended } = masteringRepairAnalyze({ channels, sampleRate });
console.log(defects.clipSampleFraction, defects.cracklePerSecond, recommended.map((s) => s.stage));
```

```python [Python]
import libsonare as sonare
from libsonare import Audio

# Both channels of the stereo mixdown, measured separately.
channels = []
for i in range(Audio.file_channel_count("mix.wav")):
    with Audio.from_file_channel("mix.wav", i) as audio:
        channels.append(audio.data)
        sample_rate = audio.sample_rate

analysis = sonare.mastering_repair_analyze(channels, sample_rate)
print(analysis["defects"]["clipSampleFraction"], [s["stage"] for s in analysis["recommended"]])
```

:::

`--detect` measures and reports without writing anything, so it is free to run on every render. It returns clip runs and their fraction of the file, click and crackle counts, the noise floor, and whether a mains-frequency harmonic series is sitting in the signal. The library calls measure the same things and also return the repair stages they recommend (`recommended`), with camelCase field names such as `clipSampleFraction`. Anything found is cheaper to fix in the stem than in the master — see [Clean Up a Batch of Recordings](./recording-cleanup.md) for the repair side of this.

::: warning The CLI checks the mono fold of a stereo mix
`repair --detect` folds `mix.wav` to mono before it measures, and says so on stderr. Damage in one channel only, such as a click on the left or clipping on one side, can shrink or cancel in that fold. The Node and Python tabs measure each channel; use them when the CLI report is clean but you still hear a problem.
:::

::: warning `--explain` and `--detect` do not combine
`--detect` runs no repair stage, so there is no choice to explain; passing both is rejected as an invalid parameter (exit code 3). Drop `--detect` to see why the assistant would pick each stage.
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
 "input_lufs": -20.49, "output_lufs": -14.05, "applied_gain_db": 7.67, "output": "master.wav",
 "stages": ["eq.tilt", "dynamics.compressor", "saturation.exciter",
            "stereo.imager", "loudness.optimize"],
 "explanation": ["base preset: edm",
                 "target loudness and ceiling applied from AssistantConfig"],
 "latency_samples": 0}
```

`--assistant` profiles the mixdown and starts from the preset named with `--preset`; when the option is omitted, it starts from `streaming`. The assistant does not infer a genre from the audio. `--explain` reports the selected base preset and any repair or speech-specific decisions. `--target-platform` accepts `streaming`, `youtube`, `broadcast`, `podcast`, `audiobook`, `cinema`, `club`, or `cd`. Only `broadcast` (-23 LUFS, -1 dBTP), `podcast` (-16 LUFS, -1 dBTP), `club` and `cd` (-9 LUFS, -0.3 dBTP) supply their own loudness and ceiling, and only when you did not pass `--target-lufs` or `--ceiling-db`. The other four apply nothing: `--target-platform streaming` in the script above lands on the defaults, -14 LUFS and a -1 dBTP ceiling, exactly as if the flag were absent. That matches common streaming normalization, so it is the right target here; for an audiobook, pass the numbers yourself as shown in [Produce a Spoken-Word Show](./spoken-word-show.md#step-4-—-master-with-the-speech-preset). The processors themselves are catalogued in [Mastering Processors](../mastering-processors.md), and the assistant contract is in [Mastering Assistant](../mastering-assistant.md).

::: warning `--target-platform` requires `--assistant`
The platform target is an assistant input, not a global. Passing it to a preset run exits with code 3 and says so. To master with a fixed preset, use `--preset <name>` with that preset's built-in target. If you need a different target or ceiling, use `--assistant --preset <name>` with `--target-lufs` / `--ceiling-db`, or write the suggested chain with `mastering-suggest` and render it with `--chain-config`.
:::

`edm` is only this example's choice; pick the base preset by what the music is, using [Choosing a Mastering Preset](../glossary/mastering/preset-selection.md). Choose the base preset explicitly when the material has a known role: `sonare mastering-presets --json` lists all thirty, from `pop` and `jpop` through `speech` and `fieldRecording` to `vinyl` and `shellac78`. The same name works with `--assistant --preset <name>`; restoration presets such as `vinyl` are rejected by the assistant because they do not provide a mastering loudness target.

## Step 6 — Believe the right number

`--report` writes the before/after measurement the chain itself took:

```json
{
  "before": { "integrated_lufs": -20.49, "true_peak_dbtp": -2.10, "loudness_range": 6.85 },
  "after":  { "integrated_lufs": -14.05, "true_peak_dbtp": -1.00, "loudness_range": 7.54 },
  "applied_gain_db": 7.67,
  "max_gain_reduction_db": -6.86,
  "loudness_target_limited": false,
  "band_energy_delta_db": [ /* 32 bands */ ]
}
```

The `after` true peak is `-1.00` because the limiter's own 4x BS.1770 detector is what holds the master at the ceiling; that is the measure the guarantee is made on, and a finer meter or a lossy encode can read higher ([Gate a Delivery in CI](./delivery-check.md) measures by how much). Use the report to check the target and the processing. `loudness_target_limited` reports whether the requested target was actually reached; `false` means it was reached within the configured constraints, but does not mean that the limiter was inactive or that the master is finished. `max_gain_reduction_db` reports the actual maximum gain reduction. Read the after loudness and true-peak values, then audition the result. If the flag is `true`, the target was not reached under the configured gain and ceiling constraints; review the mix, target, or ceiling before accepting it.

::: danger The report's numbers are the stereo ones. A separate `lufs` call's are not.
On the Python CLI, `mastering` keeps the stereo pair end to end, but `lufs` and the other measurement commands downmix to mono first and warn on stderr. The two therefore disagree on the same file:

```bash
sonare lufs master.wav --json
# warning: 2-channel input is downmixed to mono by this CLI command
# {"integrated_lufs": -17.36, ...}   ← the mono fold
# report.json after.integrated_lufs   = -14.05   ← the stereo master
```

The gap is not an error in either one. [ITU-R BS.1770](../glossary/lufs.md) sums channel powers, so a two-channel programme measures about 3 dB above the same material folded to mono, plus whatever the side signal loses in the fold. Here the gap is 3.3 LU (-14.05 against -17.36). On a mono file the two agree exactly.

For a stereo deliverable, take the loudness and true peak from the mastering report. Reach for `lufs` when the deliverable is mono, or use the stereo entry points in the [Python API](../python-api.md).
:::

How much a fold loses depends on how alike the two channels are. In the demo, two copies of one sine wave at a growing phase offset average to a quieter signal and cancel at 180°.

<SonareDemo id="mono-fold" />

## Running it as a script

Every command here takes `--json`, and every failure exits with a [documented code](../cli.md#exit-codes) — 2 for a usage error, 3 for an invalid parameter, 4 for a missing file, 12 for an output path that cannot be written. `set -euo pipefail` at the top of the script is therefore enough to stop the chain at the stage that actually broke, rather than mastering a file that was never rendered.

For turning the last step into a pass/fail check that runs on every commit, continue to [Gate a Delivery in CI](./delivery-check.md).

## Where to go next

- The mix is close but the tonal balance is not where you want it — [Match a Reference Track](./reference-master.md).
- The stems themselves are rough — [Clean Up a Batch of Recordings](./recording-cleanup.md).
- You want this in an app rather than a script — [Mixing Engine](../mixing.md) and [Mastering Assistant](../mastering-assistant.md) show the same pipeline through the APIs.
