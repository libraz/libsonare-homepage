---
title: WASM の応用的な使い方
description: libsonare WASM パッケージのブラウザ向け応用的な使い方。組み込みの Web Worker クライアント、自前 worker のパターン、パフォーマンスチューニング、React の例を扱います。
---

# WASM の応用的な使い方

このページでは、ブラウザアプリ向けの WASM の応用的な使い方 — 組み込みの Web Worker クライアント、パフォーマンスチューニング、React の例 — を扱います。基本は [WebAssembly ガイド](./wasm.md) を参照してください。

## Web Worker の使用

パッケージには Worker クライアントが同梱されているため、よくある用途では自前の
worker ファイルは不要です。`OfflineWorkerClient` はメインエントリ `@libraz/libsonare`
からインポートします（`/worker` サブパスは Worker 側のエントリで、
`installOfflineWorkerEndpoint` を公開しています）。

```typescript
import { OfflineWorkerClient } from '@libraz/libsonare';

const client = new OfflineWorkerClient();

const task = client.analyze(
  { samples, sampleRate },
  { onProgress: ({ progress, stage }) => updateUi(progress, stage) },
);

cancelButton.onclick = () => task.cancel();

const result = await task;   // task は thenable です
client.dispose();
```

利用できるのは `analyze`・`detectBpm`・`detectKey`・`detectChords`・`masterAudio`・
`masterAudioStereo` です。いずれも `OfflineWorkerTask` を返し、await できるほか
`cancel()` を持ちます。

::: warning 入力はコピーではなく転送されます
`Float32Array` の入力は既定で Worker へ転送されるため、呼び出し側のバッファは切り離され、
あとから読むと空の配列になります。波形描画などでサンプルを引き続き使う場合は
`{ copy: true }` を渡してください。すでに実行中のネイティブ呼び出しを即座にキャンセルするには
cross-origin isolation が必要です（クライアントは `SharedArrayBuffer` のフラグを使います）。
なくてもキャンセル自体は効きますが、次のタスク境界まで待つことになります。
:::

`Project`・`Mixer`・リアルタイム系のクラスは、意図的にクライアントから外しています。
これらのネイティブハンドルは 1 つの JavaScript レルムに属しており、スレッドをまたいで
移動できないためです。

### 自前の worker を書く

クライアントが公開していない処理が必要な場合は、従来どおりのパターンが使えます。
自分の worker の中でメインエントリをインポートしてください。

**worker.ts:**

```typescript
import { init, analyze, AnalysisResult } from '@libraz/libsonare';

let initialized = false;

self.onmessage = async (e: MessageEvent) => {
  const { samples, sampleRate } = e.data;

  if (!initialized) {
    await init();
    initialized = true;
  }

  try {
    const result = analyze(samples, sampleRate);
    self.postMessage({ success: true, result });
  } catch (error) {
    self.postMessage({ success: false, error: error.message });
  }
};
```

**main.ts:**

```typescript
const worker = new Worker(new URL('./worker.ts', import.meta.url), {
  type: 'module'
});

function analyzeInWorker(
  samples: Float32Array,
  sampleRate: number
): Promise<AnalysisResult> {
  return new Promise((resolve, reject) => {
    worker.onmessage = (e) => {
      if (e.data.success) {
        resolve(e.data.result);
      } else {
        reject(new Error(e.data.error));
      }
    };
    worker.postMessage({ samples, sampleRate });
  });
}
```

## パフォーマンスのヒント

### ダウンサンプリング

BPM 検出には 22050 Hz で十分です:

```typescript
import { resample, detectBpm } from '@libraz/libsonare';

// 高速解析のためにダウンサンプル
const downsampled = resample(samples, 48000, 22050);
const bpm = detectBpm(downsampled, 22050);
```

### セグメント解析

長いファイルの場合、関連するセクションのみを解析:

```typescript
function analyzeSegment(
  samples: Float32Array,
  sampleRate: number,
  startSec: number,
  endSec: number
) {
  const start = Math.floor(startSec * sampleRate);
  const end = Math.floor(endSec * sampleRate);
  const segment = samples.slice(start, end);

  return analyze(segment, sampleRate);
}

// サビのみを解析（60-90秒）
const result = analyzeSegment(samples, sampleRate, 60, 90);
```

## React の例

```tsx
import { useState } from 'react';
import { init, analyzeWithProgress, AnalysisResult } from '@libraz/libsonare';

function AudioAnalyzer() {
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    await init();

    const audioCtx = new AudioContext();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const samples = audioBuffer.getChannelData(0);

    const analysisResult = analyzeWithProgress(
      samples,
      audioBuffer.sampleRate,
      (p, s) => {
        setProgress(p);
        setStage(s);
      }
    );

    setResult(analysisResult);
  };

  return (
    <div>
      <input type="file" accept="audio/*" onChange={handleFileChange} />

      {stage && (
        <div>
          <div>{stage}: {Math.round(progress * 100)}%</div>
          <progress value={progress} max={1} />
        </div>
      )}

      {result && (
        <div>
          <p>BPM: {result.bpm.toFixed(1)}</p>
          <p>キー: {result.key.name}</p>
        </div>
      )}
    </div>
  );
}
```

