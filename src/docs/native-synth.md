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

Under the hood, NativeSynth is one synthesizer with **seventeen swappable synthesis engines**. Each engine is a different way to create the raw tone; the [overview table](#the-seventeen-synthesis-engines) lists them with what each is good for.

<MaturityNote
  item="physical-model-maturity"
  :labels="{
    title: 'Calibration status',
    body: 'Only the acoustic piano is calibrated against a reference recording. Every other physical model, including the harpsichord, modal and membrane models, is provisional: it is meant for data-free preview and as the fallback floor, and its sound can change across patch releases.'
  }"
/>

All seventeen share one common control layer for modulation, envelopes, filters, stereo width, and polyphony, so the same patch fields work across very different sounds. To get a sound, pick a preset by name — or start from a preset and change only the fields you care about with a `SynthPatch`. You never have to touch the engine internals to start.

::: info Synthesis terms
You don't need the engine names to start: pick a preset and play. [Synthesis Basics](./glossary/instruments/synthesis-basics.md#the-seventeen-synthesis-families) gives the one-line version of each method. Two terms appear throughout the patch controls: an **ADSR envelope** (attack/decay/sustain/release, how a level rises and falls over a note) and the **mod matrix** (a routing table that sends modulation sources such as LFOs or envelopes to targets such as pitch or filter cutoff).
:::

::: info MIDI never renders silent
NativeSynth is also the **data-free floor** of the [SoundFont player](./soundfont-player.md). When you bounce a project through an SF2 and a program (or the whole SoundFont) is missing, those notes fall back to the NativeSynth **GM fallback bank** — all 128 General MIDI programs plus the drum map. You get audio either way. The bank itself — its GS variation tones, drum-kit variants, and GM program following — has its own page, [GM and GS Fallback Bank](./gm-gs.md), and the voicing of all 128 programs is on [GM Tone Map](./gm-tone-map.md).
:::

::: tip Where NativeSynth sits
A NativeSynth patch is an **instrument**: you bind it to a MIDI destination, and the MIDI on tracks routed to that destination plays through it. Offline you bind it in [`bounceWithSynthInstrument`](./project-bounce.md); live you bind it with `engine.setSynthInstrument` and feed [MIDI input](./midi-input.md). For sampled, multisampled instruments instead, use the [SoundFont player](./soundfont-player.md).
:::

A single signal path runs through NativeSynth on every note. A MIDI note picks one of the seventeen engines, and that engine takes the oscillator's place at the head of the chain; the filter, the amplifier envelope, and the body resonance stage behind it are shared by all of them, and the modulation matrix reaches into whichever stage its destination names. The figure draws one voice with the subtractive oscillator in the first block.

Because the engine takes the oscillator's place, `waveform` shapes the subtractive engine only; every other engine renders the same whatever it is set to. The percussion engine is the one exception to the shared stages. It voices each kit piece itself, and of the patch fields only `gain`, `busDrive` and `polyphony` change what it renders.

<SynthSignalPathFigure title="One voice, and where the mod matrix reaches into it" />

::: tip Play it first
The [Synth Playground](/synth) runs this synthesizer in the browser — a keyboard, the full preset catalog, and live patch edits. It uses nothing but the instruments: no analysis, no mastering. [Step Bass](/step-bass) puts the subtractive engine to work as one instrument instead: a sixteen-step monophonic bass machine on the diode ladder, where accent and slide are sequenced per step and the cutoff moves under a sounding note. The [instrument demos](/demos) cover single behaviors such as the ADSR envelope, the filter, and the GS effects.
:::

## The seventeen synthesis engines

Every preset selects one `engineMode`. The shared sections (filter, envelopes, LFOs, mod matrix, body resonance, polyphony) apply on top of whichever engine is active. Each engine's own model fields come with the named presets, and a patch overrides them one by one through [`engineParams`](#engine-parameters).

| Engine | Kind | Good for | `engineParams` keys (gated) |
|--------|------|----------|-----------------------------|
| `subtractive` | signal | leads, basses, pads, plucks | 0 |
| `fm` | signal | electric pianos, bells, mallets | 49 |
| `additive` | signal | drawbar organ | 24 (2) |
| `karplus-strong` | physical, provisional | guitars, basses, harp | 23 |
| `modal` | physical, provisional | glockenspiel, vibraphone, marimba | 30 |
| `percussion` | physical, provisional | the GM drum kit | 93 (92) |
| `piano` | physical, calibrated | acoustic piano | 14 |
| `pipe-organ` | physical, provisional | church organ ranks | 63 (52) |
| `bowed-string` | physical, provisional | violin family | 17 (3) |
| `reed` | physical, provisional | clarinet, saxophones, oboe, bassoon | 21 (4) |
| `brass` | physical, provisional | trumpet, trombone, horn, tuba | 21 (1) |
| `flute` | physical, provisional | flutes, whistles, ocarina | 18 |
| `plucked-string` | physical, provisional | koto, sitar, tanpura | 8 |
| `vocal` | physical, provisional | choir and solo voices | 7 |
| `free-reed` | physical, provisional | accordion, harmonica, bandoneon | 12 (3) |
| `harpsichord` | physical, provisional | harpsichord | 29 (5) |
| `sample` | host PCM | your own recordings | 0 |

The key counts are what `synthEngineParamInfo(engineMode)` returns; the number in parentheses is how many of those keys carry an [`activeWhen`](#gated-fields-activewhen) gate. The subsections below say only what is specific to each engine.

::: info A bare `engineMode` voices that engine's base preset
A patch that sets only `engineMode` takes the engine section from the named `preset` when that preset uses the selected engine, and otherwise from the engine's base preset: `fm` the e-piano, `modal` the bell, `percussion` the GM drum kit, and so on. Every engine except `sample` sounds from a bare mode; `sample` has nothing to voice until a `SampleBank` is bound and stays silent without one. Raw engine levels are not matched, and named presets carry their own `gain` while an API patch uses only the `gain` you provide, so set an explicit gain and audition the result when comparing bare modes or building your own patch.
:::

### `subtractive` — virtual-analog

The classic oscillator → filter → amp voice. Detuned unison, drift, a pre-filter drive stage, and a choice of four filter models give it everything from fat saw leads to wide pads. Good for **leads, basses, pads, and plucks** — anything you'd reach for an analog synth to do. Presets: `sine`, `saw`, `square`, `triangle`, `saw-lead`, `square-lead`, `sub-bass`, `warm-pad`.

<SonareDemo id="synth-note" />

The filter model is the heart of the "character". Four classic models are available via `filterModel`:

| Model | Circuit topology | Notes |
|-------|------------------|-------|
| `svf` | TPT state-variable | Clean, the only model with a selectable `filterOutput` (lowpass / bandpass / highpass) |
| `moog-ladder` | Four-pole transistor ladder | Zero-delay-feedback, saturating loop, self-oscillates |
| `diode-ladder` | Diode ladder | Coupled-stage ZDF, self-oscillates |
| `sallen-key` | Sallen-Key | Self-oscillates |

All four stay stable and zipper-free under per-sample cutoff/resonance modulation, and self-oscillation is deterministic.

<SonareDemo id="synth-filter" />

### `fm` — frequency modulation

A phase-modulation operator stack (one oscillator's output is added to another's phase → metallic/bell tones) with a small algorithm table, exponential operator envelopes, a feedback operator, and velocity-to-index (brightness) scaling. Good for **electric pianos, bells, mallets, clavi-style keys, and brass** — the metallic, bell-like, and inharmonic sounds subtractive struggles with. A bare `engineMode: 'fm'` uses the `e-piano` engine section; select the named preset to use its complete wrapper settings too.

### `karplus-strong` — plucked string

A fractional-delay waveguide loop (a short delay loop that models a plucked string) with phase-exact tuning, plus pick-position comb, velocity-driven brightness, decay stretching, and note-off loop damping (finger/palm mute). Guitar, harp, and bass presets add physical details: pickup position, body coupling, steel-string dispersion, sympathetic open strings, tension bend, and dual-polarization decay. Good for **plucked and strummed strings** — guitar, bass, harp, and the plucked ethnic family. (The harpsichord is not a bright guitar and has its own engine; see below.) Presets: `classical-guitar`, `steel-guitar`, `electric-guitar`, `harp`, `bass-acoustic`, `bass-fingered`, `bass-picked`, `bass-fretless`, `bass-slap`.

### `modal` — mallet percussion

A modal resonator bank (a bank of tuned resonators modeling a struck bar or bell) tuned to physical mode ratios (uniform-bar glockenspiel, deep-arch marimba/vibraphone), with mallet-hardness velocity weighting and per-mode decay. Good for **tuned mallet instruments** — glockenspiel, vibraphone, marimba, xylophone. A bare `engineMode: 'modal'` uses the `bell` engine section. Named presets include `marimba`, `glass`, and `bell`.

### `additive` — drawbar organ

The nine drawbar pitches of a tonewheel organ (summing harmonic sine partials, one drawbar per partial) with stepped stop levels, free-running partial phases, and a key-click contact transient. Good for **organs** — sustained, harmonic-rich registrations. Preset: `organ`.

### `percussion` — membrane percussion

Rayleigh circular-membrane modes with a descending strike-pitch envelope under filtered noise. This engine backs the **GM drum kit** — kick, snare shell + wires, toms, hats, and cymbals with inharmonic ring modes, one-shot and deterministic. A bare `engineMode: 'percussion'` uses the `drum-kit` engine section; the named `drum-kit` preset also supplies its wrapper settings.

### `piano` — extended-waveguide acoustic piano

A data-free grand-piano sketch with the four piano-defining elements: stiff-string dispersion (partials stretch sharp up the keyboard), a nonlinear felt hammer (hard strikes are shorter and brighter), 2-3 coupled micro-detuned unison strings, and a soundboard resonator bank. The voicing is register-scaled, so bass notes, middle-register chords, and treble notes do not share one over-simple brightness curve.

Three structural details shape what you hear beyond that outline:

- **Longitudinal string modes** are modeled and summed into the output. A struck string vibrates along its length as well as across it, and those modes — driven by the tension the transverse motion itself creates — are what fills the bass attack between roughly 200 Hz and 3 kHz. Without them a low note is felt more than heard.
- **Inharmonicity follows a U-shaped curve**, not a monotonic climb. It grows toward the treble as stiffness would suggest, but below the bass break the wound strings turn it back upward, so the very bottom of the keyboard is more inharmonic than the notes just above it.
- **Stretch tuning is an asymmetric Railsback curve** — two power-law branches meeting at the A4 anchor, about ten cents flat at the bottom against fifty sharp at the top, which is why one odd function about the middle cannot express it. The curve is held at the fitted keyboard bounds rather than extrapolated past them.

The voice also carries **an explicit output level**, so you can set its place in a mix directly instead of inferring it from the string, hammer, and soundboard contributions.

It is a built-in model, not a sampled-piano replacement. Good for **acoustic piano**. Preset: `acoustic-piano`. GM programs 0-3 use it, as do the five piano-derived [GS variations](./gm-gs.md#gs-variation-tones).

### `pipe-organ` — sustained flue pipe

A waveguide flue-pipe model with shared wind behavior, multi-rank registration, reed-pipe color, and mouth/radiation correction. Good for **church organ color previews** from principals and bourdon stops to flute and trumpet ranks. Presets: `church-organ`, `church-flute`, `church-bourdon`, `church-trumpet`.

### `bowed-string` — friction-excited string

A sustained bowed-string waveguide with bow speed/force/position control, sympathetic resonance, second-polarization beating, and a violin-family body resonator. Good for **violin-family previews**. Presets: `violin`, `viola`, `cello`, `contrabass`.

### `reed` — woodwind reed

A reed-bore waveguide with cylindrical and conical variants, tonehole/growth-cone behavior, register-scaled voicing, and live breath/brightness control. Good for **single- and double-reed woodwind previews** and saxophones. Presets: `clarinet`, `soprano-sax`, `alto-sax`, `tenor-sax`, `baritone-sax`, `oboe`, `english-horn`, `bassoon`.

### `brass` — lip-reed brass

A brass waveguide with lip tension, brass-bell body resonance, conical/cylindrical voicing, register scaling, and a bright cuivré edge for loud playing. Good for **brass fallback and preview**. Presets: `brass`, `trumpet`, `trombone`, `tuba`, `french-horn`, `muted-trumpet`, `cornet`, `flugelhorn`, `euphonium`.

### `flute` — air-jet flute

A breath-driven air-jet / open-pipe model with jet/reflection brightness, chiff/noise, overblow behavior, and vibrato control. Good for **flutes, whistles, and ocarina-like edge-tone instruments**. Presets: `concert-flute`, `piccolo`, `recorder`, `pan-flute`, `shakuhachi`, `tin-whistle`, `ocarina`, `blown-bottle`.

### `plucked-string` — buzzing-bridge plucked string

A plucked-string waveguide whose bridge model keeps grazing the string, spraying energy back into the upper partials so the note shimmers and buzzes for its whole ring. The `buzz` control sweeps from a clean harp or koto (no buzz) to the bright, sustaining rattle of a sitar's curved jawari bridge or a shamisen's sawari. Distinct from `karplus-strong`, which models a clean-terminated pluck (the named `harp` preset stays there, while `pluck`, despite its name, runs on this engine). Good for **the koto / sitar buzzing-bridge plucked family**. Presets: `pluck`, `harp-plucked`, `koto`, `sitar`, `tanpura`.

### `vocal` — source-filter voice

A two-stage source-filter voice: a glottal source shaped with spectral tilt and aspiration noise feeds five resonant formants tuned to a sung vowel. The `vowel` field selects the formant table (/a/, /e/, /i/, /o/, /u/), `brightness` tilts the source and opens the upper formants, and a per-voice vibrato modulates the pitch. Good for **choir and solo-voice previews**. Presets: `choir-aah`, `choir-ooh`, `voice-eeh`.

### `free-reed` — driven free reed

A driven metal-tongue oscillator (a phase accumulator shaped by an asymmetric saturator and a body lowpass) that models the free reed of an accordion, harmonica, or bandoneon — the tongue's own pitch sets the note, with no coupled air column. A `detune` control adds a second tongue a few cents sharp of the first, and the beat between the pair is the shimmering musette sound; `detune` 0 collapses back to a single tongue. Good for **accordion, harmonica, and reed-organ previews**. Presets: `accordion`, `harmonica`, `bandoneon`, `reed-organ`.

### `harpsichord` — jack and plectrum

A quill-plucked string model built around the mechanism rather than around a tone control. Three consequences of that mechanism are what a plucked-string engine with knobs cannot reproduce. **Key speed barely changes loudness** — a few decibels across the instrument, and not even monotonically, since past a certain speed the plectrum slips off sooner and the note gets *quieter*; the engine opts out of the velocity curve entirely. **Registration is separate string choirs**, not one string with a mix: two 8′ unisons and a 4′ octave are three independent delay lines at three periods. And the **inharmonic shimmer comes from the short undamped segment behind the bridge**, not from string stiffness, so the speaking partials stay harmonic to within a couple of cents. Good for **harpsichord**. Preset: `harpsichord`.

### `sample` — host-supplied PCM

The one engine that synthesizes nothing. You build a `SampleBank` of mono float frames with note-number and velocity ranges, bind it alongside the patch, and the engine resolves a range at note-on and steps it. It sits in the *oscillator's* place in the subtractive chain, so your own audio arrives behind the same resonant multi-mode filter, envelopes, LFOs, and mod matrix as a synthesized tone — which is what separates it from the [SoundFont player](./soundfont-player.md), a separate instrument that parses a container and brings its own generator model. Good for **your own recordings and one-shot drum material**. **Bank-only.** It has no preset, and a bare `engineMode: 'sample'` with no `SampleBank` bound renders silence. See [Host PCM: the `sample` engine](#host-pcm-the-sample-engine) for the patch fields.

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
//   unison: 7, detuneCents: 18, cutoffHz: 1800, ampAttackMs: 620, ... }
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
#            unison=7, detune_cents=18.0, cutoff_hz=1800.0, ...)
```

:::

The catalog maps to the engines like this (one preset per row is enough to feel each engine):

| Preset | Engine | Good for | Play it |
|--------|--------|----------|---------|
| `sine` `saw` `square` `triangle` `saw-lead` `square-lead` `sub-bass` `warm-pad` | `subtractive` | leads, basses, pads | [saw-lead](/synth?preset=saw-lead) |
| `e-piano` | `fm` | electric piano, bells, brass | [e-piano](/synth?preset=e-piano) |
| `classical-guitar` `steel-guitar` `electric-guitar` `harp` `bass-acoustic` `bass-fingered` `bass-picked` `bass-fretless` `bass-slap` | `karplus-strong` | plucked strings and basses | [classical-guitar](/synth?preset=classical-guitar) |
| `marimba` `glass` `bell` | `modal` | tuned mallets | [marimba](/synth?preset=marimba) |
| `organ` | `additive` | drawbar organ | [organ](/synth?preset=organ) |
| `drum-kit` | `percussion` | GM drum map | [drum-kit](/synth?preset=drum-kit) |
| `acoustic-piano` | `piano` | acoustic piano | [acoustic-piano](/synth?preset=acoustic-piano) |
| `church-organ` `church-flute` `church-bourdon` `church-trumpet` | `pipe-organ` | pipe organ ranks | [church-organ](/synth?preset=church-organ) |
| `violin` `viola` `cello` `contrabass` | `bowed-string` | bowed strings | [cello](/synth?preset=cello) |
| `clarinet` `soprano-sax` `alto-sax` `tenor-sax` `baritone-sax` `oboe` `english-horn` `bassoon` | `reed` | reed woodwinds | [clarinet](/synth?preset=clarinet) |
| `brass` `trumpet` `trombone` `tuba` `french-horn` `muted-trumpet` `cornet` `flugelhorn` `euphonium` | `brass` | brass instruments | [trumpet](/synth?preset=trumpet) |
| `concert-flute` `piccolo` `recorder` `pan-flute` `shakuhachi` `tin-whistle` `ocarina` `blown-bottle` | `flute` | air-jet flutes and whistles | [concert-flute](/synth?preset=concert-flute) |
| `pluck` `harp-plucked` `koto` `sitar` `tanpura` | `plucked-string` | buzzing-bridge plucked strings | [koto](/synth?preset=koto) |
| `choir-aah` `choir-ooh` `voice-eeh` | `vocal` | choir and solo voices | [choir-aah](/synth?preset=choir-aah) |
| `accordion` `harmonica` `bandoneon` `reed-organ` | `free-reed` | accordion, harmonica, reed organ | [accordion](/synth?preset=accordion) |
| `harpsichord` | `harpsichord` | harpsichord | [harpsichord](/synth?preset=harpsichord) |

The roll below sequences one three-voice phrase and bounces it through `bounceWithSynthInstrument(presetName, …)`. The instrument selector walks across representative piano, FM, plucked-string, modal, organ, bowed-string, reed, brass, and flute presets, so the same notes audibly take on each engine's character.

<SonareDemo id="midi-piano-roll" />

### The `va:` routing prefix

A preset name may carry a `va:` prefix (for example `va:saw-lead`, `va:e-piano`). The prefix is **accepted everywhere a preset name is** — `synthPresetPatch`, `bounceWithSynthInstrument`, and `setSynthInstrument` — and resolves to the same patch as the bare name. It is a routing convention some hosts use to mark "this destination plays the virtual-analog NativeSynth"; the synth strips it before lookup.

## The `SynthPatch` object

Think of a `SynthPatch` as "a preset, plus your tweaks". It starts from a **base** — the named `preset` (omit it for the default subtractive init patch) — and every field you set overrides that base. Leave a field out and the base value stays.

The most useful beginner workflow is small and reversible: choose a preset, change one or two audible fields, listen, then reset or move on. For example, start from `warm-pad`, lengthen `ampAttackMs` for a slower fade-in, lower `cutoffHz` for a darker tone, or raise `stereoSpread` for a wider pad. You do not need to fill the whole object.

::: warning Absent and zero are different
What decides whether a field overrides the base is **presence**, not value. Omit a numeric field and the base value stays; set one and it overrides the base, clamped to its audible range. That includes an explicit `0` — writing `ampSustain: 0` really does drop the sustain to zero, and `stereoSpread: 0` really does collapse the patch to the center. Enum fields still use `'default'` to mean "keep".

The patch carries a per-field "was this set?" record alongside a struct version, which is what keeps "absent" and "zero" apart. A zero is therefore never treated as "untouched", and no token value such as `ampSustain: 0.001` is needed to approximate it — write the `0` you mean.

One more rule: a non-empty `modRoutings` array **replaces** the base mod matrix entirely, rather than adding to it. An empty array clears it, while omitting the key keeps the base matrix.
:::

The patch exposes the shared controls every engine uses:

<SonareDemo id="synth-adsr" />

::: info Cents, velocity, and key tracking
- **Cent** — 1/100 of a semitone; 100 cents = one piano key, 1200 = an octave. Pitch and detune amounts are in cents.
- **Velocity** — how hard a note was struck (0–127); presets use it to control brightness or loudness.
- **Key tracking** — making a parameter (like filter cutoff) follow the note's pitch up the keyboard.
:::

Ranges are what `synthPatchParamInfo()` reports; a value outside one is clamped, and the same call returns each field's init value.

| Group | Fields |
|-------|--------|
| Oscillator | `unison` (1-7) and `detuneCents` (0-200), both subtractive only; `driftCents` (0-100), `driftRateHz` (0.01-20), `drive` (0-1), `pitchOffsetCents` (-4800 to 4800) |
| Filter | `cutoffHz` (10-22000), `resonanceQ` (0.5-30), `keyTrack` (0-1), `envToCutoffCents` and `velToCutoffCents` (-9600 to 9600), `hpCutoffHz` (0-22000, 0 is off) |
| Output stage | `sampleHoldHz` (0-192000, 0 is off), `bitDepth` (0-24, 0 is off) |
| Amp and filter envelopes | `ampDelayMs` / `ampHoldMs` and the `filter*` pair (0-5000); attack, decay and release times (up to 20000 ms); `ampSustain` / `filterSustain` (0-1); `oneShot` (amp only, boolean) |
| LFOs and glide | `lfoRateHz`, `lfo2RateHz` (0-40), `lfoToPitchCents` (0-1200), `glideMs` (0-5000) |
| Body | `body` (`none` / `guitar` / `violin` / `wood-tube` / `brass-bell` / `vocal`), `bodyMix` (0-1) |
| Stereo and output | `stereoSpread` (0-1), `gain` (linear), `polyphony` (1-64), `busDrive` (0-1) |
| Enums | `engineMode`, `waveform` (subtractive only), `filterModel`, `filterOutput` (SVF only): names from `synthEnumTables()`, or `'default'` to keep the base |
| Voice start state | `retrigger` (`'default'` / `'free'` / `'note'`) |
| Engine section | `engineParams` (a key-to-number record) |
| Mod matrix | `modRoutings` (up to 8) |
| Sample engine | `sampleBank`, `sampleSet`, `sampleLevel` (0-8), `sampleLoop`, `sampleStartOffset` (0-0.999), `sampleKeyTrack`; see [the `sample` engine](#host-pcm-the-sample-engine) |
| Binding | `destinationId` (JS only, default `0`); `useGmPrograms` (Python `use_gm_programs`) follows incoming GM bank and program changes, see [GM and GS Fallback Bank](./gm-gs.md#following-gm-programs-instead-of-pinning-one-patch) |

(*Polyphony* is how many notes can sound at once; a *voice* is one sounding note, and *voice stealing* cuts the oldest note when you run out.)

The delay stage holds an envelope at zero before its attack starts and the hold stage keeps it at the peak before the decay; both are in milliseconds ([Delay and hold: DAHDSR](./glossary/instruments/envelopes-modulation.md#delay-and-hold-dahdsr)). `driftRateHz` sets how fast the per-voice pitch drift wanders, and `driftCents` its depth ([Envelopes and Modulation](./glossary/instruments/envelopes-modulation.md#drift-every-voice-slightly-out-of-tune) shows what that sounds like). The four delay/hold times and the drift frequency are automatable on a live instrument; a delay or hold change applies the next time its stage starts.

`oneShot` ignores note-off. With zero amp sustain, the voice ends when its envelope decays to silence. With positive sustain, it needs an engine that ends naturally, such as a finite FM envelope, a percussion strike, or a non-looping sample. A sustained one-shot patch with no natural end has an unbounded tail, so [automatic-length bounces](./project-bounce.md#omitting-the-length) are refused; pass a positive `totalFrames` to render a bounded window.

`retrigger` chooses the seed used when each voice starts. `'default'` keeps the base patch's choice; every catalog preset uses `'free'`. `'free'` varies oscillator start phases, unison jitter, drift, and each engine's noise stream from the voice pool slot and running note count, so repeated notes generally differ. `'note'` derives those values from the MIDI note number alone, so playing the same note again after its tail ends renders the same samples. The setting applies to each voice's start state. It does not reset controllers, the bus DC blocker, a piano's shared soundboard, a plucked string's sympathetic halo, an organ's wind chest, or effect tails. The `drum-kit` preset keeps its own mode for each drum piece.

::: info LFO 2 needs a routing
The two LFOs behave differently. LFO 1 (`lfoRateHz` + `lfoToPitchCents`) is hardwired to pitch and produces vibrato on its own. LFO 2 is matrix-only: setting `lfo2RateHz` does nothing until a `modRoutings` entry uses `source: 'lfo2'` to send it to a destination.
:::

Each **mod routing** is `{ source, destination, depth }`. The matrix routes twelve sources — the two envelopes, both LFOs, velocity, key tracking, the mod wheel, a seeded per-voice random source, breath, aftertouch, expression, and pitch bend — to twelve destinations: pitch, vibrato depth, cutoff, resonance, filter-envelope depth, amplitude, pan, the LFO 1 rate, and the four excitation axes of the physical engines. `depth` is in destination units at full source deflection.

<SonareDemo id="synth-tremolo" />

The `body` field is NativeSynth's body/formant resonance layer — the resonant character of an instrument's physical shell or vocal tract. Acoustic guitars, harps, violin-family strings, woodwinds, brass, and choir/voice fallbacks use this layer; solid-body electrics can leave `body` at `none`.

`body: 'vocal'` is the vowel formant bank, and it is reachable on **any** patch rather than only on the `vocal` engine — a subtractive oscillator driven through it is a sung tone rather than a filtered saw. That is exactly how the GM fallback bank voices Lead 6 (voice) and Pad 4 (choir), which is why those two do not sound like the synth leads and pads around them.

::: info Pitch bend, controller reset, and expression state
NativeSynth responds to **pitch-bend** messages, and the bend range follows **RPN 0** (the standard pitch-bend-range parameter, set with the **CC6 / CC38** Data Entry MSB/LSB fine-byte pair — default ±2 semitones). A MIDI **Reset All Controllers** message returns the performance controllers (mod wheel, expression, pitch-bend value, the pedals) and the RPN/NRPN selection to their defaults, but it deliberately leaves the bend range where you set it — send RPN 0 again if you want ±2 semitones back. **CC 120 All Sound Off** kills sounding notes and **CC 123 All Notes Off** releases keys, but neither resets sustain (**CC64**) or sostenuto (**CC66**) state; pedal-held notes can therefore remain held after CC 123. **CC 121 Reset All Controllers** resets both pedal states. You drive these with ordinary MIDI events: pitch-bend events (e.g. `Project.midiPitchBend(...)` offline) and the RPN 0 / data-entry / reset CCs in your stream.

NativeSynth keeps ordinary controller state per channel and note-addressed expression per active voice. MIDI 2.0 note velocity, controller, pressure, and pitch-bend inputs retain their full resolution; NativeSynth handles channel pressure, polyphonic key pressure, and per-note pitch bend. Configure an MPE zone for member-channel expression, or send MIDI 2.0 per-note messages directly. RPN 0 sets the bend range, while generic high-resolution parameter mappings remain in the engine's `bindMidiCcBinding(...)` layer.

Piano-style pedal controls are decoded as ordinary MIDI CCs. Sustain pedal **CC64** supports half-pedal damping only on the `piano` engine — there, intermediate values 64-126 damp ringing key-up notes proportionally; on every other engine CC64 is a plain on/off sustain switching at the 64 threshold, so 64 and 126 sound the same as 127. **CC66** acts as sostenuto, and **CC67** applies una-corda / soft-pedal voicing where the active preset uses it.
:::

### Engine parameters

`engineParams` sets fields of the selected engine's own model section by key: bow force, breath pressure, lip tension, strike position, FM operator levels, mode ratios. Keys are the section's field names in lowerCamelCase (`bowForce`, `ops0.level`, `ranks2.level`), and absent keys keep the base section's value.

::: code-group

```typescript [Browser / Node]
const audio = project.bounceWithSynthInstrument(
  { engineMode: 'bowed-string', engineParams: { bowForce: 0.9, bowPosition: 0.08 } },
  { totalFrames: 48000, numChannels: 2 },
);
```

```python [Python]
audio = project.bounce_with_synth_instrument(
    sonare.SynthPatch(
        engine_mode="bowed-string",
        engine_params={"bowForce": 0.9, "bowPosition": 0.08},
    ),
    total_frames=48000,
    num_channels=2,
)
```

:::

Unlike the wrapper fields, nothing here is clamped. An unknown key, a key of another engine's section, a non-finite value, a fractional value for a whole-number field or a value outside the field's range is refused with an error that names the key (`engine param 'bowForce': out of range [0, 1]`). In Python the field is `engine_params`, and the keys stay lowerCamelCase. The command-line `--synth` option takes a preset name only, so patches and `engineParams` are available in the bindings, not the CLI.

`synthEngineParamInfo(engineMode)` lists the keys an engine accepts, and `synthPatchParamInfo()` lists every numeric wrapper field. Both return `SynthParamInfo[]` in the shape of the [insert parameter descriptor](./effects-inserts.md#the-parameter-descriptor): `name`, `type` (`'number'` or `'boolean'`, a switch given as 0 or 1), `integer`, `min`, `max`, `default`, `unit` and, for a gated field, `activeWhen`. For an engine field `default` is the base preset's value; for a wrapper field it is the init patch's. `default` is a `number`, or a `boolean` for a switch (the percussion `gmKit` is `true`), so narrow it before doing arithmetic. `synthEngineParamInfo` returns `[]` for `default`, `subtractive` and `sample`. Python spells them `synth_engine_param_info` and `synth_patch_param_info`.

```typescript
synthEngineParamInfo('fm').slice(0, 2);
// [{ name: 'algorithm', type: 'number', integer: true, min: 0, max: 5, default: 3, unit: 'none' },
//  { name: 'ops0.ratio', type: 'number', min: 0, max: 64, default: 1, unit: 'ratio' }]
```

In Python the result is a list of dicts with the same keys; a gate stays under the camelCase key `activeWhen`.

The FM operator algorithm is the `algorithm` key of the `fm` section. Build a control panel from these descriptors rather than copying the ranges.

#### Gated fields: `activeWhen`

A field can be accepted yet have no effect, because another field switches its section off. `activeWhen` states when the field reaches the voice, as a list of alternatives: each alternative is a list of conditions that must all hold, and the field is live when at least one alternative holds. A condition is `{ key, scope, relation, value }`: `key` is read from the same `synthEngineParamInfo` table when `scope` is `'engine'`, or from the `SynthPatch` when it is `'patch'`; `relation` is one of `'eq'`, `'ne'`, `'gt'`, `'ge'`, `'lt'`, `'le'`. A field with no `activeWhen` is not gated. If you set a field and hear nothing change, read its `activeWhen`: in the `percussion` section 92 of the 93 fields are gated, so `noiseBurstCount` does nothing while `gmKit` is on.

```typescript
synthEngineParamInfo('percussion').find((p) => p.name === 'noiseBurstCount')?.activeWhen;
// [[{ key: 'gmKit',     scope: 'engine', relation: 'eq', value: false },
//   { key: 'noiseGain', scope: 'engine', relation: 'gt', value: 0 }]]
```

In the `percussion` section every field except `gmKit` needs `gmKit` off, because the GM kit chooses its own pieces; the layer fields add their own gate (`noiseBurstCount` needs `noiseGain > 0`, `shellNumModes` needs `shellMix > 0`). A field that reaches the voice through several layers carries one alternative per route: `baseFreqHz` is live when any sounding mode or shell layer uses it, so its list has one alternative for each. In `pipe-organ`, the single-pipe fields (`stopped`, `brightness`, `reed`) act only while `rankCount` is `0`, and the `ranks0.*` fields only while `rankCount` is above `0`. The reed, brass, free-reed, harpsichord, bowed-string and additive sections gate their fields the same way.

To build a panel, evaluate each gate against the current values and disable or hide the control when no alternative holds; the value is still stored and still validated, it just does not change the sound. Compare numbers with the relation, and a boolean switch or a wrapper enum name (`body: 'violin'`) with `eq` / `ne`. A field that depends on performance (velocity, a controller, overlapping notes) or only saturates past some value carries no `activeWhen`, so its absence does not promise that the field is always audible.

How an engine parameter differs from a patch field (refused versus clamped, and where each lives) is explained in [Synthesis Basics](./glossary/instruments/synthesis-basics.md#patch-fields-and-engine-parameters).

The [Synth Playground](/synth) builds its model controls this way: it shows only the fields whose gate holds, so the `percussion` engine with `gmKit` on shows `gmKit` alone, and with the kit off it shows the modal fields that apply.

### Enum name tables

Every enum field accepts either a name string or its C ordinal. Read the authoritative tables from the runtime with `synthEnumTables()` so names and ordinals never drift:

```typescript
import { init, synthEnumTables } from '@libraz/libsonare';

await init();
synthEnumTables();
// {
//   engineModes:      ['default', 'subtractive', 'fm', ..., 'harpsichord', 'sample'],
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
//   // ...plus controllerInputs, controllerAxes, articulations,
//   //    mpeDimensions and noteTrackings
// }
```

Python spells the call `synth_enum_tables()` and returns the same tables under snake_case keys.

The same arrays are also exported as named constants (`SYNTH_ENGINE_MODES`, `SYNTH_OSC_WAVEFORMS`, `SYNTH_FILTER_MODELS`, `SYNTH_FILTER_OUTPUTS`, `SYNTH_BODY_TYPES`, `SYNTH_MOD_SOURCES`, `SYNTH_MOD_DESTINATIONS`, plus `BUILTIN_SYNTH_WAVEFORMS`). Note the index 0 in most tables is `'default'` (keep the base value); `modSources` / `modDestinations` use `'none'` instead.

Node and WASM expose this field as `SynthPatch.retrigger`, and Python uses the same `SynthPatch.retrigger` attribute. Its TypeScript union is `SynthRetrigger`, and `SYNTH_RETRIGGERS` is the exported name table `['default', 'free', 'note']`. This table is separate from the object returned by `synthEnumTables()`. The C API names the matching enum `SonareSynthRetrigger` and its values `SONARE_SYNTH_RETRIGGER_BASE`, `SONARE_SYNTH_RETRIGGER_FREE`, and `SONARE_SYNTH_RETRIGGER_NOTE`.

`builtinWaveforms` / `BUILTIN_SYNTH_WAVEFORMS` is a separate list: it belongs to the minimal built-in oscillator synth (`setBuiltinInstrument`), not to NativeSynth's `waveform` field. It has no `'default'` entry, accepts `'sawtooth'` as well as `'saw'`, and does **not** accept `'noise'`.

### Host PCM: the `sample` engine

The `sample` engine reads its audio from a `SampleBank` you build yourself. Three steps: add mono float frames, map note-number and velocity ranges onto them, then bind the bank alongside a patch whose `engineMode` is `'sample'`.

::: code-group

```typescript [Browser / Node]
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

```python [Python]
import libsonare as sonare

with sonare.SampleBank() as bank:                      # closes the native handle
    index = bank.add_sample(pcm, root_key=60, source_rate=44100.0)
    bank.add_zone(0, sample_index=index)               # the whole keyboard, in set 0
    audio = project.bounce_with_synth_instrument(
        sonare.SynthPatch(engine_mode="sample", sample_set=0, sample_bank=bank),
        total_frames=24000,
    )
```

:::

A **zone** is a note-number and velocity range pointing at one sample; every bound defaults on its own, so `{}` is the whole keyboard at every velocity and narrowing one axis leaves the other whole. Zones live in numbered **sets**, and a patch names the set it plays through `sampleSet`. Build the whole bank before the bounce that binds it starts — the sample pool is contiguous and moves as it grows, so adding to it while something sounds invalidates the voices reading it.

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

::: code-group

```typescript [Browser / Node]
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

```python [Python]
import libsonare as sonare

engine = sonare.RealtimeEngine(sample_rate=48000.0, max_block_size=128)
try:
    engine.set_synth_instrument("va:saw-lead", destination_id=7)
    engine.push_midi_note_on(7, 0, 0, 60, 100)     # destination, group, channel, note, velocity
    out = engine.process([[0.0] * 128, [0.0] * 128])
    # out[0] / out[1] are the rendered stereo block; non-silent.
    engine.midi_instrument_count()                 # 1
finally:
    engine.close()
```

:::

Calling `setSynthInstrument` again on a destination replaces the instrument while the transport rolls: the outgoing voice fades over 10 ms and the new instrument starts from default channel state, so resend any program or controller state you need ([Realtime Engine](./realtime-engine.md) covers rebind and clear). `tailSamples()` is a conservative upper bound, not the length of what has actually played: an unstruck `drum-kit` destination reports about 29.5 s, and a `useGmPrograms` destination about 42.7 s before its first note. An offline bounce that follows GM programs measures only the programs it plays ([Omitting the length](./project-bounce.md#omitting-the-length)).

In a real app you would drive `pushMidiNoteOn` / `pushMidiNoteOff` / `pushMidiCc` from a live keyboard (`pushMidiProgram` queues a program change with an optional bank in the same way; see below for which synths follow it), or enable the engine-owned MIDI input source and push events as they arrive — see [MIDI Input](./midi-input.md). `setSynthInstrument` resolves a preset name or `SynthPatch` exactly like `bounceWithSynthInstrument`, so a sound you dialed in offline plays identically live.

Receivers that select programs are the SoundFont player (under its RX PROGRAM CHANGE and RX BANK SELECT gates), a NativeSynth bound with `useGmPrograms: true` (Python `use_gm_programs`), which resolves each channel's voice from the bank and program, and a NativeSynth that plays the GM kit (the `drum-kit` preset, or a percussion patch with `gmKit` on), where the program picks the GS drum set on every channel. Every other receiver accepts the message and ignores it: the built-in synth, any other NativeSynth patch, a part with RX PROGRAM CHANGE off, and an MPE member channel.

## Limitations

**Deeper model fields are set per patch, not live.** `engineParams` fixes them when the patch is bound; live control during a note uses the excitation axes that each engine declares.

**A couple of self-oscillating models have a small residual intonation error.** The air-jet flute and flue pipe-organ lock slightly off the naive tuning and are corrected by a calibrated factor; a small, note-dependent residual remains.

**Only some engines carry a calibration status.** Subtractive, FM, and additive are signal-based, so the status above does not apply to them. Modal (mallets and bells), membrane percussion, and the jack-and-plectrum harpsichord are physical models and share the provisional status. The `sample` engine plays back what you give it and has no voicing of its own.

**Where the sounds come from.** The synthesis engines are original implementations of published synthesis and physical-modeling algorithm families, and the GM/GS behavior follows the openly documented General MIDI / GS addressing — no sampled or captured instrument audio is bundled, and the result is an independent re-creation rather than a copy of any specific device. For the standards and papers behind each engine, see [Algorithm References](./algorithm-references.md).

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
Each note triggers its mapped GM piece rather than playing the note as a pitch. An auto-length bounce (no `totalFrames`) ends when the struck pieces have rung out, not when the slowest piece in the kit would: a clip with a single kick runs about 0.69 s past the clip's end.
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
