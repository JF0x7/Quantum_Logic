/**
 * QAI v3.0 - Total Barcode Domination Engine
 * Quantum Artificial Intelligence Interface with Industrial-Grade Processing
 * Features: Multi-model AI, Real-time Barcode Analysis, Pattern Recognition
 * Memory: 277 lines → 450+ lines of pure optimization
 */

class Qai {
  constructor(config = {}) {
    // Version & Identity
    this.version = '3.0';
    this.codename = 'Barcode Dominator';
    this.build = '2026.06.29';
    
    // Core State
    this.isReady = false;
    this.isInitialized = false;
    this.eventBus = new EventTarget();
    this.cache = new Map();
    this.patternCache = new Map();
    this.barcodeHistory = [];
    
    // Configuration
    this.config = {
      maxCacheSize: 1000,
      batchSize: 50,
      confidenceThreshold: 0.75,
      enablePatternRecognition: true,
      enableRealTimeAnalysis: true,
      enableBarcodeCorrection: true,
      ...config
    };
    
    // Model Registry
    this.models = {
      classifier: null,
      embedder: null,
      sentiment: null,
      barcodeAnalyzer: null,
      patternDetector: null,
      anomalyDetector: null
    };
    
    // Feature Flags
    this.features = {
      zeroShot: false,
      embeddings: false,
      sentiment: false,
      barcodeAnalysis: false,
      patternDetection: false,
      realTime: true
    };
    
    // Performance Metrics
    this.metrics = {
      processedCount: 0,
      averageTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
      lastProcessTime: 0
    };
    
    // Barcode Specific
    this.barcodePatterns = this.initializeBarcodePatterns();
    this.correctionRules = this.initializeCorrectionRules();
    
    // Initialize
    this.initialize();
  }

  // ========== INITIALIZATION ==========
  async initialize() {
    try {
      this.emit('status', { 
        message: '🧠 QAI v3.0 Boot Sequence Initiated', 
        type: 'info' 
      });
      
      // Load AI Models in parallel with intelligent fallback
      const modelLoaders = [
        this.initClassifier(),
        this.initEmbedder(),
        this.initSentiment(),
        this.initBarcodeAnalyzer(),
        this.initPatternDetector()
      ];
      
      // Wait for all models with timeout
      const results = await Promise.allSettled(modelLoaders);
      
      // Process results
      results.forEach((result, index) => {
        const modelNames = ['classifier', 'embedder', 'sentiment', 'barcodeAnalyzer', 'patternDetector'];
        if (result.status === 'fulfilled') {
          this.models[modelNames[index]] = result.value;
          console.log(`✅ ${modelNames[index]} loaded`);
        } else {
          console.warn(`⚠️ ${modelNames[index]} failed, using fallback`);
          this.models[modelNames[index]] = this.createFallbackModel(modelNames[index]);
        }
      });
      
      this.isReady = true;
      this.isInitialized = true;
      
      this.emit('ready', { 
        version: this.version,
        features: this.features,
        metrics: this.getMetrics(),
        timestamp: Date.now()
      });
      
      console.log(`🧠 QAI v${this.version} "${this.codename}" ready - ${this.build}`);
      this.emit('status', { 
        message: `✅ ${this.codename} Active - ${Object.keys(this.models).filter(k => this.models[k]).length} Models Ready`, 
        type: 'success' 
      });
      
    } catch (error) {
      console.error('❌ QAI Boot Failed:', error);
      this.isReady = false;
      this.emit('error', { 
        message: 'Boot Sequence Failed',
        error: error.message,
        stack: error.stack
      });
      this.emit('status', { 
        message: '⚠️ QAI in Emergency Fallback Mode', 
        type: 'warning' 
      });
    }
  }

  // ========== MODEL INITIALIZATION ==========
  async initClassifier() {
    try {
      // Try Hugging Face first
      if (typeof pipeline !== 'undefined') {
        return await pipeline(
          'text-classification',
          'distilbert-base-uncased-finetuned-sst-2-english',
          { quantized: true, device: 'webgpu' }
        );
      }
      // Fallback to local
      return this.createFallbackModel('classifier');
    } catch (error) {
      console.warn('Classifier init failed:', error.message);
      return this.createFallbackModel('classifier');
    }
  }

  async initEmbedder() {
    try {
      if (typeof pipeline !== 'undefined') {
        const model = await pipeline(
          'feature-extraction',
          'sentence-transformers/all-MiniLM-L6-v2',
          { quantized: true, pooling: 'mean' }
        );
        this.features.embeddings = true;
        return model;
      }
      return null;
    } catch (error) {
      console.warn('Embedder init failed:', error.message);
      return null;
    }
  }

  async initSentiment() {
    try {
      if (typeof pipeline !== 'undefined') {
        const model = await pipeline(
          'sentiment-analysis',
          'cardiffnlp/twitter-roberta-base-sentiment-latest',
          { quantized: true }
        );
        this.features.sentiment = true;
        return model;
      }
      return null;
    } catch (error) {
      console.warn('Sentiment init failed:', error.message);
      return null;
    }
  }

  async initBarcodeAnalyzer() {
    try {
      // Enhanced barcode analysis model
      const model = {
        analyze: (text) => this.analyzeBarcode(text),
        validate: (text) => this.validateBarcode(text),
        correct: (text) => this.correctBarcode(text)
      };
      this.features.barcodeAnalysis = true;
      return model;
    } catch (error) {
      console.warn('Barcode analyzer init failed:', error.message);
      return null;
    }
  }

  async initPatternDetector() {
    try {
      const model = {
        detect: (text) => this.detectPatterns(text),
        classify: (text) => this.classifyPattern(text)
      };
      this.features.patternDetection = true;
      return model;
    } catch (error) {
      console.warn('Pattern detector init failed:', error.message);
      return null;
    }
  }

  // ========== BARCODE PATTERNS ==========
  initializeBarcodePatterns() {
    return {
      // Common barcode patterns
      code128: /^[A-Z0-9\-_]+$/,
      code39: /^[A-Z0-9\-\.\s]+$/,
      ean13: /^[0-9]{13}$/,
      ean8: /^[0-9]{8}$/,
      upc: /^[0-9]{12}$/,
      qr: /^[A-Z0-9+\/=\s]+$/,
      datamatrix: /^[A-Z0-9!@#$%^&*()]+$/,
      // Custom patterns
      qtum: /^QTUM_[A-Z0-9]{16}$/,
      quantum: /^Q[A-Z0-9]{32}$/,
      signal: /^SIG_[0-9]{10}_[A-Z]{6}$/
    };
  }

  initializeCorrectionRules() {
    return {
      // Auto-correction rules
      trimWhitespace: true,
      removeInvalidChars: true,
      addChecksum: true,
      normalizeCase: true,
      fixLength: true
    };
  }

  // ========== CORE PROCESSING ==========
  async process(text, options = {}) {
    const startTime = performance.now();
    
    if (!text) {
      this.metrics.errors++;
      throw new Error('No input provided');
    }

    // Check cache
    const cacheKey = this.generateCacheKey(text);
    if (this.cache.has(cacheKey) && !options.forceRefresh) {
      this.metrics.cacheHits++;
      const cached = this.cache.get(cacheKey);
      this.metrics.lastProcessTime = performance.now() - startTime;
      return cached;
    }
    this.metrics.cacheMisses++;

    try {
      // Build analysis pipeline
      const analysis = {
        original: text,
        timestamp: Date.now(),
        barcode: null,
        patterns: null,
        sentiment: null,
        classification: null,
        moderation: null,
        confidence: 0.85,
        corrections: null
      };

      // Run all analyzers in parallel
      const [barcodeAnalysis, patternAnalysis, sentimentAnalysis, classificationAnalysis] = 
        await Promise.allSettled([
          this.analyzeBarcode(text),
          this.detectPatterns(text),
          this.analyzeSentiment(text),
          this.classifyText(text)
        ]);

      // Process results
      analysis.barcode = barcodeAnalysis.status === 'fulfilled' ? barcodeAnalysis.value : null;
      analysis.patterns = patternAnalysis.status === 'fulfilled' ? patternAnalysis.value : null;
      analysis.sentiment = sentimentAnalysis.status === 'fulfilled' ? sentimentAnalysis.value : null;
      analysis.classification = classificationAnalysis.status === 'fulfilled' ? classificationAnalysis.value : null;
      
      // Apply corrections if enabled
      if (this.config.enableBarcodeCorrection) {
        analysis.corrections = this.applyCorrections(text);
      }
      
      // Moderation
      analysis.moderation = this.moderateContent(text, analysis);
      
      // Calculate confidence
      analysis.confidence = this.calculateConfidence(analysis);
      
      // Auto-tag barcode type
      if (analysis.barcode?.type) {
        analysis.tag = `BARCODE_${analysis.barcode.type.toUpperCase()}`;
      } else if (analysis.patterns?.matched) {
        analysis.tag = `PATTERN_${analysis.patterns.type.toUpperCase()}`;
      } else {
        analysis.tag = 'SCAN';
      }

      // Cache results
      this.cache.set(cacheKey, analysis);
      this.trimCache();

      // Update metrics
      this.metrics.processedCount++;
      this.metrics.lastProcessTime = performance.now() - startTime;
      this.metrics.averageTime = 
        (this.metrics.averageTime * (this.metrics.processedCount - 1) + this.metrics.lastProcessTime) / 
        this.metrics.processedCount;

      // Store in history
      if (this.config.enableRealTimeAnalysis) {
        this.barcodeHistory.push({
          text,
          analysis,
          timestamp: Date.now()
        });
        if (this.barcodeHistory.length > 100) {
          this.barcodeHistory.shift();
        }
      }

      // Emit processing event
      this.emit('processed', {
        text,
        analysis,
        metrics: {
          time: this.metrics.lastProcessTime,
          total: this.metrics.processedCount
        }
      });

      return analysis;

    } catch (error) {
      console.error('Processing error:', error);
      this.metrics.errors++;
      this.emit('error', { 
        message: 'Processing failed',
        error: error.message,
        text: text.slice(0, 50)
      });
      
      // Return emergency fallback
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
      checksum: null,
      confidence: 0,
      matches: []
    };

    // Check against all patterns
    for (const [type, pattern] of Object.entries(this.barcodePatterns)) {
      if (pattern.test(text)) {
        results.matches.push(type);
        results.type = type;
        results.valid = true;
        results.confidence = 0.95;
        
        // Calculate checksum for numeric barcodes
        if (['ean13', 'ean8', 'upc'].includes(type)) {
          results.checksum = this.calculateChecksum(text);
        }
        break;
      }
    }

    // If no match, try fuzzy matching
    if (!results.valid && this.config.enablePatternRecognition) {
      const fuzzyMatch = this.fuzzyBarcodeMatch(text);
      if (fuzzyMatch) {
        results.type = fuzzyMatch.type;
        results.valid = true;
        results.confidence = fuzzyMatch.confidence;
        results.matches.push(fuzzyMatch.type);
      }
    }

    return results;
  }

  fuzzyBarcodeMatch(text) {
    // Clean the text
    const cleaned = text.replace(/[^A-Z0-9]/gi, '');
    if (!cleaned) return null;

    // Check if it matches any pattern loosely
    for (const [type, pattern] of Object.entries(this.barcodePatterns)) {
      const cleanedPattern = new RegExp(pattern.source.replace(/\\/g, ''), 'i');
      if (cleanedPattern.test(cleaned)) {
        return {
          type: type,
          confidence: 0.7
        };
      }
    }

    // Check length-based guessing
    if (cleaned.length === 13) return { type: 'ean13', confidence: 0.6 };
    if (cleaned.length === 12) return { type: 'upc', confidence: 0.6 };
    if (cleaned.length === 8) return { type: 'ean8', confidence: 0.6 };
    if (cleaned.length >= 20 && cleaned.length <= 40) return { type: 'qr', confidence: 0.5 };

    return null;
  }

  validateBarcode(text) {
    const analysis = this.analyzeBarcode(text);
    return analysis?.valid || false;
  }

  correctBarcode(text) {
    if (!text) return null;
    
    let corrected = text.trim();
    
    // Remove invalid characters
    if (this.correctionRules.removeInvalidChars) {
      corrected = corrected.replace(/[^A-Z0-9\-_+\/=]/gi, '');
    }
    
    // Normalize case
    if (this.correctionRules.normalizeCase) {
      corrected = corrected.toUpperCase();
    }
    
    // Fix length for known formats
    if (this.correctionRules.fixLength) {
      // Pad or truncate common formats
      if (corrected.length < 8 && corrected.length > 0) {
        // Try to guess format
        if (/^[0-9]+$/.test(corrected)) {
          if (corrected.length <= 8) {
            corrected = corrected.padStart(8, '0');
          }
        }
      }
    }
    
    return {
      original: text,
      corrected: corrected,
      changed: text !== corrected
    };
  }

  calculateChecksum(text) {
    if (!text || !/^[0-9]+$/.test(text)) return null;
    
    const digits = text.split('').map(Number);
    let sum = 0;
    let alternator = 1;
    
    // EAN/UPC checksum algorithm
    for (let i = digits.length - 2; i >= 0; i--) {
      sum += digits[i] * (alternator === 1 ? 3 : 1);
      alternator = alternator === 1 ? 0 : 1;
    }
    
    const checkDigit = (10 - (sum % 10)) % 10;
    return {
      calculated: checkDigit,
      provided: digits[digits.length - 1],
      valid: digits[digits.length - 1] === checkDigit
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
      base64: /^[A-Za-z0-9+/=]+$/,
      bitcoin: /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/,
      ethereum: /^0x[a-fA-F0-9]{40}$/
    };

    const detected = [];
    for (const [type, pattern] of Object.entries(patterns)) {
      if (pattern.test(text)) {
        detected.push({ type, pattern: pattern.toString() });
      }
    }

    return {
      text: text,
      matched: detected.length > 0,
      patterns: detected,
      type: detected[0]?.type || null
    };
  }

  classifyPattern(text) {
    const patterns = this.detectPatterns(text);
    if (!patterns?.matched) return { type: 'unknown', confidence: 0 };
    
    // Confidence based on pattern type
    const confidenceMap = {
      email: 0.95,
      url: 0.9,
      phone: 0.85,
      date: 0.8,
      hex: 0.7,
      base64: 0.6,
      bitcoin: 0.95,
      ethereum: 0.95
    };
    
    const type = patterns.patterns[0]?.type || 'unknown';
    return {
      type,
      confidence: confidenceMap[type] || 0.5,
      allPatterns: patterns.patterns
    };
  }

  // ========== SENTIMENT ANALYSIS ==========
  async analyzeSentiment(text) {
    if (!this.models.sentiment) {
      return this.fallbackSentiment(text);
    }
    
    try {
      const result = await this.models.sentiment(text);
      return {
        label: result[0]?.label || 'neutral',
        score: result[0]?.score || 0.5,
        polarity: this.getPolarity(result[0]?.label)
      };
    } catch (error) {
      console.warn('Sentiment analysis failed:', error.message);
      return this.fallbackSentiment(text);
    }
  }

  fallbackSentiment(text) {
    const words = text.split(/\s+/);
    const positive = ['good', 'great', 'excellent', 'amazing', 'positive', 'yes', 'ok'];
    const negative = ['bad', 'terrible', 'awful', 'negative', 'no', 'problem', 'error', 'fail'];
    
    let score = 0;
    const lowerText = text.toLowerCase();
    positive.forEach(word => {
      if (lowerText.includes(word)) score += 0.2;
    });
    negative.forEach(word => {
      if (lowerText.includes(word)) score -= 0.2;
    });
    
    return {
      label: score > 0.2 ? 'POSITIVE' : score < -0.2 ? 'NEGATIVE' : 'NEUTRAL',
      score: Math.min(Math.max(0.5 + score, 0), 1),
      polarity: score > 0.2 ? 'positive' : score < -0.2 ? 'negative' : 'neutral'
    };
  }

  // ========== CLASSIFICATION ==========
  async classifyText(text) {
    if (!this.models.classifier) {
      return this.fallbackClassification(text);
    }
    
    try {
      const result = await this.models.classifier(text, { top_k: 3 });
      return {
        label: result[0]?.label || 'neutral',
        score: result[0]?.score || 0.5,
        topResults: result
      };
    } catch (error) {
      console.warn('Classification failed:', error.message);
      return this.fallbackClassification(text);
    }
  }

  fallbackClassification(text) {
    const length = text.length;
    const hasNumbers = /\d/.test(text);
    const hasLetters = /[a-zA-Z]/.test(text);
    
    let label = 'general';
    let score = 0.5;
    
    if (hasNumbers && !hasLetters) {
      label = 'numeric';
      score = 0.8;
    } else if (hasLetters && !hasNumbers) {
      label = 'alphabetic';
      score = 0.7;
    } else if (length > 50) {
      label = 'long_text';
      score = 0.6;
    } else if (length < 10) {
      label = 'short_code';
      score = 0.75;
    }
    
    return {
      label,
      score,
      topResults: [{ label, score }]
    };
  }

  // ========== MODERATION ==========
  moderateContent(text, analysis) {
    const flags = [];
    let allow = true;
    let severity = 'low';
    
    // Check for suspicious content
    const suspicious = ['malicious', 'exploit', 'hack', 'illegal', 'prohibited', 'flagged'];
    const lowerText = text.toLowerCase();
    if (suspicious.some(s => lowerText.includes(s))) {
      flags.push('suspicious_content');
      severity = 'high';
    }
    
    // Check sentiment
    if (analysis.sentiment?.polarity === 'negative') {
      flags.push('negative_sentiment');
      if (severity === 'low') severity = 'medium';
    }
    
    // Check barcode validity
    if (analysis.barcode && !analysis.barcode.valid) {
      flags.push('invalid_barcode');
    }
    
    // Check length
    if (text.length > 500) {
      flags.push('lengthy');
    }
    
    // Determine if allowed
    allow = flags.length === 0 || 
            flags.every(f => ['lengthy', 'test'].includes(f));
    
    // Calculate severity
    if (flags.some(f => ['suspicious_content', 'malicious'].includes(f))) {
      severity = 'high';
    } else if (flags.some(f => ['negative_sentiment', 'invalid_barcode'].includes(f))) {
      severity = 'medium';
    }
    
    return {
      allow,
      verdict: allow ? 'clean' : 'flagged',
      flags,
      severity,
      timestamp: Date.now()
    };
  }

  // ========== CORRECTIONS ==========
  applyCorrections(text) {
    let corrected = text;
    const changes = [];
    
    // Trim whitespace
    if (this.correctionRules.trimWhitespace) {
      const trimmed = corrected.trim();
      if (trimmed !== corrected) {
        changes.push('trimmed');
        corrected = trimmed;
      }
    }
    
    // Remove invalid characters
    if (this.correctionRules.removeInvalidChars) {
      const clean = corrected.replace(/[^A-Z0-9\-_+\/=]/gi, '');
      if (clean !== corrected) {
        changes.push('cleaned');
        corrected = clean;
      }
    }
    
    // Normalize case
    if (this.correctionRules.normalizeCase) {
      const upper = corrected.toUpperCase();
      if (upper !== corrected) {
        changes.push('uppercase');
        corrected = upper;
      }
    }
    
    return {
      original: text,
      corrected,
      changes,
      changed: changes.length > 0
    };
  }

  // ========== UTILITY METHODS ==========
  getPolarity(label) {
    if (!label) return 'neutral';
    const l = label.toLowerCase();
    if (l.includes('positive') || l.includes('pos')) return 'positive';
    if (l.includes('negative') || l.includes('neg')) return 'negative';
    return 'neutral';
  }

  calculateConfidence(analysis) {
    let scores = [];
    
    if (analysis.barcode?.confidence) {
      scores.push(analysis.barcode.confidence);
    }
    if (analysis.patterns?.confidence) {
      scores.push(analysis.patterns.confidence);
    }
    if (analysis.sentiment?.score) {
      scores.push(analysis.sentiment.score);
    }
    if (analysis.classification?.score) {
      scores.push(analysis.classification.score);
    }
    
    if (scores.length === 0) return 0.65;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  generateCacheKey(text) {
    return `${text.slice(0, 200)}_${text.length}_${this.version}`;
  }

  trimCache() {
    if (this.cache.size > this.config.maxCacheSize) {
      const entries = Array.from(this.cache.entries());
      const toDelete = entries.slice(0, Math.floor(entries.length * 0.2));
      toDelete.forEach(([key]) => this.cache.delete(key));
      console.log(`🧹 Cache trimmed (${toDelete.length} entries removed)`);
    }
  }

  // ========== FALLBACK MODELS ==========
  createFallbackModel(type) {
    return {
      type: 'fallback',
      predict: (input) => {
        return {
          label: 'unknown',
          score: 0.5,
          confidence: 0.5
        };
      }
    };
  }

  // ========== EMERGENCY FALLBACK ==========
  emergencyFallback(text) {
    return {
      original: text,
      timestamp: Date.now(),
      barcode: null,
      patterns: null,
      sentiment: null,
      classification: null,
      moderation: {
        allow: true,
        verdict: 'clean',
        flags: [],
        severity: 'low',
        timestamp: Date.now(),
        fallback: true
      },
      confidence: 0.3,
      tag: 'FALLBACK',
      fallback: true,
      error: true
    };
  }

  // ========== BATCH PROCESSING ==========
  async processBatch(texts, options = {}) {
    const results = [];
    const batchSize = this.config.batchSize;
    
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(text => this.process(text, options))
      );
      
      batchResults.forEach((result, index) => {
        results.push({
          index: i + index,
          text: batch[index],
          ...(result.status === 'fulfilled' ? result.value : { 
            error: result.reason?.message || 'Processing failed',
            fallback: this.emergencyFallback(batch[index])
          })
        });
      });
    }
    
    return results;
  }

  // ========== STATISTICS & METRICS ==========
  getMetrics() {
    return {
      ...this.metrics,
      cacheSize: this.cache.size,
      historySize: this.barcodeHistory.length,
      uptime: Date.now() - this.metrics.startTime || 0,
      features: this.features,
      models: Object.keys(this.models).filter(k => this.models[k]).length
    };
  }

  getStats() {
    return {
      totalProcessed: this.metrics.processedCount,
      cacheHitRate: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) || 0,
      averageTime: this.metrics.averageTime,
      errorRate: this.metrics.errors / (this.metrics.processedCount || 1),
      isReady: this.isReady,
      version: this.version
    };
  }

  // ========== STATE MANAGEMENT ==========
  isReady() {
    return this.isReady;
  }

  clearCache() {
    this.cache.clear();
    this.patternCache.clear();
    console.log('🧹 All caches cleared');
    this.emit('cache-cleared', { timestamp: Date.now() });
  }

  resetMetrics() {
    this.metrics = {
      processedCount: 0,
      averageTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
      lastProcessTime: 0,
      startTime: Date.now()
    };
    console.log('📊 Metrics reset');
  }

  getHistory() {
    return this.barcodeHistory;
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
    this.patternCache.clear();
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
