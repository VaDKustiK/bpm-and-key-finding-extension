class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channelData = input[0];

    this.port.postMessage({
      type: "AUDIO",
      buffer: channelData.slice(0)
    });

    return true;
  }
}

registerProcessor("audio-processor", AudioProcessor);