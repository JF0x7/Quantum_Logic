/**
 * QtumScanner v2.0 - Vision-enabled scanner with event system
 */

class QtumScanner extends EventTarget {
  constructor(qai, ledger, mastermind) {
    super();
    this.qai = qai;
    this.ledger = ledger;
    this.mastermind = mastermind;

    // DOM Elements
    this.video = document.getElementById('video');
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.preview = document.getElementById('photoPreview');
    this.status = document.getElementById('status');
    this.payloadDiv = document.getElementById('payload');
    this.indicator = document.getElementById('scanIndicator');

    // State
    this.currentPayload = '';
    this.codeReader = null;
    this.cameraId = null;
    this.stream = null;
    this.isScanning = false;
    this.isProcessing = false;

    // Initialize
    this.bindEvents();
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

    if (startBtn) startBtn.addEventListener('click', () => this.toggleCamera());
    if (flipBtn) flipBtn.addEventListener('click', () => this.flipCamera());
    if (uploadBtn) uploadBtn.addEventListener('click', () => fileInput?.click());
    if (fileInput) fileInput.addEventListener('change', (e) => this.handleUpload(e));
    if (photoBtn) photoBtn.addEventListener('click', () => this.takePhoto());
    if (sendBtn) sendBtn.addEventListener('click', () => this.sendSignal());
    if (clearBtn) clearBtn.addEventListener('click', () => this.mastermind?.clearAll());

    if (this.preview) {
      this.preview.addEventListener('click', () => {
        this.preview.style.display = 'none';
        this.emit('status', { message: 'Ready', type: 'neutral' });
      });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && this.currentPayload) {
        this.sendSignal();
      }
    });
  }

  async toggleCamera() {
    if (this.stream) {
      await this.stopCamera();
    } else {
      await this.startCamera();
    }
  }

  async startCamera() {
    try {
      this.emit('status', { message: '⏳ Starting camera...', type: 'warning' });

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

      this.emit('status', { message: '📷 Camera ready - scanning...', type: 'success' });
      this.startScanning();
      
      // Update button
      const startBtn = document.getElementById('startBtn');
      if (startBtn) startBtn.textContent = '⏹ Stop';
      
    } catch (err) {
      this.emit('error', err);
      this.emit('status', { message: `❌ Camera error: ${err.message}`, type: 'error' });
    }
  }

  async stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    this.stopScanning();
    if (this.video) this.video.srcObject = null;
    
    const startBtn = document.getElementById('startBtn');
    if (startBtn) startBtn.textContent = '▶ Camera';
    
    this.emit('status', { message: 'Camera stopped', type: 'info' });
  }

  async flipCamera() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(d => d.kind === 'videoinput');
      if (cameras.length < 2) {
        this.emit('status', { message: '⚠️ Only one camera available', type: 'warning' });
        return;
      }
      const currentIdx = cameras.findIndex(d => d.deviceId === this.cameraId);
      const nextIdx = (currentIdx + 1) % cameras.length;
      this.cameraId = cameras[nextIdx].deviceId;
      await this.stopCamera();
      await this.startCamera();
    } catch (err) {
      this.emit('error', err);
    }
  }

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

  async handleScan(text) {
    if (!text) return;
    
    this.currentPayload = text;
    if (this.payloadDiv) this.payloadDiv.textContent = text;
    if (this.preview) this.preview.style.display = 'none';

    // Visual feedback
    if (this.indicator) {
      this.indicator.style.background = '#4af';
      setTimeout(() => {
        if (this.indicator) this.indicator.style.background = '#1f2c3d';
      }, 300);
    }

    try {
      const report = await this.qai.process(text);
      const clean = report.moderation.allow;
      const tag = clean ? 'SCAN' : 'FLAGGED';
      
      this.ledger.addEntry(text, tag, report);
      
      this.emit('scan', { 
        text, 
        clean, 
        tag, 
        report,
        timestamp: Date.now() 
      });
      
      this.emit('status', { 
        message: clean ? '✅ Scanned (clean)' : '⚠️ Scanned (flagged)', 
        type: clean ? 'success' : 'warning' 
      });
      
    } catch (err) {
      console.error('QAI error:', err);
      this.ledger.addEntry(text, 'SCAN');
      this.emit('status', { message: 'QAI offline — scan logged', type: 'warning' });
    }
  }

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
        this.emit('status', { message: "🖼 Image uploaded", type: 'success' });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  async takePhoto() {
    if (!this.video || !this.video.videoWidth) {
      this.emit('status', { message: '⚠️ Start camera first', type: 'warning' });
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
    this.emit('status', { message: "📸 Snapshot captured", type: 'success' });
  }

  sendSignal(payload) {
    const signal = payload || this.currentPayload || ('SIGNAL_' + Date.now());
    
    if (Array.isArray(signal)) {
      this.ledger.addBatch(signal, 'SIGNAL');
      this.emit('status', { message: `✦ ${signal.length} signals sent`, type: 'success' });
      if (this.payloadDiv) this.payloadDiv.textContent = signal.join(', ');
      return;
    }

    this.ledger.addEntry(signal, 'SIGNAL');
    this.emit('status', { message: '✦ Signal sent', type: 'success' });
    if (this.payloadDiv) this.payloadDiv.textContent = signal;

    if (!this.currentPayload) this.currentPayload = signal;

    // Visual feedback
    if (this.indicator) {
      this.indicator.style.background = '#f0a';
      setTimeout(() => {
        if (this.indicator) this.indicator.style.background = '#1f2c3d';
      }, 400);
    }

    this.emit('signal', { payload: signal, timestamp: Date.now() });
  }

  // Event emitter
  emit(event, detail) {
    this.dispatchEvent(new CustomEvent(event, { detail }));
  }

  // Cleanup
  destroy() {
    this.stopCamera();
    this.stopScanning();
  }
}

window.QtumScanner = QtumScanner;
