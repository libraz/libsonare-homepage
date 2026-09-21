/**
 * MIDI phrase round-trip for the tuner, using the libsonare WASM Project as the
 * Standard MIDI File codec (its `exportSmf` / `importSmf` handle the SMF format
 * and tempo map, so no hand-rolled parser is needed). A phrase is a flat list of
 * timed notes in seconds; export writes a single-track SMF at 120 BPM and import
 * decodes the project's MIDI-1.0 UMP words back into the same shape.
 */

/** One recorded/imported note, timed in seconds from the phrase start. */
export interface PhraseNote {
  note: number;
  velocity: number;
  startSec: number;
  durSec: number;
}

/** Fixed tempo used for the seconds <-> quarter-note-PPQ mapping on export. */
const EXPORT_BPM = 120;
const BEATS_PER_SEC = EXPORT_BPM / 60;

/** Export a phrase to a Standard MIDI File byte buffer via the WASM core. */
export async function exportPhraseSmf(phrase: PhraseNote[]): Promise<Uint8Array> {
  const wasm = await import('@/wasm/index.js');
  await wasm.init();
  const project = new wasm.Project();
  try {
    project.setSampleRate(48000);
    const endBeats = phrase.reduce(
      (max, n) => Math.max(max, (n.startSec + n.durSec) * BEATS_PER_SEC),
      0,
    );
    const lengthBeats = Math.max(4, Math.ceil(endBeats) + 1);
    const { clipId } = project.addMidiClip(0, lengthBeats);
    const events = phrase.flatMap((n) => [
      wasm.Project.midiNoteOn(n.startSec * BEATS_PER_SEC, 0, 0, n.note, n.velocity),
      wasm.Project.midiNoteOff((n.startSec + n.durSec) * BEATS_PER_SEC, 0, 0, n.note, 0),
    ]);
    project.setMidiEvents(clipId, events);
    return project.exportSmf();
  } finally {
    project.delete();
  }
}

/** Import a Standard MIDI File byte buffer into a timed phrase via the WASM core. */
export async function importPhraseSmf(bytes: Uint8Array): Promise<PhraseNote[]> {
  const wasm = await import('@/wasm/index.js');
  await wasm.init();
  const project = new wasm.Project();
  try {
    project.importSmf(bytes);
    const json = JSON.parse(project.toJson());
    const bpm = json.tempo_segments?.[0]?.bpm ?? EXPORT_BPM;
    const secPerBeat = 60 / bpm;
    const raw: Array<{ ppq: number; data0: number }> = [];
    for (const clip of Object.values(json.midi_content ?? {})) {
      for (const ev of clip as Array<{ ppq: number; data0: number }>) raw.push(ev);
    }
    raw.sort((a, b) => a.ppq - b.ppq);
    const notes: PhraseNote[] = [];
    const pending = new Map<number, { startSec: number; velocity: number }>();
    for (const ev of raw) {
      const status = (ev.data0 >>> 16) & 0xff;
      const note = (ev.data0 >>> 8) & 0xff;
      const velocity = ev.data0 & 0xff;
      const type = status & 0xf0;
      const sec = ev.ppq * secPerBeat;
      if (type === 0x90 && velocity > 0) {
        pending.set(note, { startSec: sec, velocity });
      } else if (type === 0x80 || (type === 0x90 && velocity === 0)) {
        const start = pending.get(note);
        if (start) {
          notes.push({
            note,
            velocity: start.velocity,
            startSec: start.startSec,
            durSec: Math.max(0.05, sec - start.startSec),
          });
          pending.delete(note);
        }
      }
    }
    return notes.sort((a, b) => a.startSec - b.startSec);
  } finally {
    project.delete();
  }
}

/** Trigger a browser download of a phrase as a `.mid` file. */
export function downloadSmf(bytes: Uint8Array, filename = 'tuner-phrase.mid'): void {
  const view = new Uint8Array(bytes.byteLength);
  view.set(bytes);
  const blob = new Blob([view], { type: 'audio/midi' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
