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
import { ref, watch } from 'vue';
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
  <div class="ps" :class="{ 'is-on': visible }" aria-hidden="true">
    <div v-if="flashClass" :key="flashKey" class="ps__flash" :class="flashClass"></div>

    <!-- Live HUD -->
    <div v-show="visible && !finished" class="ps__hud">
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
    >
      {{ labels.judge[popupKind] }}
    </div>

    <!-- Results card -->
    <Transition name="ps-results">
      <div v-if="finished" class="ps__results">
        <span class="ps__results-title">{{ labels.results }}</span>
        <div class="ps__rank" :data-rank="rank.charAt(0)">
          <span class="ps__rank-letter">{{ rank }}</span>
          <span class="ps__rank-label">{{ labels.rankLabel }}</span>
        </div>
        <div v-if="fullCombo" class="ps__fc">{{ labels.fullCombo }}</div>
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
          <button type="button" class="ps__btn ps__btn--primary" @click="$emit('retry')">
            {{ labels.retry }}
          </button>
          <button type="button" class="ps__btn" @click="$emit('exit')">{{ labels.exit }}</button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.ps {
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
  background: radial-gradient(120% 90% at 50% 100%, rgba(255, 205, 90, 0.5), transparent 70%);
  animation: ps-flash 0.5s ease-out forwards;
}
.ps__flash.is-fail {
  background: radial-gradient(120% 100% at 50% 100%, rgba(255, 60, 60, 0.42), transparent 72%);
  box-shadow: inset 0 0 0 3px rgba(255, 60, 60, 0.55);
  animation: ps-flash 0.32s ease-out forwards;
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
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.6);
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
  font-size: 0.58rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--demo-text-muted);
}
.ps__stat-val {
  font-size: 1.4rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: #fff;
}
html:not(.dark) .ps__stat-val {
  color: var(--demo-text-strong);
}
.ps__stat--acc .ps__stat-val i {
  font-size: 0.8rem;
  font-style: normal;
  opacity: 0.7;
  margin-left: 1px;
}

/* --- combo counter --- */
.ps__combo {
  position: absolute;
  top: 26%;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 0.9;
  animation: ps-combo-pop 0.26s cubic-bezier(0.2, 1.5, 0.4, 1);
  --c-glow: var(--demo-accent);
}
.ps__combo[data-tier="1"] { --c-glow: #7cc6ff; }
.ps__combo[data-tier="2"] { --c-glow: #67e8c3; }
.ps__combo[data-tier="3"] { --c-glow: #ffd36b; }
.ps__combo[data-tier="4"] { --c-glow: #ff8ad4; }
.ps__combo-num {
  font-size: clamp(2.6rem, 1.5rem + 6vw, 4.2rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  color: #fff;
  text-shadow:
    0 0 18px var(--c-glow),
    0 0 40px var(--c-glow),
    0 2px 4px rgba(0, 0, 0, 0.5);
}
.ps__combo-label {
  margin-top: 2px;
  font-size: 0.66rem;
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
  position: absolute;
  top: 56%;
  left: 50%;
  font-size: clamp(1.5rem, 1rem + 3vw, 2.4rem);
  font-weight: 800;
  font-style: italic;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  transform: translate(-50%, -50%);
  animation: ps-judge 0.62s ease-out forwards;
  white-space: nowrap;
}
.ps__judge.is-perfect { color: #ffe08a; text-shadow: 0 0 16px #ffbf3f, 0 0 36px #ff9d00; }
.ps__judge.is-great { color: #aee2ff; text-shadow: 0 0 14px #4db4ff; }
.ps__judge.is-good { color: #b6f3c7; text-shadow: 0 0 12px #46d27a; }
.ps__judge.is-miss { color: #ff9a9a; text-shadow: 0 0 14px #ff3b3b; }
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
    radial-gradient(90% 70% at 50% 30%, rgba(20, 12, 40, 0.55), transparent 75%),
    rgba(8, 6, 16, 0.72);
  backdrop-filter: blur(5px);
}
html:not(.dark) .ps__results {
  background:
    radial-gradient(90% 70% at 50% 30%, rgba(124, 58, 237, 0.16), transparent 75%),
    rgba(248, 246, 255, 0.82);
}
.ps__results-title {
  font-size: 0.66rem;
  letter-spacing: 0.4em;
  text-indent: 0.4em;
  text-transform: uppercase;
  color: var(--demo-text-muted);
}
.ps__rank {
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 0.86;
  --rank-glow: #ffd36b;
}
.ps__rank[data-rank="S"] { --rank-glow: #ffd36b; }
.ps__rank[data-rank="A"] { --rank-glow: #8affc1; }
.ps__rank[data-rank="B"] { --rank-glow: #7cc6ff; }
.ps__rank[data-rank="C"] { --rank-glow: #c4a6ff; }
.ps__rank[data-rank="D"] { --rank-glow: #ff9a9a; }
.ps__rank-letter {
  font-size: clamp(4rem, 2rem + 14vw, 7rem);
  font-weight: 900;
  letter-spacing: -0.04em;
  color: #fff;
  text-shadow:
    0 0 24px var(--rank-glow),
    0 0 60px var(--rank-glow);
  animation: ps-rank 0.6s cubic-bezier(0.18, 1.4, 0.4, 1) both;
}
html:not(.dark) .ps__rank-letter {
  color: var(--demo-text-strong);
}
.ps__rank-label {
  font-size: 0.6rem;
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
  border-radius: 999px;
  font-size: 0.64rem;
  font-weight: 800;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #1a1226;
  background: linear-gradient(90deg, #ffd36b, #ff9ad8);
  box-shadow: 0 0 18px rgba(255, 180, 90, 0.6);
  animation: ps-fc 1.6s ease-in-out infinite;
}
@keyframes ps-fc {
  0%, 100% { box-shadow: 0 0 16px rgba(255, 180, 90, 0.45); }
  50% { box-shadow: 0 0 26px rgba(255, 154, 216, 0.8); }
}
.ps__scoreline {
  font-size: 1.7rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: #fff;
}
html:not(.dark) .ps__scoreline {
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
  font-size: 0.54rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.ps__bd-row dd {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--demo-text-strong);
}
.ps__bd-row.is-perfect dt { color: #ffce6b; }
.ps__bd-row.is-great dt { color: #7cc6ff; }
.ps__bd-row.is-good dt { color: #67e8a0; }
.ps__bd-row.is-miss dt { color: #ff8a8a; }
.ps__results-meta {
  display: flex;
  gap: 18px;
  font-size: 0.74rem;
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
  height: 36px;
  padding: 0 18px;
  border: 1px solid var(--demo-border);
  border-radius: 8px;
  background: var(--demo-control-bg);
  color: var(--demo-text-strong);
  font-family: var(--font-mono);
  font-size: 0.74rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: border-color var(--transition-fast), background var(--transition-fast);
}
.ps__btn:hover {
  border-color: var(--demo-accent);
}
.ps__btn--primary {
  border: none;
  background: var(--demo-accent);
  color: var(--demo-on-accent);
}
.ps-results-enter-active {
  transition: opacity 0.3s ease;
}
.ps-results-enter-from {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .ps__flash,
  .ps__combo,
  .ps__judge,
  .ps__rank-letter,
  .ps__fc {
    animation: none;
  }
  .ps__flash { opacity: 0; }
}
</style>
