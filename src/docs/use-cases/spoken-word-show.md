---
title: Produce a Spoken-Word Show
description: Host, guest, and a music bed to a ducked, loudness-compliant episode — mix with the commentaryDucking preset, master with the speech chain, and verify from the CLI, one episode at a time.
---

# Produce a Spoken-Word Show

This page combines a host track, a guest track, and a music bed. It renders them with `commentaryDucking`, masters the result with `speech`, and checks the report.

::: info Which CLI
This page uses the Python CLI (`pip install libsonare`, command `sonare`). `mix` is not in the native `sonare-cli`; see [Which CLI Are You Using?](../cli.md#which-cli-are-you-using). In code, `Mixer.fromSceneJson` loads the same scene (see [Mixing Engine](../mixing.md#scene-based-mixing-mixer)).
:::

::: info What you need
- **Install:** `pip install libsonare` (Python 3.11 or later). The Node tab needs `npm install @libraz/libsonare` (Node.js 22.12 or later).
- **Three WAV files of the same length and sample rate:** `host.wav`, `guest.wav` and `music-bed.wav`, mono or stereo. 48 kHz is the rate used here.
- **Test material:** the numbers below come from 8-second synthetic tracks. The script below writes similar ones (vowel-like syllables for the voices, a sustained chord for the bed); your numbers will differ.
:::

::: details A script that writes test voices and a music bed
Save as `make_show.py` and run `python make_show.py` (NumPy comes with `pip install libsonare`). The host talks for the first 3 seconds and the last 3; the guest talks in between.

```python
"""Write host.wav, guest.wav and music-bed.wav: 8 s, 48 kHz mono test material."""
import wave

import numpy as np

SR = 48000
t = np.arange(8 * SR) / SR
rng = np.random.default_rng(5)


def save(path, x):
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(x, -1.0, 1.0) * 32767).astype("<i2").tobytes())


def voice(f0, talking):
    """Vowel-like syllables at about 4 per second, plus a little breath noise."""
    phase = 2 * np.pi * np.cumsum(f0 * (1 + 0.05 * np.sin(2 * np.pi * 0.7 * t))) / SR
    tone = sum(np.sin(k * phase) / k for k in range(1, 30))
    syllables = np.clip(np.sin(2 * np.pi * 4.0 * t), 0.0, None) ** 0.5
    x = (0.25 * tone + 0.02 * rng.standard_normal(len(t))) * syllables
    return x * talking


host_talks = ((t < 3.0) | (t >= 5.0)).astype(float)
save("host.wav", voice(120.0, host_talks))
save("guest.wav", voice(200.0, 1.0 - host_talks))
save("music-bed.wav", 0.3 * sum(np.sin(2 * np.pi * f * t) for f in (220.0, 277.2, 329.6)) / 3)
```
:::

## What You Will Learn

By the end of this page you should be able to:

- render host, guest, and a music bed through the built-in `commentaryDucking` mixer preset and read exactly what routes the duck;
- edit the duck depth in the scene and tell a real change from a no-op;
- master an episode with the `speech` preset and see how the assistant explains that named choice;
- read the loudness number that decides whether the episode is ready for a podcast platform.

## The whole job

```bash
#!/usr/bin/env bash
set -euo pipefail

# 1. Fetch the built-in ducking scene and inspect it before rendering.
sonare mixing-preset --preset commentaryDucking --json > scene.json

# 2. Loosen the duck a little: edit the music bed's sidechain range in place.
python3 -c '
import json
scene = json.load(open("scene.json"))
for strip in scene["strips"]:
    if strip["id"] == "music-bed":
        for insert in strip["inserts"]:
            if insert["processor"] == "dynamics.sidechainRouter":
                insert["params"].update({"rangeDb": 5})
json.dump(scene, open("scene.json", "w"))
'

# 3. Render host, guest, and the bed through the edited scene.
sonare mix --scene scene.json \
  --input host=host.wav \
  --input guest=guest.wav \
  --input music-bed=music-bed.wav \
  -o show.wav --json

# 4. Master for the platform with the explicit speech preset.
sonare mastering show.wav \
  --preset speech \
  -o show-master.wav --json

# 5. Confirm the loudness the episode actually landed at (a second render is
#    unavoidable here: --report only comes from a run that also writes audio).
sonare mastering show.wav \
  --assistant --preset speech --explain --target-platform podcast \
  -o show-assistant.wav --report show-report.json --json
```

<FlowDiagram
  title="Host, guest, and a bed to a ducked episode"
  direction="LR"
  :nodes="[
    { id: 'host', label: 'host.wav', col: 0, row: 0, variant: 'muted' },
    { id: 'guest', label: 'guest.wav', col: 0, row: 1, variant: 'muted' },
    { id: 'bed', label: 'music-bed.wav', col: 0, row: 2, variant: 'muted' },
    { id: 'hoststrip', label: 'host: de-ess + compress', col: 1, row: 0, variant: 'accent' },
    { id: 'gueststrip', label: 'guest: compress', col: 1, row: 1, variant: 'accent' },
    { id: 'bedstrip', label: 'music-bed: sidechainRouter', col: 1, row: 2, variant: 'decision' },
    { id: 'master', label: 'master bus', col: 2, row: 1, variant: 'accent' },
    { id: 'mixdown', label: 'show.wav', col: 3, row: 1 },
    { id: 'mastering', label: 'mastering --preset speech', col: 4, row: 1, variant: 'accent' },
    { id: 'out', label: 'show-master.wav', col: 5, row: 1, variant: 'success' }
  ]"
  :edges="[
    { from: 'host', to: 'hoststrip' },
    { from: 'guest', to: 'gueststrip' },
    { from: 'bed', to: 'bedstrip' },
    { from: 'host', to: 'bedstrip', label: 'sidechainKey', style: 'dashed' },
    { from: 'hoststrip', to: 'master' },
    { from: 'gueststrip', to: 'master' },
    { from: 'bedstrip', to: 'master' },
    { from: 'master', to: 'mixdown' },
    { from: 'mixdown', to: 'mastering' },
    { from: 'mastering', to: 'out' }
  ]"
  caption="Only the host strip drives the duck. Guest speech does not lower the music bed."
/>

## Step 1 — Fetch the preset and read what it wires

`sonare mixing-presets --json` lists three built-in scenes: `vocalReverbSend`, `drumBusSubgroup`, and `commentaryDucking`. The third is this job:

::: code-group

```bash [CLI]
sonare mixing-preset --preset commentaryDucking --json
```

```typescript [Node]
import { init, mixingScenePresetJson } from '@libraz/libsonare';

await init();
const scene = JSON.parse(mixingScenePresetJson('commentaryDucking'));
```

```python [Python]
import json
import libsonare as sonare

scene = json.loads(sonare.mixing_scene_preset_json("commentaryDucking"))
```

:::

Read the scene before rendering anything — the preset is a starting point, not a black box, and its `strips` say exactly what it does:

| Strip | `faderDb` | Inserts | Notes |
|-------|-----------|---------|-------|
| `host` | -3 | `dynamics.deesser` (6000 Hz, threshold -24 dB), then `dynamics.compressor` (threshold -20 dB, ratio 3) | `pan: 0`, centered |
| `guest` | -4 | `dynamics.compressor` (threshold -22 dB, ratio 2.5) | `pan: 0.1`, nudged slightly right so the two voices don't sit on top of each other |
| `music-bed` | -18 | `dynamics.sidechainRouter` (`rangeDb: 18`, `sidechainKey: "host"`, `slot: "post"`) | starts 15 dB under the voices before the duck even engages |

All three strips connect straight to the `master` bus — there is no aux return to manage, unlike the reverb-and-delay returns in [Mix and Master a Song in the CLI](./cli-mix-and-master.md). A `voices` VCA group holds `host` and `guest` together at `gainDb: 0`, so a single fader move can bring both speakers down for, say, a phone-in segment without touching the bed.

The duck itself is one insert: `dynamics.sidechainRouter` sits on the `music-bed` strip's post-fader slot, keyed to `sidechainKey: "host"`. That key is the whole mechanism — it is **not** a stereo bus both host and guest feed into. **Only the host track ducks the bed.** If your guest talks over music and the host is silent, this preset leaves the bed at full level. That is a defensible default for an interview show where one person carries the narration, but it means a two-host chat show needs a second sidechain insert keyed to `guest`, or a bus that sums both voices before the sidechain reads it — either is a manual edit to the fetched scene, not a flag.

::: tip Read the scene before you render
`mixing-preset --preset <name> --json` is just a JSON dump — nothing here touches audio. Piping it straight into `mix --scene -` would work, but printing it to a file first, as the script above does, is what lets you catch a one-sided sidechain like this before you've rendered anything.
:::

## Step 2 — Edit the duck depth, and tell a real edit from a no-op

`rangeDb` on the sidechain insert is a **ceiling**, not the amount of ducking that happens — it is the most the bed is allowed to be pulled down, and the router only pulls it that far if the host's level actually calls for it. On these fixtures that distinction is not academic:

```bash
python3 -c '
import json
scene = json.load(open("scene.json"))
for strip in scene["strips"]:
    if strip["id"] == "music-bed":
        for insert in strip["inserts"]:
            if insert["processor"] == "dynamics.sidechainRouter":
                insert["params"].update({"rangeDb": 30})
json.dump(scene, open("scene.json", "w"))
'
sonare mix --scene scene.json \
  --input host=host.wav --input guest=guest.wav --input music-bed=music-bed.wav \
  -o show-r30.wav --json
cmp show.wav show-r30.wav   # identical — no output
```

Raising `rangeDb` from the preset's default 18 to 30 changes nothing: `cmp` reports the two renders as byte-identical. On this material the host's level never calls for more than about 7 dB of reduction, so any ceiling at or above roughly 8 dB behaves the same as no ceiling at all. Lower it below that point and the edit is real. `sonare dynamics` on the whole-file mixdown shows that something changed, but averaged over 8 seconds that include the voices and long stretches where the host isn't talking, the change looks tiny:

| `rangeDb` | `rms_db` (whole file) | `peak_db` | Render vs `18` |
|-----------|-----------------------|-----------|-----------------|
| — (insert removed entirely) | -22.80 | -10.79 | differs |
| `1` | -22.85 | -10.84 | differs |
| `5` | -22.95 | -10.92 | differs |
| `18` (preset default) | -22.96 | -10.92 | — |
| `30` | -22.96 | -10.92 | identical bytes |

`rangeDb: 5` is the value the script at the top of this page ships with — a slightly shallower duck than the preset default, verified against the table above rather than guessed.

::: warning A cap you never hit is not a cap you tuned
If lowering `rangeDb` does nothing to your render either, the problem isn't the parameter — it's that your host track sits quieter than the threshold the router reacts to, so no ducking is being requested at all. Confirm the duck is engaging at the preset default before spending time tuning how deep it goes.
:::

### The parameters that set the duck

`rangeDb` only caps the duck. How deep it goes, and how it moves, is set by the router's compressor controls. The preset sends only `rangeDb`, so the others run at their defaults:

| Parameter | Default | Starting point for music under speech | Why |
|---|---|---|---|
| `thresholdDb` | -24 | about 10 dB below the host's typical speaking level | the host must cross it on every phrase, or nothing ducks |
| `ratio` | 4 | 4 | together with how far the host crosses the threshold, this sets the depth; aim for the bed 6 to 12 dB lower while the host talks |
| `attackMs` | 5 | 5 to 20 | fast enough that the first syllable is not masked, slow enough not to click |
| `releaseMs` | 100 | 300 to 500 | 100 ms lets the bed swell back in every gap between words, which is heard as pumping; a slower release holds it down through a sentence |
| `rangeDb` | 18 (the preset's) | 12 to 18 | a cap, so a shout cannot bury the bed entirely |

These are starting points, not answers: speaking levels and beds differ, so set them, render, and measure.

Edit them the same way as `rangeDb`, by merging into the insert's `params`:

```python
insert["params"].update({"thresholdDb": -36, "ratio": 4, "attackMs": 10, "releaseMs": 400})
```

<SonareDemo id="ducking" />

A whole-file number cannot tell you how deep the duck is. Measure the bed only while the host is talking, and compare it with the same stretch of bed without the duck. The script below does that: it renders the scene three times (as is, with the duck removed, and with only the bed), recovers the ducked bed by subtraction, and averages both versions of the bed over the 10 ms blocks where `host.wav` is louder than -40 dBFS.

::: details A script that measures the duck under speech
Save as `duck_depth.py` next to the three WAV files and run `python duck_depth.py scene.json`.

```python
"""Print how far the duck pulls the music bed down while the host is talking."""
import copy
import json
import subprocess
import sys

import numpy as np
from libsonare import Audio

BLOCK = 480  # 10 ms at 48 kHz


def render(scene, path):
    with open("duck-scene.json", "w") as f:
        json.dump(scene, f)
    subprocess.run(
        ["sonare", "mix", "--scene", "duck-scene.json", "--input", "host=host.wav",
         "--input", "guest=guest.wav", "--input", "music-bed=music-bed.wav", "-o", path],
        check=True, capture_output=True,
    )
    with Audio.from_file_channel(path, 0) as audio:
        return audio.data


def variant(scene, duck=True, voices=True):
    s = copy.deepcopy(scene)
    for strip in s["strips"]:
        if strip["id"] == "music-bed" and not duck:
            strip["inserts"] = []
        if strip["id"] in ("host", "guest") and not voices:
            strip["muted"] = True
    return s


def block_db(x):
    x = x[: len(x) // BLOCK * BLOCK].reshape(-1, BLOCK)
    return 10 * np.log10(np.mean(x**2, axis=1) + 1e-12)


def level_db(x):
    blocks = block_db(x)
    n = min(len(blocks), len(talking))
    return 10 * np.log10(np.mean(10 ** (blocks[:n][talking[:n]] / 10)))


scene = json.load(open(sys.argv[1]))
bed_alone = render(variant(scene, duck=False, voices=False), "duck-c.wav")
# The master bus is a plain sum, so (with duck) - (without duck) + (bed alone)
# leaves the ducked bed by itself.
ducked = (render(variant(scene), "duck-a.wav") - render(variant(scene, duck=False), "duck-b.wav")
          + bed_alone)
with Audio.from_file("host.wav") as audio:
    talking = block_db(audio.data) > -40.0  # 10 ms blocks where the host is speaking

before, after = level_db(bed_alone), level_db(ducked)
print(f"bed while the host talks: {before:.1f} dB unducked, {after:.1f} dB ducked, "
      f"duck depth {before - after:.1f} dB")
```

On the test material from the script at the top of this page, the unedited preset ducks the bed by about 3 dB while the host talks, and the `update` line above (with `rangeDb` left at the preset's 18) by about 9 dB. Measure the scene you will actually render: the script at the top of this page also sets `rangeDb: 5`, which caps the duck at 5 dB.
:::

The sidechain router is a compressor whose detector listens to the host instead of the bed, so the reduction it asks for is the shaded gain-reduction gap below: how far the key rises above the threshold, scaled by the ratio, and nothing more. Raise the threshold until the program no longer crosses it and the gap disappears — that is the state the warning above describes, and no `rangeDb` brings it back.

<SonareDemo id="compressor-curve" />

## Step 3 — Render

```bash
sonare mix --scene scene.json \
  --input host=host.wav \
  --input guest=guest.wav \
  --input music-bed=music-bed.wav \
  -o show.wav --json
```

```json
{"strip_count": 3, "sample_rate": 48000, "block_size": 512, "rendered_samples": 384000, "output": "show.wav"}
```

`strip_count` is 3 because this scene has no aux returns — every `--input` names a real strip, so there is no silent return to account for the way there is in the four-stem song scene. Each `--input` id must match a strip `id` in the scene; a strip nothing names is fed silence, which is the right behavior for a bed you deliberately withhold on some episodes but a silent surprise if you typo `music-bed` as `musicbed`.

## Step 4 — Master with the speech preset

```bash
sonare mastering show.wav --preset speech -o show-master.wav --json
```

```json
{"mode": "preset", "input_lufs": -21.13, "output_lufs": -16.01, "applied_gain_db": 6.95, "output": "show-master.wav", "preset": "speech", "stages": ["repair.denoise", "eq.tilt", "dynamics.deesser", "dynamics.compressor", "loudness.optimize"]}
```

The assistant can start from the same named preset and add its explanation to the report:

```bash
sonare mastering show.wav --assistant --preset speech --explain --target-platform podcast -o show-assistant.wav --report show-report.json --json
```

```json
{"mode": "assistant", "input_lufs": -21.13, "output_lufs": -16.01, "applied_gain_db": 6.29, "stages": ["repair.denoise", "eq.tilt", "dynamics.deesser", "dynamics.compressor", "stereo.monoMaker", "loudness.optimize"], "explanation": ["base preset: speech", "target loudness and ceiling applied from AssistantConfig", "speech preset enables de-esser and mono compatibility"]}
```

The standalone `speech` preset targets its built-in -16 LUFS. The assistant run starts from the same chain and gets -16 LUFS from `--target-platform podcast`; it also adds the speech preset's low-frequency mono-maker stage and includes the reasons in `explanation`. The assistant never infers a genre from the audio, so the `--preset speech` choice stays visible and reproducible.

::: warning Clean the voices before the mix, not the finished show
Both runs start with `repair.denoise`, and at this point it runs over the whole show, music bed included. Noise reduction on music smears its sustain and leaves watery artifacts, and the bed needs none. With real recordings, clean each voice before Step 3 and switch the master's denoise off:

```bash
sonare repair host.wav -o host-clean.wav --explain --json
sonare repair guest.wav -o guest-clean.wav --explain --json
# Mix host-clean.wav and guest-clean.wav in Step 3, then:
sonare mastering show.wav --preset speech --params repair.denoise.enabled=0 \
  -o show-master.wav --json
```

With `repair.denoise.enabled=0` the stage list starts at `eq.tilt`; the same `--params` works on the `--assistant` run. `repair` measures each voice and runs only the stages its evidence calls for (see [Clean Up a Batch of Recordings](./recording-cleanup.md)); it scales a voice whose repaired peak went past full scale back to full scale, so check the voice levels again before you mix. The host strip in this scene also carries its own de-esser, so the master's `dynamics.deesser` is a second pass on the host: if the host's "s" sounds start to lisp, lower one of the two.
:::

::: danger `--target-platform` requires `--assistant`
```bash
sonare mastering show.wav --preset speech --target-platform podcast -o x.wav --json
# Error: --target-platform requires --assistant
# exit code 3
```
The platform target is an assistant input, not a global option. A standalone `--preset` run cannot combine it, so the flag is rejected. Use `--assistant --preset speech --target-platform podcast` when you need both the named speech chain and the platform target.
:::

`--target-platform` accepts eight names, but only four of them change anything:

| `--target-platform` | Loudness target | True-peak ceiling |
|---|---|---|
| `broadcast` | -23 LUFS | -1 dBTP |
| `podcast` | -16 LUFS | -1 dBTP |
| `club`, `cd` | -9 LUFS | -0.3 dBTP |
| `streaming`, `youtube`, `audiobook`, `cinema` | whatever `--target-lufs` says (default -14 LUFS) | whatever `--ceiling-db` says (default -1 dBTP) |

The last row applies nothing of its own. In particular, `--target-platform audiobook` on its own masters to -14 LUFS and -1 dBTP, which is louder and hotter than audiobook distributors usually accept (commonly RMS between -23 and -18 dBFS, with peaks at or below -3 dBFS). For an audiobook, pass the numbers yourself and check them against the distributor's spec:

```bash
sonare mastering chapter.wav --assistant --preset speech \
  --target-lufs -20 --ceiling-db -3 -o chapter-master.wav --report chapter-report.json --json
```

An explicit `--target-lufs` or `--ceiling-db` also wins over the four targets that do supply values. Full option list: `sonare mastering --help`. What each target actually asks for is in [Delivery Targets](../glossary/mastering/delivery-targets.md).

## Step 5 — Check whether your voices are safe in mono

```bash
sonare mastering show.wav --assistant --preset speech --target-platform podcast --speech-mono-amount 0 -o show-mono0.wav --json
sonare mastering show.wav --assistant --preset speech --target-platform podcast --speech-mono-amount 1 -o show-mono1.wav --json
if cmp -s show-mono0.wav show-mono1.wav; then
  echo "mono amount did not change these files"
else
  echo "mono amount changed the render"
fi
```

`--speech-mono-amount` (0–1, default 1) controls how much of the `speech` preset's side signal below its 120 Hz mono-maker crossover is collapsed toward mono. The assistant applies it because `--preset speech` selects that preset; it does not depend on audio genre classification. A value of `0` leaves that low-frequency side signal unchanged, while `1` removes that side component through the crossover; higher frequencies retain their side signal. The audible and byte-level difference depends on how much low-frequency side information the episode carries.

The reason to test the low-frequency fold still applies to a real show: a phone speaker, a Bluetooth earbud in mono-call mode, and a podcast app's "boost voice" setting all sum left and right before playback. `host`'s `pan: 0` and `guest`'s `pan: 0.1` in this preset are already close to center, so the amount matters most when the recordings carry wider low-frequency side information, such as a stereo room mic on the guest.

::: tip Verify the preset before trusting a speech-only flag
Run with `--explain` and check for `speech preset enables de-esser and mono compatibility` in `explanation`. That confirms the assistant started from the speech preset and applied the speech-specific stage.
:::

## Step 6 — Read the loudness that matters

`--report show-report.json` from the podcast-targeted assistant run holds the number that decides whether the episode is ready:

```json
{
  "before": { "integrated_lufs": -21.13, "true_peak_dbtp": -10.92 },
  "after":  { "integrated_lufs": -16.01, "true_peak_dbtp": -4.63 },
  "applied_gain_db": 6.29,
  "max_gain_reduction_db": -1.15,
  "loudness_target_limited": false
}
```

-16 LUFS is what `--target-platform podcast` asked for, and `after.integrated_lufs` is the measured result. `loudness_target_limited: false` means the requested target was reached within the configured constraints; it does not mean that the limiter was inactive or that the master is finished. `max_gain_reduction_db` reports the actual maximum gain reduction. Check the report's loudness and true-peak values, then audition the result. See [LUFS](../glossary/lufs.md) for what the number means and [Delivery Targets](../glossary/mastering/delivery-targets.md) for what other platforms expect instead of -16.

As with the four-stem case in [Mix and Master a Song in the CLI](./cli-mix-and-master.md), a separate `sonare lufs show-master.wav` call would disagree with this figure — it downmixes to mono first and warns on stderr before doing so. For a stereo deliverable, the mastering report's number is the one to believe.

## Where to go next

- The bed or the voices themselves have noise, clicks, or hum before any of this — [Clean Up a Batch of Recordings](./recording-cleanup.md).
- You want this episode's loudness checked automatically before every release — [Gate a Delivery in CI](./delivery-check.md).
- The scene and insert JSON shapes used here are documented field by field in [Mixing Scene JSON](../mixing-scene-json.md), the ducking and dynamics processors in [Mastering Processors](../mastering-processors.md), and the assistant's decision rules in [Mastering Assistant](../mastering-assistant.md).
- You want this pipeline embedded in an app instead of a script — [Mixing Engine](../mixing.md) covers the same scene and strip model through the [CLI Reference](../cli.md) and the language APIs.
