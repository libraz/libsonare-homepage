# Visual Player

Plays a local audio file and draws what libsonare hears from it while it plays:
spectrum, chroma, BPM, key and chords. The file never leaves the browser.

- Page: `/analyzer` — https://libsonare.libraz.net/analyzer
- Entry: `AnalyzerDemo.vue`, which frames `AudioAnalyzer.vue` in the shared tool
  shell. `AudioAnalyzer.vue` is also registered globally so docs pages can embed
  the player.
- Engine: `StreamAnalyzer` for the live BPM, key, and chord readings;
  `detectBeats`, `chroma`, `melSpectrogram`, `rmsEnergy`, and `estimateTuning`
  for the waveform and visual field.

`useStreamAnalyzer.ts` feeds the readings during playback. Beat markers come
from the loaded file, while `SynesthesiaVisualizer.vue` turns chroma and
spectral frames into the colour field behind the readouts. Full-file structure
and meter analysis are on `/music-analysis`.

Each load estimates how far the file sits from A440 and hands the stream
analyzer that reference pitch (`setTuningRefHz`), so a detuned recording still
reads in its own key. The offline chroma, key and chord calls take no tuning
argument, which is why the correction lives on the stream analyzer.
