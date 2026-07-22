import { describe, expect, it, vi } from 'vitest';
import type { ParsedMidi } from '@/components/practice/midiSmf';
import { type Judgment, useRhythmGame } from '@/components/practice/useRhythmGame';

/** Build a minimal ParsedMidi carrying only the fields the game reads. */
function chart(notes: Array<{ midi: number; startSec: number }>): ParsedMidi {
  return { notes: notes.map((n) => ({ ...n })) } as unknown as ParsedMidi;
}

function newGame() {
  const onJudge = vi.fn((_kind: Judgment, _midi: number) => {});
  const game = useRhythmGame({ onJudge });
  return { game, onJudge };
}

describe('useRhythmGame scoring', () => {
  it('grades a strike by absolute distance, inclusive of each window bound', () => {
    const cases: Array<[number, Judgment | null]> = [
      [0.0, 'perfect'],
      [0.05, 'perfect'], // == PERFECT_SEC, still perfect (<=)
      [0.06, 'great'],
      [0.1, 'great'], // == GREAT_SEC
      [0.11, 'good'],
      [0.16, 'good'], // == GOOD_SEC / HIT_WINDOW, still a hit
    ];
    for (const [at, expected] of cases) {
      const { game } = newGame();
      game.reset(chart([{ midi: 60, startSec: 0 }]));
      expect(game.press(60, at)).toBe(expected);
    }
  });

  it('picks the nearest same-pitch target and leaves the others pending', () => {
    const { game } = newGame();
    game.reset(
      chart([
        { midi: 60, startSec: 1.0 },
        { midi: 60, startSec: 1.5 },
      ]),
    );
    // At 1.5 the nearest target is the 1.5 one (delta 0), not the 1.0 one (0.5):
    // selecting the far target would grade as a wrong-note miss instead.
    expect(game.press(60, 1.5)).toBe('perfect');
    // The 1.0 target is still pending, so a strike on it still lands.
    expect(game.press(60, 1.0)).toBe('perfect');
    expect(game.counts.perfect).toBe(2);
    expect(game.counts.miss).toBe(0);
  });

  it('ignores an early warm-up tap (target still in the future) without penalty', () => {
    const { game, onJudge } = newGame();
    game.reset(chart([{ midi: 60, startSec: 2.0 }]));
    // Build a little combo first so we can prove it is preserved.
    game.reset(chart([{ midi: 60, startSec: 2.0 }]));
    expect(game.press(60, 1.0)).toBeNull();
    expect(game.counts.miss).toBe(0);
    expect(game.judged.value).toBe(0);
    expect(onJudge).not.toHaveBeenCalled();
  });

  it('counts a wrong note (no target of that pitch) as a combo-breaking miss', () => {
    const { game } = newGame();
    game.reset(chart([{ midi: 60, startSec: 1.0 }]));
    game.press(60, 1.0); // hit → combo 1
    expect(game.combo.value).toBe(1);
    expect(game.press(72, 1.0)).toBe('miss'); // no pitch-72 target
    expect(game.combo.value).toBe(0);
    expect(game.counts.miss).toBe(1);
    expect(game.judged.value).toBe(1); // the wrong note consumed no target
  });

  it('does NOT double-count a late correct tap as two misses (M-18 regression)', () => {
    const { game, onJudge } = newGame();
    game.reset(chart([{ midi: 60, startSec: 1.0 }]));
    // Tapped the right pitch but 0.2 s late — past the 0.16 s hit window.
    expect(game.press(60, 1.2)).toBe('miss');
    // The update() sweep at a later playhead must not miss the same target again.
    game.update(1.5);
    expect(game.counts.miss).toBe(1);
    expect(game.judged.value).toBe(1);
    expect(onJudge).toHaveBeenCalledTimes(1);
    expect(onJudge).toHaveBeenCalledWith('miss', 60);
  });

  it('marks notes that scroll past the strike line as misses exactly once', () => {
    const { game, onJudge } = newGame();
    game.reset(chart([{ midi: 60, startSec: 1.0 }]));
    game.update(1.5); // 0.5 s past → beyond the hit window
    game.update(2.0); // sweeping again must not re-miss the resolved target
    expect(game.counts.miss).toBe(1);
    expect(onJudge).toHaveBeenCalledTimes(1);
  });

  it('caps the combo multiplier at 2x while the combo keeps climbing', () => {
    const { game } = newGame();
    const notes = Array.from({ length: 60 }, (_, i) => ({ midi: 60, startSec: i }));
    game.reset(chart(notes));
    for (let i = 0; i < 50; i++) game.press(60, i); // 50 perfect hits
    const before = game.score.value;
    expect(game.press(60, 50)).toBe('perfect'); // 51st hit
    expect(game.combo.value).toBe(51); // combo still climbing past the cap
    // Multiplier is capped at 1 + 50 * 0.02 = 2, so a perfect adds 300 * 2 = 600.
    expect(game.score.value - before).toBe(600);
  });

  it('reports a clean run as a Full Combo with an S+ rank', () => {
    const { game } = newGame();
    game.reset(
      chart([
        { midi: 60, startSec: 0 },
        { midi: 62, startSec: 1 },
        { midi: 64, startSec: 2 },
      ]),
    );
    game.press(60, 0);
    game.press(62, 1);
    game.press(64, 2);
    expect(game.counts.miss).toBe(0);
    expect(game.accuracy()).toBe(100);
    expect(game.fullCombo()).toBe(true);
    expect(game.rank()).toBe('S+');
  });

  it('withholds Full Combo once any note is missed', () => {
    const { game } = newGame();
    game.reset(
      chart([
        { midi: 60, startSec: 0 },
        { midi: 62, startSec: 1 },
        { midi: 64, startSec: 2 },
      ]),
    );
    game.press(60, 0);
    game.press(62, 1);
    game.update(3); // the 64 note scrolls past unplayed
    expect(game.counts.miss).toBe(1);
    expect(game.fullCombo()).toBe(false);
    expect(game.judged.value).toBe(game.total.value);
  });

  it('resolves a short final note in the hit window on finish() (L-18)', () => {
    const { game } = newGame();
    // The last note sits within the hit window of the pinned end-of-piece
    // playhead, so update() alone never sweeps it into a miss.
    game.reset(
      chart([
        { midi: 60, startSec: 0 },
        { midi: 62, startSec: 5.0 },
      ]),
    );
    game.press(60, 0); // hit the first
    game.update(5.0); // pinned at the piece end — cannot catch the 5.0 note
    expect(game.counts.miss).toBe(0);
    game.finish();
    expect(game.counts.miss).toBe(1);
    expect(game.judged.value).toBe(game.total.value);
  });

  it('treats an empty chart accuracy as 100%', () => {
    const { game } = newGame();
    game.reset(null);
    expect(game.total.value).toBe(0);
    expect(game.accuracy()).toBe(100);
  });
});
