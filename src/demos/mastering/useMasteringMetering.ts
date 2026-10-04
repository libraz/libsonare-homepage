/**
 * Live metering for /mastering. Meter telemetry from the engine: the master
 * (what is being heard: peak, RMS, true peak, M/S/I, correlation) and lane 1
 * (the deepest gain reduction among its inserts and its input peak). Spectrum
 * and goniometer come from an analyser tap on the engine output; the input
 * spectrum is the program PCM at the playhead, analysed the same way, so the
 * EQ view can lay input and output over each other.
 */
import { type Ref, type ShallowRef, shallowRef, watch } from 'vue';
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
import type { MasteringClip } from '@/demos/mastering/masteringEngine';

/** Meter target of the master bus. */
export const MASTER_METER_TARGET = 0;
/** Meter target of lane 1 ("After"): lanes are numbered from 1 in lane order. */
export const AFTER_METER_TARGET = 1;

/** One reading of every live meter, at the floor until telemetry arrives. */
export interface MasteringMeterReading {
  inputPeakDb: [number, number];
  peakDb: [number, number];
  rmsDb: [number, number];
  /** Highest true peak since the last reset (playback start), never below a sample peak seen. */
  truePeakDb: number;
  momentaryLufs: number;
  shortTermLufs: number;
  integratedLufs: number;
  correlation: number;
  /** The deepest gain reduction among lane 1's inserts, dB ≤ 0. */
  grDb: number;
}

export function silentReading(): MasteringMeterReading {
  return {
    inputPeakDb: [METER_FLOOR_DB, METER_FLOOR_DB],
    peakDb: [METER_FLOOR_DB, METER_FLOOR_DB],
    rmsDb: [METER_FLOOR_DB, METER_FLOOR_DB],
    truePeakDb: METER_FLOOR_DB,
    momentaryLufs: Number.NEGATIVE_INFINITY,
    shortTermLufs: Number.NEGATIVE_INFINITY,
    integratedLufs: Number.NEGATIVE_INFINITY,
    correlation: 1,
    grDb: 0,
  };
}

/**
 * Folds one meter snapshot into the reading; other targets leave it unchanged.
 * Peaks and loudness are the snapshot's own interval; the true peak is held at
 * its maximum, as the peak meters hold theirs, so the two never disagree.
 */
export function applyMeterSnapshot(
  reading: MasteringMeterReading,
  meter: SonareMeterSnapshot,
): MasteringMeterReading {
  if (meter.targetId === MASTER_METER_TARGET) {
    return {
      ...reading,
      peakDb: [meter.peakDbL, meter.peakDbR],
      rmsDb: [meter.rmsDbL, meter.rmsDbR],
      truePeakDb: heldTruePeakDb(reading.truePeakDb, meter),
      momentaryLufs: meter.momentaryLufs,
      shortTermLufs: meter.shortTermLufs,
      integratedLufs: meter.integratedLufs,
      correlation: meter.correlation,
    };
  }
  if (meter.targetId === AFTER_METER_TARGET) {
    return {
      ...reading,
      inputPeakDb: [meter.inputPeakDbL, meter.inputPeakDbR],
      grDb: Math.min(0, meter.gainReductionDb),
    };
  }
  return reading;
}

/** The mid-summed program window ending at `seconds`; null while the PCM is in the Worker. */
export function programWindow(
  program: MasteringClip | undefined,
  seconds: number,
  size = SCOPE_TAP_FFT_SIZE,
  out = new Float32Array(size),
): Float32Array | null {
  if (!program || program.left.byteLength === 0 || program.right.byteLength === 0) return null;
  const frames = Math.min(program.left.length, program.right.length);
  const start = Math.round(seconds * program.sampleRate) - size;
  for (let i = 0; i < size; i++) {
    const at = start + i;
    out[i] = at >= 0 && at < frames ? 0.5 * (program.left[at] + program.right[at]) : 0;
  }
  return out;
}

export interface MasteringMeteringOptions {
  sonare: UseSonareEngine;
  /** Loaded WASM module, once the engine has booted. */
  wasm: ShallowRef<ScopeTapWasm | null>;
  /** The program clip, read for the input spectrum. */
  program: () => MasteringClip | undefined;
}

export interface MasteringMetering {
  reading: Ref<MasteringMeterReading>;
  /** Output spectrum (what is heard), bin frequencies shared with `inputDb`. */
  spectrumFreqs: ShallowRef<Float32Array | null>;
  outputDb: ShallowRef<Float32Array | null>;
  inputDb: ShallowRef<Float32Array | null>;
  scopeMid: ShallowRef<Float32Array | null>;
  scopeSide: ShallowRef<Float32Array | null>;
  /** Returns the meters to the floor (on playback start and on a new source). */
  reset(): void;
  dispose(): void;
}

export function useMasteringMetering(options: MasteringMeteringOptions): MasteringMetering {
  const { sonare } = options;
  const reading = shallowRef<MasteringMeterReading>(silentReading());
  const spectrumFreqs = shallowRef<Float32Array | null>(null);
  const outputDb = shallowRef<Float32Array | null>(null);
  const inputDb = shallowRef<Float32Array | null>(null);
  const scopeMid = shallowRef<Float32Array | null>(null);
  const scopeSide = shallowRef<Float32Array | null>(null);
  const windowBuffer = new Float32Array(SCOPE_TAP_FFT_SIZE);
  let tap: ScopeTap | null = null;
  const stops: Array<() => void> = [];

  stops.push(
    sonare.onMeter((meter) => {
      reading.value = applyMeterSnapshot(reading.value, meter);
    }),
  );

  function analyseInput(): void {
    const wasm = options.wasm.value;
    const context = sonare.context.value;
    if (!wasm || !context) return;
    const samples = programWindow(
      options.program(),
      sonare.position.value,
      SCOPE_TAP_FFT_SIZE,
      windowBuffer,
    );
    if (!samples) {
      inputDb.value = null;
      return;
    }
    const frame = wasm.meteringSpectrumFrame({
      samples,
      sampleRate: context.sampleRate,
      nFft: SCOPE_TAP_FFT_SIZE,
      frameOffset: 0,
    });
    inputDb.value = frame.db;
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
            analyseInput();
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
    reading.value = silentReading();
  }

  function dispose(): void {
    for (const stop of stops.splice(0)) stop();
    tap?.dispose();
    tap = null;
  }

  return { reading, spectrumFreqs, outputDb, inputDb, scopeMid, scopeSide, reset, dispose };
}
