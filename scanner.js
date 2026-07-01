/**
 * Quantum Scanner Engine v2.0 — ZXing + QAI + Ledger
 * Enhanced with:
 *  - Multi-format barcode detection with confidence scoring
 *  - Kool-Aid barcode decryption with expanded database
 *  - Smart auto-redirect with domain verification
 *  - Real-time analytics dashboard
 */

// ===== CONSTANTS & CONFIGURATION =====
const CONFIG = {
  cooldown: 1500,
  vibrate: true,
  autoRedirect: true,
  beep: { freq: 950, volume: 0.08, duration: 0.10 },
  maxRetries: 3,
  analyticsInterval: 5000,
  supportedFormats: [
    'QR_CODE', 'DATA_MATRIX', 'EAN_13', 'EAN_8', 'UPC_A',
    'CODE_128', 'CODE_39', 'PDF_417', 'AZTEC', 'ITF', 'CODABAR'
  ]
};

// ===== STATE MANAGEMENT =====
const state = {
  deviceId: null,
  devices: [],
  reader: null,
  cooldown: false,
  lastScan: null,
  ready: false,
  retryCount: 0,
  analytics: { totalScans: 0, byType: {}, recentScans: [] }
};

// ===== DOM REFERENCES =====
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
  analytics: document.getElementById("analyticsDisplay")
};

// ===== CORE CLASSES =====
const ledger = new QuantumLedger("ledger");
const brain = new Qai();

// ===== UTILITY FUNCTIONS =====
function setStatus(msg, type = "neutral") {
  if (el.status) {
    el.status.textContent = `Status: ${msg}`;
    el.status.className = `status ${type}`;
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

function formatTimestamp() {
  return new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
}

// ===== KOOL-AID DECRYPTION ENGINE =====
class KoolAidDecoder {
  constructor() {
    this.database = new Map([
      ["043000000000", { brand: "Kool-Aid", flavor: "Unknown", type: "Family Code" }],
      ["043000828706", { brand: "Kool-Aid", flavor: "Tropical Punch", type: "Squeeze Bottle" }],
      ["043000828713", { brand: "Kool-Aid", flavor: "Cherry", type: "Squeeze Bottle" }],
      ["043000828720", { brand: "Kool-Aid", flavor: "Grape", type: "Squeeze Bottle" }],
      ["043000828737", { brand: "Kool-Aid", flavor: "Strawberry", type: "Squeeze Bottle" }],
      ["043000828744", { brand: "Kool-Aid", flavor: "Orange", type: "Squeeze Bottle" }],
      ["043000828751", { brand: "Kool-Aid", flavor: "Lemon-Lime", type: "Squeeze Bottle" }],
      ["043000025325", { brand: "Kool-Aid", flavor: "Blue Raspberry", type: "Powder" }],
      ["043000025332", { brand: "Kool-Aid", flavor: "Strawberry", type: "Powder" }],
      ["043000025349", { brand: "Kool-Aid", flavor: "Grape", type: "Powder" }]
    ]);
    this.prefixMap = new Map([
      ["043000", { brand: "Kool-Aid", confidence: 0.85, note: "Kraft Heinz family" }],
      ["043000828", { brand: "Kool-Aid", confidence: 0.92, note: "Squeeze bottle series" }]
    ]);
  }

  decode(barcode) {
    if (!/^[0-9]{8,14}$/.test(barcode)) return null;
    
    // Exact match
    if (this.database.has(barcode)) {
      return { ...this.database.get(barcode), code: barcode, confidence: 1.0 };
    }
    
    // Prefix matching
    for (const [prefix, info] of this.prefixMap) {
      if (barcode.startsWith(prefix)) {
        return {
          brand: info.brand,
          flavor: "Unmapped flavor",
          type: "Heuristic match",
          note: info.note,
          code: barcode,
          confidence: info.confidence
        };
      }
    }
    
    return null;
  }
}

const koolAid = new KoolAidDecoder();

// ===== ANALYTICS ENGINE =====
class AnalyticsEngine {
  constructor() {
    this.metrics = {
      totalScans: 0,
      byType: {},
      byBrand: {},
      errorRate: 0,
      lastScanTime: null
    };
  }

  trackScan(data, type, meta = {}) {
    this.metrics.totalScans++;
    this.metrics.byType[type] = (this.metrics.byType[type] || 0) + 1;
    
    if (meta.brand) {
      this.metrics.byBrand[meta.brand] = (this.metrics.byBrand[meta.brand] || 0) + 1;
    }
    
    this.metrics.lastScanTime = formatTimestamp();
    this.updateDisplay();
  }

  trackError() {
    this.metrics.errorRate = (this.metrics.errorRate * 0.9 + 0.1);
    this.updateDisplay();
  }

  updateDisplay() {
    if (!el.analytics) return;
    const m = this.metrics;
    const brands = Object.entries(m.byBrand)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    
    el.analytics.innerHTML = `
      <strong>📊 Analytics</strong><br>
      Total: ${m.totalScans} | Types: ${Object.keys(m.byType).length}<br>
      Brands: ${brands || 'None'}<br>
      Last: ${m.lastScanTime || 'Never'} | Error Rate: ${(m.errorRate * 100).toFixed(1)}%
    `;
  }
}

const analytics = new AnalyticsEngine();

// ===== QR/BARCODE PROCESSING =====
async function processBarcode(data) {
  if (state.cooldown && data === state.lastScan) return;
  
  state.lastScan = data;
  state.cooldown = true;
  
  if (el.payload) el.payload.textContent = data;
  setStatus("Decoding...", "success");
  beep();
  if (CONFIG.vibrate && navigator.vibrate) navigator.vibrate(80);
  
  try {
    const analysis = await brain.process(data);
    const formatLabel = analysis.format 
      ? `${analysis.format.name} (${analysis.format.type})` 
      : analysis.type || "unknown";
    
    // Kool-Aid decryption
    const kool = koolAid.decode(data);
    const extraMeta = {
      type: formatLabel,
      pattern: analysis.pattern,
      explanation: analysis.explanation,
      entropy: analysis.entropy,
      length: analysis.length,
      timestamp: formatTimestamp()
    };
    
    if (kool) {
      extraMeta.koolAid = `${kool.brand} · ${kool.flavor} · ${kool.type}`;
      extraMeta.brand = kool.brand;
      extraMeta.confidence = kool.confidence;
      setStatus(`🎯 ${kool.brand} ${kool.flavor} (${(kool.confidence * 100).toFixed(0)}% confidence)`, "success");
    } else {
      setStatus(`📱 Signal logged (${formatLabel}) · entropy ${analysis.entropy}`, "success");
    }
    
    ledger.addEntry(data, "SCAN", extraMeta);
    analytics.trackScan(data, formatLabel, extraMeta);
    
    // Smart auto-redirect
    if (CONFIG.autoRedirect) {
      handleRedirect(data);
    }
    
  } catch (e) {
    console.warn("QAI error", e);
    ledger.addEntry(data, "SCAN", { error: e.message });
    analytics.trackError();
    setStatus("⚠️ Analysis failed, raw signal logged", "error");
  }
  
  setTimeout(() => { state.cooldown = false; }, CONFIG.cooldown);
}

function handleRedirect(data) {
  const urlPattern = /^https?:\/\/[^\s]+/i;
  const domainPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
  
  let url = null;
  
  if (urlPattern.test(data)) {
    url = data;
  } else if (domainPattern.test(data)) {
    url = `https://${data}`;
  } else if (data.startsWith('www.')) {
    url = `https://${data}`;
  }
  
  if (url) {
    // Verify URL is safe (basic check)
    try {
      const parsed = new URL(url);
      if (['http:', 'https:'].includes(parsed.protocol)) {
        window.open(url, '_blank');
        return;
      }
    } catch (_) {}
  }
  
  // Default: search
  window.open(`https://www.google.com/search?q=${encodeURIComponent(data)}`, '_blank');
}

// ===== CAMERA MANAGEMENT =====
async function initScanner() {
  if (typeof ZXing === "undefined") {
    setStatus("ZXing missing", "error");
    return;
  }
  
  const hints = new Map();
  hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
  hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, 
    CONFIG.supportedFormats.map(f => ZXing.BarcodeFormat[f]));
  
  state.reader = new ZXing.BrowserMultiFormatReader(hints);
  state.ready = true;
  
  if (el.video) {
    Object.assign(el.video, { autoplay: true, playsinline: true, muted: true });
  }
  
  bindEvents();
  setStatus("✅ Ready", "neutral");
}

async function startCamera() {
  if (!state.ready) return setStatus("Not ready", "error");
  
  setStatus("Starting camera...", "neutral");
  state.reader.reset();
  
  const devices = await state.reader.listVideoInputDevices();
  state.devices = devices;
  
  if (!devices.length) return setStatus("No camera found", "error");
  
  // Smart device selection with fallback
  if (!state.deviceId) {
    const rear = devices.find(d => /back|rear|environment/i.test(d.label));
    const preferred = rear || devices.find(d => /front|user/i.test(d.label)) || devices[0];
    state.deviceId = preferred.deviceId;
  }
  
  const constraints = {
    video: {
      deviceId: { exact: state.deviceId },
      facingMode: "environment",
      width: { ideal: 1280, max: 1920 },
      height: { ideal: 720, max: 1080 },
      frameRate: { ideal: 30 }
    }
  };
  
  try {
    await state.reader.decodeFromConstraints(constraints, el.video, (result, err) => {
      if (result) processBarcode(result.getText());
      if (err && !(err instanceof ZXing.NotFoundException)) {
        console.debug(err);
      }
    });
    setStatus("🔍 Scanning...", "neutral");
  } catch (err) {
    setStatus(`Camera error: ${err.message}`, "error");
    state.retryCount++;
    if (state.retryCount < CONFIG.maxRetries) {
      setTimeout(startCamera, 2000);
    }
  }
}

function flipCamera() {
  if (state.devices.length < 2) return setStatus("Only one camera", "error");
  const idx = state.devices.findIndex(d => d.deviceId === state.deviceId);
  state.deviceId = state.devices[(idx + 1) % state.devices.length].deviceId;
  setStatus("🔄 Swapping camera...", "neutral");
  startCamera();
}

function stopCamera() {
  state.reader?.reset();
  setStatus("⏸️ Stopped", "neutral");
}

// ===== IMAGE UPLOAD PROCESSING =====
async function handleFileUpload(file) {
  if (!file) return;
  const url = URL.createObjectURL(file);
  try {
    const result = await state.reader.decodeFromImageUrl(url);
    await processBarcode(result.getText());
  } catch (err) {
    console.warn(err);
    setStatus("Upload decode failed", "error");
    analytics.trackError();
  } finally {
    URL.revokeObjectURL(url);
  }
}

function capturePhoto() {
  if (!el.video || !el.canvas) return;
  const ctx = el.canvas.getContext("2d");
  el.canvas.width = el.video.videoWidth || 640;
  el.canvas.height = el.video.videoHeight || 480;
  ctx.drawImage(el.video, 0, 0, el.canvas.width, el.canvas.height);
  if (el.photoPreview) {
    el.photoPreview.src = el.canvas.toDataURL("image/png");
    el.photoPreview.style.display = "block";
  }
}

// ===== MANUAL ENTRY =====
async function handleManualEntry() {
  const data = el.payload?.textContent || "";
  if (!data) {
    setStatus("No payload to send", "error");
    return;
  }
  setStatus("Analyzing payload...", "neutral");
  try {
    const analysis = await brain.process(data);
    const formatLabel = analysis.format 
      ? `${analysis.format.name} (${analysis.format.type})` 
      : analysis.type || "unknown";
    
    const kool = koolAid.decode(data);
    const extraMeta = {
      type: formatLabel,
      pattern: analysis.pattern,
      explanation: analysis.explanation,
      entropy: analysis.entropy,
      length: analysis.length,
      timestamp: formatTimestamp()
    };
    
    if (kool) {
      extraMeta.koolAid = `${kool.brand} · ${kool.flavor} · ${kool.type}`;
      extraMeta.brand = kool.brand;
      setStatus(`✅ Manual: ${kool.brand} ${kool.flavor} logged`, "success");
    } else {
      setStatus(`✅ Manual signal logged (${formatLabel})`, "success");
    }
    
    ledger.addEntry(data, "MANUAL", extraMeta);
    analytics.trackScan(data, formatLabel, extraMeta);
  } catch (e) {
    console.warn(e);
    setStatus("Manual entry failed", "error");
    analytics.trackError();
  }
}

// ===== EVENT BINDING =====
function bindEvents() {
  el.start?.addEventListener('click', startCamera);
  el.flip?.addEventListener('click', flipCamera);
  el.upload?.addEventListener('click', () => el.fileInput?.click());
  el.fileInput?.addEventListener('change', (e) => handleFileUpload(e.target.files[0]));
  el.photo?.addEventListener('click', capturePhoto);
  el.send?.addEventListener('click', handleManualEntry);
  el.resetLedger?.addEventListener('click', () => ledger.clear());
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) handleManualEntry();
    if (e.key === ' ' && e.target === document.body) {
      e.preventDefault();
      capturePhoto();
    }
  });
}

// ===== BOOTSTRAP =====
document.readyState === "loading" 
  ? document.addEventListener("DOMContentLoaded", initScanner) 
  : initScanner();

// Auto-start after 1s if no interaction
setTimeout(() => {
  if (!state.ready) return;
  const hasStarted = el.video?.srcObject;
  if (!hasStarted) startCamera();
}, 1000);