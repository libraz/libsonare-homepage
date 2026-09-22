<script setup lang="ts">
/**
 * What this engine's subtractive synthesizer is made of, read as chapters
 * printed over one instrument.
 *
 * The page is one deck seen head-on. A chapter names the modules it is about,
 * the deck dims the rest, and the chapter's prose floats as a card over a part
 * of the deck it is not about. Row 1 of the deck has a fixed height and the
 * card is a grid item placed by `--note-area`, so nothing moves when a chapter
 * changes — the whole point of one panel serving eight chapters is that the
 * reader never loses where they are in it.
 *
 * A chapter's comparisons play without touching the shared patch. Hearing four
 * filter models should not silently rewrite the voice a reader has been
 * shaping, so an audition renders a variant and the patch stays put until a
 * button says to apply it.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import ToolShell from '@/components/ToolShell.vue';
import { StatusIndicator } from '@/components/ui';
import { useI18n } from '@/composables/useI18n';
import { useUrlState } from '@/composables/useUrlState';
import { useWasmBoot } from '@/composables/useWasmBoot';
import { CHAPTERS, DECK_MODULES, type ModuleId } from './classicSynthChapters';
import {
  CLASSIC_PARAMS,
  type ClassicPatch,
  defaultPatch,
  MAX_MOD_ROUTINGS,
  type NumericParamKey,
  paramOf,
  patchFromPreset,
  phraseOf,
} from './classicSynthState';
import './classicSynth.css';
import SynthChapters from './SynthChapters.vue';
import SynthModule from './SynthModule.vue';
import SynthPatchbay from './SynthPatchbay.vue';
import SynthPlayground from './SynthPlayground.vue';
import { useClassicSynth } from './useClassicSynth';

const { patch, status, playingKey, presetNames, play, stop, exportWav, exportMidi, load, reset } =
  useClassicSynth();

const { isLocale, localizedPath, alternateLocalePath, localizedValue } = useI18n();
const { version: libVersion } = useWasmBoot();
const ja = computed(() => isLocale('ja'));

/** Which chapter is open. The last one is the playground. */
const chapter = ref(0);
const current = computed(() => CHAPTERS[chapter.value]);

/** Whether the annotation card is showing. Reopens on every chapter change. */
const noteOpen = ref(true);
watch(chapter, () => {
  noteOpen.value = true;
});

function isLit(id: ModuleId): boolean {
  return current.value.modules.includes(id);
}

function stepChapter(delta: number) {
  const next = chapter.value + delta;
  if (next >= 0 && next < CHAPTERS.length) chapter.value = next;
}

const docsPath = computed(() => localizedPath('/docs/native-synth'));
const oppositeLocalePath = computed(() => alternateLocalePath('/classic-synth'));

const copy = computed(() =>
  localizedValue({
    en: {
      title: 'Classic Synth',
      subtitle: 'One voice, taken apart a chapter at a time',
      localOnly: 'LOCAL',
      guideTitle: 'Every sound on this page is rendered as you ask for it',
      guideBody:
        'No samples ship with the page and nothing leaves the browser. Each comparison bounces the same phrase through the engine offline, so two variants differ in exactly the one thing the chapter is about.',
      guideLink: 'Read about the synthesizer',
      chapters: 'CHAPTERS',
      voice: 'VOICE',
      deck: 'The voice',
      matrix: 'Mod matrix',
      chapterNav: 'Chapters',
      tick: (index: number, title: string) => `Chapter ${index}: ${title}`,
      prev: 'Prev',
      prevLabel: 'Previous chapter',
      next: 'Next',
      nextLabel: 'Next chapter',
      play: 'Play',
      rendering: 'Rendering…',
      stop: 'Stop',
      hideNote: 'Hide notes',
      showNote: 'Show notes',
    },
    ja: {
      title: 'クラシックシンセ',
      subtitle: '1 つの音色を、章ごとに分解していく',
      localOnly: 'ローカル',
      guideTitle: 'このページの音はすべて、求められたその場で合成しています',
      guideBody:
        'サンプルは同梱しておらず、データはブラウザの外に出ません。比較のたびに同じフレーズをオフラインでバウンスするので、2 つの音の違いはその章が扱う 1 点だけです。',
      guideLink: 'シンセサイザーについて読む',
      chapters: '章',
      voice: 'ボイス',
      deck: 'ボイス',
      matrix: 'モジュレーション行列',
      chapterNav: '章',
      tick: (index: number, title: string) => `第 ${index} 章：${title}`,
      prev: '前へ',
      prevLabel: '前の章',
      next: '次へ',
      nextLabel: '次の章',
      play: '再生',
      rendering: 'レンダリング中…',
      stop: '停止',
      hideNote: '注釈を隠す',
      showNote: '注釈を表示',
    },
  }),
);

const statusKind = computed<'idle' | 'active' | 'warning' | 'error'>(() => {
  if (status.value === 'error') return 'error';
  if (status.value === 'rendering') return 'active';
  return 'idle';
});

function setParam(key: NumericParamKey, value: number) {
  const { min, max } = paramOf(key);
  patch[key] = Math.min(max, Math.max(min, value));
}

/** Apply a chapter's suggestion to the shared voice, leaving everything else. */
function applyToVoice(change: Partial<ClassicPatch>) {
  Object.assign(patch, change);
}

/** Play a variant of the voice without adopting it. */
function audition(variant: ClassicPatch, phraseId: string) {
  void play(phraseOf(phraseId), variant);
}

/** Play the shared voice through the open chapter's own phrase. */
function playCurrent() {
  void play(phraseOf(current.value.phraseId));
}

function loadPreset(name: string) {
  void import('@/wasm/index.js').then(async (wasm) => {
    await wasm.init();
    load(patchFromPreset(wasm.synthPresetPatch(name)));
  });
}

async function download(kind: 'wav' | 'midi') {
  const phrase = phraseOf(current.value.phraseId);
  const blob = kind === 'wav' ? await exportWav(phrase) : await exportMidi(phrase);
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `classic-synth-${phrase.id}.${kind === 'wav' ? 'wav' : 'mid'}`;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * What a link carries: the open chapter and every field of the voice that
 * differs from the one a reader starts with.
 *
 * Only the differences travel. A patch has thirty-odd fields and almost all of
 * them are usually untouched, so spelling every one out would make a link no
 * reader would send.
 */
const voiceParam = computed<string>({
  get: () => {
    const base = defaultPatch();
    const fields: string[] = [];
    for (const { key } of CLASSIC_PARAMS) {
      if (patch[key] !== base[key]) fields.push(`${key}:${Number(patch[key].toFixed(4))}`);
    }
    for (const key of ['waveform', 'filterModel', 'filterOutput', 'body'] as const) {
      if (patch[key] !== base[key]) fields.push(`${key}:${patch[key]}`);
    }
    for (const routing of patch.modRoutings) {
      fields.push(`m:${routing.source}>${routing.destination}>${routing.depth}`);
    }
    return fields.join(',');
  },
  set: (raw) => {
    const next = defaultPatch();
    for (const field of raw.split(',')) {
      const split = field.indexOf(':');
      if (split < 0) continue;
      const key = field.slice(0, split);
      const value = field.slice(split + 1);
      if (key === 'm') {
        const [source, destination, depth] = value.split('>');
        if (source && destination && next.modRoutings.length < MAX_MOD_ROUTINGS) {
          next.modRoutings.push({
            source: source as never,
            destination: destination as never,
            depth: Number(depth),
          });
        }
        continue;
      }
      if (key === 'waveform' || key === 'filterModel' || key === 'filterOutput' || key === 'body') {
        (next as Record<string, unknown>)[key] = value;
        continue;
      }
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) continue;
      const described = CLASSIC_PARAMS.find((param) => param.key === key);
      if (!described) continue;
      next[described.key] = Math.min(described.max, Math.max(described.min, numeric));
    }
    load(patchFromPreset(next));
  },
});

const url = useUrlState([
  {
    key: 'ch',
    state: chapter,
    defaultValue: 0,
    parse: (raw: string) => {
      const index = Number(raw);
      return Number.isInteger(index) && index >= 0 && index < CHAPTERS.length ? index : null;
    },
  },
  { key: 'voice', state: voiceParam, defaultValue: '', parse: (raw: string) => raw },
]);

onMounted(() => {
  url.applyFromUrl();
  url.enable();
});
onBeforeUnmount(() => url.disable());
</script>

<template>
  <ToolShell
    demo-id="classic-synth"
    :title="copy.title"
    :subtitle="copy.subtitle"
    :version="libVersion"
    :status="statusKind"
    :status-label="copy.localOnly"
    :docs-path="docsPath"
    :guide-title="copy.guideTitle"
    :guide-body="copy.guideBody"
    :guide-link-label="copy.guideLink"
    :opposite-locale-path="oppositeLocalePath"
  >
    <template #statusbar>
      <div class="cs-statusbar">
        <StatusIndicator :status="statusKind" :label="copy.localOnly" />
        <span class="cs-statusbar__field">
          <b>{{ copy.chapters }}</b>{{ chapter + 1 }} / {{ CHAPTERS.length }}
        </span>
        <span class="cs-statusbar__field">
          <b>WAVE</b>{{ patch.waveform }}
        </span>
        <span class="cs-statusbar__field">
          <b>FILTER</b>{{ patch.filterModel }}
        </span>
        <span class="cs-statusbar__field">
          <b>CUTOFF</b>{{ Math.round(patch.cutoffHz) }} Hz
        </span>
      </div>
    </template>

    <div class="cs cs-plate">
      <section class="cs__deck" :aria-label="copy.deck">
        <section
          v-if="noteOpen"
          id="cs-note"
          class="cs-note"
          :style="{ '--note-area': current.noteArea }"
          :aria-label="ja ? current.title.ja : current.title.en"
        >
          <SynthPlayground
            v-if="current.id === 'playground'"
            :preset-names="presetNames"
            :status="status"
            @load="loadPreset"
            @reset="reset"
            @play="playCurrent"
            @stop="stop"
            @export-wav="download('wav')"
            @export-midi="download('midi')"
          />
          <SynthChapters
            v-else
            :chapter="current"
            :patch="patch"
            :status="status"
            :playing-key="playingKey"
            @apply="applyToVoice"
            @audition="audition"
            @play="playCurrent"
            @stop="stop"
          />
        </section>

        <template v-for="module in DECK_MODULES" :key="module.id">
          <section
            v-if="module.id === 'matrix'"
            class="cs-module cs-module--matrix"
            :class="isLit(module.id) ? 'cs-module--lit' : 'cs-module--dim'"
            :style="{ '--area': module.area }"
            :aria-label="copy.matrix"
          >
            <div class="cs-module__fill">
              <SynthPatchbay :patch="patch" @update="applyToVoice" />
            </div>
          </section>
          <SynthModule
            v-else
            :module="module"
            :patch="patch"
            :class="isLit(module.id) ? 'cs-module--lit' : 'cs-module--dim'"
            :style="{ '--area': module.area }"
            @update-param="setParam"
            @update-waveform="patch.waveform = $event"
            @update-filter-model="patch.filterModel = $event"
            @update-filter-output="patch.filterOutput = $event"
            @update-body="patch.body = $event"
          />
        </template>
      </section>

      <footer class="cs__transport cs-transport">
        <nav class="cs-transport__group" :aria-label="copy.chapterNav">
          <button
            type="button"
            class="cs-button"
            :disabled="chapter === 0"
            :aria-label="copy.prevLabel"
            @click="stepChapter(-1)"
          >
            {{ copy.prev }}
          </button>
          <p class="cs-transport__readout" role="status" aria-live="polite" aria-atomic="true">
            <span class="cs-transport__index">
              {{ String(chapter + 1).padStart(2, '0') }} / {{ String(CHAPTERS.length).padStart(2, '0') }}
            </span>
            <span class="cs-transport__title">{{ ja ? current.title.ja : current.title.en }}</span>
          </p>
          <button
            type="button"
            class="cs-button"
            :disabled="chapter === CHAPTERS.length - 1"
            :aria-label="copy.nextLabel"
            @click="stepChapter(1)"
          >
            {{ copy.next }}
          </button>
          <ol class="cs-ticks">
            <li v-for="(entry, index) in CHAPTERS" :key="entry.id">
              <button
                type="button"
                class="cs-tick"
                :class="{ 'cs-tick--on': index === chapter }"
                :aria-label="copy.tick(index + 1, ja ? entry.title.ja : entry.title.en)"
                :aria-current="index === chapter ? 'step' : undefined"
                @click="chapter = index"
              >
                {{ index + 1 }}
              </button>
            </li>
          </ol>
        </nav>

        <div class="cs-transport__group">
          <button
            type="button"
            class="cs-button cs-button--primary"
            :disabled="status === 'rendering'"
            @click="playCurrent"
          >
            {{ status === 'rendering' ? copy.rendering : copy.play }}
          </button>
          <button type="button" class="cs-button" :disabled="playingKey === null" @click="stop">
            {{ copy.stop }}
          </button>
        </div>

        <div class="cs-transport__group">
          <button
            type="button"
            class="cs-button"
            :aria-expanded="noteOpen"
            aria-controls="cs-note"
            @click="noteOpen = !noteOpen"
          >
            {{ noteOpen ? copy.hideNote : copy.showNote }}
          </button>
        </div>
      </footer>
    </div>
  </ToolShell>
</template>

<style scoped>
.cs-statusbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px;
  font-family: var(--demo-font-mono, monospace);
  font-size: 0.7rem;
}

.cs-statusbar__field b {
  margin-inline-end: 6px;
  color: var(--demo-text-muted);
  font-weight: 600;
  letter-spacing: 0.06em;
}

/* The stepper wraps as one unit; the readout inside it takes the free width. */
.cs-transport__group:first-child {
  flex: 1 1 24rem;
  flex-wrap: wrap;
}
</style>
