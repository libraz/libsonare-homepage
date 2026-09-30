/**
 * Audio-to-MIDI transcription and piano resynthesis shared by the worker and
 * its tests. The UI receives only the serializable result; no WASM work runs
 * on the document thread.
 */

export interface TranscribeMidiEvent {
  ppq: number;
  data0: number;
  data1?: number;
}

export interface DecodedMidiEvent {
  ppq: number;
  status: number;
  group: number;
  channel: number;
  note: number;
  velocity: number;
}

export interface TranscribedNote {
  startPpq: number;
  endPpq: number;
  midi: number;
  velocity: number;
  group: number;
  channel: number;
}

export interface TranscriptionRender {
  events: TranscribeMidiEvent[];
  notes: TranscribedNote[];
  noteCount: number;
  tempoBpm: number;
  sampleRate: number;
  sourceDurationSec: number;
  pianoDurationSec: number;
  piano: Float32Array;
}

interface ProjectLike {
  setSampleRate(sampleRate: number): void;
  setTempoSegments(segments: Array<{ startPpq: number; bpm: number }>): void;
  addMidiClip(startPpq: number, lengthPpq: number): { clipId: number };
  setMidiEvents(clipId: number, events: TranscribeMidiEvent[]): void;
  bounceWithSynthInstrument(
    instrument: string,
    options: { numChannels: number; sampleRate: number; totalFrames: number },
  ): Float32Array;
  delete(): void;
}

interface ProjectConstructor {
  new (): ProjectLike;
}

interface TranscriptionResult {
  events: TranscribeMidiEvent[];
  noteCount: number;
  tempoBpm: number;
}

export interface TranscriptionWasm {
  transcribe(request: { samples: Float32Array; sampleRate: number }): TranscriptionResult;
  Project: ProjectConstructor;
}

const NOTE_ON = 0x9;
const NOTE_OFF = 0x8;
const DEFAULT_TEMPO_BPM = 120;
const PIANO_TAIL_SEC = 1.2;

/** Decode the MIDI 1.0 UMP channel-voice word emitted by `transcribe`. */
export function decodeMidiEvent(event: TranscribeMidiEvent): DecodedMidiEvent {
  const word = event.data0 >>> 0;
  return {
    ppq: event.ppq,
    status: (word >> 20) & 0xf,
    group: (word >> 24) & 0xf,
    channel: (word >> 16) & 0xf,
    note: (word >> 8) & 0x7f,
    velocity: word & 0x7f,
  };
}

function noteKey(event: DecodedMidiEvent): string {
  return `${event.group}:${event.channel}:${event.note}`;
}

/** Pair the detector's note-on/off stream into the spans used by the roll. */
export function decodeTranscribedNotes(
  events: ReadonlyArray<TranscribeMidiEvent>,
): TranscribedNote[] {
  const open = new Map<string, TranscribedNote[]>();
  const notes: TranscribedNote[] = [];

  for (const raw of events) {
    const event = decodeMidiEvent(raw);
    if (!Number.isFinite(event.ppq) || event.ppq < 0) continue;

    const isOn = event.status === NOTE_ON && event.velocity > 0;
    const isOff = event.status === NOTE_OFF || (event.status === NOTE_ON && event.velocity === 0);
    if (isOn) {
      const key = noteKey(event);
      const queue = open.get(key) ?? [];
      queue.push({
        startPpq: event.ppq,
        endPpq: event.ppq,
        midi: event.note,
        velocity: event.velocity,
        group: event.group,
        channel: event.channel,
      });
      open.set(key, queue);
    } else if (isOff) {
      const key = noteKey(event);
      const queue = open.get(key);
      const note = queue?.shift();
      if (!note) continue;
      if (event.ppq > note.startPpq) {
        note.endPpq = event.ppq;
        notes.push(note);
      }
      if (queue?.length === 0) open.delete(key);
    }
  }

  notes.sort((a, b) => a.startPpq - b.startPpq || a.midi - b.midi || a.endPpq - b.endPpq);
  return notes;
}

function cloneEvents(events: ReadonlyArray<TranscribeMidiEvent>): TranscribeMidiEvent[] {
  return events.map((event) => ({
    ppq: event.ppq,
    data0: event.data0,
    ...(event.data1 === undefined ? {} : { data1: event.data1 }),
  }));
}

function finiteTempo(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_TEMPO_BPM;
}

/** Run recognition and bounce the recognized event stream through the piano. */
export function renderTranscription(
  wasm: TranscriptionWasm,
  samples: Float32Array,
  sampleRate: number,
): TranscriptionRender {
  const detected = wasm.transcribe({ samples, sampleRate });
  const events = cloneEvents(detected.events);
  const notes = decodeTranscribedNotes(events);
  const tempoBpm = finiteTempo(detected.tempoBpm);
  const sourceDurationSec = samples.length / sampleRate;
  const lastPpq = notes.reduce((max, note) => Math.max(max, note.endPpq), 0);
  const noteDurationSec = (lastPpq * 60) / tempoBpm;
  const pianoDurationSec = Math.max(sourceDurationSec, noteDurationSec + PIANO_TAIL_SEC);
  const totalFrames = Math.max(1, Math.ceil(pianoDurationSec * sampleRate));
  const project = new wasm.Project();

  try {
    project.setSampleRate(sampleRate);
    project.setTempoSegments([{ startPpq: 0, bpm: tempoBpm }]);
    const { clipId } = project.addMidiClip(0, Math.max(1, lastPpq));
    project.setMidiEvents(clipId, events);
    const rendered = project.bounceWithSynthInstrument('acoustic-piano', {
      numChannels: 1,
      sampleRate,
      totalFrames,
    });

    return {
      events,
      notes,
      noteCount: detected.noteCount,
      tempoBpm,
      sampleRate,
      sourceDurationSec,
      pianoDurationSec: rendered.length / sampleRate,
      piano: Float32Array.from(rendered),
    };
  } finally {
    project.delete();
  }
}
