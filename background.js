let isCapturing = false;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "START_ANALYSIS") {
    startCapture();
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "STOP_ANALYSIS") {
    stopCapture();
  }
});

async function startCapture() {
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
      type: "STREAM_ID",
      streamId
    });
  } catch (err) {
    console.error(err);
    isCapturing = false;
  }
}

function stopCapture() {
  if (!isCapturing) return;
  isCapturing = false;
  chrome.runtime.sendMessage({ type: "STOP_AUDIO" });
}

async function createOffscreen() {
  const exists = await chrome.offscreen.hasDocument();

  if (!exists) {
    await chrome.offscreen.createDocument({
      url: "offscreen/offscreen.html",
      reasons: ["AUDIO_PLAYBACK"],
      justification: "capture tab audio for analysis"
    });
  }
}