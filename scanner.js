// ------------------------------
// QTUM(LOG) Quantum Scanner Engine
// ------------------------------

let video = document.getElementById("video");
let canvas = document.getElementById("canvas");
let ctx = canvas.getContext("2d");

let currentStream = null;
let useFrontCamera = false;

const statusEl = document.getElementById("status");
const payloadEl = document.getElementById("payload");
const ledgerEl = document.getElementById("ledger");

// Prevent duplicate spam
let lastScan = "";
let scanCooldown = false;

// Start camera
async function startCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach(t => t.stop());
  }

  const constraints = {
    video: { facingMode: useFrontCamera ? "user" : "environment" }
  };

  try {
    currentStream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = currentStream;
    statusEl.textContent = "Camera active";
    statusEl.className = "neutral";
    scanLoop();
  } catch (err) {
    statusEl.textContent = "Camera unavailable or permission denied.";
    statusEl.className = "error";
  }
}

// Flip camera
document.getElementById("flipBtn").addEventListener("click", () => {
  useFrontCamera = !useFrontCamera;
  startCamera();
});

// Enable camera
document.getElementById("startBtn").addEventListener("click", () => {
  startCamera();
});

// Scan loop
function scanLoop() {
  requestAnimationFrame(scanLoop);

  if (video.readyState !== video.HAVE_ENOUGH_DATA) return;

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const code = jsQR(imageData.data, canvas.width, canvas.height);

  if (code && !scanCooldown) {
    handleDecoded(code.data);
  }
}

// Handle decoded QR
function handleDecoded(data) {
  if (data === lastScan) return;

  lastScan = data;
  scanCooldown = true;

  payloadEl.textContent = data;
  statusEl.textContent = "QR detected!";
  statusEl.className = "success";

  addToLedger(data);

  setTimeout(() => {
    scanCooldown = false;
  }, 1500);
}

// Ledger
function addToLedger(data) {
  const item = document.createElement("div");
  item.className = "ledgerItem";

  const payload = document.createElement("div");
  payload.className = "ledgerPayload";
  payload.textContent = data;

  const time = document.createElement("div");
  time.className = "ledgerTime";
  time.textContent = new Date().toLocaleString();

  item.appendChild(payload);
  item.appendChild(time);

  ledgerEl.prepend(item);
}

// File upload scanning
document.getElementById("uploadBtn").addEventListener("click", () => {
  document.getElementById("fileInput").click();
});

document.getElementById("fileInput").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;

  const img = new Image();
  img.src = URL.createObjectURL(file);

  img.onload = () => {
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, canvas.width, canvas.height);

    if (code) {
      handleDecoded(code.data);
    } else {
      statusEl.textContent = "No QR code found in image.";
      statusEl.className = "error";
    }
  };
});
