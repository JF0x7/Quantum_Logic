/* 
  QtumScanner v4.0 — Vision-enabled, HF-powered, Memory-aware
  Requires QAI v0.70+ (browser HF + memory mode)
*/

import { pipeline } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";

class QtumScanner {
  constructor(qai, ledger) {
    this.qai = qai;
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

    // HF vision pipelines
    this.visionReady = this.initVision();
    this.imageClassifier = null;
    this.imageEmbedder = null;

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.bindEvents());
    } else {
      this.bindEvents();
    }
  }

  async initVision() {
    try {
      this.imageClassifier = await pipeline("image-classification", {
        model: "google/vit-base-patch16-224",
        quantized: true
      });

      this.imageEmbedder = await pipeline("feature-extraction", {
        model: "google/vit-base-patch16-224",
        quantized: true
      });

      console.log("Scanner: HF vision pipelines ready.");
    } catch (err) {
      console.error("Scanner: HF vision init failed:", err);
      this.imageClassifier = null;
      this.imageEmbedder = null;
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
      this.setStatus('QAI ⏻ ready', 'neutral');
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

  async analyzeImage(img) {
    await this.visionReady;

    let classification = null;
    let embedding = null;

    try {
      if (this.imageClassifier) {
        const out = await this.imageClassifier(img);
        classification = out[0];
      }
    } catch (err) {
      console.warn("Image classification failed:", err);
    }

    try {
      if (this.imageEmbedder) {
        const out = await this.imageEmbedder(img);
        embedding = out[0];
      }
    } catch (err) {
      console.warn("Image embedding failed:", err);
    }

    return { classification, embedding };
  }

  async handleScan(text) {
    if (!text) return;

    this.currentPayload = text;
    this.payloadDiv.textContent = text;
    this.preview.style.display = 'none';

    try {
      const report = await this.qai.process(text);
      console.log('QAI report:', report);

      const clean = report.moderation.allow;
      const tag = clean ? 'SCAN' : 'FLAGGED';
      const statusText = clean ? '✅ Scanned (clean)' : '⚠️ Scanned (flagged)';
      const statusClass = clean ? 'status-success' : 'status-warning';

      this.ledger.addEntry(text, tag, report);

      this.setStatus(statusText, statusClass);
    } catch (err) {
      console.error('QAI processing error:', err);
      this.ledger.addEntry(text, 'SCAN');
      this.setStatus('QAI offline — scan logged', 'status-warning');
    }

    console.log('Scanned:', text);
  }

  async handleUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = async () => {
        this.preview.src = e.target.result;
        this.preview.style.display = 'block';

        const vision = await this.analyzeImage(img);

        const report = {
          original: "[IMAGE UPLOAD]",
          vision,
          moderation: { allow: true, verdict: "image", flags: [], entropy: 0 },
          itemType: "image artifact",
          vibe: "QAI: Image processed.",
          response: "QAI: Image classified."
        };

        this.ledger.addEntry("[IMAGE]", "IMAGE", report);
        this.setStatus("🖼 Image analyzed", "status-success");
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  async takePhoto() {
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
      const vision = await this.analyzeImage(img);

      const report = {
        original: "[SNAPSHOT]",
        vision,
        moderation: { allow: true, verdict: "image", flags: [], entropy: 0 },
        itemType: "snapshot artifact",
        vibe: "QAI: Snapshot processed.",
        response: "QAI: Snapshot classified."
      };

      this.ledger.addEntry("[SNAPSHOT]", "IMAGE", report);
      this.setStatus("📸 Snapshot analyzed", "status-success");
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
