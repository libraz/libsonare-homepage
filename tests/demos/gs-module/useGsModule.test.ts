// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';

const { bootWasm } = vi.hoisted(() => ({ bootWasm: vi.fn() }));
vi.mock('@/composables/useWasmBoot', () => ({ bootWasm }));

import { peakAround, useGsModule } from '@/demos/gs-module/useGsModule';

interface BounceRecord {
  file: Uint8Array;
  realization: string;
}

const bounces: BounceRecord[] = [];
const sources: FakeBufferSource[] = [];
const audioBuffers: FakeAudioBuffer[] = [];

interface FakeAudioBuffer {
  channels: Float32Array[];
  getChannelData(channel: number): Float32Array;
}

class FakeBufferSource {
  buffer: unknown = null;
  onended: (() => void) | null = null;
  readonly connect = vi.fn();
  readonly start = vi.fn();
  readonly stop = vi.fn();
}

class FakeAudioContext {
  readonly state = 'running';
  readonly currentTime = 0;
  readonly destination = {};
  readonly close = vi.fn(async () => {});
  readonly resume = vi.fn(async () => {});

  createBuffer(channels: number, length: number, _sampleRate: number): FakeAudioBuffer {
    const buffer: FakeAudioBuffer = {
      channels: Array.from({ length: channels }, () => new Float32Array(length)),
      getChannelData(channel) {
        return this.channels[channel];
      },
    };
    audioBuffers.push(buffer);
    return buffer;
  }

  createBufferSource() {
    const source = new FakeBufferSource();
    sources.push(source);
    return source;
  }
}

class FakeProject {
  private readonly files: Uint8Array[] = [];

  setSampleRate() {}

  importSmf(file: Uint8Array) {
    this.files.push(file);
    return 0;
  }

  bounceWithSf2Instrument(instrument: { gsEfxRealization: string }) {
    bounces.push({ file: this.files[0], realization: instrument.gsEfxRealization });
    return new Float32Array([0.1, -0.2, 0.3, -0.4]);
  }

  delete() {}
}

const fakeWasm = {
  Project: FakeProject,
  synthGsVariationIsVoicedApart: () => false,
} as never;

function hasNoteOn(file: Uint8Array, channel: number): boolean {
  return file.some((byte) => byte === (0x90 | channel));
}

beforeEach(() => {
  bounces.length = 0;
  sources.length = 0;
  audioBuffers.length = 0;
  bootWasm.mockReset().mockResolvedValue(fakeWasm);
  vi.stubGlobal('AudioContext', FakeAudioContext);
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn(() => 1),
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

describe('useGsModule render invalidation', () => {
  it('measures the louder side of a stereo render', () => {
    expect(
      peakAround(
        {
          left: new Float32Array([0.1, 0]),
          right: new Float32Array([0.8, 0]),
          frames: 2,
        },
        0,
      ),
    ).toBeCloseTo(0.8);
  });

  it('clears the cached render and stops playback when the selected channel changes', async () => {
    const module = useGsModule();
    await module.render();
    await module.play();
    expect(module.status.value).toBe('ready');
    expect(module.isPlaying.value).toBe(true);
    expect(audioBuffers[0].channels).toEqual([
      new Float32Array([0.1, 0.3]),
      new Float32Array([-0.2, -0.4]),
    ]);

    module.selectedChannel.value = 1;
    await nextTick();

    expect(module.rendered.value).toBeNull();
    expect(module.status.value).toBe('idle');
    expect(module.isPlaying.value).toBe(false);
    expect(sources[0].stop).toHaveBeenCalledOnce();
  });

  it('rerenders the selected channel on the next play', async () => {
    const module = useGsModule();
    await module.render();
    expect(hasNoteOn(bounces[0].file, 0)).toBe(true);
    expect(hasNoteOn(bounces[0].file, 1)).toBe(false);

    module.selectedChannel.value = 1;
    await nextTick();
    await module.play();

    expect(bounces).toHaveLength(2);
    expect(hasNoteOn(bounces[1].file, 0)).toBe(false);
    expect(hasNoteOn(bounces[1].file, 1)).toBe(true);
  });

  it('invalidates a render that is waiting for WASM', async () => {
    let resolveBoot!: (value: typeof fakeWasm) => void;
    bootWasm.mockReturnValueOnce(
      new Promise<typeof fakeWasm>((resolve) => {
        resolveBoot = resolve;
      }),
    );
    const module = useGsModule();
    const pending = module.render();
    expect(module.status.value).toBe('rendering');

    module.selectedChannel.value = 1;
    await nextTick();
    expect(module.rendered.value).toBeNull();
    expect(module.status.value).toBe('idle');

    resolveBoot(fakeWasm);
    await expect(pending).resolves.toBeNull();
    expect(bounces).toHaveLength(0);
    expect(module.status.value).toBe('idle');
  });

  it('invalidates the cached render when the realization mode changes', async () => {
    const module = useGsModule();
    await module.render();

    module.efxRealization.value = 'classic';
    await nextTick();
    expect(module.rendered.value).toBeNull();
    expect(module.status.value).toBe('idle');

    await module.play();
    expect(bounces.at(-1)?.realization).toBe('classic');
  });
});
