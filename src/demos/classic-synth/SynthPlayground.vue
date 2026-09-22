<script setup lang="ts">
/**
 * The last chapter: free editing, presets, and the way a voice leaves the page.
 *
 * Unlike every earlier chapter, this component edits nothing of the voice
 * itself — every control already lives on the deck above. What
 * belongs here is what only makes sense at the end: loading a preset wholesale,
 * returning to the starting patch, and turning the voice a reader has built
 * into a file.
 *
 * A preset is never shown as selected. The page holds a fully resolved patch
 * rather than a name plus overrides, so once one is loaded there is no way to
 * tell it apart from the same voice built by hand — faking a highlighted
 * preset would be lying about which state the panel is in.
 */
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import type { RenderStatus } from './useClassicSynth';

const props = defineProps<{
  /** Preset names the page offers; already filtered to the subtractive engine. */
  presetNames: string[];
  status: RenderStatus;
}>();

const emit = defineEmits<{
  load: [name: string];
  reset: [];
  play: [];
  stop: [];
  'export-wav': [];
  'export-midi': [];
}>();

const { localizedValue } = useI18n();

/** `saw-lead` as `Saw Lead` — the engine's own identifier, made readable, not translated. */
function presetLabel(name: string): string {
  return name
    .split('-')
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');
}

const copy = computed(() =>
  localizedValue({
    en: {
      intro:
        'This is the same voice every earlier chapter shares, still on the deck above — but nothing here is fixed to make a point. Move any fader, start from a preset, or keep building from the plain saw you began with.',
      presetsLabel: 'Presets',
      presetsHint: `The engine ships presets across sixteen engine modes. Only the ${props.presetNames.length} built on this subtractive engine are offered here — a preset built on a physical model would load with most of this panel meaning nothing.`,
      selectionNote:
        'Loading a preset replaces the whole voice. None of these stays marked as current: you may have turned a knob since loading one, and the page has no way to tell.',
      reset: 'Reset',
      resetLabel: 'Reset the voice to the starting patch',
      play: 'Play',
      rendering: 'Rendering…',
      stop: 'Stop',
      playLabel: 'Play the current voice',
      stopLabel: 'Stop playback',
      exportLabel: 'Export',
      exportIntro:
        "The engine's offline bounce is deterministic for a fixed patch, so the WAV below is the exact audio you just heard, to the bit — not a re-performance.",
      exportDifference:
        "A WAV is the sound. A Standard MIDI File is only this phrase's notes, with none of this voice in it — opened elsewhere, it plays back through whatever instrument that program supplies.",
      exportWav: 'Export WAV',
      exportWavLabel: 'Export the current voice as a WAV audio file',
      exportMidi: 'Export MIDI',
      exportMidiLabel: "Export the phrase's notes as a Standard MIDI File",
    },
    ja: {
      intro:
        'ここまでの章と同じ 1 つのボイスが、上のデッキにそのまま載っています。ただし何かを説明するための制約はもうありません。好きなフェーダーを動かしてもいいし、プリセットを起点にしてもいいし、最初ののこぎり波から組み立て直してもかまいません。',
      presetsLabel: 'プリセット',
      presetsHint: `このエンジンのプリセットは 16 のエンジンモードにまたがりますが、ここに並ぶのはサブトラクティブエンジンで組まれた ${props.presetNames.length} つだけです。物理モデル系のプリセットを読み込むと、このパネルのほとんどが意味を持たなくなります。`,
      selectionNote:
        'プリセットを選ぶとボイス全体が置き換わります。読み込んだあとにノブを動かしているかもしれないので、どれが今の音かはここでは示しません。',
      reset: 'リセット',
      resetLabel: 'ボイスを最初のパッチに戻す',
      play: '再生',
      rendering: 'レンダリング中…',
      stop: '停止',
      playLabel: '現在のボイスを再生',
      stopLabel: '再生を停止',
      exportLabel: '書き出し',
      exportIntro:
        'このエンジンのオフラインバウンスは同じパッチに対して常に同じ結果になるので、下の WAV はいま聴いた音そのものです。もう一度演奏し直しているわけではありません。',
      exportDifference:
        'WAV は音そのものです。一方 Standard MIDI File はこのフレーズの音符だけを書き出したもので、このボイスの情報は含まれません。別のソフトで開くと、そちら側の音源で鳴ります。',
      exportWav: 'WAV を書き出す',
      exportWavLabel: '現在のボイスを WAV 音声ファイルとして書き出す',
      exportMidi: 'MIDI を書き出す',
      exportMidiLabel: 'フレーズの音符を Standard MIDI File として書き出す',
    },
  }),
);
</script>

<template>
  <div class="cs-playground">
    <div class="cs-card">
      <p class="cs-card__prose">{{ copy.intro }}</p>
    </div>

    <div class="cs-card">
      <p class="cs-card__label">{{ copy.presetsLabel }}</p>
      <p class="cs-card__aside">{{ copy.presetsHint }}</p>
      <div class="cs-variants">
        <button
          v-for="name in props.presetNames"
          :key="name"
          type="button"
          class="cs-variant"
          @click="emit('load', name)"
        >
          <span class="cs-variant__name">{{ presetLabel(name) }}</span>
        </button>
      </div>
      <p class="cs-card__aside">{{ copy.selectionNote }}</p>
      <div class="cs-actions">
        <button
          type="button"
          class="cs-button"
          :aria-label="copy.resetLabel"
          @click="emit('reset')"
        >
          {{ copy.reset }}
        </button>
      </div>
    </div>

    <div class="cs-card">
      <p class="cs-card__label">{{ copy.exportLabel }}</p>
      <p class="cs-card__prose">{{ copy.exportIntro }}</p>
      <div class="cs-actions">
        <button
          type="button"
          class="cs-button cs-button--primary"
          :disabled="props.status === 'rendering'"
          :aria-label="props.status === 'rendering' ? copy.rendering : copy.playLabel"
          @click="emit('play')"
        >
          {{ props.status === 'rendering' ? copy.rendering : copy.play }}
        </button>
        <button
          type="button"
          class="cs-button"
          :aria-label="copy.stopLabel"
          @click="emit('stop')"
        >
          {{ copy.stop }}
        </button>
      </div>
      <p class="cs-card__prose">{{ copy.exportDifference }}</p>
      <div class="cs-actions">
        <button
          type="button"
          class="cs-button"
          :aria-label="copy.exportWavLabel"
          @click="emit('export-wav')"
        >
          {{ copy.exportWav }}
        </button>
        <button
          type="button"
          class="cs-button"
          :aria-label="copy.exportMidiLabel"
          @click="emit('export-midi')"
        >
          {{ copy.exportMidi }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cs-playground {
  display: flex;
  flex-direction: column;
}
</style>
