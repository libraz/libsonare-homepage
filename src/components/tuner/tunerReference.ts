/**
 * Renders the libsonare "original" reference for the tuner's A/B comparison.
 *
 * The reference is the real WASM core bouncing the current engine at its
 * baseline: for engines whose built-in defaults are audible, a near-transparent
 * wrapper over the engine default (the same `transparentPatch` recipe the parity
 * harness uses); for engines whose defaults are silent (modal / percussion /
 * pipe-organ) the named preset those parity fixtures render. The adjusted render
 * uses the TUNED spec through the TypeScript port. Both use the same note /
 * velocity / sample-rate / frame-count so they align at note-on.
 */
import { type ModelSpec, renderNoteOffline } from '@/tuner/dsp/engine';
import type { PhysicalEngineMode } from '@/tuner/dsp/params';

export const COMPARE_SR = 48000;
export const COMPARE_SECONDS = 1.5;
export const COMPARE_FRAMES = Math.round(COMPARE_SR * COMPARE_SECONDS);

/** Per-engine compare fixture: the note/velocity + baseline source. */
interface CompareFixture {
  note: number;
  velocity: number;
  /** Named WASM preset for engines whose bare default is silent. */
  preset?: string;
}

/** Notes/velocities mirror the per-engine parity fixtures for a fair baseline. */
export const COMPARE_FIXTURE: Record<PhysicalEngineMode, CompareFixture> = {
  'karplus-strong': { note: 57, velocity: 100 },
  'bowed-string': { note: 57, velocity: 100 },
  piano: { note: 57, velocity: 100 },
  modal: { note: 48, velocity: 110, preset: 'marimba' },
  percussion: { note: 47, velocity: 100, preset: 'drum-kit' },
  'pipe-organ': { note: 60, velocity: 100, preset: 'church-flute' },
  reed: { note: 50, velocity: 100 },
  brass: { note: 57, velocity: 100 },
  flute: { note: 72, velocity: 100 },
};

/** A wrapper that leaves the exciter core as bare as possible (from parity). */
function transparentPatch(engineMode: string) {
  return {
    engineMode,
    unison: 1,
    detuneCents: 0,
    driftCents: 0,
    drive: 0,
    cutoffHz: 20000,
    resonanceQ: 0.5,
    ampAttackMs: 1,
    ampDecayMs: 100000,
    ampSustain: 1,
    ampReleaseMs: 60,
    body: 'none',
    bodyMix: 0,
    stereoSpread: 0,
    gain: 1,
    polyphony: 1,
    busDrive: 0,
  };
}

/** Bounce one sustained note through a full patch object to mono PCM (from parity). */
function bounceWasm(wasm: any, patch: object, note: number, velocity: number): Float32Array {
  const project = new wasm.Project();
  try {
    project.setSampleRate(COMPARE_SR);
    const { clipId } = project.addMidiClip(0, 8);
    project.setMidiEvents(clipId, [
      wasm.Project.midiNoteOn(0, 0, 0, note, velocity),
      wasm.Project.midiNoteOff(6, 0, 0, note, 0),
    ]);
    return project.bounceWithSynthInstrument(patch, {
      numChannels: 1,
      sampleRate: COMPARE_SR,
      totalFrames: COMPARE_FRAMES,
    });
  } finally {
    project.delete();
  }
}

/** Render the libsonare baseline for an engine (main-thread WASM). */
export async function renderReference(mode: PhysicalEngineMode): Promise<Float32Array> {
  const wasm = await import('@/wasm/index.js');
  await wasm.init();
  const fixture = COMPARE_FIXTURE[mode];
  const patch = fixture.preset ? wasm.synthPresetPatch(fixture.preset) : transparentPatch(mode);
  return bounceWasm(wasm, patch, fixture.note, fixture.velocity);
}

/** Render the tuned TS model. Note/velocity default to the engine fixture, but a
 *  GM target overrides both so the adjusted trace aligns with the built-in voice. */
export function renderAdjusted(spec: ModelSpec, note?: number, velocity?: number): Float32Array {
  const fixture = COMPARE_FIXTURE[spec.engineMode];
  return renderNoteOffline(
    spec,
    note ?? fixture.note,
    velocity ?? fixture.velocity,
    COMPARE_SR,
    COMPARE_FRAMES,
  );
}

/**
 * Render the CURRENT libsonare built-in voice for a GM slot — the "today's
 * sound" the contribution aims to improve. With no SoundFont loaded,
 * `bounceWithSf2Instrument` falls through to the synth GM fallback bank (the
 * data-free floor that `gm_fallback_map.cpp` defines). The program is selected
 * with an inline program-change event (a bare `setProgram` does not take on this
 * offline path); drums play on channel 10, where the note IS the instrument.
 */
export async function renderGmFallback(
  program: number,
  note: number,
  velocity = 100,
  isDrum = false,
): Promise<Float32Array> {
  const wasm = await import('@/wasm/index.js');
  await wasm.init();
  const project = new wasm.Project();
  try {
    project.setSampleRate(COMPARE_SR);
    const { clipId } = project.addMidiClip(0, 8);
    const channel = isDrum ? 9 : 0;
    const events = isDrum ? [] : [wasm.Project.midiProgram(0, 0, channel, program)];
    events.push(
      wasm.Project.midiNoteOn(0, 0, channel, note, velocity),
      wasm.Project.midiNoteOff(6, 0, channel, note, 0),
    );
    project.setMidiEvents(clipId, events);
    return project.bounceWithSf2Instrument(
      { destinationId: 0, gain: 1 },
      { numChannels: 1, sampleRate: COMPARE_SR, totalFrames: COMPARE_FRAMES },
    );
  } finally {
    project.delete();
  }
}
