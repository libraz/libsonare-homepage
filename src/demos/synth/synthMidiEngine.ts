import { SYNTH_CHANNEL, SYNTH_GROUP, type SynthMidiPushMethod } from '@/demos/synth/useSynthEngine';
import type { WebMidiEngine } from '@/wasm/web_midi';

/** The slice of the synth engine facade the MIDI proxy drives. */
export interface SynthMidiTarget {
  controlChange(controller: number, value: number): void;
  pushMidi(method: SynthMidiPushMethod, args: unknown[]): void;
}

/**
 * Main-thread stand-in for the audio-thread engine, handed to `bindWebMidi`.
 * Notes go through the demo's handlers (which light the on-screen keys); the
 * rest is forwarded to the engine over the worklet port.
 */
export function createSynthMidiEngine(
  target: SynthMidiTarget,
  keys: {
    noteOn(note: number, velocity: number): void;
    noteOff(note: number): void;
    /** Light or clear an on-screen key without sending anything to the engine. */
    mark(note: number, on: boolean): void;
  },
): WebMidiEngine {
  return {
    setMidiInputSource: () => {
      /* the worklet already bound the input source at startup */
    },
    clearMidiInputSource: () => {
      /* called by binding.close() on unmount; engine.dispose() handles the panic */
    },
    bindMidiCc: () => {
      /* no CC-to-parameter bindings in this demo */
    },
    pushMidiInputNoteOn: (_group, _channel, note, velocity) => keys.noteOn(note, velocity),
    pushMidiInputNoteOff: (_group, _channel, note) => keys.noteOff(note),
    pushMidiInputCc: (_group, _channel, controller, value) =>
      target.controlChange(controller, value),
    // Channel voice events land on the synth's own group/channel, like notes and CC.
    pushMidiInputPitchBend: (_group, _channel, bend14) =>
      target.pushMidi('pushMidiInputPitchBend', [SYNTH_GROUP, SYNTH_CHANNEL, bend14]),
    pushMidiInputChannelPressure: (_group, _channel, pressure) =>
      target.pushMidi('pushMidiInputChannelPressure', [SYNTH_GROUP, SYNTH_CHANNEL, pressure]),
    pushMidiInputPolyPressure: (_group, _channel, note, pressure) =>
      target.pushMidi('pushMidiInputPolyPressure', [SYNTH_GROUP, SYNTH_CHANNEL, note, pressure]),
    // The input destination is omni, so packets go through as they are; MIDI 2.0
    // note events (type 4, status 8/9) are decoded only to light the keys.
    pushMidiInputUmp: (words) => {
      const packet = Uint32Array.from(words);
      const type = packet[0] >>> 28;
      const status = (packet[0] >>> 20) & 15;
      if (type === 4 && (status === 8 || status === 9)) {
        keys.mark((packet[0] >>> 8) & 127, status === 9);
      }
      target.pushMidi('pushMidiInputUmp', [packet]);
    },
  };
}
