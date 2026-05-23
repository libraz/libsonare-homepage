import type { MasteringChainConfig, MasteringResult, MasteringStereoChainResult } from '../wasm/index'

type WorkerRequest = {
  type: 'render'
  id: number
  left: Float32Array
  right: Float32Array
  sampleRate: number
  config: MasteringChainConfig
} | {
  type: 'referenceMatch'
  id: number
  left: Float32Array
  right: Float32Array
  referenceLeft: Float32Array
  referenceRight: Float32Array
  sampleRate: number
}

type WasmModule = {
  init: () => Promise<void>
  masteringChainStereoWithProgress: (
    left: Float32Array,
    right: Float32Array,
    sampleRate: number,
    config: MasteringChainConfig,
    onProgress: (progress: number, stage: string) => void,
  ) => MasteringStereoChainResult
  masteringPairProcess: (
    processorName: string,
    source: Float32Array,
    reference: Float32Array,
    sampleRate: number,
    params?: Record<string, number | boolean>,
  ) => MasteringResult
}

let wasmModule: WasmModule | null = null

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data

  try {
    postProgress(request.id, 0.04, 'Preparing audio buffers')

    if (!wasmModule) {
      postProgress(request.id, 0.12, 'Loading libsonare WASM')
      wasmModule = await import('../wasm/index.js') as WasmModule
      await wasmModule.init()
    }

    const result = request.type === 'render'
      ? renderMasteringChain(request)
      : renderReferenceMatch(request)

    postProgress(request.id, 0.94, 'Finalizing render')
    self.postMessage({
      type: 'done',
      id: request.id,
      result: {
        left: result.left,
        right: result.right,
        sampleRate: result.sampleRate,
        inputLufs: result.inputLufs,
        outputLufs: result.outputLufs,
        appliedGainDb: result.appliedGainDb,
        stages: result.stages || [],
        latencySamples: result.latencySamples,
      },
    }, [result.left.buffer, result.right.buffer])
  } catch (error) {
    self.postMessage({
      type: 'error',
      id: request.id,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

function renderMasteringChain(request: Extract<WorkerRequest, { type: 'render' }>) {
  if (!wasmModule) throw new Error('WASM module is not initialized')
  postProgress(request.id, 0.24, 'Running mastering chain')
  return wasmModule.masteringChainStereoWithProgress(
    request.left,
    request.right,
    request.sampleRate,
    request.config,
    (progress, stage) => {
      postProgress(request.id, 0.24 + progress * 0.7, stage)
    },
  )
}

function renderReferenceMatch(request: Extract<WorkerRequest, { type: 'referenceMatch' }>) {
  if (!wasmModule) throw new Error('WASM module is not initialized')

  const length = Math.min(
    request.left.length,
    request.right.length,
    request.referenceLeft.length,
    request.referenceRight.length,
  )
  const left = request.left.slice(0, length)
  const right = request.right.slice(0, length)
  const referenceLeft = request.referenceLeft.slice(0, length)
  const referenceRight = request.referenceRight.slice(0, length)

  postProgress(request.id, 0.36, 'match.applyMatchEq left')
  const leftResult = wasmModule.masteringPairProcess(
    'match.applyMatchEq',
    left,
    referenceLeft,
    request.sampleRate,
    { maxGainDb: 6, smoothingBins: 5 },
  )

  postProgress(request.id, 0.68, 'match.applyMatchEq right')
  const rightResult = wasmModule.masteringPairProcess(
    'match.applyMatchEq',
    right,
    referenceRight,
    request.sampleRate,
    { maxGainDb: 6, smoothingBins: 5 },
  )

  return {
    left: leftResult.samples,
    right: rightResult.samples,
    sampleRate: request.sampleRate,
    inputLufs: (leftResult.inputLufs + rightResult.inputLufs) / 2,
    outputLufs: (leftResult.outputLufs + rightResult.outputLufs) / 2,
    appliedGainDb: 0,
    stages: ['match.applyMatchEq.left', 'match.applyMatchEq.right'],
  }
}

function postProgress(id: number, progress: number, stage: string) {
  self.postMessage({ type: 'progress', id, progress, stage })
}
