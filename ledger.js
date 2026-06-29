// QuantumLedger class - made globally available
class QuantumLedger {
  constructor(containerId = "ledger") {
    this.container = document.getElementById(containerId);
    if (!this.container) console.warn(`Ledger container #${containerId} not found.`);
  }

  analyzePayload(payload) {
    const trimmed = payload.trim();
    const length = trimmed.length;
    const entropy = this.calculateEntropy(trimmed);
    const isURL = /^https?:\/\/[^\s]+$/i.test(trimmed);
    const isJSON = this.tryParseJSON(trimmed);
    const isHex = /^[0-9a-fA-F]+$/.test(trimmed) && length % 2 === 0;
    const isBase64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(trimmed) && length >= 4;
    let classification = "UNKNOWN SIGNAL";
    if (isURL) classification = "URL";
    else if (isJSON) classification = "JSON OBJECT";
    else if (isHex) classification = "HEX STRING";
    else if (isBase64) classification = "BASE64 ENCODED";
    else if (length < 8) classification = "SHORT CODE";
    else if (length > 80) classification = "LONG FORM DATA";
    return { length, entropy, classification };
  }

  calculateEntropy(str) {
    if (!str) return "0.00";
    const freq = {};
    for (const c of str) freq[c] = (freq[c] || 0) + 1;
    let entropy = 0;
    const len = str.length;
    for (const c in freq) {
      const p = freq[c] / len;
      entropy -= p * Math.log2(p);
    }
    return entropy.toFixed(2);
  }

  tryParseJSON(str) {
    if (!str.startsWith("{") && !str.startsWith("[")) return false;
    try { JSON.parse(str); return true; } catch { return false; }
  }

  addEntry(payload, tag = "SCAN") {
    if (!this.container) return;
    const meta = this.analyzePayload(payload);
    const time = new Date().toLocaleTimeString();
    const item = document.createElement("div");
    item.className = "ledger-item";
    item.dataset.classification = meta.classification.toLowerCase().replace(/\s+/g, "-");
    const payloadEl = document.createElement("div");
    payloadEl.className = "ledger-payload";
    payloadEl.textContent = payload;
    const metaEl = document.createElement("div");
    metaEl.className = "ledger-meta";
    metaEl.innerHTML = `<span><strong>Len:</strong> ${meta.length}</span><span><strong>Entropy:</strong> ${meta.entropy}</span><span><strong>Type:</strong> ${meta.classification}</span>`;
    const footerEl = document.createElement("div");
    footerEl.className = "ledger-footer";
    const tagEl = document.createElement("span");
    tagEl.className = `ledger-tag tag-${tag.toLowerCase()}`;
    tagEl.textContent = tag;
    const timeEl = document.createElement("span");
    timeEl.className = "ledger-time";
    timeEl.textContent = time;
    footerEl.appendChild(tagEl);
    footerEl.appendChild(timeEl);
    item.appendChild(payloadEl);
    item.appendChild(metaEl);
    item.appendChild(footerEl);
    this.container.prepend(item);
  }

  clear() {
    if (!this.container) return;
    this.container.innerHTML = "";
  }
}

// Make it globally available
window.QuantumLedger = QuantumLedger;
