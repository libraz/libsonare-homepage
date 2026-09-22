<script setup lang="ts">
/**
 * A GM/GS tone module on the page: sixteen parts, a sound per part, one shared
 * insertion effect, and a `.mid` you can drop through it.
 *
 * The panels hold no state of their own. Each one reads the single module state
 * and emits an edit, so the SysEx list in the source panel is always the exact
 * difference between a freshly reset module and what is on screen — there is no
 * second account of the settings for it to disagree with.
 *
 * Every edit invalidates the render rather than re-rendering, because a bounce
 * is not instant and a slider drag would otherwise queue dozens of them.
 */
import { computed } from 'vue';
import ToolShell from '@/components/ToolShell.vue';
import { StatusIndicator } from '@/components/ui';
import { useWasmBoot } from '@/composables/useWasmBoot';
import GsEfxInspector from './GsEfxInspector.vue';
import GsKitBrowser from './GsKitBrowser.vue';
import GsPartMixer from './GsPartMixer.vue';
import GsPatchBrowser from './GsPatchBrowser.vue';
import GsSourcePanel from './GsSourcePanel.vue';
import './gsModule.css';
import { useI18n } from '@/composables/useI18n';
import { GM_PROGRAM_NAMES_JA } from './gsNames';
import { efxTypeKey, type GsPartState, RHYTHM_CHANNEL, withEfxType } from './gsState';
import { useGsModule } from './useGsModule';

const {
  state,
  selectedChannel,
  selectedPart,
  droppedFile,
  frames,
  status,
  drumKits,
  gmPrograms,
  gmFamilyNames,
  variations,
  play,
  stop,
  invalidate,
  reset,
} = useGsModule();

const { isLocale, localizedPath, alternateLocalePath, localizedValue } = useI18n();
const { version: libVersion } = useWasmBoot();
const ja = computed(() => isLocale('ja'));

const docsPath = computed(() => localizedPath('/docs/native-synth'));
const oppositeLocalePath = computed(() => alternateLocalePath('/gs-module'));

const copy = computed(() =>
  localizedValue({
    en: {
      title: 'GS Sound Module',
      subtitle: 'Sixteen parts, one insertion effect, and your own .mid through them',
      localOnly: 'LOCAL',
      guideTitle: 'No SoundFont, no sample data',
      guideBody:
        'Every note here plays a built-in fallback voice, so the page ships no samples and nothing leaves the browser. Each audition assembles a Standard MIDI File from the panels, imports it and bounces it offline.',
      guideLink: 'Read about the instruments',
      part: 'PART',
    },
    ja: {
      title: 'GS 音源モジュール',
      subtitle: '16 パート、インサーションエフェクト 1 系統、そして手持ちの .mid',
      localOnly: 'ローカル',
      guideTitle: 'SoundFont もサンプルデータもありません',
      guideBody:
        'ここで鳴る音はすべて内蔵のフォールバック音源です。ページはサンプルを一切同梱せず、データはブラウザの外に出ません。試聴のたびにパネルの設定から標準 MIDI ファイルを組み立て、読み込んでオフラインでバウンスしています。',
      guideLink: '内蔵音源について読む',
      part: 'パート',
    },
  }),
);

const statusKind = computed<'idle' | 'active' | 'warning' | 'error'>(() => {
  if (status.value === 'error') return 'error';
  if (status.value === 'rendering') return 'active';
  return 'idle';
});

/** The name to show on a strip: a rhythm set on the rhythm part, a program elsewhere. */
const patchNames = computed(() =>
  state.parts.map((part) => {
    if (part.channel === RHYTHM_CHANNEL) {
      return drumKits.value.find((kit) => kit.program === part.program)?.name ?? '';
    }
    if (ja.value) return GM_PROGRAM_NAMES_JA[part.program] ?? '';
    return gmPrograms.value[part.program]?.name ?? '';
  }),
);

function updatePart(channel: number, patch: Partial<GsPartState>) {
  Object.assign(state.parts[channel], patch);
  invalidate();
}

/**
 * A variation only exists relative to a program, so changing the program drops
 * back to the capital tone rather than carrying a bank the new program may not
 * voice apart — or may voice as something unrelated.
 */
function selectProgram(program: number) {
  updatePart(selectedChannel.value, { program, bankMsb: 0 });
}

function selectType(type: number) {
  state.efx = withEfxType(state.efx, type);
  invalidate();
}

function updateSlot(slot: number, value: number) {
  state.efx.params[slot] = value;
  invalidate();
}

function onDrop(file: File) {
  void file.arrayBuffer().then((buffer) => {
    droppedFile.value = { name: file.name, bytes: new Uint8Array(buffer) };
    invalidate();
  });
}

function clearFile() {
  droppedFile.value = null;
  invalidate();
}
</script>

<template>
  <ToolShell
    demo-id="gs-module"
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
      <div class="gs-statusbar">
        <StatusIndicator :status="statusKind" :label="copy.localOnly" />
        <span class="gs-statusbar__field">
          <b>{{ copy.part }}</b>{{ selectedChannel + 1 }}
        </span>
        <span class="gs-statusbar__field">
          <b>EFX</b>{{ efxTypeKey(state.efx.type) }}
        </span>
      </div>
    </template>

    <div class="gs-module">
    <GsSourcePanel
      class="gs-module__source"
      :frames="frames"
      :status="status"
      :dropped-file="droppedFile"
      @play="play"
      @stop="stop"
      @reset="reset"
      @drop="onDrop"
      @clear-file="clearFile"
    />

    <GsKitBrowser
      v-if="selectedChannel === RHYTHM_CHANNEL"
      class="gs-module__browser"
      :kits="drumKits"
      :selected-program="selectedPart.program"
      @select="selectProgram"
    />
    <GsPatchBrowser
      v-else
      class="gs-module__browser"
      :programs="gmPrograms"
      :family-names="gmFamilyNames"
      :variations="variations"
      :program="selectedPart.program"
      :bank-msb="selectedPart.bankMsb"
      @select="selectProgram"
      @select-bank="updatePart(selectedChannel, { bankMsb: $event })"
    />

    <GsEfxInspector
      class="gs-module__efx"
      :efx="state.efx"
      @select-type="selectType"
      @update-slot="updateSlot"
    />

    <GsPartMixer
      class="gs-module__mixer"
      :parts="state.parts"
      :selected-channel="selectedChannel"
      :patch-names="patchNames"
      @select="selectedChannel = $event"
      @update="updatePart"
    />
    </div>
  </ToolShell>
</template>

<style scoped>
.gs-statusbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px;
  font-family: var(--demo-font-mono, monospace);
  font-size: 0.7rem;
}

.gs-statusbar__field b {
  margin-inline-end: 6px;
  color: var(--demo-text-muted);
  font-weight: 600;
  letter-spacing: 0.06em;
}
</style>
