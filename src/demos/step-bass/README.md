# step-bass

A sixteen-step monophonic bass machine, self-designated `SB-1`. One oscillator
into a diode-ladder lowpass, an envelope that opens the filter, and per-step
accent and slide, all driven by the engine's own transport rather than by
anything scheduled in JavaScript.

The panel's rule is that every control moves the sound. There is no knob for a
parameter the engine does not have, and no flag that can be set where the
engine would ignore it — where a flag genuinely cannot apply, the cell says so
instead of accepting the click.

## What is live and what waits

The pattern and the knob positions compile to one plain-JSON value that the
worklet applies. After that, a knob takes the shortest route that reaches the
engine:

| Control | Reaches the sound |
| --- | --- |
| CUTOFF, RESONANCE, ENV MOD, TUNING, VOLUME | Immediately, inside the note already sounding |
| ACCENT | Brightness immediately; the louder strike and the shortened decay at the next note |
| DECAY | At the next note |
| VCO | At the next step boundary that strikes a note |
| TEMPO | Immediately, keeping the position in the loop |

The waveform is the one that cannot be instant. Changing it rebinds the
instrument, which would cut a sounding note in half, so the processor waits for
a boundary where a new note starts anyway. Nothing on the panel claims
otherwise.

## Three things the panel has to admit

**Step 16's slide moves pitch and nothing else.** An event past the loop end
never fires, and the rewind releases whatever voice is sounding, so the last
step cannot slur into the first. The pitch still glides, because the glide lane
is read at the note-on that step 1 makes on its own. The cell is drawn with a
broken tail and the selected-step readout spells the limit out.

**An accent on a hold or a rest does nothing.** Velocity is latched at a
note-on, and neither of those gates has one. Those cells read as unavailable
rather than as a switch that can be thrown to no effect — a control that moves
and changes nothing is the failure this page was rebuilt to remove.

**The filter display is a measured response, not the CUTOFF reading.** The
engine returns no response of its own, so the curve is computed — but it is
fitted to a rendered noise pass and pinned there by a test, and what that
measurement says is that the audible corner sits well below the number on the
knob, further below the lower the resonance is. The display marks the corner
where the curve actually turns.

The meter is peak only. The master chain ends in a true-peak limiter, but the
engine does not publish that limiter's gain reduction, and a meter with nothing
behind it would be worse than none.

## The accent memory, and when it is audible

A run of accents builds on itself: each accented step carries some of the one
before it, decaying with a 47 ms time constant, and the accumulated value rides
the velocity so the run grows louder and brighter together.

At 120 BPM a sixteenth is 125 ms, by which point almost nothing of the previous
accent is left. The effect only becomes audible somewhere above 160 BPM. Below
that, two accents in a row sound like two accents — that is the instrument
behaving correctly, not a control failing to work.

## Language

The silkscreen is English in every locale. It names circuit roles — `VCO`,
`CUTOFF`, `ENV MOD`, `SLIDE` — and a role is the same role on any bench, so
translating the legends would make two machines out of one. Everything that
explains rather than labels is carried in both languages in `stepBassCopy.ts`,
including each control's accessible name.

No product or company names appear anywhere on the page. A filter is named by
its circuit topology and a control by what it reaches.

## Layout

At 900 px and above all three displays stand at once; below that a segmented
control puts up one at a time and the deck keeps its height. Below 700 px the
sixteen steps fold into two banks of eight, because sixteen cells across a
375 px screen leaves about 23 px each.

The grid is walked with the arrow keys in both directions. Accent and slide are
told apart by shape — a ring and an arrow — so the lanes still read when the
colours are taken away, and the only element that takes the pointer away from
scrolling is the pitch cell, which is the one thing dragged. A reduced-motion
preference stops the playhead loop and leaves the readouts to update from the
meter.

## Files

| File | What it owns |
| --- | --- |
| `stepBassTypes.ts` | The pattern, the knobs, the compiled form, the worklet messages |
| `stepBassPatch.ts` | The base patch, the accent model, every knob range |
| `stepBassCompile.ts` | Pattern and knobs to the clip, the lanes and the loop |
| `stepBassApply.ts` | The one apply sequence both the live path and the export use |
| `stepBassProcessor.ts` | The worklet source, with the engine inside it |
| `useStepBassEngine.ts` | Boot, teardown, commands, and the analyser tap |
| `stepBassPatterns.ts` | The factory patterns, the generator, the URL codec |
| `stepBassFilterCurve.ts` | The plotted response, fitted to a rendered noise pass |
| `stepBassExport.ts` | WAV through the same path that was heard, and the MIDI file |
| `stepBassCopy.ts` | The silkscreen table and the two locales' prose |
| `StepBassDemo.vue` | State, the engine wiring, the URL, the one animation loop |
| `StepBassPanel.vue` | The knobs in signal order, the waveform keys, the transport |
| `StepGrid.vue` | The sixteen steps, their four lanes, and the selected-step readout |
| `StepBassViews.vue` | The scope, the filter response and the output meter |
| `stepBass.css` | The plate, the grid, the displays, and this panel's own tokens |
