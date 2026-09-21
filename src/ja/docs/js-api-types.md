---
title: JavaScript/TypeScript 型とエラー
description: libsonare JavaScript/TypeScript パッケージの型定義、列挙型、エラーハンドリング、型エクスポート索引のリファレンスです。
---

# JavaScript/TypeScript 型とエラー

## 型定義

### AnalysisResult

```typescript
interface AnalysisResult {
  bpm: number;
  bpmConfidence: number;
  bpmCandidates: BpmHypothesis[];           // 上位から順に並んだ候補
  key: Key;
  timeSignature: TimeSignature;
  timeSignatureCandidates: TimeSignature[]; // 上位から順に並んだ候補
  beatTimes: Float32Array;  // beats[].time のコピー。librosa 互換コードで便利
  beats: Beat[];            // 各拍の強度を含むオブジェクト配列
  downbeatIndices: number[];        // 小節頭にあたる beats[] の添字
  downbeatPhase: number;            // 最初の小節が始まるビート番号
  beatObservations: BeatObservations;  // beats[] と並行する拍ごとの根拠
  beatLocalBpm: number[];           // 拍ごとの平滑化された局所テンポ。オプトイン
  chords: Chord[];
  sections: Section[];
  timbre: Timbre;
  dynamics: Dynamics;
  rhythm: RhythmFeatures;
  melody: MelodyContour;
  form: string;  // 例: "IABABCO"
}

interface BpmHypothesis {
  value: number;
  confidence: number;
  /** 報告された `bpm` との関係 */
  relation: 'primary' | 'half' | 'double' | 'other';
}

// 小節頭と拍子の判断の根拠となる拍レベルの観測値。
// 3 本の並行した系列を持つ 1 つのオブジェクトで、各系列は beats の各要素に 1 値を持つ。
interface BeatObservations {
  onsetStrength: number[];       // 拍近傍で窓集約したオンセット強度
  lowFrequencyEnergy: number[];  // 拍近傍の低域エネルギー
  chordChange: number[];         // 拍ごとのコード変化の根拠
}
```

`downbeatIndices` は `beats` と並行するのではなく、`beats` を**添字で参照します**。`beats` より
短く、`beats[downbeatIndices[k]]` が k 番目の小節頭です。ある拍が小節頭かどうかは、拍ごとの
フラグを読むのではなく、このリストに含まれるかどうかで判定してください。`downbeatPhase` は
拍子推定器が出した位相、つまり最初の小節が始まるビート番号で、値域は
`[0, timeSignature.numerator)` です。したがって `downbeatIndices` は通常この値から始まります。
コードや低域の根拠に基づいて小節頭が精緻化されたあとに再計算されるわけではないため、両者が
食い違うことは正当に起こりえます。リストが結果、位相は出発点の推測です。

アクセントの根拠が置かれているのは `beatObservations` で、3 本の系列はいずれも `beats` と並行
します。系列が**空**であることは、解析がそれを生成できなかったという意味であり、全拍のスコアが
0 だったという意味ではありません。`lowFrequencyEnergy` はオーディオなしで解析を走らせた場合に
空になり、`chordChange` はコード解析が済むまで空です。添字でアクセスする前に長さを確認して
ください。

`beatLocalBpm` は拍ごとの平滑化された局所テンポで、`beats` と並行し、単位は BPM です。
**`computeTempoCurve` で明示的に要求しない限り空**であり、検出された拍が 2 未満の場合は指定の
有無にかかわらず空になります。最後の要素は、最終拍へ至る区間のテンポを繰り返した値です。
これは `bpm` をリサンプルしたものではなく本物の局所テンポです。つまり、固定されたビート
グリッドからデコードされたカーブはそのグリッドを記述するので、実際に動くテンポを測りたい
場合は `adaptiveTempo` も併せて指定してください。

`bpm` と `timeSignature` は勝ち残った値で、2 つの `*Candidates` 配列はその背後にある
順位付きの候補群です。テンポは本質的に曖昧で、ハーフタイム感とその倍テンポは同じ曲の
どちらも妥当な読み方になり得ます。1 つの数字だけを見せて祈るのではなく、代替案を提示できます。

```typescript
const { bpm, bpmCandidates } = analyze({ samples, sampleRate });
const halfTime = bpmCandidates.find((c) => c.relation === 'half');
if (halfTime && halfTime.confidence > 0.4) {
  offerAlternative(halfTime.value);   // 「84 BPM かもしれません」
}
```

同じ配列は C ABI・Node・Python にもあります。

### Beat

```typescript
interface Beat {
  time: number;      // 秒
  strength: number;  // その拍のフレームにおけるオンセット包絡の生値。上限なし
}
```

::: warning `strength` はサリエンススコアではない
`strength` は、その拍のフレームで取り出した**オンセット包絡の生の 1 フレーム**です。正規化
されておらず、相対値でもなく、`0..1` に収まる保証もありません。スケールは素材に依存するため、
同じ数値でも曲が違えば意味が違います。また窓ではなく 1 フレームであるため、拍位置のわずかな
揺れにも追随して動きます。

アクセントのスコア付け、つまりどの拍が強いかの判定には
`AnalysisResult.beatObservations.onsetStrength` を使ってください。これはライブラリ自身の小節頭
推定が評価している窓集約値です。`Beat.strength` を使うのは、その瞬間の包絡値そのものが本当に
欲しいときだけにしてください。
:::

### Chord

```typescript
interface Chord {
  root: PitchClass;
  bass: PitchClass;     // 転回形のベース音
  rootName: string;     // コアの正規表記。全バインディングで共通
  bassName: string;     // コアの正規表記。全バインディングで共通
  quality: ChordQuality;
  start: number;       // 秒
  end: number;         // 秒
  duration: number;    // 秒。end - start から導出
  confidence: number;
  name: string;        // "C", "Am", "G7"
}
```

`duration` は `end - start` から導出された値です。コアが保持しているのは 2 つの端点だけなので、
独立した測定値ではなく利便のためのフィールドです。進行から経過的なコードを除外するといった
処理は、引き算を書くよりこのフィールドで書くほうが読みやすくなります。

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

### RoomMorphResult

`roomMorph(...)` は、モーフ後の音声と、目標ルームの合成がそれを作るために何を変更したかをあわせて返します。

```typescript
interface RoomMorphResult {
  audio: Float32Array;           // 入力の長さ + 目標ルームの残響テイル
  sampleRate: number;
  diagnostics: RirDiagnostic[];  // 合成が報告した診断情報すべて、報告順
}

interface RirDiagnostic {
  code: string;       // 安定した ID。例: 'acoustic.rir_length_clamped'
  message: string;
  severity: 'info' | 'warning' | 'error';
}
```

生成できないモーフは例外になるため、ここに `hasError`／`errorMessage` の組はなく、`diagnostics` に入るのはすべて「結果は得られたが注意が要る」警告です。分岐は `code` で行ってください。`acoustic.ism_order_clamped`（鏡像音源の次数が安全上限まで下げられた）、`acoustic.rir_length_clamped`（テイルが `maxSeconds` で切られた）、`acoustic.no_late_tail`（拡散テイルが生成されなかった）はいずれも「指定したのとは別の部屋を通った」ことを意味しますが、音声そのものからは分かりません。`synthesizeRir(...)` も同じ形を `RirResult.diagnostics` で報告します。C ABI も同じ項目を構造化して公開しており — `sonare_last_diagnostic_count()`、`sonare_last_diagnostic_code(i)`、`sonare_last_diagnostic_message(i)`、`sonare_last_diagnostic_severity(i)` — そちらでも、連結済みの `sonare_last_warning_message()` 文字列を解析するのではなくコードで分岐できます。

### MasteringChainConfig

`masteringChain*` と `StreamingMasteringChain` は下のネスト構造の設定スキーマを使います。
各キーは任意で、指定されたステージだけが下の固定順で有効になります。加えて、下に挙げる各ステージオブジェクト（`denoise` のオブジェクト形式、`tilt`、`compressor`、`loudness` など）はいずれも `enabled?: boolean` を受け付け、そのステージを明示的に切り替えられます。一覧では繰り返しを避けるため省いています。`"dynamics.compressor.thresholdDb"` のようなフラットなドット記法のキーも同じオブジェクトで受け付けられ、そのままコアへ渡されます。

<FlowDiagram
  title="マスタリングチェーンの順序"
  :nodes="[
    { id: 'repair', label: 'リペア', col: 0, row: 0, variant: 'accent' },
    { id: 'eq', label: 'EQ', col: 1, row: 0 },
    { id: 'dynamics', label: 'ダイナミクス', col: 2, row: 0 },
    { id: 'saturation', label: 'サチュレーション', col: 3, row: 0 },
    { id: 'spectral', label: 'スペクトル', col: 4, row: 0 },
    { id: 'stereo', label: 'ステレオ', col: 5, row: 0 },
    { id: 'maximizer', label: 'マキシマイザー', col: 6, row: 0 },
    { id: 'loudness', label: 'ラウドネス', col: 7, row: 0, variant: 'success' }
  ]"
  :edges="[
    { from: 'repair', to: 'eq' },
    { from: 'eq', to: 'dynamics' },
    { from: 'dynamics', to: 'saturation' },
    { from: 'saturation', to: 'spectral' },
    { from: 'spectral', to: 'stereo' },
    { from: 'stereo', to: 'maximizer' },
    { from: 'maximizer', to: 'loudness' }
  ]"
  caption="有効化したステージだけが処理されますが、有効なステージは常にこの順で実行されます。"
/>

`masterAudio*` はプリセットから開始し、同じキー名を
`"dynamics.compressor.thresholdDb"` のようなフラットなドット記法の
`overrides`（上書き値）として受け取ります。

`maximizer.truePeakLimiter.releaseMs` はポストリミッターのリリース時間です。省略するとプリセット／設定の既定値 50 ms を保ちます。フラットな上書き値として渡した場合、その値がそのまま適用されます。`maximizer.truePeakLimiter.applyGainAtInputRate` を有効にすると、静的なラウドネスゲインをオーバーサンプリング前の入力サンプルレートで適用します。ホスト間でゲイン段の位置を揃えたい場合に使います。

`repair.denoise.reductionDb`（フラットな `repair.reductionDb` エイリアスからも同じフィールドに到達できます）は、ゲインマスクが各ビンに適用できる最大の減衰量を dB で指定するもので、既定値は 26 です。以前の `gainFloor`（dB の深さではなく線形の下限値）という表記も引き続き受け付けられ、変換されます（`dB = -20*log10(gainFloor)`）。この変換は旧来の有効範囲も引き継ぐため、1 を超える下限値は負の深さになり、同様に拒否されます。

::: details インターフェース全文（クリックで展開）

```typescript
interface MasteringChainConfig {
  repair?: {
    denoise?: boolean | { mode?: number; noiseEstimator?: number; nFft?: number;
                          hopLength?: number; ddAlpha?: number; reductionDb?: number;
                          gainFloor?: number; overSubtraction?: number;
                          spectralFloor?: number; noiseEstimationQuantile?: number;
                          speechPresenceGain?: boolean; gainSmoothing?: boolean; };
    nFft?: number; hopLength?: number; ddAlpha?: number; reductionDb?: number;
    /** @deprecated `denoise.reductionDb` を使用してください（`dB = -20*log10(gainFloor)` で変換） */
    gainFloor?: number;
    declip?: { clipThreshold?: number; lpcOrder?: number; iterations?: number; lpcBlend?: number; };
    decrackle?: { threshold?: number; levels?: number;
                  /** 0 = メディアン、1 = ウェーブレット縮小 */
                  mode?: number; };
    dehum?: { fundamentalHz?: number; harmonics?: number; q?: number; adaptive?: boolean;
              searchRangeHz?: number; adaptation?: number; frameSize?: number;
              pllBandwidth?: number; mode?: number; };
    declick?: { threshold?: number; neighborRatio?: number; maxClickSamples?: number;
                lpcOrder?: number; residualRatio?: number; };
    dereverb?: { threshold?: number; attenuation?: number; nFft?: number; hopLength?: number;
                 t60Sec?: number; lateDelayMs?: number; overSubtraction?: number;
                 spectralFloor?: number; wpeEnabled?: boolean; wpeIterations?: number;
                 wpeTaps?: number; wpeStrength?: number; };
  };
  eq?: {
    /** 正規のネストされた tilt ステージ */
    tilt?: { tiltDb?: number; pivotHz?: number };
    /** @deprecated `eq.tilt.tiltDb` を使用してください */
    tiltDb?: number;
    /** @deprecated `eq.tilt.pivotHz` を使用してください */
    pivotHz?: number;
  };
  dynamics?: {
    compressor?: { thresholdDb?: number; ratio?: number; attackMs?: number; releaseMs?: number;
                   kneeDb?: number; makeupGainDb?: number; autoMakeup?: boolean; };
    deesser?: { frequencyHz?: number; thresholdDb?: number; ratio?: number; attackMs?: number;
                releaseMs?: number; rangeDb?: number; bandpassQ?: number; };
    transientShaper?: { attackGainDb?: number; sustainGainDb?: number; fastAttackMs?: number;
                        fastReleaseMs?: number; slowAttackMs?: number; slowReleaseMs?: number;
                        sensitivity?: number; maxGainDb?: number; gainSmoothingMs?: number;
                        lookaheadMs?: number; };
    multibandComp?: { lowCutoffHz?: number; highCutoffHz?: number;
                      lowThresholdDb?: number;  lowRatio?: number;
                      lowAttackMs?: number;     lowReleaseMs?: number;
                      midThresholdDb?: number;  midRatio?: number;
                      midAttackMs?: number;     midReleaseMs?: number;
                      highThresholdDb?: number; highRatio?: number;
                      highAttackMs?: number;    highReleaseMs?: number; };
  };
  saturation?: {
    tape?: { driveDb?: number; saturation?: number; hysteresis?: number; outputGainDb?: number;
             speedIps?: number; headBumpDb?: number; bias?: number; gapLoss?: number;
             oversampleFactor?: number; };
    exciter?: { frequencyHz?: number; driveDb?: number; amount?: number; q?: number;
                evenOddMix?: number; aliasing?: number; };
  };
  spectral?: {
    airBand?: { amount?: number; shelfFrequencyHz?: number;
                dynamicThresholdDb?: number; dynamicRangeDb?: number; };
  };
  stereo?: {
    imager?: { width?: number; outputGainDb?: number; decorrelationAmount?: number;
               preserveEnergy?: boolean; };
    monoMaker?: { amount?: number; frequencyHz?: number };
  };
  maximizer?: {
    truePeakLimiter?: { ceilingDb?: number; lookaheadMs?: number; releaseMs?: number;
                        oversampleFactor?: number; applyGainAtInputRate?: boolean; };
  };
  loudness?: { targetLufs?: number; ceilingDb?: number; truePeakOversample?: number;
               releaseMs?: number; applyGainAtInputRate?: boolean;
               maxLimiterGainReductionDb?: number; };
  /** ネスト形式と並行して、フラットなドット記法のキーも受け付ける */
  [flatKey: `${string}.${string}`]: number | boolean | undefined;
}

interface MasteringResult {              // masteringProcess、masteringPairProcess
  samples: Float32Array;
  sampleRate: number;
  inputLufs: number;
  outputLufs: number;
  appliedGainDb: number;
  loudnessTargetLimited?: boolean;
  latencySamples?: number;
  nonFiniteSubstitutionCount: number;    // リミッターが有限値に置き換えたサンプル数
}
interface MasteringChainResult {         // masteringChain / masterAudio（および WithProgress）
  samples: Float32Array;                 // レイテンシ補正済み。latencySamples はない
  sampleRate: number;
  inputLufs: number;
  outputLufs: number;
  appliedGainDb: number;
  stages: string[];
  outputTruePeakDbtp: number;
  outputLra: number;
  loudnessTargetLimited: boolean;
  nonFiniteSubstitutionCount: number;
  stageGainReductions: StageGainReduction[];
  report: MasteringReport;
}
interface MasteringStereoResult {        // masteringProcessStereo
  left: Float32Array;
  right: Float32Array;
  sampleRate: number;
  inputLufs: number;
  outputLufs: number;
  appliedGainDb: number;
  latencySamples: number;
  loudnessTargetLimited: boolean;
  nonFiniteSubstitutionCount: number;
}
// masteringChainStereo / masterAudioStereo（および WithProgress）の戻り値。
// MasteringChainResult の samples を left/right に置き換えた形。MasteringStereoChainResult は
// Node/Python バインディングとのソース互換性のために残された @deprecated エイリアス。
interface MasteringChainStereoResult {
  left: Float32Array;
  right: Float32Array;
  sampleRate: number;
  inputLufs: number;
  outputLufs: number;
  appliedGainDb: number;
  stages: string[];
  outputTruePeakDbtp: number;
  outputLra: number;
  loudnessTargetLimited: boolean;
  nonFiniteSubstitutionCount: number;
  stageGainReductions: StageGainReduction[];
  report: MasteringReport;
}
```

:::

各ステージの使いどころは用語集の各ページに対応しています:
[リペア](./glossary/mastering/repair.md)、
[トーンと Air](./glossary/mastering/tone-air.md)、
[ダイナミクス](./glossary/mastering/dynamics.md)、
[ステレオ・リミッター・ラウドネス](./glossary/mastering/stereo-limiter-loudness.md)。

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
  HalfDim7: 13, Major9: 14, Dominant9: 15, Sus2Add4: 16,
  Major6: 17, Minor6: 18, MinorMajor7: 19, Dominant7Sus4: 20,
  Dominant11: 21, Dominant13: 22,
  Dominant7Flat9: 23, Dominant7Sharp9: 24
} as const;
```

::: warning 6th・`m7b5`・`7sus4` は既存のコードのアナグラム
このうち 3 つは、すでに enum にあるコードを移調したものと、構成音の集合が完全に一致します。

- `maj6` は短 3 度下の `m7` と同じ構成音（`C6` = `Am7`）
- `min6` は短 3 度下の `m7b5` と同じ構成音（`Cm6` = `Am7b5`）
- `7sus4` は完全 4 度下の `sus2add4` と同じ構成音（`C7sus4` = `Gsus2add4`）

クロマグラムにはこれらを区別する材料がありません。2 つの読み方は同一の 12 次元ベクトルだから
です。そのため検出器は既存の読み方を既定として維持し、**ベース**が裏付けたときにだけ 6th へ
昇格させます。演奏者が `C6` と書くような箇所は、ベースが C にない限りたいてい `Am7` として
報告されます。`Major6` と `Minor6` は、和声だけから検出器が行う訂正ではなく、ベースについての
根拠として扱ってください。
:::

### SectionType

```typescript
const SectionType = {
  Intro: 0, Verse: 1, PreChorus: 2, Chorus: 3,
  Bridge: 4, Instrumental: 5, Outro: 6, Unknown: 7
} as const;
```

## エラーハンドリング

モジュールが未初期化の場合、すべての関数はエラーをスローします。まず `await init()` を呼んでください。

ネイティブ（C++）側の失敗は、構造化された **`SonareError`** としてスローされます。`Error` のサブクラスで、C ABI のエラー enum をそのまま映した数値の `code` と正準名 `codeName` を持つため、メッセージ文字列の照合ではなく原因コードで分岐できます。同じ失敗はどのバインディング（WASM / Node ネイティブ / Python / C ABI）でも同じ数値コードを報告します。パッケージは `ErrorCode` enum、`SonareError` クラス、型ガード `isSonareError(value)` をエクスポートします。

各 facade は非有限数、不正な enum／インデックス値、過大なリソースを DSP やシリアライズへ渡す前に一貫して拒否します。これらは入力不正として扱い、バインディングが暗黙にクランプしたり不正値を受理したりすることへ依存しないでください。

```typescript
import { ErrorCode, isSonareError, Mixer } from '@libraz/libsonare';

try {
  const mixer = Mixer.fromSceneJson(sceneJson, 48000, 512);
} catch (error) {
  if (isSonareError(error) && error.code === ErrorCode.InvalidState) {
    // 'failed to build mixer from scene JSON: send timing must be a string ("pre" or "post")'
    console.error(`scene rejected: ${error.codeName}: ${error.message}`);
  } else {
    throw error;
  }
}
```

`Mixer.fromSceneJson` は、フィールド値が拒否された場合も JSON 自体が壊れている場合も、シーンの
構築に失敗するあらゆる経路で `InvalidParameter` ではなく **`InvalidState`** を報告します。構築が
ラップされているため、本来の原因は独立したコードではなく
`failed to build mixer from scene JSON: <内側のメッセージ>` の末尾として届きます。
`InvalidState` で分岐し、どのフィールドが問題かはメッセージを表示して特定してください。

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
| `Unknown` | `99` |

このコードは Python の `SonareError.code` および C ABI の `SonareError` enum と一致し、Python CLI は同じコードを[終了コード](./cli.md#終了コード)へ対応付けます。

## 型エクスポート索引

WASM パッケージは、関数やクラスに加えて TypeScript の補助型もエクスポートしています。オプション、リアルタイムバッファ、コールバックのペイロードを型付けするときは、アプリ側で再定義せずこれらを使えます。

| 分野 | エクスポートされる型／定数 |
|------|----------------------|
| 環境とエンジン | `EXPECTED_ENGINE_ABI_VERSION`, `EXPECTED_PROJECT_ABI_VERSION`, `EngineCapabilities`, `ProgressCallback` |
| エンジンのレーンミキサー、マーカー、MIDI クリップ | `EngineTrackLane`, `EngineTrackSend`, `EngineBus`, `EngineMarker`, `EngineMidiClipSchedule`, `EngineMidiEvent`, `ExternalMidiEvent`, `MarkerKind`, `ProjectMarker` |
| キー／コード／リズム／音色解析 | `ChordDetectionOptions`, `KeyProfileName`, `RhythmAnalysisResult`, `TimbreAnalysisResult`, `TimbreFrame`, `DynamicsAnalysisResult` |
| スペクトル／ピッチ／特徴量変換 | `MelPowerResult`, `StftPowerResult`, `PitchCorrectOptions`, `VoicedFlags`, `SpectralRegionOp`, `SpectralEditOptions`, `TempogramMode` |
| ページ式クリップストリーミング | `ClipPageStreamerEngine`, `ClipPageStreamerOptions`, `ClipPageStreamSource`, `OpfsClipStream`, `OpfsClipStreamOptions`, `OpfsClipPageProviderOptions` |
| マスタリング | `MasteringProcessorParams`, `MasteringProcessorCatalogEntry`, `MasteringInsertParamInfo`, `MasteringChannelPolicy`, `MasteringChainStereoResult`, `MasteringStereoParamsRequest`, `MasteringStreamingPreviewStereoRequest` |
| メータリングのリクエスト | `MeteringStereoRequest`, `MeteringStereoDecimatedRequest` |
| ストリーミングリチューン | `StreamingRetuneConfig` |
| ストリーミング EQ | `StreamingEqualizerConfig`, `EqBandType`, `EqBandPhase`, `EqCoeffMode`, `EqMatchOptions`, `EqStereoPlacement` |
| リアルタイム音声 | `VoicePresetId`, `RealtimeVoiceChangerConfigInput`, `RealtimeVoiceChangerPodConfig`, `RealtimeVoiceChangerMonoBuffer`, `RealtimeVoiceChangerInterleavedBuffer`, `RealtimeVoiceChangerPlanarBuffer` |
| ミキシング／Worklet 用リアルタイムバッファ | `MixerRealtimeBuffer`, `SonareScopeRingBuffer`, `SonareScopeRingReadResult`, `SonareWorkletScopeSnapshot` |
| プロジェクト／エンジンのオートメーション | `ProjectAssistSidecar`, `ProjectAssistSidecarInput`, `ProjectAutomationTargetKind`, `EngineTrackMonitorMode`, `TrackMonitorMode` |
| パン則の入力 | `PanLaw`, `PanLawName`, `PanLawInput` |

`SurroundPan`（`Mixer.setSurroundPan` のパラメータ型）はパッケージの公開エクスポート一覧に含まれていません。インポートせず、インラインまたはローカルなエイリアスとして型付けしてください。

### リテラルユニオン型と enum 相当のテーブル

以下のエクスポートされた文字列リテラルのユニオン型は、フィールドや呼び出しが受け付ける値を列挙したものです。シンセ系の語彙はいずれも値の序数も受け付け、`synthEnumTables()` はランタイムからシンセの全テーブルを `string[]` として返します（`SynthEnumTables`）。

| 型 | 値 | 現れる場所 |
|----|----|-----------|
| `SynthEngineMode` | `'default'`, `'subtractive'`, `'fm'`, `'karplus-strong'`, `'modal'`, `'additive'`, `'percussion'`, `'piano'`, `'pipe-organ'`, `'bowed-string'`, `'reed'`, `'brass'`, `'flute'`, `'plucked-string'`, `'vocal'`, `'free-reed'`, `'harpsichord'`, `'sample'` | `SynthPatch.engineMode`。`'fm'`・`'modal'`・`'percussion'`・`'sample'` は対応するセクションを渡すまで無音 |
| `SynthOscWaveform` | `'default'`, `'sine'`, `'saw'`, `'square'`, `'triangle'`, `'noise'` | `SynthPatch.waveform` |
| `SynthFilterModel` | `'default'`, `'svf'`, `'moog-ladder'`, `'diode-ladder'`, `'sallen-key'` | `SynthPatch.filterModel` |
| `SynthFilterOutput` | `'default'`, `'lowpass'`, `'bandpass'`, `'highpass'` | `SynthPatch.filterOutput`（SVF のみ） |
| `SynthBodyType` | `'default'`, `'none'`, `'guitar'`, `'violin'`, `'wood-tube'`, `'brass-bell'`, `'vocal'` | `SynthPatch.body` |
| `SynthModSource` | `'none'`, `'amp-env'`, `'filter-env'`, `'lfo1'`, `'lfo2'`, `'velocity'`, `'key-track'`, `'mod-wheel'`, `'random'`, `'breath'`, `'aftertouch'`, `'expression-cc'`, `'pitch-bend'` | `SynthModRouting.source` |
| `SynthModDestination` | `'none'`, `'pitch-cents'`, `'cutoff-cents'`, `'amp-gain'`, `'pan-units'`, `'resonance-q'`, `'vibrato-depth-cents'`, `'filter-env-depth'`, `'lfo1-rate-scale'`, `'excitation-force'`, `'excitation-position'`, `'excitation-brightness'`, `'spectrum-morph'` | `SynthModRouting.destination` |
| `SampleLoopMode` / `SampleKeyTrack` | `'default'`, `'none'`, `'continuous'`, `'key-down'` / `'default'`, `'on'`, `'off'` | `SynthPatch.sampleLoop` / `SynthPatch.sampleKeyTrack` |
| `SampleDescLoopMode` | `'none'`, `'continuous'`, `'key-down'` | `SampleDesc.loopMode` — 録音自体のループモードで、`SampleLoopMode` とは別の集合 |
| `BuiltinSynthWaveform` | `'sine'`, `'saw'`, `'sawtooth'`, `'square'`, `'triangle'`, または `0`〜`3` | `BuiltinSynthConfig.waveform` |
| `ControllerInput` / `ControllerAxis` | `'control-change'`, `'channel-pressure'`, `'poly-pressure'`, `'pitch-bend'`, `'velocity'` / `'none'`, `'excitation'`, `'position'`, `'brightness'`, `'morph'`, `'loudness'`, `'pitch-cents'`, `'vibrato-depth'` | `RealtimeEngine.bindController` に渡す `ControllerBinding.input` / `.axis` |
| `Articulation` | `'poly'`, `'mono-retrigger'`, `'mono-legato'` | `RealtimeEngine.setArticulation` |
| `MpeDimension` / `NoteTracking` | `'bend'`, `'pressure'`, `'timbre'` / `'last'`, `'lowest'`, `'highest'`, `'all'` | `RealtimeEngine.setControllerNoteTracking` |
| `SourceBackend` | `'sf2'`, `'synth'` | `Project.soundFontManifest` が返す `Sf2ProgramStatus.backend` |
| `EngineCaptureSource` | `'output'`, `'input'`, または序数 | `RealtimeEngine.setCaptureSource` |
| `ProjectTrackKind` | `'audio'`, `'midi'`, `'aux'`, または `0`〜`2` | `Project.addTrack`、`Project.setTrackKind` |
| `ProjectLoopMode` | `'off'`, `'loop'`, または `0`〜`1` | `Project.setClipLoop` |
| `ProjectFadeCurve` | `'linear'`, `'equal-power'`（`'equal_power'`・`'equalPower'`・`'equalpower'` も可）, `'exponential'`/`'exp'`, `'logarithmic'`/`'log'`, または `0`〜`2` | `Project.setClipFade` に渡す `ProjectClipFade.curve` |
| `MasteringProcessorCategory` | `'dynamics'`, `'effects'`, `'eq'`, `'final'`, `'maximizer'`, `'multiband'`, `'other'`, `'reference'`, `'repair'`, `'saturation'`, `'spectral'`, `'stereo'` | `masteringProcessorCatalog()` が返す `MasteringProcessorCatalogEntry.category` |
| `MasteringRealtimeCost` | `'low'`, `'moderate'`, `'high'` | `MasteringProcessorCatalogEntry.realtimeCost`（未評価のときは `null`） |
| `PairProcessor` | `'match.applyMatchEq'`, `'match.alignReferenceToSource'`, `'match.abSwitch'`, `'match.abCrossfade'` | `masteringPairProcess` の `processorName`。`masteringPairProcessorNames()` で一覧できる |
| `PairAnalysis` | `'match.referenceLoudness'`, `'match.tonalBalance'`, `'match.tonalBalanceLogBands'`, `'match.matchEqCurve'`, `'match.estimateReferenceDelaySamples'` | `masteringPairAnalyze` の `analysisName`。`masteringPairAnalysisNames()` で一覧できる |
| `StereoAnalysis` | `'stereo.monoCompatCheck'`, `'stereo.monoCompatCheckLogBands'` | `masteringStereoAnalyze` の `analysisName`。`masteringStereoAnalysisNames()` で一覧できる |
| `DehumMode` | `'subtract'`, `'notch'` | `masteringRepairDehum` の `mode` |
| `MixAnalysisBand` | `'sub'`, `'low'`, `'lowMid'`, `'mid'`, `'highMid'`, `'high'`, `'air'` | `MixBandOccupancy` のキー。ミックスアシスタントの解析における `MixCrowdedBand.band` |
| `SpectralEditMode` / `SpectralEditWindow` | `'gain'`, `'attenuate'`, `'mute'`, `'heal'` / `'hann'`, `'hamming'`, `'blackman'`, `'rectangular'`, `'rect'` | `spectralEdit` に渡す `SpectralRegionOp.mode` / `SpectralEditOptions.window` |
| `NoteTargetUnmatchedPolicy` | `'leave'`（既定）, `'mute'`, `'nearest'` | `assignNoteTargets` の `unmatchedPolicy` |
