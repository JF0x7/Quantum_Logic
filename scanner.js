// ------------------------------
// QTUM(LOG) Scanner Engine
// ------------------------------

let video = document.getElementById("video");
let canvas = document.getElementById("canvas");
let ctx = canvas.getContext("2d");

let currentStream = null;
let useFrontCamera = false;

// UI elements
const statusEl = document.getElementById("status");
const payloadEl = document.getElementById("payload");

// Start camera
async function startCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach(t => t.stop());
  }

  const constraints = {
    video: {
      facingMode: useFrontCamera ? "user" : "environment"
    }
  };

  currentStream = await navigator.mediaDevices.getUserMedia(constraints);
  video.srcObject = currentStream;

  scanLoop();
}

// Flip camera
document.getElementById("flipBtn").addEventListener("click", () => {
  useFrontCamera = !useFrontCamera;
  startCamera();
});

// Enable camera button
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

  if (code) {
    handleDecoded(code.data);
  }
}

// Handle decoded QR
function handleDecoded(data) {
  payloadEl.textContent = data;
  statusEl.textContent = "QR detected!";
  statusEl.className = "success";

  // QTUM-style detection
  if (/^(Q|q)[A-Za-z0-9]{20,}/.test(data)) {
    addToLedger(data);
  }
}

// File upload scanning
document.getElementById("uploadBtn").addEventListener("click", () => {
  document.getElementById("fileInput").click();
});

document.getElementById("fileInput").addEventListener("change", async e => {
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
