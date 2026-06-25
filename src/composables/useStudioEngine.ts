import { ref, shallowRef } from 'vue';
import {
  BAR_PPQ,
  STEP_COUNT,
  STUDIO_TRACKS,
  type StudioPattern,
} from '@/components/studio/studioCopy';

type WasmModule = typeof import('@/wasm/index.js');
type WorkletModule = typeof import('@/wasm/worklet.js');
type StudioFacade = Awaited<ReturnType<WorkletModule['SonareEngine']['create']>>;
type FacadeOptions = NonNullable<Parameters<WorkletModule['SonareEngine']['create']>[1]>;

/** Sample rate used for the offline WAV export and the stem waveform views. */
const EXPORT_SAMPLE_RATE = 48000;
/** Engine meter cadence in frames (~21 ms at 48 kHz). */
const METER_INTERVAL_FRAMES = 1024;
/** Per-tick meter decay factor, matching the previous analyser-based meters. */
const METER_DECAY = 0.86;

export interface StudioStemView {
  /** Per-bucket min/max of the stem's left channel, for clip drawing. */
  min: Float32Array;
  max: Float32Array;
}

/** UMP MIDI 1.0 channel-voice words (group 0). */
function noteOnWord(note: number, velocity: number): number {
  return ((0x2 << 28) | (0x9 << 20) | ((note & 0x7f) << 8) | (velocity & 0x7f)) >>> 0;
}
function noteOffWord(note: number): number {
  return ((0x2 << 28) | (0x8 << 20) | ((note & 0x7f) << 8)) >>> 0;
}

/** Linear fader value (0..~1.4) to dB for the engine strip fader. */
function linearToDb(value: number): number {
  return value <= 0.0001 ? -100 : 20 * Math.log10(value);
}

/** Meter dB (peak) to the linear 0..1+ scale the UI meters use. */
function dbToLinear(db: number): number {
  return Number.isFinite(db) ? 10 ** (db / 20) : 0;
}

/**
 * Untransformed copy of the worklet bridge, kept in `src/public/` by
 * `yarn copy:wasm`. The bundled `@/wasm/worklet.js` cannot be imported inside
 * the AudioWorklet in dev: Vite injects an `/@vite/client` import into it,
 * which references `window` and fails silently in AudioWorkletGlobalScope
 * (Chrome resolves `addModule` even when module evaluation throws). Public
 * assets are served raw in both dev and build, so this path always works.
 */
const WORKLET_BRIDGE_PATH = '/sonare-worklet.js';

/**
 * The worklet module: registers the realtime-engine processor with the embind
 * module factory. Loaded from a blob: URL, so static import specifiers must be
 * absolute — a root-relative path cannot resolve against the opaque blob base.
 */
function buildEngineWorkletSource(sonareUrl: string, workletUrl: string): string {
  return `
import createModule from '${sonareUrl}';
import { registerSonareRealtimeEngineWorkletProcessor } from '${workletUrl}';
globalThis.SonareEmbindModuleFactory = createModule;
registerSonareRealtimeEngineWorkletProcessor();
`;
}

/**
 * The Studio Mini engine: the step pattern is compiled into looping MIDI clips
 * on libsonare's realtime engine (`setMidiClips`), one clip per track, each
 * routed to its own NativeSynth destination through the engine's per-track
 * lane mixer (`setTrackLanes` + strip fader/mute). Pattern and tempo edits
 * update the schedule in place — playback never stops to re-render. Meters
 * come from the engine's per-lane and master meter telemetry, the WAV export
 * stays a deterministic offline Project bounce, and the stem waveforms are
 * display-only offline renders.
 */
export function useStudioEngine(sonareJsUrl: string, wasmUrl: string) {
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

  let wasm: WasmModule | null = null;
  let engine: StudioFacade | null = null;
  let context: AudioContext | null = null;
  let moduleUrl: string | null = null;
  let offMeter: (() => void) | null = null;
  const gains: number[] = STUDIO_TRACKS.map(() => 0.9);
  const mutes: boolean[] = STUDIO_TRACKS.map(() => false);
  let masterGainValue = 0.9;
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

  /** Engine lane track ids are 1-based; destination id == track id. */
  function trackId(index: number): number {
    return index + 1;
  }

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
      // index.js carries the main-thread surface (Project bounces, version,
      // waveform peaks, the offline mirror engine); worklet.js carries only
      // the AudioWorklet bridge, so it needs no main-thread init of its own.
      const mod = await import('@/wasm/index.js');
      await mod.init();
      if (disposed) return false;
      wasm = mod;
      libVersion.value = mod.version();
      const wmod = await import('@/wasm/worklet.js');
      if (disposed) return false;

      const ctx = new AudioContext({ latencyHint: 'interactive' });
      context = ctx;
      if (!moduleUrl) {
        const absSonare = new URL(sonareJsUrl, location.href).href;
        const absWorklet = new URL(WORKLET_BRIDGE_PATH, location.href).href;
        moduleUrl = URL.createObjectURL(
          new Blob([buildEngineWorkletSource(absSonare, absWorklet)], {
            type: 'text/javascript',
          }),
        );
      }
      const wasmBinary = await (await fetch(wasmUrl)).arrayBuffer();
      if (disposed) {
        await closeContext();
        return false;
      }

      const created = await wmod.SonareEngine.create(ctx, {
        moduleUrl,
        wasmBinary,
        mode: 'auto', // the site is SAB-free, so this falls back to postMessage
        channelCount: 2,
        meterIntervalFrames: METER_INTERVAL_FRAMES,
        // The ABI numbers come from the already-initialized index.js module;
        // passing them lets the bridge skip its own (uninitialized) lookup.
        engineAbiVersion: mod.engineAbiVersion(),
        expectedEngineAbiVersion: mod.EXPECTED_ENGINE_ABI_VERSION,
        // Reuse the index.js WASM instance for the offline mirror instead of
        // booting a second main-thread heap from the worklet bundle.
        offlineEngine: new mod.RealtimeEngine(
          ctx.sampleRate,
          128,
        ) as unknown as FacadeOptions['offlineEngine'],
      });
      if (disposed) {
        created.destroy();
        await closeContext();
        return false;
      }
      engine = created;
      engine.node.connect(ctx.destination);

      engine.setTrackLanes(STUDIO_TRACKS.map((_, i) => trackId(i)));
      for (let i = 0; i < STUDIO_TRACKS.length; i++) {
        engine.setSynthInstrument(trackId(i), STUDIO_TRACKS[i].preset);
      }
      engine.transport.setLoop(0, BAR_PPQ, true);
      offMeter = engine.onMeter((meter) => {
        const linear = Math.max(dbToLinear(meter.peakDbL), dbToLinear(meter.peakDbR));
        if (meter.targetId === 0) {
          masterPeak = Math.max(masterPeak, linear);
        } else if (meter.targetId >= 1 && meter.targetId <= STUDIO_TRACKS.length) {
          const lane = meter.targetId - 1;
          lanePeaks[lane] = Math.max(lanePeaks[lane], linear);
        }
      });

      // Outside a gesture this stays pending until the user interacts.
      void ctx.resume().catch(() => {
        /* resume re-attempted on the first gesture */
      });
      ready.value = true;
      return true;
    } catch (err) {
      console.error('studio engine start failed:', err);
      error.value = err instanceof Error ? err.message : String(err);
      // The engine never came up — don't leave a dangling AudioContext.
      await closeContext();
      return false;
    } finally {
      starting.value = false;
    }
  }

  /** Close and forget the AudioContext (idempotent). */
  async function closeContext(): Promise<void> {
    const ctx = context;
    context = null;
    if (!ctx) return;
    try {
      await ctx.close();
    } catch {
      /* already closed */
    }
  }

  /** One bar of the loop, in engine-timeline samples at the engine's rate. */
  function barSamples(bpm: number): number {
    const rate = context?.sampleRate ?? EXPORT_SAMPLE_RATE;
    return Math.round((rate * BAR_PPQ * 60) / bpm);
  }

  /**
   * Compile the step pattern into one looping MIDI clip per track. Event
   * `renderFrame`s are absolute engine-timeline samples; the fixed tempo map
   * (`startPpq: 0`) makes the conversion a plain ratio.
   */
  function buildMidiClips(pattern: StudioPattern, bpm: number) {
    const frames = barSamples(bpm);
    const clips = [];
    for (let t = 0; t < STUDIO_TRACKS.length; t++) {
      const def = STUDIO_TRACKS[t];
      const events: { renderFrame: number; word0: number }[] = [];
      for (let row = 0; row < def.rows.length; row++) {
        for (let step = 0; step < STEP_COUNT; step++) {
          if (!pattern[t][row][step]) continue;
          const start = Math.round((step * frames) / STEP_COUNT);
          const end = Math.min(start + Math.round((def.gatePpq / BAR_PPQ) * frames), frames - 1);
          events.push({ renderFrame: start, word0: noteOnWord(def.rows[row].note, def.velocity) });
          events.push({ renderFrame: end, word0: noteOffWord(def.rows[row].note) });
        }
      }
      if (events.length === 0) continue;
      events.sort((a, b) => a.renderFrame - b.renderFrame);
      clips.push({
        id: trackId(t),
        trackId: trackId(t),
        destinationId: trackId(t),
        startSample: 0,
        startPpq: 0,
        lengthSamples: frames,
        loop: true,
        loopLengthSamples: frames,
        events,
      });
    }
    return clips;
  }

  /**
   * Push the current pattern/tempo into the live engine and refresh the
   * display stems. The MIDI clip schedule is replaced in place, so playback
   * keeps running through the edit — no re-render, no source restart.
   */
  function rebuild(pattern: StudioPattern, bpm: number): void {
    const mod = wasm;
    if (!mod || !engine) return;
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
    engine.setMidiClips(buildMidiClips(pattern, bpm));
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
    const def = STUDIO_TRACKS[trackIndex];
    const project = buildTrackProject(mod, pattern, trackIndex, bpm, 1);
    try {
      return project.bounceWithSynthInstrument(
        [{ preset: def.preset, destinationId: def.destination }],
        {
          numChannels: 2,
          sampleRate: EXPORT_SAMPLE_RATE,
          totalFrames,
        },
      );
    } finally {
      project.delete();
    }
  }

  /** Re-render the per-track waveform views (display only — not playback). */
  function refreshStemViews(mod: WasmModule, pattern: StudioPattern, bpm: number): void {
    const frames = Math.round((EXPORT_SAMPLE_RATE * BAR_PPQ * 60) / bpm);
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
    if (!context || loopDuration <= 0) return 0;
    const elapsed = context.currentTime - loopStart;
    return (((elapsed % loopDuration) + loopDuration) % loopDuration) / loopDuration;
  }

  function play(): void {
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
        engine?.pushMidiNoteOff(trackId(trackIndex), 0, 0, note, 0);
      },
      Math.max(90, gateMs),
    );
    cancelAnimationFrame(auditionRaf);
    auditionRaf = requestAnimationFrame(auditionTick);
  }

  function setTrackGain(index: number, value: number): void {
    gains[index] = value;
    engine?.setStripGain(trackId(index), linearToDb(value));
  }

  function setTrackMute(index: number, muted: boolean): void {
    mutes[index] = muted;
    engine?.setSoloMute(trackId(index), false, muted);
  }

  function setMasterGain(value: number): void {
    masterGainValue = value;
    engine?.setStripGain('master', linearToDb(value));
  }

  /**
   * Bounce a two-bar version of the session (release tails included) with the
   * mixer's gains applied, as a 16-bit PCM WAV blob.
   */
  function exportWav(pattern: StudioPattern, bpm: number): Blob | null {
    const mod = wasm;
    if (!mod) return null;
    const stems: Float32Array[] = [];
    let maxLength = 0;
    for (let i = 0; i < STUDIO_TRACKS.length; i++) {
      if (mutes[i]) continue;
      const def = STUDIO_TRACKS[i];
      const project = buildTrackProject(mod, pattern, i, bpm, 2);
      try {
        // No totalFrames: auto-derived length keeps the instrument's tail.
        const stem = project.bounceWithSynthInstrument(
          [{ preset: def.preset, destinationId: def.destination }],
          { numChannels: 2, sampleRate: EXPORT_SAMPLE_RATE },
        );
        const scaled = new Float32Array(stem.length);
        for (let f = 0; f < stem.length; f++) scaled[f] = stem[f] * gains[i];
        stems.push(scaled);
        if (scaled.length > maxLength) maxLength = scaled.length;
      } finally {
        project.delete();
      }
    }
    if (maxLength === 0) return null;
    const mix = new Float32Array(maxLength);
    for (const stem of stems) {
      for (let f = 0; f < stem.length; f++) mix[f] += stem[f];
    }
    // The master fader applies to the bounce too, as the tooltip promises.
    for (let f = 0; f < mix.length; f++) mix[f] *= masterGainValue;
    return encodeWav(mix, EXPORT_SAMPLE_RATE, 2);
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
      return new Blob([project.exportSmf()], { type: 'audio/midi' });
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
    offMeter?.();
    offMeter = null;
    if (engine) {
      engine.destroy();
      engine = null;
    }
    if (moduleUrl) {
      URL.revokeObjectURL(moduleUrl);
      moduleUrl = null;
    }
    masterLevel.value = 0;
    stemViews.value = [];
    await closeContext();
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

/** Encode interleaved float samples as a 16-bit PCM WAV blob. */
function encodeWav(interleaved: Float32Array, sampleRate: number, numChannels: number): Blob {
  const bytesPerSample = 2;
  const dataBytes = interleaved.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, 8 * bytesPerSample, true);
  writeStr(36, 'data');
  view.setUint32(40, dataBytes, true);
  let offset = 44;
  for (let i = 0; i < interleaved.length; i++) {
    const s = Math.max(-1, Math.min(1, interleaved[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += bytesPerSample;
  }
  return new Blob([buffer], { type: 'audio/wav' });
}
