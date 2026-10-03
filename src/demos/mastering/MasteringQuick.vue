<script setup lang="ts">
/**
 * Quick: five steps (source, recording condition, genre, delivery target,
 * fine-tune) beside a result pane that plays live, meters, compares A/B/R and
 * exports. The steps edit the same project state Studio shows in detail.
 */
import { computed } from 'vue';
import MasteringChoiceGrid, {
  type MasteringChoice,
} from '@/demos/mastering/MasteringChoiceGrid.vue';
import MasteringExportPanel from '@/demos/mastering/MasteringExportPanel.vue';
import MasteringFineTune from '@/demos/mastering/MasteringFineTune.vue';
import MasteringInsights from '@/demos/mastering/MasteringInsights.vue';
import MasteringMeterBridge from '@/demos/mastering/MasteringMeterBridge.vue';
import MasteringMonitor from '@/demos/mastering/MasteringMonitor.vue';
import MasteringPanel from '@/demos/mastering/MasteringPanel.vue';
import MasteringPlatformSelector from '@/demos/mastering/MasteringPlatformSelector.vue';
import MasteringSourceBar from '@/demos/mastering/MasteringSourceBar.vue';
import MasteringTimeline from '@/demos/mastering/MasteringTimeline.vue';
import { useMasteringCopy } from '@/demos/mastering/masteringCopy';
import {
  MASTERING_PRESET_TARGETS,
  MASTERING_PRESETS,
  MASTERING_VENUES,
} from '@/demos/mastering/masteringUi';
import type {
  MasteringController,
  MasteringPresetId,
  MasteringVenueId,
} from '@/demos/mastering/useMastering';

const props = defineProps<{ m: MasteringController }>();

const copy = useMasteringCopy();
const {
  state,
  job,
  editLocked,
  hasProgram,
  sourceInfo,
  canMonitorReference,
  loading,
  pendingRestore,
  restoreNotices,
  error,
  waveform,
  duration,
  loop,
  lastRender,
  fitStale,
  targetLufs,
  matchGains,
  matchPending,
  sonare,
  metering,
  insights,
} = props.m;
const { playing, position } = sonare;
const { reading } = metering;

const venues = computed<MasteringChoice<MasteringVenueId>[]>(() =>
  MASTERING_VENUES.map(({ id, icon }) => ({ id, icon, ...copy.value.venues[id] })),
);
const presets = computed<MasteringChoice<MasteringPresetId>[]>(() =>
  MASTERING_PRESETS.map(({ id, icon }) => ({ id, icon, ...copy.value.presets[id] })),
);
const errorText = computed(() => (error.value ? copy.value.errors[error.value] : null));
const lra = computed(() => lastRender.value?.result.loudnessRange ?? Number.NaN);
</script>

<template>
  <div class="quick">
    <div class="quick__steps">
      <MasteringPanel :title="copy.quick.steps.source" :step="1">
        <MasteringSourceBar
          :info="sourceInfo"
          :loading="loading === 'source'"
          :disabled="editLocked"
          :pending-restore="pendingRestore"
          :restored-name="state.source?.fileName ?? null"
          :notices="restoreNotices"
          :error="errorText"
          @file="m.loadSource"
          @demo="m.loadDemo"
          @dismiss-notices="restoreNotices = []"
        />
      </MasteringPanel>
      <MasteringPanel :title="copy.quick.steps.venue" :step="2">
        <p class="quick__hint">{{ copy.quick.venueHint }}</p>
        <MasteringChoiceGrid
          :model-value="state.quick.venue"
          :options="venues"
          :label="copy.quick.steps.venue"
          :disabled="editLocked"
          @update:model-value="(venue) => m.edit('selectVenue', venue)"
        />
      </MasteringPanel>
      <MasteringPanel :title="copy.quick.steps.genre" :step="3">
        <MasteringChoiceGrid
          :model-value="state.quick.preset"
          :options="presets"
          :label="copy.quick.steps.genre"
          :disabled="editLocked"
          @update:model-value="(preset) => m.edit('selectPreset', preset)"
        />
      </MasteringPanel>
      <MasteringPanel :title="copy.quick.steps.platform" :step="4">
        <MasteringPlatformSelector
          :platform="state.quick.platform"
          :custom-lufs="state.quick.customLufs"
          :target-lufs="targetLufs"
          :recommended-lufs="MASTERING_PRESET_TARGETS[state.quick.preset]"
          :preset-name="copy.presets[state.quick.preset].name"
          :disabled="editLocked"
          @platform="(platform) => m.edit('selectPlatform', platform)"
          @custom-lufs="(lufs) => m.edit('setCustomLufs', lufs)"
          @begin="m.begin"
          @end="m.end"
        />
      </MasteringPanel>
      <MasteringPanel :title="copy.quick.steps.fineTune" :step="5">
        <MasteringFineTune
          :macros="state.quick.macros"
          :disabled="editLocked"
          @macro="(id, value) => m.edit('setMacro', id, value)"
          @begin="m.begin"
          @end="m.end"
        />
      </MasteringPanel>
      <MasteringPanel :title="copy.insights.title">
        <MasteringInsights
          :has-program="hasProgram"
          :analyzing="insights.isAnalyzingInsights.value"
          :profile-items="insights.insightProfileItems.value"
          :suggestions="insights.insightSuggestions.value"
          :preview="insights.insightPreview.value"
          :unmapped="insights.insightReport.value?.unmapped ?? []"
          :can-apply="Boolean(insights.insightReport.value?.chainParams)"
          :disabled="editLocked"
          @apply="m.applyAssistant"
          @refresh="insights.analyzeSourceInsights"
        />
      </MasteringPanel>
    </div>

    <aside class="quick__result">
      <MasteringPanel :title="copy.quick.result">
        <div class="quick__result-body">
          <p class="quick__hint">{{ copy.quick.liveNote }}</p>
          <MasteringTimeline
            :peaks="waveform"
            :duration="duration"
            :position="position"
            :playing="playing"
            :loop="loop"
            :short-term="lastRender?.result.shortTermLufs ?? null"
            :target-lufs="targetLufs"
            :disabled="!hasProgram"
            @play="m.play"
            @stop="m.stop"
            @seek="m.seek"
            @to-home="m.seek(0)"
            @toggle-loop="m.toggleLoop"
            @update:loop="m.setLoop"
          />
          <MasteringMonitor
            :lane="state.monitor.lane"
            :match-loudness="state.monitor.matchLoudness"
            :gains="matchGains"
            :matching="matchPending"
            :can-reference="canMonitorReference"
            :disabled="editLocked"
            @lane="m.setLane"
            @match="(on) => m.edit('setMatchLoudness', on)"
          />
          <MasteringMeterBridge
            variant="strip"
            :reading="reading"
            :lane="state.monitor.lane"
            :target-lufs="targetLufs"
            :lra="lra"
              :scope-mid="null"
            :scope-side="null"
            :freqs="null"
            :output-db="null"
          />
          <MasteringExportPanel
            :fit="state.loudness.fit"
            :fit-stale="fitStale"
            :target-lufs="targetLufs"
            :has-program="hasProgram"
            :job="job"
            :last-render="lastRender"
            :disabled="editLocked"
            @fit="m.fit"
            @export="m.exportMaster"
            @download="m.downloadRender"
            @report="m.downloadReport"
            @cancel="m.cancelJob"
          />
        </div>
      </MasteringPanel>
    </aside>
  </div>
</template>

<style scoped>
.quick {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(360px, 440px);
  gap: 12px;
  align-items: start;
}

.quick__steps {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.quick__result {
  position: sticky;
  top: 12px;
  min-width: 0;
}

.quick__result-body {
  display: grid;
  gap: 14px;
}

.quick__hint {
  margin: 0 0 10px;
  color: var(--demo-text-muted);
  font-size: 12px;
  line-height: 1.5;
}

.quick__result-body .quick__hint {
  margin: 0;
}

@media (max-width: 959px) {
  .quick {
    grid-template-columns: minmax(0, 1fr);
  }

  .quick__result {
    position: static;
  }
}
</style>
