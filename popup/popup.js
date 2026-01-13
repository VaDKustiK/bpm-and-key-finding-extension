document.getElementById("start").onclick = () => {
  chrome.runtime.sendMessage({ type: "START_ANALYSIS" });
};

document.getElementById("stop").onclick = () => {
  chrome.runtime.sendMessage({ type: "STOP_ANALYSIS" });
};