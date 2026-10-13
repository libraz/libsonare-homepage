---
title: Sound Sources
description: Why this engine ships no samples, what the four synthesis methods cost, and why a browser audio engine speaks a 1990s hardware protocol — the entrance to the Instruments and MIDI pages.
---

# Sound Sources

Every other page in this section starts from a call: bind a preset, send a program change, load a SoundFont. This one starts one step earlier, with the two questions those pages assume you have already settled.

**Why does an audio engine ship no sample data at all?** And **why does something running in a browser tab speak a protocol designed for a 1990s desktop sound module?**

They have the same answer, and the answer is a cost decision.

::: tip Read first
This page uses words such as oscillator, FM operator, program and bank without stopping to define them. If they are new, [Synthesis Basics](./glossary/instruments/synthesis-basics.md), [MIDI Basics](./glossary/instruments/midi-basics.md) and [GM and GS](./glossary/instruments/gm-gs.md) cover them from the beginning, in that order.
:::

## Four ways to make a note, and what each one costs

A digital instrument makes a note in one of four broad ways. They differ less in what they can sound like than in **where the bill lands** — on the bytes a listener has to download, or on the arithmetic a processor has to do while the note is sounding.

| method | data size | compute | where expression enters | what it is in this engine |
|---|---|---|---|---|
| **sample playback** | grows without limit | low | crossfading between recordings made at different velocities and articulations | the SoundFont player, for samples you bring |
| **FM** | near zero | moderate | operator ratios and the modulation index moving over time | several engine modes; the electric pianos, bells and Clavi program of the fallback bank |
| **physical modeling** | near zero | high | physical quantities — bow force, breath pressure, lip tension | the nine acoustic voices, plus the plucked-loop, harpsichord, modal and membrane models |
| **subtractive (virtual analog)** | near zero | moderate | filter cutoff and resonance under an envelope | `SynthPatch`'s analog voice; leads, pads and the synth-effect programs |

Only the first row has an appetite. A sample library grows with the product of three numbers — **how many timbres, how many recorded layers per timbre, and how good the capture is** — and every one of those three is something a designer wants more of. Nothing in that product ever gets smaller.

<MaturityNote
  item="physical-model-maturity"
  :labels="{
    title: 'Calibration status',
    body: 'Only the acoustic piano is calibrated against a reference recording. Every other physical model is provisional: use these voices as data-free previews and as the fallback floor; their sound can change across patch releases.'
  }"
/>

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

Naming GS is **not** a claim to reproduce any particular hardware's sound. It is a **numbering system for pointing at the physical-model and FM voices** from the table above. Program 40 selects a violin; what answers is a bowed-string model, not a recording of one, and nothing in the protocol ever promised otherwise. The same source spells out the consequence: a report that a program's timbre differs from the hardware's is not a defect against the protocol, whichever way it differs.

Where the engine parts company with the specification, it says so and sorts the difference into one of three kinds: an extension a spec-compliant file cannot reach, a deliberate divergence with its reason recorded, or a reduction where this configuration has nothing to receive the address. The table of those three kinds, and the per-address detail behind it, is on [GM and GS Fallback Bank](./gm-gs.md#where-it-is-gs-and-where-it-deliberately-is-not).

## What is genuinely driven by WebAssembly

These are the real ones.

| constraint | evidence |
|---|---|
| **cannot load plugins** | the `InstrumentProvider` seam in `src/host/plugin_host.h` is an abstract factory whose bridge is out of tree, and the Audio Unit backend sits behind `BUILD_AU_HOST` (`src/host/backends/CMakeLists.txt`), which requires macOS frameworks and defaults `OFF` (`CMakeLists.txt`) |
| **ships no samples** | the binary size in the figure above; timbres × layers of recorded audio does not fit in a download |
| **one thread** | this site runs without `SharedArrayBuffer` — no COOP/COEP headers — so the engine is a single heap inside an AudioWorklet |
| **system effects, master EQ and EFX depend on a build flag** | `SONARE_MIDI_WITH_FX` is raised only under `BUILD_FX`, and without it "the SF2 player renders dry (sends become no-ops)" (`src/CMakeLists.txt`); the same blocks are received and silent (`src/midi/synth/docs/gs.md`) |

## Where to go next

This page is the entrance; the pages below are where the detail lives.

- [Built-in synthesizer](./native-synth.md) — the common control layer, the seventeen engine modes, `SynthPatch` and the named preset catalog.
- [GM and GS fallback bank](./gm-gs.md) — the individual addresses, the bank and the drum kits.
- [GM tone map](./gm-tone-map.md) — the engine and voicing of all 128 programs.
- [Physical models](./physical-models.md) — the modeled voices themselves and the parameters each one takes.
- [SoundFont player](./soundfont-player.md) — for samples you bring, and how they interleave with the modeled bank.
- [MIDI input](./midi-input.md) — playing any of it from a keyboard.
