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
      reader: null,
      cooldown: false,
      lastScan: null,
      ready: false
    };

    this.el = {
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
    if (typeof ZXing === "undefined") {
      this.setStatus("ZXing missing", "error");
      return;
    }

    const hints = new Map();
    hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
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

    this.state.reader = new ZXing.BrowserMultiFormatReader(hints);
    this.state.ready = true;

    if (this.el.video) {
      this.el.video.autoplay = true;
      this.el.video.playsInline = true;
      this.el.video.muted = true;
      this.el.video.setAttribute("playsinline", "");
      this.el.video.setAttribute("webkit-playsinline", "");
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

  async attachStream(constraints, deviceId) {
    const video = this.el.video;
    if (!video) throw new Error("Video element missing");

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Camera API not supported");
    }

    if (!window.isSecureContext && !/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)) {
      throw new Error("Camera requires HTTPS on iPhone Safari");
    }

    const candidates = this.buildConstraintCandidates(deviceId);
    let lastError = null;

    for (const candidate of candidates) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(candidate);
        video.srcObject = stream;
        await video.play().catch(() => {});

        const decodeCallback = (result, err) => {
          if (result) this.handleScan(result.getText());
          if (err && !(err instanceof ZXing.NotFoundException)) {
            console.debug(err);
          }
        };

        try {
          if (this.state.reader.decodeFromVideoElement) {
            await this.state.reader.decodeFromVideoElement(video, decodeCallback);
          } else if (this.state.reader.decodeFromConstraints) {
            await this.state.reader.decodeFromConstraints(candidate, video, decodeCallback);
          } else if (this.state.reader.decodeFromVideoDevice) {
            await this.state.reader.decodeFromVideoDevice(deviceId || null, video, decodeCallback);
          } else {
            throw new Error("No compatible decoder available");
          }
        } catch (err) {
          console.warn("Decoder startup failed", err);
          if (this.state.reader.decodeFromVideoDevice) {
            await this.state.reader.decodeFromVideoDevice(deviceId || null, video, decodeCallback);
          }
        }

        return stream;
      } catch (err) {
        lastError = err;
        console.warn("Camera constraint failed", err);
      }
    }

    throw lastError || new Error("Camera access failed");
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
      await this.attachStream(null, this.state.deviceId);
      this.setStatus("Scanning…", "neutral");
    } catch (err) {
      console.warn("Scanner start failed", err);
      if (err.message && /HTTPS/i.test(err.message)) {
        this.setStatus("Use HTTPS for camera on iPhone", "error");
      } else {
        this.setStatus("Camera access failed", "error");
      }
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
    this.state.reader?.reset();
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
      this.el.upload.onclick = () => this.el.fileInput.click();
      this.el.fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        try {
          const result = await this.state.reader.decodeFromImageUrl(url);
          this.handleScan(result.getText());
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
