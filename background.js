let isCapturing = false;

chrome.runtime.onMessage.addListener(async (message) => {
  if (message.type === "START") {
    if (isCapturing) {
      console.warn("already capturing audio");
      return;
    }

    isCapturing = true;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      isCapturing = false;
      return;
    }

    await createOffscreen();

    try {
      const streamId = await chrome.tabCapture.getMediaStreamId({
        targetTabId: tab.id
      });

      chrome.runtime.sendMessage({
        type: "START_AUDIO",
        streamId
      });

      console.log("Sent STREAM_ID to offscreen");

    } catch (err) {
      console.error(err);
      isCapturing = false;
    }
  }

  if (message.type === "STOP") {
    if (!isCapturing) return;
    isCapturing = false;
    chrome.runtime.sendMessage({ type: "STOP_AUDIO" });
    console.log("Sent STOP_AUDIO to offscreen");
  }
});

async function createOffscreen() {
  const exists = await chrome.offscreen.hasDocument();
  if (!exists) {
    await chrome.offscreen.createDocument({
      url: "offscreen/offscreen.html",
      reasons: ["AUDIO_PLAYBACK"],
      justification: "capture tab audio for analysis"
    });
    console.log("Offscreen CREATED");
  }
}