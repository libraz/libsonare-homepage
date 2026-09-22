import type {
  CompiledPattern,
  EngineSurface,
  ResolvedParamIds,
  StepBassEngine,
} from '@/demos/step-bass/stepBassTypes';

/**
 * Put a compiled pattern into an engine, ready to render. The live worklet and
 * the WAV export both call this one function, which is what makes "what you
 * heard" and "what you downloaded" the same signal path.
 *
 * It does not touch the transport: whether and where to play is the caller's,
 * and a caller that had to undo a start hidden in here would be working around
 * this function rather than using it.
 *
 * It closes over nothing: the processor embeds `applyCompiled.toString()` into
 * its source, so everything it needs arrives in `compiled` or is declared
 * inside. `surface` branches exactly one call — the native embind object takes
 * `setSynthInstrument(destinationId, patch)`, the JS facade takes
 * `(patch, destinationId)`, and passing the wrong one throws.
 *
 * @returns Automation ids by parameter name, for the live knobs and the lanes.
 *   A parameter the engine does not expose is absent rather than `-1`.
 */
export function applyCompiled(
  engine: StepBassEngine,
  compiled: CompiledPattern,
  surface: EngineSurface,
): ResolvedParamIds {
  // AudioWorklet render quantum; the engine scratch is prepared for it.
  const BLOCK = 128;
  const CHANNELS = 2;
  const destination = compiled.clip.destinationId;
  // The clip's UMP words are group 0 / channel 0.
  const channel = 0;

  engine.prepareChannels(CHANNELS, BLOCK);
  for (let ch = 0; ch < CHANNELS; ch++) engine.getChannelBuffer(ch, BLOCK);
  // Fader and limiter go in before the instrument, so the first block already
  // renders through the ceiling the mix is staged against.
  engine.setMasterStripJson(compiled.masterStripJson);
  engine.setTrackLanes([compiled.clip.trackId]);
  if (surface === 'native') engine.setSynthInstrument(destination, compiled.patch);
  else engine.setSynthInstrument(compiled.patch, destination);
  // Binding an instrument resets the destination's articulation, so the slur
  // has to be asked for after the bind, every time.
  engine.setArticulation(destination, channel, compiled.articulation);
  // Lane breakpoints and the loop are in ppq; the clip's events are in frames.
  engine.setTempoSegments([{ startPpq: 0, bpm: compiled.bpm }]);
  engine.setMidiClips([compiled.clip]);

  const ids: ResolvedParamIds = {};
  const wanted = [
    'cutoffHz',
    'resonanceQ',
    'envToCutoffCents',
    'pitchOffsetCents',
    'velToCutoffCents',
  ] as const;
  for (const name of wanted) {
    const id = engine.resolveInstrumentAutomationId(destination, name);
    if (id >= 0) ids[name] = id;
  }
  for (const lane of compiled.lanes) {
    const id = engine.resolveInstrumentAutomationId(destination, lane.param);
    if (id < 0) continue;
    ids[lane.param] = id;
    engine.setAutomationLane(id, lane.points);
  }

  // The transport loops, not the clip: a clip's own loop plays once and stops.
  engine.setLoop(compiled.loop.startPpq, compiled.loop.endPpq, true);
  return ids;
}
