---
title: JavaScript/TypeScript ストリーミング／リアルタイム API
description: libsonare JavaScript/TypeScript パッケージのブロック単位 EQ、ピッチリチューン、リアルタイムボイスチェンジャー、ストリーミングマスタリングチェーンのリファレンスです。
---

# JavaScript/TypeScript ストリーミング／リアルタイム API

libsonare JavaScript/TypeScript パッケージのブロック単位プロセッサ（`StreamingEqualizer`、`StreamingRetune`、`RealtimeVoiceChanger` とその一括適用版 `voiceChangeRealtime(...)`、`StreamingMasteringChain`）です。オフラインチェーン、プリセット、単発プロセッサについては [マスタリング API](./js-api-mastering.md) を参照してください。

## StreamingEqualizer

`StreamingEqualizer` は、ブロック単位で動かすリアルタイム安全な EQ オブジェクトです。

最大 24 バンド、`zero-latency` / `natural` / `linear` の位相モード、ダイナミック EQ、ミッド／サイド処理、外部サイドチェイン、スペクトルスナップショット、オフラインのリファレンスマッチを扱えます。

WASM 版では先に `init()` を呼び、使い終わったら `delete()` で解放します。

```typescript
import { init, StreamingEqualizer } from '@libraz/libsonare';
await init();

const eq = new StreamingEqualizer({ sampleRate: 48000, maxBlockSize: 512 });
try {
  eq.setBand(0, {
    type: 'HighShelf',
    frequencyHz: 8000,
    gainDb: 4,
    q: 0.7,
    enabled: true,
  });
  eq.setPhaseMode(1); // 1 = zero-latency, 2 = natural, 3 = linear
  eq.setAutoGain(true);

  const { left, right } = eq.processStereo(leftBlock, rightBlock);
  console.log(eq.spectrum(), eq.latencySamples(), left, right);
} finally {
  eq.delete();
}
```

ファイル単位の EQ / フィルタ処理に対応するソースビルド C++ CLI 例:

```bash [C++ CLI]
sonare eq track.wav --type 2 --frequency-hz 8000 --gain-db 4 --q 0.7 -o eq.wav
sonare filter track.wav --type hp --cutoff 80 -o filtered.wav
```

## StreamingRetune

`StreamingRetune` は、ブロック単位で動かすモノラルのピッチリチューン用オブジェクトです。グレインとディレイの状態を呼び出し間で保持するため、最初のブロック前に `prepare()`、使い終わったら `delete()` を呼びます。

```typescript
import { init, StreamingRetune } from '@libraz/libsonare';
await init();

const retune = new StreamingRetune({ semitones: 3, mix: 1, grainSize: 0 });
retune.prepare(48000, 512);

try {
  const out = retune.processMono(inputBlock);
  retune.setConfig({ semitones: -2, mix: 0.75 });
  console.log(out, retune.config(), retune.grainSize());
} finally {
  retune.delete();
}
```

ソースビルド C++ CLI でのオフラインファイル処理に近いコマンド:

```bash [C++ CLI]
sonare pitch-shift vocal.wav --semitones 3 -o shifted.wav
sonare voice-change vocal.wav --pitch-semitones 3 --formant-factor 1.0 -o voice.wav
```

## RealtimeVoiceChanger

`RealtimeVoiceChanger` はプリセットで動かすライブ音声チェーン（ハイパス、ゲート、リチューン、フォルマント、EQ、コンプレッサー、ディエッサー、リバーブ、リミッターの各段）で、音声ブロックをまたいで状態を保持します。モニタリング、AudioWorklet 形式の処理、または `voiceChange(...)` では単純すぎるチャンク単位の音声処理で使います。標準プリセット ID は `realtimeVoiceChangerPresetNames()` で取得し、プリセット JSON は `realtimeVoiceChangerPresetJson(...)` で取得、`validateRealtimeVoiceChangerPresetJson(...)` で検証できます（スキーマバージョン `1`）。`RealtimeVoiceChangerConfigInput` は厳密な型で、6 種類の `VoicePresetId` 文字列、または `dsp` と `macros` のどちらか一方だけを持つプリセットオブジェクトを指定します。

```typescript
import { init, RealtimeVoiceChanger, realtimeVoiceChangerPresetNames } from '@libraz/libsonare';
await init();

const changer = new RealtimeVoiceChanger(realtimeVoiceChangerPresetNames()[1]); // 例: "bright-idol"
changer.prepare(48000, /*maxBlockSize=*/128, /*channels=*/1);
try {
  const out = changer.processMono(inputBlock);
  const realtime = changer.createRealtimeMonoBuffer(128); // ゼロコピーの WASM ヒープビュー
  realtime.input.set(inputBlock.subarray(0, 128));
  realtime.process();
  console.log(out, realtime.output, changer.latencySamples());
} finally {
  changer.delete();
}
```

ゼロコピーバッファヘルパー（`createRealtimeMonoBuffer`、`createRealtimeInterleavedBuffer`、`createRealtimePlanarBuffer`）は changer が所有する WASM ヒープのビューを返します。リアルタイムループ内で再利用し、`delete()` 後は破棄してください。プリセット一覧とチェーン各段は [リアルタイムボイスチェンジャー](./realtime-voice-changer.md) を参照してください。

## `voiceChangeRealtime(samples, sampleRate?, preset?, options?)`

`voiceChangeRealtime(...)` は `RealtimeVoiceChanger` をバッファ全体に対してオフラインで一括適用する便利関数です。内部で changer を構築・準備し、ブロック単位のレンダリングループを実行したうえで破棄します（Python の `voice_change_realtime` や Node の同等関数と同じ考え方です）。そのため、呼び出し側が状態を持つオブジェクトを管理する必要はありません。

```typescript
function voiceChangeRealtime(
  samples: Float32Array,
  sampleRate?: number, // デフォルト 48000
  preset?: RealtimeVoiceChangerConfigInput,
  options?: {
    channels?: 1 | 2;   // デフォルト 1（モノラル）。2 = インターリーブステレオ (L0,R0,L1,R1,...)
    /** @deprecated Ignored — the shared C-ABI renderer uses a fixed block size. */
    blockSize?: number;
  },
): Float32Array  // 入力と同じレイアウト・長さ
```

バッファ全体が手元にある場合はこれを使います。ブロック単位のライブ処理を手動で行う場合は [`RealtimeVoiceChanger`](#realtimevoicechanger) を、フルのプリセットチェーンが不要で一度きりのピッチ／フォルマント変更だけが必要な場合は `voiceChange(...)` を使ってください。

## StreamingMasteringChain

リアルタイム処理やメモリ制約のあるユースケース（`AudioWorklet` やストリーム
入力からのブロック単位処理など）向けに、WASM モジュールは
`StreamingMasteringChain` を公開しています。受け取るのは `StreamingMasteringChainConfig` で、これは `masteringChain()` の `MasteringChainConfig` に、ストリーミング専用の任意フィールドを 2 つ追加したものです。

- `loudnessStaticGainDb` — 事前計算した静的ラウドネスゲイン（dB、例: `targetLufs - measuredIntegratedLufs`）。ブロックごとに適用され、`loudness` ステージを有効にしたプリセットのストリーミングプレビューがオフラインレンダリングと一致するようにします。
- `loudnessStaticGainPeakDb` — オフラインで計測した音源の True Peak（dBFS）。指定すると静的ゲインが `loudness.ceilingDb - loudnessStaticGainPeakDb` にクランプされ、ストリーミングのリミッターへオフラインチェーンより大きい入力が入らないようにします。

それ以外は、固定ブロックサイズで内部状態を準備したうえで、入力ブロックに対してチェーンを順番に適用します。

```typescript
import { init, StreamingMasteringChain } from '@libraz/libsonare';
await init();

const chain = new StreamingMasteringChain({
  eq: { tilt: { tiltDb: 0.5 } },
  dynamics: { compressor: { thresholdDb: -20 } },
  maximizer: { truePeakLimiter: { ceilingDb: -1, oversampleFactor: 4 } },
});

chain.prepare(48000, /*maxBlockSize=*/512, /*numChannels=*/2);

// Use the path that matches the prepared channel count: processMono() /
// flushMono() after prepare(..., 1), processStereo() / flushStereo() after
// prepare(..., 2). Mixing them throws a num_channels mismatch.
const { left, right } = chain.processStereo(leftBlock, rightBlock);

console.log(chain.stageNames());      // ['eq.tilt', 'dynamics.compressor', ...]
console.log(chain.latencySamples());  // 有効ステージの合計レイテンシ

// 入力の最終ブロックのあと、チェーンの遅延と有限のテールを吐き出す
let tail: { left: Float32Array; right: Float32Array };
while ((tail = chain.flushStereo()).left.length > 0) {
  write(tail.left, tail.right);
}

chain.reset();   // prepare し直さずに状態だけクリア
chain.delete();  // WASM ハンドルを解放（使い終わったら呼ぶ）
```

`flushMono()` / `flushStereo()` は、入力がもうない状態で遅延分の音声と有限のプロセッサ
テールを吐き出します。空の結果が返るまで呼び続けてください。フラッシュしないと、
ストリーミングチェーンで作ったバウンスは末尾の `latencySamples()` サンプルと、
リバーブやリミッターのテールを失います。連結したストリームの先頭 `latencySamples()`
サンプルはチェーンの遅延なので、時間を揃えるには捨ててください。

`numChannels === 1` のときはステレオ専用ステージはスキップされます。チェーン設定のリペアステージ（`repair.declick`／`repair.dereverb`／`repair.denoise`／`repair.declip`／`repair.decrackle`／`repair.dehum`）はオフライン専用で、streaming constructor で有効にすると例外を投げます。`masteringChain*` / `masterAudio*`、または単発の `masteringRepair*` ヘルパーで実行してください。`loudness` ステージも、ストリーミングチェーンが信号全体の積分 LUFS を計測できないため、`loudnessStaticGainDb`（任意で `loudnessStaticGainPeakDb` も）を指定しない限り例外を投げます。同じチェーンで複数曲を順に処理する場合は `reset()`、使い終わったら `delete()` を呼んでハンドルを解放してください。
