/**
 * AudioWorkletProcessor for streaming audio samples to main thread.
 * This processor collects audio samples and sends them to the main thread
 * for analysis with StreamAnalyzer.
 */
class AudioStreamProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.bufferSize = 4096  // Send samples in chunks of 4096
    // Pre-allocated fill buffer; avoids per-block allocation/splice on the
    // audio thread (which causes GC pauses = audible glitches).
    this.chunk = new Float32Array(this.bufferSize)
    this.bufferPool = []
    this.maxPoolSize = 4
    this.fillCount = 0
    this.sampleOffset = 0
    this.isActive = true

    // Listen for messages from main thread
    this.port.onmessage = (event) => {
      if (event.data.type === 'stop') {
        this.flushChunk()
        this.isActive = false
      } else if (event.data.type === 'reset') {
        this.fillCount = 0
        // Use provided sampleOffset or reset to 0
        this.sampleOffset = event.data.sampleOffset || 0
        this.isActive = true
      } else if (event.data.type === 'setBufferSize') {
        const requested = Number(event.data.bufferSize)
        if (!Number.isInteger(requested) || requested < 128 || requested > 65536) return
        this.flushChunk()
        this.bufferSize = requested
        this.chunk = new Float32Array(this.bufferSize)
        this.fillCount = 0
        this.bufferPool = []
      } else if (event.data.type === 'recycle') {
        const samples = event.data.samples
        if (
          samples instanceof Float32Array &&
          samples.length === this.bufferSize &&
          this.bufferPool.length < this.maxPoolSize
        ) {
          this.bufferPool.push(samples)
        }
      }
    }
  }

  process(inputs, outputs, parameters) {
    // Pass through audio unchanged
    const input = inputs[0]
    const output = outputs[0]

    if (input.length > 0) {
      const inputChannel = input[0]

      // Copy input to output (pass-through)
      if (output.length > 0) {
        output[0].set(inputChannel)
        // Copy other channels if present
        for (let ch = 1; ch < output.length && ch < input.length; ch++) {
          output[ch].set(input[ch])
        }
      }

      // Collect samples for analysis. Downmix all available channels so stereo
      // material cannot disappear merely because it lives in the right channel.
      if (this.isActive && inputChannel) {
        let read = 0
        while (read < inputChannel.length) {
          // Fill the pre-allocated chunk up to bufferSize.
          const remaining = this.bufferSize - this.fillCount
          const available = inputChannel.length - read
          const take = remaining < available ? remaining : available
          for (let i = 0; i < take; i++) {
            let sum = 0
            for (let ch = 0; ch < input.length; ch++) sum += input[ch][read + i] || 0
            this.chunk[this.fillCount + i] = sum / input.length
          }
          this.fillCount += take
          read += take

          // Send to the main thread when a full chunk is ready. Transfer the
          // buffer to avoid a copy, then allocate a fresh backing store for the
          // next fill (transfer detaches the old one).
          if (this.fillCount === this.bufferSize) {
            this.emitChunk(this.bufferSize)
          }
        }
      }
    }

    // Return true to keep processor alive
    return true
  }

  emitChunk(length) {
    if (length <= 0) return
    const samples = length === this.bufferSize ? this.chunk : this.chunk.slice(0, length)
    this.chunk = this.bufferPool.pop() || new Float32Array(this.bufferSize)
    this.fillCount = 0
    this.port.postMessage(
      {
        type: 'samples',
        samples,
        sampleOffset: this.sampleOffset,
      },
      [samples.buffer],
    )
    this.sampleOffset += length
  }

  flushChunk() {
    if (this.fillCount > 0) this.emitChunk(this.fillCount)
  }
}

registerProcessor('audio-stream-processor', AudioStreamProcessor)
