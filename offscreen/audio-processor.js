class AudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.sampleCount = 0;
    }

    process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const samples = input[0];

    this.port.postMessage({
        type: "AUDIO_FLOW",
        samples: samples.slice(0)
    });

    return true;
    }
}
registerProcessor("audio-processor", AudioProcessor);