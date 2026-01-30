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
// START CAMERA (NO ZOOM, NO PULSES, STABLE FEED)
// ------------------------------------------------------------
async function startCamera() {
  statusEl.textContent = "Requesting camera...";
  statusEl.className = "neutral";

  if (currentStream) {
    currentStream.getTracks().forEach(t => t.stop());
  }

  const constraints = {
    video: {
      facingMode: useFrontCamera ? "user" : "environment",
      width: { ideal: 1920 },
      height: { ideal: 1080 }
    }
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
