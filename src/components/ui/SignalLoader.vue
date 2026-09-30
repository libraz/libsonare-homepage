<script setup lang="ts">
withDefaults(
  defineProps<{
    /** Current step, shown under the wordmark. */
    stage: string;
    /** 0–100; shows a bar instead of the idle dots when set. */
    progress?: number;
    /** Smaller bars and spacing, for a docs-inline slot or an overlay. */
    compact?: boolean;
  }>(),
  { progress: undefined, compact: false },
);

const BAR_COUNT = 12;
</script>

<template>
  <div class="signal-loader" :class="{ 'signal-loader--compact': compact }" role="status" aria-live="polite">
    <div class="signal-loader__bars" aria-hidden="true">
      <span
        v-for="i in BAR_COUNT"
        :key="i"
        class="signal-loader__bar"
        :style="{ animationDelay: `${(i - 1) * 0.08}s` }"
      ></span>
      <span class="signal-loader__icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M9 18V5l12-2v13" stroke-linecap="round" stroke-linejoin="round" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      </span>
    </div>

    <div class="signal-loader__text">
      <span class="signal-loader__label" aria-hidden="true">LIBSONARE</span>
      <span class="signal-loader__stage">{{ stage }}</span>
      <slot />
    </div>

    <div v-if="progress !== undefined" class="signal-loader__progress">
      <div class="signal-loader__progress-bar">
        <div class="signal-loader__progress-fill" :style="{ width: `${progress}%` }"></div>
      </div>
      <span class="signal-loader__progress-text">{{ progress }}%</span>
    </div>
    <div v-else class="signal-loader__dots" aria-hidden="true">
      <span
        v-for="i in 3"
        :key="i"
        class="signal-loader__dot"
        :style="{ animationDelay: `${(i - 1) * 0.2}s` }"
      ></span>
    </div>
  </div>
</template>

<style scoped>
.signal-loader {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 32px;
  padding: 60px;
  font-family: var(--font-mono);
}

.signal-loader__bars {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 80px;
}

.signal-loader__bar {
  width: 4px;
  height: 48px;
  background: linear-gradient(to top, var(--demo-accent), var(--demo-accent-light));
  border-radius: 2px;
  will-change: transform, opacity;
  animation: signal-loader-bar 1.2s ease-in-out infinite;
}

@keyframes signal-loader-bar {
  0%, 100% { transform: scaleY(0.25); opacity: 0.4; }
  50% { transform: scaleY(1); opacity: 1; }
}

.signal-loader__icon {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 36px;
  height: 36px;
  color: var(--demo-text-strong);
  transform: translate(-50%, -50%);
  will-change: transform;
  animation: signal-loader-pulse 2s ease-in-out infinite;
}

.signal-loader__icon svg {
  width: 100%;
  height: 100%;
  stroke-width: 2;
  filter: drop-shadow(0 0 8px rgba(139, 92, 246, 0.8)) drop-shadow(0 0 16px rgba(139, 92, 246, 0.5));
}

@keyframes signal-loader-pulse {
  0%, 100% { transform: translate(-50%, -50%) scale(1); }
  50% { transform: translate(-50%, -50%) scale(1.05); }
}

.signal-loader__text {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
}

.signal-loader__label {
  margin-top: 5px;
  color: var(--demo-accent);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.3em;
  text-shadow: 0 0 20px rgba(139, 92, 246, 0.5);
}

.signal-loader__stage {
  color: var(--demo-text-muted);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.15em;
  text-transform: uppercase;
}

.signal-loader__dots {
  display: flex;
  gap: 6px;
}

.signal-loader__dot {
  width: 6px;
  height: 6px;
  background: var(--demo-accent-dim);
  border-radius: 50%;
  will-change: transform;
  animation: signal-loader-dot 1.4s ease-in-out infinite;
}

@keyframes signal-loader-dot {
  0%, 80%, 100% { transform: translateY(0); background: var(--demo-accent-dim); }
  40% { transform: translateY(-8px); background: var(--demo-accent); }
}

.signal-loader__progress {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 240px;
  max-width: 100%;
}

.signal-loader__progress-bar {
  width: 100%;
  height: 3px;
  background: var(--demo-accent-subtle);
  border-radius: 2px;
  overflow: hidden;
}

.signal-loader__progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--demo-accent), var(--demo-accent-light));
  border-radius: 2px;
  box-shadow: 0 0 8px rgba(139, 92, 246, 0.5);
  transition: width 0.2s ease-out;
}

.signal-loader__progress-text {
  color: var(--demo-accent-light);
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.05em;
}

/* ===== COMPACT ===== */
.signal-loader--compact {
  gap: 16px;
  padding: 24px;
}

.signal-loader--compact .signal-loader__bars {
  gap: 3px;
  height: 48px;
}

.signal-loader--compact .signal-loader__bar {
  width: 3px;
  height: 30px;
}

.signal-loader--compact .signal-loader__icon {
  width: 24px;
  height: 24px;
}

.signal-loader--compact .signal-loader__label {
  margin-top: 0;
  font-size: 12px;
}

.signal-loader--compact .signal-loader__text {
  gap: 6px;
}

/* Hold the bars at a legible static height instead of mid-cycle. */
@media (prefers-reduced-motion: reduce) {
  .signal-loader__bar,
  .signal-loader__icon,
  .signal-loader__dot {
    animation: none;
  }

  .signal-loader__bar {
    transform: scaleY(0.6);
    opacity: 0.7;
  }

  .signal-loader__progress-fill {
    transition: none;
  }
}
</style>
