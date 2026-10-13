# Mastering

Masters a local stereo file on libsonare's realtime engine. The page plays the
master chain live in an AudioWorklet and exports it from a Worker with the same
operations, so what you hear is what the WAV contains. Nothing is uploaded.

- Page: `/mastering` — https://libsonare.libraz.net/mastering
- Entry: `MasteringDemo.vue` (Quick and Studio over one project state)

## How it is put together

| File | Role |
| --- | --- |
| `masteringState.ts` | The project state, its mutators, session JSON and the earlier preset format |
| `masteringEngine.ts` | State → engine ops: three lanes (After, Before, Reference), the 13-slot insert column, the export render and the loudness fit |
| `masteringPresetMap.ts`, `masteringMacros.ts` | Quick genre × venue presets and the Tone / Width / Dynamics / Ceiling macros |
| `mastering.worker.ts`, `masteringWorkerClient.ts` | Repair detection (`masteringRepairAnalyze`) and preprocess (`masteringRepairApply`), loudness fit, export, the lane loudness for the A/B match, assistant, reference analysis at the reference's own rate |
| `useMastering.ts` | Page controller: history, engine apply, audio registry, Worker jobs |
| `useMasteringMetering.ts` | Engine meter telemetry plus the analyser tap for spectrum and goniometer |
| `useMasteringSession.ts` | localStorage persistence |
| `masteringUi.ts`, `masteringCopy.ts` | Static definitions and the en/ja copy |
| `masteringInsightLabels.ts` | The assistant's notes and the settings it could not apply, in the page's words |

Every edit is one mutator committed to `useHistory`; the history's change
stream is diffed into engine operations (`src/utils/engineApply.ts`), saved,
and sent to the Worker when exporting. A parameter the engine cannot change
while running rebuilds the inserts, so the UI applies it on release.

`yarn check:mastering` renders every Quick preset through the export path and
checks that it reaches its loudness target under its true-peak ceiling.
