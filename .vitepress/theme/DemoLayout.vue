<script setup lang="ts">
import AudioAnalyzer from '@/components/AudioAnalyzer.vue'
import { GridOverlay, CornerBrackets } from '@/components/ui'
import { useData } from 'vitepress'
import { computed, onMounted, ref } from 'vue'

const { lang } = useData()
const libVersion = ref<string>('')

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
        <span class="demo-page__coord">48.8566N 2.3522E</span>
        <span class="demo-page__divider">|</span>
        <span class="demo-page__timestamp">{{ new Date().toISOString().slice(0, 19).replace('T', ' ') }}</span>
      </div>
    </footer>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');

.demo-page {
  --demo-bg: #030405;
  --demo-accent: #8B5CF6;
  --demo-accent-dim: rgba(139, 92, 246, 0.3);
  --demo-cyan: #22D3EE;
  --demo-amber: #F59E0B;
  --demo-text: rgba(255, 255, 255, 0.7);
  --demo-text-muted: rgba(255, 255, 255, 0.35);
  --demo-border: rgba(139, 92, 246, 0.12);

  min-height: 100vh;
  min-height: 100dvh;
  background: var(--demo-bg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: 'JetBrains Mono', monospace;
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
  opacity: 0.15;
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
  opacity: 0.08;
}

.demo-page__noise {
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  opacity: 0.02;
  mix-blend-mode: overlay;
}

/* ===== HEADER ===== */
.demo-page__header {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  background: linear-gradient(to bottom, rgba(10, 12, 18, 0.95), transparent);
  border-bottom: 1px solid var(--demo-border);
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
  color: #fff;
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
  background: rgba(139, 92, 246, 0.1);
  border-radius: 4px;
}

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
  z-index: 1;
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
  color: #fff;
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
  background: rgba(139, 92, 246, 0.08);
  border: 1px solid rgba(139, 92, 246, 0.2);
  border-radius: 4px;
}

/* ===== MAIN ===== */
.demo-page__main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  position: relative;
  z-index: 1;
  min-height: 0;
  overflow: hidden;
}

/* ===== FOOTER ===== */
.demo-page__footer {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 24px;
  background: linear-gradient(to top, rgba(10, 12, 18, 0.95), transparent);
  border-top: 1px solid var(--demo-border);
}

.demo-page__footer-links,
.demo-page__footer-meta,
.demo-page__footer-center {
  display: flex;
  align-items: center;
  gap: 12px;
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
  color: #A78BFA;
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

.demo-page__coord,
.demo-page__timestamp {
  font-size: 9px;
  font-weight: 400;
  letter-spacing: 0.05em;
  color: var(--demo-text-muted);
  opacity: 0.6;
  font-variant-numeric: tabular-nums;
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
