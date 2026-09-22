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
import GsEfxInspector from './GsEfxInspector.vue';
import GsKitBrowser from './GsKitBrowser.vue';
import GsPartMixer from './GsPartMixer.vue';
import GsPatchBrowser from './GsPatchBrowser.vue';
import GsSourcePanel from './GsSourcePanel.vue';
import './gsModule.css';
import { useI18n } from '@/composables/useI18n';
import { GM_PROGRAM_NAMES_JA } from './gsNames';
import { type GsPartState, RHYTHM_CHANNEL, withEfxType } from './gsState';
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

const { isLocale } = useI18n();
const ja = computed(() => isLocale('ja'));

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
</template>
