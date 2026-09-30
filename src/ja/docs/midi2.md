---
title: MIDI 2.0・UMP・クリップファイル
description: libsonare の各バインディングで MIDI 2.0 UMP パッカー、ライブの複数ワードメッセージ、MIDI 2.0 クリップファイルを使います。
---

# MIDI 2.0・UMP・クリップファイル

MIDI 2.0 のメッセージは、libsonare では Universal MIDI Packet（UMP）として通ります。UMP はパケットの運搬形式であり、MIDI 2.0 の意味論そのものではありません。メッセージタイプとステータスが MIDI の意味を定めます。MIDI 1.0 のチャンネルボイスを表す MT `0x2` は 1 ワード、MIDI 2.0 のチャンネルボイスを表す MT `0x4` は 2 ワードです。Project のイベントは PPQ 位置と最初の 2 UMP ワードを持つため、MIDI 1.0 と MIDI 2.0 のチャンネルボイスイベントを同じ `setMidiEvents` リストで扱えます。`Project.midi*` は MIDI 1.0 ワードを、`Project.midi2*` はフル解像度の MIDI 2.0 ワードを作ります。

プロトコルの定義は MIDI Association の [Universal MIDI Packet・MIDI 2.0 Protocol 仕様](https://midi.org/universal-midi-packet-ump-and-midi-2-0-protocol-specification)を参照してください。以下の受信側とバインディングの制限は libsonare の実装についての説明です。

::: info 値の幅と受信側の挙動
MIDI 2.0 UMP には 16 ビットのノートベロシティ、32 ビットのコントローラ／プレッシャー、32 ビットのピッチベンド、パーノートメッセージを入れられます。生 UMP と MIDI 2.0 クリップファイルの経路では、その値の幅を保ちます。ただし受信する楽器が対応する表現は一部に限られることがあります。下の受信側の表を参照してください。
:::

<FlowDiagram
  title="UMP を通る MIDI 1.0 と MIDI 2.0"
  :nodes="[
    { id: 'midi1', label: 'MIDI 1.0 / MT2', col: 0, row: 0 },
    { id: 'midi2', label: 'MIDI 2.0 / MT4', col: 0, row: 1 },
    { id: 'project', label: 'ProjectMidiEvent 列', col: 1, row: 0, variant: 'accent' },
    { id: 'live', label: 'RealtimeEngine UMP', col: 2, row: 0 },
    { id: 'clip', label: 'SMF2CLIP', col: 2, row: 1, variant: 'success' },
    { id: 'smf', label: 'SMF 変換（損失の可能性）', col: 3, row: 1, variant: 'warning' }
  ]"
  :edges="[
    { from: 'midi1', to: 'project' },
    { from: 'midi2', to: 'project' },
    { from: 'project', to: 'live' },
    { from: 'project', to: 'clip' },
    { from: 'clip', to: 'smf' }
  ]"
  caption="UMP は 1 ワードの MIDI 1.0 または 2 ワードの MIDI 2.0 チャンネルボイスを運びます。プロジェクト列は受信側やファイル変換で制限される前に両方を保持できます。"
/>

## MIDI 1.0 から MIDI 2.0 へ

UMP のチャンネルボイスワードは 4 ビットのグループと 4 ビットの MIDI チャンネルを持ちます。チャンネルボイスのメッセージタイプが値の配置を分けます。MT `0x2` は 1 ワードの MIDI 1.0 メッセージ、MT `0x4` は 2 ワードの MIDI 2.0 メッセージです。広い値のフィールドは 2 番目のワードに入ります。どちらの形式も 7 ビットのノート番号と同じグループ／チャンネル範囲を使います。

| 値または表現 | MIDI 1.0 チャンネルボイス | MIDI 2.0 チャンネルボイス |
|---|---:|---:|
| ノートベロシティ | 7 ビット | 16 ビット |
| CC、チャンネルプレッシャー、ポリプレッシャー | 7 ビット | 32 ビット |
| ピッチベンド | 14 ビット | 32 ビット |
| パーノートコントローラとパーノートピッチベンド | チャンネルボイスに相当する形式なし | MIDI 2.0 固有のメッセージ形式 |
| ノートオン属性 | 相当するフィールドなし | type と任意の 16 ビット属性データ |

MIDI 2.0 は値の精度を上げ、パーノート表現を追加します。ただし、すべての受信側がすべてのメッセージを適用するわけではありません。別々のパーノートメッセージで、同じチャンネル上で同時に鳴る、ノート番号が異なる音符へ独立した変化を指定できますが、どの形式を実装するかは楽器側が決めます。

MIDI 1.0 でも CC メッセージを組み合わせれば 14 ビット値を表せます。表は単一の CC メッセージの値幅です。MIDI 2.0 には、機能を確認する MIDI-CI、コントローラの共通動作を定める Profiles、機器の情報を交換する Property Exchange もあります。これらは UMP の符号化とは別の仕組みです。ここで説明する libsonare の API はメッセージの作成・保存・送信を扱い、外部機器との機能交渉は行いません。

## Project イベントの形

`ProjectMidiEvent` は JavaScript では `{ ppq, data0, data1? }`、Python では `(ppq, data0, data1)` です。`data0` は最初の UMP ワード、`data1` は 2 番目のワードです（省略時は 0）。Project のイベントリストが運ぶのはチャンネルボイス UMP です。SysEx ペイロードは別のストアにあり、このフラットな型には含まれません。`setMidiEvents` はリストを置き換え、そのストアを破棄します。

`ppq` は 4 分音符単位の位置であり、480 ticks/4 分音符の整数ではありません。MT `0x2` の MIDI 1.0 チャンネルボイスは 1 ワード、MT `0x4` の MIDI 2.0 チャンネルボイスは 2 ワードです。

## MIDI 2.0 イベントを作る

JavaScript と Python の Project バインディングは同じパッカー群を公開します。

| 系統 | JavaScript | Python | データ |
|---|---|---|---|
| ノート | `midi2NoteOn`、`midi2NoteOff` | `midi2_note_on`、`midi2_note_off` | 16 ビットの発音／リリースベロシティ。ノートオンのベロシティ `0` もノートオンです |
| チャンネル表現 | `midi2Cc`、`midi2ChannelPressure`、`midi2PitchBend` | 対応する snake_case | 32 ビットの CC、プレッシャー、ベンド。ベンド中心は `0x80000000` です |
| ポリプレッシャー | `midi2PolyPressure` | `midi2_poly_pressure` | 1 ノートに対する 32 ビットプレッシャー |
| プログラム | `midi2Program` | `midi2_program` | 同じメッセージ内のプログラムと任意のバンク MSB/LSB |
| RPN / NRPN | registered / assignable と relative のパッカー | 対応する snake_case | 32 ビット値または符号付き差分 |
| パーノート | registered / assignable コントローラ、パーノートベンド | 対応する snake_case | パーノートのインデックス `0..255` または 32 ビットベンド |
| 管理 | `midi2PerNoteManagement` | `midi2_per_note_management` | 1 ノートの detach / reset フラグ |

ノート、グループ、チャンネル、コントローラ、プログラム、バンク、ノートコントローラのインデックスはプロトコルの範囲を使います。`midi2NoteOn` の `attributeType` と `attributeData` は任意です。type `3` は pitch 7.9 を運びます。

::: code-group

```typescript [ブラウザ / Node]
import { Project, init } from '@libraz/libsonare';

await init(); // ブラウザ／WASM では必要。この WASM パッケージは Node でも初期化が必要です
const project = new Project();
project.setSampleRate(48000);
const { clipId } = project.addMidiClip(0, 4);
const on = Project.midi2NoteOn(0, 0, 0, 60, 0xc000);
const bend = Project.midi2PerNotePitchBend(0.25, 0, 0, 60, 0x80000000);
const off = Project.midi2NoteOff(2, 0, 0, 60, 0x8000);
try {
  project.setMidiEvents(clipId, [on, bend, off]);
} finally {
  project.delete();
}
```

```python [Python]
import libsonare as sonare

with sonare.Project() as project:
    project.set_sample_rate(48000)
    _track_id, clip_id = project.add_midi_clip(0.0, 4.0)
    on = sonare.Project.midi2_note_on(0.0, 0, 0, 60, 0xC000)
    bend = sonare.Project.midi2_per_note_pitch_bend(0.25, 0, 0, 60, 0x80000000)
    off = sonare.Project.midi2_note_off(2.0, 0, 0, 60, 0x8000)
    project.set_midi_events(clip_id, [on, bend, off])
```

:::

MIDI 1.0 の対象には、MIDI 1.0 パッカーも使えます。`midiNoteOn`、`midiCc`、`midiChannelPressure` などの `midi*` メソッドは、7 ビット値と 14 ビットのピッチベンドを持つ正規の MIDI 1.0 UMP を作ります。MIDI 2.0 イベントを MIDI 1.0 へ変換すると値を縮小し、単一の MIDI 1.0 メッセージに対応しない形式を捨てます。その損失を許容できる場合だけ MIDI 1.0 経路を選んでください。

## リアルタイムで生 UMP をキューへ入れる

`RealtimeEngine.pushMidiUmp(destinationId, words, renderFrame = -1)` は、最上位ワードから並べた 1～4 個の 32 ビットワードを受け取ります。配列の長さは先頭ワードのメッセージタイプと一致する必要があります。MT `0x4` の MIDI 2.0 チャンネルボイスはフル解像度で渡されます。`setMidiInputSource(...)` の後で使う `pushMidiInputUmp(words, portTimeSamples = 0)` も同じ規則でエンジン所有の入力ソースへ入れます。

::: code-group

```typescript [ブラウザ / Node]
import { Project, RealtimeEngine, init } from '@libraz/libsonare';

await init();
const engine = new RealtimeEngine(48000, 128); // 制御スレッドのキュー。音声スレッドがレンダリングします
engine.setBuiltinInstrument({}, 0);
engine.setMidiInputSource(0);
const note = Project.midi2NoteOn(0, 0, 0, 60, 0xc000);
try {
  engine.pushMidiUmp(0, [note.data0, note.data1 ?? 0], -1);
  engine.pushMidiInputUmp([note.data0, note.data1 ?? 0], 0);
} finally {
  engine.destroy();
}
```

```python [Python]
import libsonare as sonare

engine = sonare.RealtimeEngine(48000, 128)  # コマンドをキューし、process() のブロックでレンダリングします
engine.set_builtin_instrument()
engine.set_midi_input_source(0)
try:
    note = sonare.Project.midi2_note_on(0.0, 0, 0, 60, 0xC000)
    engine.push_midi_ump(0, [note[1], note[2]], render_frame=-1)
finally:
    engine.close()
```

:::

AudioWorklet の `SonareEngine` ファサードにある `pushMidiUmp(trackId, word0, renderFrame = -1)` は 1 ワードだけを受け取ります。2 ワードの MIDI 2.0 チャンネルボイスには `RealtimeEngine` を使ってください。生の MT `0x3` / MT `0x5` データメッセージは `pushMidiUmp` で拒否されるため、完全な SysEx フレームを `pushMidiSysex` で送ります。キュー満杯や不正なワードはバインディングからエラーとして返ります。

## 組み込み受信側が適用するもの

3 種類の Project／リアルタイム楽器バインディングはいずれも、渡された値の幅を保った MIDI 2.0 チャンネルボイス UMP を受け取ります。表現の対応は楽器ごとに異なります。

| 受信側 | 適用するもの | 境界 |
|---|---|---|
| 組み込み波形シンセ | フル幅のノートベロシティ、チャンネルプレッシャー、ポリフォニックプレッシャー、パーノートベンド | MPE のベンド処理は組み込みシンセのゾーン設定に従います |
| NativeSynth | フル幅のノートベロシティ、チャンネルプレッシャー、ポリフォニックプレッシャー、パーノートベンド | RPN 0 がベンド範囲を制御します。ほかの MIDI 2.0 ステータスがすべてのパッチへ効くとは限りません |
| SoundFont プレイヤー | フル幅のノートベロシティ、チャンネルプレッシャー、ピッチベンド、MIDI 2.0 パーノートピッチ | ポリフォニックキープレッシャーは意図的に無視します。MPE のメンバーチャンネルはチャンネル表現を運べます |

受信側が表現の種類を無視しても、UMP には元のメッセージが残ります。生 UMP の経路と Web MIDI の便利な MIDI 1.0 メソッドは[MIDI 入力](./midi-input.md)を参照してください。

## MIDI 2.0 クリップファイル (`SMF2CLIP`)

MIDI 2.0 クリップファイルは、`SMF2CLIP` ヘッダを持つメモリ上の UMP コンテナです。`Project.exportClipFile()` はプロジェクトのテンポマップと MIDI クリップを 1 つのクリップコンテナへ書き出し、`importClipFile(...)` はインポートしたクリップを追加します。この形式は MIDI 2.0 のチャンネルボイスメッセージを値変換なしで保持します。

16 ビットベロシティ、32 ビット CC、パーノート／レジスタードコントローラ、バンク有効な Program Change を保持します。これらの値が重要な交換ではこの経路を使います。クリップファイルは SysEx7/8 データも運びます。書き出し時はプロジェクトの別ストアにある SysEx をファイルへ直列化し、読み込み時にそのストアへ戻します。

::: code-group

```typescript [ブラウザ / Node]
import { Project, init } from '@libraz/libsonare';

await init();
const project = new Project();
const imported = new Project();
try {
  const clipFile = project.exportClipFile(); // "SMF2CLIP" で始まる Uint8Array
  const clipId = imported.importClipFile(clipFile);
  console.log(clipId);
} finally {
  imported.delete();
  project.delete();
}
```

```python [Python]
import libsonare as sonare

with sonare.Project() as project, sonare.Project() as imported:
    clip_file = project.export_clip_file()  # b"SMF2CLIP" で始まる bytes
    clip_id = imported.import_clip_file(clip_file)
```

:::

[標準 MIDI ファイル](./project-editing-midi.md#標準-midi-ファイル-smf) は MIDI 1.0 ツールとの互換性に適しています。SMF はすべての MIDI 2.0 の値やパーノートメッセージを損失なく表現できません。プロジェクトの書き出しでは MIDI 1.0 に表現できない MIDI 2.0 専用イベントを捨てます。SMF はテンポ／拍子トラックを持つフォーマット 1、4 分音符あたり 480 ticks なので、MIDI 2.0 の完全なアーカイブではなく互換形式です。

## 境界を明示する

- `ProjectMidiEvent` は最初の 2 UMP ワードを持ち、プロジェクトイベントとして表現できるのはチャンネルボイスだけです。一般の UMP や SysEx のコンテナではありません。
- 生のリアルタイム `pushMidiUmp` は 1～4 ワードの完全なパケットを受け取りますが、MT `0x3` と MT `0x5` のデータメッセージを拒否します。SysEx には `pushMidiSysex` を使います。
- MIDI 1.0 パッカーは 7 ビットのチャンネル値と 14 ビットのピッチベンドを使います。MIDI 2.0 パッカーは上の表に示した 16／32 ビットのフィールドを使います。
- パケットの精度と受信側の対応は別です。特定の楽器が無視するポリプレッシャーやパーノートコントローラも、パケットには保持できます。

## 関連

- [MIDI クリップを編集する](./midi-editing.md) — プロジェクトのイベントリストを置換、検証、ルーティング、焼き込みします
- [音を MIDI ノートに変換する](./audio-to-notes.md) — 音声から MIDI 1.0 のノート対を作ります
- [MIDI 入力](./midi-input.md) — ライブ入力をバインドし、生 UMP と Web MIDI を区別します
- [プロジェクト MIDI](./project-editing-midi.md) — プロジェクトのテンポ、注釈、SMF 概要を扱います
