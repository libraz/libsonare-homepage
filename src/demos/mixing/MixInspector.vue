<script setup lang="ts">
/**
 * Everything about the selected strip that does not fit on it: the EQ graph,
 * the dynamics in detail, routing (pan mode and law, dual pan, channel delay,
 * polarity, solo safe) and the clip's position, trim and fades.
 */
import { computed } from 'vue';
import { TermLabel } from '@/components/ui';
import MixDynamicsEditor from '@/demos/mixing/MixDynamicsEditor.vue';
import MixEqEditor from '@/demos/mixing/MixEqEditor.vue';
import MixParam from '@/demos/mixing/MixParam.vue';
import { MAX_DURATION_SECONDS } from '@/demos/mixing/mixingConstants';
import { useMixingCopy } from '@/demos/mixing/mixingCopy';
import { clipPlayedSec } from '@/demos/mixing/mixingState';
import { useMixingTerm } from '@/demos/mixing/mixingTerms';
import {
  CHANNEL_DELAY_CONTROL,
  formatClock,
  PAN_CONTROL,
  type ParamControl,
} from '@/demos/mixing/mixingUi';
import type { MixingController } from '@/demos/mixing/useMixingStudio';

const props = defineProps<{ m: MixingController }>();
const emit = defineEmits<{ close: [] }>();

const copy = useMixingCopy();
const term = useMixingTerm();
const { m } = props;
const { selectedTrack, editLocked, pendingDelays, trackInfo } = m;

const track = computed(() => selectedTrack.value);
const info = computed(() => (track.value ? trackInfo.value.get(track.value.id) : undefined));
const played = computed(() => (track.value ? clipPlayedSec(track.value) : 0));

const seconds = (name: string, max: number): ParamControl => ({
  name,
  min: 0,
  max: Math.max(0.01, max),
  step: 0.01,
  unit: 's',
});
const startControl = seconds('startSec', MAX_DURATION_SECONDS * 2);
const offsetControl = computed(() => seconds('trimStartSec', track.value?.sourceDurationSec ?? 0));
const lengthControl = computed(() =>
  seconds(
    'lengthSec',
    (track.value?.sourceDurationSec ?? 0) - (track.value?.clip.trimStartSec ?? 0),
  ),
);
const fadeControl = computed(() => seconds('fadeSec', Math.min(10, played.value / 2)));

function setPanMode(mode: number): void {
  if (track.value) m.edit('setPanMode', track.value.id, mode);
}

function setPanLaw(law: number): void {
  if (track.value) m.edit('setPanLaw', track.value.id, law);
}

function trim(start: number, length: number | null): void {
  if (track.value) m.edit('trimClip', track.value.id, start, length);
}

function fades(fadeIn: number, fadeOut: number): void {
  if (track.value) m.edit('setClipFades', track.value.id, fadeIn, fadeOut);
}
</script>

<template>
  <section class="inspector" :aria-label="copy.inspector.title">
    <header class="inspector__head">
      <h3>{{ copy.inspector.title }}</h3>
      <span v-if="track" class="inspector__name">{{ track.name }}</span>
      <button type="button" class="inspector__close" :aria-label="copy.header.closeInspector" @click="emit('close')">×</button>
    </header>
    <p v-if="!track" class="inspector__empty">{{ copy.inspector.none }}</p>
    <template v-else>
      <p class="inspector__meta">
        <span>{{ info?.fileName ?? copy.arrange.noAudio }}</span>
        <span v-if="info">{{ (info.sampleRate / 1000).toFixed(info.sampleRate % 1000 ? 1 : 0) }} kHz · {{ info.channels === 1 ? copy.inspector.mono : copy.inspector.stereo }} · {{ formatClock(info.durationSec) }}</span>
      </p>

      <div class="inspector__section">
        <h4><TermLabel v-bind="term('eq')">{{ copy.inspector.eq }}</TermLabel></h4>
        <MixEqEditor :key="`eq-${track.id}`" :m="m" :track="track" />
      </div>

      <div class="inspector__section">
        <h4><TermLabel v-bind="term('gainReduction')">{{ copy.inspector.dynamics }}</TermLabel></h4>
        <MixDynamicsEditor :key="`dyn-${track.id}`" :m="m" :track="track" />
      </div>

      <div class="inspector__section">
        <h4>{{ copy.inspector.routing }}</h4>
        <div class="inspector__field">
          <TermLabel v-bind="term('panMode')">{{ term('panMode').title }}</TermLabel>
          <div class="inspector__segment" role="group" :aria-label="term('panMode').title">
            <button
              v-for="(label, mode) in copy.panModes"
              :key="label"
              type="button"
              :aria-pressed="track.panMode === mode"
              :disabled="editLocked"
              @click="setPanMode(mode)"
            >{{ label }}</button>
          </div>
        </div>
        <div class="inspector__field">
          <TermLabel v-bind="term('panLaw')">{{ term('panLaw').title }}</TermLabel>
          <div class="inspector__segment" role="group" :aria-label="term('panLaw').title">
            <button
              v-for="(label, law) in copy.panLaws"
              :key="label"
              type="button"
              :aria-pressed="track.panLaw === law"
              :disabled="editLocked"
              @click="setPanLaw(law)"
            >{{ label }}</button>
          </div>
        </div>
        <div v-if="track.panMode === 2" class="inspector__grid">
          <MixParam
            :model-value="track.dualPanLeft"
            :control="PAN_CONTROL"
            :label="`${term('dualPan').title} L`"
            :default-value="-1"
            :disabled="editLocked"
            @update:model-value="(v) => m.edit('setDualPan', track!.id, v, track!.dualPanRight)"
            @begin="m.begin"
            @end="m.end"
          />
          <MixParam
            :model-value="track.dualPanRight"
            :control="PAN_CONTROL"
            :label="`${term('dualPan').title} R`"
            :default-value="1"
            :disabled="editLocked"
            @update:model-value="(v) => m.edit('setDualPan', track!.id, track!.dualPanLeft, v)"
            @begin="m.begin"
            @end="m.end"
          />
        </div>
        <div class="inspector__grid">
          <MixParam
            :model-value="track.channelDelayMs"
            :control="CHANNEL_DELAY_CONTROL"
            :label="term('channelDelay').title"
            :default-value="0"
            :disabled="editLocked"
            :deferred="pendingDelays.has(track.id)"
            :hint="copy.inspector.delayHeld"
            @update:model-value="(v) => m.edit('setChannelDelay', track!.id, v)"
            @begin="m.begin"
            @end="m.end"
          />
          <div class="inspector__toggles">
            <button
              type="button"
              :aria-pressed="track.polarityLeft"
              :disabled="editLocked"
              @click="m.edit('setPolarity', track.id, 'left', !track.polarityLeft)"
            >{{ copy.inspector.polarityLeft }}</button>
            <button
              type="button"
              :aria-pressed="track.polarityRight"
              :disabled="editLocked"
              @click="m.edit('setPolarity', track.id, 'right', !track.polarityRight)"
            >{{ copy.inspector.polarityRight }}</button>
            <button
              type="button"
              :aria-pressed="track.soloSafe"
              :disabled="editLocked"
              @click="m.edit('setSoloSafe', track.id, !track.soloSafe)"
            >{{ copy.console.safe }}</button>
          </div>
        </div>
        <p v-if="pendingDelays.has(track.id)" class="inspector__held" role="status">{{ copy.inspector.delayHeld }}</p>
      </div>

      <div class="inspector__section">
        <h4>{{ copy.inspector.clip }}</h4>
        <div class="inspector__grid">
          <MixParam
            :model-value="track.clip.startSec"
            :control="startControl"
            :label="copy.inspector.start"
            :default-value="0"
            :disabled="editLocked"
            @update:model-value="(v) => m.edit('moveClip', track!.id, v)"
            @begin="m.begin"
            @end="m.end"
          />
          <MixParam
            :model-value="track.clip.trimStartSec"
            :control="offsetControl"
            :label="copy.inspector.trimStart"
            :default-value="0"
            :disabled="editLocked"
            @update:model-value="(v) => trim(v, track!.clip.lengthSec)"
            @begin="m.begin"
            @end="m.end"
          />
          <MixParam
            :model-value="played"
            :control="lengthControl"
            :label="copy.inspector.length"
            :default-value="lengthControl.max"
            :disabled="editLocked"
            @update:model-value="(v) => trim(track!.clip.trimStartSec, v)"
            @begin="m.begin"
            @end="m.end"
          />
          <MixParam
            :model-value="track.clip.fadeInSec"
            :control="fadeControl"
            :label="copy.inspector.fadeIn"
            :default-value="0"
            :disabled="editLocked"
            @update:model-value="(v) => fades(v, track!.clip.fadeOutSec)"
            @begin="m.begin"
            @end="m.end"
          />
          <MixParam
            :model-value="track.clip.fadeOutSec"
            :control="fadeControl"
            :label="copy.inspector.fadeOut"
            :default-value="0"
            :disabled="editLocked"
            @update:model-value="(v) => fades(track!.clip.fadeInSec, v)"
            @begin="m.begin"
            @end="m.end"
          />
          <button
            type="button"
            class="inspector__full"
            :disabled="editLocked || track.clip.lengthSec === null"
            @click="trim(track.clip.trimStartSec, null)"
          >{{ copy.inspector.full }}</button>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.inspector {
  display: grid;
  align-content: start;
  gap: 12px;
  min-width: 0;
  padding: 10px 12px 14px;
  border: 1px solid var(--demo-border);
  border-radius: 6px;
  background: var(--demo-bg-elevated);
}

.inspector__head {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: baseline;
  gap: 10px;
}

.inspector__head h3,
.inspector__section h4 {
  margin: 0;
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: var(--demo-label-size);
  font-weight: var(--demo-label-weight);
  letter-spacing: var(--demo-label-tracking);
  text-transform: uppercase;
}

.inspector__name {
  overflow: hidden;
  color: var(--demo-text-strong);
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.inspector__close {
  display: none;
  padding: 0 6px;
  border: 0;
  background: transparent;
  color: var(--demo-text-muted);
  font-size: 18px;
  cursor: pointer;
}

.inspector__empty,
.inspector__meta {
  margin: 0;
  color: var(--demo-text-muted);
  font-size: 12px;
}

.inspector__meta {
  display: grid;
  gap: 2px;
  font-family: var(--font-mono);
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
}

.inspector__section {
  display: grid;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid var(--demo-border);
}

.inspector__field {
  display: grid;
  gap: 4px;
}

.inspector__segment {
  display: flex;
  width: 100%;
  border: 1px solid var(--demo-border-strong);
  border-radius: 4px;
  overflow: hidden;
}

.inspector__segment button {
  flex: 1 1 0;
  min-width: 0;
  padding: 4px 2px;
  border: 0;
  border-left: 1px solid var(--demo-border);
  background: var(--demo-control-bg);
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  cursor: pointer;
}

.inspector__segment button:first-child {
  border-left: 0;
}

.inspector__segment button[aria-pressed='true'] {
  background: var(--demo-accent-subtle);
  color: var(--demo-accent);
  font-weight: 600;
}

.inspector__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 14px;
  align-items: end;
}

.inspector__toggles {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 3px;
}

.inspector__toggles button,
.inspector__full {
  padding: 4px 0;
  border: 1px solid var(--demo-border-strong);
  border-radius: 3px;
  background: var(--demo-control-bg);
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  cursor: pointer;
}

.inspector__toggles button[aria-pressed='true'] {
  border-color: var(--demo-accent);
  background: var(--demo-accent);
  color: var(--demo-on-accent);
}

.inspector button:disabled {
  cursor: not-allowed;
  opacity: var(--demo-disabled-opacity);
}

.inspector__held {
  margin: 0;
  color: var(--demo-warn-text);
  font-family: var(--font-mono);
  font-size: 10px;
}

@media (max-width: 959px) {
  .inspector__close {
    display: block;
  }
}
</style>
