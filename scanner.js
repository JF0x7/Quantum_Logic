/* 
  Scanner version 3.1
*/

const qai = new Qai();

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
    this.isProcessing = false;

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.bindEvents());
    } else {
      this.bindEvents();
    }
  }

  setStatus(text, cls = '') {
    this.status.textContent = text;
    this.status.className = cls || 'neutral';
  }

  bindEvents() {
    const startBtn = document.getElementById('startBtn');
    const flipBtn = document.getElementById('flipBtn');
    const uploadBtn = document.getElementById('uploadBtn');
    const fileInput = document.getElementById('fileInput');
    const photoBtn = document.getElementById('photoBtn');
    const sendBtn = document.getElementById('sendBtn');
    const resetBtn = document.getElementById('resetLedgerBtn');

    if (startBtn) startBtn.addEventListener('click', () => this.startCamera());
    if (flipBtn) flipBtn.addEventListener('click', () => this.flipCamera());
    if (uploadBtn) uploadBtn.addEventListener('click', () => fileInput.click());
    if (fileInput) fileInput.addEventListener('change', (e) => this.handleUpload(e));
    if (photoBtn) photoBtn.addEventListener('click', () => this.takePhoto());
    if (sendBtn) sendBtn.addEventListener('click', () => this.sendSignal());
    if (resetBtn) resetBtn.addEventListener('click', () => location.reload());

    this.preview.addEventListener('click', () => {
      this.preview.style.display = 'none';
      this.setStatus('⏻ ready', 'neutral');
    });

    console.log('QtumScanner events bound');
  }

  async startCamera() {
    try {
      this.setStatus('⏳ Starting camera...', 'status-warning');

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
          facingMode: 'environment'
        }
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.video.srcObject = this.stream;
      await this.video.play();

      this.setStatus('📷 Camera ready - scanning...', 'status-success');
      this.startScanning();
    } catch (err) {
      this.setStatus('❌ Camera error: ' + err.message, 'status-error');
      console.error('Camera error:', err);
    }
  }

  async flipCamera() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(d => d.kind === 'videoinput');
      if (cameras.length < 2) {
        this.setStatus('⚠️ Only one camera available', 'status-warning');
        return;
      }
      const currentIdx = cameras.findIndex(d => d.deviceId === this.cameraId);
      const nextIdx = (currentIdx + 1) % cameras.length;
      this.cameraId = cameras[nextIdx].deviceId;
      await this.startCamera();
    } catch (err) {
      this.setStatus('❌ Flip failed: ' + err.message, 'status-error');
    }
  }

  startScanning() {
    if (this.isScanning) return;
    this.isScanning = true;

    try {
      this.codeReader = new ZXing.BrowserMultiFormatReader();
      this.codeReader.decodeFromVideoDevice(this.cameraId, this.video, async (result, err) => {
        if (result && !this.isProcessing) {
          this.isProcessing = true;
          await this.handleScan(result.text);
          this.indicator.style.background = '#4af';
          setTimeout(() => {
            this.indicator.style.background = '#1f2c3d';
            this.isProcessing = false;
          }, 300);
        }
        if (err &&
          !(err instanceof ZXing.NotFoundException) &&
          !(err instanceof ZXing.ChecksumException)) {
          console.warn('Scan error:', err);
        }
      });
    } catch (err) {
      console.error('Scanning init error:', err);
      this.setStatus('❌ Scanner error: ' + err.message, 'status-error');
    }
  }

  async handleScan(text) {
    if (!text) return;

    this.currentPayload = text;
    this.payloadDiv.textContent = text;
    this.preview.style.display = 'none';

    try {
      const report = await qai.process(text);
      console.log('QAI report:', report);

      const clean = report.moderation.allow;
      const tag = clean ? 'SCAN' : 'FLAGGED';
      const statusText = clean ? '✅ Scanned (clean)' : '⚠️ Scanned (flagged)';
      const statusClass = clean ? 'status-success' : 'status-warning';

      this.ledger.addEntry(text, tag);
      this.setStatus(statusText, statusClass);
    } catch (err) {
      console.error('QAI processing error:', err);
      this.ledger.addEntry(text, 'SCAN');
      this.setStatus('✅ Scanned (QAI offline)', 'status-warning');
    }

    console.log('Scanned:', text);
  }

  handleUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = async () => {
        this.preview.src = e.target.result;
        this.preview.style.display = 'block';
        try {
          const codeReader = new ZXing.BrowserMultiFormatReader();
          const result = await codeReader.decodeFromImageElement(img);
          await this.handleScan(result.text);
        } catch (err) {
          this.setStatus('❌ No code found in image', 'status-error');
          console.warn('Upload scan error:', err);
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  takePhoto() {
    if (!this.video.videoWidth) {
      this.setStatus('⚠️ Start camera first', 'status-warning');
      return;
    }

    this.canvas.width = this.video.videoWidth;
    this.canvas.height = this.video.videoHeight;
    this.ctx.drawImage(this.video, 0, 0);

    const dataUrl = this.canvas.toDataURL('image/jpeg');
    this.preview.src = dataUrl;
    this.preview.style.display = 'block';
    this.setStatus('📸 Photo captured', 'status-success');

    const img = new Image();
    img.onload = async () => {
      try {
        const codeReader = new ZXing.BrowserMultiFormatReader();
        const result = await codeReader.decodeFromImageElement(img);
        await this.handleScan(result.text);
      } catch (err) {
        this.setStatus('❌ No code found in snapshot', 'status-error');
        console.warn('Snapshot scan error:', err);
      }
    };
    img.src = dataUrl;
  }

  sendSignal(payloadOverride) {
    if (Array.isArray(payloadOverride)) {
      this.ledger.addBatch(payloadOverride, 'SIGNAL');
      this.setStatus('✦ Multi‑signal dispatched', 'status-success');
      this.payloadDiv.textContent = payloadOverride.join(', ');
      return;
    }

    const payload =
      payloadOverride ||
      this.currentPayload ||
      ('VOID_SIGNAL_' + Date.now());

    this.ledger.addEntry(payload, 'SIGNAL');
    this.setStatus('✦ Signal sent', 'status-success');
    this.payloadDiv.textContent = payload;

    this.indicator.style.background = '#f0a';
    setTimeout(() => (this.indicator.style.background = '#1f2c3d'), 400);

    if (!this.currentPayload) this.currentPayload = payload;

    console.log('Signal sent:', payload);
  }
}

window.QtumScanner = QtumScanner;
