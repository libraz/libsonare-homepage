---
title: JavaScript/TypeScript エフェクト API
description: libsonare JavaScript/TypeScript パッケージのオーディオエフェクト、編集 DSP、ルーム音響の計測と合成のリファレンスです。
---

# JavaScript/TypeScript エフェクト API

## オーディオエフェクト

### `hpss(samples, sampleRate, kernelHarmonic?, kernelPercussive?, nFft?, hopLength?, hardMask?)` <Badge type="warning" text="高負荷" />

HPSS（Harmonic / Percussive Source Separation。倍音成分／打撃成分の分離）。音源を倍音成分（ボーカル、シンセなどの持続音）と打撃成分（ドラム、過渡音）に分離します。

::: info ユースケース
- **リミックス**: ドラムを分離または除去する
- **カラオケ**: ボーカルを除去して伴奏だけを取り出す（倍音成分を使用）
- **解析精度の向上**: クリーンなコード検出のために倍音成分のみを使う
- **ドラム抽出**: サンプリング用に打撃成分だけを取り出す
:::

<SonareDemo id="hpss-separation" />

::: tip パフォーマンス
HPSS は STFT（短時間フーリエ変換）とメディアンフィルター処理を必要とします。処理時間は音源の長さに比例します。
:::

```typescript
function hpss(
  samples: Float32Array,
  sampleRate?: number,        // デフォルト: 22050
  kernelHarmonic?: number,    // デフォルト: 31
  kernelPercussive?: number,   // デフォルト: 31
  nFft?: number,               // デフォルト: 2048
  hopLength?: number,          // デフォルト: 512
  hardMask?: boolean           // デフォルト: false
): HpssResult

interface HpssResult {
  harmonic: Float32Array;
  percussive: Float32Array;
  sampleRate: number;
}
```

`hpssWithResidual(...)` は同じカーネル、STFT、マスクのオプションを受け取り、倍音成分と打撃成分のどちらにも分類されなかった残差成分も返します。

```typescript
function hpssWithResidual(
  samples: Float32Array,
  sampleRate?: number,
  kernelHarmonic?: number,
  kernelPercussive?: number,
  nFft?: number,               // デフォルト: 2048
  hopLength?: number,          // デフォルト: 512
  hardMask?: boolean           // デフォルト: false
): HpssWithResidualResult
```

### `harmonic(samples, sampleRate)` <Badge type="warning" text="高負荷" />

音源から倍音成分を抽出します。

```typescript
function harmonic(samples: Float32Array, sampleRate?: number): Float32Array  // sampleRate 既定: 22050
```

### `percussive(samples, sampleRate)` <Badge type="warning" text="高負荷" />

音源から打撃成分を抽出します。

```typescript
function percussive(samples: Float32Array, sampleRate?: number): Float32Array  // sampleRate 既定: 22050
```

### `timeStretch(samples, sampleRate, rate, nFft?, hopLength?)` <Badge type="warning" text="高負荷" />

ピッチを変えずにテンポを変更します。`rate` が 1.0 未満なら遅く、1.0 より大きければ速くなります。

::: info ユースケース
- **練習ツール**: 難しいパッセージを練習するために音楽を遅くする
- **DJ ミキシング**: トラック間のテンポを合わせる
- **ポッドキャスト編集**: 話す速度の調整
- **音楽制作**: サンプルをプロジェクトのテンポに合わせる
:::

<SonareDemo id="time-stretch" />

::: tip パフォーマンス
フェーズボコーダーを使います。処理時間はオーディオの長さに比例します。
:::

```typescript
function timeStretch(
  samples: Float32Array,
  sampleRate: number,
  rate: number,      // 0.5 = 半速、2.0 = 倍速
  nFft?: number,     // デフォルト: 2048
  hopLength?: number // デフォルト: 512
): Float32Array
```

### `pitchShift(samples, sampleRate, semitones, nFft?, hopLength?)` <Badge type="warning" text="高負荷" />

長さを変えずにピッチを変更します。単位は半音で、+12 が 1 オクターブ上です。

::: info ユースケース
- **キーマッチング**: ミキシング用に曲を移調する
- **ボーカルチューニング**: ボーカルのピッチを補正・調整する
- **クリエイティブエフェクト**: ハーモニーの生成、チップマンク／ディープボイス
- **楽器練習**: 演奏しやすいキーに移調する
:::

::: tip パフォーマンス
タイムストレッチとリサンプリングを組み合わせます。処理時間はオーディオの長さに比例します。
:::

```typescript
function pitchShift(
  samples: Float32Array,
  sampleRate: number,
  semitones: number,   // +12 = 1オクターブ上
  nFft?: number,        // デフォルト: 2048
  hopLength?: number    // デフォルト: 512
): Float32Array
```

### 編集 DSP

これらの関数は解析ではなく、信号そのものを書き換えます。`Audio` インスタンスメソッドとしても利用でき、その場合は保持している `sampleRate` が自動的に使われます。

```typescript
function pitchCorrectToMidi(
  samples: Float32Array,
  sampleRate: number,
  currentMidi: number,
  targetMidi: number,
): Float32Array

// 追跡したピッチ輪郭を、フレーム単位で固定のターゲット音にリチューンします。
// f0Hz は hopLength に揃えたフレームごとの f0 トラック（例: pitchYin/pitchPyin の出力）です。
// 対応する voiced フラグを渡すと無声音フレームをスキップでき、
// 無声音または NaN のフレームはそのまま残ります。voicedProb は同じ判定の
// フォールバック入力にすぎず、voiced を渡した時点で無視されます。
function pitchCorrectToMidiTimevarying(
  samples: Float32Array,
  f0Hz: Float32Array,
  targetMidi: number,
  sampleRate: number,
  hopLength: number,
  voiced?: VoicedFlags,
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
  voiced?: VoicedFlags;            // フレームごとの有声フラグ（真値 / 非ゼロ = 有声）
  voicedProb?: Float32Array;       // 有声判定のフォールバック入力。voiced 指定時は無視
}

// フレームごとの有声判定。f0Hz のフレーム数と 1 対 1 で対応します。
type VoicedFlags =
  | Int32Array
  | Uint8Array
  | Float32Array
  | readonly number[]
  | readonly boolean[];
```

`VoicedFlags` は `voiced` 引数と `PitchCorrectOptions.voiced` が受け付ける型です。解析側が返す形をそのまま含んでいるため、`boolean[]` である `PitchResult.voicedFlag` を変換なしでピッチ補正へ渡せます。

```typescript
const pitch = pitchPyin(samples, sampleRate);
const tuned = pitchCorrectToMidiTimevarying(
  samples,
  pitch.f0,
  69,
  sampleRate,
  512,
  pitch.voicedFlag,   // boolean[] is accepted as-is
);
```

`voiced` と `voicedProb` は、どちらも `f0Hz` と同じ長さである必要があります。長さが食い違うと `RangeError`（`'pitchCorrectToMidiTimevarying: voiced length must match f0Hz length'`）を投げます。`SonareError` ではないため `isSonareError` では捕捉できません。

::: warning `voicedProb` が決めるのは有声判定だけ
`voicedProb` の用途は 1 つだけです。`voiced` を渡さなかったときに、フレームごとの有声／無声の判定を導くことです。`voiced` を渡した場合、`voicedProb` は完全に無視されます。両方渡しても何も起きないため、上の例ではフラグだけを渡しています。

特に、フレームごとの補正量をスケーリングすることは**ありません**。確率で重み付けされた緩やかなリチューンを期待して `voicedProb` を渡していた場合、実際にはそうなっておらず、聞こえる補正はその想定より**低音域で強く**なります。`voicedProb` は F0 とともに上昇するため、その想定でもっとも減衰されていたはずのフレームが低音域だからです。補正を緩めるには `retuneAmount` と `vibratoThresholdCents` を使ってください。
:::

```typescript
function noteStretch(
  samples: Float32Array,
  sampleRate: number,
  options?: {
    onsetSample?: number,    // ノートのオンセット位置（サンプル）
    offsetSample?: number,   // ノートのオフセット位置（サンプル）
    stretchRatio?: number,   // >1 で区間を長くし、<1 で短くする
  },
): Float32Array

// ノート区間の長さを変えずに、新しいオンセット位置へ移動する
// （長さは変えずオンセットを変えない noteStretch を補完する）。
function noteMove(
  samples: Float32Array,
  sampleRate?: number,
  options?: {
    onsetSample?: number,        // ノートのオンセット位置（サンプル）
    offsetSample?: number,       // ノートのオフセット位置（サンプル）。既定は入力の長さ
    targetOnsetSample?: number,  // 区間のオンセットの移動先
  },
): Float32Array
```

`Audio.noteStretch(options?)` と `Audio.noteMove(options?)` は `Audio` インスタンス上の対応メソッドです（サンプルレートはインスタンスの値を使います）。

```typescript
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

### `normalize(samples, sampleRate, targetDb?, mode?)`

オーディオを目標レベルに正規化します。`mode` の既定値は `'peak'` で、RMS レベルを目標にする場合は `'rms'` を指定します。

```typescript
function normalize(
  samples: Float32Array,
  sampleRate: number,
  targetDb?: number,        // デフォルト: 0.0 (フルスケール)
  mode?: 'peak' | 'rms'     // デフォルト: 'peak'
): Float32Array
```

### `normalizeStereo(request)`

ステレオペアを**共通の 1 つのゲイン**で正規化し、ステレオイメージを保ちます。

```typescript
function normalizeStereo(request: NormalizeStereoRequest): NormalizeStereoResult

interface NormalizeStereoRequest {
  left: Float32Array;
  right: Float32Array;       // left と同じ長さである必要がある
  sampleRate?: number;       // 既定 22050
  targetDb?: number;         // 既定値は mode に依存。下記参照
  mode?: 'peak' | 'rms';     // 既定 'peak'
  validate?: boolean;        // 既定 true
}

interface NormalizeStereoResult {
  left: Float32Array;
  right: Float32Array;
  appliedGainDb: number;     // ペアではなく 1 つの値
}
```

レベルはペア全体から測り、得られたゲインを**両チャンネル**にそのまま適用します。これがこの関数の要点です。チャンネルごとに別々の目標へ正規化すると、レベルではなく左右のバランスが変わり、意図したパンがセンターに寄ります。判断が共通なので、`appliedGainDb` はチャンネルごとのペアではなく単一の値です。`'peak'` モードでは大きい側のチャンネルが `targetDb` に達し、小さい側はその差を保ちます。`'rms'` モードで `targetDb` に合わせる量は両チャンネルのサンプルをまとめた RMS、つまりチャンネルごとの値の相加平均ではなく二乗平均平方根で、出力は `[-1, 1]` にハードクリップされます。

::: warning `targetDb` の既定値はモード依存で、モノラルの `normalize` とは異なる
`normalizeStereo` の `targetDb` の既定値は `mode: 'peak'` で **`0`**、`mode: 'rms'` で **`-20`** であり、他言語のサーフェスと一致します。このサーフェスのモノラル `normalize` は両モードとも `0` を既定としますが、RMS にとってこれは誤った値です。0 dBFS の RMS は信号中のすべてのピークをクリップさせます。モノラルの呼び出しをステレオ版へ移植するときは、明示的な `targetDb: 0` をそのまま持ち込まないでください。
:::

チャンネル長が食い違うペアは、処理の前に `RangeError`（`'Stereo channel lengths must match.'`）を投げます。一方、**無音はエラーではありません**。中身のないペアはそのまま返り、`appliedGainDb` はちょうど `0` になります。例外も、際限のないブーストも起きません。

`validate` が制御するのは JavaScript 側の事前スキャンだけです。問題のあるサンプルの添字を含む `RangeError` を出すのはこのスキャンです。ネイティブ層はいずれにせよ再検証するため、`validate: false` は安全性ではなく「詳しいメッセージ」と速度を交換します。無効化されるのは明示的に `false` を渡した場合だけです。

### `trim(samples, sampleRate, thresholdDb?, frameLength?, hopLength?)`

オーディオの始めと終わりから無音を除去します。

```typescript
function trim(
  samples: Float32Array,
  sampleRate: number,
  thresholdDb?: number,   // デフォルト: -60.0
  frameLength?: number,   // デフォルト: 2048
  hopLength?: number      // デフォルト: 512
): Float32Array
```

これは `Audio` レベルの単純なしきい値トリムです。librosa 互換のフレーム RMS / `topDb` ベースの無音判定と、元音源上の開始・終了サンプル位置が必要な場合は、下の `trimSilence(...)` を使います。

## ルーム音響解析

これらの関数は、曲そのものではなく録音空間を説明・適用する API です。

| 目的 | 使う API |
|------|----------|
| きれいなインパルス応答（IR）を測る | `analyzeImpulseResponse(...)` |
| 通常音声から部屋の減衰を推定する | `detectAcoustic(...)` |
| 音声から実用的な部屋モデルを推定する | `estimateRoom(...)` |
| 寸法からモノラルのルームインパルス応答を作る | `synthesizeRir(...)` |
| 目標ルームの響きを音作り効果として足す | `roomMorph(...)` |

::: info RIR とルームモーフィング
**RIR** は room impulse response（ルームインパルス応答）の略で、部屋が短い音にどう反応するかを表すサンプル列です。`roomMorph(...)` は音作り効果であり、残響除去ではありません。
:::

```typescript
const ir = analyzeImpulseResponse(impulseResponseSamples, sampleRate, 6, 30);
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

`analyzeImpulseResponse(samples, sampleRate?, nOctaveBands?, minDecayDb?)` の `minDecayDb` は減衰フィットのしきい値で、既定値は `30` です。

RT60、EDT、C50、C80、D50、バンド別配列、ルーム推定、生成 RIR、信頼度の読み方は [ルーム音響解析](./acoustic-analysis.md) を参照してください。
