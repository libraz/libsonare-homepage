/**
 * Web MIDI input for the Piano Practice game.
 *
 * Connects to physical MIDI keyboards via the Web MIDI API and forwards their
 * note-on / note-off messages to the caller, so a learner can play the falling
 * notes on real hardware and be scored. Everything is optional and lazily
 * requested: nothing touches `navigator.requestMIDIAccess` until `connect()` is
 * called from a user gesture, and the demo stays fully usable (on-screen
 * keyboard, mouse, touch) when no device or no Web MIDI support is present.
 */
import { onBeforeUnmount, ref } from 'vue';

interface MidiInputOptions {
  /** Called on a note-on (velocity > 0). Velocity is 1–127. */
  onNoteOn: (midi: number, velocity: number) => void;
  /** Called on a note-off (or note-on with velocity 0). */
  onNoteOff: (midi: number) => void;
}

// Minimal Web MIDI typing — the lib.dom types are not guaranteed in scope.
type MidiAccessLike = {
  inputs: Map<string, MidiInputLike>;
  onstatechange: ((e: unknown) => void) | null;
};
type MidiInputLike = {
  id: string;
  name?: string;
  onmidimessage: ((e: { data: Uint8Array }) => void) | null;
};

export function useMidiInput(options: MidiInputOptions) {
  /** Whether the browser exposes the Web MIDI API at all. */
  const supported =
    typeof navigator !== 'undefined' &&
    typeof (navigator as { requestMIDIAccess?: unknown }).requestMIDIAccess === 'function';
  /** True once access is granted and at least the access object is held. */
  const connected = ref(false);
  /** Connection request in flight. */
  const connecting = ref(false);
  /** Names of the currently attached input devices. */
  const devices = ref<string[]>([]);
  /** A permission / availability error message, if the request failed. */
  const error = ref('');

  let access: MidiAccessLike | null = null;

  function handleMessage(e: { data: Uint8Array }): void {
    const [status, note, velocity] = e.data;
    const type = status & 0xf0;
    if (type === 0x90 && velocity > 0) options.onNoteOn(note, velocity);
    else if (type === 0x80 || (type === 0x90 && velocity === 0)) options.onNoteOff(note);
  }

  function bindInputs(): void {
    if (!access) return;
    const names: string[] = [];
    for (const input of access.inputs.values()) {
      input.onmidimessage = handleMessage;
      names.push(input.name || 'MIDI device');
    }
    devices.value = names;
    connected.value = names.length > 0;
  }

  /** Request Web MIDI access (must be triggered by a user gesture). */
  async function connect(): Promise<void> {
    if (!supported || connecting.value) return;
    connecting.value = true;
    error.value = '';
    try {
      access = (await (
        navigator as { requestMIDIAccess: (opts?: unknown) => Promise<MidiAccessLike> }
      ).requestMIDIAccess({ sysex: false })) as MidiAccessLike;
      access.onstatechange = bindInputs;
      bindInputs();
      // Access is granted even with zero devices plugged in; reflect that the
      // listener is live so the UI can prompt to connect a keyboard.
      connected.value = true;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'MIDI access was denied.';
      connected.value = false;
    } finally {
      connecting.value = false;
    }
  }

  function disconnect(): void {
    if (access) {
      for (const input of access.inputs.values()) input.onmidimessage = null;
      access.onstatechange = null;
    }
    access = null;
    connected.value = false;
    devices.value = [];
  }

  onBeforeUnmount(disconnect);

  return { supported, connected, connecting, devices, error, connect, disconnect };
}
