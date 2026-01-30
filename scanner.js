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

/* ----------------------------------------------------------
   CAMERA START
---------------------------------------------------------- */
async function startCamera() {
  statusEl.textContent = "Requesting camera...";
  statusEl.className = "neutral";

  // Stop previous stream
  if (currentStream) {
    currentStream.getTracks().forEach(t => t.stop());
  }

  // Clean, single constraints block
  const constraints = {
    video: {
      facingMode: useFrontCamera ? "user" : { ideal: "environment" }
    }
  };

  try {
    currentStream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = currentStream;

    statusEl.textContent = "Camera active";
    statusEl.className = "success";

    decodeLoop();
  } catch (err) {
    statusEl.textContent = "Camera error: " + err.name;
    statusEl.className = "error";
  }
}

/* ----------------------------------------------------------
   DECODE LOOP
---------------------------------------------------------- */
function decodeLoop() {
  console.log("decode loop running");

  codeReader.decodeFromVideoDevice(null, "video", (result, err) => {
    if (result && !scanCooldown) {
      handleDecoded(result.text);
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

  setTimeout(() => scanCooldown = false, 1500);
}
