/**
 * Subset the Piano Practice SoundFont down to the single preset the demo plays.
 *
 * The bundled acoustic-grand font ships as a full 128-instrument General MIDI
 * bank (~5.5 MB of sample data), but the demo only ever renders bank 0 /
 * program 0 — the acoustic grand piano. This walks the SF2 preset → instrument
 * → sample graph from that one preset, keeps only the reachable records, and
 * rewrites every cross-referencing index (pbag/pgen, ibag/igen, shdr) and the
 * sample data (`smpl`) into a minimal font. The kept preset's samples are copied
 * byte-for-byte, so the piano sounds identical — the render is unchanged, only
 * the ~190 unused instruments are dropped.
 *
 * Usage:
 *   node scripts/trim-practice-sf2.mjs <input.sf2> [output.sf2]
 *
 * With no output path the trimmed font is written next to the input as
 * `<name>.trimmed.sf2` so the source is never clobbered in place.
 */
import fs from 'node:fs';
import path from 'node:path';

const GEN_INSTRUMENT = 41;
const GEN_SAMPLE_ID = 53;
const SAMPLE_GUARD = 46; // zero-sample gap SF2 requires after each sample

const inPath = process.argv[2];
if (!inPath) {
  console.error('usage: node scripts/trim-practice-sf2.mjs <input.sf2> [output.sf2]');
  process.exit(1);
}
const outPath =
  process.argv[3] ??
  path.join(path.dirname(inPath), `${path.basename(inPath, '.sf2')}.trimmed.sf2`);

const src = fs.readFileSync(inPath);
if (src.toString('latin1', 0, 4) !== 'RIFF' || src.toString('latin1', 8, 12) !== 'sfbk') {
  throw new Error('not a SoundFont (RIFF/sfbk) file');
}

// ---- parse the RIFF tree into a flat map of leaf chunks ---------------------
/** @type {Record<string, Buffer>} */
const chunks = {};
let infoList = null; // keep the INFO LIST body verbatim
(function walk(base, end) {
  let i = base;
  while (i + 8 <= end) {
    const tag = src.toString('latin1', i, i + 4);
    const size = src.readUInt32LE(i + 4);
    const body = i + 8;
    if (tag === 'LIST') {
      const form = src.toString('latin1', body, body + 4);
      if (form === 'INFO') infoList = src.subarray(body, body + size);
      walk(body + 4, body + size);
    } else {
      chunks[tag] = src.subarray(body, body + size);
    }
    i = body + size + (size & 1);
  }
})(12, src.readUInt32LE(4) + 8);

for (const t of ['phdr', 'pbag', 'pmod', 'pgen', 'inst', 'ibag', 'imod', 'igen', 'shdr', 'smpl']) {
  if (!chunks[t]) throw new Error(`missing ${t} chunk`);
}
if (chunks.sm24) throw new Error('24-bit sample data (sm24) is not supported by this trimmer');

// ---- typed views over the fixed-width record tables -------------------------
const phdr = chunks.phdr; // 38 bytes
const pbag = chunks.pbag; // 4
const pmod = chunks.pmod; // 10
const pgen = chunks.pgen; // 4
const inst = chunks.inst; // 22
const ibag = chunks.ibag; // 4
const imod = chunks.imod; // 10
const igen = chunks.igen; // 4
const shdr = chunks.shdr; // 46
const smpl = chunks.smpl; // 16-bit PCM

const nPhdr = phdr.length / 38;
const bagOfPreset = (k) => phdr.readUInt16LE(k * 38 + 24);

// Locate bank 0 / preset 0 (acoustic grand).
let target = -1;
for (let k = 0; k < nPhdr - 1; k++) {
  const preset = phdr.readUInt16LE(k * 38 + 20);
  const bank = phdr.readUInt16LE(k * 38 + 22);
  if (bank === 0 && preset === 0) {
    target = k;
    break;
  }
}
if (target < 0) throw new Error('bank 0 / preset 0 not found');
const presetName = phdr.toString('latin1', target * 38, target * 38 + 20).replace(/\0.*$/, '');

// ---- collect reachable instruments, then reachable samples ------------------
const keptInst = []; // old instrument index, in first-seen order
const instIndex = new Map(); // old -> new
const useInst = (old) => {
  if (!instIndex.has(old)) {
    instIndex.set(old, keptInst.length);
    keptInst.push(old);
  }
  return instIndex.get(old);
};

// Rebuilt preset tables (single preset, index 0).
const outPbag = []; // {genNdx, modNdx}
const outPgen = []; // Buffer(4)
const outPmod = []; // Buffer(10)
{
  const first = bagOfPreset(target);
  const last = bagOfPreset(target + 1);
  for (let b = first; b < last; b++) {
    const g0 = pbag.readUInt16LE(b * 4);
    const g1 = pbag.readUInt16LE((b + 1) * 4);
    const m0 = pbag.readUInt16LE(b * 4 + 2);
    const m1 = pbag.readUInt16LE((b + 1) * 4 + 2);
    outPbag.push({ genNdx: outPgen.length, modNdx: outPmod.length });
    for (let g = g0; g < g1; g++) {
      const rec = Buffer.from(pgen.subarray(g * 4, g * 4 + 4));
      if (rec.readUInt16LE(0) === GEN_INSTRUMENT)
        rec.writeUInt16LE(useInst(rec.readUInt16LE(2)), 2);
      outPgen.push(rec);
    }
    for (let m = m0; m < m1; m++) outPmod.push(Buffer.from(pmod.subarray(m * 10, m * 10 + 10)));
  }
}

const keptSample = []; // old sample index, first-seen order
const sampleIndex = new Map();
const useSample = (old) => {
  if (!sampleIndex.has(old)) {
    sampleIndex.set(old, keptSample.length);
    keptSample.push(old);
  }
  return sampleIndex.get(old);
};

// Rebuilt instrument tables (only the reachable instruments).
const outInst = []; // {ibagNdx, name}
const outIbag = []; // {genNdx, modNdx}
const outIgen = []; // Buffer(4)
const outImod = []; // Buffer(10)
const bagOfInst = (k) => inst.readUInt16LE(k * 22 + 20);
for (const oldInst of keptInst) {
  outInst.push({
    ibagNdx: outIbag.length,
    name: inst.toString('latin1', oldInst * 22, oldInst * 22 + 20).replace(/\0.*$/, ''),
  });
  const first = bagOfInst(oldInst);
  const last = bagOfInst(oldInst + 1);
  for (let b = first; b < last; b++) {
    const g0 = ibag.readUInt16LE(b * 4);
    const g1 = ibag.readUInt16LE((b + 1) * 4);
    const m0 = ibag.readUInt16LE(b * 4 + 2);
    const m1 = ibag.readUInt16LE((b + 1) * 4 + 2);
    outIbag.push({ genNdx: outIgen.length, modNdx: outImod.length });
    for (let g = g0; g < g1; g++) {
      const rec = Buffer.from(igen.subarray(g * 4, g * 4 + 4));
      if (rec.readUInt16LE(0) === GEN_SAMPLE_ID)
        rec.writeUInt16LE(useSample(rec.readUInt16LE(2)), 2);
      outIgen.push(rec);
    }
    for (let m = m0; m < m1; m++) outImod.push(Buffer.from(imod.subarray(m * 10, m * 10 + 10)));
  }
}

// Include stereo partners so left/right samples stay linked.
for (let i = 0; i < keptSample.length; i++) {
  const old = keptSample[i];
  const type = shdr.readUInt16LE(old * 46 + 44);
  const isStereo = (type & 0x000f) === 2 || (type & 0x000f) === 4;
  if (isStereo) useSample(shdr.readUInt16LE(old * 46 + 42)); // sampleLink
}

// ---- rebuild the sample pool + shdr with remapped offsets/links -------------
const outSamples = []; // Buffer chunks of PCM
const outShdr = []; // {name,start,end,startloop,endloop,rate,pitch,corr,link,type}
let cursor = 0; // in samples
for (const old of keptSample) {
  const o = old * 46;
  const start = shdr.readUInt32LE(o + 20);
  const end = shdr.readUInt32LE(o + 24);
  const startloop = shdr.readUInt32LE(o + 28);
  const endloop = shdr.readUInt32LE(o + 32);
  const len = end - start;
  outSamples.push(smpl.subarray(start * 2, end * 2));
  outSamples.push(Buffer.alloc(SAMPLE_GUARD * 2)); // zero guard
  outShdr.push({
    name: shdr.toString('latin1', o, o + 20).replace(/\0.*$/, ''),
    start: cursor,
    end: cursor + len,
    startloop: cursor + (startloop - start),
    endloop: cursor + (endloop - start),
    rate: shdr.readUInt32LE(o + 36),
    pitch: shdr.readUInt8(o + 40),
    corr: shdr.readInt8(o + 41),
    link: shdr.readUInt16LE(o + 42),
    type: shdr.readUInt16LE(o + 44),
  });
  cursor += len + SAMPLE_GUARD;
}
// Remap stereo links to their new indices (drop to mono if the partner is gone).
for (const s of outShdr) {
  const flags = s.type & 0x000f;
  if (flags === 2 || flags === 4) {
    if (sampleIndex.has(s.link)) s.link = sampleIndex.get(s.link);
    else {
      s.link = 0;
      s.type = (s.type & 0xff00) | 1; // mono
    }
  } else {
    s.link = 0;
  }
}

// ---- serialize the trimmed tables ------------------------------------------
function buildPhdr() {
  const buf = Buffer.alloc(2 * 38);
  buf.write(presetName.slice(0, 19), 0, 'latin1');
  buf.writeUInt16LE(0, 20); // preset
  buf.writeUInt16LE(0, 22); // bank
  buf.writeUInt16LE(0, 24); // bag ndx
  buf.write('EOP', 38, 'latin1');
  buf.writeUInt16LE(outPbag.length, 38 + 24);
  return buf;
}
function buildBag(zones, genLen, modLen) {
  const buf = Buffer.alloc((zones.length + 1) * 4);
  zones.forEach((z, i) => {
    buf.writeUInt16LE(z.genNdx, i * 4);
    buf.writeUInt16LE(z.modNdx, i * 4 + 2);
  });
  buf.writeUInt16LE(genLen, zones.length * 4); // terminal
  buf.writeUInt16LE(modLen, zones.length * 4 + 2);
  return buf;
}
function concatRecords(records, width) {
  const buf = Buffer.alloc((records.length + 1) * width); // + terminal zero record
  records.forEach((r, i) => {
    r.copy(buf, i * width);
  });
  return buf;
}
function buildInst() {
  const buf = Buffer.alloc((outInst.length + 1) * 22);
  outInst.forEach((it, i) => {
    buf.write(it.name.slice(0, 19), i * 22, 'latin1');
    buf.writeUInt16LE(it.ibagNdx, i * 22 + 20);
  });
  buf.write('EOI', outInst.length * 22, 'latin1');
  buf.writeUInt16LE(outIbag.length, outInst.length * 22 + 20);
  return buf;
}
function buildShdr() {
  const buf = Buffer.alloc((outShdr.length + 1) * 46);
  outShdr.forEach((s, i) => {
    const o = i * 46;
    buf.write(s.name.slice(0, 19), o, 'latin1');
    buf.writeUInt32LE(s.start, o + 20);
    buf.writeUInt32LE(s.end, o + 24);
    buf.writeUInt32LE(s.startloop, o + 28);
    buf.writeUInt32LE(s.endloop, o + 32);
    buf.writeUInt32LE(s.rate, o + 36);
    buf.writeUInt8(s.pitch & 0xff, o + 40);
    buf.writeInt8(s.corr, o + 41);
    buf.writeUInt16LE(s.link, o + 42);
    buf.writeUInt16LE(s.type, o + 44);
  });
  buf.write('EOS', outShdr.length * 46, 'latin1');
  return buf;
}

function riffChunk(tag, body) {
  const head = Buffer.alloc(8);
  head.write(tag, 0, 'latin1');
  head.writeUInt32LE(body.length, 4);
  const parts = [head, body];
  if (body.length & 1) parts.push(Buffer.alloc(1)); // pad to even
  return Buffer.concat(parts);
}
function listChunk(form, bodies) {
  const inner = Buffer.concat([Buffer.from(form, 'latin1'), ...bodies]);
  return riffChunk('LIST', inner);
}

const smplBody = Buffer.concat(outSamples);
const sdta = listChunk('sdta', [riffChunk('smpl', smplBody)]);
const pdta = listChunk('pdta', [
  riffChunk('phdr', buildPhdr()),
  riffChunk('pbag', buildBag(outPbag, outPgen.length, outPmod.length)),
  riffChunk('pmod', concatRecords(outPmod, 10)),
  riffChunk('pgen', concatRecords(outPgen, 4)),
  riffChunk('inst', buildInst()),
  riffChunk('ibag', buildBag(outIbag, outIgen.length, outImod.length)),
  riffChunk('imod', concatRecords(outImod, 10)),
  riffChunk('igen', concatRecords(outIgen, 4)),
  riffChunk('shdr', buildShdr()),
]);
const info = listChunk('INFO', [infoList.subarray(4)]); // strip the 'INFO' form id (re-added)

const payload = Buffer.concat([Buffer.from('sfbk', 'latin1'), info, sdta, pdta]);
const out = riffChunk('RIFF', payload);
fs.writeFileSync(outPath, out);

console.log(`preset kept : ${presetName} (bank 0 / program 0)`);
console.log(`instruments : ${keptInst.length}  samples: ${keptSample.length}`);
console.log(
  `size        : ${(src.length / 1048576).toFixed(2)} MB -> ${(out.length / 1048576).toFixed(2)} MB`,
);
console.log(`written     : ${outPath}`);
