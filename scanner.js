/**
 * Scanner · Eyes
 * Camera capture and barcode scanning
 */

class QtumScanner extends EventTarget {
  constructor(qai) {
    super();
    this.qai = qai;
    this.ledger = null;
    this.totalScans = 0;

    // DOM
    this.video = document.getElementById('video');
    this.preview = document.getElementById('photoPreview');
    this.payload = document.getElementById('payload');
    this.status = document.getElementById('status');
    this.indicator = document.getElementById('scanIndicator');
    this.scanFrame = document.getElementById('scanFrame');

    // State
    this.stream = null;
    this.cameraId = null;
    this.reader = null;
    this.isScanning = false;
    this.isProcessing = false;
    this.currentText = '';

    this.bindEvents();
  }

  setLedger(ledger) {
    this.ledger = ledger;
  }

  bindEvents() {
    document.getElementById('startBtn').addEventListener('click', () => this.toggle());
    document.getElementById('flipBtn').addEventListener('click', () => this.flip());
    document.getElementById('photoBtn').addEventListener('click', () => this.snap());
    document.getElementById('uploadBtn').addEventListener('click', () => {
      document.getElementById('fileInput').click();
    });
    document.getElementById('fileInput').addEventListener('change', (e) => this.upload(e));
    document.getElementById('sendBtn').addEventListener('click', () => this.signal());
    document.getElementById('clearBtn').addEventListener('click', () => this.clear());

    // Export/Import from ledger
    document.getElementById('exportBtn').addEventListener('click', () => {
      if (this.ledger) this.ledger.export();
    });
    document.getElementById('importBtn').addEventListener('click', () => {
      document.getElementById('importInput').click();
    });
    document.getElementById('importInput').addEventListener('change', (e) => {
      if (this.ledger) this.ledger.import(e);
    });

    // Preview click to dismiss
    this.preview.addEventListener('click', () => {
      this.preview.style.display = 'none';
      this.setStatus('ready');
    });
  }

  // ===== CAMERA =====
  async toggle() {
    this.stream ? this.stop() : this.start();
  }

  async start() {
    try {
      this.setStatus('starting...', 'info');

      if (this.stream) {
        this.stream.getTracks().forEach(t => t.stop());
        this.stream = null;
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(d => d.kind === 'videoinput');
      if (!cameras.length) throw new Error('No camera');

      this.cameraId = this.cameraId || cameras[0].deviceId;

      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: this.cameraId }, width: { ideal: 640 }, height: { ideal: 480 } }
      });

      this.video.srcObject = this.stream;
      await this.video.play();

      this.scanFrame.classList.add('active');
      this.setStatus('scanning', 'info');
      document.getElementById('startBtn').textContent = '●';
      document.getElementById('startBtn').className = 'primary';

      this.startScanning();

    } catch (err) {
      this.setStatus('camera error', 'error');
      console.error(err);
    }
  }

  async stop() {
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    this.stopScanning();
    this.video.srcObject = null;
    this.scanFrame.classList.remove('active');
    this.setStatus('stopped');
    document.getElementById('startBtn').textContent = '○';
    document.getElementById('startBtn').className = '';
  }

  async flip() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(d => d.kind === 'videoinput');
      if (cameras.length < 2) {
        this.setStatus('only one camera', 'warning');
        return;
      }
      const idx = cameras.findIndex(d => d.deviceId === this.cameraId);
      this.cameraId = cameras[(idx + 1) % cameras.length].deviceId;
      await this.stop();
      await this.start();
    } catch (err) {
      this.setStatus('flip failed', 'error');
    }
  }

  // ===== SCANNING =====
  startScanning() {
    if (this.isScanning) return;
    this.isScanning = true;

    try {
      if (typeof ZXing === 'undefined') {
        setTimeout(() => this.startScanning(), 500);
        return;
      }

      this.reader = new ZXing.BrowserMultiFormatReader();
      this.reader.decodeFromVideoDevice(this.cameraId, this.video, (result, err) => {
        if (result && !this.isProcessing && this.isScanning) {
          this.isProcessing = true;
          this.handleScan(result.text);
          this.isProcessing = false;
        }
      });
    } catch (err) {
      console.error('Scan error:', err);
      this.isScanning = false;
    }
  }

  stopScanning() {
    this.isScanning = false;
    if (this.reader) {
      try { this.reader.reset(); } catch (e) {}
      this.reader = null;
    }
  }

  // ===== HANDLE SCAN =====
  handleScan(text) {
    if (!text) return;
    this.currentText = text;
    this.payload.textContent = text;
    this.preview.style.display = 'none';

    this.totalScans++;
    this.dispatchEvent(new CustomEvent('scan', { detail: { text, total: this.totalScans } }));

    // Visual feedback
    this.indicator.classList.add('active');
    setTimeout(() => this.indicator.classList.remove('active'), 400);

    // QAI analysis
    try {
      const analysis = this.qai.process(text);
      const tag = analysis.valid ? 'barcode' : 'scan';
      const isFlagged = analysis.type === null && analysis.pattern === null;

      if (isFlagged) {
        this.indicator.classList.add('flagged');
        setTimeout(() => this.indicator.classList.remove('flagged'), 1500);
        this.setStatus('⚠️ unknown', 'warning');
      } else {
        this.setStatus(`✓ ${analysis.type || analysis.pattern || 'data'}`, 'success');
      }

      // Add to ledger
      if (this.ledger) {
        this.ledger.add(text, analysis, tag);
      }

    } catch (err) {
      console.error('QAI error:', err);
      if (this.ledger) {
        this.ledger.add(text, null, 'scan');
      }
      this.setStatus('offline', 'warning');
    }
  }

  // ===== PHOTO =====
  snap() {
    if (!this.video.videoWidth) {
      this.setStatus('start camera', 'warning');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = this.video.videoWidth;
    canvas.height = this.video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(this.video, 0, 0);
    this.preview.src = canvas.toDataURL('image/jpeg');
    this.preview.style.display = 'block';
    this.setStatus('snapshot', 'info');
  }

  // ===== UPLOAD =====
  upload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      this.preview.src = e.target.result;
      this.preview.style.display = 'block';
      this.setStatus('uploaded', 'info');
      
      // Try to scan from image
      const img = new Image();
      img.onload = () => {
        // Simple text extraction from filename
        const text = file.name.replace(/\.[^/.]+$/, '');
        if (text.length > 3) {
          this.handleScan(text);
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  // ===== SIGNAL =====
  signal() {
    const text = this.currentText || `SIG_${Date.now().toString(36)}`;
    if (this.ledger) {
      this.ledger.add(text, null, 'signal');
    }
    this.setStatus('✦ signal', 'info');
    this.payload.textContent = text;
    this.indicator.style.background = 'var(--yellow)';
    setTimeout(() => this.indicator.style.background =
