<script setup lang="ts">
/**
 * Studio: transport and timeline on top; the signal-chain rack, the selected
 * module's editor and the meter bridge below. Reference, assistant and export
 * sit under the editor so the centre column runs as long as the meters.
 * Every control edits the one project state through the controller, so it
 * plays live and renders the same on export.
 */
import { computed, ref } from 'vue';
import MasteringExportPanel from '@/demos/mastering/MasteringExportPanel.vue';
import MasteringInsights from '@/demos/mastering/MasteringInsights.vue';
import MasteringMeterBridge from '@/demos/mastering/MasteringMeterBridge.vue';
import MasteringModuleEditor from '@/demos/mastering/MasteringModuleEditor.vue';
import MasteringMonitor from '@/demos/mastering/MasteringMonitor.vue';
import MasteringPanel from '@/demos/mastering/MasteringPanel.vue';
import MasteringRack from '@/demos/mastering/MasteringRack.vue';
import MasteringReferencePanel from '@/demos/mastering/MasteringReferencePanel.vue';
import MasteringSourceBar from '@/demos/mastering/MasteringSourceBar.vue';
import MasteringTimeline from '@/demos/mastering/MasteringTimeline.vue';
import { useMasteringCopy } from '@/demos/mastering/masteringCopy';
import type { MasteringModuleId } from '@/demos/mastering/masteringUi';
import type { MasteringController } from '@/demos/mastering/useMastering';

const props = defineProps<{
  m: MasteringController;
  glossaryBase: string;
}>();

const copy = useMasteringCopy();
const {
  state,
  job,
  editLocked,
  hasProgram,
  sourceInfo,
  referenceInfo,
  referenceReady,
  referenceAnalysis,
  repairDetection,
  canMonitorReference,
  loading,
  pendingRestore,
  restoreNotices,
  error,
  waveform,
  duration,
  loop,
  lastRender,
  resetFlash,
  prepareFailed,
  fitStale,
  targetLufs,
  matchGains,
  matchPending,
  wasm,
  sonare,
  metering,
  insights,
} = props.m;
const { playing, position, context } = sonare;
const { reading, spectrumFreqs, outputDb, inputDb, scopeMid, scopeSide } = metering;

const selected = ref<MasteringModuleId>('compressor');
const repairProgress = computed(() => (job.value?.kind === 'prepare' ? job.value.progress : null));
const errorText = computed(() => (error.value ? copy.value.errors[error.value] : null));
const lra = computed(() => lastRender.value?.result.loudnessRange ?? Number.NaN);
const sampleRate = computed(
  () => context.value?.sampleRate ?? sourceInfo.value?.sampleRate ?? 48000,
);
</script>

<template>
  <div class="studio">
    <MasteringSourceBar
      class="studio__source"
      :info="sourceInfo"
      :loading="loading === 'source'"
      :disabled="editLocked"
      :pending-restore="pendingRestore"
      :restored-name="state.source?.fileName ?? null"
      :notices="restoreNotices"
      :error="errorText"
      compact
      @file="m.loadSource"
      @demo="m.loadDemo"
      @dismiss-notices="restoreNotices = []"
    />

    <div class="studio__transport">
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
    </div>

    <div class="studio__grid">
      <MasteringRack
        class="studio__rack"
        :state="state"
        :selected="selected"
        :gr-db="reading.grDb"
        :insert-gr-db="reading.insertGrDb"
        :reset-flash="resetFlash"
        :repair-progress="repairProgress"
        :repair-failed="prepareFailed"
        :disabled="editLocked"
        @select="selected = $event"
        @bypass="(slot, bypassed) => m.edit('setInsertBypassed', slot, bypassed)"
      />

      <div class="studio__centre">
        <MasteringModuleEditor
          :module="selected"
          :state="state"
          :glossary-base="glossaryBase"
          :freqs="spectrumFreqs"
          :output-db="outputDb"
          :input-db="inputDb"
          :wasm="wasm"
          :sample-rate="sampleRate"
          :repair-progress="repairProgress"
          :repair-failed="prepareFailed"
          :repair-detection="repairDetection"
          :repair-detecting="job?.kind === 'detect'"
          :can-detect="sourceInfo !== null"
          :disabled="editLocked"
          @param="(slot, name, value) => m.edit('setInsertParam', slot, name, value)"
          @bypass="(slot, bypassed) => m.edit('setInsertBypassed', slot, bypassed)"
          @reset="(slot) => m.edit('resetInsert', slot)"
          @band="(index, patch) => m.edit('setEqBand', index, patch)"
          @clear-match="m.edit('clearMatchEq')"
          @repair-enabled="(stage, on) => m.edit('setRepairStageEnabled', stage, on)"
          @repair-param="(stage, name, value) => m.edit('setRepairParam', stage, name, value)"
          @retry-repair="m.runPrepare"
          @cancel-repair="m.cancelJob"
          @detect-repair="m.detectRepair"
          @apply-repair-suggestion="m.applyRepairSuggestion"
          @begin="m.begin"
          @end="m.end"
        />
        <div class="studio__aux">
          <MasteringPanel :title="copy.reference.title">
            <MasteringReferencePanel
              :info="referenceInfo"
              :ready="referenceReady"
              :analysis="referenceAnalysis"
              :has-program="hasProgram"
              :analyzing="job?.kind === 'reference'"
              :disabled="editLocked"
              @load="m.loadReference"
              @clear="m.clearReference"
              @apply-match="m.applyMatchEq"
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
        <MasteringPanel :title="copy.export.title">
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
        </MasteringPanel>
      </div>

      <aside class="studio__right">
        <MasteringMeterBridge
          :reading="reading"
          :lane="state.monitor.lane"
          :target-lufs="targetLufs"
          :lra="lra"
          :scope-mid="scopeMid"
          :scope-side="scopeSide"
          :freqs="spectrumFreqs"
          :output-db="outputDb"
        />
      </aside>
    </div>
  </div>
</template>

<style scoped>
.studio {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.studio__transport {
  display: grid;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid var(--demo-border);
  border-radius: var(--demo-radius-md);
  background: var(--demo-bg-elevated);
}

.studio__grid {
  display: grid;
  grid-template-columns: minmax(230px, 270px) minmax(0, 1fr) minmax(280px, 340px);
  gap: 12px;
  align-items: start;
}

.studio__rack {
  position: sticky;
  top: 12px;
}

.studio__centre {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.studio__right {
  min-width: 0;
  container-type: inline-size;
}

.studio__aux {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

@media (max-width: 1280px) {
  .studio__grid {
    grid-template-columns: minmax(220px, 250px) minmax(0, 1fr);
  }

  .studio__right {
    grid-column: 1 / -1;
  }

  .studio__aux {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 959px) {
  .studio__grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .studio__rack {
    position: static;
  }
}
</style>
