/**
 * Generate the Piano Practice demo's bundled MIDI set and validate its SoundFont.
 *
 * Source: a verified reference transcription of J.S. Bach, Goldberg Variations
 * (BWV 988) — the Aria, all 30 variations, and the Aria da capo. Each movement
 * lives in the sibling `bach-mcp` repo as note data (pitch / onset / duration in
 * beats plus a tempo map); the keyboard part is captured as a single track (both
 * hands merged), so this script bakes each movement into a self-contained,
 * single-track Standard MIDI File the falling-note player can load directly.
 *
 * It also loads the bundled acoustic-grand SoundFont through libsonare and
 * bounces one movement, asserting the SF2 actually covers program 0 (so the demo
 * plays a real sampled piano, not the synth GM fallback) and renders audibly.
 *
 * Outputs:
 *   src/public/midi/goldberg/00.mid … 31.mid   single-track SMF (format 0)
 *
 * Run: node scripts/generate-practice-assets.mjs
 * Requires the `bach-mcp` repo checked out next to this one for the source JSON.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WASM_ENTRY = path.join(ROOT, 'src/wasm/index.js');
const SF2_PATH = path.join(ROOT, 'src/public/sf2/acoustic-grand.sf2');
const REFERENCE_DIR = path.resolve(ROOT, '../bach-mcp/data/reference');
const OUT_DIR = path.join(ROOT, 'src/public/midi/goldberg');

const MOVEMENTS = 32; // 0 = Aria, 1–30 = variations, 31 = Aria da capo
const TICKS_PER_BEAT = 480;
const VEL_FLOOR = 64; // the reference marks ornaments at velocity 1; lift them to a playable level
const VEL_CEIL = 112;

/** Encode a non-negative integer as a MIDI variable-length quantity. */
function vlq(value) {
  const bytes = [value & 0x7f];
  let v = value >> 7;
  while (v > 0) {
    bytes.unshift((v & 0x7f) | 0x80);
    v >>= 7;
  }
  return bytes;
}

/**
 * Every note across all of a movement's tracks (both hands), as one flat list,
 * with the trailing artifact trimmed.
 *
 * The reference appends one stray velocity-1 grace note after the final chord of
 * every movement (a transcription end-marker). Mid-piece velocity-1 notes are
 * real ornaments and must stay — but since the demo lifts ornaments to an
 * audible floor, that trailing stray would sound as a junk note past the end.
 * Drop only velocity-1 notes that start at/after the last real (velocity > 1)
 * note has finished.
 */
function allNotes(doc) {
  const notes = doc.tracks.flatMap((t) => t.notes ?? []);
  const real = notes.filter((n) => n.velocity > 1);
  if (real.length === 0) return notes;
  const realEnd = Math.max(...real.map((n) => n.onset + n.duration));
  return notes.filter((n) => n.velocity > 1 || n.onset < realEnd - 1e-6);
}

/**
 * Build a single-track Standard MIDI File (format 0) from a movement's notes.
 *
 * @param {object} doc Parsed BWV988_NN.json.
 * @returns {Buffer} The `.mid` file bytes.
 */
function buildMidi(doc) {
  /** @type {Array<{ tick: number, order: number, data: number[] }>} */
  const events = [];

  // Time signature (FF 58): denominator as a power of two (2^exp).
  const ts = doc.time_signatures?.[0] ?? { numerator: 4, denominator: 4 };
  const denomPow = Math.round(Math.log2(ts.denominator));
  events.push({ tick: 0, order: 0, data: [0xff, 0x58, 0x04, ts.numerator, denomPow, 24, 8] });

  // Tempo map (FF 51): microseconds per quarter note per segment.
  for (const tempo of doc.tempos ?? [{ tick: 0, bpm: 100 }]) {
    const usPerQuarter = Math.round(60_000_000 / tempo.bpm);
    events.push({
      tick: tempo.tick,
      order: 1,
      data: [
        0xff,
        0x51,
        0x03,
        (usPerQuarter >> 16) & 0xff,
        (usPerQuarter >> 8) & 0xff,
        usPerQuarter & 0xff,
      ],
    });
  }

  // Notes. Onset / duration are in beats (quarter notes); scale to ticks. At a
  // shared tick, note-offs (order 2) precede note-ons (order 3) so a re-struck
  // pitch is released before it is hit again.
  for (const note of allNotes(doc)) {
    const onTick = Math.round(note.onset * TICKS_PER_BEAT);
    const offTick = Math.max(onTick + 1, Math.round((note.onset + note.duration) * TICKS_PER_BEAT));
    const velocity = Math.min(VEL_CEIL, Math.max(VEL_FLOOR, note.velocity));
    events.push({ tick: onTick, order: 3, data: [0x90, note.pitch, velocity] });
    events.push({ tick: offTick, order: 2, data: [0x80, note.pitch, 0] });
  }

  events.sort((a, b) => a.tick - b.tick || a.order - b.order);

  const body = [];
  let prevTick = 0;
  for (const ev of events) {
    body.push(...vlq(ev.tick - prevTick));
    body.push(...ev.data);
    prevTick = ev.tick;
  }
  body.push(...vlq(0), 0xff, 0x2f, 0x00); // end of track

  const header = Buffer.alloc(14);
  header.write('MThd', 0, 'ascii');
  header.writeUInt32BE(6, 4);
  header.writeUInt16BE(0, 8); // format 0
  header.writeUInt16BE(1, 10); // one track
  header.writeUInt16BE(TICKS_PER_BEAT, 12);

  const trackHeader = Buffer.alloc(8);
  trackHeader.write('MTrk', 0, 'ascii');
  trackHeader.writeUInt32BE(body.length, 4);

  return Buffer.concat([header, trackHeader, Buffer.from(body)]);
}

/**
 * Validate the bundled SoundFont against one movement: it must parse, cover
 * program 0 with a real SF2 preset (not the synth fallback), and bounce to
 * audible audio. Run on a single short movement to keep the gate quick.
 *
 * @param {object} doc Parsed reference JSON for the probe movement.
 */
async function validateSoundFont(doc) {
  const wasm = await import(WASM_ENTRY);
  await wasm.init();
  const { Project } = wasm;

  const sf2 = new Uint8Array(fs.readFileSync(SF2_PATH));
  const project = new Project();
  try {
    project.loadSoundFont(sf2);
    const presetCount = project.soundFontPresetCount?.() ?? -1;

    const SR = 44100;
    project.setSampleRate(SR);
    project.setTempoSegments(
      (doc.tempos ?? [{ tick: 0, bpm: 100 }]).map((t) => ({
        startPpq: t.tick / TICKS_PER_BEAT,
        bpm: t.bpm,
      })),
    );

    const notes = allNotes(doc);
    const endBeat = Math.max(...notes.map((n) => n.onset + n.duration));
    const { clipId } = project.addMidiClip(0, endBeat);

    const tagged = [];
    for (const n of notes) {
      const onBeat = n.onset;
      const offBeat = n.onset + Math.max(0.02, n.duration);
      const vel = Math.min(VEL_CEIL, Math.max(VEL_FLOOR, n.velocity));
      tagged.push({ at: onBeat, key: 1, ev: Project.midiNoteOn(onBeat, 0, 0, n.pitch, vel) });
      tagged.push({ at: offBeat, key: 0, ev: Project.midiNoteOff(offBeat, 0, 0, n.pitch, 0) });
    }
    tagged.sort((a, b) => a.at - b.at || a.key - b.key);
    project.setMidiEvents(
      clipId,
      tagged.map((t) => t.ev),
    );

    // Program 0 (acoustic grand) must resolve to the SF2 backend.
    const manifest = project.soundFontManifest();
    const prog0 = manifest.find((m) => m.program === 0);

    // Pass an explicit length: the SoundFont player's auto-derived release tail
    // runs far past the music, so size the bounce from the piece duration.
    const totalFrames = Math.round(SR * ((doc.duration_seconds ?? endBeat * 0.6) + 2));
    const pcm = project.bounceWithSf2Instrument(
      { destinationId: 0, gain: 0.8 },
      {
        numChannels: 1,
        sampleRate: SR,
        totalFrames,
      },
    );
    let peak = 0;
    for (let i = 0; i < pcm.length; i++) peak = Math.max(peak, Math.abs(pcm[i]));

    console.log(`SF2 presets: ${presetCount}`);
    console.log(`program 0 -> backend=${prog0?.backend} preset="${prog0?.presetName ?? ''}"`);
    console.log(
      `bounce: ${pcm.length} frames (${(pcm.length / SR).toFixed(1)}s), peak=${peak.toFixed(3)}`,
    );

    if (prog0?.backend !== 'sf2') {
      throw new Error(`program 0 did not resolve to the SF2 backend (got "${prog0?.backend}")`);
    }
    if (!(peak > 0.01)) throw new Error(`bounce is silent (peak=${peak})`);
  } finally {
    project.delete();
  }
}

async function main() {
  if (!fs.existsSync(REFERENCE_DIR)) {
    throw new Error(
      `reference transcriptions not found: ${REFERENCE_DIR}\n(check out the bach-mcp repo next to this one)`,
    );
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let probeDoc = null;
  let totalNotes = 0;
  for (let mv = 0; mv < MOVEMENTS; mv++) {
    const src = path.join(REFERENCE_DIR, `BWV988_${String(mv).padStart(2, '0')}.json`);
    if (!fs.existsSync(src)) throw new Error(`missing movement source: ${src}`);
    const doc = JSON.parse(fs.readFileSync(src, 'utf8'));
    const midi = buildMidi(doc);
    const out = path.join(OUT_DIR, `${String(mv).padStart(2, '0')}.mid`);
    fs.writeFileSync(out, midi);
    const n = allNotes(doc).length;
    totalNotes += n;
    console.log(`wrote ${path.relative(ROOT, out)} (${midi.length} bytes, ${n} notes)`);
    if (mv === 2) probeDoc = doc; // a short, single-voice movement for the SF2 probe
  }
  console.log(`generated ${MOVEMENTS} movements, ${totalNotes} notes total`);

  await validateSoundFont(probeDoc);
  console.log('OK: MIDI set generated and SoundFont validated.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
