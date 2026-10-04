import { ref, shallowRef } from 'vue';
import { useAudioExport } from '@/composables/useAudioExport';
import { useSonareEngine } from '@/composables/useSonareEngine';
import {
  barFrames,
  EXPORT_SAMPLE_RATE,
  laneTrackId,
  masterFaderOp,
  renderStudioMix,
  studioClipsOp,
  studioSetupOps,
  trackFaderOp,
  trackMuteOp,
} from '@/demos/studio/studioBounce';
import {
  BAR_PPQ,
  STEP_COUNT,
  STUDIO_MASTER_GAIN,
  STUDIO_TRACKS,
  type StudioPattern,
} from '@/demos/studio/studioCopy';
import {
  applyOps,
  createFacadeTarget,
  type EngineOp,
  type EngineTarget,
} from '@/utils/engineApply';

type WasmModule = typeof import('@/wasm/index.js');
/** Per-tick meter decay factor, matching the previous analyser-based meters. */
const METER_DECAY = 0.86;

export interface StudioStemView {
  /** Per-bucket min/max of the stem's left channel, for clip drawing. */
  min: Float32Array;
  max: Float32Array;
}

/** Meter dB (peak) to the linear 0..1+ scale the UI meters use. */
function dbToLinear(db: number): number {
  return Number.isFinite(db) ? 10 ** (db / 20) : 0;
}

/**
 * The Studio Mini engine: the step pattern is compiled into looping MIDI clips
 * on libsonare's realtime engine (`setMidiClips`), one clip per track, each
 * routed to its own NativeSynth destination through the engine's per-track
 * lane mixer (`setTrackLanes` + strip fader/mute) into a master strip carrying
 * the engine's true-peak limiter. Pattern and tempo edits update the schedule
 * in place — playback never stops to re-render. Meters come from the engine's
 * per-lane and master meter telemetry, the WAV export applies the same engine
 * ops (`studioBounce.ts`) to an offline engine, and the stem waveforms are
 * display-only offline Project renders.
 */
export function useStudioEngine() {
  const sonare = useSonareEngine();
  const ready = ref(false);
  const starting = ref(false);
  const error = ref<string | null>(null);
  const playing = ref(false);
  /** Loop phase 0..1 while playing. */
  const position = ref(0);
  /** Post-fader peak per track (linear 0..1+), from engine lane meters. */
  const levels = ref<number[]>(STUDIO_TRACKS.map(() => 0));
  /** Post-master-fader peak (linear 0..1+), from the engine master meter. */
  const masterLevel = ref(0);
  const stemViews = shallowRef<StudioStemView[]>([]);
  const libVersion = ref('');
  const audioExport = useAudioExport();

  let wasm: WasmModule | null = null;
  /** The facade as an engineApply target; the export applies the same ops to a raw engine. */
  let target: EngineTarget | null = null;
  const gains: number[] = STUDIO_TRACKS.map((track) => track.gain);
  const mutes: boolean[] = STUDIO_TRACKS.map(() => false);
  let masterGainValue = STUDIO_MASTER_GAIN;
  /** Set by dispose(); cancels an in-flight start() at its next await point. */
  let disposed = false;
  let currentBpm = 120;
  let loopStart = 0;
  let loopDuration = (BAR_PPQ * 60) / 120;
  let rafId = 0;
  /** Freshest engine meter peaks, consumed (zeroed) by each meter tick. */
  const lanePeaks: number[] = STUDIO_TRACKS.map(() => 0);
  let masterPeak = 0;
  let auditioning = 0;
  let auditionRaf = 0;
  const stemCache = new Map<string, Float32Array>();
  const trackId = laneTrackId;
  sonare.onMeter((meter) => {
    const linear = Math.max(dbToLinear(meter.peakDbL), dbToLinear(meter.peakDbR));
    if (meter.targetId === 0) {
      masterPeak = Math.max(masterPeak, linear);
    } else if (meter.targetId >= 1 && meter.targetId <= STUDIO_TRACKS.length) {
      const lane = meter.targetId - 1;
      lanePeaks[lane] = Math.max(lanePeaks[lane], linear);
    }
  });

  /**
   * Boot the WASM module, the AudioContext, and the engine worklet. Safe to
   * call without a user gesture: the context boots suspended (the worklet
   * still loads and initializes its WASM heap) and `play()` — always a click —
   * resumes it.
   */
  async function start(): Promise<boolean> {
    if (ready.value) {
      return true;
    }
    if (starting.value) return false;
    starting.value = true;
    error.value = null;
    try {
      if (!(await sonare.start())) {
        error.value = sonare.error.value;
        return false;
      }
      // The shared boot has initialised index.js, which carries the main-thread
      // surface (Project bounces, version, waveform peaks).
      const mod = await import('@/wasm/index.js');
      const engine = sonare.engine.value;
      if (disposed || !engine) return false;
      wasm = mod;
      libVersion.value = mod.version();

      target = createFacadeTarget(engine);
      applyOps(target, studioSetupOps());
      engine.transport.setLoop(0, BAR_PPQ, true);

      ready.value = true;
      return true;
    } catch (err) {
      console.error('studio engine start failed:', err);
      error.value = err instanceof Error ? err.message : String(err);
      // The engine never came up — release it and its AudioContext.
      target = null;
      await sonare.dispose();
      return false;
    } finally {
      starting.value = false;
    }
  }

  /** Applies `op` to the live engine once it is up. */
  function apply(op: EngineOp): void {
    if (target) applyOps(target, [op]);
  }

  /**
   * Push the current pattern/tempo into the live engine and refresh the
   * display stems. The MIDI clip schedule is replaced in place, so playback
   * keeps running through the edit — no re-render, no source restart.
   */
  function rebuild(pattern: StudioPattern, bpm: number): void {
    const mod = wasm;
    const engine = sonare.engine.value;
    const context = sonare.context.value;
    if (!mod || !engine || !target) return;
    if (bpm !== currentBpm) {
      const phase = playing.value ? currentPhase() : 0;
      currentBpm = bpm;
      loopDuration = (BAR_PPQ * 60) / bpm;
      engine.setTempoSegments([{ startPpq: 0, bpm }]);
      if (playing.value && context) {
        // Keep the audible loop phase across the tempo change.
        engine.transport.seekPpq(phase * BAR_PPQ);
        loopStart = context.currentTime - phase * loopDuration;
      }
    }
    // The one-bar schedule, at the context's rate.
    applyOps(target, [studioClipsOp(pattern, bpm, context?.sampleRate ?? EXPORT_SAMPLE_RATE, 1)]);
    refreshStemViews(mod, pattern, bpm);
  }

  /**
   * Build a Project for one track of the pattern. `bars` repeats the pattern
   * so the WAV export can carry two bars plus the instrument's release tail.
   */
  function buildTrackProject(
    mod: WasmModule,
    pattern: StudioPattern,
    trackIndex: number,
    bpm: number,
    bars: number,
  ) {
    const def = STUDIO_TRACKS[trackIndex];
    const project = new mod.Project();
    project.setSampleRate(EXPORT_SAMPLE_RATE);
    project.setTempoSegments([{ startPpq: 0, bpm }]);
    const { trackId: projectTrackId, clipId } = project.addMidiClip(0, BAR_PPQ * bars);
    project.setTrackMidiDestination(projectTrackId, def.destination);
    const events = [];
    for (let bar = 0; bar < bars; bar++) {
      for (let row = 0; row < def.rows.length; row++) {
        for (let step = 0; step < STEP_COUNT; step++) {
          if (!pattern[trackIndex][row][step]) continue;
          const startPpq = bar * BAR_PPQ + (step * BAR_PPQ) / STEP_COUNT;
          const endPpq = Math.min(startPpq + def.gatePpq, BAR_PPQ * bars);
          events.push(mod.Project.midiNoteOn(startPpq, 0, 0, def.rows[row].note, def.velocity));
          events.push(mod.Project.midiNoteOff(endPpq, 0, 0, def.rows[row].note, 0));
        }
      }
    }
    project.setMidiEvents(clipId, events);
    return project;
  }

  /** Bounce one track to an exact-loop-length interleaved stereo stem. */
  function bounceStem(
    mod: WasmModule,
    pattern: StudioPattern,
    trackIndex: number,
    bpm: number,
    totalFrames: number,
  ): Float32Array {
    const cacheKey = `${trackIndex}:${bpm}:${totalFrames}:${JSON.stringify(pattern[trackIndex])}`;
    const cached = stemCache.get(cacheKey);
    if (cached) return cached;
    const def = STUDIO_TRACKS[trackIndex];
    const project = buildTrackProject(mod, pattern, trackIndex, bpm, 1);
    try {
      const rendered = project.bounceWithSynthInstrument(
        [{ preset: def.preset, destinationId: def.destination }],
        {
          numChannels: 2,
          sampleRate: EXPORT_SAMPLE_RATE,
          totalFrames,
        },
      );
      stemCache.set(cacheKey, rendered);
      if (stemCache.size > 32) stemCache.delete(stemCache.keys().next().value!);
      return rendered;
    } finally {
      project.delete();
    }
  }

  /**
   * Re-render the per-track waveform views (display only — not playback).
   *
   * Bounces run synchronously on the main thread rather than on a Web Worker,
   * unlike the site's heavier offline paths. This is a deliberate trade-off:
   * the render is a bounded one-bar-per-track loop and the caller (`rebuild`)
   * only fires after the engine is ready and grid edits are debounced, so it
   * never sits on the first-paint path. A worker offload would need a second
   * WASM heap (this reuses the already-booted index.js instance) and add a
   * round-trip for no perceptible win at this loop length.
   */
  function refreshStemViews(mod: WasmModule, pattern: StudioPattern, bpm: number): void {
    const frames = barFrames(EXPORT_SAMPLE_RATE, bpm);
    const views: StudioStemView[] = [];
    for (let i = 0; i < STUDIO_TRACKS.length; i++) {
      const interleaved = bounceStem(mod, pattern, i, bpm, frames);
      const report = mod.waveformPeaks(interleaved, 2, {
        samplesPerBucket: Math.max(64, Math.floor(frames / 240)),
      });
      const buckets = report.bucketCount;
      views.push({ min: report.min.subarray(0, buckets), max: report.max.subarray(0, buckets) });
    }
    stemViews.value = views;
  }

  function currentPhase(): number {
    const context = sonare.context.value;
    if (!context || loopDuration <= 0) return 0;
    const elapsed = context.currentTime - loopStart;
    return (((elapsed % loopDuration) + loopDuration) % loopDuration) / loopDuration;
  }

  function play(): void {
    const engine = sonare.engine.value;
    const context = sonare.context.value;
    if (!ready.value || playing.value || !engine || !context) return;
    // Called from a click — this is the gesture that unlocks the context.
    if (context.state !== 'running') {
      // Re-anchor the UI clock once audio actually starts, so the run lights
      // don't lead the sound by the resume latency on the first play.
      void context.resume().then(() => {
        if (playing.value && context) loopStart = context.currentTime;
      });
    }
    engine.transport.seekPpq(0);
    engine.transport.play();
    playing.value = true;
    loopStart = context.currentTime;
    tick();
  }

  function stop(): void {
    playing.value = false;
    const engine = sonare.engine.value;
    if (engine) {
      engine.transport.stop();
      engine.pushMidiPanic();
      engine.transport.seekPpq(0);
    }
    cancelAnimationFrame(rafId);
    position.value = 0;
    levels.value = STUDIO_TRACKS.map(() => 0);
    masterLevel.value = 0;
    for (let i = 0; i < lanePeaks.length; i++) lanePeaks[i] = 0;
    masterPeak = 0;
  }

  /** Refresh the UI meters from the latest engine telemetry (with decay). */
  function updateMeters(): void {
    const nextLevels = levels.value.slice();
    for (let i = 0; i < STUDIO_TRACKS.length; i++) {
      nextLevels[i] = Math.max(lanePeaks[i], nextLevels[i] * METER_DECAY);
      lanePeaks[i] = 0;
    }
    levels.value = nextLevels;
    masterLevel.value = Math.max(masterPeak, masterLevel.value * METER_DECAY);
    masterPeak = 0;
  }

  function tick(): void {
    if (!playing.value) return;
    position.value = currentPhase();
    updateMeters();
    rafId = requestAnimationFrame(tick);
  }

  /** Keep the meters alive while stopped, until previews and decay finish. */
  function auditionTick(): void {
    if (playing.value) return; // the transport loop owns the meters now
    updateMeters();
    const decaying = masterLevel.value > 0.01 || levels.value.some((level) => level > 0.01);
    if (auditioning > 0 || decaying) {
      auditionRaf = requestAnimationFrame(auditionTick);
    }
  }

  /**
   * Preview one pad's note through its lane strip (fader and mute apply).
   * Live MIDI renders even while the transport is stopped, so this is a
   * direct note push — no offline render, no cache. Called from a pad click —
   * the gesture that may resume the context.
   */
  function audition(trackIndex: number, rowIndex: number): void {
    const engine = sonare.engine.value;
    const context = sonare.context.value;
    if (!engine || !context || !ready.value) return;
    if (context.state !== 'running') void context.resume();
    const def = STUDIO_TRACKS[trackIndex];
    const note = def.rows[rowIndex].note;
    engine.pushMidiNoteOn(trackId(trackIndex), 0, 0, note, def.velocity);
    const gateMs = ((def.gatePpq * 60) / currentBpm) * 1000;
    auditioning++;
    window.setTimeout(
      () => {
        auditioning--;
        sonare.engine.value?.pushMidiNoteOff(trackId(trackIndex), 0, 0, note, 0);
      },
      Math.max(90, gateMs),
    );
    cancelAnimationFrame(auditionRaf);
    auditionRaf = requestAnimationFrame(auditionTick);
  }

  function setTrackGain(index: number, value: number): void {
    gains[index] = value;
    apply(trackFaderOp(index, value));
  }

  function setTrackMute(index: number, muted: boolean): void {
    mutes[index] = muted;
    apply(trackMuteOp(index, muted));
  }

  function setMasterGain(value: number): void {
    masterGainValue = value;
    apply(masterFaderOp(value));
  }

  /**
   * Bounce a two-bar version of the session (release tails included) through
   * the same lane strips, mutes, master fader and master limiter the live
   * engine runs, as a 16-bit PCM WAV blob.
   *
   * Runs synchronously on the main thread by design: it fires from an explicit
   * download click (never on the first-paint path) and the fixed two-bar loop
   * keeps the offline render short, so a worker offload with its own WASM heap
   * would add complexity without a perceptible latency win.
   */
  function exportWav(pattern: StudioPattern, bpm: number): Blob | null {
    const mod = wasm;
    if (!mod) return null;
    const mix = renderStudioMix(mod, pattern, bpm, {
      gains,
      mutes,
      masterGain: masterGainValue,
    });
    return mix ? audioExport.encodeWav(mix, EXPORT_SAMPLE_RATE, 2) : null;
  }

  /**
   * Export the one-bar pattern and its tempo as a Standard MIDI File: one
   * Project MIDI clip per track on the track's General MIDI channel (with a
   * GM program change, so the file plays sensibly in any DAW), serialized by
   * the native SMF writer. Muted tracks are skipped, matching the WAV bounce.
   */
  function exportMidi(pattern: StudioPattern, bpm: number): Blob | null {
    const mod = wasm;
    if (!mod) return null;
    const project = new mod.Project();
    try {
      project.setSampleRate(EXPORT_SAMPLE_RATE);
      project.setTempoSegments([{ startPpq: 0, bpm }]);
      let wroteNotes = false;
      for (let t = 0; t < STUDIO_TRACKS.length; t++) {
        if (mutes[t]) continue;
        const def = STUDIO_TRACKS[t];
        const events = [];
        if (def.gm.program !== undefined) {
          events.push(mod.Project.midiProgram(0, 0, def.gm.channel, def.gm.program));
        }
        let hasNotes = false;
        for (let row = 0; row < def.rows.length; row++) {
          for (let step = 0; step < STEP_COUNT; step++) {
            if (!pattern[t][row][step]) continue;
            const startPpq = (step * BAR_PPQ) / STEP_COUNT;
            const endPpq = Math.min(startPpq + def.gatePpq, BAR_PPQ);
            const note = def.rows[row].note;
            events.push(mod.Project.midiNoteOn(startPpq, 0, def.gm.channel, note, def.velocity));
            events.push(mod.Project.midiNoteOff(endPpq, 0, def.gm.channel, note, 0));
            hasNotes = true;
          }
        }
        if (!hasNotes) continue;
        const { clipId } = project.addMidiClip(0, BAR_PPQ);
        project.setMidiEvents(clipId, events);
        wroteNotes = true;
      }
      if (!wroteNotes) return null;
      return audioExport.exportMidi(project.exportSmf());
    } finally {
      project.delete();
    }
  }

  async function dispose(): Promise<void> {
    disposed = true;
    stop();
    cancelAnimationFrame(auditionRaf);
    auditioning = 0;
    ready.value = false;
    target = null;
    masterLevel.value = 0;
    stemViews.value = [];
    stemCache.clear();
    await sonare.dispose();
  }

  return {
    ready,
    starting,
    error,
    playing,
    position,
    levels,
    masterLevel,
    stemViews,
    libVersion,
    start,
    rebuild,
    play,
    stop,
    audition,
    setTrackGain,
    setTrackMute,
    setMasterGain,
    exportWav,
    exportMidi,
    dispose,
  };
}
