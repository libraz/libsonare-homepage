---
title: リアルタイムとストリーミング
description: libsonare のリアルタイム API — ライブ MIR 用 StreamAnalyzer（メル／クロマ／オンセットのフレーム、逐次 BPM／キー／コード／パターン、量子化出力フォーマット）と、トランスポート／再生用 RealtimeEngine。ストリーミングのオンセット包絡からテンポグラムを得る方法も解説します。
---

# リアルタイムとストリーミング

libsonare には、リアルタイム用途の API が 2 系統あります。

- **`StreamAnalyzer`** — 音声ブロックを入力し、*解析フレーム*（メル、クロマ、オンセット、スペクトル）と逐次的な音楽推定（BPM、キー、コード、コード進行、パターン）を出力します。ビジュアライザーや「今この曲が何をしているか」のライブ表示に使います。
- **`RealtimeEngine`** — トランスポート、オートメーション、クリップ再生、グラフルーティング、メトロノーム、キャプチャ、オフラインバウンス、フリーズ、テレメトリ。再生エンジン向けです。

このページでいう**チャンク**や**ブロック**は、AudioWorklet などで繰り返し処理する短い音声片のことです。リアルタイム処理では、音声コールバック内で重いアロケーションを避けるのが基本です。先にオブジェクトを準備し、コールバックではブロック処理だけを行います。

::: info チャンク・ブロック・フレームの違い
**チャンク**や**ブロック**は、リアルタイム入力から届く短い音声サンプルのまとまりです。**フレーム**は、その音声ブロックを解析して得た時間単位の特徴量です。入力はブロック、UI に描く結果はフレーム、と分けて考えると混乱しにくくなります。
:::

## このページで身につくこと

このページを読むと、次のことを判断・実装できるようになります。

- アプリに `StreamAnalyzer`、`RealtimeEngine`、ミキシングエンジンのどれが必要かを選べる。
- 圧縮ファイルのバイト列、デコード済みサンプル、ブロック、フレームを混同せずに音声を渡せる。
- UI 用の特徴フレームを読み出し、量子化読み出しがなぜあるかを理解できる。
- 逐次 BPM／キー／コード推定を、初期値から最終結果のように扱わずに使える。
- 音声コールバック内で安全な処理と、事前準備すべき処理を区別できる。

## 初学者向けの選び方

| 作りたいもの | 最初に使うもの |
|--------------|----------------|
| スペクトログラム、クロマ、オンセット強度、ライブ BPM／キー推定を描くビジュアライザー | `StreamAnalyzer` |
| ライブのコード／進行／パターン表示 | `StreamAnalyzer.stats()` |
| テンポ、ループ、マーカー、メトロノーム、クリップ、オートメーションを持つ再生エンジン | `RealtimeEngine` |
| ストリップ、センド、メーターを持つミキサー | [ミキシングエンジン](./mixing.md) |
| 単純なオフラインスクリプト | このページではなく [はじめに](./getting-started.md) |

## どちらを使うか

| やりたいこと | API |
|--------------|-----|
| マイク入力や再生中のファイルからメル／クロマ／オンセットのフレームを取り出す | `StreamAnalyzer` |
| BPM、キー、現在のコード、コード進行、パターンスコアを逐次推定する | `StreamAnalyzer.stats()` |
| トランスポート、テンポ、ループ、マーカー、メトロノーム、クリップ、オートメーションを扱う | `RealtimeEngine` |
| テレメトリ付きの AudioWorklet ブリッジを作る | `RealtimeEngine` または軽量な `sonare-rt` モジュール |
| センドやメーター付きでステム／ストリップをミックスする | [ミキシングエンジン](./mixing.md) |

::: info ランタイムごとの入口
このページの中心はブラウザ / WASM の `StreamAnalyzer`、`RealtimeEngine`、AudioWorklet ブリッジです。Python と CLI は「ライブの音声コールバック内で状態を保つ」ための同一 API ではなく、ファイルや配列をまとめて処理するバッチ API が主な入口です。

| 実行環境 | 使う入口 | 典型的な用途 |
|----------|----------|--------------|
| ブラウザ / WASM | `StreamAnalyzer`、`RealtimeEngine`、`@libraz/libsonare/worklet` | ライブ可視化、AudioWorklet、逐次 BPM / キー / コード表示 |
| Python | `Audio.analyze()`、`onset_envelope(...)`、`tempogram(...)` などのバッチ関数 | ノートブック、オフライン解析、検証用スクリプト |
| CLI | `sonare analyze`、`sonare bpm`、`sonare key` など | ファイル単位の確認、バッチ処理、JSON 出力 |

Python / CLI で同じファイルを解析したい場合は [Python API](./python-api.md) と [CLI リファレンス](./cli.md) を使ってください。音声コールバック内で動かす実装例は、WASM / Worklet 側のコードだけを正として扱います。
:::

## StreamAnalyzer

`StreamAnalyzer` は音声ブロックを処理し、UI 描画用のフレームバッファを出力します。スペクトログラム、クロマ表示、オンセット駆動のビジュアル、逐次的な音楽推定に向いています。一度構築し、受け取ったブロックごとに `process()` し、たまったフレームを読み出します。

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
});

analyzer.process(inputBlock);

const frames = analyzer.readFrames(analyzer.availableFrames());
const stats = analyzer.stats();

if (stats.estimate.updated) {
  console.log(stats.estimate.bpm, stats.estimate.key, stats.estimate.chordRoot);
}
```

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

### 逐次推定: BPM、キー、コード、パターン

`stats()` は `AnalyzerStats` を返し、その `estimate` フィールドが **`ProgressiveEstimate`** です — 音声が届くほど精緻になる、解析器の音楽に対する逐次的な最良推定です。読む前に `estimate.updated` を確認してください。推定が実際に変化したフレームでのみ `true` になるので、無駄な UI 更新を避けられます。

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

*テンポグラム*は、オンセット包絡を時間 × テンポの画像に変換します。逐次 BPM 推定の背後にあるオフライン表現です。

蓄積した包絡、または `onsetEnvelope(...)` で得た任意のオンセット包絡から計算します。これは音声コールバック内で毎回実行する処理ではなく、バッファした窓に対するバッチ処理です。

```typescript
import { init, onsetEnvelope, tempogram, fourierTempogram, cyclicTempogram, tempogramRatio, plp } from '@libraz/libsonare';

await init();

const env = onsetEnvelope(samples, sampleRate, 2048, 512);

const ac  = tempogram(env, sampleRate, 512, 384, 'autocorrelation'); // 既定
const cos = tempogram(env, sampleRate, 512, 384, 'cosine');
const ft  = fourierTempogram(env, sampleRate, 512, 384);
const cyc = cyclicTempogram(env, sampleRate, 512, 384, 60, 60);
const ratio = tempogramRatio(ac.data, 384, sampleRate, 512);
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

## RealtimeEngine

`RealtimeEngine` は、より広い意味でのトランスポート／再生エンジンです。パラメータやトランスポートに対するサンプル精度のコマンドを扱い、非リアルタイム書き出し用のオフラインレンダーも提供します。

```typescript
import { init, RealtimeEngine, engineCapabilities } from '@libraz/libsonare';

await init();

const caps = engineCapabilities();
if (!caps.abiCompatible) throw new Error('Realtime engine ABI mismatch');

const engine = new RealtimeEngine(48000, 128);
engine.setTempo(128);
engine.setTimeSignature(4, 4);
engine.setLoop(0, 16, true);
engine.play();

const output = engine.process([leftBlock, rightBlock]);
const transport = engine.getTransportState();
const telemetry = engine.drainTelemetry();

engine.stop();
engine.destroy();
```

`RealtimeEngine` では、パラメータ情報の登録、オートメーションレーンの設定、マーカーへのシーク、メトロノームクリックの設定、モニター出力付き処理、キャプチャ、オフラインバウンス、クリップのフリーズ、メーターテレメトリの読み出しも扱えます。

::: warning 構築前にエンジン ABI を確認する
`engineCapabilities().abiCompatible` は、読み込んだ WASM が JS ラッパーの期待するエンジン ABI と一致するかを確認します。リアルタイムエンジンはライブラリ中で最もバージョンに敏感な面で、不一致のバイナリに対して構築すると未定義です。上記のチェックでガードし、失敗したら `@libraz/libsonare` パッケージを更新して、WASM バイナリと JS ラッパーを同じリリースに揃えてください。
:::

## AudioWorklet での使い分け

通常の WASM パッケージは完全な `RealtimeEngine` クラスを公開します。任意の Worklet ブリッジでは、`SonareRealtimeEngineNode.create(...)` から完全版の embind ランタイムと専用の `sonare-rt` ランタイムのどちらかを選べます。

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
  runtimeTarget: 'embind', // Worklet 内で完全版 RealtimeEngine を使う
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

`transport` ファサードは play/stop、秒または PPQ への seek、テンポ、ループ更新を扱います。さらにオートメーションレーン、クリップ、録音 arm/punch、メトロノーム、オフラインレンダー、メーターリスナー、テレメトリポーリングを橋渡しします。

```typescript
import { SonareEngine } from '@libraz/libsonare/worklet';

const engine = await SonareEngine.create(audioCtx, {
  moduleUrl: '/sonare-engine-worklet.js',
  mode: 'auto',
  channelCount: 2,
});

engine.transport.setTempo(120);
engine.transport.setLoop(0, 4, true);
engine.transport.play();
engine.onMeter((meter) => console.log(meter.rmsDbL, meter.rmsDbR));

const offline = await engine.renderOffline(48000);
console.log(offline[0].length);

engine.destroy();
```

別の `sonare-rt` モジュールは AudioWorklet のホットパス用に意図的に小さくしてあります。対象はトランスポート、テンポ／ループ、マーカーシーク、メトロノーム有効化、キャプチャのアーム／パンチコマンド、ブロック処理、基本テレメトリ読み出しです。メインスレッド側に置く方が自然な embind の重い機能は省かれています。

```typescript
const rtNode = await SonareRealtimeEngineNode.create(audioCtx, {
  moduleUrl: '/sonare-engine-worklet.js',
  runtimeTarget: 'sonare-rt',
  rtModuleUrl: '/sonare-rt.js', // 縮小版ランタイムでは必須
  channelCount: 2,
});

await rtNode.ready; // Worklet 内で縮小版モジュールのロードが完了すると resolve
```

| 完全版 `RealtimeEngine` のみ | `sonare-rt` から省く理由 |
|---------------------------|--------------------------|
| パラメータレジストリとオートメーションレーン（`addParameter`、`parameterInfo`、`setAutomationLane`、`setParameter*`） | レンダーコールバック内の JS オブジェクト / 文字列マーシャリングを避けるため |
| トランスポートの読み戻し（`getTransportState`） | Worklet ブリッジ側で状態をミラーするため |
| 完全なマーカー / 拍子ヘルパー | `sonare-rt` はマーカーシークとトランスポートコマンドに絞るため |
| グラフトポロジーとクリップスケジューリング | グラフ / クリップ編集は完全版 embind ランタイムの責務 |
| キャプチャの読み戻しとオフラインレンダー（`capturedAudio`、`renderOffline`、`bounceOffline`、`freezeOffline`） | 非リアルタイム処理のため |
| メーターテレメトリの回収 | 縮小版ランタイムは基本テレメトリ経路だけを公開するため |

シーン編集、パラメータ確認、グラフ操作、キャプチャの読み戻し、オフライン書き出しが必要な場合はメインスレッドで通常パッケージを使います。レンダーコールバック内でアロケーションや GC を抑えたい場合は、AudioWorklet 側で `sonare-rt` を使うのが自然です。

## 関連

- [ミキシングエンジン](./mixing.md) — マルチトラックのリアルタイム向けストリップ／バス／センド／メータリング
- [JavaScript API](./js-api.md) · [Python API](./python-api.md) — これらの推定の背後にあるバッチ特徴量変換
- [DSP 実装解説](./dsp-implementation.md) — オンセット、クロマ、テンポ特徴量の構築方法
