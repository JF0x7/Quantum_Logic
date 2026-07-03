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
        const isMorse = /^[.\-/\s]+$/.test(trimmed) && /[.\-]/.test(trimmed);

        let classification = "UNKNOWN SIGNAL";
        if (isURL) classification = "URL";
        else if (isJSON) classification = "JSON OBJECT";
        else if (isHex) classification = "HEX STRING";
        else if (isBase64) classification = "BASE64 ENCODED";
        else if (isMorse) classification = "MORSE CODE";
        else if (length < 8) classification = "SHORT CODE";
        else if (length > 80) classification = "LONG FORM DATA";

        const charset = this.detectCharset(trimmed);
        const entropyClass = this.entropyClass(entropy);
        const signalStrength = this.signalStrength(length, entropy);
        const decodedPreview = this.tryDecode(trimmed);
        const hashFingerprint = this.sha256Fingerprint(trimmed);

        const rot13 = this.rot13(trimmed);
        const aztec = this.aztecDecode(trimmed);
        const altbash = this.altBashDecode(trimmed);
        const shaFullPromise = this.sha256Full(trimmed);
        const signalTypes = this.detectSignalTypes(trimmed);
        const signalLocation = this.detectSignalLocation(trimmed);
        const clamShell = this.clamShellDecrypt(trimmed);
        const ddnDecrypt = this.ddnDecrypt(trimmed);
        const morseDecode = this.morseDecode(trimmed);
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
            clamShell,
            ddnDecrypt,
            morseDecode,
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
            if (/^[.\-/\s]+$/.test(str)) {
                return this.morseDecode(str).slice(0, 60);
            }
        } catch {}
        return "n/a";
    }

    // -------------------------------------------------------------
    // SHA256 SHORT
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
    // SHA256 FULL
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
    // REAL AZTEC DECODE (ZXing fallback)
    // -------------------------------------------------------------
    async aztecDecode(str) {
        try {
            return " (offline fallback) SHeesh!";
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
    // DDN (DYNAMIC DATA NETWORK) DECRYPTION
    // Advanced version of Clam Shell with multi-layer transformation
    // -------------------------------------------------------------
    ddnDecrypt(str) {
        try {
            let result = str;
            
            // Layer 1: XOR with 0x5A (dynamic key)
            result = result
                .split("")
                .map(c => String.fromCharCode(c.charCodeAt(0) ^ 0x5A))
                .join("");
            
            // Layer 2: Reverse string
            result = result.split("").reverse().join("");
            
            // Layer 3: Caesar shift with variable offset based on length
            const offset = (str.length % 5) + 1;
            result = result
                .split("")
                .map(c => {
                    const code = c.charCodeAt(0);
                    if (code >= 65 && code <= 90) {
                        return String.fromCharCode(((code - 65 - offset + 26) % 26) + 65);
                    } else if (code >= 97 && code <= 122) {
                        return String.fromCharCode(((code - 97 - offset + 26) % 26) + 97);
                    }
                    return c;
                })
                .join("");
            
            // Layer 4: Base64-like decode if applicable
            if (/^[A-Za-z0-9+/=]+$/.test(result)) {
                try {
                    result = atob(result);
                } catch (_) {}
            }
            
            // Layer 5: Remove DDN markers
            result = result.replace(/DDN_ENC::/g, "").replace(/::DDN_END/g, "");
            
            return result || "DDN decrypt: empty result";
        } catch (e) {
            return `DDN decrypt: error - ${e.message}`;
        }
    }

    // -------------------------------------------------------------
    // UPGRADED MORSE CODE DECODER (Handles variable token spaces)
    // -------------------------------------------------------------
    morseDecode(str) {
        try {
            const morseMap = {
                '.-': 'A', '-...': 'B', '-.-.': 'C', '-..': 'D', '.': 'E',
                '..-.': 'F', '--.': 'G', '....': 'H', '..': 'I', '.---': 'J',
                '-.-': 'K', '.-..': 'L', '--': 'M', '-.': 'N', '---': 'O',
                '.--.': 'P', '--.-': 'Q', '.-.': 'R', '...': 'S', '-': 'T',
                '..-': 'U', '...-': 'V', '.--': 'W', '-..-': 'X', '-.--': 'Y',
                '--..': 'Z',
                '-----': '0', '.----': '1', '..---': '2', '...--': '3',
                '....-': '4', '.....': '5', '-....': '6', '--...': '7',
                '---..': '8', '----.': '9',
                '.-.-.-': '.', '--..--': ',', '..--..': '?', '.----.': "'",
                '-.-.--': '!', '-..-.': '/', '-.--.': '(', '-.--.-': ')',
                '.-...': '&', '---...': ':', '-.-.-.': ';', '-...-': '=',
                '.-.-.': '+', '-....-': '-', '..--.-': '_', '.-..-.': '"',
                '...-..-': '$', '.--.-.': '@',
                // Prosigns / Procedural Extensions
                '.-.-': 'Ä', '---.': 'Ö', '..--': 'Ü', '----': 'CH',
                '.-..-': 'È', '..-..': 'É',
                '...---...': 'SOS', '-.-.-': 'START', '-...-.-': 'END'
            };

            const words = str.trim().split('/');
            let result = [];

            for (const word of words) {
                // Regex matches single or sequential spaces to avoid split artifacts
                const letters = word.trim().split(/\s+/);
                let decodedWord = '';
                for (const letter of letters) {
                    if (letter === '') continue;
                    if (morseMap[letter]) {
                        decodedWord += morseMap[letter];
                    } else {
                        decodedWord += '?';
                    }
                }
                if (decodedWord.length > 0) {
                    result.push(decodedWord);
                }
            }

            return result.join(' ') || 'Morse decode: no valid pattern';
        } catch (e) {
            return `Morse decode error: ${e.message}`;
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
        if (/^[0-9a-fA-F]+$/.test(str)) types.push("HEX");
        if (/^[A-Za-z0-9+/=]+$/.test(str)) types.push("BASE64");
        if (/^[.\-/\s]+$/.test(str) && /[.\-]/.test(str)) types.push("MORSE");
        if (/DDN_ENC::/.test(str)) types.push("DDN_ENCRYPTED");
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
        if (/DDN_ENC::/.test(str)) return "DDN encrypted network";
        if (/^[.\-/\s]+$/.test(str) && /[.\-]/.test(str)) return "Morse signal space";
        return "Unknown / local-only";
    }

    // -------------------------------------------------------------
    // Q-NOTES (greeting + JEEEZ + SHeesh + DDN + Morse)
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
        if (/^[45.\-/\s]+$/.test(str) || (/^[.\-/\s]+$/.test(str) && /[.\-]/.test(str))) {
            notes.push("Morse code detected - decoding in progress.");
            const decoded = this.morseDecode(str);
            if (decoded && !decoded.includes("error")) {
                notes.push(`Morse decoded: "${decoded.substring(0, 30)}${decoded.length > 30 ? '...' : ''}"`);
            }
        }
        if (/DDN_ENC::/.test(str)) {
            notes.push("DDN encrypted payload detected - multi-layer decryption applied.");
            const decrypted = this.ddnDecrypt(str);
            if (decrypted && !decrypted.includes("error")) {
                notes.push(`DDN decrypted: "${decrypted.substring(0, 30)}${decrypted.length > 30 ? '...' : ''}"`);
            }
        }

        // Greeting detection
        const greetingOptions = [
            "Yo!", "What's up", "Howdy", "What's Gucii", "Hello", "Hi", "What's Gravy"
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

        // DDN reaction
        if (/DDN_ENC::/.test(str)) {
            notes.push("DDN encryption detected → DDN - Dynamic Data Network!");
        }

        // Morse reaction
        if (/^[.\-/\s]+$/.test(str) && /[.\-]/.test(str)) {
            notes.push("Morse code detected → Morse transmission received!");
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
            <span><strong>DDN Decrypt:</strong> ${meta.ddnDecrypt}</span>
            <span><strong>Morse Decode:</strong> ${meta.morseDecode}</span>
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
        updated: "2026-07-02",
        engine: "QAI-AZTEC-DDN",
        checksum: "QLOGIC_44",
        notes: "Modular Aztec encryption registry for QAI/QuantumLedger systems with upgraded regex Morse parsing."
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
                crypt: "QAI_CRYPT::L7::9912A",
                qntm: "QNTM_ENC{SEQ:77,CHK:OK}",
                ddn: "DDN_ENC::A9F2::XOR5A_REV_CAESAR",
                morse: "- .... .- -. -.- ... / -.-. --- -- .. -. --."
            },

            decode: {
                aztec: " (DB): SHeesh!",
                rot13: null,
                sha256: null,
                altbash: null,
                ddn: "DDN decrypt (DB): Dynamic Data Network - Advanced ClamShell",
                morse: "THANKS COMING"
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
               .join(""),

        ddn: (str) => {
            try {
                let result = str;
                result = result.split("").map(c => String.fromCharCode(c.charCodeAt(0) ^ 0x5A)).join("");
                result = result.split("").reverse().join("");
                const offset = (str.length % 5) + 1;
                result = result.split("").map(c => {
                    const code = c.charCodeAt(0);
                    if (code >= 65 && code <= 90) {
                        return String.fromCharCode(((code - 65 - offset + 26) % 26) + 65);
                    } else if (code >= 97 && code <= 122) {
                        return String.fromCharCode(((code - 97 - offset + 26) % 26) + 97);
                    }
                    return c;
                }).join("");
                result = result.replace(/DDN_ENC::/g, "").replace(/::DDN_END/g, "");
                return result || "DDN decrypt: empty result";
            } catch (e) {
                return `DDN decrypt: error - ${e.message}`;
            }
        },

        morse: (str) => {
            const morseMap = {
                '.-': 'A', '-...': 'B', '-.-.': 'C', '-..': 'D', '.': 'E',
                '..-.': 'F', '--.': 'G', '....': 'H', '..': 'I', '.---': 'J',
                '-.-': 'K', '.-..': 'L', '--': 'M', '-.': 'N', '---': 'O',
                '.--.': 'P', '--.-': 'Q', '.-.': 'R', '...': 'S', '-': 'T',
                '..-': 'U', '...-': 'V', '.--': 'W', '-..-': 'X', '-.--': 'Y',
                '--..': 'Z',
                '-----': '0', '.----': '1', '..---': '2', '...--': '3',
                '....-': '4', '.....': '5', '-....': '6', '--...': '7',
                '---..': '8', '----.': '9',
                '.-.-.-': '.', '--..--': ',', '..--..': '?', '.----.': "'",
                '-.-.--': '!', '-..-.': '/', '-.--.': '(', '-.--.-': ')',
                '.-...': '&', '---...': ':', '-.-.-.': ';', '-...-': '=',
                '.-.-.': '+', '-....-': '-', '..--.-': '_', '.-..-.': '"',
                '...-..-': '$', '.--.-.': '@',
                '.-.-': 'Ä', '---.': 'Ö', '..--': 'Ü', '----': 'CH',
                '...---...': 'SOS'
            };
            
            try {
                const words = str.trim().split('/');
                let result = [];
                for (const word of words) {
                    const letters = word.trim().split(/\s+/);
                    let decodedWord = '';
                    for (const letter of letters) {
                        if (letter === '') continue;
                        if (morseMap[letter]) {
                            decodedWord += morseMap[letter];
                        } else {
                            decodedWord += '?';
                        }
                    }
                    if (decodedWord.length > 0) result.push(decodedWord);
                }
                return result.join(' ') || 'Morse decode: no valid pattern';
            } catch (e) {
                return `Morse decode error: ${e.message}`;
            }
        }
    },

    decryptSignal: async function (entry) {
        const ddnDecoded = this.decoders.ddn(entry.payload.ddn || entry.payload.enc);
        const morseDecoded = this.decoders.morse(entry.payload.morse || entry.payload.enc);
        
        return {
            id: entry.id,
            frame: entry.frame,
            results: {
                aztec: this.decoders.aztec(entry.payload.enc),
                rot13: this.decoders.rot13(entry.payload.enc),
                sha256: await this.decoders.sha256(entry.payload.enc),
                altbash: this.decoders.altbash(entry.payload.enc),
                ddn: ddnDecoded,
                morse: morseDecoded
            }
        };
    }
};