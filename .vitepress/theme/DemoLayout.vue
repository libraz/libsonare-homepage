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
      eyebrow: 'Browser WASM / Python / C++',
      headline: 'Audio analysis you can run locally',
      description: 'Try the live browser demo first, then use the same core library from TypeScript, Python, Node.js, or C++.',
      features: ['BPM estimation', 'Key estimation', 'Chroma features', 'Streaming estimates'],
    },
    quickStart: {
      title: 'Use it in 30 seconds',
      note: 'The WASM package expects decoded mono Float32Array samples. Use Web Audio API or another decoder before analysis.',
      docs: 'Open full guide',
      items: [
        {
          id: 'browser',
          label: 'Browser',
          docsPath: '/docs/wasm',
          code: `npm install @libraz/libsonare

import { init, detectBpm, detectKey } from '@libraz/libsonare'

await init()
const bpm = detectBpm(samples, sampleRate)
const key = detectKey(samples, sampleRate)`,
        },
        {
          id: 'python',
          label: 'Python',
          docsPath: '/docs/python-api',
          code: `pip install libsonare

import libsonare as sonare

result = sonare.analyze_file("track.wav")
print(result.bpm, result.key.name)`,
        },
        {
          id: 'cli',
          label: 'CLI',
          docsPath: '/docs/cli',
          code: `pip install libsonare

sonare analyze track.wav
sonare bpm track.wav
sonare key track.wav`,
        },
      ],
    },
    demoLead: 'Live demo',
    demoDescription: 'Drop or play audio to see streaming estimates for BPM, key, chroma, and spectrum data in the browser.',
    demoLinks: [
      { label: 'WASM API', path: '/docs/wasm' },
      { label: 'Python API', path: '/docs/python-api' },
      { label: 'CLI', path: '/docs/cli' },
    ],

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
      eyebrow: 'Browser WASM / Python / C++',
      headline: 'ローカルで動くオーディオ解析',
      description: 'まずブラウザ上のライブデモで挙動を確認し、そのまま同じコアライブラリを TypeScript、Python、Node.js、C++ から利用できます。',
      features: ['BPM推定', 'キー推定', 'クロマ特徴量', 'ストリーミング推定'],
    },
    quickStart: {
      title: '30秒で試す',
      note: 'WASMパッケージはデコード済みのモノラル Float32Array を受け取ります。ファイルのデコードには Web Audio API などを使ってください。',
      docs: '詳しい手順を見る',
      items: [
        {
          id: 'browser',
          label: 'Browser',
          docsPath: '/docs/wasm',
          code: `npm install @libraz/libsonare

import { init, detectBpm, detectKey } from '@libraz/libsonare'

await init()
const bpm = detectBpm(samples, sampleRate)
const key = detectKey(samples, sampleRate)`,
        },
        {
          id: 'python',
          label: 'Python',
          docsPath: '/docs/python-api',
          code: `pip install libsonare

import libsonare as sonare

result = sonare.analyze_file("track.wav")
print(result.bpm, result.key.name)`,
        },
        {
          id: 'cli',
          label: 'CLI',
          docsPath: '/docs/cli',
          code: `pip install libsonare

sonare analyze track.wav
sonare bpm track.wav
sonare key track.wav`,
        },
      ],
    },
    demoLead: 'ライブデモ',
    demoDescription: '音源をドロップまたは再生すると、ブラウザ内でBPM、キー、クロマ、スペクトル情報のストリーミング推定を確認できます。',
    demoLinks: [
      { label: 'WASM API', path: '/docs/wasm' },
      { label: 'Python API', path: '/docs/python-api' },
      { label: 'CLI', path: '/docs/cli' },
    ],

    demoCredit: 'デモ音源は',
    midiSketch: 'MIDI Sketch',
  },
} as const

type LocaleKey = keyof typeof locales
const defaultLocale: LocaleKey = 'en'

// Current locale config
const currentLocale = computed(() => locales[lang.value as LocaleKey] || locales[defaultLocale])
const quickStartMode = ref('browser')
const currentQuickStart = computed(() =>
  currentLocale.value.quickStart.items.find((item) => item.id === quickStartMode.value)
  || currentLocale.value.quickStart.items[0]
)

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function highlightCode(code: string, mode: string) {
  const lines = escapeHtml(code).split('\n')

  if (mode === 'cli') {
    return lines.map((line) => {
      if (!line.trim()) return ''
      return line.replace(/^(\S+)/, '<span class="demo-page__code-command">$1</span>')
    }).join('\n')
  }

  if (mode === 'python') {
    return lines.map((line) => line
      .replace(/(&quot;[^&]*&quot;|"[^"]*"|'[^']*')/g, '<span class="demo-page__code-string">$1</span>')
      .replace(/\b(import|as|from|with|print)\b/g, '<span class="demo-page__code-keyword">$1</span>')
      .replace(/\b(result|sonare)\b/g, '<span class="demo-page__code-variable">$1</span>')
    ).join('\n')
  }

  return lines.map((line) => line
    .replace(/(&quot;[^&]*&quot;|"[^"]*"|'[^']*')/g, '<span class="demo-page__code-string">$1</span>')
    .replace(/\b(import|from|await|const)\b/g, '<span class="demo-page__code-keyword">$1</span>')
    .replace(/\b(init|detectBpm|detectKey)\b/g, '<span class="demo-page__code-function">$1</span>')
    .replace(/\b(samples|sampleRate|bpm|key)\b/g, '<span class="demo-page__code-variable">$1</span>')
  ).join('\n')
}

const highlightedQuickStart = computed(() =>
  highlightCode(currentQuickStart.value.code, currentQuickStart.value.id)
)

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
        <a :href="localePath('/docs/introduction')" class="demo-page__docs-link">
          {{ currentLocale.docsLabel }}
        </a>
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
      <div class="demo-page__copy">
        <p class="demo-page__eyebrow">{{ currentLocale.intro.eyebrow }}</p>
        <h1 class="demo-page__headline">{{ currentLocale.intro.headline }}</h1>
        <p class="demo-page__description">{{ currentLocale.intro.description }}</p>
        <ul class="demo-page__features">
          <li v-for="feature in currentLocale.intro.features" :key="feature" class="demo-page__feature">
            {{ feature }}
          </li>
        </ul>
      </div>

      <aside class="demo-page__quick-start" aria-labelledby="quick-start-title">
        <div class="demo-page__quick-header">
          <h2 id="quick-start-title" class="demo-page__quick-title">{{ currentLocale.quickStart.title }}</h2>
          <a :href="localePath(currentQuickStart.docsPath)" class="demo-page__quick-docs">
            {{ currentLocale.quickStart.docs }}
          </a>
        </div>
        <div class="demo-page__quick-tabs" role="tablist" aria-label="Quick start examples">
          <button
            v-for="item in currentLocale.quickStart.items"
            :key="item.id"
            class="demo-page__quick-tab"
            :class="{ 'demo-page__quick-tab--active': quickStartMode === item.id }"
            type="button"
            role="tab"
            :aria-selected="quickStartMode === item.id"
            @click="quickStartMode = item.id"
          >
            {{ item.label }}
          </button>
        </div>
        <pre class="demo-page__code"><code v-html="highlightedQuickStart"></code></pre>
        <p class="demo-page__quick-note">{{ currentLocale.quickStart.note }}</p>
      </aside>
    </section>

    <!-- Main Demo Area -->
    <div class="demo-page__demo-heading">
      <div class="demo-page__demo-copy">
        <span class="demo-page__demo-lead">{{ currentLocale.demoLead }}</span>
        <span class="demo-page__demo-description">{{ currentLocale.demoDescription }}</span>
      </div>
      <nav class="demo-page__demo-links" aria-label="Implementation documentation">
        <a
          v-for="link in currentLocale.demoLinks"
          :key="link.path"
          :href="localePath(link.path)"
          class="demo-page__demo-link"
        >
          {{ link.label }}
        </a>
      </nav>
    </div>
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

/* ===== DOCS LINK ===== */
.demo-page__docs-link {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: var(--demo-text);
  text-decoration: none;
  padding: 6px 10px;
  border-radius: 6px;
  transition: color 0.2s ease, background-color 0.2s ease;
}

.demo-page__docs-link:hover {
  color: var(--demo-accent);
  background: var(--demo-accent-subtle);
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
  display: grid;
  grid-template-columns: minmax(280px, 0.9fr) minmax(360px, 1.1fr);
  gap: 24px;
  align-items: stretch;
  padding: 28px 24px 0;
  width: min(1180px, calc(100% - 48px));
  max-width: 1180px;
  margin: 0 auto;
}

.demo-page__copy {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
}

.demo-page__eyebrow {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.12em;
  color: var(--demo-accent-light);
  margin: 0 0 8px;
  text-transform: uppercase;
}

.demo-page__headline {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 28px;
  font-weight: 600;
  letter-spacing: 0;
  color: var(--demo-text-strong);
  margin: 0 0 8px;
  line-height: 1.18;
}

.demo-page__description {
  font-size: 13px;
  font-weight: 400;
  line-height: 1.6;
  color: var(--demo-text);
  margin: 0 0 16px;
}

.demo-page__features {
  display: flex;
  flex-wrap: wrap;
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

.demo-page__quick-start {
  min-width: 0;
  background: var(--demo-bg-elevated);
  border: 1px solid var(--demo-border-strong);
  border-radius: 8px;
  box-shadow: var(--demo-shadow-glow);
  padding: 14px;
}

.demo-page__quick-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.demo-page__quick-title {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0;
  color: var(--demo-text-strong);
  margin: 0;
}

.demo-page__quick-docs {
  flex-shrink: 0;
  color: var(--demo-accent-light);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-decoration: none;
}

.demo-page__quick-docs:hover {
  color: var(--demo-accent);
}

.demo-page__quick-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
  padding: 3px;
  margin-bottom: 10px;
  background: rgba(0, 0, 0, 0.18);
  border: 1px solid var(--demo-border);
  border-radius: 6px;
}

html:not(.dark) .demo-page .demo-page__quick-tabs {
  background: rgba(255, 255, 255, 0.55);
}

.demo-page__quick-tab {
  min-width: 0;
  height: 28px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--demo-text-muted);
  cursor: pointer;
  font-family: inherit;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.demo-page__quick-tab:hover,
.demo-page__quick-tab--active {
  background: var(--demo-accent);
  color: #fff;
}

.demo-page__code {
  min-height: 148px;
  overflow: auto;
  margin: 0;
  padding: 12px;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid var(--demo-border);
  border-radius: 6px;
  color: var(--demo-text-strong);
  font-size: 11px;
  line-height: 1.55;
  tab-size: 2;
}

html:not(.dark) .demo-page .demo-page__code {
  background: rgba(255, 255, 255, 0.78);
}

.demo-page__code code {
  font-family: 'JetBrains Mono', monospace;
}

.demo-page__code :deep(.demo-page__code-keyword) {
  color: #c4b5fd;
}

.demo-page__code :deep(.demo-page__code-function),
.demo-page__code :deep(.demo-page__code-command) {
  color: #67e8f9;
}

.demo-page__code :deep(.demo-page__code-string) {
  color: #fcd34d;
}

.demo-page__code :deep(.demo-page__code-variable) {
  color: #f9a8d4;
}

html:not(.dark) .demo-page .demo-page__code :deep(.demo-page__code-keyword) {
  color: #6d28d9;
}

html:not(.dark) .demo-page .demo-page__code :deep(.demo-page__code-function),
html:not(.dark) .demo-page .demo-page__code :deep(.demo-page__code-command) {
  color: #0891b2;
}

html:not(.dark) .demo-page .demo-page__code :deep(.demo-page__code-string) {
  color: #9a3412;
}

html:not(.dark) .demo-page .demo-page__code :deep(.demo-page__code-variable) {
  color: #be185d;
}

.demo-page__quick-note {
  margin: 10px 0 0;
  color: var(--demo-text-muted);
  font-size: 10px;
  line-height: 1.55;
}

.demo-page__demo-heading {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: min(1180px, calc(100% - 48px));
  margin: 18px auto 0;
}

.demo-page__demo-copy {
  display: flex;
  align-items: baseline;
  gap: 12px;
  min-width: 0;
}

.demo-page__demo-lead {
  flex-shrink: 0;
  color: var(--demo-text-strong);
  font-family: 'Space Grotesk', sans-serif;
  font-size: 15px;
  font-weight: 600;
}

.demo-page__demo-description {
  color: var(--demo-text-muted);
  font-size: 11px;
  line-height: 1.55;
}

.demo-page__demo-links {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 6px;
}

.demo-page__demo-link {
  color: var(--demo-text);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-decoration: none;
  padding: 5px 8px;
  background: var(--demo-accent-subtle);
  border: 1px solid var(--demo-accent-border);
  border-radius: 4px;
  transition: color 0.2s ease, border-color 0.2s ease, background-color 0.2s ease;
}

.demo-page__demo-link:hover {
  color: var(--demo-accent-light);
  border-color: var(--demo-accent);
  background: var(--demo-accent-dim);
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
    grid-template-columns: 1fr;
    padding: 20px 20px 0;
    width: min(720px, calc(100% - 40px));
    gap: 18px;
  }

  .demo-page__headline {
    font-size: 24px;
  }

  .demo-page__demo-heading {
    width: min(720px, calc(100% - 40px));
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
  }

  .demo-page__demo-copy {
    align-items: flex-start;
    flex-direction: column;
    gap: 4px;
  }
}

@media (max-width: 768px) {
  .demo-page__intro {
    padding: 16px 16px 0;
    width: calc(100% - 32px);
  }

  .demo-page__headline {
    font-size: 21px;
  }

  .demo-page__description {
    font-size: 12px;
  }

  .demo-page__features {
    gap: 6px;
  }

  .demo-page__feature {
    font-size: 8px;
    padding: 3px 8px;
  }

  .demo-page__quick-start {
    padding: 12px;
  }

  .demo-page__quick-header {
    align-items: flex-start;
    flex-direction: column;
    gap: 6px;
  }

  .demo-page__code {
    min-height: 132px;
    font-size: 10px;
  }

  .demo-page__demo-heading {
    width: calc(100% - 32px);
    gap: 4px;
    margin-top: 14px;
  }

  .demo-page__demo-links {
    flex-wrap: wrap;
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

  .demo-page__docs-link {
    font-size: 10px;
    padding: 5px 8px;
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
