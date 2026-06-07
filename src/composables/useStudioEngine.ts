import { ref, shallowRef } from 'vue';
import {
  BAR_PPQ,
  STEP_COUNT,
  STUDIO_TRACKS,
  type StudioPattern,
} from '@/components/studio/studioCopy';

type WasmModule = typeof import('@/wasm/index.js');

const SAMPLE_RATE = 48000;
/** Loop-edge fade (seconds) so cut release tails do not click on wrap. */
const LOOP_FADE_S = 0.005;

export interface StudioStemView {
  /** Per-bucket min/max of the stem's left channel, for clip drawing. */
  min: Float32Array;
  max: Float32Array;
}

/**
 * The Studio Mini engine: turns the step pattern into a libsonare Project
 * (one MIDI clip per track, each routed to its own NativeSynth destination),
 * bounces per-track stems offline, and loops them through Web Audio with
 * per-track gain, mute, and post-fader meters.
 */
export function useStudioEngine() {
  const ready = ref(false);
  const starting = ref(false);
  const error = ref<string | null>(null);
  const playing = ref(false);
  const rendering = ref(false);
  /** Loop phase 0..1 while playing. */
  const position = ref(0);
  /** Post-fader peak per track (linear 0..1+). */
  const levels = ref<number[]>(STUDIO_TRACKS.map(() => 0));
  /** Post-master-fader peak (linear 0..1+). */
  const masterLevel = ref(0);
  const stemViews = shallowRef<StudioStemView[]>([]);
  const libVersion = ref('');

  let wasm: WasmModule | null = null;
  let context: AudioContext | null = null;
  let masterGain: GainNode | null = null;
  let masterAnalyser: AnalyserNode | null = null;
  let trackGains: GainNode[] = [];
  let analysers: AnalyserNode[] = [];
  let sources: AudioBufferSourceNode[] = [];
  let buffers: AudioBuffer[] = [];
  const gains: number[] = STUDIO_TRACKS.map(() => 0.9);
  const mutes: boolean[] = STUDIO_TRACKS.map(() => false);
  let loopStart = 0;
  let loopDuration = 2;
  let rafId = 0;
  let meterScratch: Float32Array | null = null;
  /** One-shot pad-preview buffers, keyed `track:row` (presets are fixed). */
  const auditionCache = new Map<string, AudioBuffer>();
  let auditioning = 0;
  let auditionRaf = 0;

  /**
   * Boot the WASM module and audio graph. Safe to call without a user gesture:
   * the context boots suspended (offline bounces still work) and `play()` —
   * always a click — resumes it.
   */
  async function start(): Promise<boolean> {
    if (ready.value) {
      return true;
    }
    if (starting.value) return false;
    starting.value = true;
    error.value = null;
    try {
      const mod = await import('@/wasm/index.js');
      await mod.init();
      wasm = mod;
      libVersion.value = mod.version();

      const ctx = new AudioContext({ latencyHint: 'interactive' });
      context = ctx;
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.9;
      masterAnalyser = ctx.createAnalyser();
      masterAnalyser.fftSize = 512;
      masterGain.connect(masterAnalyser);
      masterAnalyser.connect(ctx.destination);
      trackGains = STUDIO_TRACKS.map((_, i) => {
        const gain = ctx.createGain();
        gain.gain.value = mutes[i] ? 0 : gains[i];
        return gain;
      });
      analysers = STUDIO_TRACKS.map(() => {
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        return analyser;
      });
      for (let i = 0; i < trackGains.length; i++) {
        trackGains[i].connect(analysers[i]);
        analysers[i].connect(masterGain);
      }
      ready.value = true;
      return true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
      return false;
    } finally {
      starting.value = false;
    }
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
    project.setSampleRate(SAMPLE_RATE);
    project.setTempoSegments([{ startPpq: 0, bpm }]);
    const { trackId, clipId } = project.addMidiClip(0, BAR_PPQ * bars);
    project.setTrackMidiDestination(trackId, def.destination);
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
          sampleRate: SAMPLE_RATE,
          totalFrames,
        },
      );
    } finally {
      project.delete();
    }
  }

  function loopFrames(bpm: number): number {
    return Math.round((SAMPLE_RATE * BAR_PPQ * 60) / bpm);
  }

  /**
   * Re-bounce every stem for the current pattern/tempo, swap the loop buffers,
   * and (when playing) restart the sources at the preserved loop phase.
   */
  function rebuild(pattern: StudioPattern, bpm: number): void {
    const mod = wasm;
    const ctx = context;
    if (!mod || !ctx) return;
    rendering.value = true;
    try {
      const frames = loopFrames(bpm);
      const fadeFrames = Math.min(frames, Math.round(SAMPLE_RATE * LOOP_FADE_S));
      const nextBuffers: AudioBuffer[] = [];
      const views: StudioStemView[] = [];
      for (let i = 0; i < STUDIO_TRACKS.length; i++) {
        const interleaved = bounceStem(mod, pattern, i, bpm, frames);
        const buffer = ctx.createBuffer(2, frames, SAMPLE_RATE);
        for (let ch = 0; ch < 2; ch++) {
          const dst = buffer.getChannelData(ch);
          for (let f = 0; f < frames; f++) dst[f] = interleaved[f * 2 + ch];
          for (let f = 0; f < fadeFrames; f++) {
            dst[frames - 1 - f] *= f / fadeFrames;
          }
        }
        nextBuffers.push(buffer);
        const report = mod.waveformPeaks(interleaved, 2, {
          samplesPerBucket: Math.max(64, Math.floor(frames / 240)),
        });
        const buckets = report.bucketCount;
        views.push({ min: report.min.subarray(0, buckets), max: report.max.subarray(0, buckets) });
      }
      buffers = nextBuffers;
      stemViews.value = views;
      const phase = playing.value ? currentPhase() : 0;
      loopDuration = frames / SAMPLE_RATE;
      if (playing.value) restartSources(phase * loopDuration);
    } finally {
      rendering.value = false;
    }
  }

  function currentPhase(): number {
    if (!context || loopDuration <= 0) return 0;
    const elapsed = context.currentTime - loopStart;
    return (((elapsed % loopDuration) + loopDuration) % loopDuration) / loopDuration;
  }

  function stopSources(): void {
    for (const source of sources) {
      try {
        source.stop();
      } catch {
        /* never started or already stopped */
      }
      source.disconnect();
    }
    sources = [];
  }

  function restartSources(offsetSeconds: number): void {
    const ctx = context;
    if (!ctx || buffers.length === 0) return;
    stopSources();
    const when = ctx.currentTime + 0.02;
    sources = buffers.map((buffer, i) => {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(trackGains[i]);
      source.start(when, offsetSeconds % loopDuration);
      return source;
    });
    loopStart = when - (offsetSeconds % loopDuration);
  }

  function play(): void {
    if (!ready.value || playing.value || buffers.length === 0) return;
    // Called from a click — this is the gesture that unlocks the context.
    if (context && context.state !== 'running') void context.resume();
    playing.value = true;
    restartSources(0);
    tick();
  }

  function stop(): void {
    playing.value = false;
    stopSources();
    cancelAnimationFrame(rafId);
    position.value = 0;
    levels.value = STUDIO_TRACKS.map(() => 0);
  }

  function analyserPeak(analyser: AnalyserNode): number {
    if (!meterScratch || meterScratch.length < analyser.fftSize) {
      meterScratch = new Float32Array(analyser.fftSize);
    }
    analyser.getFloatTimeDomainData(meterScratch.subarray(0, analyser.fftSize));
    let peak = 0;
    for (let f = 0; f < analyser.fftSize; f++) {
      const a = Math.abs(meterScratch[f]);
      if (a > peak) peak = a;
    }
    return peak;
  }

  /** Refresh per-track and master meters from the analysers (with decay). */
  function updateMeters(): void {
    const nextLevels = levels.value.slice();
    for (let i = 0; i < analysers.length; i++) {
      nextLevels[i] = Math.max(analyserPeak(analysers[i]), nextLevels[i] * 0.86);
    }
    levels.value = nextLevels;
    if (masterAnalyser) {
      masterLevel.value = Math.max(analyserPeak(masterAnalyser), masterLevel.value * 0.86);
    }
  }

  function tick(): void {
    if (!playing.value) return;
    position.value = currentPhase();
    updateMeters();
    rafId = requestAnimationFrame(tick);
  }

  /**
   * Render (and cache) the one-shot preview for a pad: the row's note played
   * once through the track's NativeSynth preset, release tail included.
   */
  function renderAuditionBuffer(
    mod: WasmModule,
    ctx: AudioContext,
    trackIndex: number,
    rowIndex: number,
  ): AudioBuffer {
    const key = `${trackIndex}:${rowIndex}`;
    const cached = auditionCache.get(key);
    if (cached) return cached;
    const def = STUDIO_TRACKS[trackIndex];
    const project = new mod.Project();
    project.setSampleRate(SAMPLE_RATE);
    project.setTempoSegments([{ startPpq: 0, bpm: 120 }]);
    const { trackId, clipId } = project.addMidiClip(0, 1);
    project.setTrackMidiDestination(trackId, def.destination);
    project.setMidiEvents(clipId, [
      mod.Project.midiNoteOn(0, 0, 0, def.rows[rowIndex].note, def.velocity),
      mod.Project.midiNoteOff(def.gatePpq, 0, 0, def.rows[rowIndex].note, 0),
    ]);
    try {
      // Capped length: enough for the note plus an audible release tail
      // (auto-derived length pads out to several near-silent seconds).
      const interleaved = project.bounceWithSynthInstrument(
        [{ preset: def.preset, destinationId: def.destination }],
        { numChannels: 2, sampleRate: SAMPLE_RATE, totalFrames: Math.round(SAMPLE_RATE * 1.5) },
      );
      const frames = interleaved.length / 2;
      const buffer = ctx.createBuffer(2, frames, SAMPLE_RATE);
      for (let ch = 0; ch < 2; ch++) {
        const dst = buffer.getChannelData(ch);
        for (let f = 0; f < frames; f++) dst[f] = interleaved[f * 2 + ch];
      }
      auditionCache.set(key, buffer);
      return buffer;
    } finally {
      project.delete();
    }
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
   * Preview one pad's note through its channel strip (fader and mute apply).
   * Called from a pad click — the gesture that may resume the context.
   */
  function audition(trackIndex: number, rowIndex: number): void {
    const mod = wasm;
    const ctx = context;
    if (!mod || !ctx || !ready.value) return;
    if (ctx.state !== 'running') void ctx.resume();
    const source = ctx.createBufferSource();
    source.buffer = renderAuditionBuffer(mod, ctx, trackIndex, rowIndex);
    source.connect(trackGains[trackIndex]);
    auditioning++;
    source.onended = () => {
      auditioning--;
      source.disconnect();
    };
    source.start();
    cancelAnimationFrame(auditionRaf);
    auditionRaf = requestAnimationFrame(auditionTick);
  }

  function setTrackGain(index: number, value: number): void {
    gains[index] = value;
    if (trackGains[index]) trackGains[index].gain.value = mutes[index] ? 0 : value;
  }

  function setTrackMute(index: number, muted: boolean): void {
    mutes[index] = muted;
    if (trackGains[index]) trackGains[index].gain.value = muted ? 0 : gains[index];
  }

  function setMasterGain(value: number): void {
    if (masterGain) masterGain.gain.value = value;
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
          { numChannels: 2, sampleRate: SAMPLE_RATE },
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
    return encodeWav(mix, SAMPLE_RATE, 2);
  }

  async function dispose(): Promise<void> {
    stop();
    cancelAnimationFrame(auditionRaf);
    auditionCache.clear();
    auditioning = 0;
    ready.value = false;
    trackGains = [];
    analysers = [];
    masterAnalyser = null;
    masterGain = null;
    masterLevel.value = 0;
    buffers = [];
    stemViews.value = [];
    if (context) {
      try {
        await context.close();
      } catch {
        /* already closed */
      }
      context = null;
    }
  }

  return {
    ready,
    starting,
    error,
    playing,
    rendering,
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
