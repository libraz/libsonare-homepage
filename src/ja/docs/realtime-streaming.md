---
title: リアルタイムとストリーミング
description: libsonare のストリーミング API。ライブ MIR フレームと更新される BPM／キー／コード／パターン推定を扱う StreamAnalyzer、ストリーミングのオンセット情報から得るテンポグラム、AudioWorklet エンジンブリッジ、クリップ音声のページストリーミング、表示用の波形ピークを解説します。
---

# リアルタイムとストリーミング

このページは libsonare の**ストリーミング**側を扱います。ライブの音声ストリームを解析フレームと音楽推定に変換すること、そしてクリップ音声を流しリアルタイムエンジンを音声スレッドで動かすための仕組みです。

- **`StreamAnalyzer`**: 音声ブロックを入力し、*解析フレーム*（メル、クロマ、オンセット、スペクトル）と、時間とともに更新される音楽推定（BPM、キー、コード、コード進行、パターン）を出力します。ビジュアライザーや「今この曲で何が起きているか」のライブ表示に使います。
- **エンジンのストリーミング機構**: `RealtimeEngine` を音声スレッドで動かす AudioWorklet ブリッジ、メモリに載せきれない大きなアレンジ向けのクリップ音声のページストリーミング、クリップ描画用の波形ピーク縮約です。

短く言えば、音声を入力して情報を取り出すなら `StreamAnalyzer` です。UI を作る場合、`StreamAnalyzer` はグラフ、メーター、ラベルに値を渡します。

::: tip エンジン本体を探している場合
`RealtimeEngine` の機能（トランスポート、レーンミキサー、グループルーティングとサイドチェイン、パラメータオートメーション、サラウンドグループバス、MIDI クリップスケジュール、外部 MIDI ルーティング）は専用ページで扱います。クリップ・MIDI・トランスポート・ミックス済み音声を*出力*として作るなら [リアルタイムエンジン](./realtime-engine.md) を参照してください。
:::

このページでいう**チャンク**や**ブロック**は、AudioWorklet などで繰り返し処理する短い音声片のことです。AudioWorklet とは、メイン／UI スレッドとは別の、リアルタイム音声スレッド上で DSP を動かす音声コールバックの実行環境です。リアルタイム処理では、音声コールバック内で重いアロケーションを避けるのが基本です。先にオブジェクトを準備し、コールバックではブロック処理だけを行います。

::: info チャンク・ブロック・フレームの違い
**チャンク**や**ブロック**は、リアルタイム入力から届く短い音声サンプルのまとまりです。**フレーム**は、その音声ブロックを解析して得た時間単位の特徴量です。入力はブロック、UI に描く結果はフレーム、と分けて考えると混乱しにくくなります。
:::

::: info サンプルレートとリサンプリング
**サンプルレート**は 1 秒が何サンプルでできているか（44100 や 48000 が一般的）です。ストリームのレートがアナライザーの想定と一致しないと、処理前に別のレートへ作り直す**リサンプリング**が必要になり、余分な CPU を消費します。最初からレートを揃えておくほうが高速です。
:::

## このページで身につくこと

このページを読むと、次のことを判断・実装できるようになります。

- アプリに `StreamAnalyzer`、`RealtimeEngine`、ミキシングエンジンのどれが必要かを選べる。
- 圧縮ファイルのバイト列、デコード済みサンプル、ブロック、フレームを混同せずに音声を渡せる。
- UI 用の特徴フレームを読み出し、量子化読み出しがなぜあるかを理解できる。
- 更新される BPM／キー／コード推定を、初期値から最終結果のように扱わずに使える。
- 音声コールバック内で安全な処理と、事前準備すべき処理を区別できる。

## どちらを使うか

| 作りたいもの | 最初に使うもの |
|--------------|----------------|
| スペクトログラム、クロマ、オンセット強度、ライブ BPM／キー推定を描くビジュアライザー | `StreamAnalyzer` |
| ライブのコード／進行／パターン表示 | `StreamAnalyzer.stats()` |
| テンポ、ループ、マーカー、メトロノーム、クリップ、オートメーションを持つ再生エンジン | [リアルタイムエンジン](./realtime-engine.md) |
| 再生するトラックをそのままライブでミックスする再生エンジン（レーン、バス、センド、ストリップ） | [リアルタイムエンジンのレーンミキサー](./realtime-engine.md#レーンミキサー) |
| エンジン内の楽器へサンプル精度で MIDI クリップを再生する | [リアルタイムエンジン](./realtime-engine.md#midi-クリップスケジューリングと-sampleatppq) の `setMidiClips()` + `sampleAtPpq()` |
| 音声スレッド上のエンジンとテレメトリー | `@libraz/libsonare/worklet`（[AudioWorklet での使い分け](#audioworklet-での使い分け)） |
| 単体のミキサー（ワンショットまたはシーンベース、ストリップ／センド／メーター付き） | [ミキシングエンジン](./mixing.md) |
| 単純なオフラインスクリプト | このページではなく [はじめに](./getting-started.md) |

::: info ランタイムごとの入口
このページのライブコールバックの例はブラウザ / WASM のものです。Python にも、ブロックを渡してフレームを受け取る同じアナライザーがあり、自前のループで駆動します。CLI はファイル単位で処理します。

| 実行環境 | 使う入口 | 典型的な用途 |
|----------|----------|--------------|
| ブラウザ / WASM | `StreamAnalyzer`、`RealtimeEngine`、`@libraz/libsonare/worklet` | ライブ可視化、AudioWorklet、更新される BPM / キー / コード表示 |
| Node ネイティブ | `StreamAnalyzer` | サーバーやデスクトッププロセスでの同じアナライザー |
| Python | `StreamAnalyzer(StreamConfig(...))`、`RealtimeEngine` | 自前のループでブロックを渡してフレームを読む（AudioWorklet なし） |
| CLI | `sonare analyze`、`sonare bpm`、`sonare key` など | ファイル単位の確認、バッチ処理、JSON 出力 |

Python / CLI でファイル全体を解析したい場合は [Python API](./python-api.md) と [CLI リファレンス](./cli.md) を使ってください。音声コールバック内で動かす実装例は、WASM / worklet 側のコードだけを正として扱います。
:::

## StreamAnalyzer

`StreamAnalyzer` は音声ブロックを処理し、UI 描画用のフレームバッファを出力します。スペクトログラム、クロマ表示、オンセットに反応するビジュアル、音が増えるにつれて更新される音楽推定に向いています。一度構築し、受け取ったブロックごとに `process()` し、たまったフレームを読み出します。

最初の実装では、ループを単純に保つと分かりやすくなります。

1. 音声デバイスと同じ `sampleRate` でアナライザーを 1 つ作る。
2. デコード済み音声またはライブ入力のブロックごとに `process(block)` を呼ぶ。
3. 描画には `readFrames(...)`、現在の音楽推定には `stats()` を読む。
4. 最初の数秒の BPM／キー／コードは仮の値として扱い、音声が増えるほど安定すると考える。

下のデモは、同じ「音声を入れて、マーカーを取り出す」考え方を視覚化したものです。オンセット検出は各打点を示し、ビート追跡はそれらをより安定した拍へまとめます。

<SonareDemo id="beat-tracking" />

::: info メル・クロマ・オンセットを一言で
- **メル**: 時間ごとの周波数帯域エネルギーを、知覚的な音高スケールで並べたスペクトログラムです。「どんな音か」を示すヒートマップに向きます。
- **クロマ**: エネルギーを 12 の音高クラス（C、C#、… B）へ畳み込んだものです。ハーモニーやキーの表示に向きます。
- **オンセット**: 新しいノートやビートが始まると跳ね上がる強度曲線です。ビート／テンポに反応する可視化に使えます。
:::

::: tip `nFft` と `hopLength` を一言で
アナライザーは内部で STFT（短時間フーリエ変換。短い窓を重ねながら FFT を繰り返す手法）を実行します。

| パラメータ | 意味 | 値を大きく／小さくしたとき |
|------------|------|-----------------------------|
| `nFft` | 解析窓のサイズ（サンプル数） | 大きいほど周波数は細かく、時間は粗くなります |
| `hopLength` | フレーム間で窓を進める量 | 小さいほど 1 秒あたりのフレームが増え、CPU 負荷も増えます |

下記の `2048`/`512` は一般的な出発点です。なじみがなければ [MIR の全体像](./glossary/concepts/mir-overview.md) を参照してください。
:::

::: code-group

```typescript [WASM]
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
  maxPendingFrames: 256, // 未読出力を制限。超過時は新たに生成されたフレームを破棄
});

analyzer.process(inputBlock);

const frames = analyzer.readFrames(analyzer.availableFrames());
const stats = analyzer.stats();

if (stats.estimate.updated) {
  console.log(stats.estimate.bpm, stats.estimate.key, stats.estimate.chordRoot);
}
```

```python [Python]
from libsonare import StreamAnalyzer, StreamConfig

analyzer = StreamAnalyzer(StreamConfig(sample_rate=48000, n_fft=2048, hop_length=512, n_mels=64))
analyzer.process(block)

frames = analyzer.read_frames(analyzer.available_frames())
stats = analyzer.stats()

if stats.updated:
    print(stats.bpm, stats.key_name, stats.chord_name)
```

:::

Python の `stats()` はフラットな構造で、`.estimate` の階層はありません（`stats.bpm`、`stats.key_name`）。

`maxPendingFrames` の既定値は `4096` です。UI が一時停止したり読み出しに遅れたりする可能性がある場合は小さめに設定してください。解析は継続しますが、未読キューが満杯の間に新しく生成された出力フレームは破棄されます。現在の滞留数と累積破棄数は `stats().pendingFrames` / `stats().droppedOutputFrames` で確認できます。

::: info ストリームの既定値はバッチ解析と異なる
`StreamAnalyzer` の既定サンプルレートは、バッチの 22050 Hz ではなく **44100 Hz** です。

リアルタイム音声は再生／キャプチャグラフ（AudioWorklet、デバイスコールバック）から直接届き、ほぼ常に 44100/48000 Hz で動きます。そのレートに合わせるとホットパスでの余分なリサンプルを避けられ、タイムスタンプが音声クロックと揃います。

`sampleRate: audioCtx.sampleRate` を渡し、推定値とタイムスタンプを実際に再生している音と揃えてください。
:::

### フレームの読み出しと出力フォーマット

`FrameBuffer` は **Structure-of-Arrays** です。タイムスタンプ、メル、クロマ、オンセット強度、RMS、スペクトル重心、スペクトル平坦度、コードルート、コードクオリティ、コード信頼度が、それぞれ独立した型付き配列に入ります。この形なら、スライスも別スレッドへの受け渡しも低コストで行えます。任意配列を読む前に `featureFlags`（`MEL=1`、`CHROMA=2`、`ONSET=4`、`SPECTRAL=8`）を確認してください。無効な特徴量は空配列で、クロマが無いときの `nChroma` は `0` です。

::: details スペクトル重心・平坦度とは？
どちらも 1 フレームのスペクトルの*形*を 1 つの数値にまとめたもので、プロットやしきい値処理に使えます。

| 指標 | 意味 | 読み方 |
|------|------|--------|
| スペクトル重心 | 振幅で重み付けした平均周波数（Σ f·\|X\| / Σ\|X\|。エネルギー重み付けではありません） | 高いほど「明るい」（高域成分が多い）音に聞こえます |
| スペクトル平坦度 | エネルギーが周波数全体にどれだけ均等に広がっているか | 1 に近いとノイズ的、0 に近いと音程的です |

組み合わせると、フレームごとの音色を手軽に記述できます。
:::

スレッド間転送や可視化では、しばしば完全な float 精度は不要です。`StreamAnalyzer` は特徴量配列を量子化し、精度と帯域を引き換えにできます。

| 読み出しメソッド | 要素型 | 用途 |
|------------------|--------|------|
| `readFrames(n)` | `Float32Array` / `Int32Array` フィールドを持つ `FrameBuffer` | 完全精度の DSP、さらなる解析 |
| `readFramesI16(n)` | `Int16Array` フィールドを持つ `StreamFramesI16` | ワーカー／回線への帯域削減転送 |
| `readFramesU8(n)` | `Uint8Array` フィールドを持つ `StreamFramesU8` | 安価な可視化（ヒートマップの 1 画素は 8 ビットで足りる） |

```typescript
// スペクトログラム描画には 8 ビットのメルで十分なので、出力時点で量子化する。
const analyzer = new StreamAnalyzer({ sampleRate, nMels: 64 });
analyzer.process(block);
const u8 = analyzer.readFramesU8(analyzer.availableFrames());
// u8.mel は Uint8Array [nFrames x nMels]、ImageData にそのまま書き込める
```

::: tip 消費側に合わせて読み出しメソッドを選ぶ
解析自体は常に float です。データが最終的に画素になるなら `readFramesU8`、スレッド／ネットワーク境界を越えてバイト数をおよそ半分にしたいなら `readFramesI16`、下流でさらに計算するなら `readFrames` を選びます。`StreamConfig.outputFormat` はレガシーであり、省略するか `0` を指定してください。
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

`stats()` は `AnalyzerStats` を返し、その `estimate` フィールドが **`ProgressiveEstimate`** です。音声が届くほど精緻になる、アナライザーの音楽に対する現在の最良推定にあたります。読む前に `estimate.updated` を確認してください。これは、キーまたは BPM の推定を再計算した周期的なフレームで `true` になります（再計算した値が以前と実際に変わったフレームだけではありません）。そのため、そもそも再計算が起きなかったフレームをスキップできます。

```typescript
const { estimate } = analyzer.stats();
if (estimate.updated) {
  // テンポとキー（信頼度つき）
  estimate.bpm;            estimate.bpmConfidence;
  estimate.key;            estimate.keyMinor;  estimate.keyConfidence;
  estimate.keyName;        // "A minor"。キーが推定されるまでは null

  // いま鳴っているコード
  estimate.chordRoot;      // PitchClass（数値 enum、0 = C）
  estimate.chordQuality;   // ChordQuality（数値 enum）
  estimate.chordName;      // "Am"。鳴っているコードがないときは 'N.C.'
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

  // 推定の材料
  estimate.bpmCandidateCount;    // 最新の BPM 推定が選んだ元のテンポ候補数
  estimate.accumulatedSeconds;   // ここまでに推定へ取り込んだ音声の長さ
  estimate.usedFrames;
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

*テンポグラム*は、オンセット包絡線を時間 × テンポの画像に変換します。各時点で、候補となる各テンポがどれだけ強く存在するかを示すものです。ライブ BPM 推定は、この画像を時間方向に最も強いテンポへとつぶしたものに相当します。ただしストリーム序盤ではまだ仮の値です。テンポグラムは、その推定の元になるより広い全体像です。

蓄積した包絡線、または `onsetEnvelope(...)` で得た任意のオンセット包絡線から計算します。これは音声コールバック内で毎回実行する処理ではなく、バッファした窓に対するバッチ処理です。

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
| `tempogram(..., 'autocorrelation')` | オンセット包絡線の局所自己相関（librosa 既定） | `{ nFrames, winLength, data }` |
| `tempogram(..., 'cosine')` | ラグ付きオンセット片どうしの窓内**コサイン類似度** | `{ nFrames, winLength, data }` |
| `fourierTempogram(...)` | オンセット包絡線の STFT（フーリエテンポグラム） | `{ nBins, nFrames, data }` |
| `cyclicTempogram(...)` | オクターブ畳み込みしたテンポクラス（60・120・240 BPM が同一になる） | `{ nBins, nFrames, data }` |
| `tempogramRatio(...)` | テンポグラムからのテンポ比特徴量 | `Float32Array` |
| `plp(...)` | 主要局所パルス曲線 | `Float32Array` |

::: details 自己相関テンポグラムとコサインテンポグラム
既定の**自己相関**テンポグラムは、オンセット包絡線をラグ付きのコピーと相関させ、`librosa.feature.tempogram` を再現します。**コサイン**モードは代わりに、窓内のラグ付きオンセット片どうしのコサイン類似度を測ります。コサインはオンセットの生エネルギーよりパターンの*形*の一致を強調するため、窓内でオンセット振幅が大きく変動する場合に安定しやすいことがあります。どちらも row `i` がラグ `i` の強度である `[winLength x nFrames]` 行列を生成します。第 5 引数 `mode`（`'autocorrelation'` | `'cosine'`）で切り替えます。
:::

## AudioWorklet での使い分け

通常の WASM パッケージは `RealtimeEngine` クラスを公開します。worklet ブリッジは、`SonareRealtimeEngineNode.create(...)` を通じて、その embind ベースのエンジンを `AudioWorkletGlobalScope` 内で動かします。エンジン本体の機能（トランスポート、レーンミキサー、オートメーション、MIDI クリップ、外部 MIDI）は [リアルタイムエンジン](./realtime-engine.md) を参照してください。

ブリッジヘルパーは `@libraz/libsonare/worklet` サブパスにあります。worklet モジュール側でプロセッサを登録し、メインスレッド側でノードを作ります。`moduleUrl` は `registerSonareRealtimeEngineWorkletProcessor()` を呼ぶコンパイル済み worklet モジュールです。

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
  mode: 'auto',            // 可能なら SharedArrayBuffer (SAB)、なければ postMessage
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

### PFL/AFL を独立したキュー出力へ送る

通常、PFL/AFL のキューバスはプログラム出力へ折り込まれます。ノード作成時に `cueOutput: true` を渡すと、キューバスだけを流す 2 本目の出力が追加されます。出力 `0` はプログラムの出力先へ、出力 `1` はヘッドフォンや別デバイスへ接続してください。このオプションを省略すると、従来どおり出力は 1 本で、折り込み後のミックスもサンプル単位で同一です。

```typescript
import { SonareEngine } from '@libraz/libsonare/worklet';

const engine = await SonareEngine.create(audioCtx, {
  moduleUrl: '/sonare-engine-worklet.js',
  cueOutput: true,
});
engine.setTrackMonitorMode(trackId, 'pfl');
engine.node.connect(audioCtx.destination, 0);
engine.node.connect(cueDestination, 1);
```

独自のゼロコピー worklet 経路では、音声処理を始める前にメッセージハンドラーから `prepareChannels(...)` と `prepareMonitorChannels(...)` を呼びます。各レンダーブロックでは `processPreparedWithMonitor(numFrames)` を呼び、`getChannelBuffer(...)` と `getMonitorChannelBuffer(...)` でプログラムとキューのビューを読みます。準備メソッドは確保を行いますが、準備済みの処理経路はアロケーションしません。ホットパス外でコピーして渡す場合は、従来の `processWithMonitor(...)` も使えます。

### レンダー領域でマスタリングをプレビューする

`StreamingMasteringChain` は `@libraz/libsonare/worklet` からも公開されるため、ライブのマスタリングプレビューをメインスレッドへ往復させずにレンダー領域で実行できます。生成と `prepare()` はメッセージハンドラーで行い、`AudioWorkletProcessor.process()` からは呼ばないでください。準備時に確保が発生します。`loudness` 段を使うには、ブロック単位では統合 LUFS を計測できないため、オフラインで計測した `loudnessStaticGainDb` が必要です。最後のブロック後は空になるまでフラッシュし、時間を合わせる必要があれば先頭の `latencySamples()` サンプルを捨てます。このチェーンはエンジン外のホスト側ステージで、エンジンのディレイ補償やバイパスには参加しないため、ほかのエンジン出力との補償はホスト側で行います。

アプリ側でより高レベルのファサードが欲しい場合は、`SonareEngine` を使えます。

| 部品 | 役割 |
|------|------|
| worklet ノード | リアルタイム音声側を実行します。 |
| メインスレッド側の `RealtimeEngine` | オフライン処理やタイムライン操作を扱います。 |

`transport` API は play/stop、秒または PPQ（4 分音符単位の音楽的な位置）への seek、テンポ、ループ更新を扱います。トランスポート以外も、worklet API はエンジンのほぼすべての機能をコントロールメッセージ経由で worklet にミラーします。正となる状態を持つのはメインスレッドだけで、音声スレッドは同期済みスナップショットを受け取るだけです。

| やりたいこと | worklet API |
|--------------|----------------|
| トラックルーティング、フェーダー、パン、ソロ／ミュート | `setTrackLanes`、`setStripGain`、`setStripPan`、`setTrackStripPan`、`setTrackStripPanLaw`、`setTrackStripPanMode`、`setTrackStripDualPan`、`setTrackStripChannelDelaySamples`、`setSoloMute` |
| トラック／マスターのインサートと EQ | `setTrackStripJson`、`setMasterStripJson`、`setTrackStripEqBand`、`setMasterStripEqBand`、`setTrackStripInsertParamByName`、`setMasterStripInsertParamByName`、インサートバイパス系メソッド |
| センドとバス | `setTrackSends`、`setTrackOutputBus`、`setBusGain`、`setBusStripJson` |
| MIDI クリップとライブ MIDI | `setMidiClips`、`pushMidiNoteOn`、`pushMidiNoteOff`、`pushMidiCc`、`pushMidiProgram`、`pushMidiPanic` |
| パラメータオートメーション | `setAutomationLane`、`addAutomationPoint`、`automationParamId(target, kind)`、`busAutomationParamId(busId)`、`listParameters`、`automationLaneCount` |
| 楽器 | `setBuiltinInstrument`、`setSynthInstrument`、`loadSoundFont`、`setSf2Instrument` |
| 録音とモニタリング | `configureCapture`（`inputMonitor` を含む）、`armRecord`、`punch`、`capturedAudio`、`captureStatus` |
| トランスポート、テンポ、マーカー | `getTransportState`、`cachedTransportState`、`setTempoSegments`、`setTimeSignatureSegments`、マーカー系メソッド（全置換の `setMarkers` を含む。解決後のマーカー一覧（各エントリがエンジン `id` を持つ）を返す）、`setLoopFromMarkers` |
| クリップ更新 | `addClip`、`removeClip`（差分のクリップデルタを worklet へ送る） |
| メーターとテレメトリ | `onMeter` / `onTelemetry` / `onScope`、`pollMeters` / `pollTelemetry` / `pollScope`。メーターレコードはマスター・レーン・バス・入力のターゲット id を持つ。オフライン／メインスレッド側エンジンではワイドメーターレコードとスコープスナップショットも読み出せる |
| オフライン書き出し | メインスレッド側ミラーの `renderOffline`、`finishOfflineRender`、`bounceOffline`、`freezeOffline`（[オフライン書き出しの API](#オフライン書き出しの-api) を参照） |
| プロセッサ状態とタイミング | `resetProcessorState(renderFrame?)`、`tailSamples()`、`graphLatencySamplesQ8()` |

`pushMidiProgram` が届くのは、プログラムを選択するレシーバーです。SoundFont プレーヤー、`useGmPrograms` を指定したシンセ、`drum-kit`（GM キット）のシンセがそれに当たり、`drum-kit` ではプログラムが GS のドラムセットを選びます。組み込みシンセとそれ以外のシンセパッチは、メッセージを受け取っても無視します。

worklet API では、ストリップを指定するメソッドはトラック id *または名前*（`target: string | number`）を受け取り、`setSoloMute(target, solo, mute)` はレーンインデックスの解決まで行います。`setTrackStripEqBand` は `EqBand` オブジェクトを直接受け取るので、バンド JSON を手書きする必要はほとんどありません。

`automationParamId(target, 'faderDb' | 'pan')` と `busAutomationParamId(busId)` は予約済みエンジンパラメータ id を返すので、`addParameter` でカスタムパラメータを登録しなくても、それらをそのまま `setAutomationLane(paramId, points)` に渡してトラック／マスターのフェーダーやパン、あるいはバスのフェーダー（そのフェーダーゲイン dB に解決されます）を自動化できます。`target`／`busId` は初回利用時にミキサーのレーン／バスを宣言します。トラックやバスの id はリスト内の位置ではなく、その対象自体を指します。id は計算せず、必ずこれらのメソッドで取得してください。メインスレッド側ミラーと worklet 側エンジンは同じ番号を割り当てます。

ファサードの `setTrackLanes` は追加専用です。既存のトラック id をすべて同じ順序で残し、その後ろに新しい id を追加してください。既存レーンの並べ替えや削除は拒否されます。生の `RealtimeEngine` ではレーンリストを置き換えて並べ替えられます。その場合も予約済みオートメーション id は同じトラックを指し続け、そのトラックがない間は何も適用しません。

worklet 側でスコープスナップショットを流す場合は、`SonareRealtimeEngineNode.create(...)` に `scopeIntervalFrames`、`scopeBands`、必要に応じて `scopeSharedBuffer` / `scopeRingCapacity` を渡します。SAB のスコープ共有リングはレンダーコールバック内で確保を行わず、`pollScope()` で読み出します。`onScope()` は同じ `SonareWorkletScopeSnapshot` 形式を受け取ります。SAB が使えない場合や `mode: 'postMessage'` を指定した場合、プロセッサは `bands` と `points` を転送する `Float32Array` バッファとして各スナップショットに含めて送ります。この場合も `onScope()` は同じ形式で受け取りますが、共有リングがないため `pollScope()` は空配列を返します。postMessage 経路では転送前にスナップショットごとの配列を作ります。独自ブリッジでスペクトラムとベクトルスコープのスナップショットを共有リングに流したい場合は、低レベルの `createSonareScopeRingBuffer(...)` と `readSonareScopeRingBuffer(...)` を使えます。

メータースナップショットは、どちらの経路でも同じ形で `onMeter` に届きます。ステレオより多いチャンネルを持つターゲット（5.1 や 7.1 のバス）では、`channelCount` と、チャンネルごとの `peakDb`、`rmsDb`、`truePeakDb`、`inputPeakDb` 配列（標準の WAVE チャンネル順）が加わります。ステレオ用フィールドは常にプレーン 0 と 1 を保持します。SAB のメーターリングの 1 レコードは `SONARE_METER_RING_RECORD_FLOATS`（49）個の float で、ヘッダーのスロット 3 にはプロトコルバージョン（現在は `2`）が入ります。比較にはリテラルを使ってください（パッケージが export しているのは `SONARE_METER_RING_RECORD_FLOATS` と `SONARE_METER_RING_HEADER_INTS` だけです）。独自の読み出し側は export されている定数でサイズを決め、パッケージのバージョンが異なるメインスレッドと worklet の間でリングを共有しないでください。

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

`SonareEngine.create`、`SonareRealtimeEngineNode.create`、再生ノード、`SonareStreamAnalyzerNode.create` は省略可能な `sampleRate` を受け取ります。worklet は常に `AudioContext` のレートで動くため、`audioCtx.sampleRate` と異なる値を渡すとノードが作られる前に `RangeError` が投げられます。指定せずに省略してください。

### オフライン書き出しの API

`renderOffline`、`bounceOffline`、`freezeOffline` はファサードのメインスレッド側エンジンで動き、レンダーが終わるまで呼び出しスレッドをブロックします。長い処理はブロックしても問題ない場所で実行してください。OPFS ストリーミングのクリップは対象区間分を先に読み込みます。完了したレンダーはミラーのトランスポート位置を元に戻します。`finalize: false` の場合はチャンクごとに位置が進み、最後のチャンクまたは `finishOfflineRender()` で開始位置へ戻ります。`bounceOffline` と `freezeOffline` は素のエンジンの同名メソッドと同じオプションを受け取り、同じ結果を返します。詳しくは[リアルタイムエンジン](./realtime-engine.md)を参照してください。

| 呼び出し | 動作 |
|----------|------|
| `renderOffline(totalFrames)` | 現在位置からレンダーし、オフラインのチャンネルごとに 1 本のプレーナーバッファを返します。 |
| `renderOffline({ totalFrames, blockSize?, finalize? })` | リクエスト形式です。`blockSize` の既定値と上限はエンジンのオフラインブロックサイズで、超えると `RangeError` です。`finalize: false` は長いタイムラインの 1 チャンクをレンダーし、保持中のノートとディレイの残響を次の呼び出しへ持ち越します。 |
| `finishOfflineRender()` | チャンク分割レンダーを終えます。保持中のノートを解放し、ディレイラインを空にし、トランスポート位置を戻します。 |
| `bounceOffline(options)` | タイムラインをインターリーブバッファへバウンスします。`blockSize` の上限は同じです。 |
| `freezeOffline(options)` | ソース層を 1 つのクリップにフリーズします。以後、ファサード、ミラー、worklet はそのクリップだけを保持します。 |

```typescript
const total = 4 * 48000;
const chunkFrames = 48000;
const left: Float32Array[] = [];
for (let done = 0; done < total; done += chunkFrames) {
  const last = done + chunkFrames >= total;
  const chunk = await engine.renderOffline({
    totalFrames: Math.min(chunkFrames, total - done),
    finalize: last,
  });
  left.push(chunk[0]);
}
```

オフラインレンダーは、新しいレンダーセッションの開始時にミラーのミキサーとエフェクトの各プロセッサを準備直後の状態へ戻します。継続するチャンクでは、前のチャンクのプロセッサ状態、保持中のノート、残響を引き継ぎます。この準備処理は楽器をリセットしないため、現在のボイスやコントローラーの状態は結果に影響する場合があります。`resetProcessorState(renderFrame?)` はプロセッサのリセットをライブエンジンに対して行います。シークと同様に、鳴っているインサートの残響とディレイラインを断ち切り、`renderFrame` で適用され（省略時は次のブロック先頭）、楽器には影響しません。`tailSamples()` は最長の可聴テールをサンプル数の上限値で返し（`2147483647` は無制限）、`graphLatencySamplesQ8()` は処理レイテンシを 1/256 サンプル単位で返します。どちらもミラーから答えます。

### ノード直接の制御とポーリング

ここで挙げるのは、`SonareRealtimeEngineNode.create(...)` が返すノードのメソッドです。サンプル精度のコマンドをキューに積み、worklet の出力キューを回収します。`SonareEngine.node` は `connect()` するための素の `AudioWorkletNode` です。ファサードはエンジンノードを非公開にしており、同等の機能は `transport.*`、`resetProcessorState`、`resetMasterLoudnessMeter`、`getTransportState()`、`captureStatus()` / `capturedAudio()` / `resetCapture()`、`onMidiOut`、`pollInsertGainReduction` で使えます。

| メソッド | 用途 |
|----------|------|
| `play`、`stop`、`seekSample(timelineSample, sampleTime?)`、`seekPpq(ppq, sampleTime?)`、`resetProcessorState`、`resetMasterLoudnessMeter` | 絶対 `sampleTime` でトランスポートやリセットのコマンドをキューに積みます。省略すると次のブロック先頭で適用され、負の値は `RangeError` です。いずれもキューに積めたかどうかを返します。 |
| `hasCommandRoom()` | いま整形済みのコマンドをもう 1 つ積めるかを返します。何も積みません。 |
| `requestTransportState()` | worklet 側のトランスポート状態で解決します。 |
| `requestCaptureStatus()`、`requestCapturedAudio()`、`requestCaptureReset()` | worklet が持つキャプチャバッファを読み書きします。 |
| `pollMidiOut()` / `onMidiOut(cb)` | MIDI 1.0 バイトに変換済みの外部 MIDI イベントを回収し、Web MIDI の出力ポートへ渡します。`onMidiOut` を購読している間はリングがそちらに消費されるため、手動のポーリングには以降に届いた分しか見えません。 |
| `pollClipPageRequests()` / `onClipPageRequests(cb)` | 独自のページング処理向けに、クリップページのミスをバッチで回収します。 |
| `onSyncError(cb)` | worklet が拒否したコントロールメッセージを受け取ります。購読解除関数を返します。 |

### オーディオグラフの一部を解析する

`SonareStreamAnalyzerNode` は、プロセッサを自作せずにオーディオグラフ上の任意のノードへ `StreamAnalyzer` をかけます。worklet 側はモノラルへのダウンミックスとチャンクの転送だけを行い、アナライザーはメインスレッドで動くため、worklet 内の WASM も `SharedArrayBuffer` も要りません。`SonareStreamAnalyzerNode.create` は、前述の省略可能な `sampleRate` を受け取ります。登録コードと完全な例は [WASM のストリーミングとリアルタイム処理](./wasm-streaming.md#オーディオグラフの一部を解析する) にあります。

::: tip worklet 同期メッセージ
`SonareEngine` は worklet 内で embind エンジンを動かします。ホスト側の worklet エントリーがメッセージ名をフィルタしてから転送している場合は、`sync*`・`captureRequest`・`transportRequest` のすべてを許可リストに加えてください。そうしないとレーン／ストリップ／MIDI の同期メッセージが黙って落ちます。
:::

## 表示用の波形ピーク

任意のズームでクリップを描くのに、全サンプルは必要ありません。必要なのは画面の列ごとの最小／最大包絡です。`waveformPeaks(...)` はインターリーブ音声をチャンネルごとの最小／最大の**バケット**へ縮約し、そのまま描けます。

```typescript
import { init, waveformPeaks, waveformPeakPyramid } from '@libraz/libsonare';

await init();

// インターリーブ配置はステレオなら（L0,R0,L1,R1,...）。この例はモノラルなので
// channels = 1。
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

- [リアルタイムエンジン](./realtime-engine.md): このページのブリッジとクリップストリーミングが供給する、トランスポート・レーンミキサー・オートメーション・MIDI クリップ・外部 MIDI ルーティングを備えたエンジン本体
- [ミキシングエンジン](./mixing.md): マルチトラックのリアルタイム向けストリップ／バス／センド／メータリング
- [JavaScript API](./js-api-analysis.md) · [Python API](./python-api.md): これらの推定の背後にあるバッチ特徴量変換
- [DSP 実装解説](./dsp-implementation.md): オンセット、クロマ、テンポ特徴量の構築方法
