import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  checkSymbolSweep,
  documentedCommands,
  HARD_REQUIRED_IDENTIFIERS,
  nativeCliCommands,
  pythonCliCommands,
} from '../../scripts/check-symbol-sweep.mjs';

let workspaces: string[] = [];

function createWorkspace() {
  const root = mkdtempSync(path.join(tmpdir(), 'check-symbol-sweep-'));
  workspaces.push(root);
  return root;
}

function write(root: string, rel: string, content: string) {
  const full = path.join(root, rel);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, content);
}

/** One line per hard-required identifier, in the form the gate accepts. */
function allHardRequired(except: string[] = []) {
  return HARD_REQUIRED_IDENTIFIERS.filter((entry) => {
    const name = typeof entry === 'string' ? entry : entry.name;
    return !except.includes(name);
  })
    .map((entry) => (typeof entry === 'string' ? entry : `'${entry.name}'`))
    .join('\n');
}

function nativeSource(commands: string[], projectCommands: string[] = []) {
  return [
    ...commands.map((name) => `    add_command(commands, "${name}", true, {});`),
    ...projectCommands.map((name) => `    add_project_command("project.${name}", {});`),
  ].join('\n');
}

function pythonSource(commands: string[]) {
  return commands.map((name) => `    sub.add_parser("${name}", parents=[common])`).join('\n');
}

interface EngineFixture {
  native?: string[];
  project?: string[];
  python?: string[];
}

/** Seeds an engine checkout; a registry left undefined is not written at all. */
function seedEngine(root: string, { native, project, python }: EngineFixture) {
  const engineRoot = path.join(root, 'engine');
  if (native || project) {
    write(engineRoot, 'tools/cli/sonare_cli_registry.cpp', nativeSource(native ?? [], project));
  }
  if (python) {
    write(engineRoot, 'bindings/python/src/libsonare/cli.py', pythonSource(python));
  }
  return engineRoot;
}

function seedAllow(root: string, entries: unknown[]) {
  write(root, 'scripts/symbol-sweep-allow.json', JSON.stringify(entries));
}

afterEach(() => {
  for (const root of workspaces) rmSync(root, { recursive: true, force: true });
  workspaces = [];
});

describe('nativeCliCommands', () => {
  it('collects single-line, wrapped, looped and project registrations', () => {
    const source = [
      'add_command(commands, "analyze", true, {});',
      'for (const char* path : {"bpm", "beats"})',
      '  add_command(commands, path, true, {});',
      'add_command(',
      '    commands, "time-stretch", true, {});',
      'add_project_command("project.abi", {});',
      'add_project_command(',
      '    "project.bounce",',
      '    {});',
    ].join('\n');
    expect([...nativeCliCommands(source)].sort()).toEqual([
      'analyze',
      'beats',
      'bpm',
      'project.abi',
      'project.bounce',
      'time-stretch',
    ]);
  });
});

describe('pythonCliCommands', () => {
  it('collects wrapped add_parser calls, project leaves, loop names and dispatch keys', () => {
    const parsers = [
      'sub.add_parser("analyze", parents=[common])',
      'chain_p = sub.add_parser(',
      '    "mastering-chain", parents=[common], help="Run a chain"',
      ')',
      'project_sub.add_parser("abi", parents=[stdout_common])',
      'for pname in ("validate", "compile"):',
      '    pp = project_sub.add_parser(pname, help="Project")',
    ].join('\n');
    const dispatch = [
      'def main():',
      '    commands = {',
      '        "analyze": cmd_analyze,',
      '        "declip": cmd_declip,',
      '    }',
      '    handler = commands.get(args.command)',
    ].join('\n');
    expect([...pythonCliCommands([parsers, dispatch])].sort()).toEqual([
      'analyze',
      'declip',
      'mastering-chain',
      'project.abi',
      'project.compile',
      'project.validate',
    ]);
  });
});

describe('documentedCommands', () => {
  it('reads inline code, fence lines, the native CLI name and project subcommands', () => {
    const markdown = [
      'Run `sonare analyze music.mp3` first.',
      '```bash',
      '$ sonare-cli mix-strip in.wav -o out.wav',
      'sonare project bounce song.json -o out.wav',
      '```',
      'The `sonare project` group holds the project commands.',
      'libsonare exposes sonare.analyze() in Python.',
    ].join('\n');
    expect([...documentedCommands(markdown)].sort()).toEqual([
      'analyze',
      'mix-strip',
      'project.bounce',
    ]);
  });
});

describe('checkSymbolSweep', () => {
  it('passes when every identifier is documented and the CLI registries match the docs', () => {
    const root = createWorkspace();
    const engineRoot = seedEngine(root, {
      native: ['analyze', 'tune-to-midi'],
      project: ['align-takes'],
      python: ['analyze', 'mix'],
    });
    seedAllow(root, []);
    write(
      root,
      'src/docs/cli.md',
      `${allHardRequired()}\n\`sonare analyze a.wav\`\n\`sonare tune-to-midi a.wav\`\n\`sonare project align-takes p.json\`\n\`sonare mix a.wav b.wav\`\n`,
    );
    expect(checkSymbolSweep({ root, engineRoot })).toEqual([]);
  });

  it('fails when a hard-required identifier is missing from the whole corpus', () => {
    const root = createWorkspace();
    const engineRoot = seedEngine(root, { native: [], python: [] });
    write(root, 'src/docs/a.md', allHardRequired(['addStrip']));
    write(root, 'src/docs/nested/b.md', '# nothing here\n');
    expect(checkSymbolSweep({ root, engineRoot })).toEqual([
      expect.stringContaining('identifier "addStrip" is not documented'),
    ]);
  });

  it('accepts a hard-required identifier from any page, including a code fence', () => {
    const root = createWorkspace();
    const engineRoot = seedEngine(root, { native: [], python: [] });
    write(root, 'src/docs/a.md', allHardRequired(['addStrip']));
    write(root, 'src/docs/nested/b.md', '```ts\nmixer.addStrip({ id: "vox" });\n```\n');
    expect(checkSymbolSweep({ root, engineRoot })).toEqual([]);
  });

  it('requires quoted identifiers to appear as tokens, not bare words', () => {
    const root = createWorkspace();
    const engineRoot = seedEngine(root, { native: [], python: [] });
    write(root, 'src/docs/a.md', `${allHardRequired(['mM7'])}\nThe mM7 quality is new.\n`);
    expect(checkSymbolSweep({ root, engineRoot })).toEqual([
      expect.stringContaining('identifier "mM7 (quoted)" is not documented'),
    ]);
  });

  it('does not let the allow-list silence a hard-required identifier', () => {
    const root = createWorkspace();
    const engineRoot = seedEngine(root, { native: [], python: [] });
    seedAllow(root, [{ command: 'addStrip', reason: 'trying to hide a missing identifier' }]);
    write(root, 'src/docs/a.md', allHardRequired(['addStrip']));
    const failures = checkSymbolSweep({ root, engineRoot });
    expect(failures).toContainEqual(
      expect.stringContaining('identifier "addStrip" is not documented'),
    );
    expect(failures).toContainEqual(
      expect.stringContaining('allow-list entry "addStrip" is stale'),
    );
  });

  it('fails a reasonless allow-list entry', () => {
    const root = createWorkspace();
    const engineRoot = seedEngine(root, { native: [], python: [] });
    seedAllow(root, [{ command: 'ghost', reason: '  ' }, { command: 'wraith' }]);
    write(root, 'src/docs/a.md', `${allHardRequired()}\n\`sonare ghost\`\n\`sonare wraith\`\n`);
    const failures = checkSymbolSweep({ root, engineRoot });
    expect(failures).toContainEqual(
      expect.stringContaining('allow-list entry "ghost" has no reason'),
    );
    expect(failures).toContainEqual(
      expect.stringContaining('allow-list entry "wraith" has no reason'),
    );
    expect(failures).toContainEqual(
      expect.stringContaining('CLI command "ghost" is documented but not registered'),
    );
  });

  it('fails a stale allow-list entry', () => {
    const root = createWorkspace();
    const engineRoot = seedEngine(root, { native: ['analyze'], python: ['mix'] });
    seedAllow(root, [
      { command: 'analyze', reason: 'native command listed by mistake' },
      { command: 'mix', reason: 'was Python-only once' },
      { command: 'ghost', reason: 'nobody documents this any more' },
    ]);
    write(root, 'src/docs/a.md', `${allHardRequired()}\n\`sonare analyze\`\n\`sonare mix\`\n`);
    const failures = checkSymbolSweep({ root, engineRoot });
    expect(failures).toContainEqual(
      expect.stringContaining('allow-list entry "analyze" is stale: the command is registered'),
    );
    expect(failures).toContainEqual(
      expect.stringContaining('allow-list entry "mix" is stale: the command is registered'),
    );
    expect(failures).toContainEqual(
      expect.stringContaining('allow-list entry "ghost" is stale: the command is not documented'),
    );
  });

  it('fails a native command that the docs never invoke', () => {
    const root = createWorkspace();
    const engineRoot = seedEngine(root, {
      native: ['analyze', 'pcen'],
      project: ['bounce'],
      python: ['analyze'],
    });
    write(root, 'src/docs/a.md', `${allHardRequired()}\n\`sonare analyze\`\n`);
    const failures = checkSymbolSweep({ root, engineRoot });
    expect(failures).toContainEqual(
      expect.stringContaining('CLI command "pcen" is registered but not documented'),
    );
    expect(failures).toContainEqual(
      expect.stringContaining('CLI command "project.bounce" is registered but not documented'),
    );
  });

  it('fails a documented command that neither registry knows, naming the pages', () => {
    const root = createWorkspace();
    const engineRoot = seedEngine(root, { native: ['analyze'], python: ['analyze'] });
    write(
      root,
      'src/docs/a.md',
      `${allHardRequired()}\n\`sonare analyze\`\n\`sonare ghost x.wav\`\n`,
    );
    write(root, 'src/docs/b.md', 'sonare ghost y.wav\n');
    expect(checkSymbolSweep({ root, engineRoot })).toEqual([
      'sweep: CLI command "ghost" is documented but not registered (src/docs/a.md, src/docs/b.md)',
    ]);
  });

  it('treats a Python-only command as registered', () => {
    const root = createWorkspace();
    const engineRoot = seedEngine(root, { native: ['analyze'], python: ['analyze', 'declip'] });
    write(root, 'src/docs/a.md', `${allHardRequired()}\n\`sonare analyze\`\n\`sonare declip\`\n`);
    expect(checkSymbolSweep({ root, engineRoot })).toEqual([]);
  });

  it('skips the native parity section with a notice when the native registry is absent', () => {
    const root = createWorkspace();
    const warn = vi.fn();
    const engineRoot = seedEngine(root, { python: ['analyze'] });
    write(root, 'src/docs/a.md', `${allHardRequired(['settle'])}\n\`sonare phantom\`\n`);
    const failures = checkSymbolSweep({ root, engineRoot, warn });
    expect(failures).toEqual([expect.stringContaining('identifier "settle" is not documented')]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('native parity check skipped'));
  });

  it('skips the phantom check with a notice when the Python package is absent', () => {
    const root = createWorkspace();
    const warn = vi.fn();
    const engineRoot = seedEngine(root, { native: ['analyze', 'pcen'] });
    write(root, 'src/docs/a.md', `${allHardRequired()}\n\`sonare analyze\`\n\`sonare phantom\`\n`);
    const failures = checkSymbolSweep({ root, engineRoot, warn });
    expect(failures).toEqual([
      expect.stringContaining('CLI command "pcen" is registered but not documented'),
    ]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Python parity check skipped'));
  });

  it('skips both halves without failing when the engine checkout is absent', () => {
    const root = createWorkspace();
    const warn = vi.fn();
    write(root, 'src/docs/a.md', `${allHardRequired()}\n\`sonare phantom\`\n`);
    const failures = checkSymbolSweep({
      root,
      engineRoot: path.join(root, 'no-such-engine'),
      warn,
    });
    expect(failures).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(2);
  });
});
