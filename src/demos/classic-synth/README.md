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
editable field — range, unit, and whether its knob travels logarithmically. The
deck modules, the playground and the URL state all read it.

## One instrument, annotated

The page is a single deck seen head-on, with the chapters printed over it. A
chapter names the modules it is about; the deck dims the rest and floats the
chapter's prose as a card over a part of the deck the chapter is not about. The
deck's first row has a fixed height and the card is placed by grid lines, so
nothing on the instrument moves when the chapter changes.

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
| `classicSynthChapters.ts` | The deck's modules, the chapters, and where each card sits |
| `classicSynthCopy.ts` | The label vocabulary every component shares |
| `useClassicSynth.ts` | Bounce, playback, the render cache, WAV/MIDI export |
| `ClassicSynthDemo.vue` | The screen: the deck, the annotation card, the transport |
| `SynthModule.vue` | One deck module: the legends, switch banks and knobs of its groups |
| `SynthPatchbay.vue` | The source × destination patchbay in the deck's matrix area |
| `SynthChapters.vue` | The chapters and their comparisons, as the card's body |
| `SynthPlayground.vue` | Free editing, presets, and the export buttons |
| `classicSynth.css` | The plate, the deck grid, and the page's own tokens |

## Phrases

A phrase is a few notes and, optionally, controller ramps. Each chapter picks
the one that reveals its axis: a sustained note for anything about timbre,
short notes for envelope shapes, a long note under moving controllers for the
mod matrix — a routing from a gesture source has nothing to follow otherwise.

Phrases live in `classicSynthState.ts` so a chapter names one rather than
carrying its own notes, and so two chapters comparing different axes are still
comparing them on the same material.
