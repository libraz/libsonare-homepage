<script setup lang="ts">
/**
 * Heads-up display for the Piano Practice rhythm game.
 *
 * Sits over the roll and renders the live game feedback — running score, weighted
 * accuracy, an escalating combo counter, and a transient judgment pop on every
 * hit — plus a full-screen flash (gold on a clean perfect, red on a miss) for
 * game-feel. When the chart ends it swaps to a results card with a letter rank,
 * the max combo, a judgment breakdown, and a Full-Combo badge. All motion is
 * CSS-driven and disabled under `prefers-reduced-motion`.
 */
import { nextTick, ref, watch } from 'vue';
import type { Judgment } from './useRhythmGame';

interface ScoreLabels {
  score: string;
  accuracy: string;
  combo: string;
  results: string;
  rankLabel: string;
  maxCombo: string;
  fullCombo: string;
  retry: string;
  exit: string;
  judge: Record<Judgment, string>;
}

const props = defineProps<{
  visible: boolean;
  score: number;
  combo: number;
  maxCombo: number;
  accuracy: number;
  counts: { perfect: number; great: number; good: number; miss: number };
  total: number;
  /** Bumped on every judgment to retrigger the transient pop + flash. */
  judge: { kind: Judgment; id: number } | null;
  finished: boolean;
  rank: string;
  fullCombo: boolean;
  labels: ScoreLabels;
}>();

defineEmits<{ (e: 'retry'): void; (e: 'exit'): void }>();

const popupKind = ref<Judgment | null>(null);
const popupKey = ref(0);
const flashClass = ref('');
const flashKey = ref(0);

watch(
  () => props.judge?.id,
  (id) => {
    const j = props.judge;
    if (!id || !j) return;
    popupKind.value = j.kind;
    popupKey.value += 1;
    // Flash only on the emotional beats: a miss, or a perfect on a combo milestone.
    if (j.kind === 'miss') {
      flashClass.value = 'is-fail';
      flashKey.value += 1;
    } else if (j.kind === 'perfect' && props.combo > 0 && props.combo % 10 === 0) {
      flashClass.value = 'is-gold';
      flashKey.value += 1;
    }
  },
);

// Retry takes focus when the results card opens, so the keyboard lands on it.
const retryButton = ref<HTMLButtonElement | null>(null);
watch(
  () => props.finished,
  (finished) => {
    if (finished) void nextTick(() => retryButton.value?.focus({ preventScroll: true }));
  },
);

/** Combo color tier — the counter heats up as the streak grows. */
function comboTier(combo: number): number {
  if (combo >= 100) return 4;
  if (combo >= 50) return 3;
  if (combo >= 25) return 2;
  if (combo >= 10) return 1;
  return 0;
}
</script>

<template>
  <div class="ps" :class="{ 'is-on': visible }">
    <div v-if="flashClass" :key="flashKey" class="ps__flash" :class="flashClass" aria-hidden="true"></div>

    <!-- Live HUD; the status bar carries score and accuracy for assistive tech. -->
    <div v-show="visible && !finished" class="ps__hud" aria-hidden="true">
      <div class="ps__stat ps__stat--score">
        <span class="ps__stat-label">{{ labels.score }}</span>
        <span class="ps__stat-val">{{ score.toLocaleString() }}</span>
      </div>
      <div class="ps__stat ps__stat--acc">
        <span class="ps__stat-val">{{ accuracy.toFixed(1) }}<i>%</i></span>
        <span class="ps__stat-label">{{ labels.accuracy }}</span>
      </div>

      <div v-if="combo >= 2" :key="combo" class="ps__combo" :data-tier="comboTier(combo)">
        <span class="ps__combo-num">{{ combo }}</span>
        <span class="ps__combo-label">{{ labels.combo }}</span>
      </div>
    </div>

    <!-- Transient judgment pop -->
    <div
      v-if="popupKind && !finished"
      :key="popupKey"
      class="ps__judge"
      :class="`is-${popupKind}`"
      aria-hidden="true"
    >
      {{ labels.judge[popupKind] }}
    </div>

    <!-- Results card -->
    <Transition name="demo-fade">
      <div v-if="finished" class="ps__results" role="group" :aria-label="labels.results">
        <span class="ps__results-title" aria-hidden="true">{{ labels.results }}</span>
        <div class="ps__rank" :data-rank="rank.charAt(0)">
          <span class="ps__rank-letter">{{ rank }}</span>
          <span class="ps__rank-label">{{ labels.rankLabel }}</span>
        </div>
        <div v-if="fullCombo" class="ps__fc demo-anim-loop">{{ labels.fullCombo }}</div>
        <div class="ps__scoreline">{{ score.toLocaleString() }}</div>
        <dl class="ps__breakdown">
          <div class="ps__bd-row is-perfect">
            <dt>{{ labels.judge.perfect }}</dt><dd>{{ counts.perfect }}</dd>
          </div>
          <div class="ps__bd-row is-great">
            <dt>{{ labels.judge.great }}</dt><dd>{{ counts.great }}</dd>
          </div>
          <div class="ps__bd-row is-good">
            <dt>{{ labels.judge.good }}</dt><dd>{{ counts.good }}</dd>
          </div>
          <div class="ps__bd-row is-miss">
            <dt>{{ labels.judge.miss }}</dt><dd>{{ counts.miss }}</dd>
          </div>
        </dl>
        <div class="ps__results-meta">
          <span>{{ labels.accuracy }} <b>{{ accuracy.toFixed(1) }}%</b></span>
          <span>{{ labels.maxCombo }} <b>{{ maxCombo }}</b></span>
        </div>
        <div class="ps__results-actions">
          <button ref="retryButton" type="button" class="demo-btn demo-btn--primary ps__btn" @click="$emit('retry')">
            {{ labels.retry }}
          </button>
          <button type="button" class="demo-btn ps__btn" @click="$emit('exit')">{{ labels.exit }}</button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* Game palette: one colour per judgment and combo tier, all from demo tokens. */
.ps {
  --ps-perfect: var(--demo-amber);
  --ps-great: var(--demo-cyan);
  --ps-good: var(--demo-success);
  --ps-miss: var(--demo-error-fg);

  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 3;
  font-family: var(--font-mono);
  overflow: hidden;
}

/* --- screen flash --- */
.ps__flash {
  position: absolute;
  inset: 0;
  opacity: 0;
}
.ps__flash.is-gold {
  background: radial-gradient(120% 90% at 50% 100%, color-mix(in srgb, var(--ps-perfect) 50%, transparent), transparent 70%);
  animation: ps-flash calc(var(--demo-dur-base) * 2.2) var(--demo-ease-exit) forwards;
}
.ps__flash.is-fail {
  background: radial-gradient(120% 100% at 50% 100%, color-mix(in srgb, var(--ps-miss) 42%, transparent), transparent 72%);
  box-shadow: inset 0 0 0 3px color-mix(in srgb, var(--ps-miss) 55%, transparent);
  animation: ps-flash calc(var(--demo-dur-fast) * 2.3) var(--demo-ease-exit) forwards;
}
@keyframes ps-flash {
  0% { opacity: 1; }
  100% { opacity: 0; }
}

/* --- live HUD --- */
.ps__hud {
  position: absolute;
  inset: 0;
}
.ps__stat {
  position: absolute;
  top: 10px;
  display: flex;
  flex-direction: column;
  line-height: 1;
  text-shadow: 0 1px 6px var(--demo-screen-bg);
}
.ps__stat--score {
  left: 14px;
  align-items: flex-start;
  gap: 4px;
}
.ps__stat--acc {
  right: 14px;
  align-items: flex-end;
  gap: 4px;
}
.ps__stat-label {
  font-size: 9px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--demo-text-muted);
}
.ps__stat-val {
  font-size: 22px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--demo-text-strong);
}
.ps__stat--acc .ps__stat-val i {
  font-size: 13px;
  font-style: normal;
  opacity: 0.7;
  margin-left: 1px;
}

/* --- combo counter: heats up through the palette as the streak grows --- */
.ps__combo {
  --c-glow: var(--demo-accent);

  position: absolute;
  top: 26%;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 0.9;
  animation: ps-combo-pop var(--demo-dur-base) var(--demo-ease-enter);
}
.ps__combo[data-tier="1"] { --c-glow: var(--ps-great); }
.ps__combo[data-tier="2"] { --c-glow: var(--ps-good); }
.ps__combo[data-tier="3"] { --c-glow: var(--ps-perfect); }
.ps__combo[data-tier="4"] { --c-glow: var(--ps-miss); }
.ps__combo-num {
  font-size: clamp(42px, 24px + 6vw, 68px);
  font-weight: 800;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  color: var(--demo-text-strong);
  text-shadow:
    0 0 18px var(--c-glow),
    0 0 40px var(--c-glow);
}
.ps__combo-label {
  margin-top: 2px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.42em;
  text-indent: 0.42em;
  text-transform: uppercase;
  color: var(--c-glow);
  text-shadow: 0 0 10px var(--c-glow);
}
@keyframes ps-combo-pop {
  0% { transform: translateX(-50%) scale(1.32); }
  60% { transform: translateX(-50%) scale(0.96); }
  100% { transform: translateX(-50%) scale(1); }
}

/* --- judgment pop --- */
.ps__judge {
  --j: var(--demo-accent);

  position: absolute;
  top: 56%;
  left: 50%;
  font-size: clamp(24px, 16px + 3vw, 38px);
  font-weight: 800;
  font-style: italic;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  transform: translate(-50%, -50%);
  color: color-mix(in srgb, var(--j) 70%, var(--demo-text-strong));
  text-shadow: 0 0 16px var(--j);
  animation: ps-judge calc(var(--demo-dur-slow) * 1.6) var(--demo-ease-exit) forwards;
  white-space: nowrap;
}
.ps__judge.is-perfect { --j: var(--ps-perfect); }
.ps__judge.is-great { --j: var(--ps-great); }
.ps__judge.is-good { --j: var(--ps-good); }
.ps__judge.is-miss { --j: var(--ps-miss); }
@keyframes ps-judge {
  0% { opacity: 0; transform: translate(-50%, -30%) scale(0.7); }
  18% { opacity: 1; transform: translate(-50%, -55%) scale(1.12); }
  34% { transform: translate(-50%, -50%) scale(1); }
  78% { opacity: 1; }
  100% { opacity: 0; transform: translate(-50%, -64%) scale(1); }
}

/* --- results card --- */
.ps__results {
  position: absolute;
  inset: 0;
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 18px;
  text-align: center;
  background:
    radial-gradient(90% 70% at 50% 30%, color-mix(in srgb, var(--demo-accent) 16%, transparent), transparent 75%),
    color-mix(in srgb, var(--demo-screen-bg) 80%, transparent);
  backdrop-filter: blur(5px);
}
.ps__results-title {
  font-size: 11px;
  letter-spacing: 0.4em;
  text-indent: 0.4em;
  text-transform: uppercase;
  color: var(--demo-text-muted);
}
.ps__rank {
  --rank-glow: var(--ps-perfect);

  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 0.86;
}
.ps__rank[data-rank="A"] { --rank-glow: var(--ps-good); }
.ps__rank[data-rank="B"] { --rank-glow: var(--ps-great); }
.ps__rank[data-rank="C"] { --rank-glow: var(--demo-accent-light); }
.ps__rank[data-rank="D"] { --rank-glow: var(--ps-miss); }
.ps__rank-letter {
  font-size: clamp(64px, 32px + 14vw, 112px);
  font-weight: 900;
  letter-spacing: -0.04em;
  color: var(--demo-text-strong);
  text-shadow:
    0 0 24px var(--rank-glow),
    0 0 60px var(--rank-glow);
  animation: ps-rank calc(var(--demo-dur-slow) * 1.6) var(--demo-ease-enter) both;
}
.ps__rank-label {
  font-size: 10px;
  letter-spacing: 0.36em;
  text-indent: 0.36em;
  text-transform: uppercase;
  color: var(--rank-glow);
}
@keyframes ps-rank {
  0% { opacity: 0; transform: scale(0.4) rotate(-8deg); }
  70% { opacity: 1; transform: scale(1.08) rotate(2deg); }
  100% { transform: scale(1) rotate(0); }
}
.ps__fc {
  padding: 3px 12px;
  border: 1px solid var(--ps-perfect);
  border-radius: 999px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--demo-text-strong);
  background: color-mix(in srgb, var(--ps-perfect) 22%, transparent);
  box-shadow: 0 0 16px color-mix(in srgb, var(--ps-perfect) 45%, transparent);
  animation: ps-fc 1.6s var(--demo-ease-standard) infinite;
}
@keyframes ps-fc {
  0%, 100% { box-shadow: 0 0 12px color-mix(in srgb, var(--ps-perfect) 35%, transparent); }
  50% { box-shadow: 0 0 26px color-mix(in srgb, var(--ps-perfect) 75%, transparent); }
}
.ps__scoreline {
  font-size: 27px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--demo-text-strong);
}
.ps__breakdown {
  display: grid;
  grid-template-columns: repeat(4, auto);
  gap: 6px 16px;
  margin: 4px 0 0;
}
.ps__bd-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: center;
}
.ps__bd-row dt {
  font-size: 9px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.ps__bd-row dd {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--demo-text-strong);
}
.ps__bd-row.is-perfect dt { color: var(--ps-perfect); }
.ps__bd-row.is-great dt { color: var(--ps-great); }
.ps__bd-row.is-good dt { color: var(--ps-good); }
.ps__bd-row.is-miss dt { color: var(--ps-miss); }
.ps__results-meta {
  display: flex;
  gap: 18px;
  font-size: 12px;
  color: var(--demo-text-muted);
}
.ps__results-meta b {
  color: var(--demo-text-strong);
  font-variant-numeric: tabular-nums;
}
.ps__results-actions {
  display: flex;
  gap: 10px;
  margin-top: 6px;
}
.ps__btn {
  --demo-btn-h: 36px;

  padding: 0 18px;
  font-size: 11px;
}

@media (prefers-reduced-motion: reduce) {
  .ps__flash,
  .ps__combo,
  .ps__judge,
  .ps__rank-letter {
    animation: none;
  }
  .ps__flash { opacity: 0; }
}
</style>
