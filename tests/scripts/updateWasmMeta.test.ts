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
  mkdirSync(path.join(libsonare, 'bindings/wasm'), { recursive: true });
  workspaces.push(base);
  return { base, root, libsonare };
}

function runScript(root: string) {
  return spawnSync('bash', [scriptPath], {
    cwd: root,
    encoding: 'utf8',
  });
}

describe('update-wasm-meta shell script', () => {
  afterEach(() => {
    for (const workspace of workspaces) {
      rmSync(workspace, { recursive: true, force: true });
    }
    workspaces = [];
  });

  it('writes version, size, gzip size, md5 and build date from the local wasm artifact', () => {
    const { root, libsonare } = createWorkspace();
    const wasmBytes = Buffer.from('fake wasm artifact for metadata');
    const sonareJsBytes = Buffer.from('fake emscripten glue');
    const indexJsBytes = Buffer.from('fake public api wrapper');
    writeFileSync(path.join(root, 'src/wasm/sonare.wasm'), wasmBytes);
    writeFileSync(path.join(root, 'src/wasm/sonare.js'), sonareJsBytes);
    writeFileSync(path.join(root, 'src/wasm/index.js'), indexJsBytes);
    writeFileSync(
      path.join(libsonare, 'bindings/wasm/package.json'),
      JSON.stringify({
        name: '@libraz/libsonare',
        version: '9.8.7-test',
      }),
    );

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
      commitHash: '',
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
    expect(meta.total).toMatchObject({
      size: sonareJsBytes.length + indexJsBytes.length + wasmBytes.length,
      sizeKB: Math.floor(
        (sonareJsBytes.length + indexJsBytes.length + wasmBytes.length) / 1024,
      ),
      gzipSize:
        meta.assets['sonare.js'].gzipSize + meta.assets['index.js'].gzipSize + meta.gzipSize,
    });
    expect(meta.total.gzipKB).toBe(Math.floor(meta.total.gzipSize / 1024));
    expect(Date.parse(meta.buildDate)).not.toBeNaN();
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

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      'Could not read version from ../libsonare/bindings/wasm/package.json',
    );
  });
});
