/* ----------------------------------------------------------
   ELEMENTS
---------------------------------------------------------- */
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const statusEl = document.getElementById("status");
const payloadEl = document.getElementById("payload");

let currentStream = null;
let useFrontCamera = false;
let lastScan = "";
let scanCooldown = false;

/* ----------------------------------------------------------
   ZXING SETUP — Scan All Formats
---------------------------------------------------------- */
const hints = new Map();
hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
hints.set(
  ZXing.DecodeHintType.POSSIBLE_FORMATS,
  Object.values(ZXing.BarcodeFormat)
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
   CAMERA START — WITH PERMISSION + ERRORS
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
    video: {
      facingMode: useFrontCamera ? "user" : { ideal: "environment" },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      advanced: [{ focusMode: "continuous" }]
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
  startAutoRefocus();

  setStatus("📷 Camera active", "success");
  startDecodeLoop();
}

/* ----------------------------------------------------------
   TAP‑TO‑FOCUS (Improved)
---------------------------------------------------------- */
function attachTapToFocus() {
  video.onclick = async (e) => {
    if (!currentStream) return;

    const track = currentStream.getVideoTracks()[0];
    const capabilities = track.getCapabilities();

    const supportsFocus =
      capabilities.focusMode &&
      (capabilities.focusMode.includes("single-shot") ||
       capabilities.focusMode.includes("continuous"));

    if (!supportsFocus) {
      setStatus("⚠️ Tap‑to‑focus not supported on this device.", "neutral");
      return;
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
   AUTO REFOCUS PULSE
---------------------------------------------------------- */
function startAutoRefocus() {
  setInterval(() => {
    if (!currentStream) return;
    const track = currentStream.getVideoTracks()[0];
    const capabilities = track.getCapabilities();
    if (!capabilities.focusMode) return;

    try {
      track.applyConstraints({
        advanced: [{ focusMode: "continuous" }]
      });
    } catch {}
  }, 2000);
}

/* ----------------------------------------------------------
   DECODE LOOP — Center Crop + Contrast Boost
---------------------------------------------------------- */
async function startDecodeLoop() {
  codeReader.reset();

  function processFrame() {
    if (!currentStream) return;

    drawCenterCrop();
    enhanceFrame();

    try {
      const result = codeReader.decodeFromCanvas(canvas);
      if (result && !scanCooldown) {
        handleDecoded(result.text);
      }
    } catch (err) {
      // ignore NotFound errors
    }

    requestAnimationFrame(processFrame);
  }

  requestAnimationFrame(processFrame);
}

/* ----------------------------------------------------------
   CENTER CROP
---------------------------------------------------------- */
function drawCenterCrop() {
  const w = canvas.width * 0.6;
  const h = canvas.height * 0.6;
  const x = (canvas.width - w) / 2;
  const y = (canvas.height - h) / 2;

  ctx.drawImage(video, x, y, w, h, 0, 0, canvas.width, canvas.height);
}

/* ----------------------------------------------------------
   CONTRAST BOOST
---------------------------------------------------------- */
function enhanceFrame() {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    data[i] *= 1.1;
    data[i + 1] *= 1.1;
    data[i + 2] *= 1.1;
  }

  ctx.putImageData(imageData, 0, 0);
}

/* ----------------------------------------------------------
   HANDLE DECODED PAYLOAD — With Auto‑Open Links
---------------------------------------------------------- */
function handleDecoded(data) {
  if (data === lastScan) return;

  lastScan = data;
  scanCooldown = true;

  payloadEl.textContent = data;
  setStatus("✅ Scan successful", "success");

  addToLedger(data);

  if (/^https?:\/\/.+/i.test(data)) {
    window.open(data, "_blank");
  }

  setTimeout(() => (scanCooldown = false), 1500);
}
