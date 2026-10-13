# Music Analysis Studio

Runs a full analysis pass over a local file and lays the result out on one
timeline: sections, chords, key, beats, melody, loudness, plus chroma, CQT and
spectrogram views.

- Page: `/music-analysis` — https://libsonare.libraz.net/music-analysis
- Entry: `MusicAnalysisStudio.vue`
- Engine: `analyzeWithProgress` (with `computeTempoCurve`, `adaptiveTempo` and
  `tuning: 'auto'`, so the result carries `beatLocalBpm`, `tuning` and a
  `romanNumeral` on every chord), `tuningToReferenceHz`, `downmix`,
  `melSpectrogram`, `lufsInterleaved`, `momentaryLufs`, `shortTermLufs`, and the
  `metering*` family for true peak, clipping, DC offset, stereo width and
  correlation.

`music-analysis.worker.ts` does the analysis and downsamples long or high-rate
files first; `musicAnalysisViewModel.ts` turns the raw report into the rows the
timeline and the heatmaps render, including the local-tempo lane.
