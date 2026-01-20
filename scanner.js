const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const statusEl = document.getElementById("status");
const payloadEl = document.getElementById("payload");

const startBtn = document.getElementById("startBtn");
const fileInput = document.getElementById("fileInput");
const sendBtn = document.getElementById("sendBtn");

let currentStream = null;
let useFrontCamera = false;
let scanning = false;

function isQtumAddress(text) {
  return /^Q[0-9A-Za-z]{25,40}$/.test(text.trim());
}

async function stopCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach(t => t.stop());
    currentStream = null;
  }
  scanning = false;
}

async function startCamera() {
  await stopCamera();

  const constraints = {
    video: {
      facingMode: useFrontCamera ? { ideal: "user" } : { ideal: "environment" }
    }
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    currentStream = stream;
    video.srcObject = stream;
    scanning = true;
    requestAnimationFrame(scanLoop);
  } catch (err) {
    statusEl.textContent = "Camera error: " + err.message;
    statusEl.className = "invalid";
  }
}

function scanLoop() {
  if (!scanning || !video.videoWidth) {
    requestAnimationFrame(scanLoop);
    return;
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0);

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const code = jsQR(img.data, img.width, img.height);

  if (code && code.data) {
    const text = code.data.trim();
    payloadEl.textContent = text;

    if (isQtumAddress(text)) {
      statusEl.textContent = "Qtum address detected.";
      statusEl.className = "valid";

      sendBtn.style.display = "inline-block";
      sendBtn.onclick = () => sendQtum(text);

    } else {
      statusEl.textContent = "QR code detected.";
      statusEl.className = "neutral";
      sendBtn.style.display = "none";
    }
  }

  requestAnimationFrame(scanLoop);
}

uploadBtn.onclick = () => fileInput.click();

fileInput.onchange = e => {
  const file = e.target.files[0];
  if (!file) return;

  const img = new Image();
  img.onload = () => {
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(data.data, data.width, data.height);

    if (code && code.data) {
      const text = code.data.trim();
      payloadEl.textContent = text;

      if (isQtumAddress(text)) {
        statusEl.textContent = "Qtum address detected.";
        statusEl.className = "valid";
        sendBtn.style.display = "inline-block";
        sendBtn.onclick = () => sendQtum(text);
      }
    }
  };

  img.src = URL.createObjectURL(file);
};

startBtn.onclick = startCamera;

flipBtn.onclick = () => {
  useFrontCamera = !useFrontCamera;
  startCamera();
};
