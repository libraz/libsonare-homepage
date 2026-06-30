import { peakNormalize } from '@/demos/audio/processors';
import { PHRASE_BEATS, PHRASE_VOICES, type TimedNote, timedNotes } from './midiPhrase';

export const SCORE_SAMPLE_RATE = 44_100;

const GATE = 0.92;
const TAIL_SEC = 1.2;

const FLAT_EVENTS: TimedNote[] = PHRASE_VOICES.flatMap((voice) => timedNotes(voice));

interface ProjectMidiEvent {
  __brand?: 'midi';
}

interface ProjectLike {
  setSampleRate(sr: number): void;
  setTempoSegments(segments: Array<{ startPpq: number; bpm: number }>): void;
  addMidiClip(startPpq: number, lengthPpq: number): { trackId: number; clipId: number };
  setMidiEvents(clipId: number, events: ProjectMidiEvent[]): void;
  bounceWithSynthInstrument(
    instrument: string | Record<string, unknown>,
    options: { numChannels: number; sampleRate: number; totalFrames: number },
  ): Float32Array;
  delete(): void;
}

interface ProjectCtor {
  new (): ProjectLike;
  midiNoteOn(
    ppq: number,
    group: number,
    channel: number,
    note: number,
    velocity: number,
  ): ProjectMidiEvent;
  midiNoteOff(
    ppq: number,
    group: number,
    channel: number,
    note: number,
    velocity?: number,
  ): ProjectMidiEvent;
}

export interface ScorePassageRender {
  samples: Float32Array;
  sampleRate: number;
  duration: number;
}

/**
 * Sequence the shared phrase and bounce it through the chosen synth preset.
 *
 * The Project MIDI API measures position in quarter notes: `ppq: 1` is one
 * quarter note, so each note's beat maps to its position directly.
 */
export function renderScorePassage(
  wasm: unknown,
  options: { instrument: string; tempo: number },
): ScorePassageRender {
  const Project = (wasm as { Project: ProjectCtor }).Project;
  const project = new Project();
  try {
    project.setSampleRate(SCORE_SAMPLE_RATE);
    project.setTempoSegments([{ startPpq: 0, bpm: options.tempo }]);
    const { clipId } = project.addMidiClip(0, PHRASE_BEATS);

    const tagged: Array<{ at: number; key: number; ev: ProjectMidiEvent }> = [];
    for (const event of FLAT_EVENTS) {
      const offBeat = event.startBeat + event.durBeat * GATE;
      tagged.push({
        at: event.startBeat,
        key: 1,
        ev: Project.midiNoteOn(event.startBeat, 0, 0, event.midi, event.velocity),
      });
      tagged.push({
        at: offBeat,
        key: 0,
        ev: Project.midiNoteOff(offBeat, 0, 0, event.midi, 0),
      });
    }
    tagged.sort((a, b) => a.at - b.at || a.key - b.key);
    project.setMidiEvents(
      clipId,
      tagged.map((event) => event.ev),
    );

    const phraseSec = (PHRASE_BEATS * 60) / options.tempo;
    const totalFrames = Math.round(SCORE_SAMPLE_RATE * (phraseSec + TAIL_SEC));
    const samples = peakNormalize(
      project.bounceWithSynthInstrument(options.instrument, {
        numChannels: 1,
        sampleRate: SCORE_SAMPLE_RATE,
        totalFrames,
      }),
      0.85,
    );

    return {
      samples,
      sampleRate: SCORE_SAMPLE_RATE,
      duration: totalFrames / SCORE_SAMPLE_RATE,
    };
  } finally {
    project.delete();
  }
}
