/**
 * Quantum Scanner Engine — ZXing + QAI + Ledger
 * Optimized for iPhone 6 & Raspberry Pi
 * - Low memory footprint
 - Fallback cameras
 - Touch-optimized UI
 - Performance throttling
 */

// ============================================================================
//  CONFIGURATION
// ============================================================================
const CONFIG = {
  cooldown: 2500, // Increased for slower devices
  vibrate: true,
  autoRedirect: true,
  beep: { freq: 950, volume: 0.05, duration: 0.08 }, // Reduced volume for performance
  maxRetries: 2,
  frameRate: { ideal: 15, max: 20 }, // Lower for Raspberry Pi
  resolution: { width: 640, height: 480 }, // iPhone 6 friendly
  debug: false
};

// ============================================================================
//  STATE
// ============================================================================
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
  performanceMode: false
};

// ============================================================================
//  DOM REFERENCES
// ============================================================================
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

// ============================================================================
//  LEDGER & QAI
// ============================================================================
const ledger = new QuantumLedger("ledger");
const brain = new Qai();

// ============================================================================
//  DEVICE DETECTION
// ============================================================================
function detectDevice() {
  const ua = navigator.userAgent || navigator.vendor || window.opera;
  
  // iPhone 6 detection
  if (/iPhone|iPad|iPod/.test(ua)) {
    state.isMobile = true;
    // iPhone 6 specific: 1334x750 resolution
    if (window.screen.width <= 750 && window.screen.height <= 1334) {
      CONFIG.resolution = { width: 480, height: 360 };
      CONFIG.frameRate = { ideal: 10, max: 15 };
      state.performanceMode = true;
    }
  }
  
  // Raspberry Pi detection
  if (/Raspberry|Pi|armv7l|armv6l/.test(ua) || 
      navigator.hardwareConcurrency <= 4) {
    state.isRaspberryPi = true;
    CONFIG.resolution = { width: 320, height: 240 };
    CONFIG.frameRate = { ideal: 8, max: 12 };
    CONFIG.cooldown = 3000;
    state.performanceMode = true;
    // Disable vibrate on Pi
    CONFIG.vibrate = false;
  }
  
  return { isMobile: state.isMobile, isRaspberryPi: state.isRaspberryPi };
}

// ============================================================================
//  STATUS
// ============================================================================
function setStatus(msg, type = "neutral") {
  if (el.status) {
    el.status.textContent = `Status: ${msg}`;
    el.status.className = `status ${type}`;
  }
  if (CONFIG.debug) console.log(`[Scanner] ${msg}`);
}

// ============================================================================
//  BEEP (with fallback)
// ============================================================================
function beep() {
  try {
    // Check if AudioContext is available
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = CONFIG.beep.freq;
    gain.gain.value = CONFIG.beep.volume;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + CONFIG.beep.duration);
    setTimeout(() => ctx.close(), 300);
  } catch (_) {
    // Silent fallback
  }
}

// ============================================================================
//  PERFORMANCE OPTIMIZATIONS
// ============================================================================
function optimizeForDevice() {
  // Throttle DOM updates
  let updateTimeout = null;
  const throttledSetStatus = (msg, type) => {
    if (updateTimeout) return;
    updateTimeout = setTimeout(() => {
      setStatus(msg, type);
      updateTimeout = null;
    }, state.performanceMode ? 200 : 50);
  };
  
  // Memory management
  if (state.performanceMode) {
    // Clear canvas periodically
    setInterval(() => {
      if (el.canvas) {
        const ctx = el.canvas.getContext('2d');
        ctx.clearRect(0, 0, el.canvas.width, el.canvas.height);
      }
    }, 30000);
  }
  
  return throttledSetStatus;
}

const throttledSetStatus = optimizeForDevice();

// ============================================================================
//  INIT
// ============================================================================
async function init() {
  // Detect device
  detectDevice();
  
  if (state.performanceMode) {
    setStatus(`⚡ Performance mode (${state.isRaspberryPi ? 'RPi' : 'iPhone 6'})`, "neutral");
  }
  
  if (typeof ZXing === "undefined") {
    setStatus("ZXing missing", "error");
    return;
  }

  const hints = new Map();
  hints.set(ZXing.DecodeHintType.TRY_HARDER, state.performanceMode ? false : true);
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
  setStatus("✅ Ready", "neutral");
  
  // Auto-start on mobile
  if (state.isMobile) {
    setTimeout(start, 500);
  }
}

// ============================================================================
//  START CAMERA (with fallbacks)
// ============================================================================
async function start() {
  if (!state.ready) return setStatus("Not ready", "error");

  setStatus("Starting…", "neutral");
  if (state.reader) state.reader.reset();

  try {
    const devices = await state.reader.listVideoInputDevices();
    state.devices = devices;

    if (!devices.length) {
      // Try getUserMedia directly as fallback
      return fallbackStart();
    }

    // Select best camera
    if (!state.deviceId) {
      const rear = devices.find(d => /back|rear|environment/i.test(d.label));
      const front = devices.find(d => /front|user/i.test(d.label));
      state.deviceId = rear ? rear.deviceId : (front ? front.deviceId : devices[0].deviceId);
    }

    // Validate deviceId still exists
    const validDevice = devices.find(d => d.deviceId === state.deviceId);
    if (!validDevice && devices.length > 0) {
      state.deviceId = devices[0].deviceId;
    }

    const constraints = getVideoConstraints();
    await startReader(constraints);

  } catch (e) {
    console.warn("Camera start failed:", e);
    // Fallback to simpler constraints
    await fallbackStart();
  }
}

function getVideoConstraints() {
  const baseConstraints = {
    video: {
      deviceId: state.deviceId ? { exact: state.deviceId } : undefined,
      facingMode: state.deviceId ? undefined : "environment",
      width: { ideal: CONFIG.resolution.width, max: CONFIG.resolution.width * 1.2 },
      height: { ideal: CONFIG.resolution.height, max: CONFIG.resolution.height * 1.2 },
      frameRate: CONFIG.frameRate
    }
  };
  
  // Remove undefined properties
  if (!baseConstraints.video.deviceId) delete baseConstraints.video.deviceId;
  
  return baseConstraints;
}

async function startReader(constraints) {
  return new Promise((resolve, reject) => {
    try {
      state.reader.decodeFromConstraints(constraints, el.video, (result, err) => {
        if (result) handleScan(result.getText());
        if (err && !(err instanceof ZXing.NotFoundException)) {
          if (CONFIG.debug) console.debug(err);
        }
      });
      setStatus("🔍 Scanning…", "neutral");
      resolve();
    } catch (e) {
      reject(e);
    }
  });
}

async function fallbackStart() {
  setStatus("Using fallback camera…", "neutral");
  
  try {
    const constraints = {
      video: {
        facingMode: "environment",
        width: { ideal: CONFIG.resolution.width },
        height: { ideal: CONFIG.resolution.height }
      }
    };
    
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    if (el.video) {
      el.video.srcObject = stream;
      await el.video.play();
      setStatus("📷 Fallback camera active", "success");
      
      // Manual decode loop for fallback
      fallbackDecodeLoop();
    }
  } catch (e) {
    setStatus(`Camera error: ${e.message}`, "error");
    if (state.retryCount < CONFIG.maxRetries) {
      state.retryCount++;
      setTimeout(start, 2000);
    }
  }
}

// ============================================================================
//  FALLBACK DECODE LOOP (for Pi / older devices)
// ============================================================================
let fallbackLoopRunning = false;

function fallbackDecodeLoop() {
  if (fallbackLoopRunning) return;
  fallbackLoopRunning = true;
  
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  function captureFrame() {
    if (!el.video || el.video.paused || el.video.ended) {
      fallbackLoopRunning = false;
      return;
    }
    
    try {
      canvas.width = el.video.videoWidth || CONFIG.resolution.width;
      canvas.height = el.video.videoHeight || CONFIG.resolution.height;
      ctx.drawImage(el.video, 0, 0, canvas.width, canvas.height);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      // ZXing decode from image data
      if (state.reader) {
        state.reader.decodeFromCanvas(canvas).then(result => {
          if (result) handleScan(result.getText());
        }).catch(() => {});
      }
    } catch (e) {
      // Silent fail
    }
    
    // Throttle for performance
    setTimeout(captureFrame, state.performanceMode ? 1000 : 500);
  }
  
  setTimeout(captureFrame, 500);
}

// ============================================================================
//  FLIP / STOP
// ============================================================================
function flip() {
  if (state.devices.length < 2) {
    // Try cycling through facingMode instead
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
  state.deviceId = null; // Force facingMode selection
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

// ============================================================================
//  HANDLE SCAN (with memory optimization)
// ============================================================================
async function handleScan(data) {
  if (state.cooldown && data === state.lastScan) return;

  state.lastScan = data;
  state.cooldown = true;

  if (el.payload) el.payload.textContent = data;
  setStatus("✅ Decoded!", "success");

  // Vibrate (with fallback)
  if (CONFIG.vibrate && navigator.vibrate) {
    try {
      navigator.vibrate(80);
    } catch (_) {}
  }
  
  // Beep (with fallback)
  try { beep(); } catch (_) {}

  // Process with QAI (with timeout)
  try {
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('QAI timeout')), 3000)
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
    // Still log the scan
    ledger.addEntry(data, "SCAN", { 
      error: e.message || 'QAI timeout',
      timestamp: new Date().toISOString()
    });
    setStatus("Signal logged (QAI skipped)", "neutral");
  }

  // Auto-redirect with memory cleanup
  if (CONFIG.autoRedirect) {
    try {
      const isUrl = /^https?:\/\/[^\s]+/i.test(data);
      const url = isUrl ? data : `https://www.google.com/search?q=${encodeURIComponent(data)}`;
      window.open(url, "_blank");
    } catch (_) {}
  }

  setTimeout(() => { state.cooldown = false; }, CONFIG.cooldown);
}

// ============================================================================
//  EVENTS (touch-optimized)
// ============================================================================
function bindEvents() {
  // Touch-friendly event listeners
  const touchEvents = ['click', 'touchstart'];
  
  touchEvents.forEach(eventType => {
    if (el.start) el.start.addEventListener(eventType, start, { passive: true });
    if (el.flip) el.flip.addEventListener(eventType, flip, { passive: true });
    if (el.photo) el.photo.addEventListener(eventType, capturePhoto, { passive: true });
    if (el.send) el.send.addEventListener(eventType, handleSend, { passive: true });
    if (el.resetLedger) el.resetLedger.addEventListener(eventType, () => ledger.clear(), { passive: true });
  });

  // Upload handling
  if (el.upload && el.fileInput) {
    el.upload.addEventListener('click', () => el.fileInput.click(), { passive: true });
    el.fileInput.addEventListener('change', handleFileUpload, { passive: true });
  }

  // Keyboard shortcuts (skip on mobile)
  if (!state.isMobile) {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) handleSend();
      if (e.key === ' ' && e.target === document.body) {
        e.preventDefault();
        capturePhoto();
      }
    });
  }
}

// ============================================================================
//  PHOTO CAPTURE
// ============================================================================
function capturePhoto() {
  if (!el.video || !el.canvas) return;
  
  try {
    const ctx = el.canvas.getContext('2d');
    const width = Math.min(el.video.videoWidth || CONFIG.resolution.width, 640);
    const height = Math.min(el.video.videoHeight || CONFIG.resolution.height, 480);
    
    el.canvas.width = width;
    el.canvas.height = height;
    ctx.drawImage(el.video, 0, 0, width, height);
    
    if (el.photoPreview) {
      el.photoPreview.src = el.canvas.toDataURL('image/png');
      el.photoPreview.style.display = 'block';
      
      // Auto-hide preview on mobile after 5s
      if (state.isMobile) {
        setTimeout(() => {
          el.photoPreview.style.display = 'none';
        }, 5000);
      }
    }
  } catch (e) {
    console.warn('Photo capture failed:', e);
  }
}

// ============================================================================
//  FILE UPLOAD
// ============================================================================
async function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  setStatus('Processing image…', 'neutral');
  const url = URL.createObjectURL(file);
  
  try {
    const result = await state.reader.decodeFromImageUrl(url);
    await handleScan(result.getText());
  } catch (err) {
    console.warn(err);
    setStatus('Upload decode failed', 'error');
  } finally {
    URL.revokeObjectURL(url);
    if (el.fileInput) el.fileInput.value = ''; // Reset input
  }
}

// ============================================================================
//  HANDLE SEND
// ============================================================================
async function handleSend() {
  const data = el.payload?.textContent || '';
  if (!data) {
    setStatus('No payload to send', 'error');
    return;
  }
  
  setStatus('Analyzing payload…', 'neutral');
  try {
    const analysis = await brain.process(data);
    ledger.addEntry(data, 'MANUAL', {
      type: analysis.format ? `${analysis.format.name} (${analysis.format.type})` : analysis.type,
      pattern: analysis.pattern,
      explanation: analysis.explanation,
      entropy: analysis.entropy
    });
    setStatus('✅ Signal logged', 'success');
  } catch (e) {
    console.warn(e);
    setStatus('QAI analysis failed', 'error');
    // Log anyway
    ledger.addEntry(data, 'MANUAL', { error: e.message });
  }
}

// ============================================================================
//  BOOTSTRAP
// ============================================================================
document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', init)
  : init();

// ============================================================================
//  MEMORY MANAGEMENT (for long-running sessions)
// ============================================================================
window.addEventListener('beforeunload', () => {
  if (state.reader) {
    try { state.reader.reset(); } catch (_) {}
  }
  if (el.video && el.video.srcObject) {
    try { el.video.srcObject.getTracks().forEach(t => t.stop()); } catch (_) {}
  }
});

// ============================================================================
//  EXTERNAL API for debugging
// ============================================================================
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