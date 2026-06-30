/**
 * QuantumLedger v1.0 - Secure transaction ledger with events
 */

class QuantumLedger {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.entries = [];
    this.eventBus = new EventTarget();
    this.maxEntries = 1000;
    this.loadFromStorage();
    
    // Auto-save on update
    this.addEventListener('update', () => {
      this.saveToStorage();
      this.render();
    });
  }

  addEntry(data, tag = 'SCAN', report = null) {
    const entry = {
      id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      data: data,
      tag: tag,
      report: report,
      hash: this.generateHash(data + tag)
    };

    this.entries.unshift(entry);
    
    // Limit entries
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(0, this.maxEntries);
    }

    this.emit('update', { entry, total: this.entries.length });
    return entry;
  }

  addBatch(items, tag = 'BATCH') {
    const results = [];
    items.forEach(item => {
      results.push(this.addEntry(item, tag));
    });
    this.emit('batch', { items: results, count: results.length });
    return results;
  }

  getEntries() {
    return this.entries;
  }

  clear() {
    this.entries = [];
    this.emit('clear', { timestamp: Date.now() });
    this.saveToStorage();
    this.render();
  }

  render() {
    if (!this.container) return;
    
    if (this.entries.length === 0) {
      this.container.innerHTML = '<div class="empty-ledger">No entries yet</div>';
      return;
    }

    let html = '';
    const displayEntries = this.entries.slice(0, 50);
    
    displayEntries.forEach((entry, index) => {
      const tagClass = entry.tag === 'FLAGGED' ? 'tag-flagged' : 
                      entry.tag === 'SIGNAL' ? 'tag-signal' : 
                      entry.tag === 'IMAGE' ? 'tag-image' : 'tag-scan';
      
      const time = new Date(entry.timestamp).toLocaleTimeString();
      const data = typeof entry.data === 'string' ? 
                   entry.data.slice(0, 50) : 
                   JSON.stringify(entry.data).slice(0, 50);
      
      html += `
        <div class="ledger-entry" data-id="${entry.id}">
          <div class="ledger-index">#${this.entries.length - index}</div>
          <div class="ledger-data">${this.escapeHtml(data)}</div>
          <div class="ledger-tag ${tagClass}">${entry.tag}</div>
          <div class="ledger-time">${time}</div>
        </div>
      `;
    });

    if (this.entries.length > 50) {
      html += `<div class="ledger-more">+ ${this.entries.length - 50} more entries</div>`;
    }

    this.container.innerHTML = html;
  }

  generateHash(data) {
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16).padStart(8, '0');
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Storage
  saveToStorage() {
    try {
      localStorage.setItem('qtum_ledger', JSON.stringify({
        entries: this.entries,
        savedAt: Date.now()
      }));
    } catch (error) {
      console.warn('Failed to save ledger:', error);
    }
  }

  loadFromStorage() {
    try {
      const data = localStorage.getItem('qtum_ledger');
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
      this.emit('import', { count: entries.length });
    }
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
window.QuantumLedger = QuantumLedger;
