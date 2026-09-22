import { LISTED_DEMOS, type ListedDemoId } from '@/demos/manifest';

export type DemoVisual =
  | 'spectrum'
  | 'lufs'
  | 'chroma'
  | 'faders'
  | 'fx'
  | 'room'
  | 'keys'
  | 'steps'
  | 'fall'
  | 'parts'
  | 'filter';

export interface DemoEntry {
  id: ListedDemoId;
  path: string;
  visual: DemoVisual;
  status: string;
  accent: boolean;
  eyebrow: string;
  title: string;
  tagline: string;
  chips: string[];
  cta: string;
}

export interface DemoCardsCopy {
  prevLabel: string;
  nextLabel: string;
  cta: string;
  cards: Record<ListedDemoId, { title: string; tagline: string }>;
}

/** Card artwork and badges. Order and routes come from the demo manifest. */
const CARD_META: Record<
  ListedDemoId,
  Pick<DemoEntry, 'visual' | 'status' | 'accent' | 'eyebrow' | 'chips'>
> = {
  analyzer: {
    visual: 'spectrum',
    accent: false,
    status: 'LIVE',
    eyebrow: 'VISUAL PLAYER',
    chips: ['BPM', 'KEY', 'CHORD', 'SPECTRUM'],
  },
  mastering: {
    visual: 'lufs',
    accent: true,
    status: 'STUDIO',
    eyebrow: 'MASTERING',
    chips: ['LUFS', 'EQ', 'DYNAMICS', 'WAV'],
  },
  analysis: {
    visual: 'chroma',
    accent: false,
    status: 'STUDIO',
    eyebrow: 'ANALYSIS',
    chips: ['STRUCTURE', 'CHROMA', 'CQT', 'BEATS'],
  },
  mixing: {
    visual: 'faders',
    accent: false,
    status: 'STUDIO',
    eyebrow: 'MIXING',
    chips: ['8 TRACKS', 'PAN', 'WIDTH', 'BOUNCE'],
  },
  fx: {
    visual: 'fx',
    accent: false,
    status: 'MIC',
    eyebrow: 'REALTIME FX',
    chips: ['PITCH', 'FORMANT', 'CHARACTER', 'PRESETS'],
  },
  spatial: {
    visual: 'room',
    accent: false,
    status: 'NEW',
    eyebrow: 'SPATIAL 3D',
    chips: ['RT60', 'GEOMETRY', 'DRR', '3D'],
  },
  synth: {
    visual: 'keys',
    accent: false,
    status: 'NEW',
    eyebrow: 'INSTRUMENTS',
    chips: ['16 ENGINES', '70 PRESETS', 'MIDI', 'PATCH'],
  },
  studio: {
    visual: 'steps',
    accent: false,
    status: 'NEW',
    eyebrow: 'HEADLESS DAW',
    chips: ['PROJECT', 'STEPS', 'MIX', 'BOUNCE'],
  },
  practice: {
    visual: 'fall',
    accent: false,
    status: 'NEW',
    eyebrow: 'PLAY · LEARN',
    chips: ['SYNTH + SF2', 'RHYTHM GAME', 'WEB MIDI', 'FALLING NOTES'],
  },
  'gs-module': {
    visual: 'parts',
    accent: false,
    status: 'NEW',
    eyebrow: 'GM · GS',
    chips: ['16 PARTS', 'SYSEX', 'INSERT FX', 'DROP A .MID'],
  },
  'step-bass': {
    visual: 'filter',
    accent: false,
    status: 'NEW',
    eyebrow: 'BASSLINE',
    chips: ['16 STEPS', 'ACCENT · SLIDE', 'DIODE LADDER', 'WAV · MIDI'],
  },
};

export const demoCardsCopy = {
  en: {
    prevLabel: 'Show previous demos',
    nextLabel: 'Show more demos',
    cta: 'Open demo',
    cards: {
      analyzer: {
        title: 'Visual Player',
        tagline: 'Audio player with real-time chroma & spectrum visualization.',
      },
      mastering: {
        title: 'Mastering Studio',
        tagline: 'Hit streaming loudness targets with presets. WAV export.',
      },
      analysis: {
        title: 'Music Analysis Studio',
        tagline: 'Structure, harmony, melody, loudness, and spectral views.',
      },
      mixing: {
        title: 'Mixing Studio',
        tagline: 'Up to eight stem tracks with scene JSON and WAV bounce.',
      },
      fx: {
        title: 'Realtime Voice Changer',
        tagline: 'Local microphone voice changer with library character presets.',
      },
      spatial: {
        title: 'Spatial Room Scanner',
        tagline: 'Estimate room geometry, reverb, and source distance in 3D from a recording.',
      },
      synth: {
        title: 'Synth Playground',
        tagline: 'Play the built-in polyphonic synth from your keyboard or a USB MIDI keyboard.',
      },
      studio: {
        title: 'Studio Mini',
        tagline: 'Step-sequence three tracks, mix them, and bounce the loop to WAV.',
      },
      practice: {
        title: 'Piano Practice',
        tagline:
          "libsonare's built-in synth and SoundFont engines render single-track MIDI on-device — practice with falling notes, a lit keyboard, and MIDI scoring.",
      },
      'gs-module': {
        title: 'GS Sound Module',
        tagline:
          'Sixteen parts, a sound each, one insertion effect — and your own .mid played through it, with every SysEx byte shown.',
      },
      'step-bass': {
        title: 'Step Bass',
        tagline:
          'A sixteen-step monophonic bass machine: one oscillator, a diode-ladder lowpass, and per-step accent and slide.',
      },
    },
  },
  ja: {
    prevLabel: '前のデモを表示',
    nextLabel: '次のデモを表示',
    cta: '開く',
    cards: {
      analyzer: {
        title: 'ビジュアルプレイヤー',
        tagline: 'クロマ・スペクトルをリアルタイム可視化するオーディオプレイヤー。',
      },
      mastering: {
        title: 'マスタリングスタジオ',
        tagline: 'プリセットで配信向けラウドネスへ。WAV 書き出し対応。',
      },
      analysis: {
        title: '楽曲分析スタジオ',
        tagline: '構造・ハーモニー・メロディ・ラウドネスとスペクトル表示。',
      },
      mixing: {
        title: 'ミキシングスタジオ',
        tagline: '最大 8 トラックのステムミキサー。シーン JSON とバウンスに対応。',
      },
      fx: {
        title: 'リアルタイムボイスチェンジャー',
        tagline: 'マイク入力のボイスチェンジャー。ライブラリのキャラクタープリセット対応。',
      },
      spatial: {
        title: '空間ルームスキャナー',
        tagline: '録音から部屋の形状・残響・音源までの距離を 3D 推定。',
      },
      synth: {
        title: 'シンセプレイグラウンド',
        tagline: '内蔵ポリフォニックシンセを PC キーボードや USB MIDI 鍵盤で演奏。',
      },
      studio: {
        title: 'スタジオミニ',
        tagline: '3 トラックをステップ入力し、ミックスして WAV にバウンスするミニ DAW。',
      },
      practice: {
        title: 'ピアノ練習',
        tagline:
          '1 トラック MIDI を libsonare 内蔵の合成音源／SoundFont 音源で端末内レンダリング。落下ノート、光る鍵盤、MIDI 採点で練習できます。',
      },
      'gs-module': {
        title: 'GS 音源モジュール',
        tagline:
          '16 パートにそれぞれ音色を割り当て、インサーションエフェクトを通し、手持ちの .mid を鳴らす。送っている SysEx も全部見えます。',
      },
      'step-bass': {
        title: 'ステップベース',
        tagline:
          '16 ステップのモノフォニック・ベースマシン。1 オシレータをダイオードラダー・ローパスに通し、ステップごとのアクセントとスライドを効かせます。',
      },
    },
  },
} satisfies Record<'en' | 'ja', DemoCardsCopy>;

export function buildDemoCards(copy: DemoCardsCopy, localizedPath: (path: string) => string) {
  return LISTED_DEMOS.map((demo) => ({
    id: demo.id,
    ...CARD_META[demo.id],
    path: localizedPath(demo.route),
    title: copy.cards[demo.id].title,
    tagline: copy.cards[demo.id].tagline,
    cta: copy.cta,
  }));
}
