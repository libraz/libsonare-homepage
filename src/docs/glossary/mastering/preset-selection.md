---
title: Choosing a Mastering Preset
description: How to choose among the genre presets and the five repair-only restoration presets (vinyl, tapeHiss, fieldRecording, voiceMemo, shellac78) without treating presets as magic.
---

# Choosing a Mastering Preset

Presets are starting points. They choose a sensible chain shape for the source, but they cannot know the mix intent better than you do.

Use the preset that matches the material's density, its transient behavior (how sharp the attacks of drums and consonants are), and where the track will be published. Then use the fine-tune controls or Studio mode for small corrections.

## Preset Guide

| Preset | Best for | What it tends to protect |
|--------|----------|--------------------------|
| Pop | General modern mixes. | Balanced loudness, vocal presence, stable tone. |
| EDM / Dance | Dense electronic music. | Controlled peaks, tighter release behavior, strong final level. |
| Acoustic | Sparse or natural recordings. | Transients, breathing room, low compression. |
| Hip-Hop / R&B | Beat-forward tracks with focused vocals. | Low-end weight and vocal center. |
| AI-Generated | Suno/Udio-style sources or generated artifacts. | Denoise, upper-band restoration, controlled polish. |
| Speech / Podcast | Spoken content, narration, voice-first material. | Voice clarity, conservative width, steady loudness. |

## How To Decide

If two presets sound close, choose the one that does less harm. A preset that makes the track louder and brighter may feel impressive for a few seconds but become tiring.

Practical workflow:

1. Start with Pop unless the material clearly belongs elsewhere.
2. Try the most specific preset for the source.
3. Render and compare with loudness matching enabled.
4. If the specialized preset over-processes the source, return to Pop or Acoustic.
5. Move to Studio only for the control you can clearly name.

## AI-Generated Sources

AI-generated music can have weak upper harmonics, hiss, smeared transients, or a glossy reverb-like residue. The AI-Generated preset leans on repair and air-band restoration for that reason: in the engine, `aiMusic` is one of the few genre presets that enables repair stages at all, running `declick`, `denoise`, and `dereverb` before its tonal chain.

Do not use it automatically on every generated track. If the source is already bright or brittle, a simpler preset may be better.

::: warning Don't reach for the AI-Generated preset reflexively
Its repair and air-band restoration assume a dull, hissy, or artifact-laden source. On a track that is already bright or brittle it over-processes — a simpler preset such as Pop is safer.
:::

## Restoration Presets: Repair Only

Five engine presets are different in kind from the rest: `vinyl`, `tapeHiss`, `fieldRecording`, `voiceMemo`, and `shellac78`. They enable repair stages only and leave level alone. No loudness target, no true-peak ceiling, no EQ, no dynamics. Reach for one when the question is "what is wrong with this recording", not "how should this track sound". They are not in the demo's preset menu; they are reached by name from the CLI (`--preset`), the bindings, or a chain config.

The stages themselves, their order, and their parameters are covered on [Repair and Input Controls](./repair.md) and [Mastering Processors](../../mastering-processors.md). This section is only about which preset to choose.

| Preset | Damage it targets | Stages it enables |
|--------|-------------------|-------------------|
| `vinyl` | LP transfer: groove clicks and pops, surface crackle, a floor under everything. | `declick`, `decrackle`, `denoise`, all at their defaults. |
| `shellac78` | 78 rpm transfer: wider pops, denser crackle, a higher floor. | The same three, each tuned harder: a wider click cap, a more sensitive crackle threshold, and a 32 dB denoise depth instead of 26. |
| `tapeHiss` | Tape: broadband hiss and nothing else. | `denoise` only. |
| `fieldRecording` | Location capture: mains hum that drifts, an ambient floor, and the space itself. | `dehum` with adaptive tracking, `denoise`, `dereverb`. |
| `voiceMemo` | Phone or laptop capture: clipping against the device's own gain control, a high mic floor, an untreated room. | `declip`, `denoise`, `dereverb`. |

### Listen, Then Choose

- Ticks and pops between notes over a steady bed of surface noise: `vinyl`. If the pops are wide and dull rather than sharp, and the bed is dense enough to sound continuous, `shellac78` runs the same three stages with each one pushed further.
- A constant hiss with no ticks and no buzz: `tapeHiss`. It is the smallest preset, one stage, so it is also the right first try on any source whose only complaint is hiss.
- A low buzz that stays on through silence, plus a sense of distance or open air: `fieldRecording`. Its `dehum` tracks the true mains fundamental instead of assuming the configured 50 Hz, which is what makes it the pick for gear that ran off an unknown circuit.
- Loud words that flatten or crunch, a hissy floor, and a small-room echo: `voiceMemo`. It is the only restoration preset that runs `declip`; a clipped voice memo put through `fieldRecording` keeps its distortion.

Two gaps to know about before choosing: only `fieldRecording` runs `dehum`, and only `voiceMemo` runs `declip`. A humming LP transfer or a clipped tape does not have a preset that covers both defects.

### When None of the Five Matches

Two roads, and both keep the preset as a starting point rather than a verdict:

1. **Let the file decide.** `sonare repair` without `--preset` measures the six detectors and enables only the stages the evidence calls for; `--explain` prints the reason behind each one. This is the right road for a mixed case such as a clipped vinyl transfer.
2. **Start from the nearest preset and add the missing stage.** Every stage has a `repair.<stage>.enabled` key, so `--preset vinyl --params repair.dehum.enabled=true` is vinyl plus a hum notch. `--params` on `repair` accepts `repair.` keys only.

Restoration presets set no level. Once the damage is gone, master the result as a second pass with a genre preset, or build one chain config that carries both; `aiMusic`, `speech`, and `audiobook` are genre presets that already do.

:::: details Implementation notes

The preset is converted into a libsonare mastering configuration before rendering.

Presets adjust compressor timing, ratio behavior, repair activation, air-band amount, exciter focus, stereo width limits, and limiter release behavior. The restoration presets' stage sets come from the engine's own preset table, so what `--preset voiceMemo` runs from the CLI is exactly what a chain config built from that preset carries.

The Quick Master Tone, Width, and Dynamics controls then apply macro-level offsets on top of those preset defaults.

When you change individual stages directly in Studio mode, that state is mirrored into the JSON report. The report records both the applied preset name and the overridden parameter values, so it is possible to reconstruct exactly which preset you started from and where you departed from it.

::::

Related: [Repair and Input Controls](./repair.md), [Dynamics Controls](./dynamics.md), [Tone and Air Controls](./tone-air.md), [Delivery Targets](./delivery-targets.md), [Mastering Processors](../../mastering-processors.md)
