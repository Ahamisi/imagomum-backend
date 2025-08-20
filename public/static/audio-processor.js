/**
 * AudioWorklet Processor for Real-time PCM Audio Conversion
 * Converts microphone input to PCM format for WebSocket transmission
 */
class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 4096;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    
    if (input.length > 0) {
      const inputChannel = input[0]; // Get first channel (mono)
      
      for (let i = 0; i < inputChannel.length; i++) {
        // Add sample to buffer
        this.buffer[this.bufferIndex] = inputChannel[i];
        this.bufferIndex++;
        
        // When buffer is full, convert to PCM and send
        if (this.bufferIndex >= this.bufferSize) {
          this.sendPCMData();
          this.bufferIndex = 0;
        }
      }
    }
    
    return true; // Keep processor alive
  }

  sendPCMData() {
    // Convert Float32 samples to Int16 PCM
    const pcmBuffer = new ArrayBuffer(this.buffer.length * 2);
    const pcmView = new DataView(pcmBuffer);
    
    for (let i = 0; i < this.buffer.length; i++) {
      // Convert float (-1 to 1) to 16-bit integer (-32768 to 32767)
      const sample = Math.max(-1, Math.min(1, this.buffer[i])); // Clamp
      const pcmSample = sample * 0x7FFF; // Scale to 16-bit range
      pcmView.setInt16(i * 2, pcmSample, true); // Little endian
    }
    
    // Send PCM data to main thread
    this.port.postMessage(pcmBuffer);
  }
}

// Register the processor
registerProcessor('audio-processor', AudioProcessor); 