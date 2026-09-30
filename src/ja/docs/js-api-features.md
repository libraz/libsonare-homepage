---
title: JavaScript/TypeScript 特徴抽出 API
description: libsonare JavaScript/TypeScript パッケージの STFT、mel/MFCC、クロマ、スペクトル特徴、ピッチ検出、CQT/VQT/分解系のリファレンスです。
---

# JavaScript/TypeScript 特徴抽出 API

libsonare JavaScript/TypeScript パッケージの特徴抽出関数です。BPM・キー・ビート検出、総合解析の `analyze()`、単位変換については [解析 API](./js-api-analysis.md) を参照してください。

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
  sampleRate?: number, // デフォルト: 22050
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
function spectralCentroid(
  samples: Float32Array,
  sampleRate?: number,  // 既定: 22050
  nFft?: number,
  hopLength?: number
): Float32Array

// スペクトル帯域幅 (Hz)
function spectralBandwidth(
  samples: Float32Array,
  sampleRate?: number,  // 既定: 22050
  nFft?: number,
  hopLength?: number,
  p?: number             // ミンコフスキー指数、既定: 2
): Float32Array

// スペクトルロールオフ (Hz)
function spectralRolloff(
  samples: Float32Array,
  sampleRate?: number,  // 既定: 22050
  nFft?: number,
  hopLength?: number,
  rollPercent?: number  // 既定: 0.85
): Float32Array

// スペクトル平坦度 (0=調性的, 1=ノイズ的)
function spectralFlatness(
  samples: Float32Array,
  sampleRate?: number,  // 既定: 22050
  nFft?: number,
  hopLength?: number
): Float32Array

// スペクトルコントラスト行列、形状は (nBands + 1) x nFrames
function spectralContrast(
  samples: Float32Array,
  sampleRate?: number,
  nFft?: number,
  hopLength?: number,
  nBands?: number,
  fmin?: number,
  quantile?: number
): Matrix2dResult

// フレームごとの多項式スペクトル係数、形状は (order + 1) x nFrames
function polyFeatures(
  samples: Float32Array,
  sampleRate?: number,
  nFft?: number,
  hopLength?: number,
  order?: number
): Matrix2dResult

// ゼロ交差率
function zeroCrossingRate(
  samples: Float32Array,
  sampleRate?: number,  // 既定: 22050
  frameLength?: number,
  hopLength?: number
): Float32Array

// 波形がゼロを横切るサンプル位置
function zeroCrossings(
  samples: Float32Array,
  threshold?: number,
  refMagnitude?: boolean,
  pad?: boolean,
  zeroPos?: boolean
): Int32Array

// RMSエネルギー
function rmsEnergy(
  samples: Float32Array,
  sampleRate?: number,  // 既定: 22050
  frameLength?: number,
  hopLength?: number
): Float32Array
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
| 分解とリミックス | `decompose(...)`, `decomposeWithInit(...)`, `decomposeStems(...)`, `decomposeStemsLinked(...)`, `nnFilter(...)`, `remix(...)`, `remixAlignedIntervals(...)`, `phaseVocoder(...)`, `hpssWithResidual(...)` | NMF 分解、初期化方式を選べる NMF、モノラル／連動マルチチャンネルのステム出力、近傍フィルタ、区間リミックス、チャンネル間で一貫したカット位置、時間スケーリング、残差付き HPSS。 |
| 特徴量や音声の近似復元 | `melToStft`, `melToAudio`, `mfccToMel`, `mfccToAudio`, `cqtToAudio`, `vqtToAudio` | 可視化、デバッグ、特徴量の往復確認に使います。CQT/VQT の入力は振幅行列です。 |
| 配信向けラウドネス測定 | `lufs`, `lufsInterleaved`, `momentaryLufs`, `shortTermLufs`, `ebur128LoudnessRange` | ITU-R BS.1770 / EBU R128 系のラウドネス値。マルチチャンネル Integrated LUFS と LRA（ラウドネスレンジ。曲全体でラウドネスがどれだけ変動するか）も含みます。 |

```typescript
const cqtResult = cqt(samples, sampleRate, 512, 32.7, 84, 12);
const vqtResult = vqt(samples, sampleRate, 512, 32.7, 84, 12, -1);
const pseudo = pseudoCqt(samples, sampleRate);
const hybrid = hybridCqt(samples, sampleRate);
const cqtChroma = chromaCqt(samples, sampleRate);
const nnls = nnlsChroma(samples, sampleRate, { hopLength: 512 });
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
const stretched = phaseVocoder(samples, sampleRate, 1.5);
const hpssResidual = hpssWithResidual(samples, sampleRate);
const multichannel = lufsInterleaved(interleavedStereo, 2, sampleRate);
const lra = ebur128LoudnessRange(samples, sampleRate);
const reconstructed = melToAudio(mel.power, mel.nMels, mel.nFrames, sampleRate);
const cqtPreview = cqtToAudio(cqtResult.magnitude, cqtResult.nBins, cqtResult.nFrames, sampleRate, 512, 32.7, 12);
const vqtPreview = vqtToAudio(vqtResult.magnitude, vqtResult.nBins, vqtResult.nFrames, sampleRate, 512, 32.7, 12, 0, 32);
```

`chromaCqt(samples, sampleRate?, hopLength?, nChroma?)` は `librosa.feature.chroma_cqt` に直接対応します（対数周波数／Constant-Q でのピッチ畳み込み）。一方 `nnlsChroma(samples, sampleRate?, options?)` は別物の音符活性化クロマで、NNLS（非負最小二乗法）で倍音の漏れを抑えます。コードや低音域の処理ではこちらの方がすっきりする場合が多いです。`options.hopLength` の既定値は `512` です。

ソースビルド C++ CLI で近いコマンド:

```bash [C++ CLI]
sonare cqt song.wav
sonare vqt song.wav
sonare nnls-chroma song.wav
sonare lufs song.wav --json
sonare mel-to-audio song.wav -o mel-preview.wav
```

復元の制約とパラメータは [逆変換特徴量](./inverse-features.md)、librosa 互換の詳細は [librosa 互換性](./librosa-compatibility.md) を参照してください。

### `decomposeStems(request)` <Badge type="warning" text="高負荷" />

音源を NMF で `nComponents` 個の**名前のない**成分に分解し、各成分を因子行列ではなく**オーディオ**として返します。

```typescript
function decomposeStems(request: DecomposeStemsRequest): DecomposeStemsResult

interface DecomposeStemsRequest {
  samples: Float32Array;
  sampleRate: number;
  nComponents?: number;   // 既定 4
  nFft?: number;          // 既定 2048
  hopLength?: number;     // 既定 512
  nIter?: number;         // 既定 100
  beta?: number;          // 既定 2（Frobenius）。1 で Kullback-Leibler
  init?: 'random' | 'nndsvd';  // 既定 'random'
  maskPower?: number;     // 既定 1。1 以上であること
}

interface DecomposeStemsResult {
  components: Float32Array[];  // 成分ごとの信号。各要素は入力と同じ長さ
  w: Float32Array;             // [nBins x nComponents] の行優先行列
  h: Float32Array;             // [nComponents x nFrames] の行優先行列
  sampleRate: number;
}
```

ステムが欲しいときに使うのはこちらで、`decompose` ではありません。`decompose` は**振幅**
スペクトログラムを分解して `w` と `h` を返します。振幅には位相が含まれないため、因子をオーディオ
へ戻すには位相推定器が必要で、出てくるのは録音の一部ではなく再構成です。`decomposeStems` は
同じ分解を行いますが、それを使って成分ごとの**ソフトマスク**を作り、**元の複素**スペクトログラム
に適用します。したがって各成分は音源自身の位相を保ちます。モデルにエネルギーがある領域では
マスクの総和が 1 になり、逆 STFT は線形であるため、成分は**加算すると入力に戻ります**。

`maskPower` はマスクの分離の強さを決めます。`1` は振幅比、`2` は Wiener 型のパワー比で、後者は
より強く分離する代わりに、倍音が重なる箇所でアーティファクトが増えます。中間の値も使えますが、
`1` 未満は使えません。

受け取るのはリクエストオブジェクトのみで、位置引数形式はありません。`nComponents` はここでは
省略可能で既定値は `4` です（`decompose` では必須）。

**これは HPSS ではありません。** 成分にラベルは付きません。`components[1]` は分解がたまたま
行き着いた反復パターンであって、声やキックがどの番号に入るかは `init`、`nIter`、素材によって
変わります。何が入っているかは聴いて確かめてください。[オーディオエフェクト](./js-api-effects.md)
の `hpss` と `hpssWithResidual` は別の問いに答えるもので、メディアンフィルタによって
**ラベルの付いた**倍音成分と打撃成分（および残差）のちょうど 2 つに分けます。「持続音か打撃音か」
を知りたいときは HPSS、「この録音がどんな反復パターンでできているか」を知りたいときは
`decomposeStems` です。

::: warning NNDSVD の初期化は倍精度で計算される
`init: 'nndsvd'` を指定した場合、SVD によるウォームスタートは倍精度で計算されます。これが
初期値の**再現性**を担保します。振幅スペクトログラムの末尾の特異ベクトルは単精度のノイズ
フロアちょうどに位置するため、float の初期値は総和の順序に依存し、同じ入力でもプラットフォーム
ごとに異なる成分が返ってきます。倍精度にすることでこの依存がなくなります。

これは再現性の性質であって精度の話ではありません。形状・非負性・再構成品質は変わりません。
ただし因子そのものは、単精度の初期値が生成する数値とは異なります。**保存した `w` / `h`** や、
単精度の初期値でレンダリングしたステムは、値が異なります。不一致をバグと決めつけず、
保存済みの因子は再計算してください。
`decomposeWithInit(..., 'nndsvd')` と `decomposeStemsLinked(...)` についても同様です。
:::

### `decomposeStemsLinked(request)` <Badge type="warning" text="高負荷" />

各チャンネルで 1 つの分離を共有し、ステレオの定位を保ったままマルチチャンネルの録音を処理するときに使います。

```typescript
function decomposeStemsLinked(
  request: DecomposeStemsLinkedRequest,
): DecomposeStemsLinkedResult

interface DecomposeStemsLinkedRequest {
  channels: Float32Array[];  // 1 以上、すべて同じ長さ、最大 64
  sampleRate?: number;       // 既定 22050
  nComponents?: number;      // 既定 4
  nFft?: number;             // 既定 2048
  hopLength?: number;        // 既定 512
  nIter?: number;            // 既定 100
  beta?: number;             // 既定 2（Frobenius）。1 で Kullback-Leibler
  init?: 'random' | 'nndsvd';  // 既定 'random'
  maskPower?: number;        // 既定 1。1 以上であること
}

interface DecomposeStemsLinkedResult {
  components: Float32Array[][];  // components[k][c]。各要素は入力と同じ長さ
  w: Float32Array;                // [nBins x nComponents] の行優先行列
  h: Float32Array;                // [nComponents x nFrames] の行優先行列
  sampleRate: number;
}
```

チャンネルの振幅を平均して 1 つの NMF モデルとソフトマスクを作り、各チャンネルの元の複素スペクトログラムへマスクを同じまま適用します。そのためチャンネル間のレベル差と位相差が保たれます。同じ長さのチャンネルを少なくとも 1 つ、最大 64 チャンネルまで渡してください。`w` と `h` は共有された因子分解を表します。1 チャンネルなら、同じオプションを渡した `decomposeStems(...)` とビット単位で一致します。NMF オプションの既定値は `decomposeStems(...)` と同じです。

### `remixAlignedIntervals(...)`

1 つの信号から 1 組のカット位置を確定させ、**同じ**カットをすべてのチャンネルに適用できるように
します。

```typescript
function remixAlignedIntervals(request: RemixRequest): Int32Array
function remixAlignedIntervals(
  samples: Float32Array,
  intervals: Int32Array | ArrayLike<number>,  // (start, end) ペアのフラット配列
  sampleRate?: number,     // 既定 22050
  alignZeros?: boolean,    // 既定 true
): Int32Array
```

ゼロクロッシングへのスナップは**信号ごと**の判断です。左右のチャンネルはゼロを横切る時刻が
異なるため、最寄りのゼロクロッシングへ寄せたカット位置は左右で別のサンプルに着地します。
`alignZeros` を有効にしたまま `remix` をチャンネルごとに呼ぶと、各チャンネルが別々のフレームへ
スナップし、ステレオ素材が少しずつずれていきます。累積する小さなズレなので、マスターに入って
から気づくことになりがちです。`remixAlignedIntervals` はオーディオではなくスナップ後の
`(start, end)` ペアをフラットな `Int32Array` として返すため、1 つのチャンネルで一度だけ確定させ、
同一のリストを `alignZeros: false` の `remix` に各チャンネル分渡せます。

既定値が意図的に異なる点に注意してください。`remix` の `alignZeros` は **`false`**、
`remixAlignedIntervals` は **`true`** です。スナップこそがこの関数の存在理由だからです。
スナップを安全に保つガードが 2 つあります。符号変化が 1 度もない信号はスナップされず、
空に潰れてしまうスライスはスナップ前の境界を保ちます。

```typescript
const cuts = Int32Array.from([0, sampleRate, 2 * sampleRate, 3 * sampleRate]);
const aligned = remixAlignedIntervals(left, cuts, sampleRate);
const outLeft = remix(left, aligned, sampleRate, false);
const outRight = remix(right, aligned, sampleRate, false);
```

### ピッチ検出 <Badge type="info" text="中負荷" />

```typescript
// YIN アルゴリズム
function pitchYin(
  samples: Float32Array,
  sampleRate?: number,   // デフォルト: 22050
  frameLength?: number,  // デフォルト: 2048
  hopLength?: number,    // デフォルト: 512
  fmin?: number,         // デフォルト: 65 Hz
  fmax?: number,         // デフォルト: 2093 Hz
  threshold?: number,    // デフォルト: 0.1
  fillNa?: boolean       // 互換性のために維持。YIN は常に有限の f0 を返す
): PitchResult

// pYIN アルゴリズム（確率的 YIN + HMM 平滑化）
function pitchPyin(
  samples: Float32Array,
  sampleRate?: number,   // デフォルト: 22050
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

YIN は、`voicedFlag` が無声音と示すフレームも含め、すべてのフレームで有限の推定値を返します。

pYIN は既定では無声音の `NaN` を保持します。後段で `0` が必要な場合だけ `fillNa: true` を指定してください。


## ノートと打撃音

この 4 つは解析と編集の中間にあります。いずれも音声が明示していないものを測り、ホストが編集してレンダリングできるオブジェクトを返します。

### `analyzePolyphonic(request)` <Badge type="warning" text="高負荷" />

```typescript
function analyzePolyphonic(request: AnalyzePolyphonicRequest): PolyphonicAnalysis
```

和音を構成するノートを分離し、そのうち 1 つだけを編集して他はそのまま残せるようにします。返るのは**結果オブジェクトではなくハンドル**です。解析は音源の複素スペクトログラムと各ノートが取得したビンを保持しており、これは入力そのものに取得情報を足したものに相当します。これを保持しているため、編集後の再レンダリングに追加のコストがかかりません。

用が済んだらすぐに `destroy()` してください。解放後に使うと、解放済みオブジェクトに触れるのではなく `InvalidState` が送出されます。JavaScript 側へ渡るのはホストが実際に扱うものだけです。ノート一覧、各ノートの保留中の編集、フレームごとの発音数、そしてノートごとのピッチ・レベル・サリエンス曲線。スペクトログラム、マスク、ビンごとの重みは渡りませんし、ビン単位の数値を報告するメソッドもありません。

`sampleRate` は既定値を持たず必須です。処理系の全ての時間量がこの値でサンプル数へ変換されるため、誤った値を渡すと失敗せずに違う解析をします。

### `decomposeNotePitch(request)`

```typescript
function decomposeNotePitch(request: DecomposeNotePitchRequest): PitchDecompositionResult
```

1 つのノートのピッチ曲線を、そこに同時に含まれる 3 つの成分へ分けます。狙った中心音、その周りのゆっくりした揺れ、そしてその上に乗る周期的な振動です。どれか 1 つを編集するには、まず分離する必要があります。

ドリフトとビブラートの境界を決めているのは `vibratoCutoffHz` だけです。**同じカットオフを `renderNotes` にも渡してください。** そうしないと、ユーザーに表示しているものとは別の曲線を編集することになります。

F0 が使えないフレームには測定値がないため、曲線は最も近い有効な隣接値で保持されます。したがってどちらの曲線も全フレームに値を持ちます。保持された箇所を示したいホストは `f0Hz` を見れば正確に判別できます。使えるピッチが全く無いノートは、エラーではなく `centreHz` が 0 で 2 本の曲線が空という形で返ります。これは引数の誤りではなく、測定が空振りしたという報告です。

### `extractPercussiveEvents(request)` と `renderPercussiveEvents(request)`

```typescript
function extractPercussiveEvents(request: ExtractPercussiveEventsRequest): PercussiveEvent[]
function renderPercussiveEvents(request: RenderPercussiveEventsRequest): Float32Array
```

対で使います。前者は音声だけから打撃音を検出します。各イベントは、ソースのサンプル位置で表した区間、検出器の強度、区間内の打撃成分のピーク、区間のエネルギーのうち分離が打撃成分と判定した割合、そして恒等変換の編集内容を持ちます。イベントを編集して後者へ渡すと、音声が返ります。**ソースは決して書き換わりません。全ての編集が恒等変換のままなら、レンダリング結果は入力と一致します。**

両者は同じ分離オプションを取り、どちらも `sampleRate` を必要とします。理由も同じで、`maxEventMs` と `fadeMs` をサンプル数へ変換するためです。

既定値のうち 2 つは押さえておいてください。`minPercussiveRatio` の既定は `0`、つまり「すべて残す」です。上げるとドラム主体の素材では役に立ちますが、密度の高いミックスでは逆効果で、大きな持続音に重なった本物の打撃音まで落とします。`fadeMs` の既定は 5 ms で、このフェードが掛かるのは**減算される側**の信号です。そのため「切り落とし」を指定する手段はありません。角を立てると段差が残るからです。対応するフェードインは意図的にありません。区間はトランジェントの手前で始まり、そこでは打撃成分がほぼ無音だからです。

分離のメディアンカーネル長は奇数かつ正である必要があります。偶数は丸めずに拒否されます。`1` は正当ですが退化した指定で、長さ 1 のメディアンは恒等写像なので、両方の成分がソースそのままで返ります。
