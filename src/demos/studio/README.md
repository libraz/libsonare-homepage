# Studio Mini

A DAW session driven entirely through the engine API: step-sequence three
tracks, mix them, and bounce the loop to WAV. There is no GUI on the engine side
— this page is the GUI.

- Page: `/studio` — https://libsonare.libraz.net/studio
- Entry: `StudioDemo.vue`
- Engine: `RealtimeEngine` lane mixer for playback and the bounce, `Project`
  for the display stems and the MIDI export.

`useStudioEngine.ts` runs the loop live in the engine worklet; `studioBounce.ts`
renders the same lane mix (strips, mutes, master limiter) offline, so a bounce
is deterministic rather than a recording of playback.
