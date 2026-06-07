<script setup lang="ts">
import { useData } from 'vitepress';
import { computed } from 'vue';
import DemoCardGrid from '@/components/DemoCardGrid.vue';
import { CornerBrackets, GridOverlay } from '@/components/ui';
import { useTheme } from '@/composables/useTheme';

const { lang } = useData();
const { isDark, toggle: toggleTheme } = useTheme();

const ja = computed(() => lang.value === 'ja');
const base = computed(() => (ja.value ? '/ja' : ''));

const copy = computed(() =>
  ja.value
    ? {
        home: 'ホーム',
        docs: 'ドキュメント',
        cta: 'はじめる',
        eyebrow: 'ブラウザ内デモ',
        title: 'デモ一覧',
        subhead:
          'すべて WebAssembly でブラウザ内完結。音声はアップロードされず、端末内だけで処理されます。',
        otherLabel: 'EN',
        footerNote: 'これらはオープンソース libsonare のデモであり、サービスではありません。',
      }
    : {
        home: 'Home',
        docs: 'Docs',
        cta: 'Get Started',
        eyebrow: 'In-browser demos',
        title: 'Demos',
        subhead:
          'Every demo runs entirely in your browser via WebAssembly. Audio is never uploaded — it stays on your device.',
        otherLabel: 'JA',
        footerNote: 'These are demos of the open-source libsonare library, not a service.',
      },
);

const homePath = computed(() => `${base.value}/`);
const docsPath = computed(() => `${base.value}/docs/introduction`);
const ctaPath = computed(() => `${base.value}/docs/getting-started`);
const otherLocalePath = computed(() => (ja.value ? '/demos' : '/ja/demos'));
const githubUrl = 'https://github.com/libraz/libsonare';

function switchLocale(event: Event) {
  event.preventDefault();
  event.stopPropagation();
  if (typeof window !== 'undefined') window.location.assign(otherLocalePath.value);
}
</script>

<template>
  <div class="demos-page">
    <div class="demos-page__backdrop">
      <GridOverlay scanlines />
      <CornerBrackets size="lg" offset="lg" />
    </div>

    <header class="demos-page__header">
      <div class="demos-page__header-left">
        <a :href="homePath" class="demos-page__brand">LIBSONARE</a>
        <span class="demos-page__tagline">{{ copy.eyebrow }}</span>
      </div>
      <div class="demos-page__header-right">
        <a :href="docsPath" class="demos-page__nav-link">{{ copy.docs }}</a>
        <a :href="githubUrl" target="_blank" rel="noopener noreferrer" class="demos-page__nav-link">GitHub</a>
        <a
          :href="otherLocalePath"
          class="demos-page__lang-switch"
          :aria-label="`Switch to ${copy.otherLabel}`"
          @click.capture.stop.prevent="switchLocale"
        >{{ copy.otherLabel }}</a>
        <button
          type="button"
          class="demos-page__theme-toggle"
          :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
          @click="toggleTheme"
        >
          <svg class="demos-page__icon-sun" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
          <svg class="demos-page__icon-moon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        </button>
        <a :href="ctaPath" class="demos-page__cta">
          {{ copy.cta }}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </a>
      </div>
    </header>

    <main class="demos-page__main">
      <header class="demos-page__hero">
        <p class="demos-page__eyebrow">{{ copy.eyebrow }}</p>
        <h1 class="demos-page__title">{{ copy.title }}</h1>
        <p class="demos-page__subhead">{{ copy.subhead }}</p>
      </header>

      <DemoCardGrid layout="grid" />
    </main>

    <footer class="demos-page__footer">
      <div class="demos-page__footer-links">
        <a :href="githubUrl" target="_blank" rel="noopener noreferrer" class="demos-page__footer-link">SOURCE</a>
        <span class="demos-page__divider">|</span>
        <a href="https://opensource.org/licenses/Apache-2.0" target="_blank" rel="noopener noreferrer" class="demos-page__footer-link">APACHE-2.0</a>
        <span class="demos-page__divider">|</span>
        <a :href="docsPath" class="demos-page__footer-link">{{ copy.docs.toUpperCase() }}</a>
      </div>
      <p class="demos-page__footer-note">{{ copy.footerNote }}</p>
    </footer>
  </div>
</template>

<style scoped>
/* Tokens come from the shared demo token layer
   (.vitepress/theme/styles/demo-tokens.css) — do not re-declare here. */
.demos-page {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--demo-bg);
  color: var(--demo-text);
  font-family: var(--font-body);
  overflow-x: hidden;
}

.demos-page__backdrop {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}

html:not(.dark) .demos-page .demos-page__backdrop {
  display: none;
}

.demos-page__header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 28px;
  background: linear-gradient(to bottom, var(--demo-bg-overlay), transparent);
  border-bottom: 1px solid var(--demo-border);
  backdrop-filter: blur(16px);
}

html:not(.dark) .demos-page .demos-page__header {
  background: var(--demo-bg-overlay);
}

.demos-page__header-left,
.demos-page__header-right {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.demos-page__brand {
  color: var(--demo-text-strong);
  font-family: var(--font-body);
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.15em;
  text-decoration: none;
}

.demos-page__tagline {
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.1em;
}

.demos-page__nav-link {
  color: var(--demo-text);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-decoration: none;
  padding: 6px 8px;
  border-radius: 6px;
  transition: color var(--transition-fast), background-color var(--transition-fast);
}

.demos-page__nav-link:hover {
  color: var(--demo-accent);
  background: var(--demo-accent-subtle);
}

.demos-page__lang-switch {
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

.demos-page__lang-switch:hover {
  color: var(--demo-accent);
  border-color: var(--demo-accent);
}

.demos-page__theme-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--demo-accent-border);
  border-radius: 6px;
  background: var(--demo-accent-subtle);
  color: var(--demo-text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.demos-page__theme-toggle:hover {
  color: var(--demo-accent);
  border-color: var(--demo-accent);
}

.demos-page__icon-sun { display: none; }
.demos-page__icon-moon { display: block; }

.demos-page__cta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 15px;
  border-radius: 6px;
  background: var(--demo-accent);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-decoration: none;
  transition: all var(--transition-fast);
}

.demos-page__cta:hover {
  background: var(--demo-accent-light);
  transform: translateX(2px);
}

.demos-page__main {
  position: relative;
  z-index: 1;
  flex: 1;
  width: min(1180px, calc(100% - 48px));
  margin: 0 auto;
  padding: 56px 0 72px;
}

.demos-page__hero {
  margin-bottom: 40px;
}

.demos-page__eyebrow {
  margin: 0 0 12px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--demo-accent-light);
}

.demos-page__title {
  margin: 0 0 14px;
  font-family: var(--font-body);
  font-size: clamp(32px, 5vw, 46px);
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.02em;
  color: var(--demo-text-strong);
}

.demos-page__subhead {
  max-width: 640px;
  margin: 0;
  font-size: 15px;
  line-height: 1.6;
  color: var(--demo-text);
}

.demos-page__footer {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  padding: 16px 28px;
  border-top: 1px solid var(--demo-border);
  background: var(--demo-bg-overlay);
}

.demos-page__footer-links {
  display: flex;
  align-items: center;
  gap: 12px;
}

.demos-page__footer-link {
  color: var(--demo-text-muted);
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-decoration: none;
  transition: color var(--transition-fast);
}

.demos-page__footer-link:hover {
  color: var(--demo-accent);
}

.demos-page__divider {
  color: var(--demo-border-strong);
  user-select: none;
}

.demos-page__footer-note {
  margin: 0;
  color: var(--demo-text-muted);
  font-size: 11px;
}

/* Hide VitePress chrome */
.demos-page :deep(.VPNav),
.demos-page :deep(.VPNavBar),
.demos-page :deep(.VPSidebar),
.demos-page :deep(.VPFooter),
.demos-page :deep(.VPLocalNav) {
  display: none !important;
}

@media (max-width: 720px) {
  .demos-page__header {
    padding: 12px 16px;
    gap: 10px;
  }

  .demos-page__tagline {
    display: none;
  }

  .demos-page__main {
    width: calc(100% - 32px);
    padding: 36px 0 52px;
  }
}
</style>

<style>
html.dark .demos-page__icon-sun { display: block; }
html.dark .demos-page__icon-moon { display: none; }
</style>
