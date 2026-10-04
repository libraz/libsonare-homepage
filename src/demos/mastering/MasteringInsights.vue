<script setup lang="ts">
/**
 * The source assistant: the program's profile, the assistant's suggested
 * moves with the settings this chain cannot take, and the per-platform
 * estimate of the last export.
 */
import { computed } from 'vue';
import { useMasteringCopy } from '@/demos/mastering/masteringCopy';
import { assistantNoteText, unmappedLabels } from '@/demos/mastering/masteringInsightLabels';
import { formatNumber } from '@/demos/mastering/masteringUi';
import type {
  MasteringInsightItem,
  MasteringPreviewRow,
} from '@/demos/mastering/useMasteringInsights';
import { fill } from '@/utils/template';

const props = defineProps<{
  hasProgram: boolean;
  analyzing: boolean;
  profileItems: MasteringInsightItem[];
  suggestions: string[];
  preview: MasteringPreviewRow[];
  unmapped: string[];
  canApply: boolean;
  disabled?: boolean;
}>();

const emit = defineEmits<{ apply: []; refresh: [] }>();

const copy = useMasteringCopy();
const notes = computed(() => props.suggestions.map((note) => assistantNoteText(note, copy.value)));
const unmappedText = computed(() => unmappedLabels(props.unmapped, copy.value));
</script>

<template>
  <section class="insights" :aria-label="copy.insights.title" :aria-busy="analyzing">
    <header class="insights__head">
      <span class="insights__state" role="status">{{ analyzing ? copy.insights.analyzing : '' }}</span>
      <span class="insights__actions">
        <button type="button" :disabled="!hasProgram || analyzing" @click="emit('refresh')">
          {{ copy.insights.refresh }}
        </button>
        <button type="button" class="is-primary" :disabled="!canApply || disabled" @click="emit('apply')">
          {{ copy.insights.apply }}
        </button>
      </span>
    </header>
    <p v-if="!hasProgram" class="insights__empty">{{ copy.insights.empty }}</p>
    <template v-else>
      <dl class="insights__profile">
        <div v-for="item in profileItems" :key="item.label">
          <dt>{{ item.label }}</dt>
          <dd>{{ item.value }}</dd>
        </div>
      </dl>
      <div class="insights__block">
        <h4>{{ copy.insights.suggestions }}</h4>
        <ul v-if="notes.length">
          <li v-for="note in notes" :key="note">{{ note }}</li>
        </ul>
        <p v-else class="insights__empty">{{ copy.insights.suggestionHint }}</p>
        <p v-if="unmappedText.length" class="insights__unmapped" :title="copy.insights.unmappedHint">
          <span>{{ copy.insights.unmapped }}</span>
          <span v-for="label in unmappedText" :key="label" class="insights__unmapped-item">{{ label }}</span>
        </p>
      </div>
      <div class="insights__block">
        <h4>{{ copy.insights.delivery }}</h4>
        <table v-if="preview.length" class="insights__table">
          <caption>{{ copy.insights.previewHint }}</caption>
          <tbody>
            <tr v-for="row in preview" :key="row.name" :class="{ 'is-risk': row.ceilingRisk }">
              <th scope="row">{{ row.name }}</th>
              <td>{{ formatNumber(row.normalizationGainDb, 1, true) }} dB</td>
              <td>
                {{ row.ceilingRisk ? copy.insights.ceilingRisk : '' }}
                <small v-if="row.ceilingRisk && Number.isFinite(row.safeCeilingDb)">
                  {{ fill(copy.insights.safeCeiling, { value: `${formatNumber(row.safeCeilingDb, 1)} dBTP` }) }}
                </small>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="insights__empty">{{ copy.insights.previewEmpty }}</p>
      </div>
    </template>
  </section>
</template>

<style scoped>
.insights {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.insights__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.insights__state {
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: 10.5px;
}

.insights__actions {
  display: flex;
  gap: 6px;
}

.insights button {
  padding: 5px 10px;
  border: 1px solid var(--demo-border-strong);
  border-radius: 4px;
  background: transparent;
  color: var(--demo-text);
  font-family: var(--font-mono);
  font-size: 11px;
  cursor: pointer;
}

.insights button.is-primary {
  border-color: var(--demo-accent-border);
  color: var(--demo-accent);
}

.insights button:disabled {
  opacity: var(--demo-disabled-opacity);
  cursor: not-allowed;
}

.insights button:focus-visible {
  outline: 2px solid var(--demo-accent);
  outline-offset: 2px;
}

.insights__empty {
  margin: 0;
  color: var(--demo-text-muted);
  font-size: 12px;
  line-height: 1.5;
}

.insights__profile {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px 12px;
  margin: 0;
}

.insights__profile dt,
.insights__block h4 {
  margin: 0;
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: var(--demo-label-size);
  font-weight: var(--demo-label-weight);
  letter-spacing: var(--demo-label-tracking);
  text-transform: uppercase;
}

.insights__profile dd {
  margin: 0;
  color: var(--demo-text-strong);
  font-family: var(--font-mono);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.insights__block {
  display: grid;
  gap: 6px;
}

.insights__block ul {
  display: grid;
  gap: 4px;
  margin: 0;
  padding-left: 1.1em;
  color: var(--demo-text);
  font-size: 12.5px;
  line-height: 1.5;
}

.insights__unmapped {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 6px;
  margin: 0;
  font-size: 11px;
}

.insights__unmapped > span:first-child {
  color: var(--demo-warn-text);
  font-family: var(--font-mono);
}

.insights__unmapped-item {
  padding: 0 6px;
  border: 1px solid var(--demo-border);
  border-radius: 3px;
  color: var(--demo-text-muted);
}

.insights__table {
  width: 100%;
  border-collapse: collapse;
  font-family: var(--font-mono);
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
}

.insights__table caption {
  padding-bottom: 4px;
  color: var(--demo-text-muted);
  font-size: 10.5px;
  text-align: left;
}

.insights__table th,
.insights__table td {
  padding: 4px 0;
  border-top: 1px solid var(--demo-border);
  color: var(--demo-text);
  font-weight: 400;
  text-align: left;
}

.insights__table td:nth-child(2) {
  text-align: right;
  padding-right: 12px;
}

.insights__table tr.is-risk td:last-child {
  color: var(--demo-warn-text);
}

.insights__table small {
  display: block;
  color: var(--demo-text-muted);
}
</style>
