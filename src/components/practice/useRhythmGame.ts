/**
 * Rhythm-game scoring for the Piano Practice demo.
 *
 * The falling notes double as a score chart: each note is a timing target on the
 * strike line. When the player strikes a key (on-screen, mouse/touch, or a real
 * MIDI keyboard), {@link RhythmGame.press} finds the nearest unjudged target of
 * that pitch and grades it by how close the press was to the strike time
 * (Perfect / Great / Good). A press with no nearby target of that pitch is a
 * wrong note; a target that scrolls past the strike line unplayed is a Miss.
 * Both break the combo.
 *
 * The clock is the shared score-seconds playhead (`posBase`), so judgment lines
 * up exactly with the falling bars and the rendered audio.
 */
import { reactive, ref } from 'vue';
import type { ParsedMidi } from './midiSmf';

export type Judgment = 'perfect' | 'great' | 'good' | 'miss';

/** Absolute timing windows (seconds) from the strike line, best → worst. */
const PERFECT_SEC = 0.05;
const GREAT_SEC = 0.1;
const GOOD_SEC = 0.16;
/** A press within this of a target of the same pitch counts as a hit. */
const HIT_WINDOW_SEC = GOOD_SEC;

/** Base points per judgment, before the combo multiplier. */
const POINTS: Record<Exclude<Judgment, 'miss'>, number> = {
  perfect: 300,
  great: 200,
  good: 100,
};

interface Target {
  midi: number;
  time: number;
  done: boolean;
}

interface RhythmGameOptions {
  /** Called for every judgment, to drive effects and the HUD. */
  onJudge: (kind: Judgment, midi: number) => void;
}

function grade(delta: number): Exclude<Judgment, 'miss'> {
  const d = Math.abs(delta);
  if (d <= PERFECT_SEC) return 'perfect';
  if (d <= GREAT_SEC) return 'great';
  return 'good';
}

export function useRhythmGame(options: RhythmGameOptions) {
  const score = ref(0);
  const combo = ref(0);
  const maxCombo = ref(0);
  const counts = reactive({ perfect: 0, great: 0, good: 0, miss: 0 });
  /** Number of chart targets (expected notes) — the denominator for accuracy. */
  const total = ref(0);
  /** Targets judged so far (hits + passed-by misses), for progress. */
  const judged = ref(0);

  let targets: Target[] = [];

  /** Weighted accuracy as a 0–100 percentage over every chart target. */
  function accuracy(): number {
    if (total.value === 0) return 100;
    const weighted = counts.perfect * 1 + counts.great * 0.65 + counts.good * 0.3;
    return Math.max(0, Math.min(100, (weighted / total.value) * 100));
  }

  /** S/A/B/C/D rank from the final accuracy (with an S+ for a clean run). */
  function rank(): string {
    const acc = accuracy();
    if (counts.miss === 0 && acc >= 99) return 'S+';
    if (acc >= 95) return 'S';
    if (acc >= 88) return 'A';
    if (acc >= 75) return 'B';
    if (acc >= 55) return 'C';
    return 'D';
  }

  const fullCombo = () => total.value > 0 && counts.miss === 0 && judged.value >= total.value;

  function registerHit(kind: Exclude<Judgment, 'miss'>, midi: number): void {
    combo.value += 1;
    if (combo.value > maxCombo.value) maxCombo.value = combo.value;
    counts[kind] += 1;
    judged.value += 1;
    // Combo multiplier ramps to 2× by a 50-note streak.
    const mult = 1 + Math.min(combo.value, 50) * 0.02;
    score.value += Math.round(POINTS[kind] * mult);
    options.onJudge(kind, midi);
  }

  function registerMiss(midi: number, consumesTarget: boolean): void {
    combo.value = 0;
    counts.miss += 1;
    if (consumesTarget) judged.value += 1;
    options.onJudge('miss', midi);
  }

  /**
   * Arm a fresh chart from the piece, optionally treating everything at or
   * before `fromSec` as already gone (used when starting mid-piece after a seek).
   */
  function reset(midi: ParsedMidi | null, fromSec = Number.NEGATIVE_INFINITY): void {
    score.value = 0;
    combo.value = 0;
    maxCombo.value = 0;
    counts.perfect = counts.great = counts.good = counts.miss = 0;
    judged.value = 0;
    targets = (midi?.notes ?? []).map((n) => ({
      midi: n.midi,
      time: n.startSec,
      done: n.startSec <= fromSec,
    }));
    total.value = targets.filter((t) => !t.done).length;
  }

  /**
   * Grade a key strike at the current playhead. Returns the judgment, or null
   * when the press is too far in the future to belong to any pending target
   * (ignored rather than penalized, so early warm-up taps don't tank the score).
   */
  function press(midi: number, atSec: number): Judgment | null {
    let best: Target | null = null;
    let bestDelta = Number.POSITIVE_INFINITY;
    for (const t of targets) {
      if (t.done || t.midi !== midi) continue;
      const delta = atSec - t.time;
      if (Math.abs(delta) < Math.abs(bestDelta)) {
        bestDelta = delta;
        best = t;
      }
    }
    if (best && Math.abs(bestDelta) <= HIT_WINDOW_SEC) {
      best.done = true;
      const kind = grade(bestDelta);
      registerHit(kind, midi);
      return kind;
    }
    // A same-pitch target still well in the future: just an early warm-up tap,
    // ignore it rather than penalize it.
    if (best && bestDelta < -HIT_WINDOW_SEC) return null;
    // The nearest same-pitch target has already scrolled past the hit window:
    // this late strike resolves THAT target as its miss. Consume it (best.done +
    // judged) so the update() sweep can't miss the same target a second time.
    if (best && bestDelta > HIT_WINDOW_SEC) {
      best.done = true;
      registerMiss(midi, true);
      return 'miss';
    }
    // No target of this pitch pending at all — a wrong note that breaks the combo.
    registerMiss(midi, false);
    return 'miss';
  }

  /** Sweep the chart at the playhead, marking notes that scrolled past as misses. */
  function update(posBase: number): void {
    for (const t of targets) {
      if (!t.done && posBase - t.time > HIT_WINDOW_SEC) {
        t.done = true;
        registerMiss(t.midi, true);
      }
    }
  }

  /**
   * Resolve every still-unjudged target as a miss. Called when playback ends so
   * a short final note whose strike time sits within the hit window of the
   * pinned end-of-piece playhead (which {@link update} would never sweep past)
   * is still counted, keeping the miss total consistent with the chart length.
   */
  function finish(): void {
    for (const t of targets) {
      if (!t.done) {
        t.done = true;
        registerMiss(t.midi, true);
      }
    }
  }

  return {
    score,
    combo,
    maxCombo,
    counts,
    total,
    judged,
    accuracy,
    rank,
    fullCombo,
    reset,
    press,
    update,
    finish,
  };
}
