---
title: Physical Models
description: How libsonare's physical-model voices work — the waveguide loop they share, the acoustic quantity each model is built around, with the identifiers, defaults and ranges the engine uses, and how far to trust them today.
---

# Physical Models

Most of the [built-in synthesizer](./native-synth.md)'s engines start from a waveform and shape it. The acoustic-style engines start from an instrument instead — a string under a hammer, a bore under a reed, a metal tongue swinging through a slot, or a glottal source through formants. They compute each note from a mechanism rather than from a recording. Each note is a small simulation running at the sample rate, and what you hear is whatever that simulation radiates.

This page is about that family: what the model is actually computing, which acoustic quantity each voice is built around, what tuning work is complete, and what still awaits adjustment.

<MaturityNote
  item="physical-model-maturity"
  :labels="{
    title: 'Current tuning status',
    body: 'The piano has been tuned. Every other physical model still awaits adjustment and calibration, including the harpsichord, modal and membrane models. Further tuning is planned for future patch releases.'
  }"
/>

::: tip Which method for which job
Whether a physical model is the right choice at all — against a SoundFont, against sampling, against subtractive synthesis — belongs to [Sound Sources](./sound-sources.md). This page assumes you have already landed on one. For the shared patch layer these voices sit inside, see [Built-in Synthesizer](./native-synth.md); for the terms, [Synthesis Basics](./glossary/instruments/synthesis-basics.md).
:::

## What a waveguide model is

A vibrating string or an air column carries waves that travel, reflect at each end and come back. A **waveguide** model is the shortest honest way to compute that: a delay line stands in for the travel, a filter stands in for the losses at the reflecting end, and the two are wired into a loop. Feed energy in, and the loop rings at a pitch set by nothing but its own length.

That is the whole trick, and it has two consequences worth knowing before you use one.

**It needs no recorded data.** Sampled grand pianos can be large because they store many recorded notes, velocity layers, and articulations. A model keeps a compact parameter set and computes notes and performance values within its modeled range. That is why these voices can be the floor under a MIDI file that arrives with no SoundFont at all.

**Each voice costs compute.** A sampler reads memory and advances a playback voice; a model solves its physics once per sample per voice, and each voice carries its own delay lines, loss filters and body resonators. Polyphony, not disk, is the budget you spend here. A dense arrangement of bowed strings is a heavier render than the same arrangement played from samples.

**And it is a model, not a recording.** It reproduces the mechanism, so it gets the behaviour a sample cannot: a hard blow is brighter *because* the felt compresses further, not because a second sample was recorded. What it does not get for free is the specific voice of a specific instrument, which requires adjustment and calibration.

## The loop and model-specific stages

<WaveguideLoopFigure
  title="A shared abstraction with model-specific stages"
  caption="Excitation, travel, loss, radiation. A delay line can represent propagation and a loss filter can represent decay, but each model may add its own topology, radiation, and control behavior. The bow, reed, lip, and jet therefore share an abstraction rather than one identical loop."
/>

For a waveguide-style model, read it left to right: the **exciter** injects energy into the **delay line**, the wave travels, and at the far end it turns around and comes back through the **loss filter** to meet the exciter again. The length of that round trip — the sample rate divided by the fundamental — sets the pitch in this abstraction, so these voices do not need a separate tuning oscillator. The **radiation** stage is a tap taken outside the loop, where the body or the bell turns the internal wave into something a microphone would hear.

Where a model exposes them, `brightness` and `damping` describe the spectral openness and energy loss of its propagation or radiation stages. Their exact response is model-specific. On a bowed or blown voice the exciter can replenish losses, so the note can sustain while those controls still change its color and decay.

The exciter is one important difference between instruments, but it is not the only one. A bow is stick-and-slip friction against the string. A reed is a valve that mouth pressure drives against the bore. A lip adds its own resonance, and a jet has its own transit behavior. The delay topology, losses, radiation, and body coupling also vary by engine.

The struck and plucked voices — `piano`, `plucked-string`, `karplus-strong`, `harpsichord` — use waveguide or delay-line structures with a brief exciter. After the hammer, pick, or quill transfers energy, the remaining state rings down. A control moved mid-note can therefore reach a sustained bowed voice while a struck voice may have no active exciter axis to receive it.

## The acoustic models

| Engine mode | What it models | The quantity it is built around | Identifier |
|---|---|---|---|
| `piano` | Felt hammer, coupled unison strings, soundboard | Where the hammer strikes | `piano.strike_position` |
| `pipe-organ` | Flue pipe drawing on a shared wind chest | Wind pressure at the mouth | `pipe_organ.breath` |
| `bowed-string` | Rosined bow gripping and slipping on a string | Contact point and bow force | `bowed_string.bow_position` |
| `reed` | Cane reed valving a cylindrical or conical bore | Blowing pressure and reed stiffness | `reed.breath_pressure` |
| `brass` | Lip valve on a flared bore | Blowing pressure and embouchure | `brass.lip_tension` |
| `flute` | Air jet across an edge, driving an open pipe | Jet transit time against the bore period | `flute.jet_ratio` |
| `plucked-string` | String grazing a curved bridge | Pluck point and bridge buzz | `plucked_string.pick_position` |
| `vocal` | Glottal source through five vowel formants | Which vowel | `vocal.vowel` |
| `free-reed` | Metal tongue swinging through a slot | Bellows pressure and tongue stiffness | `free_reed.breath_pressure` |
| `harpsichord` | Quill-plucked string choirs with a short rear segment | Pluck position and rear coupling | `harpsichord.pluck_8a` |

Most entries above use waveguides in the sense the figure describes. `vocal` is a source-filter model with no loop, and `free-reed` is a driven tongue with no coupled air column. `harpsichord` uses separate delay lines for its string choirs and a short segment behind the bridge. These voices belong together because they are solved from a mechanism rather than played from a recording.

The identifiers below are the engine's own field names. They are how each model is voiced, and they are what the named presets set — but a caller cannot address them one by one; see [Reaching them from code](#reaching-them-from-code) for what is actually settable.

### `piano` — hammer, unison strings, soundboard

| Field | Default | Range | What it is |
|---|---|---|---|
| `piano.strike_position` | `0.085` | `0 – 0.5` | Where the hammer meets the string, as a fraction of its length. It notches the partials that have a node there — on a grand, roughly the eighth. |
| `piano.hammer_exponent` | `2.5` | `1.5 – 4` | The felt's compression law, force against compression. It sets how much shorter and brighter a hard blow is than a soft one. |
| `piano.hammer_contact_ms` | `1.2` | `0.2 – 10` | How long the felt stays in contact at A4, mezzo-forte. The contact time's first spectral null is the ceiling on what the blow can excite. |
| `piano.strings` | `3` | `1 – 3` | Coupled unison strings per note. |
| `piano.detune_cents` | `1.6` | `0 – 50` | Micro-detune across the unison. The strings fall out of step, and the prompt sound gives way to the long aftersound. |
| `piano.dispersion` | `1.0` | `0 – 1` | Scale on the keyboard-graded stiffness stretch; `0` is a perfectly harmonic string. |

Three things this model does that a knob-driven plucked string cannot. **Inharmonicity follows a U-shaped curve** with its minimum around C2, rather than climbing monotonically toward the treble: the wound bass strings turn it back upward, so the very bottom of the keyboard is more inharmonic than the notes just above it. **Longitudinal string modes are modelled** — a struck string stretches along its length as well as across it, and the tension change radiates the inharmonic growl that fills a low note's attack. Without them the bass is felt more than heard. The current piano tuning also gives the voice an explicit output gain, so its level can be set when it is mixed with other fallback voices.

### `pipe-organ` — a flue pipe on a shared wind chest

| Field | Default | Range | What it is |
|---|---|---|---|
| `pipe_organ.breath` | `0.35` | `0 – 1` | Mouth pressure driving the jet. It colours the tone rather than setting the level — the pipe self-oscillates across the whole band, and loudness rides the amp envelope. |
| `pipe_organ.brightness` | `0.5` | `0 – 1` | How brightly the open end reflects the upper partials: principal at the top, stopped flute at the bottom. |
| `pipe_organ.stopped` | `false` | — | A covered pipe. Fundamental-dominant, octave pump muted, reflection darkened. |
| `pipe_organ.rank_count` | `0` | `0 – 8` | How many ranks sound together. `0` is a single implicit 8′ built from the two fields above. |
| `pipe_organ.wind_sag` | `0.0` | `0 – 1` | How far the shared wind pressure drops as more pipes draw on it, so a full chord sinks slightly and then recovers. |
| `pipe_organ.tremulant_rate_hz` | `0.0` | `0 – 12` | Undulation of the wind supply, heard as pitch and level together. `0` is off. |

The wind supply is shared across the ranks rather than per note, which is what makes `wind_sag` mean anything: it is a property of the chest, and it only shows up when several pipes pull on it at once.

### `bowed-string` — stick and slip

| Field | Default | Range | What it is |
|---|---|---|---|
| `bowed_string.bow_position` | `0.13` | `0.02 – 0.5` | Contact point as a fraction of the string length from the bridge. Small is *sul ponticello* — near the bridge, bright and edgy; larger is *sul tasto*, over the fingerboard and soft. `0.13` is the natural playing point. |
| `bowed_string.bow_force` | `0.5` | `0 – 1` | Downward pressure. It widens the sticking region of the friction curve: low is a light, whistly bow that barely captures the string, high is firm and slightly rough. |
| `bowed_string.bow_speed` | `0.5` | `0 – 1` | How fast the bow is drawn — the dynamic level. |
| `bowed_string.brightness` | `0.5` | `0 – 1` | Bridge reflection openness. |
| `bowed_string.damping` | `0.4` | `0 – 1` | Bridge loop loss. The bow replenishes it either way, so the note sustains. |
| `bowed_string.rosin` | `0.0` | `0 – 1` | Texture of the rosined hair, as a small deterministic velocity noise on the bow. |

Bow position and bow force are the pair a player actually controls, and they are not interchangeable: position decides *which* partials the string emphasises, force decides *how cleanly* it locks into the Helmholtz motion that makes a bowed note a bowed note. A violin-family body resonator sits on the radiation tap; it is a measured violin corpus, and `bowed_string.corpus_scale` can only place its lowest mode, because a cello is not a scaled violin.

### `reed` — a valve the breath opens

| Field | Default | Range | What it is |
|---|---|---|---|
| `reed.breath_pressure` | `0.6` | `0 – 1` | Steady mouth pressure — the dynamic level. The reed only speaks above a threshold, so very low values approach silence. |
| `reed.reed_stiffness` | `0.5` | `0 – 1` | Slope of the reed table: soft and dark through hard, bright and buzzy. |
| `reed.reed_opening` | `0.5` | `0 – 1` | How far the reed tip sits open at rest. Low pinches shut sooner and the tone turns nasal. |
| `reed.conical` | `false` | — | `false` is a cylinder closed at the reed — a clarinet, odd harmonics only. `true` is a cone, approximated as an open pipe with the full series: saxophone, oboe, bassoon. |
| `reed.brightness` | `0.5` | `0 – 1` | Bell reflection openness. |
| `reed.chiff` | `0.4` | `0 – 1` | The brief bright noise as the reed starts to speak, so the note articulates rather than swelling in. |

`conical` changes which resonant modes the bore supports, rather than applying a post-EQ curve. That changes the instrument's resonance and harmonic balance at its source.

### `brass` — the lip is the valve

| Field | Default | Range | What it is |
|---|---|---|---|
| `brass.breath_pressure` | `0.7` | `0 – 1` | Steady mouth pressure driving the lip valve. |
| `brass.lip_tension` | `0.5` | `0 – 1` | Embouchure: where the lip resonance sits relative to the bore. Tighter puts it a touch above, the outward-striking point that gives brass its edge; looser is a broader, more slotted centre. |
| `brass.lip_damping` | `0.5` | `0 – 1` | The lip resonator's pole radius. Low is a tight, buzzing lip; high is soft and rounded. |
| `brass.conical` | `false` | — | Cylindrical body (trumpet, trombone) against conical (horn, tuba, cornet, flugelhorn). Both radiate the full series; the flag colours the bell reflection. |
| `brass.brightness` | `0.5` | `0 – 1` | Bell reflection openness. |
| `brass.damping` | `0.4` | `0 – 1` | Bore loop loss. |

Unlike a reed, a brass lip has a resonance of its own, and the note is where the lip and the bore agree. That is why `lip_tension` is an intonation control as much as a timbre one, and why the same fingering can slot several notes.

### `flute` — a jet across an edge

| Field | Default | Range | What it is |
|---|---|---|---|
| `flute.jet_ratio` | `0.5` | `0.1 – 0.9` | The jet's convection time as a fraction of the bore period. Around `0.5` the jet drives the fundamental; smaller ratios drive the octave and above, so this is the physical seat of the register. |
| `flute.breath_pressure` | `0.55` | `0 – 1` | Mouth pressure — dynamic level and jet drive. |
| `flute.jet_reflection` | `0.5` | `0 – 1` | How strongly the bore's returning pressure deflects the jet at the flue. |
| `flute.end_reflection` | `0.5` | `0 – 1` | How strongly the open end sends the wave back down the pipe. |
| `flute.damping` | `0.35` | `0 – 1` | Bore loss. Low is a flute; high is an ocarina or a blown bottle, which will not overblow. |
| `flute.breath_noise` | `0.15` | `0 – 1` | Jet turbulence — a flute's signature texture. High for a shakuhachi, low for a tin whistle. |

The defining quantity for the flute is a *ratio of two times*: the jet's travel time across the mouth divided by the bore's round-trip time. That ratio helps determine which register the pipe supports.

### `plucked-string` — the bridge the string grazes

| Field | Default | Range | What it is |
|---|---|---|---|
| `plucked_string.pick_position` | `0.2` | `0 – 0.5` | Plucking point as a fraction of the period; the excitation comb notches the harmonics with a node there. `0` is no comb. |
| `plucked_string.buzz` | `0.0` | `0 – 1` | How hard the curved bridge limits and sprays the returning wave into the upper partials. `0` is a cleanly terminated harp or koto; higher is the shimmering rattle of a sitar's jawari or a shamisen's sawari. |
| `plucked_string.brightness` | `0.7` | `0 – 1` | Loop-lowpass openness — how slowly the upper harmonics decay relative to the fundamental. |
| `plucked_string.decay_s` | `4.0` | `0.05 – 60` | String t60 at A4. |
| `plucked_string.decay_stretch` | `0.5` | `0 – 1` | How much longer the low strings ring: t60 scales by two to the power of stretch times octaves below A4. |
| `plucked_string.release_damp_s` | `0.12` | `0.01 – 10` | Damped t60 applied at note-off — the finger or palm coming back. |

`buzz` is the whole reason this engine exists beside the plain plucked loop. A curved bridge does not terminate the string at a point; the string keeps grazing it, and each graze throws energy back up the series, so the note shimmers for its entire ring instead of decaying smoothly.

### `vocal` — a source and five formants

| Field | Default | Range | What it is |
|---|---|---|---|
| `vocal.vowel` | `0` | `0 – 4` | `/a/`, `/e/`, `/i/`, `/o/`, `/u/`. Selects the formant table. |
| `vocal.brightness` | `0.5` | `0 – 1` | Tilts the glottal source and opens the upper formants. |
| `vocal.breath_noise` | `0.1` | `0 – 1` | Aspiration mixed into the source — pressed at `0`, breathy above it. |
| `vocal.vibrato_rate_hz` | `5.5` | `0.1 – 12` | A singer's own vibrato, read at note-on. |
| `vocal.vibrato_depth` | `0.3` | `0 – 1` | Vibrato amount. `0` skips the LFO entirely. |

**This one is not a waveguide.** It is a source-filter model: a glottal source — a sawtooth shaped by a one-pole tilt, plus aspiration — feeding a bank of five resonant bandpasses tuned to a sung vowel. There is no loop, so nothing here reflects, and the signal path is strictly feed-forward. One consequence is worth knowing: the source oscillator is not band-limited, and what keeps its aliasing out of the output is the narrowness of the formant bandpasses rather than anything done at the oscillator.

### `free-reed` — a tongue through a slot

| Field | Default | Range | What it is |
|---|---|---|---|
| `free_reed.breath_pressure` | `0.7` | `0 – 1` | Bellows pressure — the dynamic level and the drive. |
| `free_reed.reed_stiffness` | `0.5` | `0 – 1` | Asymmetry of the tongue nonlinearity: softer is rounder, stiffer is buzzier. |
| `free_reed.detune` | `0.3` | `0 – 1` | Musette beating between the pair of tongues on a note. `0` collapses to a single tongue. |
| `free_reed.brightness` | `0.6` | `0 – 1` | How much high content the reed plate radiates: mellow reed organ at the bottom, buzzy harmonica at the top. |
| `free_reed.slot_duty` | `0.0` | `0 – 0.9` | The fraction of the period the tongue's first pass holds the slot open. It places the null the measured references carry near the seventh partial. `0` uses the simpler shaped-saw source. |
| `free_reed.radiation` | `1.0` | `0 – 1` | How much of a free monopole the plate is: `0` radiates the flow, `1` its derivative. A harmonium measures at `1`, a cupped harmonica at `0`. |

**This one is not a waveguide either.** A free reed's pitch comes from the tongue itself, not from a coupled air column, so there is no delay line and no round trip — which is exactly why an accordion plays the same pitch whatever the bellows are doing, while a flute jumps an octave when you blow harder.

## Two more plucked models

### `karplus-strong` — the plain plucked loop

| Field | Default | Range | What it is |
|---|---|---|---|
| `ks.pick_position` | `0.18` | `0 – 0.5` | Plucking point as a fraction of the period. |
| `ks.decay_s` | `3.0` | `0.05 – 60` | String t60 at A4. |
| `ks.decay_stretch` | `0.5` | `0 – 1` | How much longer the low strings ring. |
| `ks.mute_harmonic` | `0.0` | `0 – 16` | Hand mute, quoted as a multiple of the note's own fundamental rather than as a fixed frequency — a palm puts the break at the same harmonic whatever the pitch. About `2` is a dead thump, `6` a light palm, `0` open. |
| `ks.exc_brightness` | `0.85` | `0 – 1` | Excitation lowpass openness at full velocity. |
| `ks.release_damp_s` | `0.08` | `0.01 – 10` | Damped t60 at note-off. |

This is the cleanly terminated plucked string, and it is what a great many GM programs fall back to — the guitars, the basses and the harp. Compared with `plucked-string` the difference is the bridge: here it reflects and that is all, so the note decays smoothly rather than shimmering. Several richer behaviours live in this engine and default to off, including fret slap, a second polarization and bridge coupling between the two planes.

### `harpsichord` — a quill, and three string choirs

| Field | Default | Range | What it is |
|---|---|---|---|
| `harpsichord.pluck_8a` | `0.14` | `0 – 0.5` | Plucking point of the first 8′ choir, as a fraction of the string. |
| `harpsichord.pluck_8b` | `0.22` | `0 – 0.5` | The second 8′ choir, plucked at a different point — which is what makes the two registrations sound different rather than merely louder. |
| `harpsichord.pluck_4` | `0.11` | `0 – 0.5` | The 4′ octave choir. |
| `harpsichord.plectrum_edge` | `0.8` | `0 – 1` | Sharpness of the quill's release. |
| `harpsichord.velocity_range_db` | `5.0` | `0 – 24` | The whole dynamic range key speed buys. A real instrument gives three to six decibels, and not even monotonically — past a certain speed the plectrum slips off sooner and the note gets *quieter*. |
| `harpsichord.rear_coupling` | `0.35` | `0 – 1` | How much of the short undamped segment behind the bridge reaches the output. This is where the instrument's inharmonic shimmer comes from; the speaking partials stay harmonic to within a couple of cents. |

This model, like every physical model other than the piano, still awaits adjustment and calibration. Registration uses separate string choirs: two 8′ unisons and a 4′ octave are three independent delay lines at three periods, not one string with a mix control.

::: warning Trim the gain before you A/B it
Raw output levels are not matched across engines, so a harpsichord can sit substantially higher or lower than the voice beside it. Lower the patch `gain` before putting a harpsichord next to another engine, and audition the pair at a matched level.
:::

## Hear the contrast

The demo below plays one note through several engine modes. Listen to the **onset** above all — that is where the models and the waveform part company hardest. Subtractive starts loud and gets carved; the plucked loops start with a burst and immediately begin losing energy; the bowed string takes a few periods to grip before the tone locks in; the wind voices ramp their pressure and speak with a chiff. The cutoff control acts on the shared filter, so it has the same meaning across these voices. Raw levels are not matched between engines, so match `gain` before judging tone.

<SonareDemo id="physical-voice-audition" />

## Where the family ends

Two engines use physical ideas without being waveguides, and they are documented on [Built-in Synthesizer](./native-synth.md) rather than here. `modal` is a bank of tuned resonators struck at once — the right model for a bar or a bell, where the modes are known and none of them travels. `percussion` is a Rayleigh circular membrane with filtered noise and, for shakers and scrapers, a stochastic particle source; it is a modal model with a noise bed, not a loop. `additive` is additive synthesis: it sums drawbar partials rather than modelling a physical object.

The percussion engine does carry one pair of fields worth stating here, because a kit tuned against an older build will need retrimming:

| Field | Default | Range | What it is |
|---|---|---|---|
| `percussion.wire_threshold` | `0.1` | `0 – 1` | How far the head must swing before the snare wires make contact, **as a fraction of the swing a full-velocity strike reaches on that piece**. `0` is always in contact and `1` is never, so the whole interval means the same thing on every kit piece. Strike velocity enters the same comparison, which is the nonlinearity a strainer actually is: a soft hit can stay under the threshold for its whole length. |
| `percussion.wire_decay_ms` | `0.0` | `0 – 2000` | Damping of the wire bed in its own right, so the rattle can outlive the head that started it — which is why a snare's tail is broadband after its head tone has gone. At `0` the rattle is a plain gate, which is what every piece without a strainer uses. |

## Reaching them from code

**The deep fields above are not individually settable from any binding.** They exist in the engine's internal patch, and they are what the named presets are made of; the patch struct that crosses the C ABI, and therefore the `SynthPatch` a browser, Node or Python caller sees, deliberately carries only the wrapper sections around the engines — oscillator, filter, envelopes, LFOs, mod matrix, body, gain. `sonare_synth_preset_patch(name, out)` is the one patch entry point in the C ABI, and it fills that wrapper-only struct.

So there are three things you can actually do.

**Pick a preset, and get its physical voicing whole.** Every physical-model preset ships with its deep fields already set, and selecting it by name is how you reach them. Read the catalog from the runtime rather than hardcoding it.

::: code-group

```typescript [Browser / Node]
const names = synthPresetNames();
// 'violin', 'cello', 'clarinet', 'alto-sax', 'trumpet', 'french-horn',
// 'concert-flute', 'shakuhachi', 'koto', 'sitar', 'accordion', 'harmonica',
// 'choir-aah', 'acoustic-piano', 'church-organ', 'harpsichord', ...

const patch = synthPresetPatch('cello');
// The wrapper sections only — patch.engineMode is 'bowed-string', and the
// bow's own voicing travels inside the preset rather than as fields here.

const audio = project.bounceWithSynthInstrument(
  { preset: 'cello', cutoffHz: 3600, ampAttackMs: 40 },
  { totalFrames: 48000, numChannels: 2 },
);
```

```python [Python]
names = sonare.synth_preset_names()
patch = sonare.synth_preset_patch("clarinet")

audio = project.bounce_with_synth_instrument(
    {"preset": "clarinet", "cutoff_hz": 3600},
    total_frames=48000,
    num_channels=2,
)
```

:::

**Override the shared layer on top of it.** Anything in the wrapper — filter cutoff and resonance, both envelopes, the LFOs, glide, body mix, stereo spread, gain — applies over whichever engine the preset selected. The percussion engine is the exception: of these it honours only gain. The same fields are resolvable as continuous automation targets through `resolveInstrumentAutomationId`. What you cannot automate that way is structure: preset, engine mode, waveform, filter model, polyphony and the mod routings are refused rather than smoothed.

**Play the exciter live, through the excitation axes.** This is the one route that reaches the physics. Rather than exposing `bow_force` or `breath_pressure` by name, the engine defines four abstract axes — force, position, brightness and morph — that a controller gesture or a mod-matrix route can move mid-note, and each engine declares which of them it reads.

| Engine mode | Axes it reads |
|---|---|
| `bowed-string` | force, position |
| `pipe-organ`, `reed`, `brass`, `flute`, `free-reed` | force, brightness |
| `vocal` | brightness |
| `additive` | morph, at patch level rather than mid-note |
| `piano`, `plucked-string`, `karplus-strong`, `harpsichord`, `percussion`, `subtractive`, `fm`, `modal`, `sample` | none |

The struck and plucked voices declare no mid-note excitation axes: their exciters are one-shot, so a live excitation route has no target after the note starts.

Two ways to drive the axes. A **controller profile** maps a device gesture to an axis — the default `gm` profile sends CC2 (breath) to force and CC74 to brightness or position, whichever the engine reads — and you select or extend it with `setControllerProfile` and `bindController` on the realtime engine. A **mod-matrix routing** does the same thing from inside the patch: route the `breath`, `aftertouch`, `expressionCc` or `pitchBend` source to the `excitationForce`, `excitationPosition`, `excitationBrightness` or `spectrumMorph` destination, and it travels with the patch and needs no rebinding.

One more thing to know before you audition: **not every engine mode plays from a bare patch.** Four of the seventeen — `fm`, `modal`, `percussion` and `sample` — need content a default patch does not supply, and render silence until you reach them through a preset or, for `sample`, bind a bank. See [Built-in Synthesizer](./native-synth.md) for the details.

Related: [Built-in Synthesizer](./native-synth.md) · [Sound Sources](./sound-sources.md) · [GM and GS Fallback Bank](./gm-gs.md)
