---
title: Mixing Scene JSON
description: The mixer scene exchange format — every strip, insert, send, bus, VCA, and connection field — the shipped JSON Schema, and an annotated built-in preset.
---

# Mixing Scene JSON

A **scene** is the pure-data description of a whole mixer.

It is the format `Mixer.fromSceneJson(...)` reads and `toSceneJson()` writes. In Python, the names are `from_scene_json(...)` and `to_scene_json()`.

The format is identical across WASM, Python, Node, the C ABI, and C++. Because it is plain JSON, you can store it with a project, diff it in git, hand-edit it, and reload it later. A JSON Schema for it, `mixer-scene.schema.json`, ships inside the npm and Python packages so a hand-written or generated scene can be checked before it ever reaches a mixer — see [Validating a scene against the schema](#validating-a-scene-against-the-schema).

If you have not met strips, sends, and buses yet, read [Mixing Basics](./glossary/concepts/mixing-basics.md) and the [Mixing Engine](./mixing.md) guide first — this page is the field-by-field reference.

The demo below shows the same routing ideas without JSON: lanes feed a small mixer, sends and levels change the output, and the meters respond immediately. Use it first if the scene fields feel abstract, then come back to the schema with the signal flow in mind.

<SonareDemo id="engine-lane-mixer" />

## What You Will Learn

By the end of this page you should be able to:

- recognize the top-level scene shape and the role of strips, buses, VCA groups, and connections;
- edit or generate a scene without confusing strip controls, inserts, sends, and routing edges;
- understand which fields have defaults and which identifiers must match across the graph;
- validate a scene against the shipped JSON Schema, and know which mistakes only the loader can catch;
- use a built-in preset as the safest starting point for custom scene JSON.

::: tip Learn the format by example
The fastest way to understand the format is to print a built-in preset and read it: `mixingScenePresetJson('vocalReverbSend')`. Every field below appears in that output, so you can match each key to a real value. The [annotated preset](#a-complete-annotated-scene) at the end of this page does exactly that.
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
| `version` | integer | Format version. Currently **must be `1`**; other values are rejected. The schema requires the key; the loader treats a missing `version` as `1`. |
| `strips` | array | The track lanes (see [Strip](#strip)). |
| `buses` | array | Shared destinations, including the `master` (see [Bus](#bus)). |
| `vcaGroups` | array | Level groups that trim several strips at once (see [VCA group](#vca-group)). |
| `connections` | array | The routing graph edges (see [Connection](#connection)). |

::: warning The loader skips unknown keys — the schema does not
The parser ignores scene fields it does not recognize, so a forward-compatible producer can add metadata without breaking older readers. The flip side: a **misspelled scene key is silently dropped** — `processorName` (wrong) vs `processor` (right), or `faderDB` for `faderDb`, leaves the fader sitting at its default with no error. The shipped schema closes exactly this hole: every object in it is `additionalProperties: false`, so a validator reports the misspelling before the file is loaded.

Insert `params` keys get a separate safety net: after a scene loads, every param key that no processor consumed is reported as a **non-fatal warning** through `Mixer.sceneWarnings()` (Python `scene_warnings()`). The scene still loads and the unknown keys simply take no effect — read the warnings right after loading to catch typos instead of hunting for a knob that "does nothing". Enumerate the keys an insert actually reads with `masteringInsertParamNames(name)` (Python `mastering_insert_param_names(name)`).
:::

## Strip

Each strip object describes one channel lane. All numeric fields have sensible defaults, so a minimal strip is just `{ "id": "vocal" }`.

| Field | Type | Default | Meaning |
|-------|------|---------|---------|
| `id` | string | — (required) | Unique strip identifier used by connections, sends, and VCA members |
| `inputTrimDb` | number | `0` | Gain before any processing (the first stage in the [strip signal flow](./mixing.md#the-channel-strip-signal-by-signal)) |
| `faderDb` | number | `0` | Main fader level |
| `vcaOffsetDb` | number | `0` | Per-strip VCA trim summed into the fader stage (the live `setVcaOffsetDb(...)` value; separate from any [VCA group](#vca-group) `gainDb`, which is applied as a delta on top and is not stored in this field) |
| `pan` | number | `0` | Pan position, `-1` (left) … `+1` (right). The loader clamps to that range; the schema rejects values outside it |
| `width` | number | `1` | Stereo width / side multiplier (`0` = mono, `1` = unchanged, `2` = doubled). Clamped to `0` … `2` on load; the schema rejects values outside it |
| `muted` | boolean | `false` | Silences the strip |
| `soloed` | boolean | `false` | Implies-mutes other (non-solo-safe) strips |
| `soloSafe` | boolean | `false` | Never implied-muted by another strip's solo |
| `panMode` | integer | `0` | `0` = balance, `1` = stereo pan, `2` = dual pan. Anything else is **rejected** at load |
| `dualPanLeft` | number | `-1` | Left position in dual-pan mode (default is identity hard-left, preserving the stereo image); clamped to `-1` … `+1` |
| `dualPanRight` | number | `1` | Right position in dual-pan mode (default is identity hard-right); clamped to `-1` … `+1` |
| `sourceLayout` | string | `"stereo"` | Channel layout of the source feeding the strip: `"mono"`, `"stereo"`, `"5.1"`, or `"7.1"`. The writer omits it at the stereo default; any other string is rejected at load |
| `surroundPan` | object | identity | Surround-pan position for wider-than-stereo hosts. `azimuth`, `divergence`, and `lfe` affect the [realtime engine's 5.1/7.1 group-bus panner](./realtime-engine.md#surround-group-buses-and-wide-meters); `elevation` and `distance` are reserved. Values are clamped on load and round-tripped through scene JSON; the writer omits the object at the centred default. The standalone offline `Mixer` remains stereo and therefore does not apply it |
| `metering` | object | all on | Which meters the strip computes: `enabled`, `lufs`, `truePeak` (booleans, default `true`) and `truePeakOversample` (integer, default `4`, must be `1` … `16`). The writer omits the object when every meter is at its default |
| `polarityInvertLeft` | boolean | `false` | Inverts the left channel polarity |
| `polarityInvertRight` | boolean | `false` | Inverts the right channel polarity |
| `panLaw` | integer | `0` | `0` = const 3 dB, `1` = const 4.5 dB, `2` = const 6 dB, `3` = linear 0 dB. Anything else is **rejected** at load |
| `channelDelaySamples` | integer | `0` | Per-strip delay, `0` … `192000`; also feeds [PDC](./mixing.md#latency-and-plugin-delay-compensation-pdc). Out of range is rejected at load |
| `inserts` | array | `[]` | In-series processors (see [Insert](#insert)) |
| `sends` | array | `[]` | Parallel sends to buses (see [Send](#send)) |

::: info Enums are integers in the file, strings in the API
The scene **file** stores `panMode` and `panLaw` as integers, but insert `slot` and send `timing` are stored as the short string tokens `"pre"` / `"post"`. The JavaScript runtime **methods** accept friendly strings — `setPanLaw(strip, 'const3dB')`, `addSend(..., 'postFader')`. Python accepts the same send/tap names, but pan-law strings use normalized names such as `'const-3db'`, `'const-4.5db'`, `'const-6db'`, or `'linear-0db'` (or the enum/int value). Both map to the same underlying value; the difference is just file format vs. ergonomic API.

Serializing a scene after runtime pan edits preserves the strip's current `panMode`. Use `Mixer.toSceneJson()` / `Mixer.to_scene_json()` instead of rebuilding the pan fields by hand.

**Insert `slot` and send `timing` must be strings.** A non-string value — e.g. a numeric `"timing": 1` — is rejected at load time, with the reason `send timing must be a string ("pre" or "post")`. Always write `"pre"` or `"post"`.
:::

::: warning How a rejected scene reaches you differs by runtime
Everything that stops a scene from building — malformed JSON, an out-of-range field, a non-string `timing` — fails the same way within a runtime, but the runtimes do not agree with each other. The specific reason is carried in the message; the error type is not a discriminator worth branching on.

| Runtime | What you catch | Inner reason |
|---------|----------------|--------------|
| WASM | `InvalidState`, message `failed to build mixer from scene JSON: <reason>` | Preserved |
| Node native | An untyped `Napi::Error` with the same message | Preserved |
| Python | A bare `RuntimeError` | **Dropped** — the message is only `failed to build mixer from scene JSON` |
| C ABI | `nullptr` from `sonare_mixer_from_scene_json` | Read `sonare_last_error_message()` |

Validate a scene before you hand it to a mixer rather than relying on the exception to name the field, and on Python log the scene next to the exception — the message alone will not tell you which field was wrong.
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
| `slot` | `"pre"` \| `"post"` | Runs before or after the fader; defaults to `"pre"` when omitted. **Note the short tokens** — not `preFader`/`postFader`. |
| `processor` | string | *Required.* Processor id, e.g. `eq.parametric`, `dynamics.compressor`, `effects.reverb.plate`. See [Mastering Processors](./mastering-processors.md) for solo processors and [Effects Inserts](./effects-inserts.md) for the creative-FX catalog. An id the registry does not know is refused when the mixer is built, not by the schema. |
| `params` | object | The processor's parameters, keyed by parameter name, e.g. `{ "thresholdDb": -18, "ratio": 2.5 }`. Values are numbers or booleans, with two processor-specific exceptions: a string for a named rig or an embedded impulse response, and a per-band array for the acoustic room morph. |
| `sidechainKey` | string | *Optional.* Strip id whose signal feeds this insert's external sidechain (e.g. ducking). Omitted when empty. |

::: info Sidechain and ducking
Normally a processor reacts to the audio passing through it. A **sidechain** makes it react to a *different* track instead: `sidechainKey` names that other strip. The classic use is **ducking** — a compressor on the music that turns the music down whenever the named voice strip is loud, so speech stays clear over a music bed.
:::

::: warning `params` is an object; the escaped-string form is legacy
`toSceneJson()` writes `params` as a nested object — `"params": { "ratio": 2.5 }` — and that is the only shape the schema admits. The loader still accepts the older form, an escaped JSON string (`"params": "{\"ratio\":2.5}"`), so a scene saved by an earlier release loads unchanged; a validator rejects it as `is not object`. When you write a scene by hand, use the object form. Anything that is neither an object nor a string is refused at load with `insert params must be a JSON object (or the legacy JSON string)`.
:::

## Send

A send routes a *copy* of the strip's signal to a destination bus. The `timing` field chooses whether the copy is tapped before the fader (`"pre"`) or after it (`"post"`) — see the [channel-strip signal flow](./mixing.md#the-channel-strip-signal-by-signal).

| Field | Type | Meaning |
|-------|------|---------|
| `id` | string | Send identifier, unique within the strip |
| `destinationBusId` | string | *Required.* The `id` of the target bus. It must name a bus in the same document — the mixer build refuses `send destination is not a bus` otherwise |
| `sendDb` | number | Send level in dB, default `0` |
| `timing` | `"pre"` \| `"post"` | Tapped before or after the fader (again, short tokens); defaults to `"post"` |

## Bus

| Field | Type | Meaning |
|-------|------|---------|
| `id` | string | *Required.* Bus identifier (one bus is conventionally `"master"`) |
| `role` | string | `"master"`, `"aux"` (the default), or a group bus such as `"submix"` |
| `layout` | string | Channel layout of the bus: `"mono"`, `"stereo"` (default), `"5.1"`, or `"7.1"`. The master bus carries the project output layout. Omitted by the writer at the stereo default |
| `inputTrimDb` | number | Gain at the bus input, default `0` |
| `width` | number | Stereo width of the bus, default `1`, clamped to `0` … `2` like a strip's. Refused when `layout` is wider than stereo, since a surround bed has no stereo image to narrow or widen |
| `polarityInvertLeft` / `polarityInvertRight` | boolean | Per-channel polarity flip on the bus, default `false` |
| `inserts` | array | Processors on the bus itself (same [Insert](#insert) shape as a strip) |

The writer omits `layout`, `inputTrimDb`, `width`, and both polarity flags whenever they sit at their defaults, so a plain stereo bus serializes as just `id`, `role`, and `inserts`.

::: info Only `master` and `aux` are special role tokens
The engine treats `master` and `aux` specially; **any other role string is just a generic non-master bus**. So a "drum bus" works the same whether its role is `submix`, `subgroup`, or `group` — the token is a label, not a behavior switch. The built-in `drumBusSubgroup` preset uses `subgroup`, so if you print it (`mixingScenePresetJson('drumBusSubgroup')`) you will see `"role": "subgroup"`, not `"submix"`. The corollary: a misspelt `"mastre"` is not an error, it is a scene with no master bus.
:::

## VCA group

A VCA (voltage-controlled amplifier) group is one fader that trims several strips at once without re-routing their audio.

| Field | Type | Meaning |
|-------|------|---------|
| `id` | string | *Required.* Group identifier |
| `gainDb` | number | Offset summed into each member's fader, default `0` |
| `members` | string[] | Strip ids governed by the group |

## Connection

| Field | Type | Meaning |
|-------|------|---------|
| `source` | string | *Required.* Strip or bus id the signal leaves |
| `destination` | string | *Required.* Strip or bus id the signal enters |

Connections are the graph edges. A strip routed to `master` is `{ "source": "vocal", "destination": "master" }`. A send's bus reaches the master through a connection from the bus (or its return strip) to `master`. Both ends must name a strip or bus in the document; the mixer build refuses `connection references unknown node` otherwise.

A strip with no outgoing connection is routed to the master bus automatically when the graph is built. An explicitly declared bus is not: an aux or group bus with no connection out stays unpatched, which is how a scene keeps a bus silent on purpose.

## Validating a scene against the schema

The scene format is described by a JSON Schema (draft 2020-12) titled `MixSceneDocument`. It covers the document `Mixer.fromSceneJson` reads, `toSceneJson` writes, [`suggestMixScene`](./mixing-assistant.md) returns, and `sonare mix --scene` loads. The engine's own tests hold the schema to the writer's published field list and validate every built-in preset against it, so a key the writer emits cannot be missing from it.

| Where | Path |
|-------|------|
| Engine source tree | `schemas/mixer-scene.schema.json` |
| npm `@libraz/libsonare` | exports subpath `@libraz/libsonare/schemas/mixer-scene.schema.json` |
| Python wheel | `libsonare/schemas/mixer-scene.schema.json` inside the installed package |
| Python sdist | `schemas/mixer-scene.schema.json` |

The `$id` (`https://libraz.net/schemas/libsonare/mixer-scene.schema.json`) is an identifier, not a download location — point your validator at the installed copy. The `@libraz/libsonare-native` package and the CMake install do not carry the file; take it from one of the packages above.

::: warning A scene file cannot carry a `$schema` key
The top-level object is `additionalProperties: false` and lists only `version`, `strips`, `buses`, `vcaGroups`, and `connections`. A `"$schema": "..."` line inside the scene — the usual way to let an editor find its schema — therefore fails validation as an undeclared key (the loader would ignore it). Associate the schema from the outside instead: an editor file-match rule, or the validator's schema argument, as below.
:::

::: code-group

```typescript [Browser / Node]
import Ajv from 'ajv/dist/2020';
import schema from '@libraz/libsonare/schemas/mixer-scene.schema.json' with { type: 'json' };

const validate = new Ajv().compile(schema);
const scene = JSON.parse(sceneText);
if (!validate(scene)) {
  throw new Error(JSON.stringify(validate.errors, null, 2));
}
const mixer = Mixer.fromSceneJson(sceneText, 48000, 512);
```

```bash [Command line]
# npm: ajv-cli, with the draft the schema declares
npx ajv-cli validate --spec=draft2020 \
  -s node_modules/@libraz/libsonare/schemas/mixer-scene.schema.json \
  -d my-scene.json

# Python: check-jsonschema, reading the copy inside the installed wheel
check-jsonschema \
  --schemafile "$(python -c 'from importlib.resources import files; print(files("libsonare") / "schemas/mixer-scene.schema.json")')" \
  my-scene.json
```

```json [VS Code settings.json]
{
  "json.schemas": [
    {
      "fileMatch": ["*.scene.json"],
      "url": "./node_modules/@libraz/libsonare/schemas/mixer-scene.schema.json"
    }
  ]
}
```

:::

### Where the schema and the loader disagree

The schema is written to be **stricter** than the loader wherever the loader would otherwise accept a mistake silently. In the other direction, the loader enforces a few bounds the schema leaves open, and the mixer build checks references no schema can express. Validate first, then load, then read `sceneWarnings()` — each layer catches what the previous one cannot.

| Input | Schema | Loader |
|-------|--------|--------|
| Unknown or misspelled key (`faderDB`) | Rejected (`additionalProperties: false`) | Ignored silently; the field keeps its default |
| Legacy snake_case key (`fader_db`, `params_json`, `processor_name`, `destination_bus_id`, `vca_groups`, …) | Rejected | Accepted; the writer never emits this spelling |
| `params` as an escaped JSON string | Rejected (`type: object`) | Accepted as the legacy form |
| Missing `version` | Rejected (`required`) | Assumed `1` |
| Wrong-typed scalar (`"faderDb": "loud"`, `"muted": 1`) | Rejected | Ignored silently; the field keeps its default |
| `pan`, `dualPanLeft`, `dualPanRight` outside −1 … 1, `width` outside 0 … 2 | Rejected (`minimum`/`maximum`) | Clamped into range |
| Missing `id`, `processor`, `destinationBusId`, `source`, `destination` | Rejected (`required`, `minLength: 1`) | Read as empty and refused later by the mixer build |
| Non-object entry in `strips`/`buses`/`vcaGroups`/`connections`/`inserts`/`sends`, non-string `members` entry | Rejected | Skipped silently |
| `panMode` above `2`, `panLaw` above `3` | Accepted (only `minimum: 0`) | Rejected: `panMode enum is out of range` / `panLaw enum is out of range` |
| `channelDelaySamples` above `192000` | Accepted (only `minimum: 0`) | Rejected: `channelDelaySamples must be in [0, 192000]` |
| `metering.truePeakOversample` above `16` | Accepted (only `minimum: 1`) | Rejected: `metering.truePeakOversample must be in [1, 16]` |
| Number outside 32-bit float range (`1e40`) | Accepted | Rejected: `floating-point field is non-finite or out of float range` |
| Unknown processor id, send to a bus not in the document, connection or `sidechainKey` naming an unknown node, duplicate ids | Accepted (not expressible) | Refused by the mixer build |

Where both agree — `version` must be `1` when present, `slot` and `timing` are `"pre"`/`"post"` strings, `sourceLayout` and `layout` are one of the four layout tokens, integer fields must be integral — the validator's message simply arrives earlier and names the path.

## Built-In Presets

| Preset | Intent |
|--------|--------|
| `vocalReverbSend` | Vocal strip (EQ + compressor inserts) with a post-fader aux send into a plate-reverb return |
| `drumBusSubgroup` | Kick/snare/overheads into a group bus (role `subgroup`), made cohesive with parallel compression and tape, ridden by a "drums" VCA |
| `commentaryDucking` | Host/guest speech (de-ess + compress) with a music bed ducked via `dynamics.sidechainRouter` keyed off the host |

Discover them at runtime with `mixingScenePresetNames()` and fetch one with `mixingScenePresetJson(name)`.

## A complete, annotated scene

This is the actual output of `mixingScenePresetJson('vocalReverbSend')` (defaults trimmed for readability — every trimmed key is optional, so the shortened form still validates). It shows every relationship: a vocal strip with two pre-fader inserts and a post-fader send, a reverb return strip, two buses, and the connections that wire them to the master.

```json
{
  "version": 1,
  "strips": [
    {
      "id": "vocal",
      "faderDb": -3,
      "inserts": [
        { "slot": "pre", "processor": "eq.parametric",
          "params": { "band0.type": 4, "band0.frequencyHz": 80, "band1.frequencyHz": 4000, "band1.gainDb": 2 } },
        { "slot": "pre", "processor": "dynamics.compressor", "params": { "thresholdDb": -18, "ratio": 2.5 } }
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
        { "slot": "post", "processor": "effects.reverb.plate", "params": { "decaySec": 1.8, "preDelayMs": 25 } }
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

Trace the reverb below: one reverb instance, with the dry vocal and the wet return kept as separate paths to **master**.

<FlowDiagram
  title="Reverb-send signal path"
  direction="LR"
  :nodes="[
    { id: 'vocal', label: 'vocal (strip)', col: 0, row: 0 },
    { id: 'bus', label: 'vocal-verb (aux bus)', col: 1, row: 1 },
    { id: 'return', label: 'vocal-verb-return (plate reverb)', col: 2, row: 1, variant: 'accent' },
    { id: 'master', label: 'master', col: 3, row: 0, variant: 'success' }
  ]"
  :edges="[
    { from: 'vocal', to: 'master', label: 'dry' },
    { from: 'vocal', to: 'bus', label: 'post-fader send' },
    { from: 'bus', to: 'return' },
    { from: 'return', to: 'master', label: 'wet' }
  ]"
  caption="The vocal strip connects straight to master (dry) and, via a post-fader send, into the vocal-verb aux bus; that bus feeds the vocal-verb-return strip hosting the plate reverb, which returns to master (wet)."
/>

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

const saved = mixer.toSceneJson();   // round-trips back to the same format
```

```python [Python]
import libsonare as sonare

scene_json = sonare.mixing_scene_preset_json('vocalReverbSend')
with sonare.Mixer.from_scene_json(scene_json, sample_rate=48000, block_size=512) as mixer:
    mixer.scene_warnings()  # [] — typo'd insert params would be listed here, non-fatally

    mixer.add_send(0, 'more-verb', 'vocal-verb', -18, 'post_fader')  # topology change
    mixer.compile()                                                  # rebuild before timing-critical work

    saved = mixer.to_scene_json()   # round-trips back to the same format
```

```bash [Python CLI]
# Export a built-in scene, edit the JSON file, then render it.
sonare mixing-preset --preset vocalReverbSend > my-scene.json
sonare mix --scene my-scene.json --input vocal.wav --input reverb-return.wav -o master.wav
```

:::

::: info `mix --scene` with per-strip inputs is Python-CLI only
Rendering a whole scene from a JSON file with one `--input` per strip is implemented by the Python CLI. The native CLI has no `mix` command at all: its strip command answers to `sonare-cli mix-strip` and nothing else, so a script that still calls `sonare-cli mix` fails as an unknown command. `mix-strip` itself is on both CLIs, but it is a single-strip, single-input processor with no `--scene` — use it for quick per-strip checks, not full scene renders. See [the channel strip](./cli-examples.md#the-channel-strip).
:::

::: tip When to recompile
Structural edits — adding/removing buses, sends, or connections — mark the graph dirty and need `compile()` before the next timing-critical block. Parameter moves (`setSendDb` / Python `set_send_db`, `setPanLaw`), VCA group changes (add/remove/gain — applied live as control-only gain offsets on member strips), and scheduled automation do **not** need a recompile.
:::

## Related

- [Mixing Demo Project JSON](./mixing-demo-project-json.md) — the `/mixing` demo's UI project file, a per-track arrangement format that is *not* a mixer scene
- [Mixing Engine](./mixing.md) — the API guide and signal flow
- [Mixing Assistant](./mixing-assistant.md) — `suggestMixScene` writes a scene in this format from an analysis
- [Mixing Basics](./glossary/concepts/mixing-basics.md) — the vocabulary
- [Mastering Processors](./mastering-processors.md) — valid `processor` ids for the mastering registry
- [Effects Inserts](./effects-inserts.md) — the extra creative-FX mixer insert names
- [Binding Parity](./binding-parity.md) — per-runtime differences
