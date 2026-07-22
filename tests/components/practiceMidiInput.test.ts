import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { useMidiInput } from '@/components/practice/useMidiInput';

type MidiInputStub = {
  id: string;
  name?: string;
  onmidimessage: ((e: { data: Uint8Array }) => void) | null;
};
type MidiAccessStub = {
  inputs: Map<string, MidiInputStub>;
  onstatechange: ((e: unknown) => void) | null;
};

function makeInput(name?: string): MidiInputStub {
  return { id: name ?? 'i1', name, onmidimessage: null };
}
function makeAccess(inputs: MidiInputStub[]): MidiAccessStub {
  return { inputs: new Map(inputs.map((i) => [i.id, i])), onstatechange: null };
}

/** Mount a host component that exposes the composable API. */
function mountInput(opts: {
  onNoteOn?: (m: number, v: number) => void;
  onNoteOff?: (m: number) => void;
}) {
  let api!: ReturnType<typeof useMidiInput>;
  const Host = defineComponent({
    setup() {
      api = useMidiInput({
        onNoteOn: opts.onNoteOn ?? (() => {}),
        onNoteOff: opts.onNoteOff ?? (() => {}),
      });
      return () => h('div');
    },
  });
  const wrapper = mount(Host);
  return {
    wrapper,
    get api() {
      return api;
    },
  };
}

afterEach(() => {
  (navigator as { requestMIDIAccess?: unknown }).requestMIDIAccess = undefined;
  vi.restoreAllMocks();
});

describe('useMidiInput message decoding', () => {
  it('decodes note-on, note-off, and note-on-velocity-0 as note-off', async () => {
    const input = makeInput('Test KB');
    (navigator as { requestMIDIAccess?: unknown }).requestMIDIAccess = vi.fn(async () =>
      makeAccess([input]),
    );
    const onNoteOn = vi.fn();
    const onNoteOff = vi.fn();
    const { wrapper, api } = mountInput({ onNoteOn, onNoteOff });
    try {
      await api.connect();
      expect(api.connected.value).toBe(true);
      expect(api.devices.value).toEqual(['Test KB']);
      const send = (bytes: number[]) => input.onmidimessage?.({ data: new Uint8Array(bytes) });

      send([0x90, 60, 100]); // note-on
      expect(onNoteOn).toHaveBeenLastCalledWith(60, 100);
      send([0x95, 64, 80]); // note-on on channel 5 (status 0x95)
      expect(onNoteOn).toHaveBeenLastCalledWith(64, 80);
      send([0x80, 62, 40]); // note-off
      expect(onNoteOff).toHaveBeenLastCalledWith(62);
      send([0x90, 67, 0]); // note-on velocity 0 == note-off
      expect(onNoteOff).toHaveBeenLastCalledWith(67);
      expect(onNoteOn).toHaveBeenCalledTimes(2);
    } finally {
      wrapper.unmount();
    }
  });

  it('names attached devices and surfaces access errors', async () => {
    (navigator as { requestMIDIAccess?: unknown }).requestMIDIAccess = vi.fn(async () => {
      throw new Error('Permission denied');
    });
    const { wrapper, api } = mountInput({});
    try {
      await api.connect();
      expect(api.connected.value).toBe(false);
      expect(api.error.value).toBe('Permission denied');
    } finally {
      wrapper.unmount();
    }
  });

  it('does not bind inputs when disposed during the permission dialog (M-19)', async () => {
    const input = makeInput('Slow KB');
    let resolveAccess!: (a: MidiAccessStub) => void;
    (navigator as { requestMIDIAccess?: unknown }).requestMIDIAccess = vi.fn(
      () => new Promise<MidiAccessStub>((r) => (resolveAccess = r)),
    );
    const onNoteOn = vi.fn();
    const { wrapper, api } = mountInput({ onNoteOn });

    const pending = api.connect();
    // Leave the demo while the permission promise is still in flight.
    wrapper.unmount();
    resolveAccess(makeAccess([input]));
    await pending;

    // The listener must not have been attached, so late messages fire nothing.
    expect(input.onmidimessage).toBeNull();
    expect(api.connected.value).toBe(false);
  });
});
