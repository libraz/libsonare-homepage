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
