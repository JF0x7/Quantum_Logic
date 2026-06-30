// QAI v0.31 — Internet-enabled moderator / decryptor / encryptor / personality engine
class Qai {
  constructor() {
    this.name = "QAI";
    this.version = "0.30";
  }

  // -----------------------------------------------------
  // 🌐 INTERNET ACCESS (fetch wrapper)
  // -----------------------------------------------------
  async fetchURL(url) {
    try {
      const res = await fetch(url);
      const text = await res.text();
      return {
        ok: true,
        status: res.status,
        content: text
      };
    } catch (err) {
      return {
        ok: false,
        error: err.message
      };
    }
  }

  async fetchJSON(url) {
    try {
      const res = await fetch(url);
      const json = await res.json();
      return {
        ok: true,
        status: res.status,
        json
      };
    } catch (err) {
      return {
        ok: false,
        error: err.message
      };
    }
  }

  async search(query) {
    const encoded = encodeURIComponent(query);
    const url = `https://api.duckduckgo.com/?q=${encoded}&format=json&no_redirect=1`;

    try {
      const res = await fetch(url);
      const json = await res.json();

      return {
        ok: true,
        query,
        abstract: json.Abstract || null,
        heading: json.Heading || null,
        related: json.RelatedTopics || []
      };
    } catch (err) {
      return {
        ok: false,
        error: err.message
      };
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
  // 😎 PERSONALITY ENGINE (vibe + response)
  // -----------------------------------------------------
  vibe(payload) {
    const lines = [
      "QAI hums softly… this one feels good.",
      "Quantum breeze detected. Payload feels smooth.",
      "Processing with maximum chill.",
      "Your scan energy is immaculate.",
      "Signal absorbed. No turbulence.",
      "QAI online. Vibes stable.",
      "Payload resonates with cosmic harmony."
    ];

    const pick = lines[Math.floor(Math.random() * lines.length)];
    return `${pick} → "${payload}"`;
  }

  response(payload, report) {
    if (!report.moderation.allow) {
      return `QAI: That one felt spicy… I flagged it for safety.`;
    }
    return `QAI: Clean scan. Entropy ${report.moderation.entropy}. Smooth signal.`;
  }

  // -----------------------------------------------------
  // 🧠 FULL PIPELINE (async)
  // -----------------------------------------------------
  async process(payload) {
    const moderation = this.moderate(payload);
    const encrypted = this.encrypt(payload);
    const decrypted = this.decrypt(payload);

    let web = null;
    if (payload.startsWith("http")) {
      web = await this.fetchURL(payload);
    }

    return {
      original: payload,
      moderation,
      encrypted,
      decrypted,
      web,
      vibe: this.vibe(payload),
      response: this.response(payload, { moderation })
    };
  }
}

window.Qai = Qai;
