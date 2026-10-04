# Mixing Studio

An eight-track console on libsonare's realtime engine: arrangement with clip
edits and automation, channel strips with EQ, dynamics, sends, pan, width and
VCA groups, Reverb and Delay returns, a master section with live loudness
metering, a mix assistant to A/B against, and a bounce that renders exactly
what plays.

- Page: `/mixing` — https://libsonare.libraz.net/mixing
- Entry: `MixingStudio.vue`
- Engine: `SonareEngine` (worklet facade) for playback and meters, a raw
  `RealtimeEngine` in `mixing.worker.ts` for the bounce, `suggestMixScene` for
  the assistant.

One project state (`mixingState.ts`, v2) is the single source. The UI changes
it only through the mutators listed there; `useMixingStudio.ts` commits each to
the undo history, saves it to localStorage, and sends the op diff from
`mixingEngine.ts` to the live engine. The export Worker builds the same state
from scratch, so preview and bounce match.

| File | Role |
| --- | --- |
| `useMixingStudio.ts` | Controller: history, engine sync (A/B audition, channel-delay hold), audio loading and budget, Worker jobs, project files |
| `useMixingMetering.ts` | Meter telemetry per strip and bus, master scope tap, the selected track's spectrum |
| `useMixingSession.ts` | localStorage persistence of the project state |
| `mixingUi.ts` | Fader taper, control ranges, export options, automation readout, meter targets |
| `mixingEqResponse.ts` | Strip EQ curves from the engine's equalizer |
| `MixArrangement.vue` | Transport, clips, automation lane |
| `MixConsole.vue`, `MixStrip.vue`, `MixBusStrip.vue` | The console row |
| `MixMasterSection.vue` | Glue, Limiter, master fader and meters |
| `MixInspector.vue`, `MixEqEditor.vue`, `MixDynamicsEditor.vue` | The selected strip in detail |
| `MixAssistantPanel.vue`, `MixExportPanel.vue` | Auto-mix A/B, bounce and project JSON |
| `MixFader.vue`, `MixKnob.vue`, `MixParam.vue`, `MixEqCurve.vue` | Controls |
| `mixingCopy.ts`, `mixingTerms.ts` | English and Japanese copy, glossary links |
| `mixingProjectV1.ts`, `mixingTypes.ts` | Reading the earlier v1 project file |
