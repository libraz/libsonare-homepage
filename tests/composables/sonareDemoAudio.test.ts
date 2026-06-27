import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function audioBuffer(channels: Float32Array[], sampleRate = 48_000): AudioBuffer {
  return {
    length: channels[0]?.length ?? 0,
    duration: (channels[0]?.length ?? 0) / sampleRate,
    sampleRate,
    numberOfChannels: channels.length,
    getChannelData: (channel: number) => channels[channel],
  } as AudioBuffer;
}

function response(ok: boolean, type: string, body = new ArrayBuffer(4)): Response {
  return {
    ok,
    headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? type : null) },
    arrayBuffer: vi.fn(async () => body),
  } as unknown as Response;
}

describe('useSonareDemoAudio', () => {
  let decodeAudioData: ReturnType<typeof vi.fn>;
  let createdSources: Array<{
    buffer: AudioBuffer | null;
    connect: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    onended: (() => void) | null;
  }>;

  beforeEach(() => {
    vi.resetModules();
    createdSources = [];
    decodeAudioData = vi.fn(async () =>
      audioBuffer([new Float32Array([1, 0.5]), new Float32Array([-0.5, 0.25])]),
    );

    class AudioContextMock {
      state = 'running';
      currentTime = 0;
      destination = {};
      decodeAudioData = decodeAudioData;
      createBuffer = vi.fn((channels: number, length: number, sampleRate: number) => {
        const data = Array.from({ length: channels }, () => new Float32Array(length));
        return {
          length,
          duration: length / sampleRate,
          sampleRate,
          numberOfChannels: channels,
          copyToChannel: vi.fn((samples: Float32Array, channel: number) =>
            data[channel].set(samples),
          ),
          getChannelData: (channel: number) => data[channel],
        } as unknown as AudioBuffer;
      });
      createBufferSource = vi.fn(() => {
        const source = {
          buffer: null as AudioBuffer | null,
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
          onended: null as (() => void) | null,
        };
        createdSources.push(source);
        return source;
      });
      resume = vi.fn();
    }

    vi.stubGlobal('AudioContext', AudioContextMock);
    vi.stubGlobal('webkitAudioContext', undefined);
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 1),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('downmixes loaded clips to mono and caches successful decodes', async () => {
    const fetch = vi.fn(async () => response(true, 'audio/wav'));
    vi.stubGlobal('fetch', fetch);

    const { useSonareDemoAudio } = await import('@/composables/useSonareDemoAudio');
    const audio = useSonareDemoAudio();

    const first = await audio.loadClip('band');
    const second = await audio.loadClip('band');

    expect(first).toBe(second);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(decodeAudioData).toHaveBeenCalledTimes(1);
    expect([...first.samples]).toEqual([0.25, 0.375]);
    expect(first.sampleRate).toBe(48_000);
  });

  it('does not cache failed clip loads, allowing a retry to recover', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response(false, 'text/plain'))
      .mockResolvedValueOnce(response(false, 'text/plain'))
      .mockResolvedValueOnce(response(false, 'text/plain'))
      .mockResolvedValueOnce(response(true, 'audio/wav'));
    vi.stubGlobal('fetch', fetch);

    const { useSonareDemoAudio } = await import('@/composables/useSonareDemoAudio');
    const audio = useSonareDemoAudio();

    await expect(audio.loadClip('band')).rejects.toThrow('demo clip not found: band');
    await expect(audio.loadClip('band')).resolves.toMatchObject({ sampleRate: 48_000 });

    expect(fetch).toHaveBeenCalledTimes(4);
    expect(decodeAudioData).toHaveBeenCalledTimes(1);
  });

  it('tries the next clip encoding when a candidate request fails', async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(response(true, 'audio/ogg'));
    vi.stubGlobal('fetch', fetch);

    const { useSonareDemoAudio } = await import('@/composables/useSonareDemoAudio');
    const audio = useSonareDemoAudio();

    await expect(audio.loadClip('band')).resolves.toMatchObject({ sampleRate: 48_000 });
    expect(fetch).toHaveBeenNthCalledWith(1, '/demo-clips/band.wav');
    expect(fetch).toHaveBeenNthCalledWith(2, '/demo-clips/band.opus');
    expect(decodeAudioData).toHaveBeenCalledTimes(1);
  });

  it('ignores non-audio successful responses when probing clip encodings', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response(true, 'text/plain'))
      .mockResolvedValueOnce(response(true, 'application/octet-stream'));
    vi.stubGlobal('fetch', fetch);

    const { useSonareDemoAudio } = await import('@/composables/useSonareDemoAudio');
    const audio = useSonareDemoAudio();

    await expect(audio.loadClip('band')).resolves.toMatchObject({ sampleRate: 48_000 });
    expect(fetch).toHaveBeenNthCalledWith(1, '/demo-clips/band.wav');
    expect(fetch).toHaveBeenNthCalledWith(2, '/demo-clips/band.opus');
    expect(decodeAudioData).toHaveBeenCalledTimes(1);
  });

  it('does not cache failed WASM initialization, allowing a retry to recover', async () => {
    const init = vi
      .fn()
      .mockRejectedValueOnce(new Error('init failed'))
      .mockResolvedValueOnce(undefined);
    vi.doMock('@/wasm/index.js', () => ({
      init,
      version: vi.fn(() => 'test-wasm'),
    }));

    const { useSonareDemoAudio } = await import('@/composables/useSonareDemoAudio');
    const audio = useSonareDemoAudio();

    await expect(audio.ensureWasm()).rejects.toThrow('init failed');
    expect(audio.wasmReady.value).toBe(false);

    await expect(audio.ensureWasm()).resolves.toMatchObject({
      version: expect.any(Function),
    });
    expect(init).toHaveBeenCalledTimes(2);
    expect(audio.wasmReady.value).toBe(true);
  });

  it('shares concurrent WASM initialization across callers', async () => {
    let resolveInit!: () => void;
    const init = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveInit = resolve;
        }),
    );
    vi.doMock('@/wasm/index.js', () => ({
      init,
      version: vi.fn(() => 'test-wasm'),
    }));

    const { useSonareDemoAudio } = await import('@/composables/useSonareDemoAudio');
    const first = useSonareDemoAudio();
    const second = useSonareDemoAudio();

    const firstInit = first.ensureWasm();
    const secondInit = second.ensureWasm();
    await vi.waitFor(() => expect(init).toHaveBeenCalledTimes(1));

    resolveInit();
    const [firstModule, secondModule] = await Promise.all([firstInit, secondInit]);

    expect(firstModule).toBe(secondModule);
    expect(first.wasmReady.value).toBe(true);
    expect(second.wasmReady.value).toBe(true);
  });

  it('toggles playback off when the same demo is played again', async () => {
    const { useSonareDemoAudio } = await import('@/composables/useSonareDemoAudio');
    const audio = useSonareDemoAudio();

    await audio.play('signal-demo', {
      samples: new Float32Array([0, 0.5, -0.5, 0]),
      sampleRate: 4,
    });
    expect(audio.playingId.value).toBe('signal-demo');
    expect(createdSources[0].start).toHaveBeenCalledTimes(1);

    await audio.play('signal-demo', {
      samples: new Float32Array([0, 0.5, -0.5, 0]),
      sampleRate: 4,
    });
    expect(createdSources[0].stop).toHaveBeenCalledTimes(1);
    expect(audio.playingId.value).toBe('');
    expect(audio.progress.value).toBe(0);
  });

  it('rejects invalid audio before creating a source', async () => {
    const { useSonareDemoAudio } = await import('@/composables/useSonareDemoAudio');
    const audio = useSonareDemoAudio();

    await expect(
      audio.play('empty-demo', { samples: new Float32Array(), sampleRate: 48_000 }),
    ).rejects.toThrow('demo audio is empty');
    await expect(
      audio.play('bad-rate-demo', { samples: new Float32Array([0]), sampleRate: 0 }),
    ).rejects.toThrow('invalid sample rate');
    expect(createdSources).toHaveLength(0);
  });

  it('stops the previous demo before starting another one', async () => {
    const { useSonareDemoAudio } = await import('@/composables/useSonareDemoAudio');
    const audio = useSonareDemoAudio();

    await audio.play('first-demo', { samples: new Float32Array([0, 1]), sampleRate: 2 });
    await audio.play('second-demo', { samples: new Float32Array([1, 0]), sampleRate: 2 });

    expect(createdSources).toHaveLength(2);
    expect(createdSources[0].stop).toHaveBeenCalledTimes(1);
    expect(createdSources[1].start).toHaveBeenCalledTimes(1);
    expect(audio.playingId.value).toBe('second-demo');
  });

  it('clears playback state when the source ends', async () => {
    const { useSonareDemoAudio } = await import('@/composables/useSonareDemoAudio');
    const audio = useSonareDemoAudio();

    await audio.play('ending-demo', { samples: new Float32Array([0, 1]), sampleRate: 2 });
    expect(audio.playingId.value).toBe('ending-demo');

    createdSources[0].onended?.();

    expect(audio.playingId.value).toBe('');
    expect(audio.progress.value).toBe(0);
    expect(createdSources[0].stop).not.toHaveBeenCalled();
  });
});
