/**
 * Demo definitions for the instruments cluster (native-synth, soundfont-player).
 *
 * Definitions are data only — labels carry both locales so the i18n gate can verify
 * parity without a separate locale file. Add entries here; markdown references them
 * by `id` via `<SonareDemo id="..." />`.
 */

import type { SonareDemoDef } from '../types';

export const instrumentsDemos: SonareDemoDef[] = [
  {
    id: 'synth-note',
    archetype: 'synth',
    // The source field is unused for `synth` (the engine renders the note), but the
    // schema requires one; a matching tone keeps the intent readable.
    source: { kind: 'generate', signal: 'saw', freq: 220 },
    viz: 'waveform',
    title: {
      en: 'Shaping a note — oscillator, filter, envelope',
      ja: '音を形づくる — オシレーター・フィルター・エンベロープ',
    },
    caption: {
      en: 'The built-in synth renders a single A3. The outline is its amplitude envelope: raise the attack and the note fades in; lower the cutoff and the tone darkens. Press play to hear the patch.',
      ja: '内蔵シンセが A3 を1音レンダリングします。輪郭はその振幅エンベロープ。アタックを上げると音が徐々に立ち上がり、カットオフを下げると音色が暗くなります。再生でパッチを試聴できます。',
    },
    params: [
      {
        key: 'waveform',
        kind: 'select',
        default: 'saw',
        label: { en: 'Oscillator', ja: 'オシレーター' },
        options: [
          { value: 'sine', label: { en: 'Sine', ja: '正弦' } },
          { value: 'saw', label: { en: 'Saw', ja: 'ノコギリ' } },
          { value: 'square', label: { en: 'Square', ja: '矩形' } },
          { value: 'triangle', label: { en: 'Triangle', ja: '三角' } },
        ],
      },
      {
        key: 'cutoff',
        kind: 'range',
        default: 2200,
        min: 200,
        max: 8000,
        step: 50,
        unit: 'Hz',
        label: { en: 'Cutoff', ja: 'カットオフ' },
      },
      {
        key: 'attack',
        kind: 'range',
        default: 8,
        min: 1,
        max: 400,
        step: 1,
        unit: 'ms',
        label: { en: 'Attack', ja: 'アタック' },
      },
    ],
  },
  {
    id: 'synth-adsr',
    archetype: 'synth',
    // Source is unused for `synth`; a matching tone keeps the intent readable.
    source: { kind: 'generate', signal: 'saw', freq: 220 },
    viz: 'waveform',
    title: {
      en: 'ADSR envelope — how a note rises and falls',
      ja: 'ADSR エンベロープ — 音の立ち上がりと減衰',
    },
    caption: {
      en: 'The same held A3, shaped by its amplitude envelope. Attack and decay set how the note reaches and leaves its peak; sustain is the level it holds while a key is down; release is the fade after the key lifts. The top outline is that envelope — drag a control and watch the shape, then press play to hear it. (Sustain cannot reach a true zero here: the engine reads 0 as "leave the preset value", so the slider stops just above it.)',
      ja: '同じ A3 を、振幅エンベロープで形づくります。アタックとディケイは音がピークへ到達し離れる速さを、サステインはキーを押している間に保つレベルを、リリースはキーを離した後の減衰を決めます。上段の輪郭がそのエンベロープです。コントロールを動かして形を見て、再生で確かめてください。（ここではサステインを完全な 0 にはできません。エンジンは 0 を「プリセット値を保持」と解釈するため、スライダーは 0 の少し上で止まります。）',
    },
    params: [
      {
        key: 'attack',
        kind: 'range',
        default: 8,
        min: 1,
        max: 400,
        step: 1,
        unit: 'ms',
        label: { en: 'Attack', ja: 'アタック' },
      },
      {
        key: 'decay',
        kind: 'range',
        default: 140,
        min: 1,
        max: 600,
        step: 1,
        unit: 'ms',
        label: { en: 'Decay', ja: 'ディケイ' },
      },
      {
        key: 'sustain',
        kind: 'range',
        default: 0.75,
        min: 0.02,
        max: 1,
        step: 0.01,
        label: { en: 'Sustain', ja: 'サステイン' },
      },
      {
        key: 'release',
        kind: 'range',
        default: 280,
        min: 1,
        max: 1200,
        step: 1,
        unit: 'ms',
        label: { en: 'Release', ja: 'リリース' },
      },
    ],
  },
  {
    id: 'synth-tremolo',
    archetype: 'synth',
    // Source is unused for `synth`; a matching tone keeps the intent readable.
    source: { kind: 'generate', signal: 'saw', freq: 220 },
    viz: 'waveform',
    title: {
      en: 'LFO tremolo — modulation you can see',
      ja: 'LFO トレモロ — 目に見える変調',
    },
    caption: {
      en: 'An LFO (low-frequency oscillator) is too slow to hear as a pitch; instead it moves something else. Here LFO 1 is routed to amplitude — tremolo — so the envelope ripples instead of holding flat. Rate sets how fast it pulses; depth sets how far. Turn depth to zero and the ripple disappears, leaving the plain held note. Press play to hear the pulsing. This is one routing in the mod matrix; the same LFO aimed at pitch would be vibrato, at the cutoff a filter wobble.',
      ja: 'LFO（低周波オシレーター）はピッチとして聴くには遅すぎ、代わりに別の何かを動かします。ここでは LFO 1 を振幅に接続 — トレモロ — しているので、エンベロープが平らに保たれず波打ちます。レートは脈打つ速さを、深さはその振れ幅を決めます。深さを 0 にすると波打ちが消え、ただの持続音になります。再生すると脈動が聴けます。これはモッドマトリクスの 1 接続で、同じ LFO をピッチに向ければビブラート、カットオフに向ければフィルターのうねりになります。',
    },
    params: [
      {
        key: 'lfoRate',
        kind: 'range',
        default: 6,
        min: 0.5,
        max: 12,
        step: 0.5,
        unit: 'Hz',
        label: { en: 'Rate', ja: 'レート' },
      },
      {
        key: 'lfoDepth',
        kind: 'range',
        default: 0.6,
        min: 0,
        max: 1,
        step: 0.05,
        label: { en: 'Depth', ja: '深さ' },
      },
    ],
  },
  {
    id: 'synth-filter',
    archetype: 'synth',
    // A saw is the most harmonically rich oscillator, so the lowpass has the most to
    // act on; the bottom scope shows the high end rolling off as the cutoff drops.
    source: { kind: 'generate', signal: 'saw', freq: 220 },
    viz: 'waveform',
    title: {
      en: 'Lowpass filter — cutoff, resonance, and model',
      ja: 'ローパスフィルター — カットオフ・レゾナンス・モデル',
    },
    caption: {
      en: 'A sawtooth through a lowpass filter — the single most recognizable synth gesture. Lower the cutoff and the high harmonics roll off, so the tone darkens; raise the resonance and the filter rings at the cutoff, adding the vocal "wah". The model selects the filter circuit being emulated: the SVF stays clean, while the ladder and Sallen-Key models saturate and can self-oscillate at high resonance. The bottom scope is the waveshape; press play to hear it.',
      ja: 'ノコギリ波をローパスフィルターに通します。シンセで最も象徴的な操作です。カットオフを下げると高次の倍音が削れて音色が暗くなり、レゾナンスを上げるとフィルターがカットオフ付近で共振して「ワウ」がかかります。モデルは模倣するフィルター回路を選びます。SVF はクリーンなまま、ラダーや Sallen-Key はサチュレーションがかかり、高いレゾナンスでは自己発振します。下段のスコープは波形です。再生して聞いてください。',
    },
    params: [
      {
        key: 'cutoff',
        kind: 'range',
        default: 2200,
        min: 200,
        max: 8000,
        step: 50,
        unit: 'Hz',
        label: { en: 'Cutoff', ja: 'カットオフ' },
      },
      {
        key: 'resonance',
        kind: 'range',
        default: 3,
        min: 0.7,
        max: 14,
        step: 0.1,
        label: { en: 'Resonance', ja: 'レゾナンス' },
      },
      {
        key: 'filterModel',
        kind: 'select',
        default: 'svf',
        label: { en: 'Filter model', ja: 'フィルターモデル' },
        options: [
          { value: 'svf', label: { en: 'SVF', ja: 'SVF' } },
          { value: 'moog-ladder', label: { en: 'Moog ladder', ja: 'Moog ラダー' } },
          { value: 'diode-ladder', label: { en: 'Diode ladder', ja: 'ダイオードラダー' } },
          { value: 'sallen-key', label: { en: 'Sallen-Key', ja: 'Sallen-Key' } },
        ],
      },
    ],
  },
  {
    id: 'midi-piano-roll',
    archetype: 'piano-roll',
    // Source is unused for `piano-roll` (the engine sequences the MIDI passage and
    // bounces it), but the schema requires one; a melodic tone keeps the intent clear.
    source: { kind: 'generate', signal: 'triangle', freq: 262 },
    viz: 'overlay',
    title: {
      en: 'A MIDI passage — same notes, any instrument',
      ja: 'MIDI のフレーズ — 同じ音符を、どの楽器でも',
    },
    caption: {
      en: 'A three-voice phrase — melody, chords, and bass — drawn as a piano roll. The notes never change; switch the instrument and the engine bounces the exact same MIDI through a different built-in voice. Drag the tempo and the whole sequence speeds up or slows down. Press play to hear the passage; the playhead tracks the audio.',
      ja: '旋律・和音・低音の3声フレーズをピアノロールで表示します。音符はそのまま、楽器を切り替えると、まったく同じ MIDI をエンジンが別の内蔵音色でバウンスします。テンポを動かせばシーケンス全体が速く・遅くなります。再生でフレーズを試聴でき、再生ヘッドは音声に追従します。',
    },
    params: [
      {
        key: 'instrument',
        kind: 'select',
        default: 'acoustic-piano',
        label: { en: 'Instrument', ja: '楽器' },
        options: [
          { value: 'acoustic-piano', label: { en: 'Piano', ja: 'ピアノ' } },
          { value: 'e-piano', label: { en: 'E-Piano', ja: 'エレピ' } },
          { value: 'harp', label: { en: 'Harp', ja: 'ハープ' } },
          { value: 'marimba', label: { en: 'Marimba', ja: 'マリンバ' } },
        ],
      },
      {
        key: 'tempo',
        kind: 'range',
        default: 100,
        min: 60,
        max: 168,
        step: 1,
        unit: 'BPM',
        label: { en: 'Tempo', ja: 'テンポ' },
      },
    ],
  },
  {
    id: 'midi-score',
    archetype: 'score',
    // Source is unused for `score` (the engine sequences the MIDI phrase and bounces
    // it); the schema requires one, and a melodic tone keeps the intent readable.
    source: { kind: 'generate', signal: 'triangle', freq: 262 },
    viz: 'overlay',
    title: {
      en: 'The same MIDI, written as a score',
      ja: '同じ MIDI を、楽譜で読む',
    },
    caption: {
      en: 'The very same kind of MIDI phrase — a melody over a bass line — engraved as standard notation on a grand staff. Notes, durations, beams, and the clefs are read straight from the MIDI the engine plays; switch the instrument and the identical notes sound through a different built-in voice, drag the tempo and the reading speeds up. Press play to hear it: each note lights up the instant it sounds.',
      ja: '同じ種類の MIDI フレーズ（低音の上に旋律）を、大譜表に標準記譜したものです。音符・音価・連桁・音部記号は、エンジンが鳴らす MIDI からそのまま起こしています。楽器を切り替えれば同一の音符が別の内蔵音色で鳴り、テンポを動かせば演奏が速くなります。再生すると、各音符が鳴った瞬間に光ります。',
    },
    params: [
      {
        key: 'instrument',
        kind: 'select',
        default: 'acoustic-piano',
        label: { en: 'Instrument', ja: '楽器' },
        options: [
          { value: 'acoustic-piano', label: { en: 'Piano', ja: 'ピアノ' } },
          { value: 'e-piano', label: { en: 'E-Piano', ja: 'エレピ' } },
          { value: 'harp', label: { en: 'Harp', ja: 'ハープ' } },
          { value: 'marimba', label: { en: 'Marimba', ja: 'マリンバ' } },
        ],
      },
      {
        key: 'tempo',
        kind: 'range',
        default: 96,
        min: 60,
        max: 160,
        step: 1,
        unit: 'BPM',
        label: { en: 'Tempo', ja: 'テンポ' },
      },
    ],
  },
];
