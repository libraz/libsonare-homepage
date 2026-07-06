---
title: Built-in Synthesizer (NativeSynth)
description: Guide to libsonare's data-free patch-driven NativeSynth — its fifteen synthesis engines, the SynthPatch object, the named preset catalog, the GM fallback bank, and how to drive it offline and live, with copy-paste recipes.
---

# Built-in Synthesizer (NativeSynth)

**NativeSynth turns MIDI into sound on its own** — no samples to download, no SoundFont to ship. It is built into libsonare, so a MIDI track always makes sound out of the box.

For a first pass, you only need three ideas:

1. choose a named preset such as `acoustic-piano`, `warm-pad`, or `drum-kit`;
2. route MIDI notes to the destination that uses that preset;
3. optionally override simple fields such as `cutoffHz`, `ampAttackMs`, or `stereoSpread`.

Under the hood, NativeSynth is one synthesizer with **fifteen swappable synthesis engines**. Each engine is a different way to create the raw tone. Several acoustic-style engines are still provisional physical models: they are useful for data-free preview and fallback, but their final voicing/calibration is still in progress.

- a virtual-analog subtractive voice (classic synth leads and pads),
- FM (electric pianos, bells, and clavinet),
- Karplus-Strong plucked string (guitars, basses, harp, and harpsichord),
- modal percussion (marimba, vibraphone),
- additive drawbar organ,
- membrane percussion (the drum kit),
- an extended-waveguide acoustic piano,
- sustained flue-pipe organ,
- bowed-string waveguide,
- reed woodwind waveguide,
- brass lip-reed waveguide,
- air-jet flute waveguide,
- a buzzing-bridge plucked string (koto, sitar, tanpura),
- a source-filter vocal voice (choir and solo voices),
- and a free-reed voice (accordion, harmonica, bandoneon).

All fifteen share one common control layer for modulation, envelopes, filters, stereo width, and polyphony, so the same patch fields work across very different sounds. To get a sound, pick a preset by name — or start from a preset and change only the fields you care about with a `SynthPatch`. You never have to touch the engine internals to start.

::: info Synthesis terms in one place
The engine names below are different ways to *generate* a tone. You don't need them all to start — pick a preset and play — but here is the one-line version of each:

- **subtractive** — start with a bright waveform and carve it with a filter (the classic analog-synth recipe).
- **FM / phase modulation** — one oscillator's pitch modulates another, producing metallic and bell-like tones.
- **Karplus-Strong** — a short delay loop that models a plucked string.
- **modal** — a bank of tuned resonators modeling a struck bar or bell.
- **additive / drawbar** — sums harmonic sine partials, like the drawbars on a Hammond organ.
- **(extended) waveguide** — a delay-line model of a vibrating string or tube.
- **reed / brass / flute waveguide** — sustained breath-excited models for woodwinds and brass.
- **buzzing-bridge plucked** — a plucked-string loop whose bridge sprays energy into the upper partials for the shimmer of a sitar, koto, or harp.
- **source-filter vocal** — a glottal source (sawtooth + tilt) fed through a bank of vowel formant resonators for choir and solo-voice tones.
- **free reed** — a driven metal-tongue oscillator (accordion, harmonica, bandoneon), optionally musette-detuned into two beating tongues.

Two terms appear throughout the patch controls: an **ADSR envelope** (attack/decay/sustain/release — how a level rises and falls over a note) and the **mod matrix** (a routing table that sends modulation sources such as LFOs or envelopes to targets such as pitch or filter cutoff).
:::

::: info MIDI never renders silent
NativeSynth is also the **data-free floor** of the [SoundFont player](./soundfont-player.md). When you bounce a project through an SF2 and a program (or the whole SoundFont) is missing, those notes fall back to the NativeSynth **GM fallback bank** — all 128 General MIDI programs plus the drum map. You get audio either way.
:::

::: tip Where NativeSynth sits
A NativeSynth patch is an **instrument**: you bind it to a MIDI destination, and the MIDI on tracks routed to that destination plays through it. Offline you bind it in [`bounceWithSynthInstrument`](./project-bounce.md); live you bind it with `engine.setSynthInstrument` and feed [MIDI input](./midi-input.md). For sampled, multisampled instruments instead, use the [SoundFont player](./soundfont-player.md).
:::

A single signal path runs through NativeSynth on every note: a MIDI note picks one of the fifteen engines, and the engine's raw tone then flows through the shared control layer before reaching the stereo output.

<FlowDiagram
  title="NativeSynth signal path"
  :nodes="[
    { id: 'note', label: 'MIDI note', col: 0, row: 0 },
    { id: 'engine', label: 'Engine select', col: 1, row: 0, variant: 'decision', group: 'engines' },
    { id: 'filter', label: 'Filter', col: 2, row: 0, group: 'control' },
    { id: 'env', label: 'Amp & filter ADSR', col: 3, row: 0, group: 'control' },
    { id: 'lfo', label: 'LFOs / mod matrix', col: 4, row: 0, group: 'control' },
    { id: 'body', label: 'Body resonance', col: 5, row: 0, group: 'control' },
    { id: 'spread', label: 'Stereo spread', col: 6, row: 0, group: 'control' },
    { id: 'out', label: 'Stereo audio out', col: 7, row: 0, variant: 'success' }
  ]"
  :edges="[
    { from: 'note', to: 'engine' },
    { from: 'engine', to: 'filter' },
    { from: 'filter', to: 'env' },
    { from: 'env', to: 'lfo' },
    { from: 'lfo', to: 'body' },
    { from: 'body', to: 'spread' },
    { from: 'spread', to: 'out' }
  ]"
  :groups="[
    { id: 'engines', label: '1 of 15 engines' },
    { id: 'control', label: 'Shared control layer' }
  ]"
  caption="Whichever engine is selected, the same shared control layer and patch fields apply afterward."
/>

## What You Will Learn

By the end of this page you should be able to:

- pick the right synthesis engine for a sound, and the right named preset;
- start from a preset and override individual fields with a `SynthPatch`;
- list the **real** preset and enum names from the runtime instead of guessing;
- understand the `va:` routing prefix and the `drum-kit` GM drum map;
- render MIDI to audio offline with `bounceWithSynthInstrument` and live with `setSynthInstrument`;
- know when a note plays NativeSynth versus the loaded SoundFont.

## The fifteen synthesis engines

Every preset selects one `engineMode`. The shared sections (filter, envelopes, LFOs, mod matrix, body resonance, polyphony) apply on top of whichever engine is active. Mode-specific deep parameters — FM operator stacks, modal mode tables, drawbar registrations, kit pieces, piano strings, pipe ranks, bowed-string friction, reed/brass bores, and flute jet geometry — live **inside the named presets**, not in the patch.

### `subtractive` — virtual-analog

The classic oscillator → filter → amp voice. Detuned unison, drift, a pre-filter drive stage, and a choice of four filter models give it everything from fat saw leads to wide pads. Good for **leads, basses, pads, and plucks** — anything you'd reach for an analog synth to do. Presets: `sine`, `saw-lead`, `square-lead`, `sub-bass`, `warm-pad`.

<SonareDemo id="synth-note" />

The filter model is the heart of the "character". Four classic models are available via `filterModel`:

| Model | Voicing it emulates | Notes |
|-------|--------------------|-------|
| `svf` | TPT state-variable (SEM family) | Clean, the only model with a selectable `filterOutput` (lowpass / bandpass / highpass) |
| `moog-ladder` | 4-pole transistor ladder | Zero-delay-feedback, saturating loop, self-oscillates |
| `diode-ladder` | Diode ladder (VCS3 / TB-303 family) | Coupled-stage ZDF, self-oscillates |
| `sallen-key` | Korg35 Sallen-Key (MS-10 / early MS-20) | Self-oscillates |

All four stay stable and zipper-free under per-sample cutoff/resonance modulation, and self-oscillation is deterministic.

<SonareDemo id="synth-filter" />

### `fm` — frequency modulation

A phase-modulation operator stack (one oscillator's pitch modulates another → metallic/bell tones) with a small algorithm table, exponential operator envelopes, a feedback operator, and velocity-to-index (brightness) scaling. Good for **electric pianos, bells, mallets, clavinet, and brass** — the metallic, bell-like, and inharmonic sounds subtractive struggles with. Presets: `e-piano`, `bell`, `brass`.

### `karplus-strong` — plucked string

A fractional-delay waveguide loop (a short delay loop that models a plucked string) with phase-exact tuning, plus pick-position comb, velocity-driven brightness, decay stretching, and note-off loop damping (finger/palm mute). Guitar, harp, and bass presets add provisional physical details: pickup position, body coupling, steel-string dispersion, sympathetic open strings, tension bend, and dual-polarization decay. Treat the acoustic realism as **in calibration**, not as a finished instrument model. Good for **plucked and strummed strings** — guitar, bass, harp, harpsichord, and the plucked ethnic family. Presets: `pluck`, `classical-guitar`, `steel-guitar`, `electric-guitar`, `harp`, `bass-acoustic`, `bass-fingered`, `bass-picked`, `bass-fretless`, `bass-slap`.

### `modal` — mallet percussion

A modal resonator bank (a bank of tuned resonators modeling a struck bar or bell) tuned to physical mode ratios (uniform-bar glockenspiel, deep-arch marimba/vibraphone), with mallet-hardness velocity weighting and per-mode decay. Good for **tuned mallet instruments** — glockenspiel, vibraphone, marimba, xylophone. Presets: `marimba`, `glass`.

### `additive` — drawbar organ

The nine Hammond drawbar pitches (summing harmonic sine partials, one drawbar per partial) with stepped stop levels, free-running partial phases, and a key-click contact transient. Good for **organs** — sustained, harmonic-rich registrations. Preset: `organ`.

### `percussion` — membrane percussion

Rayleigh circular-membrane modes with a descending strike-pitch envelope under filtered noise. This engine backs the **GM drum kit** — kick, snare shell + wires, toms, hats, and cymbals with inharmonic ring modes, one-shot and deterministic. Preset: `drum-kit`.

### `piano` — extended-waveguide acoustic piano

A data-free grand-piano sketch with the four piano-defining elements: stiff-string dispersion (partials stretch sharp up the keyboard), a nonlinear felt hammer (hard strikes are shorter and brighter), 2-3 coupled micro-detuned unison strings, and a soundboard resonator bank. The voicing is register-scaled, so bass notes, middle-register chords, and treble notes do not share one over-simple brightness curve. This is still a provisional model intended for built-in preview, not a sampled-piano replacement. Good for **acoustic piano**. Preset: `acoustic-piano`.

### `pipe-organ` — sustained flue pipe

A provisional waveguide flue-pipe model with shared wind behavior, multi-rank registration, reed-pipe color, and mouth/radiation correction. Good for **church organ color previews** from principals and bourdon stops to flute and trumpet ranks. Presets: `church-organ`, `church-flute`, `church-bourdon`, `church-trumpet`.

### `bowed-string` — friction-excited string

A sustained bowed-string waveguide with bow speed/force/position control, sympathetic resonance, second-polarization beating, and a violin-family body resonator. The model is provisional and still being tuned against references. Good for **violin-family previews**. Presets: `violin`, `viola`, `cello`, `contrabass`.

### `reed` — woodwind reed

A reed-bore waveguide with cylindrical and conical variants, tonehole/growth-cone behavior, register-scaled voicing, and live breath/brightness control. This is a provisional GM fallback/preview voice while calibration continues. Good for **single- and double-reed woodwind previews** and saxophones. Presets: `clarinet`, `soprano-sax`, `alto-sax`, `tenor-sax`, `baritone-sax`, `oboe`, `english-horn`, `bassoon`.

### `brass` — lip-reed brass

A brass waveguide with lip tension, brass-bell body resonance, conical/cylindrical voicing, register scaling, and a bright cuivré edge for loud playing. This is a provisional physical model, so use it as a built-in brass fallback rather than as a final brass simulation. Presets: `trumpet`, `trombone`, `tuba`, `french-horn`, `muted-trumpet`, `cornet`, `flugelhorn`, `euphonium`.

### `flute` — air-jet flute

A breath-driven air-jet / open-pipe model with jet/reflection brightness, chiff/noise, overblow behavior, and vibrato control. This is currently a provisional fallback voice for **flutes, whistles, and ocarina-like edge-tone instruments**. Presets: `concert-flute`, `piccolo`, `recorder`, `pan-flute`, `shakuhachi`, `tin-whistle`, `ocarina`, `blown-bottle`.

### `plucked-string` — buzzing-bridge plucked string

A plucked-string waveguide whose bridge model keeps grazing the string, spraying energy back into the upper partials so the note shimmers and buzzes for its whole ring. The `buzz` control sweeps from a clean harp or koto (no buzz) to the bright, sustaining rattle of a sitar's curved jawari bridge or a shamisen's sawari. Distinct from `karplus-strong`, which models a clean-terminated pluck (the named `harp` preset stays there). Good for **the koto / sitar buzzing-bridge plucked family**. Presets: `koto`, `sitar`, `tanpura`.

### `vocal` — source-filter voice

A two-stage voice: a glottal source (a band-limited sawtooth shaped by a spectral tilt, plus aspiration noise) feeding a bank of five resonant bandpass formants tuned to a sung vowel. The `vowel` field selects the formant table (/a/, /e/, /i/, /o/, /u/), `brightness` tilts the source and opens the upper formants, and a per-voice vibrato modulates the pitch. Good for **choir and solo-voice previews**. Presets: `choir-aah`, `choir-ooh`, `voice-eeh`.

### `free-reed` — driven free reed

A driven metal-tongue oscillator (a phase accumulator shaped by an asymmetric saturator and a body lowpass) that models the free reed of an accordion, harmonica, or bandoneon — the tongue's own pitch sets the note, with no coupled air column. A `detune` control splits it into two slightly sharp tongues for the shimmering musette beat. Good for **accordion, harmonica, and reed-organ previews**. Presets: `accordion`, `harmonica`, `bandoneon`, `reed-organ`.

## The GM fallback bank

The GM fallback is not just a last-resort sine bank. When a SoundFont is absent or incomplete, NativeSynth chooses the closest built-in synthesis voice for the requested GM program. Some of those voices are provisional physical models whose calibration is still underway. The goal is useful, data-free preview and missing-program coverage, not final sampled-instrument realism.

| GM area | Data-free fallback voice |
|---------|--------------------------|
| Programs 0-7, keyboard | Extended-waveguide grand piano, FM electric pianos/clavinet, and Karplus-Strong harpsichord bank variants |
| Programs 8-15, chromatic percussion | Modal celesta, glockenspiel, music box, vibraphone, marimba, xylophone, and tubular bells, plus a Karplus-Strong dulcimer |
| Programs 16-23, organ | Additive drawbar organs (16-18), the physical church-organ flue pipe (19), and free-reed-engine reed-organ/accordion, harmonica, and bandoneon voices (20-23) |
| Programs 24-37, guitar and bass | Karplus-Strong nylon, steel, electric, muted/overdriven/distorted guitars, harp, and dedicated bass variants |
| Programs 40-47, strings/orchestra | Bowed violin family, a tremolo-strings pad, Karplus-Strong pizzicato strings and harp, and a timpani fallback |
| Programs 52-54, choir/voice | Choir-aahs, voice-oohs, and synth-voice programs voiced on the dedicated source-filter vocal engine |
| Programs 56-79, brass/reed/flute | Provisional lip-reed brass (56-60) and FM brass (61-63), plus reed woodwinds/saxophones and air-jet flutes |
| Programs 104-107, ethnic plucked | Buzzing-bridge plucked-string sitar (104), shamisen (106), and koto (107); the banjo (105) stays on Karplus-Strong |
| Programs 112-119, percussive | Percussion-engine tinkle bell, agogo, steel drums, woodblock, taiko drum, melodic tom, synth drum, and reverse cymbal |
| Drums and GS variants | GM/GS drum-kit variants and GM2/GS bank fallbacks, with GS EFX routed to built-in insert chains where available |

Two notes worth knowing up front: named pipe-organ colors like `bourdon` and `trumpet-rank` live only in the named preset catalog, not in GM program routing (program 19 is the church-organ flue pipe, and programs 20-23 are the free-reed reed-organ, harmonica, and bandoneon); and program 6 (Harpsichord) is the one GM program whose fallback also reads Bank Select, choosing between plain, octave-mix, wide-stereo, and key-off-noise registrations.

For beginners, the practical rule is simple: **use SoundFont when you need exact or production-ready sampled instruments; rely on NativeSynth fallback when you need a small, always-available preview or a missing-program safety net**.

## The named preset catalog

NativeSynth ships a named preset catalog. **Do not hardcode preset names** — list them from the runtime with `synthPresetNames()`, and inspect any one as a `SynthPatch` with `synthPresetPatch(name)`.

<SonareDemo id="synth-presets" />

::: code-group

```typescript [Browser]
import { init, synthPresetNames, synthPresetPatch } from '@libraz/libsonare';

await init();

synthPresetNames();
// ['sine', 'saw-lead', 'square-lead', 'sub-bass', 'warm-pad', 'e-piano',
//  'bell', 'brass', 'pluck', 'classical-guitar', 'steel-guitar',
//  'electric-guitar', 'harp', 'bass-acoustic', ...,
//  'church-organ', 'violin', 'clarinet', 'trumpet', 'concert-flute', ...]

const pad = synthPresetPatch('warm-pad');
// { preset: 'warm-pad', engineMode: 'subtractive', waveform: 'saw',
//   unison: 7, detuneCents: 18, cutoffHz: 2800, ampAttackMs: 400, ... }
```

```python [Python]
import libsonare as sonare

sonare.synth_preset_names()
# ['sine', 'saw-lead', 'square-lead', 'sub-bass', 'warm-pad', 'e-piano',
#  'bell', 'brass', 'pluck', 'classical-guitar', 'steel-guitar',
#  'electric-guitar', 'harp', 'bass-acoustic', ...,
#  'church-organ', 'violin', 'clarinet', 'trumpet', 'concert-flute', ...]

pad = sonare.synth_preset_patch("warm-pad")
# SynthPatch(preset='warm-pad', engine_mode='subtractive', waveform='saw',
#            unison=7, detune_cents=18.0, cutoff_hz=2800.0, ...)
```

:::

The catalog maps to the engines like this (one preset per row is enough to feel each engine):

| Preset | Engine | Good for |
|--------|--------|----------|
| `sine` `saw-lead` `square-lead` `sub-bass` `warm-pad` | `subtractive` | leads, basses, pads |
| `e-piano` `bell` `brass` | `fm` | electric piano, bells, brass |
| `pluck` `classical-guitar` `steel-guitar` `electric-guitar` `harp` `bass-acoustic` `bass-fingered` `bass-picked` `bass-fretless` `bass-slap` | `karplus-strong` | plucked strings and basses |
| `marimba` `glass` | `modal` | tuned mallets |
| `organ` | `additive` | drawbar organ |
| `drum-kit` | `percussion` | GM drum map |
| `acoustic-piano` | `piano` | acoustic piano |
| `church-organ` `church-flute` `church-bourdon` `church-trumpet` | `pipe-organ` | pipe organ ranks |
| `violin` `viola` `cello` `contrabass` | `bowed-string` | bowed strings |
| `clarinet` `soprano-sax` `alto-sax` `tenor-sax` `baritone-sax` `oboe` `english-horn` `bassoon` | `reed` | reed woodwinds |
| `trumpet` `trombone` `tuba` `french-horn` `muted-trumpet` `cornet` `flugelhorn` `euphonium` | `brass` | brass instruments |
| `concert-flute` `piccolo` `recorder` `pan-flute` `shakuhachi` `tin-whistle` `ocarina` `blown-bottle` | `flute` | air-jet flutes and whistles |
| `koto` `sitar` `tanpura` | `plucked-string` | buzzing-bridge plucked strings |
| `choir-aah` `choir-ooh` `voice-eeh` | `vocal` | choir and solo voices |
| `accordion` `harmonica` `bandoneon` `reed-organ` | `free-reed` | accordion, harmonica, reed organ |

The roll below sequences one three-voice phrase and bounces it through `bounceWithSynthInstrument(presetName, …)`. The instrument selector walks across representative piano, FM, plucked-string, modal, organ, bowed-string, reed, brass, and flute presets, so the same notes audibly take on each engine's character.

<SonareDemo id="midi-piano-roll" />

### The `va:` routing prefix

A preset name may carry a `va:` prefix (for example `va:saw-lead`, `va:e-piano`). The prefix is **accepted everywhere a preset name is** — `synthPresetPatch`, `bounceWithSynthInstrument`, and `setSynthInstrument` — and resolves to the same patch as the bare name. It is a routing convention some hosts use to mark "this destination plays the virtual-analog NativeSynth"; the synth strips it before lookup.

### The `drum-kit` preset and the GM drum map

`drum-kit` selects the `percussion` engine and maps incoming MIDI notes to the **General MIDI drum map** — note 36 is the kick, note 38 the acoustic snare, and so on — rather than treating note number as pitch. Route a drum pattern's notes to a destination bound to `drum-kit` and each note triggers its mapped piece.

### GS / GM drum-kit variants

`drum-kit` also recognizes GS-style drum-kit selection (bank-128 program numbers) and reshapes the Standard kit per variant at note-on — more shell body for Room, bigger/lower shells for Power, and so on. Two naming systems overlap at kit 25: the GS bank-128 name and the GM2 percussion-set name differ, which is a property of the two standards rather than a bug.

| Kit no. | GS (bank-128) name | GM2 percussion-set name | Voicing change vs Standard |
|---|---|---|---|
| 0 | Standard | Standard | — |
| 8 | Room | Room | more shell body, longer ambient tail |
| 16 | Power | Power | bigger/lower/longer shells |
| 24 | Electronic | Electronic | sine-ified, dried-out membranes |
| 25 | TR-808 | Analog | classic decaying-sine kick/snare/tom |
| 32 | Jazz | Jazz | tighter, higher, softer |
| 40 | Brush | Brush | snare becomes a sustained swish |
| 48 | Orchestra | Orchestra | longer membrane/cymbal tails |
| 56 | SFX | SFX | recognized/addressed; per-note SFX sounds not yet modeled (plays Standard voicing) |

::: warning SFX kit and Sound-Effects programs are addressed, not yet modeled
The GS-style SFX drum kit (kit 56) and the GM Sound-Effects programs (120-127, covered in the GM tone map below) are **addressed and named** but their per-note effect sounds are not yet individually synthesized in the data-free fallback — the SFX kit plays the Standard kit's voicing, and programs 120-127 share one generic noise voice. A SoundFont that supplies real effect samples for these addresses plays back normally through the SF2 player.
:::

## The `SynthPatch` object

Think of a `SynthPatch` as "a preset, plus your tweaks". It starts from a **base** — the named `preset` (omit it for the default subtractive init patch) — and every field you set overrides that base. Leave a field out and the base value stays.

The most useful beginner workflow is small and reversible: choose a preset, change one or two audible fields, listen, then reset or move on. For example, start from `warm-pad`, lengthen `ampAttackMs` for a slower fade-in, lower `cutoffHz` for a darker tone, or raise `stereoSpread` for a wider pad. You do not need to fill the whole object.

::: warning Zero means "keep the base", not "set to zero"
Watch out: writing `ampSustain: 0` does **not** silence the sustain — it leaves the preset's sustain untouched. Across this object, **0 (or an omitted field) means "keep the base value"; any non-zero value overrides it** (clamped to its audible range). Enum fields use `'default'` for "keep".

You therefore cannot force a numeric field to literally zero. (This is because the frozen C ABI has no per-field "is this set?" flag, so zero has to mean "untouched".) If you genuinely need a value at or near the bottom of a field's range, use the smallest non-zero value instead — for example `ampSustain: 0.001`, which overrides the base and is effectively silent.

One more rule: a non-empty `modRoutings` array **replaces** the base mod matrix entirely, rather than adding to it.
:::

The patch exposes the shared controls every engine uses:

<SonareDemo id="synth-adsr" />

::: info Cents, velocity, and key tracking
- **Cent** — 1/100 of a semitone; 100 cents = one piano key, 1200 = an octave. Pitch and detune amounts are in cents.
- **Velocity** — how hard a note was struck (0–127); presets use it to control brightness or loudness.
- **Key tracking** — making a parameter (like filter cutoff) follow the note's pitch up the keyboard.
:::

| Group | Fields |
|-------|--------|
| Oscillator | `engineMode`, `waveform`, `unison` (1-7), `detuneCents`, `driftCents`, `drive` (0-1) |
| Filter | `filterModel`, `filterOutput` (SVF only), `cutoffHz`, `resonanceQ`, `keyTrack` (0-1), `envToCutoffCents`, `velToCutoffCents` |
| Amp envelope | `ampAttackMs`, `ampDecayMs`, `ampSustain`, `ampReleaseMs` |
| Filter envelope | `filterAttackMs`, `filterDecayMs`, `filterSustain`, `filterReleaseMs` |
| LFOs & glide | `lfoRateHz`, `lfoToPitchCents`, `lfo2RateHz`, `glideMs` |
| Body resonance | `body` (`none` / `guitar` / `violin` / `wood-tube` / `brass-bell` / `vocal`), `bodyMix` (0-1) |
| Stereo & output | `stereoSpread` (0-1), `gain` (linear), `polyphony` (1-64), `busDrive` (0-1) |
| Mod matrix | `modRoutings` (up to 8) |
| Binding (JS only) | `destinationId` (default `0`) |

(*Polyphony* is how many notes can sound at once; a *voice* is one sounding note, and *voice stealing* cuts the oldest note when you run out.)

::: info LFO 2 needs a routing
The two LFOs behave differently. LFO 1 (`lfoRateHz` + `lfoToPitchCents`) is hardwired to pitch and produces vibrato on its own. LFO 2 is matrix-only: setting `lfo2RateHz` does nothing until a `modRoutings` entry uses `source: 'lfo2'` to send it to a destination.
:::

Each **mod routing** is `{ source, destination, depth }`. The mod matrix lets envelopes, LFOs, velocity, key tracking, the mod wheel, and a seeded per-voice random source modulate pitch, filter cutoff, amplitude, and pan. `depth` is in destination units at full source deflection.

<SonareDemo id="synth-tremolo" />

The `body` field is NativeSynth's body/formant resonance layer — the resonant character of an instrument's physical shell or vocal tract. Acoustic guitars, harps, violin-family strings, woodwinds, brass, and choir/voice fallbacks use this layer; solid-body electrics can leave `body` at `none`.

::: info Pitch bend, controller reset, and per-channel state
NativeSynth responds to **pitch-bend** messages, and the bend range follows **RPN 0** (the standard pitch-bend-range parameter, set with the **CC6 / CC38** Data Entry MSB/LSB fine-byte pair — default ±2 semitones). A MIDI **Reset All Controllers** message restores the default — bend range included. You drive these with ordinary MIDI events: pitch-bend events (e.g. `Project.midiPitchBend(...)` offline) and the RPN 0 / data-entry / reset CCs in your stream.

This state is tracked **per channel, not per note**: NativeSynth does not track polyphonic (per-note) or channel pressure at all, and MIDI 2.0 note velocity is quantized down to the ordinary 7-bit range rather than kept at full 16-bit resolution. If you need MPE-style per-note pitch-bend and pressure, or full 16-bit velocity, reach for the simpler built-in waveform synth instead — see `setBuiltinInstrument` in [MIDI Input](./midi-input.md).

Piano-style pedal controls are decoded as ordinary MIDI CCs. Sustain pedal **CC64** supports half-pedal damping, **CC66** acts as sostenuto, and **CC67** applies una-corda / soft-pedal voicing where the active preset uses it.
:::

### Enum name tables

Every enum field accepts either a name string or its C ordinal. Read the authoritative tables from the runtime with `synthEnumTables()` so names and ordinals never drift:

```typescript
import { init, synthEnumTables } from '@libraz/libsonare';

await init();
synthEnumTables();
// {
//   engineModes:      ['default', 'subtractive', 'fm', 'karplus-strong',
//                      'modal', 'additive', 'percussion', 'piano',
//                      'pipe-organ', 'bowed-string', 'reed', 'brass', 'flute',
//                      'plucked-string', 'vocal', 'free-reed'],
//   waveforms:        ['default', 'sine', 'saw', 'square', 'triangle', 'noise'],
//   filterModels:     ['default', 'svf', 'moog-ladder', 'diode-ladder', 'sallen-key'],
//   filterOutputs:    ['default', 'lowpass', 'bandpass', 'highpass'],
//   bodyTypes:        ['default', 'none', 'guitar', 'violin', 'wood-tube',
//                      'brass-bell', 'vocal'],
//   modSources:       ['none', 'amp-env', 'filter-env', 'lfo1', 'lfo2',
//                      'velocity', 'key-track', 'mod-wheel', 'random'],
//   modDestinations:  ['none', 'pitch-cents', 'cutoff-cents', 'amp-gain', 'pan-units'],
// }
```

The same arrays are also exported as named constants (`SYNTH_ENGINE_MODES`, `SYNTH_OSC_WAVEFORMS`, `SYNTH_FILTER_MODELS`, `SYNTH_FILTER_OUTPUTS`, `SYNTH_BODY_TYPES`, `SYNTH_MOD_SOURCES`, `SYNTH_MOD_DESTINATIONS`). Note the index 0 in most tables is `'default'` (keep the base value); `modSources` / `modDestinations` use `'none'` instead.

## Render offline: `bounceWithSynthInstrument`

To turn a MIDI arrangement into audio, bind a NativeSynth instrument to your MIDI destination and bounce. Pass a preset-name string, a `SynthPatch`, or an array of either to bind several destinations at once. When you pass an array, each `SynthPatch` may set `destinationId` (default `0`) to choose which MIDI destination it binds to — for example `[{ preset: 'saw-lead', destinationId: 0 }, { preset: 'drum-kit', destinationId: 1 }]` renders two destinations from one call. `destinationId` is a JS binding convenience, not part of the NativeSynth patch itself (Python takes the destination as a separate argument instead). An explicitly empty array (or `undefined` / `null`) produces zero bindings. The render is deterministic for a fixed project, options, and patch.

::: code-group

```typescript [Browser]
import { init, Project } from '@libraz/libsonare';

await init();

const project = new Project();
project.setSampleRate(48000);

// One MIDI clip: a 2-beat C4 note routed to destination 0.
const { trackId, clipId } = project.addMidiClip(0, 4);
project.setTrackMidiDestination(trackId, 0);
project.setMidiEvents(clipId, [
  Project.midiNoteOn(0, 0, 0, 60, 100),
  Project.midiNoteOff(2, 0, 0, 60, 0),
]);

try {
  // Bind a named preset to destination 0 and render stereo.
  const audio = project.bounceWithSynthInstrument('va:saw-lead', {
    totalFrames: 48000,
    numChannels: 2,
  });
  // audio is interleaved Float32 (frames * channels); non-silent.
} finally {
  project.delete();   // the WASM handle is NOT garbage-collected — always release it
}
```

```python [Python]
import libsonare as sonare

project = sonare.Project()
project.set_sample_rate(48000)

track_id, clip_id = project.add_midi_clip(0, 4)
project.set_track_midi_destination(track_id, 0)
project.set_midi_events(clip_id, [
    sonare.Project.midi_note_on(0, 0, 0, 60, 100),
    sonare.Project.midi_note_off(2, 0, 0, 60, 0),
])

# Bind a named preset to destination 0 and render -> (frames, channels) float32.
audio = project.bounce_with_synth_instrument(
    "va:saw-lead", total_frames=48000, num_channels=2,
)
project.close()
```

```bash [CLI]
sonare project bounce --in song.json -o synth.wav --synth va:saw-lead
sonare project synth-presets            # list the NativeSynth preset catalog
```

:::

To customize, pass a `SynthPatch` instead of a name — start from a preset and override:

```typescript
const audio = project.bounceWithSynthInstrument(
  {
    preset: 'warm-pad',
    cutoffHz: 1200,                // darker than the preset's 2800 Hz
    resonanceQ: 3,
    modRoutings: [{ source: 'lfo1', destination: 'cutoff-cents', depth: 600 }],
  },
  { totalFrames: 48000, numChannels: 2 },
);
```

Leave `totalFrames` at 0 and the bounce auto-derives the length from the arrangement plus the patch's release tail. Unknown preset names throw. For everything `bounceWith*` shares — channels, sample rate, latency — see [Project Bounce](./project-bounce.md).

## Render live: `setSynthInstrument` + MIDI input

For interactive playback, bind the synth to a destination on a `RealtimeEngine` and feed it MIDI. The snippet below runs entirely on the control thread (no AudioWorklet needed) and produces non-zero samples.

```typescript
import { init, RealtimeEngine } from '@libraz/libsonare';

await init();

const engine = new RealtimeEngine(48000, 128);
try {
  engine.setSynthInstrument('va:saw-lead', 7);   // bind to destination 7
  engine.pushMidiNoteOn(7, 0, 0, 60, 100);       // destination, group, channel, note, velocity

  const out = engine.process([new Float32Array(128), new Float32Array(128)]);
  // out[0] / out[1] are the rendered stereo block; non-silent.

  engine.midiInstrumentCount();                   // 1
} finally {
  engine.destroy();   // release the native handle
}
```

In a real app you would drive `pushMidiNoteOn` / `pushMidiNoteOff` / `pushMidiCc` from a live keyboard, or enable the engine-owned MIDI input source and push events as they arrive — see [MIDI Input](./midi-input.md). `setSynthInstrument` resolves a preset name or `SynthPatch` exactly like `bounceWithSynthInstrument`, so a sound you dialed in offline plays identically live.

## NativeSynth and the SoundFont fallback

NativeSynth is the safety net under the [SoundFont player](./soundfont-player.md). When you render with `bounceWithSf2Instrument` (or bind an SF2 live), libsonare resolves each `(channel, bank, program)` the arrangement actually plays:

- if the loaded SoundFont covers the program, that note renders from the **SF2** (GS variation and drum fallbacks included);
- otherwise — including when no SoundFont is loaded at all — the note plays through the **NativeSynth GM fallback bank** (all 128 programs plus the drum map).

Inspect the per-program backend before rendering with `soundFontManifest()`, which reports `'sf2'` or `'synth'` for each program in first-use order:

```typescript
project.loadSoundFont(sf2Bytes);
const manifest = project.soundFontManifest();
// [{ channel, bank, program, backend: 'sf2' | 'synth', presetName }, ...]
```

Because the GM fallback bank is always present, MIDI never renders silent for lack of data. See [SoundFont Player](./soundfont-player.md) for loading SF2 data and per-channel/program resolution.

### GM fallback program routing

The fallback bank uses the closest NativeSynth engine for each GM program family, with a few program-level overrides where the instrument behavior matters. Acoustic-style rows below are still provisional calibration targets, so read them as routing coverage, not as a claim of final sampled-instrument realism.

| GM program | Instrument | Fallback engine | Why |
|------------|------------|-----------------|-----|
| 4-5 | Electric Piano 1 / 2 | `fm` | phase-modulated tine/bell brightness |
| 6 | Harpsichord | `karplus-strong` | quill-plucked string with near velocity-insensitive brightness |
| 7 | Clavi | `fm` | struck string and pickup color, currently approximated by FM |
| 8, 10, 14 | Celesta, Music Box, Tubular Bells | `modal` | felt-struck steel bar, twin-tooth tine shimmer, and a missing-fundamental strike pitch |
| 9, 11-13 | Glockenspiel, Vibraphone, Marimba, Xylophone | `modal` | tuned-bar resonators |
| 15 | Dulcimer | `karplus-strong` | provisional; hammered (struck, not plucked) string |
| 16-23 | Organ family | `additive` / `pipe-organ` / `free-reed` | drawbar registrations (16-18), the provisional church-organ flue pipe (19), and free-reed reed-organ, harmonica, and bandoneon voices (20-23) |
| 24-31 | Guitar family | `karplus-strong` | plucked string waveguide |
| 32-37 | Acoustic, electric, fretless, and slap basses | `karplus-strong` | bass-string waveguide with program-specific slap/polarization |
| 40-43 | Violin, Viola, Cello, Contrabass | `bowed-string` | provisional sustained friction-excited string waveguide |
| 44 | Tremolo Strings | `subtractive` | detuned-saw section with an amplitude-tremolo LFO rather than a bowed model |
| 45-46 | Pizzicato Strings, Orchestral Harp | `karplus-strong` | short pluck into a violin-body or steel-string corpus |
| 47 | Timpani | `percussion` | note-tracked kettledrum fallback voice |
| 48 | String Ensemble 1 | `subtractive` | pad-like ensemble fallback rather than solo bow model |
| 52-54 | Choir Aahs, Voice Oohs, Synth Voice | `vocal` | source-filter voice (glottal source + vowel formant bank), not a subtractive pad |
| 56-60 | Trumpet, Trombone, Tuba, Muted Trumpet, French Horn | `brass` | provisional lip-reed brass waveguide |
| 61-63 | Brass Section, Synth Brass 1 / 2 | `fm` | FM by design, not the brass waveguide |
| 64-71 | Saxophones, Oboe, English Horn, Bassoon, Clarinet | `reed` | provisional reed and bore waveguides |
| 72-79 | Piccolo, Flute, Recorder, Pan Flute, Bottle, Shakuhachi, Whistle, Ocarina | `flute` | provisional air-jet / open-pipe waveguides |
| 104, 106, 107 | Sitar, Shamisen, Koto | `plucked-string` | buzzing-bridge (jawari / sawari) plucked string; the banjo (105) stays on `karplus-strong` |
| 112-119 | Tinkle Bell, Agogo, Steel Drums, Woodblock, Taiko Drum, Melodic Tom, Synth Drum, Reverse Cymbal | `percussion` | note-tracked percussion-engine voices, distinct from the drum-kit map |

Program 6 (Harpsichord) is the one GM program whose fallback also reads Bank Select: bank 0 plays a plain 8′ registration, bank 1 adds an octave (8′+4′) mix, bank 2 widens to a two-choir stereo spread, and bank 3 adds key-off jack noise.

This routing is separate from the named preset catalog: `synthPresetNames()` still lists the hand-authored presets (`e-piano`, `harp`, `drum-kit`, and so on), while the GM fallback bank chooses the internal patch for each MIDI program number during SF2 fallback.

## GM tone map — all 128 programs

Every General MIDI program resolves to one of the fifteen engines. The table below is the data-free fallback voicing NativeSynth uses for each GM program number when no SoundFont covers it; the canonical instrument names are also available at runtime from `Project.gmInstrumentName(program)`. Rows marked *provisional* use one of the acoustic physical models still being calibrated.

::: details Show the full 128-program tone map
**Model status** — **stable**: the subtractive, FM, modal, additive, and percussion cores are settled. **provisional**: the piano, Karplus-Strong, pipe-organ, bowed-string, reed, brass, and flute physical models are still being calibrated.

#### Piano (0-7)

| Prog | Instrument | Engine | Notes |
|---|---|---|---|
| 0 | Acoustic Grand Piano | `piano` | provisional; shared modal soundboard |
| 1 | Bright Acoustic Piano | `piano` | provisional |
| 2 | Electric Grand Piano | `piano` | provisional (the acoustic waveguide, not FM) |
| 3 | Honky-tonk Piano | `piano` | provisional |
| 4 | Electric Piano 1 | `fm` | tine/bell FM |
| 5 | Electric Piano 2 | `fm` | shares the EP1 voicing |
| 6 | Harpsichord | `karplus-strong` | quill pluck; bank-aware registrations (see the note above) |
| 7 | Clavi | `fm` | bright high-ratio FM |

#### Chromatic Percussion (8-15)

| Prog | Instrument | Engine | Notes |
|---|---|---|---|
| 8 | Celesta | `modal` | soft felt-struck steel bar |
| 9 | Glockenspiel | `modal` | uniform-bar mode ratios |
| 10 | Music Box | `modal` | twin-tooth beating for tine shimmer |
| 11 | Vibraphone | `modal` | motor tremolo (LFO → amplitude) |
| 12 | Marimba | `modal` | deep-arch bar, wood-tube body |
| 13 | Xylophone | `modal` | short, dry deep-arch bar |
| 14 | Tubular Bells | `modal` | missing-fundamental strike pitch, long ring |
| 15 | Dulcimer | `karplus-strong` | provisional; hammered (struck) string |

#### Organ (16-23)

| Prog | Instrument | Engine | Notes |
|---|---|---|---|
| 16 | Drawbar Organ | `additive` | 9-drawbar Hammond |
| 17 | Percussive Organ | `additive` | |
| 18 | Rock Organ | `additive` | |
| 19 | Church Organ | `pipe-organ` | provisional; multi-rank plenum |
| 20 | Reed Organ | `free-reed` | provisional; harmonium — mellow plate, soft tongues |
| 21 | Accordion | `free-reed` | provisional; shares the reed-organ voicing |
| 22 | Harmonica | `free-reed` | provisional; small, bright, stiff tongues + hand vibrato |
| 23 | Tango Accordion | `free-reed` | provisional; bandoneon, musette (wet-beating) detune |

#### Guitar (24-31)

| Prog | Instrument | Engine | Notes |
|---|---|---|---|
| 24 | Acoustic Guitar (nylon) | `karplus-strong` | provisional; softer pluck, no dispersion |
| 25 | Acoustic Guitar (steel) | `karplus-strong` | provisional; steel-string dispersion + sympathetic |
| 26 | Electric Guitar (jazz) | `karplus-strong` | provisional; near-bridge pickup, no body |
| 27 | Electric Guitar (clean) | `karplus-strong` | provisional; shares the jazz voicing |
| 28 | Electric Guitar (muted) | `karplus-strong` | provisional; choked (palm-mute) decay |
| 29 | Overdriven Guitar | `karplus-strong` | provisional; pre-filter drive |
| 30 | Distortion Guitar | `karplus-strong` | provisional; harder drive |
| 31 | Guitar Harmonics | `karplus-strong` | provisional |

#### Bass (32-39)

| Prog | Instrument | Engine | Notes |
|---|---|---|---|
| 32 | Acoustic Bass | `karplus-strong` | provisional; large resonating body |
| 33 | Electric Bass (finger) | `karplus-strong` | provisional; pickup + two-polarization beat |
| 34 | Electric Bass (pick) | `karplus-strong` | provisional; bright near-bridge attack |
| 35 | Fretless Bass | `karplus-strong` | provisional; rounder, glide-friendly |
| 36 | Slap Bass 1 | `karplus-strong` | provisional; thumb slap + fret-slap buzz |
| 37 | Slap Bass 2 | `karplus-strong` | provisional; sharper pop |
| 38 | Synth Bass 1 | `subtractive` | synth bass by design |
| 39 | Synth Bass 2 | `subtractive` | synth bass by design |

#### Strings (40-47)

| Prog | Instrument | Engine | Notes |
|---|---|---|---|
| 40 | Violin | `bowed-string` | provisional |
| 41 | Viola | `bowed-string` | provisional; darker/slower |
| 42 | Cello | `bowed-string` | provisional |
| 43 | Contrabass | `bowed-string` | provisional; darkest/slowest |
| 44 | Tremolo Strings | `subtractive` | detuned-saw section with an amplitude-tremolo LFO |
| 45 | Pizzicato Strings | `karplus-strong` | provisional; short pluck into a violin-body corpus |
| 46 | Orchestral Harp | `karplus-strong` | provisional; long undamped ring |
| 47 | Timpani | `percussion` | note-tracked kettledrum |

#### Ensemble (48-55)

| Prog | Instrument | Engine | Notes |
|---|---|---|---|
| 48 | String Ensemble 1 | `subtractive` | wide supersaw pad with section vibrato |
| 49 | String Ensemble 2 | `subtractive` | |
| 50 | SynthStrings 1 | `subtractive` | |
| 51 | SynthStrings 2 | `subtractive` | |
| 52 | Choir Aahs | `vocal` | provisional; open /a/ vowel, glottal source + formants |
| 53 | Voice Oohs | `vocal` | provisional; darker closed /u/ vowel |
| 54 | Synth Voice | `vocal` | provisional; brighter, steadier synthetic vowel |
| 55 | Orchestra Hit | `subtractive` | bright detuned-saw stab |

#### Brass (56-63)

| Prog | Instrument | Engine | Notes |
|---|---|---|---|
| 56 | Trumpet | `brass` | provisional; lip-reed waveguide |
| 57 | Trombone | `brass` | provisional |
| 58 | Tuba | `brass` | provisional; dark, conical |
| 59 | Muted Trumpet | `brass` | provisional; physical mute model |
| 60 | French Horn | `brass` | provisional; rounder, conical |
| 61 | Brass Section | `fm` | FM by design (not the brass waveguide) |
| 62 | SynthBrass 1 | `fm` | FM by design |
| 63 | SynthBrass 2 | `fm` | FM by design |

#### Reed (64-71)

| Prog | Instrument | Engine | Notes |
|---|---|---|---|
| 64 | Soprano Sax | `reed` | provisional; conical bore |
| 65 | Alto Sax | `reed` | provisional; conical |
| 66 | Tenor Sax | `reed` | provisional; conical |
| 67 | Baritone Sax | `reed` | provisional; conical, darkest sax |
| 68 | Oboe | `reed` | provisional; conical, bright/nasal |
| 69 | English Horn | `reed` | provisional; conical |
| 70 | Bassoon | `reed` | provisional; conical, low |
| 71 | Clarinet | `reed` | provisional; cylindrical bore (odd harmonics) |

#### Pipe (72-79) — air-jet flute engine

| Prog | Instrument | Engine | Notes |
|---|---|---|---|
| 72 | Piccolo | `flute` | provisional; brightest |
| 73 | Flute | `flute` | provisional |
| 74 | Recorder | `flute` | provisional |
| 75 | Pan Flute | `flute` | provisional; breathy vortex |
| 76 | Blown Bottle | `flute` | provisional; dark, high damping |
| 77 | Shakuhachi | `flute` | provisional; breathiest |
| 78 | Whistle | `flute` | provisional |
| 79 | Ocarina | `flute` | provisional; closed-vessel |

#### Synth Lead (80-87) — all subtractive

| Prog | Instrument | Engine | Notes |
|---|---|---|---|
| 80 | Lead 1 (square) | `subtractive` | 3-osc detuned lead through a Moog-ladder filter |
| 81 | Lead 2 (sawtooth) | `subtractive` | |
| 82 | Lead 3 (calliope) | `subtractive` | |
| 83 | Lead 4 (chiff) | `subtractive` | |
| 84 | Lead 5 (charang) | `subtractive` | |
| 85 | Lead 6 (voice) | `subtractive` | |
| 86 | Lead 7 (fifths) | `subtractive` | |
| 87 | Lead 8 (bass + lead) | `subtractive` | |

#### Synth Pad (88-95) — all subtractive

| Prog | Instrument | Engine | Notes |
|---|---|---|---|
| 88 | Pad 1 (new age) | `subtractive` | 7-osc supersaw pad |
| 89 | Pad 2 (warm) | `subtractive` | |
| 90 | Pad 3 (polysynth) | `subtractive` | |
| 91 | Pad 4 (choir) | `subtractive` | |
| 92 | Pad 5 (bowed) | `subtractive` | |
| 93 | Pad 6 (metallic) | `subtractive` | |
| 94 | Pad 7 (halo) | `subtractive` | |
| 95 | Pad 8 (sweep) | `subtractive` | |

#### Synth Effects (96-103) — all subtractive

| Prog | Instrument | Engine | Notes |
|---|---|---|---|
| 96 | FX 1 (rain) | `subtractive` | drifting detuned triangles |
| 97 | FX 2 (soundtrack) | `subtractive` | |
| 98 | FX 3 (crystal) | `subtractive` | |
| 99 | FX 4 (atmosphere) | `subtractive` | |
| 100 | FX 5 (brightness) | `subtractive` | |
| 101 | FX 6 (goblins) | `subtractive` | |
| 102 | FX 7 (echoes) | `subtractive` | |
| 103 | FX 8 (sci-fi) | `subtractive` | |

#### Ethnic (104-111) — buzzing-bridge plucked + karplus-strong

| Prog | Instrument | Engine | Notes |
|---|---|---|---|
| 104 | Sitar | `plucked-string` | provisional; jawari bridge buzz, long shimmering ring |
| 105 | Banjo | `karplus-strong` | provisional; shared pluck sketch |
| 106 | Shamisen | `plucked-string` | provisional; sawari buzz, drier and harder than the sitar |
| 107 | Koto | `plucked-string` | provisional; bridge-buzz plucked string |
| 108 | Kalimba | `karplus-strong` | provisional; shared pluck sketch |
| 109 | Bag pipe | `karplus-strong` | provisional; shared pluck sketch (no reed drone yet) |
| 110 | Fiddle | `karplus-strong` | provisional; shared pluck sketch (not bowed yet) |
| 111 | Shanai | `karplus-strong` | provisional; shared pluck sketch (no reed model yet) |

#### Percussive (112-119) — all percussion

| Prog | Instrument | Engine | Notes |
|---|---|---|---|
| 112 | Tinkle Bell | `percussion` | sparse inharmonic modes |
| 113 | Agogo | `percussion` | two-tone metal bell |
| 114 | Steel Drums | `percussion` | near-harmonic modes |
| 115 | Woodblock | `percussion` | very short, with stick click |
| 116 | Taiko Drum | `percussion` | strong pitch drop + shell boom |
| 117 | Melodic Tom | `percussion` | note-tracked, with shell body |
| 118 | Synth Drum | `percussion` | decaying-sine electronic drum |
| 119 | Reverse Cymbal | `percussion` | long rising swell (simulated reverse) |

#### Sound Effects (120-127) — generic placeholder

<SonareDemo id="gm-sfx" />

The demo above auditions all eight GM Sound-Effects programs directly — a quick way to hear that they currently share one voice instead of eight distinct effects.

| Prog | Instrument | Engine | Notes |
|---|---|---|---|
| 120 | Guitar Fret Noise | `subtractive` | generic resonant-noise placeholder (see note below) |
| 121 | Breath Noise | `subtractive` | generic resonant-noise placeholder |
| 122 | Seashore | `subtractive` | generic resonant-noise placeholder |
| 123 | Bird Tweet | `subtractive` | generic resonant-noise placeholder |
| 124 | Telephone Ring | `subtractive` | generic resonant-noise placeholder |
| 125 | Helicopter | `subtractive` | generic resonant-noise placeholder |
| 126 | Applause | `subtractive` | generic resonant-noise placeholder |
| 127 | Gunshot | `subtractive` | generic resonant-noise placeholder |

Note on 120-127: in the data-free fallback these eight programs currently share one generic noise-through-a-resonant-bandpass voice, differentiated only by the note played — there is no per-effect procedural model yet. A SoundFont that covers these programs plays its own samples instead.
:::

## Current status and limitations

**The physical models are provisional and still being calibrated.** Ten of the fifteen engines are physical models of acoustic instruments — piano, plucked string (Karplus-Strong), bowed string, reed woodwind, brass, air-jet flute, pipe organ, buzzing-bridge plucked string, source-filter vocal, and free reed. They are designed for data-free preview and as the GM fallback floor, not as finished sampled-instrument replacements. Their voicing is tuned by a developer-run A/B harness that compares the synth against a reference SoundFont; this is a manual, ongoing loop, not an automatic or verified-against-reference calibration, and the tuning is not finished. Recent work continues to retune the piano, organ, brass, reed, and violin-family voicing.

**Some advanced physics is implemented but not yet reachable.** The bowed string, reed, brass, and flute engines carry richer nonlinear refinements (elasto-plastic bow friction, tonehole scattering, a brass "cuivré" edge, flute overblow, and more). These exist in the core and default to off — no public binding exposes a switch to turn them on yet — so the sound you get today is the simpler linear model. Expect these to become reachable, and the voicing to keep improving, in future releases.

**A couple of self-oscillating models have a small residual intonation error.** The air-jet flute and flue pipe-organ lock slightly off the naive tuning and are corrected by a calibrated factor; a small, note-dependent residual remains.

**The five non-physical engines are settled.** Subtractive (virtual-analog), FM, modal (mallets/bells), additive (drawbar organ), and membrane percussion carry no provisional caveats — they are the mature core.

**Where the sounds come from.** The synthesis engines are original implementations of published synthesis and physical-modelling algorithm families, and the GM/GS behavior follows the openly documented General MIDI / GS addressing — no sampled or captured instrument audio is bundled, and the result is an independent re-creation rather than a copy of any specific device. For the standards and papers behind each engine, see [Algorithm References](./algorithm-references.md).

## Recipes

:::: details Audition every engine from one project
Bounce the same MIDI clip through one preset per engine to hear each voice.

```typescript
const project = new Project();
project.setSampleRate(48000);
const { trackId, clipId } = project.addMidiClip(0, 4);
project.setTrackMidiDestination(trackId, 0);
project.setMidiEvents(clipId, [
  Project.midiNoteOn(0, 0, 0, 60, 100),
  Project.midiNoteOff(2, 0, 0, 60, 0),
]);
try {
  for (const preset of ['saw-lead', 'e-piano', 'electric-guitar',
                         'marimba', 'organ', 'drum-kit', 'acoustic-piano',
                         'church-organ', 'violin', 'clarinet', 'trumpet',
                         'concert-flute']) {
    const audio = project.bounceWithSynthInstrument(preset, { totalFrames: 48000 });
    // render / inspect each preset's audio
  }
} finally {
  project.delete();
}
```
::::

:::: details Play a drum pattern through the GM drum map
Route drum notes (kick 36, snare 38, hat 42, ...) to a destination bound to `drum-kit`.

```typescript
project.setMidiEvents(clipId, [
  Project.midiNoteOn(0, 0, 9, 36, 110),   // kick
  Project.midiNoteOff(1, 0, 9, 36, 0),
  Project.midiNoteOn(0, 0, 9, 38, 100),   // snare
  Project.midiNoteOff(1, 0, 9, 38, 0),
]);
const audio = project.bounceWithSynthInstrument('drum-kit', { totalFrames: 24000 });
```
Each note triggers its mapped GM piece rather than playing the note as a pitch.
::::

:::: details A custom patch with an LFO wobble
Start from `warm-pad`, darken the filter, and wobble the cutoff with LFO 1.

```typescript
const audio = project.bounceWithSynthInstrument(
  {
    preset: 'warm-pad',
    cutoffHz: 1200,
    resonanceQ: 3,
    lfoRateHz: 6,
    modRoutings: [{ source: 'lfo1', destination: 'cutoff-cents', depth: 600 }],
  },
  { totalFrames: 48000, numChannels: 2 },
);
```
A non-empty `modRoutings` replaces the preset's mod matrix entirely.
::::

## Related

- [Project Bounce](./project-bounce.md) — offline rendering options shared by every `bounceWith*` instrument
- [SoundFont Player](./soundfont-player.md) — sampled instruments, with NativeSynth as the GM fallback floor
- [MIDI Input](./midi-input.md) — feeding live and scheduled MIDI to a bound instrument
- [Project Editing](./project-editing.md) — building the MIDI arrangement you render
- [Recording and Takes](./recording-and-takes.md) — capturing performances into the project
