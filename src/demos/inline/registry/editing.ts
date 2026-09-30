/**
 * Demo definitions for the editing/DSP cluster (editing-dsp, pitch/stretch glossary).
 *
 * Definitions are data only — labels carry localized copy so the i18n gate can verify
 * parity without a separate locale file. Add entries here; markdown references them
 * by `id` via `<SonareDemo id="..." />`.
 */

import type { SonareDemoDef } from '../types';

export const editingDemos: SonareDemoDef[] = [
  {
    id: 'audio-to-notes',
    archetype: 'transcribe',
    source: { kind: 'clip', clip: 'lead' },
    viz: 'overlay',
    title: {
      en: 'Audio to notes — recognize a melody',
      ja: '音声から音符へ — メロディを採譜する',
    },
    caption: {
      en: 'The library detects notes from this synthesized lead phrase. The roll shows the detected pitches and timing. Compare the original audio with those MIDI events rendered through the piano: the piano is synthesized from MIDI and does not preserve the input timbre. Detection is an estimate; inspect missed, extra or shifted notes before editing or exporting.',
      ja: '合成したリードの音声から、ライブラリが音符を検出します。ピアノロールには検出した音高と時刻を表示します。原音と、検出した MIDI イベントをピアノで再合成した音を比較してください。再合成の音色は入力の音色とは異なります。検出結果は推定なので、編集や書き出しの前に音符の抜け・余分な音符・位置のずれを確認してください。',
    },
    params: [
      {
        key: 'view',
        kind: 'select',
        default: 'original',
        label: { en: 'Compare', ja: '比較' },
        options: [
          { value: 'original', label: { en: 'Original audio', ja: '原音' } },
          { value: 'notes', label: { en: 'Detected notes → Piano', ja: '検出した音符 → ピアノ' } },
        ],
      },
    ],
  },
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
      en: 'Time stretching changes duration while keeping pitch approximately unchanged. A rate below 1 slows and lengthens the clip; a rate above 1 speeds and shortens it. The waveform shows the duration change. Each render is peak-normalized for headroom, which does not equalize perceived loudness. Listen for changes in timing and transient clarity.',
      ja: 'タイムストレッチは、音程をほぼ保ちながら長さを変えます。レートが 1 未満なら遅く長く、1 より大きければ速く短くなります。波形の幅で長さの変化を確認できます。各レンダーはピークを揃えていますが、知覚上の音量まで一致するわけではありません。タイミングと立ち上がりの明瞭さを聴き比べてください。',
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
      ja: 'フォルマントシフトはピッチシフトと対になる処理で、音程はそのままに、スペクトル包絡 — 声を小さく明るく、あるいは大きく暗く感じさせるフォルマントの山 — を動かします。係数をドラッグすると、倍音の櫛と基音マーカーは位置を保ったまま、包絡だけがスライドします。1.0 より上では声が明るく小さく、1.0 より下では暗く大きくなりますが、音程は変わりません。再生すると、音程を変えずに声の質感だけが動くのが聴けます。',
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
      en: 'A narrow whistle is added to the middle of a pad. Edit its time–frequency region with spectralEdit and compare attenuate, mute and heal. The selected STFT bins change; overlapping analysis windows and reconstruction can spread changes near region boundaries. Heal estimates the content from neighbouring frames rather than recovering the original lost signal. NOTCH shows the in-band reduction in dB.',
      ja: 'パッドの途中に細い笛のような音を加えています。spectralEdit で時間・周波数の領域を選び、attenuate（減衰）・mute（無音化）・heal（補間）を比較してください。選んだ STFT ビンを編集しますが、分析窓の重なりと再構成により、領域の境界付近にも影響が広がります。heal は隣接フレームから内容を推定する処理で、失われた元の音を復元するものではありません。NOTCH は帯域内の低減量（dB）です。',
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
  {
    id: 'tempo-grid',
    archetype: 'tempo-grid',
    // No clip: the bar/beat grid and the metronome click are computed from the tempo.
    source: { kind: 'generate', signal: 'sine', freq: 1760 },
    viz: 'overlay',
    title: {
      en: 'Tempo and the grid — how BPM maps musical time to seconds',
      ja: 'テンポとグリッド — BPM で小節・拍を秒に換算する仕組み',
    },
    caption: {
      en: 'The seconds axis on top never moves; the bar-and-beat grid below is computed from the tempo. Drag BPM and the grid slides — a faster tempo packs more bars into the same six seconds, a slower one spreads them out. The readout turns the tempo into the durations the engine actually counts in: one bar, one beat, and one tick at PPQ 480, the resolution libsonare uses for MIDI timing. Change the beats per bar to reshape where the accented downbeats land. Press play for a metronome at the chosen tempo — the grid you see is the click you hear.',
      ja: '上の秒の目盛りは動きません。下の小節・拍のグリッドはテンポから計算されます。BPM をドラッグするとグリッドが動き、速いテンポは同じ 6 秒により多くの小節を詰め込み、遅いテンポは広げます。数値表示では、テンポをエンジンが実際に数える単位の長さに換算します。1 小節・1 拍、そして PPQ 480（libsonare が MIDI のタイミングに使う分解能）での 1 ティックです。1 小節の拍数を変えると、アクセントの付く強拍の位置が変わります。再生すると選んだテンポのメトロノームが鳴ります — 見えているグリッドが、そのまま聞こえるクリックです。',
    },
    params: [
      {
        key: 'bpm',
        kind: 'range',
        default: 120,
        min: 60,
        max: 180,
        step: 1,
        unit: 'BPM',
        label: { en: 'Tempo', ja: 'テンポ' },
      },
      {
        key: 'beats',
        kind: 'select',
        default: '4',
        label: { en: 'Beats / bar', ja: '1 小節の拍数' },
        options: [
          { value: '3', label: { en: '3/4', ja: '3/4' } },
          { value: '4', label: { en: '4/4', ja: '4/4' } },
          { value: '6', label: { en: '6/8', ja: '6/8' } },
        ],
      },
    ],
  },
  {
    id: 'pitch-correct',
    archetype: 'pitch-correct',
    // No clip: the raw take is synthesized off-pitch in the component so there is
    // something for correction to fix (the shipped clips are already in tune). The
    // source is unused by this archetype but the schema requires one.
    source: { kind: 'generate', signal: 'triangle', freq: 262 },
    viz: 'overlay',
    title: {
      en: 'Pitch correction — snapping a shaky take to a scale',
      ja: 'ピッチ補正 — ゆれた歌を音階へ寄せる',
    },
    caption: {
      en: 'The raw take is a deliberately out-of-tune vocal: a C-major melody sung a little sharp or flat on every note (the amber line wanders off the grid). Pitch correction measures the pitch frame by frame and snaps each note toward the nearest tone of the chosen scale — the teal line settles onto the gridlines. Retune strength sets how far it pulls (0 leaves the natural drift, 1 is a hard robotic snap) and retune speed sets how quickly it slides there — a fast glide can sound mechanical, a slow one keeps the phrasing. Flip Compare to hear the raw take against the tuned one; the root stays C.',
      ja: '素の歌は、わざと音を外したボーカルです。C メジャーのメロディを一音ごとに少し高め・低めに歌っていて、アンバーの線がグリッドから外れて動きます。ピッチ補正はピッチをフレームごとに測り、各音を選んだスケールの最も近い音へ寄せます。ティールの線がグリッド線に収まっていきます。補正の強さは寄せる度合いで、0 は自然なゆれを残し、1 は硬いロボット的なスナップになります。補正の速さは寄る速さで、速いと機械的に、遅いと歌い回しが残ります。Compare で素の歌と補正後を聴き比べできます。ルートは C のままです。',
    },
    params: [
      {
        key: 'retuneAmount',
        kind: 'range',
        default: 1,
        min: 0,
        max: 1,
        step: 0.05,
        label: { en: 'Retune strength', ja: '補正の強さ' },
      },
      {
        key: 'retuneSpeedMs',
        kind: 'range',
        default: 15,
        min: 5,
        max: 80,
        step: 5,
        unit: 'ms',
        label: { en: 'Retune speed (ms)', ja: '補正の速さ (ms)' },
      },
      {
        key: 'scale',
        kind: 'select',
        default: 'major',
        label: { en: 'Scale', ja: 'スケール' },
        options: [
          { value: 'major', label: { en: 'C major', ja: 'C メジャー' } },
          { value: 'minor', label: { en: 'C minor', ja: 'C マイナー' } },
        ],
      },
      {
        key: 'view',
        kind: 'select',
        default: 'tuned',
        label: { en: 'Compare', ja: '比較' },
        options: [
          { value: 'raw', label: { en: 'Raw', ja: '素の歌' } },
          { value: 'tuned', label: { en: 'Tuned', ja: '補正後' } },
        ],
      },
    ],
  },
];
