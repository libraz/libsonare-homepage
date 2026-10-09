---
title: JavaScript/TypeScript ストリーミング／リアルタイム API
description: libsonare JavaScript/TypeScript パッケージのブロック単位 EQ、ピッチリチューン、リアルタイムボイスチェンジャー、ストリーミングマスタリングチェーン、逐次処理の StreamAnalyzer のリファレンスです。
---

# JavaScript/TypeScript ストリーミング／リアルタイム API

libsonare JavaScript/TypeScript パッケージのブロック単位プロセッサ（`StreamingEqualizer`、`StreamingRetune`、`RealtimeVoiceChanger` とその一括適用版 `voiceChangeRealtime(...)`、`StreamingMasteringChain`）と、逐次処理の `StreamAnalyzer` です。オフラインチェーン、プリセット、単発プロセッサについては [マスタリング API](./js-api-mastering.md) を参照してください。

## StreamingEqualizer

`StreamingEqualizer` は、ブロック単位で動かす、リアルタイムスレッドで安全に使える EQ オブジェクトです。

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

1 次のロー／ハイシェルフを使うには、バンドの `slopeDbOct` を `6` にします。その場合、`frequencyHz` はシェルフのゲイン変化が dB 値で半分になる周波数で、`q` は効きません。`slopeDbOct` を省略すると、上の例で使っている通常のシェルフになります。

ファイル単位の EQ / フィルタ処理に対応するソースビルド C++ CLI 例:

```bash [C++ CLI]
sonare eq track.wav --type 2 --frequency-hz 8000 --gain-db 4 --q 0.7 -o eq.wav
sonare filter track.wav --type hp --cutoff 80 -o filtered.wav
```

## StreamingRetune

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

## RealtimeVoiceChanger

`RealtimeVoiceChanger` はプリセットで動かすライブ音声チェーン（ハイパス、ゲート、リチューン、フォルマント、EQ、コンプレッサー、ディエッサー、リバーブ、リミッターの各段）で、音声ブロックをまたいで状態を保持します。モニタリング、AudioWorklet 形式の処理、または `voiceChange(...)` では単純すぎるチャンク単位の音声処理で使います。標準プリセット ID は `realtimeVoiceChangerPresetNames()` で取得し、プリセット JSON は `realtimeVoiceChangerPresetJson(...)` で取得、`validateRealtimeVoiceChangerPresetJson(...)` で検証できます（スキーマバージョン `1`）。`RealtimeVoiceChangerConfigInput` は厳密な型で、6 種類の `VoicePresetId` 文字列、または `dsp` と `macros` のどちらか一方だけを持つプリセットオブジェクトを指定します。

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

## `voiceChangeRealtime(samples, sampleRate?, preset?, options?)`

`voiceChangeRealtime(...)` は `RealtimeVoiceChanger` をバッファ全体に対してオフラインで一括適用する便利関数です。内部で changer を構築・準備し、ブロック単位のレンダリングループを実行したうえで破棄します（Python の `voice_change_realtime` や Node の同等関数と同じ考え方です）。そのため、呼び出し側が状態を持つオブジェクトを管理する必要はありません。

```typescript
function voiceChangeRealtime(
  samples: Float32Array,
  sampleRate?: number, // デフォルト 48000
  preset?: RealtimeVoiceChangerConfigInput,
  options?: {
    channels?: 1 | 2;   // デフォルト 1（モノラル）。2 = インターリーブステレオ (L0,R0,L1,R1,...)
    /** @deprecated Ignored — the shared C-ABI renderer uses a fixed block size. */
    blockSize?: number;
  },
): Float32Array  // 入力と同じレイアウト・長さ
```

バッファ全体が手元にある場合はこれを使います。ブロック単位のライブ処理を手動で行う場合は [`RealtimeVoiceChanger`](#realtimevoicechanger) を、フルのプリセットチェーンが不要で一度きりのピッチ／フォルマント変更だけが必要な場合は `voiceChange(...)` を使ってください。

## StreamingMasteringChain

リアルタイム処理やメモリ制約のあるユースケース（`AudioWorklet` やストリーム
入力からのブロック単位処理など）向けに、WASM モジュールは
`StreamingMasteringChain` を公開しています。受け取るのは `StreamingMasteringChainConfig` で、これは `masteringChain()` の `MasteringChainConfig` に、ストリーミング専用の任意フィールドを 2 つ追加したものです。

- `loudnessStaticGainDb` — 事前計算した静的ラウドネスゲイン（dB、例: `targetLufs - measuredIntegratedLufs`）。ブロックごとに適用され、`loudness` ステージを有効にしたプリセットのストリーミングプレビューがオフラインレンダリングと一致するようにします。
- `loudnessStaticGainPeakDb` — オフラインで計測した音源の True Peak（dBFS）。指定すると静的ゲインが `loudness.ceilingDb - loudnessStaticGainPeakDb` にクランプされ、ストリーミングのリミッターへオフラインチェーンより大きい入力が入らないようにします。

それ以外は、固定ブロックサイズで内部状態を準備したうえで、入力ブロックに対してチェーンを順番に適用します。

```typescript
import { init, StreamingMasteringChain } from '@libraz/libsonare';
await init();

const chain = new StreamingMasteringChain({
  eq: { tilt: { tiltDb: 0.5 } },
  dynamics: { compressor: { thresholdDb: -20 } },
  maximizer: { truePeakLimiter: { ceilingDb: -1, oversampleFactor: 4 } },
});

chain.prepare(48000, /*maxBlockSize=*/512, /*numChannels=*/2);

// Use the path that matches the prepared channel count: processMono() /
// flushMono() after prepare(..., 1), processStereo() / flushStereo() after
// prepare(..., 2). Mixing them throws a num_channels mismatch.
const { left, right } = chain.processStereo(leftBlock, rightBlock);
chain.setParameter('eq.tilt.tiltDb', 1.0);

console.log(chain.stageNames());      // ['eq.tilt', 'dynamics.compressor', ...]
console.log(chain.latencySamples());  // 有効ステージの合計レイテンシ

// 入力の最終ブロックのあと、チェーンの遅延と有限のテールを吐き出す
let tail: { left: Float32Array; right: Float32Array };
while ((tail = chain.flushStereo()).left.length > 0) {
  write(tail.left, tail.right);
}

chain.reset();   // prepare し直さずに状態だけクリア
chain.delete();  // WASM ハンドルを解放（使い終わったら呼ぶ）
```

準備済みのチェーンでは `setParameter(key, value)` でリアルタイム安全なパラメータを 1 つ更新できます。書き込みはブロック境界で直列化され、チェーンはプロセッサのインスタンス、音声履歴、レイテンシを保持します。キーは `eq.tilt.tiltDb` のような完全なドット区切り形式を使います。利用できるのは有効なステージに属するリアルタイム安全なキーだけです。構造を変えるキー、無効なステージのキー、未知のキーは拒否されます。`setParameter()` は `process*()`、`flush*()`、`reset()`、`prepare()` と直列化して呼び出してください。パラメータの変更は境界で反映され、自動的にはスムージングされません。

`flushMono()` / `flushStereo()` は、入力がもうない状態で遅延分の音声と有限のプロセッサ
テールを吐き出します。空の結果が返るまで呼び続けてください。フラッシュしないと、
ストリーミングチェーンで作ったバウンスは末尾の `latencySamples()` サンプルと、
リバーブやリミッターのテールを失います。連結したストリームの先頭 `latencySamples()`
サンプルはチェーンの遅延なので、時間を揃えるには捨ててください。

`numChannels === 1` のときはステレオ専用ステージはスキップされます。チェーン設定のリペアステージのうち、ストリーミングチェーンで動くのは `repair.denoise` だけで、それも因果的なノイズ推定器（`noiseEstimator` が 1 = MCRA、2 = IMCRA、3 = 音声存在確率）を選んだときに限ります。分位点推定器（0）は信号全体のフレームを順位付けするため、コンストラクタが拒否します。`repair.declick`／`repair.dereverb`／`repair.declip`／`repair.decrackle`／`repair.dehum` はここで有効にすると例外を投げます。`masteringChain*` / `masterAudio*`、単発の `masteringRepair*` ヘルパー、またはそのステージにあれば[リアルタイムインサート](./audio-repair.md#リアルタイムインサート)で実行してください。`loudness` ステージも、ストリーミングチェーンが信号全体の積分 LUFS を計測できないため、`loudnessStaticGainDb`（任意で `loudnessStaticGainPeakDb` も）を指定しない限り例外を投げます。同じチェーンで複数曲を順に処理する場合は `reset()`、使い終わったら `delete()` を呼んでハンドルを解放してください。

## ストリーミング API

ストリーミング API を使うと、リアルタイムの音声解析とビジュアライゼーションができます。バッチ解析とは異なり、ストリーミングは音声をチャンクごとに処理し、低レイテンシを実現します。

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
  nFft?: number;               // デフォルト: 2048（44100 Hz でのサンプル数）
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

`nFft` は 44100 Hz でのサンプル数で書いた「時間の長さ」です。これより低い `sampleRate` のストリームでは、窓が解析レートに合わせて縮められます（`hopLength` より短くはなりません）。`hopLength` は入力サンプル単位のままです。出力されるビン数は `nFft / 2 + 1` ではなく、窓をゼロ埋めした FFT 長に従います。

`outputFormat` はソース互換性のためだけに残っており、指定する場合は `0` でなければなりません。量子化読み出しは `readFramesU8` または `readFramesI16` を明示して選びます。内部解析は常に float です。[リアルタイムとストリーミング](./realtime-streaming.md#フレームの読み出しと出力フォーマット) を参照してください。

`computeMagnitude` フラグはなく、指定するとコンストラクタが例外を投げます。マグニチュードのフレームは StreamAnalyzer の読み出し経路では公開されないためです。マグニチュードのデータが必要な場合は、オフラインで `stft`／`stftDb` を使うか、スペクトラムメータリングのヘルパーを使ってください。

`streamAnalyzerConfigDefaults()` は、上記の各フィールドについてライブラリの既定値を保持した、すべての項目が入った `StreamConfigDefaults` オブジェクト（`Required<StreamConfig>`）を返します。設定 UI の既定値として使ったり、ユーザー指定の設定との差分計算に使えます。`StreamAnalyzer` 自身も、省略されたフィールドにはこの同じ既定値を適用します。

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
  name: string;         // コード記号（例: "C"、"C#m"、"N.C."）
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
  name: string;         // バッチ解析と同じ綴りのコード記号
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
  keyName: string | null;       // 例: "A minor"。キー未推定の間は null
  keyShortName: string | null;  // 例: "Am"。キー未推定の間は null

  // コード推定（現在）
  chordRoot: PitchClass;
  chordQuality: ChordQuality;
  chordName: string;        // 現在のコード記号。未検出の間は "N.C."
  chordConfidence: number;  // 0-1
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

キーはストリーム自身の 186 ms のクロマから推定するため、フレーム出力より最大で約 4 分の 1 秒余計に遅れます。フレームごとの `chordConfidence` や各 `ChordChange`／`BarChord` の信頼度を含め、すべての信頼度は 0-1 の範囲に収まります。`keyName`、`keyShortName`、`chordName` はバッチ解析と同じ綴りで推定結果を返すので、UI は `key`／`chordRoot` を自前で変換せずに表示できます。

### 使い方、AudioWorklet 統合、タイミング

`StreamAnalyzer` を実際に動かすレシピ（`AudioWorklet` からブロックを流し込む、フレームを読み出す、`emitEveryNFrames` でスロットリングする、`FrameBuffer` のストリーム時間タイムスタンプを `AudioContext.currentTime` に対応付ける）は、AudioWorklet ハンドシェイクとデータフロー図とともに [リアルタイムとストリーミング](./realtime-streaming.md) にあります。

::: tip WASM オブジェクトの解放
`StreamAnalyzer`、`Mixer`、`StreamingEqualizer`、`StreamingMasteringChain` は WASM ヒープメモリを指す **embind** ハンドルで、JavaScript のガベージコレクタは回収できません。使い終わったら `delete()` を呼んでください（`StreamAnalyzer` は `dispose()` も受け付け、一部のクラスは `destroy()` を alias として公開します）。`analyze()` のような通常の関数は普通の JS 値を返すので後始末は不要です。Node ネイティブの解放方法は異なるため、[ネイティブバインディング](./native-bindings.md) を参照してください。
:::

