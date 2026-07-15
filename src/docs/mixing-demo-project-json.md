---
title: Mixing Demo Project JSON
description: The browser /mixing demo's UI project file — a per-track arrangement format saved and reopened by the demo, distinct from the mixer scene exchange format.
---

# Mixing Demo Project JSON

The `/mixing` demo exports a small **UI project** file so a browser session can be saved and reopened later. It stores per-track arrangement settings — **not** decoded audio.

::: warning This is not the mixer scene format
This is a different exchange format from the [Mixing Scene JSON](./mixing-scene-json.md) reference. A *scene* describes a whole mixer graph — strips, buses, VCA groups, and connections — and round-trips through `Mixer.toSceneJson()` / `fromSceneJson()`. The demo project file below is a flat, per-track arrangement read only by the browser demo; the engine's `fromSceneJson(...)` does not accept it. If you are driving the mixer, you want the scene format, not this one.
:::

## Shape

The example below is abbreviated — it shows a representative subset of keys. A real export also carries additional top-level fields (such as `reverb` and `vcaGains`) and more per-track settings.

```json
{
  "version": 1,
  "masterFaderDb": 0,
  "tracks": [
    {
      "id": "track-id",
      "name": "Lead Vocal",
      "offsetSeconds": 1.5,
      "inputTrimDb": 0,
      "faderDb": -3,
      "pan": 0,
      "width": 1,
      "muted": false,
      "soloed": false,
      "polarityLeft": false,
      "polarityRight": false
    }
  ]
}
```

`offsetSeconds` is the clip start time on the arrangement timeline; the demo pads each stem by that amount before calling the WASM mixer, so the visual start time is preserved in the offline bounce. Because the file excludes audio, re-import matches tracks by `id` (or `name`) once the audio is loaded again.

## Related

- [Mixing Scene JSON](./mixing-scene-json.md) — the engine's mixer scene exchange format (the one you load with `fromSceneJson`)
- [Mixing Engine](./mixing.md) — the API guide and signal flow
