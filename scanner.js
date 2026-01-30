const hints = new Map();
hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
  ZXing.BarcodeFormat.QR_CODE,
  ZXing.BarcodeFormat.CODE_128,
  ZXing.BarcodeFormat.CODE_39,
  ZXing.BarcodeFormat.EAN_13,
  ZXing.BarcodeFormat.EAN_8,
  ZXing.BarcodeFormat.UPC_A,
  ZXing.BarcodeFormat.UPC_E,
  ZXing.BarcodeFormat.ITF,
  ZXing.BarcodeFormat.DATA_MATRIX
]);
const codeReader = new ZXing.BrowserMultiFormatReader(hints);
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const statusEl = document.getElementById("status");
const payloadEl = document.getElementById("payload");

let currentStream = null;
let useFrontCamera = false;
let lastScan = "";
let scanCooldown = false;

const codeReader = new ZXing.BrowserMultiFormatReader();

document.getElementById("startBtn").addEventListener("click", startCamera);
document.getElementById("flipBtn").addEventListener("click", () => {
  useFrontCamera = !useFrontCamera;
  startCamera();
});
document.getElementById("uploadBtn").addEventListener("click", () => {
  document.getElementById("fileInput").click();
});

document.getElementById("fileInput").addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;

  const imgURL = URL.createObjectURL(file);

  try {
    const result = await codeReader.decodeFromImageUrl(imgURL);
    handleDecoded(result.text);
  } catch {
    statusEl.textContent = "❌ Scan failed";
    statusEl.className = "error";
  }
});
// --- AUTO-START CAMERA IF ALREADY GRANTED ---
if (navigator.permissions && navigator.permissions.query) {
  navigator.permissions.query({ name: "camera" }).then(result => {
    if (result.state === "granted") {
      startCamera();
    }

    // If permission changes while page is open
    result.onchange = () => {
      if (result.state === "granted") {
        startCamera();
      }
    };
  });
}async function startCamera() {
  statusEl.textContent = "Requesting camera...";
  statusEl.className = "neutral";

  if (currentStream) {
    currentStream.getTracks().forEach(t => t.stop());
  }

  const constraints = {
  video: {
    facingMode: useFrontCamera ? "user" : "environment",
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    advanced: [
      { width: 1920, height: 1080 },
      { focusMode: "continuous" }
    ]
  }
};
  try {
    currentStream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = currentStream;

    statusEl.textContent = "Camera active";
    statusEl.className = "success";

    // 🔧 Force autofocus after stream starts
    const track = currentStream.getVideoTracks()[0];
    const capabilities = track.getCapabilities();

    if (capabilities.focusMode) {
      await track.applyConstraints({
        advanced: [{ focusMode: "continuous" }]
      });
    }

    decodeLoop();
  } catch (err) {
    statusEl.textContent = "Camera error: " + err.name;
    statusEl.className = "error";
  }
}

function decodeLoop() {
  codeReader.decodeFromVideoDevice(null, "video", (result) => {
    if (result && !scanCooldown) {
      handleDecoded(result.text);
    }
  });
}

function handleDecoded(data) {
  if (data === lastScan) return;

  lastScan = data;
  scanCooldown = true;

  payloadEl.textContent = data;
  statusEl.textContent = "✅ Scan successful";
  statusEl.className = "success";

  addToLedger(data);

  setTimeout(() => scanCooldown = false, 1500);
}
async function startCamera() {
  statusEl.textContent = "Requesting camera...";
  statusEl.className = "neutral";

  if (currentStream) {
    currentStream.getTracks().forEach(t => t.stop());
  }

  const constraints = {
    video: {
      facingMode: useFrontCamera ? "user" : "environment",
      focusMode: "continuous", // main autofocus flag
      advanced: [{ focusMode: "continuous" }] // fallback for some browsers
    }
  };

  try {
    currentStream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = currentStream;

    statusEl.textContent = "Camera active";
    statusEl.className = "success";

    // 🔧 Force autofocus after stream starts
    const track = currentStream.getVideoTracks()[0];
    const capabilities = track.getCapabilities();

    if (capabilities.focusMode) {
      await track.applyConstraints({
        advanced: [{ focusMode: "continuous" }]
      });
    }

    decodeLoop();
  } catch (err) {
    statusEl.textContent = "Camera error: " + err.name;
    statusEl.className = "error";
  }
}
