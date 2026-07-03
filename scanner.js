/**
 * Quantum Scanner Engine — ZXing + QAI + Ledger
 * iOS 12 Safari Compatible Version (Option A)
 * - ZXing kept fully intact
 * - iPhone 6 camera permission prompt fixed
 * - iOS 12 video playback fixed
 * - iOS 12 canvas sizing fixed
 * - iOS 12 fallback decode fixed
 * - Auto-redirect opens in NEW TAB safely
 */

const CONFIG = {
  cooldown: 2500,
  vibrate: true,
  autoRedirect: true,
  beep: { freq: 950, volume: 0.05, duration: 0.08 },
  maxRetries: 2,
  frameRate: { ideal: 15, max: 20 },
  resolution: { width: 480, height: 360 }, // iPhone 6 safe
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
  const ua = navigator.userAgent;

  if (/iPhone|iPad|iPod/.test(ua)) {
    state.isMobile = true;
    state.performanceMode = true;
    CONFIG.resolution = { width: 480, height: 360 };
    CONFIG.frameRate = { ideal: 10, max: 15 };
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
   BEEP (iPhone-safe)
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
    setTimeout(() => { try { ctx.close(); } catch (_) {} }, 500);
  } catch (_) {}
}

/* -------------------------------------------------------------
   INIT
------------------------------------------------------------- */
async function init() {
  detectDevice();

  if (el.video) {
    el.video.setAttribute("playsinline", "true");
    el.video.setAttribute("autoplay", "true");
    el.video.setAttribute("muted", "true");
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

  bindEvents();
  setStatus("✅ Ready", "neutral");

  if (state.isMobile) {
    setTimeout(start, 500);
  }
}

/* -------------------------------------------------------------
   START CAMERA (iOS 12 safe)
------------------------------------------------------------- */
async function start() {
  if (!state.ready) return setStatus("Not ready", "error");

  setStatus("Requesting camera…", "neutral");

  try {
    const devices = await state.reader.listVideoInputDevices();
    state.devices = devices;

    if (!devices.length) return fallbackStart();

    if (!state.deviceId) {
      const rear = devices.find(d => /back|rear|environment/i.test(d.label));
      const front = devices.find(d => /front|user/i.test(d.label));
      state.deviceId = rear ? rear.deviceId : (front ? front.deviceId : devices[0].deviceId);
    }

    const constraints = {
      video: {
        deviceId: { exact: state.deviceId },
        facingMode: "environment",
        width: CONFIG.resolution.width,
        height: CONFIG.resolution.height,
        frameRate: CONFIG.frameRate
      },
      audio: false
    };

    await startReader(constraints);

  } catch (e) {
    console.warn("Camera start failed:", e);
    fallbackStart();
  }
}

/* -------------------------------------------------------------
   ZXing decodeFromConstraints (iOS 12 safe)
------------------------------------------------------------- */
async function startReader(constraints) {
  return new Promise((resolve, reject) => {
    try {
      state.reader.decodeFromConstraints(constraints, el.video, (result, err) => {
        if (result) handleScan(result.getText());
        if (err && !(err instanceof ZXing.NotFoundException)) {
          if (CONFIG.debug) console.debug(err);
        }
      });

      const forcePlay = () => {
        el.video.play().catch(() => setTimeout(forcePlay, 200));
      };
      el.video.onloadedmetadata = forcePlay;

      setStatus("🔍 Scanning…", "neutral");
      resolve();
    } catch (e) {
      reject(e);
    }
  });
}

/* -------------------------------------------------------------
   FALLBACK CAMERA (iOS 12 safe)
------------------------------------------------------------- */
async function fallbackStart() {
  setStatus("Using fallback camera…", "neutral");

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "environment",
        width: CONFIG.resolution.width,
        height: CONFIG.resolution.height
      },
      audio: false
    });

    el.video.srcObject = stream;

    const forcePlay = () => {
      el.video.play().catch(() => setTimeout(forcePlay, 200));
    };
    el.video.onloadedmetadata = () => {
      forcePlay();
      fallbackDecodeLoop();
      setStatus("📷 Fallback camera active", "success");
    };

  } catch (e) {
    setStatus(`Camera error: ${e.message}`, "error");
    if (state.retryCount < CONFIG.maxRetries) {
      state.retryCount++;
      setTimeout(start, 2000);
    }
  }
}

/* -------------------------------------------------------------
   FALLBACK DECODE LOOP (ZXing decodeFromCanvas)
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

      if (state.reader) {
        state.reader.decodeFromCanvas(canvas).then(result => {
          if (result) handleScan(result.getText());
        }).catch(() => {});
      }
    } catch (_) {}

    setTimeout(captureFrame, state.performanceMode ? 1000 : 500);
  }

  setTimeout(captureFrame, 500);
}

/* -------------------------------------------------------------
   FLIP / STOP
------------------------------------------------------------- */
function flip() {
  if (state.devices.length < 2) {
    return cycleFacingMode();
  }

  const idx = state.devices.findIndex(d => d.deviceId === state.deviceId);
  state.deviceId = state.devices[(idx + 1) % state.devices.length].deviceId;
  setStatus("🔄 Swapping…", "neutral");
  start();
}

function cycleFacingMode() {
  const modes = ["environment", "user"];
  const current = state.facingModeIndex || 0;
  state.facingModeIndex = (current + 1) % modes.length;
  state.deviceId = null;
  setStatus(`🔄 Switching to ${modes[state.facingModeIndex]}`, "neutral");
  start();
}

function stop() {
  if (state.reader) state.reader.reset();
  if (el.video && el.video.srcObject) {
    el.video.srcObject.getTracks().forEach(t => t.stop());
    el.video.srcObject = null;
  }
  fallbackLoopRunning = false;
  setStatus("⏸️ Stopped", "neutral");
}

/* -------------------------------------------------------------
   HANDLE SCAN
------------------------------------------------------------- */
async function handleScan(data) {
  if (state.cooldown && data === state.lastScan) return;

  state.lastScan = data;
  state.cooldown = true;

  if (el.payload) el.payload.textContent = data;
  setStatus("✅ Decoded!", "success");

  if (CONFIG.vibrate && navigator.vibrate) {
    try { navigator.vibrate(80); } catch (_) {}
  }

  try { beep(); } catch (_) {}

  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("QAI timeout")), 3000)
    );

    const analysis = await Promise.race([
      brain.process(data),
      timeoutPromise
    ]);

    ledger.addEntry(data, "SCAN", {
      type: analysis.format ? `${analysis.format.name} (${analysis.format.type})` : analysis.type,
      pattern: analysis.pattern,
      explanation: analysis.explanation,
      entropy: analysis.entropy
    });
  } catch (e) {
    console.warn("QAI error:", e);
    ledger.addEntry(data, "SCAN", {
      error: e.message || "QAI timeout",
      timestamp: new Date().toISOString()
    });
    setStatus("Signal logged (QAI skipped)", "neutral");
  }

  if (CONFIG.autoRedirect) {
    try {
      const isUrl = /^https?:\/\/[^\s]+/i.test(data);
      const url = isUrl ? data : `https://www.google.com/search?q=${encodeURIComponent(data)}`;

      // iOS 12 Safari-safe new tab opener
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (_) {}
  }

  setTimeout(() => { state.cooldown = false; }, CONFIG.cooldown);
}

/* -------------------------------------------------------------
   EVENTS (touch-optimized)
------------------------------------------------------------- */
function bindEvents() {
  const touchEvents = ["click", "touchstart"];

  touchEvents.forEach(eventType => {
    if (el.start) el.start.addEventListener(eventType, start, { passive: true });
    if (el.flip) el.flip.addEventListener(eventType, flip, { passive: true });
    if (el.photo) el.photo.addEventListener(eventType, capturePhoto, { passive: true });
    if (el.send) el.send.addEventListener(eventType, handleSend, { passive: true });
    if (el.resetLedger) el.resetLedger.addEventListener(eventType, () => ledger.clear(), { passive: true });
  });

  if (el.upload && el.fileInput) {
    el.upload.addEventListener("click", () => el.fileInput.click(), { passive: true });
    el.fileInput.addEventListener("change", handleFileUpload, { passive: true });
  }

  if (!state.isMobile) {
    document.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey) handleSend();
      if (e.key === " " && e.target === document.body) {
        e.preventDefault();
        capturePhoto();
      }
    });
  }
}

/* -------------------------------------------------------------
   PHOTO CAPTURE
------------------------------------------------------------- */
function capturePhoto() {
  if (!el.video || !el.canvas) return;

  try {
    const ctx = el.canvas.getContext("2d");
    const width = Math.min(el.video.videoWidth || CONFIG.resolution.width, 640);
    const height = Math.min(el.video.videoHeight || CONFIG.resolution.height, 480);

    el.canvas.width = width;
    el.canvas.height = height;
    ctx.drawImage(el.video, 0, 0, width, height);

    if (el.photoPreview) {
      el.photoPreview.src = el.canvas.toDataURL("image/png");
      el.photoPreview.style.display = "block";

      if (state.isMobile) {
        setTimeout(() => {
          el.photoPreview.style.display = "none";
        }, 5000);
      }
    }
  } catch (e) {
    console.warn("Photo capture failed:", e);
  }
}

/* -------------------------------------------------------------
   FILE UPLOAD
------------------------------------------------------------- */
async function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  setStatus("Processing image…", "neutral");
  const url = URL.createObjectURL(file);

  try {
    const result = await state.reader.decodeFromImageUrl(url);
    await handleScan(result.getText());
  } catch (err) {
    console.warn(err);
    setStatus("Upload decode failed", "error");
  } finally {
    URL.revokeObjectURL(url);
    if (el.fileInput) el.fileInput.value = "";
  }
}

/* -------------------------------------------------------------
   HANDLE SEND
------------------------------------------------------------- */
async function handleSend() {
  const data = el.payload?.textContent || "";
  if (!data) {
    setStatus("No payload to send", "error");
    return;
  }

  setStatus("Analyzing payload…", "neutral");
  try {
    const analysis = await brain.process(data);
    ledger.addEntry(data, "MANUAL", {
      type: analysis.format ? `${analysis.format.name} (${analysis.format.type})` : analysis.type,
      pattern: analysis.pattern,
      explanation: analysis.explanation,
      entropy: analysis.entropy
    });
    setStatus("✅ Signal logged", "success");
  } catch (e) {
    console.warn(e);
    setStatus("QAI analysis failed", "error");
    ledger.addEntry(data, "MANUAL", { error: e.message });
  }
}

/* -------------------------------------------------------------
   BOOTSTRAP
------------------------------------------------------------- */
document.readyState === "loading"
  ? document.addEventListener("DOMContentLoaded", init)
  : init();

/* -------------------------------------------------------------
   MEMORY MANAGEMENT
------------------------------------------------------------- */
window.addEventListener("beforeunload", () => {
  if (state.reader) {
    try { state.reader.reset(); } catch (_) {}
  }
  if (el.video && el.video.srcObject) {
    try { el.video.srcObject.getTracks().forEach(t => t.stop()); } catch (_) {}
  }
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
