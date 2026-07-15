---
title: Mixing Scene JSON
description: The mixer scene exchange format — every strip, insert, send, bus, VCA, and connection field — with an annotated built-in preset and the browser demo project format.
---

# Mixing Scene JSON

A **scene** is the pure-data description of a whole mixer.

It is the format `Mixer.fromSceneJson(...)` reads and `toSceneJson()` writes. In Python, the names are `from_scene_json(...)` and `to_scene_json()`.

The format is identical across WASM, Python, Node, the C ABI, and C++. Because it is plain JSON, you can store it with a project, diff it in git, hand-edit it, and reload it later.

If you have not met strips, sends, and buses yet, read [Mixing Basics](./glossary/concepts/mixing-basics.md) and the [Mixing Engine](./mixing.md) guide first — this page is the field-by-field reference.

The demo below shows the same routing ideas without JSON: lanes feed a small mixer, sends and levels change the output, and the meters respond immediately. Use it first if the scene fields feel abstract, then come back to the schema with the signal flow in mind.

<SonareDemo id="engine-lane-mixer" />

## What You Will Learn

By the end of this page you should be able to:

- recognize the top-level scene shape and the role of strips, buses, VCA groups, and connections;
- edit or generate a scene without confusing strip controls, inserts, sends, and routing edges;
- understand which fields have defaults and which identifiers must match across the graph;
- use a built-in preset as the safest starting point for custom scene JSON.

::: tip Learn the format by example
The fastest way to understand the schema is to print a built-in preset and read it: `mixingScenePresetJson('vocalReverbSend')`. Every field below appears in that output, so you can match each key to a real value. The [annotated preset](#a-complete-annotated-scene) at the end of this page does exactly that.
:::

## Top-level shape

```json
{
  "version": 1,
  "strips": [],
  "buses": [],
  "vcaGroups": [],
  "connections": []
}
```

| Field | Type | Meaning |
|-------|------|---------|
| `version` | integer | Schema version. Currently **must be `1`**; other values are rejected. |
| `strips` | array | The track lanes (see [Strip](#strip)). |
| `buses` | array | Shared destinations, including the `master` (see [Bus](#bus)). |
| `vcaGroups` | array | Level groups that trim several strips at once (see [VCA group](#vca-group)). |
| `connections` | array | The routing graph edges (see [Connection](#connection)). |

::: warning Unknown keys are skipped — but insert params are audited
The parser ignores scene fields it does not recognize, so a forward-compatible producer can add metadata without breaking older readers. The flip side: a **misspelled scene key is silently dropped** — `processorName` (wrong) vs `processor` (right) is a classic. If a setting seems to have no effect, check the spelling against the tables below.

Insert `params` keys get a safety net: after a scene loads, every param key that no processor consumed is reported as a **non-fatal warning** through `Mixer.sceneWarnings()` (Python `scene_warnings()`). The scene still loads and the unknown keys simply take no effect — read the warnings right after loading to catch typos instead of hunting for a knob that "does nothing". Enumerate the keys an insert actually reads with `masteringInsertParamNames(name)` (Python `mastering_insert_param_names(name)`).
:::

## Strip

Each strip object describes one channel lane. All numeric fields have sensible defaults, so a minimal strip is just `{ "id": "vocal" }`.

| Field | Type | Default | Meaning |
|-------|------|---------|---------|
| `id` | string | — (required) | Unique strip identifier used by connections, sends, and VCA members |
| `inputTrimDb` | number | `0` | Gain before any processing (the first stage in the [strip signal flow](./mixing.md#the-channel-strip-signal-by-signal)) |
| `faderDb` | number | `0` | Main fader level |
| `vcaOffsetDb` | number | `0` | Per-strip VCA trim summed into the fader stage (the live `setVcaOffsetDb(...)` value; separate from any [VCA group](#vca-group) `gainDb`, which is applied as a delta on top and is not stored in this field) |
| `pan` | number | `0` | Pan position, `-1` (left) … `+1` (right) |
| `width` | number | `1` | Stereo width / side multiplier (`0` = mono, `>1` = wider) |
| `muted` | boolean | `false` | Silences the strip |
| `soloed` | boolean | `false` | Implies-mutes other (non-solo-safe) strips |
| `soloSafe` | boolean | `false` | Never implied-muted by another strip's solo |
| `panMode` | integer | `0` | `0` = balance, `1` = stereo pan, `2` = dual pan |
| `dualPanLeft` | number | `-1` | Left position in dual-pan mode (default is identity hard-left, preserving the stereo image) |
| `dualPanRight` | number | `1` | Right position in dual-pan mode (default is identity hard-right) |
| `surroundPan` | object | identity | Surround-pan position for wider-than-stereo hosts. `azimuth`, `divergence`, and `lfe` affect the [realtime engine's 5.1/7.1 group-bus panner](./realtime-streaming.md#surround-group-buses-and-wide-meters); `elevation` and `distance` are reserved. The value is validated and round-tripped through scene JSON. The standalone offline `Mixer` remains stereo and therefore does not apply it |
| `polarityInvertLeft` | boolean | `false` | Inverts the left channel polarity |
| `polarityInvertRight` | boolean | `false` | Inverts the right channel polarity |
| `panLaw` | integer | `0` | `0` = const 3 dB, `1` = const 4.5 dB, `2` = const 6 dB, `3` = linear 0 dB |
| `channelDelaySamples` | integer | `0` | Per-strip delay; also feeds [PDC](./mixing.md#latency-and-plugin-delay-compensation-pdc) |
| `inserts` | array | `[]` | In-series processors (see [Insert](#insert)) |
| `sends` | array | `[]` | Parallel sends to buses (see [Send](#send)) |

::: info Enums are integers in the file, strings in the API
The scene **file** stores `panMode` and `panLaw` as integers, but insert `slot` and send `timing` are stored as the short string tokens `"pre"` / `"post"`. The JavaScript runtime **methods** accept friendly strings — `setPanLaw(strip, 'const3dB')`, `addSend(..., 'postFader')`. Python accepts the same send/tap names, but pan-law strings use normalized names such as `'const-3db'`, `'const-4.5db'`, `'const-6db'`, or `'linear-0db'` (or the enum/int value). Both map to the same underlying value; the difference is just file format vs. ergonomic API.

Serializing a scene after runtime pan edits preserves the strip's current `panMode`. Use `Mixer.toSceneJson()` / `Mixer.to_scene_json()` instead of rebuilding the pan fields by hand.

**Insert `slot` and send `timing` must be strings.** A non-string value — e.g. a numeric `"timing": 1` — is rejected at load time with an `InvalidParameter` error (`send timing must be a string ("pre" or "post")`). Always write `"pre"` or `"post"`.
:::

::: details Field terms: dual pan, polarity invert, pan law, PDC
- **Dual pan** (`panMode: 2`) — pans the left and right channels to *independent* positions instead of moving the whole signal together. Useful for narrowing or re-placing an already-stereo source.
- **Polarity invert** — multiplies a channel by −1, flipping the waveform. Used to fix a track recorded out of phase with another; it changes phase relationships, not perceived loudness on its own.
- **Pan law** — how much the center is attenuated relative to hard-left/right so loudness stays even as you pan. `const 3/4.5/6 dB` are constant-power options; `linear 0 dB` keeps the summed level steady instead. See [Mixing Engine](./mixing.md#pan-modes-and-pan-laws).
- **PDC (plugin-delay compensation)** — when one path is delayed by a lookahead processor, the engine delays the shorter paths to match so everything lines up at the master. `channelDelaySamples` feeds into that calculation.
:::

## Insert

An insert is a named processor running in series inside the strip (or a bus).

| Field | Type | Meaning |
|-------|------|---------|
| `slot` | `"pre"` \| `"post"` | Runs before or after the fader. **Note the short tokens** — not `preFader`/`postFader`. |
| `processor` | string | Processor id, e.g. `eq.parametric`, `dynamics.compressor`, `effects.reverb.plate`. See [Mastering Processors](./mastering-processors.md#mixer-insert-names). |
| `params` | string | The processor's parameters, as a **JSON string** (escaped object), e.g. `"{\"thresholdDb\":-18,\"ratio\":2.5}"`. |
| `sidechainKey` | string | *Optional.* Strip id whose signal feeds this insert's external sidechain (e.g. ducking). Omitted when empty. |

::: info Sidechain and ducking
Normally a processor reacts to the audio passing through it. A **sidechain** makes it react to a *different* track instead: `sidechainKey` names that other strip. The classic use is **ducking** — a compressor on the music that turns the music down whenever the named voice strip is loud, so speech stays clear over a music bed.
:::

::: warning `params` is a string, not an object
Inside the scene JSON, `params` holds an **escaped JSON string**, not a nested object — `"params": "{\"ratio\":2.5}"`. This keeps each processor's parameter schema opaque to the scene parser. Parse it yourself if you need to read individual values.
:::

## Send

A send routes a *copy* of the strip's signal to a destination bus. The `timing` field chooses whether the copy is tapped before the fader (`"pre"`) or after it (`"post"`) — see the [channel-strip signal flow](./mixing.md#the-channel-strip-signal-by-signal).

| Field | Type | Meaning |
|-------|------|---------|
| `id` | string | Send identifier |
| `destinationBusId` | string | The `id` of the target bus |
| `sendDb` | number | Send level in dB |
| `timing` | `"pre"` \| `"post"` | Tapped before or after the fader (again, short tokens) |

## Bus

| Field | Type | Meaning |
|-------|------|---------|
| `id` | string | Bus identifier (one bus is conventionally `"master"`) |
| `role` | string | `"master"`, `"aux"`, or a group bus such as `"submix"` |
| `inserts` | array | Processors on the bus itself (same [Insert](#insert) shape as a strip) |

::: info Only `master` and `aux` are special role tokens
The engine treats `master` and `aux` specially; **any other role string is just a generic non-master bus**. So a "drum bus" works the same whether its role is `submix`, `subgroup`, or `group` — the token is a label, not a behavior switch. The built-in `drumBusSubgroup` preset uses `subgroup`, so if you print it (`mixingScenePresetJson('drumBusSubgroup')`) you will see `"role": "subgroup"`, not `"submix"`.
:::

## VCA group

| Field | Type | Meaning |
|-------|------|---------|
| `id` | string | Group identifier |
| `gainDb` | number | Offset summed into each member's fader |
| `members` | string[] | Strip ids governed by the group |

## Connection

| Field | Type | Meaning |
|-------|------|---------|
| `source` | string | Strip or bus id the signal leaves |
| `destination` | string | Strip or bus id the signal enters |

Connections are the graph edges. A strip routed to `master` is `{ "source": "vocal", "destination": "master" }`. A send's bus reaches the master through a connection from the bus (or its return strip) to `master`.

## Built-In Presets

| Preset | Intent |
|--------|--------|
| `vocalReverbSend` | Vocal strip (EQ + compressor inserts) with a post-fader aux send into a plate-reverb return |
| `drumBusSubgroup` | Kick/snare/overheads into a group bus (role `subgroup`), made cohesive with parallel compression and tape, ridden by a "drums" VCA |
| `commentaryDucking` | Host/guest speech (de-ess + compress) with a music bed ducked via `dynamics.sidechainRouter` keyed off the host |

Discover them at runtime with `mixingScenePresetNames()` and fetch one with `mixingScenePresetJson(name)`.

## A complete, annotated scene

This is the actual output of `mixingScenePresetJson('vocalReverbSend')` (defaults trimmed for readability). It shows every relationship: a vocal strip with two pre-fader inserts and a post-fader send, a reverb return strip, two buses, and the connections that wire them to the master.

```json
{
  "version": 1,
  "strips": [
    {
      "id": "vocal",
      "faderDb": -3,
      "inserts": [
        { "slot": "pre", "processor": "eq.parametric",
          "params": "{\"band0.type\":4,\"band0.frequencyHz\":80,\"band1.frequencyHz\":4000,\"band1.gainDb\":2}" },
        { "slot": "pre", "processor": "dynamics.compressor", "params": "{\"thresholdDb\":-18,\"ratio\":2.5}" }
      ],
      "sends": [
        { "id": "vocal-to-verb", "destinationBusId": "vocal-verb", "sendDb": -14, "timing": "post" }
      ]
    },
    {
      "id": "vocal-verb-return",
      "faderDb": -10,
      "width": 1.25,
      "inserts": [
        { "slot": "post", "processor": "effects.reverb.plate", "params": "{\"decaySec\":1.8,\"preDelayMs\":25}" }
      ]
    }
  ],
  "buses": [
    { "id": "master",     "role": "master" },
    { "id": "vocal-verb", "role": "aux" }
  ],
  "vcaGroups": [],
  "connections": [
    { "source": "vocal",             "destination": "master" },
    { "source": "vocal-verb",        "destination": "vocal-verb-return" },
    { "source": "vocal-verb-return", "destination": "master" }
  ]
}
```

Trace the reverb: the **vocal** strip's post-fader send feeds the **vocal-verb** aux bus; that bus connects to the **vocal-verb-return** strip (which hosts the plate reverb); the return connects to **master**. The dry vocal also connects straight to **master**. One reverb instance, dry and wet kept separate.

::: tip The `eq.parametric` insert uses band-indexed keys
The `eq.parametric` insert reads **band-indexed** keys — `band{N}.type`, `band{N}.frequencyHz`, `band{N}.gainDb`, `band{N}.q`, and the per-band dynamic-EQ fields. In this preset, `band0` is an 80 Hz high-pass (`"band0.type": 4` is `HighPass` in the EQ band-type enum) and `band1` is a +2 dB presence bell at 4 kHz — a working high-pass + presence boost.

List the full key set with `masteringInsertParamNames('eq.parametric')`. Keys outside that list (say, a flat `highPassHz`) load fine but take no effect, and `Mixer.sceneWarnings()` reports them after the scene loads.

For one-knob tonal moves, simpler inserts remain: `eq.tilt` (`tiltDb`, `pivotHz`) for a broad bright/dark tilt, and `spectral.airBand` (`amount`, `shelfFrequencyHz`) for a high-shelf "air" lift.
:::

## Editing and re-saving

::: code-group

```typescript [Browser]
const json = mixingScenePresetJson('vocalReverbSend');
const mixer = Mixer.fromSceneJson(json, 48000, 512);

mixer.sceneWarnings();  // [] — typo'd insert params would be listed here, non-fatally

mixer.addSend(0, 'more-verb', 'vocal-verb', -18, 'postFader');  // topology change
mixer.compile();                                                 // rebuild before timing-critical work

const saved = mixer.toSceneJson();   // round-trips back to the same schema
```

```python [Python]
import libsonare as sonare

scene_json = sonare.mixing_scene_preset_json('vocalReverbSend')
mixer = sonare.Mixer.from_scene_json(scene_json, sample_rate=48000, block_size=512)

mixer.scene_warnings()  # [] — typo'd insert params would be listed here, non-fatally

mixer.add_send(0, 'more-verb', 'vocal-verb', -18, 'post_fader')  # topology change
mixer.compile()                                                  # rebuild before timing-critical work

saved = mixer.to_scene_json()   # round-trips back to the same schema
mixer.close()                   # release the native handle
```

```bash [Python CLI]
# Export a built-in scene, edit the JSON file, then render it.
sonare mixing-preset --preset vocalReverbSend > my-scene.json
sonare mix --scene my-scene.json --input vocal.wav --input reverb-return.wav -o master.wav
```

:::

::: info `mix --scene` with per-strip inputs is Python-CLI only
Rendering a whole scene from a JSON file with one `--input` per strip is implemented by the Python CLI. The C++ CLI's `mix` command is a single-strip, single-input processor (no `--scene`); use it for quick per-strip checks, not full scene renders.
:::

::: tip When to recompile
Structural edits — adding/removing buses, sends, or connections — mark the graph dirty and need `compile()` before the next timing-critical block. Parameter moves (`setSendDb` / Python `set_send_db`, `setPanLaw`), VCA group changes (add/remove/gain — applied live as control-only gain offsets on member strips), and scheduled automation do **not** need a recompile.
:::

## Browser demo project JSON

The `/mixing` demo exports a *different*, smaller file for browser sessions. It is a UI project, not a mixer scene: it stores per-track arrangement settings, **not** decoded audio.

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

- [Mixing Engine](./mixing.md) — the API guide and signal flow
- [Mixing Basics](./glossary/concepts/mixing-basics.md) — the vocabulary
- [Mastering Processors](./mastering-processors.md#mixer-insert-names) — valid `processor` ids and the extra mixer insert names
- [Binding Parity](./binding-parity.md) — per-runtime differences
