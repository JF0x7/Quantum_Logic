/**
 * Quantum Scanner Engine — ZXing + QAI + Ledger (iPhone 6 Compatible)
 * Rebuilt full file with:
 * - iPhone 6 Safari fixes
 * - ZXing fallback decode loop
 * - Safe constraints for old WebKit
 * - AudioContext patch
 * - Canvas size patch
 * - QAI + Ledger integration
 * - Performance mode for Raspberry Pi
 */

const CONFIG = {
  cooldown: 2500,
  vibrate: true,
  autoRedirect: true,
  beep: { freq: 950, volume: 0.05, duration: 0.08 },
  maxRetries: 2,
  frameRate: { ideal: 15, max: 20 },
  resolution: { width: 640, height: 480 },
  debug: false
};

const state = {
  deviceId: null,
  devices: [],
  reader: null,
  cooldown: false,
  lastScan: null,
  ready: false,
  isMobile: false,
  isRaspberryPi: false,
  retryCount: 0,
  performanceMode: false,
  facingModeIndex: 0
};

const el = {
  video: document.getElementById("video"),
  payload: document.getElementById("payload"),
  status: document.getElementById("status"),
  start: document.getElementById("startBtn"),
  flip: document.getElementById("flipBtn"),
  upload: document.getElementById("uploadBtn"),
  send: document.getElementById("sendBtn"),
  photo: document.getElementById("photoBtn"),
  resetLedger: document.getElementById("resetLedgerBtn"),
  fileInput: document.getElementById("fileInput"),
  canvas: document.getElementById("canvas"),
  photoPreview: document.getElementById("photoPreview")
};

const ledger = new QuantumLedger("ledger");
const brain = new Qai();

/* -------------------------------------------------------------
   DEVICE DETECTION
------------------------------------------------------------- */
function detectDevice() {
  const ua = navigator.userAgent || navigator.vendor || window.opera;

  if (/iPhone|iPad|iPod/.test(ua)) {
    state.isMobile = true;

    if (window.screen.width <= 750 && window.screen.height <= 1334) {
      CONFIG.resolution = { width: 480, height: 360 };
      CONFIG.frameRate = { ideal: 10, max: 15 };
      state.performanceMode = true;
    }
  }

  if (/Raspberry|Pi|armv7l|armv6l/.test(ua) || navigator.hardwareConcurrency <= 4) {
    state.isRaspberryPi = true;
    CONFIG.resolution = { width: 320, height: 240 };
    CONFIG.frameRate = { ideal: 8, max: 12 };
    CONFIG.cooldown = 3000;
    CONFIG.vibrate = false;
    state.performanceMode = true;
  }
}

/* -------------------------------------------------------------
   STATUS
------------------------------------------------------------- */
function setStatus(msg, type = "neutral") {
  if (el.status) {
    el.status.textContent = `Status: ${msg}`;
    el.status.className = `status ${type}`;
  }
}

/* -------------------------------------------------------------
   BEEP (iPhone 6 safe)
------------------------------------------------------------- */
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.frequency.value = CONFIG.beep.freq;
    gain.gain.value = CONFIG.beep.volume;

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + CONFIG.beep.duration);

    setTimeout(() => {
      try { ctx.close(); } catch (_) {}
    }, 500);
  } catch (_) {}
}

/* -------------------------------------------------------------
   PERFORMANCE OPTIMIZATION
------------------------------------------------------------- */
function optimizeForDevice() {
  let updateTimeout = null;

  const throttledSetStatus = (msg, type) => {
    if (updateTimeout) return;
    updateTimeout = setTimeout(() => {
      setStatus(msg, type);
      updateTimeout = null;
    }, state.performanceMode ? 200 : 50);
  };

  if (state.performanceMode) {
    setInterval(() => {
      if (el.canvas) {
        const ctx = el.canvas.getContext("2d");
        ctx.clearRect(0, 0, el.canvas.width, el.canvas.height);
      }
    }, 30000);
  }

  return throttledSetStatus;
}

const throttledSetStatus = optimizeForDevice();

/* -------------------------------------------------------------
   INIT
------------------------------------------------------------- */
async function init() {
  detectDevice();

  if (state.performanceMode) {
    setStatus(`⚡ Performance mode (${state.isRaspberryPi ? "RPi" : "iPhone 6"})`);
  }

  if (typeof ZXing === "undefined") {
    setStatus("ZXing missing", "error");
    return;
  }

  const hints = new Map();
  hints.set(ZXing.DecodeHintType.TRY_HARDER, !state.performanceMode);
  hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
    ZXing.BarcodeFormat.QR_CODE,
    ZXing.BarcodeFormat.DATA_MATRIX,
    ZXing.BarcodeFormat.EAN_13,
    ZXing.BarcodeFormat.EAN_8,
    ZXing.BarcodeFormat.UPC_A,
    ZXing.BarcodeFormat.CODE_128,
    ZXing.BarcodeFormat.CODE_39,
    ZXing.BarcodeFormat.PDF_417,
    ZXing.BarcodeFormat.AZTEC,
    ZXing.BarcodeFormat.ITF,
    ZXing.BarcodeFormat.CODABAR
  ]);

  try {
    state.reader = new ZXing.BrowserMultiFormatReader(hints);
    state.ready = true;
  } catch (e) {
    setStatus(`Init error: ${e.message}`, "error");
    return;
  }

  if (el.video) {
    Object.assign(el.video, {
      autoplay: true,
      playsinline: true,
      muted: true
    });
  }

  bindEvents();
  setStatus("Ready");

  if (state.isMobile) {
    setTimeout(start, 500);
  }
}

/* -------------------------------------------------------------
   SAFE CONSTRAINTS (iPhone 6 compatible)
------------------------------------------------------------- */
function getVideoConstraints() {
  const isOldIOS =
    /iPhone|iPad|iPod/.test(navigator.userAgent) &&
    !navigator.mediaDevices;

  if (isOldIOS) {
    return {
      video: {
        facingMode: "environment",
        width: 480,
        height: 360
      }
    };
  }

  return {
    video: {
      deviceId: state.deviceId ? { exact: state.deviceId } : undefined,
      facingMode: state.deviceId ? undefined : "environment",
      width: { ideal: CONFIG.resolution.width, max: CONFIG.resolution.width * 1.2 },
      height: { ideal: CONFIG.resolution.height, max: CONFIG.resolution.height * 1.2 },
      frameRate: CONFIG.frameRate
    }
  };
}

/* -------------------------------------------------------------
   START CAMERA
------------------------------------------------------------- */
async function start() {
  if (!state.ready) return setStatus("Not ready", "error");

  setStatus("Starting…");
  if (state.reader) state.reader.reset();

  try {
    const devices = await state.reader.listVideoInputDevices();
    state.devices = devices;

    if (!devices.length) return fallbackStart();

    if (!state.deviceId) {
      const rear = devices.find(d => /back|rear|environment/i.test(d.label));
      const front = devices.find(d => /front|user/i.test(d.label));
      state.deviceId = rear ? rear.deviceId : (front ? front.deviceId : devices[0].deviceId);
    }

    const constraints = getVideoConstraints();
    await startReader(constraints);

  } catch (e) {
    await fallbackStart();
  }
}

/* -------------------------------------------------------------
   START READER (iPhone 6 fallback)
------------------------------------------------------------- */
async function startReader(constraints) {
  const isOldIOS =
    /iPhone|iPad|iPod/.test(navigator.userAgent) &&
    !navigator.mediaDevices;

  if (isOldIOS) return fallbackStart();

  return new Promise((resolve, reject) => {
    try {
      state.reader.decodeFromConstraints(constraints, el.video, (result, err) => {
        if (result) handleScan(result.getText());
      });

      setStatus("Scanning…");
      resolve();
    } catch (e) {
      reject(e);
    }
  });
}

/* -------------------------------------------------------------
   FALLBACK CAMERA (iPhone 6 safe)
------------------------------------------------------------- */
async function fallbackStart() {
  setStatus("Fallback camera…");

  try {
    const constraints = {
      video: {
        facingMode: "environment",
        width: CONFIG.resolution.width,
        height: CONFIG.resolution.height
      }
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);

    el.video.srcObject = stream;

    el.video.onloadedmetadata = () => {
      try { el.video.play(); } catch (_) {}
    };

    setStatus("Fallback camera active");
    fallbackDecodeLoop();

  } catch (e) {
    setStatus(`Camera error: ${e.message}`, "error");
  }
}

/* -------------------------------------------------------------
   FALLBACK DECODE LOOP (iPhone 6 safe)
------------------------------------------------------------- */
let fallbackLoopRunning = false;

function fallbackDecodeLoop() {
  if (fallbackLoopRunning) return;
  fallbackLoopRunning = true;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  function captureFrame() {
    if (!el.video || el.video.paused || el.video.ended) {
      fallbackLoopRunning = false;
      return;
    }

    try {
      const w = el.video.videoWidth || CONFIG.resolution.width;
      const h = el.video.videoHeight || CONFIG.resolution.height;

      canvas.width = Math.min(w, 640);
      canvas.height = Math.min(h, 480);

      ctx.drawImage(el.video, 0, 0, canvas.width, canvas.height);

      state.reader.decodeFromCanvas(canvas).then(result => {
        if (result) handleScan(result.getText());
      }).catch(() => {});
    } catch (_) {}

    setTimeout(captureFrame, state.performanceMode ? 1000 : 500);
  }

  setTimeout(captureFrame, 500);
}

/* -------------------------------------------------------------
   HANDLE SCAN
------------------------------------------------------------- */
async function handleScan(data) {
  if (state.cooldown && data === state.lastScan) return;

  state.lastScan = data;
  state.cooldown = true;

  el.payload.textContent = data;
  setStatus("Decoded!", "success");

  if (CONFIG.vibrate && navigator.vibrate) {
    try { navigator.vibrate(80); } catch (_) {}
  }

  beep();

  try {
    const analysis = await Promise.race([
      brain.process(data),
      new Promise((_, reject) => setTimeout(() => reject(new Error("QAI timeout")), 3000))
    ]);

    ledger.addEntry(data, "SCAN", {
      type: analysis.format ? `${analysis.format.name} (${analysis.format.type})` : analysis.type,
      pattern: analysis.pattern,
      explanation: analysis.explanation,
      entropy: analysis.entropy
    });

  } catch (e) {
    ledger.addEntry(data, "SCAN", { error: e.message });
    setStatus("Logged (QAI skipped)");
  }

  if (CONFIG.autoRedirect) {
    try {
      const isUrl = /^https?:\/\/[^\s]+/i.test(data);
      const url = isUrl ? data : `https://www.google.com/search?q=${encodeURIComponent(data)}`;
      location.href = url;
    } catch (_) {}
  }

  setTimeout(() => { state.cooldown = false; }, CONFIG.cooldown);
}

/* -------------------------------------------------------------
   EVENTS
------------------------------------------------------------- */
function bindEvents() {
  const events = ["click", "touchstart"];

  events.forEach(ev => {
    el.start?.addEventListener(ev, start);
    el.flip?.addEventListener(ev, flip);
    el.photo?.addEventListener(ev, capturePhoto);
    el.send?.addEventListener(ev, handleSend);
    el.resetLedger?.addEventListener(ev, () => ledger.clear());
  });

  el.upload?.addEventListener("click", () => el.fileInput.click());
  el.fileInput?.addEventListener("change", handleFileUpload);
}

/* -------------------------------------------------------------
   PHOTO CAPTURE
------------------------------------------------------------- */
function capturePhoto() {
  if (!el.video || !el.canvas) return;

  const ctx = el.canvas.getContext("2d");
  const w = Math.min(el.video.videoWidth || CONFIG.resolution.width, 640);
  const h = Math.min(el.video.videoHeight || CONFIG.resolution.height, 480);

  el.canvas.width = w;
  el.canvas.height = h;

  ctx.drawImage(el.video, 0, 0, w, h);

  el.photoPreview.src = el.canvas.toDataURL("image/png");
  el.photoPreview.style.display = "block";

  if (state.isMobile) {
    setTimeout(() => el.photoPreview.style.display = "none", 5000);
  }
}

/* -------------------------------------------------------------
   FILE UPLOAD
------------------------------------------------------------- */
async function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  setStatus("Processing image…");

  const url = URL.createObjectURL(file);

  try {
    const result = await state.reader.decodeFromImageUrl(url);
    await handleScan(result.getText());
  } catch (_) {
    setStatus("Upload decode failed", "error");
  } finally {
    URL.revokeObjectURL(url);
    el.fileInput.value = "";
  }
}

/* -------------------------------------------------------------
   MANUAL SEND
------------------------------------------------------------- */
async function handleSend() {
  const data = el.payload.textContent || "";
  if (!data) return setStatus("No payload", "error");

  setStatus("Analyzing…");

  try {
    const analysis = await brain.process(data);
    ledger.addEntry(data, "MANUAL", {
      type: analysis.format ? `${analysis.format.name} (${analysis.format.type})` : analysis.type,
      pattern: analysis.pattern,
      explanation: analysis.explanation,
      entropy: analysis.entropy
    });

    setStatus("Logged", "success");

  } catch (e) {
    ledger.addEntry(data, "MANUAL", { error: e.message });
    setStatus("QAI failed", "error");
  }
}

/* -------------------------------------------------------------
   BOOTSTRAP
------------------------------------------------------------- */
document.readyState === "loading"
  ? document.addEventListener("DOMContentLoaded", init)
  : init();

/* -------------------------------------------------------------
   MEMORY CLEANUP
------------------------------------------------------------- */
window.addEventListener("beforeunload", () => {
  try { state.reader?.reset(); } catch (_) {}
  try { el.video?.srcObject?.getTracks().forEach(t => t.stop()); } catch (_) {}
});

/* -------------------------------------------------------------
   DEBUG API
------------------------------------------------------------- */
window.__scanner = {
  state,
  CONFIG,
  start,
  stop,
  flip,
  ledger,
  handleScan,
  detectDevice
};
