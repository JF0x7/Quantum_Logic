class QtumScanner {
  constructor(ledger) {
    this.ledger = ledger;
    this.video = document.getElementById('video');
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.preview = document.getElementById('photoPreview');
    this.status = document.getElementById('status');
    this.payloadDiv = document.getElementById('payload');
    this.indicator = document.getElementById('scanIndicator');
    this.currentPayload = '';
    this.codeReader = null;
    this.cameraId = null;
    this.stream = null;
    this.isScanning = false;
    
    this.bindEvents();
  }

  bindEvents() {
    document.getElementById('startBtn').addEventListener('click', () => this.startCamera());
    document.getElementById('flipBtn').addEventListener('click', () => this.flipCamera());
    document.getElementById('uploadBtn').addEventListener('click', () => document.getElementById('fileInput').click());
    document.getElementById('fileInput').addEventListener('change', (e) => this.handleUpload(e));
    document.getElementById('photoBtn').addEventListener('click', () => this.takePhoto());
    document.getElementById('sendBtn').addEventListener('click', () => this.sendSignal());
    document.getElementById('resetLedgerBtn').addEventListener('click', () => this.ledger.clear());
  }

  async startCamera() {
    try {
      if (this.stream) {
        this.stream.getTracks().forEach(t => t.stop());
        this.stream = null;
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(d => d.kind === 'videoinput');
      if (!cameras.length) throw new Error('No camera found');
      this.cameraId = this.cameraId || cameras[0].deviceId;
      const constraints = { video: { deviceId: { exact: this.cameraId }, facingMode: 'environment' } };
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.video.srcObject = this.stream;
      await this.video.play();
      this.status.textContent = '📷 Camera ready';
      this.status.className = '';
      this.startScanning();
    } catch (err) {
      this.status.textContent = '❌ Camera error: ' + err.message;
      this.status.className = 'neutral';
    }
  }

  async flipCamera() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(d => d.kind === 'videoinput');
      if (cameras.length < 2) {
        this.status.textContent = '⚠️ Only one camera available';
        return;
      }
      const currentIdx = cameras.findIndex(d => d.deviceId === this.cameraId);
      const nextIdx = (currentIdx + 1) % cameras.length;
      this.cameraId = cameras[nextIdx].deviceId;
      await this.startCamera();
    } catch (err) {
      this.status.textContent = '❌ Flip failed: ' + err.message;
    }
  }

  startScanning() {
    if (this.isScanning) return;
    this.isScanning = true;
    this.codeReader = new ZXing.BrowserMultiFormatReader();
    this.codeReader.decodeFromVideoDevice(this.cameraId, this.video, (result, err) => {
      if (result) {
        this.handleScan(result.text);
        this.indicator.style.background = '#4af';
        setTimeout(() => this.indicator.style.background = '#1f2c3d', 300);
      }
      if (err && !(err instanceof ZXing.NotFoundException)) {
        console.warn('Scan error:', err);
      }
    });
  }

  handleScan(text) {
    this.currentPayload = text;
    this.payloadDiv.textContent = text;
    this.status.textContent = '✅ Scanned!';
    this.status.className = '';
    this.ledger.addEntry(text, 'SCAN');
    this.preview.style.display = 'none';
  }

  handleUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const img = new Image();
      img.onload = async () => {
        this.preview.src = e.target.result;
        this.preview.style.display = 'block';
        try {
          const codeReader = new ZXing.BrowserMultiFormatReader();
          const result = await codeReader.decodeFromImageElement(img);
          this.handleScan(result.text);
        } catch (err) {
          this.status.textContent = '❌ No code found in image';
          this.status.className = 'neutral';
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  takePhoto() {
    if (!this.video.videoWidth) {
      this.status.textContent = '⚠️ Start camera first';
      return;
    }
    this.canvas.width = this.video.videoWidth;
    this.canvas.height = this.video.videoHeight;
    this.ctx.drawImage(this.video, 0, 0);
    const dataUrl = this.canvas.toDataURL('image/jpeg');
    this.preview.src = dataUrl;
    this.preview.style.display = 'block';
    this.status.textContent = '📸 Photo captured';
  }

  sendSignal() {
    const payload = this.currentPayload || 'VOID_SIGNAL_' + Date.now();
    this.ledger.addEntry(payload, 'SIGNAL');
    this.status.textContent = `✦ Signal sent${!this.currentPayload ? ' (void)' : ''}`;
    this.payloadDiv.textContent = payload;
    this.indicator.style.background = '#f0a';
    setTimeout(() => this.indicator.style.background = '#1f2c3d', 400);
    // "send to space" - just log it
    if (!this.currentPayload) {
      this.currentPayload = payload;
    }
  }
}

// Make it available globally
window.QtumScanner = QtumScanner;
