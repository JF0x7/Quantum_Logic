// ------------------------------------------------------------
// BARCODE HINTS (Enable tiny barcodes + all formats)
// ------------------------------------------------------------
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

// ------------------------------------------------------------
// DOM ELEMENTS
// ------------------------------------------------------------
const video = document.getElementById("video");
const statusEl = document.getElementById("status");
const payloadEl = document.getElementById("payload");

// ------------------------------------------------------------
// STATE
// ------------------------------------------------------------
let currentStream = null;
let useFrontCamera = false;
let lastScan = "";
let scanCooldown = false;

// ------------------------------------------------------------
// BUTTONS
// ------------------------------------------------------------
document.getElementById("startBtn").addEventListener("click", startCamera);
document.getElementById("flipBtn").addEventListener("click", () => {
  useFrontCamera = !useFrontCamera;
  startCamera();
});
document.getElementById("uploadBtn").addEventListener("click", () => {
  document.getElementById("fileInput").click();
});

// ------------------------------------------------------------
// IMAGE UPLOAD SCANNING
// ------------------------------------------------------------
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

// ------------------------------------------------------------
// AUTO-START CAMERA IF PERMISSION ALREADY GRANTED
// ------------------------------------------------------------
if (navigator.permissions && navigator.permissions.query) {
  navigator.permissions.query({ name: "camera" }).then(result => {
    if (result.state === "granted") startCamera();
    result.onchange = () => {
      if (result.state === "granted") startCamera();
    };
  });
}

// ------------------------------------------------------------
// SAMSUNG INTERNET AUTOFOCUS FIX (Zoom Pulse)
// ------------------------------------------------------------
async function forceRefocus(track) {
  const caps = track.getCapabilities();
  if (!caps.zoom) return;

  const settings = track.getSettings();
  const min = caps.zoom.min;
  const max = caps.zoom.max;

  try {
    await track.applyConstraints({ advanced: [{ zoom: max * 0.9 }] });
    await new Promise(r => setTimeout(r, 120));
    await track.applyConstraints({ advanced: [{ zoom: settings.zoom || min }] });
  } catch (e) {
    console.log("Refocus pulse unsupported", e);
  }
}

// ------------------------------------------------------------
// START CAMERA
// ------------------------------------------------------------
async function startCamera() {
  statusEl.textContent = "Requesting camera...";
  statusEl.className = "neutral";

  // Stop old stream
  if (currentStream) {
    currentStream.getTracks().forEach(t => t.stop());
  }

  // High resolution for tiny barcodes
  const constraints = {
    video: {
      facingMode: useFrontCamera ? "user" : "environment",
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      advanced: [{ width: 1920, height: 1080 }]
    }
  };

  try {
    currentStream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = currentStream;

    statusEl.textContent = "Camera active";
    statusEl.className = "success";

    const track = currentStream.getVideoTracks()[0];

    // Samsung autofocus pulse
    setTimeout(() => forceRefocus(track), 500);

    // Continuous refocus every 2.5s
    setInterval(() => {
      const t = currentStream?.getVideoTracks()[0];
      if (t) forceRefocus(t);
    }, 2500);

    decodeLoop();

  } catch (err) {
    statusEl.textContent = "Camera error: " + err.name;
    statusEl.className = "error";
  }
}

// ------------------------------------------------------------
// DECODE LOOP (Fast + tiny barcode friendly)
// ------------------------------------------------------------
function decodeLoop() {
  codeReader.decodeFromVideoDevice(null, "video", (result, err) => {
    if (result && !scanCooldown) {
      handleDecoded(result.text);
    }

    if (err && !(err instanceof ZXing.NotFoundException)) {
      console.log("Decode error:", err);
    }
  });
}

// ------------------------------------------------------------
// HANDLE SUCCESSFUL DECODE
// ------------------------------------------------------------
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
