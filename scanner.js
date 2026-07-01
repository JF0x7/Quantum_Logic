/**
 * Quantum Scanner Engine — ZXing + QAI + Ledger
 */

class QtumScanner {
  constructor(ledgerInstance = null, brainInstance = null) {
    this.CONFIG = {
      cooldown: 2000,
      vibrate: true,
      autoRedirect: true,
      beep: { freq: 950, volume: 0.08, duration: 0.10 }
    };

    this.state = {
      deviceId: null,
      devices: [],
      cooldown: false,
      lastScan: null,
      ready: false
    };

    this.scanTimer = null;
    this.scanActive = false;
    this.captureFallbackActive = false;

    this.el = {
      video: document.getElementById("video"),
      payload: document.getElementById("payload"),
      status: document.getElementById("status"),
      start: document.getElementById("startBtn"),
      flip: document.getElementById("flipBtn"),
      upload: document.getElementById("uploadBtn"),
      send: document.getElementById("sendBtn"),
      photo: document.getElementById("photoBtn"),
      test: document.getElementById("testBtn"),
      resetLedger: document.getElementById("resetLedgerBtn"),
      fileInput: document.getElementById("fileInput"),
      canvas: document.getElementById("canvas"),
      photoPreview: document.getElementById("photoPreview")
    };

    this.ledger = ledgerInstance || new QuantumLedger("ledger");
    this.brain = brainInstance || new Qai();

    this.init();
  }

  setStatus(msg, type = "neutral") {
    if (this.el.status) {
      this.el.status.textContent = `Status: ${msg}`;
      this.el.status.classList.remove("neutral", "success", "error");
      this.el.status.classList.add(type);
    }
    console.log(`[Scanner] ${msg}`);
  }

  beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.frequency.value = this.CONFIG.beep.freq;
      gain.gain.value = this.CONFIG.beep.volume;

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + this.CONFIG.beep.duration);

      setTimeout(() => ctx.close(), 300);
    } catch (_) {}
  }

  async getVideoInputDevices() {
    if (this.state.reader?.listVideoInputDevices) {
      try {
        return await this.state.reader.listVideoInputDevices();
      } catch (err) {
        console.warn("Device list fallback failed", err);
      }
    }

    if (navigator.mediaDevices?.enumerateDevices) {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(d => d.kind === "videoinput");
    }

    return [];
  }

  async init() {
    if (typeof window.jsQR !== "function") {
      this.setStatus("QR scanner library missing", "error");
      return;
    }

    this.state.ready = true;

    if (this.el.video) {
      this.el.video.autoplay = true;
      this.el.video.playsInline = true;
      this.el.video.muted = true;
      this.el.video.setAttribute("playsinline", "");
      this.el.video.setAttribute("webkit-playsinline", "");
    }

    if (this.el.fileInput) {
      this.el.fileInput.setAttribute("capture", "environment");
      this.el.fileInput.setAttribute("accept", "image/*");
    }

    this.bindEvents();
    this.setStatus("Ready", "neutral");
  }

  buildConstraintCandidates(deviceId) {
    const candidates = [];

    const base = {
      audio: false,
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 }
      }
    };

    if (deviceId) {
      base.video.deviceId = { exact: deviceId };
    }

    candidates.push({
      ...base,
      video: { ...base.video, facingMode: { ideal: "environment" } }
    });

    candidates.push({
      ...base,
      video: { ...base.video, facingMode: { ideal: "user" } }
    });

    candidates.push({
      audio: false,
      video: true
    });

    return candidates;
  }

  async attachStream(deviceId) {
    const video = this.el.video;
    if (!video) throw new Error("Video element missing");

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Camera API not supported");
    }

    if (!window.isSecureContext && !/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)) {
      throw new Error("Camera requires HTTPS on iPhone Safari");
    }

    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
      throw new Error("Camera access is not available in this browser");
    }

    const candidates = this.buildConstraintCandidates(deviceId);
    let lastError = null;

    for (const candidate of candidates) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(candidate);
        video.srcObject = stream;
        await video.play().catch(() => {});
        this.startScanningLoop();
        return stream;
      } catch (err) {
        lastError = err;
        console.warn("Camera constraint failed", err);
      }
    }

    throw lastError || new Error("Camera access failed");
  }

  startScanningLoop() {
    this.stopScanningLoop();
    this.scanActive = true;
    this.scanTimer = window.setInterval(() => {
      if (!this.scanActive || !this.el.video || this.el.video.readyState < 2) return;
      this.decodeCurrentFrame();
    }, 250);
  }

  stopScanningLoop() {
    if (this.scanTimer) {
      window.clearInterval(this.scanTimer);
      this.scanTimer = null;
    }
    this.scanActive = false;
  }

  decodeCurrentFrame() {
    const video = this.el.video;
    const canvas = this.el.canvas;
    if (!video || !canvas || video.videoWidth <= 0 || video.videoHeight <= 0) return;

    const ctx = canvas.getContext("2d");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = window.jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert"
    });

    if (code) {
      this.handleScan(code.data);
    }
  }

  decodeImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = this.el.canvas;
        const ctx = canvas.getContext("2d");
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = window.jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert"
        });
        resolve(code);
      };
      img.onerror = () => reject(new Error("Image load failed"));
      img.src = url;
    });
  }

  async start() {
    if (!this.state.ready) return this.setStatus("Not ready", "error");

    this.setStatus("Starting…", "neutral");
    this.state.reader?.reset();

    const devices = await this.getVideoInputDevices();
    this.state.devices = devices;

    if (!devices.length) return this.setStatus("No camera", "error");

    if (!this.state.deviceId) {
      const rear = devices.find(d => /back|rear|environment/i.test(d.label));
      this.state.deviceId = rear ? rear.deviceId : devices[0]?.deviceId;
    }

    try {
      await this.attachStream(this.state.deviceId);
      this.setStatus("Scanning…", "neutral");
    } catch (err) {
      console.warn("Scanner start failed", err);
      this.useCaptureFallback(err);
    }
  }

  useCaptureFallback(err) {
    if (this.captureFallbackActive) return;
    this.captureFallbackActive = true;

    if (err && err.name === "NotAllowedError") {
      this.setStatus("Camera permission blocked. Please allow access and try again.", "error");
    } else {
      this.setStatus("Camera access unavailable. Please try again.", "error");
    }

    if (this.el.fileInput) {
      window.setTimeout(() => this.el.fileInput.click(), 250);
    }
  }

  flip() {
    if (this.state.devices.length < 2) return this.setStatus("Only one camera", "error");

    const idx = this.state.devices.findIndex(d => d.deviceId === this.state.deviceId);
    this.state.deviceId = this.state.devices[(idx + 1) % this.state.devices.length].deviceId;
    this.setStatus("Swapping…", "neutral");
    this.stopStreams();
    this.start();
  }

  stop() {
    this.stopScanningLoop();
    this.stopStreams();
    this.setStatus("Stopped", "neutral");
  }

  stopStreams() {
    const video = this.el.video;
    if (video?.srcObject) {
      video.srcObject.getTracks().forEach(track => track.stop());
      video.srcObject = null;
    }
  }

  async handleScan(data) {
    if (this.state.cooldown && data === this.state.lastScan) return;

    this.state.lastScan = data;
    this.state.cooldown = true;

    if (this.el.payload) this.el.payload.textContent = data;
    this.setStatus("Decoded!", "success");

    this.beep();
    if (this.CONFIG.vibrate && navigator.vibrate) navigator.vibrate(80);

    try {
      const analysis = await this.brain.process(data);
      this.ledger.addEntry(data, "SCAN", {
        type: analysis.format ? `${analysis.format.name} (${analysis.format.type})` : analysis.type,
        pattern: analysis.pattern,
        explanation: analysis.explanation
      });
    } catch (e) {
      console.warn("QAI error", e);
      this.ledger.addEntry(data, "SCAN");
    }

    if (this.CONFIG.autoRedirect) {
      const isUrl = /^https?:\/\/[^\s]+/i.test(data);
      const url = isUrl ? data : `https://www.google.com/search?q=${encodeURIComponent(data)}`;
      window.open(url, "_blank");
    }

    setTimeout(() => { this.state.cooldown = false; }, this.CONFIG.cooldown);
  }

  bindEvents() {
    if (this.el.start) this.el.start.onclick = () => this.start();
    if (this.el.flip) this.el.flip.onclick = () => this.flip();

    if (this.el.upload && this.el.fileInput) {
      this.el.upload.onclick = () => {
        this.captureFallbackActive = false;
        this.el.fileInput.click();
      };
      this.el.fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        try {
          const result = await this.decodeImage(url);
          if (result) {
            this.handleScan(result.data);
          } else {
            this.setStatus("No QR code found", "error");
          }
        } catch (err) {
          console.warn(err);
          this.setStatus("Upload decode failed", "error");
        } finally {
          URL.revokeObjectURL(url);
        }
      };
    }

    if (this.el.photo && this.el.canvas && this.el.video && this.el.photoPreview) {
      this.el.photo.onclick = () => {
        const ctx = this.el.canvas.getContext("2d");
        this.el.canvas.width = this.el.video.videoWidth || 640;
        this.el.canvas.height = this.el.video.videoHeight || 480;
        ctx.drawImage(this.el.video, 0, 0, this.el.canvas.width, this.el.canvas.height);
        this.el.photoPreview.src = this.el.canvas.toDataURL("image/png");
        this.el.photoPreview.style.display = "block";
      };
    }

    if (this.el.test) {
      this.el.test.onclick = async () => {
        this.setStatus("Trying sample decode…", "neutral");
        try {
          const sampleUrl = "https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=QTUM%20SCAN%20TEST";
          const result = await this.decodeImage(sampleUrl);
          if (result) {
            this.handleScan(result.data);
          } else {
            this.setStatus("No QR code found in sample image", "error");
          }
        } catch (err) {
          console.warn(err);
          this.setStatus("Sample decode failed", "error");
        }
      };
    }

    if (this.el.send) {
      this.el.send.onclick = async () => {
        const data = this.el.payload.textContent || "";
        if (!data) {
          this.setStatus("No payload to send", "error");
          return;
        }
        this.setStatus("Analyzing payload…", "neutral");
        try {
          const analysis = await this.brain.process(data);
          this.ledger.addEntry(data, "MANUAL", {
            type: analysis.format ? `${analysis.format.name} (${analysis.format.type})` : analysis.type,
            pattern: analysis.pattern,
            explanation: analysis.explanation
          });
          this.setStatus("Signal logged", "success");
        } catch (e) {
          console.warn(e);
          this.setStatus("QAI analysis failed", "error");
        }
      };
    }

    if (this.el.resetLedger) {
      this.el.resetLedger.onclick = () => this.ledger.clear();
    }
  }
}

window.QtumScanner = QtumScanner;
