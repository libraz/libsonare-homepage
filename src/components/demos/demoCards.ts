export type DemoVisual =
  | 'spectrum'
  | 'lufs'
  | 'chroma'
  | 'faders'
  | 'fx'
  | 'room'
  | 'keys'
  | 'steps'
  | 'fall';

export type DemoId =
  | 'analyzer'
  | 'mastering'
  | 'analysis'
  | 'mixing'
  | 'fx'
  | 'spatial'
  | 'synth'
  | 'studio'
  | 'practice';

export interface DemoEntry {
  id: DemoId;
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
  cards: Record<DemoId, { title: string; tagline: string }>;
}

const CARD_META: Array<
  Pick<DemoEntry, 'id' | 'visual' | 'status' | 'accent' | 'eyebrow' | 'chips'> & { route: string }
> = [
  {
    id: 'analyzer',
    route: '/analyzer',
    visual: 'spectrum',
    accent: false,
    status: 'LIVE',
    eyebrow: 'VISUAL PLAYER',
    chips: ['BPM', 'KEY', 'CHORD', 'SPECTRUM'],
  },
  {
    id: 'mastering',
    route: '/mastering',
    visual: 'lufs',
    accent: true,
    status: 'STUDIO',
    eyebrow: 'MASTERING',
    chips: ['LUFS', 'EQ', 'DYNAMICS', 'WAV'],
  },
  {
    id: 'analysis',
    route: '/music-analysis',
    visual: 'chroma',
    accent: false,
    status: 'STUDIO',
    eyebrow: 'ANALYSIS',
    chips: ['STRUCTURE', 'CHROMA', 'CQT', 'BEATS'],
  },
  {
    id: 'mixing',
    route: '/mixing',
    visual: 'faders',
    accent: false,
    status: 'STUDIO',
    eyebrow: 'MIXING',
    chips: ['8 TRACKS', 'PAN', 'WIDTH', 'BOUNCE'],
  },
  {
    id: 'fx',
    route: '/realtime-fx',
    visual: 'fx',
    accent: false,
    status: 'MIC',
    eyebrow: 'REALTIME FX',
    chips: ['PITCH', 'FORMANT', 'CHARACTER', 'PRESETS'],
  },
  {
    id: 'spatial',
    route: '/spatial',
    visual: 'room',
    accent: false,
    status: 'NEW',
    eyebrow: 'SPATIAL 3D',
    chips: ['RT60', 'GEOMETRY', 'DRR', '3D'],
  },
  {
    id: 'synth',
    route: '/synth',
    visual: 'keys',
    accent: false,
    status: 'NEW',
    eyebrow: 'INSTRUMENTS',
    chips: ['7 ENGINES', '16 PRESETS', 'MIDI', 'PATCH'],
  },
  {
    id: 'studio',
    route: '/studio',
    visual: 'steps',
    accent: false,
    status: 'NEW',
    eyebrow: 'HEADLESS DAW',
    chips: ['PROJECT', 'STEPS', 'MIX', 'BOUNCE'],
  },
  {
    id: 'practice',
    route: '/practice',
    visual: 'fall',
    accent: false,
    status: 'NEW',
    eyebrow: 'PLAY · LEARN',
    chips: ['MIDI', 'SOUNDFONT', 'FALLING NOTES', 'KEYBOARD'],
  },
];

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
          'Falling-note player for single-track MIDI, with a SoundFont piano and a lit keyboard.',
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
        tagline: 'プリセットで配信向けラウドネスへ。WAV書き出し対応。',
      },
      analysis: {
        title: '楽曲分析スタジオ',
        tagline: '構造・ハーモニー・メロディ・ラウドネスとスペクトル表示。',
      },
      mixing: {
        title: 'ミキシングスタジオ',
        tagline: '最大8トラックのステム・ミキサー。シーンJSONとバウンス。',
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
        tagline: '1トラックMIDIのノート落下プレイヤー。SoundFontピアノと光る鍵盤で。',
      },
    },
  },
} satisfies Record<'en' | 'ja', DemoCardsCopy>;

export function buildDemoCards(copy: DemoCardsCopy, localizedPath: (path: string) => string) {
  return CARD_META.map((card) => ({
    ...card,
    path: localizedPath(card.route),
    title: copy.cards[card.id].title,
    tagline: copy.cards[card.id].tagline,
    cta: copy.cta,
  }));
}
