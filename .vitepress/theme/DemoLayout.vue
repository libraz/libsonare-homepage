<script setup lang="ts">
import AudioAnalyzer from '@/components/AudioAnalyzer.vue'
import { GridOverlay, CornerBrackets } from '@/components/ui'
import { useData } from 'vitepress'
import { computed, onMounted, ref } from 'vue'
import { createTheme } from '@/composables/useTheme'

const { lang } = useData()
const libVersion = ref<string>('')
const { isDark, toggle: toggleTheme } = createTheme()

// Initialize WASM lazily to avoid blocking page render
async function initWasm() {
  if (typeof window === 'undefined') return
  if (libVersion.value) return // Already initialized

  try {
    const wasm = await import('@/wasm/index.js')
    await wasm.init()
    libVersion.value = wasm.version()
  } catch (e) {
    console.warn('Failed to initialize WASM:', e)
  }
}

// Defer WASM initialization to after page render
onMounted(() => {
  const ric = (window as any).requestIdleCallback
  if (ric) {
    ric(initWasm, { timeout: 2000 })
  } else {
    setTimeout(initWasm, 100)
  }
})

// Locale configuration for multi-language support
const locales = {
  en: {
    label: 'English',
    shortLabel: 'EN',
    path: '',
    docsLabel: 'Docs',
    tagline: 'WebAssembly Audio Analysis Library',
    cta: 'Get Started',
    intro: {
      headline: 'High-performance audio analysis in the browser',
      description: 'Extract BPM, key, chroma features, and more from audio files using WebAssembly. No server required.',
      features: ['Chroma / Spectral Analysis', 'Beat Detection', 'Key Estimation', 'Zero Dependencies'],
    },

    demoCredit: 'Demo audio created with',
    midiSketch: 'MIDI Sketch',
  },
  ja: {
    label: '日本語',
    shortLabel: '日本語',
    path: '/ja',
    docsLabel: 'ドキュメント',
    tagline: 'WebAssembly 音声解析ライブラリ',
    cta: 'はじめる',
    intro: {
      headline: 'ブラウザで動作する高速オーディオ解析',
      description: 'WebAssemblyでBPM、キー、クロマ特徴量などを抽出。サーバー不要で完全クライアントサイド。',
      features: ['クロマ / スペクトル解析', 'ビート検出', 'キー推定', '依存関係ゼロ'],
    },

    demoCredit: 'デモ音源は',
    midiSketch: 'MIDI Sketch',
  },
} as const

type LocaleKey = keyof typeof locales
const defaultLocale: LocaleKey = 'en'

// Current locale config
const currentLocale = computed(() => locales[lang.value as LocaleKey] || locales[defaultLocale])

// Build locale-aware path
const localePath = (path: string) => `${currentLocale.value.path}${path}`

// Coordinate disguised as build node ID
const nodeId = computed(() => {
  const now = new Date()
  const [lat, lng] = (now.getMonth() === 6 && now.getDate() === 10)
    ? ['35.5568', '139.4386']
    : ['31.9505', '115.8605']
  return `${lat}-${lng}`
})

// Available locales for language switcher (excluding current)
const otherLocales = computed(() =>
  Object.entries(locales)
    .filter(([key]) => key !== lang.value)
    .map(([key, config]) => ({ key, ...config }))
)
</script>

<template>
  <div class="demo-page" :class="`demo-page--${lang}`">
    <!-- Technical Grid Background -->
    <div class="demo-page__backdrop">
      <!-- Grid overlay using shared component -->
      <GridOverlay scanlines />

      <!-- Corner accents using shared component -->
      <CornerBrackets size="lg" offset="lg" />

      <!-- Ambient glow -->
      <div class="demo-page__glow demo-page__glow--1"></div>
      <div class="demo-page__glow demo-page__glow--2"></div>

      <!-- Noise texture -->
      <div class="demo-page__noise"></div>
    </div>

    <!-- Top Status Bar -->
    <header class="demo-page__header">
      <div class="demo-page__header-left">
        <span class="demo-page__brand">LIBSONARE</span>
        <span class="demo-page__tagline">{{ currentLocale.tagline }}</span>
      </div>
      <div class="demo-page__header-right">
        <span class="demo-page__version">v{{ libVersion || '-.-.--' }}</span>
        <button
          class="demo-page__theme-toggle"
          :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
          @click="toggleTheme"
        >
          <!-- Sun icon (shown in dark mode) -->
          <svg class="demo-page__icon-sun" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="5"/>
            <line x1="12" y1="1" x2="12" y2="3"/>
            <line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/>
            <line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
          <!-- Moon icon (shown in light mode) -->
          <svg class="demo-page__icon-moon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        </button>
        <a :href="localePath('/docs/getting-started')" class="demo-page__cta">
          {{ currentLocale.cta }}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </a>
      </div>
    </header>

    <!-- Intro Section -->
    <section class="demo-page__intro">
      <h1 class="demo-page__headline">{{ currentLocale.intro.headline }}</h1>
      <p class="demo-page__description">{{ currentLocale.intro.description }}</p>
      <ul class="demo-page__features">
        <li v-for="feature in currentLocale.intro.features" :key="feature" class="demo-page__feature">
          {{ feature }}
        </li>
      </ul>
    </section>

    <!-- Main Demo Area -->
    <main class="demo-page__main">
      <AudioAnalyzer :lib-version="libVersion" />
    </main>

    <!-- Bottom Status Bar -->
    <footer class="demo-page__footer">
      <div class="demo-page__footer-links">
        <a
          href="https://github.com/libraz/libsonare"
          target="_blank"
          rel="noopener noreferrer"
          class="demo-page__link"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
          <span>SOURCE</span>
        </a>
        <span class="demo-page__divider">|</span>
        <a
          href="https://opensource.org/licenses/Apache-2.0"
          target="_blank"
          rel="noopener noreferrer"
          class="demo-page__link"
        >
          <span>APACHE-2.0</span>
        </a>
        <span class="demo-page__divider">|</span>
        <a :href="localePath('/docs/getting-started')" class="demo-page__link">
          <span>{{ currentLocale.docsLabel.toUpperCase() }}</span>
        </a>
        <template v-for="locale in otherLocales" :key="locale.key">
          <span class="demo-page__divider">|</span>
          <a :href="locale.path || '/'" class="demo-page__link demo-page__lang-switch">
            <span>{{ locale.shortLabel }}</span>
          </a>
        </template>
      </div>
      <div class="demo-page__footer-center">
        <span class="demo-page__personal-attr">
          a personal project by <a
            href="https://libraz.net"
            target="_blank"
            rel="noopener noreferrer"
            class="demo-page__author-link"
          >libraz</a>
        </span>
        <span class="demo-page__footer-dot">·</span>
        <span class="demo-page__demo-credit">
          {{ currentLocale.demoCredit }}
          <a
            href="https://midisketch.libraz.net/"
            target="_blank"
            rel="noopener noreferrer"
            class="demo-page__midi-sketch-link"
          >{{ currentLocale.midiSketch }}</a>{{ lang === 'ja' ? 'で作成' : '' }}
        </span>
      </div>
      <div class="demo-page__footer-meta">
        <span class="demo-page__node-id" :title="nodeId">{{ nodeId }}</span>
      </div>
    </footer>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');

/* ===== THEME TOKENS (Dark - default) ===== */
.demo-page {
  /* Page */
  --demo-bg: #030405;
  --demo-bg-overlay: rgba(10, 12, 18, 0.95);
  /* Panels / elevated surfaces */
  --demo-bg-elevated: rgba(8, 10, 14, 0.85);
  --demo-bg-header: rgba(20, 22, 28, 0.8);
  /* Text hierarchy */
  --demo-text-strong: #ffffff;
  --demo-text: rgba(255, 255, 255, 0.7);
  --demo-text-muted: rgba(255, 255, 255, 0.35);
  --demo-text-faint: rgba(255, 255, 255, 0.2);
  /* Accent */
  --demo-accent: #8B5CF6;
  --demo-accent-light: #A78BFA;
  --demo-accent-dim: rgba(139, 92, 246, 0.3);
  --demo-accent-subtle: rgba(139, 92, 246, 0.08);
  --demo-accent-border: rgba(139, 92, 246, 0.2);
  /* Status colors */
  --demo-cyan: #22D3EE;
  --demo-amber: #F59E0B;
  --demo-success: rgba(100, 200, 180, 0.9);
  /* Borders */
  --demo-border: rgba(139, 92, 246, 0.12);
  --demo-border-strong: rgba(139, 92, 246, 0.25);
  /* Shadows & effects */
  --demo-glow-opacity: 0.15;
  --demo-shadow: rgba(0, 0, 0, 0.4);
  --demo-shadow-glow: 0 0 40px -10px rgba(139, 92, 246, 0.2);
  /* Visualizer bezel */
  --demo-bezel: #080a0e;
  --demo-bezel-start: #10131a;
  --demo-bezel-end: #060810;
  --demo-bezel-inset-light: rgba(255, 255, 255, 0.02);
  --demo-bezel-inset-dark: rgba(0, 0, 0, 0.4);
  --demo-bezel-shadow-deep: rgba(0, 0, 0, 0.7);
  --demo-screen-inset-1: rgba(0, 0, 0, 0.8);
  --demo-screen-inset-2: rgba(0, 0, 0, 0.5);
  --demo-indicator-bg: rgba(0, 0, 0, 0.6);
  /* Grid */
  --demo-grid-color: rgba(139, 92, 246, 0.04);
  --demo-grid-minor: rgba(139, 92, 246, 0.02);
  --demo-scanline: rgba(0, 0, 0, 0.03);
  /* Canvas/screen */
  --demo-screen-bg: rgb(6, 8, 12);
  --demo-screen-bg-alpha: rgba(6, 8, 12, 0.6);
  /* DropZone */
  --demo-dropzone-bg: rgba(8, 10, 14, 0.9);
  --demo-dropzone-dragging-bg: rgba(139, 92, 246, 0.08);

  min-height: 100vh;
  min-height: 100dvh;
  background: var(--demo-bg);
  color: var(--demo-text);
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
  font-family: 'JetBrains Mono', monospace;
  transition: background-color 0.3s ease, color 0.3s ease;
}

/* ===== THEME TOKENS (Light) ===== */
html:not(.dark) .demo-page {
  /* Page - subtle purple-tinted white like libraz-homepage hero */
  --demo-bg: #f8f6ff;
  --demo-bg-overlay: rgba(248, 246, 255, 0.95);
  /* Panels / elevated surfaces */
  --demo-bg-elevated: rgba(245, 243, 255, 0.85);
  --demo-bg-header: rgba(250, 248, 255, 0.8);
  /* Text hierarchy */
  --demo-text-strong: #1a1a2e;
  --demo-text: rgba(0, 0, 0, 0.55);
  --demo-text-muted: rgba(0, 0, 0, 0.35);
  --demo-text-faint: rgba(0, 0, 0, 0.2);
  /* Accent - same hue, adjusted for light bg */
  --demo-accent: #7C3AED;
  --demo-accent-light: #8B5CF6;
  --demo-accent-dim: rgba(124, 58, 237, 0.25);
  --demo-accent-subtle: rgba(124, 58, 237, 0.06);
  --demo-accent-border: rgba(124, 58, 237, 0.2);
  /* Status colors */
  --demo-success: rgba(16, 185, 129, 0.9);
  /* Borders */
  --demo-border: rgba(0, 0, 0, 0.07);
  --demo-border-strong: rgba(0, 0, 0, 0.13);
  /* Shadows & effects */
  --demo-glow-opacity: 0;
  --demo-shadow: rgba(0, 0, 0, 0.08);
  --demo-shadow-glow: 0 4px 20px -4px rgba(0, 0, 0, 0.06);
  /* Visualizer bezel - elegant light frame */
  --demo-bezel: #e8e5f0;
  --demo-bezel-start: #f0edf8;
  --demo-bezel-end: #e0dce8;
  --demo-bezel-inset-light: rgba(255, 255, 255, 0.6);
  --demo-bezel-inset-dark: rgba(0, 0, 0, 0.06);
  --demo-bezel-shadow-deep: rgba(100, 80, 160, 0.15);
  --demo-screen-inset-1: rgba(0, 0, 0, 0.3);
  --demo-screen-inset-2: rgba(0, 0, 0, 0.15);
  --demo-indicator-bg: rgba(0, 0, 0, 0.5);
  /* Grid - hidden in light mode */
  --demo-grid-color: transparent;
  --demo-grid-minor: transparent;
  --demo-scanline: transparent;
  /* Canvas/screen */
  --demo-screen-bg: rgb(245, 243, 255);
  --demo-screen-bg-alpha: rgba(245, 243, 255, 0.6);
  /* DropZone */
  --demo-dropzone-bg: rgba(245, 243, 255, 0.9);
  --demo-dropzone-dragging-bg: rgba(124, 58, 237, 0.06);
}

/* ===== BACKDROP ===== */
.demo-page__backdrop {
  position: fixed;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 0;
}

.demo-page__glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(120px);
  opacity: var(--demo-glow-opacity);
  transition: opacity 0.4s ease;
}

.demo-page__glow--1 {
  width: 600px;
  height: 600px;
  background: radial-gradient(circle, var(--demo-accent) 0%, transparent 70%);
  top: -20%;
  left: 50%;
  transform: translateX(-50%);
}

.demo-page__glow--2 {
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, var(--demo-cyan) 0%, transparent 70%);
  bottom: -10%;
  right: -5%;
  opacity: calc(var(--demo-glow-opacity) * 0.5);
}

.demo-page__noise {
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  opacity: 0.02;
  mix-blend-mode: overlay;
}

/* Hide backdrop decorations in light mode */
html:not(.dark) .demo-page .demo-page__backdrop {
  display: none;
}

/* ===== HEADER ===== */
.demo-page__header {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  background: linear-gradient(to bottom, var(--demo-bg-overlay), transparent);
  border-bottom: 1px solid var(--demo-border);
}

html:not(.dark) .demo-page .demo-page__header {
  background: var(--demo-bg-overlay);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.demo-page__header-left,
.demo-page__header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.demo-page__brand {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: var(--demo-text-strong);
}

.demo-page__tagline {
  font-size: 10px;
  font-weight: 400;
  letter-spacing: 0.05em;
  color: var(--demo-text-muted);
}

.demo-page__version {
  font-size: 10px;
  font-weight: 500;
  color: var(--demo-text-muted);
  font-variant-numeric: tabular-nums;
  padding: 4px 8px;
  background: var(--demo-accent-subtle);
  border-radius: 4px;
}

/* ===== THEME TOGGLE ===== */
.demo-page__theme-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  background: var(--demo-accent-subtle);
  border: 1px solid var(--demo-accent-border);
  border-radius: 6px;
  color: var(--demo-text-muted);
  cursor: pointer;
  transition: all 0.2s ease;
}

.demo-page__theme-toggle:hover {
  color: var(--demo-accent);
  background: var(--demo-accent-dim);
  border-color: var(--demo-accent);
}

/* Show sun in dark mode, moon in light mode — pure CSS avoids hydration mismatch */
.demo-page__icon-sun { display: none; }
.demo-page__icon-moon { display: block; }
</style>

<style>
/* Global (non-scoped) selectors for html.dark — scoped CSS can't target <html> ancestor reliably */
html.dark .demo-page__icon-sun { display: block; }
html.dark .demo-page__icon-moon { display: none; }
</style>

<style scoped>
.demo-page__cta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: #fff;
  text-decoration: none;
  padding: 6px 14px;
  background: var(--demo-accent);
  border-radius: 6px;
  transition: all 0.2s ease;
}

.demo-page__cta:hover {
  background: #9D6FFF;
  transform: translateX(2px);
}

.demo-page__cta svg {
  transition: transform 0.2s ease;
}

.demo-page__cta:hover svg {
  transform: translateX(3px);
}

/* ===== INTRO ===== */
.demo-page__intro {
  position: relative;
  z-index: 2;
  flex-shrink: 0;
  text-align: center;
  padding: 24px 24px 0;
  max-width: 640px;
  margin: 0 auto;
}

.demo-page__headline {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--demo-text-strong);
  margin: 0 0 8px;
  line-height: 1.3;
}

.demo-page__description {
  font-size: 12px;
  font-weight: 400;
  line-height: 1.6;
  color: var(--demo-text-muted);
  margin: 0 0 16px;
}

.demo-page__features {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  list-style: none;
  padding: 0;
  margin: 0;
}

.demo-page__feature {
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 0.05em;
  color: var(--demo-accent);
  padding: 4px 10px;
  background: var(--demo-accent-subtle);
  border: 1px solid var(--demo-accent-border);
  border-radius: 4px;
}

/* ===== MAIN ===== */
.demo-page__main {
  flex: 1;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 1rem;
  position: relative;
  z-index: 1;
  min-height: 0;
}

/* ===== FOOTER ===== */
.demo-page__footer {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 24px;
  background: linear-gradient(to top, var(--demo-bg-overlay), transparent);
  border-top: 1px solid var(--demo-border);
}

html:not(.dark) .demo-page .demo-page__footer {
  background: var(--demo-bg-overlay);
  box-shadow: 0 -1px 3px rgba(0, 0, 0, 0.04);
}

.demo-page__footer-links,
.demo-page__footer-meta,
.demo-page__footer-center {
  display: flex;
  align-items: center;
  gap: 12px;
}

.demo-page__personal-attr {
  font-size: 9px;
  font-weight: 400;
  letter-spacing: 0.05em;
  color: var(--demo-text-muted);
}

.demo-page__author-link {
  color: var(--demo-text);
  text-decoration: none;
  font-weight: 600;
  letter-spacing: 0.08em;
  transition: color 0.2s;
}

.demo-page__author-link:hover {
  color: var(--demo-accent);
}

.demo-page__footer-dot {
  color: var(--demo-border);
  font-size: 10px;
  user-select: none;
}

.demo-page__demo-credit {
  font-size: 9px;
  font-weight: 400;
  letter-spacing: 0.05em;
  color: var(--demo-text-muted);
}

.demo-page__midi-sketch-link {
  color: var(--demo-accent);
  text-decoration: none;
  font-weight: 600;
  transition: color 0.2s;
}

.demo-page__midi-sketch-link:hover {
  color: var(--demo-accent-light);
}

.demo-page__link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--demo-text-muted);
  text-decoration: none;
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 0.1em;
  transition: color 0.2s;
}

.demo-page__link:hover {
  color: var(--demo-accent);
}

.demo-page__link svg {
  opacity: 0.6;
}

.demo-page__divider {
  color: var(--demo-border);
  font-size: 10px;
  user-select: none;
}

.demo-page__lang-switch {
  font-weight: 600;
}

.demo-page__node-id {
  font-size: 9px;
  font-weight: 400;
  letter-spacing: 0.08em;
  color: var(--demo-text-muted);
  font-variant-numeric: tabular-nums;
  opacity: 0.5;
}

/* Hide VitePress chrome */
.demo-page :deep(.VPNav),
.demo-page :deep(.VPNavBar),
.demo-page :deep(.VPSidebar),
.demo-page :deep(.VPFooter),
.demo-page :deep(.VPLocalNav) {
  display: none !important;
}

/* ===== RESPONSIVE ===== */
@media (max-width: 900px) {
  .demo-page__tagline {
    display: none;
  }

  .demo-page__version {
    display: none;
  }

  .demo-page__intro {
    padding: 20px 20px 0;
  }

  .demo-page__headline {
    font-size: 18px;
  }
}

@media (max-width: 768px) {
  .demo-page__intro {
    padding: 16px 16px 0;
  }

  .demo-page__headline {
    font-size: 16px;
  }

  .demo-page__description {
    font-size: 11px;
  }

  .demo-page__features {
    gap: 6px;
  }

  .demo-page__feature {
    font-size: 8px;
    padding: 3px 8px;
  }

  .demo-page__header {
    padding: 10px 16px;
  }

  .demo-page__brand {
    font-size: 12px;
  }

  .demo-page__cta {
    font-size: 10px;
    padding: 5px 10px;
  }

  .demo-page__cta svg {
    display: none;
  }

  .demo-page__main {
    padding: 0.5rem;
  }

  .demo-page__footer {
    flex-direction: column;
    gap: 8px;
    padding: 8px 16px;
  }

  .demo-page__footer-meta {
    display: none;
  }
}
</style>
