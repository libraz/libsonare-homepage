---
title: JavaScript/TypeScript API リファレンス
description: libsonare JavaScript/TypeScript パッケージのリファレンスの入口です。インストール、インポート、初期化と、主題別リファレンスページの一覧を掲載します。
---

# JavaScript/TypeScript API リファレンス

libsonare JavaScript/TypeScript パッケージの API リファレンス。

## 概要

libsonare は Web アプリケーション向けのオーディオ解析、マスタリング、ミキシング、編集 DSP を提供します。npm パッケージは WebAssembly ビルドです。実際の呼び出しでは、多くの関数がデコード済みの `Float32Array` PCM を受け取ります。PCM とは、MP3 や WAV などのファイルを展開した後の生のサンプル値です。読み込み用途には `Audio.fromMemory*` ファクトリがあり、エンコード済みバイト列をメモリ内でデコードできます（WAV／MP3 はネイティブ WASM デコーダ、AAC／OGG／FLAC は任意のブラウザデコーダ）。

最初のブラウザ実装では、手順を絞ると迷いにくくなります。

1. アプリ起動時に `await init()` を 1 回呼ぶ。
2. ユーザーのファイルをサンプルへデコードし、元の `sampleRate` を保持する。
3. まず `detectBpm(samples, sampleRate)` のような小さな関数を 1 つ呼ぶ。
4. その後で `analyze`、マスタリング、ミキシング、ストリーミング API へ進む。

| カテゴリ | 関数 | ユースケース |
|----------|-----------|-----------|
| **クイック解析** | `detectBpm`, `detectKey`, `detectBeats` | DJアプリ、音楽プレイヤー、ビート同期 |
| **総合解析** | `analyze`, `analyzeWithProgress` | 音楽制作、楽曲メタデータ |
| **オーディオエフェクト** | `hpss`, `timeStretch`, `pitchShift`, `spectralEdit` | リミックス、練習ツール、領域補修 |
| **特徴量** | `melSpectrogram`, `chroma`, `mfcc` | ML 入力、可視化 |
| **マスタリング** | `masterAudio`, `masteringChain`, `StreamingMasteringChain` | LUFS（Loudness Units relative to Full Scale）ターゲット、True Peak リミッター、プリセット、ストリーミングチェーン |
| **ミキシング** | `mixStereo`, `Mixer`, `mixingScenePresetNames` | ステムミックス、ルーティング、オートメーション、メーター |
| **編集 DSP** | `pitchCorrectToMidi`, `noteStretch`, `spectralEdit`, `voiceChange`, `StreamingRetune`, `RealtimeVoiceChanger` | ボーカル補正、ノート編集、ピッチ／フォルマント変更 |
| **Audio クラス** | `Audio.fromBuffer`, `Audio.fromMemory`, `Audio.fromMemoryWithBrowserFallback` | ファイル読み込みと、よく使う関数をメソッド形式で呼ぶための補助 |

::: tip 用語について
オーディオ解析が初めてですか？[用語集](/ja/docs/glossary) で BPM、STFT、Chroma などの用語の説明をご覧ください。
:::

::: info 多くの関数はファイルパスではなくデコード済み PCM を受け取ります
ブラウザ版の多くの関数は、MP3 や WAV のパスではなく、デコード済みの PCM サンプルと `sampleRate` を受け取ります。エンコード済みバイト列からサンプルへ変換するには、Web Audio API（`AudioContext.decodeAudioData`）で自分でデコードするか、後述の `Audio.fromMemory` / `Audio.fromMemoryWithBrowserFallback` ファクトリを使います。これらはエンコード済みバイト列をメモリ内でデコードします。WAV／MP3 は同梱 WASM デコーダを使い、AAC／OGG／FLAC は必要に応じてブラウザ側デコードを使います。
:::

バインディングごとの機能対応は [機能マップ](./api-surface.md) を参照してください。マスタリングプロセッサの登録一覧とミキシングシーン形式は、[マスタリングプロセッサ](./mastering-processors.md) と [ミキシングシーン JSON](./mixing-scene-json.md) にまとめています。

## このリファレンスの読み方

このページは 3 段階で読むと迷いにくくなります。

1. まず [目的から API を選ぶ](#目的から-api-を選ぶ) で、使う関数ファミリーを 1 つ選ぶ。
2. そのファミリーの節だけを読み、[使用例](./examples.md) から近いレシピを 1 つ動かす。
3. 戻り値の正確な形、オプション引数、実行環境間の違いが必要になったら、型定義や詳細表に戻る。

ブラウザアプリでは、`await init()` で WASM を初期化し、ファイルを先に PCM へデコードし、`Float32Array` サンプルと元の `sampleRate` を渡す、という基本を常に守ってください。

## 単発 API のリクエストオブジェクト

トップレベルの単発解析・エフェクト・マスタリング・メータリング・特徴量・ミキサー・ボイスチェンジャー API は、名前付きの**リクエストオブジェクト**を標準形式として使います。すべての入力が名前で分かり、引数順を崩さず任意設定を増やせ、TypeScript の `*Request` 型も利用できます。位置引数形式は互換オーバーロードであり、既定値、検証、エラー、結果、進捗コールバックは同じです。

```typescript
// 推奨: リクエストオブジェクト形式
const bpm = detectBpm({ samples, sampleRate });
const mastered = masterAudio({
  samples,
  sampleRate,
  preset: 'pop',
  overrides: { loudness: { targetLufs: -14 } },
  onProgress: (progress, stage) => console.log(stage, progress),
});

// 既存コード向けの位置引数形式も利用可能
const legacyBpm = detectBpm(samples, sampleRate);
```

リクエストのフィールド名は Node と WASM で同じ camelCase です。Python は JavaScript 形式の options object ではなく、従来どおりキーワード引数（`detect_bpm(samples, sample_rate=...)`）を使います。

### 長い処理をキャンセルする

進捗を報告するリクエストは `cancel` も受け取ります。これは `onProgress` が発火するのと
同じネイティブ境界でポーリングされる述語で、`true` を返すと呼び出しが中断されます。

```typescript
import { ErrorCode, isSonareError, masterAudio } from '@libraz/libsonare';

let abandoned = false;
cancelButton.onclick = () => { abandoned = true; };

try {
  const mastered = masterAudio({
    samples,
    sampleRate,
    preset: 'pop',
    onProgress: (progress, stage) => updateUi(progress, stage),
    cancel: () => abandoned,
  });
} catch (error) {
  if (!(isSonareError(error) && error.code === ErrorCode.Cancelled)) throw error;
}
```

キャンセルされた呼び出しは `SONARE_ERROR_CANCELLED`（エラーコード 8）で例外になり、
出力を確保しません。途中結果を調べることはできません。Python も同じ述語を `cancel=` で受け取ります。

### 入力は変換されずに検証されます

Node と WASM は、以前なら黙って解釈し直していた値を拒否します。型の合わないリペア・
ダイナミクスのオプション、未知のトラック種別・キャプチャソース・ピッチ補正モード、
負のスペクトラム設定、宣言されていない enum の綴りや序数、数値でも真偽値でもない
マスタリングのオーバーライド値などです。インスタンスメソッドも `destroy()` 後は解放済み
ハンドルに触れずに例外を投げます。以前は意外な既定値になっていた箇所で、
呼び出し地点に `SonareError` が返るようになります。

## 目的から API を選ぶ

関数数が多いため、まず「何を作りたいか」から最小の API を選ぶのが近道です。

| やりたいこと | 最初に使う API | 理由 |
|--------------|----------------|------|
| トラックのテンポ、キー、ビートだけ欲しい | `detectBpm`, `detectKey`, `detectBeats` | `analyze(...)` 全体を走らせず、必要な値だけを直接得られます |
| 曲全体のメタデータが欲しい | `analyze` または個別の `analyze*` ヘルパー | `analyze` は概要、個別ヘルパーは詳細向きです |
| ライブビジュアライザや更新されていく BPM/キー/コード UI | `StreamAnalyzer` | 小さな音声ブロックを処理し、UI が最新フレームを読み出せます |
| ブラウザでマスタリングや配信プレビュー | `masterAudio*`, `masteringChain*`, `StreamingMasteringChain` | まずプリセット、必要に応じて名前付きプロセッサへ進めます |
| ステムのバランス、センド、バス、メーター | `mixStereo` または `Mixer` | まず一括レンダー、ルーティングが必要ならシーンミキサーを使います |
| ボーカル、ノート、スペクトル領域を編集したい | `pitchCorrectToMidi`, `noteStretch`, `spectralEdit`, `voiceChange`, `StreamingRetune`, `RealtimeVoiceChanger` | 解析ではなく音そのものを変える API です |
| 部屋の残響、明瞭度、等価ルーム推定、ルーム生成を扱いたい | `analyzeImpulseResponse`, `detectAcoustic`, `estimateRoom`, `synthesizeRir`, `roomMorph` | 楽曲ではなく録音空間を説明・適用します |

## インストール

::: code-group

```bash [npm]
npm install @libraz/libsonare
```

```bash [yarn]
yarn add @libraz/libsonare
```

```bash [pnpm]
pnpm add @libraz/libsonare
```

:::

## インポート

```typescript
import {
  init,
  Audio,
  detectBpm,
  detectKey,
  detectBeats,
  detectOnsets,
  analyze,
  analyzeWithProgress,
  version
} from '@libraz/libsonare';
```

## 初期化

### `init(options?)`

WASM モジュールを初期化します。解析関数を使用する前に呼び出す必要があります。

```typescript
async function init(options?: {
  locateFile?: (path: string, prefix: string) => string;
}): Promise<void>
```

**例:**

```typescript
import { init, detectBpm } from '@libraz/libsonare';

// 基本的な初期化
await init();

// カスタムファイルロケーション
await init({
  locateFile: (path, prefix) => `/custom/wasm/path/${path}`
});
```

### `isInitialized()`

モジュールが初期化済みかどうかを確認します。

```typescript
function isInitialized(): boolean
```

### `version()`

ライブラリのバージョンを取得します。

```typescript
function version(): string  // 例: "{{ wasmMeta.version }}"
```

### `capabilities()`

実際に読み込まれているビルドの内容を返します。CLI が `doctor` で表示するのと同じレポートです。
同期関数で、`init()` の後にのみ有効です。

```typescript
function capabilities(): {
  version: string;
  abi: { project: number; engine: number };
  platform: string;
  features: {
    mastering: boolean;
    mixing: boolean;
    fx: boolean;
    ffmpeg: boolean;
    mixingAssistant: boolean;
    instrumentParamAutomation: boolean;
  };
  decode: { builtin: string[]; ffmpeg: string[] };
  simd: string;
  hardwareConcurrency: number;
}
```

推測せず `features` で分岐してください。`mixing` を持たないビルドには `Mixer` がありません。
また `decode.builtin` を見れば、ブラウザ側のフォールバックを試す前に、そのモジュールが
どの形式を開けるか分かります。

`mixingAssistant` と `instrumentParamAutomation` は、ホストにとってもっとも必要でありながら、
もっとも見落とされやすい 2 つのプローブです。これらが守るエントリポイントは、サブシステムの
有無にかかわらず登録されたままだからです。`suggestMixScene` と楽器パラメータのオートメーション
ターゲットは、どのモジュールにも関数として存在し、サブシステムを欠くビルドでは呼び出し時に
**例外を投げます**。したがって関数の存在を調べても何も分からず、`typeof fn === 'function'` は
ケイパビリティ判定にはなりません。アレンジメントのサブシステムを持たないビルドでは
`instrumentParamAutomation` が `false` を返します。`mixingAssistant` は解析専用モジュールでは
コンパイル時に除外されるため、シンボルが存在していても `false` を返します。

### `capabilityCatalog()`

各プロセッサ、そのパラメータ記述子、組み込みプリセット一覧を、機械可読なカタログとして
返します。C ABI が公開し Python が `capability_catalog` として公開しているのと同じ正規
JSON で、`schemas/capability-catalog.schema.json` で検証されます。

カタログは実際の値を持っています。公開される 88 個のプロセッサ全体で 1147 個のパラメータが
あり、`default` はそのすべてが非 null です。`min` は 316 個、`max` は 193 個が非 null で、
残る 802 個は上下限とも `null` です。`null` は「そのパラメータに関する制限をカタログが把握
していない」という意味であって、範囲情報が一般に得られないという意味ではありません。

::: warning 範囲は実測値であり、実測ゆえの注意点がある
公開される範囲は**送ってよい値の厳密な制約であって、UI の推奨レンジではありません**。しかも、
そのプロセッサの他のパラメータをすべて既定値に置いた状態で測られています。スライダーを直結
する前に知っておきたい帰結が 3 つあります。

- **互いを制約し合う 2 つのパラメータは、それぞれ相手の既定値を報告します。**
  `maximizer.adaptiveRelease` が `minReleaseMs <= 250`、`maxReleaseMs >= 20` と返すのはまさに
  これが理由で、一方を動かせばもう一方の実際の限界も動きます。
- **サンプルレートから導かれる範囲は、prepare 前のプロセッサを反映します。**
  EQ の `band*.frequencyHz` の上限はカタログ上どれも `24000` と読め、インサートをより高い
  レートで prepare した時点で上がります。
- **開区間の境界は、除外される側の値そのものとして報告されます。**
  `dynamics.compressor.sidechainHpfHz` は `min` に `0` を返しますが、`0` は拒否されます。
:::

```typescript
function capabilityCatalog(): {
  version: string;
  abi: { project: number; engine: number };
  processors: Array<{
    id: string;
    kind: 'realtime' | 'offline' | 'pair';
    realtimeInsertable: boolean;
    stereoOnly: boolean;
    latencySamples: number;
    tailSamples: number;
    /** リアルタイム処理コストの目安。インサート不可のプロセッサでは必ず null */
    realtimeCost: 'low' | 'moderate' | 'high' | null;
    channelPolicy: 'multichannel' | 'stereoPairOnly' | 'perChannel' | 'passthrough';
    category: string;
    params: Array<{
      name: string;
      id: number;
      rtSafe: boolean;
      type: 'boolean' | 'number';
      min: number | null;
      max: number | null;
      default: boolean | number | null;
      unit: string | null;
    }>;
  }>;
  presets: {
    mastering: string[];
    synth: string[];
    mixingScene: string[];
    voiceChanger: string[];
  };
}
```

汎用のパラメータ UI はこれを基に作れます。各スライダーの範囲と既定値は、手で管理する表では
なくカタログから得られます。コアが把握していない範囲は明示的な `null` で報告されるので、
0 ではなく「上限・下限なし／不明」として扱ってください。

バンドごとの EQ サーフェスは、各バンドフィールドについて `type` と `default` を公開するため、
汎用 UI が手書きの表なしにバンドを並べられます。公開されるパラメータ数は `eq.parametric` が
72 個、`eq.midSide` が 144 個、`multiband.dynamicEq` が 264 個です。ただし既定値を公開しても、
どのキーが**読まれた**とみなされるかは変わりません。不完全に渡したバンドは、従来どおり余分な
キーを「無視した」と報告します。

### `abiVersion()`

C POD 公開 API 全体を集約したネイティブ ABI バージョンを返します。ビルド済みバイナリを読み込む際に保存・比較しておくと、互換性のない JS／ネイティブ成果物の組み合わせを早期に検出できます。

```typescript
function abiVersion(): number
```

### `projectAbiVersion()`

`Project` のシリアライズ、バウンス、リアルタイムエンジンのクリップ交換で使う project/editing POD 公開 API の ABI バージョンを返します。

```typescript
function projectAbiVersion(): number
```

### `voiceChangerAbiVersion()`

ネイティブ／FFI の公開 API が使う、リアルタイムボイスチェンジャーの POD 設定 ABI バージョンを返します。これはプリセット JSON の `schemaVersion` とは別物です。プリセット JSON は現在 `1` で、ユーザー作成プリセットを受け入れる前に `validateRealtimeVoiceChangerPresetJson(...)` で検証してください。

```typescript
function voiceChangerAbiVersion(): number
```

### ボイスプリセットアクセサ

プリセット JSON を解析せずに、正規の voice-character プリセット ID や解決済みのフラットな POD 設定が必要なときに使います。

```typescript
function voiceCharacterPresetId(preset: VoicePresetId | number): VoicePresetId | null
function realtimeVoiceChangerPresetConfig(preset: VoicePresetId | number): RealtimeVoiceChangerPodConfig
```

`voiceCharacterPresetId(...)` は未知の数値序数で `null` を返します。未知の文字列 ID は例外になります。
`realtimeVoiceChangerPresetConfig(...)` は解決済み POD 設定を返す必要があるため、無効な序数や未知の ID で例外になります。

解決済みの `RealtimeVoiceChangerPodConfig` は両 JavaScript 公開 API で camelCase キー（`inputGainDb`、`wetMix`、`formantFactor`、`limiterIspCeilingDbtp` など）を使います。対応する C / Python の POD フィールドは snake_case のままです。

### リアルタイム環境ヘルパー

これらは [`RealtimeEngine`](./realtime-engine.md) が使う実行環境の公開範囲を確認するためのヘルパーです。AudioWorklet / SharedArrayBuffer 経路を接続する前に、ページの分離ポリシーやブラウザ差分を確認できます。

```typescript
function engineAbiVersion(): number
function engineCapabilities(): {
  engineAbiVersion: number;
  expectedEngineAbiVersion: number;
  abiCompatible: boolean;
  sharedArrayBuffer: boolean;
  atomics: boolean;
  audioWorklet: boolean;
  mode: 'sab' | 'postMessage';
}
function hasFfmpegSupport(): boolean
```

`hasFfmpegSupport()` は、読み込まれたビルドが FFmpeg 経由のデコードに対応しているかを返します。ブラウザ向け WASM npm パッケージはデコード済み PCM を扱うため通常 `false` で、ファイルの直接デコードは Python/native ビルド側で行います。

## リファレンスのページ構成

リファレンスは主題ごとに分かれています。以下のページはいずれも、ここまでのインストール・インポート・初期化を前提とします。

- [解析](./js-api-analysis.md) — 楽曲レベルの解析、特徴抽出、スケール量子化、単位変換、librosa 互換ヘルパー、リサンプリング。
- [エフェクト](./js-api-effects.md) — オーディオエフェクト、編集 DSP、ルーム音響の計測。
- [マスタリング](./js-api-mastering.md) — マスタリングチェーン、名前付きプロセッサ、プリセット、ストリーミングマスタリング、ミキシング API。
- [オーディオとストリーミング](./js-api-audio.md) — `Audio` クラス、メータリング、逐次処理のストリーミング API。
- [型とエラー](./js-api-types.md) — 型定義、列挙型、エラーハンドリング、型エクスポート索引。

## プロジェクト、楽器、ライブ MIDI

このパッケージは、MIDI／クリップのアレンジを音声に変換するための、プロジェクト・シンセシス・ライブ入力のインターフェースも公開しています。ここでは概要のみを示し、各トピックには個別のガイドがあります。

| 目的 | 使う API | ガイド |
|------|----------|--------|
| 空のプロジェクトを作る | `Project.create()`（または `new Project()`） | [プロジェクト編集](./project-editing.md) |
| クリップ＋MIDI アレンジの作成・読み込み・編集 | `Project`（`Project.fromJson`、`toSceneJson`、MIDI イベントヘルパー） | [プロジェクト編集](./project-editing.md) |
| 解析・補助メタデータを不透明なまま保持する | `project.setAssistSidecar(...)`、`assistSidecars()` | [プロジェクト編集](./project-editing.md) |
| オートメーションレーンの対象種別を付ける | `ProjectAutomationTargetKind`、`ProjectAutomationLaneDesc` の `targetKind` | [プロジェクト編集](./project-editing.md) |
| プロジェクトを音声にレンダー | `project.bounceWithSynthInstrument(s)` | [プロジェクトバウンス](./project-bounce.md) |
| 内蔵シンセサイザー（NativeSynth）のボイスを選ぶ | `synthPresetNames()`、`synthPresetPatch(name)`、`engine.setSynthInstrument(...)` | [内蔵シンセサイザー](./native-synth.md) |
| SoundFont で再生 | `project.loadSoundFont(bytes)` / `engine.loadSoundFont(bytes)` | [SoundFont プレイヤー](./soundfont-player.md) |
| ライブエンジンへ MIDI クリップをサンプル精度でスケジュールする | `engine.setMidiClips(...)`、`engine.sampleAtPpq(ppq)` | [リアルタイムエンジン](./realtime-engine.md#midi-クリップスケジューリングと-sampleatppq) |
| トラック単位のキューモニタリングを設定する | `engine.setTrackMonitorMode(laneIndex, 'off' | 'pfl' | 'afl')` | [リアルタイムエンジン](./realtime-engine.md#レーンミキサー) |
| エンジンのトラックをレーン・バス・センド・ストリップでライブミックスする | `engine.setTrackLanes(...)`、`engine.setTrackBuses(...)`、ストリップ JSON セッター | [リアルタイムエンジン](./realtime-engine.md#レーンミキサー) |
| トラックを外部 MIDI ハードウェアへ送り、必要ならクロック／トランスポートも転送する | `engine.setMidiDestinationExternal(...)`、`engine.setExternalMidiClockEnabled(...)`、`engine.drainExternalMidi(...)`。Worklet ファサードでは `onMidiOut(...)` | [リアルタイムエンジン](./realtime-engine.md#トラックを外部-midi-機器へ送る) |
| ハードウェア／Web MIDI デバイスからエンジンへ演奏イベントを送る | `bindWebMidi(engine, ...)` <Badge type="info" text="ブラウザ専用" /> | [MIDI 入力](./midi-input.md) |
| ライブのマイク入力をエンジンに流す | `bindMicrophoneInput(context, engine, ...)` <Badge type="info" text="ブラウザ専用" /> | [録音とテイク](./recording-and-takes.md) |

```typescript
import { Project, synthPresetNames } from '@libraz/libsonare';

const project = Project.fromJson(projectJson);
const audio = project.bounceWithSynthInstrument(synthPresetNames()[0]);
```

`bounceWithSynthInstrument(...)` は単一の楽器、または出力先ごとに 1 つの楽器を並べた配列を受け取ります。各要素には、プリセット名（`"va:"` ルーティングプレフィックス可）、明示的な `SynthPatch`、または初期パッチを表す `null` を指定できます。

`bindWebMidi(...)` と `bindMicrophoneInput(...)` はブラウザ専用のヘルパーで、Web MIDI や `MediaStream` をライブの `RealtimeEngine` に接続します。エンジン本体は [リアルタイムエンジン](./realtime-engine.md) を参照してください。

## パフォーマンスサマリー

| API | 負荷 | 備考 |
|-----|------|-------|
| `StreamAnalyzer` | <Badge type="tip" text="リアルタイム" /> | チャンクごとの処理、〜2ms/フレーム、更新される BPM/キー/コード推定 |
| `Mixer` | <Badge type="tip" text="リアルタイム" /> | オートメーションとメーターを持つシーンベースのブロック処理 |
| `analyze` / `analyzeWithProgress` | <Badge type="warning" text="高負荷" /> | 総合解析パイプライン |
| `hpss` / `harmonic` / `percussive` | <Badge type="warning" text="高負荷" /> | STFT + メディアンフィルター |
| `timeStretch` | <Badge type="warning" text="高負荷" /> | フェーズボコーダー |
| `pitchShift` | <Badge type="warning" text="高負荷" /> | タイムストレッチ + リサンプル |
| `stft` / `stftDb` | <Badge type="info" text="中負荷" /> | 複数の FFT 演算 |
| `melSpectrogram` / `mfcc` | <Badge type="info" text="中負荷" /> | STFT + フィルターバンク |
| `chroma` | <Badge type="info" text="中負荷" /> | STFT + クロマフィルターバンク |
| `pitchYin` / `pitchPyin` | <Badge type="info" text="中負荷" /> | フレームごとのピッチ検出 |
| `resample` | <Badge type="info" text="中負荷" /> | 高品質リサンプリング |
| `detectBpm` / `detectKey` | 低負荷 | 単一結果 |
| `detectBeats` / `detectOnsets` | 低負荷 | フレームベース検出 |
| 単位変換関数 | 低負荷 | 純粋な計算 |
| `normalize` / `trim` | 低負荷 | シンプルな処理 |

## バンドルサイズ

| ファイル | サイズ | Gzip |
|---------|--------|------|
| `sonare.js` | ~{{ wasmMeta.sonareJs.sizeKB }} KB | ~{{ wasmMeta.sonareJs.gzipKB }} KB |
| `index.js` | ~{{ wasmMeta.indexJs.sizeKB }} KB | ~{{ wasmMeta.indexJs.gzipKB }} KB |
| `sonare.wasm` | ~{{ wasmMeta.wasm.sizeKB }} KB | ~{{ wasmMeta.wasm.gzipKB }} KB |
| **合計** | ~{{ wasmMeta.total.sizeKB }} KB | ~{{ wasmMeta.total.gzipKB }} KB |

## ブラウザサポート

| ブラウザ | 最小バージョン |
|---------|---------------|
| Chrome | 57+ |
| Firefox | 52+ |
| Safari | 11+ |
| Edge | 16+ |

要件: WebAssembly、ES2017+ (async/await)、Web Audio API
