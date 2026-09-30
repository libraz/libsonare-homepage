---
title: 音声内の音符を編集する
description: 音声から計測した音符を抽出し、NoteObject を編集して音声へレンダリングします。
---

# 音声内の音符を編集する

このワークフローがレンダリングするのは編集済みの音声です。プロジェクトの MIDI クリップは変更しません。素材と編集の種類に応じて経路を選びます。

| 素材または参照 | 経路 |
|---|---|
| 1 声または 1 本のメロディ | `pitchPyin` → `extractNotes` → `NoteEdit` を編集 → `renderNotes` |
| 打撃音 | `extractPercussiveEvents` → 時間／ゲイン／ミュートを編集 → `renderPercussiveEvents` |
| 重なった音高を持つ音声 | `analyzePolyphonic` → `notes()` / `setNoteEdit` → `render()` → `destroy()` |
| SMF に書かれたメロディ | `noteTargetsFromSmf` + `assignNoteTargets` → `renderNotes` |

ノート編集はサンプル区間と計測ピッチを使います。ノート境界を使わず、バッファ全体へピッチや時間の変換をかける場合は[編集 DSP](./editing-dsp.md)を使います。

以下の例では、`samples` は指定した `sampleRate` でデコードしたモノラルの `Float32Array` だとします。ブラウザ／WASM 版では解析関数を使う前に `init()` を呼び、プレースホルダーをデコード済みの録音へ置き換えてください。

<FlowDiagram
  title="ノートを計測し、編集して音声へレンダリングする"
  :nodes="[
    { id: 'audio', label: 'モノラル音声', col: 0, row: 0 },
    { id: 'analysis', label: 'ピッチ／ノート解析', col: 1, row: 0, variant: 'accent' },
    { id: 'edits', label: 'NoteEdit の変更', col: 2, row: 0 },
    { id: 'render', label: 'レンダリング済み音声', col: 3, row: 0, variant: 'success' }
  ]"
  :edges="[
    { from: 'audio', to: 'analysis' },
    { from: 'analysis', to: 'edits' },
    { from: 'edits', to: 'render' }
  ]"
  caption="ノート編集は音声を計測し、ノート区間を変更して新しい音声バッファへレンダリングします。Project の MIDI クリップは編集しません。"
/>

## モノフォニックテイクを抽出してレンダリングする

`pitchPyin` が F0 トラックを作り、`extractNotes` がそのトラックと有声音フラグを `NoteObject[]` へ変換します。各オブジェクトはサンプル／フレーム境界、`medianHz`、振幅、保留中の `edit` を持ちます。edit を変更してリストを `renderNotes` へ渡します。

::: code-group

```typescript [ブラウザ / WASM]
import { extractNotes, init, pitchPyin, renderNotes } from '@libraz/libsonare';

await init();
const sampleRate = 48000;
const samples = new Float32Array(sampleRate * 2); // デコード済みの 48 kHz モノラル PCM に置き換える
const pitch = pitchPyin({ samples, sampleRate, hopLength: 512 });
const notes = extractNotes({
  samples,
  sampleRate,
  f0Hz: pitch.f0,
  voiced: pitch.voicedFlag,
  frameRate: sampleRate / 512,
  minNoteMs: 40,
});
if (notes.length >= 1) notes[0].edit.pitchShiftSemitones = 1;
if (notes.length >= 2) notes[1].edit.muted = true;
const edited = renderNotes({ samples, sampleRate, notes, fadeMs: 10 });
```

```python [Python]
import libsonare as sonare

sample_rate = 48000
samples = [0.0] * (sample_rate * 2)  # デコード済みの 48 kHz モノラル PCM に置き換える
pitch = sonare.pitch_pyin(samples, sample_rate=sample_rate, hop_length=512)
notes = sonare.extract_notes(
    samples,
    sample_rate,
    pitch.f0,
    sample_rate / 512,
    voiced=pitch.voiced_flag,
    min_note_ms=40,
)
if len(notes) >= 1:
    notes[0].edit.pitch_shift_semitones = 1.0
if len(notes) >= 2:
    notes[1].edit.muted = True
edited = sonare.render_notes(samples, sample_rate, notes, fade_ms=10)
```

:::

恒等編集 なら元の区間をそのまま通します。`renderNotes` の音声は入力と同じ長さとサンプルレートを持ちます。編集したノートの境界には等電力クロスフェードを使い、既定は 5 ms です。ソース区間は重なれません。移動または伸長したノートが隣のサンプルへ書き込むことがあり、両端を越えた出力は切り詰められます。

`NoteEdit` はサンプル移動、半音シフト、dB ゲイン、時間伸縮、フォルマントシフト、ミュート、振幅エンベロープ、ドリフト／ビブラート変更を扱います。カーブ編集（`vibratoDepthChange` と `driftChange`）には、レンダーリクエストにも元の `f0Hz` トラックと `frameRate` が必要です。`extractNotes` は有声音フラグまたは有声音確率を受け付けます。0 以下または有限でない F0 フレームはピッチの計測に使いません。

## 保持する解析で重なった声を編集する

`analyzePolyphonic` はスペクトログラムとノートごとの帰属セットをネイティブハンドルに保持します。返るノートは同じ `NoteObject` 形式で、`setNoteEdit(index, edit)` が保留中の編集だけを変更します。`render()` は入力と同じ長さの音声を返します。ハンドルは大きなメモリを所有するため、編集対象の区間だけを解析し、終わったら `destroy()` / `delete()` で解放します。Python では `with PolyphonicAnalysis.analyze(...)` または `close()` を使えます。

::: code-group

```typescript [ブラウザ / WASM]
import { analyzePolyphonic, init } from '@libraz/libsonare';

await init();
const sampleRate = 48000;
const samples = new Float32Array(sampleRate * 2); // デコード済みの 48 kHz モノラル PCM に置き換える
const analysis = analyzePolyphonic({ samples, sampleRate, maxPolyphony: 3 });
try {
  const notes = analysis.notes();
  if (notes.length > 0) {
    const lowest = notes.reduce((a, b) => (a.medianHz <= b.medianHz ? a : b));
    analysis.setNoteEdit(notes.indexOf(lowest), { pitchShiftSemitones: 1 });
  }
  const edited = analysis.render({ fadeMs: 10 });
} finally {
  analysis.destroy();
}
```

```python [Python]
import libsonare as sonare

sample_rate = 48000
samples = [0.0] * (sample_rate * 2)  # デコード済みの 48 kHz モノラル PCM に置き換える
with sonare.PolyphonicAnalysis.analyze(samples, sample_rate, max_polyphony=3) as analysis:
    notes = analysis.notes()
    if notes:
        edit = notes[0].edit
        edit.gain_db = -6.0
        analysis.set_note_edit(0, edit)
    edited = analysis.render(fade_ms=10)
```

:::

編集が identity の新しいポリフォニック解析をレンダリングすると、解析の STFT 再構成を含む往復結果になります。入力とバイト単位で同じになるわけではありません。保持するスペクトログラムと帰属セットは解析区間に応じて増えるため、短い区間を単位にし、解放したハンドルを再利用しないでください。

## SMF を参照メロディにする: ノートターゲット


SMF は録音テイクの参照メロディとして使えます。`noteTargetsFromSmf` と `assignNoteTargets` はモジュールレベル関数です。前者はメモリ上の SMF からターゲットを読み、後者は `extractNotes` で得たノートに適用します。[編集 DSP](./editing-dsp.md) の `pitchCorrectToMidi` はバッファ全体に 1 つの音程差を適用しますが、このワークフローはノートごとにターゲットを割り当てます。

**ノート**（`NoteObject`）はサンプル区間と計測された `medianHz` を持ちます。**ノートターゲット**（`NoteTarget`）は `{ startSec, endSec, targetMidi }` です。対応づけは配列のインデックスではなく時刻で行われ、ターゲットは計測ピッチを持ちません。ターゲットの時刻は PPQ ではなく、**ノートを解析した音声の先頭からの秒数**です。SMF の 4 分音符単位の境界は、`noteTargetsFromSmf` がファイルのテンポマップ（段階的なテンポ変更を含む）で秒へ変換します。

`noteTargetsFromSmf({ data, trackIndex? })` はメモリ上の SMF から 1 トラックを読み、`startSec` 順の `NoteTarget[]` を返します。各ノートオンは同じチャンネル・同じノート番号の次のノートオフと対にされ、最初のノートオフより前の再トリガーでは新しい方の発音が閉じられます。各対がノート自身のピッチを持つターゲットになります。閉じられないノートオンと長さ 0 のノートは除外されます。閉じたノートがないトラックは空配列を返します。`trackIndex`（既定 `0`）はファイル自身のトラック番号ではなく、**MIDI イベントを含むトラックだけ**を数えます。メタイベントしか持たないトラック（`exportSmf` がトラック 0 に書き出すコンダクタートラックなど）は数えません。読めないバイト列は `InvalidFormat`、MIDI を含むトラックが存在しないインデックスは `InvalidParameter` を送出します。

`assignNoteTargets({ notes, sampleRate, targets, unmatchedPolicy?, minOverlapRatio?, maxCorrectionSemitones? })` は、重なりがノート自身の長さの `minOverlapRatio`（既定 `0.5`）以上である場合に、最も長く重なるターゲットを選びます。同じ長さなら開始の早いターゲットを選びます。対応づいたノートの `edit.pitchShiftSemitones` には、`targetMidi` と計測ピッチの MIDI ノート番号との差を書き込み、`maxCorrectionSemitones`（既定 `12`）でクランプします。`sampleRate` は `onsetSample` / `offsetSample` を秒へ変換するため、テイク自身のレートを渡してください。ピッチがありターゲットがないノートは `unmatchedPolicy` に従います。

| `unmatchedPolicy` | ターゲットのない有音ノートの扱い |
|-------------------|----------------------------------|
| `'leave'`（既定） | 編集に触れず、録音どおりにレンダリングする |
| `'mute'` | `edit.muted` を立てる |
| `'nearest'` | どれだけ離れていても、時間的に最も近いターゲットを採る |

`medianHz` が有限の正の値でないノートは、割り当ても編集もされません。入力のノートは変更されません。結果は `{ notes, assignedCount }` で、`edit.pitchShiftSemitones` と `edit.muted` だけが書き換えられた新しい配列と、ターゲットを受け取ったノートの数を返します。`assignedCount` は `0` になることがあります。

```typescript
import { assignNoteTargets, extractNotes, noteTargetsFromSmf, pitchPyin, renderNotes } from '@libraz/libsonare';

// 1. 参照: プロジェクト自身の書き出し、または Uint8Array に読み込んだ任意の .mid ファイル。
const targets = noteTargetsFromSmf({ data: project.exportSmf() }); // メロディは trackIndex 0

// 2. テイク: F0 トラックの上でノートに切り出す。
const pitch = pitchPyin({ samples, sampleRate, hopLength: 512 });
const notes = extractNotes({
  samples, sampleRate, f0Hz: pitch.f0, voiced: pitch.voicedFlag, frameRate: sampleRate / 512,
});

// 3. 両者を突き合わせ、対応づいた各ノートにピッチシフトを書き込む。
const { notes: retuned, assignedCount } = assignNoteTargets({
  notes, sampleRate, targets, unmatchedPolicy: 'mute',
});
if (assignedCount === 0) console.warn('参照がテイクと噛み合っていません');

// 4. 編集済みのノート集合をテイクの上にレンダリングし直す。
const corrected = renderNotes({ samples, sampleRate, notes: retuned });
```

Node も同じリクエストオブジェクトを受け取ります。Python は `note_targets_from_smf(data, *, track_index=0)` が `NoteTarget` データクラス（`start_sec`・`end_sec`・`target_midi`）のリストを返し、`assign_note_targets(notes, sample_rate, targets, *, unmatched_policy="leave", min_overlap_ratio=None, max_correction_semitones=None)` が `(notes, assigned_count)` のタプルを返します。C ABI は `sonare_note_targets_from_smf` / `sonare_assign_note_targets` です。SMF リーダーはアレンジメントライブラリ側にあるため、それを含まないビルドでは `NotSupported`（WASM ではラッパーの `Error`）となりますが、手で組んだターゲットに対する `assignNoteTargets` はそのまま使えます。

## 関連

- [音を MIDI ノートに変換する](./audio-to-notes.md) — 記号的なノートをプロジェクトへ書き込みます
- [編集 DSP](./editing-dsp.md) — バッファ全体の変換とリアルタイム音声処理を扱います
- [MIDI 2.0・UMP・クリップファイル](./midi2.md) — フル解像度の記号的 MIDI とクリップファイル交換を扱います
