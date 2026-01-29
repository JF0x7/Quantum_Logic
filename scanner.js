// --- DOM ELEMENTS ---
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const statusEl = document.getElementById("status");
const payloadEl = document.getElementById("payload");

// --- CAMERA + SCANNING STATE ---
let currentStream = null;
let useFrontCamera = false;
let lastScan = "";
let scanCooldown = false;

const codeReader = new ZXing.BrowserMultiFormatReader();

// --- BUTTON EVENTS ---
document.getElementById("startBtn").addEventListener("click", startCamera);

document.getElementById("flipBtn").addEventListener("click", () => {
  useFrontCamera = !useFrontCamera;
  startCamera();
});

document.getElementById("uploadBtn").addEventListener("click", () => {
  document.getElementById("fileInput").click();
});

// --- FILE UPLOAD SCANNING ---
document.getElementById("fileInput").addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;

  const imgURL = URL.createObjectURL(file);

  try {
    const result = await codeReader.decodeFromImageUrl(imgURL);
    handleDecoded(result.text);
  } catch (err) {
    statusEl.textContent = "❌ Scan failed";
    statusEl.className = "error";
  }
});

// --- CAMERA START ---
async function startCamera() {
  statusEl.textContent = "Requesting camera...";
  statusEl.className = "neutral";

  if (currentStream) {
    currentStream.getTracks().forEach(t => t.stop());
  }

  const constraints = {
    video: { facingMode: useFrontCamera ? "user" : "environment" }
  };

  try {
    currentStream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = currentStream;

    statusEl.textContent = "Camera active";
    statusEl.className = "success";

    decodeLoop();
  } catch (err) {
    statusEl.textContent = "Camera error: " + err.name;
    statusEl.className = "error";
  }
}

// --- LIVE DECODE LOOP ---
function decodeLoop() {
  codeReader.decodeFromVideoDevice(null, "video", (result, err) => {
    if (result && !scanCooldown) {
      handleDecoded(result.text);
    }
  });
}

// --- HANDLE SUCCESSFUL DECODE ---
function handleDecoded(data) {
  if (data === lastScan) return;

  lastScan = data;
  scanCooldown = true;

  payloadEl.textContent = data;
  statusEl.textContent = "✅ Scan successful";
  statusEl.className = "success";

  // 🔥 Call ledger module
  addToLedger(data);

  setTimeout(() => scanCooldown = false, 1500);
}
