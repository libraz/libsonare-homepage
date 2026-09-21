# Studio Mini

A DAW session driven entirely through the engine API: step-sequence three
tracks, mix them, and bounce the loop to WAV. There is no GUI on the engine side
— this page is the GUI.

- Page: `/studio` — https://libsonare.libraz.net/studio
- Entry: `StudioDemo.vue`
- Engine: `Project` for the session, its offline render for the bounce.

`useStudioEngine.ts` boots the project and renders offline, so a bounce is
deterministic rather than a recording of playback.
