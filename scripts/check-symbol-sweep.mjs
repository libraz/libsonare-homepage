#!/usr/bin/env node
/**
 * Gate: the English docs keep up with the engine.
 *
 * Two independent sections:
 *  A. every hard-required engine identifier appears somewhere under src/docs/ (any page,
 *     prose or code fence) — the list is fixed here and cannot be allow-listed;
 *  B. the CLI commands the docs invoke as `sonare <name>` agree with the engine's two
 *     registries: a command registered in the native CLI must be documented, and a documented
 *     command must be registered in the native CLI or the Python CLI. The allow-list holds
 *     documented-but-unregistered exceptions only, each with a reason, and an entry that no
 *     longer matches anything is itself a failure.
 *
 * Each registry that is absent from the sibling engine checkout is skipped with a notice;
 * the documented-but-unregistered check needs both. Section A always runs.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/** An identifier the docs must show as a quoted or backticked token, not as a bare word. */
function quoted(name) {
  return { name, quoted: true };
}

/** Engine identifiers the English docs must mention somewhere. Never allow-listable. */
export const HARD_REQUIRED_IDENTIFIERS = [
  // Mastering: limiter-driven loudness stage and the renamed denoise key.
  'maxLimiterGainReductionDb',
  'repair.denoise.reductionDb',
  // Mastering: restoration presets.
  quoted('vinyl'),
  quoted('tapeHiss'),
  quoted('fieldRecording'),
  quoted('voiceMemo'),
  quoted('shellac78'),
  // Mastering: interleaved LUFS series.
  'lufsSeriesInterleaved',
  // Mixing: mixer strip lifecycle and the assistant's high-pass default.
  'addStrip',
  'settle',
  'enableHighPass',
  // Mixing assistant: source classes and scene suggestion.
  'mixSourceClassNames',
  'mixSourceClassFromName',
  'suggestMixSceneJson',
  // Realtime engine: warp mode string and synth engine mode type.
  "'time-stretch'",
  'SynthEngineMode',
  // Realtime streaming: OPFS clip paging.
  'attachOpfsClipStream',
  'createOpfsClipPageProvider',
  'createOpfsClipPageWorker',
  'opfsClipPageWorkerSource',
  // Analysis: meter estimation and its per-beat onset strength.
  'estimateMeter',
  'beatObservations.onsetStrength',
  // Analysis: chord qualities and key confidence.
  quoted('6'),
  quoted('m6'),
  quoted('mM7'),
  quoted('7sus4'),
  quoted('11'),
  quoted('13'),
  quoted('7b9'),
  quoted('7#9'),
  'Key.confidence',
  // Analysis: stem decomposition, polyphonic and percussive helpers.
  'decomposeStems',
  'analyzePolyphonic',
  'decomposeNotePitch',
  'extractPercussiveEvents',
  'renderPercussiveEvents',
  // Acoustics: air absorption controls and the structured room-morph result.
  'airAbsorptionEnabled',
  'airTemperatureC',
  'airHumidityPercent',
  'roomMorph',
  // Recording and takes: alignment and silence-split helpers.
  'alignTakeToReference',
  'remixAlignedIntervals',
  'splitSilenceCommonWithReport',
  // Project editing: note targets from an SMF.
  'noteTargetsFromSmf',
  'assignNoteTargets',
  // Physical models: snare wire parameters.
  'wire_threshold',
  'wire_decay_ms',
  // CLI: pitch-editor and take-alignment commands.
  'tune-to-midi',
  'align-takes',
  // Python: the pre-validation error class.
  'SonareValueError',
  // Installation and schemas: CMake package and the mixer scene schema.
  'find_package(sonare',
  'mixer-scene.schema.json',
  // Validation: the parity coverage report.
  'tools/parity/surface-coverage.md',
];

const NATIVE_REGISTRY_RELATIVE_PATH = 'tools/cli/sonare_cli_registry.cpp';
const PYTHON_CLI_RELATIVE_PATH = 'bindings/python/src/libsonare';
const NATIVE_COMMAND = /add_command\(\s*commands,\s*"([^"]+)"/g;
const NATIVE_PROJECT_COMMAND = /add_project_command\(\s*"([^"]+)"/g;
const NATIVE_COMMAND_LOOP =
  /for \(const char\* path : \{([^}]*)\}\)\s*add_command\(\s*commands,\s*path\b/g;
// Python subparsers: `<receiver>.add_parser("name", ...)` or a loop variable in place of the
// literal; `project_sub` is the receiver for the `project` group's leaves.
const PYTHON_ADD_PARSER = /(\w+)\.add_parser\(\s*(?:"([^"]+)"|(\w+))/g;
const PYTHON_NAME_LOOP = /for (\w+) in \(([^)]*)\):/g;
const PYTHON_DISPATCH = /\bcommands\s*=\s*\{([^}]*)\}/;
const PYTHON_DISPATCH_KEY = /"([^"]+)"\s*:/g;
const PYTHON_PROJECT_RECEIVER = 'project_sub';
const QUOTED = /"([^"]+)"/g;
// Line-local on purpose: a `sonare` at the end of a prose line must not pick up the next line.
const DOCUMENTED_COMMAND =
  /\bsonare(?:-cli)?[ \t]+(?<project>project[ \t]+)?(?<name>[a-z][a-z0-9-]*)/g;

function listMarkdown(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listMarkdown(full, base));
    // README.md files are developer notes excluded from the build, not docs content.
    else if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md') {
      out.push(path.relative(base, full));
    }
  }
  return out.sort();
}

function listPythonSources(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.py'))
    .map((entry) => fs.readFileSync(path.join(dir, entry.name), 'utf8'));
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function identifierPattern(entry) {
  if (typeof entry === 'string') return new RegExp(escapeRegExp(entry));
  return new RegExp(`(['"\`])${escapeRegExp(entry.name)}\\1`);
}

function identifierLabel(entry) {
  return typeof entry === 'string' ? entry : `${entry.name} (quoted)`;
}

/** Command names the native CLI registers, with `project.<sub>` kept in registry spelling. */
export function nativeCliCommands(registrySource) {
  const names = new Set();
  for (const m of registrySource.matchAll(NATIVE_COMMAND)) names.add(m[1]);
  for (const m of registrySource.matchAll(NATIVE_PROJECT_COMMAND)) names.add(m[1]);
  for (const m of registrySource.matchAll(NATIVE_COMMAND_LOOP)) {
    for (const q of m[1].matchAll(QUOTED)) names.add(q[1]);
  }
  return names;
}

/** Command names the Python CLI registers across its package sources, in registry spelling. */
export function pythonCliCommands(sources) {
  const names = new Set();
  for (const source of sources) {
    const loops = new Map();
    for (const m of source.matchAll(PYTHON_NAME_LOOP)) {
      loops.set(
        m[1],
        [...m[2].matchAll(QUOTED)].map((q) => q[1]),
      );
    }
    for (const m of source.matchAll(PYTHON_ADD_PARSER)) {
      const [, receiver, literal, variable] = m;
      const prefix = receiver === PYTHON_PROJECT_RECEIVER ? 'project.' : '';
      for (const name of literal ? [literal] : (loops.get(variable) ?? [])) {
        names.add(`${prefix}${name}`);
      }
    }
    const dispatch = source.match(PYTHON_DISPATCH);
    if (dispatch) {
      for (const key of dispatch[1].matchAll(PYTHON_DISPATCH_KEY)) names.add(key[1]);
    }
  }
  return names;
}

/** Command names a markdown source invokes as `sonare <name>`, mapped to registry spelling. */
export function documentedCommands(markdown) {
  const names = new Set();
  for (const m of markdown.matchAll(DOCUMENTED_COMMAND)) {
    const { project, name } = m.groups;
    if (project) names.add(`project.${name}`);
    // A bare `sonare project` names the command group, not a command.
    else if (name !== 'project') names.add(name);
  }
  return names;
}

function readAllowList(allowPath, failures) {
  if (!fs.existsSync(allowPath)) return [];
  const parsed = JSON.parse(fs.readFileSync(allowPath, 'utf8'));
  if (!Array.isArray(parsed)) {
    failures.push('sweep: allow-list must be a JSON array');
    return [];
  }
  const entries = [];
  for (const entry of parsed) {
    const command = typeof entry?.command === 'string' ? entry.command.trim() : '';
    const reason = typeof entry?.reason === 'string' ? entry.reason.trim() : '';
    if (!command) {
      failures.push('sweep: allow-list entry is missing "command"');
      continue;
    }
    if (!reason) {
      failures.push(`sweep: allow-list entry "${command}" has no reason`);
      continue;
    }
    entries.push({ command, reason });
  }
  return entries;
}

function checkHardRequired({ failures, corpus }) {
  for (const entry of HARD_REQUIRED_IDENTIFIERS) {
    if (!identifierPattern(entry).test(corpus)) {
      failures.push(
        `sweep: identifier "${identifierLabel(entry)}" is not documented under src/docs/`,
      );
    }
  }
}

function checkCliParity({ failures, registryPath, pythonCliDir, allowPath, docs, warn }) {
  const native = fs.existsSync(registryPath)
    ? nativeCliCommands(fs.readFileSync(registryPath, 'utf8'))
    : null;
  const python = fs.existsSync(pythonCliDir)
    ? pythonCliCommands(listPythonSources(pythonCliDir))
    : null;
  if (!native) {
    warn(`sweep: native CLI registry not found at ${registryPath}; native parity check skipped`);
  }
  if (!python) {
    warn(`sweep: Python CLI package not found at ${pythonCliDir}; Python parity check skipped`);
  }

  const documentedIn = new Map();
  for (const { rel, text } of docs) {
    for (const name of documentedCommands(text)) {
      if (!documentedIn.has(name)) documentedIn.set(name, []);
      documentedIn.get(name).push(rel);
    }
  }
  const allowed = new Map(readAllowList(allowPath, failures).map((e) => [e.command, e]));

  if (native) {
    for (const name of [...native].sort()) {
      if (!documentedIn.has(name)) {
        failures.push(`sweep: CLI command "${name}" is registered but not documented`);
      }
    }
  }
  // A documented command is a phantom only when neither registry knows it.
  if (!native || !python) return;
  const registered = (name) => native.has(name) || python.has(name);
  for (const [name, files] of [...documentedIn].sort()) {
    if (registered(name) || allowed.has(name)) continue;
    failures.push(
      `sweep: CLI command "${name}" is documented but not registered (${files.join(', ')})`,
    );
  }
  for (const name of [...allowed.keys()].sort()) {
    if (registered(name)) {
      failures.push(`sweep: allow-list entry "${name}" is stale: the command is registered`);
    } else if (!documentedIn.has(name)) {
      failures.push(`sweep: allow-list entry "${name}" is stale: the command is not documented`);
    }
  }
}

export function checkSymbolSweep({
  root = process.cwd(),
  engineRoot = path.resolve(root, '..', 'libsonare'),
  registryPath = path.join(engineRoot, NATIVE_REGISTRY_RELATIVE_PATH),
  pythonCliDir = path.join(engineRoot, PYTHON_CLI_RELATIVE_PATH),
  allowPath = path.join(root, 'scripts/symbol-sweep-allow.json'),
  warn = () => {},
} = {}) {
  const failures = [];
  const docsDir = path.join(root, 'src/docs');
  const docs = listMarkdown(docsDir).map((rel) => ({
    rel: path.join('src/docs', rel),
    text: fs.readFileSync(path.join(docsDir, rel), 'utf8'),
  }));

  checkHardRequired({ failures, corpus: docs.map((d) => d.text).join('\n') });
  checkCliParity({ failures, registryPath, pythonCliDir, allowPath, docs, warn });

  return failures;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const failures = checkSymbolSweep({ warn: (message) => console.warn(message) });
  if (failures.length > 0) {
    console.error('symbol sweep failed:');
    for (const f of failures) console.error(`- ${f}`);
    process.exit(1);
  }
  console.log('symbol sweep passed');
}
