---
title: リアルタイムとストリーミング
description: libsonare のストリーミング API。ライブ MIR フレームと更新される BPM／キー／コード／パターン推定を扱う StreamAnalyzer、ストリーミングのオンセット情報から得るテンポグラム、AudioWorklet エンジンブリッジ、クリップ音声のページストリーミング、表示用の波形ピークを解説します。
---

# リアルタイムとストリーミング

このページは libsonare の**ストリーミング**側を扱います。ライブの音声ストリームを解析フレームと音楽推定に変換すること、そしてクリップ音声を流しリアルタイムエンジンを音声スレッドで動かすための仕組みです。

- **`StreamAnalyzer`** — 音声ブロックを入力し、*解析フレーム*（メル、クロマ、オンセット、スペクトル）と、時間とともに更新される音楽推定（BPM、キー、コード、コード進行、パターン）を出力します。ビジュアライザーや「今この曲で何が起きているか」のライブ表示に使います。
- **エンジンのストリーミング機構** — `RealtimeEngine` を音声スレッドで動かす AudioWorklet ブリッジ、メモリに載せきれない大きなアレンジ向けのクリップ音声のページストリーミング、クリップ描画用の波形ピーク縮約です。

短く言えば、音声を入力して情報を取り出すなら `StreamAnalyzer` です。UI を作る場合、`StreamAnalyzer` はグラフ、メーター、ラベルに値を渡します。

::: tip エンジン本体を探している場合
`RealtimeEngine` の操作面 — トランスポート、レーンミキサー、グループルーティングとサイドチェイン、パラメータオートメーション、サラウンドグループバス、MIDI クリップスケジュール、外部 MIDI ルーティング — は専用ページに移りました。クリップ・MIDI・トランスポート・ミックス済み音声を*出力*として作るなら [リアルタイムエンジン](./realtime-engine.md) を参照してください。
:::

このページでいう**チャンク**や**ブロック**は、AudioWorklet などで繰り返し処理する短い音声片のことです。AudioWorklet とは、メイン／UI スレッドとは別の、リアルタイム音声スレッド上で DSP を動かす音声コールバックの実行環境です。リアルタイム処理では、音声コールバック内で重いアロケーションを避けるのが基本です。先にオブジェクトを準備し、コールバックではブロック処理だけを行います。

::: info チャンク・ブロック・フレームの違い
**チャンク**や**ブロック**は、リアルタイム入力から届く短い音声サンプルのまとまりです。**フレーム**は、その音声ブロックを解析して得た時間単位の特徴量です。入力はブロック、UI に描く結果はフレーム、と分けて考えると混乱しにくくなります。
:::

::: info サンプルレートとリサンプリング
**サンプルレート**は 1 秒が何サンプルでできているか（44100 や 48000 が一般的）です。ストリームのレートがアナライザの想定と一致しないと、処理前に別のレートへ作り直す**リサンプリング**が必要になり、余分な CPU を消費します。最初からレートを揃えておくほうが高速です。
:::

## このページで身につくこと

このページを読むと、次のことを判断・実装できるようになります。

- アプリに `StreamAnalyzer`、`RealtimeEngine`、ミキシングエンジンのどれが必要かを選べる。
- 圧縮ファイルのバイト列、デコード済みサンプル、ブロック、フレームを混同せずに音声を渡せる。
- UI 用の特徴フレームを読み出し、量子化読み出しがなぜあるかを理解できる。
- 更新される BPM／キー／コード推定を、初期値から最終結果のように扱わずに使える。
- 音声コールバック内で安全な処理と、事前準備すべき処理を区別できる。

## 初学者向けの選び方

| 作りたいもの | 最初に使うもの |
|--------------|----------------|
| スペクトログラム、クロマ、オンセット強度、ライブ BPM／キー推定を描くビジュアライザー | `StreamAnalyzer` |
| ライブのコード／進行／パターン表示 | `StreamAnalyzer.stats()` |
| テンポ、ループ、マーカー、メトロノーム、クリップ、オートメーションを持つ再生エンジン | [リアルタイムエンジン](./realtime-engine.md) |
| 再生するトラックをそのままライブでミックスする再生エンジン（レーン、バス、センド、ストリップ） | [リアルタイムエンジンのレーンミキサー](./realtime-engine.md#レーンミキサー) |
| 単体のミキサー（ワンショットまたはシーンベース、ストリップ／センド／メーター付き） | [ミキシングエンジン](./mixing.md) |
| 単純なオフラインスクリプト | このページではなく [はじめに](./getting-started.md) |

## どちらを使うか

| やりたいこと | API |
|--------------|-----|
| マイク入力や再生中のファイルからメル／クロマ／オンセットのフレームを取り出す | `StreamAnalyzer` |
| BPM、キー、現在のコード、コード進行、パターンスコアを更新しながら推定する | `StreamAnalyzer.stats()` |
| トランスポート、テンポ、ループ、マーカー、メトロノーム、クリップ、オートメーションを扱う | [リアルタイムエンジン](./realtime-engine.md) |
| 再生エンジン内でトラックごとのレーン、バス、センド、チャンネルストリップを扱う | [リアルタイムエンジンのレーンミキサー](./realtime-engine.md#レーンミキサー) |
| エンジン内の楽器へサンプル精度で MIDI クリップを再生する | [リアルタイムエンジン](./realtime-engine.md#midi-クリップスケジューリングと-sampleatppq) の `setMidiClips()` + `sampleAtPpq()` |
| メーター情報つきの AudioWorklet ブリッジを作る | `@libraz/libsonare/worklet` |
| センドやメーター付きでステム／ストリップをミックスする | [ミキシングエンジン](./mixing.md) |

::: info ランタイムごとの入口
このページの中心はブラウザ / WASM の `StreamAnalyzer`、`RealtimeEngine`、AudioWorklet ブリッジです。Python と CLI は「ライブの音声コールバック内で状態を保つ」ための同一 API ではなく、ファイルや配列をまとめて処理するバッチ API が主な入口です。

| 実行環境 | 使う入口 | 典型的な用途 |
|----------|----------|--------------|
| ブラウザ / WASM | `StreamAnalyzer`、`RealtimeEngine`、`@libraz/libsonare/worklet` | ライブ可視化、AudioWorklet、更新される BPM / キー / コード表示 |
| Python | `Audio.analyze()`、`onset_envelope(...)`、`tempogram(...)` などのバッチ関数 | ノートブック、オフライン解析、検証用スクリプト |
| CLI | `sonare analyze`、`sonare bpm`、`sonare key` など | ファイル単位の確認、バッチ処理、JSON 出力 |

Python / CLI で同じファイルを解析したい場合は [Python API](./python-api.md) と [CLI リファレンス](./cli.md) を使ってください。音声コールバック内で動かす実装例は、WASM / Worklet 側のコードだけを正として扱います。
:::

## StreamAnalyzer

`StreamAnalyzer` は音声ブロックを処理し、UI 描画用のフレームバッファを出力します。スペクトログラム、クロマ表示、オンセットに反応するビジュアル、音が増えるにつれて更新される音楽推定に向いています。一度構築し、受け取ったブロックごとに `process()` し、たまったフレームを読み出します。

最初の実装では、ループを単純に保つと分かりやすくなります。

1. 音声デバイスと同じ `sampleRate` でアナライザを 1 つ作る。
2. デコード済み音声またはライブ入力のブロックごとに `process(block)` を呼ぶ。
3. 描画には `readFrames(...)`、現在の音楽推定には `stats()` を読む。
4. 最初の数秒の BPM／キー／コードは仮の値として扱い、音声が増えるほど安定すると考える。

下のデモは、同じ「音声を入れて、マーカーを取り出す」考え方を視覚化したものです。オンセット検出は各打点を示し、ビート追跡はそれらをより安定した拍へまとめます。

<SonareDemo id="beat-tracking" />

::: info メル・クロマ・オンセットを一言で
- **メル** — 時間ごとの周波数帯域エネルギーを、知覚的な音高スケールで並べたスペクトログラムです。「どんな音か」を示すヒートマップに向きます。
- **クロマ** — エネルギーを 12 の音高クラス（C、C#、… B）へ畳み込んだものです。ハーモニーやキーの表示に向きます。
- **オンセット** — 新しいノートやビートが始まると跳ね上がる強度曲線です。ビート／テンポに反応する可視化に使えます。
:::

::: tip `nFft` と `hopLength` を一言で
アナライザは内部で STFT を実行します。

| パラメータ | 意味 | 値を大きく／小さくしたとき |
|------------|------|-----------------------------|
| `nFft` | 解析窓のサイズ（サンプル数） | 大きいほど周波数は細かく、時間は粗くなります |
| `hopLength` | フレーム間で窓を進める量 | 小さいほど 1 秒あたりのフレームが増え、CPU 負荷も増えます |

下記の `2048`/`512` は一般的な出発点です。なじみがなければ [MIR の全体像](./glossary/concepts/mir-overview.md) を参照してください。
:::

```typescript
import { init, StreamAnalyzer } from '@libraz/libsonare';

await init();

const analyzer = new StreamAnalyzer({
  sampleRate: audioCtx.sampleRate,
  nFft: 2048,
  hopLength: 512,
  nMels: 64,
  computeMel: true,
  computeChroma: true,
  computeOnset: true,
  emitEveryNFrames: 4,   // スロットル: 4 ホップごとに 1 フレーム出力
  maxPendingFrames: 256, // 未読出力を制限。超過時は最古フレームを破棄
});

analyzer.process(inputBlock);

const frames = analyzer.readFrames(analyzer.availableFrames());
const stats = analyzer.stats();

if (stats.estimate.updated) {
  console.log(stats.estimate.bpm, stats.estimate.key, stats.estimate.chordRoot);
}
```

`maxPendingFrames` の既定値は `4096` です。UI が一時停止したり読み出しに遅れたりする可能性がある場合は小さめに設定してください。解析は継続し、最古の未読フレームが破棄されます。現在の滞留数と累積破棄数は `stats().pendingFrames` / `stats().droppedOutputFrames` で確認できます。

::: info ストリームの既定値はバッチ解析と異なる
`StreamAnalyzer` の既定サンプルレートは、バッチの 22050 Hz ではなく **44100 Hz** です。

リアルタイム音声は再生／キャプチャグラフ（AudioWorklet、デバイスコールバック）から直接届き、ほぼ常に 44100/48000 Hz で動きます。そのレートに合わせるとホットパスでの余分なリサンプルを避けられ、タイムスタンプが音声クロックと揃います。

`sampleRate: audioCtx.sampleRate` を渡し、推定値とタイムスタンプを実際に再生している音と揃えてください。
:::

### フレームの読み出しと出力フォーマット

`FrameBuffer` は **Structure-of-Arrays** です。タイムスタンプ、メル、クロマ、オンセット強度、RMS、スペクトル重心、スペクトル平坦度、コードルート、コードクオリティ、コード信頼度が、それぞれ独立した型付き配列に入ります。この形はスライスも別スレッドへの受け渡しも安価です。

::: details スペクトル重心・平坦度とは？
どちらも 1 フレームのスペクトルの*形*を 1 つの数値にまとめたもので、プロットやしきい値処理に使えます。

| 指標 | 意味 | 読み方 |
|------|------|--------|
| スペクトル重心 | エネルギーで重み付けした平均周波数 | 高いほど「明るい」（高域成分が多い）音に聞こえます |
| スペクトル平坦度 | エネルギーが周波数全体にどれだけ均等に広がっているか | 1 に近いとノイズ的、0 に近いと音程的です |

組み合わせると、フレームごとの音色を手軽に記述できます。
:::

スレッド間転送や可視化では、しばしば完全な float 精度は不要です。`StreamAnalyzer` は特徴量配列を量子化し、精度と帯域を引き換えにできます。

| 読み出しメソッド | 要素型 | `outputFormat` | 用途 |
|------------------|--------|----------------|------|
| `readFrames(n)` | `Float32Array` / `Int32Array` フィールドを持つ `FrameBuffer` | `0`（既定） | 完全精度の DSP、さらなる解析 |
| `readFramesI16(n)` | `Int16Array` フィールドを持つ `StreamFramesI16` | `1` | ワーカー／回線への帯域削減転送 |
| `readFramesU8(n)` | `Uint8Array` フィールドを持つ `StreamFramesU8` | `2` | 安価な可視化（ヒートマップの 1 画素は 8 ビットで足りる） |

```typescript
// スペクトログラム描画には 8 ビットのメルで十分 — 出力時点で量子化する。
const analyzer = new StreamAnalyzer({ sampleRate, nMels: 64, outputFormat: 2 });
analyzer.process(block);
const u8 = analyzer.readFramesU8(analyzer.availableFrames());
// u8.mel は Uint8Array [nFrames x nMels]、ImageData にそのまま書き込める
```

::: tip フォーマットは解析側ではなく消費側に合わせる
`outputFormat` は `readFramesU8`／`readFramesI16` が出力時にどう量子化するかを変えるだけで、内部解析は浮動小数点のままです。データが最終的に画素になるなら `Uint8`、スレッド／ネットワーク境界を越えてバイト数をおよそ半分にしたいなら `Int16`、下流でさらに計算するなら既定の `Float32` を選びます。
:::

::: info マグニチュードフレームは読み出し経路を持たない
`StreamAnalyzer` はフレームごとのマグニチュードスペクトルを公開しません。`readFrames*` に対応するフィールドが無いため、コンストラクタは黙って無視するのではなく `computeMagnitude: true` を拒否します。スペクトログラム表示にはメルを使い、生の単一フレーム FFT が必要なときはバッファした窓に対して [`meteringSpectrumFrame(...)`](./mastering-processors.md) を実行してください。
:::

#### 量子化レンジのカスタマイズ

量子化読み出しは、いずれもオプションの `StreamQuantizeConfig` を第 2 引数に取ります。既定値は「ふつう」の信号を前提にしているため、それより大幅に大きい／小さいストリームは、量子化後に全 `255` へ飽和したり `0` へつぶれたりします。8 ビット／16 ビットの圧縮で見える情報が残るよう、レンジを広げてください。

```typescript
// 入力レベルが高いライブ入力: メルの下限を上げ、オンセット／RMS の上限を引き上げる。
const u8 = analyzer.readFramesU8(analyzer.availableFrames(), {
  melDbMin: -60,    // 既定 -80。大音量ストリームでは下限を上げる
  melDbMax: 0,      // 既定 0
  onsetMax: 80,     // 既定 50。強いトランジェントのクリップを避ける
  rmsMax: 1.5,      // 既定 1
  centroidMax: 11025,
});
```

同じ `StreamQuantizeConfig` が `readFramesI16(...)` にも使えます。引数を省くと既定値のままです。変わるのは*出力*の写像だけで、内部の浮動小数点解析には影響しません。

### 更新されていく推定: BPM、キー、コード、パターン

`stats()` は `AnalyzerStats` を返し、その `estimate` フィールドが **`ProgressiveEstimate`** です — 音声が届くほど精緻になる、解析器の音楽に対する現在の最良推定です。読む前に `estimate.updated` を確認してください。推定が実際に変化したフレームでのみ `true` になるので、無駄な UI 更新を避けられます。

```typescript
const { estimate } = analyzer.stats();
if (estimate.updated) {
  // テンポとキー（信頼度つき）
  estimate.bpm;            estimate.bpmConfidence;
  estimate.key;            estimate.keyMinor;  estimate.keyConfidence;

  // いま鳴っているコード
  estimate.chordRoot;      // PitchClass（数値 enum、0 = C）
  estimate.chordQuality;   // ChordQuality（数値 enum）
  estimate.chordConfidence;
  estimate.chordStartTime;

  // ここまでの進行
  estimate.chordProgression;     // ChordChange[]  { root, quality, startTime, confidence }
  estimate.barChordProgression;  // BarChord[]     拍同期、1 小節に 1 つ

  // パターン検出（例: I–V–vi–IV のループ）
  estimate.detectedPatternName;  // 最も一致する既知の進行
  estimate.detectedPatternScore;
  estimate.allPatternScores;     // PatternScore[] { name, score }
  estimate.votedPattern;         // BarChord[] ロックされた反復パターン
  estimate.patternLength;        // そのパターンの小節数
  estimate.currentBar;           // estimate.barDuration -> 小節位置／長さ
}
```

コード出力が 2 層あるのは、答えている問いが違うためです。

| フィールド | 意味 |
|------------|------|
| `chordProgression` | 検出されたコード変化を、そのまま時系列で並べたもの。 |
| `barChordProgression` | コードを小節境界にそろえたもの。譜面やチャートとして読みやすくなります。 |

その上で、パターン検出が小節をまたいで投票し、*反復する*進行を認識します（`votedPattern` / `detectedPatternName`）。これにより、フレームごとにちらつく表示ではなく、曲全体の進行として落ち着いた表示になります。

::: tip 想定長を与えてパターンをロックしやすくする
パターン投票には十分な小節数が必要です。クリップ長が事前に分かるなら `analyzer.setExpectedDuration(seconds)` を呼ぶと、タイミングとパターンロックが正しくスケールされます。分からなければ音声が流れるほど推定が精緻になります。非標準チューニングでは `analyzer.setTuningRefHz(refHz)` でキー／コードの基準を A4 = 440 Hz からずらせます。
:::

## オンセット包絡からテンポグラムへ

`StreamAnalyzer` はライブの**オンセット強度**ストリームを返します。各フレームの `onsetStrength` 配列がそれです。

*テンポグラム*は、オンセット包絡を時間 × テンポの画像に変換します。各時点で、候補となる各テンポがどれだけ強く存在するかを示すものです。ライブ BPM 推定は、この画像を時間方向に最も強いテンポへとつぶしたものに相当します。ただしストリーム序盤ではまだ仮の値です。テンポグラムは、その推定の元になるより広い全体像です。

蓄積した包絡、または `onsetEnvelope(...)` で得た任意のオンセット包絡から計算します。これは音声コールバック内で毎回実行する処理ではなく、バッファした窓に対するバッチ処理です。

```typescript
import { init, onsetEnvelope, tempogram, fourierTempogram, cyclicTempogram, tempogramRatio, plp } from '@libraz/libsonare';

await init();

const env = onsetEnvelope(samples, sampleRate, 2048, 512);

const ac  = tempogram(env, sampleRate, 512, 384, 'autocorrelation'); // 既定
const cos = tempogram(env, sampleRate, 512, 384, 'cosine');
const ft  = fourierTempogram(env, sampleRate, 512, 384);
const cyc = cyclicTempogram(env, sampleRate, 512, 384, 60, 60);
const ratio = tempogramRatio(ac.data, 384, sampleRate, 512, [0.5, 1, 2, 3, 4]);
const pulse = plp(env, sampleRate, 512, 30, 300, 384);
```

| 関数 | 計算するもの | 戻り値 |
|------|--------------|--------|
| `tempogram(..., 'autocorrelation')` | オンセット包絡の局所自己相関（librosa 既定） | `{ nFrames, winLength, data }` |
| `tempogram(..., 'cosine')` | ラグ付きオンセット片どうしの窓内**コサイン類似度** | `{ nFrames, winLength, data }` |
| `fourierTempogram(...)` | オンセット包絡の STFT（フーリエテンポグラム） | `{ nBins, nFrames, data }` |
| `cyclicTempogram(...)` | オクターブ畳み込みしたテンポクラス（60・120・240 BPM が同一になる） | `{ nBins, nFrames, data }` |
| `tempogramRatio(...)` | テンポグラムからのテンポ比特徴量 | `Float32Array` |
| `plp(...)` | 主要局所パルス曲線 | `Float32Array` |

::: details 自己相関テンポグラムとコサインテンポグラム
既定の**自己相関**テンポグラムは、オンセット包絡をラグ付きのコピーと相関させ、`librosa.feature.tempogram` を再現します。**コサイン**モードは代わりに、窓内のラグ付きオンセット片どうしのコサイン類似度を測ります。コサインはオンセットの生エネルギーよりパターンの*形*の一致を強調するため、窓内でオンセット振幅が大きく変動する場合に安定しやすいことがあります。どちらも row `i` がラグ `i` の強度である `[winLength x nFrames]` 行列を生成します。第 5 引数 `mode`（`'autocorrelation'` | `'cosine'`）で切り替えます。
:::

## AudioWorklet での使い分け

通常の WASM パッケージは `RealtimeEngine` クラスを公開します。Worklet ブリッジは、`SonareRealtimeEngineNode.create(...)` を通じて、その embind ベースのエンジンを `AudioWorkletGlobalScope` 内で動かします。エンジン本体の操作面 — トランスポート、レーンミキサー、オートメーション、MIDI クリップ、外部 MIDI — は [リアルタイムエンジン](./realtime-engine.md) を参照してください。

ブリッジヘルパーは `@libraz/libsonare/worklet` サブパスにあります。Worklet モジュール側でプロセッサを登録し、メインスレッド側でノードを作ります。`moduleUrl` は `registerSonareRealtimeEngineWorkletProcessor()` を呼ぶコンパイル済み Worklet モジュールです。

```typescript
// sonare-engine-worklet.ts
import { registerSonareRealtimeEngineWorkletProcessor } from '@libraz/libsonare/worklet';

registerSonareRealtimeEngineWorkletProcessor();
```

```typescript
// main.ts
import { SonareRealtimeEngineNode } from '@libraz/libsonare/worklet';

const audioCtx = new AudioContext();
const engineNode = await SonareRealtimeEngineNode.create(audioCtx, {
  moduleUrl: '/sonare-engine-worklet.js',
  channelCount: 2,
  mode: 'auto',            // 可能なら SAB、なければ postMessage
});

engineNode.node.connect(audioCtx.destination);
engineNode.play();
engineNode.onTelemetry((telemetry) => console.log(telemetry));
console.log(engineNode.capabilities.mode, engineNode.capabilities.degradedReason);

// SAB テレメトリを使う場合は、requestAnimationFrame など UI tick で回収する。
engineNode.pollTelemetry();

// 後始末:
engineNode.destroy();
```

アプリ側でより高いレベルの facade が欲しい場合は、`SonareEngine` を使えます。

| 部品 | 役割 |
|------|------|
| Worklet ノード | リアルタイム音声側を実行します。 |
| main thread 側の `RealtimeEngine` | オフライン処理やタイムライン操作を扱います。 |

`transport` API は play/stop、秒または PPQ への seek、テンポ、ループ更新を扱います。トランスポート以外も、ワークレット API はエンジンのほぼ全面をコントロールメッセージ経由で Worklet にミラーします。メインスレッドが唯一の正であり、音声スレッドは同期済みスナップショットを受け取るだけです。

| やりたいこと | ワークレット API |
|--------------|----------------|
| トラックルーティング、フェーダー、パン、ソロ／ミュート | `setTrackLanes`、`setStripGain`、`setStripPan`、`setTrackStripPan`、`setTrackStripPanLaw`、`setTrackStripPanMode`、`setTrackStripDualPan`、`setTrackStripChannelDelaySamples`、`setSoloMute` |
| トラック／マスターのインサートと EQ | `setTrackStripJson`、`setMasterStripJson`、`setTrackStripEqBand`、`setMasterStripEqBand`、`setTrackStripInsertParamByName`、`setMasterStripInsertParamByName`、インサートバイパス系メソッド |
| センドとバス | `setSends`、`setBusGain`、`setBusStripJson` |
| MIDI クリップとライブ MIDI | `setMidiClips`、`pushMidiNoteOn`、`pushMidiNoteOff`、`pushMidiCc`、`pushMidiPanic` |
| パラメータオートメーション | `setAutomationLane`、`addAutomationPoint`、`automationParamId(target, kind)`、`busAutomationParamId(busId)`、`listParameters`、`automationLaneCount` |
| 楽器 | `setBuiltinInstrument`、`setSynthInstrument`、`loadSoundFont`、`setSf2Instrument` |
| 録音とモニタリング | `configureCapture`（`inputMonitor` を含む）、`armRecord`、`punch`、`capturedAudio`、`captureStatus` |
| トランスポート、テンポ、マーカー | `getTransportState`、`cachedTransportState`、`setTempoSegments`、`setTimeSignatureSegments`、マーカー系メソッド（全置換の `setMarkers` を含む。解決後のマーカー一覧（各エントリがエンジン `id` を持つ）を返す）、`setLoopFromMarkers` |
| クリップ更新 | `addClip`、`removeClip` — 差分（クリップデルタ）を Worklet へ送る |
| メーターとテレメトリ | `onMeter` / `onTelemetry` / `onScope`、`pollMeters` / `pollTelemetry` / `pollScope`。メーターレコードはマスター・レーン・バス・入力のターゲット id を持つ。オフライン／メインスレッド側エンジンではワイドメーターレコードとスコープスナップショットも読み出せる |
| オフライン書き出し | メインスレッド側ミラーの `renderOffline` |

ワークレット API では、ストリップを指定するメソッドはトラック id *または名前*（`target: string | number`）を受け取り、`setSoloMute(target, solo, mute)` はレーンインデックスの解決まで行います。`setTrackStripEqBand` は `EqBand` オブジェクトを直接受け取るので、バンド JSON を手書きする必要はほとんどありません。

`automationParamId(target, 'faderDb' | 'pan')` と `busAutomationParamId(busId)` はミキサー名前空間の予約済みエンジンパラメータ id を返すので、`addParameter` でカスタムパラメータを登録しなくても、それらをそのまま `setAutomationLane(paramId, points)` に渡してトラック／マスターのフェーダーやパン、あるいはバスのフェーダー（そのフェーダーゲイン dB に解決されます）を自動化できます。`target`／`busId` は初回利用時にミキサーのレーン／バスを宣言します。

Worklet 側でスコープスナップショットを流す場合は、`SonareRealtimeEngineNode.create(...)` に `scopeIntervalFrames`、`scopeBands`、必要に応じて `scopeSharedBuffer` / `scopeRingCapacity` を渡します。独自ブリッジでスペクトラムとベクトルスコープのスナップショットを共有リングに流したい場合は、低レベルの `createSonareScopeRingBuffer(...)` と `readSonareScopeRingBuffer(...)` を使えます。

```typescript
import { SonareEngine } from '@libraz/libsonare/worklet';

const engine = await SonareEngine.create(audioCtx, {
  moduleUrl: '/sonare-engine-worklet.js',
  mode: 'auto',
  channelCount: 2,
});

engine.setTrackLanes([{ trackId: 1 }]);
engine.setTrackStripJson(1, trackSceneJson);
engine.addClip(1, [clipL, clipR], 0);
engine.setTempoSegments([{ startPpq: 0, bpm: 120 }]);
engine.transport.setLoop(0, 4, true);
engine.transport.play();
engine.onMeter((meter) => console.log(meter.rmsDbL, meter.rmsDbR));

const offline = await engine.renderOffline(48000);
console.log(offline[0].length);

engine.destroy();
```

::: tip Worklet 同期メッセージ
`SonareEngine` は Worklet 内で embind エンジンを動かします。ホスト側の Worklet エントリーがメッセージ名をフィルタしてから転送している場合は、`sync*`・`captureRequest`・`transportRequest` のすべてを許可リストに加えてください。そうしないとレーン／ストリップ／MIDI の同期メッセージが黙って落ちます。
:::

## クリップ音声のページストリーミング

長いアレンジは、一度にメモリへ載せきれないほどのクリップ音声を持つことがあります。エンジンはクリップ音声を**ページ**単位でストリーミングします。1 つの巨大なバッファの代わりに、クリップは*クリップページプロバイダ*に支えられ、必要に応じて固定サイズのページをエンジンへ渡します。

この流れは設計上ロックフリーです。

1. レンダースレッドがまだ持っていないページを必要とし、**ウェイトフリーのページ要求キュー**へ要求を積みます。
2. メインスレッドが `engine.popClipPageRequest()` でそのキューを排出し、要求されたページの音声をストレージから読み、`provider.supply(pageIndex, channels)` を呼びます。
3. 不要になったページは `provider.clear(pageIndex)` で解放します。

音声スレッドは要求を積むことと、すでに読み込まれたページを読むことしか行わないため、ストレージやアロケーションでブロックしません。

<FlowDiagram
  title="ロックフリーなクリップページの受け渡し"
  direction="TB"
  :nodes="[
    { id: 'need', label: 'レンダースレッドがページ N を要求', col: 0, row: 0, variant: 'accent', group: 'audio' },
    { id: 'push', label: 'ウェイトフリーキューへ要求を積む', col: 0, row: 1, variant: 'accent', group: 'audio' },
    { id: 'pop', label: 'popClipPageRequest() でキューを排出', col: 1, row: 2, group: 'main' },
    { id: 'read', label: 'ストレージからページ音声を読む', col: 1, row: 3, group: 'main' },
    { id: 'supply', label: 'provider.supply(pageIndex, channels)', col: 1, row: 4, variant: 'success', group: 'main' },
    { id: 'consume', label: 'レンダースレッドが供給済みページを読む', col: 0, row: 5, variant: 'success', group: 'audio' },
    { id: 'clear', label: 'provider.clear(pageIndex)', col: 1, row: 6, variant: 'muted', group: 'main' }
  ]"
  :edges="[
    { from: 'need', to: 'push' },
    { from: 'push', to: 'pop', label: 'ページ要求' },
    { from: 'pop', to: 'read' },
    { from: 'read', to: 'supply' },
    { from: 'supply', to: 'consume', label: 'ページ準備完了' },
    { from: 'consume', to: 'clear', label: '不要になったら', style: 'dashed' }
  ]"
  :groups="[
    { id: 'audio', label: 'オーディオ／レンダースレッド' },
    { id: 'main', label: 'メインスレッド' }
  ]"
  caption="音声スレッドは要求を積むことと供給済みページを読むことだけを行い、遅いストレージ読み取りはメインスレッドで行われます。"
/>

::: info ロックフリーとウェイトフリー（初心者向け）
リアルタイム音声スレッドは止まってはいけません。ほんの一瞬でも停滞すると出力にノイズが乗ります。**ロックフリー**とは、音声スレッドが他スレッドの保持するロックの解放を待たないことです。ここで使うより強い保証が**ウェイトフリー**で、ページ欠落要求をページ要求キューへ積む処理は必ず有限ステップで完了します。そのため音声スレッドがそこで待ったりスピンしたりすることがありません。遅い部分（ストレージからのページ読み取り）は、代わりにメインスレッドで行われます。
:::

### ブラウザの OPFS バックエンドプロバイダ

パッケージには、[Origin Private File System（OPFS）](https://developer.mozilla.org/docs/Web/API/File_System_API/Origin_private_file_system) からワーカー上でページを読む既製プロバイダが同梱されており、ディスク読み取りをメインスレッドの外に保ちます。

```typescript
import { createOpfsClipPageProvider } from '@libraz/libsonare';

const binding = createOpfsClipPageProvider(engine, {
  path: 'clips/long-take.f32',  // OPFS 上のインターリーブ Float32
  numChannels: 2,
  numSamples: totalFrames,      // ファイルの総フレーム数
  pageFrames: 65536,            // フレーム単位のページサイズ
  // dataOffsetBytes?: ヘッダーをスキップ。worker?: 自前の Worker を再利用
});

// UI tick で、レンダースレッドが要求した分を処理する:
let request;
while ((request = engine.popClipPageRequest()) !== null) {
  await binding.supplyRequest(request);  // 該当ページを読み込んでプロバイダへ渡す
}

// 後始末:
binding.close();  // プロバイダを解放し、所有していればワーカーも終了
```

`createOpfsClipPageProvider(...)` はエンジン側の `ClipPageProvider` を作り、ワーカーと組み合わせます。既定では `createOpfsClipPageWorker()` でインラインワーカーを起動します。そのワーカー本体は `opfsClipPageWorkerSource` として公開されているので、自前でバンドルしたり、独自の `Worker` を渡したりもできます。`supplyRequest(request)` は排出した要求のサンプル位置をページインデックスへ写像し、`supplyPage(pageIndex)` はページを直接プリフェッチできます。

::: warning OPFS 対応はブラウザによって異なる
OPFS プロバイダは `navigator.storage.getDirectory()` と同期アクセスハンドルに依存します。これらは現行の Chromium・Firefox と最近の Safari の WebKit では利用できますが、古いブラウザでは使えません。利用前に機能検出し、OPFS が無い環境向けにメモリだけで動くプロバイダ（または任意のソースから読み込む自前の `ClipPageProvider`）を用意してください。
:::

### 複数クリップの範囲限定ストリーミング

上のループは 1 つのプロバイダを手作業で処理します。マルチトラックのアレンジでは、クリップが何本あっても、どれだけ長くても、常駐する音声を一定量に抑えたいはずです。`ClipPageStreamer` がそれを担います。各クリップの再生位置の周りにページのスライディングウィンドウ — クリップあたり `retainBehindPages + readAheadPages + 1` ページ — だけを保持し、ミスを先読みで取得し、後方に外れたページを破棄するため、セッション全体で PCM 全体を WASM メモリに抱えることがありません。

`attachOpfsClipStream(...)` は、OPFS バックエンドのクリップ 1 本を共有ストリーマーへ 1 回の呼び出しで接続します。プロバイダを構築し、再生開始直後にミスが出ないよう先頭ページをプライムし、ウィンドウ破棄の対象として登録します。

```typescript
import { ClipPageStreamer, attachOpfsClipStream } from '@libraz/libsonare';

const streamer = new ClipPageStreamer(engine, { readAheadPages: 2, retainBehindPages: 1 });

// 長いクリップごとに接続し、`provider` をクリップスケジュールへ渡す。
const take = await attachOpfsClipStream(streamer, engine, {
  clipId: 1,                    // ページミス要求の clipId と一致させる
  path: 'clips/long-take.f32',
  numChannels: 2,
  numSamples: totalFrames,
  pageFrames: 65536,
});
engine.setClips([{ clipId: 1, /* ...タイミング... */ pageProvider: take.provider }]);

// 制御スレッドのペースでミスを排出する（アニメーションフレームごとが一般的）:
function tick() {
  streamer.pump();              // 不足ページ＋先読みを取得し、ウィンドウ外を破棄
  requestAnimationFrame(tick);
}

// 破棄すると、接続済みの全クリップのバインディングを閉じる:
streamer.close();
```

`pump()` はメイン／制御スレッドでのみ呼びます — 取得は非同期なので、オーディオスレッドでは決して呼ばないでください。自前でプロバイダを作ったクリップの着脱には `addSource` / `removeSource` を使います。明示的なシークやループの後は `resetSource(clipId)` を呼び、古い再生ウィンドウを破棄して新しい取得世代を開始します。後方ページへのミスでもこのリセットは自動的に行われ、シーク前の処理中フェッチが後から常駐するのを防ぎます。

## 表示用の波形ピーク

任意のズームでクリップを描くのに、全サンプルは必要ありません。必要なのは画面の列ごとの最小／最大包絡です。`waveformPeaks(...)` はインターリーブ音声をチャンネルごとの最小／最大の**バケット**へ縮約し、そのまま描けます。

```typescript
import { init, waveformPeaks, waveformPeakPyramid } from '@libraz/libsonare';

await init();

// インターリーブステレオ（L0,R0,L1,R1,...）。ここでは mono なので channels = 1
const peaks = waveformPeaks(samples, /* channels */ 1, { samplesPerBucket: 512 });
// peaks.min / peaks.max は長さ peaks.channels * peaks.bucketCount の
// チャンネルメジャー Float32Array。バケットごとに縦線を描く
for (let b = 0; b < peaks.bucketCount; b++) {
  drawColumn(b, peaks.min[b], peaks.max[b]);
}
```

ユーザーが自由にズームできるクリップでは、`waveformPeakPyramid(...)` で複数のバケットサイズを一度に前計算し、現在の pixels-per-second に最も近いレベルを選びます。

```typescript
const pyramid = waveformPeakPyramid(samples, 1, {
  samplesPerBucketLevels: [512, 1024, 2048, 4096],
});
// pyramid[i] はそのバケットサイズの WaveformPeaksReport。粗いレベルほど
// バケット数が少なく、ズームアウト時に描画が軽い
```

どちらもバッファしたクリップに対するバッチ縮約で、音声コールバック内の処理ではありません。`samplesPerBucket` はフレーム単位のバケット幅で、小さいほど詳細でバケット数も増えます。

## 関連

- [リアルタイムエンジン](./realtime-engine.md) — このページのブリッジとクリップストリーミングが供給する、トランスポート・レーンミキサー・オートメーション・MIDI クリップ・外部 MIDI ルーティングを備えたエンジン本体
- [ミキシングエンジン](./mixing.md) — マルチトラックのリアルタイム向けストリップ／バス／センド／メータリング
- [JavaScript API](./js-api.md) · [Python API](./python-api.md) — これらの推定の背後にあるバッチ特徴量変換
- [DSP 実装解説](./dsp-implementation.md) — オンセット、クロマ、テンポ特徴量の構築方法
