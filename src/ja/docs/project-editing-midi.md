---
title: プロジェクト MIDI
description: プロジェクト単位の MIDI 注釈、テンポ、交換、およびクリップ編集、MIDI 2.0、トランスクリプション、保存／読み込みへの導線を扱います。
---

# プロジェクト MIDI

このページはプロジェクト単位の MIDI ハブです。イベント編集、音声のトランスクリプション、音声内のノート編集、MIDI 2.0、永続化の詳細は各タスクページに分けています。以前のレイアウトからのリンクに対応するため、移動したセクションのアンカーはこのページに残しています。

| 目的 | ガイド |
|---|---|
| 音声をノートイベントへ変換する | [音を MIDI ノートに変換する](./audio-to-notes.md) |
| 音声内の計測ノートを編集する | [音声内の音符を編集する](./note-editing.md) |
| MIDI クリップを編集する | [MIDI クリップを編集する](./midi-editing.md) |
| MIDI 2.0 の値と UMP ワードを保つ | [MIDI 2.0・UMP・クリップファイル](./midi2.md) |
| プロジェクトをコンパイル、保存、読み込む | [プロジェクトのコンパイル・保存・読み込み](./project-save-load.md) |

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

MIDI クリップの作成、ノート対の検証、キャプチャしたストリームのルーティング、MIDI-FX の焼き込みは[MIDI クリップを編集する](./midi-editing.md#midi-の内容)に移動しました。

### `validateMidiNotes`

[`validateMidiNotes`（MIDI クリップを編集する）](./midi-editing.md#validatemidinotes)を参照してください。

### キャプチャした MIDI ストリームをルーティングする

[キャプチャした MIDI ストリームをルーティングする](./midi-editing.md#キャプチャした-midi-ストリームをルーティングする)を参照してください。

### MIDI-FX チェーンをクリップに焼き込む

[MIDI-FX チェーンをクリップに焼き込む](./midi-editing.md#midi-fx-チェーンをクリップに焼き込む)を参照してください。

## 自動テンポとグリッドスナップ

編集を拍に合わせる 2 つのヘルパーがあります。

- **`autoTempo(audio, sampleRate)`** はモノラルバッファからテンポを検出し、テンポマップとして設定し、主要な BPM を返します。
- **`snapToGrid(ppq, strength)`** は PPQ 座標をプロジェクトグリッドの最近接拍へスナップします。`strength` は `0..1`（1 で完全にスナップ）です。

```typescript
const bpm = project.autoTempo(monoMix, 48000); // テンポを検出して設定し、約 120 を返す
const snapped = project.snapToGrid(1.2, 1.0);  // 1.2 -> 1（最近接拍）
```

### 音声を MIDI クリップへ変換する

[音を MIDI ノートに変換する](./audio-to-notes.md#音声を-midi-クリップへ変換する)を参照してください。

## アレンジをコンパイルする

[プロジェクトのコンパイル・保存・読み込み](./project-save-load.md#アレンジをコンパイルする)を参照してください。

## 保存と読み込み: 決定的な JSON

[保存と読み込み: 決定的な JSON](./project-save-load.md#保存と読み込み-決定的な-json)を参照してください。

### モデルを読み戻し、読み込み後に音声を再バインドする

[モデルを読み戻し、読み込み後に音声を再バインドする](./project-save-load.md#モデルを読み戻し、読み込み後に音声を再バインドする)を参照してください。

### ホスト側で分離したステムを取り込む

[ホスト側で分離したステムを取り込む](./project-save-load.md#ホスト側で分離したステムを取り込む)を参照してください。

## MIDI 交換: SMF と MIDI 2.0 クリップファイル

交換形式にはそれぞれ役割があります。[MIDI 2.0 ガイド](./midi2.md)はフル解像度 UMP とクリップファイルの忠実度を扱い、このハブにはファイル形式を選ぶときに必要な SMF 互換性の事実を残します。

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

損失のない MIDI 2.0 経路は[MIDI 2.0 クリップファイル](./midi2.md#midi-2-0-クリップファイル-smf2clip)を参照してください。

### SMF を参照メロディにする: ノートターゲット

[SMF を参照メロディにする](./note-editing.md#smf-を参照メロディにする-ノートターゲット)を参照してください。

## 音声をレンダリングする

編集はタイムラインを生み、**レンダリング**はそれをサンプルへ変換します。`Project` は `bounce(...)`（オーディオトラックのみ）か、MIDI トラックを鳴らす楽器バインド付きバウンス（`bounceWithBuiltinInstrument`・`bounceWithSynthInstrument`・`bounceWithSf2Instrument`）でオフラインバウンスします。レンダーオプション一式、楽器バインド、SoundFont 読み込み、バウンスが報告する診断は [プロジェクトバウンス & レンダリング](./project-bounce.md) で扱います。

```typescript
// オーディオのみの簡易レンダー。ここでは MIDI トラックは無音です。
const audio = project.bounce({ numChannels: 2 });
```

アレンジがエラーなくコンパイルできたら、次は MIDI トラックを鳴らすことも含めて音声へ変換する番です。[プロジェクトバウンス & レンダリング](./project-bounce.md)へ進んでください。

## 関連

- [プロジェクト編集](./project-editing.md) — トラック、クリップ、テンポ、マーカー、ワープ、オートメーションを扱います
- [MIDI クリップを編集する](./midi-editing.md) — イベントリストと MIDI-FX を扱います
- [MIDI 2.0・UMP・クリップファイル](./midi2.md) — フル解像度の MIDI メッセージとクリップファイルを扱います
- [音を MIDI ノートに変換する](./audio-to-notes.md) — 一定テンポまたはプロジェクトのテンポマップへトランスクリプションします
- [プロジェクトのコンパイル・保存・読み込み](./project-save-load.md) — タイムラインのコンパイルと永続化を扱います
- [MIDI 入力](./midi-input.md) — ライブのコントローラ入力を扱います
- [プロジェクトのバウンス](./project-bounce.md) — タイムラインとバインドした楽器をレンダリングします
