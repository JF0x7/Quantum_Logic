/**
 * Quantum Scanner Engine — ZXing + QAI v6.0 + Ledger
 * Optimized for iPhone 6 & Raspberry Pi
 * - Full QAI v6.0 integration
 * - Open Link feature
 * - Low memory footprint
 * - Touch-optimized UI
 */

// ============================================================================
//  CONFIGURATION
// ============================================================================
const CONFIG = {
  cooldown: 2500,
  vibrate: true,
  autoRedirect: false, // Changed to false - user now controls via "Open Link"
  beep: { freq: 950, volume: 0.05, duration: 0.08 },
  maxRetries: 2,
  frameRate: { ideal: 15, max: 20 },
  resolution: { width: 640, height: 480 },
  debug: false,
  openLinkNewTab: true,
  maxPayloadLength: 500
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
  performanceMode: false,
  currentPayload: null,
  currentAnalysis: null,
  scanHistory: []
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
  photoPreview: document.getElementById("photoPreview"),
  // New elements for enhanced UI
  openLink: document.getElementById("openLinkBtn"),
  analyzeBtn: document.getElementById("analyzeBtn"),
  copyBtn: document.getElementById("copyBtn"),
  clearBtn: document.getElementById("clearBtn"),
  scanStats: document.getElementById("scanStats"),
  qaiResults: document.getElementById("qaiResults")
};

// ============================================================================
//  LEDGER & QAI
// ============================================================================
const ledger = new QuantumLedger("ledger");
const brain = new Qai({
  enableAztec: true,
  enableDDN: true,
  enableMorse: true,
  enableDeepAnalysis: true,
  cacheSize: state.performanceMode ? 100 : 300
});

// ============================================================================
//  DEVICE DETECTION
// ============================================================================
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
  
  if (/Raspberry|Pi|armv7l|armv6l/.test(ua) || 
      navigator.hardwareConcurrency <= 4) {
    state.isRaspberryPi = true;
    CONFIG.resolution = { width: 320, height: 240 };
    CONFIG.frameRate = { ideal: 8, max: 12 };
    CONFIG.cooldown = 3000;
    state.performanceMode = true;
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
  
  // Update scan stats if available
  updateScanStats();
}

// ============================================================================
//  UPDATE SCAN STATS
// ============================================================================
function updateScanStats() {
  if (!el.scanStats) return;
  
  const total = state.scanHistory.length;
  const unique = new Set(state.scanHistory.map(s => s.payload)).size;
  const lastScan = state.lastScan ? state.lastScan.substring(0, 30) + '...' : 'None';
  
  el.scanStats.innerHTML = `
    <span>📊 Scans: ${total}</span>
    <span>🔢 Unique: ${unique}</span>
    <span>📝 Last: ${lastScan}</span>
  `;
}

// ============================================================================
//  BEEP
// ============================================================================
function beep() {
  try {
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
  } catch (_) {}
}

// ============================================================================
//  INIT
// ============================================================================
async function init() {
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
  
  // Setup QAI event listeners
  brain.addEventListener("processed", (e) => {
    if (CONFIG.debug) console.log("QAI processed:", e.detail);
  });
  
  brain.addEventListener("error", (e) => {
    console.warn("QAI error:", e.detail);
  });
  
  // Auto-start on mobile
  if (state.isMobile) {
    setTimeout(start, 500);
  }
}

// ============================================================================
//  START CAMERA
// ============================================================================
async function start() {
  if (!state.ready) return setStatus("Not ready", "error");

  setStatus("Starting…", "neutral");
  if (state.reader) state.reader.reset();

  try {
    const devices = await state.reader.listVideoInputDevices();
    state.devices = devices;

    if (!devices.length) {
      return fallbackStart();
    }

    if (!state.deviceId) {
      const rear = devices.find(d => /back|rear|environment/i.test(d.label));
      const front = devices.find(d => /front|user/i.test(d.label));
      state.deviceId = rear ? rear.deviceId : (front ? front.deviceId : devices[0].deviceId);
    }

    const validDevice = devices.find(d => d.deviceId === state.deviceId);
    if (!validDevice && devices.length > 0) {
      state.deviceId = devices[0].deviceId;
    }

    const constraints = getVideoConstraints();
    await startReader(constraints);

  } catch (e) {
    console.warn("Camera start failed:", e);
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
//  FALLBACK DECODE LOOP
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
      
      if (state.reader) {
        state.reader.decodeFromCanvas(canvas).then(result => {
          if (result) handleScan(result.getText());
        }).catch(() => {});
      }
    } catch (e) {}
    
    setTimeout(captureFrame, state.performanceMode ? 1000 : 500);
  }
  
  setTimeout(captureFrame, 500);
}

// ============================================================================
//  FLIP / STOP
// ============================================================================
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

// ============================================================================
//  HANDLE SCAN - Enhanced with QAI v6.0
// ============================================================================
async function handleScan(data) {
  if (state.cooldown && data === state.lastScan) return;

  state.lastScan = data;
  state.currentPayload = data;
  state.cooldown = true;

  // Update UI immediately
  if (el.payload) {
    const displayData = data.length > CONFIG.maxPayloadLength ? 
      data.substring(0, CONFIG.maxPayloadLength) + '...' : data;
    el.payload.textContent = displayData;
    el.payload.title = data; // Full data on hover
  }
  
  setStatus("✅ Decoded! Analyzing…", "success");

  // Feedback
  if (CONFIG.vibrate && navigator.vibrate) {
    try { navigator.vibrate(80); } catch (_) {}
  }
  try { beep(); } catch (_) {}

  // Process with QAI v6.0
  try {
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('QAI timeout')), 5000)
    );
    
    const analysis = await Promise.race([
      brain.process(data),
      timeoutPromise
    ]);
    
    state.currentAnalysis = analysis;
    
    // Store in history
    state.scanHistory.push({
      payload: data,
      timestamp: new Date().toISOString(),
      analysis: analysis
    });
    
    // Update stats
    updateScanStats();
    
    // Show QAI results
    displayQAIResults(analysis);
    
    // Add to ledger with full analysis
    ledger.addEntry(data, "SCAN", {
      type: analysis.type || analysis.classification?.primary || 'Unknown',
      pattern: analysis.pattern,
      explanation: analysis.explanation || analysis.qnotes?.join(' ') || '',
      entropy: analysis.entropy,
      securityScore: analysis.security?.score,
      securityLevel: analysis.security?.level,
      decoded: analysis.decoded?.successes?.length || 0,
      classification: analysis.classification?.primary || 'Unknown',
      confidence: analysis.confidence || analysis.item?.confidence || 0
    });
    
    setStatus(`✅ ${analysis.classification?.primary || analysis.type || 'Signal'} logged`, "success");
    
  } catch (e) {
    console.warn("QAI error:", e);
    state.currentAnalysis = null;
    
    // Still log the scan with basic info
    state.scanHistory.push({
      payload: data,
      timestamp: new Date().toISOString(),
      error: e.message || 'QAI timeout'
    });
    
    updateScanStats();
    ledger.addEntry(data, "SCAN", { 
      error: e.message || 'QAI timeout',
      timestamp: new Date().toISOString()
    });
    
    setStatus("Signal logged (QAI skipped)", "neutral");
  }

  setTimeout(() => { state.cooldown = false; }, CONFIG.cooldown);
}

// ============================================================================
//  DISPLAY QAI RESULTS
// ============================================================================
function displayQAIResults(analysis) {
  if (!el.qaiResults) return;
  
  let html = `
    <div class="qai-results-panel">
      <div class="qai-header">
        <span class="qai-badge">🧠 QAI v${brain.version}</span>
        <span class="qai-time">${new Date().toLocaleTimeString()}</span>
      </div>
      <div class="qai-grid">
  `;
  
  // Basic info
  if (analysis.type) {
    html += `<div class="qai-item"><strong>Type:</strong> ${analysis.type}</div>`;
  }
  if (analysis.classification) {
    html += `<div class="qai-item"><strong>Classification:</strong> ${analysis.classification.primary}</div>`;
  }
  if (analysis.confidence !== undefined) {
    html += `<div class="qai-item"><strong>Confidence:</strong> ${(analysis.confidence * 100).toFixed(0)}%</div>`;
  }
  if (analysis.entropy !== undefined) {
    html += `<div class="qai-item"><strong>Entropy:</strong> ${analysis.entropy}</div>`;
  }
  
  // Pattern
  if (analysis.pattern) {
    html += `<div class="qai-item"><strong>Pattern:</strong> ${analysis.pattern}</div>`;
  }
  
  // Security
  if (analysis.security) {
    const color = analysis.security.score > 70 ? '#0f0' : 
                  analysis.security.score > 40 ? '#ff0' : '#f00';
    html += `<div class="qai-item" style="color:${color}">
      <strong>Security:</strong> ${analysis.security.score}/100 (${analysis.security.level})
    </div>`;
  }
  
  // Decoded
  if (analysis.decoded?.successes?.length) {
    html += `<div class="qai-item" style="grid-column: 1/-1;">
      <strong>Decoders:</strong> ${analysis.decoded.successes.map(d => d.decoder).join(', ')}
    </div>`;
  }
  
  // Q-Notes
  if (analysis.qnotes?.length) {
    html += `<div class="qai-item qai-notes" style="grid-column: 1/-1; background: #1a1a2e; padding: 8px; border-radius: 4px; border-left: 3px solid #0ff;">
      <strong>📝 Q-Notes:</strong><br>
      ${analysis.qnotes.map(n => `• ${n}`).join('<br>')}
    </div>`;
  }
  
  // Item info
  if (analysis.item) {
    html += `<div class="qai-item" style="grid-column: 1/-1; background: #0a0a1a; padding: 8px; border-radius: 4px; border: 1px solid #333;">
      <strong>🎯 Best Guess:</strong> ${analysis.item.label} (${analysis.item.category})<br>
      <span style="font-size: 0.85em; color: #aaa;">
        Risk: ${analysis.item.risk} | Action: ${analysis.item.suggestedAction}
      </span>
    </div>`;
  }
  
  html += `
      </div>
    </div>
  `;
  
  el.qaiResults.innerHTML = html;
  el.qaiResults.style.display = 'block';
}

// ============================================================================
//  OPEN LINK FEATURE
// ============================================================================
function openLink() {
  const payload = state.currentPayload || el.payload?.textContent || '';
  
  if (!payload || payload.trim() === '') {
    setStatus('No payload to open', 'error');
    return;
  }
  
  // Check if it's a URL
  const urlPattern = /^(https?:\/\/)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const isUrl = urlPattern.test(payload);
  
  if (isUrl) {
    // Ensure protocol
    let url = payload;
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    
    try {
      // Validate URL
      new URL(url);
      
      // Open in new tab or same window based on config
      if (CONFIG.openLinkNewTab) {
        window.open(url, '_blank');
      } else {
        window.location.href = url;
      }
      
      setStatus(`🌐 Opening: ${url}`, 'success');
      
      // Log to ledger
      ledger.addEntry(url, 'LINK_OPEN', {
        source: 'scanner_open_link',
        timestamp: new Date().toISOString()
      });
      
    } catch (e) {
      setStatus(`Invalid URL: ${e.message}`, 'error');
    }
  } else {
    // Not a URL - offer to search
    const shouldSearch = confirm(`"${payload.substring(0, 50)}..." is not a URL. Search with Google?`);
    if (shouldSearch) {
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(payload)}`;
      window.open(searchUrl, '_blank');
      setStatus('🔍 Searching...', 'neutral');
      
      // Log to ledger
      ledger.addEntry(payload, 'SEARCH', {
        source: 'scanner_search',
        timestamp: new Date().toISOString()
      });
    }
  }
}

// ============================================================================
//  COPY PAYLOAD
// ============================================================================
async function copyPayload() {
  const payload = state.currentPayload || el.payload?.textContent || '';
  
  if (!payload || payload.trim() === '') {
    setStatus('Nothing to copy', 'error');
    return;
  }
  
  try {
    await navigator.clipboard.writeText(payload);
    setStatus('📋 Copied to clipboard!', 'success');
  } catch (e) {
    // Fallback
    try {
      const textarea = document.createElement('textarea');
      textarea.value = payload;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setStatus('📋 Copied to clipboard!', 'success');
    } catch (err) {
      setStatus('Copy failed', 'error');
    }
  }
}

// ============================================================================
//  CLEAR PAYLOAD
// ============================================================================
function clearPayload() {
  if (el.payload) el.payload.textContent = '';
  if (el.qaiResults) el.qaiResults.style.display = 'none';
  state.currentPayload = null;
  state.currentAnalysis = null;
  setStatus('🧹 Cleared', 'neutral');
}

// ============================================================================
//  EVENTS
// ============================================================================
function bindEvents() {
  const touchEvents = ['click', 'touchstart'];
  
  touchEvents.forEach(eventType => {
    if (el.start) el.start.addEventListener(eventType, start, { passive: true });
    if (el.flip) el.flip.addEventListener(eventType, flip, { passive: true });
    if (el.photo) el.photo.addEventListener(eventType, capturePhoto, { passive: true });
    if (el.send) el.send.addEventListener(eventType, handleSend, { passive: true });
    if (el.resetLedger) el.resetLedger.addEventListener(eventType, () => ledger.clear(), { passive: true });
    
    // New buttons
    if (el.openLink) el.openLink.addEventListener(eventType, openLink, { passive: true });
    if (el.copyBtn) el.copyBtn.addEventListener(eventType, copyPayload, { passive: true });
    if (el.clearBtn) el.clearBtn.addEventListener(eventType, clearPayload, { passive: true });
  });

  if (el.upload && el.fileInput) {
    el.upload.addEventListener('click', () => el.fileInput.click(), { passive: true });
    el.fileInput.addEventListener('change', handleFileUpload, { passive: true });
  }

  // Keyboard shortcuts
  if (!state.isMobile) {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        if (e.ctrlKey || e.metaKey) {
          // Ctrl+Enter = Open Link
          openLink();
        } else {
          handleSend();
        }
      }
      if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
        // Ctrl+C = Copy (only if we handle it)
        if (e.target === document.body) {
          e.preventDefault();
          copyPayload();
        }
      }
      if (e.key === ' ' && e.target === document.body) {
        e.preventDefault();
        capturePhoto();
      }
      if (e.key === 'o' && !e.ctrlKey && !e.metaKey) {
        openLink();
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
    if (el.fileInput) el.fileInput.value = '';
  }
}

// ============================================================================
//  HANDLE SEND - Enhanced
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
    state.currentAnalysis = analysis;
    
    // Store in history
    state.scanHistory.push({
      payload: data,
      timestamp: new Date().toISOString(),
      analysis: analysis,
      source: 'manual'
    });
    
    updateScanStats();
    displayQAIResults(analysis);
    
    ledger.addEntry(data, 'MANUAL', {
      type: analysis.type || analysis.classification?.primary || 'Unknown',
      pattern: analysis.pattern,
      explanation: analysis.explanation || analysis.qnotes?.join(' ') || '',
      entropy: analysis.entropy,
      securityScore: analysis.security?.score,
      securityLevel: analysis.security?.level,
      decoded: analysis.decoded?.successes?.length || 0
    });
    
    setStatus('✅ Analysis complete', 'success');
  } catch (e) {
    console.warn(e);
    setStatus('QAI analysis failed', 'error');
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
//  MEMORY MANAGEMENT
// ============================================================================
window.addEventListener('beforeunload', () => {
  if (state.reader) {
    try { state.reader.reset(); } catch (_) {}
  }
  if (el.video && el.video.srcObject) {
    try { el.video.srcObject.getTracks().forEach(t => t.stop()); } catch (_) {}
  }
  brain.clearCache();
});

// ============================================================================
//  EXTERNAL API
// ============================================================================
window.__scanner = {
  state,
  CONFIG,
  brain,
  ledger,
  start,
  stop,
  flip,
  openLink,
  copyPayload,
  clearPayload,
  handleScan,
  detectDevice,
  getStats: () => ({
    scans: state.scanHistory.length,
    cacheSize: brain.cache?.size || 0,
    ready: state.ready,
    performanceMode: state.performanceMode,
    deviceType: state.isRaspberryPi ? 'Raspberry Pi' : 
                state.isMobile ? 'Mobile' : 'Desktop'
  })
};

// ============================================================================
//  ADDITIONAL CSS FOR QAI RESULTS AND OPEN LINK BUTTON
// ============================================================================
const style = document.createElement('style');
style.textContent = `
  .qai-results-panel {
    background: #0a0a1a;
    border: 1px solid #333;
    border-radius: 8px;
    padding: 12px;
    margin: 10px 0;
    max-height: 300px;
    overflow-y: auto;
    font-size: 13px;
  }
  
  .qai-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid #222;
  }
  
  .qai-badge {
    color: #0ff;
    font-weight: bold;
  }
  
  .qai-time {
    color: #666;
    font-size: 0.85em;
  }
  
  .qai-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }
  
  .qai-item {
    background: #111;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.9em;
  }
  
  .qai-item strong {
    color: #8af;
  }
  
  .qai-notes {
    font-size: 0.85em;
    line-height: 1.4;
  }
  
  .qai-notes br {
    margin-bottom: 2px;
  }
  
  /* Scanner bar enhancements */
  .scanner-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 8px;
    background: #0a0a1a;
    border-radius: 8px;
    margin: 8px 0;
  }
  
  .scanner-actions button {
    padding: 6px 12px;
    border: 1px solid #333;
    border-radius: 4px;
    background: #1a1a2a;
    color: #fff;
    cursor: pointer;
    font-size: 13px;
    transition: all 0.3s;
  }
  
  .scanner-actions button:hover {
    transform: scale(1.02);
  }
  
  .btn-open {
    border-color: #0f0 !important;
    color: #0f0 !important;
  }
  
  .btn-open:hover {
    background: #0f0 !important;
    color: #000 !important;
  }
  
  .btn-copy {
    border-color: #0ff !important;
    color: #0ff !important;
  }
  
  .btn-copy:hover {
    background: #0ff !important;
    color: #000 !important;
  }
  
  .btn-clear {
    border-color: #f00 !important;
    color: #f00 !important;
  }
  
  .btn-clear:hover {
    background: #f00 !important;
    color: #fff !important;
  }
  
  .btn-analyze {
    border-color: #f0f !important;
    color: #f0f !important;
  }
  
  .btn-analyze:hover {
    background: #f0f !important;
    color: #000 !important;
  }
  
  .scan-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    padding: 6px 12px;
    background: #0a0a1a;
    border-radius: 4px;
    font-size: 12px;
    color: #888;
    margin: 4px 0;
  }
  
  .scan-stats span {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  
  /* Mobile optimizations */
  @media (max-width: 768px) {
    .qai-grid {
      grid-template-columns: 1fr;
    }
    
    .scanner-actions {
      gap: 4px;
    }
    
    .scanner-actions button {
      padding: 8px 12px;
      font-size: 14px;
      flex: 1;
      min-width: 60px;
    }
  }
`;
document.head.appendChild(style);