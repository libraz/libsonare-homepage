---
title: 楽曲解析
description: libsonare の音楽情報検索（MIR）を使うためのタスクガイド。一括解析、ビートと拍子、キーとコード、構成、メロディ、音源分離、そして各結果を解説する用語集ページへの道案内。
---

# 楽曲解析

**楽曲解析**は、録音を聴いてその中身を報告する libsonare の機能群です。テンポ、ビートの位置、キーとコード、セクション構成、メロディの動きを取り出します。

このページはタスク層です。どの関数を呼ぶか、返ってきた値が実際には何を意味するか、そしてより詳しい説明がどこにあるかを示します。概念そのものは[用語集](./glossary/analysis/beats-downbeats.md)が、フィールド単位のリファレンスは [JavaScript 解析 API](./js-api-analysis.md) が担当します。このページは判断のために使ってください。

::: tip 解析はパイプラインのどこに位置するか
**解析**は録音が何であるかを教えます。**編集**は 1 トラックを変え、**ミキシング**は複数をまとめ、**マスタリング**は仕上がったステレオを整えます。解析は他の工程が参照する段階でもあります。ジャンル別のマスタリング目標、検出ビートから引いたグリッド、ピッチ追跡の前に取り出したステムなどです。
:::

## このページで学べること

読み終えると、次のことができるようになります。

- テンポ、キー、ビート、コード、セクション、メロディ、音色、ダイナミクスを 1 回の呼び出しでまとめて得る
- 一括結果が粗すぎるとき、または必要なオプションが隠れているときに、個別のヘルパーを選ぶ
- 拍子推定の 2 つの `confidence` を取り違えず、実測とフォールバックを見分ける
- キーの信頼度を、精度ではなくモデル自身の確信度として解釈する
- 3 つの音源分離ルートを使い分け、それぞれが何を取り出せて何を取り出せないかを把握する
- 互換レイヤーのほうが入口として適している場面を判断する

## まず 1 回の呼び出しから

`analyze(...)` は全チェーンを実行し、すべてを一度に返します。ほとんどのアプリケーションではこれが最初の呼び出しとして正解です。共有されるスペクトル層を一度だけ計算し、そこから各推定器が答えを読み取ります。

```typescript
import { init, analyze } from '@libraz/libsonare';

await init();

// デコードはブラウザ、解析は libsonare。
const ctx = new AudioContext();
const response = await fetch('track.mp3');
const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
const samples = buffer.getChannelData(0); // モノラルの Float32Array

const result = analyze({ samples, sampleRate: buffer.sampleRate });

console.log(result.bpm, result.bpmConfidence);
console.log(result.key.name, result.key.confidence);
console.log(result.timeSignature.numerator, result.timeSignature.denominator);
console.log(result.beats.length, result.downbeatIndices.length);
console.log(result.chords.length, result.sections.length, result.form);
console.log(result.chords[0]?.name, result.chords[0]?.romanNumeral);
```

`sampleRate` を省略すると既定の 22050 Hz が使われるので、バッファ本来のレートを必ず渡してください。誤ったレートは時間領域の結果すべてを黙ってスケールし直します。この呼び出しは同期で、WASM ビルドはシングルスレッドです。短いクリップでなければ Web Worker から駆動してください。`analyzeWithProgress(...)` は同じ解析オプションを受け取り、`(progress, stage)` を通知し、長いリクエストをキャンセルできます。

::: warning `analyze()` はトライアドしか探索しない
一括パスは `useTriadsOnly` を `true` にします。単体の `detectChords(...)` は `false` のままです。`useTriadsOnly: false` を渡すまで、セブンスコードはその中のトライアドとして返ります。拡張クオリティが必要なら明示的に渡してください。
:::

## すべての推定器が乗る共通チェーン

ここにあるものは、ファイルを読み直す別々のアルゴリズムではありません。デコード済みサンプルがフレームごとの短時間スペクトルになり、その 1 つの行列が特徴量の層へ分岐し、各推定器は必要な特徴量から判断を読み取ります。

<AnalysisPipelineFigure
  title="デコード済みサンプルから答えまで"
  :labels="{
    melSpectrogram: 'melSpectrogram',
    mfcc: 'mfcc',
    chroma: 'chroma',
    onsetEnvelope: 'onsetEnvelope',
    rmsEnergy: 'rmsEnergy',
    zeroCrossingRate: 'zeroCrossingRate',
    pitchYin: 'pitchYin',
    pitchPyin: 'pitchPyin',
    detectKey: 'detectKey',
    detectChords: 'detectChords',
    analyzeSections: 'analyzeSections',
    detectBpm: 'detectBpm',
    detectBeats: 'detectBeats',
    analyzeMelody: 'analyzeMelody',
    decode: 'デコード',
    decodeSub: 'モノラル Float32Array',
    stft: 'STFT',
    stftSub: '1 つの行列を共有',
    features: '特徴量',
    featuresSub: '時間方向の行列',
    estimators: '推定器',
    estimatorsSub: '1 つの判断',
    audio: 'Audio',
    audioSub: 'fromMemory → data',
    stftParams: 'nFft・hopLength',
    bypass: 'STFT を通らない',
    noteOnce: 'analyze() は STFT を一度だけ計算し、同じ行列をすべての推定器に渡します。',
    noteEach: '単一の答えを返すヘルパー（detectBpm、detectKey など）は毎回サンプルから組み直します。',
    legendStft: 'STFT を経由して計算',
    legendTime: 'サンプルから直接読む',
    legendEstimator: '推定器 — 特徴量から 1 つの判断',
  }"
  caption="STFT は一度だけ計算して共有されます。メルが MFCC とオンセットエンベロープへ、クロマがキー・コード・セクションのラベル付けへ、オンセットエンベロープがテンポとビート追跡へ流れます。下段のレールはそこを通らない経路です。レベル、ゼロ交差率、ピッチ追跡は波形を直接読むため、スペクトル経路が苦手とする素材でもメロディは生き残ります。"
/>

この配置はコストの違いも説明します。`analyze(...)` は STFT の費用を一度だけ払い、同じ行列をすべての推定器へ渡します。単一の答えを返すヘルパーは毎回サンプルからチェーンを組み直すので、4 つ呼べばおよそ 4 回分の解析になります。ヘルパーは 1 つのフィールドだけが欲しいとき、または一括呼び出しが隠しているオプションが必要なときに使うもので、処理を節約するためのものではありません。

## 呼び出しの選び方

| 知りたいこと | 呼び出し | 解説の場所 |
|--------------|----------|------------|
| すべてを一度に | `analyze(...)` · `analyzeWithProgress(...)` | このページと [JavaScript 解析 API](./js-api-analysis.md) |
| 速さ | `detectBpm(...)` · `analyzeBpm(...)` | [テンポと BPM](./glossary/analysis/tempo-bpm.md) |
| ビートと小節線の位置 | `detectBeats(...)` · `detectDownbeats(...)` | [ビートとダウンビート](./glossary/analysis/beats-downbeats.md) |
| すべての打点 | `detectOnsets(...)` · `onsetEnvelope(...)` | [オンセット検出](./glossary/analysis/onset-detection.md) |
| 拍子記号 | `estimateMeter(...)` | [拍子とグルーピング](./glossary/analysis/meter-and-grouping.md) |
| キー | `detectKey(...)` · `detectKeyCandidates(...)` | [キー検出](./glossary/analysis/key-detection.md) |
| コード進行 | `detectChords(...)` · `chordFunctionalAnalysis(...)` | [コード認識](./glossary/analysis/chord-recognition.md) |
| 曲の構成 | `analyzeSections(...)` · `detectBoundaries(...)` | [セクションと構成](./glossary/analysis/section-structure.md) |
| メロディの動き | `analyzeMelody(...)` · `pitchYin(...)` · `pitchPyin(...)` | [メロディとピッチ](./glossary/analysis/melody-pitch.md) |
| 音色 | `analyzeTimbre(...)` · `mfcc(...)` · `melSpectrogram(...)` | [メル・MFCC・音色](./glossary/analysis/mel-mfcc-timbre.md) |
| 時間軸上の和声行列 | `chroma(...)` · `chromaCqt(...)` · `nnlsChroma(...)` | [クロマ特徴量](./glossary/analysis/chroma-features.md) |
| 生の時間周波数表現 | `stft(...)` · `melSpectrogram(...)` | [スペクトログラムと STFT](./glossary/analysis/spectrogram-stft.md) |
| モノラル／マルチチャンネルのミックスの分割 | `hpss(...)` · `decomposeStems(...)` · `decomposeStemsLinked(...)` | 後述の[音源分離](#音源分離) |

`analyze(...)` はテンポ、拍子、ビート、キー、コード、セクション、メロディ、音色、ダイナミクス、リズムの主な結果を含みます。特徴量行列、低レベルの変換、ステム分離には個別のヘルパーを使います。ヘルパーが要るのは、より細かく制御したいとき（テンポ範囲を狭める、別のキープロファイルを使う、拡張クオリティを含めてコードを探索する）か、答えが 1 つだけ必要で残りが無駄になるときです。

## リズム

統合時のつまずきはリズム周りに集中します。「テンポは何か」への妥当な答えが 4 種類あり、`confidence` という名前のフィールドが 2 つあるからです。順に見ていきます。

### ビート、ダウンビート、その根拠

ビート追跡は手拍子を打つような一定の拍を見つけ、ダウンビート検出はそのうちどの拍が小節の頭かを選びます。`analyze(...)` は両方と、判断に使った拍ごとの根拠を返します。

```typescript
const { beats, beatTimes, downbeatIndices, beatObservations } = analyze({
  samples,
  sampleRate,
});

// beats[downbeatIndices[k]] が k 番目の小節頭。
const isDownbeat = new Set(downbeatIndices);
for (const [index, beat] of beats.entries()) {
  console.log(beat.time.toFixed(3), isDownbeat.has(index) ? 'bar' : 'beat');
}
```

| フィールド | 内容 |
|------------|------|
| `beatTimes` | 秒単位のビート位置を `Float32Array` で。 |
| `beats` | 同じ位置をオブジェクトで表したもの。各要素が `strength` を持つ。 |
| `downbeatIndices` | 検出した小節頭ごとに 1 つの、`beats` への*インデックス*。並行配列でも第 2 の時系列でもないので、ダウンビート判定は所属チェックで行う。 |
| `downbeatPhase` | 曲頭が最初の小節の何拍目から始まるか。拍子推定器が出す値で、後からダウンビートが精緻化されても再計算されないため、`downbeatIndices[0]` と食い違うことがある。 |
| `beatObservations` | 判断の根拠となるアクセント情報。`onsetStrength`、`lowFrequencyEnergy`、`chordChange` の 3 本で、いずれも 1 拍につき 1 値。解析が生成できなかったストリームは空で返り、これは「全拍が 0 点だった」とは別の状態。 |
| `beatLocalBpm` | 各拍における平滑化テンポ。`computeTempoCurve: true` を指定しない限り空で、テンポが動く素材では `adaptiveTempo: true` も必要。 |

`beats[].strength` と `beatObservations.onsetStrength` は交換できません。前者はオンセットエンベロープを拍の位置で 1 フレームだけ読んだ生の値で、上限がなく、拍位置の揺れにそのまま影響されます。後者は拍の周囲の窓で集約した値で、ライブラリ自身のダウンビート判定が採点しているのはこちらです。拍どうしのアクセントを比較する用途では `onsetStrength` を使ってください。

### テンポ

| 経路 | 返るもの | 使いどころ |
|------|----------|------------|
| `analyze(...)` の `result.bpm` | 数値 1 つと `bpmConfidence`、さらに `primary` / `half` / `double` / `other` のラベル付き `bpmCandidates` | すでに一括解析を回している場合。候補の関係ラベルは倍取り・半分取りを検知する手がかりになる。 |
| `detectBpm(...)` | 数値 1 つ | テンポだけが欲しい場合。 |
| `analyzeBpm(...)` | `bpm`、`confidence`、順位付き `candidates`、その根拠である `autocorrelation` と `tempogram` | 根拠を見せたい、または範囲を絞って探索したい場合。既定値は `bpmMin` 30、`bpmMax` 300、`startBpm` 120、`maxCandidates` 5。 |
| `analyzeRhythm(...)` | 局所的な拍周期から精緻化した独自の `bpm` と、グルーヴ、シンコペーション、規則性、`beatIntervals` | 数値よりもリズムの性格が欲しい場合。既定範囲は狭く `bpmMin` 60、`bpmMax` 200。 |

`analyzeRhythm(...)` の `bpm` は意図的に第 3 の数値です。ビート追跡が落ち着いたグリッドから測っており、合成クリック列に対する計測では、どちらのテンポ入口よりも既知テンポに近い値になります。3 つが小数点まで一致することは期待しないでください。

### 拍子： `estimateMeter`

`estimateMeter(...)` は、渡したビート列の上で候補となる拍子記号を採点します。音声もフレーム単位のエンベロープも不要なので、既存の解析結果の任意の区間（たとえば 1 セクション分）を、解析をやり直さずに採点できます。

```typescript
import { analyze, estimateMeter } from '@libraz/libsonare';

const result = analyze({ samples, sampleRate });

const meter = estimateMeter({
  beatTimes: result.beatTimes,
  beatStrengths: result.beatObservations.onsetStrength,
  candidateNumerators: [3, 4, 6], // 既定値
  denominator: 4,                 // 既定値
});

console.log(meter.timeSignature, meter.grouping, meter.downbeatPhase);
```

渡すのは `beats[].strength` ではなく `beatObservations.onsetStrength` です。どちらも事前スケーリングは不要で、採点前に系列自身の最大値で割られるため、読まれるのは内部のアクセント差だけです。`onsetEnvelope(...)` のフレームから自分で列を組み立てることも避けてください。その読み取り値はサンプルレートで変わり、ブラウザは出力デバイスのレートでデコードするため、同じクリップが訪問者ごとに違う答えを返します。実測は[拍子とグルーピング](./glossary/analysis/meter-and-grouping.md#どのアクセント列を渡すか)にあります。

<SonareDemo id="meter-estimate" />

このデモでは断定よりも順位を見てください。素直な 4 拍子を 4 小節鳴らすと、支持の大半は 4 が取りますが 6 にも相応の分が残ります。1 小節おきの強拍は 6 拍の区切りの開始点でもあるからです。表示を「ビート」に切り替えると、採点の土台になった拍が見えます。

答えのもう半分は `grouping` です。小節が 2 拍と 3 拍のアクセント群にどう分かれるかを表し、7 拍なら裸の 7 ではなく `[3, 2, 2]` として返り、合計は必ず分子に一致します。要素が 1 つだけなら内部分割は解決されていません。複合拍子と単純拍子を見分けるのもこのフィールドです。拍ごとのアクセントからは拍の内部分割が分からないため、3 拍ずつにアクセントが乗った 6 は、要求された分母のまま `[3, 3]` として報告されます。

#### `confidence` という名前のフィールドが 2 つある

ここが最も間違えやすい箇所です。取り違えると、もっともらしく見えて意味の違う数値が表示されます。

| フィールド | 正体 | 値域と挙動 |
|------------|------|------------|
| `timeSignature.confidence` | **マージン由来**の値。勝った候補が 2 位をどれだけ引き離したかを、スコア自身のノイズ単位で測って信頼度に写したもの。 | マージンが無い状態が 0.45 で、そこから上がります。つまり 2 候補が拮抗していても約 0.45 になり、確率ではなく分離度を表します。複合拍子か単純拍子か決着しない場合は一定量が引かれます。 |
| `candidates[k].confidence` | **正規化された割合**。各候補の正のスコアを全候補の合計で割った値。 | 支持の内訳として読め、合計は 1 になります。0.6 の候補は支持の 60 % を占めるという意味で、正解である確率が 60 % という意味ではありません。 |

したがって、明確な 3 拍子では `candidates[0].confidence` がほぼすべての支持を示していても `timeSignature.confidence` は 1 よりかなり低いままになりえますし、本当に曖昧なクリップでも 2 位がたまたま大きく離れていれば `timeSignature.confidence` は高く出ます。答えている問いが別なので、自分の問いに合うほうを選び、UI ではそれに合わせて表示し、両方を 1 つのしきい値に通すことは避けてください。それぞれの計算式は[拍子とグルーピング](./glossary/analysis/meter-and-grouping.md#同じフィールド名を持つ-2-つの信頼度)にあります。

さらに、順序に関する 2 点も間違えやすいところです。

- `candidates` は**順位表**で、`k` 番目の要素が k 番目に良い仮説です（選ばれた拍子記号が先頭に置かれます）。`candidateScores` は**要求した分子と並行**で、渡した順に並びます。両者のインデックスは対応しません。
- `candidateScores` は標準化された符号付きの値です。0 は拍子を持たないビート列で分子が到達する水準なので、負の値はノイズ以下の支持を意味します。スコアは採点したビート数の平方根に比例して大きくなるため、長さの違う区間どうしのスコアは、長さを正規化しない限り比較できません。

#### 短い区間ではそもそも探索されない

検出ビートが **8 個未満**だと、推定器は探索を行いません。それでもフィールドの埋まった結果は返ります。4/4、`timeSignature.confidence` は **0**、分割されていない `grouping`、候補 1 件、スコアは全部 0 です。そしてそれを教えてくれるのは `searched` だけです。信頼度が 0 なので、確認せずに読んだ場合は「中程度の検出」ではなく「不明」の側へ倒れます。それでも隣に並ぶ 4/4 は、検出結果とまったく同じ見た目です。

```typescript
const meter = estimateMeter({
  beatTimes: result.beatTimes,
  beatStrengths: result.beatObservations.onsetStrength,
});

if (!meter.searched) {
  // 何も計測されていない。timeSignature.confidence は 0 で、
  // 他のフィールドはすべて固定のフォールバック値。
  console.log('too few beats to estimate a meter');
} else {
  console.log(meter.timeSignature.numerator + '/' + meter.timeSignature.denominator);
}
```

このフォールバックはもっともらしい 4/4 であり、だからこそフラグが存在します。短いクリップ、静かなイントロ、材料の乏しいビート追跡のいずれもが同じ答えに行き着き、それを実測と区別できるのは `searched` だけです。描画する前に必ず確認してください。

<SonareDemo id="meter-estimate-three" />

上のワルツは、4 拍子のクリップと並べる価値のある対比です。4 拍や 6 拍の小節を支持する材料が素材に無いため、3 がほぼすべての支持を取り、他は落ちます。自信のある推定と割れている推定は見え方が違い、その違いを教えてくれるのが内訳です。

## ハーモニー

### キー

```typescript
import { detectKey, detectKeyCandidates } from '@libraz/libsonare';

const key = detectKey({ samples, sampleRate, profile: 'temperley' });
console.log(key.name, key.shortName, key.confidence);

const ranked = detectKeyCandidates({ samples, sampleRate, modes: 'all' });
for (const { key: candidate, correlation } of ranked.slice(0, 3)) {
  console.log(candidate.shortName, correlation.toFixed(3));
}
```

`Key.confidence` は、採点されたすべての候補のプロファイル相関に対する**ソフトマックス**です。2 位が迫るほど下がるので、根拠が割れる 2 つのキー（典型的には平行調どうし）はそれぞれ約半分を報告します。つまり曖昧さの指標としては優秀ですが、精度の主張としては不適切です。クロマがこのキーを候補集合からどれだけ決定的に選び出したかを示すだけで、その選択が実際に当たる頻度は示しません。注釈付き録音に対する学習も行っていないため、自信のある誤答は十分ありえます。ここで分岐するパイプラインは、自分の素材に対して自分でしきい値を決めてください。

`detectKeyCandidates(...)` は代わりに候補ごとの生の `correlation` を正規化せずに返します。単一の確信度ではなく判断の形そのものを調べたいときはこちらです。

| オプション | 効果 |
|------------|------|
| `profile` | 相関を取るキープロファイル。`'ks'` / `'krumhansl'`、`'temperley'`、`'shaath'`、3 種類の EDM 用、`'bellman-budge'` から選べます。ジャンルによる差が大きいので、結果が系統的にずれているときに最初に試す値です。 |
| `modes` | `'major-minor'`、`'modal'`、`'all'`、または明示リスト。モード集合を広げるとソフトマックスが正規化する候補プールも広がるため、首位が変わらなくても信頼度は下がります。 |
| `genreHint` | 素材のジャンルは分かるがプロファイルまでは決められないときに、ヒューリスティックに選ばせる指定。 |
| `useHpss` · `loudnessWeighted` · `highPassHz` | 相関を取る前にクロマを整えます。打撃成分を落とす、知覚的な音量で重み付けする、低域を削る、の 3 つ。 |

### コード

```typescript
import { detectChords, chordFunctionalAnalysis } from '@libraz/libsonare';

const chordOptions = {
  useTriadsOnly: false,   // 拡張クオリティを含める
  useHmm: true,           // フレームごとではなく系列として平滑化する
  useKeyContext: true,
  keyRoot: key.root,
  keyMode: key.mode,
  chromaMethod: 'nnls',
} as const;

const { chords } = detectChords({ samples, sampleRate, ...chordOptions });

for (const chord of chords) {
  console.log(chord.name, chord.start.toFixed(2), chord.duration.toFixed(2), chord.confidence);
}

// 同じオプションを渡すので、roman[i] が chords[i] のラベルになる
const roman = chordFunctionalAnalysis({ samples, sampleRate, ...chordOptions });
```

各 `Chord` は `root`、`bass`、`quality`、`start`、`end`、`duration`、`confidence`、そしてコアが正規の綴りで与える `name` を持ちます。`rootName`、`bassName`、`name` はどのバインディングから読んでも同一です。`analyze(...)` 内のコードには `result.key` を基準にした `romanNumeral` も付き、`N.C.` では空になります。

クオリティの網羅範囲はトライアドや素のセブンスをはるかに超えています。`maj`、`m`、`dim`、`aug`、`7`、`maj7`、`m7`、`m7b5`、`dim7`、`sus2`、`sus4`、`sus2add4`、`add9`、`madd9`、`maj9`、`9` に加えて、**`6`**、**`m6`**、**`mM7`**、**`7sus4`**、**`11`**、**`13`**、**`7b9`**、**`7#9`** も認識します。オンコードはベース音を付け足して `C/E` のように表記されます。相関が `threshold` を下回った区間は、無理に推測せず不明として報告されます。

| オプション | 効果 |
|------------|------|
| `useTriadsOnly` | ここでは `false`、`analyze(...)` の内部では `true`。上記のクオリティが欲しければ false のままに。 |
| `useHmm` · `hmmBeamWidth` | 進行をフレーム単位ではなく系列としてデコードします。単フレームのちらつきはほぼ消えます。 |
| `useKeyContext` · `keyRoot` · `keyMode` | 検出済みのキーに属するコードへ探索を寄せます。 |
| `chromaMethod` | `'stft'` か `'nnls'`。後者は照合前にベースの倍音を抑えるので、密度の高い素材で有効です。 |
| `detectInversions` | ベース音をルートに畳み込まず、別に報告します。 |
| `tuning` | チューニングのずれを半音の分数単位でコード用クロマへ反映します。`estimateTuning(...)` が返す単位を使い、範囲は `[-0.5, 0.5)`、既定値は `0`（A440）です。`analyze(...)` でも同じオプションを使うと、キー・コード・セクションに使うクロマへ反映されます。 |
| `useBeatSync` · `minDuration` · `smoothingWindow` | フレーム単位の判断を区間へまとめる方法を制御します。 |

## 構成とメロディ

### セクション

```typescript
import { analyzeSections, detectBoundaries } from '@libraz/libsonare';

const sections = analyzeSections({ samples, sampleRate, minSectionSec: 4 });
for (const section of sections) {
  console.log(section.name, section.start.toFixed(1), section.energyLevel, section.confidence);
}

const { boundaries, noveltyCurve, noveltyPeak } = detectBoundaries({ samples, sampleRate });
```

`analyzeSections(...)` はラベル付きの区間を返します。イントロ、ヴァース、コーラス、ブリッジ、インストゥルメンタル、アウトロ、または不明です。`detectBoundaries(...)` はその下にあるラベルなしの層で、遷移点と、それを拾い出した連続的なノベルティ曲線を返します。自前のしきい値を当てるにはこちらが必要です。セクション一覧を粗くした表現ではありませんし、どちらか一方から他方を導くこともできません。

想定しておくべき挙動が 2 つあります。プリコーラスには検出分岐が無いため、このラベルで絞り込むと常に空になります。そして不明は 3 つの異なる状況をまとめたラベルです。境界が見つからなかった、どの肯定分岐にも当てはまらなかった、機能を断定するには根拠が弱すぎた、の 3 つで、最初のものは `confidence` 0 を、最後のものはしきい値未満のスコアをそのまま保持するので、数値からどれなのかが分かります。

`noveltyCurve` は自身の最大値でスケールされています。ピークの 1 は「この曲の中で最も変化の大きいフレーム」という意味であって「大きな変化」という意味ではありません。絶対しきい値と比較される生の応答に戻すには `noveltyPeak` を掛けます。

### メロディとピッチ

```typescript
import { analyzeMelody } from '@libraz/libsonare';

const melody = analyzeMelody({ samples, sampleRate, usePyin: true, fmin: 65, fmax: 2093 });

console.log(melody.meanFrequency, melody.pitchRangeOctaves, melody.vibratoRate);
const voiced = melody.points.filter((point) => point.frequency > 0);
```

ピッチ追跡は STFT ではなく波形を直接読み、**単旋律**の素材、つまり同時に 1 音だけが鳴る素材を前提とします。ソロボーカル、リードライン、あるいは先に分離したステムに対して使ってください。フルミックスに掛けると、その瞬間に支配的な音をフレームごとに追いかけます。

`points[].frequency` は無声フレームで `0` になるので、平均を取る前に除外します。`usePyin: true` は Viterbi で平滑化した追跡器を選びます。コストは上がりますが、素の YIN に比べてオクターブ飛びが格段に減るため、ユーザーに見せる用途では通常こちらです。既定の探索範囲は `fmin` 65 Hz から `fmax` 2093 Hz、有声判定の `threshold` は 0.1 です。実際に扱う楽器に合わせて範囲を狭めるのが、ここで最も安上がりな精度向上です。

## 音源分離

ルートは 3 つあり、それぞれ別の問いに答えます。

<SonareDemo id="stem-decompose" />

上のデモは倍音成分と打撃成分の分割です。パッドの和音の上に拍ごとの広帯域の打点が乗っており、B 側はその打撃成分だけです。持続するスペクトル線は押し出され、打点は短い縦方向のイベントとして残ります。これは 2 分割の片側であって、複数楽器への分離ではありません。

```typescript
import { hpss, hpssWithResidual, decomposeStems } from '@libraz/libsonare';

// 固定された軸での 2 分割：持続音か過渡音か。
const { harmonic, percussive } = hpss({ samples, sampleRate });

// 同じ分割で、残差を表に出す。
const hard = hpssWithResidual({ samples, sampleRate, hardMask: true });

// 教師なしの成分分解。どの成分もそのまま聴ける。
const { components, w, h } = decomposeStems({
  samples,
  sampleRate,
  nComponents: 4,
  maskPower: 2, // Wiener 型。分離は強いが、共有する倍音でアーティファクトが増える
});
```

| | `hpss(...)` | `decomposeStems(...)` |
|---|-------------|------------------------|
| 分割を決めるもの | 固定された軸。時間方向のメディアンフィルタが持続音を、周波数方向が過渡音を残す | 非負値行列因子分解が、素材そのものから `nComponents` 個の反復するスペクトル形状を学習する |
| 返るもの | 倍音成分と打撃成分の 2 信号、および残差 | 成分ごとの信号 1 本ずつと、成分行列 `w`・アクティベーション行列 `h` |
| ラベル | あらかじめ分かっている | 無い。`w` と `h` を見てどの成分が何かを判断する |
| 再構成 | 出力を足すと入力に戻る | モデルにエネルギーがある領域でマスクの和が 1 になるため、成分を足すと入力に戻る |
| 位相 | 元のまま | 元のまま。複素スペクトログラムにマスクを掛けるので、各成分がそのまま聴ける |

覚えておくとよい既定値。メディアンフィルタのカーネルはどちらも 31 で、既定のソフトマスクでは 2 つのマスクの和がすでに 1 になるため `hpssWithResidual(...)` の残差は無音です。どちらの成分も主張しなかった帯域を残差として得たい場合は `hardMask: true` を渡します。`decomposeStems(...)` と `decomposeStemsLinked(...)` の NMF の既定値は同じで、成分 4 個、`nFft: 2048`、`hopLength: 512`、反復 100 回、`beta: 2`（Frobenius。Kullback-Leibler なら `1`）、`init: 'random'`、`maskPower: 1`（振幅比）です。`decomposeStemsLinked(...)` は `sampleRate` を省略すると `22050` を使います。

マルチチャンネルの録音には `decomposeStemsLinked(...)` を使います。各チャンネルの振幅スペクトログラムを平均して 1 つの NMF モデルと成分マスクを作り、そのマスクを各チャンネルの元の複素スペクトログラムへ同じまま適用します。チャンネル間のレベル差と位相差が保たれるため、成分を分離してもステレオの定位は動きません。

入力は同じ長さの `Float32Array` を少なくとも 1 つ渡し、チャンネル数を 64 以下にします。結果の `components[k][c]` は成分 `k` のチャンネル `c` の信号です。`w`、`h`、`sampleRate` の意味は `decomposeStems(...)` と同じです。1 チャンネルだけ渡すと、同じオプションの `decomposeStems(...)` とビット単位で一致します。

::: code-group

```typescript [Browser]
import { init, decomposeStemsLinked } from '@libraz/libsonare';

await init();

const linked = decomposeStemsLinked({
  channels: [leftChannel, rightChannel], // 同じ長さの Float32Array
  sampleRate,
  nComponents: 4,
});
const firstLeft = linked.components[0][0];
const firstRight = linked.components[0][1];
console.log(linked.w.length, linked.h.length);
```

```typescript [Node]
import { decomposeStemsLinked } from '@libraz/libsonare-native';

const linked = decomposeStemsLinked({
  channels: [leftChannel, rightChannel], // 同じ長さの Float32Array
  sampleRate,
});
const firstLeft = linked.components[0][0];
const firstRight = linked.components[0][1];
```

```python [Python]
import libsonare as sonare

linked = sonare.decompose_stems_linked(
    [left_channel, right_channel], sample_rate=sample_rate, n_components=4
)
first_left = linked["components"][0][0]
first_right = linked["components"][0][1]
print(linked["w"].shape, linked["h"].shape)
```

```bash [CLI]
# CLI はモノラルの `decompose-stems` だけを提供します。
# 複数チャンネルで 1 つの NMF モデルを共有する場合はライブラリ API を使います。
```

:::

どのルートも学習済みの楽器分離器ではなく、密なミックスからきれいなボーカルだけを取り出すものでもありません。得意なのは後段の推定器の仕事を楽にすることです。打撃成分でビート追跡、倍音成分でクロマとキー、リードが分離できた成分でピッチ追跡、またはステレオの定位を保ったマルチチャンネル処理、といった使い方になります。

## その下の層

上のすべての推定器は特徴量を読んでいるだけで、その特徴量は直接使えます。推定器がカバーしていないものを自分で作るときに役立ちます。

```typescript
import { stft, melSpectrogram, chroma, mfcc, onsetEnvelope, spectralCentroid } from '@libraz/libsonare';

const spectrum = stft({ samples, sampleRate, nFft: 2048, hopLength: 512 });
const mel = melSpectrogram({ samples, sampleRate, nMels: 128 });
const pitchClasses = chroma({ samples, sampleRate });
const timbre = mfcc({ samples, sampleRate, nMfcc: 13 });
const envelope = onsetEnvelope({ samples, sampleRate });
const brightness = spectralCentroid({ samples, sampleRate });
```

`nFft` は 1 つの解析窓の長さ、`hopLength` は次の窓を何サンプル先から始めるかで、周波数の細かさと時間の細かさのトレードオフを決めます。結果を最も左右する 2 つのパラメータです。特徴量群はほかに CQT とその派生、トネッツ、スペクトルコントラスト、ロールオフ、平坦度、帯域幅、フラックス、フレームごとのレベルとゼロ交差率、そしてスペクトログラムを音声へ戻す逆変換も備えています。一覧は [JavaScript 特徴抽出 API](./js-api-features.md) にあります。

## このページか、互換レイヤーか

libsonare は同じ DSP を 2 通りに公開しています。このページの楽曲解析 API は音楽的な問いに沿った形をしていて、音楽的なオブジェクトを返します。互換レイヤーは Python の特徴抽出ライブラリ librosa に合わせた形で、関数名も引数名も配列の形も揃えてあります。

既存の Python 解析コードを移植する、公開されたパイプラインを再現する、手元にある結果と数値を突き合わせる、といった場合は互換レイヤーを選びます。新しいものを作るならこのページの API です。解釈が必要なクロマ行列ではなく、コード一覧をそのまま返してくれます。両者はコアを共有しているので、1 つのアプリケーションで混ぜても問題ありません。対応表と、意図的に異なる箇所については [librosa 互換性](./librosa-compatibility.md) を参照してください。

## 関連ページ

- [ビートとダウンビート](./glossary/analysis/beats-downbeats.md) · [テンポと BPM](./glossary/analysis/tempo-bpm.md) · [拍子とグルーピング](./glossary/analysis/meter-and-grouping.md) — リズムの概念と、推定器が置いている前提
- [キー検出](./glossary/analysis/key-detection.md) · [コード認識](./glossary/analysis/chord-recognition.md) · [クロマ特徴量](./glossary/analysis/chroma-features.md) — 和声をどう測っているか
- [セクションと構成](./glossary/analysis/section-structure.md) · [メロディとピッチ](./glossary/analysis/melody-pitch.md) · [オンセット検出](./glossary/analysis/onset-detection.md) — 構成、旋律、打点
- [スペクトログラムと STFT](./glossary/analysis/spectrogram-stft.md) · [メル・MFCC・音色](./glossary/analysis/mel-mfcc-timbre.md) — すべての土台になる共通層
- [JavaScript 解析 API](./js-api-analysis.md) · [JavaScript 特徴抽出 API](./js-api-features.md) — フィールド単位のリファレンス
- [librosa 互換性](./librosa-compatibility.md) — 同じコアへのもう 1 つの入口
- [ルーム音響解析](./acoustic-analysis.md) — 音楽ではなく録音空間の解析
- [はじめに](./getting-started.md) — 導入と最初のファイルのデコード
