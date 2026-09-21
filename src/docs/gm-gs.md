---
title: GM and GS Fallback Bank
description: The NativeSynth GM fallback bank — GS variation tones, GM/GS drum-kit variants, following GM program changes, the GS architecture layer and its insertion effects, and SoundFont fallback routing.
---

# GM and GS Fallback Bank

This page covers the General MIDI and GS side of the [built-in synthesizer](./native-synth.md): the data-free GM fallback bank with its GS variation tones and drum-kit variants, how a bounce follows GM program changes, the Roland-GS architecture layer and insertion effects the [SoundFont player](./soundfont-player.md) implements, and when a note falls from a SoundFont to the bank. The per-program voicing table is on [GM Tone Map](./gm-tone-map.md).

## The GM fallback bank

The GM fallback is not just a last-resort sine bank. When a SoundFont is absent or incomplete, NativeSynth chooses the closest built-in synthesis voice for the requested GM program. Some of those voices are provisional physical models whose calibration is still underway. The goal is useful, data-free preview and missing-program coverage, not final sampled-instrument realism.

| GM area | Data-free fallback voice |
|---------|--------------------------|
| Programs 0-7, keyboard | Extended-waveguide grand piano, FM electric pianos/clavinet, and the jack-and-plectrum harpsichord with its three registrations |
| Programs 8-15, chromatic percussion | Modal celesta, glockenspiel, music box, vibraphone, marimba, xylophone, and tubular bells, plus a Karplus-Strong dulcimer |
| Programs 16-23, organ | Additive drawbar organs (16-18), the physical church-organ flue pipe (19), and free-reed-engine reed-organ/accordion, harmonica, and bandoneon voices (20-23) |
| Programs 24-37, guitar and bass | Karplus-Strong nylon, steel, electric, muted/overdriven/distorted guitars, and dedicated bass variants |
| Programs 40-47, strings/orchestra | Bowed violin family, a tremolo-strings pad, Karplus-Strong pizzicato strings and harp, and a timpani fallback |
| Programs 52-54, choir/voice | Choir-aahs, voice-oohs, and synth-voice programs voiced on the dedicated source-filter vocal engine |
| Programs 56-79, brass/reed/flute | Provisional lip-reed brass (56-60) and FM brass (61-63), plus reed woodwinds/saxophones and air-jet flutes |
| Programs 104-107, ethnic plucked | Buzzing-bridge plucked-string sitar (104), shamisen (106), and koto (107); the banjo (105) stays on Karplus-Strong |
| Programs 112-119, percussive | Percussion-engine tinkle bell, agogo, steel drums, woodblock, taiko drum, melodic tom, synth drum, and reverse cymbal |
| Drums and GS variants | GM/GS drum-kit variants and GM2/GS bank fallbacks, with GS EFX routed to built-in insert chains where available |

One note worth knowing up front: named pipe-organ colors like `bourdon` and `trumpet-rank` live only in the named preset catalog, not in GM program routing (program 19 is the church-organ flue pipe, and programs 20-23 are the free-reed reed-organ, harmonica, and bandoneon).

For beginners, the practical rule is simple: **use SoundFont when you need exact or production-ready sampled instruments; rely on NativeSynth fallback when you need a small, always-available preview or a missing-program safety net**.

### GS variation tones

A GM program number selects a *capital* tone. GS and GM2 both let a file reach a **variation** of that capital — a wide piano, a detuned organ, a 12-string guitar — by sending Bank Select before the program change. The fallback bank voices thirty such variations under seventeen capital programs.

Each variation carries **two addresses for one voice**: its GS Bank Select MSB number and its GM2 number. A GS-authored file and a GM2-authored file therefore sound the same tone, rather than one of them landing on the capital because it used the other standard's number.

| Capital program | Variation | GS MSB | GM2 |
|---|---|---|---|
| 0 Acoustic Grand Piano | Wide | 8 | 1 |
| 0 Acoustic Grand Piano | Dark | 16 | 2 |
| 1 Bright Acoustic Piano | Wide | 8 | 1 |
| 2 Electric Grand Piano | Wide | 8 | 1 |
| 3 Honky-tonk Piano | Wide | 8 | 1 |
| 4 Electric Piano 1 | Detuned | 8 | 1 |
| 4 Electric Piano 1 | Velocity-switched | 16 | 2 |
| 4 Electric Piano 1 | Sixties | 24 | 3 |
| 5 Electric Piano 2 | Detuned | 8 | 1 |
| 5 Electric Piano 2 | Velocity-switched | 16 | 2 |
| 6 Harpsichord | Coupled (8′+4′ octave) | 8 | 1 |
| 6 Harpsichord | Wide (two-choir stereo) | 16 | 2 |
| 6 Harpsichord | Key-off jack noise | 24 | 3 |
| 11 Vibraphone | Wide | 8 | 1 |
| 12 Marimba | Wide | 8 | 1 |
| 14 Tubular Bells | Church bell | 8 | 1 |
| 14 Tubular Bells | Carillon | 9 | 2 |
| 16 Drawbar Organ | Detuned | 8 | 1 |
| 16 Drawbar Organ | Sixties | 16 | 2 |
| 16 Drawbar Organ | Organ 4 | 32 | 3 |
| 17 Percussive Organ | Detuned | 8 | 1 |
| 17 Percussive Organ | Organ 5 | 32 | 2 |
| 19 Church Organ | Flute registration | 8 | 1 |
| 19 Church Organ | Full organ | 16 | 2 |
| 21 Accordion | Italian tuning | 8 | — |
| 24 Acoustic Guitar (nylon) | Ukulele | 8 | 1 |
| 24 Acoustic Guitar (nylon) | Key-off noise | 16 | 2 |
| 25 Acoustic Guitar (steel) | 12-string | 8 | 1 |
| 25 Acoustic Guitar (steel) | Mandolin | 16 | 2 |
| 40 Violin | Slow attack | 8 | 1 |

The Italian accordion is deliberately GS-only. GM2 gives its own variation 1 under program 21 to the *French* accordion, which is the dry tuning the capital already voices — adopting that address would make the two standards contradict each other.

::: info A bank number that names nothing still sounds
A Bank Select value that reaches no variation this table voices resolves to the **capital tone**, which is what a hardware module does for a variation it does not have. No file loses a sound because it asked for a tone the bank has not been given yet, and adding a variation later changes only the files that were already asking for it.
:::

Each variation is voiced from **its capital's own physical model** rather than from a separate recording, so re-voicing a capital carries its variations with it instead of leaving them behind. That is also why the three piano capitals each get their own wide variation instead of sharing the grand's: sharing it would have made each one duller, quieter, or more in tune than the capital it is supposed to be a variation of.

### The `drum-kit` preset and the GM drum map

`drum-kit` selects the `percussion` engine and maps incoming MIDI notes to the **General MIDI drum map** — note 36 is the kick, note 38 the acoustic snare, and so on — rather than treating note number as pitch. Route a drum pattern's notes to a destination bound to `drum-kit` and each note triggers its mapped piece.

### GS / GM drum-kit variants

`drum-kit` also recognizes GS-style drum-kit selection (GS is Roland's General MIDI extension set; kits are addressed by rhythm-part program numbers in bank 128) and reshapes the Standard kit per set at note-on — more shell body for Room, bigger/lower shells for Power, and so on.

Two numbers appear per row and they are not interchangeable. **Program** is what a file sends; it is the rhythm part's program-change number and the address the standards define. **Index** is this bank's own slot for the set. Indices are **append-only**: a set added later takes the next free index, so adding one can never renumber a set already voiced, and nothing that already sounds right starts sounding like something else.

The **tone map** column is the earliest generation that defines the set — the same map a [Bank Select LSB](#the-gs-architecture-layer) selects. A file that pins an older map does not reach the sets introduced after it, and those fall back to Standard, exactly as a module of that generation does.

Every set is a **re-voicing of the one shared percussion model**, not a second copy of it: the kick, snare, tom, hat, and cymbal parameters are reshaped at note-on. Improving the underlying model therefore improves all 26 at once, and a set can only differ in ways the model has a parameter for.

| Program | Index | GS name | Tone map | Voicing change vs Standard |
|---|---|---|---|---|
| 0 | 0 | Standard | SC-55 | — |
| 8 | 1 | Room | SC-55 | more shell body, longer ambient tail |
| 16 | 2 | Power | SC-55 | bigger, lower, longer shells |
| 24 | 3 | Electronic | SC-55 | sine-ified, dried-out membranes |
| 25 | 4 | TR-808 (GM2: Analog) | SC-55 | decaying-sine kick, single-tone snare and toms |
| 32 | 5 | Jazz | SC-55 | tighter, higher, softer |
| 40 | 6 | Brush | SC-55 | snare becomes a sustained swish |
| 48 | 7 | Orchestra | SC-55 | longer membrane and cymbal tails |
| 56 | 8 | SFX | SC-55 | one-shot set — plays the Standard voicing |
| 127 | 9 | CM-64/32L | SC-55 | short, thin, bright — the LA-synth era |
| 1 | 10 | Standard 2 | SC-88 | drier, tighter room; more snare wire |
| 26 | 11 | Dance | SC-88 | sine kick, clap-lit snare, tight hats |
| 49 | 12 | Ethnic | SC-88 | hand drums — struck near the rim, thin shell |
| 50 | 13 | Kick & Snare | SC-88 | only the kick and snare move; the rest is Standard |
| 57 | 14 | Rhythm FX | SC-88 | one-shot set — plays the Standard voicing |
| 2 | 15 | Standard 3 | SC-88Pro | struck off-centre, left more open |
| 9 | 16 | Hip Hop | SC-88Pro | low, short and squashed |
| 10 | 17 | Jungle | SC-88Pro | everything cut off early and pushed bright |
| 11 | 18 | Techno | SC-88Pro | purely synthetic membranes, hard bright top |
| 27 | 19 | CR-78 | SC-88Pro | filtered noise ticks; snare with no wire under it |
| 28 | 20 | TR-606 | SC-88Pro | thin and tinny — the smallest analog box |
| 29 | 21 | TR-707 | SC-88Pro | sampled, not analog: crisp, dry and short |
| 30 | 22 | TR-909 | SC-88Pro | long decaying-sine kick with a click on top |
| 52 | 23 | Asia | SC-88Pro | gongs and taiko — big, low, long-ringing |
| 53 | 24 | Cymbal & Claps | SC-88Pro | one-shot set — plays the Standard voicing |
| 58 | 25 | Rhythm FX 2 | SC-88Pro | one-shot set — plays the Standard voicing |

::: warning One-shot sets and Sound-Effects programs are addressed, not yet modeled
Four sets are banks of individual one-shot recordings on real GS hardware rather than re-voiced kits: **SFX**, **Rhythm FX**, **Cymbal & Claps**, and **Rhythm FX 2**. There is nothing for a membrane model to reshape, so they are addressed and named but play the Standard kit's voicing. The GM Sound-Effects programs (120-127, covered in the [GM tone map](./gm-tone-map.md)) are in the same position and share one generic noise voice. A SoundFont that supplies real samples for these addresses plays back normally through the SF2 player.
:::

### Following GM programs instead of pinning one patch

A binding normally pins one patch to a destination: every note through it plays
that voice, whatever program changes the MIDI carries. For a general MIDI file
that is the wrong shape — you want each channel to pick up its own instrument.

Turn on GM program following and the synth resolves melodic voices from the
tracked bank and program change, and routes MIDI channel 10 through the GM
drum-kit map. The bound patch stays as the fallback for anything the map does
not cover, so nothing goes silent. With the mode off, the fixed-patch behaviour
above is unchanged.

```python
# Python
audio = project.bounce_with_synth_instrument(
    "acoustic-piano",          # fallback for unmapped programs
    auto_select_gm=True,
    sample_rate=48000,
)
```

```typescript [WASM / Node]
// A SynthPatch object carries the JS binding option; a preset string cannot.
const audio = project.bounceWithSynthInstrument(
  { preset: 'acoustic-piano', useGmPrograms: true },
  { totalFrames: 48000, numChannels: 2 },
);
```

The flag is `use_gm_programs` on the C ABI's `SonareSynthInstrumentBinding`,
`auto_select_gm` in Python, and `useGmPrograms` on the WASM/Node JavaScript
`SynthPatch` descriptor. All default to `false`, preserving the fixed-patch
fallback. `useGmPrograms` is a JS binding convenience, not a NativeSynth patch
field. On both CLIs it is the bare `--synth` flag
(`sonare project bounce --in project.json --synth -o out.wav`); passing a preset
name instead pins that patch.

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
# --synth <preset> takes any name from the NativeSynth preset catalog, not just the
# oscillator waveforms — run `sonare project synth-presets` for the full list.
# Bare --synth follows the project's GM program changes instead.
# A custom SynthPatch object (rather than a preset name) is binding-only
# (see Browser / Python above).
sonare project bounce --in song.json -o synth.wav --synth saw
sonare project bounce --in song.json -o pad.wav --synth warm-pad
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

## The GS architecture layer

On top of GM, the [SoundFont player](./soundfont-player.md) implements the Roland-GS extensions a GS-authored arrangement expects:

- **Variation-bank fallback** — a GS variation bank that the SoundFont does not cover falls back to the capital (bank-0) tone, so a missing variation still plays the right family instead of going silent.
- **Bank-128 drum kits on channel 10** — drum programs live in bank 128; channel 10 (index 9) is the drum part by convention.
- **NRPN part edits** — TVF cutoff/resonance, TVA envelope, and vibrato can be edited per part via NRPN, plus **per-note drum NRPNs** for individual drum sounds.
- **GS / GM SysEx** — **GS Reset**, **GM System On**, and "use for rhythm part" SysEx are recognized — both from the host and from SysEx events embedded inside an arrangement.
- **Send-return system effects** — one shared send-return bus behind all 16 parts, with **reverb**, **chorus**, and **delay** units. Each part's send amount is additive from two sources: the channel CC sends (**CC91** reverb, **CC93** chorus, **CC94** delay) and, for reverb and chorus only, the SF2 zone generators `reverbEffectsSend`/`chorusEffectsSend` layered on top (GS delay send is CC-only — there is no SF2 zone generator for it). At power-on the parts start with a musically audible default room (reverb send 40, chorus send 8), so a plain SMF that never sends a reset SysEx still has ambience. A separate per-part **drive** insert (gain-compensated saturation) sits alongside this bus — distinct from the single shared GS **insertion effect (EFX)** described below.
- **MIDI 2.0 / GM2** — the player decodes MIDI 2.0 banked Program Change, and resolves the **Bank Select LSB (CC#32)** one of two ways depending on the MSB:
  - **GM2 addressing** — when the MSB is GM2's melodic bank (`0x79`) or percussion bank (`0x78`), the LSB *is* the variation number (or the percussion set), exactly as GM2 defines it.
  - **GS tone-map select** — for any other MSB the LSB instead picks **which generation's tone set** the MSB's variation number reaches: `0` the module's own (newest) map, `1` SC-55, `2` SC-88, `3` SC-88Pro, `4` SC-8850. Any other value reads as `0`, because a module that never saw the message is already playing its own map. A tone or kit that the selected map predates falls back to the capital tone or the Standard kit — the same thing a real module of that generation does.

::: warning The LSB means two different things
This is the byte you set as `bankLsb` in `Project.midiBankProgram(...)` (see the authoring tip below), and it is the easiest value to get wrong. Under a GM2 MSB it selects a *variation*; under a GS MSB it selects a *tone map*, and the variation number lives in the MSB instead. Writing `bankLsb: 1` next to a GS variation MSB does not pick variation 1 — it pins the part to the SC-55 tone set.
:::

::: warning The SFX kit and GM Sound-Effects programs are not yet individually synthesized
The GS-style **SFX drum kit** (rhythm-part program 56) and the GM **Sound-Effects** programs (120-127, Guitar Fret Noise through Gunshot) are addressed and named by the player, but their per-note effect sounds are not yet individually synthesized in the data-free NativeSynth fallback. The one-shot GS rhythm sets — SFX, Rhythm FX, Cymbal & Claps, and Rhythm FX 2 — currently play the Standard kit's voicing, and programs 120-127 share one generic noise-based voice. A SoundFont that supplies real samples for those addresses plays back normally through this SF2 player — the gap is in the fallback only. See [the GM fallback bank](#the-gm-fallback-bank) above for the built-in fallback voicing.
:::

## GS insertion effects (EFX)

::: info An original DSP re-creation, not bundled hardware data
libsonare's insertion effects are an original DSP re-creation — a combination of libsonare's own algorithms, reconstructed from publicly documented information, mapped onto the GS EFX SysEx and type-numbering model so GS-authored MIDI selects the effect the composer intended. Because the algorithms are independent, they follow the same addressing and effect structure but **do not reproduce the exact sound** of any hardware module; treat them as a compatible re-creation, not a 1:1 emulation. There are no bundled samples, ROM data, or firmware, and no affiliation with or endorsement by any hardware manufacturer. For the standards and literature behind this compatibility, see [Algorithm References](./algorithm-references.md).
:::

Separate from the reverb/chorus/delay send-return bus above, GS defines one **insertion effect (EFX)**: an effect inserted directly into a part's signal path, like a guitar pedal, rather than a send-return bus. libsonare implements this the way the hardware it follows does — as a **single shared insertion unit** for the whole player, not sixteen independent per-part effects. Any of the 16 parts can be routed through that one unit via a per-part on/off switch; a part that is switched off bypasses the unit entirely and reaches the mix dry.

There is **no typed "set EFX" call** in any binding. Like real GS hardware, the EFX type and its parameters are programmed exclusively by sending raw SysEx: live, you push those bytes with `RealtimeEngine.pushMidiSysex()`; offline, SysEx embedded in the arrangement's MIDI is realised inline during the bounce.

### EFX type → insertion effect

Each EFX type number selects one insertion effect. Type `0` is Thru (no effect).

| EFX type | GS EFX name | libsonare insertion effect |
|---|---|---|
| 0x0100 | Stereo EQ | parametric EQ |
| 0x0101 | Spectrum | graphic EQ |
| 0x0102 | Enhancer | presence enhancer |
| 0x0110 | Overdrive | amp-sim (crunch voicing) |
| 0x0111 | Distortion | amp-sim (high-gain voicing) |
| 0x0120 | Phaser | phaser |
| 0x0121 | Auto Wah | envelope-following resonant bandpass |
| 0x0122 | Rotary | dual-rotor rotary-speaker model |
| 0x0123 | Stereo Flanger | flanger |
| 0x0124 | Step Flanger | flanger |
| 0x0126 | Auto Pan | auto-pan |
| 0x0130 | Compressor | compressor |
| 0x0131 | Limiter | limiter |
| 0x0140 | Hexa Chorus | six-voice ensemble |
| 0x0141 | Tremolo Chorus | chorus |
| 0x0142 | Stereo Chorus | chorus |
| 0x0143 | Space-D | chorus (unmodulated) |
| 0x0144 | 3D Chorus | chorus (widened) |
| 0x0150 | Stereo Delay | stereo delay |
| 0x0151 | Modulation Delay | stereo delay |
| 0x0152–0x0154 | 3-tap / 4-tap / Time-Control Delay | stereo delay |
| 0x0155 | Reverb | plate reverb |
| 0x0156 | Gate Reverb | plate reverb (gated tail not yet modelled) |
| 0x0157 | 3D Delay | stereo delay |
| 0x0160 | 2-voice Pitch Shifter | pitch shifter |
| 0x0161 | Feedback Pitch Shifter | pitch shifter (feedback loop not modelled) |
| 0x0172 / 0x0173 | Lo-Fi 1 / 2 | bit-crusher |

A few GS types (Humanizer, Tremolo, 3D Auto/Manual) have no faithful stock insert yet and pass through dry. The Overdrive/Distortion drive+level and the pitch-shifter's coarse pitch+balance are translated from their raw EFX parameters; other single-effect types run at their insert's own defaults.

### Composite EFX types (multi-stage chains)

A composite EFX type realises as an ordered **chain** of the same DSP inserts running in series, matching the hardware's block structure — a guitar multi-effect, for example, still runs through the individual amp-sim/chorus/delay inserts above, just chained together. The table below is a representative slice; the full map covers the dual-stage `0x0200`–`0x020C` matrix (Overdrive / Distortion / Enhancer feeding Chorus, Flanger, or Delay) and the guitar / bass / Rhodes / keyboard multi presets in the `0x0400`–`0x0500` range.

| EFX type | GS EFX name | Chain (signal order) |
|---|---|---|
| 0x0200 | OD → Chorus | amp-sim → chorus |
| 0x0202 | OD → Delay | amp-sim → stereo delay |
| 0x0400 | Guitar Multi 1 | compressor → amp-sim → chorus → delay |
| 0x0405 | Bass Multi | compressor → amp-sim (bass cab) → EQ → chorus |
| 0x0406 | Rhodes Multi | enhancer → phaser → chorus → auto-pan |
| 0x0500 | Keyboard Multi | ring-mod → EQ → pitch-shifter → phaser → delay |

### Live vs. offline realisation

- **Offline (bounce)** — EFX SysEx embedded in the arrangement is applied inline during the render: an EFX change mid-bounce takes effect on the next block.
- **Live** — `pushMidiSysex()` builds the new effect chain off the audio thread and hands it over wait-free, so a live engine hears an EFX change **without stopping** playback.

The demo below renders one held chord through the GS-compatible player and lets you switch the insertion effect, so you can hear how each one reshapes the tone against the dry reference.

<SonareDemo id="gs-efx" />

::: tip Author GS banks with the MIDI helpers
`Project.midiBankProgram(ppq, group, channel, bankMsb, bankLsb, program)` expands a bank-select-plus-program-change into the MIDI events `setMidiEvents` accepts — the right way to select a GS variation or a drum kit. Static helpers like `Project.gmInstrumentName(program)`, `Project.gmDrumName(note)`, `Project.gm2InstrumentName(bankLsb, program)`, and `Project.midiCcName(controller)` name the slots so your authoring code reads clearly. The reverse direction is symmetric: `Project.gmProgramForName(name)`, `Project.gmDrumNoteForName(name)`, and `Project.midiCcIndexForName(name)` return the number for a canonical name (`-1` when unknown), while `Project.gmFamilyName(family)` and `Project.gmFamilyFirstProgram(family)` enumerate the 16 GM instrument families. `Project.gm2DrumSetName(bankLsb)` and `Project.gm2DrumName(bankLsb, note)` name the GM2 drum-set variations.
:::

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
| 6 | Harpsichord | `harpsichord` | jack and plectrum; key speed barely changes loudness |
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

Bank Select is read on every capital program the fallback voices a variation for — see [GS variation tones](#gs-variation-tones) above for the full map.

This routing is separate from the named preset catalog: `synthPresetNames()` still lists the hand-authored presets (`e-piano`, `harp`, `drum-kit`, and so on), while the GM fallback bank chooses the internal patch for each MIDI program number during SF2 fallback.

## GM tone map — all 128 programs

Every General MIDI program resolves to one of the synthesis engines, and the per-program table of all 128 — instrument name, engine, and voicing notes — is long enough to live on its own page. The canonical instrument names are also available at runtime from `Project.gmInstrumentName(program)`.

See [GM Tone Map](./gm-tone-map.md) for the complete table.
