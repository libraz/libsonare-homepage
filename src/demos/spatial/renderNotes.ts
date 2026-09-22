/**
 * What the room synthesis had to change to render what the demo plays.
 *
 * The engine reports a tail cut against `maxSeconds` whenever it cuts anything,
 * including a tail already a hundred decibels down. The demo sizes every tail
 * itself, so it knows how far into its decay the cut landed and passes the cut
 * on only when the decay was still running. Every other diagnostic says the
 * sound went through a room other than the one asked for, and always passes.
 */
import type { RirDiagnostic } from '@/wasm/index';

/** A decay counts as finished once it has fallen this far, which is what RT60 measures. */
const FINISHED_DECAY_DB = 60;

export type RenderNote =
  | { kind: 'tailCut'; seconds: number; decayDb: number }
  | { kind: 'reflectionsReduced' }
  | { kind: 'lengthExtended' }
  | { kind: 'noLateTail' }
  | { kind: 'engine'; message: string };

/** The tail the demo asked for and the reverberation time it was sized from. */
export interface RequestedTail {
  seconds: number;
  rt60: number;
}

/**
 * Notes worth showing for one render. A stereo render reports the same
 * diagnostics once per channel, so each kind appears once.
 */
export function renderNotes(
  diagnostics: readonly RirDiagnostic[],
  tail: RequestedTail,
): RenderNote[] {
  const notes = new Map<string, RenderNote>();
  for (const diagnostic of diagnostics) {
    const note = toNote(diagnostic, tail);
    if (note) notes.set(note.kind === 'engine' ? `engine:${note.message}` : note.kind, note);
  }
  return [...notes.values()];
}

function toNote(diagnostic: RirDiagnostic, tail: RequestedTail): RenderNote | null {
  switch (diagnostic.code) {
    case 'acoustic.rir_length_clamped': {
      const decayDb = (FINISHED_DECAY_DB * tail.seconds) / Math.max(tail.rt60, 1e-3);
      return decayDb < FINISHED_DECAY_DB
        ? { kind: 'tailCut', seconds: tail.seconds, decayDb }
        : null;
    }
    case 'acoustic.ism_order_clamped':
      return { kind: 'reflectionsReduced' };
    case 'acoustic.rir_length_floored':
      return { kind: 'lengthExtended' };
    case 'acoustic.no_late_tail':
      return { kind: 'noLateTail' };
    default:
      return diagnostic.severity === 'info'
        ? null
        : { kind: 'engine', message: diagnostic.message };
  }
}
