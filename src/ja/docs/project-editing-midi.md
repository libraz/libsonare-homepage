---
title: プロジェクト MIDI
description: プロジェクト単位の MIDI 注釈、テンポ、交換、およびクリップ編集、MIDI 2.0、トランスクリプション、保存／読み込みへの導線を扱います。
---

# プロジェクト MIDI

このページでは、プロジェクト単位の MIDI として、キーとコードの注釈、アシストサイドカー、テンポ検出、SMF の取り込みと書き出し、外部 MIDI 機器を扱います。イベント編集、採譜、MIDI 2.0、永続化の詳細は下のタスクページを参照してください。

| 目的 | ガイド |
|---|---|
| 音声をノートイベントへ変換する | [音を MIDI ノートに変換する](./audio-to-notes.md) |
| 音声内の計測ノートを編集する | [音声内の音符を編集する](./note-editing.md) |
| MIDI クリップの編集、ノート対の検証、キャプチャしたストリームのルーティング、MIDI-FX の焼き込み | [MIDI クリップを編集する](./midi-editing.md) |
| MIDI 2.0 の値と UMP ワードを保つ | [MIDI 2.0・UMP・クリップファイル](./midi2.md) |
| コンパイル、保存、読み込み、音声の再バインド、ステムの取り込み | [プロジェクトのコンパイル・保存・読み込み](./project-save-load.md) |

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
    (0.0, 16.0, 0, 1),  # (start_ppq, end_ppq, tonic_pc, mode): C メジャー
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
- **キーモード**（`mode`）: `0` 不明、`1` major、`2` minor、`3` dorian、`4` phrygian、`5` lydian、`6` mixolydian、`7` locrian。解析側のモードを対応づけるには `keyModeFromAnalysis` を使います。
- **コードクオリティ**（`quality`）: `1` = major、`2` = minor、`3` = diminished、`4` = augmented、`5` = dominant、`6` = half-diminished、`7` = suspended。`extensions` はスケール度数（`7`・`9`・`13`、サスペンションなら `2` / `4`。最大 32 個）で、同じ系統内の種類を区別します（検出側のクオリティは[コード認識](./glossary/analysis/chord-recognition.md)を参照）。

つまり `{ tonicPc: 0, mode: 1 }` は C メジャー、`{ rootPc: 7, quality: 1 }` は G メジャーコードです。

::: warning これらは解析 API の列挙体ではなくアレンジ側の序数
ここでの `mode` と `quality` の数値は**アレンジ側の序数**で、`detectKey` / `detectChords` が返す**0 始まり**の `Mode`／`ChordQuality` 列挙体とは別物です。キーモードと基本的な 4 種類の三和音は 1 つずれます（解析側の major = 0、こちらでは 1）。解析 API の `ChordQuality.Minor`（= 1）を `annotateChords` の `quality` へ直接渡すと、ここでは**メジャー**として扱われます。`+1` のずれが成り立つのはその 4 種類の三和音だけで、拡張コードは系統とスケール度数に畳み込まれます。たとえば Dominant7 → `{ quality: 5, extensions: [7] }`、HalfDim7 → `{ quality: 6, extensions: [7] }`、Sus4 → `{ quality: 7, extensions: [4] }` です。手で対応づけず、次のセクションのライブラリ自身の変換表を使ってください。
:::

### 検出したコードやキーを変換する

`chordSymbolFromAnalysis(chord)`（Python は `chord_symbol_from_analysis`、C は `sonare_chord_symbol_from_analysis`）は、解析結果のコードを `{ rootPc, quality, extensions, slashBassPc }`（Python は snake_case キー）へ変換します。ライブラリが和声タイムラインを組み立てるときに使うのと同じ変換です。ルートは渡された値のまま保たれ、ベースがルートと同じなら `slashBassPc` は `255` です。`keyModeFromAnalysis(mode)`（`key_mode_from_analysis`、`sonare_key_mode_from_analysis`）は、解析側のモード名または序数からアレンジ側の `mode`（1〜7）を返します。時刻は変換されないので、結果は `startPpq` / `endPpq` と合わせて配置してください。認識できない値はフィールド名を挙げた `RangeError`（Python は `SonareValueError`）、オブジェクトでないコードは `TypeError` になります。

```typescript
const bpm = 120;                                  // プロジェクトの一定テンポ
const toPpq = (seconds: number) => (seconds * bpm) / 60;
const { chords } = detectChords(samples, sampleRate); // start / end は秒
project.annotateChords(
  chords.map((c) => ({ startPpq: toPpq(c.start), endPpq: toPpq(c.end), ...chordSymbolFromAnalysis(c) })),
);
project.annotateKeys([
  { startPpq: 0, endPpq: 16, tonicPc: key.root, mode: keyModeFromAnalysis(key.mode) },
]);
```

ここでの `toPpq` は、テンポが 1 つで一定であることを前提にしています。複数のセグメントやランプを含むテンポマップでは、[秒・サンプル・PPQ の換算](./glossary/arrangement/clips-and-tracks.md#秒・サンプル・ppq-の換算)の式で各時刻を換算してください。

注釈になる前に解析器が何を返すかは、[コード認識](./glossary/analysis/chord-recognition.md)と[キー検出](./glossary/analysis/key-detection.md)を参照してください。

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

## 自動テンポとグリッドスナップ

編集を拍に合わせる 2 つのヘルパーがあります。

`autoTempo(audio, sampleRate, candidateIndex?, applyTimeSignatures?, options?)` はモノラルバッファからテンポを検出し、テンポマップとして設定して BPM を返します。`analyzeTempo(audio, sampleRate, options?)` は候補（`primary` / `half` / `double`）を順位つきで返すだけで、プロジェクトは変更しません。候補の番号を `candidateIndex` に渡すとその候補を設定できます。その場合は両方の呼び出しに同じ `options` を渡してください。`options` はスコアリングの設定です。

| オプション | 既定値 | 意味 |
|------------|--------|------|
| `adaptiveTempo` | `false` | 録音の途中でテンポが動く演奏にビートトラッキングを追従させる。クリックに合わせた素材では無効のままにする |
| `tempoUpdateIntervalBeats` | ネイティブの既定値 | 局所テンポの推定に使う拍数（`adaptiveTempo` が有効なときだけ使用） |
| `rampThreshold` | `0.02` | 1 つのセグメントを閉じて次を開くテンポの相対変化量。小さいほど演奏に細かく追従する |
| `includeOctaveCandidates` | `true` | 主候補と並べて、半分・倍のテンポの候補も順位づけする |

`adaptiveTempo` を有効にすると、テンポが揺れる演奏は複数のテンポセグメントになり、[SMF では段階的なテンポイベントとして書き出されます](#標準-midi-ファイル-smf)。テンポ解析そのものは[解析](./analysis.md)で説明しています。

`snapToGrid(ppq, strength, division)` は PPQ 座標をプロジェクトグリッドの線へ丸めます。`strength` は `0..1`（1 で完全に丸める）です。`division` は `0` で小節、`1` で拍（既定）、それ以上は 1 拍あたりの分割数です（16 分音符なら `4`）。

::: code-group

```typescript [ブラウザ / WASM]
const bpm = project.autoTempo(monoMix, 48000); // テンポを検出して設定し、検出した BPM を返す
const snapped = project.snapToGrid(1.2, 1.0);  // 1.2 -> 1（最近接拍）
```

```python [Python]
bpm = project.auto_tempo(mono_mix, 48000)      # キーワードオプション: adaptive_tempo=True、ramp_threshold=0.05
snapped = project.snap_to_grid(1.2, 1.0)       # 1.2 -> 1（最近接拍）
```

:::

## MIDI 交換: SMF と MIDI 2.0 クリップファイル

交換形式にはそれぞれ役割があります。SMF は互換性を重視した 480 ティックの形式で、このページで扱います。MIDI 2.0 の値を損失なく保つにはクリップファイル（`SMF2CLIP`）を使います。詳しくは [MIDI 2.0・UMP・クリップファイル](./midi2.md#midi-2-0-クリップファイル-smf2clip)を参照してください。

### 標準 MIDI ファイル (SMF)

`exportSmf` は常にフォーマット 1（マルチトラック）で書き出します。トラック 0 がテンポ／拍子マップを、以降は各クリップが 1 つの MTrk となり、4 分音符あたり 480 ティックに量子化されます。低レベルの SMF エクスポーターでは、0 以外の PPQN は正の 15 ビット範囲 `0x0001`–`0x7fff` に収める必要があり、0 は既定値の 480 を選びます。クリップの終端やループ境界で途切れたノートはそこにノートオフが補われるので、ファイルにクリップをはみ出すノートが残ることはありません。インポーターはフォーマット 0 と 1 を受け付けますが、フォーマット 0 のヘッダーはトラック数をちょうど 1 としなければなりません。フォーマット 2、SMPTE タイミング、入力ヘッダーの PPQN 0 は拒否されます。

::: code-group

```typescript [ブラウザ / WASM]
const smf = project.exportSmf();        // Uint8Array<ArrayBuffer>: SMF フォーマット 1、480 PPQN
// … `smf` を .mid ファイルへ書き出す …

const fresh = Project.create();
try {
  const firstClip = fresh.importSmf(smf); // 最初に追加されたクリップ ID を返す
} finally {
  fresh.delete();
}
```

```python [Python]
smf = project.export_smf()              # bytes: SMF フォーマット 1、480 PPQN
# … `smf` を .mid ファイルへ書き出す …

with sonare.Project() as fresh:
    first_clip = fresh.import_smf(smf)  # 最初に追加されたクリップ ID を返す
```

:::

Node はブラウザ版パッケージと同じ呼び出しです。

SMF は離散的な Set Tempo イベントでテンポを表します。エクスポーターはテンポランプを 16 分音符ごとの段階に分け、各境界の時刻がプロジェクトのテンポマップに合うように書き出します。ティックとマイクロ秒単位の量子化による誤差は残ります。長いランプでは間隔を広げ、1 つのランプを最大 4096 イベントに収めます。最初のテンポセグメントが PPQ 0 より後に始まる場合は、その開始テンポをティック 0 にも書き込みます。これにより、セグメントより前のテンポもプロジェクトと一致します。読み込み直したマップは、元の連続的なランプではなく、書き出した段階的なテンポになります。

`exportSmf()` と `exportClipFile()` の返り値は `Uint8Array<ArrayBuffer>` で、`Blob` / `File` コンストラクタがそのまま受け取る型です。`new Blob([project.exportSmf()])` は `new Uint8Array(...)` で複製を挟まずにコンパイルが通ります。

インポート時、キーシグネチャのメタイベントは fifths 値が `-7..7` で、minor フラグが `0` または `1` の場合だけ保持されます。ペイロードがない、または無効なキーシグネチャはスキップされ、`skipped_events` に数えられます。トラックの残りの解析は続行します。

インポーターは破損をトラック内に封じ込めます。ある SMF トラックの可変長数値やペイロードが宣言境界を越えていても、そのトラック末尾へ再同期するため、ファイル全体を失敗させず後続の正常なトラックを引き続き取り込めます。

SMF が往復させているのは *演奏* です。それを記譜すれば、その同じノートのリストが楽譜になります。下の大譜表は MIDI クリップの記譜ビューです。再生すると、そこに保存されたイベントが鳴ります。

<SonareDemo id="midi-score" />

### SMF を参照メロディにする: ノートターゲット

[SMF を参照メロディにする](./note-editing.md#smf-を参照メロディにする-ノートターゲット)を参照してください。

## 音声をレンダリングする

編集はタイムラインを生み、**レンダリング**はそれをサンプルへ変換します。`Project` は `bounce(...)`（オーディオトラックのみ）か、MIDI トラックを鳴らす楽器バインド付きバウンス（`bounceWithBuiltinInstrument`・`bounceWithSynthInstrument`・`bounceWithSf2Instrument`）でオフラインバウンスします。レンダーオプション一式、楽器バインド、SoundFont 読み込み、バウンスが報告する診断は [プロジェクトバウンス & レンダリング](./project-bounce.md) で扱います。

```typescript
// オーディオのみの簡易レンダー。ここでは MIDI トラックは無音です。
const audio = project.bounce({ numChannels: 2 });
```

## トラックを外部 MIDI 機器へ送る

**内部デスティネーション**は libsonare 内の NativeSynth／SF2 の楽器で MIDI をレンダリングします。**外部デスティネーション**はその楽器を通さず、ホストがハードウェアや別アプリへ送るための MIDI 1.0 バイト列を出力キューへ入れます。libsonare はメッセージの変換と時刻付けを行いますが、OS／Web MIDI ポートを開くのはホスト側の役割です。

デスティネーションを外部に設定し、通常どおり音声処理した後、出力キューを高頻度に取り出します。生エンジンのメソッド名はバインディング間で共通で、ブラウザと Node は camelCase、Python は snake_case です。

::: code-group

```typescript [Browser]
engine.setMidiDestinationExternal(2, true); // デスティネーション 2 を外部機器へ送る
engine.setExternalMidiClockEnabled(true);  // 任意: clock + start/continue/stop

engine.process([leftBlock, rightBlock]);
for (const event of engine.drainExternalMidi(256)) {
  if (event.destinationId === 0xffffffff) {
    // クロック／トランスポートは、ホストが選んだ全外部ポートへ配信する。
    for (const output of externalOutputs.values()) output.send(event.bytes);
  } else {
    externalOutputs.get(event.destinationId)?.send(event.bytes);
  }
}
```

```typescript [Node]
// Node は WASM と同じ camelCase の生エンジンメソッドを公開する。
engine.setMidiDestinationExternal(2, true);
engine.setExternalMidiClockEnabled(true);

engine.process([leftBlock, rightBlock]);
for (const event of engine.drainExternalMidi(256)) {
  if (event.destinationId === 0xffffffff) {
    // クロック／トランスポートを、開いている全ハードウェアポートへ転送する。
    for (const port of externalPorts.values()) port.sendMessage([...event.bytes]);
  } else {
    externalPorts.get(event.destinationId)?.sendMessage([...event.bytes]);
  }
}
```

```python [Python]
engine.set_midi_destination_external(2, True)  # デスティネーション 2 を外部機器へ送る
engine.set_external_midi_clock_enabled(True)   # 任意: clock + start/continue/stop

engine.process([left_block, right_block])
for event in engine.drain_external_midi(256):
    if event.destination_id == 0xFFFFFFFF:
        # クロック／トランスポートを、開いている全ハードウェアポートへ配信する。
        for port in external_ports.values():
            port.send_message(list(event.bytes))
    else:
        port = external_ports.get(event.destination_id)
        if port is not None:
            port.send_message(list(event.bytes))

# 目安: 値が増え続ける場合、ホストが読み出す前にキューが満杯になっている。
dropped = engine.external_midi_dropped_count()
```

:::

各イベントは `destinationId`、`renderFrame`、`bytes`（1〜3 バイトの変換済み MIDI 1.0 メッセージ 1 個。Python では snake_case の `destination_id` ／ `render_frame`）を持ちます。クロック／トランスポートはデスティネーションの番兵値 `0xFFFFFFFF` を使い、チャンネルメッセージは元のデスティネーション id を保ちます。`maxRecords` は戻り値のメッセージ数を制限し、残りは次回の取り出しまでキューに残ります。`externalMidiDroppedCount()`（Python では `external_midi_dropped_count()`）が増え続ける場合、ホストが読み出す前に固定容量のリアルタイムキューが満杯になっています。

`SonareEngine` AudioWorklet ファサード（ブラウザ専用）では `setMidiDestinationExternal(trackId, true)` と `onMidiOut(callback)` を使います。worklet はレンダーブロックごとに内部エンジンからすでに取り出し、メインスレッドへバッチを送るため、別の消費側として生の取り出し呼び出しを使わないでください。

```typescript
engine.setMidiDestinationExternal('hardware-lead', true);
const unsubscribe = engine.onMidiOut((events) => {
  for (const event of events) {
    if (event.destinationId === 0xffffffff) {
      for (const output of externalOutputs.values()) output.send(event.bytes);
    } else {
      externalOutputs.get(event.destinationId)?.send(event.bytes);
    }
  }
});
```

## 関連

- [プロジェクト編集](./project-editing.md) — トラック、クリップ、テンポ、マーカー、ワープ、オートメーションを扱います
- [MIDI クリップを編集する](./midi-editing.md) — イベントリストと MIDI-FX を扱います
- [MIDI 2.0・UMP・クリップファイル](./midi2.md) — フル解像度の MIDI メッセージとクリップファイルを扱います
- [音を MIDI ノートに変換する](./audio-to-notes.md) — 一定テンポまたはプロジェクトのテンポマップへトランスクリプションします
- [プロジェクトのコンパイル・保存・読み込み](./project-save-load.md) — タイムラインのコンパイルと永続化を扱います
- [MIDI 入力](./midi-input.md) — ライブのコントローラ入力を扱います
- [プロジェクトのバウンス](./project-bounce.md) — タイムラインとバインドした楽器をレンダリングします
