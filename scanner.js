/* ----------------------------------------------------------
   ELEMENTS
---------------------------------------------------------- */
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const statusEl = document.getElementById("status");
const payloadEl = document.getElementById("payload");
const scanIndicator = document.getElementById("scanIndicator");
const scanMessage = document.getElementById("scanMessage");

let currentStream = null;
let useFrontCamera = false;
let lastScan = "";
let scanCooldown = false;

/* ----------------------------------------------------------
   ZXING SETUP — Scan All Formats
---------------------------------------------------------- */
const hints = new Map();
hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, Object.values(ZXing.BarcodeFormat));

const codeReader = new ZXing.BrowserMultiFormatReader(hints);

/* ----------------------------------------------------------
   UTILITIES
---------------------------------------------------------- */
function setStatus(text, type = "neutral") {
  statusEl.textContent = text;
  statusEl.className = type;
}

function setScanMessageText(text, color = "#4fffe0") {
  scanMessage.textContent = text;
  scanMessage.style.color = color;
  scanMessage.style.textShadow = `0 0 10px ${color}`;
}

function setIndicator(state) {
  scanIndicator.className = "";
  if (state) scanIndicator.classList.add(state);
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
    setIndicator("error");
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
  setIndicator("scanning");
  setScanMessageText("Scanning…");

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
      height: { ideal: 1080 }
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
      setStatus("⚠️ Tap‑to‑focus not supported.", "neutral");
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
   DECODE LOOP — MANUAL CANVAS DECODE (MOST RELIABLE)
---------------------------------------------------------- */
function startDecodeLoop() {
  function loop() {
    if (!currentStream) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      const result = codeReader.decodeFromCanvas(canvas);
      if (result && !scanCooldown) {
        handleDecoded(result.text);
      } else {
        setScanMessageText("Scanning…");
        setIndicator("scanning");
      }
    } catch (err) {
      // ignore NotFound errors
    }

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}

/* ----------------------------------------------------------
   HANDLE DECODED PAYLOAD — With Confirmation
---------------------------------------------------------- */
function handleDecoded(data) {
  if (data === lastScan) return;

  lastScan = data;
  scanCooldown = true;

  payloadEl.textContent = data;
  setStatus("✅ Scan successful", "success");
  setScanMessageText("Scan detected!", "#00ff99");
  setIndicator("success");

  addToLedger(data);

  // Confirmation before opening links
  if (/^https?:\/\/.+/i.test(data)) {
    const ok = confirm(`Open this link?\n\n${data}`);
    if (ok) window.open(data, "_blank");
  }

  setTimeout(() => {
    scanCooldown = false;
    setScanMessageText("Scanning…");
    setIndicator("scanning");
  }, 1500);
}
