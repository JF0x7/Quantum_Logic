// scannerLite.js — QTUM(LOG) Lite Scanner (iOS 12 + toaster‑ready)
(function() {
  var LITE_CONFIG = {
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
    this.intervalId = null;
    this.cooldown = false;
    this.lastPayload = null;
    this.isRunning = false;
  }

  // ---------- UI helpers ----------
  QtumScannerLite.prototype._setStatus = function(msg) {
    if (this.statusEl) this.statusEl.textContent = '🔵 ' + msg;
  };

  QtumScannerLite.prototype._setPayload = function(data) {
    if (!this.payloadEl) return;
    var display = data;
    if (data.length > LITE_CONFIG.maxPayloadLength) {
      display = data.substring(0, LITE_CONFIG.maxPayloadLength) + '…';
    }
    this.payloadEl.textContent = display;
  };

  // Custom event dispatcher (fallback for very old browsers)
  QtumScannerLite.prototype._dispatchEvent = function(eventName) {
    try {
      document.dispatchEvent(new Event(eventName));
    } catch (_) {
      var evt = document.createEvent('Event');
      evt.initEvent(eventName, true, true);
      document.dispatchEvent(evt);
    }
  };

  QtumScannerLite.prototype._emitScanStart = function() {
    this._dispatchEvent('scanStart');
  };
  QtumScannerLite.prototype._emitScanStop = function() {
    this._dispatchEvent('scanStop');
  };

  // ---------- Public API ----------
  QtumScannerLite.prototype.start = function() {
    var self = this;
    if (this.isRunning) return;
    this.stop();

    var getUserMedia = navigator.mediaDevices && navigator.mediaDevices.getUserMedia ?
      function(constraints) { return navigator.mediaDevices.getUserMedia(constraints); } :
      (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia);

    if (!getUserMedia) {
      this._setStatus('Lite: camera not available');
      return;
    }

    var constraints = {
      video: {
        facingMode: 'environment',
        width: { ideal: LITE_CONFIG.resolution.width },
        height: { ideal: LITE_CONFIG.resolution.height }
      }
    };

    // Modern Promise‑based
    if (getUserMedia === navigator.mediaDevices.getUserMedia) {
      getUserMedia.call(navigator.mediaDevices, constraints)
        .then(function(stream) { self._onStream(stream); })
        .catch(function(e) {
          self._setStatus('Lite: camera error');
          console.warn('[Lite] Camera error:', e);
        });
    } else {
      // Legacy callback‑based
      getUserMedia(constraints,
        function(stream) { self._onStream(stream); },
        function(e) {
          self._setStatus('Lite: camera error');
          console.warn('[Lite] Camera error:', e);
        }
      );
    }
  };

  QtumScannerLite.prototype._onStream = function(stream) {
    var self = this;
    this.stream = stream;
    this.video.srcObject = stream;

    // Handle autoplay rejection on iOS
    this.video.play().catch(function(err) {
      console.warn('[Lite] Autoplay blocked, waiting for user interaction');
      // On iOS, if autoplay fails, we can force a play on the next user tap
      // But we'll just set status and try again later if needed
      self._setStatus('Lite: tap to play');
      // Actually, we'll just try again – but we'll keep scanning loop anyway
    });

    this.isRunning = true;
    this._setStatus('Lite: scanning…');
    this._emitScanStart();

    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = setInterval(function() {
      if (!self.isRunning || !self.stream || self.video.paused || self.video.ended) {
        clearInterval(self.intervalId);
        self.intervalId = null;
        self._setStatus('Lite: stopped');
        self._emitScanStop();
        return;
      }
      self._captureFrame();
    }, LITE_CONFIG.frameDelay);
  };

  QtumScannerLite.prototype.stop = function() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(function(t) { t.stop(); });
      this.stream = null;
    }
    if (this.video) {
      this.video.srcObject = null;
      this.video.pause();
    }
    this.isRunning = false;
    this._emitScanStop();
    this._setStatus('Lite: stopped');
  };

  QtumScannerLite.prototype.clear = function() {
    this.payloadEl.textContent = '';
    this.lastPayload = null;
    this._setStatus('Lite: cleared');
  };

  QtumScannerLite.prototype.handleFileUpload = function(file) {
    if (!file) return;
    this._setStatus('Lite: processing image…');
    var self = this;
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function() {
      self.canvas.width = img.width;
      self.canvas.height = img.height;
      self.ctx.drawImage(img, 0, 0);
      var payload = self._generateImageSignature(file, img.width, img.height);
      self._handlePayload(payload);
      self._setStatus('Lite: image processed');
      URL.revokeObjectURL(url);
    };
    img.onerror = function() {
      self._setStatus('Lite: image error');
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  // ---------- Internal ----------
  QtumScannerLite.prototype._captureFrame = function() {
    var w = this.video.videoWidth || LITE_CONFIG.resolution.width;
    var h = this.video.videoHeight || LITE_CONFIG.resolution.height;
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx.drawImage(this.video, 0, 0, w, h);
    var payload = this._generateFrameSignature(w, h);
    this._handlePayload(payload);
  };

  QtumScannerLite.prototype._generateFrameSignature = function(w, h) {
    var sig = 'LITE_FRAME';
    var sampleSize = 8;
    try {
      for (var y = 0; y < sampleSize; y++) {
        for (var x = 0; x < sampleSize; x++) {
          var px = this.ctx.getImageData(
            Math.floor((x / sampleSize) * w),
            Math.floor((y / sampleSize) * h),
            1, 1
          ).data;
          var avg = (px[0] + px[1] + px[2]) / 3;
          sig += ':' + Math.floor(avg);
        }
      }
    } catch (_) {}
    sig += '|res:' + w + 'x' + h + '|ts:' + Date.now();
    return sig;
  };

  QtumScannerLite.prototype._handlePayload = function(data) {
    if (this.cooldown && data === this.lastPayload) return;
    this.cooldown = true;
    this.lastPayload = data;
    this._setPayload(data);
    try {
      this.ledger.addEntry(data, 'LITE_SCAN', { timestamp: new Date().toISOString() });
      var countEl = document.getElementById('ledgerCount');
      if (countEl) countEl.textContent = this.ledger.count();
    } catch (e) {
      console.warn('[Lite] Ledger error:', e);
    }
    var self = this;
    setTimeout(function() { self.cooldown = false; }, LITE_CONFIG.cooldown);
  };

  QtumScannerLite.prototype._generateImageSignature = function(file, w, h) {
    var sizeKB = Math.round(file.size / 1024);
    return 'LITE_IMAGE|name:' + file.name + '|size:' + sizeKB + 'KB|res:' + w + 'x' + h + '|ts:' + Date.now();
  };

  window.QtumScannerLite = QtumScannerLite;
})();