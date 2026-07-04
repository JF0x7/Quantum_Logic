// scannerLite.js — QTUM(LOG) Lite Scanner
// No internal event binding – all control from main script.
(function () {
  'use strict';

  const LITE_CONFIG = {
    cooldown: 2500,
    resolution: { width: 480, height: 360 },
    frameDelay: 800,
    maxPayloadLength: 300
  };

  function QtumScannerLite(ledger) {
    this.ledger = ledger;

    this.video = document.getElementById('video');
    this.canvas = document.getElementById('canvas');
    this.ctx = this.canvas.getContext('2d');

    this.payloadEl = document.getElementById('payload');
    this.statusEl = document.getElementById('status');

    this.stream = null;
    this.loopTimer = null;
    this.cooldown = false;
    this.lastPayload = null;
    this.isRunning = false;
  }

  // ---------- UI helpers ----------
  QtumScannerLite.prototype._setStatus = function (msg) {
    if (this.statusEl) this.statusEl.textContent = '🔵 ' + msg;
  };

  QtumScannerLite.prototype._setPayload = function (data) {
    if (!this.payloadEl) return;
    const display = data.length > LITE_CONFIG.maxPayloadLength
      ? data.substring(0, LITE_CONFIG.maxPayloadLength) + '…'
      : data;
    this.payloadEl.textContent = display;
  };

  QtumScannerLite.prototype._emitScanStart = function () {
    document.dispatchEvent(new Event('scanStart'));
  };
  QtumScannerLite.prototype._emitScanStop = function () {
    document.dispatchEvent(new Event('scanStop'));
  };

  // ---------- Public API ----------
  QtumScannerLite.prototype.start = async function () {
    if (this.isRunning) return;
    this.stop(); // clean previous

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this._setStatus('Lite: camera not available');
      return;
    }

    try {
      const constraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: LITE_CONFIG.resolution.width },
          height: { ideal: LITE_CONFIG.resolution.height }
        }
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.video.srcObject = this.stream;
      await this.video.play();

      this.isRunning = true;
      this._setStatus('Lite: scanning…');
      this._emitScanStart();
      this._startLoop();

    } catch (e) {
      this._setStatus('Lite: camera error');
      console.warn('[Lite] Camera error:', e);
    }
  };

  QtumScannerLite.prototype.stop = function () {
    if (this.loopTimer) {
      clearTimeout(this.loopTimer);
      this.loopTimer = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }

    // Release video element
    if (this.video) {
      this.video.srcObject = null;
      this.video.pause();
    }

    this.isRunning = false;
    this._emitScanStop();
    this._setStatus('Lite: stopped');
  };

  QtumScannerLite.prototype.clear = function () {
    this.payloadEl.textContent = '';
    this.lastPayload = null;
    this._setStatus('Lite: cleared');
  };

  QtumScannerLite.prototype.handleFileUpload = function (file) {
    if (!file) return;
    this._setStatus('Lite: processing image…');

    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      this.canvas.width = img.width;
      this.canvas.height = img.height;
      this.ctx.drawImage(img, 0, 0);

      const payload = this._generateImageSignature(file, img.width, img.height);
      this._handlePayload(payload);

      this._setStatus('Lite: image processed');
      URL.revokeObjectURL(url);
    };

    img.onerror = () => {
      this._setStatus('Lite: image error');
      URL.revokeObjectURL(url);
    };

    img.src = url;
  };

  // ---------- Internal ----------
  QtumScannerLite.prototype._startLoop = function () {
    const self = this;

    function tick() {
      if (!self.isRunning || !self.stream || self.video.paused || self.video.ended) {
        self._emitScanStop();
        return;
      }

      self._captureFrame();
      self.loopTimer = setTimeout(tick, LITE_CONFIG.frameDelay);
    }

    tick();
  };

  QtumScannerLite.prototype._captureFrame = function () {
    const w = this.video.videoWidth || LITE_CONFIG.resolution.width;
    const h = this.video.videoHeight || LITE_CONFIG.resolution.height;

    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx.drawImage(this.video, 0, 0, w, h);

    const payload = this._generateFrameSignature(w, h);
    this._handlePayload(payload);
  };

  QtumScannerLite.prototype._generateFrameSignature = function (w, h) {
    let sig = 'LITE_FRAME';
    const sampleSize = 8;

    try {
      for (let y = 0; y < sampleSize; y++) {
        for (let x = 0; x < sampleSize; x++) {
          const px = this.ctx.getImageData(
            Math.floor((x / sampleSize) * w),
            Math.floor((y / sampleSize) * h),
            1, 1
          ).data;
          const avg = (px[0] + px[1] + px[2]) / 3;
          sig += ':' + Math.floor(avg);
        }
      }
    } catch (_) {}

    sig += `|res:${w}x${h}|ts:${Date.now()}`;
    return sig;
  };

  QtumScannerLite.prototype._handlePayload = function (data) {
    if (this.cooldown && data === this.lastPayload) return;

    this.cooldown = true;
    this.lastPayload = data;

    this._setPayload(data);

    try {
      this.ledger.addEntry(data, 'LITE_SCAN', {
        timestamp: new Date().toISOString()
      });
      const countEl = document.getElementById('ledgerCount');
      if (countEl) countEl.textContent = this.ledger.count();
    } catch (e) {
      console.warn('[Lite] Ledger error:', e);
    }

    setTimeout(() => {
      this.cooldown = false;
    }, LITE_CONFIG.cooldown);
  };

  QtumScannerLite.prototype._generateImageSignature = function (file, w, h) {
    const sizeKB = Math.round(file.size / 1024);
    return `LITE_IMAGE|name:${file.name}|size:${sizeKB}KB|res:${w}x${h}|ts:${Date.now()}`;
  };

  window.QtumScannerLite = QtumScannerLite;
})();