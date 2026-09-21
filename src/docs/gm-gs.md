---
title: GM and GS Fallback Bank
description: The NativeSynth GM fallback bank — GS variation tones, GM/GS drum-kit variants, following GM program changes, SoundFont fallback routing, and the full 128-program tone map.
---

# GM and GS Fallback Bank

This page covers the General MIDI and GS side of the [built-in synthesizer](./native-synth.md): the data-free GM fallback bank with its GS variation tones and drum-kit variants, how a bounce follows GM program changes, when a note falls from a SoundFont to the bank, and the full 128-program tone map.

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

The **tone map** column is the earliest generation that defines the set — the same map a [Bank Select LSB](./soundfont-player.md#the-gs-architecture-layer) selects. A file that pins an older map does not reach the sets introduced after it, and those fall back to Standard, exactly as a module of that generation does.

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
Four sets are banks of individual one-shot recordings on real GS hardware rather than re-voiced kits: **SFX**, **Rhythm FX**, **Cymbal & Claps**, and **Rhythm FX 2**. There is nothing for a membrane model to reshape, so they are addressed and named but play the Standard kit's voicing. The GM Sound-Effects programs (120-127, covered in the GM tone map below) are in the same position and share one generic noise voice. A SoundFont that supplies real samples for these addresses plays back normally through the SF2 player.
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

Every General MIDI program resolves to one of the synthesis engines. The table below is the data-free fallback voicing NativeSynth uses for each GM program number when no SoundFont covers it; the canonical instrument names are also available at runtime from `Project.gmInstrumentName(program)`. Rows marked *provisional* use one of the acoustic physical models still being calibrated.

::: details Show the full 128-program tone map
**Model status** — **stable**: the subtractive, FM, modal, additive, and percussion cores are settled. **provisional**: the piano, Karplus-Strong, pipe-organ, bowed-string, reed, brass, flute, plucked-string (buzzing-bridge), vocal, and free-reed physical models are still being calibrated. The harpsichord's decay and stretch are regressed against captured references, so it is not marked provisional.

#### Piano (0-7)

| Prog | Instrument | Engine | Notes |
|---|---|---|---|
| 0 | Acoustic Grand Piano | `piano` | provisional; shared modal soundboard |
| 1 | Bright Acoustic Piano | `piano` | provisional |
| 2 | Electric Grand Piano | `piano` | provisional (the acoustic waveguide, not FM) |
| 3 | Honky-tonk Piano | `piano` | provisional |
| 4 | Electric Piano 1 | `fm` | tine/bell FM |
| 5 | Electric Piano 2 | `fm` | shares the EP1 voicing |
| 6 | Harpsichord | `harpsichord` | jack and plectrum; three bank-selected registrations |
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

#### Synth Lead (80-87) — subtractive oscillators

| Prog | Instrument | Engine | Notes |
|---|---|---|---|
| 80 | Lead 1 (square) | `subtractive` | 3-osc detuned lead through a Moog-ladder filter |
| 81 | Lead 2 (sawtooth) | `subtractive` | |
| 82 | Lead 3 (calliope) | `subtractive` | |
| 83 | Lead 4 (chiff) | `subtractive` | |
| 84 | Lead 5 (charang) | `subtractive` | |
| 85 | Lead 6 (voice) | `subtractive` | a sung lead: the oscillator runs through the **vocal formant body**, which is the model — the oscillator only has to be rich enough to feed it |
| 86 | Lead 7 (fifths) | `subtractive` | |
| 87 | Lead 8 (bass + lead) | `subtractive` | |

#### Synth Pad (88-95) — subtractive oscillators

| Prog | Instrument | Engine | Notes |
|---|---|---|---|
| 88 | Pad 1 (new age) | `subtractive` | 7-osc supersaw pad |
| 89 | Pad 2 (warm) | `subtractive` | |
| 90 | Pad 3 (polysynth) | `subtractive` | |
| 91 | Pad 4 (choir) | `subtractive` | the same **vocal formant body** as Lead 6, mixed higher, over the pad's envelope instead of the lead's |
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
