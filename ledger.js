/**
 * QuantumLedger v2.0 - Rich Barcode Display
 */

class QuantumLedger extends EventTarget {
  constructor(containerId) {
    super();
    this.container = document.getElementById(containerId);
    this.entries = [];
    this.maxEntries = 500;
    this.loadFromStorage();
    
    this.addEventListener('update', () => {
      this.saveToStorage();
      this.render();
    });
  }

  addEntry(data, tag = 'SCAN', report = null) {
    // Handle rich entry objects
    let entry;
    if (typeof data === 'object' && data.raw) {
      // Already a rich entry
      entry = {
        id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        timestamp: Date.now(),
        ...data,
        tag: tag || data.tag || 'SCAN'
      };
    } else {
      // Simple entry - convert to rich
      entry = {
        id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        timestamp: Date.now(),
        raw: data,
        barcodeType: 'Unknown',
        valid: 'N/A',
        confidence: 'N/A',
        pattern: 'None',
        status: 'Clean',
        severity: 'Low',
        length: data.length,
        timestamp: new Date().toLocaleString(),
        tag: tag,
        info: {
          'Raw Data': data.slice(0, 50) + (data.length > 50 ? '...' : ''),
          'Length': data.length,
          'Type': 'Unknown',
          'Valid': 'N/A',
          'Confidence': 'N/A',
          'Status': 'Clean',
          'Severity': 'Low'
        }
      };
    }

    this.entries.unshift(entry);
    
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(0, this.maxEntries);
    }

    this.dispatchEvent(new CustomEvent('update', { 
      detail: { entry, total: this.entries.length }
    }));
    return entry;
  }

  getEntries() {
    return this.entries;
  }

  clear() {
    this.entries = [];
    this.dispatchEvent(new CustomEvent('clear', { timestamp: Date.now() }));
    this.saveToStorage();
    this.render();
  }

  render() {
    if (!this.container) return;
    
    if (this.entries.length === 0) {
      this.container.innerHTML = `
        <div class="empty-ledger">
          <span class="icon">📭</span>
          <div class="text">No barcodes scanned yet</div>
          <div style="font-size:0.7rem;color:var(--text-muted);margin-top:8px;">
            Scan a barcode to see 8-point analysis
          </div>
        </div>
      `;
      return;
    }

    let html = '';
    const displayEntries = this.entries.slice(0, 50);
    
    displayEntries.forEach((entry, index) => {
      // Determine tag class
      const tagClass = entry.tag === 'FLAGGED' ? 'tag-flagged' : 
                      entry.tag === 'SIGNAL' ? 'tag-signal' : 
                      entry.tag === 'IMAGE' ? 'tag-image' : 
                      entry.tag === 'BARCODE' ? 'tag-barcode' : 'tag-scan';
      
      // Build info items (8 pieces of barcode info)
      const infoItems = entry.info || {
        'Barcode Type': entry.barcodeType || 'Unknown',
        'Valid': entry.valid || 'N/A',
        'Confidence': entry.confidence || 'N/A',
        'Pattern': entry.pattern || 'None',
        'Status': entry.status || 'Clean',
        'Severity': entry.severity || 'Low',
        'Length': entry.length || 'N/A',
        'Scanned': entry.timestamp || new Date().toLocaleString()
      };
      
      // Build info grid
      let infoHtml = '';
      for (const [label, value] of Object.entries(infoItems)) {
        const valueClass = 
          value === '✅ Valid' || value === 'Clean' || value === '✅ Clean' ? 'success' :
          value === '❌ Invalid' || value === 'Flagged' || value === '⚠️ Flagged' ? 'danger' :
          value === 'High' ? 'danger' :
          value === 'Medium' ? 'warning' :
          value === 'Low' ? 'highlight' : '';
          
        infoHtml += `
          <div class="analysis-item">
            <span class="label">${label}</span>
            <span class="value ${valueClass}">${value}</span>
          </div>
        `;
      }
      
      // Display raw data
      const rawDisplay = typeof entry.raw === 'string' ? 
        entry.raw.slice(0, 80) + (entry.raw.length > 80 ? '...' : '') :
        JSON.stringify(entry.raw).slice(0, 80);
      
      html += `
        <div class="ledger-entry" data-id="${entry.id}">
          <div class="entry-header">
            <span class="entry-id">#${this.entries.length - index}</span>
            <span class="entry-tag ${tagClass}">${entry.tag || 'SCAN'}</span>
          </div>
          <div class="entry-data">${this.escapeHtml(rawDisplay)}</div>
          <div class="entry-analysis">
            ${infoHtml}
          </div>
          <div class="entry-time">${entry.timestamp || new Date(entry.timestamp).toLocaleString()}</div>
        </div>
      `;
    });

    if (this.entries.length > 50) {
      html += `<div class="ledger-more">+ ${this.entries.length - 50} more entries</div>`;
    }

    this.container.innerHTML = html;
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Storage
  saveToStorage() {
    try {
      localStorage.setItem('qtum_ledger_v2', JSON.stringify({
        entries: this.entries,
        savedAt: Date.now()
      }));
    } catch (error) {
      console.warn('Failed to save ledger:', error);
    }
  }

  loadFromStorage() {
    try {
      const data = localStorage.getItem('qtum_ledger_v2');
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.entries && Array.isArray(parsed.entries)) {
          this.entries = parsed.entries;
          this.render();
        }
      }
    } catch (error) {
      console.warn('Failed to load ledger:', error);
    }
  }

  import(entries) {
    if (Array.isArray(entries)) {
      this.entries = entries;
      this.render();
      this.saveToStorage();
      this.dispatchEvent(new CustomEvent('import', { 
        detail: { count: entries.length }
      }));
    }
  }
}

window.QuantumLedger = QuantumLedger;
