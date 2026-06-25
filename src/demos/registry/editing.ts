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
  {
    id: 'formant-shift',
    archetype: 'param-sweep',
    config: { processor: 'formant-shift' },
    // The same sustained vowel as pitch-shift, so the two demos read as a matched pair:
    // there the comb slides; here it stays and only the envelope moves.
    source: { kind: 'clip', clip: 'vowel' },
    viz: 'waveform',
    title: {
      en: 'Formant shift — changing character, not pitch',
      ja: 'フォルマントシフト — 音程はそのまま、声の質感を変える',
    },
    caption: {
      en: "Formant shifting is pitch shift's counterpart: it moves the spectral envelope — the formant peaks that make a voice feel small and bright or large and dark — while leaving the note alone. Drag the factor and watch the harmonic comb and the fundamental marker hold their place as the envelope slides. Above 1.0 the voice brightens and shrinks; below 1.0 it darkens and enlarges; the pitch never changes. Press play to hear the character shift with no retuning.",
      ja: 'フォルマントシフトはピッチシフトの相方で、音程はそのままに、スペクトル包絡 — 声を小さく明るく、あるいは大きく暗く感じさせるフォルマントの山 — を動かします。係数をドラッグすると、倍音の櫛と基音マーカーは位置を保ったまま、包絡だけがスライドします。1.0 より上では声が明るく小さく、1.0 より下では暗く大きくなりますが、音程は変わりません。再生すると、音程を変えずに声の質感だけが動くのが聴けます。',
    },
    params: [
      {
        key: 'formant',
        kind: 'range',
        default: 1,
        min: 0.7,
        max: 1.4,
        step: 0.05,
        unit: '×',
        label: { en: 'Formant', ja: 'フォルマント' },
      },
    ],
  },
  {
    id: 'spectral-edit',
    archetype: 'spectral-edit',
    // A sustained pad gives a stable harmonic bed so the injected whistle — and the
    // surgical region edit that removes it — stand out cleanly in the spectrum.
    source: { kind: 'clip', clip: 'pad' },
    viz: 'spectrogram',
    title: {
      en: 'Spectral editing — erase one region, leave the rest',
      ja: 'スペクトル編集 — 一区画だけ消し、ほかは残す',
    },
    caption: {
      en: 'A steady pad is given a narrow whistle over a middle time window (Artifact). One `spectralEdit` region op — the same time x frequency rectangle the whistle occupies — removes it (Edited), and the averaged spectra show the in-band spike collapse while everything outside the shaded band is untouched. Switch the mode to compare attenuate (turn the bins down by gainDb), mute (silence them) and heal (rebuild them from neighbouring frames), and flip Compare to audition each side. NOTCH is the in-band reduction in dB.',
      ja: '安定したパッドの中間の時間帯に細い「ホイッスル」を乗せたものが「アーティファクト」です。`spectralEdit` の領域オペレーション一つ — ホイッスルが占める時間×周波数の矩形と同じ範囲 — でそれを取り除いたものが「編集後」で、平均スペクトルを見ると帯域内のスパイクだけが崩れ、網掛けの帯域の外はそのまま残ります。モードを切り替えると attenuate（gainDb 分だけビンを下げる）・mute（無音化する）・heal（隣接フレームから作り直す）を比べられ、Compare で両方を聴き比べできます。NOTCH は帯域内の低減量（dB）です。',
    },
    params: [
      {
        key: 'view',
        kind: 'select',
        default: 'artifact',
        label: { en: 'Compare', ja: '比較' },
        options: [
          { value: 'artifact', label: { en: 'Artifact', ja: 'アーティファクト' } },
          { value: 'edited', label: { en: 'Edited', ja: '編集後' } },
        ],
      },
      {
        key: 'mode',
        kind: 'select',
        default: 'heal',
        label: { en: 'Mode', ja: 'モード' },
        options: [
          { value: 'heal', label: { en: 'Heal', ja: 'ヒール' } },
          { value: 'mute', label: { en: 'Mute', ja: 'ミュート' } },
          { value: 'attenuate', label: { en: 'Attenuate', ja: 'アッテネート' } },
        ],
      },
    ],
  },
];
