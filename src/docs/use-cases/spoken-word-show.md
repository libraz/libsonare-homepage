---
title: Produce a Spoken-Word Show
description: Host, guest, and a music bed to a ducked, loudness-compliant episode — mix with the commentaryDucking preset, master with the speech chain, and verify from the CLI, one episode at a time.
---

# Produce a Spoken-Word Show

You have three files: a host track, a guest track, and a music bed. The turns don't overlap, the bed runs the whole episode, and the deliverable is a single ducked, loudness-compliant file you can hand to a podcast host. This page does that with a built-in mixer preset and an explicit mastering preset, both picked because the job is speech, not music.

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
                insert["params"] = json.dumps({"rangeDb": 5})
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

```bash
sonare mixing-preset --preset commentaryDucking --json
```

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
                insert["params"] = json.dumps({"rangeDb": 30})
json.dump(scene, open("scene.json", "w"))
'
sonare mix --scene scene.json \
  --input host=host.wav --input guest=guest.wav --input music-bed=music-bed.wav \
  -o show-r30.wav --json
cmp show.wav show-r30.wav   # identical — no output
```

Raising `rangeDb` from the preset's default 18 to 30 changes nothing: `cmp` reports the two renders as byte-identical. On this material the host's level never calls for more than about 7 dB of reduction, so any ceiling at or above roughly 8 dB behaves the same as no ceiling at all. Lower it below that point and the edit is real — `sonare dynamics` on the whole-file mixdown shows the effect, small as it is once averaged over 8 seconds that include long stretches where the host isn't talking:

| `rangeDb` | `rms_db` (whole file) | `peak_db` |
|-----------|-----------------------|-----------|
| insert removed entirely | -22.80 | -10.79 |
| `1` | -22.85 | -10.84 |
| `5` | -22.95 | -10.92 |
| `18` (preset default) | -22.96 | -10.92 |
| `30` | -22.96 (identical bytes to `18`) | -10.92 |

`rangeDb: 5` is the value the script at the top of this page ships with — a slightly shallower duck than the preset default, verified against the table above rather than guessed.

::: warning A cap you never hit is not a cap you tuned
If lowering `rangeDb` does nothing to your render either, the problem isn't the parameter — it's that your host track sits quieter than the threshold the router reacts to, so no ducking is being requested at all. Confirm the duck is engaging at the preset default before spending time tuning how deep it goes.
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

::: danger `--target-platform` requires `--assistant`
```bash
sonare mastering show.wav --preset speech --target-platform podcast -o x.wav --json
# Error: --target-platform requires --assistant
# exit code 3
```
The platform target is an assistant input, not a global option. A standalone `--preset` run cannot combine it, so the flag is rejected. Use `--assistant --preset speech --target-platform podcast` when you need both the named speech chain and the platform target.
:::

`--target-platform` accepts `streaming`, `youtube`, `broadcast`, `podcast`, `audiobook`, `cinema`, `club`, or `cd`. `broadcast`, `podcast`, `club`, and `cd` supply their own loudness and ceiling when the corresponding values were not explicit; the other accepted names leave the current values unchanged. Full option list: `sonare mastering --help`. What each target actually asks for is in [Delivery Targets](../glossary/mastering/delivery-targets.md).

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

-16 LUFS is what `--target-platform podcast` asked for, and `output_lufs` landed there. `loudness_target_limited: false` means the chain reached that target on gain alone, without the true-peak ceiling forcing it to stop short — see [LUFS](../glossary/lufs.md) for what the number means and [Delivery Targets](../glossary/mastering/delivery-targets.md) for what other platforms expect instead of -16.

As with the four-stem case in [Mix and Master a Song in the CLI](./cli-mix-and-master.md), a separate `sonare lufs show-master.wav` call would disagree with this figure — it downmixes to mono first and warns on stderr before doing so. For a stereo deliverable, the mastering report's number is the one to believe.

## Where to go next

- The bed or the voices themselves have noise, clicks, or hum before any of this — [Clean Up a Batch of Recordings](./recording-cleanup.md).
- You want this episode's loudness checked automatically before every release — [Gate a Delivery in CI](./delivery-check.md).
- The scene and insert JSON shapes used here are documented field by field in [Mixing Scene JSON](../mixing-scene-json.md), the ducking and dynamics processors in [Mastering Processors](../mastering-processors.md), and the assistant's decision rules in [Mastering Assistant](../mastering-assistant.md).
- You want this pipeline embedded in an app instead of a script — [Mixing Engine](../mixing.md) covers the same scene and strip model through the [CLI Reference](../cli.md) and the language APIs.
