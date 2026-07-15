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
| **マスタリング** | `masterAudio`, `masteringChain`, `StreamingMasteringChain` | LUFS ターゲット、トゥルーピークリミッター、プリセット、ストリーミングチェーン |
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
function voiceCharacterPresetId(preset: VoicePresetId | number): string | null
function realtimeVoiceChangerPresetConfig(preset: VoicePresetId | number): RealtimeVoiceChangerPodConfig | null
```

v1.5.1 以降、解決済みの `RealtimeVoiceChangerPodConfig` は両 JavaScript 公開 API で camelCase キー（`inputGainDb`、`wetMix`、`formantFactor`、`limiterIspCeilingDbtp` など）を使います。対応する C / Python の POD フィールドは snake_case のままです。

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

## 解析関数

### `detectBpm(samples, sampleRate)`

オーディオサンプルから BPM (テンポ) を検出します。

::: info ユースケース
- **DJ ソフトウェア**: トラック間のテンポをマッチングしてシームレスなミキシング
- **音楽プレイヤー**: テンポ情報の表示、テンポ別プレイリストの自動生成
- **フィットネスアプリ**: ワークアウト強度に合わせた音楽選択
- **ビート同期**: ビジュアライゼーションやアニメーションを音楽に同期
:::

```typescript
function detectBpm(samples: Float32Array, sampleRate?: number): number
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `samples` | `Float32Array` | モノラルオーディオサンプル (範囲 -1.0 〜 1.0) |
| `sampleRate?` | `number` | サンプルレート (Hz)（デフォルト: 22050。例: 44100） |

::: warning 実際のサンプルレートを必ず渡す
ここでは `sampleRate` は任意（既定は 22050 Hz）ですが、ブラウザでデコードした音声はほぼ常に 44100 または 48000 Hz です。バッファの実際の `audioBuffer.sampleRate` を渡してください。さもないと検出される BPM が狂います。同じことは `detectKey`・`detectBeats`・`analyze` にも当てはまります。これらも `sampleRate` は任意で既定は同じ 22050 Hz なので、実際のレートを渡してください。
:::

**戻り値:** 検出された BPM の数値。

```typescript
const bpm = detectBpm(samples, sampleRate);
console.log(`BPM: ${bpm}`);
```

### `detectKey(samples, sampleRate)`

オーディオサンプルから音楽キーを検出します。ルート音（C, D, E...）とモード（メジャー/マイナー）を返します。

::: info ユースケース
- **ハーモニックミキシング**: DJがスムーズなトランジションのためにキーをマッチング（カメロットホイール）
- **移調**: ボーカルレンジに合わせたキー変更の提案
- **音楽レコメンデーション**: 互換性のあるキーの曲を検索
- **練習ツール**: ミュージシャンが一緒に演奏するためのキー表示
:::

```typescript
function detectKey(samples: Float32Array, sampleRate?: number): Key  // sampleRate 既定: 22050
```

**戻り値:** `Key` オブジェクト

```typescript
interface Key {
  root: PitchClass;      // 0-11 (C=0, B=11)
  mode: Mode;            // Major、Minor、またはモード値。Mode enum 参照
  confidence: number;    // 0.0 〜 1.0
  name: string;          // "C major", "A minor"
  shortName: string;     // "C", "Am"
}

const KeyProfile = {
  KrumhanslSchmuckler: 0,
  Temperley: 1,
  Shaath: 2,
  FaraldoEDMT: 3,
  FaraldoEDMA: 4,
  FaraldoEDMM: 5,
  BellmanBudge: 6,
} as const;
```

```typescript
const key = detectKey(samples, sampleRate);
console.log(`キー: ${key.name}`);
console.log(`信頼度: ${(key.confidence * 100).toFixed(1)}%`);
```

### `detectBeats(samples, sampleRate)`

オーディオサンプルからビート時刻を検出します。各ビートの推定タイムスタンプを返します。

::: info ユースケース
- **音楽ビジュアライゼーション**: 各ビートでエフェクトをトリガー
- **リズムゲーム**: オーディオからノートチャートを生成
- **動画編集**: ビートに合わせた自動カット
- **ループ作成**: 完璧なループポイントを見つける
:::

```typescript
function detectBeats(samples: Float32Array, sampleRate?: number): Float32Array  // sampleRate 既定: 22050
```

**戻り値:** 秒単位のビート時刻の Float32Array

### `detectOnsets(samples, sampleRate)`

オーディオサンプルからオンセット時刻（音の立ち上がり）を検出します。ビートより細かい粒度 - すべての音をキャプチャ。

::: info ユースケース
- **ドラム採譜**: 個々のドラムヒットを検出
- **オーディオからMIDI**: オーディオをノートイベントに変換
- **サンプルスライシング**: トランジェントで自動的にオーディオをセグメント化
:::

```typescript
function detectOnsets(samples: Float32Array, sampleRate: number): Float32Array
```

### `analyze(samples, sampleRate)` <Badge type="warning" text="高負荷" />

総合的な音楽解析を実行します。BPM、キー、ビート、コード、セクション、音色などを返します。

::: info ユースケース
- **音楽ライブラリ管理**: 楽曲にメタデータを自動タグ付け
- **音楽制作**: リファレンストラックの解析
- **DJ準備**: すべてのトラック情報を一度に取得
- **音楽教育**: 楽曲構造の学習
:::

::: tip パフォーマンス
これは最も重い API です。長いオーディオファイル（3分以上）の場合は、`analyzeWithProgress` を使用して進捗を表示するか、関連するセグメントのみを解析することを検討してください。
:::

```typescript
function analyze(samples: Float32Array, sampleRate?: number): AnalysisResult  // sampleRate 既定: 22050
```

**戻り値:** 総合的な `AnalysisResult`。`analyze()` を 1 回呼ぶだけで、コード、セクション、音色、ダイナミクス、リズム、メロディ、楽曲形式、拍ごとの強度まで含む結果が、どのバインディングでも返ります。そのため、1 つのフィールドだけが欲しい場合を除き、個別のヘルパーを使う必要はほとんどありません。

```typescript
const result = analyze(samples, sampleRate);
console.log(`BPM: ${result.bpm}`);
console.log(`キー: ${result.key.name}`);
console.log(`コード数: ${result.chords.length}`);
console.log(`楽曲形式: ${result.form}`);
```

### `analyzeWithProgress(samples, sampleRate, onProgress)` <Badge type="warning" text="高負荷" />

進捗レポート付きで `analyze(...)` と同じ総合解析を実行します。

```typescript
function analyzeWithProgress(
  samples: Float32Array,
  sampleRate: number | undefined,  // undefined なら 22050 の既定を使う
  onProgress: (progress: number, stage: string) => void
): AnalysisResult
```

`sampleRate` はコールバックより前の位置引数ですが `undefined` を受け付け、その場合は `analyze` と同じ 22050 Hz の既定値を使います。実際のレートを渡してください。

**進捗ステージ:**

| ステージ | 説明 | 進捗 |
|---------|------|------|
| `"features"` | 特徴量の事前計算 | 0.0 |
| `"bpm"` | BPM 検出 | 0.15 |
| `"key"` | キー検出 | 0.15 |
| `"beats"` | ビートトラッキング | 0.25 |
| `"chords"` | コード認識 | 0.40 |
| `"sections"` | セクション検出 | 0.55 |
| `"timbre"` | 音色解析 | 0.70 |
| `"dynamics"` | ダイナミクス解析 | 0.80 |
| `"rhythm"` | リズム解析 | 0.90 |
| `"melody"` | メロディ解析 | 0.95 |
| `"complete"` | 完了 | 1.0 |

```typescript
const result = analyzeWithProgress(samples, sampleRate, (progress, stage) => {
  console.log(`${stage}: ${Math.round(progress * 100)}%`);
});
```

### 目的別の詳細解析ヘルパー

::: tip 多くの場合は 1 回の呼び出しで十分
`analyze()` はコード、セクション、音色、ダイナミクス、リズム、メロディ、楽曲形式、拍ごとの強度まで返します。個別ヘルパーが必要になるのは、1 つのフィールドだけが欲しいときや、高レベル API では隠れている設定を渡したいときだけです。
:::

`analyze(...)` が広すぎる、または逆に詳細が足りない場合は、個別の解析ヘルパーを使います。入力は同じくモノラルの `Float32Array` ですが、高レベル API では隠れている設定を渡せます。

| 目的 | 関数 | 補足 |
|------|------|------|
| ダウンビート／小節頭 | `detectDownbeats(samples, sampleRate)` | 秒単位の小節頭候補。`detectBeats` と組み合わせるとグリッド表示に向きます。 |
| キー候補の順位付き一覧 | `detectKeyCandidates(samples, sampleRate, options?)` | トップ候補が曖昧な曲や、モード・プロファイルを絞りたい場合に使います。 |
| 詳細なテンポ候補 | `analyzeBpm(samples, sampleRate, ...)` | 最良 BPM だけでなく、候補とテンポ根拠を返します。 |
| リズム傾向 | `analyzeRhythm(samples, sampleRate, ...)` | グルーヴ、シンコペーション、規則性を見ます。 |
| ダイナミクス | `analyzeDynamics(samples, sampleRate, ...)` | ダイナミックレンジ、ラウドネスレンジ、クレストファクター、圧縮傾向を見ます。 |
| 音色 | `analyzeTimbre(samples, sampleRate, ...)` | ブライトネス、ウォームス、密度、粗さ、複雑さを返します。 |
| コード | `detectChords(samples, sampleRate, options?)` | コード区間を `{ chords }` として返します。HMM 平滑化、キー文脈、転回形、`chromaMethod: 'stft' \| 'nnls'` を指定できます。 |
| セクション | `analyzeSections(samples, sampleRate, ...)` | イントロ、ヴァース、コーラス、ブリッジ、アウトロなどの構造を推定します。長尺入力で内部の境界グリッドがプーリングされても、`start` / `end` は元タイムライン上の正確な秒数を保ちます。 |
| メロディ | `analyzeMelody(samples, sampleRate, ...)` | ピッチ追跡ベースの単音メロディ輪郭です。 |

```typescript
const keys = detectKeyCandidates(samples, sampleRate, {
  modes: [Mode.Major, Mode.Minor],
  profile: 'krumhansl',
  genreHint: 'pop',
});

const { chords } = detectChords(samples, sampleRate, {
  useHmm: true,
  useKeyContext: true,
  keyRoot: keys[0].key.root,
  keyMode: keys[0].key.mode,
  chromaMethod: 'nnls',
});

const sections = analyzeSections(samples, sampleRate);
```

### `chordFunctionalAnalysis(samples, keyRoot, keyMode, sampleRate?, options?)`

指定したキーを基準に、検出されたコード進行を機能（ローマ数字）和声解析します。内部でコード検出を実行し、検出された各コードにラベルを付けるため、`detectKey(...)` から得た `keyRoot`／`keyMode` と、`detectChords(...)` に渡すのと同じ `options` をそのまま渡します。

```typescript
function chordFunctionalAnalysis(
  samples: Float32Array,
  keyRoot: PitchClass,
  keyMode: Mode,
  sampleRate?: number,
  options?: ChordDetectionOptions,
): string[]   // 検出されたコードごとに 1 つのローマ数字ラベル。例: ["I", "IV", "V", "vi"]
```

```typescript
const key = detectKey(samples, sampleRate);
const roman = chordFunctionalAnalysis(samples, key.root, key.mode, sampleRate);
console.log(roman);  // 例: ["I", "IV", "V", "vi"]
```

`detectKey(...)` と `detectKeyCandidates(...)` は同じ `KeyDetectionOptions` を受け取ります。

| グループ | 値 |
|----------|----|
| 制御項目 | `modes`, `profile`, `genreHint`, `useHpss`, `loudnessWeighted`, `highPassHz` |
| プロファイル名 | `ks`, `krumhansl`, `temperley`, `shaath`, `keyfinder`, `faraldo-edmt` / `edmt`, `faraldo-edma` / `edma`, `faraldo-edmm` / `edmm`, `bellman-budge` / `bellman` |
| ジャンルヒント | `auto`, `edm`, `electronic`, `dance`, `pop`, `classical`, `jazz` |

## ルーム音響解析

これらの関数は、曲そのものではなく録音空間を説明・適用する API です。

| 目的 | 使う API |
|------|----------|
| きれいなインパルスレスポンスを測る | `analyzeImpulseResponse(...)` |
| 通常音声から部屋の減衰を推定する | `detectAcoustic(...)` |
| 音声から実用的な部屋モデルを推定する | `estimateRoom(...)` |
| 寸法からモノラルのルームインパルスレスポンスを作る | `synthesizeRir(...)` |
| 目標ルームの響きを音作り効果として足す | `roomMorph(...)` |

::: info RIR とルームモーフィング
**RIR** は room impulse response の略で、部屋が短い音にどう反応するかを表すサンプル列です。`roomMorph(...)` は音作り効果であり、残響除去ではありません。
:::

```typescript
const ir = analyzeImpulseResponse(impulseResponseSamples, sampleRate, 6);
console.log(ir.rt60, ir.edt, ir.c50, ir.c80, ir.confidence);

const blind = detectAcoustic(roomRecording, sampleRate, {
  nOctaveBands: 6,
  nThirdOctaveSubbands: 24,
  minDecayDb: 30,
  noiseFloorMarginDb: 10,
});
console.log(blind.isBlind, blind.rt60Bands);

const estimate = estimateRoom(roomRecording, sampleRate, {
  referenceAbsorption: 0.15,
  nOctaveBands: 6,
});
console.log(estimate.volume, estimate.length, estimate.width, estimate.height);
console.log(estimate.drrDb, estimate.confidence, estimate.absorptionBands);

const rir = synthesizeRir({ lengthM: 7, widthM: 5, heightM: 3, absorption: 0.2 });
console.log(rir.sampleRate, rir.rir.length, rir.hasError);

const morphed = roomMorph(samples, sampleRate, { lengthM: 12, widthM: 9, heightM: 4, wet: 0.6 });
```

RT60、EDT、C50、C80、D50、バンド別配列、ルーム推定、生成 RIR、信頼度の読み方は [ルーム音響解析](./acoustic-analysis.md) を参照してください。

## オーディオエフェクト

### `hpss(samples, sampleRate, kernelHarmonic?, kernelPercussive?)` <Badge type="warning" text="高負荷" />

HPSS（Harmonic / Percussive Source Separation。倍音成分／打撃成分の分離）。音源を倍音成分（ボーカル、シンセなどの持続音）と打撃成分（ドラム、過渡音）に分離します。

::: info ユースケース
- **リミックス**: ドラムを分離または除去する
- **カラオケ**: ボーカルを除去してインストゥルメンタルを取り出す（倍音成分を使用）
- **解析精度の向上**: クリーンなコード検出のために倍音成分のみを使う
- **ドラム抽出**: サンプリング用に打撃成分だけを取り出す
:::

<SonareDemo id="waveform-harmonics" />

::: tip パフォーマンス
HPSS は STFT とメディアンフィルタリングを必要とします。処理時間は音源の長さに比例します。
:::

```typescript
function hpss(
  samples: Float32Array,
  sampleRate: number,
  kernelHarmonic?: number,    // デフォルト: 31
  kernelPercussive?: number   // デフォルト: 31
): HpssResult

interface HpssResult {
  harmonic: Float32Array;
  percussive: Float32Array;
  sampleRate: number;
}
```

### `harmonic(samples, sampleRate)` <Badge type="warning" text="高負荷" />

音源から倍音成分を抽出します。

```typescript
function harmonic(samples: Float32Array, sampleRate: number): Float32Array
```

### `percussive(samples, sampleRate)` <Badge type="warning" text="高負荷" />

音源から打撃成分を抽出します。

```typescript
function percussive(samples: Float32Array, sampleRate: number): Float32Array
```

### `timeStretch(samples, sampleRate, rate)` <Badge type="warning" text="高負荷" />

ピッチを変えずにテンポを変更します。Rate < 1.0 = 遅く、> 1.0 = 速く。

::: info ユースケース
- **練習ツール**: 難しいパッセージを学ぶために音楽をスローダウン
- **DJミキシング**: トラック間のテンポをマッチング
- **ポッドキャスト編集**: スピーチの速度調整
- **音楽制作**: サンプルをプロジェクトのテンポに合わせる
:::

<SonareDemo id="time-stretch" />

::: tip パフォーマンス
フェーズボコーダーアルゴリズムを使用。処理時間はオーディオの長さに比例します。
:::

```typescript
function timeStretch(
  samples: Float32Array,
  sampleRate: number,
  rate: number   // 0.5 = 半速、2.0 = 倍速
): Float32Array
```

### `pitchShift(samples, sampleRate, semitones)` <Badge type="warning" text="高負荷" />

長さを変えずにピッチを変更します。半音単位で測定（+12 = 1オクターブ上）。

::: info ユースケース
- **キーマッチング**: ミキシング用に曲を移調
- **ボーカルチューニング**: ボーカルピッチの補正や調整
- **クリエイティブエフェクト**: ハーモニー作成、チップマンク/ディープボイスエフェクト
- **楽器練習**: 演奏しやすいキーに移調
:::

::: tip パフォーマンス
タイムストレッチとリサンプリングを組み合わせます。処理時間はオーディオの長さに比例します。
:::

```typescript
function pitchShift(
  samples: Float32Array,
  sampleRate: number,
  semitones: number   // +12 = 1オクターブ上
): Float32Array
```

### 編集 DSP

これらの関数は解析だけでなく、信号そのものを変更します。`Audio` インスタンスメソッドとしても利用でき、その場合は保持している `sampleRate` が自動的に使われます。

```typescript
function pitchCorrectToMidi(
  samples: Float32Array,
  sampleRate: number,
  currentMidi: number,
  targetMidi: number,
): Float32Array

// 追跡したピッチ輪郭を、フレーム単位で固定のターゲット音にリチューンします。
// f0Hz は hopLength に揃えたフレームごとの f0 トラック（例: pitchYin/pitchPyin の出力）です。
// 対応する voiced/voicedProb 配列を渡すと無声音フレームをスキップでき、
// 無声音または NaN のフレームはそのまま残ります。
function pitchCorrectToMidiTimevarying(
  samples: Float32Array,
  f0Hz: Float32Array,
  targetMidi: number,
  sampleRate: number,
  hopLength: number,
  voiced?: Int32Array,
  voicedProb?: Float32Array,
): Float32Array

// 追跡したピッチ輪郭を、音楽的なスケール（オートチューン）または固定音にスナップします。
// mode 'scale' は有声フレームを最も近いスケール構成音へ引き寄せ、
// mode 'midi'（既定）は pitchCorrectToMidiTimevarying と同じ挙動になります。
function pitchCorrectTimevarying(
  samples: Float32Array,
  f0Hz: Float32Array,       // hopLength に揃えたフレームごとの f0 トラック
  sampleRate?: number,      // 既定 22050
  hopLength?: number,       // 既定 512
  options?: PitchCorrectOptions,
): Float32Array

interface PitchCorrectOptions {
  mode?: 'midi' | 'scale';         // 既定 'midi'
  targetMidi?: number;             // 'midi' モードでの固定音。既定 69（A4）
  scaleRoot?: number;              // スケールのルートピッチクラス 0-11。既定 0（C）
  scaleModeMask?: number;          // 12 ビットの構成音マスク。既定 C メジャー
  referenceMidi?: number;          // スケールグリッドの基準。既定 69（A4）
  retuneAmount?: number;           // 0 = バイパス、1 = 完全スナップ。既定 1
  maxCorrectionSemitones?: number; // フレームごとのクランプ（セミトーン）。既定 12
  retuneSpeedMs?: number;          // グライドの時定数。既定 50
  vibratoThresholdCents?: number;  // これ未満の補正はバイパス。既定 20
  voiced?: Int32Array;             // フレームごとの有声フラグ（非ゼロ = 有声）
  voicedProb?: Float32Array;       // フレームごとの有声確率 0-1
}

function noteStretch(
  samples: Float32Array,
  sampleRate: number,
  options?: {
    onsetSample?: number,    // ノートのオンセット位置（サンプル）
    offsetSample?: number,   // ノートのオフセット位置（サンプル）
    stretchRatio?: number,   // >1 で区間を長くし、<1 で短くする
  },
): Float32Array

function spectralEdit(
  samples: Float32Array,
  sampleRate: number,
  ops?: Array<{
    startSample?: number;
    endSample?: number;
    lowHz?: number;
    highHz?: number;
    gainDb?: number;
    mode?: 'gain' | 'attenuate' | 'mute' | 'heal';
  }>,
  options?: {
    nFft?: number;
    hopLength?: number;
    window?: 'hann' | 'hamming' | 'blackman' | 'rectangular';
    healRadiusFrames?: number;
  },
): Float32Array

function voiceChange(
  samples: Float32Array,
  sampleRate?: number,        // デフォルト: 22050
  options?: {
    pitchSemitones?: number,  // 負の値で下げる。既定 0
    formantFactor?: number,   // >1 で明るく、<1 で暗く。既定 1.0
  },
): Float32Array
```

対応する CLI 例:

```bash
sonare pitch-correct vocal.wav --current-midi 68.7 --target-midi 69 -o corrected.wav
sonare note-stretch take.wav --onset 12000 --offset 24000 --ratio 1.25 -o held.wav
sonare voice-change vocal.wav --pitch-semitones 3 --formant-factor 1.05 -o voice.wav
```

`pitchCorrectTimevarying(...)` はスケールスナップ式オートチューンの経路です。スケールマスク、`mode`、リチューンの効き方の詳細は [編集 DSP](./editing-dsp.md) を参照してください。領域指定の例とオプションの考え方は [スペクトル編集](./spectral-editing.md) を参照してください。

### `normalize(samples, sampleRate, targetDb?)`

オーディオを目標ピークレベルに正規化します。

```typescript
function normalize(
  samples: Float32Array,
  sampleRate: number,
  targetDb?: number   // デフォルト: 0.0 (フルスケール)
): Float32Array
```

### `trim(samples, sampleRate, thresholdDb?)`

オーディオの始めと終わりから無音を除去します。

```typescript
function trim(
  samples: Float32Array,
  sampleRate: number,
  thresholdDb?: number   // デフォルト: -60.0
): Float32Array
```

これは `Audio` レベルの単純なしきい値トリムです。librosa 互換の
フレーム RMS / `topDb` ベースの無音判定と、元音源上の開始・終了サンプル位置が
必要な場合は、下の `trimSilence(...)` を使います。

## 特徴抽出

### `stft(samples, sampleRate, nFft?, hopLength?)` <Badge type="info" text="中負荷" />

短時間フーリエ変換（STFT）を計算します。

```typescript
function stft(
  samples: Float32Array,
  sampleRate?: number, // デフォルト: 22050
  nFft?: number,      // デフォルト: 2048
  hopLength?: number  // デフォルト: 512
): StftResult

interface StftResult {
  nBins: number;
  nFrames: number;
  nFft: number;
  hopLength: number;
  sampleRate: number;
  magnitude: Float32Array;
  power: Float32Array;
}
```

### `stftDb(samples, sampleRate, nFft?, hopLength?)` <Badge type="info" text="中負荷" />

STFT を計算し、dB スケールで返します。

```typescript
function stftDb(
  samples: Float32Array,
  sampleRate?: number, // デフォルト: 22050
  nFft?: number,      // デフォルト: 2048
  hopLength?: number  // デフォルト: 512
): { nBins: number; nFrames: number; db: Float32Array }
```

### `melSpectrogram(samples, sampleRate, nFft?, hopLength?, nMels?)` <Badge type="info" text="中負荷" />

メルスペクトログラムを計算します。人間のピッチ知覚に合わせた周波数表現。

```typescript
function melSpectrogram(
  samples: Float32Array,
  sampleRate?: number, // デフォルト: 22050
  nFft?: number,      // デフォルト: 2048
  hopLength?: number, // デフォルト: 512
  nMels?: number,     // デフォルト: 128
  fmin?: number,      // デフォルト: 0（librosa の既定）
  fmax?: number,      // デフォルト: 0 = sampleRate / 2
  htk?: boolean       // デフォルト: false = Slaney 式。true で HTK
): MelSpectrogramResult

interface MelSpectrogramResult {
  nMels: number;
  nFrames: number;
  sampleRate: number;
  hopLength: number;
  power: Float32Array;
  db: Float32Array;
}
```

### `mfcc(samples, sampleRate, nFft?, hopLength?, nMels?, nMfcc?)` <Badge type="info" text="中負荷" />

MFCC（メル周波数ケプストラム係数）を計算します。スペクトル包絡のコンパクトな表現。

```typescript
function mfcc(
  samples: Float32Array,
  sampleRate?: number, // デフォルト: 22050
  nFft?: number,      // デフォルト: 2048
  hopLength?: number, // デフォルト: 512
  nMels?: number,     // デフォルト: 128
  nMfcc?: number,     // デフォルト: 20
  fmin?: number,      // デフォルト: 0（librosa の既定）
  fmax?: number,      // デフォルト: 0 = sampleRate / 2
  htk?: boolean,      // デフォルト: false = Slaney 式。true で HTK
  lifter?: number     // デフォルト: 0 = リフタリングなし
): MfccResult

interface MfccResult {
  nMfcc: number;
  nFrames: number;
  coefficients: Float32Array;
}
```

`fmin`／`fmax` で Mel 帯域の端を制限でき、`htk: true` で Slaney ではなく HTK の Mel 式を使います。`lifter` は librosa の `lifter` 引数に対応し、高次のケプストラム係数を弱めるケプストラム／正弦リフタリングを行います（`0` でリフタリングなし）。逆変換ヘルパー（`melToStft`、`melToAudio`、`mfccToAudio`）も対応する `fmin`／`fmax`／`htk` 引数を取るため、両側で同じ値を保てば往復しても結果が一致します。

### `chroma(samples, sampleRate, nFft?, hopLength?)` <Badge type="info" text="中負荷" />

クロマグラム（ピッチクラス分布）を計算します。すべての周波数を12のピッチクラス（C, C#, D, ..., B）にマッピング。

<SonareDemo id="chromagram" />

```typescript
function chroma(
  samples: Float32Array,
  sampleRate: number,
  nFft?: number,      // デフォルト: 2048
  hopLength?: number  // デフォルト: 512
): ChromaResult

interface ChromaResult {
  nChroma: number;        // 12
  nFrames: number;
  sampleRate: number;
  hopLength: number;
  features: Float32Array;
  meanEnergy: number[];   // [12] ピッチクラスごと
}
```

### スペクトル特徴

```typescript
// スペクトル重心 (Hz)
function spectralCentroid(samples, sampleRate, nFft?, hopLength?): Float32Array

// スペクトル帯域幅 (Hz)
function spectralBandwidth(samples, sampleRate, nFft?, hopLength?): Float32Array

// スペクトルロールオフ (Hz)
function spectralRolloff(samples, sampleRate, nFft?, hopLength?, rollPercent?): Float32Array

// スペクトル平坦度 (0=調性的, 1=ノイズ的)
function spectralFlatness(samples, sampleRate, nFft?, hopLength?): Float32Array

// スペクトルコントラスト行列、形状は (nBands + 1) x nFrames
function spectralContrast(samples, sampleRate?, nFft?, hopLength?, nBands?, fmin?, quantile?): Matrix2dResult

// フレームごとの多項式スペクトル係数、形状は (order + 1) x nFrames
function polyFeatures(samples, sampleRate?, nFft?, hopLength?, order?): Matrix2dResult

// ゼロ交差率
function zeroCrossingRate(samples, sampleRate, frameLength?, hopLength?): Float32Array

// 波形がゼロを横切るサンプル位置
function zeroCrossings(samples, threshold?, refMagnitude?, pad?, zeroPos?): Int32Array

// RMSエネルギー
function rmsEnergy(samples, sampleRate, frameLength?, hopLength?): Float32Array
```

### 波形ピーク <Badge type="info" text="WASM/Node" />

チャンネルごとの min/max バケットで、全サンプル配列を UI に送らずに波形の概観を描けます。`samplesPerBucket` でバケット幅を指定し（既定 512）、`waveformPeakPyramid` はズームレベルごとに 1 つのレポートを返します。

```typescript
function waveformPeaks(
  samples: Float32Array,   // channels > 1 のときはインターリーブ
  channels: number,
  options?: { samplesPerBucket?: number },  // 既定 512
): WaveformPeaksReport

function waveformPeakPyramid(
  samples: Float32Array,
  channels: number,
  options?: { samplesPerBucketLevels?: number[] },  // 既定 [512, 1024, 2048, 4096]
): WaveformPeaksReport[]

interface WaveformPeaksReport {
  min: Float32Array;        // チャンネルメジャー
  max: Float32Array;        // チャンネルメジャー
  channels: number;
  bucketCount: number;
  samplesPerBucket: number;
}
```

### CQT / VQT / NNLS クロマ / 逆変換 / ラウドネス

これらは単なる追加特徴量ではなく、目的が違います。

| 目的 | 使う API | 理由 |
|------|----------|------|
| 音楽的なピッチ軸の表現 | `cqt(...)`, `pseudoCqt(...)`, `hybridCqt(...)` | オクターブ方向に音高と対応しやすい Constant-Q 表現です。擬似／ハイブリッド版はビンごとの速度と精度のバランスを変えます。 |
| 帯域幅を調整したピッチ表現 | `vqt(...)` | CQT に近く、低域の安定性を調整できます。 |
| コード検出向けのクロマ | `chromaCqt(...)`, `nnlsChroma(...)`, `chromaCens(...)`, `bassChroma(...)` | Constant-Q、NNLS、CENS、低域寄りのクロマは、通常の STFT クロマよりコードや低音域の処理に向く場合があります。 |
| スペクトル形状の詳細 | `spectralContrast(...)`, `polyFeatures(...)`, `zeroCrossings(...)`, `onsetStrengthMulti(...)` | librosa 互換のコントラスト帯域、多項式係数、ゼロ交差インデックス、マルチバンドオンセット強度を返します。 |
| ピッチ／チューニングずれ | `pitchTuning(...)`, `estimateTuning(...)` | 検出済み周波数または音声から、ビン単位のチューニングずれを推定します。 |
| 分解とリミックス | `decompose(...)`, `decomposeWithInit(...)`, `nnFilter(...)`, `remix(...)`, `phaseVocoder(...)`, `hpssWithResidual(...)` | NMF 分解、初期化方式を選べる NMF、近傍フィルタ、区間リミックス、時間スケーリング、残差付き HPSS。 |
| 特徴量や音声の近似復元 | `melToStft`, `melToAudio`, `mfccToMel`, `mfccToAudio` | 可視化、デバッグ、特徴量の往復確認に使います。 |
| 配信向けラウドネス測定 | `lufs`, `lufsInterleaved`, `momentaryLufs`, `shortTermLufs`, `ebur128LoudnessRange` | ITU-R BS.1770 / EBU R128 系のラウドネス値。マルチチャンネル Integrated LUFS と LRA も含みます。 |

```typescript
const cqtResult = cqt(samples, sampleRate, 512, 32.7, 84, 12);
const pseudo = pseudoCqt(samples, sampleRate);
const hybrid = hybridCqt(samples, sampleRate);
const cqtChroma = chromaCqt(samples, sampleRate);
const nnls = nnlsChroma(samples, sampleRate);
const cens = chromaCens(samples, sampleRate);
const bass = bassChroma(samples, sampleRate);
const loudness = lufs(samples, sampleRate);

const contrast = spectralContrast(samples, sampleRate);
const poly = polyFeatures(samples, sampleRate);
const crossings = zeroCrossings(samples);
const onsetBands = onsetStrengthMulti(samples, sampleRate);
const tuning = estimateTuning(samples, sampleRate);
const offset = pitchTuning(pitch.f0);
const { w, h } = decompose(spectrogram, nFeatures, nFrames, 8);
const warmStarted = decomposeWithInit(spectrogram, nFeatures, nFrames, 8, 50, 2.0, 'nndsvd');
const filtered = nnFilter(spectrogram, nFeatures, nFrames);
const remixed = remix(samples, Int32Array.from([0, sampleRate, sampleRate, 2 * sampleRate]));
const stretched = phaseVocoder(samples, 1.5, sampleRate);
const hpssResidual = hpssWithResidual(samples, sampleRate);
const multichannel = lufsInterleaved(interleavedStereo, 2, sampleRate);
const lra = ebur128LoudnessRange(samples, sampleRate);
const reconstructed = melToAudio(mel.power, mel.nMels, mel.nFrames, sampleRate);
```

`chromaCqt(samples, sampleRate?, hopLength?, nChroma?)` は `librosa.feature.chroma_cqt` に直接対応します（対数周波数／Constant-Q でのピッチ畳み込み）。一方 `nnlsChroma` は倍音の漏れを抑える別物の音符活性化（NNLS）クロマで、コードや低音域の処理ではこちらの方がすっきりする場合が多いです。

ソースビルド C++ CLI で近いコマンド:

```bash [C++ CLI]
sonare cqt song.wav
sonare vqt song.wav
sonare nnls-chroma song.wav
sonare lufs song.wav --json
sonare mel-to-audio song.wav -o mel-preview.wav
```

復元の制約とパラメータは [逆変換特徴量](./inverse-features.md)、librosa 互換の詳細は [librosa 互換性](./librosa-compatibility.md) を参照してください。

### ピッチ検出 <Badge type="info" text="中負荷" />

```typescript
// YIN アルゴリズム
function pitchYin(
  samples: Float32Array,
  sampleRate: number,
  frameLength?: number,  // デフォルト: 2048
  hopLength?: number,    // デフォルト: 512
  fmin?: number,         // デフォルト: 65 Hz
  fmax?: number,         // デフォルト: 2093 Hz
  threshold?: number,    // デフォルト: 0.3
  fillNa?: boolean       // デフォルト: false。true なら無声音 f0 フレームを 0 にする
): PitchResult

// pYIN アルゴリズム（確率的 YIN + HMM 平滑化）
function pitchPyin(
  samples: Float32Array,
  sampleRate: number,
  frameLength?: number,
  hopLength?: number,
  fmin?: number,
  fmax?: number,
  threshold?: number,
  fillNa?: boolean       // デフォルト: false。true なら無声音 f0 フレームを 0 にする
): PitchResult

interface PitchResult {
  f0: Float32Array;
  voicedProb: Float32Array;
  voicedFlag: boolean[];
  nFrames: number;
  medianF0: number;
  meanF0: number;
}
```

既定では無声音の `f0` フレームは `NaN` のままです。後段の数値処理が `NaN` を扱えず、無声音を `0` として扱いたい場合だけ `fillNa: true` を指定します。

## 単位変換

これらの関数は軽量で高速です。

```typescript
// Hz <-> Mel (Slaney 式)
function hzToMel(hz: number): number
function melToHz(mel: number): number

// Hz <-> MIDI ノート番号 (A4 = 440 Hz = 69)
function hzToMidi(hz: number): number
function midiToHz(midi: number): number

// Hz <-> ノート名
function hzToNote(hz: number): string      // "A4", "C#5"
function noteToHz(note: string): number

// 時間 <-> フレーム
function framesToTime(frames: number, sr: number, hopLength: number): number
function timeToFrames(time: number, sr: number, hopLength: number): number

// フレーム <-> サンプル (librosa.frames_to_samples / samples_to_frames 相当)
function framesToSamples(frames: number, hopLength?: number, nFft?: number): number
function samplesToFrames(samples: number, hopLength?: number, nFft?: number): number

// dB 変換（ベクトル）
function powerToDb(values: Float32Array, ref?: number, amin?: number, topDb?: number): Float32Array
function amplitudeToDb(values: Float32Array, ref?: number, amin?: number, topDb?: number): Float32Array
function dbToPower(values: Float32Array, ref?: number): Float32Array
function dbToAmplitude(values: Float32Array, ref?: number): Float32Array
```

## メータリング

デコード済みバッファから、レベル、ダイナミクス、ステレオイメージの統計値を返す単体メーターです。マスタリングチェーンやストリーミングエンジンとは独立しています。

`Float32Array`、またはステレオの左右ペアを渡すと、値またはレポートが返ります。

各関数は、`validate` フラグ（既定 `true`）を持つ `options` を任意で受け取ります。ホットパスでは `validate: false` を指定して、NaN/Inf 入力チェックを省略できます。

### 単一チャンネルのレベルメーター

```typescript
// サンプルピーク(dBFS)
function meteringPeakDb(samples: Float32Array, sampleRate?: number, options?: ValidateOptions): number
// RMS レベル(dBFS)
function meteringRmsDb(samples: Float32Array, sampleRate?: number, options?: ValidateOptions): number
// クレストファクター(ピーク − RMS、dB)
function meteringCrestFactorDb(samples: Float32Array, sampleRate?: number, options?: ValidateOptions): number
// 平均(DC)オフセット(リニア振幅)
function meteringDcOffset(samples: Float32Array, sampleRate?: number, options?: ValidateOptions): number
// インターサンプル(トゥルー)ピーク(dBFS)。oversampleFactor は 1..16 の 2 の冪(0 / 省略で 4)
function meteringTruePeakDb(samples: Float32Array, sampleRate?: number, oversampleFactor?: number, options?: ValidateOptions): number
```

### クリッピングとダイナミックレンジ

```typescript
function meteringDetectClipping(
  samples: Float32Array,
  sampleRate?: number,
  options?: MeteringDetectClippingOptions
): ClippingReport

interface MeteringDetectClippingOptions extends ValidateOptions {
  threshold?: number;        // 線形絶対値のしきい値。既定: 0.999
  minRegionSamples?: number; // 報告する最小連続長。既定: 1
}

function meteringDynamicRange(
  samples: Float32Array,
  sampleRate?: number,
  options?: MeteringDynamicRangeOptions
): DynamicRangeReport

interface MeteringDynamicRangeOptions extends ValidateOptions {
  windowSec?: number;      // 0 / 省略で 3 秒
  hopSec?: number;         // 0 / 省略で 1 秒
  lowPercentile?: number;  // 省略または負値で 0.10（0 は文字どおり 0 パーセンタイル）
  highPercentile?: number; // 省略または負値で 0.95
}

interface ClippingReport {
  clippedSamples: number;
  clippingRatio: number;
  maxClippedPeak: number;
  regions: ClippingRegion[];
}
interface ClippingRegion {
  startSample: number;
  endSample: number;
  length: number;
  peak: number;
}
interface DynamicRangeReport {
  dynamicRangeDb: number;
  lowPercentileDb: number;
  highPercentileDb: number;
  windowRmsDb: Float32Array;
}
```

### ステレオイメージ

```typescript
// チャンネル間のピアソン相関(−1..1)
function meteringStereoCorrelation(left: Float32Array, right: Float32Array, sampleRate?: number, options?: ValidateOptions): number
// ミッド/サイドのステレオ幅
function meteringStereoWidth(left: Float32Array, right: Float32Array, sampleRate?: number, options?: ValidateOptions): number
// サンプルごとのミッド/サイド点列
function meteringVectorscope(left: Float32Array, right: Float32Array, sampleRate?: number, options?: ValidateOptions): VectorscopeReport
// フェーズスコープの点列と要約統計
function meteringPhaseScope(left: Float32Array, right: Float32Array, sampleRate?: number, options?: ValidateOptions): PhaseScopeReport

// 表示サイズのミッド/サイドベクタースコープ。meteringVectorscope と同じだが、点列を
// 最大 maxPoints 点まで決定的に間引く（0 / length 以上 = サンプルごとに 1 点）。
function meteringVectorscopeDecimated(left: Float32Array, right: Float32Array, sampleRate?: number, maxPoints?: number, options?: ValidateOptions): VectorscopeReport
// 表示サイズのフェーズスコープ。meteringPhaseScope と同じだが、点列を最大 maxPoints 点まで
// 間引く。要約統計はフル解像度の信号全体で計算される。
function meteringPhaseScopeDecimated(left: Float32Array, right: Float32Array, sampleRate?: number, maxPoints?: number, options?: ValidateOptions): PhaseScopeReport

interface VectorscopeReport {
  mid: Float32Array;
  side: Float32Array;
}
interface PhaseScopeReport {
  mid: Float32Array;
  side: Float32Array;
  radius: Float32Array;
  angleRad: Float32Array;
  correlation: number;
  averageAbsAngleRad: number;
  maxRadius: number;
}
```

`meteringStereoCorrelation`・`meteringStereoWidth`・`meteringVectorscope`・`meteringPhaseScope` は `left` と `right` が同じ長さである必要があります。

### スペクトラムスナップショット

`meteringSpectrum` は信号**全体**を Welch 平均したものです（50% オーバーラップの Hann フレームに分割し、各パワースペクトルを平均）。時間平均しないフレーム単独のスナップショットが必要な場合は `meteringSpectrumFrame` を使い、`frameOffset` 位置引数で解析フレームの開始位置を指定します。

```typescript
function meteringSpectrum(
  samples: Float32Array,
  sampleRate?: number,
  options?: SpectrumOptions & ValidateOptions
): SpectrumReport

// フレーム単独の真のスナップショット（Hann 窓を掛けた nFft の FFT 1 回）。meteringSpectrum のように
// 時間平均しない。解析フレームは [frameOffset, frameOffset + nFft) を対象とし、末尾を超えた分はゼロ埋め。
function meteringSpectrumFrame(
  samples: Float32Array,
  sampleRate?: number,
  frameOffset?: number,
  options?: SpectrumOptions & ValidateOptions
): SpectrumReport

interface SpectrumOptions {
  nFft?: number;                 // 0 / 省略で 2048
  applyOctaveSmoothing?: boolean;
  octaveFraction?: number;       // 例: 3 = 1/3 オクターブ。0 / 省略で 3
  dbRef?: number;                // 0 / 省略で 1.0
  dbAmin?: number;               // 0 / 省略でライブラリの下限値
}
interface SpectrumReport {
  frequencies: Float32Array;
  magnitude: Float32Array;
  power: Float32Array;
  db: Float32Array;
  nFft: number;
  sampleRate: number;
}
```

## スケール量子化

ピッチ補正のターゲットを構築するための 12-TET スケールヘルパーです。`modeMask` は 12 ビットのマスクで、ビット *i* が `root`(`PitchClass`、C = 0)を基準とした *i* 番目のピッチクラスを有効化します。自然な長調は `0b101010110101` です。`referenceMidi` はチューニングの基準音です(A4 = 69 にするには `0` を渡します)。

```typescript
// (小数を含む)MIDI 番号を最も近い有効なピッチクラスにスナップ
function scaleQuantizeMidi(root: number, modeMask: number, midi: number, referenceMidi?: number): number
// 補正量(量子化後 − 入力)をセミトーンで返す
function scaleCorrectionSemitones(root: number, modeMask: number, midi: number, referenceMidi?: number): number
// pitchClass(0..11)が root を基準に modeMask で有効か
function scalePitchClassEnabled(root: number, modeMask: number, pitchClass: number): boolean
```

`scaleQuantizeMidi(...)` を `pitchCorrectToMidi(...)` と組み合わせると、検出した音を最も近いスケール構成音へリチューンできます。

## librosa 互換ヘルパー

librosa 互換ヘルパー群です。対応する `librosa` 関数に合わせており、WASM・Node・Python
すべてのバインディングから利用できます。以下はシグネチャの一覧です。各ヘルパーが対応する
librosa 関数（引数の対応関係）と使いどころは、[librosa 互換性](/ja/docs/librosa-compatibility)
を参照してください。

### プリエンファシス／ディエンファシス

```typescript
function preemphasis(samples: Float32Array, coef?: number, zi?: number): Float32Array  // coef 既定 0.97
function deemphasis(samples: Float32Array, coef?: number, zi?: number): Float32Array
```

`zi` はストリーミング処理で前ブロック末尾の値を受け渡すための初期条件です。

### 無音トリム／無音分割

```typescript
function trimSilence(
  samples: Float32Array,
  topDb?: number,        // 既定 60
  frameLength?: number,  // 既定 2048
  hopLength?: number,    // 既定 512
): { audio: Float32Array; startSample: number; endSample: number }

function splitSilence(
  samples: Float32Array,
  topDb?: number,
  frameLength?: number,
  hopLength?: number,
): Int32Array  // [start0, end0, start1, end1, ...] のフラット配列
```

`trimSilence`（`librosa.effects.trim`）はフレーム RMS とピーク RMS からの `topDb` 差で
無音を判定し、トリム後の音声と元音源上の `[startSample, endSample)` 範囲を返します。
単純なしきい値トリムの `trim(samples, sampleRate, thresholdDb)` とは別物です。
`splitSilence`（`librosa.effects.split`）は非無音区間をサンプル単位の開始／終了ペアで返します。

### フレーミング／パディングのヘルパー

```typescript
function frameSignal(
  samples: Float32Array,
  frameLength: number,
  hopLength: number,
): { nFrames: number; frames: Float32Array }  // row-major

function padCenter(values: Float32Array, targetSize: number, padValue?: number): Float32Array
function fixLength(values: Float32Array, targetSize: number, padValue?: number): Float32Array
function fixFrames(frames: Int32Array, xMin?: number, xMax?: number, pad?: boolean): Int32Array
```

`frameSignal` は `librosa.util.frame`、`padCenter` / `fixLength` /
`fixFrames` は対応する `librosa.util` の同名関数と互換です。

### ピーク検出／ベクトル正規化

```typescript
function peakPick(
  values: Float32Array,
  preMax: number,
  postMax: number,
  preAvg: number,
  postAvg: number,
  delta: number,
  wait: number,
): Int32Array  // ピーク位置のインデックス

function vectorNormalize(
  values: Float32Array,
  normType?: number,  // 0=inf, 1=L1, 2=L2, 3=power（既定 0）
  threshold?: number, // 既定 1e-12
): Float32Array
```

`peakPick` は `librosa.util.peak_pick`（オンセット包絡などの 1 次元信号に対する後処理）、
`vectorNormalize` は `librosa.util.normalize` に対応します。`peakPick` の窓パラメータや
各 `normType` の意味は [librosa 互換性](/ja/docs/librosa-compatibility) を参照してください。

### PCEN（チャンネル別エネルギー正規化）

```typescript
function pcen(
  values: Float32Array,
  nBins: number,
  nFrames: number,
  options?: {
    sampleRate?: number;
    hopLength?: number;
    timeConstant?: number;  // 既定 0.4
    gain?: number;          // 既定 0.98
    bias?: number;          // 既定 2.0
    power?: number;         // 既定 0.5
    eps?: number;           // 既定 1e-6
  },
): Float32Array
```

`pcen` は `librosa.pcen` 互換です。入力は row-major の
`[nBins x nFrames]` メルスペクトログラム、出力も同じレイアウトです。

### Tonnetz／Tempogram／PLP

```typescript
function tonnetz(
  chromagram: Float32Array,   // row-major [nChroma x nFrames]
  nChroma: number,
  nFrames: number,
): Float32Array               // [6 x nFrames]

function tempogram(
  onsetEnvelope: Float32Array,
  sampleRate: number,
  hopLength?: number,         // 既定 512
  winLength?: number,         // 既定 384
  mode?: 'autocorrelation' | 'auto' | 'ac' | 'cosine' | 0 | 1,  // 既定 'autocorrelation'
): { nFrames: number; winLength: number; data: Float32Array }

function fourierTempogram(
  onsetEnvelope: Float32Array,
  sampleRate?: number,
  hopLength?: number,
  winLength?: number,
): { nBins: number; nFrames: number; data: Float32Array }

function cyclicTempogram(
  onsetEnvelope: Float32Array,
  sampleRate: number,
  hopLength?: number,
  winLength?: number,
  bpmMin?: number,            // 既定 60
  nBins?: number,             // 既定 60
): { nFrames: number; nBins: number; data: Float32Array }

function tempogramRatio(
  tempogramData: Float32Array,
  winLength?: number,
  sampleRate?: number,
  hopLength?: number,
  factors?: Float32Array | number[], // 既定 [0.5, 1, 2, 3, 4]
): Float32Array

function plp(
  onsetEnvelope: Float32Array,
  sampleRate: number,
  hopLength?: number,
  tempoMin?: number,          // 既定 30
  tempoMax?: number,          // 既定 300
  winLength?: number,
): Float32Array
```

`tempogram` では、`mode: 'cosine'` で窓内コサイン類似度の変種になります（`'auto'`、`'ac'`、`0`、`1` の alias も受け付けます）。各ヘルパーが対応する librosa の特徴量は [librosa 互換性](/ja/docs/librosa-compatibility)、使い分けは [リアルタイムとストリーミング](./realtime-streaming.md#オンセット包絡からテンポグラムへ) を参照してください。

## リサンプリング

### `resample(samples, srcSr, targetSr)` <Badge type="info" text="中負荷" />

r8brain アルゴリズムを使用した高品質リサンプリング。

```typescript
function resample(
  samples: Float32Array,
  srcSr: number,
  targetSr: number
): Float32Array
```

## Audio クラス

`Audio` クラスは、よく使う関数をメソッド形式で呼ぶための入口です。サンプルとサンプルレートを内部で保持するため、各呼び出しで渡し直す必要がありません。

### `Audio.fromBuffer(samples, sampleRate)`

サンプルデータから Audio インスタンスを作成します。

```typescript
const audio = Audio.fromBuffer(samples, 44100);
```

`sampleRate` は省略可能で、既定は `48000` です。保持された値はすべてのインスタンスメソッドに渡されるため、必ずバッファ本来のサンプルレートを指定してください。

### `Audio.fromMemory(bytes)`

WAV や MP3 などのエンコード済みオーディオバイト列（`Uint8Array`）をネイティブ WASM デコーダでデコードし、`Audio` インスタンスを返します。同梱デコーダが対応しない形式の場合は `SonareError` をスローします。

```typescript
const audio = Audio.fromMemory(new Uint8Array(await file.arrayBuffer()));
```

### `Audio.fromMemoryWithBrowserFallback(bytes, options?)`

`async` で `Promise<Audio>` を返します。まず `Audio.fromMemory` を試みます。同梱デコーダが AAC・OGG・FLAC などの形式を読めない場合は、ブラウザのコーデックスタック（`AudioContext.decodeAudioData`）で代わりにデコードします。ブラウザでデコードしたマルチチャンネル音声は、返される `Audio` オブジェクトが 1 本のサンプル列を持つようにモノラルへダウンミックスされます。任意の `BrowserAudioDecodeOptions`（`audioContext` / `createAudioContext` / `targetSampleRate`）を受け取り、このヘルパー自身が生成したコンテキストは後で閉じられます。

```typescript
const audio = await Audio.fromMemoryWithBrowserFallback(
  new Uint8Array(await file.arrayBuffer()),
);
```

### プロパティ

| プロパティ | 型 | 説明 |
|----------|------|-------------|
| `audio.data` | `Float32Array` | サンプルデータ |
| `audio.length` | `number` | サンプル数 |
| `audio.sampleRate` | `number` | サンプルレート（Hz） |
| `audio.duration` | `number` | 長さ（秒） |

### インスタンスメソッド

`Audio` クラスは、よく使う単発ヘルパーをメソッド形式で呼ぶための入口です。サンプルとサンプルレートを内部に保持するので、毎回渡す必要がありません。

`analyzeSections(...)`、`analyzeMelody(...)`、`analyzeDynamics(...)`、`analyzeTimbre(...)`、ルーム音響系の関数は、WASM パッケージでは独立した関数として呼び出します。

```typescript
import {
  init,
  Audio,
  analyzeSections,
  analyzeMelody,
  analyzeDynamics,
  analyzeTimbre,
  detectAcoustic,
} from '@libraz/libsonare';

await init();

const audio = Audio.fromBuffer(samples, 44100);

// 解析
const bpm = audio.detectBpm();
const key = audio.detectKey();
const keyCandidates = audio.detectKeyCandidates();
const beats = audio.detectBeats();
const downbeats = audio.detectDownbeats();
const onsets = audio.detectOnsets();
const result = audio.analyze();
const chords = audio.detectChords({ useHmm: true });
const sections = analyzeSections(audio.data, audio.sampleRate);
const melody = analyzeMelody(audio.data, audio.sampleRate);
const dynamics = analyzeDynamics(audio.data, audio.sampleRate);
const timbre = analyzeTimbre(audio.data, audio.sampleRate);
const acoustic = detectAcoustic(audio.data, audio.sampleRate);

// エフェクト
const { harmonic, percussive } = audio.hpss();
const corrected = audio.pitchCorrectToMidi(68.7, 69);
const held = audio.noteStretch({ onsetSample: 12000, offsetSample: 24000, stretchRatio: 1.25 });
const voice = audio.voiceChange({ pitchSemitones: 3, formantFactor: 1.05 });
const stretched = audio.timeStretch(1.5);
const shifted = audio.pitchShift(2);
const normalized = audio.normalize(-3.0);
const trimmed = audio.trim(-60.0);

// 特徴抽出
const stftResult = audio.stft();
const mel = audio.melSpectrogram();
const mfcc = audio.mfcc();
const chroma = audio.chroma();
const nnls = audio.nnlsChroma();
const env = audio.onsetEnvelope();
const loudness = audio.lufs();
const centroid = audio.spectralCentroid();
const bandwidth = audio.spectralBandwidth();
const rolloff = audio.spectralRolloff();
const flatness = audio.spectralFlatness();
const zcr = audio.zeroCrossingRate();
const rms = audio.rmsEnergy();
const pitch = audio.pitchPyin();

// リサンプリング
const resampled = audio.resample(22050);
```

引数のデフォルト値（`nFft`、`hopLength`、`nMels` など）はスタンドアロン関数と同じです。

## ストリーミング API

ストリーミング API は、リアルタイムの音声解析とビジュアライゼーションを可能にします。バッチ解析とは異なり、ストリーミングは音声をチャンクごとに処理し、低レイテンシを実現します。

::: tip 使い分け
- **バッチ API**: 録音済みファイル、総合解析（BPM、キー、コード、セクション）
- **ストリーミング API**: ライブ音声、ビジュアライゼーション、リアルタイムフィードバック
:::

この節は `StreamAnalyzer` の型／クラスリファレンスです。実際に動かすレシピ、AudioWorklet ブリッジ、出力フォーマットの詳細、プログレッシブ推定の解説は [リアルタイムとストリーミング](./realtime-streaming.md) を参照してください。

### StreamConfig

StreamAnalyzer の設定オプション。

```typescript
interface StreamConfig {
  sampleRate?: number;         // デフォルト: 44100（ストリームの既定。22050 ではない）
  nFft?: number;               // デフォルト: 2048
  hopLength?: number;          // デフォルト: 512
  nMels?: number;              // デフォルト: 128
  fmin?: number;               // デフォルト: 0
  fmax?: number;               // デフォルト: 0（= sr/2）
  tuningRefHz?: number;        // デフォルト: 440
  computeMel?: boolean;        // デフォルト: true
  computeChroma?: boolean;     // デフォルト: true
  computeOnset?: boolean;      // デフォルト: true
  computeSpectral?: boolean;   // デフォルト: true
  emitEveryNFrames?: number;   // デフォルト: 1（スロットリングなし）
  magnitudeDownsample?: number;// デフォルト: 1
  maxPendingFrames?: number;   // デフォルト: 4096。超過時は最古の未読フレームを破棄
  keyUpdateIntervalSec?: number;  // デフォルト: 5
  bpmUpdateIntervalSec?: number;  // デフォルト: 10
  window?: number;             // 0=Hann（既定）, 1=Hamming, 2=Blackman, 3=Rectangular
  outputFormat?: number;       // 0=Float32（既定）, 1=Int16, 2=Uint8
}
```

`outputFormat` は `readFramesU8`／`readFramesI16` が出力時にどう量子化するかを
制御します（内部解析は常に float）。[リアルタイムとストリーミング](./realtime-streaming.md#フレームの読み出しと出力フォーマット) を参照してください。

旧来の `computeMagnitude` フラグはサポートされなくなり、指定するとコンストラクタが例外を投げます。マグニチュードのフレームは StreamAnalyzer の読み出し経路では公開されないため、このフラグは削除されました。マグニチュードのデータが必要な場合は、オフラインで `stft`／`stftDb` を使うか、スペクトラムメータリングのヘルパーを使ってください。

`streamAnalyzerConfigDefaults()` は、上記の各フィールドについてライブラリの既定値を保持した、すべての項目が入った `StreamConfigDefaults` オブジェクト（`Required<StreamConfig>`）を返します。設定 UI の初期値として使ったり、ユーザー指定の設定との差分計算に使えます。`StreamAnalyzer` 自身も、省略されたフィールドにはこの同じ既定値を適用します。

### StreamAnalyzer クラス

```typescript
class StreamAnalyzer {
  constructor(config: StreamConfig);

  // 音声チャンクを処理（内部オフセット追跡）
  process(samples: Float32Array): void;

  // 外部同期で処理
  processWithOffset(samples: Float32Array, sampleOffset: number): void;

  // 読み取り可能なフレーム数
  availableFrames(): number;

  // 処理済みフレームを読み取り（完全な float 精度）
  readFrames(maxFrames: number): FrameBuffer;

  // 帯域削減転送／可視化向けの量子化読み出し
  // (quantizeConfig を渡すと音量が極端に大きい／小さいストリームの量子化範囲を調整できる;
  // リアルタイムとストリーミング → カスタム量子化範囲 を参照)
  readFramesU8(maxFrames: number, quantizeConfig?: StreamQuantizeConfig): StreamFramesU8;   // Uint8 特徴量配列
  readFramesI16(maxFrames: number, quantizeConfig?: StreamQuantizeConfig): StreamFramesI16; // Int16 特徴量配列

  // 新しいストリーム用に状態をリセット
  reset(baseSampleOffset?: number): void;

  // 統計情報と、音声が届くにつれて更新される推定を取得
  stats(): AnalyzerStats;

  // 処理済みの総フレーム数
  frameCount(): number;

  // 現在の時間位置（秒）
  currentTime(): number;

  // サンプルレートを取得
  sampleRate(): number;

  // パターンロックタイミング用の予想総再生時間を設定
  setExpectedDuration(durationSeconds: number): void;

  // 大音量/圧縮音声用のノーマライゼーションゲインを設定
  setNormalizationGain(gain: number): void;

  // チューニング基準周波数を設定（デフォルト: 440 Hz）
  setTuningRefHz(refHz: number): void;

  // リソースを解放（使用終了時に呼び出し）。`delete()` が正規で、`dispose()` はその alias。
  delete(): void;
  dispose(): void;
}
```

### FrameBuffer

`postMessage` での効率的な転送用の Structure-of-Arrays 形式。

```typescript
interface FrameBuffer {
  nFrames: number;
  nMels: number;
  timestamps: Float32Array;      // [nFrames]
  mel: Float32Array;             // [nFrames * nMels]
  chroma: Float32Array;          // [nFrames * 12]
  onsetStrength: Float32Array;   // [nFrames]
  rmsEnergy: Float32Array;       // [nFrames]
  spectralCentroid: Float32Array;// [nFrames]
  spectralFlatness: Float32Array;// [nFrames]
  chordRoot: Int32Array;         // [nFrames] フレームごとのコードルート
  chordQuality: Int32Array;      // [nFrames] フレームごとのコードクオリティ
  chordConfidence: Float32Array; // [nFrames] フレームごとのコード信頼度
}
```

### ChordChange

検出されたコード変化。

```typescript
interface ChordChange {
  root: PitchClass;
  quality: ChordQuality;
  startTime: number;
  confidence: number;
}
```

### BarChord

小節境界で検出されたコード（ビート同期）。

```typescript
interface BarChord {
  barIndex: number;
  root: PitchClass;
  quality: ChordQuality;
  startTime: number;
  confidence: number;
}
```

### PatternScore

既知のコード進行パターンの一致スコア。

```typescript
interface PatternScore {
  name: string;   // パターン名（例: "royalRoad", "pop"）
  score: number;  // 一致スコア（0-1）
}
```

### AnalyzerStats

```typescript
interface AnalyzerStats {
  totalFrames: number;
  totalSamples: number;
  durationSeconds: number;
  pendingFrames: number;       // 現在バッファされている未読フレーム数
  droppedOutputFrames: number; // 上限到達時に破棄された最古フレームの累計
  estimate: ProgressiveEstimate;
}
```

### ProgressiveEstimate

処理された音声が増えるにつれて精度が向上する BPM、キー、コードの推定値。

```typescript
interface ProgressiveEstimate {
  // BPM 推定
  bpm: number;              // 未推定の場合は 0
  bpmConfidence: number;    // 0-1、時間とともに増加
  bpmCandidateCount: number;

  // キー推定
  key: PitchClass;          // 0-11（C-B）
  keyMinor: boolean;
  keyConfidence: number;    // 0-1、時間とともに増加

  // コード推定（現在）
  chordRoot: PitchClass;
  chordQuality: ChordQuality;
  chordConfidence: number;
  chordStartTime: number;
  chordProgression: ChordChange[];     // 検出されたコード変化
  barChordProgression: BarChord[];     // 小節同期コード
  currentBar: number;                  // 現在の小節インデックス
  barDuration: number;                 // 小節の長さ（秒）

  // パターン検出
  votedPattern: BarChord[];            // 各パターン位置の投票済みコード
  patternLength: number;              // 繰り返しパターンの長さ（デフォルト: 4小節）
  detectedPatternName: string;        // 最も一致するパターン名（例: "royalRoad"）
  detectedPatternScore: number;       // 一致スコア（0-1）
  allPatternScores: PatternScore[];   // 全既知パターンのスコア

  // 統計情報
  accumulatedSeconds: number;
  usedFrames: number;
  updated: boolean;         // このフレームで推定が更新された場合 true
}
```

### 使い方、AudioWorklet 統合、タイミング

`StreamAnalyzer` を実際に動かすレシピ（`AudioWorklet` からブロックを流し込む、フレームを読み出す、`emitEveryNFrames` でスロットリングする、`FrameBuffer` のストリーム時間タイムスタンプを `AudioContext.currentTime` に対応付ける）は、AudioWorklet ハンドシェイクとデータフロー図とともに [リアルタイムとストリーミング](./realtime-streaming.md) にあります。

::: tip WASM オブジェクトの解放
`StreamAnalyzer`、`Mixer`、`StreamingEqualizer`、`StreamingMasteringChain` は WASM ヒープメモリを指す **embind** ハンドルで、JavaScript のガベージコレクタは回収できません。使い終わったら `delete()` を呼んでください（`StreamAnalyzer` は `dispose()` も受け付け、一部のクラスは `destroy()` を alias として公開します）。`analyze()` のような通常の関数は普通の JS 値を返すので後始末は不要です。Node ネイティブの解放方法は異なるため、[ネイティブバインディング](./native-bindings.md) を参照してください。
:::

## 型定義

### AnalysisResult

```typescript
interface AnalysisResult {
  bpm: number;
  bpmConfidence: number;
  key: Key;
  timeSignature: TimeSignature;
  beatTimes: Float32Array;  // beats[].time のコピー。librosa 互換コードで便利
  beats: Beat[];            // 各拍の強度を含むオブジェクト配列
  chords: Chord[];
  sections: Section[];
  timbre: Timbre;
  dynamics: Dynamics;
  rhythm: RhythmFeatures;
  melody: MelodyContour;
  form: string;  // 例: "IABABCO"
}
```

### Beat

```typescript
interface Beat {
  time: number;      // 秒
  strength: number;  // 0.0 〜 1.0
}
```

### Chord

```typescript
interface Chord {
  root: PitchClass;
  bass: PitchClass;     // 転回形のベース音
  quality: ChordQuality;
  start: number;       // 秒
  end: number;         // 秒
  confidence: number;
  name: string;        // "C", "Am", "G7"
}
```

### Section

```typescript
interface Section {
  type: SectionType;
  start: number;
  end: number;
  energyLevel: number;
  confidence: number;
  name: string;  // "Intro", "Verse 1", "Chorus"
}
```

### TimeSignature

```typescript
interface TimeSignature {
  numerator: number;    // 例: 4
  denominator: number;  // 例: 4
  confidence: number;
}
```

### Timbre

```typescript
interface Timbre {
  brightness: number;   // 0.0 〜 1.0
  warmth: number;
  density: number;
  roughness: number;
  complexity: number;
}

interface TimbreFrame {
  brightness: number;
  warmth: number;
  density: number;
  roughness: number;
  complexity: number;
}

interface TimbreAnalysisResult extends TimbreFrame {
  spectralCentroid: Float32Array;
  spectralFlatness: Float32Array;
  spectralRolloff: Float32Array;
  timbreOverTime: TimbreFrame[];
}
```

### Dynamics

```typescript
interface Dynamics {
  dynamicRangeDb: number;
  peakDb: number;
  rmsDb: number;
  loudnessRangeDb: number;
  crestFactor: number;
  isCompressed: boolean;
}
```

### RhythmFeatures

```typescript
interface RhythmFeatures {
  syncopation: number;
  grooveType: string;  // "straight", "shuffle", "swing"
  patternRegularity: number;
  tempoStability: number;
  timeSignature: TimeSignature;
}
```

### MelodyContour

```typescript
interface MelodyContour {
  pitchRangeOctaves: number;
  pitchStability: number;
  meanFrequency: number;
  vibratoRate: number;     // Hz
  pitches: MelodyPoint[];  // フレームごとのピッチ軌跡
}
```

### MelodyPoint

```typescript
interface MelodyPoint {
  time: number;        // フレーム時刻（秒）
  frequency: number;   // 推定 f0（Hz、無声音のときは 0）
  confidence: number;  // 有声らしさ、0.0〜1.0
}
```

## 列挙型

### PitchClass

```typescript
const PitchClass = {
  C: 0, Cs: 1, D: 2, Ds: 3, E: 4, F: 5,
  Fs: 6, G: 7, Gs: 8, A: 9, As: 10, B: 11
} as const;
```

### Mode

```typescript
const Mode = {
  Major: 0,
  Minor: 1,
  Dorian: 2,
  Phrygian: 3,
  Lydian: 4,
  Mixolydian: 5,
  Locrian: 6
} as const;
```

### ChordQuality

```typescript
const ChordQuality = {
  Major: 0, Minor: 1, Diminished: 2, Augmented: 3,
  Dominant7: 4, Major7: 5, Minor7: 6, Sus2: 7, Sus4: 8,
  Unknown: 9, Add9: 10, MinorAdd9: 11, Dim7: 12,
  HalfDim7: 13, Major9: 14, Dominant9: 15, Sus2Add4: 16
} as const;
```

### SectionType

```typescript
const SectionType = {
  Intro: 0, Verse: 1, PreChorus: 2, Chorus: 3,
  Bridge: 4, Instrumental: 5, Outro: 6, Unknown: 7
} as const;
```

## エラーハンドリング

モジュールが未初期化の場合、すべての関数はエラーをスローします。まず `await init()` を呼んでください。

ネイティブ(C++)側の失敗は、構造化された **`SonareError`** としてスローされます。`Error` のサブクラスで、C ABI のエラー enum をそのまま映した数値の `code` と正準名 `codeName` を持つため、メッセージ文字列の照合ではなく原因コードで分岐できます。同じ失敗はどのバインディング(WASM / Node ネイティブ / Python / C ABI)でも同じ数値コードを報告します。パッケージは `ErrorCode` enum、`SonareError` クラス、型ガード `isSonareError(value)` をエクスポートします。

v1.5.1 以降、各 facade は非有限数、不正な enum／インデックス値、過大なリソースを DSP やシリアライズへ渡す前に一貫して拒否します。これらは入力不正として扱い、バインディングが暗黙にクランプしたり不正値を受理したりすることへ依存しないでください。

```typescript
import { ErrorCode, isSonareError, Mixer } from '@libraz/libsonare';

try {
  const mixer = Mixer.fromSceneJson(sceneJson, 48000, 512);
} catch (error) {
  if (isSonareError(error) && error.code === ErrorCode.InvalidParameter) {
    // 例: 'send timing must be a string ("pre" or "post")'
    console.error(`scene rejected: ${error.codeName}: ${error.message}`);
  } else {
    throw error;
  }
}
```

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
| `Unknown` | `99` |

このコードは Python の `SonareError.code` および C ABI の `SonareError` enum と一致し、Python CLI は同じコードを[終了コード](./cli.md#終了コード)へ対応付けます。

## マスタリング API

ブラウザ向けパッケージには `/ja/mastering` デモと同じ名前付きマスタリングプロセッサが含まれます。Web Audio API などでデコードした `Float32Array` のチャンネルバッファを渡し、戻り値のサンプルをアプリ側で WAV などに書き出します。

この節では JS の入口と、その結果／設定の型を一覧します。各プロセッサの働き、プリセット一覧、解析／アシスタントが返す JSON は、[マスタリングプロセッサ](./mastering-processors.md) と [マスタリングアシスタント](./mastering-assistant.md) を参照してください。

```typescript
import { init, masterAudioStereo, masteringChainStereo } from '@libraz/libsonare'

await init()

// ステージを明示したフルチェーン
const result = masteringChainStereo(left, right, sampleRate, {
  spectral: { airBand: { amount: 0.35, shelfFrequencyHz: 14000 } },
  maximizer: { truePeakLimiter: { ceilingDb: -1, oversampleFactor: 4 } },
  loudness: { targetLufs: -14, ceilingDb: -1, truePeakOversample: 4 },
})
console.log(result.outputLufs, result.appliedGainDb, result.stages)

// プリセット + フラットなドット記法の上書き
const presetResult = masterAudioStereo(left, right, sampleRate, 'pop', {
  'loudness.targetLufs': -14,
  'maximizer.truePeakLimiter.releaseMs': 50,
})
```

これらにはそれぞれ `(progress, stage) => void` のコールバックを取る `*WithProgress` 変種があります。`masteringProcess(...)` / `masteringProcessStereo(...)` は名前付きプロセッサを 1 つ実行し、`masteringStereoAnalyze(...)` は JSON レポートを返します。

説明可能なマスタリングのヘルパー（`masteringAudioProfile(...)`、`masteringAssistantSuggest(...)`、`masteringStreamingPreview(...)`）は JSON 文字列を返します。正確な形、受け付けるオプション、提案をレンダー済みマスターに変換する方法は [マスタリングアシスタント](./mastering-assistant.md) を参照してください。リファレンストラック用途では `masteringPairProcessorNames()` と `masteringPairAnalyze()` を使います（サンプルレートを揃え、長さも近づける）。

### StreamingEqualizer

`StreamingEqualizer` は、ブロック単位で動かすリアルタイム安全な EQ オブジェクトです。

最大 24 バンド、`zero-latency` / `natural` / `linear` の位相モード、ダイナミック EQ、ミッド／サイド処理、外部サイドチェイン、スペクトルスナップショット、オフラインのリファレンスマッチを扱えます。

WASM 版では先に `init()` を呼び、使い終わったら `delete()` で解放します。

```typescript
import { init, StreamingEqualizer } from '@libraz/libsonare';
await init();

const eq = new StreamingEqualizer({ sampleRate: 48000, maxBlockSize: 512 });
try {
  eq.setBand(0, {
    type: 'HighShelf',
    frequencyHz: 8000,
    gainDb: 4,
    q: 0.7,
    enabled: true,
  });
  eq.setPhaseMode(1); // 1 = zero-latency, 2 = natural, 3 = linear
  eq.setAutoGain(true);

  const { left, right } = eq.processStereo(leftBlock, rightBlock);
  console.log(eq.spectrum(), eq.latencySamples(), left, right);
} finally {
  eq.delete();
}
```

ファイル単位の EQ / フィルタ処理に対応するソースビルド C++ CLI 例:

```bash [C++ CLI]
sonare eq track.wav --type 2 --frequency-hz 8000 --gain-db 4 --q 0.7 -o eq.wav
sonare filter track.wav --type hp --cutoff 80 -o filtered.wav
```

### StreamingRetune

`StreamingRetune` は、ブロック単位で動かすモノラルのピッチリチューン用オブジェクトです。グレインとディレイの状態を呼び出し間で保持するため、最初のブロック前に `prepare()`、使い終わったら `delete()` を呼びます。

```typescript
import { init, StreamingRetune } from '@libraz/libsonare';
await init();

const retune = new StreamingRetune({ semitones: 3, mix: 1, grainSize: 0 });
retune.prepare(48000, 512);

try {
  const out = retune.processMono(inputBlock);
  retune.setConfig({ semitones: -2, mix: 0.75 });
  console.log(out, retune.config(), retune.grainSize());
} finally {
  retune.delete();
}
```

ソースビルド C++ CLI でのオフラインファイル処理に近いコマンド:

```bash [C++ CLI]
sonare pitch-shift vocal.wav --semitones 3 -o shifted.wav
sonare voice-change vocal.wav --pitch-semitones 3 --formant-factor 1.0 -o voice.wav
```

### RealtimeVoiceChanger

`RealtimeVoiceChanger` はプリセットで動かすライブ音声チェーン（リチューン、フォルマント、EQ、ゲート、コンプレッサー、ディエッサー、リバーブ、リミッターの各段）で、音声ブロックをまたいで状態を保持します。モニタリング、AudioWorklet 形式の処理、または `voiceChange(...)` では単純すぎるチャンク単位の音声処理で使います。標準プリセット ID は `realtimeVoiceChangerPresetNames()` で取得し、プリセット JSON は `realtimeVoiceChangerPresetJson(...)` で取得、`validateRealtimeVoiceChangerPresetJson(...)` で検証できます（スキーマバージョン `1`）。

```typescript
import { init, RealtimeVoiceChanger, realtimeVoiceChangerPresetNames } from '@libraz/libsonare';
await init();

const changer = new RealtimeVoiceChanger(realtimeVoiceChangerPresetNames()[1]); // 例: "bright-idol"
changer.prepare(48000, /*maxBlockSize=*/128, /*channels=*/1);
try {
  const out = changer.processMono(inputBlock);
  const realtime = changer.createRealtimeMonoBuffer(128); // ゼロコピーの WASM ヒープビュー
  realtime.input.set(inputBlock.subarray(0, 128));
  realtime.process();
  console.log(out, realtime.output, changer.latencySamples());
} finally {
  changer.delete();
}
```

ゼロコピーバッファヘルパー（`createRealtimeMonoBuffer`、`createRealtimeInterleavedBuffer`、`createRealtimePlanarBuffer`）は changer が所有する WASM ヒープのビューを返します。リアルタイムループ内で再利用し、`delete()` 後は破棄してください。プリセット一覧とチェーン各段は [リアルタイムボイスチェンジャー](./realtime-voice-changer.md) を参照してください。

### `voiceChangeRealtime(samples, sampleRate?, preset?, options?)`

`voiceChangeRealtime(...)` は `RealtimeVoiceChanger` をバッファ全体に対してオフラインで一括適用する便利関数です。内部で changer を構築・準備し、ブロック単位のレンダリングループを実行したうえで破棄します（Python の `voice_change_realtime` や Node の同等関数と同じ考え方です）。そのため、呼び出し側が状態を持つオブジェクトを管理する必要はありません。

```typescript
function voiceChangeRealtime(
  samples: Float32Array,
  sampleRate?: number, // デフォルト 48000
  preset?: VoicePresetId | number | RealtimeVoiceChangerConfigInput,
  options?: {
    channels?: 1 | 2;   // デフォルト 1（モノラル）。2 = インターリーブステレオ (L0,R0,L1,R1,...)
    blockSize?: number; // デフォルト 512
  },
): Float32Array  // 入力と同じレイアウト・長さ
```

バッファ全体が手元にある場合はこれを使います。ブロック単位のライブ処理を手動で行う場合は [`RealtimeVoiceChanger`](#realtimevoicechanger) を、フルのプリセットチェーンが不要で一度きりのピッチ／フォルマント変更だけが必要な場合は `voiceChange(...)` を使ってください。

### StreamingMasteringChain

リアルタイム処理やメモリ制約のあるユースケース（`AudioWorklet` やストリーム
入力からのブロック単位処理など）向けに、WASM モジュールは
`StreamingMasteringChain` を公開しています。受け取るのは `StreamingMasteringChainConfig` で、これは `masteringChain()` の `MasteringChainConfig` に、ストリーミング専用の任意フィールドを 2 つ追加したものです。

- `loudnessStaticGainDb` — 事前計算した静的ラウドネスゲイン（dB、例: `targetLufs - measuredIntegratedLufs`）。ブロックごとに適用され、`loudness` ステージを有効にしたプリセットのストリーミングプレビューがオフラインレンダリングと一致するようにします。
- `loudnessStaticGainPeakDb` — オフラインで計測した音源のトゥルーピーク（dBFS）。指定すると静的ゲインが `loudness.ceilingDb - loudnessStaticGainPeakDb` にクランプされ、ストリーミングのリミッターへオフラインチェーンより大きい入力が入らないようにします。

それ以外は、固定ブロックサイズで内部状態を準備したうえで、入力ブロックに対してチェーンを順番に適用します。

```typescript
import { init, StreamingMasteringChain } from '@libraz/libsonare';
await init();

const chain = new StreamingMasteringChain({
  eq: { tiltDb: 0.5 },
  dynamics: { compressor: { thresholdDb: -20 } },
  maximizer: { truePeakLimiter: { ceilingDb: -1, oversampleFactor: 4 } },
});

chain.prepare(48000, /*maxBlockSize=*/512, /*numChannels=*/2);

const monoOut = chain.processMono(monoBlock);                // 1ch
const { left, right } = chain.processStereo(leftBlock, rightBlock); // 2ch

console.log(chain.stageNames());      // ['eq.tilt', 'dynamics.compressor', ...]
console.log(chain.latencySamples());  // 有効ステージの合計レイテンシ

chain.reset();   // prepare し直さずに状態だけクリア
chain.delete();  // WASM ハンドルを解放（使い終わったら呼ぶ）
```

`numChannels === 1` のときはステレオ専用ステージはスキップされます。チェーン設定のリペアステージ（`repair.declick`／`repair.dereverb`／`repair.denoise`）はオフライン専用で、streaming constructor で有効にすると例外を投げます。`masteringChain*` / `masterAudio*`、または単発の `masteringRepair*` ヘルパーで実行してください（`declip`／`decrackle`／`dehum` はチェーン設定に含まれず、これらのヘルパーからのみ実行できます）。`loudness` ステージも、ストリーミングチェーンが信号全体の積分 LUFS を計測できないため、`loudnessStaticGainDb`（任意で `loudnessStaticGainPeakDb` も）を指定しない限り例外を投げます。同じチェーンで複数曲を順に処理する場合は `reset()`、使い終わったら `delete()` を呼んでハンドルを解放してください。

名前付きマスタリング API は次の系統に分かれます。

| 目的 | 関数 |
|------|----------|
| シンプルなラウドネスマスタリングを実行 | `mastering()` |
| 組み込みプリセットの一覧 | `masteringPresetNames()` |
| プリセットをモノラルに適用 | `masterAudio()` |
| プリセットをステレオに適用 | `masterAudioStereo()` |
| プリセットをモノラルに適用（進捗付き） | `masterAudioWithProgress()` |
| プリセットをステレオに適用（進捗付き） | `masterAudioStereoWithProgress()` |
| フルチェーン実行（モノラル） | `masteringChain()` |
| フルチェーン実行（ステレオ） | `masteringChainStereo()` |
| ブロック単位の EQ | `StreamingEqualizer` |
| 進捗付きフルチェーン実行（モノラル） | `masteringChainWithProgress()` |
| 進捗付きフルチェーン実行（ステレオ） | `masteringChainStereoWithProgress()` |
| ストリーミング（ブロック単位）チェーン | `StreamingMasteringChain` |
| マスタリング判断用の音源プロファイルを取得 | `masteringAudioProfile()` |
| 音源解析からマスタリングの提案を取得 | `masteringAssistantSuggest()` |
| 配信先ごとのラウドネス見込みをプレビュー | `masteringStreamingPreview()` |
| 名前付きプロセッサ一覧（モノラル／ステレオ） | `masteringProcessorNames()` |
| プロセッサ分類カタログを取得 | `masteringProcessorCatalog()` |
| チェーンのインサートプロセッサ一覧 | `masteringInsertNames()` |
| インサートが受け付けるパラメータキー一覧 | `masteringInsertParamNames(name)` |
| リアルタイムオートメーション可能なインサートパラメータ一覧 | `masteringInsertParamInfo(name)` |
| モノラル音声を処理 | `masteringProcess()` |
| ステレオ音声を処理 | `masteringProcessStereo()` |
| ペアプロセッサ一覧 | `masteringPairProcessorNames()` |
| ソース／リファレンスのペアを処理 | `masteringPairProcess()` |
| ペア解析の一覧 | `masteringPairAnalysisNames()` |
| ソース／リファレンスのペアを解析 | `masteringPairAnalyze()` |
| ステレオ解析の一覧 | `masteringStereoAnalysisNames()` |
| ステレオチャンネルを解析 | `masteringStereoAnalyze()` |

関連するマスタリングガイド: [処理チェーン](./glossary/mastering.md)、[トーンと Air](./glossary/mastering/tone-air.md)、[ダイナミクス](./glossary/mastering/dynamics.md)、[ステレオ、リミッター、ラウドネス](./glossary/mastering/stereo-limiter-loudness.md)、[リファレンスマッチ](./glossary/mastering/reference-match.md)。

### 単体のダイナミクス／リペアプロセッサ

名前付きの各ステージは単発の関数としても使え、チェーンを組まずに 1 つのプロセッサだけを実行できます。ダイナミクス系は `DynamicsResult`（処理後の `samples` と、プロセッサの先読みレイテンシをサンプル数で表す `latencySamples`）を、リペア系は `Float32Array` を返します。

```typescript
// オフラインのダイナミクス
function masteringDynamicsCompressor(samples: Float32Array, sampleRate: number, options?: CompressorOptions): DynamicsResult
function masteringDynamicsGate(samples: Float32Array, sampleRate: number, options?: GateOptions): DynamicsResult
function masteringDynamicsTransientShaper(samples: Float32Array, sampleRate: number, options?: TransientShaperOptions): DynamicsResult

// オフラインのリペア
function masteringRepairDeclick(samples: Float32Array, sampleRate: number, options?: DeclickOptions): Float32Array
function masteringRepairDeclip(samples: Float32Array, sampleRate: number, options?: DeclipOptions): Float32Array
function masteringRepairDecrackle(samples: Float32Array, sampleRate: number, options?: DecrackleOptions): Float32Array
function masteringRepairDehum(samples: Float32Array, sampleRate: number, options?: DehumOptions): Float32Array
function masteringRepairDenoiseClassical(samples: Float32Array, sampleRate: number, options?: DenoiseClassicalOptions): Float32Array
function masteringRepairDereverbClassical(samples: Float32Array, sampleRate: number, options?: DereverbClassicalOptions): Float32Array
function masteringRepairTrimSilence(samples: Float32Array, sampleRate: number, options?: TrimSilenceOptions): Float32Array
```

リペア系のステージはオフライン専用で、`StreamingMasteringChain` では拒否されます。これらの単発ヘルパー、または `masteringChain*`／`masterAudio*` の中で実行してください。[ダイナミクス](./glossary/mastering/dynamics.md)と[リペア](./glossary/mastering/repair.md)を参照してください。

### MasteringChainConfig

`masteringChain*` と `StreamingMasteringChain` は下のネスト構造の設定スキーマを使います。
各キーは任意で、指定されたステージだけがチェーン順に有効になります:
**repair → eq → dynamics → saturation → spectral → stereo → maximizer → loudness**。
`masterAudio*` はプリセットから開始し、同じキー名を
`"dynamics.compressor.thresholdDb"` のようなフラットなドット記法の
`overrides`（上書き値）として受け取ります。

`maximizer.truePeakLimiter.releaseMs` はポストリミッターのリリース時間です。省略するとプリセット／設定の既定値 50 ms を保ちます。フラットな上書き値として渡した場合、その値がそのまま適用されます。`maximizer.truePeakLimiter.applyGainAtInputRate` を有効にすると、静的なラウドネスゲインをオーバーサンプリング前の入力サンプルレートで適用します。ホスト間でゲイン段の位置を揃えたい場合に使います。

::: details インターフェース全文（クリックで展開）

```typescript
interface MasteringChainConfig {
  repair?: {
    denoise?: boolean;
    nFft?: number; hopLength?: number; ddAlpha?: number; gainFloor?: number;
    declick?: { threshold?: number; neighborRatio?: number; maxClickSamples?: number;
                lpcOrder?: number; residualRatio?: number; };
    dereverb?: { threshold?: number; attenuation?: number; nFft?: number;
                 hopLength?: number; t60Sec?: number; lateDelayMs?: number;
                 overSubtraction?: number; spectralFloor?: number;
                 wpeEnabled?: boolean; wpeIterations?: number; wpeTaps?: number;
                 wpeStrength?: number; };
  };
  eq?: { tiltDb?: number; pivotHz?: number };
  dynamics?: {
    compressor?: { thresholdDb?: number; ratio?: number; attackMs?: number;
                   releaseMs?: number; kneeDb?: number; makeupGainDb?: number;
                   autoMakeup?: boolean; };
    deesser?: { frequencyHz?: number; thresholdDb?: number; ratio?: number;
                attackMs?: number; releaseMs?: number; rangeDb?: number;
                bandpassQ?: number; };
    transientShaper?: { attackGainDb?: number; sustainGainDb?: number;
                        fastAttackMs?: number; fastReleaseMs?: number;
                        slowAttackMs?: number; slowReleaseMs?: number;
                        sensitivity?: number; maxGainDb?: number;
                        gainSmoothingMs?: number; lookaheadMs?: number; };
    multibandComp?: { lowCutoffHz?: number; highCutoffHz?: number;
                      lowThresholdDb?: number;  lowRatio?: number;
                      lowAttackMs?: number;     lowReleaseMs?: number;
                      midThresholdDb?: number;  midRatio?: number;
                      midAttackMs?: number;     midReleaseMs?: number;
                      highThresholdDb?: number; highRatio?: number;
                      highAttackMs?: number;    highReleaseMs?: number; };
  };
  saturation?: {
    tape?: { driveDb?: number; saturation?: number; hysteresis?: number;
             outputGainDb?: number; speedIps?: number; headBumpDb?: number;
             bias?: number; gapLoss?: number; };
    exciter?: { frequencyHz?: number; driveDb?: number; amount?: number;
                q?: number; evenOddMix?: number; };
  };
  spectral?: {
    airBand?: { amount?: number; shelfFrequencyHz?: number;
                dynamicThresholdDb?: number; dynamicRangeDb?: number; };
  };
  stereo?: {
    imager?: { width?: number; outputGainDb?: number;
               decorrelationAmount?: number; preserveEnergy?: boolean; };
    monoMaker?: { amount?: number };
  };
  maximizer?: {
    truePeakLimiter?: { ceilingDb?: number; lookaheadMs?: number;
                        releaseMs?: number; oversampleFactor?: number;
                        applyGainAtInputRate?: boolean; };
  };
  loudness?: { targetLufs?: number; ceilingDb?: number;
               truePeakOversample?: number; };
}

interface MasteringResult {
  samples: Float32Array;
  sampleRate: number;
  inputLufs: number;
  outputLufs: number;
  appliedGainDb: number;
  latencySamples?: number;
}
interface MasteringChainResult extends MasteringResult { stages: string[] }
interface MasteringStereoResult {
  left: Float32Array;
  right: Float32Array;
  sampleRate: number;
  inputLufs: number;
  outputLufs: number;
  appliedGainDb: number;
  latencySamples: number;
}
// masteringChainStereo / masterAudioStereo（および WithProgress 変種）の
// 戻り値。MasteringStereoResult は masteringProcessStereo の戻り値。
interface MasteringStereoChainResult {
  left: Float32Array;
  right: Float32Array;
  sampleRate: number;
  inputLufs: number;
  outputLufs: number;
  appliedGainDb: number;
  stages: string[];
  latencySamples?: number;
}
```

:::

各ステージの使いどころは用語集の各ページに対応しています:
[リペア](./glossary/mastering/repair.md)、
[トーンと Air](./glossary/mastering/tone-air.md)、
[ダイナミクス](./glossary/mastering/dynamics.md)、
[ステレオ・リミッター・ラウドネス](./glossary/mastering/stereo-limiter-loudness.md)。

## ミキシング API

WASM パッケージから libsonare のミキシングエンジンを使えます。`mixStereo(...)` はステム配列を手早くレンダーする一括処理用の入口です。`Mixer` は、チャンネルストリップ、バス、センド、VCA グループ、オートメーション、ストリップメーター、ゴニオメーターバッファを持つ、シーンベースのミキサーです。

```typescript
import {
  Mixer,
  mixStereo,
  mixingScenePresetJson,
  mixingScenePresetNames,
} from '@libraz/libsonare';

mixingScenePresetNames(); // ['vocalReverbSend', ...]

const offline = mixStereo([vocalL, musicL], [vocalR, musicR], sampleRate, {
  inputTrimDb: [3, 0],
  faderDb: [-3, -12],
  pan: [0, -0.2],
  width: [1, 0.9],
  muted: [false, false],
});

const mixer = Mixer.fromSceneJson(mixingScenePresetJson('vocalReverbSend'), sampleRate, 512);
mixer.sceneWarnings(); // シーン読み込み時の非致命的な警告（どのプロセッサも読まない insert パラメータ＝タイプミス）
const latency = mixer.latencySamples(); // ドライ／ウェット整列用のコンパイル済みグラフ遅延
const block = mixer.processStereo([vocalBlockL, musicBlockL], [vocalBlockR, musicBlockR]);
const meter = mixer.stripMeter(0, 'postFader');

mixer.scheduleFaderAutomation(0, sampleRate * 8, -6, 's-curve');
mixer.schedulePanAutomation(0, sampleRate * 8, -0.25, 'linear');
mixer.scheduleSendAutomation(0, 0, sampleRate * 12, -12, 'hold');

const goniometer = mixer.readGoniometerLatest(0, 256);
const sceneJson = mixer.toSceneJson();
mixer.delete();
```

AudioWorklet のようにレンダーブロックごとのアロケーションを避けたいループでは、`Mixer.createRealtimeBuffer()` と `processStereoInto(...)` を使います。シーンやルーティングの詳細は [ミキシングエンジン](./mixing.md) を参照してください。

## プロジェクト、楽器、ライブ MIDI

このパッケージは、MIDI／クリップのアレンジを音声に変換するための、プロジェクト・シンセシス・ライブ入力のインターフェースも公開しています。ここでは概要のみを示し、各トピックには個別のガイドがあります。

| 目的 | 使う API | ガイド |
|------|----------|--------|
| クリップ＋MIDI アレンジの作成・読み込み・編集 | `Project`（`Project.fromJson`、`toSceneJson`、MIDI イベントヘルパー） | [プロジェクト編集](./project-editing.md) |
| プロジェクトを音声にレンダー | `project.bounceWithSynthInstrument(s)` | [プロジェクトバウンス](./project-bounce.md) |
| 組み込みシンセボイスを選ぶ | `synthPresetNames()`、`synthPresetPatch(name)`、`engine.setSynthInstrument(...)` | [NativeSynth](./native-synth.md) |
| SoundFont で再生 | `project.loadSoundFont(bytes)` / `engine.loadSoundFont(bytes)` | [SoundFont プレイヤー](./soundfont-player.md) |
| ライブエンジンへ MIDI クリップをサンプル精度でスケジュールする | `engine.setMidiClips(...)`、`engine.sampleAtPpq(ppq)` | [リアルタイムエンジン](./realtime-engine.md#midi-クリップスケジューリングと-sampleatppq) |
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

## 型エクスポート索引

WASM パッケージは、関数やクラスに加えて TypeScript の補助型もエクスポートしています。オプション、リアルタイムバッファ、コールバックのペイロードを型付けするときは、アプリ側で再定義せずこれらを使えます。

| 分野 | エクスポートされる型／定数 |
|------|----------------------|
| 環境とエンジン | `EXPECTED_ENGINE_ABI_VERSION`, `EXPECTED_PROJECT_ABI_VERSION`, `EngineCapabilities`, `ProgressCallback` |
| エンジンのレーンミキサー、マーカー、MIDI クリップ | `EngineTrackLane`, `EngineTrackSend`, `EngineBus`, `EngineMarker`, `EngineMidiClipSchedule`, `EngineMidiEvent`, `ExternalMidiEvent`, `MarkerKind`, `ProjectMarker`, `SurroundPan` |
| キー／コード／リズム／音色解析 | `ChordDetectionOptions`, `KeyProfileName`, `RhythmAnalysisResult`, `TimbreAnalysisResult`, `TimbreFrame`, `DynamicsAnalysisResult` |
| スペクトル／ピッチ／特徴量変換 | `MelPowerResult`, `StftPowerResult`, `PitchCorrectOptions`, `SpectralRegionOp`, `SpectralEditOptions`, `TempogramMode` |
| ページ式クリップストリーミング | `ClipPageStreamerEngine`, `ClipPageStreamerOptions`, `ClipPageStreamSource`, `OpfsClipStream`, `OpfsClipStreamOptions`, `OpfsClipPageProviderOptions` |
| マスタリング | `MasteringProcessorParams`, `MasteringProcessorCatalogEntry`, `MasteringInsertParamInfo`, `MasteringChannelPolicy`, `MasteringStereoChainResult` |
| ストリーミングリチューン | `StreamingRetuneConfig` |
| ストリーミング EQ | `StreamingEqualizerConfig`, `EqBandType`, `EqBandPhase`, `EqCoeffMode`, `EqMatchOptions`, `EqStereoPlacement` |
| リアルタイム音声 | `VoicePresetId`, `RealtimeVoiceChangerConfigInput`, `RealtimeVoiceChangerPodConfig`, `RealtimeVoiceChangerMonoBuffer`, `RealtimeVoiceChangerInterleavedBuffer`, `RealtimeVoiceChangerPlanarBuffer` |
| ミキシング／Worklet 用リアルタイムバッファ | `MixerRealtimeBuffer`, `SonareScopeRingBuffer`, `SonareScopeRingReadResult`, `SonareWorkletScopeSnapshot` |

## パフォーマンスサマリー

| API | 負荷 | 備考 |
|-----|------|-------|
| `StreamAnalyzer` | <Badge type="tip" text="リアルタイム" /> | チャンクごとの処理、〜2ms/フレーム、更新される BPM/キー/コード推定 |
| `Mixer` | <Badge type="tip" text="リアルタイム" /> | オートメーションとメーターを持つシーンベースのブロック処理 |
| `analyze` / `analyzeWithProgress` | <Badge type="warning" text="高負荷" /> | 総合解析パイプライン |
| `hpss` / `harmonic` / `percussive` | <Badge type="warning" text="高負荷" /> | STFT + メディアンフィルタ |
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
