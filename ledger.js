class QuantumLedger {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.warn(`Ledger container #${containerId} not found.`);
    }
  }

  analyzePayload(payload) {
    const trimmed = payload.trim();
    const length = trimmed.length;
    const entropy = this.calculateEntropy(trimmed);

    const isURL = /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(trimmed);
    const isJSON = this.tryParseJSON(trimmed);
    const isHex = /^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0;

    const isBase64 =
      /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(trimmed) &&
      trimmed.length >= 4 &&
      (/[+/=]/.test(trimmed) || entropy > 4.5);

    let classification = "UNKNOWN SIGNAL";
    if (isURL) classification = "URL";
    else if (isJSON) classification = "JSON OBJECT";
    else if (isHex) classification = "HEX STRING";
    else if (isBase64) classification = "BASE64 ENCODED";
    else if (length < 8) classification = "SHORT CODE";
    else if (length > 80) classification = "LONG FORM DATA";

    // EXTRA 5 DATA POINTS
    const charset = this.detectCharset(trimmed);
    const entropyClass = this.entropyClass(entropy);
    const signalStrength = this.signalStrength(length, entropy);
    const decodedPreview = this.tryDecode(trimmed);
    const hashFingerprint = this.sha256Fingerprint(trimmed);

    return {
      length,
      entropy,
      classification,
      charset,
      entropyClass,
      signalStrength,
      decodedPreview,
      hashFingerprint
    };
  }

  detectCharset(str) {
    if (/^[\x00-\x7F]+$/.test(str)) return "ASCII";
    if (/^[\x00-\xFF]+$/.test(str)) return "Extended ASCII";
    return "Unicode / Binary-like";
  }

  entropyClass(entropy) {
    const e = parseFloat(entropy);
    if (e < 3) return "Low";
    if (e < 4) return "Medium";
    return "High";
  }

  signalStrength(length, entropy) {
    const score = length * 0.2 + parseFloat(entropy) * 4;
    if (score < 20) return "Weak";
    if (score < 40) return "Moderate";
    return "Strong";
  }

  tryDecode(str) {
    try {
      if (/^[0-9a-fA-F]+$/.test(str) && str.length % 2 === 0) {
        const bytes = str.match(/.{2}/g).map(h => parseInt(h, 16));
        return String.fromCharCode(...bytes).slice(0, 60);
      }
      if (/^[A-Za-z0-9+/=]+$/.test(str)) {
        return atob(str).slice(0, 60);
      }
    } catch {}
    return "n/a";
  }

  sha256Fingerprint(str) {
    try {
      const buffer = new TextEncoder().encode(str);
      return crypto.subtle.digest("SHA-256", buffer).then(hash => {
        const hex = Array.from(new Uint8Array(hash))
          .map(b => b.toString(16).padStart(2, "0"))
          .join("");
        return hex.slice(0, 16);
      });
    } catch {
      return Promise.resolve("n/a");
    }
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

  async addEntry(payload, tag = "SCAN", extraMeta = {}) {
    if (!this.container) return;

    const meta = this.analyzePayload(payload);
    const hash = await meta.hashFingerprint;
    const time = new Date().toLocaleTimeString();

    const item = document.createElement("div");
    item.className = "ledgerItem";
    item.setAttribute(
      "data-classification",
      meta.classification.toLowerCase().replace(" ", "-")
    );

    const payloadEl = document.createElement("div");
    payloadEl.className = "ledgerPayload";
    payloadEl.textContent = payload;

    const footerEl = document.createElement("div");
    footerEl.className = "ledgerFooter";

    const tagEl = document.createElement("span");
    tagEl.className = `ledgerTag tag-${tag.toLowerCase()}`;
    tagEl.textContent = tag;

    const timeEl = document.createElement("span");
    timeEl.className = "ledgerTime";
    timeEl.textContent = time;

    footerEl.appendChild(tagEl);
    footerEl.appendChild(timeEl);

    const metaEl = document.createElement("div");
    metaEl.className = "ledgerMeta";
    metaEl.innerHTML = `
      <span><strong>Len:</strong> ${meta.length}</span>
      <span><strong>Entropy:</strong> ${meta.entropy}</span>
      <span><strong>Type:</strong> ${meta.classification}</span>
      <span><strong>Charset:</strong> ${meta.charset}</span>
      <span><strong>Entropy Class:</strong> ${meta.entropyClass}</span>
      <span><strong>Strength:</strong> ${meta.signalStrength}</span>
      <span><strong>Decoded:</strong> ${meta.decodedPreview}</span>
      <span><strong>Fingerprint:</strong> ${hash}</span>
      ${extraMeta.type ? `<span><strong>QAI:</strong> ${extraMeta.type}</span>` : ""}
      ${extraMeta.pattern ? `<span><strong>Pattern:</strong> ${extraMeta.pattern}</span>` : ""}
      ${extraMeta.explanation ? `<span style="flex:1 1 100%"><strong>Insight:</strong> ${extraMeta.explanation}</span>` : ""}
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
