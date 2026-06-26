/* ----------------------------------------------------------
   ELEMENTS
---------------------------------------------------------- */
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const statusEl = document.getElementById("status");
const payloadEl = document.getElementById("payload");
const preview = document.getElementById("photoPreview");

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
   RESET BUTTON — FULL RESET
---------------------------------------------------------- */
document.getElementById("resetBtn").addEventListener("click", () => {
  stopStream();

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  payloadEl.textContent = "";
  preview.src = "";
  preview.style.display = "none";

  lastScan = null;
  scanCooldown = false;

  if (typeof clearLedger === "function") clearLedger();

  setStatus("🔄 Reset complete", "neutral");
});

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

  const imgURL = URL.createObjectURL(file);
  const img = new Image();
  img.src = imgURL;

  img.onload = async () => {
    const maxDim = 2000;
    const scale = Math.min(maxDim / img.naturalWidth, maxDim / img.naturalHeight, 1);

    canvas.width = img.naturalWidth * scale;
    canvas.height = img.naturalHeight * scale;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

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
      setStatus("✅ Image decoded", "success");
    } catch (err) {
      setStatus("❌ Image decode failed", "error");
    } finally {
      URL.revokeObjectURL(imgURL);
    }
  };
}

/* ----------------------------------------------------------
   UNIVERSAL CAMERA START — Works with ALL webcams
---------------------------------------------------------- */
async function startCamera() {
  setStatus("Requesting camera access...");

  stopStream();

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return setStatus("❌ Camera not supported on this device.", "error");
  }

  if (location.protocol !== "https:" && location.hostname !== "localhost") {
    return setStatus("❌ Camera requires HTTPS.", "error");
  }

  let constraints = {
    video: {
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      facingMode: useFrontCamera ? "user" : "environment"
    },
    audio: false
  };

  try {
    currentStream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch (err) {
    // fallback for USB webcams like Piko
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cams = devices.filter(d => d.kind === "videoinput");

    if (cams.length > 0) {
      currentStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: cams[0].deviceId },
        audio: false
      });
    } else {
      return setStatus("❌ No cameras found.", "error");
    }
  }

  video.srcObject = currentStream;

  video.onloadedmetadata = () => {
    video.play().catch(() => {});
    setTimeout(() => {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
    }, 200);
  };

  setStatus("📷 Camera active", "success");
  startDecodeLoop();
}

/* ----------------------------------------------------------
   FRAME DECODE — Center Crop
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
      if (result) handleDecoded(result.text);
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

  if (typeof addToLedger === "function") addToLedger(data);

  setTimeout(() => (scanCooldown = false), 800);
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
  preview.src = dataURL;
  preview.style.display = "block";

  // Decode the captured photo
  handleImageUploadFromCanvas();
}

async function handleImageUploadFromCanvas() {
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
