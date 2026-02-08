const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const statusEl = document.getElementById("status");
const payloadEl = document.getElementById("payload");

let currentStream = null;
let useFrontCamera = false;
let lastScan = "";
let scanCooldown = false;

const hints = new Map();
hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
hints.set(
  ZXing.DecodeHintType.POSSIBLE_FORMATS,
  Object.values(ZXing.BarcodeFormat) // ← scans EVERYTHING ZXing supports
);

const codeReader = new ZXing.BrowserMultiFormatReader(hints);

/* ----------------------------------------------------------
   UTILITIES
---------------------------------------------------------- */
function setStatus(text, type = "neutral") {
  statusEl.textContent = text;
  statusEl.className = type;
}

function stopStream() {
  if (currentStream) {
    currentStream.getTracks().forEach(t => t.stop());
    currentStream = null;
  }
}

/* ----------------------------------------------------------
   BUTTON EVENTS
---------------------------------------------------------- */
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

  try {
    const imgURL = URL.createObjectURL(file);
    const result = await codeReader.decodeFromImageUrl(imgURL);
    handleDecoded(result.text);
  } catch (err) {
    console.error(err);
    setStatus("❌ Image scan failed", "error");
  }
});

document.getElementById("sendBtn").addEventListener("click", () => {
  if (!lastScan) {
    setStatus("No scan to signal.", "neutral");
    return;
  }

  setStatus("📡 Signal sent", "success");
  addToLedger("[SIGNAL] " + lastScan);
});

/* ----------------------------------------------------------
   CAMERA START — WITH PERMISSION PROMPT + ERRORS
---------------------------------------------------------- */
async function startCamera() {
  setStatus("Requesting camera access...");

  if (!navigator.mediaDevices?.getUserMedia) {
    return setStatus("❌ This browser does not support camera access.", "error");
  }

  if (location.protocol !== "https:" && location.hostname !== "localhost") {
    return setStatus("❌ Camera requires HTTPS.", "error");
  }

  stopStream();

  const constraints = {
    video: { facingMode: useFrontCamera ? "user" : { ideal: "environment" } }
  };

  try {
    currentStream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch (err) {
    if (err.name === "NotAllowedError") {
      return setStatus("❌ Camera blocked. Please enable camera permissions.", "error");
    }
    if (err.name === "NotFoundError") {
      return setStatus("❌ No camera found on this device.", "error");
    }
    return setStatus("❌ Camera error: " + err.message, "error");
  }

  video.srcObject = currentStream;

  video.onloadedmetadata = () => {
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
  };

  setStatus("📷 Camera active", "success");
  startDecodeLoop();
}

/* ----------------------------------------------------------
   DECODE LOOP — CLEAN + SAFE
---------------------------------------------------------- */
async function startDecodeLoop() {
  codeReader.reset();

  let devices;
  try {
    devices = await codeReader.listVideoInputDevices();
  } catch (err) {
    return setStatus("❌ Unable to list cameras.", "error");
  }

  if (!devices.length) {
    return setStatus("❌ No camera devices detected.", "error");
  }

  let selectedDeviceId;

  if (useFrontCamera) {
    selectedDeviceId = devices.find(d => d.label.toLowerCase().includes("front"))?.deviceId;
  } else {
    selectedDeviceId = devices.find(d => d.label.toLowerCase().includes("back"))?.deviceId;
  }

  if (!selectedDeviceId) selectedDeviceId = devices[0].deviceId;

  try {
    codeReader.decodeFromVideoDevice(selectedDeviceId, video, (result, err) => {
      if (result && !scanCooldown) {
        handleDecoded(result.text);
      }

      if (err && !(err instanceof ZXing.NotFoundException)) {
        console.warn("Decode error:", err);
      }
    });
  } catch (err) {
    console.error(err);
    setStatus("❌ Failed to start decoding.", "error");
  }
}

/* ----------------------------------------------------------
   HANDLE DECODED PAYLOAD
---------------------------------------------------------- */
function handleDecoded(data) {
  if (data === lastScan) return;

  lastScan = data;
  scanCooldown = true;

  payloadEl.textContent = data;
  setStatus("✅ Scan successful", "success");

  addToLedger(data);

  setTimeout(() => (scanCooldown = false), 1500);
}
