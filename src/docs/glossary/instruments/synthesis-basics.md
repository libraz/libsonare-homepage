---
title: Synthesis Basics
description: What a synthesizer actually does — oscillators, waveforms, filters, and amplifiers — and the seventeen synthesis families NativeSynth offers, explained from scratch for newcomers.
---

# Synthesis Basics

A **synthesizer** is an instrument that *generates* sound from scratch instead of playing back a recording. There is no microphone and no audio file behind a synth note: the computer calculates the waveform sample by sample, in real time. That is the single idea that separates a synthesizer from a [sampled instrument](./soundfont.md), which plays back recorded audio.

This page explains the building blocks every synth shares, then introduces the seventeen synthesis *families* (engines) you can choose from. It is concepts only — no code.

::: info Why generate instead of record?
A generated note can be any pitch, any length, and any tone, with no storage cost and no "stretching a recording" artifacts. The trade-off is that the sound has to be *designed*: someone picks a waveform, shapes it, and decides how it evolves. That design is called a **patch**.
:::

## The three classic blocks

Most synth sounds, however complex, come from a chain of three stages. Signal flows left to right, and each stage hands off a more finished signal to the next: the oscillator's raw tone is shaped by the filter, then the filter's shaped tone is given a volume shape by the amplifier.

<FlowDiagram
  title="Subtractive signal chain"
  :nodes="[
    { id: 'osc', label: 'Oscillator', col: 0, row: 0, variant: 'accent' },
    { id: 'filter', label: 'Filter', col: 1, row: 0, variant: 'accent' },
    { id: 'amp', label: 'Amplifier', col: 2, row: 0, variant: 'accent' },
    { id: 'out', label: 'Output', col: 3, row: 0, variant: 'success' }
  ]"
  :edges="[
    { from: 'osc', to: 'filter', label: 'raw tone' },
    { from: 'filter', to: 'amp', label: 'tone shaping' },
    { from: 'amp', to: 'out', label: 'loudness' }
  ]"
/>

### 1. Oscillator — the raw tone

The **oscillator** produces a continuous, repeating wave at the pitch of the note. Its **waveform** decides the raw color of the sound, because each shape contains a different mix of [harmonics](../concepts/audio-basics.md) (the overtones stacked above the fundamental pitch):

| Waveform | Sounds like | Why |
|----------|-------------|-----|
| **Sine** | Pure, hollow, flute-ish | Only the fundamental, no overtones |
| **Sawtooth** | Bright, buzzy, full | All harmonics — the classic synth lead/bass tone |
| **Square** | Hollow, woody, "reedy" | Only odd harmonics |
| **Triangle** | Soft, mellow | Odd harmonics, but much weaker — close to a sine |
| **Noise** | A hiss, no pitch | All frequencies at once — used for percussion, wind, breath |

<SonareDemo id="waveform-harmonics" />

::: info Harmonics, partials and inharmonicity
Every frequency component of a tone is a **partial**. When the partials sit at exact whole-number multiples of the fundamental (f, 2f, 3f, ...), they are called **harmonics**, and the ear hears one clear pitch: every pitched waveform in the table above is built this way. Real strings, bars and bells are stiff, so their partials drift away from those multiples, usually sharp. That drift is **inharmonicity**. For a stiff string the n-th partial lands at fₙ = n · f₀ · √(1 + B·n²), where B is a small stiffness coefficient; on a piano B is around 0.0008 at A4, which already puts the 10th partial about 64 cents sharp of 10 × f₀. That stretch is part of what makes a piano sound like a piano, and the [built-in piano model](../../native-synth.md#piano-—-extended-waveguide-acoustic-piano) reproduces it.
:::

::: info Why a digital sawtooth needs care: aliasing
A sawtooth or square wave contains harmonics without end, but a digital signal can only hold frequencies below half its sample rate (the Nyquist frequency, 24 kHz at 48 kHz). A naively computed sawtooth does not stop there: the harmonics above Nyquist fold back down as **aliasing**, inharmonic tones that do not follow the note and are most audible on high notes. NativeSynth's subtractive oscillators are **band-limited** to avoid this: the saw and square smooth each jump with a short polynomial correction (PolyBLEP), and the triangle is the integral of that corrected square. The `sampleHoldHz` and `bitDepth` output-stage fields reintroduce aliasing on purpose, as a lo-fi effect.
:::

### 2. Filter — shaping the tone

A **filter** removes or boosts part of the frequency content. The most common is a **lowpass filter**, which keeps the low frequencies and rolls off the highs. Two controls matter:

- **Cutoff** — the frequency where the filter starts removing energy. Lower the cutoff and the sound gets darker and muffled; raise it and it brightens.
- **Resonance** — a boost right at the cutoff frequency. A little adds a vocal "wah" emphasis; a lot makes the filter ring and whistle.

Sweeping the cutoff over time is the single most recognizable synth gesture — see [Envelopes and Modulation](./envelopes-modulation.md) for how to create that movement.

<SonareDemo id="synth-filter" />

### 3. Amplifier — the loudness over time

The **amplifier** controls the volume of the note from the instant a key is pressed until it fully fades. A raw oscillator just drones forever; the amplifier, controlled by an envelope, gives the note a beginning, a body, and an end — a plucked attack, a slow swell, a long tail.

Drag the envelope below and listen to how attack, decay, sustain and release shape one held note.

<SonareDemo id="synth-adsr" />


## The seventeen synthesis families

The blocks above describe *subtractive* synthesis, but it is only one way to make sound. **NativeSynth**, libsonare's built-in instrument engine, offers seventeen engines, each suited to different instruments:

| Engine | How it makes sound | Good for |
|--------|--------------------|----------|
| **Subtractive / virtual-analog** | Oscillator → filter → amplifier (the classic chain above) | Leads, basses, pads |
| **FM** | One oscillator modulates another oscillator's *pitch* | Metallic tones, bells, electric pianos, clavi-style keys |
| **Karplus-Strong** | A short feedback delay loop models a vibrating string | Plucked strings, guitars, bass, harp |
| **Modal** | A bank of tuned resonators models a struck object | Marimba, glockenspiel, struck bars and bells |
| **Additive / drawbar** | Sums many harmonic sine partials, like organ drawbars | tonewheel organs, harmonic pads |
| **Membrane percussion** | Models the vibration modes of a drumhead | Drums, toms, percussion |
| **Extended-waveguide piano** | A physical model of struck piano strings | Acoustic piano |
| **Pipe organ** | Sustained flue-pipe waveguides with wind and rank behavior | Church organ stops |
| **Bowed string** | A friction-excited string waveguide | Violin, viola, cello, contrabass |
| **Reed woodwind** | A reed and bore waveguide | Clarinet, saxophones, oboe, bassoon |
| **Brass** | A lip-reed brass waveguide | Trumpet, trombone, tuba, horns |
| **Flute** | An air jet exciting an open-pipe waveguide | Flute, recorder, pan flute, whistles |
| **Buzzing-bridge plucked string** | A plucked string whose bridge can be made to graze it and spray energy into the upper partials; at buzz 0 the termination stays clean (harp, koto) | Sitar, koto, harp |
| **Source-filter vocal** | A glottal source (a buzzy sawtooth) shaped by a bank of vowel [formant](../editing/voice-formant.md) resonators (the resonant peaks that make one vowel sound different from another) | Choir and solo-voice vowels |
| **Free reed** | An air-flow-driven metal tongue vibrating in a slot; adding a second tongue a few cents sharp of it gives the shimmering musette beat | Accordion, harmonica, bandoneon |
| **Harpsichord** | A jack-and-plectrum mechanism plucking a registration of separate string choirs — two 8′ unisons and a 4′ octave are three independent strings, not one string with a mix knob | Harpsichord |
| **Sample** | Plays PCM audio *you* supply, mapped over the keyboard, through the same filter, envelopes, and mod matrix as every other engine | Your own recordings, one-shot drums |

::: tip FM in one sentence
In **FM (frequency modulation)** synthesis, instead of filtering a rich waveform, you take two simple sine oscillators and let one wobble the other's pitch very fast. The result is a complex, often metallic or bell-like tone that subtractive synthesis cannot easily make.
:::

### FM: operators, ratio, index and algorithm

FM has its own small vocabulary, and the `fm` engine's parameters use all of it.

- An **operator** is one sine oscillator with its own envelope and output level. NativeSynth's `fm` engine has up to four (`ops0` to `ops3`).
- A **carrier** is an operator you hear. A **modulator** is an operator you do not hear directly: its output pushes the carrier's phase back and forth, and that motion is what adds partials.
- The **ratio** is an operator's frequency as a multiple of the note. With carrier and modulator at a whole-number ratio (1 : 1, 1 : 2, 1 : 3) the added partials fall on harmonics and the tone sounds pitched; with a non-integer ratio, such as the 14 the e-piano preset uses for its tine, they fall between harmonics and the tone turns bell-like.
- The **modulation index** is how hard a modulator pushes, in radians of phase swing; on a modulator, the operator's `level` is that index. At 0 the carrier is a plain sine; as the index rises, energy spreads into more and higher partials and the tone brightens. Because each modulator follows its own envelope, the brightness can fall away over a note, which is the bright attack and mellow tail of an FM electric piano.
- The **algorithm** is the wiring: which operators modulate which, and which are carriers. The engine's `algorithm` field chooses one of six (`0` to `5`). An operator can also modulate itself through `feedback`, which pushes a sine toward a sawtooth.

Strictly, NativeSynth adds the modulator to the carrier's *phase* (phase modulation, PM) rather than to its frequency. For sine operators the two give the same family of spectra, which is why PM is commonly called FM; PM is the usual choice in implementations because the note's pitch stays put however the index moves.

<SonareDemo id="fm-index-ratio" />

Several of these — Karplus-Strong, modal, piano, pipe organ, bowed string, reed, brass, flute, buzzing-bridge plucked string, source-filter vocal, free reed, and harpsichord — are **physical modeling**: instead of stacking waveforms, they approximate the behavior of a vibrating object (a string, a metal bar, a pipe, a reed, the vocal tract, or an air jet). In the current NativeSynth only the piano model is calibrated against a recording; treat the others as data-free preview and fallback voices rather than finished instrument simulations.

The **sample** engine is the odd one out: it generates nothing. It takes PCM frames the host already has, resolves note-number and velocity ranges at note-on, and hands the result to the oscillator's place in the subtractive chain — so your own audio arrives behind the same resonant filter and mod matrix as a synthesized tone. It is not a SoundFont reader; nothing is parsed, and you describe the mapping yourself.

## Filter character

The character of the filter itself can be changed. NativeSynth provides four filter models, each with a different flavor of resonance and saturation:

- `svf` — a clean, flexible state-variable filter (the neutral default).
- `transistor-ladder` — a four-pole transistor ladder: warm and thick, and it self-oscillates at high resonance.
- `diode-ladder` — a ladder built from diodes instead: grittier, with a more aggressive bite.
- `sallen-key` — a two-pole Sallen-Key stage: smooth and musical, with a gentler slope.

## Patch fields and engine parameters

A NativeSynth sound is described by a **patch**, and a patch has two layers that are set differently.

The **patch fields** are the top-level controls: the envelopes, the filter, the LFOs, drift, glide, body resonance, stereo spread, gain, polyphony. Most of them mean the same thing on every engine, because every engine's output passes through them. A few belong to one engine only — `waveform`, `unison` and `detuneCents` are read by the subtractive engine, the `sample*` fields by the sample engine — and the others ignore them.

The **engine parameters** are the selected engine's own model: bow force and bow position on the bowed string, operator ratios and levels on FM, hammer and string data on the piano, the membrane's mode ratios on percussion. They exist only for the engine that owns them. They are set through one field, `engineParams`, a record keyed by the field name (`{ bowForce: 0.6 }`, `{ 'ops0.level': 0.8 }`).

The two layers fail differently, and that is the practical difference. A patch field out of range is clamped to its audible range and the patch still plays: `ampSustain: 5` renders as full sustain. An engine parameter is checked strictly. A value outside its range, a fractional value for a whole-number field, or a key that belongs to another engine is refused, and the error names the key: `engine param 'bowForce': out of range [0, 1]`, `engine param 'algorithm': not a field of the bowed_string engine`. A patch field is a broad control that should always produce sound. An engine parameter is a physical quantity, where a silently corrected value would give a model you did not ask for.

Both layers start from a **base** and change only what is given. An omitted patch field keeps the named preset's value; an omitted engine parameter keeps the engine section of that preset, or the engine's own base preset when the named preset uses a different engine. Selecting an `engineMode` blanks every other engine's section, so engine parameters only ever apply to the engine that is playing.

::: details How libsonare implements this
NativeSynth is configured with a `SynthPatch`. Its `engineMode` field selects one of the seventeen engines (`'subtractive'`, `'fm'`, `'karplus-strong'`, `'modal'`, `'additive'`, `'percussion'`, `'piano'`, `'pipe-organ'`, `'bowed-string'`, `'reed'`, `'brass'`, `'flute'`, `'plucked-string'`, `'vocal'`, `'free-reed'`, `'harpsichord'`, `'sample'`), `waveform` picks the oscillator shape (`'sine'`, `'saw'`, `'square'`, `'triangle'`, `'noise'`), and `filterModel` selects the filter character (`'svf'`, `'transistor-ladder'`, `'diode-ladder'`, `'sallen-key'`) together with `cutoffHz` and `resonanceQ`. Rather than build a patch by hand, you can list the ready-made catalog with `synthPresetNames()` and load one with `synthPresetPatch(name)`. The built-in presets are arranged over these same engines, so every preset is really one of the families above with its parameters filled in for you. The `'sample'` engine is the one that needs data from you: it reads its PCM from a `SampleBank` you build and bind, and a `'sample'` patch with no bank renders silence. Deep mode-specific data (FM operator stacks, modal mode tables, drawbar registrations, kit pieces, piano strings, pipe ranks, bowed-string friction, reed/brass bores, and flute jet geometry) is the engine section each named preset carries; `engineParams` overrides individual fields of it by key. `synthPatchParamInfo()` lists every numeric patch field with its range, unit and init-patch default, and `synthEngineParamInfo(engineMode)` lists an engine's parameters with the engine's base-preset values — 49 for `'fm'`, 17 for `'bowed-string'`, 14 for `'piano'`, 93 for `'percussion'`, and none for `'default'`, `'subtractive'` and `'sample'`, which have no section. `synthPresetPatch(name)` returns a preset's patch fields but not its engine section.
:::

Related: [Built-in Synthesizer (NativeSynth)](../../native-synth.md), [Envelopes and Modulation](./envelopes-modulation.md), [Audio Basics](../concepts/audio-basics.md), [SoundFont and Sampled Instruments](./soundfont.md)
