/**
 * Mastermind v2.0 - Orchestration Layer for QTUM(LOG)
 * Manages all system components with enhanced state control
 */

class Mastermind {
  constructor() {
    this.components = {};
    this.state = {
      isCameraActive: false,
      isScanning: false,
      isProcessing: false,
      lastScan: null,
      totalScans: 0,
      flaggedItems: 0
    };
    
    this.eventBus = new EventTarget();
    this.initialize();
  }

  async initialize() {
    try {
      // Initialize components in order
      this.components.qai = new Qai();
      this.components.ledger = new QuantumLedger('ledger');
      this.components.scanner = new QtumScanner(
        this.components.qai, 
        this.components.ledger,
        this
      );

      // Setup event listeners
      this.setupEventListeners();
      
      // Setup keyboard shortcuts
      this.setupKeyboardShortcuts();

      // Update UI
      this.updateLedgerCount();
      
      console.log('🧠 Mastermind initialized successfully');
      this.emit('ready', { timestamp: Date.now() });
    } catch (error) {
      console.error('❌ Mastermind initialization failed:', error);
      this.showError('System initialization failed');
    }
  }

  setupEventListeners() {
    // Scanner events
    this.components.scanner.addEventListener('scan', (e) => {
      this.handleScan(e.detail);
    });

    this.components.scanner.addEventListener('error', (e) => {
      this.handleError(e.detail);
    });

    this.components.scanner.addEventListener('status', (e) => {
      this.updateStatus(e.detail.message, e.detail.type);
    });

    // Ledger events
    this.components.ledger.addEventListener('update', () => {
      this.updateLedgerCount();
    });

    // QAI events
    this.components.qai.addEventListener('ready', () => {
      this.updateStatus('QAI ready', 'success');
    });

    this.components.qai.addEventListener('error', (e) => {
      this.handleError(e.detail);
    });
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+Space: Toggle camera
      if (e.ctrlKey && e.code === 'Space') {
        e.preventDefault();
        this.toggleCamera();
      }
      
      // Ctrl+S: Send signal
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        this.sendSignal();
      }
      
      // Ctrl+C: Clear
      if (e.ctrlKey && e.key === 'c') {
        e.preventDefault();
        this.clearAll();
      }
      
      // Escape: Cancel
      if (e.key === 'Escape') {
        this.cancelOperation();
      }
    });
  }

  // ========== SCAN HANDLING ==========
  async handleScan(data) {
    this.state.totalScans++;
    this.state.lastScan = data;
    
    // Update UI
    this.updateStatus(`📸 Scan #${this.state.totalScans}`, 'info');
    
    // Auto-analyze with QAI
    if (this.components.qai.isReady()) {
      try {
        const analysis = await this.components.qai.analyze(data.text);
        if (analysis.flagged) {
          this.state.flaggedItems++;
          this.updateStatus('⚠️ Flagged content detected', 'warning');
        }
      } catch (error) {
        console.warn('QAI analysis failed:', error);
      }
    }
    
    this.emit('scan', data);
  }

  handleError(error) {
    console.error('System error:', error);
    this.updateStatus(`❌ ${error.message}`, 'error');
    this.emit('error', error);
  }

  // ========== UI UPDATES ==========
  updateStatus(message, type = 'info') {
    const statusEl = document.getElementById('status');
    if (statusEl) {
      statusEl.textContent = message;
      statusEl.className = type;
    }
  }

  updateLedgerCount() {
    const countEl = document.getElementById('ledgerCount');
    if (countEl && this.components.ledger) {
      const entries = this.components.ledger.getEntries();
      countEl.textContent = `${entries.length} entries`;
    }
  }

  showError(message) {
    this.updateStatus(`❌ ${message}`, 'error');
    // Could add toast notifications here
  }

  // ========== ACTIONS ==========
  async toggleCamera() {
    const scanner = this.components.scanner;
    if (this.state.isCameraActive) {
      await scanner.stopCamera();
      this.state.isCameraActive = false;
      this.updateStatus('Camera stopped', 'info');
    } else {
      await scanner.startCamera();
      this.state.isCameraActive = true;
      this.updateStatus('Camera active', 'success');
    }
    this.emit('camera-toggle', { active: this.state.isCameraActive });
  }

  sendSignal() {
    const scanner = this.components.scanner;
    const payload = prompt('Enter signal payload:', 'QTUM_SIGNAL');
    if (payload !== null) {
      scanner.sendSignal(payload);
      this.updateStatus(`✦ Signal sent: ${payload}`, 'success');
    }
  }

  clearAll() {
    if (confirm('Clear all ledger entries?')) {
      this.components.ledger.clear();
      this.state.totalScans = 0;
      this.state.flaggedItems = 0;
      this.updateLedgerCount();
      this.updateStatus('🗑️ Ledger cleared', 'info');
      this.emit('clear', { timestamp: Date.now() });
    }
  }

  cancelOperation() {
    // Cancel any ongoing operations
    this.state.isProcessing = false;
    this.updateStatus('Operation cancelled', 'info');
  }

  // ========== EXPORT / IMPORT ==========
  exportData() {
    const data = {
      version: '2.0',
      timestamp: Date.now(),
      state: this.state,
      ledger: this.components.ledger.getEntries(),
      qai: {
        version: this.components.qai.version || 'unknown'
      }
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qtum_log_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    this.updateStatus('📤 Data exported', 'success');
  }

  importData(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.ledger) {
          this.components.ledger.import(data.ledger);
          this.updateLedgerCount();
          this.updateStatus('📥 Data imported', 'success');
        }
      } catch (error) {
        this.handleError({ message: 'Invalid import data' });
      }
    };
    reader.readAsText(file);
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

  // ========== STATE QUERIES ==========
  getState() {
    return { ...this.state };
  }

  getStats() {
    return {
      totalScans: this.state.totalScans,
      flaggedItems: this.state.flaggedItems,
      ledgerSize: this.components.ledger.getEntries().length
    };
  }
}

// Export for use
window.Mastermind = Mastermind;
