---
title: JavaScript/TypeScript エフェクト API
description: libsonare JavaScript/TypeScript パッケージのオーディオエフェクト、編集 DSP、ルーム音響の計測と合成のリファレンスです。
---

# JavaScript/TypeScript エフェクト API

## オーディオエフェクト

### `hpss(samples, sampleRate, kernelHarmonic?, kernelPercussive?, nFft?, hopLength?, hardMask?)` <Badge type="warning" text="高負荷" />

HPSS（Harmonic / Percussive Source Separation。倍音成分／打撃成分の分離）。音源を倍音成分（ボーカル、シンセなどの持続音）と打撃成分（ドラム、過渡音）に分離します。

<SonareDemo id="hpss-separation" />

`nFft` は 4 以上の偶数で、混合基数 FFT のサイズも使えます。`hopLength` は `(0, nFft / 2]` の整数、両方のメディアンカーネルは 524287 以下の正の奇数を指定します。内部の STFT 窓と `winLength` の組み合わせも、重ね合わせに隙間ができないことが必要です。JavaScript のヘルパーは既定の窓設定を使います。不正な設定は、周期的な音抜けを返す代わりに拒否します。

::: tip パフォーマンス
HPSS は STFT（短時間フーリエ変換）とメディアンフィルター処理を必要とします。処理時間は音源の長さに比例します。
:::

```typescript
function hpss(
  samples: Float32Array,
  sampleRate?: number,        // 既定: 22050
  kernelHarmonic?: number,    // 既定: 31
  kernelPercussive?: number,   // 既定: 31
  nFft?: number,               // 既定: 2048
  hopLength?: number,          // 既定: 512
  hardMask?: boolean           // 既定: false
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
  nFft?: number,               // 既定: 2048
  hopLength?: number,          // 既定: 512
  hardMask?: boolean           // 既定: false
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

ピッチを変えずにテンポを変更します。`rate` が 1.0 未満なら遅く、1.0 より大きければ速くなります。[タイムストレッチとピッチシフト](./glossary/editing/phase-vocoder-stretch.md) も参照してください。

<SonareDemo id="time-stretch" />

::: tip パフォーマンス
フェーズボコーダーを使います。処理時間はオーディオの長さに比例します。
:::

```typescript
function timeStretch(
  samples: Float32Array,
  sampleRate: number,
  rate: number,      // 0.5 = 半速、2.0 = 倍速
  nFft?: number,     // 既定: 2048
  hopLength?: number // 既定: 512
): Float32Array
```

### `pitchShift(samples, sampleRate, semitones, nFft?, hopLength?)` <Badge type="warning" text="高負荷" />

長さを変えずにピッチを変更します。単位は半音で、+12 が 1 オクターブ上です。[タイムストレッチとピッチシフト](./glossary/editing/phase-vocoder-stretch.md) も参照してください。

::: tip パフォーマンス
タイムストレッチとリサンプリングを組み合わせます。処理時間はオーディオの長さに比例します。
:::

```typescript
function pitchShift(
  samples: Float32Array,
  sampleRate: number,
  semitones: number,   // +12 = 1オクターブ上
  nFft?: number,        // 既定: 2048
  hopLength?: number    // 既定: 512
): Float32Array
```

### 編集 DSP

これらの関数は解析ではなく、信号そのものを書き換えます。`Audio` インスタンスメソッドとしても利用でき、その場合は保持している `sampleRate` が自動的に使われます。背景は [ピッチ補正とノート編集](./glossary/editing/pitch-correction.md) と [ボイスとフォルマント](./glossary/editing/voice-formant.md) を参照してください。他の単発関数と同じく、どれもリクエストオブジェクトを受け付け、位置引数の呼び出しでは最後の引数の後ろに `{ validate?: boolean }` も渡せます。

```typescript
function pitchCorrectToMidi(
  samples: Float32Array,
  sampleRate?: number,       // 既定 22050
  currentMidi?: number,
  targetMidi?: number,
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
  sampleRate?: number,       // 既定 22050
  hopLength?: number,        // 既定 512
  voiced?: VoicedFlags | null,
  voicedProb?: Float32Array | null,
): Float32Array

// 追跡したピッチ輪郭を、音楽的なスケール（自動ピッチ補正）または固定音にスナップします。
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
  pitch.voicedFlag,   // boolean[] はそのまま渡せる
);
```

`voiced` は `f0Hz` と同じ長さである必要があります。`voiced` を省略する場合は `voicedProb` も `f0Hz` と同じ長さにします。長さが食い違うと `RangeError`（たとえば `pitchCorrectToMidiTimevarying: voiced must have the same length as f0Hz`）を投げます。`SonareError` ではないため `isSonareError` では捕捉できません。有声として扱うすべてのフレームの `f0Hz` は、有限で正の値であり、ナイキスト周波数（`sampleRate / 2`）以下である必要があります。これに違反すると呼び出しを拒否します。無声フレームでは `NaN`（または 0 以上ナイキスト周波数以下の有限値）を使えますが、有声フレームの `NaN` は無効です。

::: warning `voicedProb` が決めるのは有声判定だけ
`voicedProb` の用途は 1 つだけです。`voiced` を渡さなかったときに、フレームごとの有声／無声の判定を導くことです。`voiced` を渡した場合、`voicedProb` は完全に無視されます。両方渡しても `voicedProb` は使われないため、上の例ではフラグだけを渡しています。

特に、フレームごとの補正量をスケーリングすることは**ありません**。確率で重み付けされた緩やかなリチューンを期待して `voicedProb` を渡していた場合、実際にはそうなっておらず、聞こえる補正はその想定より**低音域で強く**なります。`voicedProb` は F0 とともに上昇するため、その想定でもっとも減衰されていたはずのフレームが低音域だからです。補正を緩めるには `retuneAmount` と `vibratoThresholdCents` を使ってください。
:::

```typescript
function noteStretch(
  samples: Float32Array,
  sampleRate: number,
  options?: {
    onsetSample?: number,    // ノートのオンセット位置（サンプル）。0 以上
    offsetSample?: number,   // ノートのオフセット位置（サンプル）
    stretchRatio?: number,   // >1 で区間を長くし、<1 で短くする
  },
): Float32Array

// ノート区間の長さを変えずに、新しいオンセット位置へ移動する
// （長さを変えてオンセットは変えない noteStretch を補完する）。
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

`Audio.noteStretch(options?)` と `Audio.noteMove(options?)` は `Audio` インスタンス上の対応メソッドです（サンプルレートはインスタンスの値を使います）。負のサンプル位置（`onsetSample`、`offsetSample`、`targetOnsetSample`）は、フィールド名を挙げた `RangeError` で拒否されます。

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
  sampleRate?: number,        // 既定: 22050
  options?: {
    pitchSemitones?: number,  // 負の値で下げる。既定 0
    formantFactor?: number,   // >1 で明るく、<1 で暗く。既定 1.0
    formantMode?: 'relative' | 'absolute', // 既定 'relative'
  },
): Float32Array
```

対応する CLI 例:

```bash
sonare pitch-correct vocal.wav --current-midi 68.7 --target-midi 69 -o corrected.wav
sonare note-stretch take.wav --onset 12000 --offset 24000 --ratio 1.25 -o held.wav
sonare voice-change vocal.wav --pitch-semitones 3 --formant-factor 1.05 -o voice.wav
```

`formantMode` は `formantFactor` を何に対して測るかを決めます。`'relative'`（既定）では、係数はピッチシフトの後にかけるワープで、フォルマントは `formantFactor * 2^(pitchSemitones / 12)` だけ動きます。`'absolute'` では、係数はピッチシフトに関係なく入力に対するフォルマントのシフト量になり（`1` ならフォルマントは元の位置のまま）、実際にかかるワープは `formantFactor / 2^(pitchSemitones / 12)` です。ワープが [0.55, 1.65] を外れる absolute の指定は、その `pitchSemitones` で到達できる `formantFactor` の範囲を示した `RangeError` になり、丸められることはありません。それ以外のモード文字列も `RangeError` です。CLI では同じ選択を `--formant-mode relative|absolute` で指定します。

```typescript
// 4 半音上げつつ、フォルマントは元の位置に残す
const out = voiceChange(vocal, 48000, { pitchSemitones: 4, formantFactor: 1, formantMode: 'absolute' });
```

`spectralEdit` の `nFft` は `[4, 262144]` の範囲の 2 の冪でなければなりません。それ以外の値は `InvalidParameter` の `SonareError`（`SpectralEditConfig: nFft must be a power of two in [4, 262144]`）になり、領域の開始・終了サンプルが負なら `RangeError` です。領域指定の例とオプションの考え方は [スペクトル編集](./spectral-editing.md) を参照してください。

`pitchCorrectTimevarying(...)` はスケールにスナップする自動ピッチ補正の経路です。スケールマスク、`mode`、リチューンの効き方の詳細は [編集 DSP](./editing-dsp.md) を参照してください。

### `normalize(samples, sampleRate, targetDb?, mode?)`

オーディオを目標レベルに正規化します。`mode` の既定値は `'peak'` で、RMS レベルを目標にする場合は `'rms'` を指定します。

```typescript
function normalize(
  samples: Float32Array,
  sampleRate: number,
  targetDb?: number,        // 既定: peak は 0、rms は -20
  mode?: 'peak' | 'rms'     // 既定: 'peak'
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

レベルはペア全体から測り、得られたゲインを**両チャンネル**にそのまま適用します。これがこの関数の要点です。チャンネルごとに別々の目標へ正規化すると、レベルではなく左右のバランスが変わり、意図したパンがセンターに寄ります。ゲインが共通なので、`appliedGainDb` はチャンネルごとのペアではなく単一の値です。`'peak'` モードでは大きい側のチャンネルが `targetDb` に達し、小さい側はその差を保ちます。`'rms'` モードで `targetDb` に合わせる量は両チャンネルのサンプルをまとめた RMS、つまりチャンネルごとの値の相加平均ではなく二乗平均平方根で、出力は `[-1, 1]` にハードクリップされます。

::: warning RMS の目標にはピークの余裕を残してください
`normalize` と `normalizeStereo` はどちらも、`targetDb` の既定値が `mode: 'peak'` では **`0`**、`mode: 'rms'` では **`-20`** です。RMS の目標に 0 dBFS を明示すると、ピークがフルスケールを超える場合があります。出力は `[-1, 1]` にハードクリップされます。目標を省略してモードの既定値を使うか、信号のピークに十分な余裕を残す RMS 目標を指定してください。
:::

チャンネル長が食い違うペアは、処理の前に `RangeError`（`'Stereo channel lengths must match.'`）を投げます。一方、**無音はエラーではありません**。中身のないペアはそのまま返り、`appliedGainDb` はちょうど `0` になります。例外も、際限のないブーストも起きません。

`validate` が制御するのは JavaScript 側の事前スキャンだけです。問題のあるサンプルの添字を含む `RangeError` を出すのはこのスキャンです。ネイティブ層はいずれにせよ再検証するため、`validate: false` で失うのは安全性ではなく詳しいエラーメッセージで、その代わりに速くなります。無効化されるのは明示的に `false` を渡した場合だけです。

### `trim(samples, sampleRate, thresholdDb?, frameLength?, hopLength?)`

オーディオの始めと終わりから無音を除去します。

```typescript
function trim(
  samples: Float32Array,
  sampleRate: number,
  thresholdDb?: number,   // 既定: -60.0
  frameLength?: number,   // 既定: 2048
  hopLength?: number      // 既定: 512
): Float32Array
```

これは `Audio` レベルの単純なしきい値トリムです。librosa 互換のフレーム RMS / `topDb` ベースの無音判定と、元音源上の開始・終了サンプル位置が必要な場合は、下の `trimSilence(...)` を使います。

## ルーム音響解析

これらの関数は、曲そのものではなく録音空間を説明・適用する API です。背景は [残響時間（RT60 と EDT）](./glossary/acoustics/reverberation-time.md)、[部屋の形状と容積](./glossary/acoustics/room-geometry.md)、[間隔を空けたレシーバーとチャンネル間コヒーレンス](./glossary/acoustics/spaced-receivers.md) を参照してください。

| 目的 | 使う API |
|------|----------|
| きれいなインパルス応答（IR）を測る | `analyzeImpulseResponse(...)` |
| 通常音声から部屋の減衰を推定する | `detectAcoustic(...)` |
| 音声から実用的な部屋モデルを推定する | `estimateRoom(...)` |
| その推定結果を `synthesizeRir` の入力にする | `roomGeometryFromEstimate(...)` |
| 寸法からモノラルのルームインパルス応答を作る | `synthesizeRir(...)` |
| 目標ルームの響きを音作り効果として足す | `roomMorph(...)` |
| 同じ響きをステレオ録音に足す（間隔をあけた 2 つのレシーバーで聞く） | `roomMorphStereo({ left, right, sampleRate, ... })` |

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
console.log(estimate.volume, estimate.lengthM, estimate.widthM, estimate.heightM);
console.log(estimate.drrDb, estimate.confidence, estimate.bandAbsorption);

// 使えない形状（例: acoustic.source_outside_room）は、コード付きの SonareError を投げる
const rir = synthesizeRir({ lengthM: 7, widthM: 5, heightM: 3, absorption: 0.2, materialPreset: 'none' });
console.log(rir.sampleRate, rir.rir.length, rir.diagnostics);

// 推定結果は synthesizeRir と同じ名前を使っているので、ヘルパーは推定した部屋に縮尺した配置を足し、source と listener で上書きできる
const geometry = roomGeometryFromEstimate(estimate, {
  source: { x: 1, y: 1, z: 1.2 },
  listener: { x: 2, y: 1.5, z: 1.5 },
});
const resynth = synthesizeRir({ ...geometry, sampleRate });

const morphed = roomMorph(samples, sampleRate, { lengthM: 12, widthM: 9, heightM: 4, wet: 0.6 });
```

`analyzeImpulseResponse(samples, sampleRate?, nOctaveBands?, minDecayDb?)` の `minDecayDb` は減衰フィットのしきい値で、既定値は `30` です。

`materialPreset`（`'none' | 'concrete' | 'wood' | 'curtain' | 'carpet' | 'glass'`、型は `MaterialPresetName`）と `estimateRoom` の `mode` オプション（`'auto' | 'blind' | 'impulse_response'`、型は `AcousticModeName`）は名前だけを受け付けます。数値は `TypeError`、未知の名前は `RangeError` です。`roomGeometryFromEstimate(estimate, { source?, listener? })` は `RoomPlacement`（メートル単位の `{ x, y, z }`）の位置を受け取り、`RoomGeometryOptions` を返します。既定の配置を推定した部屋へ縮尺した位置が入り（渡した位置はそれを置き換えます）、`absorption` は有限なバンドの平均です。計測できる寸法がない推定結果には `RangeError` を投げます。

RT60、EDT、C50、C80、D50、バンド別配列、ルーム推定、生成 RIR、信頼度の読み方は [ルーム音響解析](./acoustic-analysis.md) を参照してください。
