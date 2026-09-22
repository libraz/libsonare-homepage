# Mixing Studio

An eight-track stem mixer: faders, pan, width, sends and metering, with the
scene readable as JSON and the mix bounceable to WAV.

- Page: `/mixing` — https://libsonare.libraz.net/mixing
- Entry: `MixingStudio.vue`
- Engine: `Mixer` for routing and bounce, `lufsInterleaved` and
  `meteringTruePeakDb` for the master readouts.

`useMixingStudio.ts` holds the console state, `mixingScene.ts` is the scene JSON
shape documented on the site, and `mixing.worker.ts` renders the bounce, running
past the dry input for the tail and latency the mixer reports for its own graph.
