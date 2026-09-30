---
title: Compile, Save, and Load Projects
description: Compile a Project, serialize deterministic JSON, rebind audio sources, and import separated stems.
---

# Compile, Save, and Load Projects

Project work has three boundaries. `compile()` checks whether the arrangement can become a renderable timeline. `toJson()` / `fromJson()` persist the arrangement model. Loading does not restore PCM, so decoded audio must be rebound before a bounce. Host-separated stems enter through an all-or-nothing import that creates ordinary audio tracks and clips.

| Task | API |
|---|---|
| Check the arrangement | `project.compile()` |
| Persist the model | `project.toJson()` and `Project.fromJson(...)` |
| Recover load warnings | `Project.fromJsonWithDiagnostics(...)` |
| Rebind decoded audio | `unresolvedAudioSourceIds()` and `setSourceAudio(...)` |
| Add host-separated stems | `importExternalStems(...)` |

<FlowDiagram
  title="Compile, persist, rebind, and render"
  :nodes="[
    { id: 'edit', label: 'Project edits', col: 0, row: 0 },
    { id: 'compile', label: 'compile()', col: 1, row: 0, variant: 'accent' },
    { id: 'json', label: 'Deterministic JSON', col: 2, row: 0 },
    { id: 'load', label: 'fromJson()', col: 3, row: 0 },
    { id: 'rebind', label: 'Rebind PCM', col: 4, row: 0 },
    { id: 'bounce', label: 'Bounce', col: 5, row: 0, variant: 'success' }
  ]"
  :edges="[
    { from: 'edit', to: 'compile' },
    { from: 'compile', to: 'json' },
    { from: 'json', to: 'load' },
    { from: 'load', to: 'rebind' },
    { from: 'rebind', to: 'bounce' }
  ]"
  caption="The saved model restores the arrangement; the host supplies decoded PCM again before rendering."
/>

## Compiling the arrangement

`compile()` turns the edited project into a **renderable timeline** and reports structured **diagnostics**. Errors (severity `0`) mean the timeline could not be built; warnings (severity `1`) are non-fatal and the timeline is still renderable.

```typescript
const result = project.compile();
// result.hasTimeline     -> true when a renderable timeline was produced (no errors)
// result.diagnosticCount -> number of diagnostics
// result.diagnostics     -> [{ code, severity, targetId, message }, …]
// result.messages        -> newline-joined human-readable detail

if (!result.hasTimeline) {
  for (const d of result.diagnostics) {
    if (d.severity === 0) console.error(`compile error (clip/track ${d.targetId}): ${d.message}`);
  }
}
```

A common **non-fatal** warning: a project with MIDI clips but no bound instrument compiles fine, but bounces silently. After a bounce you can read the warnings that render produced with `lastBounceCompileResult()`:

```typescript
project.bounce({ numChannels: 2 });
const last = project.lastBounceCompileResult();
// last.diagnostics[0].message ->
//   "project contains MIDI clips; bounce is silent unless an instrument is bound"  (severity 1)
```

In Python, `project.compile()` returns the same shape (`has_timeline`, `diagnostic_count`, `diagnostics`, `messages`).

## Save and load: deterministic JSON

`toJson()` serializes the whole project — tracks, clips, MIDI content, loop crossfades, tempo map, time signatures, markers, annotations, warp maps, and automation — to **deterministic JSON**: the same project always produces byte-identical text. `Project.fromJson(...)` restores it. Loop crossfade fields are omitted when they are zero, so older hard-loop projects keep the same JSON shape.

```typescript
const json = project.toJson();
// … persist `json` to disk, a database, or postMessage …

const restored = Project.fromJson(json);
try {
  // restored.toJson() === json
} finally {
  restored.delete();
}
```

Use `Project.fromJsonWithDiagnostics(json)` when you want to recover non-fatal load warnings (for example dangling source references preserved for repair):

```typescript
const { project: loaded, diagnostics } = Project.fromJsonWithDiagnostics(json);
try {
  if (diagnostics) console.warn(diagnostics);
} finally {
  loaded.delete();
}
```

Python mirrors this with `project.to_json()`, `Project.from_json(json)`, and `Project.from_json_with_diagnostics(json)`.

### Reading the model back, and rebinding audio after a load

Project JSON stores the *arrangement*, not the PCM. A loaded project therefore knows it has a source, but has no samples behind it. Three read-only descriptor families plus the PCM and source-metadata setters close that loop.

```typescript
const loaded = Project.fromJson(json);

for (let i = 0; i < loaded.trackCount(); i++) {
  const track = loaded.trackByIndex(i);      // { id, kind, midiDestinationId, gain, pan, mute, solo, name }
  console.log(track.id, track.name);
}
for (let i = 0; i < loaded.clipCount(); i++) {
  const clip = loaded.clipByIndex(i);        // { id, trackId, sourceId, startPpq, lengthPpq, … }
  console.log(clip.id, clip.startPpq, clip.lengthPpq);
}
const unresolvedAudioIds = new Set(loaded.unresolvedAudioSourceIds());
for (let i = 0; i < loaded.sourceCount(); i++) {
  const source = loaded.sourceByIndex(i);    // { id, kind, channelCount, sampleRateHint,
                                             //   nameOrUri, contentHash, externalStemRole }
  if (source.kind !== 0 || !unresolvedAudioIds.has(source.id)) continue; // 0 = audio; skip MIDI
  const pcm = await decodeFromYourStorage(source.nameOrUri);
  loaded.setSourceAudio(source.id, pcm, source.channelCount, source.sampleRateHint);
  loaded.setAudioSourceMetadata(source.id, 'sha256:...', 'lead-vocal');
}

const audio = loaded.bounce({ sampleRate: 48000 });
```

`trackByIndex` / `clipByIndex` / `sourceByIndex` are 0-based over the stored order, paired with `trackCount()` / `clipCount()` / `sourceCount()`. They are descriptors, not handles: mutating the returned object changes nothing. Use them to render a project the host loaded from disk, or to build a UI over a project your own code did not construct.

`setSourceAudio(sourceId, samples, channels, sampleRate)` rebinds decoded PCM to a source before a bounce — the step that turns "loaded arrangement" into "renderable project".

`unresolvedAudioSourceIds()` is the public list of source ids that still need decoded PCM after deserialization. The `kind !== 0` guard above is defensive when walking descriptors (`0` is audio, `1` is MIDI): MIDI sources have no PCM to bind and no source metadata to update. `contentHash` and `externalStemRole` are owning metadata on audio-source descriptors (they are empty for MIDI sources). `setAudioSourceMetadata(sourceId, contentHash, externalStemRole)` replaces both strings as one undoable edit; pass an empty string to clear either value. WASM uses that positional form, Node also accepts `{ contentHash, externalStemRole }` as its second argument, and Python uses `set_audio_source_metadata(source_id, content_hash, external_stem_role)` (the C ABI is `sonare_project_set_audio_source_metadata`). Python uses `unresolved_audio_source_ids()` and source descriptors named `content_hash` / `external_stem_role`; the C getter returns heap strings that the matching free function must release.

### Importing host-separated stems

If your app already ran source separation (or simply has per-instrument WAVs), `importExternalStems` turns them into one audio track and clip each, in one transaction.

```typescript
const { trackIds, clipIds } = project.importExternalStems({
  sampleRate: 48000,
  stems: [
    { name: 'vocals', layout: 'stereo', planarSamples: [vocalL, vocalR], startFrame: 0 },
    { name: 'drums',  layout: 'stereo', planarSamples: [drumL, drumR],   startFrame: 0 },
    { name: 'bass',   layout: 'mono',   planarSamples: [bassMono],       startFrame: 0, role: 'bass' },
  ],
});
```

The import is **all-or-nothing**: if any stem is rejected, the project is left untouched rather than half-populated. It performs no resampling, no retiming, and no gain compensation — every stem must already be at `sampleRate`, and `startFrame` places it on the project timeline as-is. The optional per-stem `role` is host metadata that round-trips through the serializer and does not change any DSP.

## Continue to rendering

After the project has a timeline and every required audio source is bound, continue with [Bouncing Projects](./project-bounce.md). This page does not duplicate instrument-binding or render-option details.

## Related

- [Project Editing](./project-editing.md) — tracks, clips, tempo, markers, warp, and automation
- [Project MIDI](./project-editing-midi.md) — annotations, assist sidecars, auto-tempo, and SMF overview
- [MIDI 2.0, UMP, and Clip Files](./midi2.md) — lossless MIDI 2.0 clip-file exchange
