/**
 * Demo definitions for the editing/DSP cluster (editing-dsp, pitch/stretch glossary).
 *
 * Definitions are data only — labels carry both locales so the i18n gate can verify
 * parity without a separate locale file. Add entries here; markdown references them
 * by `id` via `<SonareDemo id="..." />`.
 */

import type { SonareDemoDef } from '../types';

export const editingDemos: SonareDemoDef[] = [
  {
    id: 'pitch-shift',
    archetype: 'param-sweep',
    // A sustained vowel (clean 220 Hz fundamental) makes the harmonic comb legible.
    source: { kind: 'clip', clip: 'vowel' },
    viz: 'waveform',
    title: {
      en: 'Pitch shift — moving the whole harmonic comb',
      ja: 'ピッチシフト — 倍音の櫛ごと動かす',
    },
    caption: {
      en: 'Pitch shifting transposes a sound without changing its length. Drag the semitones and watch the spectrum: every harmonic scales together and the fundamental marker tracks the new pitch. Because this shift is not formant-preserving, the formant bumps move too — the "chipmunk" effect. Press play to hear it.',
      ja: 'ピッチシフトは長さを変えずに音程を移します。セミトーンをドラッグするとスペクトルが動き、すべての倍音がまとめてスケールし、基音マーカーが新しい音程を追います。このシフトはフォルマント保存ではないため、フォルマントの山も一緒に動きます — いわゆる「チップマンク」効果です。再生で確認できます。',
    },
    params: [
      {
        key: 'semitones',
        kind: 'range',
        default: 0,
        min: -12,
        max: 12,
        step: 1,
        unit: 'st',
        label: { en: 'Pitch', ja: '音程' },
      },
    ],
  },
  {
    id: 'time-stretch',
    archetype: 'param-sweep',
    config: { processor: 'time-stretch' },
    // A drum groove makes the length change obvious: the hits spread or bunch up.
    source: { kind: 'clip', clip: 'drum' },
    viz: 'waveform',
    title: {
      en: 'Time stretch — changing length, not pitch',
      ja: 'タイムストレッチ — 音程はそのまま、長さを変える',
    },
    caption: {
      en: "Time stretching is pitch shift's exact opposite: it changes how long the audio lasts while leaving the pitch alone. Drag the rate and the drum hits spread out or bunch up — the waveform fills more or less of the panel — but the spectrum below barely moves. Below 1.0 the clip slows down and grows; above 1.0 it speeds up and shrinks. Press play to hear the groove change tempo with no chipmunk effect.",
      ja: 'タイムストレッチはピッチシフトのちょうど逆で、音程はそのままに、音の長さを変えます。レート（rate）をドラッグするとドラムの打点が広がったり詰まったりして波形がパネルを占める幅も変わりますが、下のスペクトルはほとんど動きません。1.0 より下では遅く長く、1.0 より上では速く短くなります。再生すると、チップマンク効果なしにグルーヴのテンポだけが変わるのが聴けます。',
    },
    params: [
      {
        key: 'rate',
        kind: 'range',
        default: 1,
        min: 0.5,
        max: 2,
        step: 0.05,
        unit: '×',
        label: { en: 'Rate', ja: 'レート' },
      },
    ],
  },
];
