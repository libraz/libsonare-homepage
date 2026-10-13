# Piano Transcription

A piano recording turned back into notes. The waveform sits above a piano roll
on one time axis. The visitor sets the detector and starts each run; every run
after the first marks the notes that appeared and disappeared against the run
before it, and lists the settings that changed. The notes play back through the
built-in acoustic piano, switchable against the original on one clock.

- Page: `/transcribe` — https://libsonare.libraz.net/transcribe
- Entry: `TranscribeDemo.vue`
- Engine: `transcribe`, then `Project.bounceWithSynthInstrument('acoustic-piano')`
  and `Project.exportSmf` for the download.

`transcribe.worker.ts` runs one request end to end and replies twice: the notes
as soon as they exist, then the rendered piano and the MIDI file.
`detectorSettings.ts` maps each knob to its `TranscribeOptions` field and sends
a path only the fields it reads. `transcribedNotes.ts` reads the event list into
notes and compares two runs; `rollPainter.ts` draws both lanes, and
`useAbPlayback.ts` keeps the original and the piano on one clock.

The sample at `src/public/transcribe/sample-piano.mp3` is a piano piece
generated with Suno. Its tags, cover art and encoder header were stripped; the
audio frames are the original stream, unchanged.
