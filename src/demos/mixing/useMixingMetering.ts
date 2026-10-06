/**
 * Live metering for /mixing. Engine meter telemetry covers the master (peak,
 * RMS, true peak, M/S/I, correlation, GR), every lane (input peak before trim,
 * post-fader peak/RMS, the deepest and each insert's GR) and both aux buses. Snapshots arrive
 * at the engine's meter rate and are folded into one frame per animation
 * frame. Spectrum and goniometer come from an analyser tap on the engine
 * output; the selected track's source spectrum at the playhead feeds the EQ.
 */
import { type ShallowRef, shallowRef, watch } from 'vue';
import { METER_FLOOR_DB } from '@/components/meters/meterBallistics';
import {
  SCOPE_TAP_FFT_SIZE,
  type ScopeTap,
  type ScopeTapWasm,
  useScopeTap,
} from '@/composables/useScopeTap';
import {
  heldTruePeakDb,
  type SonareMeterSnapshot,
  type UseSonareEngine,
} from '@/composables/useSonareEngine';
import type { MixAudio } from '@/demos/mixing/mixingEngine';
import { AUX_BUSES, type AuxBusName, type MixTrackState } from '@/demos/mixing/mixingState';
import { meterSources } from '@/demos/mixing/mixingUi';

export interface StripReading {
  /** Strip input before trim, dBFS. */
  inputPeakDb: [number, number];
  /** Post-fader sample peak, dBFS. */
  peakDb: [number, number];
  rmsDb: [number, number];
  /** The deepest gain reduction among the strip's inserts, dB ≤ 0. */
  grDb: number;
  /**
   * Each insert's own gain reduction, dB ≤ 0, in the strip's insert order.
   * Empty until the engine reports it; the last report is kept between drains.
   */
  insertGrDb: readonly number[];
  correlation: number;
}

export interface MasterReading extends StripReading {
  /** Highest true peak since the last reset (playback start), never below a sample peak seen. */
  truePeakDb: number;
  momentaryLufs: number;
  shortTermLufs: number;
  integratedLufs: number;
}

export interface MixMeterFrame {
  master: MasterReading;
  tracks: Readonly<Record<number, StripReading>>;
  buses: Readonly<Record<AuxBusName, StripReading>>;
}

const FLOOR: [number, number] = [METER_FLOOR_DB, METER_FLOOR_DB];

export function silentStrip(): StripReading {
  return {
    inputPeakDb: [...FLOOR],
    peakDb: [...FLOOR],
    rmsDb: [...FLOOR],
    grDb: 0,
    insertGrDb: [],
    correlation: 1,
  };
}

export function silentFrame(): MixMeterFrame {
  return {
    master: {
      ...silentStrip(),
      truePeakDb: METER_FLOOR_DB,
      momentaryLufs: Number.NEGATIVE_INFINITY,
      shortTermLufs: Number.NEGATIVE_INFINITY,
      integratedLufs: Number.NEGATIVE_INFINITY,
    },
    tracks: {},
    buses: Object.fromEntries(AUX_BUSES.map((bus) => [bus, silentStrip()])) as Record<
      AuxBusName,
      StripReading
    >,
  };
}

function stripOf(meter: SonareMeterSnapshot, previous?: StripReading): StripReading {
  return {
    inputPeakDb: [meter.inputPeakDbL, meter.inputPeakDbR],
    peakDb: [meter.peakDbL, meter.peakDbR],
    rmsDb: [meter.rmsDbL, meter.rmsDbR],
    grDb: Math.min(0, meter.gainReductionDb),
    // Only the newest record of a drain carries the per-insert array.
    insertGrDb: meter.insertGainReductionDb ?? previous?.insertGrDb ?? [],
    correlation: meter.correlation,
  };
}

/** Folds one snapshot into `frame`; lanes are mapped through `laneOrder` (track ids in lane order). */
export function applyMixMeter(
  frame: MixMeterFrame,
  meter: SonareMeterSnapshot,
  laneOrder: readonly number[],
): MixMeterFrame {
  const source = meterSources(laneOrder).get(meter.targetId);
  if (!source) return frame;
  if (source.kind === 'master') {
    return {
      ...frame,
      master: {
        ...stripOf(meter, frame.master),
        truePeakDb: heldTruePeakDb(frame.master.truePeakDb, meter),
        momentaryLufs: meter.momentaryLufs,
        shortTermLufs: meter.shortTermLufs,
        integratedLufs: meter.integratedLufs,
      },
    };
  }
  if (source.kind === 'track') {
    return {
      ...frame,
      tracks: { ...frame.tracks, [source.trackId]: stripOf(meter, frame.tracks[source.trackId]) },
    };
  }
  return {
    ...frame,
    buses: { ...frame.buses, [source.bus]: stripOf(meter, frame.buses[source.bus]) },
  };
}

/**
 * The mid-summed source window of `track` ending at timeline `seconds`; zeros
 * outside the clip, null while the PCM is lent to the Worker.
 */
export function trackWindow(
  audio: MixAudio | undefined,
  track: MixTrackState,
  seconds: number,
  size = SCOPE_TAP_FFT_SIZE,
  out = new Float32Array(size),
): Float32Array | null {
  const [left, right = left] = audio?.channels ?? [];
  if (!audio || !left || left.byteLength === 0 || right.byteLength === 0) return null;
  const frames = Math.min(left.length, right.length);
  const sourceAt = seconds - track.clip.startSec + track.clip.trimStartSec;
  const end = Math.round(sourceAt * audio.sampleRate);
  const startLimit = Math.round(track.clip.trimStartSec * audio.sampleRate);
  for (let i = 0; i < size; i++) {
    const at = end - size + i;
    out[i] = at >= startLimit && at < frames ? 0.5 * (left[at] + right[at]) : 0;
  }
  return out;
}

export interface MixingMeteringOptions {
  sonare: UseSonareEngine;
  wasm: ShallowRef<ScopeTapWasm | null>;
  /** Track ids in the engine's lane order. */
  laneOrder: () => readonly number[];
  /** The selected track and its audio, read for the EQ view's input spectrum. */
  selected: () => { track: MixTrackState; audio: MixAudio | undefined } | null;
}

export interface MixingMetering {
  frame: ShallowRef<MixMeterFrame>;
  spectrumFreqs: ShallowRef<Float32Array | null>;
  outputDb: ShallowRef<Float32Array | null>;
  /** Selected track's source spectrum at the playhead (before its EQ). */
  trackDb: ShallowRef<Float32Array | null>;
  scopeMid: ShallowRef<Float32Array | null>;
  scopeSide: ShallowRef<Float32Array | null>;
  /** Returns the meters to the floor. */
  reset(): void;
  dispose(): void;
}

export function useMixingMetering(options: MixingMeteringOptions): MixingMetering {
  const { sonare } = options;
  const frame = shallowRef<MixMeterFrame>(silentFrame());
  const spectrumFreqs = shallowRef<Float32Array | null>(null);
  const outputDb = shallowRef<Float32Array | null>(null);
  const trackDb = shallowRef<Float32Array | null>(null);
  const scopeMid = shallowRef<Float32Array | null>(null);
  const scopeSide = shallowRef<Float32Array | null>(null);
  const windowBuffer = new Float32Array(SCOPE_TAP_FFT_SIZE);
  const stops: Array<() => void> = [];
  let tap: ScopeTap | null = null;
  let pending: MixMeterFrame | null = null;
  let raf = 0;

  function flush(): void {
    raf = 0;
    if (pending) frame.value = pending;
    pending = null;
  }

  stops.push(
    sonare.onMeter((meter) => {
      pending = applyMixMeter(pending ?? frame.value, meter, options.laneOrder());
      if (!raf) raf = requestAnimationFrame(flush);
    }),
  );

  function analyseTrack(): void {
    const wasm = options.wasm.value;
    const context = sonare.context.value;
    const selected = options.selected();
    if (!wasm || !context || !selected) {
      trackDb.value = null;
      return;
    }
    const samples = trackWindow(
      selected.audio,
      selected.track,
      sonare.position.value,
      SCOPE_TAP_FFT_SIZE,
      windowBuffer,
    );
    trackDb.value = samples
      ? wasm.meteringSpectrumFrame({
          samples,
          sampleRate: selected.audio?.sampleRate ?? context.sampleRate,
          nFft: SCOPE_TAP_FFT_SIZE,
          frameOffset: 0,
        }).db
      : null;
  }

  stops.push(
    watch(
      [sonare.outputNode, options.wasm],
      ([node, wasm]) => {
        tap?.dispose();
        tap = null;
        const context = sonare.context.value;
        if (!node || !wasm || !context) return;
        tap = useScopeTap(context, node, { wasm });
        const current = tap;
        stops.push(
          watch(current.spectrum, (spectrum) => {
            if (!spectrum) return;
            spectrumFreqs.value = spectrum.freqs;
            outputDb.value = spectrum.db[0];
            analyseTrack();
          }),
          watch(current.scope, (scope) => {
            scopeMid.value = scope?.mid ?? null;
            scopeSide.value = scope?.side ?? null;
          }),
        );
      },
      { immediate: true },
    ),
  );

  function reset(): void {
    pending = null;
    frame.value = silentFrame();
  }

  function dispose(): void {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    for (const stop of stops.splice(0)) stop();
    tap?.dispose();
    tap = null;
  }

  return { frame, spectrumFreqs, outputDb, trackDb, scopeMid, scopeSide, reset, dispose };
}
