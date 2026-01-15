let mediaStream = null;
let audioCtx = null;
let sourceNode = null;
let workletNode = null;
let monitorGain = null;

console.log("OFFSCREEN SCRIPT LOADED");
chrome.runtime.sendMessage({ type: "OFFSCREEN_READY" });

chrome.runtime.onMessage.addListener(async (message) => {

  if (message.type === "START_AUDIO") {
    if (mediaStream) return;

    console.log("START_AUDIO received in offscreen");

    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: "tab",
          chromeMediaSourceId: message.streamId
        }
      }
    });

    audioCtx = new AudioContext();
    await audioCtx.resume();

    await audioCtx.audioWorklet.addModule(
      chrome.runtime.getURL("offscreen/audio-processor.js")
    );

    sourceNode = audioCtx.createMediaStreamSource(mediaStream);

    workletNode = new AudioWorkletNode(audioCtx, "audio-processor");

    let audioBuffer = [];
    let bufferSize = 44100 * 2;

    workletNode.port.onmessage = (e) => {
      if (e.data.type === "AUDIO_FLOW") {
        const samples = e.data.samples;
        audioBuffer.push(...samples);

        if (audioBuffer.length > bufferSize) {
          audioBuffer = audioBuffer.slice(audioBuffer.length - bufferSize);
        }

        console.log("Buffered samples:", audioBuffer.length);
      }
    };

    monitorGain = audioCtx.createGain();
    monitorGain.gain.value = 1; // 0 = no audio

    sourceNode.connect(workletNode);
    sourceNode.connect(monitorGain);
    monitorGain.connect(audioCtx.destination);

    console.log("Audio started and connected to worklet");
  }

  if (message.type === "STOP_AUDIO") {
    if (!mediaStream) return;

    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;

    if (sourceNode) {
      sourceNode.disconnect();
      sourceNode = null;
    }

    if (workletNode) {
      workletNode.port.close();
      workletNode = null;
    }

    if (audioCtx) {
      await audioCtx.close();
      audioCtx = null;
    }

    console.log("audio stopped");
  }
});