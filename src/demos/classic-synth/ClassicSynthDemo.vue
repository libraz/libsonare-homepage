<script setup lang="ts">
/**
 * What this engine's subtractive synthesizer is made of, read as chapters
 * printed on one instrument.
 *
 * The page is one front panel in two decks. The upper deck is the voice: eight
 * sections side by side, every amount a fader and every choice a key. The lower
 * deck is the strip: the chapter display, the assign block, and the program
 * keys. A chapter lights the sections it is about and the deck dims the rest;
 * the prose lives in the display and covers nothing, because a fader bank
 * cannot afford to be covered.
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

/** Whether the assign block is unfolded. A chapter about it raises it; only the reader closes it. */
const assignOpen = ref(false);
watch(
  current,
  (next) => {
    if (next.patchbay) assignOpen.value = true;
  },
  { immediate: true },
);

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
      deck: 'The voice',
      strip: 'Chapter, mod matrix and program',
      chapterBlock: 'Chapter',
      chapterLegend: 'Chapter',
      programBlock: 'Program',
      programLegend: 'Program',
      chapterNav: 'Chapters',
      tick: (index: number, title: string) => `Chapter ${index}: ${title}`,
      prev: 'Prev',
      prevLabel: 'Previous chapter',
      next: 'Next',
      nextLabel: 'Next chapter',
      play: 'Play',
      rendering: 'Rendering…',
      stop: 'Stop',
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
      deck: 'ボイス',
      strip: '章、モジュレーション行列、プログラム',
      chapterBlock: '章',
      // Silkscreen legends stay Latin in both locales, like the voice deck's.
      chapterLegend: 'Chapter',
      programBlock: 'プログラム',
      programLegend: 'Program',
      chapterNav: '章',
      tick: (index: number, title: string) => `第 ${index} 章：${title}`,
      prev: '前へ',
      prevLabel: '前の章',
      next: '次へ',
      nextLabel: '次の章',
      play: '再生',
      rendering: 'レンダリング中…',
      stop: '停止',
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
      <section class="cs-deck cs-deck--voice" :aria-label="copy.deck">
        <template v-for="(module, index) in DECK_MODULES" :key="module.id">
          <!-- Where the deck folds into two rows when the width runs out. -->
          <span v-if="index === 4" class="cs-deck__fold" aria-hidden="true" />
          <SynthModule
            :module="module"
            :patch="patch"
            :class="isLit(module.id) ? 'cs-module--lit' : 'cs-module--dim'"
            @update-param="setParam"
            @update-waveform="patch.waveform = $event"
            @update-filter-model="patch.filterModel = $event"
            @update-filter-output="patch.filterOutput = $event"
            @update-body="patch.body = $event"
          />
        </template>
      </section>

      <div class="cs-hairline" role="presentation" />

      <section
        class="cs-deck cs-deck--strip"
        :class="{ 'cs-deck--assign-open': assignOpen }"
        :aria-label="copy.strip"
      >
        <section class="cs-block cs-block--chapter cs-module--lit" :aria-label="copy.chapterBlock">
          <header class="cs-block__head">
            <span class="cs-lamp" aria-hidden="true" />
            <h3 class="cs-legend">{{ copy.chapterLegend }}</h3>
          </header>
          <div class="cs-display" role="status" aria-live="polite" aria-atomic="true">
            <span class="cs-display__index">{{ String(chapter + 1).padStart(2, '0') }}</span>
            <h2 class="cs-display__title">{{ ja ? current.title.ja : current.title.en }}</h2>
          </div>
          <div class="cs-block__body">
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
          </div>
        </section>

        <section
          class="cs-block cs-block--assign"
          :class="current.patchbay ? 'cs-module--lit' : 'cs-module--dim'"
        >
          <SynthPatchbay v-model:open="assignOpen" :patch="patch" @update="applyToVoice" />
        </section>

        <section class="cs-block cs-block--program cs-module--lit" :aria-label="copy.programBlock">
          <header class="cs-block__head">
            <span class="cs-lamp" aria-hidden="true" />
            <h3 class="cs-legend">{{ copy.programLegend }}</h3>
          </header>
          <div class="cs-block__body cs-program">
            <nav :aria-label="copy.chapterNav">
              <ol class="cs-program__keys">
                <li v-for="(entry, index) in CHAPTERS" :key="entry.id">
                  <button
                    type="button"
                    class="cs-key cs-key--square"
                    :class="{ 'cs-key--on': index === chapter }"
                    :aria-label="copy.tick(index + 1, ja ? entry.title.ja : entry.title.en)"
                    :aria-current="index === chapter ? 'step' : undefined"
                    @click="chapter = index"
                  >
                    <span class="cs-key__lamp" aria-hidden="true" />
                    <span class="cs-key__text">{{ index + 1 }}</span>
                  </button>
                </li>
              </ol>
              <div class="cs-program__row">
                <button
                  type="button"
                  class="cs-button"
                  :disabled="chapter === 0"
                  :aria-label="copy.prevLabel"
                  @click="stepChapter(-1)"
                >
                  {{ copy.prev }}
                </button>
                <button
                  type="button"
                  class="cs-button"
                  :disabled="chapter === CHAPTERS.length - 1"
                  :aria-label="copy.nextLabel"
                  @click="stepChapter(1)"
                >
                  {{ copy.next }}
                </button>
              </div>
            </nav>
            <div class="cs-program__row cs-program__transport">
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
          </div>
        </section>
      </section>
    </div>
  </ToolShell>
</template>

<style scoped>
.cs-statusbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px;
  font-family: var(--font-mono);
  font-size: 0.7rem;
}

.cs-statusbar__field b {
  margin-inline-end: 6px;
  color: var(--demo-text-muted);
  font-weight: 600;
  letter-spacing: 0.06em;
}
</style>
