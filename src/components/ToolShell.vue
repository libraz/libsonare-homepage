<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import DemoDisclaimer from '@/components/DemoDisclaimer.vue';
import { CornerBrackets, GridOverlay, StatusIndicator } from '@/components/ui';
import { useI18n } from '@/composables/useI18n';
import { useTheme } from '@/composables/useTheme';

const props = withDefaults(
  defineProps<{
    /** Active demo, used to highlight its tab. */
    demoId: 'analyzer' | 'mastering' | 'analysis' | 'mixing' | 'fx';
    title: string;
    subtitle?: string;
    version?: string;
    status?: 'idle' | 'active' | 'warning' | 'error';
    statusLabel?: string;
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

const { locale } = useI18n();
const { isDark, toggle: toggleTheme } = useTheme();

const ja = computed(() => locale.value === 'ja');
const homePath = computed(() => (ja.value ? '/ja/' : '/'));
const demosPath = computed(() => (ja.value ? '/ja/demos' : '/demos'));
const docsLabel = computed(() => (ja.value ? 'ドキュメント' : 'Docs'));
const ctaLabel = computed(() => (ja.value ? 'はじめる' : 'Get Started'));
const ctaPath = computed(() => (ja.value ? '/ja/docs/getting-started' : '/docs/getting-started'));
const docsPath = computed(
  () => props.docsPath || (ja.value ? '/ja/docs/introduction' : '/docs/introduction'),
);
const otherLocalePath = computed(
  () => props.oppositeLocalePath || (ja.value ? '/music-analysis' : '/ja/music-analysis'),
);
const otherLocaleLabel = computed(() => (ja.value ? 'EN' : 'JA'));

const demoTabs = computed(() => [
  {
    id: 'analyzer',
    label: ja.value ? 'ビジュアルプレイヤー' : 'Visual Player',
    path: ja.value ? '/ja/analyzer' : '/analyzer',
  },
  {
    id: 'mastering',
    label: ja.value ? 'マスタリング' : 'Mastering',
    path: ja.value ? '/ja/mastering' : '/mastering',
  },
  {
    id: 'analysis',
    label: ja.value ? '楽曲分析' : 'Analysis',
    path: ja.value ? '/ja/music-analysis' : '/music-analysis',
  },
  {
    id: 'mixing',
    label: ja.value ? 'ミキシング' : 'Mixing',
    path: ja.value ? '/ja/mixing' : '/mixing',
  },
  {
    id: 'fx',
    label: ja.value ? 'リアルタイムFX' : 'Realtime FX',
    path: ja.value ? '/ja/realtime-fx' : '/realtime-fx',
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
      ref="tabsRef"
      class="tool-page__tabs"
      :class="{ 'tool-page__tabs--fade-left': tabsCanScrollLeft, 'tool-page__tabs--fade-right': tabsCanScrollRight }"
      :aria-label="ja ? 'デモ切り替え' : 'Demo switcher'"
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
    <slot name="statusbar" />

    <div v-if="guideTitle || guideBody" class="tool-page__guide">
      <div class="tool-page__guide-copy">
        <strong v-if="guideTitle">{{ guideTitle }}</strong>
        <p v-if="guideBody">{{ guideBody }}</p>
      </div>
      <a :href="docsPath" class="tool-page__guide-link">
        {{ guideLinkLabel || (ja ? 'ドキュメント' : 'Open docs') }}
      </a>
    </div>

    <main class="tool-page__main">
      <slot />
    </main>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap');

.tool-page {
  --demo-bg: #070809;
  --demo-bg-overlay: rgba(16, 18, 25, 0.96);
  --demo-bg-elevated: rgba(23, 26, 34, 0.92);
  --demo-bg-header: rgba(32, 35, 45, 0.9);
  --demo-text-strong: #ffffff;
  --demo-text: rgba(255, 255, 255, 0.82);
  --demo-text-muted: rgba(255, 255, 255, 0.56);
  --demo-text-faint: rgba(255, 255, 255, 0.4);
  --demo-accent: #8B5CF6;
  --demo-accent-light: #A78BFA;
  --demo-accent-dim: rgba(139, 92, 246, 0.3);
  --demo-accent-subtle: rgba(139, 92, 246, 0.08);
  --demo-accent-border: rgba(139, 92, 246, 0.2);
  --demo-cyan: #22D3EE;
  --demo-amber: #F59E0B;
  --demo-success: rgba(100, 200, 180, 0.9);
  --demo-danger: #FCA5A5;
  --demo-border: rgba(139, 92, 246, 0.3);
  --demo-border-strong: rgba(160, 132, 250, 0.46);
  --demo-control-bg: rgba(0, 0, 0, 0.18);
  --demo-control-bg-strong: rgba(0, 0, 0, 0.28);
  --demo-track-bg: rgba(0, 0, 0, 0.2);
  --demo-clip-base: rgba(0, 0, 0, 0.28);
  --demo-clip-label-shadow: rgba(0, 0, 0, 0.72);
  --demo-grid-color: rgba(139, 92, 246, 0.04);
  --demo-grid-minor: rgba(139, 92, 246, 0.02);
  --demo-scanline: rgba(0, 0, 0, 0.03);
  --demo-warn: #F59E0B;
  --demo-warn-text: #FCD9A0;
  --demo-warn-border: rgba(245, 158, 11, 0.4);
  --demo-warn-bg: rgba(245, 158, 11, 0.1);

  position: relative;
  min-height: 100vh;
  background: var(--demo-bg);
  color: var(--demo-text);
  font-family: 'Space Grotesk', sans-serif;
  overflow-x: hidden;
}

html:not(.dark) .tool-page {
  --demo-bg: #f8f6ff;
  --demo-bg-overlay: rgba(248, 246, 255, 0.95);
  --demo-bg-elevated: rgba(245, 243, 255, 0.88);
  --demo-bg-header: rgba(250, 248, 255, 0.9);
  --demo-text-strong: #1a1a2e;
  --demo-text: rgba(0, 0, 0, 0.62);
  --demo-text-muted: rgba(0, 0, 0, 0.42);
  --demo-text-faint: rgba(0, 0, 0, 0.22);
  --demo-accent: #7C3AED;
  --demo-accent-light: #8B5CF6;
  --demo-accent-dim: rgba(124, 58, 237, 0.25);
  --demo-accent-subtle: rgba(124, 58, 237, 0.06);
  --demo-accent-border: rgba(124, 58, 237, 0.2);
  --demo-cyan: #0891B2;
  --demo-amber: #B45309;
  --demo-success: rgba(16, 132, 110, 0.95);
  --demo-danger: #B91C1C;
  --demo-border: rgba(0, 0, 0, 0.08);
  --demo-border-strong: rgba(0, 0, 0, 0.15);
  --demo-control-bg: rgba(255, 255, 255, 0.58);
  --demo-control-bg-strong: rgba(255, 255, 255, 0.72);
  --demo-track-bg: rgba(255, 255, 255, 0.54);
  --demo-clip-base: rgba(255, 255, 255, 0.68);
  --demo-clip-label-shadow: rgba(255, 255, 255, 0.72);
  --demo-grid-color: transparent;
  --demo-grid-minor: transparent;
  --demo-scanline: transparent;
  --demo-warn: #B45309;
  --demo-warn-text: #92400E;
  --demo-warn-border: rgba(180, 83, 9, 0.34);
  --demo-warn-bg: rgba(245, 158, 11, 0.12);

  /* Visualizer scope — light bezel/screen so the player doesn't stay dark */
  --demo-bezel: #e6e1f5;
  --demo-bezel-start: #f1edfb;
  --demo-bezel-end: #d8d0ee;
  --demo-bezel-inset-light: rgba(255, 255, 255, 0.6);
  --demo-bezel-inset-dark: rgba(80, 60, 140, 0.08);
  --demo-bezel-shadow-deep: rgba(80, 60, 140, 0.18);
  --demo-screen-bg: rgb(245, 243, 255);
  --demo-screen-inset-1: rgba(124, 58, 237, 0.14);
  --demo-screen-inset-2: rgba(124, 58, 237, 0.07);
  --demo-indicator-bg: rgba(255, 255, 255, 0.72);
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
  font-family: 'Space Grotesk', sans-serif;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.15em;
  text-decoration: none;
  transition: opacity 0.2s ease;
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
  font-family: 'Space Grotesk', sans-serif;
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
  font-family: 'JetBrains Mono', monospace;
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
  transition: color 0.2s ease, background-color 0.2s ease;
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
  font-family: 'JetBrains Mono', monospace;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--demo-text-muted);
  text-decoration: none;
  background: var(--demo-accent-subtle);
  border: 1px solid var(--demo-accent-border);
  border-radius: 6px;
  transition: all 0.2s ease;
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
  transition: all 0.2s ease;
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
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-decoration: none;
  transition: all 0.2s ease;
}

.tool-page__cta:hover {
  background: var(--demo-accent-light);
  transform: translateX(2px);
}

.tool-page__cta svg {
  transition: transform 0.2s ease;
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
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-decoration: none;
  text-transform: uppercase;
  white-space: nowrap;
  border-bottom: 2px solid transparent;
  transition: color 0.18s ease, border-color 0.18s ease;
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
  font-family: 'JetBrains Mono', monospace;
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
  font-family: 'JetBrains Mono', monospace;
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
</style>
