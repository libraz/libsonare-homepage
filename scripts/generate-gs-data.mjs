#!/usr/bin/env node
/**
 * Regenerate the GS reference data the /gs-module demo reads, from the sibling
 * libsonare checkout. The results are committed, so a deploy build never needs
 * the sibling — this runs the same way `copy:wasm` does, by hand after the
 * engine changes.
 *
 * Three artifacts, each for a different reason it cannot be read at runtime:
 *
 * - The address table (every GS address with its AUDIBLE/STATE/ACCEPT/IGNORE
 *   level, range, power-on default and, for IGNORE, the reason) lives in a
 *   constexpr array the WASM surface does not expose. The engine ships a
 *   dumper for it, so this compiles that one translation unit and runs it.
 * - The insertion-effect conversion tables are derived from a hardware
 *   measurement archive into `tools/gs/efx-tables.json`; the C++ header beside
 *   them is itself generated from that file, so the JSON is the source to read.
 * - Whether an effect type changes the sound at its power-on defaults is not
 *   written down anywhere: it is a property of the build. This renders the same
 *   chord through every type and compares, which is 65 bounces and far too slow
 *   to do in a browser.
 *
 * Each artifact carries the sha256 of every input it was built from — the
 * measured one records the WASM build instead — which is what `check:gs-data`
 * compares when a sibling checkout is present.
 *
 * Run through `yarn generate:gs-data`: it imports a TypeScript module and so
 * needs node's type stripping.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSmf, dt1, noteEvents } from '../src/utils/gsSysex.ts';
import { artifact, digestSources, ENGINE_DIR, OUT_DIR, WASM_META } from './lib/gs-data-sources.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const ADDRESS_ARTIFACT = 'address-table.json';
const EFX_ARTIFACT = 'efx-tables.json';
const AUDIBILITY_ARTIFACT = 'efx-audibility.json';

/** The four levels the table promises per address; anything else is a parse failure. */
const LEVELS = new Set(['AUDIBLE', 'STATE', 'ACCEPT', 'IGNORE']);
/**
 * A floor, not an expected count — the engine is free to name more addresses,
 * and the demo should follow it. What this catches is a dumper that ran but
 * emitted a fraction of the table, which validation alone would pass.
 */
const MIN_ADDRESS_ROWS = 150;

/**
 * Throws unless every row carries the fields the demo reads. The dumper writes
 * JSON with printf, so a field that silently went missing is a real failure
 * mode rather than a theoretical one.
 */
export function validateAddressTable(table) {
  if (!Array.isArray(table.rows) || table.rows.length < MIN_ADDRESS_ROWS) {
    throw new Error(
      `address table has ${table.rows?.length ?? 0} rows, expected at least ${MIN_ADDRESS_ROWS}`,
    );
  }
  if (!Array.isArray(table.undefined_ranges)) {
    throw new Error('address table is missing undefined_ranges');
  }
  for (const row of table.rows) {
    if (typeof row.address !== 'string' || !LEVELS.has(row.level)) {
      throw new Error(`unreadable address row: ${JSON.stringify(row).slice(0, 120)}`);
    }
    for (const field of ['addr', 'mask', 'size', 'lo', 'hi', 'def']) {
      if (!Number.isInteger(row[field])) {
        throw new Error(`address ${row.address} has a non-integer ${field}`);
      }
    }
    // A row that drops the byte owes a reason, whether it declines the
    // parameter outright or decodes it and discards it.
    if ((row.level === 'IGNORE' || row.level === 'ACCEPT') && !row.why) {
      throw new Error(`address ${row.address} is ${row.level} with no reason`);
    }
  }
  return table;
}

/** Throws unless the derived tables carry the conversions and defaults the inspector reads. */
export function validateEfxTables(tables) {
  const types = tables.defaults?.types;
  if (!Number.isInteger(types) || types < 1) {
    throw new Error('efx tables declare no effect types');
  }
  if (Object.keys(tables.defaults.by_type ?? {}).length !== types) {
    throw new Error(
      `efx defaults cover ${Object.keys(tables.defaults.by_type ?? {}).length} of ${types} types`,
    );
  }
  if (!Array.isArray(tables.map) || tables.map.length === 0) {
    throw new Error('efx tables carry no (type, slot) conversions');
  }
  if (!Array.isArray(tables.what_this_cannot_see) || tables.what_this_cannot_see.length === 0) {
    throw new Error('efx tables carry no statement of their own limits');
  }
  return tables;
}

/** Compile the engine's address-table dumper and read its JSON. */
function runAddressDumper(engineDir) {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-addr-'));
  const binary = path.join(workDir, 'dump_address_table');
  try {
    execFileSync(
      'c++',
      [
        '-std=c++17',
        '-O0',
        '-I',
        path.join(engineDir, 'src'),
        '-I',
        path.join(engineDir, 'include'),
        path.join(engineDir, 'tools/gs/dump_address_table.cpp'),
        path.join(engineDir, 'src/midi/synth/gs_address_table.cpp'),
        '-o',
        binary,
      ],
      { stdio: ['ignore', 'inherit', 'inherit'] },
    );
    return JSON.parse(execFileSync(binary, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

/**
 * The fields the inspector reads. The derivation file also carries the
 * bookkeeping its own tooling needs (`derivation_checks`, dirty-input flags);
 * shipping those to a browser would only invite the demo to explain them.
 */
function selectEfxFields(raw) {
  return {
    unit_id: raw.unit_id,
    model: raw.model,
    archive_revision: raw.archive_revision,
    what_this_is: raw.what_this_is,
    what_this_cannot_see: raw.what_this_cannot_see,
    schema: raw.schema,
    reach: raw.reach,
    reach_by_class: raw.reach_by_class,
    classes: raw.classes,
    defaults: raw.defaults,
    map: raw.map,
  };
}

// ---- measured: which types change the sound at their power-on defaults -----

const SR = 44100;
/** A sustained triad on the fallback piano — enough spectrum for any of the types to act on. */
const PROBE_CHORD = [52, 55, 59];
const PROBE_SECONDS = 1.7;

/**
 * Bounce the probe chord with the shared insertion effect set to `type`
 * (0 = Thru), optionally overriding one parameter slot.
 *
 * The slot write goes after the type, and has to: selecting a type overwrites
 * the whole parameter block with that type's own power-on bytes, so a slot
 * written first is wiped.
 */
function renderThroughEfx(wasm, type, slot = null, value = 0) {
  const events = [];
  if (type > 0) {
    events.push({ beat: 0, sysex: dt1([0x40, 0x03, 0x00, (type >> 8) & 0x7f, type & 0x7f]) });
    events.push({ beat: 0, sysex: dt1([0x40, 0x41, 0x22, 1]) });
  }
  if (slot !== null) events.push({ beat: 0, sysex: dt1([0x40, 0x03, 0x03 + slot, value]) });
  for (const note of PROBE_CHORD) events.push(...noteEvents(0, note, 112, 0, 2.3));
  const project = new wasm.Project();
  try {
    project.setSampleRate(SR);
    project.importSmf(buildSmf(events, 3.4));
    return project.bounceWithSf2Instrument(
      {},
      { numChannels: 1, sampleRate: SR, totalFrames: Math.round(SR * PROBE_SECONDS) },
    );
  } finally {
    project.delete();
  }
}

function rms(buffer) {
  let sum = 0;
  for (const x of buffer) sum += x * x;
  return Math.sqrt(sum / buffer.length);
}

/**
 * One quantum of float32 mantissa. A type routed through a stage that is
 * arithmetically the identity still reorders the arithmetic, and the render
 * lands exactly this far from Thru — never zero, never further. It is the floor
 * the comparison cannot see below, so it is where "unchanged" is drawn.
 */
const FLOAT32_ULP = 2 ** -24;

/**
 * Peak-normalize both sides before differencing, so a type that only changes
 * level does not read as a change of character, and report the raw peak
 * deviation alongside so the floor stays checkable.
 */
export function compareRenders(a, b) {
  const scaleA = a.reduce((m, x) => Math.max(m, Math.abs(x)), 0) || 1;
  const scaleB = b.reduce((m, x) => Math.max(m, Math.abs(x)), 0) || 1;
  let sum = 0;
  let maxAbs = 0;
  for (let i = 0; i < a.length; i++) {
    const scaled = a[i] / scaleA - b[i] / scaleB;
    sum += scaled * scaled;
    maxAbs = Math.max(maxAbs, Math.abs(a[i] - b[i]));
  }
  return { distance: Math.sqrt(sum / a.length), maxAbs };
}

/**
 * What each effect type does to the render, at the bytes it powers up holding,
 * and which of its parameter slots the engine acts on.
 *
 * `changes_signal` is the only claim drawn mechanically from the distance, and
 * its cut is round-off rather than a tuned number. Whether a change above it is
 * *heard* is a listening question this cannot answer, which is why the distance
 * ships alongside.
 *
 * It says nothing about whether the build has an insert for the type either:
 * two of the EQ types land on opposite sides of the line because one is flat at
 * its power-on defaults and the other is not. `live_slots` is the question that
 * survives that — a type flat at its defaults still has slots that move it.
 *
 * The archive says which slots it derived a conversion for, but that describes
 * the hardware it measured, not this build. Whether a write lands in the audio
 * is only findable by writing it, so each slot is probed at both ends of its
 * range. A slot that moves neither way is received and held rather than used:
 * the distinction the address table draws as AUDIBLE against STATE, resolved
 * per slot instead of per block.
 */
function measureAudibility(wasm, types, slotCount) {
  const dry = renderThroughEfx(wasm, 0);
  const dryRms = rms(dry);
  return types.map((key) => {
    const type = Number.parseInt(key.replace(' ', ''), 16);
    const rendered = renderThroughEfx(wasm, type);
    const { distance, maxAbs } = compareRenders(rendered, dry);
    return {
      type: key,
      changes_signal: maxAbs > FLOAT32_ULP,
      distance: Number(distance.toPrecision(4)),
      level_ratio: Number((rms(rendered) / dryRms).toPrecision(4)),
      live_slots: liveSlots(wasm, type, rendered, slotCount),
    };
  });
}

/**
 * Indented so an engine change reads as a reviewable diff rather than one
 * rewritten line. Vite minifies the import, so the width costs nothing shipped.
 * `biome.jsonc` excludes this directory, or the formatter and this function
 * would take turns rewriting the same files.
 */
/**
 * Which of each type's twenty parameter slots the engine actually acts on.
 *
 * The archive says which slots it derived a conversion for; that is a statement
 * about the hardware it measured, not about this build. Whether a write lands
 * in the audio can only be found by writing it, so each slot is probed at both
 * ends of its range against the type's own baseline. A slot that moves neither
 * way is being received and held rather than used — the difference the address
 * table draws as AUDIBLE against STATE, resolved per slot instead of per block.
 */
function liveSlots(wasm, type, baseline, slotCount) {
  const live = [];
  for (let slot = 0; slot < slotCount; slot++) {
    for (const value of [0, 127]) {
      const { maxAbs } = compareRenders(renderThroughEfx(wasm, type, slot, value), baseline);
      if (maxAbs > FLOAT32_ULP) {
        live.push(slot);
        break;
      }
    }
  }
  return live;
}

function write(file, payload, sources) {
  const target = path.join(OUT_DIR, file);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify({ _sources: sources, ...payload }, null, 2)}\n`);
  return { target, bytes: fs.statSync(target).size };
}

async function main() {
  if (!fs.existsSync(ENGINE_DIR)) {
    console.error(`❌ libsonare checkout not found at ${ENGINE_DIR}`);
    console.error(
      '   The generated data is committed; clone the engine beside this repo to refresh it.',
    );
    process.exit(1);
  }

  const addressTable = validateAddressTable(runAddressDumper(ENGINE_DIR));
  const address = write(
    ADDRESS_ARTIFACT,
    addressTable,
    digestSources(artifact(ADDRESS_ARTIFACT), ENGINE_DIR),
  );
  console.log(
    `✓ ${ADDRESS_ARTIFACT} — ${addressTable.rows.length} addresses, ` +
      `${addressTable.undefined_ranges.length} undefined ranges, ${address.bytes} B`,
  );

  const efxRaw = JSON.parse(
    fs.readFileSync(path.join(ENGINE_DIR, 'tools/gs/efx-tables.json'), 'utf8'),
  );
  const efx = validateEfxTables(selectEfxFields(efxRaw));
  const efxOut = write(EFX_ARTIFACT, efx, digestSources(artifact(EFX_ARTIFACT), ENGINE_DIR));
  console.log(
    `✓ ${EFX_ARTIFACT} — ${efx.defaults.types} effect types, ${efx.map.length} conversions, ` +
      `${efxOut.bytes} B`,
  );

  const wasm = await import(path.join(ROOT, 'src/wasm/index.js'));
  await wasm.init();
  const slotCount = addressTable.rows.find((row) => row.param === 'kEfxParameter').size;
  const audibility = measureAudibility(wasm, Object.keys(efx.defaults.by_type), slotCount);
  const meta = JSON.parse(fs.readFileSync(WASM_META, 'utf8'));
  const measuredOut = write(
    AUDIBILITY_ARTIFACT,
    {
      measured_against: { version: meta.version, md5: meta.md5, buildDate: meta.buildDate },
      probe: {
        chord: PROBE_CHORD,
        velocity: 112,
        sample_rate: SR,
        seconds: PROBE_SECONDS,
        slots: slotCount,
        distance: 'RMS between the two renders after peak-normalizing each',
        changes_signal: 'peak deviation from Thru above one float32 quantum',
        live_slots:
          'slots whose value moves the render, probed at both ends of the range against this type at its own defaults',
        what_this_cannot_say:
          'Whether a change above that floor is audible. Every type powers up at its own default bytes, so a type can carry a working effect and still measure flat here; its live slots are the better question in that case.',
      },
      types: audibility,
    },
    digestSources(artifact(AUDIBILITY_ARTIFACT)),
  );
  const changed = audibility.filter((row) => row.changes_signal).length;
  const live = audibility.reduce((total, row) => total + row.live_slots.length, 0);
  console.log(
    `✓ ${AUDIBILITY_ARTIFACT} — ${changed} of ${audibility.length} types change the signal ` +
      `at their power-on defaults, ${live} live parameter slots across them, ${measuredOut.bytes} B`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
