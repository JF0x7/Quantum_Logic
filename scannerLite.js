// scannerLite.js — QTUM(LOG) Lite Scanner v2 (Device-aware, Safe ZXing, Fallback)
(function() {
  function QtumScannerLite(ledger) {
    this.ledger = ledger;
    this.payloadEl = document.getElementById('payload');
    this.statusEl = document.getElementById('status');
    this.canvas = document.getElementById('canvas');
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.cooldown = false;
    this.lastPayload = null;
    this._reader = null;
  }

  // ---------- Device tiering ----------
  QtumScannerLite.prototype._getDeviceTier = function() {
    var ua = navigator.userAgent || '';
    var isIOS = /iPad|iPhone|iPod/.test(ua);
    var isAndroid = /Android/.test(ua);
    var noWasm = typeof WebAssembly === 'undefined';
    var lowRAM = typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 3;

    if (isIOS || noWasm || lowRAM) return 3;   // Lite only (iPhone XS etc.)
    if (isAndroid && lowRAM) return 2;         // Canvas only, no ZXing
    return 1;                                  // Full ZXing allowed
  };

  // ---------- UI helpers ----------
  QtumScannerLite.prototype._setStatus = function(msg) {
    if (this.statusEl) this.statusEl.textContent = '📁 ' + msg;
  };

  QtumScannerLite.prototype._setPayload = function(data) {
    if (!this.payloadEl) return;
    var display = data;
    if (data.length > 300) display = data.substring(0, 300) + '…';
    this.payloadEl.textContent = display;
  };

  // ---------- Public API ----------
  QtumScannerLite.prototype.clear = function() {
    if (this.payloadEl) this.payloadEl.textContent = '';
    this.lastPayload = null;
    this._setStatus('cleared');
  };

  // ---------- Image downscaling ----------
  QtumScannerLite.prototype._downscaleImage = function(img, maxSize) {
    var canvas = this.canvas || document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;

    var scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
    canvas.width = Math.floor(img.width * scale);
    canvas.height = Math.floor(img.height * scale);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    this.canvas = canvas;
    this.ctx = ctx;
    return canvas;
  };

  // ---------- File upload handler ----------
  QtumScannerLite.prototype.handleFileUpload = function(file) {
    if (!file) return;
    var self = this;
    this._setStatus('processing image…');

    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function() {
      var tier = self._getDeviceTier();

      // Always downscale for safety
      var scaledCanvas = self._downscaleImage(img, 1024);
      if (!scaledCanvas) {
        self._fallbackSignature(file, img.width, img.height);
        URL.revokeObjectURL(url);
        return;
      }

      // Tier 3 / 2 → skip ZXing, go fallback or future canvas decode
      if (tier !== 1) {
        self._fallbackSignature(file, scaledCanvas.width, scaledCanvas.height);
        URL.revokeObjectURL(url);
        return;
      }

      // Try ZXing, but never crash
      self._decodeWithZXing().then(function(decodedText) {
        if (decodedText) {
          self._handlePayload(decodedText);
          self._setStatus('barcode detected ✓');
        } else {
          self._fallbackSignature(file, scaledCanvas.width, scaledCanvas.height);
        }
        URL.revokeObjectURL(url);
      }).catch(function() {
        self._fallbackSignature(file, scaledCanvas.width, scaledCanvas.height);
        URL.revokeObjectURL(url);
      });
    };
    img.onerror = function() {
      self._setStatus('image error');
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  // ---------- ZXing decoder (tier 1 only) ----------
  QtumScannerLite.prototype._decodeWithZXing = function() {
    var self = this;
    return new Promise(function(resolve, reject) {
      try {
        if (typeof ZXing !== 'undefined' && ZXing.BrowserQRCodeReader) {
          self._reader = new ZXing.BrowserQRCodeReader();
        } else if (typeof BrowserQRCodeReader !== 'undefined') {
          self._reader = new BrowserQRCodeReader();
        } else {
          resolve(null);
          return;
        }
      } catch (e) {
        resolve(null);
        return;
      }

      if (!self._reader || !self.canvas) {
        resolve(null);
        return;
      }

      try {
        self._reader.decodeFromImage(self.canvas).then(function(result) {
          if (result && typeof result.getText === 'function') {
            resolve(result.getText());
          } else {
            resolve(null);
          }
        }).catch(function() {
          resolve(null);
        });
      } catch (e) {
        resolve(null);
      }
    });
  };

  // ---------- Fallback signature ----------
  QtumScannerLite.prototype._fallbackSignature = function(file, w, h) {
    var sizeKB = Math.round(file.size / 1024);
    var payload = 'LITE_IMAGE|name:' + file.name +
      '|size:' + sizeKB + 'KB|res:' + w + 'x' + h +
      '|ts:' + Date.now();
    this._handlePayload(payload);
    this._setStatus('image processed (fallback)');
  };

  // ---------- Payload handler ----------
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
    setTimeout(function() { self.cooldown = false; }, 2500);
  };

  window.QtumScannerLite = QtumScannerLite;
})();
