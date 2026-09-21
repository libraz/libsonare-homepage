---
title: Built-in Synthesizer (NativeSynth)
description: Guide to libsonare's data-free patch-driven NativeSynth — its seventeen synthesis engines, the SynthPatch object, the named preset catalog, the GM fallback bank, and how to drive it offline and live, with copy-paste recipes.
---

# Built-in Synthesizer (NativeSynth)

**NativeSynth turns MIDI into sound on its own** — no samples to download, no SoundFont to ship. It is built into libsonare, so a MIDI track always makes sound out of the box.

For a first pass, you only need three ideas:

1. choose a named preset such as `acoustic-piano`, `warm-pad`, or `drum-kit`;
2. route MIDI notes to the destination that uses that preset;
3. optionally override simple fields such as `cutoffHz`, `ampAttackMs`, or `stereoSpread`.

Under the hood, NativeSynth is one synthesizer with **seventeen swappable synthesis engines**. Each engine is a different way to create the raw tone. Several acoustic-style engines are still provisional physical models: they are useful for data-free preview and fallback, but their final voicing/calibration is still in progress.

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
- a free-reed voice (accordion, harmonica, bandoneon),
- a jack-and-plectrum harpsichord with real string choirs,
- and a sample player for PCM you supply yourself.

All seventeen share one common control layer for modulation, envelopes, filters, stereo width, and polyphony, so the same patch fields work across very different sounds. To get a sound, pick a preset by name — or start from a preset and change only the fields you care about with a `SynthPatch`. You never have to touch the engine internals to start.

::: info Synthesis terms in one place
The engine names below are different ways to *generate* a tone. You don't need them all to start — pick a preset and play — but here is the one-line version of each:

- **subtractive** — start with a bright waveform and carve it with a filter (the classic analog-synth recipe).
- **FM / phase modulation** — one oscillator's output is added to another's phase (the DX-family way of implementing FM), producing metallic and bell-like tones.
- **Karplus-Strong** — a short delay loop that models a plucked string.
- **modal** — a bank of tuned resonators modeling a struck bar or bell.
- **additive / drawbar** — sums harmonic sine partials, like the drawbars on a Hammond organ.
- **(extended) waveguide** — a delay-line model of a vibrating string or tube.
- **reed / brass / flute waveguide** — sustained breath-excited models for woodwinds and brass.
- **buzzing-bridge plucked** — a plucked-string loop whose bridge can be made to graze the string and spray energy into the upper partials: cleanly terminated at `buzz` 0 (harp, koto), shimmering and buzzing as `buzz` rises (sitar, tanpura).
- **source-filter vocal** — a glottal source (sawtooth + tilt) fed through a bank of vowel formant resonators for choir and solo-voice tones.
- **free reed** — a driven metal-tongue oscillator (accordion, harmonica, bandoneon), optionally musette-detuned into two beating tongues.
- **jack and plectrum** — the harpsichord's own mechanism: a quill plucks a registration of separate string choirs, so key speed barely changes loudness.
- **sample** — no synthesis at all: PCM frames you hand the engine, mapped over the keyboard and played through the same filter and mod matrix as every other voice.

Two terms appear throughout the patch controls: an **ADSR envelope** (attack/decay/sustain/release — how a level rises and falls over a note) and the **mod matrix** (a routing table that sends modulation sources such as LFOs or envelopes to targets such as pitch or filter cutoff).
:::

::: info MIDI never renders silent
NativeSynth is also the **data-free floor** of the [SoundFont player](./soundfont-player.md). When you bounce a project through an SF2 and a program (or the whole SoundFont) is missing, those notes fall back to the NativeSynth **GM fallback bank** — all 128 General MIDI programs plus the drum map. You get audio either way. The bank itself — its GS variation tones, drum-kit variants, and GM program following — has its own page, [GM and GS Fallback Bank](./gm-gs.md), and the voicing of all 128 programs is on [GM Tone Map](./gm-tone-map.md).
:::

::: tip Where NativeSynth sits
A NativeSynth patch is an **instrument**: you bind it to a MIDI destination, and the MIDI on tracks routed to that destination plays through it. Offline you bind it in [`bounceWithSynthInstrument`](./project-bounce.md); live you bind it with `engine.setSynthInstrument` and feed [MIDI input](./midi-input.md). For sampled, multisampled instruments instead, use the [SoundFont player](./soundfont-player.md).
:::

A single signal path runs through NativeSynth on every note. A MIDI note picks one of the seventeen engines, and that engine takes the oscillator's place at the head of the chain; the filter, the amplifier envelope, and the body resonance stage behind it are shared by all of them, and the modulation matrix reaches into whichever stage its destination names. The figure draws one voice with the subtractive oscillator in the first block.

<SynthSignalPathFigure title="One voice, and where the mod matrix reaches into it" />

## What You Will Learn

By the end of this page you should be able to:

- pick the right synthesis engine for a sound, and the right named preset;
- start from a preset and override individual fields with a `SynthPatch`;
- list the **real** preset and enum names from the runtime instead of guessing;
- understand the `va:` routing prefix and the `drum-kit` GM drum map;
- render MIDI to audio offline with `bounceWithSynthInstrument` and live with `setSynthInstrument`;
- know when a note plays NativeSynth versus the loaded SoundFont.

::: tip Play it first
The [Synth Playground](/synth) runs this synthesizer in the browser — a keyboard, the full preset catalog, and live patch edits. It uses nothing but the instruments: no analysis, no mastering. The [instrument demos](/demos) cover single behaviours such as the ADSR envelope, the filter, and the GS effects.
:::

## The seventeen synthesis engines

Every preset selects one `engineMode`. The shared sections (filter, envelopes, LFOs, mod matrix, body resonance, polyphony) apply on top of whichever engine is active. Mode-specific deep parameters — FM operator stacks, modal mode tables, drawbar registrations, kit pieces, piano strings, pipe ranks, bowed-string friction, reed/brass bores, and flute jet geometry — live **inside the named presets**, not in the patch.

::: warning Four engines sound only through a preset
`fm`, `modal`, `percussion`, and `sample` render **silence** from a bare `engineMode`. Their sound is a table the patch does not carry — the FM operator levels, the modal mode list, the kit and its membrane modes, the sample bank — and a patch that only names the mode has none of it. Start from the preset instead: `{ preset: 'e-piano' }`, `'marimba'`, `'drum-kit'`, or a `'sample'` patch with a bound `SampleBank`. The other thirteen engines do sound from a bare mode, but not at a matched level: `engineMode: 'harpsichord'` on a default patch peaks several times above the rest, while the `harpsichord` preset sits level with its neighbours, because the level trim lives in the preset too.
:::

### `subtractive` — virtual-analog

The classic oscillator → filter → amp voice. Detuned unison, drift, a pre-filter drive stage, and a choice of four filter models give it everything from fat saw leads to wide pads. Good for **leads, basses, pads, and plucks** — anything you'd reach for an analog synth to do. Presets: `sine`, `saw`, `square`, `triangle`, `saw-lead`, `square-lead`, `sub-bass`, `warm-pad`.

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

A phase-modulation operator stack (one oscillator's output is added to another's phase → metallic/bell tones) with a small algorithm table, exponential operator envelopes, a feedback operator, and velocity-to-index (brightness) scaling. Good for **electric pianos, bells, mallets, clavinet, and brass** — the metallic, bell-like, and inharmonic sounds subtractive struggles with. **Preset-only.** A bare `engineMode: 'fm'` carries no operator levels and renders silence; start from `e-piano`.

### `karplus-strong` — plucked string

A fractional-delay waveguide loop (a short delay loop that models a plucked string) with phase-exact tuning, plus pick-position comb, velocity-driven brightness, decay stretching, and note-off loop damping (finger/palm mute). Guitar, harp, and bass presets add provisional physical details: pickup position, body coupling, steel-string dispersion, sympathetic open strings, tension bend, and dual-polarization decay. Treat the acoustic realism as **in calibration**, not as a finished instrument model. Good for **plucked and strummed strings** — guitar, bass, harp, and the plucked ethnic family. (The harpsichord is not a bright guitar and has its own engine; see below.) Presets: `classical-guitar`, `steel-guitar`, `electric-guitar`, `harp`, `bass-acoustic`, `bass-fingered`, `bass-picked`, `bass-fretless`, `bass-slap`.

### `modal` — mallet percussion

A modal resonator bank (a bank of tuned resonators modeling a struck bar or bell) tuned to physical mode ratios (uniform-bar glockenspiel, deep-arch marimba/vibraphone), with mallet-hardness velocity weighting and per-mode decay. Good for **tuned mallet instruments** — glockenspiel, vibraphone, marimba, xylophone. **Preset-only.** A bare `engineMode: 'modal'` has an empty mode list and renders silence; start from `marimba`, `glass`, or `bell`.

### `additive` — drawbar organ

The nine Hammond drawbar pitches (summing harmonic sine partials, one drawbar per partial) with stepped stop levels, free-running partial phases, and a key-click contact transient. Good for **organs** — sustained, harmonic-rich registrations. Preset: `organ`.

### `percussion` — membrane percussion

Rayleigh circular-membrane modes with a descending strike-pitch envelope under filtered noise. This engine backs the **GM drum kit** — kick, snare shell + wires, toms, hats, and cymbals with inharmonic ring modes, one-shot and deterministic. **Preset-only.** A bare `engineMode: 'percussion'` has no kit and no membrane modes and renders silence; start from `drum-kit`.

### `piano` — extended-waveguide acoustic piano

A data-free grand-piano sketch with the four piano-defining elements: stiff-string dispersion (partials stretch sharp up the keyboard), a nonlinear felt hammer (hard strikes are shorter and brighter), 2-3 coupled micro-detuned unison strings, and a soundboard resonator bank. The voicing is register-scaled, so bass notes, middle-register chords, and treble notes do not share one over-simple brightness curve.

Three structural details shape what you hear beyond that outline:

- **Longitudinal string modes** are modelled and summed into the output. A struck string vibrates along its length as well as across it, and those modes — driven by the tension the transverse motion itself creates — are what fills the bass attack between roughly 200 Hz and 3 kHz. Without them a low note is felt more than heard.
- **Inharmonicity follows a U-shaped curve**, not a monotonic climb. It grows toward the treble as stiffness would suggest, but below the bass break the wound strings turn it back upward, so the very bottom of the keyboard is more inharmonic than the notes just above it.
- **Stretch tuning is an asymmetric Railsback curve** — two power-law branches meeting at the A4 anchor, about ten cents flat at the bottom against fifty sharp at the top, which is why one odd function about the middle cannot express it. The curve is held at the fitted keyboard bounds rather than extrapolated past them.

The voice also carries **an explicit output level calibrated against a captured concert grand**. A physical model has no output level of its own — the string, the hammer, and the board are each calibrated against something and the product of the three is a number nobody chose — so without that step a piano sat well under the rest of the fallback bank. It now sits between the violin and the alto sax, which is where a grand belongs among them.

This is still a provisional model intended for built-in preview, not a sampled-piano replacement. Good for **acoustic piano**. Preset: `acoustic-piano`. GM programs 0-3 use it, as do the five piano-derived [GS variations](./gm-gs.md#gs-variation-tones).

### `pipe-organ` — sustained flue pipe

A provisional waveguide flue-pipe model with shared wind behavior, multi-rank registration, reed-pipe color, and mouth/radiation correction. Good for **church organ color previews** from principals and bourdon stops to flute and trumpet ranks. Presets: `church-organ`, `church-flute`, `church-bourdon`, `church-trumpet`.

### `bowed-string` — friction-excited string

A sustained bowed-string waveguide with bow speed/force/position control, sympathetic resonance, second-polarization beating, and a violin-family body resonator. The model is provisional and still being tuned against references. Good for **violin-family previews**. Presets: `violin`, `viola`, `cello`, `contrabass`.

### `reed` — woodwind reed

A reed-bore waveguide with cylindrical and conical variants, tonehole/growth-cone behavior, register-scaled voicing, and live breath/brightness control. This is a provisional GM fallback/preview voice while calibration continues. Good for **single- and double-reed woodwind previews** and saxophones. Presets: `clarinet`, `soprano-sax`, `alto-sax`, `tenor-sax`, `baritone-sax`, `oboe`, `english-horn`, `bassoon`.

### `brass` — lip-reed brass

A brass waveguide with lip tension, brass-bell body resonance, conical/cylindrical voicing, register scaling, and a bright cuivré edge for loud playing. This is a provisional physical model, so use it as a built-in brass fallback rather than as a final brass simulation. Presets: `brass`, `trumpet`, `trombone`, `tuba`, `french-horn`, `muted-trumpet`, `cornet`, `flugelhorn`, `euphonium`.

### `flute` — air-jet flute

A breath-driven air-jet / open-pipe model with jet/reflection brightness, chiff/noise, overblow behavior, and vibrato control. This is currently a provisional fallback voice for **flutes, whistles, and ocarina-like edge-tone instruments**. Presets: `concert-flute`, `piccolo`, `recorder`, `pan-flute`, `shakuhachi`, `tin-whistle`, `ocarina`, `blown-bottle`.

### `plucked-string` — buzzing-bridge plucked string

A plucked-string waveguide whose bridge model keeps grazing the string, spraying energy back into the upper partials so the note shimmers and buzzes for its whole ring. The `buzz` control sweeps from a clean harp or koto (no buzz) to the bright, sustaining rattle of a sitar's curved jawari bridge or a shamisen's sawari. Distinct from `karplus-strong`, which models a clean-terminated pluck (the named `harp` preset stays there — `pluck`, `bell`, and `brass` are GM-fallback aliases whose engine differs from what the name suggests). Good for **the koto / sitar buzzing-bridge plucked family**. Presets: `pluck`, `harp-plucked`, `koto`, `sitar`, `tanpura`.

### `vocal` — source-filter voice

A two-stage voice: a glottal source (a naive sawtooth shaped by a one-pole spectral tilt, plus aspiration noise) feeding a bank of five resonant bandpass formants tuned to a sung vowel. The source oscillator is **not** band-limited; because the source-filter path is feed-forward, the raw sawtooth's aliasing is attenuated by the narrow formant bandpasses rather than prevented at the oscillator. The `vowel` field selects the formant table (/a/, /e/, /i/, /o/, /u/), `brightness` tilts the source and opens the upper formants, and a per-voice vibrato modulates the pitch. Good for **choir and solo-voice previews**. Presets: `choir-aah`, `choir-ooh`, `voice-eeh`.

### `free-reed` — driven free reed

A driven metal-tongue oscillator (a phase accumulator shaped by an asymmetric saturator and a body lowpass) that models the free reed of an accordion, harmonica, or bandoneon — the tongue's own pitch sets the note, with no coupled air column. A `detune` control adds a second tongue a few cents sharp of the first, and the beat between the pair is the shimmering musette sound; `detune` 0 collapses back to a single tongue. Good for **accordion, harmonica, and reed-organ previews**. Presets: `accordion`, `harmonica`, `bandoneon`, `reed-organ`.

### `harpsichord` — jack and plectrum

A quill-plucked string model built around the mechanism rather than around a tone control. Three consequences of that mechanism are what a plucked-string engine with knobs cannot reproduce. **Key speed barely changes loudness** — a few decibels across the instrument, and not even monotonically, since past a certain speed the plectrum slips off sooner and the note gets *quieter*; the engine opts out of the velocity curve entirely. **Registration is separate string choirs**, not one string with a mix: two 8′ unisons and a 4′ octave are three independent delay lines at three periods. And the **inharmonic shimmer comes from the short undamped segment behind the bridge**, not from string stiffness, so the speaking partials stay harmonic to within a couple of cents. Good for **harpsichord**. Preset: `harpsichord`.

### `sample` — host-supplied PCM

The one engine that synthesizes nothing. You build a `SampleBank` of mono float frames with key/velocity zones, bind it alongside the patch, and the engine resolves a zone at note-on and steps it. It sits in the *oscillator's* place in the subtractive chain, so your own audio arrives behind the same resonant multi-mode filter, envelopes, LFOs, and mod matrix as a synthesized tone — which is what separates it from the [SoundFont player](./soundfont-player.md), a separate instrument that parses a container and brings its own generator model. Good for **your own recordings and one-shot drum material**. **Bank-only.** It has no preset, and a bare `engineMode: 'sample'` with no `SampleBank` bound renders silence. See [Host PCM: the `sample` engine](#host-pcm-the-sample-engine) for the patch fields.

## The named preset catalog

NativeSynth ships a named preset catalog. **Do not hardcode preset names** — list them from the runtime with `synthPresetNames()`, and inspect any one as a `SynthPatch` with `synthPresetPatch(name)`.

<SonareDemo id="synth-presets" />

::: code-group

```typescript [Browser]
import { init, synthPresetNames, synthPresetPatch } from '@libraz/libsonare';

await init();

synthPresetNames();
// ['sine', 'saw', 'square', 'triangle', 'saw-lead', 'square-lead', 'sub-bass',
//  'warm-pad', 'e-piano', 'bell', 'brass', 'pluck', 'classical-guitar',
//  'steel-guitar', 'electric-guitar', 'harp', 'bass-acoustic', ...,
//  'church-organ', 'violin', 'clarinet', 'trumpet', 'concert-flute', ...,
//  'harp-plucked', 'koto', 'sitar', 'tanpura', ...]

const pad = synthPresetPatch('warm-pad');
// { preset: 'warm-pad', engineMode: 'subtractive', waveform: 'saw',
//   unison: 7, detuneCents: 18, cutoffHz: 2800, ampAttackMs: 400, ... }
```

```python [Python]
import libsonare as sonare

sonare.synth_preset_names()
# ['sine', 'saw', 'square', 'triangle', 'saw-lead', 'square-lead', 'sub-bass',
#  'warm-pad', 'e-piano', 'bell', 'brass', 'pluck', 'classical-guitar',
#  'steel-guitar', 'electric-guitar', 'harp', 'bass-acoustic', ...,
#  'church-organ', 'violin', 'clarinet', 'trumpet', 'concert-flute', ...,
#  'harp-plucked', 'koto', 'sitar', 'tanpura', ...]

pad = sonare.synth_preset_patch("warm-pad")
# SynthPatch(preset='warm-pad', engine_mode='subtractive', waveform='saw',
#            unison=7, detune_cents=18.0, cutoff_hz=2800.0, ...)
```

:::

The catalog maps to the engines like this (one preset per row is enough to feel each engine):

| Preset | Engine | Good for |
|--------|--------|----------|
| `sine` `saw` `square` `triangle` `saw-lead` `square-lead` `sub-bass` `warm-pad` | `subtractive` | leads, basses, pads |
| `e-piano` | `fm` | electric piano, bells, brass |
| `classical-guitar` `steel-guitar` `electric-guitar` `harp` `bass-acoustic` `bass-fingered` `bass-picked` `bass-fretless` `bass-slap` | `karplus-strong` | plucked strings and basses |
| `marimba` `glass` `bell` | `modal` | tuned mallets |
| `organ` | `additive` | drawbar organ |
| `drum-kit` | `percussion` | GM drum map |
| `acoustic-piano` | `piano` | acoustic piano |
| `church-organ` `church-flute` `church-bourdon` `church-trumpet` | `pipe-organ` | pipe organ ranks |
| `violin` `viola` `cello` `contrabass` | `bowed-string` | bowed strings |
| `clarinet` `soprano-sax` `alto-sax` `tenor-sax` `baritone-sax` `oboe` `english-horn` `bassoon` | `reed` | reed woodwinds |
| `brass` `trumpet` `trombone` `tuba` `french-horn` `muted-trumpet` `cornet` `flugelhorn` `euphonium` | `brass` | brass instruments |
| `concert-flute` `piccolo` `recorder` `pan-flute` `shakuhachi` `tin-whistle` `ocarina` `blown-bottle` | `flute` | air-jet flutes and whistles |
| `pluck` `harp-plucked` `koto` `sitar` `tanpura` | `plucked-string` | buzzing-bridge plucked strings |
| `choir-aah` `choir-ooh` `voice-eeh` | `vocal` | choir and solo voices |
| `accordion` `harmonica` `bandoneon` `reed-organ` | `free-reed` | accordion, harmonica, reed organ |
| `harpsichord` | `harpsichord` | harpsichord |

The roll below sequences one three-voice phrase and bounces it through `bounceWithSynthInstrument(presetName, …)`. The instrument selector walks across representative piano, FM, plucked-string, modal, organ, bowed-string, reed, brass, and flute presets, so the same notes audibly take on each engine's character.

<SonareDemo id="midi-piano-roll" />

### The `va:` routing prefix

A preset name may carry a `va:` prefix (for example `va:saw-lead`, `va:e-piano`). The prefix is **accepted everywhere a preset name is** — `synthPresetPatch`, `bounceWithSynthInstrument`, and `setSynthInstrument` — and resolves to the same patch as the bare name. It is a routing convention some hosts use to mark "this destination plays the virtual-analog NativeSynth"; the synth strips it before lookup.

## The `SynthPatch` object

Think of a `SynthPatch` as "a preset, plus your tweaks". It starts from a **base** — the named `preset` (omit it for the default subtractive init patch) — and every field you set overrides that base. Leave a field out and the base value stays.

The most useful beginner workflow is small and reversible: choose a preset, change one or two audible fields, listen, then reset or move on. For example, start from `warm-pad`, lengthen `ampAttackMs` for a slower fade-in, lower `cutoffHz` for a darker tone, or raise `stereoSpread` for a wider pad. You do not need to fill the whole object.

::: warning Absent and zero are different
What decides whether a field overrides the base is **presence**, not value. Omit a numeric field and the base value stays; set one and it overrides the base, clamped to its audible range. That includes an explicit `0` — writing `ampSustain: 0` really does drop the sustain to zero, and `stereoSpread: 0` really does collapse the patch to the centre. Enum fields still use `'default'` to mean "keep".

The patch carries a per-field "was this set?" record alongside a struct version, which is what keeps "absent" and "zero" apart. Earlier builds could not tell them apart and had to treat a zero as "untouched", so older code sometimes wrote a token value such as `ampSustain: 0.001` to approximate a real zero. That workaround is no longer needed — write the `0` you mean.

One more rule: a non-empty `modRoutings` array **replaces** the base mod matrix entirely, rather than adding to it. An empty array clears it, while omitting the key keeps the base matrix.
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

Each **mod routing** is `{ source, destination, depth }`. The matrix routes twelve sources — the two envelopes, both LFOs, velocity, key tracking, the mod wheel, a seeded per-voice random source, breath, aftertouch, expression, and pitch bend — to twelve destinations: pitch, vibrato depth, cutoff, resonance, filter-envelope depth, amplitude, pan, the LFO 1 rate, and the four excitation axes of the physical engines. `depth` is in destination units at full source deflection.

<SonareDemo id="synth-tremolo" />

The `body` field is NativeSynth's body/formant resonance layer — the resonant character of an instrument's physical shell or vocal tract. Acoustic guitars, harps, violin-family strings, woodwinds, brass, and choir/voice fallbacks use this layer; solid-body electrics can leave `body` at `none`.

`body: 'vocal'` is the vowel formant bank, and it is reachable on **any** patch rather than only on the `vocal` engine — a subtractive oscillator driven through it is a sung tone rather than a filtered saw. That is exactly how the GM fallback bank voices Lead 6 (voice) and Pad 4 (choir), which is why those two do not sound like the synth leads and pads around them.

::: info Pitch bend, controller reset, and per-channel state
NativeSynth responds to **pitch-bend** messages, and the bend range follows **RPN 0** (the standard pitch-bend-range parameter, set with the **CC6 / CC38** Data Entry MSB/LSB fine-byte pair — default ±2 semitones). A MIDI **Reset All Controllers** message returns the performance controllers (mod wheel, expression, pitch-bend value, the pedals) and the RPN/NRPN selection to their defaults, but it deliberately leaves the bend range where you set it — send RPN 0 again if you want ±2 semitones back. You drive these with ordinary MIDI events: pitch-bend events (e.g. `Project.midiPitchBend(...)` offline) and the RPN 0 / data-entry / reset CCs in your stream.

This state is tracked **per channel, not per note**: NativeSynth does not track polyphonic (per-note) or channel pressure at all, and MIDI 2.0 note velocity is quantized down to the ordinary 7-bit range rather than kept at full 16-bit resolution. If you need MPE-style (MIDI Polyphonic Expression) per-note pitch-bend and pressure, or full 16-bit velocity, reach for the simpler built-in waveform synth instead — see `setBuiltinInstrument` in [MIDI Input](./midi-input.md).

Piano-style pedal controls are decoded as ordinary MIDI CCs. Sustain pedal **CC64** supports half-pedal damping only on the `piano` engine — there, intermediate values 64-126 damp ringing key-up notes proportionally; on every other engine CC64 is a plain on/off sustain switching at the 64 threshold, so 64 and 126 sound the same as 127. **CC66** acts as sostenuto, and **CC67** applies una-corda / soft-pedal voicing where the active preset uses it.
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
//                      'plucked-string', 'vocal', 'free-reed', 'harpsichord',
//                      'sample'],
//   waveforms:        ['default', 'sine', 'saw', 'square', 'triangle', 'noise'],
//   builtinWaveforms: ['sine', 'saw', 'sawtooth', 'square', 'triangle'],
//   filterModels:     ['default', 'svf', 'moog-ladder', 'diode-ladder', 'sallen-key'],
//   filterOutputs:    ['default', 'lowpass', 'bandpass', 'highpass'],
//   bodyTypes:        ['default', 'none', 'guitar', 'violin', 'wood-tube',
//                      'brass-bell', 'vocal'],
//   modSources:       ['none', 'amp-env', 'filter-env', 'lfo1', 'lfo2',
//                      'velocity', 'key-track', 'mod-wheel', 'random', 'breath',
//                      'aftertouch', 'expression-cc', 'pitch-bend'],
//   modDestinations:  ['none', 'pitch-cents', 'cutoff-cents', 'amp-gain', 'pan-units',
//                      'resonance-q', 'vibrato-depth-cents', 'filter-env-depth',
//                      'lfo1-rate-scale', 'excitation-force', 'excitation-position',
//                      'excitation-brightness', 'spectrum-morph'],
// }
```

The same arrays are also exported as named constants (`SYNTH_ENGINE_MODES`, `SYNTH_OSC_WAVEFORMS`, `SYNTH_FILTER_MODELS`, `SYNTH_FILTER_OUTPUTS`, `SYNTH_BODY_TYPES`, `SYNTH_MOD_SOURCES`, `SYNTH_MOD_DESTINATIONS`, plus `BUILTIN_SYNTH_WAVEFORMS`). Note the index 0 in most tables is `'default'` (keep the base value); `modSources` / `modDestinations` use `'none'` instead.

`builtinWaveforms` / `BUILTIN_SYNTH_WAVEFORMS` is a separate list: it belongs to the minimal built-in oscillator synth (`setBuiltinInstrument`), not to NativeSynth's `waveform` field. It has no `'default'` entry, accepts `'sawtooth'` as well as `'saw'`, and does **not** accept `'noise'`.

### Host PCM: the `sample` engine

The `sample` engine reads its audio from a `SampleBank` you build yourself. Three steps: add mono float frames, map key/velocity rectangles onto them, then bind the bank alongside a patch whose `engineMode` is `'sample'`.

```typescript
import { init, Project, SampleBank } from '@libraz/libsonare';

await init();

const bank = new SampleBank();
try {
  const index = bank.addSample(pcm, { rootKey: 60, sourceRate: 44100 });
  bank.addZone({ sampleIndex: index });          // an empty zone is the whole keyboard
  const audio = project.bounceWithSynthInstrument(
    { engineMode: 'sample', sampleSet: 0, sampleBank: bank },
    { totalFrames: 24000 },
  );
} finally {
  bank.delete();   // the WASM handle is NOT garbage-collected
}
```

A **zone** is a key/velocity rectangle pointing at one sample; every bound defaults on its own, so `{}` is the whole keyboard at every velocity and narrowing one axis leaves the other whole. Zones live in numbered **sets**, and a patch names the set it plays through `sampleSet`. Build the whole bank before the bounce that binds it starts — the sample pool is contiguous and moves as it grows, so adding to it while something sounds invalidates the voices reading it.

The patch fields the engine adds:

| Field | Meaning |
|-------|---------|
| `sampleBank` | The bank to read PCM from. A JS binding convenience like `destinationId`, not part of the patch itself; a `'sample'` patch bound without one renders silence |
| `sampleSet` | Keymap set in that bank (negative selects none) |
| `sampleLevel` | Linear gain on the sample, before the voice's own amp stage |
| `sampleLoop` | Overrides the loop mode the bank recorded for the sample |
| `sampleStartOffset` | Attack skip, as a fraction of the mapped region (0 to just under 1) |
| `sampleKeyTrack` | Whether the sample follows the played key, or plays every key at its recorded pitch — the latter is what a one-shot drum wants |

`sampleLoop` takes `'default'` (keep what the bank recorded), `'none'`, `'continuous'`, or `'key-down'`. `sampleKeyTrack` takes `'default'`, `'on'`, or `'off'`. Both also accept the C ordinal.

::: warning `synthEnumTables()` will not list these two
The discovery recipe above returns exactly the enums the C ABI supplies names for, and the ABI has no kind for the sample loop mode or key tracking — so neither appears in `synthEnumTables()`, and looking for them there finds nothing. The names above are the list. In JavaScript they are also exported as the constants `SAMPLE_LOOP_MODES` and `SAMPLE_KEY_TRACKS`.
:::

A sample's own loop points and loop mode are properties of the *recording* and belong on the `SampleDesc` you pass to `addSample`; `sampleLoop` is the per-patch override on top of that. A loop that survives clamping empty is dropped, so a malformed loop plays as an unlooped sample rather than wrapping over nothing.

## Render offline: `bounceWithSynthInstrument`

To turn a MIDI arrangement into audio, bind a NativeSynth instrument to your MIDI destination and bounce. Pass a preset-name string, a `SynthPatch`, or an array of either to bind several destinations at once. When you pass an array, each `SynthPatch` may set `destinationId` (default `0`) to choose which MIDI destination it binds to — for example `[{ preset: 'saw-lead', destinationId: 0 }, { preset: 'drum-kit', destinationId: 1 }]` renders two destinations from one call. `destinationId` is a JS binding convenience, not part of the NativeSynth patch itself (Python takes the destination as a separate argument instead). An explicitly empty array `[]` (or a runtime `null`) produces zero bindings; omitting the argument — or passing `undefined` — falls back to `{}` and still creates one default binding. The render is deterministic for a fixed project, options, and patch.

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

## Current status and limitations

**Most of the physical models are provisional and still being calibrated.** Ten engines are provisional physical models of acoustic instruments — piano, plucked string (Karplus-Strong), bowed string, reed woodwind, brass, air-jet flute, pipe organ, buzzing-bridge plucked string, source-filter vocal, and free reed. (The modal, membrane-percussion, and harpsichord engines are also physical models, but their voicing is settled — see below.) They are designed for data-free preview and as the GM fallback floor, not as finished sampled-instrument replacements. Their voicing is tuned by a developer-run A/B harness that compares the synth against a reference SoundFont; this is a manual, ongoing loop, not an automatic or verified-against-reference calibration, and the tuning is not finished. Work continues on the piano, organ, brass, reed, and violin-family voicing.

**The piano's balance against the rest of the bank has changed.** The acoustic piano now carries an output level measured against a captured concert grand rather than whatever its physics happened to produce. Anything built on the previous balance — a saved mix, a bounced render, a stored hash of one — will differ.

**Some advanced physics is implemented but not yet reachable.** The bowed string, reed, brass, and flute engines carry richer nonlinear refinements (elasto-plastic bow friction, tonehole scattering, a brass "cuivré" edge, flute overblow, and more). These exist in the core and default to off — no public binding exposes a switch to turn them on yet — so the sound you get today is the simpler linear model. Expect these to become reachable, and the voicing to keep improving, in future releases.

**A couple of self-oscillating models have a small residual intonation error.** The air-jet flute and flue pipe-organ lock slightly off the naive tuning and are corrected by a calibrated factor; a small, note-dependent residual remains.

**The remaining engines are settled.** Subtractive (virtual-analog), FM, and additive (drawbar organ) are signal-based (non-physical); modal (mallets/bells), membrane percussion, and the jack-and-plectrum harpsichord are physical models whose voicing is settled. The `sample` engine plays back what you give it and has no voicing of its own. None of these carry provisional caveats.

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
- [Link targets](./cpp-api.md#link-targets) — driving this synthesizer from C++, and trimming a build down to the instruments alone

## Where the sections went

| Section | Now on |
|---|---|
| The GM fallback bank (with GS variation tones) | [GM and GS Fallback Bank](./gm-gs.md) |
| The `drum-kit` preset and the GM drum map | [GM and GS Fallback Bank](./gm-gs.md) |
| GS / GM drum-kit variants | [GM and GS Fallback Bank](./gm-gs.md) |
| Following GM programs instead of pinning one patch | [GM and GS Fallback Bank](./gm-gs.md) |
| NativeSynth and the SoundFont fallback (with GM fallback program routing) | [GM and GS Fallback Bank](./gm-gs.md) |
| GM tone map — all 128 programs | [GM Tone Map](./gm-tone-map.md) |
