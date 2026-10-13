---
title: JavaScript/TypeScript 解析 API
description: libsonare JavaScript/TypeScript パッケージの解析関数、スケール量子化、単位変換、リサンプリングのリファレンスです。特徴抽出と librosa 互換ヘルパーは別ページにあります。
---

# JavaScript/TypeScript 解析 API

このページは libsonare JavaScript/TypeScript パッケージの中核となる解析関数を扱います。BPM・キー・ビート・オンセット検出、総合解析の `analyze()` とその個別ヘルパー、構造境界・拍子推定、ローマ数字によるコード分析です。関連する 2 つのリファレンスが並んで存在します。[特徴抽出](./js-api-features.md) は、STFT、mel/MFCC、クロマ、スペクトル特徴、ピッチ検出、CQT/VQT/分解系の関数を扱います。[ヘルパーと変換](./js-api-helpers.md) は、プリエンファシス、テスト信号生成、スペクトル再構成、構造解析、セグメンテーション、テンポグラムといった librosa の引数対応ポートと、スケール量子化、単位変換、リサンプリング、`chordFunctions` を扱います。

## 解析関数

### `detectBpm(samples, sampleRate)`

オーディオサンプルから BPM（テンポ）を検出します。テンポの求め方と、半分や倍の値が出る理由は [テンポと BPM](./glossary/analysis/tempo-bpm.md) を参照してください。

<SonareDemo id="beat-tracking" />

```typescript
function detectBpm(samples: Float32Array, sampleRate?: number): number
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `samples` | `Float32Array` | モノラルオーディオサンプル (範囲 -1.0 〜 1.0) |
| `sampleRate?` | `number` | サンプルレート (Hz)（既定値: 22050。例: 44100） |

::: warning 実際のサンプルレートを必ず渡す
ここでは `sampleRate` は任意（既定は 22050 Hz）ですが、ブラウザでデコードした音声はほぼ常に 44100 または 48000 Hz です。バッファの実際の `audioBuffer.sampleRate` を渡してください。さもないと検出される BPM が狂います。同じことは `detectKey`・`detectBeats`・`analyze` にも当てはまります。これらも `sampleRate` は任意で既定は同じ 22050 Hz なので、実際のレートを渡してください。
:::

**戻り値:** 検出された BPM の数値。

```typescript
const bpm = detectBpm(samples, sampleRate);
console.log(`BPM: ${bpm}`);
```

### `detectKey(samples, sampleRate)`

オーディオサンプルから音楽キーを検出します。ルート音（C, D, E...）、モード（メジャー/マイナー、または教会旋法）、そしてクロマの構築に使ったチューニングを返します。背景は [キー検出](./glossary/analysis/key-detection.md) を参照してください。オプション（`profile`、`modes`、`genreHint` など）は [キー検出のオプション](./js-api-helpers.md#キー検出のオプション) に表でまとめています。

```typescript
function detectKey(request: DetectKeyRequest): KeyDetection
function detectKey(
  samples: Float32Array,
  sampleRate?: number,             // 既定: 22050
  options?: DetectKeyOptions,
): KeyDetection
```

**戻り値:** `KeyDetection` オブジェクト

```typescript
type KeyMode = 'major' | 'minor' | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian' | 'locrian';

interface Key {
  root: PitchClass;      // 0-11 (C=0, B=11)
  mode: KeyMode;         // Mode の序数ではなく名前
  confidence: number;    // 候補集合に対する事後確率の割合 [0, 1)。下記参照
  name: string;          // "C major", "A minor"
  shortName: string;     // "C", "Am"
}

interface KeyDetection extends Key {
  tuning: number;        // クロマの構築に使ったセミトーン単位の端数
}

const KeyProfile = {
  KrumhanslSchmuckler: 0,
  Temperley: 1,
  Shaath: 2,
  FaraldoEDMT: 3,
  FaraldoEDMA: 4,
  FaraldoEDMM: 5,
  BellmanBudge: 6,
} as const;
```

```typescript
const key = detectKey(samples, sampleRate);
console.log(`キー: ${key.name}`);
console.log(`信頼度: ${(key.confidence * 100).toFixed(1)}%`);
console.log(key.mode);                  // 'major'
```

`detectKey`、`detectKeyCandidates`、`analyze` は、Node パッケージと同じく `mode` を名前で返します。`detectChords` と `chordFunctionalAnalysis` の `keyRoot` / `keyMode`、`chordFunctions` の `key` は、ピッチクラスの名前（`'C#'`）または数値と、モード名または `Mode` の序数（`Mode.Major` は `0`）を受け付けるため、検出したキーをそのまま渡せます。未知の名前は、そのフィールド名を挙げた `RangeError` になります。`modes` と `scaleMaskForMode` もどちらの表記も受け付けます。

クロマは `tuning` を指定しない限りコンサートピッチ A440 で読まれます。`tuning` は `[-0.5, 0.5)` の範囲のセミトーン単位の端数で、`'auto'` を渡すと音声から測定します。実際に使われた値（指定値または測定値）は `KeyDetection.tuning` として返ります。`analyze()` と `detectChords()` も同様に `AnalysisResult.tuning`、`ChordAnalysisResult.tuning` で報告します。Hz で扱いたい場合は [`tuningToReferenceHz` と `referenceHzToTuning`](./js-api-helpers.md#単位変換) を参照してください。

```typescript
const { name, tuning } = detectKey(samples, sampleRate, { tuning: 'auto' });
```

::: warning `confidence` が表しているもの
`confidence` は、**スコア付けされた全候補のプロファイル相関に対する softmax** です。値域は `[0, 1)` で、全候補の confidence の総和は `1` です。調性のはっきりした素材では 0.9 を超えることもあり、近い調が拮抗する曲では割合が分かれます。無音ではどの候補も約 1/24 になります。

この値が示すのは「クロマが候補集合の中からどれだけ明確に 1 つを選び出したか」であって、**その選択がどれだけの頻度で正しいか**ではありません。注釈付き録音に対する較正は一切行っていないため、旋法的にあいまいな曲で高い割合が出たときは、信頼できる答えではなく「自信のある誤答」です。他の分類器から持ち込んだ固定しきい値と比べるのではなく、1 位と 2 位の差で見てください。

`KeyCandidate.key.confidence` は同じ事後確率の割合を持ち、`KeyCandidate.correlation` は softmax の計算元となった生のプロファイル相関のままです。
:::

### `detectBeats(samples, sampleRate)`

オーディオサンプルからビート時刻を検出します。各ビートの推定タイムスタンプを返します。[ビートとダウンビート](./glossary/analysis/beats-downbeats.md) も参照してください。

```typescript
function detectBeats(samples: Float32Array, sampleRate?: number): Float32Array  // sampleRate 既定: 22050
```

**戻り値:** 秒単位のビート時刻の Float32Array

```typescript
const beats = detectBeats(samples, sampleRate);
console.log(`${beats.length} 個のビートを検出`);
for (let i = 0; i < beats.length; i++) {
  console.log(`ビート ${i + 1}: ${beats[i].toFixed(3)}秒`);
}
```

### `detectOnsets(samples, sampleRate)`

オーディオサンプルからオンセット時刻（音の立ち上がり）を検出します。ビートより細かい粒度で、すべての音の立ち上がりを捉えます。[オンセット検出](./glossary/analysis/onset-detection.md) も参照してください。

```typescript
function detectOnsets(request: DetectOnsetsRequest): Float32Array
function detectOnsets(
  samples: Float32Array,
  sampleRate?: number,             // 既定: 22050
  options?: OnsetDetectOptions,
): Float32Array
```

**戻り値:** 秒単位のオンセット時刻の Float32Array

| オプション | 既定値 | 意味 |
|---|---|---|
| `nFft` | 2048 | 22050 Hz 換算のサンプル数で表すウィンドウ長。入力のレートに合わせて再スケールされます |
| `hopLength` | 512 | 入力のサンプル数で表すホップ |
| `threshold` | 0 | オンセット強度の下限。`0` なら適応的に決まります |
| `preMax`, `postMax` | 1, 1 | ピークの前後で、そのピークを超えてはならないフレーム数 |
| `preAvg`, `postAvg` | 3, 4 | 適応的な下限のために、ピークの前後で平均を取るフレーム数 |
| `delta` | 0.06 | その平均に加えるオフセット |
| `wait` | 1 | 連続する 2 つのオンセットの最小間隔（フレーム） |
| `backtrack` | `false` | 各オンセットを直前の局所最小まで戻す |
| `backtrackRange` | 10 | 戻れる最大幅（フレーム） |

### `analyze(samples, sampleRate)` <Badge type="warning" text="高負荷" />

総合的な音楽解析を実行します。BPM、キー、ビート、コード、セクション、音色などを返します。

::: tip パフォーマンス
これは最も重い API です。長いオーディオファイル（3分以上）の場合は、`analyzeWithProgress` を使用して進捗を表示するか、関連するセグメントのみを解析することを検討してください。
:::

```typescript
function analyze(request: MusicAnalyzeRequest): AnalysisResult
function analyze(
  samples: Float32Array,
  sampleRate?: number,             // 既定 22050
  options?: MusicAnalyzeOptions,
): AnalysisResult

interface MusicAnalyzeOptions {
  // フレーミング
  nFft?: number;                   // 既定 2048。22050 Hz 換算のサンプル数。下記参照
  hopLength?: number;              // 既定 512。入力のサンプル数

  // テンポとビート
  bpmMin?: number;                 // 既定 60
  bpmMax?: number;                 // 既定 200
  startBpm?: number;               // 既定 120
  adaptiveTempo?: boolean;         // 局所テンポの事前分布を追従。既定 false
  tempoUpdateIntervalBeats?: number; // 局所テンポ文脈の長さ（拍）。既定 8
  computeTempoCurve?: boolean;     // beatLocalBpm を埋める。既定 false

  // 拍子
  meterCandidateNumerators?: number[]; // 既定 [3, 4, 6]。1〜16 個、各値は 2〜32
  meterDenominator?: number;       // 既定 4。[1, 32] の 2 の冪

  // クロマとコード
  useTriadsOnly?: boolean;         // ここでの既定は true。下記参照
  useHpss?: boolean;               // 既定 true
  chromaHighpassHz?: number;       // 既定 80。0 で無効
  useBassWeighted?: boolean;       // 既定 true
  chromaHopMultiplier?: number;    // 既定 4
  useChordHmm?: boolean;           // 既定 false
  useChordKeyContext?: boolean;    // 既定 false
  chordHmmBeamWidth?: number;      // 既定 24
  detectChordInversions?: boolean; // 既定 false

  // チューニング
  tuning?: number | 'auto';        // 既定 0 (A440)。[-0.5, 0.5) のセミトーン端数
}
```

`nFft` は **22050 Hz 換算** のサンプル数で表すウィンドウ長で、入力のレートに合わせて再スケールされます。そのため 44100 Hz や 48000 Hz でも同じ時間幅をカバーします。`hopLength` は入力のサンプル数のままです。テンポ・ビート・オンセット・キー・リズム・コード・音色の各ヘルパーも同じ扱いなので、レートが違っても結果は揃い、22050 Hz の入力は書いたとおりに読まれます。`tuning` は解析が作るすべてのクロマ（キー、コード、セクション）をずらし、`'auto'` なら測定します。使われた値は `result.tuning` です。

**戻り値:** 総合的な `AnalysisResult`。`analyze()` を 1 回呼ぶだけで、コード、セクション、音色、ダイナミクス、リズム、メロディ、楽曲形式、拍ごとの強度まで含む結果が、どのバインディングでも返ります。そのため、1 つのフィールドだけが欲しい場合を除き、個別のヘルパーを使う必要はほとんどありません。結果のコードには `result.key` を基準にした `romanNumeral` も付き、`N.C.` では空文字列になります。

::: warning `analyze()` の `useTriadsOnly` の既定値は `true`
統合パスでは `useTriadsOnly` の既定値が **`true`** です。単体のコード API では既定が `false` なので、ここだけ異なります。`useTriadsOnly: false` を渡すまで `analyze()` はトライアドのみを探索するため、セブンスコードはその中に含まれるトライアドとして返ります。同じ音源に対する `detectChords()` の結果と比べて和声的に平板に見える場合、たいていは検出失敗ではなくこれが原因です。
:::

`meterCandidateNumerators` は**探索範囲を広げるだけで、結果を強制しません**。推定器はその分子を報告する前に裏付けを見つける必要があります。ただし逆方向の制約は必ず働きます。指定していない分子は報告されえないため、既定の `[3, 4, 6]` で解析した 5/4 や 7/8 の曲は 4 拍子として返ってきます。`meterDenominator` は指定したとおりに報告されますが、複合拍子を解決したときには推定器が自ら `8` を報告します。

`computeTempoCurve` は `beatLocalBpm` を埋めるスイッチで、精度改善ではなく追加出力であるため既定では無効です。このカーブは、デコードの元になったビートグリッドのテンポを表します。したがってテンポが実際に揺れる曲では `adaptiveTempo` も併せて指定してください。そうしないと、固定テンポで敷かれたグリッドを局所的に読んだだけの値になります。

```typescript
const result = analyze(samples, sampleRate);
console.log(`BPM: ${result.bpm}`);
console.log(`キー: ${result.key.name}`);
console.log(`コード数: ${result.chords.length}`);
console.log(`楽曲形式: ${result.form}`);
```

### `analyzeWithProgress(samples, sampleRate, onProgress)` <Badge type="warning" text="高負荷" />

進捗レポート付きで `analyze(...)` と同じ総合解析を実行します。

```typescript
function analyzeWithProgress(request: AnalyzeWithProgressRequest): AnalysisResult
function analyzeWithProgress(
  samples: Float32Array,
  sampleRate: number | undefined,  // undefined なら 22050 の既定を使う
  onProgress: (progress: number, stage: string) => void,
  options?: MusicAnalyzeOptions,
): AnalysisResult

interface AnalyzeWithProgressRequest {
  samples: Float32Array;
  sampleRate?: number;
  onProgress?: (progress: number, stage: string) => void;
  cancel?: () => boolean;          // true を返すと中断し、呼び出しは例外を投げる
  options?: MusicAnalyzeOptions;   // analyze() と同じフィールドと既定値
}
```

`sampleRate` はコールバックより前の位置引数ですが `undefined` を受け付け、その場合は `analyze` と同じ 22050 Hz の既定値を使います。実際のレートを渡してください。

::: tip リクエスト形式では、オプションを `samples` と並べても `options` の下に置いても構わない
`analyzeWithProgress({ samples, sampleRate, bpmMin: 90, bpmMax: 140 })` と `analyzeWithProgress({ samples, sampleRate, options: { bpmMin: 90, bpmMax: 140 } })` は、`analyze` と同じく同じ範囲を反映します。両方に書いたフィールドは `options` の値が採用され、解析オプションにないキーはそのキーを挙げた `TypeError` になります。この呼び出しは同期的で、実行したスレッドをブロックします。ページ上で UI の描画を保つには、[ワーカークライアント](./wasm-advanced.md)経由で実行してください。
:::

**進捗ステージ:**

| ステージ | 説明 | 進捗 |
|---------|------|------|
| `"features"` | 特徴量の事前計算 | 0.0 |
| `"bpm"` | BPM 検出 | 0.15 |
| `"key"` | キー検出 | 0.15 |
| `"beats"` | ビートトラッキング | 0.25 |
| `"chords"` | コード認識 | 0.40 |
| `"sections"` | セクション検出 | 0.55 |
| `"timbre"` | 音色解析 | 0.70 |
| `"dynamics"` | ダイナミクス解析 | 0.80 |
| `"rhythm"` | リズム解析 | 0.90 |
| `"melody"` | メロディ解析 | 0.95 |
| `"complete"` | 完了 | 1.0 |

```typescript
const result = analyzeWithProgress(samples, sampleRate, (progress, stage) => {
  console.log(`${stage}: ${Math.round(progress * 100)}%`);
});
```

### `transcribe(request)`

`transcribe` はモノラル音声を、一定テンポの PPQ グリッド上のノートオン／ノートオフ `ProjectMidiEvent[]` に変換します。`tempoBpm` を渡すとそのテンポでグリッドを作り、省略するとテンポを検出します。結果には `events.length` の半分にあたる `noteCount` も含まれます。プロジェクトのテンポマップは変更しません。

```typescript
interface TranscribeRequest {
  samples: Float32Array;
  sampleRate: number;
  tempoBpm?: number;  // 省略すると検出
  polyphonic?: boolean;
  referenceHz?: number | 'auto';  // Hz 単位のチューニング基準。既定 440、'auto' で測定
  // その他の任意の検出設定は下の表を参照
}

interface TranscribeResult {
  events: ProjectMidiEvent[];
  noteCount: number;
  tempoBpm: number;
  tuning: number;     // ノート番号の基準にしたセミトーン端数
}

function transcribe(request: TranscribeRequest): TranscribeResult
```

```typescript
const { events, noteCount, tempoBpm } = transcribe({
  samples,
  sampleRate,
  tempoBpm: 120,
  polyphonic: true,
});
project.setMidiEvents(clipId, events);
console.log(noteCount, tempoBpm);
```

`samples` と `sampleRate` 以外のフィールドはすべて省略可能です。省略すると既定値が使われ、値がフィールドの範囲外なら `RangeError` を投げます。`0` を除外する範囲のフィールドに `0` を書くと、既定値の指定ではなく範囲外の値として扱います（`0` を値として受け付けるのは `group` と `channel` だけです）。サンプルレートは `[8000, 384000]` の範囲で指定します。

| フィールド | 既定値 | 意味 |
|---|---|---|
| `polyphonic` | `false` | `true` で重なったノートを検出するマルチ F0 経路を使い、`false` は pYIN の単一音高ラインをノートに切ります |
| `referenceHz` | `440` | MIDI ノート番号の基準にするチューニング（Hz、有限の正の値）。`'auto'` で音声から測定します。使われた値は `TranscribeResult.tuning` に入ります |
| `fmin`・`fmax` | モノフォニック経路 `65`・`2093`、ポリフォニック経路 `55`・`1760` | F0 トラッカーの範囲（Hz）。端点を省略すると経路ごとの既定値になり、明示する場合は正の値で `fmax` が `fmin` を上回る必要があります。ポリフォニック経路では、セントスペクトルの下限より低い `fmin` がその下限も下げ、`fmax` より上で見つかったノートは 1 オクターブ低く報告されずに捨てられます |
| `minNoteMs` | モノフォニック経路 `30`、ポリフォニック経路 `60` | ノートとして残す最短の長さ（ミリ秒）。正の値で、`minNoteDivision` とは同時に指定できません |
| `minNoteDivision` | なし | 最短のノートを音価で指定します。`n` は変換テンポでの `1/n` 音符以上を残します。`[1, 128]` の整数で、`minNoteMs` とは同時に指定できません。テンポを読む唯一の設定です |
| `segmentationThresholdCents` | `50` | 1 つのノートを終わらせて次を始める音高の動き。正の値 |
| `velocityFloorDb` | `-48` | ベロシティ 1 に対応するレベル（dBFS）。負の値が必要です。この値でノートが落ちることはありません。テイクの最も大きい音より 36 dB を超えて小さいノートと、-80 dBFS 未満のノートは、この値に関係なく捨てられます |
| `fixedVelocity` | なし（レベルからマップ） | `[1, 127]` の整数を指定すると、全ノートがそのベロシティになります。減衰の残りやゴーストは、この場合もレベルゲートで捨てます |
| `maxPolyphony` | `10` | ポリフォニックのみ。1 フレームが持てる声部数。`[1, 64]` の整数 |
| `minFramePeakRatio` | `0.20` | ポリフォニックのみ。フレームの探索を、最初のピークに対するこの割合を下回った時点で止めます。`[0, 1]` で、`0` は実際の 0（カットなし）です |
| `minRidgePeakRatio` | `0.10` | ポリフォニックのみ。リッジを、自身の走行ピークに対するこの割合を下回った時点で終わらせます。`[0, 1]` で、`0` は実際の 0（カットなし）です |
| `reattackRatio` | `2.0` | ポリフォニックのみ。リッジのサリエンス（そのピッチの目立ち具合）が直前のレベルのこの倍率を超えて立ち上がった位置で分割し、鳴っている間に同じ音高を弾き直した音を新しいノートにします。`1` より大きい値が必要で、`0` で分割を無効にします |
| `group`・`channel` | `0`・`0` | イベントを出力する UMP グループと MIDI チャンネル。どちらも `0..15` |

`maxPolyphony`・`minFramePeakRatio`・`minRidgePeakRatio`・`reattackRatio` はモノフォニック経路では拒否されます。実際の素材でのこれらの上限の挙動と、ポリフォニック経路の既知の制限は、[音声からノートへ](./audio-to-notes.md#オプションと制限)で説明しています。

PPQ グリッドをプロジェクトのテンポマップに合わせる場合は `Project.transcribeToClip(...)` を使います。このリクエストには `tempoBpm` がなく、書き込んだノート数を返します。

### 目的別の詳細解析ヘルパー

::: tip 多くの場合は 1 回の呼び出しで十分
`analyze()` はコード、セクション、音色、ダイナミクス、リズム、メロディ、楽曲形式、拍ごとの強度まで返します。個別ヘルパーが必要になるのは、1 つのフィールドだけが欲しいときや、高レベル API では隠れている設定を渡したいときだけです。
:::

入力は他の関数と同じモノラルの `Float32Array` です。どのヘルパーもリクエストオブジェクト（`{ samples, sampleRate, ...オプション }`）を受け付けます。

| 目的 | 関数 | 戻り値 |
|------|------|------|
| 小節頭 | `detectDownbeats(samples, sampleRate)` | 小節頭と思われる位置の秒数。`detectBeats` と組み合わせるとグリッド表示に向きます。[ビートとダウンビート](./glossary/analysis/beats-downbeats.md) を参照 |
| キー候補の順位付き一覧 | `detectKeyCandidates(samples, sampleRate, options?)` | 全キーと confidence を高い順に返します。トップ候補が曖昧な曲や、モード・プロファイルを絞りたい場合に使います |
| テンポ候補 | `analyzeBpm(...)` | `bpm`、`confidence`、`candidates`（選ばれたテンポが先頭、残りは得票率順）、`autocorrelation`、`tempogram` |
| リズム傾向 | `analyzeRhythm(...)` | `timeSignature`、`syncopation`、`grooveType`、`patternRegularity`、`tempoStability`、`bpm`、`beatIntervals` |
| ダイナミクス | `analyzeDynamics(...)` | `Dynamics` のフィールドに `loudnessTimes` と `loudnessRmsDb` を加えたもの |
| 音色 | `analyzeTimbre(...)` | `Timbre` のフィールドに `spectralCentroid`、`spectralFlatness`、`spectralRolloff`、`timbreOverTime` を加えたもの |
| コード | `detectChords(samples, sampleRate, options?)` | コード区間と使われたチューニングを `{ chords, tuning }` として返します。[コード認識](./glossary/analysis/chord-recognition.md) を参照 |
| コードの機能 | `chordFunctions({ chords, key })` | 手元にあるコードに、再検出せずにローマ数字と和声機能を付けます |
| セクション | `analyzeSections(...)` | イントロ、Aメロ（Verse）、サビ（Chorus）、ブリッジ、アウトロなどのラベル付き区間。長尺入力で内部の境界グリッドがプーリングされても、`start` / `end` は元タイムライン上の正確な秒数を保ちます。[セクション構造](./glossary/analysis/section-structure.md) を参照 |
| 構造境界 | `detectBoundaries(request)` | 転換点だけと、それを拾い出した元のノベルティ曲線 |
| メロディ | `analyzeMelody(...)` | `points`、`pitchRangeOctaves`、`pitchStability`、`meanFrequency`、`vibratoRate`（`pitches` ではなく `points`）。[メロディとピッチ](./glossary/analysis/melody-pitch.md) を参照 |

オプションを取るヘルパーの設定です。すべて省略可能です。

| ヘルパー | オプション | 既定値 |
|---|---|---|
| `analyzeBpm` | `bpmMin`、`bpmMax` | 30、300（`analyze()` の探索範囲は 60 〜 200） |
| | `startBpm` | 120 |
| | `maxCandidates` | 5 |
| | `nFft`、`hopLength` | 2048（22050 Hz 換算）、512 |
| `analyzeRhythm` | `bpmMin`、`bpmMax`、`startBpm` | 60、200、120 |
| | `nFft`、`hopLength` | 2048（22050 Hz 換算）、512 |
| `analyzeDynamics` | `windowSec` | 0.4 |
| | `hopLength` | 512 |
| | `compressionThreshold` | 6（クレストファクターがこの dB を下回ると `isCompressed` が立ちます） |
| `analyzeTimbre` | `nMels`、`nMfcc` | 128、13 |
| | `windowSec` | 0.5 |
| | `nFft`、`hopLength` | 2048（22050 Hz 換算）、512 |
| `analyzeSections` | `minSectionSec` | 4 |
| | `nFft`、`hopLength` | 2048、512 |
| `analyzeMelody` | `fmin`、`fmax` | 65 Hz、2093 Hz |
| | `frameLength`、`hopLength` | 2048（22050 Hz 換算）、256 |
| | `threshold` | 0.1（有声判定の信頼度、`[0, 1]`） |
| | `usePyin` | `false`。`true` にすると、オクターブ跳びの少ない滑らかな輪郭になります |
| | `center` | `true`（pYIN のみ） |

`detectChords` は `minDuration`、`smoothingWindow`、`threshold`、`useTriadsOnly`、`nFft`、`hopLength`、`useBeatSync`、`useHmm`、`hmmBeamWidth`、`useKeyContext`、`keyRoot`、`keyMode`、`detectInversions`、`chromaMethod: 'stft' | 'nnls'`、`tuning` を受け付けます。`detectKeyCandidates` は `tuning` を除いて `detectKey` と同じオプションを受け付けます（[キー検出のオプション](./js-api-helpers.md#キー検出のオプション) を参照）。

```typescript
const keys = detectKeyCandidates(samples, sampleRate, {
  modes: ['major', 'minor'],
  profile: 'krumhansl',
  genreHint: 'pop',
});

const { chords } = detectChords(samples, sampleRate, {
  useHmm: true,
  useKeyContext: true,
  keyRoot: keys[0].key.root,
  keyMode: keys[0].key.mode,       // 検出したキーをそのまま渡せる
  chromaMethod: 'nnls',
});

const sections = analyzeSections(samples, sampleRate);
```

### `detectBoundaries(request)`

`analyzeSections` がラベル付きの区間を返すのに対して、`detectBoundaries` は転換点そのものと、それを拾い出した元のノベルティ曲線を返します。この曲線があることがこちらを使う理由です。自前のしきい値を当てたい呼び出し側は、出来上がったセクションの一覧から曲線を復元できません。

```typescript
const { boundaries, noveltyCurve, noveltyPeak, sampleRate: gridRate } =
  detectBoundaries({ samples, sampleRate: 44100 });

for (const { time, strength } of boundaries) {
  console.log(`${time.toFixed(2)}s  ${strength.toFixed(3)}`);
}
```

| オプション | 既定値 | 説明 |
|------------|------------|------|
| `sampleRate` | 22050 | `samples` のサンプルレート |
| `nFft` | 2048 | 構造特徴量に使う FFT サイズ |
| `hopLength` | 512 | ホップ長（サンプル数） |
| `kernelSize` | 64 | チェッカーボードカーネルのサイズ（フレーム数） |
| `threshold` | 0.3 | 相対ノベルティしきい値。ピークが、`referenceWindow` の範囲内で最大のノベルティに対してこの割合に達している必要がある |
| `absoluteThreshold` | 0.005 | ノベルティの下限。正規化の *前* の生の応答に適用される |
| `nMfcc` | 13 | MFCC の次数 |
| `nChroma` | 12 | クロマのビン数 |
| `peakDistance` | 2.0 | ピーク同士の最小間隔（秒） |
| `referenceWindow` | 60 | 相対しきい値を測る範囲（片側、秒）。`0` で相対しきい値を無効にし、曲の長さ以上にすると基準が曲全体になる |
| `useMfcc` | `true` | MFCC 特徴量を使う |
| `useChroma` | `true` | クロマ特徴量を使う |

| しきい値 | 答える問い |
|---|---|
| `threshold` | このピークは周囲と比べてどれだけ突出しているか。各ピークは曲全体の最大値ではなく、前後 `referenceWindow` 秒の範囲で最大のノベルティと比較されるので、支配的な変化が遠く離れた弱い変化を隠すことはありません。範囲内のどのイベントも 30% 以内に迫らない孤立したイベントは、この基準から除外されます |
| `absoluteThreshold` | そもそも変化があったのか。正規化の前の生の応答に適用する下限です |

`threshold` は、特徴量が実際にどれだけ変化したかについては何も示しません。`absoluteThreshold` を `0` にしても検出が有意に敏感になるわけではありません。正規化によって残留する揺らぎが 1.0 のピークに化けるので、定常的な入力でも区切られてしまいます。下限を下げてもレベルだけの構造は拾えません。レベル変化が特徴量ベクトルを動かす量は同程度の音高変化のおよそ 5 分の 1 で、定常ノイズが生む変化を下回るためです。

戻り値は入力ではなく、測定に使ったグリッドの情報を持ちます。22050 Hz を超える入力は特徴量を計算する前にリサンプリングされるため、返された `sampleRate`、`hopLength`、`nFrames`、`frameStride` なしでは `boundary.frame` を解釈できません。サンプルや秒への対応付けには、いずれの場合も `boundary.time` を使ってください。`noveltyCurve` は自身の最大値で正規化されているので、生の応答は `noveltyCurve[i] * noveltyPeak` で復元できます。

`useMfcc: false` と `useChroma: false` を同時に渡すと、`InvalidParameter` の `SonareError` を投げます。2 つの特徴量ストリームはフレーム単位で結合されるため、どちらも無効では結合する対象がありません。負または有限でない `referenceWindow` は `RangeError` を投げます。

### `estimateMeter(request)`

ビート列を候補拍子の集合に対してスコア付けし、勝者・最初の小節の位相・小節内部の分割の仕方を報告します。オーディオではなくビートとアクセントを受け取るため、すでに手元にあるグリッド（`analyze()` の結果、DAW、タップテンポなど）に対して、サンプルを二度走査することなく実行できます。拍子とは何か、グルーピングが拍子記号とどう違うかについては[拍子とグルーピング](./glossary/analysis/meter-and-grouping.md)を参照してください。

<SonareDemo id="meter-estimate" />

```typescript
function estimateMeter(request: EstimateMeterRequest): MeterEstimate

interface EstimateMeterRequest {
  beatTimes: ArrayLike<number>;      // ビート位置（秒）。単調非減少
  beatStrengths: ArrayLike<number>;  // ビートごとのアクセント値。同じ長さ
  candidateNumerators?: number[];    // 既定 [3, 4, 6]。1〜16 個、各値は 2〜32
  denominator?: number;              // 既定 4。[1, 32] の 2 の冪
  downbeatWeight?: number;           // 既定 1
  measureWeight?: number;            // 既定 0.5
  subdivisionWeight?: number;        // 既定 0.15
  compoundSubdivisionThreshold?: number;  // 既定 0.85
}

interface MeterEstimate {
  timeSignature: TimeSignature;   // 選ばれた拍子。confidence は次点との差から導出
  downbeatPhase: number;          // 最初の小節が始まるビート番号
  searched: boolean;              // 列が短すぎてスコア付けできなかった場合は false
  grouping: number[];             // アクセント群ごとの拍数。総和は分子に一致
  candidateScores: number[];      // 要求した分子ごとのスコア（要求した順）
  candidates: TimeSignature[];    // 支持の高い順。confidence は支持総和に占める割合
}
```

位置引数形式はなく、`estimateMeter` はリクエストオブジェクトのみを受け取ります。`beatStrengths` の入力元として想定しているのは 2 つです。本来の入力元である `AnalysisResult.beatObservations.onsetStrength` と、[Beat](./js-api-types.md#beat) で述べる生の 1 フレーム値 `beats[].strength` です。どちらも事前のスケーリングは不要です。列は採点前に自身の最大値で割られ、読まれるのは列内のアクセントの強弱差だけだからです。

::: warning 自前で組み立てたアクセント列はサンプルレートに依存する
各ビートについて `onsetEnvelope` を `timeToFrames(beatTime, sr, hopLength)` の位置で読む方法は、3 つ目の入力元にはなりません。サンプル数で数えるホップは、レートごとに異なる長さの時間を 1 フレームに収めるためです。同じ波形を 32000 Hz・44100 Hz・48000 Hz でサンプリングし、ビート時刻はサンプルと同一のまま採点したところ、勝者の分子はそれぞれ 6、3、4 になりました。各ビートの周辺を窓で読んでもこの依存は消えません。ブラウザは出力デバイスのレートでデコードするため、この方法で組んだ列は同じクリップでも訪問者ごとに違う答えを返します。上記 2 つの入力元のいずれかを使ってください。
:::

::: warning 変拍子は、その分子を要求したときにしか報告されない
既定の候補集合は `{3, 4, 6}` です。集合の外にある分子は勝ちようがないため、既定のまま解析した 5/4 や 7/8 の曲は 4 拍子として返り、正解がそもそも選択肢に入っていなかったことを示す手がかりは何も出ません。集合を広げても変拍子を強制することにはなりません（推定器は依然として裏付けを必要とします）。扱う素材が実際に取りうる分子を渡してください。
:::

::: warning `searched: false` のとき、他のフィールドはすべてフォールバック値
ビート列が **8 拍未満**の場合、どの候補もスコア付けできないため、推定器は結果ではなく固定のフォールバックを返します。`4/<要求した分母>`、`downbeatPhase` は `0`、`grouping` は `[4]`、`candidateScores` は全要素 0、`candidates` は 1 要素だけになります。

**`timeSignature.confidence` もフォールバックの一部です。** 値は `0` で、確認せずに読んだ場合は中程度の検出ではなく「判断不能」の側に倒れます。フォールバックと結果を分けるのはあくまで `searched` です。信頼度を表示したり分岐に使ったりする前に確認してください。なお `beatTimes` が空の場合はフォールバックではなく例外になります。1〜7 拍ならフォールバックが返ります。
:::

`timeSignature.confidence` と `candidates[k].confidence` は、同じフィールド名で別の量を表します。`timeSignature` 側は次点との差から導かれる値で、`candidates` の各要素ではその候補が支持の総和に占める割合なので、要素の合計は 1 になります。両者は比較できず、同じしきい値を共有してはいけません。手近な方ではなく、意図したフィールドから読んでください。

変則拍子は `grouping` に現れます。`[3, 2, 2]` は 3-2-2 でグルーピングされた 7/8 を、`[2, 2]` はごく普通の 4 拍子を意味します。要素が **1 つ**だけのときは内部分割が解決されなかったことを表します（分子に分割がない、小節が広すぎて探索できない、列が短すぎる、のいずれか）。つまり `[4]` と `[2, 2]` は同じものの別表記ではなく、異なる答えです。

`candidateScores` と `candidates` は**添字の意味が異なり**、ここが取り違えやすい点です。`candidateScores[k]` は k 番目に**要求した**分子のスコア（渡した順）であり、`candidates[k]` は支持の高い順で k 番目の仮説です。スコアは標準化された符号付きの値で、0 が「拍子なし」の水準、負ならノイズ以下を意味します。またスコア付けしたビート数の平方根に比例して大きくなるため、1 つの結果の中で比較するもので、2 つの結果をまたいで比較してはいけません。

### `chordFunctionalAnalysis(samples, keyRoot, keyMode, sampleRate?, options?)`

指定したキーを基準に、検出されたコード進行を機能（ローマ数字）和声解析します（[コード認識](./glossary/analysis/chord-recognition.md)）。内部でコード検出を実行したうえで、検出された各コードにラベルを付けるため、`options` には `detectChords(...)` に渡すのと同じものを渡します。

戻り値は時刻付きのコードエントリそのものです。`Chord` の全フィールド（`root`、`bass`、`quality`、`start`、`end`、`duration`、`confidence`、`name`）に `roman` と `function` が加わります。別に呼んだ `detectChords(...)` と対応を取る必要はありません。`analyze(...)` は独自の設定でコードを別に検出し、結果の各コードには `result.key` を基準にした `romanNumeral` が付きます（`N.C.` では空文字列）。

```typescript
function chordFunctionalAnalysis(
  samples: Float32Array,
  keyRoot: PitchClass | PitchClassName,
  keyMode?: Mode | KeyMode,        // 既定は Mode.Major
  sampleRate?: number,
  options?: ChordDetectionOptions,
): FunctionalChord[]

type ChordFunction = 'tonic' | 'subdominant' | 'dominant' | 'chromatic' | 'none';

type FunctionalChord = Chord & {
  roman: string;                   // 'I'、'V7'、'vi'。不明なコードは 'N.C.'
  function: ChordFunction;         // キーのスケール外のルートは 'chromatic'
};
```

```typescript
const key = detectKey(samples, sampleRate);
const functional = chordFunctionalAnalysis(samples, key.root, key.mode, sampleRate);

for (const { start, name, roman, function: role } of functional) {
  console.log(`${start.toFixed(1)}s  ${name}  ${roman}  ${role}`);  // 例: "0.0s  C  I  tonic"
}
```
