---
title: SoundFont and Sampled Instruments
description: Sampled instruments play back recorded audio organized into banks and programs — what a SoundFont (.sf2) is, how General MIDI addresses it, and how libsonare falls back to NativeSynth so MIDI never renders silent.
---

# SoundFont and Sampled Instruments

A **sampled instrument** makes sound the opposite way from a [synthesizer](./synthesis-basics.md): instead of generating a waveform, it plays back short *recordings* of a real instrument. Record a piano playing several notes at several volumes, store those clips, and play the closest one back at the right pitch when a key is pressed — that is sampling in a nutshell. The result can be extremely realistic, because it *is* a real recording.

This page explains what a SoundFont is, how it is addressed, and how libsonare guarantees that a MIDI arrangement always produces sound. It is concepts only — no code.

::: info Sampled vs synthesized
A **synthesized** instrument computes its sound and can be any pitch or tone, but has to be designed. A **sampled** instrument replays recordings and sounds true to life, but is fixed to what was recorded and takes far more storage. Many setups use both — samples for realistic instruments, synths for sounds that do not exist acoustically.
:::

## What a SoundFont is

A **SoundFont** (the `.sf2` file format) is a single file that bundles a whole library of recorded instrument samples, together with the rules for how to play them back (which sample covers which key range, how loops work, basic envelopes). One `.sf2` can hold an entire General MIDI instrument set in a few megabytes.

Inside the file the sounds are organized into **banks** and **programs**, and any one instrument is addressed by a `(bank, program)` pair:

- A **program** is one playable instrument — "acoustic grand piano", "fingered bass".
- A **bank** is a numbered shelf of up to 128 programs. Bank 0 holds the main set; higher banks hold variations.

This is exactly the addressing scheme [MIDI](./midi-basics.md) uses for Program Change and bank select, which is why MIDI and SoundFonts fit together so naturally.

## General MIDI program numbers and the drum bank

Because a SoundFont is addressed by `(bank, program)`, a **General MIDI**-compliant `.sf2` lines its programs up with the GM map: program 0 is an acoustic grand piano, 24 a nylon-string guitar, 40 a violin, and so on across all 128 GM instruments. Percussion lives in a separate **drum bank**, where each *note number* selects a different drum or cymbal rather than a pitch — matching MIDI's channel-10 drum convention.

<FlowDiagram
  title="Note resolution"
  :nodes="[
    { id: 'midi', label: 'MIDI note + channel', col: 0, row: 0 },
    { id: 'addr', label: '(bank, program) lookup', col: 1, row: 0, variant: 'decision' },
    { id: 'sf2', label: 'SoundFont sample', col: 2, row: 0, variant: 'success' },
    { id: 'syn', label: 'NativeSynth GM fallback', col: 2, row: 1, variant: 'error' },
    { id: 'out', label: 'Audio', col: 3, row: 0 }
  ]"
  :edges="[
    { from: 'midi', to: 'addr' },
    { from: 'addr', to: 'sf2', label: 'present' },
    { from: 'addr', to: 'syn', label: 'missing', style: 'dashed' },
    { from: 'sf2', to: 'out' },
    { from: 'syn', to: 'out', style: 'dashed' }
  ]"
  caption="Each used (channel, bank, program) group gets one status. It is SF2 only when the loaded SoundFont covers every played note in that group; an uncovered note uses the NativeSynth GM fallback."
/>

The principle underneath is simple: a note list is instrument-agnostic, and the address decides which instrument performs it. The piano roll below makes that tangible — the notes never change; switching the instrument points the same MIDI at a different sound.

<SonareDemo id="midi-piano-roll" />

## How libsonare resolves a note

libsonare can load a SoundFont and play MIDI through it, but it adds one important guarantee. After you supply a `.sf2` file, every used `(channel, bank, program)` group is summarized by one backend status:

| Situation | Backend | What you hear |
|-----------|---------|---------------|
| Every played note in the `(channel, bank, program)` group is covered by the loaded SoundFont's zones | `'sf2'` | SF2 samples for those notes |
| At least one played note is uncovered, or no SoundFont is loaded | `'synth'` | NativeSynth General MIDI **fallback** for uncovered notes |

The key consequence: an uncovered MIDI note does not become silent solely because a SoundFont lacks a zone. libsonare falls back to its built-in NativeSynth GM bank for each such note. The manifest is conservative and group-level: if any played note in a `(channel, bank, program)` group lacks an SF2 zone, that group's status is `'synth'`, even when other notes in the same group use SF2.

::: tip Why the fallback matters
Different SoundFonts cover different instruments, and a small `.sf2` might only include a handful of programs. The fallback means you can hand libsonare any arrangement and any SoundFont (or none) and still hear the complete piece — then swap in a richer SoundFont later to upgrade the sounds, with no change to the MIDI.
:::

You can inspect exactly what resolved where: `soundFontManifest()` reports one status for each `(channel, bank, program)` group the arrangement plays. The backend summarizes all notes in that group and is `'synth'` when at least one note uses fallback.

::: details How libsonare implements this
On a `Project`, `loadSoundFont(bytes)` registers an `.sf2` file from a byte buffer. `soundFontManifest()` then returns one `Sf2ProgramStatus` per `(channel, bank, program)` combination the arrangement uses, each with a `backend` of `'sf2'` or `'synth'` and the resolved `presetName` (drum channels report bank `128`). The manifest aggregates all note-ons in each combination: any note that escapes the SoundFont's zones changes that entry to `'synth'`; this does not mean every note in the group used NativeSynth. `bounceWithSf2Instrument(...)` applies the same GM fallback per note, so uncovered notes still render. Even with no SoundFont loaded, every note resolves to a NativeSynth voice.
:::

Related: [SoundFont Player](../../soundfont-player.md), [Built-in Synthesizer (NativeSynth)](../../native-synth.md), [MIDI Basics](./midi-basics.md)
