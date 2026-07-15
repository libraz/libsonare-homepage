import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitepress';
import { generateLlmsTxt } from './llms';

const siteUrl = 'https://sonare.libraz.net';
const githubUrl = 'https://github.com/libraz/libsonare';
const defaultLocale = 'en';

const siteLocales = (() => {
  const localesDir = fileURLToPath(new URL('../src/locales', import.meta.url));
  if (!existsSync(localesDir)) return [defaultLocale, 'ja'];
  const locales = readdirSync(localesDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name.replace(/\.json$/, ''));
  return [...new Set([defaultLocale, ...locales])].sort();
})();

const englishLanguageNames = new Intl.DisplayNames(['en'], { type: 'language' });

function languageLabel(locale: string): string {
  const english = englishLanguageNames.of(locale) ?? locale;
  const native = new Intl.DisplayNames([locale], { type: 'language' }).of(locale) ?? locale;
  return english === native ? english : `${english} (${native})`;
}

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
      wasmAsset('sonare.js').sizeKB +
        wasmAsset('index.js').sizeKB +
        wasmAsset('sonare.wasm').sizeKB,
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
    ? 'libsonare - Dependency-Free Audio Engine'
    : `${title} | libsonare`;
}

function pageSeoTitle(title: string): string {
  return title.startsWith('libsonare - ') ? title : pageTitle(title);
}

function localeFromRelativePath(relativePath: string): string {
  const [firstSegment] = relativePath.split('/');
  return siteLocales.includes(firstSegment) && firstSegment !== defaultLocale
    ? firstSegment
    : defaultLocale;
}

function unlocalizedRelativePath(relativePath: string): string {
  const locale = localeFromRelativePath(relativePath);
  return locale === defaultLocale
    ? relativePath
    : relativePath.replace(new RegExp(`^${locale}/`), '');
}

function relativePathForLocale(relativePath: string, locale: string): string {
  const unlocalized = unlocalizedRelativePath(relativePath);
  return locale === defaultLocale ? unlocalized : `${locale}/${unlocalized}`;
}

function localizedAlternates(relativePath: string): Array<{ lang: string; path: string }> {
  const alternates = [];
  for (const locale of siteLocales) {
    const localizedRelativePath = relativePathForLocale(relativePath, locale);
    const localizedFile = fileURLToPath(
      new URL(`../src/${localizedRelativePath}`, import.meta.url),
    );
    if (existsSync(localizedFile)) {
      alternates.push({ lang: locale, path: routeFromRelativePath(localizedRelativePath) });
    }
  }
  return alternates;
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
        text: 'Instruments and MIDI',
        collapsed: true,
        items: [
          { text: 'Synthesis Basics', link: '/docs/glossary/instruments/synthesis-basics' },
          {
            text: 'Envelopes and Modulation',
            link: '/docs/glossary/instruments/envelopes-modulation',
          },
          { text: 'MIDI Basics', link: '/docs/glossary/instruments/midi-basics' },
          {
            text: 'SoundFont and Sampled Instruments',
            link: '/docs/glossary/instruments/soundfont',
          },
        ],
      },
      {
        text: 'Arrangement and Projects',
        collapsed: true,
        items: [
          { text: 'Clips and Tracks', link: '/docs/glossary/arrangement/clips-and-tracks' },
          { text: 'Takes and Comping', link: '/docs/glossary/arrangement/takes-and-comping' },
          { text: 'Warp and Tempo Sync', link: '/docs/glossary/arrangement/warp-and-tempo' },
          {
            text: 'Bounce and Rendering',
            link: '/docs/glossary/arrangement/bounce-and-rendering',
          },
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
        text: 'Room Acoustics',
        collapsed: true,
        items: [
          {
            text: 'Reverberation Time',
            link: '/docs/glossary/acoustics/reverberation-time',
          },
          {
            text: 'Clarity and Definition',
            link: '/docs/glossary/acoustics/clarity-definition',
          },
          { text: 'Source Distance and DRR', link: '/docs/glossary/acoustics/source-distance' },
          { text: 'Room Geometry and Volume', link: '/docs/glossary/acoustics/room-geometry' },
          {
            text: 'Per-Band Decay and Absorption',
            link: '/docs/glossary/acoustics/absorption-bands',
          },
          {
            text: 'Inverse Room Estimation',
            link: '/docs/glossary/acoustics/inverse-estimation',
          },
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
        text: '楽器と MIDI',
        collapsed: true,
        items: [
          { text: 'シンセシスの基礎', link: '/ja/docs/glossary/instruments/synthesis-basics' },
          {
            text: 'エンベロープとモジュレーション',
            link: '/ja/docs/glossary/instruments/envelopes-modulation',
          },
          { text: 'MIDI の基礎', link: '/ja/docs/glossary/instruments/midi-basics' },
          { text: 'SoundFont とサンプル音源', link: '/ja/docs/glossary/instruments/soundfont' },
        ],
      },
      {
        text: 'アレンジとプロジェクト',
        collapsed: true,
        items: [
          { text: 'クリップとトラック', link: '/ja/docs/glossary/arrangement/clips-and-tracks' },
          { text: 'テイクとコンピング', link: '/ja/docs/glossary/arrangement/takes-and-comping' },
          { text: 'ワープとテンポ同期', link: '/ja/docs/glossary/arrangement/warp-and-tempo' },
          {
            text: 'バウンスとレンダリング',
            link: '/ja/docs/glossary/arrangement/bounce-and-rendering',
          },
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
        text: '室内音響',
        collapsed: true,
        items: [
          { text: '残響時間', link: '/ja/docs/glossary/acoustics/reverberation-time' },
          { text: '明瞭度と明瞭性', link: '/ja/docs/glossary/acoustics/clarity-definition' },
          { text: '音源距離と DRR', link: '/ja/docs/glossary/acoustics/source-distance' },
          { text: '部屋の形状と容積', link: '/ja/docs/glossary/acoustics/room-geometry' },
          { text: '帯域別の減衰と吸音', link: '/ja/docs/glossary/acoustics/absorption-bands' },
          { text: '逆問題による部屋推定', link: '/ja/docs/glossary/acoustics/inverse-estimation' },
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

// English demo menu — shared between the Demos nav and the llms.txt index.
const enDemoMenu = [
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
      { text: 'Synth Playground', link: '/synth' },
      { text: 'Studio Mini', link: '/studio' },
      { text: 'Piano Practice', link: '/practice' },
    ],
  },
];

// Community / OSS-contribution tools. Not demos: these let contributors shape
// libsonare itself (e.g. tune the physical-model engines and feed patches back).
const enContributeMenu = [{ items: [{ text: 'Physical Model Tuner', link: '/tuner' }] }];

// English docs sidebar — shared between the `/docs/` sidebar and the llms.txt index.
const enDocsSidebar = [
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
      { text: 'Spectral Editing', link: '/docs/spectral-editing' },
      { text: 'Mixing Engine', link: '/docs/mixing' },
      { text: 'Mixing Scene JSON', link: '/docs/mixing-scene-json' },
      { text: 'Mixing Demo Project JSON', link: '/docs/mixing-demo-project-json' },
      { text: 'Effects Inserts', link: '/docs/effects-inserts' },
      { text: 'Mastering Assistant', link: '/docs/mastering-assistant' },
      { text: 'Mastering Processors', link: '/docs/mastering-processors' },
      { text: 'Realtime and Streaming', link: '/docs/realtime-streaming' },
      { text: 'Realtime Engine', link: '/docs/realtime-engine' },
      { text: 'Realtime Voice Changer', link: '/docs/realtime-voice-changer' },
      { text: 'Room Acoustics', link: '/docs/acoustic-analysis' },
      { text: 'Inverse Features', link: '/docs/inverse-features' },
    ],
  },
  {
    text: 'Compose & Arrange',
    items: [
      { text: 'Project Editing', link: '/docs/project-editing' },
      { text: 'MIDI Input', link: '/docs/midi-input' },
      { text: 'Built-in Synthesizer', link: '/docs/native-synth' },
      { text: 'SoundFont Player', link: '/docs/soundfont-player' },
      { text: 'Recording & Takes', link: '/docs/recording-and-takes' },
      { text: 'Bouncing Projects', link: '/docs/project-bounce' },
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
      { text: 'Node.js Native API', link: '/docs/node-api' },
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
];

function prefixLocaleLink(link: string | undefined, locale: string): string | undefined {
  if (!link?.startsWith('/') || link.startsWith('//')) return link;
  const firstSegment = link.split('/')[1];
  if (siteLocales.includes(firstSegment)) return link;
  return `/${locale}${link}`;
}

function prefixLocaleLinks<T extends { link?: string; items?: T[] }>(
  nodes: T[],
  locale: string,
): T[] {
  return nodes.map((node) => ({
    ...node,
    link: prefixLocaleLink(node.link, locale),
    items: node.items ? prefixLocaleLinks(node.items, locale) : undefined,
  }));
}

const generatedLocaleConfigs = Object.fromEntries(
  siteLocales
    .filter((locale) => locale !== defaultLocale && locale !== 'ja')
    .map((locale) => [
      locale,
      {
        label: languageLabel(locale),
        lang: locale,
        themeConfig: {
          nav: [
            { text: 'Demos', items: prefixLocaleLinks(enDemoMenu, locale) },
            { text: 'Contribute', items: prefixLocaleLinks(enContributeMenu, locale) },
            { text: 'Docs', link: `/${locale}/docs/introduction` },
            { text: 'GitHub', link: githubUrl },
          ],
          sidebar: {
            [`/${locale}/docs/`]: prefixLocaleLinks(enDocsSidebar, locale),
          },
        },
      },
    ]),
);

// JSON-LD: SoftwareApplication schema
const softwareApplicationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'libsonare',
  applicationCategory: 'MultimediaApplication',
  applicationSubCategory: 'Dependency-free audio engine',
  operatingSystem: 'Any (Browser, Node.js, Linux, macOS)',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  description:
    'Apache-2.0 dependency-free audio engine for C++, Python, Node, CLI, and WebAssembly: librosa-compatible analysis, broadcast-grade mastering and mixing, built-in instruments, and a headless-DAW/realtime runtime.',
  url: siteUrl,
  softwareHelp: `${siteUrl}/docs/introduction.html`,
  downloadUrl: githubUrl,
  softwareVersion: wasmMeta.version,
  isAccessibleForFree: true,
  license: 'https://www.apache.org/licenses/LICENSE-2.0',
  featureList: [
    'Browser-local analysis, mastering, mixing, and realtime FX demos',
    'BPM, key, chord, beat, downbeat, section, melody, loudness, room-acoustic analysis, and geometric room tools',
    '76 named mastering DSP processors with preset, chain, solo, pair, and stereo entry points',
    'Real-time-safe mixing, routing, metering, offline rendering, editing DSP, and creative FX',
    'Built-in instruments: 12-engine synthesizer with GM fallback and SoundFont 2 player',
    'Headless DAW runtime: MIDI sequencing, arrangement editing, offline bounce',
    'Realtime playback engine with live MIDI input and recording',
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
    'audio engine, dependency-free audio library, music mastering, mastering DSP, mixing engine, editing DSP, built-in instruments, software synthesizer, SoundFont SF2 player, MIDI sequencing, headless DAW, realtime audio engine, music information retrieval, MIR, BPM detection, key detection, chord recognition, beat tracking, loudness, true peak, WebAssembly, WASM, C++, Python, 音声解析, マスタリング, ミキシング, シンセサイザー, SoundFont, MIDI, テンポ検出, キー検出, コード認識',
};

const webSiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'libsonare',
  url: siteUrl,
  description:
    'Documentation and browser-local demos for the libsonare dependency-free audio engine.',
  inLanguage: siteLocales,
  publisher: {
    '@type': 'Person',
    name: 'libraz',
  },
};

export default defineConfig({
  srcDir: 'src',
  // Developer docs that live next to the code (e.g. component READMEs) are not
  // public pages — keep them out of the built, localized route tree.
  srcExclude: ['**/README.md'],

  title: 'libsonare - Dependency-Free Audio Engine',
  description:
    'Dependency-free audio engine for C++, Python, and the browser: librosa-compatible analysis, broadcast-grade mastering and mixing, built-in instruments, and a headless-DAW/realtime runtime.',

  // Sitemap
  sitemap: {
    hostname: siteUrl,
  },

  // Emit an llms.txt index (https://llmstxt.org) into the build output.
  buildEnd(siteConfig) {
    generateLlmsTxt({
      siteUrl,
      srcDir: siteConfig.srcDir,
      outDir: siteConfig.outDir,
      summary:
        'Dependency-free C++/WebAssembly audio engine: librosa-compatible analysis (BPM, key, chord, beat, section, melody, loudness), broadcast-grade mastering and mixing, room acoustics, built-in instruments (synth + SoundFont), and a headless-DAW/realtime runtime. Apache-2.0.',
      demoMenu: enDemoMenu,
      docsSidebar: enDocsSidebar,
      glossaryRoot: glossarySidebar[0],
      localizedSections: siteLocales
        .filter((locale) => locale !== defaultLocale)
        .map((locale) => {
          const label = languageLabel(locale);
          return {
            locale,
            label,
            docsLink: `/${locale}/docs/introduction`,
            demosLink: `/${locale}/demos`,
            docsText: `${label} documentation`,
            demosText: `${label} demos`,
            docsDescription: `Localized documentation for ${label}.`,
            demosDescription: `Localized browser demos for ${label}.`,
          };
        }),
    });
  },

  head: [
    ['meta', { name: 'theme-color', content: '#8B5CF6' }],
    ['link', { rel: 'icon', href: '/favicon.svg' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    [
      'link',
      {
        // JetBrains Mono 600-800 are used by the demo instrument labels;
        // loading them here replaces the per-component Google Fonts @imports.
        href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+JP:wght@400;500;700&family=JetBrains+Mono:wght@400;500;600;700;800&family=Outfit:wght@600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap',
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
          'audio engine, dependency-free audio library, music information retrieval, MIR, mastering DSP, mixing engine, editing DSP, creative FX, built-in instruments, software synthesizer, SoundFont SF2 player, MIDI sequencing, headless DAW, realtime audio engine, BPM detection, key detection, chord recognition, beat tracking, WebAssembly, WASM, C++ library, Python audio, 音声解析, マスタリング, ミキシング, シンセサイザー, SoundFont, MIDI, テンポ検出, キー検出, コード認識',
      },
    ],

    // OGP
    ['meta', { property: 'og:site_name', content: 'libsonare' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:image', content: `${siteUrl}/og-image.svg` }],
    ['meta', { property: 'og:image:width', content: '1200' }],
    ['meta', { property: 'og:image:height', content: '630' }],
    ['meta', { property: 'og:image:alt', content: 'libsonare dependency-free audio engine' }],
    // Twitter
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:image', content: `${siteUrl}/og-image.svg` }],
    ['meta', { name: 'twitter:image:alt', content: 'libsonare dependency-free audio engine' }],
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
    const alternates = localizedAlternates(pageData.relativePath);
    const lang = localeFromRelativePath(pageData.relativePath);
    const defaultAlternate = alternates.find((item) => item.lang === defaultLocale);
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
      ['meta', { property: 'og:locale', content: lang }],
      ['meta', { name: 'twitter:title', content: titleContent }],
      ['meta', { name: 'twitter:description', content: description }],
      ['meta', { name: 'robots', content: 'index,follow,max-image-preview:large' }],
      ['link', { rel: 'alternate', hreflang: lang, href: url }],
      [
        'link',
        {
          rel: 'alternate',
          hreflang: 'x-default',
          href: defaultAlternate ? absoluteUrl(defaultAlternate.path) : url,
        },
      ],
      ['script', { type: 'application/ld+json' }, JSON.stringify(webPageJsonLd)],
    ] as any[];

    for (const alternate of alternates) {
      if (alternate.lang === lang) continue;
      head.push(['meta', { property: 'og:locale:alternate', content: alternate.lang }]);
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
          { text: 'Demos', items: enDemoMenu },
          { text: 'Contribute', items: enContributeMenu },
          { text: 'Docs', link: '/docs/introduction' },
          { text: 'GitHub', link: githubUrl },
        ],
        sidebar: {
          '/docs/': enDocsSidebar,
        },
      },
    },
    ja: {
      label: '日本語',
      lang: 'ja',
      title: 'libsonare - 依存なしのオーディオエンジン',
      description:
        'C++、Python、ブラウザで使える依存なしのオーディオエンジン。librosa 互換の解析、放送品質のマスタリングとミキシング、内蔵インストゥルメント、ヘッドレス DAW / リアルタイムランタイムに対応。',
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
                  { text: 'シンセプレイグラウンド', link: '/ja/synth' },
                  { text: 'スタジオミニ', link: '/ja/studio' },
                  { text: 'ピアノ練習', link: '/ja/practice' },
                ],
              },
            ],
          },
          {
            text: '貢献',
            items: [{ items: [{ text: '物理モデルチューナー', link: '/ja/tuner' }] }],
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
                { text: 'スペクトル編集', link: '/ja/docs/spectral-editing' },
                { text: 'ミキシングエンジン', link: '/ja/docs/mixing' },
                { text: 'ミキシングシーン JSON', link: '/ja/docs/mixing-scene-json' },
                {
                  text: 'ミキシングデモのプロジェクト JSON',
                  link: '/ja/docs/mixing-demo-project-json',
                },
                { text: 'エフェクトインサート', link: '/ja/docs/effects-inserts' },
                { text: 'マスタリングアシスタント', link: '/ja/docs/mastering-assistant' },
                { text: 'マスタリングプロセッサ', link: '/ja/docs/mastering-processors' },
                { text: 'リアルタイムとストリーミング', link: '/ja/docs/realtime-streaming' },
                { text: 'リアルタイムエンジン', link: '/ja/docs/realtime-engine' },
                {
                  text: 'リアルタイムボイスチェンジャー',
                  link: '/ja/docs/realtime-voice-changer',
                },
                { text: 'ルーム音響解析', link: '/ja/docs/acoustic-analysis' },
                { text: '逆変換特徴量', link: '/ja/docs/inverse-features' },
              ],
            },
            {
              text: '作曲・アレンジ',
              items: [
                { text: 'プロジェクト編集', link: '/ja/docs/project-editing' },
                { text: 'MIDI 入力', link: '/ja/docs/midi-input' },
                { text: '内蔵シンセサイザー', link: '/ja/docs/native-synth' },
                { text: 'SoundFont プレイヤー', link: '/ja/docs/soundfont-player' },
                { text: '録音とテイク', link: '/ja/docs/recording-and-takes' },
                { text: 'プロジェクトのバウンス', link: '/ja/docs/project-bounce' },
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
                { text: 'Node.js ネイティブ API', link: '/ja/docs/node-api' },
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
    ...generatedLocaleConfigs,
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
    build: {
      // Heavy docs/demo chunks are checked explicitly by `check:built-routes`.
      chunkSizeWarningLimit: 1280,
    },
    worker: {
      format: 'es',
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('../src', import.meta.url)),
        '@theme': fileURLToPath(new URL('./theme', import.meta.url)),
        'node:module': fileURLToPath(new URL('./shims/node-module.ts', import.meta.url)),
      },
    },
    optimizeDeps: {
      exclude: ['libsonare'],
    },
    ssr: {
      noExternal: ['libsonare'],
    },
  },
});
