# classic-synth

`/classic-synth` — what this engine's subtractive synthesizer is made of, read
as chapters with one voice shared between them.

The page borrows a shape that works for teaching a synthesizer: short chapters,
a single engine every chapter edits, and a playground at the end. What it
teaches is this engine, not synthesis in general, so the chapters are built
around the axes this engine actually has.

## One patch, fully resolved

Every chapter edits the same patch, and that patch holds a real number in every
field — never a "keep whatever the preset had" sentinel. The engine is what
makes that possible: `synthPresetPatch(name)` returns a preset with all of its
fields filled in, so loading a preset is copying resolved values in rather than
layering overrides on something unnamed.

It matters for the prose. A chapter that says *this is the cutoff* can only be
believed if the number on screen is the number the engine uses. A patch half
made of absent keys can only be explained by describing the thing it inherits
from, and there is no room in a chapter for that.

`CLASSIC_PARAMS` in `classicSynthState.ts` is the one description of every
editable field — range, unit, and whether its fader travels logarithmically.
The deck sections, the playground and the URL state all read it.

## One instrument, in two decks

The page is a front panel in the grammar of an early-1980s analogue polysynth:
two horizontal decks divided by one warm hairline. The upper deck is the voice —
eight sections side by side on one plate (LFO, DCO, HPF, VCF, ENV-A, ENV-F,
BODY, OUT), every amount a vertical fader and every choice a row of small keys.
The lower deck is the strip: a recessed display holding the chapter's number and
name with its prose and comparisons below, the assign block (the mod matrix,
closed to a legend and its routings until a chapter or the reader opens it), and
the program keys that step the chapters and carry the transport.

A chapter names the sections it is about; those keep their lamp lit and an
outline, and the rest dim. The prose covers nothing — a shallow fader bank
cannot afford to be covered — so nothing on the instrument moves or hides when
the chapter changes.

`DECK_MODULES` in `classicSynthChapters.ts` lists each section's faders
explicitly, because the panel cuts the `filter` group two ways (HPF and VCF).
Section membership is still checked against the parameter groups at load. The
faders themselves are `SynthFader.vue`, a sibling of the shared `RotaryKnob`
with the same props and keyboard contract.

## Why every chapter renders offline

A chapter asks a reader to hear one axis: four filter models on the same note, a
routing added and taken away. That comparison is only honest when the two
renders differ in nothing else, and `bounceWithSynthInstrument` is deterministic
for a fixed project, options and patch — the second render of a variant is the
first one again, to the bit.

A live voice cannot promise that. It is also already what `/synth` is: a
keyboard you play. This page is the explanation beside it, and the two should
not be the same demo twice.

Renders are cached by patch and phrase, because clicking back and forth between
two variants is the listening method the whole page is built around.

## Files

| File | What it owns |
| --- | --- |
| `classicSynthState.ts` | The patch type, the parameter table, the phrases |
| `classicSynthChapters.ts` | The deck's sections and their faders, and the chapters |
| `classicSynthCopy.ts` | The label vocabulary every component shares, including the silkscreen captions |
| `useClassicSynth.ts` | Bounce, playback, the render cache, WAV/MIDI export |
| `ClassicSynthDemo.vue` | The panel: the voice deck, the hairline, the strip |
| `SynthModule.vue` | One section: its legend and lamp, its key rows and its fader bank |
| `SynthFader.vue` | The vertical fader every amount on the panel uses |
| `SynthPatchbay.vue` | The assign block: the source × destination grid, closed or open |
| `SynthChapters.vue` | The chapters and their comparisons, as the display's body |
| `SynthPlayground.vue` | Free editing, presets, and the export buttons |
| `classicSynth.css` | The plate tokens, both decks, keys and the display |

## Phrases

A phrase is a few notes and, optionally, controller ramps. Each chapter picks
the one that reveals its axis: a sustained note for anything about timbre,
short notes for envelope shapes, a long note under moving controllers for the
mod matrix — a routing from a gesture source has nothing to follow otherwise.

Phrases live in `classicSynthState.ts` so a chapter names one rather than
carrying its own notes, and so two chapters comparing different axes are still
comparing them on the same material.
