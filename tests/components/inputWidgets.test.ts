import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

const lang = ref('en');
vi.mock('vitepress', () => ({ useData: () => ({ lang }) }));

import DropZone from '@/components/DropZone.vue';
import MasterKnob from '@/components/MasterKnob.vue';
import TransportButton from '@/components/ui/TransportButton.vue';

function fileList(files: File[]): FileList {
  return {
    length: files.length,
    item: (index: number) => files[index] ?? null,
    ...Object.fromEntries(files.map((file, index) => [index, file])),
  } as unknown as FileList;
}

describe('DropZone', () => {
  it('emits valid dropped audio files and ignores unsupported files', async () => {
    const wrapper = mount(DropZone);
    const valid = new File(['audio'], 'song.wav', { type: 'audio/wav' });
    const invalid = new File(['text'], 'notes.txt', { type: 'text/plain' });

    await wrapper.find('.dropzone').trigger('dragenter');
    expect(wrapper.find('.dropzone').classes()).toContain('dropzone--dragging');

    await wrapper.find('.dropzone').trigger('drop', {
      dataTransfer: { files: fileList([valid]) },
    });
    expect(wrapper.emitted('file')?.[0]).toEqual([valid]);
    expect(wrapper.find('.dropzone').classes()).not.toContain('dropzone--dragging');

    await wrapper.find('.dropzone').trigger('drop', {
      dataTransfer: { files: fileList([invalid]) },
    });
    expect(wrapper.emitted('file')).toHaveLength(1);
  });

  it('opens hidden input on click and emits selected files without type filtering', async () => {
    const wrapper = mount(DropZone);
    const input = wrapper.find('input[type="file"]');
    const click = vi
      .spyOn(input.element as HTMLInputElement, 'click')
      .mockImplementation(() => undefined);

    await wrapper.find('.dropzone').trigger('click');
    expect(click).toHaveBeenCalled();

    const file = new File(['raw'], 'field-recording.raw', { type: 'application/octet-stream' });
    Object.defineProperty(input.element, 'files', {
      configurable: true,
      value: fileList([file]),
    });
    await input.trigger('change');
    expect(wrapper.emitted('file')?.[0]).toEqual([file]);
  });

  it('tracks hover and drag leave classes', async () => {
    const wrapper = mount(DropZone);

    await wrapper.find('.dropzone').trigger('mouseenter');
    expect(wrapper.find('.dropzone').classes()).toContain('dropzone--hover');

    await wrapper.find('.dropzone').trigger('mouseleave');
    expect(wrapper.find('.dropzone').classes()).not.toContain('dropzone--hover');

    await wrapper.find('.dropzone').trigger('dragenter');
    await wrapper.find('.dropzone').trigger('dragleave');
    expect(wrapper.find('.dropzone').classes()).not.toContain('dropzone--dragging');
  });
});

describe('MasterKnob', () => {
  function mountKnob(props: Partial<InstanceType<typeof MasterKnob>['$props']> = {}) {
    const wrapper = mount(MasterKnob, {
      props: {
        modelValue: 0,
        min: -12,
        max: 12,
        step: 0.5,
        label: 'Gain',
        unit: 'dB',
        ...props,
      },
    });
    const track = wrapper.find('.fader__track').element as HTMLElement;
    Object.defineProperty(track, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 10, width: 100, top: 0, height: 36, right: 110, bottom: 36 }),
    });
    track.setPointerCapture = vi.fn();
    track.releasePointerCapture = vi.fn();
    return wrapper;
  }

  it('renders slider aria state and emits pointer, wheel and keyboard changes', async () => {
    const wrapper = mountKnob();
    const track = wrapper.find('.fader__track');

    expect(track.attributes('role')).toBe('slider');
    expect(track.attributes('aria-label')).toBe('Gain');
    expect(track.attributes('aria-valuetext')).toBe('0.0 dB');

    track.element.dispatchEvent(new PointerEvent('pointerdown', { clientX: 110, pointerId: 1 }));
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([12]);

    await wrapper.setProps({ modelValue: 0 });
    await track.trigger('wheel', { deltaY: -1 });
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([0.5]);

    await track.trigger('keydown', { key: 'ArrowLeft' });
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([-0.5]);

    await track.trigger('keydown', { key: 'End' });
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([12]);
  });

  it('supports bipolar double-click reset and typed value editing', async () => {
    const wrapper = mountKnob({ modelValue: 5 });
    const track = wrapper.find('.fader__track');

    await track.trigger('dblclick');
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([0]);

    await wrapper.find('.fader__readout').trigger('click');
    await flushPromises();
    const input = wrapper.find('input');
    expect(input.exists()).toBe(true);
    await input.setValue('3.75');
    await input.trigger('keydown', { key: 'Enter' });
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([4]);
  });

  it('clamps unipolar controls and uses midpoint reset', async () => {
    const wrapper = mountKnob({ modelValue: 50, min: 0, max: 100, step: 1, unit: '%' });
    const track = wrapper.find('.fader__track');

    await track.trigger('keydown', { key: 'PageUp' });
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([60]);

    await wrapper.setProps({ modelValue: 95 });
    await track.trigger('keydown', { key: 'PageUp' });
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([100]);

    await wrapper.setProps({ modelValue: 90 });
    await track.trigger('dblclick');
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([50]);
  });
});

describe('TransportButton', () => {
  it('renders slot content, variant classes and emits clicks', async () => {
    const wrapper = mount(TransportButton, {
      props: { variant: 'primary', size: 'lg', round: true },
      slots: { default: 'PLAY' },
    });

    expect(wrapper.text()).toBe('PLAY');
    expect(wrapper.classes()).toEqual(
      expect.arrayContaining([
        'transport-btn--primary',
        'transport-btn--lg',
        'transport-btn--round',
      ]),
    );

    await wrapper.trigger('click');
    expect(wrapper.emitted('click')).toHaveLength(1);
  });

  it('does not emit clicks while disabled', async () => {
    const wrapper = mount(TransportButton, {
      props: { disabled: true },
      slots: { default: 'STOP' },
    });

    expect(wrapper.attributes('disabled')).toBeDefined();
    expect(wrapper.classes()).toContain('transport-btn--disabled');
    await wrapper.trigger('click');
    expect(wrapper.emitted('click')).toBeUndefined();
  });
});
