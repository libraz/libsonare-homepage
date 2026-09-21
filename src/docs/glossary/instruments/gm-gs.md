---
title: GM and GS
description: What a standard that assigns numbers to instruments actually promises — program numbers, the drum channel, Bank Select and variation tones, what GS adds on top of GM — and why libsonare speaks GS as a way to address physical-model voices rather than to imitate a sound module.
---

# GM and GS

A [MIDI](./midi-basics.md) file carries no sound. It says "program 40, channel 3, note 67, hard" and leaves the rest to whatever is listening. That works beautifully until you hand the file to somebody else, because nothing in those numbers says what program 40 *is*. On one machine it is a violin, on the next it is a factory preset nobody remembers naming.

**General MIDI (GM)** is the agreement that fixes the meaning of the number. **GS** is a larger agreement built on top of it. This page explains what each one promises, what neither one promises, and what libsonare does with them. It is concepts only — no code.

::: info The one-sentence version
GM says *which slot*. It never says what the slot sounds like. Two machines that both follow GM correctly will not sound alike, and neither of them is broken.
:::

## What a numbering agreement buys

Before GM, a `.mid` file was only portable in the sense that it parsed. The notes arrived; the instruments were a lottery. GM changes that with a single, boring, enormously useful move: it publishes a table. Program 0 is an acoustic grand piano. Program 24 is a nylon-string guitar. Program 40 is a violin. Program 56 is a trumpet. All 128 slots are spoken for, grouped into sixteen families of eight — pianos, chromatic percussion, organs, guitars, basses, strings, ensemble, brass, reed, pipe, synth lead, synth pad, synth effects, ethnic, percussive, sound effects.

What you get from that is not fidelity. It is **recognisability on a machine that has never seen the file**. The bass line comes out of something bass-shaped, the melody out of something that can carry a melody, and the arrangement survives the trip. libsonare's own version of that table is the [GM Tone Map](../../gm-tone-map.md), which lists what each of the 128 programs resolves to here.

## The drum channel

Percussion does not fit the scheme, and GM handles it with an exception rather than a workaround. On one channel — **channel 10** by convention — the note number stops meaning pitch and starts meaning *instrument*. Note 36 is a kick drum, 38 a snare, 42 a closed hi-hat, 49 a crash cymbal. A drum part is therefore written as a melody line that nobody reads as a melody, and every GM device knows to read it the other way.

This is why a channel-10 track transposed up an octave turns into nonsense instead of a higher-pitched drum kit: the numbers are names, and moving a name by twelve gives you a different name.

## Bank Select, variation tones, and the tone map

128 programs is not many. **Bank Select** widens the address without breaking it: two Control Change messages sent just before a Program Change pick which *shelf* of 128 the program is read from. The capital tone — the plain GM instrument — is what you get when no bank has been selected, so a GM-only file keeps working unchanged.

A **variation tone** is what lives on the other shelves: the same slot, voiced differently. Program 48 is strings; a variation of program 48 is a different strings. Nothing about the program number changes, so a device that does not have the variation falls back to the capital tone and the arrangement still plays.

<FlowDiagram
  title="How a part chooses its voice"
  :nodes="[
    { id: 'msb', label: 'Bank Select MSB (CC#0)', col: 0, row: 0 },
    { id: 'lsb', label: 'Bank Select LSB (CC#32)', col: 0, row: 1 },
    { id: 'pc', label: 'Program Change', col: 0, row: 2, variant: 'accent' },
    { id: 'slot', label: 'Resolved slot', col: 1, row: 1, variant: 'decision' },
    { id: 'voice', label: 'Voice', col: 2, row: 1, variant: 'success' }
  ]"
  :edges="[
    { from: 'pc', to: 'slot', label: 'capital tone' },
    { from: 'msb', to: 'slot', label: 'variation' },
    { from: 'lsb', to: 'slot', label: 'tone map', style: 'dashed' },
    { from: 'slot', to: 'voice' }
  ]"
  caption="The Program Change alone is enough — it names the GM instrument. The two Bank Select halves narrow it further, and a device that does not recognise what they ask for still has the capital tone to sound."
/>

The two halves of Bank Select do different jobs here. One picks the variation; the other picks the **tone map**, which is the generation of the sound set the variation number is read against. The same variation number means different things in a 1991 tone set and a 1998 one, and the tone map is how a file says which it was written for. The `::: details` block below gives the exact assignment.

Drum kits ride on the same mechanism from the other direction. Once a part has been declared a **rhythm part**, its program number stops selecting an instrument and starts selecting a **kit** — Standard, Room, Power, Jazz, Brush, Orchestra, and a long tail of drum-machine and production kits added by later tone maps. A kit is a variation of the rhythm part in exactly the way a variation tone is a variation of a melodic program, and a kit the selected map does not define falls back to Standard rather than to silence.

## What GS adds over GM

GM stops at the instrument list. **GS** keeps going, and the additions are all of one kind: they give the file control over things GM left to the machine.

- **Per-part editing.** Each of the sixteen parts gets its own filter cutoff and resonance, its own envelope attack, decay and release, its own vibrato rate, depth and delay, its own tuning, key range and pan. A GM file asks for a violin; a GS file asks for a violin with the brightness pulled down and a slower vibrato onset.
- **Effects that travel in the file.** Reverb, chorus and delay are module-wide units with per-part sends, plus an insertion effect with its own parameter block. The amount of reverb stops being a property of whoever happens to be playing the file back.
- **The rhythm-part machinery.** GM has one drum channel by convention. GS makes it a switch any part can set, allows more than one rhythm part at a time, selects which kit the part plays, and adds a per-note edit layer on top of the kit — level, pan, pitch, the three effect sends, the exclusive group, and which sound a struck note actually plays.

All of it is addressed with System Exclusive messages, which is why GS files are full of long byte sequences that a GM-only device ignores harmlessly. That is the design: a GS file is a GM file with extra instructions that do nothing where they are not understood.

## The boundary, and why it is not a defect

Here is the part that catches people out. **A standard of this kind fixes which slot, never what the slot sounds like.** It says program 40 is a violin. It does not say which violin, recorded how, played by whom, in what room, at what dynamic. Two implementations can both follow the specification exactly and sound nothing like each other — one warm and sampled, one thin and synthetic — and there is no test either of them fails.

Treating that as a compatibility bug leads nowhere, because there is no reference recording to be compatible *with*. What can be checked is whether the message arrived, was understood, and moved the parameter it names in the direction and by the amount the specification gives. That is a real contract, and it is the one worth holding an implementation to.

## What GS means here

libsonare has no sample library and ships no SoundFont. Its GM and GS voices are [physical models](../../physical-models.md) and FM stacks computed at the sample rate, and the engine's own specification is blunt about what that makes the standard for:

> GS is implemented here as a way to control physical-model and FM instruments, and the resemblance to a sound module stops at the wire.

So read GS on this engine as **an address space, not an imitation**. Program 41 selects a cello and what answers is a bowed-string model — a delay line, a loss filter, and a simulated bow — rather than a recording of one. The per-part edits are real and do what the specification says: a cutoff edit engages the model's filter, an envelope edit scales the model's amplitude envelope, a vibrato edit moves the model's pitch LFO. What is deliberately *not* promised is that any slot matches a particular piece of hardware, and a report that one does not is not a defect against the protocol.

The payoff is the one GM was invented for in the first place: a file arrives, names its instruments in a vocabulary the engine already knows, and plays — with no download, no bank to install, and nothing for the sender and the receiver to agree on beyond the numbers. The [GM and GS fallback bank](../../gm-gs.md) documents which voice each slot reaches, and [Sound Sources](../../sound-sources.md) explains why a browser engine took this road rather than shipping samples.

::: details How libsonare addresses it
The two halves of Bank Select are split by job. **Bank Select MSB (CC#0) carries the variation tone number** and the capital tone stays the Program Change; **Bank Select LSB (CC#32) selects the tone map** — `1` the SC-55 map, `2` the SC-88, `3` the SC-88Pro, `4` the SC-8850's own, and `0` meaning "whichever map the module is set to", since a module that never received the message is already playing its default. A value outside the defined maps reads as the module default rather than as nothing.

**Drum kits are addressed by rhythm-part program number.** Twenty-six kits are defined across the maps — ten reachable on every map (Standard, Room, Power, Electronic, TR-808, Jazz, Brush, Orchestra, SFX, CM-64/32L), five more introduced by the SC-88 map and eleven by the SC-88Pro map — and programs 64 and 65 sit outside that table on purpose, so they are free to select the two user drum sets a file assembles note by note. Program numbers are zero-based here, so a manual's one-based "PC 26 TR-808" is program 25. A kit whose introducing map the file has not selected falls back to Standard, which is what a hardware module does for a kit its map does not have.

**The target device is the SC-8850, and that includes the SC-88Pro.** The two parameter address maps agree on size, data range and power-on default everywhere they overlap and part company at ten points, of which nine have the SC-8850 as the superset — so an SC-88Pro file selects the SC-88Pro tone map and plays without anything being traded away. The tenth runs the other way: stored patches and stored user effect types are a front panel's memory, which a renderer does not have, so that whole region is deliberately unimplemented with the reason recorded rather than left unassigned.
:::

Related: [GM and GS Fallback Bank](../../gm-gs.md), [GM Tone Map](../../gm-tone-map.md), [Sound Sources](../../sound-sources.md), [MIDI Basics](./midi-basics.md), [SoundFont and Sampled Instruments](./soundfont.md)
