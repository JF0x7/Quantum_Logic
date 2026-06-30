// Ledger v4.0 — QAI Memory-Aware, HF-Enhanced, Vision-Friendly

class QuantumLedger {
  constructor(containerId = "ledger") {
    this.container = document.getElementById(containerId);
    if (!this.container) console.warn(`Ledger container #${containerId} not found.`);
  }

  // -----------------------------------------------------
  // 🔍 PAYLOAD ANALYSIS
  // -----------------------------------------------------
  analyzePayload(payload) {
    const trimmed = (payload || "").trim();
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
    else if (length < 8 && length > 0) classification = "SHORT CODE";
    else if (length > 80) classification = "LONG FORM DATA";
    else if (length === 0) classification = "EMPTY";

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
  // 🔐 MULTI-LAYER DECRYPTION
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

    // Base64
    try {
      results.base64 = atob(payload);
      results.success = true;
    } catch {}

    // Hex
    try {
      if (/^[0-9a-fA-F]+$/.test(payload)) {
        const bytes = payload.match(/.{1,2}/g).map(b => parseInt(b, 16));
        results.hex = new TextDecoder().decode(new Uint8Array(bytes));
        results.success = true;
      }
    } catch {}

    // ROT13
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

    // JSON
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

    // URL
    try {
      if (/^https?:\/\/[^\s]+$/i.test(payload)) {
        results.url = payload;
        results.success = true;
      }
    } catch {}

    return results;
  }

  // -----------------------------------------------------
  // 🧾 SINGLE ENTRY PER SCAN (QAI + Vision aware)
  // -----------------------------------------------------
  addEntry(payload, tag = "SCAN", qaiReport = null) {
    if (!this.container) return;

    const meta = this.analyzePayload(payload || "");
    const decrypt = this.decryptPayload(payload || "");
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

    item.appendChild(payloadEl);
    item.appendChild(metaEl);

    // Decoded preview
    if (decrypt.success) {
      const previewEl = document.createElement("div");
      previewEl.className = "ledger-meta";

      const preview =
        decrypt.json ? JSON.stringify(decrypt.json).slice(0, 160) :
        decrypt.base64 ? decrypt.base64.slice(0, 160) :
        decrypt.hex ? decrypt.hex.slice(0, 160) :
        decrypt.rot13 ? decrypt.rot13.slice(0, 160) :
        decrypt.url ? decrypt.url :
        "unknown";

      previewEl.innerHTML =
        `<span><strong>Decoded Preview:</strong> ${preview}</span>`;
      item.appendChild(previewEl);
    }

    // -----------------------------------------------------
    // ⭐ QAI REPORT BLOCK (memory + HF + vision)
    // -----------------------------------------------------
    if (qaiReport) {
      const qMeta = document.createElement("div");
      qMeta.className = "ledger-meta";

      const m = qaiReport.moderation || { verdict: "unknown", entropy: "0.00", flags: [] };
      const itemType = qaiReport.itemType || "unknown artifact";
      const vibe = qaiReport.vibe || "";
      const response = qaiReport.response || "";
      const memoryNote = qaiReport.memoryNote || "No memory.";
      const hf = qaiReport.hf || null;
      const vision = qaiReport.vision || null;

      let html = "";

      html += `<span><strong>QAI Item Guess:</strong> ${itemType}</span>`;
      html += `<span><strong>QAI Verdict:</strong> ${m.verdict} (entropy ${m.entropy})</span>`;

      if (m.flags && m.flags.length) {
        html += `<span><strong>QAI Flags:</strong> ${m.flags.join(", ")}</span>`;
      }

      if (hf) {
        html += `<span><strong>HF Sentiment:</strong> ${hf.label} (${hf.score.toFixed(3)})</span>`;
      }

      html += `<span><strong>QAI Memory:</strong> ${memoryNote}</span>`;

      if (vision && vision.classification) {
        const top = vision.classification;
        html += `<span><strong>Vision Class:</strong> ${top.label} (${top.score.toFixed(3)})</span>`;
      }

      if (vibe) {
        html += `<span><strong>QAI Vibe:</strong> ${vibe}</span>`;
      }

      if (response) {
        html += `<span><strong>QAI Response:</strong> ${response}</span>`;
      }

      qMeta.innerHTML = html;
      item.dataset.classification = "qai-annotated";
      item.appendChild(qMeta);
    }

    // Footer
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
