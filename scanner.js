/* ----------------------------------------------------------
   ELEMENT REFERENCES
---------------------------------------------------------- */
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const statusEl = document.getElementById("status");
const payloadEl = document.getElementById("payload");

let currentStream = null;
let useFrontCamera = true;
let lastScan = null;
let scanCooldown = false;

/* ----------------------------------------------------------
   ZXING SETUP — Scan All Formats
---------------------------------------------------------- */
const hints = new Map();
hints.set(
  ZXing.DecodeHintType.POSSIBLE_FORMATS,
  [
    ZXing.BarcodeFormat.QR_CODE,
    ZXing.BarcodeFormat.DATA_MATRIX,
    ZXing.BarcodeFormat.AZTEC,
    ZXing.BarcodeFormat.PDF_417,

    // 1D Barcodes (Retail)
    ZXing.BarcodeFormat.EAN_13,
    ZXing.BarcodeFormat.EAN_8,
    ZXing.BarcodeFormat.UPC_A,
    ZXing.BarcodeFormat.UPC_E,
    ZXing.BarcodeFormat.CODE_128,
    ZXing.BarcodeFormat.CODE_39,
    ZXing.BarcodeFormat.ITF,
    ZXing.BarcodeFormat.CODABAR,
  ]
)
  ZXing.DecodeHintType.POSSIBLE_FORMATS,
  Object.values(ZXing.BarcodeFormat)
);

const codeReader = new ZXing.BrowserMultiFormatReader(hints);

/* ----------------------------------------------------------
   UI HELPERS
---------------------------------------------------------- */

/**
 * Update the status text + color.
 */
function setStatus(text, type = "neutral") {
  statusEl.textContent = text;
  statusEl.className = type;
}

/**
 * Stop any active camera stream.
 */
function stopStream() {
  if (!currentStream) return;
  currentStream.getTracks().forEach(t => t.stop());
  currentStream = null;
}

/* ----------------------------------------------------------
   BUTTON EVENTS
---------------------------------------------------------- */
document.getElementById("startBtn").addEventListener("click", startCamera);
async function tryDecodeWithRotations() {
  const rotations = [0, 90, 180, 270];

  for (const angle of rotations) {
    const result = await decodeFrame(angle);
    if (result) return result;
  }

  return null;
}
document.getElementById("flipBtn").addEventListener("click", () => {
  useFrontCamera = useFrontCamera;
  startCamera();
});

document.getElementById("uploadBtn").addEventListener("click", () => {
  document.getElementById("fileInput").click();
});

document.getElementById("fileInput").addEventListener("change", handleImageUpload);

document.getElementById("sendBtn").addEventListener("click", () => {
  if (!lastScan) {
    setStatus("No scan to signal.", "neutral");
    return;
  }

  setStatus("📡 Signal sent", "success");
  addToLedger("[SIGNAL] " + lastScan);
});
document.getElementById("photoBtn").addEventListener("click", takePhoto);

function takePhoto() {
  if (!currentStream) {
    setStatus("❌ Camera not active", "error");
    return;
  }

  // Draw the current frame to the canvas
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  // Convert canvas to image data
  const dataURL = canvas.toDataURL("image/png");

  // Show preview
  const preview = document.getElementById("photoPreview");
  preview.src = dataURL;
  preview.style.display = "block";

  setStatus("📸 Photo captured", "success");

  // Optional: save to ledger
  addToLedger("[PHOTO] " + new Date().toISOString());
}
/* ----------------------------------------------------------
   IMAGE UPLOAD HANDLING
---------------------------------------------------------- */
async function handleImageUpload(e) {
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
}

/* ----------------------------------------------------------
   CAMERA START — WITH PERMISSION + ERRORS
---------------------------------------------------------- */
async function startCamera() {
  setStatus("Requesting camera access...");

  // Browser support check
  if (!navigator.mediaDevices?.getUserMedia) {
    return setStatus("❌ This browser does not support camera access.", "error");
  }

  // HTTPS requirement
  if (location.protocol !== "https:" && location.hostname !== "localhost") {
    return setStatus("❌ Camera requires HTTPS.", "error");
  }

  stopStream();

  const constraints = {
    video: {
      facingMode: useFrontCamera ? "user" : { ideal: "environment" }
    }
  };

  try {
    currentStream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch (err) {
    if (err.name === "NotAllowedError") {
      return setStatus("❌ Camera blocked. Enable permissions.", "error");
    }
    if (err.name === "NotFoundError") {
      return setStatus("❌ No camera found.", "error");
    }
    return setStatus("❌ Camera error: " + err.message, "error");
  }

  video.srcObject = currentStream;

  video.onloadedmetadata = () => {
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
  };

  attachTapToFocus();
  setStatus("📷 Camera active", "success");

  startDecodeLoop();
}

/* ----------------------------------------------------------
   TAP‑TO‑FOCUS
---------------------------------------------------------- */
function attachTapToFocus() {
  video.onclick = async (e) => {
    if (!currentStream) return;

    const track = currentStream.getVideoTracks()[0];
    const capabilities = track.getCapabilities();

    if (!capabilities.focusMode) {
      return setStatus("⚠️ Tap‑to‑focus not supported.", "neutral");
    }

    const rect = video.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    try {
      await track.applyConstraints({
        advanced: [
          {
            focusMode: "single-shot",
            pointsOfInterest: [{ x, y }]
          }
        ]
      });

      setStatus("🔍 Focusing…", "neutral");
    } catch (err) {
      console.error(err);
      setStatus("❌ Focus failed", "error");
    }
  };
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

  // Pick front/back camera if possible
  let selectedDeviceId =
    devices.find(d => useFrontCamera
      ? d.label.toLowerCase().includes("front")
      : d.label.toLowerCase().includes("back")
    )?.deviceId || devices[0].deviceId;

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

  // Prevent rapid duplicate scans
  setTimeout(() => (scanCooldown = false), 1500);
}
