import type { ClipPageProvider, ClipPageRequest, RealtimeEngine } from './realtime_engine';
export interface OpfsClipPageProviderOptions {
    path: string;
    numChannels: number;
    numSamples: number;
    pageFrames: number;
    dataOffsetBytes?: number;
    worker?: Worker;
    terminateWorkerOnClose?: boolean;
    /** Internal bridge hook used to mirror a supplied page into an AudioWorklet. */
    onPageSupplied?: (pageIndex: number, channels: Float32Array[]) => void;
    /** Internal bridge hook used to mirror an eviction into an AudioWorklet. */
    onPageCleared?: (pageIndex: number) => void;
    /** Internal bridge hook called after the local provider is destroyed. */
    onClose?: () => void;
}
export interface OpfsClipPageProviderBinding {
    provider: ClipPageProvider;
    supplyPage(pageIndex: number): Promise<boolean>;
    supplyRequest(request: ClipPageRequest): Promise<boolean>;
    /** Evict one resident page from every configured consumer. */
    clearPage?(pageIndex: number): void;
    close(): void;
}
export declare const opfsClipPageWorkerSource = "\nconst sonareClipPageReadQueues = new Map();\n\nfunction sonareEnqueueClipPageRead(key, task) {\n  const previous = sonareClipPageReadQueues.get(key) || Promise.resolve();\n  const next = previous.catch(() => undefined).then(task);\n  const queued = next.finally(() => {\n    if (sonareClipPageReadQueues.get(key) === queued) {\n      sonareClipPageReadQueues.delete(key);\n    }\n  });\n  sonareClipPageReadQueues.set(key, queued);\n  return next;\n}\n\nself.onmessage = async (event) => {\n  const message = event.data;\n  if (!message || message.type !== 'sonare:read-clip-page') return;\n  const { requestId, path, pageIndex, numChannels, numSamples, pageFrames, dataOffsetBytes = 0 } = message;\n  await sonareEnqueueClipPageRead(String(path), async () => {\n  try {\n    if (pageIndex < 0) {\n      self.postMessage({ type: 'sonare:clip-page', requestId, pageIndex, ok: false });\n      return;\n    }\n    const startFrame = pageIndex * pageFrames;\n    if (startFrame >= numSamples) {\n      self.postMessage({ type: 'sonare:clip-page', requestId, pageIndex, ok: false });\n      return;\n    }\n    const root = await self.navigator.storage.getDirectory();\n    let dir = root;\n    const parts = String(path).split('/').filter(Boolean);\n    for (let i = 0; i < parts.length - 1; ++i) {\n      dir = await dir.getDirectoryHandle(parts[i]);\n    }\n    const fileHandle = await dir.getFileHandle(parts[parts.length - 1]);\n    const access = await fileHandle.createSyncAccessHandle();\n    try {\n      const frames = Math.min(pageFrames, numSamples - startFrame);\n      const frameBytes = numChannels * 4;\n      const bytes = new Uint8Array(frames * frameBytes);\n      let bytesReadTotal = 0;\n      const readOffset = dataOffsetBytes + startFrame * frameBytes;\n      while (bytesReadTotal < bytes.byteLength) {\n        const bytesRead = access.read(bytes.subarray(bytesReadTotal), {\n          at: readOffset + bytesReadTotal,\n        });\n        if (bytesRead <= 0) {\n          break;\n        }\n        bytesReadTotal += bytesRead;\n      }\n      if (bytesReadTotal !== bytes.byteLength || bytesReadTotal % frameBytes !== 0) {\n        self.postMessage({ type: 'sonare:clip-page', requestId, pageIndex, ok: false });\n        return;\n      }\n      const framesRead = bytesReadTotal / frameBytes;\n      const view = new DataView(bytes.buffer, 0, framesRead * frameBytes);\n      const channelBuffers = Array.from({ length: numChannels }, () => new ArrayBuffer(framesRead * 4));\n      for (let ch = 0; ch < numChannels; ++ch) {\n        const channel = new Float32Array(channelBuffers[ch]);\n        for (let frame = 0; frame < framesRead; ++frame) {\n          channel[frame] = view.getFloat32((frame * numChannels + ch) * 4, true);\n        }\n      }\n      self.postMessage(\n        { type: 'sonare:clip-page', requestId, pageIndex, ok: true, frames: framesRead, channelBuffers },\n        channelBuffers,\n      );\n    } finally {\n      access.close();\n    }\n  } catch (error) {\n    self.postMessage({\n      type: 'sonare:clip-page',\n      requestId,\n      pageIndex,\n      ok: false,\n      error: error instanceof Error ? error.message : String(error),\n    });\n  }\n  });\n};\n";
export declare function createOpfsClipPageWorker(): Worker;
export declare function createOpfsClipPageProvider(engine: RealtimeEngine, options: OpfsClipPageProviderOptions): OpfsClipPageProviderBinding;
