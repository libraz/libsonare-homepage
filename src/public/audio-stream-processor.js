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
    this.fillCount = 0
    this.sampleOffset = 0
    this.isActive = true

    // Listen for messages from main thread
    this.port.onmessage = (event) => {
      if (event.data.type === 'stop') {
        this.isActive = false
      } else if (event.data.type === 'reset') {
        this.fillCount = 0
        // Use provided sampleOffset or reset to 0
        this.sampleOffset = event.data.sampleOffset || 0
        this.isActive = true
      } else if (event.data.type === 'setBufferSize') {
        this.bufferSize = event.data.bufferSize
        this.chunk = new Float32Array(this.bufferSize)
        this.fillCount = 0
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

      // Collect samples for analysis (mono - use first channel)
      if (this.isActive && inputChannel) {
        let read = 0
        while (read < inputChannel.length) {
          // Fill the pre-allocated chunk up to bufferSize.
          const remaining = this.bufferSize - this.fillCount
          const available = inputChannel.length - read
          const take = remaining < available ? remaining : available
          this.chunk.set(inputChannel.subarray(read, read + take), this.fillCount)
          this.fillCount += take
          read += take

          // Send to the main thread when a full chunk is ready. Transfer the
          // buffer to avoid a copy, then allocate a fresh backing store for the
          // next fill (transfer detaches the old one).
          if (this.fillCount === this.bufferSize) {
            const samples = this.chunk
            this.chunk = new Float32Array(this.bufferSize)
            this.fillCount = 0
            this.port.postMessage(
              {
                type: 'samples',
                samples,
                sampleOffset: this.sampleOffset,
              },
              [samples.buffer],
            )
            this.sampleOffset += this.bufferSize
          }
        }
      }
    }

    // Return true to keep processor alive
    return true
  }
}

registerProcessor('audio-stream-processor', AudioStreamProcessor)
