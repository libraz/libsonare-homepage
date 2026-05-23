---
title: Choosing a Mastering Preset
description: How to choose Pop, EDM, Acoustic, Hip-Hop, AI-Generated, or Speech without treating presets as magic.
---

# Choosing a Mastering Preset

Presets are starting points. They choose a sensible chain shape for the source, but they cannot know the mix intent better than you do.

Use the preset that matches the material's density, transient behavior, and release context. Then use the fine-tune controls or Studio mode for small corrections.

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

AI-generated music can have weak upper harmonics, hiss, smeared transients, or a glossy reverb-like residue. The AI-Generated preset leans on repair and air-band restoration for that reason.

Do not use it automatically on every generated track. If the source is already bright or brittle, a simpler preset may be better.

:::: details Implementation notes

The preset is converted into a libsonare mastering configuration before rendering. Presets adjust compressor timing, ratio behavior, repair activation, air-band amount, exciter focus, stereo width limits, and limiter release behavior. The Quick Master Tone, Width, and Dynamics controls then apply macro-level offsets on top of those preset defaults.

When you change individual stages directly in Studio mode, that state is mirrored into the JSON report. The report records both the applied preset name and the overridden parameter values, so it is possible to reconstruct exactly which preset you started from and where you departed from it.

::::

Related: [Dynamics Controls](./dynamics.md), [Tone and Air Controls](./tone-air.md), [Delivery Targets](./delivery-targets.md)
