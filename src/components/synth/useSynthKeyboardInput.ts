import type { Ref } from 'vue';
import { KEY_LAYOUT } from '@/components/synth/synthCopy';

type NoteHandler = (note: number) => void;

export interface SynthKeyboardInputOptions {
  isReady: Ref<boolean>;
  baseNote: Ref<number>;
  noteOn: NoteHandler;
  noteOff: NoteHandler;
  shiftOctave: (direction: -1 | 1) => void;
}

const pcKeyToSemitone = new Map<string, number>(
  KEY_LAYOUT.filter((key) => key.pc !== undefined).map((key) => [key.pc as string, key.semitone]),
);

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName);
}

export function useSynthKeyboardInput(options: SynthKeyboardInputOptions) {
  const heldPcNotes = new Map<string, number>();

  function onKeyDown(event: KeyboardEvent) {
    if (
      !options.isReady.value ||
      event.repeat ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      isTypingTarget(event.target)
    ) {
      return;
    }

    const key = event.key.toLowerCase();
    if (key === 'z') {
      options.shiftOctave(-1);
      event.preventDefault();
      return;
    }
    if (key === 'x') {
      options.shiftOctave(1);
      event.preventDefault();
      return;
    }

    const semitone = pcKeyToSemitone.get(key);
    if (semitone === undefined || heldPcNotes.has(key)) return;
    const note = options.baseNote.value + semitone;
    heldPcNotes.set(key, note);
    options.noteOn(note);
    event.preventDefault();
  }

  function onKeyUp(event: KeyboardEvent) {
    const key = event.key.toLowerCase();
    const note = heldPcNotes.get(key);
    if (note === undefined) return;
    heldPcNotes.delete(key);
    options.noteOff(note);
  }

  function releaseHeldPcNotes() {
    heldPcNotes.clear();
  }

  return {
    onKeyDown,
    onKeyUp,
    releaseHeldPcNotes,
  };
}
