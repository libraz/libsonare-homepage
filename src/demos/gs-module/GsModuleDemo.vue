<script setup lang="ts">
/**
 * A GM/GS tone module on the page: sixteen parts, a sound per part, one shared
 * insertion effect, and a `.mid` you can drop through it.
 *
 * The panels hold no state of their own. Each one reads the single module state
 * and emits an edit, so the display, the SysEx list and the render are all
 * describing the same thing rather than three parallel accounts of it — the
 * frame list is always the exact difference between a freshly reset module and
 * what is on screen.
 *
 * Every edit invalidates the render rather than re-rendering, because a bounce
 * is not instant and a slider drag would otherwise queue dozens of them.
 */
import { computed, onBeforeUnmount, onMounted } from 'vue';
import ToolShell from '@/components/ToolShell.vue';
import ToolStatusBar, { type ToolStatusField } from '@/components/ToolStatusBar.vue';
import { useI18n } from '@/composables/useI18n';
import { useUrlState } from '@/composables/useUrlState';
import { useWasmBoot } from '@/composables/useWasmBoot';
import GsDisplay from './GsDisplay.vue';
import GsEfxInspector from './GsEfxInspector.vue';
import GsKitBrowser from './GsKitBrowser.vue';
import GsPartMixer from './GsPartMixer.vue';
import GsPatchBrowser from './GsPatchBrowser.vue';
import GsSourcePanel from './GsSourcePanel.vue';
import { efxStanding, efxType } from './gsEfx';
import './gsModule.css';
import {
  GM_PROGRAM_NAMES_JA,
  GS_EFX_STANDINGS,
  GS_EFX_TYPES as GS_EFX_TYPE_NAMES,
} from './gsNames';
import { efxTypeKey, type GsPartState, RHYTHM_CHANNEL, withEfxType } from './gsState';
import { useGsModule } from './useGsModule';

const {
  state,
  efxRealization,
  selectedChannel,
  selectedPart,
  droppedFile,
  frames,
  status,
  error,
  waveform,
  activity,
  isPlaying,
  playhead,
  drumKits,
  gmPrograms,
  gmFamilyNames,
  variations,
  paramMeta,
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
      subtitle:
        'A 16-part GM/GS sound module: choose a sound per part, then play the built-in phrase or your own .mid',
      localOnly: 'LOCAL',
      guideTitle: 'A sound module without samples',
      guideBody:
        'Pick a sound for each of the 16 parts and press Play, or drop in your own .mid. One shared insertion effect can be chosen as well. Every voice is a built-in fallback voice that libsonare synthesizes without a SoundFont, so the page ships no samples and nothing leaves the browser. Only the piano model is calibrated against a reference recording; the other physical models are approximations.',
      guideLink: 'Read about the instruments',
      maker: 'LIBSONARE',
      model: 'GS MODULE',
      tag: '16 PARTS · GM/GS TONE GENERATOR',
      play: 'Play',
      stop: 'Stop',
      reset: 'Reset module',
      realization: 'EFX sound',
      modern: 'Modern',
      classic: 'Classic (32 kHz)',
      status: { idle: 'Idle', rendering: 'Rendering', ready: 'Ready', error: 'Error' },
      fields: { part: 'PART', sound: 'SOUND', efx: 'EFX', source: 'SOURCE' },
      builtIn: 'built-in phrase',
    },
    ja: {
      title: 'GS 音源モジュール',
      subtitle:
        '16 パートの GM/GS 音源モジュール。パートごとに音色を選び、内蔵フレーズか手持ちの .mid を鳴らします',
      localOnly: 'ローカル',
      guideTitle: 'サンプルを持たない音源モジュール',
      guideBody:
        '16 パートそれぞれに音色を選んで再生するか、手持ちの .mid を読み込みます。共有のインサーションエフェクトを 1 系統選ぶこともできます。音はすべて、SoundFont なしで libsonare が合成する内蔵フォールバック音源です。ページにサンプルは含まれず、データはブラウザの外に出ません。較正済みの物理モデルはピアノだけで、ほかは近似です。',
      guideLink: '内蔵音源について読む',
      maker: 'LIBSONARE',
      model: 'GS MODULE',
      tag: '16 パート · GM/GS 音源',
      play: '再生',
      stop: '停止',
      reset: 'モジュールをリセット',
      realization: 'EFX の音作り',
      modern: 'モダン',
      classic: 'クラシック（32 kHz）',
      status: { idle: '待機中', rendering: 'レンダリング中', ready: '準備完了', error: 'エラー' },
      fields: { part: 'パート', sound: '音色', efx: 'EFX', source: 'ソース' },
      builtIn: '内蔵フレーズ',
    },
  }),
);

const statusKind = computed<'idle' | 'active' | 'warning' | 'error'>(() => {
  if (status.value === 'error') return 'error';
  if (status.value === 'rendering') return 'active';
  return 'idle';
});

const statusFields = computed<ToolStatusField[]>(() => [
  { key: copy.value.fields.part, value: `${selectedChannel.value + 1}` },
  {
    key: copy.value.fields.sound,
    value: patchNames.value[selectedChannel.value] || '-',
    wide: true,
  },
  {
    key: copy.value.fields.efx,
    value: `${efxKey.value} ${efxName.value}`,
    wide: true,
    divider: true,
  },
  {
    key: copy.value.fields.source,
    value: droppedFile.value?.name ?? copy.value.builtIn,
    wide: true,
  },
]);

/** The name to show for a part: a rhythm set on the rhythm part, a program elsewhere. */
const patchNames = computed(() =>
  state.parts.map((part) => {
    if (part.channel === RHYTHM_CHANNEL) {
      return drumKits.value.find((kit) => kit.program === part.program)?.name ?? '';
    }
    if (ja.value) return GM_PROGRAM_NAMES_JA[part.program] ?? '';
    return gmPrograms.value[part.program]?.name ?? '';
  }),
);

const efxKey = computed(() => efxTypeKey(state.efx.type));
const efxName = computed(() => {
  const name = GS_EFX_TYPE_NAMES[efxKey.value];
  if (!name) return efxKey.value;
  return ja.value ? name.ja : name.en;
});
const efxStandingKind = computed(() => {
  const entry = efxType(state.efx.type);
  return entry ? efxStanding(entry) : 'inert';
});
const efxStandingLabel = computed(() => {
  const name = GS_EFX_STANDINGS[efxStandingKind.value];
  return ja.value ? name.ja : name.en;
});

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

/**
 * What a link carries: the selected part, the effect type, and the sound on
 * every part that has one other than its power-on program.
 *
 * Fader positions are deliberately left out. A shared link is for "listen to
 * this combination of sounds through this effect", and a query string carrying
 * sixty-four numbers is neither readable nor the interesting part.
 */
const SOUND_FIELD = /^(\d{1,2}):(\d{1,3})(?:\.(\d{1,3}))?$/;

const soundsParam = computed<string>({
  get: () =>
    state.parts
      .filter((part) => part.program !== 0 || part.bankMsb !== 0)
      .map((part) =>
        part.bankMsb === 0
          ? `${part.channel}:${part.program}`
          : `${part.channel}:${part.program}.${part.bankMsb}`,
      )
      .join(','),
  set: (raw) => {
    for (const part of state.parts) {
      part.program = 0;
      part.bankMsb = 0;
    }
    for (const field of raw.split(',')) {
      const parsed = field.match(SOUND_FIELD);
      if (!parsed) continue;
      const channel = Number(parsed[1]);
      const program = Number(parsed[2]);
      const bank = parsed[3] === undefined ? 0 : Number(parsed[3]);
      if (channel > 15 || program > 127 || bank > 127) continue;
      state.parts[channel].program = program;
      state.parts[channel].bankMsb = bank;
    }
    invalidate();
  },
});

const efxParam = computed<string>({
  get: () => state.efx.type.toString(16).padStart(4, '0'),
  set: (raw) => {
    const type = Number.parseInt(raw, 16);
    if (Number.isNaN(type) || !efxType(type)) return;
    state.efx = withEfxType(state.efx, type);
    invalidate();
  },
});

const url = useUrlState([
  {
    key: 'part',
    state: selectedChannel,
    defaultValue: 0,
    parse: (raw: string) => {
      const channel = Number(raw);
      return Number.isInteger(channel) && channel >= 0 && channel <= 15 ? channel : null;
    },
  },
  { key: 'efx', state: efxParam, defaultValue: '0000', parse: (raw: string) => raw },
  {
    key: 'efx-mode',
    state: efxRealization,
    defaultValue: 'modern',
    parse: (raw: string) => (raw === 'modern' || raw === 'classic' ? raw : null),
  },
  { key: 'sounds', state: soundsParam, defaultValue: '', parse: (raw: string) => raw },
]);

onMounted(() => {
  url.applyFromUrl();
  url.enable();
});
onBeforeUnmount(() => url.disable());

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
      <ToolStatusBar
        :status="statusKind"
        :label="copy.status[status]"
        :pulse="status === 'rendering'"
        :fields="statusFields"
      />
    </template>

    <div class="gs-module demo-deck">
      <div class="gs-head">
        <div class="gs-brand">
          <span class="gs-brand__maker">{{ copy.maker }}</span>
          <span class="gs-brand__name">{{ copy.model }}</span>
          <span class="gs-brand__tag">{{ copy.tag }}</span>
        </div>

        <GsDisplay
          :channel="selectedChannel"
          :is-rhythm="selectedChannel === RHYTHM_CHANNEL"
          :patch-name="patchNames[selectedChannel]"
          :program="selectedPart.program"
          :bank-msb="selectedPart.bankMsb"
          :efx-key="efxKey"
          :efx-name="efxName"
          :efx-standing="efxStandingLabel"
          :efx-inert="efxStandingKind !== 'adjustable'"
        />

        <div class="gs-transport">
          <label class="gs-realization">
            {{ copy.realization }}
            <select v-model="efxRealization" class="demo-field" :disabled="status === 'rendering'">
              <option value="modern">{{ copy.modern }}</option>
              <option value="classic">{{ copy.classic }}</option>
            </select>
          </label>
          <button
            type="button"
            class="gs-play"
            :class="{ 'gs-play--on': isPlaying }"
            :disabled="status === 'rendering'"
            :aria-label="isPlaying ? copy.stop : copy.play"
            @click="isPlaying ? stop() : play()"
          >
            <svg v-if="isPlaying" width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="6" y="6" width="12" height="12" rx="1.5" />
            </svg>
            <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5.5v13l11-6.5z" />
            </svg>
          </button>
          <button type="button" class="demo-btn demo-btn--sm" @click="reset">{{ copy.reset }}</button>
        </div>
      </div>

      <div class="gs-racks">
        <GsKitBrowser
          v-if="selectedChannel === RHYTHM_CHANNEL"
          :kits="drumKits"
          :selected-program="selectedPart.program"
          @select="selectProgram"
        />
        <GsPatchBrowser
          v-else
          :programs="gmPrograms"
          :family-names="gmFamilyNames"
          :variations="variations"
          :program="selectedPart.program"
          :bank-msb="selectedPart.bankMsb"
          @select="selectProgram"
          @select-bank="updatePart(selectedChannel, { bankMsb: $event })"
        />

        <GsEfxInspector
          :efx="state.efx"
          :param-meta="paramMeta"
          @select-type="selectType"
          @update-slot="updateSlot"
        />
      </div>

      <GsPartMixer
        :parts="state.parts"
        :selected-channel="selectedChannel"
        :patch-names="patchNames"
        :activity="activity"
        @select="selectedChannel = $event"
        @update="updatePart"
      />

      <GsSourcePanel
        :frames="frames"
        :status="status"
        :error="error"
        :dropped-file="droppedFile"
        :waveform="waveform"
        :playhead="playhead"
        :is-playing="isPlaying"
        @drop="onDrop"
        @clear-file="clearFile"
      />
    </div>
  </ToolShell>
</template>
