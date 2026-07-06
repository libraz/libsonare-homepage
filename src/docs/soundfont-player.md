---
title: SoundFont 2 Player
description: Render MIDI arrangements with real sampled sounds using libsonare's GS-compatible SoundFont 2 instrument — load your own SF2, play 16-part multitimbral MIDI, and use NativeSynth fallback so bounces and live playback never go silent.
---

# SoundFont 2 Player

**The SoundFont player makes your MIDI play back with real recorded instruments** — a real piano, real drums — instead of synthesized tones. You give it a SoundFont file; it does the rest.

A **SoundFont (SF2)** is a single file that bundles those recorded instrument samples together with the rules for playing them: which sample to use at which pitch and velocity, how to loop it, and how envelopes, filters, and LFOs shape it. Think of it as a sample library in one file. libsonare ships a **GS-compatible SF2 player** that reads a SoundFont *you supply* and renders your MIDI tracks through it — offline via [project bounce](./project-bounce.md), or live through the [realtime engine](./midi-input.md) — with full 16-part multitimbral playback and Roland-GS extensions layered on top of the General MIDI baseline.

::: warning You must bring your own SF2 file
**No SoundFont ships with the library** — an SF2 is licensed instrument data, not code, and nothing is baked into the binaries. You fetch a `.sf2` and hand its bytes to the player. If you have no SF2 (or a program your SF2 does not cover), playback does **not** go silent: it falls through to the built-in [NativeSynth](./native-synth.md) GM bank, the data-free floor.
:::

::: info Terms to know first
A **preset** is one selectable sound (a "program") in the SoundFont. A **program change** picks a preset on a MIDI channel. A **bank** groups 128 programs; GS uses extra banks for tonal variations and reserves **bank 128** for drum kits. Channel 10 is the drum channel by GS convention.

**Multitimbral** means the player can sound several different instruments at once, one per MIDI channel (up to 16). **GS** is Roland's General MIDI extension set — extra banks and per-part controls layered on top of plain General MIDI; a "GS-compatible" player honors those extras so GS-authored songs play as intended.
:::

## How each note picks its sound

For every note, the player asks one question: *does the loaded SoundFont contain a preset for the program this note selects (its channel, bank, and program)?* We call that the SoundFont **covering** the sound. If it does, the note plays from the SF2 sample. If not — or if you loaded no SoundFont at all — the note falls through to the built-in [NativeSynth](./native-synth.md) General MIDI bank. Either way, the note makes sound: **MIDI never renders silent here.**

<FlowDiagram
  title="Sound resolution"
  :nodes="[
    { id: 'note', label: 'Note played', col: 0, row: 0 },
    { id: 'check', label: 'Program in loaded SF2?', col: 1, row: 0, variant: 'decision' },
    { id: 'sf2', label: 'SF2 sample', col: 2, row: 0, variant: 'success' },
    { id: 'syn', label: 'NativeSynth GM fallback', col: 2, row: 1, variant: 'error' },
    { id: 'out', label: 'Audio out', col: 3, row: 0 }
  ]"
  :edges="[
    { from: 'note', to: 'check' },
    { from: 'check', to: 'sf2', label: 'covered' },
    { from: 'check', to: 'syn', label: 'missing / no SF2', style: 'dashed' },
    { from: 'sf2', to: 'out' },
    { from: 'syn', to: 'out', style: 'dashed' }
  ]"
  caption="Either path reaches the output — MIDI never renders silent here."
/>

The [program manifest](#know-what-resolves-the-program-manifest) below lets you see this decision ahead of time, per program.

The demo below uses built-in voices rather than a user-supplied SF2 file, but it shows the same MIDI idea the SoundFont player relies on: the notes stay fixed while the instrument that renders them changes. In your app, the selected instrument can be an SF2 preset when your SoundFont covers that program, or the NativeSynth fallback when it does not.

<SonareDemo id="midi-piano-roll" />

## What You Will Learn

By the end of this page you should be able to:

- load a caller-supplied SF2 into a `Project` or the realtime engine, and release it;
- read the per-program manifest to see which notes resolve to `sf2` versus the `synth` fallback;
- bounce a MIDI arrangement through SF2 instruments deterministically;
- understand the SF2 modulator/envelope semantics and the GS architecture layer the player implements;
- bind an SF2 instrument for live MIDI input.

## Pick the right entry point

The player is exposed at two levels. Use the project level for offline rendering and the engine level for live playback.

| Your situation | Use | Why |
|----------------|-----|-----|
| Render a finished MIDI arrangement to audio | [`Project.bounceWithSf2Instrument(...)`](#bouncing-midi-through-sf2-instruments) | Deterministic offline render of the whole project |
| Inspect coverage before rendering | [`Project.soundFontManifest()`](#know-what-resolves-the-program-manifest) | Per-program `sf2` vs `synth` backend report |
| Play a keyboard or live MIDI stream | [`RealtimeEngine.setSf2Instrument(...)`](#live-engine-playback) | Binds the player to a realtime MIDI destination |

::: info One engine, every runtime
The same SF2 player is exposed through WASM/JS, Node native, and Python. Names follow each language's convention (`loadSoundFont` ↔ `load_soundfont`, `bounceWithSf2Instrument` ↔ `bounce_with_sf2_instrument`, `soundFontManifest` ↔ `soundfont_manifest`), while the parser, voice model, and GS behavior are identical. The CLI does not wire SF2 — use the Project API for SoundFont-backed bounces.
:::

## Load a caller-supplied SF2

Fetch the `.sf2` yourself and hand the player its raw bytes. The player makes its own copy during the call, so you can discard your buffer right after. A few things to know: loading a SoundFont **replaces** any previous one, and malformed bytes throw an error while leaving the previously loaded SoundFont intact.

::: code-group

```typescript [Browser]
import { init, Project } from '@libraz/libsonare';

await init();

// You provide the file — e.g. fetched from your own asset host or picked by the user.
const sf2Bytes = new Uint8Array(await (await fetch('/instruments/my-bank.sf2')).arrayBuffer());

const project = new Project();
try {
  project.loadSoundFont(sf2Bytes);          // throws on malformed input
  project.soundFontPresetCount();           // e.g. 3 — presets in the loaded bank
  // ... build/edit the arrangement, then bounce (see below) ...
  project.clearSoundFont();                 // optional: release the loaded bank
} finally {
  project.delete();                          // the WASM handle is NOT garbage-collected
}
```

```python [Python]
import libsonare as sonare

with open("instruments/my-bank.sf2", "rb") as f:
    sf2_bytes = f.read()

project = sonare.Project()
try:
    project.load_soundfont(sf2_bytes)        # raises SonareError on malformed input
    project.soundfont_preset_count()         # e.g. 3
    # ... build/edit the arrangement, then bounce (see below) ...
    project.clear_soundfont()                # optional: release the loaded bank
finally:
    project.close()                          # release the native handle
```

:::

::: danger Always release the project
`Project`, like every embind object, holds a WASM heap handle that JavaScript's garbage collector cannot reclaim. Call `project.delete()` in a `finally` block (Python uses `project.close()`). A loaded SoundFont's sample pool is freed with the project, or earlier with `clearSoundFont()` / `clear_soundfont()`.
:::

## Know what resolves: the program manifest

Before you render, ask the project **which programs your arrangement actually plays and where each one resolves**. `soundFontManifest()` enumerates every `(channel, bank, program)` a note plays through, in first-use order, and reports the backend:

- `'sf2'` — the loaded SoundFont covers the program (GS variation/drum fallbacks included), with the resolved `presetName`;
- `'synth'` — no preset covers it, so it plays through the NativeSynth GM fallback; `presetName` is empty.

Without a loaded SoundFont, every entry is a `synth` fallback. This is your honest coverage report: a `synth` row means "this part will sound, but from the data-free floor, not your samples". The fallback is still program-aware: for example, GM program 6 (Harpsichord) uses a Karplus-Strong plucked-string patch, while program 7 (Clavi) stays on an FM-style patch.

::: code-group

```typescript [Browser]
project.loadSoundFont(sf2Bytes);
for (const p of project.soundFontManifest()) {
  // { channel, bank, program, backend: 'sf2' | 'synth', presetName }
  console.log(`ch${p.channel} bank${p.bank} prog${p.program} -> ${p.backend} ${p.presetName}`);
}
// e.g. ch0 bank0 prog0 -> sf2 Piano 1
```

```python [Python]
project.load_soundfont(sf2_bytes)
for p in project.soundfont_manifest():
    # Sf2ProgramStatus(channel, bank, program, backend, preset_name)
    print(f"ch{p.channel} bank{p.bank} prog{p.program} -> {p.backend} {p.preset_name}")
```

:::

::: tip Drum channels report bank 128
A manifest row for channel 9 (MIDI channel 10, 1-based) reports `bank: 128` — the GS drum-kit bank. A covered kit resolves to `sf2`; otherwise the GM drum map from the fallback plays.
:::

## Bouncing MIDI through SF2 instruments

`bounceWithSf2Instrument(...)` compiles and renders the whole project, driving each bound MIDI destination through a GS-compatible SF2 player fed by the loaded SoundFont. It mirrors [`bounceWithBuiltinInstrument`](./project-bounce.md) but with sampled sounds. The render is **deterministic**: the same project, options, SoundFont, and patch produce bit-identical audio.

You bind a player to a MIDI **destination id** (the value you set with `setTrackMidiDestination`). The patch is an [`Sf2InstrumentConfig`](#instrument-config-and-the-voice-model) — every field is optional, so `{}` is a usable default.

::: code-group

```typescript [Browser]
import { init, Project } from '@libraz/libsonare';

await init();

const project = new Project();
try {
  project.setSampleRate(48000);

  // A one-note MIDI clip routed to destination 0.
  const { trackId, clipId } = project.addMidiClip(0, 4);
  project.setTrackMidiDestination(trackId, 0);
  project.setMidiEvents(clipId, [
    Project.midiNoteOn(0, 0, 0, 60, 100),   // ppq, group, channel, note, velocity
    Project.midiNoteOff(2, 0, 0, 60, 0),
  ]);

  project.loadSoundFont(sf2Bytes);

  // Bind a default SF2 player to destination 0, render 4096 frames of stereo.
  const audio = project.bounceWithSf2Instrument(
    { destinationId: 0, gain: 1 },
    { totalFrames: 4096, numChannels: 2, sampleRate: 48000 },
  );
  // audio is interleaved Float32Array (frames * channels)
} finally {
  project.delete();
}
```

```python [Python]
import libsonare as sonare

project = sonare.Project()
try:
    project.set_sample_rate(48000.0)

    track, clip = project.add_midi_clip(0.0, 4.0)
    project.set_track_midi_destination(track, 0)
    project.set_midi_events(clip, [
        sonare.Project.midi_note_on(0.0, 0, 0, 60, 100),
        sonare.Project.midi_note_off(2.0, 0, 0, 60, 0),
    ])

    project.load_soundfont(sf2_bytes)

    audio = project.bounce_with_sf2_instrument(
        sonare.Sf2InstrumentConfig(gain=1.0),
        destination_id=0,
        total_frames=4096, num_channels=2, sample_rate=48000,
    )
    # audio is a (frames, channels) float32 ndarray
finally:
    project.close()
```

:::

::: warning Empty bindings render silence
Passing an explicitly empty array `[]` (rather than a patch or `undefined`) binds **zero** instruments, so MIDI tracks render silent. To bind multiple destinations, pass an array of patches each carrying its own `destinationId`.
:::

::: tip MIDI never renders silent for lack of data
You can bounce with **no SoundFont loaded at all** — bound destinations still sound, because uncovered programs play through the NativeSynth GM fallback. The manifest tells you exactly which parts will use samples and which will use the fallback. See [NativeSynth](./native-synth.md) for the fallback engine.

That fallback is broad enough for practical previews: pianos use the extended waveguide piano sketch, guitars/basses/harp use Karplus-Strong models, strings use bowed-string or pizzicato/harp/timpani voices, choir/voice programs use a vocal body resonance, and GM 56-79 brass/reed/flute programs use provisional physical models. It is still a fallback, not a replacement for a carefully chosen SF2; calibration is ongoing, but missing programs no longer collapse to one generic tone.
:::

### Instrument config and the voice model

`Sf2InstrumentConfig` is the per-player patch. Every field is optional; a non-positive or omitted numeric field takes the C-ABI default.

| Field (JS / Python) | Meaning | Default |
|---------------------|---------|---------|
| `destinationId` / `destination_id` | MIDI destination this player answers to | `0` |
| `gain` | Master output gain, linear | `0.5` |
| `polyphony` | Max simultaneous voices, clamped to `[1, 64]` | `48` |

When the player runs out of voices it uses **deterministic voice stealing**, so a dense passage degrades the same way on every render.

## What the player implements

The player is a faithful SF2 synthesis core with a Roland-GS architecture layer on top. You do not call these features directly — they respond to the MIDI events, CCs, NRPNs, and SysEx in your arrangement — but knowing what is honored explains *why* a part sounds the way it does.

::: info SoundFont engine terms (you don't call these directly)
**TVF** (Time-Variant Filter) is the per-note filter and **TVA** (Time-Variant Amplifier) is its volume envelope. **NRPN** and **SysEx** are MIDI messages for extra or vendor-specific parameters. An **exclusive class** is the rule that one drum cuts off another — an open hi-hat is silenced the instant the closed hi-hat plays.
:::

### SF2 synthesis semantics

- **Preset / instrument zone layering** — a note resolves through the SF2 two-level zone structure (preset zones over instrument zones), so layered and split presets play correctly. Generators set sample selection, tuning, loop mode, and exclusive classes (e.g. a closed hi-hat cutting an open one).
- **DAHDSR envelopes** — separate volume and modulation envelopes with Delay/Attack/Hold/Decay/Sustain/Release stages.
- **LFOs** — a vibrato LFO and a modulation LFO change pitch/filter/amplitude per the SF2 generators.
- **Low-pass filter with velocity tracking** — initial cutoff and resonance, with velocity influencing brightness.
- **The SF2 default modulator set** — velocity, **CC7** (channel volume), and **CC11** (expression) apply a square-law gain; **CC1** (modulation wheel) changes vibrato depth; **CC91** (reverb send), **CC93** (chorus send), and **CC94** (delay send) feed the GS system-effects sends (see the GS architecture layer below). (A **CC** is one of MIDI's continuous "knob" control-change messages — see [MIDI Input](./midi-input.md).)
- **Pitch bend** — honored, with the bend range set by **RPN 0** (entered via Data Entry / RPN), so a part can request its own semitone range.

### The GS architecture layer

On top of GM, the player implements the Roland-GS extensions a GS-authored arrangement expects:

- **Variation-bank fallback** — a GS variation bank that the SoundFont does not cover falls back to the capital (bank-0) tone, so a missing variation still plays the right family instead of going silent.
- **Bank-128 drum kits on channel 10** — drum programs live in bank 128; channel 10 (index 9) is the drum part by convention.
- **NRPN part edits** — TVF cutoff/resonance, TVA envelope, and vibrato can be edited per part via NRPN, plus **per-note drum NRPNs** for individual drum sounds.
- **GS / GM SysEx** — **GS Reset**, **GM System On**, and "use for rhythm part" SysEx are recognized — both from the host and from SysEx events embedded inside an arrangement.
- **Send-return system effects** — one shared send-return bus behind all 16 parts, with **reverb**, **chorus**, and **delay** units. Each part's send amount is additive from two sources: the channel CC sends (**CC91** reverb, **CC93** chorus, **CC94** delay) and, for reverb and chorus only, the SF2 zone generators `reverbEffectsSend`/`chorusEffectsSend` layered on top (GS delay send is CC-only — there is no SF2 zone generator for it). At power-on the parts start with a musically audible default room (reverb send 40, chorus send 8), so a plain SMF that never sends a reset SysEx still has ambience. A separate per-part **drive** insert (gain-compensated saturation) sits alongside this bus — distinct from the single shared GS **insertion effect (EFX)** described below.
- **MIDI 2.0 / GM2** — the player decodes MIDI 2.0 banked Program Change and resolves the **GM2 Bank Select LSB** to the variation bank, so GM2-authored material maps to the right tone.

::: warning The SFX kit and GM Sound-Effects programs are not yet individually synthesized
The GS-style **SFX drum kit** (bank-128 kit 56) and the GM **Sound-Effects** programs (120-127, Guitar Fret Noise through Gunshot) are addressed and named by the player, but their per-note effect sounds are not yet individually synthesized in the data-free NativeSynth fallback: the SFX kit currently plays the Standard kit's voicing, and programs 120-127 share one generic noise-based voice. A SoundFont that supplies real samples for those addresses plays back normally through this SF2 player — the gap is in the fallback only. See [NativeSynth](./native-synth.md#the-gm-fallback-bank) for the built-in fallback voicing.
:::

### GS insertion effects (EFX)

::: info An original DSP re-creation, not bundled hardware data
libsonare's insertion effects are an original DSP re-creation — a combination of libsonare's own algorithms, reconstructed from publicly documented information, mapped onto the GS EFX SysEx and type-numbering model so GS-authored MIDI selects the effect the composer intended. Because the algorithms are independent, they follow the same addressing and effect structure but **do not reproduce the exact sound** of any hardware module; treat them as a compatible re-creation, not a 1:1 emulation. There are no bundled samples, ROM data, or firmware, and no affiliation with or endorsement by any hardware manufacturer. For the standards and literature behind this compatibility, see [Algorithm References](./algorithm-references.md).
:::

Separate from the reverb/chorus/delay send-return bus above, GS defines one **insertion effect (EFX)**: an effect inserted directly into a part's signal path, like a guitar pedal, rather than a send-return bus. libsonare implements this the way the hardware it follows does — as a **single shared insertion unit** for the whole player, not sixteen independent per-part effects. Any of the 16 parts can be routed through that one unit via a per-part on/off switch; a part that is switched off bypasses the unit entirely and reaches the mix dry.

There is **no typed "set EFX" call** in any binding. Like real GS hardware, the EFX type and its parameters are programmed exclusively by sending raw SysEx: live, you push those bytes with `RealtimeEngine.pushMidiSysex()`; offline, SysEx embedded in the arrangement's MIDI is realised inline during the bounce.

#### EFX type → insertion effect

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

#### Composite EFX types (multi-stage chains)

A composite EFX type realises as an ordered **chain** of the same DSP inserts running in series, matching the hardware's block structure — a guitar multi-effect, for example, still runs through the individual amp-sim/chorus/delay inserts above, just chained together. The table below is a representative slice; the full map covers the dual-stage `0x0200`–`0x020C` matrix (Overdrive / Distortion / Enhancer feeding Chorus, Flanger, or Delay) and the guitar / bass / Rhodes / keyboard multi presets in the `0x0400`–`0x0500` range.

| EFX type | GS EFX name | Chain (signal order) |
|---|---|---|
| 0x0200 | OD → Chorus | amp-sim → chorus |
| 0x0202 | OD → Delay | amp-sim → stereo delay |
| 0x0400 | Guitar Multi 1 | compressor → amp-sim → chorus → delay |
| 0x0405 | Bass Multi | compressor → amp-sim (bass cab) → EQ → chorus |
| 0x0406 | Rhodes Multi | enhancer → phaser → chorus → auto-pan |
| 0x0500 | Keyboard Multi | ring-mod → EQ → pitch-shifter → phaser → delay |

#### Live vs. offline realisation

- **Offline (bounce)** — EFX SysEx embedded in the arrangement is applied inline during the render: an EFX change mid-bounce takes effect on the next block.
- **Live** — `pushMidiSysex()` builds the new effect chain off the audio thread and hands it over wait-free, so a live engine hears an EFX change **without stopping** playback.

The demo below toggles a GS insertion effect on and off over the same phrase, so you can hear how each one reshapes the tone.

<SonareDemo id="gs-efx" />

::: tip Author GS banks with the MIDI helpers
`Project.midiBankProgram(ppq, group, channel, bankMsb, bankLsb, program)` expands a bank-select-plus-program-change into the MIDI events `setMidiEvents` accepts — the right way to select a GS variation or a drum kit. Static helpers like `Project.gmInstrumentName(program)`, `Project.gmDrumName(note)`, `Project.gm2InstrumentName(bankLsb, program)`, and `Project.midiCcName(controller)` name the slots so your authoring code reads clearly. The reverse direction is symmetric: `Project.gmProgramForName(name)`, `Project.gmDrumNoteForName(name)`, and `Project.midiCcIndexForName(name)` return the number for a canonical name (`-1` when unknown), while `Project.gmFamilyName(family)` and `Project.gmFamilyFirstProgram(family)` enumerate the 16 GM instrument families. `Project.gm2DrumSetName(bankLsb)` and `Project.gm2DrumName(bankLsb, note)` name the GM2 drum-set variations.
:::

## Live engine playback

For a keyboard or a live MIDI stream, bind the SF2 player to a realtime MIDI destination with `setSf2Instrument(...)`. The engine routes live note/CC commands and scheduled MIDI clips for that destination through the player, with the same 16-channel, channel-10-drum, GS-NRPN, and GS/GM-SysEx behavior. Load the SoundFont into the **engine** first (a separate load from the project's).

```typescript
import { init, RealtimeEngine } from '@libraz/libsonare';

await init();

const engine = new RealtimeEngine(48000, 128);   // sampleRate, maxBlockSize
try {
  engine.loadSoundFont(sf2Bytes);                // engine-level load
  engine.setSf2Instrument({ gain: 1 }, 7);       // bind player to destination 7
  engine.midiInstrumentCount();                  // 1

  // Feed a live note, then render a block.
  engine.pushMidiNoteOn(7, 0, 0, 60, 100);       // destinationId, group, channel, note, velocity
  const [left, right] = engine.process([new Float32Array(128), new Float32Array(128)]);

  engine.clearMidiInstrument(7);                 // unbind
} finally {
  engine.destroy();
}
```

::: tip Binding before loading is allowed
You can call `setSf2Instrument(...)` before any SoundFont is loaded — live MIDI then plays through the NativeSynth GM fallback. Load a SoundFont later and bound destinations begin using its samples. See [MIDI Input](./midi-input.md) for wiring live keyboards and Web MIDI.
:::

## Recipes

:::: details Inspect coverage, then bounce
Load your SF2, check the manifest for any `synth` rows (parts that will use the fallback), then render.

```typescript
project.loadSoundFont(sf2Bytes);
const uncovered = project.soundFontManifest().filter((p) => p.backend === 'synth');
if (uncovered.length) {
  console.warn('Falling back to NativeSynth for:', uncovered);
}
const audio = project.bounceWithSf2Instrument(
  { destinationId: 0, gain: 1 },
  { totalFrames: 4096, numChannels: 2, sampleRate: 48000 },
);
```
::::

:::: details Multitimbral: melody + drums in one bounce
Route a melodic track to one destination and a drum track (channel 10, bank 128) to another, then bind a player to each.

```typescript
// Drum part: bank 128 program 0 on channel 10 (index 9).
project.setMidiEvents(drumClipId, [
  ...Project.midiBankProgram(0, 0, 9, 0, 0, 0),
  Project.midiNoteOn(0, 0, 9, 36, 110),   // 36 = Bass Drum 1
  Project.midiNoteOff(1, 0, 9, 36, 0),
]);

const audio = project.bounceWithSf2Instrument(
  [{ destinationId: 0, gain: 1 }, { destinationId: 1, gain: 1 }],
  { totalFrames: 8192, numChannels: 2, sampleRate: 48000 },
);
```
::::

:::: details Render even without an SF2
With no SoundFont loaded, the bounce still sounds via the NativeSynth GM fallback — useful for a quick preview before you ship instrument data.

```typescript
const preview = project.bounceWithSf2Instrument(
  {},   // default patch; nothing loaded -> GM fallback for every program
  { totalFrames: 4096, numChannels: 2, sampleRate: 48000 },
);
```
::::

## Related

- [NativeSynth](./native-synth.md) — the data-free GM fallback engine that keeps MIDI from going silent
- [Project Bounce](./project-bounce.md) — offline rendering of a project, including the builtin/synth bounce siblings
- [MIDI Input](./midi-input.md) — live keyboards, Web MIDI, and realtime engine routing
- [Project Editing](./project-editing.md) — building the MIDI tracks and clips you render
- [Recording and Takes](./recording-and-takes.md) — capturing performances into the project
