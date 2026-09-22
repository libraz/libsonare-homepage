import { describe, expect, it } from 'vitest';
import { renderNotes } from '@/demos/spatial/renderNotes';

const clamped = {
  code: 'acoustic.rir_length_clamped',
  message: 'synthesized RIR length exceeded max_seconds and was clamped',
  severity: 'warning' as const,
};

describe('renderNotes', () => {
  it('passes on a tail cut while the decay is still running, with how far down it was', () => {
    // A cathedral morph: a 6 s tail on a 9.5 s decay stops 38 dB down.
    const [note] = renderNotes([clamped], { seconds: 6, rt60: 9.5 });
    expect(note).toMatchObject({ kind: 'tailCut', seconds: 6 });
    expect(note.kind === 'tailCut' && note.decayDb).toBeCloseTo(37.9, 1);
  });

  it('drops a cut that lands after the decay has fallen 60 dB', () => {
    // The engine still warns here: a hall impulse cut at 4.68 s on a 3.9 s decay.
    expect(renderNotes([clamped], { seconds: 4.68, rt60: 3.9 })).toEqual([]);
  });

  it('reports each kind once when both channels of a stereo render say it', () => {
    const notes = renderNotes([clamped, clamped], { seconds: 6, rt60: 9.5 });
    expect(notes).toHaveLength(1);
  });

  it('always passes on a render that went through a different room', () => {
    const notes = renderNotes(
      [
        { code: 'acoustic.ism_order_clamped', message: '', severity: 'warning' },
        { code: 'acoustic.rir_length_floored', message: '', severity: 'warning' },
        { code: 'acoustic.no_late_tail', message: '', severity: 'warning' },
      ],
      { seconds: 2.5, rt60: 0.3 },
    );
    expect(notes.map((note) => note.kind)).toEqual([
      'reflectionsReduced',
      'lengthExtended',
      'noLateTail',
    ]);
  });

  it("falls back to the engine's own words for a code it does not know", () => {
    const notes = renderNotes(
      [
        { code: 'acoustic.something_new', message: 'a new warning', severity: 'warning' },
        { code: 'acoustic.just_saying', message: 'fyi', severity: 'info' },
      ],
      { seconds: 2.5, rt60: 0.3 },
    );
    expect(notes).toEqual([{ kind: 'engine', message: 'a new warning' }]);
  });
});
