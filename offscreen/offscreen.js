let mediaStream = null;
let audioCtx = null;
let sourceNode = null;
let workletNode = null;
let monitorGain = null;
let analysisInterval = null;

console.log("OFFSCREEN SCRIPT LOADED");
chrome.runtime.sendMessage({ type: "OFFSCREEN_READY" });

const KEYS = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

const MAJOR_PROFILE = [6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88];
const MINOR_PROFILE = [6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17];

function correlation(a, b) {
  return a.reduce((sum, v, i) => sum + v * b[i], 0);
}

function rotate(arr, n) {
  return arr.slice(n).concat(arr.slice(0, n));
}

function averageChroma(frames) {
  const avg = new Array(12).fill(0);
  frames.forEach(frame => {
    frame.forEach((v, i) => avg[i] += v);
  });
  return avg.map(v => v / frames.length);
}

function detectKeyFromChroma(chroma) {
  let best = { score: -Infinity };

  for (let i = 0; i < 12; i++) {
    const majorScore = correlation(rotate(chroma, i), MAJOR_PROFILE);
    const minorScore = correlation(rotate(chroma, i), MINOR_PROFILE);

    if (majorScore > best.score)
      best = { key: KEYS[i], mode: "major", score: majorScore };

    if (minorScore > best.score)
      best = { key: KEYS[i], mode: "minor", score: minorScore };
  }

  return `${best.key} ${best.mode}`;
}

chrome.runtime.onMessage.addListener(async (message) => {

  if (message.type === "START_AUDIO") {
    if (mediaStream) return;

    console.log("START_AUDIO received");

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
    const SAMPLE_BUFFER_SIZE = 44100 * 20;

    /* BPM */
    let bpmHistory = [];
    const maxBpmHistory = 5;

    workletNode.port.onmessage = (e) => {
      if (e.data.type === "AUDIO") {
        audioBuffer.push(...e.data.buffer);

        if (audioBuffer.length > SAMPLE_BUFFER_SIZE) {
          audioBuffer = audioBuffer.slice(
            audioBuffer.length - SAMPLE_BUFFER_SIZE
          );
        }
      }
    };

    analysisInterval = setInterval(() => {
      if (audioBuffer.length < SAMPLE_BUFFER_SIZE) return;

      const signal = new Float32Array(audioBuffer);

      try {
        /* BPM */
        const mt = new MusicTempo(signal);
        const bpm = Number(mt.tempo);

        bpmHistory.push(bpm);
        if (bpmHistory.length > maxBpmHistory) bpmHistory.shift();

        const avgBPM =
          bpmHistory.reduce((a, b) => a + b, 0) / bpmHistory.length;

        /* KEY */
        const chromaFrames = [];

        for (let i = 0; i < signal.length; i += 2048) {
          const frame = signal.slice(i, i + 2048);
          if (frame.length < 2048) continue;

          const chroma = Meyda.extract("chroma", frame, {
            sampleRate: audioCtx.sampleRate,
            bufferSize: 2048
          });

          if (chroma) chromaFrames.push(chroma);
        }

        if (chromaFrames.length === 0) return;

        const avgChroma = averageChroma(chromaFrames);
        const key = detectKeyFromChroma(avgChroma);

        console.log(`BPM: ${avgBPM.toFixed(1)} | Key: ${key}`);

        chrome.runtime.sendMessage({
          type: "ANALYSIS_UPDATE",
          bpm: Number(avgBPM.toFixed(1)),
          key
        });

      } catch (err) {
        console.warn("Analysis failed:", err);
      }

    }, 1000);

    monitorGain = audioCtx.createGain();
    monitorGain.gain.value = 1;

    sourceNode.connect(workletNode);
    sourceNode.connect(monitorGain);
    monitorGain.connect(audioCtx.destination);

    console.log("Audio started");
  }

  if (message.type === "STOP_AUDIO") {
    console.log("STOP_AUDIO received");

    if (analysisInterval) clearInterval(analysisInterval);

    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop());
      mediaStream = null;
    }

    if (sourceNode) sourceNode.disconnect();
    if (monitorGain) monitorGain.disconnect();

    if (workletNode) {
      workletNode.port.close();
      workletNode = null;
    }

    if (audioCtx) {
      await audioCtx.close();
      audioCtx = null;
    }

    console.log("Audio stopped");
  }
});