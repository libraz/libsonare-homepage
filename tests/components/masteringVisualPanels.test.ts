import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MasteringInsights from '@/components/MasteringInsights.vue';
import MasteringWaveform from '@/components/MasteringWaveform.vue';

const lang = vi.hoisted(() => ({ value: 'en' }));

vi.mock('vitepress', () => ({
  useData: () => ({ lang }),
}));

function audio(overrides: Record<string, unknown> = {}) {
  return {
    fileName: 'source.wav',
    left: new Float32Array([0, 0.5, -0.75, 1, -0.5, 0.25, -0.25, 0]),
    right: new Float32Array([0, -0.25, 0.75, -1, 0.5, -0.25, 0.25, 0]),
    sampleRate: 48_000,
    duration: 2,
    channels: 2,
    ...overrides,
  };
}

describe('MasteringWaveform', () => {
  let ctx: Record<string, any>;
  let calls: Array<{ method: string; args: unknown[]; fillStyle?: unknown; strokeStyle?: unknown }>;
  let getContextSpy: ReturnType<typeof vi.spyOn>;
  let clientWidthSpy: ReturnType<typeof vi.spyOn>;
  let rafCallback: FrameRequestCallback | null;

  beforeEach(() => {
    calls = [];
    rafCallback = null;
    ctx = {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      font: '',
      letterSpacing: '',
      textAlign: '',
      textBaseline: '',
      setTransform: vi.fn((...args: unknown[]) => calls.push({ method: 'setTransform', args })),
      scale: vi.fn((...args: unknown[]) => calls.push({ method: 'scale', args })),
      clearRect: vi.fn((...args: unknown[]) => calls.push({ method: 'clearRect', args })),
      beginPath: vi.fn(() => calls.push({ method: 'beginPath', args: [] })),
      moveTo: vi.fn((...args: unknown[]) => calls.push({ method: 'moveTo', args })),
      lineTo: vi.fn((...args: unknown[]) => calls.push({ method: 'lineTo', args })),
      rect: vi.fn((...args: unknown[]) => calls.push({ method: 'rect', args })),
      stroke: vi.fn(function (this: any) {
        calls.push({ method: 'stroke', args: [], strokeStyle: this.strokeStyle });
      }),
      fill: vi.fn(function (this: any) {
        calls.push({ method: 'fill', args: [], fillStyle: this.fillStyle });
      }),
      fillText: vi.fn(function (this: any, ...args: unknown[]) {
        calls.push({ method: 'fillText', args, fillStyle: this.fillStyle });
      }),
    };
    getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    clientWidthSpy = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(120);
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        rafCallback = callback;
        return 7;
      }),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal(
      'ResizeObserver',
      vi.fn().mockImplementation(function (callback: ResizeObserverCallback) {
        return {
          observe: vi.fn(() => callback([], {} as ResizeObserver)),
          disconnect: vi.fn(),
        };
      }),
    );
    vi.stubGlobal(
      'MutationObserver',
      vi.fn().mockImplementation(function (callback: MutationCallback) {
        return {
          observe: vi.fn(() => callback([], {} as MutationObserver)),
          disconnect: vi.fn(),
        };
      }),
    );
  });

  afterEach(() => {
    getContextSpy.mockRestore();
    clientWidthSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  function flushDraw() {
    expect(rafCallback).toBeTruthy();
    rafCallback?.(0);
    rafCallback = null;
  }

  it('draws placeholder metadata when no audio is loaded', () => {
    const wrapper = mount(MasteringWaveform, {
      props: {
        audio: null,
        variant: 'source',
        height: 72,
      },
    });

    flushDraw();
    expect(wrapper.text()).toContain('No audio loaded');
    expect(wrapper.text()).toContain('--:--');
    expect(
      calls.some((call) => call.method === 'fillText' && call.args[0] === 'NO AUDIO LOADED'),
    ).toBe(true);
    expect(wrapper.find('.wave-panel__playhead').exists()).toBe(false);
  });

  it('draws primary and compare peaks with shared scaling and playhead progress', () => {
    const wrapper = mount(MasteringWaveform, {
      props: {
        audio: audio(),
        compare: audio({
          fileName: 'source-before.wav',
          left: new Float32Array([0, 1, -1, 0]),
          right: new Float32Array([0, 1, -1, 0]),
        }),
        variant: 'master',
        height: 80,
        progress: 0.25,
      },
    });

    flushDraw();
    expect(wrapper.text()).toContain('source.wav');
    expect(wrapper.text()).toContain('0:02');
    expect(wrapper.text()).toContain('48k · STEREO');
    expect(wrapper.find('.wave-panel__legend').exists()).toBe(true);
    expect(wrapper.find('.wave-panel__playhead').attributes('style')).toContain('left: 25%');
    expect(calls.filter((call) => call.method === 'fill')).toHaveLength(2);
    expect(calls.filter((call) => call.method === 'rect').length).toBeGreaterThan(0);
  });

  it('emits clamped seek fractions from pointer scrubbing only when interactive', async () => {
    const wrapper = mount(MasteringWaveform, {
      props: {
        audio: audio(),
        variant: 'source',
        progress: 0,
      },
    });
    const body = wrapper.find('.wave-panel__body');
    vi.spyOn(body.element, 'getBoundingClientRect').mockReturnValue({
      left: 10,
      width: 100,
      top: 0,
      right: 110,
      bottom: 80,
      height: 80,
      x: 10,
      y: 0,
      toJSON: () => ({}),
    });
    (body.element as HTMLElement).setPointerCapture = vi.fn();
    (body.element as HTMLElement).releasePointerCapture = vi.fn();
    (body.element as HTMLElement).hasPointerCapture = vi.fn(() => true);

    body.element.dispatchEvent(new PointerEvent('pointerdown', { clientX: 60, pointerId: 1 }));
    await wrapper.vm.$nextTick();
    body.element.dispatchEvent(new PointerEvent('pointermove', { clientX: 140, pointerId: 1 }));
    await wrapper.vm.$nextTick();
    body.element.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted('seek')).toEqual([[0.5], [1]]);

    await wrapper.setProps({ progress: undefined });
    body.element.dispatchEvent(new PointerEvent('pointerdown', { clientX: 20, pointerId: 2 }));
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted('seek')).toEqual([[0.5], [1]]);
  });

  it('redraws on audio changes and cancels pending frames on unmount', async () => {
    const wrapper = mount(MasteringWaveform, {
      props: {
        audio: audio(),
        variant: 'source',
      },
    });

    flushDraw();
    calls.length = 0;
    await wrapper.setProps({ audio: audio({ fileName: 'master.wav', duration: 4 }) });
    flushDraw();
    expect(wrapper.text()).toContain('master.wav');
    expect(calls.some((call) => call.method === 'clearRect')).toBe(true);

    await wrapper.setProps({ audio: audio({ fileName: 'pending.wav' }) });
    wrapper.unmount();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(7);
  });
});

describe('MasteringInsights', () => {
  it('renders profile, suggestions and delivery preview with formatted gain values', async () => {
    const wrapper = mount(MasteringInsights, {
      props: {
        analyzing: false,
        hasReport: true,
        profileItems: [
          { label: 'Peak', value: '-1.0 dBFS' },
          { label: 'Crest', value: '9.0 dB' },
        ],
        suggestions: ['Lower the limiter ceiling', 'Narrow the low end'],
        canApply: true,
        qualityTargetLufs: -17.5,
        preview: [
          {
            name: 'Spotify',
            normalizationGainDb: -2.5,
            ceilingRisk: true,
            safeCeilingDb: -2.2,
            currentCeilingDb: -1,
          },
          {
            name: 'YouTube',
            normalizationGainDb: 1.2,
            ceilingRisk: false,
            safeCeilingDb: -2.2,
            currentCeilingDb: -2.5,
          },
          {
            name: 'Apple',
            normalizationGainDb: 0,
            ceilingRisk: false,
            safeCeilingDb: -1,
            currentCeilingDb: -1,
          },
          {
            name: 'Broken',
            normalizationGainDb: Number.NaN,
            ceilingRisk: false,
            safeCeilingDb: Number.NaN,
            currentCeilingDb: Number.NaN,
          },
        ],
      },
    });

    expect(wrapper.text()).toContain('Peak');
    expect(wrapper.text()).toContain('Lower the limiter ceiling');
    expect(wrapper.text()).toContain('Spotify');
    expect(wrapper.text()).toContain('−2.5 dB');
    expect(wrapper.text()).toContain('+1.2 dB');
    expect(wrapper.text()).toContain('0.0 dB');
    expect(wrapper.text()).toContain('-');
    expect(wrapper.text()).toContain('Set ceiling <= -2.2 dBTP');
    expect(wrapper.find('.master-insights__platform--risk').exists()).toBe(true);

    await wrapper
      .findAll('.master-insights__button')
      .find((button) => button.text() === 'Apply')!
      .trigger('click');
    expect(wrapper.emitted('apply')).toHaveLength(1);

    await wrapper
      .findAll('.master-insights__button')
      .find((button) => button.text() === 'Refresh')!
      .trigger('click');
    expect(wrapper.emitted('refresh')).toHaveLength(1);
  });

  it('shows empty states and disables refresh while analyzing', async () => {
    const wrapper = mount(MasteringInsights, {
      props: {
        analyzing: true,
        hasReport: false,
        profileItems: [],
        suggestions: [],
        preview: [],
      },
    });

    expect(
      wrapper
        .findAll('.master-insights__button')
        .every((button) => button.attributes('disabled') !== undefined),
    ).toBe(true);
    expect(wrapper.findAll('.master-insights__empty')).toHaveLength(3);

    await wrapper
      .findAll('.master-insights__button')
      .find((button) => button.text() === 'Refresh')!
      .trigger('click');
    expect(wrapper.emitted('refresh')).toBeUndefined();
  });

  it('localizes known assistant suggestion text in Japanese', () => {
    lang.value = 'ja';
    const wrapper = mount(MasteringInsights, {
      props: {
        analyzing: false,
        hasReport: true,
        profileItems: [],
        suggestions: [
          'base preset selected from top genre candidate: edm',
          'target loudness and ceiling applied from AssistantConfig',
          'bass-heavy fast material gets mild tilt and tape drive',
          'transient shaper enabled for dense attacks',
        ],
        preview: [],
      },
    });

    expect(wrapper.text()).toContain('最上位ジャンル候補からベースプリセットを選択: edm');
    expect(wrapper.text()).toContain('目標ラウドネスとシーリングをアシスタント設定から適用');
    expect(wrapper.text()).toContain('低域が強く速い素材のため、軽い Tilt とテープドライブを適用');
    expect(wrapper.text()).toContain('アタックが密なため、トランジェントシェイパーを有効化');
    lang.value = 'en';
  });
});
