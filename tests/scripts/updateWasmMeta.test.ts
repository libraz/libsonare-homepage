import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const scriptPath = path.resolve('scripts/update-wasm-meta.sh');
const copyScriptPath = path.resolve('scripts/copy-wasm.sh');

let workspaces: string[] = [];

function createWorkspace() {
  const base = mkdtempSync(path.join(tmpdir(), 'update-wasm-meta-'));
  const root = path.join(base, 'homepage');
  const libsonare = path.join(base, 'libsonare');
  mkdirSync(path.join(root, 'src/wasm'), { recursive: true });
  mkdirSync(path.join(libsonare, 'bindings/wasm/dist'), { recursive: true });
  workspaces.push(base);
  return { base, root, libsonare };
}

function runScript(root: string) {
  return spawnSync('bash', [scriptPath], {
    cwd: root,
    encoding: 'utf8',
  });
}

function createCopyWorkspace() {
  const base = mkdtempSync(path.join(tmpdir(), 'copy-wasm-'));
  const root = path.join(base, 'homepage');
  const libsonare = path.join(base, 'libsonare');
  mkdirSync(path.join(root, 'scripts'), { recursive: true });
  mkdirSync(path.join(root, 'src/wasm'), { recursive: true });
  mkdirSync(path.join(root, 'src/public'), { recursive: true });
  mkdirSync(path.join(libsonare, 'bindings/wasm/dist'), { recursive: true });
  copyFileSync(copyScriptPath, path.join(root, 'scripts/copy-wasm.sh'));
  copyFileSync(scriptPath, path.join(root, 'scripts/update-wasm-meta.sh'));
  chmodSync(path.join(root, 'scripts/update-wasm-meta.sh'), 0o755);
  workspaces.push(base);
  return { root, libsonare };
}

function runCopyScript(root: string) {
  return spawnSync('bash', [path.join(root, 'scripts/copy-wasm.sh')], {
    cwd: root,
    encoding: 'utf8',
  });
}

function writeCopyInputs(libsonare: string, wasmBytes: Buffer, indexSource: string) {
  const sourceFiles: Record<string, string | Buffer> = {
    'sonare.wasm': wasmBytes,
    'sonare.js': 'fake emscripten glue',
    'index.js': indexSource,
    'index.d.ts': 'export type Index = string;\n//# sourceMappingURL=index.d.ts.map\n',
    'worklet.js': 'registerProcessor();\n//# sourceMappingURL=worklet.js.map\n',
    'worklet.d.ts': 'export type Worklet = string;\n//# sourceMappingURL=worklet.d.ts.map\n',
    'worker.js': 'self.onmessage = () => {};\n//# sourceMappingURL=worker.js.map\n',
    'worker.d.ts': 'export type Worker = string;\n//# sourceMappingURL=worker.d.ts.map\n',
  };
  const dist = path.join(libsonare, 'bindings/wasm/dist');
  for (const [name, contents] of Object.entries(sourceFiles)) {
    writeFileSync(path.join(dist, name), contents);
  }
  writeFileSync(
    path.join(libsonare, 'bindings/wasm/package.json'),
    JSON.stringify({ name: '@libraz/libsonare', version: '1.2.3-test' }),
  );
  writeSizeBaseline(libsonare);
  writeSourcesManifest(libsonare, wasmBytes);
}

/**
 * Write the upstream size gate the script reads the published entry sizes from.
 * Raw/gzip are chosen so each rounds to a distinct KB figure.
 */
function writeSizeBaseline(libsonare: string) {
  writeFileSync(
    path.join(libsonare, 'bindings/wasm/wasm-size-baseline.json'),
    JSON.stringify({
      artifacts: {
        'sonare.wasm': { raw: 5_203_886, gzip: 1_729_949 },
        'sonare-analysis.wasm': { raw: 1_004_364, gzip: 373_840 },
      },
      format: 1,
      toolchain: { emsdk: '5.0.2' },
    }),
  );
}

const BUILT_AT = '2026-09-21T18:47:44.119Z';

/**
 * Write the manifest the emscripten build leaves beside its artifacts. The
 * script takes the build date and the source digest from here, and refuses to
 * record provenance for a binary the manifest does not describe.
 */
function writeSourcesManifest(
  libsonare: string,
  wasmBytes: Buffer,
  overrides: { sha256?: string; builtAt?: string; sources?: Record<string, string> } = {},
) {
  writeFileSync(
    path.join(libsonare, 'bindings/wasm/dist/sonare.sources.json'),
    JSON.stringify({
      module: 'sonare',
      builtAt: overrides.builtAt ?? BUILT_AT,
      artifacts: {
        'sonare.wasm': {
          sha256: overrides.sha256 ?? createHash('sha256').update(wasmBytes).digest('hex'),
          bytes: wasmBytes.length,
        },
      },
      sources: overrides.sources ?? {
        'CMakeLists.txt': 'a'.repeat(64),
        'include/sonare/sonare_c.h': 'b'.repeat(64),
      },
    }),
  );
}

/** Write the worklet asset the script requires alongside the core trio. */
function writeWorkletAsset(root: string) {
  writeFileSync(path.join(root, 'src/wasm/worklet.js'), Buffer.from('fake worklet entry'));
}

describe('update-wasm-meta shell script', () => {
  afterEach(() => {
    for (const workspace of workspaces) {
      rmSync(workspace, { recursive: true, force: true });
    }
    workspaces = [];
  });

  it('writes version, size, gzip size, md5 and build provenance for the local wasm artifact', () => {
    const { root, libsonare } = createWorkspace();
    const wasmBytes = Buffer.from('fake wasm artifact for metadata');
    const sonareJsBytes = Buffer.from('fake emscripten glue');
    const indexJsBytes = Buffer.from('fake public api wrapper');
    writeFileSync(path.join(root, 'src/wasm/sonare.wasm'), wasmBytes);
    writeFileSync(path.join(root, 'src/wasm/sonare.js'), sonareJsBytes);
    writeFileSync(path.join(root, 'src/wasm/index.js'), indexJsBytes);
    writeWorkletAsset(root);
    writeFileSync(
      path.join(libsonare, 'bindings/wasm/package.json'),
      JSON.stringify({
        name: '@libraz/libsonare',
        version: '9.8.7-test',
      }),
    );
    writeSizeBaseline(libsonare);
    writeSourcesManifest(libsonare, wasmBytes);

    const result = runScript(root);
    const meta = JSON.parse(readFileSync(path.join(root, 'src/wasm/meta.json'), 'utf8'));

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Updated src/wasm/meta.json');
    expect(result.stdout).toContain('Version: 9.8.7-test');
    expect(result.stderr).toBe('');
    expect(meta).toMatchObject({
      version: '9.8.7-test',
      size: wasmBytes.length,
      sizeKB: Math.floor(wasmBytes.length / 1024),
      md5: createHash('md5').update(wasmBytes).digest('hex'),
    });
    expect(meta.gzipSize).toBeGreaterThan(0);
    expect(meta.gzipKB).toBe(Math.floor(meta.gzipSize / 1024));
    expect(meta.assets['sonare.js']).toMatchObject({
      size: sonareJsBytes.length,
      sizeKB: Math.floor(sonareJsBytes.length / 1024),
    });
    expect(meta.assets['index.js']).toMatchObject({
      size: indexJsBytes.length,
      sizeKB: Math.floor(indexJsBytes.length / 1024),
    });
    expect(meta.assets['sonare.wasm']).toMatchObject({
      size: wasmBytes.length,
      sizeKB: Math.floor(wasmBytes.length / 1024),
      gzipSize: meta.gzipSize,
      gzipKB: meta.gzipKB,
    });
    expect(meta.assets['worklet.js'].size).toBeGreaterThan(0);
    expect(meta.assets['worklet.js'].gzipSize).toBeGreaterThan(0);
    expect(Object.keys(meta.assets)).toEqual([
      'sonare.js',
      'index.js',
      'sonare.wasm',
      'worklet.js',
    ]);
    for (const name of ['sonare.js', 'index.js', 'sonare.wasm', 'worklet.js']) {
      expect(meta.assets[name].size).toBeGreaterThan(0);
      expect(meta.assets[name].gzipSize).toBeGreaterThan(0);
    }
    expect(meta.total).toMatchObject({
      size: sonareJsBytes.length + indexJsBytes.length + wasmBytes.length,
      sizeKB: Math.floor((sonareJsBytes.length + indexJsBytes.length + wasmBytes.length) / 1024),
      gzipSize:
        meta.assets['sonare.js'].gzipSize + meta.assets['index.js'].gzipSize + meta.gzipSize,
    });
    expect(meta.total.gzipKB).toBe(Math.floor(meta.total.gzipSize / 1024));
    // Package entries come from the upstream gate, not from the copied artifact,
    // so they are unrelated to the fake wasm bytes written above.
    expect(meta.entries).toEqual({
      full: { sizeKB: 5082, gzipKB: 1689 },
      analysis: { sizeKB: 981, gzipKB: 365 },
    });
    // Provenance is the build's own, not this machine's: the date is the
    // manifest's `builtAt` rather than the copied file's mtime, and the sibling
    // checkout's HEAD is not recorded at all because it moves after a build.
    expect(meta.buildDate).toBe(BUILT_AT);
    expect(meta.sourcesDigest).toMatch(/^[0-9a-f]{12}$/);
    expect(meta).not.toHaveProperty('commitHash');
  });

  it('does not recopy source-mapped JS and declarations on a second copy', () => {
    const { root, libsonare } = createCopyWorkspace();
    const wasmBytes = Buffer.from('fake wasm artifact for copy idempotence');
    const indexSource = 'export const version = 1;\n//# sourceMappingURL=index.js.map\n';
    writeCopyInputs(libsonare, wasmBytes, indexSource);

    const first = runCopyScript(root);
    const second = runCopyScript(root);

    expect(first.status).toBe(0);
    expect(second.status).toBe(0);
    expect(second.stdout).toContain('No changes detected');
    expect(second.stdout).not.toContain('Copying JS API files');
    expect(second.stdout).not.toContain('Updated src/wasm/meta.json');
  });

  it('updates metadata and preserves provenance for a JS-only copy', () => {
    const { root, libsonare } = createCopyWorkspace();
    const wasmBytes = Buffer.from('fake wasm artifact for js-only update');
    const initialIndex = 'export const version = 1;\n//# sourceMappingURL=index.js.map\n';
    writeCopyInputs(libsonare, wasmBytes, initialIndex);

    expect(runCopyScript(root).status).toBe(0);
    const before = JSON.parse(readFileSync(path.join(root, 'src/wasm/meta.json'), 'utf8'));
    const updatedIndex = `export const version = 2;\nexport const payload = '${'x'.repeat(32)}';\n//# sourceMappingURL=index.js.map\n`;
    writeFileSync(path.join(libsonare, 'bindings/wasm/dist/index.js'), updatedIndex);

    const result = runCopyScript(root);
    const after = JSON.parse(readFileSync(path.join(root, 'src/wasm/meta.json'), 'utf8'));
    const normalizedIndex = updatedIndex.replace(/^\/\/# sourceMappingURL=.*\n?/gm, '');

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Updated src/wasm/meta.json');
    expect(after.assets['index.js'].size).toBe(Buffer.byteLength(normalizedIndex));
    expect(after.assets['index.js'].size).not.toBe(before.assets['index.js'].size);
    expect(readFileSync(path.join(root, 'src/wasm/index.js'), 'utf8')).toBe(normalizedIndex);
    expect(after.md5).toBe(before.md5);
    expect(after.buildDate).toBe(before.buildDate);
    expect(after.sourcesDigest).toBe(before.sourcesDigest);
  });

  it('derives the sources digest from the manifest source hashes', () => {
    const wasmBytes = Buffer.from('fake wasm artifact for metadata');

    const digestFor = (sources: Record<string, string>) => {
      const { root, libsonare } = createWorkspace();
      writeFileSync(path.join(root, 'src/wasm/sonare.wasm'), wasmBytes);
      writeFileSync(path.join(root, 'src/wasm/sonare.js'), 'js');
      writeFileSync(path.join(root, 'src/wasm/index.js'), 'index');
      writeWorkletAsset(root);
      writeFileSync(
        path.join(libsonare, 'bindings/wasm/package.json'),
        JSON.stringify({ version: '1.0.0' }),
      );
      writeSizeBaseline(libsonare);
      writeSourcesManifest(libsonare, wasmBytes, { sources });

      expect(runScript(root).status).toBe(0);
      return JSON.parse(readFileSync(path.join(root, 'src/wasm/meta.json'), 'utf8')).sourcesDigest;
    };

    const base = digestFor({ 'src/a.cpp': 'a'.repeat(64) });

    expect(digestFor({ 'src/a.cpp': 'a'.repeat(64) })).toBe(base);
    expect(digestFor({ 'src/a.cpp': 'c'.repeat(64) })).not.toBe(base);
    expect(digestFor({ 'src/b.cpp': 'a'.repeat(64) })).not.toBe(base);
  });

  it('refuses to record provenance for a wasm the build manifest does not describe', () => {
    const { root, libsonare } = createWorkspace();
    const wasmBytes = Buffer.from('fake wasm artifact for metadata');
    writeFileSync(path.join(root, 'src/wasm/sonare.wasm'), wasmBytes);
    writeFileSync(path.join(root, 'src/wasm/sonare.js'), 'js');
    writeFileSync(path.join(root, 'src/wasm/index.js'), 'index');
    writeWorkletAsset(root);
    writeFileSync(
      path.join(libsonare, 'bindings/wasm/package.json'),
      JSON.stringify({ version: '1.0.0' }),
    );
    writeSizeBaseline(libsonare);
    writeSourcesManifest(libsonare, Buffer.from('a different build'));

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('not the artifact the build manifest describes');
  });

  it('fails when the build manifest is missing', () => {
    const { root, libsonare } = createWorkspace();
    writeFileSync(path.join(root, 'src/wasm/sonare.wasm'), 'wasm');
    writeFileSync(path.join(root, 'src/wasm/sonare.js'), 'js');
    writeFileSync(path.join(root, 'src/wasm/index.js'), 'index');
    writeWorkletAsset(root);
    writeFileSync(
      path.join(libsonare, 'bindings/wasm/package.json'),
      JSON.stringify({ version: '1.0.0' }),
    );
    writeSizeBaseline(libsonare);

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      'Build manifest not found: ../libsonare/bindings/wasm/dist/sonare.sources.json',
    );
  });

  it('fails when the wasm artifact is missing', () => {
    const { root, libsonare } = createWorkspace();
    writeFileSync(
      path.join(libsonare, 'bindings/wasm/package.json'),
      JSON.stringify({
        version: '1.0.0',
      }),
    );

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('WASM file not found: src/wasm/sonare.wasm');
  });

  it('fails when the libsonare wasm package version cannot be read', () => {
    const { root } = createWorkspace();
    writeFileSync(path.join(root, 'src/wasm/sonare.wasm'), 'wasm');
    writeFileSync(path.join(root, 'src/wasm/sonare.js'), 'js');
    writeFileSync(path.join(root, 'src/wasm/index.js'), 'index');
    writeWorkletAsset(root);

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      'Could not read version from ../libsonare/bindings/wasm/package.json',
    );
  });

  it('fails when the upstream size baseline is missing', () => {
    const { root, libsonare } = createWorkspace();
    writeFileSync(path.join(root, 'src/wasm/sonare.wasm'), 'wasm');
    writeFileSync(path.join(root, 'src/wasm/sonare.js'), 'js');
    writeFileSync(path.join(root, 'src/wasm/index.js'), 'index');
    writeWorkletAsset(root);
    writeFileSync(
      path.join(libsonare, 'bindings/wasm/package.json'),
      JSON.stringify({ version: '1.0.0' }),
    );

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      'Size baseline not found: ../libsonare/bindings/wasm/wasm-size-baseline.json',
    );
  });
});
