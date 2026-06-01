<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from '@/composables/useI18n';

const props = withDefaults(
  defineProps<{
    /** 'carousel' (default) for horizontal scroll, 'grid' to wrap all cards into rows. */
    layout?: 'carousel' | 'grid';
  }>(),
  {
    layout: 'carousel',
  },
);

const { locale } = useI18n();
const ja = computed(() => locale.value === 'ja');
const base = computed(() => (ja.value ? '/ja' : ''));
const isGrid = computed(() => props.layout === 'grid');

const scroller = ref<HTMLElement | null>(null);
const canScrollLeft = ref(false);
const canScrollRight = ref(false);

function syncScrollState() {
  const el = scroller.value;
  if (!el) return;
  const max = el.scrollWidth - el.clientWidth;
  canScrollLeft.value = el.scrollLeft > 4;
  canScrollRight.value = el.scrollLeft < max - 4;
}

function scrollByCard(direction: -1 | 1) {
  const el = scroller.value;
  if (!el) return;
  const card = el.querySelector<HTMLElement>('.demo-grid__card');
  const step = card ? card.offsetWidth + 16 : el.clientWidth * 0.8;
  el.scrollBy({ left: direction * step, behavior: 'smooth' });
}

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  if (isGrid.value) return;
  syncScrollState();
  scroller.value?.addEventListener('scroll', syncScrollState, { passive: true });
  if (typeof ResizeObserver !== 'undefined' && scroller.value) {
    resizeObserver = new ResizeObserver(syncScrollState);
    resizeObserver.observe(scroller.value);
  }
});

onBeforeUnmount(() => {
  scroller.value?.removeEventListener('scroll', syncScrollState);
  resizeObserver?.disconnect();
});

const prevLabel = computed(() => (ja.value ? '前のデモを表示' : 'Show previous demos'));
const nextLabel = computed(() => (ja.value ? '次のデモを表示' : 'Show more demos'));

type DemoVisual = 'spectrum' | 'lufs' | 'chroma' | 'faders' | 'fx';

interface DemoEntry {
  id: string;
  path: string;
  visual: DemoVisual;
  status: string;
  accent: boolean;
  eyebrow: string;
  title: string;
  tagline: string;
  chips: string[];
  cta: string;
}

const spectrumBars = [34, 52, 28, 60, 44, 70, 38, 56, 30, 64, 42, 50];
const faderLevels = [62, 38, 78, 46, 70, 30, 54, 42];
const chromaCells = [20, 70, 35, 90, 50, 25, 80, 45, 60, 30, 75, 40];

const cards = computed<DemoEntry[]>(() => {
  const cta = ja.value ? '開く' : 'Open demo';
  if (ja.value) {
    return [
      {
        id: 'analyzer',
        path: `${base.value}/analyzer`,
        visual: 'spectrum',
        accent: false,
        status: 'LIVE',
        eyebrow: 'VISUAL PLAYER',
        title: 'ビジュアルプレイヤー',
        tagline: 'クロマ・スペクトルをリアルタイム可視化するオーディオプレイヤー。',
        chips: ['BPM', 'KEY', 'CHORD', 'SPECTRUM'],
        cta,
      },
      {
        id: 'mastering',
        path: `${base.value}/mastering`,
        visual: 'lufs',
        accent: true,
        status: 'STUDIO',
        eyebrow: 'MASTERING',
        title: 'マスタリングスタジオ',
        tagline: 'プリセットで配信向けラウドネスへ。WAV書き出し対応。',
        chips: ['LUFS', 'EQ', 'DYNAMICS', 'WAV'],
        cta,
      },
      {
        id: 'analysis',
        path: `${base.value}/music-analysis`,
        visual: 'chroma',
        accent: false,
        status: 'STUDIO',
        eyebrow: 'ANALYSIS',
        title: '楽曲分析スタジオ',
        tagline: '構造・ハーモニー・メロディ・ラウドネスとスペクトル表示。',
        chips: ['STRUCTURE', 'CHROMA', 'CQT', 'BEATS'],
        cta,
      },
      {
        id: 'mixing',
        path: `${base.value}/mixing`,
        visual: 'faders',
        accent: false,
        status: 'STUDIO',
        eyebrow: 'MIXING',
        title: 'ミキシングスタジオ',
        tagline: '最大8トラックのステム・ミキサー。シーンJSONとバウンス。',
        chips: ['8 TRACKS', 'PAN', 'WIDTH', 'BOUNCE'],
        cta,
      },
      {
        id: 'fx',
        path: `${base.value}/realtime-fx`,
        visual: 'fx',
        accent: false,
        status: 'MIC',
        eyebrow: 'REALTIME FX',
        title: 'リアルタイムボイスチェンジャー',
        tagline: 'マイク入力のボイスチェンジャー。ライブラリのキャラクタープリセット対応。',
        chips: ['PITCH', 'FORMANT', 'CHARACTER', 'PRESETS'],
        cta,
      },
    ];
  }
  return [
    {
      id: 'analyzer',
      path: `${base.value}/analyzer`,
      visual: 'spectrum',
      accent: false,
      status: 'LIVE',
      eyebrow: 'VISUAL PLAYER',
      title: 'Visual Player',
      tagline: 'Audio player with real-time chroma & spectrum visualization.',
      chips: ['BPM', 'KEY', 'CHORD', 'SPECTRUM'],
      cta,
    },
    {
      id: 'mastering',
      path: `${base.value}/mastering`,
      visual: 'lufs',
      accent: true,
      status: 'STUDIO',
      eyebrow: 'MASTERING',
      title: 'Mastering Studio',
      tagline: 'Hit streaming loudness targets with presets. WAV export.',
      chips: ['LUFS', 'EQ', 'DYNAMICS', 'WAV'],
      cta,
    },
    {
      id: 'analysis',
      path: `${base.value}/music-analysis`,
      visual: 'chroma',
      accent: false,
      status: 'STUDIO',
      eyebrow: 'ANALYSIS',
      title: 'Music Analysis Studio',
      tagline: 'Structure, harmony, melody, loudness, and spectral views.',
      chips: ['STRUCTURE', 'CHROMA', 'CQT', 'BEATS'],
      cta,
    },
    {
      id: 'mixing',
      path: `${base.value}/mixing`,
      visual: 'faders',
      accent: false,
      status: 'STUDIO',
      eyebrow: 'MIXING',
      title: 'Mixing Studio',
      tagline: 'Up to eight stem tracks with scene JSON and WAV bounce.',
      chips: ['8 TRACKS', 'PAN', 'WIDTH', 'BOUNCE'],
      cta,
    },
    {
      id: 'fx',
      path: `${base.value}/realtime-fx`,
      visual: 'fx',
      accent: false,
      status: 'MIC',
      eyebrow: 'REALTIME FX',
      title: 'Realtime Voice Changer',
      tagline: 'Local microphone voice changer with library character presets.',
      chips: ['PITCH', 'FORMANT', 'CHARACTER', 'PRESETS'],
      cta,
    },
  ];
});
</script>

<template>
  <div
    class="demo-carousel"
    :class="{
      'demo-carousel--grid': isGrid,
      'demo-carousel--fade-left': canScrollLeft,
      'demo-carousel--fade-right': canScrollRight,
    }"
  >
    <button
      v-if="!isGrid"
      type="button"
      class="demo-carousel__nav demo-carousel__nav--prev"
      :class="{ 'demo-carousel__nav--hidden': !canScrollLeft }"
      :aria-label="prevLabel"
      :tabindex="canScrollLeft ? 0 : -1"
      @click="scrollByCard(-1)"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>
    <button
      v-if="!isGrid"
      type="button"
      class="demo-carousel__nav demo-carousel__nav--next"
      :class="{ 'demo-carousel__nav--hidden': !canScrollRight }"
      :aria-label="nextLabel"
      :tabindex="canScrollRight ? 0 : -1"
      @click="scrollByCard(1)"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
    <div ref="scroller" class="demo-grid" :class="{ 'demo-grid--wrap': isGrid }">
    <a
      v-for="(card, idx) in cards"
      :key="card.id"
      :href="card.path"
      class="demo-grid__card"
      :class="{ 'demo-grid__card--accent': card.accent }"
      :style="{ '--i': idx }"
    >
      <div class="demo-grid__head">
        <span class="demo-grid__status" :class="{ 'demo-grid__status--accent': card.accent }">
          <span class="demo-grid__status-dot"></span>
          {{ card.status }}
        </span>
        <span class="demo-grid__eyebrow">{{ card.eyebrow }}</span>
      </div>

      <div class="demo-grid__visual" :class="`demo-grid__visual--${card.visual}`" aria-hidden="true">
        <!-- Spectrum -->
        <svg v-if="card.visual === 'spectrum'" viewBox="0 0 220 60" preserveAspectRatio="none">
          <rect
            v-for="(bar, i) in spectrumBars"
            :key="i"
            :x="i * (220 / spectrumBars.length) + 2"
            :y="60 - bar"
            :width="(220 / spectrumBars.length) - 4"
            :height="bar"
            rx="1"
            class="demo-grid__bar"
            :style="{ '--d': `${i * 90}ms` }"
          />
        </svg>

        <!-- LUFS gauge -->
        <svg v-else-if="card.visual === 'lufs'" viewBox="0 0 120 60" preserveAspectRatio="xMidYMid meet">
          <path d="M14 52 A 46 46 0 0 1 106 52" fill="none" class="demo-grid__arc-track" />
          <path d="M14 52 A 46 46 0 0 1 92 18" fill="none" class="demo-grid__arc-fill" />
          <line x1="60" y1="52" x2="86" y2="26" class="demo-grid__needle" />
          <circle cx="60" cy="52" r="3.5" class="demo-grid__needle-hub" />
          <text x="60" y="46" text-anchor="middle" class="demo-grid__gauge-label">-14 LUFS</text>
        </svg>

        <!-- Chroma heatmap -->
        <div v-else-if="card.visual === 'chroma'" class="demo-grid__chroma">
          <span
            v-for="(c, i) in chromaCells"
            :key="i"
            class="demo-grid__chroma-cell"
            :style="{ '--v': c / 100, '--d': `${i * 70}ms` }"
          ></span>
        </div>

        <!-- Faders -->
        <div v-else-if="card.visual === 'faders'" class="demo-grid__faders">
          <span
            v-for="(lvl, i) in faderLevels"
            :key="i"
            class="demo-grid__fader"
          >
            <span class="demo-grid__fader-cap" :style="{ bottom: `${lvl}%`, '--d': `${i * 80}ms` }"></span>
          </span>
        </div>

        <!-- FX waveform -->
        <svg v-else viewBox="0 0 220 60" preserveAspectRatio="none">
          <polyline
            class="demo-grid__wave"
            points="0,30 18,30 26,12 34,48 42,22 50,38 58,30 78,30 86,16 94,44 102,26 110,34 118,30 138,30 146,20 154,40 162,28 170,32 178,30 220,30"
          />
        </svg>
      </div>

      <h3 class="demo-grid__title">{{ card.title }}</h3>
      <p class="demo-grid__tagline">{{ card.tagline }}</p>

      <ul class="demo-grid__chips">
        <li v-for="chip in card.chips" :key="chip">{{ chip }}</li>
      </ul>

      <span class="demo-grid__cta">
        {{ card.cta }}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </span>
    </a>
    </div>
  </div>
</template>

<style scoped>
.demo-carousel {
  position: relative;
}

/* Edge fade masks hint that more cards are reachable by scrolling. */
.demo-carousel::before,
.demo-carousel::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 14px;
  width: 56px;
  pointer-events: none;
  z-index: 2;
  opacity: 0;
  transition: opacity 0.25s ease;
}

.demo-carousel::before {
  left: 0;
  background: linear-gradient(to right, var(--demo-bg, #030405), transparent);
}

.demo-carousel::after {
  right: 0;
  background: linear-gradient(to left, var(--demo-bg, #030405), transparent);
}

.demo-carousel--fade-left::before { opacity: 1; }
.demo-carousel--fade-right::after { opacity: 1; }

.demo-carousel__nav {
  position: absolute;
  top: calc((100% - 14px) / 2);
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border: 1px solid var(--demo-border-strong, rgba(139, 92, 246, 0.25));
  border-radius: 50%;
  background: var(--demo-bg-elevated, rgba(8, 10, 14, 0.92));
  color: var(--demo-text-strong, #fff);
  cursor: pointer;
  transform: translateY(-50%);
  transition: opacity 0.25s ease, transform 0.2s ease, border-color 0.2s ease, background-color 0.2s ease;
  box-shadow: 0 8px 24px -10px rgba(0, 0, 0, 0.6);
}

.demo-carousel__nav:hover {
  border-color: var(--demo-accent, #8B5CF6);
  background: var(--demo-accent-subtle, rgba(139, 92, 246, 0.12));
  color: var(--demo-accent-light, #A78BFA);
}

.demo-carousel__nav:focus-visible {
  outline: 2px solid var(--demo-accent, #8B5CF6);
  outline-offset: 2px;
}

.demo-carousel__nav--prev { left: -6px; }
.demo-carousel__nav--next { right: -6px; }

.demo-carousel__nav--hidden {
  opacity: 0;
  pointer-events: none;
}

.demo-grid {
  display: flex;
  align-items: stretch;
  gap: 16px;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 0 2px 14px;
  margin: 0 -2px;
  scroll-padding-inline: 2px;
  scroll-snap-type: x proximity;
  -webkit-overflow-scrolling: touch;
}

/* Grid layout: wrap every card into rows (dedicated demos page) instead of a
   single horizontally scrolling row, so nothing is hidden off-screen. */
.demo-grid--wrap {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(248px, 1fr));
  overflow: visible;
  scroll-snap-type: none;
}

.demo-grid::-webkit-scrollbar {
  height: 8px;
}

.demo-grid::-webkit-scrollbar-track {
  background: var(--demo-accent-subtle, rgba(139, 92, 246, 0.08));
  border-radius: 999px;
}

.demo-grid::-webkit-scrollbar-thumb {
  background: var(--demo-border-strong, rgba(139, 92, 246, 0.25));
  border-radius: 999px;
}

.demo-grid::-webkit-scrollbar-thumb:hover {
  background: var(--demo-accent-dim, rgba(139, 92, 246, 0.3));
}

.demo-grid__card {
  position: relative;
  flex: 0 0 clamp(248px, 23vw, 282px);
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 22px 22px 20px;
  background:
    radial-gradient(ellipse at top right, var(--demo-accent-subtle, rgba(139, 92, 246, 0.08)), transparent 60%),
    var(--demo-bg-elevated, rgba(8, 10, 14, 0.85));
  border: 1px solid var(--demo-border-strong, rgba(139, 92, 246, 0.25));
  border-radius: 5px;
  text-decoration: none;
  color: inherit;
  opacity: 0;
  transform: translateY(12px);
  animation: demo-grid-rise 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
  animation-delay: calc(var(--i) * 0.07s);
  scroll-snap-align: start;
  transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
}

.demo-grid__card:hover {
  transform: translateY(-3px);
  border-color: var(--demo-accent, #8B5CF6);
  box-shadow: 0 18px 44px -18px rgba(139, 92, 246, 0.4);
}

html:not(.dark) .demo-grid__card:hover {
  box-shadow: 0 14px 36px -16px rgba(109, 40, 217, 0.2);
}

.demo-grid__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.demo-grid__status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--demo-success, #34D399);
}

.demo-grid__status--accent {
  color: var(--demo-accent-light, #A78BFA);
}

.demo-grid__status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 8px currentColor;
  animation: demo-grid-blink 2.4s ease-in-out infinite;
}

.demo-grid__eyebrow {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.16em;
  color: var(--demo-text-muted, rgba(255, 255, 255, 0.4));
}

.demo-grid__visual {
  height: 56px;
  border: 1px solid var(--demo-border, rgba(139, 92, 246, 0.12));
  border-radius: 6px;
  background:
    linear-gradient(var(--demo-grid-color, rgba(139, 92, 246, 0.05)) 1px, transparent 1px),
    linear-gradient(90deg, var(--demo-grid-color, rgba(139, 92, 246, 0.05)) 1px, transparent 1px),
    var(--demo-screen-bg-alpha, rgba(6, 8, 12, 0.6));
  background-size: 16px 16px, 16px 16px, auto;
  overflow: hidden;
  padding: 7px 12px;
  display: flex;
  align-items: stretch;
}

.demo-grid__visual svg {
  width: 100%;
  height: 100%;
  display: block;
}

/* Spectrum */
.demo-grid__bar {
  fill: var(--demo-accent, #8B5CF6);
  transform-box: fill-box;
  transform-origin: bottom;
  animation: demo-grid-eq 1.6s ease-in-out infinite;
  animation-delay: var(--d);
}

/* LUFS */
.demo-grid__arc-track {
  stroke: var(--demo-border-strong, rgba(139, 92, 246, 0.25));
  stroke-width: 4;
  stroke-linecap: round;
}

.demo-grid__arc-fill {
  stroke: var(--demo-accent, #8B5CF6);
  stroke-width: 4;
  stroke-linecap: round;
}

.demo-grid__needle {
  stroke: var(--demo-accent-light, #A78BFA);
  stroke-width: 2;
  stroke-linecap: round;
  transform-origin: 60px 52px;
  animation: demo-grid-needle 3.4s ease-in-out infinite;
}

.demo-grid__needle-hub {
  fill: var(--demo-accent-light, #A78BFA);
}

.demo-grid__gauge-label {
  fill: var(--demo-text-muted, rgba(255, 255, 255, 0.4));
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  letter-spacing: 0.08em;
}

/* Chroma */
.demo-grid__chroma {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 3px;
  width: 100%;
}

.demo-grid__chroma-cell {
  border-radius: 2px;
  background: var(--demo-accent, #8B5CF6);
  opacity: calc(0.18 + var(--v) * 0.72);
  animation: demo-grid-flicker 2.8s ease-in-out infinite;
  animation-delay: var(--d);
}

/* Faders */
.demo-grid__faders {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 5px;
  width: 100%;
}

.demo-grid__fader {
  position: relative;
  flex: 1;
  height: 100%;
  border-radius: 2px;
  background: var(--demo-border, rgba(139, 92, 246, 0.12));
}

.demo-grid__fader-cap {
  position: absolute;
  left: -1px;
  right: -1px;
  height: 5px;
  border-radius: 2px;
  background: var(--demo-accent, #8B5CF6);
  box-shadow: 0 0 6px var(--demo-accent-dim, rgba(139, 92, 246, 0.3));
  animation: demo-grid-fader 3s ease-in-out infinite;
  animation-delay: var(--d);
}

/* FX wave */
.demo-grid__wave {
  fill: none;
  stroke: var(--demo-cyan, #22D3EE);
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
  animation: demo-grid-wave 2.2s ease-in-out infinite;
}

.demo-grid__title {
  margin: 2px 0 0;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--demo-text-strong, #fff);
}

.demo-grid__tagline {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  color: var(--demo-text, rgba(255, 255, 255, 0.7));
}

.demo-grid__chips {
  list-style: none;
  margin: auto 0 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.demo-grid__chips li {
  padding: 3px 7px;
  border: 1px solid var(--demo-border, rgba(139, 92, 246, 0.12));
  border-radius: 4px;
  background: var(--demo-accent-subtle, rgba(139, 92, 246, 0.06));
  font-family: 'JetBrains Mono', monospace;
  font-size: 8.5px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--demo-text-muted, rgba(255, 255, 255, 0.45));
}

.demo-grid__cta {
  margin-top: 6px;
  padding-top: 6px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  align-self: flex-start;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--demo-text-strong, #fff);
}

.demo-grid__card--accent .demo-grid__cta {
  color: var(--demo-accent-light, #A78BFA);
}

html:not(.dark) .demo-grid__card--accent .demo-grid__cta {
  color: var(--demo-accent, #7C3AED);
}

html:not(.dark) .demo-grid__visual {
  background:
    linear-gradient(var(--demo-grid-color, rgba(109, 40, 217, 0.035)) 1px, transparent 1px),
    linear-gradient(90deg, var(--demo-grid-color, rgba(109, 40, 217, 0.035)) 1px, transparent 1px),
    var(--demo-screen-bg-alpha, rgba(255, 255, 255, 0.62));
}

.demo-grid__cta svg {
  transition: transform 0.25s ease;
}

.demo-grid__card:hover .demo-grid__cta svg {
  transform: translateX(4px);
}

@keyframes demo-grid-rise {
  to { opacity: 1; transform: translateY(0); }
}

@keyframes demo-grid-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

@keyframes demo-grid-eq {
  0%, 100% { transform: scaleY(0.55); }
  50% { transform: scaleY(1); }
}

@keyframes demo-grid-needle {
  0%, 100% { transform: rotate(-4deg); }
  50% { transform: rotate(6deg); }
}

@keyframes demo-grid-flicker {
  0%, 100% { opacity: calc(0.18 + var(--v) * 0.72); }
  50% { opacity: calc(0.1 + var(--v) * 0.45); }
}

@keyframes demo-grid-fader {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-7px); }
}

@keyframes demo-grid-wave {
  0%, 100% { opacity: 0.6; transform: translateX(0); }
  50% { opacity: 1; transform: translateX(-3px); }
}

@media (prefers-reduced-motion: reduce) {
  .demo-grid__card,
  .demo-grid__bar,
  .demo-grid__needle,
  .demo-grid__chroma-cell,
  .demo-grid__fader-cap,
  .demo-grid__wave,
  .demo-grid__status-dot {
    animation: none;
  }
  .demo-grid__card {
    opacity: 1;
    transform: none;
  }
}

@media (hover: none), (pointer: coarse) {
  .demo-carousel__nav {
    display: none;
  }
}

@media (max-width: 720px) {
  .demo-grid {
    padding-bottom: 12px;
  }

  .demo-grid__card {
    flex-basis: min(288px, calc(100vw - 52px));
  }

  .demo-carousel__nav {
    display: none;
  }
}
</style>
