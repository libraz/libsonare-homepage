---
title: Offline Monophonic Vocal Editing
description: Practical guide to libsonare's offline monophonic vocal session API — analysis, pitch edits, drafts, undo/redo, rendering, persistence, Worker execution, and applying a vocal result to a Project.
---

# Offline Monophonic Vocal Editing

The vocal edit API turns one mono vocal recording into an editable note model. It analyzes the source, exposes note pitch and timing, applies pitch/formant/amplitude edits transactionally, and renders the edited source without an audio device or realtime engine. The Node, browser/WASM, and Python bindings expose the same session model.

Use a `VocalEditSession` for a vocal take that needs offline correction. Use a session together with `Project.applyVocalEdit()` when the result belongs to an arrangement. This API accepts one monophonic line; it does not separate overlapping voices or replace a polyphonic source editor. For realtime input, use the [realtime voice changer](./realtime-voice-changer.md).

::: info Before you start
This page uses the pitch vocabulary without re-explaining it. **F0** is the fundamental frequency of the voice at each moment, measured per analysis frame by a pitch tracker (pYIN by default); a frame is **voiced** when the singer is producing a pitched sound. Pitch differences are in **cents**, hundredths of a semitone. [Editing Basics](./glossary/concepts/editing-basics.md) covers semitones and MIDI note numbers, [Melody and Pitch](./glossary/analysis/melody-pitch.md) covers F0 tracking, and [Voice and Formant](./glossary/editing/voice-formant.md) covers formants.
:::

The vocal edit surface is exposed through the Node, browser/WASM, and Python bindings. On the CLI, `sonare vocal-notes` lists the notes a session finds in a take, with the session's analysis settings as options; editing and rendering a session have no CLI command.

<FlowDiagram
  title="Vocal edit lifecycle"
  :nodes="[
    { id: 'source', label: 'Mono PCM', col: 0, row: 0 },
    { id: 'session', label: 'Create / restore session', col: 1, row: 0, variant: 'accent' },
    { id: 'analysis', label: 'Notes and pitch analysis', col: 2, row: 0 },
    { id: 'draft', label: 'Draft operations', col: 3, row: 0 },
    { id: 'commit', label: 'Commit revision', col: 4, row: 0, variant: 'accent' },
    { id: 'render', label: 'Render full source or range', col: 5, row: 0, variant: 'success' },
    { id: 'project', label: 'Apply to Project', col: 6, row: 0 }
  ]"
  :edges="[
    { from: 'source', to: 'session' },
    { from: 'session', to: 'analysis' },
    { from: 'analysis', to: 'draft' },
    { from: 'draft', to: 'commit' },
    { from: 'commit', to: 'render' },
    { from: 'render', to: 'project' }
  ]"
  caption="Analysis is read from a session, edits are committed as revisions, and a committed render can be attached to a Project."
/>

## Create and inspect a session

The input is a mono `Float32Array` and a sample rate from 8,000 through 384,000 Hz. The following deterministic source also supplies analysis, so it is useful for a smoke test and does not depend on the analyzer's heuristics. Omit `analysis` to let libsonare analyze the source with its built-in pYIN path.

::: code-group

```typescript [Browser / WASM]
import {
  createVocalEditSession,
  init,
  vocalEditAvailable,
} from '@libraz/libsonare';

await init();
if (!vocalEditAvailable()) throw new Error('This WASM build has no vocal edit API');

const sampleRate = 16_000;
const samples = new Float32Array(4096);
for (let i = 0; i < samples.length; i += 1) {
  samples[i] = 0.25 * Math.sin((2 * Math.PI * 440 * i) / sampleRate);
}

const frameLengthSamples = 256;
const hopLengthSamples = 128;
const frameCount = Math.ceil(samples.length / hopLengthSamples) + 1;
const session = createVocalEditSession({
  samples,
  sampleRate,
  frameLengthSamples,
  hopLengthSamples,
  analysis: {
    frameOriginSample: 0,
    samplesPerFrame: hopLengthSamples,
    frameLengthSamples,
    f0Hz: new Float32Array(frameCount).fill(440),
    voiced: new Uint8Array(frameCount).fill(1),
    algorithmId: 'libsonare.pyin',
    algorithmVersion: 1,
  },
});

try {
  const { notes, transitions } = session.notes();
  const analysis = session.analysis();
  console.log(notes.length, transitions.length, analysis.sourceLengthSamples);
} finally {
  session.dispose();
}
```

```typescript [Node]
import { createVocalEditSession, vocalEditAvailable } from '@libraz/libsonare';

if (!vocalEditAvailable()) throw new Error('This build has no vocal edit API');
const session = createVocalEditSession({ samples, sampleRate });
try {
  console.log(session.notes().notes);
} finally {
  session.dispose();
}
```

```python [Python]
import numpy as np
from libsonare import create_vocal_edit_session, vocal_edit_available

if not vocal_edit_available():
    raise RuntimeError('This build has no vocal edit API')
sample_rate = 16_000
samples = (0.25 * np.sin(2 * np.pi * 440 * np.arange(4096) / sample_rate)).astype(np.float32)
with create_vocal_edit_session(samples, sample_rate) as session:
    notes, transitions = session.notes()
    rendered = session.render()
    state = session.export_state()
    print(len(notes), len(transitions), rendered.samples.size, len(state))
```

:::

Gate on `vocalEditAvailable()` and read the API version with `vocalEditApiVersion()` (Python `vocal_edit_api_version()`, C `sonare_vocal_edit_api_version`); `session.capabilities().apiVersion` reports the same counter. It is separate from the engine's ABI counters. A session, draft, snapshot and render job each release their handle with `dispose()`, `delete()` or `destroy()`, and also through `Symbol.dispose`, so `using session = createVocalEditSession(...)` works where the runtime supports explicit resource management.

`session.notes()` returns notes and pitch transitions. A note contains its source span, analysis-frame span, median frequency, center MIDI note (`centerMidi`), pitch stability, amplitude samples, and the current edit. The center is measured from an F0 refined against the audio and averaged over whole vibrato cycles, leaving out the glides at either end, so it is not limited to the pitch tracker's 10-cent steps and a `center` target lands on the pitch you asked for. `session.analysis()` returns the F0 and voiced arrays, the analysis grid, algorithm metadata, source digest, and settings. `session.capabilities()` reports the profile, the monophonic constraint, whether analysis cancellation is supported by the loaded profile, and the available formant-shift range. Read those values instead of baking profile limits into a UI.

The Python binding uses snake_case method names, exposes those counters as Python integers, and closes a session at the end of a `with` block.

`evaluatePitch(noteId)` returns measured, target, effective, and voiced arrays for a note. The coordinate mapping methods convert between source and destination samples after a timing edit.

### Session options

Every option is optional. `analysis` supplies your own F0 track instead of running the built-in pYIN path; the rest tune that analysis, the note segmentation and the render.

| Option | Default | Meaning |
|--------|---------|---------|
| `frameLengthSamples` / `hopLengthSamples` | `2048` / `512` | pYIN analysis frame and hop, in samples |
| `fminHz` / `fmaxHz` | `65` / `2093` | Pitch search range in Hz |
| `yinThreshold` | `0.1` | pYIN absolute threshold |
| `voicedThreshold` | `0.5` | Voicing probability at or above which a frame counts as voiced |
| `centered` | `true` | Center each analysis frame on its hop position |
| `segmentationThresholdCents` | `50` | Pitch change that starts a new note. A held note with vibrato stays one note, and a short fragment after a glide is not split off |
| `minNoteMs` | `30` | Shortest span kept as a note, in ms |
| `referenceHz` | `440` | Reference the per-note cents are measured against |
| `outputLengthSamples` | source length | Length of the rendered output; `0` or omission takes the source length |
| `edgeFadeMs` | `5` | Fade at each edited note edge, in ms |
| `vibratoCutoffHz` | `3` | Where the slow drift ends and vibrato begins when a note's pitch curve is split |
| `limits` | see [Persist and restore](#persist-and-restore-a-session) | `maxHistoryBytes`, `maxCacheBytes`, `maxUndoDepth`, `maxRenderJobs` |

`session.analysis()` echoes the settings the analysis used, so read them back instead of assuming the defaults. The `sonare vocal-notes` command takes the segmentation and pitch-range settings as `--segmentation-threshold-cents`, `--min-note-ms`, `--fmin-hz`, `--fmax-hz` and `--reference-hz`.

## What a note edit holds

The session splits each note's measured pitch curve into three layers: the **center** (one pitch for the whole note, `centerMidi`), the **drift** (slow wandering around the center, below `vibratoCutoffHz`), and the **vibrato** (the faster periodic wobble above it). The edit fields below act on those layers separately, so a note can be moved to a new center while its drift and vibrato ride along unchanged. Pitch moves are resynthesized grain by grain, which keeps the formants roughly in place ([Two resynthesis engines](./glossary/editing/pitch-correction.md#two-resynthesis-engines)).

<SonareDemo id="melody-contour" />

Each note carries a `VocalNoteEdit`, and `setEdit` replaces it whole. Start from `note.edit` and change only the fields you mean to; the defaults below are what an untouched note reports. Pitch moves by the **target**:

| `pitch.target` | Result |
|----------------|--------|
| `{ mode: 'none' }` | Leave the pitch alone (the default) |
| `{ mode: 'center', midi }` | Move the note's `centerMidi` to `midi` in `[0, 127]`; drift and vibrato around the center are kept |
| `{ mode: 'curve', points }` | Follow `points`, each `{ sourceSample, midi }`: at least two, strictly increasing in `sourceSample`, with the first and last on the note's source start and end |

| Field | Meaning | Range | Default |
|-------|---------|-------|---------|
| `pitch.amount` | How far toward the target the pitch moves; `0` applies no correction | `[0, 1]` | `0` |
| `pitch.speedMs` | Time constant of the move onto the target; `0` moves at once | `>= 0` | `0` |
| `pitch.maxCorrectionSemitones` | Clamp on the correction at any frame | `>= 0` | `12` |
| `pitch.transposeSemitones` | Added to the pitch after any correction | any finite value | `0` |
| `pitch.driftScale` | Scales the slow drift around the center; `0` flattens it | `>= 0` | `1` |
| `pitch.vibratoScale` | Scales the vibrato; `0` removes it | `>= 0` | `1` |
| `formant.mode` | `'preserve'` applies no formant move; `'shift'` moves the spectral envelope by `shiftSemitones` | `'preserve'`, `'shift'` | `'preserve'` |
| `formant.shiftSemitones` | Formant move; `'preserve'` requires `0` | the range `capabilities()` reports (about -10.3 to +8.7) | `0` |
| `destinationStartSample` | Where the note starts in the output | `>= 0` | the source start |
| `destinationLengthSamples` | Output length of the note; a different length stretches it | `> 0`, inside the output length | the source length |
| `gainDb` | Level change | finite | `0` |
| `muted` | Silences the note | boolean | `false` |
| `amplitudeEnvelope` | Gain points stretched over the rendered note, on top of `gainDb` | finite, `>= 0` | empty |

## Apply edits as a draft

::: warning Decimal strings
Revisions, generations, request IDs, and byte limits (`maxHistoryBytes`, `maxCacheBytes`) cross the JavaScript boundary as decimal strings (`VocalUint64`). Keep them as strings; `maxUndoDepth` and `maxRenderJobs` are numbers. Pass `expectedRevision` and `expectedGeneration` on any write that can race another control-thread action.
:::

`beginEdit()` opens one transaction against the current committed revision. `draft.apply()` checks the draft generation and returns dirty ranges and any note ID changes. `draft.commit()` publishes one new revision and makes the edit visible to the session. A failed or abandoned draft should be canceled so another draft can start.

```typescript
const note = session.notes().notes[0];
const draft = session.beginEdit({ expectedRevision: session.revision() });

try {
  const edit = {
    ...note.edit,
    pitch: {
      ...note.edit.pitch,
      target: { mode: 'center', midi: 69 },
      amount: 1,
    },
  };
  const applied = draft.apply({
    expectedGeneration: draft.token().generation,
    operations: [{ kind: 'setEdit', noteId: note.id, edit }],
  });
  console.log(applied.dirtyRanges, applied.idChanges);
  draft.commit({ expectedRevision: session.revision() });
} catch (error) {
  draft.cancel();
  throw error;
}

session.undo({ expectedRevision: session.revision() });
session.redo({ expectedRevision: session.revision() });
```

The operation set covers `setEdit`, `setSourceSpan`, `split`, `merge`, `setTransition`, `removeTransition`, and `reset`. Splitting and merging can retire note IDs; follow `idChanges` and use the returned IDs for later operations.

Positions in `setSourceSpan` and `split` are samples or seconds, one spelling each (`sourceSample` / `sourceSec`, and `sourceStartSample` / `sourceStartSec`, `sourceEndSample` / `sourceEndSec`, `destinationStartSample` / `destinationStartSec`, `destinationLengthSamples` / `destinationLengthSec`). Seconds are rounded to the nearest sample at the session's rate; giving both spellings of one position is refused, and so is a negative position. `merge` takes `noteIds` and an optional `policy` (`'preserve'` or `'reset'`). [Samples and seconds](./editing-dsp.md#samples-and-seconds) lists the spellings for every editing call.

```typescript
const [first] = session.notes().notes;
const split = session.beginEdit({ expectedRevision: session.revision() });
const result = split.apply({
  expectedGeneration: split.token().generation,
  operations: [{ kind: 'split', noteId: first.id, sourceSec: 0.5 }],
});
console.log(result.idChanges); // [{ operationIndex: 0, retiredId, newIds: [a, b] }]
split.commit({ expectedRevision: session.revision() });

const [a, b] = result.idChanges[0].newIds;
const join = session.beginEdit({ expectedRevision: session.revision() });
join.apply({
  expectedGeneration: join.token().generation,
  operations: [{ kind: 'merge', noteIds: [a, b], policy: 'preserve' }],
});
join.commit({ expectedRevision: session.revision() });
```

In Python the operations are dataclasses: `VocalSplitNote(note_id, cut_source_sample=... or cut_source_sec=...)`, `VocalMergeNotes(note_ids, merge_policy)` and `VocalSetNoteSourceSpan(note_id, source_start_sec=..., ...)`. On `VocalSetNoteSourceSpan` the two destination sample fields default to 0, which reads as unset, so a destination in seconds is refused only beside a non-zero sample value.

The expected revision and generation fields turn concurrent or out-of-order UI writes into an explicit revision conflict instead of silently overwriting a newer edit. An empty committed draft does not add a history entry.

## Render a committed snapshot

Capture a snapshot after committing the edit. A snapshot keeps the state it captured, so a later session edit does not change an in-flight render. Render the complete destination output by omitting `range`, or render a half-open range for a preview. A range bound is `startSample` / `endSample` or `startSec` / `endSec` (one spelling each, rounded to the nearest sample); an omitted start is 0, an omitted end is the end of the output, and a negative bound is refused. Python takes a `VocalRange` or a `(start, end)` pair, or `start_sec=` / `end_sec=` keywords, on `render()` and `begin_render_job()`.

```typescript
const snapshot = session.captureRenderSnapshot();
try {
  const full = snapshot.render({
    range: { startSample: 0, endSample: session.outputLengthSamples() },
    requestId: '1',
  });
  console.log(full.samples.length, full.startSample, full.token.revision);

  const controller = new AbortController();
  const preview = await snapshot.renderAsync({
    range: { startSample: 64, endSample: 320 },
    requestId: '2',
    signal: controller.signal,
  });
  console.log(preview.processedRanges);
} finally {
  snapshot.dispose();
}
```

`renderAsync()` yields between native work units and publishes no partial PCM when its signal is aborted. For explicit pull-based scheduling, use `beginRenderJob()`, call `next()` until `complete` is true, then call `finalize()`; call `abort()` when the job should stop. The render result reports processed ranges, cache hits, dry-passed frames, and frames where the correction limit was reached.

## Persist and restore a session

`exportState()` serializes the committed edit state as an SVE1 byte array. It excludes source PCM, runtime caches, drafts, and undo history. Restore it with the same original mono source and sample rate; the source descriptor and digest are checked before the state is accepted. Python restores with `restore_vocal_edit_session(samples, sample_rate, state, *, max_history_bytes=..., max_cache_bytes=..., max_undo_depth=..., max_render_jobs=...)`, or `VocalEditSession.restore(...)`, which takes the same arguments; the limits default to those of session creation.

```typescript
import { restoreVocalEditSession } from '@libraz/libsonare';

const state = session.exportState();
const restored = restoreVocalEditSession({
  samples,
  sampleRate,
  state,
  limits: { maxUndoDepth: 64, maxRenderJobs: 2 },
});

try {
  console.log(restored.revision(), restored.history());
} finally {
  restored.dispose();
}
```

Runtime limits can be supplied on creation or restore. The defaults are 64 MiB for history, 128 MiB for the render cache, 128 undo entries, and 4 concurrent render jobs. Set limits for the host's memory and scheduling budget; a zero render-job limit rejects session creation, and a full render-job pool rejects another job until one is released.

## Run the session in a dedicated Worker

The browser/WASM package exports `VocalEditWorkerClient`. With no constructor options it creates a module Worker for `./vocal_edit_worker.js`. Pass `workerUrl` when the bundler emits that asset at another URL, or `workerFactory` to supply the Worker yourself: a `node:worker_threads` Worker works as well as a browser Worker.

```typescript
import { VocalEditWorkerClient } from '@libraz/libsonare';

const client = new VocalEditWorkerClient();
const controller = new AbortController();
const task = client.create(
  { samples, sampleRate },
  { copy: true, signal: controller.signal },
);

try {
  const workerSession = await task;
  const preview = workerSession.preview({
    range: { startSample: 0, endSample: 1024 },
    signal: controller.signal,
  });
  const result = await preview;
  console.log(result.samples.length);
  await workerSession.dispose();
} finally {
  client.dispose();
}
```

`client.restore(request)` opens a Worker session from persisted state the same way `create` does. The session handle is a `VocalEditWorkerSession` whose methods return cancellable tasks: reads (`notes()`, `analysis()`, `capabilities()`, `history()`, `evaluatePitch()`), draft control (`beginEdit()`, `apply()`, `commit()`, `cancel()`, `undo()`, `redo()`), `exportState()`, `preview()` and `dispose()`. `preview({ range: { startSec: 0.1, endSec: 0.2 } })` takes the same seconds-or-samples range as a direct render.

Typed-array buffers are transferred by default (`copy: false`) and become detached on the calling thread. Use `copy: true` when the caller must keep using `samples`, the persisted state, or arrays in a mutation request. `AbortSignal` and `VocalEditWorkerTask.cancel()` cancel create, restore, and preview calls. Session mutations are FIFO and cannot be canceled, so serialize UI writes and use expected revisions or generations. Pipelined replies that no longer match the client's latest intent reject with `VocalEditWorkerStaleResultError`; update UI state only from the latest accepted result.

## Apply a vocal edit to a Project

Render the entire source from a committed session, then attach that render and the SVE1 state to the matching audio clip. The Project adapter verifies the source ID, sample rate, sample count, source digest, clip length, source offset, and committed render token before creating a derived source and a vocal sidecar.

```typescript
import { Project } from '@libraz/libsonare';

const project = Project.create();
try {
  project.setSampleRate(sampleRate);
  const trackId = project.addTrack({ kind: 'audio', name: 'lead-vocal' });
  const clipId = project.addClip({
    trackId,
    startPpq: 0,
    lengthPpq: 4,
    audio: samples,
    audioChannels: 1,
    audioSampleRate: sampleRate,
  });
  const sourceId = project.sourceByIndex(0).id;
  const analysis = session.analysis();
  const snapshot = session.captureRenderSnapshot();
  let rendered;
  try {
    rendered = snapshot.render({
      range: { startSample: 0, endSample: session.outputLengthSamples() },
    }).samples;
  } finally {
    snapshot.dispose();
  }

  const result = project.applyVocalEdit({
    clipId,
    expectedSourceId: sourceId,
    expectedSourceSampleRate: sampleRate,
    expectedSourceSampleCount: samples.length,
    expectedSourceSha256: analysis.sourceSha256,
    expectedClipLengthPpq: 4,
    expectedSourceOffsetPpq: 0,
    renderedMono: rendered,
    renderedSampleRate: sampleRate,
    renderToken: session.token(),
    sve1: session.exportState(),
  });
  console.log(result.derivedSourceId, result.sidecarKey);
} finally {
  project.delete();
}
```

The v1 adapter requires a full mono source render beginning at sample 0 and a committed token with no open draft. It rejects clips using loop mode, warp references, comp segments, or unsupported render parts. Re-editing a clip whose current source is already derived resolves the original root source; export and apply state from that root session so the dependency chain remains valid.

## Inspect dependencies and rehydrate after load

`getVocalEditDependencies()` lists each clip/take sidecar, its original and derived source IDs, committed revision, digests, and PCM availability. Project clip duplication, splitting, undo/redo, and compatible source/take rebinding preserve the sidecar relationship; removing a clip removes its sidecar, and a rebind that changes the resolved source prunes the affected sidecar.

Project JSON keeps the sidecar metadata and SVE1 state, but a loaded project may not have the original or derived PCM in memory. Supply the original source buffers to `rehydrateVocalEdits()` after loading. Rehydration rerenders missing derived PCM from the persisted state and original source, stages all results until the pass succeeds, and checks that the project did not change while it ran.

```typescript
const json = project.toJson();
const loaded = Project.fromJson(json);
try {
  const dependencies = loaded.getVocalEditDependencies();
  const outcomes = loaded.rehydrateVocalEdits([
    { sourceId: dependencies[0].originalSourceId, mono: samples, sampleRate },
  ]);
  console.log(outcomes[0].status); // 0 rehydrated, 1 already ready, 2 unresolved
} finally {
  loaded.delete();
}
```

The cancellation callback is checked between dependency entries; return a truthy value to stop the pass. A project change, nested apply, or nested rehydrate invalidates the operation, so run rehydration as one control-thread transaction and refresh dependencies after a structural edit.

## Limits to surface in an editor

- The session is monophonic. Check `capabilities().monophonicOnly` and expose the formant range returned by `minimumFormantShiftSemitones` and `maximumFormantShiftSemitones`.
- A source sample rate must be between 8,000 and 384,000 Hz. The Project render rate must match the source rate for the v1 adapter.
- Revisions, generations, request IDs and byte limits are decimal strings; see [Decimal strings](#apply-edits-as-a-draft). Pass expected revisions and generations on writes that can race.
- State persistence does not include source PCM or undo history. Store the original source or a content-addressed equivalent alongside the project JSON.
- The Worker client runs in a browser or on a `node:worker_threads` Worker. Direct sessions are synchronous on the calling thread; use `renderAsync()` or the Worker for long renders and cancellation.

## Related

- [Project & Arrangement Editing](./project-editing.md) — place a committed vocal render on an audio clip
- [Project Save & Load](./project-save-load.md) — serialize and rebind project sources
- [Realtime Voice Changer](./realtime-voice-changer.md) — process live input on the realtime path
- [Binding Parity](./binding-parity.md) — compare runtime surfaces
- [Tune a Vocal Take](./use-cases/vocal-tuning.md) — measure a sung take, compare whole-take scale correction with note-by-note retuning, and keep the vibrato
