#!/usr/bin/env node
/**
 * Regenerate the GS reference data the /gs-module demo reads, from the sibling
 * libsonare checkout. The results are committed, so a deploy build never needs
 * the sibling — this runs the same way `copy:wasm` does, by hand after the
 * engine changes.
 *
 * Four artifacts, each for a different reason it cannot be read at runtime:
 *
 * - The address table (every GS address with its AUDIBLE/STATE/ACCEPT/IGNORE
 *   level, range, power-on default and, for IGNORE, the reason) lives in a
 *   constexpr array the WASM surface does not expose. The engine ships a
 *   dumper for it, so this compiles that one translation unit and runs it.
 * - The insertion-effect conversion tables are derived from a hardware
 *   measurement archive into `tools/gs/efx-tables.json`; the C++ header beside
 *   them is itself generated from that file, so the JSON is the source to read.
 * - The insertion-effect bindings — which control each (type, slot) reaches —
 *   are hand-adjudicated beside those tables and compiled into a header the
 *   WASM surface does not export either. They are what turns a slot number on
 *   screen into the name of the thing the byte moves.
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
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSmf, dt1, noteEvents } from '../src/utils/gsSysex.ts';
import {
  artifact,
  digestSources,
  EFX_BINDINGS_DIR,
  ENGINE_DIR,
  OUT_DIR,
  WASM_META,
} from './lib/gs-data-sources.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const ADDRESS_ARTIFACT = 'address-table.json';
const EFX_ARTIFACT = 'efx-tables.json';
const BINDINGS_ARTIFACT = 'efx-bindings.json';
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

/**
 * A binding row is translated when it carries a stage and measured class/table,
 * designed when it carries the designed-law object, or enables when it carries
 * the stage-switch description. The old state/unmapped/builder/unreadable
 * vocabulary is deliberately rejected: every printed slot now has one of the
 * three adjudicated forms.
 */
const BINDING_FORMS = ['translated', 'designed', 'enables'];
const OBSOLETE_BINDING_FIELDS = ['state', 'unmapped', 'builder', 'unreadable'];

/** Fields the inspector reads; authoring notes never cross into the site data. */
const BINDING_FIELDS = [
  'stage',
  'class',
  'table',
  'key',
  'keys',
  'via',
  'range',
  'printed_values',
  'printed_mark',
  'printed_name',
  'ordinal',
  'alternatives',
  'designed',
  'enables',
];

/**
 * Join every binding file into one list.
 *
 * The engine splits them by effect-type MSB so a file stays small enough to
 * read; that split is an authoring convenience, and carrying it into the
 * browser would make the demo know a filing rule it has no use for.
 */
function readEfxBindings(engineDir) {
  const dir = path.join(engineDir, EFX_BINDINGS_DIR);
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .flatMap((name) => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')));
}

/**
 * Throws unless every row names one effect type, one slot and exactly one form.
 *
 * Two forms on a row, or none, would leave the inspector guessing what the
 * slot is — and the whole point of the tree upstream is that each printed
 * parameter was looked at once. A duplicated `(type, slot)` is the same defect
 * seen from the other side: two answers for one byte.
 */
export function validateEfxBindings(rows, slotCount) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('efx bindings carry no rows');
  }
  const seen = new Set();
  for (const row of rows) {
    if (typeof row.type !== 'string' || !/^[0-9A-F]{2} [0-9A-F]{2}$/.test(row.type)) {
      throw new Error(`binding row has an unreadable type: ${JSON.stringify(row).slice(0, 120)}`);
    }
    if (!Number.isInteger(row.slot) || row.slot < 0 || row.slot >= slotCount) {
      throw new Error(`binding row ${row.type} has a slot outside the block: ${row.slot}`);
    }
    const id = `${row.type}/${row.slot}`;
    const obsolete = OBSOLETE_BINDING_FIELDS.filter((field) => row[field] !== undefined);
    if (obsolete.length > 0) {
      throw new Error(`binding row ${id} uses obsolete form field(s): ${obsolete.join(', ')}`);
    }
    if (row.printed_name === undefined || typeof row.printed_name !== 'string') {
      throw new Error(`binding row ${id} has no printed_name`);
    }
    const explicitForms = ['designed', 'enables'].filter((form) => row[form] !== undefined);
    const form = explicitForms.length > 0 ? explicitForms[0] : 'translated';
    if (row.form !== undefined && !BINDING_FORMS.includes(row.form)) {
      throw new Error(`binding row ${id} uses an unknown form: ${row.form}`);
    }
    if (row.form !== undefined && row.form !== form) {
      throw new Error(`binding row ${id} declares ${row.form} but carries ${form} fields`);
    }
    if (explicitForms.length > 1 || (form === 'translated' && row.stage === undefined)) {
      throw new Error(
        `binding row ${id} carries conflicting or no forms ` +
          `(${[...explicitForms, row.stage !== undefined ? 'translated' : ''].filter(Boolean).join(', ')})`,
      );
    }
    if (seen.has(id)) throw new Error(`binding row ${id} appears twice`);
    seen.add(id);

    const keys = row.keys ?? (row.key === undefined ? [] : [row.key]);
    if (form !== 'enables') {
      if (typeof row.stage !== 'string' || row.stage.length === 0) {
        throw new Error(`binding row ${id} names no stage`);
      }
      if (
        !Array.isArray(keys) ||
        keys.length === 0 ||
        keys.some((key) => typeof key !== 'string')
      ) {
        throw new Error(`binding row ${id} names no key`);
      }
    }
    if (form === 'translated' && (typeof row.class !== 'string' || typeof row.table !== 'string')) {
      throw new Error(`binding row ${id} is translated but has no class/table`);
    }
    if (form === 'designed') {
      if (!row.designed || typeof row.designed !== 'object') {
        throw new Error(`binding row ${id} has no designed law`);
      }
      if (
        !['carried', 'invented'].includes(row.designed.basis) ||
        typeof row.designed.law !== 'string' ||
        !row.designed.replaced_when ||
        typeof row.designed.replaced_when !== 'object' ||
        typeof row.printed_values !== 'string'
      ) {
        throw new Error(`binding row ${id} has incomplete designed-law metadata`);
      }
      if (row.class !== undefined || row.table !== undefined || row.range !== undefined) {
        throw new Error(`binding row ${id} carries designed and measured-law fields`);
      }
    }
    if (form === 'enables') {
      if (!row.enables || typeof row.enables !== 'object') {
        throw new Error(`binding row ${id} has no enables description`);
      }
      const hasStages = Array.isArray(row.enables.stages);
      const hasSelect = Array.isArray(row.enables.select);
      if (
        hasStages === hasSelect ||
        row.enables.basis !== 'invented' ||
        !row.enables.replaced_when
      ) {
        throw new Error(`binding row ${id} has incomplete enables metadata`);
      }
      const stages = hasStages ? row.enables.stages : row.enables.select;
      if (
        stages.some(
          (stage) =>
            !stage ||
            typeof stage.stage !== 'string' ||
            (stage.ordinal !== undefined && !Number.isInteger(stage.ordinal)),
        )
      ) {
        throw new Error(`binding row ${id} has an unreadable enables stage`);
      }
      if (hasStages && !Array.isArray(row.enables.on_states)) {
        throw new Error(`binding row ${id} has stages but no on_states`);
      }
      const ownFields = [
        'stage',
        'class',
        'table',
        'key',
        'keys',
        'via',
        'range',
        'alternatives',
        'ordinal',
      ];
      const conflict = ownFields.find((field) => row[field] !== undefined);
      if (conflict) throw new Error(`binding row ${id} enables row carries ${conflict}`);
    }
  }
  return rows;
}

/**
 * The fields the inspector reads, in a stable key order.
 *
 * The tree also carries `note`, which its own schema calls free text nothing
 * parses. A panel that printed it would turn an authoring aside into published
 * copy, so it stops here.
 */
function selectBindingFields(rows) {
  return rows.map((row) => {
    const picked = { type: row.type, slot: row.slot };
    const form =
      row.enables !== undefined
        ? 'enables'
        : row.designed !== undefined
          ? 'designed'
          : 'translated';
    for (const field of BINDING_FIELDS) {
      if (row[field] !== undefined) picked[field] = row[field];
    }
    picked.form = form;
    return picked;
  });
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
  const classes = structuredClone(raw.classes);
  // Archive paths identify a specific hardware model; the inspector uses the table values, not those paths.
  for (const table of Object.values(classes?.corner?.tables ?? {})) {
    delete table.from;
  }
  return {
    archive_revision: raw.archive_revision,
    what_this_is: raw.what_this_is,
    what_this_cannot_see: raw.what_this_cannot_see,
    schema: raw.schema,
    reach: raw.reach,
    reach_by_class: raw.reach_by_class,
    classes,
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

/**
 * A model designation — a short letter cluster bound to a number — names the
 * hardware an archive measured, and nothing published from this repo carries
 * one. The guard is structural rather than a list of names, because a list
 * would put the very strings it excludes into this file.
 */
const MODEL_DESIGNATION =
  /\b[A-Za-z]{2,5}-\d{2,5}[A-Za-z]{0,3}\b|\b[A-Za-z]{2,5}\d{3,5}[A-Za-z]{0,3}\b/;

/**
 * Rewrites for engine prose that trips the guard, keyed by the digest of the
 * original so neither side of the pair spells a designation out. An unknown
 * digest fails the run: the engine changed its wording and a human decides how
 * the sentence should read here.
 */
const REDACTIONS = new Map([
  [
    '49e2a7dac2676993',
    'no row between PATCH NAME and REVERB MACRO; the PARTIAL RESERVE block earlier ' +
      'GS modules defined, and the one modelled here dropped, arrives here',
  ],
]);

function digestOf(text) {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
}

/** Walks a payload, rewriting or refusing any string that names a model. */
function scrub(value, where = '$') {
  if (typeof value === 'string') {
    if (!MODEL_DESIGNATION.test(value)) return value;
    const replacement = REDACTIONS.get(digestOf(value));
    if (replacement === undefined) {
      throw new Error(
        `${where} reads as a model designation and has no rewrite (digest ${digestOf(value)}). ` +
          'Add one to REDACTIONS in this script, or drop the field.',
      );
    }
    if (MODEL_DESIGNATION.test(replacement)) {
      throw new Error(`the rewrite for ${where} still reads as a model designation`);
    }
    return replacement;
  }
  if (Array.isArray(value)) return value.map((item, i) => scrub(item, `${where}[${i}]`));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => {
        if (MODEL_DESIGNATION.test(key)) throw new Error(`${where}.${key} names a model`);
        return [key, scrub(item, `${where}.${key}`)];
      }),
    );
  }
  return value;
}

function write(file, payload, sources) {
  const target = path.join(OUT_DIR, file);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const body = { _sources: sources, ...scrub(payload, file) };
  fs.writeFileSync(target, `${JSON.stringify(body, null, 2)}\n`);
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

  const slotCount = addressTable.rows.find((row) => row.param === 'kEfxParameter').size;
  const bindingRows = validateEfxBindings(readEfxBindings(ENGINE_DIR), slotCount);
  const bindings = selectBindingFields(bindingRows);
  const counts = Object.fromEntries(
    BINDING_FORMS.map((form) => [
      form,
      bindingRows.filter((row) => {
        if (form === 'translated')
          return row.stage !== undefined && row.designed === undefined && row.enables === undefined;
        return row[form] !== undefined;
      }).length,
    ]),
  );
  const bindingsOut = write(
    BINDINGS_ARTIFACT,
    {
      what_this_is:
        'Which physical quantity each insertion-effect (type, slot) names, and which ' +
        'insert control receives it. The conversion archive measures laws and which ' +
        'slots move the sound; it does not record what a slot is called, so this is ' +
        'the side that gives a byte a name.',
      slots_per_type: slotCount,
      counts,
      rows: bindings,
    },
    digestSources(artifact(BINDINGS_ARTIFACT), ENGINE_DIR),
  );
  console.log(
    `✓ ${BINDINGS_ARTIFACT} — ${bindings.length} adjudicated slots ` +
      `(${counts.translated} translated, ${counts.designed} designed, ${counts.enables} enables), ` +
      `${bindingsOut.bytes} B`,
  );

  const wasm = await import(path.join(ROOT, 'src/wasm/index.js'));
  await wasm.init();
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
