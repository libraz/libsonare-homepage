---
title: MIDI クリップを編集する
description: Project 上の MIDI イベントを作成、検証、ルーティング、変換し、必要に応じて焼き込みます。
---

# MIDI クリップを編集する

MIDI クリップは、プロジェクトのタイムライン上にある記号的なイベントリストです。このページでは、チャンネルボイスイベントの作成、クリップの置換、ノート対の検証、キャプチャした入力のルーティング、MIDI-FX を非破壊のまま使うか焼き込むかを扱います。フル解像度の MIDI 2.0 UMP パッカーとライブの複数ワードメッセージは、[MIDI 2.0・UMP・クリップファイル](./midi2.md)を参照してください。

::: info MIDI イベントは音声ではありません
`setMidiEvents` が変更するのは保存されたノートとコントローラのイベントです。PCM はレンダリングせず、変更もしません。クリップを音にするには楽器をバインドしてプロジェクトをバウンスします。[プロジェクト MIDI](./project-editing-midi.md#音声をレンダリングする) と[プロジェクトのバウンス](./project-bounce.md)を参照してください。
:::

<FlowDiagram
  title="MIDI クリップを編集する"
  :nodes="[
    { id: 'capture', label: 'キャプチャ／生成イベント', col: 0, row: 0 },
    { id: 'route', label: '検証またはルーティング', col: 1, row: 0 },
    { id: 'clip', label: 'プロジェクト MIDI クリップ', col: 2, row: 0, variant: 'accent' },
    { id: 'fx', label: 'MIDI-FX（任意で焼き込み）', col: 3, row: 0 },
    { id: 'render', label: '楽器によるレンダー', col: 4, row: 0, variant: 'success' }
  ]"
  :edges="[
    { from: 'capture', to: 'route' },
    { from: 'route', to: 'clip' },
    { from: 'clip', to: 'fx' },
    { from: 'fx', to: 'render' }
  ]"
  caption="クリップが保持するのは記号的なイベントです。ルーティングと MIDI-FX のあと、楽器が音声へ変換します。"
/>

## MIDI の内容

MIDI クリップはフラットなイベントリストを保持します。`Project.midi*` 静的パッカー（正規の MIDI 1.0 ワードを生成します）でイベントを作り、`setMidiEvents` でクリップのリストを置き換えます。

::: warning `setMidiEvents` はクリップの SysEx を捨てる
クリップの SysEx ペイロード（GS リセットや Roland の DT1 セットアップブロック）はイベントリストの脇に置かれ、`ProjectMidiEvent` が持たないハンドルで参照されています。`importSmf()` は保持し、`exportSmf()` はバイト単位でそのまま書き戻し、`toJson()` も運びます。オフラインバウンスでも実際に反映され、インポートした SMF に埋め込まれた GS インサーションエフェクトのタイプ選択はレンダリング結果の音を変えます。`setMidiEvents()` はリストを置き換えるためペイロードを参照するものが何も残らず、1 回の呼び出しで全フレームが消えます。読み戻す入口もないので、先に退避して復元することもできません。GS のセットアップブロックを残す必要があるなら、クリップのイベントリストではなく書き出したファイルの側を編集してください。
:::

::: code-group

```typescript [ブラウザ / WASM]
import { Project, init } from '@libraz/libsonare';

await init();
const project = new Project();
project.setSampleRate(48000);
const { clipId: midiClip } = project.addMidiClip(0, 4);
project.setMidiEvents(midiClip, [
  Project.midiNoteOn(0, 0, 0, 60, 100),  // (ppq, group, channel, note, velocity)
  Project.midiNoteOff(2, 0, 0, 60),
  Project.midiNoteOn(2, 0, 0, 64, 100),
  Project.midiNoteOff(4, 0, 0, 64),
]);
project.setProgram(midiClip, 4);          // GM プログラム（例: 4 = エレクトリックピアノ）
// 次の編集手順でも `project` を使い、終わったら project.delete() を呼ぶ。
```

```python [Python]
import libsonare as sonare

project = sonare.Project()
project.set_sample_rate(48000)
_track_id, midi_clip = project.add_midi_clip(0.0, 4.0)
project.set_midi_events(midi_clip, [
    sonare.Project.midi_note_on(0.0, 0, 0, 60, 100),  # (ppq, group, channel, note, velocity)
    sonare.Project.midi_note_off(2.0, 0, 0, 60),
    sonare.Project.midi_note_on(2.0, 0, 0, 64, 100),
    sonare.Project.midi_note_off(4.0, 0, 0, 64),
])
project.set_program(midi_clip, 4)          # GM プログラム（例: 4 = エレクトリックピアノ）
# 次の編集手順でも `project` を使い、終わったら project.close() を呼ぶ。
```

:::

Python では静的パッカーが `Project.midi_note_on(...)` / `Project.midi_note_off(...)` で、それぞれ `(ppq, data0, data1)` タプルを返します。イベントリストはそのタプルの任意のシーケンスです。

`setProgram` は 3 つ目の任意引数 `bank` を取ります——`setProgram(clipId, program, bank = -1)`。既定は `-1`（バンクセレクトを送出しない）で、`>= 0` を渡すとプログラムチェンジの前にバンクセレクトを送出します。クリップ既定ではなく特定の UMP（Universal MIDI Packet）グループ・チャンネルでプログラムを変えるには `setProgramOnChannel(clipId, group, channel, program, bank?)` を使います。どちらも WASM・Node・Python すべてで同じ任意の `bank` を取ります（`set_program(clip_id, program, bank=-1)`、`set_program_on_channel(clip_id, group, channel, program, bank=-1)`）。

::: warning `ppq` はティックではなく 4 分音符単位
`ppq` 引数は **4 分音符単位の位置**（浮動小数点）であり、MIDI のティック数ではありません。`Project.midiNoteOn(1, …)` は 4 分音符 1 つ分あと、`Project.midiNoteOn(0.5, …)` は 8 分音符 1 つ分あとを指します。名前に反して **480 ティック/4 分音符ではありません** — `Project.midiNoteOn(480, …)` は 4 分音符 480 個分（120 小節）先にノートを置くため、ほぼ常にレンダリング範囲のはるか外となり、何も鳴らずに終わります。ティックベースのソース（480 PPQ の SMF など）から変換する場合は、まずソースの「4 分音符あたりのティック数」で割ってください。同じ単位が `addMidiClip(startPpq, lengthPpq)` と、本ページのすべてのクリップ／オートメーション位置に適用されます。
:::

各静的パッカーは、`setMidiEvents` のリストにそのまま渡せる MIDI 1.0 の UMP ワード（1 つまたは複数）を返します。

| パッカー | シグネチャ | イベント |
|----------|------------|----------|
| ノートオン | `Project.midiNoteOn(ppq, group, channel, note, velocity)` | ノートオン |
| ノートオフ | `Project.midiNoteOff(ppq, group, channel, note, velocity?=0)` | ノートオフ |
| コントロールチェンジ | `Project.midiCc(ppq, group, channel, controller, value)` | CC |
| プログラムチェンジ | `Project.midiProgram(ppq, group, channel, program)` | プログラムチェンジ |
| バンク + プログラム | `Project.midiBankProgram(ppq, group, channel, bankMsb, bankLsb, program)` | バンクセレクト + プログラムチェンジ（複数イベントを返す） |
| ポリプレッシャー | `Project.midiPolyPressure(ppq, group, channel, note, pressure)` | ノート単位アフタータッチ |
| チャンネルプレッシャー | `Project.midiChannelPressure(ppq, group, channel, pressure)` | チャンネルアフタータッチ |
| ピッチベンド | `Project.midiPitchBend(ppq, group, channel, bend)` | ピッチベンド。`bend` は符号なし 14 ビット（`0`..`16383`、中央 `8192`）で、範囲外は `RangeError` を送出 |

イベントレベルの `Project.midiProgram(...)` パッカーはプログラムチェンジワードをクリップのイベントリスト内に置きます。上で示したクリップレベルの `project.setProgram(midiClip, program)`（クリップの既定プログラムを直接設定する便利メソッド）とは別物です。

### `validateMidiNotes`

バウンス前に MIDI クリップのハングノート、つまり対応するノートオフのないノートオン（またはその逆）を調べます。放置するとスタックノートが鳴ります。`validateMidiNotes` はチャンネル + ノートごとに FIFO でノートオンとノートオフを対応づけ、結果を報告します。

```typescript
const check = project.validateMidiNotes(midiClip);
// { ok: true, unmatchedNoteOns: 0, unmatchedNoteOffs: 0 }
if (!check.ok) {
  console.warn(`ハングノート: オン ${check.unmatchedNoteOns} / オフ ${check.unmatchedNoteOffs}`);
}
```

MIDI アレンジを鳴らすには、レンダリング時に楽器をバインドします。[プロジェクトバウンス](./project-bounce.md)、[内蔵シンセサイザー](./native-synth.md)、[SoundFont プレイヤー](./soundfont-player.md)を参照してください。コントローラからプロジェクトをライブ演奏するには、[MIDI 入力](./midi-input.md)を参照してください。

### キャプチャした MIDI ストリームをルーティングする

`Project.midiRouteEvents(events, config?)` は静的ヘルパーで、キャプチャした `ProjectMidiEvent` ストリームをネイティブの `MidiRouter`（フィルター／リマップ／チャンネルスルー）——ライブランタイムが使うものと同じルーター——に通し、`ProjectMidiRouteResult` を返します。録音した入力をクリップにする前に、オフラインで事前フィルターやリマップを行う用途に使えます。

```typescript
const routed = Project.midiRouteEvents(capturedEvents, {
  filterGroup: 0,        // グループ 0 だけ残す（省略 / null = 任意）
  filterChannel: 9,      // チャンネル 9（ドラムチャンネル）だけ残す
  remapChannel: 0,       // 残ったイベントをチャンネル 0 へ書き換える
  thru: true,            // 一致したイベントを通す
});
// routed.events       -> ProjectMidiEvent[]
// routed.overflowed   -> ルーターのバッファがイベントを取りこぼすと true
// routed.overflowCount-> 取りこぼしたイベント数
project.setMidiEvents(midiClip, routed.events);
```

config のフィールドはすべて任意で、JS/WASM では camelCase（`filterGroup`・`filterChannel`・`remapChannel`・`thru`）です。フィルターフィールドが `null` または省略なら「任意」を意味し、`remapChannel` を省略するとチャンネルは変更されません。Python では snake_case（`filter_group`・`filter_channel`・`remap_channel`・`thru`）です。このヘルパーは WASM・Node・Python すべてで利用できます。オフラインの MIDI ラーン（`Project.midiCcLearn`、[MIDI 入力](./midi-input.md)で解説）と組み合わせて使えます。

### MIDI-FX チェーンをクリップに焼き込む

MIDI-FX チェーン（トランスポーズ、ベロシティカーブ、ヒューマナイズなど）は通常、クリップのイベントに重なる**非破壊**のレイヤーとして働きます。`bakeMidiFx` はその逆で、チェーンを 1 回実行し、その結果で**クリップに保存された MIDI イベントを書き換えます**。これにより変換後のノートがクリップの実体になります。エフェクトをアレンジに固定したいときは焼き込み、まだ調整したいときは非破壊のままにしておきます。

```typescript
const configJson = JSON.stringify({ transpose_semitones: 12 }); // 1 オクターブ上げる
project.bakeMidiFx(midiClip, configJson);                        // イベントがその場でトランスポーズされる
```

編集時の選択範囲や注釈を焼き込み後にも対応付けたいときは、リクエスト形式を使います。`sourceIndex` は正規順に並ぶ変換後の各イベントに対応する入力イベントの index です。各 index は必ず `0..入力イベント数-1` の範囲にあり、コードやアルペジエーターのように 1 つの入力から複数のイベントが出る場合は同じ index が複数回現れます。

```typescript
const count = project.previewMidiFxCount({ clipId: midiClip, configJson });
const { sourceIndex } = project.bakeMidiFx({
  clipId: midiClip,
  configJson,
  withSourceIndex: true,
});
```

`previewMidiFxCount(...)` はプロジェクトを変更せず、同じ決定的な変換を実行します。返る件数は続けて焼き込むイベント数と一致するため、出力バッファを正確に確保できます。従来の `bakeMidiFx(clipId, configJson)` 形式も使えますが、由来情報は返しません。Python では `project.preview_midi_fx_count(clip_id, config_json)` と `project.bake_midi_fx(clip_id, config_json, with_source_index=True)` を使います。

config は JSON オブジェクトで、**各ステージの有効／無効はそのパラメータのキーの有無で決まります**。ステージのキーを含めれば有効になり、省けばスキップされます。未知のキーは無視されるため、キーを打ち間違えてもエラーにならず、何も起きません。

| ステージ | キー |
|----------|------|
| トランスポーズ | `transpose_semitones` |
| ベロシティカーブ | `velocity_scale`、`velocity_offset`、`velocity_gamma`（>0） |
| クオンタイズ | `quantize_ppq`（>0）、`quantize_strength`（0–1、既定 1） |
| ヒューマナイズ | `humanize_ppq`（>=0）、`humanize_velocity`（0〜127）、`seed`（非負の整数）。タイミングとベロシティへ再現可能な揺らぎを加える |
| コード | `chord_intervals`（半音オフセットの配列、1〜8 要素） |
| アルペジエーター | `arpeggiator_intervals`（半音オフセットの配列、1〜16 要素）、`arpeggiator_step_ppq`（>0）、`arpeggiator_gate_ppq`（既定はステップ長で、それに丸められる） |

`chord_intervals` は 8 要素、`arpeggiator_intervals` は 16 要素が上限です。空配列、またはいずれかの上限を超える配列を渡すと、`bakeMidiFx` は黙って切り詰めるのではなく `SONARE_ERROR_INVALID_PARAMETER` を投げます。

```typescript
// 押さえた各ノートを 3 ステップの上昇アルペジオにする（1 ステップ 16 分音符）。
project.bakeMidiFx(midiClip, JSON.stringify({
  arpeggiator_intervals: [0, 4, 7],
  arpeggiator_step_ppq: 0.25,
  arpeggiator_gate_ppq: 0.2,
}));
```

書き換えは破壊的ですが、ほかの編集と同様にアンドゥ可能です。`undo()` で元のイベントに戻ります。

## 関連

- [音声を MIDI に変換する](./audio-to-notes.md) — モノラル録音をプロジェクトの MIDI イベントに変換します
- [MIDI 2.0・UMP・クリップファイル](./midi2.md) — フル解像度のパッカー、ライブ UMP、忠実度を保つ交換を扱います
- [MIDI 入力](./midi-input.md) — ライブのコントローラ入力を楽器へルーティングします
