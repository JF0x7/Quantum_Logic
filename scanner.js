/**
 * QtumScanner v2.0 - Vision-enabled scanner with direct AI integration
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
    this.flaggedItems = 0;

    // Initialize
    this.bindEvents();
    this.setupExportImport();
    console.log('📷 Scanner initialized');
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

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && this.currentPayload) {
        this.sendSignal();
      }
      if (e.key === ' ' && e.target === document.body) {
        e.preventDefault();
        this.toggleCamera();
      }
    });
  }

  setupExportImport() {
    // Export/Import already bound in bindEvents
  }

  // ========== CAMERA CONTROLS ==========
  async toggleCamera() {
    if (this.stream) {
      await this.stopCamera();
    } else {
      await this.startCamera();
    }
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

      // Show scan overlay
      if (this.scanOverlay) {
        this.scanOverlay.classList.add('active');
      }

      this.setStatus('📷 Camera ready - scanning...', 'success');
      this.startScanning();
      
      // Update button
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
    
    // Hide scan overlay
    if (this.scanOverlay) {
      this.scanOverlay.classList.remove('active');
    }
    
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

  // ========== SCANNING ==========
  startScanning() {
    if (this.isScanning) return;
    this.isScanning = true;

    try {
      if (typeof ZXing === 'undefined') {
        console.warn('ZXing not loaded, retrying...');
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
      try {
        this.codeReader.reset();
      } catch (e) {}
      this.codeReader = null;
    }
  }

  // ========== SCAN HANDLING ==========
  async handleScan(text) {
    if (!text) return;
    
    this.currentPayload = text;
    if (this.payloadDiv) this.payloadDiv.textContent = text;
    if (this.preview) this.preview.style.display = 'none';

    this.totalScans++;

    // Visual feedback
    if (this.indicator) {
      this.indicator.classList.add('active');
      setTimeout(() => {
        if (this.indicator) this.indicator.classList.remove('active');
      }, 500);
    }

    try {
      // Use QAI for processing
      const report = await this.qai.process(text);
      const clean = report.moderation.allow;
      const tag = clean ? 'SCAN' : 'FLAGGED';
      
      if (!clean) this.flaggedItems++;
      
      // Add to ledger with AI report
      this.ledger.addEntry(text, tag, report);
      
      this.setStatus(
        clean ? `✅ Scanned (clean) - #${this.totalScans}` : `⚠️ Scanned (flagged) - #${this.totalScans}`, 
        clean ? 'success' : 'warning'
      );
      
      // Update ledger count
      this.updateLedgerCount();
      
      // Emit scan event
      this.dispatchEvent(new CustomEvent('scan', { 
        detail: { text, clean, tag, report, total: this.totalScans }
      }));
      
    } catch (err) {
      console.error('QAI error:', err);
      this.ledger.addEntry(text, 'SCAN');
      this.setStatus('QAI offline — scan logged', 'warning');
      this.updateLedgerCount();
    }
  }

  // ========== IMAGE HANDLING ==========
  async handleUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = async () => {
        if (this.preview) {
          this.preview.src = e.target.result;
          this.preview.style.display = 'block';
        }

        const report = {
          original: "[IMAGE UPLOAD]",
          moderation: { allow: true, verdict: "image", flags: [], entropy: 0 },
          itemType: "image artifact",
          timestamp: Date.now()
        };

        this.ledger.addEntry("[IMAGE]", "IMAGE", report);
        this.setStatus("🖼 Image uploaded", 'success');
        this.updateLedgerCount();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  async takePhoto() {
    if (!this.video || !this.video.videoWidth) {
      this.setStatus('⚠️ Start camera first', 'warning');
      return;
    }

    this.canvas.width = this.video.videoWidth;
    this.canvas.height = this.video.videoHeight;
    this.ctx.drawImage(this.video, 0, 0);

    const dataUrl = this.canvas.toDataURL('image/jpeg');
    if (this.preview) {
      this.preview.src = dataUrl;
      this.preview.style.display = 'block';
    }

    const report = {
      original: "[SNAPSHOT]",
      moderation: { allow: true, verdict: "image", flags: [], entropy: 0 },
      itemType: "snapshot artifact",
      timestamp: Date.now()
    };

    this.ledger.addEntry("[SNAPSHOT]", "IMAGE", report);
    this.setStatus("📸 Snapshot captured", 'success');
    this.updateLedgerCount();
  }

  // ========== SIGNAL ==========
  sendSignal(payload) {
    const signal = payload || this.currentPayload || ('SIGNAL_' + Date.now());
    
    if (Array.isArray(signal)) {
      this.ledger.addBatch(signal, 'SIGNAL');
      this.setStatus(`✦ ${signal.length} signals sent`, 'success');
      if (this.payloadDiv) this.payloadDiv.textContent = signal.join(', ');
      this.updateLedgerCount();
      return;
    }

    this.ledger.addEntry(signal, 'SIGNAL');
    this.setStatus('✦ Signal sent', 'success');
    if (this.payloadDiv) this.payloadDiv.textContent = signal;

    if (!this.currentPayload) this.currentPayload = signal;

    // Visual feedback
    if (this.indicator) {
      this.indicator.style.background = '#f0a';
      setTimeout(() => {
        if (this.indicator) this.indicator.style.background = '#1f2c3d';
      }, 400);
    }
    
    this.updateLedgerCount();

    this.dispatchEvent(new CustomEvent('signal', { 
      detail: { payload: signal, timestamp: Date.now() }
    }));
  }

  // ========== LEDGER MANAGEMENT ==========
  clearAll() {
    if (confirm('Clear all ledger entries?')) {
      this.ledger.clear();
      this.totalScans = 0;
      this.flaggedItems = 0;
      this.updateLedgerCount();
      this.setStatus('🗑️ Ledger cleared', 'info');
    }
  }

  updateLedgerCount() {
    const countEl = document.getElementById('ledgerCount');
    if (countEl && this.ledger) {
      const entries = this.ledger.getEntries();
      countEl.textContent = `${entries.length} entries`;
    }
  }

  // ========== EXPORT / IMPORT ==========
  exportData() {
    const entries = this.ledger.getEntries();
    const data = {
      version: '2.0',
      timestamp: Date.now(),
      totalScans: this.totalScans,
      flaggedItems: this.flaggedItems,
      ledger: entries,
      qai: {
        version: this.qai?.version || 'unknown',
        ready: this.qai?.isReady() || false
      }
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qtum_log_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    this.setStatus('📤 Data exported', 'success');
  }

  importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.ledger && Array.isArray(data.ledger)) {
          this.ledger.import(data.ledger);
          this.totalScans = data.totalScans || data.ledger.length;
          this.flaggedItems = data.flaggedItems || 0;
          this.updateLedgerCount();
          this.setStatus(`📥 Imported ${data.ledger.length} entries`, 'success');
          
          this.dispatchEvent(new CustomEvent('import', { 
            detail: { count: data.ledger.length }
          }));
        } else {
          throw new Error('Invalid data format');
        }
      } catch (error) {
        this.setStatus(`❌ Import failed: ${error.message}`, 'error');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  // ========== UI HELPERS ==========
  setStatus(text, cls = 'neutral') {
    if (this.status) {
      this.status.textContent = text;
      this.status.className = cls;
    }
  }

  // ========== CLEANUP ==========
  destroy() {
    this.stopCamera();
    this.stopScanning();
  }
}

// Export for use
window.QtumScanner = QtumScanner;
