---
title: WASM の応用的な使い方
description: libsonare WASM パッケージのブラウザ向け応用的な使い方。組み込みの Web Worker クライアント、自前 worker のパターン、パフォーマンスチューニング、React の例を扱います。
---

# WASM の応用的な使い方

このページでは、ブラウザアプリ向けの WASM の応用的な使い方として、組み込みの Web Worker クライアント、パフォーマンスチューニング、React の例を扱います。基本は [WebAssembly ガイド](./wasm.md) を参照してください。

## Web Worker の使用

オフラインの解析やマスタリングは同期処理で、実行したスレッドをブロックします。パッケージには Worker クライアントが同梱されているため、よくある用途では自前の worker ファイルは不要です。`OfflineWorkerClient` はメインエントリ `@libraz/libsonare` からインポートします（`/worker` サブパスは Worker 側のエントリで、`installOfflineWorkerEndpoint` を公開しています）。

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

利用できるのは `analyze`、`detectBpm`、`detectKey`、`detectChords`、`masterAudio`、`masterAudioStereo` です。いずれもメインスレッド側の関数と同じリクエストオブジェクト（`onProgress` を除く）を受け取り、`OfflineWorkerTask` を返します。このタスクは await でき、`cancel()` を持ちます。

### クライアントのオプション

| オプション | 意味 |
|------------|------|
| `worker` | クライアントが作る代わりに、ホストが持つ Worker を再利用する。ブラウザの `Worker` か、Node の `worker_threads` の Worker |
| `workerUrl` | Worker エントリの URL。クライアントモジュールの URL を基準に解決される。既定はクライアントの隣にある公開済みの `worker.js` |
| `workerFactory` | `(url) => worker`。専用 Worker を作る関数で、テストや独自の生成に使う |
| `terminateWorkerOnDispose` | `worker` で渡した Worker を `dispose()` で終了する（クライアントが作った Worker は常に終了される） |

各呼び出しは `{ copy?, onProgress? }` も受け取ります。`copy` は入力配列を保持し（下の警告を参照）、`onProgress` はコアのネイティブな進捗境界で `{ progress, stage }` を受け取ります。

バンドラーがパッケージのファイルを移動したり書き換えたりする場合は、公開済みの `worker.js`（`@libraz/libsonare/worker` の実体）に解決される `workerUrl` を渡してください。

### キャンセルと破棄

`task.cancel()` を呼ぶと、タスクはコード 8（`Cancelled`）の `SonareError` で失敗します。`dispose()` は未完了の処理を失敗させて Worker を解放します。`dispose()` の後に呼び出すと、メッセージ "OfflineWorkerClient was disposed" の `SonareError`（`InvalidState`）を投げます。Worker 内で起きた `TypeError` と `RangeError` は、呼び出し側のスレッドで同じクラスとして復元されます。

::: warning 入力はコピーではなく転送されます
`Float32Array` の入力は既定で Worker へ転送されるため、呼び出し側のバッファは切り離され、あとから読むと空の配列になります。波形描画などでサンプルを引き続き使う場合は `{ copy: true }` を渡してください。すでに実行中のネイティブ呼び出しを即座にキャンセルするには cross-origin isolation が必要です（クライアントは `SharedArrayBuffer` のフラグを使います）。なくてもキャンセル自体は効きますが、次のタスク境界まで待つことになります。
:::

`Project`、`Mixer`、リアルタイム系のクラスは、意図的にクライアントから外しています。これらのネイティブハンドルは 1 つの JavaScript レルムに属しており、スレッドをまたいで移動できないためです。ボーカル編集のドラフトとレンダリングジョブには、同等の `VocalEditWorkerClient`（`@libraz/libsonare/vocal-edit-worker` の背後）があります。

### 自前の worker を書く

クライアントが公開していない処理が必要な場合は、従来どおりのパターンが使えます。自分の worker の中でメインエントリをインポートしてください。

**worker.ts:**

```typescript
import { init, analyze } from '@libraz/libsonare';

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
import type { AnalysisResult } from '@libraz/libsonare';

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

解析を Worker クライアント経由で実行すると、ネイティブ呼び出しの実行中もページの描画が止まりません。クライアントは effect の中で作り、アンマウント時に破棄します。

```tsx
import { useEffect, useRef, useState } from 'react';
import { OfflineWorkerClient, type AnalysisResult } from '@libraz/libsonare';

function AudioAnalyzer() {
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const client = useRef<OfflineWorkerClient | null>(null);
  const task = useRef<ReturnType<OfflineWorkerClient['analyze']> | null>(null);

  useEffect(() => {
    client.current = new OfflineWorkerClient();
    return () => client.current?.dispose();
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !client.current) return;

    const audioCtx = new AudioContext();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const samples = audioBuffer.getChannelData(0);

    task.current = client.current.analyze(
      { samples, sampleRate: audioBuffer.sampleRate },
      { onProgress: (p) => { setProgress(p.progress); setStage(p.stage); } },
    );
    setResult(await task.current);
  };

  return (
    <div>
      <input type="file" accept="audio/*" onChange={handleFileChange} />

      {stage && (
        <div>
          <div>{stage}: {Math.round(progress * 100)}%</div>
          <progress value={progress} max={1} />
          <button onClick={() => task.current?.cancel()}>キャンセル</button>
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

キャンセルされたタスクは、コード 8（`Cancelled`）の `SonareError` で失敗します。キャンセルを通常の結果として扱うなら、`await task.current` を try/catch で囲んでください。
