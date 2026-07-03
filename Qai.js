/**
 * QAI v5.1 · Full Local Brain
 * iPhone 6 Compatible Version
 * Barcode / QR / crypto intelligence + offline helpers (SHA-256, Aztec hook, alt-bash decode, Morse)
 */

function Qai() {
  this.version = "5.1-local-ios";
  this._ready = false;
  this.cache = new Map();
  this._listeners = {};
  
  this.initialize();
}

Qai.prototype.initialize = function() {
  var self = this;
  setTimeout(function() {
    self._ready = true;
    self.emit("ready", { version: self.version });
    console.log("🧠 QAI v5.1-local ready (Morse enabled)");
  }, 100);
};

Qai.prototype.isReady = function() {
  return this._ready;
};

Qai.prototype.emit = function(event, detail) {
  if (this._listeners[event]) {
    var listeners = this._listeners[event];
    for (var i = 0; i < listeners.length; i++) {
      try {
        listeners[i]({ detail: detail });
      } catch (e) {
        console.warn("Event listener error:", e);
      }
    }
  }
};

Qai.prototype.addEventListener = function(event, callback) {
  if (!this._listeners[event]) {
    this._listeners[event] = [];
  }
  this._listeners[event].push(callback);
};

Qai.prototype.removeEventListener = function(event, callback) {
  if (this._listeners[event]) {
    var index = this._listeners[event].indexOf(callback);
    if (index > -1) {
      this._listeners[event].splice(index, 1);
    }
  }
};

Qai.prototype.process = function(text) {
  var self = this;
  return new Promise(function(resolve, reject) {
    if (!text) {
      reject(new Error("No input"));
      return;
    }

    var cacheKey = text.slice(0, 80);
    if (self.cache.has(cacheKey)) {
      resolve(self.cache.get(cacheKey));
      return;
    }

    var core = self.analyze(text);
    var item = self.guessItem(core);

    // alt-bash style decode for hex/base64
    if (core.pattern === "hex" || core.pattern === "base64") {
      var decoded = self.decodeBashLike(core.raw);
      if (decoded.value) {
        core.hints.push("Decoded " + decoded.type + ": " + decoded.value.slice(0, 120));
      }
    }

    // optional Aztec hook (if you wire ZXing or similar)
    if (core.type === "aztec") {
      var aztecDecoded = self.decodeAztec(core.raw);
      if (aztecDecoded) {
        core.hints.push("Aztec decoded: " + aztecDecoded.slice(0, 120));
      }
    }

    // Morse decode
    if (core.type === "morse") {
      var decoded = self.morseDecode(core.raw);
      if (decoded && decoded !== "Morse decode: no valid pattern") {
        core.hints.push("Morse decoded: " + decoded.slice(0, 120));
      } else {
        core.hints.push("Morse detected but could not decode cleanly");
      }
    }

    // SHA-256 fingerprint
    self.sha256(core.raw).then(function(sha) {
      core.hints.push("SHA-256: " + sha.slice(0, 32) + "…");
      
      var explanation = self.explainOffline(core, item);
      var result = { 
        raw: core.raw,
        type: core.type,
        format: core.format,
        valid: core.valid,
        confidence: core.confidence,
        pattern: core.pattern,
        checksum: core.checksum,
        length: core.length,
        entropy: core.entropy,
        hints: core.hints,
        item: item,
        explanation: explanation
      };

      self.cache.set(cacheKey, result);
      self.trimCache();
      resolve(result);
    });
  });
};

// -----------------------------
// Core analysis
// -----------------------------

Qai.prototype.analyze = function(text) {
  var clean = text.trim();
  var result = {
    raw: clean,
    type: null,
    format: null,
    valid: false,
    confidence: 0,
    pattern: null,
    checksum: null,
    length: clean.length,
    entropy: this.calcEntropy(clean),
    hints: []
  };

  var patterns = this.getPatterns();
  var found = false;

  for (var type in patterns) {
    if (patterns.hasOwnProperty(type)) {
      if (patterns[type].test(clean)) {
        result.type = type;
        var formats = this.getFormats();
        result.format = formats[type] || null;
        result.valid = true;
        result.confidence = 0.92;

        if (["ean13", "ean8", "upc"].indexOf(type) > -1) {
          result.checksum = this.calcChecksum(clean);
        }
        found = true;
        break;
      }
    }
  }

  // Extra Morse detection safety
  if (!found && /^[.\-/\s]+$/.test(clean) && /[.\-]/.test(clean)) {
    result.type = "morse";
    var formats = this.getFormats();
    result.format = formats.morse || { name: "Morse", type: "signal" };
    result.valid = true;
    result.confidence = 0.85;
    result.hints.push("Morse code detected");
    found = true;
  }

  if (!found) {
    var fuzzy = this.fuzzyMatch(clean);
    if (fuzzy) {
      result.type = fuzzy.type;
      var formats = this.getFormats();
      result.format = formats[fuzzy.type] || null;
      result.valid = true;
      result.confidence = fuzzy.confidence;
      result.hints.push("Fuzzy classification");
    }
  }

  result.pattern = this.detectPattern(clean);

  if (!result.valid && result.pattern) {
    result.hints.push("Payload looks like: " + result.pattern);
  }

  return result;
};

Qai.prototype.getPatterns = function() {
  return {
    ean13: /^[0-9]{13}$/,
    ean8: /^[0-9]{8}$/,
    upc: /^[0-9]{12}$/,
    code128: /^[\x20-\x7E]+$/,
    code39: /^[A-Z0-9\-\.\s\$\/\+%]+$/,
    qr: /^[\s\S]{10,}$/,
    qtum: /^QTUM_[A-Z0-9]{16}$/,
    bitcoin: /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/,
    ethereum: /^0x[a-fA-F0-9]{40}$/,
    email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    url: /^(https?:\/\/)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
    phone: /^\+?[0-9]{10,15}$/,
    aztec: /^AZTEC_[\s\S]+$/,
    morse: /^[.\-/\s]+$/
  };
};

Qai.prototype.getFormats = function() {
  return {
    ean13: { name: "EAN-13", type: "barcode" },
    ean8: { name: "EAN-8", type: "barcode" },
    upc: { name: "UPC-A", type: "barcode" },
    code128: { name: "Code 128", type: "barcode" },
    code39: { name: "Code 39", type: "barcode" },
    qr: { name: "QR Code", type: "2d" },
    qtum: { name: "QTUM", type: "protocol" },
    bitcoin: { name: "Bitcoin", type: "crypto" },
    ethereum: { name: "Ethereum", type: "crypto" },
    email: { name: "Email", type: "pattern" },
    url: { name: "URL", type: "pattern" },
    phone: { name: "Phone", type: "pattern" },
    aztec: { name: "Aztec", type: "2d" },
    morse: { name: "Morse", type: "signal" }
  };
};

Qai.prototype.fuzzyMatch = function(text) {
  var clean = text.replace(/[^A-Z0-9]/gi, "");
  var len = clean.length;

  if (len === 13 && /^[0-9]+$/.test(clean)) {
    return { type: "ean13", confidence: 0.8 };
  }
  if (len === 12 && /^[0-9]+$/.test(clean)) {
    return { type: "upc", confidence: 0.8 };
  }
  if (len === 8 && /^[0-9]+$/.test(clean)) {
    return { type: "ean8", confidence: 0.8 };
  }
  if (len >= 20 && len <= 40) {
    return { type: "qr", confidence: 0.65 };
  }
  if (len >= 26 && len <= 35 && /^[13][A-Za-z0-9]+$/.test(clean)) {
    return { type: "bitcoin", confidence: 0.75 };
  }
  if (len === 42 && /^0x[A-Fa-f0-9]+$/.test(clean)) {
    return { type: "ethereum", confidence: 0.8 };
  }

  return null;
};

Qai.prototype.detectPattern = function(text) {
  var patterns = {
    email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    url: /^(https?:\/\/)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
    hex: /^[0-9a-fA-F]{32,64}$/,
    base64: /^[A-Za-z0-9+/=]{20,}$/,
    json: /^\s*\{[\s\S]*\}\s*$/,
    query: /^[A-Za-z0-9_\-]+=[^&]+(&[A-Za-z0-9_\-]+=[^&]+)*$/,
    morse: /^[.\-/\s]+$/
  };

  for (var type in patterns) {
    if (patterns.hasOwnProperty(type)) {
      if (patterns[type].test(text)) {
        return type;
      }
    }
  }
  return null;
};

Qai.prototype.calcEntropy = function(text) {
  if (!text.length) return 0;
  var freq = {};
  for (var i = 0; i < text.length; i++) {
    var char = text[i];
    freq[char] = (freq[char] || 0) + 1;
  }
  var entropy = 0;
  var len = text.length;
  for (var char in freq) {
    if (freq.hasOwnProperty(char)) {
      var p = freq[char] / len;
      entropy -= p * Math.log2(p);
    }
  }
  return parseFloat(entropy.toFixed(3));
};

Qai.prototype.trimCache = function() {
  if (this.cache.size > 200) {
    var entries = Array.from(this.cache.entries());
    for (var i = 0; i < Math.min(60, entries.length); i++) {
      this.cache.delete(entries[i][0]);
    }
  }
};

// -----------------------------
// Item guessing
// -----------------------------

Qai.prototype.guessItem = function(core) {
  var type = core.type;
  var pattern = core.pattern;
  var length = core.length;
  var entropy = core.entropy;
  var raw = core.raw;

  var item = {
    category: "unknown",
    label: "Unknown item",
    confidence: 0.3,
    notes: []
  };

  if (type === "bitcoin" || type === "ethereum") {
    item.category = "crypto";
    item.label = type === "bitcoin" ? "Bitcoin address" : "Ethereum address";
    item.confidence = 0.9;
    return item;
  }

  if (type === "qtum" || (raw && raw.indexOf("QTUM_") === 0)) {
    item.category = "crypto";
    item.label = "QTUM signal";
    item.confidence = 0.85;
    return item;
  }

  if (pattern === "url") {
    item.category = "link";
    item.label = "Web URL";
    item.confidence = 0.9;
    return item;
  }

  if (pattern === "email") {
    item.category = "contact";
    item.label = "Email address";
    item.confidence = 0.9;
    return item;
  }

  if (pattern === "json" || pattern === "query") {
    item.category = "payload";
    item.label = pattern === "json" ? "JSON payload" : "Query string";
    item.confidence = 0.8;
    return item;
  }

  if (entropy > 3.5 && length >= 24) {
    item.category = "secret-ish";
    item.label = "Token / hash-like string";
    item.confidence = 0.75;
    return item;
  }

  if (["ean13", "ean8", "upc"].indexOf(type) > -1) {
    item.category = "product";
    item.label = "Retail barcode";
    item.confidence = 0.9;
    return item;
  }

  if (type === "code128" || type === "code39") {
    item.category = "label";
    item.label = "Generic code label";
    item.confidence = 0.7;
    return item;
  }

  if (type === "qr") {
    item.category = "qr";
    item.label = "QR payload";
    item.confidence = 0.7;
    return item;
  }

  if (type === "aztec") {
    item.category = "qr";
    item.label = "Aztec payload";
    item.confidence = 0.75;
    return item;
  }

  if (type === "morse") {
    item.category = "signal";
    item.label = "Morse transmission";
    item.confidence = 0.85;
    return item;
  }

  return item;
};

// -----------------------------
// Offline explanation
// -----------------------------

Qai.prototype.explainOffline = function(core, item) {
  var parts = [];

  parts.push("Signal type: " + (core.type || "unknown"));
  parts.push("Pattern: " + (core.pattern || "none"));
  parts.push("Length: " + core.length + ", entropy: " + core.entropy);
  parts.push("Likely classification: " + item.label + " (category=" + item.category + ", confidence=" + item.confidence + ")");

  if (core.checksum) {
    parts.push(
      "Checksum: calculated=" + core.checksum.calculated + 
      ", provided=" + core.checksum.provided + 
      ", valid=" + core.checksum.valid
    );
  }

  if (core.hints && core.hints.length) {
    parts.push("Hints: " + core.hints.join("; "));
  }

  if (item.category === "crypto") {
    parts.push("Treat as a public address only; never encode private keys in barcodes/QR.");
  } else if (item.category === "secret-ish") {
    parts.push("String looks token/hash-like; avoid exposing it publicly if tied to auth or tracking.");
  } else if (item.category === "signal" && core.type === "morse") {
    parts.push("Morse transmission detected; treat as a human-readable signal layer.");
  }

  return parts.join(". ");
};

// -----------------------------
// SHA-256 helper (polyfill for older iOS)
// -----------------------------

Qai.prototype.sha256 = function(text) {
  var self = this;
  return new Promise(function(resolve) {
    try {
      // Check if crypto.subtle is available
      if (window.crypto && window.crypto.subtle) {
        var enc = new TextEncoder().encode(text);
        window.crypto.subtle.digest("SHA-256", enc).then(function(buf) {
          var hashArray = Array.from(new Uint8Array(buf));
          var hashHex = hashArray.map(function(b) {
            return b.toString(16).padStart(2, "0");
          }).join("");
          resolve(hashHex);
        }).catch(function() {
          resolve(self.sha256Fallback(text));
        });
      } else {
        resolve(self.sha256Fallback(text));
      }
    } catch (e) {
      console.warn("SHA-256 failed, using fallback", e);
      resolve(self.sha256Fallback(text));
    }
  });
};

Qai.prototype.sha256Fallback = function(text) {
  // Simple non-cryptographic hash for older devices
  var hash = 0;
  if (text.length === 0) return "00000000000000000000000000000000";
  for (var i = 0; i < text.length; i++) {
    var char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  var hex = Math.abs(hash).toString(16);
  while (hex.length < 32) hex = "0" + hex;
  return hex;
};

// -----------------------------
// Checksum calculator
// -----------------------------

Qai.prototype.calcChecksum = function(code) {
  var isEAN13 = code.length === 13;
  var isEAN8 = code.length === 8;
  var isUPC = code.length === 12;
  
  if (!isEAN13 && !isEAN8 && !isUPC) {
    return { calculated: null, provided: null, valid: false };
  }

  var digits = code.split("").map(Number);
  var provided = digits.pop();
  var sum = 0;
  var multiply = 3;

  if (isEAN13 || isUPC) {
    for (var i = 0; i < digits.length; i++) {
      sum += digits[i] * multiply;
      multiply = multiply === 3 ? 1 : 3;
    }
  } else if (isEAN8) {
    for (var i = 0; i < digits.length; i++) {
      sum += digits[i] * (i % 2 === 0 ? 3 : 1);
    }
  }

  var calculated = (10 - (sum % 10)) % 10;
  return {
    calculated: calculated,
    provided: provided,
    valid: calculated === provided
  };
};

// -----------------------------
// Aztec decoding hook
// -----------------------------

Qai.prototype.decodeAztec = function(data) {
  try {
    // plug your ZXing Aztec decoder here, e.g.:
    // const decoded = someAztecDecoder(data);
    // return decoded;
    console.warn("Aztec decode not wired yet.");
    return null;
  } catch (e) {
    console.warn("Aztec decode failed", e);
    return null;
  }
};

// -----------------------------
// Morse decoder (QAI side)
// -----------------------------

Qai.prototype.morseDecode = function(str) {
  try {
    var morseMap = {
      '.-': 'A', '-...': 'B', '-.-.': 'C', '-..': 'D', '.': 'E',
      '..-.': 'F', '--.': 'G', '....': 'H', '..': 'I', '.---': 'J',
      '-.-': 'K', '.-..': 'L', '--': 'M', '-.': 'N', '---': 'O',
      '.--.': 'P', '--.-': 'Q', '.-.': 'R', '...': 'S', '-': 'T',
      '..-': 'U', '...-': 'V', '.--': 'W', '-..-': 'X', '-.--': 'Y',
      '--..': 'Z',
      '-----': '0', '.----': '1', '..---': '2', '...--': '3',
      '....-': '4', '.....': '5', '-....': '6', '--...': '7',
      '---..': '8', '----.': '9'
    };

    var words = str.split('/');
    var result = "";
    for (var w = 0; w < words.length; w++) {
      var word = words[w].trim();
      var letters = word.split(' ');
      var decodedWord = "";
      for (var l = 0; l < letters.length; l++) {
        decodedWord += morseMap[letters[l]] || '?';
      }
      if (w > 0) result += " ";
      result += decodedWord;
    }

    return result || 'Morse decode: no valid pattern';
  } catch (e) {
    return 'Morse decode error: ' + e.message;
  }
};

// -----------------------------
// "Alt bash" style decoding: base64 / hex
// -----------------------------

Qai.prototype.decodeBashLike = function(text) {
  var clean = text.trim();

  // Try base64
  try {
    if (/^[A-Za-z0-9+/=]+$/.test(clean)) {
      var decoded = atob(clean);
      return { type: "base64", value: decoded };
    }
  } catch (_) {}

  // Try hex
  if (/^[0-9a-fA-F]+$/.test(clean) && clean.length % 2 === 0) {
    var bytes = [];
    for (var i = 0; i < clean.length; i += 2) {
      bytes.push(parseInt(clean.substr(i, 2), 16));
    }
    var value = "";
    for (var b = 0; b < bytes.length; b++) {
      value += String.fromCharCode(bytes[b]);
    }
    return { type: "hex", value: value };
  }

  return { type: "unknown", value: null };
};

// Create global instance
window.Qai = Qai;