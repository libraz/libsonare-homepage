<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useData } from 'vitepress'
import { CornerBrackets, GridOverlay } from '@/components/ui'
import { createTheme } from '@/composables/useTheme'
import wasmMeta from '@/wasm/meta.json'

const { lang } = useData()
const libVersion = ref<string>('')
const { isDark, toggle: toggleTheme } = createTheme()

async function initWasm() {
  if (typeof window === 'undefined') return
  if (libVersion.value) return
  try {
    const wasm = await import('@/wasm/index.js')
    await wasm.init()
    libVersion.value = wasm.version()
  } catch (e) {
    console.warn('Failed to initialize WASM:', e)
  }
}

onMounted(() => {
  const ric = (window as any).requestIdleCallback
  if (ric) {
    ric(initWasm, { timeout: 2000 })
  } else {
    setTimeout(initWasm, 100)
  }
})

const locales = {
  en: {
    label: 'English',
    shortLabel: 'EN',
    path: '',
    docsLabel: 'Docs',
    githubCta: 'GitHub',
    tagline: 'Audio analysis + mastering DSP',
    hero: {
      eyebrow: 'Open Source · Apache-2.0 · WebAssembly',
      title: 'Audio analysis + commercial-grade mastering DSP.',
      subtitle: 'One Apache-2.0 library across C++, Python, and the browser. No SaaS, no upload, no telemetry.',
      installCaption: 'Install',
      installNpm: 'npm install @libraz/libsonare',
      installPip: 'pip install libsonare',
      starCta: 'View on GitHub',
      docsCta: 'Read the docs',
    },
    receipt: [
      { key: 'LICENSE', value: 'APACHE-2.0' },
      { key: 'RUNTIME', value: 'C++17' },
      { key: 'TARGETS', value: 'LINUX · MACOS · WASM' },
      { key: 'PACKAGES', value: 'NPM · PYPI' },
      { key: 'DEPS', value: 'NONE' },
    ],
    demoSection: {
      eyebrow: 'Try it locally',
      heading: 'Two demos. One library.',
      subhead: 'Both run entirely in your browser via WebAssembly. Same Apache-2.0 source on GitHub.',
    },
    analyzer: {
      status: 'LIVE',
      eyebrow: 'Streaming analysis',
      title: 'Audio Analyzer',
      tagline: 'BPM, key, chord, beat, and spectrum — estimated as the audio plays, entirely in the browser.',
      chips: ['BPM', 'KEY', 'CHORDS', 'BEATS', 'SECTIONS', 'CHROMA', 'SPECTRUM'],
      cta: 'Open analyzer',
      path: '/analyzer',
    },
    mastering: {
      status: 'STUDIO',
      eyebrow: 'Mastering DSP',
      title: 'Mastering Studio',
      tagline: 'EQ, dynamics, multiband, stereo, true-peak limiter — render LUFS-normalized WAVs locally.',
      chips: ['EQ', 'DYNAMICS', 'MULTIBAND', 'STEREO', 'TRUE PEAK', 'LUFS', 'REPAIR'],
      cta: 'Open mastering',
      path: '/mastering',
    },
    quickStart: {
      title: 'Use it in your code',
      subtitle: 'One library, three runtimes. Pick a discipline, then a target.',
      docsLink: 'Open full API guide',
      disciplines: { analysis: 'Analysis', mastering: 'Mastering' },
      runtimes: { browser: 'Browser', python: 'Python', cli: 'CLI' },
      note: 'WASM accepts decoded Float32Array samples — use Web Audio API or a JS decoder.',
    },
    pillars: {
      eyebrow: 'What ships in the box',
      heading: 'Built for honest engineering',
      items: [
        {
          tag: 'ANALYSIS',
          title: 'librosa-compatible. Tens of times faster.',
          body: 'BPM, key, chord, beat, section, timbre, dynamics, pitch (YIN / pYIN). librosa-matching defaults (sr 22050, n_fft 2048, hop 512). Parallelized HPSS with multi-threaded median filter.',
          link: { label: 'Benchmarks', path: '/docs/benchmarks' },
        },
        {
          tag: 'MASTERING',
          title: '70+ DSP processors. Published standards.',
          body: 'EQ, dynamics, multiband, stereo, saturation, repair, maximizer, reference matching. ITU-R BS.1770-4 loudness and true-peak, Vicanek biquads, ADAA nonlinearities, polyphase FIR oversampling.',
          link: { label: 'Mastering guide', path: '/docs/glossary' },
        },
        {
          tag: 'LICENSE',
          title: 'Apache-2.0 across the entire stack.',
          body: 'No LGPL/GPL surface. No proprietary algorithms. No SaaS dependencies. Same permissive license from the C++ core to the WASM build.',
          link: { label: 'View LICENSE', path: 'https://github.com/libraz/libsonare/blob/main/LICENSE', external: true },
        },
      ],
    },
    finalCta: {
      heading: 'Drop it into your stack today.',
      subhead: 'One install line. No accounts. No telemetry. No upload.',
      github: 'View source on GitHub',
      docs: 'Read the docs',
      license: 'Apache-2.0 License',
    },
    demoCredit: 'Demo audio created with',
    midiSketch: 'MIDI Sketch',
  },
  ja: {
    label: '日本語',
    shortLabel: 'JA',
    path: '/ja',
    docsLabel: 'ドキュメント',
    githubCta: 'GitHub',
    tagline: 'オーディオ解析 + マスタリング DSP',
    hero: {
      eyebrow: 'オープンソース · Apache-2.0 · WebAssembly',
      title: 'オーディオ解析と業務クオリティのマスタリング DSP を、ひとつの Apache-2.0 ライブラリで。',
      subtitle: 'C++・Python・ブラウザのどこからでも同じコード。SaaS なし、アップロードなし、テレメトリなし。',
      installCaption: 'インストール',
      installNpm: 'npm install @libraz/libsonare',
      installPip: 'pip install libsonare',
      starCta: 'GitHub で見る',
      docsCta: 'ドキュメントを読む',
    },
    receipt: [
      { key: 'LICENSE', value: 'APACHE-2.0' },
      { key: 'RUNTIME', value: 'C++17' },
      { key: 'TARGETS', value: 'LINUX · MACOS · WASM' },
      { key: 'PACKAGES', value: 'NPM · PYPI' },
      { key: 'DEPS', value: 'NONE' },
    ],
    demoSection: {
      eyebrow: 'ローカルで試す',
      heading: '2 つのデモ、ひとつのライブラリ。',
      subhead: 'どちらも WebAssembly でブラウザ内完結。GitHub 上の同じ Apache-2.0 ソースから動いています。',
    },
    analyzer: {
      status: 'LIVE',
      eyebrow: 'ストリーミング解析',
      title: 'オーディオアナライザー',
      tagline: '再生に合わせて BPM・キー・コード・ビート・スペクトルをブラウザ内でリアルタイム推定。',
      chips: ['BPM', 'KEY', 'CHORDS', 'BEATS', 'SECTIONS', 'CHROMA', 'SPECTRUM'],
      cta: 'アナライザーを開く',
      path: '/analyzer',
    },
    mastering: {
      status: 'STUDIO',
      eyebrow: 'マスタリング DSP',
      title: 'マスタリングスタジオ',
      tagline: 'EQ・ダイナミクス・マルチバンド・ステレオ・True-Peak リミッター。LUFS 正規化済みの WAV をローカルで書き出し。',
      chips: ['EQ', 'DYNAMICS', 'MULTIBAND', 'STEREO', 'TRUE PEAK', 'LUFS', 'REPAIR'],
      cta: 'マスタリングを開く',
      path: '/mastering',
    },
    quickStart: {
      title: 'コードに組み込む',
      subtitle: 'ひとつのライブラリ、3 つのランタイム。用途を選んでから実行環境を選びます。',
      docsLink: 'API ガイドを開く',
      disciplines: { analysis: '解析', mastering: 'マスタリング' },
      runtimes: { browser: 'Browser', python: 'Python', cli: 'CLI' },
      note: 'WASM はデコード済みの Float32Array サンプルを受け取ります（Web Audio API などでデコードしてください）。',
    },
    pillars: {
      eyebrow: '同梱されるもの',
      heading: 'エンジニアリングに正直な設計',
      items: [
        {
          tag: 'ANALYSIS',
          title: 'librosa 互換。数十倍高速。',
          body: 'BPM・キー・コード・ビート・セクション・音色・ダイナミクス・ピッチ (YIN / pYIN)。librosa 互換のデフォルト値 (sr 22050、n_fft 2048、hop 512)。HPSS は並列化＋マルチスレッド中央値フィルタで高速化。',
          link: { label: 'ベンチマーク', path: '/docs/benchmarks' },
        },
        {
          tag: 'MASTERING',
          title: '70 以上の DSP プロセッサ。公開規格ベース。',
          body: 'EQ・ダイナミクス・マルチバンド・ステレオ・サチュレーション・リペア・マキシマイザー・リファレンスマッチング。ITU-R BS.1770-4 ラウドネス／トゥルーピーク、Vicanek バイクァッド、ADAA 非線形、ポリフェーズ FIR オーバーサンプリング。',
          link: { label: 'マスタリングガイド', path: '/docs/glossary' },
        },
        {
          tag: 'LICENSE',
          title: 'スタック全体が Apache-2.0。',
          body: 'LGPL/GPL に触れず、プロプライエタリアルゴリズムなし、SaaS 依存なし。C++ コアから WASM ビルドまで一貫してパーミッシブライセンス。',
          link: { label: 'LICENSE を見る', path: 'https://github.com/libraz/libsonare/blob/main/LICENSE', external: true },
        },
      ],
    },
    finalCta: {
      heading: '今すぐスタックに組み込む。',
      subhead: 'インストールは 1 行。アカウントもテレメトリもアップロードもありません。',
      github: 'GitHub でソースを見る',
      docs: 'ドキュメントを読む',
      license: 'Apache-2.0 ライセンス',
    },
    demoCredit: 'デモ音源は',
    midiSketch: 'MIDI Sketch',
  },
} as const

type LocaleKey = keyof typeof locales
const defaultLocale: LocaleKey = 'en'
const currentLocale = computed(() => locales[lang.value as LocaleKey] || locales[defaultLocale])
const localePath = (path: string) => `${currentLocale.value.path}${path}`
const isJa = computed(() => lang.value === 'ja')

const packageLinks = {
  npm: 'https://www.npmjs.com/package/@libraz/libsonare',
  pypi: 'https://pypi.org/project/libsonare/',
}

const wasmReceiptFields = (() => {
  const fields: { key: string; value: string }[] = []
  if (wasmMeta.gzipKB && wasmMeta.sizeKB) {
    fields.push({
      key: 'WASM',
      value: `${wasmMeta.gzipKB} KB gzip / ${wasmMeta.sizeKB} KB raw`,
    })
  }
  const buildDate = wasmMeta.buildDate ? wasmMeta.buildDate.slice(0, 10) : ''
  const buildParts = [buildDate, wasmMeta.commitHash].filter(Boolean)
  if (buildParts.length > 0) {
    fields.push({ key: 'BUILD', value: buildParts.join(' · ') })
  }
  return fields
})()

const otherLocales = computed(() =>
  Object.entries(locales)
    .filter(([key]) => key !== lang.value)
    .map(([key, config]) => ({ key, ...config }))
)

const initialPath = typeof window === 'undefined' ? '/' : window.location.pathname

function otherLocaleHref(targetPath: string) {
  if (lang.value === 'ja') {
    const stripped = initialPath.replace(/^\/ja(\/|$)/, '/')
    return stripped || '/'
  }
  if (initialPath === '/' || initialPath === '') return `${targetPath}/`
  return `${targetPath}${initialPath}`
}

function switchLocale(event: Event, targetPath: string) {
  event.preventDefault()
  event.stopPropagation()
  if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation()
  if (typeof window === 'undefined') return
  window.location.assign(otherLocaleHref(targetPath))
}

// Quick Start matrix
type Discipline = 'analysis' | 'mastering'
type Runtime = 'browser' | 'python' | 'cli'
const discipline = ref<Discipline>('analysis')
const runtime = ref<Runtime>('browser')

const codeMatrix: Record<Discipline, Record<Runtime, string>> = {
  analysis: {
    browser: `import { init, detectBpm, detectKey, analyze } from '@libraz/libsonare'

await init()

const bpm = detectBpm(samples, sampleRate)
const key = detectKey(samples, sampleRate)   // { name: "C major", confidence: 0.95 }
const result = analyze(samples, sampleRate)`,
    python: `import libsonare

audio = libsonare.Audio.from_file("song.mp3")
print(audio.detect_bpm(), audio.detect_key())

result = libsonare.analyze_file("song.mp3")
print(result.bpm, result.key.name, result.tempo_confidence)`,
    cli: `sonare analyze song.mp3
# > Estimated BPM : 161.00 BPM  (conf 75.0%)
# > Estimated Key : C major  (conf 100.0%)

sonare bpm song.mp3 --json
sonare key song.mp3 --json`,
  },
  mastering: {
    browser: `import { init, masteringChainStereo } from '@libraz/libsonare'

await init()

const result = masteringChainStereo(left, right, sampleRate, {
  eq: { tiltDb: 1.0 },
  dynamics: { compressor: { thresholdDb: -24, ratio: 1.5 } },
  loudness: { targetLufs: -14, ceilingDb: -1, truePeakOversample: 4 },
})`,
    python: `import libsonare

audio = libsonare.Audio.from_file("song.wav")
result = audio.mastering(target_lufs=-14.0, ceiling_db=-1.0)

print(f"{result.input_lufs:.1f} → {result.output_lufs:.1f} LUFS  "
      f"(gain {result.applied_gain_db:+.2f} dB)")`,
    cli: `sonare mastering song.wav -o mastered.wav --target-lufs -14
sonare mastering-processor song.wav \\
  --processor dynamics.compressor \\
  --params thresholdDb=-24,ratio=1.5`,
  },
}

const currentCode = computed(() => codeMatrix[discipline.value][runtime.value])

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function highlight(code: string, rt: Runtime): string {
  const lines = escapeHtml(code).split('\n')
  if (rt === 'cli') {
    return lines.map((line) => {
      if (!line.trim()) return ''
      if (line.startsWith('#')) return `<span class="landing__code-comment">${line}</span>`
      return line.replace(/^(\S+)/, '<span class="landing__code-function">$1</span>')
                 .replace(/(--[a-z-]+)/g, '<span class="landing__code-keyword">$1</span>')
    }).join('\n')
  }
  if (rt === 'python') {
    return lines.map((line) =>
      line
        .replace(/(&quot;[^&]*&quot;|"[^"]*"|'[^']*')/g, '<span class="landing__code-string">$1</span>')
        .replace(/\b(import|as|from|with|print|def|return|f)\b/g, '<span class="landing__code-keyword">$1</span>')
        .replace(/\b(libsonare|audio|result)\b/g, '<span class="landing__code-variable">$1</span>')
        .replace(/(#.*$)/g, '<span class="landing__code-comment">$1</span>')
    ).join('\n')
  }
  return lines.map((line) =>
    line
      .replace(/(&quot;[^&]*&quot;|"[^"]*"|'[^']*'|`[^`]*`)/g, '<span class="landing__code-string">$1</span>')
      .replace(/\b(import|from|await|const|let|var|function|return)\b/g, '<span class="landing__code-keyword">$1</span>')
      .replace(/\b(init|detectBpm|detectKey|analyze|masteringChainStereo|masteringChain|masteringProcess)\b/g, '<span class="landing__code-function">$1</span>')
      .replace(/\b(samples|sampleRate|bpm|key|result|left|right|left|right)\b/g, '<span class="landing__code-variable">$1</span>')
      .replace(/(\/\/.*$)/g, '<span class="landing__code-comment">$1</span>')
  ).join('\n')
}

const highlightedCode = computed(() => highlight(currentCode.value, runtime.value))

// Mini spectrum bars for the analyzer card — pseudo-spectrum based on a deterministic seed
const spectrumBars = Array.from({ length: 22 }, (_, i) => {
  const angle = (i / 22) * Math.PI
  const env = Math.sin(angle) ** 1.4
  const wob = 0.55 + 0.45 * Math.sin(i * 1.7)
  return 22 + env * 60 * wob
})

// Mini LUFS arc (mastering card)
const lufsTicks = Array.from({ length: 24 }, (_, i) => {
  const t = i / 23
  const angle = -Math.PI * 0.85 + t * Math.PI * 1.7
  const r = 36
  const r2 = i < 18 ? 30 : 24
  return {
    x1: 50 + Math.cos(angle) * r,
    y1: 50 + Math.sin(angle) * r,
    x2: 50 + Math.cos(angle) * r2,
    y2: 50 + Math.sin(angle) * r2,
    on: i < 18,
  }
})

// Coordinate disguised as build node ID (matches DemoLayout)
const nodeId = computed(() => {
  const now = new Date()
  const [lat, lng] = (now.getMonth() === 6 && now.getDate() === 10)
    ? ['35.5568', '139.4386']
    : ['31.9505', '115.8605']
  return `${lat}-${lng}`
})
</script>

<template>
  <div class="landing" :class="`landing--${lang}`">
    <!-- Backdrop -->
    <div class="landing__backdrop">
      <GridOverlay scanlines />
      <CornerBrackets size="lg" offset="lg" />
      <div class="landing__noise"></div>
    </div>

    <!-- Header -->
    <header class="landing__header">
      <div class="landing__header-left">
        <a :href="localePath('/')" class="landing__brand">LIBSONARE</a>
        <span class="landing__tagline">{{ currentLocale.tagline }}</span>
      </div>
      <div class="landing__header-right">
        <span class="landing__version">v{{ libVersion || '-.-.--' }}</span>
        <a :href="localePath('/docs/introduction')" class="landing__nav-link">
          {{ currentLocale.docsLabel }}
        </a>
        <a
          v-for="locale in otherLocales"
          :key="locale.key"
          :href="locale.path ? `${locale.path}/` : '/'"
          class="landing__lang-switch"
          :aria-label="`Switch to ${locale.label}`"
          @click.capture.stop.prevent="switchLocale($event, locale.path)"
        >
          {{ locale.shortLabel }}
        </a>
        <button
          class="landing__theme-toggle"
          :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
          @click="toggleTheme"
        >
          <svg class="landing__icon-sun" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
          <svg class="landing__icon-moon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        </button>
        <a
          href="https://github.com/libraz/libsonare"
          target="_blank"
          rel="noopener"
          class="landing__github-cta"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
          <span>{{ currentLocale.githubCta }}</span>
        </a>
      </div>
    </header>

    <!-- Hero -->
    <section class="landing__hero">
      <div class="landing__hero-left">
        <p class="landing__eyebrow">{{ currentLocale.hero.eyebrow }}</p>
        <h1 class="landing__title">{{ currentLocale.hero.title }}</h1>
        <p class="landing__subtitle">{{ currentLocale.hero.subtitle }}</p>
      </div>

      <div class="landing__hero-right">
        <div class="landing__install" role="group" :aria-label="currentLocale.hero.installCaption">
          <div class="landing__install-row">
            <span class="landing__install-prompt">$</span>
            <code class="landing__install-code">{{ currentLocale.hero.installNpm }}</code>
            <a
              :href="packageLinks.npm"
              target="_blank"
              rel="noopener"
              class="landing__install-tag landing__install-tag--link"
              aria-label="View @libraz/libsonare on npm"
            >
              <svg class="landing__install-tag-brand" width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M1.763 0C.786 0 0 .786 0 1.763v20.474C0 23.214.786 24 1.763 24h20.474c.977 0 1.763-.786 1.763-1.763V1.763C24 .786 23.214 0 22.237 0zM5.13 5.323l13.837.019-.009 13.836h-3.464l.01-10.382h-3.456L12.04 19.17H5.113z" />
              </svg>
              <span>NPM</span>
              <svg class="landing__install-tag-arrow" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M7 17L17 7" />
                <path d="M8 7h9v9" />
              </svg>
            </a>
          </div>
          <div class="landing__install-row">
            <span class="landing__install-prompt">$</span>
            <code class="landing__install-code">{{ currentLocale.hero.installPip }}</code>
            <a
              :href="packageLinks.pypi"
              target="_blank"
              rel="noopener"
              class="landing__install-tag landing__install-tag--link"
              aria-label="View libsonare on PyPI"
            >
              <svg class="landing__install-tag-brand" width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12.001.002C6.106.002 6.473 2.56 6.473 2.56l.007 2.652h5.628v.794H4.253S.46 5.58.46 11.526c0 5.945 3.312 5.735 3.312 5.735h1.967v-2.764s-.106-3.312 3.258-3.312h5.583s3.153.051 3.153-3.047V3.098S18.211.002 12 .002zM8.898 1.781a1.013 1.013 0 011.014 1.014 1.013 1.013 0 01-1.014 1.013 1.013 1.013 0 01-1.013-1.013 1.013 1.013 0 011.013-1.014z" />
                <path d="M12.16 23.998c5.895 0 5.528-2.558 5.528-2.558l-.007-2.652H12.054v-.794h7.851s3.792.43 3.792-5.515c0-5.945-3.312-5.735-3.312-5.735h-1.967v2.764s.106 3.312-3.258 3.312H9.578s-3.153-.051-3.153 3.047v5.04S5.95 24 12.16 24zm3.103-1.779a1.013 1.013 0 01-1.014-1.014 1.013 1.013 0 011.014-1.013 1.013 1.013 0 011.013 1.013 1.013 1.013 0 01-1.013 1.014z" />
              </svg>
              <span>PYPI</span>
              <svg class="landing__install-tag-arrow" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M7 17L17 7" />
                <path d="M8 7h9v9" />
              </svg>
            </a>
          </div>
        </div>

        <div class="landing__hero-actions">
          <a
            href="https://github.com/libraz/libsonare"
            target="_blank"
            rel="noopener"
            class="landing__action landing__action--primary"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.57.1.78-.25.78-.55 0-.27-.01-.99-.02-1.94-3.2.69-3.87-1.54-3.87-1.54-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.18 1.18a11.06 11.06 0 0 1 5.79 0c2.21-1.49 3.18-1.18 3.18-1.18.63 1.59.23 2.77.11 3.06.74.8 1.19 1.83 1.19 3.09 0 4.42-2.69 5.4-5.25 5.68.41.36.78 1.06.78 2.14 0 1.55-.01 2.8-.01 3.18 0 .31.21.66.79.55C20.21 21.38 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
            </svg>
            {{ currentLocale.hero.starCta }}
          </a>
          <a :href="localePath('/docs/introduction')" class="landing__action landing__action--ghost">
            {{ currentLocale.hero.docsCta }}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      </div>
    </section>

    <!-- OSS Receipt strip -->
    <section class="landing__receipt" aria-label="License and build metadata">
      <div class="landing__receipt-inner">
        <div class="landing__receipt-row">
          <template v-for="(item, idx) in currentLocale.receipt" :key="item.key">
            <span class="landing__receipt-field">
              <span class="landing__receipt-key">{{ item.key }}</span>
              <span class="landing__receipt-value">{{ item.value }}</span>
            </span>
            <span
              v-if="idx < currentLocale.receipt.length - 1"
              class="landing__receipt-sep"
              aria-hidden="true"
            >·</span>
          </template>
        </div>
        <div
          v-if="wasmReceiptFields.length"
          class="landing__receipt-row landing__receipt-row--build"
        >
          <template v-for="(item, idx) in wasmReceiptFields" :key="item.key">
            <span class="landing__receipt-field">
              <span class="landing__receipt-key">{{ item.key }}</span>
              <span class="landing__receipt-value">{{ item.value }}</span>
            </span>
            <span
              v-if="idx < wasmReceiptFields.length - 1"
              class="landing__receipt-sep"
              aria-hidden="true"
            >·</span>
          </template>
        </div>
      </div>
    </section>

    <!-- Demo cards -->
    <section class="landing__demos" :aria-label="currentLocale.demoSection.heading">
      <header class="landing__section-header">
        <p class="landing__section-eyebrow">{{ currentLocale.demoSection.eyebrow }}</p>
        <h2 class="landing__section-title">{{ currentLocale.demoSection.heading }}</h2>
        <p class="landing__section-subhead">{{ currentLocale.demoSection.subhead }}</p>
      </header>

      <div class="landing__demo-grid">
        <a
          :href="localePath(currentLocale.analyzer.path)"
          class="landing__demo-card landing__demo-card--analyzer"
        >
          <div class="landing__demo-card-head">
            <span class="landing__demo-status">
              <span class="landing__demo-status-dot"></span>
              {{ currentLocale.analyzer.status }}
            </span>
            <span class="landing__demo-eyebrow">{{ currentLocale.analyzer.eyebrow }}</span>
          </div>

          <div class="landing__demo-visual landing__demo-visual--spectrum" aria-hidden="true">
            <svg viewBox="0 0 220 60" preserveAspectRatio="none">
              <g>
                <rect
                  v-for="(bar, i) in spectrumBars"
                  :key="i"
                  :x="i * (220 / spectrumBars.length) + 1"
                  :y="60 - bar * 0.55"
                  :width="(220 / spectrumBars.length) - 3"
                  :height="bar * 0.55"
                  rx="1"
                />
              </g>
            </svg>
          </div>

          <h3 class="landing__demo-title">{{ currentLocale.analyzer.title }}</h3>
          <p class="landing__demo-tagline">{{ currentLocale.analyzer.tagline }}</p>

          <ul class="landing__demo-chips">
            <li v-for="chip in currentLocale.analyzer.chips" :key="chip">{{ chip }}</li>
          </ul>

          <span class="landing__demo-cta">
            {{ currentLocale.analyzer.cta }}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </span>
        </a>

        <a
          :href="localePath(currentLocale.mastering.path)"
          class="landing__demo-card landing__demo-card--mastering"
        >
          <div class="landing__demo-card-head">
            <span class="landing__demo-status landing__demo-status--accent">
              <span class="landing__demo-status-dot"></span>
              {{ currentLocale.mastering.status }}
            </span>
            <span class="landing__demo-eyebrow">{{ currentLocale.mastering.eyebrow }}</span>
          </div>

          <div class="landing__demo-visual landing__demo-visual--lufs" aria-hidden="true">
            <svg viewBox="0 0 100 60" preserveAspectRatio="xMidYMid meet">
              <g>
                <line
                  v-for="(tick, i) in lufsTicks"
                  :key="i"
                  :x1="tick.x1"
                  :y1="tick.y1"
                  :x2="tick.x2"
                  :y2="tick.y2"
                  :class="tick.on ? 'landing__lufs-tick--on' : 'landing__lufs-tick--off'"
                />
                <text x="50" y="56" text-anchor="middle" class="landing__lufs-label">-14.0 LUFS</text>
              </g>
            </svg>
          </div>

          <h3 class="landing__demo-title">{{ currentLocale.mastering.title }}</h3>
          <p class="landing__demo-tagline">{{ currentLocale.mastering.tagline }}</p>

          <ul class="landing__demo-chips">
            <li v-for="chip in currentLocale.mastering.chips" :key="chip">{{ chip }}</li>
          </ul>

          <span class="landing__demo-cta">
            {{ currentLocale.mastering.cta }}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </span>
        </a>
      </div>
    </section>

    <!-- Quick Start matrix -->
    <section class="landing__quick" :aria-label="currentLocale.quickStart.title">
      <header class="landing__section-header">
        <p class="landing__section-eyebrow">{{ currentLocale.quickStart.title }}</p>
        <h2 class="landing__section-title">{{ currentLocale.quickStart.subtitle }}</h2>
      </header>

      <div class="landing__quick-panel">
        <div class="landing__quick-tabs landing__quick-tabs--primary" role="tablist" aria-label="Discipline">
          <button
            v-for="(label, key) in currentLocale.quickStart.disciplines"
            :key="key"
            type="button"
            role="tab"
            :aria-selected="discipline === key"
            class="landing__quick-tab landing__quick-tab--primary"
            :class="{ 'landing__quick-tab--active': discipline === key }"
            @click="discipline = key as Discipline"
          >
            {{ label }}
          </button>
        </div>

        <div class="landing__quick-tabs landing__quick-tabs--secondary" role="tablist" aria-label="Runtime">
          <button
            v-for="(label, key) in currentLocale.quickStart.runtimes"
            :key="key"
            type="button"
            role="tab"
            :aria-selected="runtime === key"
            class="landing__quick-tab"
            :class="{ 'landing__quick-tab--active': runtime === key }"
            @click="runtime = key as Runtime"
          >
            {{ label }}
          </button>
        </div>

        <pre class="landing__code"><code v-html="highlightedCode"></code></pre>

        <div class="landing__quick-footer">
          <p class="landing__quick-note">{{ currentLocale.quickStart.note }}</p>
          <a :href="localePath('/docs/introduction')" class="landing__quick-link">
            {{ currentLocale.quickStart.docsLink }} →
          </a>
        </div>
      </div>
    </section>

    <!-- Pillars -->
    <section class="landing__pillars" :aria-label="currentLocale.pillars.heading">
      <header class="landing__section-header">
        <p class="landing__section-eyebrow">{{ currentLocale.pillars.eyebrow }}</p>
        <h2 class="landing__section-title">{{ currentLocale.pillars.heading }}</h2>
      </header>

      <div class="landing__pillar-grid">
        <article
          v-for="(pillar, i) in currentLocale.pillars.items"
          :key="pillar.tag"
          class="landing__pillar"
        >
          <span class="landing__pillar-tag">
            <span class="landing__pillar-tag-index">0{{ i + 1 }}</span>
            {{ pillar.tag }}
          </span>
          <h3 class="landing__pillar-title">{{ pillar.title }}</h3>
          <p class="landing__pillar-body">{{ pillar.body }}</p>
          <a
            v-if="pillar.link"
            :href="pillar.link.external ? pillar.link.path : localePath(pillar.link.path)"
            :target="pillar.link.external ? '_blank' : undefined"
            :rel="pillar.link.external ? 'noopener' : undefined"
            class="landing__pillar-link"
          >
            {{ pillar.link.label }} →
          </a>
        </article>
      </div>
    </section>

    <!-- Final CTA -->
    <section class="landing__final">
      <div class="landing__final-inner">
        <div class="landing__final-copy">
          <h2 class="landing__final-heading">{{ currentLocale.finalCta.heading }}</h2>
          <p class="landing__final-subhead">{{ currentLocale.finalCta.subhead }}</p>
        </div>
        <div class="landing__final-actions">
          <a href="https://github.com/libraz/libsonare" target="_blank" rel="noopener" class="landing__action landing__action--primary">
            {{ currentLocale.finalCta.github }} →
          </a>
          <a :href="localePath('/docs/introduction')" class="landing__action landing__action--ghost">
            {{ currentLocale.finalCta.docs }} →
          </a>
          <a href="https://github.com/libraz/libsonare/blob/main/LICENSE" target="_blank" rel="noopener" class="landing__action landing__action--ghost">
            {{ currentLocale.finalCta.license }} →
          </a>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="landing__footer">
      <div class="landing__footer-links">
        <a href="https://github.com/libraz/libsonare" target="_blank" rel="noopener" class="landing__footer-link">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
          <span>SOURCE</span>
        </a>
        <span class="landing__footer-sep">|</span>
        <a href="https://opensource.org/licenses/Apache-2.0" target="_blank" rel="noopener" class="landing__footer-link">
          <span>APACHE-2.0</span>
        </a>
        <span class="landing__footer-sep">|</span>
        <a :href="localePath('/docs/introduction')" class="landing__footer-link">
          <span>{{ currentLocale.docsLabel.toUpperCase() }}</span>
        </a>
        <template v-for="locale in otherLocales" :key="locale.key">
          <span class="landing__footer-sep">|</span>
          <a
            :href="locale.path ? `${locale.path}/` : '/'"
            class="landing__footer-link"
            @click.capture.stop.prevent="switchLocale($event, locale.path)"
          >
            <span>{{ locale.shortLabel }}</span>
          </a>
        </template>
      </div>
      <div class="landing__footer-center">
        <span class="landing__footer-attr">
          a personal project by <a href="https://libraz.net" target="_blank" rel="noopener" class="landing__footer-author">libraz</a>
        </span>
        <span class="landing__footer-dot">·</span>
        <span class="landing__footer-attr">
          {{ currentLocale.demoCredit }}
          <a href="https://midisketch.libraz.net/" target="_blank" rel="noopener" class="landing__footer-credit">{{ currentLocale.midiSketch }}</a>{{ isJa ? 'で作成' : '' }}
        </span>
      </div>
      <div class="landing__footer-meta">
        <span class="landing__node-id">{{ nodeId }}</span>
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* ===== THEME TOKENS (Dark - default) ===== */
.landing {
  --demo-bg: #030405;
  --demo-bg-overlay: rgba(10, 12, 18, 0.95);
  --demo-bg-elevated: rgba(8, 10, 14, 0.85);
  --demo-bg-header: rgba(20, 22, 28, 0.8);
  --demo-text-strong: #ffffff;
  --demo-text: rgba(255, 255, 255, 0.72);
  --demo-text-muted: rgba(255, 255, 255, 0.42);
  --demo-text-faint: rgba(255, 255, 255, 0.22);
  --demo-accent: #8B5CF6;
  --demo-accent-light: #A78BFA;
  --demo-accent-dim: rgba(139, 92, 246, 0.3);
  --demo-accent-subtle: rgba(139, 92, 246, 0.08);
  --demo-accent-border: rgba(139, 92, 246, 0.22);
  --demo-cyan: #22D3EE;
  --demo-cyan-subtle: rgba(34, 211, 238, 0.10);
  --demo-cyan-border: rgba(34, 211, 238, 0.25);
  --demo-success: rgba(100, 200, 180, 0.9);
  --demo-border: rgba(139, 92, 246, 0.12);
  --demo-border-strong: rgba(139, 92, 246, 0.25);
  --demo-shadow: rgba(0, 0, 0, 0.4);
  --demo-shadow-glow: 0 0 40px -10px rgba(139, 92, 246, 0.2);
  --demo-code-bg: rgba(0, 0, 0, 0.42);
  --demo-grid-color: rgba(139, 92, 246, 0.04);
  --demo-grid-minor: rgba(139, 92, 246, 0.02);
  --demo-scanline: rgba(0, 0, 0, 0.03);

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
html:not(.dark) .landing {
  --demo-bg: #f8f6ff;
  --demo-bg-overlay: rgba(248, 246, 255, 0.95);
  --demo-bg-elevated: rgba(255, 255, 255, 0.7);
  --demo-bg-header: rgba(250, 248, 255, 0.85);
  --demo-text-strong: #1a1a2e;
  --demo-text: rgba(0, 0, 0, 0.62);
  --demo-text-muted: rgba(0, 0, 0, 0.4);
  --demo-text-faint: rgba(0, 0, 0, 0.22);
  --demo-accent: #6D28D9;
  --demo-accent-light: #7C3AED;
  --demo-accent-dim: rgba(109, 40, 217, 0.25);
  --demo-accent-subtle: rgba(109, 40, 217, 0.06);
  --demo-accent-border: rgba(109, 40, 217, 0.22);
  --demo-cyan: #0E7490;
  --demo-cyan-subtle: rgba(14, 116, 144, 0.08);
  --demo-cyan-border: rgba(14, 116, 144, 0.22);
  --demo-success: rgba(16, 185, 129, 0.9);
  --demo-border: rgba(0, 0, 0, 0.07);
  --demo-border-strong: rgba(0, 0, 0, 0.13);
  --demo-shadow: rgba(0, 0, 0, 0.08);
  --demo-shadow-glow: 0 4px 24px -6px rgba(109, 40, 217, 0.10);
  --demo-code-bg: rgba(255, 255, 255, 0.78);
  --demo-grid-color: transparent;
  --demo-grid-minor: transparent;
  --demo-scanline: transparent;
}

/* ===== BACKDROP ===== */
.landing__backdrop {
  position: fixed;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 0;
}

.landing__noise {
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  opacity: 0.025;
  mix-blend-mode: overlay;
}

html:not(.dark) .landing .landing__backdrop {
  display: none;
}

/* ===== HEADER ===== */
.landing__header {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  background: linear-gradient(to bottom, var(--demo-bg-overlay), transparent);
  border-bottom: 1px solid var(--demo-border);
}

html:not(.dark) .landing .landing__header {
  background: var(--demo-bg-overlay);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.landing__header-left,
.landing__header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.landing__brand {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: var(--demo-text-strong);
  text-decoration: none;
}

.landing__tagline {
  font-size: 10px;
  letter-spacing: 0.05em;
  color: var(--demo-text-muted);
}

.landing__version {
  font-size: 10px;
  font-weight: 500;
  color: var(--demo-text-muted);
  font-variant-numeric: tabular-nums;
  padding: 4px 8px;
  background: var(--demo-accent-subtle);
  border-radius: 4px;
}

.landing__nav-link {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: var(--demo-text);
  text-decoration: none;
  padding: 6px 10px;
  border-radius: 6px;
  transition: color 0.2s ease, background-color 0.2s ease;
}

.landing__nav-link:hover {
  color: var(--demo-accent);
  background: var(--demo-accent-subtle);
}

.landing__lang-switch {
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

.landing__lang-switch:hover {
  color: var(--demo-accent);
  background: var(--demo-accent-dim);
  border-color: var(--demo-accent);
}

.landing__theme-toggle {
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

.landing__theme-toggle:hover {
  color: var(--demo-accent);
  background: var(--demo-accent-dim);
  border-color: var(--demo-accent);
}

.landing__icon-sun { display: none; }
.landing__icon-moon { display: block; }

.landing__github-cta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: #fff;
  text-decoration: none;
  padding: 7px 14px;
  background: var(--demo-accent);
  border-radius: 6px;
  transition: background-color 0.2s ease, transform 0.2s ease;
}

.landing__github-cta:hover {
  background: #9D6FFF;
  transform: translateY(-1px);
}

/* ===== HERO ===== */
.landing__hero {
  position: relative;
  z-index: 2;
  width: min(1180px, calc(100% - 48px));
  margin: 40px auto 0;
  padding: 0;
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
  gap: 56px;
  align-items: center;
}

.landing__hero-left {
  min-width: 0;
}

.landing__hero-right {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.landing__eyebrow {
  margin: 0 0 12px;
  color: var(--demo-cyan);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.landing__title {
  margin: 0 0 14px;
  color: var(--demo-text-strong);
  font-family: 'Space Grotesk', sans-serif;
  font-size: clamp(28px, 3.8vw, 46px);
  font-weight: 600;
  line-height: 1.12;
  letter-spacing: -0.01em;
  max-width: 18ch;
}

.landing--ja .landing__title {
  font-size: clamp(22px, 3.2vw, 36px);
  line-height: 1.28;
  letter-spacing: 0;
  max-width: 22ch;
}

.landing__subtitle {
  margin: 0;
  color: var(--demo-text);
  font-size: 14px;
  line-height: 1.6;
  max-width: 50ch;
}

.landing__install {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
}

.landing__install-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border: 1px solid var(--demo-border-strong);
  border-radius: 4px;
  background: var(--demo-code-bg);
}

.landing__install-row::before,
.landing__install-row::after {
  content: '';
  position: absolute;
  width: 10px;
  height: 10px;
  border-color: var(--demo-accent-border);
  border-style: solid;
  border-width: 0;
  pointer-events: none;
}

.landing__install-row::before {
  top: -1px;
  left: -1px;
  border-top-width: 1px;
  border-left-width: 1px;
}

.landing__install-row::after {
  bottom: -1px;
  right: -1px;
  border-bottom-width: 1px;
  border-right-width: 1px;
}

.landing__install-prompt {
  color: var(--demo-accent-light);
  font-size: 12px;
  font-weight: 700;
  user-select: none;
}

.landing__install-code {
  flex: 1;
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  color: var(--demo-text-strong);
  white-space: nowrap;
  overflow-x: auto;
  scrollbar-width: none;
  background: transparent;
  padding: 0;
}

.landing__install-code::-webkit-scrollbar { display: none; }

.landing__install-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-width: 72px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--demo-text-muted);
  padding: 4px 8px;
  border: 1px solid var(--demo-border);
  border-radius: 3px;
  flex-shrink: 0;
  text-decoration: none;
}

.landing__install-tag-brand {
  flex-shrink: 0;
  opacity: 0.85;
  transition: opacity 0.18s ease;
}

.landing__install-tag-arrow {
  flex-shrink: 0;
  opacity: 0;
  transform: translate(-2px, 2px);
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.landing__install-tag--link {
  cursor: pointer;
  transition: color 0.18s ease, border-color 0.18s ease, background-color 0.18s ease;
}

.landing__install-tag--link:hover,
.landing__install-tag--link:focus-visible {
  color: var(--demo-accent);
  border-color: var(--demo-accent-border);
  background: var(--demo-accent-subtle);
  outline: none;
}

.landing__install-tag--link:hover .landing__install-tag-brand,
.landing__install-tag--link:focus-visible .landing__install-tag-brand {
  opacity: 1;
}

.landing__install-tag--link:hover .landing__install-tag-arrow,
.landing__install-tag--link:focus-visible .landing__install-tag-arrow {
  opacity: 1;
  transform: translate(0, 0);
}

.landing__hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 2px;
}

.landing__action {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-decoration: none;
  padding: 10px 16px;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.landing__action--primary {
  background: var(--demo-accent);
  color: #fff;
  border: 1px solid var(--demo-accent);
}

.landing__action--primary:hover {
  background: #9D6FFF;
  transform: translateY(-1px);
}

.landing__action--ghost {
  color: var(--demo-text);
  border: 1px solid var(--demo-border-strong);
  background: transparent;
}

.landing__action--ghost:hover {
  color: var(--demo-accent);
  border-color: var(--demo-accent);
  background: var(--demo-accent-subtle);
}

/* ===== RECEIPT STRIP ===== */
.landing__receipt {
  position: relative;
  z-index: 2;
  width: min(1180px, calc(100% - 48px));
  margin: 28px auto 0;
  padding: 10px 14px;
  border: 1px solid var(--demo-border);
  border-radius: 6px;
  background: var(--demo-bg-elevated);
}

.landing__receipt-inner {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.landing__receipt-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
}

.landing__receipt-row--build {
  padding-top: 7px;
  border-top: 1px dashed var(--demo-border);
}

.landing__receipt-row--build .landing__receipt-value {
  color: var(--demo-accent-light);
}

html:not(.dark) .landing .landing__receipt-row--build .landing__receipt-value {
  color: var(--demo-accent);
}

.landing__receipt-field {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
}

.landing__receipt-row > .landing__receipt-field:first-child .landing__receipt-key {
  display: inline-block;
  min-width: 54px;
}

.landing__receipt-key {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--demo-text-muted);
}

.landing__receipt-value {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--demo-text-strong);
}

.landing__receipt-sep {
  color: var(--demo-text-faint);
  font-size: 11px;
  user-select: none;
}

/* ===== SECTIONS COMMON ===== */
.landing__demos,
.landing__quick,
.landing__pillars,
.landing__final {
  position: relative;
  z-index: 2;
  width: min(1180px, calc(100% - 48px));
  margin: 56px auto 0;
}

.landing__section-header {
  margin-bottom: 20px;
  max-width: 720px;
}

.landing__section-eyebrow {
  margin: 0 0 10px;
  color: var(--demo-accent-light);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.landing__section-title {
  margin: 0 0 8px;
  color: var(--demo-text-strong);
  font-family: 'Space Grotesk', sans-serif;
  font-size: clamp(22px, 3vw, 34px);
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.005em;
}

.landing__section-subhead {
  margin: 0;
  color: var(--demo-text-muted);
  font-size: 13px;
  line-height: 1.6;
}

/* ===== DEMO CARDS ===== */
.landing__demo-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.landing__demo-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 22px 22px 20px;
  background:
    radial-gradient(ellipse at top right, var(--demo-accent-subtle), transparent 60%),
    var(--demo-bg-elevated);
  border: 1px solid var(--demo-border-strong);
  border-radius: 4px;
  text-decoration: none;
  color: inherit;
  transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
}

.landing__demo-card::before,
.landing__demo-card::after {
  content: '';
  position: absolute;
  width: 14px;
  height: 14px;
  border-color: var(--demo-accent-border);
  border-style: solid;
  border-width: 0;
  pointer-events: none;
  transition: border-color 0.25s ease;
}

.landing__demo-card::before {
  top: -1px;
  left: -1px;
  border-top-width: 1px;
  border-left-width: 1px;
}

.landing__demo-card::after {
  bottom: -1px;
  right: -1px;
  border-bottom-width: 1px;
  border-right-width: 1px;
}

.landing__demo-card:hover {
  transform: translateY(-2px);
  border-color: var(--demo-accent);
  box-shadow: 0 16px 40px -16px rgba(139, 92, 246, 0.35);
}

.landing__demo-card:hover::before,
.landing__demo-card:hover::after {
  border-color: var(--demo-accent);
}

html:not(.dark) .landing .landing__demo-card:hover {
  box-shadow: 0 14px 36px -16px rgba(109, 40, 217, 0.18);
}

.landing__demo-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.landing__demo-status {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.16em;
  color: var(--demo-accent-light);
  text-transform: uppercase;
  padding: 4px 10px;
  border: 1px solid var(--demo-accent-border);
  background: var(--demo-accent-subtle);
  border-radius: 4px;
}

html:not(.dark) .landing .landing__demo-status {
  color: var(--demo-accent);
}

.landing__demo-status--accent {
  color: var(--demo-accent-light);
  border-color: var(--demo-accent-border);
  background: var(--demo-accent-subtle);
}

html:not(.dark) .landing .landing__demo-status--accent {
  color: var(--demo-accent);
}

.landing__demo-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 8px currentColor;
  animation: landing-pulse 2s ease-in-out infinite;
}

@keyframes landing-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.landing__demo-eyebrow {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.14em;
  color: var(--demo-text-muted);
  text-transform: uppercase;
}

.landing__demo-visual {
  height: 52px;
  border: 1px solid var(--demo-border);
  border-radius: 6px;
  background:
    linear-gradient(rgba(139, 92, 246, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(139, 92, 246, 0.05) 1px, transparent 1px),
    var(--demo-code-bg);
  background-size: 16px 16px;
  overflow: hidden;
  padding: 6px 12px;
}

.landing__demo-visual svg {
  width: 100%;
  height: 100%;
}

.landing__demo-visual--spectrum svg rect {
  fill: var(--demo-accent-light);
  opacity: 0.78;
}

.landing__demo-visual--lufs .landing__lufs-tick--on {
  stroke: var(--demo-accent-light);
  stroke-width: 1.4;
  stroke-linecap: round;
}

.landing__demo-visual--lufs .landing__lufs-tick--off {
  stroke: var(--demo-text-faint);
  stroke-width: 1.2;
  stroke-linecap: round;
}

.landing__demo-visual--lufs .landing__lufs-label {
  fill: var(--demo-text-strong);
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.landing__demo-title {
  margin: 2px 0 0;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: 0;
  color: var(--demo-text-strong);
}

.landing__demo-tagline {
  margin: 0;
  color: var(--demo-text);
  font-size: 12.5px;
  line-height: 1.6;
}

.landing__demo-chips {
  list-style: none;
  margin: 4px 0 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.landing__demo-chips li {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--demo-text-muted);
  padding: 4px 8px;
  border: 1px solid var(--demo-border);
  border-radius: 3px;
}

.landing__demo-card--analyzer .landing__demo-chips li,
.landing__demo-card--mastering .landing__demo-chips li {
  color: var(--demo-accent-light);
  border-color: var(--demo-accent-border);
  background: var(--demo-accent-subtle);
}

html:not(.dark) .landing .landing__demo-card--analyzer .landing__demo-chips li,
html:not(.dark) .landing .landing__demo-card--mastering .landing__demo-chips li {
  color: var(--demo-accent);
}

.landing__demo-cta {
  margin-top: 4px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  align-self: flex-start;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--demo-text-strong);
}

.landing__demo-cta svg {
  transition: transform 0.2s ease;
}

.landing__demo-card:hover .landing__demo-cta svg {
  transform: translateX(4px);
}

.landing__demo-card--analyzer .landing__demo-cta,
.landing__demo-card--mastering .landing__demo-cta {
  color: var(--demo-accent-light);
}

html:not(.dark) .landing .landing__demo-card--analyzer .landing__demo-cta,
html:not(.dark) .landing .landing__demo-card--mastering .landing__demo-cta {
  color: var(--demo-accent);
}

/* ===== QUICK START ===== */
.landing__quick-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  background: var(--demo-bg-elevated);
  border: 1px solid var(--demo-border-strong);
  border-radius: 10px;
  box-shadow: var(--demo-shadow-glow);
}

.landing__quick-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.landing__quick-tabs--primary {
  padding: 3px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid var(--demo-border);
  border-radius: 8px;
  align-self: flex-start;
}

html:not(.dark) .landing .landing__quick-tabs--primary {
  background: rgba(255, 255, 255, 0.55);
}

.landing__quick-tabs--secondary {
  padding: 3px;
  background: rgba(0, 0, 0, 0.14);
  border: 1px solid var(--demo-border);
  border-radius: 6px;
  align-self: flex-start;
}

html:not(.dark) .landing .landing__quick-tabs--secondary {
  background: rgba(255, 255, 255, 0.45);
}

.landing__quick-tab {
  width: 120px;
  height: 30px;
  padding: 0 14px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--demo-text-muted);
  cursor: pointer;
  font: inherit;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.05em;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.landing__quick-tab--primary {
  font-size: 11.5px;
}

.landing__quick-tab:hover {
  color: var(--demo-text-strong);
}

.landing__quick-tab--active {
  background: var(--demo-accent);
  color: #fff;
}

.landing__quick-tab--primary.landing__quick-tab--active {
  background: var(--demo-accent);
}

.landing__code {
  margin: 0;
  padding: 14px 18px;
  overflow-x: auto;
  background: var(--demo-code-bg);
  border: 1px solid var(--demo-border);
  border-radius: 8px;
  color: var(--demo-text-strong);
  font-family: 'JetBrains Mono', monospace;
  font-size: 12.5px;
  line-height: 1.65;
  tab-size: 2;
  min-height: 180px;
}

.landing__code :deep(.landing__code-keyword) { color: #c4b5fd; }
.landing__code :deep(.landing__code-function) { color: #67e8f9; }
.landing__code :deep(.landing__code-string) { color: #fcd34d; }
.landing__code :deep(.landing__code-variable) { color: #f9a8d4; }
.landing__code :deep(.landing__code-comment) { color: rgba(255,255,255,0.35); font-style: italic; }

html:not(.dark) .landing .landing__code :deep(.landing__code-keyword) { color: #6d28d9; }
html:not(.dark) .landing .landing__code :deep(.landing__code-function) { color: #0891b2; }
html:not(.dark) .landing .landing__code :deep(.landing__code-string) { color: #9a3412; }
html:not(.dark) .landing .landing__code :deep(.landing__code-variable) { color: #be185d; }
html:not(.dark) .landing .landing__code :deep(.landing__code-comment) { color: rgba(0,0,0,0.35); font-style: italic; }

.landing__quick-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.landing__quick-note {
  margin: 0;
  color: var(--demo-text-muted);
  font-size: 10.5px;
  line-height: 1.55;
}

.landing__quick-link {
  color: var(--demo-accent-light);
  text-decoration: none;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.landing__quick-link:hover {
  color: var(--demo-accent);
}

/* ===== PILLARS ===== */
.landing__pillar-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}

.landing__pillar {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 18px;
  background: var(--demo-bg-elevated);
  border: 1px solid var(--demo-border);
  border-radius: 8px;
  transition: border-color 0.25s ease;
}

.landing__pillar::before,
.landing__pillar::after {
  content: '';
  position: absolute;
  width: 12px;
  height: 12px;
  border-color: var(--demo-accent-border);
  border-style: solid;
  border-width: 0;
}

.landing__pillar::before {
  top: -1px; left: -1px;
  border-top-width: 1px;
  border-left-width: 1px;
}

.landing__pillar::after {
  bottom: -1px; right: -1px;
  border-bottom-width: 1px;
  border-right-width: 1px;
}

.landing__pillar:hover {
  border-color: var(--demo-accent-border);
}

.landing__pillar-tag {
  display: inline-flex;
  align-items: baseline;
  gap: 10px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.16em;
  color: var(--demo-accent-light);
}

.landing__pillar-tag-index {
  color: var(--demo-text-faint);
  font-size: 11px;
}

.landing__pillar-title {
  margin: 0;
  color: var(--demo-text-strong);
  font-family: 'Space Grotesk', sans-serif;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.32;
  letter-spacing: 0;
}

.landing__pillar-body {
  margin: 0;
  color: var(--demo-text);
  font-size: 12px;
  line-height: 1.65;
  flex: 1;
}

.landing__pillar-link {
  align-self: flex-start;
  color: var(--demo-accent-light);
  text-decoration: none;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.landing__pillar-link:hover {
  color: var(--demo-accent);
}

html:not(.dark) .landing .landing__pillar-tag,
html:not(.dark) .landing .landing__pillar-link {
  color: var(--demo-accent);
}

/* ===== FINAL CTA ===== */
.landing__final {
  position: relative;
  margin: 56px auto 40px;
}

.landing__final-inner {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) auto;
  gap: 24px;
  align-items: center;
  padding: 22px 26px;
  background:
    radial-gradient(circle at 100% 0%, var(--demo-accent-subtle), transparent 60%),
    var(--demo-bg-elevated);
  border: 1px solid var(--demo-border-strong);
  border-radius: 12px;
}

.landing__final-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.landing__final-heading {
  margin: 0;
  color: var(--demo-text-strong);
  font-family: 'Space Grotesk', sans-serif;
  font-size: clamp(18px, 2vw, 24px);
  font-weight: 600;
  line-height: 1.22;
}

.landing__final-subhead {
  margin: 0;
  color: var(--demo-text);
  font-size: 12.5px;
  line-height: 1.55;
}

.landing__final-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

/* ===== FOOTER ===== */
.landing__footer {
  position: relative;
  z-index: 10;
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 12px 24px;
  border-top: 1px solid var(--demo-border);
  background: linear-gradient(to top, var(--demo-bg-overlay), transparent);
}

html:not(.dark) .landing .landing__footer {
  background: var(--demo-bg-overlay);
}

.landing__footer-links,
.landing__footer-center,
.landing__footer-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.landing__footer-link {
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

.landing__footer-link:hover {
  color: var(--demo-accent);
}

.landing__footer-link svg { opacity: 0.6; }

.landing__footer-sep,
.landing__footer-dot {
  color: var(--demo-border);
  font-size: 10px;
  user-select: none;
}

.landing__footer-attr {
  font-size: 9px;
  color: var(--demo-text-muted);
  letter-spacing: 0.04em;
}

.landing__footer-author {
  color: var(--demo-text);
  text-decoration: none;
  font-weight: 600;
  letter-spacing: 0.08em;
}

.landing__footer-author:hover { color: var(--demo-accent); }

.landing__footer-credit {
  color: var(--demo-accent);
  text-decoration: none;
  font-weight: 600;
}

.landing__node-id {
  font-size: 9px;
  letter-spacing: 0.08em;
  color: var(--demo-text-muted);
  font-variant-numeric: tabular-nums;
  opacity: 0.5;
}

/* Hide VitePress chrome */
.landing :deep(.VPNav),
.landing :deep(.VPNavBar),
.landing :deep(.VPSidebar),
.landing :deep(.VPFooter),
.landing :deep(.VPLocalNav) {
  display: none !important;
}

/* ===== RESPONSIVE ===== */
@media (max-width: 960px) {
  .landing__hero {
    margin-top: 32px;
    grid-template-columns: 1fr;
    gap: 24px;
    align-items: start;
  }

  .landing__hero-right {
    max-width: 520px;
  }

  .landing__demos,
  .landing__quick,
  .landing__pillars,
  .landing__final {
    margin-top: 48px;
  }

  .landing__demo-grid {
    grid-template-columns: 1fr;
  }

  .landing__pillar-grid {
    grid-template-columns: 1fr;
  }

  .landing__final-inner {
    grid-template-columns: 1fr;
  }

  .landing__final-actions {
    justify-content: flex-start;
  }
}

@media (max-width: 720px) {
  .landing__header {
    padding: 10px 16px;
  }

  .landing__tagline,
  .landing__version {
    display: none;
  }

  .landing__hero,
  .landing__receipt,
  .landing__demos,
  .landing__quick,
  .landing__pillars,
  .landing__final {
    width: calc(100% - 28px);
  }

  .landing__demo-card {
    padding: 20px 18px 18px;
  }

  .landing__quick-tab {
    min-width: 90px;
    height: 28px;
    font-size: 10px;
  }

  .landing__quick-tab--primary {
    min-width: 100px;
  }

  .landing__code {
    font-size: 11.5px;
    padding: 14px 16px;
    min-height: 200px;
  }

  .landing__footer {
    flex-direction: column;
    gap: 8px;
    padding: 10px 16px;
  }

  .landing__footer-meta {
    display: none;
  }

  .landing__final-inner {
    padding: 24px 20px;
  }
}
</style>

<style>
/* Theme toggle icon swap (must be global to react to html.dark) */
html.dark .landing__icon-sun { display: block; }
html.dark .landing__icon-moon { display: none; }
</style>
