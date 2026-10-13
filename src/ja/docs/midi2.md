---
title: MIDI 2.0・UMP・クリップファイル
description: libsonare の各バインディングで MIDI 2.0 UMP パッカー、ライブの複数ワードメッセージ、MIDI 2.0 クリップファイルを使います。
---

# MIDI 2.0・UMP・クリップファイル

MIDI 2.0 のメッセージは、libsonare では Universal MIDI Packet（UMP）として通ります。UMP はパケットの運搬形式であり、MIDI 2.0 の意味論そのものではありません。メッセージタイプとステータスが MIDI の意味を定めます。MIDI 1.0 のチャンネルボイスを表す MT `0x2` は 1 ワード、MIDI 2.0 のチャンネルボイスを表す MT `0x4` は 2 ワードです。Project のイベントは PPQ 位置と最初の 2 UMP ワードを持つため、MIDI 1.0 と MIDI 2.0 のチャンネルボイスイベントを同じ `setMidiEvents` リストで扱えます。`Project.midi*` は MIDI 1.0 ワードを、`Project.midi2*` はフル解像度の MIDI 2.0 ワードを作ります。

プロトコルの定義は MIDI Association の [Universal MIDI Packet・MIDI 2.0 Protocol 仕様](https://midi.org/universal-midi-packet-ump-and-midi-2-0-protocol-specification)を参照してください。以下の受信側とバインディングの制限は libsonare の実装についての説明です。

::: info 値の幅と受信側の挙動
MIDI 2.0 UMP には 16 ビットのノートベロシティ、32 ビットのコントローラ／プレッシャー、32 ビットのピッチベンド、ノート単位メッセージを入れられます。生 UMP と MIDI 2.0 クリップファイルの経路では、その値の幅を保ちます。ただし受信する楽器が対応する表現は一部に限られることがあります。下の受信側の表を参照してください。
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

UMP のチャンネルボイスワードは 4 ビットのグループと 4 ビットの MIDI チャンネルを持ちます。グループは 16 チャンネルずつの独立した組で、16 組あるので 1 本の UMP ストリームで 256 チャンネルを指定できます。普通の MIDI 1.0 の構成ではグループ 0 を使います（[MIDI の基礎](./glossary/instruments/midi-basics.md#midi-ファイルと-midi-2-0)）。チャンネルボイスのメッセージタイプが値の配置を分けます。MT `0x2` は 1 ワードの MIDI 1.0 メッセージ、MT `0x4` は 2 ワードの MIDI 2.0 メッセージです。広い値のフィールドは 2 番目のワードに入ります。どちらの形式も 7 ビットのノート番号と同じグループ／チャンネル範囲を使います。

| 値または表現 | MIDI 1.0 チャンネルボイス | MIDI 2.0 チャンネルボイス |
|---|---:|---:|
| ノートベロシティ | 7 ビット | 16 ビット |
| CC、チャンネルプレッシャー、ポリフォニックプレッシャー | 7 ビット | 32 ビット |
| ピッチベンド | 14 ビット | 32 ビット |
| ノート単位コントローラとノート単位ピッチベンド | チャンネルボイスに相当する形式なし | MIDI 2.0 固有のメッセージ形式 |
| ノートオン属性 | 相当するフィールドなし | type と任意の 16 ビット属性データ |

MIDI 2.0 は値の精度を上げ、ノート単位表現を追加します。ただし、すべての受信側がすべてのメッセージを適用するわけではありません。別々のノート単位メッセージで、同じチャンネル上で同時に鳴る、ノート番号が異なる音符へ独立した変化を指定できますが、どの形式を実装するかは楽器側が決めます。

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
| ポリフォニックプレッシャー | `midi2PolyPressure` | `midi2_poly_pressure` | 1 ノートに対する 32 ビットプレッシャー |
| プログラム | `midi2Program` | `midi2_program` | 同じメッセージ内のプログラムと任意のバンク MSB/LSB。バンク有効が false のまま MSB／LSB に 0 以外を渡すと拒否される |
| RPN / NRPN | registered / assignable と relative のパッカー | 対応する snake_case | 32 ビット値または符号付き差分 |
| ノート単位 | registered / assignable コントローラ、ノート単位ベンド | 対応する snake_case | ノート単位のインデックス `0..255` または 32 ビットベンド |
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

`RealtimeEngine.pushMidiUmp(destinationId, words, renderFrame?)` は、最上位ワードから並べた 1〜4 個の 32 ビットワードを受け取ります。配列の長さは先頭ワードのメッセージタイプと一致する必要があります。MT `0x4` の MIDI 2.0 チャンネルボイスはフル解像度で渡されます。`setMidiInputSource(...)` の後で使う `pushMidiInputUmp(words, offsetInBlockSamples = 0)` も同じ規則でエンジン所有の入力ソースへ入れます。

::: code-group

```typescript [ブラウザ / Node]
import { Project, RealtimeEngine, init } from '@libraz/libsonare';

await init();
const engine = new RealtimeEngine(48000, 128); // 制御スレッドのキュー。音声スレッドがレンダリングします
engine.setBuiltinInstrument({}, 0);
engine.setMidiInputSource(0);
const note = Project.midi2NoteOn(0, 0, 0, 60, 0xc000);
try {
  engine.pushMidiUmp(0, [note.data0, note.data1 ?? 0]);
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
    engine.push_midi_ump(0, [note[1], note[2]])
finally:
    engine.close()
```

:::

AudioWorklet の `SonareEngine` ファサードは `pushMidiUmp(trackId, words, renderFrame?)` で完全なパケットを受け取ります。`words` は従来の 1 ワードの数値、または 1〜4 ワードの配列／`Uint32Array` にできます。エンジン所有の入力ソースに入れる `pushMidiInputUmp(words, offsetInBlockSamples = 0)` も同じ完全なパケットを受け取ります。生の MT `0x3`／`0x5` データメッセージはどちらの生 UMP 呼び出しでも拒否されるため、完全な SysEx フレームを `pushMidiSysex` で送ります。キュー満杯や不正なワードはバインディングからエラーとして返ります。

ライブのプログラムチェンジは、MIDI 2.0 メッセージ 1 件として送ります。デスティネーションには `pushMidiProgram(...)`、入力ソースには `pushMidiInputProgram(...)` を使います。従う受信側は一部だけです。シグネチャ、引数の範囲、受信側の表は [MIDI 入力](./midi-input.md#プログラムチェンジに従う受信側) を参照してください。

## 内蔵受信側が適用するもの

3 種類の Project／リアルタイム楽器バインディングはいずれも、渡された値の幅を保った MIDI 2.0 チャンネルボイス UMP を受け取ります。表現の対応は楽器ごとに異なります。

| 受信側 | 適用するもの | 境界 |
|---|---|---|
| 内蔵波形シンセ | フル幅のノートベロシティ、チャンネルプレッシャー、ポリフォニックプレッシャー、ノート単位ベンド | MPE のベンド処理は内蔵シンセのゾーン設定に従います |
| NativeSynth | フル幅のノートベロシティ、チャンネルプレッシャー、ポリフォニックプレッシャー、ノート単位ベンド | RPN 0 がベンド範囲を制御します。ほかの MIDI 2.0 ステータスがすべてのパッチへ効くとは限りません |
| SoundFont プレイヤー | フル幅のノートベロシティ、チャンネルプレッシャー、ピッチベンド、MIDI 2.0 ノート単位ピッチ | ポリフォニックキープレッシャーは意図的に無視します。MPE のメンバーチャンネルはチャンネル表現を運べます |

受信側が表現の種類を無視しても、UMP には元のメッセージが残ります。生 UMP の経路と Web MIDI の便利な MIDI 1.0 メソッドは[MIDI 入力](./midi-input.md)を参照してください。

## MIDI 2.0 クリップファイル (`SMF2CLIP`)

MIDI 2.0 クリップファイルは、`SMF2CLIP` ヘッダを持つメモリ上の UMP コンテナです。`Project.exportClipFile()` はプロジェクトのテンポマップと MIDI クリップを 1 つのクリップコンテナへ書き出し、`importClipFile(...)` はインポートしたクリップを追加します。この形式は MIDI 2.0 のチャンネルボイスメッセージを値変換なしで保持します。

16 ビットベロシティ、32 ビット CC、ノート単位／レジスタードコントローラ、バンク有効な Program Change を保持します。これらの値が重要な交換ではこの経路を使います。クリップファイルは SysEx7/8 データも運びます。書き出し時はプロジェクトの別ストアにある SysEx をファイルへ直列化し、読み込み時にそのストアへ戻します。SysEx8 ペイロードの先頭 `F0` や末尾 `F7` のデータバイトは、SMF とクリップファイルのどちらの書き出しでも保たれ、SMF の読み込みではメタイベントをまたいで分割された SysEx メッセージが 1 つに結合されます。

拍子の Flex Data は分母を 2 の指数 `e` として格納し、`2^e` にデコードします。クリップファイルでは `e = 0` を非標準分母用に予約するため、表現できる指数は `1..7`（分母 2..128）です。2 のべき乗でない分母を書き出すと、128 を上限として次に表現できるべき乗へ切り上げ、スキップイベント数を増やします。読み込んだ指数が `1..7` の範囲外ならスキップし、有効な拍子が PPQ 0 から始まらない場合は PPQ 0 に 4/4 を補います。`SMF2CLIP` ヘッダにはプロジェクト履歴やスキーマバージョンのフィールドがないため、現在のクリップファイル形式の交換データだけを保持し、プロジェクト履歴やバージョン交渉は保持しません。

読み込みには、時刻付きクリップデータの前に設定ヘッダ（最初のゼロ DCS と、それに続く 1 個の非ゼロ DCTPQ）が必要です。その後に完全な Start-of-Clip マーカーが 1 個、続いて完全な End-of-Clip マーカーが 1 個だけ現れなければなりません。マーカーの欠落、重複、逆順、後続データは拒否されます。メッセージ種別が要求するワード数に達する前に終わる切り詰められた UMP も拒否します。書き出しでは、明示した UMP の `word_count` がメッセージ種別と一致しない場合、出力を生成する前に拒否するため、壊れたパケットが部分的なクリップファイルとして公開されることはありません。

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

[標準 MIDI ファイル](./project-editing-midi.md#標準-midi-ファイル-smf) は MIDI 1.0 ツールとの互換性に適しています。SMF はすべての MIDI 2.0 の値やノート単位メッセージを損失なく表現できません。プロジェクトの書き出しでは MIDI 1.0 に表現できない MIDI 2.0 専用イベントを捨てます。SMF はテンポ／拍子トラックを持つフォーマット 1、4 分音符あたり 480 ticks なので、MIDI 2.0 の完全なアーカイブではなく互換形式です。

## 境界を明示する

- `ProjectMidiEvent` は最初の 2 UMP ワードを持ち、プロジェクトイベントとして表現できるのはチャンネルボイスだけです。一般の UMP や SysEx のコンテナではありません。
- 生のリアルタイム `pushMidiUmp` は 1〜4 ワードの完全なパケットを受け取りますが、MT `0x3` と MT `0x5` のデータメッセージを拒否します。SysEx には `pushMidiSysex` を使います。
- MIDI 1.0 パッカーは 7 ビットのチャンネル値と 14 ビットのピッチベンドを使います。MIDI 2.0 パッカーは上の表に示した 16／32 ビットのフィールドを使います。
- パケットの精度と受信側の対応は別です。特定の楽器が無視するポリフォニックプレッシャーやノート単位コントローラも、パケットには保持できます。

## 関連

- [MIDI クリップを編集する](./midi-editing.md) — プロジェクトのイベントリストを置換、検証、ルーティング、焼き込みします
- [音を MIDI ノートに変換する](./audio-to-notes.md) — 音声から MIDI 1.0 のノート対を作ります
- [MIDI 入力](./midi-input.md) — ライブ入力をバインドし、生 UMP と Web MIDI を区別します
- [プロジェクト MIDI](./project-editing-midi.md) — プロジェクトのテンポ、注釈、SMF 概要を扱います
