---
title: WASM のストリーミングとリアルタイム処理
description: libsonare WASM パッケージのストリーミング・リアルタイム API。AudioWorklet と連携するライブの StreamAnalyzer 解析、メル/MFCC からの逆再構成、StreamingRetune、RealtimeVoiceChanger を扱います。
---

# WASM のストリーミングとリアルタイム処理

このページでは、WASM のストリーミング・リアルタイム API（ライブのストリーミング解析、逆再構成、Streaming Retune、リアルタイムボイスチェンジャー）を扱います。基本は [WebAssembly ガイド](./wasm.md) を参照してください。

## ストリーミング解析

ストリーミング API は、音声が到着するたびにチャンクごとに解析します。ビジュアライザーやライブの BPM/キー表示が、ファイル全体の読み込みを待つ必要はありません。

::: info バッチ vs ストリーミング
| アプローチ | 用途 | レイテンシ | 機能 |
|-----------|------|----------|------|
| **バッチ** | 録音済みファイル | 高 | 総合解析（BPM、コード、セクション） |
| **ストリーミング** | ライブ音声、ビジュアライゼーション | 低（解析窓 1 つ分、nFft 2048・44.1 kHz で約 46 ms） | メル、クロマ、オンセット、更新される BPM/キー |
:::

<SonareDemo id="loudness-meter" />

### 解析をどこで動かすか

| 経路 | 解析が動く場所 | worklet 内の WASM | 使う場面 |
|------|----------------|-------------------|----------|
| [`SonareStreamAnalyzerNode`](#オーディオグラフの一部を解析する) | メインスレッド | 不要 | ライブのグラフに対する標準の選択。プロセッサも `SharedArrayBuffer` も不要 |
| [独自の analyzer worklet](#独自の-analyzer-worklet) | オーディオスレッド | 必要 | 解析をメインスレッドから外し、自前の DSP と並べたいとき |
| [`ScriptProcessorNode`](#基本的な例) | メインスレッド | 不要 | デモ専用。ノード自体が非推奨 |

### オーディオグラフの一部を解析する

`SonareStreamAnalyzerNode` は、オーディオグラフ上の任意のノードに `StreamAnalyzer` をかけます。worklet 側は入力をモノラルに平均し、固定サイズのチャンク（`chunkFrames`、既定 4096、128 以上）を転送するだけです。アナライザー自体はメインスレッドで動くので、フレームは音声より約 1 チャンク遅れます。ノードは入力 1、出力なしです。

```typescript
// analyzer-worklet.ts
import { registerSonareStreamAnalyzerWorkletProcessor } from '@libraz/libsonare/worklet';

registerSonareStreamAnalyzerWorkletProcessor();
```

```typescript
// main.ts
import { init } from '@libraz/libsonare';
import { SonareStreamAnalyzerNode } from '@libraz/libsonare/worklet';

await init();
await audioCtx.audioWorklet.addModule('/analyzer-worklet.js');
const analyzer = await SonareStreamAnalyzerNode.create(audioCtx, {
  config: { nMels: 64 },
});
source.connect(analyzer.node);

const stopFrames = analyzer.onFrames((frames) => draw(frames.mel, frames.nFrames));
const stopStats = analyzer.onStats((stats) => console.log(stats.estimate.bpm));

// 後始末:
stopFrames();
stopStats();
analyzer.destroy();
```

`config` は `new StreamAnalyzer(...)` と同じフィールドを受け取ります。`sampleRate` の既定値はコンテキストのレートで、それ以外の値は `RangeError` になります。`onFrames` は `readFrames` 形式で届き、`onStats` はキーまたはテンポの推定が更新されたときに呼ばれます。チャンクが落ちたりプロセッサが再起動したりした場合、アナライザーのサンプルオフセットはリセットされ、2 つのストリームを継ぎ合わせることはありません。

### 基本的な例

::: warning `ScriptProcessorNode` は非推奨
下の例では、フレームの流れを最短で確認できる `createScriptProcessor()` を使っています。このノードはメインスレッドで動くため、負荷がかかるとグリッチが発生することがあります。実運用では [`SonareStreamAnalyzerNode`](#オーディオグラフの一部を解析する) か[独自の analyzer worklet](#独自の-analyzer-worklet) を使ってください。
:::

```typescript
import { init, StreamAnalyzer } from '@libraz/libsonare';

async function setupStreaming() {
  await init();

  const audioCtx = new AudioContext();
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const source = audioCtx.createMediaStreamSource(stream);

  // 出力フレームをスロットリングしたアナライザーを作成
  const analyzer = new StreamAnalyzer({
    sampleRate: audioCtx.sampleRate,
    nFft: 2048,
    hopLength: 512,
    nMels: 128,
    computeMel: true, computeChroma: true, computeOnset: true,
    emitEveryNFrames: 4, // 4 ホップごとに 1 フレーム出力（44100Hz・hopLength 512 で毎秒約 21 フレーム）
  });

  const processor = audioCtx.createScriptProcessor(512, 1, 1);

  processor.onaudioprocess = (e) => {
    const input = e.inputBuffer.getChannelData(0);
    analyzer.process(input);

    const available = analyzer.availableFrames();
    if (available > 0) {
      const frames = analyzer.readFrames(available);
      updateVisualization(frames);

      // BPM/キー推定は音声が届くにつれて更新される
      const stats = analyzer.stats();
      if (stats.estimate.updated) {
        console.log(`BPM: ${stats.estimate.bpm.toFixed(1)}`);
        if (stats.estimate.keyName !== null) console.log(`キー: ${stats.estimate.keyName}`);
      }
    }
  };

  source.connect(processor);
  processor.connect(audioCtx.destination);

  // セッション終了時に呼ぶ。コールバックを止めてから WASM ハンドルを解放する
  return () => {
    processor.disconnect();
    source.disconnect();
    analyzer.delete();
  };
}
```

`delete()` でアナライザーの WASM ハンドルを解放します（`dispose()` は後方互換の別名で、`using` も使えます）。embind のハンドルはガベージコレクションされないため、セッションが終わったら解放してください。

### 独自の analyzer worklet

解析をメインスレッドから外したいときは、自前の `AudioWorkletProcessor` の中で `StreamAnalyzer` を動かします。スレッド境界を `postMessage` で越えるのは、生の音声ではなく、あらかじめ計算済みの小さなフレームバッファだけです。

<FlowDiagram
  title="ストリーミングパイプライン"
  :nodes="[
    { id: 'mic', label: 'マイク / ファイル', col: 0, row: 0, group: 'browser', variant: 'muted' },
    { id: 'ctx', label: 'AudioContext', col: 1, row: 0, group: 'browser' },
    { id: 'node', label: 'AudioWorkletNode', col: 2, row: 0, group: 'browser', variant: 'accent' },
    { id: 'processor', label: 'AudioWorkletProcessor', col: 3, row: 0, group: 'worklet' },
    { id: 'analyzer', label: 'StreamAnalyzer', col: 4, row: 0, group: 'worklet', variant: 'accent' },
    { id: 'buffer', label: '量子化フレーム', col: 5, row: 0, group: 'worklet' },
    { id: 'viz', label: 'ビジュアライゼーション', col: 6, row: 0, group: 'main' },
    { id: 'canvas', label: 'Canvas / WebGL', col: 7, row: 0, group: 'main', variant: 'success' }
  ]"
  :edges="[
    { from: 'mic', to: 'ctx' },
    { from: 'ctx', to: 'node' },
    { from: 'node', to: 'processor' },
    { from: 'processor', to: 'analyzer' },
    { from: 'analyzer', to: 'buffer' },
    { from: 'buffer', to: 'viz', label: 'postMessage', style: 'dashed' },
    { from: 'viz', to: 'canvas' }
  ]"
  :groups="[
    { id: 'browser', label: 'ブラウザ' },
    { id: 'worklet', label: 'AudioWorklet スレッド' },
    { id: 'main', label: 'メインスレッド' }
  ]"
  caption="破線より左側はすべてメインスレッド外で実行され、メインスレッドに戻ってくるのは postMessage の一往復だけです。"
/>

::: warning worklet には専用の WASM モジュールが必要です
worklet は独自のグローバルスコープと WASM ヒープを持ちます。引数なしの `init()` はここでは動きません。モジュールを動的 `import()` で読み込みますが、worklet スコープでは禁止されています。また、グルーコードは `.wasm` ファイルを `URL` と `fetch` で解決しますが、worklet にはどちらもありません。Emscripten のファクトリを静的 import し、`.wasm` のバイト列をメインスレッドで取得して `processorOptions` で渡し、3 つとも `init({ moduleFactory, wasmBinary, locateFile })` に渡してください。
:::

**analyzer-worklet.ts:**

```typescript
import { init, StreamAnalyzer } from '@libraz/libsonare';
// パッケージの WASM グルーに含まれる Emscripten ファクトリ（sonare.js）
import createModule from './sonare.js';

class AnalyzerWorklet extends AudioWorkletProcessor {
  private analyzer?: StreamAnalyzer;
  private frameCounter = 0;

  constructor(options: AudioWorkletNodeOptions) {
    super();
    const { wasmBinary } = options.processorOptions;
    void init({ moduleFactory: createModule, wasmBinary, locateFile: (path) => path }).then(() => {
      // sampleRate は AudioWorkletGlobalScope のグローバル
      this.analyzer = new StreamAnalyzer({
        sampleRate,
        nFft: 2048,
        hopLength: 512,
        nMels: 64, // 帯域幅のため削減
        computeMel: true, computeChroma: true, computeOnset: true,
        emitEveryNFrames: 4,
      });
    });
    this.port.onmessage = (e) => {
      if (e.data.type === 'destroy') {
        this.analyzer?.delete();
        this.analyzer = undefined;
      }
    };
  }

  process(inputs: Float32Array[][]): boolean {
    const input = inputs[0]?.[0];
    if (!input || input.length === 0 || !this.analyzer) return true;

    this.analyzer.process(input);

    const available = this.analyzer.availableFrames();
    if (available >= 4) {
      const frames = this.analyzer.readFrames(available);

      // ゼロコピー転送
      this.port.postMessage({ type: 'frames', data: frames }, [
        frames.timestamps.buffer, frames.mel.buffer, frames.chroma.buffer,
      ]);
    }

    // 定期的に統計情報を送信
    if (++this.frameCounter % 100 === 0) {
      this.port.postMessage({ type: 'stats', data: this.analyzer.stats() });
    }

    return true;
  }
}

registerProcessor('analyzer-worklet', AnalyzerWorklet);
```

**main.ts:**

```typescript
const audioCtx = new AudioContext();
await audioCtx.audioWorklet.addModule('analyzer-worklet.js');

// wasmUrl: パッケージの sonare.wasm の URL（バンドラーのアセット import）
const wasmBinary = await (await fetch(wasmUrl)).arrayBuffer();
const workletNode = new AudioWorkletNode(audioCtx, 'analyzer-worklet', {
  processorOptions: { wasmBinary },
});

workletNode.port.onmessage = (e) => {
  if (e.data.type === 'frames') {
    renderVisualization(e.data.data);
  } else if (e.data.type === 'stats') {
    updateBpmDisplay(e.data.data.estimate);
  }
};

// 音声ソースを接続
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
const source = audioCtx.createMediaStreamSource(stream);
source.connect(workletNode);

// 後始末: worklet 内のアナライザーを解放する
workletNode.port.postMessage({ type: 'destroy' });
```

::: details 関連するエントリポイント（リアルタイムエンジン、MIDI）
トラックレーン、チャンネルストリップ、バス、MIDI クリップ、ライブ MIDI、楽器、キャプチャといった再生エンジン全体を worklet 内で動かしたい場合は、`@libraz/libsonare/worklet` の AudioWorklet ブリッジを使います。ブリッジの `SonareEngine` API がそのエンジンを worklet へミラーします。詳しくは [リアルタイムとストリーミング](./realtime-streaming.md) を参照してください。

メインエントリ（`@libraz/libsonare`）には、メインスレッド用のブラウザ連携ヘルパーが 2 つ同梱されています。`bindMicrophoneInput(...)` は `getUserMedia` を AudioWorklet のエンジンノードへつなぎ（[録音とテイク](./recording-and-takes.md) を参照）、`bindWebMidi(...)` は Web MIDI 入力をエンジンへ橋渡しします（[MIDI 入力](./midi-input.md) を参照）。
:::

### 帯域幅最適化

TypeScript の `StreamAnalyzer` には、3 つの読み出し方法があります。UI に必要な精度と、スレッド間で送れるデータ量に応じて選びます。

| メソッド | 戻り値 | フレームあたりサイズ目安 | 使う場面 |
|----------|--------|--------------------------|----------|
| `readFrames(maxFrames)` | `Float32Array` / `Int32Array` を持つ `FrameBuffer` | 約 600 バイト | 解析や高品質な可視化でフル精度が必要なとき |
| `readFramesI16(maxFrames)` | `StreamFramesI16` | 約 300 バイト | メーターや一般的な可視化で、転送量を減らしたいとき |
| `readFramesU8(maxFrames)` | `StreamFramesU8` | 約 150 バイト | モバイルや高頻度更新で、転送量をかなり小さくしたいとき |

内部解析は float のままです。転送精度は明示的な読み出しメソッドで選びます。float なら `readFrames()`、16-bit なら `readFramesI16()`、8-bit なら `readFramesU8()` を使ってください。`StreamConfig.outputFormat` はソース互換性のためだけに残っており、省略するか `0` を指定します。C++/WASM の読み出し経路が整数形式を量子化するため、`postMessage` の前に JS 側で量子化する必要はありません。

どちらの量子化読み出し経路も、オプションの `StreamQuantizeConfig` を受け取れます。通常設定では飽和してしまうほど大きい／小さいストリーム向けに量子化レンジを広げられます。[量子化レンジのカスタマイズ](./realtime-streaming.md#量子化レンジのカスタマイズ) を参照してください。

WASM から返るプレーンなリストやオブジェクトは、呼び出し側の JavaScript realm の `Array` / `Object` として返されます。これにより、名前一覧ヘルパー（`*Names()`）、プリセット名ヘルパー、セクション結果、キー候補、`synthPresetPatch(...)` のオブジェクト、ミキサーのメータースナップショット（`meterTap`、`stripMeter`、`busMeter`）、ゴニオメーターのサンプル（`readGoniometerLatest`）は、手作業で作り直さなくても `structuredClone()` や `postMessage()` に渡せます。`Mixer` や `StreamAnalyzer` のようにネイティブメソッドを持つハンドル自体は clone できないため、プレーンな戻り値のデータを渡します。TypedArray のペイロードは、下の通常の transferable buffer ルールに従います。

::: details 「Structure-of-Arrays」と transferable オブジェクトとは？
- **Structure-of-Arrays**（SoA） は、フレームごとのオブジェクトの配列ではなく、各フィールドを独立したフラットな typed array に持つ形式です（タイムスタンプは 1 本、メル値は別の 1 本…）。スライスも別スレッドへの受け渡しも安価になります。
- **transferable オブジェクト** は、`postMessage` がコピーせず*移動*できる `ArrayBuffer` です。所有権が移る（送信側のビューは空になる）ため、音声フレームのスレッド間受け渡しがほぼ瞬時になります。バッファは第 2 引数に列挙します: `postMessage(msg, [buffer, ...])`。
- **量子化** はここでは、各 float をより小さい 16bit / 8bit 整数に詰めることを指します。送るバイト数は減りますが精度は落ちます（メーターやヒートマップには十分、後段の DSP には不向き）。
:::

### 更新される推定

ストリーミング API は時間とともに精度が向上する **BPM/キー推定**を提供します。

```typescript
const stats = analyzer.stats();

// BPM（約 10 秒後に利用可能。StreamConfig.bpmUpdateIntervalSec 既定値）
if (stats.estimate.bpm > 0) {
  const confidence = stats.estimate.bpmConfidence;
  console.log(`BPM: ${stats.estimate.bpm.toFixed(1)} (${(confidence * 100).toFixed(0)}%)`);
}

// キー（約 5 秒後に利用可能。StreamConfig.keyUpdateIntervalSec 既定値）
if (stats.estimate.keyName !== null) {
  console.log(`キー: ${stats.estimate.keyName}`); // 例: "A minor"。keyShortName は "Am"
}
```

ピッチのある内容がまだないとき（無音など）は、`key` と `chordRoot` が `-1`、`keyName` が `null`、`chordName` が `'N.C.'` になります。キー推定は 186 ms のクロマ窓から計算するため、フレーム出力より遅れます。44100 Hz 未満のストリームでは `nFft` が再スケールされます。詳しくは[使い方、AudioWorklet 統合、タイミング](./js-api-streaming.md#使い方、audioworklet-統合、タイミング)を参照してください。

### ビジュアライゼーション例

```typescript
import type { StreamAnalyzer } from '@libraz/libsonare';

function renderVisualization(frames: ReturnType<StreamAnalyzer['readFrames']>, nMels: number) {
  const { nFrames, mel, chroma, onsetStrength } = frames;

  for (let f = 0; f < nFrames; f++) {
    for (let m = 0; m < nMels; m++) {
      const value = Math.min(1, mel[f * nMels + m]); // 線形パワーを 0-1 にクランプ
      // (scrollX + f, nMels - m) にピクセルを描画
    }
    for (let c = 0; c < 12; c++) {
      const value = chroma[f * 12 + c]; // 12 ピッチクラス
      // クロマバーを描画
    }
    if (onsetStrength[f] > 1.5) triggerBeatEffect(); // しきい値は素材に合わせて調整
  }
}
```

## 逆再構成

WASM ビルドには逆再構成ヘルパーが同梱されており、メルスペクトログラムや MFCC 行列からスペクトルや音声へ、ブラウザ内で完結して戻せます。

```typescript
import { melSpectrogram, melToAudio, mfcc, mfccToAudio, init } from '@libraz/libsonare';

await init();

// メル → 音声（Griffin-Lim による位相復元）
const mel = melSpectrogram(samples, sampleRate, 2048, 512, 128);
const reconstructed = melToAudio(mel.power, mel.nMels, mel.nFrames, sampleRate);

// MFCC → 音声
const m = mfcc(samples, sampleRate, 2048, 512, 128, 20);
const fromMfcc = mfccToAudio(m.coefficients, m.nMfcc, m.nFrames, mel.nMels, sampleRate);
```

ソースビルド C++ CLI での対応コマンド:

```bash [C++ CLI]
sonare mel-to-audio music.wav -o mel-reconstructed.wav
sonare mfcc-to-audio music.wav -o mfcc-reconstructed.wav
```

| 関数 | 戻り値 | 備考 |
|------|--------|------|
| `melToStft(power, nMels, nFrames, sampleRate?, nFft?, fmin?, fmax?, htk?)` | `StftPowerResult` `{ nBins, nFrames, power }` | メルフィルターバンクの擬似逆変換 |
| `melToAudio(power, nMels, nFrames, sampleRate?, nFft?, hopLength?, fmin?, fmax?, nIter?, htk?)` | `Float32Array` | Griffin-Lim による音声合成 |
| `mfccToMel(coefficients, nMfcc, nFrames, nMels?, lifter?)` | `MelPowerResult` `{ nMels, nFrames, power }` | 逆 DCT でメルスペクトログラムへ。順変換で使った lifter を渡す |
| `mfccToAudio(coefficients, nMfcc, nFrames, nMels, sampleRate?, nFft?, hopLength?, fmin?, fmax?, nIter?, htk?, lifter?)` | `Float32Array` | MFCC → メル → 音声を一度に。順変換で使った lifter を渡す |

::: warning ロスのある往復
これらは*振幅*を再構成し、位相を Griffin-Lim で推定するため、出力は近似です。ソニフィケーション・試聴・可視化には十分ですが、ビット精度の復元には使えません。処理の流れと注意点は [逆変換特徴量](./inverse-features.md) を参照してください。
:::

## Streaming Retune

`StreamingRetune` は、ブロック単位で動かすモノラルのリチューン用 WASM オブジェクトです。ライブ入力やチャンク処理で、ブロック間の状態を保ったままピッチを動かしたい場合に使います。

```typescript
import { init, StreamingRetune } from '@libraz/libsonare';

await init();

const retune = new StreamingRetune({ semitones: 3, mix: 1 });
retune.prepare(48000, 512);

try {
  const shifted = retune.processMono(inputBlock);
  retune.setConfig({ semitones: -2, mix: 0.75 });
  const next = retune.processMono(nextInputBlock);
  console.log(shifted, next, retune.grainSize());
} finally {
  retune.delete();
}
```

ファイル単位のオフライン処理をターミナルで行う場合は、近い CLI コマンドとして次を使います。どちらも Python CLI で使えます。

```bash
sonare pitch-shift vocal.wav --semitones 3 -o shifted.wav
sonare voice-change vocal.wav --pitch-semitones 3 --formant-factor 1.0 -o voice.wav
```

## リアルタイムボイスチェンジャー

`RealtimeVoiceChanger` は、プリセット式のライブ音声チェーン用 WASM オブジェクトです。オフラインの `voiceChange(...)` ヘルパーとは別に、ブロック間の DSP 状態を保持します。AudioWorklet 形式のループでコピーを減らせるよう、WASM ヒープ上のゼロコピーバッファも公開します。信号チェーン、プリセット、`formantMode`、`voice.changer` インサートは[リアルタイムボイスチェンジャー](./realtime-voice-changer.md)を参照してください。

```typescript
import {
  init,
  RealtimeVoiceChanger,
  realtimeVoiceChangerPresetConfig,
  realtimeVoiceChangerPresetNames,
  voiceCharacterPresetId,
} from '@libraz/libsonare';

await init();

const changer = new RealtimeVoiceChanger('bright-idol');
changer.prepare(48000, 128, 1);

try {
  const out = changer.processMono(inputBlock);

  const realtime = changer.createRealtimeMonoBuffer(128);
  realtime.input.set(inputBlock.subarray(0, 128));
  realtime.process();

  console.log(
    voiceCharacterPresetId(1),
    realtimeVoiceChangerPresetNames(),
    realtimeVoiceChangerPresetConfig('bright-idol'),
    out,
    realtime.output,
  );
} finally {
  changer.delete();
}
```

組み込みプリセットの内容確認には `realtimeVoiceChangerPresetJson(name)` を使います。

ユーザー作成プリセット JSON を受け入れる前には、`validateRealtimeVoiceChangerPresetJson(json)` で検証してください。`RealtimeVoiceChangerConfigInput` は、6 種類の厳密な `VoicePresetId` 文字列、または `dsp` と `macros` のどちらか一方だけを持つプリセットオブジェクトを受け取ります。`voiceCharacterPresetId(...)` は未知の数値序数で `null` を返し、未知の文字列 ID では例外になります。`realtimeVoiceChangerPresetConfig(...)` は解決できないプリセットで例外になります。

正規 ID や解決済みのフラット POD 設定だけが必要な場合は、`voiceCharacterPresetId(...)` と `realtimeVoiceChangerPresetConfig(...)` を使います。

ヒープ上のバッファは WASM ヒープへのビューです。`prepare(...)` がネイティブのスクラッチバッファを置き換える可能性があるたびに `bufferGeneration()` が増えるので、値が変わったらキャッシュしたビューを取り直してください。

### AudioWorklet 内で使う

パッケージには出来合いのプロセッサが付属しているため、worklet でボイスチェンジャーを動かすのに独自のループは要りません。worklet モジュールで登録し、`processorOptions` を付けてノードを作ります。

```typescript
// voice-worklet.ts
import { registerSonareRealtimeVoiceChangerWorkletProcessor } from '@libraz/libsonare/worklet';

registerSonareRealtimeVoiceChangerWorkletProcessor(); // 'sonare-realtime-voice-changer-processor'
```

```typescript
// main.ts
const node = new AudioWorkletNode(audioCtx, 'sonare-realtime-voice-changer-processor', {
  processorOptions: { preset: 'bright-idol', sampleRate: audioCtx.sampleRate, blockSize: 128, channelCount: 1 },
});

// 声をライブで切り替える。worklet が受け付けるのは正規化済みのフラット設定だけで、JSON は受け付けない
node.port.postMessage({ type: 'setConfig', config: realtimeVoiceChangerPresetConfig('soft-whisper') });
node.port.postMessage({ type: 'reset' });   // DSP 状態をクリアする
node.port.postMessage({ type: 'destroy' }); // ボイスチェンジャーを解放する
```

プロセッサは worklet 自身の realm でボイスチェンジャーを作るので、先にそこで WASM モジュールを初期化しておく必要があります。手順は[独自の analyzer worklet](#独自の-analyzer-worklet)と同じです。フラット設定には `formantMode` が含まれるため、手書きせず `realtimeVoiceChangerPresetConfig(...)` で作ってください。

## クリップ音声のページストリーミング

長いアレンジは、一度にメモリへ載せきれないほどのクリップ音声を持つことがあります。エンジンはクリップ音声を**ページ**単位でストリーミングします。1 つの巨大なバッファの代わりに、クリップの音声は*クリップページプロバイダ*が受け持ち、必要に応じて固定サイズのページをエンジンへ渡します。

この流れは設計上ロックフリーです。

1. レンダースレッドがまだ持っていないページを必要とし、**ウェイトフリーのページ要求キュー**へ要求を積みます。
2. メインスレッドが `engine.popClipPageRequest()` でそのキューから取り出し、要求されたページの音声をストレージから読み、`provider.supply(pageIndex, channels)` を呼びます。
3. 不要になったページは `provider.clear(pageIndex)` で解放します。
4. これとは別に、レンダースレッドはこれから読もうとしていてまだ手元にないページも報告するため、ホストは再生位置が到達する前に供給できます。後述の [先読み](#先読み) を参照してください。

音声スレッドは要求を積むことと、すでに読み込まれたページを読むことしか行わないため、ストレージやアロケーションでブロックしません。

<FlowDiagram
  title="ロックフリーなクリップページの受け渡し"
  direction="TB"
  :nodes="[
    { id: 'need', label: 'レンダースレッドがページ N を要求', col: 0, row: 0, variant: 'accent', group: 'audio' },
    { id: 'push', label: 'ウェイトフリーキューへ要求を積む', col: 0, row: 1, variant: 'accent', group: 'audio' },
    { id: 'pop', label: 'popClipPageRequest() でキューから取り出す', col: 1, row: 2, group: 'main' },
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

### 先読み

読み出しが済んでからミスを報告したのでは、無音を避けるには遅すぎます。そのブロックの読み出しはすでに無音を出力しており、ホストが知るのはその後だからです。あらかじめ用意していないページ境界のたびに、1 ブロック分の無音が生じます。そこでプレイヤーは、これから到達するページも報告します。

`prepare(...)` は先読みウィンドウをエンジンのサンプルレートで **0.5 秒** に設定し、`setClipPagePrefetchFrames(frames)` で音声の再生中にも変更できます（`clipPagePrefetchFrames()` で読み戻し、`0` で先読みを完全に無効化）。C の入口は `sonare_engine_set_clip_page_prefetch_frames` と `sonare_engine_clip_page_prefetch_frames` で、`SonareEngine` worklet ファサードはセッターを worklet 側エンジンとこのスレッドのオフラインエンジンの両方へ転送します。

先読みの要求も同じ `popClipPageRequest()` のキューから取り出され、1 ブロックの中ではそのブロックの本当のミスの **後ろ** に積まれます。したがってクリップごとに最新の要求だけを保持するホストは、古いミスではなく先読みの先端を追いかけることになります。前述の「読んでからミスを報告する」経路はそのまま動き続けるので、先読みの要求を無視するホストは先読みが無い場合とまったく同じように振る舞います。ページがすべて常駐しているクリップは、どちらの場合も要求をまったく生みません。

::: info `ClipPageStreamer` のウィンドウとは別ものです
2 つの異なる仕組みが重なっており、どちらも必要です。ここでの先読みは **エンジン側** のもので、オーディオスレッドがこれから向かうページを教えてくれる機構です。`ClipPageStreamer` の `readAheadPages` / `retainBehindPages`（後述）は **JS 側** のスライディングウィンドウで、WASM メモリにどれだけの音声を常駐させておくかを決めます。エンジンの先読みがストリーマに何を取りに行くかを伝え、ストリーマのウィンドウが何を保持しておくかを決めます。
:::

### ブラウザの OPFS バックエンドプロバイダ

パッケージには、[Origin Private File System（OPFS）](https://developer.mozilla.org/docs/Web/API/File_System_API/Origin_private_file_system) からワーカー上でページを読む既製プロバイダが同梱されており、ディスク読み取りをメインスレッドの外に保ちます。クリップは生のインターリーブ `Float32`（`L0, R0, L1, R1, …`）として OPFS に置き、ヘッダーがあれば `dataOffsetBytes` で読み飛ばします。WASM メモリに載るのは、現在のウィンドウに入るページだけです。

この仕組みは 4 つのエクスポートで構成され、それぞれが 1 つ上の段を土台にしています。

| エクスポート | 何か |
|--------------|------|
| `opfsClipPageWorkerSource` | 関数ではなく JavaScript の**文字列**で、ページを読むワーカーのソーステキストです。ページインデックスを受け取ると、同期アクセスハンドルでファイルを開き、`dataOffsetBytes + pageIndex * pageFrames * numChannels * 4` から `pageFrames` フレームを読み、チャンネルごとのバッファにデインターリーブして、転送リスト付きで送り返します。同じ `path` への読み取りはワーカー内で直列化されます。使うのは、`blob:` ワーカーを禁じる CSP の下など、ワーカーを自前でバンドルするときだけです。 |
| `createOpfsClipPageWorker()` | そのソースの Blob URL から `new Worker(...)` を作り、生成直後に URL を破棄します。`worker` を渡さなければ内部で呼ばれます。 |
| `createOpfsClipPageProvider(engine, options)` | エンジン側の `ClipPageProvider`（`engine.createClipPageProvider(numChannels, numSamples, pageFrames)`）を作り、ワーカーと組み合わせます。返るのはバインディングで、`provider`、`supplyPage(pageIndex)`、`supplyRequest(request)`、`clearPage(pageIndex)`、`close()` を持ちます。`numChannels`、`numSamples`、`pageFrames` のいずれかが正でなければ例外になります。 |
| `writeOpfsClip(path, channels, options?)` | プレーナーな `Float32Array` のチャンネルを、リーダーが期待するレイアウト（ヘッダーなし、リトルエンディアン float32、インターリーブ、先頭バイトから）で `path` に書きます。存在しないディレクトリは作成され、既存のファイルは置き換えられます。書き込みは OPFS ワーカー（`options.worker`、なければ内部のもの）で実行されます。`{ path, numChannels, numSamples }` で解決します。ファイルにこれらは保存されないので、読み出し時に渡し直してください。開いているページプロバイダが読んでいるパスは `SonareError` の `InvalidState` で拒否され、空のチャンネル配列や長さの揃わないチャンネルは `RangeError` です。 |
| `importOpfsClip(path, source, options?)` | `ArrayBuffer`、`Blob`、`AudioBuffer` をデコードして（全チャンネルを保持）`writeOpfsClip` で書きます。リサンプルはしません。結果にはソースの `sampleRate` が加わるので、これをクリップのソースレートとして渡してください。 |
| `attachOpfsClipStream(streamer, engine, options)` | セッション向けの一括の入口です。バインディングを作り、先頭 `primePages` ページ（既定 `1`）をプライムして再生開始直後のミスを防ぎ、クリップを `ClipPageStreamer` に登録します。`{ binding, provider }` を返します。 |

クリップ 1 本を手作業で処理する例です。

```typescript
import { createOpfsClipPageProvider } from '@libraz/libsonare';

const binding = createOpfsClipPageProvider(engine, {
  path: 'clips/long-take.f32',  // OPFS 上のインターリーブ Float32
  numChannels: 2,
  numSamples: totalFrames,      // ファイルの総フレーム数
  pageFrames: 65536,            // フレーム単位のページサイズ
  // dataOffsetBytes?: ヘッダーをスキップ
  // worker?: 自前の Worker を再利用。terminateWorkerOnClose: true を
  //          付けない限り close() 後も動き続ける
});

// UI tick で、レンダースレッドが要求した分を処理する:
let request;
while ((request = engine.popClipPageRequest()) !== null) {
  await binding.supplyRequest(request);  // 該当ページを読み込んでプロバイダへ渡す
}

// 後始末:
binding.close();  // プロバイダを解放し、所有していればワーカーも終了
```

`supplyRequest(request)` は取り出した要求のサンプル位置をページインデックス（`Math.floor(request.sample / pageFrames)`）へ写像し、`supplyPage(pageIndex)` はページを直接プリフェッチします。どちらもページが常駐した時点で `true`、ファイル範囲外のページや途中で終わった読み取りでは `false` に解決し、`close()` 後は reject されます。1 つのバインディングを通る供給は呼び出し順に 1 件ずつ実行されます。各バインディングは自分の要求 id にしか応答しないので、1 つの `Worker` を複数のバインディングで共有できます。

#### SharedArrayBuffer が要る場所と要らない場所

ページの**データ**に `SharedArrayBuffer` は要りません。ワーカーは各ページを転送済みの `ArrayBuffer` として渡すため、所有権はコピーなしにメインスレッドへ移り、`provider.supply(...)` がそのチャンネルを WASM メモリへコピーします。worklet ファサードでは、メインスレッドが同じバッファをもう一度転送して `AudioWorklet` へ送ります。

**要求**の向きも不要です。ページミスはレンダースレッドで発生します。`'sab'` モードでは、ファサードが 8 ms ごとにポーリングする共有の要求リングを通ってメインスレッドへ届きます。`postMessage` モードでは、worklet が確保なしでページミスを読み取り、ミスしているページの集合が変わるたびに要求を送ります。集合が変わらない間も 250 ms ごとに再送するので、読み取りに失敗しても再試行されます。`capabilities.clipPageRequestsRealtimeSafe` はリングを使っているかどうかを示します。`SonareEngine.attachOpfsClipStream(options)` はどちらでも動作するため、このサイトのように cross-origin isolation のないページでも、OPFS から worklet エンジンへクリップをページングできます。

ファサードでの呼び出しは `attachOpfsClipStream(engine, options)` の 2 引数で、ストリーマーは渡しません。ファサードが自前の `ClipPageStreamer` を持ち、要求リングからポンプします。返った `provider` は `engine.addClip(trackId, provider, startPpq, { id: clipId })` に渡し、`opts.id` を `options.clipId` と一致させます。この経路で作られていない `pageProvider` はファサードが拒否します。

::: warning OPFS 対応はブラウザによって異なる
OPFS プロバイダは `navigator.storage.getDirectory()` と同期アクセスハンドルに依存します。これらは現行の Chromium・Firefox と最近の Safari の WebKit では利用できますが、古いブラウザでは使えません。利用前に機能検出し、OPFS が無い環境向けにメモリだけで動くプロバイダ（または任意のソースから読み込む自前の `ClipPageProvider`）を用意してください。
:::

### 複数クリップの範囲限定ストリーミング

上のループは 1 つのプロバイダを手作業で処理します。マルチトラックのアレンジでは、クリップが何本あっても、どれだけ長くても、常駐する音声を一定量に抑えたいはずです。`ClipPageStreamer` がそれを担います。各クリップの再生位置の周りにページのスライディングウィンドウ（クリップあたり `retainBehindPages + readAheadPages + 1` ページ）だけを保持し、ミスを先読みで取得し、後方に外れたページを破棄するため、セッション全体で PCM 全体を WASM メモリに抱えることがありません。

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

// 制御スレッドのペースでミスを取り出す（アニメーションフレームごとが一般的）:
function tick() {
  streamer.pump();              // 不足ページ＋先読みを取得し、ウィンドウ外を破棄
  requestAnimationFrame(tick);
}

// 破棄すると、接続済みの全クリップのバインディングを閉じる:
streamer.close();
```

`pump()` はメイン／制御スレッドでのみ呼びます。取得は非同期なので、オーディオスレッドでは決して呼ばないでください。自前でプロバイダを作ったクリップの着脱には `addSource` / `removeSource` を使います。明示的なシークやループの後は `resetSource(clipId)` を呼び、古い再生ウィンドウを破棄して新しい取得世代を開始します。後方ページへのミスでもこのリセットは自動的に行われ、シーク前の処理中フェッチが後から常駐するのを防ぎます。

