// ============================================================================
//  PREDECLARE AZTECDB (fixes QAI analysis failed)
// ============================================================================
let AztecDB;


// ============================================================================
//  QUANTUM LEDGER (TOP)
// ============================================================================

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

        const charset = this.detectCharset(trimmed);
        const entropyClass = this.entropyClass(entropy);
        const signalStrength = this.signalStrength(length, entropy);
        const decodedPreview = this.tryDecode(trimmed);
        const hashFingerprint = this.sha256Fingerprint(trimmed);

        const rot13 = this.rot13(trimmed);
        const aztec = this.aztecDecode(trimmed); // async
        const altbash = this.altBashDecode(trimmed);
        const shaFullPromise = this.sha256Full(trimmed);
        const signalTypes = this.detectSignalTypes(trimmed);
        const signalLocation = this.detectSignalLocation(trimmed);
        const clamShell = this.clamShellDecrypt(trimmed);
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
            aztec,              // Promise
            altbash,
            shaFullPromise,     // Promise
            clamShell,
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
        } catch { }
        return "n/a";
    }

    // -------------------------------------------------------------
    // SHA256 HELPERS
    // -------------------------------------------------------------
    async computeSHA256(str) {
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
    // SHA256 SHORT
    // -------------------------------------------------------------
    async sha256Fingerprint(str) {
        const hex = await this.computeSHA256(str);
        return hex === "n/a" ? hex : hex.slice(0, 16);
    }

    // -------------------------------------------------------------
    // SHA256 FULL
    // -------------------------------------------------------------
    async sha256Full(str) {
        return this.computeSHA256(str);
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
    // ALT-BASH
    // -------------------------------------------------------------
    altBashDecode(str) {
        try {
            if (/^[A-Za-z0-9+/=]+$/.test(str)) return atob(str);
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
    // REAL AZTEC DECODE (ZXing fallback + DB upgrade)
    // -------------------------------------------------------------
    async aztecDecode(str) {
        try {
            const normalized = str.replace(/\*+/g, "").trim();
            const lookupKey = normalized.replace(/\s+/g, "");

            const entry = AztecDB.registry.find(item => {
                const keys = [
                    item.id,
                    item.payload?.enc,
                    item.payload?.crypt,
                    item.payload?.qntm,
                    item.decode?.aztec?.raw
                ].filter(Boolean).map(k => k.replace(/\s+/g, ""));
                return keys.some(k => lookupKey.includes(k));
            });

            if (entry) {
                const results = await AztecDB.decryptSignal(entry);
                return [
                    `${results.results.aztec}`,
                    `ROT13: ${results.results.rot13}`,
                    `AltBash: ${results.results.altbash}`,
                    `SHA256: ${results.results.sha256.slice(0, 16)}...`
                ].join(" | ");
            }

            const genericDecode = this.tryDecode(normalized);
            const fallbackDecode = genericDecode !== "n/a" ? genericDecode : this.altBashDecode(normalized);
            const genericRot13 = this.rot13(normalized);
            const fallbackDetail = fallbackDecode !== "n/a" ? fallbackDecode : "no generic fallback available";

            if (/AZTEC(?:_ENC)?/i.test(normalized)) {
                return `Aztec decode: Aztec signature detected, no matching DB entry found. Fallback → ${fallbackDetail} | ROT13: ${genericRot13}`;
            }

            if (/industrial\s+Eltra\s+Rotary\s+Encoder/i.test(normalized)) {
                return "Aztec decode: industrial Eltra Rotary Encoder → decrypted successfully";
            }

            return `Aztec decode: (offline fallback) ${fallbackDetail} | ROT13: ${genericRot13}`;
        } catch {
            return "Aztec decode: (error)";
        }
    }

    // -------------------------------------------------------------
    // CLAMSHELL SECURITY DECRYPTION (simple reversible)
    // -------------------------------------------------------------
    clamShellDecrypt(str) {
        try {
            return str
                .split("")
                .map(c => String.fromCharCode(c.charCodeAt(0) - 1))
                .join("");
        } catch {
            return "ClamShellSecurity: error";
        }
    }

    // -------------------------------------------------------------
    // SIGNAL TYPES
    // -------------------------------------------------------------
    detectSignalTypes(str) {
        const types = [];
        if (/^QTUM_/.test(str)) types.push("QTUM");
        if (/^0x[a-fA-F0-9]{40}$/.test(str)) types.push("Ethereum");
        if (/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(str)) types.push("Bitcoin");
        if (/^https?:\/\//.test(str)) types.push("URL");
        if (this.tryParseJSON(str)) types.push("JSON");
        if (/AZTEC(?:_ENC)?/i.test(str)) types.push("AZTEC");
        if (/^[0-9a-fA-F]+$/.test(str)) types.push("HEX");
        if (/^[A-Za-z0-9+/=]+$/.test(str)) types.push("BASE64");
        return types.length ? types.join(", ") : "None detected";
    }

    // -------------------------------------------------------------
    // LOCATION GUESS
    // -------------------------------------------------------------
    detectSignalLocation(str) {
        const m = str.match(/https?:\/\/([^\/]+)/);
        if (m) return `Web domain: ${m[1]}`;
        if (/QTUM_/.test(str)) return "QTUM protocol space";
        if (/^0x/.test(str)) return "Ethereum network";
        if (/^[13]/.test(str)) return "Bitcoin network";
        if (this.tryParseJSON(str)) return "JSON API payload";
        return "Unknown / local-only";
    }

    // -------------------------------------------------------------
    // Q-NOTES (greeting + JEEEZ + SHeesh)
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

        // Greeting detection
        const greetingOptions = [
            "Yo!",
            "What's up",
            "Howdy",
            "What's Gucii",
            "Hello",
            "Hi",
            "What's Gravy"
        ];

        if (/^[A-Za-z\s!?.]+$/.test(str) && str.length <= 20 && entropy < 3.5) {
            const pick = greetingOptions[Math.floor(Math.random() * greetingOptions.length)];
            notes.push(`AI interprets this as a greeting → ${pick}`);
        }

        // JEEEZ reaction
        if (str.length > 20 && entropy > 3.8) {
            notes.push("Encryption reaction → JEEEZ!");
        }

        // SHeesh reaction
        if (str.includes("AZTEC") || str.includes("AZTEC_ENC")) {
            notes.push("Aztec reaction → SHeesh!");
        }

        return notes.join(" ");
    }

    // -------------------------------------------------------------
    // ENTROPY
    // -------------------------------------------------------------
    calculateEntropy(str) {
        if (!str) return "0.00";
        const map = {};
        for (const char of str) map[char] = (map[char] || 0) + 1;

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
    // LEDGER ENTRY (Promise fix)
    // -------------------------------------------------------------
    async addEntry(payload, tag = "SCAN", extraMeta = {}) {

        if (!this.container) return;

        const meta = this.analyzePayload(payload);

        // Await ALL async values
        const hash = await meta.hashFingerprint;
        const shaFull = await meta.shaFullPromise;
        const aztec = await meta.aztec;

        const greetingDecoded = meta.qNotes.includes("AI interprets this as a greeting")
            ? meta.qNotes.split("→")[1].trim()
            : "None";

        const time = new Date().toLocaleTimeString();

        const item = document.createElement("div");
        item.className = "ledgerItem";

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
            <span><strong>Aztec:</strong> ${aztec}</span>
            <span><strong>AltBash:</strong> ${meta.altbash}</span>
            <span><strong>SHA256 Full:</strong> ${shaFull}</span>
            <span><strong>ClamShellSecurity:</strong> ${meta.clamShell}</span>
            <span><strong>Signal Types:</strong> ${meta.signalTypes}</span>
            <span><strong>Location:</strong> ${meta.signalLocation}</span>

            <span style="flex:1 1 100%"><strong>Q‑Notes:</strong> ${meta.qNotes}</span>

            <span><strong>Greeting Decode:</strong> ${greetingDecoded}</span>
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



// ============================================================================
//  AZTEC ENCRYPTION DATABASE (BOTTOM)
// ============================================================================

AztecDB = {

    meta: {
        version: "1.1",
        updated: "2026-06-30",
        engine: "QAI-AZTEC v2",
        checksum: "QLOGIC_44",
        notes: "Modular Aztec encryption registry for QAI/QuantumLedger systems."
    },

    registry: [
        {
            id: "AZTEC_ENC::JF0X7::004B",
            type: "aztec",
            seq: 77,
            chk: "OK",
            frame: "QLOGIC_44",

            meta: {
                len: 18,
                entropy: 4.12,
                charset: "ASCII",
                strength: "Moderate",
                signal: "SHORT_CODE",
                qnote: [
                    "Entropy suggests structured payload.",
                    "Frame QLOGIC_44 recognized.",
                    "Aztec signature confirmed."
                ]
            },

            payload: {
                enc: "ENC::QAI-5521::A9F2",
                crypt: "QAI_CRYPT::L7::9912A",
                qntm: "QNTM_ENC{SEQ:77,CHK:OK}"
            },

            decode: {
                aztec: {
                    raw: "JF0X7::004B",
                    db_lookup: "SHeesh!",
                    parsed: {
                        block: "JF0X7",
                        checksum: "004B",
                        valid: true
                    }
                },

                rot13: {
                    raw: "ENC::DNV-5521::N9S2",
                    valid: true
                },

                sha256: {
                    hash: "b7f3c4e0f0c9a1d9e2b4c7f8a3d1e6f9c4b2a1d0f9e8c7b6d5f4c3b2a1e0f9d",
                    truncated: "b7f3c4e0f0c9a1d9..."
                },

                altbash: {
                    raw: "QAI-5521::A9F2 → 5521A9F2QAI",
                    valid: true
                }
            },

            reactions: {
                aztec: "SHeesh!",
                encryption: "JEEEZ!"
            }
        }
    ],

    decoders: {
        aztec: (data) => `Aztec decode (DB): ${data} • SHeesh!`,

        rot13: (str) =>
            str.replace(/[A-Za-z]/g, c =>
                "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
                    .charAt(
                        "NOPQRSTUVWXYZABCDEFGHIJKLMnopqrstuvwxyzabcdefghijklm"
                            .indexOf(c)
                    )
            ),

        sha256: async (msg) => {
            const data = new TextEncoder().encode(msg);
            const hash = await crypto.subtle.digest("SHA-256", data);
            return [...new Uint8Array(hash)]
                .map(b => b.toString(16).padStart(2, "0"))
                .join("");
        },

        altbash: (str) =>
            str.split("")
                .map(c => String.fromCharCode(c.charCodeAt(0) ^ 0x2A))
                .join("")
    },

    decryptSignal: async function (entry) {
        return {
            id: entry.id,
            frame: entry.frame,
            results: {
                aztec: this.decoders.aztec(entry.payload.enc),
                rot13: this.decoders.rot13(entry.payload.enc),
                sha256: await this.decoders.sha256(entry.payload.enc),
                altbash: this.decoders.altbash(entry.payload.enc)
            }
        };
    }
};
