---
title: JavaScript/TypeScript 解析 API
description: libsonare JavaScript/TypeScript パッケージの解析関数、スケール量子化、単位変換、リサンプリングのリファレンスです。特徴抽出と librosa 互換ヘルパーは別ページにあります。
---

# JavaScript/TypeScript 解析 API

このページは libsonare JavaScript/TypeScript パッケージの中核となる解析関数を扱います。BPM・キー・ビート・オンセット検出、総合解析の `analyze()` とその個別ヘルパー、構造境界・拍子推定、そしてスケール量子化・単位変換・リサンプリングです。関連する 2 つのリファレンスが並んで存在します。[特徴抽出](./js-api-features.md) は、STFT、mel/MFCC、クロマ、スペクトル特徴、ピッチ検出、CQT/VQT/分解系の関数を扱います。[librosa 互換ヘルパー](./js-api-helpers.md) は、プリエンファシス、テスト信号生成、スペクトル再構成、構造解析、セグメンテーション、テンポグラムといった librosa の引数対応ポートを扱います。

## 各節の移動先

| 節 | ページ |
|---|---|
| 特徴抽出 | [特徴抽出](./js-api-features.md) |
| librosa 互換ヘルパー | [librosa 互換ヘルパー](./js-api-helpers.md) |

## 解析関数

### `detectBpm(samples, sampleRate)`

オーディオサンプルから BPM (テンポ) を検出します。

::: info ユースケース
- **DJ ソフトウェア**: トラック間のテンポをマッチングしてシームレスなミキシング
- **音楽プレイヤー**: テンポ情報の表示、テンポ別プレイリストの自動生成
- **フィットネスアプリ**: ワークアウト強度に合わせた音楽選択
- **ビート同期**: ビジュアライゼーションやアニメーションを音楽に同期
:::

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

オーディオサンプルから音楽キーを検出します。ルート音（C, D, E...）とモード（メジャー/マイナー）を返します。

::: info ユースケース
- **ハーモニックミキシング**: DJがスムーズなトランジションのためにキーをマッチング（カメロットホイール）
- **移調**: ボーカルレンジに合わせたキー変更の提案
- **音楽レコメンデーション**: 互換性のあるキーの曲を検索
- **練習ツール**: ミュージシャンが一緒に演奏するためのキー表示
:::

```typescript
function detectKey(samples: Float32Array, sampleRate?: number): Key  // sampleRate 既定: 22050
```

**戻り値:** `Key` オブジェクト

```typescript
interface Key {
  root: PitchClass;      // 0-11 (C=0, B=11)
  mode: Mode;            // Major、Minor、またはモード値。Mode enum 参照
  confidence: number;    // 候補集合に対する事後確率シェア [0, 1)。下記参照
  name: string;          // "C major", "A minor"
  shortName: string;     // "C", "Am"
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
```

::: warning `confidence` が表しているもの
`confidence` は、**スコア付けされた全候補のプロファイル相関に対する softmax** です。値域は
`[0, 1)` で、全候補の confidence の総和は `1` になります。候補が 24 個ある以上、単独のシェアが
`1` に届くことはありません。明確な結果は `0.95` ではなく `0.3` のような値になります。

この値が示すのは「クロマが候補集合の中からどれだけ明確に 1 つを選び出したか」であって、
**その選択がどれだけの頻度で正しいか**ではありません。注釈付き録音に対するキャリブレーション
は一切行っていないため、旋法的にあいまいな曲で高いシェアが出たときは、信頼できる答えでは
なく「自信のある誤答」です。他の分類器から持ち込んだ固定しきい値と比べるのではなく、
シェア同士を比較してください。

`KeyCandidate.key.confidence` は同じ事後確率シェアを持ち、`KeyCandidate.correlation` は
softmax の計算元となった生のプロファイル相関のままです。
:::

### `detectBeats(samples, sampleRate)`

オーディオサンプルからビート時刻を検出します。各ビートの推定タイムスタンプを返します。

::: info ユースケース
- **音楽ビジュアライゼーション**: 各ビートでエフェクトをトリガー
- **リズムゲーム**: オーディオからノートチャートを生成
- **動画編集**: ビートに合わせた自動カット
- **ループ作成**: 完璧なループポイントを見つける
:::

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

オーディオサンプルからオンセット時刻（音の立ち上がり）を検出します。ビートより細かい粒度 - すべての音をキャプチャ。

::: info ユースケース
- **ドラム採譜**: 個々のドラムヒットを検出
- **オーディオからMIDI**: オーディオをノートイベントに変換
- **サンプルスライシング**: トランジェントで自動的にオーディオをセグメント化
:::

```typescript
function detectOnsets(samples: Float32Array, sampleRate?: number): Float32Array  // sampleRate 既定: 22050
```

### `analyze(samples, sampleRate)` <Badge type="warning" text="高負荷" />

総合的な音楽解析を実行します。BPM、キー、ビート、コード、セクション、音色などを返します。

::: info ユースケース
- **音楽ライブラリ管理**: 楽曲にメタデータを自動タグ付け
- **音楽制作**: リファレンストラックの解析
- **DJ準備**: すべてのトラック情報を一度に取得
- **音楽教育**: 楽曲構造の学習
:::

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
  nFft?: number;                   // 既定 2048
  hopLength?: number;              // 既定 512

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
}
```

**戻り値:** 総合的な `AnalysisResult`。`analyze()` を 1 回呼ぶだけで、コード、セクション、音色、ダイナミクス、リズム、メロディ、楽曲形式、拍ごとの強度まで含む結果が、どのバインディングでも返ります。そのため、1 つのフィールドだけが欲しい場合を除き、個別のヘルパーを使う必要はほとんどありません。

::: warning `analyze()` の `useTriadsOnly` の既定値は `true`
統合パスでは `useTriadsOnly` の既定値が **`true`** です。単体のコード API では既定が `false`
なので、ここだけ異なります。`useTriadsOnly: false` を渡すまで `analyze()` はトライアドのみを
探索するため、セブンスコードはその中に含まれるトライアドとして返ります。同じ音源に対する
`detectChords()` の結果と比べて和声的に平板に見える場合、たいていは検出失敗ではなくこれが原因です。
:::

`meterCandidateNumerators` は**探索範囲を広げるだけで、結果を強制しません**。推定器はその分子を
報告する前に裏付けを見つける必要があります。ただし逆は絶対に成り立ちます。指定していない分子は
報告されえないため、既定の `[3, 4, 6]` で解析した 5/4 や 7/8 の曲は 4 拍子として返ってきます。
`meterDenominator` は指定したとおりに報告されますが、複合拍子を解決したときには推定器が自ら
`8` を報告します。

`computeTempoCurve` は `beatLocalBpm` を埋めるスイッチで、精度改善ではなく追加出力であるため
既定では無効です。このカーブは、それがデコードされたビートグリッドを記述します。したがって
テンポが実際に揺れる曲では `adaptiveTempo` も併せて指定してください。そうしないと、固定テンポ
で敷かれたグリッドを局所的に読んだだけの値になります。

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
function analyzeWithProgress(
  samples: Float32Array,
  sampleRate: number | undefined,  // undefined なら 22050 の既定を使う
  onProgress: (progress: number, stage: string) => void
): AnalysisResult
```

`sampleRate` はコールバックより前の位置引数ですが `undefined` を受け付け、その場合は `analyze` と同じ 22050 Hz の既定値を使います。実際のレートを渡してください。

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

### 目的別の詳細解析ヘルパー

::: tip 多くの場合は 1 回の呼び出しで十分
`analyze()` はコード、セクション、音色、ダイナミクス、リズム、メロディ、楽曲形式、拍ごとの強度まで返します。個別ヘルパーが必要になるのは、1 つのフィールドだけが欲しいときや、高レベル API では隠れている設定を渡したいときだけです。
:::

`analyze(...)` が広すぎる、または逆に詳細が足りない場合は、個別の解析ヘルパーを使います。入力は同じくモノラルの `Float32Array` ですが、高レベル API では隠れている設定を渡せます。

| 目的 | 関数 | 補足 |
|------|------|------|
| ダウンビート／小節頭 | `detectDownbeats(samples, sampleRate)` | 秒単位の小節頭候補。`detectBeats` と組み合わせるとグリッド表示に向きます。 |
| キー候補の順位付き一覧 | `detectKeyCandidates(samples, sampleRate, options?)` | トップ候補が曖昧な曲や、モード・プロファイルを絞りたい場合に使います。 |
| 詳細なテンポ候補 | `analyzeBpm(samples, sampleRate, ...)` | 最良 BPM だけでなく、候補とテンポ根拠を返します。 |
| リズム傾向 | `analyzeRhythm(samples, sampleRate, ...)` | グルーヴ、シンコペーション、規則性を見ます。 |
| ダイナミクス | `analyzeDynamics(samples, sampleRate, ...)` | ダイナミックレンジ、ラウドネスレンジ、クレストファクター、圧縮傾向を見ます。 |
| 音色 | `analyzeTimbre(samples, sampleRate, ...)` | ブライトネス、ウォームス、密度、粗さ、複雑さを返します。 |
| コード | `detectChords(samples, sampleRate, options?)` | コード区間を `{ chords }` として返します。HMM 平滑化、キー文脈、転回形、`chromaMethod: 'stft' \| 'nnls'` を指定できます。 |
| セクション | `analyzeSections(samples, sampleRate, ...)` | イントロ、Aメロ、サビ、ブリッジ、アウトロなどの構造を推定します。長尺入力で内部の境界グリッドがプーリングされても、`start` / `end` は元タイムライン上の正確な秒数を保ちます。 |
| 構造境界 | `detectBoundaries(request)` | 転換点そのものと、それを拾い出した元のノヴェルティ曲線を返します。自前のしきい値を当てたいときに使います。 |
| メロディ | `analyzeMelody(samples, sampleRate, ...)` | ピッチ追跡ベースの単音メロディ輪郭です。 |

```typescript
const keys = detectKeyCandidates(samples, sampleRate, {
  modes: [Mode.Major, Mode.Minor],
  profile: 'krumhansl',
  genreHint: 'pop',
});

const { chords } = detectChords(samples, sampleRate, {
  useHmm: true,
  useKeyContext: true,
  keyRoot: keys[0].key.root,
  keyMode: keys[0].key.mode,
  chromaMethod: 'nnls',
});

const sections = analyzeSections(samples, sampleRate);
```

### `detectBoundaries(request)`

`analyzeSections` がラベル付きの区間を返すのに対して、`detectBoundaries` は転換点そのものと、
それを拾い出した元のノヴェルティ曲線を返します。この曲線があることがこちらを使う理由です。
自前のしきい値を当てたい呼び出し側は、出来上がったセクションの一覧から曲線を復元できません。

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
| `threshold` | 0.3 | 相対ノヴェルティしきい値。曲線を自身の最大値で正規化した *後* に適用される |
| `absoluteThreshold` | 0.005 | ノヴェルティの下限。正規化の *前* の生の応答に適用される |
| `nMfcc` | 13 | MFCC の次数 |
| `nChroma` | 12 | クロマのビン数 |
| `peakDistance` | 2.0 | ピーク同士の最小間隔（秒） |
| `useMfcc` | `true` | MFCC 特徴量を使う |
| `useChroma` | `true` | クロマ特徴量を使う |

::: tip 2 つのしきい値は役割が違います
`threshold` は「その曲の中でどれだけ突出したピークか」を問います。曲線が先に自身の最大値で
正規化されるため、特徴量が実際にどれだけ変化したかについては何も言いません。
`absoluteThreshold` のほうが「そもそも変化があったのか」を問う下限です。これを `0` にしても
検出が有意に敏感になるわけではありません。正規化によって残留する揺らぎが 1.0 のピークに
化けるので、定常的な入力でも区切られてしまいます。

下限を下げてもレベルだけの構造は拾えません。レベル変化が特徴量ベクトルを動かす量は、同程度の
音高変化のおよそ 5 分の 1 で、定常ノイズが生む変化を下回ります。つまりノイズのほうが先に
通ってしまいます。
:::

戻り値は入力ではなく、測定に使ったグリッドの情報を持ちます。22050 Hz を超える入力は特徴量を
計算する前にリサンプリングされるため、返された `sampleRate`、`hopLength`、`nFrames`、
`frameStride` なしでは `boundary.frame` を解釈できません。サンプルや秒への対応付けには、
いずれの場合も `boundary.time` を使ってください。`noveltyCurve` は自身の最大値で正規化されて
いるので、生の応答は `noveltyCurve[i] * noveltyPeak` で復元できます。

`useMfcc: false` と `useChroma: false` を同時に渡すと、`InvalidParameter` の `SonareError` を
投げます。2 つの特徴量ストリームはフレーム単位で結合されるため、どちらも無効では結合する対象が
ありません。

### `estimateMeter(request)`

ビート列を候補拍子の集合に対してスコア付けし、勝者・最初の小節の位相・小節内部の分割の
仕方を報告します。オーディオではなくビートとアクセントを受け取るため、すでに手元にある
グリッド（`analyze()` の結果、DAW、タップテンポなど）に対して、サンプルを二度走査すること
なく実行できます。拍子とは何か、グルーピングが拍子記号とどう違うかについては
[拍子とグルーピング](./glossary/analysis/meter-and-grouping.md)を参照してください。

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

位置引数形式はなく、`estimateMeter` はリクエストオブジェクトのみを受け取ります。`beatStrengths`
の入力元として想定しているのは 2 つです。本来の入力元である
`AnalysisResult.beatObservations.onsetStrength` と、[Beat](./js-api-types.md#beat) で述べる
生の 1 フレーム値 `beats[].strength` です。どちらも事前のスケーリングは不要です。列は採点前に
自身の最大値で割られ、読まれるのは列内のアクセントの強弱差だけだからです。

::: warning 自前で組み立てたアクセント列はサンプルレートに依存する
各ビートについて `onsetEnvelope` を `timeToFrames(beatTime, sr, hopLength)` の位置で読む方法は、
3 つ目の入力元にはなりません。サンプル数で数えるホップは、レートごとに異なる長さの時間を
1 フレームに収めるためです。同じ波形を 32000 Hz・44100 Hz・48000 Hz でサンプリングし、ビート
時刻はサンプルと同一のまま採点したところ、勝者の分子はそれぞれ 6、3、4 になりました。各ビート
の周辺を窓で読んでもこの依存は消えません。ブラウザは出力デバイスのレートでデコードするため、
この方法で組んだ列は同じクリップでも訪問者ごとに違う答えを返します。上記 2 つの入力元の
いずれかを使ってください。
:::

::: warning 変拍子は、その分子を要求したときにしか報告されない
既定の候補集合は `{3, 4, 6}` です。集合の外にある分子は勝ちようがないため、既定のまま解析した
5/4 や 7/8 の曲は 4 拍子として返り、正解がそもそも選択肢に入っていなかったことを示す手がかりは
何も出ません。集合を広げても変拍子を強制することにはなりません（推定器は依然として裏付けを
必要とします）。扱う素材が実際に取りうる分子を渡してください。
:::

::: warning `searched: false` のとき、他のフィールドはすべてフォールバック値
ビート列が **8 拍未満**の場合、どの候補もスコア付けできないため、推定器は結果ではなく固定の
フォールバックを返します。`4/<要求した分母>`、`downbeatPhase` は `0`、`grouping` は `[4]`、
`candidateScores` は全要素 0、`candidates` は 1 要素だけになります。

**`timeSignature.confidence` もフォールバックの一部です。** 値は `0` で、確認せずに読んだ場合は
中程度の検出ではなく「判断不能」の側に倒れます。フォールバックと結果を分けるのはあくまで
`searched` です。信頼度を表示したり分岐に使ったりする前に確認してください。なお `beatTimes`
が空の場合はフォールバックではなく例外になります。1〜7 拍ならフォールバックが返ります。
:::

`timeSignature.confidence` と `candidates[k].confidence` は、同じフィールド名で別の量を運びます。
`timeSignature` 側は次点との差から導かれる値で、`candidates` の各要素ではその候補が支持の総和に
占める割合なので、要素の合計は 1 になります。両者は比較できず、同じしきい値を共有しては
いけません。手近な方ではなく、意図したフィールドから読んでください。

`grouping` は変則拍子が姿を現す場所です。`[3, 2, 2]` は 3-2-2 でグルーピングされた 7/8 を、
`[2, 2]` はごく普通の 4 拍子を意味します。要素が **1 つ**だけのときは内部分割が解決されなかった
ことを表します（分子に分割がない、小節が広すぎて探索できない、列が短すぎる、のいずれか）。
つまり `[4]` と `[2, 2]` は同じものの別表記ではなく、異なる答えです。

`candidateScores` と `candidates` は**添字の意味が異なり**、ここが取り違えやすい点です。
`candidateScores[k]` は k 番目に**要求した**分子のスコア（渡した順）であり、`candidates[k]` は
支持の高い順で k 番目の仮説です。スコアは標準化された符号付きの値で、0 が「拍子なし」の水準、
負ならノイズ以下を意味します。またスコア付けしたビート数の平方根に比例して大きくなるため、
1 つの結果の中で比較するもので、2 つの結果をまたいで比較してはいけません。

### `chordFunctionalAnalysis(samples, keyRoot, keyMode, sampleRate?, options?)`

指定したキーを基準に、検出されたコード進行を機能（ローマ数字）和声解析します。内部でコード検出を実行し、検出された各コードにラベルを付けるため、`detectKey(...)` から得た `keyRoot`／`keyMode` と、`detectChords(...)` に渡すのと同じ `options` をそのまま渡します。

ラベルには時刻が付きません。`detectChords(...)` の結果と 1 対 1 に対応するのは、両方に同じオプションを渡したときだけです。オプションが違うと、返る配列の長さが変わることがあります。`analyze(...)` の中のコードは独自の設定で別に検出したものなので、これらのラベルとは対応しません。

```typescript
function chordFunctionalAnalysis(
  samples: Float32Array,
  keyRoot: PitchClass,
  keyMode?: Mode,
  sampleRate?: number,
  options?: ChordDetectionOptions,
): string[]   // 検出されたコードごとに 1 つのローマ数字ラベル。例: ["I", "IV", "V", "vi"]
```

```typescript
const key = detectKey(samples, sampleRate);
const roman = chordFunctionalAnalysis(samples, key.root, key.mode, sampleRate);
console.log(roman);  // 例: ["I", "IV", "V", "vi"]
```

`detectKey(...)` と `detectKeyCandidates(...)` は同じ `KeyDetectionOptions` を受け取ります。

| グループ | 値 |
|----------|----|
| 制御項目 | `modes`, `profile`, `genreHint`, `useHpss`, `loudnessWeighted`, `highPassHz` |
| プロファイル名 | `ks`, `krumhansl`, `temperley`, `shaath`, `keyfinder`, `faraldo-edmt` / `edmt`, `faraldo-edma` / `edma`, `faraldo-edmm` / `edmm`, `bellman-budge` / `bellman` |
| ジャンルヒント | `auto`, `edm`, `electronic`, `dance`, `pop`, `classical`, `jazz` |

## スケール量子化

ピッチ補正のターゲットを構築するための 12-TET（12 平均律）スケールヘルパーです。

`modeMask` は 12 ビットのマスクで、ビット *i* が `root`（`PitchClass`、C = 0）を基準とした *i* 番目のピッチクラスを有効化します。自然な長調は `0b101010110101` です。

`referenceMidi` はチューニングの基準音です。A4 = 69 にするには `0` を渡します。

```typescript
// (小数を含む)MIDI 番号を最も近い有効なピッチクラスにスナップ
function scaleQuantizeMidi(root: number, modeMask: number, midi: number, referenceMidi?: number): number
// 補正量(量子化後 − 入力)をセミトーンで返す
function scaleCorrectionSemitones(root: number, modeMask: number, midi: number, referenceMidi?: number): number
// pitchClass(0..11)が root を基準に modeMask で有効か
function scalePitchClassEnabled(root: number, modeMask: number, pitchClass: number): boolean
```

`scaleQuantizeMidi(...)` を `pitchCorrectToMidi(...)` と組み合わせると、検出した音を最も近いスケール構成音へリチューンできます。

## 単位変換

これらの関数は軽量で高速です。

```typescript
// Hz <-> Mel (Slaney 式)
function hzToMel(hz: number): number
function melToHz(mel: number): number

// Hz <-> MIDI ノート番号 (A4 = 440 Hz = 69)
function hzToMidi(hz: number): number
function midiToHz(midi: number): number

// Hz <-> ノート名
function hzToNote(hz: number): string      // "A4", "C#5"
function noteToHz(note: string): number

// 時間 <-> フレーム
function framesToTime(frames: number, sr: number, hopLength: number): number
function timeToFrames(time: number, sr: number, hopLength: number): number

// フレーム <-> サンプル (librosa.frames_to_samples / samples_to_frames 相当)
function framesToSamples(frames: number, hopLength?: number, nFft?: number): number
function samplesToFrames(samples: number, hopLength?: number, nFft?: number): number

// dB 変換（ベクトル）
function powerToDb(values: Float32Array, ref?: number, amin?: number, topDb?: number): Float32Array
function amplitudeToDb(values: Float32Array, ref?: number, amin?: number, topDb?: number): Float32Array
function dbToPower(values: Float32Array, ref?: number): Float32Array
function dbToAmplitude(values: Float32Array, ref?: number): Float32Array
```

## リサンプリング

### `resample(samples, srcSr, targetSr)` <Badge type="info" text="中負荷" />

r8brain アルゴリズムを使用した高品質リサンプリング。

```typescript
function resample(
  samples: Float32Array,
  srcSr: number,
  targetSr: number
): Float32Array
```
