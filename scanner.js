const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const statusEl = document.getElementById("status");
const payloadEl = document.getElementById("payload");

let currentStream = null;
let useFrontCamera = false;
let lastScan = "";
let scanCooldown = false;

const codeReader = new ZXing.BrowserMultiFormatReader(
  new ZXing.Hints([
    [ZXing.DecodeHintType.TRY_HARDER, true],
    [ZXing.DecodeHintType.POSSIBLE_FORMATS, [
      ZXing.BarcodeFormat.QR_CODE,
      ZXing.BarcodeFormat.DATA_MATRIX,
      ZXing.BarcodeFormat.AZTEC,
      ZXing.BarcodeFormat.PDF_417,
      ZXing.BarcodeFormat.CODE_128,
      ZXing.BarcodeFormat.CODE_39,
      ZXing.BarcodeFormat.CODE_93,
      ZXing.BarcodeFormat.EAN_13,
      ZXing.BarcodeFormat.EAN_8,
      ZXing.BarcodeFormat.UPC_A,
      ZXing.BarcodeFormat.UPC_E,
      ZXing.BarcodeFormat.ITF,
      ZXing.BarcodeFormat.RSS_14,
      ZXing.BarcodeFormat.RSS_EXPANDED
    ]]
  ])
);

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
  } catch {
    setStatus("❌ Scan failed", "error");
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
   CAMERA START — UNIVERSAL & CLEAN
---------------------------------------------------------- */
async function startCamera() {
  setStatus("Requesting camera...");

  if (!navigator.mediaDevices?.getUserMedia) {
    return setStatus("Camera not supported in this browser.", "error");
  }

  if (location.protocol !== "https:" && location.hostname !== "localhost") {
    return setStatus("Camera requires HTTPS.", "error");
  }

  stopStream();

  let constraints = {
    video: { facingMode: useFrontCamera ? "user" : { ideal: "environment" } }
  };

  try {
    currentStream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch (err) {
    console.warn("FacingMode failed, fallback:", err);

    try {
      currentStream = await navigator.mediaDevices.getUserMedia({ video: true });
    } catch (err2) {
      return setStatus("Camera error: " + err2.name, "error");
    }
  }

  video.srcObject = currentStream;

  video.onloadedmetadata = () => {
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
  };

  setStatus("Camera active", "success");
  startDecodeLoop();
}

/* ----------------------------------------------------------
   DECODE LOOP — LIGHT & STABLE
---------------------------------------------------------- */
async function startDecodeLoop() {
  codeReader.reset();

  // Get camera list
  const devices = await codeReader.listVideoInputDevices();
  if (!devices.length) {
    return setStatus("No camera devices found.", "error");
  }

  // Pick correct camera
  let selectedDeviceId;

  if (useFrontCamera) {
    selectedDeviceId = devices.find(d => d.label.toLowerCase().includes("front"))?.deviceId;
  } else {
    selectedDeviceId = devices.find(d => d.label.toLowerCase().includes("back"))?.deviceId;
  }

  // Fallback if no match
  if (!selectedDeviceId) {
    selectedDeviceId = devices[0].deviceId;
  }

  // Start decoding
  codeReader.decodeFromVideoDevice(selectedDeviceId, video, (result, err) => {
    if (result && !scanCooldown) {
      handleDecoded(result.text);
    }

    if (err && !(err instanceof ZXing.NotFoundException)) {
      console.warn("Decode error:", err);
    }
  });
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
