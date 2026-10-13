// @vitest-environment node
/**
 * The Formant mode control, measured through the worklet processor the page
 * runs. At +7 st `relative` lets the retune carry a vowel's formants up with
 * the pitch, while `absolute` keeps them where the input had them; the reach
 * check the page warns with agrees with what the engine refuses.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  absoluteFormantInReach,
  buildProcessorSource,
  type FormantMode,
  type RealtimeFxParams,
} from '@/demos/realtime-fx/useRealtimeFx';

const SR = 48_000;
const BLOCK = 128;

type Message = { type: string; latencySamples?: number };
interface VoiceNode {
  port: { onmessage: ((event: { data: unknown }) => void) | null };
  messages: Message[];
  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean;
}

const wasmBinary = readFileSync(join(process.cwd(), 'src/wasm/sonare.wasm'));
const sonareUrl = pathToFileURL(join(process.cwd(), 'src/wasm/sonare.js')).href;
const workDir = mkdtempSync(join(tmpdir(), 'rtfx-'));
let Processor: new (options: unknown) => VoiceNode;

/** Loads the processor module with the AudioWorklet globals it expects. */
async function loadProcessor(): Promise<new (options: unknown) => VoiceNode> {
  let registered: (new (options: unknown) => VoiceNode) | null = null;
  const scope = globalThis as Record<string, unknown>;
  scope.sampleRate = SR;
  scope.AudioWorkletProcessor = class {
    messages: Message[] = [];
    port = { onmessage: null, postMessage: (msg: Message) => this.messages.push(msg) };
  };
  scope.registerProcessor = (_name: string, cls: typeof registered) => {
    registered = cls;
  };
  const file = join(workDir, 'processor.mjs');
  writeFileSync(file, buildProcessorSource(sonareUrl));
  await import(/* @vite-ignore */ pathToFileURL(file).href);
  if (!registered) throw new Error('processor not registered');
  return registered;
}

/** A 140 Hz pulse train through two resonators (700 Hz and 1.8 kHz): a steady vowel. */
function vowel(seconds: number): Float32Array {
  const n = Math.round(seconds * SR);
  const pulses = new Float32Array(n);
  for (let i = 0; i < n; i += Math.round(SR / 140)) pulses[i] = 1;
  const resonate = (f: number, bw: number) => {
    const r = Math.exp((-Math.PI * bw) / SR);
    const a1 = 2 * r * Math.cos((2 * Math.PI * f) / SR);
    const y = new Float32Array(n);
    for (let i = 0; i < n; i++)
      y[i] = pulses[i] * (1 - r) + a1 * (y[i - 1] ?? 0) - r * r * (y[i - 2] ?? 0);
    return y;
  };
  const out = resonate(700, 90);
  const f2 = resonate(1800, 120);
  let peak = 0;
  for (let i = 0; i < n; i++) {
    out[i] += 0.6 * f2[i];
    peak = Math.max(peak, Math.abs(out[i]));
  }
  for (let i = 0; i < n; i++) out[i] *= 0.3 / peak;
  return out;
}

/** Power-weighted mean frequency below 5 kHz over the second half of `x`. */
function centroidHz(x: Float32Array): number {
  const N = 4096;
  let num = 0;
  let den = 0;
  for (let off = x.length >> 1; off + N <= x.length; off += N) {
    for (let k = 1; (k * SR) / N <= 5000; k++) {
      let re = 0;
      let im = 0;
      for (let t = 0; t < N; t++) {
        const s = x[off + t] * (0.5 - 0.5 * Math.cos((2 * Math.PI * t) / N));
        re += s * Math.cos((2 * Math.PI * k * t) / N);
        im -= s * Math.sin((2 * Math.PI * k * t) / N);
      }
      num += ((re * re + im * im) * k * SR) / N;
      den += re * re + im * im;
    }
  }
  return num / den;
}

function params(formantMode: FormantMode, pitchSemitones: number): RealtimeFxParams {
  return {
    preset: 'neutral-monitor',
    pitchSemitones,
    formant: 1,
    brightness: 0,
    formantEngaged: true,
    formantMode,
    wet: 1,
    outputGain: 1,
    bypass: false,
  };
}

async function start(): Promise<VoiceNode> {
  const node = new Processor({ processorOptions: { wasmBinary } });
  for (let i = 0; i < 300 && !node.messages.some((m) => m.type === 'ready'); i++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  expect(node.messages.map((m) => m.type)).toContain('ready');
  return node;
}

function send(node: VoiceNode, p: RealtimeFxParams): void {
  node.port.onmessage?.({ data: { type: 'params', params: p } });
}

function render(node: VoiceNode, input: Float32Array): Float32Array {
  const out = new Float32Array(input.length);
  for (let i = 0; i + BLOCK <= input.length; i += BLOCK) {
    const left = new Float32Array(BLOCK);
    node.process([[input.subarray(i, i + BLOCK)]], [[left, new Float32Array(BLOCK)]]);
    out.set(left, i);
  }
  return out;
}

describe('formant mode through the voice worklet', () => {
  beforeAll(async () => {
    Processor = await loadProcessor();
  }, 30_000);

  afterAll(() => rmSync(workDir, { recursive: true, force: true }));

  it('relative carries the formants up with +7 st; absolute keeps the input voice size', async () => {
    const input = vowel(2);
    const inputHz = centroidHz(input);
    const centroid = async (mode: FormantMode) => {
      const node = await start();
      send(node, params(mode, 7));
      return centroidHz(render(node, input));
    };
    const relative = await centroid('relative');
    const absolute = await centroid('absolute');
    expect(relative / inputHz).toBeGreaterThan(1.3);
    expect(Math.abs(absolute / inputHz - 1)).toBeLessThan(0.15);
  }, 60_000);

  it('a mode switch rebuilds the changer and reports its longer latency', async () => {
    const node = await start();
    const ready = node.messages.find((m) => m.type === 'ready')?.latencySamples ?? 0;
    send(node, params('absolute', 0));
    const latency = node.messages.find((m) => m.type === 'latency')?.latencySamples ?? 0;
    expect(latency).toBeGreaterThan(ready);
  }, 30_000);

  it('the reach check matches what an absolute-mode changer accepts', async () => {
    const createModule = (await import(/* @vite-ignore */ sonareUrl)).default;
    const mod = await createModule({ wasmBinary });
    const base = JSON.parse(mod.realtimeVoiceChangerPresetJson('neutral-monitor'));
    base.dsp.formant.mode = 'absolute';
    const vc = mod.createRealtimeVoiceChanger('neutral-monitor');
    vc.setConfig(base);
    vc.prepare(SR, BLOCK, 1);
    for (const pitch of [-12, -9, -4, 0, 4, 9, 12]) {
      for (const formant of [0.55, 0.8, 1, 1.3, 1.65]) {
        const config = structuredClone(base);
        config.dsp.retune.semitones = pitch;
        config.dsp.retune.mix = 1;
        config.dsp.formant.factor = formant;
        let accepted = true;
        try {
          vc.setConfig(config);
        } catch {
          accepted = false;
        }
        expect(accepted, `${pitch} st, formant ${formant}`).toBe(
          absoluteFormantInReach(pitch, formant),
        );
      }
    }
    vc.delete();
  });

  it('a refused setting leaves the previous one in force', async () => {
    const createModule = (await import(/* @vite-ignore */ sonareUrl)).default;
    const mod = await createModule({ wasmBinary });
    const base = JSON.parse(mod.realtimeVoiceChangerPresetJson('neutral-monitor'));
    base.dsp.formant.mode = 'absolute';
    const vc = mod.createRealtimeVoiceChanger('neutral-monitor');
    vc.setConfig(base);
    vc.prepare(SR, BLOCK, 1);
    const set = (semitones: number, factor: number) => {
      const config = structuredClone(base);
      config.dsp.retune.semitones = semitones;
      config.dsp.retune.mix = 1;
      config.dsp.formant.factor = factor;
      vc.setConfig(config);
    };
    set(4, 1.2);
    expect(absoluteFormantInReach(12, 0.5)).toBe(false);
    expect(() => set(12, 0.5)).toThrow();
    const kept = JSON.parse(vc.configJson());
    expect(kept.dsp.retune.semitones).toBe(4);
    expect(kept.dsp.formant.factor).toBeCloseTo(1.2, 5);
    vc.delete();
  });
});
