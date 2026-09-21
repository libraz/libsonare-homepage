# Mastering Studio

Masters a local file to a loudness target: EQ, dynamics, repair, limiting and
reference matching, with broadcast-grade LUFS and true-peak metering. Rendering
happens in the browser, so nothing is uploaded.

- Page: `/mastering` — https://libsonare.libraz.net/mastering
- Entry: `MasteringDemo.vue`
- Engine: `masteringChainStereoWithProgress`, `masteringPairAnalyze`,
  `masteringPairProcess`, `masteringStreamingPreviewStereo`.

`useMastering.ts` owns the session and drives `mastering.worker.ts`, which keeps
offline rendering off the UI thread. The Quick presets and venue targets live in
`masteringUi.ts` and are validated against the documentation by
`yarn check:mastering` and `yarn check:mastering-docs`.
