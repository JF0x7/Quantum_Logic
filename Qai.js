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
    queueMicrotask(() => {
      this._ready = true;
      this.emit("ready", { version: this.version });
      console.log("🧠 QAI v5.0-local ready");
    });
  }

  isReady() { return this._ready; }
  emit(event, detail) { this.eventBus.dispatchEvent(new CustomEvent(event, { detail })); }
  addEventListener(event, callback) { this.eventBus.addEventListener(event, callback); }
  removeEventListener(event, callback) { this.eventBus.removeEventListener(event, callback); }

  async process(text) {
    if (!text) throw new Error("No input");
    const cacheKey = text.slice(0, 80);
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

    const core = this.analyze(text);
    const item = this.guessItem(core);

    if (core.pattern === "hex" || core.pattern === "base64") {
      const decoded = this.decodeBashLike(core.raw);
      if (decoded.value) core.hints.push(`Decoded ${decoded.type}: ${decoded.value.slice(0, 120)}`);
    }

    if (core.type === "aztec") {
      const aztecDecoded = this.decodeAztec(core.raw);
      if (aztecDecoded) core.hints.push(`Aztec decoded: ${aztecDecoded.slice(0, 120)}`);
    }

    core.hints.push(`SHA-256: ${(await this.sha256(core.raw)).slice(0, 32)}…`);
    const result = { ...core, item, explanation: this.explainOffline(core, item) };
    this.cache.set(cacheKey, result);
    if (this.cache.size > 200) Array.from(this.cache.keys()).slice(0, 60).forEach(k => this.cache.delete(k));
    return result;
  }

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

    const matched = this.definitions.find(def => def.regex.test(clean));
    if (matched) {
      result.type = matched.type;
      result.format = matched.format;
      result.valid = true;
      result.confidence = 0.92;
      if (matched.checksum) result.checksum = this.calcChecksum(clean);
    } else {
      const fuzzy = this.fuzzyMatch(clean);
      if (fuzzy) {
        result.type = fuzzy.type;
        result.format = this.definitions.find(def => def.type === fuzzy.type)?.format || null;
        result.valid = true;
        result.confidence = fuzzy.confidence;
        result.hints.push("Fuzzy classification");
      }
    }

    result.pattern = this.detectPattern(clean);
    if (!result.valid && result.pattern) result.hints.push(`Payload looks like: ${result.pattern}`);
    return result;
  }

  definitions = [
    { type: "ean13", regex: /^[0-9]{13}$/, format: { name: "EAN-13", type: "barcode" }, checksum: true, guess: { category: "product", label: "Retail barcode", confidence: 0.9 } },
    { type: "ean8", regex: /^[0-9]{8}$/, format: { name: "EAN-8", type: "barcode" }, checksum: true, guess: { category: "product", label: "Retail barcode", confidence: 0.9 } },
    { type: "upc", regex: /^[0-9]{12}$/, format: { name: "UPC-A", type: "barcode" }, checksum: true, guess: { category: "product", label: "Retail barcode", confidence: 0.9 } },
    { type: "code128", regex: /^[\x20-\x7E]+$/, format: { name: "Code 128", type: "barcode" }, guess: { category: "label", label: "Generic code label", confidence: 0.7 } },
    { type: "code39", regex: /^[A-Z0-9\-\.\s\$\/\+%]+$/, format: { name: "Code 39", type: "barcode" }, guess: { category: "label", label: "Generic code label", confidence: 0.7 } },
    { type: "qr", regex: /^[\s\S]{10,}$/, format: { name: "QR Code", type: "2d" }, guess: { category: "qr", label: "QR payload", confidence: 0.7 } },
    { type: "qtum", regex: /^QTUM_[A-Z0-9]{16}$/, format: { name: "QTUM", type: "protocol" }, guess: { category: "crypto", label: "QTUM signal", confidence: 0.85 } },
    { type: "bitcoin", regex: /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/, format: { name: "Bitcoin", type: "crypto" }, guess: { category: "crypto", label: "Bitcoin address", confidence: 0.9 } },
    { type: "ethereum", regex: /^0x[a-fA-F0-9]{40}$/, format: { name: "Ethereum", type: "crypto" }, guess: { category: "crypto", label: "Ethereum address", confidence: 0.9 } },
    { type: "email", regex: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, format: { name: "Email", type: "pattern" }, guess: { category: "contact", label: "Email address", confidence: 0.9 } },
    { type: "url", regex: /^(https?:\/\/)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, format: { name: "URL", type: "pattern" }, guess: { category: "link", label: "Web URL", confidence: 0.9 } },
    { type: "phone", regex: /^\+?[0-9]{10,15}$/, format: { name: "Phone", type: "pattern" } },
    { type: "aztec", regex: /^AZTEC_[\s\S]+$/, format: { name: "Aztec", type: "2d" }, guess: { category: "qr", label: "Aztec payload", confidence: 0.75 } }
  ];

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
    const patterns = [
      ["email", /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/],
      ["url", /^(https?:\/\/)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/],
      ["hex", /^[0-9a-fA-F]{32,64}$/],
      ["base64", /^[A-Za-z0-9+/=]{20,}$/],
      ["json", /^\s*\{[\s\S]*\}\s*$/],
      ["query", /^[A-Za-z0-9_\-]+=[^&]+(&[A-Za-z0-9_\-]+=[^&]+)*$/]
    ];
    return patterns.find(([, regex]) => regex.test(text))?.[0] || null;
  }

  calcEntropy(text) {
    if (!text.length) return 0;
    const freq = [...text].reduce((acc, c) => ((acc[c] = (acc[c] || 0) + 1), acc), {});
    const len = text.length;
    return parseFloat(Object.values(freq).reduce((sum, n) => {
      const p = n / len;
      return sum - p * Math.log2(p);
    }, 0).toFixed(3));
  }

  calcChecksum(code) {
    const digits = code.split("").map(Number);
    if (![8, 12, 13].includes(digits.length) || digits.some(isNaN)) return null;
    const provided = digits.pop();
    const sum = digits.reverse().reduce((acc, n, i) => acc + n * (i % 2 ? 1 : 3), 0);
    const calculated = (10 - (sum % 10)) % 10;
    return { calculated, provided, valid: calculated === provided };
  }

  guessItem(core) {
    const { type, pattern, entropy, length, raw } = core;
    const rule = this.definitions.find(r => r.type === type);
    if (rule?.guess) return { ...rule.guess, notes: [] };
    if (raw.startsWith("QTUM_")) return { category: "crypto", label: "QTUM signal", confidence: 0.85, notes: [] };
    if (pattern === "json" || pattern === "query") return { category: "payload", label: pattern === "json" ? "JSON payload" : "Query string", confidence: 0.8, notes: [] };
    if (entropy > 3.5 && length >= 24) return { category: "secret-ish", label: "Token / hash-like string", confidence: 0.75, notes: [] };
    return { category: "unknown", label: "Unknown item", confidence: 0.3, notes: [] };
  }

  explainOffline(core, item) {
    const parts = [
      `Signal type: ${core.type || "unknown"}`,
      `Pattern: ${core.pattern || "none"}`,
      `Length: ${core.length}, entropy: ${core.entropy}`,
      `Likely classification: ${item.label} (category=${item.category}, confidence=${item.confidence})`
    ];
    if (core.checksum) parts.push(`Checksum: calculated=${core.checksum.calculated}, provided=${core.checksum.provided}, valid=${core.checksum.valid}`);
    if (core.hints.length) parts.push(`Hints: ${core.hints.join("; ")}`);
    if (item.category === "crypto") parts.push("Treat as a public address only; never encode private keys in barcodes/QR.");
    else if (item.category === "secret-ish") parts.push("String looks token/hash-like; avoid exposing it publicly if tied to auth or tracking.");
    return parts.join(". ");
  }

  async sha256(text) {
    try {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
      return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, "0")).join("");
    } catch (e) {
      console.warn("SHA-256 failed", e);
      return "n/a";
    }
  }

  decodeAztec(data) {
    try {
      console.warn("Aztec decode not wired yet.");
      return null;
    } catch (e) {
      console.warn("Aztec decode failed", e);
      return null;
    }
  }

  decodeBashLike(text) {
    const clean = text.trim();
    try {
      if (/^[A-Za-z0-9+/=]+$/.test(clean)) return { type: "base64", value: atob(clean) };
    } catch {}
    if (/^[0-9a-fA-F]+$/.test(clean) && clean.length % 2 === 0) return { type: "hex", value: String.fromCharCode(...clean.match(/.{2}/g).map(h => parseInt(h, 16))) };
    return { type: "unknown", value: null };
  }
}

window.Qai = Qai;
