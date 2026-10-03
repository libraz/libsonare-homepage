import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import EngineTransport, { formatTransportTime } from '@/components/ui/EngineTransport.vue';

const labels = {
  play: 'Play',
  stop: 'Stop',
  toHome: 'To start',
  loop: 'Loop',
  seek: 'Position',
  loopStart: 'Loop start',
  loopEnd: 'Loop end',
};

async function pointer(el: Element, type: string, init: PointerEventInit) {
  el.dispatchEvent(new PointerEvent(type, { bubbles: true, button: 0, ...init }));
  await nextTick();
}

function mountTransport(overrides: Record<string, unknown> = {}) {
  return mount(EngineTransport, {
    props: {
      playing: false,
      position: 75.5,
      duration: 120,
      loop: { enabled: false, start: 10, end: 20 },
      labels,
      ...overrides,
    },
  });
}

describe('EngineTransport', () => {
  it('formats time as mm:ss.mmm', () => {
    expect(formatTransportTime(75.5)).toBe('01:15.500');
    expect(formatTransportTime(3725.2504)).toBe('62:05.250');
    expect(formatTransportTime(59.9996)).toBe('01:00.000');
    expect(formatTransportTime(Number.NaN)).toBe('00:00.000');
    expect(formatTransportTime(-3)).toBe('00:00.000');
  });

  it('shows position and duration and no hardcoded visible copy', () => {
    const wrapper = mountTransport();
    const times = wrapper.findAll('.engine-transport__time').map((t) => t.text());
    expect(times).toEqual(['01:15.500', '02:00.000']);
    expect(wrapper.text()).toBe(times.join(''));
  });

  it('emits play, stop, toHome and toggleLoop from its buttons', async () => {
    const wrapper = mountTransport();
    const [home, play, loop] = wrapper.findAll('button');
    expect(play.attributes('aria-label')).toBe('Play');
    await play.trigger('click');
    expect(wrapper.emitted('play')).toHaveLength(1);

    await wrapper.setProps({ playing: true });
    expect(play.attributes('aria-label')).toBe('Stop');
    await play.trigger('click');
    expect(wrapper.emitted('stop')).toHaveLength(1);

    await home.trigger('click');
    expect(wrapper.emitted('toHome')).toHaveLength(1);

    expect(loop.attributes('aria-pressed')).toBe('false');
    await loop.trigger('click');
    expect(wrapper.emitted('toggleLoop')).toHaveLength(1);
    await wrapper.setProps({ loop: { enabled: true, start: 10, end: 20 } });
    expect(loop.attributes('aria-pressed')).toBe('true');
  });

  it('exposes the playhead as an ARIA slider driven by the keyboard', async () => {
    const wrapper = mountTransport();
    const seek = wrapper.find('[aria-label="Position"]');
    expect(seek.attributes('role')).toBe('slider');
    expect(seek.attributes('tabindex')).toBe('0');
    expect(seek.attributes('aria-valuemin')).toBe('0');
    expect(seek.attributes('aria-valuemax')).toBe('120');
    expect(seek.attributes('aria-valuenow')).toBe('75.5');
    expect(seek.attributes('aria-valuetext')).toBe('01:15.500');

    for (const key of ['ArrowRight', 'ArrowLeft', 'PageUp', 'PageDown', 'Home', 'End', 'a']) {
      await seek.trigger('keydown', { key });
    }
    expect(wrapper.emitted('seek')).toEqual([[76.5], [74.5], [85.5], [65.5], [0], [120]]);

    await wrapper.setProps({ position: 115 });
    await seek.trigger('keydown', { key: 'PageUp' });
    expect(wrapper.emitted('seek')?.at(-1)).toEqual([120]);
  });

  it('moves loop edges by keyboard without crossing each other', async () => {
    const wrapper = mountTransport();
    const start = wrapper.find('[aria-label="Loop start"]');
    const end = wrapper.find('[aria-label="Loop end"]');
    expect(start.attributes('role')).toBe('slider');
    expect(end.attributes('aria-valuetext')).toBe('00:20.000');

    await start.trigger('keydown', { key: 'ArrowRight' });
    await start.trigger('keydown', { key: 'End' });
    await end.trigger('keydown', { key: 'Home' });
    await end.trigger('keydown', { key: 'End' });
    const updates = wrapper.emitted('update:loop')?.map(([l]) => l) ?? [];
    expect(updates[0]).toEqual({ enabled: false, start: 11, end: 20 });
    expect(updates[1]).toMatchObject({ start: 19.9, end: 20 });
    expect(updates[2]).toMatchObject({ start: 10, end: 10.1 });
    expect(updates[3]).toEqual({ enabled: false, start: 10, end: 120 });
  });

  it('seeks and drags loop edges with the pointer', async () => {
    const wrapper = mountTransport();
    const timeline = wrapper.find('.engine-transport__timeline');
    (timeline.element as HTMLElement).getBoundingClientRect = () =>
      ({ left: 100, top: 0, width: 400, height: 34, right: 500, bottom: 34 }) as DOMRect;

    await pointer(timeline.element, 'pointerdown', { pointerId: 1, clientX: 200 });
    await pointer(timeline.element, 'pointermove', { pointerId: 1, clientX: 300 });
    await pointer(timeline.element, 'pointerup', { pointerId: 1 });
    await pointer(timeline.element, 'pointermove', { pointerId: 1, clientX: 400 });
    expect(wrapper.emitted('seek')).toEqual([[30], [60]]);

    const loopEnd = wrapper.find('[aria-label="Loop end"]').element;
    await pointer(loopEnd, 'pointerdown', { pointerId: 2, clientX: 300 });
    expect(wrapper.emitted('seek')).toHaveLength(2);
    expect(wrapper.emitted('update:loop')?.at(-1)).toEqual([
      { enabled: false, start: 10, end: 60 },
    ]);
  });

  it('ignores every input while disabled', async () => {
    const wrapper = mountTransport({ disabled: true });
    for (const button of wrapper.findAll('button')) {
      expect(button.attributes('disabled')).toBeDefined();
    }
    const seek = wrapper.find('[aria-label="Position"]');
    expect(seek.attributes('tabindex')).toBe('-1');
    expect(seek.attributes('aria-disabled')).toBe('true');
    await seek.trigger('keydown', { key: 'ArrowRight' });
    await wrapper.find('[aria-label="Loop start"]').trigger('keydown', { key: 'ArrowRight' });
    await pointer(wrapper.find('.engine-transport__timeline').element, 'pointerdown', {
      clientX: 5,
    });
    expect(wrapper.emitted('seek')).toBeUndefined();
    expect(wrapper.emitted('update:loop')).toBeUndefined();
  });

  it('clamps seeks to an empty programme', async () => {
    const wrapper = mountTransport({ duration: 0, position: 0 });
    const seek = wrapper.find('[aria-label="Position"]');
    expect(seek.attributes('aria-valuemax')).toBe('0');
    await seek.trigger('keydown', { key: 'ArrowRight' });
    expect(wrapper.emitted('seek')).toEqual([[0]]);
  });
});
