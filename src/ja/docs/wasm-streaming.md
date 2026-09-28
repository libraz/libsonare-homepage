---
title: WASM のストリーミングとリアルタイム処理
description: libsonare WASM パッケージのストリーミング・リアルタイム API。AudioWorklet と連携するライブの StreamAnalyzer 解析、メル/MFCC からの逆再構成、StreamingRetune、RealtimeVoiceChanger を扱います。
---

# WASM のストリーミングとリアルタイム処理

このページでは、WASM のストリーミング・リアルタイム API — ライブのストリーミング解析、逆再構成、Streaming Retune、リアルタイムボイスチェンジャー — を扱います。基本は [WebAssembly ガイド](./wasm.md) を参照してください。

## ストリーミング解析

ストリーミング API は低レイテンシでリアルタイム音声解析を実現します。バッチ解析とは異なり、音声が到着するたびにチャンクごとに処理します。

::: info バッチ vs ストリーミング
| アプローチ | 用途 | レイテンシ | 機能 |
|-----------|------|----------|------|
| **バッチ** | 録音済みファイル | 高 | 総合解析（BPM、コード、セクション） |
| **ストリーミング** | ライブ音声、ビジュアライゼーション | 低（〜10ms） | Mel、クロマ、オンセット、更新される BPM/キー |
:::

<SonareDemo id="loudness-meter" />

### アーキテクチャ概要

音声のキャプチャと解析は AudioWorklet スレッドで実行されるため、メインスレッドは描画に専念できます。スレッド境界を `postMessage` で越えるのは、生の音声ではなく、あらかじめ計算済みの小さなフレームバッファだけです。

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

### 基本的な例

::: warning `ScriptProcessorNode` は非推奨 — 本番環境では AudioWorklet を使用
下の最初の例ではフレームの流れを最短で確認できる `createScriptProcessor()` を使っています。`ScriptProcessorNode` は**非推奨**です。メインスレッドで動作するため、負荷がかかるとグリッチが発生する可能性があります。実運用では、この直後にある[AudioWorklet 連携](#audioworklet-連携)を使ってください。アナライザーがメインスレッド外で動作します。
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
    computeMel: true,
    computeChroma: true,
    computeOnset: true,
    emitEveryNFrames: 4, // 4 ホップごとに 1 フレーム出力（44100Hz・hopLength 512 で毎秒約 21 フレーム）
  });

  // シンプルさのため ScriptProcessor を使用（本番では AudioWorklet 推奨）
  const processor = audioCtx.createScriptProcessor(512, 1, 1);

  processor.onaudioprocess = (e) => {
    const input = e.inputBuffer.getChannelData(0);
    analyzer.process(input);

    const available = analyzer.availableFrames();
    if (available > 0) {
      const frames = analyzer.readFrames(available);
      updateVisualization(frames);

      // 音声が届くにつれて更新される BPM/キー推定をチェック
      const stats = analyzer.stats();
      if (stats.estimate.updated) {
        const keyNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const mode = stats.estimate.keyMinor ? 'マイナー' : 'メジャー';
        console.log(`BPM: ${stats.estimate.bpm.toFixed(1)}`);
        // estimate.key は文字列ではなく PitchClass のインデックス（0〜11）
        console.log(`キー: ${keyNames[stats.estimate.key]} ${mode}`);
      }
    }
  };

  source.connect(processor);
  processor.connect(audioCtx.destination);
}
```

### AudioWorklet 連携

本番用途では、解析がメインスレッドをブロックしないよう `StreamAnalyzer` を AudioWorklet（ブラウザの音声処理専用スレッド）内で動かします。下の例は、自己完結型の analyzer worklet です。

::: warning AudioWorklet での WASM 利用
AudioWorklet での WASM ロードには、特別な扱いが必要です。WASM モジュールはワークレットのコンテキスト内でロード・インスタンス化する必要があります。
:::

**analyzer-worklet.ts:**

```typescript
import { init, StreamAnalyzer } from '@libraz/libsonare';

class AnalyzerWorklet extends AudioWorkletProcessor {
  private analyzer?: StreamAnalyzer;
  private frameCounter = 0;

  constructor() {
    super();
    void init().then(() => {
      // sampleRate は AudioWorkletGlobalScope のグローバル
      this.analyzer = new StreamAnalyzer({
        sampleRate,
        nFft: 2048,
        hopLength: 512,
        nMels: 64, // 帯域幅のため削減
        computeMel: true,
        computeChroma: true,
        computeOnset: true,
        emitEveryNFrames: 4,
      });
    });
  }

  process(inputs: Float32Array[][]): boolean {
    const input = inputs[0]?.[0];
    if (!input || input.length === 0 || !this.analyzer) return true;

    this.analyzer.process(input);

    const available = this.analyzer.availableFrames();
    if (available >= 4) {
      const frames = this.analyzer.readFrames(available);

      // ゼロコピー転送
      this.port.postMessage({
        type: 'frames',
        data: frames
      }, [
        frames.timestamps.buffer,
        frames.mel.buffer,
        frames.chroma.buffer
      ]);
    }

    // 定期的に統計情報を送信
    if (++this.frameCounter % 100 === 0) {
      this.port.postMessage({
        type: 'stats',
        data: this.analyzer.stats()
      });
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

const workletNode = new AudioWorkletNode(audioCtx, 'analyzer-worklet');

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
```

::: details 関連するエントリポイント（リアルタイムエンジン、MIDI）
上の例は独自の analyzer worklet を作るものです。トラックレーン、チャンネルストリップ、バス、MIDI クリップ、ライブ MIDI、楽器、キャプチャといった再生エンジン全体を worklet 内で動かしたい場合は、`@libraz/libsonare/worklet` の AudioWorklet ブリッジを使います。ブリッジの `SonareEngine` API がそのエンジンを worklet へミラーします。詳しくは [リアルタイムとストリーミング](./realtime-streaming.md) を参照してください。

メインエントリ（`@libraz/libsonare`）には、メインスレッド用のブラウザ連携ヘルパーが 2 つ同梱されています。`bindMicrophoneInput(...)` は `getUserMedia` を AudioWorklet のエンジンノードへつなぎ（[録音とテイク](./recording-and-takes.md) を参照）、`bindWebMidi(...)` は Web MIDI 入力をエンジンへ橋渡しします（[MIDI 入力](./midi-input.md) を参照）。
:::

### 帯域幅最適化

TypeScript の `StreamAnalyzer` には、3 つの読み出し方法があります。UI に必要な精度と、スレッド間で送れるデータ量に応じて選びます。

| メソッド | 戻り値 | 使う場面 |
|----------|--------|----------|
| `readFrames(maxFrames)` | `Float32Array` / `Int32Array` を持つ `FrameBuffer` | 解析や高品質な可視化でフル精度が必要なとき |
| `readFramesI16(maxFrames)` | `StreamFramesI16` | メーターや一般的な可視化で、転送量を減らしたいとき |
| `readFramesU8(maxFrames)` | `StreamFramesU8` | モバイルや高頻度更新で、転送量をかなり小さくしたいとき |

内部解析は float のままです。転送精度は明示的な読み出しメソッドで選びます。float なら `readFrames()`、16-bit なら `readFramesI16()`、8-bit なら `readFramesU8()` を使ってください。`StreamConfig.outputFormat` はソース互換性のためだけに残っており、省略するか `0` を指定します。C++/WASM の読み出し経路が整数形式を量子化するため、`postMessage` の前に JS 側で量子化する必要はありません。

どちらの量子化読み出し経路も、オプションの `StreamQuantizeConfig` を受け取れます。通常設定では飽和してしまうほど大きい／小さいストリーム向けに量子化レンジを広げられます。[量子化レンジのカスタマイズ](./realtime-streaming.md#量子化レンジのカスタマイズ) を参照してください。

WASM から返るプレーンなリストやオブジェクトは、呼び出し元の JavaScript realm の `Array` / `Object` として返されます。これにより、名前一覧ヘルパー（`*Names()`）、プリセット名ヘルパー、セクション結果、キー候補、`synthPresetPatch(...)` のオブジェクト、ミキサーのメータースナップショット（`meterTap`、`stripMeter`、`busMeter`）、ゴニオメーターのサンプル（`readGoniometerLatest`）は、手作業で作り直さなくても `structuredClone()` や `postMessage()` に渡せます。`Mixer` や `StreamAnalyzer` のようにネイティブメソッドを持つハンドル自体は clone できないため、プレーンな戻り値のデータを渡します。TypedArray のペイロードは、下の通常の transferable buffer ルールに従います。

::: details 「Structure-of-Arrays」と transferable オブジェクトとは？
- **Structure-of-Arrays**（SoA） は、フレームごとのオブジェクトの配列ではなく、各フィールドを独立したフラットな typed array に持つ形式です（タイムスタンプは 1 本、メル値は別の 1 本…）。スライスも別スレッドへの受け渡しも安価になります。
- **transferable オブジェクト** は、`postMessage` がコピーせず*移動*できる `ArrayBuffer` です。所有権が移る（送信側のビューは空になる）ため、音声フレームのスレッド間受け渡しがほぼ瞬時になります。バッファは第 2 引数に列挙します: `postMessage(msg, [buffer, ...])`。
- **量子化** はここでは、各 float をより小さい 16bit / 8bit 整数に詰めることを指します。送るバイト数は減りますが精度は落ちます（メーターやヒートマップには十分、後段の DSP には不向き）。
:::

| アプローチ | フレームあたりサイズ目安 | 用途 |
|------------|--------------------------|------|
| `readFrames()` (Float32 SoA) | 〜600 バイト | 通常用途・フル精度 |
| `readFramesI16()` (量子化 SoA) | 〜300 バイト | 高品質ビジュアライゼーション |
| `readFramesU8()` (量子化 SoA) | 〜150 バイト | モバイル、帯域幅制限環境 |

### 更新される推定

ストリーミング API は時間とともに精度が向上する **BPM/キー推定**を提供します。

```typescript
const stats = analyzer.stats();

// BPM（約 10 秒後に利用可能 — StreamConfig.bpmUpdateIntervalSec 既定値）
if (stats.estimate.bpm > 0) {
  const confidence = stats.estimate.bpmConfidence;
  console.log(`BPM: ${stats.estimate.bpm.toFixed(1)} (${(confidence * 100).toFixed(0)}%)`);
}

// キー（約 5 秒後に利用可能 — StreamConfig.keyUpdateIntervalSec 既定値）
if (stats.estimate.key >= 0) {
  const keyNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const keyName = keyNames[stats.estimate.key];
  const mode = stats.estimate.keyMinor ? 'マイナー' : 'メジャー';
  console.log(`キー: ${keyName} ${mode}`);
}
```

### ビジュアライゼーション例

```typescript
import type { StreamAnalyzer } from '@libraz/libsonare';

function renderVisualization(frames: ReturnType<StreamAnalyzer['readFrames']>, nMels: number) {
  const { nFrames, mel, chroma, onsetStrength } = frames;

  // メルスペクトログラムを描画（スクロール表示）。値は線形パワーなので 0-1 にクランプ／スケールする。
  for (let f = 0; f < nFrames; f++) {
    for (let m = 0; m < nMels; m++) {
      const value = Math.min(1, mel[f * nMels + m]);
      const c = Math.round(value * 255);
      const color = `rgb(${c}, ${Math.round(c * 0.5)}, ${255 - c})`;
      // (scrollX + f, nMels - m) にピクセルを描画
    }
  }

  // クロマ（12 ピッチクラス）を描画
  for (let f = 0; f < nFrames; f++) {
    for (let c = 0; c < 12; c++) {
      const value = chroma[f * 12 + c];
      // クロマバーを描画
    }
  }

  // 強いオンセットでエフェクトをトリガー（線形単位）
  for (let f = 0; f < nFrames; f++) {
    if (onsetStrength[f] > 1.5) { // 素材に合わせて閾値を調整
      triggerBeatEffect();
    }
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
| `melToStft(melPower, nMels, nFrames, sampleRate?, nFft?, fmin?, fmax?, htk?)` | `StftPowerResult` `{ nBins, nFrames, power }` | メルフィルターバンクの擬似逆変換 |
| `melToAudio(melPower, nMels, nFrames, sampleRate?, nFft?, hopLength?, fmin?, fmax?, nIter?, htk?)` | `Float32Array` | Griffin-Lim による音声合成 |
| `mfccToMel(mfccCoefficients, nMfcc, nFrames, nMels?, lifter?)` | `MelPowerResult` `{ nMels, nFrames, power }` | 逆 DCT でメルスペクトログラムへ。順変換で使った lifter を渡す |
| `mfccToAudio(mfccCoefficients, nMfcc, nFrames, nMels, sampleRate?, nFft?, hopLength?, fmin?, fmax?, nIter?, htk?, lifter?)` | `Float32Array` | MFCC → メル → 音声を一度に。順変換で使った lifter を渡す |

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

`RealtimeVoiceChanger` は、プリセット式のライブ音声チェーン用 WASM オブジェクトです。オフラインの `voiceChange(...)` ヘルパーとは別に、ブロック間の DSP 状態を保持します。AudioWorklet 形式のループでコピーを減らせるよう、WASM ヒープ上のゼロコピーバッファも公開します。

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
