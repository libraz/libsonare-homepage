---
title: Mixing Assistant
description: The offline mixing assistant — it measures a set of tracks, returns a mixer scene with a written reason for every decision, and never touches the audio.
---

# Mixing Assistant

Hand the assistant a set of tracks and it measures each one, measures what happens *between* them, and returns a **mixer scene**: input trims, faders, pans and widths, corrective EQ, dynamics, effect buses and sends — with a written reason for every decision it made.

::: warning It suggests; it does not apply
No audio is processed and none is emitted. The assistant reads your buffers and returns parameters. Handing that scene to the mixer is your own explicit `Mixer.fromSceneJson` step, and there is deliberately no convenience entry point that collapses the two halves — a mix has no single right answer, so the moment where a human accepts or edits the proposal is the point of the API, not friction in it.
:::

If strips, sends, and buses are new vocabulary, read [Mixing Basics](./glossary/concepts/mixing-basics.md) and the [Mixing Engine](./mixing.md) guide first. The scene document itself is specified field by field in [Mixing Scene JSON](./mixing-scene-json.md).

## What You Will Learn

By the end of this page you should be able to:

- call the assistant on a set of tracks and read the scene, the per-track measurements, and the explanation it returns;
- turn a suggestion into an actual mix as the deliberate two-step it is;
- say what measurement a given suggestion rests on, and what the assistant had no way of knowing;
- predict what the assistant will decline to do — above all how little EQ it proposes, and why;
- tell a degenerate input from a rejected one, and probe whether the build carries the assistant at all.

## The common case

Measure the tracks, look at the reasons, load the scene.

::: code-group

```typescript [Node]
import { suggestMixScene, Mixer } from '@libraz/libsonare-native';

const result = suggestMixScene({
  sampleRate,
  tracks: [
    { id: 'kick',   name: 'Kick',   left: kick },
    { id: 'bass',   name: 'Bass',   left: bass },
    { id: 'guitar', name: 'Gtr L',  left: guitarL, right: guitarR },
    { id: 'vocal',  name: 'Lead Vox', left: vocal },
  ],
  options: { targetTrackLufs: -18, suggestionStrength: 0.8 },
});

for (const line of result.explanation) console.log(line);

// Nothing has happened to any audio yet. This is the step that applies it.
const mixer = Mixer.fromSceneJson(JSON.stringify(result.scene), sampleRate);
```

```python [Python]
import json

import libsonare as sonare

result = sonare.suggest_mix_scene(
    [
        sonare.MixTrackInput("kick", kick, name="Kick"),
        sonare.MixTrackInput("bass", bass, name="Bass"),
        sonare.MixTrackInput("guitar", guitar_l, guitar_r, name="Gtr L"),
        sonare.MixTrackInput("vocal", vocal, name="Lead Vox"),
    ],
    sample_rate=sample_rate,
    target_track_lufs=-18.0,
    suggestion_strength=0.8,
)

for line in result["explanation"]:
    print(line)

mixer = sonare.Mixer.from_scene_json(json.dumps(result["scene"]), sample_rate)
```

```bash [CLI]
sonare suggest-mix \
  --input kick=kick.wav --input bass=bass.wav \
  --input guitar=guitar.wav --input vocal=vocal.wav \
  --sample-rate 48000 \
  --params targetTrackLufs=-18,suggestionStrength=0.8 \
  --scene-out scene.json
```

:::

::: tip The track name is a hint, not a label
`name` feeds source classification. For a class the classifier can measure it only nudges confidence and cannot select the class by itself. For the four classes no measurement separates — `keys`, `strings`, `backing`, `fx` — the name is the only thing that can supply the class at all, and only when the measurement came back with no answer. Pass the name you show the user; nothing depends on a naming convention.
:::

## Rule-based, not learned

There is no trained model here, no statistical classifier, and no learned parameter anywhere in the assistant. Source classification is a single-layer decision table over measured features — a log-frequency centroid over the seven band shares, spectral rolloff and flatness, four grouped band shares, sustain ratio, attack density and crest factor — and every decision downstream of it is a rule with a threshold you can read in the source. Rows are tried top to bottom, the first match wins, and a match that clears its bounds only barely is reported as `unknown` rather than as a weak label.

The numbers those rules start from are studio convention. Where a published survey of professional practice has measured the same quantity, the convention was checked against it rather than simply asserted: the reverb return level, the reverb pre-delay, the lead vocal's position, the width of a wide pan, and the frequency ordering of the compression ratios all trace to P. Pestana and J. D. Reiss, *Intelligent Audio Production Strategies Informed by Best Practices*, AES 53rd International Conference on Semantic Audio, London, 2014.

::: info Why this matters for your UI
A rule-based assistant can always say why. That is what makes `explanation` a real feature rather than generated commentary — each line is emitted by the rule that produced the change, at the moment it produced it. Nothing summarises or paraphrases afterwards.
:::

## What the suggestions are based on

Every decision is made from two layers of measurement, and nothing else reaches the rules: not the file name, not the order of the tracks beyond a tie-break, and no notion of what the song is.

**Per track**, one STFT and one BS.1770 loudness measurement produce the profile returned in `tracks[]`, plus two things kept internally: a per-band energy envelope over time (the seven bands at every analysis frame, so a collision can be tested frame by frame) and a time-averaged power spectrum (every bin, no time axis, for the questions a band is too wide to answer — where inside a band a cut belongs, and how much energy sits under a high-pass corner). Classification reads the profile alone. The raw `spectralCentroidHz` in the profile is deliberately not one of its features: a linear-frequency mean moves with one quiet cymbal wash and with the sample rate, so the table uses a centroid weighted in log frequency over the band shares instead.

**Between tracks**, four passes, each run only when a domain that reads it is enabled:

| Measurement | What it is | Read by |
|---|---|---|
| Band dominance (`bandDominance[]`) | Per band and per ordered pair, the masker's share of the summed band energy, `E_a / (E_a + E_b)`, averaged over the frames where both tracks clear the band's energy floor. 0.5 is parity; 1 is outright ownership. An energy ratio, not a loudness model — no auditory filterbank, no excitation pattern. | EQ, dynamics |
| Alignment (`alignment[]`) | Per unordered pair, the lag and polarity of the strongest normalised cross-correlation peak, measured over the one-second window where the two are jointly most active. A pair counts as related only when the absolute correlation is at least 0.5; below that it is left alone. | Image |
| Image occupancy (`crowdedBands[]`) | A per-band histogram of where energy already sits across nine pan positions, each stereo track placed per band from its own left/right balance. A band is crowded when its energy is concentrated into fewer than about 1.7 effective positions. | Image |
| Mono risks (`monoRisks[]`) | Stereo tracks whose correlation is below 0.30, whose width exceeds 1.0 (side energy above mid), or whose low end alone is wide — the sub and low bands carry at least 10% of the track's energy and at least a quarter of that is side. | Image |

### What each domain reads

| Domain | Reads | Rule |
|---|---|---|
| Structure | Source class only. Nothing cross-track. | Bus membership is a fixed map from class: the five kit classes share `drumBus`, `vocal` and `backing` share `voxBus`, every other class has a bus of its own, and `unknown` joins none. A subgroup is created only when at least two tracks map to it, and each created subgroup gets a VCA at unity. A plate reverb bus and a stereo delay bus are proposed when any track's class has a send level in the send table. |
| Gain | Integrated LUFS against `targetTrackLufs`. Class is never read. | One static input trim per track to the absolute target. A master trim then brings the amplitude-summed true peaks down to `mixBusHeadroomDbtp`. |
| Balance | Class and its confidence. | A fixed table of class-relative fader offsets — `vocal` furthest forward at +5 dB, `fx` furthest back at −5 dB — scaled by classification confidence between 0.5 and 1. The lookup is keyed by the profiler's genre guess, but only one table exists, so today every genre resolves to the same offsets. |
| EQ | Band dominance, both tracks' `bandOccupancy`, the mean spectrum. | A cut is considered when one track holds at least 0.65 of a band's energy (roughly 2:1) over at least 32 frames in which both sound. The track that gives way is the lower **role priority** — a fixed ranking with `lead` and `kick` at the top and `fx` at the bottom — never the quieter one. The cut is proposed only when the band is at least 40% of the winner's own energy and at most 7% of the loser's. Depth grows with the dominance up to 6 dB at outright ownership, is capped at `eqMaxCutDb`, and anything under 0.5 dB is dropped. Q is 1.2. |
| Dynamics | Class, integrated LUFS, crest factor, sustain ratio, attack density; low-band dominance for the sidechain. | A compressor from a per-class starting table whose threshold is an offset from the track's own measured loudness, never an absolute; ratio, attack and threshold move with crest factor around a 12 dB reference, release with sustain ratio. A transient shaper for `kick` `snare` `tom` `percussion`; a level rider and de-esser for `vocal` and `backing`. A gate only for `kick` `snare` `tom`, and only when the track is unmistakably a close mic (sustain ratio at most 0.25, crest factor at least 14 dB, at least 0.5 onsets per second, confidence near its class ceiling). The one sidechain: `bass` ducked under `kick`, at most 4 dB, only when the kick holds at least 0.55 of the sub and low band energy while both sound. |
| Image | Class for placement; alignment, crowding and mono risks for the rest. | Pan is a class table: `kick` `snare` `bass` `lead` `vocal` are pinned to centre; the others alternate left, right, left, stepping inwards, out to a per-class extent (`guitar` and `percussion` 0.8, `fx` 0.9, `keys` `strings` `backing` `tom` `cymbal` 0.55, `hiHat` 0.3) and never past ±0.9. A lone member of a spreadable class goes halfway; a crowded band widens the spread by a quarter. A related, polarity-opposed pair has its later track inverted; a related pair with a lag has the earlier side delayed. A mono-risk track has its width pulled to 0.7 and, when its low end is wide, a `stereo.monoMaker` at 120 Hz. |

**The confidence gate.** Balance, EQ, dynamics and pan placement act on a class only when `sourceConfidence` is at least 0.5; below that the track keeps its staged level and stays where the caller had it. Structure routes any classified track, because a part on a plausible-but-wrong bus is one drag from the right one while a part off every bus is one a mixer has to notice is missing. Polarity and delay ignore class entirely — a cancellation is measured between two signals whatever they turn out to be.

### What it cannot know

The assistant works from measured signal characteristics, and everything a mixing engineer brings that is not in the signal is absent:

- **Which part the song is about.** Role priority is a table: `lead` outranks `vocal`, which outranks `kick`. A guitar carrying the hook classifies as `guitar` and gives way to a vocal that is merely doubling it. Name the track `lead` if that is what it is.
- **The arrangement.** Two parts both built around a band get no cut. A kick and a bass sharing 80 Hz is an arrangement question, and the assistant will not answer it by thinning one of them.
- **Genre, tempo and taste.** Every level, pan and send figure is a starting position from studio convention, not something derived from your material. Tempo is known only when you pass `tempoBpm`; otherwise the delay lands near the beat rather than on it.
- **Keys, strings, backing vocals and effects.** No measured feature separates a piano from a plucked guitar, or a backing stack from a lead. These four classes exist only if the track name says so.
- **Time.** Every decision is one static setting for the whole song — no automation, no dynamic EQ, no section awareness. A part that collides only in the chorus is judged on how much of the song it collides in.
- **What the effects will add.** The master headroom estimate sums the dry strips; reverb and delay returns and insert make-up gain are not in it, which is why the target sits at −6 dBTP.
- **Whether your labels are right.** A name that contradicts the measurement costs the match 0.25 confidence, which can push it under the gate. That is the designed response to a disagreement between engineer and measurement: do less, rather than pick a side.

## Entry points

| Surface | Entry point | Shape |
|---------|-------------|-------|
| WASM (`@libraz/libsonare`) | `suggestMixScene(request)` | One request object: `{ tracks, sampleRate, options? }`. Synchronous. Returns `MixAssistantResult`. |
| Node (`@libraz/libsonare-native`) | `suggestMixScene(request)` | Same request object and same result. Synchronous. |
| Python (`libsonare`) | `suggest_mix_scene(tracks, *, sample_rate, ...)` | Tracks positional, every option a snake_case keyword. Returns a `dict`. |
| C ABI | `sonare_mixing_assistant_suggest_scene_json(...)` | Flat C arrays plus a `SonareMasteringParam` list; writes JSON to `char** json_out`. |

`sampleRate` is required on every surface — there is no default.

### The scene-only call

Each surface has a sibling that takes the same request and returns only the scene, already serialized in the schema `Mixer.fromSceneJson` reads:

| Surface | Signature |
|---|---|
| WASM / Node | `suggestMixSceneJson(request: SuggestMixSceneRequest): string` |
| Python | `suggest_mix_scene_json(tracks, *, sample_rate, ...) -> str` |
| C ABI | `sonare_mixing_assistant_suggest_scene_json(...)` writes the scene to `json_out`; `sonare_mixing_assistant_suggest` writes the full result. Free either with `sonare_free_string`. |

It costs the same as the full call — the profiles, the cross-track passes and the explanation are all still computed and then dropped — so it is a convenience for a caller that applies without inspecting, not a cheaper path. The moment you show a reason or a measurement to a user, call `suggestMixScene` and serialize `result.scene` yourself.

### The source-class vocabulary

Every place a source class appears — `tracks[].source`, the reasons in `explanation`, the bus a track was routed to — uses one fixed set of fifteen camelCase identifiers, and two callables get you in and out of it:

| Callable | Returns |
|---|---|
| `mixSourceClassNames(): string[]` / `mix_source_class_names() -> list[str]` | The identifiers in wire order: `unknown` `kick` `snare` `hiHat` `tom` `cymbal` `bass` `guitar` `keys` `strings` `lead` `vocal` `backing` `percussion` `fx`. A name's position in this list is its ordinal. |
| `mixSourceClassFromName(name: string): number` / `mix_source_class_from_name(name) -> int` | The ordinal of `name` in that list, or `-1` when it is not one of them. The match is exact and case-sensitive: `'hiHat'`, not `'hihat'`. |

`-1` is the miss value on purpose. The core's own lookup folds an unknown name into `unknown`, which is ordinal 0 and a real class, so it could never report a miss; the bindings do the index lookup themselves. Use the pair to build a class picker or legend from the runtime list rather than a hard-coded copy, to validate a class string before acting on it, and to sort or group profiles by a stable ordinal instead of comparing strings. In a build without the assistant, `mixSourceClassNames` returns an empty array — an empty string from the C ABI, and a `RuntimeError` from Python, since an empty taxonomy is the one answer that cannot be real — and every name resolves to `-1`.

These are the identifiers the assistant *reports*. They are not the list of words the classifier reacts to in a track name; that is a separate substring vocabulary (`bassdrum`, `vox`, `gtr`, `rhodes`, …) which happens to cover most of these but is not exposed.

## Options

The option set is deliberately flat — no nested groups, no per-domain sub-objects. Every field is optional, and an omitted key is never forwarded, so the core default stands.

| Key (JS) | Type | Default | Meaning |
|---|---|---|---|
| `targetTrackLufs` | number | `-18.0` | Integrated-loudness target per track. Absolute, not an average over the loaded set — a quiet session is staged up, not left where it is. |
| `suggestionStrength` | number | `1.0` | In `[0, 1]`; scales every level-like decision. |
| `eqMaxCutDb` | number | `4.0` | Ceiling on any single suggested cut. |
| `mixBusHeadroomDbtp` | number | `-6.0` | Target for the static master trim. |
| `tempoBpm` | number | `0.0` | `0` selects the transport's own fallback tempo. A positive value outside 20–400 is refused, not clamped. |
| `enableStructure` | boolean | `true` | Bus topology and routing. |
| `enableGain` | boolean | `true` | Input trims and loudness staging. |
| `enableBalance` | boolean | `true` | Faders. |
| `enableEq` | boolean | `true` | Corrective EQ. |
| `enableDynamics` | boolean | `true` | Compression. |
| `enableImage` | boolean | `true` | Pan and width. |
| `enableHighPass` | boolean | **`false`** | Per-track high-pass. Off by default — see [below](#the-reluctant-eq-and-enablehighpass). |
| `nFft` | number | `2048` | Shared [STFT](./glossary/analysis/spectrogram-stft.md) geometry. |
| `hopLength` | number | `512` | |

Python takes the same keys in snake_case (`target_track_lufs`, `enable_high_pass`, `n_fft`, …). The C ABI takes the camelCase spellings as `SonareMasteringParam` entries.

::: warning `suggestionStrength: 0` is not an empty suggestion
It scales the level-like decisions toward nothing, but bus topology, routing, polarity, alignment delay and the low-end mono fold do not scale — they are structural, and a half-applied routing graph is not a mix. Zero therefore still returns a scene with buses, sends and corrections in it. To suggest nothing in a domain, switch that domain off.
:::

::: info A disabled domain is not measured either
`enableEq: false` does not mean "measure the overlaps but propose no cuts" — the domain is not evaluated at all, so the measurements feeding it are not taken. Turning domains off is a way to make the call cheaper, not a way to get the analysis without the advice.
:::

## What comes back

`MixAssistantResult` has four fields.

| Field | Type | What it is |
|-------|------|------------|
| `scene` | `MixSceneDocument` | The document `Mixer.fromSceneJson` reads, in the [Mixing Scene JSON](./mixing-scene-json.md) schema. |
| `tracks` | `MixAssistantTrackProfile[]` | Per-track measurements, in input order. |
| `mix` | `MixAssistantMixProfile` | What was measured *between* tracks. |
| `explanation` | `string[]` | Reasons, in application order. |

### `tracks` — what each track is

| Field | Meaning |
|-------|---------|
| `stripId`, `name` | As you passed them. |
| `source` | The classified source, one of `unknown` `kick` `snare` `hiHat` `tom` `cymbal` `bass` `guitar` `keys` `strings` `lead` `vocal` `backing` `percussion` `fx`. |
| `sourceConfidence` | How sure the decision table was. |
| `usable` | `false` when the track could not be measured. An unusable track gets no suggestions at all, rather than suggestions of zero. |
| `exclusionReason` | Why, in words, when `usable` is `false`. |
| `channelCount`, `durationSec` | Shape of the buffer. |
| `integratedLufs` | `number \| null`. **`null` where the measurement is `-Infinity`** — a track with no gated block — because JSON has no number for it. |
| `truePeakDb`, `crestFactorDb` | Level and peak-to-RMS contrast. |
| `spectralCentroidHz`, `spectralFlatness` | Brightness and noisiness. |
| `attackDensity`, `sustainRatio` | How transient against how sustained. |
| `bandOccupancy` | The track's share of its own energy per band. |

`bandOccupancy` is keyed by seven band names, and the ranges are worth memorizing because every EQ reason is phrased in them:

| Band | Range |
|------|-------|
| `sub` | 20–60 Hz |
| `low` | 60–250 Hz |
| `lowMid` | 250–500 Hz |
| `mid` | 500 Hz – 2 kHz |
| `highMid` | 2–6 kHz |
| `high` | 6–12 kHz |
| `air` | 12 kHz – Nyquist |

### `mix` — what happens between tracks

| Field | What it holds |
|-------|---------------|
| `trackCount` | How many tracks were profiled. |
| `bandDominance[]` | Which track masks which, in which band, and by how much (`masker`, `maskee`, `band`, `ratio`, `validFrames`). |
| `alignment[]` | Pairwise timing and polarity (`reference`, `target`, `lagSamples`, `correlation`, `polarityOpposed`). |
| `crowdedBands[]` | Bands the whole session is competing in. |
| `monoRisks[]` | Strips that will partly disappear in mono (`correlation`, `width`, `wideLowEnd`). |

## Reading the explanation

`explanation` is assembled from each delta as it is applied and never re-summarised, so reading it top to bottom retraces how the scene was built. It is empty when every domain is disabled or no track is usable.

The reluctance is visible in the text. An EQ reason names the frequency, says whether that frequency was *measured* or fell back to the band centre, and gives **both** parts' shares:

```text
carved 3.2 dB at 1247 Hz (measured overlap in mid, which vocal needs at 41.6%
of its energy and guitar can spare at 12.4% of its own) out of guitar to make
room for the parts it shares those bands with
```

If a cut ran into `eqMaxCutDb`, the line says so rather than pretending the collision was solved:

```text
…; the mid cut was held at the 4.0 dB ceiling, so the collision is only partly resolved
```

These are good inline captions for an editable control. A user who can see that the vocal needs 41.6% of its energy in that band, and the guitar only 12.4%, can disagree with the number and still agree with the reasoning.

## Turning a suggestion into a mix

Two steps, always, and they are separate on purpose.

::: code-group

```typescript [Node]
const result = suggestMixScene({ sampleRate, tracks });
// …show result.explanation, let the user edit result.scene…
const mixer = Mixer.fromSceneJson(JSON.stringify(result.scene), sampleRate);
```

```python [Python]
result = sonare.suggest_mix_scene(tracks, sample_rate=sample_rate)
# …show result["explanation"], let the user edit result["scene"]…
mixer = sonare.Mixer.from_scene_json(json.dumps(result["scene"]), sample_rate)
```

```bash [CLI]
sonare suggest-mix --input kick=kick.wav --input vocal=vocal.wav --scene-out scene.json
sonare mix --scene scene.json --input kick=kick.wav --input vocal=vocal.wav
```

:::

`suggest-mix` is on both command-line front-ends. The second command is not: **`mix --scene` is Python-only**, so a shell pipeline that renders the suggested scene end to end needs the PyPI `sonare` CLI for its second half.

The scene the assistant writes is an ordinary mixer scene — lanes, faders, sends, buses. The demo below is that mixer, not the assistant, but it is the thing the suggestion turns into, so it is a good place to build the intuition for what a scene *is* before reading one:

<SonareDemo id="engine-lane-mixer" />

## The reluctant EQ, and `enableHighPass`

The assistant proposes far less EQ than a first-time reader expects, and that is the design rather than a gap in it.

A band is carved only where one part is **built around** that band and the other **can spare** it — measured as each track's share of its own energy there. Two parts colliding in a band they are both made of get nothing, because there is no version of that cut which does not take the foundation out of one of them. A kick and a bass both living at 80 Hz is an arrangement problem, and an EQ that pretends otherwise just makes one of them thin.

When a cut is justified, its centre frequency is measured inside the band rather than taken from the band's midpoint. A band here runs up to two octaves, so the midpoint can sit an octave away from the overlap the cut was justified by — which is exactly how a well-reasoned cut lands on the wrong note. The reason string tells you which of the two happened.

### Why `enableHighPass` is off

`enableHighPass` defaults to `false`, and the default is a position rather than an omission. A high-pass on every source that "has nothing down there" is the one blanket EQ move most mixing folklore recommends, and the same survey of professional practice cited above tested it and found it seldom used in studio mixing and unsupported by subjective testing. The habit belongs to live sound, where the filter protects a system from stage rumble. Filtering every track by default on the grounds that it is traditional would be a decision taken on the user's behalf — exactly what the assistant exists not to do — so the filter is offered, and off.

Switched on, the corner comes from the class and the decision from the measurement:

| Class | Corner |
|---|---|
| `kick`, `bass`, `fx` | Never filtered. The first two *are* the low end; an effect has no register to sit under. |
| `keys` | 50 Hz |
| `strings`, `tom` | 60 Hz |
| `guitar` | 75 Hz |
| `vocal`, `lead`, `snare` | 80 Hz |
| `backing` | 100 Hz |
| `percussion` | 150 Hz |
| `hiHat`, `cymbal` | 400 Hz |

The filter is proposed only when the share of the track's energy below its corner is **between 0.5% and 10%**. Under 0.5% there is nothing to remove; over 10% the content is the part's own material — a guitar tuned down, a keys part playing the bass line — and a filter would take real notes out. The reason string quotes the measured share. A track under the EQ domain's confidence gate gets no high-pass either: the corner is read off the class, so a class the classifier is unsure of is not one to filter by.

### Before switching it on

- **Are these studio stems?** The case for the filter is stage rumble, handling noise and proximity boost. Close-miked studio material usually has none of it worth a filter, which is what the survey found.
- **Is the classification confident?** The corner follows `tracks[].source`. A snare that classified as `tom` inherits a 60 Hz corner instead of 80 Hz; check `sourceConfidence` before trusting the corner.
- **Does any part play below its register for only part of the song?** The share is measured over the whole track. A keys part that drops an octave for eight bars can average under 10% and be filtered, on a rule that would have spared it had it played there throughout.
- **Will you add low end back later?** A sub layer put under a filtered part later in the mix is fighting the assistant's own insert. Leave the filter off and decide per track.
- **Is `enableEq` on?** The high-pass is part of the EQ domain, and `enableEq: false` skips it whatever `enableHighPass` says.

## Two behaviours to state plainly

**Degenerate input is not an error.** No tracks, silent tracks, a track too short to measure, a non-positive sample rate, a NaN or an infinity in a buffer — none of these throw. The call succeeds and returns an empty scene, an empty explanation, and a per-track `exclusionReason` naming what was wrong:

| `exclusionReason` | Cause |
|-------------------|-------|
| `track has no samples` | Null buffer or zero frames. |
| `track sample rate is not positive` | |
| `track has non-finite samples` | A NaN or an infinity — named as such rather than diagnosed as silence. |
| `track is shorter than the minimum measurable duration` | |
| `track is silent` | |
| `track has no energy in the analysis bands` | |

**A duplicate track id is the one rejected input.** It raises `InvalidParameter` (a `RangeError` in Node, `SonareValueError` in Python) rather than being absorbed, because a scene with two strips of the same id is a scene the mixer refuses to load — accepting it here would only move the failure somewhere harder to read.

## Availability

The assistant is a separable build unit. `BUILD_MIXING_ASSISTANT` defaults to **ON** and forces `BUILD_MIXING` on when set, but `SONARE_WASM_ANALYSIS_ONLY` forces it **off** — so an analysis-only WASM module does not carry it.

::: warning Probe the capability, not the symbol
```typescript
import { capabilities } from '@libraz/libsonare';

if (capabilities().features.mixingAssistant) {
  // safe to call
}
```
`typeof suggestMixScene === 'function'` is **not** a valid probe. The entry points stay registered in a build without the assistant and throw when called — the C ABI returns `SONARE_ERROR_NOT_SUPPORTED` — so the symbol is present either way.
:::

## Related

- [Mixing Scene JSON](./mixing-scene-json.md) — the schema of the `scene` the assistant returns
- [Mixing Engine](./mixing.md) — the mixer that loads it
- [Mastering Assistant](./mastering-assistant.md) — the same explain-then-decide shape, one stage later
- [Channel Strip](./glossary/mixing/channel-strip.md) · [Buses and Sends](./glossary/mixing/buses-sends.md) · [Pan and Stereo Width](./glossary/mixing/pan-width.md) · [Mono Compatibility](./glossary/concepts/mono-compatibility.md)
