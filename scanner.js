/* ----------------------------------------------------------
   ELEMENTS
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
   ZXING SETUP — QR + ALL BARCODES
---------------------------------------------------------- */
const hints = new Map();
hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
hints.set(
  ZXing.DecodeHintType.POSSIBLE_FORMATS,
  [
    ZXing.BarcodeFormat.QR_CODE,
    ZXing.BarcodeFormat.DATA_MATRIX,
    ZXing.BarcodeFormat.AZTEC,
    ZXing.BarcodeFormat.PDF_417,
    ZXing.BarcodeFormat.EAN_13,
    ZXing.BarcodeFormat.EAN_8,
    ZXing.BarcodeFormat.UPC_A,
    ZXing.BarcodeFormat.UPC_E,
    ZXing.BarcodeFormat.CODE_128,
    ZXing.BarcodeFormat.CODE_39,
    ZXing.BarcodeFormat.ITF,
    ZXing.BarcodeFormat.CODABAR,
  ]
);

const codeReader = new ZXing.BrowserMultiFormatReader(hints);

/* ----------------------------------------------------------
   UI HELPERS
---------------------------------------------------------- */
function setStatus(text, type = "neutral") {
  statusEl.textContent = text;
  statusEl.className = type;
}

function stopStream() {
  if (!currentStream) return;
  currentStream.getTracks().forEach(t => t.stop());
  currentStream = null;
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
document.getElementById("fileInput").addEventListener("change", handleImageUpload);
document.getElementById("photoBtn").addEventListener("click", takePhoto);

/* ----------------------------------------------------------
   IMAGE UPLOAD SCANNING
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
   CAMERA START
---------------------------------------------------------- */
async function startCamera() {
  setStatus("Requesting camera access...");

  if (!navigator.mediaDevices?.getUserMedia) {
    return setStatus("❌ Browser does not support camera.", "error");
  }

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
    if (err.name === "NotAllowedError") return setStatus("❌ Camera blocked.", "error");
    if (err.name === "NotFoundError") return setStatus("❌ No camera found.", "error");
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
    const caps = track.getCapabilities();

    if (!caps.focusMode) {
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
   ROTATION‑AWARE DECODING
---------------------------------------------------------- */
async function tryDecodeWithRotations() {
  const angles = [0, 90, 180, 270];

  for (const angle of angles) {
    const result = await decodeFrame(angle);
    if (result) return result;
  }

  return null;
}

async function decodeFrame(angle) {
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((angle * Math.PI) / 180);
  ctx.drawImage(video, -canvas.width / 2, -canvas.height / 2);
  ctx.restore();

  try {
    const luminance = new ZXing.HTMLCanvasElementLuminanceSource(canvas);
    const bitmap = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(luminance));
    return codeReader.decodeBitmap(bitmap);
  } catch {
    return null;
  }
}

/* ----------------------------------------------------------
   DECODE LOOP
---------------------------------------------------------- */
async function startDecodeLoop() {
  codeReader.reset();

  let devices;
  try {
    devices = await codeReader.listVideoInputDevices();
  } catch {
    return setStatus("❌ Unable to list cameras.", "error");
  }

  if (!devices.length) {
    return setStatus("❌ No camera devices detected.", "error");
  }

  let selectedDeviceId =
    devices.find(d =>
      useFrontCamera
        ? d.label.toLowerCase().includes("front")
        : d.label.toLowerCase().includes("back")
    )?.deviceId || devices[0].deviceId;

  try {
    codeReader.decodeFromVideoDevice(selectedDeviceId, video, async () => {
      if (!scanCooldown) {
        const result = await tryDecodeWithRotations();
        if (result) handleDecoded(result.text);
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

  if (typeof addToLedger === "function") {
    addToLedger(data);
  }

  setTimeout(() => (scanCooldown = false), 1500);
}

/* ----------------------------------------------------------
   TAKE PHOTO
---------------------------------------------------------- */
function takePhoto() {
  if (!currentStream) {
    return setStatus("❌ Camera not active", "error");
  }

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const dataURL = canvas.toDataURL("image/png");

  const preview = document.getElementById("photoPreview");
  if (preview) {
    preview.src = dataURL;
    preview.style.display = "block";
  }

  setStatus("📸 Photo captured", "success");
}
