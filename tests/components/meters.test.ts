import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CorrelationMeter from '@/components/meters/CorrelationMeter.vue';
import GainReductionMeter from '@/components/meters/GainReductionMeter.vue';
import Goniometer from '@/components/meters/Goniometer.vue';
import LoudnessMeter from '@/components/meters/LoudnessMeter.vue';
import {
  CLIP_THRESHOLD_DBTP,
  createPeakBallistics,
  dbScaleTicks,
  dbToFraction,
  formatMeterValue,
  isPeakBallisticsMoving,
  latchClip,
  loudnessScaleSpec,
  lufsInScale,
  METER_FLOOR_DB,
  PEAK_FALL_DB_PER_SECOND,
  PEAK_HOLD_SECONDS,
  type PeakBallistics,
  stepPeakBallistics,
} from '@/components/meters/meterBallistics';
import PeakMeter from '@/components/meters/PeakMeter.vue';
import SpectrumView from '@/components/meters/SpectrumView.vue';

/** Manual requestAnimationFrame: callbacks run only when the test flushes a timestamp. */
function installFrameQueue() {
  let queue: Array<{ id: number; cb: FrameRequestCallback }> = [];
  let nextId = 1;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    const id = nextId++;
    queue.push({ id, cb });
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    queue = queue.filter((entry) => entry.id !== id);
  });
  return {
    flush(timeMs: number) {
      const run = queue;
      queue = [];
      for (const entry of run) entry.cb(timeMs);
    },
    get pending() {
      return queue.length;
    },
  };
}

function run(steps: Array<[number, number]>, floorDb = METER_FLOOR_DB): PeakBallistics {
  return steps.reduce(
    (state, [db, t]) => stepPeakBallistics(state, db, t, floorDb),
    createPeakBallistics(floorDb),
  );
}

describe('meterBallistics', () => {
  it('attacks instantly and holds the peak for the hold time', () => {
    const first = run([[-6, 0]]);
    expect(first.levelDb).toBe(-6);
    expect(first.holdDb).toBe(-6);

    const held = run([
      [-6, 0],
      [-60, 1],
      [-60, PEAK_HOLD_SECONDS],
    ]);
    expect(held.holdDb).toBe(-6);
    expect(held.levelDb).toBeCloseTo(-6 - PEAK_FALL_DB_PER_SECOND * PEAK_HOLD_SECONDS, 9);
  });

  it('releases the hold after the hold time and falls at the fall rate', () => {
    const state = run([
      [-6, 0],
      [-60, 1],
      [-60, 2],
    ]);
    // Released at 1.5 s, so 0.5 s of fall by 2 s.
    expect(state.holdDb).toBeCloseTo(-16, 9);
    expect(state.levelDb).toBeCloseTo(-46, 9);
  });

  it('falls by the same amount whether stepped per frame or in one step', () => {
    const coarse = run([
      [0, 0],
      [-100, 3],
    ]);
    const fineSteps: Array<[number, number]> = [[0, 0]];
    for (let i = 1; i <= 180; i++) fineSteps.push([-100, i / 60]);
    const fine = run(fineSteps);
    expect(fine.levelDb).toBeCloseTo(coarse.levelDb, 6);
    expect(fine.holdDb).toBeCloseTo(coarse.holdDb, 6);
    expect(coarse.levelDb).toBeCloseTo(-60, 9);
    expect(coarse.holdDb).toBeCloseTo(-30, 9);
  });

  it('re-arms the hold when a new reading reaches the falling tick', () => {
    const state = run([
      [-6, 0],
      [-60, 2],
      [-10, 2.2],
    ]);
    expect(state.holdDb).toBe(-10);
    expect(state.holdUntil).toBeCloseTo(2.2 + PEAK_HOLD_SECONDS, 9);
  });

  it('reads NaN and -Infinity as the floor and never falls below it', () => {
    expect(run([[Number.NaN, 0]]).levelDb).toBe(METER_FLOOR_DB);
    expect(run([[Number.NEGATIVE_INFINITY, 0]]).holdDb).toBe(METER_FLOOR_DB);
    const settled = run([
      [-100, 0],
      [Number.NEGATIVE_INFINITY, 30],
    ]);
    expect(settled.levelDb).toBe(METER_FLOOR_DB);
    expect(settled.holdDb).toBe(METER_FLOOR_DB);
    expect(
      run(
        [
          [-3, 0],
          [Number.NaN, 30],
        ],
        0,
      ).levelDb,
    ).toBe(0);
  });

  it('treats a step backwards in time as no elapsed time', () => {
    const state = run([
      [-6, 5],
      [-60, 4],
    ]);
    expect(state.levelDb).toBe(-6);
  });

  it('reports motion until the display rests on the reading', () => {
    const peak = run([[-6, 0]]);
    expect(isPeakBallisticsMoving(peak, -6)).toBe(false);
    expect(isPeakBallisticsMoving(peak, -20)).toBe(true);
    const rested = run([
      [-6, 0],
      [-20, 10],
    ]);
    expect(isPeakBallisticsMoving(rested, -20)).toBe(false);
  });

  it('latches clip strictly above the threshold until cleared', () => {
    expect(latchClip(false, -0.2)).toBe(false);
    expect(latchClip(false, CLIP_THRESHOLD_DBTP)).toBe(false);
    expect(latchClip(false, -0.05)).toBe(true);
    expect(latchClip(false, Number.NaN)).toBe(false);
    expect(latchClip(false, Number.POSITIVE_INFINITY)).toBe(true);
    expect(latchClip(true, Number.NEGATIVE_INFINITY)).toBe(true);
  });

  it('maps dB to a clamped fraction and lays ticks on zero-aligned steps', () => {
    expect(dbToFraction(-30, -60, 0)).toBe(0.5);
    expect(dbToFraction(6, -60, 0)).toBe(1);
    expect(dbToFraction(Number.NEGATIVE_INFINITY, -60, 0)).toBe(0);
    expect(dbToFraction(Number.NaN, -60, 0)).toBe(0);
    expect(dbScaleTicks(-60, 0, 12)).toEqual([-60, -48, -36, -24, -12, 0]);
    expect(dbScaleTicks(-41, -14, 6)).toEqual([-36, -30, -24, -18]);
  });

  it('describes the absolute and EBU +9 loudness scales', () => {
    const abs = loudnessScaleSpec('absolute');
    expect([abs.minLufs, abs.maxLufs, abs.unit]).toEqual([-40, 0, 'LUFS']);
    expect(abs.ticks.at(0)).toEqual({ lufs: -40, label: '-40' });
    expect(abs.ticks.at(-1)).toEqual({ lufs: 0, label: '0' });

    const ebu = loudnessScaleSpec('ebu9');
    expect([ebu.minLufs, ebu.maxLufs, ebu.unit]).toEqual([-41, -14, 'LU']);
    expect(ebu.ticks.find((t) => t.label === '0')?.lufs).toBe(-23);
    expect(ebu.ticks.at(-1)).toEqual({ lufs: -14, label: '+9' });
    expect(ebu.ticks.at(0)).toEqual({ lufs: -41, label: '-18' });

    expect(lufsInScale(-14, 'ebu9')).toBe(9);
    expect(lufsInScale(-14, 'absolute')).toBe(-14);
  });

  it('formats readouts with an em dash for missing values', () => {
    expect(formatMeterValue(Number.NaN)).toBe('—');
    expect(formatMeterValue(Number.NEGATIVE_INFINITY)).toBe('—');
    expect(formatMeterValue(-0.04)).toBe('0.0');
    expect(formatMeterValue(3.25, true)).toBe('+3.3');
    expect(formatMeterValue(-3.25, true)).toBe('-3.3');
  });
});

describe('meter components', () => {
  let frames: ReturnType<typeof installFrameQueue>;

  beforeEach(() => {
    frames = installFrameQueue();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const peakLabels = { name: 'Master', clip: 'Clip', clearClip: 'Clear clip' };

  it('PeakMeter renders missing values as dashes and latches and clears clip', async () => {
    const wrapper = mount(PeakMeter, {
      props: { peakDb: [Number.NaN, Number.NEGATIVE_INFINITY], labels: peakLabels },
    });
    frames.flush(0);
    await wrapper.vm.$nextTick();
    const readouts = wrapper.findAll('.peak-meter__readout').map((r) => r.text());
    expect(readouts).toEqual(['—', '—']);
    expect(wrapper.find('[role="img"]').attributes('aria-label')).toBe('Master: L —, R —');
    const clip = wrapper.find('.peak-meter__clip');
    expect(clip.attributes('disabled')).toBeDefined();

    await wrapper.setProps({ peakDb: [-3, -4], truePeakDb: 0.4 });
    expect(clip.classes()).toContain('peak-meter__clip--on');
    expect(clip.attributes('aria-label')).toBe('Clear clip');

    await wrapper.setProps({ peakDb: [-20, -20], truePeakDb: -12 });
    expect(clip.classes()).toContain('peak-meter__clip--on');

    await clip.trigger('click');
    expect(clip.classes()).not.toContain('peak-meter__clip--on');
    expect(clip.attributes('disabled')).toBeDefined();
  });

  it('PeakMeter applies ballistics on animation frames', async () => {
    const wrapper = mount(PeakMeter, {
      props: { peakDb: [-6, -12], labels: peakLabels },
    });
    frames.flush(1000);
    await wrapper.vm.$nextTick();
    expect(wrapper.findAll('.peak-meter__readout').map((r) => r.text())).toEqual(['-6.0', '-12.0']);
    expect(wrapper.find('[role="img"]').attributes('aria-label')).toBe('Master: L -6 dB, R -12 dB');

    await wrapper.setProps({ peakDb: [-60, -60] });
    frames.flush(1016);
    frames.flush(3000);
    await wrapper.vm.$nextTick();
    // 1.5 s hold, then (3.0 - 2.5) s of fall at 20 dB/s.
    expect(wrapper.findAll('.peak-meter__readout').map((r) => r.text())).toEqual([
      '-16.0',
      '-22.0',
    ]);
  });

  it('PeakMeter sample peak drives the clip latch when no true peak is given', async () => {
    const wrapper = mount(PeakMeter, { props: { peakDb: [-1, 0], labels: peakLabels } });
    expect(wrapper.find('.peak-meter__clip').classes()).toContain('peak-meter__clip--on');
  });

  it('PeakMeter compact variant drops the printed scale', () => {
    const wrapper = mount(PeakMeter, {
      props: { peakDb: [-6, -6], orientation: 'horizontal', labels: peakLabels },
    });
    expect(wrapper.find('.peak-meter__scale').exists()).toBe(false);
    expect(wrapper.classes()).toContain('peak-meter--horizontal');
  });

  const loudnessLabels = { name: 'Loudness', scale: 'Scale', target: 'Target' };

  it('LoudnessMeter renders NaN and -Infinity as dashes', () => {
    const wrapper = mount(LoudnessMeter, {
      props: {
        momentaryLufs: Number.NEGATIVE_INFINITY,
        shortTermLufs: Number.NaN,
        integratedLufs: Number.NEGATIVE_INFINITY,
        lra: Number.NaN,
        truePeakDb: Number.NEGATIVE_INFINITY,
        labels: loudnessLabels,
      },
    });
    expect(wrapper.find('.loudness-meter__big').text()).toBe('—');
    const values = wrapper.findAll('.loudness-meter__value').map((v) => v.text());
    expect(values).toEqual(['—', '—', '—', '—', '—']);
    expect(wrapper.find('.loudness-meter__marker--integrated').exists()).toBe(false);
    expect(wrapper.find('[role="img"]').attributes('aria-label')).toBe('Loudness: M —, S —, I —');
  });

  it('LoudnessMeter computes PLR and switches between absolute and EBU +9', async () => {
    const wrapper = mount(LoudnessMeter, {
      props: {
        momentaryLufs: -14,
        shortTermLufs: -15,
        integratedLufs: -14.2,
        lra: 6.4,
        truePeakDb: -1,
        targetLufs: -14,
        labels: loudnessLabels,
      },
    });
    const value = (key: string) =>
      wrapper
        .findAll('.loudness-meter__readout')
        .find((r) => r.find('dt').text() === key)
        ?.find('.loudness-meter__value')
        .text();
    expect(value('PLR')).toBe('13.2');
    expect(value('M')).toBe('-14.0');
    expect(wrapper.find('.loudness-meter__big').text()).toBe('-14.2');
    expect(wrapper.find('.loudness-meter__marker--target').exists()).toBe(true);
    expect(wrapper.findAll('.loudness-meter__tick').map((t) => t.text())).toContain('-40');

    const toggle = wrapper.find('.loudness-meter__switch');
    expect(toggle.attributes('aria-pressed')).toBe('false');
    await toggle.trigger('click');
    expect(wrapper.emitted('update:scale')?.at(-1)).toEqual(['ebu9']);
    expect(toggle.attributes('aria-pressed')).toBe('true');
    expect(value('M')).toBe('+9.0');
    expect(wrapper.find('.loudness-meter__big').text()).toBe('+8.8');
    expect(wrapper.findAll('.loudness-meter__tick').map((t) => t.text())).toContain('+9');
    // Momentary -14 LUFS is the top of EBU +9.
    expect(wrapper.find('.loudness-meter__fill--M').attributes('style')).toContain(
      'inset(0.00% 0 0 0)',
    );
  });

  it('LoudnessMeter follows a controlled scale prop', () => {
    const wrapper = mount(LoudnessMeter, {
      props: {
        momentaryLufs: -23,
        shortTermLufs: -23,
        integratedLufs: -23,
        lra: 3,
        truePeakDb: -3,
        scale: 'ebu9',
        labels: loudnessLabels,
      },
    });
    expect(wrapper.find('.loudness-meter__big').text()).toBe('0.0');
    expect(wrapper.find('.loudness-meter__integrated .loudness-meter__unit').text()).toBe('LU');
  });

  it('GainReductionMeter reports a rounded value and holds the deepest reduction', async () => {
    const wrapper = mount(GainReductionMeter, {
      props: { grDb: Number.NaN, labels: { name: 'GR' } },
    });
    expect(wrapper.attributes('role')).toBe('meter');
    expect(wrapper.attributes('aria-valuenow')).toBe('0');
    expect(wrapper.find('.gr-meter__readout').text()).toBe('0.0');

    await wrapper.setProps({ grDb: -6.3 });
    frames.flush(0);
    await wrapper.vm.$nextTick();
    expect(wrapper.attributes('aria-valuenow')).toBe('-6.5');
    expect(wrapper.attributes('aria-valuemin')).toBe('-20');
    expect(wrapper.find('.gr-meter__readout').text()).toBe('-6.3');
    const hold = wrapper.find('.gr-meter__hold');
    expect(hold.attributes('style')).toContain('top: 31.5%');

    await wrapper.setProps({ grDb: -1 });
    frames.flush(500);
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.gr-meter__hold').attributes('style')).toContain('top: 31.5%');
  });

  it('CorrelationMeter clamps, signs and handles NaN', async () => {
    const wrapper = mount(CorrelationMeter, {
      props: { correlation: Number.NaN, labels: { name: 'Correlation' } },
    });
    expect(wrapper.find('.corr-meter__readout').text()).toBe('—');
    expect(wrapper.find('.corr-meter__bar').exists()).toBe(false);

    await wrapper.setProps({ correlation: -0.5 });
    expect(wrapper.attributes('aria-valuenow')).toBe('-0.5');
    expect(wrapper.find('.corr-meter__bar').classes()).toContain('corr-meter__bar--negative');
    expect(wrapper.find('.corr-meter__bar').attributes('style')).toContain('left: 25%');

    await wrapper.setProps({ correlation: 1.4 });
    expect(wrapper.find('.corr-meter__readout').text()).toBe('+1.00');
    expect(wrapper.attributes('aria-valuenow')).toBe('1');
  });

  it('Goniometer plots mid up and side across, DPR-aware', async () => {
    const calls: Array<[number, number]> = [];
    const ctx = {
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      fillRect: vi.fn((x: number, y: number) => calls.push([x, y])),
      fillStyle: '',
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
    };
    vi.stubGlobal('devicePixelRatio', 2);
    const wrapper = mount(Goniometer, {
      props: { mid: null, side: null, labels: { name: 'Phase scope' } },
    });
    const canvas = wrapper.find('canvas').element as HTMLCanvasElement;
    Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 100 });
    Object.defineProperty(canvas, 'clientHeight', { configurable: true, value: 100 });
    canvas.getContext = vi.fn(() => ctx) as unknown as typeof canvas.getContext;
    expect(wrapper.attributes('role')).toBe('img');

    // Mono full scale (mid = √2), then L only (mid = side = 1/√2).
    await wrapper.setProps({
      mid: Float32Array.of(Math.SQRT2, Math.SQRT1_2),
      side: Float32Array.of(0, Math.SQRT1_2),
    });
    frames.flush(0);
    expect(canvas.width).toBe(200);
    expect(ctx.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
    const [mono, leftOnly] = calls;
    expect(mono[0] + 0.75).toBeCloseTo(50, 5);
    expect(mono[1] + 0.75).toBeCloseTo(50 - 46, 5);
    expect(leftOnly[0] + 0.75).toBeLessThan(50);
    expect(leftOnly[1] + 0.75).toBeLessThan(50);
  });

  const spectrumLabels = { name: 'Spectrum', tilt: 'Tilt', traces: ['Out', 'In'] };
  const band = { id: 'b1', label: 'Band 1', freqHz: 1000, gainDb: 0 };

  it('SpectrumView renders without data and toggles the tilt', async () => {
    const wrapper = mount(SpectrumView, {
      props: { freqs: null, spectra: [null], labels: spectrumLabels },
    });
    expect(wrapper.find('canvas').attributes('aria-label')).toBe('Spectrum');
    const toggle = wrapper.find('.spectrum-view__toggle');
    expect(toggle.attributes('aria-pressed')).toBe('true');
    await toggle.trigger('click');
    expect(wrapper.emitted('update:tilt')?.at(-1)).toEqual([false]);
    expect(toggle.attributes('aria-pressed')).toBe('false');
    expect(wrapper.find('.spectrum-view__legend').exists()).toBe(false);
  });

  it('SpectrumView draws spectra with non-finite bins', async () => {
    const lineTo = vi.fn();
    const ctx = new Proxy({ lineTo } as Record<string, unknown>, {
      get: (target, key) => (key in target ? target[key as string] : vi.fn()),
      set: () => true,
    });
    const wrapper = mount(SpectrumView, {
      props: { freqs: null, spectra: [null, null], labels: spectrumLabels },
    });
    const canvas = wrapper.find('canvas').element as HTMLCanvasElement;
    Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 300 });
    Object.defineProperty(canvas, 'clientHeight', { configurable: true, value: 120 });
    canvas.getContext = vi.fn(() => ctx) as unknown as typeof canvas.getContext;

    const freqs = Float32Array.from({ length: 64 }, (_, i) => i * 400);
    const db = Float32Array.from({ length: 64 }, (_, i) =>
      i % 2 ? -40 : Number.NEGATIVE_INFINITY,
    );
    await wrapper.setProps({ freqs, spectra: [db, Float32Array.from(db)] });
    frames.flush(0);
    expect(lineTo).toHaveBeenCalled();
    for (const [x, y] of lineTo.mock.calls) {
      expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
    }
    expect(wrapper.findAll('.spectrum-view__legend li').map((li) => li.text())).toEqual([
      'Out',
      'In',
    ]);
  });

  it('SpectrumView band handles move by keyboard within the overlay range', async () => {
    const wrapper = mount(SpectrumView, {
      props: { freqs: null, spectra: [], bands: [band], labels: spectrumLabels },
    });
    const handle = wrapper.find('.spectrum-view__handle');
    expect(handle.attributes('role')).toBe('slider');
    expect(handle.attributes('aria-valuenow')).toBe('1000');
    expect(handle.attributes('aria-valuetext')).toBe('Band 1: 1.00 kHz, 0.0 dB');

    await handle.trigger('keydown', { key: 'ArrowRight' });
    await handle.trigger('keydown', { key: 'ArrowUp' });
    await handle.trigger('keydown', { key: 'Home' });
    await handle.trigger('keydown', { key: 'x' });
    const updates = wrapper.emitted('update:band')?.map(([u]) => u) ?? [];
    expect(updates).toHaveLength(3);
    expect(updates[0]).toMatchObject({ id: 'b1', gainDb: 0 });
    expect((updates[0] as { freqHz: number }).freqHz).toBeCloseTo(1000 * 2 ** (1 / 12), 6);
    expect(updates[1]).toEqual({ id: 'b1', freqHz: 1000, gainDb: 0.5 });
    expect(updates[2]).toEqual({ id: 'b1', freqHz: 20, gainDb: 0 });

    await wrapper.setProps({ bands: [{ ...band, gainDb: 18 }] });
    await wrapper.find('.spectrum-view__handle').trigger('keydown', { key: 'ArrowUp' });
    expect(wrapper.emitted('update:band')).toHaveLength(3);
  });

  it('SpectrumView band handles drag across the plot', async () => {
    const wrapper = mount(SpectrumView, {
      props: { freqs: null, spectra: [], bands: [band], labels: spectrumLabels },
    });
    const plot = wrapper.find('.spectrum-view__plot').element as HTMLElement;
    plot.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 300, height: 100, right: 300, bottom: 100 }) as DOMRect;
    const handle = wrapper.find('.spectrum-view__handle');
    const send = async (type: string, init: PointerEventInit) => {
      handle.element.dispatchEvent(new PointerEvent(type, { pointerId: 1, ...init }));
      await wrapper.vm.$nextTick();
    };
    await send('pointerdown', { clientX: 150, clientY: 50 });
    await send('pointermove', { clientX: 300, clientY: 25 });
    await send('pointerup', {});
    await send('pointermove', { clientX: 0, clientY: 0 });

    expect(wrapper.emitted('band-drag-start')).toEqual([['b1']]);
    expect(wrapper.emitted('band-drag-end')).toEqual([['b1']]);
    const updates = wrapper.emitted('update:band') ?? [];
    expect(updates).toHaveLength(1);
    const update = updates[0][0] as { freqHz: number; gainDb: number };
    expect(update.freqHz).toBeCloseTo(20000, 3);
    expect(update.gainDb).toBeCloseTo(9, 9);
  });
});
