// ============================================================================
//  SAFARI / iPHONE 6 COMPATIBILITY HELPERS
// ============================================================================

// Safe TextEncoder fallback
function safeEncode(str) {
    try {
        if (window.TextEncoder) return new TextEncoder().encode(str);
        // Fallback: manual UTF‑8 encoding
        const utf8 = [];
        for (let i = 0; i < str.length; i++) {
            let c = str.charCodeAt(i);
            if (c < 128) utf8.push(c);
            else if (c < 2048) {
                utf8.push((c >> 6) | 192);
                utf8.push((c & 63) | 128);
            } else {
                utf8.push((c >> 12) | 224);
                utf8.push(((c >> 6) & 63) | 128);
                utf8.push((c & 63) | 128);
            }
        }
        return new Uint8Array(utf8);
    } catch (_) {
        return new Uint8Array([]);
    }
}

// Safe SHA‑256 fallback for iOS 12
async function safeSHA256(str) {
    try {
        const data = safeEncode(str);
        if (crypto.subtle && crypto.subtle.digest) {
            const hash = await crypto.subtle.digest("SHA-256", data);
            return [...new Uint8Array(hash)]
                .map(b => b.toString(16).padStart(2, "0"))
                .join("");
        }
    } catch (_) {}

    // Fallback: lightweight JS SHA‑256 (iPhone 6 safe)
    return sha256Fallback(str);
}

// Minimal SHA‑256 fallback (iPhone 6 safe)
function sha256Fallback(ascii) {
    // Tiny SHA‑256 implementation (safe for old Safari)
    function rightRotate(value, amount) {
        return (value >>> amount) | (value << (32 - amount));
    }

    const mathPow = Math.pow;
    const maxWord = mathPow(2, 32);
    let result = "";

    const words = [];
    const asciiBitLength = ascii.length * 8;

    const hash = sha256Fallback.h = sha256Fallback.h || [];
    const k = sha256Fallback.k = sha256Fallback.k || [];
    let primeCounter = k.length;

    const isPrime = n => {
        const sqrtN = Math.sqrt(n);
        for (let i = 2; i <= sqrtN; i++) if (n % i === 0) return false;
        return true;
    };

    while (primeCounter < 64) {
        let candidate = primeCounter + 2;
        while (!isPrime(candidate)) candidate++;
        hash[primeCounter] = (candidate ** 0.5 * maxWord) | 0;
        k[primeCounter] = (candidate ** (1 / 3) * maxWord) | 0;
        primeCounter++;
    }

    ascii += "\x80";
    while ((ascii.length % 64) !== 56) ascii += "\x00";

    for (let i = 0; i < ascii.length; i++) {
        words[i >> 2] |= ascii.charCodeAt(i) << ((3 - (i % 4)) * 8);
    }

    words.push((asciiBitLength / maxWord) | 0);
    words.push(asciiBitLength | 0);

    for (let j = 0; j < words.length; ) {
        const w = words.slice(j, j += 16);
        const oldHash = hash.slice(0);

        for (let i = 16; i < 64; i++) {
            const a = w[i - 15];
            const b = w[i - 2];
            w[i] = (((rightRotate(a, 7) ^ rightRotate(a, 18) ^ (a >>> 3)) +
                w[i - 7] +
                (rightRotate(b, 17) ^ rightRotate(b, 19) ^ (b >>> 10))) |
                0);
        }

        let [a, b, c, d, e, f, g, h] = oldHash;

        for (let i = 0; i < 64; i++) {
            const t1 =
                h +
                (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
                ((e & f) ^ (~e & g)) +
                k[i] +
                w[i];

            const t2 =
                (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
                ((a & b) ^ (a & c) ^ (b & c));

            h = g;
            g = f;
            f = e;
            e = (d + t1) | 0;
            d = c;
            c = b;
            b = a;
            a = (t1 + t2) | 0;
        }

        hash[0] = (hash[0] + a) | 0;
        hash[1] = (hash[1] + b) | 0;
        hash[2] = (hash[2] + c) | 0;
        hash[3] = (hash[3] + d) | 0;
        hash[4] = (hash[4] + e) | 0;
        hash[5] = (hash[5] + f) | 0;
        hash[6] = (hash[6] + g) | 0;
        hash[7] = (hash[7] + h) | 0;
    }

    for (let i = 0; i < hash.length; i++) {
        result += (hash[i] >>> 0).toString(16).padStart(8, "0");
    }

    return result;
}

// ============================================================================
//  QUANTUM LEDGER (iPhone 6 optimized)
// ============================================================================

class QuantumLedger {

    constructor(containerId) {
        this.container = document.getElementById(containerId);
    }

    analyzePayload(payload) {
        const trimmed = payload.trim();
        const length = trimmed.length;
        const entropy = this.calculateEntropy(trimmed);

        const isURL = /^https?:\/\/[^\s]+$/i.test(trimmed);
        const isJSON = this.tryParseJSON(trimmed);
        const isHex = /^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0;

        let classification = "UNKNOWN SIGNAL";
        if (isURL) classification = "URL";
        else if (isJSON) classification = "JSON OBJECT";
        else if (isHex) classification = "HEX STRING";

        const charset = this.detectCharset(trimmed);
        const entropyClass = this.entropyClass(entropy);
        const signalStrength = this.signalStrength(length, entropy);

        const decodedPreview = this.tryDecode(trimmed);

        return {
            length,
            entropy,
            classification,
            charset,
            entropyClass,
            signalStrength,
            decodedPreview
        };
    }

    detectCharset(str) {
        if (/^[\x00-\x7F]+$/.test(str)) return "ASCII";
        return "Unicode / Extended";
    }

    entropyClass(e) {
        e = parseFloat(e);
        if (e < 3) return "Low";
        if (e < 4) return "Medium";
        return "High";
    }

    signalStrength(length, entropy) {
        const score = length * 0.2 + entropy * 4;
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
        } catch (_) {}
        return "n/a";
    }

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

    tryParseJSON(str) {
        if (!str.startsWith("{") && !str.startsWith("[")) return false;
        try {
            JSON.parse(str);
            return true;
        } catch {
            return false;
        }
    }

    async addEntry(payload, tag = "SCAN") {
        if (!this.container) return;

        const meta = this.analyzePayload(payload);

        const hash = await safeSHA256(payload);
        const shaFull = await safeSHA256(payload);

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
            <span><strong>Fingerprint:</strong> ${hash.slice(0, 16)}</span>
            <span><strong>SHA256 Full:</strong> ${shaFull}</span>
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
//  AZTEC DB (iPhone 6 safe)
// ============================================================================

const AztecDB = {
    meta: {
        version: "1.1",
        updated: "2026-07-02",
        engine: "QAI-AZTEC-DDN",
        checksum: "QLOGIC_44"
    },

    registry: [
        {
            id: "AZTEC_ENC::JF0X7::004B",
            type: "aztec",
            seq: 77,
            chk: "OK",
            frame: "QLOGIC_44",
            payload: {
                enc: "ENC::QAI-5521::A9F2",
                ddn: "DDN_ENC::A9F2::XOR5A_REV_CAESAR",
                morse: "- .... .- -. -.- ... / -.-. --- -- .. -. --."
            }
        }
    ],

    decoders: {
        aztec: data => `Aztec decode (DB): ${data} • SHeesh!`,

        ddn: str => {
            try {
                let r = str.split("").map(c => String.fromCharCode(c.charCodeAt(0) ^ 0x5A)).join("");
                r = r.split("").reverse().join("");
                return r.replace(/DDN_ENC::/g, "").replace(/::DDN_END/g, "");
            } catch (_) {
                return "DDN decrypt error";
            }
        },

        morse: str => {
            const map = {
                ".-": "A", "-...": "B", "-.-.": "C", "-..": "D", ".": "E",
                "..-.": "F", "--.": "G", "....": "H", "..": "I", ".---": "J",
                "-.-": "K", ".-..": "L", "--": "M", "-.": "N", "---": "O",
                ".--.": "P", "--.-": "Q", ".-.": "R", "...": "S", "-": "T",
                "..-": "U", "...-": "V", ".--": "W", "-..-": "X", "-.--": "Y",
                "--..": "Z"
            };

            try {
                return str
                    .trim()
                    .split("/")
                    .map(w => w.trim().split(/\s+/).map(l => map[l] || "?").join(""))
                    .join(" ");
            } catch (_) {
                return "Morse decode error";
            }
        }
    }
};
