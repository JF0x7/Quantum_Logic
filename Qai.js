/**
 * QAI v3.0 - Total Barcode Domination Engine
 * Fully Compatible with QtumScanner v2.0
 */

class Qai {
  constructor(config = {}) {
    // === COMPATIBILITY LAYER ===
    // These properties match your existing QAI v0.90
    this.version = '3.0';
    this.isReady = false;
    this.eventBus = new EventTarget();
    this.cache = new Map();
    
    // === NEW FEATURES ===
    this.codename = 'Barcode Dominator';
    this.patternCache = new Map();
    this.barcodeHistory = [];
    this.metrics = {
      processedCount: 0,
      averageTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0
    };
    
    this.config = {
      maxCacheSize: 1000,
      enablePatternRecognition: true,
      enableBarcodeCorrection: true,
      ...config
    };
    
    // === BARCODE PATTERNS ===
    this.barcodePatterns = {
      code128: /^[A-Z0-9\-_]+$/,
      code39: /^[A-Z0-9\-\.\s]+$/,
      ean13: /^[0-9]{13}$/,
      ean8: /^[0-9]{8}$/,
      upc: /^[0-9]{12}$/,
      qr: /^[A-Z0-9+\/=\s]+$/,
      datamatrix: /^[A-Z0-9!@#$%^&*()]+$/,
      qtum: /^QTUM_[A-Z0-9]{16}$/
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
      barcodeAnalysis: true
    };
    
    // Initialize
    this.initialize();
  }

  // ========== INITIALIZATION ==========
  async initialize() {
    try {
      // Quick initialization for immediate use
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Initialize barcode analyzer
      this.models.barcodeAnalyzer = {
        analyze: (text) => this.analyzeBarcode(text),
        validate: (text) => this.validateBarcode(text),
        correct: (text) => this.correctBarcode(text)
      };
      
      this.isReady = true;
      
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

  // ========== MAIN PROCESS METHOD (COMPATIBLE) ==========
  async process(text) {
    if (!text) throw new Error('No input provided');

    // Check cache (compatible with v0.90)
    const cacheKey = text.slice(0, 100);
    if (this.cache.has(cacheKey)) {
      this.metrics.cacheHits++;
      return this.cache.get(cacheKey);
    }
    this.metrics.cacheMisses++;

    try {
      // === Enhanced Analysis ===
      const analysis = {
        original: text,
        timestamp: Date.now(),
        confidence: 0.85
      };

      // Barcode analysis (NEW)
      const barcodeResult = this.analyzeBarcode(text);
      if (barcodeResult && barcodeResult.valid) {
        analysis.barcode = barcodeResult;
        analysis.tag = `BARCODE_${barcodeResult.type.toUpperCase()}`;
      }

      // Pattern detection (NEW)
      const patternResult = this.detectPatterns(text);
      if (patternResult && patternResult.matched) {
        analysis.patterns = patternResult;
        if (!analysis.tag) {
          analysis.tag = `PATTERN_${patternResult.type.toUpperCase()}`;
        }
      }

      // === COMPATIBILITY: moderation object matches v0.90 ===
      analysis.moderation = this.moderateContent(text, analysis);
      
      // === COMPATIBILITY: analyze() method support ===
      analysis.flagged = !analysis.moderation.allow;
      analysis.tags = analysis.moderation.flags || [];

      // Cache result
      this.cache.set(cacheKey, analysis);
      this.trimCache();

      // Update metrics
      this.metrics.processedCount++;

      // Store history
      this.barcodeHistory.push({ text, analysis, timestamp: Date.now() });
      if (this.barcodeHistory.length > 100) {
        this.barcodeHistory.shift();
      }

      return analysis;

    } catch (error) {
      console.error('Processing error:', error);
      this.metrics.errors++;
      
      // === COMPATIBILITY: Return v0.90 style fallback ===
      return {
        original: text,
        moderation: {
          allow: true,
          verdict: 'clean',
          flags: [],
          entropy: text.length / 1000,
          timestamp: Date.now(),
          fallback: true
        },
        timestamp: Date.now(),
        confidence: 0.5,
        flagged: false,
        tags: []
      };
    }
  }

  // ========== COMPATIBILITY: analyze() method ==========
  async analyze(text) {
    const result = await this.process(text);
    return {
      text: text,
      flagged: !result.moderation.allow,
      confidence: result.confidence,
      tags: result.moderation.flags || []
    };
  }

  // ========== COMPATIBILITY: analyzeText() method ==========
  analyzeText(text) {
    const flags = [];
    const lower = text.toLowerCase();

    // Simple analysis (compatible with v0.90)
    if (lower.includes('flag') || lower.includes('malicious')) {
      flags.push('suspicious');
    }
    if (lower.includes('test') || lower.includes('demo')) {
      flags.push('test');
    }
    if (text.length > 200) {
      flags.push('long');
    }

    const allow = flags.length === 0 || flags.every(f => f === 'test');

    return {
      allow: allow,
      verdict: allow ? 'clean' : 'flagged',
      flags: flags,
      entropy: text.length / 1000,
      timestamp: Date.now()
    };
  }

  // ========== BARCODE ANALYSIS (NEW FEATURES) ==========
  analyzeBarcode(text) {
    if (!text) return null;

    const results = {
      text: text,
      type: null,
      valid: false,
      confidence: 0
    };

    // Check against all patterns
    for (const [type, pattern] of Object.entries(this.barcodePatterns)) {
      if (pattern.test(text)) {
        results.type = type;
        results.valid = true;
        results.confidence = 0.95;
        break;
      }
    }

    // Fuzzy matching fallback
    if (!results.valid && this.config.enablePatternRecognition) {
      const cleaned = text.replace(/[^A-Z0-9]/gi, '');
      if (cleaned.length === 13) {
        results.type = 'ean13';
        results.valid = true;
        results.confidence = 0.7;
      } else if (cleaned.length === 12) {
        results.type = 'upc';
        results.valid = true;
        results.confidence = 0.7;
      }
    }

    return results;
  }

  validateBarcode(text) {
    const analysis = this.analyzeBarcode(text);
    return analysis?.valid || false;
  }

  correctBarcode(text) {
    if (!text) return null;
    
    let corrected = text.trim().toUpperCase();
    corrected = corrected.replace(/[^A-Z0-9\-_+\/=]/gi, '');
    
    return {
      original: text,
      corrected: corrected,
      changed: text !== corrected
    };
  }

  // ========== PATTERN DETECTION ==========
  detectPatterns(text) {
    if (!text) return null;
    
    const patterns = {
      email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      url: /^(https?:\/\/)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}([/?].*)?$/,
      phone: /^\+?[0-9]{10,15}$/,
      date: /^\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}$/,
      hex: /^[0-9a-fA-F]{32,64}$/,
      bitcoin: /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/,
      ethereum: /^0x[a-fA-F0-9]{40}$/
    };

    const detected = [];
    for (const [type, pattern] of Object.entries(patterns)) {
      if (pattern.test(text)) {
        detected.push({ type });
      }
    }

    return {
      text: text,
      matched: detected.length > 0,
      patterns: detected,
      type: detected[0]?.type || null
    };
  }

  // ========== MODERATION (ENHANCED) ==========
  moderateContent(text, analysis) {
    // Start with v0.90 compatible analysis
    const baseModeration = this.analyzeText(text);
    
    // Enhanced checks
    const flags = [...baseModeration.flags];
    
    // Check barcode validity
    if (analysis.barcode && !analysis.barcode.valid) {
      flags.push('invalid_barcode');
    }
    
    // Check sentiment
    if (analysis.sentiment?.polarity === 'negative') {
      flags.push('negative_sentiment');
    }
    
    const allow = flags.length === 0 || flags.every(f => ['test', 'lengthy'].includes(f));
    
    return {
      allow: allow,
      verdict: allow ? 'clean' : 'flagged',
      flags: flags,
      entropy: text.length / 1000,
      timestamp: Date.now(),
      severity: flags.length > 1 ? 'high' : flags.length === 1 ? 'medium' : 'low'
    };
  }

  // ========== COMPATIBILITY METHODS ==========
  isReady() {
    return this.isReady;
  }

  clearCache() {
    this.cache.clear();
    this.patternCache.clear();
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
      isReady: this.isReady
    };
  }

  // ========== EVENT SYSTEM (COMPATIBLE) ==========
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

// Export for use
window.Qai = Qai;
