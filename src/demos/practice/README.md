# Piano Practice

Falling notes scroll toward a full-range keyboard that lights as each note
lands, and a rhythm game scores what you play over Web MIDI. Audio is rendered
on-device from a single-track MIDI file, so a passage can be re-rendered slower
without changing pitch.

- Page: `/practice` — https://libsonare.libraz.net/practice
- Entry: `PianoPracticeDemo.vue`
- Engine: `Project`, rendering the MIDI through the built-in synth or a
  SoundFont.

`bounce.worker.ts` renders offline and `audioBufferCache.ts` keeps the result so
a repeat does not re-render. `rollPainter.ts` draws the note roll; scoring lives
in `useRhythmGame.ts`. MIDI input comes from the shared
`@/composables/useMidiInput`.

The loaded movement is mirrored in the `mv` query parameter (0 the Aria, 1–30
the variations, 31 the da capo), so a link opens on a given variation. Each load
takes a generation number and a superseded fetch drops its result, so stepping
through movements quickly lands on the last one asked for.
