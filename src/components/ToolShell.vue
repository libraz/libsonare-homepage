<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import DemoDisclaimer from '@/components/DemoDisclaimer.vue';
import { CornerBrackets, GridOverlay, StatusIndicator } from '@/components/ui';
import { useI18n } from '@/composables/useI18n';
import { useTheme } from '@/composables/useTheme';

const props = withDefaults(
  defineProps<{
    /** Active demo, used to highlight its tab. */
    demoId:
      | 'analyzer'
      | 'mastering'
      | 'analysis'
      | 'mixing'
      | 'fx'
      | 'spatial'
      | 'synth'
      | 'studio'
      | 'practice'
      | 'tuner';
    title: string;
    subtitle?: string;
    version?: string;
    status?: 'idle' | 'active' | 'warning' | 'error';
    statusLabel?: string;
    /** Hide the demo-switcher tab strip (for standalone / non-demo tools). */
    hideTabs?: boolean;
    docsPath?: string;
    guideTitle?: string;
    guideBody?: string;
    guideLinkLabel?: string;
    oppositeLocalePath?: string;
  }>(),
  {
    status: 'idle',
    statusLabel: 'LOCAL',
  },
);

const { localizedPath, alternateLocalePath, localizedValue } = useI18n();
const { isDark, toggle: toggleTheme } = useTheme();

const copy = computed(() =>
  localizedValue({
    en: {
      docsLabel: 'Docs',
      ctaLabel: 'Get Started',
      tabListLabel: 'Demo switcher',
      guideLinkLabel: 'Open docs',
      otherLocaleLabel: 'JA',
      tabs: {
        analyzer: 'Visual Player',
        mastering: 'Mastering',
        analysis: 'Analysis',
        mixing: 'Mixing',
        fx: 'Realtime FX',
        spatial: 'Spatial 3D',
        synth: 'Synth',
        studio: 'Studio',
        practice: 'Piano Practice',
      },
    },
    ja: {
      docsLabel: 'ドキュメント',
      ctaLabel: 'はじめる',
      tabListLabel: 'デモ切り替え',
      guideLinkLabel: 'ドキュメント',
      otherLocaleLabel: 'EN',
      tabs: {
        analyzer: 'ビジュアルプレイヤー',
        mastering: 'マスタリング',
        analysis: '楽曲分析',
        mixing: 'ミキシング',
        fx: 'リアルタイムFX',
        spatial: '空間 3D',
        synth: 'シンセ',
        studio: 'スタジオ',
        practice: 'ピアノ練習',
      },
    },
  }),
);
const homePath = computed(() => localizedPath('/'));
const demosPath = computed(() => localizedPath('/demos'));
const docsLabel = computed(() => copy.value.docsLabel);
const ctaLabel = computed(() => copy.value.ctaLabel);
const ctaPath = computed(() => localizedPath('/docs/getting-started'));
const docsPath = computed(() => props.docsPath || localizedPath('/docs/introduction'));
const otherLocalePath = computed(
  () => props.oppositeLocalePath || alternateLocalePath('/music-analysis'),
);
const otherLocaleLabel = computed(() => copy.value.otherLocaleLabel);

const demoTabs = computed(() => [
  {
    id: 'analyzer',
    label: copy.value.tabs.analyzer,
    path: localizedPath('/analyzer'),
  },
  {
    id: 'mastering',
    label: copy.value.tabs.mastering,
    path: localizedPath('/mastering'),
  },
  {
    id: 'analysis',
    label: copy.value.tabs.analysis,
    path: localizedPath('/music-analysis'),
  },
  {
    id: 'mixing',
    label: copy.value.tabs.mixing,
    path: localizedPath('/mixing'),
  },
  {
    id: 'fx',
    label: copy.value.tabs.fx,
    path: localizedPath('/realtime-fx'),
  },
  {
    id: 'spatial',
    label: copy.value.tabs.spatial,
    path: localizedPath('/spatial'),
  },
  {
    id: 'synth',
    label: copy.value.tabs.synth,
    path: localizedPath('/synth'),
  },
  {
    id: 'studio',
    label: copy.value.tabs.studio,
    path: localizedPath('/studio'),
  },
  {
    id: 'practice',
    label: copy.value.tabs.practice,
    path: localizedPath('/practice'),
  },
]);

const tabsRef = ref<HTMLElement | null>(null);
const tabsCanScrollLeft = ref(false);
const tabsCanScrollRight = ref(false);

function syncTabScroll() {
  const nav = tabsRef.value;
  if (!nav) return;
  tabsCanScrollLeft.value = nav.scrollLeft > 1;
  tabsCanScrollRight.value = nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 1;
}

onMounted(() => {
  const nav = tabsRef.value;
  if (!nav) return;
  const active = nav.querySelector<HTMLElement>('.tool-page__tab--active');
  if (active) {
    nav.scrollLeft = active.offsetLeft - (nav.clientWidth - active.clientWidth) / 2;
  }
  syncTabScroll();
  nav.addEventListener('scroll', syncTabScroll, { passive: true });
  window.addEventListener('resize', syncTabScroll);
});

onBeforeUnmount(() => {
  tabsRef.value?.removeEventListener('scroll', syncTabScroll);
  window.removeEventListener('resize', syncTabScroll);
});

function switchLocale(event: Event) {
  event.preventDefault();
  event.stopPropagation();
  if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
  if (typeof window !== 'undefined') window.location.assign(otherLocalePath.value);
}
</script>

<template>
  <div class="tool-page">
    <div class="tool-page__backdrop">
      <GridOverlay scanlines />
      <CornerBrackets size="lg" offset="lg" />
      <div class="tool-page__noise"></div>
    </div>

    <header class="tool-page__header">
      <div class="tool-page__header-left">
        <a :href="homePath" class="tool-page__brand">LIBSONARE</a>
        <span class="tool-page__brand-divider" aria-hidden="true"></span>
        <div class="tool-page__identity">
          <span class="tool-page__title">{{ title }}</span>
          <span v-if="subtitle" class="tool-page__subtitle">{{ subtitle }}</span>
        </div>
        <StatusIndicator :status="status" :label="statusLabel" class="tool-page__privacy" />
      </div>

      <div class="tool-page__header-right">
        <span class="tool-page__version">v{{ version || '-.-.--' }}</span>
        <a :href="docsPath" class="tool-page__docs-link">{{ docsLabel }}</a>
        <a
          :href="otherLocalePath"
          class="tool-page__lang-switch"
          :aria-label="`Switch to ${otherLocaleLabel}`"
          @click.capture.stop.prevent="switchLocale"
        >{{ otherLocaleLabel }}</a>
        <button
          type="button"
          class="tool-page__theme-toggle"
          :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
          @click="toggleTheme"
        >
          <svg class="tool-page__icon-sun" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
          <svg class="tool-page__icon-moon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        </button>
        <a :href="ctaPath" class="tool-page__cta">
          {{ ctaLabel }}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </a>
      </div>
    </header>

    <nav
      v-if="!hideTabs"
      ref="tabsRef"
      class="tool-page__tabs"
      :class="{ 'tool-page__tabs--fade-left': tabsCanScrollLeft, 'tool-page__tabs--fade-right': tabsCanScrollRight }"
      :aria-label="copy.tabListLabel"
    >
      <a
        v-for="tab in demoTabs"
        :key="tab.id"
        :href="tab.path"
        class="tool-page__tab"
        :class="{ 'tool-page__tab--active': tab.id === demoId }"
        :aria-current="tab.id === demoId ? 'page' : undefined"
      >{{ tab.label }}</a>
    </nav>

    <DemoDisclaimer />

    <slot name="modes" />
    <div class="tool-page__statusbar"><slot name="statusbar" /></div>

    <div v-if="guideTitle || guideBody" class="tool-page__guide">
      <div class="tool-page__guide-copy">
        <strong v-if="guideTitle">{{ guideTitle }}</strong>
        <p v-if="guideBody">{{ guideBody }}</p>
      </div>
      <a :href="docsPath" class="tool-page__guide-link">
        {{ guideLinkLabel || copy.guideLinkLabel }}
      </a>
    </div>

    <main class="tool-page__main">
      <slot />
    </main>
  </div>
</template>

<style scoped>
/* Tokens come from the shared demo token layer
   (.vitepress/theme/styles/demo-tokens.css) — do not re-declare here. */
.tool-page {
  position: relative;
  min-height: 100vh;
  background: var(--demo-bg);
  color: var(--demo-text);
  font-family: var(--font-body);
  overflow-x: hidden;
}

.tool-page__backdrop {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}

html:not(.dark) .tool-page .tool-page__backdrop {
  display: none;
}

.tool-page__noise {
  position: absolute;
  inset: 0;
  opacity: 0.02;
  background-image: radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0);
  background-size: 4px 4px;
}

/* ===== ENTRANCE =====
   Staggered fade/rise of the page chrome on mount — mirrors the
   demo-grid-rise rhythm used by the demo cards. */
.tool-page__header,
.tool-page__tabs,
.tool-page__statusbar,
.tool-page__main {
  opacity: 0;
  transform: translateY(6px);
  animation: tool-page-rise 0.45s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
}

.tool-page__header { animation-delay: 0s; }
.tool-page__tabs { animation-delay: 0.07s; }
.tool-page__statusbar { animation-delay: 0.14s; }
.tool-page__main { animation-delay: 0.21s; }

@keyframes tool-page-rise {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .tool-page__header,
  .tool-page__tabs,
  .tool-page__statusbar,
  .tool-page__main {
    animation: none;
    opacity: 1;
    transform: none;
  }
}

/* ===== HEADER (matches mastering chrome) ===== */
.tool-page__header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 24px;
  background: linear-gradient(to bottom, var(--demo-bg-overlay), transparent);
  border-bottom: 1px solid var(--demo-border);
  backdrop-filter: blur(16px);
}

html:not(.dark) .tool-page .tool-page__header {
  background: var(--demo-bg-overlay);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.tool-page__header-left,
.tool-page__header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.tool-page__brand {
  flex: 0 0 auto;
  color: var(--demo-text-strong);
  font-family: var(--font-body);
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.15em;
  text-decoration: none;
  transition: opacity var(--transition-fast);
}

.tool-page__brand:hover {
  opacity: 0.78;
}

.tool-page__brand-divider {
  flex: 0 0 auto;
  width: 1px;
  height: 18px;
  background: var(--demo-border-strong);
}

.tool-page__identity {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.tool-page__title {
  color: var(--demo-text-strong);
  font-family: var(--font-body);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tool-page__subtitle {
  color: var(--demo-text-muted);
  font-size: 10px;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 360px;
}

.tool-page__privacy {
  flex: 0 0 auto;
  font-size: 9px;
}

.tool-page__version {
  flex: 0 0 auto;
  padding: 4px 8px;
  background: var(--demo-accent-subtle);
  border-radius: 4px;
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.tool-page__docs-link {
  padding: 6px 10px;
  border-radius: 6px;
  color: var(--demo-text);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-decoration: none;
  transition: color var(--transition-fast), background-color var(--transition-fast);
}

.tool-page__docs-link:hover {
  color: var(--demo-accent);
  background: var(--demo-accent-subtle);
}

.tool-page__lang-switch {
  display: inline-flex;
  align-items: center;
  height: 32px;
  padding: 0 10px;
  font-family: var(--font-mono);
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--demo-text-muted);
  text-decoration: none;
  background: var(--demo-accent-subtle);
  border: 1px solid var(--demo-accent-border);
  border-radius: 6px;
  transition: all var(--transition-fast);
}

.tool-page__lang-switch:hover {
  color: var(--demo-accent);
  background: var(--demo-accent-dim);
  border-color: var(--demo-accent);
}

.tool-page__theme-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--demo-accent-border);
  border-radius: 6px;
  background: var(--demo-accent-subtle);
  color: var(--demo-text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.tool-page__theme-toggle:hover {
  color: var(--demo-accent);
  background: var(--demo-accent-dim);
  border-color: var(--demo-accent);
}

.tool-page__icon-sun { display: none; }
.tool-page__icon-moon { display: block; }

.tool-page__cta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 6px;
  background: var(--demo-accent);
  color: var(--demo-on-accent);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-decoration: none;
  transition: all var(--transition-fast);
}

.tool-page__cta:hover {
  background: var(--demo-accent-light);
  transform: translateX(2px);
}

.tool-page__cta svg {
  transition: transform var(--transition-fast);
}

.tool-page__cta:hover svg {
  transform: translateX(3px);
}

/* ===== TABS (full-width row) ===== */
.tool-page__tabs {
  position: sticky;
  top: 57px;
  z-index: 9;
  display: flex;
  gap: 4px;
  padding: 0 14px;
  overflow-x: auto;
  background: var(--demo-bg-overlay);
  border-bottom: 1px solid var(--demo-border);
  backdrop-filter: blur(16px);
  scrollbar-width: none;
}

.tool-page__tabs::-webkit-scrollbar {
  display: none;
}

.tool-page__tabs--fade-left {
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 28px);
  mask-image: linear-gradient(90deg, transparent, #000 28px);
}

.tool-page__tabs--fade-right {
  -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 28px), transparent);
  mask-image: linear-gradient(90deg, #000 calc(100% - 28px), transparent);
}

.tool-page__tabs--fade-left.tool-page__tabs--fade-right {
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 28px, #000 calc(100% - 28px), transparent);
  mask-image: linear-gradient(90deg, transparent, #000 28px, #000 calc(100% - 28px), transparent);
}

.tool-page__tab {
  padding: 9px 16px 11px;
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-decoration: none;
  text-transform: uppercase;
  white-space: nowrap;
  border-bottom: 2px solid transparent;
  transition: color var(--transition-fast), border-color var(--transition-fast);
}

.tool-page__tab:hover {
  color: var(--demo-text);
}

.tool-page__tab:focus-visible {
  outline: 2px solid var(--demo-accent);
  outline-offset: -2px;
  border-radius: 4px;
  color: var(--demo-text);
}

.tool-page__tab--active {
  color: var(--demo-accent-light);
  border-bottom-color: var(--demo-accent);
}

/* ===== GUIDE ===== */
.tool-page__guide {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 10px 18px;
  border-bottom: 1px solid var(--demo-border);
  background: var(--demo-bg-overlay);
  backdrop-filter: blur(16px);
}

.tool-page__guide-copy {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.tool-page__guide-copy strong {
  color: var(--demo-text-strong);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.tool-page__guide-copy p {
  max-width: 960px;
  margin: 0;
  color: var(--demo-text-muted);
  font-size: 12px;
  line-height: 1.5;
}

.tool-page__guide-link {
  flex: 0 0 auto;
  border: 1px solid var(--demo-accent-border);
  border-radius: 6px;
  padding: 6px 8px;
  background: var(--demo-accent-subtle);
  color: var(--demo-accent-light);
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-decoration: none;
  text-transform: uppercase;
}

.tool-page__guide-link:hover {
  border-color: var(--demo-accent);
  color: var(--demo-accent);
}

/* ===== MAIN ===== */
.tool-page__main {
  position: relative;
  z-index: 1;
  padding: 16px;
}

@media (max-width: 900px) {
  .tool-page__subtitle,
  .tool-page__version {
    display: none;
  }
}

@media (max-width: 720px) {
  .tool-page__header {
    padding: 10px 12px;
    gap: 10px;
  }

  .tool-page__privacy {
    display: none;
  }

  .tool-page__title {
    max-width: 160px;
  }

  .tool-page__cta {
    display: none;
  }

  .tool-page__main {
    padding: 10px;
  }

  .tool-page__guide {
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
    padding: 9px 12px;
  }
}
</style>

<style>
/* Global (non-scoped) selectors for html.dark — scoped CSS can't target <html> ancestor reliably */
html.dark .tool-page__icon-sun { display: block; }
html.dark .tool-page__icon-moon { display: none; }

/* ===== Shared fader styling for native range inputs =====
   One hardware-fader look for every demo slider (FX, mixing, mastering,
   spatial, …). AudioSource / AudioTransport keep their invisible overlay
   ranges, so they are excluded. Theme-aware via the --demo-* tokens. */
.tool-page input[type='range']:not(.audio-source__range):not(.transport__range) {
  -webkit-appearance: none;
  appearance: none;
  height: 18px;
  margin: 0;
  padding: 0;
  background: transparent;
  cursor: pointer;
}

.tool-page input[type='range']:not(.audio-source__range):not(.transport__range)::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 2px;
  border: 1px solid var(--demo-border);
  background: var(--demo-track-bg);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.16);
}

.tool-page input[type='range']:not(.audio-source__range):not(.transport__range)::-moz-range-track {
  height: 4px;
  border-radius: 2px;
  border: 1px solid var(--demo-border);
  background: var(--demo-track-bg);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.16);
}

/* Fader cap: rectangular, with a center indicator groove. */
.tool-page input[type='range']:not(.audio-source__range):not(.transport__range)::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 16px;
  margin-top: -6px;
  border: 1px solid color-mix(in srgb, var(--demo-accent) 55%, #000);
  border-radius: 3px;
  background:
    linear-gradient(90deg, transparent calc(50% - 1px), rgba(255, 255, 255, 0.92) calc(50% - 1px) calc(50% + 1px), transparent calc(50% + 1px)),
    linear-gradient(180deg, color-mix(in srgb, var(--demo-accent) 78%, #fff) 0%, var(--demo-accent) 52%, color-mix(in srgb, var(--demo-accent) 70%, #000) 100%);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35), 0 0 8px var(--demo-accent-subtle);
  transition: box-shadow var(--transition-fast);
}

.tool-page input[type='range']:not(.audio-source__range):not(.transport__range)::-moz-range-thumb {
  width: 12px;
  height: 16px;
  border: 1px solid color-mix(in srgb, var(--demo-accent) 55%, #000);
  border-radius: 3px;
  background:
    linear-gradient(90deg, transparent calc(50% - 1px), rgba(255, 255, 255, 0.92) calc(50% - 1px) calc(50% + 1px), transparent calc(50% + 1px)),
    linear-gradient(180deg, color-mix(in srgb, var(--demo-accent) 78%, #fff) 0%, var(--demo-accent) 52%, color-mix(in srgb, var(--demo-accent) 70%, #000) 100%);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35), 0 0 8px var(--demo-accent-subtle);
  transition: box-shadow var(--transition-fast);
}

.tool-page input[type='range']:not(.audio-source__range):not(.transport__range):hover:not(:disabled)::-webkit-slider-thumb {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35), 0 0 12px var(--demo-accent-dim);
}

.tool-page input[type='range']:not(.audio-source__range):not(.transport__range):hover:not(:disabled)::-moz-range-thumb {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35), 0 0 12px var(--demo-accent-dim);
}

.tool-page input[type='range']:not(.audio-source__range):not(.transport__range):focus-visible {
  outline: 2px solid var(--demo-accent);
  outline-offset: 3px;
  border-radius: 4px;
}

.tool-page input[type='range']:not(.audio-source__range):not(.transport__range):disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

@media (prefers-reduced-motion: reduce) {
  .tool-page input[type='range']:not(.audio-source__range):not(.transport__range)::-webkit-slider-thumb,
  .tool-page input[type='range']:not(.audio-source__range):not(.transport__range)::-moz-range-thumb {
    transition: none;
  }
}
</style>
