class QuantumLedger {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.warn(`Ledger container #${containerId} not found.`);
    }
  }

  // -------------------------------------------------------------
  // MAIN ANALYSIS
  // -------------------------------------------------------------
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

    // BASE 8 POINTS (your existing ones)
    const charset = this.detectCharset(trimmed);
    const entropyClass = this.entropyClass(entropy);
    const signalStrength = this.signalStrength(length, entropy);
    const decodedPreview = this.tryDecode(trimmed);
    const hashFingerprint = this.sha256Fingerprint(trimmed);

    // NEW 7 POINTS
    const rot13 = this.rot13(trimmed);
    const aztec = this.aztecDecode(trimmed);
    const altbash = this.altBashDecode(trimmed);
    const shaFullPromise = this.sha256Full(trimmed);
    const signalTypes = this.detectSignalTypes(trimmed);
    const signalLocation = this.detectSignalLocation(trimmed);
    const qNotes = this.generateQNotes(trimmed, classification, entropy);

    return {
      length,
      entropy,
      classification,
      charset,
      entropyClass,
      signalStrength,
      decodedPreview,
      hashFingerprint,

      rot13,
      aztec,
      altbash,
      shaFullPromise,
      signalTypes,
      signalLocation,
      qNotes
    };
  }

  // -------------------------------------------------------------
  // CHARACTER SET
  // -------------------------------------------------------------
  detectCharset(str) {
    if (/^[\x00-\x7F]+$/.test(str)) return "ASCII";
    if (/^[\x00-\xFF]+$/.test(str)) return "Extended ASCII";
    return "Unicode / Binary-like";
  }

  // -------------------------------------------------------------
  // ENTROPY CLASS
  // -------------------------------------------------------------
  entropyClass(entropy) {
    const e = parseFloat(entropy);
    if (e < 3) return "Low";
    if (e < 4) return "Medium";
    return "High";
  }

  // -------------------------------------------------------------
  // SIGNAL STRENGTH
  // -------------------------------------------------------------
  signalStrength(length, entropy) {
    const score = length * 0.2 + parseFloat(entropy) * 4;
    if (score < 20) return "Weak";
    if (score < 40) return "Moderate";
    return "Strong";
  }

  // -------------------------------------------------------------
  // BASIC DECODERS
  // -------------------------------------------------------------
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

  // -------------------------------------------------------------
  // SHA-256 FINGERPRINT (SHORT)
  // -------------------------------------------------------------
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

  // -------------------------------------------------------------
  // SHA-256 FULL
  // -------------------------------------------------------------
  async sha256Full(str) {
    try {
      const buffer = new TextEncoder().encode(str);
      const hash = await crypto.subtle.digest("SHA-256", buffer);
      return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
    } catch {
      return "n/a";
    }
  }

  // -------------------------------------------------------------
  // ROT13
  // -------------------------------------------------------------
  rot13(str) {
    return str.replace(/[A-Za-z]/g, c =>
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".charAt(
        "NOPQRSTUVWXYZABCDEFGHIJKLMnopqrstuvwxyzabcdefghijklm".indexOf(c)
      )
    );
  }

  // -------------------------------------------------------------
  // ALT-BASH DECODE (base64, hex, URL-safe)
  // -------------------------------------------------------------
  altBashDecode(str) {
    try {
      if (/^[A-Za-z0-9+/=]+$/.test(str)) {
        return atob(str);
      }
      if (/^[0-9a-fA-F]+$/.test(str) && str.length % 2 === 0) {
        const bytes = str.match(/.{2}/g).map(h => parseInt(h, 16));
        return String.fromCharCode(...bytes);
      }
      return decodeURIComponent(str);
    } catch {
      return "n/a";
    }
  }

  // -------------------------------------------------------------
  // AZTEC DECODE (stub)
  // -------------------------------------------------------------
  aztecDecode(str) {
    console.warn("Aztec decode requires ZXing or similar. Stub returning n/a.");
    return "n/a";
  }

  // -------------------------------------------------------------
  // MULTI SIGNAL TYPE DETECTION (2+ types)
  // -------------------------------------------------------------
  detectSignalTypes(str) {
    const types = [];

    if (/^QTUM_/.test(str)) types.push("QTUM");
    if (/^0x[a-fA-F0-9]{40}$/.test(str)) types.push("Ethereum");
    if (/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(str)) types.push("Bitcoin");
    if (/^https?:\/\//.test(str)) types.push("URL");
    if (this.tryParseJSON(str)) types.push("JSON");
    if (/^[0-9a-fA-F]+$/.test(str)) types.push("HEX");
    if (/^[A-Za-z0-9+/=]+$/.test(str)) types.push("BASE64");

    return types.length ? types.join(", ") : "None detected";
  }

  // -------------------------------------------------------------
  // SIGNAL LOCATION GUESS
  // -------------------------------------------------------------
  detectSignalLocation(str) {
    const m = str.match(/https?:\/\/([^\/]+)/);
    if (m) return `Web domain: ${m[1]}`;
    if (/^QTUM_/.test(str)) return "QTUM protocol space";
    if (/^0x/.test(str)) return "Ethereum network";
    if (/^[13]/.test(str)) return "Bitcoin network";
    if (this.tryParseJSON(str)) return "JSON API payload";
    return "Unknown / local-only";
  }

  // -------------------------------------------------------------
  // Q-NOTES (auto intelligence)
  // -------------------------------------------------------------
  generateQNotes(str, classification, entropy) {
    const notes = [];

    notes.push(`Signal classified as ${classification}.`);
    notes.push(
      `Entropy suggests ${entropy < 3 ? "simple" : entropy < 4 ? "moderate" : "complex"} structure.`
    );

    if (/QTUM_/.test(str)) notes.push("QTUM signature detected.");
    if (/^0x/.test(str)) notes.push("Ethereum-style address.");
    if (/^[13]/.test(str)) notes.push("Bitcoin-style address.");
    if (this.tryParseJSON(str)) notes.push("JSON payload indicates structured data.");
    if (/https?:\/\//.test(str)) notes.push("Likely web resource or API endpoint.");

    return notes.join(" ");
  }

  // -------------------------------------------------------------
  // ENTROPY
  // -------------------------------------------------------------
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

  // -------------------------------------------------------------
  // JSON CHECK
  // -------------------------------------------------------------
  tryParseJSON(str) {
    if (!str.startsWith("{") && !str.startsWith("[")) return false;
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  }

  // -------------------------------------------------------------
  // LEDGER ENTRY
  // -------------------------------------------------------------
  async addEntry(payload, tag = "SCAN", extraMeta = {}) {
    if (!this.container) return;

    const meta = this.analyzePayload(payload);
    const hash = await meta.hashFingerprint;
    const shaFull = await meta.shaFullPromise;
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

      <span><strong>ROT13:</strong> ${meta.rot13}</span>
      <span><strong>Aztec:</strong> ${meta.aztec}</span>
      <span><strong>AltBash:</strong> ${meta.altbash}</span>
      <span><strong>SHA256 Full:</strong> ${shaFull}</span>
      <span><strong>Signal Types:</strong> ${meta.signalTypes}</span>
      <span><strong>Location:</strong> ${meta.signalLocation}</span>
      <span style="flex:1 1 100%"><strong>Q‑Notes:</strong> ${meta.qNotes}</span>

      ${extraMeta.type ? `<span><strong>QAI:</strong> ${extraMeta.type}</span>` : ""}
      ${extraMeta.pattern ? `<span><strong>Pattern:</strong> ${extraMeta.pattern}</span>` : ""}
      ${extraMeta.explanation ? `<span style="flex:1 1 100%"><strong>Insight:</strong> ${extraMeta.explanation}</span>` : ""}
    `;

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
