import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'
import { fileURLToPath, URL } from 'node:url'

const siteUrl = 'https://sonare.libraz.net'
const githubUrl = 'https://github.com/libraz/libsonare'

const glossarySidebar = [
  {
    text: 'Glossary',
    link: '/docs/glossary',
    collapsed: true,
    items: [
      {
        text: 'Foundations',
        collapsed: true,
        items: [
          { text: 'Audio Basics', link: '/docs/glossary/concepts/audio-basics' },
          { text: 'MIR Overview', link: '/docs/glossary/concepts/mir-overview' },
          { text: 'Browser Local Processing', link: '/docs/glossary/concepts/browser-local-processing' },
        ],
      },
      {
        text: 'Mastering Concepts',
        collapsed: true,
        items: [
          { text: 'Mastering', link: '/docs/glossary/mastering' },
          { text: 'What Is Mastering?', link: '/docs/glossary/concepts/what-is-mastering' },
          { text: 'LUFS', link: '/docs/glossary/lufs' },
          { text: 'True Peak', link: '/docs/glossary/true-peak' },
          { text: 'A/B Comparison', link: '/docs/glossary/ab-comparison' },
          { text: 'Loudness Matching', link: '/docs/glossary/concepts/loudness-matching' },
          { text: 'Reference Track', link: '/docs/glossary/concepts/reference-track' },
          { text: 'True Peak Safety', link: '/docs/glossary/concepts/true-peak-safety' },
          { text: 'Dynamic Range', link: '/docs/glossary/concepts/dynamic-range' },
          { text: 'Crest Factor', link: '/docs/glossary/concepts/crest-factor' },
          { text: 'Mono Compatibility', link: '/docs/glossary/concepts/mono-compatibility' },
          { text: 'Gain Staging', link: '/docs/glossary/concepts/gain-staging' },
          { text: 'Air Band', link: '/docs/glossary/air-band' },
        ],
      },
      {
        text: 'Mastering Guides',
        collapsed: true,
        items: [
          { text: 'Repair and Input', link: '/docs/glossary/mastering/repair' },
          { text: 'Dynamics', link: '/docs/glossary/mastering/dynamics' },
          { text: 'Tone and Air', link: '/docs/glossary/mastering/tone-air' },
          { text: 'Stereo and Loudness', link: '/docs/glossary/mastering/stereo-limiter-loudness' },
          { text: 'Reference Match', link: '/docs/glossary/mastering/reference-match' },
          { text: 'Delivery Targets', link: '/docs/glossary/mastering/delivery-targets' },
          { text: 'Meters', link: '/docs/glossary/mastering/meter-reading' },
          { text: 'Preset Selection', link: '/docs/glossary/mastering/preset-selection' },
          { text: 'Quality Checklist', link: '/docs/glossary/mastering/quality-checklist' },
          { text: 'Error Recovery', link: '/docs/glossary/mastering/error-recovery' },
        ],
      },
    ]
  }
]

const jaGlossarySidebar = [
  {
    text: '用語集',
    link: '/ja/docs/glossary',
    collapsed: true,
    items: [
      {
        text: '基礎',
        collapsed: true,
        items: [
          { text: 'オーディオ基礎', link: '/ja/docs/glossary/concepts/audio-basics' },
          { text: 'MIR の全体像', link: '/ja/docs/glossary/concepts/mir-overview' },
          { text: 'ブラウザ内ローカル処理', link: '/ja/docs/glossary/concepts/browser-local-processing' },
        ],
      },
      {
        text: 'マスタリング概念',
        collapsed: true,
        items: [
          { text: 'マスタリング', link: '/ja/docs/glossary/mastering' },
          { text: 'マスタリングとは?', link: '/ja/docs/glossary/concepts/what-is-mastering' },
          { text: 'LUFS', link: '/ja/docs/glossary/lufs' },
          { text: 'True Peak', link: '/ja/docs/glossary/true-peak' },
          { text: 'A/B 比較', link: '/ja/docs/glossary/ab-comparison' },
          { text: 'ラウドネスマッチング', link: '/ja/docs/glossary/concepts/loudness-matching' },
          { text: 'リファレンストラック', link: '/ja/docs/glossary/concepts/reference-track' },
          { text: 'True Peak 安全性', link: '/ja/docs/glossary/concepts/true-peak-safety' },
          { text: 'ダイナミックレンジ', link: '/ja/docs/glossary/concepts/dynamic-range' },
          { text: 'クレストファクター', link: '/ja/docs/glossary/concepts/crest-factor' },
          { text: 'モノラル互換性', link: '/ja/docs/glossary/concepts/mono-compatibility' },
          { text: 'ゲインステージング', link: '/ja/docs/glossary/concepts/gain-staging' },
          { text: 'Air Band', link: '/ja/docs/glossary/air-band' },
        ],
      },
      {
        text: 'マスタリングガイド',
        collapsed: true,
        items: [
          { text: 'リペアと入力', link: '/ja/docs/glossary/mastering/repair' },
          { text: 'ダイナミクス', link: '/ja/docs/glossary/mastering/dynamics' },
          { text: 'トーンと Air', link: '/ja/docs/glossary/mastering/tone-air' },
          { text: 'ステレオとラウドネス', link: '/ja/docs/glossary/mastering/stereo-limiter-loudness' },
          { text: 'リファレンスマッチ', link: '/ja/docs/glossary/mastering/reference-match' },
          { text: '配信ターゲット', link: '/ja/docs/glossary/mastering/delivery-targets' },
          { text: 'メーター', link: '/ja/docs/glossary/mastering/meter-reading' },
          { text: 'プリセット選択', link: '/ja/docs/glossary/mastering/preset-selection' },
          { text: '品質チェックリスト', link: '/ja/docs/glossary/mastering/quality-checklist' },
          { text: 'エラー復旧', link: '/ja/docs/glossary/mastering/error-recovery' },
        ],
      },
    ]
  }
]

// JSON-LD: SoftwareApplication schema
const softwareApplicationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'libsonare',
  applicationCategory: 'MultimediaApplication',
  applicationSubCategory: 'Audio analysis and mastering DSP library',
  operatingSystem: 'Any (Browser, Node.js, Linux, macOS)',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD'
  },
  description: 'Apache-2.0 audio analysis and mastering DSP library. Detect BPM, key, chords, beats, and sections; run mastering chains with loudness, true-peak limiting, EQ, dynamics, repair, and reference matching. Works in browsers via WebAssembly.',
  url: siteUrl,
  softwareHelp: `${siteUrl}/mastering`,
  downloadUrl: githubUrl,
  softwareVersion: '0.1.0',
  isAccessibleForFree: true,
  license: 'https://www.apache.org/licenses/LICENSE-2.0',
  featureList: [
    'Browser-based mastering demo',
    'BPM, key, chord, beat, and section detection',
    'ITU-R BS.1770-4 loudness and true-peak processing',
    'EQ, dynamics, stereo, saturation, repair, and maximizer DSP',
    'WebAssembly, Python, CLI, Node.js, and C++ APIs'
  ],
  author: {
    '@type': 'Person',
    name: 'libraz'
  },
  keywords: 'audio analysis, music mastering, mastering DSP, music information retrieval, MIR, BPM detection, key detection, chord recognition, beat tracking, loudness, true peak, WebAssembly, WASM, C++, 音声解析, マスタリング, テンポ検出, キー検出, コード認識'
}

export default withMermaid(defineConfig({
  srcDir: 'src',

  title: 'libsonare - Audio Analysis Library',
  description: 'Audio analysis library for music information retrieval. Detect BPM, key, chords, beats, and sections. Works in browsers via WebAssembly.',

  // Sitemap
  sitemap: {
    hostname: siteUrl
  },

  head: [
    ['meta', { name: 'theme-color', content: '#8B5CF6' }],
    ['link', { rel: 'icon', href: '/favicon.svg' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    ['link', { href: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Outfit:wght@600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap', rel: 'stylesheet' }],

    // JSON-LD structured data
    ['script', { type: 'application/ld+json' }, JSON.stringify(softwareApplicationJsonLd)],

    // SEO - Keywords
    ['meta', { name: 'keywords', content: 'audio analysis, music information retrieval, MIR, BPM detection, key detection, chord recognition, beat tracking, section detection, WebAssembly, WASM, C++ library, 音声解析, テンポ検出, キー検出, コード認識, ビート検出, セクション検出' }],
    ['link', { rel: 'canonical', href: siteUrl }],

    // OGP
    ['meta', { property: 'og:site_name', content: 'libsonare' }],
    ['meta', { property: 'og:title', content: 'libsonare - Audio Analysis Library' }],
    ['meta', { property: 'og:description', content: 'Audio analysis library for music information retrieval. Detect BPM, key, chords, beats, and sections.' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:url', content: siteUrl }],
    ['meta', { property: 'og:image', content: `${siteUrl}/og-image.svg` }],
    ['meta', { property: 'og:image:width', content: '1200' }],
    ['meta', { property: 'og:image:height', content: '630' }],
    ['meta', { property: 'og:locale', content: 'en' }],
    ['meta', { property: 'og:locale:alternate', content: 'ja' }],

    // Twitter
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:title', content: 'libsonare - Audio Analysis Library' }],
    ['meta', { name: 'twitter:description', content: 'Audio analysis for BPM, key, chords, beats, and sections. WebAssembly ready.' }],
    ['meta', { name: 'twitter:image', content: `${siteUrl}/og-image.svg` }],
    ['script', { defer: '', 'data-domain': 'sonare.libraz.net', src: 'https://plausible.io/js/script.js' }],
  ],

  locales: {
    root: {
      label: 'English',
      lang: 'en',
      themeConfig: {
        nav: [
          { text: 'Demo', link: '/' },
          { text: 'Mastering', link: '/mastering' },
          { text: 'Docs', link: '/docs/introduction' },
          { text: 'GitHub', link: githubUrl }
        ],
        sidebar: {
          '/docs/': [
            {
              text: 'Guide',
              items: [
                { text: 'Introduction', link: '/docs/introduction' },
                { text: 'Getting Started', link: '/docs/getting-started' },
                { text: 'Installation', link: '/docs/installation' },
                { text: 'Examples', link: '/docs/examples' },
                { text: 'Mastering Implementation', link: '/docs/mastering-implementation' },
                ...glossarySidebar,
              ]
            },
            {
              text: 'Use by Runtime',
              items: [
                { text: 'Browser / WASM', link: '/docs/wasm' },
                { text: 'JavaScript API', link: '/docs/js-api' },
                { text: 'Python API', link: '/docs/python-api' },
                { text: 'Node.js Native', link: '/docs/native-bindings' },
                { text: 'CLI Reference', link: '/docs/cli' },
                { text: 'C++ API', link: '/docs/cpp-api' },
              ]
            },
            {
              text: 'Technical',
              items: [
                { text: 'Architecture', link: '/docs/architecture' },
                { text: 'librosa Compatibility', link: '/docs/librosa-compatibility' },
                { text: 'Benchmarks', link: '/docs/benchmarks' },
              ]
            }
          ]
        }
      }
    },
    ja: {
      label: '日本語',
      lang: 'ja',
      title: 'libsonare - 音声解析ライブラリ',
      description: '音楽情報検索のための音声解析ライブラリ。BPM、キー、コード、ビート、セクションを検出。WebAssemblyでブラウザ動作可能。',
      themeConfig: {
        nav: [
          { text: 'デモ', link: '/ja/' },
          { text: 'マスタリング', link: '/ja/mastering' },
          { text: 'ドキュメント', link: '/ja/docs/introduction' },
          { text: 'GitHub', link: githubUrl }
        ],
        sidebar: {
          '/ja/docs/': [
            {
              text: 'ガイド',
              items: [
                { text: 'イントロダクション', link: '/ja/docs/introduction' },
                { text: 'はじめに', link: '/ja/docs/getting-started' },
                { text: 'インストール', link: '/ja/docs/installation' },
                { text: '使用例', link: '/ja/docs/examples' },
                { text: 'マスタリング実装', link: '/ja/docs/mastering-implementation' },
                ...jaGlossarySidebar,
              ]
            },
            {
              text: '利用環境別',
              items: [
                { text: 'ブラウザ / WASM', link: '/ja/docs/wasm' },
                { text: 'JavaScript API', link: '/ja/docs/js-api' },
                { text: 'Python API', link: '/ja/docs/python-api' },
                { text: 'Node.js ネイティブ', link: '/ja/docs/native-bindings' },
                { text: 'CLIリファレンス', link: '/ja/docs/cli' },
                { text: 'C++ API', link: '/ja/docs/cpp-api' },
              ]
            },
            {
              text: '技術情報',
              items: [
                { text: 'アーキテクチャ', link: '/ja/docs/architecture' },
                { text: 'librosa互換性', link: '/ja/docs/librosa-compatibility' },
                { text: 'ベンチマーク', link: '/ja/docs/benchmarks' },
              ]
            }
          ]
        }
      }
    }
  },

  themeConfig: {
    siteTitle: 'libsonare',
    socialLinks: [
      { icon: 'github', link: githubUrl }
    ],
    footer: {
      message: 'a personal project by <a href="https://libraz.net" target="_blank" rel="noopener">libraz</a>'
    }
  },

  vite: {
    worker: {
      format: 'es'
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('../src', import.meta.url)),
        '@theme': fileURLToPath(new URL('./theme', import.meta.url))
      }
    },
    optimizeDeps: {
      exclude: ['libsonare']
    },
    ssr: {
      noExternal: ['libsonare']
    }
  }
}))
