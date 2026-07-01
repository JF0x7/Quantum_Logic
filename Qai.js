/**
 * QAI v5.0 · Full Local Brain
 * Barcode / QR / crypto intelligence + offline helpers (SHA-256, Aztec hook, alt-bash decode)
 */

class Qai {
  constructor() {
    this.version = "5.0-local";
    this._ready = false;
    this.eventBus = new EventTarget();
    this.cache = new Map();

    this.initialize();
  }

  initialize() {
    setTimeout(() => {
      this._ready = true;
      this.emit("ready", { version: this.version });
      console.log("🧠 QAI v5.0-local ready");
    }, 100);
  }

  isReady() {
    return this._ready;
  }

  emit(event, detail) {
    this.eventBus.dispatchEvent(new CustomEvent(event, { detail }));
  }

  addEventListener(event, callback) {
    this.eventBus.addEventListener(event, callback);
  }

  removeEventListener(event, callback) {
    this.eventBus.removeEventListener(event, callback);
  }

  async process(text) {
    if (!text) throw new Error("No input");

    const cacheKey = text.slice(0, 80);
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

    const core = this.analyze(text);
    const item = this.guessItem(core);

    // alt-bash style decode for hex/base64
    if (core.pattern === "hex" || core.pattern === "base64") {
      const decoded = this.decodeBashLike(core.raw);
      if (decoded.value) {
        core.hints.push(`Decoded ${decoded.type}: ${decoded.value.slice(0, 120)}`);
      }
    }

    // optional Aztec hook (if you wire ZXing or similar)
    if (core.type === "aztec") {
      const aztecDecoded = this.decodeAztec(core.raw);
      if (aztecDecoded) {
        core.hints.push(`Aztec decoded: ${aztecDecoded.slice(0, 120)}`);
      }
    }

    // SHA-256 fingerprint
    const sha = await this.sha256(core.raw);
    core.hints.push(`SHA-256: ${sha.slice(0, 32)}…`);

    const explanation = this.explainOffline(core, item);
    const result = { ...core, item, explanation };

    this.cache.set(cacheKey, result);
    this.trimCache();

    return result;
  }

  // -----------------------------
  // Core analysis
  // -----------------------------

  analyze(text) {
    const clean = text.trim();
    const result = {
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

    for (const [type, pattern] of Object.entries(this.patterns)) {
      if (pattern.test(clean)) {
        result.type = type;
        result.format = this.formats[type] || null;
        result.valid = true;
        result.confidence = 0.92;

        if (["ean13", "ean8", "upc"].includes(type)) {
          result.checksum = this.calcChecksum(clean);
        }
        break;
      }
    }

    if (!result.valid) {
      const fuzzy = this.fuzzyMatch(clean);
      if (fuzzy) {
        result.type = fuzzy.type;
        result.format = this.formats[fuzzy.type] || null;
        result.valid = true;
        result.confidence = fuzzy.confidence;
        result.hints.push("Fuzzy classification");
      }
    }

    result.pattern = this.detectPattern(clean);

    if (!result.valid && result.pattern) {
      result.hints.push(`Payload looks like: ${result.pattern}`);
    }

    return result;
  }

  patterns = {
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
    // if you detect Aztec via ZXing, you can set type="aztec" upstream
    aztec: /^AZTEC_[\s\S]+$/ // placeholder, adjust to your pipeline
  };

  formats = {
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
    aztec: { name: "Aztec", type: "2d" }
  };

  fuzzyMatch(text) {
    const clean = text.replace(/[^A-Z0-9]/gi, "");
    const len = clean.length;

    if (len === 13 && /^[0-9]+$/.test(clean)) return { type: "ean13", confidence: 0.8 };
    if (len === 12 && /^[0-9]+$/.test(clean)) return { type: "upc", confidence: 0.8 };
    if (len === 8 && /^[0-9]+$/.test(clean)) return { type: "ean8", confidence: 0.8 };

    if (len >= 20 && len <= 40) return { type: "qr", confidence: 0.65 };
    if (len >= 26 && len <= 35 && /^[13][A-Za-z0-9]+$/.test(clean)) return { type: "bitcoin", confidence: 0.75 };
    if (len === 42 && /^0x[A-Fa-f0-9]+$/.test(clean)) return { type: "ethereum", confidence: 0.8 };

    return null;
  }

  detectPattern(text) {
    const patterns = {
      email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      url: /^(https?:\/\/)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
      hex: /^[0-9a-fA-F]{32,64}$/,
      base64: /^[A-Za-z0-9+/=]{20,}$/,
      json: /^\s*\{[\s\S]*\}\s*$/,
      query: /^[A-Za-z0-9_\-]+=[^&]+(&[A-Za-z0-9_\-]+=[^&]+)*$/
    };

    for (const [type, pattern] of Object.entries(patterns)) {
      if (pattern.test(text)) return type;
    }
    return null;
  }

  calcEntropy(text) {
    if (!text.length) return 0;
    const freq = {};
    for (const char of text) freq[char] = (freq[char] || 0) + 1;
    let entropy = 0;
    const len = text.length;
    for (const char in freq) {
      const p = freq[char] / len;
      entropy -= p * Math.log2(p);
    }
    return parseFloat(entropy.toFixed(3));
  }

  trimCache() {
    if (this.cache.size > 200) {
      const entries = Array.from(this.cache.entries());
      entries.slice(0, 60).forEach(([key]) => this.cache.delete(key));
    }
  }

  // -----------------------------
  // Item guessing
  // -----------------------------

  guessItem(core) {
    const { type, pattern, length, entropy, raw } = core;

    const item = {
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

    if (type === "qtum" || raw.startsWith("QTUM_")) {
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

    if (["ean13", "ean8", "upc"].includes(type)) {
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

    return item;
  }

  // -----------------------------
  // Offline explanation
  // -----------------------------

  explainOffline(core, item) {
    const parts = [];

    parts.push(`Signal type: ${core.type || "unknown"}`);
    parts.push(`Pattern: ${core.pattern || "none"}`);
    parts.push(`Length: ${core.length}, entropy: ${core.entropy}`);
    parts.push(`Likely classification: ${item.label} (category=${item.category}, confidence=${item.confidence})`);

    if (core.checksum) {
      parts.push(
        `Checksum: calculated=${core.checksum.calculated}, provided=${core.checksum.provided}, valid=${core.checksum.valid}`
      );
    }

    if (core.hints.length) {
      parts.push(`Hints: ${core.hints.join("; ")}`);
    }

    if (item.category === "crypto") {
      parts.push("Treat as a public address only; never encode private keys in barcodes/QR.");
    } else if (item.category === "secret-ish") {
      parts.push("String looks token/hash-like; avoid exposing it publicly if tied to auth or tracking.");
    }

    return parts.join(". ");
  }

  // -----------------------------
  // SHA-256 helper
  // -----------------------------

  async sha256(text) {
    try {
      const enc = new TextEncoder().encode(text);
      const buf = await crypto.subtle.digest("SHA-256", enc);
      return Array.from(new Uint8Array(buf))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
    } catch (e) {
      console.warn("SHA-256 failed", e);
      return "n/a";
    }
  }

  // -----------------------------
  // Aztec decoding hook
  // -----------------------------

  decodeAztec(data) {
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
  }

  // -----------------------------
  // “Alt bash” style decoding: base64 / hex
  // -----------------------------

  decodeBashLike(text) {
    const clean = text.trim();

    // Try base64
    try {
      if (/^[A-Za-z0-9+/=]+$/.test(clean)) {
        const decoded = atob(clean);
        return { type: "base64", value: decoded };
      }
    } catch (_) {}

    // Try hex
    if (/^[0-9a-fA-F]+$/.test(clean) && clean.length % 2 === 0) {
      const bytes = clean.match(/.{2}/g).map(h => parseInt(h, 16));
      const value = String.fromCharCode(...bytes);
      return { type: "hex", value };
    }

    return { type: "unknown", value: null };
  }
}

window.Qai = Qai;
