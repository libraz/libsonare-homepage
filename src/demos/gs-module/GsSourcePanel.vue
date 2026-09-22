<script setup lang="ts">
/**
 * What gets played, and the bytes that configure it.
 *
 * Two sources. On its own the module auditions the selected part with a short
 * built-in phrase. Drop a `.mid` and that file plays instead, imported exactly
 * as it arrived — the panel settings are carried on a separate track beside it,
 * so a file that sets up its own GS state keeps it.
 *
 * The frame list is the point of the panel rather than a debug aid: it is the
 * whole difference between the module's power-on state and what is on screen,
 * which is usually a handful of bytes.
 */
import { computed, ref } from 'vue';
import { TechPanel } from '@/components/ui';
import { useI18n } from '@/composables/useI18n';
import type { SmfEvent } from '@/utils/gsSysex';
import type { GsRenderStatus } from './useGsModule';

const props = defineProps<{
  frames: SmfEvent[];
  status: GsRenderStatus;
  droppedFile: { name: string; bytes: Uint8Array } | null;
}>();

const emit = defineEmits<{
  play: [];
  stop: [];
  reset: [];
  drop: [file: File];
  clearFile: [];
}>();

const { localizedValue } = useI18n();
const dragging = ref(false);
const showFrames = ref(false);

const copy = computed(() =>
  localizedValue({
    en: {
      title: 'Source',
      play: 'Play',
      stop: 'Stop',
      reset: 'Reset module',
      rendering: 'Rendering…',
      error: 'Render failed',
      builtIn: 'Built-in phrase — drop a .mid here to play your own',
      dropHint: 'Release to load',
      clear: 'Remove',
      framesNone: 'Nothing to send: every setting is at its power-on value.',
      framesSome: (n: number) => `${n} message${n === 1 ? '' : 's'} to send`,
      fileNote:
        'The file plays as it arrived. Any GS setup it carries is applied, and the panels above are sent alongside it.',
    },
    ja: {
      title: 'ソース',
      play: '再生',
      stop: '停止',
      reset: 'モジュールをリセット',
      rendering: 'レンダリング中…',
      error: 'レンダリングに失敗しました',
      builtIn: '内蔵フレーズ。.mid をここに落とすと自分のファイルを鳴らせます',
      dropHint: '離すと読み込みます',
      clear: '外す',
      framesNone: '送るものはありません。すべて電源投入時の値のままです。',
      framesSome: (n: number) => `送信するメッセージ ${n} 件`,
      fileNote:
        'ファイルはそのまま再生します。ファイルが持つ GS 設定はそのまま効き、上のパネルの設定は別トラックとして一緒に送られます。',
    },
  }),
);

/** A frame as the hex a reader can compare against the address table. */
function spell(event: SmfEvent): string {
  const bytes = event.sysex ? [0xf0, ...event.sysex] : (event.bytes ?? []);
  return bytes.map((byte) => byte.toString(16).toUpperCase().padStart(2, '0')).join(' ');
}

function onDrop(payload: DragEvent) {
  dragging.value = false;
  const file = payload.dataTransfer?.files?.[0];
  if (file) emit('drop', file);
}
</script>

<template>
  <TechPanel :title="copy.title">
    <div class="gs-source">
      <div class="gs-source__transport">
        <button type="button" class="gs-source__button" @click="emit('play')">
          {{ props.status === 'rendering' ? copy.rendering : copy.play }}
        </button>
        <button type="button" class="gs-source__button" @click="emit('stop')">
          {{ copy.stop }}
        </button>
        <button type="button" class="gs-source__button" @click="emit('reset')">
          {{ copy.reset }}
        </button>
        <span v-if="props.status === 'error'" class="gs-source__error">{{ copy.error }}</span>
      </div>

      <div
        class="gs-source__drop"
        :class="{ 'gs-source__drop--over': dragging }"
        @dragover.prevent="dragging = true"
        @dragleave="dragging = false"
        @drop.prevent="onDrop"
      >
        <template v-if="props.droppedFile">
          <span class="gs-source__file">{{ props.droppedFile.name }}</span>
          <button type="button" class="gs-source__button" @click="emit('clearFile')">
            {{ copy.clear }}
          </button>
        </template>
        <span v-else class="gs-note">{{ dragging ? copy.dropHint : copy.builtIn }}</span>
      </div>

      <p v-if="props.droppedFile" class="gs-note">{{ copy.fileNote }}</p>

      <details v-if="props.frames.length" class="gs-source__frames" :open="showFrames">
        <summary @click="showFrames = !showFrames">{{ copy.framesSome(props.frames.length) }}</summary>
        <ol class="gs-source__list">
          <li v-for="(frame, index) in props.frames" :key="index" class="gs-value">
            {{ spell(frame) }}
          </li>
        </ol>
      </details>
      <p v-else class="gs-note">{{ copy.framesNone }}</p>
    </div>
  </TechPanel>
</template>

<style scoped>
.gs-source {
  display: grid;
  gap: 10px;
}

.gs-source__transport {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.gs-source__button {
  padding: 5px 12px;
  border: 1px solid var(--demo-border-strong);
  border-radius: 5px;
  background: var(--demo-control-bg-strong);
  color: var(--demo-text-strong);
  cursor: pointer;
  font-family: inherit;
  font-size: 0.78rem;
}

.gs-source__button:hover {
  border-color: var(--demo-accent-border);
}

.gs-source__button:focus-visible {
  outline: 2px solid var(--demo-accent);
  outline-offset: 2px;
}

.gs-source__error {
  color: var(--demo-status-error);
  font-size: 0.75rem;
}

.gs-source__drop {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border: 1px dashed var(--demo-border-strong);
  border-radius: 6px;
  background: var(--demo-dropzone-bg);
}

.gs-source__drop--over {
  border-color: var(--demo-accent);
  background: var(--demo-accent-subtle);
}

.gs-source__file {
  overflow: hidden;
  font-size: 0.78rem;
  color: var(--demo-text-strong);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gs-source__frames summary {
  cursor: pointer;
  color: var(--demo-text);
  font-size: 0.76rem;
}

.gs-source__list {
  margin: 8px 0 0;
  padding-inline-start: 1.6rem;
  display: grid;
  gap: 2px;
  font-size: 0.72rem;
}
</style>
