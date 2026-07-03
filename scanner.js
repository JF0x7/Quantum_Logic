/**
 * Quantum Scanner Engine — ZXing + QAI + Ledger
 * iPhone 6 Optimized with Enhanced Scanning Output
 * - Visual feedback (flash, glow, animation)
 * - Haptic feedback (vibration patterns)
 * - Audio feedback (different beep patterns)
 * - Rich output display
 * - Copy to clipboard
 * - Share functionality
 * - Auto-save to ledger
 */

// ============================================================================
//  CONFIGURATION
// ============================================================================
const CONFIG = {
  cooldown: 2500,
  vibrate: true,
  autoRedirect: false, // Disabled for better UX on iPhone 6
  beep: { 
    success: { freq: 1200, volume: 0.08, duration: 0.15 },
    error: { freq: 400, volume: 0.06, duration: 0.3 },
    scan: { freq: 950, volume: 0.05, duration: 0.08 }
  },
  maxRetries: 2,
  frameRate: { ideal: 10, max: 15 },
  resolution: { width: 480, height: 360 },
  debug: false,
  flashOnScan: true,
  showPreview: true,
  autoCopy: false,
  hapticPattern: [50, 30, 50]
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
  scanCount: 0,
  scanHistory: [],
  facingModeIndex: 0
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
  scanIndicator: document.getElementById("scanIndicator")
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
  
  if (/iPhone|iPad|iPod/.test(ua)) {
    state.isMobile = true;
    if (window.screen.width <= 750 && window.screen.height <= 1334) {
      CONFIG.resolution = { width: 480, height: 360 };
      CONFIG.frameRate = { ideal: 8, max: 12 };
      state.performanceMode = true;
    }
  }
  
  if (/Raspberry|Pi|armv7l|armv6l/.test(ua) || navigator.hardwareConcurrency <= 4) {
    state.isRaspberryPi = true;
    CONFIG.resolution = { width: 320, height: 240 };
    CONFIG.frameRate = { ideal: 5, max: 8 };
    CONFIG.cooldown = 3000;
    state.performanceMode = true;
    CONFIG.vibrate = false;
    CONFIG.flashOnScan = false;
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
//  ENHANCED BEEP WITH VARIATIONS
// ============================================================================
function playBeep(type = 'scan') {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    
    const config = CONFIG.beep[type] || CONFIG.beep.scan;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.frequency.value = config.freq;
    gain.gain.value = config.volume;
    
    // Add slight variation for interest
    if (type === 'success') {
      osc.type = 'sine';
      // Add a second tone for success
      setTimeout(() => {
        try {
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.frequency.value = config.freq * 1.5;
          gain2.gain.value = config.volume * 0.6;
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.start();
          osc2.stop(ctx.currentTime + config.duration * 0.5);
        } catch(_) {}
      }, 50);
    } else {
      osc.type = 'square';
    }
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + config.duration);
    
    setTimeout(() => ctx.close(), 500);
  } catch (_) {}
}

// ============================================================================
//  ENHANCED HAPTIC FEEDBACK
// ============================================================================
function hapticFeedback(pattern) {
  if (!CONFIG.vibrate || !navigator.vibrate) return;
  
  try {
    if (Array.isArray(pattern)) {
      navigator.vibrate(pattern);
    } else if (typeof pattern === 'number') {
      navigator.vibrate(pattern);
    } else {
      navigator.vibrate([50, 30, 50]); // Default pattern
    }
  } catch (_) {}
}

// ============================================================================
//  VISUAL FEEDBACK
// ============================================================================
function flashScreen() {
  if (!CONFIG.flashOnScan) return;
  
  try {
    // Create flash overlay
    const flash = document.createElement('div');
    flash.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: white;
      z-index: 9999;
      pointer-events: none;
      opacity: 0.8;
      transition: opacity 0.3s ease;
    `;
    document.body.appendChild(flash);
    
    // Fade out and remove
    setTimeout(() => {
      flash.style.opacity = '0';
      setTimeout(() => {
        if (flash.parentNode) flash.parentNode.removeChild(flash);
      }, 300);
    }, 100);
  } catch (_) {}
}

function animateScanIndicator(type = 'success') {
  if (!el.scanIndicator) return;
  
  const colors = {
    success: '#22c55e',
    error: '#ef4444',
    scan: '#06b6d4'
  };
  
  el.scanIndicator.style.transition = 'background 0.3s ease, transform 0.3s ease';
  el.scanIndicator.style.background = colors[type] || colors.scan;
  el.scanIndicator.style.transform = 'scale(1.4)';
  
  setTimeout(() => {
    el.scanIndicator.style.transform = 'scale(1)';
  }, 300);
  
  setTimeout(() => {
    el.scanIndicator.style.background = '#4b5563';
  }, 800);
}

// ============================================================================
//  RICH OUTPUT FORMATTER
// ============================================================================
function formatOutput(data, analysis) {
  const timestamp = new Date().toLocaleString();
  const isURL = /^https?:\/\/[^\s]+/i.test(data);
  const isEmail = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(data);
  const isPhone = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/.test(data);
  const isCrypto = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(data) || /^0x[a-fA-F0-9]{40}$/.test(data);
  
  let typeLabel = 'Generic Data';
  let icon = '📄';
  let color = '#06b6d4';
  
  if (isURL) {
    typeLabel = 'URL Link';
    icon = '🔗';
    color = '#3b82f6';
  } else if (isEmail) {
    typeLabel = 'Email Address';
    icon = '📧';
    color = '#8b5cf6';
  } else if (isPhone) {
    typeLabel = 'Phone Number';
    icon = '📱';
    color = '#22c55e';
  } else if (isCrypto) {
    typeLabel = 'Crypto Address';
    icon = '₿';
    color = '#f59e0b';
  } else if (data.length > 100) {
    typeLabel = 'Long Text';
    icon = '📝';
    color = '#ec4899';
  } else if (/^[0-9]+$/.test(data)) {
    typeLabel = 'Numeric Code';
    icon = '🔢';
    color = '#14b8a6';
  }
  
  const formatted = `
    <div style="padding: 8px 0;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap;">
        <span style="font-size: 1.2rem;">${icon}</span>
        <span style="color: ${color}; font-weight: 600;">${typeLabel}</span>
        <span style="font-size: 0.75rem; color: #6b7280;">#${state.scanCount}</span>
        <span style="font-size: 0.7rem; color: #6b7280; margin-left: auto;">${timestamp}</span>
      </div>
      <div style="background: #1a1a2e; padding: 10px 12px; border-radius: 6px; word-break: break-all; font-family: monospace; font-size: 0.85rem; border-left: 3px solid ${color};">
        ${data}
      </div>
      ${analysis ? `
        <div style="margin-top: 6px; font-size: 0.7rem; color: #9ca3af; display: flex; flex-wrap: wrap; gap: 8px;">
          <span>📊 Entropy: ${analysis.entropy || 'N/A'}</span>
          <span>📏 Length: ${data.length}</span>
          ${analysis.type ? `<span>🏷️ Type: ${analysis.type}</span>` : ''}
        </div>
      ` : ''}
      <div style="margin-top: 6px; display: flex; gap: 6px; flex-wrap: wrap;">
        <button onclick="window.__scanner.copyToClipboard('${data.replace(/'/g, "\\'")}')" 
                style="font-size: 0.7rem; padding: 2px 10px; border-radius: 4px; border: 1px solid #374151; background: #1f2937; color: #e5e7eb; cursor: pointer;">
          📋 Copy
        </button>
        <button onclick="window.__scanner.shareData('${data.replace(/'/g, "\\'")}')" 
                style="font-size: 0.7rem; padding: 2px 10px; border-radius: 4px; border: 1px solid #374151; background: #1f2937; color: #e5e7eb; cursor: pointer;">
          📤 Share
        </button>
        <button onclick="window.__scanner.openLink('${data.replace(/'/g, "\\'")}')" 
                style="font-size: 0.7rem; padding: 2px 10px; border-radius: 4px; border: 1px solid #374151; background: #1f2937; color: #e5e7eb; cursor: pointer;">
          🌐 Open
        </button>
      </div>
    </div>
  `;
  
  return formatted;
}

// ============================================================================
//  ENHANCED INIT
// ============================================================================
async function init() {
  detectDevice();
  
  if (state.performanceMode) {
    setStatus(`⚡ Performance mode`, "neutral");
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
  setStatus("✅ Ready - Tap Start", "neutral");
  
  if (state.isMobile) {
    setTimeout(start, 500);
  }
}

// ============================================================================
//  ENHANCED START CAMERA
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
        if (result) {
          // Enhanced feedback on scan
          handleScan(result.getText());
        }
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
  setStatus("Using fallback…", "neutral");
  
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
      setStatus("📷 Fallback active", "success");
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
    
    setTimeout(captureFrame, state.performanceMode ? 800 : 400);
  }
  
  setTimeout(captureFrame, 500);
}

// ============================================================================
//  ENHANCED HANDLE SCAN - RICH OUTPUT
// ============================================================================
async function handleScan(data) {
  if (state.cooldown && data === state.lastScan) return;

  state.lastScan = data;
  state.cooldown = true;
  state.scanCount++;

  // ===== ENHANCED FEEDBACK =====
  // 1. Visual Flash
  flashScreen();
  
  // 2. Haptic Feedback (pattern)
  hapticFeedback(CONFIG.hapticPattern);
  
  // 3. Audio Feedback (success tone)
  playBeep('success');
  
  // 4. Animation
  animateScanIndicator('success');
  
  // 5. Status Update
  setStatus(`✅ Decoded! (${state.scanCount})`, "success");

  // ===== PROCESS WITH QAI =====
  let analysis = null;
  try {
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('QAI timeout')), 3000)
    );
    
    analysis = await Promise.race([
      brain.process(data),
      timeoutPromise
    ]);
  } catch (e) {
    console.warn("QAI error:", e);
  }

  // ===== RICH OUTPUT DISPLAY =====
  if (el.payload) {
    const formatted = formatOutput(data, analysis);
    el.payload.innerHTML = formatted;
  }

  // ===== AUTO-COPY =====
  if (CONFIG.autoCopy) {
    copyToClipboard(data);
  }

  // ===== LEDGER ENTRY =====
  try {
    ledger.addEntry(data, "SCAN", {
      type: analysis ? analysis.type : 'unknown',
      pattern: analysis ? analysis.pattern : null,
      entropy: analysis ? analysis.entropy : null,
      scanCount: state.scanCount
    });
  } catch (e) {
    console.warn('Ledger error:', e);
  }

  // ===== AUTO-REDIRECT (if configured) =====
  if (CONFIG.autoRedirect) {
    try {
      const isUrl = /^https?:\/\/[^\s]+/i.test(data);
      const url = isUrl ? data : `https://www.google.com/search?q=${encodeURIComponent(data)}`;
      window.open(url, "_blank");
    } catch (_) {}
  }

  // ===== COOLDOWN =====
  setTimeout(() => { 
    state.cooldown = false; 
    animateScanIndicator('scan');
  }, CONFIG.cooldown);
}

// ============================================================================
//  UTILITY FUNCTIONS FOR OUTPUT
// ============================================================================
function copyToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        setStatus('📋 Copied to clipboard!', 'success');
        setTimeout(() => setStatus('✅ Ready', 'neutral'), 1500);
      }).catch(() => {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  } catch (_) {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    setStatus('📋 Copied!', 'success');
    setTimeout(() => setStatus('✅ Ready', 'neutral'), 1500);
  } catch (_) {
    setStatus('❌ Copy failed', 'error');
  }
}

function shareData(text) {
  try {
    if (navigator.share) {
      navigator.share({
        title: 'QTUM Scan Result',
        text: text
      }).catch(() => {});
    } else {
      copyToClipboard(text);
    }
  } catch (_) {
    copyToClipboard(text);
  }
}

function openLink(text) {
  try {
    const isUrl = /^https?:\/\/[^\s]+/i.test(text);
    if (isUrl) {
      window.open(text, '_blank');
    } else {
      window.open(`https://www.google.com/search?q=${encodeURIComponent(text)}`, '_blank');
    }
  } catch (_) {}
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
  state.facingModeIndex = (state.facingModeIndex + 1) % modes.length;
  state.deviceId = null;
  setStatus(`🔄 ${modes[state.facingModeIndex]}`, "neutral");
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
      
      // Try to decode the captured image
      if (state.reader) {
        state.reader.decodeFromCanvas(el.canvas).then(result => {
          if (result) handleScan(result.getText());
        }).catch(() => {
          setStatus('📸 Photo saved - no code found', 'neutral');
        });
      }
      
      if (state.isMobile) {
        setTimeout(() => {
          el.photoPreview.style.display = 'none';
        }, 5000);
      }
    }
    
    playBeep('scan');
    animateScanIndicator('scan');
    
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
  
  setStatus('📤 Processing…', 'neutral');
  const url = URL.createObjectURL(file);
  
  try {
    if (state.reader && typeof state.reader.decodeFromImageUrl === 'function') {
      const result = await state.reader.decodeFromImageUrl(url);
      await handleScan(result.getText());
    } else if (state.reader && typeof state.reader.decodeFromCanvas === 'function') {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        state.reader.decodeFromCanvas(canvas).then(result => {
          if (result) handleScan(result.getText());
        }).catch(() => setStatus('❌ No code found', 'error'));
      };
      img.src = url;
    } else {
      setStatus('❌ Decoder unavailable', 'error');
    }
  } catch (err) {
    console.warn(err);
    setStatus('❌ Decode failed', 'error');
  } finally {
    if (el.fileInput) el.fileInput.value = '';
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}

// ============================================================================
//  HANDLE SEND
// ============================================================================
async function handleSend() {
  const data = el.payload?.textContent || '';
  if (!data) {
    setStatus('❌ No payload', 'error');
    return;
  }
  
  setStatus('📡 Analyzing…', 'neutral');
  try {
    const analysis = await brain.process(data);
    ledger.addEntry(data, 'MANUAL', {
      type: analysis.type || 'unknown',
      pattern: analysis.pattern || null,
      entropy: analysis.entropy || null
    });
    setStatus('✅ Signal logged', 'success');
    playBeep('success');
    animateScanIndicator('success');
  } catch (e) {
    console.warn(e);
    setStatus('❌ Analysis failed', 'error');
    ledger.addEntry(data, 'MANUAL', { error: e.message });
    playBeep('error');
  }
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
  });

  if (el.upload && el.fileInput) {
    el.upload.addEventListener('click', () => el.fileInput.click(), { passive: true });
    el.fileInput.addEventListener('change', handleFileUpload, { passive: true });
  }

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
//  BOOTSTRAP
// ============================================================================
document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', init)
  : init();

// ============================================================================
//  CLEANUP
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
//  EXTERNAL API
// ============================================================================
window.__scanner = {
  state,
  CONFIG,
  start,
  stop,
  flip,
  ledger,
  handleScan,
  detectDevice,
  copyToClipboard,
  shareData,
  openLink,
  capturePhoto,
  playBeep,
  hapticFeedback,
  flashScreen,
  animateScanIndicator,
  formatOutput
};
