// QAI v0.70 — Browser HF (Transformers.js) + Memory Mode

import { pipeline } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";

class Qai {
  constructor() {
    this.name = "QAI";
    this.version = "0.70-memory-mode";

    this.hfReady = this.initHF();
    this.hfClassifier = null;
    this.hfEmbedder = null;

    this.memory = []; // persistent memory of scans

    this.vocab = [
      "signal", "payload", "quantum", "resonance", "artifact",
      "ledger", "cipher", "token", "fragment", "pattern"
    ];
  }

  async initHF() {
    try {
      this.hfClassifier = await pipeline("sentiment-analysis");
      this.hfEmbedder = await pipeline("feature-extraction");
      console.log("QAI: HF sentiment + embeddings ready (browser).");
    } catch (err) {
      console.error("QAI: HF init failed:", err);
      this.hfClassifier = null;
      this.hfEmbedder = null;
    }
  }

  // -----------------------------------------------------
  // 🛡️ MODERATION
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
  // 🔐 ENCRYPT / DECRYPT
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
  // 🧩 ITEM TYPE GUESS
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
  // 😎 PERSONALITY
  // -----------------------------------------------------
  pickWord() {
    if (!this.vocab.length) return "signal";
    return this.vocab[Math.floor(Math.random() * this.vocab.length)];
  }

  vibe(payload, itemType, moderation, memoryNote) {
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

    return baseLines[idx] + extra + ` Memory: ${memoryNote}`;
  }

  response(payload, report, itemType, hf, memoryNote) {
    const m = report.moderation;
    if (hf) {
      return `QAI (HF): ${hf.label} (${hf.score.toFixed(3)}). Memory: ${memoryNote}`;
    }
    if (!m.allow) {
      return `QAI: ${itemType} came in spicy. Verdict: ${m.verdict}. Entropy ${m.entropy}. Memory: ${memoryNote}`;
    }
    return `QAI: ${itemType} scanned clean. Entropy ${m.entropy}. Verdict: ${m.verdict}. Memory: ${memoryNote}`;
  }

  // -----------------------------------------------------
  // 🧠 HF SENTIMENT + EMBEDDINGS
  // -----------------------------------------------------
  async classifyHF(text) {
    if (!this.hfClassifier) return null;
    try {
      const out = await this.hfClassifier(text);
      const r = out[0];
      return { label: r.label, score: r.score };
    } catch (err) {
      console.error("QAI HF classify error:", err);
      return null;
    }
  }

  async embed(text) {
    if (!this.hfEmbedder) return null;
    try {
      const out = await this.hfEmbedder(text);
      return out[0]; // embedding vector
    } catch (err) {
      console.error("QAI embed error:", err);
      return null;
    }
  }

  // -----------------------------------------------------
  // 🧠 MEMORY MODE
  // -----------------------------------------------------
  storeMemory(payload, itemType, embedding) {
    if (!embedding) return;
    this.memory.push({
      payload,
      itemType,
      embedding,
      time: Date.now()
    });
  }

  cosine(a, b) {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  }

  findSimilar(embedding) {
    if (!embedding || this.memory.length === 0) return null;

    let best = null;
    let bestScore = -1;

    for (const m of this.memory) {
      const score = this.cosine(embedding, m.embedding);
      if (score > bestScore) {
        bestScore = score;
        best = m;
      }
    }

    return { best, score: bestScore };
  }

  // -----------------------------------------------------
  // 🧠 FULL PIPELINE
  // -----------------------------------------------------
  async process(payload) {
    await this.hfReady;

    const moderation = this.moderate(payload);
    const encrypted = this.encrypt(payload);
    const decrypted = this.decrypt(payload);
    const itemType = this.guessItemType(payload, decrypted);

    const hf = await this.classifyHF(payload);
    const embedding = await this.embed(payload);
    const similar = this.findSimilar(embedding);

    let memoryNote = "No prior memory.";
    if (similar && similar.score > 0.80) {
      memoryNote = `Similar to previous ${similar.best.itemType} (score ${similar.score.toFixed(2)}).`;
    } else if (similar) {
      memoryNote = `Weak similarity to ${similar.best.itemType} (score ${similar.score.toFixed(2)}).`;
    } else if (this.memory.length === 0) {
      memoryNote = "First artifact of its kind.";
    }

    this.storeMemory(payload, itemType, embedding);

    const vibe = this.vibe(payload, itemType, moderation, memoryNote);
    const response = this.response(payload, { moderation }, itemType, hf, memoryNote);

    return {
      original: payload,
      moderation,
      encrypted,
      decrypted,
      itemType,
      hf,
      embedding,
      memoryNote,
      vibe,
      response
    };
  }
}

window.Qai = Qai;
