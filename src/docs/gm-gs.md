---
title: GM and GS Fallback Bank
description: The NativeSynth GM fallback bank — GS variation tones, GM/GS drum-kit variants, following GM program changes, the GS architecture layer and its insertion effects, and SoundFont fallback routing.
---

# GM and GS Fallback Bank

This page covers the General MIDI and GS side of the [built-in synthesizer](./native-synth.md): the data-free GM fallback bank with its GS variation tones and drum-kit variants, how a bounce follows GM program changes, the Roland-GS architecture layer and insertion effects the [SoundFont player](./soundfont-player.md) implements, and when a note falls from a SoundFont to the bank. The per-program voicing table is on [GM Tone Map](./gm-tone-map.md).

What lives here is the concrete side of GS — the addresses, the tables, the per-slot detail. *Why* a browser audio engine speaks GS at all, and how the places it parts company with the specification sort into extension, deliberate divergence and reduction, is on [Sound Sources](./sound-sources.md).

<MaturityNote
  item="gs-scope"
  :labels="{
    title: 'GS is a control protocol here, not a sound',
    body: 'GS is implemented as a way to control physical-model and FM instruments, and the resemblance to a sound module stops at the wire. What the compatibility contract owes is that a file\'s messages arrive, are understood, and move the parameter they name in the direction and by the amount the specification gives. What any slot should sound like is a separate question with a separate answer: a program whose timbre differs from the hardware\'s is not a defect against that contract. The voicing tables on this page describe what the bank does, not a target it is failing to hit.'
  }"
/>

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

The audition takes one capital — program 16, Drawbar Organ — and offers the three variations the bank voices apart from it. It stops there because a Bank Select MSB with no variation behind it resolves to the capital and renders a bit-identical buffer: MSB 24 on this program is one such number, and an option that cannot sound different is not a comparison.

<SonareDemo id="gs-variation-tones" />

### The `drum-kit` preset and the GM drum map

`drum-kit` selects the `percussion` engine and maps incoming MIDI notes to the **General MIDI drum map** — note 36 is the kick, note 38 the acoustic snare, and so on — rather than treating note number as pitch. Route a drum pattern's notes to a destination bound to `drum-kit` and each note triggers its mapped piece.

### GS / GM drum-kit variants

`drum-kit` also recognizes GS-style drum-kit selection (GS is Roland's General MIDI extension set; kits are addressed by rhythm-part program numbers in bank 128) and reshapes the Standard kit per set at note-on — more shell body for Room, bigger/lower shells for Power, and so on.

Two numbers appear per row and they are not interchangeable. **Program** is what a file sends; it is the rhythm part's program-change number and the address the standards define. **Index** is this bank's own slot for the set. Indices are **append-only**: a set added later takes the next free index, so adding one can never renumber a set already voiced, and nothing that already sounds right starts sounding like something else.

The **tone map** column is the earliest generation that defines the set, and Bank Select is what reaches it. The two halves of that message do two different jobs and never the same one: **Bank Select MSB selects the variation tone, and Bank Select LSB selects the tone map.** Writing a variation number into the LSB therefore pins a generation rather than picking a tone. (GM2 re-uses the LSB for its own variation number under its own two MSBs; [the GS architecture layer](#the-gs-architecture-layer) below has that exception.)

Which generation counts as the current one is fixed by the device being targeted, and that device is the **SC-8850 — which includes the SC-88Pro rather than trading against it.** The two Parameter Address Maps agree on every address they share and part company at ten points, and at nine of the ten the SC-8850 is the superset, so an SC-88Pro file selects the SC-88Pro map (`40 4x 00` = `03`) and plays. Two consequences are worth stating because they remove work rather than add it: there is no double-module mode to implement, and the target's sixty-four parts are four ports of sixteen rather than a second address space, so a part is still named by one address nibble.

A tone map is audible exactly where it fails to reach a kit. Sixteen of the twenty-six sets below were introduced by a later map, so pinning an older one drops those to Standard, exactly as a module of that generation does. The melodic side is the opposite case: every variation the bank voices is an SC-55 tone that all maps reach, which is why the LSB alone moves nothing in the variation table above and a great deal in the kit table below.

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
Four rhythm sets are banks of individual one-shot recordings on real GS hardware rather than re-voiced kits: **SFX** (program 56), **Rhythm FX** (57), **Cymbal & Claps** (53), and **Rhythm FX 2** (58). There is nothing for a membrane model to reshape, so the player addresses and names them while the fallback map sends all four through to the Standard kit's voicing. The GM **Sound-Effects** programs (120-127, Guitar Fret Noise through Gunshot, covered in the [GM tone map](./gm-tone-map.md)) are in the same position and share one generic noise-based voice. Both gaps are in the data-free fallback only: a SoundFont that supplies real samples for those addresses plays back normally through the [SF2 player](./soundfont-player.md).
:::

The audition below plays one bar of the same groove through a selection of the sets, choosing the kit the way a GS file does — a Program Change on the rhythm part. It is a selection rather than the whole table because it was built by rendering every set and dropping the ones whose output came back bit-identical to Standard, which is exactly what the four one-shot programs above do by design. A host does not need to render anything to draw that line — [the queries below](#deriving-which-sets-are-voiced-apart) return it.

<SonareDemo id="gs-drum-kits" />

### Deriving which sets are voiced apart

Which slots a Program Change or Bank Select actually moves is a question the engine answers, so a picker's annotations should be computed from three queries rather than copied from the tables above. On WASM/Node they are `synthGsDrumKitName`, `synthGsDrumKitIsVoicedApart`, and `synthGsVariationIsVoicedApart`; the C ABI and Python expose the same three under their own naming conventions.

- `synthGsDrumKitName(program)` returns the GS rhythm-set name a rhythm part's Program Change selects (`'Standard'`, `'Room'`, `'TR-808'`, ...), or `null` when the module's own tone map defines no set at that program.
- `synthGsDrumKitIsVoicedApart(program)` returns `true` when at least one drum note in the set differs from Standard, `false` when the set renders exactly as Standard, and `null` when no set sits at that program. Program 0 is Standard itself, so it answers `false` too, alongside the four one-shot sets above.
- `synthGsVariationIsVoicedApart(bank, program)` is the melodic half: `true` when the Bank Select variation has a patch of its own, `false` when it resolves to the capital tone, `null` when either argument falls outside `0..127`. It accepts the GS Bank Select MSB and the GM2 LSB alike, since both address the same variation. Note that `128` is out of range here rather than the drum bank it selects elsewhere in this API. Resolving an unvoiced variation to its capital is what GS specifies, so `false` is correct behaviour rather than a gap — but only this query separates it from a bank that is genuinely voiced, which otherwise takes rendering both and comparing.

The answers are **derived, not listed**: the kit predicate applies the set to every drum note's own resolved patch and compares bytes, and the variation predicate asks whether resolution returns the capital tone's own patch. A slot that gains a voicing changes its answer with no list to keep in step, and a case that exists but no-ops against the current patches still reports honestly. The reference is the module's own tone map, which is the newest one and reaches every set this build voices; a file that selects an older tone map reaches fewer sets.

Both predicates return **three states, and a truthiness check destroys them**: `null` means no slot is there at all, and 102 programs are in that state, so `if (!voicedApart)` sweeps those 102 empty programs in as placeholders on top of the few sets that answer `false`. Compare against `false` explicitly.

```typescript [WASM / Node]
import { synthGsDrumKitIsVoicedApart, synthGsDrumKitName } from '@libraz/libsonare';

const kits = Array.from({ length: 128 }, (_, program) => ({ program, name: synthGsDrumKitName(program) }))
  .filter((kit): kit is { program: number; name: string } => kit.name !== null)
  .map((kit) => ({ ...kit, placeholder: synthGsDrumKitIsVoicedApart(kit.program) === false }));
```

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

On top of GM, the [SoundFont player](./soundfont-player.md) implements the Roland-GS extensions a GS-authored arrangement expects. Everything below is reached by address: a GS write is a Roland frame whose three address bytes name a map, a block inside it, and a parameter inside that.

<GsAddressFigure
  title="Where a GS write lands, and how far it travels"
  caption="Every address in the space carries exactly one of four levels, and an address with no level at all is treated as a defect rather than as silence. STATE is the one worth reading twice: it marks a byte that is received and held faithfully but that nothing downstream reads, because the effect it would drive has no such control."
/>

The four levels are what the player promises per address. `AUDIBLE` means changing the byte changes the render; `STATE` means the value is held and readable but no engine asks for it; `ACCEPT` means it is decoded and dropped; `IGNORE` means the row deliberately declines it and says why. The **16 parts** the player carries follow from receiving a single MIDI port — the `50 ** **` and `51 ** **` blocks are the other group's parts and are declined for that reason, and the target device has no such addresses at all because the port decides which group `40` and `41` mean. It is not a WebAssembly limit; [Sound Sources](./sound-sources.md) separates the constraints that genuinely are.

<MaturityNote
  item="gs-efx-build-gated"
  :labels="{
    title: 'The effect blocks reach the audio only in an FX build',
    body: 'AUDIBLE for the system-effect, master-EQ and EFX blocks is conditional on how the core was compiled. SONARE_MIDI_WITH_FX is raised only under the BUILD_FX option, and the build comment beside it is explicit: without it, &quot;the SF2 player renders dry (sends become no-ops)&quot;. An EFX chain needs one thing more — the host has to supply an insert factory — and without one the writes are still received and held while the signal stays dry. BUILD_FX defaults on, so this is a property of a stripped custom build of the core rather than of a stock one.'
  }"
/>

- **Variation-bank fallback** — a GS variation bank that the SoundFont does not cover falls back to the capital (bank-0) tone, so a missing variation still plays the right family instead of going silent.
- **Bank-128 drum kits on channel 10** — drum programs live in bank 128; channel 10 (index 9) is the drum part by convention.
- **NRPN part edits** — TVF cutoff/resonance, TVA envelope, and vibrato can be edited per part via NRPN, plus **per-note drum NRPNs** for individual drum sounds.
- **GS / GM SysEx** — **GS Reset**, **GM System On**, and "use for rhythm part" SysEx are recognized — both from the host and from SysEx events embedded inside an arrangement.
- **Send-return system effects** — one shared send-return bus behind all 16 parts, with **reverb**, **chorus**, and **delay** units. Each part's send amount is additive from two sources: the channel CC sends (**CC91** reverb, **CC93** chorus, **CC94** delay) and, for reverb and chorus only, the SF2 zone generators `reverbEffectsSend`/`chorusEffectsSend` layered on top (GS delay send is CC-only — there is no SF2 zone generator for it). At power-on the parts start with a musically audible default room (reverb send 40, chorus send 8), so a plain SMF that never sends a reset SysEx still has ambience. A separate per-part **drive** insert (gain-compensated saturation) sits alongside this bus — distinct from the GS **insertion effects (EFX)** described below.
- **MIDI 2.0 / GM2** — the player decodes MIDI 2.0 banked Program Change, and resolves the **Bank Select LSB (CC#32)** one of two ways depending on the MSB:
  - **GM2 addressing** — when the MSB is GM2's melodic bank (`0x79`) or percussion bank (`0x78`), the LSB *is* the variation number (or the percussion set), exactly as GM2 defines it.
  - **GS tone-map select** — for any other MSB the LSB instead picks **which generation's tone set** the MSB's variation number reaches: `0` the module's own (newest) map, `1` SC-55, `2` SC-88, `3` SC-88Pro, `4` SC-8850. Any other value reads as `0`, because a module that never saw the message is already playing its own map. A tone or kit that the selected map predates falls back to the capital tone or the Standard kit — the same thing a real module of that generation does.

::: warning The LSB means two different things
This is the byte you set as `bankLsb` in `Project.midiBankProgram(...)` (see the authoring tip below), and it is the easiest value to get wrong. Under a GM2 MSB it selects a *variation*; under a GS MSB it selects a *tone map*, and the variation number lives in the MSB instead. Writing `bankLsb: 1` next to a GS variation MSB does not pick variation 1 — it pins the part to the SC-55 tone set.
:::

<MaturityNote
  item="gs-rhythm-chorus-send"
  :labels="{
    title: 'A rhythm part hears its chorus send here, and does not on the hardware',
    body: 'On a measured unit a rhythm part accepts its chorus send and reads it back, but nothing arrives in the recording, while the reverb send on the same part in the same run is plainly audible. It is rhythm mode rather than part 10: a melodic part hears the chorus and stops the moment it is switched to rhythm, nothing else changed. Why the send is inert was never established — ignored, the part off the bus, the return muted — so there is no mechanism to reproduce, only an outcome, and this engine\'s standing rule is that a parameter with no counterpart still has to arrive rather than take silence. So the divergence is stated and the send keeps working. It matters when reading the per-program CC93 weighting the fallback bank applies: on the hardware, that weight does nothing for a kit.'
  }"
/>

## GS insertion effects (EFX)

::: info An original DSP re-creation, not bundled hardware data
libsonare's insertion effects are an original DSP re-creation — a combination of libsonare's own algorithms, reconstructed from publicly documented information, mapped onto the GS EFX SysEx and type-numbering model so GS-authored MIDI selects the effect the composer intended. Because the algorithms are independent, they follow the same addressing and effect structure but **do not reproduce the exact sound** of any hardware module; treat them as a compatible re-creation, not a 1:1 emulation. There are no bundled samples, ROM data, or firmware, and no affiliation with or endorsement by any hardware manufacturer. For the standards and literature behind this compatibility, see [Algorithm References](./algorithm-references.md).
:::

Separate from the reverb/chorus/delay send-return bus above, GS defines an **insertion effect (EFX)**: an effect placed directly in a part's signal path, like a guitar pedal, rather than a send-return bus. The specification's block lives at `40 03 xx` and the hardware runs one such unit for the whole module. libsonare runs **sixteen**. Unit 0 keeps `40 03 xx` unchanged — same semantics, same defaults, same layout — and the other fifteen live at `40 3u xx`, where the unit number is the address nibble itself; `40 30 xx` is unit 0 again, a second door into the storage `40 03 xx` already writes.

Routing does not add an address either. `40 4x 22` PART EFX ASSIGN keeps `00` BYPASS and `01` EFX with their exact specified meanings and **widens its own value range**: `02`–`10` select units 1–15. A value outside `00`–`10` is ignored like any other out-of-range write. Nothing collides, because `40 30`–`40 3F` carries no row in either device's parameter map — that is what makes the extension unreachable from a spec-compliant file and therefore safe without a feature flag. Real hardware ignores an unknown address, so a file that uses the extension still plays there, with one insertion effect.

<GsEfxRoutingFigure
  title="Part, insert, system effects, master EQ"
  caption="A bypassed part sends to reverb, chorus and delay from the part itself. A part routed into a unit sends after the effect, by the unit's own three send levels, so the wet tail is made from the processed signal instead of the raw one."
/>

**Two different things wear the phrase "what the hardware does", and they must not be merged.** *One unit for the whole module* is a resource limit of the machine that was built, not a property of GS, and it is lifted. *Parts routed to the same unit sum into it* is not a limit at all — it is what an effect is, the way two guitars into one pedal intermodulate — and it is **not** lifted. A unit runs once, over the sum of every part assigned to it. So the unit count changed and the summing did not, and asking to "restore the summing" never means capping the units. [Sound Sources](./sound-sources.md) sets out why the one is a limit and the other is behaviour.

Because a unit's output is one signal, what sits downstream of it belongs to the unit rather than to the parts. Its send to the system effects is the unit's own (`40 3u 17`–`19`), and the part-level CC91/CC93/CC94 send is suppressed for a routed part so the wet tail is not sent twice. Its master-EQ routing follows the parts feeding it only where those parts agree: a bypass at `40 4x 20` holds when every part on the unit asked for it, and otherwise the unit takes the EQ, which is what every part powers on with.

<MaturityNote
  item="gs-efx-state-slots"
  :labels="{
    title: 'Some EFX parameters are held rather than heard, and that is a fact about the effect',
    body: 'A measurement archive of an individual unit gives 85 (type, slot) pairs a conversion from the raw byte to the quantity it names. 56 of those reach a control of the same physical kind on the insert their type maps to, and all 56 are translated and audible. The remaining 29 are received, held and readable, and nothing reads them — not because the translation is unwritten, but because the insert has no such control. Raising one means giving the insert the control first, not editing a table.'
  }"
/>

<MaturityNote
  item="gs-efx-incomplete-defaults"
  :labels="{
    title: 'Three types power up on a partly inferred default set',
    body: 'Selecting an EFX type loads that type\'s own twenty parameter bytes, and those power-on values are measured rather than transcribed. 62 of the 65 types carry a complete measured set. On the other three the unit refused at least one slot during measurement, so that slot\'s power-on value is inferred and a file that selects the type without writing the slot may start from a different value than the hardware would.'
  }"
/>

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
| 0x0125 | Tremolo | ring modulator driven as amplitude modulation |
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

Three types pass through dry, each because nothing in the insert catalogue carries its identity. **Humanizer** (`0x0103`) *is* a vowel, and no parameter position for the vowel is transcribed, so a fixed one would be a strong resonant filter chosen at random. **3D Auto** and **3D Manual** (`0x0170`, `0x0171`) are binaural panners with no stock insert — 3D Chorus and 3D Delay map instead because there the 3D stage sits on an effect that does exist. Everywhere else, a raw EFX parameter byte is converted and applied wherever the measurement archive reaches it and the insert has a control of the same physical kind; a slot that fails either condition leaves the insert on its own default.

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
