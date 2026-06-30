/**
 * QAI v3.0 - Total Barcode Domination Engine
 * Rich Barcode Analysis with 8-Point Intelligence
 */

class Qai {
  constructor(config = {}) {
    // === VERSION & IDENTITY ===
    this.version = '3.0';
    this.codename = 'Barcode Dominator';
    this.build = '2026.06.29';
    
    // === CORE STATE ===
    this.isReady = false;
    this.isInitialized = false;
    this.eventBus = new EventTarget();
    this.cache = new Map();
    this.barcodeHistory = [];
    
    // === CONFIGURATION ===
    this.config = {
      maxCacheSize: 1000,
      enablePatternRecognition: true,
      enableBarcodeCorrection: true,
      enableRichAnalysis: true,
      ...config
    };
    
    // === BARCODE PATTERNS ===
    this.barcodePatterns = {
      // Standard barcodes
      ean13: /^[0-9]{13}$/,
      ean8: /^[0-9]{8}$/,
      upc: /^[0-9]{12}$/,
      code128: /^[A-Z0-9\-_]+$/,
      code39: /^[A-Z0-9\-\.\s]+$/,
      code93: /^[A-Z0-9\-\.\s\*]+$/,
      codabar: /^[A-D][0-9\-]+[A-D]$/,
      interleaved25: /^[0-9]{2,}$/,
      
      // 2D barcodes
      qr: /^[A-Z0-9+\/=\s]+$/,
      datamatrix: /^[A-Z0-9!@#$%^&*()]+$/,
      pdf417: /^[A-Z0-9\-_+\/\s]+$/,
      aztec: /^[A-Z0-9+\/\s]+$/,
      
      // Custom patterns
      qtum: /^QTUM_[A-Z0-9]{16}$/,
      quantum: /^Q[A-Z0-9]{32}$/,
      signal: /^SIG_[0-9]{10}_[A-Z]{6}$/,
      
      // Crypto addresses
      bitcoin: /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/,
      ethereum: /^0x[a-fA-F0-9]{40}$/,
      
      // Common patterns
      email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      url: /^(https?:\/\/)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}([/?].*)?$/,
      phone: /^\+?[0-9]{10,15}$/,
      hex: /^[0-9a-fA-F]{32,64}$/,
      base64: /^[A-Za-z0-9+/=]+$/
    };
    
    // === BARCODE FORMAT INFO ===
    this.barcodeFormats = {
      ean13: { name: 'EAN-13', type: 'Linear', digits: 13, checksum: true },
      ean8: { name: 'EAN-8', type: 'Linear', digits: 8, checksum: true },
      upc: { name: 'UPC-A', type: 'Linear', digits: 12, checksum: true },
      code128: { name: 'Code 128', type: 'Linear', digits: 'Variable', checksum: true },
      code39: { name: 'Code 39', type: 'Linear', digits: 'Variable', checksum: false },
      code93: { name: 'Code 93', type: 'Linear', digits: 'Variable', checksum: true },
      codabar: { name: 'Codabar', type: 'Linear', digits: 'Variable', checksum: false },
      interleaved25: { name: 'Interleaved 2 of 5', type: 'Linear', digits: 'Even', checksum: true },
      qr: { name: 'QR Code', type: '2D', digits: 'Variable', checksum: true },
      datamatrix: { name: 'Data Matrix', type: '2D', digits: 'Variable', checksum: true },
      pdf417: { name: 'PDF417', type: '2D', digits: 'Variable', checksum: true },
      aztec: { name: 'Aztec Code', type: '2D', digits: 'Variable', checksum: true },
      qtum: { name: 'QTUM Protocol', type: 'Custom', digits: 20, checksum: false },
      quantum: { name: 'Quantum ID', type: 'Custom', digits: 33, checksum: false },
      signal: { name: 'Signal Protocol', type: 'Custom', digits: 'Variable', checksum: false },
      bitcoin: { name: 'Bitcoin Address', type: 'Crypto', digits: '26-35', checksum: true },
      ethereum: { name: 'Ethereum Address', type: 'Crypto', digits: 42, checksum: true },
      email: { name: 'Email Address', type: 'Pattern', digits: 'Variable', checksum: false },
      url: { name: 'URL', type: 'Pattern', digits: 'Variable', checksum: false },
      phone: { name: 'Phone Number', type: 'Pattern', digits: '10-15', checksum: false },
      hex: { name: 'Hexadecimal', type: 'Pattern', digits: '32-64', checksum: false },
      base64: { name: 'Base64', type: 'Pattern', digits: 'Variable', checksum: false }
    };
    
    // === MODELS ===
    this.models = {
      classifier: null,
      embedder: null,
      sentiment: null,
      barcodeAnalyzer: null
    };
    
    this.features = {
      embeddings: false,
      sentiment: false,
      barcodeAnalysis: true,
      patternDetection: true
    };
    
    // === METRICS ===
    this.metrics = {
      processedCount: 0,
      averageTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
      barcodeTypes: {}
    };
    
    // Initialize
    this.initialize();
  }

  // ========== INITIALIZATION ==========
  async initialize() {
    try {
      // Quick initialization
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Initialize barcode analyzer
      this.models.barcodeAnalyzer = {
        analyze: (text) => this.analyzeBarcode(text),
        validate: (text) => this.validateBarcode(text),
        correct: (text) => this.correctBarcode(text),
        getFormat: (type) => this.barcodeFormats[type] || null
      };
      
      this.isReady = true;
      this.isInitialized = true;
      
      this.emit('ready', {
        version: this.version,
        features: this.features,
        timestamp: Date.now()
      });
      
      console.log(`🧠 QAI v${this.version} "${this.codename}" ready`);
      
    } catch (error) {
      console.error('QAI initialization failed:', error);
      this.isReady = false;
      this.emit('error', { error: error.message });
    }
  }

  // ========== MAIN PROCESS METHOD ==========
  async process(text) {
    if (!text) throw new Error('No input provided');

    // Check cache
    const cacheKey = text.slice(0, 100);
    if (this.cache.has(cacheKey)) {
      this.metrics.cacheHits++;
      return this.cache.get(cacheKey);
    }
    this.metrics.cacheMisses++;

    const startTime = performance.now();

    try {
      // === RICH ANALYSIS ===
      const analysis = {
        original: text,
        timestamp: Date.now(),
        confidence: 0.85,
        // 8 pieces of barcode info
        barcode: null,
        pattern: null,
        format: null,
        validation: null,
        checksum: null,
        correction: null,
        moderation: null,
        metadata: null
      };

      // 1. BARCODE ANALYSIS
      const barcodeResult = this.analyzeBarcode(text);
      if (barcodeResult) {
        analysis.barcode = barcodeResult;
        analysis.confidence = barcodeResult.confidence || 0.85;
        
        // 2. FORMAT INFO
        if (barcodeResult.type) {
          analysis.format = this.barcodeFormats[barcodeResult.type] || null;
        }
        
        // 3. VALIDATION
        analysis.validation = {
          valid: barcodeResult.valid || false,
          type: barcodeResult.type || 'Unknown',
          confidence: barcodeResult.confidence || 0
        };
        
        // 4. CHECKSUM
        if (barcodeResult.checksum) {
          analysis.checksum = barcodeResult.checksum;
        }
        
        // Track barcode type metrics
        if (barcodeResult.type) {
          this.metrics.barcodeTypes[barcodeResult.type] = 
            (this.metrics.barcodeTypes[barcodeResult.type] || 0) + 1;
        }
      }

      // 5. PATTERN DETECTION
      const patternResult = this.detectPatterns(text);
      if (patternResult && patternResult.matched) {
        analysis.pattern = patternResult;
      }

      // 6. CORRECTION
      if (this.config.enableBarcodeCorrection) {
        analysis.correction = this.correctBarcode(text);
      }

      // 7. MODERATION
      analysis.moderation = this.moderateContent(text, analysis);

      // 8. METADATA
      analysis.metadata = {
        length: text.length,
        hasNumbers: /\d/.test(text),
        hasLetters: /[a-zA-Z]/.test(text),
        hasSpecial: /[^a-zA-Z0-9]/.test(text),
        entropy: this.calculateEntropy(text),
        processedAt: new Date().toISOString()
      };

      // Determine tag
      let tag = 'SCAN';
      if (analysis.barcode?.valid) tag = 'BARCODE';
      else if (analysis.pattern?.matched) tag = 'PATTERN';
      if (!analysis.moderation.allow) tag = 'FLAGGED';

      analysis.tag = tag;

      // Cache result
      this.cache.set(cacheKey, analysis);
      this.trimCache();

      // Update metrics
      this.metrics.processedCount++;
      this.metrics.averageTime = 
        (this.metrics.averageTime * (this.metrics.processedCount - 1) + 
         (performance.now() - startTime)) / this.metrics.processedCount;

      // Store history
      this.barcodeHistory.push({ text, analysis, timestamp: Date.now() });
      if (this.barcodeHistory.length > 100) {
        this.barcodeHistory.shift();
      }

      return analysis;

    } catch (error) {
      console.error('Processing error:', error);
      this.metrics.errors++;
      
      // Emergency fallback
      return this.emergencyFallback(text);
    }
  }

  // ========== BARCODE ANALYSIS ==========
  analyzeBarcode(text) {
    if (!text) return null;

    const results = {
      text: text,
      type: null,
      valid: false,
      confidence: 0,
      checksum: null,
      format: null
    };

    // Clean text for analysis
    const cleanText = text.trim();
    
    // Check against all patterns
    for (const [type, pattern] of Object.entries(this.barcodePatterns)) {
      if (pattern.test(cleanText)) {
        results.type = type;
        results.valid = true;
        results.confidence = 0.95;
        results.format = this.barcodeFormats[type] || null;
        
        // Calculate checksum for supported types
        if (this.barcodeFormats[type]?.checksum) {
          results.checksum = this.calculateChecksum(cleanText, type);
        }
        break;
      }
    }

    // Fuzzy matching fallback
    if (!results.valid && this.config.enablePatternRecognition) {
      const fuzzyMatch = this.fuzzyBarcodeMatch(cleanText);
      if (fuzzyMatch) {
        results.type = fuzzyMatch.type;
        results.valid = true;
        results.confidence = fuzzyMatch.confidence;
        results.format = this.barcodeFormats[fuzzyMatch.type] || null;
      }
    }

    return results;
  }

  fuzzyBarcodeMatch(text) {
    const cleaned = text.replace(/[^A-Z0-9]/gi, '');
    if (!cleaned) return null;

    // Length-based guessing
    const length = cleaned.length;
    if (length === 13 && /^[0-9]+$/.test(cleaned)) {
      return { type: 'ean13', confidence: 0.85 };
    }
    if (length === 12 && /^[0-9]+$/.test(cleaned)) {
      return { type: 'upc', confidence: 0.85 };
    }
    if (length === 8 && /^[0-9]+$/.test(cleaned)) {
      return { type: 'ean8', confidence: 0.85 };
    }
    if (length >= 20 && length <= 40 && /^[A-Z0-9+/=]+$/.test(cleaned)) {
      return { type: 'qr', confidence: 0.7 };
    }
    if (length >= 26 && length <= 35 && /^[13][A-Za-z0-9]+$/.test(cleaned)) {
      return { type: 'bitcoin', confidence: 0.8 };
    }
    if (length === 42 && /^0x[A-Fa-f0-9]+$/.test(cleaned)) {
      return { type: 'ethereum', confidence: 0.85 };
    }
    if (length >= 10 && length <= 15 && /^\+?[0-9]+$/.test(cleaned)) {
      return { type: 'phone', confidence: 0.7 };
    }

    return null;
  }

  validateBarcode(text) {
    const analysis = this.analyzeBarcode(text);
    return analysis?.valid || false;
  }

  // ========== CHECKSUM CALCULATION ==========
  calculateChecksum(text, type) {
    if (!text || !type) return null;

    const digits = text.replace(/\D/g, '').split('').map(Number);
    if (digits.length < 2) return null;

    let sum = 0;
    let alternator = 1;
    
    // EAN/UPC checksum (alternating 3 and 1)
    for (let i = digits.length - 2; i >= 0; i--) {
      sum += digits[i] * (alternator === 1 ? 3 : 1);
      alternator = alternator === 1 ? 0 : 1;
    }
    
    const checkDigit = (10 - (sum % 10)) % 10;
    const provided = digits[digits.length - 1];
    
    return {
      calculated: checkDigit,
      provided: provided,
      valid: provided === checkDigit,
      algorithm: 'EAN/UPC'
    };
  }

  // ========== PATTERN DETECTION ==========
  detectPatterns(text) {
    if (!text) return null;

    const detected = [];
    
    for (const [type, pattern] of Object.entries(this.barcodePatterns)) {
      if (pattern.test(text)) {
        detected.push({ 
          type, 
          format: this.barcodeFormats[type] || null,
          confidence: type === 'email' ? 0.95 : 
                     type === 'url' ? 0.9 : 
                     type === 'bitcoin' ? 0.95 : 0.8
        });
      }
    }

    return {
      text: text,
      matched: detected.length > 0,
      patterns: detected,
      type: detected[0]?.type || null,
      count: detected.length
    };
  }

  // ========== CORRECTION ==========
  correctBarcode(text) {
    if (!text) return null;
    
    let corrected = text.trim();
    const changes = [];
    
    // Remove whitespace
    if (corrected !== text) {
      changes.push('trimmed');
    }
    
    // Remove invalid characters
    const clean = corrected.replace(/[^A-Z0-9\-_+\/=]/gi, '');
    if (clean !== corrected) {
      changes.push('cleaned');
      corrected = clean;
    }
    
    // Normalize case
    const upper = corrected.toUpperCase();
    if (upper !== corrected) {
      changes.push('uppercase');
      corrected = upper;
    }
    
    // Auto-pad EAN/UPC
    if (/^[0-9]+$/.test(corrected)) {
      if (corrected.length === 12) {
        // Try to add checksum
        const checksum = this.calculateChecksum(corrected, 'upc');
        if (checksum) {
          corrected = corrected + checksum.calculated;
          changes.push('added_checksum');
        }
      } else if (corrected.length === 7) {
        const checksum = this.calculateChecksum(corrected, 'ean8');
        if (checksum) {
          corrected = corrected + checksum.calculated;
          changes.push('added_checksum');
        }
      }
    }
    
    return {
      original: text,
      corrected: corrected,
      changes: changes,
      changed: changes.length > 0,
      confidence: changes.length === 0 ? 1.0 : 0.85
    };
  }

  // ========== MODERATION ==========
  moderateContent(text, analysis) {
    const flags = [];
    let allow = true;
    let severity = 'low';

    // Check for suspicious content
    const suspicious = ['malicious', 'exploit', 'hack', 'illegal', 'prohibited'];
    const lowerText = text.toLowerCase();
    if (suspicious.some(s => lowerText.includes(s))) {
      flags.push('suspicious_content');
      severity = 'high';
    }

    // Check barcode validity
    if (analysis.barcode && !analysis.barcode.valid) {
      flags.push('invalid_barcode');
      if (severity === 'low') severity = 'medium';
    }

    // Check length
    if (text.length > 500) {
      flags.push('lengthy');
    }

    // Check for test patterns
    if (lowerText.includes('test') || lowerText.includes('demo')) {
      flags.push('test');
    }

    // Determine if allowed
    allow = flags.length === 0 || flags.every(f => ['test', 'lengthy'].includes(f));

    // Calculate severity
    if (flags.some(f => ['suspicious_content', 'malicious'].includes(f))) {
      severity = 'high';
    } else if (flags.some(f => ['invalid_barcode', 'negative_sentiment'].includes(f))) {
      severity = 'medium';
    }

    return {
      allow: allow,
      verdict: allow ? 'clean' : 'flagged',
      flags: flags,
      severity: severity,
      timestamp: Date.now()
    };
  }

  // ========== ENTROPY CALCULATION ==========
  calculateEntropy(text) {
    if (!text) return 0;
    
    const freq = {};
    for (const char of text) {
      freq[char] = (freq[char] || 0) + 1;
    }
    
    let entropy = 0;
    const len = text.length;
    for (const char in freq) {
      const p = freq[char] / len;
      entropy -= p * Math.log2(p);
    }
    
    return parseFloat(entropy.toFixed(4));
  }

  // ========== COMPATIBILITY METHODS ==========
  isReady() {
    return this.isReady;
  }

  clearCache() {
    this.cache.clear();
    console.log('🧹 QAI cache cleared');
    this.emit('cache-cleared', { timestamp: Date.now() });
  }

  // ========== UTILITY ==========
  trimCache() {
    if (this.cache.size > this.config.maxCacheSize) {
      const entries = Array.from(this.cache.entries());
      const toDelete = entries.slice(0, Math.floor(entries.length * 0.2));
      toDelete.forEach(([key]) => this.cache.delete(key));
    }
  }

  getStats() {
    return {
      version: this.version,
      processed: this.metrics.processedCount,
      cacheSize: this.cache.size,
      cacheHitRate: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) || 0,
      errors: this.metrics.errors,
      averageTime: this.metrics.averageTime.toFixed(2) + 'ms',
      barcodeTypes: this.metrics.barcodeTypes,
      isReady: this.isReady
    };
  }

  getBarcodeHistory() {
    return this.barcodeHistory;
  }

  // ========== EMERGENCY FALLBACK ==========
  emergencyFallback(text) {
    return {
      original: text,
      timestamp: Date.now(),
      barcode: null,
      pattern: null,
      format: null,
      validation: { valid: false, type: 'Unknown', confidence: 0 },
      checksum: null,
      correction: null,
      moderation: {
        allow: true,
        verdict: 'clean',
        flags: ['fallback'],
        severity: 'low',
        timestamp: Date.now()
      },
      metadata: {
        length: text.length,
        hasNumbers: /\d/.test(text),
        hasLetters: /[a-zA-Z]/.test(text),
        hasSpecial: /[^a-zA-Z0-9]/.test(text),
        entropy: this.calculateEntropy(text),
        processedAt: new Date().toISOString(),
        fallback: true
      },
      confidence: 0.3,
      tag: 'FALLBACK',
      fallback: true
    };
  }

  // ========== EVENT SYSTEM ==========
  emit(event, detail) {
    this.eventBus.dispatchEvent(new CustomEvent(event, { detail }));
  }

  addEventListener(event, callback) {
    this.eventBus.addEventListener(event, callback);
  }

  removeEventListener(event, callback) {
    this.eventBus.removeEventListener(event, callback);
  }

  // ========== DESTROY ==========
  destroy() {
    this.cache.clear();
    this.barcodeHistory = [];
    this.isReady = false;
    this.isInitialized = false;
    console.log(`💀 QAI v${this.version} destroyed`);
    this.emit('destroyed', { timestamp: Date.now() });
  }
}

// Export for use
window.Qai = Qai;

// Also export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Qai;
}
