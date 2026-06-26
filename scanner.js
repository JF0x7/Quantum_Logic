/* ----------------------------------------------------------
   ELEMENTS
---------------------------------------------------------- */
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const statusEl = document.getElementById("status");
const payloadEl = document.getElementById("payload");
const previewEl = document.getElementById("photoPreview");
const scanIndicatorEl = document.getElementById("scanIndicator");
const ledgerEl = document.getElementById("ledger");

const startBtn = document.getElementById("startBtn");
const flipBtn = document.getElementById("flipBtn");
const uploadBtn = document.getElementById("uploadBtn");
const sendBtn = document.getElementById("sendBtn");
const photoBtn = document.getElementById("photoBtn");
const resetLedgerBtn = document.getElementById("resetLedgerBtn");
const fileInput = document.getElementById("fileInput");

let currentStream = null;
let lastScan = null;
let scanCooldown = false;
let currentDeviceIndex = 0;
let videoDevices = [];

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

function setScanIndicator(active) {
  scanIndicatorEl.className = active ? "active" : "";
}

function stopStream() {
  if (!currentStream) return;
  currentStream.getTracks().forEach(t => t.stop());
  currentStream = null;
}

/* ----------------------------------------------------------
   BUTTON EVENTS
---------------------------------------------------------- */
startBtn.addEventListener("click", startCamera);
flipBtn.addEventListener("click", flipCamera);
uploadBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", handleImageUpload);
photoBtn.addEventListener("click", takePhoto);

resetLedgerBtn.addEventListener("click", () => {
  if (typeof clearLedger === "function") {
    clearLedger();
  } else {
    ledgerEl.textContent = "";
  }
  setStatus("🔄 Ledger reset", "neutral");
});

sendBtn.addEventListener("click", () => {
  if (typeof sendSignal === "function") {
    sendSignal();
    setStatus("📡 Signal sent", "success");
  } else {
    setStatus("📡 Signal button pressed (no handler)", "neutral");
  }
});

/* ----------------------------------------------------------
   DEVICE ENUMERATION
---------------------------------------------------------- */
async function loadVideoDevices() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  videoDevices = devices.filter(d => d.kind === "videoinput");

  if (videoDevices.length === 0) {
    setStatus("❌ No cameras found.", "error");
  }
}

/* ----------------------------------------------------------
   CAMERA START — UNIVERSAL, PIKO-FRIENDLY
---------------------------------------------------------- */
async function startCamera() {
  setStatus("Requesting camera access...");
  stopStream();
  setScanIndicator(false);

  if (!navigator.mediaDevices?.getUserMedia) {
    return setStatus("❌ Camera not supported.", "error");
  }

  if (location.protocol !== "https:" && location.hostname !== "localhost") {
    return setStatus("❌ Camera requires HTTPS.", "error");
  }

  await loadVideoDevices();
  if (videoDevices.length === 0) return;

  // Prefer EMEET if present
  const piko = videoDevices.find(d => d.label.toLowerCase().includes("emeet"));
  if (piko) currentDeviceIndex = videoDevices.indexOf(piko);

  const selected = videoDevices[currentDeviceIndex];

  try {
    currentStream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: selected.deviceId } },
      audio: false
    });
  } catch (err) {
    return setStatus("❌ Camera error: " + err.message, "error");
  }

  video.srcObject = currentStream;

  video.onloadedmetadata = () => {
    video.play().catch(() => {});
    setTimeout(() => {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      startDecodeLoop();
    }, 200);
  };

  setStatus("📷 Camera active", "success");
}

/* ----------------------------------------------------------
   FLIP CAMERA — CYCLE THROUGH DEVICES
---------------------------------------------------------- */
async function flipCamera() {
  if (videoDevices.length <= 1) {
    return setStatus("ℹ Only one camera available.", "neutral");
  }

  currentDeviceIndex = (currentDeviceIndex + 1) % videoDevices.length;
  await startCamera();
}

/* ----------------------------------------------------------
   FRAME DECODE — CENTER CROP
---------------------------------------------------------- */
async function decodeFrame() {
  if (video.readyState < 2) return null;

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const cropWidth = Math.floor(canvas.width * 0.7);
  const cropHeight = Math.floor(canvas.height * 0.5);
  const cropX = Math.floor((canvas.width - cropWidth) / 2);
  const cropY = Math.floor((canvas.height - cropHeight) / 2);

  const imageData = ctx.getImageData(cropX, cropY, cropWidth, cropHeight);

  try {
    const luminance = new ZXing.RGBLuminanceSource(
      imageData.data,
      cropWidth,
      cropHeight
    );
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

  const loop = async () => {
    if (!currentStream) return;

    if (!scanCooldown) {
      const result = await decodeFrame();
      if (result) {
        handleDecoded(result.text);
      }
    }

    requestAnimationFrame(loop);
  };

  loop();
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
  setScanIndicator(true);

  if (typeof addToLedger === "function") {
    addToLedger(data);
  } else {
    const entry = document.createElement("div");
    entry.textContent = data;
    ledgerEl.appendChild(entry);
  }

  setTimeout(() => {
    scanCooldown = false;
    setScanIndicator(false);
  }, 800);
}

/* ----------------------------------------------------------
   TAKE PHOTO + DECODE
---------------------------------------------------------- */
function takePhoto() {
  if (!currentStream) {
    return setStatus("❌ Camera not active", "error");
  }

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const dataURL = canvas.toDataURL("image/png");
  previewEl.src = dataURL;
  previewEl.style.display = "block";

  decodeFromCanvas();
}

async function decodeFromCanvas() {
  try {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const luminance = new ZXing.RGBLuminanceSource(
      imageData.data,
      canvas.width,
      canvas.height
    );
    const bitmap = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(luminance));
    const result = codeReader.decodeBitmap(bitmap);

    handleDecoded(result.text);
    setStatus("📸 Photo decoded", "success");
  } catch {
    setStatus("❌ Could not decode photo", "error");
  }
}

/* ----------------------------------------------------------
   IMAGE UPLOAD SCANNING
---------------------------------------------------------- */
async function handleImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const imgURL = URL.createObjectURL(file);
  const img = new Image();
  img.src = imgURL;

  img.onload = async () => {
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    ctx.drawImage(img, 0, 0);

    previewEl.src = imgURL;
    previewEl.style.display = "block";

    await decodeFromCanvas();
    URL.revokeObjectURL(imgURL);
  };

  img.onerror = () => {
    setStatus("❌ Failed to load image", "error");
    URL.revokeObjectURL(imgURL);
  };
}
