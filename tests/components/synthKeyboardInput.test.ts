import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { useSynthKeyboardInput } from '@/components/synth/useSynthKeyboardInput';

function keyEvent(key: string, init: KeyboardEventInit = {}) {
  return new KeyboardEvent('keydown', {
    key,
    cancelable: true,
    ...init,
  });
}

describe('useSynthKeyboardInput', () => {
  it('plays and releases mapped PC keyboard notes', () => {
    const noteOn = vi.fn();
    const noteOff = vi.fn();
    const input = useSynthKeyboardInput({
      isReady: ref(true),
      baseNote: ref(48),
      noteOn,
      noteOff,
      shiftOctave: vi.fn(),
    });

    input.onKeyDown(keyEvent('a'));
    input.onKeyDown(keyEvent('a'));
    input.onKeyUp(new KeyboardEvent('keyup', { key: 'a' }));

    expect(noteOn).toHaveBeenCalledTimes(1);
    expect(noteOn).toHaveBeenCalledWith(48);
    expect(noteOff).toHaveBeenCalledWith(48);
  });

  it('routes z and x to octave shifts', () => {
    const shiftOctave = vi.fn();
    const input = useSynthKeyboardInput({
      isReady: ref(true),
      baseNote: ref(48),
      noteOn: vi.fn(),
      noteOff: vi.fn(),
      shiftOctave,
    });

    input.onKeyDown(keyEvent('z'));
    input.onKeyDown(keyEvent('x'));

    expect(shiftOctave).toHaveBeenNthCalledWith(1, -1);
    expect(shiftOctave).toHaveBeenNthCalledWith(2, 1);
  });

  it('ignores unavailable synth state', () => {
    const noteOn = vi.fn();
    const input = useSynthKeyboardInput({
      isReady: ref(false),
      baseNote: ref(48),
      noteOn,
      noteOff: vi.fn(),
      shiftOctave: vi.fn(),
    });

    input.onKeyDown(keyEvent('a'));

    expect(noteOn).not.toHaveBeenCalled();
  });

  it('ignores typing targets', () => {
    const noteOn = vi.fn();
    const input = useSynthKeyboardInput({
      isReady: ref(true),
      baseNote: ref(48),
      noteOn,
      noteOff: vi.fn(),
      shiftOctave: vi.fn(),
    });
    const textInput = document.createElement('input');
    textInput.addEventListener('keydown', input.onKeyDown);

    textInput.dispatchEvent(keyEvent('a', { bubbles: true }));

    expect(noteOn).not.toHaveBeenCalled();
  });
});
