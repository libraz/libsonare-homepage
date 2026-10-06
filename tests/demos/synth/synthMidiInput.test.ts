// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSynthMidiEngine } from '@/demos/synth/synthMidiEngine';
import {
  buildSynthProcessorSource,
  SYNTH_CHANNEL,
  SYNTH_GROUP,
  SYNTH_MIDI_PUSH_METHODS,
} from '@/demos/synth/useSynthEngine';
import { bindWebMidi } from '@/wasm/index.js';

type Listener = (event: { data: ArrayLike<number> }) => void;

/** One mock input port reachable through `navigator.requestMIDIAccess`. */
function installMidi(): { send: (data: ArrayLike<number>) => void } {
  let listener: Listener | null = null;
  const input = {
    id: 'in0',
    name: 'mock',
    state: 'connected' as const,
    onmidimessage: null as Listener | null,
    addEventListener: (_type: string, l: Listener) => {
      listener = l;
    },
    removeEventListener: () => {
      listener = null;
    },
  };
  const access = { inputs: new Map([['in0', input]]), onstatechange: null };
  vi.stubGlobal('navigator', { requestMIDIAccess: async () => access });
  return { send: (data) => listener?.({ data }) };
}

function setup() {
  const pushMidi = vi.fn();
  const controlChange = vi.fn();
  const noteOn = vi.fn();
  const noteOff = vi.fn();
  const mark = vi.fn();
  const proxy = createSynthMidiEngine({ controlChange, pushMidi }, { noteOn, noteOff, mark });
  return { proxy, pushMidi, controlChange, noteOn, noteOff, mark };
}

afterEach(() => vi.unstubAllGlobals());

describe('/synth MIDI input', () => {
  it('forwards pitch bend and pressure to the engine on the synth channel', async () => {
    const port = installMidi();
    const { proxy, pushMidi } = setup();
    await bindWebMidi(proxy);
    port.send([0xe3, 0x00, 0x40]); // bend, channel 3, centre
    port.send([0xd3, 50]);
    port.send([0xa3, 60, 70]);
    expect(pushMidi.mock.calls).toEqual([
      ['pushMidiInputPitchBend', [SYNTH_GROUP, SYNTH_CHANNEL, 8192]],
      ['pushMidiInputChannelPressure', [SYNTH_GROUP, SYNTH_CHANNEL, 50]],
      ['pushMidiInputPolyPressure', [SYNTH_GROUP, SYNTH_CHANNEL, 60, 70]],
    ]);
  });

  it('routes a MIDI 2.0 UMP packet to pushMidiInputUmp', async () => {
    const port = installMidi();
    const { proxy, pushMidi } = setup();
    await bindWebMidi(proxy);
    port.send(Uint32Array.of(0x40903c00, 0xc0000000)); // MIDI 2.0 note on, note 60
    expect(pushMidi).toHaveBeenCalledTimes(1);
    const [method, args] = pushMidi.mock.calls[0];
    expect(method).toBe('pushMidiInputUmp');
    expect(Array.from(args[0] as Uint32Array)).toEqual([0x40903c00, 0xc0000000]);
  });

  it('passes a UMP packet on unchanged and lights the key for a MIDI 2.0 note', async () => {
    const port = installMidi();
    const { proxy, pushMidi, mark, noteOn } = setup();
    await bindWebMidi(proxy);
    port.send(Uint32Array.of(0x41953c00, 0xc0000000)); // group 1, channel 5, note 60 on
    port.send(Uint32Array.of(0x41853c00, 0)); // same, note off
    expect(mark.mock.calls).toEqual([
      [60, true],
      [60, false],
    ]);
    expect(pushMidi).toHaveBeenCalledTimes(2);
    expect(Array.from(pushMidi.mock.calls[0][1][0] as Uint32Array)).toEqual([
      0x41953c00, 0xc0000000,
    ]);
    expect(noteOn).not.toHaveBeenCalled();
  });

  it('keeps note and CC on the keyboard and CC paths', async () => {
    const port = installMidi();
    const { proxy, pushMidi, controlChange, noteOn, noteOff } = setup();
    await bindWebMidi(proxy);
    port.send([0x90, 60, 100]);
    port.send([0x80, 60, 0]);
    port.send([0xb0, 1, 64]);
    expect(noteOn).toHaveBeenCalledWith(60, 100);
    expect(noteOff).toHaveBeenCalledWith(60);
    expect(controlChange).toHaveBeenCalledWith(1, 64);
    expect(pushMidi).not.toHaveBeenCalled();
  });

  it('runs only the allow-listed engine methods in the worklet', () => {
    const source = buildSynthProcessorSource('/wasm/sonare.js');
    expect(source).toContain(`const MIDI_PUSH = ${JSON.stringify(SYNTH_MIDI_PUSH_METHODS)};`);
    expect(source).toContain("msg.type === 'midi'");
    expect(source).toContain(
      'MIDI_PUSH.includes(msg.method)) this.engine[msg.method](...msg.args)',
    );
  });
});
