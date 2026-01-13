let mediaStream = null;

chrome.runtime.onMessage.addListener(async (message) => {
  if (message.type === "STREAM_ID") {
    if (mediaStream) return;

    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: "tab",
          chromeMediaSourceId: message.streamId
        }
      }
    });

    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(mediaStream);
    src.connect(ctx.destination);

    console.log("audio started");
  }

  if (message.type === "STOP_AUDIO") {
    if (!mediaStream) return;

    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;

    console.log("audio stopped");
  }
});