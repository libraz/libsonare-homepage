---
title: プロジェクト & アレンジ編集
description: libsonare のヘッドレス DAW 編集 API を初学者向けに解説。Project モデル、クリップ／トラック操作、オフラインモノフォニックボーカル編集、アンドゥ／リドゥ、テンポマップと拍子、ワープモード、オートメーション、MIR 書き戻し、コンパイル診断、JSON 保存／読み込み、SMF / MIDI 2.0 クリップファイルの入出力を、そのまま使えるレシピつきで紹介します。
---

# プロジェクト & アレンジ編集

**DAW を開かずに、曲のアレンジをコードで組み立てたい。** それを叶えるのが `Project` です。**プロジェクト**は、1 曲を構成するすべてを保持するタイムラインです。オーディオトラック、MIDI トラック、そこに置かれたクリップ、テンポマップ、拍子、マーカーが含まれます。`Project` は libsonare の小さなヘッドレス DAW 編集 API で、DAW ホストを組み込まずに、**自分のアプリの中**でそのタイムラインを構築・編集・シリアライズできます。

作業は短いループです。アレンジを組み立て、アンドゥ可能な操作で編集し、[コンパイル](./project-save-load.md#アレンジをコンパイルする)して再生可能なタイムラインにし、JSON に保存し、最後に[音声をレンダリング](./project-bounce.md)します。キーとコードの注釈は[プロジェクトの MIDI](./project-editing-midi.md)、保存と読み込みは[プロジェクトのコンパイル・保存・読み込み](./project-save-load.md)、モノフォニックボーカルの編集は[オフラインモノフォニックボーカル編集](./vocal-editing.md)を参照してください。`Project` は**オフラインの制御スレッド向け API**（音声スレッドでは動きません）で、ブラウザ（WASM）でも Node でも Python でも同じように動作します。

::: info 最初に押さえる 3 語
**トラック**はタイムライン上の 1 本のレーン（オーディオレーンまたは MIDI レーン）です。**クリップ**はトラックに置かれた 1 ブロックの内容で、録音オーディオの一片や MIDI ノートの領域です。**PPQ**（pulses per quarter note）は libsonare が音楽的な時間を測る単位です。クリップの開始・長さ・イベント位置はすべて 4 分音符を単位として表され、`lengthPpq: 4` はテンポに関係なく 4 分音符 4 つ分の長さになります。
:::

::: info ヘッドレス DAW
**ヘッドレス DAW** は、独自の画面・タイムライン UI・プラグインホストを持たない DAW の中核部分です。libsonare はデータモデルと音声エンジンを提供し、ボタン、波形ビュー、ファイル選択、プロジェクト一覧などはあなたのアプリ側で作ります。
:::

::: tip パイプライン内での編集の位置
**解析**はトラックが「何か」を調べます。**編集**はタイムライン上にクリップを配置・トリミングし、タイミングを直します。**ミキシング**は複数トラックをステレオバスへまとめます。**マスタリング**は仕上がったミックスを配信向けに磨きます。本ページは編集の工程で、「ステムと MIDI のフォルダ」を「構造化されたアレンジ」へ変える段階です。*クリップ*・*トラック*・*フェード*・*テンポマップ* という言葉に馴染みがなければ、先に [編集の基礎](./glossary/concepts/editing-basics.md) を読んでください。
:::

## プロジェクトのモデル

プロジェクトはいくつかの単純な部品を入れ子にした構造で、各部品が次の部品の入れ物になっています。

- 各**トラック**は**クリップ**（タイムライン上に置く内容のブロック）を持ちます。
- オーディオクリップは代替の**テイク**と、それらの良い部分を 1 つの演奏につなぐ**コンプ**を持てます。
- オーディオクリップは元ソース、派生レンダー、コミット済みリビジョン、永続化したセッション状態を記録するオフラインボーカル編集サイドカーを持てます。
- トラックは**オートメーションレーン**（音量やフィルターのカットオフなどのパラメータを時間方向に動かす記録カーブ）を持てます。フェーダーが自動で動くようなものです。
- MIDI トラックは楽器の**デスティネーション**（そのノートを実際に音にするシンセやサンプラー）を指します。すぐ下で説明します。
- すべてのトラックは**ミキサーシーン**のストリップ（EQ・フェーダー・パン・センドから成る自分のチャンネル）を通ってマスターへ流れます。

<ProjectModelFigure
  title="タイムライン上のプロジェクトモデル"
  :labels="{ audioTrack: 'オーディオトラック', midiTrack: 'MIDI トラック', clip: 'クリップ', midiClip: 'MIDI クリップ', take: 'テイク', comp: 'コンプレーン', automation: 'オートメーションレーン', bar: '小節', axis: 'PPQ 単位の位置 · 1.0 = 4 分音符 1 つ', activeNote: 'アクティブテイク（空白区間を埋める）', compNote: 'テイクを選ぶだけ（コピーはしない）' }"
/>

::: info MIDI の「デスティネーション」とは
MIDI ノートは「いま音 60 を鳴らせ」といった指示にすぎず、音そのものではありません。**デスティネーション**は、その指示を送り届ける楽器、つまり指示を音声に変えるシンセやサンプラーです。MIDI トラックはデスティネーションを名前で指し、レンダリング時に実際の楽器をそこへバインドします。[プロジェクトバウンス](./project-bounce.md)を参照してください。
:::

<FlowDiagram
  title="プロジェクトの構造"
  direction="TB"
  :nodes="[
    { id: 'project', label: 'Project', col: 0, row: 0, variant: 'accent' },
    { id: 'audioTrack', label: 'オーディオトラック', col: 0, row: 1 },
    { id: 'midiTrack', label: 'MIDI トラック', col: 1, row: 1 },
    { id: 'automation', label: 'オートメーションレーン', col: 2, row: 1, variant: 'muted' },
    { id: 'audioClip', label: 'オーディオクリップ (テイク / コンプ)', col: 0, row: 2 },
    { id: 'midiClip', label: 'MIDI クリップ (ノートイベント)', col: 1, row: 2 },
    { id: 'destination', label: 'MIDI デスティネーション', col: 1, row: 3, variant: 'accent' },
    { id: 'scene', label: 'ミキサーシーンのストリップ', col: 0, row: 3 },
    { id: 'master', label: 'マスターバス', col: 0, row: 4, variant: 'success' }
  ]"
  :edges="[
    { from: 'project', to: 'audioTrack' },
    { from: 'project', to: 'midiTrack' },
    { from: 'project', to: 'automation' },
    { from: 'audioTrack', to: 'audioClip' },
    { from: 'midiTrack', to: 'midiClip' },
    { from: 'midiClip', to: 'destination' },
    { from: 'audioTrack', to: 'scene' },
    { from: 'midiTrack', to: 'scene' },
    { from: 'scene', to: 'master' }
  ]"
  caption="すべてのトラック・クリップ・レーンはプロジェクトの下に入れ子になり、オーディオトラックと MIDI トラックはどちらもミキサーシーンを経てマスターバスへ流れます。"
/>

## 編集の流れを先に見る

API の一覧へ進む前に、この流れを頭に入れておくと迷いにくくなります。`Project` を編集し、コンパイルでタイムラインを検査し、バウンスで音声サンプルへ変換します。

<FlowDiagram
  title="編集 → コンパイル → バウンス"
  :nodes="[
    { id: 'source', label: 'オーディオ / MIDI ソース', col: 0, row: 0 },
    { id: 'project', label: 'トラックとクリップ', col: 1, row: 0 },
    { id: 'edits', label: 'アンドゥ可能な編集', col: 2, row: 0 },
    { id: 'compile', label: 'compile()', col: 3, row: 0 },
    { id: 'diagnostics', label: '診断', col: 4, row: 0, variant: 'decision' },
    { id: 'bounce', label: 'バウンス', col: 5, row: 0, variant: 'accent' },
    { id: 'fix', label: 'クリップ・トラック・ルーティングを修正', col: 5, row: 1, variant: 'warning' },
    { id: 'audio', label: 'インターリーブ Float32 音声', col: 6, row: 0, variant: 'success' }
  ]"
  :edges="[
    { from: 'source', to: 'project' },
    { from: 'project', to: 'edits' },
    { from: 'edits', to: 'compile' },
    { from: 'compile', to: 'diagnostics' },
    { from: 'diagnostics', to: 'bounce', label: 'エラーなし' },
    { from: 'diagnostics', to: 'fix', label: 'エラーあり', style: 'dashed' },
    { from: 'fix', to: 'edits', label: '修正', style: 'dashed' },
    { from: 'bounce', to: 'audio' }
  ]"
  caption="診断でエラーが報告された場合は、破線で示すようにクリップ・トラック・ルーティングを修正して編集ステップへ戻り、ループを続けられます。"
/>

`compile()` がエラー付きで返ってきても、そこで行き詰まるわけではありません。該当するクリップ・トラック・ルーティングを直せば、アレンジは同じアンドゥ可能な編集ステップに戻り、再びコンパイルできる状態になります。初学者がつまずきやすい点は 2 つです。

- `compile()` は音を作りません。アレンジを検査し、レンダリング可能な形へ準備します。
- 通常の `bounce()` はオーディオトラックだけをレンダリングします。MIDI トラックを鳴らすには `bounceWithSynthInstrument(...)` や `bounceWithSf2Instrument(...)` のような楽器つきバウンスが必要です。

## 目的別の呼び出し

| やりたいこと | 呼び出し | 節 |
|--------------|----------|----|
| プロジェクト、トラック、クリップを作る | `Project.create`、`addTrack`、`addClip`、`addMidiClip` | [プロジェクトを作成して内容を追加する](#プロジェクトを作成して内容を追加する) |
| クリップの分割、トリム、移動、フェード、ループ、複製 | `splitClip`、`trimClip`、`moveClip`、`setClipFade`、`setClipLoop` | [クリップを編集する](#クリップを編集する) |
| トラックのルーティング、ミュート、パン | `setTrackRoute`、`setTrackGain`、`setTrackPan` | [トラックを編集する](#トラックを編集する) |
| テンポ、拍子、マーカー | `setTempoSegments`、`setTimeSignatures`、`setMarker` | [音楽的な時間](#音楽的な時間-ppq・テンポ・拍子・マーカー) |
| 音声をグリッドに合わせて伸縮する | `setWarpMap`、`setClipWarpRef`、`setClipWarpMode` | [ワープ](#ワープ-クリップをグリッドに合わせて伸縮する) |
| フェーダー、パン、ホストパラメータのオートメーション | `addAutomationLane`、`editAutomationLane` | [オートメーションレーン](#オートメーションレーン) |
| キーとコードを保存する | `annotateKeys`、`annotateChords` | [プロジェクトの MIDI](./project-editing-midi.md#キーとコードの注釈書き戻し) |
| 検査、保存、読み込み | `compile`、`toJson`、`fromJson` | [保存と読み込み](./project-save-load.md) |
| 音声をレンダリングする | `bounce`、`bounceWithSynthInstrument` | [プロジェクトバウンス](./project-bounce.md) |

## プロジェクトを作成して内容を追加する

すべてのプロジェクトは空から始まります。サンプルレート（8000〜384000 Hz の整数）を設定し、トラックを追加し、クリップを配置します。`addTrack` と `addClip` は安定した整数 ID を返し、以降の編集ではこの ID を使います。位置と長さは **PPQ** です。

::: code-group

```typescript [ブラウザ / WASM]
import { init, Project } from '@libraz/libsonare';

await init();

const project = Project.create();
try {
  project.setSampleRate(48000);

  // 録音クリップ 1 つを持つオーディオトラック（デコード済みインターリーブ float 音声）
  const audioTrack = project.addTrack({ kind: 'audio', name: 'lead-gtr' });
  const clipId = project.addClip({
    trackId: audioTrack,
    startPpq: 0,          // 先頭に配置
    lengthPpq: 4,         // 4 分音符 4 つ分の長さ
    audio: guitarMono,    // デコード済みサンプルの Float32Array
    audioChannels: 1,
    audioSampleRate: 48000,
  });

  // MIDI トラック + クリップを 1 回で作成
  const { trackId: midiTrack, clipId: midiClip } = project.addMidiClip(0, 8);
} finally {
  project.delete();       // WASM ハンドルは GC されない — 必ず解放する
}
```

```python [Python]
import libsonare as sonare

with sonare.Project() as project:
    project.set_sample_rate(48000)

    audio_track = project.add_track("audio", name="lead-gtr")
    clip_id = project.add_clip(
        audio_track,
        start_ppq=0.0,        # 先頭に配置
        length_ppq=4.0,       # 4 分音符 4 つ分の長さ
        audio=guitar_mono,    # インターリーブ float サンプル
        audio_channels=1,
        audio_sample_rate=48000,
    )

    midi_track, midi_clip = project.add_midi_clip(0.0, 8.0)
# with ブロックを抜けるとネイティブハンドルが解放される
```

:::

`audio` を渡すときは `audioSampleRate`（8000〜384000 Hz）が必須です。プロジェクト概要の更新や、インポートしたアレンジの検証には `project.trackCount()` と `project.clipCount()` を使えます。シリアライズ済み JSON を走査せず、トラック数とクリップ数を取得できます。Python では `track_count()` と `clip_count()` です。

::: danger プロジェクトは必ず解放する
`Project` はすべての WASM オブジェクトと同様、JavaScript の GC では回収できないヒープハンドルを保持します。WASM パッケージでは `Project.create()` で作り、`finally` ブロックで `project.delete()` を呼んでください。Node ネイティブでも `Project.create()` で作り、`project.destroy()` または `project.delete()` で解放します。Python ではコンテキストマネージャ（`with sonare.Project() as project:`）として使うか、`project.close()` を呼びます。ハンドルをリークすると、長時間のセッションでネイティブまたは WASM メモリが徐々に枯渇します。
:::

## クリップを編集する

クリップ操作はいずれも 1 つのアンドゥ可能なコマンドで、クリップ ID で対象を指定します。

| 操作 | メソッド | 内容 |
|------|----------|------|
| 分割 | `splitClip(clipId, splitPpq)` | 絶対 PPQ でクリップを切り、新しいクリップの ID を返す |
| トリム | `trimClip(clipId, newStartPpq, newLengthPpq)` | 開始と長さを再設定する |
| 移動 | `moveClip(clipId, newStartPpq, newTrackId?)` | クリップをずらす。別トラックへも移せる |
| ゲイン | `setClipGain(clipId, gain)` | クリップごとの線形再生ゲイン（`>= 0`）。オーディオクリップではクリップ自身のサンプルへ、MIDI クリップではバインドされた楽器のレンダー後出力へ、それぞれ掛かる |
| フェード | `setClipFade(clipId, fadeIn, fadeOut)` | カーブつきのフェードイン／フェードアウト領域 |
| ループ | `setClipLoop(clipId, mode, loopLengthPpq?, loopCrossfadePpq?)` | `'off'` または `'loop'` と、任意のループ継ぎ目クロスフェード |
| ソース差し替え | `setClipSource(clipId, sourceId)` | クリップを別の登録済みソースへ再バインドする |
| 複製 | `duplicateClip(clipId, newStartPpq)` | 同じトラックにコピーし、新しい ID を返す |
| 削除 | `removeClip(clipId)` | クリップを削除する |

```typescript
project.setClipGain(clipId, 0.8);
project.setClipFade(
  clipId,
  { lengthPpq: 0.5, curve: 'equal-power' },  // 半拍でフェードイン
  { lengthPpq: 1.0, curve: 'linear' },       // 1 拍でフェードアウト
);
const tailId = project.splitClip(clipId, 2); // 拍 2 で切り、後半が新クリップになる
project.setClipLoop(tailId, 'loop', 2, 0.05); // 短い継ぎ目クロスフェード付きで 2 拍ごとにループ
const copyId = project.duplicateClip(tailId, 8);
```

フェードカーブは `'linear'`・`'equal-power'`・`'exponential'`・`'logarithmic'` です。各フェード長はクリップ長を上限にクランプされるため、過大なフェードがクリップ開始より前から始まることはありません。負の長さはそのまま拒否されます。ループモードは `'off'` または `'loop'` です。`loopLengthPpq` はループの周期で、省略するか `0` にするとクリップ全体をループします。負の値と有限でない値は拒否されます。`loopCrossfadePpq` はループ継ぎ目に入れる任意の equal-power クロスフェードです。`0` なら従来どおりのハードループ、正の値ならループ末尾とプリロール側のソース素材をブレンドします。エンジンは使用可能なソースオフセットとループ長の半分を上限にクランプし、ワープ済みクリップではこの継ぎ目クロスフェードを無効にします。

::: warning `setClipGain` / `setClipFade` は MIDI クリップのレンダー後音声に効く（イベントには効かない）
MIDI クリップでは、ゲインとフェードはバインドされた楽器の出力に掛かります。ベロシティにもタイミングにも触れません（ノートオンとノートオフはそのままレンダースケジュールへコピーされます）。このエンベロープは MIDI デスティネーションごとに 1 つで、どのクリップが決めるかは次の順に決まります。

- そのデスティネーション上でまだアクティブな、最も新しく開始したクリップが優先されます。出力は `gain` に従い、オーディオクリップのサンプルと同じ形でフェード区間を通過します。
- そのクリップが終了したとき、先に開始したクリップがまだアクティブなら、出力はそちらのエンベロープに戻ります。
- アクティブなクリップがなくなったら、最後に終了したクリップの終了時点の値（フェードアウトがあれば `0`、なければ `gain`）を保持します。
- 同時に開始したクリップは ID が大きいほうが優先されます。

同じデスティネーションを共有する複数のトラックは、このエンベロープを共有します。**トラックゲイン**（`setTrackGain(trackId, gain)`。[ミキサーシーン](./mixing.md)のチャンネルストリップのフェーダーに畳み込まれます）はこの下でそのまま働き、影響を受けません。トラックゲイン `0` は、クリップのゲインやフェードにかかわらず、そのトラックの MIDI ノートを無音にします。
:::

### 拒否される値

位置、ゲイン、レートを受け取る編集は、範囲外の値をクランプせず `Invalid parameter` で拒否します（負の位置での `splitClip` は `Invalid state`）。

| 呼び出し | 拒否される値 |
|----------|--------------|
| `setSampleRate`、`bounce({ sampleRate })` | 整数でない値、8000〜384000 の範囲外の値、およびバウンスではプロジェクトのレートと異なる値 |
| PPQ やフレームの位置を取るすべての呼び出し（`startPpq`、`trimClip`、`splitClip`、`moveClip`、マーカー、テンポ／拍子セグメント、ループ録音の `startPpq`、ステムの `startFrame`） | 負の値 |
| `setClipGain`、`setTrackGain`、`setTrackPan` | 有限でない値、およびゲインでは負の値 |
| `setClipFade` の長さ | 負の値 |
| `setWarpMap` | ID `0`、アンカーが 2 個未満、サンプル位置が負のアンカー |
| `setTempoSegments` | `bpm <= 0` |

Python では同じ操作が snake_case になり、フェードは長さとカーブを個別の引数で受け取ります。

```python
project.set_clip_gain(clip_id, 0.8)
project.set_clip_fade(
    clip_id,
    fade_in_length_ppq=0.5,
    fade_out_length_ppq=1.0,
    fade_in_curve="equal-power",
    fade_out_curve="linear",
)
tail_id = project.split_clip(clip_id, 2.0)
project.set_clip_loop(tail_id, "loop", 2.0, loop_crossfade_ppq=0.05)
copy_id = project.duplicate_clip(tail_id, 8.0)
```

## トラックを編集する

トラック操作も同様にアンドゥ可能です。

| 操作 | メソッド | 内容 |
|------|----------|------|
| 追加 | `addTrack({ kind, name })` | `'audio'`・`'midi'`・`'aux'` トラックを追加し、ID を返す |
| 削除 | `removeTrack(trackId)` | トラックとそのクリップを削除する |
| 名前変更 | `renameTrack(trackId, name)` | トラック名を変える |
| 種別変更 | `setTrackKind(trackId, kind)` | トラックを `'audio'` / `'midi'` / `'aux'` 間で切り替える |
| ルーティング | `setTrackRoute(trackId, channelStripRef, outputTarget)` | トラックをミキサーストリップと出力バスに結びつける |
| ゲイン | `setTrackGain(trackId, gain)` | トラックのリニア出力ゲインを設定する（負値や非有限値は拒否される） |
| ミュート | `setTrackMute(trackId, mute)` | トラックをミュート／解除する |
| ソロ | `setTrackSolo(trackId, solo)` | トラックをソロにし、他をミュート扱いにする |
| パン | `setTrackPan(trackId, pan)` | トラックを `[-1, 1]` でパンする（非有限値は拒否される） |
| MIDI デスティネーション | `setTrackMidiDestination(trackId, destinationId)` | トラックの MIDI を楽器のデスティネーション ID へルーティングする。[内蔵シンセサイザー（NativeSynth）](./native-synth.md)を参照 |

::: code-group

```typescript [ブラウザ / WASM]
const drums = project.addTrack({ kind: 'audio', name: 'drums' });
project.renameTrack(drums, 'drum-bus');
project.setTrackRoute(drums, 'strip-drums', 'master'); // ミキサーシーンのストリップへ配線
```

```python [Python]
drums = project.add_track("audio", name="drums")
project.rename_track(drums, "drum-bus")
project.set_track_route(drums, "strip-drums", "master")  # ミキサーシーンのストリップへ配線
```

:::

**aux** トラックは、ルーティング／リターン用のレーン（たとえばエフェクトリターンやサブミックス）です。クリップを置くことは API 上できますが、録音内容を置く場所ではありません。

`setTrackRoute` はプロジェクトトラックを、プロジェクトの[ミキサーシーン](./mixing-scene-json.md)（`setMixerSceneJson` で設定）内のストリップへリンクします。これにより、バウンスしたトラックがそのチャンネルストリップの処理を通ります。`setMixerSceneJson` はシーンの読み込み警告を文字列のリストで返します（問題がなければ空）。そのため `faderDB` のような綴り間違いのキーは、フェーダーが既定値のまま気づかれないのではなく、`unknown scene key 'strips[0].faderDB'` として表れます。

## アンドゥとリドゥ

プロジェクトは**編集履歴**を保持します。クリップ・トラック・オートメーション・注釈の各操作は、取り消せるコマンドを積みます。

::: code-group

```typescript [ブラウザ / WASM]
project.setClipGain(clipId, 0.3);
project.undo();   // ゲインが元の値に戻る
project.redo();   // ゲイン編集を再適用する
```

```python [Python]
project.set_clip_gain(clip_id, 0.3)
project.undo()   # ゲインが元の値に戻る
project.redo()   # ゲイン編集を再適用する
```

:::

長時間動作するエディターでは、アンドゥとリドゥが保持するメモリを制限したり、アレンジを変えずに編集セッションを切り替えたりできます。`setMaxHistoryBytes(bytes)` は両方の履歴スタックに共通するバイト上限を設定し、直ちに適用します。`0` にすると保持を無効にするため、成功した編集もアンドゥできません。編集件数で制限したい場合は `setMaxUndoDepth(depth)` も使え、直近 `depth` 件だけを残します。WASM では `depth` は `1` 以上の整数でなければなりません。`clearHistory()` は現在のプロジェクト状態を変えずに、アンドゥとリドゥの両方を消去します。Node も同じ camelCase 名、Python では `set_max_history_bytes(...)`、`set_max_undo_depth(...)`、`clear_history()` を使います。

```typescript
project.setMaxUndoDepth(100); // 直近 100 件の編集だけを保持
project.setMaxHistoryBytes(8 * 1024 * 1024); // アンドゥ／リドゥ共通の上限
// ... 保存する、または別の編集セッションへ渡す ...
project.clearHistory();       // アレンジはそのまま。アンドゥ／リドゥだけが空になる
```

履歴は厳密なので、編集前に `toJson()` を呼び、アンドゥしてから再び `toJson()` を呼ぶと、バイト単位で同一の JSON になります。テストやエディタ UI の変更検出に役立つ不変条件です。

複数クリップを変更する複合編集は、履歴上では 1 トランザクションです。アンドゥ／リドゥは 1 ステップで完了し、アレンジが途中状態で残りません。

## 音楽的な時間: PPQ・テンポ・拍子・マーカー

すべての位置は **PPQ**（浮動小数点値としての 4 分音符。分数拍も正確に表せます）です。テンポと拍子は、順序づけられたセグメントのリストとしてプロジェクトに保持されます。

### テンポマップとテンポセグメント

**テンポマップ**はテンポセグメントのリストです。各セグメントは PPQ 位置から始まり BPM を設定します。任意の `endBpm` を指定すると、そのセグメントで新しいテンポへ直線的に変化します。

テンポをドラッグすると、セグメントが 4 分音符を秒へ変換する様子を確認できます。

<SonareDemo id="tempo-grid" />

::: code-group

```typescript [ブラウザ / WASM]
project.setTempoSegments([
  { startPpq: 0,  bpm: 120 },                 // 先頭から一定の 120 BPM
  { startPpq: 16, bpm: 120, endBpm: 140 },    // このセグメントで 120 -> 140 へランプ
  { startPpq: 32, bpm: 140 },
]);
project.tempoSegmentCount(); // 3
```

```python [Python]
project.set_tempo_segments([
    {"start_ppq": 0.0, "bpm": 120},                     # 先頭から一定の 120 BPM
    {"start_ppq": 16.0, "bpm": 120, "end_bpm": 140},    # このセグメントで 120 -> 140 へランプ
    {"start_ppq": 32.0, "bpm": 140},
])
project.tempo_segment_count()  # 3
```

:::

### 拍子

拍子はテンポとは別に持つ、もう 1 つのセグメントリストで、各セグメントは分子（1 小節あたりの拍数）と分母（拍の単位）を持ちます。

::: code-group

```typescript [ブラウザ / WASM]
project.setTimeSignatures([
  { startPpq: 0,  numerator: 4, denominator: 4 },
  { startPpq: 64, numerator: 3, denominator: 4 },  // 後半で 3/4 へ切り替え
]);
```

```python [Python]
project.set_time_signatures([
    {"start_ppq": 0.0, "numerator": 4, "denominator": 4},
    {"start_ppq": 64.0, "numerator": 3, "denominator": 4},  # 後半で 3/4 へ切り替え
])
```

:::

### マーカー

マーカーはタイムライン上の位置にラベルを付けます。マーカー ID に `0` を渡すと新しい ID が割り当てられ、安定した ID が返ります。

```typescript
const introId = project.setMarker(0, 0,  'intro');
project.setMarker(0, 16, 'verse');
project.setMarker(introId, 0, 'intro (edited)'); // ID を再利用して更新
```

構造化マーカーには、`ProjectMarker` オブジェクト全体を渡す `setMarkerEx(...)` を使います。`MarkerKind` は通常マーカー、テキスト、歌詞、キューポイント、調号を表します。調号マーカーでは `keyFifths`（`-7`...`+7`、シャープが正）と `keyMinor` を使います。

::: code-group

```typescript [ブラウザ / WASM]
import { MarkerKind } from '@libraz/libsonare';

project.setMarkerEx({
  id: 0,
  ppq: 32,
  name: 'drop cue',
  kind: MarkerKind.cuePoint,
  keyFifths: 0,
  keyMinor: false,
});

project.setMarkerEx({
  id: 0,
  ppq: 64,
  name: 'E minor',
  kind: MarkerKind.keySignature,
  keyFifths: 1,
  keyMinor: true,
});

for (let i = 0; i < project.markerCount(); i += 1) {
  console.log(project.markerByIndex(i));
}
```

```python [Python]
from libsonare import MarkerKind, ProjectMarker

project.set_marker_ex(ProjectMarker(0, 32.0, "drop cue", MarkerKind.CUE_POINT))
project.set_marker_ex(
    ProjectMarker(0, 64.0, "E minor", MarkerKind.KEY_SIGNATURE, key_fifths=1, key_minor=True)
)

for index in range(project.marker_count()):
    print(project.marker_by_index(index))
```

:::

Python ではセグメントリストに、上のマッピングの代わりに素のタプルも渡せます（テンポは `(start_ppq, bpm)`、拍子は `(start_ppq, numerator, denominator)`）。単純なマーカー呼び出しは `set_marker(marker_id, ppq, name)` です。

## 重なりポリシー

**重なりポリシー**は、同じトラック上の 2 つのクリップが同じ時間範囲を占めてよいかを決めます。プロジェクト全体に適用されます。

```typescript
project.setOverlapPolicy(0); // クリップの重なりを禁止（既定）
project.setOverlapPolicy(1); // 重なりを許可（クロスフェードや重ねたテイクなど）
project.getOverlapPolicy();  // 読み戻す
```

`0` は重なりを禁止し、`1` は許可します。重ねたクリップやクロスフェードを意図する場合は許可し、トラック上のクリップを厳密に 1 つずつ順に並べたい場合は禁止します。このポリシーが素の整数なのは、ネイティブの列挙体をそのまま反映しているためです。定義されているのは `0`（禁止）と `1`（許可）だけで、それ以外の値は不正なパラメータとして拒否されます。

## ワープ: クリップをグリッドに合わせて伸縮する

**ワープ**は、録音したオーディオクリップを固定の元の速度で再生する代わりに、プロジェクトのグリッドへ追従させる機能です。録音を少し前後させたり伸縮させたりして、拍を狙った位置に合わせるイメージです。内部的には、クリップは自身の録音タイムラインを保ったまま、ワープマップがその録音タイムライン上の位置をプロジェクト時間上の位置へピン留めします。各クリップはワープ**モード**を持ち、`'off'` 以外のモードが実際に効くにはアンカーから成るワープ**マップ**が必要です。

| ワープモード | 意味 |
|--------------|------|
| `'off'` | 音声をネイティブのレートで再生し、テンポを無視する |
| `'repitch'` | テンポに合わせて速度を変える（テープのようにピッチも動く） |
| `'tempo-sync'` | ピッチを保ったままテンポに追従するようタイムストレッチする（コントロールスレッドでベイク） |
| `'time-stretch'` | ピッチを保ったままテンポに追従するようタイムストレッチする（オーディオスレッドで合成） |

::: info tempo-sync がピッチを保つしくみ
`'tempo-sync'` は音声を**フェーズボコーダー**でタイムストレッチします。これは STFT ベースのタイムストレッチで、ピッチを変えずにタイミングだけを変えます（`'repitch'` がテープのように両方を動かすのとは対照的です）。同じアルゴリズムがリアルタイム再生でもオフラインの[バウンス](./project-bounce.md)でも動くため、ワープしたクリップはどちらでレンダリングしても同じ音になります。ステレオやマルチチャンネルのクリップでは、全チャンネルをピークロック付きの 1 回のボコーダーパスで伸縮するため、チャンネル間で位相が揃ったままになり、ステレオイメージがずれません。
:::

`'time-stretch'` もピッチを保ちますが、その方法が異なります。`'repitch'` と**同じ**アンカーマップを読み、ソースの断片を一定のレートでオーバーラップ加算して出力を合成するため、マップを変えるとタイミングだけが動き、ピッチはそのまま残ります。実用上の違いは処理がいつ走るかです。`'tempo-sync'` は伸縮後の音声をコントロールスレッドでベイクするのに対し、`'time-stretch'` は再ベイクなしで次のオーディオブロックから反映されます。両者の比較は [ワープとテンポ同期](./glossary/arrangement/warp-and-tempo.md) で詳しく扱います。

<SonareDemo id="time-stretch" />

**ワープマップ**はアンカーのリストで、各アンカーは「録音中のこの瞬間をタイムライン上のここに置く」というピンです。具体的には、各 `ProjectWarpAnchor` が `warpSample`（プロジェクト／ワープ後タイムライン上の位置）を `sourceSample`（録音音声内の対応位置）に結びつけ、エンジンは隣り合うアンカーの間で音声を滑らかに伸縮させます。

<FlowDiagram
  title="ワープアンカーは録音時間をプロジェクト時間へ対応づける"
  :nodes="[
    { id: 'r0', label: '0', col: 0, row: 0, group: 'rec' },
    { id: 'r1', label: '12000', col: 1, row: 0, group: 'rec' },
    { id: 'r2', label: '24000', col: 2, row: 0, group: 'rec' },
    { id: 'r3', label: '48000', col: 3, row: 0, group: 'rec' },
    { id: 'p0', label: '0', col: 0, row: 1, variant: 'accent', group: 'proj' },
    { id: 'p1', label: '12000', col: 1, row: 1, variant: 'accent', group: 'proj' },
    { id: 'p2', label: '36000', col: 2, row: 1, variant: 'accent', group: 'proj' },
    { id: 'p3', label: '48000', col: 3, row: 1, variant: 'accent', group: 'proj' }
  ]"
  :edges="[
    { from: 'r0', to: 'p0', style: 'dashed' },
    { from: 'r1', to: 'p1', style: 'dashed' },
    { from: 'r2', to: 'p2', style: 'dashed' },
    { from: 'r3', to: 'p3', style: 'dashed' },
    { from: 'p0', to: 'p1', label: '1×（録音のまま）' },
    { from: 'p1', to: 'p2', label: '2× 伸長' },
    { from: 'p2', to: 'p3', label: '0.5×（速く）' }
  ]"
  :groups="[
    { id: 'rec', label: '録音タイムライン（sourceSample）' },
    { id: 'proj', label: 'プロジェクトタイムライン（warpSample）' }
  ]"
  caption="破線のピンが各 sourceSample を warpSample に結びつけ、隣り合うアンカーの間ではその区間の比率で音声を伸縮します。"
/>

```typescript
// 再利用できるワープマップを定義し、クリップに割り当てる
project.setWarpMap({
  id: 1,
  name: 'groove',
  anchors: [
    { warpSample: 0,     sourceSample: 0 },
    { warpSample: 24000, sourceSample: 12000 }, // 小節前半をソースの 2 倍速で再生
  ],
});
project.setClipWarpRef(clipId, 1);          // マップを参照（0 で解除）
project.setClipWarpMode(clipId, 'tempo-sync');
// project.setClipWarpMode(clipId, 'time-stretch'); // 同じマップをオーディオスレッドで伸縮
// project.removeWarpMap(1);                 // 不要になったら ID でマップを削除
```

ワープマップは ID で管理される独立したオブジェクトです。`setWarpMap({ id, name, anchors })` で追加・置換し、`setClipWarpRef(clipId, id)`（`0` で解除）でクリップに割り当て、`project.removeWarpMap(id)` で ID を指定して削除します。クリップがまだ参照しているマップを削除すると、そのクリップにはワープ参照が宙ぶらりんで残るため、先に `setClipWarpRef(clipId, 0)` で参照を解除してください。

::: warning アンカーはアプリ側で維持する。最低 2 個が必要
アンカーはサンプル単位の絶対的な対応表であり、エンジンがテンポマップから導き直すことはありません。したがって `setTempoSegments(...)` でテンポを変えても、ワープ済みクリップが伸縮し直されることは**ありません**。変わるのはタイムライン上のクリップの開始位置と長さだけで、固定されたワープ曲線のうち再生される範囲が変わるにすぎません。テンポ変更に音声を追従させたいときは、アプリ側でアンカーを計算し直し、`setWarpMap(...)` で新しいマップを渡してください。

`setWarpMap` は 0 以外の `id` と 2 つ以上のアンカーを要求し、サンプル位置は負にできません。満たさない呼び出しは `Invalid parameter` で拒否されます。ワープマップも事前ベイク済み音声も持たない `'tempo-sync'` クリップは、`compile()` が報告するコンパイルエラーになります。`'repitch'` や `'time-stretch'` のクリップがワープ参照をまったく持たない場合はエラーにならず、`'off'` と同じくネイティブ速度で再生されます。どのモードでもエラーになるのは、登録されていないワープマップ ID を参照しているクリップで、`compile()` は同じ参照切れとして報告します。
:::

## テイクとコンプレーン

クリップは代替の**テイク**と、複数テイクの良い箇所をつなぐ**コンプ**（合成）を持てます。既存テイクとコンプの選択は `Project` が直接備える機能（`setClipTakes`・`setClipCompSegments`・`addLoopRecordingTakes`）で、ループ録音のキャプチャを含めて専用ページで詳しく扱います。物理ソースオフセット、ループアンカー、コンプのレンダーパーツは JSON／ネイティブモデルで保持され、現行 JavaScript サーフェスにはそれらのセッターがありません。[録音とテイク](./recording-and-takes.md)を参照してください。

## オートメーションレーン

**オートメーションレーン**は、ホスト定義のパラメータ 1 つを時間に沿って変化させます。各ブレークポイントは PPQ 位置・値・次の点へのカーブ（`'linear'`・`'exponential'`・`'hold'`・`'s-curve'`。旧表記の `'scurve'` も受け付けます）を持ちます。

::: code-group

```typescript [ブラウザ / WASM]
// addAutomationLane はレーンのターゲットパラメータ ID を返します。
// これが編集・削除に渡すハンドルです。targetKind を省略すると従来の opaque レーンです。
const laneParamId = project.addAutomationLane(trackId, {
  targetParamId: 1,                                   // 変化させるパラメータのホスト ID
  points: [
    { ppq: 0, value: 0.0, curve: 'linear' },
    { ppq: 4, value: 1.0, curve: 'exponential' },
  ],
});
project.editAutomationLane(trackId, laneParamId, { targetParamId: 1, points: [/* … */] });
project.removeAutomationLane(trackId, laneParamId);

const faderLaneId = project.addAutomationLane(trackId, {
  targetParamId: 2,
  targetKind: 'track-fader-db',                   // または 'track-pan'
  points: [
    { ppq: 0, value: 0, curve: 'linear' },       // フェーダー値は dB
    { ppq: 4, value: -6, curve: 'linear' },
  ],
});
project.editAutomationLane(trackId, faderLaneId, {
  targetParamId: 2,
  targetKind: 'track-fader-db',
  points: [{ ppq: 0, value: -3, curve: 'linear' }],
});
```

```python [Python]
lane_param_id = project.add_automation_lane(
    track_id,
    target_param_id=1,                # 変化させるパラメータのホスト ID
    points=[
        (0.0, 0.0, "linear"),         # (ppq, value, curve)
        (4.0, 1.0, "exponential"),
    ],
)
project.edit_automation_lane(track_id, lane_param_id, points=[])
project.remove_automation_lane(track_id, lane_param_id)

fader_lane_id = project.add_automation_lane(
    track_id,
    target_param_id=2,
    target_kind="track-fader-db",     # または "track-pan"
    points=[(0.0, 0.0, "linear"), (4.0, -6.0, "linear")],
)
```

:::

Python ではブレークポイントがオブジェクトではなく `(ppq, value, curve)` タプルで、`add_automation_lane` / `edit_automation_lane` は `target_param_id` と `points` を別々の引数として受け取ります。従来のレーンは `target_kind="opaque"`（または省略）、ミキサーの型付きターゲットは `"track-fader-db"` ／ `"track-pan"` を渡します。Python は名前のほか序数 `0` ／ `1` ／ `2` も受け付け、snake_case または camelCase のキーを持つマッピング記述子も使えます。

レーンの `targetParamId` は自分のパラメータ ID です。プロジェクトはブレークポイントをそのまま保存し、コンパイル済みタイムラインで再生します。この ID はレーンの**識別子**でもあります。1 トラックにつき同じターゲットのレーンは 1 本までで、`addAutomationLane` はその ID を返し、編集・削除もこの ID でレーンを指定します。レーンが動かすパラメータを変えるには、編集ではなく削除してから追加してください。

型付きレーンでは `targetKind: 'track-fader-db'` または `'track-pan'` を指定し、レーンが属するトラックのミキサーフェーダー／パンを対象にします。JavaScript は名前のほか序数 `0` ／ `1` ／ `2` も受け付けます。コンパイル／インストール時にプロジェクトがエンジンの予約パラメータ名前空間へ解決するため、永続化された `targetParamId` はリアルタイム用 ID ではありません。オフラインバウンスではトラックミキサーを通って適用されます。1 トラックにつき各型のレーンは 1 本までです。`targetKind` を省略した場合は `targetKind: 'opaque'` と同じ従来のホスト定義ターゲットになります。JSON のフィールド名は `target_kind` で、型付きレーンがあっても、より高いフィールドがなければスキーマバージョン `2` です。物理ソースオフセットまたはループアンカーがあれば `3`、コンプのレンダーパーツがあれば `4` へ上がります。opaque だけで、これらの上位フィールドもないプロジェクトはスキーマバージョン `1` のまま既存バイト列を維持します。C の拡張エントリーポイントは `sonare_project_add_automation_lane_ex` と `sonare_project_edit_automation_lane_ex` で、従来の C 呼び出しは opaque／既存種別維持の経路です。

::: warning レーンの指定は位置ではなくターゲットパラメータ ID
`editAutomationLane` と `removeAutomationLane` は、位置インデックスではなくターゲットパラメータ ID を受け取ります。どちらも数値で引数の個数も同じなので、インデックスを渡してもエラーにならず、別のレーンを編集してしまいます。保持しているインデックスを渡している箇所は見直してください。
:::

## 関連

- [編集の基礎](./glossary/concepts/editing-basics.md) — 初学者向けの用語
- [プロジェクトバウンス & レンダリング](./project-bounce.md) — タイムラインを音声へ。楽器ありでもなしでも
- [録音とテイク](./recording-and-takes.md) — テイク、コンプレーン、ループ録音キャプチャ
- [オフラインモノフォニックボーカル編集](./vocal-editing.md) — モノラルボーカルテイクの解析、編集、レンダリング、永続化、適用
- [内蔵シンセサイザー](./native-synth.md) · [SoundFont プレイヤー](./soundfont-player.md) — MIDI トラックを鳴らす
- [MIDI 入力](./midi-input.md) — コントローラからプロジェクトをライブ演奏する
- [MIDI クリップ編集](./midi-editing.md) — プロジェクトの MIDI イベントを編集、検証、ルーティング、ベイクする
- [MIDI 2.0・UMP・クリップファイル](./midi2.md) — フル幅 UMP を保った交換と SMF 変換
- [プロジェクトの保存と読み込み](./project-save-load.md) — コンパイル、シリアライズ、読み込み後の音声再バインド
- [ミキシングシーン JSON](./mixing-scene-json.md) — トラックのルーティング先となるシーン
- [バインディング対応表](./binding-parity.md) — 実行環境ごとの API 差分
