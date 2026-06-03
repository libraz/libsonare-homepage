import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitepress';
import { withMermaid } from 'vitepress-plugin-mermaid';

const siteUrl = 'https://sonare.libraz.net';
const githubUrl = 'https://github.com/libraz/libsonare';

type WasmAssetMeta = {
  sizeKB: number;
  gzipKB: number;
};

type WasmMeta = {
  version: string;
  sizeKB: number;
  gzipKB: number;
  assets?: Record<string, WasmAssetMeta>;
  total?: WasmAssetMeta;
};

const wasmMeta = JSON.parse(
  readFileSync(fileURLToPath(new URL('../src/wasm/meta.json', import.meta.url)), 'utf-8'),
) as WasmMeta;

function formatKb(value: number): string {
  return value.toLocaleString('en-US');
}

function wasmAsset(name: string): WasmAssetMeta {
  if (name === 'sonare.wasm') {
    return {
      sizeKB: wasmMeta.assets?.[name]?.sizeKB ?? wasmMeta.sizeKB,
      gzipKB: wasmMeta.assets?.[name]?.gzipKB ?? wasmMeta.gzipKB,
    };
  }

  const asset = wasmMeta.assets?.[name];
  if (!asset) {
    throw new Error(`Missing ${name} in src/wasm/meta.json assets`);
  }
  return asset;
}

const wasmMetaTokens: Record<string, string> = {
  version: wasmMeta.version,
  'sonareJs.sizeKB': formatKb(wasmAsset('sonare.js').sizeKB),
  'sonareJs.gzipKB': formatKb(wasmAsset('sonare.js').gzipKB),
  'indexJs.sizeKB': formatKb(wasmAsset('index.js').sizeKB),
  'indexJs.gzipKB': formatKb(wasmAsset('index.js').gzipKB),
  'wasm.sizeKB': formatKb(wasmAsset('sonare.wasm').sizeKB),
  'wasm.gzipKB': formatKb(wasmAsset('sonare.wasm').gzipKB),
  'total.sizeKB': formatKb(
    wasmMeta.total?.sizeKB ??
      wasmAsset('sonare.js').sizeKB + wasmAsset('index.js').sizeKB + wasmAsset('sonare.wasm').sizeKB,
  ),
  'total.gzipKB': formatKb(
    wasmMeta.total?.gzipKB ??
      wasmAsset('sonare.js').gzipKB +
        wasmAsset('index.js').gzipKB +
        wasmAsset('sonare.wasm').gzipKB,
  ),
};

function replaceWasmMetaTokens(src: string): string {
  return src.replace(/\{\{\s*wasmMeta\.([A-Za-z0-9.]+)\s*\}\}/g, (match, key: string) => {
    const value = wasmMetaTokens[key];
    if (value === undefined) {
      throw new Error(`Unknown wasm meta token: ${match}`);
    }
    return value;
  });
}

function routeFromRelativePath(relativePath: string): string {
  const withoutIndex = relativePath.replace(/(^|\/)index\.md$/, '$1');
  if (!withoutIndex) return '/';
  return `/${withoutIndex.replace(/\.md$/, '.html')}`;
}

function absoluteUrl(path: string): string {
  return `${siteUrl}${path}`;
}

function pageTitle(title: string): string {
  return title.startsWith('libsonare - ')
    ? 'libsonare - Dependency-Free Audio DSP Toolkit'
    : `${title} | libsonare`;
}

function pageSeoTitle(title: string): string {
  return title.startsWith('libsonare - ') ? title : pageTitle(title);
}

function localizedAlternate(relativePath: string): { lang: 'en' | 'ja'; path: string } | null {
  if (relativePath.startsWith('ja/')) {
    const enRelativePath = relativePath.replace(/^ja\//, '');
    return { lang: 'en', path: routeFromRelativePath(enRelativePath) };
  }

  const jaFile = fileURLToPath(new URL(`../src/ja/${relativePath}`, import.meta.url));
  if (!existsSync(jaFile)) return null;
  return { lang: 'ja', path: routeFromRelativePath(`ja/${relativePath}`) };
}

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
          { text: 'Mixing Basics', link: '/docs/glossary/concepts/mixing-basics' },
          { text: 'Editing Basics', link: '/docs/glossary/concepts/editing-basics' },
          {
            text: 'Browser Local Processing',
            link: '/docs/glossary/concepts/browser-local-processing',
          },
        ],
      },
      {
        text: 'Analysis Guides',
        collapsed: true,
        items: [
          { text: 'Spectrogram and STFT', link: '/docs/glossary/analysis/spectrogram-stft' },
          { text: 'Onset Detection', link: '/docs/glossary/analysis/onset-detection' },
          { text: 'Tempo and BPM', link: '/docs/glossary/analysis/tempo-bpm' },
          { text: 'Beats and Downbeats', link: '/docs/glossary/analysis/beats-downbeats' },
          { text: 'Chroma Features', link: '/docs/glossary/analysis/chroma-features' },
          { text: 'Key Detection', link: '/docs/glossary/analysis/key-detection' },
          { text: 'Chord Recognition', link: '/docs/glossary/analysis/chord-recognition' },
          { text: 'Mel, MFCC, and Timbre', link: '/docs/glossary/analysis/mel-mfcc-timbre' },
          { text: 'Melody and Pitch', link: '/docs/glossary/analysis/melody-pitch' },
          { text: 'Section and Structure', link: '/docs/glossary/analysis/section-structure' },
        ],
      },
      {
        text: 'Mixing Guides',
        collapsed: true,
        items: [
          { text: 'Channel Strip', link: '/docs/glossary/mixing/channel-strip' },
          { text: 'Buses and Sends', link: '/docs/glossary/mixing/buses-sends' },
          { text: 'Pan and Stereo Width', link: '/docs/glossary/mixing/pan-width' },
          { text: 'Automation and Metering', link: '/docs/glossary/mixing/automation-metering' },
        ],
      },
      {
        text: 'Editing Guides',
        collapsed: true,
        items: [
          {
            text: 'Time Stretch and Pitch Shift',
            link: '/docs/glossary/editing/phase-vocoder-stretch',
          },
          {
            text: 'Pitch Correction and Note Editing',
            link: '/docs/glossary/editing/pitch-correction',
          },
          { text: 'Voice and Formant', link: '/docs/glossary/editing/voice-formant' },
        ],
      },
      {
        text: 'Realtime Guides',
        collapsed: true,
        items: [
          { text: 'Streaming Analysis', link: '/docs/glossary/realtime/streaming-analysis' },
          { text: 'Realtime Engine', link: '/docs/glossary/realtime/realtime-engine' },
          { text: 'Realtime Safety', link: '/docs/glossary/realtime/realtime-safety' },
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
    ],
  },
];

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
          { text: 'ミキシングの基礎', link: '/ja/docs/glossary/concepts/mixing-basics' },
          { text: '編集の基礎', link: '/ja/docs/glossary/concepts/editing-basics' },
          {
            text: 'ブラウザ内ローカル処理',
            link: '/ja/docs/glossary/concepts/browser-local-processing',
          },
        ],
      },
      {
        text: '解析ガイド',
        collapsed: true,
        items: [
          { text: 'スペクトログラムと STFT', link: '/ja/docs/glossary/analysis/spectrogram-stft' },
          { text: 'オンセット検出', link: '/ja/docs/glossary/analysis/onset-detection' },
          { text: 'テンポと BPM', link: '/ja/docs/glossary/analysis/tempo-bpm' },
          { text: 'ビートとダウンビート', link: '/ja/docs/glossary/analysis/beats-downbeats' },
          { text: 'クロマ特徴量', link: '/ja/docs/glossary/analysis/chroma-features' },
          { text: 'キー検出', link: '/ja/docs/glossary/analysis/key-detection' },
          { text: 'コード認識', link: '/ja/docs/glossary/analysis/chord-recognition' },
          { text: 'メル・MFCC・音色', link: '/ja/docs/glossary/analysis/mel-mfcc-timbre' },
          { text: 'メロディとピッチ', link: '/ja/docs/glossary/analysis/melody-pitch' },
          { text: 'セクションと構成', link: '/ja/docs/glossary/analysis/section-structure' },
        ],
      },
      {
        text: 'ミキシングガイド',
        collapsed: true,
        items: [
          { text: 'チャンネルストリップ', link: '/ja/docs/glossary/mixing/channel-strip' },
          { text: 'バスとセンド', link: '/ja/docs/glossary/mixing/buses-sends' },
          { text: 'パンとステレオ幅', link: '/ja/docs/glossary/mixing/pan-width' },
          {
            text: 'オートメーションとメーター',
            link: '/ja/docs/glossary/mixing/automation-metering',
          },
        ],
      },
      {
        text: '編集ガイド',
        collapsed: true,
        items: [
          {
            text: 'タイムストレッチとピッチシフト',
            link: '/ja/docs/glossary/editing/phase-vocoder-stretch',
          },
          { text: 'ピッチ補正とノート編集', link: '/ja/docs/glossary/editing/pitch-correction' },
          { text: 'ボイスとフォルマント', link: '/ja/docs/glossary/editing/voice-formant' },
        ],
      },
      {
        text: 'リアルタイムガイド',
        collapsed: true,
        items: [
          { text: 'ストリーミング解析', link: '/ja/docs/glossary/realtime/streaming-analysis' },
          { text: 'リアルタイムエンジン', link: '/ja/docs/glossary/realtime/realtime-engine' },
          { text: 'リアルタイム安全性', link: '/ja/docs/glossary/realtime/realtime-safety' },
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
          {
            text: 'ステレオとラウドネス',
            link: '/ja/docs/glossary/mastering/stereo-limiter-loudness',
          },
          { text: 'リファレンスマッチ', link: '/ja/docs/glossary/mastering/reference-match' },
          { text: '配信ターゲット', link: '/ja/docs/glossary/mastering/delivery-targets' },
          { text: 'メーター', link: '/ja/docs/glossary/mastering/meter-reading' },
          { text: 'プリセット選択', link: '/ja/docs/glossary/mastering/preset-selection' },
          { text: '品質チェックリスト', link: '/ja/docs/glossary/mastering/quality-checklist' },
          { text: 'エラー復旧', link: '/ja/docs/glossary/mastering/error-recovery' },
        ],
      },
    ],
  },
];

// JSON-LD: SoftwareApplication schema
const softwareApplicationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'libsonare',
  applicationCategory: 'MultimediaApplication',
  applicationSubCategory: 'Dependency-free audio DSP toolkit',
  operatingSystem: 'Any (Browser, Node.js, Linux, macOS)',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  description:
    'Apache-2.0 dependency-free audio DSP toolkit for C++, Python, Node, CLI, and WebAssembly: analysis, broadcast-grade mastering, real-time-safe mixing, routing, editing, and creative FX.',
  url: siteUrl,
  softwareHelp: `${siteUrl}/docs/introduction.html`,
  downloadUrl: githubUrl,
  softwareVersion: wasmMeta.version,
  isAccessibleForFree: true,
  license: 'https://www.apache.org/licenses/LICENSE-2.0',
  featureList: [
    'Browser-local analysis, mastering, mixing, and realtime FX demos',
    'BPM, key, chord, beat, downbeat, section, melody, loudness, room-acoustic analysis, and geometric room tools',
    '66 named mastering DSP processors with an 18-processor default chain',
    'Real-time-safe mixing, routing, metering, offline rendering, editing DSP, and creative FX',
    'WebAssembly, Python, CLI, Node.js, and C++ APIs',
  ],
  author: {
    '@type': 'Person',
    name: 'libraz',
  },
  sameAs: [
    githubUrl,
    'https://www.npmjs.com/package/@libraz/libsonare',
    'https://pypi.org/project/libsonare/',
  ],
  programmingLanguage: ['C++', 'TypeScript', 'Python'],
  keywords:
    'audio DSP toolkit, dependency-free audio library, music mastering, mastering DSP, mixing engine, editing DSP, music information retrieval, MIR, BPM detection, key detection, chord recognition, beat tracking, loudness, true peak, WebAssembly, WASM, C++, Python, 音声解析, マスタリング, ミキシング, テンポ検出, キー検出, コード認識',
};

const webSiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'libsonare',
  url: siteUrl,
  description:
    'Documentation and browser-local demos for the libsonare dependency-free audio DSP toolkit.',
  inLanguage: ['en', 'ja'],
  publisher: {
    '@type': 'Person',
    name: 'libraz',
  },
};

export default withMermaid(
  defineConfig({
    srcDir: 'src',

    title: 'libsonare - Dependency-Free Audio DSP Toolkit',
    description:
      'Dependency-free audio DSP toolkit for C++, Python, and the browser: analysis, broadcast-grade mastering, real-time-safe mixing, routing, editing, and creative FX.',

    // Sitemap
    sitemap: {
      hostname: siteUrl,
    },

    head: [
      ['meta', { name: 'theme-color', content: '#8B5CF6' }],
      ['link', { rel: 'icon', href: '/favicon.svg' }],
      ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
      ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
      [
        'link',
        {
          href: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Outfit:wght@600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap',
          rel: 'stylesheet',
        },
      ],

      // JSON-LD structured data
      ['script', { type: 'application/ld+json' }, JSON.stringify(softwareApplicationJsonLd)],
      ['script', { type: 'application/ld+json' }, JSON.stringify(webSiteJsonLd)],

      // SEO - Keywords
      [
        'meta',
        {
          name: 'keywords',
          content:
            'audio DSP toolkit, dependency-free audio library, music information retrieval, MIR, mastering DSP, mixing engine, editing DSP, creative FX, BPM detection, key detection, chord recognition, beat tracking, WebAssembly, WASM, C++ library, Python audio, 音声解析, マスタリング, ミキシング, テンポ検出, キー検出, コード認識',
        },
      ],

      // OGP
      ['meta', { property: 'og:site_name', content: 'libsonare' }],
      ['meta', { property: 'og:type', content: 'website' }],
      ['meta', { property: 'og:image', content: `${siteUrl}/og-image.svg` }],
      ['meta', { property: 'og:image:width', content: '1200' }],
      ['meta', { property: 'og:image:height', content: '630' }],
      [
        'meta',
        { property: 'og:image:alt', content: 'libsonare dependency-free audio DSP toolkit' },
      ],
      // Twitter
      ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
      ['meta', { name: 'twitter:image', content: `${siteUrl}/og-image.svg` }],
      [
        'meta',
        { name: 'twitter:image:alt', content: 'libsonare dependency-free audio DSP toolkit' },
      ],
      [
        'script',
        { defer: '', 'data-domain': 'sonare.libraz.net', src: 'https://plausible.io/js/script.js' },
      ],
    ],

    markdown: {
      config(md) {
        md.core.ruler.before('normalize', 'replace_wasm_meta_tokens', (state) => {
          state.src = replaceWasmMetaTokens(state.src);
        });
      },
    },

    transformHead({ pageData, description }) {
      const path = routeFromRelativePath(pageData.relativePath);
      const url = absoluteUrl(path);
      const alternate = localizedAlternate(pageData.relativePath);
      const lang = pageData.relativePath.startsWith('ja/') ? 'ja' : 'en';
      const titleContent = pageSeoTitle(pageData.title || 'libsonare');
      const webPageJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: titleContent,
        description,
        url,
        inLanguage: lang,
        isPartOf: {
          '@type': 'WebSite',
          name: 'libsonare',
          url: siteUrl,
        },
      };
      const head = [
        ['link', { rel: 'canonical', href: url }],
        ['meta', { property: 'og:title', content: titleContent }],
        ['meta', { property: 'og:description', content: description }],
        ['meta', { property: 'og:url', content: url }],
        ['meta', { property: 'og:locale', content: lang === 'ja' ? 'ja_JP' : 'en_US' }],
        ['meta', { property: 'og:locale:alternate', content: lang === 'ja' ? 'en_US' : 'ja_JP' }],
        ['meta', { name: 'twitter:title', content: titleContent }],
        ['meta', { name: 'twitter:description', content: description }],
        ['meta', { name: 'robots', content: 'index,follow,max-image-preview:large' }],
        ['link', { rel: 'alternate', hreflang: lang, href: url }],
        [
          'link',
          {
            rel: 'alternate',
            hreflang: 'x-default',
            href: lang === 'ja' && alternate ? absoluteUrl(alternate.path) : url,
          },
        ],
        ['script', { type: 'application/ld+json' }, JSON.stringify(webPageJsonLd)],
      ] as any[];

      if (alternate) {
        head.push([
          'link',
          { rel: 'alternate', hreflang: alternate.lang, href: absoluteUrl(alternate.path) },
        ]);
      }

      return head;
    },

    locales: {
      root: {
        label: 'English',
        lang: 'en',
        themeConfig: {
          nav: [
            {
              text: 'Demos',
              items: [
                { items: [{ text: 'All Demos', link: '/demos' }] },
                {
                  text: 'Analysis',
                  items: [
                    { text: 'Visual Player', link: '/analyzer' },
                    { text: 'Music Analysis Studio', link: '/music-analysis' },
                    { text: 'Spatial Room Scanner', link: '/spatial' },
                  ],
                },
                {
                  text: 'Production',
                  items: [
                    { text: 'Mastering Studio', link: '/mastering' },
                    { text: 'Mixing Studio', link: '/mixing' },
                    { text: 'Realtime FX Lab', link: '/realtime-fx' },
                  ],
                },
              ],
            },
            { text: 'Docs', link: '/docs/introduction' },
            { text: 'GitHub', link: githubUrl },
          ],
          sidebar: {
            '/docs/': [
              {
                text: 'Learn First',
                items: [
                  { text: 'Introduction', link: '/docs/introduction' },
                  { text: 'Learning Path', link: '/docs/learning-path' },
                  { text: 'Getting Started', link: '/docs/getting-started' },
                  { text: 'Installation', link: '/docs/installation' },
                  { text: 'Examples', link: '/docs/examples' },
                  { text: 'Feature Map', link: '/docs/api-surface' },
                ],
              },
              {
                text: 'Build By Task',
                items: [
                  { text: 'Editing DSP', link: '/docs/editing-dsp' },
                  { text: 'Mixing Engine', link: '/docs/mixing' },
                  { text: 'Mixing Scene JSON', link: '/docs/mixing-scene-json' },
                  { text: 'Mastering Assistant', link: '/docs/mastering-assistant' },
                  { text: 'Mastering Processors', link: '/docs/mastering-processors' },
                  { text: 'Realtime and Streaming', link: '/docs/realtime-streaming' },
                  { text: 'Realtime Voice Changer', link: '/docs/realtime-voice-changer' },
                  { text: 'Room Acoustics', link: '/docs/acoustic-analysis' },
                  { text: 'Inverse Features', link: '/docs/inverse-features' },
                ],
              },
              {
                text: 'API By Runtime',
                items: [
                  { text: 'Browser / WASM', link: '/docs/wasm' },
                  { text: 'JavaScript API', link: '/docs/js-api' },
                  { text: 'Python API', link: '/docs/python-api' },
                  { text: 'CLI Reference', link: '/docs/cli' },
                  { text: 'Node.js Native', link: '/docs/native-bindings' },
                  { text: 'C++ API', link: '/docs/cpp-api' },
                  { text: 'Binding Parity', link: '/docs/binding-parity' },
                ],
              },
              {
                text: 'Understand The Details',
                items: [
                  { text: 'DSP Implementation Notes', link: '/docs/dsp-implementation' },
                  { text: 'Algorithm References', link: '/docs/algorithm-references' },
                  { text: 'Implementation Validation', link: '/docs/implementation-validation' },
                  { text: 'Mastering Implementation', link: '/docs/mastering-implementation' },
                  { text: 'Architecture', link: '/docs/architecture' },
                  { text: 'librosa Compatibility', link: '/docs/librosa-compatibility' },
                  { text: 'Benchmarks', link: '/docs/benchmarks' },
                  ...glossarySidebar,
                ],
              },
            ],
          },
        },
      },
      ja: {
        label: '日本語',
        lang: 'ja',
        title: 'libsonare - 依存なしのオーディオ DSP ツールキット',
        description:
          'C++、Python、ブラウザで使える依存なしのオーディオ DSP ツールキット。解析、放送品質のマスタリング、リアルタイム安全なミキシング、ルーティング、編集 DSP、クリエイティブ FX に対応。',
        themeConfig: {
          nav: [
            {
              text: 'デモ',
              items: [
                { items: [{ text: 'デモ一覧', link: '/ja/demos' }] },
                {
                  text: '解析',
                  items: [
                    { text: 'ビジュアルプレイヤー', link: '/ja/analyzer' },
                    { text: '楽曲分析スタジオ', link: '/ja/music-analysis' },
                    { text: '空間ルームスキャナー', link: '/ja/spatial' },
                  ],
                },
                {
                  text: '制作',
                  items: [
                    { text: 'マスタリングスタジオ', link: '/ja/mastering' },
                    { text: 'ミキシングスタジオ', link: '/ja/mixing' },
                    { text: 'リアルタイムFXラボ', link: '/ja/realtime-fx' },
                  ],
                },
              ],
            },
            { text: 'ドキュメント', link: '/ja/docs/introduction' },
            { text: 'GitHub', link: githubUrl },
          ],
          sidebar: {
            '/ja/docs/': [
              {
                text: 'まず読む',
                items: [
                  { text: 'イントロダクション', link: '/ja/docs/introduction' },
                  { text: '学習順ガイド', link: '/ja/docs/learning-path' },
                  { text: 'はじめに', link: '/ja/docs/getting-started' },
                  { text: 'インストール', link: '/ja/docs/installation' },
                  { text: '使用例', link: '/ja/docs/examples' },
                  { text: '機能マップ', link: '/ja/docs/api-surface' },
                ],
              },
              {
                text: '作りたいもの別',
                items: [
                  { text: '編集 DSP', link: '/ja/docs/editing-dsp' },
                  { text: 'ミキシングエンジン', link: '/ja/docs/mixing' },
                  { text: 'ミキシングシーン JSON', link: '/ja/docs/mixing-scene-json' },
                  { text: 'マスタリングアシスタント', link: '/ja/docs/mastering-assistant' },
                  { text: 'マスタリングプロセッサ', link: '/ja/docs/mastering-processors' },
                  { text: 'リアルタイムとストリーミング', link: '/ja/docs/realtime-streaming' },
                  {
                    text: 'リアルタイムボイスチェンジャー',
                    link: '/ja/docs/realtime-voice-changer',
                  },
                  { text: 'ルーム音響解析', link: '/ja/docs/acoustic-analysis' },
                  { text: '逆変換特徴量', link: '/ja/docs/inverse-features' },
                ],
              },
              {
                text: '利用環境別 API',
                items: [
                  { text: 'ブラウザ / WASM', link: '/ja/docs/wasm' },
                  { text: 'JavaScript API', link: '/ja/docs/js-api' },
                  { text: 'Python API', link: '/ja/docs/python-api' },
                  { text: 'CLIリファレンス', link: '/ja/docs/cli' },
                  { text: 'Node.js ネイティブ', link: '/ja/docs/native-bindings' },
                  { text: 'C++ API', link: '/ja/docs/cpp-api' },
                  { text: 'バインディング対応表', link: '/ja/docs/binding-parity' },
                ],
              },
              {
                text: '詳しく知る',
                items: [
                  { text: 'DSP 実装解説', link: '/ja/docs/dsp-implementation' },
                  { text: 'アルゴリズム根拠', link: '/ja/docs/algorithm-references' },
                  { text: '実装検証', link: '/ja/docs/implementation-validation' },
                  { text: 'マスタリング実装', link: '/ja/docs/mastering-implementation' },
                  { text: 'アーキテクチャ', link: '/ja/docs/architecture' },
                  { text: 'librosa互換性', link: '/ja/docs/librosa-compatibility' },
                  { text: 'ベンチマーク', link: '/ja/docs/benchmarks' },
                  ...jaGlossarySidebar,
                ],
              },
            ],
          },
        },
      },
    },

    themeConfig: {
      siteTitle: 'libsonare',
      socialLinks: [{ icon: 'github', link: githubUrl }],
      footer: {
        message:
          'a personal project by <a href="https://libraz.net" target="_blank" rel="noopener">libraz</a>',
      },
    },

    vite: {
      worker: {
        format: 'es',
      },
      resolve: {
        alias: {
          '@': fileURLToPath(new URL('../src', import.meta.url)),
          '@theme': fileURLToPath(new URL('./theme', import.meta.url)),
        },
      },
      optimizeDeps: {
        exclude: ['libsonare'],
      },
      ssr: {
        noExternal: ['libsonare'],
      },
    },
  }),
);
