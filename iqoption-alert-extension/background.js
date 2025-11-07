let lastSignalTime = null;

async function fetchSignals() {
  try {
    const res = await fetch("http://127.0.0.1:8000/signals"); // <-- tu endpoint
    const data = await res.json();
    if (data.status !== "ok" || !data.data.length) return;

    const s = data.data[0];
    if (s.timestamp === lastSignalTime) return;
    lastSignalTime = s.timestamp;

    chrome.tabs.query({ url: "*://iqoption.com/traderoom/*" }, (tabs) => {
      for (let tab of tabs) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: displaySignal,
          args: [s]
        });
      }
    });
  } catch (err) {
    console.warn("⚠️ Error al leer API de señales:", err);
  }
}

function displaySignal(signal) {
  const { symbol, direction, confidence_display, elapsed_time, timeframe } = signal;

  // ⚡ solo mostrar si la temporalidad es 3m o 5m
  if (timeframe !== "3m" && timeframe !== "5m") return;

  const alertBox = document.createElement("div");
  alertBox.style = `
    position: fixed; top: 10px; right: 10px;
    background: ${direction === "CALL" ? "#00FF99" : "#FF4C4C"};
    color: #000; font-weight: bold;
    padding: 12px 16px; border-radius: 10px;
    font-family: Arial; font-size: 14px;
    z-index: 9999999999; box-shadow: 0 0 10px rgba(0,0,0,0.4);
  `;

  alertBox.innerText = `${symbol} (${timeframe}) → ${direction} | ${confidence_display} | ${elapsed_time}`;
  document.body.appendChild(alertBox);

  // 🔊 sonido opcional
  const beep = new Audio(direction === "CALL"
    ? "https://actions.google.com/sounds/v1/cartoon/clang_and_wobble.ogg"
    : "https://actions.google.com/sounds/v1/cartoon/boing.ogg");
  beep.play();

  setTimeout(() => alertBox.remove(), 7000);
}


chrome.alarms.create("fetchSignals", { periodInMinutes: 0.1 });
chrome.alarms.onAlarm.addListener(fetchSignals);
