---
title: Node.js ネイティブ 型定義
description: '@libraz/libsonare-native パッケージの TypeScript 型定義とエクスポートされる型の一覧です。'
---

# Node.js ネイティブ 型定義

このページは `@libraz/libsonare-native` パッケージの TypeScript インターフェース、ユニオン型、エクスポートされる型名を一覧します。これらを使う関数やクラスについては [Node.js ネイティブ API](./node-api.md) と [Node.js ネイティブ 解析・エフェクト API](./node-api-analysis.md) を参照してください。

## 型定義

```typescript
interface Key {
  root: number;        // ピッチクラス番号 0..11（C = 0）。WASM、Python と同じ
  mode: KeyMode;       // 'major' | 'minor' | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian' | 'locrian'
  confidence: number;  // detectKey: ソフトマックスの取り分 [0, 1)。analyze(): コードで補正した値で、最大 1
  name: string;        // "C major"、"A minor" など
  shortName: string;   // "C"、"Am" など
}

interface KeyDetection extends Key {
  tuning: number; // クロマに使用した半音単位の偏差（指定値または測定値）
}

interface TimeSignature {
  numerator: number;
  denominator: number;
  confidence: number;  // MeterEstimate.timeSignature では次点との差、
                       // MeterEstimate.candidates[] では支持総和に占める割合
}

interface BpmHypothesis {
  value: number;
  confidence: number;
  relation: 'primary' | 'half' | 'double' | 'other';
}

// detectChords(...) が返すコード。root／bass／quality は文字列ラベルで、
// rootName／bassName にはすべての言語バインディングで共通の正規表記が入ります。
// quality のユニオンはバインディング側の表記です（C++ の enum は同じ 25 種類を
// 別の名前で呼びます）。
interface Chord {
  root: string;
  bass: string;
  rootName: string;
  bassName: string;
  quality:
    | 'major' | 'minor' | 'diminished' | 'augmented'
    | 'dominant7' | 'major7' | 'minor7'
    | 'sus2' | 'sus4' | 'add9' | 'minorAdd9'
    | 'dim7' | 'halfDim7'
    | 'major9' | 'dominant9' | 'sus2Add4'
    | 'major6' | 'minor6' | 'minorMajor7' | 'dominant7Sus4'
    | 'dominant11' | 'dominant13' | 'dominant7Flat9' | 'dominant7Sharp9'
    | 'unknown';
  name: string;        // 正規のコードシンボル。例: "Cmaj7"、"Am/C"、"N.C."
  start: number;       // 秒
  end: number;         // 秒
  duration: number;    // 秒（end - start）
  confidence: number;
}

interface ChordAnalysisResult {
  chords: Chord[];
  tuning: number; // クロマに使用した半音単位の偏差（指定値または測定値）
}

type ChordFunction = 'tonic' | 'subdominant' | 'dominant' | 'chromatic' | 'none';

// 時刻付きコードに、キー内での位置を加えたもの。chordFunctionalAnalysis(...) と chordFunctions(...) が返す。
type FunctionalChord<T = Chord> = T & {
  roman: string;            // 'I'、'V7'。コードが不明なら 'N.C.'
  function: ChordFunction;
};

// chordFunctions(...) が読むキー。detectKey の結果をそのまま渡せる。
interface ChordFunctionsKey {
  root: string | number;    // ピッチクラス名または数値
  mode: KeyMode | number;   // モード名または Mode の序数
}

// 0=Intro、1=Verse、2=PreChorus、3=Chorus、4=Bridge、5=Instrumental、
// 6=Outro、7=Unknown。
type SectionTypeOrdinal = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

// analyzeSections(...) が返すセクション。
interface Section {
  type: SectionTypeOrdinal;
  name: string;        // 可読名。例: "Chorus"
  start: number;       // 秒
  end: number;         // 秒
  energyLevel: number; // 相対エネルギー。[0, 1]
  confidence: number;  // [0, 1]
}

// AnalysisResult の中のコード。上記のスタンドアロン Chord とは異なり、
// root と bass はピッチクラスの序数（0..11、C = 0）、quality は ChordQuality の
// 序数です。可読なシンボルはどちらでも `name` に入ります。
interface AnalysisChord {
  root: number;
  bass: number;
  quality: number;
  start: number;
  end: number;
  confidence: number;
  name: string;        // 例: "Cmaj7"
  romanNumeral: string; // AnalysisResult.key に対するローマ数字。N.C. は空文字列
}

// AnalysisResult の中のセクション。フィールドは Section と同じです。
interface AnalysisSection {
  type: SectionTypeOrdinal;
  start: number;
  end: number;
  energyLevel: number;
  confidence: number;
  name: string;
}

interface AnalysisBeat {
  time: number;        // 秒
  strength: number;    // このビートに最も近いオンセット包絡線の生の値（上限なし）
}

// ダウンビートと拍子の判定が採点しているビート単位の根拠。判定の結果ではなく
// 入力です。各系列は beats と並行し、ビート 1 つにつき 1 値。空の系列は、すべての
// ビートが 0 だったのではなく、解析がその系列を作れなかったことを意味します。
interface BeatObservations {
  onsetStrength: number[];       // 各ビート周辺で窓をかけたオンセットの集約値
  lowFrequencyEnergy: number[];  // 音声なしで解析した場合は空
  chordChange: number[];         // コード解析が走るまでは空
}

interface AnalysisResult {
  bpm: number;
  bpmConfidence: number;
  bpmCandidates: BpmHypothesis[];
  key: Key;
  timeSignature: TimeSignature;
  timeSignatureCandidates: TimeSignature[];
  beatTimes: Float32Array;                       // beats[].time から導出
  beats: AnalysisBeat[];
  beatObservations: BeatObservations;            // ビート単位の根拠
  beatLocalBpm: number[];                        // computeTempoCurve を有効にしない限り空
  downbeatIndices: number[];                     // beats への添字
  downbeatPhase: number;                         // 最初の小節が始まるビートの添字
  chords: AnalysisChord[];                       // 検出したコード進行
  sections: AnalysisSection[];                   // 楽曲構造セクション
  timbre: AnalysisTimbre;                        // 音色の集約サマリー
  dynamics: AnalysisDynamics;                    // ダイナミクスの集約サマリー
  rhythm: AnalysisRhythm;                        // リズムの集約サマリー
  melody: AnalysisMelody;                        // 旋律輪郭のサマリー
  form: string;                                  // 楽曲形式ラベル。例: "AABA"
  tuning: number;                                // クロマグラムに使用した半音単位の偏差
}
// analyze() は上記のフル結果を返します。専用の detect*／analyze* 関数は、
// 個別解析やパラメータ指定の解析向けに引き続き利用できます。

interface HpssResult {
  harmonic: Float32Array;
  percussive: Float32Array;
  sampleRate: number;
}

interface StftResult {
  nBins: number;
  nFrames: number;
  nFft: number;
  hopLength: number;
  sampleRate: number;
  magnitude: Float32Array;  // nBins × nFrames, row-major
  power: Float32Array;      // nBins × nFrames, row-major
}

interface StftDbResult {
  nBins: number;
  nFrames: number;
  db: Float32Array;         // dB 単位のパワー
}

interface MelSpectrogramResult {
  nMels: number;
  nFrames: number;
  sampleRate: number;
  hopLength: number;
  nFft: number;
  fmin: number;            // 適用された Mel 下限周波数（Hz）
  fmax: number;            // 適用された上限。指定値が 0 ならナイキスト周波数
  htk: boolean;
  isDb: boolean;           // 順変換では false。power は線形パワー
  power: Float32Array;      // nMels × nFrames, row-major
  db: Float32Array;         // nMels × nFrames, row-major
}

interface MfccResult {
  nMfcc: number;
  nFrames: number;
  sampleRate: number;
  hopLength: number;
  nFft: number;
  nMels: number;
  fmin: number;
  fmax: number;            // 適用された上限周波数
  htk: boolean;
  isDb: boolean;           // 常に false。係数はケプストラム
  lifter: number;          // 0 はリフタリングなし
  coefficients: Float32Array;  // nMfcc × nFrames, row-major
}

interface ChromaResult {
  nChroma: number;
  nFrames: number;
  sampleRate: number;
  hopLength: number;
  features: Float32Array;   // nChroma × nFrames, row-major
  meanEnergy: number[];     // nChroma 個の値
}

interface PitchResult {
  f0: Float32Array;         // フレームごとの基本周波数（Hz）
  voicedProb: Float32Array; // フレームごとの有声確率（0–1）
  voicedFlag: boolean[];    // フレームごとの有声／無声判定
  nFrames: number;
  medianF0: number;
  meanF0: number;
}

// フレームごとの有声判定。f0Hz の 1 フレームにつき 1 要素。`voiced` 引数と
// PitchCorrectOptions.voiced が受け取ります。
type VoicedFlags =
  | Int32Array
  | Uint8Array
  | Float32Array
  | readonly number[]
  | readonly boolean[];

type MasteringAssistantParams = Record<string, number | boolean | string>;

interface MasteringAssistantSuggestStereoRequest {
  left: Float32Array;
  right: Float32Array;
  sampleRate?: number;
  params?: MasteringAssistantParams;
}

interface MasteringAudioProfileStereoRequest {
  left: Float32Array;
  right: Float32Array;
  sampleRate?: number;
  params?: Record<string, number | boolean>;
}

interface MasteringStreamingPreviewStereoRequest {
  left: Float32Array;
  right: Float32Array;
  sampleRate?: number;
  platforms?: StreamingPlatform[];
}

interface MeteringStereoRequest {
  left: Float32Array;
  right: Float32Array;
  sampleRate?: number;
  validate?: boolean;
}

// estimateRoom(...) が返す等価ルーム推定。長さの単位はメートル。
interface RoomEstimateResult {
  volume: number;               // m^3。減衰を測れなかった場合は NaN（confidence は 0）
  lengthM: number;
  widthM: number;
  heightM: number;
  drrDb: number;                // 直接音と残響音のエネルギー比
  confidence: number;
  bandAbsorption: Float32Array; // オクターブバンドごと。rt60Bands と同じ長さ
  rt60Bands: Float32Array;      // オクターブバンドごとの秒数
}
```

`Key.root` は数値で、`detectChords` や `chordFunctions` がそのまま受け取れる形です。`detectChords`、`chordFunctionalAnalysis`、`Audio.chordFunctionalAnalysis` の `keyRoot` / `keyMode` と `chordFunctions` の `key` は、ピッチクラス名（`'C#'`）または数値と、モード名または `Mode` 序数を受け付けるので、検出したキーをそのまま渡せます。未知の名前は、フィールド名を挙げた `RangeError` になります。`Chord.root` と `Chord.bass` は引き続き文字列ラベルです。

### `Key.confidence` が表すもの

`detectKey` と `detectKeyCandidates` が返す `Key.confidence` は、採点したすべての候補のプロファイル相関に対するソフトマックスです。範囲は `[0, 1)` で、候補全体の confidence の合計は 1 になるため、24 候補のうちの 1 つが 1 に到達することはありません。次点が迫るほど値は下がるので、根拠が割れる 2 つのキー（多くは平行調どうし）はそれぞれおよそ半分の値になります。

この値は、**当たる頻度ではなく**、クロマが候補集合の中からどれだけはっきり 1 つを選んだかを表すものとして読んでください。注釈付き音源に対して較正されていないため、信頼度が高くても誤ることは十分あり得ます。この値で分岐するパイプラインは、自分の素材に合わせてしきい値を自分で決める必要があります。

`analyze()` は別です。検出したコードでキーを補正するため、`AnalysisResult.key` は同じ入力に対する `detectKey` と異なるキーになることがあり、`confidence` もソフトマックスの取り分ではなく 1 に達しうる合成スコアです。取り分としての読み方が必要なときは `detectKey` を使ってください。

### 同じ構成音になるコード

::: warning 6th と 7th は同じ構成音を綴ることがあります
`major6` は短 3 度下の `minor7` と、`minor6` は短 3 度下の `halfDim7` と、`dominant7Sus4` は完全 4 度下の `sus2Add4` と、それぞれ同じ 4 つのピッチクラスを綴ります。クロマグラムにはこの組を区別する手がかりがないため、既定では慣用的な読み方のままになり、6th へ寄せられるのは低音の根拠がある場合だけです。
:::

### ビート関連フィールドの読み方

`downbeatIndices` は `beats` への添字です。独立した時系列ではなくビートグリッド上の所属判定なので、`beats` と同じ長さにはなりません。`downbeatPhase` は最初の小節が始まるビートの添字です。

各ビートの `strength` は、オンセット包絡線の**生の 1 フレーム**（上限なし）です。スケールは素材に依存し、ビート位置の揺れでも値が動きます。ビート周辺で何も平均していないためです。`beatObservations.onsetStrength` はライブラリ自身のダウンビート推定が採点している窓付きの値で、アクセントを読むもの（上記の `estimateMeter(...)` や、ビートの強弱を描画する処理など）はこちらを使うのが本来の形です。

ネイティブパッケージは、オプション、コールバック、ストリーミングスナップショット、リアルタイムエンジンメッセージ用の TypeScript 補助型もエクスポートしています。アプリ側で同じ構造を再定義せず、これらの型名を使ってください。

| 分野 | エクスポートされる型 |
|------|----------------|
| 解析オプション／結果 | `AnalysisProgressCallback`, `AnalysisBeat`, `BeatObservations`, `BpmCandidate`, `Chord`, `ChordAnalysisResult`, `AnalysisChord`, `AnalysisSection`, `ChordChromaMethod`, `EstimateMeterRequest`, `KeyMode`, `KeyProfile`, `MelodyPoint`, `MeterEstimate`, `Section`, `SectionTypeOrdinal`, `TempogramMode`, `TrimSilenceMode`, `DetectKeyOptions`, `KeyDetection`, `ChordFunction`, `ChordFunctionsInput`, `ChordFunctionsKey`, `FunctionalChord`, `ScaleName` |
| デコード | `DecodedChannels`, `ChannelLayout` |
| 特徴抽出 | `DecomposeStemsRequest`, `DecomposeStemsResult`, `DecomposeStemsLinkedRequest`, `DecomposeStemsLinkedResult`, `NoteSegment`, `NoteSegmentsRequest` |
| ストリーミング解析 | `StreamAnalyzerConfig`, `StreamAnalyzerStats`, `StreamFramesSoa`, `StreamProgressiveEstimate`, `StreamChordChange`, `StreamBarChord`, `StreamPatternScore` |
| マスタリングとメータリング | `MasteringPreset`, `MasteringInsertParamInfo`, `MasteringInsertTiming`, `MasteringProcessorCatalogEntry`, `MasteringInsertSlot`, `SoloProcessor`, `StreamingPlatform`, `DynamicsProcessorResult`, `CompressorDetector`, `DecrackleMode`, `DenoiseClassicalMode`, `DenoiseClassicalNoiseEstimator`, `EqBandInput`, `EqPhaseMode`, `EqSpectrumSnapshot`, `NormalizeMode`, `MasteringRepairStage`, `MasteringRepairStageName`, `MasteringRepairAnalysis`, `MasteringRepairAnalyzeRequest`, `MasteringRepairApplyRequest`, `MasteringRepairApplyResult`, `MasteringRepairStageReports`, `StreamingLoudnessGainRequest`, `StreamingLoudnessGainStereoRequest`, `StreamingLoudnessGainResult` |
| 機能カタログ | `Capabilities`, `CapabilityCatalog`, `CapabilityCatalogParameter`, `CapabilityCatalogProcessor`, `CapabilityCatalogPresets`, `CapabilityCatalogMasteringPreset`, `CapabilityCatalogChain`, `CapabilityCatalogChainStage`, `CapabilityCatalogChainList`, `CapabilityCatalogChainAlias`, `MasteringInsertParamChoice`, `MasteringInsertParamUnit`, `MasteringInsertParamScale`, `MasteringInsertParamRelation`, `MasteringInsertParamDependency` |
| ステレオのマスタリング／メータリングのリクエスト | `MasteringAssistantSuggestStereoRequest`, `MasteringAudioProfileStereoRequest`, `MasteringStreamingPreviewStereoRequest`, `MeteringStereoRequest`, `NormalizeStereoRequest`, `NormalizeStereoResult` |
| ピッチ補正 | `PitchCorrectOptions`, `VoicedFlags`, `AutoTuneKey`, `AutoTuneOptions`, `AutoTuneResult` |
| ルーム音響 | `AcousticModeName`, `MaterialPresetName`, `RoomGeometryFromEstimateOptions`, `RoomMorphOptions`, `RoomMorphResult`, `RoomMorphStereoResult`, `RoomPlacement` |
| マスタリングチェーン設定 | `MasteringChainConfig`, `MasteringChainConfigDocument`, `MultibandCompressorBand` |
| シンセ記述子 | `SynthParamInfo`, `SynthParamCondition`, `SynthPatch`, `SynthEngineMode` |
| ミキシング | `AutomationCurve`, `GoniometerPoint`, `MeterTap`, `MixMeterSnapshot`, `MixResult`, `MixerProcessResult`, `PanLaw`, `PanLawName`, `PanLawInput`, `PanMode`, `SendTiming`, `SidechainCheck`, `SidechainRefusal` |
| リアルタイム音声 | `VoicePresetId`, `VoicePresetCategory`, `RealtimeVoiceChangerPresetMetadata`, `RealtimeVoiceChangerPreset`, `RealtimeVoiceChangerConfigInput`, `RealtimeVoiceChangerConfig`, `RealtimeVoiceChangerOptions` |
| リアルタイムエンジングラフ | `EngineGraphSpec`, `EngineGraphNode`, `EngineGraphNodeType`, `EngineGraphConnection`, `EngineGraphMix`, `EngineGraphParameterBinding`, `EngineParameterInfo` |
| リアルタイムエンジントランスポート | `EngineTransportState`, `EngineMarker`, `EngineClip`, `EngineAutomationPoint`, `EngineAutomationPointCurve`, `EngineMetronomeConfig`, `EngineTrackMonitorMode` |
| プロジェクトのメタデータ／オートメーション | `ExternalInstrument`, `ExternalInstrumentEvent`, `ProjectAssistSidecar`, `ProjectAssistSidecarInput`, `ProjectAutomationTargetKind`, `ProjectAutomationLaneDesc` |
| リアルタイムエンジンのジョブ／テレメトリ | `EngineBounceOptions`, `EngineBounceResult`, `EngineFreezeOptions`, `EngineFreezeResult`, `EngineCaptureStatus`, `EngineTelemetry`, `EngineTelemetryType`, `EngineTelemetryError`, `EngineMeterTelemetry` |

`CapabilityCatalog.masteringPresets` は `name`、`kind`、`targetLufs`、`truePeakCeilingDb`、`maxLimiterGainReductionDb` を持つ要素を返し、修復プリセットでは 3 つの数値フィールドが `null` になります。`CapabilityCatalogProcessor.slots` は条件付きパラメータ群を表し、`MasteringInsertParamInfo` の各記述子には対応する `slot` があります。カタログの `chain` セクション（`CapabilityCatalogChain`）は、フラットなマスタリングチェーンキーすべてを記述します。ステージ（`CapabilityCatalogChainStage`）、項目数付きのインデックス付きリスト（`CapabilityCatalogChainList`）、どのプロセッサにも属さないキー、別名表記すべて（`CapabilityCatalogChainAlias`）です。`presets.playbackRoom` は常に存在します。記述子の `unit` は `MasteringInsertParamUnit`（閉じた集合で、数値でないキーは `null`）、`scale` は `MasteringInsertParamScale`（`'linear'` または `'log'`）、`dependsOn` は `MasteringInsertParamDependency`（`key`、`relation`、`factor`。`this <relation> factor * sibling` と読む）の配列で、その `relation` は `MasteringInsertParamRelation` です。`coupledWith` は、このキーの受け入れ範囲を動かすそのほかの兄弟キーの `string[]` で、`min` / `max` はそれらを既定値にして測った値です。`uiMin` と `uiMax` は表示範囲を表します。どのプロセッサ項目も `causal` を持ちます。`masteringInsertTiming(name, params, sampleRate)` は `latencySamples` と `tailSamples` を持つ `MasteringInsertTiming` を返し、`masteringPresetParams(preset)` は `masterAudio({ samples, overrides })` に渡せるフラットな `Record<string, number | boolean>` を返します。
