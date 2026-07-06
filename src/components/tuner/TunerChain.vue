<script setup lang="ts">
/**
 * Signal-chain ribbon: a compact exciter -> body -> amp -> out diagram that
 * makes the "combine models" chain visible above the parameter controls.
 */
defineProps<{
  exciterLabel: string;
  bodyLabel: string;
  ampLabel: string;
  outLabel: string;
  engineName: string;
  bodyName: string;
}>();
</script>

<template>
  <div class="tn-chain" aria-hidden="true">
    <div class="tn-chain__node">
      <span class="tn-chain__kind">{{ exciterLabel }}</span>
      <span class="tn-chain__name">{{ engineName }}</span>
    </div>
    <span class="tn-chain__arrow">→</span>
    <div class="tn-chain__node">
      <span class="tn-chain__kind">{{ bodyLabel }}</span>
      <span class="tn-chain__name">{{ bodyName }}</span>
    </div>
    <span class="tn-chain__arrow">→</span>
    <div class="tn-chain__node">
      <span class="tn-chain__kind">{{ ampLabel }}</span>
      <span class="tn-chain__name">ADSR</span>
    </div>
    <span class="tn-chain__arrow">→</span>
    <div class="tn-chain__node tn-chain__node--out">
      <span class="tn-chain__kind">{{ outLabel }}</span>
      <span class="tn-chain__name">▸</span>
    </div>
  </div>
</template>

<style scoped>
.tn-chain {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.tn-chain__node {
  display: grid;
  gap: 2px;
  padding: 6px 12px;
  min-width: 78px;
  border: 1px solid var(--demo-border);
  border-radius: 6px;
  background: var(--demo-control-bg);
  text-align: center;
}

.tn-chain__node--out {
  border-color: var(--demo-accent-border);
  background: var(--demo-accent-subtle);
}

.tn-chain__kind {
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.tn-chain__name {
  color: var(--demo-text-strong);
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.tn-chain__arrow {
  color: var(--demo-text-faint);
  font-size: 13px;
}
</style>
