---
title: JavaScript/TypeScript 解析 API
description: libsonare JavaScript/TypeScript パッケージの解析関数、特徴抽出、スケール量子化、単位変換、librosa 互換ヘルパー、リサンプリングのリファレンスです。
---

# JavaScript/TypeScript 解析 API

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
| `sampleRate?` | `number` | サンプルレート (Hz)（デフォルト: 22050。例: 44100） |

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

| オプション | デフォルト | 説明 |
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
  timeSignature: TimeSignature;   // 選ばれた拍子
  downbeatPhase: number;          // 最初の小節が始まるビート番号
  searched: boolean;              // 列が短すぎてスコア付けできなかった場合は false
  grouping: number[];             // アクセント群ごとの拍数。総和は分子に一致
  candidateScores: number[];      // 要求した分子ごとのスコア（要求した順）
  candidates: TimeSignature[];    // 支持の高い順に並んだ拍子
}
```

位置引数形式はなく、`estimateMeter` はリクエストオブジェクトのみを受け取ります。アクセント列は
自身の最大値で正規化されるため、事前のスケーリングは不要です。想定する入力元は
`AnalysisResult.beatObservations.onsetStrength` で、`beats[].strength` でも動きますが、これは
[Beat](./js-api-types.md#beat) で述べる生の 1 フレーム値です。

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

**`timeSignature.confidence` もフォールバックの一部です。** 値は `0.5` ですが、これは測定値では
なく定数です。信頼度を表示したり分岐に使ったりする前に `searched` を確認してください。短すぎる
列から返ってきた `0.5` は、値だけを見てもスコアが本当に中程度だった場合と区別できません。
なお `beatTimes` が空の場合はフォールバックではなく例外になります。1〜7 拍ならフォールバックが
返ります。
:::

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
| 分解とリミックス | `decompose(...)`, `decomposeWithInit(...)`, `decomposeStems(...)`, `nnFilter(...)`, `remix(...)`, `remixAlignedIntervals(...)`, `phaseVocoder(...)`, `hpssWithResidual(...)` | NMF 分解、初期化方式を選べる NMF、マスクベースのステム出力、近傍フィルタ、区間リミックス、チャンネル間で一貫したカット位置、時間スケーリング、残差付き HPSS。 |
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

音源を分解し、成分を因子行列ではなく**オーディオ**として返します。

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

::: warning NNDSVD の初期化は倍精度で計算される
`init: 'nndsvd'` を指定した場合、SVD によるウォームスタートは倍精度で計算されます。これが
初期値の**再現性**を担保します。振幅スペクトログラムの末尾の特異ベクトルは単精度のノイズ
フロアちょうどに位置するため、float の初期値は総和の順序に依存し、同じ入力でもプラットフォーム
ごとに異なる成分が返ってきます。倍精度にすることでこの依存がなくなります。

これは再現性の性質であって精度の話ではありません。形状・非負性・再構成品質は変わりません。
ただし因子そのものは、単精度の初期値が生成していた数値とは異なります。**`w` / `h` を保存して
いる**場合や、以前レンダリングしたステムと差分を取っている場合は、値が異なることを前提にして
ください。不一致をバグと決めつけず、保存済みの因子は再計算してください。
`decomposeWithInit(..., 'nndsvd')` についても同様です。
:::

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
