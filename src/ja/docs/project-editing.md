---
title: プロジェクト & アレンジ編集
description: libsonare のヘッドレス DAW 編集 API を初学者向けに解説。Project モデル、クリップ／トラック操作、アンドゥ／リドゥ、テンポマップと拍子、ワープモード、オートメーション、MIR 書き戻し、コンパイル診断、JSON 保存／読み込み、SMF / MIDI 2.0 クリップファイルの入出力を、そのまま使えるレシピつきで紹介します。
---

# プロジェクト & アレンジ編集

**DAW を開かずに、曲のアレンジをコードで組み立てたい——** それを叶えるのが `Project` です。**プロジェクト**は、1 曲を構成するすべてを保持するタイムラインです。オーディオトラック、MIDI トラック、そこに置かれたクリップ、テンポマップ、拍子、マーカーが含まれます。libsonare には小さなヘッドレス DAW 編集 API である `Project` モデルが備わっており、DAW ホストを組み込まずに、**自分のアプリの中**でそのタイムラインを構築・編集・シリアライズできます。

作業は短いループです。アレンジを組み立て、アンドゥ可能な操作で編集し、[コンパイル](./project-editing-midi.md#アレンジをコンパイルする)して再生可能なタイムラインにし、JSON に保存し、最後に[音声をレンダリング](./project-editing-midi.md#音声をレンダリングする)します——この工程の後半は [MIDI・コンパイル・保存/読み込み](./project-editing-midi.md) を参照してください。`Project` は**オフラインの制御スレッド向け API**（音声スレッドでは決して動きません）で、ブラウザ（WASM）でも Node でも Python でも同じように動作します。

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
- トラックは**オートメーションレーン**——音量やフィルターのカットオフなどのパラメータを時間方向に動かす記録カーブ——を持てます。フェーダーが自動で動くようなものです。
- MIDI トラックは楽器の**デスティネーション**——そのノートを実際に音にするシンセやサンプラー——を指します（すぐ下で説明します）。
- すべてのトラックは**ミキサーシーン**のストリップ——EQ・フェーダー・パン・センドから成る自分のチャンネル——を通ってマスターへ流れます。

::: info MIDI の「デスティネーション」とは
MIDI ノートは「いま音 60 を鳴らせ」といった指示にすぎず、音そのものではありません。**デスティネーション**は、その指示を送り届ける楽器——指示を音声に変えるシンセやサンプラー——です。MIDI トラックはデスティネーションを名前で指し、レンダリング時に実際の楽器をそこへバインドします。[プロジェクトバウンス](./project-bounce.md)を参照してください。
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
  caption="診断でエラーが報告された場合、クリップ・トラック・ルーティングの修正は行き止まりではなく、破線で示すように編集ステップへ戻ってループします。"
/>

`compile()` がエラー付きで返ってきても、修正は行き止まりではありません。該当するクリップ・トラック・ルーティングを直せば、アレンジは同じアンドゥ可能な編集ステップに戻り、再びコンパイルできる状態になります。初学者がつまずきやすい点は 2 つです。

- `compile()` は音を作りません。アレンジを検査し、レンダリング可能な形へ準備します。
- 通常の `bounce()` はオーディオトラックだけをレンダリングします。MIDI トラックを鳴らすには `bounceWithSynthInstrument(...)` や `bounceWithSf2Instrument(...)` のような楽器つきバウンスが必要です。

## このページで身につくこと

このページを読むと、次のことができるようになります。

- `Project` を作成し、オーディオ／MIDI トラックを追加してクリップを配置する。
- クリップ（分割・トリム・移動・ゲイン・フェード・ループ・ソース差し替え・複製・削除）とトラック（追加・名前変更・ルーティング・種別変更・削除）を**アンドゥ可能な**操作で編集する。
- PPQ、テンポセグメントを持つテンポマップ、拍子、マーカーを使って音楽的な時間を正しく置く。
- クリップの重なりポリシーとワープモード（`off` / `repitch` / `tempo-sync` / `time-stretch`）をワープアンカーとともに選ぶ。
- キー／コード注釈とオートメーションレーンをプロジェクトへ書き込む。
- 再生可能なタイムラインへコンパイルし、構造化された診断と致命的でない警告を読む。
- 決定的な JSON で保存・読み込みし、SMF（標準 MIDI ファイル）と MIDI 2.0 クリップファイル形式で MIDI を交換する。

## プロジェクトを作成して内容を追加する

すべてのプロジェクトは空から始まります。サンプルレートを設定し、トラックを追加し、クリップを配置します。`addTrack` と `addClip` は安定した整数 ID を返し、以降の編集ではこの ID を使います。位置と長さは **PPQ** です。

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

プロジェクト概要の更新や、インポートしたアレンジの検証には `project.trackCount()` と `project.clipCount()` を使えます。シリアライズ済み JSON を走査せず、トラック数とクリップ数を取得できます。Python では `track_count()` と `clip_count()` です。

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
| ゲイン | `setClipGain(clipId, gain)` | クリップごとの線形再生ゲイン（`>= 0`）。オーディオクリップにのみ有効で、MIDI クリップには保存されるがバウンスでは適用されない |
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

フェードカーブは `'linear'`・`'equal-power'`・`'exponential'`・`'logarithmic'` です。各フェード長はクリップ長を上限にクランプされるため、過大なフェードがクリップ開始より前から始まることはありません。負の長さはそのまま拒否されます。ループモードは `'off'` または `'loop'` で、ループ時は正の `loopLengthPpq` が必要です。`loopCrossfadePpq` はループ継ぎ目に入れる任意の equal-power クロスフェードです。`0` なら従来どおりのハードループ、正の値ならループ末尾とプリロール側のソース素材をブレンドします。エンジンは使用可能なソースオフセットとループ長の半分を上限にクランプし、ワープ済みクリップではこの継ぎ目クロスフェードを無効にします。

::: warning `setClipGain` / `setClipFade` はオーディオクリップのみに効く
`setClipGain` と `setClipFade` が効くのは**オーディオクリップのみ**です。MIDI クリップでは値が保存され（アンドゥ可能で `toJson()` でも往復します）が、レンダリングされるノートには反映されません。コンパイラは MIDI クリップのイベントをそのままレンダースケジュールへコピーし、クリップはトラックのミュート／ソロ／ゲインだけでゲートするため、クリップごとのゲインとフェードは音には影響しません。MIDI で鳴る楽器の音量を制御するには、**トラックゲイン**（`setTrackGain(trackId, gain)`。[ミキサーシーン](./mixing.md)のチャンネルストリップのフェーダーに畳み込まれます）を設定してください。トラックゲイン `0` はそのトラックの MIDI ノートを完全に無音にします。
:::

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

**aux** トラックは自前のクリップを持ちません。内容を録音する場所ではなく、ルーティング／リターン用のレーン（たとえばエフェクトリターンやサブミックス）です。

`setTrackRoute` はプロジェクトトラックを、プロジェクトの[ミキサーシーン](./mixing-scene-json.md)（`setMixerSceneJson` で設定）内のストリップへリンクします。これにより、バウンスしたトラックがそのチャンネルストリップの処理を通ります。

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

拍子は並列のセグメントリストで、各セグメントは分子（1 小節あたりの拍数）と分母（拍の単位）を持ちます。

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

`0` は重なりを禁止し、`1` は許可します。重ねたクリップやクロスフェードを意図する場合は許可し、トラックを厳密に逐次にしたい場合は禁止します。このポリシーが素の整数なのは、ネイティブの列挙体をそのまま反映しているためです。定義されているのは `0`（禁止）と `1`（許可）だけで、それ以外の値は不正なパラメータとして拒否されます。

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

`'time-stretch'` もピッチを保ちますが、到達の仕方が異なります。`'repitch'` と**同じ**アンカーマップを読み、ソースの断片を一定のレートでオーバーラップ加算して出力を合成するため、マップを変えるとタイミングだけが動き、ピッチはそのまま残ります。実用上の違いは処理がいつ走るかです。`'tempo-sync'` は伸縮後の音声をコントロールスレッドでベイクするのに対し、`'time-stretch'` は再ベイクなしで次のオーディオブロックから反映されます。両者の比較は [ワープとテンポ同期](./glossary/arrangement/warp-and-tempo.md) で詳しく扱います。

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

ワープマップは ID で管理される第一級オブジェクトです。`setWarpMap({ id, name, anchors })` で追加・置換し、`setClipWarpRef(clipId, id)`（`0` で解除）でクリップに割り当て、`project.removeWarpMap(id)` で ID を指定して削除します。クリップがまだ参照しているマップを削除すると、そのクリップにはワープ参照が宙ぶらりんで残るため、先に `setClipWarpRef(clipId, 0)` で参照を解除してください。

::: warning アンカーはアプリ側で維持する。最低 2 個が必要
アンカーはサンプル単位の絶対的な対応表であり、エンジンがテンポマップから導き直すことはありません。したがって `setTempoSegments(...)` でテンポを変えても、ワープ済みクリップが伸縮し直されることは**ありません**。変わるのはタイムライン上のクリップの開始位置と長さだけで、固定されたワープ曲線のうち再生される範囲が変わるにすぎません。テンポ変更に音声を追従させたいときは、アプリ側でアンカーを計算し直し、`setWarpMap(...)` で新しいマップを渡してください。

また、マップがストレッチを表すにはアンカーが 2 個以上必要です。ワープマップも事前ベイク済み音声も持たない `'tempo-sync'` クリップは、`compile()` が参照切れとして報告するコンパイルエラーになります。`'repitch'` や `'time-stretch'` のクリップがワープ参照をまったく持たない場合はエラーにならず、`'off'` と同じくネイティブ速度で静かに再生されます。どのモードでもエラーになるのは、登録されていないワープマップ ID を参照しているクリップで、`compile()` は同じ参照切れとして報告します。
:::

## テイクとコンプレーン

クリップは代替の**テイク**と、複数テイクの良い箇所をつなぐ**コンプ**（合成）を持てます。これらは `Project` の第一級機能（`setClipTakes`・`setClipCompSegments`・`addLoopRecordingTakes`）で、ループ録音のキャプチャを含めて専用ページで詳しく扱います。[録音とテイク](./recording-and-takes.md)を参照してください。

## オートメーションレーン

**オートメーションレーン**は、ホスト定義のパラメータ 1 つを時間に沿って変化させます。各ブレークポイントは PPQ 位置・値・次の点へのカーブ（`'linear'`・`'exponential'`・`'hold'`・`'scurve'`）を持ちます。

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

型付きレーンでは `targetKind: 'track-fader-db'` または `'track-pan'` を指定し、レーンを所有するトラックのミキサーフェーダー／パンを対象にします。JavaScript は名前のほか序数 `0` ／ `1` ／ `2` も受け付けます。コンパイル／インストール時にプロジェクトがエンジンの予約パラメータ名前空間へ解決するため、永続化された `targetParamId` はリアルタイム用 ID ではありません。オフラインバウンスではトラックミキサーを通って適用されます。1 トラックにつき各型のレーンは 1 本までです。`targetKind` を省略した場合は `targetKind: 'opaque'` と同じ従来のホスト定義ターゲットになります。JSON のフィールド名は `target_kind` で、型付きレーンを 1 本でも含むプロジェクトはスキーマバージョン `2`、opaque だけのプロジェクトはスキーマバージョン `1` のまま既存バイト列を維持します。C の拡張エントリーポイントは `sonare_project_add_automation_lane_ex` と `sonare_project_edit_automation_lane_ex` で、従来の C 呼び出しは opaque／既存種別維持の経路です。

::: warning レーンの指定は位置ではなくターゲットパラメータ ID
`editAutomationLane` と `removeAutomationLane` は、以前の位置インデックスに代わってターゲットパラメータ ID を受け取ります。どちらも数値で引数の個数も同じなので、インデックスを渡す既存コードはエラーにならず、別のレーンを編集してしまいます。インデックスを保持して渡している箇所は見直してください。
:::


## 各節の移動先

| 節 | 移動先 |
|---|---|
| キーとコードの注釈書き戻し | [MIDI・コンパイル・保存/読み込み](./project-editing-midi.md#キーとコードの注釈書き戻し) |
| アシストサイドカー | [MIDI・コンパイル・保存/読み込み](./project-editing-midi.md#アシストサイドカー) |
| MIDI の内容 | [MIDI・コンパイル・保存/読み込み](./project-editing-midi.md#midi-の内容) |
| 自動テンポとグリッドスナップ | [MIDI・コンパイル・保存/読み込み](./project-editing-midi.md#自動テンポとグリッドスナップ) |
| アレンジをコンパイルする | [MIDI・コンパイル・保存/読み込み](./project-editing-midi.md#アレンジをコンパイルする) |
| 保存と読み込み: 決定的な JSON | [MIDI・コンパイル・保存/読み込み](./project-editing-midi.md#保存と読み込み-決定的な-json) |
| MIDI 交換: SMF と MIDI 2.0 クリップファイル | [MIDI・コンパイル・保存/読み込み](./project-editing-midi.md#midi-交換-smf-と-midi-2-0-クリップファイル) |
| 音声をレンダリングする | [MIDI・コンパイル・保存/読み込み](./project-editing-midi.md#音声をレンダリングする) |

## 関連

- [編集の基礎](./glossary/concepts/editing-basics.md) — 初学者向けの用語
- [プロジェクトバウンス & レンダリング](./project-bounce.md) — タイムラインを音声へ。楽器ありでもなしでも
- [録音とテイク](./recording-and-takes.md) — テイク、コンプレーン、ループ録音キャプチャ
- [内蔵シンセサイザー](./native-synth.md) · [SoundFont プレイヤー](./soundfont-player.md) — MIDI トラックを鳴らす
- [MIDI 入力](./midi-input.md) — コントローラからプロジェクトをライブ演奏する
- [ミキシングシーン JSON](./mixing-scene-json.md) — トラックのルーティング先となるシーン
- [バインディング対応表](./binding-parity.md) — 実行環境ごとの API 差分
