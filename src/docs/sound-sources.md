---
title: Sound Sources
description: Why this engine ships no samples, what the four synthesis methods cost, and why a browser audio engine speaks a 1990s hardware protocol — the entrance to the Instruments and MIDI pages.
---

# Sound Sources

Every other page in this section starts from a call: bind a preset, send a program change, load a SoundFont. This one starts one step earlier, with the two questions those pages assume you have already settled.

**Why does an audio engine ship no sample data at all?** And **why does something running in a browser tab speak a protocol designed for a 1990s desktop sound module?**

They have the same answer, and the answer is a cost decision.

## Four ways to make a note, and what each one costs

A digital instrument makes a note in one of four broad ways. They differ less in what they can sound like than in **where the bill lands** — on the bytes a listener has to download, or on the arithmetic a processor has to do while the note is sounding.

| method | data size | compute | where expression enters | what it is in this engine |
|---|---|---|---|---|
| **sample playback** | grows without limit | low | crossfading between recordings made at different velocities and articulations | the SoundFont player, for samples you bring |
| **FM** | near zero | moderate | operator ratios and the modulation index moving over time | several engine modes; the electric pianos, bells and clavinet of the fallback bank |
| **physical modelling** | near zero | high | physical quantities — bow force, breath pressure, lip tension | the nine acoustic voices, plus the plucked-loop, harpsichord, modal and membrane models |
| **subtractive (virtual analog)** | near zero | moderate | filter cutoff and resonance under an envelope | `SynthPatch`'s analog voice; leads, pads and the synth-effect programs |

Only the first row has an appetite. A sample library grows with the product of three numbers — **how many timbres, how many recorded layers per timbre, and how good the capture is** — and every one of those three is something a designer wants more of. Nothing in that product ever gets smaller.

The piano has been tuned. Every other physical model still awaits adjustment and calibration; use these voices as data-free previews, with further work planned for future patch releases.

The other three rows store a handful of coefficients and spend processor time instead. A bowed string is not a recording of a bowed string; it is a loop that models the string, the bow's grip and slip, and the body the string is mounted on, evaluated once per sample. That is why expression works differently: you do not pick a louder recording, you push harder on the bow.

## Why a browser engine cannot take the sample road

Sound modules of the 1990s and everything descended from them went the first way, and went a long way down it. More timbres, more velocity layers, higher capture quality, generation after generation — a road that runs comfortably into the gigabytes when the instrument is a box on a desk with a disk inside it.

**A browser cannot take that road.** What ships here is one binary that a visitor downloads before hearing anything, and it contains zero bytes of sample data. So the cost was moved: **onto the processor, and off the download.**

<SoundSourceCostFigure
  title="Where each method sends the bill"
  caption="Two lanes, one per kind of cost. Bar length ranks the four methods against each other rather than measuring them, so the lanes carry words instead of numbers. Sample playback is the only row that pays in the first lane, and its bar leaves the lane through a break mark because a sample library has no ceiling a figure could honestly draw. The one real number is the size of the shipped binary, which holds all three synthesis methods and no recordings."
/>

Two things on the site follow from that single decision, and they are worth recognising as consequences rather than as separate features:

- **The seventeen engine modes.** If timbre cannot come from more recordings, it has to come from more kinds of synthesis. Each mode is a different way of generating the raw tone, and breadth of sound is bought by having several rather than by sampling more.
- **The fallback bank that sounds when no SoundFont is loaded.** A MIDI file has to make sound out of the box, and a bank with no data behind it is the only kind that can.

The SoundFont player is not a contradiction of this. It exists for samples the **visitor** brings — a bank they already have, already downloaded, and chose to load. What the engine will not do is ship one.

## Why GS

The second question is the one a reader usually finds stranger. Here is the argument in one line: **with no way to name a timbre, a rendering engine needs a numbering system, and one already exists.**

### The engine has a plugin seam; a WebAssembly build has nowhere to put it

libsonare does have a host seam for external instruments and effects. `src/host/plugin_host.h` defines `InstrumentProvider`, an abstract factory that turns a plain `PluginDescriptor` into a core instance — a header-only interface that names no plugin SDK. Its own file comment says why that is possible: the real bridge "lives out-of-tree behind a build option". The macOS Audio Unit backend under `src/host/backends/plughost/` is compiled only inside `if(BUILD_AU_HOST)` in `src/host/backends/CMakeLists.txt`, an option the top-level `CMakeLists.txt` declares `OFF` by default and which links AudioToolbox, AudioUnit, AVFoundation and CoreAudio.

Read that list of frameworks and the WebAssembly situation is settled without any argument about design. **"No plugins" is a property of the browser build, not of the engine.**

### Without a plugin, nothing names a timbre

This matters more than it first sounds. A plugin is where the answer to *which sound* normally lives: a session names the plugin, the plugin names its preset, and handing the session to somebody else hands over both. Take the plugin away and two things break at once — **selecting** a timbre has no vocabulary, and **handing one off** has nothing to carry.

GM and GS are an existing answer to exactly that problem. Program number, bank, drum kit, per-part setup and effect sends are all specified as values that **travel inside the file**. A renderer that understands them can be handed a file by somebody who has never heard of it and still produce what was meant.

### GS is adopted as a control protocol, not as a sound

This is the part that ties the two halves of the page together, and the engine states it in its own words (`src/midi/synth/docs/gs.md`):

> GS is implemented here as a way to control physical-model and FM instruments, and the resemblance to a sound module stops at the wire.

Naming GS is **not** a claim to reproduce any particular hardware's sound. It is a **numbering system for pointing at the physical-model and FM voices** from the table above. Program 41 selects a violin; what answers is a bowed-string model, not a recording of one, and nothing in the protocol ever promised otherwise. The same source spells out the consequence: a report that a program's timbre differs from the hardware's is not a defect against the protocol, whichever way it differs.

## Where it is GS, and where it deliberately is not

Writing "GS compliant" and stopping there makes every intentional difference look like an oversight. The engine sorts its differences into three kinds, and this page uses the same three, because the three are not interchangeable — one is safe by construction, one is a decision with a reason, and one is an honest admission.

| kind | meaning | representative example |
|---|---|---|
| **extension** | a capability added where the specification forbids nothing — safe precisely because **a spec-compliant file cannot reach it** | one insertion-effect unit for the whole module becomes **sixteen**, reachable through the `40 3u xx` block (`src/midi/synth/docs/gs.md`, `src/midi/synth/gs_address_table.h`) |
| **deliberate divergence** | different behaviour chosen on purpose, with the reason recorded beside it | pan value `00` means random on the hardware and **centre** here, because a bit-identical bounce cannot live with a random number generator (the `40 1x 1C` and `41 m4 rr` rows in `src/midi/synth/gs_address_table.h`); a rhythm part's chorus send is inert on a measured unit and is sounded here. Both reasons are written up in `src/midi/synth/docs/gs.md` |
| **reduction** | the configuration on this side does not have the thing, so the address is accepted and dropped | `40 4x 21` OUTPUT ASSIGN is `IGNORE` — "libsonare renders one output pair, so there is no second one to route a part to"; `50 ** **` and `51 ** **` are `IGNORE` for one port. Both reason strings are the rows' own, in `src/midi/synth/gs_address_table.h` |

Every address in the space carries one of four levels, and an address with no row at all is treated as a defect rather than as silence. A reduction is therefore a written reason, not an omission.

### The insertion-effect extension

The hardware allows exactly one insertion effect for the whole module, and switching it on for two parts mixes both into that one unit. **That is a resource limit of the machine, not a property of GS** — the specification would not have been violated by a machine with sixteen — so it is lifted (`src/midi/synth/docs/gs.md`).

What makes the lift safe is where it lives:

- **Unit 0 stays at `40 03 xx`**, semantics, defaults and layout exactly as specified, including the two control sources and the send EQ switch that belong to the specified block alone.
- **A unit's number is its own address nibble.** The units sit at `40 3u xx`, each with the same `00`–`1F` layout, so `40 30 xx` is a second door into the storage `40 03 xx` already writes. That whole `40 30`–`40 3F` range **carries no row in either device's parameter map**, so a spec-compliant file structurally cannot touch it (`src/midi/synth/gs_address_table.h`).
- **Routing widens an existing value range rather than adding an address.** `40 4x 22` PART EFX ASSIGN keeps `00` BYPASS and `01` EFX with their exact meanings; `02`–`10` select units 1–15 (the `40 4x 22` row in `src/midi/synth/gs_address_table.h`). A value outside `00`–`10` is ignored like any other out-of-range value.

### Summing is not the limit that was lifted

Two different facts wear the phrase "what the hardware does", and collapsing them is the mistake this section exists to prevent.

*One unit for the whole module* is a resource limit, and it does not apply. *Parts routed to the same unit sum through one instance* is not a limit at all, and **it is not lifted** (`src/midi/synth/docs/gs.md`). Two guitars into one overdrive intermodulate because that is what an effect is, not because the machine ran out of units — a file that routes two parts through one unit was written for that sound. So "restore the summing" never means "cap the unit count", and the two requests are not versions of each other.

One consequence follows from the summing rather than from a separate decision: a unit's output is one signal, so its send to the system effects is the unit's own (`40 3u 17`–`19`), not each part's.

### The per-part insert is a separate stage

`Sf2PartInsert` is the host's own insert on a part, built through an injected factory. **It is not GS, it has no address**, and it runs **in series** with the EFX — the part's own stage first on the part's bus, the unit's afterwards on the sum (`src/midi/synth/docs/gs.md`). A guitar with an amplifier still gets the file's chorus. The two are a chain, never a choice, and a reader who merges them will misread both.

### What "sixteen parts" actually follows from

It is tempting to file the sixteen-part limit under "browser constraint". It is not one.

It follows from receiving **a single MIDI port**, and the engine's own reason strings say exactly that. `50 ** **` and `51 ** **` — the addresses an older module used to reach the other sixteen parts — are `IGNORE` for the reasons "libsonare receives one port, so there is no second group of parts to address" and "libsonare receives one port, so there is no second group's drum setup to address". The per-channel port assignment at `00 01 xx` carries the same reason. All three rows are in `src/midi/synth/gs_address_table.h`.

On the target device the sixty-four parts are four ports of sixteen rather than a second address space, and the device is a single-module Mode-1 machine besides: `00 00 7F` SYSTEM MODE SET accepts a range but only `00` acts (`src/midi/synth/docs/gs.md`). So there is no double-module mode to implement either. One port in, one group of sixteen — and a native build receiving four ports would face the same arithmetic.

### What is genuinely driven by WebAssembly

These are the real ones.

| constraint | evidence |
|---|---|
| **cannot load plugins** | the `InstrumentProvider` seam in `src/host/plugin_host.h` is an abstract factory whose bridge is out of tree, and the Audio Unit backend sits behind `BUILD_AU_HOST` (`src/host/backends/CMakeLists.txt`), which requires macOS frameworks and defaults `OFF` (`CMakeLists.txt`) |
| **ships no samples** | the binary size in the figure above; timbres × layers of recorded audio does not fit in a download |
| **one thread** | this site runs without `SharedArrayBuffer` — no COOP/COEP headers — so the engine is a single heap inside an AudioWorklet |
| **system effects, master EQ and EFX depend on a build flag** | `SONARE_MIDI_WITH_FX` is raised only under `BUILD_FX`, and without it "the SF2 player renders dry (sends become no-ops)" (`src/CMakeLists.txt`); the same blocks are received and silent (`src/midi/synth/docs/gs.md`) |

## Where to go next

This page is the entrance; the three that follow are where the detail lives.

- [Built-in synthesizer](./native-synth.md) — the common control layer, the seventeen engine modes, `SynthPatch` and the named preset catalog.
- [GM and GS fallback bank](./gm-gs.md) — the individual addresses, the bank, the drum kits, and the full 128-program tone map.
- [Physical models](./physical-models.md) — the modelled voices themselves and the parameters each one takes.
- [SoundFont player](./soundfont-player.md) — for samples you bring, and how they interleave with the modelled bank.
- [MIDI input](./midi-input.md) — playing any of it from a keyboard.
