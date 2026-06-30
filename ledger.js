class QuantumLedger {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.warn(`Ledger container #${containerId} not found.`);
    }
  }

  /**
   * Safe payload analysis with precise heuristics
   */
  analyzePayload(payload) {
    const trimmed = payload.trim();
    const length = payload.length;
    const entropy = this.calculateEntropy(payload);

    // Heuristics
    const isURL = /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(trimmed);
    const isJSON = this.tryParseJSON(trimmed);
    const isHex = /^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0;
    
    // Stricter Base64 pattern requiring length to be a multiple of 4 and avoiding pure alphabet words
    const isBase64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(trimmed) 
                     && trimmed.length >= 4 
                     && (/[+/=]/.test(trimmed) || entropy > 4.5);

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
    const map = {};
    for (const char of str) {
      map[char] = (map[char] || 0) + 1;
    }

    let entropy = 0;
    const len = str.length;
    for (const char in map) {
      const p = map[char] / len;
      entropy -= p * Math.log2(p);
    }
    return entropy.toFixed(2);
  }

  tryParseJSON(str) {
    if (!str.startsWith("{") && !str.startsWith("[")) return false;
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Appends an entry safely using DOM elements
   */
  addEntry(payload, tag = "SCAN") {
    if (!this.container) return;

    const meta = this.analyzePayload(payload);
    const time = new Date().toLocaleTimeString();

    // Create container safely
    const item = document.createElement("div");
    item.className = "ledger-item";
    item.setAttribute("data-classification", meta.classification.toLowerCase().replace(" ", "-"));

    // Construct children using innerText/textContent to prevent script injection
    const payloadEl = document.createElement("div");
    payloadEl.className = "ledger-payload";
    payloadEl.textContent = payload;

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

    // Metadata Panel
    const metaEl = document.createElement("div");
    metaEl.className = "ledger-meta";
    metaEl.innerHTML = `
      <span><strong>Len:</strong> ${meta.length}</span>
      <span><strong>Entropy:</strong> ${meta.entropy}</span>
      <span><strong>Type:</strong> ${meta.classification}</span>
    `;

    item.appendChild(payloadEl);
    item.appendChild(metaEl);
    item.appendChild(footerEl);

    this.container.prepend(item);
  }

  clear() {
    if (!this.container) return;
    if (confirm("Clear all ledger entries?")) {
      this.container.innerHTML = "";
    }
  }
}
