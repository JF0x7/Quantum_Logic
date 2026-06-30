// QAI v0.60 — Browser HF (Transformers.js), item guessing, moderation

import { pipeline } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";

class Qai {
  constructor() {
    this.name = "QAI";
    this.version = "0.60-browser-HF";
    this.hfReady = this.initHF();
    this.hfClassifier = null;

    this.vocab = [
      "signal", "payload", "quantum", "resonance", "artifact",
      "ledger", "cipher", "token", "fragment", "pattern"
    ];
  }

  async initHF() {
    try {
      // sentiment-analysis pipeline (HF model in browser)
      this.hfClassifier = await pipeline("sentiment-analysis");
      console.log("QAI: Hugging Face browser pipeline ready.");
    } catch (err) {
      console.error("QAI: HF init failed:", err);
      this.hfClassifier = null;
    }
  }

  // -----------------------------------------------------
  // 🛡️ MODERATION ENGINE
  // -----------------------------------------------------
  moderate(payload) {
    const text = payload.toLowerCase();
    const flags = [];

    if (text.includes("error") || text.includes("fail"))
      flags.push("⚠️ malfunction keyword");

    if (text.length > 800)
      flags.push("📦 oversized payload");

    const symbolRatio = (text.match(/[^a-zA-Z0-9\s]/g) || []).length / text.length;
    if (symbolRatio > 0.25)
      flags.push("🔣 high symbol density");

    const entropy = this._entropy(text);
    if (entropy > 4.5)
      flags.push("🌀 high entropy (possible encryption)");

    const allow = flags.length === 0;

    return {
      allow,
      flags,
      verdict: allow ? "clean" : "flagged",
      entropy
    };
  }

  _entropy(str) {
    const freq = {};
    for (const c of str) freq[c] = (freq[c] || 0) + 1;
    let e = 0;
    const len = str.length;
    for (const c in freq) {
      const p = freq[c] / len;
      e -= p * Math.log2(p);
    }
    return Number(e.toFixed(2));
  }

  // -----------------------------------------------------
  // 🔐 ENCRYPTION PACK
  // -----------------------------------------------------
  encrypt(payload) {
    return {
      base64: btoa(payload),
      rot13: this._rot13(payload),
      hex: this._hex(payload)
    };
  }

  _rot13(str) {
    return str.replace(/[a-zA-Z]/g, c =>
      String.fromCharCode(
        (c <= "Z" ? 90 : 122) >= (c = c.charCodeAt(0) + 13)
          ? c
          : c - 26
      )
    );
  }

  _hex(str) {
    return Array.from(str)
      .map(c => c.charCodeAt(0).toString(16).padStart(2, "0"))
      .join("");
  }

  // -----------------------------------------------------
  // 🔓 DECRYPTION PACK
  // -----------------------------------------------------
  decrypt(payload) {
    const results = {
      base64: null,
      hex: null,
      rot13: null,
      json: null,
      success: false
    };

    try {
      results.base64 = atob(payload);
      results.success = true;
    } catch {}

    try {
      if (/^[0-9a-fA-F]+$/.test(payload)) {
        const bytes = payload.match(/.{1,2}/g).map(b => parseInt(b, 16));
        results.hex = new TextDecoder().decode(new Uint8Array(bytes));
        results.success = true;
      }
    } catch {}

    try {
      results.rot13 = this._rot13(payload);
      results.success = true;
    } catch {}

    try {
      const candidate =
        results.base64 ||
        results.hex ||
        results.rot13 ||
        payload;

      if (candidate.startsWith("{") || candidate.startsWith("[")) {
        results.json = JSON.parse(candidate);
        results.success = true;
      }
    } catch {}

    return results;
  }

  // -----------------------------------------------------
  // 🧩 ITEM TYPE GUESSING
  // -----------------------------------------------------
  guessItemType(payload, decrypted) {
    const text = payload.toLowerCase();
    const decoded =
      (decrypted.json && JSON.stringify(decrypted.json).toLowerCase()) ||
      decrypted.base64?.toLowerCase() ||
      decrypted.hex?.toLowerCase() ||
      decrypted.rot13?.toLowerCase() ||
      "";

    const combined = text + " " + decoded;

    if (combined.match(/\bisbn\b|\b978[-\d]+\b/)) return "book";
    if (combined.match(/\bqtum\b|\btoken\b|\bwallet\b|\bcrypto\b|\bblockchain\b/)) return "crypto";
    if (combined.match(/\bair duster\b|\bcompressed air\b/)) return "air duster";
    if (combined.match(/\bbottle\b|\bml\b|\blitre\b|\bfl oz\b/)) return "bottle";
    if (combined.match(/\bcustom\b|\bgenerated\b|\bartifact\b|\bprototype\b/)) return "custom generated";

    if (/^https?:\/\/[^\s]+$/.test(payload)) return "link / web resource";
    if (payload.length < 12) return "short code / tag";
    if (payload.length > 120) return "long form data";

    return "unknown artifact";
  }

  // -----------------------------------------------------
  // 😎 PERSONALITY ENGINE
  // -----------------------------------------------------
  pickWord() {
    if (!this.vocab.length) return "signal";
    return this.vocab[Math.floor(Math.random() * this.vocab.length)];
  }

  vibe(payload, itemType, moderation) {
    const word = this.pickWord();
    const baseLines = [
      `QAI hums softly… this ${itemType} feels aligned.`,
      `Quantum breeze detected. ${itemType} registered.`,
      `Processing ${itemType} with maximum chill.`,
      `Your ${itemType} ${word} resonates cleanly.`,
      `Signal absorbed. ${itemType} shows no turbulence.`,
      `QAI online. ${itemType} sits steady in the ledger.`,
      `Payload classified as ${itemType}. Vibes stable.`
    ];

    const idx = Math.floor(Math.random() * baseLines.length);
    const extra =
      moderation.flags.length
        ? ` Flags: ${moderation.flags.join(", ")}.`
        : "";

    return baseLines[idx] + extra;
  }

  response(payload, report, itemType) {
    const m = report.moderation;
    if (!m.allow) {
      return `QAI: ${itemType} came in spicy. Verdict: ${m.verdict}. Entropy ${m.entropy}.`;
    }
    return `QAI: ${itemType} scanned clean. Entropy ${m.entropy}. Verdict: ${m.verdict}.`;
  }

  // -----------------------------------------------------
  // 🧠 FULL PIPELINE (HF in browser)
  // -----------------------------------------------------
  async process(payload) {
    await this.hfReady; // wait for HF pipeline

    const moderation = this.moderate(payload);
    const encrypted = this.encrypt(payload);
    const decrypted = this.decrypt(payload);
    const itemType = this.guessItemType(payload, decrypted);

    let hf = null;
    if (this.hfClassifier) {
      try {
        const out = await this.hfClassifier(payload);
        const r = out[0];
        hf = {
          label: r.label,
          score: r.score
        };
      } catch (err) {
        console.error("QAI HF classify error:", err);
      }
    }

    const vibe = this.vibe(payload, itemType, moderation);
    const response = hf
      ? `QAI (HF browser): ${hf.label} (${hf.score.toFixed(3)}).`
      : this.response(payload, { moderation }, itemType);

    return {
      original: payload,
      moderation,
      encrypted,
      decrypted,
      itemType,
      hf,
      vibe,
      response
    };
  }
}

window.Qai = Qai;
