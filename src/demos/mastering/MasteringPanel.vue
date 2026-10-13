<script setup lang="ts">
/** A titled panel of the /mastering layout; `step` numbers it in the Quick flow. */
defineProps<{
  title: string;
  step?: number;
}>();
</script>

<template>
  <section class="panel">
    <header class="panel__head">
      <h2>
        <span v-if="step !== undefined" class="panel__step">{{ String(step).padStart(2, '0') }}</span>
        {{ title }}
      </h2>
      <slot name="aside" />
    </header>
    <div class="panel__body"><slot /></div>
  </section>
</template>

<style scoped>
.panel {
  min-width: 0;
  border: 1px solid var(--demo-border);
  border-radius: var(--demo-radius-md);
  background: var(--demo-bg-elevated);
}

.panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 36px;
  padding: 6px 14px;
  border-bottom: 1px solid var(--demo-border);
}

.panel__head h2 {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin: 0;
  padding: 0;
  border: 0;
  color: var(--demo-text-strong);
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 650;
  letter-spacing: 0;
  line-height: 1.4;
}

.panel__step {
  color: var(--demo-accent);
  font-family: var(--font-mono);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.panel__body {
  padding: 12px 14px 14px;
}
</style>
