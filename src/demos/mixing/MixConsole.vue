<script setup lang="ts">
/**
 * The console row: the track strips in lane order, a placeholder for each
 * free track slot, the Reverb and Delay returns and the three VCA masters.
 * The row scrolls sideways when the window is narrower than the desk.
 */
import { computed } from 'vue';
import MixBusStrip from '@/demos/mixing/MixBusStrip.vue';
import MixFader from '@/demos/mixing/MixFader.vue';
import MixStrip from '@/demos/mixing/MixStrip.vue';
import { MAX_TRACKS, VCA_GROUP_IDS } from '@/demos/mixing/mixingConstants';
import { useMixingCopy } from '@/demos/mixing/mixingCopy';
import { AUX_BUSES } from '@/demos/mixing/mixingState';
import { formatFader } from '@/demos/mixing/mixingUi';
import type { MixingController } from '@/demos/mixing/useMixingStudio';
import { fill } from '@/utils/template';

const props = defineProps<{ m: MixingController }>();
const emit = defineEmits<{ add: [] }>();

const copy = useMixingCopy();
const { m } = props;
const { view, editLocked, metering } = m;
const { frame } = metering;

const free = computed(() => Math.max(0, MAX_TRACKS - view.value.tracks.length));
</script>

<template>
  <div class="console" role="region" :aria-label="copy.console.title" tabindex="-1">
    <div class="console__desk">
      <div class="console__group">
        <MixStrip
          v-for="(track, index) in view.tracks"
          :key="track.id"
          :m="m"
          :track="track"
          :index="index"
          :reading="frame.tracks[track.id]"
        />
        <button
          v-for="slot in free"
          :key="`free-${slot}`"
          type="button"
          class="console__free"
          :disabled="editLocked"
          @click="emit('add')"
        >
          <span>{{ String(view.tracks.length + slot).padStart(2, '0') }}</span>
          <span class="console__free-label">{{ copy.console.emptySlot }}</span>
        </button>
      </div>

      <div class="console__group console__group--returns">
        <p class="console__label">{{ copy.console.returns }}</p>
        <div class="console__row">
          <MixBusStrip v-for="bus in AUX_BUSES" :key="bus" :m="m" :bus="bus" :reading="frame.buses[bus]" />
        </div>
      </div>

      <div class="console__group console__group--vca">
        <p class="console__label">{{ copy.console.vcaMasters }}</p>
        <div class="console__row">
          <div v-for="group in VCA_GROUP_IDS" :key="group" class="console__vca">
            <span class="console__vca-name">{{ group }}</span>
            <MixFader
              :model-value="view.vcaGains[group]"
              :label="fill(copy.console.vcaFader, { id: group })"
              :disabled="editLocked"
              @update:model-value="(v) => m.edit('setVcaGain', group, v)"
              @begin="m.begin"
              @end="m.end"
            />
            <output>{{ formatFader(view.vcaGains[group]) }}</output>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.console {
  overflow-x: auto;
  overscroll-behavior-x: contain;
  padding-bottom: 6px;
  scrollbar-width: thin;
}

.console:focus-visible {
  outline: 2px solid var(--demo-accent);
  outline-offset: 2px;
}

.console__desk {
  display: flex;
  align-items: stretch;
  gap: 14px;
  width: max-content;
}

.console__group {
  display: flex;
  gap: 5px;
}

.console__group--returns,
.console__group--vca {
  flex-direction: column;
  gap: 4px;
  padding-left: 14px;
  border-left: 1px solid var(--demo-border-strong);
}

.console__row {
  display: flex;
  flex: 1;
  gap: 5px;
}

.console__label {
  margin: 0;
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: var(--demo-label-size);
  font-weight: var(--demo-label-weight);
  letter-spacing: var(--demo-label-tracking);
  text-transform: uppercase;
}

.console__free {
  display: grid;
  align-content: start;
  justify-items: start;
  gap: 4px;
  width: 40px;
  padding: 8px 6px;
  border: 1px dashed var(--demo-border-strong);
  border-radius: 6px;
  background: transparent;
  color: var(--demo-text-faint);
  font-family: var(--font-mono);
  font-size: var(--demo-label-size);
  letter-spacing: var(--demo-label-tracking);
  text-transform: uppercase;
  cursor: pointer;
}

.console__free-label {
  writing-mode: vertical-rl;
}

.console__free:hover:not(:disabled) {
  border-color: var(--demo-accent-border);
  color: var(--demo-accent);
}

.console__free:disabled {
  cursor: not-allowed;
}

.console__vca {
  display: grid;
  grid-template-rows: auto 1fr auto;
  justify-items: center;
  gap: 6px;
  width: 54px;
  padding: 8px 4px 9px;
  border: 1px solid var(--demo-border);
  border-radius: 6px;
  background: var(--demo-bg-elevated);
}

.console__vca :deep(.fader) {
  --fader-height: 220px;
}

.console__vca-name {
  color: var(--demo-text-strong);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
}

.console__vca output {
  color: var(--demo-text);
  font-family: var(--font-mono);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}
</style>
