import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { KEY_GEOMETRY, KEY_GEOMETRY_STYLE, whiteKeyWidth } from '@/components/keyboard/keyGeometry';
import SynthKeyboard from '@/components/keyboard/SynthKeyboard.vue';

describe('shared key geometry', () => {
  it('clamps the white-key width to the shared range', () => {
    expect(whiteKeyWidth(2000, 15)).toBe(KEY_GEOMETRY.whiteMaxPx);
    expect(whiteKeyWidth(150, 15)).toBe(KEY_GEOMETRY.whiteMinPx);
    expect(whiteKeyWidth(15 * 27, 15)).toBe(27);
  });

  it('keeps black keys narrower and shorter than white keys', () => {
    expect(KEY_GEOMETRY.blackWidthRatio).toBeGreaterThan(0.5);
    expect(KEY_GEOMETRY.blackWidthRatio).toBeLessThan(0.65);
    expect(KEY_GEOMETRY.blackLengthRatio).toBeGreaterThan(0.55);
    expect(KEY_GEOMETRY.blackLengthRatio).toBeLessThan(0.7);
  });

  it('hands the geometry to the keyboard as CSS custom properties', () => {
    const wrapper = mount(SynthKeyboard, { props: { baseNote: 48, active: new Set<number>() } });
    const style = wrapper.find('.synth-keyboard').attributes('style') ?? '';
    for (const [name, value] of Object.entries(KEY_GEOMETRY_STYLE)) {
      expect(style).toContain(`${name}: ${value}`);
    }
    wrapper.unmount();
  });

  it('names keys by pitch rather than by MIDI number', () => {
    const wrapper = mount(SynthKeyboard, { props: { baseNote: 48, active: new Set<number>() } });
    const labels = wrapper
      .findAll('.synth-keyboard__white')
      .map((key) => key.attributes('aria-label'));
    expect(labels[0]).toMatch(/^C\d$/);
    wrapper.unmount();
  });
});
