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

Response length follows the room's own Sabine reverberation time rather than a
fixed number, so a large room is not heard with its decay cut short. An
auditioned impulse gets the whole decay — it *is* the decay. A morph's tail is
capped shorter and runs over an excerpt of the loaded content, because
convolution costs the product of the two lengths and the wait is the visitor's.

The engine warns about a tail cut whenever it cuts anything, even a tail already
a hundred decibels down. `renderNotes.ts` works out how far into the decay the
cut landed (60 dB × cut ÷ RT60, the same Sabine RT60 that sized the tail) and
shows the cut only while the decay was still running: in practice a cathedral
morph, about 38 dB down. Every other synthesis diagnostic is always shown.

What the demo rendered can be saved: the auditioned impulse as a mono WAV (a
convolution IR), a morph as a stereo one, and the estimate as JSON. An untouched
upload is not offered back — handing a visitor their own file is not an export.
The JSON reports the source *distance* and no coordinates, because one channel
resolves how far the source is and not which way.
