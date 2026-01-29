// ------------------------------
// QTUM(LOG) Minimal Camera Test
// ------------------------------

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const statusEl = document.getElementById("status");
const payloadEl = document.getElementById("payload");

let stream = null;

// Force camera request on button click
document.getElementById("startBtn").addEventListener("click", startCamera);

// Flip camera
let useFront = false;
document.getElementById("flipBtn").addEventListener("click", () => {
  useFront = !useFront;
  startCamera();
});

// Start camera
async function startCamera() {
  statusEl.textContent = "Requesting camera...";
  statusEl.className = "neutral";

  // Stop old stream
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
  }

  // IMPORTANT: Simplest possible constraints
  const constraints = {
    video: {
      facingMode: useFront ? "user" : "environment"
    },
    audio: false
  };

  console.log("Requesting camera with constraints:", constraints);

  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);

    console.log("Camera stream received:", stream);

    video.srcObject = stream;
    statusEl.textContent = "Camera active";
    statusEl.className = "success";

    requestAnimationFrame(scanLoop);

  } catch (err) {
    console.error("Camera error:", err);

    statusEl.textContent = "Camera error: " + err.name;
    statusEl.className = "error";

    // Show specific reasons
    if (err.name === "NotAllowedError") {
      statusEl.textContent = "Permission denied. Check browser settings.";
    }
    if (err.name === "NotFoundError") {
      statusEl.textContent = "No camera found.";
    }
    if (err.name === "OverconstrainedError") {
      statusEl.textContent = "Camera mode not supported.";
    }
  }
}

// Scan loop (kept simple)
function scanLoop() {
  if (!video.videoWidth) {
    requestAnimationFrame(scanLoop);
    return;
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  ctx.drawImage(video, 0, 0);

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const code = jsQR(img.data, canvas.width, canvas.height);

  if (code) {
    payloadEl.textContent = code.data;
    statusEl.textContent = "QR detected!";
    statusEl.className = "success";
  }

  requestAnimationFrame(scanLoop);
}
