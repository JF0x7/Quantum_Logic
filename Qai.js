/**
 * QAI · Brain
 * Minimal barcode intelligence engine
 */

class Qai {
  constructor() {
    this.version = '1.0';
    this.isReady = false;
    this.eventBus = new EventTarget();
    this.cache = new Map();

    // Barcode patterns
    this.patterns = {
      ean13: /^[0-9]{13}$/,
      ean8: /^[0-9]{8}$/,
      upc: /^[0-9]{12}$/,
      code128: /^[A-Z0-9\-_]+$/,
      code39: /^[A-Z0-9\-\.\s]+$/,
      qr: /^[A-Z0-9+\/=\s]+$/,
      qtum: /^QTUM_[A-Z0-9]{16}$/,
      bitcoin: /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/,
      ethereum: /^0x[a-fA-F0-9]{40}$/,
      email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      url: /^(https?:\/\/)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}([/?].*)?$/,
      phone: /^\+?[0-9]{10,15}$/
    };

    this.formats = {
      ean13: { name: 'EAN-13', type: 'barcode' },
      ean8: { name: 'EAN-8', type: 'barcode' },
      upc: { name: 'UPC-A', type: 'barcode' },
      code128: { name: 'Code 128', type: 'barcode' },
      code39: { name: 'Code 39', type: 'barcode' },
      qr: { name: 'QR Code', type: '2d' },
      qtum: { name: 'QTUM', type: 'protocol' },
      bitcoin: { name: 'Bitcoin', type: 'crypto' },
      ethereum: { name: 'Ethereum', type: 'crypto' },
      email: { name: 'Email', type: 'pattern' },
      url: { name: 'URL', type: 'pattern' },
      phone: { name: 'Phone', type: 'pattern' }
    };

    this.initialize();
  }

  initialize() {
    setTimeout(() => {
      this.isReady = true;
      this.emit('ready', { version: this.version });
      console.log('🧠 QAI ready');
    }, 100);
  }

  // Main process - returns 8 pieces of info
  process(text) {
    if (!text) throw new Error('No input');

    const cacheKey = text.slice(0, 50);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const result = this.analyze(text);
    this.cache.set(cacheKey, result);
    this.trimCache();

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
      entropy: this.calcEntropy(clean)
    };

    // Find matching pattern
    for (const [type, pattern] of Object.entries(this.patterns)) {
      if (pattern.test(clean)) {
        result.type = type;
        result.format = this.formats[type] || null;
        result.valid = true;
        result.confidence = 0.92;
        
        // Checksum for numeric barcodes
        if (['ean13', 'ean8', 'upc'].includes(type)) {
          result.checksum = this.calcChecksum(clean);
        }
        break;
      }
    }

    // Fuzzy fallback
    if (!result.valid) {
      const fuzzy = this.fuzzyMatch(clean);
      if (fuzzy) {
        result.type = fuzzy.type;
        result.format = this.formats[fuzzy.type] || null;
        result.valid = true;
        result.confidence = fuzzy.confidence;
      }
    }

    // Pattern detection
    result.pattern = this.detectPattern(clean);

    return result;
  }

  fuzzyMatch(text) {
    const clean = text.replace(/[^A-Z0-9]/gi, '');
    const len = clean.length;
    
    if (len === 13 && /^[0-9]+$/.test(clean)) return { type: 'ean13', confidence: 0.8 };
    if (len === 12 && /^[0-9]+$/.test(clean)) return { type: 'upc', confidence: 0.8 };
    if (len === 8 && /^[0-9]+$/.test(clean)) return { type: 'ean8', confidence: 0.8 };
    if (len >= 20 && len <= 40) return { type: 'qr', confidence: 0.6 };
    if (len >= 26 && len <= 35 && /^[13][A-Za-z0-9]+$/.test(clean)) {
      return { type: 'bitcoin', confidence: 0.75 };
    }
    if (len === 42 && /^0x[A-Fa-f0-9]+$/.test(clean)) {
      return { type: 'ethereum', confidence: 0.8 };
    }
    return null;
  }

  calcChecksum(text) {
    const digits = text.replace(/\D/g, '').split('').map(Number);
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

  detectPattern(text) {
    const patterns = {
      email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      url: /^(https?:\/\/)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
      hex: /^[0-9a-fA-F]{32,64}$/,
      base64: /^[A-Za-z0-9+/=]{20,}$/
    };

    for (const [type, pattern] of Object.entries(patterns)) {
      if (pattern.test(text)) return type;
    }
    return null;
  }

  calcEntropy(text) {
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
      entries.slice(0, 40).forEach(([key]) => this.cache.delete(key));
    }
  }

  isReady() { return this.isReady; }

  // Events
  emit(event, detail) {
    this.eventBus.dispatchEvent(new CustomEvent(event, { detail }));
  }

  addEventListener(event, callback) {
    this.eventBus.addEventListener(event, callback);
  }

  removeEventListener(event, callback) {
    this.eventBus.removeEventListener(event, callback);
  }
}

window.Qai = Qai;
