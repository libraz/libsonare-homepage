/**
 * AudioWorkletProcessor for streaming audio samples to main thread.
 * This processor collects audio samples and sends them to the main thread
 * for analysis with StreamAnalyzer.
 */
class AudioStreamProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.buffer = []
    this.bufferSize = 4096  // Send samples in chunks of 4096
    this.sampleOffset = 0
    this.isActive = true

    // Listen for messages from main thread
    this.port.onmessage = (event) => {
      if (event.data.type === 'stop') {
        this.isActive = false
      } else if (event.data.type === 'reset') {
        this.buffer = []
        // Use provided sampleOffset or reset to 0
        this.sampleOffset = event.data.sampleOffset || 0
        this.isActive = true
      } else if (event.data.type === 'setBufferSize') {
        this.bufferSize = event.data.bufferSize
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
        // Add samples to buffer
        for (let i = 0; i < inputChannel.length; i++) {
          this.buffer.push(inputChannel[i])
        }

        // Send buffer to main thread when we have enough samples
        while (this.buffer.length >= this.bufferSize) {
          const chunk = this.buffer.splice(0, this.bufferSize)
          this.port.postMessage({
            type: 'samples',
            samples: new Float32Array(chunk),
            sampleOffset: this.sampleOffset,
          })
          this.sampleOffset += this.bufferSize
        }
      }
    }

    // Return true to keep processor alive
    return true
  }
}

registerProcessor('audio-stream-processor', AudioStreamProcessor)
