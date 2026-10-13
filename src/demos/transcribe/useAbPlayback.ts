/**
 * Plays the source and the rendered piano on one clock, so switching what you
 * hear changes two gains and never the position.
 *
 * Both buffers always run while playing; the listen mode only sets their
 * levels. A piano render that lands mid-playback replaces the piano voice at
 * the current position.
 */
import { onBeforeUnmount, ref, shallowRef } from 'vue';
import type { ListenMode } from './transcribeCopy';

const LEVELS: Record<ListenMode, [source: number, piano: number]> = {
  source: [1, 0],
  piano: [0, 1],
  both: [0.7, 0.7],
};
/** Gain glide on a listen switch, in seconds (time constant). */
const GLIDE = 0.015;

export function useAbPlayback() {
  const isPlaying = ref(false);
  const position = ref(0);
  const mode = ref<ListenMode>('source');
  const duration = ref(0);
  const context = shallowRef<AudioContext | null>(null);

  let sourceBuffer: AudioBuffer | null = null;
  let pianoBuffer: AudioBuffer | null = null;
  let sourceNode: AudioBufferSourceNode | null = null;
  let pianoNode: AudioBufferSourceNode | null = null;
  let sourceGain: GainNode | null = null;
  let pianoGain: GainNode | null = null;
  /** Context time at which position 0 would have played. */
  let origin = 0;
  let frame = 0;

  function ensureContext(): AudioContext {
    if (!context.value) {
      const ctx = new AudioContext();
      sourceGain = ctx.createGain();
      pianoGain = ctx.createGain();
      sourceGain.connect(ctx.destination);
      pianoGain.connect(ctx.destination);
      context.value = ctx;
      applyLevels(true);
    }
    return context.value;
  }

  function applyLevels(immediate = false): void {
    const ctx = context.value;
    if (!ctx || !sourceGain || !pianoGain) return;
    const [source, piano] = LEVELS[mode.value];
    if (immediate) {
      sourceGain.gain.value = source;
      pianoGain.gain.value = piano;
      return;
    }
    sourceGain.gain.setTargetAtTime(source, ctx.currentTime, GLIDE);
    pianoGain.gain.setTargetAtTime(piano, ctx.currentTime, GLIDE);
  }

  function startNode(
    buffer: AudioBuffer,
    gain: GainNode,
    at: number,
    offset: number,
  ): AudioBufferSourceNode | null {
    if (offset >= buffer.duration) return null;
    const ctx = ensureContext();
    const node = ctx.createBufferSource();
    node.buffer = buffer;
    node.connect(gain);
    node.start(at, offset);
    return node;
  }

  function stopNode(node: AudioBufferSourceNode | null): void {
    if (!node) return;
    node.onended = null;
    try {
      node.stop();
    } catch {
      // Already stopped.
    }
    node.disconnect();
  }

  function tick(): void {
    frame = 0;
    const ctx = context.value;
    if (!isPlaying.value || !ctx) return;
    const now = ctx.currentTime - origin;
    if (now >= duration.value) {
      pause();
      position.value = duration.value;
      return;
    }
    position.value = now;
    frame = requestAnimationFrame(tick);
  }

  async function play(): Promise<void> {
    if (isPlaying.value || !sourceBuffer) return;
    const ctx = ensureContext();
    await ctx.resume();
    if (position.value >= duration.value) position.value = 0;
    const at = ctx.currentTime + 0.02;
    origin = at - position.value;
    sourceNode = startNode(sourceBuffer, sourceGain as GainNode, at, position.value);
    if (pianoBuffer) pianoNode = startNode(pianoBuffer, pianoGain as GainNode, at, position.value);
    isPlaying.value = true;
    frame = requestAnimationFrame(tick);
  }

  function pause(): void {
    const ctx = context.value;
    if (isPlaying.value && ctx) position.value = Math.min(duration.value, ctx.currentTime - origin);
    stopNode(sourceNode);
    stopNode(pianoNode);
    sourceNode = null;
    pianoNode = null;
    isPlaying.value = false;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  }

  function seek(sec: number): void {
    const wasPlaying = isPlaying.value;
    pause();
    position.value = Math.max(0, Math.min(duration.value, sec));
    if (wasPlaying) void play();
  }

  function setMode(next: ListenMode): void {
    mode.value = next;
    applyLevels();
  }

  /** A new recording: stops playback and returns to the start. */
  function setSource(buffer: AudioBuffer): void {
    pause();
    sourceBuffer = buffer;
    pianoBuffer = null;
    duration.value = buffer.duration;
    position.value = 0;
  }

  /** A new piano render; swapped in at the current position while playing. */
  function setPiano(pcm: Float32Array | null): void {
    const ctx = context.value;
    if (!pcm || !ctx) {
      pianoBuffer = null;
      stopNode(pianoNode);
      pianoNode = null;
      return;
    }
    const buffer = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
    buffer.copyToChannel(pcm as Float32Array<ArrayBuffer>, 0);
    pianoBuffer = buffer;
    if (!isPlaying.value || !pianoGain) return;
    stopNode(pianoNode);
    const at = ctx.currentTime + 0.02;
    pianoNode = startNode(buffer, pianoGain, at, at - origin);
  }

  onBeforeUnmount(() => {
    pause();
    if (context.value) void context.value.close();
    context.value = null;
  });

  return {
    isPlaying,
    position,
    mode,
    duration,
    context,
    ensureContext,
    play,
    pause,
    seek,
    setMode,
    setSource,
    setPiano,
  };
}
