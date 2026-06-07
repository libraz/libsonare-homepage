<script setup lang="ts">
import { Tooltip } from '@/components/ui';
import { useI18n } from '@/composables/useI18n';

defineProps<{
  modules: readonly string[];
  activeModule: string;
  chainSettingsUrl: string | null;
}>();

const emit = defineEmits<{
  'update:activeModule': [value: string];
  save: [];
  load: [];
  export: [];
  import: [event: Event];
}>();

const { t } = useI18n();
</script>

<template>
  <ol class="signal-flow" :aria-label="t('master.studio.graph')">
    <li
      v-for="(moduleId, index) in modules"
      :key="moduleId"
      class="signal-flow__row"
      :class="{ 'signal-flow__row--active': activeModule === moduleId }"
    >
      <button
        type="button"
        class="signal-flow__btn"
        :title="t(`master.modules.${moduleId}.name`)"
        @click="emit('update:activeModule', moduleId)"
      >
        <span class="signal-flow__stage">{{ String(index + 1).padStart(2, '0') }}</span>
        <span class="signal-flow__led" aria-hidden="true"></span>
        <span class="signal-flow__label">{{ t(`master.modules.${moduleId}.name`) }}</span>
        <span class="signal-flow__chev" aria-hidden="true">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </span>
      </button>
    </li>
  </ol>

  <div class="studio-actions" :aria-label="t('master.studio.chainSettings')">
    <Tooltip
      :title="t('master.studio.savePreset')"
      :body="t('master.studio.tooltips.savePreset')"
    >
      <button type="button" class="studio-actions__button" @click="emit('save')">
        {{ t('master.studio.savePreset') }}
      </button>
    </Tooltip>
    <Tooltip
      :title="t('master.studio.loadPreset')"
      :body="t('master.studio.tooltips.loadPreset')"
    >
      <button type="button" class="studio-actions__button" @click="emit('load')">
        {{ t('master.studio.loadPreset') }}
      </button>
    </Tooltip>
    <Tooltip
      :title="t('master.studio.exportPreset')"
      :body="t('master.studio.tooltips.exportPreset')"
    >
      <button type="button" class="studio-actions__button" @click="emit('export')">
        {{ t('master.studio.exportPreset') }}
      </button>
    </Tooltip>
    <a
      v-if="chainSettingsUrl"
      class="studio-actions__button studio-actions__button--link"
      :href="chainSettingsUrl"
      download="libsonare-mastering-chain.json"
    >
      {{ t('master.studio.downloadPreset') }}
    </a>
    <Tooltip
      :title="t('master.studio.importPreset')"
      :body="t('master.studio.tooltips.importPreset')"
    >
      <label class="studio-actions__button studio-actions__button--import">
        <input type="file" accept="application/json,.json" @change="emit('import', $event)">
        <span>{{ t('master.studio.importPreset') }}</span>
      </label>
    </Tooltip>
  </div>
</template>

<style scoped>
.signal-flow {
  display: grid;
  gap: 6px;
  padding: 12px;
  margin: 0;
  list-style: none;
}

.signal-flow__row {
  position: relative;
}

.signal-flow__row + .signal-flow__row::before {
  content: '';
  position: absolute;
  top: -7px;
  left: 22px;
  width: 1px;
  height: 8px;
  background: var(--demo-border-strong);
  opacity: 0.6;
}

.signal-flow__btn {
  position: relative;
  display: grid;
  grid-template-columns: 32px 10px 1fr 14px;
  align-items: center;
  gap: 10px;
  width: 100%;
  height: 38px;
  padding: 0 10px 0 6px;
  border: 1px solid var(--demo-border);
  border-radius: 6px;
  background: var(--master-surface);
  cursor: pointer;
  font: inherit;
  text-align: left;
  color: var(--demo-text);
  transition: background-color 0.18s ease, border-color 0.18s ease;
}

.signal-flow__btn::before {
  content: '';
  position: absolute;
  left: -1px;
  top: -1px;
  bottom: -1px;
  width: 3px;
  border-radius: 6px 0 0 6px;
  background: var(--demo-accent);
  opacity: 0;
  transform: scaleY(0.45);
  transform-origin: center;
  transition: opacity 0.18s ease, transform 0.22s cubic-bezier(0.32, 0.72, 0.24, 1);
  pointer-events: none;
}

.signal-flow__btn:hover {
  background: var(--master-surface-strong);
  border-color: var(--demo-border-strong);
}

.signal-flow__btn:hover::before {
  opacity: 0.35;
  transform: scaleY(0.7);
}

.signal-flow__row--active .signal-flow__btn {
  background: var(--demo-accent-subtle);
  border-color: var(--demo-accent-border);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--demo-accent) 12%, transparent);
}

.signal-flow__row--active .signal-flow__btn::before {
  opacity: 1;
  transform: scaleY(1);
  box-shadow: 0 0 8px color-mix(in srgb, var(--demo-accent) 55%, transparent);
}

.signal-flow__stage {
  display: inline-grid;
  place-items: center;
  height: 22px;
  border: 1px solid var(--demo-border-strong);
  border-radius: 4px;
  background: var(--master-code-bg);
  color: var(--demo-cyan);
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.04em;
  font-variant-numeric: tabular-nums;
}

.signal-flow__row--active .signal-flow__stage {
  border-color: var(--demo-accent);
  background: var(--demo-accent);
  color: var(--demo-on-accent);
}

.signal-flow__led {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1px solid var(--demo-border-strong);
  background: var(--master-code-bg);
  transition: background-color 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.signal-flow__row--active .signal-flow__led {
  background: var(--demo-accent);
  border-color: var(--demo-accent);
  box-shadow: 0 0 6px color-mix(in srgb, var(--demo-accent) 70%, transparent);
}

.signal-flow__label {
  overflow: hidden;
  color: var(--demo-text-strong);
  font-family: var(--font-body);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: -0.005em;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.signal-flow__chev {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--demo-text-faint);
  transition: color 0.18s ease, transform 0.18s ease;
}

.signal-flow__row--active .signal-flow__chev {
  color: var(--demo-accent);
  transform: translateX(2px);
}

.studio-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  padding: 0 12px 12px;
}

.studio-actions > :deep(.tt-trigger) {
  display: block;
  width: 100%;
}

.studio-actions > :deep(.tt-trigger > .studio-actions__button) {
  display: flex;
  width: 100%;
}

.studio-actions__button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  padding: 0 10px;
  border: 1px solid var(--demo-border);
  border-radius: 6px;
  background: var(--master-surface);
  color: var(--demo-text);
  cursor: pointer;
  font: inherit;
  font-family: var(--font-body);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.01em;
  text-align: center;
  text-decoration: none;
  transition: background-color 0.18s ease, color 0.18s ease, border-color 0.18s ease;
}

.studio-actions__button:hover,
.studio-actions__button:focus-visible {
  border-color: var(--demo-accent);
  color: var(--demo-text-strong);
  background: color-mix(in srgb, var(--demo-accent) 10%, transparent);
  outline: none;
}

.studio-actions__button--link {
  grid-column: 1 / -1;
  background: var(--demo-accent-subtle);
  color: var(--demo-accent-light);
  border-color: var(--demo-accent-border);
}

html:not(.dark) .studio-actions__button--link {
  color: var(--demo-accent);
}

.studio-actions__button--link:hover {
  background: color-mix(in srgb, var(--demo-accent) 22%, transparent);
  color: var(--demo-text-strong);
  border-color: var(--demo-accent);
}

.studio-actions__button--import input {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
