document.getElementById("start").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "START" });
});

document.getElementById("stop").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "STOP" });
});