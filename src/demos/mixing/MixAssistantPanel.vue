<script setup lang="ts">
/**
 * The mix assistant: a Worker run of `suggestMixScene`, then A (the user's
 * mix) against B (the suggestion applied on top of it) at the same playhead,
 * adopted whole or discarded. What the console cannot play live is listed with
 * the reason; source classes are shown as the estimates they are.
 */
import { computed } from 'vue';
import { TermLabel } from '@/components/ui';
import { describeMixChanges, type MixChange } from '@/demos/mixing/mixAssistantChanges';
import { useMixingCopy } from '@/demos/mixing/mixingCopy';
import { SEND_OFF_DB } from '@/demos/mixing/mixingState';
import { useMixingTerm } from '@/demos/mixing/mixingTerms';
import { formatNumber, formatPan } from '@/demos/mixing/mixingUi';
import type { MixingController } from '@/demos/mixing/useMixingStudio';
import { fill } from '@/utils/template';

const props = defineProps<{ m: MixingController }>();

const copy = useMixingCopy();
const term = useMixingTerm();
const { m } = props;
const { suggestion, match, ab, job, hasAudio, editLocked, state } = m;

const result = computed(() => suggestion.value?.suggestion ?? null);
const running = computed(() => job.value?.kind === 'suggest');
const matching = computed(() => job.value?.kind === 'match');

/** The active side's level match, e.g. "Level matched: A −4.3 dB"; the unreduced side reads 0. */
const matchText = computed(() => {
  if (!match.value) return '';
  const side = ab.value === 'b' ? 'B' : 'A';
  const db = ab.value === 'b' ? match.value.bDb : match.value.aDb;
  return fill(copy.value.assistant.matched, { side, value: formatNumber(db, 1) });
});

const nameOf = (trackId: number | string) =>
  state.value.tracks.find((track) => String(track.id) === String(trackId))?.name ?? String(trackId);

const classes = computed(() =>
  (result.value?.classification ?? []).map((entry) => ({
    id: entry.trackId,
    name: nameOf(entry.trackId),
    source:
      copy.value.assistant.sourceClasses[
        entry.source as keyof typeof copy.value.assistant.sourceClasses
      ] ?? entry.source,
    confidence: Math.round(entry.confidence * 100),
    usable: entry.usable,
  })),
);

const crowded = computed(() =>
  (result.value?.mix.crowdedBands ?? []).map((band) => ({
    band: copy.value.assistant.bands[band.band] ?? band.band,
    crowding: `${Math.round(band.crowding * 100)}%`,
  })),
);

const monoRisks = computed(() =>
  (result.value?.mix.monoRisks ?? []).map((risk) => ({
    name: nameOf(risk.stripId),
    correlation: formatNumber(risk.correlation, 2),
    wideLow: risk.wideLowEnd,
  })),
);

function changeText(item: MixChange): string {
  const c = copy.value.assistant.change;
  switch (item.kind) {
    case 'trim':
      return fill(c.trim, { value: formatNumber(item.deltaDb, 1, true) });
    case 'fader':
      return fill(c.fader, { value: formatNumber(item.deltaDb, 1, true) });
    case 'pan':
      return fill(c.pan, { value: formatPan(item.pan) });
    case 'width':
      return fill(c.width, { value: Math.round(item.width * 100) });
    case 'dynamics': {
      const slot = copy.value.slots[item.slot];
      const threshold = formatNumber(item.thresholdDb ?? 0, 1);
      return item.ratio === undefined
        ? fill(c.dynamicsThreshold, { slot, threshold })
        : fill(c.dynamicsRatio, { slot, threshold, ratio: formatNumber(item.ratio, 1) });
    }
    case 'eq':
      return fill(c.eq, {
        type: copy.value.inspector.bandTypes[item.type],
        freq: Math.round(item.frequencyHz),
        gain: formatNumber(item.gainDb, 1, true),
      });
    case 'send': {
      const bus = copy.value.buses[item.bus];
      return item.levelDb <= SEND_OFF_DB
        ? fill(c.sendOff, { bus })
        : fill(c.send, { bus, value: formatNumber(item.levelDb, 1) });
    }
    case 'master':
      return fill(c.master, { value: formatNumber(item.deltaDb, 1, true) });
  }
}

const changes = computed(() =>
  result.value
    ? describeMixChanges(result.value.patch, state.value).map((item) => ({
        name: item.kind === 'master' ? '' : nameOf(item.trackId),
        text: changeText(item),
      }))
    : [],
);

const unapplied = computed(() =>
  (result.value?.unapplied ?? []).map((item) => ({
    source: nameOf(item.source),
    name: item.name,
    reason: copy.value.assistant.reasons[item.reason],
  })),
);
</script>

<template>
  <section class="assist" :aria-label="copy.assistant.title">
    <header class="assist__head">
      <h3><TermLabel v-bind="term('assistant')">{{ copy.assistant.title }}</TermLabel></h3>
      <button
        type="button"
        class="assist__run"
        :disabled="!hasAudio || (editLocked && ab !== 'b') || running"
        @click="m.suggest"
      >{{ result ? copy.assistant.rerun : copy.assistant.run }}</button>
    </header>

    <p v-if="!result && !running" class="assist__empty">{{ copy.assistant.empty }}</p>
    <div v-if="(running || matching) && job" class="assist__job" role="status">
      <span>{{ copy.jobs.stages[job.stage] }} {{ Math.round(job.progress * 100) }}%</span>
      <span class="assist__bar" aria-hidden="true"><i :style="{ width: `${job.progress * 100}%` }"></i></span>
      <button type="button" @click="m.cancelJob">{{ copy.common.cancel }}</button>
    </div>

    <template v-if="result">
      <div class="assist__ab" role="group" :aria-label="copy.assistant.compare">
        <button type="button" :aria-pressed="ab === 'a'" @click="m.setAb('a')">{{ copy.assistant.a }}</button>
        <button type="button" :aria-pressed="ab === 'b'" @click="m.setAb('b')">{{ copy.assistant.b }}</button>
      </div>
      <div class="assist__actions">
        <button type="button" class="assist__adopt" @click="m.adoptSuggestion">{{ copy.assistant.adopt }}</button>
        <button type="button" @click="m.discardSuggestion">{{ copy.assistant.discard }}</button>
      </div>
      <p v-if="matching || matchText" class="assist__match" role="status">
        {{ matching ? copy.assistant.matching : matchText }}
      </p>
      <p class="assist__meta">{{ copy.assistant.matchHint }}</p>
      <p v-if="ab === 'b'" class="assist__note" role="status">{{ copy.assistant.auditioning }}</p>
      <p class="assist__meta">{{ fill(copy.assistant.analysed, { sec: suggestion?.analyzedSec ?? 0 }) }}</p>

      <div class="assist__block">
        <h4>{{ copy.assistant.classes }}</h4>
        <ul class="assist__list">
          <li v-for="entry in classes" :key="entry.id">
            <span>{{ entry.name }}</span>
            <span v-if="entry.usable" class="assist__value">{{ entry.source }} · {{ entry.confidence }}%</span>
            <span v-else class="assist__value assist__value--muted">{{ copy.assistant.unusable }}</span>
          </li>
        </ul>
      </div>

      <div v-if="crowded.length" class="assist__block">
        <h4>{{ copy.assistant.crowded }}</h4>
        <p class="assist__meta">{{ copy.assistant.crowdedHint }}</p>
        <p class="assist__chips">
          <span v-for="band in crowded" :key="band.band" class="assist__chip">{{ band.band }} {{ band.crowding }}</span>
        </p>
      </div>

      <div v-if="monoRisks.length" class="assist__block">
        <h4>{{ copy.assistant.monoRisks }}</h4>
        <ul class="assist__list">
          <li v-for="risk in monoRisks" :key="risk.name">
            <span>{{ risk.name }}</span>
            <span class="assist__value">{{ fill(copy.assistant.correlation, { value: risk.correlation }) }}<template v-if="risk.wideLow"> · {{ copy.assistant.wideLow }}</template></span>
          </li>
        </ul>
      </div>

      <div class="assist__block">
        <h4>{{ copy.assistant.changes }}</h4>
        <p v-if="changes.length === 0" class="assist__meta">{{ copy.assistant.noChanges }}</p>
        <ul v-else class="assist__list">
          <li v-for="(item, i) in changes" :key="i">
            <span>{{ item.name }}</span>
            <span class="assist__value">{{ item.text }}</span>
          </li>
        </ul>
      </div>

      <details class="assist__block">
        <summary>{{ fill(copy.assistant.unapplied, { n: unapplied.length }) }}</summary>
        <p v-if="unapplied.length === 0" class="assist__meta">{{ copy.assistant.noneUnapplied }}</p>
        <ul v-else class="assist__list">
          <li v-for="(item, i) in unapplied" :key="i">
            <span>{{ item.source }} · <code>{{ item.name }}</code></span>
            <span class="assist__value assist__value--muted">{{ item.reason }}</span>
          </li>
        </ul>
      </details>
    </template>
  </section>
</template>

<style scoped>
.assist {
  display: grid;
  align-content: start;
  gap: 10px;
  min-width: 0;
  padding: 10px 12px 12px;
  border: 1px solid var(--demo-border);
  border-radius: 6px;
  background: var(--demo-bg-elevated);
}

.assist__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.assist__head h3,
.assist__block h4,
.assist__block summary {
  margin: 0;
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: var(--demo-label-size);
  font-weight: var(--demo-label-weight);
  letter-spacing: var(--demo-label-tracking);
  text-transform: uppercase;
}

.assist__block summary {
  cursor: pointer;
}

.assist button {
  padding: 4px 10px;
  border: 1px solid var(--demo-border-strong);
  border-radius: 4px;
  background: var(--demo-control-bg);
  color: var(--demo-text);
  font-family: var(--font-mono);
  font-size: 11px;
  cursor: pointer;
}

.assist button:disabled {
  cursor: not-allowed;
  opacity: var(--demo-disabled-opacity);
}

.assist button.assist__run,
.assist button.assist__adopt {
  border-color: var(--demo-accent);
  background: var(--demo-accent);
  color: var(--demo-on-accent);
}

.assist__empty,
.assist__meta,
.assist__match,
.assist__note {
  margin: 0;
  color: var(--demo-text-muted);
  font-size: 12px;
}

.assist__note {
  padding: 6px 8px;
  border: 1px solid var(--demo-warn-border);
  border-radius: 4px;
  background: var(--demo-warn-bg);
  color: var(--demo-warn-text);
}

.assist__job {
  display: grid;
  grid-template-columns: auto minmax(60px, 1fr) auto;
  align-items: center;
  gap: 10px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.assist__bar {
  height: 3px;
  overflow: hidden;
  border-radius: 2px;
  background: var(--demo-border);
}

.assist__bar i {
  display: block;
  height: 100%;
  background: var(--demo-accent);
}

.assist__ab {
  display: flex;
  width: 100%;
}

.assist__ab button {
  flex: 1 1 0;
  border-radius: 0;
}

.assist__ab button:first-child {
  border-radius: 4px 0 0 4px;
}

.assist__ab button:last-child {
  border-left: 0;
  border-radius: 0 4px 4px 0;
}

.assist__ab button[aria-pressed='true'] {
  background: var(--demo-accent-subtle);
  color: var(--demo-accent);
  font-weight: 600;
}

.assist__actions {
  display: flex;
  gap: 6px;
}

.assist__block {
  display: grid;
  gap: 6px;
  padding-top: 8px;
  border-top: 1px solid var(--demo-border);
}

.assist__list {
  display: grid;
  gap: 3px;
  margin: 0;
  padding: 0;
  font-size: 12px;
}

.assist__list {
  list-style: none;
}

.assist__list li {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  color: var(--demo-text-strong);
}

.assist__value {
  color: var(--demo-text);
  font-family: var(--font-mono);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.assist__value--muted {
  color: var(--demo-text-muted);
}

.assist__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 0;
}

.assist__chip {
  padding: 2px 6px;
  border: 1px solid var(--demo-warn-border);
  border-radius: 3px;
  background: var(--demo-warn-bg);
  color: var(--demo-warn-text);
  font-family: var(--font-mono);
  font-size: 10.5px;
}
</style>
