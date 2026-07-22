import { describe, expect, it } from 'vitest';
import { tempoGrid } from '@/demos/audio/processors';
import { getDemo } from '@/demos/registry';

describe('tempoGrid', () => {
  it('labels 4/4 and 3/4 with a quarter-note denominator', () => {
    expect(tempoGrid(120, '4').label).toBe('4/4');
    expect(tempoGrid(120, '3').label).toBe('3/4');

    // Quarter-note beats at 120 BPM are 0.5 s; the bar is that times the numerator.
    expect(tempoGrid(120, '4').secPerBeat).toBeCloseTo(0.5, 6);
    expect(tempoGrid(120, '4').secPerBar).toBeCloseTo(2, 6);
    expect(tempoGrid(120, '3').secPerBar).toBeCloseTo(1.5, 6);
  });

  it('treats the 6 option as 6/8, not 6/4', () => {
    const grid = tempoGrid(120, '6');

    expect(grid.label).toBe('6/8');
    expect(grid.label).not.toBe('6/4');
    expect(grid.beatsPerBar).toBe(6);
    expect(grid.denominator).toBe(8);

    // An eighth-note beat is half a quarter-note beat: 0.25 s at 120 BPM.
    expect(grid.secPerBeat).toBeCloseTo(0.25, 6);
    // A 6/8 bar spans six eighth notes = three quarter notes, matching a 3/4 bar,
    // not the six quarter notes a 6/4 misread would give.
    expect(grid.secPerBar).toBeCloseTo(1.5, 6);
    expect(grid.secPerBar).toBeCloseTo(tempoGrid(120, '3').secPerBar, 6);
  });

  it('keeps the tick (PPQ) unit tied to the quarter note regardless of denominator', () => {
    // secPerQuarter drives the tick readout; it must not follow the beat unit.
    expect(tempoGrid(120, '6').secPerQuarter).toBeCloseTo(0.5, 6);
    expect(tempoGrid(120, '4').secPerQuarter).toBeCloseTo(0.5, 6);
  });

  it("covers every value the demo's beats select offers", () => {
    const def = getDemo('tempo-grid');
    if (!def) throw new Error('tempo-grid not registered');
    const beats = def.params?.find((p) => p.key === 'beats');
    const expected: Record<string, string> = { '3': '3/4', '4': '4/4', '6': '6/8' };
    for (const opt of beats?.options ?? []) {
      // Each select value derives a label matching the option's own displayed text.
      expect(tempoGrid(120, opt.value).label).toBe(expected[opt.value]);
      expect(opt.label.en).toBe(expected[opt.value]);
    }
  });
});
