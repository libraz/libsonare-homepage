// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { getDemo } from '@/demos/inline/registry';
import * as wasm from '@/wasm/index.js';

/**
 * The physical-voice audition offers every engine the `synth` archetype can
 * sound with no sample bank. Each is rendered here with the archetype's default
 * patch, so an engine that falls silent or collapses onto another fails here.
 */

const SR = 44_100;
const NOTE = 57;
const HOLD_SEC = 1.3;

function render(engineMode: string): Float32Array {
  const project = new wasm.Project();
  try {
    project.setSampleRate(SR);
    const offQuarters = HOLD_SEC / 0.5;
    const { clipId } = project.addMidiClip(0, offQuarters + 4);
    project.setMidiEvents(clipId, [
      wasm.Project.midiNoteOn(0, 0, 0, NOTE, 100),
      wasm.Project.midiNoteOff(offQuarters, 0, 0, NOTE, 0),
    ]);
    // The patch the archetype sends when only the engine selector is set.
    return project.bounceWithSynthInstrument(
      {
        engineMode,
        waveform: 'saw',
        filterModel: 'svf',
        cutoffHz: 2200,
        resonanceQ: 0.9,
        ampAttackMs: 8,
        ampDecayMs: 140,
        ampSustain: 0.75,
        ampReleaseMs: 280,
        gain: 0.5,
      } as Parameters<InstanceType<typeof wasm.Project>['bounceWithSynthInstrument']>[0],
      { numChannels: 1, sampleRate: SR, totalFrames: Math.round(SR * HOLD_SEC) },
    );
  } finally {
    project.delete();
  }
}

const modes =
  (getDemo('physical-voice-audition')?.params ?? [])
    .find((p) => p.key === 'engineMode')
    ?.options?.map((o) => String(o.value)) ?? [];

const renders = new Map<string, Float32Array>();

beforeAll(async () => {
  await wasm.init();
  for (const mode of modes) renders.set(mode, render(mode));
});

describe('physical-voice-audition', () => {
  it('offers every engine that sounds without a sample bank', () => {
    const expected = wasm.SYNTH_ENGINE_MODES.filter((m) => m !== 'default' && m !== 'sample');
    expect([...modes].sort()).toEqual([...expected].sort());
  });

  it('sounds on every engine', () => {
    // Measured quietest: plucked string at -48.7 dBFS RMS.
    for (const [mode, pcm] of renders) {
      let sum = 0;
      for (const v of pcm) sum += v * v;
      const rmsDb = 10 * Math.log10(sum / pcm.length + 1e-30);
      expect(rmsDb, mode).toBeGreaterThan(-60);
    }
  });

  it('sounds different on every engine', () => {
    // Measured closest pair: flute and vocal tract, 0.033 max sample difference.
    const list = [...renders];
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const [ma, a] = list[i];
        const [mb, b] = list[j];
        let diff = 0;
        for (let k = 0; k < a.length; k++) diff = Math.max(diff, Math.abs(a[k] - b[k]));
        expect(diff, `${ma} vs ${mb}`).toBeGreaterThan(1e-3);
      }
    }
  });
});
