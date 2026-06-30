/**
 * QAI v0.90 - Quantum Artificial Intelligence Interface
 * Enhanced with event system and better error handling
 */

class Qai {
  constructor() {
    this.version = '0.90';
    this.isReady = false;
    this.eventBus = new EventTarget();
    this.cache = new Map();
    this.initialize();
  }

  async initialize() {
    try {
      // Simulate initialization
      await new Promise(resolve => setTimeout(resolve, 500));
      this.isReady = true;
      this.emit('ready', { version: this.version });
      console.log(`🧠 QAI v${this.version} ready`);
    } catch (error) {
      console.error('QAI initialization failed:', error);
      this.emit('error', error);
    }
  }

  async process(text) {
    if (!text) throw new Error('No input provided');

    // Check cache
    const cacheKey = text.slice(0, 100);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const result = {
        original: text,
        moderation: this.analyzeText(text),
        timestamp: Date.now(),
        confidence: 0.85 + Math.random() * 0.15
      };

      // Cache result
      this.cache.set(cacheKey, result);
      
      return result;
    } catch (error) {
      console.error('Processing error:', error);
      throw error;
    }
  }

  async analyze(text) {
    const result = await this.process(text);
    return {
      text: text,
      flagged: !result.moderation.allow,
      confidence: result.confidence,
      tags: result.moderation.flags || []
    };
  }

  analyzeText(text) {
    const flags = [];
    const lower = text.toLowerCase();

    // Simple analysis
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

  isReady() {
    return this.isReady;
  }

  clearCache() {
    this.cache.clear();
    console.log('🧹 QAI cache cleared');
  }

  // Event system
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

// Export
window.Qai = Qai;
