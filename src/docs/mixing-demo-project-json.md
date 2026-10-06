---
title: Mixing Demo Project JSON
description: The browser /mixing demo's project file (v2) — the whole mix state without audio, saved and reopened by the demo, with the v1 conversion; distinct from the mixer scene exchange format.
---

# Mixing Demo Project JSON

The [Mixing Studio](/mixing) saves its whole mix state as `libsonare-mix-project.json`: tracks with their clips, strips, sends, and automation, the two aux buses, the master, VCA gains, and the loop range. The file excludes decoded audio. Use **Save project JSON** to write it and **Open project JSON** to read it back; the tracks come back waiting for audio, and each file you add attaches to the track with the same name, otherwise to the next one in order. For the app architecture and source files, see [Build a Browser Mixer](./use-cases/browser-mixer.md).

::: warning This is not the mixer scene format
This is a different exchange format from the [Mixing Scene JSON](./mixing-scene-json.md) reference. A *scene* describes a whole mixer graph — strips, buses, VCA groups, and connections — and round-trips through `Mixer.toSceneJson()` / `fromSceneJson()`. The demo project file below is the state of a fixed-layout console, read only by the browser demo; the engine's `fromSceneJson(...)` does not accept it, and the demo rejects a scene file.
:::

The demo below is the engine's own lane mixer rather than the `/mixing` page, but it plays what a project's tracks describe: three tracks, each with a fader and a mute. Each band is one entry in `tracks[]` — the fader is that entry's `faderDb` and the mute is its `muted`, and the demo hands both to the engine through the scene format's strip (`strips[].faderDb`) and `setSoloMute`. What the demo has no counterpart for is `clip.startSec`: its clips all start at zero. Placing a track later on the timeline is what the project file adds on top of the strip settings the engine already understands.

<SonareDemo id="engine-lane-mixer" />

## Fixed layout

Every track has the same strip: six EQ bands, then six insert slots in order — `trim`, `gate`, `comp`, `deess`, `duck`, `width` — and two sends, to the `reverb` and `delay` buses. The master has two slots, `glue` and `limiter`. A bypassed slot stays in the file, so slot positions never change. Positions in the file are seconds; the engine runs at 60 bpm, so one second is one quarter note.

## Shape (version 2)

The example is abbreviated: a real file lists all six EQ bands and every slot parameter.

```json
{
  "version": 2,
  "tracks": [
    {
      "id": 1,
      "name": "Lead Vocal",
      "sourceDurationSec": 42.5,
      "clip": { "startSec": 1.5, "trimStartSec": 0, "lengthSec": null, "fadeInSec": 0.02, "fadeOutSec": 0.5 },
      "faderDb": -3,
      "pan": 0,
      "panLaw": 0,
      "panMode": 0,
      "dualPanLeft": -1,
      "dualPanRight": 1,
      "channelDelayMs": 0,
      "polarityLeft": false,
      "polarityRight": false,
      "muted": false,
      "soloed": false,
      "soloSafe": false,
      "vcaGroup": null,
      "eq": [
        { "type": "HighPass", "frequencyHz": 30, "gainDb": 0, "q": 0.707, "enabled": false }
      ],
      "slots": {
        "trim": { "bypassed": false, "params": { "levelDb": 0 } },
        "comp": { "bypassed": true, "params": { "thresholdDb": -18, "ratio": 2 } },
        "width": { "bypassed": false, "params": { "width": 1 } }
      },
      "duckKeyTrackId": null,
      "sends": {
        "reverb": { "levelDb": -18, "timing": "postFader" },
        "delay": { "levelDb": -60, "timing": "postFader" }
      },
      "automation": {
        "fader": [{ "id": "p1", "timeSec": 8, "value": -6, "curve": "linear" }],
        "pan": [],
        "width": []
      }
    }
  ],
  "buses": {
    "reverb": { "gainDb": 0, "params": { "decay": 0.566, "damping": 0.5, "preDelayMs": 20, "dryWet": 1 } },
    "delay": { "gainDb": 0, "params": { "delayTimeLMs": 250, "delayTimeRMs": 250, "feedback": 0.25, "pingPong": 0, "dryWet": 1 } }
  },
  "master": {
    "faderDb": 0,
    "slots": {
      "glue": { "bypassed": true, "params": {} },
      "limiter": { "bypassed": false, "params": { "ceilingDb": -1, "releaseMs": 50 } }
    }
  },
  "vcaGains": { "A": 0, "B": 0, "C": 0 },
  "loop": { "enabled": false, "startSec": 0, "endSec": 0 }
}
```

- `id` is a positive integer, unique within the file. A send at or below `-60` dB is not routed. `lengthSec: null` plays the rest of the source.
- `eq` has exactly six bands. `type` is one of the engine's EQ band types (`Peak`, `LowShelf`, `HighShelf`, `LowPass`, `HighPass`, `BandPass`, `Notch`, `TiltShelf`, `FlatTilt`, `AllPass`).
- `curve` is `linear`, `exponential`, `hold`, or `s-curve`, and shapes the segment up to the next point. Each lane is `fader` (dB), `pan`, or `width`.
- `vcaGroup` is `"A"`, `"B"`, `"C"`, or `null`. `duckKeyTrackId` names the track whose signal keys the `duck` slot, or `null` to key it from the track's own input.
- A file holds at most eight tracks.

Omitted fields take the demo's defaults. A present field of the wrong type, a slot parameter the slot does not have, a duplicate track id, a `duckKeyTrackId` that names no track or that keys a track from itself through a chain of keys, or an `eq` array that is not six bands rejects the whole file before anything changes. Numeric values must be finite numbers; a string such as `"-6"` is rejected.

Opening a v2 file replaces the whole project, undoably.

## Reading a version 1 file

A v1 file is a flat per-track settings file with `"version": 1` (or no `version`). The demo converts it onto the tracks currently loaded, so load the matching audio first. A notice says the file was converted.

```json
{
  "version": 1,
  "masterFaderDb": 0,
  "tracks": [
    { "id": "track-id", "name": "Lead Vocal", "offsetSeconds": 1.5, "inputTrimDb": 0, "faderDb": -3, "pan": 0, "width": 1, "muted": false, "soloed": false }
  ]
}
```

A v1 file must carry at least one of `masterFaderDb`, `reverb`, `vcaGains`, or `tracks`; `tracks` entries need an `id` or a `name`, and every supplied control must have its expected type. An engine scene (`strips`, `buses`, or `connections`) is rejected. Anything that is neither a valid v1 nor a valid v2 file is refused.

The conversion follows these rules:

- Tracks match by `id` or `name`. A v1 track that matches no loaded track is dropped, and the notice lists its name. Omitted top-level settings keep their current values, and a supplied track takes defaults for what it omits.
- `offsetSeconds` becomes `clip.startSec`, kept inside the timeline. `inputTrimDb` becomes the `trim` level and `width` the `width` slot.
- Tone becomes strip EQ. A tilt of *t* dB is a low shelf at −*t*/2 and a high shelf at +*t*/2, both at 1 kHz; air is a high shelf at 12 kHz in the second Peak slot. A track with `eqEnabled: false` gets the default, disabled EQ.
- `reverbSendDb` becomes the post-fader send to the `reverb` bus; a v1 `reverb.enabled: false` turns those sends off. `reverb.decaySec` and `reverb.preDelayMs` set the plate's decay and pre-delay.
- A v1 automation list, which held every parameter in one array keyed by `param`, splits into the `fader`, `pan`, and `width` lanes, sorted by time. An unknown curve becomes `linear`.
- Values are clamped to the v1 ranges: `faderDb` to −60…+12 dB, `masterFaderDb` and each `vcaGains` entry to −24…+12 dB, `inputTrimDb` to ±24 dB, `pan` to ±1, `width` to 0…2, `channelDelayMs` to 0…50, and a send to −60…0 dB.

## Related

- [Mixing Scene JSON](./mixing-scene-json.md) — the engine's mixer scene exchange format (the one you load with `fromSceneJson`)
- [Mixing Engine](./mixing.md) — the API guide and signal flow
