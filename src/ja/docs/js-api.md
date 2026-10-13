---
title: JavaScript/TypeScript API リファレンス
description: libsonare JavaScript/TypeScript パッケージのリファレンスの入口です。インストール、インポート、初期化、エラー処理と、主題別リファレンスページの一覧を掲載します。
---

# JavaScript/TypeScript API リファレンス

npm パッケージ `@libraz/libsonare` は、エンジンの WebAssembly ビルドです。解析、マスタリング、ミキシング、編集 DSP、リアルタイムエンジンをブラウザ内で実行します。このページでは、インストール、`init()`、最初の呼び出しと、すべての関数に共通する規約（リクエストオブジェクト、エラー、既定のサンプルレート）を扱います。主題別のリファレンスは[末尾の一覧](#リファレンスのページ構成)から進めます。

## 概要

多くの関数はファイルではなくデコード済みの PCM を受け取ります。`Float32Array` のサンプルと、そのデコード時の `sampleRate` です。エンコード済みバイト列からサンプルを得るには、Web Audio API（`AudioContext.decodeAudioData`）でデコードするか、`Audio.fromMemory*` ファクトリを使います。ファクトリは WAV／MP3 を同梱 WASM デコーダーで、AAC／OGG／FLAC を必要に応じてブラウザ側で処理します。`decodeChannelsWithBrowserFallback(bytes, options?)` も同じ経路でデコードしますが、モノラルへ折りたたまず全チャンネルを保持します。詳しくは[全チャンネルを保持する](./wasm.md#全チャンネルを保持する)を参照してください。

関数の一覧からではなく、やりたいことから選びます。

| やりたいこと | 最初に使う API | 理由 |
|--------------|----------------|------|
| テンポ、キー、ビートのどれかひとつ | `detectBpm`, `detectKey`, `detectBeats` | `analyze(...)` 全体を走らせず、必要な値だけを直接得られます |
| 曲全体のメタデータ | `analyze`, `analyzeWithProgress`、または個別の `analyze*` ヘルパー | `analyze` は概要、個別ヘルパーは詳細向きです |
| ML 入力や可視化向けのスペクトル特徴量 | `melSpectrogram`, `chroma`, `mfcc` | 行列を返します |
| ライブビジュアライザーや更新されていく BPM／キー／コード UI | `StreamAnalyzer` | 小さな音声ブロックを処理し、UI が最新フレームを読み出せます |
| リミックス、練習ツール、領域のリペア | `hpss`, `timeStretch`, `pitchShift`, `spectralEdit` | オーディオエフェクトです |
| ボーカル補正、ノート編集、ピッチ／フォルマント変更 | `pitchCorrectToMidi`, `noteStretch`, `voiceChange`, `StreamingRetune`, `RealtimeVoiceChanger` | 解析ではなく音そのものを変える編集 DSP です |
| ラウドネスターゲット、True Peak リミッター、配信プレビュー | `masterAudio*`, `masteringChain*`, `StreamingMasteringChain` | まずプリセット、必要に応じて名前付きプロセッサへ進めます |
| ステムのバランス、センド、バス、メーター | `mixStereo` または `Mixer` | まず一括ミックス、ルーティングが必要ならシーンミキサーを使います |
| 部屋の残響、明瞭度、等価ルームの推定、ルームの生成 | `analyzeImpulseResponse`, `detectAcoustic`, `estimateRoom`, `synthesizeRir`, `roomMorph`, `roomMorphStereo` | 楽曲ではなく録音空間を説明・適用します |
| ファイルの読み込み | `Audio.fromBuffer`, `Audio.fromMemory`, `Audio.fromMemoryWithBrowserFallback` | デコードと、よく使う関数のメソッド形式での呼び出し |

BPM、STFT、クロマなどの用語は[用語集](/ja/docs/glossary)にまとめています。バインディングごとの機能対応は[機能マップ](./api-surface.md)、マスタリングプロセッサの登録一覧とミキシングシーン形式は[マスタリングプロセッサ](./mastering-processors.md)と[ミキシングシーン JSON](./mixing-scene-json.md)を参照してください。

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

パッケージには 5 つのエントリがあります。メインエントリにすべてが入っており、ほかは用途を絞った小さなバンドルです。

| エントリ | インポートパス | 含まれるもの | 使う場面 |
|----------|----------------|--------------|----------|
| メイン | `@libraz/libsonare` | 解析、エフェクト、マスタリング、ミキシング、プロジェクト、リアルタイムエンジンの全 API | ほとんどの場合 |
| 解析 | `@libraz/libsonare/analysis` | 解析と特徴量のみ。マスタリング、ミキシング、リアルタイム、プロジェクトの API は含まれません | 解析だけで足りるときに、ダウンロードを最小にしたい |
| Worklet | `@libraz/libsonare/worklet` | AudioWorklet 側のランタイム（`EXPECTED_ABI_VERSION`、`engineMixerMasterTarget`、`ENGINE_MIXER_PARAM_FADER_DB`、`ENGINE_MIXER_PARAM_PAN`、`SONARE_METER_RING_PROTOCOL_VERSION` を含む） | `AudioWorkletGlobalScope` 内で動くコード |
| Worker | `@libraz/libsonare/worker` | `OfflineWorkerClient` の背後にあるオフライン Worker スクリプト | 解析をメインスレッド外で実行する（[Worker](./wasm-advanced.md#web-worker-の使用)を参照） |
| ボーカル編集 Worker | `@libraz/libsonare/vocal-edit-worker` | `VocalEditWorkerClient` の背後にある Worker スクリプト | ボーカル編集のドラフトとレンダリングジョブをメインスレッド外で実行する |

各エントリが提供するファイルは[パッケージの構成物](./wasm.md#パッケージの構成物)を参照してください。バンドルのターゲットは ECMAScript 2020 です。

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

WASM モジュールを初期化します。モジュールを必要とする関数を使う前に、一度だけ呼び出します。

```typescript
async function init(options?: {
  locateFile?: (path: string, prefix: string) => string;
  wasmBinary?: ArrayBuffer | Uint8Array;
  moduleFactory?: (options?: {
    locateFile?: (path: string, prefix: string) => string;
    wasmBinary?: ArrayBuffer | Uint8Array;
  }) => Promise<SonareModule>;
}): Promise<void>
```

オプションが効くのは最初の呼び出しだけです。オプションなし、または同じオプション（関数は参照で比較）で `init()` を再度呼ぶとすぐに解決します。オプションが異なる 2 回目の呼び出しは、そのオプション名を挙げた `InvalidState` の `SonareError` を投げます。`init()` が解決する前に、モジュールを必要とする関数を呼ぶと `InvalidState` を投げます。

`init()` は読み込んだモジュールの ABI バージョンをパッケージのビルド時のものとも比較し、`.wasm` と JavaScript が別のビルドのもの（古いキャッシュや独自の `wasmBinary` / `locateFile` で起こりえます）なら `AbiMismatch`（コード 10）を投げます。期待するバージョンは `EXPECTED_ABI_VERSION` としてパッケージルートと `@libraz/libsonare/worklet` からエクスポートされるので、`moduleFactory` に渡すテスト用の代替実装は、`init()` が検査するバージョンをこれで報告できます。

### 最初の呼び出し

```typescript
import { init, detectBpm } from '@libraz/libsonare';

await init();                                    // アプリ起動時に一度だけ

const bytes = await (await fetch('/song.mp3')).arrayBuffer();
const ctx = new AudioContext();
const decoded = await ctx.decodeAudioData(bytes);
const samples = decoded.getChannelData(0);       // Float32Array（最初のチャンネル）

const bpm = detectBpm({ samples, sampleRate: decoded.sampleRate });
console.log(`${bpm.toFixed(1)} BPM`);
```

`sampleRate` には、サンプルをデコードしたときのレートを渡します。`.wasm` を別のパスから配信するには `locateFile` を渡します。

```typescript
await init({
  locateFile: (path, prefix) => `/custom/wasm/path/${path}`
});
```

これが動いたら、`analyze`、マスタリング、ミキシング、ストリーミングへ進んでください。

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

## 単発 API のリクエストオブジェクト

トップレベルの単発解析・エフェクト・マスタリング・メータリング・特徴量・ミキサー・ボイスチェンジャー API は、名前付きの**リクエストオブジェクト**を標準形式として使います。すべての入力が名前で分かり、引数順を崩さず任意設定を増やせ、TypeScript の `*Request` 型も利用できます。位置引数形式は互換オーバーロードであり、既定値、検証、エラー、結果、進捗コールバックは同じです。位置引数形式の単発関数はどれも、末尾に `{ validate?: boolean }` を受け取ります。`{ validate: false }` は負荷の高い経路で JavaScript 側の NaN／無限大のスキャンを省きます。非有限の入力はネイティブ層が引き続き拒否します。

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

// 位置引数形式
const legacyBpm = detectBpm(samples, sampleRate);
```

リクエストオブジェクトは、そのエントリポイントが宣言していないキーを拒否します。`detectBpm({ samples, sampleRate, bpmMin: 90 })` は `TypeError: detectBpm: unknown request key 'bpmMin'` を投げ、入れ子のオブジェクトの中に置くべきキーなら置き場所も示します（`'loudness' belongs under 'config'`）。入れ子のオプションオブジェクトや位置引数形式のオプション袋も、未知のオプションを同じように拒否します。テンポの範囲指定は `detectBpm` ではなく `analyzeBpm` と `analyze` のものです。

リクエストのフィールド名は Node と WASM で同じ camelCase です。Python は JavaScript 形式の options object ではなく、従来どおりキーワード引数（`detect_bpm(samples, sample_rate=...)`）を使います。

### 長い処理をキャンセルする

進捗を報告するリクエストは `cancel` も受け取ります。これは `onProgress` が発火するのと同じネイティブ境界でポーリングされる述語で、`true` を返すと呼び出しが中断されます。

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

キャンセルされた呼び出しは、コード 8（`Cancelled`）の `SonareError` で例外になり、出力を確保しません。途中結果を調べることはできません。Python も同じ述語を `cancel=` で受け取ります。

### 既定のサンプルレート

`sampleRate` を省略できる場合の既定値は、関数ファミリーごとに異なります。バッファの実際のレートが分かっているときは、必ずそれを渡してください。

| ファミリー | 既定値 |
|------------|--------|
| 解析、特徴量、ラウドネス、ピッチ、エフェクト（`detectBpm`, `stft`, `melSpectrogram`, `hpss`, `timeStretch` など） | 22050 |
| `Audio.fromBuffer`, `voiceChangeRealtime`, `roomMorphStereo` | 48000 |
| `StreamAnalyzer`（`StreamConfig.sampleRate`） | 44100 |

## エラーハンドリング

失敗は、入力を拒否したのが誰かによって 3 つのクラスのどれかで届きます。

| クラス | 投げる主体 | `isSonareError` の一致 |
|--------|------------|------------------------|
| `TypeError` | JavaScript バインディング（型の誤りや引数の欠落） | しない |
| `RangeError` | JavaScript バインディング（値が定義域の外） | しない |
| `SonareError` | ライブラリ、またはオブジェクトの状態 | する |

`SonareError` は `Error` のサブクラスで、C ABI のエラー enum をそのまま映した数値の `code` と正準名 `codeName` を持ちます。同じ失敗はどのバインディング（WASM / Node ネイティブ / Python / C ABI）でも同じコードを報告するので、メッセージ文字列ではなくコードで分岐してください。パッケージは `ErrorCode` enum、`SonareError` クラス、型ガード `isSonareError(value)` をエクスポートします。

```typescript
import { ErrorCode, isSonareError, Mixer } from '@libraz/libsonare';

try {
  const mixer = Mixer.fromSceneJson(sceneJson, 48000, 512);
} catch (error) {
  if (error instanceof TypeError || error instanceof RangeError) {
    // バインディングが引数を拒否した。呼び出し側を直す。
    console.error(`bad argument: ${error.message}`);
  } else if (isSonareError(error) && error.code === ErrorCode.InvalidFormat) {
    console.error(`scene is not valid JSON: ${error.message}`);
  } else if (isSonareError(error) && error.code === ErrorCode.InvalidParameter) {
    // 'failed to build mixer from scene JSON: unknown insert processor: nope (strip a)'
    console.error(`scene field rejected: ${error.message}`);
  } else {
    throw error;
  }
}
```

### どの失敗がどのエラーになるか

| 失敗 | 投げられるもの |
|------|----------------|
| `init()` が解決する前の関数呼び出し | `SonareError` `InvalidState`（7） |
| オプションが異なる 2 回目の `init()` | `SonareError` `InvalidState`（7）。オプション名を挙げます |
| `.wasm` と JavaScript が別のビルド | `SonareError` `AbiMismatch`（10） |
| 解放済み・破棄済みのハンドルのメソッド | `SonareError` `InvalidState`（7） |
| JSON として壊れているミキサーシーン（`Mixer.fromSceneJson`、`Project.fromJson`） | `SonareError` `InvalidFormat`（2） |
| ライブラリが拒否したフィールド。未知のプリセットやインサート、不正なセンドのタイミングなど | `SonareError` `InvalidParameter`（4） |
| 拒否されたストリームや STFT の設定 | コアが報告するコードの `SonareError` |
| キャンセルされた呼び出し | `SonareError` `Cancelled`（8） |
| `null` や型の違う引数（`Float32Array` ではない `samples` など） | `TypeError` |
| 空または非有限のオーディオ、`[8000, 384000]` の整数ではない `sampleRate`、小数の整数引数、長さが揃うべき 2 つのバッファの不一致、バインディングが解決する名前の未知の値（`keyRoot` など） | `RangeError` |
| NUL を含む文字列を、それを検査するエントリポイント（`mixingScenePresetJson`、`realtimeVoiceChangerPresetJson`、`validateRealtimeVoiceChangerPresetJson`、`realtimeVoiceChangerPresetConfig`、`noteToHz`、`Project.fromJson`）へ渡した | フィールド名を挙げた `RangeError` |

`Mixer.fromSceneJson` は、JSON として壊れているシーンには `InvalidFormat`、ミキサーが拒否したフィールドには `InvalidParameter` を報告します。どのフィールドが問題かは、`failed to build mixer from scene JSON: <内側のメッセージ>` の末尾で分かります。

サンプルとサンプルレートを受け取る単発関数はどれも、コアに渡す前にこれらを検査するので、埋め込みの `BindingError` が呼び出し側へ届くことはありません。コアが自分のオブジェクトに対して行う引数検査は、コード付きの `SonareError` のままです。各ファサードは非有限数、不正な enum／インデックス値、過大なリソースをクランプせずに拒否します。入力不正として扱ってください。オフラインおよびボーカル編集のワーカークライアントは、`TypeError` と `RangeError` をワーカー境界越しに復元します。

### エラーコード

| `ErrorCode` | 値 |
|-------------|----|
| `Ok` | `0` |
| `FileNotFound` | `1` |
| `InvalidFormat` | `2` |
| `DecodeFailed` | `3` |
| `InvalidParameter` | `4` |
| `OutOfMemory` | `5` |
| `NotSupported` | `6` |
| `InvalidState` | `7` |
| `Cancelled` | `8` |
| `EncodeFailed` | `9` |
| `AbiMismatch` | `10` |
| `Unknown` | `99` |

`AbiMismatch` はバインディングが作るコードで、コアが報告することはありません。ネイティブモジュールの ABI バージョンがパッケージの期待値と異なることを示します（WASM は `init()`、Node はアドオンの読み込み時、Python はライブラリの初回使用時）。原因と直し方は[インストール](./installation.md#ライブラリ読み込み時の-abimismatch)にあります。ほかのコードは Python の `SonareError.code` および C ABI の `SonareError` enum と一致し、Python CLI は同じコードを[終了コード](./cli.md#終了コード)へ対応付けます。Node、Python、C ABI、CLI で同じ失敗がどう現れるかは、[エラー契約](./binding-parity.md#エラー契約)を参照してください。

## ビルドと実行環境

### `capabilities()`

実際に読み込まれているビルドの内容を返します。CLI が `doctor` で表示するのと同じレポートです。同期関数で、`init()` の後にのみ有効です。

```typescript
function capabilities(): {
  version: string;
  abi: { project: number; engine: number };
  platform: string;
  features: {
    mastering: boolean;
    mixing: boolean;
    mixingAssistant: boolean;
    fx: boolean;
    ffmpeg: boolean;
    instrumentParamAutomation: boolean;
    arrangement: boolean;
    acousticSim: boolean;
    pitchEditor: boolean;
    vocalEdit: boolean;
    voiceChanger: boolean;
    playback: boolean;
  };
  decode: { builtin: string[]; ffmpeg: string[] };
  simd: string;
  hardwareConcurrency: number;
}
```

推測せず `features` で分岐してください。`decode.builtin` を見れば、ブラウザ側のフォールバックを試す前に、そのモジュールがどの形式を開けるか分かります。同梱ビルドでは `simd` は `"wasm-simd128"` を返します。

| フラグ | 対象 |
|--------|------|
| `mastering` | `masterAudio*`、`masteringChain*`、`StreamingMasteringChain`、名前付きマスタリングプロセッサ |
| `mixing` | `Mixer`、`mixStereo`、ミキシングシーンの関数 |
| `mixingAssistant` | `suggestMixScene` |
| `fx` | エフェクトのサブシステム |
| `ffmpeg` | FFmpeg によるデコード（ブラウザ向けパッケージでは `false`） |
| `instrumentParamAutomation` | 楽器パラメータのオートメーションターゲット |
| `arrangement` | `Project`、クリップ、アレンジメントのサブシステム |
| `acousticSim` | `analyzeImpulseResponse`、`detectAcoustic`、`estimateRoom`、`synthesizeRir`、`roomMorph*` |
| `pitchEditor` | ノートとピッチの編集 |
| `vocalEdit` | ボーカル編集のドラフトとレンダリングジョブ |
| `voiceChanger` | `RealtimeVoiceChanger`、`voiceChange*` |
| `playback` | `PlaybackRenderer`（アップミックス、バイノーラル、スピーカー出力） |

`mixingAssistant` と `instrumentParamAutomation` は、ホストにとってもっとも必要でありながら、もっとも見落とされやすい 2 つのプローブです。これらが対象とするエントリポイントは、サブシステムの有無にかかわらず登録されたままだからです。`suggestMixScene` と楽器パラメータのオートメーションターゲットは、どのモジュールにも関数として存在し、サブシステムを欠くビルドでは呼び出し時に**例外を投げます**。したがって `typeof fn === 'function'` は機能の有無の判定になりません。アレンジメントのサブシステムを持たないビルドでは `instrumentParamAutomation` が `false` を返します。`mixingAssistant` は解析専用モジュールではコンパイル時に除外されるため、シンボルが存在していても `false` を返します。

### `capabilityCatalog()`

各プロセッサ、そのパラメータ記述子、組み込みプリセット一覧を、機械可読なカタログとして返します。C ABI が公開し Python が `capability_catalog` として公開しているのと同じ正規 JSON で、`schemas/capability-catalog.schema.json` で検証されます。

```typescript
function capabilityCatalog(): {
  version: string;
  abi: { project: number; engine: number };
  processors: CapabilityCatalogProcessor[];   // id、kind、レイテンシ、テール、params、slots など
  chain: CapabilityCatalogChain;              // フラットなマスタリングチェーンキーすべての記述
  presets: {
    mastering: string[];
    synth: string[];
    mixingScene: string[];
    voiceChanger: string[];
    playbackRoom: string[];                   // 常に存在。再生機能がビルドから除かれていれば空
  };
  masteringPresets: Array<{
    name: string;
    kind: 'mastering' | 'restoration';
    targetLufs: number | null;
    truePeakCeilingDb: number | null;
    maxLimiterGainReductionDb: number | null;
  }>;
}
```

汎用のパラメータ UI はこれを基に作れます。各スライダーの範囲・既定値・単位・軸（`uiMin` / `uiMax`、`scale`）は、手で管理する表ではなくカタログから得られます。各フィールドは[インサートエフェクト](./effects-inserts.md#パラメータ記述子)にまとまっています。`null` の範囲は、コアがその側の制限を把握していないという意味です。0 ではなく「上限・下限なし／不明」として扱ってください。

::: warning 公開される範囲は厳密な制約であり、UI の推奨レンジではありません
範囲は、そのプロセッサの他のパラメータをすべて既定値に置いた状態で測られています。そのため、互いを制約し合う 2 つのパラメータはそれぞれ相手の既定値を報告します。EQ の `band*.frequencyHz` のようにサンプルレートから導かれる範囲は、prepare 前の `24000` と読めます。開区間の境界は、除外される側の値そのものとして報告されます。それぞれの場合は[カタログの値域の読み方](./mastering-processors.md#カタログの値域の読み方)で説明しています。
:::

### `abiVersion()`

C POD 公開 API 全体を集約したネイティブ ABI バージョンを返します（`EXPECTED_ABI_VERSION` と同じ値）。ビルド済みバイナリを読み込む際に保存・比較しておくと、互換性のない JS／ネイティブ成果物の組み合わせを早期に検出できます。

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

`voiceCharacterPresetId(...)` は未知の数値序数で `null` を返します。未知の文字列 ID は例外になります。`realtimeVoiceChangerPresetConfig(...)` は解決済み POD 設定を返す必要があるため、無効な序数や未知の ID で例外になります。

解決済みの `RealtimeVoiceChangerPodConfig` は両 JavaScript 公開 API で camelCase キー（`inputGainDb`、`wetMix`、`formantFactor`、`formantMode`、`limiterIspCeilingDbtp` など）を使います。対応する C / Python の POD フィールドは snake_case のままです。エンジンに渡し戻す POD 設定は、`formantMode`（`'relative'` または `'absolute'`）を含むすべてのフィールドを持つ必要があります。

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

### ブラウザサポートとバンドルサイズ

同梱モジュールは WebAssembly SIMD でビルドされているため、ブラウザの最小バージョンは SIMD の対応状況で決まります。一覧は[ブラウザ互換性](./wasm.md#ブラウザ互換性)、ファイルサイズは[バンドルサイズ](./wasm.md#バンドルサイズ)を参照してください。

## ネイティブハンドルの解放

ネイティブハンドルを所有するクラス（`Mixer`、`StreamAnalyzer`、`Project`、`ProjectTimeline`、`RealtimeEngine`、`ClipPageProvider`、`ClipPageStreamer`、`StreamingEqualizer`、`StreamingMasteringChain`、`StreamingRetune`、`RealtimeVoiceChanger`、`PlaybackRenderer` など）はどれも冪等な `destroy()`（別名 `delete()`）を持ち、`[Symbol.dispose]()` を実装しています。そのため `using` 宣言を使えば、例外が起きてもスコープの終わりで解放されます。`Audio` はネイティブハンドルを持たないので `[Symbol.dispose]()` は何もしませんが、`using` はそのまま使えます。

```typescript
import { init, Mixer, mixingScenePresetJson } from '@libraz/libsonare';

await init();
{
  using mixer = Mixer.fromSceneJson(mixingScenePresetJson('vocalReverbSend'), 48000, 512);
  // ... ブロックを処理する。ミキサーは閉じ括弧で解放される。
}
```

ホストに `Symbol.dispose` がなければパッケージが補うので、メソッドはどこでも存在します。`using` 構文そのものには、TypeScript 5.2 以降（`lib` に `esnext.disposable`）、構文を変換するバンドラー、またはネイティブ対応のランタイムが必要です。そうでなければ `finally` で `destroy()` を呼んでください。解放済みハンドルのメソッドを呼ぶと `InvalidState` の `SonareError` が投げられます。

## リファレンスのページ構成

リファレンスは主題ごとに分かれています。以下のページはいずれも、ここまでのインストール・インポート・初期化を前提とします。

- [解析](./js-api-analysis.md): 楽曲レベルの解析、特徴抽出、ローマ数字によるコード分析。
- [ヘルパーと変換](./js-api-helpers.md): librosa 互換ヘルパー、スケール量子化、単位変換、リサンプリング、コード機能。
- [エフェクト](./js-api-effects.md): オーディオエフェクト、編集 DSP、ルーム音響の計測。
- [マスタリング](./js-api-mastering.md): マスタリングチェーン、名前付きプロセッサ、プリセット、単体のダイナミクス／リペアプロセッサ。
- [ストリーミングとリアルタイム](./js-api-streaming.md): ブロック単位のプロセッサ、ストリーミングマスタリングチェーン、逐次処理の `StreamAnalyzer`。
- [オーディオ、メータリング、ミキシング](./js-api-audio.md): `Audio` クラス、メータリング、テイクの位置合わせ、ミキサーストリップ、ミキシング API。
- [型と列挙型](./js-api-types.md): 型定義、列挙型、型エクスポート索引。
- [Worker](./wasm-advanced.md#web-worker-の使用): オフライン処理をメインスレッド外で実行する `OfflineWorkerClient` と `VocalEditWorkerClient`。

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
| トラック単位のキューモニタリングを設定する（ライブの `process()` 出力では聞こえ、オフラインレンダー、バウンス、フリーズには含まれない） | `engine.setTrackMonitorMode(laneIndex, 'off' | 'pfl' | 'afl')` | [リアルタイムエンジン](./realtime-engine.md#レーンミキサー) |
| エンジンのトラックをレーン・バス・センド・ストリップでライブミックスする | `engine.setTrackLanes(...)`、`engine.setTrackBuses(...)`、ストリップ JSON セッター | [リアルタイムエンジン](./realtime-engine.md#レーンミキサー) |
| トラックを外部 MIDI ハードウェアへ送り、必要ならクロック／トランスポートも転送する | `engine.setMidiDestinationExternal(...)`、`engine.setExternalMidiClockEnabled(...)`、`engine.drainExternalMidi(...)`。Worklet ファサードでは `onMidiOut(...)` | [リアルタイムエンジン](./project-editing-midi.md#トラックを外部-midi-機器へ送る) |
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
