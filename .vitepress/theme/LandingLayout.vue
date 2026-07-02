<script setup lang="ts">
import { useData } from 'vitepress';
import { computed, onMounted, ref } from 'vue';
import DemoCardGrid from '@/components/DemoCardGrid.vue';
import { CornerBrackets, GridOverlay } from '@/components/ui';
import { createTheme } from '@/composables/useTheme';
import {
  DEFAULT_LOCALE,
  localeLabels,
  localePathPrefix,
  normalizeLocale,
  supportedLocales,
} from '@/locales';
import wasmMeta from '@/wasm/meta.json';

const { lang } = useData();
const libVersion = ref<string>('');
const { isDark, toggle: toggleTheme } = createTheme();

const copiedKey = ref<string | null>(null);
let copyTimer: ReturnType<typeof setTimeout> | undefined;
async function copyCommand(text: string, key: string) {
  try {
    await navigator.clipboard.writeText(text);
    copiedKey.value = key;
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => {
      copiedKey.value = null;
    }, 1600);
  } catch {
    /* clipboard unavailable (insecure context or denied) */
  }
}

async function initWasm() {
  if (typeof window === 'undefined') return;
  if (libVersion.value) return;
  try {
    const wasm = await import('@/wasm/index.js');
    await wasm.init();
    libVersion.value = wasm.version();
  } catch (e) {
    console.warn('Failed to initialize WASM:', e);
  }
}

onMounted(() => {
  const ric = (window as any).requestIdleCallback;
  if (ric) {
    ric(initWasm, { timeout: 2000 });
  } else {
    setTimeout(initWasm, 100);
  }
});

const localeCopy = {
  en: {
    docsLabel: 'Docs',
    githubCta: 'GitHub',
    tagline: 'Dependency-free audio engine',
    hero: {
      eyebrow: 'Apache-2.0 · Zero runtime dependencies · WebAssembly',
      title: 'From analysis to arrangement: a dependency-free audio engine.',
      subtitle:
        'librosa-compatible analysis, broadcast-grade mastering and mixing, built-in instruments, and a realtime headless-DAW runtime — for C++, Python, and the browser. The same engine runs native and WASM: no Python runtime, no GPL/AGPL, no model weights.',
      installCaption: 'Install',
      installNpm: 'npm install @libraz/libsonare',
      installPip: 'pip install libsonare',
      copyLabel: 'Copy command',
      copiedLabel: 'Copied',
      starCta: 'View on GitHub',
      docsCta: 'Read the docs',
    },
    receipt: [
      { key: 'LICENSE', value: 'APACHE-2.0' },
      { key: 'RUNTIME', value: 'C++17' },
      { key: 'TARGETS', value: 'LINUX · MACOS · WASM' },
      { key: 'PACKAGES', value: 'NPM · PYPI' },
      { key: 'DEPS', value: 'ZERO RUNTIME' },
    ],
    demoSection: {
      eyebrow: 'Try it locally',
      heading: 'Nine demos. One library.',
      subhead:
        'Every demo runs the same Apache-2.0 processors locally in your browser via WebAssembly.',
      viewAll: 'Browse all demos',
    },
    analyzer: {
      status: 'LIVE',
      eyebrow: 'Real-time visualization',
      title: 'Visual Player',
      tagline:
        'Chroma and spectrum visualized in real time as the audio plays, with live BPM, key, and chord readouts — entirely in the browser.',
      chips: ['BPM', 'KEY', 'CHORDS', 'BEATS', 'SECTIONS', 'CHROMA', 'SPECTRUM'],
      cta: 'Open player',
      path: '/analyzer',
    },
    mastering: {
      status: 'STUDIO',
      eyebrow: 'Mastering DSP',
      title: 'Mastering Studio',
      tagline:
        'EQ, dynamics, multiband, stereo, true-peak limiter — render LUFS-normalized WAVs locally.',
      chips: ['EQ', 'DYNAMICS', 'MULTIBAND', 'STEREO', 'TRUE PEAK', 'LUFS', 'REPAIR'],
      cta: 'Open mastering',
      path: '/mastering',
    },
    quickStart: {
      title: 'Use it in your code',
      subtitle: 'One library, three runtimes. Pick a task, then choose where it runs.',
      docsLink: 'Open full API guide',
      disciplines: {
        analysis: 'Analysis',
        mastering: 'Mastering',
        mixing: 'Mixing',
        editing: 'Editing DSP',
      },
      runtimes: { browser: 'Browser', python: 'Python', cli: 'CLI' },
      note: 'WASM accepts decoded Float32Array samples — use Web Audio API or a JS decoder.',
    },
    pillars: {
      eyebrow: 'What ships in the box',
      heading: 'An audio engine, not a service',
      items: [
        {
          tag: 'ANALYSIS',
          title: 'Deep MIR analysis for music tools.',
          body: 'BPM, key, chords with Viterbi/HMM smoothing, beats, downbeats, time signature, sections, timbre, dynamics, YIN/pYIN pitch, tempogram/PLP, NNLS chroma, LUFS, room-acoustic estimates, and geometric room tools. Defaults are validated against generated reference values in CI.',
          link: { label: 'Feature map', path: '/docs/api-surface' },
        },
        {
          tag: 'MASTERING & MIXING',
          title: 'Broadcast-grade mastering and real-time-safe mixing.',
          body: '76 named mastering DSP processors against published references — loudness, true peak, crossovers, clippers, tube saturation, oversampling — plus a real-time-safe mixer with channel strips, buses, sends, metering, scene presets, editing DSP, and creative FX.',
          link: { label: 'Mastering processors', path: '/docs/mastering-processors' },
        },
        {
          tag: 'INSTRUMENTS & DAW',
          title: 'Built-in instruments and a headless-DAW runtime.',
          body: 'A 12-engine synth with a data-free GM fallback bank and a GS-compatible SoundFont 2 player — MIDI never renders silent. Author projects with audio and MIDI tracks, undo/redo, MIDI sequencing, SMF import/export, offline bounce, and a sample-accurate realtime engine that runs in the browser via AudioWorklet.',
          link: { label: 'Built-in instruments', path: '/docs/native-synth' },
        },
      ],
    },
    finalCta: {
      heading: 'Run the same DSP everywhere.',
      subhead: 'C++, C, Python, Node, WASM, and CLI under one Apache-2.0 license.',
      github: 'View source on GitHub',
      docs: 'Read the docs',
      license: 'Apache-2.0 License',
    },
    demoCredit: 'Demo audio created with',
    midiSketch: 'MIDI Sketch',
    demoCreditSuffix: '',
  },
  ja: {
    docsLabel: 'ドキュメント',
    githubCta: 'GitHub',
    tagline: '依存なしのオーディオエンジン',
    hero: {
      eyebrow: 'Apache-2.0 · ランタイム依存ゼロ · WebAssembly',
      title: '解析からアレンジまで、依存なしのオーディオエンジン。',
      subtitle:
        'librosa 互換の解析、放送品質のマスタリングとミキシング、内蔵インストゥルメント、リアルタイムなヘッドレス DAW ランタイム。C++・Python・ブラウザで使え、同じエンジンがネイティブと WASM で動きます。Python ランタイムなし、GPL/AGPL なし、モデル重みなし。',
      installCaption: 'インストール',
      installNpm: 'npm install @libraz/libsonare',
      installPip: 'pip install libsonare',
      copyLabel: 'コマンドをコピー',
      copiedLabel: 'コピーしました',
      starCta: 'GitHub で見る',
      docsCta: 'ドキュメントを読む',
    },
    receipt: [
      { key: 'LICENSE', value: 'APACHE-2.0' },
      { key: 'RUNTIME', value: 'C++17' },
      { key: 'TARGETS', value: 'LINUX · MACOS · WASM' },
      { key: 'PACKAGES', value: 'NPM · PYPI' },
      { key: 'DEPS', value: 'ZERO RUNTIME' },
    ],
    demoSection: {
      eyebrow: 'ローカルで試す',
      heading: '9 つのデモ、ひとつのライブラリ。',
      subhead:
        'すべてのデモは、同じ Apache-2.0 のプロセッサを WebAssembly でブラウザ内ローカル実行します。',
      viewAll: 'すべてのデモを見る',
    },
    analyzer: {
      status: 'LIVE',
      eyebrow: 'リアルタイム可視化',
      title: 'ビジュアルプレイヤー',
      tagline:
        '再生に合わせてクロマ・スペクトルをブラウザ内でリアルタイム可視化。BPM・キー・コードも参考値として表示します。',
      chips: ['BPM', 'KEY', 'CHORDS', 'BEATS', 'SECTIONS', 'CHROMA', 'SPECTRUM'],
      cta: 'プレイヤーを開く',
      path: '/analyzer',
    },
    mastering: {
      status: 'STUDIO',
      eyebrow: 'マスタリング DSP',
      title: 'マスタリングスタジオ',
      tagline:
        'EQ・ダイナミクス・マルチバンド・ステレオ・True-Peak リミッター。LUFS 正規化済みの WAV をローカルで書き出し。',
      chips: ['EQ', 'DYNAMICS', 'MULTIBAND', 'STEREO', 'TRUE PEAK', 'LUFS', 'REPAIR'],
      cta: 'マスタリングを開く',
      path: '/mastering',
    },
    quickStart: {
      title: 'コードに組み込む',
      subtitle: 'ひとつのライブラリ、3 つのランタイム。用途を選んでから実行環境を選びます。',
      docsLink: 'API ガイドを開く',
      disciplines: {
        analysis: '解析',
        mastering: 'マスタリング',
        mixing: 'ミキシング',
        editing: '編集 DSP',
      },
      runtimes: { browser: 'Browser', python: 'Python', cli: 'CLI' },
      note: 'WASM はデコード済みの Float32Array サンプルを受け取ります（Web Audio API などでデコードしてください）。',
    },
    pillars: {
      eyebrow: '同梱されるもの',
      heading: 'サービスではなくオーディオエンジン',
      items: [
        {
          tag: 'ANALYSIS',
          title: '音楽ツール向けの深い MIR 解析。',
          body: 'BPM、キー、Viterbi/HMM 平滑化つきコード、ビート、ダウンビート、拍子、セクション、音色、ダイナミクス、YIN/pYIN ピッチ、tempogram/PLP、NNLS クロマ、LUFS、ルーム音響推定。デフォルト値は CI で生成した参照値と照合しています。',
          link: { label: '機能マップ', path: '/docs/api-surface' },
        },
        {
          tag: 'MASTERING & MIXING',
          title: '放送品質のマスタリングとリアルタイム安全なミキシング。',
          body: '公開リファレンスに基づく 76 個の名前付きマスタリング DSP プロセッサ（ラウドネス、トゥルーピーク、クロスオーバー、クリッパー、真空管サチュレーション、オーバーサンプリング）に加え、チャンネルストリップ、バス、センド、メーター、シーンプリセット、編集 DSP、クリエイティブ FX を備えたリアルタイム安全なミキサー。',
          link: { label: 'マスタリングプロセッサ', path: '/docs/mastering-processors' },
        },
        {
          tag: 'INSTRUMENTS & DAW',
          title: '内蔵インストゥルメントとヘッドレス DAW ランタイム。',
          body: 'データ不要の GM フォールバックバンクを備えた 12 エンジンのシンセと、GS 互換の SoundFont 2 プレイヤー。MIDI が無音になりません。オーディオと MIDI のトラックでプロジェクトを編集でき、アンドゥ/リドゥ、MIDI シーケンス、SMF の入出力、オフラインバウンス、ブラウザでは AudioWorklet 経由で動くサンプル精度のリアルタイムエンジンを提供します。',
          link: { label: '内蔵インストゥルメント', path: '/docs/native-synth' },
        },
      ],
    },
    finalCta: {
      heading: '同じ DSP をどこでも動かす。',
      subhead: 'C++、C、Python、Node、WASM、CLI まで、ひとつの Apache-2.0 ライセンスで。',
      github: 'GitHub でソースを見る',
      docs: 'ドキュメントを読む',
      license: 'Apache-2.0 ライセンス',
    },
    demoCredit: 'デモ音源は',
    midiSketch: 'MIDI Sketch',
    demoCreditSuffix: 'で作成',
  },
} as const;

type LocaleKey = keyof typeof localeCopy;
const currentLocaleKey = computed(() => normalizeLocale(lang.value));
const currentLocale = computed(
  () => localeCopy[currentLocaleKey.value as LocaleKey] || localeCopy[DEFAULT_LOCALE],
);
const localePath = (path: string, locale = currentLocaleKey.value) =>
  `${localePathPrefix(locale)}${path}`;

const packageLinks = {
  npm: 'https://www.npmjs.com/package/@libraz/libsonare',
  pypi: 'https://pypi.org/project/libsonare/',
};

const wasmReceiptFields = (() => {
  const fields: { key: string; value: string }[] = [];
  if (wasmMeta.gzipKB && wasmMeta.sizeKB) {
    fields.push({
      key: 'WASM',
      value: `${wasmMeta.gzipKB} KB gzip / ${wasmMeta.sizeKB} KB raw`,
    });
  }
  const buildDate = wasmMeta.buildDate ? wasmMeta.buildDate.slice(0, 10) : '';
  const buildParts = [buildDate, wasmMeta.commitHash].filter(Boolean);
  if (buildParts.length > 0) {
    fields.push({ key: 'BUILD', value: buildParts.join(' · ') });
  }
  return fields;
})();

const otherLocales = computed(() =>
  supportedLocales
    .filter((key) => key !== currentLocaleKey.value)
    .map((key) => ({
      key,
      path: localePathPrefix(key),
      ...localeLabels[key],
    })),
);

const initialPath = typeof window === 'undefined' ? '/' : window.location.pathname;

function otherLocaleHref(targetPath: string) {
  const localePrefixes = supportedLocales
    .map((locale) => localePathPrefix(locale))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  const unprefixed =
    localePrefixes.reduce(
      (path, prefix) => path.replace(new RegExp(`^${prefix}(?=/|$)`), ''),
      initialPath,
    ) || '/';
  return targetPath ? `${targetPath}${unprefixed}` : unprefixed;
}

function switchLocale(event: Event, targetPath: string) {
  event.preventDefault();
  event.stopPropagation();
  if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
  if (typeof window === 'undefined') return;
  window.location.assign(otherLocaleHref(targetPath));
}

// Quick Start matrix
type Discipline = 'analysis' | 'mastering' | 'mixing' | 'editing';
type Runtime = 'browser' | 'python' | 'cli';
const discipline = ref<Discipline>('analysis');
const runtime = ref<Runtime>('browser');

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
  mixing: {
    browser: `import { init, Mixer, mixStereo, mixingScenePresetJson } from '@libraz/libsonare'

await init()

const mix = mixStereo([vocalL, musicL], [vocalR, musicR], sampleRate, {
  faderDb: [-3, -12],
  pan: [0, -0.2],
  width: [1, 0.9],
})

const mixer = Mixer.fromSceneJson(mixingScenePresetJson('vocalReverbSend'), sampleRate, 512)
try {
  const block = mixer.processStereo([vocalBlockL, musicBlockL], [vocalBlockR, musicBlockR])
  const meter = mixer.stripMeter(0, 'postFader')
} finally {
  mixer.delete()
}`,
    python: `import libsonare as sonare

mix = sonare.mix_stereo(
    [(vocal_l, vocal_r), (music_l, music_r)],
    sample_rate=48000,
    fader_db=[-3, -12],
    pan=[0, -0.2],
    width=[1, 0.9],
)

mixer = sonare.Mixer.from_scene_json(
    sonare.mixing_scene_preset_json("vocalReverbSend"),
    sample_rate=48000,
    block_size=512,
)
try:
    block = mixer.process_stereo([vocal_block_l, music_block_l], [vocal_block_r, music_block_r])
    meter = mixer.strip_meter(0, tap="postFader")
finally:
    mixer.close()`,
    cli: `sonare mix \\
  --preset vocalReverbSend \\
  --input vocal.wav \\
  --input music.wav \\
  -o mixed.wav`,
  },
  editing: {
    browser: `import { init, noteStretch, pitchCorrectToMidi, voiceChange } from '@libraz/libsonare'

await init()

const tuned = pitchCorrectToMidi(vocal, sampleRate, 68.7, 69)
const heldNote = noteStretch(vocal, sampleRate, 12000, 24000, 1.25)
const character = voiceChange(vocal, sampleRate, 5, 1.1)`,
    python: `import libsonare as sonare

tuned = sonare.pitch_correct_to_midi(vocal, sample_rate, current_midi=68.7, target_midi=69)
held_note = sonare.note_stretch(vocal, sample_rate, onset_sample=12000, offset_sample=24000, stretch_ratio=1.25)
character = sonare.voice_change(vocal, sample_rate, pitch_semitones=5, formant_factor=1.1)`,
    cli: `sonare pitch-correct vocal.wav -o tuned.wav \\
  --current-midi 68.7 --target-midi 69

sonare voice-change vocal.wav -o character.wav \\
  --pitch-semitones 5 --formant-factor 1.1`,
  },
};

const currentCode = computed(() => codeMatrix[discipline.value][runtime.value]);

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function highlight(code: string, rt: Runtime): string {
  const lines = escapeHtml(code).split('\n');
  if (rt === 'cli') {
    return lines
      .map((line) => {
        if (!line.trim()) return '';
        if (line.startsWith('#')) return `<span class="landing__code-comment">${line}</span>`;
        return line
          .replace(/^(\S+)/, '<span class="landing__code-function">$1</span>')
          .replace(/(--[a-z-]+)/g, '<span class="landing__code-keyword">$1</span>');
      })
      .join('\n');
  }
  if (rt === 'python') {
    return lines
      .map((line) =>
        line
          .replace(
            /(&quot;[^&]*&quot;|"[^"]*"|'[^']*')/g,
            '<span class="landing__code-string">$1</span>',
          )
          .replace(
            /\b(import|as|from|with|print|def|return|f)\b/g,
            '<span class="landing__code-keyword">$1</span>',
          )
          .replace(
            /\b(libsonare|audio|result)\b/g,
            '<span class="landing__code-variable">$1</span>',
          )
          .replace(/(#.*$)/g, '<span class="landing__code-comment">$1</span>'),
      )
      .join('\n');
  }
  return lines
    .map((line) =>
      line
        .replace(
          /(&quot;[^&]*&quot;|"[^"]*"|'[^']*'|`[^`]*`)/g,
          '<span class="landing__code-string">$1</span>',
        )
        .replace(
          /\b(import|from|await|const|let|var|function|return)\b/g,
          '<span class="landing__code-keyword">$1</span>',
        )
        .replace(
          /\b(init|detectBpm|detectKey|analyze|masteringChainStereo|masteringChain|masteringProcess|Mixer|mixStereo|mixingScenePresetJson|processStereo|stripMeter|noteStretch|pitchCorrectToMidi|voiceChange)\b/g,
          '<span class="landing__code-function">$1</span>',
        )
        .replace(
          /\b(samples|sampleRate|bpm|key|result|left|right|mix|mixer|block|meter|vocal|tuned|heldNote|character)\b/g,
          '<span class="landing__code-variable">$1</span>',
        )
        .replace(/(\/\/.*$)/g, '<span class="landing__code-comment">$1</span>'),
    )
    .join('\n');
}

const highlightedCode = computed(() => highlight(currentCode.value, runtime.value));

// Mini spectrum bars for the analyzer card — pseudo-spectrum based on a deterministic seed
const spectrumBars = Array.from({ length: 22 }, (_, i) => {
  const angle = (i / 22) * Math.PI;
  const env = Math.sin(angle) ** 1.4;
  const wob = 0.55 + 0.45 * Math.sin(i * 1.7);
  return 22 + env * 60 * wob;
});

// Mini LUFS arc (mastering card)
const lufsTicks = Array.from({ length: 24 }, (_, i) => {
  const t = i / 23;
  const angle = -Math.PI * 0.85 + t * Math.PI * 1.7;
  const r = 36;
  const r2 = i < 18 ? 30 : 24;
  return {
    x1: 50 + Math.cos(angle) * r,
    y1: 50 + Math.sin(angle) * r,
    x2: 50 + Math.cos(angle) * r2,
    y2: 50 + Math.sin(angle) * r2,
    on: i < 18,
  };
});

// Coordinate disguised as build node ID (matches DemoLayout)
const nodeId = computed(() => {
  const now = new Date();
  const [lat, lng] =
    now.getMonth() === 6 && now.getDate() === 10
      ? ['35.5568', '139.4386']
      : ['31.9505', '115.8605'];
  return `${lat}-${lng}`;
});
</script>

<template>
  <div class="landing" :class="`landing--${currentLocaleKey}`">
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
            <button
              type="button"
              class="landing__install-copy"
              :class="{ 'landing__install-copy--done': copiedKey === 'npm' }"
              :aria-label="copiedKey === 'npm' ? currentLocale.hero.copiedLabel : currentLocale.hero.copyLabel"
              @click="copyCommand(currentLocale.hero.installNpm, 'npm')"
            >
              <svg v-if="copiedKey === 'npm'" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
            </button>
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
            <button
              type="button"
              class="landing__install-copy"
              :class="{ 'landing__install-copy--done': copiedKey === 'pip' }"
              :aria-label="copiedKey === 'pip' ? currentLocale.hero.copiedLabel : currentLocale.hero.copyLabel"
              @click="copyCommand(currentLocale.hero.installPip, 'pip')"
            >
              <svg v-if="copiedKey === 'pip'" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
            </button>
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
          <span class="landing__sr-status" role="status" aria-live="polite">{{ copiedKey ? currentLocale.hero.copiedLabel : '' }}</span>
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

      <DemoCardGrid />

      <a :href="localePath('/demos')" class="landing__demos-all">
        {{ currentLocale.demoSection.viewAll }}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </a>
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

        <div class="landing__code-wrap">
          <button
            type="button"
            class="landing__code-copy"
            :class="{ 'landing__code-copy--done': copiedKey === 'code' }"
            :aria-label="copiedKey === 'code' ? currentLocale.hero.copiedLabel : currentLocale.hero.copyLabel"
            @click="copyCommand(currentCode, 'code')"
          >
            <svg v-if="copiedKey === 'code'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
          </button>
          <pre class="landing__code"><code v-html="highlightedCode"></code></pre>
        </div>

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
          <a href="https://midisketch.libraz.net/" target="_blank" rel="noopener" class="landing__footer-credit">{{ currentLocale.midiSketch }}</a>{{ currentLocale.demoCreditSuffix }}
        </span>
      </div>
      <div class="landing__footer-meta">
        <span class="landing__node-id">{{ nodeId }}</span>
      </div>
    </footer>
  </div>
</template>

<style scoped src="./styles/landing/landingBase.css"></style>
<style scoped src="./styles/landing/landingHero.css"></style>
<style scoped src="./styles/landing/landingSections.css"></style>
<style scoped src="./styles/landing/landingQuickPillars.css"></style>
<style scoped src="./styles/landing/landingFooter.css"></style>
<style scoped src="./styles/landing/landingResponsive.css"></style>


<style src="./styles/landing/landingGlobal.css"></style>
