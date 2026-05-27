import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AudioTransport from '@/components/ui/AudioTransport.vue';

describe('AudioTransport', () => {
  let playSpy: ReturnType<typeof vi.spyOn>;
  let pauseSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    playSpy = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (
      this: HTMLMediaElement,
    ) {
      Object.defineProperty(this, 'paused', { configurable: true, value: false });
      this.dispatchEvent(new Event('play'));
      return Promise.resolve();
    });
    pauseSpy = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (
      this: HTMLMediaElement,
    ) {
      Object.defineProperty(this, 'paused', { configurable: true, value: true });
      this.dispatchEvent(new Event('pause'));
    });
  });

  afterEach(() => {
    playSpy.mockRestore();
    pauseSpy.mockRestore();
  });

  function mountTransport(src: string | null = 'blob:audio') {
    const wrapper = mount(AudioTransport, { props: { src } });
    const audio = wrapper.find('audio').element as HTMLAudioElement;
    Object.defineProperty(audio, 'duration', { configurable: true, value: 120 });
    Object.defineProperty(audio, 'currentTime', { configurable: true, writable: true, value: 0 });
    Object.defineProperty(audio, 'paused', { configurable: true, value: true });
    return { wrapper, audio };
  }

  it('starts disabled without a source and ignores playback controls', async () => {
    const { wrapper } = mountTransport(null);

    expect(wrapper.find('.transport').classes()).toContain('transport--disabled');
    expect(wrapper.find('.transport__play').attributes('disabled')).toBeDefined();
    expect(wrapper.find('.transport__range').attributes('disabled')).toBeDefined();

    await wrapper.find('.transport__play').trigger('click');
    (wrapper.vm as any).togglePlayback();
    expect(playSpy).not.toHaveBeenCalled();
  });

  it('loads metadata, plays, pauses, seeks and emits progress', async () => {
    const { wrapper, audio } = mountTransport();

    await wrapper.find('audio').trigger('loadedmetadata');
    expect(wrapper.text()).toContain('2:00');
    expect(wrapper.emitted('progress')?.at(-1)).toEqual([0]);

    await wrapper.find('.transport__play').trigger('click');
    expect(playSpy).toHaveBeenCalledTimes(1);
    expect(wrapper.find('.transport__play').attributes('aria-label')).toBe('Pause');

    await wrapper.find('.transport__play').trigger('click');
    expect(pauseSpy).toHaveBeenCalledTimes(1);
    expect(wrapper.find('.transport__play').attributes('aria-label')).toBe('Play');

    await wrapper.find('.transport__range').setValue('30');
    expect(audio.currentTime).toBe(30);
    expect(wrapper.text()).toContain('0:30');
    expect(wrapper.emitted('progress')?.at(-1)).toEqual([0.25]);

    audio.currentTime = 45;
    await wrapper.find('audio').trigger('timeupdate');
    expect(wrapper.text()).toContain('0:45');
    expect(wrapper.find('.transport__fill').attributes('style')).toContain('width: 37.5%');
    expect(wrapper.emitted('progress')?.at(-1)).toEqual([0.375]);
  });

  it('supports exposed seekFraction, setVolume and togglePlayback methods', async () => {
    const { wrapper, audio } = mountTransport();
    await wrapper.find('audio').trigger('loadedmetadata');

    (wrapper.vm as any).seekFraction(1.5);
    await wrapper.vm.$nextTick();
    expect(audio.currentTime).toBe(120);
    expect(wrapper.emitted('progress')?.at(-1)).toEqual([1]);

    (wrapper.vm as any).seekFraction(-1);
    await wrapper.vm.$nextTick();
    expect(audio.currentTime).toBe(0);
    expect(wrapper.emitted('progress')?.at(-1)).toEqual([0]);

    (wrapper.vm as any).setVolume(0.35);
    expect(audio.volume).toBe(0.35);

    (wrapper.vm as any).togglePlayback();
    expect(playSpy).toHaveBeenCalledTimes(1);
  });

  it('preserves playhead and playback state across source swaps', async () => {
    const { wrapper, audio } = mountTransport('blob:a');
    await wrapper.find('audio').trigger('loadedmetadata');

    await wrapper.find('.transport__range').setValue('90');
    await wrapper.find('.transport__play').trigger('click');
    expect(playSpy).toHaveBeenCalledTimes(1);

    await wrapper.setProps({ src: 'blob:b' });
    Object.defineProperty(audio, 'duration', { configurable: true, value: 60 });
    await wrapper.find('audio').trigger('loadedmetadata');

    expect(audio.currentTime).toBe(60);
    expect(playSpy).toHaveBeenCalledTimes(2);
    expect(wrapper.emitted('progress')?.at(-1)).toEqual([1]);
  });

  it('resets playback state when media ends', async () => {
    const { wrapper, audio } = mountTransport();
    await wrapper.find('audio').trigger('loadedmetadata');
    await wrapper.find('.transport__play').trigger('click');

    audio.currentTime = 120;
    await wrapper.find('audio').trigger('ended');

    expect(wrapper.find('.transport__play').attributes('aria-label')).toBe('Play');
    expect(wrapper.text()).toContain('0:00');
    expect(wrapper.emitted('progress')?.at(-1)).toEqual([0]);
  });
});
