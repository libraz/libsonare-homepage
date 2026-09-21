---
title: JavaScript/TypeScript オーディオとストリーミング API
description: libsonare JavaScript/TypeScript パッケージの Audio クラス、オフラインメータリング、逐次処理のストリーミング API のリファレンスです。
---

# JavaScript/TypeScript オーディオとストリーミング API

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

## メータリング

デコード済みバッファから、レベル、ダイナミクス、ステレオイメージの統計値を返す単体メーターです。マスタリングチェーンやストリーミングエンジンとは独立しています。

`Float32Array`、またはステレオの左右ペアを渡すと、値またはレポートが返ります。

各関数は、`validate` フラグ（既定 `true`）を持つ `options` を任意で受け取ります。ホットパスでは `validate: false` を指定して、JavaScript 側の O(n) の NaN/Inf 事前スキャンを省略できます。ただし非有限のサンプルをコアへ通すための手段ではありません。ネイティブ層が必ず再検証するため、NaN/Inf を含むバッファは変わらず例外になります（該当インデックスを示さない、汎用のネイティブメッセージになるだけです）。空バッファのチェックは常に実行されます。

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
// サンプル間ピーク（ISP、いわゆる True Peak）を dBFS で返す。oversampleFactor は 1..16 の 2 の冪（0 / 省略で 4）
function meteringTruePeakDb(samples: Float32Array, sampleRate?: number, oversampleFactor?: number, options?: ValidateOptions): number
// thresholdDb 未満のフレームの割合、範囲 [0, 1]。thresholdDb 既定 -45、
// frameLength 既定 1024、hopLength 既定 256。
function meteringSilenceRatio(
  samples: Float32Array,
  sampleRate?: number,
  thresholdDb?: number,
  frameLength?: number,
  hopLength?: number,
  options?: ValidateOptions
): number
```

### ステレオのレベルメーター

単一チャンネルのメーターが必要とする `0.5 * (left + right)` のダウンミックスではなく、左右 2 チャンネルをそのまま読むレベルメーターです。上のメーターと違い、**リクエストオブジェクト専用です**。位置引数のオーバーロードはなく、位置引数で呼ぶと例外になります。

```typescript
// Crest factor over a channel pair, dB. Peak is taken across both channels
// and RMS is measured over the two together.
function meteringCrestFactorDbStereo(request: MeteringStereoRequest): number

interface MeteringStereoRequest extends ValidateOptions {
  left: Float32Array;
  right: Float32Array;
  sampleRate?: number;
}
```

```typescript
const crestDb = meteringCrestFactorDbStereo({ left, right, sampleRate });
```

左右が逆相になりうる素材では、こちらを使ってください。逆相のペアはダウンミックスで打ち消し合い、RMS が小さく出るぶんクレストファクターが過大に出ます。完全な逆相ペアでの実測値は、ステレオ版が **11.64 dB**、ダウンミックス経由が **0.00 dB** でした。

`meteringStereoCorrelation` と `meteringStereoWidth` も、位置引数形式に加えて同じ `MeteringStereoRequest` を受け付けます。

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
// チャンネル間の非中心化相関（コサイン類似度、−1..1）
function meteringStereoCorrelation(left: Float32Array, right: Float32Array, sampleRate?: number, options?: ValidateOptions): number
// ミッド/サイドのステレオ幅: 0 = モノラル、約 1 = 広いステレオ。上限なし
// （完全な逆相などでミッド信号が無音なら Infinity）
function meteringStereoWidth(left: Float32Array, right: Float32Array, sampleRate?: number, options?: ValidateOptions): number
// Mid/side point series. One point per sample by default; pass maxPoints for a
// display-sized, deterministically decimated point set (0 / >= length = one point per sample).
function meteringVectorscope(left: Float32Array, right: Float32Array, sampleRate?: number, options?: ScopeOptions): VectorscopeReport
// Phase-scope point series plus summary stats. maxPoints decimates the point cloud the same way;
// the summary stats are always computed over the full-resolution signal.
function meteringPhaseScope(left: Float32Array, right: Float32Array, sampleRate?: number, options?: ScopeOptions): PhaseScopeReport

interface ScopeOptions extends ValidateOptions {
  maxPoints?: number;   // 0 / omit / >= length = one point per input sample
}

// Deprecated aliases: pass maxPoints to meteringVectorscope / meteringPhaseScope instead.
// They simply delegate and are kept for backward compatibility.
function meteringVectorscopeDecimated(left: Float32Array, right: Float32Array, sampleRate?: number, maxPoints?: number, options?: ValidateOptions): VectorscopeReport
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

`meteringStereoWidth` は正規化された百分率ではなく、サイド／ミッドのエネルギー比です。`0` は完全なモノラル、約 `1` は広いステレオ、より大きな有限値はデコリレーションまたは逆相成分が増えていることを表します。`2` にクランプしてはいけません。ミッドチャンネルが無音なら、意図的に `Infinity` を返します。

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
  maxPendingFrames?: number;   // デフォルト: 4096。超過時は新たに生成した出力フレームを破棄
  maxProgressionEntries?: number; // デフォルト: 4096。コード／小節進行をそれぞれ保持する上限で、超過時は最古を破棄
  keyUpdateIntervalSec?: number;  // デフォルト: 5
  bpmUpdateIntervalSec?: number;  // デフォルト: 10
  window?: number;             // 0=Hann（既定）, 1=Hamming, 2=Blackman, 3=Rectangular
  outputFormat?: 0;            // レガシー。省略するか Float32（0）を使う
}
```

`outputFormat` はソース互換性のためだけに残っており、指定する場合は `0` でなければなりません。量子化読み出しは `readFramesU8` または `readFramesI16` を明示して選びます。内部解析は常に float です。[リアルタイムとストリーミング](./realtime-streaming.md#フレームの読み出しと出力フォーマット) を参照してください。

旧来の `computeMagnitude` フラグはサポートされなくなり、指定するとコンストラクタが例外を投げます。マグニチュードのフレームは StreamAnalyzer の読み出し経路では公開されないため、このフラグは削除されました。マグニチュードのデータが必要な場合は、オフラインで `stft`／`stftDb` を使うか、スペクトラムメータリングのヘルパーを使ってください。

`streamAnalyzerConfigDefaults()` は、上記の各フィールドについてライブラリの既定値を保持した、すべての項目が入った `StreamConfigDefaults` オブジェクト（`Required<StreamConfig>`）を返します。設定 UI の初期値として使ったり、ユーザー指定の設定との差分計算に使えます。`StreamAnalyzer` 自身も、省略されたフィールドにはこの同じ既定値を適用します。

### StreamAnalyzer クラス

```typescript
class StreamAnalyzer {
  constructor(config: StreamConfig);

  // 音声チャンクを処理（内部オフセット追跡）
  process(samples: Float32Array): void;

  // 明示的で連続したサンプルオフセットで処理。ギャップ、シーク、または process() からの切り替え前には reset() が必要
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
  nChroma: number;             // クロマがあれば 12、なければ 0
  featureFlags: number;        // MEL=1, CHROMA=2, ONSET=4, SPECTRAL=8
  timestamps: Float32Array;      // [nFrames]
  mel: Float32Array;             // [nFrames * nMels]。MEL がなければ空
  chroma: Float32Array;          // [nFrames * nChroma]。CHROMA がなければ空
  onsetStrength: Float32Array;   // [nFrames]。ONSET がなければ空
  rmsEnergy: Float32Array;       // [nFrames]
  spectralCentroid: Float32Array;// [nFrames]。SPECTRAL がなければ空
  spectralFlatness: Float32Array;// [nFrames]。SPECTRAL がなければ空
  chordRoot: Int32Array;         // [nFrames]。CHROMA がなければ空
  chordQuality: Int32Array;      // [nFrames]。CHROMA がなければ空
  chordConfidence: Float32Array; // [nFrames]。CHROMA がなければ空
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
  droppedOutputFrames: number; // 上限で新たに生成されたフレームを破棄した数
  droppedChordProgressionEntries: number; // 上限到達時に破棄された最古のコード進行エントリ数
  droppedBarProgressionEntries: number;   // 上限到達時に破棄された最古の小節進行エントリ数
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
