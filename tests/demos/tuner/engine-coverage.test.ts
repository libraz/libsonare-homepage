// @vitest-environment node
/**
 * Guards the premise of the whole tuner page: that both sides of its A/B are the
 * same voice.
 *
 * The page renders a GM slot through the shipped WASM core and through a TS port
 * of the model it believes voices that slot. If the core moves a slot onto an
 * engine the tuner does not implement, nothing about the UI changes — it keeps
 * offering the slot and keeps comparing two different instruments, which is
 * worse than the slot being unavailable.
 *
 * So these read the core's own engine enum out of the SHIPPED artifact rather
 * than a transcription of it, and fail the moment an engine appears that the
 * tuner has neither modelled nor declared unmodelled.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { buildDefaultSpec } from '@/demos/tuner/dsp/engine';
import { GS_DRUM_KIT_PROGRAMS, gsDrumKitIndex, isModeledGsDrumKit } from '@/demos/tuner/dsp/gs-kit';
import { ENGINE_ORDER } from '@/demos/tuner/dsp/params';
import { GS_DRUM_KITS, gmVoicing } from '@/demos/tuner/gmTargets';
import { targetFromJson } from '@/demos/tuner/tunerJson';

/** The shipped WASM facade, read for its own engine enum. */
let wasm: { SYNTH_ENGINE_MODES: string[]; init: () => Promise<unknown> };

beforeAll(async () => {
  wasm = await import('@/wasm/index.js');
  await wasm.init();
});

/**
 * Core engines no GM slot can resolve to, so the tuner needs no answer for them.
 * `default` is the enum's "inherit" sentinel; `sample` plays host-supplied PCM
 * and the GM fallback bank never selects it.
 */
const UNREACHABLE_FROM_GM = new Set(['default', 'sample']);

/** Every engine `gmVoicing` admits it cannot model, over the whole program map. */
function declaredUnmodeled(): Set<string> {
  const out = new Set<string>();
  for (let p = 0; p < 128; ++p) {
    const v = gmVoicing(p);
    if (v.kind === 'unmodeled') out.add(v.engine);
  }
  return out;
}

describe('tuner engine coverage vs the shipped core', () => {
  it('accounts for every engine the core can voice', () => {
    const modelled = new Set<string>(ENGINE_ORDER);
    const unmodeled = declaredUnmodeled();
    const unaccounted = (wasm.SYNTH_ENGINE_MODES as string[]).filter(
      (m) => !modelled.has(m) && !unmodeled.has(m) && !UNREACHABLE_FROM_GM.has(m),
    );
    // A new engine in the core lands here. Either port it, or name it in
    // `UnmodeledEngine` and point the slots it voices at it — never leave a slot
    // claiming a model the core stopped using.
    expect(unaccounted).toEqual([]);
  });

  it('names its engines the way the core spells them', () => {
    const coreModes = new Set(wasm.SYNTH_ENGINE_MODES as string[]);
    for (const engine of ENGINE_ORDER) {
      expect(coreModes.has(engine), `tuner engine '${engine}' is not a core engine`).toBe(true);
    }
    for (const engine of declaredUnmodeled()) {
      expect(coreModes.has(engine), `unmodeled engine '${engine}' is not a core engine`).toBe(true);
    }
  });

  it('offers a slot only when it can actually build that model', () => {
    for (let p = 0; p < 128; ++p) {
      const v = gmVoicing(p);
      if (v.kind !== 'physical') continue;
      expect(ENGINE_ORDER, `program ${p}`).toContain(v.engine);
      expect(buildDefaultSpec(v.engine).engineMode).toBe(v.engine);
    }
  });

  it('flags the keyboard slots the core voices off the plucked-string model', () => {
    // GM 6 is the core's own jack-and-plectrum harpsichord engine and GM 7 an FM
    // stand-in; both read as plucked strings and neither is a Karplus-Strong
    // loop, so tuning one here would compare two different instruments.
    expect(gmVoicing(6)).toEqual({ kind: 'unmodeled', engine: 'harpsichord' });
    expect(gmVoicing(7)).toEqual({ kind: 'unmodeled', engine: 'fm' });
  });
});

describe('GS drum kits the tuner offers', () => {
  it('offers exactly the kits it has a transform for', () => {
    expect(GS_DRUM_KITS.map((k) => k.program)).toEqual([...GS_DRUM_KIT_PROGRAMS]);
  });

  it('resolves a distinct kit index for every offered kit but Standard', () => {
    const seen = new Set<number>();
    for (const program of GS_DRUM_KIT_PROGRAMS) {
      const index = gsDrumKitIndex(program);
      if (program === 0) {
        expect(index).toBe(0);
        continue;
      }
      expect(index, `kit program ${program}`).toBeGreaterThan(0);
      expect(seen.has(index), `kit index ${index} is claimed twice`).toBe(false);
      seen.add(index);
    }
  });

  it('models no kit it does not offer', () => {
    for (let program = 0; program < 128; ++program) {
      if (isModeledGsDrumKit(program)) continue;
      expect(gsDrumKitIndex(program), `program ${program}`).toBe(0);
    }
  });

  it('rejects an imported target naming a kit it cannot render', () => {
    const base = { standard: 'GS', kind: 'drum', drumNote: 38, name: 'Acoustic Snare' };
    // 26 kits exist in the core; 1 (Standard 2) and 27 (past the end) are both
    // outside the nine this tool models, and absorbing either would audition the
    // Standard kit against the core's real one.
    expect(targetFromJson({ target: { ...base, drumKit: 1 } })).toBeNull();
    expect(targetFromJson({ target: { ...base, drumKit: 27 } })).toBeNull();
    expect(targetFromJson({ target: { ...base, drumKit: 'room' } })).toBeNull();
    expect(targetFromJson({ target: { ...base, drumKit: 40 } })).not.toBeNull();
    expect(targetFromJson({ target: base })).not.toBeNull();
  });
});
