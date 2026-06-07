<script setup lang="ts">
/**
 * Shared chrome for every inline demo archetype — the locked reference look.
 *
 * Owns the card, status bar, title, the "instrument screen" (grid, scanlines,
 * corner brackets, axis hints), the generic playback indicators (a glowing
 * playhead beam and a swept "reveal" wash), loading/error overlays, the transport
 * button with its audio-synced progress ring, and the caption.
 *
 * Archetypes fill the screen via the `#screen` slot (typically a <canvas>) and
 * any per-demo controls via `#controls`. All playback visuals are driven by the
 * `playing` + `progress` props so motion stays in lock-step with the audio clock.
 */
type Tone = 'idle' | 'ready' | 'playing' | 'loading' | 'error';

const props = withDefaults(
  defineProps<{
    eyebrow: string;
    title: string;
    caption?: string;
    /** Short right-aligned status text, e.g. `READY` or `▸ 45%`. */
    state: string;
    tone: Tone;
    playing?: boolean;
    /** Normalized 0..1 playback position; drives the beam, reveal and ring. */
    progress?: number;
    disabled?: boolean;
    /** Non-empty shows the error overlay. */
    error?: string | null;
    loadingLabel?: string;
    axisFreq?: string;
    axisTime?: string;
    showPlayhead?: boolean;
  }>(),
  {
    caption: '',
    playing: false,
    progress: 0,
    disabled: false,
    error: null,
    loadingLabel: 'ANALYZING…',
    axisFreq: '',
    axisTime: '',
    showPlayhead: true,
  },
);

defineEmits<(e: 'toggle') => void>();

function pct(v: number): string {
  return `${Math.min(100, Math.max(0, v * 100))}%`;
}
</script>

<template>
  <figure class="td" :class="[`td--${tone}`, { 'td--playing': playing }]">
    <header class="td__bar">
      <span class="td__eyebrow">
        <i class="td__led" :class="`is-${tone}`" />
        {{ eyebrow }}
      </span>
      <span class="td__state" :class="`is-${tone}`">{{ state }}</span>
    </header>

    <figcaption class="td__title">{{ title }}</figcaption>

    <div class="td__stage">
      <div class="td__screen">
        <slot name="screen" />

        <div class="td__grid" aria-hidden="true" />
        <div class="td__scanlines" aria-hidden="true" />

        <template v-if="showPlayhead">
          <div
            class="td__reveal"
            :style="{ width: playing ? pct(progress) : '0%' }"
            aria-hidden="true"
          />
          <div
            v-show="playing"
            class="td__beam"
            :style="{ left: pct(progress) }"
            aria-hidden="true"
          />
        </template>

        <span class="td__bracket td__bracket--tl" aria-hidden="true" />
        <span class="td__bracket td__bracket--tr" aria-hidden="true" />
        <span class="td__bracket td__bracket--bl" aria-hidden="true" />
        <span class="td__bracket td__bracket--br" aria-hidden="true" />

        <span v-if="axisFreq" class="td__axis td__axis--freq" aria-hidden="true">{{ axisFreq }}</span>
        <span v-if="axisTime" class="td__axis td__axis--time" aria-hidden="true">{{ axisTime }}</span>

        <transition name="td-fade">
          <div v-if="tone === 'loading'" class="td__overlay">
            <span class="td__sweep" />
            <span class="td__overlay-label">{{ loadingLabel }}</span>
          </div>
        </transition>
        <transition name="td-fade">
          <div v-if="error" class="td__overlay td__overlay--error">
            <span class="td__overlay-label">SIGNAL ERROR</span>
            <code class="td__overlay-msg">{{ error }}</code>
          </div>
        </transition>
      </div>
    </div>

    <footer class="td__controls">
      <button
        type="button"
        class="td__play"
        :class="{ 'is-playing': playing }"
        :style="{ '--ring': playing ? progress * 360 : 0 }"
        :disabled="disabled"
        :aria-label="playing ? 'Stop' : 'Play'"
        @click="$emit('toggle')"
      >
        <span class="td__play-ring" aria-hidden="true" />
        <svg v-if="!playing" class="td__play-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 5.5v13l11-6.5z" />
        </svg>
        <svg v-else class="td__play-icon" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="6.5" y="6.5" width="11" height="11" rx="1.6" />
        </svg>
      </button>

      <div class="td__meta">
        <p v-if="caption" class="td__caption">{{ caption }}</p>
        <div v-if="$slots.controls" class="td__params">
          <slot name="controls" />
        </div>
      </div>
    </footer>
  </figure>
</template>

<style scoped>
/* ── Reference look for inline demos: instrument screen in a themed card ──────
   Chrome (card, header, caption) follows the page theme via the global tokens,
   which already flip under `.dark`. The screen stays dark in both modes — it is
   a display, not a panel. */
.td {
  --td-surface: var(--vp-c-bg-elv);
  --td-border: var(--color-border-default);
  --td-ink: var(--color-text-primary);
  --td-ink-2: var(--color-text-secondary);
  --td-ink-3: var(--color-text-tertiary);
  --td-accent: var(--color-brand);
  --td-beam: #2dd4bf; /* bright teal — pops against the warm spectrogram */
  --td-screen-edge: rgba(45, 212, 191, 0.55);

  margin: var(--space-6) 0;
  border: 1px solid var(--td-border);
  border-radius: var(--radius-lg);
  background: var(--td-surface);
  box-shadow: var(--shadow-glow);
  overflow: hidden;
  font-family: var(--font-body);
  transition: box-shadow var(--transition-default), border-color var(--transition-default);
}
.td--playing {
  border-color: color-mix(in srgb, var(--td-beam) 45%, var(--td-border));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--td-beam) 22%, transparent),
    0 10px 38px -14px color-mix(in srgb, var(--td-beam) 55%, transparent);
}
.td::before {
  content: '';
  display: block;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--td-accent), var(--td-beam), transparent);
  opacity: 0.7;
}

.td__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4) var(--space-2);
}
.td__eyebrow,
.td__state {
  display: inline-flex;
  align-items: center;
  gap: 0.5em;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.16em;
  color: var(--td-ink-3);
}
.td__state.is-ready { color: var(--td-accent); }
.td__state.is-playing { color: var(--td-beam); }
.td__state.is-error { color: var(--cb-danger); }
.td__state.is-loading { color: var(--cb-warning); }

.td__led {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--td-ink-3);
}
.td__led.is-ready { background: var(--td-accent); box-shadow: 0 0 8px var(--td-accent); }
.td__led.is-playing { background: var(--td-beam); box-shadow: 0 0 10px var(--td-beam); animation: td-pulse 1.4s ease-in-out infinite; }
.td__led.is-loading { background: var(--cb-warning); box-shadow: 0 0 8px var(--cb-warning); animation: td-pulse 1s ease-in-out infinite; }
.td__led.is-error { background: var(--cb-danger); box-shadow: 0 0 8px var(--cb-danger); }

.td__title {
  padding: 0 var(--space-4) var(--space-3);
  margin: 0;
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 1.02rem;
  line-height: 1.3;
  letter-spacing: -0.01em;
  color: var(--td-ink);
}

.td__stage { padding: 0 var(--space-4); }
.td__screen {
  position: relative;
  aspect-ratio: 16 / 6;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: radial-gradient(120% 140% at 50% 0%, #0c1322 0%, #070a14 55%, #04060c 100%);
  box-shadow: inset 0 0 0 1px rgba(45, 212, 191, 0.1), inset 0 8px 30px rgba(0, 0, 0, 0.55);
}

.td__grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(45, 212, 191, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(45, 212, 191, 0.06) 1px, transparent 1px);
  background-size: 100% 25%, 12.5% 100%;
  mask-image: radial-gradient(ellipse 95% 90% at 50% 50%, #000 55%, transparent 100%);
  -webkit-mask-image: radial-gradient(ellipse 95% 90% at 50% 50%, #000 55%, transparent 100%);
}
.td__scanlines {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(0deg, transparent 0 2px, rgba(0, 0, 0, 0.16) 2px 3px);
  opacity: 0.5;
  mix-blend-mode: multiply;
}

.td__reveal {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 0;
  pointer-events: none;
  background: linear-gradient(90deg, rgba(45, 212, 191, 0.03) 0%, rgba(45, 212, 191, 0.1) 80%, rgba(45, 212, 191, 0.16) 100%);
  border-right: 1px solid var(--td-screen-edge);
  mix-blend-mode: screen;
}
.td__beam {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  margin-left: -1px;
  background: var(--td-beam);
  box-shadow: 0 0 10px var(--td-beam), 0 0 22px color-mix(in srgb, var(--td-beam) 70%, transparent);
  pointer-events: none;
  will-change: left;
}
.td__beam::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  right: 100%;
  width: 64px;
  background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--td-beam) 40%, transparent));
}

.td__bracket {
  position: absolute;
  width: 14px;
  height: 14px;
  border: 1.5px solid rgba(45, 212, 191, 0.4);
  pointer-events: none;
}
.td__bracket--tl { top: 9px; left: 9px; border-right: none; border-bottom: none; }
.td__bracket--tr { top: 9px; right: 9px; border-left: none; border-bottom: none; }
.td__bracket--bl { bottom: 9px; left: 9px; border-right: none; border-top: none; }
.td__bracket--br { bottom: 9px; right: 9px; border-left: none; border-top: none; }

.td__axis {
  position: absolute;
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.16em;
  color: rgba(186, 230, 224, 0.55);
  pointer-events: none;
}
.td__axis--freq { top: 50%; left: 12px; transform: translateY(-50%) rotate(-90deg); transform-origin: left center; }
.td__axis--time { right: 14px; bottom: 10px; }

.td__overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  background: rgba(4, 6, 12, 0.55);
  backdrop-filter: blur(2px);
}
.td__overlay-label {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.22em;
  color: rgba(186, 230, 224, 0.85);
}
.td__overlay--error .td__overlay-label { color: var(--cb-danger); }
.td__overlay-msg {
  max-width: 80%;
  font-family: var(--font-mono);
  font-size: 11px;
  color: rgba(255, 210, 210, 0.85);
  text-align: center;
  word-break: break-word;
}
.td__sweep {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 40%;
  background: linear-gradient(90deg, transparent, rgba(45, 212, 191, 0.18), transparent);
  animation: td-sweep 1.1s ease-in-out infinite;
}

.td__controls {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4);
}
.td__play {
  position: relative;
  flex: none;
  width: 46px;
  height: 46px;
  border-radius: 50%;
  border: none;
  display: grid;
  place-items: center;
  cursor: pointer;
  color: #fff;
  background: linear-gradient(150deg, var(--color-brand-light), var(--color-brand-dark));
  box-shadow: 0 6px 18px -6px color-mix(in srgb, var(--td-accent) 70%, transparent);
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}
.td__play:hover:not(:disabled) { transform: scale(1.05); box-shadow: 0 8px 26px -6px color-mix(in srgb, var(--td-accent) 80%, transparent); }
.td__play:active:not(:disabled) { transform: scale(0.96); }
.td__play:disabled { opacity: 0.5; cursor: progress; }
.td__play.is-playing {
  background: linear-gradient(150deg, #2dd4bf, #0e7c87);
  box-shadow: 0 0 22px -2px color-mix(in srgb, var(--td-beam) 70%, transparent);
}
.td__play-ring {
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  background: conic-gradient(var(--td-beam) calc(var(--ring, 0) * 1deg), transparent 0);
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px));
  mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px));
  opacity: 0;
  transition: opacity var(--transition-fast);
}
.td__play.is-playing .td__play-ring { opacity: 1; }
.td__play-icon { width: 20px; height: 20px; fill: currentColor; position: relative; }

.td__meta { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: var(--space-2); }
.td__caption {
  margin: 0;
  font-family: var(--font-reading);
  font-size: 0.85rem;
  line-height: 1.55;
  color: var(--td-ink-2);
}
.td__params { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); }

:global(.dark) .td {
  background: linear-gradient(180deg, var(--vp-c-bg-soft), var(--vp-c-bg-alt));
}

.td-fade-enter-active,
.td-fade-leave-active { transition: opacity 0.25s ease; }
.td-fade-enter-from,
.td-fade-leave-to { opacity: 0; }

@keyframes td-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
}
@keyframes td-sweep {
  0% { left: -40%; }
  100% { left: 100%; }
}

@media (prefers-reduced-motion: reduce) {
  .td__led,
  .td__sweep { animation: none; }
  .td__play,
  .td { transition: none; }
}
</style>
