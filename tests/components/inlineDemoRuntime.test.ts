import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';

const lang = ref('en');
vi.mock('vitepress', () => ({ useData: () => ({ lang }) }));

interface PlayedAudio {
  id: string;
  length: number;
  sampleRate: number;
  peak: number;
}

const audioRuntime = vi.hoisted(() => ({
  plays: [] as PlayedAudio[],
  playingId: { value: '' },
}));

vi.mock('@/composables/useSonareDemoAudio', async () => {
  const wasm = await vi.importActual<typeof import('@/wasm/index.js')>('@/wasm/index.js');
  const { readonly, ref } = await import('vue');
  const playingId = ref('');
  const progress = ref(0);
  const wasmReady = ref(true);
  const clipCache = new Map<string, { samples: Float32Array; sampleRate: number }>();

  audioRuntime.playingId = playingId;

  function loadWav(name: string) {
    const cached = clipCache.get(name);
    if (cached) return cached;

    const bytes = readFileSync(join(process.cwd(), 'src', 'public', 'demo-clips', `${name}.wav`));
    let channels = 0;
    let sampleRate = 0;
    let bitsPerSample = 0;
    let format = 0;
    let dataOffset = 0;
    let dataSize = 0;

    for (let offset = 12; offset + 8 <= bytes.length; ) {
      const chunk = bytes.toString('ascii', offset, offset + 4);
      const size = bytes.readUInt32LE(offset + 4);
      const body = offset + 8;
      if (chunk === 'fmt ') {
        format = bytes.readUInt16LE(body);
        channels = bytes.readUInt16LE(body + 2);
        sampleRate = bytes.readUInt32LE(body + 4);
        bitsPerSample = bytes.readUInt16LE(body + 14);
      } else if (chunk === 'data') {
        dataOffset = body;
        dataSize = size;
        break;
      }
      offset = body + size + (size & 1);
    }

    if (format !== 1 || channels < 1 || bitsPerSample !== 16 || dataSize === 0) {
      throw new Error(`unsupported demo WAV: ${name}`);
    }

    const frames = Math.floor(dataSize / (channels * 2));
    const samples = new Float32Array(frames);
    for (let frame = 0; frame < frames; frame++) {
      let sum = 0;
      for (let channel = 0; channel < channels; channel++) {
        sum += bytes.readInt16LE(dataOffset + (frame * channels + channel) * 2) / 32768;
      }
      samples[frame] = sum / channels;
    }

    const audio = { samples, sampleRate };
    clipCache.set(name, audio);
    return audio;
  }

  async function play(
    id: string,
    audio: { samples: Float32Array; sampleRate: number },
  ): Promise<void> {
    if (audio.samples.length === 0 || !Number.isFinite(audio.sampleRate) || audio.sampleRate <= 0) {
      throw new Error(`invalid audition audio for ${id}`);
    }
    let peak = 0;
    for (const sample of audio.samples) {
      if (!Number.isFinite(sample)) throw new Error(`non-finite audition sample for ${id}`);
      peak = Math.max(peak, Math.abs(sample));
    }
    audioRuntime.plays.push({
      id,
      length: audio.samples.length,
      sampleRate: audio.sampleRate,
      peak,
    });
    playingId.value = id;
  }

  function stop(): void {
    playingId.value = '';
    progress.value = 0;
  }

  return {
    ensureWasm: async () => wasm,
    useSonareDemoAudio: () => ({
      ensureWasm: async () => wasm,
      loadClip: async (name: string) => loadWav(name),
      play,
      stop,
      playingId: readonly(playingId),
      progress: readonly(progress),
      wasmReady: readonly(wasmReady),
    }),
  };
});

import { demoArchetypeComponents } from '@/components/demos/archetypes';
import { allDemos } from '@/demos/registry';
import * as wasm from '@/wasm/index.js';

async function settle(wrapper: ReturnType<typeof mount>): Promise<'ready' | 'error' | 'timeout'> {
  for (let attempt = 0; attempt < 300; attempt++) {
    await flushPromises();
    if (wrapper.find('figure.td--ready').exists()) return 'ready';
    if (wrapper.find('figure.td--error').exists()) return 'error';
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  return 'timeout';
}

beforeAll(async () => {
  await wasm.init({ wasmBinary: readFileSync(join(process.cwd(), 'src/wasm/sonare.wasm')) });
}, 30_000);

afterEach(() => {
  audioRuntime.playingId.value = '';
  audioRuntime.plays.length = 0;
  lang.value = 'en';
  vi.unstubAllGlobals();
});

describe('inline demo runtime', () => {
  it('processes and auditions every registered demo with real WASM and bundled clips', async () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 1),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    const failures: string[] = [];

    for (const def of allDemos) {
      const component = demoArchetypeComponents[def.archetype];
      const host = defineComponent({
        setup: () => () => h(component, { def, active: true }),
      });
      const wrapper = mount(host);
      try {
        const terminalState = await settle(wrapper);
        if (terminalState !== 'ready') {
          const alert = wrapper.find('[role="alert"]');
          failures.push(`${def.id}: ${terminalState}${alert.exists() ? ` (${alert.text()})` : ''}`);
          continue;
        }

        const title = wrapper.find('.td__title');
        if (!title.exists() || title.text() !== def.title.en) {
          failures.push(`${def.id}: title did not render from its registry definition`);
          continue;
        }

        const playButton = wrapper.find<HTMLButtonElement>('button.td__play');
        if (!playButton.exists() || playButton.element.disabled) {
          failures.push(`${def.id}: audition control is missing or disabled after processing`);
          continue;
        }

        const playCount = audioRuntime.plays.length;
        await playButton.trigger('click');
        await flushPromises();
        const played = audioRuntime.plays.at(-1);
        if (audioRuntime.plays.length !== playCount + 1 || played?.id !== def.id) {
          failures.push(`${def.id}: audition did not reach the shared audio runtime`);
          continue;
        }
        if (!played || played.length === 0 || played.peak <= 0) {
          failures.push(`${def.id}: audition produced silent or empty audio`);
        }
      } finally {
        wrapper.unmount();
        audioRuntime.playingId.value = '';
      }
    }

    expect(failures).toEqual([]);
    expect(audioRuntime.plays).toHaveLength(allDemos.length);
  }, 120_000);
});
