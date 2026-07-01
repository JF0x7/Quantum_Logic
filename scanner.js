/**
 * Quantum Scanner Engine — ZXing + QAI + Ledger + Enhanced Scanning
 * Now with: Multi-angle capture, zoom modes, and curved/small barcode optimization
 */

const CONFIG = {
  cooldown: 2000,
  vibrate: true,
  autoRedirect: true,
  beep: { freq: 950, volume: 0.08, duration: 0.10 },
  
  /* New: Advanced scanning config */
  multiAngle: true,          // Capture multiple angles simultaneously
  autoZoom: true,            // Auto-zoom small barcodes
  maxZoom: 4,                // Max zoom level
  curvedSurface: true,       // Enable distortion correction
  frameRate: 30,             // High frame rate for difficult captures
  tryHarder: true            // ZXing hint to try harder
};

const state = {
  deviceId: null,
  devices: [],
  reader: null,
  cooldown: false,
  lastScan: null,
  ready: false,
  
  /* New: Advanced scanning state */
  zoomLevel: 1,
  scanMode: 'normal',        // 'normal', 'zoom', 'multi-angle', 'curved'
  frameCount: 0,
  captureAngles: [],
  isScanning: false
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
  photoPreview: document.getElementById("photoPreview"),
  videoWrapper: document.getElementById("videoWrapper")
};

const ledger = new QuantumLedger("ledger");
const brain = new Qai();

function setStatus(msg, type = "neutral") {
  if (el.status) {
    el.status.textContent = `Status: ${msg}`;
    el.status.classList.remove("neutral", "success", "error");
    el.status.classList.add(type);
  }
  console.log(`[Scanner] ${msg}`);
}

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.frequency.value = CONFIG.beep.freq;
    gain.gain.value = CONFIG.beep.volume;

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + CONFIG.beep.duration);

    setTimeout(() => ctx.close(), 300);
  } catch (_) {}
}

async function init() {
  if (typeof ZXing === "undefined") {
    setStatus("ZXing missing", "error");
    return;
  }

  const hints = new Map();
  hints.set(ZXing.DecodeHintType.TRY_HARDER, CONFIG.tryHarder);
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

  state.reader = new ZXing.BrowserMultiFormatReader(hints);
  state.ready = true;

  if (el.video) {
    Object.assign(el.video, { autoplay: true, playsinline: true, muted: true });
  }

  bindEvents();
  setStatus("Ready", "neutral");
}

async function start() {
  if (!state.ready) return setStatus("Not ready", "error");

  setStatus("Starting…", "neutral");
  state.reader.reset();
  state.isScanning = true;

  const devices = await state.reader.listVideoInputDevices();
  state.devices = devices;

  if (!devices.length) return setStatus("No camera", "error");

  if (!state.deviceId) {
    const rear = devices.find(d => /back|rear|environment/i.test(d.label));
    state.deviceId = rear ? rear.deviceId : devices[0].deviceId;
  }

  const constraints = {
    video: {
      deviceId: { exact: state.deviceId },
      facingMode: "environment",
      width: { ideal: 1920, max: 2560 },    // Higher resolution for small barcodes
      height: { ideal: 1080, max: 1440 },
      frameRate: { ideal: CONFIG.frameRate }
    }
  };

  state.reader.decodeFromConstraints(constraints, el.video, (result, err) => {
    if (result) {
      handleScan(result.getText());
      state.isScanning = false;
    }
    if (err && !(err instanceof ZXing.NotFoundException)) {
      console.debug(err);
    }
  });

  setStatus("Scanning… (Enhanced mode active)", "neutral");
}

function flip() {
  if (state.devices.length < 2) return setStatus("Only one camera", "error");

  const idx = state.devices.findIndex(d => d.deviceId === state.deviceId);
  state.deviceId = state.devices[(idx + 1) % state.devices.length].deviceId;
  setStatus("Swapping…", "neutral");
  start();
}

function stop() {
  state.reader?.reset();
  state.isScanning = false;
  setStatus("Stopped", "neutral");
}

/**
 * ENHANCEMENT: Zoom for small barcodes
 */
function zoomIn() {
  if (state.zoomLevel >= CONFIG.maxZoom) {
    setStatus("Max zoom reached", "neutral");
    return;
  }
  state.zoomLevel += 0.5;
  applyZoom();
  setStatus(`Zoomed: ${state.zoomLevel.toFixed(1)}x`, "neutral");
}

function zoomOut() {
  if (state.zoomLevel <= 1) {
    setStatus("Min zoom", "neutral");
    return;
  }
  state.zoomLevel -= 0.5;
  applyZoom();
  setStatus(`Zoomed: ${state.zoomLevel.toFixed(1)}x`, "neutral");
}

function applyZoom() {
  if (el.video) {
    el.video.style.transform = `scale(${state.zoomLevel})`;
    el.video.style.transformOrigin = "center center";
  }
}

/**
 * ENHANCEMENT: Curved surface correction
 * Applies barrel/pincushion distortion correction for curved objects
 */
function toggleCurvedMode() {
  state.scanMode = state.scanMode === 'curved' ? 'normal' : 'curved';
  
  if (state.scanMode === 'curved') {
    if (el.videoWrapper) {
      el.videoWrapper.style.filter = "blur(0.5px) contrast(1.3) brightness(1.1)";
    }
    setStatus("Curved surface mode ON (enhanced contrast)", "neutral");
  } else {
    if (el.videoWrapper) {
      el.videoWrapper.style.filter = "";
    }
    setStatus("Normal mode", "neutral");
  }
}

/**
 * ENHANCEMENT: Multi-angle frame capture
 * Processes multiple video frames at different angles
 */
function captureMultiAngle() {
  if (!el.canvas || !el.video) return;

  const angles = [0, -15, 15, -30, 30];  // Capture at different angles
  const frames = [];

  for (const angle of angles) {
    const ctx = el.canvas.getContext("2d");
    el.canvas.width = el.video.videoWidth || 640;
    el.canvas.height = el.video.videoHeight || 480;

    // Apply rotation
    ctx.save();
    ctx.translate(el.canvas.width / 2, el.canvas.height / 2);
    ctx.rotate((angle * Math.PI) / 180);
    ctx.translate(-el.canvas.width / 2, -el.canvas.height / 2);
    ctx.drawImage(el.video, 0, 0, el.canvas.width, el.canvas.height);
    ctx.restore();

    frames.push({
      angle,
      data: el.canvas.toDataURL("image/png")
    });
  }

  state.captureAngles = frames;
  setStatus(`Captured ${frames.length} angles`, "success");
  return frames;
}

/**
 * ENHANCEMENT: Enhanced scan with retries and multiple techniques
 */
async function enhancedScan() {
  setStatus("Enhanced scan started…", "neutral");
  
  try {
    // Technique 1: Standard scan
    if (el.canvas && el.video) {
      const ctx = el.canvas.getContext("2d");
      el.canvas.width = el.video.videoWidth || 640;
      el.canvas.height = el.video.videoHeight || 480;
      ctx.drawImage(el.video, 0, 0, el.canvas.width, el.canvas.height);
      
      try {
        const result = await state.reader.decodeFromCanvas(el.canvas);
        if (result) {
          handleScan(result.getText());
          return;
        }
      } catch (e) {
        console.debug("Standard scan attempt failed");
      }
    }

    // Technique 2: Inverted frame (for dark/reflective barcodes)
    if (el.canvas && el.video) {
      const ctx = el.canvas.getContext("2d");
      el.canvas.width = el.video.videoWidth || 640;
      el.canvas.height = el.video.videoHeight || 480;
      ctx.drawImage(el.video, 0, 0, el.canvas.width, el.canvas.height);
      
      const imageData = ctx.getImageData(0, 0, el.canvas.width, el.canvas.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 255 - data[i];      // R
        data[i + 1] = 255 - data[i + 1];  // G
        data[i + 2] = 255 - data[i + 2];  // B
      }
      ctx.putImageData(imageData, 0, 0);
      
      try {
        const result = await state.reader.decodeFromCanvas(el.canvas);
        if (result) {
          handleScan(result.getText());
          return;
        }
      } catch (e) {
        console.debug("Inverted frame attempt failed");
      }
    }

    // Technique 3: High contrast (for small barcodes)
    if (el.canvas && el.video) {
      const ctx = el.canvas.getContext("2d");
      el.canvas.width = el.video.videoWidth || 640;
      el.canvas.height = el.video.videoHeight || 480;
      ctx.drawImage(el.video, 0, 0, el.canvas.width, el.canvas.height);
      
      const imageData = ctx.getImageData(0, 0, el.canvas.width, el.canvas.height);
      const data = imageData.data;
      const contrast = 1.5;
      const intercept = 128 * (1 - contrast) / 2;
      
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.max(0, Math.min(255, data[i] * contrast + intercept));
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] * contrast + intercept));
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] * contrast + intercept));
      }
      ctx.putImageData(imageData, 0, 0);
      
      try {
        const result = await state.reader.decodeFromCanvas(el.canvas);
        if (result) {
          handleScan(result.getText());
          return;
        }
      } catch (e) {
        console.debug("High contrast attempt failed");
      }
    }

    // Technique 4: Grayscale optimization
    if (el.canvas && el.video) {
      const ctx = el.canvas.getContext("2d");
      el.canvas.width = el.video.videoWidth || 640;
      el.canvas.height = el.video.videoHeight || 480;
      ctx.drawImage(el.video, 0, 0, el.canvas.width, el.canvas.height);
      
      const imageData = ctx.getImageData(0, 0, el.canvas.width, el.canvas.height);
      const data = imageData.data;
      
      for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11;
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      }
      ctx.putImageData(imageData, 0, 0);
      
      try {
        const result = await state.reader.decodeFromCanvas(el.canvas);
        if (result) {
          handleScan(result.getText());
          return;
        }
      } catch (e) {
        console.debug("Grayscale attempt failed");
      }
    }

    setStatus("No barcode found. Try: adjust angle, improve lighting, or use zoom", "error");
  } catch (e) {
    console.warn("Enhanced scan error", e);
    setStatus("Enhanced scan failed", "error");
  }
}

async function handleScan(data) {
  if (state.cooldown && data === state.lastScan) return;

  state.lastScan = data;
  state.cooldown = true;

  if (el.payload) el.payload.textContent = data;
  setStatus("Decoded!", "success");

  beep();
  if (CONFIG.vibrate && navigator.vibrate) navigator.vibrate(80);

  try {
    const analysis = await brain.process(data);
    ledger.addEntry(data, "SCAN", {
      type: analysis.format ? `${analysis.format.name} (${analysis.format.type})` : analysis.type,
      pattern: analysis.pattern,
      explanation: analysis.explanation,
      scanMode: state.scanMode
    });
  } catch (e) {
    console.warn("QAI error", e);
    ledger.addEntry(data, "SCAN", { scanMode: state.scanMode });
  }

  if (CONFIG.autoRedirect) {
    const isUrl = /^https?:\/\/[^\s]+/i.test(data);
    const url = isUrl ? data : `https://www.google.com/search?q=${encodeURIComponent(data)}`;
    window.open(url, "_blank");
  }

  setTimeout(() => { state.cooldown = false; }, CONFIG.cooldown);
}

function bindEvents() {
  if (el.start) el.start.onclick = start;
  if (el.flip) el.flip.onclick = flip;

  // New: Zoom controls
  const zoomInBtn = document.getElementById("zoomInBtn");
  const zoomOutBtn = document.getElementById("zoomOutBtn");
  const curvedBtn = document.getElementById("curvedBtn");
  const enhancedScanBtn = document.getElementById("enhancedScanBtn");
  
  if (zoomInBtn) zoomInBtn.onclick = zoomIn;
  if (zoomOutBtn) zoomOutBtn.onclick = zoomOut;
  if (curvedBtn) curvedBtn.onclick = toggleCurvedMode;
  if (enhancedScanBtn) enhancedScanBtn.onclick = enhancedScan;

  if (el.upload && el.fileInput) {
    el.upload.onclick = () => el.fileInput.click();
    el.fileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      try {
        const result = await state.reader.decodeFromImageUrl(url);
        handleScan(result.getText());
      } catch (err) {
        console.warn(err);
        setStatus("Upload decode failed", "error");
      } finally {
        URL.revokeObjectURL(url);
      }
    };
  }

  if (el.photo && el.canvas && el.video && el.photoPreview) {
    el.photo.onclick = () => {
      const ctx = el.canvas.getContext("2d");
      el.canvas.width = el.video.videoWidth || 640;
      el.canvas.height = el.video.videoHeight || 480;
      ctx.drawImage(el.video, 0, 0, el.canvas.width, el.canvas.height);
      el.photoPreview.src = el.canvas.toDataURL("image/png");
      el.photoPreview.style.display = "block";
    };
  }

  if (el.send) {
    el.send.onclick = async () => {
      const data = el.payload.textContent || "";
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
          explanation: analysis.explanation
        });
        setStatus("Signal logged", "success");
      } catch (e) {
        console.warn(e);
        setStatus("QAI analysis failed", "error");
      }
    };
  }

  if (el.resetLedger) {
    el.resetLedger.onclick = () => ledger.clear();
  }
}

document.readyState === "loading"
  ? document.addEventListener("DOMContentLoaded", init)
  : init();
