/**
 * QAI v6.0 · Full Local Brain Enhanced
 * Barcode / QR / crypto intelligence + offline helpers (SHA-256, Aztec hook, alt-bash decode)
 * Integrated with QuantumLedger and DDN systems
 */

class Qai {
  constructor(config = {}) {
    this.version = "6.0-enhanced";
    this._ready = false;
    this.eventBus = new EventTarget();
    this.cache = new Map();
    this.config = {
      enableAztec: true,
      enableDDN: true,
      enableMorse: true,
      enableDeepAnalysis: true,
      cacheSize: 300,
      ...config
    };
    
    // Enhanced pattern registry
    this.patterns = this.buildPatterns();
    this.formats = this.buildFormats();
    this.decoders = this.buildDecoders();
    
    this.initialize();
  }

  // ============================================================
  // INITIALIZATION
  // ============================================================
  
  initialize() {
    // Load any stored data
    this.loadState();
    
    setTimeout(() => {
      this._ready = true;
      this.emit("ready", { 
        version: this.version,
        config: this.config,
        decoders: Object.keys(this.decoders)
      });
      console.log(`🧠 QAI v${this.version} ready with ${Object.keys(this.decoders).length} decoders`);
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

  // ============================================================
  // STATE MANAGEMENT
  // ============================================================
  
  loadState() {
    try {
      const saved = localStorage.getItem('qai_state');
      if (saved) {
        const state = JSON.parse(saved);
        this.state = state;
        console.log('📂 QAI state loaded');
      }
    } catch (e) {
      console.warn('Could not load state:', e);
    }
  }

  saveState() {
    try {
      localStorage.setItem('qai_state', JSON.stringify(this.state || {}));
    } catch (e) {
      console.warn('Could not save state:', e);
    }
  }

  // ============================================================
  // PATTERN BUILDERS
  // ============================================================
  
  buildPatterns() {
    return {
      // Barcodes
      ean13: /^[0-9]{13}$/,
      ean8: /^[0-9]{8}$/,
      upc: /^[0-9]{12}$/,
      code128: /^[\x20-\x7E]+$/,
      code39: /^[A-Z0-9\-\.\s\$\/\+%]+$/,
      code93: /^[A-Z0-9\-\.\s\$\/\+%]+$/,
      codabar: /^[A-D][0-9\-\$\.\/\+]+[A-D]$/,
      interleaved25: /^[0-9]{2,}$/,
      
      // 2D Codes
      qr: /^[\s\S]{10,}$/,
      aztec: /^AZTEC_[\s\S]+$|^[\x00-\x7F]{4,}$/,
      datamatrix: /^DM_[\s\S]+$/,
      pdf417: /^PDF_[\s\S]+$/,
      
      // Crypto
      qtum: /^QTUM_[A-Z0-9]{16}$/,
      bitcoin: /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/,
      ethereum: /^0x[a-fA-F0-9]{40}$/,
      ripple: /^r[a-zA-Z0-9]{24,34}$/,
      monero: /^[48][0-9AB][1-9A-HJ-NP-Za-km-z]{93,94}$/,
      
      // Patterns
      email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      url: /^(https?:\/\/)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
      phone: /^\+?[0-9]{10,15}$/,
      ipv4: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
      ipv6: /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/,
      
      // Data formats
      hex: /^[0-9a-fA-F]{2,}$/,
      base64: /^[A-Za-z0-9+/=]{4,}$/,
      json: /^\s*\{[\s\S]*\}\s*$/,
      xml: /^\s*<[\s\S]*>[\s\S]*<\/[\s\S]*>\s*$/,
      jwt: /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/,
      
      // Encodings
      ddnEncrypted: /DDN_ENC::/,
      morse: /^[.\-/\s]+$/,
      rot13: /^[A-Za-z\s]+$/,
      
      // DDN specific
      ddnSignal: /DDN_ENC::[A-Z0-9]+::[A-Z0-9_]+/,
      
      // QAI specific
      qaiSignal: /QAI_[A-Z0-9]{8}/,
      quantumSignal: /QNTM_ENC\{[^}]+\}/,
      
      // Misc
      uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      timestamp: /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/,
      coordinates: /^[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?),\s*[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)$/
    };
  }

  buildFormats() {
    return {
      ean13: { name: "EAN-13", type: "barcode", category: "retail", confidence: 0.95 },
      ean8: { name: "EAN-8", type: "barcode", category: "retail", confidence: 0.95 },
      upc: { name: "UPC-A", type: "barcode", category: "retail", confidence: 0.95 },
      code128: { name: "Code 128", type: "barcode", category: "industrial", confidence: 0.85 },
      code39: { name: "Code 39", type: "barcode", category: "industrial", confidence: 0.85 },
      code93: { name: "Code 93", type: "barcode", category: "industrial", confidence: 0.85 },
      codabar: { name: "Codabar", type: "barcode", category: "library", confidence: 0.8 },
      interleaved25: { name: "Interleaved 2 of 5", type: "barcode", category: "industrial", confidence: 0.8 },
      qr: { name: "QR Code", type: "2d", category: "universal", confidence: 0.9 },
      aztec: { name: "Aztec Code", type: "2d", category: "transport", confidence: 0.9 },
      datamatrix: { name: "Data Matrix", type: "2d", category: "industrial", confidence: 0.9 },
      pdf417: { name: "PDF417", type: "2d", category: "transport", confidence: 0.9 },
      qtum: { name: "QTUM", type: "protocol", category: "crypto", confidence: 0.95 },
      bitcoin: { name: "Bitcoin", type: "crypto", category: "crypto", confidence: 0.95 },
      ethereum: { name: "Ethereum", type: "crypto", category: "crypto", confidence: 0.95 },
      ripple: { name: "Ripple", type: "crypto", category: "crypto", confidence: 0.9 },
      monero: { name: "Monero", type: "crypto", category: "crypto", confidence: 0.9 },
      email: { name: "Email", type: "pattern", category: "contact", confidence: 0.95 },
      url: { name: "URL", type: "pattern", category: "web", confidence: 0.95 },
      phone: { name: "Phone", type: "pattern", category: "contact", confidence: 0.9 },
      ipv4: { name: "IPv4", type: "pattern", category: "network", confidence: 0.95 },
      ipv6: { name: "IPv6", type: "pattern", category: "network", confidence: 0.9 },
      hex: { name: "Hex String", type: "data", category: "encoding", confidence: 0.85 },
      base64: { name: "Base64", type: "data", category: "encoding", confidence: 0.85 },
      json: { name: "JSON", type: "data", category: "structured", confidence: 0.95 },
      xml: { name: "XML", type: "data", category: "structured", confidence: 0.9 },
      jwt: { name: "JWT", type: "data", category: "auth", confidence: 0.9 },
      ddnEncrypted: { name: "DDN Encrypted", type: "protocol", category: "encrypted", confidence: 0.85 },
      morse: { name: "Morse Code", type: "encoding", category: "legacy", confidence: 0.85 },
      rot13: { name: "ROT13", type: "encoding", category: "cipher", confidence: 0.8 },
      uuid: { name: "UUID", type: "identifier", category: "id", confidence: 0.95 },
      timestamp: { name: "Timestamp", type: "temporal", category: "time", confidence: 0.9 },
      coordinates: { name: "Coordinates", type: "location", category: "geo", confidence: 0.85 }
    };
  }

  buildDecoders() {
    return {
      base64: this.decodeBase64.bind(this),
      hex: this.decodeHex.bind(this),
      rot13: this.decodeRot13.bind(this),
      morse: this.decodeMorse.bind(this),
      ddn: this.decodeDDN.bind(this),
      aztec: this.decodeAztec.bind(this),
      json: this.decodeJSON.bind(this),
      jwt: this.decodeJWT.bind(this),
      url: this.decodeURL.bind(this)
    };
  }

  // ============================================================
  // MAIN PROCESSING PIPELINE
  // ============================================================
  
  async process(text, options = {}) {
    if (!text) throw new Error("No input");

    const cacheKey = this.getCacheKey(text);
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

    try {
      // Stage 1: Core Analysis
      const core = this.analyze(text);
      
      // Stage 2: Pattern Detection
      const pattern = this.detectPattern(text);
      core.pattern = pattern;
      
      // Stage 3: Deep Analysis (if enabled)
      if (this.config.enableDeepAnalysis) {
        const deep = await this.deepAnalyze(text);
        Object.assign(core, deep);
      }
      
      // Stage 4: Decoding Pipeline
      const decoded = await this.decodePipeline(text, core);
      core.decoded = decoded;
      
      // Stage 5: Classification
      const classification = this.classify(core);
      core.classification = classification;
      
      // Stage 6: Generate Item
      const item = this.guessItem(core);
      core.item = item;
      
      // Stage 7: Generate Explanation
      const explanation = this.explainOffline(core, item);
      core.explanation = explanation;
      
      // Stage 8: Generate Q-Notes
      const qnotes = this.generateQNotes(core);
      core.qnotes = qnotes;
      
      // Stage 9: Security Assessment
      const security = this.securityAssessment(core);
      core.security = security;

      const result = {
        ...core,
        processedAt: new Date().toISOString(),
        version: this.version
      };

      this.cache.set(cacheKey, result);
      this.trimCache();
      
      this.emit("processed", { result, text });
      return result;
      
    } catch (error) {
      console.error('QAI processing error:', error);
      this.emit("error", { error, text });
      throw error;
    }
  }

  // ============================================================
  // CORE ANALYSIS
  // ============================================================
  
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
      hints: [],
      metadata: {}
    };

    // Check all patterns
    for (const [type, pattern] of Object.entries(this.patterns)) {
      if (pattern.test(clean)) {
        result.type = type;
        result.format = this.formats[type] || null;
        result.valid = true;
        result.confidence = this.formats[type]?.confidence || 0.85;
        
        // Calculate checksum for barcodes
        if (["ean13", "ean8", "upc"].includes(type)) {
          result.checksum = this.calcChecksum(clean);
        }
        
        // Extract metadata
        result.metadata = this.extractMetadata(type, clean);
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
        result.hints.push("Fuzzy classification");
        result.metadata = this.extractMetadata(fuzzy.type, clean);
      }
    }

    // Determine pattern type
    result.pattern = this.detectPattern(clean);

    if (!result.valid && result.pattern) {
      result.hints.push(`Payload looks like: ${result.pattern}`);
    }

    return result;
  }

  // ============================================================
  // DEEP ANALYSIS
  // ============================================================
  
  async deepAnalyze(text) {
    const results = {
      entropyBreakdown: this.entropyBreakdown(text),
      ngrams: this.extractNGrams(text, 3),
      compression: this.estimateCompression(text),
      structure: this.analyzeStructure(text),
      language: this.detectLanguage(text),
      complexity: this.calculateComplexity(text)
    };
    
    // Analyze entropy by character types
    results.charDistribution = this.charDistribution(text);
    
    // Check for common patterns
    results.commonPatterns = this.findCommonPatterns(text);
    
    return results;
  }

  entropyBreakdown(text) {
    const types = {
      uppercase: /[A-Z]/g,
      lowercase: /[a-z]/g,
      digits: /[0-9]/g,
      symbols: /[^A-Za-z0-9\s]/g,
      spaces: /\s/g
    };
    
    const breakdown = {};
    const total = text.length || 1;
    
    for (const [type, pattern] of Object.entries(types)) {
      const matches = text.match(pattern) || [];
      breakdown[type] = parseFloat((matches.length / total * 100).toFixed(1));
    }
    
    return breakdown;
  }

  extractNGrams(text, n = 3) {
    const grams = {};
    const cleaned = text.replace(/\s+/g, ' ');
    
    for (let i = 0; i <= cleaned.length - n; i++) {
      const gram = cleaned.slice(i, i + n);
      grams[gram] = (grams[gram] || 0) + 1;
    }
    
    // Return top 10 n-grams
    return Object.entries(grams)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([gram, count]) => ({ gram, count }));
  }

  estimateCompression(text) {
    const original = text.length;
    const unique = new Set(text).size;
    const compressed = Math.round(original * (unique / 256) * 2);
    return {
      original,
      compressed,
      ratio: parseFloat((compressed / original * 100).toFixed(1))
    };
  }

  analyzeStructure(text) {
    const structure = {
      hasWhitespace: /\s/.test(text),
      hasNewlines: /\n/.test(text),
      hasTabs: /\t/.test(text),
      hasMixedCase: /[A-Z]/.test(text) && /[a-z]/.test(text),
      hasNumbers: /[0-9]/.test(text),
      hasSymbols: /[^A-Za-z0-9\s]/.test(text),
      lineCount: (text.match(/\n/g) || []).length + 1
    };
    
    // Determine format structure
    if (text.startsWith('{') && text.endsWith('}')) {
      structure.format = 'JSON';
    } else if (text.startsWith('<') && text.includes('</')) {
      structure.format = 'XML';
    } else if (text.includes('=') && text.includes('&')) {
      structure.format = 'Query String';
    } else if (text.includes('://')) {
      structure.format = 'URL';
    } else if (text.includes('@')) {
      structure.format = 'Email';
    }
    
    return structure;
  }

  detectLanguage(text) {
    // Simple language detection based on character frequency
    const englishFreq = 'etaoinshrdlcumwfgypbvkjxqz';
    const textChars = text.toLowerCase().replace(/[^a-z]/g, '');
    if (textChars.length === 0) return { language: 'unknown', confidence: 0 };
    
    const freq = {};
    for (const char of textChars) {
      freq[char] = (freq[char] || 0) + 1;
    }
    
    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
    const topChars = sorted.slice(0, 5).map(([char]) => char);
    const englishTop = englishFreq.slice(0, 5);
    
    const matches = topChars.filter(char => englishTop.includes(char)).length;
    const confidence = matches / 5;
    
    return {
      language: confidence > 0.6 ? 'english' : 'unknown',
      confidence: parseFloat(confidence.toFixed(2))
    };
  }

  calculateComplexity(text) {
    const factors = {
      length: text.length,
      entropy: this.calcEntropy(text),
      uniqueChars: new Set(text).size,
      digitRatio: (text.match(/[0-9]/g) || []).length / text.length,
      symbolRatio: (text.match(/[^A-Za-z0-9\s]/g) || []).length / text.length
    };
    
    // Calculate complexity score (0-100)
    const score = Math.min(100, Math.round(
      (factors.entropy * 10) +
      (factors.uniqueChars / 10) +
      (factors.symbolRatio * 20) +
      (factors.digitRatio * 10) +
      (Math.min(factors.length / 10, 10))
    ));
    
    let level = 'low';
    if (score > 60) level = 'high';
    else if (score > 30) level = 'medium';
    
    return {
      score,
      level,
      factors
    };
  }

  charDistribution(text) {
    const chars = {};
    for (const char of text) {
      chars[char] = (chars[char] || 0) + 1;
    }
    return Object.entries(chars)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([char, count]) => ({ 
        char, 
        count, 
        percentage: parseFloat((count / text.length * 100).toFixed(1)) 
      }));
  }

  findCommonPatterns(text) {
    const patterns = [];
    
    // Check for date patterns
    if (/\d{4}-\d{2}-\d{2}/.test(text)) patterns.push('date');
    if (/\d{2}:\d{2}:\d{2}/.test(text)) patterns.push('time');
    
    // Check for currency
    if (/[$€£¥]/.test(text)) patterns.push('currency');
    
    // Check for hashtags
    if (/#[A-Za-z0-9_]+/.test(text)) patterns.push('hashtags');
    
    // Check for mentions
    if (/@[A-Za-z0-9_]+/.test(text)) patterns.push('mentions');
    
    // Check for emojis
    if (/[\u{1F300}-\u{1F9FF}]/u.test(text)) patterns.push('emoji');
    
    return patterns;
  }

  // ============================================================
  // DECODING PIPELINE
  // ============================================================
  
  async decodePipeline(text, core) {
    const results = {
      successes: [],
      attempts: []
    };
    
    // Try each decoder
    for (const [name, decoder] of Object.entries(this.decoders)) {
      try {
        const decoded = await decoder(text);
        if (decoded && decoded !== text) {
          results.successes.push({ decoder: name, result: decoded });
        }
        results.attempts.push({ decoder: name, success: !!decoded });
      } catch (e) {
        results.attempts.push({ decoder: name, success: false, error: e.message });
      }
    }
    
    // If we have Aztec decode and it's enabled, try it
    if (this.config.enableAztec) {
      try {
        const aztec = await this.decodeAztec(text);
        if (aztec && aztec !== text) {
          results.successes.push({ decoder: 'aztec_advanced', result: aztec });
        }
      } catch (e) {}
    }
    
    // If we have DDN decode and it's enabled, try it
    if (this.config.enableDDN) {
      try {
        const ddn = await this.decodeDDN(text);
        if (ddn && ddn !== text) {
          results.successes.push({ decoder: 'ddn_advanced', result: ddn });
        }
      } catch (e) {}
    }
    
    return results;
  }

  // ============================================================
  // DECODERS IMPLEMENTATION
  // ============================================================
  
  decodeBase64(text) {
    try {
      if (/^[A-Za-z0-9+/=]+$/.test(text)) {
        const decoded = atob(text);
        // Check if decoded is readable
        if (decoded.length > 0 && /^[\x20-\x7E]*$/.test(decoded)) {
          return decoded;
        }
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  decodeHex(text) {
    try {
      if (/^[0-9a-fA-F]+$/.test(text) && text.length % 2 === 0) {
        const bytes = text.match(/.{2}/g).map(h => parseInt(h, 16));
        const decoded = String.fromCharCode(...bytes);
        if (/^[\x20-\x7E]*$/.test(decoded)) {
          return decoded;
        }
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  decodeRot13(text) {
    try {
      return text.replace(/[A-Za-z]/g, c => {
        const code = c.charCodeAt(0);
        const base = code >= 65 && code <= 90 ? 65 : 97;
        return String.fromCharCode((code - base + 13) % 26 + base);
      });
    } catch (_) {
      return null;
    }
  }

  decodeMorse(text) {
    try {
      const morseMap = {
        '.-': 'A', '-...': 'B', '-.-.': 'C', '-..': 'D', '.': 'E',
        '..-.': 'F', '--.': 'G', '....': 'H', '..': 'I', '.---': 'J',
        '-.-': 'K', '.-..': 'L', '--': 'M', '-.': 'N', '---': 'O',
        '.--.': 'P', '--.-': 'Q', '.-.': 'R', '...': 'S', '-': 'T',
        '..-': 'U', '...-': 'V', '.--': 'W', '-..-': 'X', '-.--': 'Y',
        '--..': 'Z',
        '-----': '0', '.----': '1', '..---': '2', '...--': '3',
        '....-': '4', '.....': '5', '-....': '6', '--...': '7',
        '---..': '8', '----.': '9',
        '.-.-.-': '.', '--..--': ',', '..--..': '?', '.----.': "'",
        '-.-.--': '!', '-..-.': '/', '-.--.': '(', '-.--.-': ')',
        '.-...': '&', '---...': ':', '-.-.-.': ';', '-...-': '=',
        '.-.-.': '+', '-....-': '-', '..--.-': '_', '.-..-.': '"',
        '...-..-': '$', '.--.-.': '@'
      };
      
      if (!/^[.\-/\s]+$/.test(text)) return null;
      
      const words = text.split('/');
      let result = [];
      
      for (const word of words) {
        const letters = word.trim().split(' ');
        let decoded = '';
        for (const letter of letters) {
          if (!letter) continue;
          if (letter === '...---...') {
            decoded += 'SOS';
          } else if (morseMap[letter]) {
            decoded += morseMap[letter];
          } else {
            return null;
          }
        }
        result.push(decoded);
      }
      
      return result.join(' ');
    } catch (_) {
      return null;
    }
  }

  decodeDDN(text) {
    try {
      if (!/DDN_ENC::/.test(text)) return null;
      
      let result = text;
      
      // Remove markers
      result = result.replace(/DDN_ENC::/g, '');
      result = result.replace(/::DDN_END/g, '');
      
      // XOR with 0x5A
      result = result.split('').map(c => 
        String.fromCharCode(c.charCodeAt(0) ^ 0x5A)
      ).join('');
      
      // Reverse
      result = result.split('').reverse().join('');
      
      // Caesar shift
      const offset = (text.length % 5) + 1;
      result = result.split('').map(c => {
        const code = c.charCodeAt(0);
        if (code >= 65 && code <= 90) {
          return String.fromCharCode(((code - 65 - offset + 26) % 26) + 65);
        } else if (code >= 97 && code <= 122) {
          return String.fromCharCode(((code - 97 - offset + 26) % 26) + 97);
        }
        return c;
      }).join('');
      
      // Try Base64 decode
      if (/^[A-Za-z0-9+/=]+$/.test(result)) {
        try {
          result = atob(result);
        } catch (_) {}
      }
      
      return result;
    } catch (_) {
      return null;
    }
  }

  decodeAztec(text) {
    try {
      // Check if it looks like Aztec-encoded data
      if (!this.config.enableAztec) return null;
      
      // If text is too short, skip
      if (text.length < 4) return null;
      
      // Try to detect if it's Base64 or hex encoded Aztec data
      const decoded = this.decodeBase64(text) || this.decodeHex(text);
      if (decoded && decoded.length > 0) {
        return `Aztec decoded: ${decoded.substring(0, 200)}${decoded.length > 200 ? '...' : ''}`;
      }
      
      // Basic Aztec-like decode (XOR with alternating pattern)
      const xorKey = [0x3A, 0x5C, 0x7E, 0x2A];
      let result = text.split('').map((c, i) => {
        return String.fromCharCode(c.charCodeAt(0) ^ xorKey[i % xorKey.length]);
      }).join('');
      
      if (/^[\x20-\x7E]*$/.test(result)) {
        return result;
      }
      
      return null;
    } catch (_) {
      return null;
    }
  }

  decodeJSON(text) {
    try {
      if (text.startsWith('{') || text.startsWith('[')) {
        const parsed = JSON.parse(text);
        return parsed;
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  decodeJWT(text) {
    try {
      if (/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(text)) {
        const parts = text.split('.');
        const decoded = parts.map(p => {
          try {
            return JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/')));
          } catch (_) {
            return p;
          }
        });
        return decoded;
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  decodeURL(text) {
    try {
      return decodeURIComponent(text);
    } catch (_) {
      return null;
    }
  }

  // ============================================================
  // CLASSIFICATION
  // ============================================================
  
  classify(core) {
    const classification = {
      primary: 'unknown',
      secondary: [],
      confidence: 0,
      category: 'unknown'
    };
    
    // Check against all formats
    for (const [type, format] of Object.entries(this.formats)) {
      if (core.type === type) {
        classification.primary = format.name;
        classification.category = format.category;
        classification.confidence = format.confidence;
        break;
      }
    }
    
    // Secondary classifications
    if (core.pattern === 'hex' || core.pattern === 'base64') {
      classification.secondary.push('encoded');
    }
    
    if (core.entropy > 4.5) {
      classification.secondary.push('high_entropy');
    }
    
    if (core.length > 100) {
      classification.secondary.push('large_payload');
    }
    
    if (core.metadata?.hasSymbols) {
      classification.secondary.push('contains_symbols');
    }
    
    return classification;
  }

  // ============================================================
  // ITEM GUESSING
  // ============================================================
  
  guessItem(core) {
    const { type, pattern, length, entropy, raw, classification } = core;

    const item = {
      category: "unknown",
      label: "Unknown item",
      confidence: 0.3,
      notes: [],
      risk: 'low',
      suggestedAction: 'analyze'
    };

    // Crypto addresses
    if (type === "bitcoin" || type === "ethereum" || type === "ripple" || type === "monero") {
      item.category = "crypto";
      item.label = this.formats[type]?.name || "Crypto address";
      item.confidence = 0.95;
      item.risk = 'medium';
      item.suggestedAction = 'verify';
      item.notes.push('Public address - never share private keys');
      return item;
    }

    // QTUM
    if (type === "qtum" || raw.startsWith("QTUM_")) {
      item.category = "crypto";
      item.label = "QTUM Signal";
      item.confidence = 0.9;
      item.risk = 'medium';
      item.suggestedAction = 'process';
      return item;
    }

    // DDN encrypted
    if (type === "ddnEncrypted" || /DDN_ENC::/.test(raw)) {
      item.category = "encrypted";
      item.label = "DDN Encrypted Payload";
      item.confidence = 0.85;
      item.risk = 'high';
      item.suggestedAction = 'decrypt';
      item.notes.push('Multi-layer DDN encryption detected');
      return item;
    }

    // URLs
    if (pattern === "url") {
      item.category = "link";
      item.label = "Web Resource";
      item.confidence = 0.95;
      item.risk = 'medium';
      item.suggestedAction = 'navigate';
      try {
        const url = new URL(raw);
        item.notes.push(`Domain: ${url.hostname}`);
      } catch (_) {}
      return item;
    }

    // Email
    if (pattern === "email") {
      item.category = "contact";
      item.label = "Email Address";
      item.confidence = 0.95;
      item.risk = 'low';
      item.suggestedAction = 'contact';
      return item;
    }

    // JWT
    if (type === "jwt") {
      item.category = "auth";
      item.label = "JWT Token";
      item.confidence = 0.9;
      item.risk = 'high';
      item.suggestedAction = 'validate';
      item.notes.push('Authentication token - handle securely');
      return item;
    }

    // Barcodes
    if (["ean13", "ean8", "upc"].includes(type)) {
      item.category = "product";
      item.label = this.formats[type]?.name || "Barcode";
      item.confidence = 0.95;
      item.risk = 'low';
      item.suggestedAction = 'lookup';
      return item;
    }

    // 2D Codes
    if (["qr", "aztec", "datamatrix", "pdf417"].includes(type)) {
      item.category = "code";
      item.label = this.formats[type]?.name || "2D Code";
      item.confidence = 0.9;
      item.risk = 'low';
      item.suggestedAction = 'decode';
      return item;
    }

    // High entropy strings
    if (entropy > 4.5 && length >= 24) {
      item.category = "secret";
      item.label = "Key/Token/Hash";
      item.confidence = 0.75;
      item.risk = 'high';
      item.suggestedAction = 'verify';
      item.notes.push('High entropy suggests cryptographic material');
      return item;
    }

    // JSON/Structured data
    if (pattern === "json" || pattern === "xml") {
      item.category = "data";
      item.label = pattern.toUpperCase() + " Data";
      item.confidence = 0.9;
      item.risk = 'low';
      item.suggestedAction = 'parse';
      return item;
    }

    // Morse code
    if (type === "morse") {
      item.category = "encoding";
      item.label = "Morse Code";
      item.confidence = 0.85;
      item.risk = 'low';
      item.suggestedAction = 'decode';
      return item;
    }

    return item;
  }

  // ============================================================
  // Q-NOTES GENERATION
  // ============================================================
  
  generateQNotes(core) {
    const notes = [];
    
    notes.push(`📊 Signal Analysis Complete`);
    notes.push(`📝 Type: ${core.type || 'unknown'}`);
    notes.push(`📏 Length: ${core.length}, Entropy: ${core.entropy}`);
    
    if (core.classification) {
      notes.push(`🏷️ Classification: ${core.classification.primary}`);
      if (core.classification.secondary.length) {
        notes.push(`🔍 Features: ${core.classification.secondary.join(', ')}`);
      }
    }
    
    if (core.item) {
      notes.push(`🎯 Best Guess: ${core.item.label}`);
      notes.push(`📂 Category: ${core.item.category}`);
      notes.push(`⚠️ Risk Level: ${core.item.risk}`);
      notes.push(`💡 Action: ${core.item.suggestedAction}`);
      if (core.item.notes.length) {
        notes.push(`📌 Notes: ${core.item.notes.join('; ')}`);
      }
    }
    
    // Decoding successes
    if (core.decoded?.successes?.length) {
      const decoders = core.decoded.successes.map(d => d.decoder).join(', ');
      notes.push(`✅ Decoders: ${decoders}`);
    }
    
    // Security hints
    if (core.security) {
      if (core.security.issues?.length) {
        notes.push(`⚠️ Security Issues: ${core.security.issues.join(', ')}`);
      }
      notes.push(`🛡️ Security Score: ${core.security.score}/100`);
    }
    
    // Special reactions
    if (core.type === 'aztec' || /AZTEC/i.test(core.raw)) {
      notes.push('🔮 Aztec detected → SHeesh!');
    }
    
    if (/DDN_ENC::/.test(core.raw)) {
      notes.push('🌐 DDN encryption detected → Dynamic Data Network!');
    }
    
    if (/^[.\-\/]/.test(core.raw) && /[.\-]/.test(core.raw)) {
      notes.push('📡 Morse transmission received!');
    }
    
    if (core.entropy > 4.5) {
      notes.push('🔥 High entropy → JEEEZ!');
    }
    
    if (core.length > 100) {
      notes.push('📦 Large payload detected');
    }
    
    return notes;
  }

  // ============================================================
  // SECURITY ASSESSMENT
  // ============================================================
  
  securityAssessment(core) {
    const issues = [];
    let score = 100;
    
    // Check for sensitive patterns
    const sensitive = [
      /password/i, /secret/i, /key/i, /token/i, /auth/i,
      /private/i, /confidential/i, /classified/i
    ];
    
    for (const pattern of sensitive) {
      if (pattern.test(core.raw)) {
        issues.push('Contains sensitive keywords');
        score -= 20;
        break;
      }
    }
    
    // Check for encrypted data
    if (/DDN_ENC::/.test(core.raw) || /ENC::/.test(core.raw)) {
      issues.push('Contains encrypted data');
      score -= 10;
    }
    
    // Check for high entropy (could be encrypted)
    if (core.entropy > 5.5) {
      issues.push('Very high entropy - may be encrypted');
      score -= 15;
    }
    
    // Check for base64/hex (could be encoded data)
    if (core.pattern === 'base64' || core.pattern === 'hex') {
      issues.push('Encoded data detected');
      score -= 5;
    }
    
    // Check for URLs
    if (core.pattern === 'url') {
      try {
        const url = new URL(core.raw);
        if (url.protocol === 'http:' && !url.hostname.includes('localhost')) {
          issues.push('Insecure HTTP URL');
          score -= 15;
        }
        if (url.hostname.includes('bit.ly') || url.hostname.includes('tinyurl')) {
          issues.push('URL shortener detected');
          score -= 10;
        }
      } catch (_) {}
    }
    
    // Check for JWT
    if (core.type === 'jwt') {
      issues.push('JWT token detected - handle carefully');
      score -= 20;
    }
    
    // Check for crypto addresses
    if (['bitcoin', 'ethereum', 'ripple', 'monero'].includes(core.type)) {
      issues.push('Crypto address detected');
      score -= 10;
    }
    
    // Validate score bounds
    score = Math.max(0, Math.min(100, score));
    
    let level = 'low';
    if (score < 40) level = 'critical';
    else if (score < 60) level = 'high';
    else if (score < 75) level = 'medium';
    
    return {
      score,
      level,
      issues: issues.length ? issues : ['No security concerns detected'],
      recommendations: this.generateRecommendations(issues, core)
    };
  }

  generateRecommendations(issues, core) {
    const recs = [];
    
    if (issues.includes('Contains encrypted data')) {
      recs.push('Decrypt the data using appropriate method before processing');
    }
    
    if (issues.includes('Crypto address detected')) {
      recs.push('Verify the address format and validity');
    }
    
    if (issues.includes('JWT token detected')) {
      recs.push('Validate JWT signature and expiration');
    }
    
    if (issues.includes('Insecure HTTP URL')) {
      recs.push('Consider using HTTPS if this is a production environment');
    }
    
    if (issues.includes('Contains sensitive keywords')) {
      recs.push('Handle this data with extreme care - never log or expose');
    }
    
    if (core.pattern === 'json') {
      recs.push('Validate JSON structure and sanitize before using');
    }
    
    return recs.length ? recs : ['Standard processing is safe'];
  }

  // ============================================================
  // OFFLINE EXPLANATION
  // ============================================================
  
  explainOffline(core, item) {
    const parts = [];

    parts.push(`📊 Signal Analysis`);
    parts.push(`━━━━━━━━━━━━━━━━━━━━━━━`);
    parts.push(`📝 Type: ${core.type || "unknown"}`);
    parts.push(`📏 Length: ${core.length}, Entropy: ${core.entropy}`);
    parts.push(`🎯 Classification: ${item.label || 'Unknown'}`);
    parts.push(`📂 Category: ${item.category}`);
    parts.push(`✅ Confidence: ${(item.confidence * 100).toFixed(0)}%`);
    parts.push(`⚠️ Risk: ${item.risk}`);
    
    if (core.hints.length) {
      parts.push(`💡 Hints: ${core.hints.join('; ')}`);
    }
    
    if (core.checksum) {
      parts.push(`🔐 Checksum: ${core.checksum.provided} (${core.checksum.valid ? '✅' : '❌'})`);
    }
    
    if (core.decoded?.successes?.length) {
      const decoderList = core.decoded.successes.map(d => d.decoder).join(', ');
      parts.push(`🔓 Decoders: ${decoderList}`);
      
      // Show first decoded result
      const first = core.decoded.successes[0];
      if (first && first.result) {
        const preview = typeof first.result === 'string' ? 
          first.result.slice(0, 100) : 
          JSON.stringify(first.result).slice(0, 100);
        parts.push(`📄 Decoded Preview: ${preview}${first.result.length > 100 ? '...' : ''}`);
      }
    }
    
    if (core.metadata?.charDistribution) {
      const topChars = core.metadata.charDistribution.slice(0, 3)
        .map(({char, percentage}) => `"${char}" ${percentage}%`)
        .join(', ');
      parts.push(`📊 Top Characters: ${topChars}`);
    }
    
    // Security recommendation
    if (core.security) {
      parts.push(`🛡️ Security Score: ${core.security.score}/100 (${core.security.level})`);
      if (core.security.issues.length) {
        parts.push(`⚠️ Issues: ${core.security.issues.join('; ')}`);
      }
      if (core.security.recommendations.length) {
        parts.push(`💡 Recommendations: ${core.security.recommendations.join('; ')}`);
      }
    }
    
    parts.push(`━━━━━━━━━━━━━━━━━━━━━━━`);
    parts.push(`🔍 Generated by QAI v${this.version}`);
    
    return parts.join('\n');
  }

  // ============================================================
  // EXTRACT METADATA
  // ============================================================
  
  extractMetadata(type, text) {
    const metadata = {};
    
    switch(type) {
      case 'url':
        try {
          const url = new URL(text);
          metadata.domain = url.hostname;
          metadata.protocol = url.protocol;
          metadata.path = url.pathname;
          if (url.searchParams.size) {
            metadata.params = Object.fromEntries(url.searchParams);
          }
        } catch (_) {}
        break;
        
      case 'email':
        const parts = text.split('@');
        metadata.username = parts[0];
        metadata.domain = parts[1] || '';
        break;
        
      case 'jwt':
        try {
          const payload = JSON.parse(atob(text.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
          metadata.issuer = payload.iss;
          metadata.subject = payload.sub;
          metadata.expires = payload.exp ? new Date(payload.exp * 1000).toISOString() : null;
        } catch (_) {}
        break;
        
      case 'bitcoin':
      case 'ethereum':
        metadata.addressType = type;
        metadata.length = text.length;
        break;
    }
    
    return metadata;
  }

  // ============================================================
  // FUZZY MATCHING
  // ============================================================
  
  fuzzyMatch(text) {
    const clean = text.replace(/[^A-Z0-9]/gi, "");
    const len = clean.length;

    if (len === 13 && /^[0-9]+$/.test(clean)) return { type: "ean13", confidence: 0.8 };
    if (len === 12 && /^[0-9]+$/.test(clean)) return { type: "upc", confidence: 0.8 };
    if (len === 8 && /^[0-9]+$/.test(clean)) return { type: "ean8", confidence: 0.8 };

    if (len >= 20 && len <= 40) return { type: "qr", confidence: 0.65 };
    if (len >= 26 && len <= 35 && /^[13][A-Za-z0-9]+$/.test(clean)) return { type: "bitcoin", confidence: 0.75 };
    if (len === 42 && /^0x[A-Fa-f0-9]+$/.test(clean)) return { type: "ethereum", confidence: 0.8 };
    
    // Aztec-like pattern detection
    if (clean.length > 30 && /^[A-Z0-9]+$/.test(clean) && this.calcEntropy(clean) > 4.0) {
      return { type: "aztec", confidence: 0.6 };
    }

    return null;
  }

  // ============================================================
  // PATTERN DETECTION
  // ============================================================
  
  detectPattern(text) {
    const patterns = {
      email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      url: /^(https?:\/\/)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
      hex: /^[0-9a-fA-F]{32,64}$/,
      base64: /^[A-Za-z0-9+/=]{20,}$/,
      json: /^\s*\{[\s\S]*\}\s*$/,
      xml: /^\s*<[\s\S]*>[\s\S]*<\/[\s\S]*>\s*$/,
      query: /^[A-Za-z0-9_\-]+=[^&]+(&[A-Za-z0-9_\-]+=[^&]+)*$/,
      jwt: /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/,
      uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      coordinates: /^[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?),\s*[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)$/
    };

    for (const [type, pattern] of Object.entries(patterns)) {
      if (pattern.test(text)) return type;
    }
    
    // Morse code detection
    if (/^[.\-/\s]+$/.test(text) && /[.\-]/.test(text)) {
      return 'morse';
    }
    
    // DDN detection
    if (/DDN_ENC::/.test(text)) {
      return 'ddn';
    }
    
    return null;
  }

  // ============================================================
  // ENTROPY CALCULATION
  // ============================================================
  
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

  // ============================================================
  // CHECKSUM CALCULATION
  // ============================================================
  
  calcChecksum(text) {
    let sum = 0;
    const digits = text.split('').map(Number);
    const provided = digits.pop();
    
    for (let i = 0; i < digits.length; i++) {
      const factor = i % 2 === 0 ? 3 : 1;
      sum += digits[i] * factor;
    }
    
    const calculated = (10 - (sum % 10)) % 10;
    
    return {
      provided,
      calculated,
      valid: provided === calculated,
      algorithm: 'EAN/UPC'
    };
  }

  // ============================================================
  // CACHE MANAGEMENT
  // ============================================================
  
  getCacheKey(text) {
    const prefix = text.slice(0, 50);
    const hash = this.calcEntropy(text).toString(36);
    return `${prefix}_${hash}`.slice(0, 80);
  }

  trimCache() {
    if (this.cache.size > this.config.cacheSize) {
      const entries = Array.from(this.cache.entries());
      const remove = entries.slice(0, Math.floor(this.cache.size * 0.3));
      remove.forEach(([key]) => this.cache.delete(key));
    }
  }

  clearCache() {
    this.cache.clear();
    this.emit("cache_cleared", { size: 0 });
  }

  // ============================================================
  // STATISTICS
  // ============================================================
  
  getStats() {
    return {
      version: this.version,
      ready: this._ready,
      cacheSize: this.cache.size,
      maxCacheSize: this.config.cacheSize,
      decoders: Object.keys(this.decoders),
      patterns: Object.keys(this.patterns),
      formats: Object.keys(this.formats)
    };
  }

  // ============================================================
  // BATCH PROCESSING
  // ============================================================
  
  async batchProcess(texts, options = {}) {
    const results = [];
    const concurrency = options.concurrency || 5;
    
    for (let i = 0; i < texts.length; i += concurrency) {
      const batch = texts.slice(i, i + concurrency);
      const promises = batch.map(text => this.process(text, options));
      const batchResults = await Promise.allSettled(promises);
      
      batchResults.forEach((result, index) => {
        results.push({
          index: i + index,
          text: batch[index],
          result: result.status === 'fulfilled' ? result.value : null,
          error: result.status === 'rejected' ? result.reason : null
        });
      });
    }
    
    return results;
  }
}

// ============================================================
// EXPORT
// ============================================================

if (typeof window !== 'undefined') {
  window.Qai = Qai;
  
  // Auto-initialize if window already loaded
  if (document.readyState === 'complete') {
    window.qai = new Qai();
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      window.qai = new Qai();
    });
  }
}

// Also support CommonJS/Node
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Qai;
}