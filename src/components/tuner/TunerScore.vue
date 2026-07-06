<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import type { PhraseNote } from '@/components/tuner/tunerMidi';

/**
 * Lightweight score view of the recorded/imported MIDI phrase. Engraving is
 * lazy (VexFlow is only imported when a phrase is present) and degrades
 * gracefully: a decode/engrave failure shows an "unavailable" note rather than
 * breaking the page. Durations are quantized to the nearest common note value
 * at the export tempo — this is a readable sketch of the phrase, not a
 * publication-grade engraving.
 */
const props = defineProps<{
  phrase: PhraseNote[];
  labels: {
    rendering: string;
    empty: string;
    unavailable: string;
  };
}>();

const host = ref<HTMLDivElement | null>(null);
const state = ref<'idle' | 'rendering' | 'ready' | 'empty' | 'error'>('empty');

const NOTE_NAMES = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];
const MAX_NOTES = 24;

/** MIDI note number to a VexFlow key such as `c#/4`. */
function midiToKey(midi: number): string {
  return `${NOTE_NAMES[midi % 12]}/${Math.floor(midi / 12) - 1}`;
}

/** Nearest common note value for a duration in quarter-note beats. */
function durationCode(beats: number): string {
  if (beats >= 3) return 'w';
  if (beats >= 1.5) return 'h';
  if (beats >= 0.75) return 'q';
  if (beats >= 0.375) return '8';
  return '16';
}

async function render(): Promise<void> {
  const el = host.value;
  if (!el) return;
  const phrase = props.phrase;
  if (phrase.length === 0) {
    el.replaceChildren();
    state.value = 'empty';
    return;
  }
  state.value = 'rendering';
  try {
    const VF = await import('vexflow');
    el.replaceChildren();
    const notes = phrase.slice(0, MAX_NOTES);
    const width = Math.max(320, el.clientWidth || 640);
    const height = 130;
    const renderer = new VF.Renderer(el, VF.Renderer.Backends.SVG);
    renderer.resize(width, height);
    const context = renderer.getContext();
    const stave = new VF.Stave(6, 18, width - 16);
    stave.addClef('treble');
    stave.setContext(context).draw();

    let totalBeats = 0;
    const staveNotes = notes.map((n) => {
      const beats = n.durSec * 2; // 120 BPM export tempo
      totalBeats += Math.max(0.25, Math.min(4, beats));
      return new VF.StaveNote({
        clef: 'treble',
        keys: [midiToKey(n.note)],
        duration: durationCode(beats),
      });
    });

    const voice = new VF.Voice({ numBeats: Math.max(1, Math.ceil(totalBeats)), beatValue: 4 });
    voice.setMode(VF.VoiceMode.SOFT).addTickables(staveNotes);
    new VF.Formatter().joinVoices([voice]).format([voice], width - 48);
    voice.draw(context, stave);
    state.value = 'ready';
  } catch {
    el.replaceChildren();
    state.value = 'error';
  }
}

onMounted(render);
watch(() => props.phrase, render, { deep: false });
</script>

<template>
  <div class="tn-score">
    <div ref="host" class="tn-score__host" :class="{ 'tn-score__host--hidden': state !== 'ready' }"></div>
    <p v-if="state === 'empty'" class="tn-score__note">{{ labels.empty }}</p>
    <p v-else-if="state === 'rendering'" class="tn-score__note">{{ labels.rendering }}</p>
    <p v-else-if="state === 'error'" class="tn-score__note">{{ labels.unavailable }}</p>
  </div>
</template>

<style scoped>
.tn-score {
  min-height: 90px;
  padding: 8px;
  border: 1px solid var(--demo-border);
  border-radius: 8px;
  background: var(--demo-screen-bg, #fff);
}

.tn-score__host {
  overflow-x: auto;
}

.tn-score__host :deep(svg) {
  display: block;
}

/* VexFlow renders in ink colors; keep the score panel light for legibility. */
.tn-score__host :deep(path),
.tn-score__host :deep(rect),
.tn-score__host :deep(text) {
  fill: #26211a;
  stroke: #26211a;
}

.tn-score__host--hidden {
  display: none;
}

.tn-score__note {
  margin: 0;
  padding: 24px 12px;
  text-align: center;
  color: var(--demo-text-muted);
  font-size: 12px;
}
</style>
