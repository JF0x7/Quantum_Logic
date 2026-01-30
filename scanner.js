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

  const imgURL = URL.createObjectURL(file);

  try {
    const result = await codeReader.decodeFromImageUrl(imgURL);
    handleDecoded(result.text);
  } catch {
    statusEl.textContent = "❌ Scan failed";
    statusEl.className = "error";
  }
});

document.getElementById("sendBtn").addEventListener("click", () => {
  if (!lastScan) {
    statusEl.textContent = "No scan to signal.";
    statusEl.className = "neutral";
    return;
  }

  console.log("Sending signal for payload:", lastScan);

  statusEl.textContent = "📡 Signal sent for last scan";
  statusEl.className = "success";

  addToLedger("[SIGNAL] " + lastScan);
});

/* ----------------------------------------------------------
   CAMERA START
---------------------------------------------------------- */
async function startCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    statusEl.textContent = "Camera not supported in this browser.";
    statusEl.className = "error";
    return;
  }

  if (location.protocol !== "https:" && location.hostname !== "localhost") {
    statusEl.textContent = "Camera requires HTTPS (or localhost).";
    statusEl.className = "error";
    return;
  }

  statusEl.textContent = "Requesting camera...";
  statusEl.className = "neutral";

  if (currentStream) {
    currentStream.getTracks().forEach(t => t.stop());
    currentStream = null;
  }

  // First attempt: facingMode (works on most)
  let constraints = {
    video: {
      facingMode: useFrontCamera ? "user" : { ideal: "environment" }
    }
  };

  try {
    currentStream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch (err) {
    console.warn("FacingMode failed, falling back to generic video:", err.name);

    // Fallback: generic video (Samsung Internet sometimes prefers this)
    constraints = { video: true };
    try {
      currentStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err2) {
      statusEl.textContent = "Camera error: " + err2.name;
      statusEl.className = "error";
      return;
    }
  }

  video.srcObject = currentStream;

  statusEl.textContent = "Camera active";
  statusEl.className = "success";

  video.onloadedmetadata = () => {
    canvas.width = video.videoWidth || canvas.clientWidth;
    canvas.height = video.videoHeight || canvas.clientHeight;
  };

  startDecodeLoop();
}

/* ----------------------------------------------------------
   DECODE LOOP (Samsung‑friendly)
---------------------------------------------------------- */
function startDecodeLoop() {
  console.log("decode loop running");

  // Important for Samsung / multiple restarts
  codeReader.reset();

  // Use element instead of ID string for better compatibility
  codeReader.decodeFromVideoDevice(undefined, video, (result, err) => {
    if (result && !scanCooldown) {
      handleDecoded(result.text);
    }

    // Ignore "NotFoundException" (no code in frame)
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
  statusEl.textContent = "✅ Scan successful";
  statusEl.className = "success";

  addToLedger(data);

  setTimeout(() => {
    scanCooldown = false;
  }, 1500);
}
