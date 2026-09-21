---
title: WASM Advanced Usage
description: Advanced browser integration for the libsonare WASM package — the built-in Web Worker client, hand-written worker patterns, performance tuning, and a React example.
---

# WASM Advanced Usage

This page covers advanced WASM integration for browser apps — the built-in Web Worker client, performance tuning, and a React example — continuing from [WebAssembly Guide](./wasm.md).

## Web Worker Usage

The package ships a Worker client, so the common case needs no worker file of
your own. Import `OfflineWorkerClient` from the main entry point `@libraz/libsonare`
(the `/worker` subpath is the worker-side entry, and exports `installOfflineWorkerEndpoint`):

```typescript
import { OfflineWorkerClient } from '@libraz/libsonare';

const client = new OfflineWorkerClient();

const task = client.analyze(
  { samples, sampleRate },
  { onProgress: ({ progress, stage }) => updateUi(progress, stage) },
);

cancelButton.onclick = () => task.cancel();

const result = await task;   // the task is thenable
client.dispose();
```

`analyze`, `detectBpm`, `detectKey`, `detectChords`, `masterAudio`, and
`masterAudioStereo` are available. Each returns an `OfflineWorkerTask`, which is
awaitable and carries `cancel()`.

::: warning Inputs are transferred, not copied
`Float32Array` inputs are transferred to the Worker by default, so the buffer
becomes detached on the calling thread and reading it afterwards yields an empty
array. Pass `{ copy: true }` when you still need the samples — for drawing a
waveform, say. Prompt cancellation of an already-running native call needs
cross-origin isolation (the client uses a `SharedArrayBuffer` flag); without it,
cancellation still lands, at the next task boundary.
:::

`Project`, `Mixer`, and the realtime classes are deliberately absent from the
client: their native handles belong to one JavaScript realm and cannot be moved
across threads.

### Writing your own worker

If you need an operation the client does not expose, the ordinary pattern still
works — import the main entry inside a worker of your own.

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

## Performance Tips

### Downsampling

For BPM detection, 22050 Hz is sufficient:

```typescript
import { resample, detectBpm } from '@libraz/libsonare';

// Downsample for faster analysis
const downsampled = resample(samples, 48000, 22050);
const bpm = detectBpm(downsampled, 22050);
```

### Analyze Segments

For long files, analyze only relevant sections:

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

// Analyze only chorus (60-90 seconds)
const result = analyzeSegment(samples, sampleRate, 60, 90);
```

## React Example

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
          <p>Key: {result.key.name}</p>
        </div>
      )}
    </div>
  );
}
```

