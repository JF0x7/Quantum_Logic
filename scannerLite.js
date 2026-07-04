// scannerLite.js — QTUM(LOG) Lite Scanner (File Upload Only + Barcode Detection)
(function() {
  function QtumScannerLite(ledger) {
    this.ledger = ledger;
    this.payloadEl = document.getElementById('payload');
    this.statusEl = document.getElementById('status');
    this.canvas = document.getElementById('canvas');
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.cooldown = false;
    this.lastPayload = null;
    this._zxingReady = false;
    this._reader = null;
  }

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

  // ---------- Barcode detection from image ----------
  QtumScannerLite.prototype.handleFileUpload = function(file) {
    if (!file) return;
    var self = this;
    this._setStatus('processing image…');

    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function() {
      // Draw image to canvas
      if (!self.canvas || !self.ctx) {
        // Fallback if canvas missing
        self._fallbackSignature(file, img.width, img.height);
        URL.revokeObjectURL(url);
        return;
      }
      self.canvas.width = img.width;
      self.canvas.height = img.height;
      self.ctx.drawImage(img, 0, 0, img.width, img.height);

      // Try to decode with ZXing
      self._decodeWithZXing(file, img).then(function(decodedText) {
        if (decodedText) {
          self._handlePayload(decodedText);
          self._setStatus('barcode detected ✓');
        } else {
          // Fallback to signature
          self._fallbackSignature(file, img.width, img.height);
        }
        URL.revokeObjectURL(url);
      }).catch(function() {
        // Fallback on error
        self._fallbackSignature(file, img.width, img.height);
        URL.revokeObjectURL(url);
      });
    };
    img.onerror = function() {
      self._setStatus('image error');
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  // ---------- ZXing decoder ----------
  QtumScannerLite.prototype._decodeWithZXing = function(file, img) {
    var self = this;
    return new Promise(function(resolve, reject) {
      try {
        // Check if ZXing is available
        if (typeof ZXing === 'undefined') {
          // Try global BrowserQRCodeReader (from @zxing/library)
          if (typeof BrowserQRCodeReader !== 'undefined') {
            self._reader = new BrowserQRCodeReader();
          } else {
            reject(new Error('ZXing not available'));
            return;
          }
        } else {
          // Use ZXing namespace
          if (ZXing.BrowserQRCodeReader) {
            self._reader = new ZXing.BrowserQRCodeReader();
          } else {
            reject(new Error('ZXing reader not found'));
            return;
          }
        }

        if (!self._reader) {
          reject(new Error('No reader available'));
          return;
        }

        // Decode from canvas
        var canvas = self.canvas;
        // ZXing expects an HTMLImageElement or HTMLCanvasElement
        // We'll pass the image element directly (it's already loaded)
        // But if image is not same-origin, use canvas
        var source = canvas;
        self._reader.decodeFromImage(source).then(function(result) {
          if (result && result.getText) {
            resolve(result.getText());
          } else {
            resolve(null);
          }
        }).catch(function(err) {
          // No barcode found
          resolve(null);
        });
      } catch (e) {
        reject(e);
      }
    });
  };

  // ---------- Fallback signature (original behaviour) ----------
  QtumScannerLite.prototype._fallbackSignature = function(file, w, h) {
    var sizeKB = Math.round(file.size / 1024);
    var payload = 'LITE_IMAGE|name:' + file.name + '|size:' + sizeKB + 'KB|res:' + w + 'x' + h + '|ts:' + Date.now();
    this._handlePayload(payload);
    this._setStatus('image processed (fallback)');
  };

  // ---------- Payload handler (same as before) ----------
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