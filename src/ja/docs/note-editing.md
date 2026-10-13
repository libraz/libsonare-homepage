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

<SonareDemo id="melody-contour" />

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

`extractNotes` は `noteSegments` と同じセグメンターを使うため（[ノートセグメンテーション](./js-api-helpers.md#ノートセグメンテーション)）、ビブラートのかかった持続音は 1 つのノートのままです。オプションはすべて省略可能で、`0` または省略で既定値になります。

| オプション | 既定値 | 効果 |
|---|---|---|
| `segmentationThresholdCents` | `50` | 新しいノートを始めるピッチ変化量 |
| `minNoteMs` | `30` | ノートとして残す最短の長さ |
| `referenceHz` | `440` | ノートごとの `medianCents` を測る基準 |
| `voicedThreshold` | `0.5` | 有声とみなす `voicedProb` の水準。`voiced` を省略したときだけ読まれます |

例のように `pitch.voicedFlag` を `voiced` へ渡してください。pYIN の `voicedProb` は F0 が高いほど大きくなるため、既定のしきい値では低音域が落ちてしまいます。

恒等編集なら元の区間をそのまま通します。レンダリング前に編集対象のソース区間をすべてクリアし、ノート配列の順に書き込みます。宛先が重なる場合は後のノートが先のノートを上書きし、各編集境界には等電力クロスフェード（既定 5 ms）を使います。`renderNotes` の音声は入力と同じ長さとサンプルレートを持ちます。すべてのソース区間は `0 <= onsetSample < offsetSample <= samples.length` を満たし、ソース区間同士も重なってはいけません。無効な区間は拒否します。移動または伸長したノートが隣のサンプルへ書き込むことはありますが、宛先への書き込みは出力バッファの範囲にクリップされ、両端を越えた出力は切り詰められます。ミュートしたノートはソース区間をクリアしますが、ほかのノートがレンダリングした宛先は消しません。有限でない音声サンプルは拒否します。`gainDb` と振幅エンベロープの各値は有限でなければならず、エンベロープは負にできません。ゲインとエンベロープを掛けた結果が有限でない場合も拒否します。

`NoteEdit` のフィールドはすべて省略可能で、省略した値は変化なしとして扱われます。

| フィールド | 効果 | 変化なしの値 | `f0Hz`/`frameRate` の要否 |
|---|---|---|---|
| `timeOffsetSamples` | ノートを時間軸上で動かす。負の値は前へ移動 | `0` | 不要 |
| `pitchShiftSemitones` | ノートを移調する | `0` | 不要 |
| `gainDb` | レベルの変更 | `0` | 不要 |
| `timeStretchRatio` | 長さの比。`1` より大きいと長くなり、ピッチは保たれる | `1`（`0` は `1` として扱う） | 不要 |
| `formantShiftSemitones` | ピッチシフトに加えてスペクトル包絡を動かす | `0` | 不要 |
| `vibratoDepthChange` | 計測したビブラート深さの変化量。`-1` で平坦、`+1` で 2 倍 | `0` | 必要 |
| `driftChange` | ノートの中心ピッチまわりのゆっくりしたドリフトに対する同じ変化量 | `0` | 必要 |
| `muted` | 区間を無音にする。ほかのフィールドは適用されない | `false` | 不要 |
| `amplitudeEnvelope` | レンダリング後のノートの長さに引き伸ばされるゲイン点列。`gainDb` に上乗せされる | 空（なし） | 不要 |

カーブ編集（`vibratoDepthChange`、`driftChange`）には、レンダリングリクエストにも元の `f0Hz` トラックと `frameRate` が必要で、JS/WASM では `f0Hz` を `Float32Array` にします。任意の `voiced` フラグ配列を渡す場合は `f0Hz` と同じ長さにします。`false` は正の F0 も抑制し、`true` でも利用できない F0 は有効になりません。`decomposeNotePitch` も同じフラグを受け付けます。`extractNotes` は有声音フラグまたは有声音確率を受け付け、0 以下または有限でない F0 フレームはピッチの計測に使いません。

### 秒指定とサンプル指定

`renderNotes` や `renderPercussiveEvents` に渡すノートまたはパーカッシブイベントは、区間の各境界をサンプル（`onsetSample`、`offsetSample`）または秒（`onsetSec`、`offsetSec`）で、編集の移動量を `timeOffsetSamples` または `timeOffsetSec`（負の値は前へ移動）で指定できます。秒は呼び出しのサンプルレートで最も近いサンプルに丸められます。各境界はどちらか一方の表記だけを渡してください。両方を渡すと拒否されます。Python では `onset_sec`、`offset_sec`、`time_offset_sec` です。編集呼び出しごとの表記は[編集 DSP](./editing-dsp.md#サンプル指定と秒指定)にまとめています。

```typescript
const edited = renderNotes({
  samples,
  sampleRate,
  notes: [{ onsetSec: 0.25, offsetSec: 0.75, edit: { timeOffsetSec: 0.1 } }],
});
```

負の `onsetSample` や `offsetSample` は拒否されます（WASM と Node は `RangeError`、Python は `SonareValueError`）。`-1` は「末尾まで」を表す値ではないので、入力の端を使うなら境界を省略してください。

### ノートの分割と結合

`splitNote` は 1 つのノートをトラックのフレーム位置で切り、`mergeNotes` は連続するノートを 1 つに結合します。どちらも `extractNotes` と同じ入力（`samples`、`sampleRate`、`f0Hz`、`voiced`、`frameRate`）と現在の `notes` を受け取り、新しいノート集合全体を返します。すべてのノートが音声とトラックから再導出されるためで、ノートはオブジェクトの同一性ではなく `frameStart` / `frameEnd` で識別されます。

```typescript
import { mergeNotes, splitNote } from '@libraz/libsonare';

const source = { samples, sampleRate, f0Hz: pitch.f0, voiced: pitch.voicedFlag, frameRate: sampleRate / 512 };
const middle = Math.floor((notes[0].frameStart + notes[0].frameEnd) / 2);

const halves = splitNote({ ...source, notes, index: 0, frame: middle }); // ノートが 1 つ増える
const rejoined = mergeNotes({ ...source, notes: halves, first: 0, last: 1 }); // 元の個数に戻る
```

`frame` はノート区間の厳密に内側でなければならず、満たさない場合は `SonareError`（`InvalidParameter`）を投げます。`index` や `first < last < notes.length` の範囲がノート集合の外にある場合は、WASM と Node では `RangeError` です。結合したノートは最初のノートの開始から最後のノートの終了まで（間の隙間も含む）に及び、最初のノートの編集を引き継ぎます。ノートごとに編集が異なっていた場合は、結合後に編集を設定し直してください。Python では `split_note(samples, sample_rate, f0_hz, frame_rate, notes, index, frame, voiced=...)` と `merge_notes(..., notes, first, last, voiced=...)` です。

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

`reattackRatio` は、鳴っている間に同じ音高を弾き直したとき、それを 2 つ目のノートにするかどうかを決めます。解析は約 35 ms の範囲で読んだサリエンス（その音高がスペクトログラム上でどれだけ目立つか）が、直前のレベルのこの倍率を超えて立ち上がった位置で、保持されたノートを分割します。値は `1` より大きい必要があり、`0` または省略で分割を無効にします。そのため `analyzePolyphonic` は既定では、鳴り続けている同じ音高の繰り返しを 1 つの長いノートとして返します。既定値は `transcribe` と次のように異なります。

| オプション | `analyzePolyphonic` | `transcribe` |
|---|---|---|
| `maxPolyphony` | `4` | `10` |
| `reattackRatio` | 無効（`0`） | `2.0` |
| 受け付ける範囲 | `maxPolyphony` は `1..64`、`reattackRatio` は `1` より大きい値 | 同じ |

44.1 kHz で、220 Hz のトーンに減衰後のレベルの 3 倍で 2 回目の打鍵を重ねて解析すると、次のようになります。

| `reattackRatio` | 返るノート数 |
|---|---|
| 省略または `0` | 1（0.00 秒から 2.00 秒） |
| `1.5` または `2` | 2（1.02 秒で分割） |
| `4` または `10` | 1 |

1.5 倍の打鍵は `1.5` のときだけ分割され、8 倍の打鍵はレベルの急落でリッジ（音高がフレームをまたいで描く軌跡）がすでに終わっているため、どの設定でも分割されます。拾いたい打鍵と直前のレベルの比より少し小さい値を選んでください。`transcribe` は `2` を使います。小さくするとより弱い弾き直しも拾え、大きくすると結合されたままになります。その範囲内でその大きさのレベルの立ち上がりは、原因を問わず弾き直しとみなされるため、振幅が大きくうねる持続音も分割されます。範囲外の値（`0` より大きく `1` 以下、または負の値）は `InvalidParameter` を投げます。Python では `reattack_ratio` で渡します。`transcribe` での同じオプションは[音声からノートへ](./audio-to-notes.md#オプションと制限)を参照してください。そこには `transcribe` が加えるトラッカーの制限と、小さな音を落とすゲートも載っています。

編集が恒等の新しいポリフォニック解析をレンダリングすると、解析の STFT 再構成を含む往復結果になります。入力とバイト単位で同じになるわけではありません。保持するスペクトログラムと帰属セットは解析区間に応じて増えるため、短い区間を単位にし、解放したハンドルを再利用しないでください。

<SonareDemo id="pitch-correct" />

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
