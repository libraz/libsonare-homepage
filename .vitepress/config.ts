import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'
import { fileURLToPath, URL } from 'node:url'

const siteUrl = 'https://sonare.libraz.net'
const githubUrl = 'https://github.com/libraz/libsonare'

// JSON-LD: SoftwareApplication schema
const softwareApplicationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'libsonare',
  applicationCategory: 'MultimediaApplication',
  operatingSystem: 'Any (Browser, Node.js, Linux, macOS)',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD'
  },
  description: 'C++17 audio analysis library for music information retrieval. Detect BPM, key, chords, beats, and sections from audio files. Works in browsers via WebAssembly.',
  url: siteUrl,
  downloadUrl: githubUrl,
  softwareVersion: '0.1.0',
  author: {
    '@type': 'Person',
    name: 'libraz'
  },
  license: 'https://opensource.org/licenses/Apache-2.0',
  keywords: 'audio analysis, music information retrieval, MIR, BPM detection, key detection, chord recognition, beat tracking, WebAssembly, WASM, C++, 音声解析, テンポ検出, キー検出, コード認識'
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
    ['link', { rel: 'icon', href: '/favicon.ico' }],
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
    ['meta', { property: 'og:image', content: `${siteUrl}/og-image.png` }],
    ['meta', { property: 'og:image:width', content: '1200' }],
    ['meta', { property: 'og:image:height', content: '630' }],
    ['meta', { property: 'og:locale', content: 'en' }],
    ['meta', { property: 'og:locale:alternate', content: 'ja' }],

    // Twitter
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:title', content: 'libsonare - Audio Analysis Library' }],
    ['meta', { name: 'twitter:description', content: 'Audio analysis for BPM, key, chords, beats, and sections. WebAssembly ready.' }],
    ['meta', { name: 'twitter:image', content: `${siteUrl}/og-image.png` }],
  ],

  locales: {
    root: {
      label: 'English',
      lang: 'en',
      themeConfig: {
        nav: [
          { text: 'Demo', link: '/' },
          { text: 'Docs', link: '/docs/getting-started' },
          { text: 'GitHub', link: githubUrl }
        ],
        sidebar: {
          '/docs/': [
            {
              text: 'Guide',
              items: [
                { text: 'Getting Started', link: '/docs/getting-started' },
                { text: 'Installation', link: '/docs/installation' },
                { text: 'Examples', link: '/docs/examples' },
                { text: 'Glossary', link: '/docs/glossary' },
              ]
            },
            {
              text: 'API Reference',
              items: [
                { text: 'JavaScript API', link: '/docs/js-api' },
                { text: 'C++ API', link: '/docs/cpp-api' },
                { text: 'CLI Reference', link: '/docs/cli' },
              ]
            },
            {
              text: 'Technical',
              items: [
                { text: 'Architecture', link: '/docs/architecture' },
                { text: 'WebAssembly', link: '/docs/wasm' },
                { text: 'librosa Compatibility', link: '/docs/librosa-compatibility' },
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
          { text: 'ドキュメント', link: '/ja/docs/getting-started' },
          { text: 'GitHub', link: githubUrl }
        ],
        sidebar: {
          '/ja/docs/': [
            {
              text: 'ガイド',
              items: [
                { text: 'はじめに', link: '/ja/docs/getting-started' },
                { text: 'インストール', link: '/ja/docs/installation' },
                { text: '使用例', link: '/ja/docs/examples' },
                { text: '用語集', link: '/ja/docs/glossary' },
              ]
            },
            {
              text: 'APIリファレンス',
              items: [
                { text: 'JavaScript API', link: '/ja/docs/js-api' },
                { text: 'C++ API', link: '/ja/docs/cpp-api' },
                { text: 'CLIリファレンス', link: '/ja/docs/cli' },
              ]
            },
            {
              text: '技術情報',
              items: [
                { text: 'アーキテクチャ', link: '/ja/docs/architecture' },
                { text: 'WebAssembly', link: '/ja/docs/wasm' },
                { text: 'librosa互換性', link: '/ja/docs/librosa-compatibility' },
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
      message: 'Released under the Apache-2.0 License.',
      copyright: 'Copyright © 2024-present libraz'
    }
  },

  vite: {
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
