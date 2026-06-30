/**
 * QAI v3.1 · Brain
 * Barcode / QR / crypto intelligence + Hugging Face enrichment + offline helpers
 */

const HF_CONFIG = {
  token: "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",
  model: "google/flan-t5-base"
};

class Qai {
  constructor() {
    this.version = "3.1";
    this._ready = false;
    this.eventBus = new EventTarget();
    this.cache = new Map();
    this.offlineOnly = false;

    this.huggingFace = {
      get token() { return HF_CONFIG.token; },
      set token(v) { HF_CONFIG.token = v ? String(v).trim() : null; },
      get model() { return HF_CONFIG.model; },
      set model(v) { if (v) HF_CONFIG.model = String(v).trim(); }
    };

    // Core pattern detection
    this.patterns = {
      ean13: /^[0-9]{13}$/,
      ean8: /^[0-9]{8}$/,
      upc: /^[0-9]{12}$/,
      code128: /^[\x20-\x7E]+$/, // printable ASCII
      code39: /^[A-Z0-9\-\.\s\$\/\+%]+$/,
      qr: /^[\s\S]{10,}$/, // any content, length-based
      qtum: /^QTUM_[A-Z0-9]{16}$/,
      bitcoin: /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/,
      ethereum: /^0x[a-fA-F0-9]{40}$/,
      email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      url: /^(https?:\/\/)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}([/?].*)?$/,
      phone: /^\+?[0-9]{10,15}$/
      // you can add aztec symbology detection here if needed
    };

    // Format metadata
    this.formats = {
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
      phone: { name: "Phone", type: "pattern" }
    };

    this.initialize();
  }

  initialize() {
    setTimeout(() => {
      this._ready = true;
      this.emit("ready", { version: this.version });
      console.log("🧠 QAI v3.1 ready");
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

  setHuggingFaceToken(token) {
    this.huggingFace.token = token;
  }

  setHuggingFaceModel(model) {
    this.huggingFace.model = model;
  }

  setOfflineMode(enabled) {
    this.offlineOnly = !!enabled;
  }

  // Main entry
  async process(text) {
    if (!text) throw new Error("No input");

    const cacheKey = text.slice(0, 80);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const core = this.analyze(text);
    const item = this.guessItem(core);

    let explanation;
    if (this.offlineOnly) {
      explanation = this.explainOffline(core, item);
    } else {
      explanation = await this.enrichWithHuggingFace(core, item);
    }

    // Optional: try bash-like decoding for hex/base64 payloads
    if (core.pattern === "hex" || core.pattern === "base64") {
      const decoded = this.decodeBashLike(core.raw);
      if (decoded.value) {
        core.hints.push(
          `Decoded ${decoded.type} payload: ${decoded.value.slice(0, 120)}`
        );
      }
    }

    const result = { ...core, item, explanation };

    this.cache.set(cacheKey, result);
    this.trimCache();

    return result;
  }

  // Core analysis
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

    // Direct pattern match
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

    // Fuzzy if nothing matched
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

    // Secondary pattern detection (payload type)
    result.pattern = this.detectPattern(clean);

    if (!result.valid && result.pattern) {
      result.hints.push(`Payload looks like: ${result.pattern}`);
    }

    return result;
  }

  // Fuzzy classification
  fuzzyMatch(text) {
    const clean = text.replace(/[^A-Z0-9]/gi, "");
    const len = clean.length;

    if (len === 13 && /^[0-9]+$/.test(clean)) return { type: "ean13", confidence: 0.8 };
    if (len === 12 && /^[0-9]+$/.test(clean)) return { type: "upc", confidence: 0.8 };
    if (len === 8 && /^[0-9]+$/.test(clean)) return { type: "ean8", confidence: 0.8 };

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
  }

  // Checksum for EAN/UPC
  calcChecksum(text) {
    const digits = text.replace(/\D/g, "").split("").map(Number);
    if (digits.length < 2) return null;

    let sum = 0;
    let alt = 1;
    for (let i = digits.length - 2; i >= 0; i--) {
      sum += digits[i] * (alt === 1 ? 3 : 1);
      alt = alt === 1 ? 0 : 1;
    }
    const check = (10 - (sum % 10)) % 10;
    const provided = digits[digits.length - 1];

    return {
      calculated: check,
      provided: provided,
      valid: provided === check
    };
  }

  // Payload pattern (inside QR / barcode)
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

  // Entropy
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

  // Cache trimming
  trimCache() {
    if (this.cache.size > 200) {
      const entries = Array.from(this.cache.entries());
      entries.slice(0, 60).forEach(([key]) => this.cache.delete(key));
    }
  }

  // Item guessing (what is this likely to represent?)
  guessItem(core) {
    const { type, pattern, length, entropy, raw } = core;

    const item = {
      category: "unknown",
      label: "Unknown item",
      confidence: 0.3,
      notes: []
    };

    // Crypto
    if (type === "bitcoin" || type === "ethereum") {
      item.category = "crypto";
      item.label = type === "bitcoin" ? "Bitcoin address" : "Ethereum address";
      item.confidence = 0.9;
      item.notes.push("Handle as a wallet address, not a secret key.");
      return item;
    }

    // QTUM
    if (type === "qtum" || raw.startsWith("QTUM_")) {
      item.category = "crypto";
      item.label = "QTUM signal";
      item.confidence = 0.85;
      item.notes.push("Likely a QTUM-related identifier or protocol tag.");
      return item;
    }

    // URLs
    if (pattern === "url") {
      item.category = "link";
      item.label = "Web URL";
      item.confidence = 0.9;
      item.notes.push("QR likely encodes a link or landing page.");
      return item;
    }

    // Email
    if (pattern === "email") {
      item.category = "contact";
      item.label = "Email address";
      item.confidence = 0.9;
      item.notes.push("Could be a contact QR or login identifier.");
      return item;
    }

    // JSON / query
    if (pattern === "json" || pattern === "query") {
      item.category = "payload";
      item.label = pattern === "json" ? "JSON payload" : "Query string payload";
      item.confidence = 0.8;
      item.notes.push("Likely part of an API, login, or tracking system.");
      return item;
    }

    // High entropy, long length → token / key / hash
    if (entropy > 3.5 && length >= 24) {
      item.category = "secret-ish";
      item.label = "Token / hash / key-like string";
      item.confidence = 0.75;
      item.notes.push("Treat carefully; may be sensitive or security-related.");
      return item;
    }

    // Barcodes
    if (["ean13", "ean8", "upc"].includes(type)) {
      item.category = "product";
      item.label = "Retail product barcode";
      item.confidence = 0.9;
      item.notes.push("Use with product databases or inventory systems.");
      return item;
    }

    if (type === "code128" || type === "code39") {
      item.category = "label";
      item.label = "Generic code label";
      item.confidence = 0.7;
      item.notes.push("Could be logistics, warehouse, or custom tagging.");
      return item;
    }

    if (type === "qr") {
      item.category = "qr";
      item.label = "QR payload";
      item.confidence = 0.7;
      item.notes.push("Content type depends on embedded pattern (URL, text, etc.).");
      return item;
    }

    // Fallback
    item.notes.push("No strong classification; treat as generic identifier.");
    return item;
  }

  // Offline explanation (no HF)
  explainOffline(core, item) {
    const parts = [];

    parts.push(`Detected type: ${core.type || "unknown"}; pattern: ${core.pattern || "none"}.`);
    parts.push(`Length ${core.length}, entropy ${core.entropy}.`);
    parts.push(`Item guess: ${item.label} (category=${item.category}, confidence=${item.confidence}).`);

    if (core.checksum) {
      parts.push(
        `Checksum: calculated=${core.checksum.calculated}, provided=${core.checksum.provided}, valid=${core.checksum.valid}.`
      );
    }

    if (item.category === "crypto") {
      parts.push("Treat this as a public address only; never store or transmit private keys in barcodes/QR.");
    } else if (item.category === "secret-ish") {
      parts.push("String looks token/hash-like; avoid exposing it publicly if it’s tied to auth or tracking.");
    }

    return parts.join(" ");
  }

  // Hugging Face enrichment
  async enrichWithHuggingFace(core, item) {
    const HF_TOKEN = this.huggingFace.token;
    const model = this.huggingFace.model || "google/flan-t5-base";

    if (!HF_TOKEN || HF_TOKEN.length < 10) {
      return "Hugging Face token not configured; using local heuristics only.";
    }

    const prompt = this.buildPrompt(core, item);

    try {
      const response = await fetch(
        `https://api-inference.huggingface.co/models/${model}`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${HF_TOKEN}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            inputs: prompt,
            parameters: {
              max_length: 192,
              temperature: 0.4
            }
          })
        }
      );

      if (!response.ok) {
        console.warn("HF non-OK", response.status, await response.text());
        return "Hugging Face call failed; using local heuristics only.";
      }

      const data = await response.json();
      if (data.error) {
        console.warn("HF error payload", data.error);
        return "Hugging Face call failed; using local heuristics only.";
      }

      return this.parseHfResponse(data);

    } catch (e) {
      console.warn("HF error", e);
      return "Hugging Face call failed; using local heuristics only.";
    }
  }

  parseHfResponse(data) {
    // flan-t5 style: [{ generated_text: "..."}] or similar
    if (Array.isArray(data) && data.length && data[0].generated_text) {
      return data[0].generated_text;
    }
    // fallback: stringify
    return typeof data === "string" ? data : JSON.stringify(data);
  }

  buildPrompt(core, item) {
    const checksumInfo = core.checksum
      ? `Checksum: calculated=${core.checksum.calculated}, provided=${core.checksum.provided}, valid=${core.checksum.valid}.`
      : "No checksum available.";

    const hints = core.hints && core.hints.length
      ? `Hints: ${core.hints.join("; ")}.`
      : "No extra hints.";

    return [
      "You are a concise technical explainer for barcode, QR, and crypto signals.",
      "Explain what this signal most likely represents, how it might be used, and any safety considerations.",
      "",
      `Raw signal: ${core.raw}`,
      `Detected type: ${core.type || "unknown"}`,
      `Format: ${core.format ? core.format.name : "unknown"} (${core.format ? core.format.type : "n/a"})`,
      `Payload pattern: ${core.pattern || "none"}`,
      `Length: ${core.length}, entropy: ${core.entropy}`,
      checksumInfo,
      `Item guess: category=${item.category}, label=${item.label}, confidence=${item.confidence}`,
      hints,
      "",
      "Respond in 2–4 sentences, clear and practical."
    ].join("\n");
  }

  // Aztec decoding hook (requires external library, e.g. ZXing)
  decodeAztec(data) {
    try {
      // TODO: wire to actual Aztec decoder, e.g. ZXing
      // const decoded = decodeAztecBinary(data);
      // return decoded;
      console.warn("Aztec decode not implemented: plug in ZXing or similar here.");
      return null;
    } catch (e) {
      console.warn("Aztec decode failed", e);
      return null;
    }
  }

  // SHA-256 helper (hashing, not decryption)
  async sha256(text) {
    const enc = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
  }

  // “Alt bash” style decoding: base64 / hex
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
