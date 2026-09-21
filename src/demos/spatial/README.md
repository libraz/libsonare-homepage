# Spatial Room Scanner

Estimates the room a recording was made in — geometry, RT60, clarity and how far
the source was — and renders it as a 3D scene. One recording is enough; a
measured impulse response is used directly when there is one.

- Page: `/spatial` — https://libsonare.libraz.net/spatial
- Entry: `SpatialScanner.vue`
- Engine: `detectAcoustic` and `estimateRoom` for blind estimates,
  `analyzeImpulseResponse` for a measured IR, `synthesizeRir` and `roomMorph`
  for the audition path.

`spatial.worker.ts` does the estimation and the morph render; `RoomScene.vue`
draws the room. A mono source carries no bearing, so the estimated position is
shown as a distance shell rather than a point.
