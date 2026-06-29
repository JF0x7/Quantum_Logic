// Qai - QTUM(LOG) AI Moderator / Encryptor / Decryptor / Chill Buddy
class Qai {
  constructor() {
    this.name = "QAI";
  }

  // -----------------------------
  // MODERATION ENGINE
  // -----------------------------
  moderate(payload) {
    const text = payload.toLowerCase();

    const flags = [];

    if (text.includes("error") || text.includes("fail"))
      flags.push("⚠️ possible malfunction");

    if (text.length > 500)
      flags.push("📦 oversized payload");

    if (/[^a-zA-Z0-9\s]/.test(text))
      flags.push("🔣 contains symbols");

    const allow = flags.length === 0;

    return {
      allow,
      flags,
      verdict: allow ? "clean" : "flagged"
    };
  }

  // -----------------------------
  // ENCRYPTION (simple reversible)
  // -----------------------------
  encrypt(payload) {
    return btoa(payload); // base64 encode
  }

  // -----------------------------
  // DECRYPTION
  // -----------------------------
  decrypt(payload) {
    try {
      return atob(payload); // base64 decode
    } catch {
      return null;
    }
  }

  // -----------------------------
  // CHILL BUDDY RESPONSES
  // -----------------------------
  vibe(payload) {
    const lines = [
      "QAI online. Vibes stable.",
      "Signal received. Processing with chill.",
      "Payload noted. No stress detected.",
      "Quantum winds feel good today.",
      "Your scan energy is immaculate."
    ];

    const pick = lines[Math.floor(Math.random() * lines.length)];

    return `${pick} → "${payload}"`;
  }

  // -----------------------------
  // FULL PIPELINE
  // -----------------------------
  process(payload) {
    const mod = this.moderate(payload);
    const enc = this.encrypt(payload);

    return {
      original: payload,
      moderation: mod,
      encrypted: enc,
      vibe: this.vibe(payload)
    };
  }
}

// expose globally
window.Qai = Qai;
