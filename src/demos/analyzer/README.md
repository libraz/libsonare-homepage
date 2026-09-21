# Visual Player

Plays a local audio file and draws what libsonare hears from it while it plays:
spectrum, chroma, BPM, key and chords. The file never leaves the browser.

- Page: `/analyzer` — https://libsonare.libraz.net/analyzer
- Entry: `AnalyzerDemo.vue`, which frames `AudioAnalyzer.vue` in the shared tool
  shell. `AudioAnalyzer.vue` is also registered globally so docs pages can embed
  the player.
- Engine: `analyzeWithProgress`, `detectBpm`, `detectBeats`, `chroma`,
  `melSpectrogram`, `rmsEnergy`, and `StreamAnalyzer` for the live views.

`useAudioAnalysis.ts` runs the one-shot analysis, `useStreamAnalyzer.ts` feeds
the meters during playback, and `SynesthesiaVisualizer.vue` turns the chroma and
spectral frames into the colour field behind the readouts.
