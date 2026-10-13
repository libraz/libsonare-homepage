---
title: JavaScript/TypeScript オーディオ、メータリング、ミキシング API
description: libsonare JavaScript/TypeScript パッケージの Audio クラス、オフラインメータリング、テイクの位置合わせ、ミキサーストリップ、ミキシング API のリファレンスです。
---

# JavaScript/TypeScript オーディオ、メータリング、ミキシング API

## Audio クラス

`Audio` クラスは、よく使う関数をメソッド形式で呼ぶための入口です。サンプルとサンプルレートを内部で保持するため、各呼び出しで渡し直す必要がありません。

### `Audio.fromBuffer(samples, sampleRate)`

サンプルデータから Audio インスタンスを作成します。

```typescript
const audio = Audio.fromBuffer(samples, 44100);
```

`sampleRate` は省略可能で、既定は `48000` です。保持された値はすべてのインスタンスメソッドに渡されるため、必ずバッファ本来のサンプルレートを指定してください。

### `Audio.fromMemory(bytes)`

WAV や MP3 などのエンコード済みオーディオバイト列（`Uint8Array`）をネイティブ WASM デコーダでデコードし、`Audio` インスタンスを返します。同梱デコーダが対応しない形式の場合は `SonareError` を投げます。

```typescript
const audio = Audio.fromMemory(new Uint8Array(await file.arrayBuffer()));
```

### `Audio.fromMemoryWithBrowserFallback(bytes, options?)`

`async` で `Promise<Audio>` を返します。まず `Audio.fromMemory` を試みます。同梱デコーダが AAC・OGG・FLAC などの形式を読めない場合は、ブラウザのコーデックスタック（`AudioContext.decodeAudioData`）で代わりにデコードします。ブラウザでデコードしたマルチチャンネル音声は、ネイティブデコーダと同じ ITU-R BS.775 の規則（後述の `downmix`）でモノラルに折りたたまれるため、どちらのデコーダが動いても同じサンプルになり、返される `Audio` オブジェクトは 1 本のサンプル列を持ちます。任意の `BrowserAudioDecodeOptions`（`audioContext` / `createAudioContext` / `targetSampleRate`）を受け取り、このヘルパー自身が生成したコンテキストは後で閉じられます。

```typescript
const audio = await Audio.fromMemoryWithBrowserFallback(
  new Uint8Array(await file.arrayBuffer()),
);
```

### `decodeChannels(bytes)`

`Audio.fromMemory` はマルチチャンネルのファイルをデコード時にモノラルへ折りたたみます。`decodeChannels` は同じ形式をデコードしつつ全チャンネルを保持し、元のチャンネル順で 1 チャンネル 1 本の `Float32Array` プレーンを並べた `{ sampleRate, channels }` を返します（5.1 のファイルは `L R C LFE Ls Rs` の順で届きます）。

### `decodeChannelsWithBrowserFallback(bytes, options?)`

`async` で、`decodeChannels` と同じ `{ sampleRate, channels }` である `Promise<DecodedChannels>` を返します。同梱デコーダーが扱わない形式（AAC、OGG、FLAC）は `Audio.fromMemoryWithBrowserFallback` と同様にブラウザのコーデックスタックを経由し、同じ `BrowserAudioDecodeOptions` を取ります。ブラウザが返したチャンネルはすべて保持されます。

### `downmix(channels, targetLayout, options?)`

プレーンを、より狭いレイアウトへ ITU-R BS.775 の規則で変換します。センターとサラウンドは -3 dB でフロントペアに入り、LFE プレーンは捨てられます。`targetLayout` は `0` がモノラル、`1` がステレオ、`2` が 5.1、`3` が 7.1 です。元のレイアウトはチャンネル数（1、2、6、8）で決まり、それ以外の数は重みなしの平均でモノラルに折りたたまれます。折りたたみは正規化されないため、フルスケールに近いプレーンが複数あるソースはフルスケールを超えることがあります（1.0 の 6 プレーンはステレオ目標で 2.414 になります）。省略可能な第 3 引数 `{ normalize, includeLfe }` で挙動を変えられます。`normalize: true` は最悪ケース（全入力がフルスケールで同相）でも 1 以下に収まるよう折りたたみをスケールします（ラウドネスを合わせるのではなくピークで割る方式です）。`includeLfe: true` は LFE プレーンを捨てずに -3 dB でフロントペアへ加えます。どちらも既定は `false` です。アップミックスや未知のレイアウトは `SonareError`（`InvalidParameter`）、チャンネルなし、長さの異なるプレーン、32 ビット範囲の整数ではない `targetLayout` は `RangeError`、数値ではない `targetLayout` は `TypeError` を投げます。

```typescript
import { init, decodeChannels, downmix } from '@libraz/libsonare';

await init();

const { sampleRate, channels } = decodeChannels(bytes);
const stereo = channels.length > 2 ? downmix(channels, 1) : channels;
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

引数の既定値（`nFft`、`hopLength`、`nMels` など）はスタンドアロン関数と同じです。メソッドを系統別に並べると次のとおりです。

| 系統 | メソッド |
|---|---|
| 解析 | `detectBpm`, `detectKey`, `detectKeyCandidates`, `detectBeats`, `detectDownbeats`, `detectOnsets`, `detectChords`, `chordFunctionalAnalysis`, `analyze`, `analyzeWithProgress` |
| 分離と編集 | `hpss`, `harmonic`, `percussive`, `timeStretch`, `pitchShift`, `pitchCorrectToMidi`, `noteStretch`, `noteMove`, `voiceChange`, `normalize`, `trim`, `resample` |
| マスタリング | `mastering`, `masteringChain`, `masterAudio`, `masteringProcess`（[マスタリング API](./js-api-mastering.md) を参照） |
| スペクトル特徴 | `stft`, `stftDb`, `melSpectrogram`, `mfcc`, `chroma`, `nnlsChroma`, `onsetEnvelope`, `spectralCentroid`, `spectralBandwidth`, `spectralRolloff`, `spectralFlatness`, `zeroCrossingRate`, `rmsEnergy`, `pitchYin`, `pitchPyin` |
| ラウドネス | `lufs`, `momentaryLufs`, `shortTermLufs`, `ebur128LoudnessRange` |
| レベルメーター | `peakDb`, `rmsDb`, `dcOffset`, `crestFactorDb`, `silenceRatio`, `truePeakDb`, `detectClipping`, `dynamicRange`, `spectrum`, `spectrumFrame` |

## メータリング

デコード済みバッファから、レベル、ダイナミクス、ステレオイメージの統計値を返す単体メーターです。マスタリングチェーンやストリーミングエンジンとは独立しています。背景は [クレストファクター](./glossary/concepts/crest-factor.md)、[ダイナミックレンジ](./glossary/concepts/dynamic-range.md)、[モノラル互換性](./glossary/concepts/mono-compatibility.md)、[True Peak](./glossary/true-peak.md) を参照してください。

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

<SonareDemo id="inter-sample-peak" />

### ステレオのレベルメーター

単一チャンネルのメーターが必要とする `0.5 * (left + right)` のダウンミックスではなく、左右 2 チャンネルをそのまま読むレベルメーターです。上のメーターと違い、**リクエストオブジェクト専用です**。位置引数のオーバーロードはなく、位置引数で呼ぶと例外になります。

```typescript
// チャンネルペアのクレストファクター（dB）。ピークは両チャンネルをまたいで取り、
// RMS は 2 チャンネルをまとめて測る。
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

左右が逆相になりうる素材では、こちらを使ってください。逆相のペアはダウンミックスで打ち消し合うため、単一チャンネル側のメーターには無音に見えます。完全な逆相ペアでは、ステレオ版が信号本来のクレストファクター（正弦波なら 3.01 dB）を返し、ダウンミックス経由は **0.00 dB** になります。

<SonareDemo id="mono-fold" />

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
// ミッド/サイドの点列。既定ではサンプルごとに 1 点。maxPoints を渡すと、
// 表示向けに決定的に間引いた点集合になる（0 / length 以上 = サンプルごとに 1 点）。
function meteringVectorscope(left: Float32Array, right: Float32Array, sampleRate?: number, options?: ScopeOptions): VectorscopeReport
// フェーズスコープの点列と要約統計。maxPoints は同じ方法で点群を間引く。
// 要約統計は常にフル解像度の信号から計算する。
function meteringPhaseScope(left: Float32Array, right: Float32Array, sampleRate?: number, options?: ScopeOptions): PhaseScopeReport

interface ScopeOptions extends ValidateOptions {
  maxPoints?: number;   // 0 / omit / >= length = one point per input sample
}

// 非推奨のエイリアス。代わりに meteringVectorscope / meteringPhaseScope に maxPoints を渡す。
// 単に委譲するだけで、互換性のために残している。
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

## テイク: 位置合わせと共通の無音

同じパートを複数回録ったテイクを扱う、バッファ単位のヘルパーです。録音からコンピングまでの流れの中でどこに位置するかは [録音とテイク](./recording-and-takes.md) にあります。ここではシグネチャを載せます。

### `alignTakeToReference(request)`

```typescript
function alignTakeToReference(request: AlignTakeToReferenceRequest): AlignTakeToReferenceResult

interface AlignTakeToReferenceRequest {
  reference: Float32Array;  // ガイドテイクまたは伴奏。空でなく、すべて有限値
  take: Float32Array;       // その下に合わせるテイク。条件は同じ
  sampleRate: number;       // reference のレート [8000, 384000]。takeSampleRate がなければ take も同じ
  takeSampleRate?: number;  // take のレート [8000, 384000]。省略で sampleRate。sampleRate へリサンプルされる
  hopLength?: number;       // sampleRate でのクロマのホップ（サンプル）。省略または 0 で 512。正の整数
  binsPerOctave?: number;   // オクターブあたりの CQT ビン数。省略または 0 で 12。正の 12 の倍数
}
interface AlignTakeToReferenceResult {
  anchors: ProjectWarpAnchor[];   // 2 個以上、有限で狭義単調増加の { warpSample, sourceSample }
  alignment: { meanResidualFrames: number; referenceFrames: number; takeFrames: number };
}
```

両者のクロマグラムを位置合わせし、その経路を **テイク側** のクリップに `Project.setWarpMap` で渡せるアンカーへ縮約します。`warpSample` はリファレンスのタイムライン上の位置、`sourceSample` はそれに対応するテイク内の位置です。アンカーと `hopLength` は `sampleRate` でのサンプル数です。空または非有限のバッファと、範囲外の `sampleRate`・`takeSampleRate` は `RangeError` で拒否します。レートの `0` は既定値にならず、範囲外として扱います。負の解像度フィールド、12 の倍数でない `binsPerOctave`、クロマ 2 フレーム分に満たない短い信号、相異なるアンカーが 2 個得られない組み合わせは `SonareError` の `InvalidParameter` になります。合わせようのない組み合わせは、使えないマップを返す代わりにエラーとして報告されます。`alignment` は参考情報で、これによって呼び出しが失敗することはありません。`takeFrames / referenceFrames` がアンカーの表す全体のレート差、`meanResidualFrames` が経路が一定レートからどれだけ外れたかで、しきい値は呼び出し側で決めます。

### `splitSilenceCommonWithReport(request)`

```typescript
function splitSilenceCommonWithReport(request: SplitSilenceCommonRequest): {
  intervals: Int32Array;       // 同じリクエストに対する splitSilenceCommon の戻り値そのもの
  report: SilenceCommonReport;
}
interface SilenceCommonReport {
  silenceCeilingDb: number;    // すべての信号に無音が残る最大の topDb
  maxSignalIntervals: number;  // 最も細かく分かれた信号が単独で出した区間数（和集合で結合する前）
  minSignalIntervals: number;  // 最も分かれなかった信号について同じもの
}
```

リクエスト（`signals`、`topDb` 60、`frameLength` 2048、`hopLength` 512）、返す区間、拒否条件は [ヘルパー](./js-api-helpers.md) の `splitSilenceCommon` と同一です。名前の「共通」は、各テイクが鳴っている区間の和集合を取ることで、残った隙間がどのテイクでも無音になることを指します。レポートがあるのは、全体を覆う区間が 1 つだけ返る結果に 3 つの原因があり、区間リストではそれを区別できないからです。`silenceCeilingDb` を渡した `topDb` と見比べてください。0 に近ければ、鳴りっぱなしのテイクがあり、しきい値をどう変えても隙間は出ません。`topDb` より低ければしきい値が緩すぎたので、ceiling を下回る `topDb` で同じ入力が切れます。`topDb` 以上なのに区間が 1 つなら、どのテイクにも無音はあるが位置が揃っていないので、`alignTakeToReference` の出番です。区間数は形の情報でしかありません。一度鳴って止まるテイクは 1 で、無音がまったくないテイクと同じ値になります。

### `remixAlignedIntervals(...)`

1 チャンネル分のサンプルと、フラットな `(start, end)` の区間リスト（`splitSilenceCommon` の戻り値と同じ形）を受け取り、ゼロクロスに吸着させた同じリストを返します。`remix` が全チャンネルを同一のフレームで切るためのものです。`alignTakeToReference` の戻り値は受け取りません。その戻り値はワープアンカーであってカット位置ではありません。詳細は [`remixAlignedIntervals`](./js-api-features.md#remixalignedintervals) を参照してください。

## Mixer のストリップ: `addStrip` と `settle`

シーンドキュメントでは表現できない `Mixer` のメソッド 2 つです。シーン、ルーティング、コンパイルのタイミングは [ミキシングエンジン](./mixing.md) にあります。概念は [チャンネルストリップ](./glossary/mixing/channel-strip.md)、[バスとセンド](./glossary/mixing/buses-sends.md)、[オートメーションとメーター](./glossary/mixing/automation-metering.md) を参照してください。

```typescript
// 構築済みのミキサーにストリップを追加する。戻り値はなく、以後はインデックスで参照する。
// stripById(id) は呼び出し前の stripCount() と一致する。グラフは dirty になり、
// compile() または次の processStereo() で再構築される。
addStrip(id: string, metering?: StripMeteringOptions): void

interface StripMeteringOptions {
  enabled?: boolean;            // 両メーター。false で両方省く（48 kHz でストリップあたり約 1.4 MB → 約 145 KB）。既定 true
  lufs?: boolean;               // LUFS 測定。既定 true
  truePeak?: boolean;           // サンプル間ピーク測定。既定 true
  truePeakOversample?: number;  // [0, 16]。2x / 4x / 8x に丸められる。0 / 省略で 4x
}

// ストリップの入力トリム、フェーダー、パン、幅のスムーザーを設定済みの値に揃える。
settle(stripIndex: number): void
```

`addStrip` は id の重複、`[0, 16]` 外の `truePeakOversample`、型の違う metering フィールド、プレーンオブジェクトでない `metering` で例外を投げ、そのストリップは追加されません。メーター構成はストリップ構築時に固定され、後から変えるセッターはありません。明示的な接続のないストリップはコンパイル時にマスターへ配線されるので、シーンを編集しなくても新しいストリップは聞こえます。呼び出し側が変える必要があるのは入力の方です。`processStereo` はストリップ数までのチャンネルペアを受け取り、ペアのないストリップは無音としてレンダリングするため、新しいインデックスの分だけ配列を増やすまで新しいストリップは無音のままです。`processStereoInto` はちょうど `stripCount()` 組のペアを要求する（違うと `RangeError`）ので、worklet のループでは `addStrip` の後に配列を増やしてください。ストリップ数より多いペアは例外になります。

`settle` が必要になるのは、**設定したばかりのストリップをオフラインでレンダリングする** ときです。レベル系の操作子はライブのフェーダー向けにスムージング（約 5 ms）されているため、`setFaderDb` / `setPan` / `setWidth` / `setInputTrimDb` の直後の最初のブロック、あるいは `fromSceneJson` 直後（フェーダーのスムーザーはユニティから始まる）の最初のブロックは、スムーザーの初期値から目標値へ徐々に移っていきます。−3 dB の 1 ストリップのシーンでは、最初のサンプルが 3 dB 高く実測されました。ユニティから目標値までの距離がそのまま差になります。最後の操作の後、最初のブロックの前に呼んでください。ライブのループではこの滑らかな変化こそが目的なので不要です。自動化、メーター、インサートの状態には触れず、何も消しません。範囲外のインデックスは拒否します。

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
mixer.sceneWarnings(); // シーン読み込み時の非致命的な警告（どのプロセッサも読まない insert パラメータ＝タイプミス、宣言されていないバスへのセンド）
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

シーンが宣言していないバスへのセンドも読み込めます。暗黙のエイクスバスが作られ、ストリップとバスを名指しするシーン警告が加わります（`send 'vocal' targets undeclared bus 'nowhere'; created as implicit aux`）。

AudioWorklet のようにレンダーブロックごとのアロケーションを避けたいループでは、`Mixer.createRealtimeBuffer()` と `processStereoInto(...)` を使います。`processStereo` と `processStereoInto` はどちらも、ストリップ数より少ない入力チャンネルを受け付け（残りのストリップは無音）、多い場合は両方の数を挙げた `RangeError` を投げます（`got 3 input channels for a 2-strip mixer`）。シーンやルーティングの詳細は [ミキシングエンジン](./mixing.md) を参照してください。

