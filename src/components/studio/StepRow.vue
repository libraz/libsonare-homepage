<script setup lang="ts">
defineProps<{
  /** Row label (note name or drum voice). */
  label: string;
  /** One boolean per step. */
  cells: boolean[];
  /** Step column currently under the playhead, or -1. */
  activeStep: number;
}>();

const emit = defineEmits<(e: 'toggle', step: number) => void>();
</script>

<template>
  <div class="step-row">
    <span class="step-row__label">{{ label }}</span>
    <div class="step-row__cells">
      <button
        v-for="(on, step) in cells"
        :key="step"
        type="button"
        class="step-row__cell"
        :class="{
          'step-row__cell--on': on,
          'step-row__cell--beat': step % 4 === 0,
          'step-row__cell--playhead': step === activeStep,
        }"
        :aria-label="`${label} step ${step + 1}`"
        :aria-pressed="on"
        @click="emit('toggle', step)"
      >
        <i class="step-row__led"></i>
      </button>
    </div>
  </div>
</template>

<style scoped>
.step-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.step-row__label {
  flex: 0 0 34px;
  color: var(--demo-text-faint);
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-align: right;
}

.step-row__cells {
  display: grid;
  flex: 1;
  grid-template-columns: repeat(16, 1fr);
  gap: 5px;
}

/* Wider gutter between each beat group of four pads. */
.step-row__cell--beat:not(:first-child) {
  margin-left: 7px;
}

.step-row__cell {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 30px;
  padding: 0;
  border: 1px solid var(--demo-border);
  border-radius: 6px;
  /* Convex pad face */
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.05) 0%, transparent 45%),
    var(--demo-control-bg);
  box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.14);
  cursor: pointer;
  transition: border-color 0.08s ease, background 0.08s ease, box-shadow 0.08s ease;
}

html:not(.dark) .step-row__cell {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.65) 0%, transparent 50%),
    var(--demo-control-bg);
  box-shadow: inset 0 -2px 0 rgba(80, 60, 140, 0.1);
}

.step-row__cell:hover {
  border-color: var(--track-hue, var(--demo-accent));
}

/* Pre-light the LED under the pointer so the pad reads as armable. */
.step-row__cell:not(.step-row__cell--on):hover .step-row__led {
  background: color-mix(in srgb, var(--track-hue, var(--demo-accent)) 40%, var(--demo-track-bg));
}

.step-row__cell:focus-visible {
  outline: 2px solid var(--track-hue, var(--demo-accent));
  outline-offset: 1px;
}

.step-row__cell:active {
  transform: translateY(1px);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.2);
}

.step-row__led {
  width: 10px;
  height: 4px;
  border-radius: 2px;
  background: var(--demo-track-bg);
  transition: background 0.08s ease, box-shadow 0.08s ease;
}

.step-row__cell--on {
  border-color: var(--track-hue, var(--demo-accent));
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, transparent 45%),
    var(--track-hue-glow, var(--demo-accent-dim));
}

.step-row__cell--on .step-row__led {
  background: var(--track-hue, var(--demo-accent));
  box-shadow: 0 0 8px var(--track-hue, var(--demo-accent));
}

/* Playhead sweep: faint column tint; lit pads flash bright. */
.step-row__cell--playhead {
  border-color: var(--demo-text-muted);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.1) 0%, transparent 45%),
    var(--demo-control-bg-strong);
}

.step-row__cell--on.step-row__cell--playhead {
  border-color: var(--track-hue, var(--demo-accent));
  background: var(--track-hue, var(--demo-accent));
  box-shadow: 0 0 14px var(--track-hue-glow, var(--demo-accent-dim));
}

.step-row__cell--on.step-row__cell--playhead .step-row__led {
  background: #fff;
  box-shadow: 0 0 8px #fff;
}
</style>
