/**
 * QtumScanner v3.0 - Rich Barcode Analyzer
 * Displays 7-8 pieces of barcode info in ledger
 */

class QtumScanner extends EventTarget {
  constructor(qai, ledger) {
    super();
    this.qai = qai;
    this.ledger = ledger;

    // DOM Elements
    this.video = document.getElementById('video');
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.preview = document.getElementById('photoPreview');
    this.status = document.getElementById('status');
    this.payloadDiv = document.getElementById('payload');
    this.indicator = document.getElementById('scanIndicator');
    this.scanOverlay = document.getElementById('scanOverlay');

    // State
    this.currentPayload = '';
    this.codeReader = null;
    this.cameraId = null;
    this.stream = null;
    this.isScanning = false;
    this.isProcessing = false;
    this.totalScans = 0;

    this.bindEvents();
    console.log('📷 Scanner v3.0 initialized');
  }

  bindEvents() {
    const startBtn = document.getElementById('startBtn');
    const flipBtn = document.getElementById('flipBtn');
    const uploadBtn = document.getElementById('uploadBtn');
    const fileInput = document.getElementById('fileInput');
    const photoBtn = document.getElementById('photoBtn');
    const sendBtn = document.getElementById('sendBtn');
    const clearBtn = document.getElementById('clearBtn');
    const exportBtn = document.getElementById('exportBtn');
    const importBtn = document.getElementById('importBtn');
    const importInput = document.getElementById('importInput');

    if (startBtn) startBtn.addEventListener('click', () => this.toggleCamera());
    if (flipBtn) flipBtn.addEventListener('click', () => this.flipCamera());
    if (uploadBtn) uploadBtn.addEventListener('click', () => fileInput?.click());
    if (fileInput) fileInput.addEventListener('change', (e) => this.handleUpload(e));
    if (photoBtn) photoBtn.addEventListener('click', () => this.takePhoto());
    if (sendBtn) sendBtn.addEventListener('click', () => this.sendSignal());
    if (clearBtn) clearBtn.addEventListener('click', () => this.clearAll());
    if (exportBtn) exportBtn.addEventListener('click', () => this.exportData());
    if (importBtn) importBtn.addEventListener('click', () => importInput?.click());
    if (importInput) importInput.addEventListener('change', (e) => this.importData(e));

    if (this.preview) {
      this.preview.addEventListener('click', () => {
        this.preview.style.display = 'none';
        this.setStatus('Ready', 'neutral');
      });
    }
  }

  // ===== CAMERA =====
  async toggleCamera() {
    this.stream ? await this.stopCamera() : await this.startCamera();
  }

  async startCamera() {
    try {
      this.setStatus('⏳ Starting camera...', 'warning');

      if (this.stream) {
        this.stream.getTracks().forEach(t => t.stop());
        this.stream = null;
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(d => d.kind === 'videoinput');
      if (!cameras.length) throw new Error('No camera found');

      this.cameraId = this.cameraId || cameras[0].deviceId;

      const constraints = {
        video: {
          deviceId: { exact: this.cameraId },
          facingMode: 'environment',
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (this.video) {
        this.video.srcObject = this.stream;
        await this.video.play();
      }

      if (this.scanOverlay) this.scanOverlay.classList.add('active');

      this.setStatus('📷 Camera ready - scanning...', 'success');
      this.startScanning();

      const startBtn = document.getElementById('startBtn');
      if (startBtn) startBtn.textContent = '⏹ Stop';

    } catch (err) {
      this.setStatus(`❌ Camera error: ${err.message}`, 'error');
      console.error('Camera error:', err);
    }
  }

  async stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    this.stopScanning();
    if (this.video) this.video.srcObject = null;
    if (this.scanOverlay) this.scanOverlay.classList.remove('active');

    const startBtn = document.getElementById('startBtn');
    if (startBtn) startBtn.textContent = '▶ Camera';

    this.setStatus('Camera stopped', 'info');
  }

  async flipCamera() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(d => d.kind === 'videoinput');
      if (cameras.length < 2) {
        this.setStatus('⚠️ Only one camera available', 'warning');
        return;
      }
      const currentIdx = cameras.findIndex(d => d.deviceId === this.cameraId);
      const nextIdx = (currentIdx + 1) % cameras.length;
      this.cameraId = cameras[nextIdx].deviceId;
      await this.stopCamera();
      await this.startCamera();
    } catch (err) {
      this.setStatus(`❌ Flip failed: ${err.message}`, 'error');
    }
  }

  // ===== SCANNING =====
  startScanning() {
    if (this.isScanning) return;
    this.isScanning = true;

    try {
      if (typeof ZXing === 'undefined') {
        setTimeout(() => this.startScanning(), 1000);
        return;
      }

      this.codeReader = new ZXing.BrowserMultiFormatReader();
      this.codeReader.decodeFromVideoDevice(
        this.cameraId,
        this.video,
        async (result, err) => {
          if (result && !this.isProcessing && this.isScanning) {
            this.isProcessing = true;
            await this.handleScan(result.text);
            this.isProcessing = false;
          }
        }
      );
    } catch (err) {
      console.error('Scanning error:', err);
      this.isScanning = false;
    }
  }

  stopScanning() {
    this.isScanning = false;
    if (this.codeReader) {
      try { this.codeReader.reset(); } catch (e) {}
      this.codeReader = null;
    }
  }

  // ===== SCAN HANDLING - RICH OUTPUT =====
  async handleScan(text) {
    if (!text) return;

    this.currentPayload = text;
    if (this.payloadDiv) this.payloadDiv.textContent = text;
    if (this.preview) this.preview.style.display = 'none';

    this.totalScans++;

    // Visual feedback
    if (this.indicator) {
      this.indicator.classList.add('active');
      setTimeout(() => this.indicator.classList.remove('active'), 500);
    }

    try {
      // Process with QAI - gets rich barcode analysis
      const report = await this.qai.process(text);

      // Build rich entry with 8 pieces of info
      const entry = this.buildRichEntry(text, report);

      // Add to ledger with rich data
      this.ledger.addEntry(entry, entry.tag, report);

      // Update UI
      this.setStatus(`✅ Scanned #${this.totalScans} - ${entry.barcodeType || 'Data'}`, 'success');
      this.updateLedgerCount();

      // Emit event
      this.dispatchEvent(new CustomEvent('scan', {
        detail: { text, report, entry, total: this.totalScans }
      }));

    } catch (err) {
      console.error('QAI error:', err);
      // Fallback entry
      const fallbackEntry = {
        raw: text,
        type: 'UNKNOWN',
        tag: 'SCAN',
        timestamp: Date.now(),
        info: {
          'Raw Data': text.slice(0, 50) + (text.length > 50 ? '...' : ''),
          'Length': text.length,
          'Type': 'Unknown',
          'Valid': 'N/A',
          'Confidence': 'Low',
          'Status': 'Fallback Mode'
        }
      };
      this.ledger.addEntry(fallbackEntry, 'SCAN');
      this.setStatus('QAI offline — scan logged', 'warning');
      this.updateLedgerCount();
    }
  }

  // ===== BUILD RICH ENTRY WITH 8 PIECES OF INFO =====
  buildRichEntry(text, report) {
    const now = new Date();
    const barcode = report.barcode || {};
    const patterns = report.patterns || {};
    const moderation = report.moderation || {};

    // Determine barcode type
    let barcodeType = barcode.type || 'Unknown';
    let barcodeValid = barcode.valid ? '✅ Valid' : '❌ Invalid';
    let barcodeConfidence = barcode.confidence ? `${Math.round(barcode.confidence * 100)}%` : 'N/A';

    // Pattern detection
    let patternType = patterns.type || 'None';
    let hasPattern = patterns.matched || false;

    // Determine tag
    let tag = 'SCAN';
    if (barcode.valid) tag = 'BARCODE';
    else if (hasPattern) tag = 'PATTERN';
    if (!moderation.allow) tag = 'FLAGGED';

    // Build rich entry with 8 pieces of info
    return {
      // 1. Raw Data
      raw: text,

      // 2. Barcode Type
      barcodeType: barcodeType,

      // 3. Validation Status
      valid: barcodeValid,

      // 4. Confidence Score
      confidence: barcodeConfidence,

      // 5. Pattern Detected
      pattern: patternType,

      // 6. Content Moderation
      status: moderation.allow ? 'Clean ✅' : 'Flagged ⚠️',

      // 7. Severity
      severity: moderation.severity || 'Low',

      // 8. Length & Metadata
      length: text.length,
      timestamp: now.toLocaleString(),
      tag: tag,

      // Additional info object for display
      info: {
        'Barcode Type': barcodeType,
        'Valid': barcodeValid,
        'Confidence': barcodeConfidence,
        'Pattern': patternType,
        'Status': moderation.allow ? '✅ Clean' : '⚠️ Flagged',
        'Severity': (moderation.severity || 'Low').
