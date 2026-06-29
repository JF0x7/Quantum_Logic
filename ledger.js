// -----------------------------------------------------
//       Ledger version 3.1
// -----------------------------------------------------
class QuantumLedger {
  constructor(containerId = "ledger") {
    this.container = document.getElementById(containerId);
    if (!this.container) console.warn(`Ledger container #${containerId} not found.`);
  }

  // -----------------------------------------------------
  // 🔍 PAYLOAD ANALYSIS
  // -----------------------------------------------------
  analyzePayload(payload) {
    const trimmed = payload.trim();
    const length = trimmed.length;
    const entropy = this.calculateEntropy(trimmed);

    const isURL = /^https?:\/\/[^\s]+$/i.test(trimmed);
    const isJSON = this.tryParseJSON(trimmed);
    const isHex = /^[0-9a-fA-F]+$/.test(trimmed) && length % 2 === 0;
    const isBase64 =
      /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(trimmed);

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
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  }

  // -----------------------------------------------------
  // 🔐 MULTI‑LAYER DECRYPTION ENGINE (Base64, Hex, ROT13, JSON, URL)
  // -----------------------------------------------------
  decryptPayload(payload) {
    const results = {
      base64: null,
      hex: null,
      rot13: null,
      json: null,
      url: null,
      success: false
    };

    // Base64 decode
    try {
      results.base64 = atob(payload);
      results.success = true;
    } catch {}

    // Hex decode
    try {
      if (/^[0-9a-fA-F]+$/.test(payload)) {
        const bytes = payload.match(/.{1,2}/g).map(b => parseInt(b, 16));
        results.hex = new TextDecoder().decode(new Uint8Array(bytes));
        results.success = true;
      }
    } catch {}

    // ROT13 decode
    try {
      results.rot13 = payload.replace(/[a-zA-Z]/g, c =>
        String.fromCharCode(
          (c <= "Z" ? 90 : 122) >= (c = c.charCodeAt(0) + 13)
            ? c
            : c - 26
        )
      );
      results.success = true;
    } catch {}

    // JSON decode (from any decoded form)
    try {
      const candidate =
        results.base64 ||
        results.hex ||
        results.rot13 ||
        payload;

      if (this.tryParseJSON(candidate)) {
        results.json = JSON.parse(candidate);
        results.success = true;
      }
    } catch {}

    // URL detection
    try {
      if (/^https?:\/\/[^\s]+$/i.test(payload)) {
        results.url = payload;
        results.success = true;
      }
    } catch {}

    return results;
  }

  // -----------------------------------------------------
  // 🧾 LEDGER ENTRY
  // -----------------------------------------------------
  addEntry(payload, tag = "SCAN") {
    if (!this.container) return;

    const meta = this.analyzePayload(payload);
    const decrypt = this.decryptPayload(payload);
    const time = new Date().toLocaleTimeString();

    const item = document.createElement("div");
    item.className = "ledger-item";
    item.dataset.classification =
      meta.classification.toLowerCase().replace(/\s+/g, "-");

    // Payload block
    const payloadEl = document.createElement("div");
    payloadEl.className = "ledger-payload";
    payloadEl.textContent = payload;

    // Metadata block
    const metaEl = document.createElement("div");
    metaEl.className = "ledger-meta";
    metaEl.innerHTML =
      `<span><strong>Len:</strong> ${meta.length}</span>` +
      `<span><strong>Entropy:</strong> ${meta.entropy}</span>` +
      `<span><strong>Type:</strong> ${meta.classification}</span>` +
      `<span><strong>Decoded:</strong> ${decrypt.success ? "yes" : "no"}</span>`;

    // Decoded preview block
    if (decrypt.success) {
      const previewEl = document.createElement("div");
      previewEl.className = "ledger-meta";

      const preview =
        decrypt.json ? JSON.stringify(decrypt.json).slice(0, 120) :
        decrypt.base64 ? decrypt.base64.slice(0, 120) :
        decrypt.hex ? decrypt.hex.slice(0, 120) :
        decrypt.rot13 ? decrypt.rot13.slice(0, 120) :
        decrypt.url ? decrypt.url :
        "unknown";

      previewEl.innerHTML =
        `<span><strong>Decoded Preview:</strong> ${preview}</span>`;
      item.appendChild(previewEl);
    }

    // Footer block
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

    // Assemble entry
    item.appendChild(payloadEl);
    item.appendChild(metaEl);
    item.appendChild(footerEl);

    this.container.prepend(item);
  }

  // -----------------------------------------------------
  // 📦 BATCH SUPPORT
  // -----------------------------------------------------
  addBatch(payloadArray, tag = "SIGNAL") {
    payloadArray.forEach(p => this.addEntry(p, tag));
  }

  clear() {
    if (!this.container) return;
    this.container.innerHTML = "";
  }
}

window.QuantumLedger = QuantumLedger;
