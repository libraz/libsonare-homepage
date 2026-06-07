#!/usr/bin/env node
/**
 * Generate the base audio clips consumed by inline documentation demos.
 *
 * Inline `<SonareDemo>` widgets whose source is `{ kind: 'clip', clip: '<name>' }`
 * load `/demo-clips/<name>.{opus,ogg,wav}` at runtime. Per the project's zero-external-
 * asset rule, those clips are not recordings: they are rendered here, headlessly, by
 * libsonare itself (the same WASM module the browser uses runs under Node — see
 * `useSonareDemoAudio` for the browser side).
 *
 * Four reusable clips are produced:
 *  - `band`  — a short multi-part phrase (piano chords + bass + lead), broadband and
 *              musical; the workhorse for detector / ab-process / meters demos.
 *  - `drum`  — a two-bar kit groove (kick / snare / hat) for beat, onset and metering.
 *  - `pad`   — a sustained warm-pad chord progression for EQ / filter / param-sweep.
 *  - `vowel` — a sustained source-filter "ah": a saw glottal source shaped by three
 *              formant peaks, for pitch / formant demos (synthetic on purpose — pitch
 *              and formant stay cleanly separable).
 *
 * Output: 16-bit mono WAV under `src/public/demo-clips/`. WAV keeps the generator
 * dependency-free; the browser decodes it via `decodeAudioData` (the loader falls back
 * to wav when no opus/ogg sibling exists). Run with `yarn generate:demos`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WASM_ENTRY = path.join(ROOT, 'src/wasm/index.js');
const OUT_DIR = path.join(ROOT, 'src/public/demo-clips');

/** Render sample rate. 32 kHz keeps clips small while covering all musical content. */
const SR = 32000;
/** Pulses-per-quarter assumed by libsonare's project timeline (default tempo 120 BPM). */
const PPQ = 480;
/** Seconds per PPQ tick at the default 120 BPM (1 quarter = 0.5 s). */
const SEC_PER_PPQ = 0.5 / PPQ;

const TAU = Math.PI * 2;

// ---- generic DSP helpers --------------------------------------------------

/**
 * Deterministic value-noise generator (no Math.random — stable across renders so the
 * committed clips are byte-reproducible).
 *
 * @param {number} seed Unsigned 32-bit seed.
 * @returns {() => number} A function yielding successive values in [0, 1).
 */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Normalize to a target peak and apply short raised-cosine fades to avoid clicks.
 *
 * @param {Float32Array} buf Samples, modified in place.
 * @param {number} peak Target absolute peak (linear, 0..1).
 * @param {number} fadeSec Fade in/out length in seconds.
 * @returns {Float32Array} The same buffer, for chaining.
 */
function finalize(buf, peak = 0.89, fadeSec = 0.01) {
  let max = 0;
  for (let i = 0; i < buf.length; i++) {
    const a = Math.abs(buf[i]);
    if (a > max) max = a;
  }
  if (max > 0) {
    const g = peak / max;
    for (let i = 0; i < buf.length; i++) buf[i] *= g;
  }
  const fade = Math.min(Math.round(SR * fadeSec), Math.floor(buf.length / 2));
  for (let i = 0; i < fade; i++) {
    const k = 0.5 - 0.5 * Math.cos((Math.PI * i) / fade);
    buf[i] *= k;
    buf[buf.length - 1 - i] *= k;
  }
  return buf;
}

/**
 * Sum several equal-length mono buffers with per-buffer gains.
 *
 * @param {number} len Output length in samples.
 * @param {Array<{ buf: Float32Array, gain: number }>} parts Sources and their gains.
 * @returns {Float32Array} The mixed buffer.
 */
function mix(len, parts) {
  const out = new Float32Array(len);
  for (const { buf, gain } of parts) {
    const n = Math.min(len, buf.length);
    for (let i = 0; i < n; i++) out[i] += buf[i] * gain;
  }
  return out;
}

/**
 * A second-order peaking-EQ biquad (RBJ cookbook), applied in place — used to carve
 * vowel formants into the saw glottal source.
 *
 * @param {Float32Array} buf Samples, filtered in place.
 * @param {number} freq Centre frequency in Hz.
 * @param {number} q Quality factor.
 * @param {number} gainDb Peak gain in dB.
 */
function peakingEq(buf, freq, q, gainDb) {
  const A = 10 ** (gainDb / 40);
  const w0 = (TAU * freq) / SR;
  const alpha = Math.sin(w0) / (2 * q);
  const cos = Math.cos(w0);
  const b0 = 1 + alpha * A;
  const b1 = -2 * cos;
  const b2 = 1 - alpha * A;
  const a0 = 1 + alpha / A;
  const a1 = -2 * cos;
  const a2 = 1 - alpha / A;
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < buf.length; i++) {
    const x0 = buf[i];
    const y0 = (b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
    buf[i] = y0;
  }
}

// ---- libsonare synth rendering -------------------------------------------

/**
 * Render a list of MIDI notes through one NativeSynth preset, offline.
 *
 * Note timings are authored in PPQ ticks ({@link PPQ} per quarter) for readability,
 * but the Project MIDI API positions events in quarter-note units (1.0 = one quarter),
 * so every tick value is divided by {@link PPQ} at the API boundary. Passing raw ticks
 * would place each event hundreds of quarter-notes into the timeline — far past the
 * bounce — leaving only the note at tick 0 audible.
 *
 * @param {object} wasm The initialized libsonare module.
 * @param {string} preset A `synthPresetNames()` entry.
 * @param {Array<[number, number, number, number]>} notes `[startPpq, lengthPpq, midi, velocity]`.
 * @param {number} totalSec Length of the rendered buffer in seconds.
 * @param {Partial<Record<string, unknown>>} [patchOverride] Fields to merge over the preset patch.
 * @returns {Float32Array} Mono PCM at {@link SR}.
 */
function renderPart(wasm, preset, notes, totalSec, patchOverride = {}) {
  const { Project } = wasm;
  const project = new Project();
  try {
    project.setSampleRate(SR);
    // Size the clip to span every note (plus a bar of headroom) so long phrases
    // are not truncated to a fixed-length region.
    let lastEnd = PPQ * 8;
    for (const [startPpq, lengthPpq] of notes) {
      lastEnd = Math.max(lastEnd, startPpq + lengthPpq + BAR);
    }
    // Ticks -> quarter-note units for the MIDI API.
    const toQuarters = (ticks) => ticks / PPQ;
    const { clipId } = project.addMidiClip(0, toQuarters(lastEnd));
    const events = [];
    for (const [startPpq, lengthPpq, midi, velocity] of notes) {
      events.push(Project.midiNoteOn(toQuarters(startPpq), 0, 0, midi, velocity));
      events.push(Project.midiNoteOff(toQuarters(startPpq + lengthPpq), 0, 0, midi, 0));
    }
    project.setMidiEvents(clipId, events);
    const patch = { ...wasm.synthPresetPatch(preset), ...patchOverride };
    return project.bounceWithSynthInstrument(patch, {
      numChannels: 1,
      sampleRate: SR,
      totalFrames: Math.round(SR * totalSec),
    });
  } finally {
    project.delete();
  }
}

// ---- musical material -----------------------------------------------------

const Q = PPQ; // quarter note
const H = PPQ * 2; // half note
const BAR = PPQ * 4; // 4/4 bar

// A four-chord turnaround in C major: C – Am – F – G, one chord per half-bar.
const CHORDS = [
  { at: 0, midis: [60, 64, 67], bass: 36 }, // C
  { at: H, midis: [57, 60, 64], bass: 33 }, // Am
  { at: BAR, midis: [60, 65, 69], bass: 41 }, // F
  { at: BAR + H, midis: [62, 67, 71], bass: 43 }, // G
];

/** `band`: piano chords + plucked bass + a brass lead line, mixed. */
function buildBand(wasm) {
  const totalSec = 2 * BAR * SEC_PER_PPQ + 0.6; // two bars + release tail
  const len = Math.round(SR * totalSec);

  const chordNotes = CHORDS.flatMap(({ at, midis }) =>
    midis.map((m) => /** @type {[number,number,number,number]} */ ([at, H - 20, m, 78])),
  );
  const bassNotes = CHORDS.map(
    ({ at, bass }) => /** @type {[number,number,number,number]} */ ([at, H - 30, bass, 96]),
  );
  // A simple lead: one note per quarter, mostly chord tones.
  const leadMidis = [72, 76, 74, 72, 71, 72, 74, 79];
  const leadNotes = leadMidis.map(
    (m, i) => /** @type {[number,number,number,number]} */ ([i * Q, Q - 24, m, 70]),
  );

  const piano = renderPart(wasm, 'acoustic-piano', chordNotes, totalSec);
  const bass = renderPart(wasm, 'pluck', bassNotes, totalSec);
  const lead = renderPart(wasm, 'brass', leadNotes, totalSec);

  return finalize(
    mix(len, [
      { buf: piano, gain: 0.9 },
      { buf: bass, gain: 1.0 },
      { buf: lead, gain: 0.55 },
    ]),
  );
}

/**
 * `drum`: a two-bar kick/snare/hat groove.
 *
 * The percussion preset's body gives the tone, but its attack alone is too soft for
 * spectral-flux onset detection. Each hit is therefore layered with a very short noise
 * transient so onsets/beats resolve cleanly — the clip's documented purpose. This is
 * pure DSP synthesis (like the vowel's formant EQ), not a recording.
 */
function buildDrum(wasm) {
  const totalSec = 2 * BAR * SEC_PER_PPQ + 0.4;
  const len = Math.round(SR * totalSec);
  const E = PPQ / 2; // eighth note

  // hit = [startPpq, midi, velocity, transientAmp, transientSec]
  /** @type {Array<[number, number, number, number, number]>} */
  const hits = [];
  for (let bar = 0; bar < 2; bar++) {
    const base = bar * BAR;
    hits.push([base, 36, 124, 0.9, 0.006]); // kick on 1
    hits.push([base + H, 36, 108, 0.8, 0.006]); // kick on 3
    hits.push([base + Q, 38, 116, 0.8, 0.006]); // snare on 2
    hits.push([base + Q + H, 38, 116, 0.8, 0.006]); // snare on 4
    for (let e = 0; e < 8; e++) hits.push([base + e * E, 42, e % 2 ? 70 : 92, 0.4, 0.004]); // hats
  }

  const notes = hits.map(
    ([ppq, midi, vel]) => /** @type {[number,number,number,number]} */ ([ppq, 60, midi, vel]),
  );
  const body = renderPart(wasm, 'drum-kit', notes, totalSec, {
    ampAttackMs: 0.5,
    ampDecayMs: 120,
    ampSustain: 0,
    ampReleaseMs: 30,
  });

  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) out[i] = body[i] * 0.8;
  const rng = mulberry32(0x51a4f0d3);
  for (const [ppq, , , amp, durSec] of hits) {
    const start = Math.round(ppq * SEC_PER_PPQ * SR);
    const dn = Math.round(SR * durSec);
    for (let j = 0; j < dn; j++) {
      const k = start + j;
      if (k >= len) break;
      out[k] += Math.exp(-j / (dn * 0.35)) * amp * (rng() * 2 - 1);
    }
  }
  return finalize(out, 0.92);
}

/** `pad`: the same progression held as a lush warm pad. */
function buildPad(wasm) {
  const totalSec = 2 * BAR * SEC_PER_PPQ + 1.0; // long release tail
  const notes = CHORDS.flatMap(({ at, midis }) =>
    midis.map((m) => /** @type {[number,number,number,number]} */ ([at, H, m, 72])),
  );
  return finalize(renderPart(wasm, 'warm-pad', notes, totalSec), 0.82);
}

/**
 * `lead`: a monophonic melodic line — one note at a time, a clear rise-and-fall
 * contour with a rest, for melody / pitch-contour demos. Rendered from a single
 * synth voice (no accompaniment) so `pitchYin` tracks one unambiguous fundamental.
 */
function buildLead(wasm) {
  const E = PPQ / 2; // eighth note
  // [startPpq, lengthPpq, midi] — a singable phrase spanning C5..G5 with one rest.
  /** @type {Array<[number, number, number]>} */
  const phrase = [
    [0 * Q, Q, 72], // C5
    [1 * Q, Q, 74], // D5
    [2 * Q, Q, 76], // E5
    [3 * Q, Q, 79], // G5
    [4 * Q, Q, 76], // E5
    [5 * Q, E, 74], // D5  (rest on the following eighth)
    [6 * Q, Q, 72], // C5
    // beat 8 (7*Q) is silent — an unvoiced gap the pitch tracker should reject
    [8 * Q, Q, 69], // A4
    [9 * Q, Q, 72], // C5
    [10 * Q, E, 76], // E5
    [10 * Q + E, E, 77], // F5
    [11 * Q, Q, 74], // D5
    [12 * Q, H, 72], // C5 (held)
    [14 * Q, H, 67], // G4 (resolve, held)
  ];
  const totalSec = 16 * Q * SEC_PER_PPQ + 0.6; // four bars + release tail
  const len = Math.round(SR * totalSec);
  const out = new Float32Array(len);
  // NativeSynth is monophonic per bounce — sequential notes in one bounce all keep
  // the first note's pitch. Render each note as its own single-note voice (which does
  // track pitch) and place it at its time offset, so pitchYin sees a true melody.
  const patch = {
    cutoffHz: 4200,
    resonanceQ: 0.7,
    ampAttackMs: 6,
    ampSustain: 0.85,
    ampReleaseMs: 30,
  };
  for (const [at, lenPpq, midi] of phrase) {
    // Render only the note body (short, no long release) so voices barely overlap —
    // overlapping decay tails make a monophonic pitch tracker pick octave subharmonics.
    const bodyPpq = lenPpq - 30;
    const noteSec = (bodyPpq + PPQ / 8) * SEC_PER_PPQ;
    const voice = renderPart(wasm, 'saw-lead', [[0, bodyPpq, midi, 90]], noteSec, patch);
    // A short raised-cosine tail fade kills the low-energy decay where YIN drifts.
    const fade = Math.min(Math.round(SR * 0.02), Math.floor(voice.length / 4));
    for (let i = 0; i < fade; i++) {
      voice[voice.length - 1 - i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / fade);
    }
    const start = Math.round(at * SEC_PER_PPQ * SR);
    const nCopy = Math.min(voice.length, len - start);
    for (let i = 0; i < nCopy; i++) out[start + i] += voice[i];
  }
  return finalize(out, 0.85);
}

/** `vowel`: a saw glottal source at A3 shaped by three "ah" formants. */
function buildVowel(wasm) {
  const totalSec = 2.6;
  // Bright saw, filter wide open so the formant EQ defines the timbre.
  const src = renderPart(wasm, 'saw-lead', [[0, PPQ * 4, 57, 96]], totalSec, {
    cutoffHz: 12000,
    resonanceQ: 0.5,
    ampSustain: 0.85,
    ampReleaseMs: 260,
  });
  // "ah" formants (F1..F3) for a neutral male-ish vowel.
  peakingEq(src, 800, 4, 9);
  peakingEq(src, 1150, 6, 7);
  peakingEq(src, 2900, 8, 5);
  return finalize(src, 0.85);
}

// ---- WAV encoding ---------------------------------------------------------

/**
 * Encode mono float PCM as a 16-bit little-endian WAV.
 *
 * @param {Float32Array} samples Mono samples in [-1, 1].
 * @param {number} sampleRate Sample rate in Hz.
 * @returns {Buffer} The WAV file bytes.
 */
function encodeWav(samples, sampleRate) {
  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); // PCM chunk size
  buf.writeUInt16LE(1, 20); // PCM format
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * bytesPerSample, 28); // byte rate
  buf.writeUInt16LE(bytesPerSample, 32); // block align
  buf.writeUInt16LE(16, 34); // bits per sample
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(s * 32767), offset);
    offset += 2;
  }
  return buf;
}

// ---- entry point ----------------------------------------------------------

const CLIPS = {
  band: buildBand,
  drum: buildDrum,
  pad: buildPad,
  vowel: buildVowel,
  lead: buildLead,
};

/**
 * Guard against a frozen multi-note render. The Project MIDI API positions events
 * in quarter-note units; feeding it raw PPQ ticks places every event past the
 * first far beyond the bounce, so only the note at tick 0 sounds and the clip
 * freezes on one pitch. This counts distinct dominant pitch classes across the
 * clip via chroma and throws if a clip that should move harmonically does not.
 *
 * @param {object} wasm The initialized libsonare module.
 * @param {string} name Clip name (for the error message).
 * @param {Float32Array} samples The rendered clip.
 * @param {number} minDistinct Minimum distinct dominant pitch classes expected.
 */
function assertHarmonicMovement(wasm, name, samples, minDistinct) {
  const ch = wasm.chroma(samples, SR, 2048, 512);
  const feats = ch.features ?? ch.chroma;
  const nFrames = ch.nFrames ?? Math.floor(feats.length / 12);
  const seen = new Set();
  const windows = 8;
  for (let w = 0; w < windows; w++) {
    const f0 = Math.floor((nFrames * w) / windows);
    const f1 = Math.floor((nFrames * (w + 1)) / windows);
    let best = -1;
    let bestVal = -1;
    for (let p = 0; p < 12; p++) {
      let sum = 0;
      for (let f = f0; f < f1; f++) sum += feats[p * nFrames + f];
      if (sum > bestVal) {
        bestVal = sum;
        best = p;
      }
    }
    if (best >= 0) seen.add(best);
  }
  if (seen.size < minDistinct) {
    throw new Error(
      `clip "${name}" looks frozen: only ${seen.size} distinct dominant pitch class(es) ` +
        `across the clip (expected >= ${minDistinct}). Are MIDI event times in quarter-note ` +
        'units, not PPQ ticks? See renderPart().',
    );
  }
}

async function main() {
  const wasm = await import(WASM_ENTRY);
  await wasm.init();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Clips whose musical point is harmonic/melodic movement over time. A frozen
  // render (the classic ticks-vs-quarter-notes bug) collapses these to one pitch.
  const movementFloor = { band: 3, lead: 3 };

  for (const [name, build] of Object.entries(CLIPS)) {
    const samples = build(wasm);
    if (movementFloor[name] !== undefined) {
      assertHarmonicMovement(wasm, name, samples, movementFloor[name]);
    }
    const wav = encodeWav(samples, SR);
    const file = path.join(OUT_DIR, `${name}.wav`);
    fs.writeFileSync(file, wav);
    const sec = (samples.length / SR).toFixed(2);
    console.log(
      `wrote ${path.relative(ROOT, file)}  (${sec}s, ${(wav.length / 1024).toFixed(0)} KB)`,
    );
  }
}

main().catch((err) => {
  console.error('demo-asset generation failed:', err);
  process.exit(1);
});
