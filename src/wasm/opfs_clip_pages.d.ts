import type { ClipPageProvider, ClipPageRequest, RealtimeEngine } from './realtime_engine.js';
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
export declare const opfsClipPageWorkerSource = "\nconst sonareClipPageReadQueues = new Map();\n\nfunction sonareEnqueueClipPageRead(key, task) {\n  const previous = sonareClipPageReadQueues.get(key) || Promise.resolve();\n  const next = previous.catch(() => undefined).then(task);\n  const queued = next.finally(() => {\n    if (sonareClipPageReadQueues.get(key) === queued) {\n      sonareClipPageReadQueues.delete(key);\n    }\n  });\n  sonareClipPageReadQueues.set(key, queued);\n  return next;\n}\n\nasync function sonareOpenClipFile(path, create) {\n  const root = await self.navigator.storage.getDirectory();\n  let dir = root;\n  const parts = String(path).split('/').filter(Boolean);\n  for (let i = 0; i < parts.length - 1; ++i) {\n    dir = await dir.getDirectoryHandle(parts[i], { create });\n  }\n  return dir.getFileHandle(parts[parts.length - 1], { create });\n}\n\nasync function sonareWriteClipChunk(message) {\n  const { requestId, path, at, bytes, first } = message;\n  try {\n    const fileHandle = await sonareOpenClipFile(path, true);\n    const access = await fileHandle.createSyncAccessHandle();\n    try {\n      if (first) {\n        access.truncate(0);\n      }\n      const view = new Uint8Array(bytes);\n      let written = 0;\n      while (written < view.byteLength) {\n        const n = access.write(view.subarray(written), { at: at + written });\n        if (n <= 0) {\n          throw new Error('short write');\n        }\n        written += n;\n      }\n      access.flush();\n    } finally {\n      access.close();\n    }\n    self.postMessage({ type: 'sonare:write-clip-result', requestId, ok: true });\n  } catch (error) {\n    self.postMessage({\n      type: 'sonare:write-clip-result',\n      requestId,\n      ok: false,\n      busy: !!error && error.name === 'NoModificationAllowedError',\n      error: error instanceof Error ? error.message : String(error),\n    });\n  }\n}\n\nself.onmessage = async (event) => {\n  const message = event.data;\n  if (message && message.type === 'sonare:write-clip') {\n    await sonareEnqueueClipPageRead(String(message.path), () => sonareWriteClipChunk(message));\n    return;\n  }\n  if (!message || message.type !== 'sonare:read-clip-page') return;\n  const { requestId, path, pageIndex, numChannels, numSamples, pageFrames, dataOffsetBytes = 0 } = message;\n  await sonareEnqueueClipPageRead(String(path), async () => {\n  try {\n    if (pageIndex < 0) {\n      self.postMessage({ type: 'sonare:clip-page', requestId, pageIndex, ok: false });\n      return;\n    }\n    const startFrame = pageIndex * pageFrames;\n    if (startFrame >= numSamples) {\n      self.postMessage({ type: 'sonare:clip-page', requestId, pageIndex, ok: false });\n      return;\n    }\n    const root = await self.navigator.storage.getDirectory();\n    let dir = root;\n    const parts = String(path).split('/').filter(Boolean);\n    for (let i = 0; i < parts.length - 1; ++i) {\n      dir = await dir.getDirectoryHandle(parts[i]);\n    }\n    const fileHandle = await dir.getFileHandle(parts[parts.length - 1]);\n    const access = await fileHandle.createSyncAccessHandle();\n    try {\n      const frames = Math.min(pageFrames, numSamples - startFrame);\n      const frameBytes = numChannels * 4;\n      const bytes = new Uint8Array(frames * frameBytes);\n      let bytesReadTotal = 0;\n      const readOffset = dataOffsetBytes + startFrame * frameBytes;\n      while (bytesReadTotal < bytes.byteLength) {\n        const bytesRead = access.read(bytes.subarray(bytesReadTotal), {\n          at: readOffset + bytesReadTotal,\n        });\n        if (bytesRead <= 0) {\n          break;\n        }\n        bytesReadTotal += bytesRead;\n      }\n      if (bytesReadTotal !== bytes.byteLength || bytesReadTotal % frameBytes !== 0) {\n        self.postMessage({ type: 'sonare:clip-page', requestId, pageIndex, ok: false });\n        return;\n      }\n      const framesRead = bytesReadTotal / frameBytes;\n      const view = new DataView(bytes.buffer, 0, framesRead * frameBytes);\n      const channelBuffers = Array.from({ length: numChannels }, () => new ArrayBuffer(framesRead * 4));\n      for (let ch = 0; ch < numChannels; ++ch) {\n        const channel = new Float32Array(channelBuffers[ch]);\n        for (let frame = 0; frame < framesRead; ++frame) {\n          channel[frame] = view.getFloat32((frame * numChannels + ch) * 4, true);\n        }\n      }\n      self.postMessage(\n        { type: 'sonare:clip-page', requestId, pageIndex, ok: true, frames: framesRead, channelBuffers },\n        channelBuffers,\n      );\n    } finally {\n      access.close();\n    }\n  } catch (error) {\n    self.postMessage({\n      type: 'sonare:clip-page',\n      requestId,\n      pageIndex,\n      ok: false,\n      error: error instanceof Error ? error.message : String(error),\n    });\n  }\n  });\n};\n";
export declare function createOpfsClipPageWorker(): Worker;
export declare function createOpfsClipPageProvider(engine: RealtimeEngine, options: OpfsClipPageProviderOptions): OpfsClipPageProviderBinding;
/** Result of {@link writeOpfsClip}. */
export interface OpfsClipWriteResult {
    path: string;
    numChannels: number;
    numSamples: number;
}
/** Result of {@link importOpfsClip}. */
export interface OpfsClipImportResult extends OpfsClipWriteResult {
    /** Sample rate of the decoded audio; pass it as the clip's source rate. */
    sampleRate: number;
}
/** Options for {@link writeOpfsClip} and {@link importOpfsClip}. */
export interface OpfsClipWriteOptions {
    /** Worker that runs the sync-access-handle writes; defaults to a private one. */
    worker?: Worker;
}
/**
 * Writes planar channels to an OPFS file in the layout the OPFS clip readers
 * expect: headerless little-endian float32, interleaved, starting at byte 0.
 * The file carries no sample rate, channel count or length; pass them to
 * {@link createOpfsClipPageProvider} (or `attachOpfsClipStream`) when reading
 * it back. An existing file at `path` is replaced.
 *
 * The write runs in an OPFS worker through a sync access handle. A path that an
 * open page provider currently reads is refused with `SonareError`
 * `InvalidState`.
 *
 * @param path - OPFS path, `/`-separated; missing directories are created.
 * @param channels - Non-empty, equal-length planar channels.
 * @throws TypeError when `path` or `channels` has the wrong type.
 * @throws RangeError when `channels` is empty or the lengths differ.
 */
export declare function writeOpfsClip(path: string, channels: Float32Array[], options?: OpfsClipWriteOptions): Promise<OpfsClipWriteResult>;
/**
 * Decodes `source` and writes it with {@link writeOpfsClip}. An `AudioBuffer`
 * keeps all its channels, and so do encoded bytes (`ArrayBuffer` or `Blob`),
 * which go through `decodeChannels` (with the browser codec fallback for formats
 * the native decoder does not carry). No resampling is applied: pass the
 * returned `sampleRate` as the clip's source rate.
 *
 * @param path - OPFS path, as for {@link writeOpfsClip}.
 * @param source - Encoded audio bytes or a decoded `AudioBuffer`.
 * @throws TypeError when `source` is none of the three accepted kinds.
 */
export declare function importOpfsClip(path: string, source: ArrayBuffer | Blob | AudioBuffer, options?: OpfsClipWriteOptions): Promise<OpfsClipImportResult>;
