---
title: JavaScript/TypeScript librosa 互換ヘルパー
description: libsonare JavaScript/TypeScript パッケージのプリエンファシス、テスト信号生成、スペクトル再構成、構造解析、セグメンテーション、テンポグラムなど librosa の引数対応ポートのリファレンスです。
---

# JavaScript/TypeScript librosa 互換ヘルパー

libsonare JavaScript/TypeScript パッケージの librosa 互換ヘルパー関数です。BPM・キー・ビート検出、総合解析の `analyze()`、単位変換については [解析 API](./js-api-analysis.md) を参照してください。

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

### テスト信号の生成

フィクスチャ、キャリブレーション、クリックトラック向けの決定的な信号です。アセットファイルは要りません。

```typescript
function tone(request?: ToneRequest): Float32Array
function chirp(request?: ChirpRequest): Float32Array
function clicks(request: ClicksRequest): Float32Array
```

### スペクトルからの再構成とピッチ候補

```typescript
function griffinLim(request: GriffinLimRequest): Float32Array
function reassignedSpectrogram(request: ReassignedSpectrogramRequest): ReassignedSpectrogramResult
function piptrack(request: PiptrackRequest): PiptrackResult
function melDelta(request: MelDeltaRequest): Float32Array
function spectralFlux(request: SpectralFrameRequest & { lag?: number }): Float32Array
function onsetBacktrack(request: OnsetBacktrackRequest): Int32Array
```

`griffinLim` は STFT の振幅行列から音声を再構成します。`melToAudio` と `mfccToAudio` は
その mel 領域ラッパーです。`onsetBacktrack` は検出したオンセットフレームを直前のエネルギー
極小点まで戻します。オンセット位置で音を切り出す前に通しておきたい処理です。

`spectralBandwidth` は Minkowski 指数 `p` を指定できます（位置引数では 5 番目、
リクエストオブジェクトでは `p`）。`p = 2` 固定ではありません。

### 構造と自己類似度

セグメンテーション系は、構造解析の土台になる行列を作ります。

```typescript
function segmentCrossSimilarity(request: SegmentCrossSimilarityRequest): SegmentMatrix
function segmentRecurrenceMatrix(request: SegmentRecurrenceMatrixRequest): SegmentMatrix
function segmentRecurrenceToLag(request: SegmentRecurrenceToLagRequest): SegmentMatrix
function segmentLagToRecurrence(request: SegmentLagToRecurrenceRequest): SegmentMatrix
function segmentPathEnhance(request: SegmentPathEnhanceRequest): SegmentMatrix
function segmentSubsegment(request: SegmentSubsegmentRequest): Int32Array
function segmentAgglomerative(request: SegmentAgglomerativeRequest): Int32Array
```

「セクションはどこか」への既製の答えは `analyzeSections(...)` です。自己類似度プロットを
描きたい、あるいは強調済みの recurrence 行列に自前の境界検出をかけたい、といった理由で
中間行列そのものが欲しいときにこちらを使います。

### ノートセグメンテーション

モノフォニックの F0 トラックを、安定したノート区間に切り分けます。すでに手元にある
トラック（`pitchYin` / `pitchPyin`、あるいは自前のトラッカーの出力）を、それを生成した
フレームレートと一緒に渡します。

```typescript
interface NoteSegmentsRequest {
  f0Hz: Float32Array;
  voicedProb: Float32Array;
  /** 渡したトラックの 1 秒あたりフレーム数 */
  frameRate: number;
  segmentationThresholdCents?: number;  // 既定 50
  minNoteMs?: number;                   // 既定 30
  referenceHz?: number;                 // 既定 440（A4）
  /** `voicedProb` に適用する有声しきい値 */
  voicedThreshold?: number;             // 既定 0.5
}

function noteSegments(request: NoteSegmentsRequest): Array<{
  frameStart: number;    // フレーム境界は半開区間 [frameStart, frameEnd)
  frameEnd: number;
  startSeconds: number;
  endSeconds: number;
  medianCents: number;
}>
```

`f0Hz` と `voicedProb` は長さが等しく、0 でない必要があります。0 Hz のフレームと、
`voicedThreshold`（既定 `0.5`）を下回る値は無声として扱われ、そこでノートが切れます。

::: danger ここに `pitchPyin` の `voicedProb` を渡してはいけない
フィールド名に反して、ここは pYIN の `voicedProb` を渡す場所では**ありません**。あの値は
フレームの有声観測**量**であり、フレーム長が一定なら F0 とともに上昇します。つまり確信度では
なく音高の高さを表しています。これを固定しきい値に通すと、低音域の素材では**セグメントが
1 つも返らなくなります**。おおよそ C5 より低い定常音は `0.5` に達しないため、全フレームが無声と
判定され、理由を示すエラーもないまま空配列が返ります。

代わりに**フラグ**を渡してください。`PitchResult.voicedFlag` を `0` / `1` に変換したものです。
どうしても確率のような系列を使う場合は、扱う音域に合わせて `voicedThreshold` を下げてください。
:::

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

function splitSilenceCommon(request: {
  signals: Float32Array[];
  topDb?: number;         // 既定 60
  frameLength?: number;   // 既定 2048
  hopLength?: number;     // 既定 512
}): Int32Array            // 同じフラットなペア配列
```

`trimSilence`（`librosa.effects.trim`）はフレーム RMS とピーク RMS からの `topDb` 差で
無音を判定し、トリム後の音声と元音源上の `[startSample, endSample)` 範囲を返します。
単純なしきい値トリムの `trim(samples, sampleRate, thresholdDb)` とは別物です。
`splitSilence`（`librosa.effects.split`）は非無音区間をサンプル単位の開始／終了ペアで返します。

`splitSilenceCommon` は、**同じパートの複数テイクに対して**同じ問いに一度で答えます。
テイク同士で共通しているのは音ではなく無音です。あるテイクがブレスを入れる箇所で別のテイクは
伸ばしている、ということが起きるため、1 本のテイクだけから決めた切れ目は、他のテイクではフレーズの
途中に落ちます。この関数は各信号に対する `splitSilence` の結果の和集合を、接している区間を
まとめたうえで返します。したがって返ってきた区間と区間の**あいだ**は、すべてのテイクで同時に
無音であり、そこに置いた切れ目はどのテイクでも安全です。

```typescript
const cuts = splitSilenceCommon({ signals: [takeA, takeB, takeC], topDb: 55 });
```

テイクの長さが揃っていなくてもパディングは不要です。最長の信号より短いものは、自身の終端より先へは
何も寄与しません。信号を 1 本だけ渡した場合は `splitSilence` とまったく同じ結果になります。

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

`peakPick` は `librosa.util.peak_pick`（オンセット包絡線などの 1 次元信号に対する後処理）、
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

