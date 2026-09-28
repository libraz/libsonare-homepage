---
title: プロジェクトの MIDI・コンパイル・保存/読み込み
description: Project 上の MIDI イベントと MIDI-FX 焼き込み、キー／コード注釈の書き戻し、アシストサイドカー、自動テンポ、再生可能なタイムラインへのコンパイル、決定的な JSON での保存・読み込み、SMF / MIDI 2.0 クリップファイルの入出力を扱います。
---

# プロジェクトの MIDI・コンパイル・保存/読み込み

このページは [プロジェクト & アレンジ編集](./project-editing.md) の続きです。`Project` 上の MIDI コンテンツ、キー／コード注釈の書き戻し、アシストサイドカー、自動テンポ、再生可能なタイムラインへのコンパイル、決定的な JSON での保存・読み込み、SMF / MIDI 2.0 クリップファイルの相互運用を扱います。

## キーとコードの注釈書き戻し

プロジェクトは音楽的な注釈、すなわち解析器が生成した**キー**領域と**コード**シンボルを保持できます。これによりアレンジとともに移動し、保存／読み込みでも残ります。どちらのストリームも全置換で、アンドゥ可能です。

::: code-group

```typescript [ブラウザ / WASM]
project.annotateKeys([
  { startPpq: 0, endPpq: 16, tonicPc: 0, mode: 1 }, // C メジャー（tonicPc 0、mode 1 = major）
]);
project.annotateChords([
  { startPpq: 0, endPpq: 4, rootPc: 0, quality: 1, romanNumeral: 'I' },
  { startPpq: 4, endPpq: 8, rootPc: 7, quality: 1, romanNumeral: 'V' },
]);
```

```python [Python]
project.annotate_keys([
    (0.0, 16.0, 0, 1),  # (start_ppq, end_ppq, tonic_pc, mode) — C メジャー
])
project.annotate_chords([
    {"start_ppq": 0.0, "end_ppq": 4.0, "root_pc": 0, "quality": 1, "roman_numeral": "I"},
    {"start_ppq": 4.0, "end_ppq": 8.0, "root_pc": 7, "quality": 1, "roman_numeral": "V"},
])
```

:::

Python では `annotate_keys` が `(start_ppq, end_ppq, tonic_pc, mode)` タプルを、`annotate_chords` が WASM のオブジェクトと同じフィールド（snake_case キー）のマッピングを受け取ります。

数値フィールドはいずれも小さな固定エンコーディングです。

- **ピッチクラス**（`tonicPc`・`rootPc`）: `0..11` で、C = 0、C#/Db = 1、… B = 11。`255` は不明を表します。
- **キーモード**（`mode`）: `1` = major、`2` = minor。
- **コードクオリティ**（`quality`）: `1` = major、`2` = minor、`3` = diminished、`4` = augmented、`5` = dominant、`6` = half-diminished、`7` = suspended。`extensions` で同じ系統内の種類を区別します（検出側のクオリティは[コード認識](./glossary/analysis/chord-recognition.md)を参照）。

つまり `{ tonicPc: 0, mode: 1 }` は C メジャー、`{ rootPc: 7, quality: 1 }` は G メジャーコードです。

::: warning これらは解析 API の列挙体ではなくアレンジ側の序数
ここでの `mode` と `quality` の数値は**アレンジ側の序数**で、`detectKey` / `detectChords` が返す**0 始まり**の `Mode`／`ChordQuality` 列挙体とは別物です。キーモードと基本的な 4 種類の三和音は 1 つずれます（解析側の major = 0、こちらでは 1）。解析 API の `ChordQuality.Minor`（= 1）を `annotateChords` の `quality` へ直接渡すと、ここでは**メジャー**として扱われます。`+1` で変換できるのはその 4 種類の三和音だけです。拡張コードは系統と `extensions` を明示的に対応づけてください。たとえば Dominant7 → `{ quality: 5, extensions: [7] }`、HalfDim7 → `{ quality: 6, extensions: [7] }`、Sus4 → `{ quality: 7, extensions: [4] }` です。
:::

## アシストサイドカー

**アシストサイドカー**は、プロジェクトごとの不透明でアンドゥ可能なメタデータブロブです。AI アシストの提案、ツール用ペイロード、その他アレンジとともに運びたいバイナリ注釈を格納する場所になります。各サイドカーは**モジュール ID** と**ターゲットスコープ**（トラック ID と PPQ 領域）でキー付けされ、ストア全体はプロジェクト JSON の `assist_sidecars` キーの下にシリアライズされるため、`toJson()` / `fromJson()` の往復でも残ります。

```typescript
const payload = new TextEncoder().encode(JSON.stringify({ suggestion: 'tighten chorus' }));
project.setAssistSidecar({
  moduleId: 'my-assistant',  // 空にできない
  schemaVersion: 1,
  targetTrackId: 0,          // 0 = プロジェクトスコープ
  regionStartPpq: 0,
  regionEndPpq: 16,
  payload,                    // Uint8Array（コピーされる）
});

project.assistSidecars();     // プロジェクト順の全記述子
project.getAssistSidecar(0);  // { moduleId, schemaVersion, targetTrackId,
                              //   regionStartPpq, regionEndPpq, payload }
```

`moduleId` + `targetTrackId` + 領域スコープが既存のものと同じサイドカーは**置換**され、それ以外は追加されます。`targetTrackId` `0` はプロジェクトスコープを意味します。書き込みはアンドゥ可能な編集なので、`undo()` / `redo()` で取り消し・やり直しできます。

上の記述子形式が **WASM と Node** の標準 JavaScript API です。WASM には互換性のため、従来の位置引数形式 `setAssistSidecar(moduleId, schemaVersion, targetTrackId, regionStartPpq, regionEndPpq, payload)` も残っています。どちらの JavaScript バインディングにも件数、インデックスアクセサー、全件をまとめて読む `assistSidecars()` があります。**Python** は `set_assist_sidecar(module_id, payload, *, schema_version=0, target_track_id=0, region_start_ppq=0.0, region_end_ppq=0.0)` を使い（マッピング記述子も受け付けます）、`assist_sidecar_count()`、`get_assist_sidecar(index)`、`assist_sidecars()` で読み取ります。C ABI は位置引数の `sonare_project_set_assist_sidecar(...)` と、対応する count/get/free 関数です。

## MIDI の内容

MIDI クリップはフラットなイベントリストを保持します。`Project.midi*` 静的パッカー（正規の MIDI 1.0 ワードを生成します）でイベントを作り、`setMidiEvents` でクリップのリストを置き換えます。

::: warning `setMidiEvents` はクリップの SysEx を捨てる
クリップの SysEx ペイロード（GS リセットや Roland の DT1 セットアップブロック）はイベントリストの脇に置かれ、`ProjectMidiEvent` が持たないハンドルで参照されています。`importSmf()` は保持し、`exportSmf()` はバイト単位でそのまま書き戻し、`toJson()` も運びます。オフラインバウンスでも実際に反映され、インポートした SMF に埋め込まれた GS インサーションエフェクトのタイプ選択はレンダリング結果の音を変えます。`setMidiEvents()` はリストを置き換えるためペイロードを参照するものが何も残らず、1 回の呼び出しで全フレームが消えます。読み戻す入口もないので、先に退避して復元することもできません。GS のセットアップブロックを残す必要があるなら、クリップのイベントリストではなく書き出したファイルの側を編集してください。
:::

::: code-group

```typescript [ブラウザ / WASM]
project.setMidiEvents(midiClip, [
  Project.midiNoteOn(0, 0, 0, 60, 100),  // (ppq, group, channel, note, velocity)
  Project.midiNoteOff(2, 0, 0, 60),
  Project.midiNoteOn(2, 0, 0, 64, 100),
  Project.midiNoteOff(4, 0, 0, 64),
]);
project.setProgram(midiClip, 4);          // GM プログラム（例: 4 = エレクトリックピアノ）
```

```python [Python]
project.set_midi_events(midi_clip, [
    Project.midi_note_on(0.0, 0, 0, 60, 100),  # (ppq, group, channel, note, velocity)
    Project.midi_note_off(2.0, 0, 0, 60),
    Project.midi_note_on(2.0, 0, 0, 64, 100),
    Project.midi_note_off(4.0, 0, 0, 64),
])
project.set_program(midi_clip, 4)          # GM プログラム（例: 4 = エレクトリックピアノ）
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

MIDI アレンジを鳴らすには、レンダリング時に楽器をバインドします。[音声をレンダリングする](#音声をレンダリングする)、[内蔵シンセサイザー](./native-synth.md)、[SoundFont プレイヤー](./soundfont-player.md)を参照してください。コントローラからプロジェクトをライブ演奏するには、[MIDI 入力](./midi-input.md)を参照してください。

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

編集時の選択範囲や注釈を焼き込み後にも対応付けたいときは、リクエスト形式を使います。`sourceIndex` は正規順に並ぶ変換後の各イベントに対応する入力イベントの index です。入力に由来しないイベントは `-1` で、コードやアルペジエーターのように 1 つの入力から複数のイベントが出る場合は同じ index が複数回現れます。

```typescript
const count = project.previewMidiFxCount({ clipId: midiClip, configJson });
const { sourceIndex } = project.bakeMidiFx({
  clipId: midiClip,
  configJson,
  withSourceIndex: true,
});
```

`previewMidiFxCount(...)` はプロジェクトを変更せず、同じ決定的な変換を実行します。返る件数は続けて焼き込むイベント数と一致するため、出力バッファを正確に確保できます。従来の `bakeMidiFx(clipId, configJson)` 形式も使えますが、由来情報は返しません。Python では `project.preview_midi_fx_count(clip_id, config_json)` と `project.bake_midi_fx(clip_id, config_json, with_source_index=True)` を使います。

config は JSON オブジェクトで、**各ステージはそのパラメータをキーに**します。ステージのキーを含めれば有効になり、省けばスキップされます。未知のキーは無視されるため、打ち間違いは静かに何もしません。

| ステージ | キー |
|----------|------|
| トランスポーズ | `transpose_semitones` |
| ベロシティカーブ | `velocity_scale`、`velocity_offset`、`velocity_gamma`（>0） |
| クオンタイズ | `quantize_ppq`（>0）、`quantize_strength`（0–1、既定 1） |
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

## 自動テンポとグリッドスナップ

編集を拍に合わせる 2 つのヘルパーがあります。

- **`autoTempo(audio, sampleRate)`** はモノラルバッファからテンポを検出し、テンポマップとして設定し、主要な BPM を返します。
- **`snapToGrid(ppq, strength)`** は PPQ 座標をプロジェクトグリッドの最近接拍へスナップします。`strength` は `0..1`（1 で完全にスナップ）です。

```typescript
const bpm = project.autoTempo(monoMix, 48000); // テンポを検出して設定し、約 120 を返す
const snapped = project.snapToGrid(1.2, 1.0);  // 1.2 -> 1（最近接拍）
```

## アレンジをコンパイルする

`compile()` は編集済みプロジェクトを**再生可能なタイムライン**へ変換し、構造化された**診断**を報告します。エラー（重大度 `0`）はタイムラインを構築できなかったことを意味し、警告（重大度 `1`）は致命的でなく、タイムラインは依然として再生可能です。

```typescript
const result = project.compile();
// result.hasTimeline     -> エラーなしで再生可能なタイムラインが生成されたとき true
// result.diagnosticCount -> 診断の数
// result.diagnostics     -> [{ code, severity, targetId, message }, …]
// result.messages        -> 改行で連結した人間可読の詳細

if (!result.hasTimeline) {
  for (const d of result.diagnostics) {
    if (d.severity === 0) console.error(`コンパイルエラー (clip/track ${d.targetId}): ${d.message}`);
  }
}
```

よくある**致命的でない**警告として、MIDI クリップを含むが楽器がバインドされていないプロジェクトは正常にコンパイルされますが、無音でバウンスされます。バウンス後に、そのレンダリングが生成した警告を `lastBounceCompileResult()` で読めます。

```typescript
project.bounce({ numChannels: 2 });
const last = project.lastBounceCompileResult();
// last.diagnostics[0].message ->
//   "project contains MIDI clips; bounce is silent unless an instrument is bound"  (重大度 1)
```

Python では `project.compile()` が同じ形（`has_timeline`・`diagnostic_count`・`diagnostics`・`messages`）を返します。

## 保存と読み込み: 決定的な JSON

`toJson()` はプロジェクト全体（トラック、クリップ、MIDI の内容、ループクロスフェード、テンポマップ、拍子、マーカー、注釈、ワープマップ、オートメーション）を**決定的な JSON** にシリアライズします。同じプロジェクトは常にバイト単位で同一のテキストになります。`Project.fromJson(...)` で復元します。ループクロスフェードは 0 のときフィールドを省略するため、従来のハードループプロジェクトは同じ JSON 形状を保ちます。

```typescript
const json = project.toJson();
// … `json` をディスク・データベース・postMessage に保存 …

const restored = Project.fromJson(json);
try {
  // restored.toJson() === json
} finally {
  restored.delete();
}
```

致命的でない読み込み警告（たとえば修復のために保持された宙ぶらりんのソース参照）を取得したい場合は `Project.fromJsonWithDiagnostics(json)` を使います。

```typescript
const { project: loaded, diagnostics } = Project.fromJsonWithDiagnostics(json);
try {
  if (diagnostics) console.warn(diagnostics);
} finally {
  loaded.delete();
}
```

Python では `project.to_json()`・`Project.from_json(json)`・`Project.from_json_with_diagnostics(json)` が対応します。

### モデルを読み戻し、読み込み後に音声を再バインドする

プロジェクト JSON が保存するのは**アレンジ**であって PCM ではありません。そのため読み込んだプロジェクトはソースの存在は分かっていても、その実体となるサンプルを持っていません。読み取り専用のディスクリプタ 3 系統と PCM／ソースメタデータのセッターで、この輪を閉じます。

```typescript
const loaded = Project.fromJson(json);

for (let i = 0; i < loaded.trackCount(); i++) {
  const track = loaded.trackByIndex(i);      // { id, kind, midiDestinationId, gain, pan, mute, solo, name }
  console.log(track.id, track.name);
}
for (let i = 0; i < loaded.clipCount(); i++) {
  const clip = loaded.clipByIndex(i);        // { id, trackId, sourceId, startPpq, lengthPpq, … }
  console.log(clip.id, clip.startPpq, clip.lengthPpq);
}
const unresolvedAudioIds = new Set(loaded.unresolvedAudioSourceIds());
for (let i = 0; i < loaded.sourceCount(); i++) {
  const source = loaded.sourceByIndex(i);    // { id, kind, channelCount, sampleRateHint,
                                             //   nameOrUri, contentHash, externalStemRole }
  if (source.kind !== 0 || !unresolvedAudioIds.has(source.id)) continue; // 0 = audio、MIDI は除外
  const pcm = await decodeFromYourStorage(source.nameOrUri);
  loaded.setSourceAudio(source.id, pcm, source.channelCount, source.sampleRateHint);
  loaded.setAudioSourceMetadata(source.id, 'sha256:...', 'lead-vocal');
}

const audio = loaded.bounce({ sampleRate: 48000 });
```

`trackByIndex` / `clipByIndex` / `sourceByIndex` は保存順に対する 0 始まりのインデックスで、
`trackCount()` / `clipCount()` / `sourceCount()` と対になります。返るのはハンドルではなく
ディスクリプタなので、返り値を書き換えても何も変わりません。ホストがディスクから読み込んだ
プロジェクトをレンダリングしたいときや、自前のコードが構築したのではないプロジェクトに対して
UI を組むときに使います。

`setSourceAudio(sourceId, samples, channels, sampleRate)` は、バウンス前にデコード済み PCM を
ソースへ再バインドします。「読み込んだだけのアレンジ」を「レンダリングできるプロジェクト」に
変えるのがこの一手です。

`unresolvedAudioSourceIds()` は、デシリアライズ後もデコード済み PCM が必要なソース ID の公開リストです。ディスクリプタを走査するときの上の `kind !== 0` ガードは防御的なもので、`0` がオーディオ、`1` が MIDI です。MIDI ソースにはバインドする PCM も更新するソースメタデータもありません。オーディオソースのディスクリプタには所有メタデータ `contentHash` と `externalStemRole` もあり、MIDI ソースでは空文字列です。`setAudioSourceMetadata(sourceId, contentHash, externalStemRole)` は両方の文字列を 1 つのアンドゥ可能な編集として置き換え、空文字列で個別にクリアできます。WASM はこの位置引数形式を使い、Node は第 2 引数に `{ contentHash, externalStemRole }` のオブジェクトも受け付けます。Python は `set_audio_source_metadata(source_id, content_hash, external_stem_role)`（C ABI は `sonare_project_set_audio_source_metadata`）です。Python には `unresolved_audio_source_ids()` があり、ソースディスクリプタの名前は `content_hash` と `external_stem_role` です。C の getter が返すヒープ文字列は対応する free 関数で解放します。

### ホスト側で分離したステムを取り込む

アプリ側ですでに音源分離を済ませている場合（あるいは単に楽器ごとの WAV がある場合）、
`importExternalStems` はそれらを 1 トランザクションで、それぞれ 1 本のオーディオトラックと
クリップに変換します。

```typescript
const { trackIds, clipIds } = project.importExternalStems({
  sampleRate: 48000,
  stems: [
    { name: 'vocals', layout: 'stereo', planarSamples: [vocalL, vocalR], startFrame: 0 },
    { name: 'drums',  layout: 'stereo', planarSamples: [drumL, drumR],   startFrame: 0 },
    { name: 'bass',   layout: 'mono',   planarSamples: [bassMono],       startFrame: 0, role: 'bass' },
  ],
});
```

取り込みは**全件成功か全件失敗**です。1 つでも拒否されればプロジェクトは中途半端に埋まらず、
まったく変更されません。リサンプリング・タイミング調整・ゲイン補正は一切行いません。
すべてのステムはあらかじめ `sampleRate` に揃っている必要があり、`startFrame` はそのままの値で
プロジェクトのタイムライン上に配置されます。ステムごとの任意の `role` はホスト用メタデータで、
シリアライザーを往復しますが DSP には影響しません。

## MIDI 交換: SMF と MIDI 2.0 クリップファイル

プロジェクトのテンポマップと MIDI クリップは 2 つの形式で往復できます。

### 標準 MIDI ファイル (SMF)

`exportSmf` は常にフォーマット 1（マルチトラック）で書き出します。トラック 0 がテンポ／拍子マップを、以降は各クリップが 1 つの MTrk となり、4 分音符あたり 480 ティックに量子化されます。

```typescript
const smf = project.exportSmf();        // Uint8Array<ArrayBuffer> — SMF フォーマット1、480 PPQN
// … `smf` を .mid ファイルへ書き出す …

const fresh = new Project();
try {
  const firstClip = fresh.importSmf(smf); // 最初に追加されたクリップ ID を返す
} finally {
  fresh.delete();
}
```

`exportSmf()` と `exportClipFile()` の返り値は `Uint8Array<ArrayBuffer>` で、`Blob` / `File` コンストラクタがそのまま受け取る型です。`new Blob([project.exportSmf()])` は `new Uint8Array(...)` で複製を挟まずにコンパイルが通ります。

インポーターは破損をトラック内に封じ込めます。ある SMF トラックの可変長数値やペイロードが宣言境界を越えていても、そのトラック末尾へ再同期するため、ファイル全体を失敗させず後続の正常なトラックを引き続き取り込めます。

SMF が往復させているのは *演奏* です。それを記譜すれば、その同じノートのリストが楽譜になります。下の大譜表は MIDI クリップの記譜ビューです。再生すると、そこに保存されたイベントが鳴ります。

<SonareDemo id="midi-score" />

### MIDI 2.0 クリップファイル (`SMF2CLIP`)

SMF は MIDI 2.0 より前の形式なので、16 ビットベロシティ・32 ビット CC・パーノートコントローラ・バンク有効なプログラムチェンジを欠落なく運べません。**MIDI 2.0 クリップファイル**（`SMF2CLIP`）はこれらすべてを保持します。MIDI 2.0 の忠実度が重要なときはこちらを選んでください。

```typescript
const clipFile = project.exportClipFile();   // Uint8Array<ArrayBuffer>、"SMF2CLIP" ヘッダ
const firstClip = otherProject.importClipFile(clipFile);
```

Python ではこれらが `export_smf` / `import_smf` と `export_clip_file` / `import_clip_file` で、`bytes` を返し受け取ります。

### SMF を参照メロディにする: ノートターゲット

SMF にはクリップの往復以外にもう 1 つの使い道があります。録音したテイクを合わせにいく *譜面上のメロディ* として使うことです。このワークフローは（`Project` のメソッドではなく）モジュールレベルの 2 つの関数で成り立ちます。`noteTargetsFromSmf` がファイルから参照を読み出し、`assignNoteTargets` がそれを `extractNotes` でテイクから切り出したノートに適用します。[編集 DSP](./editing-dsp.md) の `pitchCorrectToMidi` がバッファ全体を 1 つの指定した音程差で動かすのに対し、このペアはノート 1 つ 1 つに固有のターゲットを与えます。

**ノート**（`NoteObject`）は実際に歌われたもので、サンプル単位の区間と計測された `medianHz` を持ちます。**ノートターゲット**（`NoteTarget`）はその区間が本来あるべき音で、`{ startSec, endSec, targetMidi }` の 3 つだけです。両者を別の型にしているのは、対応づけがインデックスではなく時刻で行われるからです。参照側が 1 音のところでテイク側は 2 音だったり 0 音だったりしますし、ターゲットは計測値を一切持ちません。ターゲットの時刻は PPQ ではなく **ノートを切り出した音声の先頭からの秒数** です。SMF はイベントを 4 分音符単位で記録しますが、`noteTargetsFromSmf` は各境界をファイル自身のテンポマップで変換するため、ファイル内のテンポ変更やテンポの傾斜（ランプ）は初期テンポで一律に換算されるのではなく、そのまま追従されます。

`noteTargetsFromSmf({ data, trackIndex? })` はメモリ上の SMF から 1 トラックを読み、`startSec` 順に並んだ `NoteTarget[]` を返します。各ノートオンは同じチャンネル・同じノート番号の次のノートオフと対にされ（最初のノートオフより前に再トリガーされた場合は新しい方の発音が閉じられます）、その対がノート自身のピッチを持つ 1 つのターゲットになります。きれいに対応づかない素材は推測せずに捨てられます。閉じられないままのノートオンには終端がなく、トラック末尾を代用すると、スタックした 1 つのノートオンがファイルの残り全体にまたがり、最長のオーバーラップとして以降の割り当てをすべて奪ってしまうためです。長さ 0 のノートも、何とも重ならないため捨てられます。閉じたノートが 1 つもないトラックはエラーではなく空配列を返します。`trackIndex`（既定 `0`）はファイル自身のトラック番号ではなく、**MIDI イベントを含むトラックだけ** を数えます。メタイベントしか持たないトラック（`exportSmf` がトラック 0 に書き出すコンダクタートラックがその典型です）はクリップを生まず数えられないので、プロジェクト自身の書き出しなら最初のクリップがインデックス `0` になります。読めないバイト列は `InvalidFormat`、MIDI を含むトラックが存在しないインデックスは `InvalidParameter` を送出します。

`assignNoteTargets({ notes, sampleRate, targets, unmatchedPolicy?, minOverlapRatio?, maxCorrectionSemitones? })` は各ノートを、最も長く重なるターゲットに対応づけます。ただしその重なりがノート自身の長さの `minOverlapRatio`（既定 `0.5`）以上であることが条件で、完全に同じ長さなら開始の早いターゲットが選ばれます。対応づいたノートの `edit.pitchShiftSemitones` には、`targetMidi` からノートの `medianHz` を MIDI ノート番号に換算した値を引いた差が書き込まれ、`maxCorrectionSemitones`（既定 `12`）で拒否ではなく飽和します。1 オクターブずれた参照は参照の側が間違っていて、呼び出しを拒否するより上限で抑えた補正のほうが多くを伝えるからです。`sampleRate` は各ノートの `onsetSample` / `offsetSample` を秒へ換算するのに使われるため、テイク自身のレートを渡してください。ピッチはあるのにターゲットのないノートは `unmatchedPolicy` に従います。

| `unmatchedPolicy` | ターゲットのない有音ノートの扱い |
|-------------------|----------------------------------|
| `'leave'`（既定） | 編集に触れず、録音どおりにレンダリングする |
| `'mute'` | `edit.muted` を立てる |
| `'nearest'` | どれだけ離れていても、時間的に最も近いターゲットを採る |

`medianHz` が有限の正の値でないノートは、ポリシーに関わらず割り当ても編集もされません。補正の起点となる計測ピッチがないからです。入力のノートは変更されません。結果は `{ notes, assignedCount }` で、`edit.pitchShiftSemitones` と `edit.muted` だけが書き換えられた新しい配列と、ターゲットを受け取ったノートの数です。0 も正当な答え（参照がテイクと噛み合っていない）なので、編集内容から推測させるのではなく数として返します。

```typescript
import { assignNoteTargets, extractNotes, noteTargetsFromSmf, pitchPyin, renderNotes } from '@libraz/libsonare';

// 1. 参照: プロジェクト自身の書き出し、または Uint8Array に読み込んだ任意の .mid ファイル。
const targets = noteTargetsFromSmf({ data: project.exportSmf() }); // メロディは trackIndex 0

// 2. テイク: F0 トラックの上でノートに切り出す。
const pitch = pitchPyin({ samples, sampleRate });
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

## 音声をレンダリングする

編集はタイムラインを生み、**レンダリング**はそれをサンプルへ変換します。`Project` は `bounce(...)`（オーディオトラックのみ）か、MIDI トラックを鳴らす楽器バインド付きバウンス（`bounceWithBuiltinInstrument`・`bounceWithSynthInstrument`・`bounceWithSf2Instrument`）でオフラインバウンスします。レンダーオプション一式、楽器バインド、SoundFont 読み込み、バウンスが報告する診断は [プロジェクトバウンス & レンダリング](./project-bounce.md) で扱います。

```typescript
// オーディオのみの簡易レンダー。ここでは MIDI トラックは無音です。
const audio = project.bounce({ numChannels: 2 });
```

アレンジがエラーなくコンパイルできたら、次は MIDI トラックを鳴らすことも含めて音声へ変換する番です。[プロジェクトバウンス & レンダリング](./project-bounce.md)へ進んでください。
