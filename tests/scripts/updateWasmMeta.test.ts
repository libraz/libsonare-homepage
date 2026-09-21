import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const scriptPath = path.resolve('scripts/update-wasm-meta.sh');

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

/** Write the realtime/worklet companion assets the script requires alongside the core trio. */
function writeCompanionAssets(root: string) {
  writeFileSync(path.join(root, 'src/wasm/worklet.js'), Buffer.from('fake worklet entry'));
  writeFileSync(path.join(root, 'src/wasm/sonare-rt.wasm'), Buffer.from('fake rt wasm'));
  writeFileSync(path.join(root, 'src/wasm/sonare-rt.js'), Buffer.from('fake rt glue'));
  writeFileSync(
    path.join(root, 'src/wasm/sonare-rt-module.js'),
    Buffer.from('fake rt module glue'),
  );
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
    writeCompanionAssets(root);
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
    for (const name of ['worklet.js', 'sonare-rt.wasm', 'sonare-rt.js', 'sonare-rt-module.js']) {
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

  it('derives the sources digest from the manifest source hashes', () => {
    const wasmBytes = Buffer.from('fake wasm artifact for metadata');

    const digestFor = (sources: Record<string, string>) => {
      const { root, libsonare } = createWorkspace();
      writeFileSync(path.join(root, 'src/wasm/sonare.wasm'), wasmBytes);
      writeFileSync(path.join(root, 'src/wasm/sonare.js'), 'js');
      writeFileSync(path.join(root, 'src/wasm/index.js'), 'index');
      writeCompanionAssets(root);
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
    writeCompanionAssets(root);
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
    writeCompanionAssets(root);
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
    writeCompanionAssets(root);

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
    writeCompanionAssets(root);
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
