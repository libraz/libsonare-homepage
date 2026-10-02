---
title: Mixing Demo Project JSON
description: The browser /mixing demo's UI project file — a per-track arrangement format saved and reopened by the demo, distinct from the mixer scene exchange format.
---

# Mixing Demo Project JSON

The [Mixing Studio](/mixing) exports a **project settings** file containing per-track arrangement and mixing controls. It excludes decoded audio. Use **Export project settings** to save `libsonare-mix-project.json`; load the matching audio files, then use **Import project settings** to restore the controls. For the app architecture and source files, see [Build a Browser Mixer](./use-cases/browser-mixer.md).

::: warning This is not the mixer scene format
This is a different exchange format from the [Mixing Scene JSON](./mixing-scene-json.md) reference. A *scene* describes a whole mixer graph — strips, buses, VCA groups, and connections — and round-trips through `Mixer.toSceneJson()` / `fromSceneJson()`. The demo project file below is a flat, per-track arrangement read only by the browser demo; the engine's `fromSceneJson(...)` does not accept it. If you are driving the mixer, you want the scene format, not this one.
:::

The demo below is the engine's own lane mixer rather than the `/mixing` page, but it plays exactly what this file describes: three tracks, each with a fader and a mute. Each band is one entry in `tracks[]` — the fader is that entry's `faderDb` and the mute is its `muted`, and the demo hands both to the engine through the scene format's strip (`strips[].faderDb`) and `setSoloMute`. What the demo has no counterpart for is `offsetSeconds`: its clips all start at zero. Placing a track later on the timeline is what this file adds on top of the strip settings the engine already understands.

<SonareDemo id="engine-lane-mixer" />

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

Partial settings files are accepted: include at least one of `masterFaderDb`, `reverb`, `vcaGains`, or `tracks`. If present, `version` must be `1`, `tracks` must be an array of track settings with an `id` or `name`, and `reverb` and `vcaGains` must be objects. Engine scenes with `strips`, `buses`, or `connections` are rejected before any controls change. The loader also accepts settings files without a `version` field.

Supplied control values must have their expected types. Numeric values must be finite numbers; a string such as `"-6"` is rejected. Invalid controls or automation entries reject the whole file before settings are applied.

Omitted top-level settings retain their current values. Within supplied track or reverb settings, missing control values fall back to their defaults. Out-of-range values are clamped (`faderDb` to -60…+12 dB, `masterFaderDb` and each `vcaGains` entry to -24…+12 dB, `offsetSeconds` so the clip still fits the timeline).

`offsetSeconds` is the clip start time on the arrangement timeline; the demo pads each stem by that amount before calling the WASM mixer, so the visual start time is preserved in the offline bounce. Because the file excludes audio, re-import matches tracks by `id` (or `name`) once the audio is loaded again; settings that match no loaded track are dropped, and the demo says so when nothing applied.

## Related

- [Mixing Scene JSON](./mixing-scene-json.md) — the engine's mixer scene exchange format (the one you load with `fromSceneJson`)
- [Mixing Engine](./mixing.md) — the API guide and signal flow
